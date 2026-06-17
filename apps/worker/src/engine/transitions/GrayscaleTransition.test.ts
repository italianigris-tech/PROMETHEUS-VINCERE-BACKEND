import {describe, expect, it, vi} from "vitest";
import * as THREE from "three";
import {ShaderPass} from "three/examples/jsm/postprocessing/ShaderPass.js";

import {
  GRAYSCALE_FRAGMENT_SHADER,
  GrayscaleTransitionEngine,
  type ComposerLike
} from "./GrayscaleTransition.js";

const createComposer = (): ComposerLike => {
  const passes: unknown[] = [];
  return {
    passes,
    addPass: (pass: unknown) => {
      passes.push(pass);
    }
  };
};

describe("GrayscaleTransitionEngine", () => {
  it("creates a ShaderPass with saturation, LUT, and vignette controls", () => {
    const composer = createComposer();
    const lut = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, THREE.RGBAFormat);
    const gray = new GrayscaleTransitionEngine(composer).create({
      desaturateDuration: 0.5,
      restoreDuration: 0.5,
      lutTexture: lut,
      lutIntensity: 0.7,
      vignetteBoost: {
        enabled: true,
        intensity: 0.35,
        radius: 0.65
      }
    });

    expect(gray.pass).toBeInstanceOf(ShaderPass);
    expect(gray.pass.uniforms.uSaturation.value).toBe(1);
    expect(gray.pass.uniforms.uLUT.value).toBe(lut);
    expect(gray.pass.uniforms.uLUTEnabled.value).toBe(true);
    expect(gray.pass.uniforms.uLUTIntensity.value).toBe(0.7);
    expect(gray.pass.uniforms.uVignetteEnabled.value).toBe(true);
    expect(GRAYSCALE_FRAGMENT_SHADER).toContain("applySaturation");
    expect(GRAYSCALE_FRAGMENT_SHADER).toContain("applyLUT");
    expect(GRAYSCALE_FRAGMENT_SHADER).toContain("vignette");

    gray.dispose();
    lut.dispose();
  });

  it("clamps saturation and removes its pass from the composer", () => {
    const composer = createComposer();
    const gray = new GrayscaleTransitionEngine(composer).create({
      desaturateDuration: 0.5,
      restoreDuration: 0.5
    });

    expect(composer.passes).toEqual([gray.pass]);
    expect(gray.isGrayscale).toBe(false);

    gray.setSaturation(-1);
    expect(gray.saturation).toBe(0);
    expect(gray.isGrayscale).toBe(true);

    gray.setSaturation(2);
    expect(gray.saturation).toBe(1);
    expect(gray.isGrayscale).toBe(false);

    gray.dispose();
    expect(composer.passes).toEqual([]);
  });

  it("desaturates and restores with requestAnimationFrame timing", async () => {
    vi.useFakeTimers();
    let now = 0;
    const originalPerformanceNow = globalThis.performance.now;
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    vi.spyOn(globalThis.performance, "now").mockImplementation(() => now);
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
      setTimeout(() => {
        now += 50;
        callback(now);
      }, 0);
      return 1;
    }) as typeof requestAnimationFrame;

    const gray = new GrayscaleTransitionEngine(createComposer()).create({
      desaturateDuration: 0.1,
      restoreDuration: 0.1,
      saturationEase: "power2.inOut"
    });

    const desaturate = gray.desaturate();
    await vi.runAllTimersAsync();
    await desaturate;
    expect(gray.saturation).toBe(0);
    expect(gray.isGrayscale).toBe(true);

    const restore = gray.restore();
    await vi.runAllTimersAsync();
    await restore;
    expect(gray.saturation).toBe(1);
    expect(gray.isGrayscale).toBe(false);

    gray.dispose();
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    vi.spyOn(globalThis.performance, "now").mockImplementation(originalPerformanceNow.bind(globalThis.performance));
    vi.useRealTimers();
  });
});
