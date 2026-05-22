import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

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

type ResolvedFontCandidate = {
  family: string;
  filePath: string;
  browserUrl: string;
  readabilityScore: number;
  expressivenessScore: number;
  roles: string[];
};

type ResolvedFontPair = {
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
  return normalized === ".ttf" || normalized === ".otf";
};

const toBrowserFontUrl = (_filePath: string): string => "";

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

const resolveRequestedFont = (family: string): ResolvedFontCandidate | null => {
  const requested = normalizeFontName(family);
  const exact = loadFontCandidates().find((candidate) => normalizeFontName(candidate.family) === requested);
  if (exact) {
    return exact;
  }

  const partial = loadFontCandidates().find((candidate) => normalizeFontName(candidate.family).includes(requested));
  return partial ?? null;
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

