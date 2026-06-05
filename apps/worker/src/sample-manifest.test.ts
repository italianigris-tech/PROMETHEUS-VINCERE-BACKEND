import {describe, expect, it} from "vitest";

import {isTroikaCompatibleFontUrl} from "./lib/font-preload.js";
import {regenerateSampleManifest} from "./sample-manifest.js";

describe("sample render manifest", () => {
  it("uses a Troika-compatible static font", () => {
    expect(regenerateSampleManifest.fontUrl).not.toMatch(/woff2|variable/i);
    expect(isTroikaCompatibleFontUrl(regenerateSampleManifest.fontUrl)).toBe(true);
  });
});
