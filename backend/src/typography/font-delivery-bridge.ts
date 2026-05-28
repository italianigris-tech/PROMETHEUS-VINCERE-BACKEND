import {resolveRetrievedFontsDir} from "../config/font-assets";
import type {BackendEnv} from "../config";
import type {MetadataProfile, NormalizedJobRequest} from "../schemas";
import {
  resolveLocalFontPairByVibe,
  type ResolvedFontCandidate
} from "./font-file-resolver";
import {
  materializeLocalFontAsset,
  type MaterializedRetrievedFontAsset
} from "./zilliz-font-materializer";
import {
  ZillizFontResolver,
  type ResolvedVibeFont,
  type ResolvedVibeFontPair
} from "./zilliz-font-resolver";

export type PipelineFontResolver = (vibeDescriptor: string, limit?: number) => Promise<ResolvedVibeFontPair>;

export type DeliveredTypographyFont = {
  assetId: string | null;
  family: string;
  browserUrl: string | null;
  fileName: string | null;
  format: MaterializedRetrievedFontAsset["format"] | null;
  source: "custom_ingested" | "system" | "fallback";
  retrievalSource: "zilliz" | "local" | "system";
  role: "headline" | "support" | "accent";
  score: number | null;
  confidence: number | null;
  sources: Array<{
    fileName: string;
    browserUrl: string;
    format: MaterializedRetrievedFontAsset["format"];
  }>;
};

export type TypographyDeliveryPlan = {
  primary: DeliveredTypographyFont;
  secondary?: DeliveredTypographyFont;
  query: string;
  source: "zilliz" | "local" | "system";
  graphUsed: boolean;
  pairingScore: number | null;
  fallbackUsed: boolean;
  fallbackReasons: string[];
  warnings: string[];
  fontFaceCss: string;
  roleStyles: {
    headline: {
      letterSpacing: string;
      lineHeight: number;
      fontWeight: number;
    };
    support: {
      letterSpacing: string;
      lineHeight: number;
      fontWeight: number;
    };
  };
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const normalizeScore = (value: unknown): number | null => {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    return null;
  }
  return clamp01(score > 1 ? score / 100 : score);
};

const cssString = (value: string): string => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const inferRole = (value: string | undefined, fallback: DeliveredTypographyFont["role"]): DeliveredTypographyFont["role"] => {
  const normalized = String(value ?? "").toLowerCase();
  if (/(support|secondary|body|caption|subtitle)/.test(normalized)) {
    return "support";
  }
  if (/(accent|quote|callout)/.test(normalized)) {
    return "accent";
  }
  if (/(headline|hero|title|display)/.test(normalized)) {
    return "headline";
  }
  return fallback;
};

const formatCssSource = (font: DeliveredTypographyFont): string | null => {
  if (!font.browserUrl || !font.format) {
    return null;
  }
  return `url("${cssString(font.browserUrl)}") format("${font.format}")`;
};

