import {UnifiedRenderManifest, UnifiedRenderManifestSchema} from '@prometheus/shared-types';
import {bundle} from '@remotion/bundler';
import {renderFrames, selectComposition} from '@remotion/renderer';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {fileURLToPath} from 'url';
import {spawn} from 'child_process';
import {mixAudio} from '@prometheus/backend';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JOSEPH_WIDTH = 1080;
const JOSEPH_HEIGHT = 1920;
const JOSEPH_ENTRY_POINT = path.resolve(__dirname, '../../../remotion-app/src/entries/joseph-entry.tsx');
export const LANDSCAPE_WIDTH = 1920;
export const LANDSCAPE_HEIGHT = 1080;
export const LANDSCAPE_ENTRY_POINT = path.resolve(__dirname, '../../../remotion-app/src/entries/landscape-entry.tsx');
const DEFAULT_SFX_DIR = path.resolve(__dirname, '../../../remotion-app/public/sfx');
const DURABLE_BUNDLE_DIR = path.resolve(
  process.env.REMOTION_BUNDLE_DIR ?? path.join(__dirname, '../.cache/joseph-remotion-bundle'),
);
const RENDER_TIMEOUT_MS = 600000;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RenderError extends Error {
  readonly failureTags: string[];

  constructor(message: string, failureTags: string[] = ['render_failed']) {
    super(message);
    this.name = 'RenderError';
    this.failureTags = failureTags;
  }
}

export class MuxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MuxError';
  }
}

export class NvencError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NvencError';
  }
}

const resolveBrowserExecutable = (): string | undefined => {
  const candidates = [
    process.env.REMOTION_CHROMIUM_EXECUTABLE,
    process.env.CHROME_EXECUTABLE,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
};

const removeIfPresent = (targetPath: string) => {
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
};

const removeDirectoryIfPresent = (targetPath: string) => {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, {recursive: true, force: true});
  }
};

export type RenderFromManifestOptions = {
  tempDir?: string;
  sfxDir?: string;
  sourceVideoPath?: string;
  renderConcurrency?: number;
  /**
   * Remotion composition id inside the bundled entry. Defaults to 'JosephEdit'
   * (portrait). Set to 'JosephLandscapeEdit' for the 16:9 landscape bake.
   */
  compositionId?: string;
  /**
   * Remotion entry point to bundle. Defaults to joseph-entry.tsx (portrait).
   * Pass landscape-entry.tsx to bundle the combined root (both compositions).
   */
  entryPoint?: string;
};

export const resolveRenderConcurrency = ({
  availableCpu,
  durationFrames,
  configuredConcurrency,
}: {
  availableCpu: number;
  durationFrames: number;
  configuredConcurrency?: number;
}): number => {
  const cpuBudget = configuredConcurrency ?? Math.max(1, Math.floor(availableCpu) - 1);
  const usefulParallelism = Math.max(1, Math.ceil(durationFrames / 90));
  return Math.max(1, Math.min(8, cpuBudget, usefulParallelism));
};

const shouldRetryRender = (error: Error) => {
  if (/root component to unsuspend|delayRender\(\)/i.test(error.message)) {
    return false;
  }
  // WebGL/GL context failures are the classic headless-container miss: the
  // primary `gl: 'angle'` attempt cannot create a GPU context, so fall back to
  // software GL (swangle). Include those here so the retry path is exercised.
  return /timeout|timed out|chromium|browser|webgl|gl context|canvas|gpu/i.test(error.message);
};

const audioFailureTagsForError = (error: unknown): string[] => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (/missing_sfx_asset|SFXNotFoundError|SFX file not found/i.test(message)) {
    return ['missing_sfx_asset'];
  }
  return ['audio_mix_failed'];
};

