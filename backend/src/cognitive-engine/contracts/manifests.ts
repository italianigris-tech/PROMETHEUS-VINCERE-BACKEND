export type StageHealthState = "healthy" | "degraded" | "failed" | "pending";

export type CognitiveStageName =
  | "SourceAnalysisStage"
  | "TranscriptStage"
  | "MetadataStage"
  | "SemanticIntentStage"
  | "TemporalPlanningStage"
  | "TypographyStage"
  | "MotionStage"
  | "AssetRetrievalStage"
  | "PreviewArtifactStage"
  | "RenderManifestStage"
  | "QualityCriticStage";

export type StageDiagnostics = {
  stage: CognitiveStageName;
  health: StageHealthState;
  healthScore: number;
  confidence: number;
  latencyMs: number;
  retries: number;
  schemaHealth: number;
  fallbackActivated: boolean;
  fallbackReason: string | null;
  warnings: string[];
};

export type CognitiveFailureReport = {
  stage: CognitiveStageName;
  failingSchema: string | null;
  missingFields: string[];
  invalidReasoning: string[];
  retryAttempts: number;
  fallbackRationale: string | null;
  confidenceCollapse: number;
  degradedSubsystems: string[];
  message: string;
  visible: true;
};

export type TemporalStateGraph = {
  intensityCurve: number[];
  pacingCurve: number[];
  repetitionHeatmap: number[];
  rhythmContinuity: number;
  escalationMemory: Array<{
    sceneId: string;
    typography: number;
    camera: number;
    overlay: number;
    sound: number;
  }>;
  emotionalStateTimeline: Array<{
    sceneId: string;
    emotion: string;
    intensity: number;
  }>;
};

export type TypographyManifest = {
  selectedFamilies: Array<{
    role: "display" | "support" | "accent";
    familyId: string;
    familyName: string;
    source: "zilliz" | "local-premium-registry";
    publicUrls: string[];
  }>;
  diagnostics: StageDiagnostics;
  degradation: CognitiveFailureReport | null;
};

export type CreativeDecisionManifest = {
  manifestVersion: "creative-decision-manifest/v1";
  jobId: string;
  temporal: TemporalStateGraph;
  typography: TypographyManifest;
  diagnostics: StageDiagnostics[];
  failures: CognitiveFailureReport[];
  createdAt: string;
};

export type RenderManifest = {
  manifestVersion: "render-manifest/v1";
  jobId: string;
  durationMs: number;
  fps: number;
  width: number;
  height: number;
  creativeDecisionManifest: CreativeDecisionManifest;
};

export type PreviewArtifact = {
  artifactVersion: "preview-artifact/v1";
  jobId: string;
  kind: "html_composition" | "video" | "frame_state";
  url: string | null;
  renderManifest: RenderManifest;
  diagnostics: StageDiagnostics[];
};

export type FrameStateManifest = {
  manifestVersion: "frame-state-manifest/v1";
  jobId: string;
  frame: number;
  timestampMs: number;
  renderManifest: RenderManifest;
};

export const clampConfidence = (value: number): number =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export const createFailureReport = (input: {
  stage: CognitiveStageName;
  message: string;
  failingSchema?: string | null;
  missingFields?: string[];
  invalidReasoning?: string[];
  retryAttempts?: number;
  fallbackRationale?: string | null;
  confidenceCollapse?: number;
  degradedSubsystems?: string[];
}): CognitiveFailureReport => ({
  stage: input.stage,
  failingSchema: input.failingSchema ?? null,
  missingFields: input.missingFields ?? [],
  invalidReasoning: input.invalidReasoning ?? [],
  retryAttempts: input.retryAttempts ?? 0,
  fallbackRationale: input.fallbackRationale ?? null,
  confidenceCollapse: clampConfidence(input.confidenceCollapse ?? 1),
  degradedSubsystems: input.degradedSubsystems ?? [],
  message: input.message,
  visible: true
});

export const createStageDiagnostics = (input: {
  stage: CognitiveStageName;
  health: StageHealthState;
  healthScore: number;
  confidence: number;
  latencyMs: number;
  retries?: number;
  schemaHealth?: number;
  fallbackActivated?: boolean;
  fallbackReason?: string | null;
  warnings?: string[];
}): StageDiagnostics => ({
  stage: input.stage,
  health: input.health,
  healthScore: clampConfidence(input.healthScore),
  confidence: clampConfidence(input.confidence),
  latencyMs: Math.max(0, input.latencyMs),
  retries: Math.max(0, input.retries ?? 0),
  schemaHealth: clampConfidence(input.schemaHealth ?? 1),
  fallbackActivated: input.fallbackActivated ?? false,
  fallbackReason: input.fallbackReason ?? null,
  warnings: input.warnings ?? []
});
