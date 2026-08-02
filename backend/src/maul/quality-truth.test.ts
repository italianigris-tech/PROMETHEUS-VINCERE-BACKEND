import {describe, expect, it} from "vitest";

import type {
  MaulQualityTruthProof,
  MaulUnifiedShortRenderManifest,
} from "@prometheus/shared-types";

import {evaluateMaulQualityTruth} from "./quality-truth.js";

const replayKey = "a".repeat(64);

const manifest = {
  replayKey,
  output: {width: 1080, height: 1920, fps: 30, codec: "h264"},
  captions: [
    {
      text: "The claim matters.",
      startMs: 0,
      endMs: 1000,
      timestampMs: 0,
      confidence: 0.99,
    },
  ],
  timeline: {
    outputDurationMs: 4000,
    speakerCropTracks: [
      {
        speakerId: "speaker",
        outputStartMs: 0,
        outputEndMs: 4000,
        crop: {x: 0.2, y: 0, width: 0.6, height: 1},
      },
    ],
  },
  plans: {
    adapterDecision: {
      safeRegion: {topPx: 120, rightPx: 72, bottomPx: 330, leftPx: 72},
    },
    typographyMotion: {
      fontResolution: {
        selectedFamily: "Prometheus Test Sans",
        selectedAssetId: "font_asset_test_sans",
        status: "eligible_loaded",
      },
      motionPrograms: [
        {capabilityId: "maul_caption_page_spring"},
      ],
    },
    capabilitySelection: {
      selections: [
        {capabilityId: "maul_source_timestamp_mapping", selected: true},
        {capabilityId: "maul_caption_page_spring", selected: true},
      ],
    },
  },
  planExecution: [
    {
      planArtifactId: "artifact_audio_plan",
      planType: "dialogue_audio_plan",
      executionStatus: "governed_fallback",
      nativeBranch: null,
      fallback: "Static dialogue-first mix.",
    },
  ],
} as unknown as MaulUnifiedShortRenderManifest;

const validProof: MaulQualityTruthProof = {
  schemaVersion: "maul-quality-truth-proof/v1",
  manifestReplayKey: replayKey,
  captionLayout: {
    status: "verified",
    evidenceId: "evidence_caption_layout",
    boxes: [
      {
        captionIndex: 0,
        leftPx: 120,
        topPx: 1400,
        rightPx: 960,
        bottomPx: 1540,
      },
    ],
  },
  fontRuntime: {
    status: "eligible_loaded",
    family: "Prometheus Test Sans",
    assetId: "font_asset_test_sans",
    evidenceId: "evidence_font_loaded",
  },
  cropAndMask: {
    status: "verified",
    evidenceId: "evidence_crop_mask",
    maskingRequired: false,
    maskingStatus: "not_required",
    crops: [
      {
        outputStartMs: 0,
        outputEndMs: 4000,
        x: 0.2,
        y: 0,
        width: 0.6,
        height: 1,
      },
    ],
  },
  cameraContinuity: {
    status: "verified_continuous",
    evidenceId: "evidence_camera_continuity",
    resetOutputMs: [],
  },
  capabilities: [
    {
      capabilityId: "maul_source_timestamp_mapping",
      status: "native_render_safe",
      evidenceId: "evidence_source_mapping",
    },
    {
      capabilityId: "maul_caption_page_spring",
      status: "native_render_safe",
      evidenceId: "evidence_caption_spring",
    },
  ],
  fallbacks: [
    {
      planType: "dialogue_audio_plan",
      selected: true,
      evidenceId: "evidence_audio_fallback",
    },
  ],
};

const resultFor = (proof: MaulQualityTruthProof) =>
  evaluateMaulQualityTruth(manifest, proof);

const codesFor = (proof: MaulQualityTruthProof) =>
  resultFor(proof).failures.map((failure) => failure.code);

