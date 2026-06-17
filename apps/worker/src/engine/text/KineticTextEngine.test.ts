import {describe, expect, it} from "vitest";
import * as THREE from "three";

import {
  KineticTextEngine,
  parseTaggedText,
  parseWords,
  type WordAnimationState
} from "./KineticTextEngine.js";

describe("parseWords", () => {
  it("keeps word character ranges in the full text string", () => {
    expect(parseWords("Work like New Money")).toEqual([
      {text: "Work", startIndex: 0, endIndex: 4},
      {text: "like", startIndex: 5, endIndex: 9},
      {text: "New", startIndex: 10, endIndex: 13},
      {text: "Money", startIndex: 14, endIndex: 19}
    ]);
  });
});

describe("parseTaggedText", () => {
  it("builds plain text, style ranges, and per-word configs from emphasis tags", () => {
    const parsed = parseTaggedText(
      "Both have their {gold}Competitive Advantages{/gold}",
      {
        gold: {
          color: "#FFD700",
          font: "/fonts/PlayfairDisplay-Italic.woff",
          size: 0.18,
          effect: "bounce"
        }
      }
    );

    expect(parsed.plainText).toBe("Both have their Competitive Advantages");
    expect(parsed.styleRanges[16]).toEqual({
      color: "#FFD700",
      font: "/fonts/PlayfairDisplay-Italic.woff",
      size: 0.18
    });
    expect(parsed.styleRanges[38]).toBeNull();
    expect(parsed.wordConfigs[3]?.effect).toBe("bounce");
    expect(parsed.wordConfigs[4]?.color).toBe("#FFD700");
  });
});

describe("KineticTextEngine", () => {
  it("creates one Troika mesh, word boundaries, controls, and shader uniforms", () => {
    const scene = new THREE.Scene();
    const engine = new KineticTextEngine(scene, 64);

    const instance = engine.create({
      text: "Work like New Money",
      fontSize: 0.15,
      font: "/fonts/Inter-Bold.woff",
      color: "#ffffff",
      position: new THREE.Vector3(1, 2, 3),
      anchorX: "center",
      anchorY: "middle",
      stagger: 0.15,
      duration: 0.6,
      ease: "back.out(1.4)"
    });

    expect(scene.children).toHaveLength(1);
    expect(instance.mesh.text).toBe("Work like New Money");
    expect(instance.wordBoundaries).toHaveLength(4);

    const material = instance.mesh.material as THREE.MeshBasicMaterial;
    const shader = {
      uniforms: {},
      vertexShader: [
        "#include <common>",
        "void main() {",
        "#include <begin_vertex>",
        "}"
      ].join("\n"),
      fragmentShader: [
        "#include <common>",
        "void main() {",
        "#include <dithering_fragment>",
        "}"
      ].join("\n")
    } as Parameters<THREE.MeshBasicMaterial["onBeforeCompile"]>[0];

    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);

    expect(shader.uniforms.uGlyphTransformTex?.value).toBeInstanceOf(THREE.DataTexture);
    expect(shader.uniforms.uGlyphRotationTex?.value).toBeInstanceOf(THREE.DataTexture);
    expect(shader.vertexShader).toContain("uGlyphTransformTex");
    expect(shader.fragmentShader).toContain("vGlyphOpacity");

    instance.seek(0.2);
    expect(instance.timeline.time()).toBeCloseTo(0.2);

    instance.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it("applies emphasis auto-detection as per-word config", () => {
    const scene = new THREE.Scene();
    const engine = new KineticTextEngine(scene, 64);
    const instance = engine.create({
      text: "When you come from Nothing you have a Hunger",
      fontSize: 0.14,
      font: "/fonts/Inter-Regular.woff",
      color: "#ffffff",
      position: new THREE.Vector3(),
      anchorX: "center",
      anchorY: "middle",
      stagger: 0.1,
      duration: 0.5,
      ease: "expo.out",
      emphasisPattern: /\b(Nothing|Hunger)\b/,
      emphasisConfig: {
        color: "#00ffff",
        effect: "glow-pulse",
        from: {scale: 0.7, y: 40},
        to: {scale: 1.1, y: 0}
      }
    });

    expect(instance.wordConfigs[4]?.effect).toBe("glow-pulse");
    expect(instance.wordConfigs[8]?.color).toBe("#00ffff");

    instance.dispose();
  });

  it("updates word glyph texture data without replacing the mesh", () => {
    const scene = new THREE.Scene();
    const engine = new KineticTextEngine(scene, 64);
    const instance = engine.create({
      text: "Slow Down",
      fontSize: 0.1,
      font: "/fonts/Inter-Light.woff",
      color: "#cccccc",
      position: new THREE.Vector3(),
      anchorX: "center",
      anchorY: "middle",
      stagger: 0.08,
      duration: 0.3,
      ease: "none"
    });

    const state: WordAnimationState = {
      opacity: 0.5,
      x: 3,
      y: -2,
      z: 0,
      scale: 1.2,
      rotation: 0.25
    };

    engine.updateWordGlyphs(instance, 0, state);

    expect(engine.transformData[0]).toBe(3);
    expect(engine.transformData[1]).toBe(-2);
    expect(engine.transformData[2]).toBeCloseTo(1.2);
    expect(engine.transformData[3]).toBe(0.5);
    expect(engine.rotationData[0]).toBe(0.25);
    expect(scene.children[0]).toBe(instance.mesh);

    instance.dispose();
  });
});
