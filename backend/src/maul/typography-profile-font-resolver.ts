import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {
  maulTypographyLayerBindingSchema,
  type MaulResolvedFontAsset,
  type MaulTypographyLayerBinding,
} from "@prometheus/shared-types";

import type {TypographyProfileLayer} from "./typography-profile-corpus.js";
import {loadExecutableMaulFontAssets} from "./maul-font-catalog.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultGraphPath = path.resolve(
  currentDir,
  "../../../font-intelligence/outputs/font-compatibility-graph.json",
);

type RawGraphNode = {
  id?: string;
  family?: string;
  style?: string;
  roles?: string[];
  primary_role?: string;
  personality?: string[];
  metadata?: {
    observed?: {
      weightClass?: number;
      italic?: boolean;
      familyName?: string;
      subfamilyName?: string;
    };
    inferred?: {
      classifications?: string[];
      readabilityScore?: number;
      expressivenessScore?: number;
      roles?: string[];
      personality?: string[];
    };
    descriptor?: string;
  };
};

export type TypographyFontIntelligenceEntry = {
  fontId: string;
  family: string;
  style: "normal" | "italic" | "oblique";
  weight: number;
  roles: readonly string[];
  classifications: readonly string[];
  personality: readonly string[];
  readabilityScore: number;
  expressivenessScore: number;
  descriptor: string;
};

let cachedCatalog: readonly TypographyFontIntelligenceEntry[] | null = null;

export const loadExecutableTypographyFontAssets =
  loadExecutableMaulFontAssets;

const normalizeTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);

const styleTokens = new Set([
  "italic",
  "oblique",
  "regular",
  "medium",
  "semibold",
  "demibold",
  "bold",
  "extrabold",
  "black",
  "light",
  "thin",
]);

const normalizedFamily = (value: string): string =>
  normalizeTokens(value)
    .filter((token) => !styleTokens.has(token))
    .join("");

const normalizedStyle = (...values: Array<string | boolean | undefined>) => {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (text.includes("oblique")) return "oblique" as const;
  if (text.includes("italic")) return "italic" as const;
  return "normal" as const;
};

const finiteScore = (value: number | undefined): number =>
  Number.isFinite(value) ? value! : 0;

export const loadTypographyFontIntelligenceCatalog = ({
  graphPath = defaultGraphPath,
}: {
  graphPath?: string;
} = {}): readonly TypographyFontIntelligenceEntry[] => {
  if (graphPath === defaultGraphPath && cachedCatalog) return cachedCatalog;
  if (!existsSync(graphPath)) {
    throw new Error(`MAUL font intelligence graph is unavailable: ${graphPath}`);
  }
  const parsed = JSON.parse(readFileSync(graphPath, "utf8")) as {
    nodes?: RawGraphNode[];
  };
  if (!Array.isArray(parsed.nodes)) {
    throw new Error(`MAUL font intelligence graph must contain nodes: ${graphPath}`);
  }
  const catalog = parsed.nodes.map((node, index) => {
    const fontId = node.id?.trim() ?? "";
    const family =
      node.family?.trim() || node.metadata?.observed?.familyName?.trim() || "";
    if (!fontId || !family) {
      throw new Error(`MAUL font intelligence node ${index} lacks identity.`);
    }
    const inferred = node.metadata?.inferred;
    return {
      fontId,
      family,
      style: normalizedStyle(
        node.style,
        node.metadata?.observed?.subfamilyName,
        node.metadata?.observed?.italic,
      ),
      weight:
        Number.isFinite(node.metadata?.observed?.weightClass) &&
        node.metadata!.observed!.weightClass! >= 1 &&
        node.metadata!.observed!.weightClass! <= 1000
          ? Math.round(node.metadata!.observed!.weightClass!)
          : 400,
      roles: [
        ...(node.roles ?? []),
        ...(node.primary_role ? [node.primary_role] : []),
        ...(inferred?.roles ?? []),
      ],
      classifications: inferred?.classifications ?? [],
      personality: [...(node.personality ?? []), ...(inferred?.personality ?? [])],
      readabilityScore: finiteScore(inferred?.readabilityScore),
      expressivenessScore: finiteScore(inferred?.expressivenessScore),
      descriptor: node.metadata?.descriptor?.trim() ?? "",
    } satisfies TypographyFontIntelligenceEntry;
  });
  if (graphPath === defaultGraphPath) cachedCatalog = catalog;
  return catalog;
};

const overlapRatio = (left: readonly string[], right: readonly string[]): number => {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }
  return intersection / union.size;
};

const roleTokensFor = (layer: TypographyProfileLayer): string[] => {
  if (layer.role === "primary_focus_word" || layer.role === "header") {
    return ["hero", "headline", "display", "title"];
  }
  if (layer.role === "accent_tagline") {
    return ["accent", "script", "italic", "decorative"];
  }
  return ["body", "support", "caption", "subtitle", "reading"];
};

