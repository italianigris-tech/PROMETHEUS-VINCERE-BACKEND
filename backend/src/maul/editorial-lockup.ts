import {
  maulEditorialLockupSchema,
  type MaulEditorialLockup,
  type MaulResolvedFontAsset,
  type MaulShortsTextChunkPlanV2Core,
  type MaulTextPlacementPlanCore,
} from "@prometheus/shared-types";

type LockupFont = {
  assetId: string;
  family: string;
  weight: number;
  style: "normal" | "italic" | "oblique";
};

type MaulEditorialFontResolution = {
  selectedAssetId: string;
  selectedFamily: string;
  selectedAsset?: MaulResolvedFontAsset | null;
  accentAsset?: MaulResolvedFontAsset | null;
};

const fontFromReceipt = (asset: MaulResolvedFontAsset): LockupFont => ({
  assetId: asset.assetId,
  family: asset.family,
  weight: asset.weight,
  style: asset.style,
});

export const buildMaulEditorialFontPair = ({
  fontResolution,
  fallbackPrimary,
}: {
  fontResolution: MaulEditorialFontResolution;
  fallbackPrimary: LockupFont;
}): {primary: LockupFont; accent: LockupFont | null} => ({
  primary: fontResolution.selectedAsset
    ? fontFromReceipt(fontResolution.selectedAsset)
    : {
        ...fallbackPrimary,
        assetId: fontResolution.selectedAssetId,
        family: fontResolution.selectedFamily,
      },
  accent: fontResolution.accentAsset
    ? fontFromReceipt(fontResolution.accentAsset)
    : null,
});

type RhythmSegment = {
  segmentId: string;
  preserveReadableHold: boolean;
};

type EditorialLockupInput = {
  segment: {
    segmentId: string;
    tokenIds: readonly string[];
    emphasisTokenIds?: readonly string[];
    semanticHierarchyRoles?: Readonly<Record<string, "hero" | "support" | "accent" | "tail">>;
    outputStartMs: number;
    outputEndMs: number;
    semanticRole: string;
    emphasisLevel: "support" | "key" | "hero";
    holdAcrossProtectedPause: boolean;
  };
  primaryFont: LockupFont;
  accentFont: LockupFont | null | undefined;
  selectionSeed: string;
  referenceTraits: readonly string[];
};

const normalizedTraits = (traits: readonly string[]) =>
  traits.join(" ").toLowerCase();

const styleFor = ({
  tokenId,
  role,
  font,
  offsetXPx = 0,
  offsetYPx = 0,
  fontSizeScale = 1,
  rotationDeg = 0,
  zIndex = 1,
}: {
  tokenId: string;
  role: "primary" | "accent";
  font: LockupFont;
  offsetXPx?: number;
  offsetYPx?: number;
  fontSizeScale?: number;
  rotationDeg?: number;
  zIndex?: number;
}) => ({
  tokenId,
  role,
  fontAssetId: font.assetId,
  fontFamily: font.family,
  fontStyle: font.style,
  fontWeight: font.weight,
  offsetXPx,
  offsetYPx,
  fontSizeScale,
  rotationDeg,
  zIndex,
  opacity: 1,
});

