import {
  maulUnifiedShortRenderManifestSchema,
  type MaulUnifiedShortRenderManifest,
} from '@prometheus/shared-types';
import {bundle} from '@remotion/bundler';
import {renderFrames, selectComposition} from '@remotion/renderer';
import {createHash} from 'crypto';
import {spawn} from 'child_process';
import {once} from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {fileURLToPath} from 'url';

import {NvencError, RenderError, ValidationError, resolveRenderConcurrency} from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAUL_ENTRY_POINT = path.resolve(__dirname, '../../../remotion-app/src/entries/maul-entry.tsx');
const MAUL_BUNDLE_DIR = path.resolve(
  process.env.MAUL_REMOTION_BUNDLE_DIR ?? path.join(__dirname, '../.cache/maul-remotion-bundle'),
);
const RENDER_TIMEOUT_MS = 600_000;
let cachedMaulServeUrl: Promise<string> | null = null;

const getServeUrl = (): Promise<string> => {
  if (!cachedMaulServeUrl) {
    const bakedBundle = path.join(MAUL_BUNDLE_DIR, 'index.html');
    cachedMaulServeUrl = process.env.NODE_ENV === 'production' && fs.existsSync(bakedBundle)
      ? Promise.resolve(MAUL_BUNDLE_DIR)
      : bundle({entryPoint: MAUL_ENTRY_POINT, outDir: MAUL_BUNDLE_DIR}).catch((error) => {
          cachedMaulServeUrl = null;
          throw error;
        });
  }
  return cachedMaulServeUrl;
};

const runFfmpeg = (args: string[]): Promise<void> => new Promise((resolve, reject) => {
  const child = spawn('ffmpeg', args);
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('error', (error) => reject(new NvencError(`FFmpeg process error: ${error.message}`)));
  child.on('close', (code) => {
    if (code === 0) resolve();
    else reject(new NvencError(`FFmpeg exited with code ${code}: ${stderr}`));
  });
});

const hasAudioStream = (inputPath: string): Promise<boolean> => new Promise((resolve, reject) => {
  const child = spawn('ffprobe', [
    '-v', 'error', '-select_streams', 'a:0',
    '-show_entries', 'stream=index', '-of', 'csv=p=0', inputPath,
  ]);
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('error', (error) => reject(new NvencError(`FFprobe process error: ${error.message}`)));
  child.on('close', (code) => {
    if (code === 0) resolve(stdout.trim().length > 0);
    else reject(new NvencError(`FFprobe exited with code ${code}: ${stderr}`));
  });
});

const audioTempoFilters = (rate: number): string[] => {
  const filters: string[] = [];
  let remaining = rate;
  while (remaining > 2) {
    filters.push('atempo=2');
    remaining /= 2;
  }
  while (remaining < 0.5) {
    filters.push('atempo=0.5');
    remaining /= 0.5;
  }
  filters.push(`atempo=${remaining.toFixed(8)}`);
  return filters;
};

