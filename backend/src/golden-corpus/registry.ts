import {z} from "zod";

const sourceKindSchema = z.enum(["youtube_research", "licensed_asset", "user_uploaded_asset"]);
const licensePostureSchema = z.enum(["research_only", "licensed_production", "user_uploaded_production"]);
const commercialUseSchema = z.enum(["allowed", "blocked"]);

const youtubeResearchSourceSchema = z.object({
  kind: z.literal("youtube_research"),
  url: z.string().url(),
  provenanceNote: z.string().min(1)
});

const licensedAssetSourceSchema = z.object({
  kind: z.literal("licensed_asset"),
  assetId: z.string().min(1),
  storageUri: z.string().min(1),
  provenanceNote: z.string().min(1)
});

const userUploadedAssetSourceSchema = z.object({
  kind: z.literal("user_uploaded_asset"),
  assetId: z.string().min(1),
  storageUri: z.string().min(1),
  uploaderId: z.string().min(1),
  provenanceNote: z.string().min(1)
});

export const referenceEditSourceSchema = z.discriminatedUnion("kind", [
  youtubeResearchSourceSchema,
  licensedAssetSourceSchema,
  userUploadedAssetSourceSchema
]);

export const referenceEditRegistryEntryInputSchema = z
  .object({
    registryId: z.string().min(1),
    title: z.string().min(1),
    source: referenceEditSourceSchema,
    license: z.object({
      posture: licensePostureSchema,
      commercialUse: commercialUseSchema,
      evidence: z.string().min(1)
    }),
    creatorStyle: z.object({
      creatorId: z.string().min(1),
      styleLabel: z.string().min(1),
      vehicle: z.enum(["talking_head", "property", "product", "drone", "document_exhibit"])
    }),
    quality: z.object({
      tier: z.enum(["elite", "strong", "generic", "weak", "rejected"]),
      sourceQuality: z.enum(["high", "medium", "low"]),
      compressionRisk: z.enum(["low", "medium", "high"])
    }),
    curation: z.object({
      status: z.enum(["candidate", "approved_golden_candidate", "rejected", "archived"]),
      annotationStatus: z.enum(["not_started", "in_progress", "complete"]),
      trajectoryStatus: z.enum(["not_extracted", "extracted", "validated", "rejected"])
    })
  })
  .superRefine((entry, context) => {
    if (entry.source.kind === "youtube_research") {
      if (entry.license.posture !== "research_only" || entry.license.commercialUse !== "blocked") {
        context.addIssue({
          code: "custom",
          path: ["license"],
          message: "YouTube research references must be marked research_only and blocked for commercial use."
        });
      }
      return;
    }

    if (entry.license.posture === "research_only" || entry.license.commercialUse !== "allowed") {
      context.addIssue({
        code: "custom",
        path: ["license"],
        message: "Production corpus assets require a production license posture and allowed commercial use."
      });
    }
  });

export const referenceEditRegistryEntrySchema = referenceEditRegistryEntryInputSchema.transform((entry) => {
  const researchOnly = entry.source.kind === "youtube_research" || entry.license.posture === "research_only";
  const productionCorpus =
    !researchOnly &&
    (entry.source.kind === "licensed_asset" || entry.source.kind === "user_uploaded_asset") &&
    entry.license.commercialUse === "allowed";

  return {
    ...entry,
    corpusEligibility: {
      researchOnly,
      productionCorpus
    }
  };
});

export const goldenCorpusRegistrySchema = z
  .object({
    schemaVersion: z.literal("golden-corpus-registry-v1"),
    entries: z.array(referenceEditRegistryEntrySchema)
  })
  .superRefine((registry, context) => {
    const seen = new Set<string>();
    for (const [index, entry] of registry.entries.entries()) {
      if (seen.has(entry.registryId)) {
        context.addIssue({
          code: "custom",
          path: ["entries", index, "registryId"],
          message: `Duplicate reference registry ID: ${entry.registryId}`
        });
      }
      seen.add(entry.registryId);
    }
  });

export type ReferenceEditRegistryEntry = z.infer<typeof referenceEditRegistryEntrySchema>;
export type GoldenCorpusRegistry = z.infer<typeof goldenCorpusRegistrySchema>;

export function filterGolden100Candidates(registry: GoldenCorpusRegistry): ReferenceEditRegistryEntry[] {
  return registry.entries.filter((entry) => {
    return (
      entry.corpusEligibility.productionCorpus &&
      entry.quality.tier === "elite" &&
      entry.quality.sourceQuality === "high" &&
      entry.quality.compressionRisk !== "high" &&
      entry.curation.status === "approved_golden_candidate" &&
      entry.curation.annotationStatus === "complete" &&
      entry.curation.trajectoryStatus === "validated"
    );
  });
}

export const GOLDEN_CORPUS_REGISTRY_SCHEMA_VERSION = "golden-corpus-registry-v1";
export const REFERENCE_EDIT_SOURCE_KINDS = sourceKindSchema.options;
