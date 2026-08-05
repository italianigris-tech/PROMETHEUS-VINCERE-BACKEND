import {describe, expect, it} from "vitest";

import type {MaulUnifiedShortRenderManifest} from "@prometheus/shared-types";

import {
  evaluatePerceptualTruth,
  type MaulPerceptualPreview,
} from "./perceptual-truth.js";

const preview: MaulPerceptualPreview = {
  previewArtifactId: "preview_1",
  manifestReplayKey: "a".repeat(64),
  bytes: Buffer.from("actual-rendered-preview-bytes"),
  sha256: "b".repeat(64),
  width: 540,
  height: 960,
  durationMs: 1800,
  frameSamples: [
    {
      frameId: "frame_1",
      outputMs: 900,
      bytes: Buffer.from("actual-frame-pixels"),
      sha256: "c".repeat(64),
      contentType: "image/png",
    },
  ],
};

const fallbackManifest = {
  replayKey: "a".repeat(64),
  plans: {
    artDirection: {sceneEvidence: {status: "unavailable"}},
    textPlacement: {
      segments: [
        {
          fallbackCode: "caption_safe_fallback",
          minimumLegibilityPrimitive: {
            kind: "solid_plate",
            minimumOpacity: 0.78,
          },
        },
      ],
    },
  },
} as unknown as MaulUnifiedShortRenderManifest;

const sceneBackedManifest = {
  replayKey: "a".repeat(64),
  plans: {
    artDirection: {sceneEvidence: {status: "available"}},
    textPlacement: {
      segments: [
        {
          fallbackCode: null,
          minimumLegibilityPrimitive: {kind: "outline"},
        },
      ],
    },
  },
} as unknown as MaulUnifiedShortRenderManifest;

describe("Perceptual Truth", () => {
  it("blocks a generic safe-caption preview even when an evaluator incorrectly reports pass", () => {
    expect(
      evaluatePerceptualTruth({
        manifest: fallbackManifest,
        preview,
        providerResult: {
          status: "pass",
          failureLabels: [],
          evidenceIds: ["frame_1"],
          receipt: {
            authorityClass: "invoked_model",
            provider: "vision_critic",
            model: "vision-v1",
            inferenceReceiptId: "receipt_1",
          },
        },
      }),
    ).toMatchObject({
      status: "blocked",
      placementOutcome: "SAFE_CAPTION_FALLBACK",
      failureLabels: expect.arrayContaining([
        "GENERIC_BOTTOM_CAPTION",
        "EXCESSIVE_BLACK_PLATE",
      ]),
    });
  });

  it("refuses an art-directed outcome when rendered-frame evaluation is unavailable", () => {
    expect(
      evaluatePerceptualTruth({
        manifest: sceneBackedManifest,
        preview,
        providerResult: {
          status: "unavailable",
          failureLabels: [],
          evidenceIds: [],
          receipt: {
            authorityClass: "unavailable",
            provider: null,
            model: null,
            inferenceReceiptId: null,
          },
        },
      }),
    ).toMatchObject({
      status: "unavailable",
      placementOutcome: "VISUAL_EVIDENCE_UNAVAILABLE",
    });
  });

  it("permits an art-directed outcome only from scene-backed rendered-frame evidence", () => {
    expect(
      evaluatePerceptualTruth({
        manifest: sceneBackedManifest,
        preview,
        providerResult: {
          status: "pass",
          failureLabels: [],
          evidenceIds: ["frame_1"],
          receipt: {
            authorityClass: "invoked_model",
            provider: "vision_critic",
            model: "vision-v1",
            inferenceReceiptId: "receipt_1",
          },
        },
      }),
    ).toMatchObject({
      status: "pass",
      placementOutcome: "ART_DIRECTED",
      failureLabels: [],
    });
  });
});
