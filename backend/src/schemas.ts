import {z} from "zod";

import {soundDesignManifestSchema, type SoundDesignManifest} from "./sound-engine/types";

export const fieldValueSourceSchema = z.enum([
  "user_explicit",
  "inferred_from_prompt",
  "inferred_from_media",
  "inferred_from_asset",
  "system_default"
]);

export const targetPlatformSchema = z.enum(["tiktok", "reels", "shorts", "youtube", "generic"]);
export type TargetPlatform = z.infer<typeof targetPlatformSchema>;

export const transcribedWordSchema = z.object({
  text: z.string().min(1),
  start_ms: z.number().nonnegative(),
  end_ms: z.number().nonnegative(),
  confidence: z.number().min(0).max(1).optional()
});

export type TranscribedWord = z.infer<typeof transcribedWordSchema>;

export const assetDescriptorSchema = z.object({
  name: z.string().optional(),
  uri: z.string().optional(),
  label: z.string().optional(),
  mime_type: z.string().optional(),
  usage: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const jobRequestPayloadSchema = z.object({
  prompt: z.string().trim().optional(),
  source_media_ref: z.string().trim().optional(),
  assets: z.array(assetDescriptorSchema).default([]),
  creator_niche: z.string().trim().optional(),
  target_platform: targetPlatformSchema.optional(),
  max_clip_count: z.number().int().min(1).max(8).optional(),
  metadata_overrides: z.record(z.string(), z.unknown()).default({}),
  provided_transcript: z.array(transcribedWordSchema).optional(),
  sound_design_manifest: soundDesignManifestSchema.optional()
});

export const jobRequestJsonSchema = jobRequestPayloadSchema
  .refine(
    (value) =>
      Boolean(
        value.prompt ||
          value.source_media_ref ||
          value.assets.length > 0 ||
          (value.provided_transcript?.length ?? 0) > 0 ||
          value.sound_design_manifest
      ),
    {
      message: "Request must include a prompt, source media reference, assets, transcript, or sound design manifest."
    }
  );

export const generateViralClipsRequestBaseSchema = z.object({
  projectId: z.string().trim().min(1),
  videoId: z.string().trim().min(1),
  targetPlatform: targetPlatformSchema,
  clipCountMin: z.number().int().min(1).max(8).default(2),
  clipCountMax: z.number().int().min(1).max(8).default(4),
  prompt: z.string().trim().optional(),
  sourceMediaRef: z.string().trim().optional(),
  creatorNiche: z.string().trim().optional(),
  assets: z.array(assetDescriptorSchema).default([]),
  metadataOverrides: z.record(z.string(), z.unknown()).default({}),
  providedTranscript: z.array(transcribedWordSchema).optional(),
  soundDesignManifest: soundDesignManifestSchema.optional()
});

export const generateViralClipsRequestSchema = generateViralClipsRequestBaseSchema
  .refine((value) => value.clipCountMin <= value.clipCountMax, {
    message: "clipCountMin must be less than or equal to clipCountMax."
  });

export type GenerateViralClipsRequest = z.infer<typeof generateViralClipsRequestSchema>;

export const storedInputFileSchema = z.object({
  asset_id: z.string(),
  role: z.enum(["source_video", "asset"]),
  original_name: z.string(),
  stored_path: z.string(),
  mime_type: z.string().default("application/octet-stream"),
  label: z.string().optional(),
  size_bytes: z.number().nonnegative()
});

export const normalizedJobRequestSchema = z.object({
  job_id: z.string().min(1),
  prompt: z.string().default(""),
  source_media_ref: z.string().optional(),
  project_id: z.string().optional(),
  video_id: z.string().optional(),
  input_source_video: storedInputFileSchema.nullable(),
  input_assets: z.array(storedInputFileSchema).default([]),
  descriptor_assets: z.array(assetDescriptorSchema).default([]),
  creator_niche: z.string().trim().optional(),
  target_platform: targetPlatformSchema.optional(),
  min_clip_count: z.number().int().min(1).max(8).optional(),
  max_clip_count: z.number().int().min(1).max(8).optional(),
  metadata_overrides: z.record(z.string(), z.unknown()).default({}),
  provided_transcript: z.array(transcribedWordSchema).optional(),
  sound_design_manifest: soundDesignManifestSchema.optional()
});

export type NormalizedJobRequest = z.infer<typeof normalizedJobRequestSchema>;

export const inputManifestSchema = z.object({
  job_id: z.string(),
  created_at: z.string(),
  prompt_excerpt: z.string(),
  project_id: z.string().nullable(),
  video_id: z.string().nullable(),
  source_media_ref: z.string().nullable(),
  source_video: storedInputFileSchema.nullable(),
  assets: z.array(storedInputFileSchema),
  descriptor_assets: z.array(assetDescriptorSchema),
  requested_clip_count_min: z.number().int().nullable(),
  requested_clip_count_max: z.number().int().nullable(),
  metadata_override_keys: z.array(z.string()),
  has_provided_transcript: z.boolean(),
  has_sound_design_manifest: z.boolean()
});

export type InputManifest = z.infer<typeof inputManifestSchema>;

export const jobStageSchema = z.enum([
  "received",
  "analyzing",
  "metadata_ready",
  "plan_ready",
  "execution_ready",
  "audio_render",
  "ranking",
  "completed",
  "failed"
]);

export type JobStage = z.infer<typeof jobStageSchema>;

export const fallbackEventSchema = z.object({
  code: z.string(),
  stage: z.string(),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string()
});

export type FallbackEvent = z.infer<typeof fallbackEventSchema>;

export const enrichmentCandidateSchema = z.object({
  entity_text: z.string(),
  entity_type: z.enum(["person", "location", "organization", "event", "product", "concept"]),
  confidence_score: z.number().min(0).max(1),
  visual_relevance_score: z.number().min(0).max(1),
  fetch_priority_score: z.number().min(0).max(1),
  mention_count: z.number().int().nonnegative(),
  timing_window: z
    .object({
      start_ms: z.number().nonnegative().nullable(),
      end_ms: z.number().nonnegative().nullable()
    })
    .nullable(),
  recommended_action: z.enum(["source_candidate", "typography_only", "internal_motion_asset", "no_action"]),
  source_strategy: z.enum(["uploaded_asset", "external_fetch", "typography_fallback", "none"]),
  fallback_strategy: z.string(),
  threshold_passed: z.boolean()
});

export type EnrichmentCandidate = z.infer<typeof enrichmentCandidateSchema>;

const metadataGroupSchema = z.record(z.string(), z.unknown());

export const metadataProfileSchema = z.object({
  job: metadataGroupSchema,
  source_media: metadataGroupSchema,
  derived_technical: metadataGroupSchema,
  user_intent: metadataGroupSchema,
  output: metadataGroupSchema,
  timing_pacing: metadataGroupSchema,
  transcript_language: metadataGroupSchema,
  entity_enrichment: metadataGroupSchema,
  uploaded_assets: metadataGroupSchema,
  typography: metadataGroupSchema,
  motion_graphics: metadataGroupSchema,
  layout_collision: metadataGroupSchema,
  audio: metadataGroupSchema,
  color_finish: metadataGroupSchema,
  transitions: metadataGroupSchema,
  execution_orchestration: metadataGroupSchema,
  fallback: metadataGroupSchema,
  search_sourcing: metadataGroupSchema,
  field_source_map: z.record(z.string(), fieldValueSourceSchema),
  ambiguity_notes: z.array(z.string()).default([]),
  recommended_defaults: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  transcript_words: z.array(transcribedWordSchema).default([]),
  enrichment_candidates: z.array(enrichmentCandidateSchema).default([])
});

export type MetadataProfile = z.infer<typeof metadataProfileSchema>;

export const clipScoreSchema = z.object({
  hook: z.number().min(0).max(10),
  clarity: z.number().min(0).max(10),
  payoff: z.number().min(0).max(10),
  emotion: z.number().min(0).max(10),
  shareability: z.number().min(0).max(10),
  curiosity: z.number().min(0).max(10),
  clip_cleanliness: z.number().min(0).max(10),
  platform_fit: z.number().min(0).max(10)
});

export type ClipScore = z.infer<typeof clipScoreSchema>;

export const clipHeuristicSignalsSchema = z.object({
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

export type ClipHeuristicSignals = z.infer<typeof clipHeuristicSignalsSchema>;

export const clipCandidateSchema = z.object({
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
  final_score: z.number().min(0).max(10),
  ranking_notes: z.array(z.string()),
  recommended_start_adjustment_ms: z.number().int(),
  recommended_end_adjustment_ms: z.number().int()
});

export type ClipCandidate = z.infer<typeof clipCandidateSchema>;

export const clipPortraitFocusSchema = z.object({
  mode: z.enum(["center", "speaker_head", "semantic_anchor"]),
  aspect_ratio: z.literal("9:16"),
  focus_x_pct: z.number().min(0).max(100),
  focus_y_pct: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  reference_label: z.string().nullable(),
  rationale: z.string()
});

export type ClipPortraitFocus = z.infer<typeof clipPortraitFocusSchema>;

export const selectedClipSchema = clipCandidateSchema.extend({
  rank: z.number().int().positive(),
  export_start_ms: z.number().nonnegative(),
  export_end_ms: z.number().nonnegative(),
  export_duration_ms: z.number().positive(),
  virality_score: z.number().min(0).max(10),
  reason_selected: z.string(),
  hook_line: z.string(),
  suggested_title: z.string(),
  suggested_caption: z.string(),
  punch_in_moments_ms: z.array(z.number().nonnegative()),
  subtitle_emphasis_words: z.array(z.string()),
  portrait_focus: clipPortraitFocusSchema.optional()
});

export type SelectedClip = z.infer<typeof selectedClipSchema>;

export const clipSelectionSchema = z.object({
  job_id: z.string(),
  plan_version: z.string(),
  source_summary: z.object({
    transcript_available: z.boolean(),
    transcript_source: z.string(),
    target_platform: targetPlatformSchema,
    creator_niche: z.string().nullable(),
    requested_clip_count_min: z.number().int().nullable(),
    requested_clip_count_max: z.number().int().nullable(),
    candidate_count: z.number().int().nonnegative(),
    selected_count: z.number().int().nonnegative()
  }),
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
});

export type ClipSelection = z.infer<typeof clipSelectionSchema>;

export const editPlanSchema = z.object({
  job_id: z.string(),
  plan_version: z.string(),
  job_summary: z.object({
    prompt_excerpt: z.string(),
    has_source_video: z.boolean(),
    asset_count: z.number().int().nonnegative(),
    transcript_available: z.boolean()
  }),
  intent_profile: z.record(z.string(), z.unknown()),
  operation_order: z.array(z.string()),
  timeline_strategy: z.record(z.string(), z.unknown()),
  pacing_plan: z.record(z.string(), z.unknown()),
  typography_plan: z.record(z.string(), z.unknown()),
  motion_plan: z.record(z.string(), z.unknown()),
  audio_plan: z.record(z.string(), z.unknown()),
  clip_finder_plan: z.object({
    enabled: z.boolean(),
    transcript_required: z.boolean(),
    target_platform: targetPlatformSchema,
    creator_niche: z.string().nullable(),
    requested_clip_count_min: z.number().int().nullable(),
    requested_clip_count_max: z.number().int().nullable(),
    candidate_count: z.number().int().nonnegative(),
    selected_clip_count: z.number().int().nonnegative(),
    selected_clip_ids: z.array(z.string())
  }),
  enrichment_plan: z.object({
    enabled: z.boolean(),
    source_candidates: z.array(enrichmentCandidateSchema),
    threshold_summary: z.record(z.string(), z.unknown()),
    search_terms: z.array(z.string())
  }),
  asset_usage_rules: z.record(z.string(), z.unknown()),
  fallback_plan: z.record(z.string(), z.unknown()),
  warnings: z.array(z.string()),
  unresolved_items: z.array(z.string())
});

export type EditPlan = z.infer<typeof editPlanSchema>;

export const executionPlanSchema = z.object({
  job_id: z.string(),
  plan_version: z.string(),
  validated: z.boolean(),
  validation_report: z.object({
    valid: z.boolean(),
    warnings: z.array(z.string()),
    errors: z.array(z.string())
  }),
  dependencies: z.array(
    z.object({
      step: z.string(),
      depends_on: z.array(z.string())
    })
  ),
  execution_steps: z.array(
    z.object({
      id: z.string(),
      stage: z.string(),
      action: z.string(),
      reads: z.array(z.string()),
      writes: z.array(z.string()),
      optional: z.boolean()
    })
  ),
  timeline_updates: z.array(
    z.object({
      step_id: z.string(),
      mutation: z.string(),
      reason: z.string()
    })
  ),
  asset_insertions: z.array(
    z.object({
      entity_text: z.string(),
      strategy: z.string(),
      fallback_strategy: z.string()
    })
  ),
  fallback_events: z.array(fallbackEventSchema),
  blocked_items: z.array(z.string()),
  final_ready_state: z.object({
    ready_for_renderer: z.boolean(),
    missing_optional_components: z.array(z.string()),
    next_recommended_stage: z.string()
  })
});

export type ExecutionPlan = z.infer<typeof executionPlanSchema>;

export const jobRecordSchema = z.object({
  job_id: z.string(),
  status: jobStageSchema,
  current_stage: jobStageSchema,
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable(),
  stage_history: z.array(
    z.object({
      stage: jobStageSchema,
      at: z.string(),
      note: z.string().optional()
    })
  ),
  progress: z.object({
    current_step: z.number().int().nonnegative(),
    total_steps: z.number().int().positive(),
    percent: z.number().min(0).max(100)
  }),
  request_summary: z.object({
    prompt_excerpt: z.string(),
    source_media_ref: z.string().nullable(),
    has_source_video: z.boolean(),
    asset_count: z.number().int().nonnegative()
  }),
  source_summary: z.object({
    source_filename: z.string().nullable(),
    source_storage_uri: z.string().nullable(),
    source_duration_ms: z.number().nullable(),
    source_aspect_ratio: z.string().nullable()
  }),
  warning_list: z.array(z.string()),
  error_message: z.string().nullable(),
  template_versions: z.object({
    metadata_synthesizer: z.string(),
    enrichment_planner: z.string(),
    central_edit_planner: z.string(),
    execution_planner: z.string()
  }),
  artifact_paths: z.object({
    job: z.string(),
    input_manifest: z.string(),
    metadata_profile: z.string().nullable(),
    clip_selection: z.string().nullable(),
    edit_plan: z.string().nullable(),
    motion_plan: z.string().nullable(),
    execution_plan: z.string().nullable(),
    fallback_log: z.string().nullable(),
    video_aware_audio_plan: z.string().nullable(),
    video_aware_sound_manifest: z.string().nullable(),
    video_aware_music_preflight: z.string().nullable().default(null),
    video_aware_music_overrides: z.string().nullable().default(null),
    video_aware_audio_preview_mix: z.string().nullable().default(null),
    audio_render_plan: z.string().nullable(),
    audio_master: z.string().nullable(),
    audio_master_aac: z.string().nullable(),
    audio_preview_mix: z.string().nullable(),
    audio_waveform_png: z.string().nullable(),
    audio_peaks_json: z.string().nullable(),
    audio_stems_dir: z.string().nullable()
  })
});

export type JobRecord = z.infer<typeof jobRecordSchema>;
