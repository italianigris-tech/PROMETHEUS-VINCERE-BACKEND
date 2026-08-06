import {describe, expect, it} from "vitest";
import path from "node:path";

import {
  createDefaultMaulTypographyProvider,
  createFontkitTypographyMeasurementProvider,
  createMeasuredMaulTypographyProvider,
  createResolvedMaulTypographyProvider,
  createRoleAwareMaulTypographyProvider,
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

  it("measures deterministic glyph geometry from the exact governed font binary", async () => {
    const measure = createFontkitTypographyMeasurementProvider({
      fontPath: path.resolve(
        "..",
        "remotion-app",
        "public",
        "fonts",
        "maul",
        "dm-sans-700.woff2",
      ),
      fontAssetId: "font_google_dm_sans_700",
    });
    const font = {
      ...fonts[0],
      assetId: "font_google_dm_sans_700",
      family: "DM Sans",
    };

    const short = await measure({text: "Build", font, fontSizePx: 72});
    const repeated = await measure({text: "Build", font, fontSizePx: 72});
    const long = await measure({
      text: "Build something lasting",
      font,
      fontSizePx: 72,
    });

    expect(short).toMatchObject({
      status: "measured",
      measurementId: expect.stringMatching(/^font_measurement_[a-f0-9]{64}$/),
    });
    expect(repeated).toEqual(short);
    expect(long.status).toBe("measured");
    if (short.status === "measured" && long.status === "measured") {
      expect(short.widthPx).toBeGreaterThan(0);
      expect(long.widthPx).toBeGreaterThan(short.widthPx);
    }
  });

  it("routes Terra's primary type role to the matching measured provider", async () => {
    const selected: string[] = [];
    const provider = createRoleAwareMaulTypographyProvider({
      editorialDisplay: {
        plan: async () => {
          selected.push("editorial_display");
          return {status: "unavailable", reason: "editorial fixture"};
        },
      },
      neutralGrotesk: {
        plan: async () => {
          selected.push("neutral_grotesk");
          return {status: "unavailable", reason: "grotesk fixture"};
        },
      },
    });

    await provider.plan({
      chunks: [{chunkId: "chunk_hook", text: "Prove the point"}],
      maximumLineWidthPx: 410,
      primaryTypeRole: "neutral_grotesk",
    });

    expect(selected).toEqual(["neutral_grotesk"]);
  });

  it("provides binary-backed DM Sans and Playfair measurement by default", async () => {
    const provider = createDefaultMaulTypographyProvider();
    const chunks = [{chunkId: "chunk_hook", text: "Prove it now"}];
    const neutral = await provider.plan({
      chunks,
      maximumLineWidthPx: 410,
      primaryTypeRole: "neutral_grotesk",
    });
    const editorial = await provider.plan({
      chunks,
      maximumLineWidthPx: 410,
      primaryTypeRole: "editorial_display",
    });

    expect(
      neutral.status,
      neutral.status === "unavailable" ? neutral.reason : undefined,
    ).toBe("available");
    expect(
      editorial.status,
      editorial.status === "unavailable" ? editorial.reason : undefined,
    ).toBe("available");
    expect(neutral).toMatchObject({
      status: "available",
      fontResolution: {
        selectedFamily: "DM Sans",
        selectedAssetId: "font_google_dm_sans_700",
        accentAsset: {
          assetId: "font_google_great_vibes_400",
          family: "Great Vibes",
        },
      },
      evidenceIds: expect.arrayContaining([
        expect.stringMatching(/^font_measurement_[a-f0-9]{64}$/),
      ]),
    });
    expect(editorial).toMatchObject({
      status: "available",
      fontResolution: {
        selectedFamily: "Playfair Display",
        selectedAssetId: "font_google_playfair_display_700",
      },
      evidenceIds: expect.arrayContaining([
        expect.stringMatching(/^font_measurement_[a-f0-9]{64}$/),
      ]),
    });
  });

  it("measures the selected renderer-safe editorial font system from its exact binary", async () => {
    const provider = createDefaultMaulTypographyProvider();

    const plan = await provider.plan({
      chunks: [{chunkId: "chunk_hook", text: "Build the future"}],
      maximumLineWidthPx: 410,
      primaryTypeRole: "editorial_display",
      fontSystemId: "condensed_kinetic_hinge",
    });

    expect(
      plan.status,
      plan.status === "unavailable" ? plan.reason : undefined,
    ).toBe("available");
    expect(plan).toMatchObject({
      status: "available",
      fontResolution: {
        selectedFamily: "Bebas Neue",
        selectedAssetId: "font_google_bebas_neue_400",
        status: "eligible_loaded",
        accentAsset: {
          assetId: "font_google_playfair_display_italic_700",
          browserUrl: "/fonts/maul/playfair-display-italic-700.woff2",
          style: "italic",
          source: "bundled",
          localFileSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      },
    });
  });

  it("refuses a font system that is not backed by the MAUL renderer catalog", async () => {
    const provider = createDefaultMaulTypographyProvider();

    const plan = await provider.plan({
      chunks: [{chunkId: "chunk_hook", text: "No phantom font"}],
      maximumLineWidthPx: 410,
      primaryTypeRole: "editorial_display",
      fontSystemId: "unhydrated_library_font" as any,
    });

    expect(plan).toMatchObject({
      status: "unavailable",
      reason: expect.stringMatching(/font system|renderer/i),
    });
  });

  it("measures and persists the exact hydrated-library asset selected for MAUL", async () => {
    const frauncesPath = path.resolve(
      "..",
      "remotion-app",
      "public",
      "fonts",
      "maul",
      "dm-serif-display-400.woff2",
    );
    const provider = createResolvedMaulTypographyProvider({
      primary: {
        assetId: "font_fraunces_regular_test",
        family: "Fraunces",
        cssFamily: "PrometheusFraunces",
        weight: 400,
        style: "normal",
        browserUrl: "/fonts/library/fraunces/fraunces-regular.ttf",
        localFilePath: frauncesPath,
        format: "ttf",
        source: "hydrated_library",
        license: {
          status: "cleared",
          evidence: ["test-fixture"],
        },
      },
      accent: {
        assetId: "font_dm_sans_test",
        family: "DM Sans",
        cssFamily: "DM Sans",
        weight: 700,
        style: "normal",
        browserUrl: "/fonts/maul/dm-sans-700.woff2",
        localFilePath: path.resolve("..", "remotion-app", "public", "fonts", "maul", "dm-sans-700.woff2"),
        format: "woff2",
        source: "bundled",
        license: {
          status: "cleared",
          evidence: ["bundled-fixture"],
        },
      },
    });

    const plan = await provider.plan({
      chunks: [{chunkId: "chunk_hook", text: "Make the hinge land"}],
      maximumLineWidthPx: 410,
      primaryTypeRole: "editorial_display",
    });

    expect(plan).toMatchObject({
      status: "available",
      fontResolution: {
        selectedAsset: {
          assetId: "font_fraunces_regular_test",
          browserUrl: "/fonts/library/fraunces/fraunces-regular.ttf",
          source: "hydrated_library",
          localFileSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      },
    });
  });

  it("keeps the resolved primary face primary when treatment requests neutral grotesk", async () => {
    const primaryPath = path.resolve(
      "..",
      "remotion-app",
      "public",
      "fonts",
      "maul",
      "dm-serif-display-400.woff2",
    );
    const accentPath = path.resolve(
      "..",
      "remotion-app",
      "public",
      "fonts",
      "maul",
      "great-vibes-400.ttf",
    );
    const provider = createResolvedMaulTypographyProvider({
      primary: {
        assetId: "font_dynamic_primary",
        family: "Dynamic Display",
        cssFamily: "PrometheusDynamicDisplay",
        weight: 400,
        style: "normal",
        browserUrl: "/fonts/library/dynamic/display.woff2",
        localFilePath: primaryPath,
        format: "woff2",
        source: "hydrated_library",
        license: {status: "cleared", evidence: ["primary-fixture"]},
      },
      accent: {
        assetId: "font_dynamic_script",
        family: "Dynamic Script",
        cssFamily: "PrometheusDynamicScript",
        weight: 400,
        style: "normal",
        browserUrl: "/fonts/library/dynamic/script.ttf",
        localFilePath: accentPath,
        format: "ttf",
        source: "hydrated_library",
        license: {status: "cleared", evidence: ["accent-fixture"]},
      },
    });

    const plan = await provider.plan({
      chunks: [{chunkId: "chunk_hook", text: "Primary stays primary"}],
      maximumLineWidthPx: 500,
      primaryTypeRole: "neutral_grotesk",
    });

    expect(plan).toMatchObject({
      status: "available",
      fontResolution: {
        selectedAssetId: "font_dynamic_primary",
        selectedAsset: {assetId: "font_dynamic_primary"},
        accentAsset: {assetId: "font_dynamic_script"},
      },
    });
  });
});
