import {
  isMaulRendererFontCatalogEntry,
  maulTypographyCompatibilityProfileSchema,
  type MaulTypographyCompatibilityProfile,
} from "@prometheus/shared-types";

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
};

export type TypographyMeasurementProvider = (input: {
  text: string;
  font: GovernedTypographyFont;
  fontSizePx: number;
}) => Promise<
  | {status: "measured"; widthPx: number; measurementId: string}
  | {status: "unavailable"; reason: string}
>;

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
        requestedRole: "editorial";
        selectedFamily: string;
        selectedAssetId: string;
        status: "eligible_loaded";
        reason: string;
      };
      layouts: MaulMeasuredTypographyLayout[];
      evidenceIds: string[];
    }
  | {
      status: "unavailable";
      reason: string;
    };

export interface MaulTypographyProvider {
  plan(input: {
    chunks: Array<{chunkId: string; text: string}>;
    maximumLineWidthPx: number;
  }): Promise<MaulTypographyPlan>;
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
  measure,
}: {
  text: string;
  fontRoles: GovernedTypographyFont[];
  maximumLineWidthPx: number;
  fontSizePx?: number;
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
  const displayFont = fontRoles.find(
    (font) => font.role === "EDITORIAL_DISPLAY",
  )!;
  const words = text.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) throw new Error("Typography layout requires text.");

  const candidates = await Promise.all(allPartitions(words).map(async (lines) => {
    const measuredLines = await Promise.all(lines.map(async (line) => {
      const lineText = line.join(" ");
      const result = await measure({text: lineText, font: displayFont, fontSizePx});
      if (result.status !== "measured" || !Number.isFinite(result.widthPx)) {
        throw new Error(
          `Measured font geometry is unavailable for ${displayFont.assetId}: ${
            result.status === "unavailable" ? result.reason : "invalid width"
          }`,
        );
      }
      return {text: lineText, widthPx: result.widthPx, measurementId: result.measurementId};
    }));
    if (measuredLines.some((line) => line.widthPx > maximumLineWidthPx)) return null;
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

export const createMeasuredMaulTypographyProvider = ({
  fontRoles,
  profile: inputProfile,
  measure,
  measurementFontSizePx = 72,
}: {
  fontRoles: GovernedTypographyFont[];
  profile: MaulTypographyCompatibilityProfile;
  measure: TypographyMeasurementProvider;
  measurementFontSizePx?: number;
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
  if (
    displayFont.family !== profile.family ||
    !profile.approvedFontAssets.some(
      (asset) => asset.assetId === displayFont.assetId && asset.family === displayFont.family,
    ) ||
    profile.loadedFallback.assetId !== displayFont.assetId ||
    profile.loadedFallback.family !== displayFont.family ||
    profile.loadedFallback.weight !== displayFont.weight
  ) {
    throw new Error("Measured MAUL typography profile must prove the selected display font.");
  }
  for (const font of fontRoles) {
    if (!isMaulRendererFontCatalogEntry(font)) {
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
            requestedRole: "editorial",
            selectedFamily: displayFont.family,
            selectedAssetId: displayFont.assetId,
            status: "eligible_loaded",
            reason: `Measured ${displayFont.family} geometry was selected from a renderer-verified governed pair.`,
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
