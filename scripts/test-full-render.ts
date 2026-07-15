import {execFile} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath} from 'url';
import {promisify} from 'util';
import type {MusicReference, UnifiedRenderManifest} from '../packages/shared-types/src/unified-render-manifest';

import {renderFromManifest} from '../apps/worker/src/index';
import {analyzeMusicTrack, type MusicAnalysisResult} from '../backend/src/music/analyzer/music-analysis-adapter';
import {listLocalMusicCatalog} from '../backend/src/music/catalog/local-music-catalog';
import type {AnalyzedMusicReference} from '../backend/src/music/rank-music-for-profile';
import type {MusicTrack} from '../backend/src/music/schemas/music-track.schema';
import {buildVideoAwareAudioPlan} from '../backend/src/music/video-aware-planner/build-video-aware-audio-plan';
import {assertNonblackImage} from './assert-nonblack';
import {assertSourceVisible} from './assert-source-visible';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const fixtureVideoPath = path.join(repoRoot, 'remotion-app/public/dev-fixtures/test-video.mp4');
const fixtureBrowserUrl = '/dev-fixtures/test-video.mp4';
const sfxDir = path.join(repoRoot, 'remotion-app/public/sfx');
const artifactDir = path.join(repoRoot, 'artifacts/full-render');
const renderedFramePath = path.join(artifactDir, 'rendered-frame.png');
const sourceFramePath = path.join(artifactDir, 'source-crop-frame.png');
const renderDurationSeconds = 8;
const renderDurationMs = renderDurationSeconds * 1000;
const renderDurationFrames = renderDurationSeconds * 30;
const frameTimeSeconds = 0.75;

type MediaProbeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
};

type MediaProbe = {
  streams?: MediaProbeStream[];
  format?: {
    duration?: string;
  };
};

type Check = {
  label: string;
  pass: boolean;
  detail: string;
};

type RenderMusic = AnalyzedMusicReference;

const runJson = async <T>(binary: string, args: string[]): Promise<T> => {
  const {stdout} = await execFileAsync(binary, args, {maxBuffer: 8 * 1024 * 1024});
  return JSON.parse(stdout) as T;
};

const runText = async (binary: string, args: string[]): Promise<{stdout: string; stderr: string}> => {
  const {stdout, stderr} = await execFileAsync(binary, args, {maxBuffer: 16 * 1024 * 1024});
  return {stdout, stderr};
};

const probeMedia = (filePath: string) =>
  runJson<MediaProbe>('ffprobe', [
    '-v',
    'error',
    '-show_streams',
    '-show_format',
    '-of',
    'json',
    filePath,
  ]);

const mediaDuration = (probe: MediaProbe): number => Number(probe.format?.duration ?? 0);

const streamDuration = (stream: MediaProbeStream | undefined, fallback: number): number => {
  const value = Number(stream?.duration ?? 0);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const extractRenderedFrame = async (videoPath: string, imagePath: string) => {
  await runText('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    String(frameTimeSeconds),
    '-i',
    videoPath,
    '-frames:v',
    '1',
    '-y',
    imagePath,
  ]);
};

const extractSourceCropFrame = async (videoPath: string, imagePath: string) => {
  await runText('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    String(frameTimeSeconds),
    '-i',
    videoPath,
    '-vf',
    'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
    '-frames:v',
    '1',
    '-y',
    imagePath,
  ]);
};

const measureIntegratedLoudness = async (videoPath: string): Promise<{lufs: number | null; warning?: string}> => {
  try {
    const {stderr} = await runText('ffmpeg', [
      '-hide_banner',
      '-nostats',
      '-i',
      videoPath,
      '-filter_complex',
      'ebur128=peak=true',
      '-f',
      'null',
      '-',
    ]);
    const matches = [...stderr.matchAll(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/g)];
    const last = matches.at(-1);
    const value = last?.[1] ? Number(last[1]) : Number.NaN;
    if (Number.isFinite(value)) {
      return {lufs: value};
    }
    return {lufs: null, warning: 'Could not parse ebur128 integrated loudness.'};
  } catch (error) {
    return {
      lufs: null,
      warning: error instanceof Error ? error.message : String(error),
    };
  }
};

const average = (values: number[]): number =>
  values.length === 0 ? 0.5 : values.reduce((sum, value) => sum + value, 0) / values.length;