describe("MAUL Quality Truth gate", () => {
  it("requires placement evidence for a V2 manifest and compares measured boxes to planned envelopes", () => {
    const v2Manifest = {
      ...manifest,
      schemaVersion: "maul-unified-short-render-manifest/v2",
      planArtifactIds: {textPlacement: "artifact_placement"},
      plans: {
        ...manifest.plans,
        typographyMotion: {
          ...manifest.plans.typographyMotion,
          fontResolution: {
            selectedFamily: "DM Sans",
            selectedAssetId: "font_google_dm_sans_700",
            status: "eligible_loaded",
          },
        },
        textPlacement: {
          status: "planned",
          compatibilityProfiles: [
            {
              profileId: "maul-compat-dm-sans-v1",
              metrics: {fingerprint: "d".repeat(64)},
            },
          ],
          compositionIntervals: [
            {
              intervalId: "composition_interval_a",
              outputStartMs: 0,
              outputEndMs: 1000,
              variantId: "primary.centered_v1",
              transformHash: "c".repeat(64),
              crop: {x: 0.2, y: 0, width: 0.6, height: 1},
            },
          ],
          segments: [
            {
              segmentId: "placement_segment_a",
              outputStartMs: 0,
              outputEndMs: 1000,
              maximumEnvelope: {x: 0.1, y: 0.55, width: 0.8, height: 0.2},
              selectedCompositionVariantId: "primary.centered_v1",
              selectedTransformHash: "c".repeat(64),
              compatibility: {
                profileId: "maul-compat-dm-sans-v1",
                metricsFingerprint: "d".repeat(64),
              },
              minimumLegibilityPrimitive: {kind: "none"},
            },
          ],
        },
      },
    } as unknown as MaulUnifiedShortRenderManifest;
    const v2Proof = {
      ...validProof,
      schemaVersion: "maul-quality-truth-proof/v2" as const,
      fontRuntime: {
        status: "eligible_loaded" as const,
        family: "DM Sans",
        assetId: "font_google_dm_sans_700",
        evidenceId: "evidence_font_loaded",
      },
      cropAndMask: {
        ...validProof.cropAndMask,
        crops: [
          {
            outputStartMs: 0,
            outputEndMs: 1000,
            x: 0.2,
            y: 0,
            width: 0.6,
            height: 1,
          },
        ],
      },
      placementSegments: [
        {
          status: "verified" as const,
          evidenceId: "evidence_placement",
          textPlacementPlanArtifactId: "artifact_placement",
          placementSegmentId: "placement_segment_a",
          compositionIntervalId: "composition_interval_a",
          compositionVariantId: "primary.centered_v1",
          compositionTransformHash: "c".repeat(64),
          compatibilityProfileId: "maul-compat-dm-sans-v1" as const,
          metricsFingerprint: "d".repeat(64),
          exactFontAssetId: "font_google_dm_sans_700" as const,
          compiledLegibilityPrimitive: {kind: "none"} as const,
          measuredBox: {leftPx: 160, topPx: 1180, rightPx: 920, bottomPx: 1400},
        },
      ],
    };
    expect(evaluateMaulQualityTruth(v2Manifest, v2Proof).failures).toEqual([]);

    const outside = {
      ...v2Proof,
      placementSegments: [
        {...v2Proof.placementSegments[0]!, measuredBox: {leftPx: 0, topPx: 0, rightPx: 1080, bottomPx: 1920}},
      ],
    };
    expect(
      evaluateMaulQualityTruth(v2Manifest, outside).failures.map(
        (failure) => failure.code,
      ),
    ).toContain("placement_bounds_mismatch");

    const missing = {...v2Proof, placementSegments: []};
    expect(
      evaluateMaulQualityTruth(v2Manifest, missing).failures.map(
        (failure) => failure.code,
      ),
    ).toContain("placement_evidence_missing");
  });

  it("returns a named blocked result for malformed proof", () => {
    const result = evaluateMaulQualityTruth(manifest, {});

    expect(result).toMatchObject({
      status: "blocked",
      evidenceIds: [],
      failures: [expect.objectContaining({code: "proof_invalid"})],
    });
  });

  it("passes complete runtime proof for the compiled manifest", () => {
    expect(resultFor(validProof)).toEqual({
      schemaVersion: "maul-quality-truth-result/v1",
      manifestReplayKey: replayKey,
      status: "pass",
      evidenceIds: [
        "evidence_audio_fallback",
        "evidence_camera_continuity",
        "evidence_caption_layout",
        "evidence_caption_spring",
        "evidence_crop_mask",
        "evidence_font_loaded",
        "evidence_source_mapping",
      ],
      failures: [],
    });
  });

  it("rejects proof from another compiled manifest", () => {
    expect(codesFor({...validProof, manifestReplayKey: "b".repeat(64)})).toContain(
      "proof_manifest_mismatch",
    );
  });

  it("rejects missing and out-of-safe-region caption measurements", () => {
    const missing = {
      ...validProof,
      captionLayout: {
        status: "unverified" as const,
        evidenceId: null,
        boxes: [],
      },
    };
    const outside = {
      ...validProof,
      captionLayout: {
        ...validProof.captionLayout,
        boxes: [
          {
            ...validProof.captionLayout.boxes[0]!,
            bottomPx: 1700,
          },
        ],
      },
    };

    expect(codesFor(missing)).toContain("caption_bounds_unverified");
    expect(codesFor(outside)).toContain("caption_outside_safe_region");
  });

  it("rejects system fallback and mismatched font proof", () => {
    expect(codesFor({
      ...validProof,
      fontRuntime: {
        status: "fallback",
        family: "Arial",
        assetId: null,
        evidenceId: null,
      },
    })).toContain("font_fallback_forbidden");

    expect(codesFor({
      ...validProof,
      fontRuntime: {
        ...validProof.fontRuntime,
        family: "Different Family",
      },
    })).toContain("font_load_unverified");

    expect(codesFor({
      ...validProof,
      fontRuntime: {
        ...validProof.fontRuntime,
        assetId: "font_asset_unapproved",
      },
    })).toContain("font_load_unverified");
  });

  it("cannot bless a manifest-declared Arial fallback with claimed runtime proof", () => {
    const fallbackManifest = {
      ...manifest,
      plans: {
        ...manifest.plans,
        typographyMotion: {
          ...manifest.plans.typographyMotion,
          fontResolution: {
            requestedRole: "utility",
            selectedFamily: "Arial",
            selectedAssetId: null,
            status: "governed_fallback",
            reason: "Eligible font runtime is unavailable.",
          },
        },
      },
    } as unknown as MaulUnifiedShortRenderManifest;
    const claimedProof = {
      ...validProof,
      fontRuntime: {
        ...validProof.fontRuntime,
        family: "Arial",
      },
    };

    expect(
      evaluateMaulQualityTruth(fallbackManifest, claimedProof).failures.map(
        (failure) => failure.code,
      ),
    ).toContain("font_fallback_forbidden");
  });

  it("rejects unverified masking and crops outside normalized source bounds", () => {
    expect(codesFor({
      ...validProof,
      cropAndMask: {
        ...validProof.cropAndMask,
        maskingRequired: true,
        maskingStatus: "unverified",
      },
    })).toContain("crop_or_mask_unverified");

    expect(codesFor({
      ...validProof,
      cropAndMask: {
        ...validProof.cropAndMask,
        crops: [
          {...validProof.cropAndMask.crops[0]!, x: 0.7, width: 0.5},
        ],
      },
    })).toContain("crop_outside_source");
  });

  it("rejects camera restarts and missing continuity proof", () => {
    expect(codesFor({
      ...validProof,
      cameraContinuity: {
        status: "restart_detected",
        evidenceId: "evidence_camera_reset",
        resetOutputMs: [1400],
      },
    })).toContain("camera_zoom_restart");

    expect(codesFor({
      ...validProof,
      cameraContinuity: {
        status: "unverified",
        evidenceId: null,
        resetOutputMs: [],
      },
    })).toContain("camera_continuity_unverified");
  });

  it("rejects a detected camera restart even when reset timing is missing", () => {
    expect(codesFor({
      ...validProof,
      cameraContinuity: {
        status: "restart_detected",
        evidenceId: "evidence_camera_reset",
        resetOutputMs: [],
      },
    })).toContain("camera_zoom_restart");
  });

  it("rejects reported camera reset timing despite a continuous status claim", () => {
    expect(codesFor({
      ...validProof,
      cameraContinuity: {
        status: "verified_continuous",
        evidenceId: "evidence_camera_continuity",
        resetOutputMs: [1400],
      },
    })).toContain("camera_zoom_restart");
  });

  it("rejects unsupported or unproven selected capabilities", () => {
    expect(codesFor({
      ...validProof,
      capabilities: validProof.capabilities.map((capability) =>
        capability.capabilityId === "maul_caption_page_spring"
          ? {...capability, status: "unsupported" as const, evidenceId: null}
          : capability,
      ),
    })).toContain("capability_unsupported");

    expect(codesFor({
      ...validProof,
      capabilities: validProof.capabilities.filter(
        (capability) => capability.capabilityId !== "maul_caption_page_spring",
      ),
    })).toContain("capability_evidence_missing");
  });

  it("rejects governed fallbacks without observable evidence", () => {
    expect(codesFor({...validProof, fallbacks: []})).toContain(
      "silent_fallback",
    );
  });

  it("returns all independent failures in one result", () => {
    const result = resultFor({
      ...validProof,
      captionLayout: {status: "unverified", evidenceId: null, boxes: []},
      fontRuntime: {
        status: "fallback",
        family: "Arial",
        assetId: null,
        evidenceId: null,
      },
      fallbacks: [],
    });

    expect(result.status).toBe("blocked");
    expect(result.failures.map((failure) => failure.code)).toEqual(
      expect.arrayContaining([
        "caption_bounds_unverified",
        "font_fallback_forbidden",
        "silent_fallback",
      ]),
    );
  });
});
