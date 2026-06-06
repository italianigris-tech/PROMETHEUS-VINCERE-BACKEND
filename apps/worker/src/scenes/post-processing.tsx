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
  | "motionBlurStrength"
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

/**
 * Phase 7: Radial blur shader for motion blur effect.
 * Uses a simple screen-space radial blur based on distance from center.
 * For full velocity-buffer motion blur, see Phase 8.
 */
const RadialBlurShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uIntensity: { value: 0.5 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    varying vec2 vUv;

    void main() {
      vec4 color = vec4(0.0);
      float samples = 12.0;
      vec2 center = vec2(0.5);
      vec2 direction = (vUv - center) * uIntensity * 0.015;

      for (float i = 0.0; i < samples; i++) {
        float t = i / (samples - 1.0);
        color += texture2D(tDiffuse, vUv + direction * t);
      }

      gl_FragColor = color / samples;
    }
  `,
};

/**
 * Phase 7: LUT (Look-Up Table) color grading shader.
 * Loads a 3D LUT texture and applies color grading.
 * Supports .cube format converted to a 3D texture.
 */
const LUTShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tLUT: { value: null as THREE.Texture | null },
    uLUTSize: { value: 32 },
    uIntensity: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler3D tLUT;
    uniform float uLUTSize;
    uniform float uIntensity;
    varying vec2 vUv;

    vec3 applyLUT(vec3 color, sampler3D lut, float lutSize) {
      // Scale color to LUT coordinates
      vec3 lutCoord = color * (lutSize - 1.0) / lutSize + 0.5 / lutSize;
      return texture(lut, lutCoord).rgb;
    }

    void main() {
      vec4 originalColor = texture2D(tDiffuse, vUv);
      vec3 gradedColor = applyLUT(originalColor.rgb, tLUT, uLUTSize);
      gl_FragColor = vec4(mix(originalColor.rgb, gradedColor, uIntensity), originalColor.a);
    }
  `,
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
        // Phase 7: Motion blur shader is defined (RadialBlurShader above) but requires
        // a custom Effect class extending postprocessing's Effect to work with R3F.
        // The radial blur shader is ready for Phase 7.5 integration.
        // For now, chromatic aberration provides some motion-feel.
        null
      )}
      {manifest.lutEnabled && manifest.lutUrl && (
        // LUT pass: requires a 3D LUT texture loaded from a .cube file.
        // The LUT texture should be pre-loaded and passed via a context or store.
        // For now, this is a placeholder that will be wired up when LUT loading is implemented.
        null
      )}
    </EffectComposer>
  );
});

export const PostProcessingEffects = PostProcessing;
