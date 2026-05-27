import {afterEach, describe, expect, it, vi} from "vitest";

import {
  readFontRenderTrace,
  resolvePrimaryFontFamily
} from "../font-render-trace";

describe("font render trace", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes backend-declared and computed font families before comparing", () => {
    expect(resolvePrimaryFontFamily("\"DM Sans\", \"Segoe UI\", sans-serif")).toBe("DM Sans");
    expect(resolvePrimaryFontFamily("Segoe UI, sans-serif")).toBe("Segoe UI");
  });

  it("observes caption font mismatch without mutating the element", () => {
    const element = {
      textContent: "Luxury fonts only",
      dataset: {
        captionExpectedFont: "\"DM Sans\", \"Segoe UI\", sans-serif"
      }
    } as unknown as HTMLElement;
    const before = JSON.stringify((element as HTMLElement).dataset);

    vi.stubGlobal("getComputedStyle", vi.fn(() => ({
      fontFamily: "\"Segoe UI\", sans-serif"
    })));

    const trace = readFontRenderTrace({
      element,
      timestamp: 1234
    });

    expect(trace).toEqual({
      stage: "FONT_RENDER_TRACE",
      expected: "DM Sans",
      actual: "Segoe UI",
      match: false,
      timestamp: 1234
    });
    expect(JSON.stringify((element as HTMLElement).dataset)).toBe(before);
  });
});
