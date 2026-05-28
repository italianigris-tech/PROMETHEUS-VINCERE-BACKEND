import type {JobRecord, JobStage} from "./schemas";

export type ExecutionComputeType = "CPU" | "IO" | "GPU";
export type ExecutionStageStatus = "pending" | "active" | "completed" | "failed" | "skipped";
export type ExecutionEtaConfidence = "low" | "medium" | "high";

export type ExecutionTelemetryEventType =
  | "JOB_CREATED"
  | "STAGE_STARTED"
  | "STAGE_PROGRESS"
  | "STAGE_COMPLETED"
  | "STAGE_FAILED"
  | "ETA_UPDATED"
  | "COMPUTE_PROFILE_UPDATED"
  | "ROUTED_TO_EXECUTOR"
  | "MOTION_INTELLIGENCE_PLANNED"
  | "SEGMENTING"
  | "SCORING"
  | "RANKING"
  | "CLIP_READY"
  | "MUSIC_ALIGNED";

export type ExecutionComputeProfile = {
  cpuLoad: number;
  gpuLoad: number;
  ioLoad: number;
  activeComputeType: ExecutionComputeType | null;
  sampledAt: string;
};

export type ExecutionStageVisibility = {
  id: JobStage;
  name: string;
  type: string;
  status: ExecutionStageStatus;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  estimatedDurationMs: number;
  computeType: ExecutionComputeType;
  metadata: Record<string, unknown>;
};

export type ExecutionVisibilityContract = {
  jobId: string;
  status: JobRecord["status"];
  stages: ExecutionStageVisibility[];
  stageGraph: {
    currentStage: JobStage;
    completedStages: JobStage[];
    activeStage: ExecutionStageVisibility | null;
    nextStages: JobStage[];
  };
  progress: {
    overall: number;
    perStage: Record<JobStage, number>;
  };
  eta: {
    totalMs: number;
    remainingMs: number;
    confidence: ExecutionEtaConfidence;
  };
  compute: ExecutionComputeProfile;
};

export type ExecutionTelemetryEvent = {
  id: string;
  type: ExecutionTelemetryEventType;
  jobId: string;
  stageId?: JobStage;
  timestamp: string;
  progress: number;
  compute: ExecutionComputeProfile;
  idempotencyKey: string;
  visibility: ExecutionVisibilityContract;
  detail?: Record<string, unknown>;
};

export type ExecutionTelemetryReporter = {
  recordJobCreated(job: JobRecord): void;
  recordStageTransition(job: JobRecord, note?: string): void;
  recordDomainEvent?(
    job: JobRecord,
    type: ExecutionTelemetryEventType,
    detail?: Record<string, unknown>
  ): void;
};

const STAGE_ORDER: JobStage[] = [
  "received",
  "analyzing",
  "metadata_ready",
  "plan_ready",
  "execution_ready",
  "audio_render",
  "ranking",
  "completed"
];

const STAGE_DEFINITIONS: Record<JobStage, {
  name: string;
  type: string;
  estimatedDurationMs: number;
  computeType: ExecutionComputeType;
  optional?: boolean;
}> = {
  received: {
    name: "Job received",
    type: "intake",
    estimatedDurationMs: 300,
    computeType: "IO"
  },
  analyzing: {
    name: "Media analysis and transcript resolution",
    type: "analysis",
    estimatedDurationMs: 2600,
    computeType: "IO"
  },
  metadata_ready: {
    name: "Metadata and clip segmentation",
    type: "planning",
    estimatedDurationMs: 1600,
    computeType: "CPU"
  },
  plan_ready: {
    name: "Edit plan synthesis",
    type: "planning",
    estimatedDurationMs: 1900,
    computeType: "CPU"
  },
  execution_ready: {
    name: "Execution plan validation",
    type: "orchestration",
    estimatedDurationMs: 1200,
    computeType: "CPU"
  },
  audio_render: {
    name: "Audio render",
    type: "render",
    estimatedDurationMs: 4200,
    computeType: "CPU",
    optional: true
  },
  ranking: {
    name: "Clip ranking and readiness",
    type: "ranking",
    estimatedDurationMs: 900,
    computeType: "CPU"
  },
  completed: {
    name: "Delivery ready",
    type: "terminal",
    estimatedDurationMs: 0,
    computeType: "CPU"
  },
  failed: {
    name: "Failed",
    type: "terminal",
    estimatedDurationMs: 0,
    computeType: "CPU"
  }
};

