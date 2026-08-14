import {z} from "zod";
import {maulEditorialLockupSchema} from "./maul-editorial-lockup.js";

import {
  joinShortsTextTokens,
  shortsTextPacingSchema,
  shortsTextSemanticRoleSchema,
  shortsTextStyleSchema,
} from "./shorts-text-chunking.js";

const idSchema = z.string().trim().min(1);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);
const confidenceSchema = z.number().min(0).max(1);

const outputIntervalSchema = z
  .object({
    outputStartMs: z.number().int().nonnegative(),
    outputEndMs: z.number().int().positive(),
  })
  .refine((interval) => interval.outputEndMs > interval.outputStartMs, {
    message: "Output intervals require positive duration.",
  });

export const maulNormalizedBoxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .refine(
    (box) => box.x + box.width <= 1 && box.y + box.height <= 1,
    {message: "Normalized box must stay inside [0,1] bounds."},
  );

const normalizedBoxesOverlap = (
  first: z.infer<typeof maulNormalizedBoxSchema>,
  second: z.infer<typeof maulNormalizedBoxSchema>,
): boolean =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y;

export const maulTextOutputSpanSchema = outputIntervalSchema;

export const maulStableTextTokenV2Schema = z
  .object({
    tokenId: idSchema,
    transcriptWordIndex: z.number().int().nonnegative(),
    text: z.string().trim().min(1).max(256),
    sourceStartMs: z.number().int().nonnegative(),
    sourceEndMs: z.number().int().positive(),
    outputSpans: z.array(maulTextOutputSpanSchema).min(1),
    outputStartMs: z.number().int().nonnegative(),
    outputEndMs: z.number().int().positive(),
  })
  .superRefine((token, ctx) => {
    if (token.sourceEndMs <= token.sourceStartMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceEndMs"],
        message: "Token source intervals require positive duration.",
      });
    }

    token.outputSpans.forEach((span, index) => {
      const previous = token.outputSpans[index - 1];
      if (previous && span.outputStartMs < previous.outputEndMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["outputSpans", index],
          message:
            "Token output spans must be ordered and non-overlapping.",
        });
      }
    });

    const firstSpan = token.outputSpans[0];
    const lastSpan = token.outputSpans[token.outputSpans.length - 1];
    if (
      firstSpan &&
      lastSpan &&
      (token.outputStartMs !== firstSpan.outputStartMs ||
        token.outputEndMs !== lastSpan.outputEndMs)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["outputStartMs"],
        message:
          "Token covering output interval must match its first and last output spans.",
      });
    }
  });

export const maulProtectedEntitySchema = z
  .object({
    entityId: idSchema,
    tokenIds: z.array(idSchema).min(1),
    transcriptWordIndices: z.array(z.number().int().nonnegative()).min(1),
    text: z.string().trim().min(1),
    kind: z.enum([
      "currency",
      "percentage",
      "plain_quantity",
      "measurable_result",
      "year_or_date",
      "duration",
      "range",
      "ratio_or_multiplier",
      "ordinal_or_ranking",
      "list_count",
      "phone_like_identifier",
      "opaque_identifier",
      "oversized_static_identifier",
    ]),
    parsedValue: z.union([z.string(), z.number()]).nullable(),
    unit: z.string().trim().min(1).nullable(),
    confidence: confidenceSchema,
  })
  .refine(
    (entity) => entity.tokenIds.length === entity.transcriptWordIndices.length,
    {
      path: ["transcriptWordIndices"],
      message:
        "Protected entity token IDs and transcript indices must have equal length.",
    },
  );

export const maulProtectedPauseSchema = z
  .object({
    pauseId: idSchema,
    kind: z.enum([
      "rhetorical_pause",
      "emotional_pause",
      "comprehension_pause",
    ]),
    sourceStartMs: z.number().int().nonnegative(),
    sourceEndMs: z.number().int().positive(),
    outputStartMs: z.number().int().nonnegative(),
    outputEndMs: z.number().int().positive(),
    precedingTokenId: idSchema.nullable(),
    followingTokenId: idSchema.nullable(),
    verified: z.literal(true),
    reason: z.string().trim().min(1),
  })
  .superRefine((pause, ctx) => {
    if (
      pause.sourceEndMs <= pause.sourceStartMs ||
      pause.outputEndMs <= pause.outputStartMs
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Protected pause intervals require positive duration.",
      });
    }
  });

