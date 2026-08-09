import {
  joinShortsTextTokens,
  type MaulProfileTypographyRealization,
  type MaulResolvedFontAsset,
  type MaulTypographyLayerBinding,
} from "@prometheus/shared-types";

import {hashMaulPlanPayload} from "./text-chunk-plan.js";
import type {
  TypographyProfileLayer,
  TypographyProfileObservation,
} from "./typography-profile-corpus.js";

export type TypographyRealizationToken = {
  tokenId: string;
  text: string;
};

export type TypographyLayerMeasurement = {
  widthPx: number;
  heightPx: number;
};

export type TypographyLayerMeasurementProvider = (input: {
  tokenId: string;
  text: string;
  font: MaulResolvedFontAsset;
  fontSizePx: number;
  letterSpacingEm: number;
}) => TypographyLayerMeasurement;

const titleCase = (text: string): string =>
  text.replace(/(^|\s)([^\s])/gu, (_match, prefix: string, character: string) =>
    `${prefix}${character.toLocaleUpperCase()}`,
  );

const applyCasing = (
  text: string,
  casing: TypographyProfileLayer["fontStyle"]["casing"],
): string => {
  switch (casing) {
    case "lowercase":
      return text.toLocaleLowerCase();
    case "uppercase":
      return text.toLocaleUpperCase();
    case "title_case":
      return titleCase(text);
    case "normal":
      return text;
  }
};

const positiveMeasurement = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Typography profile produced invalid ${label} measurement.`);
  }
  return Number(value.toFixed(4));
};

const realizationMeasurementId = (input: {
  profile: TypographyProfileObservation;
  layer: TypographyProfileLayer;
  tokenIds: readonly string[];
  text: string;
  font: MaulResolvedFontAsset;
  fontSizePx: number;
  measuredWidthPx: number;
  measuredHeightPx: number;
}): string =>
  `profile_measurement_${hashMaulPlanPayload({
    profileName: input.profile.profileName,
    profileVersion: input.profile.version,
    sourceSha256: input.profile.sourceSha256,
    layerName: input.layer.layerName,
    tokenIds: input.tokenIds,
    text: input.text,
    assetId: input.font.assetId,
    assetSha256: input.font.localFileSha256,
    fontSizePx: input.fontSizePx,
    letterSpacingEm: input.layer.fontStyle.letterSpacingEm,
    measuredWidthPx: input.measuredWidthPx,
    measuredHeightPx: input.measuredHeightPx,
  })}`;

export const compileTypographyProfileRealization = ({
  profile,
  tokens,
  bindingsByLayerName,
  measureToken,
}: {
  profile: TypographyProfileObservation;
  tokens: readonly TypographyRealizationToken[];
  bindingsByLayerName: ReadonlyMap<string, MaulTypographyLayerBinding>;
  measureToken: TypographyLayerMeasurementProvider;
}): MaulProfileTypographyRealization => {
  if (tokens.length !== profile.metadata.totalWordCount) {
    throw new Error(
      `Typography profile token count ${tokens.length} does not match declared token count ${profile.metadata.totalWordCount}.`,
    );
  }

  let tokenOffset = 0;
  const layers = profile.layers.map((profileLayer) => {
    const binding = bindingsByLayerName.get(profileLayer.layerName);
    if (!binding) {
      throw new Error(
        `Typography profile layer ${profileLayer.layerName} has no resolved font binding.`,
      );
    }
    const layerTokens = tokens.slice(
      tokenOffset,
      tokenOffset + profileLayer.wordCount,
    );
    if (layerTokens.length !== profileLayer.wordCount) {
      throw new Error(
        `Typography profile layer ${profileLayer.layerName} token count is incomplete.`,
      );
    }
    tokenOffset += profileLayer.wordCount;

    const text = applyCasing(
      joinShortsTextTokens(layerTokens.map((token) => token.text)),
      profileLayer.fontStyle.casing,
    );
    const fontSizePx = Number(
      (profileLayer.fontStyle.sizePxBase * profileLayer.fontStyle.relativeScale).toFixed(4),
    );
    const measured = measureToken({
      tokenId: `${profile.profileName}:${profileLayer.layerName}`,
      text,
      font: binding.selectedAsset,
      fontSizePx,
      letterSpacingEm: profileLayer.fontStyle.letterSpacingEm,
    });
    const letterSpacingPx =
      Math.max(0, [...text].length - 1) *
      profileLayer.fontStyle.letterSpacingEm *
      fontSizePx;
    const measuredWidthPx = positiveMeasurement(
      measured.widthPx + letterSpacingPx,
      `${profileLayer.layerName} width`,
    );
    const measuredHeightPx = positiveMeasurement(
      measured.heightPx,
      `${profileLayer.layerName} height`,
    );

    return {
      layerName: profileLayer.layerName,
      tokenIds: layerTokens.map((token) => token.tokenId),
      text,
      selectedAsset: binding.selectedAsset,
      fontSizePx,
      measuredWidthPx,
      measuredHeightPx,
      lineHeight: profileLayer.fontStyle.lineHeight,
      letterSpacingEm: profileLayer.fontStyle.letterSpacingEm,
      casing: profileLayer.fontStyle.casing,
      color: profileLayer.fontStyle.color,
      marginTopPx: profileLayer.fontStyle.verticalMarginTopPx,
      shadow: {
        xOffset: profileLayer.effects.dropShadow.xOffset,
        yOffset: profileLayer.effects.dropShadow.yOffset,
        blurRadius: profileLayer.effects.dropShadow.blurRadius,
        color: profileLayer.effects.dropShadow.color,
      },
      measurementId: realizationMeasurementId({
        profile,
        layer: profileLayer,
        tokenIds: layerTokens.map((token) => token.tokenId),
        text,
        font: binding.selectedAsset,
        fontSizePx,
        measuredWidthPx,
        measuredHeightPx,
      }),
    };
  });

  if (tokenOffset !== tokens.length) {
    throw new Error(
      `Typography profile layer partition consumed ${tokenOffset} of ${tokens.length} tokens.`,
    );
  }

  const intrinsicWidth = Math.max(...layers.map((layer) => layer.measuredWidthPx));
  const intrinsicHeight = layers.reduce(
    (height, layer) =>
      height +
      Math.max(0, layer.measuredHeightPx * layer.lineHeight + layer.marginTopPx),
    0,
  );
  return {
    adaptation: "uniform_fit_9_16",
    horizontalAlignment: profile.layoutRules.horizontalAlignment,
    maxWidthPercent: profile.layoutRules.maxWidthPercent,
    intrinsicSizePx: {
      width: positiveMeasurement(intrinsicWidth, "intrinsic width"),
      height: positiveMeasurement(intrinsicHeight, "intrinsic height"),
    },
    layers,
  };
};
