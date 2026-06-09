// packages/registry/src/validators.ts
// Zod schemas for runtime validation of Primitive Registry objects

import { z } from "zod";

export const PrimitiveCategorySchema = z.enum([
  "shader-fx",
  "deformation",
  "motion",
  "transition",
  "ui-element",
  "background",
  "camera",
  "lighting",
  "material",
]);

export const EffectScopeSchema = z.enum([
  "per-element",
  "per-group",
  "layer",
  "full-screen",
]);

export const TargetTypeSchema = z.enum([
  "text",
  "mesh",
  "ui",
  "camera",
  "scene",
  "light",
  "post-process",
]);

export const ParameterTypeSchema = z.enum([
  "number",
  "vec2",
  "vec3",
  "color",
  "boolean",
  "enum",
  "easing",
  "curve",
]);

export const ParameterDefSchema = z.object({
  key: z.string().min(1),
  type: ParameterTypeSchema,
  default: z.unknown(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  options: z.array(z.string()).optional(),
  description: z.string().min(1),
  impact: z.enum(["subtle", "noticeable", "dramatic"]),
  animatable: z.boolean(),
});

export const ParameterSchemaSchema = z.object({
  parameters: z.array(ParameterDefSchema),
});

export const MaterialConfigSchema = z.object({
  type: z.enum(["MeshBasicMaterial", "MeshStandardMaterial", "ShaderMaterial", "MeshPhysicalMaterial"]),
  properties: z.record(z.unknown()),
  envMapRequired: z.boolean().optional(),
  envMapIntensity: z.number().optional(),
});

export const ImplementationSchema = z.object({
  entryPoint: z.string().min(1),
  vertexShader: z.string().optional(),
  fragmentShader: z.string().optional(),
  logicModule: z.string().min(1),
  r3fComponent: z.string().optional(),
  materialConfig: MaterialConfigSchema.optional(),
  postProcessPass: z.string().optional(),
});

export const PerformanceProfileSchema = z.object({
  gpuCost: z.enum(["negligible", "low", "medium", "high", "extreme"]),
  cpuCost: z.enum(["negligible", "low", "medium", "high"]),
  fpsImpact30: z.number(),
  fpsImpact60: z.number(),
  vramMB: z.number(),
  drawCallOverhead: z.number(),
  requiresWebGL2: z.boolean(),
  postProcessCompatible: z.boolean(),
});

export const ProvenanceSchema = z.object({
  sourceVideo: z.string().min(1),
  sourceVideoTitle: z.string().min(1),
  timestampStart: z.string().min(1),
  timestampEnd: z.string().min(1),
  frameRange: z.tuple([z.number(), z.number()]),
  extractedBy: z.enum(["human", "pipeline", "hybrid"]),
  extractionDate: z.string().min(1),
  visualVerification: z.enum(["pending", "passed", "failed", "needs-review"]),
  testScenePath: z.string().optional(),
});

export const ConfidenceScoreSchema = z.object({
  overall: z.number().min(0).max(1),
  visualAccuracy: z.number().min(0).max(1),
  codeStability: z.number().min(0).max(1),
  reuseCount: z.number().int().min(0),
  lastUsed: z.string().min(1),
  failureCount: z.number().int().min(0),
});

export const PrimitiveSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+-v\d+$/),
  name: z.string().min(1),
  category: PrimitiveCategorySchema,
  subcategory: z.string().min(1),
  description: z.string().min(1),
  visualSignature: z.string().min(1),
  implementation: ImplementationSchema,
  parameterSchema: ParameterSchemaSchema,
  scope: EffectScopeSchema,
  targetType: TargetTypeSchema,
  performanceProfile: PerformanceProfileSchema,
  provenance: ProvenanceSchema,
  confidence: ConfidenceScoreSchema,
  requires: z.array(z.string()),
  conflicts: z.array(z.string()),
  tags: z.array(z.string()),
});

export const ProvenanceEntrySchema = z.object({
  primitiveId: z.string().min(1),
  videoId: z.string().min(1),
  timestampStart: z.string().min(1),
  timestampEnd: z.string().min(1),
});

export const PrimitiveRegistrySchema = z.object({
  version: z.string().min(1),
  lastUpdated: z.string().min(1),
  primitives: z.array(PrimitiveSchema),
  archetypes: z.array(z.unknown()), // SceneArchetype validated separately
  provenanceIndex: z.array(ProvenanceEntrySchema),
});

// ── Composition Manifest Schemas ──

export const ColorRangeSchema = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const TextContentSchema = z.object({
  text: z.string().min(1),
  font: z.string().min(1),
  fontSize: z.number().positive(),
  colorRanges: z.array(ColorRangeSchema).optional(),
});

export const LayoutConfigSchema = z.object({
  position: z.string().min(1),
  margin: z.number().optional(),
  padding: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const UIContentSchema = z.object({
  componentType: z.enum(["pill", "panel", "button", "cursor", "dropdown", "loader"]),
  layout: LayoutConfigSchema,
  children: z.array(z.lazy(() => UIContentSchema)).optional(),
});

export const BackgroundContentSchema = z.object({
  type: z.enum(["shader", "video", "image", "color"]),
  primitiveId: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
});

export const PrimitiveApplicationSchema = z.object({
  primitiveId: z.string().min(1),
  parameters: z.record(z.unknown()),
  startAt: z.number().min(0),
  duration: z.number().positive(),
  easing: z.string().min(1),
  scopeOverride: EffectScopeSchema.optional(),
});

export const LayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["text", "ui", "background", "asset", "effect"]),
  zIndex: z.number().int(),
  content: z.union([TextContentSchema, UIContentSchema, BackgroundContentSchema]).optional(),
  primitives: z.array(PrimitiveApplicationSchema),
  visible: z.union([z.boolean(), z.object({ condition: z.string(), referenceLayer: z.string() })]),
});

export const PostProcessPassSchema = z.object({
  primitiveId: z.string().min(1),
  parameters: z.record(z.unknown()),
});

export const GlobalSettingsSchema = z.object({
  resolution: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  fps: z.number().int().positive(),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  postProcess: z.object({
    enabled: z.boolean(),
    passes: z.array(PostProcessPassSchema),
  }),
});

export const CameraCompositionSchema = z.object({
  primitives: z.array(PrimitiveApplicationSchema),
});

export const TimelineSegmentSchema = z.object({
  at: z.number().min(0),
  event: z.string().min(1),
  target: z.string().min(1),
});

export const CompositionManifestSchema = z.object({
  version: z.literal("7.5"),
  id: z.string().min(1),
  archetypeId: z.string().optional(),
  layers: z.array(LayerSchema),
  global: GlobalSettingsSchema,
  camera: CameraCompositionSchema,
  timeline: z.array(TimelineSegmentSchema),
});

// ── Validation Helpers ──

export function validatePrimitive(data: unknown) {
  return PrimitiveSchema.safeParse(data);
}

export function validateCompositionManifest(data: unknown) {
  return CompositionManifestSchema.safeParse(data);
}

export function validateRegistry(data: unknown) {
  return PrimitiveRegistrySchema.safeParse(data);
}
