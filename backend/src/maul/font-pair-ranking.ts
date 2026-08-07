import {existsSync} from "node:fs";

import type {MaulResolvedFontAsset} from "@prometheus/shared-types";
import {openSync, type Font, type FontCollection} from "fontkit";

export type MaulFontPairCandidate = {
  assetId: string;
  score: number;
  needsManualLicenseReview: boolean;
  renderable?: boolean;
  roleBuckets?: readonly string[];
};

export type MaulFontPairGeometry = {
  hasRequiredGlyphs: boolean;
  averageAdvanceEm: number;
  xHeightRatio: number;
  capHeightRatio: number;
};

export type MaulFontPairScoreBreakdown = {
  roleContrast: number;
  styleContrast: number;
  weightContrast: number;
  widthRhythmCompatibility: number;
  metricCompatibility: number;
  sourceRetrieval: number;
  decorativeClashPenalty: number;
};

export type MaulRankedFontPair = {
  primaryAssetId: string;
  accentAssetId: string;
  total: number;
  breakdown: MaulFontPairScoreBreakdown;
};

export type MaulFontPairRankingResult = {
  pair: {
    primary: MaulResolvedFontAsset;
    accent: MaulResolvedFontAsset;
  };
  score: {
    total: number;
    breakdown: MaulFontPairScoreBreakdown;
  };
  rankedPairs: MaulRankedFontPair[];
  evaluatedPairCount: number;
  catalogCount: number;
  hydratedCount: number;
  status: "full_catalog" | "hydrated_subset";
};

