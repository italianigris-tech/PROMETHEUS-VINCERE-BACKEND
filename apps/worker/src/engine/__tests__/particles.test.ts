import {describe, expect, it} from "vitest";

import {
  PARTICLE_PRESETS,
  buildParticleSystem,
  estimateParticleRenderCost,
  sampleParticlesAtFrame,
  sampleParticlesAtTime
} from "../particles.js";

describe("buildParticleSystem", () => {
  it("generates the same particle metadata for the same seed", () => {
    const first = buildParticleSystem({preset: "burst", count: 12, seed: "same-shot"});
    const second = buildParticleSystem({preset: "burst", count: 12, seed: "same-shot"});
    const differentSeed = buildParticleSystem({preset: "burst", count: 12, seed: "different-shot"});

    expect(second.particles).toEqual(first.particles);
    expect(differentSeed.particles).not.toEqual(first.particles);
  });

  it("keeps generated lifetimes inside the selected preset range", () => {
    const system = buildParticleSystem({preset: "sparkle", count: 24, seed: 42});
    const lifetimeRange = PARTICLE_PRESETS.sparkle.lifetimeSeconds;

    expect(system.particles).toHaveLength(24);
    for (const particle of system.particles) {
      expect(particle.lifetimeSeconds).toBeGreaterThanOrEqual(lifetimeRange[0]);
      expect(particle.lifetimeSeconds).toBeLessThanOrEqual(lifetimeRange[1]);
      expect(particle.delaySeconds).toBeGreaterThanOrEqual(PARTICLE_PRESETS.sparkle.delaySeconds[0]);
      expect(particle.delaySeconds).toBeLessThanOrEqual(PARTICLE_PRESETS.sparkle.delaySeconds[1]);
      expect(PARTICLE_PRESETS.sparkle.palette).toContain(particle.color);
    }
  });

  it("uses meaningfully different defaults for burst, sparkle, and floating presets", () => {
    const burst = buildParticleSystem({preset: "burst", seed: "preset-check"});
    const sparkle = buildParticleSystem({preset: "sparkle", seed: "preset-check"});
    const floating = buildParticleSystem({preset: "floating", seed: "preset-check"});

    expect(burst.config.count).toBeGreaterThan(sparkle.config.count);
    expect(floating.config.loop).toBe(true);
    expect(burst.config.gravity[1]).toBeLessThan(sparkle.config.gravity[1]);
    expect(floating.config.velocitySeconds[1]).toBeLessThan(burst.config.velocitySeconds[0]);
    expect(new Set([burst.shader.blending, sparkle.shader.blending, floating.shader.blending]).size).toBeGreaterThan(1);
  });
});

describe("sampleParticlesAtTime", () => {
  it("samples deterministic positions from particle metadata without per-frame randomness", () => {
    const system = buildParticleSystem({preset: "burst", count: 8, seed: "sample"});
    const atTime = sampleParticlesAtTime(system, 0.5);
    const atSameFrame = sampleParticlesAtFrame(system, 15, 30);

    expect(atSameFrame).toEqual(atTime);
    expect(sampleParticlesAtTime(system, 0.5)).toEqual(atTime);
    expect(atTime.some((particle) => particle.alive)).toBe(true);
  });

  it("marks non-looping particles dead after their lifetime and delay have elapsed", () => {
    const system = buildParticleSystem({preset: "burst", count: 10, seed: "lifetimes"});
    const afterEveryParticleExpires =
      Math.max(...system.particles.map((particle) => particle.delaySeconds + particle.lifetimeSeconds)) + 0.05;

    expect(sampleParticlesAtTime(system, afterEveryParticleExpires).every((particle) => !particle.alive)).toBe(true);
  });

  it("wraps looping floating particles back into a live cycle", () => {
    const system = buildParticleSystem({preset: "floating", count: 10, seed: "loop"});
    const afterFirstCycle =
      Math.max(...system.particles.map((particle) => particle.delaySeconds + particle.lifetimeSeconds)) + 1;

    expect(sampleParticlesAtTime(system, afterFirstCycle).some((particle) => particle.alive)).toBe(true);
  });
});

describe("particle shader metadata", () => {
  it("describes a MeshBasicMaterial-compatible shader patch driven by particle attributes", () => {
    const system = buildParticleSystem({preset: "sparkle", count: 4, seed: "shader"});
    const shaderSource = `${system.shader.vertexPrelude}\n${system.shader.fragmentPrelude}`;

    expect(system.shader.baseMaterial).toBe("MeshBasicMaterial");
    expect(system.shader.uniforms).toContain("uTime");
    expect(system.shader.attributes).toEqual(
      expect.arrayContaining(["particlePosition", "particleVelocity", "particleLifetime", "particleColor"])
    );
    expect(shaderSource).toContain("attribute vec3 particleVelocity");
    expect(shaderSource).toContain("uniform float uTime");
    expect(shaderSource).toContain("diffuseColor");
  });
});

describe("estimateParticleRenderCost", () => {
  it("estimates stable render cost from config and generated particle sizes", () => {
    const system = buildParticleSystem({preset: "burst", count: 16, seed: "cost"});
    const estimate = estimateParticleRenderCost(system);

    expect(estimate).toMatchObject({
      particleCount: 16,
      drawCalls: 1,
      vertices: 64,
      triangles: 32,
      material: "MeshBasicMaterial"
    });
    expect(estimate.attributeFloats).toBeGreaterThan(16);
    expect(estimate.estimatedFillPixels).toBeGreaterThan(0);
  });
});
