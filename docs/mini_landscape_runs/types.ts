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
  | "video_end_fade"
  | "background_rig_switch"
  | "texture_treatment_apply"
  | "camera_move_trigger"
  | "pip_inset_mount";

export type NumberAnimDirection = "up" | "down" | "digit_entry" | "none";

export type LandscapeTransitionId =
  | "light_burn"
  | "hot_burn"
  | "soft_flash"
  | "hard_flash"
  | "light_sweep"
  | "luma_wash"
  // Cinematic tier (TRN-05): procedurally rendered full-frame transitions. All
  // of these are overlay + frame-filter render effects — the source FILE is
  // never re-encoded, only the composited frame is transformed at render time.
  | "push_in_zoom"
  | "match_cut"
  | "camera_pass_by"
  | "lens_flare_bleed"
  | "light_leak"
  | "defocus_bokeh"
  | "edge_glow_bloom"
  | "none";

export type TextureTreatmentKind =
  | "tactile"
  | "retro_authentic"
  | "paper_fiber"
  | "grain_film"
  | "halftone_dot"
  | "none";

export type TextureBlendMode =
  | "overlay"
  | "multiply"
  | "screen"
  | "soft-light"
  | "color-dodge";

export interface TextureTreatment {
  kind: TextureTreatmentKind;
  intensity: number; // 0..1
  blendMode: TextureBlendMode;
  textureAssetId?: string;
  paucityAssetStatus: "bundled_procedural" | "custom_asset_provided" | "external_texture_pending";
  assetFallback: string; // CSS procedural SVG / filter fallback when raw bitmap is pending
  cause: CausalRef;
}

export type BackgroundRigKind =
  | "talking_head_plate"
  | "concept_canvas"
  | "workflow_demo"
  | "chart_graph_stage"
  | "list_stack_stage"
  | "cinematic_environment"
  | "b_roll_video";

export type ConceptAnimationKind =
  | "animated_list"
  | "animated_chat"
  | "animated_graph"
  | "animated_concept"
  | "metaphor_node"
  | "none";

export interface BackgroundRig {
  rigId: string;
  sectionId: string;
  kind: BackgroundRigKind;
  conceptAnimation: ConceptAnimationKind;
  semanticConcept?: string;
  extractedEntities?: string[];
  baseAssetId?: string;
  textureTreatment: TextureTreatment;
  parallaxEnabled: boolean;
  depthRatios: { background: number; middleGround: number; foreground: number };
  cause: CausalRef;
}

export type BackgroundCoverageType =
  | "texture_overlay"
  | "video_plate_broll"
  | "motion_stage_composite"
  | "clean_anchor";

export interface BackgroundCoveragePlan {
  coverageId: string;
  sectionId: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  coverageType: BackgroundCoverageType;
  textureAsset?: {
    id: string;
    filePath: string;
    family: "fabric" | "paper" | "ink_paint" | "grunge" | "glass";
    blendMode: TextureBlendMode;
    intensity: number;
  };
  videoAsset?: {
    id: string;
    filePath: string;
    name: string;
    coverMode: "fill" | "contain";
    playbackSpeed?: number;
  };
  stageComposite?: {
    stageKind: BackgroundRigKind;
    conceptAnimation: ConceptAnimationKind;
    mattingMaskRequired: boolean;
    speakerOffsetX: number;
  };
  transition: {
    kind: "crossfade" | "directional_slide_left" | "directional_slide_right" | "zoom_punch" | "luma_cut" | "none";
    durationMs: number;
  };
  causalIntent: string;
  cause: CausalRef;
}

export type ZoomActionKind =
  | "emphasis_punch_in"
  | "audience_direct_address"
  | "return_to_authority_punch"
  | "slow_creep_in"
  | "snap_zoom_reset"
  | "outward_zoom"
  | "static_anchor";

export type ZoomTriggerCategory =
  | "high_emphasis"
  | "audience_address"
  | "return_from_background"
  | "topic_reset"
  | "building_argument";

export type CinematicZoomCurveKind =
  | "standard_cinematic_push" // Smooth symmetrical S-Curve (0.42, 0.0, 0.58, 1.0)
  | "whiplash_zoom"           // Dramatic fast-in, slow-out ski slope (0.08, 0.95, 0.15, 1.0)
  | "rebound_snap_zoom"       // 3-Keyframe elastic overshoot + spring settle
  | "static_anchor_hold";     // Clean resting hold (1.0x baseline)

export interface ZoomKeyframe {
  timeOffsetMs: number;
  scale: number;
  interpolation: "ease_out" | "ease_in" | "continuous_bezier" | "hold" | "linear";
  velocityHandleIn?: [number, number];
  velocityHandleOut?: [number, number];
}

