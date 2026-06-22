import {stat} from "node:fs/promises";
import path from "node:path";

import {MusicReferenceSchema, type MusicReference} from "@prometheus/shared-types";

import type {R2MusicCatalog, R2MusicCatalogEntry} from "./r2-music-catalog.schema";

export type R2CacheTrack = (entry: R2MusicCatalogEntry, cacheDir: string) => Promise<string>;

export type ResolveR2MusicReferencesInput = {
  catalog: R2MusicCatalog;
  cacheDir: string;
  cacheTrack?: R2CacheTrack;
};

const safeFileName = (value: string): string => value
  .trim()
  .replace(/[^a-zA-Z0-9._-]+/g, "-")
  .replace(/^-+|-+$/g, "") || "r2-track.mp3";

const defaultCachePath = (entry: R2MusicCatalogEntry, cacheDir: string): string =>
  path.resolve(cacheDir, safeFileName(path.basename(entry.audioObjectKey)));

const isUsableCachedAudio = async (filePath: string): Promise<boolean> => {
  const stats = await stat(filePath).catch(() => null);
  return Boolean(stats?.isFile() && stats.size > 0);
};

const licenseStatusFor = (entry: R2MusicCatalogEntry): string => {
  if (entry.renderAllowed && entry.commercialAllowed && entry.licenseVerified) {
    return entry.licenseType || "r2_render_verified";
  }
  return "preview_only_or_unverified";
};

export const resolveR2MusicReferences = async ({
  catalog,
  cacheDir,
  cacheTrack,
}: ResolveR2MusicReferencesInput): Promise<MusicReference[]> => {
  const references = await Promise.all(catalog.entries.map(async (entry) => {
    const localFilePath = cacheTrack
      ? await cacheTrack(entry, cacheDir)
      : defaultCachePath(entry, cacheDir);
    const cacheExists = await isUsableCachedAudio(localFilePath);
    const renderSafe = Boolean(entry.renderAllowed && entry.commercialAllowed && entry.licenseVerified && cacheExists);

    return MusicReferenceSchema.parse({
      trackId: entry.id,
      title: entry.title,
      sourceKind: "r2",
      localFilePath,
      browserUrl: entry.audioPublicUrl ?? undefined,
      durationSeconds: entry.durationSec ?? 1,
      renderSafe,
      licenseStatus: licenseStatusFor(entry),
    });
  }));

  return references.sort((left, right) => left.title.localeCompare(right.title));
};
