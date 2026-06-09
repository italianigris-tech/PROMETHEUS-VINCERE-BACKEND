import {describe, expect, it} from "vitest";

import {
  KINETIC_TEXT_MEASUREMENT_TIMEOUT_MS,
  buildWordLayout,
  chunkTextByColorRanges,
  splitMotionTweenVars
} from "./KineticText.js";

describe("splitMotionTweenVars", () => {
  it("routes opacity, scale, rotation, and position vars to real Three.js targets", () => {
    expect(splitMotionTweenVars({
      opacity: 0.4,
      scale: 2,
      rotation: 180,
      x: "random(-100, 100)",
      y: 12,
      z: -4,
      duration: 0.3,
      ease: "circ.out",
      ignored: true
    })).toEqual({
      common: {duration: 0.3, ease: "circ.out"},
      position: {x: "random(-100, 100)", y: 12, z: -4},
      material: {opacity: 0.4},
      scale: {x: 2, y: 2, z: 2},
      rotation: {z: Math.PI}
    });
  });

  it("keeps the Troika measurement refinement bounded for Remotion renders", () => {
    expect(KINETIC_TEXT_MEASUREMENT_TIMEOUT_MS).toBeGreaterThan(0);
    expect(KINETIC_TEXT_MEASUREMENT_TIMEOUT_MS).toBeLessThan(28000);
  });
});

describe("buildWordLayout", () => {
  it("creates a centered fallback layout without waiting for Troika measurements", () => {
    const layout = buildWordLayout([
      {
        text: "REGENERATE",
        colorRanges: [],
        startMs: 0,
        endMs: 1000,
        animated: false
      }
    ], 1);

    expect(layout).toHaveLength(1);
    expect(layout[0]?.text).toBe("REGENERATE");
    expect(layout[0]?.x).toBeCloseTo(0);
    expect(layout[0]?.width).toBeGreaterThan(0);
  });

  it("uses measured widths when they are available", () => {
    const layout = buildWordLayout([
      {
        text: "ONE",
        colorRanges: [],
        startMs: 0,
        endMs: 500,
        animated: true
      },
      {
        text: "TWO",
        colorRanges: [],
        startMs: 500,
        endMs: 1000,
        animated: true
      }
    ], 1, [4, 2]);

    expect(layout.map((word) => word.width)).toEqual([4, 2]);
    expect(layout[0]?.x).toBeLessThan(0);
    expect(layout[1]?.x).toBeGreaterThan(0);
  });
});

describe("chunkTextByColorRanges", () => {
  it("preserves readable text while splitting color-tagged ranges for canvas rendering", () => {
    expect(chunkTextByColorRanges("BOLDRED", [
      {start: 4, end: 7, color: "#ff0000"}
    ], "#ffffff")).toEqual([
      {text: "BOLD", color: "#ffffff"},
      {text: "RED", color: "#ff0000"}
    ]);
  });

  it("returns one fallback-colored chunk when no ranges are present", () => {
    expect(chunkTextByColorRanges("REGENERATE", [], "#f8fbff")).toEqual([
      {text: "REGENERATE", color: "#f8fbff"}
    ]);
  });
});
