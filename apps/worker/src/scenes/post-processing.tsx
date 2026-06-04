import React, {memo, useMemo} from "react";
import {
  ChromaticAberration,
  EffectComposer,
  SelectiveBloom,
  Vignette
} from "@react-three/postprocessing";
import type {RenderManifest} from "@prometheus/shared-types";
import * as THREE from "three";

type PostProcessingFlags = Pick<
  RenderManifest,
  | "bloomEnabled"
  | "motionBlurEnabled"
  | "chromaticAberrationEnabled"
  | "vignetteEnabled"
  | "lutEnabled"
  | "lutUrl"
>;

export const TEXT_BLOOM_LAYER = 1;

export const shouldRenderPostProcessing = (manifest: PostProcessingFlags): boolean =>
  manifest.bloomEnabled ||
  manifest.motionBlurEnabled ||
  manifest.chromaticAberrationEnabled ||
  manifest.vignetteEnabled ||
  manifest.lutEnabled;

type PostProcessingEffectsProps = {
  manifest: RenderManifest;
};

export const PostProcessing = memo(function PostProcessing({
  manifest
}: PostProcessingEffectsProps) {
  const chromaticAberrationOffset = useMemo(
    () => new THREE.Vector2(manifest.chromaticAberrationOffset, manifest.chromaticAberrationOffset),
    [manifest.chromaticAberrationOffset]
  );

  if (!shouldRenderPostProcessing(manifest)) {
    return null;
  }

  return (
    <EffectComposer>
      {manifest.bloomEnabled && (
        <SelectiveBloom
          intensity={manifest.bloomStrength}
          luminanceThreshold={manifest.bloomThreshold}
          luminanceSmoothing={manifest.bloomRadius}
          mipmapBlur
          selectionLayer={TEXT_BLOOM_LAYER}
        />
      )}
      {manifest.chromaticAberrationEnabled && (
        <ChromaticAberration
          offset={chromaticAberrationOffset}
          radialModulation={false}
          modulationOffset={0}
        />
      )}
      {manifest.vignetteEnabled && (
        <Vignette
          darkness={manifest.vignetteDarkness}
          offset={manifest.vignetteOffset}
        />
      )}
      {manifest.motionBlurEnabled && (
        // TODO Phase 5.5: MotionBlur pass requires custom implementation or library support. Velocities are tracked and stored.
        null
      )}
      {manifest.lutEnabled && manifest.lutUrl && (
        // TODO Phase 5.5: LUT pass requires .cube loader or custom shader.
        null
      )}
    </EffectComposer>
  );
});

export const PostProcessingEffects = PostProcessing;
