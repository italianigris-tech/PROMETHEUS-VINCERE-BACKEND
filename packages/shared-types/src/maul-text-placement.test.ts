import {describe, expect, it} from "vitest";

import {
  maulShortsTextChunkPlanV2CoreSchema,
  maulTextPlacementPlanCoreSchema,
} from "./maul-text-placement.js";

const hashes = {
  transcript: "a".repeat(64),
  timeline: "b".repeat(64),
  chunkProposal: "c".repeat(64),
  chunkPlan: "d".repeat(64),
  catalog: "e".repeat(64),
  scorePolicy: "f".repeat(64),
  platformProfile: "1".repeat(64),
  compatibilityProfile: "2".repeat(64),
  compositionTrack: "3".repeat(64),
  transform: "4".repeat(64),
  metrics: "5".repeat(64),
};

const chunkCore = {
  schemaVersion: "maul-shorts-text-chunk-plan/v2",
  transcriptHash: hashes.transcript,
  timelineHash: hashes.timeline,
  chunkProposalHash: hashes.chunkProposal,
  outputDurationMs: 1000,
  pacing: "measured",
  style: "editorial",
  strategy: "llm_assisted",
  tokens: [
    {
      tokenId: "token_a",
      transcriptWordIndex: 0,
      text: "Make",
      sourceStartMs: 100,
      sourceEndMs: 500,
      outputSpans: [{outputStartMs: 0, outputEndMs: 400}],
      outputStartMs: 0,
      outputEndMs: 400,
    },
    {
      tokenId: "token_b",
      transcriptWordIndex: 1,
      text: "it",
      sourceStartMs: 500,
      sourceEndMs: 900,
      outputSpans: [{outputStartMs: 400, outputEndMs: 800}],
      outputStartMs: 400,
      outputEndMs: 800,
    },
  ],
  chunks: [
    {
      chunkId: "chunk_a",
      tokenIds: ["token_a", "token_b"],
      text: "Make it",
      outputStartMs: 0,
      outputEndMs: 800,
      semanticRole: "claim",
      emphasis: {
        tokenIds: ["token_b"],
        text: "it",
        level: "key",
      },
      holdAcrossProtectedPause: false,
      rationale: "Keeps the short claim intact.",
      confidence: 0.98,
    },
  ],
  protectedEntities: [],
  protectedPauses: [],
  inference: {
    status: "invoked",
    provider: "openai_compatible",
    baseUrl: "https://example.com/v1",
    model: "fixture-model",
    requestHash: "6".repeat(64),
    responseHash: "7".repeat(64),
    fallbackReason: null,
  },
  inputHashes: {
    transcript: hashes.transcript,
    editorialTimeline: hashes.timeline,
    chunkProposal: hashes.chunkProposal,
  },
} as const;