export const renderFailureTagsForError = (error: unknown): string[] => {
  if (error instanceof RenderError && error.failureTags.length > 0) {
    return error.failureTags;
  }
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (/NvencError|h264_nvenc|NVIDIA GPU/i.test(message)) {
    return ['hardware_encoder_failed'];
  }
  if (/missing_sfx_asset|SFXNotFoundError|SFX file not found/i.test(message)) {
    return ['missing_sfx_asset'];
  }
  if (/audio|mixAudio|ffmpeg/i.test(message)) {
    return ['audio_mix_failed'];
  }
  return ['render_failed'];
};

const logRenderProgress = (progress: number) => {
  const rounded = Math.round(progress * 100);
  if (rounded % 10 === 0) {
    console.log(`[Worker] Render progress: ${rounded}%`);
  }
};

const bundleCache = new Map<string, Promise<string>>();

/**
 * Bundles (or reuses a baked bundle for) the given entry point. Cached per
 * entry point so the combined landscape entry and the portrait entry don't
 * stomp each other's durable dirs.
 */
const getServeUrl = (entryPoint: string = JOSEPH_ENTRY_POINT): Promise<string> => {
  const cached = bundleCache.get(entryPoint);
  if (cached) {
    return cached;
  }

  const entryName = path.basename(entryPoint, path.extname(entryPoint));
  const durableDir =
    entryName === 'joseph-entry'
      ? DURABLE_BUNDLE_DIR
      : path.resolve(process.env.REMOTION_BUNDLE_DIR ?? path.join(__dirname, '../.cache', `${entryName}-bundle`));
  const bakedBundle = path.join(durableDir, 'index.html');
  let promise: Promise<string>;

  if (process.env.NODE_ENV === 'production' && fs.existsSync(bakedBundle)) {
    console.log(`[Worker] Reusing baked renderer bundle ${durableDir} (entry ${entryName})`);
    promise = Promise.resolve(durableDir);
  } else {
    console.log(`[Worker] Bundling renderer (entry ${entryName}) to durable path ${durableDir}`);
    promise = bundle({
      entryPoint,
      outDir: durableDir,
    }).catch((error) => {
      bundleCache.delete(entryPoint);
      throw error;
    });
  }

  bundleCache.set(entryPoint, promise);
  return promise;
};

const assertManifestDimensions = (
  manifest: UnifiedRenderManifest,
  expectedWidth: number,
  expectedHeight: number,
  label: string,
): void => {
  if (
    manifest.width !== expectedWidth ||
    manifest.height !== expectedHeight ||
    manifest.output.width !== expectedWidth ||
    manifest.output.height !== expectedHeight
  ) {
    throw new ValidationError(
      `${label} render manifest must be ${expectedWidth}x${expectedHeight}; got manifest ${manifest.width}x${manifest.height} and output ${manifest.output.width}x${manifest.output.height}.`,
    );
  }
};

const assertCompositionMatchesManifest = (
  composition: {width: number; height: number},
  manifest: UnifiedRenderManifest,
): void => {
  if (composition.width !== manifest.width || composition.height !== manifest.height) {
    throw new ValidationError(
      `Joseph composition metadata must match manifest dimensions ${manifest.width}x${manifest.height}; got ${composition.width}x${composition.height}.`
    );
  }
};

const renderSilentFrames = async (options: Record<string, unknown>, manifest: UnifiedRenderManifest) => {
  let lastProgress = 0;
  const progressCallback = (framesRendered: number) => {
    lastProgress = framesRendered / manifest.durationFrames;
    logRenderProgress(lastProgress);
  };

  try {
    return await renderFrames({
      ...options,
      onStart: () => undefined,
      onFrameUpdate: progressCallback,
    } as any);
  } catch (error: any) {
    if (error?.message?.includes('timeout')) {
      logRenderProgress(0.1);
    }
    if (!shouldRetryRender(error)) {
      throw new RenderError(`Remotion renderFrames failed for job ${manifest.jobId} at ${(lastProgress * 100).toFixed(0)}%: ${error.message}`);
    }

    console.warn(
      `[Worker] Primary render failed for job ${manifest.jobId}; retrying with software GL using the same durable bundle ${String(options.serveUrl)}.`,
    );
    return renderFrames({
      ...options,
      onStart: () => undefined,
      onFrameUpdate: progressCallback,
      concurrency: 1,
      timeoutInMilliseconds: RENDER_TIMEOUT_MS,
      gl: 'swangle',
      hardwareAcceleration: 'disable',
      chromiumOptions: {
        gl: 'swangle',
        headless: true,
      },
    } as any).catch((retryError: any) => {
      throw new RenderError(`Remotion renderFrames failed for job ${manifest.jobId} at ${(lastProgress * 100).toFixed(0)}%: ${retryError.message}`);
    });
  }
};

