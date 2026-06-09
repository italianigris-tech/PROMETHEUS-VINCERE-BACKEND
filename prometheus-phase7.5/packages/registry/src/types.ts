// packages/registry/src/types.ts
// Primitive Registry & Composition Types — Prometheus Phase 7.5

import type { Material, WebGLRenderer, Scene, Camera } from "three";
import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVE REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export interface PrimitiveRegistry {
  version: string;
  lastUpdated: string; // ISO8601
  primitives: Primitive[];
  archetypes: SceneArchetype[];
  provenanceIndex: ProvenanceEntry[];
}

export type PrimitiveCategory =
  | "shader-fx"
  | "deformation"
  | "motion"
  | "transition"
  | "ui-element"
  | "background"
  | "camera"
  | "lighting"
  | "material";

export type EffectScope =
  | "per-element"
  | "per-group"
  | "layer"
  | "full-screen";

export type TargetType =
  | "text"
  | "mesh"
  | "ui"
  | "camera"
  | "scene"
  | "light"
  | "post-process";

export interface Primitive {
  id: string;
  name: string;
  category: PrimitiveCategory;
  subcategory: string;

  description: string;
  visualSignature: string;

  implementation: Implementation;
  parameterSchema: ParameterSchema;

  scope: EffectScope;
  targetType: TargetType;

  performanceProfile: PerformanceProfile;

  provenance: Provenance;
  confidence: ConfidenceScore;

  requires: string[];
  conflicts: string[];
  tags: string[];
}

export interface Implementation {
  entryPoint: string;
  vertexShader?: string;
  fragmentShader?: string;
  logicModule: string;
  r3fComponent?: string;
  materialConfig?: MaterialConfig;
  postProcessPass?: string;
}

export interface MaterialConfig {
  type: "MeshBasicMaterial" | "MeshStandardMaterial" | "ShaderMaterial" | "MeshPhysicalMaterial";
  properties: Record<string, unknown>;
  envMapRequired?: boolean;
  envMapIntensity?: number;
}

export interface ParameterSchema {
  parameters: ParameterDef[];
}

export type ParameterType =
  | "number"
  | "vec2"
  | "vec3"
  | "color"
  | "boolean"
  | "enum"
  | "easing"
  | "curve";

export interface ParameterDef {
  key: string;
  type: ParameterType;
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  description: string;
  impact: "subtle" | "noticeable" | "dramatic";
  animatable: boolean;
}

export interface PerformanceProfile {
  gpuCost: "negligible" | "low" | "medium" | "high" | "extreme";
  cpuCost: "negligible" | "low" | "medium" | "high";
  fpsImpact30: number;
  fpsImpact60: number;
  vramMB: number;
  drawCallOverhead: number;
  requiresWebGL2: boolean;
  postProcessCompatible: boolean;
}

export interface Provenance {
  sourceVideo: string;
  sourceVideoTitle: string;
  timestampStart: string;
  timestampEnd: string;
  frameRange: [number, number];
  extractedBy: "human" | "pipeline" | "hybrid";
  extractionDate: string;
  visualVerification: "pending" | "passed" | "failed" | "needs-review";
  testScenePath?: string;
}

export interface ConfidenceScore {
  overall: number;
  visualAccuracy: number;
  codeStability: number;
  reuseCount: number;
  lastUsed: string;
  failureCount: number;
}

