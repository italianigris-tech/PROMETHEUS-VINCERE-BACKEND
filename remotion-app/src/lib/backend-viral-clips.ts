import {z} from "zod";

import type {TranscribedWord} from "./types";
import {backendFetchJson, getBackendApiBaseUrl, joinBackendApiUrl} from "./backend-api";

export const backendTargetPlatformSchema = z.enum(["tiktok", "reels", "shorts", "youtube", "generic"]);
export type BackendTargetPlatform = z.infer<typeof backendTargetPlatformSchema>;

export const backendTranscriptWordSchema = z.object({
  text: z.string().min(1),
  start_ms: z.number().nonnegative(),
  end_ms: z.number().nonnegative(),
  confidence: z.number().min(0).max(1).optional()
});

export type BackendTranscriptWord = z.infer<typeof backendTranscriptWordSchema>;

export const backendAssetDescriptorSchema = z.object({
  name: z.string().optional(),
  uri: z.string().optional(),
  label: z.string().optional(),
  mime_type: z.string().optional(),
  usage: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export type BackendAssetDescriptor = z.infer<typeof backendAssetDescriptorSchema>;

export const backendExecutionVisibilitySchema = z
  .object({
    jobId: z.string(),
    status: z.string(),
    stages: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          type: z.string(),
          status: z.string(),
          progress: z.number(),
          estimatedDurationMs: z.number(),
          computeType: z.string()
        })
        .passthrough()
    ),
    stageGraph: z
      .object({
        currentStage: z.string(),
        completedStages: z.array(z.string()),
        activeStage: z.record(z.string(), z.unknown()).nullable(),
        nextStages: z.array(z.string())
      })
      .passthrough(),
    progress: z
      .object({
        overall: z.number(),
        perStage: z.record(z.string(), z.number()).optional()
      })
      .passthrough(),
    eta: z
      .object({
        totalMs: z.number(),
        remainingMs: z.number(),
        confidence: z.string()
      })
      .passthrough(),
    compute: z
      .object({
        cpuLoad: z.number(),
        gpuLoad: z.number(),
        ioLoad: z.number(),
        activeComputeType: z.string().nullable().optional()
      })
      .passthrough()
  })
  .passthrough();

export type BackendExecutionVisibility = z.infer<typeof backendExecutionVisibilitySchema>;

export const backendPortraitFocusSchema = z.object({
  mode: z.enum(["center", "speaker_head", "semantic_anchor"]),
  aspect_ratio: z.literal("9:16"),
  focus_x_pct: z.number().min(0).max(100),
  focus_y_pct: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  reference_label: z.string().nullable(),
  rationale: z.string()
});

export type BackendPortraitFocus = z.infer<typeof backendPortraitFocusSchema>;

export const viralClipJobSubmissionSchema = z.object({
  projectId: z.string().trim().min(1),
  videoId: z.string().trim().min(1),
  targetPlatform: backendTargetPlatformSchema,
  clipCountMin: z.number().int().min(1).max(8).default(2),
  clipCountMax: z.number().int().min(1).max(8).default(4),
  prompt: z.string().trim().optional(),
  sourceMediaRef: z.string().trim().optional(),
  creatorNiche: z.string().trim().optional(),
  assets: z.array(backendAssetDescriptorSchema).default([]),
  metadataOverrides: z.record(z.string(), z.unknown()).default({}),
  providedTranscript: z.array(backendTranscriptWordSchema).optional()
}).refine((value) => value.clipCountMin <= value.clipCountMax, {
  message: "clipCountMin must be less than or equal to clipCountMax."
});

export type ViralClipJobSubmission = z.infer<typeof viralClipJobSubmissionSchema>;

export const viralClipJobCreateResponseSchema = z.object({
  jobId: z.string(),
  status: z.string(),
  stage: z.string(),
  executionVisibility: backendExecutionVisibilitySchema.optional(),
  urls: z
    .object({
      job: z.string().optional(),
      events: z.string().optional(),
      execution_visibility: z.string().optional(),
      result: z.string().optional()
    })
    .optional()
});

export type ViralClipJobCreateResponse = z.infer<typeof viralClipJobCreateResponseSchema>;

