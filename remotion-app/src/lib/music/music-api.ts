import {z} from "zod";

import {getBackendApiBaseUrl} from "../backend-api";
import {
  musicCatalogListResponseSchema,
  musicCatalogQueryParamsSchema,
  musicCatalogTrackSchema,
  musicOverrideRequestSchema,
  musicOverrideResponseSchema,
  musicPreflightReportSchema,
  musicPreflightRequestSchema,
  musicPreviewUrlResponseSchema,
  musicRehearsalRequestSchema,
  musicRehearsalResponseSchema,
  videoAwareAudioPlanSchema,
  videoAwareMusicStateSchema,
  videoAwareSoundManifestSummarySchema,
  type MusicCatalogListResponse,
  type MusicCatalogQueryParams,
  type MusicCatalogTrack,
  type MusicOverrideRequest,
  type MusicOverrideResponse,
  type MusicPreflightReport,
  type MusicPreflightRequest,
  type MusicPreviewUrlResponse,
  type MusicRehearsalRequest,
  type MusicRehearsalResponse,
  type VideoAwareAudioPlan,
  type VideoAwareMusicState,
  type VideoAwareSoundManifestSummary
} from "./music-api-types";

export class MusicApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "MusicApiError";
    this.status = status;
    this.payload = payload;
  }
}

const MUSIC_CATALOG_BASE_PATH = "/api/music/catalog";
const JOBS_BASE_PATH = "/api/jobs";

const readConfiguredMusicCatalogBaseUrl = (): string | null => {
  const importMetaEnv = typeof import.meta !== "undefined" ? import.meta.env : undefined;
  const importMetaBaseUrl =
    importMetaEnv?.VITE_MUSIC_CATALOG_BASE_URL?.trim() ||
    importMetaEnv?.NEXT_PUBLIC_MUSIC_CATALOG_BASE_URL?.trim();
  const processBaseUrl =
    typeof process !== "undefined"
      ? process.env.VITE_MUSIC_CATALOG_BASE_URL?.trim() ||
        process.env.NEXT_PUBLIC_MUSIC_CATALOG_BASE_URL?.trim()
      : undefined;

  return importMetaBaseUrl || processBaseUrl || null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const extractErrorMessage = (payload: unknown, fallback: string): string => {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload.trim();
  }

  if (isPlainObject(payload)) {
    const candidates = ["reason", "error", "message", "detail"] as const;
    for (const key of candidates) {
      const value = payload[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
  }

  return fallback;
};

const readResponseBody = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const buildMusicApiUrl = (path: string, query?: URLSearchParams): string => {
  const baseUrl =
    path === MUSIC_CATALOG_BASE_PATH || path.startsWith(`${MUSIC_CATALOG_BASE_PATH}/`)
      ? readConfiguredMusicCatalogBaseUrl() ?? getBackendApiBaseUrl()
      : getBackendApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);
  if (query) {
    url.search = query.toString();
  }
  return url.toString();
};

const fetchMusicApi = async <T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
  query?: URLSearchParams
): Promise<T> => {
  const response = await fetch(buildMusicApiUrl(path, query), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {})
    }
  });

  const payload = await readResponseBody(response);
  if (!response.ok) {
    throw new MusicApiError(
      extractErrorMessage(payload, `Music API request failed with ${response.status}.`),
      response.status,
      payload
    );
  }

  return schema.parse(payload);
};

