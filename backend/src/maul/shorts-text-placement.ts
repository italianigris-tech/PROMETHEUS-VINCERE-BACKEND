import {
  joinShortsTextTokens,
  maulShortsTextChunkPlanV2CoreSchema,
  maulTextPlacementPlanCoreSchema,
  type MaulMinimumLegibilityPrimitive,
  type MaulNormalizedBox,
  type MaulOutputCompositionInterval,
  type MaulShortsTextChunkPlanV2Core,
  type MaulTextChunkV2,
  type MaulTextPlacementPlanCore,
  type MaulTextPlacementSegment,
} from "@prometheus/shared-types";

import {hashMaulPlanPayload} from "./text-chunk-plan.js";

export type MaulPlacementFamily = "measured" | "editorial" | "personal";

export type MaulPlacementObservationInterval = {
  evidenceId: string;
  sceneId: string;
  outputStartMs: number;
  outputEndMs: number;
  trackingState:
    | "tracked"
    | "held"
    | "lost"
    | "unknown"
    | "absent_confirmed";
  subjectBox: MaulNormalizedBox | null;
  cutEvidenceStatus: "known" | "unknown";
  existingTextRegions: readonly MaulNormalizedBox[];
};

export type MaulPlacementTimelineInterval = {
  outputStartMs: number;
  outputEndMs: number;
};

export type MaulPlacementShotInterval = MaulPlacementTimelineInterval & {
  sceneId: string;
  discontinuityId: string;
};

const PLATFORM_PROFILE = {
  profileId: "maul-platform-instagram-reels-v1",
  platform: "instagram_reels" as const,
  version: "1",
  output: {width: 1080 as const, height: 1920 as const, fps: 30 as const},
  safeRegion: {x: 0.04, y: 0.04, width: 0.92, height: 0.88},
};

const COMPATIBILITY_METRICS = {
  maxGlyphWidthEm: 0.72,
  maxLineHeightEm: 1.2,
  minimumFontSizePx: 48,
  maximumFontSizePx: 88,
  minimumLineHeight: 1,
  maximumLineHeight: 1.25,
};

const COMPATIBILITY_FINGERPRINT = hashMaulPlanPayload({
  family: "DM Sans",
  assetId: "font_google_dm_sans_700",
  weights: [500, 700, 800],
  ...COMPATIBILITY_METRICS,
});

const SOLID_PLATE_PRIMITIVE = {
  paddingXPx: 18,
  paddingYPx: 10,
  cornerRadiusPx: 6,
  backgroundColor: "#000000",
  minimumOpacity: 0.78,
} as const;

export const MAUL_TYPOGRAPHY_COMPATIBILITY_PROFILE = {
  profileId: "maul-compat-dm-sans-v1" as const,
  family: "DM Sans" as const,
  approvedFontAssets: [
    {
      assetId: "font_google_dm_sans_700" as const,
      family: "DM Sans" as const,
      weights: [500, 700, 800] as const,
    },
  ] as const,
  loadedFallback: {
    assetId: "font_google_dm_sans_700" as const,
    family: "DM Sans" as const,
    weight: 700 as const,
  },
  metrics: {
    fingerprint: COMPATIBILITY_FINGERPRINT,
    ...COMPATIBILITY_METRICS,
  },
};

export const assertMaulTypographyPlacementCompatibility = ({
  placementPlan: inputPlacementPlan,
  selectedFamily,
  selectedAssetId,
  compiledMetrics,
}: {
  placementPlan: MaulTextPlacementPlanCore;
  selectedFamily: string;
  selectedAssetId: string | null;
  compiledMetrics: {maxGlyphWidthEm: number; maxLineHeightEm: number};
}): void => {
  const placementPlan = maulTextPlacementPlanCoreSchema.parse(
    inputPlacementPlan,
  );
  const profile = placementPlan.compatibilityProfiles[0]!;
  if (selectedFamily !== profile.family) {
    throw new Error(
      `Typography family ${selectedFamily} is outside placement profile ${profile.profileId}.`,
    );
  }
  if (
    !selectedAssetId ||
    !profile.approvedFontAssets.some(
      (asset) => asset.assetId === selectedAssetId,
    )
  ) {
    throw new Error(
      `Typography asset ${selectedAssetId ?? "null"} is not approved by placement profile ${profile.profileId}.`,
    );
  }
  if (
    compiledMetrics.maxGlyphWidthEm > profile.metrics.maxGlyphWidthEm ||
    compiledMetrics.maxLineHeightEm > profile.metrics.maxLineHeightEm
  ) {
    throw new Error(
      "Compiled typography metrics exceed the reserved placement envelope.",
    );
  }
};

