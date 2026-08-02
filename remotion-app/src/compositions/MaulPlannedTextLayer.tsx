import {loadFont as loadDMSans} from "@remotion/google-fonts/DMSans";
import {joinShortsTextTokens} from "@prometheus/shared-types";
import React from "react";
import {
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import {
  compileMaulLegibilityPrimitive,
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

export const MaulPlannedTextCard: React.FC<{
  record: MaulPlannedTextRecord;
  absoluteTimeMs: number;
  textColor: string;
  accentColor: string;
}> = ({record, absoluteTimeMs, textColor, accentColor}) => {
  const primitive = compileMaulLegibilityPrimitive(
    record.minimumLegibilityPrimitive,
  );
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
            return (
              <React.Fragment key={token.tokenId}>
                {tokenIndex > 0 &&
                needsSpaceBeforeToken(line.tokens[tokenIndex - 1]!, token)
                  ? " "
                  : null}
                <span
                  data-maul-token-id={token.tokenId}
                  data-active={active}
                  style={{color: active ? accentColor : textColor}}
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
  textColor: string;
  accentColor: string;
}> = ({record, textColor, accentColor}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <MaulPlannedTextCard
      record={record}
      absoluteTimeMs={record.outputStartMs + (frame / fps) * 1000}
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
  const {fps} = useVideoConfig();
  return (
    <>
      {records.map((record) => (
        <Sequence
          key={record.segmentId}
          from={Math.round((record.outputStartMs / 1000) * fps)}
          durationInFrames={Math.max(
            1,
            Math.round(
              ((record.outputEndMs - record.outputStartMs) / 1000) * fps,
            ),
          )}
        >
          <TimedMaulPlannedTextCard
            record={record}
            textColor={textColor}
            accentColor={accentColor}
          />
        </Sequence>
      ))}
    </>
  );
};