export const buildMaulEditorialLockup = (
  input: EditorialLockupInput,
): MaulEditorialLockup => {
  if (input.segment.tokenIds.length === 0) {
    throw new Error(`Editorial lockup ${input.segment.segmentId} has no tokens.`);
  }

  const durationMs = input.segment.outputEndMs - input.segment.outputStartMs;
  const traits = normalizedTraits(input.referenceTraits);
  const hasEditorialSignal = /script|cursive|calligraph|serif|italic|hinge|phrase|lockup/.test(traits);
  const canComposeOverlap =
    input.accentFont !== null &&
    input.accentFont !== undefined &&
    input.segment.tokenIds.length >= 2 &&
    durationMs >= 420 &&
    (hasEditorialSignal || input.segment.emphasisLevel !== "support");
  const preferredAccentTokenId = input.segment.emphasisTokenIds
    ?.filter((tokenId) => input.segment.tokenIds.includes(tokenId))
    .at(-1);
  const explicitHierarchyTokenId = input.segment.tokenIds.find((tokenId) =>
    input.segment.semanticHierarchyRoles?.[tokenId] === "hero",
  ) ?? input.segment.tokenIds.find((tokenId) =>
    input.segment.semanticHierarchyRoles?.[tokenId] === "accent",
  );
  const accentTokenId = canComposeOverlap
    ? explicitHierarchyTokenId ?? preferredAccentTokenId ?? input.segment.tokenIds[input.segment.tokenIds.length - 1]!
    : null;
  const primaryTokenIds = accentTokenId
    ? input.segment.tokenIds.filter((tokenId) => tokenId !== accentTokenId)
    : [...input.segment.tokenIds];
  const accentTokenIds = accentTokenId ? [accentTokenId] : [];
  const accent = input.accentFont;
  const emphasisStyle = {
    hero: {primaryScale: 1.24, accentScale: 1.72, offsetY: 46, overlapRatio: 0.3},
    key: {primaryScale: 1.12, accentScale: 1.48, offsetY: 32, overlapRatio: 0.26},
    support: {primaryScale: 1, accentScale: 1.16, offsetY: 12, overlapRatio: 0.2},
  }[input.segment.emphasisLevel];
  const durationFactor = durationMs >= 1200 ? 1 : durationMs >= 720 ? 0.94 : 0.86;
  const primaryScale = Number((1 + (emphasisStyle.primaryScale - 1) * durationFactor).toFixed(2));
  const accentScale = Number((1 + (emphasisStyle.accentScale - 1) * durationFactor).toFixed(2));
  const offsetY = Math.round(emphasisStyle.offsetY * durationFactor);
  const overlapRatio = Number((emphasisStyle.overlapRatio * durationFactor).toFixed(2));
  const tokenStyles = [
    ...primaryTokenIds.map((tokenId) => styleFor({
      tokenId,
      role: "primary",
      font: input.primaryFont,
      fontSizeScale: primaryScale,
    })),
    ...(accentTokenId && accent
      ? [styleFor({
          tokenId: accentTokenId,
          role: "accent",
          font: accent,
          offsetXPx: input.segment.emphasisLevel === "hero" ? -14 : -12,
          offsetYPx: offsetY,
          fontSizeScale: accentScale,
          rotationDeg: input.segment.emphasisLevel === "hero" ? -2 : -3,
          zIndex: 2,
        })]
      : []),
  ];
  const staggerMs = canComposeOverlap
    ? Math.min(96, Math.max(36, Math.floor(durationMs / (input.segment.tokenIds.length * 5))))
    : 0;
  const lockup = {
    schemaVersion: "maul-editorial-lockup/v1" as const,
    mode: canComposeOverlap ? "script_tag_overlap" as const : "single_line_hinge" as const,
    primaryTokenIds,
    accentTokenIds,
    tokenStyles,
    overlap: {
      enabled: canComposeOverlap,
      ratio: canComposeOverlap ? overlapRatio : 0,
      direction: canComposeOverlap ? "accent_over_primary" as const : "none" as const,
      rationale: canComposeOverlap
        ? "The accent hinge overlaps the display phrase only after the measured duration and font pairing pass."
        : "The segment is rendered as a clean measured line because its duration or source traits do not justify a layered overlap.",
    },
    choreography: {
      mode: "forward_word_reveal" as const,
      tokenOrder: [...input.segment.tokenIds],
      staggerMs,
      entryDurationMs: Math.min(180, Math.max(1, Math.floor(durationMs / 8))),
    },
    rationale: canComposeOverlap
      ? `Reference-derived ${input.segment.semanticRole} lockup using ${accent?.family} as the semantic hinge; seed ${input.selectionSeed}.`
      : `Measured forward word reveal for ${input.segment.semanticRole}; overlap withheld because the composition did not clear its duration and reference gates.`,
  };
  return maulEditorialLockupSchema.parse(lockup);
};

export const applyMaulEditorialLockups = ({
  placementPlan,
  textChunkPlan,
  rhythm,
  primaryFont,
  accentFont,
  referenceTraits,
  selectionSeed,
  semanticHierarchyRolesByChunkId,
}: {
  placementPlan: Pick<MaulTextPlacementPlanCore, "segments">;
  textChunkPlan: Pick<MaulShortsTextChunkPlanV2Core, "chunks">;
  rhythm: {segments: readonly RhythmSegment[]};
  primaryFont: LockupFont;
  accentFont: LockupFont | null | undefined;
  referenceTraits: readonly string[];
  selectionSeed: string;
  semanticHierarchyRolesByChunkId?: Readonly<
    Record<string, Readonly<Record<string, "hero" | "support" | "accent" | "tail">>>
  >;
}): Pick<MaulTextPlacementPlanCore, "segments"> => {
  const chunkById = new Map(textChunkPlan.chunks.map((chunk) => [chunk.chunkId, chunk]));
  const rhythmBySegmentId = new Map(rhythm.segments.map((segment) => [segment.segmentId, segment]));
  return {
    segments: placementPlan.segments.map((segment) => {
      const chunk = chunkById.get(segment.chunkId);
      if (!chunk) {
        throw new Error(`Editorial lockup ${segment.segmentId} references missing chunk ${segment.chunkId}.`);
      }
      const rhythmSegment = rhythmBySegmentId.get(segment.segmentId);
      const editorialLockup = buildMaulEditorialLockup({
        segment: {
          segmentId: segment.segmentId,
          tokenIds: segment.tokenIds,
          emphasisTokenIds: chunk.emphasis.tokenIds,
          semanticHierarchyRoles: semanticHierarchyRolesByChunkId?.[chunk.chunkId],
          outputStartMs: segment.outputStartMs,
          outputEndMs: segment.outputEndMs,
          semanticRole: chunk.semanticRole,
          emphasisLevel: chunk.emphasis.level,
          holdAcrossProtectedPause: rhythmSegment?.preserveReadableHold ?? chunk.holdAcrossProtectedPause,
        },
        primaryFont,
        accentFont,
        selectionSeed: `${selectionSeed}:${segment.segmentId}`,
        referenceTraits,
      });
      return {...segment, editorialLockup};
    }),
  };
};
