import {UnifiedRenderManifest, UnifiedRenderManifestSchema} from '@prometheus/shared-types';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
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
const DEFAULT_SFX_DIR = path.resolve(__dirname, '../../../remotion-app/public/sfx');
const DURABLE_BUNDLE_DIR = path.resolve(
  process.env.REMOTION_BUNDLE_DIR ?? path.join(__dirname, '../.cache/joseph-remotion-bundle'),
);
const RENDER_TIMEOUT_MS = 600000;
let cachedServeUrlPromise: Promise<string> | null = null;

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

export type RenderFromManifestOptions = {
  tempDir?: string;
  sfxDir?: string;
  sourceVideoPath?: string;
};

const shouldRetryRender = (error: Error) => {
  if (/root component to unsuspend|delayRender\(\)/i.test(error.message)) {
    return false;
  }
  return /timeout|timed out|chromium|browser/i.test(error.message);
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
  if (/missing_sfx_asset|SFXNotFoundError|SFX file not found/i.test(message)) {
    return ['missing_sfx_asset'];
  }
  if (/audio|mixAudio|ffmpeg/i.test(message)) {
    return ['audio_mix_failed'];
  }
  return ['render_failed'];
};

const logRenderProgress = (progress: {progress: number}) => {
  const rounded = Math.round(progress.progress * 100);
  if (rounded % 10 === 0) {
    console.log(`[Worker] Render progress: ${rounded}%`);
  }
};

const getServeUrl = () => {
  if (!cachedServeUrlPromise) {
    console.log(`[Worker] Bundling Joseph renderer to durable path ${DURABLE_BUNDLE_DIR}`);
    cachedServeUrlPromise = bundle({
      entryPoint: JOSEPH_ENTRY_POINT,
      outDir: DURABLE_BUNDLE_DIR,
    }).catch((error) => {
      cachedServeUrlPromise = null;
      throw error;
    });
  }

  return cachedServeUrlPromise;
};

const assertVerticalJosephManifest = (manifest: UnifiedRenderManifest): void => {
  if (
    manifest.width !== JOSEPH_WIDTH ||
    manifest.height !== JOSEPH_HEIGHT ||
    manifest.output.width !== JOSEPH_WIDTH ||
    manifest.output.height !== JOSEPH_HEIGHT
  ) {
    throw new ValidationError(
      `Joseph render manifest must be ${JOSEPH_WIDTH}x${JOSEPH_HEIGHT}; got manifest ${manifest.width}x${manifest.height} and output ${manifest.output.width}x${manifest.output.height}.`
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

const renderSilentVideo = async (options: Record<string, unknown>, manifest: UnifiedRenderManifest) => {
  let lastProgress = 0;
  const progressCallback = (progress: {progress: number}) => {
    lastProgress = progress.progress;
    logRenderProgress(progress);
  };

  try {
    return await renderMedia({...options, onProgress: progressCallback} as any);
  } catch (error: any) {
    if (error?.message?.includes('timeout')) {
      logRenderProgress({progress: 0.1});
    }
    if (!shouldRetryRender(error)) {
      throw new RenderError(`Remotion renderMedia failed for job ${manifest.jobId} at ${(lastProgress * 100).toFixed(0)}%: ${error.message}`);
    }

    console.warn(
      `[Worker] Primary render failed for job ${manifest.jobId}; retrying with software GL using the same durable bundle ${String(options.serveUrl)}.`,
    );
    return renderMedia({
      ...options,
      onProgress: progressCallback,
      concurrency: 1,
      timeoutInMilliseconds: RENDER_TIMEOUT_MS,
      gl: 'swangle',
      hardwareAcceleration: 'disable',
      chromiumOptions: {
        gl: 'swangle',
        headless: true,
      },
    } as any).catch((retryError: any) => {
      throw new RenderError(`Remotion renderMedia failed for job ${manifest.jobId} at ${(lastProgress * 100).toFixed(0)}%: ${retryError.message}`);
    });
  }
};

export async function renderFromManifest(
  manifest: UnifiedRenderManifest,
  options: RenderFromManifestOptions = {},
): Promise<string> {
  const parseResult = UnifiedRenderManifestSchema.safeParse(manifest);
  if (!parseResult.success) {
    throw new ValidationError(`Validation failed: ${parseResult.error.message}`);
  }

  const validatedManifest = parseResult.data;
  assertVerticalJosephManifest(validatedManifest);
  const tmpDir = options.tempDir ?? os.tmpdir();
  const sfxDir = options.sfxDir ?? DEFAULT_SFX_DIR;
  const silentVideoPath = path.join(tmpDir, `${validatedManifest.jobId}_silent.mp4`);
  const audioPath = path.join(tmpDir, `${validatedManifest.jobId}_audio.m4a`);
  const finalVideoPath = path.join(tmpDir, `${validatedManifest.jobId}_final.mp4`);
  const browserExecutable = resolveBrowserExecutable();
  const inputProps = {manifest: validatedManifest, audioPreviewEnabled: false};

  const cleanupTempFiles = () => {
    removeIfPresent(silentVideoPath);
    removeIfPresent(audioPath);
  };

  const cleanupSourceVideo = () => {
    if (options.sourceVideoPath) {
      removeIfPresent(options.sourceVideoPath);
    }
  };

  try {
    const serveUrl = await getServeUrl();

    const composition = await selectComposition({
      serveUrl,
      id: 'JosephEdit',
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

    await renderSilentVideo({
      composition,
      serveUrl,
      outputLocation: silentVideoPath,
      codec: 'h264',
      fps: validatedManifest.fps,
      width: validatedManifest.width,
      height: validatedManifest.height,
      inputProps,
      gl: 'angle',
      concurrency: 1,
      timeoutInMilliseconds: RENDER_TIMEOUT_MS,
      browserExecutable,
      hardwareAcceleration: 'if-possible',
      chromeMode: 'chrome-for-testing',
      chromiumOptions: {
        gl: 'angle',
        headless: true,
      },
      muted: true,
      overwrite: true,
    }, validatedManifest);

    try {
      await mixAudio(validatedManifest, audioPath, {sfxDir, tempDir: tmpDir});
    } catch (error: any) {
      throw new RenderError(
        `mixAudio failed for job ${validatedManifest.jobId}: ${error.message}`,
        audioFailureTagsForError(error),
      );
    }

    await new Promise<void>((resolve, reject) => {
      const ffmpegArgs = [
        '-i', silentVideoPath,
        '-i', audioPath,
        '-map_metadata', '-1',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '320k',
        '-shortest',
        '-movflags', '+faststart',
        '-y',
        finalVideoPath,
      ];

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          reject(new MuxError(`FFmpeg mux failed with code ${code}: ${stderr}`));
          return;
        }

        resolve();
      });

      ffmpeg.on('error', (error) => {
        reject(new MuxError(`FFmpeg mux process error: ${error.message}`));
      });
    });

    cleanupTempFiles();
    cleanupSourceVideo();
    return finalVideoPath;
  } catch (error) {
    cleanupTempFiles();
    throw error;
  }
}
