import { z } from "zod";

/**
 * Exact Google-font assets loaded by the MAUL planned-text Remotion composition.
 * Matching a family name is insufficient: the renderer must load the selected
 * asset at the planned weight.
 */
export const MAUL_RENDERER_FONT_CATALOG = [
  {assetId: "font_google_dm_sans_700", family: "DM Sans", weight: 700},
  {
    assetId: "font_google_playfair_display_700",
    family: "Playfair Display",
    weight: 700,
  },
  {
    assetId: "font_google_playfair_display_italic_700",
    family: "Playfair Display",
    weight: 700,
  },
  {assetId: "font_google_bebas_neue_400", family: "Bebas Neue", weight: 400},
  {
    assetId: "font_google_dm_serif_display_400",
    family: "DM Serif Display",
    weight: 400,
  },
  {assetId: "font_google_great_vibes_400", family: "Great Vibes", weight: 400},
] as const;

export type MaulRendererFontCatalogEntry =
  (typeof MAUL_RENDERER_FONT_CATALOG)[number];

export const isMaulRendererFontCatalogEntry = (input: {
  assetId: string;
  family: string;
  weight: number;
}): boolean => MAUL_RENDERER_FONT_CATALOG.some(
  (font) =>
    font.assetId === input.assetId &&
    font.family === input.family &&
    font.weight === input.weight,
);

/**
 * A font receipt binds planner measurement to the precise browser asset that
 * Remotion must load. Family-name matching is deliberately insufficient.
 */
export const maulResolvedFontAssetSchema = z.object({
  assetId: z.string().trim().min(1),
  family: z.string().trim().min(1),
  cssFamily: z.string().trim().min(1),
  weight: z.number().int().min(1).max(1000),
  style: z.enum(["normal", "italic", "oblique"]),
  browserUrl: z.string().trim().regex(/^\//, "browserUrl must be root-relative"),
  localFilePath: z.string().trim().min(1),
  localFileSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  format: z.enum(["ttf", "otf", "woff", "woff2"]),
  source: z.enum(["bundled", "hydrated_library", "zilliz_materialized"]),
  license: z.object({
    status: z.enum(["cleared", "bundled"]),
    evidence: z.array(z.string().trim().min(1)).min(1),
  }),
});

export type MaulResolvedFontAsset = z.infer<typeof maulResolvedFontAssetSchema>;

import {
  maulMinimumLegibilityPrimitiveSchema,
  maulNormalizedBoxSchema,
  maulShortsTextChunkPlanV2CoreSchema,
  maulTextPlacementPlanCoreSchema,
} from "./maul-text-placement.js";
import {maulTextAnimationPlanCoreSchema} from "./maul-text-animation.js";
import {
  joinShortsTextTokens,
  shortsTextChunkPlanSchema,
} from "./shorts-text-chunking.js";

const idSchema = z.string().trim().min(1);
const isoDateSchema = z.string().datetime();
const confidenceSchema = z.number().min(0).max(1);
const sourceRangeShape = {
  sourceStartMs: z.number().int().nonnegative(),
  sourceEndMs: z.number().int().positive(),
};
const sourceRange = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z.object({ ...sourceRangeShape, ...shape }).refine(
    (value) => {
      const range = value as { sourceStartMs: number; sourceEndMs: number };
      return range.sourceEndMs > range.sourceStartMs;
    },
    { message: "sourceEndMs must be greater than sourceStartMs" },
  );
const sourceRangeSchema = sourceRange({});

export const maulProjectStatusSchema = z.enum([
  "intake_ready",
  "analyzing",
  "candidates_ready",
  "review_ready",
  "export_ready",
  "completed",
  "failed",
]);
export const maulGoalSchema = z.enum([
  "retention",
  "clarity",
  "conversion",
  "brand_consistency",
  "editing_speed",
]);
export const maulPlatformSchema = z.enum([
  "instagram_reels",
  "youtube_shorts",
  "tiktok",
  "linkedin",
  "other",
]);
export const maulTreatmentIdSchema = z.enum([
  "founder_podcast",
  "premium_direct_response",
  "minimal_expert",
]);

export const maulSourceModeSchema = z.enum([
  "single_speaker_talking_head",
  "single_speaker_podcast",
  "multi_speaker_panel",
  "gameplay_first",
  "music_video_montage",
  "fiction_continuity",
]);

export const maulV1SourceProfileSchema = z
  .object({
    mode: maulSourceModeSchema,
    principalSpeakerCount: z.number().int().nonnegative(),
    primaryLanguage: z.string().trim().min(2),
    suitabilityStatus: z
      .literal("declared_in_scope_pending_analysis")
      .optional()
      .default("declared_in_scope_pending_analysis"),
  })
  .superRefine((profile, ctx) => {
    const supportedMode =
      profile.mode === "single_speaker_talking_head" ||
      profile.mode === "single_speaker_podcast";
    if (
      !supportedMode ||
      profile.principalSpeakerCount !== 1 ||
      profile.primaryLanguage !== "en"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "MAUL V1 Source Scope accepts English one-principal-speaker talking-head or podcast footage only.",
      });
    }
  });

export const maulProjectIntakeSchema = z.object({
  goal: maulGoalSchema,
  platform: maulPlatformSchema,
  sourceProfile: maulV1SourceProfileSchema,
  brandKitId: idSchema.nullable(),
  treatmentPreference: maulTreatmentIdSchema.nullable(),
  requestedShortCount: z.number().int().min(1).max(3),
  requestedThumbnailCount: z.number().int().min(1).max(4),
  targetDurationMs: z
    .object({
      min: z.number().int().min(1000),
      max: z.number().int().min(1000),
    })
    .refine(({ min, max }) => max >= min, {
      message: "targetDurationMs.max must be greater than or equal to min",
    }),
});

export const maulProjectSchema = z
  .object({
    schemaVersion: z.literal("maul-project/v1"),
    id: idSchema,
    canonicalJobId: idSchema,
    tenantId: idSchema.optional(),
    creatorId: idSchema,
    status: maulProjectStatusSchema,
    intake: maulProjectIntakeSchema,
    rootSourceAssetId: idSchema,
    artifactIds: z.array(idSchema),
    activeRunId: idSchema,
    revision: z.number().int().positive(),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  })
  .refine(
    ({ rootSourceAssetId, artifactIds }) =>
      artifactIds.includes(rootSourceAssetId),
    {
      message: "artifactIds must include rootSourceAssetId",
      path: ["artifactIds"],
    },
  );

export const maulSourceAssetPayloadSchema = z.object({
  originalFilename: z.string().trim().min(1),
  storageKey: z.string().trim().min(1),
  mediaType: z.string().trim().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  durationMs: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  hasAudio: z.boolean(),
  hasVideo: z.boolean(),
});

const maulVisualAssetRoleSchema = z.enum([
  "speaker_hero",
  "b_roll",
  "evidence_image",
  "split_proof",
  "editorial_graphic",
  "quiet_hold",
]);

const maulVisualAssetSchema = z
  .object({
    assetId: idSchema,
    projectId: idSchema,
    rootSourceAssetId: idSchema,
    mediaKind: z.enum(["video", "image"]),
    storagePath: z.string().trim().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    durationMs: z.number().int().positive().nullable(),
    rights: z.object({
      verified: z.boolean(),
      receiptId: idSchema.nullable(),
    }),
    provenance: z.object({
      kind: z.enum(["source", "project_owned", "licensed", "brand", "reference_corpus"]),
      provenanceReceiptId: idSchema.nullable(),
    }),
    permittedRoles: z.array(maulVisualAssetRoleSchema).min(1),
  })
  .superRefine((asset, ctx) => {
    if (!asset.rights.verified || !asset.rights.receiptId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rights"],
        message: "Visual assets require verified rights and a receipt.",
      });
    }
    if (asset.provenance.kind !== "source" && !asset.provenance.provenanceReceiptId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["provenance", "provenanceReceiptId"],
        message: "Non-source visual assets require a provenance receipt.",
      });
    }
  });

export const maulVisualAssetPackSchema = z
  .object({
    schemaVersion: z.literal("maul-visual-asset-pack/v1"),
    projectId: idSchema,
    rootSourceAssetId: idSchema,
    sourceAssetId: idSchema,
    assets: z.array(maulVisualAssetSchema).min(1),
  })
  .superRefine((pack, ctx) => {
    const ids = pack.assets.map((asset) => asset.assetId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({code: z.ZodIssueCode.custom, path: ["assets"], message: "Visual asset IDs must be unique."});
    }
    const source = pack.assets.find((asset) => asset.assetId === pack.sourceAssetId);
    if (!source || source.mediaKind !== "video" || source.provenance.kind !== "source") {
      ctx.addIssue({code: z.ZodIssueCode.custom, path: ["sourceAssetId"], message: "Visual asset pack requires its canonical source video."});
    }
    if (source && source.assetId !== pack.rootSourceAssetId) {
      ctx.addIssue({code: z.ZodIssueCode.custom, path: ["sourceAssetId"], message: "Visual asset pack sourceAssetId must equal rootSourceAssetId."});
    }
    for (const [index, asset] of pack.assets.entries()) {
      if (asset.projectId !== pack.projectId || asset.rootSourceAssetId !== pack.rootSourceAssetId) {
        ctx.addIssue({code: z.ZodIssueCode.custom, path: ["assets", index], message: "Visual assets must share project lineage."});
      }
      if (asset.provenance.kind === "reference_corpus") {
        ctx.addIssue({code: z.ZodIssueCode.custom, path: ["assets", index], message: "Reference-corpus media cannot enter a visual asset pack."});
      }
      if (asset.provenance.kind === "source" && asset.assetId !== pack.sourceAssetId) {
        ctx.addIssue({code: z.ZodIssueCode.custom, path: ["assets", index], message: "Only the canonical source may use source provenance."});
      }
    }
  });

const maulVisualTransitionSchema = z.object({
  type: z.enum(["hard_cut", "fade", "directional_reveal"]),
  durationMs: z.number().int().nonnegative().max(500),
});

const maulVisualIntervalSchema = z.object({
  intervalId: idSchema,
  outputStartMs: z.number().int().nonnegative(),
  outputEndMs: z.number().int().positive(),
  sourceStartMs: z.number().int().nonnegative().nullable().optional().default(null),
  sourceEndMs: z.number().int().positive().nullable().optional().default(null),
  mode: maulVisualAssetRoleSchema,
  assetId: idSchema.nullable(),
  secondaryAssetId: idSchema.nullable(),
  crop: maulNormalizedBoxSchema,
  graphic: z
    .object({
      headline: z.string().trim().min(1),
      detail: z.string().trim().min(1),
      accentColor: z.string().regex(/^#[a-f0-9]{6}$/i),
    })
    .optional(),
  purpose: z.string().trim().min(1),
  evidenceRationale: z.string().trim().min(1),
  transition: maulVisualTransitionSchema,
}).superRefine((interval, ctx) => {
  if (interval.outputEndMs <= interval.outputStartMs) {
    ctx.addIssue({code: z.ZodIssueCode.custom, path: ["outputEndMs"], message: "Visual intervals require positive duration."});
  }
  const isSourceBacked =
    interval.mode === "speaker_hero" ||
    interval.mode === "quiet_hold" ||
    interval.mode === "split_proof";
  if (
    isSourceBacked &&
    (interval.sourceStartMs === null ||
      interval.sourceEndMs === null ||
      interval.sourceEndMs <= interval.sourceStartMs)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sourceStartMs"],
      message: "Source-backed visual intervals require a positive source range.",
    });
  }
  if (interval.mode === "editorial_graphic" && interval.assetId !== null) {
    ctx.addIssue({code: z.ZodIssueCode.custom, path: ["assetId"], message: "Editorial graphics are manifest data, not arbitrary media."});
  }
  if (interval.mode === "editorial_graphic" && !interval.graphic) {
    ctx.addIssue({code: z.ZodIssueCode.custom, path: ["graphic"], message: "Editorial graphics require governed manifest data."});
  }
  if (interval.mode === "split_proof" && !interval.secondaryAssetId) {
    ctx.addIssue({code: z.ZodIssueCode.custom, path: ["secondaryAssetId"], message: "Split proof requires a secondary evidence asset."});
  }
});

export const maulVisualTrackSchema = z
  .object({
    schemaVersion: z.literal("maul-visual-track/v1"),
    projectId: idSchema,
    rootSourceAssetId: idSchema,
    sourceAssetId: idSchema,
    outputDurationMs: z.number().int().positive(),
    assets: z.array(maulVisualAssetSchema).min(1),
    intervals: z.array(maulVisualIntervalSchema).min(1),
  })
  .superRefine((track, ctx) => {
    const assetPack = maulVisualAssetPackSchema.safeParse({
      schemaVersion: "maul-visual-asset-pack/v1",
      projectId: track.projectId,
      rootSourceAssetId: track.rootSourceAssetId,
      sourceAssetId: track.sourceAssetId,
      assets: track.assets,
    });
    if (!assetPack.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assets"],
        message: `Visual asset lineage/provenance is invalid: ${assetPack.error.issues[0]?.message ?? "asset pack rejected"}`,
      });
    }
    const assetIds = new Set(track.assets.map((asset) => asset.assetId));
    let previousEnd = 0;
    for (const [index, interval] of track.intervals.entries()) {
      if (interval.outputStartMs !== previousEnd) {
        ctx.addIssue({code: z.ZodIssueCode.custom, path: ["intervals", index], message: "Visual intervals must cover the output contiguously without gaps or overlap."});
      }
      if (interval.outputEndMs > track.outputDurationMs) {
        ctx.addIssue({code: z.ZodIssueCode.custom, path: ["intervals", index], message: "Visual interval exceeds output duration."});
      }
      if (interval.assetId && !assetIds.has(interval.assetId)) {
        ctx.addIssue({code: z.ZodIssueCode.custom, path: ["intervals", index, "assetId"], message: "Visual interval references an undeclared asset."});
      }
      if (interval.secondaryAssetId && !assetIds.has(interval.secondaryAssetId)) {
        ctx.addIssue({code: z.ZodIssueCode.custom, path: ["intervals", index, "secondaryAssetId"], message: "Visual interval references an undeclared secondary asset."});
      }
      previousEnd = interval.outputEndMs;
    }
    if (previousEnd !== track.outputDurationMs) {
      ctx.addIssue({code: z.ZodIssueCode.custom, path: ["intervals"], message: "Visual intervals must cover the complete output duration."});
    }
    const assetById = new Map(track.assets.map((asset) => [asset.assetId, asset]));
    for (const [index, interval] of track.intervals.entries()) {
      const primary = interval.assetId ? assetById.get(interval.assetId) : undefined;
      const secondary = interval.secondaryAssetId ? assetById.get(interval.secondaryAssetId) : undefined;
      if (interval.mode === "b_roll" && primary?.mediaKind !== "video") {
        ctx.addIssue({code: z.ZodIssueCode.custom, path: ["intervals", index], message: "B-roll intervals require video media."});
      }
      if (interval.mode === "evidence_image" && primary?.mediaKind !== "image") {
        ctx.addIssue({code: z.ZodIssueCode.custom, path: ["intervals", index], message: "Evidence intervals require image media."});
      }
      if (interval.mode === "split_proof" && (primary?.assetId !== track.sourceAssetId || secondary?.mediaKind !== "image")) {
        ctx.addIssue({code: z.ZodIssueCode.custom, path: ["intervals", index], message: "Split proof requires the canonical speaker source and an evidence image."});
      }
      if (
        (interval.mode === "speaker_hero" || interval.mode === "quiet_hold") &&
        primary?.assetId !== track.sourceAssetId
      ) {
        ctx.addIssue({code: z.ZodIssueCode.custom, path: ["intervals", index], message: "Speaker and quiet-hold intervals require the canonical source."});
      }
      if (
        interval.mode === "b_roll" &&
        (primary?.durationMs === null ||
          (primary?.durationMs ?? 0) < interval.outputEndMs - interval.outputStartMs)
      ) {
        ctx.addIssue({code: z.ZodIssueCode.custom, path: ["intervals", index], message: "B-roll requires a measured duration that covers its output interval."});
      }
      if (
        primary?.assetId === track.sourceAssetId &&
        interval.sourceEndMs !== null &&
        primary.durationMs !== null &&
        interval.sourceEndMs > primary.durationMs
      ) {
        ctx.addIssue({code: z.ZodIssueCode.custom, path: ["intervals", index], message: "Source-backed visual interval exceeds source duration."});
      }
      if (primary && (!primary.rights.verified || !primary.rights.receiptId)) {
        ctx.addIssue({code: z.ZodIssueCode.custom, path: ["intervals", index], message: "Selected visual assets require verified rights."});
      }
      if (secondary && (!secondary.rights.verified || !secondary.rights.receiptId)) {
        ctx.addIssue({code: z.ZodIssueCode.custom, path: ["intervals", index], message: "Selected secondary visual assets require verified rights."});
      }
      if (primary && !primary.permittedRoles.includes(interval.mode)) {
        ctx.addIssue({code: z.ZodIssueCode.custom, path: ["intervals", index], message: "Selected asset is not permitted for this visual role."});
      }
      if (secondary && !secondary.permittedRoles.includes(interval.mode)) {
        ctx.addIssue({code: z.ZodIssueCode.custom, path: ["intervals", index], message: "Selected secondary asset is not permitted for this visual role."});
      }
    }
  });

export const maulTranscriptWordSchema = z
  .object({
    text: z.string(),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
    confidence: confidenceSchema,
  })
  .refine(({ startMs, endMs }) => endMs >= startMs, {
    message: "Transcript word endMs must not precede startMs",
  });