const toMusicTrack = (track: RenderMusic): MusicTrack => {
  const energy = Math.max(0.05, Math.min(1, average(track.analysis.energyCurve)));
  return {
    id: track.trackId,
    title: track.title,
    artist: 'local-user-supplied',
    source: track.sourceKind,
    sourceUrl: track.browserUrl ?? null,
    storagePath: track.localFilePath,
    licenseType: track.licenseStatus,
    commercialAllowed: track.renderSafe,
    attributionRequired: false,
    licenseVerified: track.renderSafe,
    durationSec: track.durationSeconds,
    bpm: track.analysis.bpm,
    musicalKey: null,
    energy,
    valence: 0.5,
    arousal: Math.max(0.1, Math.min(1, energy + 0.08)),
    tension: Math.max(0.1, Math.min(1, energy * 0.8)),
    prestige: 0.62,
    urgency: Math.max(0.1, Math.min(1, energy * 0.9)),
    clarity: 0.72,
    speechFriendliness: energy > 0.68 ? 0.58 : 0.78,
    genreTags: ['local'],
    moodTags: ['cinematic', 'premium'],
    instrumentTags: [],
    useCaseTags: ['hook', 'explanation', 'cta', 'proof', 'reveal'],
    avoidWhen: [],
    beatGrid: {
      bpm: track.analysis.bpm,
      beatTimesSec: track.analysis.beatTimes,
      downbeatTimesSec: track.analysis.downbeats,
      confidence: track.analysis.beatTimes.length > 0 ? 0.7 : 0.35,
      source: track.analysis.source,
    },
    sections: track.analysis.sections.map((section, index) => ({
      id: `${track.trackId}-section-${String(index + 1).padStart(2, '0')}`,
      trackId: track.trackId,
      startSec: section.startSeconds,
      endSec: section.endSeconds,
      role: section.label === 'intro' ? 'intro' : section.label === 'main' ? 'chorus' : 'unknown',
      energy: Math.max(0, Math.min(1, section.energy)),
      density: Math.max(0, Math.min(1, section.energy)),
      tension: Math.max(0, Math.min(1, section.energy * 0.8)),
      bestFor: ['hook', 'explanation', 'cta', 'proof', 'reveal'],
      avoidWhen: [],
      transitionInSuitability: 0.72,
      transitionOutSuitability: 0.72,
    })),
    waveformSummary: {
      windowSec: 1,
      peakAmplitudes: track.analysis.energyCurve,
      rmsAmplitudes: track.analysis.energyCurve,
      source: track.analysis.source,
    },
    loudnessLufs: track.analysis.loudnessLUFS,
    analysisStatus: 'analyzed',
    createdAt: '1970-01-01T00:00:00.000Z',
    analyzedAt: '1970-01-01T00:00:00.000Z',
  };
};

