import {describe, expect, it} from "vitest";

import {
  ArtifactStageEngine,
  CognitiveGovernor,
  InMemoryStageArtifactStore,
  TemporalConsistencyEngine,
  TimelineIntegrityValidator,
  TypographyOrchestrator,
  UnifiedAssetRegistry,
  createStageDiagnostics,
  type CognitiveArtifactStage,
  type StageExecutionContext
} from "../index";

describe("cognitive engine contracts", () => {
  it("turns thrown stage errors into visible cognitive failure reports", async () => {
    const brokenStage: CognitiveArtifactStage = {
      name: "SemanticIntentStage",
      async execute() {
        throw new Error("Groq schema returned invalid caption intent");
      },
      async rollback() {},
      async retry(_context: StageExecutionContext) {
        throw new Error("Groq schema returned invalid caption intent");
      },
      diagnostics() {
        return createStageDiagnostics({
          stage: "SemanticIntentStage",
          health: "pending",
          healthScore: 0,
          confidence: 0,
          latencyMs: 0
        });
      },
      healthScore() {
        return 0;
      }
    };

    const engine = new ArtifactStageEngine([brokenStage], new InMemoryStageArtifactStore());
    const result = await engine.execute({jobId: "job-visible-failure", artifacts: {}});

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.visible).toBe(true);
    expect(result.failures[0]?.fallbackRationale).toBeNull();
    expect(result.diagnostics[0]?.health).toBe("failed");
  });

  it("builds a temporal graph with continuity and repetition memory", () => {
    const graph = new TemporalConsistencyEngine().buildTemporalStateGraph([
      {id: "a", startMs: 0, endMs: 1000, emotionalTone: "calm", requestedIntensity: 0.2, typographyEscalation: 0.1, cameraEscalation: 0.2, overlayEscalation: 0.1, soundEscalation: 0.1},
      {id: "b", startMs: 1000, endMs: 2200, emotionalTone: "calm", requestedIntensity: 0.7, typographyEscalation: 0.8, cameraEscalation: 0.7, overlayEscalation: 0.6, soundEscalation: 0.6},
      {id: "c", startMs: 2200, endMs: 3600, emotionalTone: "release", requestedIntensity: 0.35, typographyEscalation: 0.3, cameraEscalation: 0.3, overlayEscalation: 0.2, soundEscalation: 0.2}
    ]);

    expect(graph.intensityCurve).toHaveLength(3);
    expect(graph.repetitionHeatmap[1]).toBeGreaterThan(0);
    expect(graph.rhythmContinuity).toBeGreaterThan(0);
  });

  it("surfaces Zilliz typography degradation and uses the local premium registry", async () => {
    const orchestrator = new TypographyOrchestrator({
      async resolveFontsByVibe() {
        throw new Error("Typography retrieval returned no compatible font files.");
      }
    });

    const manifest = await orchestrator.createTypographyManifest({
      intentTags: ["cinematic", "editorial"]
    });

    expect(manifest.degradation?.visible).toBe(true);
    expect(manifest.selectedFamilies.some((font) => font.source === "local-premium-registry")).toBe(true);
    expect(manifest.diagnostics.fallbackActivated).toBe(true);
  });

  it("flags one-second playback style duration corruption", () => {
    const result = new TimelineIntegrityValidator().validate({
      durationMs: 1000,
      sourceDurationMs: 12000,
      fps: 30,
      durationInFrames: 30
    });

    expect(result.valid).toBe(false);
    expect(result.expectedFrames).toBe(360);
    expect(result.failures.map((failure) => failure.message).join("\n")).toContain("does not match canonical source duration");
  });

  it("does not hide missing assets", () => {
    const registry = new UnifiedAssetRegistry();
    const result = registry.resolve("missing-overlay");

    expect(result.asset).toBeNull();
    expect(result.failures[0]?.visible).toBe(true);
  });

  it("governor blocks low-confidence subsystems from mutating manifests", () => {
    const decision = new CognitiveGovernor().decide({
      subsystem: "groq-creative-synthesis",
      stageConfidence: 0.2,
      temporalHealth: 0.4,
      schemaHealth: 0.5,
      latencyBudgetMs: 300
    });

    expect(decision.allowed).toBe(false);
    expect(decision.mayMutateManifest).toBe(false);
  });
});
