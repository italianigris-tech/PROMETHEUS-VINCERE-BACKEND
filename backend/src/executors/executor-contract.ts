import type {PipelineExecutionContext} from "../execution-context";
import type {
  ClipSelection,
  FallbackEvent,
  MetadataProfile
} from "../schemas";

export type ExecutionCapability =
  | "main_video"
  | "short_form"
  | "future_audio"
  | "unknown";

export type JobExecutionState =
  | "PREVIEW_READY"
  | "RENDER_READY"
  | "DEGRADED_READY"
  | "FAILED";

export type JobExecutionResult = {
  capability: ExecutionCapability;
  state: JobExecutionState;
  warnings: string[];
  fallbackEvents: FallbackEvent[];
};

export interface PipelineExecutor {
  capability(): ExecutionCapability;
  execute(context: PipelineExecutionContext): Promise<JobExecutionResult>;
}

export type PipelineClipPlanningResult = {
  clipSelection: ClipSelection;
  clipSelectionPath: string;
  warnings: string[];
};

export interface PipelineClipPlanner {
  executePlanning(input: {
    context: PipelineExecutionContext;
    metadata: MetadataProfile;
    warnings: string[];
  }): Promise<PipelineClipPlanningResult>;
}
