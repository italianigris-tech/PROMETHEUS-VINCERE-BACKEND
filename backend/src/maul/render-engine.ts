import {execFile} from "node:child_process";
import {createHash} from "node:crypto";
import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {
  maulUnifiedShortRenderManifestSchema,
  type MaulMartinDepthPlan,
  type MaulUnifiedShortRenderManifest,
} from "@prometheus/shared-types";

import {probeMediaDurationSeconds, renderMasterTrack, runFfmpegCommand} from "../sound-engine/index.js";
import {resolveRepositoryMediaTool} from "./repository-media-tools.js";
import {validateMaulRenderFontReceipts} from "./render-font-preflight.js";

export type MaulRenderCaption = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
};

export type MaulShortRenderEngineInput = {
  workRoot: string;
  manifest: MaulUnifiedShortRenderManifest;
  renderMode: "preview" | "final";
  previewFrameTimesMs?: number[];
  observationMode?: MaulShortObservationMode;
  renderConcurrency?: number;
  frameRange?: {startFrame: number; endFrame: number};
};

export type MaulShortObservationMode =
  | "creative"
  | "typography_suppressed"
  | "source_treatment_suppressed";

export type MaulRenderedFrameSample = {
  outputMs: number;
  bytes: Buffer;
  sha256: string;
  contentType: "image/png";
};

export type MaulShortRenderEngineResult = {
  bytes: Buffer;
  sha256: string;
  durationMs: number;
  width: number;
  height: number;
  evidence: {
    compositionId: "MaulShort";
    renderer: "remotion";
    sourceMappingPreserved: boolean;
    audioMixed: boolean;
    observationMode: MaulShortObservationMode;
  };
  frameSamples: MaulRenderedFrameSample[];
};

export type MaulShortRenderEngine = (
  input: MaulShortRenderEngineInput
) => Promise<MaulShortRenderEngineResult>;

const executableName = process.platform === "win32" ? "remotion.cmd" : "remotion";

export const shouldRetainMaulFrameSamples = ({
  renderMode: _renderMode,
  sampleTimesMs,
}: {
  renderMode: "preview" | "final";
  sampleTimesMs: number[];
}): boolean => sampleTimesMs.length > 0;

export const resolveMaulRenderConcurrency = (
  renderConcurrency: number | undefined,
): string[] => {
  if (renderConcurrency === undefined) return [];
  if (!Number.isInteger(renderConcurrency) || renderConcurrency < 1) {
    throw new Error("MAUL render concurrency must be a positive integer when specified.");
  }
  return [`--concurrency=${renderConcurrency}`];
};

export const resolveMaulRenderFrameRange = (
  frameRange: {startFrame: number; endFrame: number} | undefined,
): string[] => {
  if (frameRange === undefined) return [];
  if (
    !Number.isInteger(frameRange.startFrame) ||
    !Number.isInteger(frameRange.endFrame) ||
    frameRange.startFrame < 0 ||
    frameRange.endFrame < frameRange.startFrame
  ) {
    throw new Error("MAUL render frame range must contain nonnegative ordered integer bounds.");
  }
  return [`--frames=${frameRange.startFrame}-${frameRange.endFrame}`];
};

export const resolveMaulMartinStageAssets = (
  manifest: {martinDepth?: MaulMartinDepthPlan},
): Array<{windowId: string; storagePath: string; sha256: string}> =>
  manifest.martinDepth?.windows.map((window) => ({
    windowId: window.windowId,
    storagePath: window.foregroundAsset.storagePath,
    sha256: window.foregroundAsset.sha256,
  })) ?? [];

export const shouldUseMaulSoundEngine = (manifest: {
  audio: {musicTrack: unknown; sfxAssets: readonly unknown[]};
  layerPolicy?: {audioTreatment?: string};
}): boolean =>
  manifest.layerPolicy?.audioTreatment !== "disabled" &&
  Boolean(manifest.audio.musicTrack || manifest.audio.sfxAssets.length > 0);

export const assertMaulSfxAudibility = ({
  dialogueMaxDb,
  sfxMaxDb,
}: {
  dialogueMaxDb: number;
  sfxMaxDb: number;
}): void => {
  if (sfxMaxDb < -12 || sfxMaxDb < dialogueMaxDb - 10) {
    throw new Error(
      `MAUL SFX audibility gate failed: SFX is inaudible at ${sfxMaxDb.toFixed(1)} dBFS ` +
      `(dialogue ${dialogueMaxDb.toFixed(1)} dBFS).`,
    );
  }
};

const probeAudioMaxVolumeDb = async (filePath: string): Promise<number> => {
  const result = await runFfmpegCommand([
    "-nostdin", "-hide_banner", "-i", filePath,
    "-af", "volumedetect", "-f", "null", "-",
  ]);
  const match = result.stderr.match(/max_volume:\s*(-?[\d.]+)\s*dB/i);
  if (!match) throw new Error(`MAUL could not measure audio peak for ${filePath}.`);
  return Number(match[1]);
};

