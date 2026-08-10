import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {openSync, type Font, type FontCollection} from "fontkit";

import {
  isMaulRendererFontCatalogEntry,
  maulResolvedFontAssetSchema,
  maulTypographyCompatibilityProfileSchema,
  type MaulResolvedFontAsset,
  type MaulTypographyCompatibilityProfile,
} from "@prometheus/shared-types";

import {
  type MaulEditorialFontSystemId,
} from "./reference-editorial-rhythm.js";

export type GovernedTypographyRole =
  | "EDITORIAL_DISPLAY"
  | "EDITORIAL_SERIF"
  | "NEUTRAL_GROTESK"
  | "UTILITY_MONO"
  | "HANDWRITTEN_ACCENT";

export type GovernedTypographyFont = {
  role: GovernedTypographyRole;
  assetId: string;
  family: string;
  weight: number;
  browserUrl: string;
  licensed: boolean;
  rendererVerified: boolean;
  asset?: MaulResolvedFontAsset;
};

export type MaulResolvedFontAssetInput = Omit<
  MaulResolvedFontAsset,
  "localFileSha256"
> & {
  localFileSha256?: string;
};

const resolveExactFontAsset = (
  input: MaulResolvedFontAssetInput,
): MaulResolvedFontAsset => {
  const bytes = readFileSync(input.localFilePath);
  const localFileSha256 = createHash("sha256").update(bytes).digest("hex");
  if (input.localFileSha256 && input.localFileSha256 !== localFileSha256) {
    throw new Error(
      `MAUL font asset ${input.assetId} hash does not match ${input.localFilePath}.`,
    );
  }
  const loaded = openSync(input.localFilePath);
  if (isFontCollection(loaded)) {
    throw new Error(
      `MAUL font asset ${input.assetId} is a collection and does not name an explicit face.`,
    );
  }
  return maulResolvedFontAssetSchema.parse({...input, localFileSha256});
};

const fontFromResolvedAsset = ({
  role,
  asset,
}: {
  role: GovernedTypographyRole;
  asset: MaulResolvedFontAsset;
}): GovernedTypographyFont => ({
  role,
  assetId: asset.assetId,
  family: asset.family,
  weight: asset.weight,
  browserUrl: asset.browserUrl,
  licensed: asset.license.status === "cleared" || asset.license.status === "bundled",
  rendererVerified: true,
  asset,
});

export type TypographyMeasurementProvider = (input: {
  text: string;
  font: GovernedTypographyFont;
  fontSizePx: number;
}) => Promise<
  | {status: "measured"; widthPx: number; measurementId: string}
  | {status: "unavailable"; reason: string}
>;

const isFontCollection = (
  input: Font | FontCollection,
): input is FontCollection => input.type === "TTC" || input.type === "DFont";

export const createFontkitEditorialTokenMeasurementProvider = ({
  assets,
}: {
  assets: readonly MaulResolvedFontAsset[];
}) => {
  const assetById = new Map(assets.map((asset) => [asset.assetId, asset]));
  const fontById = new Map<string, Font>();
  return ({
    text,
    font,
    fontSizePx,
  }: {
    tokenId: string;
    text: string;
    font: {assetId: string};
    fontSizePx: number;
  }): {widthPx: number; heightPx: number} => {
    const asset = assetById.get(font.assetId);
    if (!asset) {
      throw new Error(`MAUL editorial measurement has no exact asset for ${font.assetId}.`);
    }
    let loaded = fontById.get(asset.assetId);
    if (!loaded) {
      const opened = openSync(asset.localFilePath);
      if (isFontCollection(opened)) {
        throw new Error(`MAUL editorial measurement requires an explicit face: ${asset.assetId}.`);
      }
      loaded = opened;
      fontById.set(asset.assetId, loaded);
    }
    const scale = fontSizePx / Math.max(1, loaded.unitsPerEm);
    const run = loaded.layout(text);
    return {
      widthPx: run.positions.reduce(
        (total, position) => total + position.xAdvance,
        0,
      ) * scale,
      heightPx: (loaded.ascent - loaded.descent) * scale,
    };
  };
};

