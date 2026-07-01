import type {RenderConfig} from "../config/render-flags";

type TypographyFontSource = "custom_ingested" | "system" | "fallback";
type TypographyFontRole = "hero" | "support" | "cta";

export type TypographyDecisionInput = {
  text: string;
  rhetoricalIntent: "authority" | "emphasis" | "premium_explain" | "neutral";
  availableFonts: Array<{family: string; source: TypographyFontSource}>;
  renderConfig: RenderConfig;
  maxLines?: number;
  maxCharsPerLine?: number;
  pairingThreshold?: number;
};

export type TypographyFontSelection = {
  fontId: string;
  family: string;
  source: TypographyFontSource;
  role: TypographyFontRole;
};

export type TypographyFontPairing = {
  primary: TypographyFontSelection;
  secondary?: TypographyFontSelection;
  graphUsed: boolean;
  pairingScore?: number;
  reason: string;
};

export type TypographyRoleStyle = {
  role: "hero" | "support" | "cta";
  fontRole: TypographyFontRole;
  trackingEm: number;
  weight: number;
  hierarchyLevel: number;
  hierarchyScale: number;
  lineHeight: number;
};

export type TypographyDecision = {
  primaryFont: {family: string; source: TypographyFontSource; role: string};
  secondaryFont?: {family: string; source: TypographyFontSource; role: string};
  graphUsed: boolean;
  pairingScore?: number;
  fontPairing: TypographyFontPairing;
  roleStyles: TypographyRoleStyle[];
  fallbackUsed: boolean;
  fallbackReasons: string[];
  coreWords: string[];
  linePlan: {
    lines: string[];
    maxLines: number;
    maxCharsPerLine: number;
  };
};

const normalizeText = (value: string): string => value.replace(/\s+/g, " ").trim();

const splitLines = (text: string, maxLines: number, maxCharsPerLine: number): string[] => {
  const words = normalizeText(text).split(" ").filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine || current.length === 0) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length >= maxLines) {
      break;
    }
  }
  if (lines.length < maxLines && current) {
    lines.push(current);
  }
  return lines.slice(0, maxLines);
};

const selectCoreWords = (text: string, intent: TypographyDecisionInput["rhetoricalIntent"]): string[] => {
  const tokens = normalizeText(text)
    .split(" ")
    .map((word) => word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ""))
    .filter((word) => word.length >= 5);
  if (tokens.length === 0) {
    return [];
  }
  if (intent === "emphasis" || intent === "authority") {
    return tokens.slice(0, Math.min(3, tokens.length));
  }
  return tokens.slice(0, 2);
};

const scorePairing = (primary: string, secondary: string): number => {
  const sameStart = primary[0]?.toLowerCase() === secondary[0]?.toLowerCase();
  return sameStart ? 0.68 : 0.9;
};

const fontIdFor = (family: string, role: TypographyFontRole): string => {
  const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${role}-${slug || "font"}`;
};

const roleStyleProfileFor = (intent: TypographyDecisionInput["rhetoricalIntent"]) => {
  if (intent === "authority") {
    return {heroWeight: 820, heroTracking: -0.045, heroScale: 1.36, supportWeight: 520, supportTracking: 0.08};
  }
  if (intent === "emphasis") {
    return {heroWeight: 800, heroTracking: -0.038, heroScale: 1.3, supportWeight: 520, supportTracking: 0.06};
  }
  if (intent === "premium_explain") {
    return {heroWeight: 760, heroTracking: -0.028, heroScale: 1.24, supportWeight: 500, supportTracking: 0.07};
  }
  return {heroWeight: 680, heroTracking: -0.018, heroScale: 1.16, supportWeight: 500, supportTracking: 0.045};
};

const buildRoleStyles = (intent: TypographyDecisionInput["rhetoricalIntent"]): TypographyRoleStyle[] => {
  const profile = roleStyleProfileFor(intent);
  return [
    {
      role: "hero",
      fontRole: "hero",
      trackingEm: profile.heroTracking,
      weight: profile.heroWeight,
      hierarchyLevel: 1,
      hierarchyScale: profile.heroScale,
      lineHeight: 0.94,
    },
    {
      role: "support",
      fontRole: "support",
      trackingEm: profile.supportTracking,
      weight: profile.supportWeight,
      hierarchyLevel: 2,
      hierarchyScale: 1,
      lineHeight: 1.08,
    },
    {
      role: "cta",
      fontRole: "cta",
      trackingEm: 0.04,
      weight: Math.max(700, profile.supportWeight + 120),
      hierarchyLevel: 1,
      hierarchyScale: Math.max(1.12, profile.heroScale - 0.08),
      lineHeight: 0.98,
    },
  ];
};

export const generateTypographyDecision = (input: TypographyDecisionInput): TypographyDecision => {
  const maxLines = input.maxLines ?? 3;
  const maxCharsPerLine = input.maxCharsPerLine ?? 28;
  const pairingThreshold = input.pairingThreshold ?? 0.8;
  const fallbackReasons: string[] = [];

  const customFonts = input.availableFonts.filter((font) => font.source === "custom_ingested");
  const systemFonts = input.availableFonts.filter((font) => font.source === "system");
  const fontPool = customFonts.length > 0 ? customFonts : systemFonts;

  let primary = fontPool[0];
  let fallbackUsed = false;
  if (!primary) {
    fallbackUsed = true;
    fallbackReasons.push("No custom or system fonts available.");
    primary = {family: "sans-serif", source: "fallback"};
  } else if (primary.source !== "custom_ingested") {
    fallbackUsed = true;
    fallbackReasons.push("No custom ingested font available.");
  }

  let secondary: TypographyDecision["secondaryFont"] | undefined;
  let pairingScore: number | undefined;
  if (fontPool.length > 1) {
    const candidate = fontPool[1]!;
    pairingScore = scorePairing(primary.family, candidate.family);
    if (pairingScore >= pairingThreshold) {
      secondary = {
        family: candidate.family,
        source: candidate.source,
        role: "support"
      };
    }
  }

  const lines = splitLines(input.text, maxLines, maxCharsPerLine);
  const coreWords = selectCoreWords(input.text, input.rhetoricalIntent);
  const roleStyles = buildRoleStyles(input.rhetoricalIntent);
  const fontPairing: TypographyFontPairing = {
    primary: {
      fontId: fontIdFor(primary.family, "hero"),
      family: primary.family,
      source: primary.source,
      role: "hero",
    },
    secondary: secondary
      ? {
          fontId: fontIdFor(secondary.family, "support"),
          family: secondary.family,
          source: secondary.source,
          role: "support",
        }
      : undefined,
    graphUsed: input.renderConfig.ENABLE_FONT_GRAPH,
    pairingScore,
    reason: secondary
      ? "Resolved role-based hero/support pairing through deterministic typography math."
      : "Resolved hero typography without a qualified support pairing.",
  };

  return {
    primaryFont: {
      family: primary.family,
      source: primary.source,
      role: "headline"
    },
    secondaryFont: secondary,
    graphUsed: input.renderConfig.ENABLE_FONT_GRAPH,
    pairingScore,
    fontPairing,
    roleStyles,
    fallbackUsed,
    fallbackReasons,
    coreWords,
    linePlan: {
      lines,
      maxLines,
      maxCharsPerLine
    }
  };
};
