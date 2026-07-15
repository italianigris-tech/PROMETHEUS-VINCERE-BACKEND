import {spawn} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {UnifiedRenderManifest} from '@prometheus/shared-types';

export class AudioMixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioMixError';
  }
}

export class SFXNotFoundError extends Error {
  readonly failureTag = 'missing_sfx_asset';

  constructor(message: string) {
    super(message);
    this.name = 'SFXNotFoundError';
  }
}

export type MixAudioOptions = {
  sfxDir: string;
  tempDir?: string;
  ffmpegBinary?: string;
};

const WINDOWS_ABSOLUTE_PATH = /^[a-zA-Z]:[\\/]/;
const UNC_ABSOLUTE_PATH = /^\\\\[^\\]+\\[^\\]+/;
const POSIX_ABSOLUTE_PATH = /^\//;

const normalizeFilePath = (value: string) => value.startsWith('file:///') ? value.replace('file:///', '') : value;

const isFfmpegSafeLocalPath = (value: string) => {
  const normalized = normalizeFilePath(value.trim());
  if (!normalized || /^https?:\/\//i.test(normalized)) {
    return false;
  }
  if (/^\/(api|assets|fonts|music|uploads)\//i.test(normalized)) {
    return false;
  }
  if (process.platform === 'win32' && POSIX_ABSOLUTE_PATH.test(normalized) && !normalized.startsWith('//')) {
    return false;
  }
  return WINDOWS_ABSOLUTE_PATH.test(normalized)
    || UNC_ABSOLUTE_PATH.test(normalized)
    || POSIX_ABSOLUTE_PATH.test(normalized);
};

const isReadableAudioAsset = (assetPath: string) => {
  if (!fs.existsSync(assetPath)) {
    return false;
  }

  try {
    return fs.statSync(assetPath).size > 0;
  } catch {
    return false;
  }
};

const assertExistingAbsoluteDirectory = (directoryPath: string, label: string) => {
  if (!directoryPath || !isFfmpegSafeLocalPath(directoryPath)) {
    throw new AudioMixError(`${label} must be an explicit absolute local path.`);
  }
  if (!fs.existsSync(directoryPath)) {
    throw new AudioMixError(`${label} does not exist: ${directoryPath}`);
  }
};

