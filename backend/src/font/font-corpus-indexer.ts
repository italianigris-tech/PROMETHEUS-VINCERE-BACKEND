import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

export type FontProfile = "aggressive" | "cinematic" | "minimal";
export type FontLicenseStatus = "render_safe" | "review_only" | "blocked";

export type FontCorpusEntry = {
  fontId: string;
  family: string;
  role: string;
  readabilityScore: number;
  expressivenessScore: number;
  extractedPath: string;
  licenseStatus: FontLicenseStatus;
  supportedRoles: string[];
};

export type FontCorpusQuery = {
  profile?: FontProfile | "joseph_aggressive" | "joseph_cinematic" | "joseph_minimal";
  role?: string;
  limit?: number;
};

export type FontCorpusIndex = {
  entries: FontCorpusEntry[];
  query: (query?: FontCorpusQuery) => FontCorpusEntry[];
  byId: (fontId: string) => FontCorpusEntry | null;
};

type RawFontManifestEntry = {
  fontId?: string;
  needsManualLicenseReview?: boolean;
  observed?: {
    familyName?: string;
    fullName?: string;
    postscriptName?: string;
    extractedAbsolutePath?: string;
    extension?: string;
    licenseTexts?: string[];
  };
  inferred?: {
    primaryRole?: string;
    roles?: string[];
    readabilityScore?: number;
    expressivenessScore?: number;
  };
};

const renderableExtensions = new Set([".otf", ".ttf", ".woff", ".woff2"]);

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../..");
const defaultManifestPath = path.join(repoRoot, "font-intelligence", "outputs", "font-manifest.json");

const normalizeProfile = (profile?: FontCorpusQuery["profile"]): FontProfile | null => {
  if (!profile) {
    return null;
  }
  if (profile === "joseph_aggressive") {
    return "aggressive";
  }
  if (profile === "joseph_cinematic") {
    return "cinematic";
  }
  if (profile === "joseph_minimal") {
    return "minimal";
  }
  return profile;
};

export const inferFontLicenseStatus = (entry: RawFontManifestEntry): FontLicenseStatus => {
  const text = (entry.observed?.licenseTexts ?? []).join(" ").toLowerCase();
  if (/(personal use only|non commercial|no commercial use|trial|demo|free trial)/i.test(text)) {
    return "blocked";
  }
  if (/(sil open font license|open font license|\\bofl\\b|cc0|creative commons zero|public domain|free for commercial|personal and commercial use)/i.test(text)) {
    return "render_safe";
  }
  return entry.needsManualLicenseReview ? "review_only" : "review_only";
};

const toEntry = (raw: RawFontManifestEntry): FontCorpusEntry | null => {
  const fontId = raw.fontId?.trim() ?? "";
  const observed = raw.observed ?? {};
  const inferred = raw.inferred ?? {};
  const extractedPath = observed.extractedAbsolutePath?.trim() ?? "";
  const family = observed.familyName?.trim()
    || observed.fullName?.trim()
    || observed.postscriptName?.trim()
    || "";
  const extension = (observed.extension ?? path.extname(extractedPath)).toLowerCase();
  const licenseStatus = inferFontLicenseStatus(raw);

  if (!fontId || !family || !extractedPath || !renderableExtensions.has(extension) || licenseStatus !== "render_safe") {
    return null;
  }
  if (!existsSync(extractedPath)) {
    return null;
  }

  return {
    fontId,
    family,
    role: inferred.primaryRole?.trim() || "body",
    readabilityScore: Number(inferred.readabilityScore ?? 0),
    expressivenessScore: Number(inferred.expressivenessScore ?? 0),
    extractedPath,
    licenseStatus,
    supportedRoles: Array.isArray(inferred.roles)
      ? inferred.roles.filter((role): role is string => typeof role === "string" && role.trim().length > 0)
      : [],
  };
};

const scoreForQuery = (entry: FontCorpusEntry, query: FontCorpusQuery): number => {
  const profile = normalizeProfile(query.profile);
  const role = query.role?.trim().toLowerCase();
  const roles = new Set([entry.role, ...entry.supportedRoles].map((value) => value.toLowerCase()));
  let score = entry.readabilityScore * 0.55 + entry.expressivenessScore * 0.45;

  if (role && roles.has(role)) {
    score += 0.75;
  }
  if (profile === "aggressive") {
    score += entry.expressivenessScore * 0.8;
  }
  if (profile === "cinematic") {
    score += roles.has("hero") || roles.has("support") ? 0.35 : 0;
    score += entry.readabilityScore * 0.35 + entry.expressivenessScore * 0.25;
  }
  if (profile === "minimal") {
    score += entry.readabilityScore * 0.9 - entry.expressivenessScore * 0.15;
  }

  return score;
};

export const buildFontCorpusIndex = ({
  manifestPath = defaultManifestPath,
}: {
  manifestPath?: string;
} = {}): FontCorpusIndex => {
  if (!existsSync(manifestPath)) {
    return {
      entries: [],
      query: () => [],
      byId: () => null,
    };
  }

  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
  const rawEntries = Array.isArray(parsed) ? parsed as RawFontManifestEntry[] : [];
  const entries = rawEntries
    .map(toEntry)
    .filter((entry): entry is FontCorpusEntry => entry !== null)
    .sort((left, right) => left.family.localeCompare(right.family) || left.fontId.localeCompare(right.fontId));

  return {
    entries,
    query: (query: FontCorpusQuery = {}) => [...entries]
      .filter((entry) => {
        const role = query.role?.trim().toLowerCase();
        return !role || entry.role.toLowerCase() === role || entry.supportedRoles.some((candidate) => candidate.toLowerCase() === role);
      })
      .map((entry) => ({entry, score: scoreForQuery(entry, query)}))
      .sort((left, right) => right.score - left.score || left.entry.family.localeCompare(right.entry.family))
      .slice(0, Math.max(1, query.limit ?? entries.length))
      .map(({entry}) => entry),
    byId: (fontId: string) => entries.find((entry) => entry.fontId === fontId) ?? null,
  };
};
