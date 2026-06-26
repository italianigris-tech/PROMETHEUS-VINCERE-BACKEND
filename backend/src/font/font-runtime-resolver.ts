import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {seededPick, seededRandom} from "@prometheus/shared-types";
import type {JosephTypography} from "@prometheus/shared-types";
import {basenameAnyPlatform} from "../path-utils";

type JosephProfile = "aggressive" | "cinematic" | "minimal" | "joseph_aggressive" | "joseph_cinematic" | "joseph_minimal";

export type HeroFontRecord = {
  fontId: string;
  family: string;
  cssFamily: string;
  publicUrl: string;
  localFilePath: string;
  profileAffinity: string[];
  roleTags: string[];
  readabilityScore: number;
  expressivenessScore: number;
  licenseStatus: string;
  reviewOnly: boolean;
};

export type HeroFontSelection = JosephTypography & {
  localFilePath: string;
  licenseStatus: string;
  reviewOnly: boolean;
};

export type SelectHeroFontsResult = {
  hero: HeroFontSelection;
  support: HeroFontSelection;
  fallback: HeroFontSelection;
  warnings: string[];
};

export type SelectHeroFontsContext = {
  profile: JosephProfile;
  heroManifestPath?: string;
  libraryManifestPath?: string;
  preferHydratedLibrary?: boolean;
};

type HeroFontManifest = {
  fonts?: HeroFontRecord[];
};