const renderMaulAudioWithFfmpeg = async (
  manifest: MaulUnifiedShortRenderManifest,
  outputPath: string,
): Promise<void> => {
  const durationSeconds = manifest.timeline.outputDurationMs / 1000;
  const ffmpegInputs: string[] = ['-hide_banner', '-loglevel', 'error'];
  const filters: string[] = [];
  const mixLabels: string[] = [];
  let inputIndex = 0;
  const sourceHasAudio = await hasAudioStream(manifest.source.storagePath);

  if (sourceHasAudio) {
    const sourceInput = inputIndex++;
    ffmpegInputs.push('-i', manifest.source.storagePath);
    const timestampMap = manifest.timeline.timestampMap.length > 0
      ? manifest.timeline.timestampMap
      : [{
          sourceStartMs: 0,
          sourceEndMs: manifest.timeline.sourceDurationMs,
          outputStartMs: 0,
          outputEndMs: manifest.timeline.outputDurationMs,
        }];
    timestampMap.forEach((window, index) => {
      const sourceDurationMs = window.sourceEndMs - window.sourceStartMs;
      const outputDurationMs = window.outputEndMs - window.outputStartMs;
      if (sourceDurationMs <= 0 || outputDurationMs <= 0) return;
      const label = `voice${index}`;
      const tempo = audioTempoFilters(sourceDurationMs / outputDurationMs);
      filters.push(
        `[${sourceInput}:a]atrim=start=${(window.sourceStartMs / 1000).toFixed(6)}` +
        `:end=${(window.sourceEndMs / 1000).toFixed(6)},asetpts=PTS-STARTPTS,` +
        `${tempo.join(',')},aresample=48000,` +
        `aformat=sample_fmts=fltp:channel_layouts=stereo,` +
        `adelay=${Math.round(window.outputStartMs)}|${Math.round(window.outputStartMs)}[${label}]`,
      );
      mixLabels.push(`[${label}]`);
    });
  }

  const renderAudioTreatment = manifest.schemaVersion !== 'maul-unified-short-render-manifest/v3'
    || manifest.layerPolicy.audioTreatment === 'enabled';
  const music = renderAudioTreatment && manifest.audio.musicTrack?.renderSafe
    ? manifest.audio.musicTrack
    : null;
  if (music) {
    const musicInput = inputIndex++;
    ffmpegInputs.push('-stream_loop', '-1', '-i', music.storagePath);
    const volume = Math.min(
      0.42,
      Math.pow(10, manifest.treatment.rendererInputs.audio.duckingDb / 20),
    );
    filters.push(
      `[${musicInput}:a]atrim=start=0:end=${durationSeconds.toFixed(6)},` +
      `asetpts=PTS-STARTPTS,aresample=48000,` +
      `aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${volume.toFixed(8)}[music]`,
    );
    mixLabels.push('[music]');
  }

  if (renderAudioTreatment) {
    manifest.audio.sfxAssets.forEach((sfx, index) => {
      const sfxInput = inputIndex++;
      const label = `sfx${index}`;
      ffmpegInputs.push('-i', sfx.storagePath);
      filters.push(
        `[${sfxInput}:a]atrim=start=0:end=2,asetpts=PTS-STARTPTS,aresample=48000,` +
        `aformat=sample_fmts=fltp:channel_layouts=stereo,volume=0.5,` +
        `adelay=${Math.round(sfx.outputMs)}|${Math.round(sfx.outputMs)}[${label}]`,
      );
      mixLabels.push(`[${label}]`);
    });
  }

  if (mixLabels.length === 0) {
    const silenceInput = inputIndex++;
    ffmpegInputs.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
    filters.push(`[${silenceInput}:a]atrim=end=${durationSeconds.toFixed(6)}[silence]`);
    mixLabels.push('[silence]');
  }

  filters.push(
    `${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=longest:` +
    `dropout_transition=0:normalize=0,apad=whole_dur=${durationSeconds.toFixed(6)},` +
    `atrim=start=0:end=${durationSeconds.toFixed(6)}[mix]`,
  );
  await runFfmpeg([
    ...ffmpegInputs,
    '-filter_complex', filters.join(';'), '-map', '[mix]',
    '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', '-y', outputPath,
  ]);
};