const round = (value: number, precision = 2): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const stageIndex = (stage: JobStage): number => {
  const index = STAGE_ORDER.indexOf(stage);
  return index >= 0 ? index : STAGE_ORDER.length - 1;
};

const uniqueStages = (stages: JobStage[]): JobStage[] => {
  const seen = new Set<JobStage>();
  const result: JobStage[] = [];
  for (const stage of stages) {
    if (seen.has(stage)) {
      continue;
    }
    seen.add(stage);
    result.push(stage);
  }
  return result;
};

const estimateStageDurationMs = (job: JobRecord, stage: JobStage): number => {
  const definition = STAGE_DEFINITIONS[stage];
  const sourceDurationMs = job.source_summary.source_duration_ms ?? 0;
  const sourceFactor = sourceDurationMs > 0 ? clamp(sourceDurationMs * 0.035, 0, 6000) : 0;
  const assetFactor = clamp(job.request_summary.asset_count * 250, 0, 2000);
  const videoFactor = job.request_summary.has_source_video ? 900 : 0;

  switch (stage) {
    case "analyzing":
      return Math.round(definition.estimatedDurationMs + sourceFactor + videoFactor);
    case "metadata_ready":
    case "plan_ready":
      return Math.round(definition.estimatedDurationMs + assetFactor);
    case "audio_render":
      return Math.round(definition.estimatedDurationMs + sourceFactor);
    default:
      return definition.estimatedDurationMs;
  }
};

const computeProfileForStage = (
  stage: ExecutionStageVisibility | null,
  sampledAt: string
): ExecutionComputeProfile => {
  if (!stage || stage.status !== "active") {
    return {
      cpuLoad: 0,
      gpuLoad: 0,
      ioLoad: 0,
      activeComputeType: null,
      sampledAt
    };
  }

  if (stage.computeType === "IO") {
    return {
      cpuLoad: 0.26,
      gpuLoad: 0,
      ioLoad: 0.72,
      activeComputeType: "IO",
      sampledAt
    };
  }

  if (stage.computeType === "GPU") {
    return {
      cpuLoad: 0.38,
      gpuLoad: 0.74,
      ioLoad: 0.18,
      activeComputeType: "GPU",
      sampledAt
    };
  }

  return {
    cpuLoad: 0.68,
    gpuLoad: stage.id === "audio_render" ? 0.16 : 0.04,
    ioLoad: 0.24,
    activeComputeType: "CPU",
    sampledAt
  };
};

const confidenceForJob = (job: JobRecord): ExecutionEtaConfidence => {
  if (job.current_stage === "completed" || job.current_stage === "failed") {
    return "high";
  }

  if (job.stage_history.length >= 4 || job.source_summary.source_duration_ms !== null) {
    return "medium";
  }

  return "low";
};

