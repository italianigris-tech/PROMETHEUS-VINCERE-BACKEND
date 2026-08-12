import {describe, expect, it} from "vitest";

import {
  MAUL_FRAME_MOTION_CAPABILITIES,
  compileMaulWordMotion,
  getMaulMotionCapability,
} from "./frame-motion-compiler";

const gsapIds = [
  "agentic_split_rise",
  "interesting_blur_lift",
  "cinematic_focus_lock",
  "generic_single_word",
  "two_word_cinematic_pair",
  "two_word_stagger_punch",
  "two_word_arc_sweep",
  "two_word_dual_rise",
  "two_word_focus_pivot",
  "three_word_serif_orbit",
  "three_word_tall_blade",
  "three_word_script_glide",
  "three_word_ref_lockup",
  "three_word_ref_last_punch",
  "three_word_ref_through_column",
  "three_word_ref_script_tag",
  "three_word_ref_dream_big_now_v1",
  "three_word_ref_your_master_mind_v1",
  "three_word_ref_take_action_now_v1",
  "three_word_ref_build_legacy_your_v1",
  "four_word_banner_drift",
  "four_word_split_stagger",
  "four_word_serif_pivot",
  "four_word_outline_whip",
  "six_word_quad_duo_depth",
  "two_word_script_caption_lock",
] as const;

const svgIds = [
  "cinematic_text_preset",
  "cinematic_text_preset_1",
  "cinematic_text_preset_2",
  "cinematic_text_preset_3",
  "cinematic_text_preset_4",
  "cinematic_text_preset_5",
  "cinematic_text_preset_6",
  "cinematic_text_preset_7",
  "cinematic_text_preset_8",
  "cinematic_text_preset_9",
  "cinematic_text_preset_10",
  "cinematic_text_preset_11",
] as const;

const josephIds = [
  "text-entry.word-riser",
  "text-entry.letter-riser",
  "text-entry.soft-letter-tracking",
  "text-entry.velocity-slide-reveal",
  "text-entry.clipped-mask-reveal",
  "text-emphasis.underline-reveal",
  "text-emphasis.sweep-highlight",
  "text-emphasis.capsule-highlight",
  "text-emphasis.marker-stroke",
  "text-emphasis.semantic-glow",
  "text-mutation.weight-escalation",
  "text-mutation.emphasis-handoff",
  "accent-motion.bracket-lock",
  "accent-motion.caption-rail",
  "spatial-motion.anchored-drift",
] as const;

const allIds = [...gsapIds, ...svgIds, ...josephIds];

const compile = (treatmentId: string) => compileMaulWordMotion({
  treatmentId,
  token: {
    tokenId: "token_a",
    text: "Cinematic",
    sourceStartMs: 1_000,
    sourceEndMs: 1_800,
  },
  outputStartMs: 2_000,
  outputEndMs: 2_800,
  fps: 30,
  placementSegmentId: "segment_a",
});

