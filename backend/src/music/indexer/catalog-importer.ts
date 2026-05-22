import path from "node:path";

import {musicTrackSchema, type MusicTrack} from "../schemas/music-track.schema";
import {
  catalogImportManifestSchema,
  catalogImportTrackMetadataSchema,
  type CatalogImportManifest,
  type CatalogImportTrackMetadata
} from "./catalog-import.schema";

export type ImportedCatalogTrack = {
  track: MusicTrack;
  manualNotes: string;
  importWarnings: string[];
  exportSafe: boolean;
};

export type NormalizeCatalogImportInput = {
  manifest: CatalogImportManifest | unknown;
  storageRoot?: string;
  now?: () => string;
};

export type NormalizeCatalogImportResult = {
  importId: string;
  tracks: ImportedCatalogTrack[];
  warnings: string[];
};

const toKebabCase = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
};

const normalizeTagList = (values: string[] | undefined): string[] => {
  return [...new Set((values ?? []).map(toKebabCase).filter(Boolean))];
};

const buildTrackId = ({
  title,
  artist,
  fileName
}: {
  title: string;
  artist: string;
  fileName: string;
}): string => {
  const fileStem = fileName.replace(/\.[a-z0-9]+$/i, "");
  return `import-${toKebabCase(`${artist}-${title}-${fileStem}`)}`;
};

const resolveStoragePath = ({
  storageRoot,
  tracksRoot,
  relativePath,
  fileName
}: {
  storageRoot: string;
  tracksRoot: string;
  relativePath?: string;
  fileName: string;
}): string => {
  const normalizedRelativePath = relativePath?.trim() ? relativePath.replace(/\\/g, "/") : `${tracksRoot}/${fileName}`;
  return path.posix.join(storageRoot.replace(/\\/g, "/"), normalizedRelativePath);
};

const toImportedCatalogTrack = ({
  entry,
  storageRoot,
  tracksRoot,
  now
}: {
  entry: CatalogImportTrackMetadata;
  storageRoot: string;
  tracksRoot: string;
  now: string;
}): ImportedCatalogTrack => {
  const parsedEntry = catalogImportTrackMetadataSchema.parse(entry);
  const commercialAllowed = parsedEntry.commercialAllowed === true;
  const licenseVerified = parsedEntry.licenseVerified === true;
  const attributionRequired = parsedEntry.attributionRequired === true;
  const exportSafe = commercialAllowed && licenseVerified;
  const track = musicTrackSchema.parse({
    id: buildTrackId({
      title: parsedEntry.title,
      artist: parsedEntry.artist,
      fileName: parsedEntry.fileName
    }),
    title: parsedEntry.title.trim(),
    artist: parsedEntry.artist.trim() || "Unknown Artist",
    source: parsedEntry.source,
    sourceUrl: parsedEntry.sourceUrl ?? null,
    storagePath: resolveStoragePath({
      storageRoot,
      tracksRoot,
      relativePath: parsedEntry.relativePath,
      fileName: parsedEntry.fileName
    }),
    licenseType: parsedEntry.licenseType?.trim() || "unknown",
    commercialAllowed,
    attributionRequired,
    licenseVerified,
    durationSec: 1,
    bpm: null,
    musicalKey: null,
    energy: 0.5,
    valence: 0.5,
    arousal: 0.5,
    tension: 0.5,
    prestige: 0.5,
    urgency: 0.5,
    clarity: 0.5,
    speechFriendliness: 0.5,
    genreTags: normalizeTagList(parsedEntry.genreTags),
    moodTags: normalizeTagList(parsedEntry.moodTags),
    instrumentTags: normalizeTagList(parsedEntry.instrumentTags),
    useCaseTags: normalizeTagList(parsedEntry.useCaseTags),
    avoidWhen: normalizeTagList(parsedEntry.avoidWhen),
    beatGrid: null,
    sections: [],
    waveformSummary: null,
    loudnessLufs: null,
    analysisStatus: "pending",
    createdAt: now,
    analyzedAt: null
  });

  return {
    track,
    manualNotes: parsedEntry.manualNotes?.trim() ?? "",
    importWarnings: exportSafe ? [] : ["Track is not export-safe until commercialAllowed and licenseVerified are both true."],
    exportSafe
  };
};

export const normalizeCatalogImportManifest = (
  input: NormalizeCatalogImportInput
): NormalizeCatalogImportResult => {
  const manifest = catalogImportManifestSchema.parse(input.manifest);
  const now = input.now?.() ?? "1970-01-01T00:00:00.000Z";
  const storageRoot = (input.storageRoot ?? manifest.sourceRoot).replace(/\\/g, "/");
  const tracks = manifest.tracks.map((entry) =>
    toImportedCatalogTrack({
      entry,
      storageRoot,
      tracksRoot: manifest.tracksRoot,
      now
    })
  );

  return {
    importId: manifest.importId,
    tracks,
    warnings: tracks.flatMap((entry) => entry.importWarnings)
  };
};
