import {describe, expect, it} from "vitest";

import {PostProcessing, TEXT_BLOOM_LAYER, shouldRenderPostProcessing} from "./post-processing.js";

describe("post-processing guards", () => {
  it("skips the composer when every post-processing pass is disabled", () => {
    expect(shouldRenderPostProcessing({
      bloomEnabled: false,
      motionBlurEnabled: false,
      chromaticAberrationEnabled: false,
      vignetteEnabled: false,
      lutEnabled: false,
      lutUrl: null
    })).toBe(false);
  });

  it("renders the composer when at least one screen-space pass is enabled", () => {
    expect(shouldRenderPostProcessing({
      bloomEnabled: true,
      motionBlurEnabled: false,
      chromaticAberrationEnabled: false,
      vignetteEnabled: false,
      lutEnabled: false,
      lutUrl: null
    })).toBe(true);
  });

  it("renders the composer for LUT intent even before a LUT texture loader is available", () => {
    expect(shouldRenderPostProcessing({
      bloomEnabled: false,
      motionBlurEnabled: false,
      chromaticAberrationEnabled: false,
      vignetteEnabled: false,
      lutEnabled: true,
      lutUrl: null
    })).toBe(true);
  });

  it("exports the rendering component and text bloom layer contract", () => {
    expect(PostProcessing).toBeDefined();
    expect(TEXT_BLOOM_LAYER).toBe(1);
  });
});
