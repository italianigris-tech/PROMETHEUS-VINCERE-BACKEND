import {
  createFailureReport,
  createStageDiagnostics,
  type CognitiveFailureReport,
  type StageDiagnostics
} from "../contracts/manifests";
import type {
  CognitiveArtifactStage,
  StageArtifactStore,
  StageExecutionContext,
  StageExecutionResult
} from "./types";

export type ArtifactStageEngineResult = {
  jobId: string;
  artifacts: Record<string, unknown>;
  diagnostics: StageDiagnostics[];
  failures: CognitiveFailureReport[];
};

export class ArtifactStageEngine {
  constructor(
    private readonly stages: CognitiveArtifactStage[],
    private readonly store: StageArtifactStore
  ) {}

  async execute(initialContext: StageExecutionContext): Promise<ArtifactStageEngineResult> {
    const context: StageExecutionContext = {
      ...initialContext,
      artifacts: {...initialContext.artifacts}
    };
    const diagnostics: StageDiagnostics[] = [];
    const failures: CognitiveFailureReport[] = [];

    for (const stage of this.stages) {
      const startedAt = Date.now();

      try {
        const result = await stage.execute(context);
        diagnostics.push(result.diagnostics);
        failures.push(...result.failures);

        if (result.artifact !== null) {
          context.artifacts[stage.name] = result.artifact;
        }

        await this.store.saveStageResult(context.jobId, result);

        if (result.failures.some((failure) => failure.visible)) {
          break;
        }
      } catch (error) {
        const failure = createFailureReport({
          stage: stage.name,
          message: error instanceof Error ? error.message : String(error),
          failingSchema: `${stage.name}.output`,
          retryAttempts: 0,
          confidenceCollapse: 1,
          degradedSubsystems: [stage.name]
        });
        const diagnostic = createStageDiagnostics({
          stage: stage.name,
          health: "failed",
          healthScore: 0,
          confidence: 0,
          latencyMs: Date.now() - startedAt,
          schemaHealth: 0,
          fallbackActivated: false,
          warnings: [failure.message]
        });
        const result: StageExecutionResult = {
          stage: stage.name,
          artifact: null,
          diagnostics: diagnostic,
          failures: [failure]
        };

        diagnostics.push(diagnostic);
        failures.push(failure);
        await this.store.saveStageResult(context.jobId, result);
        break;
      }
    }

    return {
      jobId: context.jobId,
      artifacts: context.artifacts,
      diagnostics,
      failures
    };
  }
}
