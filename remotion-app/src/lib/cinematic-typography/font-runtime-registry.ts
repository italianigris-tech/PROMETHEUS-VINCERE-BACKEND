import type {TypographyRoleSlotId} from "./typography-doctrine";
import {
  getManifestBackedPaletteForCandidate,
  getManifestBackedPalettes,
  type ManifestBackedEditorialFontPalette,
  type ManifestBackedPaletteId
} from "../font-intelligence/runtime-font-bridge";

export type EditorialFontPaletteId =
  | ManifestBackedPaletteId
  | "fraunces-editorial"
  | "playfair-contrast"
  | "cormorant-salon"
  | "crimson-voice"
  | "lora-documentary"
  | "instrument-nocturne"
  | "noto-display"
  | "dm-sans-core";

export type EditorialFontPalette = {
  id: EditorialFontPaletteId;
  displayFamily: string;
  supportFamily: string;
  italicFamily: string;
  runtimeCssFamily: string;
  runtimeFontStack: string;
  primaryFamilyName: string;
  displayWeight: number;
  supportWeight: number;
  availableWeights: number[];
  moodTags: string[];
  doctrineRoleIds: TypographyRoleSlotId[];
};

type RuntimeFontAliasSource = {
  familyId?: string | null;
  fontId?: string | null;
};

type EditorialFontPaletteSeed = Omit<
  EditorialFontPalette,
  "runtimeCssFamily" | "runtimeFontStack" | "primaryFamilyName"
>;

const SAFE_EDITORIAL_FONT_STACK = "\"Fraunces\", \"Times New Roman\", serif";

const sanitizeAliasSegment = (value: string | null | undefined): string => {
  if (typeof value !== "string") {
    return "unknown";
  }

  const lowerValue = value.trim().toLowerCase();
  if (!lowerValue || lowerValue === "undefined" || lowerValue === "null" || lowerValue === "nan") {
    return "unknown";
  }

  const normalized = lowerValue
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "unknown";
};

export const getRuntimeFontCssFamily = (
  recordOrFamily: RuntimeFontAliasSource | string
): string => {
  if (typeof recordOrFamily === "string") {
    return `__prometheus_font_${sanitizeAliasSegment(recordOrFamily)}`;
  }

  const familyAliasSegment = sanitizeAliasSegment(recordOrFamily.familyId);
  if (familyAliasSegment !== "unknown") {
    return `__prometheus_font_${familyAliasSegment}`;
  }

  const fontAliasSegment = sanitizeAliasSegment(recordOrFamily.fontId);
  return `__prometheus_font_${fontAliasSegment === "unknown"
    ? "unknown"
    : `unknown_${fontAliasSegment}`}`;
};

const extractPrimaryFamilyName = (fontStack: string): string | null => {
  const quotedMatch = fontStack.match(/^\s*"([^"]+)"/);
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim() || null;
  }

  const firstSegment = fontStack.split(",")[0]?.trim();
  return firstSegment || null;
};

const isValidFontStack = (value: string | null | undefined): value is string => {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return Boolean(
    normalized &&
    !normalized.includes("undefined") &&
    !normalized.includes("null") &&
    !normalized.includes("nan")
  );
};

const buildRuntimeFontStack = ({
  runtimeCssFamily,
  fallbackStack
}: {
  runtimeCssFamily: string;
  fallbackStack: string;
}): string => {
  const safeFallbackStack = isValidFontStack(fallbackStack)
    ? fallbackStack
    : SAFE_EDITORIAL_FONT_STACK;
  return `"${runtimeCssFamily}", ${safeFallbackStack}`;
};

const toEditorialFontPalette = (
  palette: EditorialFontPaletteSeed
): EditorialFontPalette => {
  const primaryFamilyName = extractPrimaryFamilyName(palette.displayFamily) ?? "Fraunces";
  const runtimeCssFamily = getRuntimeFontCssFamily({
    familyId: primaryFamilyName,
    fontId: palette.id
  });

  return {
    ...palette,
    runtimeCssFamily,
    runtimeFontStack: buildRuntimeFontStack({
      runtimeCssFamily,
      fallbackStack: palette.displayFamily
    }),
    primaryFamilyName
  };
};

const toManifestBackedEditorialFontPalette = (
  palette: ManifestBackedEditorialFontPalette
): EditorialFontPalette => {
  const primaryFamilyName = palette.familyName || extractPrimaryFamilyName(palette.displayFamily) || "Fraunces";
  const runtimeCssFamily = palette.cssFamily || getRuntimeFontCssFamily({
    familyId: palette.familyId,
    fontId: palette.id
  });

  return {
    ...palette,
    runtimeCssFamily,
    runtimeFontStack: buildRuntimeFontStack({
      runtimeCssFamily,
      fallbackStack: palette.displayFamily
    }),
    primaryFamilyName
  };
};

