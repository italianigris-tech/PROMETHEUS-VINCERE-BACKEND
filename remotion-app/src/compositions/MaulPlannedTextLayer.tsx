import {loadFont as loadDMSans} from "@remotion/google-fonts/DMSans";
import {
  joinShortsTextTokens,
  type MaulTextAnimationProgram,
  type MaulTextAnimationTransform,
} from "@prometheus/shared-types";
import React from "react";
import {
  Easing,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import {
  compileMaulLegibilityPrimitive,
  toMaulFrameInterval,
  type MaulPlannedTextRecord,
  type MaulPlannedTextToken,
} from "./maul-short-manifest-adapter";

const {fontFamily: dmSansFamily} = loadDMSans("normal", {
  weights: ["500", "700", "800"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

const needsSpaceBeforeToken = (
  previous: MaulPlannedTextToken,
  current: MaulPlannedTextToken,
) =>
  joinShortsTextTokens([previous.text, current.text]) ===
  `${previous.text.trim()} ${current.text.trim()}`;

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
}> = ({record, absoluteTimeMs, outputFrame, fps, textColor, accentColor}) => {
  const primitive = compileMaulLegibilityPrimitive(
    record.minimumLegibilityPrimitive,
  );
  const resolvedAnimation =
    record.animationProgram && outputFrame !== undefined && fps !== undefined
      ? resolveMaulTextAnimationTransform({
          program: record.animationProgram,
          outputFrame,
          fps,
        })
      : null;
  const segmentAnimation =
    record.animationProgram?.target.scope === "segment"
      ? resolvedAnimation
      : null;
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
      data-text-animation-treatment={record.animationProgram?.treatment}
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
        fontFamily: dmSansFamily,
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
            const tokenAnimation =
              resolvedAnimation &&
              record.animationProgram?.target.scope === "tokens" &&
              record.animationProgram.target.tokenIds.includes(token.tokenId)
                ? resolvedAnimation
                : null;
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
}> = ({record, outputFrame, fps, textColor, accentColor}) => {
  return (
    <MaulPlannedTextCard
      record={record}
      absoluteTimeMs={(outputFrame / fps) * 1000}
      outputFrame={outputFrame}
      fps={fps}
      textColor={textColor}
      accentColor={accentColor}
    />
  );
};

export const MaulPlannedTextLayer: React.FC<{
  records: MaulPlannedTextRecord[];
  textColor: string;
  accentColor: string;
}> = ({records, textColor, accentColor}) => {
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
          />
        </Sequence>
      ))}
    </>
  );
};
