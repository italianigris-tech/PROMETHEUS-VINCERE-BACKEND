import {describe, expect, it} from "vitest";

import type {
  MaulNormalizedBox,
  MaulOutputCompositionInterval,
  MaulShortsTextChunkPlanV2Core,
} from "@prometheus/shared-types";

import {
  assertMaulTypographyPlacementCompatibility,
  buildMaulTextPlacementPlan,
} from "./shorts-text-placement.js";

const sha = (character: string) => character.repeat(64);

const makeChunkPlan = ({
  outputSpans = [{outputStartMs: 0, outputEndMs: 1000}],
}: {
  outputSpans?: Array<{outputStartMs: number; outputEndMs: number}>;
} = {}): MaulShortsTextChunkPlanV2Core => ({
  schemaVersion: "maul-shorts-text-chunk-plan/v2",
  transcriptHash: sha("a"),
  timelineHash: sha("b"),
  chunkProposalHash: sha("c"),
  outputDurationMs: 1000,
  pacing: "measured",
  style: "editorial",
  strategy: "deterministic_fallback",
  tokens: [
    {
      tokenId: "token_across",
      transcriptWordIndex: 4,
      text: "Across",
      sourceStartMs: 0,
      sourceEndMs: 1200,
      outputSpans,
      outputStartMs: outputSpans[0]!.outputStartMs,
      outputEndMs: outputSpans.at(-1)!.outputEndMs,
    },
  ],
  chunks: [
    {
      chunkId: "chunk_across",
      tokenIds: ["token_across"],
      text: "Across",
      outputStartMs: 0,
      outputEndMs: 1000,
      semanticRole: "proof",
      emphasis: {tokenIds: ["token_across"], text: "Across", level: "key"},
      holdAcrossProtectedPause: false,
      rationale: "Preserve one governed token.",
      confidence: 1,
    },
  ],
  protectedEntities: [],
  protectedPauses: [],
  inference: {
    status: "skipped_missing_credentials",
    provider: "openai_compatible",
    baseUrl: "https://example.com/v1",
    model: "fixture-model",
    requestHash: null,
    responseHash: null,
    fallbackReason: "Fixture uses deterministic fallback.",
  },
  inputHashes: {
    transcript: sha("a"),
    editorialTimeline: sha("b"),
    chunkProposal: sha("c"),
  },
});

const composition = ({
  intervalId = "composition_primary",
  sceneId = "scene_a",
  discontinuityId = "discontinuity_a",
  variantId = "primary.centered_v1",
  outputStartMs = 0,
  outputEndMs = 1000,
  transformHash = sha("d"),
  paddedNonSourceRegions = [],
  compositionDirection = null,
  textAnchor = null,
}: Partial<MaulOutputCompositionInterval> = {}): MaulOutputCompositionInterval => ({
  intervalId,
  sceneId,
  discontinuityId,
  variantId,
  outputStartMs,
  outputEndMs,
  transformHash,
  sourceViewport: {x: 0, y: 0, width: 1, height: 1},
  sourceOccupancy:
    paddedNonSourceRegions.length > 0
      ? [{x: 0, y: 0.3, width: 1, height: 0.7}]
      : [{x: 0, y: 0, width: 1, height: 1}],
  paddedNonSourceRegions,
  compositionDirection,
  textAnchor,
  crop: {x: 0, y: 0, width: 1, height: 1},
  scale: {x: 1, y: 1},
});

const observation = ({
  evidenceId = "evidence_a",
  sceneId = "scene_a",
  outputStartMs = 0,
  outputEndMs = 1000,
  trackingState = "tracked",
  subjectBox = null,
  cutEvidenceStatus = "known",
}: {
  evidenceId?: string;
  sceneId?: string;
  outputStartMs?: number;
  outputEndMs?: number;
  trackingState?: "tracked" | "held" | "lost" | "unknown" | "absent_confirmed";
  subjectBox?: MaulNormalizedBox | null;
  cutEvidenceStatus?: "known" | "unknown";
}) => ({
  evidenceId,
  sceneId,
  outputStartMs,
  outputEndMs,
  trackingState,
  subjectBox,
  cutEvidenceStatus,
  existingTextRegions: [],
});

const boxesOverlap = (first: MaulNormalizedBox, second: MaulNormalizedBox) =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y;

