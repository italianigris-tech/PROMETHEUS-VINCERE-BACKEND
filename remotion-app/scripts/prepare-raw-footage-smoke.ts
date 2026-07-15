import {execFileSync} from "node:child_process";
import {existsSync, mkdirSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {buildCreativePreviewCaptionChunks} from "../src/creative-orchestration/preview";
import {deterministicChunkWords, mapWordChunksToCaptionChunks} from "../src/lib/caption-chunker";
import type {
  CaptionStyleProfileId,
  MotionTier,
  PreviewPerformanceMode,
  TranscribedWord
} from "../src/lib/types";

type CliOptions = {
  source?: string;
  startSec: number;
  durationSec: number;
  outName: string;
  transcriptText: string;
  captionProfileId: CaptionStyleProfileId;
  motionTier: MotionTier;
  previewPerformanceMode: Exclude<PreviewPerformanceMode, "turbo">;
  editContract: boolean;
};

type ProbeVideo = {
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  durationInFrames: number;
};

const DEFAULT_TRANSCRIPT_TEXT =
  "This raw footage smoke test proves the planner, camera system, typography policy, and motion graphics renderer are connected.";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(appRoot, "..");
const devFixturesDir = path.join(appRoot, "public", "dev-fixtures");
const artifactDir = path.join(repoRoot, "artifacts", "visual-smoke");

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a finite number, received "${value}".`);
  }
  return parsed;
};

const readCliOptions = (): CliOptions => {
  const args = process.argv.slice(2);
  const values = new Map<string, string>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument "${arg}". Use --source <path>.`);
    }
    const key = arg.slice(2);
    const next = args[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`Missing value for --${key}.`);
    }
    values.set(key, next);
    index += 1;
  }

  const previewPerformanceMode = values.get("preview-performance-mode") ?? "full";
  if (previewPerformanceMode === "turbo") {
    throw new Error("Raw-footage policy smoke cannot use turbo; it disables/leans out the visual stack under test.");
  }
  if (previewPerformanceMode !== "full" && previewPerformanceMode !== "balanced") {
    throw new Error("--preview-performance-mode must be full or balanced.");
  }

  const motionTier = values.get("motion-tier") ?? "premium";
  if (!["minimal", "editorial", "premium", "hero"].includes(motionTier)) {
    throw new Error("--motion-tier must be one of minimal, editorial, premium, hero.");
  }

  return {
    source: values.get("source"),
    startSec: Math.max(0, parseNumber(values.get("start-sec"), 0)),
    durationSec: Math.max(4, Math.min(20, parseNumber(values.get("duration-sec"), 10))),
    outName: values.get("out-name") ?? "raw-footage-smoke.mp4",
    transcriptText: values.get("transcript-text") ?? DEFAULT_TRANSCRIPT_TEXT,
    captionProfileId: (values.get("caption-profile-id") ?? "longform_eve_typography_v1") as CaptionStyleProfileId,
    motionTier: motionTier as MotionTier,
    previewPerformanceMode: previewPerformanceMode as Exclude<PreviewPerformanceMode, "turbo">,
    editContract: values.get("edit-contract") !== "false"
  };
};

const assertRawSource = (sourcePath: string): void => {
  if (!existsSync(sourcePath)) {
    throw new Error(`Raw source does not exist: ${sourcePath}`);
  }

  const normalized = sourcePath.toLowerCase().replace(/\\/g, "/");
  if (normalized.includes("/joseph video proof/")) {
    throw new Error(
      "Refusing to use JOSEPH VIDEO PROOF as raw footage. Provide an unedited source clip with --source."
    );
  }

  if (!/\.(mp4|mov|m4v|webm)$/i.test(sourcePath)) {
    throw new Error("Raw source must be a video file with .mp4, .mov, .m4v, or .webm extension.");
  }
};

const parseFps = (frameRate: string | undefined): number => {
  if (!frameRate) {
    return 30;
  }
  const [numerator, denominator] = frameRate.split("/").map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 30;
  }
  return numerator / denominator;
};

const probeVideo = (videoPath: string): ProbeVideo => {
  const output = execFileSync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,r_frame_rate,duration:format=duration",
    "-of",
    "json",
    videoPath
  ], {encoding: "utf8"});
  const parsed = JSON.parse(output) as {
    streams?: Array<{width?: number; height?: number; r_frame_rate?: string; duration?: string}>;
    format?: {duration?: string};
  };
  const stream = parsed.streams?.[0];
  if (!stream?.width || !stream.height) {
    throw new Error(`ffprobe could not read a video stream from ${videoPath}.`);
  }

  const fps = parseFps(stream.r_frame_rate);
  const durationSeconds = Number(stream.duration ?? parsed.format?.duration ?? 0);
  const safeDurationSeconds = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 10;

  return {
    width: stream.width,
    height: stream.height,
    fps,
    durationSeconds: safeDurationSeconds,
    durationInFrames: Math.max(1, Math.round(safeDurationSeconds * fps))
  };
};

const trimRawFootage = ({
  sourcePath,
  outputPath,
  startSec,
  durationSec,
  sourceProbe
}: {
  sourcePath: string;
  outputPath: string;
  startSec: number;
  durationSec: number;
  sourceProbe: ProbeVideo;
}): void => {
  if (sourceProbe.width < sourceProbe.height) {
    throw new Error(`Raw visual smoke expects landscape footage, received ${sourceProbe.width}x${sourceProbe.height}.`);
  }

  const targetWidth = Math.max(2, Math.min(1280, sourceProbe.width));
  const evenTargetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;

  execFileSync("ffmpeg", [
    "-y",
    "-ss",
    String(startSec),
    "-i",
    sourcePath,
    "-t",
    String(durationSec),
    "-vf",
    `scale=${evenTargetWidth}:-2`,
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    outputPath
  ], {stdio: "inherit"});
};

