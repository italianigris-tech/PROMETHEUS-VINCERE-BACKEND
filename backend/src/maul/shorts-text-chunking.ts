import {createHash} from "node:crypto";

import {
  joinShortsTextTokens,
  shortsTextChunkingRequestSchema,
  shortsTextChunkPlanSchema,
  type ShortsTextChunk,
  type ShortsTextChunkPlan,
  type ShortsTextChunkingRequest,
} from "@prometheus/shared-types";
import {z} from "zod";

const semanticRoleSchema = z.enum([
  "hook",
  "context",
  "claim",
  "contrast",
  "proof",
  "payoff",
  "cta",
  "transition",
]);

const sha256 = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const shortsTextChunkProposalSchema = z.object({
  schemaVersion: z.literal("maul-shorts-text-chunk-proposal/v1"),
  chunks: z
    .array(
      z
        .object({
          startWordIndex: z.number().int().nonnegative(),
          endWordIndex: z.number().int().nonnegative(),
          semanticRole: semanticRoleSchema,
          emphasisWordIndices: z.array(z.number().int().nonnegative()).min(1),
          emphasisLevel: z.enum(["support", "key", "hero"]),
        })
        .strict(),
    )
    .min(1),
}).strict();

export type ShortsTextChunkProposal = z.infer<
  typeof shortsTextChunkProposalSchema
>;

type InferenceReceipt = ShortsTextChunkPlan["inference"];

const transcriptHash = (request: ShortsTextChunkingRequest): string =>
  sha256({
    language: request.transcript.language,
    text: request.transcript.text,
    words: request.transcript.words,
  });

const chunkId = ({
  hash,
  startWordIndex,
  endWordIndex,
}: {
  hash: string;
  startWordIndex: number;
  endWordIndex: number;
}): string =>
  `chunk_${startWordIndex}_${endWordIndex}_${sha256({hash, startWordIndex, endWordIndex}).slice(0, 12)}`;

const cleanToken = (value: string): string =>
  value.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "they",
  "this",
  "to",
  "was",
  "we",
  "were",
  "with",
  "you",
]);

const emphasisIndices = (
  request: ShortsTextChunkingRequest,
  startWordIndex: number,
  endWordIndex: number,
): number[] => {
  const candidates = request.transcript.words
    .slice(startWordIndex, endWordIndex + 1)
    .map((word, offset) => {
      const token = cleanToken(word.text);
      const index = startWordIndex + offset;
      const lexicalScore = STOP_WORDS.has(token) ? 0 : token.length;
      const semanticBonus = /\d/.test(token) || /^(never|not|without)$/.test(token)
        ? 4
        : 0;
      return {index, score: lexicalScore + semanticBonus};
    })
    .sort((left, right) => right.score - left.score || left.index - right.index);

  return [candidates[0]?.index ?? endWordIndex];
};

const roleForChunk = ({
  request,
  startWordIndex,
  endWordIndex,
  chunkIndex,
  chunkCount,
}: {
  request: ShortsTextChunkingRequest;
  startWordIndex: number;
  endWordIndex: number;
  chunkIndex: number;
  chunkCount: number;
}): ShortsTextChunk["semanticRole"] => {
  if (chunkIndex === 0) return "hook";
  if (chunkIndex === chunkCount - 1) return "payoff";
  const text = request.transcript.words
    .slice(startWordIndex, endWordIndex + 1)
    .map((word) => cleanToken(word.text))
    .join(" ");
  if (/\b(but|however|instead|rather|yet)\b/.test(text)) return "contrast";
  if (/\b(because|proof|example|evidence)\b|\d/.test(text)) return "proof";
  return "context";
};

const targetWordsForPacing = (
  request: ShortsTextChunkingRequest,
): number => {
  const target = {
    slow: 8,
    measured: 7,
    fast: 5,
    very_fast: 4,
  }[request.pacing];
  return Math.max(
    request.constraints.minWordsPerChunk,
    Math.min(target, request.constraints.maxWordsPerChunk),
  );
};