export interface TransformEffectConfig {
  effectName: "Transform";
  uncheckCompShutter: true;
  shutterAngleDeg: 180 | 360;
  motionBlur: boolean;
  anchorPointCrosshair: {
    x: number;
    y: number;
    targetLabel: "host_eyes" | "host_chest" | "center" | "split_stage_right";
  };
}

export interface ZoomCue {
  zoomId: string;
  sectionId: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  kind: ZoomActionKind;
  curveKind: CinematicZoomCurveKind;
  triggerCategory: ZoomTriggerCategory;
  startScale: number; // e.g. 1.0
  endScale: number; // e.g. 1.18
  overshootScale?: number; // e.g. 1.22 for rebound curve
  keyframes: ZoomKeyframe[];
  transformEffect: TransformEffectConfig;
  cssBezier: string;
  pairedSpokenSnippet?: string;
  causalReason: string;
  cause: CausalRef;
}

export interface ZoomPlan {
  totalVideoDurationSec: number;
  cues: ZoomCue[];
  governance: {
    antiFatigueEnforced: boolean;
    minGapSec: number;
    maxZoomFactor: number;
    returnToAuthorityMatched: boolean;
    motionBlurValidated: boolean;
  };
}

// ===========================================================================
// PHOTO & ASSET CINEMATIC TREATMENT TYPES
// ===========================================================================

export type AssetCategory =
  | "screenshot_ui"
  | "documentary_still"
  | "archival_photo"
  | "product_graphic"
  | "diagram_schematic"
  | "portrait_headshot"
  | "broll_plate";

export type CinematicTreatmentMood =
  | "modern_anamorphic"
  | "vintage_kodachrome"
  | "editorial_luxury"
  | "investigative_monochrome"
  | "dreamy_promist"
  | "raw_documentary"
  | "crisis_hazard";

export interface HalationSettings {
  enabled: boolean;
  thresholdLuminance: number; // 0.70..0.95
  color: string; // e.g. "rgba(255, 60, 20, 0.45)"
  radiusPx: number; // 8..24
  blendMode: "screen" | "lighten" | "color-dodge";
}

export interface ChromaticAberrationSettings {
  enabled: boolean;
  fringeOffsetPx: number; // 1.5..4.0
  colorPair: "red_cyan" | "magenta_green" | "amber_blue";
  edgeFalloffExponent: number; // 1.5..2.5
}

export interface DiffusionProMistSettings {
  enabled: boolean;
  diffusionRadiusPx: number; // 6..20
  highlightBleedIntensity: number; // 0.15..0.45
  contrastCompression: number; // 0.85..0.95
}

export interface GateWeaveSettings {
  enabled: boolean;
  rotationDeg: number; // -0.8°..+0.8°
  offsetXPx: number; // -4..+4
  offsetYPx: number; // -4..+4
  asymmetricalCropPct: { top: number; right: number; bottom: number; left: number };
}

export interface PerceivedGrainSettings {
  enabled: boolean;
  midtoneDensity: number; // 0.25..0.60
  shadowDensity: number; // 0.10..0.25
  highlightDensity: number; // 0.00..0.05
  grainScale: number; // 1.0..2.0
  filmEmulsionType: "35mm_fine" | "16mm_coarse" | "8mm_vintage" | "silversalt_fine";
}

export interface SplitToningSettings {
  enabled: boolean;
  highlightTint: string; // e.g. "rgba(255, 230, 180, 0.15)"
  shadowTint: string; // e.g. "rgba(20, 45, 65, 0.20)"
  balancePoint: number; // 0.40..0.60
  microContrastVariance: number; // 1.05..1.20
}

export interface LightLeakSettings {
  enabled: boolean;
  originCorner: "top_left" | "top_right" | "bottom_left" | "bottom_right";
  colorGradient: string;
  intensity: number; // 0.15..0.40
  blendMode: "screen" | "overlay" | "color-dodge";
}

export interface AsymmetricVignetteSettings {
  enabled: boolean;
  lensHoodShape: "anamorphic_oval" | "petal_rectangular" | "vintage_vignette";
  cornerDarkeningPct: number; // 0.18..0.45
  featherRadiusPct: number; // 0.40..0.70
  asymmetryShift: { x: number; y: number };
}

export interface MicroPushMotionSettings {
  enabled: boolean;
  startScale: number; // 1.00
  endScale: number; // 1.04..1.06
  durationSec: number;
  focalAnchorPoint: { x: number; y: number; label: string };
  easing: string;
}

