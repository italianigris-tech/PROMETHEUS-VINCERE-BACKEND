import type {
  CognitiveFailureReport,
  StageDiagnostics
} from "../contracts/manifests";

export type CognitiveTelemetrySnapshot = {
  stageHealth: StageDiagnostics[];
  failures: CognitiveFailureReport[];
  confidence: {
    orchestration: number;
    temporal: number;
    typography: number;
    assets: number;
  };
  degraded: boolean;
};

export class CognitiveTelemetryLayer {
  buildSnapshot(input: {
    diagnostics: StageDiagnostics[];
    failures: CognitiveFailureReport[];
  }): CognitiveTelemetrySnapshot {
    const confidenceForStage = (stage: string): number => {
      const matches = input.diagnostics.filter((diagnostic) => diagnostic.stage.includes(stage));
      if (matches.length === 0) {
        return 1;
      }
      return matches.reduce((total, diagnostic) => total + diagnostic.confidence, 0) / matches.length;
    };

    return {
      stageHealth: input.diagnostics,
      failures: input.failures,
      confidence: {
        orchestration: input.diagnostics.length === 0
          ? 1
          : input.diagnostics.reduce((total, diagnostic) => total + diagnostic.confidence, 0) / input.diagnostics.length,
        temporal: confidenceForStage("Temporal"),
        typography: confidenceForStage("Typography"),
        assets: confidenceForStage("Asset")
      },
      degraded: input.failures.some((failure) => failure.visible)
    };
  }
}
