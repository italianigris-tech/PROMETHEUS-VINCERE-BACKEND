import {createHash} from "node:crypto";

import {describe, expect, it} from "vitest";

import {observeRenderedComposition} from "./composition-observer.js";
import {encodeRgbaPng} from "./png-rgba.js";

const makeFrame = ({
  width = 24,
  height = 24,
  rectangles = [],
}: {
  width?: number;
  height?: number;
  rectangles?: Array<{x: number; y: number; width: number; height: number; color: [number, number, number, number]}>;
}) => {
  const pixels = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) pixels[index * 4 + 3] = 255;
  for (const rectangle of rectangles) {
    for (let y = rectangle.y; y < rectangle.y + rectangle.height; y += 1) {
      for (let x = rectangle.x; x < rectangle.x + rectangle.width; x += 1) {
        const offset = (y * width + x) * 4;
        for (let channel = 0; channel < 4; channel += 1) {
          pixels[offset + channel] = rectangle.color[channel]!;
        }
      }
    }
  }
  const bytes = encodeRgbaPng({width, height, pixels});
  return {
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width,
    height,
  };
};

const sample = (outputMs: number, frame: ReturnType<typeof makeFrame>) => ({
  outputMs,
  bytes: frame.bytes,
  sha256: frame.sha256,
  contentType: "image/png" as const,
});

describe("Observed Composition", () => {
  it("blocks arbitrary bytes instead of manufacturing observation evidence", () => {
    const bytes = Buffer.from("not a png");
    const observed = observeRenderedComposition({
      observationId: "observed_invalid",
      declarationId: "declared_invalid",
      renderedFrames: [{
        outputMs: 1000,
        bytes,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        contentType: "image/png",
      }],
      sourceFrames: [],
      subjectMask: null,
      semanticRegions: [],
      fontCapabilityEvidence: null,
    });

    expect(observed.status).toBe("blocked");
    expect(observed.failures).toEqual(expect.arrayContaining([
      expect.stringMatching(/invalid signature|source-grounded control/i),
    ]));
    expect(observed.measurements.textBounds.status).toBe("unobserved");
  });

  it("measures text geometry, hierarchy, overlap, and stability from frame pixels", () => {
    const source = makeFrame({});
    const rendered = makeFrame({
      rectangles: [
        {x: 2, y: 3, width: 8, height: 3, color: [255, 255, 255, 255]},
        {x: 4, y: 12, width: 16, height: 6, color: [246, 196, 83, 255]},
      ],
    });
    const alpha = Buffer.alloc(24 * 24);
    for (let y = 10; y < 22; y += 1) {
      for (let x = 0; x < 12; x += 1) alpha[y * 24 + x] = 255;
    }

    const observed = observeRenderedComposition({
      observationId: "observed_valid",
      declarationId: "declared_valid",
      renderedFrames: [sample(1000, rendered), sample(3000, rendered)],
      sourceFrames: [sample(1000, source), sample(3000, source)],
      subjectMask: {width: 24, height: 24, alpha, sha256: "a".repeat(64)},
      semanticRegions: [
        {class: "critical", label: "eyes", box: {x: 0, y: 0, width: 0.5, height: 0.1}},
        {class: "flexible", label: "torso", box: {x: 0, y: 0.4, width: 0.5, height: 0.55}},
      ],
      fontCapabilityEvidence: {
        status: "verified",
        assetId: "font_hero",
        family: "Almera",
        sha256: "b".repeat(64),
        evidenceId: "fontkit_probe_a",
      },
      differenceThreshold: 16,
    });

    expect(observed.status).toBe("observed");
    expect(observed.measurements.textBounds).toMatchObject({
      status: "observed",
      value: {leftPx: 2, topPx: 3, rightPx: 20, bottomPx: 18},
    });
    expect(observed.measurements.lineCount).toMatchObject({status: "observed", value: 2});
    if (
      observed.measurements.hierarchyAreaRatio.status === "unobserved" ||
      observed.measurements.subjectIntersectionRatio.status === "unobserved" ||
      observed.measurements.criticalIntersectionRatio.status === "unobserved" ||
      observed.measurements.temporalStability.status === "unobserved"
    ) throw new Error("Expected measured composition fields.");
    expect(observed.measurements.hierarchyAreaRatio.value).toBeGreaterThan(3);
    expect(observed.measurements.subjectIntersectionRatio.value).toBeGreaterThan(0);
    expect(observed.measurements.criticalIntersectionRatio.value).toBe(0);
    expect(observed.measurements.temporalStability.value).toBe(1);
    expect(observed.measurements.fontIdentity).toMatchObject({
      status: "inferred",
      value: {assetId: "font_hero", family: "Almera"},
    });
    expect(observed.measurements.depthMode.status).toBe("unobserved");
  });

  it("never copies absent font, mask, treatment, or motion evidence from intent", () => {
    const source = makeFrame({});
    const rendered = makeFrame({
      rectangles: [{x: 3, y: 4, width: 8, height: 4, color: [255, 255, 255, 255]}],
    });
    const observed = observeRenderedComposition({
      observationId: "observed_sparse",
      declarationId: "declared_with_rich_intent",
      renderedFrames: [sample(1000, rendered)],
      sourceFrames: [sample(1000, source)],
      subjectMask: null,
      semanticRegions: [],
      fontCapabilityEvidence: null,
    });

    expect(observed.measurements.fontIdentity.status).toBe("unobserved");
    expect(observed.measurements.subjectIntersectionRatio.status).toBe("unobserved");
    expect(observed.measurements.depthMode.status).toBe("unobserved");
    expect(observed.measurements.temporalStability.status).toBe("unobserved");
    expect(observed.measurements.treatmentVisibility.status).toBe("observed");
  });
});
