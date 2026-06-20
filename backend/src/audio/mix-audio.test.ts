import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AudioMixError, buildFfmpegArgs, mixAudio, SFXNotFoundError} from './mix-audio';
import * as fs from 'fs';
import * as child_process from 'child_process';
import {UnifiedRenderManifest} from '@prometheus/shared-types';

vi.mock('fs');
vi.mock('child_process');

describe('mixAudio', () => {
  let mockManifest: UnifiedRenderManifest;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SFX_DIR = '/mock/sfx/dir';

    mockManifest = {
      version: '2.0',
      jobId: '123e4567-e89b-12d3-a456-426614174000',
      seed: 12345,
      createdAt: '2026-01-01T00:00:00.000Z',
      durationFrames: 300,
      fps: 30,
      width: 1920,
      height: 1080,
      videoTracks: [{sourcePath: 'http://example.com/video.mp4', startFrame: 0, endFrame: 299}],
      cameraMoves: [],
      textOverlays: [],
      transitions: [],
      source: {
        videoUrl: 'http://example.com/video.mp4',
        audioUrl: 'http://example.com/voice.wav',
        transcript: [
          {text: 'Listen', startMs: 420, endMs: 680, confidence: 0.98},
          {text: 'now', startMs: 920, endMs: 1180, confidence: 0.95},
        ],
        durationMs: 10000,
        width: 1920,
        height: 1080,
        fps: 30,
      },
      audio: {
        beats: [],
        onsets: [],
        sfx: [],
        musicTrackUrl: 'http://example.com/music.mp3',
        voiceVolumeDb: 0,
        musicVolumeDb: -18,
        targetLufs: -14,
      },
      timeline: [],
      creativeProfile: {
        name: 'joseph_aggressive',
        cutDensity: 1,
        textDensity: 1,
        sfxDensity: 1,
        cameraAggression: 1,
        colorIntensity: 1,
      },
      output: {
        width: 1920,
        height: 1080,
        fps: 30,
        codec: 'h264',
        crf: 18,
      },
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it('generates correct filter_complex for voice + music only', () => {
    const args = buildFfmpegArgs(mockManifest, 'out.mp4');

    const filterComplex = args[args.indexOf('-filter_complex') + 1];
    expect(args).toContain('http://example.com/music.mp3');
    expect(filterComplex).toContain('loudnorm=I=-14');
    expect(filterComplex).toMatch(/sidechaincompress|volume='/);
  });

  it('applies music ducking during voice', () => {
    const args = buildFfmpegArgs(mockManifest, 'out.mp4');
    const filterComplex = args[args.indexOf('-filter_complex') + 1];

    expect(filterComplex).toMatch(/sidechaincompress|volume='/);
    expect(filterComplex).toContain('0.42');
    expect(filterComplex).toContain('0.68');
  });

  it('applies SFX ducking', () => {
    mockManifest.audio.sfx = [
      {id: '1', cue: 'whoosh_fast', triggerMs: 500, durationMs: 300, volumeDb: -12, duckMusicDb: -6},
      {id: '2', cue: 'impact_deep', triggerMs: 1500, durationMs: 300, volumeDb: -12, duckMusicDb: -9},
    ];
    const args = buildFfmpegArgs(mockManifest, 'out.mp4');

    const filterComplex = args[args.indexOf('-filter_complex') + 1];
    expect(filterComplex).toContain('adelay=500|500');
    expect(filterComplex).toContain('adelay=1500|1500');
    expect(filterComplex).toMatch(/-24|-27|duckMusicDb|between\(t,0\.5,0\.8\)/);
  });

  it('throws SFXNotFoundError for missing cue', () => {
    mockManifest.audio.sfx = [
      {id: '1', cue: 'whoosh_fast', triggerMs: 500, durationMs: 300, volumeDb: -12, duckMusicDb: -6},
    ];
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(() => buildFfmpegArgs(mockManifest, 'out.mp4')).toThrow(SFXNotFoundError);
  });

  it('throws AudioMixError on FFmpeg failure', async () => {
    const mockChildProcess = {
      stderr: {on: vi.fn((event, cb) => cb('ffmpeg error output'))},
      on: vi.fn((event, cb) => {
        if (event === 'close') cb(1);
      }),
    };
    vi.mocked(child_process.spawn).mockReturnValue(mockChildProcess as any);

    await expect(mixAudio(mockManifest, 'out.mp4')).rejects.toThrow(AudioMixError);
    await expect(mixAudio(mockManifest, 'out.mp4')).rejects.toThrow('FFmpeg exited with code 1');
  });
});
