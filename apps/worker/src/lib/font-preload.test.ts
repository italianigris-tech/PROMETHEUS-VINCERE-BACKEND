import {describe, expect, it} from "vitest";

import {
  DEFAULT_SDF_GLYPH_SIZE,
  FONT_PRELOAD_TIMEOUT_MS,
  isTroikaCompatibleFontUrl,
  resolveTroikaFontUrl,
  toExactCharacterSet
} from "./font-preload.js";

describe("font preload settings", () => {
  it("uses a cinematic SDF atlas size and preloads each glyph once", () => {
    expect(DEFAULT_SDF_GLYPH_SIZE).toBe(256);
    expect(toExactCharacterSet("REGENERATE")).toBe("REGNAT");
  });

  it("accepts only static Troika-compatible worker font URLs", () => {
    expect(isTroikaCompatibleFontUrl("/fonts/Fraunces-Regular.ttf")).toBe(true);
    expect(isTroikaCompatibleFontUrl("https://cdn.example.com/fonts/Fraunces-Regular.woff")).toBe(true);
    expect(isTroikaCompatibleFontUrl("/fonts/Fraunces-Variable.ttf")).toBe(false);
    expect(isTroikaCompatibleFontUrl("/fonts/Fraunces-Variable.woff2")).toBe(false);
    expect(isTroikaCompatibleFontUrl("/fonts/Fraunces.otf")).toBe(false);
  });

  it("falls back from unsupported font URLs instead of preserving a renderer-breaking URL", () => {
    expect(resolveTroikaFontUrl("/fonts/Fraunces-Variable.woff2", "/fonts/Fraunces-Regular.ttf"))
      .toBe("/fonts/Fraunces-Regular.ttf");
  });

  it("limits font preload waits to ten seconds", () => {
    expect(FONT_PRELOAD_TIMEOUT_MS).toBe(10000);
  });
});