type HydratedLibraryFontRecord = {
  fontId?: string;
  familyName?: string;
  publicUrl?: string;
  localPublicPath?: string;
  format?: string;
  renderable?: boolean;
  needsManualLicenseReview?: boolean;
  license?: {
    licenseTexts?: string[];
  };
  warnings?: string[];
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../..");
const defaultHeroManifestPath = path.join(repoRoot, "remotion-app", "public", "fonts", "hero", "hero-fonts.json");
const defaultLibraryManifestPath = path.join(repoRoot, "remotion-app", "public", "fonts", "library", "font-manifest-urls.json");
const renderableExtensions = new Set([".otf", ".ttf", ".woff", ".woff2"]);

const normalizeProfile = (profile: JosephProfile): "aggressive" | "cinematic" | "minimal" => {
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

const loadHeroFonts = (manifestPath: string): HeroFontRecord[] => {
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as HeroFontManifest;
  return Array.isArray(parsed.fonts) ? parsed.fonts : [];
};

const cssFamilyForLibraryFont = (familyName: string): string => {
  const safe = familyName
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
  return `PrometheusLibrary${safe || "Font"}`;
};

const hasBlockedLicenseSignal = (record: HydratedLibraryFontRecord): boolean => {
  const text = [
    ...(record.license?.licenseTexts ?? []),
    ...(record.warnings ?? []),
    record.familyName ?? "",
    record.fontId ?? "",
  ].join(" ").toLowerCase();
  return /personal\s+use|non[-\s]?commercial|no\s+commercial|free\s+trial|trial|demo/.test(text);
};

const resolveLibraryLocalPath = (localPublicPath: string): string => {
  if (path.isAbsolute(localPublicPath)) {
    return localPublicPath;
  }
  return path.join(repoRoot, "remotion-app", localPublicPath);
};

const resolveManifestLocalFilePath = (filePath: string): string => {
  if (existsSync(filePath)) {
    return filePath;
  }

  const normalized = filePath.replace(/\\/g, "/");
  const publicIndex = normalized.toLowerCase().lastIndexOf("remotion-app/public/");
  if (publicIndex >= 0) {
    const repoRelative = normalized.slice(publicIndex);
    const rebasedPath = path.join(repoRoot, ...repoRelative.split("/"));
    if (existsSync(rebasedPath)) {
      return rebasedPath;
    }
  }

  const heroFilePath = path.join(repoRoot, "remotion-app", "public", "fonts", "hero", basenameAnyPlatform(filePath));
  if (existsSync(heroFilePath)) {
    return heroFilePath;
  }

  return filePath;
};

const libraryRecordToHeroRecord = (record: HydratedLibraryFontRecord): HeroFontRecord | null => {
  const fontId = record.fontId?.trim() ?? "";
  const family = record.familyName?.trim() ?? "";
  const publicUrl = record.publicUrl?.trim() ?? "";
  const localPublicPath = record.localPublicPath?.trim() ?? "";
  const extension = path.extname(publicUrl || localPublicPath).toLowerCase();
  const localFilePath = localPublicPath ? resolveLibraryLocalPath(localPublicPath) : "";

  if (!fontId || !family || !publicUrl || !localFilePath) {
    return null;
  }
  if (record.renderable !== true || record.needsManualLicenseReview || hasBlockedLicenseSignal(record)) {
    return null;
  }
  if (!renderableExtensions.has(extension) || !existsSync(localFilePath)) {
    return null;
  }

  return {
    fontId,
    family,
    cssFamily: cssFamilyForLibraryFont(family),
    publicUrl,
    localFilePath,
    profileAffinity: ["aggressive", "cinematic", "minimal"],
    roleTags: ["hero", "support", "fallback", "hydrated", "display"],
    readabilityScore: 0.82,
    expressivenessScore: 0.82,
    licenseStatus: "render_safe_hydrated_library",
    reviewOnly: false,
  };
};

const loadHydratedLibraryFonts = (manifestPath: string): HeroFontRecord[] => {
  if (!existsSync(manifestPath)) {
    return [];
  }
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map((record) => libraryRecordToHeroRecord(record as HydratedLibraryFontRecord))
    .filter((record): record is HeroFontRecord => record !== null)
    .sort((left, right) => left.family.localeCompare(right.family) || left.fontId.localeCompare(right.fontId));
};

const toTypography = (record: HeroFontRecord): HeroFontSelection => ({
  fontId: record.fontId,
  fontFamily: record.cssFamily,
  fontAssetUrl: record.publicUrl,
  fallbackFamily: "Arial, sans-serif",
  localFilePath: record.localFilePath,
  licenseStatus: record.licenseStatus,
  reviewOnly: record.reviewOnly,
});

const scoreFont = (record: HeroFontRecord, profile: "aggressive" | "cinematic" | "minimal", role: "hero" | "support" | "fallback"): number => {
  const tags = new Set(record.roleTags.map((tag) => tag.toLowerCase()));
  let score = record.readabilityScore * 0.45 + record.expressivenessScore * 0.55;

  if (record.profileAffinity.includes(profile)) {
    score += 1;
  }
  if (tags.has(role)) {
    score += 0.8;
  }
  if (tags.has("hydrated")) {
    score += 0.45;
  }
  if (profile === "aggressive") {
    score += record.expressivenessScore + (tags.has("bold") || tags.has("kinetic") || tags.has("condensed") || tags.has("display") ? 0.6 : 0);
  }
  if (profile === "cinematic") {
    score += record.readabilityScore * 0.45 + (tags.has("editorial") || tags.has("premium") || tags.has("restrained") || tags.has("display") ? 0.7 : 0);
  }
  if (profile === "minimal") {
    score += record.readabilityScore * 1.1 + (tags.has("neutral") || tags.has("clean") || tags.has("readable") ? 0.7 : 0);
  }
  if (record.reviewOnly) {
    score -= 2;
  }

  return score;
};

const pickRanked = (
  records: HeroFontRecord[],
  profile: "aggressive" | "cinematic" | "minimal",
  role: "hero" | "support" | "fallback",
  seed: number,
): HeroFontRecord => {
  const ranked = [...records]
    .map((record) => ({record, score: scoreFont(record, profile, role)}))
    .sort((left, right) => right.score - left.score || left.record.fontId.localeCompare(right.record.fontId));
  const bestScore = ranked[0]?.score;
  const top = ranked
    .filter((entry) => bestScore !== undefined && Math.abs(entry.score - bestScore) < 0.2)
    .map((entry) => entry.record);

  return seededPick(seededRandom(seed), top.length > 0 ? top : ranked.map((entry) => entry.record));
};

export const selectHeroFonts = (
  context: SelectHeroFontsContext,
  seed: number,
): SelectHeroFontsResult => {
  const heroManifestPath = context.heroManifestPath ?? defaultHeroManifestPath;
  const libraryManifestPath = context.libraryManifestPath ?? defaultLibraryManifestPath;
  const heroRecords = loadHeroFonts(heroManifestPath).filter((record) => !record.reviewOnly);
  const hydratedRecords = context.preferHydratedLibrary ? loadHydratedLibraryFonts(libraryManifestPath) : [];
  const records = hydratedRecords.length > 0 ? [...hydratedRecords, ...heroRecords] : heroRecords;
  if (records.length === 0) {
    throw new Error(`FontRuntimeResolver: no render-safe fonts found in ${heroManifestPath} or ${libraryManifestPath}`);
  }

  const profile = normalizeProfile(context.profile);
  const fallbackRecord = [...records]
    .sort((left, right) => right.readabilityScore - left.readabilityScore || left.fontId.localeCompare(right.fontId))[0];
  if (!fallbackRecord) {
    throw new Error(`FontRuntimeResolver: no readable fallback font found in ${heroManifestPath} or ${libraryManifestPath}`);
  }

  const warnings: string[] = [];
  if (context.preferHydratedLibrary && hydratedRecords.length === 0) {
    warnings.push(`Hydrated font library unavailable or empty at ${libraryManifestPath}; using hero MVP fonts.`);
  }

  const ensureRenderable = (record: HeroFontRecord, role: "hero" | "support" | "fallback"): HeroFontRecord => {
    const resolvedLocalFilePath = resolveManifestLocalFilePath(record.localFilePath);
    if (existsSync(resolvedLocalFilePath)) {
      return {...record, localFilePath: resolvedLocalFilePath};
    }

    const fallbackLocalFilePath = resolveManifestLocalFilePath(fallbackRecord.localFilePath);
    warnings.push(`Selected ${role} font ${record.fontId} missing at ${record.localFilePath}; using ${fallbackRecord.fontId}.`);
    return {...fallbackRecord, localFilePath: fallbackLocalFilePath};
  };

  const hero = ensureRenderable(pickRanked(records, profile, "hero", seed), "hero");
  const supportCandidates = records.filter((record) => record.fontId !== hero.fontId);
  const support = ensureRenderable(
    pickRanked(supportCandidates.length > 0 ? supportCandidates : records, profile, "support", seed + 17),
    "support",
  );
  const fallback = ensureRenderable(fallbackRecord, "fallback");

  return {
    hero: toTypography(hero),
    support: toTypography(support),
    fallback: toTypography(fallback),
    warnings,
  };
};
