import {describe, expect, it} from "vitest";
import {renderManifestSchema} from "@prometheus/shared-types";
import gsap from "gsap";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import * as THREE from "three";

import {getRenderEngineConfig} from "../types/render-engine.js";
import {
  KINETIC_TEXT_MEASUREMENT_TIMEOUT_MS,
  applyFakeChromeEnvironment,
  buildWordLayout,
  createBakedHighlightMap,
  planKineticTextChoreography,
  shouldEnableTextBloomLayerForWord,
  shouldUseChromeText,
  splitMotionTweenVars
} from "./KineticText.js";

describe("splitMotionTweenVars", () => {
  it("routes opacity, scale, rotation, and position vars to real Three.js targets", () => {
    expect(splitMotionTweenVars({
      opacity: 0.4,
      scale: 2,
      rotation: 180,
      x: "random(-100, 100)",
      y: 12,
      z: -4,
      duration: 0.3,
      ease: "circ.out",
      ignored: true
    })).toEqual({
      common: {duration: 0.3, ease: "circ.out"},
      position: {x: "random(-100, 100)", y: 12, z: -4},
      material: {opacity: 0.4},
      scale: {x: 2, y: 2, z: 2},
      rotation: {z: Math.PI}
    });
  });

  it("drives opacity tweens through MeshBasicMaterial rather than Vector3 position", () => {
    const position = new THREE.Vector3(0, 0, 24);
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 1
    });
    const fromTracks = splitMotionTweenVars({opacity: 0, z: 24});
    const toTracks = splitMotionTweenVars({
      opacity: 1,
      z: 0,
      duration: 1,
      ease: "none"
    });
    const timeline = gsap.timeline({paused: true});

    timeline.fromTo(position, fromTracks.position, {
      ...toTracks.position,
      ...toTracks.common
    }, 0);
    timeline.fromTo(material, fromTracks.material, {
      ...toTracks.material,
      ...toTracks.common
    }, 0);

    timeline.seek(0.5, false);

    expect(Object.prototype.hasOwnProperty.call(position, "opacity")).toBe(false);
    expect(position.z).toBeCloseTo(12);
    expect(material.opacity).toBeCloseTo(0.5);

    timeline.kill();
    material.dispose();
  });

  it("keeps the Troika measurement refinement bounded for Remotion renders", () => {
    expect(KINETIC_TEXT_MEASUREMENT_TIMEOUT_MS).toBeGreaterThan(0);
    expect(KINETIC_TEXT_MEASUREMENT_TIMEOUT_MS).toBeLessThan(28000);
  });
});

describe("buildWordLayout", () => {
  it("creates a centered fallback layout without waiting for Troika measurements", () => {
    const layout = buildWordLayout([
      {
        text: "REGENERATE",
        colorRanges: [],
        startMs: 0,
        endMs: 1000,
        animated: false
      }
    ], 1);

    expect(layout).toHaveLength(1);
    expect(layout[0]?.text).toBe("REGENERATE");
    expect(layout[0]?.x).toBeCloseTo(0);
    expect(layout[0]?.width).toBeGreaterThan(0);
  });

  it("uses measured widths when they are available", () => {
    const layout = buildWordLayout([
      {
        text: "ONE",
        colorRanges: [],
        startMs: 0,
        endMs: 500,
        animated: true
      },
      {
        text: "TWO",
        colorRanges: [],
        startMs: 500,
        endMs: 1000,
        animated: true
      }
    ], 1, [4, 2]);

    expect(layout.map((word) => word.width)).toEqual([4, 2]);
    expect(layout[0]?.x).toBeLessThan(0);
    expect(layout[1]?.x).toBeGreaterThan(0);
  });
});

describe("KineticText render engine toggles", () => {
  it("upgrades legacy text render mode requests to Troika glyph rendering", () => {
    expect(getRenderEngineConfig({textRenderMode: "canvas-raster"}).renderMode).toBe("troika-glyph");
  });

  it("keeps text rasterization out of the kinetic text scene", () => {
    const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "KineticText.tsx");
    const source = readFileSync(sourcePath, "utf8");

    expect(source.toLowerCase()).not.toContain("canvas");
  });

  it("uses the single-mesh shader engine instead of rendering one Troika mesh per word", () => {
    const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "KineticText.tsx");
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("KineticTextEngine");
    expect(source).toContain("engine.create");
    expect(source).not.toContain("visuals.map");
    expect(source).not.toContain("createTroikaTextVisual");
    expect(source).not.toContain("<primitive");
  });

  it("toggles chrome text through manifest config", () => {
    expect(shouldUseChromeText({chrome: true, envMapIntensity: 0})).toBe(true);
    expect(shouldUseChromeText({chrome: false, envMapIntensity: 0})).toBe(false);
  });

  it("injects a fake chrome environment lookup into MeshBasicMaterial", () => {
    const material = new THREE.MeshBasicMaterial();
    const ramp = createBakedHighlightMap(["#111111", "#ffffff"], true);
    const shader = {
      vertexShader: [
        "void main() {",
        "#include <beginnormal_vertex>",
        "#include <begin_vertex>",
        "#include <worldpos_vertex>",
        "}"
      ].join("\n"),
      fragmentShader: [
        "void main() {",
        "#include <map_fragment>",
        "}"
      ].join("\n"),
      uniforms: {} as Record<string, THREE.IUniform>
    };

    applyFakeChromeEnvironment(material, ramp, 1);
    material.onBeforeCompile(
      shader as Parameters<THREE.MeshBasicMaterial["onBeforeCompile"]>[0],
      {} as THREE.WebGLRenderer
    );

    expect(shader.uniforms).toHaveProperty("uChromeRamp");
    expect(shader.vertexShader).toContain("vChromeViewDir");
    expect(shader.fragmentShader).toContain("texture2D(uChromeRamp");

    ramp.dispose();
    material.dispose();
  });

  it("consumes text animation grammar for word timing and selective bloom", () => {
    const manifest = renderManifestSchema.parse({
      jobId: "text-grammar-scene",
      transcript: "Hello World",
      transcriptWords: [
        {text: "Hello", startMs: 0, endMs: 900},
        {text: "World", startMs: 900, endMs: 1800}
      ],
      matteUrl: "https://example.com/matte.webm",
      audioUrl: "https://example.com/audio.m4a",
      fontUrl: "https://example.com/font.ttf",
      durationInFrames: 180,
      fps: 60,
      textAnimationGrammar: {
        version: "prometheus-text-grammar/v1",
        stagger: {
          unit: "word",
          delayMs: 200
        },
        entrance: {
          type: "slide",
          durationMs: 300
        },
        selectiveEffects: [{
          selector: {
            text: "Hello"
          },
          effects: {
            bloom: true,
            motionBlur: false,
            chromaticAberration: false
          }
        }]
      }
    });
    const layout = buildWordLayout([
      {
        text: "Hello",
        colorRanges: [],
        startMs: 0,
        endMs: 900,
        animated: true
      },
      {
        text: "World",
        colorRanges: [],
        startMs: 900,
        endMs: 1800,
        animated: true
      }
    ], 1);

    const choreography = planKineticTextChoreography(manifest, layout);

    expect(choreography?.words.map((word) => word.enterStartMs)).toEqual([0, 200]);
    expect(shouldEnableTextBloomLayerForWord(manifest, choreography, 0)).toBe(true);
    expect(shouldEnableTextBloomLayerForWord(manifest, choreography, 1)).toBe(false);
  });
});
