import {describe, expect, it} from "vitest";

import * as zillizFontAssets from "./zilliz-font-assets.js";
import {
  loadMaulFontCatalogCount,
  loadHydratedMaulFontAssets,
  selectHydratedMaulFontPair,
} from "./zilliz-font-assets.js";

const sha = (character: string) => character.repeat(64);

describe("Zilliz MAUL font assets", () => {
  it("reports the complete classified catalog independently from hydration", () => {
    expect(loadMaulFontCatalogCount()).toBe(577);
    expect(loadHydratedMaulFontAssets().length).toBeLessThan(577);
  });

  it("selects only live candidates whose exact hydrated binaries are cleared for rendering", () => {
    const pair = selectHydratedMaulFontPair({
      candidates: [
        {assetId: "font_review_only", score: 0.99, needsManualLicenseReview: true},
        {
          assetId: "font_editorial",
          score: 0.95,
          needsManualLicenseReview: false,
          roleBuckets: ["neutral_reading"],
        },
        {
          assetId: "font_support",
          score: 0.91,
          needsManualLicenseReview: false,
          roleBuckets: ["accent_script_or_italic"],
        },
      ],
      hydratedAssets: [
        {
          assetId: "font_editorial",
          family: "Fraunces",
          cssFamily: "PrometheusFraunces",
          weight: 400,
          style: "normal",
          browserUrl: "/fonts/library/fraunces/fraunces.ttf",
          localFilePath: "/render/fonts/library/fraunces/fraunces.ttf",
          localFileSha256: sha("f"),
          format: "ttf",
          source: "hydrated_library",
          license: {status: "cleared", evidence: ["Font intelligence record"]},
        },
        {
          assetId: "font_support",
          family: "Satoshi",
          cssFamily: "PrometheusSatoshi",
          weight: 500,
          style: "normal",
          browserUrl: "/fonts/library/satoshi/satoshi.woff2",
          localFilePath: "/render/fonts/library/satoshi/satoshi.woff2",
          localFileSha256: sha("s"),
          format: "woff2",
          source: "hydrated_library",
          license: {status: "cleared", evidence: ["Font intelligence record"]},
        },
      ],
    });

    expect(pair.primary.assetId).toBe("font_editorial");
    expect(pair.accent.assetId).toBe("font_support");
  });

  it("fails closed when Zilliz candidates do not have an exact hydrated binary", () => {
    expect(() => selectHydratedMaulFontPair({
      candidates: [{assetId: "font_live_only", score: 0.99, needsManualLicenseReview: false}],
      hydratedAssets: [],
    })).toThrow(/hydrated.*binary/i);
  });

  it("fails closed when the best hydrated pair has no sanctioned accent role", () => {
    expect(() => selectHydratedMaulFontPair({
      candidates: [
        {
          assetId: "font_editorial",
          score: 0.99,
          needsManualLicenseReview: false,
          roleBuckets: ["neutral_reading"],
        },
        {
          assetId: "font_support",
          score: 0.98,
          needsManualLicenseReview: false,
          roleBuckets: ["neutral_reading"],
        },
      ],
      hydratedAssets: [
        {
          assetId: "font_editorial",
          family: "Fraunces",
          cssFamily: "PrometheusFraunces",
          weight: 400,
          style: "normal",
          browserUrl: "/fonts/library/fraunces/fraunces.ttf",
          localFilePath: "/render/fonts/library/fraunces/fraunces.ttf",
          localFileSha256: sha("f"),
          format: "ttf",
          source: "hydrated_library",
          license: {status: "cleared", evidence: ["Font intelligence record"]},
        },
        {
          assetId: "font_support",
          family: "Satoshi",
          cssFamily: "PrometheusSatoshi",
          weight: 500,
          style: "normal",
          browserUrl: "/fonts/library/satoshi/satoshi.woff2",
          localFilePath: "/render/fonts/library/satoshi/satoshi.woff2",
          localFileSha256: sha("s"),
          format: "woff2",
          source: "hydrated_library",
          license: {status: "cleared", evidence: ["Font intelligence record"]},
        },
      ],
    })).toThrow(/accent.*role|script.*italic/i);
  });

  it("uses the authoritative font taxonomy instead of stale Milvus role text", () => {
    const pair = selectHydratedMaulFontPair({
      candidates: [
        {
          assetId: "font_editorial",
          score: 0.99,
          needsManualLicenseReview: false,
          roleBuckets: ["accent_script_or_italic"],
        },
        {
          assetId: "font_script",
          score: 0.98,
          needsManualLicenseReview: false,
          roleBuckets: ["neutral_reading"],
        },
      ],
      hydratedAssets: [
        {
          assetId: "font_editorial",
          family: "Almera",
          cssFamily: "PrometheusAlmera",
          weight: 400,
          style: "normal",
          browserUrl: "/fonts/library/almera/almera.woff2",
          localFilePath: "/render/fonts/library/almera/almera.woff2",
          localFileSha256: sha("a"),
          format: "woff2",
          source: "hydrated_library",
          license: {status: "cleared", evidence: ["Font intelligence record"]},
        },
        {
          assetId: "font_script",
          family: "Aesthetic",
          cssFamily: "PrometheusAesthetic",
          weight: 400,
          style: "normal",
          browserUrl: "/fonts/library/aesthetic/aesthetic.woff2",
          localFilePath: "/render/fonts/library/aesthetic/aesthetic.woff2",
          localFileSha256: sha("b"),
          format: "woff2",
          source: "hydrated_library",
          license: {status: "cleared", evidence: ["Font intelligence record"]},
        },
      ],
      roleBucketsByAssetId: new Map([
        ["font_editorial", ["neutral_reading"]],
        ["font_script", ["accent_script_or_italic"]],
      ]),
    });

    expect(pair.primary.assetId).toBe("font_editorial");
    expect(pair.accent.assetId).toBe("font_script");
  });

  it("loads the real hydrated library and rejects restricted license signals", () => {
    const assets = loadHydratedMaulFontAssets();
    const assetIds = assets.map((asset) => asset.assetId);

    expect(assetIds).toContain("font_aesthetic-regular_b3500383bd34");
    expect(assetIds).toContain("font_almera_baa51ed42a1d");
    expect(assetIds).not.toContain("font_aesthicodemo_efbe4604facd");
    expect(assetIds).not.toContain("font_auliondemoregular_e016efd7fcb7");
    expect(assetIds).not.toContain("font_baguile-freetrial_cc85058e7468");
    expect(assetIds).not.toContain("font_brushelvapersonalused_77ea8f79fb4a");
    expect(assets.find((asset) => asset.assetId === "font_leviathan-italic_ac864336242c")?.style)
      .toBe("italic");
    expect(assets.find((asset) => asset.assetId === "font_leviathan-oblique_ea2cc92ea65b")?.style)
      .toBe("oblique");
  });

  it("does not classify Aesthetic as a script accent after taxonomy correction", () => {
    const roles = zillizFontAssets.loadMaulFontRoleBuckets().get("font_aesthetic-regular_b3500383bd34");
    expect(roles).toEqual(["neutral_reading"]);
  });

  it("builds distinct semantic searches for the display and cursive roles", () => {
    const buildQueries = (
      zillizFontAssets as typeof zillizFontAssets & {
        buildMaulFontSearchQueries?: (input: {
          chunks: Array<{chunkId: string; text: string}>;
          maximumLineWidthPx: number;
          fontSystemId: "grotesk_editorial_hinge";
          primaryTypeRole: "editorial_display";
        }) => Array<{role: string; query: string}>;
      }
    ).buildMaulFontSearchQueries;

    expect(buildQueries).toBeTypeOf("function");
    const queries = buildQueries!({
      chunks: [{chunkId: "chunk_1", text: "Build what matters"}],
      maximumLineWidthPx: 920,
      fontSystemId: "grotesk_editorial_hinge",
      primaryTypeRole: "editorial_display",
    });

    expect(queries.map((query) => query.role)).toEqual(["primary", "accent"]);
    expect(queries[0]?.query).toMatch(/display|editorial/i);
    expect(queries[1]?.query).toMatch(/script|cursive|italic/i);
  });
});
