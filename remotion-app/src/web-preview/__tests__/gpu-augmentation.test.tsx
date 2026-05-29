import {readFileSync} from "node:fs";
import path from "node:path";

import {describe, expect, it, vi} from "vitest";

import {compileRenderGraphForWindow, type RenderGraphTimelineLayer} from "../../lib/render-graph";
import {buildGPUFrameData} from "../../webgl/bridge";
import {
  createGPUAugmentationRenderer,
  createGPUUniformState,
  updateGPUUniformsFromFrameData,
  type GPUAugmentationBackend
} from "../../webgl/renderer";
import {createGPUAugmenterFrameHandler} from "../../webgl/useGPUAugmenter";

const readSource = (relativePath: string): string => {
  return readFileSync(path.resolve("src", relativePath), "utf8");
};

const buildLayer = (overrides: Partial<RenderGraphTimelineLayer> = {}): RenderGraphTimelineLayer => ({
  id: overrides.id ?? "gpu-layer",
  kind: overrides.kind ?? "creative-track",
  mediaKind: overrides.mediaKind ?? "image",
  label: overrides.label ?? "GPU layer",
  startMs: overrides.startMs ?? 0,
  endMs: overrides.endMs ?? 1000,
  zIndex: overrides.zIndex ?? 12,
  visual: overrides.visual ?? true,
  opacity: overrides.opacity ?? 1,
  transform: overrides.transform ?? {
    translateX: 4,
    translateY: -2,
    scale: 1.04,
    rotateDeg: 1
  },
  easing: overrides.easing ?? {
    enter: "linear"
  },
  styleMetadata: overrides.styleMetadata ?? {}
});

const graph = compileRenderGraphForWindow({
  fps: 30,
  focusFrame: 15,
  windowSeconds: 10,
  layers: [
    buildLayer({
      id: "camera",
      kind: "motion-scene",
      mediaKind: "none",
      visual: false,
      zIndex: 1,
      transform: {
        translateX: 0,
        translateY: 0,
        scale: 1.08,
        rotateDeg: 0
      }
    }),
    buildLayer()
  ]
});

describe("GPU augmentation layer", () => {
  it("bridges RenderGraph frame data without mutating the graph", () => {
    const graphBefore = JSON.stringify(graph);
    const frameData = buildGPUFrameData({
      graph,
      frame: 15
    });

    expect(frameData.frame).toBe(15);
    expect(frameData.layers[0]).toEqual(expect.objectContaining({
      sourceLayerId: "gpu-layer",
      opacity: expect.any(Number)
    }));
    expect(Object.isFrozen(frameData)).toBe(true);
    expect(Object.isFrozen(frameData.layers)).toBe(true);
    expect(JSON.stringify(graph)).toBe(graphBefore);
  });

  it("updates reusable uniform buffers without rebuilding per frame", () => {
    const uniforms = createGPUUniformState();
    const transformBuffer = uniforms.layerTransforms.value;
    const firstFrame = buildGPUFrameData({graph, frame: 15});
    const secondFrame = buildGPUFrameData({graph, frame: 18});

    updateGPUUniformsFromFrameData(uniforms, firstFrame);
    const firstLayerCount = uniforms.layerCount.value;
    updateGPUUniformsFromFrameData(uniforms, secondFrame);

    expect(uniforms.layerTransforms.value).toBe(transformBuffer);
    expect(uniforms.layerCount.value).toBe(firstLayerCount);
    expect(uniforms.glowStrength.value).toBeGreaterThanOrEqual(0);
  });

  it("initializes the WebGL backend once and renders frames through uniform updates", () => {
    const calls: string[] = [];
    const backend: GPUAugmentationBackend = {
      initialize: vi.fn(() => {
        calls.push("initialize");
      }),
      render: vi.fn(() => {
        calls.push("render");
      }),
      resize: vi.fn(),
      dispose: vi.fn()
    };
    const renderer = createGPUAugmentationRenderer({backend});

    renderer.init({} as HTMLCanvasElement);
    renderer.renderFrame(buildGPUFrameData({graph, frame: 15}));
    renderer.renderFrame(buildGPUFrameData({graph, frame: 16}));

    expect(calls).toEqual(["initialize", "render", "render"]);
    expect(backend.initialize).toHaveBeenCalledTimes(1);
  });

  it("dispatches frames from the RenderGraph frame source only", () => {
    const renderer = {
      renderFrame: vi.fn()
    };
    const handleFrame = createGPUAugmenterFrameHandler({
      graph,
      renderer
    });

    handleFrame(15);

    expect(renderer.renderFrame).toHaveBeenCalledWith(expect.objectContaining({
      frame: 15,
      layers: expect.any(Array)
    }));
  });

  it("keeps the WebGL modules free of internal clocks and random animation state", () => {
    const combinedSource = [
      readSource("webgl/renderer.ts"),
      readSource("webgl/useGPUAugmenter.ts"),
      readSource("webgl/bridge.ts")
    ].join("\n");

    expect(combinedSource).not.toMatch(/requestAnimationFrame/);
    expect(combinedSource).not.toMatch(/setInterval/);
    expect(combinedSource).not.toMatch(/Date\.now/);
    expect(combinedSource).not.toMatch(/performance\.now/);
    expect(combinedSource).not.toMatch(/Math\.random/);
  });

  it("mounts a passive canvas layer in Hyperframes without the old RAF-driven Three overlay", () => {
    const source = readSource("web-preview/HyperframesPreview.tsx");

    expect(source).toContain("data-gpu-augmentation-layer");
    expect(source).not.toContain("requestAnimationFrame");
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("new THREE.WebGLRenderer");
  });
});
