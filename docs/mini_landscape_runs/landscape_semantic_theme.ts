/**
 * MINI LANDSCAPE RUNS — SEMANTIC VIBE NODE
 *
 * The causal "semantic understanding" instance over the transcript. It reads
 * every section's text + the editorial weights already computed by Stage 2/3
 * and turns them into a vibe vector that drives song selection.
 *
 * It is deterministic by default (a lexical lexicon, so zero token cost and
 * fully reproducible). Callers MAY inject an LLM-produced SemanticTheme (the
 * studio supports an LLM plug-in node) — the node prefers it but still
 * validates and completes it with deterministic defaults.
 */

import type { CausalRef, SectionVibe, SemanticTheme, VibeVector } from "./types.js";

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const round2 = (n: number): number => Math.round(n * 100) / 100;

const v = (
  energy: number,
  momentum: number,
  warmth: number,
  clarity: number,
  conviction: number,
  prestige: number,
): VibeVector => ({ energy, momentum, warmth, clarity, conviction, prestige });

const ROLE_BASE_VIBE: Record<string, VibeVector> = {
  hook: v(0.72, 0.66, 0.4, 0.5, 0.75, 0.6),
  setup: v(0.4, 0.38, 0.55, 0.6, 0.35, 0.5),
  explain: v(0.5, 0.5, 0.45, 0.75, 0.55, 0.6),
  demonstrate: v(0.62, 0.65, 0.4, 0.7, 0.7, 0.7),
  payoff: v(0.85, 0.8, 0.45, 0.55, 0.95, 0.9),
  outro: v(0.45, 0.4, 0.6, 0.6, 0.5, 0.55),
};

const QUESTION_WORDS = ["why", "how", "what", "secret", "really", "because", "explain"];
const CONVICTION_WORDS = ["must", "need", "should", "convinc", "prove", "critical", "vital", "essential", "believe", "win", "achieve", "transform", "break"];
const BUSINESS_WORDS = ["revenue", "profit", "margin", "company", "business", "market", "client", "customer", "growth", "scale", "enterprise", "roi", "sales", "roas"];
const CLARITY_WORDS = ["clear", "clarity", "understand", "framework", "system", "steps", "logic", "why", "structure", "method", "exact", "concept"];
const WARMTH_WORDS = ["people", "team", "story", "help", "care", "human", "together", "you", "share"];
const PRESTIGE_WORDS = ["premium", "luxur", "high", "enterprise", "executive", "cinematic", "world-class", "elite"];
const ENERGY_WORDS = ["explode", "grow", "speed", "fast", "intense", "deadline", "launch", "unlock", "get", "now"];
const CALM_WORDS = ["calm", "steady", "breathe", "slow", "reflection", "contemplation", "quiet"];

