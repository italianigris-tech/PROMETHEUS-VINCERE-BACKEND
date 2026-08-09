import type {
  MaulChunkTypographyBinding,
  MaulTextPlacementSegment,
} from "@prometheus/shared-types";

const closeEnough = (left: number, right: number): boolean =>
  Math.abs(left - right) <= 0.01;

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
