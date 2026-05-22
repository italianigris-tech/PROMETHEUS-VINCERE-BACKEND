import {describe, expect, it} from "vitest";

import {METADATA_CATALOG_ENTRIES} from "../metadata-catalog";
import {motionPlanArtifactSchema} from "../motion-plan";
import {
  clipSelectionSchema,
  editPlanSchema,
  executionPlanSchema,
  fallbackEventSchema,
  jobRecordSchema,
  jobRequestJsonSchema,
  metadataProfileSchema
} from "../schemas";

describe("backend schemas", () => {
  it("parses the public JSON job request", () => {
    const parsed = jobRequestJsonSchema.parse({
      prompt: "Make this cinematic and premium.",
      metadata_overrides: {
        typography: {
          caption_style_profile: "slcp"
        }
      }
    });

    expect(parsed.prompt).toContain("cinematic");
  });

  it("parses metadata, edit, execution, and fallback artifacts", () => {
    const metadata = metadataProfileSchema.parse({
      job: {job_id: "job_1"},
      source_media: {},
      derived_technical: {},
      user_intent: {},
      output: {},
      timing_pacing: {},
      transcript_language: {},
      entity_enrichment: {},
      uploaded_assets: {},
      typography: {},
      motion_graphics: {},
      layout_collision: {},
      audio: {},
      color_finish: {},
      transitions: {},
      execution_orchestration: {},
      fallback: {},
      search_sourcing: {},
      field_source_map: {},
      ambiguity_notes: [],
      recommended_defaults: [],
      warnings: [],
      transcript_words: [],
      enrichment_candidates: []
    });

    const fallback = fallbackEventSchema.parse({
      code: "test",
      stage: "stage",
      severity: "warning",
      message: "fallback",
      details: {},
      created_at: new Date().toISOString()
    });

    const editPlan = editPlanSchema.parse({
      job_id: "job_1",
      plan_version: "1.0.0",
      job_summary: {
        prompt_excerpt: "hello",
        has_source_video: false,
        asset_count: 0,
        transcript_available: false
      },
      intent_profile: {},
      operation_order: [],
      timeline_strategy: {},
      pacing_plan: {},
      typography_plan: {},
      motion_plan: {},
      audio_plan: {},
      clip_finder_plan: {
        enabled: true,
        transcript_required: true,
        target_platform: "shorts",
        creator_niche: null,
        requested_clip_count_min: 2,
        requested_clip_count_max: 4,
        candidate_count: 4,
        selected_clip_count: 2,
        selected_clip_ids: ["clip_1", "clip_2"]
      },
      enrichment_plan: {
        enabled: true,
        source_candidates: [],
        threshold_summary: {},
        search_terms: []
      },
      asset_usage_rules: {},
      fallback_plan: {},
      warnings: [],
      unresolved_items: []
    });

    const motionPlan = motionPlanArtifactSchema.parse({
      job_id: "job_1",
      plan_version: "2026-04-15-backend-motion-plan-v1",
      generated_at: new Date().toISOString(),
      source_summary: {},
      policy: {},
      catalog_summary: {},
      selected_assets: [],
      asset_assignments: [],
      timeline_events: [],
      paired_effects: [],
      validation: {
        warnings: [],
        errors: [],
        rejected_assets: []
      },
      notes: []
    });

    const executionPlan = executionPlanSchema.parse({
      job_id: "job_1",
      plan_version: "1.0.0",
      validated: true,
      validation_report: {
        valid: true,
        warnings: [],
        errors: []
      },
      dependencies: [],
      execution_steps: [],
      timeline_updates: [],
      asset_insertions: [],
      fallback_events: [fallback],
      blocked_items: [],
      final_ready_state: {
        ready_for_renderer: true,
        missing_optional_components: [],
        next_recommended_stage: "render_handoff"
      }
    });

    const clipSelection = clipSelectionSchema.parse({
      job_id: "job_1",
      plan_version: "1.0.0",
      source_summary: {
        transcript_available: true,
        transcript_source: "provided",
        target_platform: "shorts",
        creator_niche: "creator",
        requested_clip_count_min: 2,
        requested_clip_count_max: 4,
        candidate_count: 6,
        selected_count: 2
      },
      window_config: [
        {
          label: "tight_hook",
          min_duration_ms: 10000,
          target_duration_ms: 16000,
          max_duration_ms: 20000,
          step_ms: 4000
        }
      ],
      scoring_weights: {
        hook: 0.22,
        clarity: 0.18,
        payoff: 0.18,
        emotion: 0.12,
        shareability: 0.12,
        curiosity: 0.08,
        clip_cleanliness: 0.06,
        platform_fit: 0.04
      },
      candidate_segments: [
        {
          clip_id: "clip_1",
          window_label: "tight_hook",
          start_ms: 0,
          end_ms: 16000,
          duration_ms: 16000,
          transcript_excerpt: "Most creators make one mistake.",
          leading_context: "",
          trailing_context: "Here's why it matters.",
          scores: {
            hook: 8,
            clarity: 7.5,
            payoff: 7.2,
            emotion: 6.1,
            shareability: 7.8,
            curiosity: 7.4,
            clip_cleanliness: 7.1,
            platform_fit: 8.8
          },
          heuristic_signals: {
            opening_question: false,
            strong_hook_phrase: true,
            contrast_phrase: false,
            emotional_phrase: false,
            quoteable_sentence: true,
            context_dependency_penalty: false,
            clean_start_boundary: true,
            clean_end_boundary: true,
            matched_keywords: ["most_people"],
            emphasis_words: ["mistake"]
          },
          final_score: 7.65,
          ranking_notes: ["Strong opening tension lands quickly."],
          recommended_start_adjustment_ms: -900,
          recommended_end_adjustment_ms: 1200
        }
      ],
      selected_clips: [
        {
          clip_id: "clip_1",
          window_label: "tight_hook",
          start_ms: 0,
          end_ms: 16000,
          duration_ms: 16000,
          transcript_excerpt: "Most creators make one mistake.",
          leading_context: "",
          trailing_context: "Here's why it matters.",
          scores: {
            hook: 8,
            clarity: 7.5,
            payoff: 7.2,
            emotion: 6.1,
            shareability: 7.8,
            curiosity: 7.4,
            clip_cleanliness: 7.1,
            platform_fit: 8.8
          },
          heuristic_signals: {
            opening_question: false,
            strong_hook_phrase: true,
            contrast_phrase: false,
            emotional_phrase: false,
            quoteable_sentence: true,
            context_dependency_penalty: false,
            clean_start_boundary: true,
            clean_end_boundary: true,
            matched_keywords: ["most_people"],
            emphasis_words: ["mistake"]
          },
          final_score: 7.65,
          ranking_notes: ["Strong opening tension lands quickly."],
          recommended_start_adjustment_ms: -900,
          recommended_end_adjustment_ms: 1200,
          rank: 1,
          export_start_ms: 0,
          export_end_ms: 17200,
          export_duration_ms: 17200,
          virality_score: 7.65,
          reason_selected: "Strong opening tension lands quickly.",
          hook_line: "Most creators make one mistake.",
          suggested_title: "Most creators make one mistake",
          suggested_caption: "Most creators make one mistake. Strong opening tension lands quickly.",
          punch_in_moments_ms: [2500, 11000],
          subtitle_emphasis_words: ["mistake"],
          portrait_focus: {
            mode: "speaker_head",
            aspect_ratio: "9:16",
            focus_x_pct: 50,
            focus_y_pct: 34,
            confidence: 0.65,
            reference_label: "speaker head",
            rationale: "Speaker-head framing keeps the portrait crop centered without extra tracking dependencies."
          }
        }
      ],
      warnings: []
    });

    const jobRecord = jobRecordSchema.parse({
      job_id: "job_1",
      status: "received",
      current_stage: "received",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      stage_history: [{stage: "received", at: new Date().toISOString()}],
      progress: {
        current_step: 0,
        total_steps: 7,
        percent: 0
      },
      request_summary: {
        prompt_excerpt: "hello",
        source_media_ref: null,
        has_source_video: false,
        asset_count: 0,
        has_sound_design_manifest: false
      },
      source_summary: {
        source_filename: null,
        source_storage_uri: null,
        source_duration_ms: null,
        source_aspect_ratio: null
      },
      warning_list: [],
      error_message: null,
      template_versions: {
        metadata_synthesizer: "a",
        enrichment_planner: "b",
        central_edit_planner: "c",
        execution_planner: "d"
      },
      artifact_paths: {
        job: "job.json",
        input_manifest: "inputs/manifest.json",
        metadata_profile: null,
        clip_selection: null,
        edit_plan: null,
        motion_plan: null,
        execution_plan: null,
        fallback_log: null,
        video_aware_audio_plan: null,
        video_aware_sound_manifest: null,
        video_aware_music_preflight: null,
        audio_render_plan: null,
        audio_master: null,
        audio_master_aac: null,
        audio_preview_mix: null,
        audio_waveform_png: null,
        audio_peaks_json: null,
        audio_stems_dir: null
      }
    });

    expect(metadata.job.job_id).toBe("job_1");
    expect(clipSelection.selected_clips[0].rank).toBe(1);
    expect(editPlan.job_id).toBe("job_1");
    expect(motionPlan.job_id).toBe("job_1");
    expect(executionPlan.validated).toBe(true);
    expect(jobRecord.status).toBe("received");
  });

  it("exposes a large metadata catalog for frontend form building", () => {
    expect(METADATA_CATALOG_ENTRIES.length).toBeGreaterThan(70);
    expect(METADATA_CATALOG_ENTRIES.some((entry) => entry.key_path === "typography.caption_style_profile")).toBe(
      true
    );
  });
});
