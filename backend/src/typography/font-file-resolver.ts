import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {FONT_SERVE_PATH} from "../config/font-assets";
import {basenameAnyPlatform} from "../path-utils";

type FontManifestEntry = {
  observed?: {
    familyName?: string;
    fullName?: string;
    postscriptName?: string;
    extractedAbsolutePath?: string;
    extension?: string;
  };
  inferred?: {
    roles?: string[];
    readabilityScore?: number;
    expressivenessScore?: number;
  };
};

export type ResolvedFontCandidate = {
  family: string;
  filePath: string;
  browserUrl: string;
  readabilityScore: number;
  expressivenessScore: number;
  roles: string[];
};

export type ResolvedFontPair = {
  primary: ResolvedFontCandidate;
  secondary?: ResolvedFontCandidate;
  reason: string;
  fallbackReasons: string[];
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootDir = path.resolve(currentDir, "../../..");
const fontManifestPath = path.join(repoRootDir, "font-intelligence", "outputs", "font-manifest.json");

let cachedCandidates: ResolvedFontCandidate[] | null = null;

const normalizeFontName = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

const isRenderableFontExtension = (extension: string | undefined): boolean => {
  const normalized = (extension ?? "").toLowerCase();
  return normalized === ".otf" || normalized === ".ttf" || normalized === ".woff" || normalized === ".woff2";
};

const toBrowserFontUrl = (filePath: string): string => {
  const fileName = basenameAnyPlatform(filePath);
  return `${FONT_SERVE_PATH}/${fileName}`;
};

const loadFontCandidates = (): ResolvedFontCandidate[] => {
  if (cachedCandidates) {
    return cachedCandidates;
  }

  if (!existsSync(fontManifestPath)) {
    cachedCandidates = [];
    return cachedCandidates;
  }

  const parsed = JSON.parse(readFileSync(fontManifestPath, "utf8")) as unknown;
  const entries = Array.isArray(parsed) ? parsed as FontManifestEntry[] : [];

  cachedCandidates = entries.flatMap((entry) => {
    const observed = entry.observed ?? {};
    const filePath = observed.extractedAbsolutePath?.trim() ?? "";
    const family =
      observed.familyName?.trim() ||
      observed.fullName?.trim() ||
      observed.postscriptName?.trim() ||
      "";
    if (!family || !filePath || !existsSync(filePath) || !isRenderableFontExtension(observed.extension)) {
      return [];
    }

    return [{
      family,
      filePath,
      browserUrl: toBrowserFontUrl(filePath),
      readabilityScore: Number(entry.inferred?.readabilityScore ?? 0),
      expressivenessScore: Number(entry.inferred?.expressivenessScore ?? 0),
      roles: Array.isArray(entry.inferred?.roles)
        ? entry.inferred?.roles.filter((role): role is string => typeof role === "string")
        : []
    }];
  });

  return cachedCandidates;
};

const tokenizeVibeDescriptor = (value: string): string[] => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
};

const vibeSignalWeights: Record<string, number> = {
  luxury: 3,
  premium: 3,
  cinematic: 2,
  editorial: 2,
  authority: 2,
  calm: 1.5,
  clean: 1.25,
  minimal: 1.25,
  refined: 1.5,
  expressive: 1.75,
  bold: 1.25,
  headline: 1,
  support: 0.75,
  serif: 1.5,
  sans: 1.25,
  display: 1.5
};

const scoreFontForVibe = (candidate: ResolvedFontCandidate, tokens: string[]): number => {
  const family = normalizeFontName(candidate.family);
  const roles = candidate.roles.map((role) => normalizeFontName(role));

  const signalScore = tokens.reduce((score, token) => {
    const weight = vibeSignalWeights[token] ?? 0.25;
    const matchesFamily = family.includes(token);
    const matchesRole = roles.some((role) => role.includes(token));
    return score + (matchesFamily ? weight * 2 : 0) + (matchesRole ? weight : 0);
  }, 0);

  return (candidate.readabilityScore * 0.55) + (candidate.expressivenessScore * 0.45) + signalScore;
};

