import {describe, expect, it} from "vitest";

import {
  evaluateMaulFrameMotion,
  maulFrameMotionProgramSchema,
} from "./maul-frame-motion.js";

const identity = {
  opacity: 1,
  translateXPx: 0,
  translateYPx: 0,
  scale: 1,
  rotationDeg: 0,
  blurPx: 0,
  clipProgress: 1,
  trackingEm: 0,
} as const;

const program = {
  schemaVersion: "maul-frame-motion/v1",
  executorId: "gsap:generic_single_word",
  sourceTreatment: "generic_single_word",
  unit: "word",
  tokenId: "token_a",
  placementSegmentId: "segment_a",
  fps: 30,
  sourceIntervalMs: {startMs: 0, endMs: 1_000},
  phases: {
    entry: {
      startFrame: 0,
      endFrame: 6,
      easing: {type: "linear"},
      from: {...identity, opacity: 0, translateYPx: 30, blurPx: 8},
      to: identity,
    },
    hold: {
      startFrame: 6,
      endFrame: 24,
      easing: {type: "linear"},
      from: identity,
      to: identity,
    },
    exit: {
      startFrame: 24,
      endFrame: 30,
      easing: {type: "linear"},
      from: identity,
      to: {...identity, opacity: 0, translateYPx: -12},
    },
  },
  envelope: {
    maxTranslateXPx: 0,
    maxTranslateYPx: 30,
    maxScale: 1,
    maxBlurPx: 8,
  },
} as const;

describe("MAUL frame motion contract", () => {
  it("accepts a bounded, continuous word program", () => {
    expect(maulFrameMotionProgramSchema.parse(program)).toEqual(program);
  });

  it("evaluates entry, hold, and exit from the output frame", () => {
    expect(evaluateMaulFrameMotion(program, 0)).toMatchObject({
      opacity: 0,
      translateYPx: 30,
      blurPx: 8,
    });
    expect(evaluateMaulFrameMotion(program, 15)).toEqual(identity);
    expect(evaluateMaulFrameMotion(program, 30)).toMatchObject({
      opacity: 0,
      translateYPx: -12,
    });
  });

  it("rejects zero-length phases and out-of-range transforms", () => {
    expect(() => maulFrameMotionProgramSchema.parse({
      ...program,
      phases: {
        ...program.phases,
        hold: {...program.phases.hold, endFrame: program.phases.hold.startFrame},
      },
    })).toThrow(/positive|endFrame|phase/i);

    expect(() => maulFrameMotionProgramSchema.parse({
      ...program,
      phases: {
        ...program.phases,
        entry: {
          ...program.phases.entry,
          from: {...program.phases.entry.from, scale: 2.1},
        },
      },
    })).toThrow();
  });
});
