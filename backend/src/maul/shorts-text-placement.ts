import {
  joinShortsTextTokens,
  maulShortsTextChunkPlanV2CoreSchema,
  maulTextPlacementPlanCoreSchema,
  type MaulMinimumLegibilityPrimitive,
  type MaulNormalizedBox,
  type MaulOutputCompositionInterval,
  type MaulProfileTypographyRealization,
  type MaulShortsTextChunkPlanV2Core,
  type MaulTextChunkV2,
  type MaulTypographyCompatibilityProfile,
  type MaulTextPlacementPlanCore,
  type MaulTextPlacementSegment,
} from "@prometheus/shared-types";

import {hashMaulPlanPayload} from "./text-chunk-plan.js";
import type {MaulMeasuredTypographyLayout} from "./typography-layout.js";
import {selectTypographyProfilePlacement} from "./typography-profile-placement.js";
import {
  averageLuminanceForBox,
  resolveTypographyProfileColors,
  resolveTypographyProfileColorsAcrossSamples,
} from "./typography-profile-contrast.js";

export type MaulPlacementFamily = "measured" | "editorial" | "personal";

export type MaulBackgroundLuminanceGrid = {
  columns: number;
  rows: number;
  samples: readonly number[];
};

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
  faceBox?: MaulNormalizedBox | null;
  cutEvidenceStatus: "known" | "unknown";
  existingTextRegions: readonly MaulNormalizedBox[];
  backgroundLuminance?: number;
  backgroundLuminanceGrid?: MaulBackgroundLuminanceGrid;
  backgroundLuminanceGrids?: readonly MaulBackgroundLuminanceGrid[];
  requiresTemporalContrast?: boolean;
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
  profileId,
}: {
  placementPlan: MaulTextPlacementPlanCore;
  selectedFamily: string;
  selectedAssetId: string | null;
  compiledMetrics: {maxGlyphWidthEm: number; maxLineHeightEm: number};
  profileId?: string;
}): void => {
  const placementPlan = maulTextPlacementPlanCoreSchema.parse(
    inputPlacementPlan,
  );
  const profile = profileId
    ? placementPlan.compatibilityProfiles.find(
        (candidate) => candidate.profileId === profileId,
      )
    : placementPlan.compatibilityProfiles[0];
  if (!profile) {
    throw new Error(
      `Typography placement profile ${profileId ?? "default"} is unavailable.`,
    );
  }
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
  readability: 0.24,
  subjectRelationship: 0.2,
  opticalBalance: 0.13,
  semanticCompatibility: 0.14,
  creativeDirectionFit: 0.1,
  continuity: 0.11,
  fallbackCost: 0.08,
};

const LEGACY_SCORE_POLICY = {
  policyId: "maul-placement-score-policy-v1",
  version: "1",
  dimensionWeights: SCORE_DIMENSION_WEIGHTS,
  beamWidth: 4,
  planningHorizonSegments: 3,
} as const;

const SCORE_POLICY = LEGACY_SCORE_POLICY;

const boxesOverlap = (first: MaulNormalizedBox, second: MaulNormalizedBox) =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y;

const boxContains = (outer: MaulNormalizedBox, inner: MaulNormalizedBox) =>
  inner.x >= outer.x - 0.000001 &&
  inner.y >= outer.y - 0.000001 &&
  inner.x + inner.width <= outer.x + outer.width + 0.000001 &&
  inner.y + inner.height <= outer.y + outer.height + 0.000001;

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

export type MaulPlacementTypography = {
  profile: MaulTypographyCompatibilityProfile;
  layouts: readonly MaulMeasuredTypographyLayout[];
} | {
  byChunkId: Readonly<Record<string, {
    profile: MaulTypographyCompatibilityProfile;
    layout: MaulMeasuredTypographyLayout;
    realization?: MaulProfileTypographyRealization;
  }>>;
};