const RHYTHM = /[^a-z']/gi;

const words = (text?: string): string[] =>
  (text ?? "").toLowerCase().replace(RHYTHM, " ").split(/\s+/).filter(Boolean);

const touches = (tokens: string[], set: string[]): boolean =>
  tokens.some((t) => set.some((s) => t.startsWith(s) || s.startsWith(t.slice(0, 4))));

export interface ResolveSemanticThemeInput {
  sections: Array<{
    sectionId: string;
    role: string;
    text?: string;
    semanticWeight?: number;
    commercialPressure?: number;
    fatigueRisk?: number;
  }>;
  /** Optional LLM-derived theme. */
  llmTheme?: SemanticTheme | null;
}
export function resolveSemanticTheme(input: ResolveSemanticThemeInput): SemanticTheme {
  const { sections, llmTheme } = input;

  // Prefer the injected LLM theme when it fully covers the section set
  // (deterministic validation pass keeps it trustworthy).
  if (llmTheme && llmTheme.perSection.length === sections.length) {
    return {
      ...llmTheme,
      source: llmTheme.source === "llm" ? "llm" : "hybrid",
      cause: llmTheme.source === "llm"
        ? { gate: "semantic_vibe", reason: "LLM semantic node supplied the full per-section vibe." }
        : { gate: "semantic_vibe", reason: "Hybrid semantic node (injected + deterministic defaults)." },
    };
  }

  const perSection: SectionVibe[] = sections.map((sec) => {
    const tokens = words(sec.text ?? "");
    const base = ROLE_BASE_VIBE[sec.role] ?? v(0.5, 0.5, 0.5, 0.5, 0.5, 0.5);
    const sw = sec.semanticWeight ?? 0.5;
    const cp = sec.commercialPressure ?? 0.5;
    const fr = sec.fatigueRisk ?? 0.5;
    const labels: string[] = [];
    if (touches(tokens, QUESTION_WORDS)) labels.push("question");
    if (touches(tokens, CONVICTION_WORDS)) labels.push("conviction");
    if (touches(tokens, BUSINESS_WORDS)) labels.push("business");
    if (touches(tokens, CLARITY_WORDS)) labels.push("clarity");
    if (touches(tokens, WARMTH_WORDS)) labels.push("warmth");
    if (touches(tokens, PRESTIGE_WORDS)) labels.push("prestige");
    if (touches(tokens, ENERGY_WORDS)) labels.push("driving");
    if (touches(tokens, CALM_WORDS)) labels.push("calm");

    let energy = base.energy;
    if (touches(tokens, ENERGY_WORDS)) energy += 0.12;
    if (touches(tokens, CALM_WORDS)) energy -= 0.15;
    energy = clamp01(energy);

    const conviction = clamp01(
      base.conviction +
        (touches(tokens, CONVICTION_WORDS) ? 0.18 : 0) +
        (cp > 0.55 ? 0.08 : 0),
    );
    const clarity = clamp01(base.clarity + (touches(tokens, CLARITY_WORDS) ? 0.2 : 0));
    const warmth = clamp01(
      base.warmth + (touches(tokens, WARMTH_WORDS) ? 0.15 : 0) - (touches(tokens, BUSINESS_WORDS) ? 0.05 : 0),
    );
    const prestige = clamp01(
      base.prestige + (touches(tokens, PRESTIGE_WORDS) ? 0.2 : 0) + (cp > 0.55 ? 0.1 : 0),
    );
    const momentum = clamp01(base.momentum + (energy - base.energy) * 0.9 + sw * 0.1 - fr * 0.1);

    return Object.assign(
      {
        sectionId: sec.sectionId,
        role: sec.role,
        themeLabels: labels.length ? labels : [sec.role],
        semanticKeywords: tokens.slice(0, 4),
      },
      {
        energy: round2(energy),
        momentum: round2(momentum),
        warmth: round2(warmth),
        clarity: round2(clarity),
        conviction: round2(conviction),
        prestige: round2(prestige),
      },
    );
  });

  // Aggregate per-section vibes into a video-level theme.
  const sum = { energy: 0, momentum: 0, warmth: 0, clarity: 0, conviction: 0, prestige: 0 };
  for (const s of perSection) {
    sum.energy += s.energy;
    sum.momentum += s.momentum;
    sum.warmth += s.warmth;
    sum.clarity += s.clarity;
    sum.conviction += s.conviction;
    sum.prestige += s.prestige;
  }
  const n = Math.max(1, perSection.length);
  const video: VibeVector = {
    energy: round2(sum.energy / n),
    momentum: round2(sum.momentum / n),
    warmth: round2(sum.warmth / n),
    clarity: round2(sum.clarity / n),
    conviction: round2(sum.conviction / n),
    prestige: round2(sum.prestige / n),
  };

  const counts = new Map<string, number>();
  for (const s of perSection) {
    for (const label of s.themeLabels) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const values = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label]) => label);
  const dominantTheme = values[0] ?? "documentary";

  const cause: CausalRef = {
    gate: "semantic_vibe",
    reason: `Semantic node analysed ${perSection.length} section transcripts; dominant theme ${dominantTheme}.`,
  };
  return { dominantTheme, values, video, perSection, source: "deterministic", cause };
}