const buildFontFaceCss = (fonts: DeliveredTypographyFont[]): string => {
  return fonts
    .map((font) => {
      const source = formatCssSource(font);
      if (!source) {
        return "";
      }
      return [
        "@font-face {",
        `  font-family: "${cssString(font.family)}";`,
        `  src: ${source};`,
        "  font-display: swap;",
        "}"
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
};

export const buildTypographyVibeDescriptor = ({
  request,
  metadata
}: {
  request: NormalizedJobRequest;
  metadata: MetadataProfile;
}): string => {
  const userIntent = metadata.user_intent ?? {};
  const typography = metadata.typography ?? {};
  const keywordList = Array.isArray(userIntent.editing_style_keywords)
    ? userIntent.editing_style_keywords
    : [];

  return [
    request.prompt,
    request.creator_niche,
    userIntent.intent_summary,
    userIntent.content_type,
    userIntent.tone_target,
    userIntent.pace_target,
    ...keywordList,
    typography.caption_style_profile,
    typography.typography_default_preset,
    "premium editorial restraint",
    "browser renderable font asset"
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" | ");
};

const toDeliveredZillizFont = (
  font: ResolvedVibeFont,
  fallbackRole: DeliveredTypographyFont["role"]
): DeliveredTypographyFont => {
  const preferredSource = font.sources[0];
  return {
    assetId: font.assetId || null,
    family: font.family,
    browserUrl: font.browserUrl || preferredSource?.browserUrl || null,
    fileName: preferredSource?.fileName ?? null,
    format: preferredSource?.format ?? null,
    source: "custom_ingested",
    retrievalSource: "zilliz",
    role: inferRole(font.recommendedUsage, fallbackRole),
    score: normalizeScore(font.score),
    confidence: normalizeScore(font.confidence),
    sources: font.sources.map((source) => ({
      fileName: source.fileName,
      browserUrl: source.browserUrl,
      format: source.format
    }))
  };
};

const scorePairing = (fonts: DeliveredTypographyFont[]): number | null => {
  const scores = fonts
    .flatMap((font) => [font.score, font.confidence])
    .filter((value): value is number => typeof value === "number");
  if (scores.length === 0) {
    return null;
  }
  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  return Math.round(average * 1000) / 1000;
};

const buildPlan = ({
  primary,
  secondary,
  query,
  source,
  fallbackReasons,
  warnings
}: {
  primary: DeliveredTypographyFont;
  secondary?: DeliveredTypographyFont;
  query: string;
  source: TypographyDeliveryPlan["source"];
  fallbackReasons: string[];
  warnings: string[];
}): TypographyDeliveryPlan => {
  const fonts = [primary, secondary].filter((font): font is DeliveredTypographyFont => Boolean(font));
  return {
    primary,
    secondary,
    query,
    source,
    graphUsed: source !== "system",
    pairingScore: scorePairing(fonts),
    fallbackUsed: source !== "zilliz" || fallbackReasons.length > 0,
    fallbackReasons,
    warnings,
    fontFaceCss: buildFontFaceCss(fonts),
    roleStyles: {
      headline: {
        letterSpacing: "0.012em",
        lineHeight: 0.94,
        fontWeight: 700
      },
      support: {
        letterSpacing: "0.018em",
        lineHeight: 1.08,
        fontWeight: 500
      }
    }
  };
};

const resolveZillizPlan = async ({
  resolver,
  query
}: {
  resolver: PipelineFontResolver;
  query: string;
}): Promise<TypographyDeliveryPlan> => {
  const pair = await resolver(query, 2);
  const primary = toDeliveredZillizFont(pair.primary, "headline");
  const secondary = pair.secondary ? toDeliveredZillizFont(pair.secondary, "support") : undefined;
  return buildPlan({
    primary,
    secondary,
    query: pair.query || query,
    source: "zilliz",
    fallbackReasons: pair.fallbackReasons,
    warnings: []
  });
};

const toDeliveredLocalFont = async ({
  env,
  candidate,
  fallbackRole
}: {
  env: BackendEnv;
  candidate: ResolvedFontCandidate;
  fallbackRole: DeliveredTypographyFont["role"];
}): Promise<DeliveredTypographyFont> => {
  const materialized = await materializeLocalFontAsset({
    family: candidate.family,
    filePath: candidate.filePath,
    targetRootDir: resolveRetrievedFontsDir(env.REMOTION_ASSETS_DIR)
  });

  return {
    assetId: null,
    family: candidate.family,
    browserUrl: materialized.browserUrl,
    fileName: materialized.fileName,
    format: materialized.format,
    source: "custom_ingested",
    retrievalSource: "local",
    role: candidate.roles.includes("support") || candidate.roles.includes("body") ? "support" : fallbackRole,
    score: normalizeScore((candidate.readabilityScore * 0.55) + (candidate.expressivenessScore * 0.45)),
    confidence: normalizeScore(candidate.readabilityScore),
    sources: [{
      fileName: materialized.fileName,
      browserUrl: materialized.browserUrl,
      format: materialized.format
    }]
  };
};

const resolveLocalPlan = async ({
  env,
  query,
  priorFallbackReasons
}: {
  env: BackendEnv;
  query: string;
  priorFallbackReasons: string[];
}): Promise<TypographyDeliveryPlan | null> => {
  const pair = resolveLocalFontPairByVibe(query, 2);
  if (!pair) {
    return null;
  }

  const primary = await toDeliveredLocalFont({
    env,
    candidate: pair.primary,
    fallbackRole: "headline"
  });
  const secondary = pair.secondary
    ? await toDeliveredLocalFont({
        env,
        candidate: pair.secondary,
        fallbackRole: "support"
      })
    : undefined;

  return buildPlan({
    primary,
    secondary,
    query,
    source: "local",
    fallbackReasons: [...priorFallbackReasons, ...pair.fallbackReasons],
    warnings: []
  });
};

const buildSystemPlan = (query: string, fallbackReasons: string[], warnings: string[]): TypographyDeliveryPlan =>
  buildPlan({
    primary: {
      assetId: null,
      family: "DM Sans",
      browserUrl: null,
      fileName: null,
      format: null,
      source: "system",
      retrievalSource: "system",
      role: "headline",
      score: null,
      confidence: null,
      sources: []
    },
    secondary: {
      assetId: null,
      family: "DM Sans",
      browserUrl: null,
      fileName: null,
      format: null,
      source: "system",
      retrievalSource: "system",
      role: "support",
      score: null,
      confidence: null,
      sources: []
    },
    query,
    source: "system",
    fallbackReasons,
    warnings
  });

export const resolveTypographyDeliveryPlan = async ({
  request,
  metadata,
  env,
  resolveFontsByVibe
}: {
  request: NormalizedJobRequest;
  metadata: MetadataProfile;
  env: BackendEnv;
  resolveFontsByVibe?: PipelineFontResolver;
}): Promise<TypographyDeliveryPlan> => {
  const query = buildTypographyVibeDescriptor({request, metadata});
  const fallbackReasons: string[] = [];
  const warnings: string[] = [];
  let resolver = resolveFontsByVibe ?? null;
  if (!resolver && env.ENABLE_FONT_GRAPH && env.ASSET_MILVUS_ENABLED) {
    const zillizResolver = new ZillizFontResolver(env);
    resolver = zillizResolver.resolveFontsByVibe.bind(zillizResolver);
  }

  if (resolver) {
    try {
      return await resolveZillizPlan({resolver, query});
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      fallbackReasons.push(`Zilliz typography retrieval failed: ${reason}`);
      warnings.push(`Typography font bridge used local fallback after Zilliz retrieval failed: ${reason}`);
    }
  }

  try {
    const localPlan = await resolveLocalPlan({
      env,
      query,
      priorFallbackReasons: fallbackReasons
    });
    if (localPlan) {
      return localPlan;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fallbackReasons.push(`Local typography materialization failed: ${reason}`);
    warnings.push(`Typography font bridge fell back to system fonts after local materialization failed: ${reason}`);
  }

  if (fallbackReasons.length === 0) {
    fallbackReasons.push("No Zilliz resolver or local ingested font candidate was available.");
  }
  return buildSystemPlan(query, fallbackReasons, warnings);
};
