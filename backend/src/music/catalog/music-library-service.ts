import {loadEnv} from "../../config";
import {readR2MusicCatalogArtifact} from "./r2-music-catalog-artifact";
import type {SignedMusicPreviewUrlResult} from "./r2-preview-url-signer";
import {type R2MusicCatalog, type R2MusicCatalogEntry} from "./r2-music-catalog.schema";

export type MusicLibraryUrlMode = "public_url" | "signed_url" | "object_key_only";

export type ResolvedMusicLibraryEntry = R2MusicCatalogEntry & {
  urlMode: MusicLibraryUrlMode;
  audioRef: string;
  thumbnailRef: string | null;
};

export type MusicPreviewReference = {
  trackId: string;
  encodedTrackId: string;
  urlMode: MusicLibraryUrlMode;
  playableInBrowser: boolean;
  audioPreviewUrl: string | null;
  audioObjectKey: string;
  expiresAt?: string;
  ttlSeconds?: number;
  reason: string;
};

export type MusicCatalogQuery = {
  catalog?: R2MusicCatalog;
  catalogPath?: string;
  search?: string;
  category?: string;
  genreTag?: string;
  useCaseTag?: string;
  limit?: number;
  publicBaseUrl?: string | null;
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const encodeUrlPathSegment = (segment: string): string => {
  if (!segment) {
    return "";
  }

  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
};

const toKebabCase = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
};

const resolvePublicBaseUrl = (publicBaseUrl?: string | null): string | null => {
  if (publicBaseUrl !== undefined && publicBaseUrl !== null) {
    const trimmed = publicBaseUrl.trim();
    return trimmed ? trimTrailingSlash(trimmed) : null;
  }

  const env = loadEnv();
  const configured = env.MUSIC_R2_PUBLIC_BASE_URL.trim() || env.R2_PUBLIC_UPLOADS_BASE.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  return null;
};

const toSearchableText = (entry: R2MusicCatalogEntry): string => {
  return [
    entry.title,
    entry.artist ?? "",
    entry.category,
    ...entry.genreTags,
    ...entry.moodTags,
    ...entry.useCaseTags
  ].join(" ").toLowerCase();
};

export const encodeTrackId = (trackId: string): string => encodeURIComponent(trackId);

export const buildPublicObjectUrl = (baseUrl: string | null, objectKey: string | null): string | null => {
  if (!baseUrl || !objectKey) {
    return null;
  }

  const normalizedKey = objectKey
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => encodeUrlPathSegment(segment))
    .join("/");

  return `${trimTrailingSlash(baseUrl)}/${normalizedKey}`;
};

const resolveCatalog = async (input: MusicCatalogQuery): Promise<R2MusicCatalog> => {
  if (input.catalog) {
    return input.catalog;
  }

  return readR2MusicCatalogArtifact({
    inputPath: input.catalogPath
  });
};

const filterEntries = (entries: R2MusicCatalogEntry[], input: MusicCatalogQuery): R2MusicCatalogEntry[] => {
  const search = input.search?.trim().toLowerCase();
  const category = input.category?.trim() ? toKebabCase(input.category) : null;
  const genreTag = input.genreTag?.trim() ? toKebabCase(input.genreTag) : null;
  const useCaseTag = input.useCaseTag?.trim() ? toKebabCase(input.useCaseTag) : null;

  return entries.filter((entry) => {
    if (category && toKebabCase(entry.category) !== category) {
      return false;
    }
    if (genreTag && !entry.genreTags.some((tag) => toKebabCase(tag) === genreTag)) {
      return false;
    }
    if (useCaseTag && !entry.useCaseTags.some((tag) => toKebabCase(tag) === useCaseTag)) {
      return false;
    }
    if (search && !toSearchableText(entry).includes(search)) {
      return false;
    }
    return true;
  });
};

const resolveEntry = (
  entry: R2MusicCatalogEntry,
  publicBaseUrl: string | null
): ResolvedMusicLibraryEntry => {
  const urlMode: MusicLibraryUrlMode = publicBaseUrl ? "public_url" : "object_key_only";
  const audioRef = publicBaseUrl
    ? (entry.audioPublicUrl ?? buildPublicObjectUrl(publicBaseUrl, entry.audioObjectKey) ?? entry.audioObjectKey)
    : entry.audioObjectKey;
  const thumbnailRef = publicBaseUrl
    ? (entry.thumbnailPublicUrl ?? buildPublicObjectUrl(publicBaseUrl, entry.thumbnailObjectKey))
    : (entry.thumbnailObjectKey ?? null);

  return {
    ...entry,
    audioPublicUrl: publicBaseUrl ? (entry.audioPublicUrl ?? audioRef) : null,
    thumbnailPublicUrl: publicBaseUrl ? (entry.thumbnailPublicUrl ?? thumbnailRef) : null,
    urlMode,
    audioRef,
    thumbnailRef
  };
};