export const maulTextChunkV2Schema = z
  .object({
    chunkId: idSchema,
    tokenIds: z.array(idSchema).min(1).max(8),
    text: z.string().trim().min(1),
    outputStartMs: z.number().int().nonnegative(),
    outputEndMs: z.number().int().positive(),
    semanticRole: shortsTextSemanticRoleSchema,
    emphasis: z.object({
      tokenIds: z.array(idSchema).min(1),
      text: z.string().trim().min(1),
      level: z.enum(["support", "key", "hero"]),
    }),
    holdAcrossProtectedPause: z.boolean(),
    rationale: z.string().trim().min(1),
    confidence: confidenceSchema,
  })
  .refine((chunk) => chunk.outputEndMs > chunk.outputStartMs, {
    path: ["outputEndMs"],
    message: "Chunk output intervals require positive duration.",
  });

const maulChunkInferenceSchema = z
  .object({
    status: z.enum([
      "invoked",
      "skipped_missing_credentials",
      "skipped_rate_limited",
      "failed_request",
      "failed_invalid_response",
    ]),
    provider: z.literal("openai_compatible"),
    baseUrl: z.string().url(),
    model: z.string().trim().min(1),
    requestHash: sha256Schema.nullable(),
    responseHash: sha256Schema.nullable(),
    fallbackReason: z.string().trim().min(1).nullable(),
  })
  .superRefine((inference, ctx) => {
    if (
      inference.status === "invoked" &&
      (!inference.requestHash ||
        !inference.responseHash ||
        inference.fallbackReason)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Invoked inference requires request and response hashes without a fallback reason.",
      });
    }
    if (inference.status !== "invoked" && !inference.fallbackReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fallbackReason"],
        message: "Non-invoked inference requires an explicit fallback reason.",
      });
    }
  });

