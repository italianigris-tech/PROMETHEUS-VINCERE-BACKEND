import {loadFont as loadLocalFont} from "@remotion/fonts";
import type {MaulTextAnimationTransform} from "@prometheus/shared-types";
import React from "react";
import {staticFile} from "remotion";

import type {MaulPlannedTextRecord} from "./maul-short-manifest-adapter";
import {resolveMaulFontAssetUrl} from "./maul-font-asset-resolver";

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

export const MaulProfileTypographyGroup: React.FC<{
  record: MaulPlannedTextRecord;
  segmentAnimation?: MaulTextAnimationTransform | null;
}> = ({record, segmentAnimation}) => {
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
        {realization.layers.map((layer) => (
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
              color: resolvedColorsByLayerName.get(layer.layerName) ?? layer.color,
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
            {layer.text}
          </div>
        ))}
      </div>
    </div>
  );
};
