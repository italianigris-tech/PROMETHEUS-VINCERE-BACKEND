import {describe, expect, it} from "vitest";

import {
  createUnavailableSceneEvidenceProvider,
  sceneEvidenceToPlacementInputs,
} from "./scene-evidence.js";

describe("MAUL scene evidence", () => {
  it("does not synthesize source-pixel placement when visual evidence is unavailable", async () => {
    const evidence = await createUnavailableSceneEvidenceProvider(
      "vision provider is not configured",
    ).inspect({
      sourcePath: "source.mp4",
      beats: [{beatId: "beat_hook", startMs: 0, endMs: 1_000, purpose: "HOOK"}],
    });

    expect(evidence).toMatchObject({
      status: "unavailable",
      providerId: "unavailable",
      reason: "vision provider is not configured",
    });
    expect(sceneEvidenceToPlacementInputs(evidence)).toBeNull();
  });

  it("derives source-pixel placement inputs only from measured scene opportunities", () => {
    const inputs = sceneEvidenceToPlacementInputs({
      status: "available",
      providerId: "fixture-vision",
      providerVersion: "1",
      holds: [
        {
          beatId: "beat_hook",
          sceneId: "scene_1",
          discontinuityId: "cut_1",
          outputStartMs: 0,
          outputEndMs: 1_200,
          sourceFrameIds: ["frame_0001", "frame_0018"],
          subject: {
            trackingState: "tracked",
            box: {x: 0.08, y: 0.12, width: 0.3, height: 0.64},
          },
          existingTextRegions: [],
          opportunities: [
            {
              regionId: "negative_space_right",
              box: {x: 0.58, y: 0.2, width: 0.32, height: 0.28},
              negativeSpace: 0.95,
              readability: 0.91,
              clutter: 0.08,
              faceInterference: 0,
              temporalStability: 0.94,
            },
          ],
        },
      ],
    });

    expect(inputs).toMatchObject({
      observationIntervals: [
        expect.objectContaining({
          trackingState: "tracked",
          cutEvidenceStatus: "known",
        }),
      ],
      compositionIntervals: expect.arrayContaining([
        expect.objectContaining({
          variantId: "scene_evidence.editorial_asymmetry.negative_space_right",
          paddedNonSourceRegions: [],
        }),
      ]),
    });
    expect(inputs?.compositionIntervals.map((interval) => interval.variantId)).toEqual([
      "scene_evidence.editorial_asymmetry.negative_space_right",
      "scene_evidence.poster_hero.negative_space_right",
      "scene_evidence.subject_integrated.negative_space_right",
      "scene_evidence.restrained_minimal.negative_space_right",
    ]);
  });
});
