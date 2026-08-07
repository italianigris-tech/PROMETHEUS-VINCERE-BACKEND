import {describe, expect, it} from "vitest";

import {
  maulTextAnimationPlanCoreSchema,
  maulTextAnimationTreatmentSchema,
} from "./index.js";

const sha = (character: string) => character.repeat(64);

const transform = {
  opacity: 1,
  translateXPx: 0,
  translateYPx: 0,
  scale: 1,
} as const;

const animationPlan = {
  schemaVersion: "maul-text-animation-plan/v1",
  textChunkPlanArtifactId: "artifact_text_chunk",
  textChunkPlanHash: sha("a"),
  textPlacementPlanArtifactId: "artifact_text_placement",
  textPlacementPlanHash: sha("b"),
  treatmentGenomeArtifactId: "artifact_treatment",
  treatmentGenomeHash: sha("c"),
  outputDurationMs: 1200,
  programs: [
    {
      animationId: "animation_segment_a",
      treatment: "fade_rise",
      target: {
        scope: "segment",
        placementSegmentId: "placement_segment_a",
        tokenIds: ["token_a", "token_b"],
      },
      phases: {
        entry: {
          outputStartMs: 0,
          outputEndMs: 180,
          easing: {type: "cubic_bezier", x1: 0.16, y1: 1, x2: 0.3, y2: 1},
          from: {...transform, opacity: 0, translateYPx: 28},
          to: transform,
        },
        hold: {
          outputStartMs: 180,
          outputEndMs: 900,
          easing: {type: "linear"},
          from: transform,
          to: transform,
        },
        exit: {
          outputStartMs: 900,
          outputEndMs: 1100,
          easing: {type: "cubic_bezier", x1: 0.4, y1: 0, x2: 1, y2: 1},
          from: transform,
          to: {...transform, opacity: 0, translateYPx: -16},
        },
      },
      rationale: "Reveal the governed caption without changing its placement.",
    },
  ],
  inputHashes: {
    textChunkPlan: sha("a"),
    textPlacementPlan: sha("b"),
    treatmentGenome: sha("c"),
  },
} as const;

const clone = <Value>(value: Value): Value => structuredClone(value);

