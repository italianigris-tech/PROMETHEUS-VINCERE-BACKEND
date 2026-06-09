import React from "react";
import {describe, expect, it, vi} from "vitest";

vi.mock("@react-three/postprocessing", () => ({
  EffectComposer: vi.fn(({children}) => React.createElement("composer", null, children)),
  SelectiveBloom: vi.fn(() => React.createElement("bloom")),
  wrapEffect: vi.fn(() => vi.fn(() => React.createElement("effect")))
}));

vi.mock("postprocessing", () => ({
  BlendFunction: {NORMAL: 1},
  Effect: class {
    uniforms: Map<string, {value: unknown}>;

    constructor(_name: string, fragmentShader: string, options?: {uniforms?: Map<string, {value: unknown}>}) {
      if (!fragmentShader.includes("#version 300 es")) {
        throw new Error("Expected GLSL 300 ES shader source");
      }
      this.uniforms = options?.uniforms ?? new Map();
    }
  }
}));

describe("PostProcessingPipeline", () => {
  it("creates a renderable pipeline without shader construction errors", async () => {
    const {PostProcessingPipeline} = await import("../post-processing.js");
    const element = React.createElement(PostProcessingPipeline, {
      config: {bloom: true, chromaticAberration: true, motionBlur: true}
    });

    expect(element.type).toBe(PostProcessingPipeline);
  });

  it("keeps the memoized composer component stable across re-render", async () => {
    const post = await import("@react-three/postprocessing");
    const {PostProcessingPipeline} = await import("../post-processing.js");
    const first = React.createElement(PostProcessingPipeline, {config: {bloom: true}});
    const second = React.createElement(PostProcessingPipeline, {config: {bloom: true}});

    expect(first.type).toBe(second.type);
    expect(post.EffectComposer).toBe(post.EffectComposer);
  });
});
