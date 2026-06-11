import {describe, expect, it} from "vitest";

import {
  REFERENCE_MOTION_PATTERNS,
  composePatternTimeline,
  getMotionPattern,
  selectPatternForTechnique
} from "./pattern-library.js";

describe("reference motion pattern library", () => {
  it("covers the core reference-video techniques with render metadata", () => {
    const ids = Object.keys(REFERENCE_MOTION_PATTERNS);

    expect(ids).toEqual(expect.arrayContaining([
      "word-explosion",
      "word-morph",
      "word-carousel",
      "per-word-choreography",
      "typing-cursor",
      "orbital-carousel",
      "spiral-fan",
      "stacked-pills",
      "cursor-follow",
      "logo-pulse"
    ]));

    for (const pattern of Object.values(REFERENCE_MOTION_PATTERNS)) {
      expect(pattern.entranceDuration).toBeGreaterThan(0);
      expect(pattern.holdDuration).toBeGreaterThanOrEqual(0);
      expect(pattern.exitDuration).toBeGreaterThan(0);
      expect(pattern.renderCost.relative).toBeGreaterThan(0);
      expect(pattern.timelineFactory).toBeTypeOf("function");
    }
  });

  it("builds deterministic staggered timeline segments for word explosion", () => {
    const pattern = getMotionPattern("word-explosion");
    const first = composePatternTimeline(pattern, {itemIndex: 0, itemCount: 4});
    const second = composePatternTimeline(pattern, {itemIndex: 2, itemCount: 4});

    expect(first[0]?.at).toBe(0);
    expect(second[0]?.at).toBeGreaterThan(first[0]?.at ?? 0);
    expect(first.map((segment) => segment.phase)).toEqual(["entrance", "hold", "exit"]);
    expect(pattern.deformation.type).toBe("shatter");
    expect(pattern.postProcess.motionBlur).toBe(true);
  });

  it("selects patterns by technique aliases without introducing random choice", () => {
    expect(selectPatternForTechnique("3D card spiral gallery")?.id).toBe("spiral-fan");
    expect(selectPatternForTechnique("typing cursor animation")?.id).toBe("typing-cursor");
    expect(selectPatternForTechnique("unknown technique")).toBeNull();
  });
});
