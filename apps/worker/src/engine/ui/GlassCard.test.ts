import {describe, expect, it} from "vitest";
import * as THREE from "three";

import {
  GlassCardEngine,
  GlassCardPresets,
  GlassCardShaderChunks,
  createGlassCardMaterial
} from "./GlassCard.js";

describe("GlassCardEngine", () => {
  it("creates a glass card with Gadzhi-style defaults", () => {
    const scene = new THREE.Scene();
    const engine = new GlassCardEngine(scene);
    const card = engine.create({
      width: 2,
      height: 1
    });

    expect(scene.children).toHaveLength(1);
    expect(card.mesh).toBeInstanceOf(THREE.Mesh);
    expect(card.material).toBeInstanceOf(THREE.ShaderMaterial);
    expect(card.material.uniforms.uBackgroundAlpha.value).toBe(0.05);
    expect(card.material.uniforms.uCornerRadius.value).toBe(16);
    expect(card.material.uniforms.uNoiseEnabled.value).toBe(true);
    expect(card.material.uniforms.uInnerShadowEnabled.value).toBe(true);

    card.dispose();
  });

  it("applies preset configurations through the public engine interface", () => {
    const scene = new THREE.Scene();
    const engine = new GlassCardEngine(scene);

    const infoCard = engine.create({
      width: 2,
      height: 1,
      ...GlassCardPresets.info()
    });
    const pillCard = engine.create({
      width: 3,
      height: 0.8,
      ...GlassCardPresets.pricingPill()
    });

    expect(infoCard.material.uniforms.uCornerRadius.value).toBe(16);
    expect(infoCard.material.uniforms.uBlurAmount.value).toBe(40);
    expect(pillCard.material.uniforms.uGradientBorderEnabled.value).toBe(true);
    expect(pillCard.material.uniforms.uGradientColors.value[0]).toBeInstanceOf(THREE.Vector3);

    infoCard.dispose();
    pillCard.dispose();
  });

  it("exposes shader chunks with rounded-rect SDF, noise, and gradient border logic", () => {
    const material = createGlassCardMaterial({
      width: 1,
      height: 1,
      gradientBorder: {
        enabled: true,
        colors: [new THREE.Color("#00ffff"), new THREE.Color("#ff00ff")]
      }
    });

    expect(GlassCardShaderChunks.fragment).toContain("sdRoundedRect");
    expect(GlassCardShaderChunks.fragment).toContain("noise(");
    expect(GlassCardShaderChunks.fragment).toContain("gradientColor");
    expect(material.uniforms.uGradientBorderEnabled.value).toBe(true);
    expect(material.uniforms.uGradientSpeed.value).toBeGreaterThan(0);

    material.dispose();
  });

  it("updates animation time, opacity, scale, and textures without replacing the mesh", () => {
    const scene = new THREE.Scene();
    const engine = new GlassCardEngine(scene);
    const card = engine.create({
      width: 1,
      height: 1,
      gradientBorder: {
        enabled: true,
        colors: [new THREE.Color("#ffffff"), new THREE.Color("#aaaaaa")],
        speed: 1
      }
    });
    const mesh = card.mesh;
    const contentTexture = new THREE.Texture();
    const backgroundTexture = new THREE.Texture();

    engine.update(1.25);
    card.setOpacity(0.08);
    card.setScale(1.4);
    card.setGradientSpeed(0.5);
    card.setContentTexture(contentTexture);
    card.setBackgroundTexture(backgroundTexture);

    expect(card.mesh).toBe(mesh);
    expect(card.material.uniforms.uTime.value).toBe(1.25);
    expect(card.material.uniforms.uBackgroundAlpha.value).toBe(0.08);
    expect(card.mesh.scale.x).toBeCloseTo(1.4);
    expect(card.material.uniforms.uGradientSpeed.value).toBeCloseTo(Math.PI);
    expect(card.material.uniforms.uContentTextureEnabled.value).toBe(true);
    expect(card.material.uniforms.uBackgroundTextureEnabled.value).toBe(true);

    card.dispose();
    contentTexture.dispose();
    backgroundTexture.dispose();
  });

  it("cleans up geometry, material, and scene membership", () => {
    const scene = new THREE.Scene();
    const engine = new GlassCardEngine(scene);
    const card = engine.create({width: 1, height: 1});
    const geometry = card.mesh.geometry;
    const material = card.material;

    card.dispose();

    expect(scene.children).toHaveLength(0);
    expect(geometry.boundingBox).toBeNull();
    expect(material.uniforms.uTime.value).toBe(0);
  });
});
