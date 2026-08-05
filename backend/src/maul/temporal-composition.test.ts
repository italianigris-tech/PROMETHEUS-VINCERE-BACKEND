import {describe, expect, it} from "vitest";

import {
  MIN_ANIMATION_READ_MS,
  MIN_COMPOSITION_HOLD_MS,
  MIN_HERO_HOLD_MS,
  MIN_VISIBLE_TEXT_MS,
  assertPerceptualDuration,
  mergeAdjacentCompositionHolds,
} from "./temporal-composition.js";

describe("MAUL temporal composition", () => {
  it("merges adjacent holds when geometry and typography are stable", () => {
    expect(mergeAdjacentCompositionHolds([
      {
        holdId: "hold_a",
        startMs: 0,
        endMs: 700,
        geometryKey: "right-upper",
        typographyProfileId: "editorial-display",
        purpose: "HOOK",
      },
      {
        holdId: "hold_b",
        startMs: 700,
        endMs: 1400,
        geometryKey: "right-upper",
        typographyProfileId: "editorial-display",
        purpose: "HOOK",
      },
    ])).toEqual([
      expect.objectContaining({startMs: 0, endMs: 1400}),
    ]);
  });

  it("rejects imperceptibly short visual states", () => {
    expect(() => assertPerceptualDuration(40, "composition_hold"))
      .toThrow(`${MIN_COMPOSITION_HOLD_MS}ms`);
    expect(() => assertPerceptualDuration(40, "visible_text"))
      .toThrow(`${MIN_VISIBLE_TEXT_MS}ms`);
    expect(() => assertPerceptualDuration(40, "animation"))
      .toThrow(`${MIN_ANIMATION_READ_MS}ms`);
    expect(() => assertPerceptualDuration(900, "hero_hold"))
      .toThrow(`${MIN_HERO_HOLD_MS}ms`);
  });
});