const startNvencFramePipe = ({fps, outputPath, firstFrame = 0, videoEncoder = 'h264_nvenc'}: {
  fps: number;
  outputPath: string;
  firstFrame?: number;
  videoEncoder?: 'h264_nvenc' | 'libx264';
}) => {
  const encoderArgs = videoEncoder === 'h264_nvenc'
    ? ['-c:v', 'h264_nvenc', '-preset', 'p4', '-tune', 'hq', '-rc', 'vbr', '-cq', '18', '-b:v', '0']
    : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18'];
  const child = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'mjpeg', '-i', 'pipe:0',
    ...encoderArgs,
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', outputPath,
  ], {stdio: ['pipe', 'ignore', 'pipe']});
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  const completion = new Promise<void>((resolve, reject) => {
    child.on('error', (error) => reject(new NvencError(`FFmpeg process error: ${error.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new NvencError(`FFmpeg exited with code ${code}: ${stderr}`));
    });
  });
  void completion.catch(() => undefined);

  const pending = new Map<number, Buffer>();
  let nextFrame = firstFrame;
  let writtenFrames = 0;
  let flushing: Promise<void> | null = null;
  const flush = (): Promise<void> => {
    if (flushing) return flushing;
    flushing = (async () => {
      while (pending.has(nextFrame)) {
        const buffer = pending.get(nextFrame)!;
        pending.delete(nextFrame);
        if (!child.stdin.write(buffer)) await once(child.stdin, 'drain');
        nextFrame += 1;
        writtenFrames += 1;
      }
    })().finally(() => { flushing = null; });
    return flushing;
  };

  return {
    write(buffer: Buffer, frame: number): void {
      pending.set(frame, buffer);
      void flush();
    },
    async finish(expectedFrames: number): Promise<void> {
      while (flushing) await flushing;
      await flush();
      if (writtenFrames !== expectedFrames || pending.size > 0) {
        child.kill();
        throw new NvencError(
          `Frame pipe received ${writtenFrames}/${expectedFrames} ordered frames (${pending.size} pending).`,
        );
      }
      child.stdin.end();
      await completion;
    },
    abort(): void {
      child.stdin.destroy();
      child.kill();
    },
  };
};

const safeSegment = (value: string): string => value.replace(/[^A-Za-z0-9._-]/g, '_');

const copyVerified = ({source, destination, sha256}: {
  source: string;
  destination: string;
  sha256?: string;
}): void => {
  if (!path.isAbsolute(source) || !fs.existsSync(source)) {
    throw new ValidationError(`MAUL render asset is unavailable to the worker: ${source}`);
  }
  if (sha256) {
    const actual = createHash('sha256').update(fs.readFileSync(source)).digest('hex');
    if (actual !== sha256.toLowerCase()) {
      throw new ValidationError(`MAUL render asset failed SHA-256 verification: ${source}`);
    }
  }
  fs.copyFileSync(source, destination);
};

const stageManifest = ({manifest, serveUrl, stageDir}: {
  manifest: MaulUnifiedShortRenderManifest;
  serveUrl: string;
  stageDir: string;
}): MaulUnifiedShortRenderManifest => {
  fs.mkdirSync(stageDir, {recursive: true});
  const publicPrefix = path.relative(path.join(serveUrl, 'public'), stageDir).replaceAll(path.sep, '/');
  const stageAsset = (source: string, name: string, sha256?: string): string => {
    const extension = path.extname(source);
    const filename = `${safeSegment(name)}${extension}`;
    copyVerified({source, destination: path.join(stageDir, filename), sha256});
    return `${publicPrefix}/${filename}`;
  };

  const sourcePath = stageAsset(manifest.source.storagePath, 'source', manifest.source.sha256);
  const musicTrack = manifest.audio.musicTrack
    ? {...manifest.audio.musicTrack, storagePath: stageAsset(manifest.audio.musicTrack.storagePath, 'music')}
    : null;
  const sfxAssets = manifest.audio.sfxAssets.map((asset, index) => ({
    ...asset,
    storagePath: stageAsset(asset.storagePath, `sfx-${index}`),
  }));
  const visualTrack = manifest.plans.visual.visualTrack;
  const stagedVisualTrack = visualTrack ? {
    ...visualTrack,
    assets: visualTrack.assets.map((asset, index) => ({
      ...asset,
      storagePath: stageAsset(asset.storagePath, `visual-${index}`, asset.sha256),
    })),
  } : visualTrack;
  const martinDepth = manifest.schemaVersion === 'maul-unified-short-render-manifest/v3' && manifest.martinDepth
    ? {
        ...manifest.martinDepth,
        windows: manifest.martinDepth.windows.map((window, index) => ({
          ...window,
          foregroundAsset: {
            ...window.foregroundAsset,
            storagePath: stageAsset(
              window.foregroundAsset.storagePath,
              `martin-${index}`,
              window.foregroundAsset.sha256,
            ),
          },
        })),
      }
    : undefined;

  return maulUnifiedShortRenderManifestSchema.parse({
    ...manifest,
    source: {...manifest.source, storagePath: sourcePath},
    audio: {...manifest.audio, musicTrack, sfxAssets},
    plans: {
      ...manifest.plans,
      visual: {...manifest.plans.visual, visualTrack: stagedVisualTrack},
    },
    ...(martinDepth ? {martinDepth} : {}),
  });
};

export async function renderMaulManifest(
  manifest: MaulUnifiedShortRenderManifest,
  options: {
    outputDir?: string;
    renderConcurrency?: number;
    mode?: 'full' | 'video-slice' | 'audio-only';
    frameRange?: [number, number];
    videoEncoder?: 'h264_nvenc' | 'libx264';
  } = {},
): Promise<string> {
  const validated = maulUnifiedShortRenderManifestSchema.parse(manifest);
  const pipelineJobId = `maul:${validated.replayKey}`;
  const safeJobId = safeSegment(pipelineJobId);
  const outputDir = path.resolve(options.outputDir ?? os.tmpdir());
  const serveUrl = await getServeUrl();
  const mode = options.mode ?? 'full';
  const frameRange = options.frameRange;
  if (mode === 'video-slice' && !frameRange) {
    throw new ValidationError('MAUL video-slice mode requires frameRange.');
  }
  if (frameRange && (frameRange[0] < 0 || frameRange[1] < frameRange[0])) {
    throw new ValidationError('MAUL frameRange must be an ordered non-negative interval.');
  }
  const rangeSuffix = frameRange ? `-${frameRange[0]}-${frameRange[1]}` : '';
  const stageRoot = path.join(serveUrl, 'public', '.maul-renders');
  fs.mkdirSync(stageRoot, {recursive: true});
  const stageDir = fs.mkdtempSync(path.join(stageRoot, `${safeJobId}${rangeSuffix}-`));
  const silentPath = path.join(outputDir, `${safeJobId}${rangeSuffix}-silent.mp4`);
  const audioPath = path.join(outputDir, `${safeJobId}-audio.wav`);
  const finalPath = path.join(outputDir, `${safeJobId}-final.mp4`);
  fs.mkdirSync(outputDir, {recursive: true});

  try {
    if (mode === 'audio-only') {
      await renderMaulAudioWithFfmpeg(validated, audioPath);
      return audioPath;
    }
    const runtimeManifest = stageManifest({manifest: validated, serveUrl, stageDir});
    const inputProps = {manifest: runtimeManifest, observationMode: 'creative'};
    const composition = await selectComposition({
      serveUrl,
      id: 'MaulShort',
      inputProps,
      timeoutInMilliseconds: RENDER_TIMEOUT_MS,
      gl: 'angle',
      chromeMode: 'chrome-for-testing',
      chromiumOptions: {gl: 'angle', headless: true},
    } as any);
    const expectedFrames = Math.max(1, Math.round(
      validated.timeline.outputDurationMs / 1000 * validated.output.fps,
    ));
    if (
      composition.width !== validated.output.width ||
      composition.height !== validated.output.height ||
      composition.durationInFrames !== expectedFrames
    ) {
      throw new ValidationError('MAUL composition metadata does not match its authoritative manifest.');
    }

    const firstFrame = frameRange?.[0] ?? 0;
    const lastFrame = frameRange?.[1] ?? expectedFrames - 1;
    if (lastFrame >= expectedFrames) {
      throw new ValidationError('MAUL frameRange exceeds composition duration.');
    }
    const framesToRender = lastFrame - firstFrame + 1;
    const concurrency = mode === 'video-slice'
      ? 1
      : resolveRenderConcurrency({
          availableCpu: typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length,
          durationFrames: framesToRender,
          configuredConcurrency: options.renderConcurrency,
        });
    const framePipe = startNvencFramePipe({
      fps: validated.output.fps,
      outputPath: silentPath,
      firstFrame,
      videoEncoder: options.videoEncoder,
    });
    try {
      await renderFrames({
        composition,
        serveUrl,
        frameRange,
        imageFormat: 'jpeg',
        jpegQuality: 95,
        onFrameBuffer: (buffer: Buffer, frame: number) => framePipe.write(buffer, frame),
        inputProps,
        concurrency,
        timeoutInMilliseconds: RENDER_TIMEOUT_MS,
        gl: 'angle',
        hardwareAcceleration: 'if-possible',
        chromeMode: 'chrome-for-testing',
        chromiumOptions: {gl: 'angle', headless: true},
        muted: true,
      } as any);
      await framePipe.finish(framesToRender);
    } catch (error) {
      framePipe.abort();
      throw error;
    }
    if (mode === 'video-slice') return silentPath;

    await renderMaulAudioWithFfmpeg(validated, audioPath);

    await runFfmpeg([
      '-hide_banner', '-loglevel', 'error',
      '-i', silentPath, '-i', audioPath,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k',
      '-shortest', '-movflags', '+faststart', '-y', finalPath,
    ]);
    return finalPath;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NvencError) throw error;
    throw new RenderError(`MAUL render failed for ${pipelineJobId}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    fs.rmSync(stageDir, {recursive: true, force: true});
    if (mode !== 'video-slice' && fs.existsSync(silentPath)) fs.unlinkSync(silentPath);
    if (mode !== 'audio-only' && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
  }
}