export const viralClipJobStageSchema = z.enum([
  "queued",
  "transcribing",
  "segmenting",
  "heuristic_scoring",
  "llm_scoring",
  "ranking",
  "completed",
  "failed"
]);

export type ViralClipJobStage = z.infer<typeof viralClipJobStageSchema>;

export const viralClipJobStatusSchema = z
  .object({
    job_id: z.string(),
    status: z.string(),
    current_stage: z.string(),
    stage: viralClipJobStageSchema.or(z.string()),
    progress: z
      .object({
        current_step: z.number().optional(),
        total_steps: z.number().optional(),
        percent: z.number().optional()
      })
      .optional(),
    warnings: z.array(z.string()).optional(),
    error_message: z.string().nullable().optional(),
    urls: z
      .object({
        job: z.string().nullable().optional(),
        events: z.string().nullable().optional(),
        execution_visibility: z.string().nullable().optional(),
        result: z.string().nullable().optional()
      })
      .optional(),
    executionVisibility: backendExecutionVisibilitySchema.optional(),
    stage_history: z
      .array(
        z.object({
          stage: z.string(),
          at: z.string(),
          note: z.string().nullable().optional()
        })
      )
      .optional(),
    source_summary: z.record(z.string(), z.unknown()).optional(),
    request_summary: z.record(z.string(), z.unknown()).optional(),
    artifact_availability: z.record(z.string(), z.boolean()).optional()
  })
  .passthrough();

export type ViralClipJobStatus = z.infer<typeof viralClipJobStatusSchema>;

const clipScoreSchema = z.object({
  hook: z.number(),
  clarity: z.number(),
  payoff: z.number(),
  emotion: z.number(),
  shareability: z.number(),
  curiosity: z.number(),
  clip_cleanliness: z.number(),
  platform_fit: z.number()
});

const clipHeuristicSignalsSchema = z.object({
  opening_question: z.boolean(),
  strong_hook_phrase: z.boolean(),
  contrast_phrase: z.boolean(),
  emotional_phrase: z.boolean(),
  quoteable_sentence: z.boolean(),
  context_dependency_penalty: z.boolean(),
  clean_start_boundary: z.boolean(),
  clean_end_boundary: z.boolean(),
  matched_keywords: z.array(z.string()),
  emphasis_words: z.array(z.string())
});

const clipCandidateSchema = z
  .object({
    clip_id: z.string(),
    window_label: z.string(),
    start_ms: z.number().nonnegative(),
    end_ms: z.number().nonnegative(),
    duration_ms: z.number().positive(),
    transcript_excerpt: z.string(),
    leading_context: z.string(),
    trailing_context: z.string(),
    scores: clipScoreSchema,
    heuristic_signals: clipHeuristicSignalsSchema,
    final_score: z.number(),
    ranking_notes: z.array(z.string()),
    recommended_start_adjustment_ms: z.number().int(),
    recommended_end_adjustment_ms: z.number().int()
  })
  .passthrough();

const selectedClipSchema = clipCandidateSchema.extend({
  rank: z.number().int().positive(),
  export_start_ms: z.number().nonnegative(),
  export_end_ms: z.number().nonnegative(),
  export_duration_ms: z.number().positive(),
  virality_score: z.number(),
  reason_selected: z.string(),
  hook_line: z.string(),
  suggested_title: z.string(),
  suggested_caption: z.string(),
  punch_in_moments_ms: z.array(z.number().nonnegative()),
  subtitle_emphasis_words: z.array(z.string()),
  portrait_focus: backendPortraitFocusSchema.optional()
});

export const viralClipSelectionSchema = z
  .object({
    job_id: z.string(),
    plan_version: z.string(),
    source_summary: z
      .object({
        transcript_available: z.boolean(),
        transcript_source: z.string(),
        target_platform: backendTargetPlatformSchema,
        creator_niche: z.string().nullable(),
        requested_clip_count_min: z.number().int().nullable(),
        requested_clip_count_max: z.number().int().nullable(),
        candidate_count: z.number().int().nonnegative(),
        selected_count: z.number().int().nonnegative()
      })
      .passthrough(),
    window_config: z.array(
      z.object({
        label: z.string(),
        min_duration_ms: z.number().int().positive(),
        target_duration_ms: z.number().int().positive(),
        max_duration_ms: z.number().int().positive(),
        step_ms: z.number().int().positive()
      })
    ),
    scoring_weights: z.object({
      hook: z.number(),
      clarity: z.number(),
      payoff: z.number(),
      emotion: z.number(),
      shareability: z.number(),
      curiosity: z.number(),
      clip_cleanliness: z.number(),
      platform_fit: z.number()
    }),
    candidate_segments: z.array(clipCandidateSchema),
    selected_clips: z.array(selectedClipSchema),
    warnings: z.array(z.string())
  })
  .passthrough();

