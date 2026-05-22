import {z} from "zod";

import {musicTrackAnalysisStatusSchema} from "../schemas/music-track.schema";

export const r2StorageProviderSchema = z.literal("r2");
export type R2StorageProvider = z.infer<typeof r2StorageProviderSchema>;

export const r2MusicCatalogEntrySchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  artist: z.string().trim().nullable().default(null),
  category: z.string().trim().min(1),
  genreTags: z.array(z.string().trim().min(1)).default([]),
  moodTags: z.array(z.string().trim().min(1)).default([]),
  useCaseTags: z.array(z.string().trim().min(1)).default([]),
  avoidWhen: z.array(z.string().trim().min(1)).default([]),
  audioObjectKey: z.string().trim().min(1),
  thumbnailObjectKey: z.string().trim().nullable().default(null),
  audioPublicUrl: z.string().trim().nullable().default(null),
  thumbnailPublicUrl: z.string().trim().nullable().default(null),
  storageProvider: r2StorageProviderSchema.default("r2"),
  bucket: z.string().trim().min(1),
  durationSec: z.number().positive().nullable().default(null),
  licenseType: z.string().trim().min(1).default("unverified_uploader_catalog"),
  commercialAllowed: z.boolean().default(false),
  attributionRequired: z.boolean().default(false),
  licenseVerified: z.boolean().default(false),
  previewAllowed: z.boolean().default(false),
  renderAllowed: z.boolean().default(false),
  analysisStatus: musicTrackAnalysisStatusSchema.default("pending"),
  uploadedAt: z.string().trim().nullable().default(null),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1)
}).superRefine((value, context) => {
  if (value.renderAllowed && (!value.commercialAllowed || !value.licenseVerified)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "renderAllowed cannot be true unless commercialAllowed and licenseVerified are both true.",
      path: ["renderAllowed"]
    });
  }

  if (value.previewAllowed && !value.audioObjectKey) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "previewAllowed requires an audioObjectKey.",
      path: ["previewAllowed"]
    });
  }
});

export type R2MusicCatalogEntry = z.infer<typeof r2MusicCatalogEntrySchema>;

export const r2MusicCatalogSchema = z.object({
  artifactType: z.literal("r2_music_catalog"),
  version: z.string().trim().min(1),
  sourceCatalogPath: z.string().trim().nullable().default(null),
  bucket: z.string().trim().min(1),
  generatedAt: z.string().trim().min(1),
  totalTracks: z.number().int().nonnegative(),
  entries: z.array(r2MusicCatalogEntrySchema).default([])
}).superRefine((value, context) => {
  if (value.totalTracks !== value.entries.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "totalTracks must match entries.length.",
      path: ["totalTracks"]
    });
  }
});

export type R2MusicCatalog = z.infer<typeof r2MusicCatalogSchema>;
