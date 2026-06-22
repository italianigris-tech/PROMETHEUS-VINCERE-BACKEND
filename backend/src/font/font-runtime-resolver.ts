import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {seededPick, seededRandom} from "@prometheus/shared-types";
import type {JosephTypography} from "@prometheus/shared-types";

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
};

type HeroFontManifest = {
  fonts?: HeroFontRecord[];
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../..");
const defaultHeroManifestPath = path.join(repoRoot, "remotion-app", "public", "fonts", "hero", "hero-fonts.json");

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
  if (profile === "aggressive") {
    score += record.expressivenessScore + (tags.has("bold") || tags.has("kinetic") || tags.has("condensed") ? 0.6 : 0);
  }
  if (profile === "cinematic") {
    score += record.readabilityScore * 0.45 + (tags.has("editorial") || tags.has("premium") || tags.has("restrained") ? 0.7 : 0);
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
  const manifestPath = context.heroManifestPath ?? defaultHeroManifestPath;
  const records = loadHeroFonts(manifestPath).filter((record) => !record.reviewOnly);
  if (records.length === 0) {
    throw new Error(`FontRuntimeResolver: no render-safe hero fonts found in ${manifestPath}`);
  }

  const profile = normalizeProfile(context.profile);
  const fallbackRecord = [...records]
    .sort((left, right) => right.readabilityScore - left.readabilityScore || left.fontId.localeCompare(right.fontId))[0];
  if (!fallbackRecord) {
    throw new Error(`FontRuntimeResolver: no readable fallback font found in ${manifestPath}`);
  }

  const warnings: string[] = [];
  const ensureRenderable = (record: HeroFontRecord, role: "hero" | "support" | "fallback"): HeroFontRecord => {
    if (existsSync(record.localFilePath)) {
      return record;
    }
    warnings.push(`Selected ${role} font ${record.fontId} missing at ${record.localFilePath}; using ${fallbackRecord.fontId}.`);
    return fallbackRecord;
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
