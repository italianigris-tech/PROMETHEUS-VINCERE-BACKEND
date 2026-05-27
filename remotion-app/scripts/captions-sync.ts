import {copyFile, link, mkdir, readFile, rename, rm, stat, writeFile} from "node:fs/promises";
import {spawn} from "node:child_process";
import path from "node:path";

import {transcribeWithAssemblyAI} from "../src/lib/assemblyai";
import {
  deterministicChunkWords,
  getChunkPolicyStats,
  mapWordChunksToCaptionChunks
} from "../src/lib/caption-chunker";
import {loadEnv, assertSupabaseDisabled} from "../src/lib/env.server";
// @ts-ignore Native config loading needs the explicit extension for this Node-only import path.
import {sha256File, sha256Text} from "../src/lib/hash.ts";
import type {
  IngestManifest,
  IngestStageTimingsMs
} from "../src/lib/ingest-manifest";
import {mergeMissingAssetRegistry} from "../src/lib/motion-platform/semantic-sidecall-governor";
import {buildNolanClipPlan} from "../src/lib/nolan-clip-engine";
import {
  buildTranscriptCacheKey,
  buildTranscriptSettingsFingerprint,
  getTranscriptionProviderOrder,
  normalizeTranscriptionMode,
  type TranscriptionMode,
  type TranscriptionProvider
} from "../src/lib/transcription-routing";
import {
  getDefaultCaptionProfileIdForPresentationMode
} from "../src/lib/presentation-presets";
import {resolvePresentationMode} from "../src/lib/presentation-mode";
import {
  getCaptionStyleProfile,
  normalizeCaptionStyleProfileId
} from "../src/lib/stylebooks/caption-style-profiles";
import {buildMotionPlanArtifact} from "../src/lib/motion-platform/motion-plan-artifact";
import {buildMotionCompositionModel} from "../src/lib/motion-platform/scene-engine";
import {getVariationStats} from "../src/lib/variation-router";
import type {
  AppEnv,
  CaptionChunk,
  CaptionStyleProfileId,
  MissingAssetCategoryRecord,
  MotionAssetManifest,
  MotionTier,
  PresentationMode,
  TranscribedWord
} from "../src/lib/types";
import {probeVideoMetadata} from "../src/lib/video-probe";
import {DEFAULT_OUTPUT_JSON, syncShowcaseAssetCache} from "./showcase-assets-sync";

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, ".cache", "assemblyai");
const TRANSCRIPT_MEDIA_DIR = path.join(ROOT, ".cache", "transcript-media");
const DATA_DIR = path.join(ROOT, "src", "data");
const PUBLIC_DIR = path.join(ROOT, "public");
const LOCAL_SHOWCASE_IMPORTS_JSONS = [
  path.join(DATA_DIR, "showcase-assets.imports.local.json"),
  path.join(DATA_DIR, "showcase-assets.imports.prometheus-concrete.local.json")
];
const PREVIEW_PROXY_WIDTH = 384;
const PREVIEW_PROXY_HEIGHT = 216;
const PREVIEW_PROXY_FPS = 18;
const PREVIEW_PROXY_GOP = 18;
const PREVIEW_POSTER_WIDTH = 1280;
const PREVIEW_POSTER_HEIGHT = 720;
const MISSING_MOTION_ASSET_REGISTRY_PATH = path.join(DATA_DIR, "missing-motion-asset-categories.local.json");
const DEFAULT_NOLAN_REFERENCE_SCRIPT_PATH = path.join(DATA_DIR, "nolan.reference-script.txt");

const OUTPUT_TARGETS: Record<PresentationMode, {
  transcriptPath: string;
  captionsPath: string;
  videoMetadataPath: string;
  videoPublicPath: string;
  previewVideoPublicPath: string;
  previewVideoManifestPath: string;
  motionMapPath: string;
  motionPlanPath: string;
  ingestManifestPath: string;
  nolanClipPlanPath?: string;
}> = {
  reel: {
    transcriptPath: path.join(DATA_DIR, "transcript.words.json"),
    captionsPath: path.join(DATA_DIR, "captions.dean-graziosi.json"),
    videoMetadataPath: path.join(DATA_DIR, "video.metadata.json"),
    videoPublicPath: path.join(PUBLIC_DIR, "input-video.mp4"),
    previewVideoPublicPath: path.join(PUBLIC_DIR, "input-video.preview.mp4"),
    previewVideoManifestPath: path.join(PUBLIC_DIR, "input-video.preview.manifest.json"),
    motionMapPath: path.join(DATA_DIR, "motion-map.reel.json"),
    motionPlanPath: path.join(DATA_DIR, "motion-plan.reel.json"),
    ingestManifestPath: path.join(DATA_DIR, "ingest.reel.json")
  },
  "long-form": {
    transcriptPath: path.join(DATA_DIR, "transcript.longform.words.json"),
    captionsPath: path.join(DATA_DIR, "captions.longform.json"),
    videoMetadataPath: path.join(DATA_DIR, "video.longform.metadata.json"),
    videoPublicPath: path.join(PUBLIC_DIR, "input-video-landscape.mp4"),
    previewVideoPublicPath: path.join(PUBLIC_DIR, "input-video-landscape.preview.mp4"),
    previewVideoManifestPath: path.join(PUBLIC_DIR, "input-video-landscape.preview.manifest.json"),
    motionMapPath: path.join(DATA_DIR, "motion-map.longform.json"),
    motionPlanPath: path.join(DATA_DIR, "motion-plan.longform.json"),
    ingestManifestPath: path.join(DATA_DIR, "ingest.longform.json"),
    nolanClipPlanPath: path.join(DATA_DIR, "nolan-clips.longform.json")
  }
};

type OutputTarget = (typeof OUTPUT_TARGETS)[PresentationMode];

type SyncCliArgs = {
  videoPath?: string;
  presentationMode?: PresentationMode;
  captionProfileId?: CaptionStyleProfileId;
  motionTier?: MotionTier | "auto";
  transcriptionMode?: TranscriptionMode;
  referenceScriptPath?: string;
  jobId?: string;
  description?: string;
  refreshShowcaseAssets: boolean;
  skipPreviewProxy: boolean;
};

type SourceVideoSyncMethod = "hard-link" | "copy";

type PreviewProxyEncoderPlan = {
  label: string;
  args: string[];
};

type PreviewProxyManifest = {
  sourceVideoHash: string;
  settingsFingerprint: string;
  generatedAt: string;
  outputPath: string;
  outputPublicPath: string;
  width: number;
  height: number;
  fps: number;
  encoderLabel: string;
};

