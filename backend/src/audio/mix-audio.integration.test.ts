import {execFileSync} from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {fileURLToPath} from 'url';
import {afterEach, describe, expect, it} from 'vitest';
import type {UnifiedRenderManifest} from '@prometheus/shared-types';

import {mixAudio} from './mix-audio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const sfxDir = path.join(repoRoot, 'remotion-app/public/sfx');

const tempDirs: string[] = [];

const createTempDir = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prometheus-audio-'));
  tempDirs.push(tempDir);
  return tempDir;
};

const createSineSource = (outputPath: string) => {
  execFileSync('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=1.5',
    '-c:a',
    'aac',
    '-y',
    outputPath,
  ]);
};

const probeAudioCodec = (filePath: string) =>
  execFileSync('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'a:0',
    '-show_entries',
    'stream=codec_name',
    '-of',
    'default=nokey=1:noprint_wrappers=1',
    filePath,
  ]).toString('utf8').trim();

const buildManifest = (sourceAudioPath: string): UnifiedRenderManifest => ({
  version: '2.0',
  jobId: '123e4567-e89b-12d3-a456-426614174333',
  seed: 12345,
  createdAt: '2026-01-01T00:00:00.000Z',
  durationFrames: 45,
  fps: 30,
  width: 1080,
  height: 1920,
  videoTracks: [{sourcePath: '/dev-fixtures/test-video.mp4', startFrame: 0, endFrame: 44}],
  cameraMoves: [],
  textOverlays: [],
  transitions: [],
  source: {
    videoUrl: '/dev-fixtures/test-video.mp4',
    audioUrl: sourceAudioPath,
    transcript: [],
    durationMs: 1500,
    width: 1280,
    height: 720,
    fps: 30,
  },
  audio: {
    beats: [500, 1000],
    onsets: [0, 1000],
    sfx: [{
      id: 'sfx-1',
      cue: 'whoosh_fast',
      variant: 1,
      triggerMs: 250,
      durationMs: 300,
      volumeDb: -9,
      duckMusicDb: -6,
    }],
    voiceVolumeDb: 0,
    musicVolumeDb: -18,
    targetLufs: -14,
  },
  timeline: [],
  creativeProfile: {
    name: 'joseph_cinematic',
    cutDensity: 0.5,
    textDensity: 0.5,
    sfxDensity: 0.5,
    cameraAggression: 0.4,
    colorIntensity: 0.4,
  },
  output: {
    width: 1080,
    height: 1920,
    fps: 30,
    codec: 'h264',
    crf: 18,
  },
});

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();
    if (tempDir) {
      fs.rmSync(tempDir, {recursive: true, force: true});
    }
  }
});

describe('mixAudio integration', () => {
  it('produces a nonzero AAC file from a local source and real SFX asset', async () => {
    const tempDir = createTempDir();
    const sourceAudioPath = path.join(tempDir, 'voice.m4a');
    const outputPath = path.join(tempDir, 'mixed.m4a');
    createSineSource(sourceAudioPath);

    await mixAudio(buildManifest(sourceAudioPath), outputPath, {sfxDir, tempDir});

    expect(fs.statSync(outputPath).size).toBeGreaterThan(1000);
    expect(probeAudioCodec(outputPath)).toBe('aac');
  }, 30000);
});