export const buildExecutionVisibility = (job: JobRecord): ExecutionVisibilityContract => {
  const history = job.stage_history;
  const currentStage = job.current_stage;
  const currentIndex = stageIndex(currentStage);
  const observedStages = new Set(history.map((entry) => entry.stage));
  const startedAtByStage = new Map<JobStage, string>();
  const completedAtByStage = new Map<JobStage, string>();

  for (let index = 0; index < history.length; index += 1) {
    const entry = history[index];
    if (!startedAtByStage.has(entry.stage)) {
      startedAtByStage.set(entry.stage, entry.at);
    }

    const previous = history[index - 1]?.stage;
    if (previous && previous !== entry.stage && previous !== "completed" && previous !== "failed") {
      completedAtByStage.set(previous, entry.at);
    }
  }

  if (currentStage === "completed") {
    const completedAt = job.completed_at ?? history.at(-1)?.at ?? job.updated_at;
    completedAtByStage.set("completed", completedAt);
  }

  if (currentStage === "failed") {
    const failedAt = job.completed_at ?? history.at(-1)?.at ?? job.updated_at;
    completedAtByStage.set("failed", failedAt);
  }

  const stageVisibilities = STAGE_ORDER.map((stage): ExecutionStageVisibility => {
    const definition = STAGE_DEFINITIONS[stage];
    const isTerminalCompleted = currentStage === "completed";
    const isCurrent = stage === currentStage;
    const wasObserved = observedStages.has(stage);
    const isBeforeCurrent = stageIndex(stage) < currentIndex;
    const skipped = definition.optional === true && !wasObserved && (isBeforeCurrent || isTerminalCompleted);
    const completed = (wasObserved && (isBeforeCurrent || isTerminalCompleted)) || stage === "completed" && isTerminalCompleted;
    const status: ExecutionStageStatus = skipped
      ? "skipped"
      : completed
        ? "completed"
        : isCurrent && currentStage !== "completed"
          ? "active"
          : "pending";
    const progress = status === "completed" || status === "skipped"
      ? 100
      : status === "active"
        ? job.progress.percent
        : 0;

    return {
      id: stage,
      name: definition.name,
      type: definition.type,
      status,
      progress: round(progress, 1),
      startedAt: startedAtByStage.get(stage) ?? null,
      completedAt: completedAtByStage.get(stage) ?? null,
      estimatedDurationMs: estimateStageDurationMs(job, stage),
      computeType: definition.computeType,
      metadata: {
        optional: definition.optional === true,
        observed: wasObserved,
        stageHistoryIndex: history.findIndex((entry) => entry.stage === stage)
      }
    };
  });

  if (currentStage === "failed") {
    stageVisibilities.push({
      id: "failed",
      name: STAGE_DEFINITIONS.failed.name,
      type: STAGE_DEFINITIONS.failed.type,
      status: "failed",
      progress: 100,
      startedAt: startedAtByStage.get("failed") ?? job.updated_at,
      completedAt: completedAtByStage.get("failed") ?? job.completed_at ?? job.updated_at,
      estimatedDurationMs: 0,
      computeType: "CPU",
      metadata: {
        errorMessage: job.error_message
      }
    });
  }

  const completedStages = uniqueStages(
    stageVisibilities
      .filter((stage) => stage.status === "completed" && stage.id !== "completed")
      .map((stage) => stage.id)
  );
  const activeStage = stageVisibilities.find((stage) => stage.status === "active") ?? null;
  const nextStages = stageVisibilities
    .filter((stage) => stage.status === "pending")
    .map((stage) => stage.id);
  const perStage = Object.fromEntries(
    stageVisibilities.map((stage) => [stage.id, stage.progress])
  ) as Record<JobStage, number>;
  const totalMs = stageVisibilities.reduce((sum, stage) => {
    if (stage.id === "failed" || stage.status === "skipped") {
      return sum;
    }
    return sum + stage.estimatedDurationMs;
  }, 0);
  const remainingMs = currentStage === "completed" || currentStage === "failed"
    ? 0
    : stageVisibilities.reduce((sum, stage) => {
        if (stage.id === "failed" || stage.status === "completed" || stage.status === "skipped") {
          return sum;
        }
        if (stage.status === "active") {
          return sum + Math.round(stage.estimatedDurationMs * (1 - stage.progress / 100));
        }
        return sum + stage.estimatedDurationMs;
      }, 0);
  const sampledAt = history.at(-1)?.at ?? job.updated_at;

  return {
    jobId: job.job_id,
    status: job.status,
    stages: stageVisibilities,
    stageGraph: {
      currentStage,
      completedStages,
      activeStage,
      nextStages
    },
    progress: {
      overall: round(job.progress.percent, 1),
      perStage
    },
    eta: {
      totalMs,
      remainingMs,
      confidence: confidenceForJob(job)
    },
    compute: computeProfileForStage(activeStage, sampledAt)
  };
};

