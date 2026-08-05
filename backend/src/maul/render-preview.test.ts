import {describe, expect, it} from "vitest";

import {buildMaulPreviewSampleTimes} from "./render-preview.js";

describe("MAUL render preview sampling", () => {
  it("samples real frame times across the complete candidate hold without oversampling one token boundary", () => {
    expect(
      buildMaulPreviewSampleTimes({
        durationMs: 3200,
        compositionHolds: [
          {startMs: 0, endMs: 1600},
          {startMs: 1600, endMs: 3200},
        ],
      }),
    ).toEqual([0, 800, 1600, 2400, 3199]);
  });

  it("keeps all requested frame samples inside a short preview", () => {
    expect(
      buildMaulPreviewSampleTimes({
        durationMs: 700,
        compositionHolds: [{startMs: 0, endMs: 700}],
      }),
    ).toEqual([0, 350, 699]);
  });
});
