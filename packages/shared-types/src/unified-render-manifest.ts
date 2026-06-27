import {z} from "zod";
import {isAbsoluteMediaFilePath, isBrowserSafeMediaUrl} from "./asset-resolver.js";

export const WordSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  confidence: z.number().min(0).max(1).optional(),
  emphasis: z.number().min(0).max(1).optional(),
});

export const SFXEventSchema = z.object({
  id: z.string(),
  cue: z.enum([
    "whoosh_fast",
    "whoosh_slow",
    "impact_deep",
    "impact_sharp",
    "riser_short",
    "sub_drop",
    "glitch_digital",
    "pop_text",
  ]),
  variant: z.number().int().min(1).max(5).optional(),
  triggerMs: z.number(),
  durationMs: z.number().default(300),
  volumeDb: z.number().default(-12),
  duckMusicDb: z.number().default(-6),
});

export const JosephTypographySchema = z.object({
  fontFamily: z.string().trim().min(1),
  fontAssetUrl: z.string().trim().min(1).refine(isBrowserSafeMediaUrl, {
    message: "fontAssetUrl must be browser-safe: HTTP(S) or root-relative, not file:// or a local filesystem path",
  }),
  fallbackFamily: z.string().trim().min(1),
  fontId: z.string().trim().min(1),
});

export const JosephTypographyStylebookIdSchema = z.enum([
  "aggressive_authority",
  "premium_cinematic",
  "sleek_product",
  "restrained_editorial",
]);

export const JosephTypographyWordRoleSchema = z.enum(["filler", "support", "hero", "cta"]);

export const JosephTypographyWordWeightSchema = z.object({
  text: z.string().trim().min(1),
  normalized: z.string().trim().min(1),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
  role: JosephTypographyWordRoleSchema,
  score: z.number().min(0).max(1),
  reasons: z.array(z.string().trim().min(1)).default([]),
});

export const JosephTypographyCompositionRulesSchema = z.object({
  caseStrategy: z.enum(["all_caps", "hero_upper_support_title", "title_case", "sentence_case"]),
  lineBreakStrategy: z.enum(["phrase_stack", "breath_balanced", "single_anchor"]),
  contrastMode: z.enum(["hero_crimson_support_white", "weight_only", "single_color"]),
  hierarchyScale: z.number().min(1).max(2),
  fillerTreatment: z.enum(["suppress", "dim", "show_dimmed"]),
  maxWordsPerLine: z.number().int().min(1).max(7),
});

export const JosephTypographyLineSchema = z.object({
  text: z.string().trim().min(1),
  role: z.enum(["support", "hero", "cta"]),
  caseTreatment: z.enum(["uppercase", "title_case", "sentence_case"]),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
  maxCharacters: z.number().int().positive(),
  contrastColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  hierarchyLevel: z.number().int().min(1).max(4),
});

export const JosephTypographyQualityAuditSchema = z.object({
  score: z.number().min(0).max(1),
  failures: z.array(z.string().trim().min(1)).default([]),
  warnings: z.array(z.string().trim().min(1)).default([]),
});

export const JosephTypographyIntelligencePlanSchema = z.object({
  version: z.literal("joseph-typography-v1"),
  stylebookId: JosephTypographyStylebookIdSchema,
  lexicalWeights: z.array(JosephTypographyWordWeightSchema).default([]),
  compositionRules: JosephTypographyCompositionRulesSchema,
  lines: z.array(JosephTypographyLineSchema).default([]),
  qualityAudit: JosephTypographyQualityAuditSchema,
});
export const MusicReferenceSchema = z.object({
  trackId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  sourceKind: z.enum(["local", "r2", "http"]),
  localFilePath: z.string().trim().min(1).refine(isAbsoluteMediaFilePath, {
    message: "localFilePath must be absolute for FFmpeg and final render",
  }),
  browserUrl: z.string().trim().min(1).refine(isBrowserSafeMediaUrl, {
    message: "browserUrl must be browser-safe when provided",
  }).optional(),
  durationSeconds: z.number().positive(),
  renderSafe: z.boolean(),
  licenseStatus: z.string().trim().min(1),
});