const CATALOG = {
  catalogId: "maul-placement-catalog-three-family-v1",
  version: "1",
  families: ["editorial", "measured", "personal"],
  variants: [
    "editorial.subject_opposite_v1",
    "measured.centered_statement_v1",
    "personal.lower_dialogue_v1",
    "caption_safe_fallback.padded_band_v1",
  ],
} as const;

const SCORE_DIMENSION_WEIGHTS = {
  readability: 0.28,
  subjectRelationship: 0.22,
  opticalBalance: 0.14,
  semanticCompatibility: 0.16,
  continuity: 0.12,
  fallbackCost: 0.08,
};

const SCORE_POLICY = {
  policyId: "maul-placement-score-policy-v1",
  version: "1",
  dimensionWeights: SCORE_DIMENSION_WEIGHTS,
  beamWidth: 4,
  planningHorizonSegments: 3,
} as const;

const boxesOverlap = (first: MaulNormalizedBox, second: MaulNormalizedBox) =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y;

const boxContains = (outer: MaulNormalizedBox, inner: MaulNormalizedBox) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

const intervalContains = (
  interval: MaulPlacementTimelineInterval,
  outputStartMs: number,
  outputEndMs: number,
) =>
  interval.outputStartMs <= outputStartMs &&
  interval.outputEndMs >= outputEndMs;

type LayoutNode = {
  nodeId: string;
  chunk: MaulTextChunkV2;
  outputStartMs: number;
  outputEndMs: number;
  compositions: MaulOutputCompositionInterval[];
};

type PlacementCandidate = {
  candidateId: string;
  baseObjective: number;
  segment: MaulTextPlacementSegment;
};

const stableId = (prefix: string, value: unknown) =>
  `${prefix}_${hashMaulPlanPayload(value).slice(0, 24)}`;

const sortedUniqueBoundaries = (boundaries: number[]) =>
  [...new Set(boundaries)].sort((left, right) => left - right);

