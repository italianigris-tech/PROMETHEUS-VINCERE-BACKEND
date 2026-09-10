import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const TypographyAnchorSchema = z.object({
  horizontal: z.enum(["left", "center", "right"]).default("center"),
  vertical: z.enum(["top", "center", "bottom"]).default("center"),
  offsetXPercent: z.number().default(0),
  offsetYPercent: z.number().default(0),
  placementZone: z.enum([
    "top_left",
    "top_center",
    "top_right",
    "center_left",
    "center",
    "center_right",
    "bottom_left",
    "bottom_center",
    "bottom_right",
    "flank_left",
    "flank_right",
    "cranial_halo",
    "supra_cranial",
    "chest_deck",
    "custom",
  ]).default("center"),
  relativeTo: z.enum([
    "canvas",
    "parent_layer",
    "first_letter",
    "last_letter",
    "hero_baseline",
    "hero_top",
    "subject_silhouette",
  ]).default("canvas"),
});

export const TypographyStaggerOffsetSchema = z.object({
  dxPercent: z.number().default(0),
  dyPercent: z.number().default(0),
  rotationDeg: z.number().default(0),
  scaleMultiplier: z.number().positive().default(1.0),
  scaleX: z.number().positive().default(1.0),
  scaleY: z.number().positive().default(1.0),
  arcWarpDeg: z.number().default(0),
  skewXDeg: z.number().default(0),
  skewYDeg: z.number().default(0),
  stretchRatio: z.number().positive().default(1.0),
});

export const TypographyGradientStopSchema = z.object({
  color: nonEmptyString,
  offset: z.number().min(0).max(1),
});

export const TypographyFillStyleSchema = z.object({
  type: z.enum([
    "solid",
    "linear_gradient",
    "radial_gradient",
    "mesh_gradient",
    "texture_fill",
    "image_in_type",
  ]).default("solid"),
  color: z.string().optional(),
  angleDeg: z.number().optional(),
  stops: z.array(TypographyGradientStopSchema).optional(),
  assetUrl: z.string().optional(),
  fit: z.enum(["cover", "contain", "repeat"]).optional(),
  blendMode: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
});

export const TypographyStrokeSchema = z.object({
  enabled: z.boolean().default(false),
  color: z.string().default("#000000"),
  widthPx: z.number().nonnegative().default(1),
  align: z.enum(["outside", "inside", "center"]).default("outside"),
  dashArray: z.string().optional(),
});

export const TypographyDropShadowSchema = z.object({
  color: z.string().default("rgba(0,0,0,0.8)"),
  blurPx: z.number().nonnegative().default(8),
  offsetX: z.number().default(0),
  offsetY: z.number().default(4),
  opacity: z.number().min(0).max(1).default(1),
  spreadPx: z.number().optional(),
});

export const TypographyGlowSchema = z.object({
  enabled: z.boolean().default(false),
  color: z.string().default("#FFFFFF"),
  blurPx: z.number().nonnegative().default(16),
  spreadPx: z.number().default(0),
  intensity: z.number().min(0).max(3).default(1),
  inner: z.boolean().default(false),
});

export const TypographyBevelSchema = z.object({
  enabled: z.boolean().default(false),
  highlightColor: z.string().default("rgba(255,255,255,0.7)"),
  shadowColor: z.string().default("rgba(0,0,0,0.7)"),
  angleDeg: z.number().default(135),
  depthPx: z.number().nonnegative().default(2),
  softnessPx: z.number().nonnegative().default(1),
});

export const TypographyMaterialitySchema = z.object({
  dropShadow: TypographyDropShadowSchema.optional(),
  multiShadows: z.array(TypographyDropShadowSchema).optional(),
  glow: TypographyGlowSchema.optional(),
  bevel: TypographyBevelSchema.optional(),
  grain: z.object({
    opacity: z.number().min(0).max(1).default(0.05),
    blendMode: z.string().default("overlay"),
  }).optional(),
  glitch: z.object({
    intensity: z.number().min(0).max(1).default(0),
    rgbSplitPx: z.number().default(0),
  }).optional(),
  opacity: z.number().min(0).max(1).default(1),
  blendMode: z.string().default("normal"),
});

