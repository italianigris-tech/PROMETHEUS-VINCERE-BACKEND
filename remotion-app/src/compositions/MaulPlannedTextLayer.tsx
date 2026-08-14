import {loadFont as loadLocalFont} from "@remotion/fonts";
import {
  evaluateMaulFrameMotion,
  joinShortsTextTokens,
  type MaulArtDirectionPlanPayload,
  type MaulEditorialLockup,
  type MaulEditorialLockupTokenStyle,
  type MaulTextAnimationProgram,
  type MaulTextAnimationTransform,
} from "@prometheus/shared-types";
import React from "react";
import {
  Easing,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import {SvgCaptionOverlayAtFrame} from "../components/SvgCaptionOverlay";
import {
  SVG_TYPOGRAPHY_LAYOUT_VARIANT,
  SVG_TYPOGRAPHY_PROFILE_ID,
  getSvgSlotSchemaForWordCount,
  getSvgTypographyVariant,
  toSvgTypographyMotionKey,
  toSvgTypographyStyleKey,
} from "../lib/stylebooks/svg-typography-v1";
import type {CaptionChunk} from "../lib/types";
import {
  compileMaulLegibilityPrimitive,
  toMaulFrameInterval,
  type MaulPlannedTextRecord,
  type MaulPlannedTextToken,
} from "./maul-short-manifest-adapter";
import {resolveMaulFontAssetUrl} from "./maul-font-asset-resolver";
import {
  maulFrameMotionStyle,
  maulLetterStaggerFrame,
  resolveMaulFrameMotionForToken,
} from "./maul-frame-motion-renderer";
export {resolveMaulKineticTokenText} from "./maul-kinetic-text-renderer";
import {resolveMaulKineticTokenText} from "./maul-kinetic-text-renderer";
import {MaulProfileTypographyGroup} from "./MaulProfileTypographyGroup";

const dmSansFamily = "DM Sans";
const playfairDisplayFamily = "Playfair Display";
const bebasNeueFamily = "Bebas Neue";
const dmSerifDisplayFamily = "DM Serif Display";
const greatVibesFamily = "Great Vibes";

if (typeof FontFace !== "undefined") {
  void Promise.all([
    loadLocalFont({
      family: dmSansFamily,
      url: staticFile("fonts/maul/dm-sans-700.woff2"),
      weight: "700",
    }),
    loadLocalFont({
      family: playfairDisplayFamily,
      url: staticFile("fonts/maul/playfair-display-700.woff2"),
      weight: "700",
    }),
    loadLocalFont({
      family: playfairDisplayFamily,
      url: staticFile("fonts/maul/playfair-display-italic-700.woff2"),
      weight: "700",
      style: "italic",
    }),
    loadLocalFont({
      family: bebasNeueFamily,
      url: staticFile("fonts/maul/bebas-neue-400.woff2"),
      weight: "400",
    }),
    loadLocalFont({
      family: dmSerifDisplayFamily,
      url: staticFile("fonts/maul/dm-serif-display-400.woff2"),
      weight: "400",
    }),
    loadLocalFont({
      family: greatVibesFamily,
      url: staticFile("fonts/maul/great-vibes-400.ttf"),
      weight: "400",
    }),
  ]);
}

type MaulCreativeTreatment = MaulArtDirectionPlanPayload['creativeTreatment'];
type MaulReferenceEditorialRhythm =
  MaulArtDirectionPlanPayload['referenceEditorialRhythm'];

const MAUL_FONT_ASSETS = {
  "font_google_dm_sans_700": {
    family: dmSansFamily,
    weight: 700,
  },
  "font_google_playfair_display_700": {
    family: playfairDisplayFamily,
    weight: 700,
  },
  "font_google_playfair_display_italic_700": {
    family: playfairDisplayFamily,
    weight: 700,
  },
  "font_google_bebas_neue_400": {
    family: bebasNeueFamily,
    weight: 400,
  },
  "font_google_dm_serif_display_400": {
    family: dmSerifDisplayFamily,
    weight: 400,
  },
  "font_google_great_vibes_400": {
    family: greatVibesFamily,
    weight: 400,
  },
} as const;

const renderedFamilyFor = (family: string): string => {
  switch (family) {
    case "DM Sans": return dmSansFamily;
    case "Bebas Neue": return bebasNeueFamily;
    case "DM Serif Display": return dmSerifDisplayFamily;
    case "Great Vibes": return greatVibesFamily;
    case "Playfair Display": return playfairDisplayFamily;
    default: return family;
  }
};

const renderedFontFor = ({
  assetId,
  family,
  cssFamily,
  weight,
  style,
  browserUrl,
}: {
  assetId: string;
  family: string;
  cssFamily?: string;
  weight?: number;
  style?: "normal" | "italic" | "oblique";
  browserUrl?: string;
}) => {
  if (cssFamily && browserUrl && weight) {
    return {assetId, family: cssFamily, weight, style: style ?? "normal", browserUrl};
  }
  const bundled = MAUL_FONT_ASSETS[assetId as keyof typeof MAUL_FONT_ASSETS];
  if (bundled) {
    return {assetId, ...bundled, style: style ?? "normal" as const};
  }
  return {
    assetId,
    family: renderedFamilyFor(family),
    weight: weight,
    style: style ?? "normal",
    browserUrl,
  };
};

const accentFontFor = (
  record: MaulPlannedTextRecord,
  rhythm: MaulReferenceEditorialRhythm | undefined,
) => {
  if (record.accentFont) {
    return renderedFontFor({
      assetId: record.accentFont.assetId,
      family: record.accentFont.family,
      cssFamily: record.accentFont.cssFamily,
      weight: record.accentFont.weight,
      style: record.accentFont.style,
      browserUrl: record.accentFont.browserUrl,
    });
  }
  if (rhythm?.fontSystemId === "serif_editorial_hinge") {
    return renderedFontFor({
      assetId: "font_google_great_vibes_400",
      ...MAUL_FONT_ASSETS.font_google_great_vibes_400,
    });
  }
  return renderedFontFor({
    assetId: "font_google_playfair_display_italic_700",
    ...MAUL_FONT_ASSETS.font_google_playfair_display_italic_700,
    style: "italic",
  });
};

const loadedPlannedFontKeys = new Set<string>();

export const resolveMaulFontBrowserUrl = (
  browserUrl: string,
  resolveStaticAsset: (assetPath: string) => string = staticFile,
): string => {
  return resolveMaulFontAssetUrl(browserUrl, resolveStaticAsset);
};

const ensurePlannedFontLoaded = ({
  assetId,
  family,
  weight,
  style,
  browserUrl,
}: {
  assetId: string;
  family: string;
  weight?: number;
  style?: "normal" | "italic" | "oblique";
  browserUrl?: string;
}): void => {
  if (typeof FontFace === "undefined" || !browserUrl || !weight) return;
  const key = `${assetId}:${browserUrl}:${weight}:${style ?? "normal"}`;
  if (loadedPlannedFontKeys.has(key)) return;
  loadedPlannedFontKeys.add(key);
  void loadLocalFont({
    family,
    url: resolveMaulFontBrowserUrl(browserUrl),
    weight: String(weight),
    style: style ?? "normal",
  });
};

const MAUL_CINEMATIC_TREATMENT_IDS = new Set([
  "cinematic_text_preset",
  "cinematic_text_preset_1",
  "cinematic_text_preset_2",
  "cinematic_text_preset_3",
  "cinematic_text_preset_4",
  "cinematic_text_preset_5",
  "cinematic_text_preset_6",
  "cinematic_text_preset_7",
  "cinematic_text_preset_8",
  "cinematic_text_preset_9",
  "cinematic_text_preset_10",
  "cinematic_text_preset_11",
] as const);

const FALLBACK_CINEMATIC_TREATMENT_BY_WORD_COUNT = {
  one: "cinematic_text_preset_1",
  two: "cinematic_text_preset_2",
  three: "cinematic_text_preset_7",
  fourPlus: "cinematic_text_preset_10",
} as const;

const needsSpaceBeforeToken = (
  previous: MaulPlannedTextToken,
  current: MaulPlannedTextToken,
) =>
  joinShortsTextTokens([previous.text, current.text]) ===
  `${previous.text.trim()} ${current.text.trim()}`;

const resolveRenderableCinematicTreatment = ({
  requestedTreatment,
  wordCount,
}: {
  requestedTreatment: string;
  wordCount: number;
}): string => {
  const requestedVariant = getSvgTypographyVariant(requestedTreatment);
  const requiredSlotSchema = getSvgSlotSchemaForWordCount(wordCount);
  if (requestedVariant?.slotSchema === requiredSlotSchema) {
    return requestedTreatment;
  }
  if (wordCount <= 1) return FALLBACK_CINEMATIC_TREATMENT_BY_WORD_COUNT.one;
  if (wordCount === 2) return FALLBACK_CINEMATIC_TREATMENT_BY_WORD_COUNT.two;
  if (wordCount === 3) return FALLBACK_CINEMATIC_TREATMENT_BY_WORD_COUNT.three;
  return FALLBACK_CINEMATIC_TREATMENT_BY_WORD_COUNT.fourPlus;
};

export const buildMaulCinematicCaptionChunk = ({
  record,
  requestedTreatment,
}: {
  record: MaulPlannedTextRecord;
  requestedTreatment: string;
}): {chunk: CaptionChunk; treatment: string} => {
  const tokens = record.lines.flatMap((line) => line.tokens);
  const treatment = resolveRenderableCinematicTreatment({
    requestedTreatment,
    wordCount: tokens.length,
  });
  const emphasisTokenIds = new Set(
    (record.animationPrograms ?? [])
      .filter((program) => program.target.scope === "tokens")
      .flatMap((program) => program.target.tokenIds),
  );
  const words = tokens.map((token) => ({
    text: token.text,
    startMs:
      token.outputSpans.length > 0
        ? Math.min(...token.outputSpans.map((span) => span.outputStartMs))
        : record.outputStartMs,
    endMs:
      token.outputSpans.length > 0
        ? Math.max(...token.outputSpans.map((span) => span.outputEndMs))
        : record.outputEndMs,
    confidence: 1,
  }));

  return {
    treatment,
    chunk: {
      id: record.segmentId,
      text: joinShortsTextTokens(tokens.map((token) => token.text)),
      startMs: record.outputStartMs,
      endMs: record.outputEndMs,
      words,
      styleKey: toSvgTypographyStyleKey(treatment),
      motionKey: toSvgTypographyMotionKey(treatment),
      layoutVariant: SVG_TYPOGRAPHY_LAYOUT_VARIANT,
      emphasisWordIndices: tokens.flatMap((token, index) =>
        emphasisTokenIds.has(token.tokenId) ? [index] : [],
      ),
      profileId: SVG_TYPOGRAPHY_PROFILE_ID,
      semantic: {
        intent: emphasisTokenIds.size > 0 ? "punch-emphasis" : "default",
        nameSpans: [],
        isVariation: true,
        suppressDefault: true,
      },
      suppressDefault: true,
    },
  };
};

const interpolateTransform = ({
  from,
  to,
  progress,
}: {
  from: MaulTextAnimationTransform;
  to: MaulTextAnimationTransform;
  progress: number;
}): MaulTextAnimationTransform => ({
  opacity: from.opacity + (to.opacity - from.opacity) * progress,
  translateXPx:
    from.translateXPx + (to.translateXPx - from.translateXPx) * progress,
  translateYPx:
    from.translateYPx + (to.translateYPx - from.translateYPx) * progress,
  scale: from.scale + (to.scale - from.scale) * progress,
});

const resolvePhaseTransform = ({
  phase,
  outputTimeMs,
}: {
  phase: MaulTextAnimationProgram["phases"]["entry"];
  outputTimeMs: number;
}): MaulTextAnimationTransform => {
  const linearProgress = Math.max(
    0,
    Math.min(
      1,
      (outputTimeMs - phase.outputStartMs) /
        (phase.outputEndMs - phase.outputStartMs),
    ),
  );
  const progress =
    phase.easing.type === "linear"
      ? linearProgress
      : Easing.bezier(
          phase.easing.x1,
          phase.easing.y1,
          phase.easing.x2,
          phase.easing.y2,
        )(linearProgress);
  return interpolateTransform({from: phase.from, to: phase.to, progress});
};

export const resolveMaulTextAnimationTransform = ({
  program,
  outputFrame,
  fps,
}: {
  program: MaulTextAnimationProgram;
  outputFrame: number;
  fps: number;
}): MaulTextAnimationTransform => {
  const outputTimeMs = (outputFrame / fps) * 1000;
  const {entry, hold, exit} = program.phases;
  if (outputTimeMs < entry.outputStartMs) return entry.from;
  if (outputTimeMs <= entry.outputEndMs) {
    return resolvePhaseTransform({phase: entry, outputTimeMs});
  }
  if (outputTimeMs < hold.outputStartMs) return entry.to;
  if (outputTimeMs <= hold.outputEndMs) {
    return resolvePhaseTransform({phase: hold, outputTimeMs});
  }
  if (outputTimeMs < exit.outputStartMs) return hold.to;
  if (outputTimeMs <= exit.outputEndMs) {
    return resolvePhaseTransform({phase: exit, outputTimeMs});
  }
  return exit.to;
};

const animationStyle = (transform: MaulTextAnimationTransform) => ({
  opacity: transform.opacity,
  transform: `translate3d(${transform.translateXPx}px, ${transform.translateYPx}px, 0) scale(${transform.scale})`,
  transformOrigin: "center center",
});

const lockupStyleFor = (
  lockup: MaulEditorialLockup | undefined,
  tokenId: string,
): MaulEditorialLockupTokenStyle | undefined =>
  lockup?.tokenStyles.find((style) => style.tokenId === tokenId);

export const resolveMaulEditorialWordTransform = ({
  lockup,
  tokenId,
  absoluteTimeMs,
  segmentStartMs,
  fontSizePx,
}: {
  lockup: MaulEditorialLockup;
  tokenId: string;
  absoluteTimeMs: number;
  segmentStartMs: number;
  fontSizePx: number;
}) => {
  const orderIndex = lockup.choreography.tokenOrder.indexOf(tokenId);
  const style = lockupStyleFor(lockup, tokenId);
  if (orderIndex < 0 || !style) return null;
  const revealStart = segmentStartMs + orderIndex * lockup.choreography.staggerMs;
  const revealEnd = revealStart + lockup.choreography.entryDurationMs;
  const progress = Math.max(
    0,
    Math.min(1, (absoluteTimeMs - revealStart) / Math.max(1, revealEnd - revealStart)),
  );
  const overlapOffsetXPx =
    lockup.overlap.enabled && style.role === "accent"
      ? -fontSizePx * lockup.overlap.ratio
      : 0;
  return {
    opacity: style.opacity * progress,
    translateXPx: style.offsetXPx + overlapOffsetXPx,
    translateYPx: style.offsetYPx,
    scale: style.fontSizeScale,
    rotationDeg: style.rotationDeg,
  };
};

export type MaulEditorialWordTransform = {
  opacity: number;
  translateXPx: number;
  translateYPx: number;
  scale: number;
  rotationDeg: number;
};

export type MaulTextSuppressionRange = {
  outputStartMs: number;
  outputEndMs: number;
};

export const composeMaulTextTransforms = ({
  editorial,
  animation,
}: {
  editorial: MaulEditorialWordTransform | null;
  animation: MaulTextAnimationTransform | null;
}): MaulEditorialWordTransform | null => {
  if (!editorial && !animation) return null;
  if (!editorial) {
    return {
      ...animation!,
      rotationDeg: 0,
    };
  }
  if (!animation) return editorial;
  return {
    opacity: editorial.opacity * animation.opacity,
    translateXPx: editorial.translateXPx + animation.translateXPx,
    translateYPx: editorial.translateYPx + animation.translateYPx,
    scale: editorial.scale * animation.scale,
    rotationDeg: editorial.rotationDeg,
  };
};

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));