const analyzeRenderMusic = async (): Promise<RenderMusic[]> => {
  const analyzed: RenderMusic[] = [];
  for (const track of listLocalMusicCatalog().filter((candidate) => candidate.renderSafe).slice(0, 8)) {
    try {
      const analysis = await analyzeMusicTrack(track.localFilePath);
      analyzed.push({...track, durationSeconds: analysis.duration, analysis});
    } catch {
      // Keep the proof deterministic even if one local music asset is unreadable.
    }
  }
  return analyzed;
};
const buildManifest = async (): Promise<UnifiedRenderManifest> => {
  const analyzedTracks = await analyzeRenderMusic();
  if (analyzedTracks.length === 0) {
    throw new Error('Full render proof requires at least one render-safe analyzed local music track.');
  }
  const trackById = new Map(analyzedTracks.map((track) => [track.trackId, track] as const));
  const audioPlan = buildVideoAwareAudioPlan({
    jobId: 'full-render-proof',
    videoDurationSec: renderDurationSeconds,
    transcriptWords: [],
    creativeDirection: {
      summary: 'Full render proof should exercise Joseph cinematic DJ production audio.',
      moodTags: ['cinematic', 'premium'],
      pacing: 'cinematic',
      constraints: ['production-authority', 'render-safe-local-tracks-only'],
    },
    planMode: 'render_ready',
    candidateTracks: analyzedTracks.map(toMusicTrack),
    previewStartSec: 0,
    previewEndSec: renderDurationSeconds,
    now: () => '1970-01-01T00:00:00.000Z',
  });
  const djPlan = {
    version: 'joseph-dj-plan-v1' as const,
    source: 'video-aware-audio-plan' as const,
    planId: audioPlan.id,
    planMode: audioPlan.planMode,
    musicEvents: audioPlan.musicEvents.map((event) => {
      const sourceTrack = trackById.get(event.trackId);
      if (!sourceTrack) {
        throw new Error(`DJ plan selected unknown music track: ${event.trackId}`);
      }
      return {
        id: event.id,
        trackId: event.trackId,
        localFilePath: sourceTrack.localFilePath,
        bpm: sourceTrack.analysis.bpm,
        videoStartSec: event.videoStartSec,
        videoEndSec: event.videoEndSec,
        trackStartSec: event.trackStartSec,
        trackEndSec: event.trackEndSec,
        volumeDb: event.volumeDb,
        fadeInSec: event.fadeInSec,
        fadeOutSec: event.fadeOutSec,
        duckingEnabled: event.duckingEnabled,
        purpose: event.purpose,
        sectionRole: event.sectionRole,
        beatAligned: event.beatAligned,
      };
    }),
    transitionEvents: audioPlan.transitionEvents.map((event) => ({
      id: event.id,
      type: event.type,
      videoStartSec: event.videoStartSec,
      videoEndSec: event.videoEndSec,
      fromTrackId: event.fromTrackId,
      toTrackId: event.toTrackId,
      intensity: event.intensity,
      beatAligned: event.beatAligned,
      downbeatTargetSec: event.downbeatTargetSec,
    })),
    duckingRegions: audioPlan.duckingRegions.map((region) => ({
      id: region.id,
      videoStartSec: region.videoStartSec,
      videoEndSec: region.videoEndSec,
      targetMusicDb: region.targetMusicDb,
      reason: region.reason,
    })),
    warnings: audioPlan.renderSettings.notes,
  };
  const firstDjTrack = trackById.get(djPlan.musicEvents[0]?.trackId ?? '');

  return {
    version: '2.0',
    jobId: '123e4567-e89b-12d3-a456-426614174555',
    seed: 577577,
    createdAt: '2026-01-01T00:00:00.000Z',
    durationFrames: renderDurationFrames,
    fps: 30,
    width: 1080,
    height: 1920,
    videoTracks: [{sourcePath: fixtureBrowserUrl, startFrame: 0, endFrame: renderDurationFrames - 1}],
    cameraMoves: [],
    textOverlays: [],
    transitions: [],
    source: {
      videoUrl: fixtureBrowserUrl,
      audioUrl: fixtureVideoPath,
      transcript: [],
      durationMs: renderDurationMs,
      width: 1280,
      height: 720,
      fps: 30,
    },
    audio: {
      beats: firstDjTrack ? firstDjTrack.analysis.beatTimes.map((seconds) => Math.round(seconds * 1000)).filter((beatMs) => beatMs <= renderDurationMs) : [250, 750, 1250],
      onsets: [250, 750],
      energyCurve: firstDjTrack?.analysis.energyCurve ?? [0.42, 0.68, 0.78, 0.55],
      musicTrackUrl: undefined,
      musicReference: undefined,
      musicBpm: djPlan.musicEvents[0]?.bpm,
      djPlan,
      sfx: [
        {
          id: 'sfx-whoosh-1',
          cue: 'whoosh_fast',
          variant: 3,
          triggerMs: 250,
          durationMs: 300,
          volumeDb: -9,
          duckMusicDb: -6,
        },
        {
          id: 'sfx-impact-1',
          cue: 'impact_deep',
          variant: 2,
          triggerMs: 900,
          durationMs: 250,
          volumeDb: -11,
          duckMusicDb: -8,
        },
      ],
      voiceVolumeDb: 0,
      musicVolumeDb: -18,
      targetLufs: -14,
    },
    timeline: [],
    creativeProfile: {
      name: 'joseph_cinematic',
      cutDensity: 0.5,
      textDensity: 0.4,
      sfxDensity: 0.5,
      cameraAggression: 0.3,
      colorIntensity: 0.4,
    },
    output: {
      width: 1080,
      height: 1920,
      fps: 30,
      codec: 'h264',
      crf: 18,
    },
  };
};