export const TypographyAnnotationSchema = z.object({
  type: z.enum([
    "highlight_box",
    "circle",
    "underline",
    "strikethrough",
    "scribble",
    "arrow",
    "sticker",
    "bracket",
    "badge",
    "leader_dot",
  ]),
  target: z.enum(["word", "clause", "hero", "keyword", "character"]).default("word"),
  targetKeyword: z.string().optional(),
  color: z.string().default("#FFD700"),
  fillColor: z.string().optional(),
  strokeWidthPx: z.number().positive().default(3),
  fillOpacity: z.number().min(0).max(1).optional(),
  assetUrl: z.string().optional(),
  animation: z.enum(["draw", "fade", "pop", "wiggle", "slide", "none"]).default("draw"),
  timing: z.object({
    delayFrames: z.number().int().nonnegative().optional(),
    durationFrames: z.number().int().positive().optional(),
  }).optional(),
  xPercent: z.number().optional(),
  yPercent: z.number().optional(),
  widthPercent: z.number().optional(),
  heightPercent: z.number().optional(),
  jitterAmount: z.number().min(0).max(1).default(0.15),
  loopOpenPercent: z.number().min(0).max(100).default(10),
  leaderLine: z.object({
    startXPercent: z.number(),
    startYPercent: z.number(),
    endXPercent: z.number(),
    endYPercent: z.number(),
    dotRadiusPx: z.number().default(4),
    hasArrowHead: z.boolean().default(false),
  }).optional(),
  position: z.object({
    top: z.string().optional(),
    bottom: z.string().optional(),
    left: z.string().optional(),
    right: z.string().optional(),
    width: z.string().optional(),
    height: z.string().optional(),
    transform: z.string().optional(),
  }).optional(),
});

export const TypographyOcclusionSchema = z.object({
  mode: z.enum([
    "none",
    "full_behind",
    "partial_head_clip",
    "torso_cut",
    "depth_plane",
  ]).default("none"),
  depthPlane: z.number().default(0),
  subjectMaskRef: z.string().optional(),
  clipBoundary: z.enum(["head", "neck", "chest", "torso", "silhouette"]).optional(),
  partialOverlapPercent: z.number().min(0).max(100).default(0),
});

export const TypographyInlineTokenSwapSchema = z.object({
  wordIndex: z.number().int().nonnegative(),
  pattern: z.string().optional(),
  fontFamily: z.string().optional(),
  color: z.string().optional(),
  fontWeight: z.union([z.number().int().min(100).max(1000), z.string()]).optional(),
  fontStyle: z.enum(["normal", "italic", "oblique"]).optional(),
  casing: z.enum(["uppercase", "lowercase", "title", "capitalize", "none"]).optional(),
  fill: TypographyFillStyleSchema.optional(),
  highlightBox: z.boolean().default(false),
});

export const TypographyFontCandidateSchema = z.object({
  candidateFamily: z.string(),
  verified: z.boolean().default(true),
  sourceAsset: z.string().optional(),
  visualWeightConfidence: z.number().min(0).max(1).default(1.0),
  classification: z.enum(["serif", "sans", "display", "script", "mono", "grotesque"]).default("serif"),
  goudyCorrectionApplied: z.boolean().default(false),
});

export const TypographyFrameTreatmentSchema = z.object({
  letterbox: z.object({
    enabled: z.boolean().default(false),
    aspect: z.string().default("2.39:1"),
    color: z.string().default("#000000"),
  }).optional(),
  grain: z.object({
    opacity: z.number().min(0).max(1).default(0.04),
  }).optional(),
  vignette: z.object({
    intensity: z.number().min(0).max(1).default(0.15),
    color: z.string().default("#000000"),
  }).optional(),
  backgroundMaterial: z.enum([
    "none",
    "paper",
    "graph_grid",
    "concrete",
    "fabric",
    "metallic",
    "dark_noise",
  ]).default("none"),
  materialOpacity: z.number().min(0).max(1).default(0.15),
});

