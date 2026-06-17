import {describe, expect, it, vi} from "vitest";
import * as THREE from "three";
import {ShaderPass} from "three/examples/jsm/postprocessing/ShaderPass.js";

import {
  WIPE_FRAGMENT_SHADER,
  WipeTransitionEngine,
  type ComposerLike
} from "./WipeTransition.js";

const createTexture = (r: number, g: number, b: number): THREE.DataTexture => {
  const texture = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
};

const createComposer = (): ComposerLike => {
  const passes: unknown[] = [];
  return {
    passes,
    addPass: (pass: unknown) => {
      passes.push(pass);
    }
  };
};

describe("WipeTransitionEngine", () => {
  it("creates a ShaderPass with wipe masks, edge glow, and enum uniforms", () => {
    const composer = createComposer();
    const sceneA = createTexture(255, 0, 0);
    const sceneB = createTexture(0, 255, 0);
    const engine = new WipeTransitionEngine(composer);

    const wipe = engine.create({
      type: "curve",
      direction: "right",
      duration: 0.6,
      sceneA,
      sceneB,
      edgeSoftness: 0.35,
      edgeColor: new THREE.Color("#99ccff"),
      edgeGlowIntensity: 0.4
    });

    expect(wipe.pass).toBeInstanceOf(ShaderPass);
    expect(wipe.pass.uniforms.tDiffuse.value).toBe(sceneA);
    expect(wipe.pass.uniforms.tSceneB.value).toBe(sceneB);
    expect(wipe.pass.uniforms.uWipeType.value).toBe(1);
    expect(wipe.pass.uniforms.uDirection.value).toBe(1);
    expect(wipe.pass.uniforms.uEdgeSoftness.value).toBe(0.35);
    expect(WIPE_FRAGMENT_SHADER).toContain("curveWipe");
    expect(WIPE_FRAGMENT_SHADER).toContain("circleWipe");
    expect(WIPE_FRAGMENT_SHADER).toContain("edgeGlow");

    wipe.dispose();
    sceneA.dispose();
    sceneB.dispose();
  });

  it("adds and removes passes from the composer and clamps progress", () => {
    const composer = createComposer();
    const texture = createTexture(255, 255, 255);
    const engine = new WipeTransitionEngine(composer);
    const wipe = engine.create({
      type: "line",
      direction: "left",
      duration: 0.5,
      sceneA: texture,
      sceneB: texture
    });

    expect(composer.passes).toEqual([wipe.pass]);

    wipe.setProgress(2);
    expect(wipe.progress).toBe(1);
    expect(wipe.pass.uniforms.uProgress.value).toBe(1);

    wipe.setProgress(-1);
    expect(wipe.progress).toBe(0);

    wipe.dispose();
    expect(composer.passes).toEqual([]);
    texture.dispose();
  });

  it("animates progress with requestAnimationFrame timing", async () => {
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

    const composer = createComposer();
    const texture = createTexture(255, 255, 255);
    const wipe = new WipeTransitionEngine(composer).create({
      type: "circle",
      direction: "center-out",
      duration: 0.1,
      sceneA: texture,
      sceneB: texture
    });

    const promise = wipe.animateTo(1, 0.1, "power2.inOut");
    await vi.runAllTimersAsync();
    await promise;

    expect(wipe.progress).toBe(1);

    wipe.dispose();
    texture.dispose();
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    vi.spyOn(globalThis.performance, "now").mockImplementation(originalPerformanceNow.bind(globalThis.performance));
    vi.useRealTimers();
  });
});
