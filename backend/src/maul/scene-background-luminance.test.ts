import path from "node:path";

import {describe, expect, it} from "vitest";

import {
  createRepositorySceneBackgroundLuminanceSampler,
  decodeRgbLuminanceGrid,
} from "./scene-background-luminance.js";

describe("MAUL scene background luminance", () => {
  it("decodes RGB samples into normalized relative luminance", () => {
    const grid = decodeRgbLuminanceGrid({
      columns: 2,
      rows: 1,
      bytes: Buffer.from([0, 0, 0, 255, 255, 255]),
    });

    expect(grid).toEqual({
      columns: 2,
      rows: 1,
      samples: [0, 1],
    });
  });

  it("samples a real repository video through the bundled ffmpeg", async () => {
    const sample = createRepositorySceneBackgroundLuminanceSampler({
      repoRoot: path.resolve(process.cwd(), ".."),
    });
    const grid = await sample({
      sourcePath: path.resolve(
        process.cwd(),
        "../remotion-app/public/dev-fixtures/test-video.mp4",
      ),
      sourceMs: 900,
      sourceCrop: {x: 0.3418, y: 0, width: 0.3164, height: 1},
    });

    expect(grid.columns).toBe(12);
    expect(grid.rows).toBe(20);
    expect(grid.samples).toHaveLength(240);
    expect(grid.samples.every((sample) => sample >= 0 && sample <= 1)).toBe(
      true,
    );
  });
});
