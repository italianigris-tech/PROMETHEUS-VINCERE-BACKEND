import {describe, expect, it} from "vitest";

import {computeSvgMotionState, resolveSvgEffectFamily} from "../../components/SvgCaptionOverlay";
import {svgTypographyVariantsV1} from "../stylebooks/svg-typography-v1";

const getVariantByFamily = (family: string) => {
  const variant = svgTypographyVariantsV1.find((entry) => resolveSvgEffectFamily(entry) === family);
  if (!variant) {
    throw new Error(`No variant found for family "${family}"`);
  }
  return variant;
};

describe("svg overlay motion keyframes", () => {
  it("animates char-stagger family from hidden to visible to exit", () => {
    const variant = getVariantByFamily("char-stagger");
    const initial = computeSvgMotionState({
      variant,
      entryProgress: 0,
      exitProgress: 0,
      slotIndex: 0,
      charIndex: 0
    });
    const mid = computeSvgMotionState({
      variant,
      entryProgress: 1,
      exitProgress: 0,
      slotIndex: 0,
      charIndex: 0
    });
    const final = computeSvgMotionState({
      variant,
      entryProgress: 1,
      exitProgress: 1,
      slotIndex: 0,
      charIndex: 0
    });

    expect(initial.opacity).toBeLessThan(0.05);
    expect(initial.translateY).toBeGreaterThan(14);
    expect(mid.opacity).toBeGreaterThan(0.9);
    expect(mid.blur).toBeLessThan(0.2);
    expect(final.opacity).toBeLessThan(0.05);
  });

  it("animates split-impact family with horizontal split entry", () => {
    const variant = getVariantByFamily("split-impact");
    const initialLeft = computeSvgMotionState({
      variant,
      entryProgress: 0,
      exitProgress: 0,
      slotIndex: 1,
      charIndex: 0
    });
    const initialRight = computeSvgMotionState({
      variant,
      entryProgress: 0,
      exitProgress: 0,
      slotIndex: 2,
      charIndex: 0
    });
    const mid = computeSvgMotionState({
      variant,
      entryProgress: 0.7,
      exitProgress: 0,
      slotIndex: 1,
      charIndex: 0
    });
    const final = computeSvgMotionState({
      variant,
      entryProgress: 1,
      exitProgress: 1,
      slotIndex: 1,
      charIndex: 0
    });

    expect(initialLeft.translateX).toBeLessThan(0);
    expect(initialRight.translateX).toBeGreaterThan(0);
    expect(mid.scale).toBeGreaterThan(0.95);
    expect(final.opacity).toBeLessThan(0.05);
  });

  it("gives split-impact a sharp luxury overshoot at the hit point", () => {
    const variant = getVariantByFamily("split-impact");
    const impact = computeSvgMotionState({
      variant,
      entryProgress: 0.82,
      exitProgress: 0,
      slotIndex: 1,
      charIndex: 0
    });

    expect(impact.scale).toBeGreaterThan(1.045);
    expect(Math.abs(impact.translateX)).toBeLessThan(18);
    expect(impact.blur).toBeLessThan(1.2);
  });

  it("animates cursor-sweep family with progressive clip reveal", () => {
    const variant = getVariantByFamily("cursor-sweep");
    const early = computeSvgMotionState({
      variant,
      entryProgress: 0.2,
      exitProgress: 0,
      slotIndex: 0,
      charIndex: 0
    });
    const full = computeSvgMotionState({
      variant,
      entryProgress: 1,
      exitProgress: 0,
      slotIndex: 0,
      charIndex: 0
    });
    const exited = computeSvgMotionState({
      variant,
      entryProgress: 1,
      exitProgress: 1,
      slotIndex: 0,
      charIndex: 0
    });

    expect(early.clipProgress).toBeLessThan(1);
    expect(full.clipProgress).toBeGreaterThan(0.95);
    expect(exited.opacity).toBeLessThan(0.05);
  });
});
