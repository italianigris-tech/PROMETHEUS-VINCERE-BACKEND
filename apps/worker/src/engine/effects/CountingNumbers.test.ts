import {describe, expect, it, vi} from "vitest";
import gsap from "gsap";
import * as THREE from "three";
import {ShaderPass} from "three/examples/jsm/postprocessing/ShaderPass.js";

import {
  CountingNumbersEngine,
  NUMBER_MOTION_BLUR_SHADER,
  type ChromaticAberrationPassLike
} from "./CountingNumbers.js";

type ChromaticAberrationPassWithAmount = ChromaticAberrationPassLike & {
  uniforms: {
    amount: {value: number};
  };
};

const createCaPass = (): ChromaticAberrationPassWithAmount => ({
  uniforms: {
    amount: {value: 0}
  }
});

describe("CountingNumbersEngine", () => {
  it("creates one Troika text mesh with a GSAP timeline and formatted initial value", () => {
    const scene = new THREE.Scene();
    const engine = new CountingNumbersEngine(scene);

    const counter = engine.create({
      from: 0,
      to: 1107,
      duration: 1,
      prefix: "$",
      font: "/fonts/Inter-Bold.woff",
      fontSize: 0.4,
      color: "#ffffff",
      position: new THREE.Vector3(1, 2, 3)
    });

    expect(scene.children).toHaveLength(1);
    expect(counter.mesh.text).toBe("$0");
    expect(counter.timeline).toBeInstanceOf(gsap.core.Timeline);
    expect(counter.motionBlurPass).toBeInstanceOf(ShaderPass);
    expect(NUMBER_MOTION_BLUR_SHADER.fragmentShader).toContain("uVelocity");

    counter.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it("updates the single mesh text and motion-blur velocity as the timeline advances", () => {
    const scene = new THREE.Scene();
    const engine = new CountingNumbersEngine(scene);
    const counter = engine.create({
      from: 0,
      to: 5000,
      duration: 1,
      prefix: "$",
      decimals: 0
    });

    counter.seek(0.5);

    expect(counter.mesh.text).toBe("$2,500");
    expect(counter.motionBlurPass.uniforms.uVelocity.value).toBeGreaterThan(0);
    expect(scene.children).toEqual([counter.mesh]);

    counter.dispose();
  });

  it("supports decimal and suffix formatting without replacing the Troika mesh", () => {
    const scene = new THREE.Scene();
    const engine = new CountingNumbersEngine(scene);
    const counter = engine.create({
      from: 1,
      to: 2.5,
      duration: 1,
      decimals: 1,
      suffix: "x"
    });
    const mesh = counter.mesh;

    counter.seek(1);

    expect(counter.mesh).toBe(mesh);
    expect(counter.mesh.text).toBe("2.5x");

    counter.dispose();
  });

  it("spikes the existing chromatic aberration pass near landing without duplicating CA shader code", () => {
    const caPass = createCaPass();
    const engine = new CountingNumbersEngine(new THREE.Scene(), {caPass});
    const counter = engine.create({
      from: 0,
      to: 100,
      duration: 1,
      caSpike: 0.035
    });

    counter.seek(0.9);
    expect(caPass.uniforms.amount.value).toBeGreaterThan(0);
    counter.seek(1);
    expect(caPass.uniforms.amount.value).toBeCloseTo(0, 3);

    counter.dispose();
  });

  it("fires the landing callback once when the timeline completes", () => {
    const onLanding = vi.fn();
    const engine = new CountingNumbersEngine(new THREE.Scene());
    const counter = engine.create({
      from: 0,
      to: 42,
      duration: 0.5,
      onLanding
    });

    counter.seek(0.5);
    counter.seek(0.5);

    expect(onLanding).toHaveBeenCalledTimes(1);

    counter.dispose();
  });

  it("disposes the mesh, timeline, and motion-blur pass cleanly", () => {
    const scene = new THREE.Scene();
    const engine = new CountingNumbersEngine(scene);
    const counter = engine.create({
      from: 0,
      to: 1000,
      duration: 1
    });
    const disposeSpy = vi.spyOn(counter.motionBlurPass, "dispose");

    counter.dispose();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(counter.timeline.isActive()).toBe(false);
    expect(scene.children).toHaveLength(0);
  });
});