export const TextEventSchema = z.object({
  type: z.literal("text"),
  word: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  style: z.enum([
    "pop",
    "slide_up",
    "slide_down",
    "glitch",
    "typewriter",
    "elastic_scale",
  ]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#FFFFFF"),
  highlightColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  position: z.object({
    x: z.number().min(0).max(1).default(0.5),
    y: z.number().min(0).max(1).default(0.12),
    z: z.number().default(0.1),
  }).default({x: 0.5, y: 0.12, z: 0.1}),
  scale: z.number().default(1),
  cameraPush: z.number().min(0).max(1).default(0),
  shake: z.number().min(0).max(1).default(0),
});

export const CutEventSchema = z.object({
  type: z.literal("cut"),
  atMs: z.number(),
  toMs: z.number(),
  style: z.enum(["hard", "whip_right", "whip_left", "zoom_blur"]),
  intensity: z.number().min(0).max(1).default(0.5),
});

export const CameraEventSchema = z.object({
  type: z.literal("camera"),
  move: z.enum([
    "push_in",
    "pull_out",
    "dutch_left",
    "dutch_right",
    "handheld_shake",
  ]),
  startMs: z.number(),
  endMs: z.number(),
  intensity: z.number().min(0).max(1).default(0.5),
  curve: z.enum(["linear", "ease_in", "ease_out", "elastic"]).default("ease_out"),
});

export const ColorEventSchema = z.object({
  type: z.literal("color"),
  lut: z.enum(["high_energy", "reflective", "neutral", "dramatic_cool"]),
  startMs: z.number(),
  endMs: z.number(),
  intensity: z.number().min(0).max(1).default(0.5),
});

export const TransitionEventSchema = z.object({
  type: z.literal("transition"),
  style: z.enum(["zoom_blur", "whip_pan", "glitch_flash"]),
  atMs: z.number(),
  durationMs: z.number().default(400),
  intensity: z.number().min(0).max(1).default(0.7),
});

export const MicroAnimationFamilySchema = z.enum([
  "text_emphasis",
  "text_entry",
  "text_mutation",
  "accent_motion",
  "spatial_micro_motion",
]);

export const MicroAnimationRenderFallbackSchema = z.enum([
  "pop",
  "slide_up",
  "glitch",
  "typewriter",
  "elastic_scale",
]);

export const MicroAnimationParametersSchema = z.object({
  intensity: z.number().min(0).max(1),
  durationMs: z.number().int().positive(),
  delayMs: z.number().int().nonnegative().default(0),
  anchor: z.enum(["word", "phrase", "line", "safe_zone", "frame"]),
  direction: z.enum(["up", "down", "left", "right", "center", "radial"]).optional(),
});

export const MicroAnimationSelectionSchema = z.object({
  primitiveId: z.string().trim().min(1),
  family: MicroAnimationFamilySchema,
  role: z.enum(["entry", "emphasis", "mutation", "accent", "spatial"]),
  renderFallback: MicroAnimationRenderFallbackSchema,
  combinationGroup: z.string().trim().min(1),
  semanticRole: z.enum(["support", "hero", "cta", "accent"]),
  parameters: MicroAnimationParametersSchema,
});

export const MicroAnimationAuditSchema = z.object({
  taxonomyVersion: z.literal("joseph-micro-animation-v1"),
  primitiveIds: z.array(z.string().trim().min(1)).default([]),
  score: z.number().min(0).max(1),
  failures: z.array(z.string().trim().min(1)).default([]),
  warnings: z.array(z.string().trim().min(1)).default([]),
});

export const JosephPiPLayoutSchema = z.enum([
  "speaker_left_text_right",
  "speaker_right_text_left",
  "corner_speaker_hero_text",
]);

export const JosephPiPDockingPositionSchema = z.enum([
  "upper_left",
  "upper_right",
  "lower_left",
  "lower_right",
]);

export const JosephPiPFrameSchema = z.object({
  leftPercent: z.number().min(0).max(100),
  topPercent: z.number().min(0).max(100),
  widthPercent: z.number().min(1).max(100),
  heightPercent: z.number().min(1).max(100),
  borderRadiusPx: z.number().int().nonnegative(),
  safeMarginPercent: z.number().min(0).max(25),
  depth: z.enum(["background", "subject", "foreground"]),
});

export const JosephPiPSubjectAnchorSchema = z.object({
  xPercent: z.number().min(0).max(100),
  yPercent: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  source: z.enum(["heuristic", "provided", "tracked"]),
});

export const JosephPiPMotionBehaviorSchema = z.enum([
  "enter",
  "dock",
  "expand",
  "collapse",
  "handoff",
]);

export const JosephPiPMotionSegmentSchema = z.object({
  behavior: JosephPiPMotionBehaviorSchema,
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
  easing: z.enum(["linear", "ease_in", "ease_out", "ease_in_out"]),
});

export const JosephPiPTypographyZoneSchema = z.object({
  role: z.enum(["hero", "support", "caption"]),
  leftPercent: z.number().min(0).max(100),
  topPercent: z.number().min(0).max(100),
  widthPercent: z.number().min(1).max(100),
  heightPercent: z.number().min(1).max(100),
  align: z.enum(["left", "center", "right"]),
  minClearancePercent: z.number().min(0).max(25),
});

export const JosephPiPBackgroundLayerSchema = z.object({
  role: z.enum(["backplate", "asset_board", "focus_field"]),
  leftPercent: z.number().min(0).max(100),
  topPercent: z.number().min(0).max(100),
  widthPercent: z.number().min(1).max(100),
  heightPercent: z.number().min(1).max(100),
  intensity: z.number().min(0).max(1),
});

export const JosephPiPCoexistenceRulesSchema = z.object({
  preserveSubjectFocus: z.boolean(),
  protectTypography: z.boolean(),
  textClearancePercent: z.number().min(0).max(25),
  backgroundDefocus: z.number().min(0).max(1),
});

export const JosephPiPPlanSchema = z.object({
  version: z.literal("joseph-pip-v1"),
  layout: JosephPiPLayoutSchema,
  sourceTrackId: z.string().trim().min(1).optional(),
  subjectAnchor: JosephPiPSubjectAnchorSchema,
  frame: JosephPiPFrameSchema,
  dockingPosition: JosephPiPDockingPositionSchema,
  availableMotionBehaviors: z.array(JosephPiPMotionBehaviorSchema).min(1),
  activeMotion: z.array(JosephPiPMotionSegmentSchema).min(1),
  typographyZones: z.array(JosephPiPTypographyZoneSchema).min(1),
  backgroundLayers: z.array(JosephPiPBackgroundLayerSchema).default([]),
  coexistenceRules: JosephPiPCoexistenceRulesSchema,
});

export const JosephBackgroundPrimitiveFamilySchema = z.enum([
  "shader_background",
  "abstract_light_field",
  "particle_atmosphere",
  "editorial_backplate",
  "vignette_surface",
  "focus_tunnel",
  "accent_geometry",
]);

export const JosephBackgroundPrimitiveLayerSchema = z.enum([
  "foundation",
  "atmosphere",
  "accent",
  "overlay_support",
]);

export const JosephBackgroundPrimitiveParametersSchema = z.object({
  colorFamily: z.enum([
    "cinematic_cool",
    "kinetic_crimson",
    "neutral_contrast",
    "electric_blue",
    "warm_spotlight",
  ]),
  speed: z.number().min(0).max(1),
  noiseIntensity: z.number().min(0).max(1),
  bloomIntensity: z.number().min(0).max(1),
  distortionAmount: z.number().min(0).max(1),
  contrast: z.number().min(0).max(1),
  density: z.number().min(0).max(1),
  opacity: z.number().min(0).max(1),
});

export const JosephBackgroundPrimitiveSelectionSchema = z.object({
  primitiveId: z.string().trim().min(1),
  family: JosephBackgroundPrimitiveFamilySchema,
  role: z.enum(["background", "atmosphere", "backplate", "accent"]),
  layer: JosephBackgroundPrimitiveLayerSchema,
  blendMode: z.enum(["normal", "screen", "multiply", "overlay", "soft_light"]),
  renderStrategy: z.literal("curated_mesh"),
  parameters: JosephBackgroundPrimitiveParametersSchema,
});

export const JosephBackgroundLayeringRulesSchema = z.object({
  sourceFootageMode: z.enum(["full_bleed", "pip_protected", "backplate_protected"]),
  textProtection: z.enum(["contrast_scrim", "clearance_band", "contrast_and_clearance"]),
  pipProtection: z.enum(["none", "reserved_safe_zone", "soft_backplate"]),
  overlayInteraction: z.enum(["accent_below_text", "accent_above_background", "overlay_reserved"]),
  maxActivePrimitives: z.number().int().min(1).max(6),
});

export const JosephBackgroundParameterAuditSchema = z.object({
  governed: z.boolean(),
  clampedParameterCount: z.number().int().nonnegative(),
  warnings: z.array(z.string().trim().min(1)).default([]),
});

export const JosephBackgroundPlanSchema = z.object({
  version: z.literal("joseph-background-v1"),
  catalogVersion: z.string().trim().min(1),
  selectedPrimitiveIds: z.array(z.string().trim().min(1)).default([]),
  primitives: z.array(JosephBackgroundPrimitiveSelectionSchema).default([]),
  layeringRules: JosephBackgroundLayeringRulesSchema,
  parameterAudit: JosephBackgroundParameterAuditSchema,
});
export const JosephChoreographyDoctrineIdSchema = z.enum([
  "punch",
  "hold",
  "bloom",
  "ratchet",
  "glide",
  "suspend",
  "detonate",
]);

export const JosephChoreographySegmentRoleSchema = z.enum([
  "hook",
  "setup",
  "revelation",
  "escalation",
  "release",
  "cta",
]);

export const JosephChoreographyLaneSchema = z.enum([
  "cut",
  "text",
  "camera",
  "sfx",
  "background",
]);

export const JosephChoreographyMomentumRoleSchema = z.enum([
  "anticipation",
  "release",
  "escalation",
  "restraint",
  "carry_through",
  "detonation",
]);

export const JosephChoreographySyncKindSchema = z.enum([
  "beat",
  "onset",
  "phrase",
  "breath",
  "background_cycle",
]);

export const JosephChoreographyPacingFailureSchema = z.enum([
  "flat_pacing",
  "overcutting",
  "climax_overspend",
  "dead_zone",
  "non_musical_emphasis",
]);

export const JosephChoreographyDoctrineSchema = z.object({
  id: JosephChoreographyDoctrineIdSchema,
  label: z.string().trim().min(1),
  momentumRole: JosephChoreographyMomentumRoleSchema,
  cutBehavior: z.string().trim().min(1),
  textBehavior: z.string().trim().min(1),
  cameraBehavior: z.string().trim().min(1),
  sfxBehavior: z.string().trim().min(1),
  backgroundBehavior: z.string().trim().min(1),
});

export const JosephChoreographySegmentSchema = z.object({
  id: z.string().trim().min(1),
  role: JosephChoreographySegmentRoleSchema,
  doctrineId: JosephChoreographyDoctrineIdSchema,
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  score: z.number().min(0).max(1),
  momentum: z.number().min(0).max(1),
  intensity: z.number().min(0).max(1),
  breathWindowMs: z.number().int().nonnegative(),
  climaxBudget: z.number().min(0).max(1),
});

export const JosephChoreographyTimingWindowSchema = z.object({
  lane: JosephChoreographyLaneSchema,
  eventId: z.string().trim().min(1),
  segmentId: z.string().trim().min(1),
  segmentRole: JosephChoreographySegmentRoleSchema,
  doctrineId: JosephChoreographyDoctrineIdSchema,
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  triggerMs: z.number().nonnegative(),
  intensity: z.number().min(0).max(1),
  sync: JosephChoreographySyncKindSchema,
});

export const JosephChoreographyTimingPlanSchema = z.object({
  cutWindows: z.array(JosephChoreographyTimingWindowSchema).default([]),
  textWindows: z.array(JosephChoreographyTimingWindowSchema).default([]),
  cameraWindows: z.array(JosephChoreographyTimingWindowSchema).default([]),
  sfxWindows: z.array(JosephChoreographyTimingWindowSchema).default([]),
  backgroundWindows: z.array(JosephChoreographyTimingWindowSchema).default([]),
});

export const JosephChoreographyQualityAuditSchema = z.object({
  score: z.number().min(0).max(1),
  failures: z.array(JosephChoreographyPacingFailureSchema).default([]),
  warnings: z.array(z.string().trim().min(1)).default([]),
});

export const JosephChoreographyPlanSchema = z.object({
  version: z.literal("joseph-choreography-v1"),
  vocabulary: z.array(JosephChoreographyDoctrineSchema).min(7),
  segments: z.array(JosephChoreographySegmentSchema).default([]),
  timingPlan: JosephChoreographyTimingPlanSchema,
  qualityAudit: JosephChoreographyQualityAuditSchema,
});
export const TimelineEventSchema = z.union([
  CutEventSchema,
  TextEventSchema,
  CameraEventSchema,
  ColorEventSchema,
  TransitionEventSchema,
]);

export const VideoTrackSchema = z.object({
  id: z.string().optional(),
  sourcePath: z.string().min(1),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
});

export const CameraMoveSchema = z.object({
  type: z.enum(["push_in", "dutch", "shake"]),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
});

export const TextOverlaySchema = z.object({
  text: z.string(),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
  animation: z.enum(["pop", "slide_up", "glitch", "typewriter", "elastic_scale"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  microAnimation: MicroAnimationSelectionSchema.optional(),
});

export const TransitionSchema = z.object({
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
});

export const UnifiedRenderManifestSchema = z.object({
  version: z.literal("2.0"),
  jobId: z.string().uuid(),
  seed: z.number().int().min(0).max(2147483647),
  createdAt: z.string().datetime(),

  durationFrames: z.number().int().positive(),
  fps: z.number().int().positive().default(30),
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  videoTracks: z.array(VideoTrackSchema).default([]),
  cameraMoves: z.array(CameraMoveSchema).default([]),
  textOverlays: z.array(TextOverlaySchema).default([]),
  transitions: z.array(TransitionSchema).default([]),
  typography: JosephTypographySchema.optional(),
  microAnimationAudit: MicroAnimationAuditSchema.optional(),
  josephPiP: JosephPiPPlanSchema.optional(),
  josephBackground: JosephBackgroundPlanSchema.optional(),
  josephTypography: JosephTypographyIntelligencePlanSchema.optional(),
  josephChoreography: JosephChoreographyPlanSchema.optional(),

  source: z.object({
    videoUrl: z.string().min(1),
    audioUrl: z.string().min(1).optional(),
    transcript: z.array(WordSchema).default([]),
    durationMs: z.number().positive(),
    width: z.number().int().positive().default(1920),
    height: z.number().int().positive().default(1080),
    fps: z.number().int().positive().default(30),
  }),

  audio: z.object({
    beats: z.array(z.number()).default([]),
    onsets: z.array(z.number()).default([]),
    energyCurve: z.array(z.number()).optional(),
    musicTrackUrl: z.string().min(1).optional(),
    musicReference: MusicReferenceSchema.optional(),
    musicBpm: z.number().optional(),
    sfx: z.array(SFXEventSchema).default([]),
    voiceVolumeDb: z.number().default(0),
    musicVolumeDb: z.number().default(-18),
    targetLufs: z.number().default(-14),
  }),

  timeline: z.array(TimelineEventSchema).default([]),

  creativeProfile: z.object({
    name: z.enum(["joseph_aggressive", "joseph_cinematic", "joseph_minimal"]),
    cutDensity: z.number().min(0.1).max(2),
    textDensity: z.number().min(0).max(1),
    sfxDensity: z.number().min(0).max(1),
    cameraAggression: z.number().min(0).max(1),
    colorIntensity: z.number().min(0).max(1),
  }),

  output: z.object({
    width: z.number().int().positive().default(1920),
    height: z.number().int().positive().default(1080),
    fps: z.number().int().positive().default(30),
    codec: z.enum(["h264", "h265"]).default("h264"),
    crf: z.number().int().default(18),
  }),
});

export type UnifiedRenderManifest = z.infer<typeof UnifiedRenderManifestSchema>;
export type Word = z.infer<typeof WordSchema>;
export type SFXEvent = z.infer<typeof SFXEventSchema>;
export type JosephTypography = z.infer<typeof JosephTypographySchema>;
export type JosephTypographyStylebookId = z.infer<typeof JosephTypographyStylebookIdSchema>;
export type JosephTypographyWordRole = z.infer<typeof JosephTypographyWordRoleSchema>;
export type JosephTypographyWordWeight = z.infer<typeof JosephTypographyWordWeightSchema>;
export type JosephTypographyCompositionRules = z.infer<typeof JosephTypographyCompositionRulesSchema>;
export type JosephTypographyLine = z.infer<typeof JosephTypographyLineSchema>;
export type JosephTypographyQualityAudit = z.infer<typeof JosephTypographyQualityAuditSchema>;
export type JosephTypographyIntelligencePlan = z.infer<typeof JosephTypographyIntelligencePlanSchema>;
export type MusicReference = z.infer<typeof MusicReferenceSchema>;
export type TextEvent = z.infer<typeof TextEventSchema>;
export type CutEvent = z.infer<typeof CutEventSchema>;
export type CameraEvent = z.infer<typeof CameraEventSchema>;
export type ColorEvent = z.infer<typeof ColorEventSchema>;
export type TransitionEvent = z.infer<typeof TransitionEventSchema>;
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type MicroAnimationFamily = z.infer<typeof MicroAnimationFamilySchema>;
export type MicroAnimationRenderFallback = z.infer<typeof MicroAnimationRenderFallbackSchema>;
export type MicroAnimationParameters = z.infer<typeof MicroAnimationParametersSchema>;
export type MicroAnimationSelection = z.infer<typeof MicroAnimationSelectionSchema>;
export type MicroAnimationAudit = z.infer<typeof MicroAnimationAuditSchema>;
export type JosephPiPLayout = z.infer<typeof JosephPiPLayoutSchema>;
export type JosephPiPDockingPosition = z.infer<typeof JosephPiPDockingPositionSchema>;
export type JosephPiPFrame = z.infer<typeof JosephPiPFrameSchema>;
export type JosephPiPSubjectAnchor = z.infer<typeof JosephPiPSubjectAnchorSchema>;
export type JosephPiPMotionBehavior = z.infer<typeof JosephPiPMotionBehaviorSchema>;
export type JosephPiPMotionSegment = z.infer<typeof JosephPiPMotionSegmentSchema>;
export type JosephPiPTypographyZone = z.infer<typeof JosephPiPTypographyZoneSchema>;
export type JosephPiPBackgroundLayer = z.infer<typeof JosephPiPBackgroundLayerSchema>;
export type JosephPiPCoexistenceRules = z.infer<typeof JosephPiPCoexistenceRulesSchema>;
export type JosephPiPPlan = z.infer<typeof JosephPiPPlanSchema>;
export type JosephBackgroundPrimitiveFamily = z.infer<typeof JosephBackgroundPrimitiveFamilySchema>;
export type JosephBackgroundPrimitiveLayer = z.infer<typeof JosephBackgroundPrimitiveLayerSchema>;
export type JosephBackgroundPrimitiveParameters = z.infer<typeof JosephBackgroundPrimitiveParametersSchema>;
export type JosephBackgroundPrimitiveSelection = z.infer<typeof JosephBackgroundPrimitiveSelectionSchema>;
export type JosephBackgroundLayeringRules = z.infer<typeof JosephBackgroundLayeringRulesSchema>;
export type JosephBackgroundParameterAudit = z.infer<typeof JosephBackgroundParameterAuditSchema>;
export type JosephBackgroundPlan = z.infer<typeof JosephBackgroundPlanSchema>;
export type JosephChoreographyDoctrineId = z.infer<typeof JosephChoreographyDoctrineIdSchema>;
export type JosephChoreographySegmentRole = z.infer<typeof JosephChoreographySegmentRoleSchema>;
export type JosephChoreographyLane = z.infer<typeof JosephChoreographyLaneSchema>;
export type JosephChoreographyMomentumRole = z.infer<typeof JosephChoreographyMomentumRoleSchema>;
export type JosephChoreographySyncKind = z.infer<typeof JosephChoreographySyncKindSchema>;
export type JosephChoreographyPacingFailure = z.infer<typeof JosephChoreographyPacingFailureSchema>;
export type JosephChoreographyDoctrine = z.infer<typeof JosephChoreographyDoctrineSchema>;
export type JosephChoreographySegment = z.infer<typeof JosephChoreographySegmentSchema>;
export type JosephChoreographyTimingWindow = z.infer<typeof JosephChoreographyTimingWindowSchema>;
export type JosephChoreographyTimingPlan = z.infer<typeof JosephChoreographyTimingPlanSchema>;
export type JosephChoreographyQualityAudit = z.infer<typeof JosephChoreographyQualityAuditSchema>;
export type JosephChoreographyPlan = z.infer<typeof JosephChoreographyPlanSchema>;
export type VideoTrack = z.infer<typeof VideoTrackSchema>;
export type CameraMove = z.infer<typeof CameraMoveSchema>;
export type TextOverlay = z.infer<typeof TextOverlaySchema>;
export type Transition = z.infer<typeof TransitionSchema>;
