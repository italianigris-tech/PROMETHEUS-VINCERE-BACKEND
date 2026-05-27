import type {BackendEnv} from "../config";
import type {FailureVisibilityRecord} from "../failure-intelligence";
import {routeModel, type ModelRoute} from "../model-routing";
import {evaluateTemporalContinuity, type TemporalGovernorReport, type TemporalSceneInput} from "../temporal-governor";

export type CognitiveStage =
  | "source"
  | "transcript"
  | "planning"
  | "cinematic-strategy"
  | "typography"
  | "motion"
  | "asset-retrieval"
  | "audio"
  | "render"
  | "diagnostics"
  | "pattern-memory"
  | "temporal-synthesis";

export type CognitiveGovernorDecision = {
  stage: CognitiveStage;
  stagePermission: "allow-deterministic" | "allow-stochastic" | "critic-only" | "blocked";
  confidenceThreshold: number;
  stochasticAllowed: boolean;
  retryBudget: number;
  visualEscalationAllowed: boolean;
  selectedModelRoute: ModelRoute;
  temporalReport: TemporalGovernorReport | null;
  failurePolicy: {
    visibleFailureRequired: true;
    silentFallbackAllowed: false;
    degradedOutputAllowed: boolean;
  };
  reasons: string[];
};

const stageThresholds: Record<CognitiveStage, number> = {
  source: 0.92,
  transcript: 0.9,
  planning: 0.78,
  "cinematic-strategy": 0.8,
  typography: 0.86,
  motion: 0.82,
  "asset-retrieval": 0.8,
  audio: 0.84,
  render: 0.9,
  diagnostics: 0.95,
  "pattern-memory": 0.82,
  "temporal-synthesis": 0.86
};

export const decideCognitiveStage = ({
  env,
  stage,
  scenes = [],
  failures = [],
  latencyBudgetMs
}: {
  env: BackendEnv;
  stage: CognitiveStage;
  scenes?: TemporalSceneInput[];
  failures?: FailureVisibilityRecord[];
  latencyBudgetMs?: number;
}): CognitiveGovernorDecision => {
  const temporalReport = scenes.length > 0 ? evaluateTemporalContinuity(scenes) : null;
  const recentError = failures.some((failure) => failure.severity === "error");
  const temporalWeak = temporalReport ? temporalReport.temporalHealthScore < 0.72 : false;
  const stochasticAllowed = !["source", "transcript", "render", "diagnostics"].includes(stage) && !recentError;
  const requiresCritic = stage === "cinematic-strategy" || stage === "typography" || temporalWeak;
  const purpose = stage === "temporal-synthesis"
    ? "temporal-governance"
    : requiresCritic
      ? "cinematic-critic"
      : stochasticAllowed
        ? "primary-generation"
        : "deterministic";
  const selectedModelRoute = routeModel(env, {
    purpose,
    stage,
    allowStochastic: stochasticAllowed,
    latencyBudgetMs,
    requiresCritic
  });
  const stagePermission = recentError
    ? "blocked"
    : requiresCritic
      ? "critic-only"
      : stochasticAllowed
        ? "allow-stochastic"
        : "allow-deterministic";

  return {
    stage,
    stagePermission,
    confidenceThreshold: stageThresholds[stage],
    stochasticAllowed,
    retryBudget: stagePermission === "blocked" ? 0 : stage === "render" ? 1 : 2,
    visualEscalationAllowed: stage === "motion" || stage === "asset-retrieval" || stage === "cinematic-strategy",
    selectedModelRoute,
    temporalReport,
    failurePolicy: {
      visibleFailureRequired: true,
      silentFallbackAllowed: false,
      degradedOutputAllowed: stagePermission !== "blocked"
    },
    reasons: [
      `Stage ${stage} threshold is ${stageThresholds[stage]}.`,
      stochasticAllowed ? "Stochastic generation is allowed by stage policy." : "Deterministic authority is required by stage policy.",
      requiresCritic ? "Cinematic critic route selected for aesthetic or temporal review." : "Critic route not required.",
      recentError ? "Recent visible failure blocks this stage." : "No blocking visible failure present."
    ]
  };
};