const resolveRequestedFont = (family: string): ResolvedFontCandidate | null => {
  const requested = normalizeFontName(family);
  const exact = loadFontCandidates().find((candidate) => normalizeFontName(candidate.family) === requested);
  if (exact) {
    return exact;
  }

  const partial = loadFontCandidates().find((candidate) => normalizeFontName(candidate.family).includes(requested));
  return partial ?? null;
};

export const resolveLocalFontPairByVibe = (
  vibeDescriptor: string,
  limit = 2
): ResolvedFontPair | null => {
  const candidates = loadFontCandidates();
  if (candidates.length === 0) {
    return null;
  }

  const tokens = tokenizeVibeDescriptor(vibeDescriptor);
  const ranked = [...candidates]
    .map((candidate) => ({
      candidate,
      score: scoreFontForVibe(candidate, tokens)
    }))
    .sort((left, right) => right.score - left.score || right.candidate.readabilityScore - left.candidate.readabilityScore);

  const primary = ranked[0]?.candidate ?? null;
  if (!primary) {
    return null;
  }

  const secondary = ranked.slice(1).find((entry) => normalizeFontName(entry.candidate.family) !== normalizeFontName(primary.family))?.candidate;

  return {
    primary,
    secondary: limit > 1 ? secondary : undefined,
    reason: tokens.length > 0
      ? "Resolved preview typography from the local ingested catalog using vibe signals."
      : "Resolved preview typography from the local ingested catalog using catalog ranking.",
    fallbackReasons: tokens.length > 0
      ? [`Zilliz-backed resolution failed, so local font ranking used vibe tokens: ${tokens.join(", ")}.`]
      : ["Zilliz-backed resolution failed, so local font ranking used catalog scores."]
  };
};

const pickReadableFallbackFont = (excludedFamilies: string[] = []): ResolvedFontCandidate | null => {
  const excluded = new Set(excludedFamilies.map(normalizeFontName));
  const ranked = [...loadFontCandidates()]
    .filter((candidate) => !excluded.has(normalizeFontName(candidate.family)))
    .sort((left, right) => right.readabilityScore - left.readabilityScore || right.expressivenessScore - left.expressivenessScore);
  return ranked[0] ?? null;
};

const pickExpressiveFallbackFont = (excludedFamilies: string[] = []): ResolvedFontCandidate | null => {
  const excluded = new Set(excludedFamilies.map(normalizeFontName));
  const ranked = [...loadFontCandidates()]
    .filter((candidate) => !excluded.has(normalizeFontName(candidate.family)))
    .sort((left, right) => right.expressivenessScore - left.expressivenessScore || right.readabilityScore - left.readabilityScore);
  return ranked[0] ?? null;
};

export const resolveRequestedOrFallbackFontPair = (
  requestedPrimaryFamily: string,
  requestedSecondaryFamily?: string
): ResolvedFontPair | null => {
  const fallbackReasons: string[] = [];
  const primary = resolveRequestedFont(requestedPrimaryFamily) ?? pickReadableFallbackFont();
  if (!primary) {
    return null;
  }
  if (normalizeFontName(primary.family) !== normalizeFontName(requestedPrimaryFamily)) {
    fallbackReasons.push(`Requested primary font "${requestedPrimaryFamily}" was not found in the ingested catalog.`);
  }

  let secondary: ResolvedFontCandidate | undefined;
  if (requestedSecondaryFamily) {
    secondary = resolveRequestedFont(requestedSecondaryFamily) ?? pickExpressiveFallbackFont([primary.family]) ?? undefined;
    if (secondary && normalizeFontName(secondary.family) !== normalizeFontName(requestedSecondaryFamily)) {
      fallbackReasons.push(`Requested secondary font "${requestedSecondaryFamily}" was not found in the ingested catalog.`);
    }
  } else {
    secondary = pickExpressiveFallbackFont([primary.family]) ?? undefined;
  }

  return {
    primary,
    secondary,
    reason: fallbackReasons.length === 0
      ? "Resolved both requested typography families from the ingested font catalog."
      : "Resolved preview typography through the ingested font catalog with explicit family fallback.",
    fallbackReasons
  };
};
