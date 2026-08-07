import type {MaulResolvedFontAsset} from "@prometheus/shared-types";
import {describe, expect, it} from "vitest";

import {
  rankMaulFontPairs,
  type MaulFontPairCandidate,
  type MaulFontPairGeometry,
} from "./font-pair-ranking.js";

const sha = (character: string) => character.repeat(64);

const asset = ({
  assetId,
  family,
  weight,
  style,
}: {
  assetId: string;
  family: string;
  weight: number;
  style: MaulResolvedFontAsset["style"];
}): MaulResolvedFontAsset => ({
  assetId,
  family,
  cssFamily: `Maul${assetId}`,
  weight,
  style,
  browserUrl: `/fonts/${assetId}.woff2`,
  localFilePath: `C:/fixtures/${assetId}.woff2`,
  localFileSha256: sha(assetId[0] ?? "a"),
  format: "woff2",
  source: "hydrated_library",
  license: {status: "cleared", evidence: ["fixture license"]},
});

const fixtureAssets = [
  asset({assetId: "primary_serif", family: "Editorial Serif", weight: 650, style: "normal"}),
  asset({assetId: "primary_sans", family: "Utility Sans", weight: 400, style: "normal"}),
  asset({assetId: "accent_italic", family: "Editorial Serif Italic", weight: 350, style: "italic"}),
  asset({assetId: "accent_script", family: "Decorative Script", weight: 400, style: "normal"}),
];

const fixtureCandidates: MaulFontPairCandidate[] = [
  {assetId: "primary_serif", score: 0.96, needsManualLicenseReview: false, roleBuckets: ["editorial_display"]},
  {assetId: "primary_sans", score: 0.78, needsManualLicenseReview: false, roleBuckets: ["neutral_reading"]},
  {assetId: "accent_italic", score: 0.94, needsManualLicenseReview: false, roleBuckets: ["accent_script_or_italic"]},
  {assetId: "accent_script", score: 0.72, needsManualLicenseReview: false, roleBuckets: ["accent_script_or_italic"]},
];

const fixtureGeometry = (font: MaulResolvedFontAsset): MaulFontPairGeometry => ({
  hasRequiredGlyphs: true,
  averageAdvanceEm: font.assetId === "accent_script" ? 0.9 : 0.58,
  xHeightRatio: font.assetId === "accent_script" ? 0.35 : 0.51,
  capHeightRatio: font.assetId === "accent_script" ? 0.64 : 0.71,
});

describe("MAUL font-pair ranking", () => {
  it("ranks every renderable licensed primary/accent pair before selecting one", () => {
    const result = rankMaulFontPairs({
      candidates: fixtureCandidates,
      hydratedAssets: fixtureAssets,
      requiredText: "speed is everything",
      catalogCount: 577,
      isLocalBinaryAvailable: () => true,
      measureAsset: fixtureGeometry,
    });

    expect(result.evaluatedPairCount).toBe(4);
    expect(result.pair.primary.assetId).toBe("primary_serif");
    expect(result.pair.accent.assetId).toBe("accent_italic");
    expect(result.score.breakdown.roleContrast).toBeGreaterThan(0);
    expect(result.rankedPairs).toHaveLength(4);
  });

  it("reports the hydrated subset instead of claiming the 577-font catalog was rendered", () => {
    const result = rankMaulFontPairs({
      candidates: fixtureCandidates,
      hydratedAssets: [fixtureAssets[0]!, fixtureAssets[2]!],
      catalogCount: 577,
      isLocalBinaryAvailable: () => true,
      measureAsset: fixtureGeometry,
    });

    expect(result.catalogCount).toBe(577);
    expect(result.hydratedCount).toBe(2);
    expect(result.status).toBe("hydrated_subset");
  });

  it("removes fonts without required glyph coverage before enumerating pairs", () => {
    expect(() => rankMaulFontPairs({
      candidates: fixtureCandidates,
      hydratedAssets: fixtureAssets,
      requiredText: "customer's",
      catalogCount: 577,
      isLocalBinaryAvailable: () => true,
      measureAsset: (font) => ({
        ...fixtureGeometry(font),
        hasRequiredGlyphs: !font.assetId.startsWith("accent_"),
      }),
    })).toThrow(/glyph coverage|primary.*accent/i);
  });

  it("uses asset IDs as a stable tie-break when scores are equal", () => {
    const tiedAssets = [
      asset({assetId: "primary_b", family: "Primary", weight: 400, style: "normal"}),
      asset({assetId: "primary_a", family: "Primary", weight: 400, style: "normal"}),
      asset({assetId: "accent_b", family: "Accent", weight: 400, style: "italic"}),
      asset({assetId: "accent_a", family: "Accent", weight: 400, style: "italic"}),
    ];
    const tiedCandidates = tiedAssets.map((font) => ({
      assetId: font.assetId,
      score: 0.8,
      needsManualLicenseReview: false,
      roleBuckets: font.assetId.startsWith("accent")
        ? ["accent_script_or_italic"]
        : ["neutral_reading"],
    }));

    const result = rankMaulFontPairs({
      candidates: tiedCandidates,
      hydratedAssets: tiedAssets,
      catalogCount: 577,
      isLocalBinaryAvailable: () => true,
      measureAsset: () => ({
        hasRequiredGlyphs: true,
        averageAdvanceEm: 0.6,
        xHeightRatio: 0.5,
        capHeightRatio: 0.7,
      }),
    });

    expect(result.pair.primary.assetId).toBe("primary_a");
    expect(result.pair.accent.assetId).toBe("accent_a");
  });
});
