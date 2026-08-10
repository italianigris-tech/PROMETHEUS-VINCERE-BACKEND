import {loadFont as loadLocalFont} from "@remotion/fonts";
import type {MaulTextAnimationTransform} from "@prometheus/shared-types";
import React from "react";
import {staticFile} from "remotion";

import type {MaulPlannedTextRecord} from "./maul-short-manifest-adapter";
import {resolveMaulFontAssetUrl} from "./maul-font-asset-resolver";
import {
  maulFrameMotionStyle,
  resolveMaulFrameMotionForToken,
} from "./maul-frame-motion-renderer";

const loadedProfileFontKeys = new Set<string>();

const ensureProfileFontLoaded = (
  asset: NonNullable<
    MaulPlannedTextRecord["profileRealization"]
  >["layers"][number]["selectedAsset"],
): void => {
  if (typeof FontFace === "undefined") return;
  const key = [asset.assetId, asset.localFileSha256, asset.weight, asset.style].join(":");
  if (loadedProfileFontKeys.has(key)) return;
  loadedProfileFontKeys.add(key);
  void loadLocalFont({
    family: asset.cssFamily,
    url: resolveMaulFontAssetUrl(asset.browserUrl, staticFile),
    weight: String(asset.weight),
    style: asset.style,
  });
};

const animationStyle = (
  transform: MaulTextAnimationTransform | null | undefined,
): React.CSSProperties => transform
  ? {
      opacity: transform.opacity,
      transform: `translate3d(${transform.translateXPx}px, ${transform.translateYPx}px, 0) scale(${transform.scale})`,
      transformOrigin: "left top",
    }
  : {};

type ProfileTextPiece =
  | {kind: "literal"; text: string}
  | {kind: "token"; tokenId: string; text: string};

const profileTextPieces = ({
  text,
  tokenIds,
  tokenTextById,
}: {
  text: string;
  tokenIds: readonly string[];
  tokenTextById: ReadonlyMap<string, string>;
}): ProfileTextPiece[] | null => {
  const pieces: ProfileTextPiece[] = [];
  let cursor = 0;
  const normalizedText = text.toLocaleLowerCase();
  for (const tokenId of tokenIds) {
    const tokenText = tokenTextById.get(tokenId);
    if (!tokenText) return null;
    const index = normalizedText.indexOf(tokenText.toLocaleLowerCase(), cursor);
    if (index < cursor) return null;
    if (index > cursor) pieces.push({kind: "literal", text: text.slice(cursor, index)});
    pieces.push({
      kind: "token",
      tokenId,
      text: text.slice(index, index + tokenText.length),
    });
    cursor = index + tokenText.length;
  }
  if (cursor < text.length) pieces.push({kind: "literal", text: text.slice(cursor)});
  return pieces;
};

export const MaulProfileTypographyGroup: React.FC<{
  record: MaulPlannedTextRecord;
  segmentAnimation?: MaulTextAnimationTransform | null;
  outputFrame?: number;
}> = ({record, segmentAnimation, outputFrame}) => {
  const realization = record.profileRealization;
  const profileTransform = record.profileTransform;
  if (!realization || !profileTransform) {
    throw new Error(
      `MAUL profile renderer requires realization and transform for ${record.segmentId}.`,
    );
  }
  const resolvedColorsByLayerName = new Map(
    (record.profileColorResolution?.layers ?? []).map((layer) => [
      layer.layerName,
      layer.resolvedColor,
    ]),
  );
  for (const layer of realization.layers) {
    ensureProfileFontLoaded(layer.selectedAsset);
  }
  const tokenTextById = new Map(
    record.lines.flatMap((line) => line.tokens).map((token) => [token.tokenId, token.text]),
  );
  const animationPrograms = record.animationPrograms?.length
    ? record.animationPrograms
    : record.animationProgram ? [record.animationProgram] : [];

  return (
    <div
      data-maul-placement-segment={record.segmentId}
      data-maul-profile-typography="true"
      data-placement-family={record.family}
      data-placement-variant={record.variantId}
      data-profile-uniform-scale={profileTransform.uniformScale}
      data-profile-color-mode={record.profileColorResolution?.mode}
      data-profile-background-luminance={
        record.profileColorResolution?.backgroundLuminance ?? undefined
      }
      style={{
        position: "absolute",
        left: record.boxPx.leftPx,
        top: record.boxPx.topPx,
        width: profileTransform.finalWidthPx,
        height: profileTransform.finalHeightPx,
        overflow: "visible",
        ...animationStyle(segmentAnimation),
      }}
    >
      <div style={{
        width: profileTransform.intrinsicWidthPx,
        height: profileTransform.intrinsicHeightPx,
        transform: `scale(${profileTransform.uniformScale})`,
        transformOrigin: "left top",
        textAlign: realization.horizontalAlignment,
      }}>
        {realization.layers.map((layer) => {
          const pieces = profileTextPieces({
            text: layer.text,
            tokenIds: layer.tokenIds,
            tokenTextById,
          });
          const renderToken = (piece: Extract<ProfileTextPiece, {kind: "token"}>) => {
            const resolvedMotion = resolveMaulFrameMotionForToken({
              programs: animationPrograms,
              tokenId: piece.tokenId,
              outputFrame,
            });
            return (
              <React.Fragment key={`${layer.layerName}:${piece.tokenId}`}>
                {resolvedMotion ? (
                  <span
                    data-maul-frame-motion-executor={resolvedMotion.frameMotion.executorId}
                    data-maul-frame-motion-treatment={resolvedMotion.frameMotion.sourceTreatment}
                    data-maul-frame-motion-token={resolvedMotion.frameMotion.tokenId}
                    data-maul-frame-motion-unit={resolvedMotion.frameMotion.unit}
                    style={maulFrameMotionStyle(
                      resolvedMotion.transform,
                      layer.letterSpacingEm,
                    )}
                  >
                    {piece.text}
                  </span>
                ) : piece.text}
              </React.Fragment>
            );
          };
          return (
            <div
              key={layer.layerName}
              data-maul-profile-layer={layer.layerName}
              data-maul-profile-layer-token-ids={layer.tokenIds.join(",")}
              data-font-asset-id={layer.selectedAsset.assetId}
              data-font-url={layer.selectedAsset.browserUrl}
              data-profile-measurement-id={layer.measurementId}
              style={{
                width: "100%",
                marginTop: layer.marginTopPx,
                color: (() => { const res = resolvedColorsByLayerName.get(layer.layerName) || layer.color; return /^#?(111111|333333|000000|1a1a1a|222222|0f0f0f|2b2b2b)$/i.test(res.trim()) ? "#FFFFFF" : res; })(),
                fontFamily: layer.selectedAsset.cssFamily,
                fontSize: layer.fontSizePx,
                fontWeight: layer.selectedAsset.weight,
                fontStyle: layer.selectedAsset.style,
                lineHeight: layer.lineHeight,
                letterSpacing: `${layer.letterSpacingEm}em`,
                textShadow: `${layer.shadow.xOffset}px ${layer.shadow.yOffset}px ${layer.shadow.blurRadius}px ${layer.shadow.color}`,
                whiteSpace: "nowrap",
              }}
            >
              {pieces
                ? pieces.map((piece, index) => piece.kind === "literal"
                  ? <React.Fragment key={`${layer.layerName}:literal:${index}`}>{piece.text}</React.Fragment>
                  : renderToken(piece))
                : layer.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};
