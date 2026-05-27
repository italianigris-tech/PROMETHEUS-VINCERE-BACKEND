import type {FailureVisibilityRecord} from "../failure-intelligence";
import {summarizeFailureVisibility} from "../failure-intelligence";
import type {ModelRoute} from "../model-routing";
import type {TemporalGovernorReport} from "../temporal-governor";

export type CognitiveDiagnosticsReport = {
  schemaHealth: number;
  renderHealth: number;
  pacingHealth: number;
  typographyHealth: number;
  assetHealth: number;
  timingHealth: number;
  cognitiveConfidence: number;
  orchestrationConfidence: number;
  temporalConfidence: number;
  modelConfidence: number;
  hallucinationProbability: number;
  missingAssetStates: string[];
  fontLoadingStates: string[];
  renderSyncHealth: number;
  degradedStages: string[];
  visibleFailures: FailureVisibilityRecord[];
  modelRoutes: ModelRoute[];
  generatedAt: string;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const round = (value: number): number => Number(value.toFixed(3));

export const buildDiagnosticsReport = ({
  failures = [],
  temporal,
  modelRoutes = [],
  missingAssetStates = [],
  fontLoadingStates = [],
  renderWarnings = []
}: {
  failures?: FailureVisibilityRecord[];
  temporal?: TemporalGovernorReport | null;
  modelRoutes?: ModelRoute[];
  missingAssetStates?: string[];
  fontLoadingStates?: string[];
  renderWarnings?: string[];
}): CognitiveDiagnosticsReport => {
  const failureSummary = summarizeFailureVisibility(failures);
  const configuredRouteRatio = modelRoutes.length > 0
    ? modelRoutes.filter((route) => route.configured).length / modelRoutes.length
    : 1;
  const hallucinationProbability = failureSummary.maxHallucinationProbability;
  const degradationPenalty = Math.min(0.5, failureSummary.degradedStageCount * 0.08);
  const renderPenalty = Math.min(0.4, renderWarnings.length * 0.08);
  const assetPenalty = Math.min(0.4, missingAssetStates.length * 0.08);
  const fontPenalty = Math.min(0.4, fontLoadingStates.filter((state) => /missing|failed|fallback/i.test(state)).length * 0.08);
  const temporalConfidence = temporal?.temporalHealthScore ?? 1;

  return {
    schemaHealth: round(clamp01(1 - failures.filter((failure) => Boolean(failure.schemaMismatch)).length * 0.16)),
    renderHealth: round(clamp01(1 - renderPenalty)),
    pacingHealth: round(temporal?.pacingConfidenceScore ?? 1),
    typographyHealth: round(clamp01(1 - fontPenalty)),
    assetHealth: round(clamp01(1 - assetPenalty)),
    timingHealth: round(temporal?.rhythmContinuityScore ?? 1),
    cognitiveConfidence: round(clamp01(1 - degradationPenalty - hallucinationProbability * 0.35)),
    orchestrationConfidence: round(clamp01((configuredRouteRatio * 0.6) + (temporalConfidence * 0.4) - degradationPenalty)),
    temporalConfidence: round(temporalConfidence),
    modelConfidence: round(configuredRouteRatio),
    hallucinationProbability: round(hallucinationProbability),
    missingAssetStates,
    fontLoadingStates,
    renderSyncHealth: round(clamp01((temporal?.rhythmContinuityScore ?? 1) - renderPenalty)),
    degradedStages: failures.map((failure) => failure.degradedStage).filter((stage): stage is string => Boolean(stage)),
    visibleFailures: failures,
    modelRoutes,
    generatedAt: new Date().toISOString()
  };
};
