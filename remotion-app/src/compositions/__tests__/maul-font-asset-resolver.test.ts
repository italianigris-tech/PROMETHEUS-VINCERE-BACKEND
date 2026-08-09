import {describe, expect, it} from "vitest";

import {resolveMaulFontAssetUrl} from "../maul-font-asset-resolver.js";

describe("MAUL Remotion font asset resolver", () => {
  it("resolves a root-relative public font path through the injected static resolver", () => {
    expect(resolveMaulFontAssetUrl(
      "/fonts/maul/dm-sans-700.woff2",
      (assetPath) => `static://${assetPath}`,
    )).toBe("static://fonts/maul/dm-sans-700.woff2");
  });

  it.each([
    "",
    "fonts/maul/dm-sans-700.woff2",
    "//cdn.example.com/dm-sans.woff2",
    "https://cdn.example.com/dm-sans.woff2",
    "file:///tmp/dm-sans.woff2",
    "C:/fonts/dm-sans.woff2",
    "/fonts/../secret.woff2",
    "/fonts/dm-sans.woff2?cache=1",
    "/fonts/dm-sans.woff2#face",
  ])("rejects unsafe browser font path %s", (browserUrl) => {
    expect(() => resolveMaulFontAssetUrl(browserUrl, (assetPath) => assetPath))
      .toThrow(/root-relative|offline|traversal|query|fragment|empty/i);
  });
});
