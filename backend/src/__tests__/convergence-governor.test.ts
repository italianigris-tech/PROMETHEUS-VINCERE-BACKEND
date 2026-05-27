import {describe, expect, it} from "vitest";

import {loadEnv} from "../config";
import {decideCognitiveStage} from "../cognitive-governor";
import {createFailureVisibilityRecord} from "../failure-intelligence";
import {buildModelRoutingTable, routeModel} from "../model-routing";
import {evaluateTemporalContinuity} from "../temporal-governor";
import {buildDiagnosticsReport} from "../diagnostics";

describe("Prometheus convergence governor", () => {
  it("routes critic, temporal, ocular, and deterministic authority explicitly", () => {
    const env = loadEnv({
      OPENAI_API_KEY: "openai-test",
      GROQ_API_KEY: "groq-test",
      PRIMARY_GENERATION_MODEL: "gpt-5",
      CRITIC_MODEL: "gpt-5.5",
      TEMPORAL_MODEL: "prometheus-temporal-deterministic",
      OCULAR_MODEL: "future-ocular-adapter"
    });

    const table = buildModelRoutingTable(env);

    expect(table.primaryGeneration.provider).toBe("openai");
    expect(table.primaryGeneration.model).toBe("gpt-5");
    expect(table.critic.provider).toBe("openai");
    expect(table.critic.model).toBe("gpt-5.5");
    expect(table.temporal.provider).toBe("local-deterministic");
    expect(table.ocular.provider).toBe("future-ocular");

    const deterministic = routeModel(env, {
      purpose: "deterministic",
      stage: "render",
      allowStochastic: false
    });

    expect(deterministic.provider).toBe("local-deterministic");
    expect(deterministic.stochasticAllowed).toBe(false);
  });

  it("scores temporal continuity and exposes repetition pressure", () => {
    const report = evaluateTemporalContinuity([
      {id: "s1", startMs: 0, endMs: 1000, energy: 0.9, importance: 0.95, momentType: "hook", typographyMode: "hero", motionMode: "active"},
      {id: "s2", startMs: 1000, endMs: 2200, energy: 0.88, importance: 0.9, momentType: "hook", typographyMode: "hero", motionMode: "active"},
      {id: "s3", startMs: 2200, endMs: 4200, energy: 0.35, importance: 0.5, momentType: "explain", typographyMode: "body", motionMode: "subtle"}
    ]);

    expect(report.sequenceMemory.sceneCount).toBe(3);
    expect(report.sequenceMemory.repeatedMomentTypeCount).toBe(1);
    expect(report.antiRepetition.enforced).toBe(true);
    expect(report.temporalHealthScore).toBeLessThan(1);
    expect(report.pacingMap).toHaveLength(3);
  });

  it("blocks cognitive stages when visible failures exist", () => {
    const env = loadEnv({
      GROQ_API_KEY: "groq-test"
    });
    const failure = createFailureVisibilityRecord({
      stage: "planning",
      code: "schema_mismatch",
      severity: "error",
      failureReason: "LLM returned invalid JSON",
      schemaMismatch: "Expected EditPlan schema"
    });

    const decision = decideCognitiveStage({
      env,
      stage: "motion",
      failures: [failure]
    });

    expect(decision.stagePermission).toBe("blocked");
    expect(decision.failurePolicy.silentFallbackAllowed).toBe(false);
    expect(decision.retryBudget).toBe(0);
  });

  it("rolls model, temporal, and failure state into one diagnostics surface", () => {
    const failure = createFailureVisibilityRecord({
      stage: "typography",
      code: "font_missing",
      severity: "warning",
      failureReason: "Requested font asset missing",
      fallbackCause: "offline-safe font chain"
    });
    const temporal = evaluateTemporalContinuity([
      {id: "s1", startMs: 0, endMs: 1000, energy: 0.5, importance: 0.6, momentType: "setup"}
    ]);
    const report = buildDiagnosticsReport({
      failures: [failure],
      temporal,
      modelRoutes: [
        {
          provider: "local-deterministic",
          model: "prometheus-deterministic",
          purpose: "deterministic",
          stage: "render",
          stochasticAllowed: false,
          latencyBudgetMs: 2500,
          configured: true,
          reason: "test",
          envKeys: []
        }
      ],
      fontLoadingStates: ["fallback font chain activated"]
    });

    expect(report.visibleFailures).toHaveLength(1);
    expect(report.hallucinationProbability).toBeGreaterThan(0);
    expect(report.typographyHealth).toBeLessThan(1);
    expect(report.temporalConfidence).toBe(temporal.temporalHealthScore);
  });
});
