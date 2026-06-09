// packages/registry/src/primitives/material/chrome-text-v1/test/unit.test.ts
import { describe, it, expect } from "vitest";
import { createChromeMaterial, defaultChromeParams, generateProceduralEnvMap } from "../src/material";
import { MeshStandardMaterial, Color } from "three";

describe("chrome-text-v1", () => {
  it("should create a MeshStandardMaterial (NOT MeshBasicMaterial)", () => {
    const mat = createChromeMaterial({});
    expect(mat).toBeInstanceOf(MeshStandardMaterial);
    expect(mat.type).toBe("MeshStandardMaterial");
  });

  it("should apply default parameters correctly", () => {
    const mat = createChromeMaterial({});
    expect(mat.metalness).toBe(defaultChromeParams.metalness);
    expect(mat.roughness).toBe(defaultChromeParams.roughness);
    expect(mat.envMapIntensity).toBe(defaultChromeParams.envMapIntensity);
    expect(mat.color).toEqual(new Color(defaultChromeParams.color));
  });

  it("should override parameters when provided", () => {
    const mat = createChromeMaterial({
      metalness: 0.5,
      roughness: 0.8,
      color: "#FF0040",
    });
    expect(mat.metalness).toBe(0.5);
    expect(mat.roughness).toBe(0.8);
    expect(mat.color).toEqual(new Color("#FF0040"));
  });

  it("should accept an envMap", () => {
    // Mock renderer
    const mockRenderer = { outputColorSpace: 0 };
    const envMap = generateProceduralEnvMap(mockRenderer);
    const mat = createChromeMaterial({}, envMap);
    expect(mat.envMap).toBeDefined();
    envMap.dispose();
  });

  it("should have parameter schema with 5 parameters", () => {
    const manifest = require("../manifest.json");
    expect(manifest.parameterSchema.parameters).toHaveLength(5);
    expect(manifest.parameterSchema.parameters.map((p: any) => p.key)).toEqual([
      "extrudeDepth",
      "metalness",
      "roughness",
      "envMapIntensity",
      "color",
    ]);
  });

  it("should declare scope as per-element", () => {
    const manifest = require("../manifest.json");
    expect(manifest.scope).toBe("per-element");
  });

  it("should require envMap", () => {
    const manifest = require("../manifest.json");
    expect(manifest.implementation.materialConfig.envMapRequired).toBe(true);
  });
});
