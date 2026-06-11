import React, {memo, useMemo} from "react";
import type {RenderManifest} from "@prometheus/shared-types";

import {
  PostProcessingPipeline,
  shouldRenderPostProcessing as shouldRenderPipeline,
  type PostProcessConfig
} from "../engine/post-processing.js";
import {findPatternForSemanticTag} from "../lib/motion-ontology.js";

type PostProcessingFlags = Partial<Pick<
  RenderManifest,
  | "bloomEnabled"
  | "motionBlurEnabled"
  | "motionBlurStrength"
  | "chromaticAberrationEnabled"
  | "chromaticAberrationOffset"
  | "vignetteEnabled"
  | "lutEnabled"
  | "lutUrl"
  | "transcriptWords"
>>;

export const TEXT_BLOOM_LAYER = 1;

const boolToIntensity = (value: boolean | number | undefined): number => {
  if (typeof value === "number") {
    return value;
  }
  return value ? 0.5 : 0;
};

export const postProcessConfigFromManifest = (manifest: PostProcessingFlags): PostProcessConfig => {
  const config: PostProcessConfig = {
    bloom: manifest.bloomEnabled,
    chromaticAberration: manifest.chromaticAberrationEnabled ? manifest.chromaticAberrationOffset : 0,
    motionBlur: manifest.motionBlurEnabled,
    motionBlurStrength: manifest.motionBlurStrength,
    resolutionScale: manifest.motionBlurEnabled || manifest.bloomEnabled ? 0.5 : 1
  };

  for (const word of manifest.transcriptWords ?? []) {
    const pattern = word.semanticTag ? findPatternForSemanticTag(word.semanticTag) : null;
    const postProcess = pattern?.postProcess;
    if (!postProcess) {
      continue;
    }
    config.bloom = config.bloom || postProcess.bloom;
    config.chromaticAberration = Math.max(
      boolToIntensity(config.chromaticAberration),
      boolToIntensity(postProcess.chromaticAberration)
    );
    config.motionBlur = config.motionBlur || postProcess.motionBlur;
  }

  return config;
};

export const shouldRenderPostProcessing = (manifest: PostProcessingFlags): boolean =>
  shouldRenderPipeline(postProcessConfigFromManifest(manifest)) ||
  Boolean(
    manifest.bloomEnabled ||
    manifest.motionBlurEnabled ||
    manifest.chromaticAberrationEnabled ||
    manifest.vignetteEnabled ||
    manifest.lutEnabled
  );

export const PostProcessing = memo(function PostProcessing({
  manifest
}: {
  manifest: RenderManifest;
}) {
  const config = useMemo(() => postProcessConfigFromManifest(manifest), [manifest]);

  if (!shouldRenderPipeline(config)) {
    return null;
  }

  return <PostProcessingPipeline config={config} />;
});

export const PostProcessingEffects = PostProcessing;