export interface PhotoTreatmentBlueprint {
  treatmentId: string;
  assetId: string;
  assetSourcePath: string;
  assetCategory: AssetCategory;
  mood: CinematicTreatmentMood;
  halation: HalationSettings;
  chromaticAberration: ChromaticAberrationSettings;
  diffusionProMist: DiffusionProMistSettings;
  gateWeave: GateWeaveSettings;
  perceivedGrain: PerceivedGrainSettings;
  splitToning: SplitToningSettings;
  lightLeaks: LightLeakSettings;
  vignette: AsymmetricVignetteSettings;
  filmDust: { enabled: boolean; density: number; blendMode: "screen" | "multiply" };
  microMotion: MicroPushMotionSettings;
  cssFilterChain: string;
  svgFilterId?: string;
  compositeStackLayerOrder: string[];
  rationale: string;
  cause: CausalRef;
}

export type CameraMoveKind =
  // Head rotation moves (the camera stays planted, only the aim changes).
  | "pan_left"
  | "pan_right"
  | "tilt_up"
  | "tilt_down"
  // Lens moves (focal-length driven, no camera displacement).
  | "zoom_in"
  | "zoom_out"
  // Rig translation moves (the whole camera rig physically moves).
  | "truck_left"
  | "truck_right"
  | "pedestal_up"
  | "pedestal_down"
  | "dolly_in"
  | "dolly_out"
  | "push_in"
  // Handheld / instability moves.
  | "shake"
  // Roll / Dutch moves (rotation about the lens axis).
  | "dutch_tilt"
  | "roll_clockwise"
  | "roll_counterclockwise"
  // Crane / Boom moves (elevation + gentle depth correction).
  | "crane_up"
  | "crane_down"
  // Dynamic / composite moves.
  | "tracking_follow"
  | "cinematic_drift"
  // No move (stable anchor).
  | "static"
  // Legacy no-move sentinel kept for backwards compatibility.
  | "none";

export interface CameraMovePlan {
  moveId: string;
  sectionId: string;
  startSec: number;
  endSec: number;
  kind: CameraMoveKind;
  intensity: number;
  parallaxDepthRatios: { background: number; middleGround: number; foreground: number };
  pairedWithText: boolean;
  pairedTextSnippet?: string;
  causalIntent: string;
  cause: CausalRef;
}

/**
 * A resolved 3D camera pose. Units follow the three.js spine used by the
 * Joseph render contract: base position [0,0,5], base rotation [0,0,0], base
 * fov 45. Consumers apply the position and/or rotation deltas (a renderer that
 * keeps `lookAt(0,0,0)` may project rotation moves onto position orbits).
 */
export interface CameraPose {
  position: [number, number, number];
  rotation: [number, number, number];
  fov: number;
}

export interface CameraPoseEvaluation {
  pose: CameraPose;
  /** Eased 0..1 progress along the move window. */
  progress: number;
  /** Linear 0..1 progress (before easing). */
  rawProgress: number;
}

export type ParallaxPlaneKind = "background" | "midground" | "foreground";

export interface ParallaxPlaneRect {
  /** Fraction of canvas width from the left edge (0..1). */
  x: number;
  /** Fraction of canvas height from the top edge (0..1). */
  y: number;
  /** Fraction of canvas width. */
  width: number;
  /** Fraction of canvas height. */
  height: number;
  /** Pivot inside the rect (0..1); parallax scale/rotation happen around it. */
  anchorX: number;
  anchorY: number;
}

/**
 * One 2.5D depth plane of the animation rig.
 *
 * Ownership split:
 *  - `background` → owned by the background system (landscape_background_catalog
 *    / BackgroundCoveragePlan). The animation hand only references it.
 *  - `midground` + `foreground` → owned by the animation hand. This is the
 *    placement responsibility this module exists to fulfil.
 */
export interface ParallaxPlane {
  kind: ParallaxPlaneKind;
  zDepth: 5 | 10 | 20 | 30;
  /** 2.5D velocity ratio relative to the camera; strictly monotonic bg<mid<fg. */
  parallaxRatio: number;
  baseRect: ParallaxPlaneRect;
  contentHint: string;
  opacity: number;
  source?: {
    owner: "background_system" | "animation_hand";
    coverageId?: string;
    rigId?: string;
    pipId?: string;
    metaphorId?: string;
  };
}

export interface ParallaxRigPlan {
  rigId: string;
  sectionId: string;
  startSec: number;
  endSec: number;
  backgroundPlane: ParallaxPlane;
  midgroundPlane: ParallaxPlane;
  foregroundPlane: ParallaxPlane;
  parallaxDepthRatios: { background: number; middleGround: number; foreground: number };
  cameraMoveId?: string;
  cause: CausalRef;
}