export const createFontkitTypographyMeasurementProvider = ({
  fontPath,
  fontAssetId,
}: {
  fontPath: string;
  fontAssetId: string;
}): TypographyMeasurementProvider => {
  let font: Font | null = null;
  let fontHash: string | null = null;
  let loadFailure: string | null = null;
  try {
    const bytes = readFileSync(fontPath);
    fontHash = createHash("sha256").update(bytes).digest("hex");
    const loaded = openSync(fontPath);
    if (isFontCollection(loaded)) {
      loadFailure = "Font collections require an explicit face selection.";
    } else {
      font = loaded;
    }
  } catch (error) {
    loadFailure = error instanceof Error ? error.message : String(error);
  }

  return async ({text, font: requestedFont, fontSizePx}) => {
    if (requestedFont.assetId !== fontAssetId) {
      return {
        status: "unavailable",
        reason:
          "Measurement asset " +
          fontAssetId +
          " cannot measure " +
          requestedFont.assetId +
          ".",
      };
    }
    if (!font || !fontHash) {
      return {
        status: "unavailable",
        reason:
          "Font binary " +
          fontPath +
          " is unavailable: " +
          (loadFailure ?? "unknown load failure") +
          ".",
      };
    }
    const weightAxis = font.variationAxes.wght;
    const measuredFont = weightAxis
      ? font.getVariation({
          wght: Math.max(
            weightAxis.min,
            Math.min(weightAxis.max, requestedFont.weight),
          ),
        })
      : font;
    const run = measuredFont.layout(text);
    const widthPx = Number(
      ((run.advanceWidth / measuredFont.unitsPerEm) * fontSizePx).toFixed(4),
    );
    if (!Number.isFinite(widthPx) || widthPx <= 0) {
      return {
        status: "unavailable",
        reason: "Font binary " + fontPath + " produced invalid glyph geometry.",
      };
    }
    const measurementHash = createHash("sha256")
      .update(JSON.stringify({
        fontHash,
        fontAssetId,
        weight: requestedFont.weight,
        text,
        fontSizePx,
        widthPx,
      }))
      .digest("hex");
    return {
      status: "measured",
      widthPx,
      measurementId: "font_measurement_" + measurementHash,
    };
  };
};

export type TypographyLayout = {
  fontRoles: GovernedTypographyFont[];
  fontSizePx: number;
  lines: Array<{text: string; widthPx: number; measurementId: string}>;
  measurementIds: string[];
};

export type MaulMeasuredTypographyLayout = Pick<
  TypographyLayout,
  "fontSizePx" | "lines" | "measurementIds"
> & {
  chunkId: string;
};

export type MaulTypographyPlan =
  | {
      status: "available";
      profile: MaulTypographyCompatibilityProfile;
      fontResolution: {
        requestedRole: "editorial" | "utility";
        selectedFamily: string;
        selectedAssetId: string;
        status: "eligible_loaded";
        reason: string;
        selectedAsset?: MaulResolvedFontAsset | null;
        accentAsset?: MaulResolvedFontAsset | null;
      };
      layouts: MaulMeasuredTypographyLayout[];
      evidenceIds: string[];
    }
  | {
      status: "unavailable";
      reason: string;
    };

export type MaulTypographyPlanInput = {
  chunks: Array<{chunkId: string; text: string}>;
  maximumLineWidthPx: number;
  primaryTypeRole?: "editorial_display" | "neutral_grotesk";
  fontSystemId?: MaulEditorialFontSystemId;
};

export interface MaulTypographyProvider {
  plan(input: MaulTypographyPlanInput): Promise<MaulTypographyPlan>;
}

const lineBreakWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const allPartitions = (words: string[]): string[][][] => {
  const partitions: string[][][] = [];
  const visit = (start: number, lines: string[][]): void => {
    if (start === words.length) {
      partitions.push(lines);
      return;
    }
    if (lines.length === 3) return;
    for (let end = start + 1; end <= words.length; end += 1) {
      visit(end, [...lines, words.slice(start, end)]);
    }
  };
  visit(0, []);
  return partitions.filter((lines) => lines.length <= 3);
};

