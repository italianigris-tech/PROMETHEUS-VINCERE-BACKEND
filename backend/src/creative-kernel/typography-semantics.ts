export const TYPOGRAPHY_SEMANTICS_KERNEL_VERSION =
  "typography-semantics-kernel-v1" as const;

export const TYPOGRAPHY_SEMANTICS_RULE_IDS = [
  "type.normalize-source-token",
  "type.filler-never-hero",
  "type.semantic-weight-before-format",
  "type.preserve-source-order",
  "type.readable-line-budget",
  "type.hero-support-hierarchy",
] as const;

export type TypographySemanticIntent =
  | "authority"
  | "emphasis"
  | "premium_explain"
  | "neutral";

export type TypographySemanticRole = "filler" | "support" | "hero" | "cta";

export type TypographySemanticTokenInput = {
  text: string;
  startMs?: number;
  endMs?: number;
  confidence?: number;
  emphasis?: number;
  energy?: number;
};

export type TypographySemanticToken = {
  sourceIndex: number;
  text: string;
  normalized: string;
  startMs: number;
  endMs: number;
  role: TypographySemanticRole;
  score: number;
  reasons: string[];
};

export type TypographySemanticLine = {
  tokenIndexes: number[];
  text: string;
  role: Exclude<TypographySemanticRole, "filler">;
  maxCharacters: number;
};

export type TypographySemanticsQuality = {
  score: number;
  failures: string[];
  warnings: string[];
};

export type TypographySemanticsTrace = {
  version: typeof TYPOGRAPHY_SEMANTICS_KERNEL_VERSION;
  ruleIds: Array<(typeof TYPOGRAPHY_SEMANTICS_RULE_IDS)[number]>;
  intent: TypographySemanticIntent;
  tokens: TypographySemanticToken[];
  visibleTokenIndexes: number[];
  lines: TypographySemanticLine[];
  quality: TypographySemanticsQuality;
};

export type TypographySemanticsInput = {
  tokens: readonly TypographySemanticTokenInput[];
  intent: TypographySemanticIntent;
  fillerTreatment: "suppress" | "dim" | "show_dimmed";
  maxVisibleTokens: number;
  maxLines: number;
  maxWordsPerLine: number;
  maxCharsPerLine: number;
};

export type SharedTypographyRoleStyle = {
  role: "hero" | "support" | "cta";
  fontRole: "hero" | "support" | "cta";
  trackingEm: number;
  weight: number;
  hierarchyLevel: number;
  hierarchyScale: number;
  lineHeight: number;
};

const FILLER_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "if",
  "in",
  "is",
  "it",
  "just",
  "like",
  "of",
  "on",
  "or",
  "so",
  "that",
  "the",
  "this",
  "to",
  "uh",
  "um",
  "was",
  "we",
  "with",
  "you",
  "your",
]);