export const maulAnalysisPayloadSchema = z.object({
  sourceAssetId: idSchema,
  transcript: z.object({
    language: z.string().trim().min(1),
    text: z.string(),
    words: z.array(maulTranscriptWordSchema),
  }),
  voiceSpans: z.array(
    sourceRange({
      speakerId: idSchema.nullable(),
      confidence: confidenceSchema,
      detectionSource: z
        .string()
        .trim()
        .min(1)
        .optional()
        .default("timed_transcript"),
      verified: z.boolean().optional().default(false),
    }),
  ),
  silenceSpans: z.array(
    sourceRange({
      confidence: confidenceSchema,
      detectionSource: z
        .string()
        .trim()
        .min(1)
        .optional()
        .default("legacy_proxy"),
      verified: z.boolean().optional().default(false),
    }),
  ),
  shots: z.array(
    sourceRange({
      shotId: idSchema,
      confidence: confidenceSchema,
    }),
  ),
  speakerTracks: z.array(
    z.object({
      speakerId: idSchema,
      samples: z.array(
        z.object({
          sourceMs: z.number().int().nonnegative(),
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
          width: z.number().positive().max(1),
          height: z.number().positive().max(1),
          confidence: confidenceSchema,
        }),
      ),
    }),
  ),
  technicalFacts: z.record(z.unknown()),
});

export const maulTimestampMapSegmentSchema = z
  .object({
    sourceStartMs: z.number().int().nonnegative(),
    sourceEndMs: z.number().int().positive(),
    outputStartMs: z.number().int().nonnegative(),
    outputEndMs: z.number().int().nonnegative(),
    mode: z.enum(["keep", "cut", "protected_pause"]),
  })
  .superRefine((segment, ctx) => {
    if (segment.sourceEndMs <= segment.sourceStartMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid source interval",
      });
    }
    if (
      segment.mode === "cut" &&
      segment.outputEndMs !== segment.outputStartMs
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cut segments consume zero output time",
      });
    }
    if (
      segment.mode !== "cut" &&
      segment.outputEndMs <= segment.outputStartMs
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Kept segments consume positive output time",
      });
    }
  });

export const maulEditorialTimelinePayloadSchema = z
  .object({
    sourceAssetId: idSchema,
    analysisArtifactId: idSchema,
    sourceDurationMs: z.number().int().positive(),
    outputDurationMs: z.number().int().positive(),
    selectedClipWindows: z.array(sourceRangeSchema).min(1),
    cutCandidates: z.array(
      sourceRange({
        sentenceSafe: z.boolean(),
        reason: z.string().trim().min(1),
        confidence: confidenceSchema,
      }),
    ),
    protectedRanges: z.array(
      sourceRange({
        kind: z.enum([
          "rhetorical_pause",
          "emotional_pause",
          "comprehension_pause",
        ]),
        reason: z.string().trim().min(1),
      }),
    ),
    timestampMap: z.array(maulTimestampMapSegmentSchema).min(1),
    speakerCropTracks: z.array(
      z.object({
        speakerId: idSchema,
        outputStartMs: z.number().int().nonnegative(),
        outputEndMs: z.number().int().positive(),
        crop: z.object({
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
          width: z.number().positive().max(1),
          height: z.number().positive().max(1),
        }),
      }),
    ),
    editRationale: z.array(z.string().trim().min(1)),
    qualityWarnings: z.array(z.string().trim().min(1)),
  })
  .superRefine((timeline, ctx) => {
    for (let index = 1; index < timeline.timestampMap.length; index += 1) {
      const previous = timeline.timestampMap[index - 1];
      const current = timeline.timestampMap[index];
      if (
        previous &&
        current &&
        (current.sourceStartMs < previous.sourceEndMs ||
          current.outputStartMs < previous.outputEndMs)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "timestampMap must be ordered and non-overlapping",
          path: ["timestampMap", index],
        });
      }
    }
    const finalSegment =
      timeline.timestampMap[timeline.timestampMap.length - 1];
    if (
      finalSegment &&
      finalSegment.outputEndMs !== timeline.outputDurationMs
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "outputDurationMs must match timestampMap",
        path: ["outputDurationMs"],
      });
    }
  });

export const maulCandidatePayloadSchema = z
  .object({
    sourceAssetId: idSchema,
    timelineArtifactId: idSchema,
    rank: z.number().int().positive(),
    sourceStartMs: z.number().int().nonnegative(),
    sourceEndMs: z.number().int().positive(),
    title: z.string().trim().min(1),
    transcriptText: z.string().trim().min(1),
    scores: z.object({
      hookClarity: confidenceSchema,
      semanticCompletion: confidenceSchema,
      pacing: confidenceSchema,
      overall: confidenceSchema,
    }),
    qualityThresholdPassed: z.boolean(),
    insufficiencyReason: z.string().trim().min(1).nullable(),
  })
  .refine(({ sourceStartMs, sourceEndMs }) => sourceEndMs > sourceStartMs, {
    message: "Candidate sourceEndMs must be greater than sourceStartMs",
  })
  .refine(
    ({ qualityThresholdPassed, insufficiencyReason }) =>
      qualityThresholdPassed
        ? insufficiencyReason === null
        : insufficiencyReason !== null,
    { message: "Rejected candidates require an insufficiencyReason" },
  );

export const maulTreatmentGenomePayloadSchema = z
  .object({
    treatmentId: maulTreatmentIdSchema,
    timelineArtifactId: idSchema,
    catalogEntryName: z.string().trim().min(1),
    version: z.string().trim().min(1),
    replayKey: z.string().regex(/^[a-f0-9]{64}$/i),
    purpose: z.string().trim().min(1),
    targetViewerState: z.string().trim().min(1),
    grammar: z.object({
      hook: z.string().trim().min(1),
      escalation: z.string().trim().min(1),
      proof: z.string().trim().min(1),
      reveal: z.string().trim().min(1),
      payoff: z.string().trim().min(1),
      cta: z.string().trim().min(1),
    }),
    pacing: z.object({
      minCutsPerMinute: z.number().nonnegative(),
      maxCutsPerMinute: z.number().nonnegative(),
      protectedPausePolicy: z.string().trim().min(1),
    }),
    visualPolicy: z.record(z.unknown()),
    audioPolicy: z.record(z.unknown()),
    rendererInputs: z.object({
      framing: z.object({
        mode: z.enum(["speaker_first", "benefit_first", "clarity_first"]),
        safeZone: z.enum(["platform_ui_strict", "platform_ui_balanced"]),
        maxPunchInScale: z.number().min(1).max(1.5),
        speakerPriority: z.boolean(),
      }),
      caption: z.object({
        profile: z.enum([
          "authority_callout",
          "conversion_stack",
          "precision_minimal",
        ]),
        maxWordsPerCard: z.number().int().min(1).max(12),
        minFontScale: z.number().min(0.5).max(1.5),
        hierarchy: z.array(z.string().trim().min(1)).min(1),
        typographyGrammar: z.string().trim().min(1),
      }),
      motion: z.object({
        intensity: z.enum(["restrained", "energetic", "sparse"]),
        permittedPrimitives: z.array(z.string().trim().min(1)),
        permittedTransitions: z.array(z.string().trim().min(1)),
      }),
      bRoll: z.object({
        policy: z.string().trim().min(1),
        maxInsertsPerMinute: z.number().int().nonnegative(),
      }),
      audio: z.object({
        musicBehavior: z.string().trim().min(1),
        sfxBehavior: z.string().trim().min(1),
        duckingDb: z.number().max(0).min(-24),
      }),
    }),
    repetitionBudget: z.object({
      maxRepeatedPrimitivePerClip: z.number().int().positive(),
      maxRecentFeedReuse: z.number().int().nonnegative(),
      lookbackPosts: z.number().int().positive(),
    }),
    brandConstraints: z.array(z.string().trim().min(1)),
    accessibilityConstraints: z.array(z.string().trim().min(1)),
    prohibitedMotifs: z.array(z.string().trim().min(1)),
    referenceCorpusArtifactIds: z.array(idSchema),
    judgmentLayer: z.object({
      minimumWeightedScore: z.number().min(0).max(100),
      rubric: z
        .array(
          z.object({
            id: idSchema,
            label: z.string().trim().min(1),
            weight: z.number().positive(),
            minimumScore: z.number().min(0).max(100),
          }),
        )
        .min(5),
      failureClasses: z
        .array(
          z.object({
            id: idSchema,
            label: z.string().trim().min(1),
            description: z.string().trim().min(1),
            severity: z.enum(["blocking", "major", "minor"]),
          }),
        )
        .min(5),
    }),
    renderFallbacks: z.array(z.string().trim().min(1)).min(1),
    provenanceRules: z.array(z.string().trim().min(1)).min(1),
  })
  .refine(({ pacing }) => pacing.maxCutsPerMinute >= pacing.minCutsPerMinute, {
    message: "Maximum cut density must not be below minimum cut density",
  });

export const maulPlannerAuthorityClassSchema = z.enum([
  "deterministic",
  "invoked_model",
  "configured_not_invoked",
  "unavailable",
  "governed_fallback",
]);

export const maulPlannerInferenceReceiptSchema = z.object({
  requestReceiptId: idSchema,
  requestHash: z.string().regex(/^[a-f0-9]{64}$/i),
  responseHash: z.string().regex(/^[a-f0-9]{64}$/i),
  fieldsChanged: z.array(z.string().trim().min(1)).min(1),
});

export const maulPlannerAuditEntrySchema = z
  .object({
    stageId: idSchema,
    module: z.string().trim().min(1),
    moduleVersion: z.string().trim().min(1),
    authorityClass: maulPlannerAuthorityClassSchema,
    configured: z.boolean(),
    executed: z.boolean(),
    provider: z.string().trim().min(1).nullable(),
    model: z.string().trim().min(1).nullable(),
    reason: z.string().trim().min(1),
    decisionFields: z.array(z.string().trim().min(1)),
    limitations: z.array(z.string().trim().min(1)),
    inferenceReceipt: maulPlannerInferenceReceiptSchema.nullable(),
  })
  .superRefine((entry, ctx) => {
    if (
      entry.authorityClass === "invoked_model" &&
      (!entry.executed ||
        !entry.configured ||
        !entry.provider ||
        !entry.model ||
        !entry.inferenceReceipt)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Invoked model authority requires a configured provider/model and a complete inference receipt.",
      });
    }
    if (
      entry.authorityClass !== "invoked_model" &&
      entry.inferenceReceipt !== null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inferenceReceipt"],
        message:
          "Only genuinely invoked model authority may carry an inference receipt.",
      });
    }
    if (
      (entry.authorityClass === "configured_not_invoked" ||
        entry.authorityClass === "unavailable") &&
      entry.executed
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["executed"],
        message:
          "A configured-not-invoked or unavailable planner stage cannot be marked executed.",
      });
    }
  });

export const maulPlannerAuditPayloadSchema = z
  .object({
    schemaVersion: z.literal("maul-planner-audit/v1"),
    sourceAssetId: idSchema,
    analysisArtifactId: idSchema,
    timelineArtifactId: idSchema,
    candidateArtifactIds: z.array(idSchema).min(1),
    generatedAt: isoDateSchema,
    entries: z.array(maulPlannerAuditEntrySchema).min(4),
    summary: z.object({
      liveEditorialAuthority: z.literal("deterministic"),
      visualPlanningAuthority: z.enum([
        "unavailable",
        "governed_fallback",
        "invoked_model",
      ]),
      modelInvocationCount: z.number().int().nonnegative(),
      configuredNotInvokedCount: z.number().int().nonnegative(),
      unavailableAuthorityCount: z.number().int().nonnegative(),
      fakeInferenceLabelsBlocked: z.literal(true),
    }),
  })
  .superRefine((audit, ctx) => {
    const invokedCount = audit.entries.filter(
      (entry) => entry.authorityClass === "invoked_model",
    ).length;
    if (invokedCount !== audit.summary.modelInvocationCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["summary", "modelInvocationCount"],
        message:
          "Planner audit modelInvocationCount must equal entries with invoked model authority.",
      });
    }
  });

export const maulV1SourceScopeContractSchema = z.object({
  schemaVersion: z.literal("maul-v1-source-scope/v1"),
  acceptedModes: z.tuple([
    z.literal("single_speaker_talking_head"),
    z.literal("single_speaker_podcast"),
  ]),
  supportedPrimaryLanguages: z.tuple([z.literal("en")]),
  principalSpeakerCount: z.literal(1),
  requiresAudio: z.literal(true),
  requiresVideo: z.literal(true),
  excludedModes: z
    .array(
      z.enum([
        "multi_speaker_panel",
        "gameplay_first",
        "music_video_montage",
        "fiction_continuity",
      ]),
    )
    .length(4),
  unsupportedOutcome: z.literal("reject_before_upload"),
  postUploadVerificationRequired: z.literal(true),
});

export const maulS4DimensionIdSchema = z.enum([
  "editorial_selection_structure",
  "cuts_pauses_camera",
  "typography_writing_layout_motion",
  "subject_evidence_background_composition",
  "color_pipeline",
  "dialogue_music_sfx",
  "treatment_coherence_originality",
  "encoded_temporal_stability",
  "source_fidelity",
  "rights_provenance_auditability",
  "accessibility_intelligibility",
]);

export const maulS4ReleaseContractSchema = z.object({
  schemaVersion: z.literal("maul-s4-release-contract/v1"),
  displayLabel: z.literal("S4"),
  goldenCorpusTier: z.literal("elite"),
  derivedOnly: z.literal(true),
  goodOrNoExport: z.literal(true),
  technicalSuccessIsQualitySuccess: z.literal(false),
  zeroErrorsPromise: z.literal(false),
  minimumWeightedScore: z.literal(85),
  mandatoryDimensions: z.array(maulS4DimensionIdSchema).length(11),
  hardFailureIds: z.array(z.string().trim().min(1)).min(8),
  requiresAuthenticatedPostRenderHumanApproval: z.literal(true),
  sourceLimitationPreventsLabel: z.literal(true),
  minimumImplementationLabel: z.literal("held-out-reference-parity-passed"),
});

export const maulRuntimeContractsSchema = z.object({
  schemaVersion: z.literal("maul-runtime-contracts/v1"),
  sourceScope: maulV1SourceScopeContractSchema,
  s4: maulS4ReleaseContractSchema,
  plannerAuthority: z.object({
    maulLiveEditorialAuthority: z.literal("deterministic"),
    josephLiveEditorialAuthority: z.literal("deterministic_seeded"),
    textChunkingAuthority: z.literal(
      "model_assisted_with_deterministic_validation_and_fallback",
    ),
    textChunkingDecisionScope: z.literal(
      "semantic_boundaries_roles_and_emphasis_only",
    ),
    configuredRouteIsInvocation: z.literal(false),
    inferenceReceiptRequiredForModelAuthority: z.literal(true),
    currentVisualPlanningAuthority: z.literal("unavailable"),
    textPlacementAuthority: z.literal("deterministic_placement_planner"),
    rendererHandoffAuthority: z.literal("manifest_compiler"),
  }),
});
export const maulReferenceRightsStatusSchema = z.enum([
  "owned",
  "licensed",
  "publicly_analysable",
  "restricted",
  "rejected",
  "unknown",
]);

export const maulReferenceReviewStatusSchema = z.enum([
  "draft",
  "approved",
  "restricted",
  "rejected",
]);

export const maulReferenceAnnotationsSchema = z.object({
  hook: z.array(z.string().trim().min(1)),
  escalation: z.array(z.string().trim().min(1)),
  proof: z.array(z.string().trim().min(1)),
  reveal: z.array(z.string().trim().min(1)),
  payoff: z.array(z.string().trim().min(1)),
  cta: z.array(z.string().trim().min(1)),
  pauseBehavior: z.array(z.string().trim().min(1)),
});

export const maulReferenceTraitsSchema = z.object({
  pacing: z.array(z.string().trim().min(1)),
  framing: z.array(z.string().trim().min(1)),
  captions: z.array(z.string().trim().min(1)),
  typography: z.array(z.string().trim().min(1)),
  color: z.array(z.string().trim().min(1)),
  motion: z.array(z.string().trim().min(1)),
  bRoll: z.array(z.string().trim().min(1)),
  music: z.array(z.string().trim().min(1)),
  sfx: z.array(z.string().trim().min(1)),
});

export const maulReferenceMediaSchema = z.object({
  mediaType: z.enum(["video", "image", "motion_asset", "font", "brand_asset"]),
  durationMs: z.number().int().positive().nullable().optional().default(null),
  platform: z.string().trim().min(1).nullable().optional().default(null),
  language: z.string().trim().min(1).nullable().optional().default(null),
  sourceQuality: z.enum(["high", "medium", "low"]),
});

const maulReferenceUrlSourceSchema = z.object({
  kind: z.literal("url"),
  url: z.string().url(),
});

const maulReferenceFileSourceSchema = z.object({
  kind: z.literal("file"),
  suppliedFileId: idSchema,
  originalFilename: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
});

export const maulReferenceCorpusItemPayloadSchema = z
  .object({
    supersedesArtifactId: idSchema.nullable(),
    source: z.discriminatedUnion("kind", [
      maulReferenceUrlSourceSchema,
      maulReferenceFileSourceSchema,
    ]),
    rightsStatus: maulReferenceRightsStatusSchema,
    reviewStatus: maulReferenceReviewStatusSchema,
    attribution: z.string().trim().min(1).nullable(),
    media: maulReferenceMediaSchema,
    annotations: maulReferenceAnnotationsSchema,
    observedTraits: maulReferenceTraitsSchema,
    traitDraft: z.object({
      traits: maulReferenceTraitsSchema,
      confidence: confidenceSchema,
      extractorVersion: z.literal("maul-reference-traits/v1"),
    }),
    approvedTraits: maulReferenceTraitsSchema.nullable(),
    forbiddenElements: z.array(z.string().trim().min(1)),
    nonTransferableIdentityMarkers: z.array(z.string().trim().min(1)),
    reviewerId: idSchema.nullable(),
    reviewNotes: z.string().trim().min(1).nullable(),
    reviewedAt: isoDateSchema.nullable(),
  })
  .superRefine((reference, ctx) => {
    if (reference.reviewStatus === "approved" && !reference.approvedTraits) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["approvedTraits"],
        message: "Approved references require approvedTraits",
      });
    }
    if (reference.reviewStatus !== "draft" && !reference.reviewerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reviewerId"],
        message: "Reviewed references require a reviewerId",
      });
    }
  });