describe("MAUL frame motion compiler", () => {
  it("covers every inventoried executable animation source exactly once", () => {
    expect(allIds).toHaveLength(53);
    expect(MAUL_FRAME_MOTION_CAPABILITIES).toHaveLength(53);
    expect(new Set(MAUL_FRAME_MOTION_CAPABILITIES.map((entry) => entry.treatmentId)).size).toBe(53);
    expect(MAUL_FRAME_MOTION_CAPABILITIES.map((entry) => entry.treatmentId).sort()).toEqual(
      [...allIds].sort(),
    );

    for (const treatmentId of allIds) {
      const capability = getMaulMotionCapability(treatmentId);
      expect(capability, treatmentId).not.toBeNull();
      const program = compile(treatmentId);
      expect(program.sourceTreatment).toBe(treatmentId);
      expect(program.executorId).toBe(capability?.executorId);
      expect(program.tokenId).toBe("token_a");
      expect(program.sourceIntervalMs).toEqual({startMs: 1_000, endMs: 1_800});
      expect(program.phases.entry.endFrame).toBeGreaterThan(program.phases.entry.startFrame);
      expect(program.phases.hold.endFrame).toBeGreaterThan(program.phases.hold.startFrame);
      expect(program.phases.exit.endFrame).toBeGreaterThan(program.phases.exit.startFrame);
    }
  });

  it("keeps family mechanics distinct instead of applying one generic reveal", () => {
    const rise = compile("generic_single_word");
    const arc = compile("two_word_arc_sweep");
    const tracking = compile("text-entry.soft-letter-tracking");

    expect(rise.phases.entry.from).not.toEqual(arc.phases.entry.from);
    expect(tracking.unit).toBe("letter");
    expect(tracking.phases.entry.from.trackingEm).not.toBe(0);
  });

  it("compiles a renderer-owned cinematic recipe for every one of the 53 sources", () => {
    const programs = allIds.map(compile);
    const signatures = programs.map((program) => JSON.stringify(program.visualRecipe));

    expect(programs.every((program) => program.visualRecipe !== undefined)).toBe(true);
    expect(new Set(signatures).size).toBe(53);
    expect(compile("text-emphasis.underline-reveal").visualRecipe?.accent).toBe("underline");
    expect(compile("text-emphasis.sweep-highlight").visualRecipe?.accent).toBe("highlight");
    expect(compile("text-emphasis.semantic-glow").visualRecipe?.accent).toBe("glow");
    expect(compile("accent-motion.bracket-lock").visualRecipe?.accent).toBe("bracket");
    expect(compile("three_word_ref_build_legacy_your_v1").visualRecipe?.depthPx).toBeGreaterThan(0);
  });

  it("uses the assembled chunk hold for very short spoken words", () => {
    expect(() => compile("not-a-treatment")).toThrow(/unsupported.*treatment/i);
    const shortSpokenWord = compileMaulWordMotion({
      treatmentId: "generic_single_word",
      token: {
        tokenId: "token_short",
        text: "One",
        sourceStartMs: 160,
        sourceEndMs: 240,
      },
      outputStartMs: 160,
      outputEndMs: 240,
      fps: 30,
      placementSegmentId: "segment_a",
    });
    expect(shortSpokenWord.phases.entry.startFrame).toBe(4);
    expect(shortSpokenWord.phases.exit.endFrame).toBe(8);

    const heldShortWord = compileMaulWordMotion({
      treatmentId: "generic_single_word",
      token: {
        tokenId: "token_held_short",
        text: "a",
        sourceStartMs: 0,
        sourceEndMs: 40,
      },
      outputStartMs: 0,
      outputEndMs: 40,
      holdUntilMs: 400,
      fps: 30,
      placementSegmentId: "segment_a",
    });
    expect(heldShortWord.phases.entry.endFrame).toBe(5);
    expect(heldShortWord.phases.hold.endFrame).toBe(11);
    expect(heldShortWord.phases.exit.endFrame).toBe(12);

    expect(() => compileMaulWordMotion({
      treatmentId: "generic_single_word",
      token: {
        tokenId: "token_a",
        text: "No",
        sourceStartMs: 0,
        sourceEndMs: 40,
      },
      outputStartMs: 0,
      outputEndMs: 40,
      fps: 30,
      placementSegmentId: "segment_a",
    })).toThrow(/no readable hold/i);
  });

  it("holds each word entrance long enough to be visible at production frame rates", () => {
    const program = compileMaulWordMotion({
      treatmentId: "text-entry.letter-riser",
      token: {
        tokenId: "token_visible_entry",
        text: "Luxury",
        sourceStartMs: 0,
        sourceEndMs: 80,
      },
      outputStartMs: 0,
      outputEndMs: 80,
      holdUntilMs: 500,
      fps: 30,
      placementSegmentId: "segment_a",
    });

    expect(program.phases.entry.endFrame - program.phases.entry.startFrame).toBeGreaterThanOrEqual(5);
  });
});
