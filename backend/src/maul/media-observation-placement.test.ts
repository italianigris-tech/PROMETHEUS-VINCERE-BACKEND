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
        faceBox: {x: 0.42, y: 0.12, width: 0.16, height: 0.12},
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
    expect(placementInputs?.observationIntervals[0]?.faceBox).toEqual(
      {x: 0.42, y: 0.12, width: 0.16, height: 0.12},
    );
    expect(placementInputs?.observationIntervals[0]?.backgroundLuminanceGrids)
      .toHaveLength(3);
    expect(placementInputs?.observationIntervals[0]?.backgroundLuminanceSamples)
      .toEqual([
        expect.objectContaining({outputMs: 0}),
        expect.objectContaining({outputMs: 500}),
        expect.objectContaining({outputMs: 1_000}),
      ]);
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

  it("emits a face-safe top opportunity for a portrait subject that fills the frame width", async () => {
    const portraitObservation: MaulMediaObservationResult = {
      ...observation(),
      frames: observation().frames.map((frame) => ({
        ...frame,
        faceBox: {x: 0.36, y: 0.28, width: 0.28, height: 0.16},
        subjectBox: {x: 0.07, y: 0.24, width: 0.86, height: 0.76},
      })),
    };
    const provider = createMediaObservationSceneEvidenceProvider({
      observation: portraitObservation,
      maximumInterpolationGapMs: 600,
    });

    const evidence = await provider.inspect({
      sourcePath: "/tmp/portrait.mp4",
      beats: [{beatId: "beat_hook", startMs: 0, endMs: 1_000, purpose: "HOOK"}],
    });

    expect(evidence.status).toBe("available");
    if (evidence.status !== "available") return;
    const clearTop = evidence.holds[0]?.opportunities.find(
      (candidate) => candidate.regionId === "media_observed_clear_top",
    );
    expect(clearTop).toMatchObject({
      overlapPolicy: "avoid_subject",
      faceInterference: 0,
    });
    expect(clearTop!.box.y + clearTop!.box.height).toBeLessThanOrEqual(0.24);
  });

  it("linearly interpolates subject and face boxes at an uncovered beat midpoint", async () => {
    const sparse = observation();
    sparse.frames = [
      {
        ...sparse.frames[0]!,
        sourceMs: 0,
        subjectBox: {x: 0.1, y: 0.1, width: 0.2, height: 0.6},
        faceBox: {x: 0.15, y: 0.12, width: 0.1, height: 0.12},
      },
      {
        ...sparse.frames[2]!,
        sourceMs: 1_000,
        subjectBox: {x: 0.5, y: 0.2, width: 0.3, height: 0.7},
        faceBox: {x: 0.6, y: 0.22, width: 0.12, height: 0.14},
      },
    ];
    const provider = createMediaObservationSceneEvidenceProvider({
      observation: sparse,
      maximumInterpolationGapMs: 600,
    });

    const evidence = await provider.inspect({
      sourcePath: "/tmp/source.mp4",
      beats: [{beatId: "beat_midpoint", startMs: 400, endMs: 600, purpose: "PAYOFF"}],
    });

    expect(evidence.status).toBe("available");
    if (evidence.status !== "available") return;
    expect(evidence.holds[0]).toMatchObject({
      sourceSampleMs: 500,
      subject: {
        trackingState: "held",
        box: {x: 0.3, y: 0.15, width: 0.25, height: 0.65},
      },
      faceBox: {x: 0.375, y: 0.17, width: 0.11, height: 0.13},
    });
    expect(evidence.holds[0]!.sourceFrameIds).toHaveLength(2);
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