export const maulReferenceIngestRequestSchema = z.object({
  source: z.discriminatedUnion("kind", [
    maulReferenceUrlSourceSchema,
    z.object({
      kind: z.literal("file"),
      suppliedFileId: idSchema.optional(),
      originalFilename: z.string().trim().min(1).optional(),
      contentType: z.string().trim().min(1).optional(),
    }),
  ]),
  rightsStatus: maulReferenceRightsStatusSchema,
  attribution: z.string().trim().min(1).nullable().optional().default(null),
  media: maulReferenceMediaSchema,
  annotations: maulReferenceAnnotationsSchema,
  observedTraits: maulReferenceTraitsSchema,
  forbiddenElements: z.array(z.string().trim().min(1)).default([]),
  nonTransferableIdentityMarkers: z.array(z.string().trim().min(1)).default([]),
});

export const maulReferenceReviewRequestSchema = z.object({
  decision: z.enum(["approved", "restricted", "rejected"]),
  reviewerId: idSchema,
  notes: z.string().trim().min(1),
  approvedTraits: maulReferenceTraitsSchema.optional(),
  annotations: maulReferenceAnnotationsSchema.optional(),
});

const maulDetectedSilenceSpanSchema = sourceRange({
  confidence: confidenceSchema,
});

export const maulEditorialTimelineRequestSchema = z.object({
  transcript: z.object({
    language: z.string().trim().min(1),
    text: z.string(),
    words: z.array(maulTranscriptWordSchema).min(1),
  }),
  selectedWindow: sourceRangeSchema,
  vadEvidence: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("source_media"),
      sourcePath: z.string().trim().min(1),
      noiseThresholdDb: z.number().max(-1).min(-100).optional().default(-35),
      minimumSilenceMs: z
        .number()
        .int()
        .min(100)
        .max(5000)
        .optional()
        .default(250),
    }),
    z.object({
      kind: z.literal("detected_spans"),
      provider: z.enum(["webrtc_vad", "pyannote_vad", "manual_verified_vad"]),
      silenceSpans: z.array(maulDetectedSilenceSpanSchema),
    }),
  ]),
  speakerDetections: z
    .array(
      z.object({
        speakerId: idSchema,
        sourceMs: z.number().int().nonnegative(),
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        width: z.number().positive().max(1),
        height: z.number().positive().max(1),
        confidence: confidenceSchema,
      }),
    )
    .default([]),
  shots: z
    .array(
      sourceRange({
        shotId: idSchema,
        confidence: confidenceSchema,
      }),
    )
    .default([]),
});

export const maulTreatmentCatalogRequestSchema = z.object({
  timelineArtifactId: idSchema,
  referenceCorpusArtifactIds: z.array(idSchema).max(100).optional().default([]),
});

export const maulCandidateGenerationRequestSchema = z.object({
  timelineArtifactId: idSchema,
});

export const maulReviewDecisionRequestSchema = z.object({
  candidateArtifactId: idSchema,
  treatmentGenomeArtifactId: idSchema,
  planningBundleArtifactId: idSchema,
  perceptualTruthArtifactId: idSchema.nullable().optional().default(null),
  reviewerId: idSchema,
  decision: z.enum(["approved", "rejected", "changes_requested"]),
  failureClasses: z.array(idSchema).default([]),
  rationale: z.string().trim().min(1).nullable(),
  rubricScores: z.record(idSchema, z.number().min(0).max(100)),
});

const maulLicensedAudioAssetSchema = z.object({
  id: idSchema,
  storagePath: z.string().trim().min(1),
  licenseType: z.string().trim().min(1),
  commercialAllowed: z.boolean(),
  licenseVerified: z.boolean(),
  renderSafe: z.boolean(),
});

export const maulShortRenderRequestSchema = z.object({
  candidateArtifactId: idSchema,
  treatmentGenomeArtifactId: idSchema,
  planningBundleArtifactId: idSchema,
  reviewDecisionArtifactId: idSchema,
  musicTrack: maulLicensedAudioAssetSchema.extend({
    title: z.string().trim().min(1),
    artist: z.string().trim().min(1),
    durationSec: z.number().positive(),
  }),
  sfxAssets: z
    .array(
      maulLicensedAudioAssetSchema.extend({
        eventType: z.string().trim().min(1),
        sourceMs: z.number().int().nonnegative(),
      }),
    )
    .default([]),
});

export const maulRenderShortOperationPayloadSchema = z.object({
  timelineRequest: maulEditorialTimelineRequestSchema,
  musicTrack: maulLicensedAudioAssetSchema.extend({
    title: z.string().trim().min(1),
    artist: z.string().trim().min(1),
    durationSec: z.number().positive(),
  }),
  sfxAssets: z
    .array(
      maulLicensedAudioAssetSchema.extend({
        eventType: z.string().trim().min(1),
        sourceMs: z.number().int().nonnegative(),
      }),
    )
    .default([]),
  actualCostUsd: z.number().nonnegative(),
});

export const maulPlanExecutionStatusSchema = z.enum([
  "native",
  "governed_fallback",
  "blocked",
]);

export const maulPlanExecutionSchema = z
  .object({
    executionStatus: maulPlanExecutionStatusSchema,
    nativeBranch: z.string().trim().min(1).nullable(),
    fallback: z.string().trim().min(1).nullable(),
    evidenceRequirement: z.string().trim().min(1),
  })
  .superRefine((execution, ctx) => {
    if (execution.executionStatus === "native" && !execution.nativeBranch) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nativeBranch"],
        message: "Native plan execution requires an explicit renderer branch.",
      });
    }
    if (
      execution.executionStatus === "governed_fallback" &&
      !execution.fallback
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fallback"],
        message: "Governed fallback execution requires a named fallback.",
      });
    }
  });

const maulPlanBaseSchema = z.object({
  sourceAssetId: idSchema,
  analysisArtifactId: idSchema,
  timelineArtifactId: idSchema,
  candidateArtifactId: idSchema,
  treatmentGenomeArtifactId: idSchema,
  planVersion: z.string().trim().min(1),
  replayKey: z.string().regex(/^[a-f0-9]{64}$/i),
  authority: z.object({
    authorityClass: maulPlannerAuthorityClassSchema,
    stageId: idSchema,
    confidence: confidenceSchema,
    inferenceReceiptId: idSchema.nullable(),
  }),
  warnings: z.array(z.string().trim().min(1)),
  fallbacks: z
    .array(
      z.object({
        condition: z.string().trim().min(1),
        action: z.string().trim().min(1),
        status: z.enum(["available", "selected", "blocking"]),
      }),
    )
    .min(1),
});

export const maulTextChunkPlanPayloadSchema = maulPlanBaseSchema.and(
  maulShortsTextChunkPlanV2CoreSchema,
);

export const maulTextPlacementPlanPayloadSchema = maulPlanBaseSchema.and(
  maulTextPlacementPlanCoreSchema,
);

export const maulTextAnimationPlanPayloadSchema = maulPlanBaseSchema.and(
  maulTextAnimationPlanCoreSchema,
);

export const maulObservationSnapshotPayloadSchema = maulPlanBaseSchema.extend({
  schemaVersion: z.literal("maul-observation-snapshot/v1"),
  facts: z.object({
    language: z.string().trim().min(1),
    transcriptWordCount: z.number().int().nonnegative(),
    verifiedVoiceSpanCount: z.number().int().nonnegative(),
    verifiedSilenceSpanCount: z.number().int().nonnegative(),
    shotCount: z.number().int().nonnegative(),
    speakerTrackCount: z.number().int().nonnegative(),
    sourceDurationMs: z.number().int().positive(),
    sourceWidth: z.number().int().positive(),
    sourceHeight: z.number().int().positive(),
    sourceFps: z.number().positive(),
  }),
  unavailableSignals: z.array(
    z.enum([
      "prosody",
      "gesture",
      "motion",
      "source_quality_grade",
      "temporal_visual_probe",
    ]),
  ),
});

export const maulNarrativeRoleSchema = z.enum([
  "hook",
  "orientation",
  "escalation",
  "proof",
  "reveal",
  "payoff",
  "cta",
]);

export const maulCandidateNarrativePayloadSchema = maulPlanBaseSchema.extend({
  schemaVersion: z.literal("maul-candidate-narrative/v1"),
  coherentThesis: z.string().trim().min(1),
  segments: z
    .array(
      z
        .object({
          role: maulNarrativeRoleSchema,
          claim: z.string().trim().min(1),
          sourceStartMs: z.number().int().nonnegative(),
          sourceEndMs: z.number().int().positive(),
          sourceSupported: z.literal(true),
          transcriptWordStartIndex: z.number().int().nonnegative(),
          transcriptWordEndIndex: z.number().int().nonnegative(),
        })
        .refine((segment) => segment.sourceEndMs > segment.sourceStartMs, {
          message: "Narrative evidence range must have positive duration.",
        }),
    )
    .min(1),
  unsupportedClaims: z.array(z.string().trim().min(1)),
});

export const maulEditorialBeatMapPayloadSchema = maulPlanBaseSchema.extend({
  schemaVersion: z.literal("maul-editorial-beat-map/v1"),
  beats: z
    .array(
      z
        .object({
          beatId: idSchema,
          role: maulNarrativeRoleSchema,
          sourceStartMs: z.number().int().nonnegative(),
          sourceEndMs: z.number().int().positive(),
          outputStartMs: z.number().int().nonnegative(),
          outputEndMs: z.number().int().positive(),
          spokenIdea: z.string().trim().min(1),
          intensity: confidenceSchema,
          informationDensity: confidenceSchema,
          dominantFocus: z.enum([
            "speaker",
            "typography",
            "evidence",
            "deliberate_stillness",
          ]),
          allowedEvents: z.array(
            z.enum([
              "cut",
              "camera",
              "caption",
              "editorial_text",
              "visual",
              "music",
              "sfx",
            ]),
          ),
          protectedPause: z.boolean(),
          rationale: z.string().trim().min(1),
          confidence: confidenceSchema,
        })
        .superRefine((beat, ctx) => {
          if (
            beat.sourceEndMs <= beat.sourceStartMs ||
            beat.outputEndMs <= beat.outputStartMs
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Beat ranges must have positive duration.",
            });
          }
        }),
    )
    .min(1),
  sharedAttentionBudget: z.object({
    maxConcurrentDominantEvents: z.literal(1),
    collisionPolicy: z.string().trim().min(1),
  }),
});

export const maulRenderPreviewRequestSchema = maulShortRenderRequestSchema.omit({
  reviewDecisionArtifactId: true,
});

const maulTypographyMotionPlanCommonShape = {
  captionGroups: z.array(
    z.object({
      text: z.string().trim().min(1),
      outputStartMs: z.number().int().nonnegative(),
      outputEndMs: z.number().int().positive(),
      sourceGrounded: z.literal(true),
      role: z.literal("dialogue_caption"),
    }),
  ),
  editorialStatements: z.array(
    z.object({
      text: z.string().trim().min(1),
      role: z.enum(["hero", "support", "proof", "cta"]),
      sourceStartMs: z.number().int().nonnegative(),
      sourceEndMs: z.number().int().positive(),
    }),
  ),
  editorialTextWithheldReason: z.string().trim().min(1).nullable(),
  fontResolution: z.object({
    requestedRole: z.enum(["display", "editorial", "utility"]),
    selectedFamily: z.string().trim().min(1),
    selectedAssetId: idSchema.nullable(),
    selectedAsset: maulResolvedFontAssetSchema.nullable().default(null),
    accentAsset: maulResolvedFontAssetSchema.nullable().default(null),
    status: z.enum(["eligible_loaded", "governed_fallback", "blocked"]),
    reason: z.string().trim().min(1),
  }),
  measurementEvidenceIds: z.array(idSchema).default([]),
  motionPrograms: z.array(
    z.object({
      capabilityId: idSchema,
      semanticRole: z.string().trim().min(1),
      outputStartMs: z.number().int().nonnegative(),
      outputEndMs: z.number().int().positive(),
      execution: maulPlanExecutionSchema,
    }),
  ),
};

const maulTypographyMotionPlanV1ObjectSchema = maulPlanBaseSchema.extend({
  schemaVersion: z.literal("maul-typography-motion-plan/v1"),
  textChunkPlan: shortsTextChunkPlanSchema.nullable().default(null),
  textChunkAuthority: z
    .object({
      authorityClass: z.enum(["invoked_model", "governed_fallback"]),
      decisionScope: z.literal("semantic_boundaries_roles_and_emphasis_only"),
      decisionFields: z.tuple([
        z.literal("textChunkPlan.chunks[].startWordIndex"),
        z.literal("textChunkPlan.chunks[].endWordIndex"),
        z.literal("textChunkPlan.chunks[].semanticRole"),
        z.literal("textChunkPlan.chunks[].emphasis.wordIndices"),
        z.literal("textChunkPlan.chunks[].emphasis.level"),
      ]),
      inferenceReceiptPath: z.literal("textChunkPlan.inference"),
    })
    .nullable()
    .default(null),
  ...maulTypographyMotionPlanCommonShape,
});

const validateMaulTypographyMotionPlanV1 = (
  plan: z.infer<typeof maulTypographyMotionPlanV1ObjectSchema>,
  ctx: z.RefinementCtx,
) => {
    if (Boolean(plan.textChunkPlan) !== Boolean(plan.textChunkAuthority)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["textChunkAuthority"],
        message:
          "Text chunk plans require matching field-level authority disclosure.",
      });
    }
    if (
      plan.textChunkPlan &&
      plan.textChunkAuthority &&
      (plan.textChunkPlan.inference.status === "invoked") !==
        (plan.textChunkAuthority.authorityClass === "invoked_model")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["textChunkAuthority", "authorityClass"],
        message:
          "Text chunk authority must match the recorded inference status.",
      });
    }
    if (
      plan.editorialStatements.length === 0 &&
      !plan.editorialTextWithheldReason
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["editorialTextWithheldReason"],
        message: "Deliberate editorial-text absence requires a reason.",
      });
    }
};

const maulTypographyMotionPlanV2ObjectSchema = maulPlanBaseSchema.extend({
  schemaVersion: z.literal("maul-typography-motion-plan/v2"),
  textChunkPlanArtifactId: idSchema,
  textChunkPlanHash: z.string().regex(/^[a-f0-9]{64}$/i),
  textPlacementPlanArtifactId: idSchema,
  textPlacementPlanHash: z.string().regex(/^[a-f0-9]{64}$/i),
  ...maulTypographyMotionPlanCommonShape,
});

const maulTypographyMotionPlanV3ObjectSchema = maulPlanBaseSchema.extend({
  schemaVersion: z.literal("maul-typography-motion-plan/v3"),
  textChunkPlanArtifactId: idSchema,
  textChunkPlanHash: z.string().regex(/^[a-f0-9]{64}$/i),
  textPlacementPlanArtifactId: idSchema,
  textPlacementPlanHash: z.string().regex(/^[a-f0-9]{64}$/i),
  textAnimationPlanArtifactId: idSchema,
  textAnimationPlanHash: z.string().regex(/^[a-f0-9]{64}$/i),
  ...maulTypographyMotionPlanCommonShape,
});

const validateMaulTypographyMotionPlanV2 = (
  plan: {
    editorialStatements: Array<unknown>;
    editorialTextWithheldReason: string | null;
  },
  ctx: z.RefinementCtx,
) => {
  if (
    plan.editorialStatements.length === 0 &&
    !plan.editorialTextWithheldReason
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["editorialTextWithheldReason"],
      message: "Deliberate editorial-text absence requires a reason.",
    });
  }
};

export const maulTypographyMotionPlanV1PayloadSchema =
  maulTypographyMotionPlanV1ObjectSchema.superRefine(
    validateMaulTypographyMotionPlanV1,
  );

export const maulTypographyMotionPlanV2PayloadSchema =
  maulTypographyMotionPlanV2ObjectSchema.superRefine(
    validateMaulTypographyMotionPlanV2,
  );

export const maulTypographyMotionPlanV3PayloadSchema =
  maulTypographyMotionPlanV3ObjectSchema.superRefine(
    validateMaulTypographyMotionPlanV2,
  );

export const maulTypographyMotionPlanPayloadSchema = z
  .discriminatedUnion("schemaVersion", [
    maulTypographyMotionPlanV1ObjectSchema,
    maulTypographyMotionPlanV2ObjectSchema,
    maulTypographyMotionPlanV3ObjectSchema,
  ])
  .superRefine((plan, ctx) => {
    if (plan.schemaVersion === "maul-typography-motion-plan/v1") {
      validateMaulTypographyMotionPlanV1(plan, ctx);
      return;
    }
    validateMaulTypographyMotionPlanV2(plan, ctx);
  });

export const maulFramingCameraPlanPayloadSchema = maulPlanBaseSchema.extend({
  schemaVersion: z.literal("maul-framing-camera-plan/v1"),
  events: z
    .array(
      z.object({
        eventId: idSchema,
        outputStartMs: z.number().int().nonnegative(),
        outputEndMs: z.number().int().positive(),
        cropCenterX: z.number().min(0).max(1),
        cropCenterY: z.number().min(0).max(1),
        startScale: z.number().min(1).max(1.5),
        endScale: z.number().min(1).max(1.5),
        motivatedByBeatId: idSchema,
        rationale: z.string().trim().min(1),
        execution: maulPlanExecutionSchema,
      }),
    )
    .min(1),
  continuityPolicy: z.string().trim().min(1),
  maxScale: z.number().min(1).max(1.5),
});

export const maulVisualPlanPayloadSchema = maulPlanBaseSchema.extend({
  schemaVersion: z.literal("maul-visual-plan/v1"),
  visualTrack: maulVisualTrackSchema.optional(),
  scenes: z
    .array(
      z.object({
        sceneId: idSchema,
        outputStartMs: z.number().int().nonnegative(),
        outputEndMs: z.number().int().positive(),
        mode: z.enum([
          "speaker_only",
          "speaker_with_evidence",
          "b_roll",
          "diagram",
          "brand",
        ]),
        purpose: z.string().trim().min(1),
        assetArtifactId: idSchema.nullable(),
        provenanceStatus: z.enum([
          "source",
          "licensed",
          "not_required",
          "unavailable",
        ]),
        referencePixelsExcluded: z.literal(true),
        execution: maulPlanExecutionSchema,
      }),
    )
    .min(1),
  neededButUnavailable: z.array(z.string().trim().min(1)),
});

