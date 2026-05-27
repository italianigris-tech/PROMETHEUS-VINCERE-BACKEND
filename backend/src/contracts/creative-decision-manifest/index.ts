import {z} from "zod";

const manifestWordSchema = z.object({
  text: z.string().min(1),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  confidence: z.number().min(0).max(1).optional()
});

const motionDialectSchema = z.object({
  sceneRestraintApplied: z.boolean(),
  segments: z.array(z.object({
    label: z.string().min(1),
    moment: z.enum(["Hook", "Expansion", "Reinforcement", "Pause/Restraint"]),
    startMs: z.number().nonnegative(),
    endMs: z.number().nonnegative(),
    intensity: z.number().min(0).max(1),
    highIntensityDensity: z.number().min(0).max(1),
    text: z.string().min(1),
    dialect: z.object({
      motionPreset: z.enum(["hookWhip", "expansionGlide", "reinforcementLock", "pauseRestraint"]),
      axis: z.enum(["x", "y"]),
      yDriftPx: z.number(),
      opacityRange: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
      whip: z.boolean(),
      heavyWeight: z.boolean(),
      durationScale: z.number().positive(),
      staggerMs: z.number().nonnegative(),
      intensity: z.number().min(0).max(1)
    })
  }))
});

const manifestAuthoritySchema = z.object({
  authorityVersion: z.string().min(1),
  solePreviewTruth: z.boolean(),
  timingTruth: z.object({
    durationMs: z.number().positive(),
    startMs: z.number().nonnegative(),
    endMs: z.number().nonnegative(),
    fps: z.number().positive()
  }),
  typographyTruth: z.object({
    mode: z.string().min(1),
    primaryFamily: z.string().min(1),
    fallbackAllowed: z.boolean()
  }),
  cameraTruth: z.record(z.string(), z.unknown()).default({}),
  transitionTruth: z.record(z.string(), z.unknown()).default({}),
  assetTruth: z.object({
    requiredAssetIds: z.array(z.string()),
    missingAssetIds: z.array(z.string())
  }),
  pacingTruth: z.object({
    intensity: z.number().min(0).max(1),
    rhythmContinuityScore: z.number().min(0).max(1).optional(),
    pacingConfidenceScore: z.number().min(0).max(1).optional()
  }),
  diagnosticsTruth: z.object({
    degradedStages: z.array(z.string()),
    visibleFailureCount: z.number().int().nonnegative(),
    fallbackVisible: z.boolean()
  }),
  confidenceTruth: z.object({
    cognitiveConfidence: z.number().min(0).max(1),
    renderConfidence: z.number().min(0).max(1),
    temporalConfidence: z.number().min(0).max(1)
  }),
  temporalTruth: z.record(z.string(), z.unknown()).default({}),
  stageTruth: z.object({
    currentStage: z.string().min(1),
    allowedAdapters: z.array(z.string()),
    frontendMayPlan: z.literal(false)
  })
});