const localRevealStyle = ({
  program,
  tokenIndex,
  letterIndex,
  absoluteTimeMs,
}: {
  program: MaulTextAnimationProgram;
  tokenIndex: number;
  letterIndex: number;
  absoluteTimeMs: number;
}): React.CSSProperties => {
  const reveal = program.localReveal;
  if (!reveal) return {};
  const revealStartMs =
    program.phases.entry.outputStartMs +
    Math.max(0, tokenIndex) * reveal.tokenStaggerMs +
    Math.max(0, letterIndex) * reveal.letterStaggerMs;
  const progress = clampUnit(
    (absoluteTimeMs - revealStartMs) / Math.max(1, reveal.durationMs),
  );
  const eased = 1 - Math.pow(1 - progress, 3);
  const remaining = 1 - eased;
  const scale = reveal.startScale + (1 - reveal.startScale) * eased;
  return {
    opacity: eased,
    transform: `scale(${scale})`,
    transformOrigin: "left center",
    ...(reveal.primitive === "blur" || reveal.primitive === "blur_tracking"
      ? {filter: `blur(${(reveal.blurPx * remaining).toFixed(3)}px)`}
      : {}),
    ...(reveal.primitive === "clip"
      ? {clipPath: `inset(0 ${(remaining * 100).toFixed(3)}% 0 0)`}
      : {}),
    ...(reveal.primitive === "blur_tracking"
      ? {letterSpacing: `${(-reveal.trackingEm * remaining).toFixed(4)}em`}
      : {}),
  };
};