const readJsonIfExists = async <T>(filePath: string): Promise<T | null> => {
  try {
    const contents = await readFile(filePath, "utf-8");
    return JSON.parse(contents) as T;
  } catch {
    return null;
  }
};

const readTextIfExists = async (filePath: string | null | undefined): Promise<string | null> => {
  if (!filePath?.trim()) {
    return null;
  }

  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
};

const readLocalShowcaseImports = async (): Promise<MotionAssetManifest[]> => {
  const manifests = await Promise.all(
    LOCAL_SHOWCASE_IMPORTS_JSONS.map((filePath) => readJsonIfExists<MotionAssetManifest[]>(filePath))
  );

  return manifests.flatMap((manifest) => manifest ?? []);
};

const runCommandCapture = async (
  command: string,
  args: string[]
): Promise<{stdout: string; stderr: string}> => {
  return new Promise<{stdout: string; stderr: string}>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve({stdout, stderr});
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? "unknown"}: ${stderr || stdout}`));
    });
  });
};

const runCommand = async (command: string, args: string[]): Promise<void> => {
  await runCommandCapture(command, args);
};

const describeError = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const buildPreviewProxySettingsFingerprint = (sourceVideoHash: string): string => {
  return sha256Text([
    sourceVideoHash,
    PREVIEW_PROXY_WIDTH,
    PREVIEW_PROXY_HEIGHT,
    PREVIEW_PROXY_FPS,
    PREVIEW_PROXY_GOP
  ].join("|"));
};

const readPreviewProxyManifest = async (
  manifestPath: string
): Promise<PreviewProxyManifest | null> => {
  return readJsonIfExists<PreviewProxyManifest>(manifestPath);
};

let ffmpegEncoderSetPromise: Promise<Set<string>> | null = null;

const readAvailableFfmpegEncoders = async (): Promise<Set<string>> => {
  if (ffmpegEncoderSetPromise) {
    return ffmpegEncoderSetPromise;
  }

  ffmpegEncoderSetPromise = runCommandCapture("ffmpeg", ["-hide_banner", "-encoders"])
    .then(({stdout, stderr}) => {
      const output = `${stdout}\n${stderr}`;
      return new Set(
        output
          .split(/\r?\n/)
          .map((line) => line.match(/^\s*[A-Z\.]{6}\s+([A-Za-z0-9_]+)/)?.[1] ?? null)
          .filter((value): value is string => value !== null)
      );
    })
    .catch(() => new Set<string>());

  return ffmpegEncoderSetPromise;
};

const buildPreviewProxyEncoderPlans = async (): Promise<PreviewProxyEncoderPlan[]> => {
  const availableEncoders = await readAvailableFfmpegEncoders();
  const plans: PreviewProxyEncoderPlan[] = [];

  if (availableEncoders.has("h264_nvenc")) {
    plans.push({
      label: "h264_nvenc",
      args: [
        "-c:v", "h264_nvenc",
        "-preset", "p1",
        "-cq", "34",
        "-b:v", "0"
      ]
    });
  }

  if (availableEncoders.has("h264_qsv")) {
    plans.push({
      label: "h264_qsv",
      args: [
        "-c:v", "h264_qsv",
        "-preset", "veryfast",
        "-global_quality", "32",
        "-look_ahead", "0"
      ]
    });
  }

  if (availableEncoders.has("h264_amf")) {
    plans.push({
      label: "h264_amf",
      args: [
        "-c:v", "h264_amf",
        "-quality", "speed",
        "-rc", "cqp",
        "-qp_i", "34",
        "-qp_p", "36"
      ]
    });
  }

  plans.push({
    label: "libx264",
    args: [
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-tune", "zerolatency",
      "-crf", "31"
    ]
  });

  return plans;
};

const formatBytes = (value: number): string => {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const createAtomicTempPath = (
  targetPath: string,
  preserveExtension = false
): string => {
  const directory = path.dirname(targetPath);
  const extension = path.extname(targetPath);
  const fileName = path.basename(targetPath, extension);
  const suffix = preserveExtension && extension
    ? `.${process.pid}.${Date.now()}.tmp${extension}`
    : `${extension}.${process.pid}.${Date.now()}.tmp`;
  return path.join(directory, `.${fileName}${suffix}`);
};

const insertPathSuffixBeforeExtension = (
  filePath: string,
  suffix: string
): string => {
  const extension = path.extname(filePath);
  const fileName = path.basename(filePath, extension);
  return path.join(path.dirname(filePath), `${fileName}.${suffix}${extension}`);
};

const buildVersionedVideoOutputTargets = (
  outputTargets: OutputTarget,
  versionTag: string | null
): OutputTarget => {
  if (!versionTag) {
    return outputTargets;
  }

  const videoPublicPath = insertPathSuffixBeforeExtension(outputTargets.videoPublicPath, versionTag);
  return {
    ...outputTargets,
    videoPublicPath,
    previewVideoPublicPath: videoPublicPath.replace(/\.mp4$/i, ".preview.mp4"),
    previewVideoManifestPath: videoPublicPath.replace(/\.mp4$/i, ".preview.manifest.json")
  };
};

const replaceFileAtomically = async ({
  sourcePath,
  targetPath
}: {
  sourcePath: string;
  targetPath: string;
}): Promise<void> => {
  await rm(targetPath, {force: true});
  await rename(sourcePath, targetPath);
};

const writeJsonAtomic = async (filePath: string, value: unknown): Promise<void> => {
  const tempPath = createAtomicTempPath(filePath);
  await writeJson(tempPath, value);
  await replaceFileAtomically({
    sourcePath: tempPath,
    targetPath: filePath
  });
};

const syncVideoFileAtomic = async ({
  sourcePath,
  targetPath
}: {
  sourcePath: string;
  targetPath: string;
}): Promise<SourceVideoSyncMethod> => {
  const tempPath = createAtomicTempPath(targetPath);
  try {
    await link(sourcePath, tempPath);
    await replaceFileAtomically({
      sourcePath: tempPath,
      targetPath
    });
    return "hard-link";
  } catch {
    await rm(tempPath, {force: true});
  }

  await copyFile(sourcePath, tempPath);
  await replaceFileAtomically({
    sourcePath: tempPath,
    targetPath
  });
  return "copy";
};

const generatePreviewProxyAtomic = async ({
  videoPath,
  outputPath,
  outputManifestPath,
  sourceVideoHash
}: {
  videoPath: string;
  outputPath: string;
  outputManifestPath: string;
  sourceVideoHash: string;
}): Promise<{cacheHit: boolean; encoderLabel: string; settingsFingerprint: string}> => {
  const outputPublicPath = `/${path.basename(outputPath)}`;
  const settingsFingerprint = buildPreviewProxySettingsFingerprint(sourceVideoHash);
  const currentManifest = await readPreviewProxyManifest(outputManifestPath);

  if (
    currentManifest &&
    currentManifest.sourceVideoHash === sourceVideoHash &&
    currentManifest.settingsFingerprint === settingsFingerprint
  ) {
    try {
      const cachedProxy = await stat(outputPath);
      if (cachedProxy.size > 0) {
        return {
          cacheHit: true,
          encoderLabel: currentManifest.encoderLabel,
          settingsFingerprint
        };
      }
    } catch {
      // Fall through and regenerate if the cached proxy is missing or empty.
    }
  }

  const tempPath = createAtomicTempPath(outputPath, true);
  const encoderPlans = await buildPreviewProxyEncoderPlans();
  let lastError: unknown = null;

  for (const encoderPlan of encoderPlans) {
    try {
      await rm(tempPath, {force: true});
      await runCommand("ffmpeg", [
        "-y",
        "-i", videoPath,
        "-vf",
        `fps=${PREVIEW_PROXY_FPS},scale=${PREVIEW_PROXY_WIDTH}:${PREVIEW_PROXY_HEIGHT}:force_original_aspect_ratio=decrease,pad=${PREVIEW_PROXY_WIDTH}:${PREVIEW_PROXY_HEIGHT}:(ow-iw)/2:(oh-ih)/2`,
        ...encoderPlan.args,
        "-g", String(PREVIEW_PROXY_GOP),
        "-keyint_min", String(PREVIEW_PROXY_GOP),
        "-sc_threshold", "0",
        "-bf", "0",
        "-pix_fmt", "yuv420p",
        "-ac", "2",
        "-ar", "44100",
        "-c:a", "aac",
        "-b:a", "64k",
        "-movflags", "+faststart",
        tempPath
      ]);
      await replaceFileAtomically({
        sourcePath: tempPath,
        targetPath: outputPath
      });
      await writeJsonAtomic(outputManifestPath, {
        sourceVideoHash,
        settingsFingerprint,
        generatedAt: new Date().toISOString(),
        outputPath,
        outputPublicPath,
        width: PREVIEW_PROXY_WIDTH,
        height: PREVIEW_PROXY_HEIGHT,
        fps: PREVIEW_PROXY_FPS,
        encoderLabel: encoderPlan.label
      } satisfies PreviewProxyManifest);
      return {
        cacheHit: false,
        encoderLabel: encoderPlan.label,
        settingsFingerprint
      };
    } catch (error) {
      lastError = error;
      await rm(tempPath, {force: true});
      console.warn(
        `Preview proxy encoder ${encoderPlan.label} failed. Retrying with a different encoder. Reason: ${
          describeError(error)
        }`
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to generate the preview proxy with any available encoder.");
};

const generatePreviewPosterAtomic = async ({
  videoPath,
  outputPath
}: {
  videoPath: string;
  outputPath: string;
}): Promise<void> => {
  const tempPath = createAtomicTempPath(outputPath, true);
  try {
    await rm(tempPath, {force: true});
    await runCommand("ffmpeg", [
      "-y",
      "-ss",
      "1",
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-vf",
      `scale=${PREVIEW_POSTER_WIDTH}:${PREVIEW_POSTER_HEIGHT}:force_original_aspect_ratio=decrease,pad=${PREVIEW_POSTER_WIDTH}:${PREVIEW_POSTER_HEIGHT}:(ow-iw)/2:(oh-ih)/2`,
      "-c:v",
      "libwebp",
      "-quality",
      "82",
      "-compression_level",
      "6",
      tempPath
    ]);
    await replaceFileAtomically({
      sourcePath: tempPath,
      targetPath: outputPath
    });
  } catch (error) {
    await rm(tempPath, {force: true});
    console.warn(`Failed to generate the preview poster. Reason: ${describeError(error)}`);
  }
};

const collectSyncIssues = async ({
  sourceVideoPath,
  sourceVideoHash,
  outputTargets,
  skipPreviewProxy
}: {
  sourceVideoPath: string;
  sourceVideoHash: string;
  outputTargets: OutputTarget;
  skipPreviewProxy: boolean;
}): Promise<string[]> => {
  const checks = [
    outputTargets.transcriptPath,
    outputTargets.captionsPath,
    outputTargets.videoMetadataPath,
    outputTargets.videoPublicPath,
    outputTargets.motionMapPath
  ];
  if (!skipPreviewProxy) {
    checks.push(outputTargets.previewVideoPublicPath);
  }
  if (outputTargets.nolanClipPlanPath) {
    checks.push(outputTargets.nolanClipPlanPath);
  }

  const issues: string[] = [];
  for (const filePath of checks) {
    try {
      const fileStat = await stat(filePath);
      if (fileStat.size <= 0) {
        issues.push(`Output is empty: ${filePath}`);
      }
    } catch {
      issues.push(`Output is missing: ${filePath}`);
    }
  }

  if (!sourceVideoPath.trim()) {
    issues.push("Source video path was empty.");
  }
  if (!sourceVideoHash.trim()) {
    issues.push("Source video hash was empty.");
  }

  return issues;
};

const ensureTranscriptSourceMedia = async ({
  videoPath,
  videoFileHash
}: {
  videoPath: string;
  videoFileHash: string;
}): Promise<{
  mediaPath: string;
  mediaSizeBytes: number;
}> => {
  const mediaPath = path.join(TRANSCRIPT_MEDIA_DIR, `${videoFileHash}.transcript-source.m4a`);

  try {
    const existing = await stat(mediaPath);
    if (existing.size > 0) {
      return {
        mediaPath,
        mediaSizeBytes: existing.size
      };
    }
  } catch {
    // Fall through and create the cached transcript media.
  }

  await mkdir(TRANSCRIPT_MEDIA_DIR, {recursive: true});
  await runCommand("ffmpeg", [
    "-y",
    "-i", videoPath,
    "-vn",
    "-ac", "1",
    "-ar", "16000",
    "-c:a", "aac",
    "-b:a", "48k",
    mediaPath
  ]);

  const created = await stat(mediaPath);
  return {
    mediaPath,
    mediaSizeBytes: created.size
  };
};

const normalizeWords = (words: TranscribedWord[]): TranscribedWord[] => {
  return words
    .map((word) => ({
      ...word,
      text: word.text.trim()
    }))
    .filter((word) => word.text.length > 0)
    .sort((a, b) => a.startMs - b.startMs);
};

const ensureMonotonicWordTimings = (words: TranscribedWord[]): void => {
  for (let i = 1; i < words.length; i += 1) {
    const previous = words[i - 1];
    const current = words[i];
    if (current.startMs < previous.startMs) {
      throw new Error(`Transcript timing regression at index ${i}: ${current.startMs} < ${previous.startMs}`);
    }
    if (current.endMs < current.startMs) {
      throw new Error(`Transcript word has invalid timing at index ${i}: end < start.`);
    }
  }
};

const parseArgs = (): SyncCliArgs => {
  const args = process.argv.slice(2);
  const readArgValue = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    if (index < 0) {
      return undefined;
    }
    return args[index + 1]?.trim() || undefined;
  };

  const presentationMode = readArgValue("--presentation");
  const captionProfileId = readArgValue("--caption-profile");
  const motionTier = readArgValue("--motion-tier");
  const transcriptionMode = readArgValue("--transcription-mode");

  return {
    videoPath: readArgValue("--video"),
    presentationMode:
      presentationMode === "reel" || presentationMode === "long-form"
        ? presentationMode
        : undefined,
    captionProfileId: captionProfileId
      ? normalizeCaptionStyleProfileId(captionProfileId)
      : undefined,
    motionTier:
      motionTier === "auto" || motionTier === "minimal" || motionTier === "editorial" || motionTier === "premium" || motionTier === "hero"
        ? motionTier
        : undefined,
    transcriptionMode:
      transcriptionMode === "assemblyai"
        ? "assemblyai"
        : undefined,
    referenceScriptPath: readArgValue("--reference-script"),
    jobId: readArgValue("--job-id"),
    description: readArgValue("--description"),
    refreshShowcaseAssets: args.includes("--refresh-showcase-assets"),
    skipPreviewProxy: args.includes("--skip-preview-proxy")
  };
};

const resolveCaptionProfileId = ({
  env,
  rawEnvCaptionProfile,
  cliArgs,
  presentationMode
}: {
  env: AppEnv;
  rawEnvCaptionProfile: string | undefined;
  cliArgs: SyncCliArgs;
  presentationMode: PresentationMode;
}): CaptionStyleProfileId => {
  if (cliArgs.captionProfileId) {
    return cliArgs.captionProfileId;
  }

  if (rawEnvCaptionProfile?.trim()) {
    return env.CAPTION_STYLE_PROFILE;
  }

  return getDefaultCaptionProfileIdForPresentationMode(presentationMode);
};

const formatTimecode = (valueMs: number): string => {
  const totalSeconds = Math.max(0, valueMs) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
};

const loadShowcaseCatalog = async ({
  refresh
}: {
  refresh: boolean;
}): Promise<{
  catalog: MotionAssetManifest[];
  source: "synced" | "cached";
  warnings: string[];
}> => {
  const cachedCatalog = await readJsonIfExists<MotionAssetManifest[]>(DEFAULT_OUTPUT_JSON);
  const localImportedCatalog = await readLocalShowcaseImports();
  const mergedCachedCatalog = [
    ...(cachedCatalog ?? []),
    ...localImportedCatalog
  ].reduce<MotionAssetManifest[]>((accumulator, manifest) => {
    if (accumulator.some((entry) => entry.id === manifest.id)) {
      return accumulator;
    }
    accumulator.push(manifest);
    return accumulator;
  }, []);
  const hasCachedCatalog = Array.isArray(cachedCatalog) && cachedCatalog.length > 0;

  if (!refresh && hasCachedCatalog) {
    return {
      catalog: mergedCachedCatalog,
      source: "cached",
      warnings: []
    };
  }

  const syncResult = await syncShowcaseAssetCache({
    publish: false
  });

  return {
    catalog: [
      ...syncResult.manifests,
      ...(localImportedCatalog ?? [])
    ].reduce<MotionAssetManifest[]>((accumulator, manifest) => {
      if (accumulator.some((entry) => entry.id === manifest.id)) {
        return accumulator;
      }
      accumulator.push(manifest);
      return accumulator;
    }, []),
    source: "synced",
    warnings: syncResult.warnings
  };
};

const syncCaptions = async (): Promise<void> => {
  const ingestStartedAt = Date.now();
  const stageTimingsMs: IngestStageTimingsMs = {
    videoProbe: 0,
    transcriptMediaPrep: 0,
    transcription: 0,
    chunking: 0,
    motionMapping: 0,
    clipPlanning: 0,
    proxyGeneration: 0,
    writeOutputs: 0,
    total: 0
  };
  const cliArgs = parseArgs();
  if (cliArgs.videoPath) {
    process.env.VIDEO_SOURCE_PATH = cliArgs.videoPath;
  }

  const rawEnvCaptionProfile = process.env.CAPTION_STYLE_PROFILE;
  const env = loadEnv();
  assertSupabaseDisabled(env);

  await mkdir(CACHE_DIR, {recursive: true});
  await mkdir(TRANSCRIPT_MEDIA_DIR, {recursive: true});
  await mkdir(DATA_DIR, {recursive: true});
  await mkdir(PUBLIC_DIR, {recursive: true});
  await mkdir(path.join(ROOT, "out"), {recursive: true});

  const videoPath = path.resolve(cliArgs.videoPath ?? env.VIDEO_SOURCE_PATH);
  await stat(videoPath);

  const videoProbeStartedAt = Date.now();
  const [videoFileHash, videoMetadata] = await Promise.all([
    sha256File(videoPath),
    probeVideoMetadata(videoPath)
  ]);
  stageTimingsMs.videoProbe = Date.now() - videoProbeStartedAt;
  const resolvedPresentationMode = cliArgs.presentationMode ?? resolvePresentationMode(videoMetadata);
  const resolvedCaptionProfileId = resolveCaptionProfileId({
    env,
    rawEnvCaptionProfile,
    cliArgs,
    presentationMode: resolvedPresentationMode
  });
  const captionStyleProfile = getCaptionStyleProfile(resolvedCaptionProfileId);
  const activeSourceId = sha256Text(`${resolvedPresentationMode}|${videoFileHash}`);
  const outputTargets = buildVersionedVideoOutputTargets(
    OUTPUT_TARGETS[resolvedPresentationMode],
    resolvedPresentationMode === "long-form"
      ? `${activeSourceId.slice(0, 10)}-${Date.now().toString(36)}`
      : null
  );
  const resolvedTranscriptionMode = normalizeTranscriptionMode(
    cliArgs.transcriptionMode,
    resolvedPresentationMode
  );
  const transcriptMediaPrepStartedAt = Date.now();
  const transcriptSourceMedia = await ensureTranscriptSourceMedia({
    videoPath,
    videoFileHash
  });
  stageTimingsMs.transcriptMediaPrep = Date.now() - transcriptMediaPrepStartedAt;
  const originalVideoSizeBytes = (await stat(videoPath)).size;

  console.log(`Video source: ${videoPath}`);
  console.log(`Presentation mode: ${resolvedPresentationMode}`);
  console.log(`Caption profile: ${captionStyleProfile.displayName} (${captionStyleProfile.id})`);
  console.log(`Source ID: ${activeSourceId}`);
  console.log(`Transcription mode: ${resolvedTranscriptionMode}`);
  console.log(
    `Transcript source media: ${transcriptSourceMedia.mediaPath} ` +
      `(${formatBytes(transcriptSourceMedia.mediaSizeBytes)} from ${formatBytes(originalVideoSizeBytes)})`
  );
  if (cliArgs.jobId) {
    console.log(`Job ID: ${cliArgs.jobId}`);
  }
  if (cliArgs.description) {
    console.log(`Description: ${cliArgs.description}`);
  }

  let transcriptWords: TranscribedWord[] | null = null;
  let transcriptCacheKey = "";
  let transcriptCachePath = "";
  let transcriptCacheSource: "cache" | TranscriptionProvider = "cache";
  let transcriptionProvider: TranscriptionProvider | null = null;
  const transcriptionFallbacks: string[] = [];
  const transcriptionStartedAt = Date.now();
  for (const provider of getTranscriptionProviderOrder(resolvedTranscriptionMode)) {
    const settingsFingerprint = buildTranscriptSettingsFingerprint({
      provider
    });
    const candidateCacheKey = buildTranscriptCacheKey({
      sourceVideoHash: videoFileHash,
      provider,
      settingsFingerprint
    });
    const candidateCachePath = path.join(CACHE_DIR, `${candidateCacheKey}.words.json`);
    const cachedWords = await readJsonIfExists<TranscribedWord[]>(candidateCachePath);

    if (cachedWords) {
      transcriptWords = normalizeWords(cachedWords);
      ensureMonotonicWordTimings(transcriptWords);
      transcriptCacheKey = candidateCacheKey;
      transcriptCachePath = candidateCachePath;
      transcriptCacheSource = "cache";
      transcriptionProvider = provider;
      console.log(`Transcript cache hit for ${provider}. Reusing ${candidateCachePath}.`);
      break;
    }

    try {
      let rawWords: TranscribedWord[];
      if (!env.ASSEMBLYAI_API_KEY.trim()) {
        throw new Error("ASSEMBLYAI_API_KEY is required for transcription.");
      }
      console.log("No AssemblyAI transcript cache hit. Uploading media to AssemblyAI...");
      rawWords = await transcribeWithAssemblyAI({
        filePath: transcriptSourceMedia.mediaPath,
        apiKey: env.ASSEMBLYAI_API_KEY
      });

      transcriptWords = normalizeWords(rawWords);
      ensureMonotonicWordTimings(transcriptWords);
      transcriptCacheKey = candidateCacheKey;
      transcriptCachePath = candidateCachePath;
      transcriptCacheSource = provider;
      transcriptionProvider = provider;
      await writeJsonAtomic(candidateCachePath, transcriptWords);
      console.log(`${provider} transcript cached at: ${candidateCachePath}`);
      break;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      transcriptionFallbacks.push(`${provider}: ${reason}`);
      throw error;
    }
  }

  if (!transcriptWords || !transcriptionProvider) {
    throw new Error(
      `No transcription provider succeeded. ${transcriptionFallbacks.join(" | ") || "No provider details available."}`
    );
  }
  stageTimingsMs.transcription = Date.now() - transcriptionStartedAt;

  const chunkingStartedAt = Date.now();
  const deterministicChunks = deterministicChunkWords(transcriptWords, {
    profileId: resolvedCaptionProfileId
  });
  const finalChunks = deterministicChunks;
  const emphasisOverrides: Record<number, number[]> | undefined = undefined;
  const intelligenceSource = "deterministic-projection";
  console.log("Frontend caption sync uses deterministic projection only. Model routing is backend-owned.");

  const captionChunks: CaptionChunk[] = mapWordChunksToCaptionChunks(finalChunks, emphasisOverrides, {
    profileId: resolvedCaptionProfileId
  });
  const policyStats = getChunkPolicyStats(finalChunks, {
    profileId: resolvedCaptionProfileId
  });
  const variationStats = getVariationStats(finalChunks);
  stageTimingsMs.chunking = Date.now() - chunkingStartedAt;
  const showcaseCatalogResult = await loadShowcaseCatalog({
    refresh: cliArgs.refreshShowcaseAssets
  });
  showcaseCatalogResult.warnings.forEach((warning) => {
    console.warn(warning);
  });
  const motionMappingStartedAt = Date.now();
  const motionModel = buildMotionCompositionModel({
    chunks: captionChunks,
    tier: cliArgs.motionTier ?? "auto",
    fps: videoMetadata.fps,
    videoMetadata,
    captionProfileId: resolvedCaptionProfileId,
    showcaseCatalog: showcaseCatalogResult.catalog
  });
  const motionPlanArtifact = buildMotionPlanArtifact({
    jobId: cliArgs.jobId ?? activeSourceId,
    videoMetadata,
    captionProfileId: resolvedCaptionProfileId,
    motionTier: cliArgs.motionTier ?? "auto",
    gradeProfileId: motionModel.motionPlan.gradeProfileId,
    transitionPresetId: motionModel.motionPlan.transitionPresetId,
    matteMode: motionModel.motionPlan.matteMode,
    captionBias: motionModel.captionBias,
    presentationMode: resolvedPresentationMode,
    motion3DMode: motionModel.motion3DPlan.mode,
    transitionOverlayMode: motionModel.transitionOverlayPlan.mode,
    suppressAmbientAssets: false,
    chunks: captionChunks,
    transcriptWords: transcriptWords,
    showcaseCatalog: showcaseCatalogResult.catalog,
    motionModelOverride: motionModel,
    generatedAt: new Date().toISOString()
  });
  stageTimingsMs.motionMapping = Date.now() - motionMappingStartedAt;
  const defaultReferenceScriptPath = cliArgs.referenceScriptPath
    ? path.resolve(cliArgs.referenceScriptPath)
    : DEFAULT_NOLAN_REFERENCE_SCRIPT_PATH;
  const nolanReferenceScriptText = resolvedPresentationMode === "long-form"
    ? await readTextIfExists(defaultReferenceScriptPath)
    : null;
  const clipPlanningStartedAt = Date.now();
  const nolanClipPlan = resolvedPresentationMode === "long-form"
    ? buildNolanClipPlan({
      chunks: captionChunks,
      videoMetadata,
      sourceVideoPath: videoPath,
      sourceVideoHash: videoFileHash,
      sourceCaptionPath: outputTargets.captionsPath,
      referenceScriptText: nolanReferenceScriptText,
      referenceScriptPath: nolanReferenceScriptText ? defaultReferenceScriptPath : null
    })
    : null;
  stageTimingsMs.clipPlanning = Date.now() - clipPlanningStartedAt;
  const generatedAt = new Date().toISOString();
  const existingMissingAssetRegistry = await readJsonIfExists<MissingAssetCategoryRecord[]>(
    MISSING_MOTION_ASSET_REGISTRY_PATH
  );
  const missingMotionAssetRegistry = mergeMissingAssetRegistry({
    existingRecords: existingMissingAssetRegistry ?? [],
    observedRecords: motionModel.showcaseIntelligencePlan.missingAssetCategories,
    observedAt: generatedAt
  });

  const motionMap = {
    generatedAt,
    activeSourceId,
    sourceVideoPath: videoPath,
    sourceVideoHash: videoFileHash,
    presentationMode: resolvedPresentationMode,
    typography: {
      captionProfileId: resolvedCaptionProfileId,
      captionProfileDisplayName: captionStyleProfile.displayName,
      captionBias: motionModel.captionBias
    },
    requestedMotionTier: cliArgs.motionTier ?? "auto",
    resolvedMotionTier: motionModel.tier,
    showcaseGovernor: motionModel.showcaseIntelligencePlan.governorProfileId
      ? {
        profileId: motionModel.showcaseIntelligencePlan.governorProfileId,
        version: motionModel.showcaseIntelligencePlan.governorVersion,
        selectedAssetCueCount: motionModel.showcaseIntelligencePlan.selectedAssetCueCount,
        selectedTemplateCueCount: motionModel.showcaseIntelligencePlan.selectedTemplateCueCount,
        selectedTypographyCueCount: motionModel.showcaseIntelligencePlan.selectedTypographyCueCount,
        missingCategoryCount: motionModel.showcaseIntelligencePlan.missingAssetCategories.length,
        queuedCategories: motionModel.showcaseIntelligencePlan.missingAssetCategories.map((record) => ({
          categoryId: record.categoryId,
          label: record.label,
          requestedPack: record.requestedPack,
          count: record.count
        })),
        missingAssetRegistryPath: MISSING_MOTION_ASSET_REGISTRY_PATH
      }
      : null,
    showcaseCatalog: {
      source: showcaseCatalogResult.source,
      assetCount: showcaseCatalogResult.catalog.length,
      cachePath: DEFAULT_OUTPUT_JSON
    },
    motionPlan: {
      planVersion: motionPlanArtifact.plan_version,
      generatedAt: motionPlanArtifact.generated_at,
      selectedAssetCount: motionPlanArtifact.selected_assets.length,
      timelineEventCount: motionPlanArtifact.timeline_events.length,
      assetAssignmentCount: motionPlanArtifact.asset_assignments.length,
      outputPath: outputTargets.motionPlanPath
    },
    selectedMoments: motionModel.showcaseIntelligencePlan.selectedIntents.map((intent) => ({
      conceptLabel: intent.conceptLabel,
      matchedText: intent.matchedText,
      startMs: intent.matchedStartMs,
      endMs: intent.matchedEndMs,
      timecode: `${formatTimecode(intent.matchedStartMs)} - ${formatTimecode(intent.matchedEndMs)}`,
      placementHint: intent.placementHint,
      cueSource: intent.governorDecision?.cueSource ?? "direct-asset",
      governorAction: intent.governorDecision?.action ?? null,
      governorScore: intent.governorDecision?.score ?? null,
      governorReasonCodes: intent.governorDecision?.reasonCodes ?? [],
      templateGraphicCategory: intent.governorDecision?.templateGraphicCategory ?? null,
      matchedAssetId: intent.matchedAsset?.id ?? null,
      matchedAssetLabel: intent.matchedAsset?.canonicalLabel ?? null,
      missingCategoryId: intent.missingAssetCategory?.categoryId ?? null,
      reasoning: intent.reasoning
    })),
    flaggedMoments: motionModel.showcaseIntelligencePlan.flaggedIntents.map((intent) => ({
      conceptLabel: intent.conceptLabel,
      matchedText: intent.matchedText,
      startMs: intent.matchedStartMs,
      endMs: intent.matchedEndMs,
      timecode: `${formatTimecode(intent.matchedStartMs)} - ${formatTimecode(intent.matchedEndMs)}`,
      cueSource: intent.governorDecision?.cueSource ?? null,
      governorAction: intent.governorDecision?.action ?? null,
      governorScore: intent.governorDecision?.score ?? null,
      governorReasonCodes: intent.governorDecision?.reasonCodes ?? [],
      templateGraphicCategory: intent.governorDecision?.templateGraphicCategory ?? null,
      recommendedLabels: intent.recommendedLabels,
      assetSearchTerms: intent.assetSearchTerms,
      missingCategory: intent.missingAssetCategory ?? null,
      unresolvedReason: intent.unresolvedReason ?? null
    })),
    suppressedMoments: motionModel.showcaseIntelligencePlan.suppressedIntents.map((intent) => ({
      conceptLabel: intent.conceptLabel,
      matchedText: intent.matchedText,
      startMs: intent.matchedStartMs,
      endMs: intent.matchedEndMs,
      timecode: `${formatTimecode(intent.matchedStartMs)} - ${formatTimecode(intent.matchedEndMs)}`,
      cueSource: intent.governorDecision?.cueSource ?? null,
      governorAction: intent.governorDecision?.action ?? null,
      governorScore: intent.governorDecision?.score ?? null,
      governorReasonCodes: intent.governorDecision?.reasonCodes ?? [],
      templateGraphicCategory: intent.governorDecision?.templateGraphicCategory ?? null,
      missingCategory: intent.missingAssetCategory ?? null,
      unresolvedReason: intent.unresolvedReason ?? null
    })),
    missingAssetCategories: motionModel.showcaseIntelligencePlan.missingAssetCategories,
    showcaseCues: motionModel.showcasePlan.cues,
    reasons: motionModel.showcaseIntelligencePlan.reasons
  };
  const previewProxy = cliArgs.skipPreviewProxy
    ? {
      cacheHit: false,
      encoderLabel: "skipped",
      settingsFingerprint: "skipped"
    }
    : await (async () => {
      const proxyGenerationStartedAt = Date.now();
      const generatedPreviewProxy = await generatePreviewProxyAtomic({
        videoPath,
        outputPath: outputTargets.previewVideoPublicPath,
        outputManifestPath: outputTargets.previewVideoManifestPath,
        sourceVideoHash: videoFileHash
      });
      await generatePreviewPosterAtomic({
        videoPath: outputTargets.previewVideoPublicPath,
        outputPath: outputTargets.previewVideoPublicPath.replace(/\.mp4$/i, ".poster.webp")
      });
      stageTimingsMs.proxyGeneration = Date.now() - proxyGenerationStartedAt;
      return generatedPreviewProxy;
    })();
  const writeOutputsStartedAt = Date.now();
  const [
    ,
    ,
    ,
    ,
    ,
    ,
    sourceVideoSyncMethod
  ] = await Promise.all([
    writeJsonAtomic(outputTargets.transcriptPath, transcriptWords),
    writeJsonAtomic(outputTargets.captionsPath, captionChunks),
    writeJsonAtomic(outputTargets.videoMetadataPath, videoMetadata),
    writeJsonAtomic(outputTargets.motionMapPath, motionMap),
    writeJsonAtomic(outputTargets.motionPlanPath, motionPlanArtifact),
    writeJsonAtomic(MISSING_MOTION_ASSET_REGISTRY_PATH, missingMotionAssetRegistry),
    nolanClipPlan && outputTargets.nolanClipPlanPath
      ? writeJsonAtomic(outputTargets.nolanClipPlanPath, nolanClipPlan)
      : Promise.resolve(),
    syncVideoFileAtomic({
      sourcePath: videoPath,
      targetPath: outputTargets.videoPublicPath
    })
  ]);
  stageTimingsMs.writeOutputs = Date.now() - writeOutputsStartedAt;
  stageTimingsMs.total = Date.now() - ingestStartedAt;
  const syncIssues = await collectSyncIssues({
    sourceVideoPath: videoPath,
    sourceVideoHash: videoFileHash,
    outputTargets,
    skipPreviewProxy: cliArgs.skipPreviewProxy
  });
  const previewVideoUrlVersion = path.basename(outputTargets.previewVideoPublicPath, ".mp4");
  const ingestManifest: IngestManifest = {
    generatedAt,
    activeSourceId,
    sourceVideoPath: videoPath,
    sourceVideoHash: videoFileHash,
    previewVideoUrlVersion,
    syncState: syncIssues.length === 0 ? "ready" : "stale",
    syncIssues,
    transcriptCacheKey,
    transcriptCachePath,
    transcriptSource: transcriptCacheSource,
    transcriptionMode: resolvedTranscriptionMode,
    transcriptionProvider,
    transcriptionFallbacks,
    transcriptSourceMediaPath: transcriptSourceMedia.mediaPath,
    transcriptSourceMediaSizeBytes: transcriptSourceMedia.mediaSizeBytes,
    originalVideoSizeBytes,
    presentationMode: resolvedPresentationMode,
    captionProfileId: resolvedCaptionProfileId,
    captionProfileDisplayName: captionStyleProfile.displayName,
    requestedMotionTier: cliArgs.motionTier ?? "auto",
    resolvedMotionTier: motionModel.tier,
    jobId: cliArgs.jobId ?? null,
    description: cliArgs.description ?? null,
    selectedMotionMomentCount: motionModel.showcaseIntelligencePlan.selectedIntents.length,
    flaggedMotionMomentCount: motionModel.showcaseIntelligencePlan.flaggedIntents.length,
    suppressedMotionMomentCount: motionModel.showcaseIntelligencePlan.suppressedIntents.length,
    showcaseGovernor: motionModel.showcaseIntelligencePlan.governorProfileId
      ? {
        profileId: motionModel.showcaseIntelligencePlan.governorProfileId,
        version: motionModel.showcaseIntelligencePlan.governorVersion ?? "unknown",
        selectedAssetCueCount: motionModel.showcaseIntelligencePlan.selectedAssetCueCount,
        selectedTemplateCueCount: motionModel.showcaseIntelligencePlan.selectedTemplateCueCount,
        selectedTypographyCueCount: motionModel.showcaseIntelligencePlan.selectedTypographyCueCount,
        missingCategoryCount: motionModel.showcaseIntelligencePlan.missingAssetCategories.length,
        queuedCategoryIds: motionModel.showcaseIntelligencePlan.missingAssetCategories.map((record) => record.categoryId),
        missingAssetRegistryPath: MISSING_MOTION_ASSET_REGISTRY_PATH
      }
      : null,
    nolanClipPlan: nolanClipPlan
      ? {
        engineId: nolanClipPlan.engineId,
        version: nolanClipPlan.version,
        candidateCount: nolanClipPlan.summary.candidateCount,
        pageCount: nolanClipPlan.summary.pageCount,
        recommendedClipIds: nolanClipPlan.summary.recommendedClipIds,
        referenceScriptPath: nolanClipPlan.referenceScript.sourcePath,
        referenceSectionCount: nolanClipPlan.referenceScript.sectionCount,
        outputPath: outputTargets.nolanClipPlanPath
      }
      : null,
    outputs: {
      transcriptPath: outputTargets.transcriptPath,
      captionsPath: outputTargets.captionsPath,
      videoMetadataPath: outputTargets.videoMetadataPath,
      videoPublicPath: outputTargets.videoPublicPath,
      previewVideoPublicPath: outputTargets.previewVideoPublicPath,
      motionMapPath: outputTargets.motionMapPath,
      motionPlanPath: outputTargets.motionPlanPath,
      ingestManifestPath: outputTargets.ingestManifestPath,
      missingAssetRegistryPath: MISSING_MOTION_ASSET_REGISTRY_PATH,
      nolanClipPlanPath: outputTargets.nolanClipPlanPath
    },
    showcaseCatalog: {
      source: showcaseCatalogResult.source,
      assetCount: showcaseCatalogResult.catalog.length,
      cachePath: DEFAULT_OUTPUT_JSON
    },
    pipelineSequence: [
      {
        step: "transcript",
        status: "completed",
        detail:
          transcriptCacheSource === "cache"
            ? `${transcriptionProvider} transcript cache hit reused.`
            : `${transcriptionProvider} transcription completed.`
      },
      {
        step: "presentation-mode",
        status: "completed",
        detail: `Resolved ${resolvedPresentationMode} from ${videoMetadata.width}x${videoMetadata.height}.`
      },
      {
        step: "typography-routing",
        status: "completed",
        detail: `Using ${captionStyleProfile.displayName} (${resolvedCaptionProfileId}).`
      },
      {
        step: "motion-mapping",
        status: "completed",
        detail:
          `Resolved ${motionModel.showcaseIntelligencePlan.selectedIntents.length} selected, ` +
          `${motionModel.showcaseIntelligencePlan.flaggedIntents.length} flagged, ` +
          `${motionModel.showcaseIntelligencePlan.suppressedIntents.length} suppressed motion moments. ` +
          (motionModel.showcaseIntelligencePlan.governorProfileId
            ? `Governor routed ${motionModel.showcaseIntelligencePlan.selectedAssetCueCount}/${motionModel.showcaseIntelligencePlan.selectedTemplateCueCount}/${motionModel.showcaseIntelligencePlan.selectedTypographyCueCount} ` +
              `asset-template-typography cues and queued ${motionModel.showcaseIntelligencePlan.missingAssetCategories.length} missing categories.`
            : "Legacy showcase routing remained active.")
      },
      ...(nolanClipPlan
        ? [{
          step: "nolan-clip-planning",
          status: "completed" as const,
          detail:
            `Ranked ${nolanClipPlan.summary.candidateCount} short-form candidates into ${nolanClipPlan.summary.pageCount} page(s)` +
            (nolanClipPlan.referenceScript.provided
              ? ` using ${nolanClipPlan.referenceScript.sectionCount} reference section(s).`
              : " using heuristic-only scoring because no reference script was available.")
        }]
        : []),
      {
        step: "preview-proxy",
        status: "completed",
        detail:
          cliArgs.skipPreviewProxy
            ? "Skipped browser preview proxy generation for the fast draft automation path."
            : previewProxy.cacheHit
            ? `Reused cached browser proxy at ${outputTargets.previewVideoPublicPath} ` +
              `(${PREVIEW_PROXY_WIDTH}x${PREVIEW_PROXY_HEIGHT} @ ${PREVIEW_PROXY_FPS}fps; ${previewProxy.encoderLabel}).`
            : `Prepared browser proxy at ${outputTargets.previewVideoPublicPath} ` +
              `(${PREVIEW_PROXY_WIDTH}x${PREVIEW_PROXY_HEIGHT} @ ${PREVIEW_PROXY_FPS}fps via ${previewProxy.encoderLabel}).`
      },
      {
        step: "sync-state",
        status: syncIssues.length === 0 ? "completed" : "warning",
        detail: syncIssues.length === 0
          ? `All long-form outputs were updated atomically for the active source via ${sourceVideoSyncMethod}.`
          : `Output sync warnings: ${syncIssues.join(" | ")}`
      }
    ],
    stageTimingsMs
  };
  await writeJsonAtomic(outputTargets.ingestManifestPath, ingestManifest);

  console.log(`Transcript words: ${transcriptWords.length}`);
  console.log(`Caption chunks: ${captionChunks.length}`);
  console.log(`Caption intelligence source: ${intelligenceSource}`);
  console.log(`Motion tier: ${motionModel.tier} (requested ${cliArgs.motionTier ?? "auto"})`);
  console.log(`Transcription provider: ${transcriptionProvider} (${transcriptCacheSource})`);
  if (nolanClipPlan) {
    console.log(
      `Nolan clips: candidates=${nolanClipPlan.summary.candidateCount} ` +
        `pages=${nolanClipPlan.summary.pageCount} ` +
        `recommended=${JSON.stringify(nolanClipPlan.summary.recommendedClipIds)}`
    );
    console.log(
      `Nolan reference script: ${nolanClipPlan.referenceScript.provided
        ? `${nolanClipPlan.referenceScript.sourcePath} (${nolanClipPlan.referenceScript.sectionCount} sections)`
        : "not provided"}`
    );
  }
  console.log(
    `Motion mapping: selected=${motionModel.showcaseIntelligencePlan.selectedIntents.length} ` +
      `flagged=${motionModel.showcaseIntelligencePlan.flaggedIntents.length} ` +
      `suppressed=${motionModel.showcaseIntelligencePlan.suppressedIntents.length}`
  );
  console.log(
    `Showcase catalog: ${showcaseCatalogResult.catalog.length} assets (${showcaseCatalogResult.source})`
  );
  console.log(
    `Policy stats: hardWords=${captionStyleProfile.groupingPolicy.hardMinWords}-${captionStyleProfile.groupingPolicy.hardMaxWords} ` +
      `softWords=${captionStyleProfile.groupingPolicy.softMinWords}-${captionStyleProfile.groupingPolicy.softMaxWords} ` +
      `observed[min/max]=${policyStats.minWordsObserved}/${policyStats.maxWordsObserved} ` +
      `softRangeRatio=${policyStats.softRangeRatio} hardViolations=${policyStats.hardRangeViolations} ` +
      `durMs[min/avg/max]=${policyStats.minDurationMs}/${policyStats.avgDurationMs}/${policyStats.maxDurationMs}`
  );
  console.log(
    `Variation stats: count=${variationStats.variationCount} ratio=${variationStats.variationRatio} ` +
      `intents=${JSON.stringify(variationStats.intents)}`
  );
  console.log(`Name split violations: ${policyStats.nameSplitViolations}`);
  console.log(`Word-count histogram: ${JSON.stringify(policyStats.wordCountHistogram)}`);
  console.log(`Stage timings (ms): ${JSON.stringify(stageTimingsMs)}`);
  if (transcriptionFallbacks.length > 0) {
    console.log(`Transcription fallbacks: ${JSON.stringify(transcriptionFallbacks)}`);
  }
  console.log(`Wrote: ${outputTargets.transcriptPath}`);
  console.log(`Wrote: ${outputTargets.captionsPath}`);
  console.log(`Wrote: ${outputTargets.videoMetadataPath}`);
  console.log(`Wrote: ${outputTargets.motionMapPath}`);
  console.log(`Wrote: ${outputTargets.motionPlanPath}`);
  if (nolanClipPlan && outputTargets.nolanClipPlanPath) {
    console.log(`Wrote: ${outputTargets.nolanClipPlanPath}`);
  }
  console.log(`Wrote: ${outputTargets.ingestManifestPath}`);
  console.log(`Synchronized source video to: ${outputTargets.videoPublicPath} (${sourceVideoSyncMethod})`);
  if (cliArgs.skipPreviewProxy) {
    console.log("Skipped preview proxy generation for the fast draft automation path.");
  } else {
    console.log(
      `Wrote preview proxy to: ${outputTargets.previewVideoPublicPath} ` +
        `(${PREVIEW_PROXY_WIDTH}x${PREVIEW_PROXY_HEIGHT} @ ${PREVIEW_PROXY_FPS}fps via ${previewProxy.encoderLabel}${
          previewProxy.cacheHit ? ", cache hit" : ""
        })`
    );
  }
};

syncCaptions().catch((error) => {
  console.error(error);
  process.exit(1);
});