const assertReadableLocalFile = (filePath: string, label: string) => {
  const normalized = normalizeFilePath(filePath);
  if (!isFfmpegSafeLocalPath(normalized)) {
    throw new AudioMixError(`${label} must be an explicit local file path for FFmpeg: ${filePath}`);
  }
  if (!isReadableAudioAsset(normalized)) {
    throw new AudioMixError(`${label} is missing or empty: ${normalized}`);
  }
  return normalized;
};
export const sanitizeForFFmpeg = (value: string): string =>
  value.replace(/[\\'";()\r\n]/g, "").trim();

export function resolveSfxPath(sfxDir: string, sfxEvent: UnifiedRenderManifest["audio"]["sfx"][number]): string {
  const variant = sfxEvent.variant;
  const candidates = [
    variant ? `${sfxEvent.cue}_${variant}.mp3` : null,
    variant ? `${sfxEvent.cue}_1.mp3` : null,
    `${sfxEvent.cue}.mp3`,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const sfxPath = path.join(sfxDir, candidate);
    if (isReadableAudioAsset(sfxPath)) {
      return sfxPath;
    }
  }

  throw new SFXNotFoundError(`SFX file not found or empty for cue ${sfxEvent.cue}${variant ? ` variant ${variant}` : ''} in ${sfxDir}`);
}

const seconds = (value: number): string => Number(value.toFixed(3)).toString();

const buildDjDuckingExpression = (manifest: UnifiedRenderManifest, baseVolumeDb: number) => {
  const regions = manifest.audio.djPlan?.duckingRegions ?? [];
  if (regions.length > 0) {
    return regions.reduceRight(
      (fallback, region) =>
        `if(between(t,${seconds(region.videoStartSec)},${seconds(region.videoEndSec)}),${region.targetMusicDb}dB,${fallback})`,
      `${baseVolumeDb}dB`,
    );
  }

  if (manifest.source.transcript.length === 0) {
    return null;
  }

  const clauses = manifest.source.transcript.map((word) => {
    sanitizeForFFmpeg(word.text);
    return `between(t,${(word.startMs / 1000).toFixed(2)},${(word.endMs / 1000).toFixed(2)})`;
  });

  return `if(${clauses.join('+')},-24dB,${baseVolumeDb}dB)`;
};

const buildVoiceDuckingExpression = (manifest: UnifiedRenderManifest) => {
  if (manifest.source.transcript.length === 0) {
    return null;
  }

  const clauses = manifest.source.transcript.map((word) => {
    sanitizeForFFmpeg(word.text);
    return `between(t,${(word.startMs / 1000).toFixed(2)},${(word.endMs / 1000).toFixed(2)})`;
  });

  return `if(${clauses.join('+')},-24,-18)`;
};

const buildSfxDuckingExpression = (manifest: UnifiedRenderManifest) => {
  if (manifest.audio.sfx.length === 0) {
    return null;
  }

  return manifest.audio.sfx.reduceRight((fallback, cue) => {
    const start = (cue.triggerMs / 1000).toFixed(1);
    const end = ((cue.triggerMs + cue.durationMs) / 1000).toFixed(1);
    const volume = manifest.audio.musicVolumeDb + cue.duckMusicDb;
    return `if(between(t,${start},${end}),${volume}dB,${fallback})`;
  }, '-18dB');
};

export function buildFfmpegArgs(
  manifest: UnifiedRenderManifest,
  outputPath: string,
  options: MixAudioOptions
): string[] {
  assertExistingAbsoluteDirectory(options.sfxDir, 'sfxDir');
  if (options.tempDir) {
    assertExistingAbsoluteDirectory(options.tempDir, 'tempDir');
  }

  const args: string[] = [];

  const voiceTrack = assertReadableLocalFile(manifest.source.audioUrl || manifest.source.videoUrl, 'source audio');
  args.push('-i', voiceTrack);

  let inputCount = 1;
  const filterParts: string[] = [];
  const sfxInputs: string[] = [];

  const musicInputLabels: string[] = [];
  const djMusicEvents = manifest.audio.djPlan?.musicEvents ?? [];
  if (djMusicEvents.length > 0) {
    djMusicEvents.forEach((event, index) => {
      const musicTrack = assertReadableLocalFile(event.localFilePath, `DJ music event ${event.id}`);
      args.push('-i', musicTrack);
      const inputIdx = inputCount++;
      const baseLabel = `dj${index}`;
      const duckExpression = event.duckingEnabled ? buildDjDuckingExpression(manifest, event.volumeDb) : null;
      const filters = [
        `atrim=start=${seconds(event.trackStartSec)}:end=${seconds(event.trackEndSec)}`,
        'asetpts=PTS-STARTPTS',
        `volume=${event.volumeDb}dB`,
      ];
      const eventDurationSec = Math.max(0.001, event.videoEndSec - event.videoStartSec);
      if (event.fadeInSec > 0) {
        filters.push(`afade=t=in:st=0:d=${seconds(Math.min(event.fadeInSec, eventDurationSec))}`);
      }
      if (event.fadeOutSec > 0) {
        filters.push(`afade=t=out:st=${seconds(Math.max(0, eventDurationSec - event.fadeOutSec))}:d=${seconds(Math.min(event.fadeOutSec, eventDurationSec))}`);
      }
      filters.push(`adelay=${Math.round(event.videoStartSec * 1000)}|${Math.round(event.videoStartSec * 1000)}`);
      filterParts.push(`[${inputIdx}:a]${filters.join(',')}[${baseLabel}]`);
      if (duckExpression) {
        filterParts.push(`[${baseLabel}]volume='${duckExpression}':eval=frame[${baseLabel}duck]`);
        musicInputLabels.push(`[${baseLabel}duck]`);
      } else {
        musicInputLabels.push(`[${baseLabel}]`);
      }
    });
  } else {
    let musicTrack = manifest.audio.musicReference?.localFilePath ?? manifest.audio.musicTrackUrl;
    const hasMusic = Boolean(musicTrack);
    if (hasMusic) {
      if (manifest.audio.musicReference && !manifest.audio.musicReference.renderSafe) {
        throw new AudioMixError(`musicReference is not renderSafe: ${manifest.audio.musicReference.trackId}`);
      }
      musicTrack = assertReadableLocalFile(musicTrack!, 'music track');
      args.push('-i', musicTrack!);

      const voiceDuck = buildVoiceDuckingExpression(manifest);
      const sfxDuck = buildSfxDuckingExpression(manifest);
      const musicLabel = `a${inputCount}`;
      if (voiceDuck) {
        filterParts.push(`[${inputCount}:a]volume='${voiceDuck}':eval=frame[${musicLabel}]`);
      } else {
        filterParts.push(`[${inputCount}:a]volume=-18dB[${musicLabel}]`);
      }
      if (sfxDuck) {
        filterParts.push(`[${musicLabel}]volume='${sfxDuck}':eval=frame[${musicLabel}duck]`);
        musicInputLabels.push(`[${musicLabel}duck]`);
      } else {
        musicInputLabels.push(`[${musicLabel}]`);
      }
      inputCount += 1;
    }
  }

  const sfxCues = manifest.audio.sfx || [];
  if (sfxCues.length > 0) {
    sfxCues.forEach((sfxEvent) => {
      const sfxPath = resolveSfxPath(options.sfxDir, sfxEvent);
      args.push('-i', sfxPath);
      const inputIdx = inputCount++;
      filterParts.push(`[${inputIdx}:a]volume=${sfxEvent.volumeDb}dB,adelay=${sfxEvent.triggerMs}|${sfxEvent.triggerMs}[a${inputIdx}]`);
      sfxInputs.push(`[a${inputIdx}]`);
    });
  }

  filterParts.unshift(`[0:a]volume=${manifest.audio.voiceVolumeDb}dB[voice]`);

  const mixInputs = ['[voice]', ...musicInputLabels, ...sfxInputs];

  filterParts.push(`${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first[mix]`);
  filterParts.push(`[mix]loudnorm=I=${manifest.audio.targetLufs}:TP=-1:LRA=11[out]`);

  args.push('-filter_complex', filterParts.join(';'));
  args.push('-map', '[out]');
  args.push('-t', (manifest.source.durationMs / 1000).toFixed(3));
  args.push('-c:a', 'aac');
  args.push('-y');
  args.push(outputPath);

  return args;
}

export async function mixAudio(
  manifest: UnifiedRenderManifest,
  outputPath: string,
  options: MixAudioOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const args = buildFfmpegArgs(manifest, outputPath, options);
      const ffmpeg = spawn(options.ffmpegBinary ?? 'ffmpeg', args);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          reject(new AudioMixError(`FFmpeg exited with code ${code}: ${stderr}`));
          return;
        }
        resolve();
      });

      ffmpeg.on('error', (err) => {
        reject(new AudioMixError(`FFmpeg process error: ${err.message}`));
      });
    } catch (err) {
      reject(err);
    }
  });
}
