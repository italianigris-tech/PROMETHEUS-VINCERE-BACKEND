import path from "node:path";

import type {BackendEnv} from "../config";
import {AssetRetrievalService, type AssetRetrievalResponse} from "../assets/service";
import {
  materializeLocalFontAsset,
  materializeRetrievedFontAsset,
  type MaterializedRetrievedFontAsset
} from "./zilliz-font-materializer";

export type ResolvedVibeFont = {
  assetId: string;
  family: string;
  filePath: string;
  browserUrl: string;
  sources: MaterializedRetrievedFontAsset[];
  score: number;
  confidence: number;
  recommendedUsage: string;
};

export type ResolvedVibeFontPair = {
  primary: ResolvedVibeFont;
  secondary?: ResolvedVibeFont;
  query: string;
  fallbackReasons: string[];
};

type FontRetrievalDependency = {
  retrieve: (input: unknown) => Promise<Pick<AssetRetrievalResponse, "results" | "warnings">>;
  materialize?: (input: {family: string; sourceUrl: string}) => Promise<MaterializedRetrievedFontAsset[]>;
};

const inferFontFamilyFromPath = (filePath: string): string => {
  const fileName = path.basename(filePath).replace(/\.(woff|ttf|zip)$/i, "");
  return fileName || "Unknown Font";
};

const preferredFontRank = (fileName: string): number => {
  const normalized = fileName.toLowerCase();
  if (/(regular|roman|book)/.test(normalized)) {
    return 0;
  }
  if (/(medium|text)/.test(normalized)) {
    return 1;
  }
  if (/(semi|demi)/.test(normalized)) {
    return 2;
  }
  if (/(bold|black|heavy)/.test(normalized)) {
    return 3;
  }
  return 4;
};

const pickPreferredMaterializedSource = (sources: MaterializedRetrievedFontAsset[]): MaterializedRetrievedFontAsset | null => {
  if (sources.length === 0) {
    return null;
  }

  return [...sources]
    .sort((left, right) => preferredFontRank(left.fileName) - preferredFontRank(right.fileName) || left.fileName.localeCompare(right.fileName))[0] ?? null;
};

export const isCompatibleFontPath = (filePath: string): boolean => /\.(woff|ttf|zip)$/i.test(filePath.trim());

const resolveCompatibleSourceUrl = (entry: Record<string, unknown>): string => {
  const sourcePath = String(entry.path ?? "").trim();
  if (isCompatibleFontPath(sourcePath)) {
    return sourcePath;
  }

  const publicPath = String(entry.public_path ?? "").trim();
  if (isCompatibleFontPath(publicPath)) {
    return publicPath;
  }

  return sourcePath;
};

const resolveTypographyQueryText = (vibeDescriptor: string): string => {
  return [
    "luxury typography pairing",
    vibeDescriptor.trim(),
    "primary headline font",
    "secondary support font",
    "editorial restraint",
    "contextual empathy"
  ].filter(Boolean).join(" | ");
};

const isRemoteFontSource = (sourceUrl: string): boolean => /^https?:\/\//i.test(sourceUrl.trim());

const materializeFontAssetFromSource = async ({
  family,
  sourceUrl
}: {
  family: string;
  sourceUrl: string;
}): Promise<MaterializedRetrievedFontAsset[]> => {
  if (isRemoteFontSource(sourceUrl)) {
    return materializeRetrievedFontAsset({family, sourceUrl});
  }

  const materialized = await materializeLocalFontAsset({
    family,
    filePath: sourceUrl
  });
  return [materialized];
};

export const resolveFontsByVibe = async (
  vibeDescriptor: string,
  limit = 2,
  dependency?: FontRetrievalDependency
): Promise<ResolvedVibeFontPair> => {
  if (!dependency?.retrieve) {
    throw new Error("Typography retrieval dependency is unavailable.");
  }

  const query = resolveTypographyQueryText(vibeDescriptor);
  const response = await dependency.retrieve({
    queryText: query,
    desiredAssetTypes: ["font"],
    limit: Math.max(limit, 2)
  });

  const fallbackReasons = [...(response?.warnings ?? [])];
  const compatibleFonts = await Promise.all((response?.results ?? [])
    .filter((entry) => isCompatibleFontPath(resolveCompatibleSourceUrl(entry as Record<string, unknown>)))
    .slice(0, Math.max(limit, 2))
    .map(async (entry) => {
      const sourceUrl = resolveCompatibleSourceUrl(entry as Record<string, unknown>);
      const family = inferFontFamilyFromPath(sourceUrl);
      const materializedSources = await (dependency?.materialize ?? materializeFontAssetFromSource)({
        family,
        sourceUrl
      });
      const preferredSource = pickPreferredMaterializedSource(materializedSources);
      if (!preferredSource) {
        throw new Error(`Typography retrieval could not materialize a browser-safe font for ${family}.`);
      }

      return {
        assetId: String(entry.asset_id ?? ""),
        family,
        filePath: preferredSource.filePath,
        browserUrl: preferredSource.browserUrl,
        sources: materializedSources,
        score: Number(entry.score ?? 0),
        confidence: Number(entry.confidence ?? 0),
        recommendedUsage: String(entry.recommended_usage ?? "")
      } satisfies ResolvedVibeFont;
    }));

  if (compatibleFonts.length === 0) {
    throw new Error("Typography retrieval returned no compatible font files.");
  }

  if (compatibleFonts.length < 2) {
    fallbackReasons.push("Typography retrieval returned fewer than 2 compatible fonts.");
  }

  return {
    primary: compatibleFonts[0]!,
    secondary: compatibleFonts[1],
    query,
    fallbackReasons
  };
};

export class ZillizFontResolver {
  private readonly retrievalService: AssetRetrievalService;

  public constructor(env: BackendEnv) {
    this.retrievalService = new AssetRetrievalService(env);
  }

  public async resolveFontsByVibe(vibeDescriptor: string, limit = 2): Promise<ResolvedVibeFontPair> {
    return resolveFontsByVibe(vibeDescriptor, limit, {
      retrieve: (input) => this.retrievalService.retrieve(input) as Promise<Pick<AssetRetrievalResponse, "results" | "warnings">>,
      materialize: materializeFontAssetFromSource
    });
  }
}
