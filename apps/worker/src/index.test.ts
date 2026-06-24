import {beforeEach, describe, expect, it, vi} from 'vitest';
import {renderFromManifest, RenderError, MuxError, ValidationError} from './index.js';
import {UnifiedRenderManifest} from '@prometheus/shared-types';
import * as fs from 'fs';
import * as child_process from 'child_process';
import * as path from 'path';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {mixAudio} from '@prometheus/backend';

vi.mock('fs');
vi.mock('child_process');
vi.mock('@remotion/renderer', () => ({
  renderMedia: vi.fn(),
  selectComposition: vi.fn(),
}));
vi.mock('@remotion/bundler', () => ({
  bundle: vi.fn(),
}));
vi.mock('@prometheus/backend', () => ({
  mixAudio: vi.fn(),
}));

describe('renderFromManifest', () => {
  let mockManifest: UnifiedRenderManifest;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(bundle).mockResolvedValue('mock-serve-url');
    vi.mocked(selectComposition).mockResolvedValue({
      id: 'JosephEdit',
      width: 1080,
      height: 1920,
      fps: 30,
      durationInFrames: 300,
      defaultProps: {},
      props: {},
      calculateMetadata: null,
      folderName: null,
      nonce: 0,
    } as any);
    vi.mocked(renderMedia).mockResolvedValue({
      buffer: null,
      contentType: 'video/mp4',
      slowestFrames: [],
    });
    vi.mocked(mixAudio).mockResolvedValue(undefined);

    mockManifest = {
      version: '2.0',
      jobId: '123e4567-e89b-12d3-a456-426614174000',
      seed: 12345,
      createdAt: '2026-01-01T00:00:00.000Z',
      durationFrames: 300,
      fps: 30,
      width: 1080,
      height: 1920,
      videoTracks: [{sourcePath: '/uploads/job-1/video.mp4', startFrame: 0, endFrame: 299}],
      cameraMoves: [],
      textOverlays: [],
      transitions: [],
      source: {
        videoUrl: '/uploads/job-1/video.mp4',
        audioUrl: 'C:/prometheus/uploads/job-1/video.mp4',
        transcript: [],
        durationMs: 10000,
        width: 1920,
        height: 1080,
        fps: 30,
      },
      audio: {
        beats: [],
        onsets: [],
        sfx: [],
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
        width: 1080,
        height: 1920,
        fps: 30,
        codec: 'h264',
        crf: 18,
      },
    };

    vi.mocked(fs.existsSync).mockImplementation((target: any) => !String(target).endsWith('chrome.exe'));
    vi.mocked(fs.unlinkSync).mockReturnValue(undefined as any);
  });

  it('validates manifest with Zod', async () => {
    const invalidManifest = {...mockManifest, jobId: undefined} as any;
    await expect(renderFromManifest(invalidManifest)).rejects.toThrow(ValidationError);
  });

  it('renders silent video and mixes audio with the Windows software GL path', async () => {
    const mockChildProcess = {
      stderr: {on: vi.fn()},
      on: vi.fn((event, cb) => {
        if (event === 'close') cb(0);
      }),
    };
    vi.mocked(child_process.spawn).mockReturnValue(mockChildProcess as any);

    const finalPath = await renderFromManifest(mockManifest);

    expect(bundle).toHaveBeenCalled();
    const bundleArg = vi.mocked(bundle).mock.calls[0]?.[0];
    expect(bundleArg).toEqual(expect.objectContaining({entryPoint: expect.any(String)}));
    const entryPoint = typeof bundleArg === 'object' && bundleArg !== null && 'entryPoint' in bundleArg
      ? String(bundleArg.entryPoint)
      : '';
    expect(entryPoint).toMatch(/remotion-app[\\/]src[\\/]entries[\\/]joseph-entry\.tsx$/);
    expect(selectComposition).toHaveBeenCalledWith(expect.objectContaining({
      serveUrl: 'mock-serve-url',
      id: 'JosephEdit',
      inputProps: {manifest: mockManifest},
      gl: 'swangle',
    }));
    expect(renderMedia).toHaveBeenCalledWith(expect.objectContaining({
      composition: expect.objectContaining({id: 'JosephEdit'}),
      serveUrl: 'mock-serve-url',
      inputProps: {manifest: mockManifest},
      outputLocation: expect.stringContaining('_silent.mp4'),
      codec: 'h264',
      width: 1080,
      height: 1920,
      concurrency: 1,
      timeoutInMilliseconds: 300000,
      gl: 'swangle',
      hardwareAcceleration: 'disable',
      onProgress: expect.any(Function),
    }));
    expect(mixAudio).toHaveBeenCalledWith(
      mockManifest,
      expect.stringContaining('_audio.m4a'),
      expect.objectContaining({
        sfxDir: expect.stringMatching(/remotion-app[\\/]public[\\/]sfx$/),
        tempDir: expect.any(String),
      }),
    );
    expect(child_process.spawn).toHaveBeenCalled();
    expect(finalPath).toContain('123e4567-e89b-12d3-a456-426614174000_final.mp4');
  });
  it('removes the downloaded source video after a successful mux', async () => {
    const mockChildProcess = {
      stderr: {on: vi.fn()},
      on: vi.fn((event, cb) => {
        if (event === 'close') cb(0);
      }),
    };
    vi.mocked(child_process.spawn).mockReturnValue(mockChildProcess as any);
    const sourceVideoPath = path.resolve('/mock/tmp/source-video.mp4');

    await renderFromManifest(mockManifest, {sourceVideoPath});

    expect(fs.unlinkSync).toHaveBeenCalledWith(sourceVideoPath);
  });

  it('fails loudly when Joseph composition metadata does not match the manifest dimensions', async () => {
    vi.mocked(selectComposition).mockResolvedValue({
      id: 'JosephEdit',
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 300,
      defaultProps: {},
      props: {},
      calculateMetadata: null,
      folderName: null,
      nonce: 0,
    } as any);

    await expect(renderFromManifest(mockManifest)).rejects.toThrow(ValidationError);
    await expect(renderFromManifest(mockManifest)).rejects.toThrow(/composition metadata.*1080x1920/i);
    expect(renderMedia).not.toHaveBeenCalled();
  });

  it('rejects non-vertical Joseph manifests before bundling', async () => {
    await expect(renderFromManifest({
      ...mockManifest,
      width: 1920,
      height: 1080,
      output: {
        ...mockManifest.output,
        width: 1920,
        height: 1080,
      },
    })).rejects.toThrow(ValidationError);
    expect(bundle).not.toHaveBeenCalled();
  });

  it('retries renderMedia on timeout', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const mockChildProcess = {
      stderr: {on: vi.fn()},
      on: vi.fn((event, cb) => {
        if (event === 'close') cb(0);
      }),
    };
    vi.mocked(child_process.spawn).mockReturnValue(mockChildProcess as any);
    vi.mocked(renderMedia)
      .mockImplementationOnce(async (options: any) => {
        options.onProgress?.({progress: 0.11, renderedFrames: 33, encodedFrames: 0});
        throw new Error('Chromium timeout while rendering');
      })
      .mockResolvedValueOnce({buffer: null, contentType: 'video/mp4', slowestFrames: []} as any);

    await renderFromManifest(mockManifest);

    expect(renderMedia).toHaveBeenCalledTimes(2);
    expect(vi.mocked(renderMedia).mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      timeoutInMilliseconds: 600000,
      concurrency: 1,
      gl: 'swangle',
      hardwareAcceleration: 'disable',
    }));
    expect(consoleSpy).toHaveBeenCalledWith('[Worker] Render progress: 10%');
    consoleSpy.mockRestore();
  });

  it('throws RenderError on non-retryable Remotion failure', async () => {
    vi.mocked(renderMedia).mockRejectedValue(new Error('shader compile failed'));

    await expect(renderFromManifest(mockManifest)).rejects.toThrow(RenderError);
    await expect(renderFromManifest(mockManifest)).rejects.toThrow('Remotion renderMedia failed for job 123e4567-e89b-12d3-a456-426614174000');
  });

  it('throws MuxError on FFmpeg failure', async () => {
    const mockChildProcess = {
      stderr: {on: vi.fn((event, cb) => cb('ffmpeg output error'))},
      on: vi.fn((event, cb) => {
        if (event === 'close') cb(1);
      }),
    };
    vi.mocked(child_process.spawn).mockReturnValue(mockChildProcess as any);

    await expect(renderFromManifest(mockManifest)).rejects.toThrow(MuxError);
  });
});