const catalogEntryForAsset = ({
  asset,
  catalogById,
  catalogByFamily,
}: {
  asset: MaulResolvedFontAsset;
  catalogById: ReadonlyMap<string, TypographyFontIntelligenceEntry>;
  catalogByFamily: ReadonlyMap<string, TypographyFontIntelligenceEntry[]>;
}): TypographyFontIntelligenceEntry => {
  const byId = catalogById.get(asset.assetId);
  if (byId) return byId;
  const byFamily = catalogByFamily.get(normalizedFamily(asset.family))?.find(
    (entry) => entry.style === asset.style,
  );
  if (byFamily) return byFamily;
  return {
    fontId: asset.assetId,
    family: asset.family,
    style: asset.style,
    weight: asset.weight,
    roles: asset.style === "normal" ? ["body", "support"] : ["accent", "italic"],
    classifications: [],
    personality: [],
    readabilityScore: 0.5,
    expressivenessScore: 0.5,
    descriptor: asset.family,
  };
};

const scoreCandidate = ({
  layer,
  profileMood,
  entry,
  asset,
}: {
  layer: TypographyProfileLayer;
  profileMood: string;
  entry: TypographyFontIntelligenceEntry;
  asset: MaulResolvedFontAsset;
}): {score: number; exactFamily: boolean; exactStyle: boolean} => {
  const requestedFamilies = layer.matchedFontCandidates.map(normalizedFamily);
  const assetFamily = normalizedFamily(asset.family);
  const exactFamily = requestedFamilies.includes(assetFamily);
  const requestedFamilyTokens = layer.matchedFontCandidates.flatMap(normalizeTokens);
  const assetFamilyTokens = normalizeTokens(asset.family);
  const requestedSignals = normalizeTokens(
    [
      layer.fontClassification,
      profileMood,
      ...roleTokensFor(layer),
    ].join(" "),
  );
  const entrySignals = normalizeTokens(
    [
      ...entry.roles,
      ...entry.classifications,
      ...entry.personality,
      entry.descriptor,
    ].join(" "),
  );
  const styleMatch = asset.style === layer.fontStyle.style ? 1 : -1;
  const exactStyle = styleMatch === 1;
  const weightDistance = Math.abs(asset.weight - layer.fontStyle.weight);
  const score =
    (exactFamily ? 1000 : 0) +
    overlapRatio(requestedFamilyTokens, assetFamilyTokens) * 120 +
    overlapRatio(requestedSignals, entrySignals) * 240 +
    styleMatch * 60 -
    weightDistance / 20 +
    entry.readabilityScore * 10 +
    entry.expressivenessScore * 10;
  return {score: Number(score.toFixed(6)), exactFamily, exactStyle};
};

export const resolveTypographyProfileLayer = ({
  layer,
  profileMood,
  catalog = loadTypographyFontIntelligenceCatalog(),
  executableAssets,
  excludedAssetIds = [],
}: {
  layer: TypographyProfileLayer;
  profileMood: string;
  catalog?: readonly TypographyFontIntelligenceEntry[];
  executableAssets: readonly MaulResolvedFontAsset[];
  excludedAssetIds?: readonly string[];
}): MaulTypographyLayerBinding => {
  const excluded = new Set(excludedAssetIds);
  const candidates = executableAssets.filter(
    (asset) => !excluded.has(asset.assetId),
  );
  if (candidates.length === 0) {
    throw new Error(
      `Typography layer ${layer.layerName} has no deployed font candidates.`,
    );
  }
  const catalogById = new Map(catalog.map((entry) => [entry.fontId, entry]));
  const catalogByFamily = catalog.reduce((byFamily, entry) => {
    const key = normalizedFamily(entry.family);
    const entries = byFamily.get(key) ?? [];
    entries.push(entry);
    byFamily.set(key, entries);
    return byFamily;
  }, new Map<string, TypographyFontIntelligenceEntry[]>());
  const ranked = candidates
    .map((asset) => {
      const entry = catalogEntryForAsset({asset, catalogById, catalogByFamily});
      return {
        asset,
        entry,
        ...scoreCandidate({layer, profileMood, entry, asset}),
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.asset.assetId.localeCompare(right.asset.assetId),
    );
  const selected = ranked[0]!;
  const resolution =
    selected.exactFamily && selected.exactStyle ? "exact" : "closest_catalog";
  return maulTypographyLayerBindingSchema.parse({
    layerName: layer.layerName,
    role: layer.role,
    requestedFamilies: [...layer.matchedFontCandidates],
    requestedWeight: layer.fontStyle.weight,
    requestedStyle: layer.fontStyle.style,
    requestedColor: layer.fontStyle.color,
    requestedRelativeScale: layer.fontStyle.relativeScale,
    requestedLineHeight: layer.fontStyle.lineHeight,
    resolution,
    selectedCatalogFontId: selected.asset.assetId,
    selectedAsset: selected.asset,
    similarityScore: selected.score,
    reason:
      resolution === "exact"
        ? `Exact deployed family match selected for ${layer.layerName}.`
        : `Closest deployed 577-catalog font selected for ${layer.layerName}; requested ${layer.matchedFontCandidates.join(
            ", ",
          )}, selected ${selected.asset.family}.`,
  });
};
