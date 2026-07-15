import type {
  JosephTypographyCompositionRules,
  JosephTypographyFontPairing,
  JosephTypographyIntelligencePlan,
  JosephTypographyLine,
  JosephTypographyQualityAudit,
  JosephTypographyRoleStyle,
  JosephTypographyStylebookId,
  JosephTypographyWordWeight,
  Word,
} from "@prometheus/shared-types";
import type {DirectorInput} from "./joseph-director";

type TypographyRole = JosephTypographyWordWeight["role"];
type CaseTreatment = JosephTypographyLine["caseTreatment"];

export type JosephTypographyStylebook = {
  id: JosephTypographyStylebookId;
  label: string;
  profileAffinity: readonly DirectorInput["profile"][];
  doctrineAffinity: readonly string[];
  compositionRules: JosephTypographyCompositionRules;
};

export type JosephTypographyPlanInput = {
  words: readonly Word[];
  energyCurve: readonly number[];
  durationMs: number;
  profile: DirectorInput["profile"];
  doctrineId?: string;
};

export type JosephTypographyQuality = JosephTypographyQualityAudit;

const FPS = 30;

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

const msToFrame = (ms: number): number => Math.max(0, Math.round((ms / 1000) * FPS));

const cleanWord = (text: string): string => text.replace(/[^a-z0-9']/gi, "").toLowerCase();

const energyAtMs = (energyCurve: readonly number[], durationMs: number, ms: number): number => {
  if (durationMs <= 0 || energyCurve.length === 0) {
    return 0.5;
  }
  const index = Math.min(
    energyCurve.length - 1,
    Math.max(0, Math.floor((ms / durationMs) * energyCurve.length)),
  );
  return energyCurve[index] ?? 0.5;
};

const roleFor = (score: number, normalized: string): TypographyRole => {
  if (FILLER_WORDS.has(normalized)) {
    return "filler";
  }
  if (score >= 0.72) {
    return "hero";
  }
  return "support";
};

const lexicalWeightFor = (
  word: Word,
  input: JosephTypographyPlanInput,
): JosephTypographyWordWeight => {
  const normalized = cleanWord(word.text);
  const energy = energyAtMs(input.energyCurve, input.durationMs, word.startMs);
  const confidence = word.confidence ?? 0.85;
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
  if (/[!?]$/.test(word.text)) {
    reasons.push("punctuation_emphasis");
    score += 0.2;
  }
  if (confidence >= 0.96) {
    reasons.push("high_confidence");
    score += 0.08;
  }
  if ((word.emphasis ?? 0) >= 0.7) {
    reasons.push("transcript_emphasis");
    score += 0.22;
  }

  const clampedScore = clamp01(score);
  return {
    text: word.text.replace(/[.!?]$/, ""),
    normalized,
    startFrame: msToFrame(word.startMs),
    endFrame: Math.max(msToFrame(word.endMs), msToFrame(word.startMs) + 1),
    role: roleFor(clampedScore, normalized),
    score: clampedScore,
    reasons: [...new Set(reasons)],
  };
};

export const JOSEPH_TYPOGRAPHY_STYLEBOOKS: readonly JosephTypographyStylebook[] = [
  {
    id: "aggressive_authority",
    label: "Aggressive Authority",
    profileAffinity: ["joseph_aggressive"],
    doctrineAffinity: ["kinetic-pulse", "spotlight-swap"],
    compositionRules: {
      caseStrategy: "hero_upper_support_title",
      lineBreakStrategy: "phrase_stack",
      contrastMode: "hero_crimson_support_white",
      hierarchyScale: 1.34,
      fillerTreatment: "suppress",
      maxWordsPerLine: 3,
    },
  },
  {
    id: "premium_cinematic",
    label: "Premium Cinematic",
    profileAffinity: ["joseph_cinematic"],
    doctrineAffinity: ["restrained-cinematic"],
    compositionRules: {
      caseStrategy: "hero_upper_support_title",
      lineBreakStrategy: "breath_balanced",
      contrastMode: "hero_crimson_support_white",
      hierarchyScale: 1.22,
      fillerTreatment: "suppress",
      maxWordsPerLine: 4,
    },
  },
  {
    id: "sleek_product",
    label: "Sleek Product",
    profileAffinity: ["joseph_aggressive", "joseph_cinematic"],
    doctrineAffinity: ["spotlight-swap"],
    compositionRules: {
      caseStrategy: "title_case",
      lineBreakStrategy: "single_anchor",
      contrastMode: "hero_crimson_support_white",
      hierarchyScale: 1.18,
      fillerTreatment: "dim",
      maxWordsPerLine: 3,
    },
  },
  {
    id: "restrained_editorial",
    label: "Restrained Editorial",
    profileAffinity: ["joseph_minimal", "joseph_cinematic"],
    doctrineAffinity: ["restrained-cinematic"],
    compositionRules: {
      caseStrategy: "sentence_case",
      lineBreakStrategy: "breath_balanced",
      contrastMode: "weight_only",
      hierarchyScale: 1.14,
      fillerTreatment: "suppress",
      maxWordsPerLine: 5,
    },
  },
] as const;

const selectStylebook = (input: JosephTypographyPlanInput): JosephTypographyStylebook => {
  const doctrineMatch = JOSEPH_TYPOGRAPHY_STYLEBOOKS.find(
    (stylebook) =>
      input.doctrineId &&
      stylebook.doctrineAffinity.includes(input.doctrineId) &&
      stylebook.profileAffinity.includes(input.profile),
  );
  if (doctrineMatch) {
    return doctrineMatch;
  }

  return (
    JOSEPH_TYPOGRAPHY_STYLEBOOKS.find((stylebook) => stylebook.profileAffinity.includes(input.profile)) ??
    JOSEPH_TYPOGRAPHY_STYLEBOOKS[0]
  );
};


const FONT_PAIRINGS_BY_STYLEBOOK: Record<JosephTypographyStylebookId, JosephTypographyFontPairing> = {
  aggressive_authority: {
    primary: {fontId: "hero-echelon-regular", family: "Echelon", source: "custom_ingested", role: "hero", fontAssetUrl: "/fonts/hero/echelon-rg-e550ec4e2f9a.otf"},
    secondary: {fontId: "hero-goudy-bookletter", family: "Goudy Bookletter 1911", source: "custom_ingested", role: "support", fontAssetUrl: "/fonts/hero/goudybookletter1911-29a7765f69d5.otf"},
    graphUsed: true,
    pairingScore: 0.91,
    reason: "Resolved aggressive authority hero/support pairing through typography policy.",
  },
  premium_cinematic: {
    primary: {fontId: "hero-berylium-regular", family: "Berylium", source: "custom_ingested", role: "hero", fontAssetUrl: "/fonts/hero/berylium-rg-67d7e31492fa.otf"},
    secondary: {fontId: "hero-goudy-bookletter", family: "Goudy Bookletter 1911", source: "custom_ingested", role: "support", fontAssetUrl: "/fonts/hero/goudybookletter1911-29a7765f69d5.otf"},
    graphUsed: true,
    pairingScore: 0.88,
    reason: "Resolved premium cinematic hero/support pairing through typography policy.",
  },
  sleek_product: {
    primary: {fontId: "hero-cinzel-bold", family: "Cinzel Bold", source: "custom_ingested", role: "hero", fontAssetUrl: "/fonts/hero/cinzel-bold-f33b1b30736a.otf"},
    secondary: {fontId: "hero-berylium-regular", family: "Berylium", source: "custom_ingested", role: "support", fontAssetUrl: "/fonts/hero/berylium-rg-67d7e31492fa.otf"},
    graphUsed: true,
    pairingScore: 0.86,
    reason: "Resolved product hierarchy pairing through typography policy.",
  },
  restrained_editorial: {
    primary: {fontId: "hero-foglihten", family: "Foglihten", source: "custom_ingested", role: "hero", fontAssetUrl: "/fonts/hero/foglihten-068-317fa494dd0b.otf"},
    secondary: {fontId: "hero-goudy-bookletter", family: "Goudy Bookletter 1911", source: "custom_ingested", role: "support", fontAssetUrl: "/fonts/hero/goudybookletter1911-29a7765f69d5.otf"},
    graphUsed: true,
    pairingScore: 0.84,
    reason: "Resolved restrained editorial pairing through typography policy.",
  },
};

const ROLE_STYLES_BY_STYLEBOOK: Record<JosephTypographyStylebookId, JosephTypographyRoleStyle[]> = {
  aggressive_authority: [
    {role: "hero", fontRole: "hero", trackingEm: -0.045, weight: 820, hierarchyLevel: 1, hierarchyScale: 1.36, lineHeight: 0.94},
    {role: "support", fontRole: "support", trackingEm: 0.08, weight: 520, hierarchyLevel: 2, hierarchyScale: 1, lineHeight: 1.08},
    {role: "cta", fontRole: "cta", trackingEm: 0.04, weight: 740, hierarchyLevel: 1, hierarchyScale: 1.24, lineHeight: 0.98},
  ],
  premium_cinematic: [
    {role: "hero", fontRole: "hero", trackingEm: -0.032, weight: 760, hierarchyLevel: 1, hierarchyScale: 1.24, lineHeight: 0.96},
    {role: "support", fontRole: "support", trackingEm: 0.07, weight: 500, hierarchyLevel: 2, hierarchyScale: 1, lineHeight: 1.1},
    {role: "cta", fontRole: "cta", trackingEm: 0.035, weight: 700, hierarchyLevel: 1, hierarchyScale: 1.16, lineHeight: 1},
  ],
  sleek_product: [
    {role: "hero", fontRole: "hero", trackingEm: -0.024, weight: 740, hierarchyLevel: 1, hierarchyScale: 1.2, lineHeight: 0.98},
    {role: "support", fontRole: "support", trackingEm: 0.06, weight: 500, hierarchyLevel: 2, hierarchyScale: 1, lineHeight: 1.08},
    {role: "cta", fontRole: "cta", trackingEm: 0.045, weight: 720, hierarchyLevel: 1, hierarchyScale: 1.12, lineHeight: 1},
  ],
  restrained_editorial: [
    {role: "hero", fontRole: "hero", trackingEm: -0.018, weight: 680, hierarchyLevel: 1, hierarchyScale: 1.16, lineHeight: 1},
    {role: "support", fontRole: "support", trackingEm: 0.045, weight: 480, hierarchyLevel: 2, hierarchyScale: 1, lineHeight: 1.12},
    {role: "cta", fontRole: "cta", trackingEm: 0.03, weight: 660, hierarchyLevel: 1, hierarchyScale: 1.1, lineHeight: 1.02},
  ],
};

const fontPairingFor = (stylebookId: JosephTypographyStylebookId): JosephTypographyFontPairing => FONT_PAIRINGS_BY_STYLEBOOK[stylebookId];
const roleStylesFor = (stylebookId: JosephTypographyStylebookId): JosephTypographyRoleStyle[] => ROLE_STYLES_BY_STYLEBOOK[stylebookId];
const titleCase = (value: string): string =>
  value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

const renderText = (weight: JosephTypographyWordWeight, caseStrategy: JosephTypographyCompositionRules["caseStrategy"]): string => {
  if (caseStrategy === "all_caps" || (caseStrategy === "hero_upper_support_title" && weight.role === "hero")) {
    return weight.text.toUpperCase();
  }
  if (caseStrategy === "sentence_case") {
    return weight.text.toLowerCase();
  }
  return titleCase(weight.text);
};

const caseTreatmentFor = (
  weight: JosephTypographyWordWeight,
  caseStrategy: JosephTypographyCompositionRules["caseStrategy"],
): CaseTreatment => {
  if (caseStrategy === "all_caps" || (caseStrategy === "hero_upper_support_title" && weight.role === "hero")) {
    return "uppercase";
  }
  if (caseStrategy === "title_case" || caseStrategy === "hero_upper_support_title") {
    return "title_case";
  }
  return "sentence_case";
};

const lineColorFor = (
  role: TypographyRole,
  contrastMode: JosephTypographyCompositionRules["contrastMode"],
): string => {
  if (contrastMode === "single_color" || contrastMode === "weight_only") {
    return "#FFFFFF";
  }
  return role === "hero" || role === "cta" ? "#FF0040" : "#FFFFFF";
};

const visibleWeightsFor = (
  weights: readonly JosephTypographyWordWeight[],
  rules: JosephTypographyCompositionRules,
): JosephTypographyWordWeight[] => {
  const visible = weights.filter((weight) => {
    if (weight.role !== "filler") {
      return true;
    }
    return rules.fillerTreatment !== "suppress";
  });
  if (visible.length <= 4) {
    return visible;
  }

  const roleRank: Record<TypographyRole, number> = {cta: 4, hero: 3, support: 2, filler: 1};
  return [...visible]
    .sort((left, right) =>
      roleRank[right.role] - roleRank[left.role] ||
      right.score - left.score ||
      left.startFrame - right.startFrame,
    )
    .slice(0, 4)
    .sort((left, right) => left.startFrame - right.startFrame);
};
const buildLines = (
  weights: readonly JosephTypographyWordWeight[],
  rules: JosephTypographyCompositionRules,
): JosephTypographyLine[] => {
  const visible = visibleWeightsFor(weights, rules);
  const heroes = visible.filter((weight) => weight.role === "hero");
  const support = visible.filter((weight) => weight.role === "support");
  const ordered = [...heroes, ...support];
  const groups: JosephTypographyWordWeight[][] = [];
  let supportBuffer: JosephTypographyWordWeight[] = [];
  const flushSupport = () => {
    for (let index = 0; index < supportBuffer.length; index += rules.maxWordsPerLine) {
      groups.push(supportBuffer.slice(index, index + rules.maxWordsPerLine));
    }
    supportBuffer = [];
  };

  for (const weight of ordered) {
    if (weight.role === "hero" || weight.role === "cta") {
      flushSupport();
      groups.push([weight]);
    } else {
      supportBuffer.push(weight);
    }
  }
  flushSupport();

  return groups.map((group, index) => {
    const primaryRole = group.some((word) => word.role === "hero") ? "hero" : "support";
    const text = group.map((word) => renderText(word, rules.caseStrategy)).join(" ");
    return {
      text,
      role: primaryRole,
      caseTreatment: caseTreatmentFor(group[0] ?? visible[0] ?? weights[0]!, rules.caseStrategy),
      startFrame: Math.min(...group.map((word) => word.startFrame)),
      endFrame: Math.max(...group.map((word) => word.endFrame)),
      maxCharacters: primaryRole === "hero" ? 18 : 26,
      contrastColor: lineColorFor(primaryRole, rules.contrastMode),
      hierarchyLevel: primaryRole === "hero" ? 1 : Math.min(3, index + 2),
    };
  });
};

export const evaluateJosephTypographyQuality = (
  plan: JosephTypographyIntelligencePlan,
): JosephTypographyQuality => {
  const failures = new Set<string>();
  const warnings = new Set<string>();

  const visibleFillerCount = plan.lines.filter((line) =>
    plan.lexicalWeights.some((weight) => weight.role === "filler" && new RegExp(`\\b${weight.normalized}\\b`, "i").test(line.text)),
  ).length;
  const longLineCount = plan.lines.filter((line) => line.text.length > line.maxCharacters).length;
  const heroLines = plan.lines.filter((line) => line.role === "hero");
  const supportLines = plan.lines.filter((line) => line.role === "support");

  if (plan.lines.length > 4 || visibleFillerCount > 0) {
    failures.add("typography_clutter");
  }
  if (plan.compositionRules.caseStrategy === "all_caps" && plan.lexicalWeights.some((weight) => weight.role === "filler")) {
    failures.add("typography_cheap_emphasis");
  }
  if (longLineCount > 0 || plan.compositionRules.maxWordsPerLine > 5) {
    failures.add("typography_broken_line_rhythm");
  }
  if (
    plan.compositionRules.contrastMode === "single_color" ||
    (heroLines.length > 0 && supportLines.length > 0 && plan.compositionRules.hierarchyScale < 1.1)
  ) {
    failures.add("typography_insufficient_contrast");
  }

  if (plan.lexicalWeights.some((weight) => weight.role === "filler") && plan.compositionRules.fillerTreatment === "suppress") {
    warnings.add("filler_suppressed");
  }
  if (heroLines.length === 0) {
    warnings.add("typography_no_hero_line");
  }

  return {
    score: clamp01(1 - failures.size * 0.16 - warnings.size * 0.03),
    failures: [...failures].sort(),
    warnings: [...warnings].sort(),
  };
};

export const buildJosephTypographyIntelligencePlan = (
  input: JosephTypographyPlanInput,
): JosephTypographyIntelligencePlan => {
  const stylebook = selectStylebook(input);
  const lexicalWeights = input.words.map((word) => lexicalWeightFor(word, input));
  const lines = buildLines(lexicalWeights, stylebook.compositionRules);
  const draft: JosephTypographyIntelligencePlan = {
    version: "joseph-typography-v1",
    stylebookId: stylebook.id,
    lexicalWeights,
    compositionRules: stylebook.compositionRules,
    lines,
    fontPairing: fontPairingFor(stylebook.id),
    roleStyles: roleStylesFor(stylebook.id),
    qualityAudit: {score: 1, failures: [], warnings: []},
  };

  return {
    ...draft,
    qualityAudit: evaluateJosephTypographyQuality(draft),
  };
};

export const evaluateManifestTypographyQuality = (
  manifest: {josephTypography?: JosephTypographyIntelligencePlan},
): JosephTypographyQuality => {
  if (!manifest.josephTypography) {
    return {score: 1, failures: [], warnings: []};
  }
  const evaluated = evaluateJosephTypographyQuality(manifest.josephTypography);
  const audit = manifest.josephTypography.qualityAudit;
  return {
    score: Math.min(evaluated.score, audit.score),
    failures: [...new Set([...evaluated.failures, ...audit.failures])].sort(),
    warnings: [...new Set([...evaluated.warnings, ...audit.warnings])].sort(),
  };
};
