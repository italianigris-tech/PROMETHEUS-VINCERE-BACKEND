import {
  maulEditorialLockupSchema,
  type MaulEditorialLockup,
  type MaulResolvedFontAsset,
  type MaulShortsTextChunkPlanV2Core,
  type MaulTextPlacementPlanCore,
} from "@prometheus/shared-types";

import {
  selectReferenceTypographyGrammar,
} from "./reference-typography-policy.js";

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

export type MaulEditorialTokenMeasure = (input: {
  tokenId: string;
  text: string;
  font: LockupFont;
  fontSizePx: number;
}) => {widthPx: number; heightPx: number};

type PixelRect = {x: number; y: number; width: number; height: number};

const unionPixelRects = (rects: readonly PixelRect[]): PixelRect => {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return {x: left, y: top, width: right - left, height: bottom - top};
};

const transformedTokenRect = ({
  x,
  centerY,
  width,
  height,
  translateX,
  translateY,
  scale,
  rotationDeg,
  revealTranslateX,
  revealTranslateY,
  padding,
}: {
  x: number;
  centerY: number;
  width: number;
  height: number;
  translateX: number;
  translateY: number;
  scale: number;
  rotationDeg: number;
  revealTranslateX: number;
  revealTranslateY: number;
  padding: number;
}): PixelRect => {
  const radians = rotationDeg * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const points = [
    {x: 0, y: -height / 2},
    {x: width, y: -height / 2},
    {x: width, y: height / 2},
    {x: 0, y: height / 2},
  ].map((point) => ({
    x: x + translateX + point.x * scale * cosine - point.y * scale * sine,
    y: centerY + translateY + point.x * scale * sine + point.y * scale * cosine,
  }));
  const left = Math.min(...points.map((point) => point.x)) - revealTranslateX - padding;
  const top = Math.min(...points.map((point) => point.y)) - revealTranslateY - padding;
  const right = Math.max(...points.map((point) => point.x)) + revealTranslateX + padding;
  const bottom = Math.max(...points.map((point) => point.y)) + revealTranslateY + padding;
  return {x: left, y: top, width: right - left, height: bottom - top};
};

const normalizedBoxToPixels = (
  box: {x: number; y: number; width: number; height: number},
  output: {widthPx: number; heightPx: number},
): PixelRect => ({
  x: box.x * output.widthPx,
  y: box.y * output.heightPx,
  width: box.width * output.widthPx,
  height: box.height * output.heightPx,
});

