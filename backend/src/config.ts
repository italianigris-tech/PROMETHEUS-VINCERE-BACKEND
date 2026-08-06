import {existsSync, readFileSync} from "node:fs";
import path from "node:path";

import {config as loadDotenv, parse as parseDotenv} from "dotenv";
import {z} from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  STORAGE_DIR: z.string().default(path.join(process.cwd(), "data")),
  REMOTION_ASSETS_DIR: z.string().default(""),
  MAX_UPLOAD_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(500 * 1024 * 1024),
  CORS_ORIGINS: z
    .string()
    .default(
      "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3010,http://127.0.0.1:3010,http://localhost:3101,http://127.0.0.1:3101,http://localhost:4101,http://127.0.0.1:4101,http://localhost:5173,http://127.0.0.1:5173"
    ),
  ASSEMBLYAI_API_KEY: z.string().default(""),
  GROQ_API_KEY: z.string().default(""),
  GOOGLE_AI_STUDIO_API_KEY: z.string().default(""),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  GROQ_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  GROQ_MAX_TOKENS: z.coerce.number().int().positive().default(1600),
  PRIMARY_GENERATION_MODEL: z.string().default(""),
  CRITIC_MODEL: z.string().default("gpt-5.5"),
  TEMPORAL_MODEL: z.string().default("prometheus-temporal-deterministic"),
  OCULAR_MODEL: z.string().default("future-ocular-adapter"),
  JOB_QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(1),
  JOB_QUEUE_MAX_PENDING: z.coerce.number().int().nonnegative().default(250),
  JOB_STAGE_STALE_AFTER_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
  PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  PREVIEW_COMPOSITION_FPS: z.coerce.number().min(1).default(30),
  GOD_PROVIDER_KIND: z.string().default("local-template"),
  GOD_PROVIDER_ENDPOINT: z.string().default(""),
  GOD_PROVIDER_API_KEY: z.string().default(""),
  GOD_PROVIDER_MODEL: z.string().default(""),
  GOD_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  GOD_COLLECTION_DIR: z.string().default(path.join(process.cwd(), "..", "remotion-app", "public", "motion-assets", "god")),
  GOD_COLLECTION_MANIFEST_PATH: z.string().default(path.join(process.cwd(), "..", "remotion-app", "src", "data", "god-assets.generated.json")),
  GOD_REVIEW_DIR: z.string().default(path.join(process.cwd(), "data", "god")),
  GOD_MIN_TECHNICAL_SCORE: z.coerce.number().min(0).max(1).default(0.78),
  GOD_MIN_COMPOSITING_SCORE: z.coerce.number().min(0).max(1).default(0.82),
  GOD_MIN_AESTHETIC_SCORE: z.coerce.number().min(0).max(1).default(0.74),
  GOD_MIN_STYLE_SCORE: z.coerce.number().min(0).max(1).default(0.7),
  GOD_MIN_MOTION_SCORE: z.coerce.number().min(0).max(1).default(0.68),
  GOD_MIN_REUSE_SCORE: z.coerce.number().min(0).max(1).default(0.66),
  GOD_MIN_OVERALL_SCORE: z.coerce.number().min(0).max(1).default(0.75),
  GOD_MAX_BRIEF_SIMILARITY: z.coerce.number().min(0).max(1).default(0.88),
  GOD_AUTO_PROMOTE: z.string().default("false"),
  CLOUDFLARE_API_TOKEN: z.string().default(""),
  CLOUDFLARE_ACCOUNT_ID: z.string().default(""),
  R2_ACCOUNT_ID: z.string().default(""),
  R2_ENDPOINT: z.string().default(""),
  R2_ACCESS_KEY_ID: z.string().default(""),
  R2_SECRET_ACCESS_KEY: z.string().default(""),
  R2_BUCKET: z.string().default(""),
  R2_BUCKET_NAME: z.string().default(""),
  MUSIC_R2_CATALOG_PATH: z.string().default(""),
  MUSIC_R2_PUBLIC_BASE_URL: z.string().default(""),
  MUSIC_R2_SIGNED_PREVIEW_URLS_ENABLED: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  MUSIC_R2_SIGNED_PREVIEW_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  R2_UPLOAD_BUCKET: z.string().default("prometheus-uploads"),
  R2_PUBLIC_UPLOADS_BASE: z.string().default(""),
  R2_UPLOAD_URL_EXPIRES_SECONDS: z.coerce.number().int().positive().default(600),
  SUPABASE_URL: z.string().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),
  MAUL_SUPABASE_BRIDGE_ENABLED: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  MAUL_SUPABASE_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(5000),
  MAUL_SUPABASE_LEASE_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  MAUL_SUPABASE_STALE_JOB_MS: z.coerce.number().int().min(60000).default(6 * 60 * 60 * 1000),
  MUSIC_LIBRARY_PATH: z.string().default(""),
  ASSET_MILVUS_ENABLED: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  MILVUS_ADDRESS: z.string().default("127.0.0.1:19530"),
  ZILLIZ_API_KEY: z.string().default(""),
  MILVUS_USERNAME: z.string().default(""),
  MILVUS_PASSWORD: z.string().default(""),
  MILVUS_TOKEN: z.string().default(""),
  MILVUS_DATABASE: z.string().default("default"),
  MILVUS_COLLECTION: z.string().default("prometheus_creative_assets"),
  MILVUS_COLLECTION_ASSETS: z.string().default("unified_motion_graphics_assets"),
  MILVUS_COLLECTION_FONTS: z.string().default("prometheus_fonts"),
  FONT_INTELLIGENCE_MILVUS_COLLECTION: z.string().default("prometheus_typography_fonts"),
  FONT_INTELLIGENCE_EMBEDDING_PROVIDER: z.enum(["openai", "local-test", "local-hf", "bge-m3-local"]).default("local-hf"),
  FONT_INTELLIGENCE_EMBEDDING_MODEL: z.string().default("BAAI/bge-small-en-v1.5"),
  FONT_INTELLIGENCE_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(384),
  FONT_INTELLIGENCE_EMBEDDING_API_KEY: z.string().default(""),
  EMBEDDING_PROVIDER: z.enum(["openai", "local-test", "local-hf", "bge-m3-local"]).default("local-hf"),
  EMBEDDING_MODEL: z.string().default("BAAI/bge-small-en-v1.5"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(384),
  EMBEDDING_API_KEY: z.string().default(""),
  ASSET_EMBEDDING_PROVIDER: z.enum(["openai", "local-test", "local-hf", "bge-m3-local"]).default("local-hf"),
  ASSET_EMBEDDING_MODEL: z.string().default("BAAI/bge-small-en-v1.5"),
  ASSET_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(384),
  ASSET_EMBEDDING_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  MAUL_CHUNKING_LLM_BASE_URL: z
    .string()
    .default("https://codex-everywhere.com"),
  MAUL_CHUNKING_LLM_PATH: z.string().default("/v1/chat/completions"),
  MAUL_CHUNKING_LLM_API_KEY: z.string().default(""),
  MAUL_CHUNKING_LLM_MODEL: z.string().default("gpt-5.6-terra"),
  MAUL_CHUNKING_LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.1),
  MAUL_CHUNKING_LLM_MAX_OUTPUT_TOKENS: z.coerce
    .number()
    .int()
    .positive()
    .default(4000),
  MAUL_CHUNKING_LLM_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60000),
  MAUL_CHUNKING_LLM_MAX_REQUESTS_PER_MINUTE: z.coerce
    .number()
    .int()
    .positive()
    .max(600)
    .default(20),
  MAUL_CHUNKING_LLM_MAX_CONCURRENT_REQUESTS: z.coerce
    .number()
    .int()
    .positive()
    .max(20)
    .default(2),
  MAUL_CREATIVE_PLANNER_BASE_URL: z
    .string()
    .default('https://codex-everywhere.com'),
  MAUL_CREATIVE_PLANNER_PATH: z.string().default('/v1/chat/completions'),
  MAUL_CREATIVE_PLANNER_API_KEY: z.string().default(''),
  MAUL_CREATIVE_PLANNER_MODEL: z.string().default('gpt-5.6-terra'),
  MAUL_CREATIVE_PLANNER_REASONING_EFFORT: z
    .enum(['medium', 'high'])
    .default('high'),
  MAUL_CREATIVE_PLANNER_TEMPERATURE: z.coerce
    .number()
    .min(0)
    .max(2)
    .default(0.2),
  MAUL_CREATIVE_PLANNER_MAX_OUTPUT_TOKENS: z.coerce
    .number()
    .int()
    .positive()
    .default(1800),
  MAUL_CREATIVE_PLANNER_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60000),
  LOCAL_EMBEDDING_PYTHON_BIN: z.string().default("python"),
  LOCAL_EMBEDDING_MODEL_NAME: z.string().default("BAAI/bge-small-en-v1.5"),
  LOCAL_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(384),
  LOCAL_EMBEDDING_USE_FP16: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  BGE_M3_LOCAL_PYTHON_BIN: z.string().default("python"),
  BGE_M3_LOCAL_MODEL_NAME: z.string().default("BAAI/bge-m3"),
  BGE_M3_LOCAL_USE_FP16: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  PREVIEW_ENGINE: z.enum(["hyperframes", "remotion"]).default("hyperframes"),
  ENABLE_LEGACY_OVERLAY: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  ENABLE_LIVE_BROWSER_OVERLAY: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  ENABLE_REMOTION_PREVIEW: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  ENABLE_HYPERFRAMES_PREVIEW: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(true),
  ENABLE_MANIFEST_TYPOGRAPHY: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(true),
  ENABLE_FONT_GRAPH: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(true),
  ENABLE_MILVUS_ANIMATION_RETRIEVAL: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(true),
  ENABLE_SERVER_RENDERED_PREVIEW: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(true),
  ENABLE_PREVIEW_DIAGNOSTICS: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(true),
  ENABLE_AUDIO_ONLY_PREVIEW: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  ENABLE_DARK_AUDIO_PREVIEW: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  ENABLE_BLACK_PREVIEW_BACKGROUND: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  ENABLE_PREVIEW_PIPELINE_TRACE: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(true),
  API_BASE: z.string().default("http://127.0.0.1:8000")
});

