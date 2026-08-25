/**
 * Landscape-to-Unified bridge.
 *
 * Maps a `LandscapeTreatmentManifest` (docs/mini_landscape_runs causal chain)
 * onto the renderer-independent `UnifiedRenderManifest` consumed by the
 * Joseph WebGL scene graph. This is what lets the landscape studio reuse the
 * entire existing render spine (bundle -> selectComposition -> silent frames ->
 * h264_nvenc -> mixAudio -> AAC mux) without touching JosephEdit's contracts.
 *
 * Fidelity notes (read before trusting the output):
 *  - The landscape manifest carries NO source transcript words, so textOverlays
 *    are DERIVED captions from a moveId->label map, and source.transcript is
 *    intentionally empty. Swap in real transcript words when available.
 *  - sfx family -> locked cue mapping is the fragile seam. Every mapped cue gets
 *    a deterministic variant (1..5) because the sfx corpus only ships named
 *    files (whoosh_fast_1.mp3 etc.), not bare cue names.
 *  - The real voice track is resolved to out/src_track.wav when present
 *    (hum-free by construction: frames render muted, audio is mixed later).
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  UnifiedRenderManifestSchema,
  type CameraMove,
  type SFXEvent,
  type TextOverlay,
  type TimelineEvent,
  type Transition,
  type UnifiedRenderManifest,
  type VideoTrack,
} from '@prometheus/shared-types';

import {LANDSCAPE_CANVAS, type EditMove, type LandscapeTreatmentManifest, type SfxCue} from './types.js';

export const LANDSCAPE_FPS = 30;
export const LANDSCAPE_CUES = [
  'whoosh_fast',
  'whoosh_slow',
  'impact_deep',
  'impact_sharp',
  'riser_short',
  'sub_drop',
  'glitch_digital',
  'pop_text',
] as const;

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** Real voice track already extracted from the source media (48 kHz wav). */
const DEFAULT_AUDIO_TRACK = path.join(HERE, 'out', 'src_track.wav');
/** Browser-safe placeholder source for Studio/preview renders. */
const DEFAULT_VIDEO_URL = '/dev-fixtures/test-video.mp4';

export interface LandscapeToUnifiedOptions {
  /** Browser-safe source media URL for the composition's VideoPlane. */
  videoUrl?: string;
  /** Absolute local audio file used by mixAudio (defaults to out/src_track.wav). */
  audioUrl?: string;
  fps?: number;
  jobId?: string;
  seed?: number;
  createdAt?: string;
  typography?: UnifiedRenderManifest['typography'];
}

/* ------------------------------------------------------------------ *
 * sfx family -> locked cue (THE fragile seam). Kept here so it can be
 * audited in one place and driven by tests.
 * ------------------------------------------------------------------ */
export function mapSfxFamilyToCue(cue: SfxCue): SFXEvent['cue'] {
  switch (cue.family) {
    case 'whoosh':
      return cue.durationSec >= 0.5 ? 'whoosh_slow' : 'whoosh_fast';
    case 'impact':
      return cue.durationSec > 0.5 ? 'impact_deep' : 'impact_sharp';
    case 'riser':
      return 'riser_short';
    case 'click':
      return 'pop_text';
    case 'ui':
      return 'pop_text';
    case 'shutter':
      return 'impact_sharp';
    case 'gear':
      return 'glitch_digital';
    case 'telemetry':
      return 'glitch_digital';
    case 'none':
      return 'pop_text';
  }
}

/** Deterministic variant 1..5 so resolveSfxPath can find `${cue}_N.mp3`. */
export function variantForId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (hash % 5) + 1;
}

/** 'none' / intentional omissions drop out of the mix entirely. */
export function isRenderableSfxCue(cue: SfxCue): boolean {
  return !cue.intentionalOmission && cue.family !== 'none';
}

export function mapSfxCueToSfxEvent(cue: SfxCue, fps = LANDSCAPE_FPS): SFXEvent | null {
  if (!isRenderableSfxCue(cue)) {
    return null;
  }
  return {
    id: `landscape-sfx-${cue.id}`,
    cue: mapSfxFamilyToCue(cue),
    variant: variantForId(cue.id),
    triggerMs: Math.round(cue.timeSec * 1000),
    durationMs: Math.max(300, Math.round(cue.durationSec * 1000)),
    volumeDb: cue.gainDb,
    duckMusicDb: -6,
  };
}

/* ------------------------------------------------------------------ *
 * editMoves -> cameraMoves (fatigue_relief / momentum_death are
 * intentional no-camera windows).
 * ------------------------------------------------------------------ */