export const buildMaulSoundDesignManifest = async ({
  manifest,
  dialogueSource,
  probeDuration = probeMediaDurationSeconds,
}: {
  manifest: MaulUnifiedShortRenderManifest;
  dialogueSource: string;
  probeDuration?: (filePath: string) => Promise<number | null>;
}) => {
  const duration = manifest.timeline.outputDurationMs / 1000;
  const dialogue = manifest.captions.length > 0
    ? manifest.captions.map((caption, index) => ({
        start: caption.startMs / 1000,
        end: Math.min(duration, caption.endMs / 1000),
        gainDb: 0,
        label: `caption:${index}`,
      })).filter((span) => span.end > span.start)
    : [{start: 0, end: duration, gainDb: 0, label: "source-dialogue"}];
  const music = manifest.audio.musicTrack;
  const musicCues = music
    ? [{
        id: music.id,
        file: music.storagePath,
        start: 0,
        end: duration,
        sourceStart: 0,
        sourceEnd: Math.min(duration, music.durationSec),
        gainDb: -4,
        transitionIn: {preset: "dialogue_safe_bed" as const, start: 0, duration: 0.7, settings: {}},
        transitionOut: {preset: "filter_sink" as const, start: Math.max(0, duration - 0.8), duration: 0.8, settings: {}},
        tags: ["maul", "dialogue-safe", "render-authoritative"],
      }]
    : [];
  const sfx = [];
  for (const asset of manifest.audio.sfxAssets) {
    const source = await probeDuration(asset.storagePath);
    if (!source || source <= 0) {
      throw new Error(`MAUL SFX ${asset.id} has no measurable duration.`);
    }
    const start = asset.outputMs / 1000;
    const end = Math.min(duration, start + source);
    if (end <= start) continue;
    sfx.push({
      id: asset.id,
      file: asset.storagePath,
      start,
      end,
      role: "sfx" as const,
      gainDb: 4,
      sourceStart: 0,
      sourceEnd: end - start,
      tags: ["maul", "typography", asset.eventType, "audibility-gated"],
    });
  }
  return {
    duration,
    dialogueSource,
    dialogue,
    musicCues,
    sfx,
    master: {targetI: -16, truePeak: -1.5, lra: 8, sampleRate: 48_000, previewSampleRate: 22_050},
    presetOverrides: {},
  };
};

const runRemotion = async ({
  executable,
  args,
  cwd
}: {
  executable: string;
  args: string[];
  cwd: string;
}): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    execFile(
      executable,
      args,
      {cwd, windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 8 * 1024 * 1024},
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`MAUL Remotion render failed: ${stderr.trim() || error.message}`));
          return;
        }
        resolve();
      }
    );
  });
};

const extractRenderedFrame = async ({
  ffmpegPath,
  outputPath,
  framePath,
  outputMs,
}: {
  ffmpegPath: string;
  outputPath: string;
  framePath: string;
  outputMs: number;
}): Promise<Buffer> => {
  await new Promise<void>((resolve, reject) => {
    execFile(
      ffmpegPath,
      [
        "-ss",
        (outputMs / 1000).toFixed(3),
        "-i",
        outputPath,
        "-frames:v",
        "1",
        "-y",
        framePath,
      ],
      {windowsHide: true, timeout: 60_000, maxBuffer: 8 * 1024 * 1024},
      (error, _stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `MAUL rendered frame extraction failed: ${stderr.trim() || error.message}`,
            ),
          );
          return;
        }
        resolve();
      },
    );
  });
  const bytes = await readFile(framePath);
  if (bytes.length === 0) {
    throw new Error("MAUL rendered frame extraction produced an empty PNG.");
  }
  return bytes;
};