export const maulShortsTextChunkPlanV2CoreSchema = z
  .object({
    schemaVersion: z.literal("maul-shorts-text-chunk-plan/v2"),
    transcriptHash: sha256Schema,
    timelineHash: sha256Schema,
    chunkProposalHash: sha256Schema,
    outputDurationMs: z.number().int().positive(),
    pacing: shortsTextPacingSchema,
    style: shortsTextStyleSchema,
    strategy: z.enum(["llm_assisted", "deterministic_fallback"]),
    tokens: z.array(maulStableTextTokenV2Schema).min(1),
    chunks: z.array(maulTextChunkV2Schema).min(1),
    protectedEntities: z.array(maulProtectedEntitySchema),
    protectedPauses: z.array(maulProtectedPauseSchema),
    inference: maulChunkInferenceSchema,
    inputHashes: z.object({
      transcript: sha256Schema,
      editorialTimeline: sha256Schema,
      chunkProposal: sha256Schema,
    }),
  })
  .superRefine((plan, ctx) => {
    const tokenIds = plan.tokens.map((token) => token.tokenId);
    if (new Set(tokenIds).size !== tokenIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tokens"],
        message: "Stable token IDs must be unique.",
      });
    }

    plan.tokens.forEach((token, tokenIndex) => {
      const previous = plan.tokens[tokenIndex - 1];
      if (
        previous &&
        (token.transcriptWordIndex <= previous.transcriptWordIndex ||
          token.sourceStartMs < previous.sourceEndMs ||
          token.outputStartMs < previous.outputEndMs)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tokens", tokenIndex],
          message:
            "Stable tokens must be ordered by authoritative transcript, source, and output intervals.",
        });
      }
      if (
        token.outputEndMs > plan.outputDurationMs ||
        token.outputSpans.some(
          (span) => span.outputEndMs > plan.outputDurationMs,
        )
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tokens", tokenIndex, "outputEndMs"],
          message: "Token output spans must stay inside outputDurationMs.",
        });
      }
    });

    const chunkIds = plan.chunks.map((chunk) => chunk.chunkId);
    if (new Set(chunkIds).size !== chunkIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chunks"],
        message: "Chunk IDs must be unique.",
      });
    }

    const flattenedChunkTokenIds = plan.chunks.flatMap(
      (chunk) => chunk.tokenIds,
    );
    if (
      flattenedChunkTokenIds.length !== tokenIds.length ||
      flattenedChunkTokenIds.some((tokenId, index) => tokenId !== tokenIds[index])
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chunks"],
        message: "Chunks must cover every stable token exactly once and in order.",
      });
    }

    const tokenById = new Map(plan.tokens.map((token) => [token.tokenId, token]));
    plan.chunks.forEach((chunk, chunkIndex) => {
      const previous = plan.chunks[chunkIndex - 1];
      if (previous && chunk.outputStartMs < previous.outputEndMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["chunks", chunkIndex, "outputStartMs"],
          message: "Chunks must be ordered and non-overlapping.",
        });
      }

      const chunkTokens = chunk.tokenIds
        .map((tokenId) => tokenById.get(tokenId))
        .filter(
          (token): token is z.infer<typeof maulStableTextTokenV2Schema> =>
            Boolean(token),
        );
      const firstToken = chunkTokens[0];
      const lastToken = chunkTokens[chunkTokens.length - 1];
      if (
        chunkTokens.length !== chunk.tokenIds.length ||
        !firstToken ||
        !lastToken ||
        chunk.outputStartMs !== firstToken.outputStartMs ||
        chunk.outputEndMs !== lastToken.outputEndMs
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["chunks", chunkIndex],
          message:
            "Chunk output intervals must exactly cover their stable tokens.",
        });
      }
      if (
        joinShortsTextTokens(chunkTokens.map((token) => token.text)) !==
        chunk.text
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["chunks", chunkIndex, "text"],
          message: "Chunk text must reconstruct its stable tokens exactly.",
        });
      }

      const emphasisPositions = chunk.emphasis.tokenIds.map((tokenId) =>
        chunk.tokenIds.indexOf(tokenId),
      );
      const emphasisBelongsToChunk = emphasisPositions.every(
        (position, index) =>
          position >= 0 &&
          (index === 0 || position > (emphasisPositions[index - 1] ?? -1)),
      );
      if (!emphasisBelongsToChunk) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["chunks", chunkIndex, "emphasis", "tokenIds"],
          message:
            "Every ordered, unique emphasis token must belong to its chunk.",
        });
      }
      const emphasisText = joinShortsTextTokens(
        chunk.emphasis.tokenIds
          .map((tokenId) => tokenById.get(tokenId)?.text)
          .filter((text): text is string => Boolean(text)),
      );
      if (emphasisText !== chunk.emphasis.text) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["chunks", chunkIndex, "emphasis", "text"],
          message: "Emphasis text must reconstruct its stable tokens exactly.",
        });
      }
    });

    const knownTokenIds = new Set(tokenIds);
    plan.protectedEntities.forEach((entity, entityIndex) => {
      if (entity.tokenIds.some((tokenId) => !knownTokenIds.has(tokenId))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["protectedEntities", entityIndex, "tokenIds"],
          message: "Protected entities must reference stable plan tokens.",
        });
      }
    });
    plan.protectedPauses.forEach((pause, pauseIndex) => {
      if (
        (pause.precedingTokenId &&
          !knownTokenIds.has(pause.precedingTokenId)) ||
        (pause.followingTokenId && !knownTokenIds.has(pause.followingTokenId))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["protectedPauses", pauseIndex],
          message: "Protected pauses must reference stable plan tokens.",
        });
      }
    });

    if (
      plan.transcriptHash !== plan.inputHashes.transcript ||
      plan.timelineHash !== plan.inputHashes.editorialTimeline ||
      plan.chunkProposalHash !== plan.inputHashes.chunkProposal
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inputHashes"],
        message: "Chunk-plan input hashes must match their authoritative hashes.",
      });
    }
  });