/** Per-frame placement of a parallax plane, resolved by the camera system. */
export interface ParallaxPlanePlacement {
  plane: ParallaxPlane;
  /** baseRect with scale + translate already folded in (percent-based). */
  rect: ParallaxPlaneRect;
  /** Signed screen-space offset in canvas-fractions (positive = right/down). */
  translateX: number;
  translateY: number;
  scale: number;
  rotationDeg: number;
  opacity: number;
}


export interface PipInsetPlan {
  pipId: string;
  sectionId: string;
  startSec: number;
  endSec: number;
  screenSource: string;
  position: "top_right" | "top_left" | "bottom_right" | "bottom_left";
  scale: number; // 0.25..0.45
  cornerRadiusPx: number;
  borderGlowColor?: string;
  causalIntent: string;
  enabled?: boolean;
  label?: string;
  cause: CausalRef;
}

export type MetaphorCategory =
  | "chess_king_strategy"
  | "growth_surge"
  | "mechanical_engine"
  | "security_vault"
  | "neural_synapse"
  | "chat_dialogue"
  | "telemetry_crosshair"
  | "architectural_pillars"
  | "general_conceptual";

export interface MetaphorTreatmentPoint {
  pointId: string;
  sectionId: string;
  timeSec: number;
  durationSec: number;
  spokenSnippet: string;
  triggerTokens: string[];
  metaphorCategory: MetaphorCategory;
  recommendedAsset: {
    assetName: string;
    assetType: "3d_prop" | "motion_graphic" | "chart_spline" | "hud_telemetry" | "dialogue_bubble";
    visualDescription: string;
    beamCalloutText?: string;
    animationEffect: string;
  };
  texturePlacement: {
    kind: TextureTreatmentKind;
    blendMode: TextureBlendMode;
    intensity: number;
    layerPlane: 10 | 20 | 25 | 30;
    spiralCurve: "linear_fade" | "logarithmic_snap" | "exponential_bloom" | "pulsing_beacon";
    paucityFallback: string;
  };
  editorialRationale: string;
  creativityLayer: {
    creativePrompt: string;
    modelAssistanceHint: string;
    aestheticScore: number;
  };
  cause: CausalRef;
}

export interface EditorialCausalNode {
  nodeId: string;
  sectionId: string;
  timestamp: string;
  startSec: number;
  endSec: number;
  action: string;
  intent: string;
  critiqueRationale: string;
  aestheticRating: number; // 0..10
  modelAssistanceNotes: string;
  paucityOfAssetsNotes: string;
  cause: CausalRef;
}

export type MacroTreatmentIntent =
  | "list_stack"
  | "negative_crisis"
  | "metaphor_prop"
  | "picture_in_picture"
  | "chart_growth"
  | "anchor_dialogue"
  | "cinematic_climax";

export type HandOfGodCameraIntent =
  | "slow_zoom_in"
  | "punch_in"
  | "pan_left"
  | "pan_right"
  | "cinematic_drift"
  | "static_anchor";

export type HandOfGodValence = "positive_breakthrough" | "negative_crisis" | "neutral_exposition" | "tension_build";

export interface HandOfGodSectionDirective {
  sectionId?: string;
  timeSec?: number;
  macroTreatment: MacroTreatmentIntent;
  valence: HandOfGodValence;
  
  // 1. Camera zones & zooms
  cameraZones: {
    intent: HandOfGodCameraIntent;
    intensity: number; // 0..1
    targetFocalPoint?: string;
  };

  // 2. Negative treatment & crisis shockwaves
  negativeTreatment: {
    isNegative: boolean;
    valenceScore: number; // -1.0 .. +1.0
    shockwaveEffect?: "dim_and_glitch" | "optical_fracture" | "strike_through" | "none";
  };

  // 3. Lexicon (semantic triggers & keywords)
  lexicon: {
    triggerTokens: string[];
    coreKeywords: string[];
    semanticTone: string;
  };

  // 4. Cuts (pacing & cadence)
  cuts: {
    cadence: "rapid" | "deliberate" | "flow";
    silencePaddingSec?: number;
    leadTimeSec?: number;
  };

  // 5. Animation (2.5D layer motion)
  animation: {
    motionMode: "2.5D_parallax" | "spring_pop" | "continuous_rotation" | "isometric_stack" | "none";
    depthVelocities?: { bg: number; mid: number; fg: number };
  };