const EDITORIAL_FONT_PALETTE_SEEDS: EditorialFontPaletteSeed[] = [
  {
    id: "fraunces-editorial",
    displayFamily: "\"Fraunces\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Fraunces\", \"Times New Roman\", serif",
    displayWeight: 600,
    supportWeight: 500,
    availableWeights: [400, 500, 600, 700, 800],
    moodTags: ["editorial", "luxury", "cinematic"],
    doctrineRoleIds: ["editorial_serif_support"]
  },
  {
    id: "playfair-contrast",
    displayFamily: "\"Playfair Display\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Playfair Display\", \"Times New Roman\", serif",
    displayWeight: 700,
    supportWeight: 500,
    availableWeights: [400, 500, 600, 700, 800],
    moodTags: ["editorial", "dramatic", "headline"],
    doctrineRoleIds: ["editorial_serif_support"]
  },
  {
    id: "cormorant-salon",
    displayFamily: "\"Cormorant Garamond\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Cormorant Garamond\", \"Times New Roman\", serif",
    displayWeight: 600,
    supportWeight: 500,
    availableWeights: [400, 500, 600, 700, 800],
    moodTags: ["luxury", "poetic", "emotional"],
    doctrineRoleIds: ["editorial_serif_support"]
  },
  {
    id: "crimson-voice",
    displayFamily: "\"Crimson Pro\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Crimson Pro\", \"Times New Roman\", serif",
    displayWeight: 600,
    supportWeight: 500,
    availableWeights: [400, 500, 600, 700, 800],
    moodTags: ["documentary", "editorial", "human"],
    doctrineRoleIds: ["editorial_serif_support"]
  },
  {
    id: "lora-documentary",
    displayFamily: "\"Lora\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Lora\", \"Times New Roman\", serif",
    displayWeight: 600,
    supportWeight: 500,
    availableWeights: [400, 500, 600, 700, 800],
    moodTags: ["documentary", "thoughtful", "clear"],
    doctrineRoleIds: ["editorial_serif_support"]
  },
  {
    id: "instrument-nocturne",
    displayFamily: "\"Instrument Serif\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Instrument Serif\", \"Times New Roman\", serif",
    displayWeight: 400,
    supportWeight: 500,
    availableWeights: [400, 500, 600, 700, 800],
    moodTags: ["luxury", "premium", "soft-focus"],
    doctrineRoleIds: ["editorial_serif_support"]
  },
  {
    id: "noto-display",
    displayFamily: "\"Noto Serif Display\", \"Times New Roman\", serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Noto Serif Display\", \"Times New Roman\", serif",
    displayWeight: 700,
    supportWeight: 500,
    availableWeights: [400, 500, 600, 700, 800],
    moodTags: ["monument", "prestige", "statement"],
    doctrineRoleIds: ["hero_serif_alternate"]
  },
  {
    id: "dm-sans-core",
    displayFamily: "\"DM Sans\", sans-serif",
    supportFamily: "\"DM Sans\", sans-serif",
    italicFamily: "\"Fraunces\", \"Times New Roman\", serif",
    displayWeight: 700,
    supportWeight: 500,
    availableWeights: [400, 500, 600, 700, 800],
    moodTags: ["modern", "precision", "directive"],
    doctrineRoleIds: ["neutral_sans_core"]
  }
];

export const EDITORIAL_FONT_PALETTES: EditorialFontPalette[] = [
  ...EDITORIAL_FONT_PALETTE_SEEDS.map(toEditorialFontPalette),
  ...getManifestBackedPalettes().map(toManifestBackedEditorialFontPalette)
];

const fontPaletteMap = new Map(EDITORIAL_FONT_PALETTES.map((palette) => [palette.id, palette]));

export const TYPOGRAPHY_RUNTIME_CANDIDATE_TO_PALETTE: Partial<Record<string, EditorialFontPaletteId>> = {
  "dm-sans": "dm-sans-core",
  "fraunces": "fraunces-editorial",
  "crimson-pro": "crimson-voice",
  "instrument-serif": "instrument-nocturne",
  "noto-serif-display": "noto-display",
  "playfair-display": "playfair-contrast",
  "cormorant-garamond": "cormorant-salon"
};

export const getEditorialFontPalette = (
  paletteId: EditorialFontPaletteId | null | undefined
): EditorialFontPalette => {
  return fontPaletteMap.get(paletteId ?? "fraunces-editorial") ?? EDITORIAL_FONT_PALETTES[0];
};

export const getEditorialFontPalettesForRole = (
  roleId: TypographyRoleSlotId
): EditorialFontPalette[] => {
  return EDITORIAL_FONT_PALETTES.filter((palette) => palette.doctrineRoleIds.includes(roleId));
};

export const getRuntimePaletteIdForTypographyCandidate = (
  candidateId: string
): EditorialFontPaletteId | null => {
  const manifestBackedPalette = getManifestBackedPaletteForCandidate(candidateId);
  if (manifestBackedPalette) {
    return manifestBackedPalette.id;
  }
  return TYPOGRAPHY_RUNTIME_CANDIDATE_TO_PALETTE[candidateId] ?? null;
};

export const isRuntimeSelectableTypographyCandidate = (candidateId: string): boolean => {
  return Boolean(getRuntimePaletteIdForTypographyCandidate(candidateId));
};

export const getRuntimeSelectableTypographyCandidateIds = (): string[] => {
  return [...new Set([
    ...getManifestBackedPalettes().map((palette) => palette.candidateId),
    ...Object.keys(TYPOGRAPHY_RUNTIME_CANDIDATE_TO_PALETTE)
  ])];
};
