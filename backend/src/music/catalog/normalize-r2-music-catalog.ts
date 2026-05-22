import path from "node:path";

import {z} from "zod";

import {
  r2MusicCatalogSchema,
  r2MusicCatalogEntrySchema,
  type R2MusicCatalog
} from "./r2-music-catalog.schema";

const uploaderCatalogEntrySchema = z.object({
  id: z.string().trim().optional(),
  title: z.string().trim().optional(),
  artist: z.string().trim().optional(),
  category: z.string().trim().optional(),
  categorySlug: z.string().trim().optional(),
  originalObjectKey: z.string().trim().optional(),
  thumbnailObjectKey: z.string().trim().nullable().optional(),
  duration: z.number().nullable().optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  genreTags: z.array(z.string().trim().min(1)).optional(),
  moodTags: z.array(z.string().trim().min(1)).optional(),
  useCaseTags: z.array(z.string().trim().min(1)).optional(),
  avoidWhen: z.array(z.string().trim().min(1)).optional(),
  licenseType: z.string().trim().optional(),
  commercialAllowed: z.boolean().optional(),
  attributionRequired: z.boolean().optional(),
  licenseVerified: z.boolean().optional(),
  analysisStatus: z.enum(["pending", "indexed", "analyzing", "analyzed", "failed"]).optional(),
  uploadedAt: z.string().trim().nullable().optional()
}).passthrough();

type UploaderCatalogEntry = {
  id?: string;
  title?: string;
  artist?: string;
  category?: string;
  categorySlug?: string;
  originalObjectKey?: string;
  thumbnailObjectKey?: string | null;
  duration?: number | null;
  fileSizeBytes?: number;
  genreTags?: string[];
  moodTags?: string[];
  useCaseTags?: string[];
  avoidWhen?: string[];
  licenseType?: string;
  commercialAllowed?: boolean;
  attributionRequired?: boolean;
  licenseVerified?: boolean;
  analysisStatus?: "pending" | "indexed" | "analyzing" | "analyzed" | "failed";
  uploadedAt?: string | null;
};

export type NormalizeR2MusicCatalogInput = {
  sourceCatalog: unknown;
  bucket: string;
  sourceCatalogPath?: string | null;
  publicBaseUrl?: string | null;
  version?: string;
  now?: () => string;
};

const slugify = (value: string): string => {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
};