const latestTransitionKey = (job: JobRecord): string => {
  const latest = job.stage_history.at(-1);
  return latest ? `${latest.stage}:${latest.at}` : `${job.current_stage}:${job.updated_at}`;
};

const previousObservedStage = (job: JobRecord): JobStage | null => {
  if (job.stage_history.length < 2) {
    return null;
  }

  const current = job.stage_history.at(-1)?.stage;
  for (let index = job.stage_history.length - 2; index >= 0; index -= 1) {
    const candidate = job.stage_history[index]?.stage;
    if (candidate && candidate !== current) {
      return candidate;
    }
  }

  return null;
};

export class ExecutionTelemetryBroker implements ExecutionTelemetryReporter {
  private readonly eventsByJob = new Map<string, ExecutionTelemetryEvent[]>();
  private readonly idempotencyKeysByJob = new Map<string, Set<string>>();
  private readonly subscribers = new Map<string, Set<(event: ExecutionTelemetryEvent) => void>>();

  public recordJobCreated(job: JobRecord): void {
    const visibility = buildExecutionVisibility(job);
    this.emit(job.job_id, "JOB_CREATED", visibility, {
      stageId: job.current_stage,
      idempotencyKey: `${job.job_id}:JOB_CREATED`,
      timestamp: job.created_at
    });
    this.emit(job.job_id, "STAGE_STARTED", visibility, {
      stageId: job.current_stage,
      idempotencyKey: `${job.job_id}:STAGE_STARTED:${job.current_stage}:${job.created_at}`,
      timestamp: job.created_at
    });
    this.emit(job.job_id, "ETA_UPDATED", visibility, {
      idempotencyKey: `${job.job_id}:ETA_UPDATED:${job.created_at}`,
      timestamp: job.created_at
    });
    this.emit(job.job_id, "COMPUTE_PROFILE_UPDATED", visibility, {
      idempotencyKey: `${job.job_id}:COMPUTE_PROFILE_UPDATED:${job.created_at}`,
      timestamp: job.created_at
    });
  }

  public recordStageTransition(job: JobRecord, note?: string): void {
    this.ensureJobRegistered(job);
    const visibility = buildExecutionVisibility(job);
    const transitionKey = latestTransitionKey(job);
    const timestamp = job.stage_history.at(-1)?.at ?? job.updated_at;
    const previousStage = previousObservedStage(job);

    if (job.current_stage === "failed") {
      this.emit(job.job_id, "STAGE_FAILED", visibility, {
        stageId: previousStage ?? "failed",
        idempotencyKey: `${job.job_id}:STAGE_FAILED:${transitionKey}`,
        timestamp,
        detail: {
          note,
          errorMessage: job.error_message
        }
      });
    } else if (previousStage && previousStage !== "failed" && previousStage !== "completed") {
      this.emit(job.job_id, "STAGE_COMPLETED", visibility, {
        stageId: previousStage,
        idempotencyKey: `${job.job_id}:STAGE_COMPLETED:${previousStage}:${transitionKey}`,
        timestamp,
        detail: {note}
      });
    }

    if (job.current_stage !== "completed" && job.current_stage !== "failed") {
      this.emit(job.job_id, "STAGE_STARTED", visibility, {
        stageId: job.current_stage,
        idempotencyKey: `${job.job_id}:STAGE_STARTED:${transitionKey}`,
        timestamp,
        detail: {note}
      });
    }

    this.emit(job.job_id, "STAGE_PROGRESS", visibility, {
      stageId: visibility.stageGraph.activeStage?.id ?? job.current_stage,
      idempotencyKey: `${job.job_id}:STAGE_PROGRESS:${transitionKey}:${visibility.progress.overall}`,
      timestamp,
      detail: {note}
    });
    this.emit(job.job_id, "ETA_UPDATED", visibility, {
      idempotencyKey: `${job.job_id}:ETA_UPDATED:${transitionKey}:${visibility.eta.remainingMs}`,
      timestamp
    });
    this.emit(job.job_id, "COMPUTE_PROFILE_UPDATED", visibility, {
      idempotencyKey: `${job.job_id}:COMPUTE_PROFILE_UPDATED:${transitionKey}:${visibility.compute.activeComputeType ?? "idle"}`,
      timestamp
    });
  }

