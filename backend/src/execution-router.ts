import {
  recordFallbackEvent,
  type PipelineExecutionContext
} from "./execution-context";
import type {
  ExecutionCapability,
  JobExecutionResult,
  PipelineExecutor
} from "./executors/executor-contract";
import type {NormalizedJobRequest} from "./schemas";

export type {ExecutionCapability} from "./executors/executor-contract";

export type ExecutionRoutingDecision = {
  capability: ExecutionCapability;
  routing_reason: string;
};

const SHORT_FORM_PLATFORMS = new Set(["shorts", "reels", "tiktok"]);

const metadataContainsShortFormIntent = (value: unknown): boolean => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.entries(value as Record<string, unknown>).some(([key, entry]) => {
    if (/short[_-]?form|viral[_-]?clips?|clip[_-]?intent|shorts|reels|tiktok/i.test(key)) {
      return Boolean(entry);
    }
    return metadataContainsShortFormIntent(entry);
  });
};

export const determineExecutionCapability = (
  request: NormalizedJobRequest | null | undefined
): ExecutionRoutingDecision => {
  if (!request) {
    return {
      capability: "unknown",
      routing_reason: "missing request; falling back to main video"
    };
  }

  if (request.target_platform && SHORT_FORM_PLATFORMS.has(request.target_platform)) {
    return {
      capability: "short_form",
      routing_reason: `target platform ${request.target_platform} requires short-form execution`
    };
  }

  if (request.project_id && request.video_id) {
    return {
      capability: "short_form",
      routing_reason: "viral clip request shape detected"
    };
  }

  if (metadataContainsShortFormIntent(request.metadata_overrides)) {
    return {
      capability: "short_form",
      routing_reason: "short-form intent metadata flag detected"
    };
  }

  return {
    capability: "main_video",
    routing_reason: "default main video capability"
  };
};

export const createExecutionRouter = ({
  executors
}: {
  executors: PipelineExecutor[];
}) => {
  const executorsByCapability = new Map<ExecutionCapability, PipelineExecutor>();
  for (const executor of executors) {
    executorsByCapability.set(executor.capability(), executor);
  }

  const selectExecutor = (decision: ExecutionRoutingDecision): {
    executor: PipelineExecutor | null;
    fallbackUsed: boolean;
  } => {
    const selected = executorsByCapability.get(decision.capability);
    if (selected) {
      return {
        executor: selected,
        fallbackUsed: false
      };
    }

    const fallback = executorsByCapability.get("main_video") ?? null;
    return {
      executor: fallback,
      fallbackUsed: true
    };
  };

  return {
    route(context: PipelineExecutionContext): ExecutionRoutingDecision {
      return determineExecutionCapability(context.request);
    },

    async execute(context: PipelineExecutionContext): Promise<JobExecutionResult> {
      const decision = determineExecutionCapability(context.request);
      const {executor, fallbackUsed} = selectExecutor(decision);
      const createdAt = context.deps.now?.() ?? new Date().toISOString();

      if (!executor) {
        const fallbackEvents: JobExecutionResult["fallbackEvents"] = [];
        recordFallbackEvent({
          events: fallbackEvents,
          stage: "execution_routing",
          code: "missing_executor",
          severity: "warning",
          message: "Execution router had no available executor; no work was performed.",
          details: {
            requestedCapability: decision.capability,
            routing_reason: decision.routing_reason
          },
          createdAt
        });
        return {
          capability: "unknown",
          state: "DEGRADED_READY",
          warnings: ["Execution router had no available executor; no work was performed."],
          fallbackEvents
        };
      }

      try {
        const job = await context.repository.getJobRecord(context.request.job_id);
        context.telemetry?.recordDomainEvent?.(job, "ROUTED_TO_EXECUTOR", {
          executor: executor.capability(),
          capability: decision.capability,
          requestedCapability: decision.capability,
          routing_reason: decision.routing_reason,
          fallbackUsed
        });
      } catch (error) {
        context.logger.warn("[execution-router] telemetry routing event skipped", {
          reason: error instanceof Error ? error.message : String(error)
        });
      }

      const result = await executor.execute(context);
      if (!fallbackUsed) {
        return result;
      }

      const fallbackEvents = result.fallbackEvents.slice();
      recordFallbackEvent({
        events: fallbackEvents,
        stage: "execution_routing",
        code: "executor_fallback_to_main",
        severity: "warning",
        message: "Execution router fell back to the main video executor.",
        details: {
          requestedCapability: decision.capability,
          executor: executor.capability(),
          routing_reason: decision.routing_reason
        },
        createdAt
      });

      return {
        ...result,
        warnings: Array.from(new Set(result.warnings.concat("Execution router fell back to main video executor."))),
        fallbackEvents
      };
    }
  };
};