export const MOVE_TO_CAMERA_MOVE: Partial<Record<EditMove['moveId'], CameraMove['type']>> = {
  emphasize_keyword: 'push_in',
  return_to_authority: 'push_in',
  explain_workflow: 'push_in',
  value_contrast: 'push_in',
  cta_pressure: 'push_in',
  focus_handoff: 'dutch',
  proof_insert: 'shake',
  thesis_punctuation: 'shake',
};

export function mapEditMoveToCameraMove(move: EditMove, fps = LANDSCAPE_FPS): CameraMove | null {
  const type = MOVE_TO_CAMERA_MOVE[move.moveId];
  if (!type) {
    return null;
  }
  return {
    type,
    startFrame: Math.round(move.startSec * fps),
    endFrame: Math.round(move.endSec * fps),
  };
}

import { generateLandscapeTypographyPlan } from './landscape_typography_engine.js';
import type { LandscapeTypographyPlan } from './landscape_typography_engine.js';

/* ------------------------------------------------------------------ *
 * typographyCueMoveIds -> generative dynamic typography overlays.
 * Uses full font corpus access (all 77+ profiles) and generative treatment selector.
 * ------------------------------------------------------------------ */
export function buildTextOverlays(input: LandscapeTreatmentManifest, fps = LANDSCAPE_FPS): TextOverlay[] {
  if (input.typographyPlan?.textOverlays && input.typographyPlan.textOverlays.length > 0) {
    return input.typographyPlan.textOverlays;
  }
  const plan = generateLandscapeTypographyPlan(
    input.sections,
    input.editMoves,
    input.typographyCueMoveIds,
    fps,
  );
  return plan.textOverlays;
}


/* ------------------------------------------------------------------ *
 * transitions -> frame windows (0.5s centered on the beat). 'none' skipped.
 * ------------------------------------------------------------------ */
export function mapTransitionsToFrames(
  input: LandscapeTreatmentManifest,
  fps = LANDSCAPE_FPS,
): Transition[] {
  const transitions: Transition[] = [];
  for (const t of input.transitions) {
    if (t.effectId === 'none') {
      continue;
    }
    const center = Math.round(t.timeSec * fps);
    const half = Math.round(0.25 * fps);
    transitions.push({
      startFrame: Math.max(0, center - half),
      endFrame: center + half,
    });
  }
  return transitions;
}

/* ------------------------------------------------------------------ *
 * timeline events (text / camera / transition) for tooling + audit.
 * ------------------------------------------------------------------ */
export function buildTimelineEvents(input: LandscapeTreatmentManifest, fps = LANDSCAPE_FPS): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const move of input.editMoves) {
    const camera = MOVE_TO_CAMERA_MOVE[move.moveId];
    if (camera) {
      events.push({
        type: 'camera',
        move: camera === 'shake' ? 'handheld_shake' : camera === 'dutch' ? 'dutch_right' : 'push_in',
        startMs: Math.round(move.startSec * 1000),
        endMs: Math.round(move.endSec * 1000),
        intensity: Math.min(1, Math.max(0.25, move.priority)),
        curve: 'ease_out',
      });
    }
  }

  for (const overlay of buildTextOverlays(input, fps)) {
    events.push({
      type: 'text',
      word: overlay.text,
      startMs: Math.round((overlay.startFrame / fps) * 1000),
      endMs: Math.round((overlay.endFrame / fps) * 1000),
      style: overlay.animation,
      color: overlay.color,
      position: {x: 0.5, y: 0.12, z: 0.1},
      scale: 1,
      cameraPush: 0,
      shake: 0,
    });
  }

  for (const t of input.transitions) {
    if (t.effectId === 'none') {
      continue;
    }
    // Unified renderer style per landscape effect (TRN-05 cinematic tier
    // included). Existing style tokens only — never introduces unknown tokens.
    const UNIFIED_TRANSITION_STYLE: Record<string, string> = {
      hot_burn: 'glitch_flash',
      light_burn: 'glitch_flash',
      edge_glow_bloom: 'glitch_flash',
      lens_flare_bleed: 'zoom_blur',
      defocus_bokeh: 'zoom_blur',
      match_cut: 'zoom_blur',
      push_in_zoom: 'zoom_blur',
      camera_pass_by: 'zoom_blur',
      light_leak: 'zoom_blur',
      soft_flash: 'zoom_blur',
      hard_flash: 'zoom_blur',
      light_sweep: 'zoom_blur',
      luma_wash: 'zoom_blur',
    };
    events.push({
      type: 'transition',
      style: UNIFIED_TRANSITION_STYLE[t.effectId] ?? 'zoom_blur',
      atMs: Math.round(t.timeSec * 1000),
      durationMs: 400,
      intensity: 0.7,
    });
  }

  events.sort((a, b) => {
    const aMs = 'atMs' in a ? (a as {atMs: number}).atMs : (a as {startMs: number}).startMs;
    const bMs = 'atMs' in b ? (b as {atMs: number}).atMs : (b as {startMs: number}).startMs;
    return aMs - bMs;
  });
  return events;
}

