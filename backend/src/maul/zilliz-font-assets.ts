import {createHash} from "node:crypto";
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {HttpClient, MilvusClient} from "@zilliz/milvus2-sdk-node";
import type {MaulResolvedFontAsset} from "@prometheus/shared-types";

import type {BackendEnv} from "../config.js";
import {
  rankMaulFontPairs,
  type MaulFontPairRankingResult,
} from "./font-pair-ranking.js";
import {
  createDefaultMaulTypographyProvider,
  createResolvedMaulTypographyProvider,
  type MaulTypographyPlan,
  type MaulTypographyPlanInput,
  type MaulTypographyProvider,
} from "./typography-layout.js";

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

export type ZillizMaulFontCandidate = {
  assetId: string;
  score: number;
  needsManualLicenseReview: boolean;
  roleBuckets?: readonly string[];
};

export type ResolvedMaulFontPair = {
  primary: MaulResolvedFontAsset;
  accent: MaulResolvedFontAsset;
  rankingReceipt?: {
    evaluatedPairCount: number;
    catalogCount: number;
    hydratedCount: number;
    status: MaulFontPairRankingResult["status"];
    score: MaulFontPairRankingResult["score"];
  };
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

type FontEmbeddingProvider = {
  embedTexts(texts: string[]): Promise<number[][]>;
};

const loadEmbeddingProviderModule = async (): Promise<{
  createEmbeddingProvider: (input: {
    provider: string;
    model: string;
    dimensions: number;
    apiKey: string;
    baseUrl: string;
    pythonBin: string;
    useFp16: boolean;
    localBatchSize: number;
  }) => FontEmbeddingProvider;
}> => Function("return import('../../../remotion-app/src/lib/embeddings/provider')")() as Promise<{
  createEmbeddingProvider: (input: {
    provider: string;
    model: string;
    dimensions: number;
    apiKey: string;
    baseUrl: string;
    pythonBin: string;
    useFp16: boolean;
    localBatchSize: number;
  }) => FontEmbeddingProvider;
}>;

const buildDeterministicVector = (text: string, dimensions: number): number[] =>
  Array.from({length: dimensions}, (_, index) => {
    const digest = createHash("sha256").update(`${text}|${index}`).digest("hex");
    return (Number.parseInt(digest.slice(0, 8), 16) % 2000) / 1000 - 1;
  });

const isBlockedLicense = (entry: HydratedFontManifestEntry): boolean => {
  const signals = [
    entry.fontId ?? "",
    entry.familyName ?? "",
    entry.publicUrl ?? "",
    entry.localPublicPath ?? "",
    ...(entry.license?.licenseTexts ?? []),
    ...(entry.warnings ?? []),
  ].join(" ").toLowerCase();
  return /personal\s+use|non[-\s]?commercial|no\s+commercial|free\s+trial|trial|demo/.test(signals);
};

const cssFamilyFor = (fontId: string): string =>
  `PrometheusMaul${fontId.replace(/[^a-zA-Z0-9]+/g, " ").replace(/(?:^|\s)([a-zA-Z0-9])/g, (_, letter: string) => letter.toUpperCase())}`;

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
  Number.isFinite(value) && value! >= 1 && value! <= 1000 ? Math.round(value!) : 400;

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
    throw new Error("MAUL font role taxonomy is unavailable: " + taxonomyPath);
  }
  const parsed = JSON.parse(readFileSync(taxonomyPath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("MAUL font role taxonomy must be an array: " + taxonomyPath);
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

  return parsed.flatMap((value): MaulResolvedFontAsset[] => {
    const entry = value as HydratedFontManifestEntry;
    const assetId = entry.fontId?.trim() ?? "";
    const browserUrl = entry.publicUrl?.trim() ?? "";
    const localPublicPath = entry.localPublicPath?.trim() ?? "";
    const format = entry.format?.trim().toLowerCase() ?? "";
    const roleBuckets = roleBucketsByAssetId.get(assetId) ?? [];
    if (
      !assetId || !browserUrl.startsWith("/") || !localPublicPath ||
      path.isAbsolute(localPublicPath) || !allowedFormats.has(format) ||
      entry.renderable !== true || entry.needsManualLicenseReview ||
      isBlockedLicense(entry) || roleBuckets.includes("forbidden_or_manual_review")
    ) {
      return [];
    }

    const localFilePath = path.resolve(remotionPublicDir, "..", localPublicPath);
    const relativeToPublic = path.relative(remotionPublicDir, localFilePath);
    if (relativeToPublic.startsWith("..") || path.isAbsolute(relativeToPublic) || !existsSync(localFilePath)) {
      return [];
    }
    const bytes = readFileSync(localFilePath);
    if (bytes.length < 12) return [];
    return [{
      assetId,
      family: entry.familyName?.trim() || assetId,
      cssFamily: cssFamilyFor(assetId),
      weight: toWeight(entry.weight),
      style: toStyle(entry.style, entry.familyName, entry.fontId, entry.localPublicPath),
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
    }];
  }).sort((left, right) => left.assetId.localeCompare(right.assetId));
};

export const selectHydratedMaulFontPair = ({
  candidates,
  hydratedAssets,
  roleBucketsByAssetId = loadMaulFontRoleBuckets(),
}: {
  candidates: ZillizMaulFontCandidate[];
  hydratedAssets: MaulResolvedFontAsset[];
  roleBucketsByAssetId?: ReadonlyMap<string, readonly string[]>;
}): ResolvedMaulFontPair => {
  const assetsById = new Map(hydratedAssets.map((asset) => [asset.assetId, asset]));
  const candidateById = new Map(candidates.map((candidate) => [candidate.assetId, candidate]));
  const rolesFor = (assetId: string): readonly string[] =>
    roleBucketsByAssetId.get(assetId) ?? candidateById.get(assetId)?.roleBuckets ?? [];
  const matching = candidates
    .filter((candidate) =>
      !candidate.needsManualLicenseReview &&
      !rolesFor(candidate.assetId).includes("forbidden_or_manual_review")
    )
    .sort((left, right) => right.score - left.score || left.assetId.localeCompare(right.assetId))
    .map((candidate) => assetsById.get(candidate.assetId))
    .filter((asset): asset is MaulResolvedFontAsset => Boolean(asset));
  const primary = matching.find((asset) => {
    const roles = rolesFor(asset.assetId);
    return !roles.includes("accent_script_or_italic");
  });
  const accent = matching.find((asset) => {
    if (asset.assetId === primary?.assetId) return false;
    const roles = rolesFor(asset.assetId);
    return roles.includes("accent_script_or_italic") ||
      asset.style === "italic" || asset.style === "oblique";
  });
  if (!primary || !accent) {
    throw new Error(
      "Zilliz font search did not return a license-cleared primary plus an exact hydrated binary with an accent script or italic role.",
    );
  }
  return {primary, accent};
};

const isHttpMilvusAddress = (address: string): boolean => /^https?:\/\//i.test(address.trim());

const flattenSearchHits = (input: unknown): Record<string, unknown>[] => {
  if (Array.isArray(input)) {
    return input.flatMap((entry) => flattenSearchHits(entry));
  }
  if (typeof input !== "object" || input === null) return [];
  const record = input as Record<string, unknown>;
  if (Array.isArray(record.data)) return flattenSearchHits(record.data);
  if (Array.isArray(record.results)) return flattenSearchHits(record.results);
  return [record];
};

export const buildMaulFontSearchQueries = (
  input: MaulTypographyPlanInput,
): Array<{role: "primary" | "accent"; query: string}> => {
  const context = [
    input.fontSystemId ?? "grotesk_editorial_hinge",
    input.primaryTypeRole ?? "editorial_display",
    ...input.chunks.slice(0, 2).map((chunk) => chunk.text),
  ].join(" | ");
  return [
    {
      role: "primary",
      query: `short-form editorial primary display face, readable cinematic phrase hierarchy, non-script | ${context}`,
    },
    {
      role: "accent",
      query: `short-form editorial accent script, cursive or italic semantic hinge for intentional overlap | ${context}`,
    },
  ];
};

export class ZillizMaulFontAssetResolver {
  private embeddingProvider: FontEmbeddingProvider | null = null;

  public constructor(private readonly env: BackendEnv) {}

  private async embedFontQuery(query: string): Promise<number[]> {
    if (this.env.FONT_INTELLIGENCE_EMBEDDING_PROVIDER === "local-test") {
      return buildDeterministicVector(query, this.env.FONT_INTELLIGENCE_EMBEDDING_DIMENSIONS);
    }
    if (!this.embeddingProvider) {
      const {createEmbeddingProvider} = await loadEmbeddingProviderModule();
      this.embeddingProvider = createEmbeddingProvider({
        provider: this.env.FONT_INTELLIGENCE_EMBEDDING_PROVIDER,
        model: this.env.FONT_INTELLIGENCE_EMBEDDING_MODEL,
        dimensions: this.env.FONT_INTELLIGENCE_EMBEDDING_DIMENSIONS,
        apiKey:
          this.env.FONT_INTELLIGENCE_EMBEDDING_API_KEY ||
          this.env.ASSET_EMBEDDING_API_KEY ||
          this.env.OPENAI_API_KEY,
        baseUrl: this.env.OPENAI_BASE_URL,
        pythonBin: this.env.FONT_INTELLIGENCE_EMBEDDING_PROVIDER === "bge-m3-local"
          ? this.env.BGE_M3_LOCAL_PYTHON_BIN
          : this.env.LOCAL_EMBEDDING_PYTHON_BIN,
        useFp16: this.env.FONT_INTELLIGENCE_EMBEDDING_PROVIDER === "bge-m3-local"
          ? this.env.BGE_M3_LOCAL_USE_FP16
          : this.env.LOCAL_EMBEDDING_USE_FP16,
        localBatchSize: 16,
      });
    }
    const [embedding] = await this.embeddingProvider.embedTexts([query]);
    if (!embedding || embedding.length !== this.env.FONT_INTELLIGENCE_EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Font-intelligence query embedding dimension mismatch: expected ${this.env.FONT_INTELLIGENCE_EMBEDDING_DIMENSIONS}, received ${embedding?.length ?? 0}.`,
      );
    }
    return embedding;
  }

  public async resolve(input: MaulTypographyPlanInput): Promise<ResolvedMaulFontPair> {
    if (!this.env.ASSET_MILVUS_ENABLED) {
      throw new Error("Zilliz MAUL font retrieval requires ASSET_MILVUS_ENABLED=true.");
    }
    const queries = buildMaulFontSearchQueries(input);
    const queryVectors = await Promise.all(
      queries.map(({query}) => this.embedFontQuery(query)),
    );
    const token = this.env.MILVUS_TOKEN || this.env.ZILLIZ_API_KEY || undefined;
    const collection = this.env.FONT_INTELLIGENCE_MILVUS_COLLECTION;
    const outputFields = [
      "id",
      "needs_manual_license_review",
      "roles_text",
      "primary_role",
    ];
    const client = isHttpMilvusAddress(this.env.MILVUS_ADDRESS)
      ? new HttpClient({
          endpoint: new URL(this.env.MILVUS_ADDRESS).origin,
          token,
          database: this.env.MILVUS_DATABASE || undefined,
          timeout: 60000,
        })
      : new MilvusClient({
          address: this.env.MILVUS_ADDRESS,
          token,
          database: this.env.MILVUS_DATABASE || undefined,
          ssl: isHttpMilvusAddress(this.env.MILVUS_ADDRESS),
        });
    const rawResults = await Promise.all(queryVectors.map((queryVector) =>
      isHttpMilvusAddress(this.env.MILVUS_ADDRESS)
        ? (client as HttpClient).search({
            collectionName: collection,
            annsField: "embedding",
            data: [queryVector],
            limit: 12,
            filter: "needs_manual_license_review == false",
            outputFields,
            searchParams: {ef: 96},
          } as never)
        : (client as MilvusClient).search({
            collection_name: collection,
            anns_field: "embedding",
            data: [queryVector],
            limit: 12,
            metric_type: "COSINE",
            params: {ef: 96},
            expr: "needs_manual_license_review == false",
            output_fields: outputFields,
          } as never)
    ));
    const rawCandidates = rawResults.flatMap((rawResult) => flattenSearchHits(rawResult)).map((hit) => ({
      assetId: String(hit.id ?? hit.font_id ?? "").trim(),
      score: Number(hit.score ?? hit.distance ?? 0),
      needsManualLicenseReview: Boolean(hit.needs_manual_license_review),
      roleBuckets: [
        ...(typeof hit.roles_text === "string"
          ? hit.roles_text.split(/\s*\|\s*/u)
          : []),
        ...(typeof hit.primary_role === "string" ? [hit.primary_role] : []),
      ].map((role) => role.trim()).filter(Boolean),
    })).filter((candidate) => candidate.assetId.length > 0);
    const retrievedCandidates = [...rawCandidates.reduce((byId, candidate) => {
      const previous = byId.get(candidate.assetId);
      if (!previous || candidate.score > previous.score) {
        byId.set(candidate.assetId, candidate);
      }
      return byId;
    }, new Map<string, ZillizMaulFontCandidate>()).values()];
    const roleBucketsByAssetId = loadMaulFontRoleBuckets();
    const hydratedAssets = loadHydratedMaulFontAssets({roleBucketsByAssetId});
    const retrievedById = new Map(
      retrievedCandidates.map((candidate) => [candidate.assetId, candidate]),
    );
    const candidates = hydratedAssets.map((asset): ZillizMaulFontCandidate => {
      const retrieved = retrievedById.get(asset.assetId);
      return retrieved ?? {
        assetId: asset.assetId,
        score: 0,
        needsManualLicenseReview: false,
        roleBuckets: roleBucketsByAssetId.get(asset.assetId) ?? [],
      };
    });
    const ranking = rankMaulFontPairs({
      candidates,
      hydratedAssets,
      roleBucketsByAssetId,
      requiredText: input.chunks.map((chunk) => chunk.text).join(" "),
      catalogCount: loadMaulFontCatalogCount(),
    });
    return {
      ...ranking.pair,
      rankingReceipt: {
        evaluatedPairCount: ranking.evaluatedPairCount,
        catalogCount: ranking.catalogCount,
        hydratedCount: ranking.hydratedCount,
        status: ranking.status,
        score: ranking.score,
      },
    };
  }
}

export const createZillizMaulTypographyProvider = (
  env: BackendEnv,
  fallback: MaulTypographyProvider = createDefaultMaulTypographyProvider(),
): MaulTypographyProvider => {
  const resolver = new ZillizMaulFontAssetResolver(env);
  return {
    async plan(input): Promise<MaulTypographyPlan> {
      if (!env.ASSET_MILVUS_ENABLED) {
        return fallback.plan(input);
      }
      try {
        const pair = await resolver.resolve(input);
        const plan = await createResolvedMaulTypographyProvider(pair).plan(input);
        if (plan.status === "unavailable" || !pair.rankingReceipt) return plan;
        return {
          ...plan,
          fontResolution: {
            ...plan.fontResolution,
            reason:
              plan.fontResolution.reason + " Ranked " +
              pair.rankingReceipt.evaluatedPairCount +
              " governed pairs across " +
              pair.rankingReceipt.hydratedCount +
              " hydrated/license-cleared faces from a classified catalog of " +
              pair.rankingReceipt.catalogCount +
              " (" + pair.rankingReceipt.status + ").",
          },
        };
      } catch (error) {
        return {
          status: "unavailable",
          reason: `Zilliz MAUL font resolution blocked: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
};
