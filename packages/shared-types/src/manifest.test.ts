import {describe, expect, it} from "vitest";

import {renderManifestSchema, rvmExtractionResponseSchema} from "./manifest.js";

const baseManifest = {
  jobId: "sample-job",
  transcript: "REGENERATE",
  matteUrl: "https://example.com/matte.webm",
  audioUrl: "https://example.com/audio.m4a",
  fontUrl: "https://example.com/font.ttf",
  durationInFrames: 300
};

describe("renderManifestSchema", () => {
  it("defaults the cinematic render contract to 1080p60", () => {
    const manifest = renderManifestSchema.parse(baseManifest);

    expect(manifest.manifestVersion).toBe("prometheus-render-manifest/v1");
    expect(manifest.fps).toBe(60);
    expect(manifest.width).toBe(1920);
    expect(manifest.height).toBe(1080);
    expect(manifest.animationPreset).toBe("cinematic");
    expect(manifest.text.depthZ).toBeLessThan(manifest.matte.planeZ);
  });

  it("accepts Remotion static-file references for local test compositions", () => {
    const manifest = renderManifestSchema.parse({
      ...baseManifest,
      matteUrl: "/static-sample/matte.webm",
      audioUrl: "./samples/audio.m4a",
      fontUrl: "../fonts/Fraunces.ttf"
    });

    expect(manifest.matteUrl).toBe("/static-sample/matte.webm");
  });

  it("rejects matte timing that cannot frame-lock to the composition", () => {
    const result = renderManifestSchema.safeParse({
      ...baseManifest,
      fps: 60,
      durationInFrames: 300,
      matte: {
        fps: 30,
        durationInFrames: 299
      }
    });

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path.join("."))).toEqual([
      "matte.fps",
      "matte.durationInFrames"
    ]);
  });
});

describe("rvmExtractionResponseSchema", () => {
  it("describes the matte artifact needed by the render worker", () => {
    const response = rvmExtractionResponseSchema.parse({
      jobId: "rvm-job",
      matteUrl: "file:///tmp/rvm-job/matte.webm",
      audioUrl: "file:///tmp/rvm-job/audio.m4a",
      durationSeconds: 5,
      durationInFrames: 300,
      fps: 60,
      width: 1920,
      height: 1080
    });

    expect(response.matteUrl.endsWith("matte.webm")).toBe(true);
  });
});