export const creativeDecisionManifestSchema = z.object({
  manifestVersion: z.string().min(1),
  jobId: z.string().min(1),
  sceneId: z.string().min(1),
  source: z.object({
    videoUrl: z.string().min(1),
    transcriptSegment: z.object({
      text: z.string().min(1),
      startMs: z.number().nonnegative(),
      endMs: z.number().nonnegative(),
      words: z.array(manifestWordSchema).optional()
    })
  }),
  scene: z.object({
    durationMs: z.number().positive(),
    aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().positive()
  }),
  intent: z.object({
    rhetoricalIntent: z.enum([
      "authority",
      "revelation",
      "contrast",
      "proof",
      "tension",
      "emphasis",
      "transition",
      "setup",
      "payoff",
      "calm",
      "shock",
      "premium_explain"
    ]),
    emotionalTone: z.enum([
      "controlled",
      "urgent",
      "aspirational",
      "serious",
      "cinematic",
      "luxury",
      "educational",
      "intense"
    ]),
    intensity: z.number().min(0).max(1)
  }),
  typography: z.object({
    mode: z.enum([
      "cinematic_statement",
      "editorial_emphasis",
      "kinetic_core_words",
      "minimal_premium",
      "authority_lower_third",
      "svg_longform_typography_v1"
    ]),
    primaryFont: z.object({
      family: z.string().min(1),
      source: z.enum(["custom_ingested", "system", "fallback"]),
      fileUrl: z.string().optional(),
      role: z.string().min(1)
    }),
    secondaryFont: z.object({
      family: z.string().min(1),
      source: z.enum(["custom_ingested", "system", "fallback"]),
      fileUrl: z.string().optional(),
      role: z.string().min(1)
    }).optional(),
    fontPairing: z.object({
      graphUsed: z.boolean(),
      score: z.number().min(0).max(1).optional(),
      reason: z.string().min(1)
    }),
    coreWords: z.array(z.object({
      word: z.string().min(1),
      reason: z.string().min(1),
      treatment: z.enum(["scale", "weight", "italic", "underline", "glow", "mask_reveal", "separate_line"])
    })),
    linePlan: z.object({
      lines: z.array(z.string().min(1)),
      maxLines: z.number().int().positive(),
      maxCharsPerLine: z.number().int().positive(),
      allowWidows: z.boolean()
    })
  }),
  animation: z.object({
    engine: z.literal("gsap"),
    family: z.enum([
      "blur_slide_up_stagger",
      "mask_reveal",
      "editorial_cut",
      "word_by_word_rise",
      "kinetic_scale_pulse",
      "premium_fade_drift",
      "svg_longform_typography_v1",
      "custom_retrieved"
    ]),
    retrievedFromMilvus: z.boolean(),
    retrievedAnimationId: z.string().optional(),
    easing: z.string().min(1),
    staggerMs: z.number().nonnegative(),
    entryMs: z.number().nonnegative(),
    holdMs: z.number().nonnegative(),
    exitMs: z.number().nonnegative(),
    motionIntensity: z.number().min(0).max(1),
    avoid: z.array(z.string())
  }),
  layout: z.object({
    region: z.enum([
      "center",
      "lower_third",
      "upper_third",
      "left_editorial",
      "right_editorial",
      "full_frame_typography"
    ]),
    safeArea: z.object({
      top: z.number().nonnegative(),
      right: z.number().nonnegative(),
      bottom: z.number().nonnegative(),
      left: z.number().nonnegative()
    }),
    maxWidthPercent: z.number().positive().max(100),
    alignment: z.enum(["left", "center", "right"]),
    preventOverlap: z.boolean(),
    zIndexPlan: z.array(z.object({
      layer: z.string().min(1),
      zIndex: z.number().int()
    }))
  }),
  renderBudget: z.object({
    previewResolution: z.enum(["480p", "720p", "1080p"]),
    previewFps: z.union([z.literal(24), z.literal(30)]),
    finalResolution: z.enum(["1080p", "4k"]),
    allowHeavyEffectsInPreview: z.boolean(),
    finalOnlyEffects: z.array(z.string())
  }),
  motionDialect: motionDialectSchema.optional(),
  style: z.object({
    requestedStyle: z.string().min(1).optional(),
    motionTier: z.string().min(1).optional(),
    captionProfileId: z.string().min(1).optional(),
    pacingStyle: z.string().min(1).optional(),
    speechRateEstimate: z.number().positive().nullable().optional()
  }).optional(),
  diagnostics: z.object({
    manifestCreatedAt: z.string().min(1),
    milvusUsed: z.boolean(),
    fontGraphUsed: z.boolean(),
    customFontsUsed: z.boolean(),
    fallbackUsed: z.boolean(),
    fallbackReasons: z.array(z.string()),
    legacyOverlayUsed: z.boolean(),
    remotionUsed: z.boolean(),
    hyperframesUsed: z.boolean(),
    overlapCheckPassed: z.boolean().optional(),
    warnings: z.array(z.string()),
    degradedStages: z.array(z.string()).optional(),
    visibleFailureCount: z.number().int().nonnegative().optional(),
    cognitiveConfidence: z.number().min(0).max(1).optional(),
    temporalConfidence: z.number().min(0).max(1).optional()
  }),
  authority: manifestAuthoritySchema.optional()
});

export type CreativeDecisionManifest = z.infer<typeof creativeDecisionManifestSchema>;
export type CreativeDecisionManifestAuthority = z.infer<typeof manifestAuthoritySchema>;
