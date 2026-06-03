import {describe, expect, it} from "vitest";

import {DEFAULT_SDF_GLYPH_SIZE, toExactCharacterSet} from "./font-preload.js";

describe("font preload settings", () => {
  it("uses a cinematic SDF atlas size and preloads each glyph once", () => {
    expect(DEFAULT_SDF_GLYPH_SIZE).toBe(256);
    expect(toExactCharacterSet("REGENERATE")).toBe("REGNAT");
  });
});
