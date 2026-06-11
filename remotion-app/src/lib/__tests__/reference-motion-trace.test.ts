import {describe, expect, it} from "vitest";

import {
  buildReferenceMotionCssTransform,
  mixReferenceMotionIntoCssTransform,
  resolveReferenceMotionAtFrame
} from "../reference-motion-trace";
import type {ReferenceMotionTrace} from "../types";

const trace: ReferenceMotionTrace = {
  id: "ref-saas-hero",
  fps: 30,
  targetTraces: [
    {
      targetId: "asset-cta",
      samples: [
        {frame: 0, translateX: 0, translateY: 0, scale: 1, rotateDeg: 0, depth: 0, opacity: 1},
        {frame: 30, translateX: 90, translateY: -45, scale: 1.4, rotateDeg: 12, depth: 24, opacity: 0.5, blurPx: 6}
      ]
    }
  ]
};

describe("reference motion trace", () => {
  it("interpolates a target transform at a render frame", () => {
    const transform = resolveReferenceMotionAtFrame({
      trace,
      targetId: "asset-cta",
      frame: 15,
      fps: 30
    });

    expect(transform).toEqual({
      translateX: 45,
      translateY: -22.5,
      scale: 1.2,
      rotateDeg: 6,
      depth: 12,
      opacity: 0.75,
      blurPx: 3,
      velocityX: 90,
      velocityY: -45
    });
  });

  it("converts render fps into the trace fps before sampling", () => {
    const transform = resolveReferenceMotionAtFrame({
      trace,
      targetId: "asset-cta",
      frame: 30,
      fps: 60
    });

    expect(transform?.translateX).toBe(45);
  });

  it("clamps before the first and after the last trace sample", () => {
    expect(resolveReferenceMotionAtFrame({trace, targetId: "asset-cta", frame: -8, fps: 30})?.translateX).toBe(0);
    expect(resolveReferenceMotionAtFrame({trace, targetId: "asset-cta", frame: 60, fps: 30})?.translateX).toBe(90);
  });

  it("returns null when no target trace exists", () => {
    expect(resolveReferenceMotionAtFrame({trace, targetId: "missing", frame: 15, fps: 30})).toBeNull();
  });

  it("builds a deterministic CSS transform and can append it to an existing transform", () => {
    const transform = resolveReferenceMotionAtFrame({
      trace,
      targetId: "asset-cta",
      frame: 15,
      fps: 30
    });

    expect(buildReferenceMotionCssTransform(transform)).toBe(
      "translate3d(45.00px, -22.50px, 12.00px) scale(1.2000) rotate(6.000deg)"
    );
    expect(mixReferenceMotionIntoCssTransform("translate3d(-50%, -50%, 0)", transform)).toBe(
      "translate3d(-50%, -50%, 0) translate3d(45.00px, -22.50px, 12.00px) scale(1.2000) rotate(6.000deg)"
    );
  });
});
