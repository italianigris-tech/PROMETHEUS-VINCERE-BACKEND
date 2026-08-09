import {describe, expect, it} from "vitest";

import type {MaulResolvedFontAsset} from "@prometheus/shared-types";

import type {TypographyProfileLayer} from "./typography-profile-corpus.js";
import {
  loadExecutableTypographyFontAssets,
  loadTypographyFontIntelligenceCatalog,
  resolveTypographyProfileLayer,
} from "./typography-profile-font-resolver.js";

const sha = (character: string) => character.repeat(64);

const asset = ({
  assetId,
  family,
  weight = 400,
  style = "normal",
}: {
  assetId: string;
  family: string;
  weight?: number;
  style?: "normal" | "italic" | "oblique";
}): MaulResolvedFontAsset => ({
  assetId,
  family,
  cssFamily: family,
  weight,
  style,
  browserUrl: `/fonts/${assetId}.woff2`,
  localFilePath: `/srv/remotion/public/fonts/${assetId}.woff2`,
  localFileSha256: sha(assetId.includes("playfair") ? "a" : "b"),
  format: "woff2",
  source: "bundled",
  license: {status: "bundled", evidence: ["Test renderer catalog."]},
});

const layer = ({
  candidates,
  classification = "Neutral Grotesk Sans",
  role = "header",
  style = "normal",
  weight = 700,
}: {
  candidates: string[];
  classification?: string;
  role?: TypographyProfileLayer["role"];
  style?: "normal" | "italic" | "oblique";
  weight?: number;
}): TypographyProfileLayer => ({
  layerName: "hero",
  role,
  fontClassification: classification,
  matchedFontCandidates: candidates,
  fontStyle: {
    weight,
    style,
    casing: "normal",
    color: "#111111",
    sizePxBase: 48,
    relativeScale: 1,
    letterSpacingEm: 0,
    lineHeight: 1.1,
    verticalMarginTopPx: 0,
  },
  effects: {
    dropShadow: {xOffset: 0, yOffset: 1, blurRadius: 2, color: "#000000"},
  },
  sampleText: "Proof",
  wordCount: 1,
  characterCount: 5,
  perWordCharacterCounts: [{word: "Proof", characterCount: 5}],
});

const catalog = [
  {
    fontId: "font_inter_700",
    family: "Inter",
    style: "normal" as const,
    weight: 700,
    roles: ["body", "support", "caption"],
    classifications: ["sans", "grotesk"],
    personality: ["neutral", "clean"],
    readabilityScore: 0.95,
    expressivenessScore: 0.35,
    descriptor: "neutral clean grotesk sans body support caption",
  },
  {
    fontId: "font_dm_sans_700",
    family: "DM Sans",
    style: "normal" as const,
    weight: 700,
    roles: ["body", "support", "caption"],
    classifications: ["sans", "grotesk"],
    personality: ["neutral", "clean"],
    readabilityScore: 0.92,
    expressivenessScore: 0.4,
    descriptor: "neutral clean grotesk sans body support caption",
  },
  {
    fontId: "font_playfair_italic_700",
    family: "Playfair Display",
    style: "italic" as const,
    weight: 700,
    roles: ["hero", "accent"],
    classifications: ["serif", "didone"],
    personality: ["editorial", "luxury"],
    readabilityScore: 0.75,
    expressivenessScore: 0.9,
    descriptor: "editorial luxury didone serif hero accent italic",
  },
] as const;

describe("MAUL typography profile font resolver", () => {
  it("loads the complete 577-font intelligence catalog", () => {
    expect(loadTypographyFontIntelligenceCatalog()).toHaveLength(577);
  });

  it("loads every bundled and hydrated executable font receipt", () => {
    const assets = loadExecutableTypographyFontAssets();

    expect(assets.length).toBeGreaterThan(20);
    expect(assets.map((candidate) => candidate.assetId)).toEqual(
      expect.arrayContaining([
        "font_google_dm_sans_700",
        "font_google_playfair_display_700",
        "font_google_playfair_display_italic_700",
      ]),
    );
    for (const candidate of assets) {
      expect(candidate.browserUrl).toMatch(/^\//);
      expect(candidate.localFileSha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("selects an exact deployed family and style before substitutes", () => {
    const result = resolveTypographyProfileLayer({
      layer: layer({
        candidates: ["Playfair Display Italic"],
        classification: "Didone Editorial Serif",
        role: "primary_focus_word",
        style: "italic",
      }),
      profileMood: "Cinematic editorial luxury",
      catalog,
      executableAssets: [
        asset({assetId: "font_dm_sans_700", family: "DM Sans", weight: 700}),
        asset({
          assetId: "font_playfair_italic_700",
          family: "Playfair Display",
          weight: 700,
          style: "italic",
        }),
      ],
    });

    expect(result).toMatchObject({
      resolution: "exact",
      selectedCatalogFontId: "font_playfair_italic_700",
      selectedAsset: {family: "Playfair Display", style: "italic"},
    });
  });

  it("keeps the profile and chooses the closest deployed catalog font", () => {
    const result = resolveTypographyProfileLayer({
      layer: layer({candidates: ["Inter"]}),
      profileMood: "Clean neutral modern",
      catalog,
      executableAssets: [
        asset({assetId: "font_dm_sans_700", family: "DM Sans", weight: 700}),
        asset({
          assetId: "font_playfair_italic_700",
          family: "Playfair Display",
          weight: 700,
          style: "italic",
        }),
      ],
    });

    expect(result).toMatchObject({
      requestedFamilies: ["Inter"],
      resolution: "closest_catalog",
      selectedCatalogFontId: "font_dm_sans_700",
      selectedAsset: {family: "DM Sans"},
    });
    expect(result.reason).toMatch(/closest deployed/i);
  });

  it("does not select an exact 577-catalog match without a deployed receipt", () => {
    const result = resolveTypographyProfileLayer({
      layer: layer({candidates: ["Inter"]}),
      profileMood: "Clean neutral modern",
      catalog,
      executableAssets: [
        asset({assetId: "font_dm_sans_700", family: "DM Sans", weight: 700}),
      ],
    });

    expect(result.selectedCatalogFontId).toBe("font_dm_sans_700");
    expect(result.selectedAsset.browserUrl).toBe(
      "/fonts/font_dm_sans_700.woff2",
    );
  });

  it("excludes the primary asset when resolving a contrasting accent", () => {
    const result = resolveTypographyProfileLayer({
      layer: layer({
        candidates: ["Playfair Display Italic"],
        classification: "Editorial italic accent",
        role: "accent_tagline",
        style: "italic",
      }),
      profileMood: "Editorial luxury",
      catalog,
      executableAssets: [
        asset({assetId: "font_dm_sans_700", family: "DM Sans", weight: 700}),
        asset({
          assetId: "font_playfair_italic_700",
          family: "Playfair Display",
          weight: 700,
          style: "italic",
        }),
      ],
      excludedAssetIds: ["font_dm_sans_700"],
    });

    expect(result.selectedAsset.assetId).toBe("font_playfair_italic_700");
  });
});
