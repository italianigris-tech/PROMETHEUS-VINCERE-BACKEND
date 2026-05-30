import {describe, expect, it} from "vitest";

import {__svgTypographyLayoutTestUtils, computeSvgMotionState, resolveSvgEffectFamily} from "../../components/SvgCaptionOverlay";
import {svgTypographyVariantsV1} from "../stylebooks/svg-typography-v1";

describe("svg preset program checkpoints", () => {
  it("moves every preset family from hidden/blurred to visible and out", () => {
    svgTypographyVariantsV1.forEach((variant) => {
      const family = resolveSvgEffectFamily(variant);
      const start = computeSvgMotionState({
        variant,
        entryProgress: 0,
        exitProgress: 0,
        slotIndex: 0,
        charIndex: 0
      });
      const mid = computeSvgMotionState({
        variant,
        entryProgress: 0.8,
        exitProgress: 0,
        slotIndex: 0,
        charIndex: 0
      });
      const end = computeSvgMotionState({
        variant,
        entryProgress: 1,
        exitProgress: 1,
        slotIndex: 0,
        charIndex: 0
      });

      expect(mid.opacity).toBeGreaterThanOrEqual(start.opacity);
      expect(mid.blur).toBeLessThanOrEqual(start.blur + 0.001);
      expect(end.opacity).toBeLessThanOrEqual(0.1);

      if (family === "cursor-sweep") {
        expect(mid.clipProgress).toBeGreaterThan(start.clipProgress);
      }
    });
  });

  it("keeps split-impact side polarity aligned to left/right slots", () => {
    const variant = svgTypographyVariantsV1.find((entry) => entry.id === "cinematic_text_preset_5");
    if (!variant) {
      throw new Error("split-impact variant missing");
    }

    const left = computeSvgMotionState({
      variant,
      entryProgress: 0,
      exitProgress: 0,
      slotIndex: 1,
      charIndex: 0
    });
    const right = computeSvgMotionState({
      variant,
      entryProgress: 0,
      exitProgress: 0,
      slotIndex: 2,
      charIndex: 0
    });

    expect(left.translateX).toBeLessThan(0);
    expect(right.translateX).toBeGreaterThan(0);
  });
});

describe("svg layout fit guard", () => {
  it("enforces min-scale floor for long words", () => {
    const result = __svgTypographyLayoutTestUtils.measureWord(
      "SUPERCALIFRAGILISTICEXPIALIDOCIOUS",
      260,
      280,
      0.35,
      {family: "'Bebas Neue', sans-serif", weight: "400"}
    );

    expect(result.fontSize).toBeGreaterThanOrEqual(260 * 0.35);
    expect(result.width).toBeGreaterThan(0);
  });

  it("keeps base sizing for short words", () => {
    const result = __svgTypographyLayoutTestUtils.measureWord("GO", 260, 700, 0.35, {
      family: "'Bebas Neue', sans-serif",
      weight: "400"
    });

    expect(result.fontSize).toBe(260);
  });

  it("keeps the three-word hierarchy preset vertically separated", () => {
    const layout = __svgTypographyLayoutTestUtils.measureHierarchyLayout({
      scriptText: "see",
      primaryText: "yourself",
      secondaryText: "as"
    });

    const scriptGap = (layout.primaryY - layout.primary.fontSize * 0.84) - (layout.scriptY + layout.script.fontSize * 0.22);
    const secondaryGap = (layout.secondaryY - layout.secondary.fontSize * 0.84) - (layout.primaryY + layout.primary.fontSize * 0.22);

    expect(scriptGap).toBeGreaterThanOrEqual(24);
    expect(secondaryGap).toBeGreaterThanOrEqual(24);
    expect(Math.abs(scriptGap - secondaryGap)).toBeLessThanOrEqual(8);
  });

  it("makes the three-word hierarchy preset visually dominated by the Playfair primary word", () => {
    const layout = __svgTypographyLayoutTestUtils.measureHierarchyLayout({
      scriptText: "feel",
      primaryText: "impact",
      secondaryText: "now"
    });

    expect(layout.primary.fontSize / layout.script.fontSize).toBeGreaterThanOrEqual(2.75);
    expect(layout.primary.fontSize / layout.secondary.fontSize).toBeGreaterThanOrEqual(5);
    expect(layout.scriptX).toBeLessThan(layout.primaryX);
  });
});