export interface ProvenanceEntry {
  primitiveId: string;
  videoId: string;
  timestampStart: string;
  timestampEnd: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE ARCHETYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface SceneArchetype {
  id: string;
  name: string;
  description: string;
  previewImage: string;
  tags: string[];
  baseManifest: CompositionManifest;
  customizableParameters: string[];
  parentArchetypeId?: string;
  remixCount: number;
  derivedFrom: string[];
  estimatedRenderTime: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITION MANIFEST (DCL)
// ─────────────────────────────────────────────────────────────────────────────

export interface CompositionManifest {
  version: "7.5";
  id: string;
  archetypeId?: string;
  layers: Layer[];
  global: GlobalSettings;
  camera: CameraComposition;
  timeline: TimelineSegment[];
}

export interface Layer {
  id: string;
  name: string;
  type: "text" | "ui" | "background" | "asset" | "effect";
  zIndex: number;
  content?: TextContent | UIContent | BackgroundContent;
  primitives: PrimitiveApplication[];
  visible: boolean | ConditionalVisibility;
}

export interface PrimitiveApplication {
  primitiveId: string;
  parameters: Record<string, unknown>;
  startAt: number;
  duration: number;
  easing: string;
  scopeOverride?: EffectScope;
}

export interface TextContent {
  text: string;
  font: string;
  fontSize: number;
  colorRanges?: ColorRange[];
}

export interface ColorRange {
  start: number;
  end: number;
  color: string;
}

export interface UIContent {
  componentType: "pill" | "panel" | "button" | "cursor" | "dropdown" | "loader";
  layout: LayoutConfig;
  children?: UIContent[];
}

export interface LayoutConfig {
  position: string;
  margin?: number;
  padding?: number;
  width?: number;
  height?: number;
}

export interface BackgroundContent {
  type: "shader" | "video" | "image" | "color";
  primitiveId?: string;
  parameters?: Record<string, unknown>;
}

export interface GlobalSettings {
  resolution: [number, number];
  fps: number;
  backgroundColor: string;
  postProcess: PostProcessSettings;
}

export interface PostProcessSettings {
  enabled: boolean;
  passes: PostProcessPass[];
}

export interface PostProcessPass {
  primitiveId: string;
  parameters: Record<string, unknown>;
}

export interface CameraComposition {
  primitives: PrimitiveApplication[];
}

export interface TimelineSegment {
  at: number;
  event: string;
  target: string;
}

export interface ConditionalVisibility {
  condition: string;
  referenceLayer: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REMIX
// ─────────────────────────────────────────────────────────────────────────────

export interface RemixOperation {
  baseArchetypeId: string;
  operations: RemixOp[];
}

export type RemixOp =
  | { type: "swap-primitive"; targetPath: string; newPrimitiveId: string; parameters?: Record<string, unknown> }
  | { type: "override-parameter"; targetPath: string; value: unknown }
  | { type: "add-layer"; layer: Layer; afterLayerId?: string }
  | { type: "remove-layer"; layerId: string }
  | { type: "retime"; targetPath: string; newStartAt: number; newDuration: number }
  | { type: "change-text"; layerId: string; newText: string };

// ─────────────────────────────────────────────────────────────────────────────
// LEARNING PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

export interface FrameAnalysisReport {
  videoId: string;
  totalFrames: number;
  analyzedFrames: number;
  sampleRate: number;
  segments: VideoSegment[];
  detectedTechniques: DetectedTechnique[];
  colorPalette: ColorPalette;
  motionSignature: MotionSignature;
}

export interface VideoSegment {
  id: string;
  startFrame: number;
  endFrame: number;
  startTime: string;
  endTime: string;
  description: string;
  techniques: string[];
  priority: number;
}

export interface DetectedTechnique {
  techniqueName: string;
  category: PrimitiveCategory;
  confidence: number;
  scope: EffectScope;
  affectedElements: string[];
  duration: number;
  delay: number;
  easing: string;
  parameters: Record<string, unknown>;
  isNovel: boolean;
  similarPrimitiveId?: string;
}

export interface NoveltyAssessment {
  isNovel: boolean;
  existingPrimitiveId?: string;
  differentiation: string;
  recommendation: "create-new" | "extend-existing" | "duplicate";
}

export interface ColorPalette {
  dominant: string[];
  accents: string[];
  background: string;
}

export interface MotionSignature {
  averageSpeed: number;
  easingPrevalence: Record<string, number>;
  transitionDensity: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY API
// ─────────────────────────────────────────────────────────────────────────────

export interface RegistryQuery {
  category?: PrimitiveCategory;
  targetType?: TargetType;
  scope?: EffectScope;
  tags?: string[];
  minConfidence?: number;
  search?: string;
}

export interface RegistryQueryResult {
  primitives: Primitive[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface CompiledScene {
  component: ReactNode;
  timeline: unknown; // GSAP timeline instance
  performanceEstimate: PerformanceProfile;
}
