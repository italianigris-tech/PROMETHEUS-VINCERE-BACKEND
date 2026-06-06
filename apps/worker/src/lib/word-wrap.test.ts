import {describe, expect, it} from "vitest";

import {estimateTextWidth, wrapTranscriptIntoLines} from "./word-wrap.js";

describe("wrapTranscriptIntoLines", () => {
  it("keeps the sample hero word on one line when it fits", () => {
    expect(wrapTranscriptIntoLines("REGENERATE", {maxWidth: 8, fontSize: 0.84})).toEqual(["REGENERATE"]);
  });

  it("splits transcript text at word boundaries before exceeding max width", () => {
    const lines = wrapTranscriptIntoLines("REGENERATE THE WHOLE SYSTEM", {maxWidth: 5, fontSize: 0.84});

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => estimateTextWidth(line, 0.84) <= 5.6)).toBe(true);
  });

  it("breaks oversized single tokens without dropping glyphs", () => {
    const lines = wrapTranscriptIntoLines("SUPERREGENERATIVE", {maxWidth: 2.2, fontSize: 0.84});

    expect(lines.join("")).toBe("SUPERREGENERATIVE");
    expect(lines.length).toBeGreaterThan(2);
  });

  it("uses an injected text measurement function when available", () => {
    const lines = wrapTranscriptIntoLines("WWWW IIII", {
      maxWidth: 4,
      fontSize: 1,
      measureText: (text) => Array.from(text).reduce((sum, glyph) => {
        if (glyph === "W") {
          return sum + 1.25;
        }
        if (glyph === "I") {
          return sum + 0.25;
        }
        return sum + 0.5;
      }, 0)
    });

    expect(lines).toEqual(["WWW", "W IIII"]);
  });
});