const semanticPenalty = (lines: string[][]): number => lines.reduce(
  (penalty, line, index) => {
    const first = line[0]?.toLowerCase() ?? "";
    const last = line.at(-1)?.toLowerCase() ?? "";
    return penalty +
      (index > 0 && lineBreakWords.has(first) ? 1 : 0) +
      (index < lines.length - 1 && lineBreakWords.has(last) ? 1 : 0);
  },
  0,
);

export const resolveTypographyLayout = async ({
  text,
  fontRoles,
  maximumLineWidthPx,
  fontSizePx = 72,
  primaryFontRole = "EDITORIAL_DISPLAY",
  measure,
}: {
  text: string;
  fontRoles: GovernedTypographyFont[];
  maximumLineWidthPx: number;
  fontSizePx?: number;
  primaryFontRole?: "EDITORIAL_DISPLAY" | "NEUTRAL_GROTESK";
  measure: TypographyMeasurementProvider;
}): Promise<TypographyLayout> => {
  if (!Number.isFinite(maximumLineWidthPx) || maximumLineWidthPx <= 0) {
    throw new Error("Typography layout requires a positive maximum line width.");
  }
  if (!Number.isFinite(fontSizePx) || fontSizePx <= 0) {
    throw new Error("Typography layout requires a positive measurement font size.");
  }
  for (const font of fontRoles) {
    if (!font.licensed || !font.rendererVerified || !font.assetId || !font.browserUrl) {
      throw new Error(`Measured font geometry is required for ${font.role}.`);
    }
  }
  if (
    !fontRoles.some((font) => font.role === "EDITORIAL_DISPLAY") ||
    !fontRoles.some((font) => font.role === "NEUTRAL_GROTESK")
  ) {
    throw new Error("Typography layout requires governed display and grotesk font roles.");
  }
  const primaryFont = fontRoles.find(
    (font) => font.role === primaryFontRole,
  )!;
  const words = text.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) throw new Error("Typography layout requires text.");

  const candidates = await Promise.all(allPartitions(words).map(async (lines) => {
    const measuredLines = await Promise.all(lines.map(async (line) => {
      const lineText = line.join(" ");
      const result = await measure({text: lineText, font: primaryFont, fontSizePx});
      if (result.status !== "measured" || !Number.isFinite(result.widthPx)) {
        throw new Error(
          `Measured font geometry is unavailable for ${primaryFont.assetId}: ${
            result.status === "unavailable" ? result.reason : "invalid width"
          }`,
        );
      }
      return {text: lineText, widthPx: result.widthPx, measurementId: result.measurementId};
    }));
    const widestLine = Math.max(...measuredLines.map((l) => l.widthPx)); const widthOverhang = widestLine > maximumLineWidthPx ? (widestLine - maximumLineWidthPx) / maximumLineWidthPx : 0;
    const widths = measuredLines.map((line) => line.widthPx);
    const widest = Math.max(...widths);
    const narrowest = Math.min(...widths);
    const widthBalance = widest === 0 ? 0 : 1 - (widest - narrowest) / widest;
    return {
      lines: measuredLines,
      score: widthBalance - semanticPenalty(lines) * 2 - (lines.length - 1) * 0.03,
    };
  }));
  const selected = candidates
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((left, right) => right.score - left.score)[0];
  if (!selected) {
    throw new Error("Measured typography cannot fit a semantic line break in the selected composition.");
  }
  return {
    fontRoles,
    fontSizePx,
    lines: selected.lines,
    measurementIds: selected.lines.map((line) => line.measurementId),
  };
};

export const createUnavailableMaulTypographyProvider = (
  reason: string,
): MaulTypographyProvider => ({
  async plan() {
    return {status: "unavailable", reason};
  },
});