const buildLayoutNodes = ({
  chunkPlan,
  compositionIntervals,
  observationIntervals,
  shotIntervals,
  timelineIntervals,
  geometryResetOutputMs,
}: {
  chunkPlan: MaulShortsTextChunkPlanV2Core;
  compositionIntervals: readonly MaulOutputCompositionInterval[];
  observationIntervals: readonly MaulPlacementObservationInterval[];
  shotIntervals: readonly MaulPlacementShotInterval[];
  timelineIntervals: readonly MaulPlacementTimelineInterval[];
  geometryResetOutputMs: readonly number[];
}): LayoutNode[] => {
  const tokenById = new Map(
    chunkPlan.tokens.map((token) => [token.tokenId, token]),
  );

  return chunkPlan.chunks.flatMap((chunk) => {
    const boundaries = sortedUniqueBoundaries([
      chunk.outputStartMs,
      chunk.outputEndMs,
      ...chunk.tokenIds.flatMap((tokenId) => {
        const token = tokenById.get(tokenId);
        return token
          ? token.outputSpans.flatMap((span) => [
              span.outputStartMs,
              span.outputEndMs,
            ])
          : [];
      }),
      ...compositionIntervals.flatMap((interval) => [
        interval.outputStartMs,
        interval.outputEndMs,
      ]),
      ...observationIntervals.flatMap((interval) => [
        interval.outputStartMs,
        interval.outputEndMs,
      ]),
      ...shotIntervals.flatMap((interval) => [
        interval.outputStartMs,
        interval.outputEndMs,
      ]),
      ...timelineIntervals.flatMap((interval) => [
        interval.outputStartMs,
        interval.outputEndMs,
      ]),
      ...geometryResetOutputMs,
    ]).filter(
      (boundary) =>
        boundary >= chunk.outputStartMs && boundary <= chunk.outputEndMs,
    );

    return boundaries.slice(0, -1).flatMap((outputStartMs, index) => {
      const outputEndMs = boundaries[index + 1]!;
      if (outputEndMs <= outputStartMs) return [];
      const timelineAllows = timelineIntervals.some((interval) =>
        intervalContains(interval, outputStartMs, outputEndMs),
      );
      if (!timelineAllows) return [];
      const activeShot = shotIntervals.find((interval) =>
        intervalContains(interval, outputStartMs, outputEndMs),
      );
      if (!activeShot) return [];
      const compositions = compositionIntervals
        .filter(
          (interval) =>
            intervalContains(interval, outputStartMs, outputEndMs) &&
            interval.sceneId === activeShot.sceneId &&
            interval.discontinuityId === activeShot.discontinuityId,
        )
        .sort((left, right) =>
          `${left.variantId}:${left.intervalId}`.localeCompare(
            `${right.variantId}:${right.intervalId}`,
          ),
        );
      if (compositions.length === 0) return [];
      return [
        {
          nodeId: stableId("layout_node", {
            chunkId: chunk.chunkId,
            outputStartMs,
            outputEndMs,
          }),
          chunk,
          outputStartMs,
          outputEndMs,
          compositions,
        },
      ];
    });
  }).sort(
    (left, right) =>
      left.outputStartMs - right.outputStartMs ||
      left.outputEndMs - right.outputEndMs ||
      left.nodeId.localeCompare(right.nodeId),
  );
};

const resolveObservation = ({
  composition,
  outputStartMs,
  outputEndMs,
  observationIntervals,
}: {
  composition: MaulOutputCompositionInterval;
  outputStartMs: number;
  outputEndMs: number;
  observationIntervals: readonly MaulPlacementObservationInterval[];
}): MaulPlacementObservationInterval | null => {
  const observation = observationIntervals.find(
    (interval) =>
      interval.sceneId === composition.sceneId &&
      intervalContains(interval, outputStartMs, outputEndMs),
  );
  if (!observation) return null;
  if (observation.trackingState !== "held" || observation.subjectBox) {
    return observation;
  }
  const previous = [...observationIntervals]
    .filter(
      (interval) =>
        interval.sceneId === composition.sceneId &&
        interval.outputEndMs <= outputStartMs &&
        Boolean(interval.subjectBox) &&
        (interval.trackingState === "tracked" ||
          interval.trackingState === "held"),
    )
    .sort((left, right) => right.outputEndMs - left.outputEndMs)[0];
  return previous?.subjectBox
    ? {...observation, subjectBox: previous.subjectBox}
    : observation;
};

const partitionLines = ({
  family,
  tokenIds,
  textByTokenId,
  segmentId,
}: {
  family: MaulPlacementFamily;
  tokenIds: readonly string[];
  textByTokenId: ReadonlyMap<string, string>;
  segmentId: string;
}) => {
  const maximumFirstLine =
    family === "editorial" ? Math.ceil(tokenIds.length / 2) : 4;
  const partitions =
    tokenIds.length <= maximumFirstLine
      ? [tokenIds]
      : [
          tokenIds.slice(0, Math.ceil(tokenIds.length / 2)),
          tokenIds.slice(Math.ceil(tokenIds.length / 2)),
        ];
  return partitions.map((lineTokenIds, index) => ({
    lineId: `${segmentId}_line_${index + 1}`,
    tokenIds: [...lineTokenIds],
    text: joinShortsTextTokens(
      lineTokenIds.map((tokenId) => textByTokenId.get(tokenId) ?? ""),
    ),
  }));
};

