/**
 * Mini Landscape Runs — shared types for the long-form / 16:9 causal pipeline.
 * All stages import from here so the causal chain stays contract-stable.
 */

export type FormKind = "short_form" | "long_form";

export type SectionRole =
  | "hook"
  | "setup"
  | "explain"
  | "demonstrate"
  | "payoff"
  | "outro";

export type EditMoveId =
  | "emphasize_keyword"
  | "return_to_authority"
  | "explain_workflow"
  | "value_contrast"
  | "cta_pressure"
  | "fatigue_relief"
  | "focus_handoff"
  | "proof_insert"
  | "thesis_punctuation"
  | "momentum_death";

export type LifecycleEvent =
  | "asset_entry"
  | "asset_exit"
  | "transition"
  | "number_lock"
  | "cta_hit"
  | "speaker_return"
  | "intentional_silence"
  | "section_boundary"
  | "video_start_fade"
  | "video_end_fade";

export type NumberAnimDirection = "up" | "down" | "digit_entry" | "none";

export type LandscapeTransitionId =
  | "light_burn"
  | "hot_burn"
  | "soft_flash"
  | "hard_flash"
  | "light_sweep"
  | "luma_wash"
  | "none";

export interface CausalRef {
  gate: LifecycleEvent | "form_decision" | "silence_cut" | "section_role" | "edit_move";
  reason: string;
  timeSec?: number;
  sectionId?: string;
  moveId?: EditMoveId;
  chunkIndex?: number;
}

export interface MediaProbe {
  path: string;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  aspect: "portrait" | "landscape" | "square" | "unknown";
}

export interface FormDecision {
  form: FormKind;
  confidence: number;
  reasons: string[];
  probe?: MediaProbe;
  promptHints: string[];
  cause: CausalRef;
}

export interface SilenceRange {
  startSec: number;
  endSec: number;
  durationSec: number;
  kind: "silence" | "speech" | "protected_pause";
}

export interface KeepSegment {
  /** Index in the keep list (0-based). */
  index: number;
  /** Source timeline start (seconds). */
  srcStartSec: number;
  /** Source timeline end (seconds). */
  srcEndSec: number;
  /** Duration kept. */
  durationSec: number;
  /** Destination timeline start after concatenation. */
  dstStartSec: number;
  /** Destination timeline end after concatenation. */
  dstEndSec: number;
  cause: CausalRef;
}

export interface SilenceCutPlan {
  sourcePath: string;
  outputPath: string | null;
  hasAudio: boolean;
  noiseDb: number;
  minSilenceSec: number;
  minKeepPauseSec: number;
  paddingSec: number;
  detectedSilences: SilenceRange[];
  keepSegments: KeepSegment[];
  sourceDurationSec: number;
  outputDurationSec: number;
  removedSec: number;
  skipSilenceCut: boolean;
  cause: CausalRef;
}

export interface LandscapeSection {
  sectionId: string;
  role: SectionRole;
  startSec: number;
  endSec: number;
  durationSec: number;
  text?: string;
  semanticWeight: number; // 0..1
  commercialPressure: number; // 0..1
  fatigueRisk: number; // 0..1
  cause: CausalRef;
}

export interface EditMove {
  moveId: EditMoveId;
  sectionId: string;
  startSec: number;
  endSec: number;
  viewerProblem: string;
  priority: number; // higher = spend more budget
  numberDirection?: NumberAnimDirection;
  allowSfx: boolean;
  allowMacroAsset: boolean;
  cause: CausalRef;
}

export interface CompositionPlacement {
  owner: "landscape_composition_director";
  placement: "behind_principal_speaker" | "foreground_callout" | "standalone" | "pip_inset";
  zIndex: 5 | 10 | 20 | 30;
  occludedByPrincipalSpeaker: boolean;
  reason: string;
}

export interface TransitionTreatment {
  sectionId: string;
  timeSec: number;
  effectId: LandscapeTransitionId;
  cause: CausalRef;
}

export interface SfxCue {
  id: string;
  timeSec: number;
  durationSec: number;
  family:
    | "whoosh"
    | "impact"
    | "riser"
    | "click"
    | "shutter"
    | "gear"
    | "ui"
    | "telemetry"
    | "none";
  label: string;
  gainDb: number;
  spatialPan: number;
  depthPlane: 10 | 20 | 30;
  /** Intentional omission is still a cue with family "none". */
  intentionalOmission: boolean;
  cause: CausalRef;
}

export interface SoundtrackSection {
  sectionIndex: number;
  startSec: number;
  endSec: number;
  role: "intro_fade" | "bed" | "outro_fade" | "emotional_insert";
  assetId: string;
  gainDb: number;
  cause: CausalRef;
}

export interface SoundtrackProgram {
  videoDurationSec: number;
  fadeInSec: number;
  fadeOutSec: number;
  totalSec: number;
  integratedTargetLufs: number;
  truePeakCeilingDb: number;
  /** Curated per-section song assignments (the crux of the song selector). */
  bedId: string;
  padId: string;
  sections: SoundtrackSection[];
  voiceDucking: { enabled: true; reductionDb: number; attackSec: number; releaseSec: number };
  /** Whether the general sound bed is deliberately empty or curated. Per studio
   *  policy the bed stays EMPTY (song selection is the crux), so this defaults
   *  to "empty". Optional for backwards compatibility with the capacity test. */
  soundBed?: "empty" | "curated";
  /** Catalog the selection was drawn from. */
  catalogSource?: string;
  /** Semantic understanding of the whole video + per-section vibe. */
  theme?: SemanticTheme;
  /** Per-section chosen songs (causally traced). */
  selections?: SongSelection[];
  /** How adjacent songs blend across section boundaries. */
  blends?: SongBlend[];
}