const placementCore = {
  schemaVersion: "maul-text-placement-plan/v1",
  textChunkPlanArtifactId: "artifact_text_chunk",
  textChunkPlanHash: hashes.chunkPlan,
  catalog: {
    catalogId: "maul-placement-catalog-three-family-v1",
    version: "1",
    hash: hashes.catalog,
  },
  scorePolicy: {
    policyId: "maul-placement-score-policy-v1",
    version: "1",
    hash: hashes.scorePolicy,
    dimensionWeights: {
      readability: 1,
      opticalBalance: 0.75,
      continuity: 0.5,
    },
    beamWidth: 3,
    planningHorizonSegments: 3,
  },
  platformProfile: {
    profileId: "maul-platform-instagram-reels-v1",
    platform: "instagram_reels",
    version: "1",
    output: {width: 1080, height: 1920, fps: 30},
    safeRegion: {x: 0.05, y: 0.05, width: 0.85, height: 0.82},
  },
  compatibilityProfiles: [
    {
      profileId: "maul-compat-dm-sans-v1",
      family: "DM Sans",
      approvedFontAssets: [
        {
          assetId: "font_google_dm_sans_700",
          family: "DM Sans",
          weights: [500, 700, 800],
        },
      ],
      loadedFallback: {
        assetId: "font_google_dm_sans_700",
        family: "DM Sans",
        weight: 700,
      },
      metrics: {
        fingerprint: hashes.metrics,
        maxGlyphWidthEm: 1.1,
        maxLineHeightEm: 1.25,
        minimumFontSizePx: 48,
        maximumFontSizePx: 96,
        minimumLineHeight: 1,
        maximumLineHeight: 1.25,
      },
    },
  ],
  compositionIntervals: [
    {
      intervalId: "composition_interval_a",
      sceneId: "scene_a",
      discontinuityId: "discontinuity_a",
      variantId: "primary.centered_v1",
      outputStartMs: 0,
      outputEndMs: 1000,
      transformHash: hashes.transform,
      sourceViewport: {x: 0, y: 0, width: 1, height: 1},
      sourceOccupancy: [{x: 0, y: 0, width: 1, height: 1}],
      paddedNonSourceRegions: [],
      crop: {x: 0.2, y: 0, width: 0.6, height: 1},
      scale: {x: 1, y: 1},
    },
  ],
  status: "planned",
  blockingReason: null,
  segments: [
    {
      segmentId: "placement_segment_a",
      chunkId: "chunk_a",
      sceneId: "scene_a",
      discontinuityId: "discontinuity_a",
      outputStartMs: 0,
      outputEndMs: 800,
      selectedCompositionVariantId: "primary.centered_v1",
      selectedTransformHash: hashes.transform,
      tokenIds: ["token_a", "token_b"],
      lines: [
        {
          lineId: "line_a",
          tokenIds: ["token_a", "token_b"],
          text: "Make it",
        },
      ],
      family: "measured",
      variantId: "measured.centered_statement_v1",
      box: {x: 0.15, y: 0.62, width: 0.7, height: 0.12},
      maximumEnvelope: {x: 0.12, y: 0.59, width: 0.76, height: 0.18},
      alignment: "center",
      compatibility: {
        profileId: "maul-compat-dm-sans-v1",
        metricsFingerprint: hashes.metrics,
        nominalFontSizePx: 72,
        lineHeight: 1.1,
        hierarchyScale: 1,
      },
      depth: {
        desired: "front",
        resolved: "front",
        treatmentState: "not_requested",
      },
      minimumLegibilityPrimitive: {
        kind: "solid_plate",
        paddingXPx: 20,
        paddingYPx: 12,
        cornerRadiusPx: 4,
        backgroundColor: "#000000",
        minimumOpacity: 0.72,
      },
      hardGates: [
        {
          gateId: "exact_token_sequence",
          status: "pass",
          evidenceId: "evidence_tokens",
          rationale: "Every governed token is present in order.",
        },
      ],
      scores: {
        readability: 1,
        opticalBalance: 0.9,
        continuity: 0.8,
      },
      rationale: "The measured family fits the available lower field.",
      confidence: 0.96,
      fallbackCode: null,
      fallbackReason: null,
    },
  ],
  inputHashes: {
    textChunkPlan: hashes.chunkPlan,
    outputCompositionTrack: hashes.compositionTrack,
    platformProfile: hashes.platformProfile,
    compatibilityProfile: hashes.compatibilityProfile,
    catalog: hashes.catalog,
    scorePolicy: hashes.scorePolicy,
  },
} as const;

const clone = <Value>(value: Value): Value => structuredClone(value);