const geometryForFamily = ({
  family,
  subjectBox,
}: {
  family: MaulPlacementFamily;
  subjectBox: MaulNormalizedBox | null;
}): {
  box: MaulNormalizedBox;
  maximumEnvelope: MaulNormalizedBox;
  alignment: "left" | "center" | "right";
} => {
  if (family === "editorial") {
    const subjectCenter = subjectBox
      ? subjectBox.x + subjectBox.width / 2
      : 0.5;
    const box = {
      x: subjectCenter < 0.5 ? 0.58 : 0.08,
      y: 0.24,
      width: 0.32,
      height: 0.24,
    };
    return {
      box,
      maximumEnvelope: {
        x: box.x - 0.02,
        y: box.y - 0.02,
        width: box.width + 0.04,
        height: box.height + 0.04,
      },
      alignment: subjectCenter < 0.5 ? "left" : "right",
    };
  }
  if (family === "personal") {
    return {
      box: {x: 0.1, y: 0.72, width: 0.8, height: 0.14},
      maximumEnvelope: {x: 0.08, y: 0.7, width: 0.84, height: 0.18},
      alignment: "center",
    };
  }
  return {
    box: {x: 0.15, y: 0.62, width: 0.7, height: 0.14},
    maximumEnvelope: {x: 0.13, y: 0.6, width: 0.74, height: 0.18},
    alignment: "center",
  };
};

const linesFit = ({
  lines,
  box,
  fontSizePx,
  lineHeight,
  paddingXPx,
  paddingYPx,
}: {
  lines: Array<{text: string}>;
  box: MaulNormalizedBox;
  fontSizePx: number;
  lineHeight: number;
  paddingXPx: number;
  paddingYPx: number;
}) => {
  const availableWidthPx =
    box.width * PLATFORM_PROFILE.output.width - paddingXPx * 2;
  const availableHeightPx =
    box.height * PLATFORM_PROFILE.output.height - paddingYPx * 2;
  const longestWordWidthPx = Math.max(
    ...lines.flatMap((line) =>
      line.text.split(/\s+/u).map(
        (word) =>
          word.length *
          fontSizePx *
          COMPATIBILITY_METRICS.maxGlyphWidthEm,
      ),
    ),
  );
  const longestLineWidthPx = Math.max(
    ...lines.map(
      (line) => line.text.length * fontSizePx * 0.55,
    ),
  );
  const requiredHeightPx = lines.length * fontSizePx * lineHeight;
  return (
    longestWordWidthPx <= availableWidthPx &&
    longestLineWidthPx <= availableWidthPx &&
    requiredHeightPx <= availableHeightPx
  );
};

const gate = (
  gateId: string,
  passes: boolean,
  evidenceId: string | null,
  rationale: string,
) => ({
  gateId,
  status: passes ? ("pass" as const) : ("fail" as const),
  evidenceId,
  rationale,
});

const candidateObjective = (scores: Record<string, number>) =>
  Object.entries(SCORE_DIMENSION_WEIGHTS).reduce(
    (total, [dimension, weight]) =>
      total + (scores[dimension] ?? 0) * weight,
    0,
  );

