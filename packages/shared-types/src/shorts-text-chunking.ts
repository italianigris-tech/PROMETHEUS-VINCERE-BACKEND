import {z} from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);
const confidenceSchema = z.number().min(0).max(1);
const MAX_SHORT_VIDEO_DURATION_MS = 180_000;
const MAX_SHORT_TRANSCRIPT_WORDS = 1000;
const MAX_SHORT_TRANSCRIPT_TEXT_CHARS = 50_000;

export const joinShortsTextTokens = (tokens: readonly string[]): string =>
  tokens.reduce((text, rawToken) => {
    const token = rawToken.trim();
    if (!token) return text;
    if (
      !text ||
      /^[,.;:!?%)}\]»”’]/u.test(token) ||
      /[(\[{«“‘]$/u.test(text)
    ) {
      return `${text}${token}`;
    }
    return `${text} ${token}`;
  }, "");

const normalizeTranscriptText = (text: string): string =>
  text.replace(/\s+/gu, " ").trim();

export const shortsTextPacingSchema = z.enum([
  "slow",
  "measured",
  "fast",
  "very_fast",
]);

export const shortsTextStyleSchema = z.enum([
  "restrained",
  "editorial",
  "cinematic",
  "direct_response",
]);

export const shortsTextSemanticRoleSchema = z.enum([
  "hook",
  "context",
  "claim",
  "contrast",
  "proof",
  "payoff",
  "cta",
  "transition",
]);

export const shortsTextTimedWordSchema = z
  .object({
    text: z.string().trim().min(1).max(256),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
    confidence: confidenceSchema.nullable().optional().default(null),
  })
  .refine((word) => word.endMs > word.startMs, {
    message: "Timed transcript words require positive duration.",
  });

const shortsTextTranscriptSchema = z
  .object({
    language: z.string().trim().min(1).max(32),
    text: z.string().trim().min(1).max(MAX_SHORT_TRANSCRIPT_TEXT_CHARS),
    words: z
      .array(shortsTextTimedWordSchema)
      .min(1)
      .max(MAX_SHORT_TRANSCRIPT_WORDS),
  })
  .superRefine((transcript, ctx) => {
    transcript.words.forEach((word, index) => {
      const previous = transcript.words[index - 1];
      if (previous && word.startMs < previous.endMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["words", index, "startMs"],
          message: "Timed transcript words must be ordered and cannot overlap.",
        });
      }
    });
    const reconstructedText = joinShortsTextTokens(
      transcript.words.map((word) => word.text),
    );
    if (
      normalizeTranscriptText(transcript.text) !==
      normalizeTranscriptText(reconstructedText)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["text"],
        message: "Transcript text must match the timed word tokens exactly.",
      });
    }
  });

export const shortsTextChunkingRequestSchema = z
  .object({
    transcript: shortsTextTranscriptSchema,
    videoDurationMs: z
      .number()
      .int()
      .positive()
      .max(MAX_SHORT_VIDEO_DURATION_MS),
    pacing: shortsTextPacingSchema,
    style: shortsTextStyleSchema,
    editorialContext: z
      .object({
        platform: z.string().trim().min(1).max(128).nullable().default(null),
        objective: z.string().trim().min(1).max(1000).nullable().default(null),
        audience: z.string().trim().min(1).max(1000).nullable().default(null),
        notes: z.string().trim().min(1).max(4000).nullable().default(null),
      })
      .optional()
      .default({
        platform: null,
        objective: null,
        audience: null,
        notes: null,
      }),
    constraints: z
      .object({
        minWordsPerChunk: z.number().int().min(1).max(4).default(1),
        maxWordsPerChunk: z.number().int().min(1).max(8).default(8),
        preserveEveryWord: z.literal(true).default(true),
      })
      .refine(
        (constraints) =>
          constraints.minWordsPerChunk <= constraints.maxWordsPerChunk,
        {message: "Minimum chunk size cannot exceed maximum chunk size."},
      )
      .optional()
      .default({
        minWordsPerChunk: 1,
        maxWordsPerChunk: 8,
        preserveEveryWord: true,
      }),
  })
  .superRefine((request, ctx) => {
    request.transcript.words.forEach((word, wordIndex) => {
      if (word.endMs > request.videoDurationMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["transcript", "words", wordIndex, "endMs"],
          message: "Timed transcript words cannot extend beyond the video duration.",
        });
      }
    });
    const wordCount = request.transcript.words.length;
    const minimumChunkCount = Math.ceil(
      wordCount / request.constraints.maxWordsPerChunk,
    );
    const maximumChunkCount = Math.floor(
      wordCount / request.constraints.minWordsPerChunk,
    );
    if (minimumChunkCount > maximumChunkCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["constraints"],
        message: `The ${wordCount}-word transcript cannot be partitioned into ${request.constraints.minWordsPerChunk}-${request.constraints.maxWordsPerChunk}-word chunks.`,
      });
    }
  });