export type ViralClipSelection = z.infer<typeof viralClipSelectionSchema>;

export const normalizeBackendTranscriptWords = (words: TranscribedWord[] = []): BackendTranscriptWord[] => {
  return words.map((word) => ({
    text: word.text,
    start_ms: word.startMs,
    end_ms: word.endMs,
    ...(word.confidence !== undefined ? {confidence: word.confidence} : {})
  }));
};

export const buildViralClipJobPayload = (input: {
  projectId: string;
  videoId: string;
  targetPlatform: BackendTargetPlatform;
  clipCountMin?: number;
  clipCountMax?: number;
  prompt?: string;
  sourceMediaRef?: string;
  creatorNiche?: string;
  assets?: BackendAssetDescriptor[];
  metadataOverrides?: Record<string, unknown>;
  providedTranscript?: TranscribedWord[];
}): ViralClipJobSubmission => {
  return viralClipJobSubmissionSchema.parse({
    projectId: input.projectId,
    videoId: input.videoId,
    targetPlatform: input.targetPlatform,
    clipCountMin: input.clipCountMin ?? 2,
    clipCountMax: input.clipCountMax ?? 4,
    prompt: input.prompt,
    sourceMediaRef: input.sourceMediaRef,
    creatorNiche: input.creatorNiche,
    assets: input.assets ?? [],
    metadataOverrides: input.metadataOverrides ?? {},
    providedTranscript:
      input.providedTranscript && input.providedTranscript.length > 0
        ? normalizeBackendTranscriptWords(input.providedTranscript)
        : undefined
  });
};

export const isTerminalViralClipStage = (stage: string | null | undefined): stage is ViralClipJobStage => {
  return stage === "completed" || stage === "failed";
};

export const formatViralClipStageLabel = (stage: string): string => {
  switch (stage) {
    case "queued":
      return "Queued";
    case "transcribing":
      return "Transcribing";
    case "segmenting":
      return "Segmenting";
    case "heuristic_scoring":
      return "Heuristic scoring";
    case "llm_scoring":
      return "LLM scoring";
    case "ranking":
      return "Ranking";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return stage;
  }
};

export const submitViralClipJob = async (input: {
  projectId: string;
  videoId: string;
  targetPlatform: BackendTargetPlatform;
  clipCountMin?: number;
  clipCountMax?: number;
  prompt?: string;
  sourceMediaRef?: string;
  creatorNiche?: string;
  assets?: BackendAssetDescriptor[];
  metadataOverrides?: Record<string, unknown>;
  providedTranscript?: TranscribedWord[];
}): Promise<ViralClipJobCreateResponse> => {
  return viralClipJobCreateResponseSchema.parse(
    await backendFetchJson("/api/generate-viral-clips", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildViralClipJobPayload(input))
    })
  );
};

export const getViralClipJobStatus = async (jobId: string): Promise<ViralClipJobStatus> => {
  return viralClipJobStatusSchema.parse(await backendFetchJson(`/api/jobs/${encodeURIComponent(jobId)}`));
};

export const getViralClipJobResult = async (jobId: string): Promise<ViralClipSelection> => {
  return viralClipSelectionSchema.parse(
    await backendFetchJson(`/api/jobs/${encodeURIComponent(jobId)}/result`)
  );
};

export const pingBackendApi = async (): Promise<{ok: boolean}> => {
  const result = await backendFetchJson<{ok: boolean}>("/health");
  return {ok: Boolean(result?.ok)};
};

export const getBackendViralClipApiBaseUrl = getBackendApiBaseUrl;
export const getBackendViralClipApiUrl = joinBackendApiUrl;