export const listMusicCatalog = async (input: MusicCatalogQuery = {}): Promise<{
  urlMode: MusicLibraryUrlMode;
  total: number;
  entries: ResolvedMusicLibraryEntry[];
}> => {
  const catalog = await resolveCatalog(input);
  const publicBaseUrl = resolvePublicBaseUrl(input.publicBaseUrl);
  const filteredEntries = filterEntries(catalog.entries, input);
  const entries = filteredEntries
    .slice(0, Math.max(1, input.limit ?? catalog.entries.length))
    .map((entry) => resolveEntry(entry, publicBaseUrl));

  return {
    urlMode: publicBaseUrl ? "public_url" : "object_key_only",
    total: filteredEntries.length,
    entries
  };
};

export const getMusicTrackById = async ({
  id,
  catalog,
  catalogPath,
  publicBaseUrl
}: {
  id: string;
  catalog?: R2MusicCatalog;
  catalogPath?: string;
  publicBaseUrl?: string | null;
}): Promise<ResolvedMusicLibraryEntry | null> => {
  const resolvedCatalog = catalog ?? await readR2MusicCatalogArtifact({inputPath: catalogPath});
  const baseUrl = resolvePublicBaseUrl(publicBaseUrl);
  const entry = resolvedCatalog.entries.find((candidate) => candidate.id === id);

  return entry ? resolveEntry(entry, baseUrl) : null;
};

export const getMusicPreviewUrl = (
  entry: R2MusicCatalogEntry,
  options: {publicBaseUrl?: string | null} = {}
): {urlMode: MusicLibraryUrlMode; value: string} => {
  const publicBaseUrl = resolvePublicBaseUrl(options.publicBaseUrl);
  if (!publicBaseUrl) {
    return {
      urlMode: "object_key_only",
      value: entry.audioObjectKey
    };
  }

  return {
    urlMode: "public_url",
    value: entry.audioPublicUrl ?? buildPublicObjectUrl(publicBaseUrl, entry.audioObjectKey) ?? entry.audioObjectKey
  };
};

export const getMusicPreviewReference = (
  entry: R2MusicCatalogEntry,
  options: {
    publicBaseUrl?: string | null;
    signedPreviewUrl?: SignedMusicPreviewUrlResult | null;
  } = {}
): MusicPreviewReference => {
  const preview = getMusicPreviewUrl(entry, options);

  if (preview.urlMode === "public_url") {
    return {
      trackId: entry.id,
      encodedTrackId: encodeTrackId(entry.id),
      urlMode: preview.urlMode,
      playableInBrowser: true,
      audioPreviewUrl: preview.value,
      audioObjectKey: entry.audioObjectKey,
      reason: "Public music preview URL is configured."
    };
  }

  if (options.signedPreviewUrl) {
    return {
      trackId: entry.id,
      encodedTrackId: encodeTrackId(entry.id),
      urlMode: "signed_url",
      playableInBrowser: true,
      audioPreviewUrl: options.signedPreviewUrl.url,
      audioObjectKey: entry.audioObjectKey,
      expiresAt: options.signedPreviewUrl.expiresAt,
      ttlSeconds: options.signedPreviewUrl.ttlSeconds,
      reason: "Short-lived signed music preview URL was generated."
    };
  }

  return {
    trackId: entry.id,
    encodedTrackId: encodeTrackId(entry.id),
    urlMode: preview.urlMode,
    playableInBrowser: false,
    audioPreviewUrl: null,
    audioObjectKey: entry.audioObjectKey,
    reason: "Only an R2 object key is available; browser playback needs a safe public or signed URL."
  };
};

export const getMusicThumbnailUrl = (
  entry: R2MusicCatalogEntry,
  options: {publicBaseUrl?: string | null} = {}
): {urlMode: MusicLibraryUrlMode; value: string | null} => {
  const publicBaseUrl = resolvePublicBaseUrl(options.publicBaseUrl);
  if (!publicBaseUrl) {
    return {
      urlMode: "object_key_only",
      value: entry.thumbnailObjectKey ?? null
    };
  }

  return {
    urlMode: "public_url",
    value: entry.thumbnailPublicUrl ?? buildPublicObjectUrl(publicBaseUrl, entry.thumbnailObjectKey)
  };
};

export const getCandidateMusicTracks = async (input: MusicCatalogQuery & {
  requireRenderAllowed?: boolean;
  requirePreviewAllowed?: boolean;
} = {}): Promise<R2MusicCatalogEntry[]> => {
  const catalog = await resolveCatalog(input);
  const filtered = filterEntries(catalog.entries, input);

  return filtered.filter((entry) => {
    if (input.requireRenderAllowed && !entry.renderAllowed) {
      return false;
    }
    if (input.requirePreviewAllowed && !entry.previewAllowed) {
      return false;
    }
    return true;
  });
};