const PositionLockedTokenText: React.FC<{
  token: MaulPlannedTextToken;
  program: MaulTextAnimationProgram;
  absoluteTimeMs: number;
}> = ({token, program, absoluteTimeMs}) => {
  const reveal = program.localReveal!;
  const tokenIndex = Math.max(0, program.target.tokenIds.indexOf(token.tokenId));
  const letters = Array.from(token.text);
  return (
    <>
      <span
        data-maul-reserved-token-geometry="true"
        aria-hidden="true"
        style={{visibility: "hidden"}}
      >
        {token.text}
      </span>
      <span
        aria-hidden="true"
        style={{position: "absolute", inset: 0, whiteSpace: "nowrap"}}
      >
        {reveal.unit === "letter" ? letters.map((letter, letterIndex) => (
          <span
            key={`${token.tokenId}:${letterIndex}`}
            data-maul-letter-index={letterIndex}
            style={{
              display: "inline-block",
              ...localRevealStyle({
                program,
                tokenIndex,
                letterIndex,
                absoluteTimeMs,
              }),
            }}
          >
            {letter}
          </span>
        )) : (
          <span style={{
            display: "inline-block",
            ...localRevealStyle({
              program,
              tokenIndex,
              letterIndex: 0,
              absoluteTimeMs,
            }),
          }}>
            {token.text}
          </span>
        )}
      </span>
    </>
  );
};

