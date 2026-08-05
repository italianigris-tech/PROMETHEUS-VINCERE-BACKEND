import {loadFont as loadLocalFont} from "@remotion/fonts";
import {
  joinShortsTextTokens,
  type MaulArtDirectionPlanPayload,
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

export const MaulPlannedTextCard: React.FC<{
  record: MaulPlannedTextRecord;
  absoluteTimeMs: number;
  outputFrame?: number;
  fps?: number;
  textColor: string;
  accentColor: string;
  creativeTreatment?: MaulCreativeTreatment;
}> = ({
  record,
  absoluteTimeMs,
  outputFrame,
  fps,
  textColor,
  accentColor,
  creativeTreatment,
}) => {
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
  const requestedCinematicTreatment = animationPrograms.find((program) =>
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
  const segmentAnimation = resolvedAnimations.find(
    ({program}) => program.target.scope === "segment",
  )?.transform ?? null;
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
      data-creative-treatment-profile={creativeTreatment?.profileId}
      data-primary-type-role={creativeTreatment?.primaryTypeRole}
      data-accent-type-role={creativeTreatment?.accentTypeRole}
      data-emphasis-mode={creativeTreatment?.emphasisMode}
      data-motion-mode={creativeTreatment?.motionMode}
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
        overflow: "hidden",
        color: textColor,
        fontFamily:
          creativeTreatment?.primaryTypeRole === 'editorial_display'
            ? playfairDisplayFamily
            : renderedFamilyFor(record.font.family),
        fontSize: record.font.fontSizePx * record.font.hierarchyScale,
        fontWeight: record.font.weight,
        lineHeight: record.font.lineHeight,
        letterSpacing: 0,
        textAlign: record.alignment,
        ...primitive.containerStyle,
        ...primitive.textStyle,
        ...(segmentAnimation ? animationStyle(segmentAnimation) : {}),
      }}
    >
      {record.lines.map((line) => (
        <div key={line.lineId} data-maul-line-id={line.lineId}>
          {line.tokens.map((token, tokenIndex) => {
            const active = token.outputSpans.some(
              (span) =>
                span.outputStartMs <= absoluteTimeMs &&
                span.outputEndMs > absoluteTimeMs,
            );
            const tokenAnimation = resolvedAnimations.find(({program}) =>
              program.target.scope === "tokens" && program.target.tokenIds.includes(token.tokenId),
            )?.transform ?? null;
            return (
              <React.Fragment key={token.tokenId}>
                {tokenIndex > 0 &&
                needsSpaceBeforeToken(line.tokens[tokenIndex - 1]!, token)
                  ? " "
                  : null}
                <span
                  data-maul-token-id={token.tokenId}
                  data-active={active}
                  style={{
                    color: active ? accentColor : textColor,
                    ...(active &&
                    creativeTreatment?.accentTypeRole === 'editorial_italic'
                      ? {
                          fontFamily: playfairDisplayFamily,
                          fontStyle: 'italic',
                          fontWeight: 700,
                        }
                      : {}),
                    ...(tokenAnimation
                      ? {display: "inline-block", ...animationStyle(tokenAnimation)}
                      : {}),
                  }}
                >
                  {token.text}
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
}> = ({
  record,
  outputFrame,
  fps,
  textColor,
  accentColor,
  creativeTreatment,
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
    />
  );
};

export const MaulPlannedTextLayer: React.FC<{
  records: MaulPlannedTextRecord[];
  textColor: string;
  accentColor: string;
  creativeTreatment?: MaulCreativeTreatment;
}> = ({records, textColor, accentColor, creativeTreatment}) => {
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
          />
        </Sequence>
      ))}
    </>
  );
};
