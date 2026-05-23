import {describe, expect, it, vi} from "vitest";

vi.mock("node:fs", () => {
  const windowsFontPath = "C:\\Users\\HomePC\\Downloads\\HELP, VIDEO MATTING\\font-intelligence\\assets\\Satoshi-Bold.otf";

  return {
    existsSync: (filePath: string) =>
      filePath.endsWith("font-manifest.json") || filePath === windowsFontPath,
    readFileSync: (filePath: string) => {
      if (!filePath.endsWith("font-manifest.json")) {
        throw new Error(`Unexpected readFileSync path: ${filePath}`);
      }

      return JSON.stringify([
        {
          observed: {
            familyName: "Satoshi",
            extractedAbsolutePath: windowsFontPath,
            extension: ".otf"
          },
          inferred: {
            readabilityScore: 0.9,
            expressivenessScore: 0.8,
            roles: ["headline"]
          }
        }
      ]);
    }
  };
});

import {resolveRequestedOrFallbackFontPair} from "../typography/font-file-resolver";

describe("font-file-resolver", () => {
  it("never emits legacy file URLs for a Windows font path", () => {
    const fontPair = resolveRequestedOrFallbackFontPair("Satoshi", "Canela");

    expect(fontPair).not.toBeNull();
    if (!fontPair) {
      throw new Error("Expected a resolved font pair for the mocked manifest.");
    }
    const primary = fontPair.primary as typeof fontPair.primary & {browserUrl?: string};

    expect(primary.filePath).toContain("C:\\Users\\HomePC\\Downloads\\HELP, VIDEO MATTING");
    expect(primary.browserUrl).toBe("/fonts/retrieved/Satoshi-Bold.otf");
  });
});