export const shortsTextChunkSchema = z
  .object({
    chunkId: z.string().trim().min(1),
    startWordIndex: z.number().int().nonnegative(),
    endWordIndex: z.number().int().nonnegative(),
    wordCount: z.number().int().positive().max(8),
    text: z.string().trim().min(1),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
    semanticRole: shortsTextSemanticRoleSchema,
    emphasis: z.object({
      wordIndices: z.array(z.number().int().nonnegative()).min(1),
      text: z.string().trim().min(1),
      level: z.enum(["support", "key", "hero"]),
    }),
    rationale: z.string().trim().min(1),
    confidence: confidenceSchema,
  })
  .superRefine((chunk, ctx) => {
    if (chunk.endWordIndex < chunk.startWordIndex) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endWordIndex"],
        message: "Chunk word ranges must be ordered.",
      });
    }
    if (chunk.wordCount !== chunk.endWordIndex - chunk.startWordIndex + 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wordCount"],
        message: "Chunk wordCount must match its inclusive word range.",
      });
    }
    if (chunk.endMs <= chunk.startMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endMs"],
        message: "Chunk timing must have positive duration.",
      });
    }
    chunk.emphasis.wordIndices.forEach((wordIndex, emphasisIndex) => {
      const previousWordIndex =
        chunk.emphasis.wordIndices[emphasisIndex - 1];
      if (
        previousWordIndex !== undefined &&
        wordIndex <= previousWordIndex
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["emphasis", "wordIndices", emphasisIndex],
          message: "Emphasis indices must be ordered and unique.",
        });
      }
      if (
        wordIndex < chunk.startWordIndex ||
        wordIndex > chunk.endWordIndex
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["emphasis", "wordIndices", emphasisIndex],
          message: "Every emphasis index must belong to its chunk.",
        });
      }
    });
  });

export const shortsTextChunkPlanSchema = z
  .object({
    schemaVersion: z.literal("maul-shorts-text-chunk-plan/v1"),
    transcriptHash: sha256Schema,
    videoDurationMs: z.number().int().positive(),
    pacing: shortsTextPacingSchema,
    style: shortsTextStyleSchema,
    strategy: z.enum(["llm_assisted", "deterministic_fallback"]),
    chunks: z.array(shortsTextChunkSchema).min(1),
    coverage: z.object({
      totalWordCount: z.number().int().positive(),
      coveredWordCount: z.number().int().nonnegative(),
      omittedWordIndices: z.array(z.number().int().nonnegative()),
      duplicatedWordIndices: z.array(z.number().int().nonnegative()),
      exact: z.boolean(),
    }),
    inference: z.object({
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
      usage: z
        .object({
          promptTokens: z.number().int().nonnegative().nullable(),
          completionTokens: z.number().int().nonnegative().nullable(),
          totalTokens: z.number().int().nonnegative().nullable(),
          requestId: z.string().trim().min(1).nullable(),
          latencyMs: z.number().finite().nonnegative().nullable(),
        })
        .strict()
        .optional(),
    }),
    validationFindings: z.array(
      z.object({
        code: z.string().trim().min(1),
        severity: z.enum(["blocking", "major", "advisory"]),
        message: z.string().trim().min(1),
        chunkIndex: z.number().int().nonnegative().nullable().default(null),
      }),
    ),
  })
  .superRefine((plan, ctx) => {
    let expectedStart = 0;
    plan.chunks.forEach((chunk, chunkIndex) => {
      if (chunk.startWordIndex !== expectedStart) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["chunks", chunkIndex, "startWordIndex"],
          message: "Chunk ranges must cover every word contiguously.",
        });
      }
      expectedStart = chunk.endWordIndex + 1;
    });

    const exactCoverage =
      plan.coverage.exact &&
      plan.coverage.coveredWordCount === plan.coverage.totalWordCount &&
      plan.coverage.omittedWordIndices.length === 0 &&
      plan.coverage.duplicatedWordIndices.length === 0 &&
      expectedStart === plan.coverage.totalWordCount;
    if (!exactCoverage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["coverage"],
        message: "A chunk plan must cover every transcript word exactly once.",
      });
    }

    if (
      plan.inference.status === "invoked" &&
      (!plan.inference.requestHash ||
        !plan.inference.responseHash ||
        plan.inference.fallbackReason)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inference"],
        message: "Invoked inference requires request and response hashes without a fallback reason.",
      });
    }
    if (
      plan.inference.status !== "invoked" &&
      !plan.inference.fallbackReason
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inference", "fallbackReason"],
        message: "Non-invoked inference requires an explicit fallback reason.",
      });
    }
  });

export type ShortsTextChunkingRequest = z.infer<
  typeof shortsTextChunkingRequestSchema
>;
export type ShortsTextChunk = z.infer<typeof shortsTextChunkSchema>;
export type ShortsTextChunkPlan = z.infer<typeof shortsTextChunkPlanSchema>;
