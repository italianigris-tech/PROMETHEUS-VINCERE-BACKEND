import type {PipelineExecutionContext} from "../execution-context";
import {
  buildMotionPlanArtifact,
  type MotionPlanArtifact,
  type MotionPlanBuilderInput
} from "../motion-plan";

export type MotionExecutionPlanningResult = {
  motionPlanArtifact: MotionPlanArtifact;
  motionPlanPath: string;
  motionTracePath: string;
};

export interface PipelineMotionPlanner {
  plan(
    context: PipelineExecutionContext,
    input: MotionPlanBuilderInput
  ): Promise<MotionExecutionPlanningResult>;
}

export class DefaultMotionExecutionPlanner implements PipelineMotionPlanner {
  public async plan(
    context: PipelineExecutionContext,
    input: MotionPlanBuilderInput
  ): Promise<MotionExecutionPlanningResult> {
    const motionPlanArtifact = await buildMotionPlanArtifact(input);
    const {motion_trace_log: motionTraceLog, ...motionPlanArtifactForStorage} = motionPlanArtifact;
    const motionTracePath = await context.repository.writeMotionTraceLog(input.jobId, motionTraceLog);

    context.motionTrace = {
      path: motionTracePath,
      traceLog: motionTraceLog,
      motionIntelligence: motionPlanArtifact.motion_intelligence
    };

    const motionPlanPath = await context.repository.writeMotionPlan(input.jobId, {
      ...motionPlanArtifactForStorage,
      motion_trace: {
        ...motionPlanArtifact.motion_trace,
        path: motionTracePath
      }
    });
    const telemetryJob = await context.repository.getJobRecord(input.jobId);
    context.deps.executionTelemetry?.recordDomainEvent?.(telemetryJob, "MOTION_INTELLIGENCE_PLANNED", {
      seed: String(motionPlanArtifact.motion_intelligence.seed ?? ""),
      continuityVector: String(motionPlanArtifact.motion_intelligence.continuity_vector ?? ""),
      selectedPrimitiveCount: motionPlanArtifact.motion_trace.selected_primitive_count,
      rejectedPrimitiveCount: motionPlanArtifact.motion_trace.rejected_primitive_count,
      tracePath: motionTracePath
    });

    return {
      motionPlanArtifact,
      motionPlanPath,
      motionTracePath
    };
  }
}