export const maulDialogueAudioPlanPayloadSchema = maulPlanBaseSchema.extend({
  schemaVersion: z.literal("maul-dialogue-audio-plan/v1"),
  dialoguePriority: z.literal(true),
  targetLufs: z.number().min(-24).max(-8),
  musicPolicy: z.string().trim().min(1),
  duckingDb: z.number().max(0).min(-24),
  sfxIntents: z.array(
    z.object({
      eventType: z.string().trim().min(1),
      sourceMs: z.number().int().nonnegative(),
      beatReason: z.string().trim().min(1),
    }),
  ),
  execution: maulPlanExecutionSchema,
});

export const maulCapabilitySelectionPayloadSchema = maulPlanBaseSchema
  .extend({
    schemaVersion: z.literal("maul-capability-selection/v1"),
    selections: z
      .array(
        z.object({
          capabilityId: idSchema,
          semanticRole: z.string().trim().min(1),
          selected: z.boolean(),
          execution: maulPlanExecutionSchema,
        }),
      )
      .min(1),
    unknownCapabilityIds: z.array(idSchema),
  })
  .refine((plan) => plan.unknownCapabilityIds.length === 0, {
    message: "Unknown capabilities fail closed.",
  });

export const maulAdapterDecisionPayloadSchema = maulPlanBaseSchema.extend({
  schemaVersion: z.literal("maul-adapter-decision/v1"),
  adapterId: z.literal("maul-portrait-format-adapter/v1"),
  platform: maulPlatformSchema,
  canvas: z.object({
    width: z.literal(1080),
    height: z.literal(1920),
    fps: z.literal(30),
  }),
  safeRegion: z.object({
    topPx: z.number().int().nonnegative(),
    rightPx: z.number().int().nonnegative(),
    bottomPx: z.number().int().nonnegative(),
    leftPx: z.number().int().nonnegative(),
  }),
  preservedIntent: z.array(z.string().trim().min(1)).min(1),
  adaptedConstraints: z
    .array(
      z.object({
        field: z.string().trim().min(1),
        from: z.string().trim().min(1),
        to: z.string().trim().min(1),
        reason: z.string().trim().min(1),
      }),
    )
    .min(1),
  silentIntentMutations: z.tuple([]),
});

export const maulCreativeTreatmentProposalSchema = z.object({
  schemaVersion: z.literal('maul-creative-treatment-proposal/v1'),
  profileId: z.literal('aspire_visual_hook'),
  compositionDirection: z.enum([
    'editorial_asymmetry',
    'poster_hero',
    'subject_integrated',
    'restrained_minimal',
  ]),
  primaryTypeRole: z.enum(['neutral_grotesk', 'editorial_display']),
  accentTypeRole: z.enum(['editorial_italic', 'neutral_grotesk']),
  palette: z.object({
    primary: z.string().regex(/^#[a-f0-9]{6}$/i),
    accent: z.string().regex(/^#[a-f0-9]{6}$/i),
    sourceTreatment: z.enum([
      'dark_warm_cool_contrast',
      'source_neutral',
      'high_contrast_monochrome',
    ]),
  }),
  sourceTreatmentProfileId: z.enum(['subject_focus_grade_v1']).nullable().default(null),
  textDensity: z.enum(['low', 'medium', 'high']),
  emphasisMode: z.enum([
    'selective_accent_phrase',
    'scale_contrast',
    'editorial_italic_hinge',
  ]),
  motionMode: z.enum([
    'restrained_phrase_lockup',
    'soft_scale_settle',
    'static_editorial_hold',
  ]),
  rationale: z.array(z.string().trim().min(1)).min(1).max(6),
}).strict();

export const maulCreativeTreatmentInferenceSchema = z.object({
  status: z.enum([
    'invoked',
    'skipped_missing_credentials',
    'failed_request',
    'failed_invalid_response',
  ]),
  provider: z.literal('openai_compatible'),
  model: z.string().trim().min(1),
  reasoningEffort: z.enum(['medium', 'high']),
  requestHash: z.string().regex(/^[a-f0-9]{64}$/i).nullable(),
  responseHash: z.string().regex(/^[a-f0-9]{64}$/i).nullable(),
  inferenceReceiptId: idSchema.nullable(),
  fallbackReason: z.string().trim().min(1).nullable(),
}).superRefine((receipt, context) => {
  if (receipt.status === 'invoked') {
    if (!receipt.requestHash || !receipt.responseHash || !receipt.inferenceReceiptId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invoked creative treatment requires hashes and an inference receipt.',
      });
    }
    if (receipt.fallbackReason !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invoked creative treatment cannot declare a fallback reason.',
      });
    }
  } else if (!receipt.fallbackReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Creative treatment fallback requires a reason.',
    });
  }
});

export const maulReferenceEditorialRhythmProgramSchema = z.object({
  schemaVersion: z.literal('maul-reference-editorial-rhythm/v1'),
  fontSystemId: z.enum([
    'grotesk_editorial_hinge',
    'condensed_kinetic_hinge',
    'serif_editorial_hinge',
  ]),
  traitReceipt: z.array(z.enum([
    'cut_led_tempo',
    'deliberate_readable_holds',
    'editorial_serif_hinge',
    'phrase_hierarchy',
    'semantic_hinge_emphasis',
  ])).max(5),
}).strict();

export type MaulReferenceEditorialRhythmProgram = z.infer<
  typeof maulReferenceEditorialRhythmProgramSchema
>;

export const maulArtDirectionPlanPayloadSchema = maulPlanBaseSchema.extend({
  schemaVersion: z.literal("maul-art-direction-plan/v1"),
  authorityReceipt: z
    .object({
      directorId: z.literal("joseph"),
      version: z.literal("maul-joseph-editorial-director/v1"),
      doctrineId: z.string().trim().min(1),
      inputHash: z.string().regex(/^[a-f0-9]{64}$/i),
    })
    .nullable()
    .default(null),
  creativeTreatment: maulCreativeTreatmentProposalSchema.default({
    schemaVersion: 'maul-creative-treatment-proposal/v1',
    profileId: 'aspire_visual_hook',
    compositionDirection: 'subject_integrated',
    primaryTypeRole: 'neutral_grotesk',
    accentTypeRole: 'editorial_italic',
    palette: {
      primary: '#F7F3EA',
      accent: '#F06424',
      sourceTreatment: 'dark_warm_cool_contrast',
    },
    sourceTreatmentProfileId: null,
    textDensity: 'medium',
    emphasisMode: 'selective_accent_phrase',
    motionMode: 'restrained_phrase_lockup',
    rationale: ['Legacy Aspire visual-hook fallback.'],
  }),
  creativeTreatmentInference: maulCreativeTreatmentInferenceSchema.default({
    status: 'skipped_missing_credentials',
    provider: 'openai_compatible',
    model: 'unavailable',
    reasoningEffort: 'high',
    requestHash: null,
    responseHash: null,
    inferenceReceiptId: null,
    fallbackReason: 'No creative-treatment planner ran for this legacy plan.',
  }),
  referenceEditorialRhythm: maulReferenceEditorialRhythmProgramSchema.default({
    schemaVersion: 'maul-reference-editorial-rhythm/v1',
    fontSystemId: 'grotesk_editorial_hinge',
    traitReceipt: [],
  }),
  visualBeats: z
    .array(
      z.object({
        beatId: idSchema,
        startMs: z.number().int().nonnegative(),
        endMs: z.number().int().positive(),
        purpose: z.enum([
          "HOOK",
          "SETUP",
          "TENSION",
          "REVEAL",
          "ESCALATION",
          "PAYOFF",
        ]),
      }).refine((beat) => beat.endMs > beat.startMs, {
        message: "Visual beats require positive duration.",
      }),
    )
    .default([]),
  sceneEvidence: z
    .object({
      status: z.enum(["available", "unavailable"]),
      providerId: z.string().trim().min(1),
      holdCount: z.number().int().nonnegative(),
      reason: z.string().trim().min(1).nullable(),
    })
    .default({
      status: "unavailable",
      providerId: "unavailable",
      holdCount: 0,
      reason: "No visual evidence provider ran for this legacy plan.",
    }),
  audienceIntent: z.string().trim().min(1),
  emotionalTemperature: z.enum([
    "warm_intimate",
    "urgent_confident",
    "calm_authoritative",
  ]),
  sourceRespectStance: z.string().trim().min(1),
  theme: z.string().trim().min(1),
  paletteIntent: z.array(z.string().trim().min(1)).min(2),
  typeRoles: z
    .array(
      z.object({
        role: z.string().trim().min(1),
        intent: z.string().trim().min(1),
      }),
    )
    .min(2),
  layoutAndNegativeSpaceLogic: z.string().trim().min(1),
  imageryAndBackgroundLanguage: z.string().trim().min(1),
  cameraBehavior: z.string().trim().min(1),
  motionPhysics: z.string().trim().min(1),
  annotationGrammar: z.string().trim().min(1),
  soundWorld: z.string().trim().min(1),
  motifArc: z.object({
    introduction: z.string().trim().min(1),
    development: z.string().trim().min(1),
    recall: z.string().trim().min(1),
  }),
  treatmentVariation: z.string().trim().min(1),
  explicitProhibitions: z.array(z.string().trim().min(1)).min(1),
});

export const maulContextAssemblyPlanPayloadSchema = maulPlanBaseSchema.extend({
  schemaVersion: z.literal("maul-context-assembly-plan/v1"),
  wholeSourceSynopsis: z.string().trim().min(1),
  narrativePhases: z
    .array(
      z.object({
        phase: z.string().trim().min(1),
        sourceStartMs: z.number().int().nonnegative(),
        sourceEndMs: z.number().int().positive(),
        summary: z.string().trim().min(1),
      }),
    )
    .min(1),
  candidateNeighborhood: z.object({
    sourceStartMs: z.number().int().nonnegative(),
    sourceEndMs: z.number().int().positive(),
    precedingContext: z.string(),
    followingContext: z.string(),
  }),
  localTranscript: z.string().trim().min(1),
  namedFacts: z.array(z.string().trim().min(1)),
  callbacks: z.array(z.string().trim().min(1)),
  setupPayoffDependencies: z.array(z.string().trim().min(1)),
  chronologyConstraints: z.array(z.string().trim().min(1)),
  sourceQualityChanges: z.array(z.string().trim().min(1)),
  unresolvedUncertainty: z.array(z.string().trim().min(1)),
  omissionReports: z.array(
    z.object({
      contextClass: z.string().trim().min(1),
      reason: z.string().trim().min(1),
      effect: z.enum(["none", "degraded_authority", "blocking"]),
    }),
  ),
});

export const maulShotIntentMatrixPayloadSchema = maulPlanBaseSchema.extend({
  schemaVersion: z.literal("maul-shot-intent-matrix/v1"),
  shots: z
    .array(
      z
        .object({
          shotId: idSchema,
          sourceStartMs: z.number().int().nonnegative(),
          sourceEndMs: z.number().int().positive(),
          outputStartMs: z.number().int().nonnegative(),
          outputEndMs: z.number().int().positive(),
          editorialPurpose: z.string().trim().min(1),
          rhetoricalRole: maulNarrativeRoleSchema,
          inReason: z.string().trim().min(1),
          outReason: z.string().trim().min(1),
          continuityRelationship: z.string().trim().min(1),
          screenDirection: z.enum([
            "stable",
            "left_to_right",
            "right_to_left",
            "unknown",
          ]),
          poseAndGestureState: z.string().trim().min(1),
          eyeLine: z.enum([
            "camera",
            "off_camera_left",
            "off_camera_right",
            "unknown",
          ]),
          cropAndCameraTarget: z.string().trim().min(1),
          evidenceBackgroundDockingState: z.string().trim().min(1),
          textOpportunityId: idSchema,
          audioHandlesMs: z.object({
            pre: z.number().int().nonnegative(),
            post: z.number().int().nonnegative(),
          }),
          colorMatchIntent: z.string().trim().min(1),
          transition: z.string().trim().min(1),
          confidence: confidenceSchema,
          fallback: z.string().trim().min(1),
        })
        .superRefine((shot, ctx) => {
          if (
            shot.sourceEndMs <= shot.sourceStartMs ||
            shot.outputEndMs <= shot.outputStartMs
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Shot intent ranges must have positive duration.",
            });
          }
        }),
    )
    .min(1),
  implementationSegmentsAreShots: z.literal(false),
});

export const maulTextOpportunityPlanPayloadSchema = maulPlanBaseSchema
  .extend({
    schemaVersion: z.literal("maul-text-opportunity-plan/v1"),
    opportunities: z
      .array(
        z.object({
          opportunityId: idSchema,
          beatId: idSchema,
          kind: z.enum([
            "dialogue_caption",
            "editorial_hero",
            "editorial_support",
            "proof",
            "annotation",
            "utility",
            "cta",
            "deliberate_absence",
          ]),
          communicationBenefit: z.string().trim().min(1),
          sourceSupport: z.string().trim().min(1),
          viewerReadingLoad: confidenceSchema,
          availableNegativeSpace: z.enum(["low", "medium", "high", "unknown"]),
          subjectOcclusionRisk: z.enum(["low", "medium", "high", "unknown"]),
          speechRate: z.enum(["slow", "moderate", "rapid", "unknown"]),
          concurrentImagery: z.string().trim().min(1),
          durationMs: z.number().int().positive(),
          hierarchyOwner: z.enum([
            "speaker",
            "caption",
            "editorial_text",
            "evidence",
            "none",
          ]),
          decision: z.enum(["use", "withhold"]),
          rationale: z.string().trim().min(1),
        }),
      )
      .min(1),
    quotaUsed: z.literal(false),
  })
  .superRefine((plan, ctx) => {
    plan.opportunities.forEach((opportunity, index) => {
      if (
        opportunity.kind === "deliberate_absence" &&
        opportunity.decision !== "withhold"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["opportunities", index, "decision"],
          message: "Deliberate text absence must be withheld.",
        });
      }
    });
  });

export const maulRevisionPlanPayloadSchema = maulPlanBaseSchema.extend({
  schemaVersion: z.literal("maul-revision-plan/v1"),
  immutableFields: z.array(z.string().trim().min(1)).min(1),
  allowedMutations: z.array(z.string().trim().min(1)).min(1),
  repairOptions: z
    .array(
      z.object({
        failureClass: z.string().trim().min(1),
        permittedAction: z.string().trim().min(1),
        affectedGates: z.array(z.string().trim().min(1)).min(1),
      }),
    )
    .min(1),
  maximumAttempts: z.number().int().min(1).max(5),
  maximumWallClockMs: z.number().int().positive(),
  maximumCostUsd: z.number().nonnegative(),
  criticMustBeIndependent: z.literal(true),
  noProgressDetection: z.string().trim().min(1),
  oscillationDetection: z.string().trim().min(1),
  humanCheckpoint: z.string().trim().min(1),
  stopReasons: z.array(z.string().trim().min(1)).min(1),
  thresholdReductionAllowed: z.literal(false),
});
export const maulPlanningArtifactIdsSchema = z.object({
  observationSnapshot: idSchema,
  candidateNarrative: idSchema,
  beatMap: idSchema,
  typographyMotion: idSchema,
  camera: idSchema,
  visual: idSchema,
  audio: idSchema,
  capabilitySelection: idSchema,
  adapterDecision: idSchema,
  artDirection: idSchema,
  contextAssembly: idSchema,
  shotIntentMatrix: idSchema,
  textOpportunity: idSchema,
  revision: idSchema,
});

export const maulPlanningArtifactIdsV1Schema = maulPlanningArtifactIdsSchema;

export const maulPlanningArtifactIdsV2Schema = maulPlanningArtifactIdsSchema
  .extend({
    textChunk: idSchema,
    textPlacement: idSchema,
  })
  .strict();

export const maulPlanningArtifactIdsV3Schema =
  maulPlanningArtifactIdsV2Schema.extend({
    textAnimation: idSchema,
  }).superRefine((artifactIds, ctx) => {
    const ids = Object.values(artifactIds);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "V3 planning artifact IDs must be unique across all 17 slots.",
      });
    }
  });

const maulPlanningBundleCommonShape = {
  rendererReadiness: z.enum([
    "governed_with_explicit_fallbacks",
    "blocked",
  ]),
  blockingReasons: z.array(z.string().trim().min(1)),
};

const maulPlanningBundleV1ObjectSchema = maulPlanBaseSchema.extend({
  schemaVersion: z.literal("maul-planning-bundle/v1"),
  planArtifactIds: maulPlanningArtifactIdsV1Schema,
  ...maulPlanningBundleCommonShape,
});

const maulPlanningBundleV2ObjectSchema = maulPlanBaseSchema.extend({
  schemaVersion: z.literal("maul-planning-bundle/v2"),
  planArtifactIds: maulPlanningArtifactIdsV2Schema,
  ...maulPlanningBundleCommonShape,
});

const maulPlanningBundleV3ObjectSchema = maulPlanBaseSchema.extend({
  schemaVersion: z.literal("maul-planning-bundle/v3"),
  planArtifactIds: maulPlanningArtifactIdsV3Schema,
  ...maulPlanningBundleCommonShape,
});

const validateMaulPlanningBundle = (
  bundle: {
    rendererReadiness: "governed_with_explicit_fallbacks" | "blocked";
    blockingReasons: string[];
  },
  ctx: z.RefinementCtx,
) => {
    if (
      bundle.rendererReadiness === "blocked" &&
      bundle.blockingReasons.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["blockingReasons"],
        message: "Blocked planning bundles require reasons.",
      });
    }
    if (
      bundle.rendererReadiness !== "blocked" &&
      bundle.blockingReasons.length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["blockingReasons"],
        message: "Ready planning bundles cannot carry blocking reasons.",
      });
    }
};

