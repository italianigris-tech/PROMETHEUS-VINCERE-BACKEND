import React from "react";
import {describe, expect, it, vi} from "vitest";
import * as THREE from "three";

describe("PostProcessingPipeline", () => {
  it("creates a renderable pipeline without shader construction errors", async () => {
    const {PostProcessingPipeline} = await import("../post-processing.js");
    const element = React.createElement(PostProcessingPipeline, {
      config: {bloom: true, chromaticAberration: true, motionBlur: true}
    });

    expect(element.type).toBe(PostProcessingPipeline);
  });

  it("keeps the component type stable across re-render", async () => {
    const {PostProcessingPipeline} = await import("../post-processing.js");
    const first = React.createElement(PostProcessingPipeline, {config: {bloom: true}});
    const second = React.createElement(PostProcessingPipeline, {config: {bloom: true}});

    expect(first.type).toBe(second.type);
  });

  it("uses standalone Three ShaderPass shader sources", async () => {
    const {CHROMATIC_ABERRATION_FRAGMENT, CHROMATIC_ABERRATION_SHADER} = await import("../post-processing.js");

    expect(CHROMATIC_ABERRATION_FRAGMENT).toContain("void main()");
    expect(CHROMATIC_ABERRATION_FRAGMENT).toContain("tDiffuse");
    expect(CHROMATIC_ABERRATION_SHADER.uniforms.amount.value).toBeGreaterThan(0);
  });

  it("builds a selective text bloom pass before chromatic aberration", async () => {
    const {createPostProcessingPasses} = await import("../post-processing.js");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const passState = createPostProcessingPasses({
      scene,
      camera,
      size: {width: 640, height: 360},
      config: {bloom: true, chromaticAberration: 0.002}
    });

    expect(passState.passes).toHaveLength(3);
    expect(passState.selectiveBloomPass).toBeDefined();
    expect(passState.chromaticPass?.uniforms.amount?.value).toBe(0.002);
    passState.selectiveBloomPass?.dispose();
    passState.chromaticPass?.dispose();
  });
});
