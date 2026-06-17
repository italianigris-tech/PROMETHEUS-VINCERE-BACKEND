import {describe, expect, it} from "vitest";
import gsap from "gsap";
import * as THREE from "three";

import {
  CameraShakeEngine,
  type ChromaticAberrationPassLike
} from "./CameraShake.js";

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

describe("CameraShakeEngine", () => {
  it("precomputes a deterministic interleaved trajectory on shake", () => {
    const rig = new THREE.Object3D();
    const engine = new CameraShakeEngine(rig, createCaPass(), {seed: 7});

    engine.shake({
      intensity: 0.5,
      duration: 0.5,
      decay: "elastic"
    });

    expect(engine.trajectory).toBeInstanceOf(Float32Array);
    expect(engine.trajectory).toHaveLength(30 * 3);
    expect(engine.sampleCount).toBe(30);
  });

  it("elastic decay peaks early then oscillates down", () => {
    const engine = new CameraShakeEngine(new THREE.Object3D(), createCaPass(), {seed: 3});

    engine.shake({
      intensity: 1,
      duration: 1,
      decay: "elastic",
      frequency: 8,
      axisBias: [0, 1]
    });

    const earlyY = Math.abs(engine.trajectory[7] ?? 0);
    const laterY = Math.abs(engine.trajectory[31] ?? 0);
    expect(earlyY).toBeGreaterThan(laterY);
  });

  it("exponential decay envelope is monotonic", () => {
    const engine = new CameraShakeEngine(new THREE.Object3D(), createCaPass(), {seed: 11});

    engine.shake({
      intensity: 1,
      duration: 0.5,
      decay: "exponential",
      axisBias: [1, 0]
    });

    let previous = Number.POSITIVE_INFINITY;
    for (let frame = 0; frame < engine.sampleCount; frame += 1) {
      const current = Math.abs(engine.trajectory[frame * 3] ?? 0);
      expect(current).toBeLessThanOrEqual(previous + 0.000001);
      previous = current;
    }
  });

  it("stop kills the active timeline and resets the rig transform", () => {
    const rig = new THREE.Object3D();
    rig.position.set(4, -2, 0);
    rig.rotation.z = 0.4;
    const engine = new CameraShakeEngine(rig, createCaPass(), {seed: 5});

    const timeline = engine.shake({
      intensity: 1,
      duration: 1,
      decay: "linear"
    });
    engine.update(0.1);
    engine.stop();

    expect(timeline.isActive()).toBe(false);
    expect(rig.position.x).toBe(0);
    expect(rig.position.y).toBe(0);
    expect(rig.rotation.z).toBe(0);
  });

  it("spikes the existing chromatic aberration pass at 30 percent of the shake", () => {
    const caPass = createCaPass();
    const engine = new CameraShakeEngine(new THREE.Object3D(), caPass, {seed: 9});

    const timeline = engine.shake({
      intensity: 1,
      duration: 1,
      decay: "elastic",
      caSpike: 0.04
    });

    timeline.seek(0.3, false);
    expect(caPass.uniforms.amount.value).toBeCloseTo(0.04, 3);
    timeline.seek(1, false);
    expect(caPass.uniforms.amount.value).toBeCloseTo(0, 3);
  });

  it("update reads the correct deterministic frame index", () => {
    const rig = new THREE.Object3D();
    const engine = new CameraShakeEngine(rig, createCaPass(), {seed: 13});

    engine.shake({
      intensity: 1,
      duration: 2,
      decay: "linear"
    });

    engine.update(1);
    const offset = 60 * 3;
    expect(rig.position.x).toBeCloseTo(engine.trajectory[offset] ?? 0);
    expect(rig.position.y).toBeCloseTo(engine.trajectory[offset + 1] ?? 0);
    expect(rig.rotation.z).toBeCloseTo(engine.trajectory[offset + 2] ?? 0);
  });

  it("uses a GSAP timeline for animation control", () => {
    const engine = new CameraShakeEngine(new THREE.Object3D(), createCaPass(), {seed: 1});

    const timeline = engine.shake({
      intensity: 0.2,
      duration: 0.25,
      decay: "linear"
    });

    expect(timeline).toBeInstanceOf(gsap.core.Timeline);
  });
});
