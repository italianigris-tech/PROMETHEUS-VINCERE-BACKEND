import {mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";

import {describe, expect, it} from "vitest";

import {buildFontCorpusIndex} from "./font-corpus-indexer";

describe("buildFontCorpusIndex", () => {
  it("normalizes the 577-font manifest into license-safe renderable entries", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "prometheus-font-index-"));
    const safeFontPath = path.join(dir, "cinzel.otf");
    const reviewOnlyFontPath = path.join(dir, "personal-use.otf");
    writeFileSync(safeFontPath, "font-bytes");
    writeFileSync(reviewOnlyFontPath, "font-bytes");
    const manifestPath = path.join(dir, "font-manifest.json");

    writeFileSync(manifestPath, JSON.stringify([
      {
        fontId: "font_cinzel",
        needsManualLicenseReview: true,
        observed: {
          familyName: "Cinzel",
          extractedAbsolutePath: safeFontPath,
          extension: ".otf",
          licenseTexts: ["This Font Software is licensed under the SIL Open Font License, Version 1.1."],
        },
        inferred: {
          primaryRole: "hero",
          roles: ["hero", "support"],
          readabilityScore: 0.8,
          expressivenessScore: 0.65,
        },
      },
      {
        fontId: "font_personal",
        needsManualLicenseReview: true,
        observed: {
          familyName: "Personal Use",
          extractedAbsolutePath: reviewOnlyFontPath,
          extension: ".otf",
          licenseTexts: ["Personal use only. No commercial use allowed."],
        },
        inferred: {
          primaryRole: "hero",
          roles: ["hero"],
          readabilityScore: 0.9,
          expressivenessScore: 0.9,
        },
      },
    ]));

    const index = buildFontCorpusIndex({manifestPath});

    expect(index.entries).toHaveLength(1);
    expect(index.entries[0]?.fontId).toBe("font_cinzel");
    expect(index.entries[0]?.licenseStatus).toBe("render_safe");
    expect(index.query({profile: "cinematic", role: "hero"})[0]?.family).toBe("Cinzel");
  });
});