export const maulTypographyCompatibilityProfileSchema = z.object({
  profileId: idSchema,
  family: z.string().trim().min(1),
  approvedFontAssets: z
    .array(
      z.object({
        assetId: idSchema,
        family: z.string().trim().min(1),
        weights: z.array(z.number().int().positive()).min(1),
      }),
    )
    .min(1),
  loadedFallback: z.object({
    assetId: idSchema,
    family: z.string().trim().min(1),
    weight: z.number().int().positive(),
  }),
  metrics: z
    .object({
      fingerprint: sha256Schema,
      maxGlyphWidthEm: z.number().positive(),
      maxLineHeightEm: z.number().positive(),
      minimumFontSizePx: z.number().positive(),
      maximumFontSizePx: z.number().positive(),
      minimumLineHeight: z.number().positive(),
      maximumLineHeight: z.number().positive(),
    })
    .superRefine((metrics, ctx) => {
      if (
        metrics.maximumFontSizePx < metrics.minimumFontSizePx ||
        metrics.maximumLineHeight < metrics.minimumLineHeight
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Compatibility metric maximums must be greater than or equal to minimums.",
        });
      }
    }),
});

export const maulOutputCompositionIntervalSchema = z
  .object({
    intervalId: idSchema,
    sceneId: idSchema,
    discontinuityId: idSchema,
    variantId: idSchema,
    outputStartMs: z.number().int().nonnegative(),
    outputEndMs: z.number().int().positive(),
    transformHash: sha256Schema,
    sourceViewport: maulNormalizedBoxSchema,
    sourceOccupancy: z.array(maulNormalizedBoxSchema).min(1),
    paddedNonSourceRegions: z.array(maulNormalizedBoxSchema),
    compositionDirection: z
      .enum([
        "editorial_asymmetry",
        "poster_hero",
        "subject_integrated",
        "restrained_minimal",
      ])
      .nullable()
      .default(null),
    textAnchor: z
      .object({
        box: maulNormalizedBoxSchema,
        maximumEnvelope: maulNormalizedBoxSchema,
        alignment: z.enum(["left", "center", "right"]),
        subjectInteraction: z
          .object({
            policy: z.enum(["avoid_subject", "controlled_overlap"]),
            faceInterference: confidenceSchema,
            evidenceIds: z.array(idSchema).min(1),
          })
          .optional(),
      })
      .nullable()
      .default(null),
    crop: maulNormalizedBoxSchema,
    scale: z.object({
      x: z.number().positive(),
      y: z.number().positive(),
    }),
  })
  .superRefine((interval, ctx) => {
    if (interval.outputEndMs <= interval.outputStartMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["outputEndMs"],
        message: "Output Composition intervals require positive duration.",
      });
    }
    if (
      interval.paddedNonSourceRegions.some((paddedRegion) =>
        interval.sourceOccupancy.some((sourceRegion) =>
          normalizedBoxesOverlap(paddedRegion, sourceRegion),
        ),
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paddedNonSourceRegions"],
        message:
          "Padded non-source regions cannot overlap declared source occupancy.",
      });
    }
  });

export const maulMinimumLegibilityPrimitiveSchema = z.discriminatedUnion(
  "kind",
  [
    z.object({kind: z.literal("none")}),
    z.object({
      kind: z.literal("outline"),
      widthPx: z.number().positive(),
      color: z.string().trim().min(1),
    }),
    z.object({
      kind: z.literal("shadow"),
      blurPx: z.number().nonnegative(),
      offsetXPx: z.number(),
      offsetYPx: z.number(),
      color: z.string().trim().min(1),
      minimumOpacity: confidenceSchema,
    }),
    z.object({
      kind: z.literal("solid_plate"),
      paddingXPx: z.number().nonnegative(),
      paddingYPx: z.number().nonnegative(),
      cornerRadiusPx: z.number().nonnegative(),
      backgroundColor: z.string().trim().min(1),
      minimumOpacity: confidenceSchema,
    }),
  ],
);

export const maulTypographyProfileTransformSchema = z
  .object({
    uniformScale: z.number().positive(),
    intrinsicWidthPx: z.number().positive(),
    intrinsicHeightPx: z.number().positive(),
    finalWidthPx: z.number().positive(),
    finalHeightPx: z.number().positive(),
  })
  .strict()
  .superRefine((transform, ctx) => {
    if (
      Math.abs(
        transform.finalWidthPx -
          transform.intrinsicWidthPx * transform.uniformScale,
      ) > 0.01 ||
      Math.abs(
        transform.finalHeightPx -
          transform.intrinsicHeightPx * transform.uniformScale,
      ) > 0.01
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Profile transform final dimensions must equal intrinsic dimensions times uniform scale.",
      });
    }
  });