/* ------------------------------------------------------------------ *
 * Top-level bridge.
 * ------------------------------------------------------------------ */
export function landscapeTreatmentToUnifiedManifest(
  input: LandscapeTreatmentManifest,
  options: LandscapeToUnifiedOptions = {},
): UnifiedRenderManifest {
  const fps = options.fps ?? LANDSCAPE_FPS;
  const width = input.canvas.width ?? LANDSCAPE_CANVAS.width;
  const height = input.canvas.height ?? LANDSCAPE_CANVAS.height;
  const durationSec = input.silenceCut.outputDurationSec;
  const durationFrames = Math.max(1, Math.round(durationSec * fps));
  const lastFrame = durationFrames - 1;

  const cameraMoves = input.editMoves
    .map((move) => mapEditMoveToCameraMove(move, fps))
    .filter((c): c is CameraMove => c !== null)
    .map((c) => ({
      ...c,
      startFrame: Math.min(c.startFrame, lastFrame - 1),
      endFrame: Math.min(c.endFrame, lastFrame),
    }));

  const textOverlays = buildTextOverlays(input, fps).map((o) => ({
    ...o,
    startFrame: Math.min(o.startFrame, lastFrame - 1),
    endFrame: Math.min(o.endFrame, lastFrame),
  }));

  const transitions = mapTransitionsToFrames(input, fps).map((t) => ({
    ...t,
    startFrame: Math.min(t.startFrame, lastFrame - 1),
    endFrame: Math.min(t.endFrame, lastFrame),
  }));

  const sfx = input.sfxCues
    .map((cue) => mapSfxCueToSfxEvent(cue, fps))
    .filter((s): s is SFXEvent => s !== null)
    .sort((a, b) => a.triggerMs - b.triggerMs);

  const audioUrl =
    options.audioUrl ??
    (fs.existsSync(DEFAULT_AUDIO_TRACK) ? DEFAULT_AUDIO_TRACK : input.silenceCut.sourcePath);
  const videoUrl = options.videoUrl ?? DEFAULT_VIDEO_URL;

  const videoTracks: VideoTrack[] = [{sourcePath: videoUrl, startFrame: 0, endFrame: lastFrame}];

  const sfxDensity = Math.min(1, sfx.length / Math.max(1, Math.round(durationFrames / (10 * fps))));
  const textDensity = Math.min(1, textOverlays.length / Math.max(1, Math.round(durationFrames / (60 * fps))));

  const result: UnifiedRenderManifest = {
    version: '2.0',
    jobId: options.jobId ?? '11111111-1111-4111-8111-111111111111',
    seed: options.seed ?? Math.floor(Math.random() * 2 ** 31),
    createdAt: options.createdAt ?? input.generatedAtIso ?? new Date().toISOString(),
    durationFrames,
    fps,
    width,
    height,
    videoTracks,
    cameraMoves,
    textOverlays,
    transitions,
    typography: options.typography ?? {
      fontId: 'hero-berylium-regular',
      fontFamily: 'PrometheusHeroBerylium',
      fontAssetUrl: '/fonts/hero/berylium-rg-67d7e31492fa.otf',
      fallbackFamily: 'Arial, sans-serif',
    },
    source: {
      videoUrl,
      audioUrl,
      transcript: [],
      durationMs: Math.round(durationSec * 1000),
      width,
      height,
      fps,
    },
    audio: {
      beats: [],
      onsets: [],
      sfx,
      voiceVolumeDb: 0,
      musicVolumeDb: -18,
      targetLufs: input.soundtrack.integratedTargetLufs ?? -14,
    },
    timeline: buildTimelineEvents(input, fps),
    creativeProfile: {
      name: 'joseph_cinematic',
      cutDensity: 0.5,
      textDensity,
      sfxDensity,
      cameraAggression: 0.4,
      colorIntensity: 0.5,
    },
    output: {
      width,
      height,
      fps,
      codec: 'h264',
      crf: 18,
    },
  };

  // Fail fast: the output must satisfy the exact render spine contract.
  return UnifiedRenderManifestSchema.parse(result);
}