describe("MAUL V2 text chunk core contract", () => {
  it("accepts stable ordered tokens and exact chunk coverage", () => {
    expect(
      maulShortsTextChunkPlanV2CoreSchema.parse(chunkCore).chunks[0]!
        .tokenIds,
    ).toEqual(["token_a", "token_b"]);
  });

  it("rejects duplicate stable token IDs", () => {
    const invalid = clone(chunkCore);
    invalid.tokens[1].tokenId = "token_a";

    expect(() =>
      maulShortsTextChunkPlanV2CoreSchema.parse(invalid),
    ).toThrow(/token IDs.*unique|unique.*token IDs/i);
  });

  it("rejects non-exact chunk token coverage", () => {
    const invalid = clone(chunkCore);
    invalid.chunks[0].tokenIds = ["token_a"];

    expect(() =>
      maulShortsTextChunkPlanV2CoreSchema.parse(invalid),
    ).toThrow(/cover.*exactly|exact.*cover/i);
  });

  it("rejects emphasis tokens outside their chunk", () => {
    const invalid = clone(chunkCore);
    invalid.chunks[0].emphasis.tokenIds = ["token_missing"];

    expect(() =>
      maulShortsTextChunkPlanV2CoreSchema.parse(invalid),
    ).toThrow(/emphasis.*belong|belong.*emphasis/i);
  });

  it("rejects overlapping token output spans", () => {
    const invalid = clone(chunkCore);
    invalid.tokens[0].outputSpans = [
      {outputStartMs: 0, outputEndMs: 300},
      {outputStartMs: 200, outputEndMs: 400},
    ];

    expect(() =>
      maulShortsTextChunkPlanV2CoreSchema.parse(invalid),
    ).toThrow(/output spans.*ordered.*non-overlapping/i);
  });
});