  public recordDomainEvent(
    job: JobRecord,
    type: ExecutionTelemetryEventType,
    detail: Record<string, unknown> = {}
  ): void {
    this.ensureJobRegistered(job);
    const visibility = buildExecutionVisibility(job);
    const timestamp = job.updated_at;
    this.emit(job.job_id, type, visibility, {
      stageId: job.current_stage,
      idempotencyKey: `${job.job_id}:${type}:${job.stage_history.length}:${JSON.stringify(detail)}`,
      timestamp,
      detail
    });
  }

  public ensureJobRegistered(job: JobRecord): void {
    if ((this.eventsByJob.get(job.job_id)?.length ?? 0) > 0) {
      return;
    }

    this.recordJobCreated(job);
  }

  public getReplayEvents(jobId: string, afterEventId?: string): ExecutionTelemetryEvent[] {
    const events = this.eventsByJob.get(jobId) ?? [];
    if (!afterEventId) {
      return [...events];
    }

    const index = events.findIndex((event) => event.id === afterEventId);
    if (index < 0) {
      return [...events];
    }

    return events.slice(index + 1);
  }

  public subscribe(
    jobId: string,
    listener: (event: ExecutionTelemetryEvent) => void,
    {replay = true, afterEventId}: {replay?: boolean; afterEventId?: string} = {}
  ): () => void {
    const listeners = this.subscribers.get(jobId) ?? new Set<(event: ExecutionTelemetryEvent) => void>();
    listeners.add(listener);
    this.subscribers.set(jobId, listeners);

    if (replay) {
      for (const event of this.getReplayEvents(jobId, afterEventId)) {
        listener(event);
      }
    }

    return () => {
      const current = this.subscribers.get(jobId);
      if (!current) {
        return;
      }
      current.delete(listener);
      if (current.size === 0) {
        this.subscribers.delete(jobId);
      }
    };
  }

  private emit(
    jobId: string,
    type: ExecutionTelemetryEventType,
    visibility: ExecutionVisibilityContract,
    options: {
      stageId?: JobStage;
      idempotencyKey: string;
      timestamp: string;
      detail?: Record<string, unknown>;
    }
  ): void {
    const idempotencyKeys = this.idempotencyKeysByJob.get(jobId) ?? new Set<string>();
    if (idempotencyKeys.has(options.idempotencyKey)) {
      return;
    }

    idempotencyKeys.add(options.idempotencyKey);
    this.idempotencyKeysByJob.set(jobId, idempotencyKeys);

    const event: ExecutionTelemetryEvent = {
      id: options.idempotencyKey,
      type,
      jobId,
      stageId: options.stageId,
      timestamp: options.timestamp,
      progress: visibility.progress.overall,
      compute: visibility.compute,
      idempotencyKey: options.idempotencyKey,
      visibility,
      detail: options.detail
    };
    const events = this.eventsByJob.get(jobId) ?? [];
    events.push(event);
    this.eventsByJob.set(jobId, events.slice(-200));

    const listeners = this.subscribers.get(jobId);
    if (!listeners || listeners.size === 0) {
      return;
    }

    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        listeners.delete(listener);
      }
    }

    if (listeners.size === 0) {
      this.subscribers.delete(jobId);
    }
  }
}
