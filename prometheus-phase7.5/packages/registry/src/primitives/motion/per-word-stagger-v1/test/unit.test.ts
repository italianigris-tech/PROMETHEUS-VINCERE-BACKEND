// packages/registry/src/primitives/motion/per-word-stagger-v1/test/unit.test.ts
import { describe, it, expect, vi } from "vitest";
import { buildStaggerTimeline, defaultStaggerParams, splitTextToWords } from "../src/logic";
import { Object3D } from "three";
import gsap from "gsap";

describe("per-word-stagger-v1", () => {
  it("should split text into words correctly", () => {
    expect(splitTextToWords("NOT YOUR AVERAGE MOTION DESIGN")).toEqual([
      "NOT", "YOUR", "AVERAGE", "MOTION", "DESIGN",
    ]);
  });

  it("should build a timeline with correct number of tweens", () => {
    const words = [new Object3D(), new Object3D(), new Object3D()];
    const tl = buildStaggerTimeline(words, { delay: 0.1, duration: 0.5 });
    expect(tl.getChildren().length).toBe(3);
  });

  it("should apply default parameters", () => {
    const words = [new Object3D()];
    const tl = buildStaggerTimeline(words);
    const tween = tl.getChildren()[0] as gsap.core.Tween;
    expect(tween.duration()).toBe(defaultStaggerParams.duration);
  });

  it("should stagger with correct delay", () => {
    const words = [new Object3D(), new Object3D()];
    const tl = buildStaggerTimeline(words, { delay: 0.2 });
    const children = tl.getChildren();
    expect(children[0].startTime()).toBe(0);
    expect(children[1].startTime()).toBe(0.2);
  });

  it("should declare scope as per-element", () => {
    const manifest = require("../manifest.json");
    expect(manifest.scope).toBe("per-element");
  });

  it("should have 7 parameters", () => {
    const manifest = require("../manifest.json");
    expect(manifest.parameterSchema.parameters).toHaveLength(7);
  });
});