const buildCandidate = ({
  node,
  composition,
  observation,
  family,
  textByTokenId,
}: {
  node: LayoutNode;
  composition: MaulOutputCompositionInterval;
  observation: MaulPlacementObservationInterval | null;
  family: MaulPlacementFamily;
  textByTokenId: ReadonlyMap<string, string>;
}): PlacementCandidate | null => {
  const isCaptionSafeFallback = composition.variantId.includes(
    "caption_safe_fallback",
  );
  if (isCaptionSafeFallback && family !== "personal") return null;

  const subjectIsKnown =
    observation?.trackingState === "tracked" ||
    (observation?.trackingState === "held" && Boolean(observation.subjectBox)) ||
    observation?.trackingState === "absent_confirmed";
  const evidenceIsKnown =
    observation?.cutEvidenceStatus === "known" && subjectIsKnown;
  const fallbackBand = composition.paddedNonSourceRegions[0] ?? null;
  if (!evidenceIsKnown && (!isCaptionSafeFallback || !fallbackBand)) {
    return null;
  }

  const subjectBox = observation?.subjectBox ?? null;
  if (
    family === "editorial" &&
    subjectBox &&
    Math.abs(subjectBox.x + subjectBox.width / 2 - 0.5) < 0.08
  ) {
    return null;
  }
  const geometry = isCaptionSafeFallback
    ? {
        box: fallbackBand!,
        maximumEnvelope: fallbackBand!,
        alignment: "center" as const,
      }
    : geometryForFamily({family, subjectBox});
  const segmentId = stableId("placement_segment", {
    chunkId: node.chunk.chunkId,
    discontinuityId: composition.discontinuityId,
    outputStartMs: node.outputStartMs,
    outputEndMs: node.outputEndMs,
  });
  const lines = partitionLines({
    family,
    tokenIds: node.chunk.tokenIds,
    textByTokenId,
    segmentId,
  });
  const nominalFontSizePx = isCaptionSafeFallback
    ? 48
    : family === "measured"
      ? 72
      : family === "editorial"
        ? 68
        : 64;
  const hierarchyScale = family === "editorial" ? 1.08 : 1;
  const effectiveFontSizePx = nominalFontSizePx * hierarchyScale;
  const lineHeight = 1.1;
  const variantId = isCaptionSafeFallback
    ? "caption_safe_fallback.padded_band_v1"
    : family === "measured"
      ? "measured.centered_statement_v1"
      : family === "editorial"
        ? "editorial.subject_opposite_v1"
        : "personal.lower_dialogue_v1";
  const minimumLegibilityPrimitive: MaulMinimumLegibilityPrimitive =
    family === "editorial"
      ? {kind: "outline", widthPx: 2, color: "#000000"}
      : family === "personal" || isCaptionSafeFallback
        ? {kind: "solid_plate", ...SOLID_PLATE_PRIMITIVE}
        : {
            kind: "shadow",
            blurPx: 10,
            offsetXPx: 0,
            offsetYPx: 3,
            color: "#000000",
            minimumOpacity: 0.72,
          };
  const paddingXPx =
    minimumLegibilityPrimitive.kind === "solid_plate"
      ? minimumLegibilityPrimitive.paddingXPx
      : 0;
  const paddingYPx =
    minimumLegibilityPrimitive.kind === "solid_plate"
      ? minimumLegibilityPrimitive.paddingYPx
      : 0;
  const hardGates = [
    gate(
      "exact_token_sequence",
      lines.flatMap((line) => line.tokenIds).join("\0") ===
        node.chunk.tokenIds.join("\0"),
      null,
      "Rendered lines retain the governed token sequence exactly.",
    ),
    gate(
      "platform_safe_envelope",
      boxContains(PLATFORM_PROFILE.safeRegion, geometry.maximumEnvelope),
      PLATFORM_PROFILE.profileId,
      "Maximum text envelope stays inside the versioned platform safe region.",
    ),
    gate(
      "typography_compatibility",
      effectiveFontSizePx >= COMPATIBILITY_METRICS.minimumFontSizePx &&
        effectiveFontSizePx <= COMPATIBILITY_METRICS.maximumFontSizePx,
      COMPATIBILITY_FINGERPRINT,
      "Pinned DM Sans metrics cover the selected effective typography.",
    ),
    gate(
      "minimum_readable_fit",
      linesFit({
        lines,
        box: geometry.box,
        fontSizePx: effectiveFontSizePx,
        lineHeight,
        paddingXPx,
        paddingYPx,
      }),
      COMPATIBILITY_FINGERPRINT,
      "Worst-case glyph and line metrics fit the selected box.",
    ),
    gate(
      "cut_evidence",
      evidenceIsKnown || isCaptionSafeFallback,
      observation?.evidenceId ?? composition.intervalId,
      isCaptionSafeFallback
        ? "Padded fallback does not claim source-pixel clearance."
        : "Declared cut evidence covers the full layout interval.",
    ),
    gate(
      "subject_clearance",
      isCaptionSafeFallback
        ? Boolean(
            fallbackBand && boxContains(fallbackBand, geometry.maximumEnvelope),
          )
        : !subjectBox || !boxesOverlap(geometry.maximumEnvelope, subjectBox),
      observation?.evidenceId ?? composition.intervalId,
      isCaptionSafeFallback
        ? "Text lies wholly inside a compiled non-source band."
        : "Maximum envelope clears known subject occupancy.",
    ),
    gate(
      "existing_text_clearance",
      isCaptionSafeFallback ||
        !(observation?.existingTextRegions ?? []).some((region) =>
          boxesOverlap(geometry.maximumEnvelope, region),
        ),
      observation?.evidenceId ?? null,
      "Maximum envelope avoids known existing-text occupancy.",
    ),
    gate(
      "discontinuity_containment",
      intervalContains(composition, node.outputStartMs, node.outputEndMs),
      composition.intervalId,
      "Layout segment is contained by one compiled transform interval.",
    ),
  ];
  if (hardGates.some((result) => result.status !== "pass")) return null;

  const hasSubject = Boolean(subjectBox);
  const scores = {
    readability: isCaptionSafeFallback ? 0.78 : family === "measured" ? 0.96 : 0.9,
    subjectRelationship:
      family === "editorial" && hasSubject
        ? 0.98
        : family === "measured"
          ? 0.84
          : 0.72,
    opticalBalance: family === "measured" ? 0.94 : family === "editorial" ? 0.9 : 0.82,
    semanticCompatibility:
      node.chunk.semanticRole === "proof" && family === "measured"
        ? 0.96
        : family === "editorial"
          ? 0.9
          : 0.76,
    continuity: 0.8,
    fallbackCost: isCaptionSafeFallback ? 0.35 : 1,
  };
  const fallbackCode = isCaptionSafeFallback
    ? "caption_safe_fallback"
    : null;
  const candidateId = stableId("placement_candidate", {
    segmentId,
    compositionVariantId: composition.variantId,
    family,
    variantId,
  });

  return {
    candidateId,
    baseObjective: candidateObjective(scores),
    segment: {
      segmentId,
      chunkId: node.chunk.chunkId,
      sceneId: composition.sceneId,
      discontinuityId: composition.discontinuityId,
      outputStartMs: node.outputStartMs,
      outputEndMs: node.outputEndMs,
      selectedCompositionVariantId: composition.variantId,
      selectedTransformHash: composition.transformHash,
      tokenIds: [...node.chunk.tokenIds],
      lines,
      family,
      variantId,
      box: geometry.box,
      maximumEnvelope: geometry.maximumEnvelope,
      alignment: geometry.alignment,
      compatibility: {
        profileId: "maul-compat-dm-sans-v1",
        metricsFingerprint: COMPATIBILITY_FINGERPRINT,
        nominalFontSizePx,
        lineHeight,
        hierarchyScale,
      },
      depth: {
        desired: "front",
        resolved: "front",
        treatmentState: "not_requested",
      },
      minimumLegibilityPrimitive,
      hardGates,
      scores,
      rationale: isCaptionSafeFallback
        ? "Unknown visual evidence selected the compiled non-source caption band."
        : `Deterministic ${family} candidate passed every hard gate and sequence policy.`,
      confidence: isCaptionSafeFallback ? 0.72 : 0.88,
      fallbackCode,
      fallbackReason: fallbackCode
        ? "Visual evidence could not authorize subject-aware source-pixel placement."
        : null,
    },
  };
};

