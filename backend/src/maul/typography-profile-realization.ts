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

const visualScale = (layer: TypographyProfileLayer): number =>
  layer.fontStyle.sizePxBase * layer.fontStyle.relativeScale;

const allocateLayerWordCounts = ({
  layers,
  tokenCount,
}: {
  layers: readonly TypographyProfileLayer[];
  tokenCount: number;
}): Array<{layer: TypographyProfileLayer; wordCount: number}> => {
  const activeLayers = tokenCount >= layers.length
    ? [...layers]
    : layers
        .map((layer, index) => ({layer, index}))
        .sort(
          (left, right) =>
            visualScale(right.layer) - visualScale(left.layer) ||
            left.index - right.index,
        )
        .slice(0, tokenCount)
        .sort((left, right) => left.index - right.index)
        .map(({layer}) => layer);
  const observedTotal = activeLayers.reduce(
    (total, layer) => total + layer.wordCount,
    0,
  );
  const ideals = activeLayers.map(
    (layer) => (tokenCount * layer.wordCount) / observedTotal,
  );
  const counts = ideals.map((ideal) => Math.max(1, Math.floor(ideal)));
  while (counts.reduce((total, count) => total + count, 0) < tokenCount) {
    const index = counts
      .map((count, candidateIndex) => ({
        candidateIndex,
        deficit: ideals[candidateIndex]! - count,
      }))
      .sort(
        (left, right) =>
          right.deficit - left.deficit ||
          left.candidateIndex - right.candidateIndex,
      )[0]!.candidateIndex;
    counts[index] += 1;
  }
  while (counts.reduce((total, count) => total + count, 0) > tokenCount) {
    const index = counts
      .map((count, candidateIndex) => ({
        candidateIndex,
        removable: count > 1 ? count - ideals[candidateIndex]! : -Infinity,
      }))
      .sort(
        (left, right) =>
          right.removable - left.removable ||
          right.candidateIndex - left.candidateIndex,
      )[0]!.candidateIndex;
    counts[index] -= 1;
  }
  return activeLayers.map((layer, index) => ({
    layer,
    wordCount: counts[index]!,
  }));
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
  if (tokens.length === 0) {
    throw new Error("Typography profile realization requires at least one token.");
  }

  let tokenOffset = 0;
  const adaptedLayers = allocateLayerWordCounts({
    layers: profile.layers,
    tokenCount: tokens.length,
  });
  const layers = adaptedLayers.map(({layer: profileLayer, wordCount}) => {
    const binding = bindingsByLayerName.get(profileLayer.layerName);
    if (!binding) {
      throw new Error(
        `Typography profile layer ${profileLayer.layerName} has no resolved font binding.`,
      );
    }
    const layerTokens = tokens.slice(
      tokenOffset,
      tokenOffset + wordCount,
    );
    if (layerTokens.length !== wordCount) {
      throw new Error(
        `Typography profile layer ${profileLayer.layerName} token count is incomplete.`,
      );
    }
    tokenOffset += wordCount;

    const text = applyCasing(
      joinShortsTextTokens(layerTokens.map((token) => token.text)),
      profileLayer.fontStyle.casing,
    );
    // The corpus records the rendered layer size in size_px_base. relative_scale
    // describes hierarchy between layers; multiplying both values here applies
    // that hierarchy twice and can turn support copy into illegible 2px text.
    const fontSizePx = Number(profileLayer.fontStyle.sizePxBase.toFixed(4));
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
