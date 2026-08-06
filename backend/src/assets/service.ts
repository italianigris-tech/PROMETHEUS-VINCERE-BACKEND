import {HttpClient, MilvusClient} from "@zilliz/milvus2-sdk-node";
import {z} from "zod";

import type {BackendEnv} from "../config";
import {createHash} from "node:crypto";

type EmbeddingProvider = {
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
  }) => EmbeddingProvider;
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
  }) => EmbeddingProvider;
}>;

const requestSchema = z.object({
  queryText: z.string().min(1),
  sceneIntent: z.string().optional(),
  desiredAssetTypes: z.array(z.string()).optional(),
  mood: z.array(z.string()).optional(),
  contexts: z.array(z.string()).optional(),
  antiContexts: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  motionLevel: z.string().optional(),
  positionRole: z.string().optional(),
  compositionHints: z.array(z.string()).optional(),
  timeWindowStartMs: z.number().optional(),
  timeWindowEndMs: z.number().optional(),
  requireAnimated: z.boolean().optional(),
  requireStatic: z.boolean().optional(),
  limit: z.number().int().positive().max(24).optional()
});

export type AssetRetrievalRequest = z.infer<typeof requestSchema>;

export type AssetRetrievalResponse = {
  backend: "milvus";
  query: string;
  totalCandidates: number;
  results: Array<{
    asset_id: string;
    score: number;
    vector_score: number;
    rerank_score: number;
    asset_type: string;
    path: string;
    public_path: string;
    tags: string[];
    labels: string[];
    retrieval_caption: string;
    semantic_description: string;
    why_it_matched: string;
    recommended_usage: string;
    confidence: number;
  }>;
  warnings: string[];
};

const normalizeText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const tokenize = (value: string): string[] => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }
  return normalized.split(" ").filter((token) => token.length > 1);
};