type BeamState = {
  candidates: PlacementCandidate[];
  objective: number;
  sceneCompositions: Map<string, string>;
  pathKey: string;
};

const transitionAdjustment = (
  previous: PlacementCandidate | undefined,
  candidate: PlacementCandidate,
) => {
  if (
    !previous ||
    previous.segment.discontinuityId !== candidate.segment.discontinuityId
  ) {
    return 0;
  }
  const sameFamily = previous.segment.family === candidate.segment.family;
  const sameGeometry =
    hashMaulPlanPayload(previous.segment.box) ===
    hashMaulPlanPayload(candidate.segment.box);
  return (sameFamily ? 0.03 : -0.02) + (sameGeometry ? 0.04 : -0.03);
};

const selectCandidateSequence = (
  candidatesByNode: PlacementCandidate[][],
): PlacementCandidate[] | null => {
  let beam: BeamState[] = [
    {
      candidates: [],
      objective: 0,
      sceneCompositions: new Map(),
      pathKey: "",
    },
  ];
  for (const nodeCandidates of candidatesByNode) {
    const expanded = beam.flatMap((state) =>
      nodeCandidates.flatMap((candidate): BeamState[] => {
        const sceneComposition = state.sceneCompositions.get(
          candidate.segment.sceneId,
        );
        if (
          sceneComposition &&
          sceneComposition !== candidate.segment.selectedCompositionVariantId
        ) {
          return [];
        }
        const sceneCompositions = new Map(state.sceneCompositions);
        sceneCompositions.set(
          candidate.segment.sceneId,
          candidate.segment.selectedCompositionVariantId,
        );
        const pathKey = state.pathKey
          ? `${state.pathKey}:${candidate.candidateId}`
          : candidate.candidateId;
        return [
          {
            candidates: [...state.candidates, candidate],
            objective:
              state.objective +
              candidate.baseObjective +
              transitionAdjustment(state.candidates.at(-1), candidate),
            sceneCompositions,
            pathKey,
          },
        ];
      }),
    );
    beam = expanded
      .sort(
        (left, right) =>
          right.objective - left.objective ||
          left.pathKey.localeCompare(right.pathKey),
      )
      .slice(0, SCORE_POLICY.beamWidth);
    if (beam.length === 0) return null;
  }
  return beam[0]?.candidates ?? null;
};

