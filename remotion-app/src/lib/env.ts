import {z} from "zod";

import type {AppEnv} from "./types";
import {CAPTION_STYLE_PROFILE_IDS} from "./stylebooks/caption-style-profiles";

const envSchema = z.object({
  ASSEMBLYAI_API_KEY: z.string().default(""),
  GROQ_API_KEY: z.string().default(""),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  GROQ_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  GROQ_MAX_TOKENS: z.coerce.number().int().positive().default(900),
  CAPTION_INTELLIGENCE_MODE: z.enum(["auto", "off"]).default("auto"),
  CAPTION_STYLE_PROFILE: z.enum(CAPTION_STYLE_PROFILE_IDS).default("slcp"),
  SUPABASE_URL: z.string().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),
  SUPABASE_PUBLISHABLE_KEY: z.string().default(""),
  SUPABASE_ANON_KEY: z.string().default(""),
  SUPABASE_STORAGE_BUCKET: z.string().default(""),
  SUPABASE_STORAGE_PREFIX: z.string().default(""),
  SUPABASE_ASSETS_TABLE: z.string().default(""),
  SUPABASE_ASSETS_SELECT: z.string().default(""),
  SUPABASE_ASSETS_SCAN_LIMIT: z.coerce.number().int().positive().default(200),
  MOTION_ASSET_MANIFEST_URL: z.string().default(""),
  ASSET_BRAIN_ENABLED: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  CREATIVE_ORCHESTRATION_V1: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => value === true || value === "true")
    .default(false),
  VIDEO_SOURCE_PATH: z.string().min(1, "VIDEO_SOURCE_PATH is required")
});

let cachedEnv: AppEnv | null = null;

const readImportMetaEnv = (): Record<string, string | undefined> => {
  const importMetaEnv =
    typeof import.meta !== "undefined"
      ? (import.meta.env as Record<string, string | boolean | undefined> | undefined)
      : undefined;

  if (!importMetaEnv) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(importMetaEnv).map(([key, value]) => [key, typeof value === "string" ? value : undefined])
  );
};

const readProcessEnv = (): Record<string, string | undefined> => {
  if (typeof process === "undefined") {
    return {};
  }

  return process.env;
};

const readFlagValue = (key: string): string | undefined => {
  const importMetaEnv = readImportMetaEnv();
  const processEnv = readProcessEnv();

  return (
    importMetaEnv[`VITE_${key}`]?.trim() ||
    importMetaEnv[key]?.trim() ||
    processEnv[`VITE_${key}`]?.trim() ||
    processEnv[key]?.trim()
  );
};

export const clearCachedEnv = (): void => {
  cachedEnv = null;
};

export const parseEnv = (rawEnv: NodeJS.ProcessEnv): AppEnv => {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${details}`);
  }
  return parsed.data;
};

export const assertSupabaseDisabled = (env: AppEnv): void => {
  if (env.ASSET_BRAIN_ENABLED) {
    throw new Error(
      "ASSET_BRAIN_ENABLED=true is not supported in this pipeline. Set ASSET_BRAIN_ENABLED=false."
    );
  }
};

export const isCreativeOrchestrationEnabled = (): boolean => {
  const liveValue = readFlagValue("CREATIVE_ORCHESTRATION_V1");
  if (typeof liveValue === "string") {
    return liveValue === "true";
  }

  return cachedEnv?.CREATIVE_ORCHESTRATION_V1 ?? false;
};
