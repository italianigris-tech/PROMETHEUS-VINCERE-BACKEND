import {describe, expect, it} from "vitest";

import {evaluateEliteGenericFeatureValidation} from "./feature-validation";

const eliteVector = (id: number) => ({
  referenceId: `elite_${id}`,
  qualityTier: "elite" as const,
  features: {
    "camera.shot_change_count": 3 + (id % 2),
    "audio.music_presence": true,
    "typography.font_weight": "bold",
    "temporal.position_in_video": "body"
  }
});

const genericVector = (id: number) => ({
  referenceId: `generic_${id}`,
  qualityTier: "generic" as const,
  features: {
    "camera.shot_change_count": id % 2,
    "audio.music_presence": false,
    "typography.font_weight": "regular",
    "temporal.position_in_video": "body"
  }
});

describe("elite/generic feature validation", () => {
  it("blocks the gate until at least five elite and five generic vectors are present", () => {
    const report = evaluateEliteGenericFeatureValidation({
      vectors: [eliteVector(1), eliteVector(2), genericVector(1), genericVector(2)]
    });

    expect(report.satisfied).toBe(false);
    expect(report.counts).toEqual({elite: 2, generic: 2});
    expect(report.blockReasons).toContain("requires_at_least_5_elite_vectors");
    expect(report.blockReasons).toContain("requires_at_least_5_generic_vectors");
  });

  it("identifies separating craft features and unresolved noisy features", () => {
    const vectors = [
      ...Array.from({length: 5}, (_, index) => eliteVector(index)),
      ...Array.from({length: 5}, (_, index) => genericVector(index))
    ];

    const report = evaluateEliteGenericFeatureValidation({vectors});

    expect(report.satisfied).toBe(false);
    expect(report.separatingFeatures.map((feature) => feature.featureName)).toEqual([
      "audio.music_presence",
      "camera.shot_change_count",
      "typography.font_weight"
    ]);
    expect(report.noisyFeatures.map((feature) => feature.featureName)).toEqual([
      "temporal.position_in_video"
    ]);
    expect(report.unresolvedFailingFeatures).toEqual(["temporal.position_in_video"]);
    expect(report.blockReasons).toContain("unresolved_noisy_features");
  });

  it("satisfies validation only after noisy features have remove-or-revise actions", () => {
    const vectors = [
      ...Array.from({length: 5}, (_, index) => eliteVector(index)),
      ...Array.from({length: 5}, (_, index) => genericVector(index))
    ];

    const report = evaluateEliteGenericFeatureValidation({
      vectors,
      featureActions: {
        "temporal.position_in_video": {
          action: "revised",
          reason: "Keep temporal role, but derive it from narrative beats instead of raw position."
        }
      }
    });

    expect(report.satisfied).toBe(true);
    expect(report.blockReasons).toEqual([]);
    expect(report.resolvedFailingFeatures).toEqual([
      {
        featureName: "temporal.position_in_video",
        action: "revised",
        reason: "Keep temporal role, but derive it from narrative beats instead of raw position."
      }
    ]);
  });
});
