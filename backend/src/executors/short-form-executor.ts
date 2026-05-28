import type {PipelineExecutionContext} from "../execution-context";
import type {
  ClipSelection,
  MetadataProfile,
  NormalizedJobRequest
} from "../schemas";
import {
  SHORT_FORM_RANKING_MODEL
} from "../short-form-intelligence";
import type {
  ExecutionCapability,
  JobExecutionResult,
  PipelineClipPlanner,
  PipelineClipPlanningResult,
  PipelineExecutor
} from "./executor-contract";

type ClipSelectionBuilder = (input: {
  request: NormalizedJobRequest;
  metadata: MetadataProfile;
}) => ClipSelection;

type SharedPipelineRunner = (
  context: PipelineExecutionContext,
  clipPlanner: PipelineClipPlanner
) => Promise<JobExecutionResult>;

const uniqueStrings = (values: string[]): string[] => Array.from(new Set(values));

export class ShortFormExecutor implements PipelineExecutor, PipelineClipPlanner {
  private readonly buildClipSelection: ClipSelectionBuilder;
  private readonly runSharedPipeline?: SharedPipelineRunner;

  public constructor({
    buildClipSelection,
    runSharedPipeline
  }: {
    buildClipSelection: ClipSelectionBuilder;
    runSharedPipeline?: SharedPipelineRunner;
  }) {
    this.buildClipSelection = buildClipSelection;
    this.runSharedPipeline = runSharedPipeline;
  }

  public capability(): ExecutionCapability {
    return "short_form";
  }

  public async execute(context: PipelineExecutionContext): Promise<JobExecutionResult> {
    if (!this.runSharedPipeline) {
      return {
        capability: this.capability(),
        state: "DEGRADED_READY",
        warnings: ["ShortFormExecutor has no shared pipeline runner; no work was performed."],
        fallbackEvents: []
      };
    }

    const result = await this.runSharedPipeline(context, this);
    return {
      ...result,
      capability: this.capability()
    };
  }

  public async executePlanning({
    context,
    metadata,
    warnings
  }: {
    context: PipelineExecutionContext;
    metadata: MetadataProfile;
    warnings: string[];
  }): Promise<PipelineClipPlanningResult> {
    const job = await context.repository.getJobRecord(context.request.job_id);
    context.telemetry?.recordDomainEvent?.(
      job,
      "SEGMENTING",
      {
        mode: metadata.transcript_words.length > 0 ? "semantic_segmentation" : "acoustic_segmentation",
        transcriptWords: metadata.transcript_words.length
      }
    );

    const clipSelection = this.buildClipSelection({
      request: context.request,
      metadata
    });
    const topClip = clipSelection.selected_clips[0] ?? null;
    const currentJob = await context.repository.getJobRecord(context.request.job_id);

    context.telemetry?.recordDomainEvent?.(currentJob, "SCORING", {
      model: clipSelection.source_summary.ranking_model ?? SHORT_FORM_RANKING_MODEL,
      candidates: clipSelection.candidate_segments.length
    });
    context.telemetry?.recordDomainEvent?.(currentJob, "RANKING", {
      selected: clipSelection.selected_clips.length,
      topScore: topClip?.virality_score ?? null
    });

    if (topClip) {
      context.telemetry?.recordDomainEvent?.(currentJob, "CLIP_READY", {
        clipId: topClip.clip_id,
        startMs: topClip.export_start_ms,
        endMs: topClip.export_end_ms,
        score: topClip.virality_score
      });
      context.telemetry?.recordDomainEvent?.(currentJob, "MUSIC_ALIGNED", {
        clipId: topClip.clip_id,
        pairing: topClip.recommended_music_pairing ?? null
      });
    }

    const clipSelectionPath = await context.repository.writeClipSelection(
      context.request.job_id,
      clipSelection
    );

    return {
      clipSelection,
      clipSelectionPath,
      warnings: uniqueStrings(warnings.concat(clipSelection.warnings))
    };
  }
}