const resolvePlacementTypography = (
  typography: MaulPlacementTypography | undefined,
  chunkId: string,
): {
  profile: MaulTypographyCompatibilityProfile;
  layout: MaulMeasuredTypographyLayout;
  realization?: MaulProfileTypographyRealization;
} | null => {
  if (!typography) return null;
  if ("byChunkId" in typography) return typography.byChunkId[chunkId] ?? null;
  const layout = typography.layouts.find((candidate) => candidate.chunkId === chunkId);
  return layout ? {profile: typography.profile, layout} : null;
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
  return chunkPlan.chunks.flatMap((chunk) => {
    const boundaries = sortedUniqueBoundaries([
      chunk.outputStartMs,
      chunk.outputEndMs,
      ...compositionIntervals.flatMap((interval) => [
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

const lineBreakWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const allLinePartitions = (
  tokenIds: readonly string[],
  maximumLines: number,
): string[][][] => {
  const partitions: string[][][] = [];
  const visit = (start: number, lines: string[][]): void => {
    if (start === tokenIds.length) {
      partitions.push(lines);
      return;
    }
    if (lines.length === maximumLines) return;
    for (let end = start + 1; end <= tokenIds.length; end += 1) {
      visit(end, [...lines, [...tokenIds.slice(start, end)]]);
    }
  };
  visit(0, []);
  return partitions;
};

const lineBreakPenalty = (lines: Array<{text: string}>): number =>
  lines.reduce((penalty, line, index) => {
    const words = line.text.toLowerCase().split(/\s+/u).filter(Boolean);
    const first = words[0] ?? "";
    const last = words.at(-1) ?? "";
    return penalty +
      (index > 0 && lineBreakWords.has(first) ? 3 : 0) +
      (index < lines.length - 1 && lineBreakWords.has(last) ? 3 : 0) +
      (words.length === 1 && lineBreakWords.has(first) ? 5 : 0);
  }, 0);

const partitionLines = ({
  family,
  tokenIds,
  textByTokenId,
  segmentId,
  maximumLines,
  geometry,
  fontSizePx,
  lineHeight,
  paddingXPx,
  paddingYPx,
  measuredLayout,
}: {
  family: MaulPlacementFamily;
  tokenIds: readonly string[];
  textByTokenId: ReadonlyMap<string, string>;
  segmentId: string;
  maximumLines: number;
  geometry: MaulNormalizedBox;
  fontSizePx: number;
  lineHeight: number;
  paddingXPx: number;
  paddingYPx: number;
  measuredLayout?: MaulMeasuredTypographyLayout;
}) => {
  if (measuredLayout) {
    let tokenCursor = 0;
    const measuredLines = measuredLayout.lines.map((line, index) => {
      const lineTokenIds: string[] = [];
      let matchedText = "";
      while (tokenCursor < tokenIds.length) {
        const tokenId = tokenIds[tokenCursor]!;
        const tokenText = textByTokenId.get(tokenId) ?? "";
        const nextText = joinShortsTextTokens([matchedText, tokenText]);
        if (nextText.trim() === line.text.trim()) {
          lineTokenIds.push(tokenId);
          tokenCursor += 1;
          matchedText = nextText;
          break;
        }
        if (nextText.length > line.text.trim().length) return null;
        lineTokenIds.push(tokenId);
        tokenCursor += 1;
        matchedText = nextText;
      }
      if (matchedText.trim() !== line.text.trim()) return null;
      return {
        lineId: `${segmentId}_line_${index + 1}`,
        tokenIds: lineTokenIds,
        text: line.text,
        measuredWidthPx: line.widthPx * fontSizePx / measuredLayout.fontSizePx,
      };
    });
    if (
      measuredLines.some((line) => line === null) ||
      tokenCursor !== tokenIds.length ||
      measuredLines.length > maximumLines
    ) {
      return null;
    }
    const lines = measuredLines as Array<{
      lineId: string;
      tokenIds: string[];
      text: string;
      measuredWidthPx: number;
    }>;
    if (!linesFit({
      lines,
      box: geometry,
      fontSizePx,
      lineHeight,
      paddingXPx,
      paddingYPx,
      measuredWidthsPx: lines.map((line) => line.measuredWidthPx),
    })) return null;
    return lines.map(({measuredWidthPx: _measuredWidthPx, ...line}) => line);
  }
  const candidates = allLinePartitions(tokenIds, maximumLines)
    .map((partition) => partition.map((lineTokenIds, index) => ({
      lineId: `${segmentId}_line_${index + 1}`,
      tokenIds: [...lineTokenIds],
      text: joinShortsTextTokens(
        lineTokenIds.map((tokenId) => textByTokenId.get(tokenId) ?? ""),
      ),
    })))
    .filter((lines) => linesFit({
      lines,
      box: geometry,
      fontSizePx,
      lineHeight,
      paddingXPx,
      paddingYPx,
    }));
  if (candidates.length === 0) return null;

  return candidates.sort((left, right) => {
    const widths = (lines: typeof left) => lines.map((line) => line.text.length);
    const score = (lines: typeof left) => {
      const values = widths(lines);
      const widest = Math.max(...values);
      const narrowest = Math.min(...values);
      return (widest === 0 ? 0 : (narrowest / widest) * 2) -
        lineBreakPenalty(lines) -
        (lines.length - 1) * 0.05;
    };
    const delta = score(right) - score(left);
    if (delta !== 0) return delta;
    return left.map((line) => line.text).join("\0").localeCompare(
      right.map((line) => line.text).join("\0"),
    );
  })[0]!;
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

const familyForCompositionDirection = (
  direction: MaulOutputCompositionInterval["compositionDirection"],
): MaulPlacementFamily | null => {
  if (direction === "poster_hero") return "measured";
  if (direction === "restrained_minimal") return "personal";
  if (direction === "editorial_asymmetry" || direction === "subject_integrated") {
    return "editorial";
  }
  return null;
};

const linesFit = ({
  lines,
  box,
  fontSizePx,
  lineHeight,
  paddingXPx,
  paddingYPx,
  measuredWidthsPx,
}: {
  lines: Array<{text: string}>;
  box: MaulNormalizedBox;
  fontSizePx: number;
  lineHeight: number;
  paddingXPx: number;
  paddingYPx: number;
  measuredWidthsPx?: readonly number[];
}) => {
  const availableWidthPx =
    box.width * PLATFORM_PROFILE.output.width - paddingXPx * 2;
  const availableHeightPx =
    box.height * PLATFORM_PROFILE.output.height - paddingYPx * 2;
  const longestWordWidthPx = measuredWidthsPx
    ? Math.max(...measuredWidthsPx)
    : Math.max(
        ...lines.flatMap((line) =>
          line.text.split(/\s+/u).map(
            (word) =>
              word.length *
              fontSizePx *
              COMPATIBILITY_METRICS.maxGlyphWidthEm,
          ),
        ),
      );
  const longestLineWidthPx = measuredWidthsPx
    ? Math.max(...measuredWidthsPx)
    : Math.max(...lines.map((line) => line.text.length * fontSizePx * 0.55));
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
  typography,
}: {
  node: LayoutNode;
  composition: MaulOutputCompositionInterval;
  observation: MaulPlacementObservationInterval | null;
  family: MaulPlacementFamily;
  textByTokenId: ReadonlyMap<string, string>;
  typography?: MaulPlacementTypography;
}): PlacementCandidate | null => {
  const isCaptionSafeFallback = composition.variantId.includes(
    "caption_safe_fallback",
  );
  if (isCaptionSafeFallback && family !== "personal") return null;
  const chunkTypography = resolvePlacementTypography(
    typography,
    node.chunk.chunkId,
  );
  if (typography && !chunkTypography) return null;
  const profileRealization = chunkTypography?.realization;
  const directionFamily = familyForCompositionDirection(
    composition.compositionDirection,
  );
  if (!profileRealization && directionFamily && family !== directionFamily) {
    return null;
  }

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
  const faceBox = observation?.faceBox ?? null;
  if (
    family === "editorial" &&
    subjectBox &&
    !composition.textAnchor &&
    Math.abs(subjectBox.x + subjectBox.width / 2 - 0.5) < 0.08
  ) {
    return null;
  }
  const profilePlacement = profileRealization
    ? selectTypographyProfilePlacement({
      realization: profileRealization,
      subjectBox,
      faceBox,
      existingTextRegions: observation?.existingTextRegions ?? [],
        ...(composition.textAnchor
          ? {
              intent: {
                preferredBox: composition.textAnchor.box,
                overlapPolicy:
                  composition.textAnchor.subjectInteraction?.policy ??
                  "avoid_subject",
              },
            }
          : {}),
      })
    : null;
  const geometry = profilePlacement ?? (isCaptionSafeFallback
    ? {
        box: fallbackBand!,
        maximumEnvelope: fallbackBand!,
        alignment: "center" as const,
      }
    : composition.textAnchor ?? geometryForFamily({family, subjectBox}));
  const controlledOverlap =
    composition.textAnchor?.subjectInteraction?.policy === "controlled_overlap";
  const hasControlledFaceClearance = controlledOverlap && (
    faceBox
      ? !boxesOverlap(geometry.maximumEnvelope, faceBox)
      : composition.textAnchor?.subjectInteraction?.faceInterference === 0
  );
  const subjectClearance =
    !subjectBox ||
    !boxesOverlap(geometry.maximumEnvelope, subjectBox) ||
    hasControlledFaceClearance;
  const segmentId = stableId("placement_segment", {
    chunkId: node.chunk.chunkId,
    discontinuityId: composition.discontinuityId,
    outputStartMs: node.outputStartMs,
    outputEndMs: node.outputEndMs,
  });
  const measuredLayout = chunkTypography?.layout;
  const profile =
    chunkTypography?.profile ?? MAUL_TYPOGRAPHY_COMPATIBILITY_PROFILE;
  const preferredNominalFontSizePx = profileRealization
    ? Math.max(...profileRealization.layers.map((layer) => layer.fontSizePx))
    : isCaptionSafeFallback
    ? 48
    : measuredLayout
      ? measuredLayout.fontSizePx
      : family === "measured"
      ? 72
      : family === "editorial"
        ? 68
        : 64;
  const hierarchyScale = profileRealization
    ? profilePlacement!.transform.uniformScale
    : measuredLayout
    ? 1
    : family === "editorial"
      ? 1.08
      : 1;
  const lineHeight = 1.1;
  const variantId = profileRealization
    ? "profile.typography_group_v1"
    : isCaptionSafeFallback
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
  const candidateFontSizes = profileRealization
    ? [preferredNominalFontSizePx]
    : composition.textAnchor && !isCaptionSafeFallback
    ? [preferredNominalFontSizePx, 64, 56, 48]
        .map((size) => Math.min(profile.metrics.maximumFontSizePx, size) * hierarchyScale)
    : [preferredNominalFontSizePx * hierarchyScale];
  let effectiveFontSizePx = candidateFontSizes[0]!;
  let lines: ReturnType<typeof partitionLines> = null;
  for (const fontSizePx of candidateFontSizes) {
    if (profileRealization) {
      lines = profileRealization.layers.map((layer, index) => ({
        lineId: `${segmentId}_profile_line_${index + 1}`,
        tokenIds: [...layer.tokenIds],
        text: layer.text,
      }));
      break;
    }
    const candidateLines = partitionLines({
      family,
      tokenIds: node.chunk.tokenIds,
      textByTokenId,
      segmentId,
      maximumLines: composition.textAnchor && !isCaptionSafeFallback ? 3 : 2,
      geometry: geometry.box,
      fontSizePx,
      lineHeight,
      paddingXPx,
      paddingYPx,
      measuredLayout,
    });
    if (candidateLines) {
      effectiveFontSizePx = fontSizePx;
      lines = candidateLines;
      break;
    }
  }
  if (!lines) return null;
  const nominalFontSizePx = profileRealization
    ? effectiveFontSizePx
    : effectiveFontSizePx / hierarchyScale;
  const temporalBackgroundLuminances =
    profileRealization && profilePlacement
      ? (observation?.backgroundLuminanceGrids ?? []).flatMap((grid) => {
          const sampled = averageLuminanceForBox({
            grid,
            box: profilePlacement.box,
          });
          return sampled === null ? [] : [sampled];
        })
      : [];
  const temporalColorResolution = profileRealization
    ? resolveTypographyProfileColorsAcrossSamples({
        realization: profileRealization,
        backgroundLuminances: temporalBackgroundLuminances,
      })
    : null;
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
    ...(profileRealization
      ? [gate(
          "profile_realization_geometry",
          profilePlacement!.transform.finalWidthPx <=
            PLATFORM_PROFILE.output.width * profileRealization.maxWidthPercent / 100 + 0.01 &&
            profilePlacement!.transform.finalHeightPx <=
            PLATFORM_PROFILE.output.height * PLATFORM_PROFILE.safeRegion.height + 0.01,
          profileRealization.layers[0]?.measurementId ?? null,
          "Authoritative profile layers reserve one measured group envelope before placement.",
        )]
      : [gate(
          "typography_compatibility",
          effectiveFontSizePx >= profile.metrics.minimumFontSizePx &&
            effectiveFontSizePx <= profile.metrics.maximumFontSizePx,
          profile.metrics.fingerprint,
          `Measured ${profile.family} metrics cover the selected effective typography.`,
        )]),
    ...(typography && measuredLayout
      ? [gate(
          "measured_font_geometry",
          measuredLayout.measurementIds.length > 0,
          measuredLayout.measurementIds[0] ?? null,
          `Final placement uses measured ${profile.family} line geometry.`,
        )]
      : []),
    gate(
      "minimum_readable_fit",
      profileRealization || measuredLayout
        ? true
        : linesFit({
            lines,
            box: geometry.box,
            fontSizePx: effectiveFontSizePx,
            lineHeight,
            paddingXPx,
            paddingYPx,
          }),
      measuredLayout?.measurementIds[0] ?? profile.metrics.fingerprint,
      "Measured or governed glyph and line metrics fit the selected box.",
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
      profileRealization
        ? subjectClearance
        : isCaptionSafeFallback
        ? Boolean(
            fallbackBand && boxContains(fallbackBand, geometry.maximumEnvelope),
          )
        : subjectClearance,
      composition.textAnchor?.subjectInteraction?.evidenceIds[0] ??
        observation?.evidenceId ??
        composition.intervalId,
      profileRealization
        ? hasControlledFaceClearance
          ? "Profile placement overlaps measured body occupancy while its final envelope clears the detected face."
          : "Profile placement clears known subject occupancy."
        : isCaptionSafeFallback
        ? "Text lies wholly inside a compiled non-source band."
        : hasControlledFaceClearance
          ? "Controlled overlap clears the detected face in the final text envelope."
        : !subjectBox || !boxesOverlap(geometry.maximumEnvelope, subjectBox)
          ? "Maximum envelope clears known subject occupancy."
          : "Controlled overlap is explicitly authorized by measured face-clearance evidence.",
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
    ...(profileRealization && observation?.requiresTemporalContrast
      ? [gate(
          "temporal_contrast",
          temporalBackgroundLuminances.length > 0 &&
            temporalColorResolution?.readable === true,
          observation.evidenceId,
          "One static chunk color remains readable across every sampled observed frame.",
        )]
      : []),
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
    creativeDirectionFit: composition.variantId.includes('creative_preferred')
      ? 1
      : 0.5,
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
      ...(profilePlacement ? {profileTransform: profilePlacement.transform} : {}),
      ...(profileRealization
        ? {
            profileColorResolution:
              (temporalBackgroundLuminances.length > 0
                ? temporalColorResolution!.resolution
                : undefined) ??
              resolveTypographyProfileColors({
                realization: profileRealization,
                backgroundLuminance:
                  (observation?.backgroundLuminanceGrid && profilePlacement
                    ? averageLuminanceForBox({
                        grid: observation.backgroundLuminanceGrid,
                        box: profilePlacement.box,
                      })
                    : null) ?? observation?.backgroundLuminance,
              }),
          }
        : {}),
      compatibility: {
        profileId: profile.profileId,
        metricsFingerprint: profile.metrics.fingerprint,
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
  typography,
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
  typography?: MaulPlacementTypography;
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
            typography,
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
  const selectedTypographyProfiles = typography
    ? "byChunkId" in typography
      ? [
          ...new Map(
            textChunkPlan.chunks.flatMap((chunk) => {
              const selectedProfile = typography.byChunkId[chunk.chunkId]?.profile;
              return selectedProfile
                ? [[selectedProfile.profileId, selectedProfile] as const]
                : [];
            }),
          ).values(),
        ]
      : [typography.profile]
    : [MAUL_TYPOGRAPHY_COMPATIBILITY_PROFILE];
  const compatibilityProfileHash = hashMaulPlanPayload(
    selectedTypographyProfiles,
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
    compatibilityProfiles: selectedTypographyProfiles,
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