export type BackendEnv = z.infer<typeof envSchema>;

let cachedEnv: BackendEnv | null = null;
let overrideWarningLogged = false;

const normalizeMilvusAddress = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, "");
  }

  if (!trimmed.includes(":")) {
    return `${trimmed}:19530`;
  }

  return trimmed;
};

const loadDotenvFallbacks = (): void => {
  const sharedRoot = path.resolve(process.cwd(), "..");
  const remotionRoot = path.resolve(sharedRoot, "remotion-app");
  const consolidatedEnvPath = path.resolve(sharedRoot, "CONSOLIDATED.env");

  if (!overrideWarningLogged) {
    const backendLocalPath = path.resolve(process.cwd(), ".env.local");
    const remotionLocalPath = path.resolve(remotionRoot, ".env.local");
    if (existsSync(backendLocalPath) && existsSync(remotionLocalPath)) {
      const backendLocal = parseDotenv(readFileSync(backendLocalPath, "utf8"));
      const remotionLocal = parseDotenv(readFileSync(remotionLocalPath, "utf8"));
      const comparedKeys = [
        "ASSET_EMBEDDING_PROVIDER",
        "ASSET_EMBEDDING_MODEL",
        "ASSET_EMBEDDING_DIMENSIONS",
        "EMBEDDING_PROVIDER",
        "EMBEDDING_MODEL",
        "EMBEDDING_DIMENSIONS",
        "LOCAL_EMBEDDING_MODEL_NAME",
        "LOCAL_EMBEDDING_DIMENSIONS",
        "BGE_M3_LOCAL_MODEL_NAME",
        "MILVUS_DATABASE",
        "MILVUS_COLLECTION_ASSETS",
        "FONT_INTELLIGENCE_MILVUS_COLLECTION",
        "FONT_INTELLIGENCE_EMBEDDING_PROVIDER",
        "FONT_INTELLIGENCE_EMBEDDING_MODEL",
        "FONT_INTELLIGENCE_EMBEDDING_DIMENSIONS"
      ] as const;
      const mismatches = comparedKeys
        .filter((key) => backendLocal[key] && remotionLocal[key] && backendLocal[key] !== remotionLocal[key])
        .map((key) => `${key}: backend=${backendLocal[key]} remotion=${remotionLocal[key]}`);
      if (mismatches.length > 0) {
        console.warn(
          `[backend:config] remotion-app/.env.local overrides backend/.env.local for overlapping keys. ` +
          `Effective backend embedding settings may follow remotion values. Mismatches: ${mismatches.join(" | ")}`
        );
      }
    }
    overrideWarningLogged = true;
  }

  loadDotenv({quiet: true});
  loadDotenv({
    path: path.resolve(sharedRoot, ".env"),
    quiet: true
  });
  loadDotenv({
    path: consolidatedEnvPath,
    quiet: true
  });
  loadDotenv({
    path: path.resolve(remotionRoot, ".env"),
    quiet: true
  });
  loadDotenv({
    path: path.resolve(process.cwd(), ".env.local"),
    override: true,
    quiet: true
  });
  loadDotenv({
    path: path.resolve(sharedRoot, ".env.local"),
    override: true,
    quiet: true
  });
  loadDotenv({
    path: path.resolve(remotionRoot, ".env.local"),
    override: true,
    quiet: true
  });
};

export const loadEnv = (overrides?: Partial<NodeJS.ProcessEnv>): BackendEnv => {
  if (!cachedEnv || overrides) {
    loadDotenvFallbacks();
    const mergedEnv = {
      ...process.env,
      ...overrides
    };
    cachedEnv = {
      ...envSchema.parse(mergedEnv),
      MILVUS_ADDRESS: normalizeMilvusAddress(String(mergedEnv.MILVUS_ADDRESS ?? "127.0.0.1:19530")),
      MILVUS_TOKEN: String(mergedEnv.MILVUS_TOKEN || mergedEnv.ZILLIZ_API_KEY || "")
    };
  }
  return cachedEnv;
};

export const clearCachedEnv = (): void => {
  cachedEnv = null;
};