export const maulTypographyProfileColorResolutionSchema = z
  .object({
    mode: z.enum(["profile", "light_text", "dark_text"]),
    backgroundLuminance: z.number().min(0).max(1).nullable(),
    layers: z
      .array(
        z
          .object({
            layerName: idSchema,
            requestedColor: z.string().trim().min(1),
            resolvedColor: z.string().trim().min(1),
            contrastRatio: z.number().positive().nullable(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const maulTextPlacementSegmentSchema = z
  .object({
    segmentId: idSchema,
    chunkId: idSchema,
    sceneId: idSchema,
    discontinuityId: idSchema,
    outputStartMs: z.number().int().nonnegative(),
    outputEndMs: z.number().int().positive(),
    selectedCompositionVariantId: idSchema,
    selectedTransformHash: sha256Schema,
    tokenIds: z.array(idSchema).min(1).max(8),
    lines: z
      .array(
        z.object({
          lineId: idSchema,
          tokenIds: z.array(idSchema).min(1),
          text: z.string().trim().min(1),
        }),
      )
      .min(1),
    family: z.enum(["measured", "editorial", "personal"]),
    variantId: idSchema,
    box: maulNormalizedBoxSchema,
    maximumEnvelope: maulNormalizedBoxSchema,
    alignment: z.enum(["left", "center", "right"]),
    profileTransform: maulTypographyProfileTransformSchema.optional(),
    profileColorResolution:
      maulTypographyProfileColorResolutionSchema.optional(),
    kineticPlacement: z.object({
      traitId: idSchema,
      evidenceTokenIds: z.array(idSchema).min(1),
      intent: z.literal("lower_or_center_9x16"),
      influence: z.literal("score_bias_only"),
    }).strict().optional(),
    compatibility: z.object({
      profileId: idSchema,
      metricsFingerprint: sha256Schema,
      nominalFontSizePx: z.number().positive(),
      lineHeight: z.number().positive(),
      hierarchyScale: z.number().positive(),
    }),
    depth: z.object({
      desired: z.enum(["front", "behind_subject_requested"]),
      resolved: z.enum(["front", "front_fallback", "behind_subject"]),
      treatmentState: z.enum([
        "not_requested",
        "accounted_deferred",
        "executed",
      ]),
    }),
    minimumLegibilityPrimitive: maulMinimumLegibilityPrimitiveSchema,
    hardGates: z
      .array(
        z.object({
          gateId: idSchema,
          status: z.enum(["pass", "fail", "unknown"]),
          evidenceId: idSchema.nullable(),
          rationale: z.string().trim().min(1),
        }),
      )
      .min(1),
    scores: z.record(idSchema, confidenceSchema).refine(
      (scores) => Object.keys(scores).length > 0,
      {message: "Placement segments require named scores."},
    ),
    rationale: z.string().trim().min(1),
    confidence: confidenceSchema,
    fallbackCode: idSchema.nullable(),
    fallbackReason: z.string().trim().min(1).nullable(),
    editorialLockup: maulEditorialLockupSchema.optional(),
  })
  .superRefine((segment, ctx) => {
    if (segment.outputEndMs <= segment.outputStartMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["outputEndMs"],
        message: "Placement segment intervals require positive duration.",
      });
    }

    const lineTokenIds = segment.lines.flatMap((line) => line.tokenIds);
    if (
      lineTokenIds.length !== segment.tokenIds.length ||
      lineTokenIds.some((tokenId, index) => tokenId !== segment.tokenIds[index])
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lines"],
        message:
          "Placement lines must cover segment token IDs exactly once and in order.",
      });
    }

    if (
      segment.maximumEnvelope.x > segment.box.x ||
      segment.maximumEnvelope.y > segment.box.y ||
      segment.maximumEnvelope.x + segment.maximumEnvelope.width <
        segment.box.x + segment.box.width ||
      segment.maximumEnvelope.y + segment.maximumEnvelope.height <
        segment.box.y + segment.box.height
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maximumEnvelope"],
        message: "Maximum envelope must contain the static placement box.",
      });
    }

    if (segment.hardGates.some((gate) => gate.status !== "pass")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hardGates"],
        message: "Every selected placement's hard gates must pass.",
      });
    }

    const behindSubjectIsExecutable =
      segment.depth.resolved === "behind_subject" ||
      segment.depth.treatmentState === "executed";
    if (behindSubjectIsExecutable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["depth"],
        message: "Behind-subject depth is not executable in Placement V1.",
      });
    }
    if (
      segment.depth.desired === "behind_subject_requested" &&
      (segment.depth.resolved !== "front_fallback" ||
        segment.depth.treatmentState !== "accounted_deferred")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["depth"],
        message:
          "Behind-subject requests require a front fallback and accounted-deferred state.",
      });
    }

    if (Boolean(segment.fallbackCode) !== Boolean(segment.fallbackReason)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fallbackReason"],
        message: "Placement fallback codes require matching reasons.",
      });
    }

    if (
      segment.editorialLockup &&
      (segment.editorialLockup.choreography.tokenOrder.length !==
        segment.tokenIds.length ||
        segment.editorialLockup.choreography.tokenOrder.some(
          (tokenId, index) => tokenId !== segment.tokenIds[index],
        ))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["editorialLockup", "choreography", "tokenOrder"],
        message:
          "Editorial lockup choreography must match the placement token order exactly.",
      });
    }
  });

