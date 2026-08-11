import {describe, expect, it} from "vitest";

import type {MaulMediaObservationResult} from "./mediapipe-observation.js";
import {
  createMediaObservationSceneEvidenceProvider,
  createRuntimeMediaObservationSceneEvidenceProvider,
} from "./media-observation-placement.js";
import {sceneEvidenceToPlacementInputs} from "./scene-evidence.js";

const grid = (luminance: number) => ({
  columns: 12 as const,
  rows: 20 as const,
  samples: Array(240).fill(luminance),
});

const observation = (): MaulMediaObservationResult => ({
  schemaVersion: "maul-media-observation/v1",
  sourceSha256: "a".repeat(64),
  detector: {
    providerId: "mediapipe_opencv",
    mediapipeVersion: "0.10.21",
    opencvVersion: "4.11.0",
    configurationSha256: "b".repeat(64),
  },
  frames: [0, 500, 1_000].map((sourceMs, index) => ({
    sourceMs,
    faceBox: {x: 0.46, y: 0.12, width: 0.08, height: 0.12},
    poseLandmarks: [
      {name: "nose", x: 0.5, y: 0.18, confidence: 0.98},
      {name: "left_shoulder", x: 0.43, y: 0.32, confidence: 0.96},
      {name: "right_shoulder", x: 0.57, y: 0.32, confidence: 0.96},
    ],
    subjectBox: {x: 0.38, y: 0.08, width: 0.24, height: 0.78},
    luminanceGrid: grid(0.05 + index * 0.01),
  })),
  missingSpans: [],
  receipt: {
    stage: "media_observation",
    startedAt: "2026-08-10T12:00:00.000Z",
    endedAt: "2026-08-10T12:00:00.100Z",
    durationMs: 100,
    cache: "miss",
    inputSha256: "c".repeat(64),
    outputSha256: "d".repeat(64),
    providerRequestId: null,
    bytesRead: 100,
    bytesWritten: 200,
    warnings: [],
    failure: null,
  },
});

describe("MAUL media observation placement bridge", () => {
  it("runs MediaPipe observations on demand instead of silently using unknown geometry", async () => {
    const requests: unknown[] = [];
    const provider = createRuntimeMediaObservationSceneEvidenceProvider({
      runObservation: async (request) => {
        requests.push(request);
        return observation();
      },
      sampleEveryFrames: 12,
      maximumInterpolationGapMs: 600,
    });

    const evidence = await provider.inspect({
      sourcePath: "/tmp/source.mp4",
      beats: [{beatId: "beat_hook", startMs: 0, endMs: 1_000, purpose: "HOOK"}],
      timestampMap: [{
        sourceStartMs: 0,
        sourceEndMs: 1_200,
        outputStartMs: 0,
        outputEndMs: 1_200,
        mode: "keep",
      }],
      speakerCropTracks: [],
    });

    expect(requests).toEqual([expect.objectContaining({
      sourcePath: "/tmp/source.mp4",
      durationMs: 1_200,
      outputWidth: 1_080,
      outputHeight: 1_920,
      sampleEveryFrames: 12,
    })]);
    expect(evidence.status).toBe("available");
    if (evidence.status !== "available") return;
    expect(evidence.holds.map((hold) => [hold.outputStartMs, hold.outputEndMs])).toEqual([
      [0, 1_000],
      [1_000, 1_200],
    ]);
  });

  it("maps real observation frames into clear and controlled-overlap opportunities", async () => {
    const provider = createMediaObservationSceneEvidenceProvider({
      observation: observation(),
      maximumInterpolationGapMs: 600,
    });

    const evidence = await provider.inspect({
      sourcePath: "/tmp/source.mp4",
      beats: [{beatId: "beat_hook", startMs: 0, endMs: 1_200, purpose: "HOOK"}],
      speakerCropTracks: [{
        speakerId: "speaker_primary",
        outputStartMs: 0,
        outputEndMs: 1_200,
        crop: {x: 0.25, y: 0, width: 0.5, height: 1},
      }],
    });

    expect(evidence).toMatchObject({
      status: "available",
      providerId: "mediapipe_opencv_scene_evidence",
      holds: [{
        beatId: "beat_hook",
        purpose: "HOOK",
        sourceCrop: {x: 0.25, y: 0, width: 0.5, height: 1},
        subject: {
          trackingState: "tracked",
          box: {x: 0.26, y: 0.08, width: 0.48, height: 0.78},
        },
        opportunities: expect.arrayContaining([
          expect.objectContaining({
            regionId: "media_observed_full_frame",
            overlapPolicy: "controlled_overlap",
          }),
          expect.objectContaining({
            overlapPolicy: "avoid_subject",
          }),
        ]),
      }],
    });
    const placementInputs = sceneEvidenceToPlacementInputs(evidence);
    expect(placementInputs?.observationIntervals[0]?.backgroundLuminanceGrids)
      .toHaveLength(3);
    expect(placementInputs?.compositionIntervals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        variantId: expect.stringContaining("media_observed_full_frame"),
        textAnchor: expect.objectContaining({
          subjectInteraction: expect.objectContaining({
            policy: "controlled_overlap",
          }),
        }),
      }),
    ]));
  });

  it("refuses to invent beat evidence beyond the bounded interpolation gap", async () => {
    const provider = createMediaObservationSceneEvidenceProvider({
      observation: observation(),
      maximumInterpolationGapMs: 250,
    });

    const evidence = await provider.inspect({
      sourcePath: "/tmp/source.mp4",
      beats: [{beatId: "beat_late", startMs: 5_000, endMs: 6_000, purpose: "PAYOFF"}],
    });

    expect(evidence).toMatchObject({
      status: "unavailable",
      providerId: "unavailable",
      reason: expect.stringMatching(/MediaPipe.*cover|cover.*MediaPipe/i),
    });
  });
});
