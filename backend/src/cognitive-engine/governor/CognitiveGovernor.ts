export type IntelligenceSubsystem =
  | "deterministic-engine"
  | "gpt-5.5-critic"
  | "groq-creative-synthesis"
  | "ocular-analysis"
  | "pattern-memory"
  | "map-elites"
  | "genetic-exploration"
  | "mcts-search";

export type CognitiveGovernorDecision = {
  subsystem: IntelligenceSubsystem;
  allowed: boolean;
  reason: string;
  confidence: number;
  mayMutateManifest: boolean;
};

export class CognitiveGovernor {
  decide(input: {
    subsystem: IntelligenceSubsystem;
    stageConfidence: number;
    temporalHealth: number;
    schemaHealth: number;
    latencyBudgetMs: number;
  }): CognitiveGovernorDecision {
    const confidence = Math.max(0, Math.min(1, (
      input.stageConfidence * 0.42 +
      input.temporalHealth * 0.32 +
      input.schemaHealth * 0.26
    )));
    const allowed = confidence >= 0.58 && input.latencyBudgetMs > 0;

    return {
      subsystem: input.subsystem,
      allowed,
      reason: allowed
        ? "Subsystem may propose governed artifacts; final manifest mutation remains controlled by the governor."
        : "Subsystem blocked because confidence, temporal health, schema health, or latency budget is insufficient.",
      confidence,
      mayMutateManifest: false
    };
  }
}
