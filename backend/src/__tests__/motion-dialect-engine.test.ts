import {describe, expect, it} from "vitest";

import type {MetadataProfile, TranscribedWord} from "../schemas";
import {buildMotionDialectPlan} from "../typography/motion-dialect-engine";

const createMetadataProfile = (overrides?: Partial<MetadataProfile>): MetadataProfile => ({
  job: {},
  source_media: {},
  derived_technical: {},
  user_intent: {
    tone_target: "luxury-cinematic",
    pace_target: "balanced",
    editing_style_keywords: ["restraint", "premium"]
  },
  output: {},
  timing_pacing: {
    speech_rate_estimate: 2.1,
    pacing_style: "premium-tight",
    minimum_pause_ms: 120
  },
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
  enrichment_candidates: [],
  transcript_words: [],
  ...overrides
});

describe("motion-dialect-engine", () => {
  it("maps a pause/restraint segment to restrained motion parameters", () => {
    const words: TranscribedWord[] = [
      {text: "Listen", start_ms: 0, end_ms: 180},
      {text: "carefully.", start_ms: 190, end_ms: 420},
      {text: " ", start_ms: 421, end_ms: 421},
      {text: "Then", start_ms: 1200, end_ms: 1380},
      {text: "pause.", start_ms: 1390, end_ms: 1700}
    ].filter((word) => word.text.trim().length > 0);

    const plan = buildMotionDialectPlan({
      metadata: createMetadataProfile({
        transcript_words: words
      }),
      transcriptWords: words
    });

    expect(plan.segments).toHaveLength(2);
    expect(plan.segments[1]?.moment).toBe("Pause/Restraint");
    expect(plan.segments[1]?.dialect.axis).toBe("y");
    expect(plan.segments[1]?.dialect.opacityRange[1]).toBeLessThanOrEqual(0.18);
    expect(plan.segments[1]?.dialect.motionPreset).toBe("pauseRestraint");
  });

  it("restrains motion when high-intensity density exceeds forty percent", () => {
    const words: TranscribedWord[] = [
      {text: "Now!", start_ms: 0, end_ms: 100},
      {text: "Move!", start_ms: 110, end_ms: 220},
      {text: "Push!", start_ms: 230, end_ms: 340},
      {text: "Breathe.", start_ms: 900, end_ms: 1200}
    ];

    const plan = buildMotionDialectPlan({
      metadata: createMetadataProfile({
        user_intent: {
          tone_target: "aggressive-high-contrast",
          pace_target: "high",
          editing_style_keywords: ["urgent", "impact", "shock"]
        },
        timing_pacing: {
          speech_rate_estimate: 4.1,
          pacing_style: "sales-tight",
          minimum_pause_ms: 120
        },
        transcript_words: words
      }),
      transcriptWords: words
    });

    expect(plan.sceneRestraintApplied).toBe(true);
    expect(plan.segments.every((segment) => segment.dialect.intensity <= 0.7)).toBe(true);
  });
});
