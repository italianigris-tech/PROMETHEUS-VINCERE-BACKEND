import {describe, expect, it, vi} from "vitest";

import {
  buildSpeakerTrackSceneEvidence,
  createSpeakerTrackSceneEvidenceProvider,
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
          sourceCrop: {x: 0, y: 0, width: 1, height: 1},
          subject: {
            trackingState: "tracked",
            box: {x: 0.08, y: 0.12, width: 0.3, height: 0.64},
          },
          backgroundLuminanceGrid: {
            columns: 2,
            rows: 2,
            samples: [0.04, 0.08, 0.12, 0.16],
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
              overlapPolicy: "controlled_overlap",
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
          backgroundLuminanceGrid: {
            columns: 2,
            rows: 2,
            samples: [0.04, 0.08, 0.12, 0.16],
          },
        }),
      ],
      compositionIntervals: expect.arrayContaining([
        expect.objectContaining({
          variantId: "scene_evidence.editorial_asymmetry.negative_space_right",
          paddedNonSourceRegions: [],
          textAnchor: expect.objectContaining({
            subjectInteraction: {
              policy: "controlled_overlap",
              faceInterference: 0,
              evidenceIds: ["frame_0001", "frame_0018"],
            },
          }),
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

  it("maps authoritative speaker samples into the portrait crop and preserves that crop", () => {
    const crop = {x: 0.2, y: 0, width: 0.5, height: 1};
    const evidence = buildSpeakerTrackSceneEvidence({
      sourcePath: "source.mp4",
      beats: [{beatId: "beat_hook", startMs: 0, endMs: 500, purpose: "HOOK"}],
      speakerTracks: [
        {
          speakerId: "speaker_primary",
          samples: [
            {
              sourceMs: 1_250,
              x: 0.25,
              y: 0.1,
              width: 0.1,
              height: 0.4,
              confidence: 0.94,
            },
          ],
        },
      ],
      timestampMap: [
        {
          sourceStartMs: 1_000,
          sourceEndMs: 2_000,
          outputStartMs: 0,
          outputEndMs: 1_000,
          mode: "keep",
        },
      ],
      speakerCropTracks: [
        {
          speakerId: "speaker_primary",
          outputStartMs: 0,
          outputEndMs: 1_000,
          crop,
        },
      ],
    });

    expect(evidence).toMatchObject({
      status: "available",
      providerId: "maul_speaker_track_geometry",
      holds: [
        {
          beatId: "beat_hook",
          sourceCrop: crop,
          subject: {
            trackingState: "tracked",
            box: {x: 0.1, y: 0.1, width: 0.2, height: 0.4},
          },
          opportunities: [
            expect.objectContaining({regionId: "speaker_clear_right"}),
          ],
        },
      ],
    });

    if (evidence.status !== "available") {
      throw new Error("Expected mapped speaker-track evidence.");
    }
    const subject = evidence.holds[0]!.subject.box!;
    const opportunity = evidence.holds[0]!.opportunities[0]!.box;
    expect(opportunity.x).toBeGreaterThanOrEqual(subject.x + subject.width);

    const placement = sceneEvidenceToPlacementInputs(
      evidence,
      "subject_integrated",
    );
    expect(placement?.compositionIntervals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variantId:
            "scene_evidence.subject_integrated.speaker_clear_right.creative_preferred",
          crop,
        }),
      ]),
    );
  });

  it("attaches sampled source-frame luminance to tracked scene evidence", async () => {
    const crop = {x: 0.2, y: 0, width: 0.5, height: 1};
    const sampledGrid = {
      columns: 2,
      rows: 2,
      samples: [0.03, 0.04, 0.05, 0.06],
    };
    const sampleBackgroundLuminance = vi.fn(async () => sampledGrid);
    const provider = createSpeakerTrackSceneEvidenceProvider({
      sampleBackgroundLuminance,
    });
    const evidence = await provider.inspect({
      sourcePath: "/tmp/source.mp4",
      beats: [{beatId: "beat_hook", startMs: 0, endMs: 500, purpose: "HOOK"}],
      speakerTracks: [{
        speakerId: "speaker_primary",
        samples: [{
          sourceMs: 1_250,
          x: 0.25,
          y: 0.1,
          width: 0.1,
          height: 0.4,
          confidence: 0.94,
        }],
      }],
      timestampMap: [{
        sourceStartMs: 1_000,
        sourceEndMs: 2_000,
        outputStartMs: 0,
        outputEndMs: 1_000,
        mode: "keep",
      }],
      speakerCropTracks: [{
        speakerId: "speaker_primary",
        outputStartMs: 0,
        outputEndMs: 1_000,
        crop,
      }],
    });

    expect(sampleBackgroundLuminance).toHaveBeenCalledWith({
      sourcePath: "/tmp/source.mp4",
      sourceMs: 1_250,
      sourceCrop: crop,
    });
    expect(evidence).toMatchObject({
      status: "available",
      holds: [{backgroundLuminanceGrid: sampledGrid}],
    });
  });

  it("refuses to invent scene evidence when no speaker sample maps into a beat", () => {
    const evidence = buildSpeakerTrackSceneEvidence({
      sourcePath: "source.mp4",
      beats: [{beatId: "beat_hook", startMs: 0, endMs: 500, purpose: "HOOK"}],
      speakerTracks: [],
      timestampMap: [
        {
          sourceStartMs: 1_000,
          sourceEndMs: 2_000,
          outputStartMs: 0,
          outputEndMs: 1_000,
          mode: "keep",
        },
      ],
      speakerCropTracks: [
        {
          speakerId: "principal_unknown",
          outputStartMs: 0,
          outputEndMs: 1_000,
          crop: {x: 0.25, y: 0, width: 0.5, height: 1},
        },
      ],
    });

    expect(evidence).toMatchObject({
      status: "unavailable",
      providerId: "unavailable",
    });
  });

  it("falls back when speaker geometry does not cover every visual beat", () => {
    const evidence = buildSpeakerTrackSceneEvidence({
      sourcePath: "source.mp4",
      beats: [
        {beatId: "beat_hook", startMs: 0, endMs: 500, purpose: "HOOK"},
        {beatId: "beat_payoff", startMs: 500, endMs: 1_000, purpose: "PAYOFF"},
      ],
      speakerTracks: [
        {
          speakerId: "speaker_primary",
          samples: [
            {
              sourceMs: 1_250,
              x: 0.25,
              y: 0.1,
              width: 0.1,
              height: 0.4,
              confidence: 0.94,
            },
          ],
        },
      ],
      timestampMap: [
        {
          sourceStartMs: 1_000,
          sourceEndMs: 2_000,
          outputStartMs: 0,
          outputEndMs: 1_000,
          mode: "keep",
        },
      ],
      speakerCropTracks: [
        {
          speakerId: "speaker_primary",
          outputStartMs: 0,
          outputEndMs: 1_000,
          crop: {x: 0.2, y: 0, width: 0.5, height: 1},
        },
      ],
    });

    expect(evidence.status).toBe("unavailable");
  });
});
