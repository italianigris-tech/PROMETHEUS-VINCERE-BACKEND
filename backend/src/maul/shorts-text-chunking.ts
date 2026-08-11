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
    slow: 4,
    measured: 5,
    fast: 6,
    very_fast: 8,
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

type GrammaticalRole =
  | "DET"
  | "ADJ"
  | "NOUN"
  | "AUX"
  | "VERB"
  | "PREP"
  | "CONJ"
  | "OTHER";

const DETERMINERS = new Set([
  "a", "an", "the", "this", "that", "these", "those",
  "my", "your", "his", "her", "its", "our", "their",
  "any", "some", "every", "all", "each", "no", "another", "which", "what",
  "most", "many", "few", "more", "much", "less", "least"
]);

const AUXILIARY_VERBS = new Set([
  "is", "am", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had",
  "can", "could", "should", "would", "will", "might", "must", "may"
]);

const PREPOSITIONS = new Set([
  "in", "on", "at", "to", "for", "with", "from", "of", "by", "about",
  "into", "through", "during", "before", "after", "above", "below",
  "between", "under", "over", "against", "without", "within", "around"
]);

const CONJUNCTIONS = new Set([
  "and", "but", "or", "so", "yet", "nor", "because", "although", "while", "if"
]);

const PRONOUNS_AND_COMMON_NOUNS = new Set([
  "brain", "organ", "people", "permission", "creators", "video", "content", "story",
  "world", "form", "life", "time", "man", "human", "way", "day", "thing", "things",
  "you", "they", "we", "he", "she", "it", "i", "me", "him", "them", "us", "who"
]);

const COMMON_ADJECTIVES = new Set([
  "human", "form", "best", "great", "ready", "real", "quick", "slow", "first",
  "last", "long", "short", "high", "low", "big", "small", "new", "old", "good",
  "bad", "scared", "lazy", "better", "worse", "different", "same", "important"
]);

const classifyGrammaticalRole = (rawToken: string): GrammaticalRole => {
  const token = cleanToken(rawToken);
  if (!token) return "OTHER";
  if (DETERMINERS.has(token)) return "DET";
  if (AUXILIARY_VERBS.has(token)) return "AUX";
  if (PREPOSITIONS.has(token)) return "PREP";
  if (CONJUNCTIONS.has(token)) return "CONJ";
  if (COMMON_ADJECTIVES.has(token) || /(?:al|ful|ic|ive|less|ous|able|ible|ish|ent|ant)$/.test(token)) {
    return "ADJ";
  }
  if (PRONOUNS_AND_COMMON_NOUNS.has(token)) return "NOUN";
  if (/(?:ing|ed|es|s)$/.test(token)) return "VERB";
  return "NOUN";
};