export const TypographySubjectZoneSchema = z.object({
  headroomRatio: z.number().min(0).max(1).default(0.15),
  faceAvoidanceBand: z.object({
    topPercent: z.number().default(15),
    bottomPercent: z.number().default(48),
  }).optional(),
  cranialPlacementBand: z.enum([
    "supra_cranial",
    "cranial_halo",
    "chest_deck",
    "lower_flank",
  ]).default("chest_deck"),
  safeMarginPercent: z.number().default(5),
});

export const TypographyProfileLayerSchema = z.object({
  role: z.enum([
    "hero",
    "subordinate",
    "accent",
    "annotation",
    "counter",
    "eyebrow",
    "deck",
  ]),
  fontFamily: nonEmptyString,
  fontAssetUrl: z.string().trim().min(1).optional(),
  fallbackFamily: z.string().trim().min(1).optional(),
  fontWeight: z.union([z.number().int().min(100).max(1000), z.string()]).default(700),
  fontStyle: z.enum(["normal", "italic", "oblique"]).default("normal"),
  casing: z.enum(["uppercase", "lowercase", "title", "capitalize", "none"]).default("none"),
  fontSizePt: z.number().positive().optional(),
  fontSizePx: z.number().positive().optional(),
  relativeScale: z.number().positive().default(1.0),
  letterSpacingEm: z.number().default(0),
  lineHeightMultiplier: z.number().positive().default(1.15),
  maxCharsPerLine: z.number().int().positive().optional(),
  anchor: TypographyAnchorSchema.optional(),
  stagger: TypographyStaggerOffsetSchema.optional(),
  fill: TypographyFillStyleSchema.optional(),
  stroke: TypographyStrokeSchema.optional(),
  materiality: TypographyMaterialitySchema.optional(),
  occlusion: TypographyOcclusionSchema.optional(),
  inlineTokenSwaps: z.array(TypographyInlineTokenSwapSchema).default([]),
  candidates: z.array(TypographyFontCandidateSchema).optional(),
  zIndex: z.number().int().default(10),
  behindSubject: z.boolean().default(false),
});

export const TypographyProfileV2Schema = z.object({
  version: z.literal("typography-profile-v2").default("typography-profile-v2"),
  profileId: nonEmptyString,
  name: nonEmptyString,
  category: z.enum([
    "cinematic",
    "editorial",
    "luxury",
    "tech",
    "streetwear",
    "minimal",
    "brutalist",
    "cranial",
  ]).default("editorial"),
  aspectCompatible: z.array(z.string()).default(["9:16"]),
  layers: z.array(TypographyProfileLayerSchema).min(1),
  annotations: z.array(TypographyAnnotationSchema).default([]),
  frameTreatment: TypographyFrameTreatmentSchema.optional(),
  subjectZone: TypographySubjectZoneSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type TypographyAnchor = z.infer<typeof TypographyAnchorSchema>;
export type TypographyStaggerOffset = z.infer<typeof TypographyStaggerOffsetSchema>;
export type TypographyGradientStop = z.infer<typeof TypographyGradientStopSchema>;
export type TypographyFillStyle = z.infer<typeof TypographyFillStyleSchema>;
export type TypographyStroke = z.infer<typeof TypographyStrokeSchema>;
export type TypographyDropShadow = z.infer<typeof TypographyDropShadowSchema>;
export type TypographyGlow = z.infer<typeof TypographyGlowSchema>;
export type TypographyBevel = z.infer<typeof TypographyBevelSchema>;
export type TypographyMateriality = z.infer<typeof TypographyMaterialitySchema>;
export type TypographyAnnotation = z.infer<typeof TypographyAnnotationSchema>;
export type TypographyOcclusion = z.infer<typeof TypographyOcclusionSchema>;
export type TypographyInlineTokenSwap = z.infer<typeof TypographyInlineTokenSwapSchema>;
export type TypographyFontCandidate = z.infer<typeof TypographyFontCandidateSchema>;
export type TypographyFrameTreatment = z.infer<typeof TypographyFrameTreatmentSchema>;
export type TypographySubjectZone = z.infer<typeof TypographySubjectZoneSchema>;
export type TypographyProfileLayer = z.infer<typeof TypographyProfileLayerSchema>;
export type TypographyProfileV2 = z.infer<typeof TypographyProfileV2Schema>;
