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
  constructor(message: string) {
    super(message);
    this.name = 'SFXNotFoundError';
  }
}

const normalizeFileOrUrl = (value: string) => value.startsWith('file:///') ? value.replace('file:///', '') : value;

const buildVoiceDuckingExpression = (manifest: UnifiedRenderManifest) => {
  if (manifest.source.transcript.length === 0) {
    return null;
  }

  const clauses = manifest.source.transcript.map((word) =>
    `between(t,${(word.startMs / 1000).toFixed(2)},${(word.endMs / 1000).toFixed(2)})`
  );

  return `if(${clauses.join('+')},-24,-18)`;
};

const buildSfxDuckingExpression = (manifest: UnifiedRenderManifest) => {
  if (manifest.audio.sfx.length === 0) {
    return null;
  }

  const clauses = manifest.audio.sfx.map((cue) => {
    const start = (cue.triggerMs / 1000).toFixed(1);
    const end = ((cue.triggerMs + cue.durationMs) / 1000).toFixed(1);
    const volume = manifest.audio.musicVolumeDb + cue.duckMusicDb;
    return `if(between(t,${start},${end}),${volume},-18)`;
  });

  return clauses.join('+');
};

export function buildFfmpegArgs(
  manifest: UnifiedRenderManifest,
  outputPath: string
): string[] {
  const sfxDir = process.env.SFX_DIR || '';
  const args: string[] = [];

  let voiceTrack = normalizeFileOrUrl(manifest.source.audioUrl || manifest.source.videoUrl);
  args.push('-i', voiceTrack);

  let inputCount = 1;
  const filterParts: string[] = [];
  const sfxInputs: string[] = [];

  let musicTrack = manifest.audio.musicTrackUrl;
  const hasMusic = Boolean(musicTrack);
  if (hasMusic) {
    musicTrack = normalizeFileOrUrl(musicTrack!);
    args.push('-i', musicTrack!);

    const voiceDuck = buildVoiceDuckingExpression(manifest);
    const sfxDuck = buildSfxDuckingExpression(manifest);
    if (voiceDuck) {
      filterParts.push(`[1:a]volume='${voiceDuck}':eval=frame[a1]`);
    } else {
      filterParts.push(`[1:a]volume=-18dB[a1]`);
    }
    if (sfxDuck) {
      filterParts.push(`[a1]volume='${sfxDuck}':eval=frame[a1duck]`);
    }
    inputCount += 1;
  }

  const sfxCues = manifest.audio.sfx || [];
  if (sfxCues.length > 0) {
    sfxCues.forEach((sfxEvent) => {
      const sfxPath = path.join(sfxDir, `${sfxEvent.cue}.mp3`);
      if (!fs.existsSync(sfxPath)) {
        throw new SFXNotFoundError(`SFX file not found: ${sfxPath}`);
      }
      args.push('-i', sfxPath);
      const inputIdx = inputCount++;
      filterParts.push(`[${inputIdx}:a]adelay=${sfxEvent.triggerMs}|${sfxEvent.triggerMs}[a${inputIdx}]`);
      sfxInputs.push(`[a${inputIdx}]`);
    });
  }

  const musicInput = hasMusic ? (manifest.audio.sfx.length > 0 ? '[a1duck]' : '[a1]') : null;
  const mixInputs = ['[0:a]'];
  if (musicInput) {
    mixInputs.push(musicInput);
  }
  mixInputs.push(...sfxInputs);

  filterParts.push(`${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first[mix]`);
  filterParts.push(`[mix]loudnorm=I=-14:TP=-1:LRA=11[out]`);

  args.push('-filter_complex', filterParts.join(';'));
  args.push('-map', '[out]');
  args.push('-c:a', 'aac');
  args.push('-y');
  args.push(outputPath);

  return args;
}

export async function mixAudio(
  manifest: UnifiedRenderManifest,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const args = buildFfmpegArgs(manifest, outputPath);
      const ffmpeg = spawn('ffmpeg', args);

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