const needsSpace = (previousText: string | null, text: string): boolean =>
  previousText !== null &&
  !/^[,.;:!?%)\]}]/u.test(text) &&
  !/[({\[]$/u.test(previousText);

export const compileMaulEditorialEnvelope = ({
  segment,
  tokenTextById,
  lockup,
  output,
  measureToken,
}: {
  segment: {
    segmentId: string;
    lines: readonly {tokenIds: readonly string[]}[];
    box: {x: number; y: number; width: number; height: number};
    maximumEnvelope: {x: number; y: number; width: number; height: number};
    alignment: "left" | "center" | "right";
    compatibility: {nominalFontSizePx: number; hierarchyScale: number; lineHeight: number};
  };
  tokenTextById: ReadonlyMap<string, string>;
  lockup: MaulEditorialLockup;
  output: {widthPx: number; heightPx: number};
  measureToken: MaulEditorialTokenMeasure;
}): {x: number; y: number; width: number; height: number} => {
  const boxPx = normalizedBoxToPixels(segment.box, output);
  const existingEnvelopePx = normalizedBoxToPixels(segment.maximumEnvelope, output);
  const styleByTokenId = new Map(lockup.tokenStyles.map((style) => [style.tokenId, style]));
  const baseFontSizePx = segment.compatibility.nominalFontSizePx *
    segment.compatibility.hierarchyScale;
  const lineHeightPx = baseFontSizePx * segment.compatibility.lineHeight;
  const totalLinesHeightPx = lineHeightPx * segment.lines.length;
  const firstLineCenterY = boxPx.y + (boxPx.height - totalLinesHeightPx) / 2 + lineHeightPx / 2;
  const reveal = lockup.choreography.localRevealEnvelope ?? {
    maxTranslateXPx: 0,
    maxTranslateYPx: 0,
    maxScaleDelta: 0,
    annotationPaddingPx: 0,
  };
  const annotationPaddingByTokenId = new Map<string, number>();
  for (const annotation of lockup.annotations ?? []) {
    for (const tokenId of annotation.tokenIds) {
      annotationPaddingByTokenId.set(
        tokenId,
        Math.max(annotationPaddingByTokenId.get(tokenId) ?? 0, annotation.paddingPx),
      );
    }
  }
  const renderedRects: PixelRect[] = [boxPx, existingEnvelopePx];
  segment.lines.forEach((line, lineIndex) => {
    const measured = line.tokenIds.map((tokenId) => {
      const style = styleByTokenId.get(tokenId);
      const text = tokenTextById.get(tokenId);
      if (!style || text === undefined) {
        throw new Error(`Editorial envelope ${segment.segmentId} is missing token style or text for ${tokenId}.`);
      }
      const font: LockupFont = {
        assetId: style.fontAssetId,
        family: style.fontFamily,
        weight: style.fontWeight,
        style: style.fontStyle,
      };
      return {tokenId, text, style, font, bounds: measureToken({tokenId, text, font, fontSizePx: baseFontSizePx})};
    });
    const spaceWidthPx = baseFontSizePx * 0.28;
    const lineWidthPx = measured.reduce((total, token, index) =>
      total + token.bounds.widthPx +
      (needsSpace(index > 0 ? measured[index - 1]!.text : null, token.text) ? spaceWidthPx : 0), 0);
    let cursorX = segment.alignment === "left"
      ? boxPx.x
      : segment.alignment === "right"
        ? boxPx.x + boxPx.width - lineWidthPx
        : boxPx.x + (boxPx.width - lineWidthPx) / 2;
    const centerY = firstLineCenterY + lineIndex * lineHeightPx;
    measured.forEach((token, index) => {
      if (needsSpace(index > 0 ? measured[index - 1]!.text : null, token.text)) {
        cursorX += spaceWidthPx;
      }
      const overlapOffsetXPx = lockup.overlap.enabled && token.style.role === "accent"
        ? -baseFontSizePx * lockup.overlap.ratio
        : 0;
      renderedRects.push(transformedTokenRect({
        x: cursorX,
        centerY,
        width: token.bounds.widthPx,
        height: token.bounds.heightPx,
        translateX: token.style.offsetXPx + overlapOffsetXPx,
        translateY: token.style.offsetYPx,
        scale: token.style.fontSizeScale + reveal.maxScaleDelta,
        rotationDeg: token.style.rotationDeg,
        revealTranslateX: reveal.maxTranslateXPx,
        revealTranslateY: reveal.maxTranslateYPx,
        padding: Math.max(
          reveal.annotationPaddingPx,
          annotationPaddingByTokenId.get(token.tokenId) ?? 0,
        ),
      }));
      cursorX += token.bounds.widthPx;
    });
  });
  const union = unionPixelRects(renderedRects);
  if (
    union.x < 0 || union.y < 0 ||
    union.x + union.width > output.widthPx ||
    union.y + union.height > output.heightPx
  ) {
    throw new Error(`Editorial envelope ${segment.segmentId} leaves the output frame after final accent geometry.`);
  }
  const round = (value: number) => Number(value.toFixed(6));
  return {
    x: round(union.x / output.widthPx),
    y: round(union.y / output.heightPx),
    width: round(union.width / output.widthPx),
    height: round(union.height / output.heightPx),
  };
};

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
  const policyTraits = [
    ...input.referenceTraits,
    ...(/script|cursive|calligraph/.test(traits) ? ["script_overlay", "shared_anchor"] : []),
    ...(/serif|italic|hinge/.test(traits) ? ["editorial_italic_hinge", "inline_contrast"] : []),
    ...(/phrase|hierarch|stack/.test(traits) ? ["support_over_hero", "tight_stack"] : []),
  ];
  const grammar = selectReferenceTypographyGrammar({
    tokenCount: input.segment.tokenIds.length,
    emphasisLevel: input.segment.emphasisLevel,
    traits: policyTraits,
    seed: input.selectionSeed,
  });
  const accentScale = grammar.id === "script_over_foundation"
    ? {hero: 1.18, key: 1.12, support: 1.05}[input.segment.emphasisLevel]
    : grammar.id === "inline_italic_hinge"
      ? {hero: 1.1, key: 1.06, support: 1.02}[input.segment.emphasisLevel]
      : grammar.id === "stacked_support_hero"
        ? {hero: 1.08, key: 1.04, support: 1}[input.segment.emphasisLevel]
        : {hero: 1.04, key: 1.02, support: 1}[input.segment.emphasisLevel];
  const overlapRatio = canComposeOverlap
    ? grammar.id === "script_over_foundation" ? 0.14 : 0.1
    : 0;
  const tokenStyles = [
    ...primaryTokenIds.map((tokenId) => styleFor({
      tokenId,
      role: "primary",
      font: input.primaryFont,
      fontSizeScale: 1,
    })),
    ...(accentTokenId && accent
      ? [styleFor({
          tokenId: accentTokenId,
          role: "accent",
          font: accent,
          fontSizeScale: accentScale,
          rotationDeg: 0,
          zIndex: 2,
        })]
      : []),
  ];
  const staggerMs = canComposeOverlap
    ? Math.min(96, Math.max(36, Math.floor(durationMs / (input.segment.tokenIds.length * 5))))
    : 0;
  const lockup = {
    schemaVersion: "maul-editorial-lockup/v2" as const,
    mode: canComposeOverlap ? "script_tag_overlap" as const : "single_line_hinge" as const,
    referenceGrammarId: grammar.id,
    caseMode: grammar.caseMode,
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
      mode: "position_locked_word_reveal" as const,
      tokenOrder: [...input.segment.tokenIds],
      staggerMs,
      entryDurationMs: Math.min(180, Math.max(1, Math.floor(durationMs / 8))),
      localRevealEnvelope: {
        maxTranslateXPx: 0,
        maxTranslateYPx: 0,
        maxScaleDelta: 0.04,
        annotationPaddingPx: 12,
      },
    },
    placement: {
      mode: "position_locked" as const,
      anchor: "word_box" as const,
      finalTransformIdentity: true as const,
    },
    annotations: [],
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
  fontPairByChunkId,
  referenceTraits,
  selectionSeed,
  semanticHierarchyRolesByChunkId,
  output,
  measureToken,
}: {
  placementPlan: Pick<MaulTextPlacementPlanCore, "segments">;
  textChunkPlan: Pick<MaulShortsTextChunkPlanV2Core, "chunks" | "tokens">;
  rhythm: {segments: readonly RhythmSegment[]};
  primaryFont: LockupFont;
  accentFont: LockupFont | null | undefined;
  fontPairByChunkId?: Readonly<Record<string, {
    primary: LockupFont;
    accent: LockupFont | null;
  }>>;
  referenceTraits: readonly string[];
  selectionSeed: string;
  semanticHierarchyRolesByChunkId?: Readonly<
    Record<string, Readonly<Record<string, "hero" | "support" | "accent" | "tail">>>
  >;
  output?: {widthPx: number; heightPx: number};
  measureToken?: MaulEditorialTokenMeasure;
}): Pick<MaulTextPlacementPlanCore, "segments"> => {
  const chunkById = new Map(textChunkPlan.chunks.map((chunk) => [chunk.chunkId, chunk]));
  const tokenTextById = new Map(textChunkPlan.tokens.map((token) => [token.tokenId, token.text]));
  const rhythmBySegmentId = new Map(rhythm.segments.map((segment) => [segment.segmentId, segment]));
  return {
    segments: placementPlan.segments.map((segment) => {
      const chunk = chunkById.get(segment.chunkId);
      if (!chunk) {
        throw new Error(`Editorial lockup ${segment.segmentId} references missing chunk ${segment.chunkId}.`);
      }
      const rhythmSegment = rhythmBySegmentId.get(segment.segmentId);
      const chunkFontPair = fontPairByChunkId?.[chunk.chunkId] ?? {
        primary: primaryFont,
        accent: accentFont ?? null,
      };
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
        primaryFont: chunkFontPair.primary,
        accentFont: chunkFontPair.accent,
        selectionSeed: `${selectionSeed}:${segment.segmentId}`,
        referenceTraits,
      });
      if (editorialLockup.accentTokenIds.length === 0) {
        return {...segment, editorialLockup};
      }
      if (!output || !measureToken) {
        throw new Error(
          `Editorial lockup ${segment.segmentId} cannot measure its accent geometry.`,
        );
      }
      const maximumEnvelope = compileMaulEditorialEnvelope({
        segment,
        tokenTextById,
        lockup: editorialLockup,
        output,
        measureToken,
      });
      return {...segment, maximumEnvelope, editorialLockup};
    }),
  };
};