const SEMANTIC_DENSE_HINTS = new Set([
  "build",
  "change",
  "create",
  "focus",
  "growth",
  "learn",
  "move",
  "premium",
  "profit",
  "scale",
  "secret",
  "system",
  "win",
]);

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const normalizeToken = (text: string): string =>
  text.replace(/[^a-z0-9']/gi, "").toLowerCase();

const roleFor = (
  score: number,
  normalized: string,
): TypographySemanticRole => {
  if (FILLER_WORDS.has(normalized)) {
    return "filler";
  }
  return score >= 0.72 ? "hero" : "support";
};

const scoreToken = (
  token: TypographySemanticTokenInput,
  sourceIndex: number,
): TypographySemanticToken => {
  const normalized = normalizeToken(token.text);
  const confidence = token.confidence ?? 0.85;
  const energy = token.energy ?? 0.5;
  const reasons: string[] = [];
  let score = 0.22;

  if (FILLER_WORDS.has(normalized)) {
    reasons.push("common_filler_word");
    score -= 0.22;
  }
  if (normalized.length >= 6) {
    reasons.push("semantic_density");
    score += 0.18;
  }
  if (SEMANTIC_DENSE_HINTS.has(normalized)) {
    reasons.push("semantic_density");
    score += 0.22;
  }
  if (energy >= 0.78) {
    reasons.push("high_energy");
    score += 0.32;
  } else if (energy >= 0.58) {
    reasons.push("medium_energy");
    score += 0.14;
  }
  if (/[!?]$/.test(token.text)) {
    reasons.push("punctuation_emphasis");
    score += 0.2;
  }
  if (confidence >= 0.96) {
    reasons.push("high_confidence");
    score += 0.08;
  }
  if ((token.emphasis ?? 0) >= 0.7) {
    reasons.push("transcript_emphasis");
    score += 0.22;
  }

  const clampedScore = clamp01(score);
  return {
    sourceIndex,
    text: token.text.replace(/[.!?]$/, ""),
    normalized,
    startMs: token.startMs ?? sourceIndex * 100,
    endMs: Math.max(
      token.endMs ?? sourceIndex * 100 + 100,
      token.startMs ?? sourceIndex * 100,
    ),
    role: roleFor(clampedScore, normalized),
    score: clampedScore,
    reasons: [...new Set(reasons)],
  };
};

const visibleTokensFor = (
  tokens: readonly TypographySemanticToken[],
  input: TypographySemanticsInput,
): TypographySemanticToken[] => {
  const eligible = tokens.filter(
    (token) =>
      token.role !== "filler" || input.fillerTreatment !== "suppress",
  );
  const roleRank: Record<TypographySemanticRole, number> = {
    cta: 4,
    hero: 3,
    support: 2,
    filler: 1,
  };
  return [...eligible]
    .sort(
      (left, right) =>
        roleRank[right.role] - roleRank[left.role] ||
        right.score - left.score ||
        left.sourceIndex - right.sourceIndex,
    )
    .slice(0, input.maxVisibleTokens)
    .sort((left, right) => left.sourceIndex - right.sourceIndex);
};

const buildLines = (
  visible: readonly TypographySemanticToken[],
  input: TypographySemanticsInput,
): TypographySemanticLine[] => {
  const groups: TypographySemanticToken[][] = [];
  let current: TypographySemanticToken[] = [];
  const flush = () => {
    if (current.length > 0 && groups.length < input.maxLines) {
      groups.push(current);
    }
    current = [];
  };

  for (const token of visible) {
    if (groups.length >= input.maxLines) {
      break;
    }
    if (token.role === "hero" || token.role === "cta") {
      flush();
      if (groups.length < input.maxLines) {
        groups.push([token]);
      }
      continue;
    }
    const candidateText = [...current, token]
      .map((candidate) => candidate.text)
      .join(" ");
    if (
      current.length >= input.maxWordsPerLine ||
      (current.length > 0 && candidateText.length > input.maxCharsPerLine)
    ) {
      flush();
    }
    if (groups.length < input.maxLines) {
      current.push(token);
    }
  }
  flush();

  return groups.slice(0, input.maxLines).map((group) => ({
    tokenIndexes: group.map((token) => token.sourceIndex),
    text: group.map((token) => token.text).join(" "),
    role: group.some((token) => token.role === "hero")
      ? "hero"
      : group.some((token) => token.role === "cta")
        ? "cta"
        : "support",
    maxCharacters: input.maxCharsPerLine,
  }));
};

export const evaluateTypographySemanticsQuality = ({
  tokens,
  lines,
  fillerTreatment,
  maxLines,
  hierarchyScale,
}: {
  tokens: readonly TypographySemanticToken[];
  lines: readonly TypographySemanticLine[];
  fillerTreatment: TypographySemanticsInput["fillerTreatment"];
  maxLines: number;
  hierarchyScale: number;
}): TypographySemanticsQuality => {
  const failures = new Set<string>();
  const warnings = new Set<string>();
  const visibleIndexes = new Set(lines.flatMap((line) => line.tokenIndexes));
  const visibleFillerCount = tokens.filter(
    (token) => token.role === "filler" && visibleIndexes.has(token.sourceIndex),
  ).length;

  if (lines.length > maxLines || visibleFillerCount > 0) {
    failures.add("typography_clutter");
  }
  if (lines.some((line) => line.text.length > line.maxCharacters)) {
    failures.add("typography_broken_line_rhythm");
  }
  if (
    lines.some((line) => line.role === "hero") &&
    lines.some((line) => line.role === "support") &&
    hierarchyScale < 1.1
  ) {
    failures.add("typography_insufficient_contrast");
  }
  if (
    fillerTreatment === "suppress" &&
    tokens.some((token) => token.role === "filler")
  ) {
    warnings.add("filler_suppressed");
  }
  if (!lines.some((line) => line.role === "hero")) {
    warnings.add("typography_no_hero_line");
  }

  return {
    score: clamp01(1 - failures.size * 0.16 - warnings.size * 0.03),
    failures: [...failures].sort(),
    warnings: [...warnings].sort(),
  };
};

const hierarchyProfileFor = (intent: TypographySemanticIntent) => {
  if (intent === "authority") {
    return {
      heroWeight: 820,
      heroTracking: -0.045,
      heroScale: 1.36,
      supportWeight: 520,
      supportTracking: 0.08,
      heroLineHeight: 0.94,
      supportLineHeight: 1.08,
    };
  }
  if (intent === "emphasis") {
    return {
      heroWeight: 800,
      heroTracking: -0.038,
      heroScale: 1.3,
      supportWeight: 520,
      supportTracking: 0.06,
      heroLineHeight: 0.94,
      supportLineHeight: 1.08,
    };
  }
  if (intent === "premium_explain") {
    return {
      heroWeight: 760,
      heroTracking: -0.032,
      heroScale: 1.24,
      supportWeight: 500,
      supportTracking: 0.07,
      heroLineHeight: 0.96,
      supportLineHeight: 1.1,
    };
  }
  return {
    heroWeight: 680,
    heroTracking: -0.018,
    heroScale: 1.16,
    supportWeight: 480,
    supportTracking: 0.045,
    heroLineHeight: 1,
    supportLineHeight: 1.12,
  };
};

export const buildSharedTypographyRoleStyles = (
  intent: TypographySemanticIntent,
): SharedTypographyRoleStyle[] => {
  const profile = hierarchyProfileFor(intent);
  return [
    {
      role: "hero",
      fontRole: "hero",
      trackingEm: profile.heroTracking,
      weight: profile.heroWeight,
      hierarchyLevel: 1,
      hierarchyScale: profile.heroScale,
      lineHeight: profile.heroLineHeight,
    },
    {
      role: "support",
      fontRole: "support",
      trackingEm: profile.supportTracking,
      weight: profile.supportWeight,
      hierarchyLevel: 2,
      hierarchyScale: 1,
      lineHeight: profile.supportLineHeight,
    },
    {
      role: "cta",
      fontRole: "cta",
      trackingEm: 0.04,
      weight: Math.max(700, profile.supportWeight + 120),
      hierarchyLevel: 1,
      hierarchyScale: Math.max(1.1, profile.heroScale - 0.08),
      lineHeight: 0.98,
    },
  ];
};

export const planTypographySemantics = (
  input: TypographySemanticsInput,
): TypographySemanticsTrace => {
  const tokens = input.tokens.map(scoreToken);
  const visible = visibleTokensFor(tokens, input);
  const lines = buildLines(visible, input);
  const hierarchyScale =
    buildSharedTypographyRoleStyles(input.intent).find(
      (style) => style.role === "hero",
    )?.hierarchyScale ?? 1;
  return {
    version: TYPOGRAPHY_SEMANTICS_KERNEL_VERSION,
    ruleIds: [...TYPOGRAPHY_SEMANTICS_RULE_IDS],
    intent: input.intent,
    tokens,
    visibleTokenIndexes: visible.map((token) => token.sourceIndex),
    lines,
    quality: evaluateTypographySemanticsQuality({
      tokens,
      lines,
      fillerTreatment: input.fillerTreatment,
      maxLines: input.maxLines,
      hierarchyScale,
    }),
  };
};

export const selectTypographyCoreWords = (
  trace: TypographySemanticsTrace,
  count: number,
): string[] =>
  trace.tokens
    .filter((token) => token.role !== "filler")
    .sort(
      (left, right) =>
        right.score - left.score || left.sourceIndex - right.sourceIndex,
    )
    .slice(0, count)
    .sort((left, right) => left.sourceIndex - right.sourceIndex)
    .map((token) => token.text);