const fetchMusicApiNullable = async <T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
  query?: URLSearchParams
): Promise<T | null> => {
  try {
    return await fetchMusicApi(path, schema, init, query);
  } catch (error) {
    if (error instanceof MusicApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
};

const buildJobPath = (jobId: string, suffix = ""): string => {
  return `${JOBS_BASE_PATH}/${encodeURIComponent(jobId)}${suffix}`;
};

export const buildMusicDjStatePath = (jobId: string): string => {
  return buildJobPath(jobId, "/music/state");
};

export const buildVideoAwareAudioPlanPath = (jobId: string): string => {
  return buildJobPath(jobId, "/video-aware-audio-plan");
};

export const buildVideoAwareSoundManifestPath = (jobId: string): string => {
  return buildJobPath(jobId, "/video-aware-sound-manifest");
};

export const buildMusicPreflightPath = (jobId: string): string => {
  return buildJobPath(jobId, "/music-preflight");
};

export const buildMusicRehearsalPath = (jobId: string): string => {
  return buildJobPath(jobId, "/music/rehearsal");
};

export const buildJobMusicPreflightPath = (jobId: string): string => {
  return buildJobPath(jobId, "/music/preflight");
};

export const buildMusicOverridesPath = (jobId: string): string => {
  return buildJobPath(jobId, "/music/overrides");
};

export const buildEmptyVideoAwareMusicState = (
  jobId: string,
  reason = "No dry-run music rehearsal artifacts exist yet."
): VideoAwareMusicState => {
  return videoAwareMusicStateSchema.parse({
    jobId,
    hasAudioPlan: false,
    hasSoundManifest: false,
    hasPreflight: false,
    selectedTracks: [],
    musicEvents: [],
    sfxEvents: [],
    warnings: [],
    renderAllowed: false,
    canRenderMusic: false,
    reason
  });
};

export const buildMusicCatalogSearchParams = (params: MusicCatalogQueryParams = {}): URLSearchParams => {
  const parsed = musicCatalogQueryParamsSchema.parse(params);
  const searchParams = new URLSearchParams();

  if (parsed.category) {
    searchParams.set("category", parsed.category);
  }
  if (parsed.genre) {
    searchParams.set("genre", parsed.genre);
  }
  if (parsed.useCase) {
    searchParams.set("useCase", parsed.useCase);
  }
  if (parsed.search) {
    searchParams.set("search", parsed.search);
  }
  if (typeof parsed.limit === "number") {
    searchParams.set("limit", String(parsed.limit));
  }
  if (typeof parsed.offset === "number") {
    searchParams.set("offset", String(parsed.offset));
  }
  if (typeof parsed.includeUnsafe === "boolean") {
    searchParams.set("includeUnsafe", parsed.includeUnsafe ? "true" : "false");
  }

  return searchParams;
};

export const buildMusicTrackPath = (trackId: string): string => {
  return `${MUSIC_CATALOG_BASE_PATH}/${encodeURIComponent(trackId)}`;
};

export const buildMusicPreviewUrlPath = (trackId: string): string => {
  return `${buildMusicTrackPath(trackId)}/preview-url`;
};

export const listMusicCatalog = async (params: MusicCatalogQueryParams = {}): Promise<MusicCatalogListResponse> => {
  return fetchMusicApi(MUSIC_CATALOG_BASE_PATH, musicCatalogListResponseSchema, undefined, buildMusicCatalogSearchParams(params));
};

export const getMusicTrack = async (trackId: string): Promise<MusicCatalogTrack> => {
  return fetchMusicApi(buildMusicTrackPath(trackId), musicCatalogTrackSchema);
};

export const getMusicPreviewUrl = async (trackId: string): Promise<MusicPreviewUrlResponse> => {
  return fetchMusicApi(buildMusicPreviewUrlPath(trackId), musicPreviewUrlResponseSchema);
};

export const getMusicDjState = async (jobId: string): Promise<VideoAwareMusicState> => {
  const safeJobId = jobId.trim();
  if (!safeJobId) {
    return buildEmptyVideoAwareMusicState("preview", "DJ plan controls need a backend jobId.");
  }

  return (
    await fetchMusicApiNullable(buildMusicDjStatePath(safeJobId), videoAwareMusicStateSchema)
  ) ?? buildEmptyVideoAwareMusicState(safeJobId);
};

export const getVideoAwareAudioPlan = async (jobId: string): Promise<VideoAwareAudioPlan | null> => {
  return fetchMusicApiNullable(buildVideoAwareAudioPlanPath(jobId), videoAwareAudioPlanSchema);
};

export const getVideoAwareSoundManifest = async (jobId: string): Promise<VideoAwareSoundManifestSummary | null> => {
  return fetchMusicApiNullable(buildVideoAwareSoundManifestPath(jobId), videoAwareSoundManifestSummarySchema);
};

export const getMusicPreflight = async (jobId: string): Promise<MusicPreflightReport | null> => {
  return fetchMusicApiNullable(buildMusicPreflightPath(jobId), musicPreflightReportSchema);
};

export const runMusicRehearsal = async (
  jobId: string,
  options: Partial<MusicRehearsalRequest> = {}
): Promise<MusicRehearsalResponse> => {
  const body = musicRehearsalRequestSchema.parse({
    useCatalogCandidates: true,
    overwrite: true,
    strict: false,
    ...options
  });

  return fetchMusicApi(buildMusicRehearsalPath(jobId), musicRehearsalResponseSchema, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
};

export const runMusicPreflight = async (
  jobId: string,
  options: Partial<MusicPreflightRequest> = {}
): Promise<MusicPreflightReport> => {
  const body = musicPreflightRequestSchema.parse({
    strict: false,
    requireRenderReady: false,
    ...options
  });

  return fetchMusicApi(buildJobMusicPreflightPath(jobId), musicPreflightReportSchema, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
};

export const submitMusicOverride = async (
  jobId: string,
  override: MusicOverrideRequest
): Promise<MusicOverrideResponse> => {
  const body = musicOverrideRequestSchema.parse(override);
  return fetchMusicApi(buildMusicOverridesPath(jobId), musicOverrideResponseSchema, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
};