export const maulPlanningBundleV1PayloadSchema =
  maulPlanningBundleV1ObjectSchema.superRefine(validateMaulPlanningBundle);

export const maulPlanningBundleV2PayloadSchema =
  maulPlanningBundleV2ObjectSchema.superRefine(validateMaulPlanningBundle);

export const maulPlanningBundleV3PayloadSchema =
  maulPlanningBundleV3ObjectSchema.superRefine(validateMaulPlanningBundle);

export const maulPlanningBundlePayloadSchema = z
  .discriminatedUnion("schemaVersion", [
    maulPlanningBundleV1ObjectSchema,
    maulPlanningBundleV2ObjectSchema,
    maulPlanningBundleV3ObjectSchema,
  ])
  .superRefine(validateMaulPlanningBundle);

export const maulPlanningBundleRequestSchema = z.object({
  candidateArtifactId: idSchema,
  treatmentGenomeArtifactId: idSchema,
  visualAssetPack: maulVisualAssetPackSchema.nullable().optional().default(null),
});

const maulUnifiedShortRenderManifestV1ObjectSchema = z.object({
    schemaVersion: z.literal("maul-unified-short-render-manifest/v1"),
    rendererInputKind: z.literal("unified_short_render_manifest_only"),
    planningBundleArtifactId: idSchema,
    planArtifactIds: maulPlanningArtifactIdsV1Schema,
    source: z.object({
      sourceAssetId: idSchema,
      storagePath: z.string().trim().min(1),
      sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    }),
    timeline: maulEditorialTimelinePayloadSchema,
    treatment: maulTreatmentGenomePayloadSchema,
    captions: z.array(
      z.object({
        text: z.string(),
        startMs: z.number().int().nonnegative(),
        endMs: z.number().int().nonnegative(),
        timestampMs: z.number().int().nonnegative().nullable(),
        confidence: confidenceSchema.nullable(),
      }),
    ),
    audio: z.object({
      planId: idSchema,
      planMode: z.literal("render_ready"),
      musicTrack: maulLicensedAudioAssetSchema.extend({
        title: z.string().trim().min(1),
        artist: z.string().trim().min(1),
        durationSec: z.number().positive(),
      }),
      sfxAssets: z.array(
        maulLicensedAudioAssetSchema.extend({
          eventType: z.string().trim().min(1),
          outputMs: z.number().int().nonnegative(),
        }),
      ),
    }),
    plans: z.object({
      observationSnapshot: maulObservationSnapshotPayloadSchema,
      candidateNarrative: maulCandidateNarrativePayloadSchema,
      beatMap: maulEditorialBeatMapPayloadSchema,
      typographyMotion: maulTypographyMotionPlanV1PayloadSchema,
      camera: maulFramingCameraPlanPayloadSchema,
      visual: maulVisualPlanPayloadSchema,
      audio: maulDialogueAudioPlanPayloadSchema,
      capabilitySelection: maulCapabilitySelectionPayloadSchema,
      adapterDecision: maulAdapterDecisionPayloadSchema,
      artDirection: maulArtDirectionPlanPayloadSchema,
      contextAssembly: maulContextAssemblyPlanPayloadSchema,
      shotIntentMatrix: maulShotIntentMatrixPayloadSchema,
      textOpportunity: maulTextOpportunityPlanPayloadSchema,
      revision: maulRevisionPlanPayloadSchema,
    }),
    planExecution: z
      .array(
        z.object({
          planArtifactId: idSchema,
          planType: z.enum([
            "observation_snapshot",
            "candidate_narrative",
            "editorial_beat_map",
            "typography_motion_plan",
            "framing_camera_plan",
            "visual_plan",
            "dialogue_audio_plan",
            "capability_selection",
            "adapter_decision",
            "art_direction_plan",
            "context_assembly_plan",
            "shot_intent_matrix",
            "text_opportunity_plan",
            "revision_plan",
          ]),
          executionStatus: z.enum(["native", "governed_fallback"]),
          nativeBranch: z.string().trim().min(1).nullable(),
          fallback: z.string().trim().min(1).nullable(),
        }),
      )
      .length(14),
    output: z.object({
      width: z.literal(1080),
      height: z.literal(1920),
      fps: z.literal(30),
      codec: z.literal("h264"),
    }),
    replayKey: z.string().regex(/^[a-f0-9]{64}$/i),
    createdAt: isoDateSchema,
  });

const maulUnifiedShortRenderManifestV2ObjectSchema =
  maulUnifiedShortRenderManifestV1ObjectSchema.extend({
    schemaVersion: z.literal("maul-unified-short-render-manifest/v2"),
    planArtifactIds: maulPlanningArtifactIdsV2Schema,
    plans: z.object({
      observationSnapshot: maulObservationSnapshotPayloadSchema,
      candidateNarrative: maulCandidateNarrativePayloadSchema,
      beatMap: maulEditorialBeatMapPayloadSchema,
      typographyMotion: maulTypographyMotionPlanV2PayloadSchema,
      camera: maulFramingCameraPlanPayloadSchema,
      visual: maulVisualPlanPayloadSchema,
      audio: maulDialogueAudioPlanPayloadSchema,
      capabilitySelection: maulCapabilitySelectionPayloadSchema,
      adapterDecision: maulAdapterDecisionPayloadSchema,
      artDirection: maulArtDirectionPlanPayloadSchema,
      contextAssembly: maulContextAssemblyPlanPayloadSchema,
      shotIntentMatrix: maulShotIntentMatrixPayloadSchema,
      textOpportunity: maulTextOpportunityPlanPayloadSchema,
      revision: maulRevisionPlanPayloadSchema,
      textChunk: maulTextChunkPlanPayloadSchema,
      textPlacement: maulTextPlacementPlanPayloadSchema,
    }),
    planExecution: z
      .array(
        z.object({
          planArtifactId: idSchema,
          planType: z.enum([
            "observation_snapshot",
            "candidate_narrative",
            "editorial_beat_map",
            "typography_motion_plan",
            "framing_camera_plan",
            "visual_plan",
            "dialogue_audio_plan",
            "capability_selection",
            "adapter_decision",
            "art_direction_plan",
            "context_assembly_plan",
            "shot_intent_matrix",
            "text_opportunity_plan",
            "revision_plan",
            "text_chunk_plan",
            "text_placement_plan",
          ]),
          executionStatus: z.enum(["native", "governed_fallback"]),
          nativeBranch: z.string().trim().min(1).nullable(),
          fallback: z.string().trim().min(1).nullable(),
        }),
      )
      .length(16),
  });

const maulUnifiedShortRenderManifestV3ObjectSchema =
  maulUnifiedShortRenderManifestV2ObjectSchema.extend({
    schemaVersion: z.literal("maul-unified-short-render-manifest/v3"),
    planArtifactIds: maulPlanningArtifactIdsV3Schema,
    plans: z.object({
      observationSnapshot: maulObservationSnapshotPayloadSchema,
      candidateNarrative: maulCandidateNarrativePayloadSchema,
      beatMap: maulEditorialBeatMapPayloadSchema,
      typographyMotion: maulTypographyMotionPlanV3PayloadSchema,
      camera: maulFramingCameraPlanPayloadSchema,
      visual: maulVisualPlanPayloadSchema,
      audio: maulDialogueAudioPlanPayloadSchema,
      capabilitySelection: maulCapabilitySelectionPayloadSchema,
      adapterDecision: maulAdapterDecisionPayloadSchema,
      artDirection: maulArtDirectionPlanPayloadSchema,
      contextAssembly: maulContextAssemblyPlanPayloadSchema,
      shotIntentMatrix: maulShotIntentMatrixPayloadSchema,
      textOpportunity: maulTextOpportunityPlanPayloadSchema,
      revision: maulRevisionPlanPayloadSchema,
      textChunk: maulTextChunkPlanPayloadSchema,
      textPlacement: maulTextPlacementPlanPayloadSchema,
      textAnimation: maulTextAnimationPlanPayloadSchema,
    }),
    planExecution: z
      .array(
        z.object({
          planArtifactId: idSchema,
          planType: z.enum([
            "observation_snapshot",
            "candidate_narrative",
            "editorial_beat_map",
            "typography_motion_plan",
            "framing_camera_plan",
            "visual_plan",
            "dialogue_audio_plan",
            "capability_selection",
            "adapter_decision",
            "art_direction_plan",
            "context_assembly_plan",
            "shot_intent_matrix",
            "text_opportunity_plan",
            "revision_plan",
            "text_chunk_plan",
            "text_placement_plan",
            "text_animation_plan",
          ]),
          executionStatus: z.enum(["native", "governed_fallback"]),
          nativeBranch: z.string().trim().min(1).nullable(),
          fallback: z.string().trim().min(1).nullable(),
        }),
      )
      .length(17),
  });

type MaulUnifiedShortRenderManifestCandidate =
  | z.infer<typeof maulUnifiedShortRenderManifestV1ObjectSchema>
  | z.infer<typeof maulUnifiedShortRenderManifestV2ObjectSchema>
  | z.infer<typeof maulUnifiedShortRenderManifestV3ObjectSchema>;

const validateMaulUnifiedShortRenderManifest = (
  manifest: MaulUnifiedShortRenderManifestCandidate,
  ctx: z.RefinementCtx,
) => {
    manifest.planExecution.forEach((entry, index) => {
      if (entry.executionStatus === "native" && !entry.nativeBranch) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["planExecution", index, "nativeBranch"],
          message: "Native plan execution requires a renderer branch.",
        });
      }
      if (entry.executionStatus === "governed_fallback" && !entry.fallback) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["planExecution", index, "fallback"],
          message: "Governed plan fallback requires a named fallback.",
        });
      }
    });
    const expectedPlanIds: Record<string, string> = {
      observation_snapshot: manifest.planArtifactIds.observationSnapshot,
      candidate_narrative: manifest.planArtifactIds.candidateNarrative,
      editorial_beat_map: manifest.planArtifactIds.beatMap,
      typography_motion_plan: manifest.planArtifactIds.typographyMotion,
      framing_camera_plan: manifest.planArtifactIds.camera,
      visual_plan: manifest.planArtifactIds.visual,
      dialogue_audio_plan: manifest.planArtifactIds.audio,
      capability_selection: manifest.planArtifactIds.capabilitySelection,
      adapter_decision: manifest.planArtifactIds.adapterDecision,
      art_direction_plan: manifest.planArtifactIds.artDirection,
      context_assembly_plan: manifest.planArtifactIds.contextAssembly,
      shot_intent_matrix: manifest.planArtifactIds.shotIntentMatrix,
      text_opportunity_plan: manifest.planArtifactIds.textOpportunity,
      revision_plan: manifest.planArtifactIds.revision,
    };
    if (manifest.schemaVersion !== "maul-unified-short-render-manifest/v1") {
      expectedPlanIds.text_chunk_plan = manifest.planArtifactIds.textChunk;
      expectedPlanIds.text_placement_plan =
        manifest.planArtifactIds.textPlacement;
    }
    if (manifest.schemaVersion === "maul-unified-short-render-manifest/v3") {
      expectedPlanIds.text_animation_plan =
        manifest.planArtifactIds.textAnimation;
    }
    const executionTypes = new Set(
      manifest.planExecution.map((entry) => entry.planType),
    );
    const expectedExecutionCount =
      manifest.schemaVersion === "maul-unified-short-render-manifest/v1"
        ? 14
        : manifest.schemaVersion === "maul-unified-short-render-manifest/v2"
          ? 16
          : 17;
    if (
      executionTypes.size !== expectedExecutionCount ||
      manifest.planExecution.some(
        (entry) => expectedPlanIds[entry.planType] !== entry.planArtifactId,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["planExecution"],
        message:
          "Manifest plan execution must cover each governed plan exactly once with its bundle artifact ID.",
      });
    }
    if (manifest.schemaVersion !== "maul-unified-short-render-manifest/v1") {
      const typography = manifest.plans.typographyMotion;
      const placement = manifest.plans.textPlacement;
      const chunkPlan = manifest.plans.textChunk;
      if (
        typography.textChunkPlanArtifactId !==
          manifest.planArtifactIds.textChunk ||
        typography.textPlacementPlanArtifactId !==
          manifest.planArtifactIds.textPlacement ||
        placement.textChunkPlanArtifactId !==
          manifest.planArtifactIds.textChunk ||
        typography.textChunkPlanHash !== placement.textChunkPlanHash
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["plans"],
          message:
            "V2 manifest chunk and placement references must match its governed plan IDs and hashes.",
        });
      }

      const chunkById = new Map(
        chunkPlan.chunks.map((chunk) => [chunk.chunkId, chunk]),
      );
      const tokenTextById = new Map(
        chunkPlan.tokens.map((token) => [token.tokenId, token.text]),
      );
      placement.segments.forEach((segment, segmentIndex) => {
        const chunk = chunkById.get(segment.chunkId);
        const matchesChunkTokens =
          chunk &&
          chunk.tokenIds.length === segment.tokenIds.length &&
          chunk.tokenIds.every(
            (tokenId, tokenIndex) => tokenId === segment.tokenIds[tokenIndex],
          );
        const linesAreExact = segment.lines.every((line) => {
          const tokenTexts = line.tokenIds.map((tokenId) =>
            tokenTextById.get(tokenId),
          );
          return (
            tokenTexts.every((text): text is string => Boolean(text)) &&
            joinShortsTextTokens(tokenTexts) === line.text
          );
        });
        if (
          !chunk ||
          !matchesChunkTokens ||
          !linesAreExact ||
          segment.outputStartMs < chunk.outputStartMs ||
          segment.outputEndMs > chunk.outputEndMs
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["plans", "textPlacement", "segments", segmentIndex],
            message:
              "Placement segment chunk tokens and line text must match the standalone chunk plan exactly.",
          });
        }
      });
      if (
        placement.status === "planned" &&
        chunkPlan.chunks.some(
          (chunk) =>
            !placement.segments.some(
              (segment) => segment.chunkId === chunk.chunkId,
            ),
        )
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["plans", "textPlacement", "segments"],
          message:
            "Planned placement must represent every standalone text chunk.",
        });
      }
    }
    if (manifest.schemaVersion === "maul-unified-short-render-manifest/v3") {
      const typography = manifest.plans.typographyMotion;
      const animation = manifest.plans.textAnimation;
      const placement = manifest.plans.textPlacement;
      if (
        typography.textAnimationPlanArtifactId !==
          manifest.planArtifactIds.textAnimation ||
        animation.textChunkPlanArtifactId !==
          manifest.planArtifactIds.textChunk ||
        animation.textPlacementPlanArtifactId !==
          manifest.planArtifactIds.textPlacement ||
        animation.treatmentGenomeArtifactId !==
          typography.treatmentGenomeArtifactId ||
        animation.textChunkPlanHash !== typography.textChunkPlanHash ||
        animation.textPlacementPlanHash !== typography.textPlacementPlanHash ||
        animation.outputDurationMs !== manifest.timeline.outputDurationMs
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["plans", "textAnimation"],
          message:
            "V3 animation artifact IDs and parent hashes must match Typography Motion, placement, chunk, treatment, and timeline references.",
        });
      }

      const placementById = new Map(
        placement.segments.map((segment) => [segment.segmentId, segment]),
      );
      animation.programs.forEach((program, programIndex) => {
        const segment = placementById.get(program.target.placementSegmentId);
        const targetTokenPositions = segment
          ? program.target.tokenIds.map((tokenId) =>
              segment.tokenIds.indexOf(tokenId),
            )
          : [];
        const tokenReferencesMatch = segment
          ? program.target.scope === "segment"
            ? program.target.tokenIds.length === segment.tokenIds.length &&
              program.target.tokenIds.every(
                (tokenId, tokenIndex) =>
                  tokenId === segment.tokenIds[tokenIndex],
              )
            : targetTokenPositions.every(
                (position, tokenIndex) =>
                  position >= 0 &&
                  (tokenIndex === 0 ||
                    position > (targetTokenPositions[tokenIndex - 1] ?? -1)),
              )
          : false;
        if (
          !segment ||
          !tokenReferencesMatch ||
          program.phases.entry.outputStartMs < segment.outputStartMs ||
          program.phases.exit.outputEndMs > segment.outputEndMs
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["plans", "textAnimation", "programs", programIndex],
            message:
              "V3 animation placement segment token references must be exact for segment scope or an ordered token subset inside the governed interval.",
          });
        }
      });
      if (
        placement.segments.some(
          (segment) =>
            !animation.programs.some(
              (program) =>
                program.target.placementSegmentId === segment.segmentId,
            ),
        )
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["plans", "textAnimation", "programs"],
          message:
            "V3 animation must govern every planned placement segment exactly once.",
        });
      }
    }
    const base = manifest.plans.observationSnapshot;
    const planValues = Object.values(manifest.plans);
    const inconsistentPlan = planValues.some(
      (plan) =>
        plan.sourceAssetId !== base.sourceAssetId ||
        plan.analysisArtifactId !== base.analysisArtifactId ||
        plan.timelineArtifactId !== base.timelineArtifactId ||
        plan.candidateArtifactId !== base.candidateArtifactId ||
        plan.treatmentGenomeArtifactId !== base.treatmentGenomeArtifactId,
    );
    if (
      inconsistentPlan ||
      manifest.source.sourceAssetId !== base.sourceAssetId ||
      manifest.timeline.sourceAssetId !== base.sourceAssetId ||
      manifest.timeline.analysisArtifactId !== base.analysisArtifactId ||
      manifest.treatment.timelineArtifactId !== base.timelineArtifactId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["plans"],
        message:
          "Every manifest plan must share the authoritative source, analysis, timeline, candidate, and treatment lineage.",
      });
    }
    if (
      manifest.plans.adapterDecision.canvas.width !== manifest.output.width ||
      manifest.plans.adapterDecision.canvas.height !== manifest.output.height ||
      manifest.plans.adapterDecision.canvas.fps !== manifest.output.fps
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["output"],
        message:
          "Manifest output must equal the governed Adapter Decision canvas.",
      });
    }
    manifest.captions.forEach((caption, index) => {
      if (
        caption.endMs < caption.startMs ||
        caption.endMs > manifest.timeline.outputDurationMs
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["captions", index],
          message:
            "Manifest captions must stay inside the authoritative output timeline.",
        });
      }
    });
  };

