import {describe, expect, it} from "vitest";

import {
  createMeasuredMaulTypographyProvider,
  resolveTypographyLayout,
} from "./typography-layout.js";

describe("MAUL typography layout", () => {
  const fonts = [
    {
      role: "EDITORIAL_DISPLAY" as const,
      assetId: "font_google_playfair_display_700",
      family: "Playfair Display",
      weight: 700,
      browserUrl: "/fonts/playfair.woff2",
      licensed: true,
      rendererVerified: true,
    },
    {
      role: "NEUTRAL_GROTESK" as const,
      assetId: "font_google_dm_sans_700",
      family: "DM Sans",
      weight: 700,
      browserUrl: "/fonts/dm-sans.woff2",
      licensed: true,
      rendererVerified: true,
    },
  ];

  it("uses a verified display-plus-grotesk pair and measured semantic line breaks", async () => {
    const layout = await resolveTypographyLayout({
      text: "Break the system before it breaks you",
      fontRoles: fonts,
      maximumLineWidthPx: 700,
      measure: async ({text}) => ({
        status: "measured",
        widthPx: text.length * (text.includes("system") ? 42 : 36),
        measurementId: `measurement_${text.replaceAll(" ", "_")}`,
      }),
    });

    expect(layout.fontRoles).toEqual(expect.arrayContaining([
      expect.objectContaining({role: "EDITORIAL_DISPLAY"}),
      expect.objectContaining({role: "NEUTRAL_GROTESK"}),
    ]));
    expect(layout.lines.map((line) => line.text)).not.toContain("Break the system before it");
    expect(layout.lines.every((line) => !/\b(the|of|to|and)$/i.test(line.text))).toBe(true);
    expect(layout.measurementIds.length).toBeGreaterThan(0);
  });

  it("refuses a font role that lacks renderer-verified measured geometry", async () => {
    await expect(resolveTypographyLayout({
      text: "No unmeasured font",
      fontRoles: [{...fonts[0], rendererVerified: false}],
      maximumLineWidthPx: 300,
      measure: async () => ({status: "unavailable", reason: "font did not load"}),
    })).rejects.toThrow(/measured font/i);
  });

  it("materializes one renderer-verified measured profile for every governed chunk", async () => {
    const provider = createMeasuredMaulTypographyProvider({
      fontRoles: fonts,
      profile: {
        profileId: "maul-measured-playfair-editorial-v1",
        family: "Playfair Display",
        approvedFontAssets: [{
          assetId: "font_google_playfair_display_700",
          family: "Playfair Display",
          weights: [700],
        }],
        loadedFallback: {
          assetId: "font_google_playfair_display_700",
          family: "Playfair Display",
          weight: 700,
        },
        metrics: {
          fingerprint: "a".repeat(64),
          maxGlyphWidthEm: 0.82,
          maxLineHeightEm: 1.18,
          minimumFontSizePx: 48,
          maximumFontSizePx: 88,
          minimumLineHeight: 1,
          maximumLineHeight: 1.2,
        },
      },
      measure: async ({text}) => ({
        status: "measured",
        widthPx: text.length * 28,
        measurementId: `measurement_${text.replaceAll(" ", "_")}`,
      }),
    });

    const plan = await provider.plan({
      chunks: [
        {chunkId: "chunk_hook", text: "Build something that lasts"},
        {chunkId: "chunk_payoff", text: "Then prove it"},
      ],
      maximumLineWidthPx: 420,
    });

    expect(plan).toMatchObject({
      status: "available",
      fontResolution: {
        selectedFamily: "Playfair Display",
        selectedAssetId: "font_google_playfair_display_700",
        status: "eligible_loaded",
      },
      layouts: [
        expect.objectContaining({chunkId: "chunk_hook"}),
        expect.objectContaining({chunkId: "chunk_payoff"}),
      ],
    });
    if (plan.status === "available") {
      expect(plan.evidenceIds).toEqual(expect.arrayContaining([
        "measurement_Build_something",
      ]));
    }
  });

  it("refuses a measured profile that the MAUL renderer cannot execute", () => {
    expect(() => createMeasuredMaulTypographyProvider({
      fontRoles: [{...fonts[0], assetId: "font_unsupported_playfair_700"}, fonts[1]],
      profile: {
        profileId: "maul-measured-unsupported-v1",
        family: "Playfair Display",
        approvedFontAssets: [{
          assetId: "font_unsupported_playfair_700",
          family: "Playfair Display",
          weights: [700],
        }],
        loadedFallback: {
          assetId: "font_unsupported_playfair_700",
          family: "Playfair Display",
          weight: 700,
        },
        metrics: {
          fingerprint: "b".repeat(64),
          maxGlyphWidthEm: 0.82,
          maxLineHeightEm: 1.18,
          minimumFontSizePx: 48,
          maximumFontSizePx: 88,
          minimumLineHeight: 1,
          maximumLineHeight: 1.2,
        },
      },
      measure: async () => ({
        status: "measured",
        widthPx: 1,
        measurementId: "measurement_unused",
      }),
    })).toThrow(/renderer/i);
  });
});
