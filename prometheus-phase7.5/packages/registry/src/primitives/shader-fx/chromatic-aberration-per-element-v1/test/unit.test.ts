// packages/registry/src/primitives/shader-fx/chromatic-aberration-per-element-v1/test/unit.test.ts
import { describe, it, expect } from "vitest";
import { CACompositor, defaultCAParams } from "../src/fbo-compositor";
import { ShaderMaterial } from "three";

describe("chromatic-aberration-per-element-v1", () => {
  it("should create a CACompositor with default params", () => {
    const comp = new CACompositor(512, 256);
    expect(comp.getMaterial()).toBeInstanceOf(ShaderMaterial);
    expect(comp.getMaterial().uniforms.uIntensity.value).toBe(defaultCAParams.intensity);
    expect(comp.getMaterial().uniforms.uAngle.value).toBe(defaultCAParams.angle);
    comp.dispose();
  });

  it("should update parameters", () => {
    const comp = new CACompositor(512, 256);
    comp.updateParams({ intensity: 0.03, angle: 90 });
    expect(comp.getMaterial().uniforms.uIntensity.value).toBe(0.03);
    expect(comp.getMaterial().uniforms.uAngle.value).toBe(90);
    comp.dispose();
  });

  it("should declare scope as per-element", () => {
    const manifest = require("../manifest.json");
    expect(manifest.scope).toBe("per-element");
  });

  it("should conflict with full-screen variant", () => {
    const manifest = require("../manifest.json");
    expect(manifest.conflicts).toContain("chromatic-aberration-full-screen-v1");
  });

  it("should have 2 parameters", () => {
    const manifest = require("../manifest.json");
    expect(manifest.parameterSchema.parameters).toHaveLength(2);
  });
});
