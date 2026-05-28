import type {BackendEnv} from "./config";
import type {ExecutionTelemetryReporter} from "./execution-telemetry";
import type {PipelineDependencies, SourceAnalysis, TranscriptResolution} from "./pipeline";
import type {FileJobRepository} from "./repository";
import {
  fallbackEventSchema,
  type FallbackEvent,
  type MetadataProfile,
  type NormalizedJobRequest
} from "./schemas";

export type SourceMediaProfile = SourceAnalysis | null;

export type PreparedExecutionInputs = {
  metadataProfile: MetadataProfile;
  transcript: TranscriptResolution;
  sourceMetadata: SourceMediaProfile;
  repositories: {
    jobRepository: FileJobRepository;
  };
  telemetry: ExecutionTelemetryReporter | null;
};

export type PipelineExecutionContext = {
  request: NormalizedJobRequest;
  repository: FileJobRepository;
  env: BackendEnv;
  deps: PipelineDependencies;
  telemetry: ExecutionTelemetryReporter | null;
  assetRegistry: unknown;
  metadata: MetadataProfile | null;
  transcript: TranscriptResolution | null;
  logger: Pick<Console, "info" | "warn" | "error">;
  storage: unknown;
  sourceMediaProfile: SourceMediaProfile;
  motionTrace: {
    path: string | null;
    traceLog: string;
    motionIntelligence: Record<string, unknown>;
  } | null;
};

export const createExecutionContext = (input: {
  request: NormalizedJobRequest;
  repository: FileJobRepository;
  env: BackendEnv;
  deps: PipelineDependencies;
  logger?: Pick<Console, "info" | "warn" | "error">;
}): PipelineExecutionContext => ({
  request: input.request,
  repository: input.repository,
  env: input.env,
  deps: input.deps,
  telemetry: input.deps.executionTelemetry ?? null,
  assetRegistry: null,
  metadata: null,
  transcript: null,
  logger: input.logger ?? console,
  storage: null,
  sourceMediaProfile: null,
  motionTrace: null
});

export const recordFallbackEvent = ({
  events,
  stage,
  code,
  severity = "warning",
  message,
  details = {},
  createdAt
}: {
  events: FallbackEvent[];
  stage: string;
  code: string;
  severity?: "info" | "warning" | "error";
  message: string;
  details?: Record<string, unknown>;
  createdAt: string;
}): FallbackEvent => {
  const event = fallbackEventSchema.parse({
    code,
    stage,
    severity,
    message,
    details,
    created_at: createdAt
  });
  events.push(event);
  return event;
};
