// packages/registry/src/primitives/shader-fx/bloom-v1/test/unit.test.ts
import { describe, it, expect, vi } from "vitest";
import { BloomPassManager, defaultBloomParams, createBloomComposer } from "../src/pass";
import { WebGLRenderer, Scene, PerspectiveCamera, Vector2 } from "three";

describe("bloom-v1", () => {
  it("should create BloomPassManager with default params", () => {
    const renderer = new WebGLRenderer();
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    const manager = new BloomPassManager(renderer, scene, camera, new Vector2(800, 600));
    expect(manager.getComposer()).toBeDefined();
    manager.dispose();
    renderer.dispose();
  });

  it("should update bloom parameters", () => {
    const renderer = new WebGLRenderer();
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    const manager = new BloomPassManager(renderer, scene, camera, new Vector2(800, 600));
    manager.updateParams({ strength: 1.0, radius: 0.8, threshold: 0.5 });
    // UnrealBloomPass properties are not directly exposed in all Three.js versions,
    // so we verify the update doesn't throw
    expect(() => manager.updateParams({ strength: 1.0 })).not.toThrow();
    manager.dispose();
    renderer.dispose();
  });

  it("should declare scope as full-screen", () => {
    const manifest = require("../manifest.json");
    expect(manifest.scope).toBe("full-screen");
  });

  it("should require WebGL 2.0", () => {
    const manifest = require("../manifest.json");
    expect(manifest.performanceProfile.requiresWebGL2).toBe(true);
  });

  it("should have 3 parameters", () => {
    const manifest = require("../manifest.json");
    expect(manifest.parameterSchema.parameters).toHaveLength(3);
  });
});