const buildSmokeWords = (text: string, durationSeconds: number): TranscribedWord[] => {
  const tokens = text.split(/\s+/).map((token) => token.trim()).filter(Boolean).slice(0, 80);
  if (tokens.length === 0) {
    return buildSmokeWords(DEFAULT_TRANSCRIPT_TEXT, durationSeconds);
  }

  const startMs = 420;
  const endMs = Math.max(startMs + 1000, Math.round(durationSeconds * 1000) - 420);
  const stepMs = Math.max(120, Math.floor((endMs - startMs) / tokens.length));

  return tokens.map((token, index) => {
    const wordStartMs = startMs + index * stepMs;
    const wordEndMs = index === tokens.length - 1 ? endMs : Math.min(endMs, wordStartMs + stepMs);
    return {
      text: token,
      startMs: wordStartMs,
      endMs: Math.max(wordStartMs + 80, wordEndMs),
      confidence: 0.99
    };
  });
};

const buildCaptionChunks = ({
  words,
  captionProfileId
}: {
  words: TranscribedWord[];
  captionProfileId: CaptionStyleProfileId;
}) => {
  const deterministicChunks = deterministicChunkWords(words, {
    profileId: captionProfileId
  });
  const mappedChunks = mapWordChunksToCaptionChunks(deterministicChunks, undefined, {
    profileId: captionProfileId
  });
  return buildCreativePreviewCaptionChunks(mappedChunks, {
    profileId: captionProfileId,
    presentationMode: "long-form"
  });
};

const main = (): void => {
  const options = readCliOptions();
  if (!options.source) {
    throw new Error("Missing --source <raw-footage-path>.");
  }

  const sourcePath = path.resolve(options.source);
  assertRawSource(sourcePath);

  mkdirSync(devFixturesDir, {recursive: true});
  mkdirSync(artifactDir, {recursive: true});

  const sourceProbe = probeVideo(sourcePath);
  const outputPath = path.join(devFixturesDir, options.outName);
  trimRawFootage({
    sourcePath,
    outputPath,
    startSec: options.startSec,
    durationSec: options.durationSec,
    sourceProbe
  });

  const outputProbe = probeVideo(outputPath);
  const words = buildSmokeWords(options.transcriptText, outputProbe.durationSeconds);
  const captionChunks = buildCaptionChunks({
    words,
    captionProfileId: options.captionProfileId
  });
  const publicVideoSrc = `/dev-fixtures/${options.outName}`;
  const props = {
    videoSrc: publicVideoSrc,
    studioSampleId: null,
    studioTypographySample: false,
    videoMetadata: outputProbe,
    livePreviewSession: {
      sessionId: "raw-footage-visual-smoke",
      status: "ready",
      previewStatus: "ready",
      transcriptStatus: "synthetic-smoke",
      analysisStatus: "ready",
      motionGraphicsStatus: "motion_graphics_ready",
      renderStatus: "not_started",
      sourceLabel: "raw-footage-smoke",
      sourceFilename: path.basename(sourcePath),
      sourceHasVideo: true,
      sourceWidth: outputProbe.width,
      sourceHeight: outputProbe.height,
      sourceFps: outputProbe.fps,
      sourceDurationMs: Math.round(outputProbe.durationSeconds * 1000),
      previewLines: [options.transcriptText],
      previewMotionSequence: captionChunks.map((chunk, index) => ({
        cueId: `raw-smoke-cue-${index + 1}`,
        text: chunk.text,
        startMs: chunk.startMs,
        durationMs: Math.max(240, chunk.endMs - chunk.startMs),
        lineIndex: index
      })),
      transcriptWords: words.map((word) => ({
        text: word.text,
        start_ms: word.startMs,
        end_ms: word.endMs,
        confidence: word.confidence
      }))
    },
    presentationMode: "long-form",
    captionProfileId: options.captionProfileId,
    motionTier: options.motionTier,
    gradeProfileId: "warm-cinematic",
    transitionPresetId: "auto",
    transitionOverlayMode: "standard",
    motion3DMode: "editorial",
    matteMode: "off",
    captionBias: "auto",
    hideCaptionOverlays: false,
    pipMode: "off",
    stabilizePreviewTimeline: true,
    previewTimelineResetVersion: 1,
    previewPerformanceMode: options.previewPerformanceMode,
    respectPreviewPerformanceModeDuringRender: true,
    motionModelOverride: null,
    debugMotionArtifacts: options.editContract,
    usePreviewProxyForVideoSrc: false,
    captionChunksOverride: captionChunks
  };

  const propsPath = path.join(devFixturesDir, "raw-footage-smoke.project-scoped-props.json");
  const reportPath = path.join(artifactDir, "raw-footage-smoke.json");
  writeFileSync(propsPath, `${JSON.stringify(props, null, 2)}\n`, "utf8");
  writeFileSync(reportPath, `${JSON.stringify({
    sourcePath,
    outputPath,
    propsPath,
    publicVideoSrc,
    sourceProbe,
    outputProbe,
    captionChunkCount: captionChunks.length,
    captionProfileId: options.captionProfileId,
    motionTier: options.motionTier,
    previewPerformanceMode: options.previewPerformanceMode,
    editContract: options.editContract
  }, null, 2)}\n`, "utf8");

  console.info(JSON.stringify({
    ok: true,
    outputPath,
    propsPath,
    reportPath,
    publicVideoSrc,
    outputProbe,
    captionChunkCount: captionChunks.length,
    editContract: options.editContract
  }, null, 2));
};

main();