const splitScalarField = (value: unknown): string[] => {
  return String(value ?? "")
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const buildDeterministicVector = (text: string, dimensions: number): number[] => {
  const vector = new Array<number>(dimensions);
  for (let index = 0; index < dimensions; index += 1) {
    const digest = createHash("sha256").update(`${text}|${index}`).digest("hex");
    const sample = Number.parseInt(digest.slice(0, 8), 16);
    vector[index] = ((sample % 2000) / 1000) - 1;
  }
  return vector;
};

const queryNeedsCircularBoost = (query: string): boolean => /(circle|circular|ring|halo|orbit|round)/.test(normalizeText(query));
const queryNeedsReflectiveTone = (query: string): boolean => /(reflective|thoughtful|blur|soft|cinematic|calm|subtle)/.test(normalizeText(query));
const queryNeedsAggressiveMotion = (query: string): boolean => /(burst|spike|impact|aggressive|fast|kinetic|explosive)/.test(normalizeText(query));

type RoleIntent = "headline" | "underlay" | "background" | "transition" | "motion" | "generic";

const buildRequestPool = (request: AssetRetrievalRequest): string => {
  return normalizeText([
    request.positionRole ?? "",
    request.queryText,
    request.sceneIntent ?? "",
    ...(request.contexts ?? []),
    ...(request.compositionHints ?? []),
    ...(request.constraints ?? [])
  ].join(" "));
};

const resolvePrimaryRoleIntent = (request: AssetRetrievalRequest): RoleIntent => {
  const explicitRole = normalizeText(request.positionRole ?? "");
  const requestPool = buildRequestPool(request);

  if (/(headline|quote|word|typography|text)/.test(explicitRole)) {
    return "headline";
  }
  if (/(underlay|accent|halo|ring|focus)/.test(explicitRole)) {
    return "underlay";
  }
  if (/(background|stage|depth)/.test(explicitRole)) {
    return "background";
  }
  if (/(transition|sweep|wipe)/.test(explicitRole)) {
    return "transition";
  }
  if (/(motion|emphasis|punctuation)/.test(explicitRole)) {
    return "motion";
  }
  if (/(underlay|behind centered headline|behind headline|halo behind|ring behind|background accent)/.test(requestPool)) {
    return "underlay";
  }
  if (/(background|support image|wallpaper|scene support|clean stage)/.test(requestPool)) {
    return "background";
  }
  if (/(transition|wipe|bridge|punctuation)/.test(requestPool)) {
    return "transition";
  }
  if (/(emphasis|spike|kinetic|impact)/.test(requestPool)) {
    return "motion";
  }
  if (/(headline|quote|word|typography|text|title)/.test(requestPool)) {
    return "headline";
  }
  return "generic";
};

const scoreRoleCompatibility = ({
  roleIntent,
  assetType,
  motionIntensity,
  extensionIsAnimated,
  rolePool
}: {
  roleIntent: RoleIntent;
  assetType: string;
  motionIntensity: string;
  extensionIsAnimated: boolean;
  rolePool: string;
}): {
  delta: number;
  reasons: string[];
} => {
  const reasons: string[] = [];
  let delta = 0;
  const isHeadline = assetType === "typography_effect" || /(headline|quote|word|typography|text|selection|underline)/.test(rolePool);
  const isUnderlay = /(underlay|halo|ring|glow|focus|accent|spotlight|frame)/.test(rolePool);
  const isBackground = assetType === "background" || /(background|wallpaper|texture|stage|depth)/.test(rolePool) || (assetType === "static_image" && !isHeadline);
  const isTransition = /(transition|sweep|wipe|burst|bridge)/.test(rolePool);
  const isMotion = extensionIsAnimated || assetType === "motion_graphic" || assetType === "animated_overlay";
  const isUi = assetType === "ui_card" || /(card|panel|hud|glass|ui)/.test(rolePool);

  if (roleIntent === "headline") {
    if (isHeadline || isUi) {
      delta += 22;
      reasons.push("headline support fit");
    }
    if (isTransition && !isHeadline) {
      delta -= 10;
      reasons.push("transition-first asset for headline request");
    }
    if (isUnderlay && !isHeadline && !isUi) {
      delta -= 6;
      reasons.push("underlay-first asset for headline request");
    }
  }

  if (roleIntent === "underlay") {
    if (isUnderlay || isBackground || (isMotion && !isHeadline)) {
      delta += 24;
      reasons.push("underlay role fit");
    }
    if (isHeadline && !isUnderlay) {
      delta -= 24;
      reasons.push("headline-first asset for underlay request");
    }
    if (assetType === "typography_effect") {
      delta -= 12;
    }
  }

  if (roleIntent === "background") {
    if (isBackground || (assetType === "static_image" && !isHeadline)) {
      delta += 22;
      reasons.push("background fit");
    }
    if (isTransition) {
      delta -= 16;
      reasons.push("transition asset for background request");
    }
    if (isHeadline) {
      delta -= 12;
      reasons.push("headline asset for background request");
    }
  }

  if (roleIntent === "transition") {
    if (isTransition || (isMotion && motionIntensity !== "minimal")) {
      delta += 20;
      reasons.push("transition fit");
    }
    if (!isMotion) {
      delta -= 14;
      reasons.push("static asset for transition request");
    }
  }

  if (roleIntent === "motion") {
    if (isMotion) {
      delta += 16;
      reasons.push("motion fit");
    }
    if (isBackground && !isMotion) {
      delta -= 8;
      reasons.push("too static for motion emphasis");
    }
  }

  return {delta, reasons};
};

type RawMilvusHit = Record<string, unknown> & {
  id: string;
  score: number;
};

const isHttpMilvusAddress = (address: string): boolean => /^https?:\/\//i.test(address.trim());

const resolveHttpMilvusEndpoint = (address: string): string => {
  const parsed = new URL(address);
  return parsed.origin;
};

export class AssetRetrievalService {
  private client: MilvusClient | HttpClient | null;
  private readonly useHttpMilvus: boolean;
  private embeddingProvider: EmbeddingProvider | null;

  constructor(private readonly env: BackendEnv) {
    this.useHttpMilvus = env.ASSET_MILVUS_ENABLED && isHttpMilvusAddress(env.MILVUS_ADDRESS);
    this.client = null;
    this.embeddingProvider = null;

    console.log(
      `[assets:retrieve] Initialized provider=${env.ASSET_EMBEDDING_PROVIDER} model=${env.ASSET_EMBEDDING_MODEL} ` +
      `dims=${env.ASSET_EMBEDDING_DIMENSIONS} milvus=${env.ASSET_MILVUS_ENABLED} collection=${env.MILVUS_COLLECTION_ASSETS}.`
    );
  }

  private getClient(): MilvusClient | HttpClient {
    if (!this.env.ASSET_MILVUS_ENABLED) {
      throw new Error("ASSET_MILVUS_ENABLED=false");
    }

    if (this.client) {
      return this.client;
    }

    this.client = this.useHttpMilvus
      ? new HttpClient({
          endpoint: resolveHttpMilvusEndpoint(this.env.MILVUS_ADDRESS),
          token: this.env.MILVUS_TOKEN || undefined,
          database: this.env.MILVUS_DATABASE || undefined,
          timeout: 60000
        })
      : new MilvusClient({
          address: this.env.MILVUS_ADDRESS,
          token: this.env.MILVUS_TOKEN || undefined,
          database: this.env.MILVUS_DATABASE || undefined,
          ssl: isHttpMilvusAddress(this.env.MILVUS_ADDRESS)
        });

    return this.client;
  }

  private async getEmbeddingProvider(): Promise<EmbeddingProvider> {
    if (this.embeddingProvider) {
      return this.embeddingProvider;
    }

    try {
      const {createEmbeddingProvider} = await loadEmbeddingProviderModule();
      this.embeddingProvider = createEmbeddingProvider({
        provider: this.env.ASSET_EMBEDDING_PROVIDER,
        model: this.env.ASSET_EMBEDDING_MODEL,
        dimensions: this.env.ASSET_EMBEDDING_DIMENSIONS,
        apiKey: this.env.ASSET_EMBEDDING_API_KEY || this.env.OPENAI_API_KEY,
        baseUrl: this.env.OPENAI_BASE_URL,
        pythonBin: this.env.ASSET_EMBEDDING_PROVIDER === "bge-m3-local"
          ? this.env.BGE_M3_LOCAL_PYTHON_BIN
          : this.env.LOCAL_EMBEDDING_PYTHON_BIN,
        useFp16: this.env.ASSET_EMBEDDING_PROVIDER === "bge-m3-local"
          ? this.env.BGE_M3_LOCAL_USE_FP16
          : this.env.LOCAL_EMBEDDING_USE_FP16,
        localBatchSize: 16
      });
      return this.embeddingProvider;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        "Asset retrieval embeddings are unavailable because the shared remotion-app sources could not be loaded. " +
        `Deploy the repo root or include remotion-app alongside backend. Original error: ${message}`
      );
    }
  }

  private async embedQueryText(queryText: string): Promise<number[]> {
    if (this.env.ASSET_EMBEDDING_PROVIDER === "local-test") {
      return buildDeterministicVector(queryText, this.env.ASSET_EMBEDDING_DIMENSIONS);
    }

    const provider = await this.getEmbeddingProvider();
    const [embedding] = await provider.embedTexts([queryText]);
    return embedding ?? [];
  }

  /** Shares the configured embedding contract with the font-intelligence collection. */
  public async embedTypographyQuery(queryText: string): Promise<number[]> {
    if (!this.env.ASSET_MILVUS_ENABLED) {
      throw new Error("ASSET_MILVUS_ENABLED=false");
    }
    return this.embedQueryText(queryText);
  }

  private buildFilter(request: AssetRetrievalRequest): string | undefined {
    const filters: string[] = [];

    if (request.desiredAssetTypes && request.desiredAssetTypes.length > 0) {
      filters.push(`asset_type in [${request.desiredAssetTypes.map((value) => `"${value}"`).join(", ")}]`);
    }
    if (request.requireAnimated) {
      filters.push("extension_is_animated == true");
    }
    if (request.requireStatic) {
      filters.push("extension_is_animated == false");
    }

    return filters.length > 0 ? filters.join(" && ") : undefined;
  }

  private rerankHit(request: AssetRetrievalRequest, hit: RawMilvusHit): AssetRetrievalResponse["results"][number] {
    const tags = splitScalarField(hit.tags_text);
    const labels = splitScalarField(hit.labels_text);
    const mood = splitScalarField(hit.mood_text);
    const contexts = splitScalarField(hit.contexts_text);
    const antiContexts = splitScalarField(hit.anti_contexts_text);
    const constraints = splitScalarField(hit.constraints_text);
    const assetType = String(hit.asset_type ?? "");
    const motionIntensity = String(hit.motion_intensity ?? "");
    const extensionIsAnimated = Boolean(hit.extension_is_animated);
    const requestPool = buildRequestPool(request);
    const roleIntent = resolvePrimaryRoleIntent(request);
    const queryTerms = new Set(tokenize([
      request.queryText,
      request.sceneIntent ?? "",
      ...(request.contexts ?? []),
      ...(request.compositionHints ?? []),
      ...(request.constraints ?? [])
    ].join(" ")));
    const documentPool = normalizeText([
      assetType,
      String(hit.filename ?? ""),
      String(hit.semantic_description ?? ""),
      String(hit.retrieval_caption ?? ""),
      String(hit.animation_family ?? ""),
      motionIntensity,
      String(hit.dominant_visual_role ?? ""),
      ...tags,
      ...labels,
      ...mood,
      ...contexts,
      ...constraints
    ].join(" "));
    const visualSignaturePool = normalizeText([
      assetType,
      String(hit.filename ?? ""),
      String(hit.retrieval_caption ?? ""),
      String(hit.semantic_description ?? ""),
      String(hit.animation_family ?? ""),
      String(hit.dominant_visual_role ?? "")
    ].join(" "));
    const documentTerms = new Set(tokenize(documentPool));

    let score = Number(hit.score ?? 0) * 100;
    const reasons: string[] = [];
    let exactMatches = 0;
    queryTerms.forEach((term) => {
      if (documentTerms.has(term)) {
        exactMatches += 1;
      }
    });
    if (exactMatches > 0) {
      score += exactMatches * 10;
      reasons.push(`term overlap x${exactMatches}`);
    }

    const contextHits = contexts.filter((context) => (request.contexts ?? []).includes(context) || normalizeText(request.queryText).includes(context)).length;
    if (contextHits > 0) {
      score += contextHits * 12;
      reasons.push(`context fit x${contextHits}`);
    }

    const antiHits = antiContexts.filter((context) => (request.antiContexts ?? []).includes(context) || requestPool.includes(context)).length;
    if (antiHits > 0) {
      score -= antiHits * 18;
      reasons.push(`anti-context penalty x${antiHits}`);
    }

    const constraintHits = constraints.filter((constraint) => (request.constraints ?? []).includes(constraint) || requestPool.includes(constraint)).length;
    if (constraintHits > 0) {
      score += constraintHits * 9;
      reasons.push(`constraint fit x${constraintHits}`);
    }

    const desiredTypeIndex = request.desiredAssetTypes?.indexOf(assetType) ?? -1;
    if (desiredTypeIndex >= 0) {
      score += 18 + Math.max(0, 8 - desiredTypeIndex * 4);
      reasons.push("asset-type match");
    } else if (request.desiredAssetTypes && request.desiredAssetTypes.length > 0) {
      score -= 10;
    }

    if (request.requireAnimated) {
      score += extensionIsAnimated ? 20 : -18;
    }
    if (request.requireStatic) {
      score += !extensionIsAnimated ? 20 : -18;
    }

    const moodHits = mood.filter((entry) => (request.mood ?? []).map(normalizeText).includes(normalizeText(entry))).length;
    if (moodHits > 0) {
      score += moodHits * 6;
      reasons.push(`mood fit x${moodHits}`);
    }

    const roleScore = scoreRoleCompatibility({
      roleIntent,
      assetType,
      motionIntensity,
      extensionIsAnimated,
      rolePool: visualSignaturePool
    });
    score += roleScore.delta;
    reasons.push(...roleScore.reasons);

    if (queryNeedsCircularBoost(request.queryText)) {
      if (/(ring|halo|circle|orbit|circular)/.test(visualSignaturePool)) {
        score += 24;
        reasons.push("circular intent match");
      } else {
        score -= 8;
      }
    }
    if (queryNeedsReflectiveTone(request.queryText) && /(blur|soft|reflective|cinematic|thoughtful|calm|subtle)/.test(visualSignaturePool)) {
      score += 16;
      reasons.push("reflective tone fit");
    }
    if (queryNeedsReflectiveTone(request.queryText) && queryNeedsAggressiveMotion(visualSignaturePool)) {
      score -= 48;
      reasons.push("too aggressive for reflective request");
    }
    if (queryNeedsAggressiveMotion(request.queryText) && queryNeedsAggressiveMotion(visualSignaturePool)) {
      score += 16;
      reasons.push("kinetic intensity fit");
    }
    if (request.positionRole && normalizeText(String(hit.dominant_visual_role ?? "")).includes(normalizeText(request.positionRole))) {
      score += 14;
      reasons.push("role compatibility");
    }
    score += Number(hit.confidence ?? 0.5) * 6;

    return {
      asset_id: hit.id,
      score,
      vector_score: Number(hit.score ?? 0),
      rerank_score: score,
      asset_type: assetType,
      path: String(hit.absolute_path ?? ""),
      public_path: String(hit.public_path ?? ""),
      tags,
      labels,
      retrieval_caption: String(hit.retrieval_caption ?? ""),
      semantic_description: String(hit.semantic_description ?? ""),
      why_it_matched: reasons.join("; ") || "vector similarity",
      recommended_usage: contexts[0]
        ? `Best for ${contexts[0]} with ${String(hit.dominant_visual_role ?? "scene support")}.`
        : `Use as ${String(hit.dominant_visual_role ?? "scene support")}.`,
      confidence: Number(hit.confidence ?? 0.5)
    };
  }

  async retrieve(rawRequest: unknown): Promise<AssetRetrievalResponse> {
    if (!this.env.ASSET_MILVUS_ENABLED) {
      throw new Error("ASSET_MILVUS_ENABLED=false");
    }

    const client = this.getClient();
    const request = requestSchema.parse(rawRequest);
    const hasCollection = this.useHttpMilvus
      ? await (client as HttpClient).hasCollection({
          collectionName: this.env.MILVUS_COLLECTION_ASSETS,
          dbName: this.env.MILVUS_DATABASE
        })
      : await (client as MilvusClient).hasCollection({
          collection_name: this.env.MILVUS_COLLECTION_ASSETS
        });
    const collectionExists = this.useHttpMilvus
      ? Boolean((hasCollection as any).data?.has)
      : Boolean((hasCollection as Awaited<ReturnType<MilvusClient["hasCollection"]>>).value);
    if (!collectionExists) {
      throw new Error(`Milvus collection ${this.env.MILVUS_COLLECTION_ASSETS} does not exist.`);
    }

    if (this.useHttpMilvus) {
      await (client as HttpClient).loadCollection({
        collectionName: this.env.MILVUS_COLLECTION_ASSETS
      });
    } else {
      await (client as MilvusClient).loadCollection({
        collection_name: this.env.MILVUS_COLLECTION_ASSETS
      });
    }

    const queryVector = await this.embedQueryText([
      request.queryText,
      request.sceneIntent ?? "",
      ...(request.contexts ?? []),
      ...(request.compositionHints ?? [])
    ].join(" ").trim());
    const outputFields = [
      "asset_type",
      "absolute_path",
      "public_path",
      "filename",
      "tags_text",
      "labels_text",
      "retrieval_caption",
      "semantic_description",
      "animation_family",
      "motion_intensity",
      "mood_text",
      "contexts_text",
      "anti_contexts_text",
      "constraints_text",
      "dominant_visual_role",
      "confidence",
      "embedding_text",
      "extension_is_animated"
    ];
    const rawHits: RawMilvusHit[] = [];
    if (this.useHttpMilvus) {
      const response = await (client as HttpClient).search({
        collectionName: this.env.MILVUS_COLLECTION_ASSETS,
        annsField: "embedding",
        data: [queryVector],
        limit: Math.max((request.limit ?? 8) * 3, 18),
        filter: this.buildFilter(request),
        outputFields,
        searchParams: {
          ef: 96
        }
      });
      const rows = Array.isArray(response.data) ? response.data : [response.data];
      rawHits.push(
        ...rows.map((entry) => ({
          ...(entry as Record<string, unknown>),
          id: String((entry as Record<string, unknown>).id ?? (entry as Record<string, unknown>).asset_id ?? ""),
          score: Number((entry as Record<string, unknown>).distance ?? (entry as Record<string, unknown>).score ?? 0)
        }))
      );
    } else {
      const rawResult = await (client as MilvusClient).search({
        collection_name: this.env.MILVUS_COLLECTION_ASSETS,
        anns_field: "embedding",
        data: [queryVector],
        limit: Math.max((request.limit ?? 8) * 3, 18),
        metric_type: "COSINE",
        params: {
          ef: 96
        },
        filter: this.buildFilter(request),
        output_fields: outputFields
      });
      rawHits.push(
        ...rawResult.results.map((entry) => ({
          ...(entry as Record<string, unknown>),
          id: String(entry.id),
          score: Number(entry.score ?? 0)
        }))
      );
    }

    const reranked = rawHits
      .map((entry) => this.rerankHit(request, entry))
      .sort((left, right) => right.score - left.score || left.asset_id.localeCompare(right.asset_id))
      .slice(0, request.limit ?? 8);

    return {
      backend: "milvus",
      query: request.queryText,
      totalCandidates: rawHits.length,
      results: reranked,
      warnings: []
    };
  }
}