const titleFromSlug = (slug: string): string => {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const normalizeTagList = (values: string[] | undefined): string[] => {
  return [...new Set((values ?? []).map(slugify).filter(Boolean))];
};

const trimTrailingSlash = (value: string): string => {
  return value.replace(/\/+$/, "");
};

const joinPublicUrl = (baseUrl: string | null | undefined, objectKey: string | null | undefined): string | null => {
  if (!baseUrl || !objectKey) {
    return null;
  }

  return `${trimTrailingSlash(baseUrl)}/${objectKey.replace(/^\/+/, "")}`;
};

const readObjectKeySegments = (objectKey: string): {categorySlug: string; trackSlug: string} => {
  const parts = objectKey.split("/").filter(Boolean);
  const categorySlug = parts.at(-2) ?? "uncategorized";
  const trackFileName = parts.at(-1) ?? "";
  const extension = path.extname(trackFileName);
  const trackSlug = slugify(trackFileName.slice(0, trackFileName.length - extension.length));

  return {
    categorySlug,
    trackSlug: trackSlug || "unknown-track"
  };
};

const deriveStableIdentity = (entry: UploaderCatalogEntry): {
  stableId: string;
  categoryLabel: string;
  categorySlug: string;
  trackSlug: string;
  title: string;
} => {
  const objectKey = entry.originalObjectKey?.trim() ?? "";
  const objectKeyParts = objectKey ? readObjectKeySegments(objectKey) : {categorySlug: "", trackSlug: ""};
  const categorySlug = slugify(
    entry.categorySlug ?? entry.category ?? objectKeyParts.categorySlug ?? "uncategorized"
  );
  const trackSlug = slugify(
    entry.id?.split("/").at(-1) ??
    entry.title ??
    objectKeyParts.trackSlug
  ) || objectKeyParts.trackSlug || "unknown-track";
  const categoryLabel = entry.category?.trim() || categorySlug;
  const title = entry.title?.trim() || titleFromSlug(trackSlug);

  return {
    stableId: `${categorySlug}/${trackSlug}`,
    categoryLabel,
    categorySlug,
    trackSlug,
    title
  };
};

const mergeUploaderEntries = (entries: UploaderCatalogEntry[]): UploaderCatalogEntry[] => {
  const grouped = new Map<string, UploaderCatalogEntry>();

  for (const rawEntry of entries) {
    const identity = deriveStableIdentity(rawEntry);
    const existing = grouped.get(identity.stableId);

    if (!existing) {
      grouped.set(identity.stableId, {
        ...rawEntry,
        id: identity.stableId,
        title: identity.title,
        category: identity.categoryLabel,
        categorySlug: identity.categorySlug
      });
      continue;
    }

    grouped.set(identity.stableId, {
      ...existing,
      ...rawEntry,
      id: identity.stableId,
      title: existing.title?.trim() || rawEntry.title?.trim() || identity.title,
      category: existing.category?.trim() || rawEntry.category?.trim() || identity.categoryLabel,
      categorySlug: existing.categorySlug?.trim() || rawEntry.categorySlug?.trim() || identity.categorySlug,
      originalObjectKey: existing.originalObjectKey?.trim() || rawEntry.originalObjectKey?.trim() || undefined,
      thumbnailObjectKey: existing.thumbnailObjectKey?.trim?.() || rawEntry.thumbnailObjectKey?.trim?.() || null,
      duration: existing.duration ?? rawEntry.duration ?? null,
      artist: existing.artist?.trim() || rawEntry.artist?.trim() || undefined,
      genreTags: existing.genreTags ?? rawEntry.genreTags,
      moodTags: existing.moodTags ?? rawEntry.moodTags,
      useCaseTags: existing.useCaseTags ?? rawEntry.useCaseTags,
      avoidWhen: existing.avoidWhen ?? rawEntry.avoidWhen,
      licenseType: existing.licenseType?.trim() || rawEntry.licenseType?.trim() || undefined,
      commercialAllowed: existing.commercialAllowed ?? rawEntry.commercialAllowed,
      attributionRequired: existing.attributionRequired ?? rawEntry.attributionRequired,
      licenseVerified: existing.licenseVerified ?? rawEntry.licenseVerified,
      analysisStatus: existing.analysisStatus ?? rawEntry.analysisStatus,
      uploadedAt: existing.uploadedAt ?? rawEntry.uploadedAt ?? null
    });
  }

  return [...grouped.values()];
};

export const normalizeR2MusicCatalog = (input: NormalizeR2MusicCatalogInput): R2MusicCatalog => {
  const parsedSource = z.array(uploaderCatalogEntrySchema).parse(
    structuredClone(input.sourceCatalog)
  ) as UploaderCatalogEntry[];
  const mergedEntries = mergeUploaderEntries(parsedSource);
  const generatedAt = input.now?.() ?? new Date().toISOString();
  const publicBaseUrl = input.publicBaseUrl?.trim() || null;

  const entries = mergedEntries
    .filter((entry) => Boolean(entry.originalObjectKey?.trim()))
    .map((entry) => {
      const identity = deriveStableIdentity(entry);
      const commercialAllowed = entry.commercialAllowed === true;
      const licenseVerified = entry.licenseVerified === true;
      const attributionRequired = entry.attributionRequired === true;

      return r2MusicCatalogEntrySchema.parse({
        id: identity.stableId,
        title: identity.title,
        artist: entry.artist?.trim() || null,
        category: slugify(identity.categoryLabel || identity.categorySlug),
        genreTags: normalizeTagList(entry.genreTags),
        moodTags: normalizeTagList(entry.moodTags),
        useCaseTags: normalizeTagList(entry.useCaseTags),
        avoidWhen: normalizeTagList(entry.avoidWhen),
        audioObjectKey: entry.originalObjectKey?.trim(),
        thumbnailObjectKey: entry.thumbnailObjectKey?.trim() || null,
        audioPublicUrl: joinPublicUrl(publicBaseUrl, entry.originalObjectKey?.trim()),
        thumbnailPublicUrl: joinPublicUrl(publicBaseUrl, entry.thumbnailObjectKey?.trim() || null),
        storageProvider: "r2",
        bucket: input.bucket,
        durationSec: typeof entry.duration === "number" && Number.isFinite(entry.duration) && entry.duration > 0 ? entry.duration : null,
        licenseType: entry.licenseType?.trim() || "unverified_uploader_catalog",
        commercialAllowed,
        attributionRequired,
        licenseVerified,
        previewAllowed: Boolean(entry.originalObjectKey?.trim()),
        renderAllowed: commercialAllowed && licenseVerified,
        analysisStatus: entry.analysisStatus ?? "pending",
        uploadedAt: entry.uploadedAt ?? null,
        createdAt: generatedAt,
        updatedAt: generatedAt
      });
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  return r2MusicCatalogSchema.parse({
    artifactType: "r2_music_catalog",
    version: input.version ?? "phase5a_v1",
    sourceCatalogPath: input.sourceCatalogPath ?? null,
    bucket: input.bucket,
    generatedAt,
    totalTracks: entries.length,
    entries
  });
};