export const maulUnifiedShortRenderManifestV1Schema =
  maulUnifiedShortRenderManifestV1ObjectSchema.superRefine(
    validateMaulUnifiedShortRenderManifest,
  );

export const maulUnifiedShortRenderManifestV2Schema =
  maulUnifiedShortRenderManifestV2ObjectSchema.superRefine(
    validateMaulUnifiedShortRenderManifest,
  );

export const maulUnifiedShortRenderManifestV3Schema =
  maulUnifiedShortRenderManifestV3ObjectSchema.superRefine(
    validateMaulUnifiedShortRenderManifest,
  );

export const maulUnifiedShortRenderManifestSchema: z.ZodType<
  MaulUnifiedShortRenderManifestCandidate,
  z.ZodTypeDef,
  unknown
> = z
  .discriminatedUnion("schemaVersion", [
    maulUnifiedShortRenderManifestV1ObjectSchema,
    maulUnifiedShortRenderManifestV2ObjectSchema,
    maulUnifiedShortRenderManifestV3ObjectSchema,
  ])
  .superRefine(validateMaulUnifiedShortRenderManifest);

export const maulQualityTruthFailureCodeSchema = z.enum([
  "proof_invalid",
  "proof_unavailable",
  "proof_manifest_mismatch",
  "caption_bounds_unverified",
  "caption_outside_safe_region",
  "placement_evidence_missing",
  "placement_bounds_mismatch",
  "placement_reference_mismatch",
  "placement_primitive_mismatch",
  "font_fallback_forbidden",
  "font_load_unverified",
  "crop_or_mask_unverified",
  "crop_outside_source",
  "camera_zoom_restart",
  "camera_continuity_unverified",
  "capability_unsupported",
  "capability_evidence_missing",
  "silent_fallback",
]);

const maulQualityTruthEvidenceIdSchema = idSchema.nullable();

const maulQualityTruthProofCommonShape = {
    manifestReplayKey: z.string().regex(/^[a-f0-9]{64}$/i),
    captionLayout: z.object({
      status: z.enum(["verified", "unverified"]),
      evidenceId: maulQualityTruthEvidenceIdSchema,
      boxes: z.array(
        z.object({
          captionIndex: z.number().int().nonnegative(),
          leftPx: z.number().nonnegative(),
          topPx: z.number().nonnegative(),
          rightPx: z.number().nonnegative(),
          bottomPx: z.number().nonnegative(),
        }),
      ),
    }),
    fontRuntime: z.object({
      status: z.enum(["eligible_loaded", "fallback", "unverified"]),
      family: z.string().trim().min(1),
      assetId: maulQualityTruthEvidenceIdSchema,
      evidenceId: maulQualityTruthEvidenceIdSchema,
    }),
    cropAndMask: z.object({
      status: z.enum(["verified", "unsafe", "unverified"]),
      evidenceId: maulQualityTruthEvidenceIdSchema,
      maskingRequired: z.boolean(),
      maskingStatus: z.enum(["not_required", "verified", "unverified"]),
      crops: z.array(
        z.object({
          outputStartMs: z.number().int().nonnegative(),
          outputEndMs: z.number().int().positive(),
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
          width: z.number().positive().max(1),
          height: z.number().positive().max(1),
        }),
      ),
    }),
    cameraContinuity: z.object({
      status: z.enum([
        "verified_continuous",
        "restart_detected",
        "unverified",
      ]),
      evidenceId: maulQualityTruthEvidenceIdSchema,
      resetOutputMs: z.array(z.number().int().nonnegative()),
    }),
    capabilities: z.array(
      z.object({
        capabilityId: idSchema,
        status: z.enum([
          "native_render_safe",
          "unsupported",
          "unverified",
        ]),
        evidenceId: maulQualityTruthEvidenceIdSchema,
      }),
    ),
    fallbacks: z.array(
      z.object({
        planType: idSchema,
        selected: z.literal(true),
        evidenceId: maulQualityTruthEvidenceIdSchema,
      }),
    ),
};

const maulQualityTruthProofV1ObjectSchema = z.object({
  schemaVersion: z.literal("maul-quality-truth-proof/v1"),
  ...maulQualityTruthProofCommonShape,
});

const maulQualityTruthProofV2ObjectSchema = z.object({
  schemaVersion: z.literal("maul-quality-truth-proof/v2"),
  ...maulQualityTruthProofCommonShape,
  placementSegments: z.array(
    z.object({
      status: z.enum(["verified", "unverified"]),
      evidenceId: maulQualityTruthEvidenceIdSchema,
      textPlacementPlanArtifactId: idSchema,
      placementSegmentId: idSchema,
      compositionIntervalId: idSchema,
      compositionVariantId: idSchema,
      compositionTransformHash: z.string().regex(/^[a-f0-9]{64}$/i),
      compatibilityProfileId: idSchema,
      metricsFingerprint: z.string().regex(/^[a-f0-9]{64}$/i),
      exactFontAssetId: maulQualityTruthEvidenceIdSchema,
      compiledLegibilityPrimitive: maulMinimumLegibilityPrimitiveSchema,
      measuredBox: z
        .object({
          leftPx: z.number().nonnegative(),
          topPx: z.number().nonnegative(),
          rightPx: z.number().positive(),
          bottomPx: z.number().positive(),
        })
        .refine(
          (box) =>
            box.rightPx > box.leftPx && box.bottomPx > box.topPx,
          {message: "Measured placement boxes require positive dimensions."},
        ),
    }),
  ).min(1),
});

type MaulQualityTruthProofCandidate =
  | z.infer<typeof maulQualityTruthProofV1ObjectSchema>
  | z.infer<typeof maulQualityTruthProofV2ObjectSchema>;

const validateMaulQualityTruthProof = (
  proof: MaulQualityTruthProofCandidate,
  ctx: z.RefinementCtx,
) => {
    const verifiedWithoutEvidence =
      (proof.captionLayout.status === "verified" &&
        !proof.captionLayout.evidenceId) ||
      (proof.fontRuntime.status === "eligible_loaded" &&
        (!proof.fontRuntime.assetId || !proof.fontRuntime.evidenceId)) ||
      (proof.cropAndMask.status === "verified" &&
        !proof.cropAndMask.evidenceId) ||
      (proof.cameraContinuity.status === "verified_continuous" &&
        !proof.cameraContinuity.evidenceId) ||
      proof.capabilities.some(
        (capability) =>
          capability.status === "native_render_safe" &&
          !capability.evidenceId,
      );
    if (verifiedWithoutEvidence) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Verified Quality Truth proof requires evidence IDs.",
      });
    }
    if (
      proof.schemaVersion === "maul-quality-truth-proof/v2" &&
      proof.placementSegments.some(
        (segment) => segment.status === "verified" && !segment.evidenceId,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["placementSegments"],
        message:
          "Verified placement proof requires evidence for every placement segment.",
      });
    }
    if (
      proof.schemaVersion === "maul-quality-truth-proof/v2" &&
      proof.placementSegments.some(
        (segment) =>
          segment.status === "verified" && !segment.exactFontAssetId,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["placementSegments"],
        message:
          "Verified placement proof requires an exact rendered font asset ID.",
      });
    }
};

export const maulQualityTruthProofV1Schema =
  maulQualityTruthProofV1ObjectSchema.superRefine(
    validateMaulQualityTruthProof,
  );

export const maulQualityTruthProofV2Schema =
  maulQualityTruthProofV2ObjectSchema.superRefine(
    validateMaulQualityTruthProof,
  );

export const maulQualityTruthProofSchema = z
  .discriminatedUnion("schemaVersion", [
    maulQualityTruthProofV1ObjectSchema,
    maulQualityTruthProofV2ObjectSchema,
  ])
  .superRefine(validateMaulQualityTruthProof);

export const maulQualityTruthResultSchema = z
  .object({
    schemaVersion: z.literal("maul-quality-truth-result/v1"),
    manifestReplayKey: z.string().regex(/^[a-f0-9]{64}$/i),
    status: z.enum(["pass", "blocked"]),
    evidenceIds: z.array(idSchema),
    failures: z.array(
      z.object({
        code: maulQualityTruthFailureCodeSchema,
        field: z.string().trim().min(1),
        outputStartMs: z.number().int().nonnegative().nullable(),
        outputEndMs: z.number().int().nonnegative().nullable(),
        message: z.string().trim().min(1),
        evidenceId: maulQualityTruthEvidenceIdSchema,
      }),
    ),
  })
  .superRefine((result, ctx) => {
    if ((result.status === "pass") !== (result.failures.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Quality Truth pass requires zero failures; blocked requires failures.",
      });
    }
  });

export const maulPlacementOutcomeSchema = z.enum([
  "ART_DIRECTED",
  "CONSTRAINED_ART_DIRECTED",
  "SAFE_CAPTION_FALLBACK",
  "PLACEMENT_UNRESOLVED",
  "VISUAL_EVIDENCE_UNAVAILABLE",
]);

export const maulPerceptualFailureLabelSchema = z.enum([
  "GENERIC_BOTTOM_CAPTION",
  "EXCESSIVE_BLACK_PLATE",
  "SINGLE_FONT_MONOTONY",
  "FLICKERING_LAYOUT",
  "UNREADABLE_HOLD",
  "AWKWARD_LINE_BREAK",
  "SUBJECT_OBSTRUCTION",
  "WEAK_HIERARCHY",
  "REFERENCE_TRAIT_MISSING",
  "ANIMATION_IMPERCEPTIBLE",
  "TEMPLATED_APPEARANCE",
]);

export const maulCreativeResultSchema = z
  .object({
    schemaVersion: z.literal("maul-creative-result/v1"),
    placementOutcome: maulPlacementOutcomeSchema,
    structuralStatus: z.enum(["pass", "blocked"]),
    perceptualStatus: z.enum(["pass", "blocked", "unavailable"]),
    humanReviewStatus: z.enum(["approved", "rejected", "pending"]),
    referenceParityClaimed: z.boolean(),
    failureLabels: z.array(maulPerceptualFailureLabelSchema),
    evidenceArtifactIds: z.array(idSchema),
  })
  .superRefine((result, ctx) => {
    const artDirected = result.placementOutcome === "ART_DIRECTED";
    if (
      artDirected &&
      (result.structuralStatus !== "pass" ||
        result.perceptualStatus !== "pass" ||
        result.humanReviewStatus !== "approved")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "ART_DIRECTED requires structural pass, perceptual pass, and approved human review.",
      });
    }
    if (
      result.referenceParityClaimed &&
      (!artDirected ||
        result.structuralStatus !== "pass" ||
        result.perceptualStatus !== "pass" ||
        result.humanReviewStatus !== "approved")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Reference parity may be claimed only by an approved ART_DIRECTED result with structural and perceptual proof.",
      });
    }
  });

const maulPerceptualEvaluatorReceiptSchema = z.object({
  authorityClass: z.enum(["invoked_model", "unavailable"]),
  provider: z.string().trim().min(1).nullable(),
  model: z.string().trim().min(1).nullable(),
  inferenceReceiptId: idSchema.nullable(),
});

export const maulRenderPreviewPayloadSchema = z.object({
  schemaVersion: z.literal("maul-render-preview/v1"),
  sourceAssetId: idSchema,
  candidateArtifactId: idSchema,
  timelineArtifactId: idSchema,
  treatmentGenomeArtifactId: idSchema,
  planningBundleArtifactId: idSchema,
  renderManifestArtifactId: idSchema,
  manifestReplayKey: z.string().regex(/^[a-f0-9]{64}$/i),
  storageKey: z.string().trim().min(1),
  mediaType: z.literal("video/mp4"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  durationMs: z.number().int().positive(),
  width: z.literal(540),
  height: z.literal(960),
  frameSamples: z.array(
    z.object({
      frameId: idSchema,
      outputMs: z.number().int().nonnegative(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/i),
      mediaType: z.literal("image/png"),
    }),
  ).min(1),
  createdAt: isoDateSchema,
});

export const maulPerceptualTruthPayloadSchema = z
  .object({
    schemaVersion: z.literal("maul-perceptual-truth/v1"),
    sourceAssetId: idSchema,
    candidateArtifactId: idSchema,
    timelineArtifactId: idSchema,
    treatmentGenomeArtifactId: idSchema,
    planningBundleArtifactId: idSchema,
    renderManifestArtifactId: idSchema,
    renderPreviewArtifactId: idSchema,
    manifestReplayKey: z.string().regex(/^[a-f0-9]{64}$/i),
    status: z.enum(["pass", "blocked", "unavailable"]),
    placementOutcome: maulPlacementOutcomeSchema,
    failureLabels: z.array(maulPerceptualFailureLabelSchema),
    evidenceArtifactIds: z.array(idSchema),
    renderedFrameIds: z.array(idSchema).min(1),
    evaluator: maulPerceptualEvaluatorReceiptSchema,
    rationale: z.string().trim().min(1),
    createdAt: isoDateSchema,
  })
  .superRefine((truth, ctx) => {
    const evaluatorInvoked =
      truth.evaluator.authorityClass === "invoked_model" &&
      truth.evaluator.provider !== null &&
      truth.evaluator.model !== null &&
      truth.evaluator.inferenceReceiptId !== null;
    if (
      truth.status === "pass" &&
      (!evaluatorInvoked ||
        truth.failureLabels.length > 0 ||
        !["ART_DIRECTED", "CONSTRAINED_ART_DIRECTED"].includes(
          truth.placementOutcome,
        ) ||
        truth.evidenceArtifactIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Perceptual Truth pass requires invoked rendered-frame evaluation, evidence, no failures, and an art-directed outcome.",
      });
    }
    if (
      truth.status === "unavailable" &&
      truth.evaluator.authorityClass !== "unavailable"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evaluator"],
        message: "Unavailable Perceptual Truth requires an unavailable evaluator receipt.",
      });
    }
    if (
      ["SAFE_CAPTION_FALLBACK", "PLACEMENT_UNRESOLVED", "VISUAL_EVIDENCE_UNAVAILABLE"].includes(
        truth.placementOutcome,
      ) &&
      truth.status === "pass"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fallback, unresolved, and missing-evidence outcomes cannot pass Perceptual Truth.",
      });
    }
  });

export const maulQualityEvidenceBundlePayloadSchema = z
  .object({
    schemaVersion: z.literal("maul-quality-evidence-bundle/v1"),
    sourceAssetId: idSchema,
    candidateArtifactId: idSchema,
    timelineArtifactId: idSchema,
    treatmentGenomeArtifactId: idSchema,
    planningBundleArtifactId: idSchema,
    renderManifestArtifactId: idSchema,
    exportArtifactId: idSchema,
    replayKey: z.string().regex(/^[a-f0-9]{64}$/i),
    evidenceStatus: z.enum(["unverified", "failed", "passed"]),
    renderedProbeIds: z.array(idSchema),
    mandatoryDimensions: z.array(
      z.object({
        dimension: maulS4DimensionIdSchema,
        status: z.enum(["unverified", "failed", "passed"]),
        score: z.number().min(0).max(100).nullable(),
        evidenceIds: z.array(idSchema),
        rationale: z.string().trim().min(1),
      }),
    ),
    hardFailures: z.array(
      z.object({
        id: idSchema,
        dimension: maulS4DimensionIdSchema,
        message: z.string().trim().min(1),
      }),
    ),
    independentCritic: z.object({
      authorityClass: z.enum([
        "invoked_model",
        "unavailable",
        "governed_fallback",
      ]),
      provider: z.string().trim().min(1).nullable(),
      model: z.string().trim().min(1).nullable(),
      inferenceReceiptId: idSchema.nullable(),
    }),
    authenticatedHumanApprovalRequired: z.literal(true),
    warnings: z.array(z.string().trim().min(1)),
    fallbacks: z
      .array(
        z.object({
          condition: z.string().trim().min(1),
          action: z.string().trim().min(1),
          status: z.enum(["available", "selected", "blocking"]),
        }),
      )
      .min(1),
    createdAt: isoDateSchema,
  })
  .superRefine((bundle, ctx) => {
    if (bundle.evidenceStatus !== "passed") {
      return;
    }
    const requiredDimensions = new Set(maulS4DimensionIdSchema.options);
    const suppliedDimensions = new Set(
      bundle.mandatoryDimensions.map((entry) => entry.dimension),
    );
    const dimensionsComplete =
      suppliedDimensions.size === requiredDimensions.size &&
      [...requiredDimensions].every((dimension) =>
        suppliedDimensions.has(dimension),
      ) &&
      bundle.mandatoryDimensions.every(
        (entry) =>
          entry.status === "passed" &&
          entry.score !== null &&
          entry.evidenceIds.length > 0,
      );
    const criticComplete =
      bundle.independentCritic.authorityClass === "invoked_model" &&
      bundle.independentCritic.provider !== null &&
      bundle.independentCritic.model !== null &&
      bundle.independentCritic.inferenceReceiptId !== null;
    if (
      bundle.renderedProbeIds.length === 0 ||
      !dimensionsComplete ||
      bundle.hardFailures.length > 0 ||
      !criticComplete
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "A passed Quality Evidence Bundle requires rendered probes, every mandatory S4 dimension passed with evidence, zero hard failures, and invoked independent critic authority.",
      });
    }
  });
export const maulReviewDecisionPayloadSchema = z.object({
  subjectArtifactId: idSchema,
  treatmentGenomeArtifactId: idSchema.nullable(),
  planningBundleArtifactId: idSchema.nullable().optional().default(null),
  perceptualTruthArtifactId: idSchema.nullable().optional().default(null),
  reviewerId: idSchema,
  decision: z.enum(["approved", "rejected", "changes_requested"]),
  failureClasses: z.array(z.string().trim().min(1)),
  rationale: z.string().trim().min(1).nullable(),
  rubricScores: z.record(idSchema, z.number().min(0).max(100)),
  weightedScore: z.number().min(0).max(100),
  decidedAt: isoDateSchema,
});