describe("MAUL text placement core contract", () => {
  it("accepts a selected measured-family placement segment", () => {
    expect(
      maulTextPlacementPlanCoreSchema.parse(placementCore).segments[0]!
        .family,
    ).toBe("measured");
  });

  it("accepts a uniform profile transform and rejects inconsistent final dimensions", () => {
    const withTransform = clone(placementCore) as any;
    withTransform.segments[0].profileTransform = {
      uniformScale: 2,
      intrinsicWidthPx: 640,
      intrinsicHeightPx: 180,
      finalWidthPx: 1280,
      finalHeightPx: 360,
    };
    expect(
      maulTextPlacementPlanCoreSchema.parse(withTransform).segments[0]
        .profileTransform?.uniformScale,
    ).toBe(2);

    withTransform.segments[0].compatibility.hierarchyScale = 3;
    expect(
      maulTextPlacementPlanCoreSchema.parse(withTransform).segments[0]
        .profileTransform?.uniformScale,
    ).toBe(2);

    withTransform.segments[0].profileTransform.finalWidthPx = 1279;
    expect(() => maulTextPlacementPlanCoreSchema.parse(withTransform)).toThrow(
      /profile transform.*dimensions|dimensions.*uniform scale/i,
    );
  });

  it("allows primary and fallback composition variants over the same interval", () => {
    const withFallback = clone(placementCore);
    withFallback.compositionIntervals.push({
      ...withFallback.compositionIntervals[0],
      intervalId: "composition_interval_fallback",
      variantId: "caption_safe_fallback.padded_band_v1",
      transformHash: "8".repeat(64),
      sourceOccupancy: [{x: 0, y: 0, width: 1, height: 0.75}],
      paddedNonSourceRegions: [{x: 0, y: 0.75, width: 1, height: 0.25}],
    });

    expect(
      maulTextPlacementPlanCoreSchema.parse(withFallback)
        .compositionIntervals,
    ).toHaveLength(2);
  });

  it("rejects padded non-source regions that overlap source pixels", () => {
    const invalid = clone(placementCore);
    invalid.compositionIntervals[0].paddedNonSourceRegions = [
      {x: 0, y: 0.8, width: 1, height: 0.2},
    ];

    expect(() => maulTextPlacementPlanCoreSchema.parse(invalid)).toThrow(
      /padded non-source.*overlap.*source|source.*overlap.*padded non-source/i,
    );
  });

  it("rejects normalized boxes whose extents leave the output", () => {
    const invalid = clone(placementCore);
    invalid.segments[0].box = {x: 0.8, y: 0.62, width: 0.4, height: 0.12};

    expect(() => maulTextPlacementPlanCoreSchema.parse(invalid)).toThrow(
      /box.*\[0,1\]|normalized.*bounds/i,
    );
  });

  it("rejects line token loss or reordering", () => {
    const invalid = clone(placementCore);
    invalid.segments[0].lines[0].tokenIds = ["token_b", "token_a"];

    expect(() => maulTextPlacementPlanCoreSchema.parse(invalid)).toThrow(
      /lines.*token.*exact.*order|token.*exact.*order/i,
    );
  });

  it("requires editorial lockup choreography to match placement token order", () => {
    const withLockup = clone(placementCore) as any;
    withLockup.segments[0].editorialLockup = {
      schemaVersion: "maul-editorial-lockup/v1",
      mode: "script_tag_overlap",
      primaryTokenIds: ["token_a"],
      accentTokenIds: ["token_b"],
      tokenStyles: [
        {
          tokenId: "token_a",
          role: "primary",
          fontAssetId: "font_google_dm_sans_700",
          fontFamily: "DM Sans",
          fontStyle: "normal",
          fontWeight: 700,
          offsetXPx: 0,
          offsetYPx: 0,
          fontSizeScale: 1,
          rotationDeg: 0,
          zIndex: 1,
          opacity: 1,
        },
        {
          tokenId: "token_b",
          role: "accent",
          fontAssetId: "font_google_playfair_display_italic_700",
          fontFamily: "Playfair Display",
          fontStyle: "italic",
          fontWeight: 700,
          offsetXPx: -18,
          offsetYPx: 5,
          fontSizeScale: 0.82,
          rotationDeg: -3,
          zIndex: 2,
          opacity: 1,
        },
      ],
      overlap: {
        enabled: true,
        ratio: 0.22,
        direction: "accent_over_primary",
        rationale: "The accent hinge crosses the display phrase.",
      },
      choreography: {
        mode: "forward_word_reveal",
        tokenOrder: ["token_a", "token_b"],
        staggerMs: 72,
        entryDurationMs: 150,
      },
      rationale: "The lockup follows the governed placement token sequence.",
    };

    expect(maulTextPlacementPlanCoreSchema.parse(withLockup)).toBeDefined();

    withLockup.segments[0].editorialLockup.choreography.tokenOrder = [
      "token_b",
      "token_a",
    ];
    expect(() => maulTextPlacementPlanCoreSchema.parse(withLockup)).toThrow(
      /lockup.*token.*order|token.*order.*lockup/i,
    );
  });

  it("rejects hierarchy-scaled typography outside its profile", () => {
    const invalid = clone(placementCore);
    invalid.compatibilityProfiles[0].metrics.maximumFontSizePx = 72;
    invalid.segments[0].compatibility.hierarchyScale = 1.01;

    expect(() => maulTextPlacementPlanCoreSchema.parse(invalid)).toThrow(
      /metrics.*fit.*compatibility profile/i,
    );
  });

  it.each(["fail", "unknown"] as const)(
    "rejects a selected segment with a %s hard gate",
    (status) => {
      const invalid = clone(placementCore);
      invalid.segments[0].hardGates[0].status = status;

      expect(() => maulTextPlacementPlanCoreSchema.parse(invalid)).toThrow(
        /selected.*hard gates.*pass|hard gates.*selected.*pass/i,
      );
    },
  );

  it("rejects executable behind-subject depth", () => {
    const invalid = clone(placementCore);
    invalid.segments[0].depth = {
      desired: "behind_subject_requested",
      resolved: "behind_subject",
      treatmentState: "executed",
    };

    expect(() => maulTextPlacementPlanCoreSchema.parse(invalid)).toThrow(
      /behind-subject.*not executable|executable.*behind-subject/i,
    );
  });

  it("rejects planned placement with no segments", () => {
    const invalid = clone(placementCore);
    invalid.segments = [];

    expect(() => maulTextPlacementPlanCoreSchema.parse(invalid)).toThrow(
      /planned.*segment/i,
    );
  });

  it("rejects blocked placement without a reason", () => {
    const invalid = clone(placementCore);
    invalid.status = "blocked";
    invalid.segments = [];
    invalid.blockingReason = null;

    expect(() => maulTextPlacementPlanCoreSchema.parse(invalid)).toThrow(
      /blocked.*reason/i,
    );
  });
});