export const createRoleAwareMaulTypographyProvider = ({
  editorialDisplay,
  neutralGrotesk,
}: {
  editorialDisplay: MaulTypographyProvider;
  neutralGrotesk: MaulTypographyProvider;
}): MaulTypographyProvider => ({
  async plan(input) {
    return input.primaryTypeRole === "neutral_grotesk"
      ? neutralGrotesk.plan(input)
      : editorialDisplay.plan(input);
  },
});

export const createMeasuredMaulTypographyProvider = ({
  fontRoles,
  profile: inputProfile,
  measure,
  measurementFontSizePx = 72,
  primaryFontRole = "EDITORIAL_DISPLAY",
}: {
  fontRoles: GovernedTypographyFont[];
  profile: MaulTypographyCompatibilityProfile;
  measure: TypographyMeasurementProvider;
  measurementFontSizePx?: number;
  primaryFontRole?: "EDITORIAL_DISPLAY" | "NEUTRAL_GROTESK";
}): MaulTypographyProvider => {
  const profile = maulTypographyCompatibilityProfileSchema.parse(inputProfile);
  const displayFont = fontRoles.find(
    (font) => font.role === "EDITORIAL_DISPLAY",
  );
  const groteskFont = fontRoles.find(
    (font) => font.role === "NEUTRAL_GROTESK",
  );
  if (!displayFont || !groteskFont) {
    throw new Error("Measured MAUL typography requires display and grotesk font roles.");
  }
  const selectedFont =
    primaryFontRole === "NEUTRAL_GROTESK" ? groteskFont : displayFont;
  if (
    selectedFont.family !== profile.family ||
    !profile.approvedFontAssets.some(
      (asset) =>
        asset.assetId === selectedFont.assetId &&
        asset.family === selectedFont.family,
    ) ||
    profile.loadedFallback.assetId !== selectedFont.assetId ||
    profile.loadedFallback.family !== selectedFont.family ||
    profile.loadedFallback.weight !== selectedFont.weight
  ) {
    throw new Error("Measured MAUL typography profile must prove the selected primary font.");
  }
  for (const font of fontRoles) {
    const resolvedAssetMatches = font.asset &&
      font.asset.assetId === font.assetId &&
      font.asset.family === font.family &&
      font.asset.weight === font.weight &&
      font.asset.browserUrl === font.browserUrl;
    if (!isMaulRendererFontCatalogEntry(font) && !resolvedAssetMatches) {
      throw new Error(
        `MAUL renderer cannot execute the governed font ${font.family} (${font.assetId}, ${font.weight}).`,
      );
    }
  }

  return {
    async plan({chunks, maximumLineWidthPx}) {
      if (chunks.length === 0) {
        return {status: "unavailable", reason: "Measured typography requires governed text chunks."};
      }
      try {
        const layouts = await Promise.all(chunks.map(async (chunk) => ({
          chunkId: chunk.chunkId,
          ...await resolveTypographyLayout({
            text: chunk.text,
            fontRoles,
            maximumLineWidthPx,
            fontSizePx: measurementFontSizePx,
            primaryFontRole,
            measure,
          }),
        })));
        const evidenceIds = [...new Set(layouts.flatMap((layout) => layout.measurementIds))].sort();
        if (evidenceIds.length === 0) {
          return {status: "unavailable", reason: "Typography measurement provider returned no evidence IDs."};
        }
        return {
          status: "available",
          profile,
          fontResolution: {
            requestedRole:
              primaryFontRole === "EDITORIAL_DISPLAY" ? "editorial" : "utility",
            selectedFamily: selectedFont.family,
            selectedAssetId: selectedFont.assetId,
            selectedAsset: selectedFont.asset ?? null,
            accentAsset: fontRoles.find((font) => font.assetId !== selectedFont.assetId)?.asset ?? null,
            status: "eligible_loaded",
            reason: `Measured ${selectedFont.family} geometry was selected from a renderer-verified governed pair.`,
          },
          layouts,
          evidenceIds,
        };
      } catch (error) {
        return {
          status: "unavailable",
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
};

/**
 * Builds MAUL measurement from a planner-selected binary. The descriptor is
 * persisted so the browser renderer has no opportunity to substitute by name.
 */
export const createResolvedMaulTypographyProvider = ({
  primary,
  accent,
  measurementFontSizePx = 72,
}: {
  primary: MaulResolvedFontAssetInput;
  accent: MaulResolvedFontAssetInput;
  measurementFontSizePx?: number;
}): MaulTypographyProvider => {
  const primaryAsset = resolveExactFontAsset(primary);
  const accentAsset = resolveExactFontAsset(accent);
  const editorialDisplay = fontFromResolvedAsset({
    role: "EDITORIAL_DISPLAY",
    asset: primaryAsset,
  });
  const neutralGrotesk = {
    ...fontFromResolvedAsset({
      role: "EDITORIAL_DISPLAY",
      asset: primaryAsset,
    }),
    role: "NEUTRAL_GROTESK",
  } satisfies GovernedTypographyFont;
  const fontRoles = [editorialDisplay, neutralGrotesk];
  const primaryProfile = profileForRendererFont({
    profileId: `maul-measured-${primaryAsset.assetId}-v1`,
    font: editorialDisplay,
    fontPath: primaryAsset.localFilePath,
  });
  const primaryMeasure = createFontkitTypographyMeasurementProvider({
    fontPath: primaryAsset.localFilePath,
    fontAssetId: primaryAsset.assetId,
  });

  const provider = createRoleAwareMaulTypographyProvider({
    editorialDisplay: createMeasuredMaulTypographyProvider({
      fontRoles,
      profile: primaryProfile,
      measure: primaryMeasure,
      measurementFontSizePx,
      primaryFontRole: "EDITORIAL_DISPLAY",
    }),
    neutralGrotesk: createMeasuredMaulTypographyProvider({
      fontRoles,
      profile: primaryProfile,
      measure: primaryMeasure,
      measurementFontSizePx,
      primaryFontRole: "NEUTRAL_GROTESK",
    }),
  });
  return {
    async plan(input) {
      const plan = await provider.plan(input);
      return plan.status === "available"
        ? {
            ...plan,
            fontResolution: {
              ...plan.fontResolution,
              accentAsset,
            },
          }
        : plan;
    },
  };
};

const profileForRendererFont = ({
  profileId,
  font,
  fontPath,
}: {
  profileId: string;
  font: GovernedTypographyFont;
  fontPath: string;
}): MaulTypographyCompatibilityProfile => {
  const bytes = readFileSync(fontPath);
  const loaded = openSync(fontPath);
  if (isFontCollection(loaded)) {
    throw new Error("Default MAUL typography does not accept font collections.");
  }
  const maxGlyphWidthEm = Number(
    (loaded.hhea.advanceWidthMax / loaded.unitsPerEm).toFixed(4),
  );
  const maxLineHeightEm = Number(
    (
      (loaded.ascent - loaded.descent + loaded.lineGap) /
      loaded.unitsPerEm
    ).toFixed(4),
  );
  const fingerprint = createHash("sha256")
    .update(bytes)
    .update(
      JSON.stringify({
        assetId: font.assetId,
        family: font.family,
        weight: font.weight,
        maxGlyphWidthEm,
        maxLineHeightEm,
      }),
    )
    .digest("hex");
  return maulTypographyCompatibilityProfileSchema.parse({
    profileId,
    family: font.family,
    approvedFontAssets: [
      {
        assetId: font.assetId,
        family: font.family,
        weights: [font.weight],
      },
    ],
    loadedFallback: {
      assetId: font.assetId,
      family: font.family,
      weight: font.weight,
    },
    metrics: {
      fingerprint,
      maxGlyphWidthEm,
      maxLineHeightEm,
      minimumFontSizePx: 48,
      maximumFontSizePx: 88,
      minimumLineHeight: 1,
      maximumLineHeight: Math.max(1.2, maxLineHeightEm),
    },
  });
};

const defaultMaulFontRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../remotion-app/public/fonts/maul",
);

const bundledMaulFontSpecs = [
  {
    assetId: "font_google_dm_sans_700",
    family: "DM Sans",
    cssFamily: "DM Sans",
    weight: 700,
    style: "normal",
    fileName: "dm-sans-700.woff2",
    browserUrl: "/fonts/maul/dm-sans-700.woff2",
    format: "woff2",
  },
  {
    assetId: "font_google_playfair_display_700",
    family: "Playfair Display",
    cssFamily: "Playfair Display",
    weight: 700,
    style: "normal",
    fileName: "playfair-display-700.woff2",
    browserUrl: "/fonts/maul/playfair-display-700.woff2",
    format: "woff2",
  },
  {
    assetId: "font_google_playfair_display_italic_700",
    family: "Playfair Display",
    cssFamily: "Playfair Display",
    weight: 700,
    style: "italic",
    fileName: "playfair-display-italic-700.woff2",
    browserUrl: "/fonts/maul/playfair-display-italic-700.woff2",
    format: "woff2",
  },
  {
    assetId: "font_google_bebas_neue_400",
    family: "Bebas Neue",
    cssFamily: "Bebas Neue",
    weight: 400,
    style: "normal",
    fileName: "bebas-neue-400.woff2",
    browserUrl: "/fonts/maul/bebas-neue-400.woff2",
    format: "woff2",
  },
  {
    assetId: "font_google_dm_serif_display_400",
    family: "DM Serif Display",
    cssFamily: "DM Serif Display",
    weight: 400,
    style: "normal",
    fileName: "dm-serif-display-400.woff2",
    browserUrl: "/fonts/maul/dm-serif-display-400.woff2",
    format: "woff2",
  },
  {
    assetId: "font_google_great_vibes_400",
    family: "Great Vibes",
    cssFamily: "Great Vibes",
    weight: 400,
    style: "normal",
    fileName: "great-vibes-400.ttf",
    browserUrl: "/fonts/maul/great-vibes-400.ttf",
    format: "ttf",
  },
] as const;

export const loadBundledMaulFontAssets = (): MaulResolvedFontAsset[] =>
  bundledMaulFontSpecs.map((spec) =>
    maulResolvedFontAssetSchema.parse({
      assetId: spec.assetId,
      family: spec.family,
      cssFamily: spec.cssFamily,
      weight: spec.weight,
      style: spec.style,
      browserUrl: spec.browserUrl,
      localFilePath: path.join(defaultMaulFontRoot, spec.fileName),
      localFileSha256: createHash("sha256")
        .update(readFileSync(path.join(defaultMaulFontRoot, spec.fileName)))
        .digest("hex"),
      format: spec.format,
      source: "bundled",
      license: {
        status: "bundled",
        evidence: ["Bundled MAUL renderer font catalog."],
      },
    }),
  );

export const createDefaultMaulTypographyProvider = (): MaulTypographyProvider => {
  try {
    const assetsById = new Map(
      loadBundledMaulFontAssets().map((asset) => [asset.assetId, asset]),
    );
    const requireAsset = (assetId: string): MaulResolvedFontAsset => {
      const asset = assetsById.get(assetId);
      if (!asset) throw new Error(`Bundled MAUL font asset is missing: ${assetId}`);
      return asset;
    };
    const dmSansAsset = requireAsset("font_google_dm_sans_700");
    const playfairAsset = requireAsset("font_google_playfair_display_700");
    const playfairItalicAsset = requireAsset(
      "font_google_playfair_display_italic_700",
    );
    const bebasAsset = requireAsset("font_google_bebas_neue_400");
    const dmSerifAsset = requireAsset("font_google_dm_serif_display_400");
    const greatVibesAsset = requireAsset("font_google_great_vibes_400");
    const dmSansPath = dmSansAsset.localFilePath;
    const playfairPath = playfairAsset.localFilePath;
    const bebasPath = bebasAsset.localFilePath;
    const dmSerifPath = dmSerifAsset.localFilePath;
    const playfair: GovernedTypographyFont = {
      role: "EDITORIAL_DISPLAY",
      assetId: "font_google_playfair_display_700",
      family: "Playfair Display",
      weight: 700,
      browserUrl: "/fonts/maul/playfair-display-700.woff2",
      licensed: true,
      rendererVerified: true,
    };
    const dmSans: GovernedTypographyFont = {
      role: "NEUTRAL_GROTESK",
      assetId: "font_google_dm_sans_700",
      family: "DM Sans",
      weight: 700,
      browserUrl: "/fonts/maul/dm-sans-700.woff2",
      licensed: true,
      rendererVerified: true,
    };
    const bebas: GovernedTypographyFont = {
      role: "EDITORIAL_DISPLAY",
      assetId: "font_google_bebas_neue_400",
      family: "Bebas Neue",
      weight: 400,
      browserUrl: "/fonts/maul/bebas-neue-400.woff2",
      licensed: true,
      rendererVerified: true,
    };
    const dmSerif: GovernedTypographyFont = {
      role: "EDITORIAL_DISPLAY",
      assetId: "font_google_dm_serif_display_400",
      family: "DM Serif Display",
      weight: 400,
      browserUrl: "/fonts/maul/dm-serif-display-400.woff2",
      licensed: true,
      rendererVerified: true,
    };
    const createSystemProvider = ({
      display,
      displayPath,
      profileId,
      accentAsset,
    }: {
      display: GovernedTypographyFont;
      displayPath: string;
      profileId: string;
      accentAsset: MaulResolvedFontAsset;
    }): MaulTypographyProvider => {
      const fontRoles = [display, dmSans];
      const provider = createRoleAwareMaulTypographyProvider({
        editorialDisplay: createMeasuredMaulTypographyProvider({
          fontRoles,
          profile: profileForRendererFont({
            profileId,
            font: display,
            fontPath: displayPath,
          }),
          measure: createFontkitTypographyMeasurementProvider({
            fontPath: displayPath,
            fontAssetId: display.assetId,
          }),
          primaryFontRole: "EDITORIAL_DISPLAY",
        }),
        neutralGrotesk: createMeasuredMaulTypographyProvider({
          fontRoles,
          profile: profileForRendererFont({
            profileId: "maul-measured-dm-sans-local-v1",
            font: dmSans,
            fontPath: dmSansPath,
          }),
          measure: createFontkitTypographyMeasurementProvider({
            fontPath: dmSansPath,
            fontAssetId: dmSans.assetId,
          }),
          primaryFontRole: "NEUTRAL_GROTESK",
        }),
      });
      return {
        async plan(input) {
          const plan = await provider.plan(input);
          return plan.status === "available"
            ? {
                ...plan,
                fontResolution: {
                  ...plan.fontResolution,
                  accentAsset,
                },
              }
            : plan;
        },
      };
    };
    const systems: Record<MaulEditorialFontSystemId, MaulTypographyProvider> = {
      grotesk_editorial_hinge: createSystemProvider({
        display: playfair,
        displayPath: playfairPath,
        profileId: "maul-measured-playfair-display-local-v1",
        accentAsset: greatVibesAsset,
      }),
      condensed_kinetic_hinge: createSystemProvider({
        display: bebas,
        displayPath: bebasPath,
        profileId: "maul-measured-bebas-neue-local-v1",
        accentAsset: playfairItalicAsset,
      }),
      serif_editorial_hinge: createSystemProvider({
        display: dmSerif,
        displayPath: dmSerifPath,
        profileId: "maul-measured-dm-serif-display-local-v1",
        accentAsset: greatVibesAsset,
      }),
    };
    return {
      async plan(input) {
        const fontSystemId = input.fontSystemId ?? "grotesk_editorial_hinge";
        const provider = systems[fontSystemId];
        if (!provider) {
          return {
            status: "unavailable",
            reason:
              "MAUL font system " + fontSystemId +
              " is not backed by the renderer catalog and local font binaries.",
          };
        }
        return provider.plan(input);
      },
    };
  } catch (error) {
    return createUnavailableMaulTypographyProvider(
      "Default renderer font measurement is unavailable: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
};