const runFfmpeg = ({args, errorFactory}: {args: string[]; errorFactory: (detail: string) => Error}) =>
  new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);
    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(errorFactory(`FFmpeg exited with code ${code}: ${stderr}`));
    });
    ffmpeg.on('error', (error) => reject(errorFactory(`FFmpeg process error: ${error.message}`)));
  });

export async function renderFromManifest(
  manifest: UnifiedRenderManifest,
  options: RenderFromManifestOptions = {},
): Promise<string> {
  const parseResult = UnifiedRenderManifestSchema.safeParse(manifest);
  if (!parseResult.success) {
    throw new ValidationError(`Validation failed: ${parseResult.error.message}`);
  }

  const validatedManifest = parseResult.data;
  const compositionId = options.compositionId ?? 'JosephEdit';
  const entryPoint = options.entryPoint ?? JOSEPH_ENTRY_POINT;
  const expectedWidth = compositionId === 'JosephLandscapeEdit' ? LANDSCAPE_WIDTH : JOSEPH_WIDTH;
  const expectedHeight = compositionId === 'JosephLandscapeEdit' ? LANDSCAPE_HEIGHT : JOSEPH_HEIGHT;
  assertManifestDimensions(validatedManifest, expectedWidth, expectedHeight, compositionId);
  const tmpDir = options.tempDir ?? os.tmpdir();
  const sfxDir = options.sfxDir ?? DEFAULT_SFX_DIR;
  const framesDir = path.join(tmpDir, `${validatedManifest.jobId}_frames`);
  const silentVideoPath = path.join(tmpDir, `${validatedManifest.jobId}_silent.mp4`);
  const audioPath = path.join(tmpDir, `${validatedManifest.jobId}_audio.m4a`);
  const finalVideoPath = path.join(tmpDir, `${validatedManifest.jobId}_final.mp4`);
  const browserExecutable = resolveBrowserExecutable();
  const inputProps = {manifest: validatedManifest, audioPreviewEnabled: false};
  const renderConcurrency = resolveRenderConcurrency({
    availableCpu: typeof os.availableParallelism === 'function'
      ? os.availableParallelism()
      : os.cpus().length,
    durationFrames: validatedManifest.durationFrames,
    configuredConcurrency: options.renderConcurrency ?? (
      process.env.PROMETHEUS_RENDER_CONCURRENCY
        ? Number.parseInt(process.env.PROMETHEUS_RENDER_CONCURRENCY, 10)
        : undefined
    ),
  });

  const cleanupTempFiles = () => {
    removeDirectoryIfPresent(framesDir);
    removeIfPresent(silentVideoPath);
    removeIfPresent(audioPath);
  };

  const cleanupSourceVideo = () => {
    if (options.sourceVideoPath) {
      removeIfPresent(options.sourceVideoPath);
    }
  };

  try {
    const serveUrl = await getServeUrl(entryPoint);

    const composition = await selectComposition({
      serveUrl,
      id: compositionId,
      inputProps,
      browserExecutable,
      timeoutInMilliseconds: RENDER_TIMEOUT_MS,
      gl: 'angle',
      chromeMode: 'chrome-for-testing',
      chromiumOptions: {
        gl: 'angle',
        headless: true,
      },
    } as any);
    assertCompositionMatchesManifest(composition, validatedManifest);

    removeDirectoryIfPresent(framesDir);
    fs.mkdirSync(framesDir, {recursive: true});
    await renderSilentFrames({
      composition,
      serveUrl,
      outputDir: framesDir,
      imageFormat: 'png',
      imageSequencePattern: 'frame-[frame].[ext]',
      inputProps,
      gl: 'angle',
      concurrency: renderConcurrency,
      timeoutInMilliseconds: RENDER_TIMEOUT_MS,
      browserExecutable,
      hardwareAcceleration: 'if-possible',
      chromeMode: 'chrome-for-testing',
      chromiumOptions: {
        gl: 'angle',
        headless: true,
      },
      muted: true,
    }, validatedManifest);

    const frameDigits = String(Math.max(0, validatedManifest.durationFrames - 1)).length;
    await runFfmpeg({
      args: [
        '-hide_banner', '-loglevel', 'error',
        '-framerate', String(validatedManifest.fps),
        '-start_number', '0',
        '-i', path.join(framesDir, `frame-%0${frameDigits}d.png`),
        '-c:v', 'h264_nvenc',
        '-preset', 'p4',
        '-tune', 'hq',
        '-rc', 'vbr',
        '-cq', String(validatedManifest.output.crf),
        '-b:v', '0',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-y', silentVideoPath,
      ],
      errorFactory: (detail) => new NvencError(`NVENC encode failed for job ${validatedManifest.jobId}. ${detail}`),
    });

    await mixAndMuxManifest(validatedManifest, silentVideoPath, finalVideoPath, {sfxDir, tempDir: tmpDir});

    cleanupTempFiles();
    cleanupSourceVideo();
    return finalVideoPath;
  } catch (error) {
    cleanupTempFiles();
    throw error;
  }
}