const computeBoundaryScore = (
  words: ShortsTextChunkingRequest["transcript"]["words"],
  i: number,
): {boundaryScore: number; syntaxScore: number} => {
  const currentWord = words[i]!;
  const nextWord = words[i + 1]!;

  let punctScore = 0;
  if (/[.!?]["')\]]?$/.test(currentWord.text)) {
    punctScore = 25.0;
  } else if (/[,;:]["')\]]?$/.test(currentWord.text)) {
    punctScore = 10.0;
  }

  const gapMs = Math.max(0, nextWord.startMs - currentWord.endMs);
  const pauseScore = Math.min(6.0, (gapMs / 150.0) * 2.0);

  const role1 = classifyGrammaticalRole(currentWord.text);
  const role2 = classifyGrammaticalRole(nextWord.text);

  let syntaxScore = 0;

  if (role1 === "DET" && (role2 === "ADJ" || role2 === "NOUN")) {
    syntaxScore -= 9.0;
  } else if (role1 === "ADJ" && role2 === "NOUN") {
    syntaxScore -= 7.0;
  } else if (role1 === "PREP" && (role2 === "DET" || role2 === "ADJ" || role2 === "NOUN")) {
    syntaxScore -= 6.0;
  } else if (role2 === "PREP") {
    // Prepositional complements usually complete the phrase before them
    // ("wait for permission", "build with focus"). Keep them attached even
    // when the lightweight lexical classifier cannot identify the verb.
    syntaxScore -= 6.0;
  } else if (role1 === "AUX" && (role2 === "DET" || role2 === "ADJ")) {
    syntaxScore -= 3.0;
  }

  if (role1 === "NOUN" && (role2 === "AUX" || role2 === "VERB")) {
    syntaxScore += 4.0;
  } else if (role1 === "AUX" && role2 === "DET") {
    syntaxScore += 2.0;
  } else if (role1 === "VERB" && (role2 === "DET" || role2 === "CONJ")) {
    syntaxScore += 2.0;
  } else if (role1 === "NOUN" && (role2 === "PREP" || role2 === "CONJ")) {
    syntaxScore += 2.0;
  }

  const boundaryScore = punctScore + pauseScore + syntaxScore;
  return {boundaryScore, syntaxScore};
};

const scoreChunkCandidate = (
  words: ShortsTextChunkingRequest["transcript"]["words"],
  start: number,
  end: number,
  targetWords: number,
): number => {
  const size = end - start + 1;

  let internalCohesion = 0;
  for (let k = start; k < end; k++) {
    const {syntaxScore} = computeBoundaryScore(words, k);
    if (syntaxScore < 0) {
      internalCohesion += Math.abs(syntaxScore);
    }
  }

  let boundaryBreakReward = 0;
  if (end < words.length - 1) {
    const {boundaryScore} = computeBoundaryScore(words, end);
    boundaryBreakReward = boundaryScore;
  } else {
    boundaryBreakReward = 15.0;
  }

  const lengthPreference = -1.25 * Math.pow(size - targetWords, 2);

  return internalCohesion + boundaryBreakReward + lengthPreference;
};

const proposalBoundaries = (
  request: ShortsTextChunkingRequest,
): Array<{startWordIndex: number; endWordIndex: number}> => {
  const words = request.transcript.words;
  if (words.length === 0) return [];

  const targetWords = targetWordsForPacing(request);
  const {minWordsPerChunk, maxWordsPerChunk} = request.constraints;
  const n = words.length;

  const dp = new Array<number>(n + 1).fill(-Infinity);
  const nextChoice = new Array<number>(n + 1).fill(0);
  dp[n] = 0;

  for (let i = n - 1; i >= 0; i--) {
    const remaining = n - i;
    const maxPossibleSize = Math.min(maxWordsPerChunk, remaining);

    let bestScore = -Infinity;
    let bestSize = 0;

    for (let size = minWordsPerChunk; size <= maxPossibleSize; size++) {
      if (!canPartitionWordCount(remaining - size, minWordsPerChunk, maxWordsPerChunk)) {
        continue;
      }
      if (dp[i + size] === -Infinity) continue;

      const chunkScore = scoreChunkCandidate(words, i, i + size - 1, targetWords);
      const totalScore = chunkScore + dp[i + size];

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestSize = size;
      }
    }

    if (bestSize > 0) {
      dp[i] = bestScore;
      nextChoice[i] = bestSize;
    }
  }

  const boundaries: Array<{startWordIndex: number; endWordIndex: number}> = [];
  let curr = 0;
  while (curr < n) {
    const size = nextChoice[curr];
    if (!size || size === 0) {
      throw new Error(`The ${n - curr} remaining transcript words cannot be partitioned.`);
    }
    const startWordIndex = curr;
    const endWordIndex = curr + size - 1;
    boundaries.push({startWordIndex, endWordIndex});
    curr += size;
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
    if (
      candidate.emphasisWordIndices.some(
        (wordIndex, emphasisIndex) =>
          emphasisIndex > 0 &&
          wordIndex <= candidate.emphasisWordIndices[emphasisIndex - 1]!,
      )
    ) {
      throw new Error(
        `Chunk ${index} emphasis indices must be ordered and unique.`,
      );
    }

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
