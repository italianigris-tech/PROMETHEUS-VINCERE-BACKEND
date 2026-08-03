import {z} from "zod";

const idSchema = z.string().trim().min(1);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);
const reasonSchema = z.string().trim().min(1);

export const maulAudioCatalogReferenceSchema = z
  .object({
    assetId: idSchema,
    assetHash: sha256Schema,
    catalogId: idSchema,
    catalogVersion: z.string().trim().min(1),
    catalogHash: sha256Schema,
  })
  .strict();

const outputIntervalShape = {
  outputStartMs: z.number().int().nonnegative(),
  outputEndMs: z.number().int().positive(),
};

const positiveOutputIntervalSchema = z
  .object(outputIntervalShape)
  .refine((interval) => interval.outputEndMs > interval.outputStartMs, {
    message: "Audio output intervals require positive duration.",
  });

const musicSelectionSchema = z
  .object({
    ...outputIntervalShape,
    decisionId: idSchema,
    asset: maulAudioCatalogReferenceSchema,
    sourceStartMs: z.number().int().nonnegative(),
    sourceEndMs: z.number().int().positive(),
    gainDb: z.number().min(-60).max(12),
    fadeInMs: z.number().int().nonnegative(),
    fadeOutMs: z.number().int().nonnegative(),
    reason: reasonSchema,
  })
  .strict()
  .superRefine((selection, ctx) => {
    if (selection.outputEndMs <= selection.outputStartMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["outputEndMs"],
        message: "Selected music output intervals require positive duration.",
      });
    }
    if (selection.sourceEndMs <= selection.sourceStartMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceEndMs"],
        message: "Selected music source intervals require positive duration.",
      });
    }
    const durationMs = selection.outputEndMs - selection.outputStartMs;
    if (selection.fadeInMs + selection.fadeOutMs > durationMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fadeOutMs"],
        message: "Music fades must fit inside the selected output interval.",
      });
    }
  });

const musicRejectionSchema = z
  .object({
    decisionId: idSchema,
    asset: maulAudioCatalogReferenceSchema,
    reason: reasonSchema,
  })
  .strict();

const musicOmissionSchema = z
  .object({
    decisionId: idSchema,
    reason: reasonSchema,
  })
  .strict();

export const maulSfxLifecycleRoleSchema = z.enum([
  "entry",
  "exit",
  "motion_follow",
  "transition_bridge",
  "semantic_substitute",
  "release",
]);

export const maulSfxTimingRelationSchema = z.enum([
  "before_visual",
  "on_visual",
  "after_visual",
  "before_keyword",
  "on_keyword",
]);

const sfxDecisionBaseShape = {
  eventId: idSchema,
  lifecycleRole: maulSfxLifecycleRoleSchema,
  timingRelation: maulSfxTimingRelationSchema,
  outputMs: z.number().int().nonnegative(),
  visualEventId: idSchema,
  reason: reasonSchema,
};

const selectedSfxEventSchema = z
  .object({
    ...sfxDecisionBaseShape,
    asset: maulAudioCatalogReferenceSchema,
    gainDb: z.number().min(-60).max(12),
  })
  .strict();

const rejectedSfxEventSchema = z
  .object({
    ...sfxDecisionBaseShape,
    asset: maulAudioCatalogReferenceSchema,
  })
  .strict();

const omittedSfxEventSchema = z.object(sfxDecisionBaseShape).strict();

export const maulAudioDuckingSchema = z
  .object({
    enabled: z.boolean(),
    sidechain: z.literal("dialogue"),
    target: z.enum(["music", "sfx", "music_and_sfx"]),
    attenuationDb: z.number().min(-24).max(0),
    attackMs: z.number().int().nonnegative().max(2000),
    releaseMs: z.number().int().nonnegative().max(5000),
    regions: z.array(positiveOutputIntervalSchema),
  })
  .strict()
  .superRefine((ducking, ctx) => {
    if (!ducking.enabled && ducking.regions.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["regions"],
        message: "Disabled ducking cannot carry active regions.",
      });
    }
    ducking.regions.forEach((region, index) => {
      const previous = ducking.regions[index - 1];
      if (previous && region.outputStartMs < previous.outputEndMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["regions", index],
          message: "Ducking regions must be ordered and non-overlapping.",
        });
      }
    });
  });

export const maulAudioMasteringSchema = z
  .object({
    targetIntegratedLufs: z.number().min(-24).max(-8),
    maximumTruePeakDbtp: z.number().min(-12).max(0),
    maximumLoudnessRangeLu: z.number().positive().max(30),
    sampleRateHz: z.number().int().min(8000).max(192000),
    channels: z.number().int().min(1).max(8),
  })
  .strict();

