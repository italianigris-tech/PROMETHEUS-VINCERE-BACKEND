export const REFERENCE_TYPOGRAPHY_GRAMMAR_IDS = [
  "stacked_support_hero",
  "inline_italic_hinge",
  "inline_mixed_word_splice",
  "script_over_foundation",
  "annotated_keyword",
  "quiet_luxury",
  "poster_stack",
] as const;

export type ReferenceTypographyGrammarId =
  (typeof REFERENCE_TYPOGRAPHY_GRAMMAR_IDS)[number];

export type ReferenceTypographyCaseMode =
  | "source_preserving"
  | "display_allowed";

export type ReferenceTypographyAnnotation =
  | "underline"
  | "circle"
  | "highlight"
  | "strike_through"
  | "arrow";

export type ReferenceTypographyGrammar = {
  id: ReferenceTypographyGrammarId;
  foundationRole: "serif" | "sans" | "condensed" | "display";
  accentRole:
    | "none"
    | "italic_hinge"
    | "mixed_word"
    | "script_overlay"
    | "annotation";
  caseMode: ReferenceTypographyCaseMode;
  placementPattern:
    | "support_above_hero"
    | "inline_baseline_hinge"
    | "inline_span_splice"
    | "shared_center_overlap"
    | "attached_keyword_mark"
    | "centered_whitespace"
    | "dense_poster_stack";
  traits: readonly string[];
  wordCountRange: readonly [number, number];
  annotationLimit: number;
  emphasisLevels: readonly ("support" | "key" | "hero")[];
};

export type ReferenceTypographyObservation = {
  filename: string;
  sha256: string;
  grammarId: ReferenceTypographyGrammarId;
  foundationRole: ReferenceTypographyGrammar["foundationRole"];
  accentRole: ReferenceTypographyGrammar["accentRole"];
  caseMode: ReferenceTypographyCaseMode;
  placementPattern: ReferenceTypographyGrammar["placementPattern"];
  traits: readonly string[];
  annotation?: ReferenceTypographyAnnotation;
};

export type ReferenceTypographyPolicyInput = {
  tokenCount: number;
  emphasisLevel: "support" | "key" | "hero";
  traits: readonly string[];
  seed: string;
};

export const REFERENCE_TYPOGRAPHY_GRAMMARS: Record<
  ReferenceTypographyGrammarId,
  ReferenceTypographyGrammar
> = {
  stacked_support_hero: {
    id: "stacked_support_hero",
    foundationRole: "serif",
    accentRole: "italic_hinge",
    caseMode: "source_preserving",
    placementPattern: "support_above_hero",
    traits: ["support_over_hero", "tight_stack", "mixed_scale"],
    wordCountRange: [2, 5],
    annotationLimit: 1,
    emphasisLevels: ["key", "hero"],
  },
  inline_italic_hinge: {
    id: "inline_italic_hinge",
    foundationRole: "sans",
    accentRole: "italic_hinge",
    caseMode: "source_preserving",
    placementPattern: "inline_baseline_hinge",
    traits: ["editorial_italic_hinge", "inline_contrast", "tight_baseline"],
    wordCountRange: [2, 7],
    annotationLimit: 1,
    emphasisLevels: ["key", "hero"],
  },
  inline_mixed_word_splice: {
    id: "inline_mixed_word_splice",
    foundationRole: "display",
    accentRole: "mixed_word",
    caseMode: "source_preserving",
    placementPattern: "inline_span_splice",
    traits: ["mixed_word_splice", "editorial_italic_hinge", "inline_contrast"],
    wordCountRange: [1, 4],
    annotationLimit: 1,
    emphasisLevels: ["key", "hero"],
  },
  script_over_foundation: {
    id: "script_over_foundation",
    foundationRole: "serif",
    accentRole: "script_overlay",
    caseMode: "source_preserving",
    placementPattern: "shared_center_overlap",
    traits: ["script_overlay", "foundation_accent_overlap", "shared_anchor"],
    wordCountRange: [1, 4],
    annotationLimit: 1,
    emphasisLevels: ["key", "hero"],
  },
  annotated_keyword: {
    id: "annotated_keyword",
    foundationRole: "serif",
    accentRole: "annotation",
    caseMode: "source_preserving",
    placementPattern: "attached_keyword_mark",
    traits: ["semantic_annotation", "keyword_emphasis", "attached_mark"],
    wordCountRange: [2, 8],
    annotationLimit: 1,
    emphasisLevels: ["key", "hero"],
  },
  quiet_luxury: {
    id: "quiet_luxury",
    foundationRole: "serif",
    accentRole: "none",
    caseMode: "source_preserving",
    placementPattern: "centered_whitespace",
    traits: ["quiet_whitespace", "restrained_contrast", "sentence_case"],
    wordCountRange: [1, 6],
    annotationLimit: 0,
    emphasisLevels: ["support", "key"],
  },
  poster_stack: {
    id: "poster_stack",
    foundationRole: "display",
    accentRole: "annotation",
    caseMode: "display_allowed",
    placementPattern: "dense_poster_stack",
    traits: ["poster_stack", "stacked_density", "semantic_annotation"],
    wordCountRange: [3, 12],
    annotationLimit: 3,
    emphasisLevels: ["key", "hero"],
  },
};