/**
 * Shared mix+mux stage: builds the real audio mix (voice track + sfx) with
 * mixAudio, then muxes it onto a silent video. Used by both the local NVENC
 * spine (renderFromManifest) and the Lambda fan-out path (renderLandscapeLambda).
 */
export async function mixAndMuxManifest(
  manifest: UnifiedRenderManifest,
  silentVideoPath: string,
  outputPath: string,
  options: {sfxDir?: string; tempDir?: string} = {},
): Promise<string> {
  const tmpDir = options.tempDir ?? os.tmpdir();
  const sfxDir = options.sfxDir ?? DEFAULT_SFX_DIR;
  const audioPath = path.join(tmpDir, `${manifest.jobId}_audio.m4a`);

  try {
    await mixAudio(manifest, audioPath, {sfxDir, tempDir: tmpDir});
  } catch (error: any) {
    throw new RenderError(
      `mixAudio failed for job ${manifest.jobId}: ${error.message}`,
      audioFailureTagsForError(error),
    );
  }

  await runFfmpeg({
    args: [
      '-hide_banner', '-loglevel', 'error',
      '-i', silentVideoPath,
      '-i', audioPath,
      '-map_metadata', '-1',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '320k',
      '-shortest',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ],
    errorFactory: (detail) => new MuxError(`FFmpeg mux failed. ${detail}`),
  });

  return outputPath;
}

/**
 * 16:9 landscape bake — same render spine as renderFromManifest, but wired to
 * the JosephLandscapeEdit composition (1920x1080) and the combined
 * landscape-entry bundle. Works on the local NVENC spine before any Lambda
 * fan-out exists; Lambda builds on the exact same composition id.
 */
export async function renderLandscapeFromManifest(
  manifest: UnifiedRenderManifest,
  options: Omit<RenderFromManifestOptions, 'compositionId' | 'entryPoint'> & {
    entryPoint?: string;
  } = {},
): Promise<string> {
  return renderFromManifest(manifest, {
    ...options,
    compositionId: 'JosephLandscapeEdit',
    entryPoint: options.entryPoint ?? LANDSCAPE_ENTRY_POINT,
  });
}
