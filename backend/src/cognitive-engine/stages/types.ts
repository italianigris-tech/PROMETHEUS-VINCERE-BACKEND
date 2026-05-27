import type {
  CognitiveFailureReport,
  CognitiveStageName,
  StageDiagnostics
} from "../contracts/manifests";

export type StageExecutionContext = {
  jobId: string;
  artifacts: Record<string, unknown>;
  signal?: AbortSignal;
};

export type StageExecutionResult<TArtifact = unknown> = {
  stage: CognitiveStageName;
  artifact: TArtifact | null;
  diagnostics: StageDiagnostics;
  failures: CognitiveFailureReport[];
};

export interface CognitiveArtifactStage<TArtifact = unknown> {
  readonly name: CognitiveStageName;
  execute(context: StageExecutionContext): Promise<StageExecutionResult<TArtifact>>;
  rollback(context: StageExecutionContext): Promise<void>;
  retry(context: StageExecutionContext, failure: CognitiveFailureReport): Promise<StageExecutionResult<TArtifact>>;
  diagnostics(): StageDiagnostics;
  healthScore(): number;
}

export interface StageArtifactStore {
  saveStageResult(jobId: string, result: StageExecutionResult): Promise<void>;
  loadStageResult(jobId: string, stage: CognitiveStageName): Promise<StageExecutionResult | null>;
}

export class InMemoryStageArtifactStore implements StageArtifactStore {
  private readonly records = new Map<string, StageExecutionResult>();

  async saveStageResult(jobId: string, result: StageExecutionResult): Promise<void> {
    this.records.set(`${jobId}:${result.stage}`, result);
  }

  async loadStageResult(jobId: string, stage: CognitiveStageName): Promise<StageExecutionResult | null> {
    return this.records.get(`${jobId}:${stage}`) ?? null;
  }
}