export const maulThumbnailBrandKitSchema = z.object({
  kind: z.enum(["supplied", "default"]),
  name: z.string().trim().min(1),
  primaryColor: z.string().regex(/^#[a-f0-9]{6}$/i),
  accentColor: z.string().regex(/^#[a-f0-9]{6}$/i),
  fontFamily: z.string().trim().min(1),
  logoAssetId: idSchema.nullable(),
});

export const maulThumbnailDirectionPayloadSchema = z.object({
  exportArtifactId: idSchema,
  candidateArtifactId: idSchema,
  sourceAssetId: idSchema,
  speakerFrame: z.object({
    sourceMs: z.number().int().nonnegative(),
    speakerId: idSchema,
    confidence: confidenceSchema,
    crop: z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().positive().max(1),
      height: z.number().positive().max(1),
    }),
    reason: z.string().trim().min(1),
  }),
  copyOptions: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(80),
        sourceStartMs: z.number().int().nonnegative(),
        sourceEndMs: z.number().int().positive(),
        sourceGrounded: z.literal(true),
      }),
    )
    .min(2)
    .max(4),
  brandKit: maulThumbnailBrandKitSchema,
  providerPolicy: z.object({
    preferredProvider: z.literal("nano_banana"),
    model: z.string().trim().min(1),
    fallback: z.literal("deterministic_source_frame_svg"),
    preserveSpeakerIdentity: z.literal(true),
  }),
  promptTemplate: z.string().trim().min(1),
  negativeConstraints: z.array(z.string().trim().min(1)),
  provenanceNotes: z.array(z.string().trim().min(1)),
});

export const maulThumbnailCandidatePayloadSchema = z.object({
  directionArtifactId: idSchema,
  exportArtifactId: idSchema,
  sourceAssetId: idSchema,
  generationId: idSchema,
  provider: z.enum(["nano_banana", "deterministic_source_frame_svg"]),
  model: z.string().trim().min(1),
  storageKey: z.string().trim().min(1),
  mediaType: z.enum(["image/png", "image/jpeg", "image/svg+xml"]),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  copy: z.string().trim().min(1),
  sourceFrameMs: z.number().int().nonnegative(),
  score: z.object({
    sourceFidelity: confidenceSchema,
    legibility: confidenceSchema,
    composition: confidenceSchema,
    brandFit: confidenceSchema,
    overall: confidenceSchema,
  }),
  reviewStatus: z.enum(["pending", "approved", "rejected"]),
});

export const maulThumbnailGenerationRequestSchema = z.object({
  exportArtifactId: idSchema,
  brandKit: maulThumbnailBrandKitSchema.optional().default({
    kind: "default",
    name: "MAUL Editorial Default",
    primaryColor: "#102a43",
    accentColor: "#f6c453",
    fontFamily: "Inter",
    logoAssetId: null,
  }),
  requestedCount: z.number().int().min(2).max(4).optional().default(4),
});

export const maulThumbnailReviewRequestSchema = z.object({
  reviewerId: idSchema,
  decision: z.enum(["approved", "rejected", "changes_requested"]),
  rationale: z.string().trim().min(1),
});

export const maulImplementationLabelSchema = z.enum([
  "planned",
  "implemented-unverified",
  "native-render-verified",
  "encoded-output-verified",
  "held-out-reference-parity-passed",
  "human-approved",
  "blocked",
  "accounted-deferred",
  "no-approved-candidate",
]);

export const maulExportQualityGateSchema = z
  .object({
    status: z.enum(["unverified", "failed", "passed"]),
    releaseEligible: z.boolean(),
    implementationLabel: maulImplementationLabelSchema,
    renderedEvidenceArtifactId: idSchema.nullable(),
    perceptualTruthArtifactId: idSchema.nullable().optional().default(null),
    placementOutcome: maulPlacementOutcomeSchema
      .optional()
      .default("PLACEMENT_UNRESOLVED"),
    postRenderHumanApprovalArtifactId: idSchema.nullable(),
    hardFailures: z.array(
      z.object({
        id: idSchema,
        dimension: z.string().trim().min(1),
        message: z.string().trim().min(1),
      }),
    ),
  })
  .superRefine((gate, ctx) => {
    const hasReleaseEvidence =
      gate.renderedEvidenceArtifactId !== null &&
      gate.perceptualTruthArtifactId !== null &&
      gate.postRenderHumanApprovalArtifactId !== null &&
      gate.hardFailures.length === 0 &&
      gate.placementOutcome === "ART_DIRECTED";
    if (
      gate.status === "passed" &&
      (!gate.releaseEligible || !hasReleaseEvidence)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "A passed MAUL release gate requires Perceptual Truth, rendered evidence, post-render human approval, an ART_DIRECTED outcome, and zero hard failures.",
      });
    }
    if (gate.status !== "passed" && gate.releaseEligible) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["releaseEligible"],
        message:
          "An unverified or failed MAUL quality gate cannot be release-eligible.",
      });
    }
  });

export const maulExportArtifactPayloadSchema = z.object({
  sourceAssetId: idSchema,
  candidateArtifactId: idSchema,
  timelineArtifactId: idSchema,
  treatmentGenomeArtifactId: idSchema,
  reviewDecisionArtifactId: idSchema,
  renderManifestArtifactId: idSchema.nullable().optional().default(null),
  storageKey: z.string().trim().min(1),
  mediaType: z.literal("video/mp4"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  durationMs: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  evidence: z.object({
    technicalValidationPassed: z.boolean(),
    rightsVerified: z.boolean(),
    deterministicReplayKey: z.string().trim().min(1),
    preRenderReviewPassed: z.boolean().optional().default(false),
    qualityGate: maulExportQualityGateSchema,
    remotionCompositionId: z
      .string()
      .trim()
      .min(1)
      .optional()
      .default("legacy"),
    audioPlanId: z.string().trim().min(1).nullable().optional().default(null),
    sourceMappingPreserved: z.boolean().optional().default(false),
    fileSizeBytes: z.number().int().nonnegative().optional().default(0),
    warnings: z.array(z.string().trim().min(1)),
  }),
});

export const maulArtifactTypeSchema = z.enum([
  "source_asset",
  "analysis",
  "editorial_timeline",
  "candidate",
  "planner_audit",
  "observation_snapshot",
  "candidate_narrative",
  "editorial_beat_map",
  "text_chunk_plan",
  "text_placement_plan",
  "text_animation_plan",
  "typography_motion_plan",
  "framing_camera_plan",
  "visual_plan",
  "dialogue_audio_plan",
  "capability_selection",
  "adapter_decision",
  "art_direction_plan",
  "context_assembly_plan",
  "shot_intent_matrix",
  "text_opportunity_plan",
  "revision_plan",
  "planning_bundle",
  "render_manifest",
  "render_preview",
  "perceptual_truth",
  "quality_evidence_bundle",
  "treatment_genome",
  "reference_corpus_item",
  "review_decision",
  "export_artifact",
  "thumbnail_direction",
  "thumbnail_candidate",
]);

export const maulArtifactLineageSchema = z.object({
  projectId: idSchema,
  canonicalJobId: idSchema,
  runId: idSchema,
  rootSourceAssetId: idSchema,
  parentArtifactIds: z.array(idSchema),
  sequence: z.number().int().positive(),
  producedBy: z.object({
    module: z.string().trim().min(1),
    version: z.string().trim().min(1),
  }),
  createdAt: isoDateSchema,
});

const artifactRecord = <
  Type extends z.ZodLiteral<string>,
  Payload extends z.ZodTypeAny,
>(
  artifactType: Type,
  payload: Payload,
) =>
  z.object({
    schemaVersion: z.literal("maul-artifact/v1"),
    artifactId: idSchema,
    artifactType,
    lineage: maulArtifactLineageSchema,
    payload,
  });

type MaulArtifactPayloadByType = {
  source_asset: z.infer<typeof maulSourceAssetPayloadSchema>;
  analysis: z.infer<typeof maulAnalysisPayloadSchema>;
  editorial_timeline: z.infer<typeof maulEditorialTimelinePayloadSchema>;
  candidate: z.infer<typeof maulCandidatePayloadSchema>;
  planner_audit: z.infer<typeof maulPlannerAuditPayloadSchema>;
  observation_snapshot: z.infer<typeof maulObservationSnapshotPayloadSchema>;
  candidate_narrative: z.infer<typeof maulCandidateNarrativePayloadSchema>;
  editorial_beat_map: z.infer<typeof maulEditorialBeatMapPayloadSchema>;
  text_chunk_plan: z.infer<typeof maulTextChunkPlanPayloadSchema>;
  text_placement_plan: z.infer<typeof maulTextPlacementPlanPayloadSchema>;
  text_animation_plan: z.infer<typeof maulTextAnimationPlanPayloadSchema>;
  typography_motion_plan: z.infer<
    typeof maulTypographyMotionPlanPayloadSchema
  >;
  framing_camera_plan: z.infer<typeof maulFramingCameraPlanPayloadSchema>;
  visual_plan: z.infer<typeof maulVisualPlanPayloadSchema>;
  dialogue_audio_plan: z.infer<typeof maulDialogueAudioPlanPayloadSchema>;
  capability_selection: z.infer<
    typeof maulCapabilitySelectionPayloadSchema
  >;
  adapter_decision: z.infer<typeof maulAdapterDecisionPayloadSchema>;
  art_direction_plan: z.infer<typeof maulArtDirectionPlanPayloadSchema>;
  context_assembly_plan: z.infer<typeof maulContextAssemblyPlanPayloadSchema>;
  shot_intent_matrix: z.infer<typeof maulShotIntentMatrixPayloadSchema>;
  text_opportunity_plan: z.infer<typeof maulTextOpportunityPlanPayloadSchema>;
  revision_plan: z.infer<typeof maulRevisionPlanPayloadSchema>;
  planning_bundle: z.infer<typeof maulPlanningBundlePayloadSchema>;
  render_manifest: z.infer<typeof maulUnifiedShortRenderManifestSchema>;
  render_preview: z.infer<typeof maulRenderPreviewPayloadSchema>;
  perceptual_truth: z.infer<typeof maulPerceptualTruthPayloadSchema>;
  quality_evidence_bundle: z.infer<
    typeof maulQualityEvidenceBundlePayloadSchema
  >;
  treatment_genome: z.infer<typeof maulTreatmentGenomePayloadSchema>;
  reference_corpus_item: z.infer<typeof maulReferenceCorpusItemPayloadSchema>;
  review_decision: z.infer<typeof maulReviewDecisionPayloadSchema>;
  export_artifact: z.infer<typeof maulExportArtifactPayloadSchema>;
  thumbnail_direction: z.infer<typeof maulThumbnailDirectionPayloadSchema>;
  thumbnail_candidate: z.infer<typeof maulThumbnailCandidatePayloadSchema>;
};

type MaulArtifactRecordContract = {
  [ArtifactType in keyof MaulArtifactPayloadByType]: {
    schemaVersion: "maul-artifact/v1";
    artifactId: string;
    artifactType: ArtifactType;
    lineage: z.infer<typeof maulArtifactLineageSchema>;
    payload: MaulArtifactPayloadByType[ArtifactType];
  };
}[keyof MaulArtifactPayloadByType];

export const maulArtifactRecordSchema: z.ZodType<
  MaulArtifactRecordContract,
  z.ZodTypeDef,
  unknown
> = z
  .discriminatedUnion("artifactType", [
    artifactRecord(z.literal("source_asset"), maulSourceAssetPayloadSchema),
    artifactRecord(z.literal("analysis"), maulAnalysisPayloadSchema),
    artifactRecord(
      z.literal("editorial_timeline"),
      maulEditorialTimelinePayloadSchema,
    ),
    artifactRecord(z.literal("candidate"), maulCandidatePayloadSchema),
    artifactRecord(z.literal("planner_audit"), maulPlannerAuditPayloadSchema),
    artifactRecord(
      z.literal("observation_snapshot"),
      maulObservationSnapshotPayloadSchema,
    ),
    artifactRecord(
      z.literal("candidate_narrative"),
      maulCandidateNarrativePayloadSchema,
    ),
    artifactRecord(
      z.literal("editorial_beat_map"),
      maulEditorialBeatMapPayloadSchema,
    ),
    artifactRecord(
      z.literal("text_chunk_plan"),
      maulTextChunkPlanPayloadSchema,
    ),
    artifactRecord(
      z.literal("text_placement_plan"),
      maulTextPlacementPlanPayloadSchema,
    ),
    artifactRecord(
      z.literal("text_animation_plan"),
      maulTextAnimationPlanPayloadSchema,
    ),
    artifactRecord(
      z.literal("typography_motion_plan"),
      maulTypographyMotionPlanPayloadSchema,
    ),
    artifactRecord(
      z.literal("framing_camera_plan"),
      maulFramingCameraPlanPayloadSchema,
    ),
    artifactRecord(z.literal("visual_plan"), maulVisualPlanPayloadSchema),
    artifactRecord(
      z.literal("dialogue_audio_plan"),
      maulDialogueAudioPlanPayloadSchema,
    ),
    artifactRecord(
      z.literal("capability_selection"),
      maulCapabilitySelectionPayloadSchema,
    ),
    artifactRecord(
      z.literal("adapter_decision"),
      maulAdapterDecisionPayloadSchema,
    ),
    artifactRecord(
      z.literal("art_direction_plan"),
      maulArtDirectionPlanPayloadSchema,
    ),
    artifactRecord(
      z.literal("context_assembly_plan"),
      maulContextAssemblyPlanPayloadSchema,
    ),
    artifactRecord(
      z.literal("shot_intent_matrix"),
      maulShotIntentMatrixPayloadSchema,
    ),
    artifactRecord(
      z.literal("text_opportunity_plan"),
      maulTextOpportunityPlanPayloadSchema,
    ),
    artifactRecord(z.literal("revision_plan"), maulRevisionPlanPayloadSchema),
    artifactRecord(
      z.literal("planning_bundle"),
      maulPlanningBundlePayloadSchema,
    ),
    artifactRecord(
      z.literal("render_manifest"),
      maulUnifiedShortRenderManifestSchema,
    ),
    artifactRecord(z.literal("render_preview"), maulRenderPreviewPayloadSchema),
    artifactRecord(
      z.literal("perceptual_truth"),
      maulPerceptualTruthPayloadSchema,
    ),
    artifactRecord(
      z.literal("quality_evidence_bundle"),
      maulQualityEvidenceBundlePayloadSchema,
    ),
    artifactRecord(
      z.literal("treatment_genome"),
      maulTreatmentGenomePayloadSchema,
    ),
    artifactRecord(
      z.literal("reference_corpus_item"),
      maulReferenceCorpusItemPayloadSchema,
    ),
    artifactRecord(
      z.literal("review_decision"),
      maulReviewDecisionPayloadSchema,
    ),
    artifactRecord(
      z.literal("export_artifact"),
      maulExportArtifactPayloadSchema,
    ),
    artifactRecord(
      z.literal("thumbnail_direction"),
      maulThumbnailDirectionPayloadSchema,
    ),
    artifactRecord(
      z.literal("thumbnail_candidate"),
      maulThumbnailCandidatePayloadSchema,
    ),
  ])
  .superRefine((artifact, ctx) => {
    if (
      artifact.artifactType === "source_asset" &&
      artifact.lineage.rootSourceAssetId !== artifact.artifactId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A source asset must be its own rootSourceAssetId",
        path: ["lineage", "rootSourceAssetId"],
      });
    }
  });

export const maulProjectCreateRequestSchema = z
  .object({
    tenantId: idSchema.optional(),
    creatorId: idSchema,
    goal: maulGoalSchema,
    platform: maulPlatformSchema,
    sourceProfile: maulV1SourceProfileSchema,
    brandKitId: idSchema.nullable().optional().default(null),
    treatmentPreference: maulTreatmentIdSchema
      .nullable()
      .optional()
      .default(null),
    requestedShortCount: z.number().int().min(1).max(3).optional().default(3),
    requestedThumbnailCount: z
      .number()
      .int()
      .min(1)
      .max(4)
      .optional()
      .default(4),
    targetDurationMs: z
      .object({
        min: z.number().int().min(1000),
        max: z.number().int().min(1000),
      })
      .optional()
      .default({ min: 20000, max: 45000 }),
    source: maulSourceAssetPayloadSchema,
  })
  .superRefine((request, ctx) => {
    if (!request.source.hasAudio || !request.source.hasVideo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source"],
        message:
          "MAUL V1 Source Scope requires one source with both audible dialogue and video.",
      });
    }
  });

export const maulOperationSchema = z.enum([
  "analyze_timeline",
  "render_short",
  "generate_thumbnails",
  "retention_cleanup",
  "outcome_ingestion",
]);

export const maulOperationJobStatusSchema = z.enum([
  "queued",
  "leased",
  "cancellation_requested",
  "cancelled",
  "completed",
  "failed",
]);

export const maulOperationJobSubmitSchema = z.object({
  operation: maulOperationSchema,
  payload: z.record(z.string(), z.unknown()),
  estimatedCostUsd: z.number().nonnegative().max(1000),
  maxAttempts: z.number().int().min(1).max(8).optional().default(3),
});

export const maulOperationJobSchema = z.object({
  schemaVersion: z.literal("maul-operation-job/v1"),
  id: idSchema,
  projectId: idSchema,
  tenantId: idSchema,
  creatorId: idSchema,
  idempotencyKey: idSchema,
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/i),
  operation: maulOperationSchema,
  payload: z.record(z.string(), z.unknown()),
  status: maulOperationJobStatusSchema,
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  estimatedCostUsd: z.number().nonnegative(),
  actualCostUsd: z.number().nonnegative().nullable(),
  workerId: idSchema.nullable(),
  leaseToken: idSchema.nullable(),
  leaseExpiresAt: isoDateSchema.nullable(),
  nextAttemptAt: isoDateSchema.nullable(),
  cancellationReason: z.string().trim().min(1).nullable(),
  result: z.record(z.string(), z.unknown()).nullable(),
  error: z.string().trim().min(1).nullable(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  completedAt: isoDateSchema.nullable(),
});

