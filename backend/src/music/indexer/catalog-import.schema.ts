import {z} from "zod";

const tagSchema = z.string().trim().min(1);

export const catalogImportTrackMetadataSchema = z.object({
  title: z.string().trim().min(1),
  artist: z.string().trim().default("Unknown Artist"),
  fileName: z.string().trim().min(1),
  relativePath: z.string().trim().optional(),
  source: z.string().trim().min(1),
  sourceUrl: z.string().trim().nullable().optional(),
  licenseType: z.string().trim().optional(),
  commercialAllowed: z.boolean().optional(),
  attributionRequired: z.boolean().optional(),
  licenseVerified: z.boolean().optional(),
  genreTags: z.array(tagSchema).optional(),
  moodTags: z.array(tagSchema).optional(),
  instrumentTags: z.array(tagSchema).optional(),
  useCaseTags: z.array(tagSchema).optional(),
  avoidWhen: z.array(tagSchema).optional(),
  manualNotes: z.string().trim().optional()
});

export type CatalogImportTrackMetadata = z.infer<typeof catalogImportTrackMetadataSchema>;

export const catalogImportManifestSchema = z.object({
  importId: z.string().trim().min(1).default("music-import"),
  sourceRoot: z.string().trim().default("music-import"),
  tracksRoot: z.string().trim().default("tracks"),
  tracks: z.array(catalogImportTrackMetadataSchema).default([])
});

export type CatalogImportManifest = z.infer<typeof catalogImportManifestSchema>;