  // 6. Background (stage rigs & lighting)
  background: {
    rigKind: BackgroundRigKind;
    stageLighting: "neutral" | "cyan_steel" | "ember_crisis" | "forest" | "violet_night";
  };

  // 7. Audio change suggestion (mood, energy, risers)
  audioChangeSuggestion: {
    energyDelta: number; // -1.0 .. +1.0
    tensionLevel: "low" | "medium" | "high" | "drop";
    riserTrigger?: boolean;
  };

  // 8. Lists (multi-pillar stacks)
  lists: {
    isList: boolean;
    pillarCount?: number;
    layoutStyle?: "vertical_stack" | "isometric_tiers" | "staggered_cards";
  };

  // 9. PIP treatment (presence, placement, scale)
  pipTreatment: {
    required: boolean;
    position: "top_right" | "top_left" | "bottom_right" | "bottom_left";
    scale: number;
  };

  // 10. Picture-in-picture style & screen source
  pipStyle: {
    stylePreset: "glass_window" | "screencast_feed" | "terminal_box" | "glowing_inset" | "floating_card";
    screenSource?: string;
  };

  // 11. Asset suggestion (combinatorial metaphor assets)
  assetSuggestion: {
    keyword: string;
    suggestedAsset: string;
    placementPlane: "behind_speaker" | "flank_shoulder" | "foreground_hud" | "full_screen_stage";
    visualDescription?: string;
  };

  // 12. Framing & reframing (speaker positioning, split-screen offsets)
  framingReframing: {
    speakerFraming: "center_anchor" | "split_screen_right_30" | "split_screen_left_30" | "punch_close_up" | "wide_hero";
    mattingMaskRequired: boolean;
  };

  // 13. B-roll / cutaway strategy
  brollCutawayStrategy: {
    cutawayStrategy: "full_canvas_overlay" | "split_canvas" | "shoulder_flank" | "none";
    thematicTopic?: string;
  };

  // 14. Color / visual treatment (textures, scanlines, fiber, grain)
  colorVisualTreatment: {
    textureKind: TextureTreatmentKind;
    intensity: number;
    atmosphereEffect?: "dust_grain" | "scanlines" | "paper_mesh" | "fringe_vignette" | "clean";
    blendMode: TextureBlendMode;
  };

  reasoning: string;
}

export interface HandOfGodBlueprint {
  version: "1.0.0";
  source: "llm_generated" | "hybrid" | "deterministic_fallback";
  modelName?: string;
  globalVibe: {
    primaryPacing: "fast" | "adaptive" | "cinematic";
    motionTone: "minimalist" | "high_energy" | "editorial";
  };
  directives: HandOfGodSectionDirective[];
}

export interface CausalRef {
  gate: LifecycleEvent | "form_decision" | "silence_cut" | "section_role" | "edit_move" | "editorial_critique";
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
  /** True when the whole run is ONE song (short-form policy, SONG-07). */
  singleSongMode?: boolean;
  /**
   * Subtle riser beds under song-change boundaries (multi-song runs only).
   * Empty for single-song runs — the one song never needs a seam.
   */
  transitionBeds?: TransitionBed[];
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

/**
 * A subtle transition bed (riser) that primes the listener at a song
 * boundary. Synthesized in the bake as a low-to-high tone sweep with a
 * rising envelope, mixed at a low level under the music crossfade. Only
 * present when two distinct songs meet (blendId !== "none").
 */
export interface TransitionBed {
  boundarySec: number;
  fromSectionId: string;
  toSectionId: string;
  /** Duration of the rising bed (sweeps from ~100 Hz to ~600 Hz). */
  riserSec: number;
  /** Peak level relative to the music bus (e.g. -25 dB). */
  levelDb: number;
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
  typographyPlan?: import("./landscape_typography_engine.js").LandscapeTypographyPlan;
  subjectMatteAvailable?: boolean;
  matteSrc?: string;
  sfxCues: SfxCue[];
  soundtrack: SoundtrackProgram;
  backgroundRigs?: BackgroundRig[];
  backgroundCoverages?: BackgroundCoveragePlan[];
  zoomPlan?: ZoomPlan;
  zoomCues?: ZoomCue[];
  cameraMoves?: CameraMovePlan[];
  parallaxRig?: ParallaxRigPlan[];
  pipInsets?: PipInsetPlan[];
  editorialCausalChain?: EditorialCausalNode[];
  metaphorTreatments?: MetaphorTreatmentPoint[];
  handOfGodBlueprint?: HandOfGodBlueprint;
  photoTreatments?: PhotoTreatmentBlueprint[];
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
