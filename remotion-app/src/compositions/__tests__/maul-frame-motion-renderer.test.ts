import {describe, expect, it} from "vitest";

import {
  maulFrameMotionStyle,
  maulLetterStaggerFrame,
} from "../maul-frame-motion-renderer";

const settled = {
  opacity: 1,
  translateXPx: 0,
  translateYPx: 0,
  scale: 1,
  rotationDeg: 0,
  blurPx: 0,
  clipProgress: 1,
  trackingEm: 0,
};

describe("MAUL cinematic frame-motion renderer", () => {
  it("keeps frame motion free of undeclared visual treatments", () => {
    const style = maulFrameMotionStyle(settled, 0);
    expect(style.textShadow).toBeUndefined();
    expect(style.WebkitTextStroke).toBeUndefined();
    expect(style.backgroundColor).toBeUndefined();
    expect(style.borderRadius).toBeUndefined();
  });

  it("stages letter-source motion across a word instead of moving the whole word as one block", () => {
    expect([0, 1, 2, 3].map((index) => maulLetterStaggerFrame(20, index, 12))).toEqual([
      20, 19, 18, 17,
    ]);
    expect([0, 1, 2].map((index) => maulLetterStaggerFrame(20, index, 14))).toEqual([
      20, 17, 14,
    ]);
  });
});
