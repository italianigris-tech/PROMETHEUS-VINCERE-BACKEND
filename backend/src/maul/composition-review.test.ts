import {describe, expect, it} from "vitest";

import {
  buildPreferenceInferenceInput,
  createBlindedCompositionReviewPackage,
  recordReviewedCompositionEvidence,
} from "./composition-review.js";

const candidates = [
  {
    candidateId: "scene_a_baseline",
    declaredFingerprint: "a".repeat(64),
    observedFingerprint: "b".repeat(64),
    videoPath: "baseline.mp4",
    stillPaths: ["baseline-1.png"],
    mutationProvenance: null,
  },
  {
    candidateId: "scene_a_repair",
    declaredFingerprint: "c".repeat(64),
    observedFingerprint: "d".repeat(64),
    videoPath: "repair.mp4",
    stillPaths: ["repair-1.png"],
    mutationProvenance: {
      parentCandidateId: "scene_a_baseline",
      repairId: "repair_hierarchy_1",
      targetDimension: "semanticHierarchy",
    },
  },
] as const;

describe("blinded composition review", () => {
  it("creates a deterministic public A/B package with a separate private identity map", () => {
    const result = createBlindedCompositionReviewPackage({
      reviewPackageId: "review_scene_a_1",
      sourceGroup: "matted_lady_static_5951e646",
      sceneContext: {fixtureId: "scene_a_matted_lady_hierarchy_v1", phrase: "MAKE IDEAS MATTER"},
      candidates: [...candidates],
      reviewSeed: "hidden_seed_a",
    });
    const repeated = createBlindedCompositionReviewPackage({
      reviewPackageId: "review_scene_a_1",
      sourceGroup: "matted_lady_static_5951e646",
      sceneContext: {fixtureId: "scene_a_matted_lady_hierarchy_v1", phrase: "MAKE IDEAS MATTER"},
      candidates: [...candidates],
      reviewSeed: "hidden_seed_a",
    });

    expect(result).toEqual(repeated);
    expect(result.publicPackage.candidates.map((candidate) => candidate.label)).toEqual(["a", "b"]);
    expect(Object.keys(result.privateAssignment.candidateIdByLabel).sort()).toEqual(["a", "b"]);
    const publicJson = JSON.stringify(result.publicPackage);
    expect(publicJson).not.toContain("scene_a_baseline");
    expect(publicJson).not.toContain("scene_a_repair");
    expect(publicJson).not.toContain("hidden_seed_a");
    expect(publicJson).not.toMatch(/winnerCandidateId|verdict|groundTruth/i);
  });

  it("builds order-invariant inference features with no target labels", () => {
    const forward = createBlindedCompositionReviewPackage({
      reviewPackageId: "review_scene_a_1",
      sourceGroup: "matted_lady_static_5951e646",
      sceneContext: {fixtureId: "scene_a_matted_lady_hierarchy_v1", phrase: "MAKE IDEAS MATTER"},
      candidates: [...candidates],
      reviewSeed: "hidden_seed_b",
    });
    const reversed = createBlindedCompositionReviewPackage({
      reviewPackageId: "review_scene_a_1",
      sourceGroup: "matted_lady_static_5951e646",
      sceneContext: {fixtureId: "scene_a_matted_lady_hierarchy_v1", phrase: "MAKE IDEAS MATTER"},
      candidates: [...candidates].reverse(),
      reviewSeed: "hidden_seed_b",
    });

    const forwardInput = buildPreferenceInferenceInput(forward.publicPackage);
    const reversedInput = buildPreferenceInferenceInput(reversed.publicPackage);
    expect(forwardInput).toEqual(reversedInput);
    expect(JSON.stringify(forwardInput)).not.toMatch(
      /winner|verdict|choice|failureDimensions|mutationProvenance/i,
    );
  });

  it.each(["a", "b", "tie", "no_meaningful_preference"] as const)(
    "records %s without exposing the label during inference",
    (choice) => {
      const review = createBlindedCompositionReviewPackage({
        reviewPackageId: `review_${choice}`,
        sourceGroup: "matted_lady_static_5951e646",
        sceneContext: {fixtureId: "scene_a_matted_lady_hierarchy_v1", phrase: "MAKE IDEAS MATTER"},
        candidates: [...candidates],
        reviewSeed: "hidden_seed_c",
      });
      const evidence = recordReviewedCompositionEvidence({
        publicPackage: review.publicPackage,
        privateAssignment: review.privateAssignment,
        response: {
          choice,
          reviewerId: "human_reviewer_1",
          reviewerConfidence: 0.82,
          failureDimensions: {
            a: ["hierarchy"],
            b: [],
          },
          note: "Blinded same-scene comparison.",
          reviewedAt: "2026-08-07T08:00:00.000Z",
        },
      });

      expect(evidence.choice).toBe(choice);
      expect(evidence.chosenCandidateId).toBe(
        choice === "a" || choice === "b"
          ? review.privateAssignment.candidateIdByLabel[choice]
          : null,
      );
      expect(evidence.eligibility).toBe("experiment_only");
      expect(evidence.promotionEligible).toBe(false);
      expect(evidence.candidates).toHaveLength(2);
    },
  );
});
