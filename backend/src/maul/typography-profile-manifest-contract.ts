import type {
  MaulChunkTypographyBinding,
  MaulTextPlacementSegment,
} from "@prometheus/shared-types";

import {hashMaulPlanPayload} from "./text-chunk-plan.js";

const closeEnough = (left: number, right: number): boolean =>
  Math.abs(left - right) <= 0.01;

export const TYPOGRAPHY_PROFILE_COMPILER_VERSION =
  "maul-typography-profile-compiler/v2";

export const fingerprintTypographyProfileGeometry = (
  binding: Pick<
    MaulChunkTypographyBinding,
    "profile" | "layers" | "layout" | "realization"
  >,
): string => hashMaulPlanPayload({
  profile: binding.profile,
  layout: binding.layout,
  realization: binding.realization,
  resolvedAssets: binding.layers.map((layer) => ({
    layerName: layer.layerName,
    assetId: layer.selectedAsset.assetId,
    localFileSha256: layer.selectedAsset.localFileSha256,
    weight: layer.selectedAsset.weight,
    style: layer.selectedAsset.style,
  })),
});

export const assertTypographyProfileProvenance = (
  binding: MaulChunkTypographyBinding,
): void => {
  const provenance = binding.provenance;
  if (!provenance) {
    throw new Error(
      `Typography profile ${binding.chunkId} lacks an authentic compiler provenance receipt.`,
    );
  }
  if (
    provenance.compilerVersion !== TYPOGRAPHY_PROFILE_COMPILER_VERSION ||
    provenance.profileId !== binding.compatibilityProfile.profileId ||
    provenance.sourceFilename !== binding.profile.sourceFilename ||
    provenance.sourceSha256 !== binding.profile.sourceSha256
  ) {
    throw new Error(
      `Typography profile ${binding.chunkId} provenance does not match its declared profile.`,
    );
  }
  const expectedGeometry = fingerprintTypographyProfileGeometry(binding);
  if (provenance.geometryFingerprint !== expectedGeometry) {
    throw new Error(
      `Typography profile ${binding.chunkId} geometry fingerprint is stale or forged.`,
    );
  }
  const expectedAssets = new Map(
    binding.layers.map((layer) => [
      layer.selectedAsset.assetId,
      layer.selectedAsset.localFileSha256,
    ]),
  );
  const receivedAssets = new Map(
    provenance.resolvedFontAssets.map((asset) => [
      asset.assetId,
      asset.localFileSha256,
    ]),
  );
  if (
    expectedAssets.size !== receivedAssets.size ||
    [...expectedAssets].some(
      ([assetId, hash]) => receivedAssets.get(assetId) !== hash,
    )
  ) {
    throw new Error(
      `Typography profile ${binding.chunkId} resolved font provenance is incomplete.`,
    );
  }
};

export const assertTypographyProfileManifestLineage = ({
  binding,
  segment,
}: {
  binding: Pick<MaulChunkTypographyBinding, "chunkId" | "layers" | "realization">;
  segment: Pick<MaulTextPlacementSegment, "chunkId" | "tokenIds" | "profileTransform">;
}): void => {
  if (!binding.realization && !segment.profileTransform) return;
  if (!binding.realization) {
    throw new Error(
      `Typography profile placement ${segment.chunkId} has a transform without a realization.`,
    );
  }
  if (!segment.profileTransform) {
    throw new Error(
      `Typography profile placement ${segment.chunkId} has a realization without a transform.`,
    );
  }
  const realizationTokenIds = binding.realization.layers.flatMap(
    (layer) => layer.tokenIds,
  );
  if (
    realizationTokenIds.length !== segment.tokenIds.length ||
    realizationTokenIds.some((tokenId, index) => tokenId !== segment.tokenIds[index])
  ) {
    throw new Error(
      `Typography profile placement ${segment.chunkId} token lineage does not match its realization.`,
    );
  }
  if (
    !closeEnough(
      segment.profileTransform.intrinsicWidthPx,
      binding.realization.intrinsicSizePx.width,
    ) ||
    !closeEnough(
      segment.profileTransform.intrinsicHeightPx,
      binding.realization.intrinsicSizePx.height,
    )
  ) {
    throw new Error(
      `Typography profile placement ${segment.chunkId} transform geometry does not match its realization dimensions.`,
    );
  }
  if (
    !closeEnough(
      segment.profileTransform.finalWidthPx,
      segment.profileTransform.intrinsicWidthPx *
        segment.profileTransform.uniformScale,
    ) ||
    !closeEnough(
      segment.profileTransform.finalHeightPx,
      segment.profileTransform.intrinsicHeightPx *
        segment.profileTransform.uniformScale,
    )
  ) {
    throw new Error(
      `Typography profile placement ${segment.chunkId} has invalid uniform transform geometry.`,
    );
  }
};