const annotationStyle = ({
  kind,
  paddingPx,
}: {
  kind: NonNullable<MaulEditorialLockup["annotations"]>[number]["kind"];
  paddingPx: number;
}): React.CSSProperties => {
  const inset = -paddingPx;
  const common: React.CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    boxSizing: "border-box",
  };
  if (kind === "circle") {
    return {...common, inset, border: "2px solid currentColor", borderRadius: "50%"};
  }
  if (kind === "highlight") {
    return {...common, inset, backgroundColor: "currentColor", opacity: 0.16, zIndex: -1};
  }
  if (kind === "strike_through") {
    return {...common, left: inset, right: inset, top: "50%", borderTop: "2px solid currentColor"};
  }
  if (kind === "arrow") {
    return {...common, right: inset, bottom: inset, width: 18, borderTop: "2px solid currentColor", transform: "rotate(-35deg)", transformOrigin: "right center"};
  }
  return {...common, left: inset, right: inset, bottom: inset, borderBottom: "2px solid currentColor"};
};

export const MaulPlannedTextCard: React.FC<{
  record: MaulPlannedTextRecord;
  absoluteTimeMs: number;
  outputFrame?: number;
  fps?: number;
  textColor: string;
  accentColor: string;
  creativeTreatment?: MaulCreativeTreatment;
  referenceEditorialRhythm?: MaulReferenceEditorialRhythm;
  suppressedOutputRanges?: readonly MaulTextSuppressionRange[];
  visibleTokenIds?: ReadonlySet<string>;
}> = ({
  record,
  absoluteTimeMs,
  outputFrame,
  fps,
  textColor,
  accentColor,
  creativeTreatment,
  referenceEditorialRhythm,
  suppressedOutputRanges = [],
  visibleTokenIds,
}) => {
  if (suppressedOutputRanges.some(
    (range) =>
      range.outputStartMs <= absoluteTimeMs &&
      range.outputEndMs > absoluteTimeMs,
  )) {
    return null;
  }
  const animationPrograms = record.animationPrograms?.length
    ? record.animationPrograms
    : record.animationProgram ? [record.animationProgram] : [];
  const resolvedAnimations =
    creativeTreatment?.motionMode !== 'static_editorial_hold' &&
    outputFrame !== undefined && fps !== undefined
    ? animationPrograms.map((program) => ({
        program,
        transform: resolveMaulTextAnimationTransform({program, outputFrame, fps}),
      }))
    : [];
  const segmentAnimation = resolvedAnimations.find(
    ({program}) => program.target.scope === "segment",
  )?.transform ?? null;
  if (record.profileRealization || record.profileTransform) {
    return (
      <MaulProfileTypographyGroup
        record={record}
        segmentAnimation={segmentAnimation}
        outputFrame={creativeTreatment?.motionMode === "static_editorial_hold" ? undefined : outputFrame}
        visibleTokenIds={visibleTokenIds}
      />
    );
  }
  const requestedCinematicTreatment = animationPrograms.find((program) =>
    program.frameMotion === undefined &&
    MAUL_CINEMATIC_TREATMENT_IDS.has(
      program.treatment as (typeof MAUL_CINEMATIC_TREATMENT_IDS extends Set<infer T>
        ? T
        : never),
    ),
  )?.treatment;
  if (
    requestedCinematicTreatment &&
    !creativeTreatment &&
    outputFrame !== undefined &&
    fps !== undefined
  ) {
    const cinematic = buildMaulCinematicCaptionChunk({
      record,
      requestedTreatment: requestedCinematicTreatment,
    });
    return (
      <div
        data-maul-placement-segment={record.segmentId}
        data-placement-family={record.family}
        data-placement-variant={record.variantId}
        data-placement-fallback={record.fallbackCode ?? "none"}
        data-legibility-primitive="cinematic_transparent"
        data-requested-text-animation-treatment={requestedCinematicTreatment}
        data-text-animation-treatment={cinematic.treatment}
        style={{
          position: "absolute",
          left: record.boxPx.leftPx,
          top: record.boxPx.topPx,
          width: record.boxPx.widthPx,
          height: record.boxPx.heightPx,
          overflow: "visible",
          color: textColor,
        }}
      >
        <SvgCaptionOverlayAtFrame
          chunks={[cinematic.chunk]}
          frame={outputFrame}
          fps={fps}
        />
      </div>
    );
  }

  const primitive = compileMaulLegibilityPrimitive(
    record.minimumLegibilityPrimitive,
  );
  const primaryFont = renderedFontFor(record.font);
  const accentFont = accentFontFor(record, referenceEditorialRhythm);
  ensurePlannedFontLoaded(primaryFont);
  ensurePlannedFontLoaded(accentFont);
  return (
    <div
      data-maul-placement-segment={record.segmentId}
      data-placement-family={record.family}
      data-placement-variant={record.variantId}
      data-placement-fallback={record.fallbackCode ?? "none"}
      data-legibility-primitive={primitive.kind}
      data-font-family={record.font.family}
      data-font-asset-id={record.font.assetId}
      data-font-profile-id={record.font.profileId}
      data-font-metrics-fingerprint={record.font.metricsFingerprint}
      data-primary-font-asset-id={record.font.assetId}
      data-primary-font-url={primaryFont.browserUrl}
      data-accent-font-asset-id={accentFont.assetId}
      data-accent-font-url={accentFont.browserUrl}
      data-reference-editorial-font-system={referenceEditorialRhythm?.fontSystemId}
      data-creative-treatment-profile={creativeTreatment?.profileId}
      data-primary-type-role={creativeTreatment?.primaryTypeRole}
      data-accent-type-role={creativeTreatment?.accentTypeRole}
      data-emphasis-mode={creativeTreatment?.emphasisMode}
      data-motion-mode={creativeTreatment?.motionMode}
      data-editorial-lockup-mode={record.editorialLockup?.mode}
      data-maul-case-mode={record.editorialLockup?.caseMode}
      data-editorial-overlap-ratio={record.editorialLockup?.overlap.ratio}
      data-editorial-choreography={record.editorialLockup?.choreography.mode}
      data-text-animation-treatment={animationPrograms.map((program) => program.treatment).join(",") || undefined}
      style={{
        position: "absolute",
        left: record.boxPx.leftPx,
        top: record.boxPx.topPx,
        width: record.boxPx.widthPx,
        height: record.boxPx.heightPx,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        overflow: record.editorialLockup?.overlap.enabled ? "visible" : "hidden",
        color: textColor,
        fontFamily: primaryFont.family,
        fontSize: record.font.fontSizePx * record.font.hierarchyScale,
        fontWeight: record.font.weight,
        lineHeight: record.font.lineHeight,
        letterSpacing: 0,
        textAlign: record.alignment,
        ...primitive.containerStyle,
        ...primitive.textStyle,
        ...(record.editorialLockup?.caseMode === "source_preserving"
          ? {textTransform: "none" as const}
          : {}),
        ...(segmentAnimation ? animationStyle(segmentAnimation) : {}),
      }}
    >
      {record.lines.map((line) => (
        <div
          key={line.lineId}
          data-maul-line-id={line.lineId}
          style={{whiteSpace: "nowrap"}}
        >
          {line.tokens.map((token, tokenIndex) => {
            const active = token.outputSpans.some(
              (span) =>
                span.outputStartMs <= absoluteTimeMs &&
                span.outputEndMs > absoluteTimeMs,
            );
            const resolvedTokenAnimation = resolvedAnimations.find(({program}) =>
              program.target.scope === "tokens" && program.target.tokenIds.includes(token.tokenId),
            );
            const resolvedFrameMotion = resolveMaulFrameMotionForToken({
              programs: animationPrograms,
              tokenId: token.tokenId,
              outputFrame,
            });
            const tokenAnimation = resolvedFrameMotion?.frameMotion.unit === "word"
              ? {
                  opacity: resolvedFrameMotion.transform.opacity,
                  translateXPx: resolvedFrameMotion.transform.translateXPx,
                  translateYPx: resolvedFrameMotion.transform.translateYPx,
                  scale: resolvedFrameMotion.transform.scale,
                }
              : resolvedTokenAnimation?.transform ?? null;
            const localRevealProgram = resolvedTokenAnimation?.program.localReveal
              ? resolvedTokenAnimation.program
              : null;
            const kineticProgram = animationPrograms.find((program) =>
              program.kineticTreatment?.evidence.tokenIds.includes(token.tokenId),
            );
            const renderedTokenText = resolveMaulKineticTokenText({
              sourceText: token.text,
              receipt: kineticProgram?.kineticTreatment,
              outputFrame,
              entryStartFrame: kineticProgram?.frameMotion?.phases.entry.startFrame ?? 0,
              entryEndFrame: kineticProgram?.frameMotion?.phases.entry.endFrame ?? 1,
            });
            const editorialStyle = lockupStyleFor(record.editorialLockup, token.tokenId);
            const editorialTransform = record.editorialLockup
              ? resolveMaulEditorialWordTransform({
                  lockup: record.editorialLockup,
                  tokenId: token.tokenId,
                  absoluteTimeMs,
                  segmentStartMs: record.outputStartMs,
                  fontSizePx: record.font.fontSizePx * record.font.hierarchyScale,
                })
              : null;
            const tokenFont = editorialStyle?.role === "accent"
              ? accentFont
              : primaryFont;
            const composedTokenTransform = composeMaulTextTransforms({
              editorial: editorialTransform,
              animation: tokenAnimation,
            });
            const annotations = (record.editorialLockup?.annotations ?? []).filter(
              (annotation) => annotation.tokenIds.includes(token.tokenId),
            );
            return (
              <React.Fragment key={token.tokenId}>
                {tokenIndex > 0 &&
                needsSpaceBeforeToken(line.tokens[tokenIndex - 1]!, token)
                  ? " "
                  : null}
                <span
                  data-maul-token-id={token.tokenId}
                  data-active={active}
                  data-maul-reveal-unit={localRevealProgram?.localReveal?.unit}
                  data-maul-frame-motion-executor={resolvedFrameMotion?.frameMotion.executorId}
                  data-maul-frame-motion-treatment={resolvedFrameMotion?.frameMotion.sourceTreatment}
                  data-maul-frame-motion-token={resolvedFrameMotion?.frameMotion.tokenId}
                  data-maul-frame-motion-unit={resolvedFrameMotion?.frameMotion.unit}
                  data-editorial-token-role={editorialStyle?.role}
                  data-editorial-font-asset-id={editorialStyle?.fontAssetId}
                  style={{
                    visibility: !visibleTokenIds || visibleTokenIds.has(token.tokenId) ? "visible" : "hidden",
                    color: editorialStyle?.role === "accent" || (
                      !resolvedFrameMotion && active
                    )
                      ? accentColor
                      : textColor,
                    ...(editorialStyle?.role === "accent" || (!resolvedFrameMotion && active &&
                    creativeTreatment?.accentTypeRole === 'editorial_italic')
                      ? {
                          fontFamily: tokenFont.family,
                          fontStyle: tokenFont.style,
                          fontWeight: tokenFont.weight,
                        }
                      : {}),
                    ...(composedTokenTransform
                      ? {
                          display: "inline-block",
                          opacity: composedTokenTransform.opacity,
                          transform: `translate3d(${composedTokenTransform.translateXPx}px, ${composedTokenTransform.translateYPx}px, 0) scale(${composedTokenTransform.scale}) rotate(${composedTokenTransform.rotationDeg}deg)`,
                          transformOrigin: "left center",
                          position: "relative",
                          zIndex: editorialStyle?.zIndex,
                        }
                      : annotations.length > 0
                        ? {position: "relative", display: "inline-block"}
                      : {}),
                    ...(resolvedFrameMotion?.frameMotion.unit === "word"
                      ? {
                          ...maulFrameMotionStyle(
                            resolvedFrameMotion.transform,
                            0,
                          ),
                          isolation: "isolate",
                          ...(composedTokenTransform
                            ? {
                                opacity: composedTokenTransform.opacity,
                                transform: `translate3d(${composedTokenTransform.translateXPx}px, ${composedTokenTransform.translateYPx}px, 0) scale(${composedTokenTransform.scale}) rotate(${composedTokenTransform.rotationDeg + resolvedFrameMotion.transform.rotationDeg}deg)`,
                              }
                            : {}),
                        }
                      : {}),
                  }}
                >
                  {resolvedFrameMotion?.frameMotion.unit === "letter" && outputFrame !== undefined ? (
                    Array.from(token.text).map((character, letterIndex) => {
                      const letterTransform = evaluateMaulFrameMotion(
                        resolvedFrameMotion.frameMotion,
                        maulLetterStaggerFrame(
                          outputFrame,
                          letterIndex,
                          resolvedFrameMotion.frameMotion.visualRecipe?.variant ?? 0,
                        ),
                      );
                      return (
                        <span
                          key={`${token.tokenId}_letter_${letterIndex}`}
                          data-maul-letter-index={letterIndex}
                          style={maulFrameMotionStyle(
                            letterTransform,
                            0,
                          )}
                        >
                          {character}
                        </span>
                      );
                    })
                  ) : localRevealProgram ? (
                    <PositionLockedTokenText
                      token={token}
                      program={localRevealProgram}
                      absoluteTimeMs={absoluteTimeMs}
                    />
                  ) : renderedTokenText}
                  {annotations.map((annotation) => (
                    <span
                      key={annotation.annotationId}
                      aria-hidden="true"
                      data-maul-annotation-kind={annotation.kind}
                      data-maul-annotation-token-id={token.tokenId}
                      style={annotationStyle({
                        kind: annotation.kind,
                        paddingPx: annotation.paddingPx,
                      })}
                    />
                  ))}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const TimedMaulPlannedTextCard: React.FC<{
  record: MaulPlannedTextRecord;
  outputFrame: number;
  fps: number;
  textColor: string;
  accentColor: string;
  creativeTreatment?: MaulCreativeTreatment;
  referenceEditorialRhythm?: MaulReferenceEditorialRhythm;
  suppressedOutputRanges?: readonly MaulTextSuppressionRange[];
  visibleTokenIds?: ReadonlySet<string>;
}> = ({
  record,
  outputFrame,
  fps,
  textColor,
  accentColor,
  creativeTreatment,
  referenceEditorialRhythm,
  suppressedOutputRanges,
  visibleTokenIds,
}) => {
  return (
    <MaulPlannedTextCard
      record={record}
      absoluteTimeMs={(outputFrame / fps) * 1000}
      outputFrame={outputFrame}
      fps={fps}
      textColor={textColor}
      accentColor={accentColor}
      creativeTreatment={creativeTreatment}
      referenceEditorialRhythm={referenceEditorialRhythm}
      suppressedOutputRanges={suppressedOutputRanges}
      visibleTokenIds={visibleTokenIds}
    />
  );
};

export const MaulPlannedTextLayer: React.FC<{
  records: MaulPlannedTextRecord[];
  textColor: string;
  accentColor: string;
  creativeTreatment?: MaulCreativeTreatment;
  referenceEditorialRhythm?: MaulReferenceEditorialRhythm;
  suppressedOutputRanges?: readonly MaulTextSuppressionRange[];
  visibleTokenIds?: ReadonlySet<string>;
}> = ({records, textColor, accentColor, creativeTreatment, referenceEditorialRhythm, suppressedOutputRanges, visibleTokenIds}) => {
  const outputFrame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <>
      {records.map((record) => (
        <Sequence
          key={record.segmentId}
          {...toMaulFrameInterval({
            outputStartMs: record.outputStartMs,
            outputEndMs: record.outputEndMs,
            fps,
          })}
        >
          <TimedMaulPlannedTextCard
            record={record}
            outputFrame={outputFrame}
            fps={fps}
            textColor={textColor}
            accentColor={accentColor}
            creativeTreatment={creativeTreatment}
            referenceEditorialRhythm={referenceEditorialRhythm}
            suppressedOutputRanges={suppressedOutputRanges}
            visibleTokenIds={visibleTokenIds}
          />
        </Sequence>
      ))}
    </>
  );
};
