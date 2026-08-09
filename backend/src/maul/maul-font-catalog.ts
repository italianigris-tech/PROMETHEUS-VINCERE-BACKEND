import {createHash} from "node:crypto";
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import type {MaulResolvedFontAsset} from "@prometheus/shared-types";

import {resolveMaulFontReceipt} from "./font-asset-resolution.js";
import {loadBundledMaulFontAssets} from "./typography-layout.js";

type HydratedFontManifestEntry = {
  fontId?: string;
  familyName?: string;
  weight?: number | null;
  style?: string | null;
  format?: string;
  publicUrl?: string;
  localPublicPath?: string;
  renderable?: boolean;
  needsManualLicenseReview?: boolean;
  license?: {licenseTexts?: string[]};
  warnings?: string[];
};

type FontRoleTaxonomyEntry = {
  fontId?: string;
  roleBuckets?: string[];
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../..");
const defaultLibraryManifestPath = path.join(
  repoRoot,
  "remotion-app",
  "public",
  "fonts",
  "library",
  "font-manifest-urls.json",
);
const defaultFontRoleTaxonomyPath = path.join(
  repoRoot,
  "remotion-app",
  "src",
  "lib",
  "font-intelligence",
  "font-role-taxonomy.json",
);
const defaultRemotionPublicDir = path.join(repoRoot, "remotion-app", "public");
const allowedFormats = new Set(["ttf", "otf", "woff", "woff2"]);

const isBlockedLicense = (entry: HydratedFontManifestEntry): boolean => {
  const signals = [
    entry.fontId ?? "",
    entry.familyName ?? "",
    entry.publicUrl ?? "",
    entry.localPublicPath ?? "",
    ...(entry.license?.licenseTexts ?? []),
    ...(entry.warnings ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return /personal\s+use|non[-\s]?commercial|no\s+commercial|free\s+trial|trial|demo/.test(
    signals,
  );
};

const cssFamilyFor = (fontId: string): string =>
  `PrometheusMaul${fontId
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(
      /(?:^|\s)([a-zA-Z0-9])/g,
      (_, letter: string) => letter.toUpperCase(),
    )}`;

const toStyle = (
  value: string | null | undefined,
  ...hints: Array<string | null | undefined>
): "normal" | "italic" | "oblique" => {
  const normalized = [value, ...hints].filter(Boolean).join(" ").toLowerCase();
  if (normalized.includes("oblique")) return "oblique";
  if (normalized.includes("italic")) return "italic";
  return "normal";
};

const toWeight = (value: number | null | undefined): number =>
  Number.isFinite(value) && value! >= 1 && value! <= 1000
    ? Math.round(value!)
    : 400;

export const loadMaulFontRoleBuckets = ({
  taxonomyPath = defaultFontRoleTaxonomyPath,
}: {
  taxonomyPath?: string;
} = {}): ReadonlyMap<string, readonly string[]> => {
  if (!existsSync(taxonomyPath)) {
    throw new Error(`MAUL font role taxonomy is unavailable: ${taxonomyPath}`);
  }
  const parsed = JSON.parse(readFileSync(taxonomyPath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`MAUL font role taxonomy must be an array: ${taxonomyPath}`);
  }
  return new Map(
    parsed.flatMap((value): Array<[string, readonly string[]]> => {
      const entry = value as FontRoleTaxonomyEntry;
      const assetId = entry.fontId?.trim() ?? "";
      const roleBuckets = (entry.roleBuckets ?? [])
        .map((role) => role.trim())
        .filter(Boolean);
      return assetId && roleBuckets.length > 0 ? [[assetId, roleBuckets]] : [];
    }),
  );
};

export const loadMaulFontCatalogCount = ({
  taxonomyPath = defaultFontRoleTaxonomyPath,
}: {
  taxonomyPath?: string;
} = {}): number => {
  if (!existsSync(taxonomyPath)) {
    throw new Error(`MAUL font role taxonomy is unavailable: ${taxonomyPath}`);
  }
  const parsed = JSON.parse(readFileSync(taxonomyPath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`MAUL font role taxonomy must be an array: ${taxonomyPath}`);
  }
  return parsed.length;
};

export const loadHydratedMaulFontAssets = ({
  manifestPath = defaultLibraryManifestPath,
  remotionPublicDir = defaultRemotionPublicDir,
  roleBucketsByAssetId = loadMaulFontRoleBuckets(),
}: {
  manifestPath?: string;
  remotionPublicDir?: string;
  roleBucketsByAssetId?: ReadonlyMap<string, readonly string[]>;
} = {}): MaulResolvedFontAsset[] => {
  if (!existsSync(manifestPath)) return [];
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`MAUL hydrated font manifest must be an array: ${manifestPath}`);
  }
  return parsed
    .flatMap((value): MaulResolvedFontAsset[] => {
      const entry = value as HydratedFontManifestEntry;
      const assetId = entry.fontId?.trim() ?? "";
      const browserUrl = entry.publicUrl?.trim() ?? "";
      const localPublicPath = entry.localPublicPath?.trim() ?? "";
      const format = entry.format?.trim().toLowerCase() ?? "";
      const roleBuckets = roleBucketsByAssetId.get(assetId) ?? [];
      if (
        !assetId ||
        !browserUrl.startsWith("/") ||
        !localPublicPath ||
        path.isAbsolute(localPublicPath) ||
        !allowedFormats.has(format) ||
        entry.renderable !== true ||
        entry.needsManualLicenseReview ||
        isBlockedLicense(entry) ||
        roleBuckets.includes("forbidden_or_manual_review")
      ) {
        return [];
      }
      const localFilePath = path.resolve(
        remotionPublicDir,
        "..",
        localPublicPath,
      );
      const relativeToPublic = path.relative(remotionPublicDir, localFilePath);
      if (
        relativeToPublic.startsWith("..") ||
        path.isAbsolute(relativeToPublic) ||
        !existsSync(localFilePath)
      ) {
        return [];
      }
      const bytes = readFileSync(localFilePath);
      if (bytes.length < 12) return [];
      const asset: MaulResolvedFontAsset = {
        assetId,
        family: entry.familyName?.trim() || assetId,
        cssFamily: cssFamilyFor(assetId),
        weight: toWeight(entry.weight),
        style: toStyle(
          entry.style,
          entry.familyName,
          entry.fontId,
          entry.localPublicPath,
        ),
        browserUrl,
        localFilePath,
        localFileSha256: createHash("sha256").update(bytes).digest("hex"),
        format: format as MaulResolvedFontAsset["format"],
        source: "hydrated_library",
        license: {
          status: "cleared",
          evidence: [
            "Zilliz font-intelligence candidate with manual license review disabled.",
            ...(entry.license?.licenseTexts ?? []).slice(0, 2),
          ],
        },
      };
      try {
        return [resolveMaulFontReceipt(asset, {remotionPublicDir})];
      } catch {
        return [];
      }
    })
    .sort((left, right) => left.assetId.localeCompare(right.assetId));
};

export const loadExecutableMaulFontAssets = (): MaulResolvedFontAsset[] => {
  const byId = new Map<string, MaulResolvedFontAsset>();
  for (const asset of [
    ...loadBundledMaulFontAssets(),
    ...loadHydratedMaulFontAssets(),
  ]) {
    byId.set(asset.assetId, asset);
  }
  return [...byId.values()].sort((left, right) =>
    left.assetId.localeCompare(right.assetId),
  );
};
