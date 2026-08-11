import {MAUL_FRAME_MOTION_CAPABILITIES} from "./frame-motion-compiler.js";
import {describe, expect, it} from "vitest";
import {
  routeMaulWordMotion,
  wordMotionCandidatesFor,
} from "./word-motion-router.js";

describe("MAUL word motion router", () => {
  it("routes every executable animation capability to at least one semantic word role", () => {
    const routed = new Set([
      ...wordMotionCandidatesFor({emphasisLevel: "support", isEmphasized: false}),
      ...wordMotionCandidatesFor({emphasisLevel: "key", isEmphasized: true}),
      ...wordMotionCandidatesFor({emphasisLevel: "hero", isEmphasized: true}),
    ]);

    expect(routed).toEqual(
      new Set(MAUL_FRAME_MOTION_CAPABILITIES.map((capability) => capability.treatmentId)),
    );
  });

  it("gives the semantic key its own high-tier treatment without repeating its neighbor", () => {
    const supporting = routeMaulWordMotion({
      seed: "the-point-is:the",
      emphasisLevel: "key",
      isEmphasized: false,
      previousTreatment: null,
      previousFamily: null,
      usedTreatments: new Set(),
    });
    const key = routeMaulWordMotion({
      seed: "the-point-is:point",
      emphasisLevel: "key",
      isEmphasized: true,
      previousTreatment: supporting.treatmentId,
      previousFamily: supporting.family,
      usedTreatments: new Set([supporting.treatmentId]),
    });

    expect(key.treatmentId).not.toBe(supporting.treatmentId);
    expect(key.family).not.toBe(supporting.family);
    expect(key.tier).toBe("cinematic_emphasis");
  });

  it("is replayable for one seed but varies across source seeds", () => {
    const select = (seed: string) => routeMaulWordMotion({
      seed,
      emphasisLevel: "support",
      isEmphasized: false,
      previousTreatment: null,
      previousFamily: null,
      usedTreatments: new Set(),
    }).treatmentId;

    expect(select("source-a:word-1")).toBe(select("source-a:word-1"));
    expect(new Set(["source-a", "source-b", "source-c", "source-d"].map(select)).size)
      .toBeGreaterThan(1);
  });
});