type RankMaulFontPairsInput = {
  candidates: readonly MaulFontPairCandidate[];
  hydratedAssets: readonly MaulResolvedFontAsset[];
  roleBucketsByAssetId?: ReadonlyMap<string, readonly string[]>;
  requiredText?: string;
  catalogCount: number;
  isLocalBinaryAvailable?: (asset: MaulResolvedFontAsset) => boolean;
  measureAsset?: (
    asset: MaulResolvedFontAsset,
    requiredText: string,
  ) => MaulFontPairGeometry;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const isFontCollection = (
  value: Font | FontCollection,
): value is FontCollection => value.type === "TTC" || value.type === "DFont";

const requiredCodePoints = (text: string): number[] => [
  ...new Set(
    [...text]
      .filter((character) => !/\s/u.test(character))
      .map((character) => character.codePointAt(0))
      .filter((value): value is number => value !== undefined),
  ),
];

export const measureMaulFontPairGeometry = (
  asset: MaulResolvedFontAsset,
  requiredText: string,
): MaulFontPairGeometry => {
  const loaded = openSync(asset.localFilePath);
  if (isFontCollection(loaded)) {
    throw new Error(`MAUL font pair ranking requires an explicit face: ${asset.assetId}.`);
  }
  const sample = requiredText.trim() || "Hamburgefontsiv 0123456789";
  const run = loaded.layout(sample);
  const unitsPerEm = Math.max(1, loaded.unitsPerEm);
  const averageAdvanceEm = run.positions.length === 0
    ? 0
    : run.positions.reduce((total, position) => total + position.xAdvance, 0) /
      run.positions.length /
      unitsPerEm;
  return {
    hasRequiredGlyphs: requiredCodePoints(requiredText)
      .every((codePoint) => loaded.hasGlyphForCodePoint(codePoint)),
    averageAdvanceEm,
    xHeightRatio: loaded.xHeight / unitsPerEm,
    capHeightRatio: loaded.capHeight / unitsPerEm,
  };
};

const pairBreakdown = ({
  primary,
  accent,
  primaryCandidate,
  accentCandidate,
  primaryGeometry,
  accentGeometry,
}: {
  primary: MaulResolvedFontAsset;
  accent: MaulResolvedFontAsset;
  primaryCandidate: MaulFontPairCandidate;
  accentCandidate: MaulFontPairCandidate;
  primaryGeometry: MaulFontPairGeometry;
  accentGeometry: MaulFontPairGeometry;
}): MaulFontPairScoreBreakdown => {
  const accentHasSlant = accent.style === "italic" || accent.style === "oblique";
  const sameFamily = primary.family.trim().toLowerCase() === accent.family.trim().toLowerCase();
  const widthDelta = Math.abs(primaryGeometry.averageAdvanceEm - accentGeometry.averageAdvanceEm);
  const xHeightDelta = Math.abs(primaryGeometry.xHeightRatio - accentGeometry.xHeightRatio);
  const capHeightDelta = Math.abs(primaryGeometry.capHeightRatio - accentGeometry.capHeightRatio);
  const bothDecorative =
    primaryCandidate.roleBuckets?.includes("accent_script_or_italic") === true &&
    accentCandidate.roleBuckets?.includes("accent_script_or_italic") === true;
  return {
    roleContrast: 1,
    styleContrast: accentHasSlant ? 1 : 0.65,
    weightContrast: clamp01(Math.abs(primary.weight - accent.weight) / 500),
    widthRhythmCompatibility: clamp01(1 - widthDelta / 0.5),
    metricCompatibility: clamp01(1 - (xHeightDelta + capHeightDelta) / 0.5),
    sourceRetrieval: clamp01((primaryCandidate.score + accentCandidate.score) / 2),
    decorativeClashPenalty: bothDecorative || (sameFamily && !accentHasSlant) ? 1 : 0,
  };
};

const totalScore = (breakdown: MaulFontPairScoreBreakdown): number =>
  breakdown.roleContrast * 0.24 +
  breakdown.styleContrast * 0.18 +
  breakdown.weightContrast * 0.12 +
  breakdown.widthRhythmCompatibility * 0.16 +
  breakdown.metricCompatibility * 0.14 +
  breakdown.sourceRetrieval * 0.16 -
  breakdown.decorativeClashPenalty * 0.25;

export const rankMaulFontPairs = (
  input: RankMaulFontPairsInput,
): MaulFontPairRankingResult => {
  const candidateById = new Map(
    input.candidates.map((candidate) => [candidate.assetId, candidate]),
  );
  const rolesFor = (assetId: string): readonly string[] =>
    input.roleBucketsByAssetId?.get(assetId) ??
    candidateById.get(assetId)?.roleBuckets ??
    [];
  const localBinaryAvailable = input.isLocalBinaryAvailable ??
    ((asset: MaulResolvedFontAsset) => existsSync(asset.localFilePath));
  const measureAsset = input.measureAsset ?? measureMaulFontPairGeometry;
  const requiredText = input.requiredText ?? "";
  const geometryById = new Map<string, MaulFontPairGeometry>();

  const hydrated = input.hydratedAssets.filter((asset) => {
    const candidate = candidateById.get(asset.assetId);
    if (
      !candidate ||
      candidate.needsManualLicenseReview ||
      candidate.renderable === false ||
      rolesFor(asset.assetId).includes("forbidden_or_manual_review") ||
      (asset.license.status !== "cleared" && asset.license.status !== "bundled") ||
      !localBinaryAvailable(asset)
    ) {
      return false;
    }
    try {
      const geometry = measureAsset(asset, requiredText);
      if (!geometry.hasRequiredGlyphs) return false;
      geometryById.set(asset.assetId, geometry);
      return true;
    } catch {
      return false;
    }
  });
  const primaryAssets = hydrated.filter(
    (asset) => !rolesFor(asset.assetId).includes("accent_script_or_italic"),
  );
  const accentAssets = hydrated.filter((asset) =>
    rolesFor(asset.assetId).includes("accent_script_or_italic") ||
    asset.style === "italic" ||
    asset.style === "oblique"
  );
  const ranked = primaryAssets.flatMap((primary) =>
    accentAssets.flatMap((accent): Array<{
      primary: MaulResolvedFontAsset;
      accent: MaulResolvedFontAsset;
      total: number;
      breakdown: MaulFontPairScoreBreakdown;
    }> => {
      if (primary.assetId === accent.assetId) return [];
      const primaryCandidate = candidateById.get(primary.assetId)!;
      const accentCandidate = candidateById.get(accent.assetId)!;
      const breakdown = pairBreakdown({
        primary,
        accent,
        primaryCandidate,
        accentCandidate,
        primaryGeometry: geometryById.get(primary.assetId)!,
        accentGeometry: geometryById.get(accent.assetId)!,
      });
      return [{primary, accent, breakdown, total: totalScore(breakdown)}];
    }),
  ).sort((left, right) =>
    right.total - left.total ||
    left.primary.assetId.localeCompare(right.primary.assetId) ||
    left.accent.assetId.localeCompare(right.accent.assetId) ||
    left.primary.family.localeCompare(right.primary.family) ||
    left.accent.family.localeCompare(right.accent.family)
  );
  const selected = ranked[0];
  if (!selected) {
    throw new Error(
      "MAUL font pair ranking found no license-cleared primary/accent pair with an exact local binary and required glyph coverage.",
    );
  }
  return {
    pair: {primary: selected.primary, accent: selected.accent},
    score: {total: selected.total, breakdown: selected.breakdown},
    rankedPairs: ranked.map((pair) => ({
      primaryAssetId: pair.primary.assetId,
      accentAssetId: pair.accent.assetId,
      total: pair.total,
      breakdown: pair.breakdown,
    })),
    evaluatedPairCount: ranked.length,
    catalogCount: input.catalogCount,
    hydratedCount: hydrated.length,
    status: hydrated.length === input.catalogCount ? "full_catalog" : "hydrated_subset",
  };
};
