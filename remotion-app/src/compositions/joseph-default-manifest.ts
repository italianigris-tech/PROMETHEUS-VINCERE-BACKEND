import type {UnifiedRenderManifest} from '@prometheus/shared-types';

export const JOSEPH_RENDER_WIDTH = 1080;
export const JOSEPH_RENDER_HEIGHT = 1920;
export const JOSEPH_RENDER_FPS = 30;

export const DEFAULT_JOSEPH_MANIFEST: UnifiedRenderManifest = {
  version: '2.0',
  jobId: '123e4567-e89b-42d3-a456-426614174111',
  seed: 12345,
  createdAt: '2026-01-01T00:00:00.000Z',
  durationFrames: 300,
  fps: JOSEPH_RENDER_FPS,
  width: JOSEPH_RENDER_WIDTH,
  height: JOSEPH_RENDER_HEIGHT,
  videoTracks: [{sourcePath: '/dev-fixtures/test-video.mp4', startFrame: 0, endFrame: 299}],
  cameraMoves: [],
  textOverlays: [{
    text: 'PROMETHEUS',
    startFrame: 12,
    endFrame: 72,
    animation: 'pop',
    color: '#FFFFFF',
  }],
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
    transcript: [{text: 'Prometheus', startMs: 0, endMs: 1200}],
    durationMs: 10000,
    width: 1920,
    height: 1080,
    fps: JOSEPH_RENDER_FPS,
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
    cutDensity: 0.6,
    textDensity: 0.6,
    sfxDensity: 0.2,
    cameraAggression: 0.5,
    colorIntensity: 0.5,
  },
  output: {
    width: JOSEPH_RENDER_WIDTH,
    height: JOSEPH_RENDER_HEIGHT,
    fps: JOSEPH_RENDER_FPS,
    codec: 'h264',
    crf: 18,
  },
};