/**
 * SEMANTIC VIBE — the causal "semantic understanding node" over the transcript.
 *
 * This is the deliberate, causally-linked instance that reads section text +
 * the editorial weights already produced by Stage 2/3 and turns them into a
 * vibe that drives song selection. It is deterministic lexically by default;
 * callers may optionally inject an LLM-produced SemanticTheme via `source`.
 */
export interface VibeVector {
  /** Forward drive / momentum. 0..1 */
  energy: number;
  /** Rhythmic push / tempo feel. 0..1 */
  momentum: number;
  /** Warmth / intimacy. 0..1 */
  warmth: number;
  /** Analytic clarity / didactic precision. 0..1 */
  clarity: number;
  /** Conviction / urge to convince. 0..1 */
  conviction: number;
  /** Premium / prestige / luxury signal. 0..1 */
  prestige: number;
}

export interface SectionVibe extends VibeVector {
  sectionId: string;
  role: SectionRole;
  themeLabels: string[];
  semanticKeywords: string[];
}

export interface SemanticTheme {
  dominantTheme: string;
  /** Human labels: "business", "professional", "clarity", "conviction", ... */
  values: string[];
  video: VibeVector;
  perSection: SectionVibe[];
  source: "deterministic" | "llm" | "hybrid";
  cause: CausalRef;
}

/**
 * SONG TRACK — catalog entry. The selector never trusts a title alone; every
 * candidate carries a semantic fingerprint so songs can be matched to a vibe
 * and to each other (blendability).
 */
export interface SongTrack {
  id: string;
  title: string;
  artist: string;
  source: "catalog" | "seed";
  /** Browser-safe / mixer-friendly asset path (relative to repo root public/). */
  assetPath: string;
  fingerprint: VibeVector & { intensity: 1 | 2 | 3 | 4 | 5 };
  tempo?: number;       // bpm
  key?: string;         // musical key (nullable)
  hasVocals: boolean;
  /** 0..1 — how well this track sits under dialogue. */
  speechFriendliness: number;
  genreTags: string[];
  moodTags: string[];
  useCaseTags: string[];
  avoidWhen: string[];
  /** null when the track is a long-form loopable bed; set for short-form clips. */
  durationSec?: number | null;
  renderSafe: boolean;
  licenseStatus: string;
}

export interface SongSelection {
  sectionId: string;
  trackId: string;
  title: string;
  artist: string;
  score: number;
  reasons: string[];
  hasVocals: boolean;
  vibe: VibeVector;
  cause: CausalRef;
}

export type SongBlendId =
  | "none"
  | "beat_crossfade"
  | "riser_into_impact"
  | "lowpass_sweep"
  | "hard_cut";

export interface SongBlend {
  boundarySec: number;
  fromSectionId: string;
  toSectionId: string;
  fromTrackId: string;
  toTrackId: string;
  blendId: SongBlendId;
  blendScore: number;
  justification: string;
  cause: CausalRef;
}

export interface SongSelectionReport {
  videoDurationSec: number;
  selections: SongSelection[];
  blends: SongBlend[];
  catalogSource: string;
  soundBed: "empty" | "curated";
  governance: {
    allSectionsSelected: boolean;
    fatigueSafe: boolean;
    blendsOrphanFree: boolean;
    vocalsPolicyApplied: boolean;
    checks: Array<{ check: string; pass: boolean; detail: string }>;
  };
}

export interface LandscapeTreatmentManifest {
  version: "1.0.0";
  studio: "mini_landscape_runs";
  canvas: { width: number; height: number; aspect: "16:9" };
  form: FormDecision;
  silenceCut: SilenceCutPlan;
  sections: LandscapeSection[];
  editMoves: EditMove[];
  transitions: TransitionTreatment[];
  typographyCueMoveIds: string[];
  sfxCues: SfxCue[];
  soundtrack: SoundtrackProgram;
  governance: {
    policyVersion: string;
    josephAuditSources: string[];
    allCausal: boolean;
    checks: Array<{ check: string; pass: boolean; detail: string }>;
  };
  generatedAtIso: string;
}

export const LANDSCAPE_CANVAS = {
  width: 1920,
  height: 1080,
  aspect: "16:9" as const,
  safeMarginX: 0.06,
  safeMarginY: 0.08,
  speakerReturnMinSec: 1.6,
  transitionMinGapSec: 3.0,
};

export const JOSEPH_AUDIT_SOURCES = [
  "docs/audits/joseph-masterclass-feature-extraction-01.md",
  "docs/audits/joseph-cinematic-documentary-feature-extraction-02.md",
  "docs/audits/joseph-video-questions-feature-extraction-03.md",
  "docs/audits/joseph-viral-reels-premiere-feature-extraction-04.md",
  "docs/audits/joseph-viral-cinematic-reels-feature-extraction-05.md",
  "docs/joseph-five-audit-feature-synthesis.md",
] as const;