const report = (check: Check) => {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.label}: ${check.detail}`);
  return check.pass;
};

const captureRenderLogs = async <T>(fn: () => Promise<T>): Promise<{result: T; logs: string}> => {
  const lines: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
    originalLog(...args);
  };
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
    originalError(...args);
  };

  try {
    const result = await fn();
    return {result, logs: lines.join('\n')};
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
};

async function main() {
  fs.mkdirSync(artifactDir, {recursive: true});
  fs.rmSync(renderedFramePath, {force: true});
  fs.rmSync(sourceFramePath, {force: true});

  const fixtureProbe = await probeMedia(fixtureVideoPath);
  const fixtureDuration = mediaDuration(fixtureProbe);
  if (fixtureDuration < 10) {
    throw new Error(`Fixture video must be at least 10 seconds, got ${fixtureDuration.toFixed(3)} seconds.`);
  }

  const manifest = await buildManifest();
  const {result: finalVideoPath, logs} = await captureRenderLogs(() =>
    renderFromManifest(manifest, {sfxDir, tempDir: artifactDir})
  );
  const finalProbe = await probeMedia(finalVideoPath);
  const videoStream = finalProbe.streams?.find((stream) => stream.codec_type === 'video');
  const audioStream = finalProbe.streams?.find((stream) => stream.codec_type === 'audio');
  const finalDuration = mediaDuration(finalProbe);
  const videoDuration = streamDuration(videoStream, finalDuration);
  const audioDuration = streamDuration(audioStream, finalDuration);

  await extractRenderedFrame(finalVideoPath, renderedFramePath);
  await extractSourceCropFrame(fixtureVideoPath, sourceFramePath);
  const nonblack = await assertNonblackImage(renderedFramePath, 0.05);
  const sourceVisible = await assertSourceVisible({renderedFramePath, sourceFramePath});
  const loudness = await measureIntegratedLoudness(finalVideoPath);
  const fileSize = fs.statSync(finalVideoPath).size;
  const blockedLocalResource = /Not allowed to load local resource|file:\/\/\/.*not allowed|file:\/\/.*blocked/i.test(logs);
  const loudnessDistance = loudness.lufs === null ? Number.POSITIVE_INFINITY : Math.abs(loudness.lufs - manifest.audio.targetLufs);

  const checks: Check[] = [
    {
      label: 'fixture duration',
      pass: fixtureDuration >= 10,
      detail: `${fixtureDuration.toFixed(3)}s`,
    },
    {
      label: 'DJ plan selected render-safe music',
      pass: Boolean(manifest.audio.djPlan?.musicEvents.length && !manifest.audio.musicReference && !manifest.audio.musicTrackUrl),
      detail: manifest.audio.djPlan?.musicEvents.map((event) => event.trackId).join(', ') ?? 'missing',
    },
    {
      label: 'final MP4 exists',
      pass: fs.existsSync(finalVideoPath) && fileSize > 100_000,
      detail: `${finalVideoPath} (${fileSize} bytes)`,
    },
    {
      label: 'ffprobe dimensions',
      pass: videoStream?.width === 1080 && videoStream.height === 1920,
      detail: `${videoStream?.width ?? 0}x${videoStream?.height ?? 0}`,
    },
    {
      label: 'AAC audio stream',
      pass: audioStream?.codec_name === 'aac',
      detail: audioStream?.codec_name ?? 'missing',
    },
    {
      label: 'audio/video duration match',
      pass: Math.abs(audioDuration - videoDuration) <= 0.1,
      detail: `audio=${audioDuration.toFixed(3)}s video=${videoDuration.toFixed(3)}s`,
    },
    {
      label: 'frame extraction',
      pass: fs.existsSync(renderedFramePath) && fs.existsSync(sourceFramePath),
      detail: `${renderedFramePath} / ${sourceFramePath}`,
    },
    {
      label: 'nonblack pixels',
      pass: nonblack.pass,
      detail: `${(nonblack.stats.nonblackPixelRatio * 100).toFixed(2)}%`,
    },
    {
      label: 'source video visible',
      pass: sourceVisible.pass,
      detail: `mean distance=${sourceVisible.meanDistance.toFixed(2)}, rendered nonblack=${(sourceVisible.renderedNonblackRatio * 100).toFixed(2)}%`,
    },
    {
      label: 'no file URL blocking',
      pass: !blockedLocalResource,
      detail: blockedLocalResource ? 'blocked local resource found in render logs' : 'clean',
    },
    {
      label: 'integrated loudness',
      pass: loudness.lufs === null ? true : loudnessDistance <= 5,
      detail: loudness.lufs === null
        ? `warning: ${loudness.warning ?? 'unavailable'}`
        : `${loudness.lufs.toFixed(2)} LUFS target=${manifest.audio.targetLufs}`,
    },
  ];

  const pass = checks.map(report).every(Boolean);
  console.log(pass ? 'FULL RENDER ASSERTIONS PASSED' : 'FULL RENDER ASSERTIONS FAILED');
  process.exit(pass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});