describe("MAUL text animation core contract", () => {
  it("exposes imported treatment families alongside MAUL tracer treatments", () => {
    expect(maulTextAnimationTreatmentSchema.options).toEqual(expect.arrayContaining([
      "fade_rise", "keyword_pop", "continuous_push", "softSlideRight",
      "two_word_cinematic_pair", "cinematic_text_preset_11",
      "word-rise-blur-resolve", "word-cross-out",
      "position_locked_word_reveal",
      "position_locked_letter_reveal",
    ]));
    expect(maulTextAnimationTreatmentSchema.options.length).toBeGreaterThan(3);
    expect(() => maulTextAnimationTreatmentSchema.parse("spring")).toThrow();
  });

  it("accepts stable placement-segment and token references", () => {
    const parsed = maulTextAnimationPlanCoreSchema.parse(animationPlan);

    expect(parsed.programs[0]?.target).toEqual({
      scope: "segment",
      placementSegmentId: "placement_segment_a",
      tokenIds: ["token_a", "token_b"],
    });
  });

  it("accepts a bounded position-locked letter reveal primitive", () => {
    const plan = clone(animationPlan) as any;
    plan.programs[0].treatment = "position_locked_letter_reveal";
    plan.programs[0].target.scope = "tokens";
    plan.programs[0].localReveal = {
      unit: "letter",
      primitive: "blur_tracking",
      sourceTreatment: "tracking-collapse",
      tokenStaggerMs: 48,
      letterStaggerMs: 18,
      durationMs: 180,
      blurPx: 8,
      trackingEm: 0.08,
      startScale: 0.96,
    };
    for (const phase of Object.values(plan.programs[0].phases) as any[]) {
      phase.from.translateXPx = 0;
      phase.from.translateYPx = 0;
      phase.to.translateXPx = 0;
      phase.to.translateYPx = 0;
    }

    expect(maulTextAnimationPlanCoreSchema.parse(plan).programs[0]?.localReveal).toMatchObject({
      unit: "letter",
      primitive: "blur_tracking",
    });
  });

  it("rejects duplicate animation, segment, or token references", () => {
    const duplicateAnimation = clone(animationPlan);
    duplicateAnimation.programs.push(clone(duplicateAnimation.programs[0]));
    expect(() =>
      maulTextAnimationPlanCoreSchema.parse(duplicateAnimation),
    ).toThrow(/animation IDs.*unique|unique.*animation IDs/i);

    const duplicateSegment = clone(animationPlan);
    duplicateSegment.programs.push({
      ...clone(duplicateSegment.programs[0]),
      animationId: "animation_segment_b",
    });
    expect(() =>
      maulTextAnimationPlanCoreSchema.parse(duplicateSegment),
    ).toThrow(/placement segment.*one segment|one segment.*placement segment/i);

    const duplicateToken = clone(animationPlan);
    duplicateToken.programs[0].target.tokenIds = ["token_a", "token_a"];
    expect(() =>
      maulTextAnimationPlanCoreSchema.parse(duplicateToken),
    ).toThrow(/token references.*unique|unique.*token references/i);
  });

  it("rejects overlapping entry, hold, and exit intervals", () => {
    const invalid = clone(animationPlan);
    invalid.programs[0].phases.hold.outputStartMs = 150;

    expect(() => maulTextAnimationPlanCoreSchema.parse(invalid)).toThrow(
      /entry.*hold.*exit.*non-overlapping|non-overlapping.*phases/i,
    );
  });

  it("requires continuous transforms across phase boundaries", () => {
    const invalid = clone(animationPlan) as any;
    invalid.programs[0].phases.hold.from = {
      ...invalid.programs[0].phases.hold.from,
      translateXPx: 1,
    };

    expect(() => maulTextAnimationPlanCoreSchema.parse(invalid)).toThrow(
      /phase.*transform.*continuous|continuous.*phase.*transform/i,
    );
  });

  it("rejects phase intervals outside the output duration", () => {
    const invalid = clone(animationPlan);
    invalid.programs[0].phases.exit.outputEndMs = 1300;

    expect(() => maulTextAnimationPlanCoreSchema.parse(invalid)).toThrow(
      /output duration/i,
    );
  });

  it("rejects transforms outside renderer bounds", () => {
    const invalidOpacity = clone(animationPlan);
    invalidOpacity.programs[0].phases.entry.from.opacity = -0.01;
    expect(() =>
      maulTextAnimationPlanCoreSchema.parse(invalidOpacity),
    ).toThrow();

    const invalidTranslation = clone(animationPlan);
    invalidTranslation.programs[0].phases.entry.from.translateYPx = 1921;
    expect(() =>
      maulTextAnimationPlanCoreSchema.parse(invalidTranslation),
    ).toThrow();

    const invalidScale = clone(animationPlan);
    invalidScale.programs[0].phases.entry.from.scale = 2.01;
    expect(() =>
      maulTextAnimationPlanCoreSchema.parse(invalidScale),
    ).toThrow();
  });

  it("requires explicit easing on every phase", () => {
    const invalid = clone(animationPlan) as any;
    delete invalid.programs[0].phases.hold.easing;

    expect(() => maulTextAnimationPlanCoreSchema.parse(invalid)).toThrow();
  });

  it("allows a keyword family as a restrained segment base treatment", () => {
    const plan = clone(animationPlan);
    plan.programs[0].treatment = "keyword_pop";
    plan.programs[0].target.scope = "segment";

    expect(maulTextAnimationPlanCoreSchema.parse(plan).programs[0]?.target.scope).toBe("segment");
  });

  it("binds authoritative parent hashes to input hashes", () => {
    const invalid = clone(animationPlan);
    invalid.inputHashes.textPlacementPlan = sha("d");

    expect(() => maulTextAnimationPlanCoreSchema.parse(invalid)).toThrow(
      /input hashes.*authoritative|authoritative.*input hashes/i,
    );
  });
});
