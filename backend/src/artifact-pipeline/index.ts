import type {FailureVisibilityRecord} from "../failure-intelligence";

export type ArtifactStageStatus = "pending" | "running" | "completed" | "degraded" | "failed";

export type ArtifactStageContext = {
  jobId: string;
  startedAt: string;
  diagnostics: ArtifactStageDiagnostic[];
  failures: FailureVisibilityRecord[];
};

export type ArtifactStageResult<TArtifact = unknown> = {
  stageId: string;
  status: ArtifactStageStatus;
  artifact: TArtifact | null;
  confidence: number;
  diagnostics: ArtifactStageDiagnostic[];
  failures: FailureVisibilityRecord[];
};

export type ArtifactStageDiagnostic = {
  stageId: string;
  status: ArtifactStageStatus;
  confidence: number;
  message: string;
  artifactKeys: string[];
  startedAt: string;
  completedAt: string;
};

export type ArtifactStage<TInput = unknown, TArtifact = unknown> = {
  id: string;
  artifactKeys: string[];
  run: (input: TInput, context: ArtifactStageContext) => Promise<ArtifactStageResult<TArtifact>>;
};

export type ArtifactPipelineResult = {
  jobId: string;
  status: "completed" | "degraded" | "failed";
  diagnostics: ArtifactStageDiagnostic[];
  failures: FailureVisibilityRecord[];
  completedStageIds: string[];
};

const nowIso = (): string => new Date().toISOString();
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const createArtifactStageResult = <TArtifact>({
  stageId,
  status,
  artifact,
  confidence,
  message,
  artifactKeys,
  startedAt,
  failures = []
}: {
  stageId: string;
  status: ArtifactStageStatus;
  artifact: TArtifact | null;
  confidence: number;
  message: string;
  artifactKeys: string[];
  startedAt: string;
  failures?: FailureVisibilityRecord[];
}): ArtifactStageResult<TArtifact> => {
  const completedAt = nowIso();
  const diagnostic = {
    stageId,
    status,
    confidence: clamp01(confidence),
    message,
    artifactKeys,
    startedAt,
    completedAt
  };

  return {
    stageId,
    status,
    artifact,
    confidence: diagnostic.confidence,
    diagnostics: [diagnostic],
    failures
  };
};

export const runArtifactPipeline = async <TInput>({
  jobId,
  input,
  stages
}: {
  jobId: string;
  input: TInput;
  stages: Array<ArtifactStage<TInput, unknown>>;
}): Promise<ArtifactPipelineResult> => {
  const context: ArtifactStageContext = {
    jobId,
    startedAt: nowIso(),
    diagnostics: [],
    failures: []
  };
  const completedStageIds: string[] = [];
  let status: ArtifactPipelineResult["status"] = "completed";

  for (const stage of stages) {
    const result = await stage.run(input, context);
    context.diagnostics.push(...result.diagnostics);
    context.failures.push(...result.failures);

    if (result.status === "failed") {
      status = "failed";
      break;
    }
    if (result.status === "degraded") {
      status = status === "failed" ? "failed" : "degraded";
    }
    completedStageIds.push(stage.id);
  }

  return {
    jobId,
    status,
    diagnostics: context.diagnostics,
    failures: context.failures,
    completedStageIds
  };
};