export const maulAudioPlannerProvenanceSchema = z
  .object({
    plannerId: idSchema,
    plannerVersion: z.string().trim().min(1),
    authority: z.enum(["user_locked", "deterministic", "model_proposed"]),
    configuredModel: z.string().trim().min(1).nullable(),
    inferenceReceipt: z
      .object({
        requestHash: sha256Schema,
        responseHash: sha256Schema,
      })
      .strict()
      .nullable(),
    inputHash: sha256Schema,
    createdAt: z.string().datetime(),
  })
  .strict()
  .superRefine((provenance, ctx) => {
    if (
      provenance.authority === "model_proposed" &&
      (!provenance.configuredModel || !provenance.inferenceReceipt)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Model-proposed audio treatment requires a model and inference receipt.",
      });
    }
    if (
      provenance.authority !== "model_proposed" &&
      (provenance.configuredModel || provenance.inferenceReceipt)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Deterministic or user-locked planner provenance cannot claim a model invocation.",
      });
    }
  });

export const maulAudioTreatmentPlanSchema = z
  .object({
    schemaVersion: z.literal("maul-audio-treatment-plan/v1"),
    planId: idSchema,
    outputDurationMs: z.number().int().positive(),
    parentHashes: z.array(sha256Schema).min(1),
    catalogs: z
      .array(
        z
          .object({
            kind: z.enum(["music", "sfx"]),
            catalogId: idSchema,
            version: z.string().trim().min(1),
            hash: sha256Schema,
          })
          .strict(),
      )
      .min(1),
    music: z
      .object({
        selected: z.array(musicSelectionSchema),
        rejected: z.array(musicRejectionSchema),
        omissions: z.array(musicOmissionSchema),
      })
      .strict(),
    sfx: z
      .object({
        selected: z.array(selectedSfxEventSchema),
        rejected: z.array(rejectedSfxEventSchema),
        omissions: z.array(omittedSfxEventSchema),
      })
      .strict(),
    ducking: maulAudioDuckingSchema,
    mastering: maulAudioMasteringSchema,
    userLocks: z.array(
      z
        .object({
          lockId: idSchema,
          targetType: z.enum([
            "music_decision",
            "sfx_event",
            "ducking",
            "mastering",
          ]),
          targetId: idSchema.nullable(),
          lockedBy: idSchema,
          lockedAt: z.string().datetime(),
          reason: reasonSchema,
        })
        .strict(),
    ),
    plannerProvenance: maulAudioPlannerProvenanceSchema,
  })
  .strict()
  .superRefine((plan, ctx) => {
    if (new Set(plan.parentHashes).size !== plan.parentHashes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentHashes"],
        message: "Audio Treatment parent hashes must be unique.",
      });
    }

    const catalogIdentities = plan.catalogs.map((catalog) =>
      JSON.stringify([catalog.kind, catalog.catalogId, catalog.version]),
    );
    if (new Set(catalogIdentities).size !== catalogIdentities.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["catalogs"],
        message:
          "Audio catalog identities must be unique by kind, catalog ID, and version.",
      });
    }

    if (plan.music.selected.length === 0 && plan.music.omissions.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["music", "omissions"],
        message:
          "Audio Treatment requires a music selection or an explicit music omission.",
      });
    }
    if (plan.music.selected.length > 0 && plan.music.omissions.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["music", "omissions"],
        message:
          "Audio Treatment cannot combine a music selection with an explicit music omission.",
      });
    }

    const musicDecisionIds = [
      ...plan.music.selected,
      ...plan.music.rejected,
      ...plan.music.omissions,
    ].map((decision) => decision.decisionId);
    if (new Set(musicDecisionIds).size !== musicDecisionIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["music"],
        message: "Music decision IDs must be unique across outcomes.",
      });
    }

    const musicAssetIdentity = (
      asset: z.infer<typeof maulAudioCatalogReferenceSchema>,
    ) =>
      JSON.stringify([
        asset.catalogId,
        asset.catalogVersion,
        asset.assetId,
      ]);
    const selectedMusicAssets = new Set(
      plan.music.selected.map((selection) => musicAssetIdentity(selection.asset)),
    );
    if (
      plan.music.rejected.some((rejection) =>
        selectedMusicAssets.has(musicAssetIdentity(rejection.asset)),
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["music"],
        message: "A music asset cannot be both selected and rejected.",
      });
    }

    if (plan.sfx.selected.length === 0 && plan.sfx.omissions.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sfx", "omissions"],
        message:
          "Audio Treatment requires an SFX selection or an explicit SFX omission.",
      });
    }

    const sfxEventIds = [
      ...plan.sfx.selected,
      ...plan.sfx.rejected,
      ...plan.sfx.omissions,
    ].map((event) => event.eventId);
    if (new Set(sfxEventIds).size !== sfxEventIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sfx"],
        message:
          "SFX event IDs must record each governed decision exactly once.",
      });
    }

    const catalogMatches = (
      kind: "music" | "sfx",
      reference: z.infer<typeof maulAudioCatalogReferenceSchema>,
    ) =>
      plan.catalogs.some(
        (catalog) =>
          catalog.kind === kind &&
          catalog.catalogId === reference.catalogId &&
          catalog.version === reference.catalogVersion &&
          catalog.hash === reference.catalogHash,
      );
    const assetReferences = [
      ...plan.music.selected.map((decision) => ({
        kind: "music" as const,
        reference: decision.asset,
      })),
      ...plan.music.rejected.map((decision) => ({
        kind: "music" as const,
        reference: decision.asset,
      })),
      ...plan.sfx.selected.map((decision) => ({
        kind: "sfx" as const,
        reference: decision.asset,
      })),
      ...plan.sfx.rejected.map((decision) => ({
        kind: "sfx" as const,
        reference: decision.asset,
      })),
    ];
    const assetHashesByIdentity = new Map<string, string>();
    const inconsistentAssetIdentity = assetReferences.some(
      ({kind, reference}) => {
        const identity = JSON.stringify([
          kind,
          reference.catalogId,
          reference.catalogVersion,
          reference.assetId,
        ]);
        const hashes = JSON.stringify([
          reference.catalogHash,
          reference.assetHash,
        ]);
        const knownHashes = assetHashesByIdentity.get(identity);
        if (knownHashes && knownHashes !== hashes) return true;
        assetHashesByIdentity.set(identity, hashes);
        return false;
      },
    );
    if (inconsistentAssetIdentity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["catalogs"],
        message:
          "Each versioned audio asset identity must use consistent catalog and asset hashes.",
      });
    }
    if (
      assetReferences.some(
        ({kind, reference}) => !catalogMatches(kind, reference),
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["catalogs"],
        message:
          "Every audio asset catalog reference must match a declared catalog version and hash.",
      });
    }

    plan.music.selected.forEach((selection, index) => {
      if (selection.outputEndMs > plan.outputDurationMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["music", "selected", index, "outputEndMs"],
          message: "Selected music must stay inside the output duration.",
        });
      }
    });
    [
      ...plan.sfx.selected,
      ...plan.sfx.rejected,
      ...plan.sfx.omissions,
    ].forEach((event) => {
      if (event.outputMs >= plan.outputDurationMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sfx"],
          message: "SFX decisions must stay inside the output duration.",
        });
      }
    });
    plan.ducking.regions.forEach((region, index) => {
      if (region.outputEndMs > plan.outputDurationMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ducking", "regions", index, "outputEndMs"],
          message: "Ducking regions must stay inside the output duration.",
        });
      }
    });

    const knownMusicDecisions = new Set(musicDecisionIds);
    const knownSfxEvents = new Set(sfxEventIds);
    const lockIds = plan.userLocks.map((lock) => lock.lockId);
    if (
      plan.plannerProvenance.authority === "user_locked" &&
      plan.userLocks.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["userLocks"],
        message:
          "User-locked audio planner authority requires at least one resolved user lock.",
      });
    }
    if (new Set(lockIds).size !== lockIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["userLocks"],
        message: "Audio Treatment user lock IDs must be unique.",
      });
    }
    plan.userLocks.forEach((lock, index) => {
      const resolves =
        (lock.targetType === "music_decision" &&
          lock.targetId !== null &&
          knownMusicDecisions.has(lock.targetId)) ||
        (lock.targetType === "sfx_event" &&
          lock.targetId !== null &&
          knownSfxEvents.has(lock.targetId)) ||
        ((lock.targetType === "ducking" || lock.targetType === "mastering") &&
          lock.targetId === null);
      if (!resolves) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["userLocks", index, "targetId"],
          message: "Audio lock must resolve to a known governed decision.",
        });
      }
    });
  });

export type MaulAudioCatalogReference = z.infer<
  typeof maulAudioCatalogReferenceSchema
>;
export type MaulSfxLifecycleRole = z.infer<typeof maulSfxLifecycleRoleSchema>;
export type MaulSfxTimingRelation = z.infer<typeof maulSfxTimingRelationSchema>;
export type MaulAudioDucking = z.infer<typeof maulAudioDuckingSchema>;
export type MaulAudioMastering = z.infer<typeof maulAudioMasteringSchema>;
export type MaulAudioPlannerProvenance = z.infer<
  typeof maulAudioPlannerProvenanceSchema
>;
export type MaulAudioTreatmentPlan = z.infer<
  typeof maulAudioTreatmentPlanSchema
>;