const canPartitionWordCount = (
  wordCount: number,
  minWordsPerChunk: number,
  maxWordsPerChunk: number,
): boolean => {
  if (wordCount === 0) return true;
  const minimumChunkCount = Math.ceil(wordCount / maxWordsPerChunk);
  const maximumChunkCount = Math.floor(wordCount / minWordsPerChunk);
  return minimumChunkCount <= maximumChunkCount;
};

const proposalBoundaries = (
  request: ShortsTextChunkingRequest,
): Array<{startWordIndex: number; endWordIndex: number}> => {
  const boundaries: Array<{startWordIndex: number; endWordIndex: number}> = [];
  const words = request.transcript.words;
  const targetWords = targetWordsForPacing(request);
  const {minWordsPerChunk, maxWordsPerChunk} = request.constraints;
  let startWordIndex = 0;

  while (startWordIndex < words.length) {
    const remainingWordCount = words.length - startWordIndex;
    const feasibleSizes = Array.from(
      {
        length:
          Math.min(maxWordsPerChunk, remainingWordCount) -
          minWordsPerChunk +
          1,
      },
      (_value, offset) => minWordsPerChunk + offset,
    ).filter((size) =>
      canPartitionWordCount(
        remainingWordCount - size,
        minWordsPerChunk,
        maxWordsPerChunk,
      ),
    );
    if (feasibleSizes.length === 0) {
      throw new Error(
        `The ${remainingWordCount} remaining transcript words cannot be partitioned into ${minWordsPerChunk}-${maxWordsPerChunk}-word chunks.`,
      );
    }

    const preferredSizes = feasibleSizes
      .filter((size) => size <= targetWords)
      .sort((left, right) => right - left);
    const rankedSizes = preferredSizes.length > 0
      ? preferredSizes
      : [...feasibleSizes].sort((left, right) => left - right);
    const sentenceSize = [...rankedSizes]
      .sort((left, right) => left - right)
      .find((size) =>
        /[.!?]["')\]]?$/.test(words[startWordIndex + size - 1]!.text),
      );
    const clauseSize = rankedSizes.find((size) =>
      /[,;:]["')\]]?$/.test(words[startWordIndex + size - 1]!.text),
    );
    const selectedSize = sentenceSize ?? clauseSize ?? rankedSizes[0]!;
    const endWordIndex = startWordIndex + selectedSize - 1;

    boundaries.push({startWordIndex, endWordIndex});
    startWordIndex = endWordIndex + 1;
  }

  return boundaries;
};

const buildPlan = ({
  request: input,
  proposal: inputProposal,
  inference,
}: {
  request: ShortsTextChunkingRequest;
  proposal: ShortsTextChunkProposal;
  inference: InferenceReceipt;
}): ShortsTextChunkPlan => {
  const request = shortsTextChunkingRequestSchema.parse(input);
  const proposal = shortsTextChunkProposalSchema.parse(inputProposal);
  const words = request.transcript.words;
  const hash = transcriptHash(request);
  let expectedStart = 0;

  const chunks: ShortsTextChunk[] = proposal.chunks.map((candidate, index) => {
    if (candidate.startWordIndex !== expectedStart) {
      throw new Error(
        `Chunk ${index} must start at contiguous word ${expectedStart}; received ${candidate.startWordIndex}.`,
      );
    }
    if (candidate.endWordIndex >= words.length) {
      throw new Error(
        `Chunk ${index} ends outside the ${words.length}-word transcript.`,
      );
    }
    const wordCount = candidate.endWordIndex - candidate.startWordIndex + 1;
    if (wordCount < request.constraints.minWordsPerChunk) {
      throw new Error(
        `Chunk ${index} contains ${wordCount} words; minimum is ${request.constraints.minWordsPerChunk}.`,
      );
    }
    if (wordCount > request.constraints.maxWordsPerChunk) {
      throw new Error(
        `Chunk ${index} contains ${wordCount} words; maximum is ${request.constraints.maxWordsPerChunk}.`,
      );
    }
    candidate.emphasisWordIndices.forEach((wordIndex) => {
      if (
        wordIndex < candidate.startWordIndex ||
        wordIndex > candidate.endWordIndex
      ) {
        throw new Error(
          `Chunk ${index} emphasis word ${wordIndex} is outside its word range.`,
        );
      }
    });

    const chunkWords = words.slice(
      candidate.startWordIndex,
      candidate.endWordIndex + 1,
    );
    const emphasisText = joinShortsTextTokens(
      candidate.emphasisWordIndices.map(
        (wordIndex) => words[wordIndex]!.text,
      ),
    );
    expectedStart = candidate.endWordIndex + 1;
    return {
      chunkId: chunkId({
        hash,
        startWordIndex: candidate.startWordIndex,
        endWordIndex: candidate.endWordIndex,
      }),
      startWordIndex: candidate.startWordIndex,
      endWordIndex: candidate.endWordIndex,
      wordCount,
      text: joinShortsTextTokens(chunkWords.map((word) => word.text)),
      startMs: chunkWords[0]!.startMs,
      endMs: chunkWords.at(-1)!.endMs,
      semanticRole: candidate.semanticRole,
      emphasis: {
        wordIndices: candidate.emphasisWordIndices,
        text: emphasisText,
        level: candidate.emphasisLevel,
      },
      rationale:
        inference.status === "invoked"
          ? `Governed validation accepted the model-proposed boundaries, ${candidate.semanticRole} role, and emphasis.`
          : "Deterministic fallback preserved transcript order and selected the strongest content word.",
      confidence: inference.status === "invoked" ? 0.8 : 0.62,
    };
  });

  if (expectedStart !== words.length) {
    throw new Error(
      `Chunk proposal must cover all ${words.length} words; coverage stopped before word ${expectedStart}.`,
    );
  }

  return shortsTextChunkPlanSchema.parse({
    schemaVersion: "maul-shorts-text-chunk-plan/v1",
    transcriptHash: hash,
    videoDurationMs: request.videoDurationMs,
    pacing: request.pacing,
    style: request.style,
    strategy:
      inference.status === "invoked"
        ? "llm_assisted"
        : "deterministic_fallback",
    chunks,
    coverage: {
      totalWordCount: words.length,
      coveredWordCount: words.length,
      omittedWordIndices: [],
      duplicatedWordIndices: [],
      exact: true,
    },
    inference,
    validationFindings:
      inference.status === "invoked"
        ? []
        : [
            {
              code: "llm_chunking_fallback",
              severity: "advisory",
              message: inference.fallbackReason,
              chunkIndex: null,
            },
          ],
  });
};

export const materializeShortsTextChunkProposal = buildPlan;

export const buildDeterministicShortsTextChunkPlan = ({
  request: input,
  inference,
}: {
  request: ShortsTextChunkingRequest;
  inference: InferenceReceipt;
}): ShortsTextChunkPlan => {
  const request = shortsTextChunkingRequestSchema.parse(input);
  const boundaries = proposalBoundaries(request);
  const proposal: ShortsTextChunkProposal = {
    schemaVersion: "maul-shorts-text-chunk-proposal/v1",
    chunks: boundaries.map((boundary, chunkIndex) => {
      const emphasisWordIndices = emphasisIndices(
        request,
        boundary.startWordIndex,
        boundary.endWordIndex,
      );
      const role = roleForChunk({
        request,
        ...boundary,
        chunkIndex,
        chunkCount: boundaries.length,
      });
      return {
        ...boundary,
        semanticRole: role,
        emphasisWordIndices,
        emphasisLevel:
          role === "hook" || role === "payoff" ? "hero" : "key",
      };
    }),
  };

  return buildPlan({request, proposal, inference});
};
