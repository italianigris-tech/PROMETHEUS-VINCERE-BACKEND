import {describe, expect, it} from "vitest";

import {bakeFrameMap} from "../hyperframes/timeline.worker";

describe("Timeline Worker - Headless GSAP FrameMap", () => {
  it("returns a mathematically correct FrameMap with dual opacity layers", () => {
    const frameMap = bakeFrameMap({
      manifest: {
        hyperframes: [
          {
            id: "test-node-1",
            startX: 0,
            endX: 100,
            startY: 0,
            endY: 50,
            duration: 30,
            startTime: 0,
            ease: "power2.out",
            text: "Hello World"
          }
        ]
      },
      fps: 30,
      durationInFrames: 30
    });

    expect(frameMap[0]).toBeDefined();
    expect(frameMap[29]).toBeDefined();
    expect(frameMap[0][0].x).toBeCloseTo(0, 1);
    expect(frameMap[0][0].sharpOpacity).toBeCloseTo(0, 1);
    expect(frameMap[0][0].blurredOpacity).toBeCloseTo(1, 1);
    expect(frameMap[0][0].text).toBe("Hello World");
    expect(frameMap[29][0].x).toBeCloseTo(100, 1);
    expect(frameMap[29][0].sharpOpacity).toBeCloseTo(1, 1);
    expect(frameMap[29][0].blurredOpacity).toBeCloseTo(0, 1);
    expect(frameMap[15][0].x).toBeGreaterThan(70);
    expect(frameMap[15][0].x).toBeLessThan(95);
    expect(frameMap[15][0].sharpOpacity + frameMap[15][0].blurredOpacity).toBeCloseTo(1, 1);
  });
});
