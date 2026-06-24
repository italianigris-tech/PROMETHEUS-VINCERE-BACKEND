import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AudioMixError, buildFfmpegArgs, mixAudio, resolveSfxPath, sanitizeForFFmpeg, SFXNotFoundError} from './mix-audio';
import * as fs from 'fs';
import * as child_process from 'child_process';
import * as path from 'path';
import {UnifiedRenderManifest} from '@prometheus/shared-types';

vi.mock('fs');
vi.mock('child_process');

describe('mixAudio', () => {
  let mockManifest: UnifiedRenderManifest;
  let mixOptions: {sfxDir: string; tempDir: string};
  const sfx = (variant: number) => ({
    id: '1',
    cue: 'whoosh_fast' as const,
    variant,
    triggerMs: 500,
    durationMs: 250,
    volumeDb: -12,
    duckMusicDb: -6,
  });

  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.SFX_DIR;
    mixOptions = {
      sfxDir: path.resolve('/mock/sfx/dir'),
      tempDir: path.resolve('/mock/tmp'),
    };

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
        audioUrl: path.resolve('/mock/media/voice.wav'),
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
        musicTrackUrl: path.resolve('/mock/media/music.mp3'),
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
    vi.mocked(fs.statSync).mockReturnValue({size: 1024} as fs.Stats);
  });

  it('generates correct filter_complex for voice + music only', () => {
    const args = buildFfmpegArgs(mockManifest, 'out.mp4', mixOptions);

    const filterComplex = args[args.indexOf('-filter_complex') + 1];
    expect(args).toContain(path.resolve('/mock/media/music.mp3'));
    expect(filterComplex).toContain('loudnorm=I=-14');
    expect(filterComplex).toMatch(/sidechaincompress|volume='/);
  });

  it('applies music ducking during voice', () => {
    const args = buildFfmpegArgs(mockManifest, 'out.mp4', mixOptions);
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
    const args = buildFfmpegArgs(mockManifest, 'out.mp4', mixOptions);

    const filterComplex = args[args.indexOf('-filter_complex') + 1];
    expect(filterComplex).toContain('adelay=500|500');
    expect(filterComplex).toContain('adelay=1500|1500');
    expect(filterComplex).toMatch(/-24|-27|duckMusicDb|between\(t,0\.5,0\.8\)/);
  });

  it('applies each SFX cue volume before mixing', () => {
    mockManifest.audio.musicTrackUrl = undefined;
    mockManifest.audio.sfx = [
      {id: '1', cue: 'whoosh_fast', variant: 2, triggerMs: 500, durationMs: 300, volumeDb: -9, duckMusicDb: -6},
    ];
    vi.mocked(fs.existsSync).mockImplementation((candidate) => {
      const normalized = String(candidate).replace(/\\/g, '/');
      return normalized.endsWith('whoosh_fast_2.mp3') || normalized.includes('/mock/');
    });

    const args = buildFfmpegArgs(mockManifest, 'out.m4a', mixOptions);
    const filterComplex = args[args.indexOf('-filter_complex') + 1];

    expect(filterComplex).toContain('volume=-9dB,adelay=500|500');
  });

  it('requires an explicit absolute SFX directory instead of process cwd or env fallback', () => {
    mockManifest.audio.sfx = [
      {id: '1', cue: 'whoosh_fast', triggerMs: 500, durationMs: 300, volumeDb: -12, duckMusicDb: -6},
    ];

    expect(() => buildFfmpegArgs(mockManifest, 'out.mp4', {...mixOptions, sfxDir: ''}))
      .toThrow(AudioMixError);
    expect(() => buildFfmpegArgs(mockManifest, 'out.mp4', {...mixOptions, sfxDir: 'relative/sfx'}))
      .toThrow(AudioMixError);
  });

  it('requires an FFmpeg-safe local source audio path', () => {
    mockManifest.source.audioUrl = '/uploads/browser-only.mp4';

    expect(() => buildFfmpegArgs(mockManifest, 'out.mp4', mixOptions))
      .toThrow(AudioMixError);
  });

  it('throws SFXNotFoundError for missing cue', () => {
    mockManifest.audio.musicTrackUrl = undefined;
    mockManifest.audio.sfx = [
      {id: '1', cue: 'whoosh_fast', triggerMs: 500, durationMs: 300, volumeDb: -12, duckMusicDb: -6},
    ];
    vi.mocked(fs.existsSync).mockImplementation((candidate) => {
      const normalized = String(candidate).replace(/\\/g, '/');
      return normalized.includes('/mock/') && !normalized.endsWith('.mp3');
    });

    expect(() => buildFfmpegArgs(mockManifest, 'out.mp4', mixOptions)).toThrow(SFXNotFoundError);
  });

  it('resolves seeded SFX variant files when variant metadata is present', () => {
    vi.mocked(fs.existsSync).mockImplementation((candidate) => String(candidate).endsWith('whoosh_fast_3.mp3'));

    const resolved = resolveSfxPath('/mock/sfx/dir', sfx(3));

    expect(path.basename(resolved)).toBe('whoosh_fast_3.mp3');
  });

  it('falls back to variant 1 when the selected SFX variant is missing', () => {
    vi.mocked(fs.existsSync).mockImplementation((candidate) => String(candidate).endsWith('whoosh_fast_1.mp3'));

    const resolved = resolveSfxPath('/mock/sfx/dir', sfx(4));

    expect(path.basename(resolved)).toBe('whoosh_fast_1.mp3');
  });

  it('treats zero-byte SFX files as missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({size: 0} as fs.Stats);

    expect(() => resolveSfxPath('/mock/sfx/dir', sfx(3)))
      .toThrow(SFXNotFoundError);
  });
  it('sanitizes transcript text before it can enter FFmpeg filter construction', () => {
    expect(sanitizeForFFmpeg('don\'t (laughs); "now"')).toBe('dont laughs now');

    mockManifest.source.transcript = [
      {text: 'don\'t (laughs); "now"', startMs: 100, endMs: 400, confidence: 0.98},
    ];

    const args = buildFfmpegArgs(mockManifest, 'out.mp4', mixOptions);
    const filterComplex = args[args.indexOf('-filter_complex') + 1];
    expect(filterComplex).not.toContain('don\'t');
    expect(filterComplex).not.toContain('(laughs)');
  });

  it('throws AudioMixError on FFmpeg failure', async () => {
    const mockChildProcess = {
      stderr: {on: vi.fn((event, cb) => cb('ffmpeg error output'))},
      on: vi.fn((event, cb) => {
        if (event === 'close') cb(1);
      }),
    };
    vi.mocked(child_process.spawn).mockReturnValue(mockChildProcess as any);

    await expect(mixAudio(mockManifest, 'out.mp4', mixOptions)).rejects.toThrow(AudioMixError);
    await expect(mixAudio(mockManifest, 'out.mp4', mixOptions)).rejects.toThrow('FFmpeg exited with code 1');
  });
});
