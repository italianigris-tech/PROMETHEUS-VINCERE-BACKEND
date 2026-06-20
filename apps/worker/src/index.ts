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
let cachedServeUrlPromise: Promise<string> | null = null;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RenderError';
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

const shouldRetryRender = (error: Error) => /timeout|timed out|chromium|browser/i.test(error.message);

const logRenderProgress = (progress: {progress: number}) => {
  const rounded = Math.round(progress.progress * 100);
  if (rounded % 10 === 0) {
    console.log(`[Worker] Render progress: ${rounded}%`);
  }
};

const getServeUrl = () => {
  if (!cachedServeUrlPromise) {
    cachedServeUrlPromise = bundle({
      entryPoint: path.resolve(__dirname, '../../../remotion-app/src/index.ts'),
    });
  }

  return cachedServeUrlPromise;
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

    return renderMedia({
      ...options,
      onProgress: progressCallback,
      concurrency: 1,
      timeoutInMilliseconds: 600000,
      gl: 'swangle',
      hardwareAcceleration: 'disable',
    } as any).catch((retryError: any) => {
      throw new RenderError(`Remotion renderMedia failed for job ${manifest.jobId} at ${(lastProgress * 100).toFixed(0)}%: ${retryError.message}`);
    });
  }
};

export async function renderFromManifest(
  manifest: UnifiedRenderManifest
): Promise<string> {
  const parseResult = UnifiedRenderManifestSchema.safeParse(manifest);
  if (!parseResult.success) {
    throw new ValidationError(`Validation failed: ${parseResult.error.message}`);
  }

  const validatedManifest = parseResult.data;
  const tmpDir = os.tmpdir();
  const silentVideoPath = path.join(tmpDir, `${validatedManifest.jobId}_silent.mp4`);
  const audioPath = path.join(tmpDir, `${validatedManifest.jobId}_audio.m4a`);
  const finalVideoPath = path.join(tmpDir, `${validatedManifest.jobId}_final.mp4`);
  const browserExecutable = resolveBrowserExecutable();
  const inputProps = {manifest: validatedManifest};

  const cleanupTempFiles = () => {
    removeIfPresent(silentVideoPath);
    removeIfPresent(audioPath);
  };

  try {
    const serveUrl = await getServeUrl();

    const composition = await selectComposition({
      serveUrl,
      id: 'JosephEdit',
      inputProps,
      browserExecutable,
      timeoutInMilliseconds: 300000,
      gl: 'swangle',
      chromeMode: 'chrome-for-testing',
      chromiumOptions: {
        gl: 'swangle',
        headless: true,
      },
    } as any);

    await renderSilentVideo({
      composition,
      serveUrl,
      outputLocation: silentVideoPath,
      codec: 'h264',
      fps: validatedManifest.fps,
      width: validatedManifest.width,
      height: validatedManifest.height,
      inputProps,
      gl: 'swangle',
      concurrency: 1,
      timeoutInMilliseconds: 300000,
      browserExecutable,
      hardwareAcceleration: 'disable',
      chromeMode: 'chrome-for-testing',
      chromiumOptions: {
        gl: 'swangle',
        headless: true,
      },
      muted: true,
      overwrite: true,
    }, validatedManifest);

    try {
      await mixAudio(validatedManifest, audioPath);
    } catch (error: any) {
      throw new RenderError(`mixAudio failed for job ${validatedManifest.jobId}: ${error.message}`);
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
    return finalVideoPath;
  } catch (error) {
    cleanupTempFiles();
    throw error;
  }
}
