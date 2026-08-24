import type {UnifiedRenderManifest} from '@prometheus/shared-types';

/**
 * 16:9 landscape defaults for the JosephLandscapeEdit composition.
 * Mirrors joseph-default-manifest.ts but on the LANDSCAPE_CANVAS geometry
 * (1920x1080). JosephEdit (9:16) is kept intact.
 */

export const LANDSCAPE_RENDER_WIDTH = 1920;
export const LANDSCAPE_RENDER_HEIGHT = 1080;
export const LANDSCAPE_RENDER_FPS = 30;

export const DEFAULT_LANDSCAPE_MANIFEST: UnifiedRenderManifest = {
  version: '2.0',
  jobId: 'c7a3f29e-4b8d-4f6e-9c1a-2d5e8b7f3a6c',
  seed: 24680,
  createdAt: '2026-01-01T00:00:00.000Z',
  durationFrames: 300,
  fps: LANDSCAPE_RENDER_FPS,
  width: LANDSCAPE_RENDER_WIDTH,
  height: LANDSCAPE_RENDER_HEIGHT,
  videoTracks: [{sourcePath: '/dev-fixtures/test-video.mp4', startFrame: 0, endFrame: 299}],
  cameraMoves: [],
  textOverlays: [
    {
      text: 'PROMETHEUS LANDSCAPE',
      startFrame: 12,
      endFrame: 72,
      animation: 'pop',
      color: '#FFFFFF',
    },
  ],
  transitions: [],
  typography: {
    fontId: 'hero-berylium-regular',
    fontFamily: 'PrometheusHeroBerylium',
    fontAssetUrl: '/fonts/hero/berylium-rg-67d7e31492fa.otf',
    fallbackFamily: 'Arial, sans-serif',
  },
  source: {
    videoUrl: '/dev-fixtures/test-video.mp4',
    audioUrl: '/dev-fixtures/test-video.mp4',
    transcript: [{text: 'Prometheus landscape', startMs: 0, endMs: 1200}],
    durationMs: 10000,
    width: LANDSCAPE_RENDER_WIDTH,
    height: LANDSCAPE_RENDER_HEIGHT,
    fps: LANDSCAPE_RENDER_FPS,
  },
  audio: {
    beats: [500, 1000, 1500],
    onsets: [0, 1000],
    sfx: [],
    voiceVolumeDb: 0,
    musicVolumeDb: -18,
    targetLufs: -14,
  },
  timeline: [],
  creativeProfile: {
    name: 'joseph_cinematic',
    cutDensity: 0.5,
    textDensity: 0.5,
    sfxDensity: 0.2,
    cameraAggression: 0.4,
    colorIntensity: 0.5,
  },
  output: {
    width: LANDSCAPE_RENDER_WIDTH,
    height: LANDSCAPE_RENDER_HEIGHT,
    fps: LANDSCAPE_RENDER_FPS,
    codec: 'h264',
    crf: 18,
  },
};
