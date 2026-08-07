import {z} from "zod";

const idSchema = z.string().trim().min(1);

export const maulEditorialLockupTokenStyleSchema = z.object({
  tokenId: idSchema,
  role: z.enum(["primary", "accent"]),
  fontAssetId: idSchema,
  fontFamily: idSchema,
  fontStyle: z.enum(["normal", "italic", "oblique"]),
  fontWeight: z.number().int().min(1).max(1000),
  offsetXPx: z.number().min(-512).max(512),
  offsetYPx: z.number().min(-512).max(512),
  fontSizeScale: z.number().min(0.5).max(2),
  rotationDeg: z.number().min(-18).max(18),
  zIndex: z.number().int().min(0).max(20),
  opacity: z.number().min(0).max(1),
}).strict();

export const maulEditorialLockupSchema = z.object({
  schemaVersion: z.enum([
    "maul-editorial-lockup/v1",
    "maul-editorial-lockup/v2",
  ]),
  mode: z.enum([
    "single_line_hinge",
    "script_tag_overlap",
    "stacked_phrase",
    "word_ladder",
  ]),
  referenceGrammarId: z.enum([
    "stacked_support_hero",
    "inline_italic_hinge",
    "inline_mixed_word_splice",
    "script_over_foundation",
    "annotated_keyword",
    "quiet_luxury",
    "poster_stack",
  ]).optional(),
  caseMode: z.enum(["source_preserving", "display_allowed"]).optional(),
  primaryTokenIds: z.array(idSchema).min(1).max(8),
  accentTokenIds: z.array(idSchema).max(8),
  tokenStyles: z.array(maulEditorialLockupTokenStyleSchema).min(1).max(8),
  overlap: z.object({
    enabled: z.boolean(),
    ratio: z.number().min(0).max(0.65),
    direction: z.enum(["none", "accent_over_primary", "primary_over_accent"]),
    rationale: idSchema,
  }).strict(),
  choreography: z.object({
    mode: z.enum([
      "forward_word_reveal",
      "position_locked_word_reveal",
      "position_locked_letter_reveal",
    ]),
    tokenOrder: z.array(idSchema).min(1).max(8),
    staggerMs: z.number().int().min(0).max(500),
    entryDurationMs: z.number().int().positive().max(1000),
    localRevealEnvelope: z.object({
      maxTranslateXPx: z.number().min(0).max(256),
      maxTranslateYPx: z.number().min(0).max(256),
      maxScaleDelta: z.number().min(0).max(1),
      annotationPaddingPx: z.number().min(0).max(128),
    }).strict().optional(),
  }).strict(),
  placement: z.object({
    mode: z.literal("position_locked"),
    anchor: z.literal("word_box"),
    finalTransformIdentity: z.literal(true),
  }).strict().optional(),
  annotations: z.array(z.object({
    annotationId: idSchema,
    kind: z.enum([
      "underline",
      "circle",
      "highlight",
      "strike_through",
      "arrow",
    ]),
    tokenIds: z.array(idSchema).min(1).max(8),
    paddingPx: z.number().min(0).max(128),
  }).strict()).max(3).optional(),
  rationale: idSchema,
}).strict().superRefine((lockup, ctx) => {
  if (lockup.schemaVersion === "maul-editorial-lockup/v2") {
    if (!lockup.referenceGrammarId || !lockup.caseMode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referenceGrammarId"],
        message: "V2 editorial lockups require a reference grammar and case policy.",
      });
    }
    if (!lockup.placement) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["placement"],
        message: "V2 editorial lockups require a position-locked placement contract.",
      });
    }
    if (!lockup.choreography.localRevealEnvelope) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["choreography", "localRevealEnvelope"],
        message: "V2 editorial lockups require a bounded local reveal envelope.",
      });
    }
  }
  const styleIds = lockup.tokenStyles.map((style) => style.tokenId);
  const allTokenIds = [...lockup.primaryTokenIds, ...lockup.accentTokenIds];
  if (new Set(styleIds).size !== styleIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tokenStyles"],
      message: "Editorial lockup token styles must be unique.",
    });
  }
  if (new Set(allTokenIds).size !== allTokenIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["accentTokenIds"],
      message: "Editorial lockup primary and accent token IDs must be disjoint.",
    });
  }
  if (styleIds.some((tokenId) => !allTokenIds.includes(tokenId))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tokenStyles"],
      message: "Every styled token must be assigned to a primary or accent layer.",
    });
  }
  if (allTokenIds.some((tokenId) => !styleIds.includes(tokenId))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tokenStyles"],
      message: "Every lockup token must have an explicit visual style.",
    });
  }
  lockup.tokenStyles.forEach((style, index) => {
    const expectedLayer = lockup.primaryTokenIds.includes(style.tokenId)
      ? "primary"
      : lockup.accentTokenIds.includes(style.tokenId)
        ? "accent"
        : null;
    if (expectedLayer && style.role !== expectedLayer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tokenStyles", index, "role"],
        message: "Editorial lockup token style role must match its assigned layer.",
      });
    }
  });
  if (
    new Set(lockup.choreography.tokenOrder).size !== lockup.choreography.tokenOrder.length ||
    lockup.choreography.tokenOrder.some((tokenId) => !allTokenIds.includes(tokenId)) ||
    lockup.choreography.tokenOrder.length !== allTokenIds.length
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["choreography", "tokenOrder"],
      message: "Editorial lockup choreography must cover each token exactly once.",
    });
  }
  const annotations = lockup.annotations ?? [];
  annotations.forEach((annotation, index) => {
    if (annotation.tokenIds.some((tokenId) => !allTokenIds.includes(tokenId))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["annotations", index, "tokenIds"],
        message: "Every annotation token must belong to the lockup.",
      });
    }
  });
  if (
    lockup.referenceGrammarId !== "poster_stack" &&
    annotations.length > 1
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["annotations"],
      message: "Only one annotation is permitted outside the poster grammar.",
    });
  }
  if (!lockup.overlap.enabled && lockup.overlap.ratio !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["overlap", "ratio"],
      message: "Disabled overlap must have a zero overlap ratio.",
    });
  }
  if (lockup.overlap.enabled && lockup.accentTokenIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["overlap"],
      message: "Intentional overlap requires an accent layer.",
    });
  }
});

export type MaulEditorialLockupTokenStyle = z.infer<typeof maulEditorialLockupTokenStyleSchema>;
export type MaulEditorialLockup = z.infer<typeof maulEditorialLockupSchema>;