export const maulOperationTelemetryEventSchema = z.object({
  schemaVersion: z.literal("maul-operation-telemetry/v1"),
  eventId: idSchema,
  jobId: idSchema,
  projectId: idSchema,
  tenantId: idSchema,
  type: z.enum([
    "queued",
    "leased",
    "lease_recovered",
    "retry_scheduled",
    "cancel_requested",
    "cancelled",
    "completed",
    "failed",
  ]),
  attempt: z.number().int().nonnegative(),
  detail: z.record(z.string(), z.unknown()),
  createdAt: isoDateSchema,
});

export const maulFeedbackRequestSchema = z.object({
  subjectArtifactId: idSchema,
  treatmentId: maulTreatmentIdSchema,
  verdict: z.enum(["winner", "acceptable", "loser", "blocked"]),
  rating: z.number().int().min(1).max(5),
  failureClasses: z.array(idSchema).default([]),
  notes: z.string().trim().min(1),
  explicitCreatorPreference: z.boolean(),
});

export const maulFeedbackEventSchema = maulFeedbackRequestSchema.extend({
  schemaVersion: z.literal("maul-feedback/v1"),
  eventId: idSchema,
  projectId: idSchema,
  tenantId: idSchema,
  creatorId: idSchema,
  createdAt: isoDateSchema,
});

const maulTasteTreatmentStatsSchema = z.object({
  wins: z.number().int().nonnegative(),
  acceptable: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  averageRating: z.number().min(0).max(5),
  explicitPreferenceSignals: z.number().int().nonnegative(),
  lastFeedbackAt: isoDateSchema.nullable(),
});

export const maulCreatorTasteMemorySchema = z.object({
  schemaVersion: z.literal("maul-creator-taste-memory/v1"),
  tenantId: idSchema,
  creatorId: idSchema,
  advisoryOnly: z.literal(true),
  silentIntentMutationAllowed: z.literal(false),
  explicitPreferredTreatmentIds: z.array(maulTreatmentIdSchema),
  treatmentStats: z.record(z.string(), maulTasteTreatmentStatsSchema),
  feedbackEventIds: z.array(idSchema),
  updatedAt: isoDateSchema,
});

export const maulOutcomeRequestSchema = z.object({
  subjectArtifactId: idSchema,
  treatmentId: maulTreatmentIdSchema,
  observedAt: isoDateSchema,
  metrics: z.object({
    views: z.number().int().nonnegative(),
    averageWatchPercentage: confidenceSchema,
    clickThroughRate: confidenceSchema,
  }),
});

export const maulOutcomeEventSchema = maulOutcomeRequestSchema.extend({
  schemaVersion: z.literal("maul-outcome/v1"),
  eventId: idSchema,
  projectId: idSchema,
  tenantId: idSchema,
  creatorId: idSchema,
  createdAt: isoDateSchema,
});

export const maulPatternMemorySchema = z.object({
  schemaVersion: z.literal("maul-pattern-memory/v1"),
  advisoryOnly: z.literal(true),
  treatments: z.record(
    z.string(),
    z.object({
      wins: z.number().int().nonnegative(),
      acceptable: z.number().int().nonnegative(),
      losses: z.number().int().nonnegative(),
      blocked: z.number().int().nonnegative(),
      failureCounts: z.record(z.string(), z.number().int().nonnegative()),
      outcomes: z.object({
        count: z.number().int().nonnegative(),
        averageViews: z.number().nonnegative(),
        averageWatchPercentage: confidenceSchema,
        averageClickThroughRate: confidenceSchema,
      }),
    }),
  ),
  updatedAt: isoDateSchema,
});

const artifactCreate = <
  Type extends z.ZodLiteral<string>,
  Payload extends z.ZodTypeAny,
>(
  artifactType: Type,
  payload: Payload,
) =>
  z.object({
    artifactType,
    parentArtifactIds: z.array(idSchema).min(1),
    producedBy: z
      .object({
        module: z.string().trim().min(1),
        version: z.string().trim().min(1),
      })
      .optional(),
    payload,
  });

type MaulCreatableArtifactType = Exclude<
  keyof MaulArtifactPayloadByType,
  "source_asset"
>;

type MaulArtifactCreateRequestContract = {
  [ArtifactType in MaulCreatableArtifactType]: {
    artifactType: ArtifactType;
    parentArtifactIds: string[];
    producedBy?: {module: string; version: string};
    payload: MaulArtifactPayloadByType[ArtifactType];
  };
}[MaulCreatableArtifactType];

export const maulArtifactCreateRequestSchema: z.ZodType<
  MaulArtifactCreateRequestContract,
  z.ZodTypeDef,
  unknown
> = z.discriminatedUnion(
  "artifactType",
  [
    artifactCreate(z.literal("analysis"), maulAnalysisPayloadSchema),
    artifactCreate(
      z.literal("editorial_timeline"),
      maulEditorialTimelinePayloadSchema,
    ),
    artifactCreate(z.literal("candidate"), maulCandidatePayloadSchema),
    artifactCreate(z.literal("planner_audit"), maulPlannerAuditPayloadSchema),
    artifactCreate(
      z.literal("observation_snapshot"),
      maulObservationSnapshotPayloadSchema,
    ),
    artifactCreate(
      z.literal("candidate_narrative"),
      maulCandidateNarrativePayloadSchema,
    ),
    artifactCreate(
      z.literal("editorial_beat_map"),
      maulEditorialBeatMapPayloadSchema,
    ),
    artifactCreate(
      z.literal("text_chunk_plan"),
      maulTextChunkPlanPayloadSchema,
    ),
    artifactCreate(
      z.literal("text_placement_plan"),
      maulTextPlacementPlanPayloadSchema,
    ),
    artifactCreate(
      z.literal("text_animation_plan"),
      maulTextAnimationPlanPayloadSchema,
    ),
    artifactCreate(
      z.literal("typography_motion_plan"),
      maulTypographyMotionPlanPayloadSchema,
    ),
    artifactCreate(
      z.literal("framing_camera_plan"),
      maulFramingCameraPlanPayloadSchema,
    ),
    artifactCreate(z.literal("visual_plan"), maulVisualPlanPayloadSchema),
    artifactCreate(
      z.literal("dialogue_audio_plan"),
      maulDialogueAudioPlanPayloadSchema,
    ),
    artifactCreate(
      z.literal("capability_selection"),
      maulCapabilitySelectionPayloadSchema,
    ),
    artifactCreate(
      z.literal("adapter_decision"),
      maulAdapterDecisionPayloadSchema,
    ),
    artifactCreate(
      z.literal("art_direction_plan"),
      maulArtDirectionPlanPayloadSchema,
    ),
    artifactCreate(
      z.literal("context_assembly_plan"),
      maulContextAssemblyPlanPayloadSchema,
    ),
    artifactCreate(
      z.literal("shot_intent_matrix"),
      maulShotIntentMatrixPayloadSchema,
    ),
    artifactCreate(
      z.literal("text_opportunity_plan"),
      maulTextOpportunityPlanPayloadSchema,
    ),
    artifactCreate(z.literal("revision_plan"), maulRevisionPlanPayloadSchema),
    artifactCreate(
      z.literal("planning_bundle"),
      maulPlanningBundlePayloadSchema,
    ),
    artifactCreate(
      z.literal("render_manifest"),
      maulUnifiedShortRenderManifestSchema,
    ),
    artifactCreate(z.literal("render_preview"), maulRenderPreviewPayloadSchema),
    artifactCreate(
      z.literal("perceptual_truth"),
      maulPerceptualTruthPayloadSchema,
    ),
    artifactCreate(
      z.literal("quality_evidence_bundle"),
      maulQualityEvidenceBundlePayloadSchema,
    ),
    artifactCreate(
      z.literal("treatment_genome"),
      maulTreatmentGenomePayloadSchema,
    ),
    artifactCreate(
      z.literal("reference_corpus_item"),
      maulReferenceCorpusItemPayloadSchema,
    ),
    artifactCreate(
      z.literal("review_decision"),
      maulReviewDecisionPayloadSchema,
    ),
    artifactCreate(
      z.literal("export_artifact"),
      maulExportArtifactPayloadSchema,
    ),
    artifactCreate(
      z.literal("thumbnail_direction"),
      maulThumbnailDirectionPayloadSchema,
    ),
    artifactCreate(
      z.literal("thumbnail_candidate"),
      maulThumbnailCandidatePayloadSchema,
    ),
  ],
);

export const maulAuditEventSchema = z.object({
  schemaVersion: z.literal("maul-audit-event/v1"),
  eventId: idSchema,
  projectId: idSchema,
  canonicalJobId: idSchema,
  runId: idSchema,
  sequence: z.number().int().positive(),
  type: z.enum([
    "project_created",
    "artifact_registered",
    "project_resumed",
    "project_status_changed",
    "quality_truth_evaluated",
    "perceptual_truth_evaluated",
  ]),
  artifactId: idSchema.nullable(),
  detail: z.record(z.unknown()),
  createdAt: isoDateSchema,
});

export type MaulProject = z.infer<typeof maulProjectSchema>;
export type MaulProjectCreateRequest = z.infer<
  typeof maulProjectCreateRequestSchema
>;
export type MaulArtifactRecord = z.infer<typeof maulArtifactRecordSchema>;
export type MaulArtifactCreateRequest = z.infer<
  typeof maulArtifactCreateRequestSchema
>;
export type MaulArtifactType = z.infer<typeof maulArtifactTypeSchema>;
export type MaulArtifactLineage = z.infer<typeof maulArtifactLineageSchema>;
export type MaulAuditEvent = z.infer<typeof maulAuditEventSchema>;
export type MaulPlannerAuditPayload = z.infer<
  typeof maulPlannerAuditPayloadSchema
>;
export type MaulObservationSnapshotPayload = z.infer<
  typeof maulObservationSnapshotPayloadSchema
>;
export type MaulCandidateNarrativePayload = z.infer<
  typeof maulCandidateNarrativePayloadSchema
>;
export type MaulEditorialBeatMapPayload = z.infer<
  typeof maulEditorialBeatMapPayloadSchema
>;
export type MaulTextChunkPlanPayload = z.infer<
  typeof maulTextChunkPlanPayloadSchema
>;
export type MaulTextPlacementPlanPayload = z.infer<
  typeof maulTextPlacementPlanPayloadSchema
>;
export type MaulTextAnimationPlanPayload = z.infer<
  typeof maulTextAnimationPlanPayloadSchema
>;
export type MaulTypographyMotionPlanV1Payload = z.infer<
  typeof maulTypographyMotionPlanV1PayloadSchema
>;
export type MaulTypographyMotionPlanV2Payload = z.infer<
  typeof maulTypographyMotionPlanV2PayloadSchema
>;
export type MaulTypographyMotionPlanV3Payload = z.infer<
  typeof maulTypographyMotionPlanV3PayloadSchema
>;
export type MaulTypographyMotionPlanPayload = z.infer<
  typeof maulTypographyMotionPlanPayloadSchema
>;
export type MaulFramingCameraPlanPayload = z.infer<
  typeof maulFramingCameraPlanPayloadSchema
>;
export type MaulVisualPlanPayload = z.infer<typeof maulVisualPlanPayloadSchema>;
export type MaulVisualAssetPack = z.infer<typeof maulVisualAssetPackSchema>;
export type MaulVisualTrack = z.infer<typeof maulVisualTrackSchema>;
export type MaulDialogueAudioPlanPayload = z.infer<
  typeof maulDialogueAudioPlanPayloadSchema
>;
export type MaulCapabilitySelectionPayload = z.infer<
  typeof maulCapabilitySelectionPayloadSchema
>;
export type MaulAdapterDecisionPayload = z.infer<
  typeof maulAdapterDecisionPayloadSchema
>;
export type MaulArtDirectionPlanPayload = z.infer<
  typeof maulArtDirectionPlanPayloadSchema
>;
export type MaulContextAssemblyPlanPayload = z.infer<
  typeof maulContextAssemblyPlanPayloadSchema
>;
export type MaulShotIntentMatrixPayload = z.infer<
  typeof maulShotIntentMatrixPayloadSchema
>;
export type MaulTextOpportunityPlanPayload = z.infer<
  typeof maulTextOpportunityPlanPayloadSchema
>;
export type MaulRevisionPlanPayload = z.infer<
  typeof maulRevisionPlanPayloadSchema
>;
export type MaulPlanningBundlePayload = z.infer<
  typeof maulPlanningBundlePayloadSchema
>;
export type MaulPlanningBundleV1Payload = z.infer<
  typeof maulPlanningBundleV1PayloadSchema
>;
export type MaulPlanningBundleV2Payload = z.infer<
  typeof maulPlanningBundleV2PayloadSchema
>;
export type MaulPlanningBundleV3Payload = z.infer<
  typeof maulPlanningBundleV3PayloadSchema
>;
export type MaulPlanningBundleRequest = z.infer<
  typeof maulPlanningBundleRequestSchema
>;
export type MaulPlanningArtifactIdsV1 = z.infer<
  typeof maulPlanningArtifactIdsV1Schema
>;
export type MaulPlanningArtifactIdsV2 = z.infer<
  typeof maulPlanningArtifactIdsV2Schema
>;
export type MaulPlanningArtifactIdsV3 = z.infer<
  typeof maulPlanningArtifactIdsV3Schema
>;
export type MaulUnifiedShortRenderManifest = z.infer<
  typeof maulUnifiedShortRenderManifestSchema
>;
export type MaulUnifiedShortRenderManifestV1 = z.infer<
  typeof maulUnifiedShortRenderManifestV1Schema
>;
export type MaulUnifiedShortRenderManifestV2 = z.infer<
  typeof maulUnifiedShortRenderManifestV2Schema
>;
export type MaulUnifiedShortRenderManifestV3 = z.infer<
  typeof maulUnifiedShortRenderManifestV3Schema
>;
export type MaulQualityTruthProof = z.infer<
  typeof maulQualityTruthProofSchema
>;
export type MaulQualityTruthProofV1 = z.infer<
  typeof maulQualityTruthProofV1Schema
>;
export type MaulQualityTruthProofV2 = z.infer<
  typeof maulQualityTruthProofV2Schema
>;
export type MaulQualityTruthResult = z.infer<
  typeof maulQualityTruthResultSchema
>;
export type MaulPlacementOutcome = z.infer<typeof maulPlacementOutcomeSchema>;
export type MaulPerceptualFailureLabel = z.infer<
  typeof maulPerceptualFailureLabelSchema
>;
export type MaulCreativeResult = z.infer<typeof maulCreativeResultSchema>;
export type MaulRenderPreviewPayload = z.infer<
  typeof maulRenderPreviewPayloadSchema
>;
export type MaulPerceptualTruthPayload = z.infer<
  typeof maulPerceptualTruthPayloadSchema
>;
export type MaulQualityEvidenceBundlePayload = z.infer<
  typeof maulQualityEvidenceBundlePayloadSchema
>;
export type MaulRuntimeContracts = z.infer<typeof maulRuntimeContractsSchema>;
export type MaulS4ReleaseContract = z.infer<typeof maulS4ReleaseContractSchema>;
export type MaulV1SourceProfile = z.infer<typeof maulV1SourceProfileSchema>;
export type MaulExportQualityGate = z.infer<typeof maulExportQualityGateSchema>;
export type MaulEditorialTimelinePayload = z.infer<
  typeof maulEditorialTimelinePayloadSchema
>;
export type MaulTreatmentGenomePayload = z.infer<
  typeof maulTreatmentGenomePayloadSchema
>;
export type MaulReferenceCorpusItemPayload = z.infer<
  typeof maulReferenceCorpusItemPayloadSchema
>;
export type MaulReferenceIngestRequest = z.infer<
  typeof maulReferenceIngestRequestSchema
>;
export type MaulReferenceReviewRequest = z.infer<
  typeof maulReferenceReviewRequestSchema
>;
export type MaulEditorialTimelineRequest = z.infer<
  typeof maulEditorialTimelineRequestSchema
>;
export type MaulTreatmentCatalogRequest = z.infer<
  typeof maulTreatmentCatalogRequestSchema
>;
export type MaulCandidateGenerationRequest = z.infer<
  typeof maulCandidateGenerationRequestSchema
>;
export type MaulReviewDecisionRequest = z.infer<
  typeof maulReviewDecisionRequestSchema
>;
export type MaulShortRenderRequest = z.infer<
  typeof maulShortRenderRequestSchema
>;
export type MaulRenderPreviewRequest = z.infer<
  typeof maulRenderPreviewRequestSchema
>;
export type MaulThumbnailDirectionPayload = z.infer<
  typeof maulThumbnailDirectionPayloadSchema
>;
export type MaulThumbnailGenerationRequest = z.infer<
  typeof maulThumbnailGenerationRequestSchema
>;
export type MaulThumbnailReviewRequest = z.infer<
  typeof maulThumbnailReviewRequestSchema
>;
export type MaulOperationJob = z.infer<typeof maulOperationJobSchema>;
export type MaulOperationJobSubmit = z.infer<
  typeof maulOperationJobSubmitSchema
>;
export type MaulOperationTelemetryEvent = z.infer<
  typeof maulOperationTelemetryEventSchema
>;
export type MaulFeedbackRequest = z.infer<typeof maulFeedbackRequestSchema>;
export type MaulFeedbackEvent = z.infer<typeof maulFeedbackEventSchema>;
export type MaulCreatorTasteMemory = z.infer<
  typeof maulCreatorTasteMemorySchema
>;
export type MaulOutcomeRequest = z.infer<typeof maulOutcomeRequestSchema>;
export type MaulOutcomeEvent = z.infer<typeof maulOutcomeEventSchema>;
export type MaulPatternMemory = z.infer<typeof maulPatternMemorySchema>;