export const maulTextPlacementPlanCoreSchema = z
  .object({
    schemaVersion: z.literal("maul-text-placement-plan/v1"),
    textChunkPlanArtifactId: idSchema,
    textChunkPlanHash: sha256Schema,
    catalog: z.object({
      catalogId: idSchema,
      version: z.string().trim().min(1),
      hash: sha256Schema,
    }),
    scorePolicy: z.object({
      policyId: idSchema,
      version: z.string().trim().min(1),
      hash: sha256Schema,
      dimensionWeights: z
        .record(idSchema, z.number().nonnegative())
        .refine((weights) => Object.keys(weights).length > 0, {
          message: "Score policy requires named dimension weights.",
        }),
      beamWidth: z.number().int().positive(),
      planningHorizonSegments: z.number().int().min(1).max(5),
    }),
    platformProfile: z.object({
      profileId: idSchema,
      platform: z.enum([
        "instagram_reels",
        "youtube_shorts",
        "tiktok",
        "linkedin",
        "other",
      ]),
      version: z.string().trim().min(1),
      output: z.object({
        width: z.literal(1080),
        height: z.literal(1920),
        fps: z.literal(30),
      }),
      safeRegion: maulNormalizedBoxSchema,
    }),
    compatibilityProfiles: z
    .array(maulTypographyCompatibilityProfileSchema)
      .min(1),
    compositionIntervals: z
      .array(maulOutputCompositionIntervalSchema)
      .min(1),
    status: z.enum(["planned", "blocked"]),
    blockingReason: z.string().trim().min(1).nullable(),
    foregroundChunkIds: z.array(idSchema).min(1).optional(),
    segments: z.array(maulTextPlacementSegmentSchema),
    inputHashes: z.object({
      textChunkPlan: sha256Schema,
      outputCompositionTrack: sha256Schema,
      platformProfile: sha256Schema,
      compatibilityProfile: sha256Schema,
      catalog: sha256Schema,
      scorePolicy: sha256Schema,
    }),
  })
  .superRefine((plan, ctx) => {
    if (plan.status === "planned" && plan.segments.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["segments"],
        message: "Planned placement requires at least one segment.",
      });
    }
    if (plan.status === "blocked" && !plan.blockingReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["blockingReason"],
        message: "Blocked placement requires a blocking reason.",
      });
    }
    if (plan.status === "planned" && plan.blockingReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["blockingReason"],
        message: "Planned placement cannot carry a blocking reason.",
      });
    }

    const compositionIds = plan.compositionIntervals.map(
      (interval) => interval.intervalId,
    );
    if (new Set(compositionIds).size !== compositionIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["compositionIntervals"],
        message: "Output Composition interval IDs must be unique.",
      });
    }
    const previousCompositionByVariant = new Map<
      string,
      z.infer<typeof maulOutputCompositionIntervalSchema>
    >();
    plan.compositionIntervals.forEach((interval, index) => {
      const previous = previousCompositionByVariant.get(interval.variantId);
      if (previous && interval.outputStartMs < previous.outputEndMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["compositionIntervals", index],
          message:
            "Output Composition intervals must be ordered and non-overlapping within each variant.",
        });
      }
      previousCompositionByVariant.set(interval.variantId, interval);
    });

    const segmentIds = plan.segments.map((segment) => segment.segmentId);
    if (new Set(segmentIds).size !== segmentIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["segments"],
        message: "Placement segment IDs must be unique.",
      });
    }
    if (
      plan.foregroundChunkIds &&
      new Set(plan.foregroundChunkIds).size !== plan.foregroundChunkIds.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["foregroundChunkIds"],
        message: "Foreground typography chunk IDs must be unique.",
      });
    }
    plan.segments.forEach((segment, index) => {
      const previous = plan.segments[index - 1];
      if (previous && segment.outputStartMs < previous.outputEndMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["segments", index, "outputStartMs"],
          message: "Placement segments must be ordered and non-overlapping.",
        });
      }
      const selectedComposition = plan.compositionIntervals.find(
        (interval) =>
          interval.variantId === segment.selectedCompositionVariantId &&
          interval.transformHash === segment.selectedTransformHash &&
          interval.sceneId === segment.sceneId &&
          interval.discontinuityId === segment.discontinuityId &&
          interval.outputStartMs <= segment.outputStartMs &&
          interval.outputEndMs >= segment.outputEndMs,
      );
      if (!selectedComposition) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["segments", index, "selectedCompositionVariantId"],
          message:
            "Placement segments must select a matching Output Composition interval and transform.",
        });
      }

      const profile = plan.compatibilityProfiles.find(
        (candidate) =>
          candidate.profileId === segment.compatibility.profileId,
      );
      if (
        !profile ||
        profile.metrics.fingerprint !==
          segment.compatibility.metricsFingerprint ||
        (!segment.profileTransform &&
          (segment.compatibility.nominalFontSizePx *
            segment.compatibility.hierarchyScale <
            profile.metrics.minimumFontSizePx ||
            segment.compatibility.nominalFontSizePx *
              segment.compatibility.hierarchyScale >
              profile.metrics.maximumFontSizePx)) ||
        segment.compatibility.lineHeight <
          profile.metrics.minimumLineHeight ||
        segment.compatibility.lineHeight > profile.metrics.maximumLineHeight
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["segments", index, "compatibility"],
          message:
            "Placement segment metrics must fit the selected compatibility profile.",
        });
      }
    });

    if (
      plan.textChunkPlanHash !== plan.inputHashes.textChunkPlan ||
      plan.catalog.hash !== plan.inputHashes.catalog ||
      plan.scorePolicy.hash !== plan.inputHashes.scorePolicy
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inputHashes"],
        message: "Placement input hashes must match governed inputs.",
      });
    }
  });

