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
  bedId: string;
  padId: string;
  sections: SoundtrackSection[];
  voiceDucking: { enabled: true; reductionDb: number; attackSec: number; releaseSec: number };
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
