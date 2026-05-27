import type {BackendEnv} from "../config";

export type ModelProvider = "openai" | "groq" | "local-deterministic" | "future-visual" | "future-ocular";

export type ModelPurpose =
  | "primary-generation"
  | "cinematic-critic"
  | "temporal-governance"
  | "embedding"
  | "ocular-analysis"
  | "deterministic";

export type ModelRouteRequest = {
  purpose: ModelPurpose;
  stage: string;
  allowStochastic: boolean;
  latencyBudgetMs?: number;
  requiresVision?: boolean;
  requiresCritic?: boolean;
};

export type ModelRoute = {
  provider: ModelProvider;
  model: string;
  purpose: ModelPurpose;
  stage: string;
  stochasticAllowed: boolean;
  latencyBudgetMs: number;
  configured: boolean;
  reason: string;
  envKeys: string[];
};

export type ModelRoutingTable = {
  primaryGeneration: ModelRoute;
  critic: ModelRoute;
  temporal: ModelRoute;
  embedding: ModelRoute;
  ocular: ModelRoute;
};

const hasValue = (value: string | undefined | null): boolean => Boolean(value?.trim());

const providerForModel = (model: string, fallback: ModelProvider): ModelProvider => {
  const normalized = model.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (normalized.startsWith("gpt-")) {
    return "openai";
  }
  if (normalized.includes("llama") || normalized.includes("mixtral") || normalized.includes("groq")) {
    return "groq";
  }
  if (normalized.includes("ocular") || normalized.includes("vision")) {
    return "future-ocular";
  }
  return fallback;
};

const routeFromConfig = ({
  env,
  purpose,
  stage,
  configuredModel,
  fallbackModel,
  fallbackProvider,
  allowStochastic,
  latencyBudgetMs,
  reason,
  envKeys
}: {
  env: BackendEnv;
  purpose: ModelPurpose;
  stage: string;
  configuredModel: string;
  fallbackModel: string;
  fallbackProvider: ModelProvider;
  allowStochastic: boolean;
  latencyBudgetMs: number;
  reason: string;
  envKeys: string[];
}): ModelRoute => {
  const model = configuredModel.trim() || fallbackModel;
  const provider = providerForModel(model, fallbackProvider);
  const configured =
    provider === "local-deterministic" ||
    (provider === "openai" && hasValue(env.OPENAI_API_KEY)) ||
    (provider === "groq" && hasValue(env.GROQ_API_KEY)) ||
    provider === "future-visual" ||
    provider === "future-ocular";

  return {
    provider,
    model,
    purpose,
    stage,
    stochasticAllowed: allowStochastic,
    latencyBudgetMs,
    configured,
    reason,
    envKeys
  };
};

export const routeModel = (env: BackendEnv, request: ModelRouteRequest): ModelRoute => {
  const latencyBudgetMs = request.latencyBudgetMs ?? 2500;

  if (!request.allowStochastic || request.purpose === "deterministic") {
    return {
      provider: "local-deterministic",
      model: "prometheus-deterministic",
      purpose: request.purpose,
      stage: request.stage,
      stochasticAllowed: false,
      latencyBudgetMs,
      configured: true,
      reason: "Deterministic authority selected because stochastic generation is not allowed for this stage.",
      envKeys: []
    };
  }

  if (request.requiresVision || request.purpose === "ocular-analysis") {
    return routeFromConfig({
      env,
      purpose: request.purpose,
      stage: request.stage,
      configuredModel: env.OCULAR_MODEL,
      fallbackModel: "future-ocular-adapter",
      fallbackProvider: "future-ocular",
      allowStochastic: request.allowStochastic,
      latencyBudgetMs,
      reason: "Ocular analysis route selected for future frame-aware cognition.",
      envKeys: ["OCULAR_MODEL", "OPENAI_API_KEY"]
    });
  }

  if (request.requiresCritic || request.purpose === "cinematic-critic") {
    return routeFromConfig({
      env,
      purpose: request.purpose,
      stage: request.stage,
      configuredModel: env.CRITIC_MODEL,
      fallbackModel: "gpt-5.5",
      fallbackProvider: "openai",
      allowStochastic: request.allowStochastic,
      latencyBudgetMs,
      reason: "Critic route selected; generation authority remains outside the critic.",
      envKeys: ["CRITIC_MODEL", "OPENAI_API_KEY"]
    });
  }

  if (request.purpose === "temporal-governance") {
    return routeFromConfig({
      env,
      purpose: request.purpose,
      stage: request.stage,
      configuredModel: env.TEMPORAL_MODEL,
      fallbackModel: "prometheus-temporal-deterministic",
      fallbackProvider: "local-deterministic",
      allowStochastic: request.allowStochastic,
      latencyBudgetMs,
      reason: "Temporal route selected for continuity and pacing judgment.",
      envKeys: ["TEMPORAL_MODEL"]
    });
  }

  if (request.purpose === "embedding") {
    return routeFromConfig({
      env,
      purpose: request.purpose,
      stage: request.stage,
      configuredModel: env.EMBEDDING_MODEL,
      fallbackModel: "BAAI/bge-small-en-v1.5",
      fallbackProvider: "local-deterministic",
      allowStochastic: false,
      latencyBudgetMs,
      reason: "Embedding route selected for retrieval and similarity.",
      envKeys: ["EMBEDDING_MODEL", "EMBEDDING_API_KEY"]
    });
  }

  return routeFromConfig({
    env,
    purpose: request.purpose,
    stage: request.stage,
    configuredModel: env.PRIMARY_GENERATION_MODEL,
    fallbackModel: env.GROQ_MODEL || "llama-3.3-70b-versatile",
    fallbackProvider: "groq",
    allowStochastic: request.allowStochastic,
    latencyBudgetMs,
    reason: "Primary generation route selected for backend-owned cognitive orchestration.",
    envKeys: ["PRIMARY_GENERATION_MODEL", "OPENAI_API_KEY", "GROQ_API_KEY"]
  });
};

export const buildModelRoutingTable = (env: BackendEnv): ModelRoutingTable => ({
  primaryGeneration: routeModel(env, {
    purpose: "primary-generation",
    stage: "cognitive-orchestration",
    allowStochastic: true
  }),
  critic: routeModel(env, {
    purpose: "cinematic-critic",
    stage: "critic-review",
    allowStochastic: true,
    requiresCritic: true
  }),
  temporal: routeModel(env, {
    purpose: "temporal-governance",
    stage: "temporal-synthesis",
    allowStochastic: false
  }),
  embedding: routeModel(env, {
    purpose: "embedding",
    stage: "asset-retrieval",
    allowStochastic: false
  }),
  ocular: routeModel(env, {
    purpose: "ocular-analysis",
    stage: "ocular-analysis",
    allowStochastic: true,
    requiresVision: true
  })
});