const normalizeTrait = (trait: string): string =>
  trait.trim().toLowerCase().replace(/[\s-]+/g, "_");

const seededIndex = (seed: string, length: number): number => {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
};

const grammarScore = (
  grammar: ReferenceTypographyGrammar,
  input: ReferenceTypographyPolicyInput,
): number => {
  const inputTraits = new Set(input.traits.map(normalizeTrait));
  const exactTraitMatches = grammar.traits.reduce(
    (score, trait) => score + (inputTraits.has(normalizeTrait(trait)) ? 1 : 0),
    0,
  );
  const [minimumWords, maximumWords] = grammar.wordCountRange;
  const wordFit =
    input.tokenCount < minimumWords
      ? -(minimumWords - input.tokenCount)
      : input.tokenCount > maximumWords
        ? -(input.tokenCount - maximumWords)
        : 0;
  const emphasisFit = grammar.emphasisLevels.includes(input.emphasisLevel) ? 1 : -1;
  return exactTraitMatches * 100 + wordFit * 10 + emphasisFit;
};

export const selectReferenceTypographyGrammar = (
  input: ReferenceTypographyPolicyInput,
): ReferenceTypographyGrammar => {
  const grammars = REFERENCE_TYPOGRAPHY_GRAMMAR_IDS.map(
    (id) => REFERENCE_TYPOGRAPHY_GRAMMARS[id],
  );
  const ranked = grammars
    .map((grammar) => ({grammar, score: grammarScore(grammar, input)}))
    .sort((left, right) => right.score - left.score || left.grammar.id.localeCompare(right.grammar.id));
  const topScore = ranked[0]?.score ?? 0;
  const top = ranked.filter((candidate) => candidate.score === topScore);
  return top[seededIndex(input.seed, top.length)]!.grammar;
};

export const validateReferenceTypographyTreatment = (input: {
  grammarId: string;
  foundationRole: string;
  annotations: readonly ReferenceTypographyAnnotation[];
}): void => {
  const grammar = REFERENCE_TYPOGRAPHY_GRAMMARS[input.grammarId as ReferenceTypographyGrammarId];
  if (!grammar) {
    throw new Error(`Unknown MAUL reference typography grammar: ${input.grammarId}`);
  }
  if (!input.foundationRole.trim()) {
    throw new Error("MAUL reference typography treatment requires a foundation role.");
  }
  if (input.annotations.length > grammar.annotationLimit) {
    throw new Error(
      `MAUL reference typography treatment permits at most ${grammar.annotationLimit === 1 ? "one annotation" : `${grammar.annotationLimit} annotations`} for ${grammar.id}.`,
    );
  }
};