describe("MAUL scene-aware text placement", () => {
  it.each([
    ["left", {x: 0.06, y: 0.08, width: 0.28, height: 0.56}],
    ["center", {x: 0.35, y: 0.08, width: 0.3, height: 0.48}],
    ["right", {x: 0.66, y: 0.08, width: 0.28, height: 0.56}],
  ] as const)("keeps planned text clear of a %s subject", (_position, subjectBox) => {
    const plan = buildMaulTextPlacementPlan({
      textChunkPlanArtifactId: "artifact_text_chunk",
      textChunkPlan: makeChunkPlan(),
      compositionIntervals: [composition()],
      observationIntervals: [observation({subjectBox})],
    });

    expect(plan.status).toBe("planned");
    expect(plan.segments).toHaveLength(1);
    expect(boxesOverlap(plan.segments[0]!.maximumEnvelope, subjectBox)).toBe(
      false,
    );
    expect(["measured", "editorial", "personal"]).toContain(
      plan.segments[0]!.family,
    );
    expect(plan.segments[0]!.lines.flatMap((line) => line.tokenIds)).toEqual(
      plan.segments[0]!.tokenIds,
    );
  });

  it("splits at a cut without duplicating a cut-spanning stable token", () => {
    const firstBand = {x: 0.2, y: 0.08, width: 0.24, height: 0.16};
    const secondBand = {x: 0.7, y: 0.08, width: 0.24, height: 0.16};
    const plan = buildMaulTextPlacementPlan({
      textChunkPlanArtifactId: "artifact_text_chunk",
      textChunkPlan: makeChunkPlan({
        outputSpans: [
          {outputStartMs: 0, outputEndMs: 500},
          {outputStartMs: 500, outputEndMs: 1000},
        ],
      }),
      compositionIntervals: [
        composition({
          intervalId: "fallback_before",
          discontinuityId: "cut_before",
          variantId: "caption_safe_fallback",
          outputEndMs: 500,
          transformHash: sha("1"),
          paddedNonSourceRegions: [firstBand],
        }),
        composition({
          intervalId: "fallback_after",
          discontinuityId: "cut_after",
          variantId: "caption_safe_fallback",
          outputStartMs: 500,
          transformHash: sha("2"),
          paddedNonSourceRegions: [secondBand],
        }),
      ],
      observationIntervals: [
        observation({outputEndMs: 500, trackingState: "unknown", cutEvidenceStatus: "unknown"}),
        observation({
          evidenceId: "evidence_after",
          outputStartMs: 500,
          trackingState: "unknown",
          cutEvidenceStatus: "unknown",
        }),
      ],
      geometryResetOutputMs: [500],
    });

    expect(plan.status).toBe("planned");
    expect(plan.segments.map((segment) => [segment.outputStartMs, segment.outputEndMs])).toEqual([
      [0, 500],
      [500, 1000],
    ]);
    expect(plan.segments.map((segment) => segment.tokenIds)).toEqual([
      ["token_across"],
      ["token_across"],
    ]);
    expect(plan.segments.map((segment) => segment.box.x)).toEqual([0.2, 0.7]);
    expect(plan.segments.some((segment) => segment.box.x === 0.5)).toBe(false);
    expect(plan.segments.every((segment) =>
      segment.outputStartMs >= 500 || segment.outputEndMs <= 500,
    )).toBe(true);
    expect(plan.segments.every((segment) =>
      segment.variantId === "caption_safe_fallback.padded_band_v1",
    )).toBe(true);
  });

  it("holds scene-local geometry through an explicit short tracking dropout", () => {
    const chunkPlan = makeChunkPlan();
    chunkPlan.tokens = [
      {...chunkPlan.tokens[0]!, tokenId: "token_one", text: "First", outputSpans: [{outputStartMs: 0, outputEndMs: 500}], outputEndMs: 500},
      {...chunkPlan.tokens[0]!, tokenId: "token_two", transcriptWordIndex: 5, text: "Second", sourceStartMs: 1200, sourceEndMs: 1600, outputSpans: [{outputStartMs: 500, outputEndMs: 1000}], outputStartMs: 500},
    ];
    chunkPlan.chunks = [
      {...chunkPlan.chunks[0]!, chunkId: "chunk_one", tokenIds: ["token_one"], text: "First", outputEndMs: 500, emphasis: {tokenIds: ["token_one"], text: "First", level: "key"}},
      {...chunkPlan.chunks[0]!, chunkId: "chunk_two", tokenIds: ["token_two"], text: "Second", outputStartMs: 500, emphasis: {tokenIds: ["token_two"], text: "Second", level: "key"}},
    ];
    const leftSubject = {x: 0.06, y: 0.08, width: 0.28, height: 0.56};
    const plan = buildMaulTextPlacementPlan({
      textChunkPlanArtifactId: "artifact_text_chunk",
      textChunkPlan: chunkPlan,
      compositionIntervals: [composition()],
      observationIntervals: [
        observation({outputEndMs: 500, subjectBox: leftSubject}),
        observation({evidenceId: "evidence_held", outputStartMs: 500, trackingState: "held"}),
      ],
    });

    expect(plan.status).toBe("planned");
    expect(plan.segments).toHaveLength(2);
    expect(plan.segments[1]!.box).toEqual(plan.segments[0]!.box);
    expect(plan.segments[1]!.selectedCompositionVariantId).toBe(
      plan.segments[0]!.selectedCompositionVariantId,
    );
  });

  it("keeps rapid token timing inside one stable composition hold", () => {
    const chunkPlan = makeChunkPlan();
    const tokens = Array.from({length: 8}, (_, index) => ({
      ...chunkPlan.tokens[0]!,
      tokenId: `token_${index + 1}`,
      transcriptWordIndex: index,
      text: `Word${index + 1}`,
      sourceStartMs: index * 125,
      sourceEndMs: (index + 1) * 125,
      outputSpans: [{outputStartMs: index * 125, outputEndMs: (index + 1) * 125}],
      outputStartMs: index * 125,
      outputEndMs: (index + 1) * 125,
    }));
    chunkPlan.tokens = tokens;
    chunkPlan.chunks = [{
      ...chunkPlan.chunks[0]!,
      tokenIds: tokens.map((token) => token.tokenId),
      text: tokens.map((token) => token.text).join(" "),
      emphasis: {
        tokenIds: [tokens[0]!.tokenId],
        text: tokens[0]!.text,
        level: "key",
      },
    }];

    const plan = buildMaulTextPlacementPlan({
      textChunkPlanArtifactId: "artifact_text_chunk",
      textChunkPlan: chunkPlan,
      compositionIntervals: [composition()],
      observationIntervals: [
        observation({trackingState: "absent_confirmed"}),
      ],
    });

    expect(plan.status).toBe("planned");
    expect(plan.segments).toHaveLength(1);
    expect(plan.segments[0]).toMatchObject({
      outputStartMs: 0,
      outputEndMs: 1000,
      tokenIds: tokens.map((token) => token.tokenId),
    });
  });

  it("uses semantic line breaks for a measured scene opportunity instead of rejecting it", () => {
    const chunkPlan = makeChunkPlan();
    const words = ["This", "claim", "matters.", "Here", "is"];
    chunkPlan.tokens = words.map((text, index) => ({
      ...chunkPlan.tokens[0]!,
      tokenId: `scene_token_${index + 1}`,
      transcriptWordIndex: index,
      text,
      sourceStartMs: index * 200,
      sourceEndMs: (index + 1) * 200,
      outputSpans: [{outputStartMs: index * 200, outputEndMs: (index + 1) * 200}],
      outputStartMs: index * 200,
      outputEndMs: (index + 1) * 200,
    }));
    chunkPlan.chunks = [{
      ...chunkPlan.chunks[0]!,
      tokenIds: chunkPlan.tokens.map((token) => token.tokenId),
      text: words.join(" "),
      emphasis: {
        tokenIds: ["scene_token_2"],
        text: "claim",
        level: "hero",
      },
    }];

    const plan = buildMaulTextPlacementPlan({
      textChunkPlanArtifactId: "artifact_text_chunk",
      textChunkPlan: chunkPlan,
      compositionIntervals: [
        composition({
          intervalId: "scene_opportunity",
          variantId: "scene_evidence.editorial_asymmetry.negative_space_right",
          compositionDirection: "editorial_asymmetry",
          textAnchor: {
            box: {x: 0.52, y: 0.18, width: 0.38, height: 0.22},
            maximumEnvelope: {x: 0.5, y: 0.16, width: 0.42, height: 0.26},
            alignment: "left",
          },
        }),
      ],
      observationIntervals: [
        observation({
          subjectBox: {x: 0.08, y: 0.08, width: 0.32, height: 0.72},
        }),
      ],
    });

    expect(plan.status).toBe("planned");
    expect(plan.segments[0]!.lines.map((line) => line.text)).toEqual([
      "This claim",
      "matters.",
      "Here is",
    ]);
  });

  it("uses supplied measured font geometry for source-pixel placement", () => {
    const measuredProfile = {
      profileId: "maul-measured-playfair-editorial-v1",
      family: "Playfair Display",
      approvedFontAssets: [{
        assetId: "font_playfair_700",
        family: "Playfair Display",
        weights: [700],
      }],
      loadedFallback: {
        assetId: "font_playfair_700",
        family: "Playfair Display",
        weight: 700,
      },
      metrics: {
        fingerprint: sha("e"),
        maxGlyphWidthEm: 0.82,
        maxLineHeightEm: 1.18,
        minimumFontSizePx: 48,
        maximumFontSizePx: 88,
        minimumLineHeight: 1,
        maximumLineHeight: 1.2,
      },
    };
    const plan = buildMaulTextPlacementPlan({
      textChunkPlanArtifactId: "artifact_text_chunk",
      textChunkPlan: makeChunkPlan(),
      compositionIntervals: [
        composition({
          intervalId: "measured_scene_opportunity",
          variantId: "scene_evidence.editorial_asymmetry.measurement",
          compositionDirection: "editorial_asymmetry",
          textAnchor: {
            box: {x: 0.52, y: 0.18, width: 0.38, height: 0.22},
            maximumEnvelope: {x: 0.5, y: 0.16, width: 0.42, height: 0.26},
            alignment: "left",
          },
        }),
      ],
      observationIntervals: [
        observation({subjectBox: {x: 0.08, y: 0.08, width: 0.32, height: 0.72}}),
      ],
      typography: {
        profile: measuredProfile,
        layouts: [{
          chunkId: "chunk_across",
          fontSizePx: 72,
          lines: [{
            text: "Across",
            widthPx: 210,
            measurementId: "measurement_across_playfair",
          }],
          measurementIds: ["measurement_across_playfair"],
        }],
      },
    });

    expect(plan).toMatchObject({
      status: "planned",
      compatibilityProfiles: [expect.objectContaining({
        profileId: "maul-measured-playfair-editorial-v1",
        family: "Playfair Display",
      })],
      segments: [expect.objectContaining({
        compatibility: expect.objectContaining({
          profileId: "maul-measured-playfair-editorial-v1",
          metricsFingerprint: sha("e"),
        }),
      })],
    });
    expect(plan.segments[0]?.hardGates).toContainEqual(
      expect.objectContaining({
        gateId: "measured_font_geometry",
        status: "pass",
        evidenceId: "measurement_across_playfair",
      }),
    );
  });

  it("uses only a padded fallback when cut or subject evidence is unknown", () => {
    const fallbackBand = {x: 0.2, y: 0.08, width: 0.6, height: 0.16};
    const input = {
      textChunkPlanArtifactId: "artifact_text_chunk",
      textChunkPlan: makeChunkPlan(),
      compositionIntervals: [
        composition(),
        composition({
          intervalId: "fallback",
          variantId: "caption_safe_fallback",
          transformHash: sha("e"),
          paddedNonSourceRegions: [fallbackBand],
        }),
      ],
      observationIntervals: [
        observation({trackingState: "unknown", cutEvidenceStatus: "unknown"}),
      ],
    } as const;

    const plan = buildMaulTextPlacementPlan(input);
    expect(plan.status).toBe("planned");
    expect(plan.segments[0]).toEqual(
      expect.objectContaining({
        selectedCompositionVariantId: "caption_safe_fallback",
        variantId: "caption_safe_fallback.padded_band_v1",
        family: "personal",
        box: fallbackBand,
      }),
    );

    const blocked = buildMaulTextPlacementPlan({
      ...input,
      compositionIntervals: [composition()],
    });
    expect(blocked.status).toBe("blocked");
    expect(blocked.blockingReason).toBe(
      "blocked_no_readable_dialogue_candidate",
    );
  });

  it("accounts for solid-plate padding before authorizing fallback fit", () => {
    const chunkPlan = makeChunkPlan();
    const text = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    chunkPlan.tokens[0]!.text = text;
    chunkPlan.chunks[0]!.text = text;
    chunkPlan.chunks[0]!.emphasis.text = text;

    const plan = buildMaulTextPlacementPlan({
      textChunkPlanArtifactId: "artifact_text_chunk",
      textChunkPlan: chunkPlan,
      compositionIntervals: [
        composition({
          intervalId: "fallback",
          variantId: "caption_safe_fallback",
          paddedNonSourceRegions: [
            {x: 0.08, y: 0.08, width: 0.84, height: 0.16},
          ],
        }),
      ],
      observationIntervals: [
        observation({trackingState: "unknown", cutEvidenceStatus: "unknown"}),
      ],
    });

    expect(plan.status).toBe("blocked");
    expect(plan.segments).toEqual([]);
  });

  it("blocks when known subject occupancy leaves no readable region", () => {
    const plan = buildMaulTextPlacementPlan({
      textChunkPlanArtifactId: "artifact_text_chunk",
      textChunkPlan: makeChunkPlan(),
      compositionIntervals: [composition()],
      observationIntervals: [
        observation({
          subjectBox: {x: 0.04, y: 0.04, width: 0.92, height: 0.88},
        }),
      ],
    });

    expect(plan.status).toBe("blocked");
    expect(plan.segments).toEqual([]);
    expect(plan.blockingReason).toBe(
      "blocked_no_readable_dialogue_candidate",
    );
  });

  it("uses a stable tie-break independent of candidate family iteration", () => {
    const input = {
      textChunkPlanArtifactId: "artifact_text_chunk",
      textChunkPlan: makeChunkPlan(),
      compositionIntervals: [composition()],
      observationIntervals: [
        observation({trackingState: "absent_confirmed"}),
      ],
    } as const;
    const forward = buildMaulTextPlacementPlan({
      ...input,
      candidateFamilyOrder: ["measured", "editorial", "personal"],
    });
    const reverse = buildMaulTextPlacementPlan({
      ...input,
      candidateFamilyOrder: ["personal", "editorial", "measured"],
    });

    expect(reverse).toEqual(forward);
  });

  it("rejects typography compilation outside the reserved DM Sans envelope", () => {
    const placementPlan = buildMaulTextPlacementPlan({
      textChunkPlanArtifactId: "artifact_text_chunk",
      textChunkPlan: makeChunkPlan(),
      compositionIntervals: [composition()],
      observationIntervals: [
        observation({trackingState: "absent_confirmed"}),
      ],
    });
    const compatible = {
      placementPlan,
      selectedFamily: "DM Sans",
      selectedAssetId: "font_google_dm_sans_700",
      compiledMetrics: {maxGlyphWidthEm: 0.72, maxLineHeightEm: 1.2},
    } as const;

    expect(() =>
      assertMaulTypographyPlacementCompatibility(compatible),
    ).not.toThrow();
    expect(() =>
      assertMaulTypographyPlacementCompatibility({
        ...compatible,
        selectedFamily: "Inter",
      }),
    ).toThrow(/family/i);
    expect(() =>
      assertMaulTypographyPlacementCompatibility({
        ...compatible,
        selectedAssetId: "font_unapproved",
      }),
    ).toThrow(/asset/i);
    expect(() =>
      assertMaulTypographyPlacementCompatibility({
        ...compatible,
        compiledMetrics: {maxGlyphWidthEm: 0.8, maxLineHeightEm: 1.2},
      }),
    ).toThrow(/metrics|envelope/i);
  });

  it("fits hierarchy-scaled typography inside the selected box", () => {
    const chunkPlan = makeChunkPlan();
    chunkPlan.tokens[0]!.text = "Metrics";
    chunkPlan.chunks[0]!.text = "Metrics";
    chunkPlan.chunks[0]!.semanticRole = "claim";
    chunkPlan.chunks[0]!.emphasis.text = "Metrics";

    const plan = buildMaulTextPlacementPlan({
      textChunkPlanArtifactId: "artifact_text_chunk",
      textChunkPlan: chunkPlan,
      compositionIntervals: [composition()],
      observationIntervals: [
        observation({
          subjectBox: {x: 0.06, y: 0.08, width: 0.28, height: 0.48},
        }),
      ],
    });

    expect(plan.status).toBe("planned");
    expect(plan.segments[0]!.family).toBe("measured");
    const segment = plan.segments[0]!;
    const effectiveFontSizePx =
      segment.compatibility.nominalFontSizePx *
      segment.compatibility.hierarchyScale;
    expect(
      chunkPlan.tokens[0]!.text.length * effectiveFontSizePx * 0.72,
    ).toBeLessThanOrEqual(
      segment.box.width * 1080,
    );
  });
});
