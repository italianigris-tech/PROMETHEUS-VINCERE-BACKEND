import {describe, expect, it} from "vitest";
import {
  evaluateMicroAnimationSelections,
  JOSEPH_MICRO_ANIMATION_CATALOG,
  JOSEPH_MICRO_ANIMATION_COMBINATION_RULES,
  JOSEPH_MICRO_ANIMATION_TAXONOMY,
  selectMicroAnimationPrimitive,
  type TimedMicroAnimationSelection,
} from "./micro-animation-primitives";

const selection = (
  primitiveId: string,
  overrides: Partial<TimedMicroAnimationSelection> = {},
): TimedMicroAnimationSelection => ({
  primitiveId,
  family: "text_emphasis",
  role: "emphasis",
  renderFallback: "pop",
  combinationGroup: "emphasis-mark",
  semanticRole: "hero",
  parameters: {
    intensity: 0.7,
    durationMs: 300,
    delayMs: 0,
    anchor: "word",
    direction: "right",
  },
  startFrame: 10,
  endFrame: 30,
  ...overrides,
});

describe("Joseph micro-animation primitive library", () => {
  it("defines a reference-derived taxonomy across the required primitive families", () => {
    expect(JOSEPH_MICRO_ANIMATION_TAXONOMY.map((entry) => entry.family)).toEqual([
      "text_emphasis",
      "text_entry",
      "text_mutation",
      "accent_motion",
      "spatial_micro_motion",
    ]);

    for (const entry of JOSEPH_MICRO_ANIMATION_TAXONOMY) {
      expect(entry.referenceBehaviors.length).toBeGreaterThan(0);
      expect(entry.usageConditions.length).toBeGreaterThan(0);
      expect(entry.antiPatterns.length).toBeGreaterThan(0);
      expect(entry.namingConvention).toContain(".");
    }
  });

  it("ships an initial premium primitive catalog instead of only legacy render modes", () => {
    expect(JOSEPH_MICRO_ANIMATION_CATALOG.length).toBeGreaterThanOrEqual(12);

    const ids = JOSEPH_MICRO_ANIMATION_CATALOG.map((primitive) => primitive.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(JOSEPH_MICRO_ANIMATION_CATALOG.map((primitive) => primitive.family)).size).toBe(5);
    expect(JOSEPH_MICRO_ANIMATION_CATALOG.map((primitive) => primitive.renderFallback)).toEqual(
      expect.arrayContaining(["pop", "slide_up", "typewriter", "elastic_scale"]),
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        "text-entry.word-riser",
        "text-emphasis.sweep-highlight",
        "text-mutation.weight-escalation",
        "accent-motion.bracket-lock",
        "spatial-motion.anchored-drift",
      ]),
    );
  });

  it("selects doctrine-aware primitives while keeping render-safe fallbacks", () => {
    const rng = () => 0.05;
    const primitive = selectMicroAnimationPrimitive({
      rng,
      doctrineId: "kinetic-pulse",
      semanticRole: "hero",
      energy: 0.9,
      overlayIndex: 0,
    });

    expect(primitive.primitiveId).toMatch(/^(text-entry|text-emphasis|text-mutation|accent-motion)\./);
    expect(["pop", "slide_up", "glitch", "typewriter", "elastic_scale"]).toContain(primitive.renderFallback);
    expect(primitive.parameters.intensity).toBeGreaterThan(0.6);
  });

  it("exposes primitive combination rules and scores visual chaos", () => {
    expect(JOSEPH_MICRO_ANIMATION_COMBINATION_RULES.map((rule) => rule.failureTag)).toEqual(
      expect.arrayContaining([
        "micro_entry_collision",
        "micro_emphasis_collision",
        "micro_animation_visual_chaos",
        "micro_animation_semantic_mismatch",
      ]),
    );

    const quality = evaluateMicroAnimationSelections([
      selection("text-emphasis.sweep-highlight", {startFrame: 0, endFrame: 20}),
      selection("text-emphasis.underline-reveal", {startFrame: 5, endFrame: 25}),
      selection("text-emphasis.capsule-highlight", {startFrame: 8, endFrame: 30}),
      selection("accent-motion.bracket-lock", {
        family: "accent_motion",
        role: "accent",
        combinationGroup: "accent-guide",
        startFrame: 10,
        endFrame: 32,
      }),
    ]);

    expect(quality.failures).toContain("micro_emphasis_collision");
    expect(quality.failures).toContain("micro_animation_visual_chaos");
    expect(quality.score).toBeLessThan(0.8);
  });

  it("flags semantic mismatch and monotony as explicit quality failures", () => {
    const quality = evaluateMicroAnimationSelections([
      selection("text-emphasis.sweep-highlight", {
        semanticRole: "support",
        parameters: {
          intensity: 0.9,
          durationMs: 300,
          delayMs: 0,
          anchor: "word",
          direction: "right",
        },
        startFrame: 0,
        endFrame: 10,
      }),
      selection("text-entry.word-riser", {
        family: "text_entry",
        role: "entry",
        combinationGroup: "entry",
        startFrame: 20,
        endFrame: 30,
      }),
      selection("text-entry.word-riser", {
        family: "text_entry",
        role: "entry",
        combinationGroup: "entry",
        startFrame: 40,
        endFrame: 50,
      }),
      selection("text-entry.word-riser", {
        family: "text_entry",
        role: "entry",
        combinationGroup: "entry",
        startFrame: 60,
        endFrame: 70,
      }),
      selection("text-entry.word-riser", {
        family: "text_entry",
        role: "entry",
        combinationGroup: "entry",
        startFrame: 80,
        endFrame: 90,
      }),
    ]);

    expect(quality.failures).toContain("micro_animation_semantic_mismatch");
    expect(quality.failures).toContain("micro_animation_monotony");
  });
});
