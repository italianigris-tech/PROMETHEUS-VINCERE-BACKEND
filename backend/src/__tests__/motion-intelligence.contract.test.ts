import {describe, expect, it} from "vitest";

import {buildMotionIntelligencePlan} from "../motion-intelligence";

describe("motion intelligence contract", () => {
  it("keeps deterministic scene variation inside a shared continuity vector", () => {
    const shared = {
      transcript: "The old path was noisy. The new path is clear, fast, and easier to trust.",
      creatorProfile: "premium educator",
      motionProfileVersion: "motion-profile-v1"
    };

    const opening = buildMotionIntelligencePlan({
      ...shared,
      sceneMetadata: {
        sceneId: "scene-1",
        sceneType: "comparison",
        semanticIntent: "contrast before and after workflow quality"
      }
    });
    const proof = buildMotionIntelligencePlan({
      ...shared,
      sceneMetadata: {
        sceneId: "scene-2",
        sceneType: "stats",
        semanticIntent: "show measured reliability lift"
      }
    });
    const repeat = buildMotionIntelligencePlan({
      ...shared,
      sceneMetadata: {
        sceneId: "scene-1",
        sceneType: "comparison",
        semanticIntent: "contrast before and after workflow quality"
      }
    });

    expect(opening.seed).toBe(repeat.seed);
    expect(opening.continuityVector).toBe(proof.continuityVector);
    expect(opening.seed).not.toBe(proof.seed);
    expect(opening.motionProfile.clarity).toBeGreaterThanOrEqual(0.8);
    expect(proof.motionProfile.chaos).toBeLessThanOrEqual(0.2);
  });

  it("selects readable primitives with one transform owner and traceable decisions", () => {
    const plan = buildMotionIntelligencePlan({
      transcript: "Never trade readability for novelty when the viewer needs the number.",
      creatorProfile: "calm operator",
      motionProfileVersion: "motion-profile-v1",
      sceneMetadata: {
        sceneId: "stats-1",
        sceneType: "stats",
        semanticIntent: "explain a metric without visual noise",
        brandConstraints: ["high-readability", "low-chaos"]
      }
    });

    expect(plan.selectedPrimitives.length).toBeGreaterThan(0);
    expect(plan.selectedPrimitives.every((primitive) => primitive.readabilityCost <= 0.34)).toBe(true);
    expect(Object.keys(plan.transformOwnership).sort()).toEqual(["opacity", "scale", "x", "y"]);
    expect(new Set(Object.keys(plan.transformOwnership)).size).toBe(Object.keys(plan.transformOwnership).length);
    expect(plan.driverPlan.keyframePolicy).toBe("baked-parameters");
    expect(plan.driverPlan.rendererInterpolation).toBe("deterministic");
    expect(plan.traceLog).toContain("seed=");
    expect(plan.traceLog).toContain("chosen_primitives=");
    expect(plan.traceLog).toContain("rejected_primitives=");
    expect(plan.traceLog).toContain("ownership=");
    expect(plan.traceLog).toContain("mutation_parameters=");
  });
});