export type MaulNormalizedBox = z.infer<typeof maulNormalizedBoxSchema>;
export type MaulTextOutputSpan = z.infer<typeof maulTextOutputSpanSchema>;
export type MaulStableTextTokenV2 = z.infer<
  typeof maulStableTextTokenV2Schema
>;
export type MaulProtectedEntity = z.infer<typeof maulProtectedEntitySchema>;
export type MaulProtectedPause = z.infer<typeof maulProtectedPauseSchema>;
export type MaulTextChunkV2 = z.infer<typeof maulTextChunkV2Schema>;
export type MaulShortsTextChunkPlanV2Core = z.infer<
  typeof maulShortsTextChunkPlanV2CoreSchema
>;
export type MaulTypographyCompatibilityProfile = z.infer<
  typeof maulTypographyCompatibilityProfileSchema
>;
export type MaulTypographyProfileTransform = z.infer<
  typeof maulTypographyProfileTransformSchema
>;
export type MaulTypographyProfileColorResolution = z.infer<
  typeof maulTypographyProfileColorResolutionSchema
>;
export type MaulOutputCompositionInterval = z.infer<
  typeof maulOutputCompositionIntervalSchema
>;
export type MaulMinimumLegibilityPrimitive = z.infer<
  typeof maulMinimumLegibilityPrimitiveSchema
>;
export type MaulTextPlacementSegment = z.infer<
  typeof maulTextPlacementSegmentSchema
>;
export type MaulTextPlacementPlanCore = z.infer<
  typeof maulTextPlacementPlanCoreSchema
>;