export const renderMaulShortLocally: MaulShortRenderEngine = async (input) => {
  const observationMode = input.observationMode ?? "creative";
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const remotionRoot = path.join(repoRoot, "remotion-app");
  validateMaulRenderFontReceipts(input.manifest, {
    remotionPublicDir: path.join(remotionRoot, "public"),
  });
  const publicStageRoot = path.join(remotionRoot, "public", ".maul-renders");
  await mkdir(publicStageRoot, {recursive: true});
  // Resolve to absolute paths up front: the caller may hand us a relative
  // workRoot, but the Remotion CLI runs with remotion-app as its cwd and
  // would resolve relative props/output paths against the wrong directory.
  const workRoot = path.resolve(input.workRoot);
  await mkdir(workRoot, {recursive: true});
  const publicStageDir = await mkdtemp(path.join(publicStageRoot, "render-"));
  const workDir = await mkdtemp(path.join(workRoot, "render-"));
  const stageName = path.basename(publicStageDir);
  const sourceExtension = path.extname(input.manifest.source.storagePath) || ".mp4";
  const stagedSource = path.join(publicStageDir, `source${sourceExtension}`);
  const musicTrack = input.manifest.audio.musicTrack;
  const stagedMusic = musicTrack ? path.join(publicStageDir, `music${path.extname(musicTrack.storagePath) || ".wav"}`) : null;
  const outputPath = path.join(workDir, "maul-short.mp4");
  const propsPath = path.join(workDir, "props.json");

  try {
    await copyFile(input.manifest.source.storagePath, stagedSource);
    if (musicTrack && stagedMusic) { await copyFile(musicTrack.storagePath, stagedMusic); }
    const visualTrack = input.manifest.plans.visual.visualTrack;
    const stagedVisualAssets = visualTrack
      ? await Promise.all(visualTrack.assets.map(async (asset, index) => {
          const bytes = await readFile(asset.storagePath);
          const actualSha256 = createHash("sha256").update(bytes).digest("hex");
          if (actualSha256 !== asset.sha256.toLowerCase()) {
            throw new Error(`Visual asset ${asset.assetId} failed render-time SHA-256 verification.`);
          }
          const filename = `visual-${index}${path.extname(asset.storagePath) || (asset.mediaKind === "image" ? ".png" : ".mp4")}`;
          await copyFile(asset.storagePath, path.join(publicStageDir, filename));
          return {
            ...asset,
            storagePath: `.maul-renders/${stageName}/${filename}`,
          };
        }))
      : null;
    const stagedSfx = await Promise.all(input.manifest.audio.sfxAssets.map(async (asset, index) => {
      const filename = `sfx-${index}${path.extname(asset.storagePath) || ".wav"}`;
      await copyFile(asset.storagePath, path.join(publicStageDir, filename));
      return {
        ...asset,
        storagePath: `.maul-renders/${stageName}/${filename}`
      };
    }));
    const martinDepth = input.manifest.schemaVersion === "maul-unified-short-render-manifest/v3"
      ? input.manifest.martinDepth
      : undefined;
    const stagedMartinAssets = await Promise.all(
      resolveMaulMartinStageAssets({martinDepth}).map(async (asset, index) => {
        const bytes = await readFile(asset.storagePath);
        const actualSha256 = createHash("sha256").update(bytes).digest("hex");
        if (actualSha256 !== asset.sha256.toLowerCase()) {
          throw new Error(`Martin foreground ${asset.windowId} failed render-time SHA-256 verification.`);
        }
        const filename = `martin-${index}${path.extname(asset.storagePath) || ".webm"}`;
        await copyFile(asset.storagePath, path.join(publicStageDir, filename));
        return {windowId: asset.windowId, storagePath: `.maul-renders/${stageName}/${filename}`};
      }),
    );
    const stagedMartinPathByWindowId = new Map(
      stagedMartinAssets.map((asset) => [asset.windowId, asset.storagePath]),
    );
    const runtimeManifest: MaulUnifiedShortRenderManifest = maulUnifiedShortRenderManifestSchema.parse({
      ...input.manifest,
      source: {
        ...input.manifest.source,
        storagePath: `.maul-renders/${stageName}/${path.basename(stagedSource)}`
      },
      audio: {
        ...input.manifest.audio,
        musicTrack: input.manifest.audio.musicTrack && stagedMusic
          ? {
              ...input.manifest.audio.musicTrack,
              ...(shouldUseMaulSoundEngine(input.manifest) && !input.frameRange
                ? {renderSafe: false}
                : {}),
              storagePath: `.maul-renders/${stageName}/${path.basename(stagedMusic)}`,
            }
          : null,
        sfxAssets: shouldUseMaulSoundEngine(input.manifest) && !input.frameRange
          ? []
          : stagedSfx
      },
      ...(martinDepth
        ? {
            martinDepth: {
              ...martinDepth,
              windows: martinDepth.windows.map((window) => ({
                ...window,
                foregroundAsset: {
                  ...window.foregroundAsset,
                  storagePath: stagedMartinPathByWindowId.get(window.windowId),
                },
              })),
            },
          }
        : {}),
      plans: stagedVisualAssets
        ? {
            ...input.manifest.plans,
            visual: {
              ...input.manifest.plans.visual,
              visualTrack: {
                ...visualTrack!,
                assets: stagedVisualAssets,
              },
            },
          }
        : input.manifest.plans,
    });
    await writeFile(
      propsPath,
      JSON.stringify({manifest: runtimeManifest, observationMode}),
      "utf8"
    );

    // Node ≥18.20 refuses to execFile .cmd shims without a shell (spawn EINVAL)
    // on win32, so there we invoke the Remotion CLI entry directly with node.
    const executable = process.platform === "win32"
      ? process.execPath
      : path.join(remotionRoot, "node_modules", ".bin", executableName);
    await runRemotion({
      executable,
      cwd: remotionRoot,
      args: [
        ...(process.platform === "win32"
          ? [path.join(remotionRoot, "node_modules", "@remotion", "cli", "remotion-cli.js")]
          : []),
        "render",
        "src/index.ts",
        "MaulShort",
        outputPath,
        `--props=${propsPath}`,
        "--codec=h264",
        "--audio-codec=aac",
        "--overwrite",
        ...resolveMaulRenderConcurrency(input.renderConcurrency),
        ...resolveMaulRenderFrameRange(input.frameRange),
        ...(input.renderMode === "preview" ? ["--scale=0.5"] : []),
      ]
    });
    let renderedOutputPath = outputPath;
    if (shouldUseMaulSoundEngine(input.manifest) && !input.frameRange) {
      const soundManifest = await buildMaulSoundDesignManifest({
        manifest: input.manifest,
        dialogueSource: outputPath,
      });
      const audioDir = path.join(workDir, "sound-engine");
      await mkdir(audioDir, {recursive: true});
      const audioResult = await renderMasterTrack(
        soundManifest,
        path.join(audioDir, "master.wav"),
        {
          baseDir: repoRoot,
          aacPath: path.join(audioDir, "master.m4a"),
          debugPlanPath: path.join(audioDir, "render-plan.json"),
          stemsDir: path.join(audioDir, "stems"),
        },
      );
      if (!audioResult.aacPath) {
        throw new Error("MAUL sound-engine render did not produce an AAC master.");
      }
      if (soundManifest.sfx.length > 0) {
        if (!audioResult.stemPaths.sfx || !audioResult.stemPaths.dialogue) {
          throw new Error("MAUL sound-engine did not produce required audibility stems.");
        }
        const [sfxMaxDb, dialogueMaxDb] = await Promise.all([
          probeAudioMaxVolumeDb(audioResult.stemPaths.sfx),
          probeAudioMaxVolumeDb(audioResult.stemPaths.dialogue),
        ]);
        assertMaulSfxAudibility({dialogueMaxDb, sfxMaxDb});
      }
      const mixedOutputPath = path.join(workDir, "maul-short-audio-mixed.mp4");
      await runFfmpegCommand([
        "-y", "-nostdin", "-hide_banner", "-loglevel", "error",
        "-i", outputPath,
        "-i", audioResult.aacPath,
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "copy", "-shortest",
        "-movflags", "+faststart",
        mixedOutputPath,
      ]);
      renderedOutputPath = mixedOutputPath;
    }
    const bytes = await readFile(renderedOutputPath);
    if (bytes.length === 0) {
      throw new Error("MAUL Remotion render produced an empty MP4.");
    }
    const frameSamples = shouldRetainMaulFrameSamples({
      renderMode: input.renderMode,
      sampleTimesMs: input.previewFrameTimesMs ?? [],
    })
      ? await (async () => {
          const ffmpeg = await resolveRepositoryMediaTool({tool: "ffmpeg", repoRoot});
          if (ffmpeg.status !== "available") {
            throw new Error(`MAUL preview frame extraction is unavailable: ${ffmpeg.reason}`);
          }
          return Promise.all((input.previewFrameTimesMs ?? []).map(async (outputMs, index) => {
          const bytes = await extractRenderedFrame({
            ffmpegPath: ffmpeg.executablePath,
            outputPath: renderedOutputPath,
            framePath: path.join(workDir, `preview-frame-${index}.png`),
            outputMs,
          });
          return {
            outputMs,
            bytes,
            sha256: createHash("sha256").update(bytes).digest("hex"),
            contentType: "image/png" as const,
          };
          }));
        })()
      : [];
    if (input.renderMode === "preview" && frameSamples.length === 0) {
      throw new Error("MAUL perceptual preview requires one or more extracted frame samples.");
    }
    return {
      bytes,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      durationMs: input.frameRange
        ? Math.round((input.frameRange.endFrame - input.frameRange.startFrame + 1) /
          input.manifest.output.fps * 1000)
        : input.manifest.timeline.outputDurationMs,
      width: input.renderMode === "preview" ? 540 : input.manifest.output.width,
      height: input.renderMode === "preview" ? 960 : input.manifest.output.height,
      evidence: {
        compositionId: "MaulShort",
        renderer: "remotion",
        sourceMappingPreserved: true,
        audioMixed: true,
        observationMode,
      },
      frameSamples,
    };
  } finally {
    await rm(publicStageDir, {recursive: true, force: true});
    await rm(workDir, {recursive: true, force: true});
  }
};
