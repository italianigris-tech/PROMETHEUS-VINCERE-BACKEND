import {z} from "zod";

const id = z.string().trim().min(1);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/i);

export const sfxLifecycleRoleSchema = z.enum([
  "entry",
  "exit",
  "motion_follow",
  "transition_bridge",
  "semantic_substitute",
  "release",
]);

export const sfxCatalogAssetSchema = z
  .object({
    assetId: id,
    sha256,
    objectKey: z.string().min(1).refine((value) => !value.startsWith("/") && !value.includes("..")),
    durationMs: z.number().int().positive(),
    format: z.enum(["mp3", "wav"]),
    analysis: z.object({
      provider: z.literal("ffprobe"),
      inputHash: sha256,
      durationStatus: z.literal("measured"),
      loudnessLufs: z.number().nullable(),
      truePeakDbtp: z.number().nullable(),
      onsetMs: z.number().int().nonnegative().nullable(),
      tailMs: z.number().int().nonnegative().nullable(),
      status: z.enum(["metadata_only", "measured"]),
    }).strict(),
    lifecycleRoles: z.array(sfxLifecycleRoleSchema).min(1),
    material: z.enum(["digital", "air", "metal", "paper", "organic", "cinematic", "sub", "texture"]),
    direction: z.enum(["neutral", "left_to_right", "right_to_left", "inward", "outward"]),
    intensity: z.enum(["soft", "medium", "hard"]),
    semanticTags: z.array(id).min(1),
    rights: z.object({
      state: z.enum(["unknown", "release_allowed", "blocked"]),
      usage: z.enum(["preview_only", "release"]),
      sourceEvidence: z.string().trim().min(1).nullable(),
      licenseEvidence: z.string().trim().min(1).nullable(),
    }).strict(),
  })
  .strict()
  .superRefine((asset, ctx) => {
    if (new Set(asset.lifecycleRoles).size !== asset.lifecycleRoles.length) {
      ctx.addIssue({code: z.ZodIssueCode.custom, path: ["lifecycleRoles"], message: "Lifecycle roles must be unique."});
    }
    if (new Set(asset.semanticTags).size !== asset.semanticTags.length) {
      ctx.addIssue({code: z.ZodIssueCode.custom, path: ["semanticTags"], message: "Semantic tags must be unique."});
    }
    if (asset.rights.usage === "release" && asset.rights.state !== "release_allowed") {
      ctx.addIssue({code: z.ZodIssueCode.custom, path: ["rights"], message: "Release assets require release_allowed rights."});
    }
    if (asset.rights.state === "release_allowed" && (!asset.rights.sourceEvidence || !asset.rights.licenseEvidence)) {
      ctx.addIssue({code: z.ZodIssueCode.custom, path: ["rights"], message: "Release rights require source and license evidence."});
    }
    if (asset.analysis.inputHash !== asset.sha256) {
      ctx.addIssue({code: z.ZodIssueCode.custom, path: ["analysis", "inputHash"], message: "Analysis must bind the asset hash."});
    }
  });

export const sfxCatalogSchema = z
  .object({
    schemaVersion: z.literal("joseph-sfx-catalog/v1"),
    catalogId: id,
    assets: z.array(sfxCatalogAssetSchema).min(1),
  })
  .strict()
  .superRefine((catalog, ctx) => {
    const ids = catalog.assets.map((asset) => asset.assetId);
    const hashes = catalog.assets.map((asset) => asset.sha256);
    if (new Set(ids).size !== ids.length) ctx.addIssue({code: z.ZodIssueCode.custom, path: ["assets"], message: "Asset IDs must be unique."});
    if (new Set(hashes).size !== hashes.length) ctx.addIssue({code: z.ZodIssueCode.custom, path: ["assets"], message: "Asset hashes must be unique."});
  });

export type SfxCatalog = z.infer<typeof sfxCatalogSchema>;
export type SfxCatalogAsset = z.infer<typeof sfxCatalogAssetSchema>;