export const buildMaulTextPlacementPlan = ({
  textChunkPlanArtifactId,
  textChunkPlan: inputChunkPlan,
  compositionIntervals: inputCompositionIntervals,
  observationIntervals: inputObservationIntervals,
  shotIntervals: inputShotIntervals,
  timelineIntervals: inputTimelineIntervals,
  geometryResetOutputMs = [],
  candidateFamilyOrder = ["measured", "editorial", "personal"],
  textChunkPlanHash: governedTextChunkPlanHash,
}: {
  textChunkPlanArtifactId: string;
  textChunkPlan: MaulShortsTextChunkPlanV2Core;
  compositionIntervals: readonly MaulOutputCompositionInterval[];
  observationIntervals: readonly MaulPlacementObservationInterval[];
  shotIntervals?: readonly MaulPlacementShotInterval[];
  timelineIntervals?: readonly MaulPlacementTimelineInterval[];
  geometryResetOutputMs?: readonly number[];
  candidateFamilyOrder?: readonly MaulPlacementFamily[];
  textChunkPlanHash?: string;
}): MaulTextPlacementPlanCore => {
  const textChunkPlan = maulShortsTextChunkPlanV2CoreSchema.parse(inputChunkPlan);
  const compositionIntervals = [...inputCompositionIntervals].sort(
    (left, right) =>
      left.outputStartMs - right.outputStartMs ||
      left.outputEndMs - right.outputEndMs ||
      `${left.variantId}:${left.intervalId}`.localeCompare(
        `${right.variantId}:${right.intervalId}`,
      ),
  );
  const observationIntervals = [...inputObservationIntervals].sort(
    (left, right) =>
      left.outputStartMs - right.outputStartMs ||
      left.outputEndMs - right.outputEndMs ||
      left.evidenceId.localeCompare(right.evidenceId),
  );
  const shotIntervals = inputShotIntervals
    ? [...inputShotIntervals]
    : compositionIntervals
        .map((interval) => ({
          sceneId: interval.sceneId,
          discontinuityId: interval.discontinuityId,
          outputStartMs: interval.outputStartMs,
          outputEndMs: interval.outputEndMs,
        }))
        .filter(
          (interval, index, intervals) =>
            intervals.findIndex(
              (candidate) =>
                hashMaulPlanPayload(candidate) === hashMaulPlanPayload(interval),
            ) === index,
        );
  const timelineIntervals = inputTimelineIntervals
    ? [...inputTimelineIntervals]
    : [{outputStartMs: 0, outputEndMs: textChunkPlan.outputDurationMs}];
  const familyOrder = [...candidateFamilyOrder];
  if (
    familyOrder.length !== 3 ||
    new Set(familyOrder).size !== 3 ||
    familyOrder.some(
      (family) => !(["measured", "editorial", "personal"] as const).includes(family),
    )
  ) {
    throw new Error(
      "Candidate iteration must contain measured, editorial, and personal exactly once.",
    );
  }

  const nodes = buildLayoutNodes({
    chunkPlan: textChunkPlan,
    compositionIntervals,
    observationIntervals,
    shotIntervals,
    timelineIntervals,
    geometryResetOutputMs,
  });
  const textByTokenId = new Map(
    textChunkPlan.tokens.map((token) => [token.tokenId, token.text]),
  );
  const candidatesByNode = nodes.map((node) =>
    node.compositions
      .flatMap((composition) => {
        const observation = resolveObservation({
          composition,
          outputStartMs: node.outputStartMs,
          outputEndMs: node.outputEndMs,
          observationIntervals,
        });
        return familyOrder.flatMap((family) => {
          const candidate = buildCandidate({
            node,
            composition,
            observation,
            family,
            textByTokenId,
          });
          return candidate ? [candidate] : [];
        });
      })
      .sort((left, right) => left.candidateId.localeCompare(right.candidateId)),
  );
  const selected =
    nodes.length > 0 && candidatesByNode.every((candidates) => candidates.length)
      ? selectCandidateSequence(candidatesByNode)
      : null;

  const catalogHash = hashMaulPlanPayload(CATALOG);
  const scorePolicyHash = hashMaulPlanPayload(SCORE_POLICY);
  const textChunkPlanHash =
    governedTextChunkPlanHash ?? hashMaulPlanPayload(textChunkPlan);
  const outputCompositionTrackHash = hashMaulPlanPayload(compositionIntervals);
  const platformProfileHash = hashMaulPlanPayload(PLATFORM_PROFILE);
  const compatibilityProfileHash = hashMaulPlanPayload(
    MAUL_TYPOGRAPHY_COMPATIBILITY_PROFILE,
  );
  const status = selected ? ("planned" as const) : ("blocked" as const);

  return maulTextPlacementPlanCoreSchema.parse({
    schemaVersion: "maul-text-placement-plan/v1",
    textChunkPlanArtifactId,
    textChunkPlanHash,
    catalog: {
      catalogId: CATALOG.catalogId,
      version: CATALOG.version,
      hash: catalogHash,
    },
    scorePolicy: {
      policyId: SCORE_POLICY.policyId,
      version: SCORE_POLICY.version,
      hash: scorePolicyHash,
      dimensionWeights: SCORE_DIMENSION_WEIGHTS,
      beamWidth: SCORE_POLICY.beamWidth,
      planningHorizonSegments: SCORE_POLICY.planningHorizonSegments,
    },
    platformProfile: PLATFORM_PROFILE,
    compatibilityProfiles: [MAUL_TYPOGRAPHY_COMPATIBILITY_PROFILE],
    compositionIntervals,
    status,
    blockingReason: selected
      ? null
      : "blocked_no_readable_dialogue_candidate",
    segments: selected?.map((candidate) => candidate.segment) ?? [],
    inputHashes: {
      textChunkPlan: textChunkPlanHash,
      outputCompositionTrack: outputCompositionTrackHash,
      platformProfile: platformProfileHash,
      compatibilityProfile: compatibilityProfileHash,
      catalog: catalogHash,
      scorePolicy: scorePolicyHash,
    },
  });
};
