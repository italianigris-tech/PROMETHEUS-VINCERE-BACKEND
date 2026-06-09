// packages/bridge/src/composition-engine.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { CompositionEngine, CompositionError } from "./composition-engine";
import { Registry } from "@prometheus/registry";
import type { CompositionManifest, Primitive } from "@prometheus/registry";

// Mock registry with test primitives
const mockPrimitives: Primitive[] = [
  {
    id: "test-per-element-v1",
    name: "Test Per-Element",
    category: "shader-fx",
    subcategory: "test",
    description: "A per-element test primitive",
    visualSignature: "test",
    implementation: { entryPoint: "", logicModule: "" },
    parameterSchema: { parameters: [] },
    scope: "per-element",
    targetType: "text",
    performanceProfile: {
      gpuCost: "low", cpuCost: "low", fpsImpact30: 30, fpsImpact60: 60,
      vramMB: 8, drawCallOverhead: 0, requiresWebGL2: false, postProcessCompatible: true,
    },
    provenance: {
      sourceVideo: "", sourceVideoTitle: "", timestampStart: "", timestampEnd: "",
      frameRange: [0, 0], extractedBy: "human", extractionDate: "", visualVerification: "passed",
    },
    confidence: { overall: 0.9, visualAccuracy: 0.9, codeStability: 0.9, reuseCount: 0, lastUsed: "", failureCount: 0 },
    requires: [], conflicts: [], tags: [],
  },
  {
    id: "test-full-screen-v1",
    name: "Test Full-Screen",
    category: "shader-fx",
    subcategory: "test",
    description: "A full-screen test primitive",
    visualSignature: "test",
    implementation: { entryPoint: "", logicModule: "" },
    parameterSchema: { parameters: [] },
    scope: "full-screen",
    targetType: "post-process",
    performanceProfile: {
      gpuCost: "high", cpuCost: "low", fpsImpact30: 20, fpsImpact60: 40,
      vramMB: 64, drawCallOverhead: 0, requiresWebGL2: true, postProcessCompatible: true,
    },
    provenance: {
      sourceVideo: "", sourceVideoTitle: "", timestampStart: "", timestampEnd: "",
      frameRange: [0, 0], extractedBy: "human", extractionDate: "", visualVerification: "passed",
    },
    confidence: { overall: 0.9, visualAccuracy: 0.9, codeStability: 0.9, reuseCount: 0, lastUsed: "", failureCount: 0 },
    requires: [], conflicts: [], tags: [],
  },
];

describe("CompositionEngine", () => {
  let engine: CompositionEngine;
  let registry: Registry;

  beforeEach(() => {
    registry = Registry.fromPrimitives(mockPrimitives);
    engine = new CompositionEngine(registry);
  });

  it("should validate a valid manifest", () => {
    const manifest: CompositionManifest = {
      version: "7.5",
      id: "test-001",
      layers: [
        {
          id: "text-layer",
          name: "Text",
          type: "text",
          zIndex: 0,
          content: { text: "HELLO", font: "Inter", fontSize: 2 },
          primitives: [
            { primitiveId: "test-per-element-v1", parameters: {}, startAt: 0, duration: 1, easing: "none" },
          ],
          visible: true,
        },
      ],
      global: { resolution: [1920, 1080], fps: 30, backgroundColor: "#000000", postProcess: { enabled: false, passes: [] } },
      camera: { primitives: [] },
      timeline: [],
    };

    const result = engine.validate(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject per-element primitive on background layer", () => {
    const manifest: CompositionManifest = {
      version: "7.5",
      id: "test-002",
      layers: [
        {
          id: "bg-layer",
          name: "Background",
          type: "background",
          zIndex: 0,
          content: { type: "color" },
          primitives: [
            { primitiveId: "test-per-element-v1", parameters: {}, startAt: 0, duration: 1, easing: "none" },
          ],
          visible: true,
        },
      ],
      global: { resolution: [1920, 1080], fps: 30, backgroundColor: "#000000", postProcess: { enabled: false, passes: [] } },
      camera: { primitives: [] },
      timeline: [],
    };

    const result = engine.validate(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "scope-background-mismatch")).toBe(true);
  });

  it("should reject full-screen post-process with video background", () => {
    const manifest: CompositionManifest = {
      version: "7.5",
      id: "test-003",
      layers: [
        {
          id: "bg-layer",
          name: "Background",
          type: "background",
          zIndex: 0,
          content: { type: "video" },
          primitives: [],
          visible: true,
        },
      ],
      global: {
        resolution: [1920, 1080],
        fps: 30,
        backgroundColor: "#000000",
        postProcess: {
          enabled: true,
          passes: [{ primitiveId: "test-full-screen-v1", parameters: {} }],
        },
      },
      camera: { primitives: [] },
      timeline: [],
    };

    const result = engine.validate(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "post-process-video-conflict")).toBe(true);
  });

  it("should reject missing primitive", () => {
    const manifest: CompositionManifest = {
      version: "7.5",
      id: "test-004",
      layers: [
        {
          id: "text-layer",
          name: "Text",
          type: "text",
          zIndex: 0,
          content: { text: "HELLO", font: "Inter", fontSize: 2 },
          primitives: [
            { primitiveId: "nonexistent-v1", parameters: {}, startAt: 0, duration: 1, easing: "none" },
          ],
          visible: true,
        },
      ],
      global: { resolution: [1920, 1080], fps: 30, backgroundColor: "#000000", postProcess: { enabled: false, passes: [] } },
      camera: { primitives: [] },
      timeline: [],
    };

    const result = engine.validate(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "primitive-not-found")).toBe(true);
  });
});
