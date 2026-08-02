import {createHash} from "node:crypto";

import {
  joinShortsTextTokens,
  maulShortsTextChunkPlanV2CoreSchema,
  shortsTextChunkPlanSchema,
  type MaulProtectedEntity,
  type MaulProtectedPause,
  type MaulShortsTextChunkPlanV2Core,
  type ShortsTextChunkPlan,
} from "@prometheus/shared-types";

const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, nestedValue: unknown) => {
    if (
      !nestedValue ||
      typeof nestedValue !== "object" ||
      Array.isArray(nestedValue)
    ) {
      return nestedValue;
    }
    return Object.fromEntries(
      Object.entries(nestedValue).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
  });

export const hashMaulPlanPayload = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");

export type MaulMappedTranscriptWord = {
  transcriptWordIndex: number;
  text: string;
  confidence: number;
  sourceStartMs: number;
  sourceEndMs: number;
  outputSpans: readonly {
    outputStartMs: number;
    outputEndMs: number;
  }[];
  startMs: number;
  endMs: number;
};

const stableTokenId = (transcriptHash: string, transcriptWordIndex: number) =>
  `token_${createHash("sha256")
    .update(`${transcriptHash}:${transcriptWordIndex}`)
    .digest("hex")
    .slice(0, 24)}`;

const pauseIsInsideChunk = (
  pause: MaulProtectedPause,
  chunkTokenIds: readonly string[],
): boolean =>
  Boolean(
    pause.precedingTokenId &&
      pause.followingTokenId &&
      chunkTokenIds.includes(pause.precedingTokenId) &&
      chunkTokenIds.includes(pause.followingTokenId),
  );

export const materializeMaulTextChunkPlanV2 = ({
  mappedWords,
  textChunkPlanV1,
  editorialTimeline,
  protectedEntities = [],
  protectedPauses = [],
  approvedProtectedPauseIds = [],
}: {
  mappedWords: readonly MaulMappedTranscriptWord[];
  textChunkPlanV1: ShortsTextChunkPlan;
  editorialTimeline: {outputDurationMs: number};
  protectedEntities?: readonly MaulProtectedEntity[];
  protectedPauses?: readonly MaulProtectedPause[];
  approvedProtectedPauseIds?: readonly string[];
}): MaulShortsTextChunkPlanV2Core => {
  const parsedTextChunkPlanV1 = shortsTextChunkPlanSchema.parse(
    textChunkPlanV1,
  );
  if (mappedWords.length !== parsedTextChunkPlanV1.coverage.totalWordCount) {
    throw new Error(
      "Mapped words must match the exact V1 chunk-plan coverage.",
    );
  }

  const tokens = mappedWords.map((word) => ({
    tokenId: stableTokenId(
      textChunkPlanV1.transcriptHash,
      word.transcriptWordIndex,
    ),
    transcriptWordIndex: word.transcriptWordIndex,
    text: word.text,
    sourceStartMs: word.sourceStartMs,
    sourceEndMs: word.sourceEndMs,
    outputSpans: word.outputSpans.map((span) => ({...span})),
    outputStartMs: word.outputSpans[0]?.outputStartMs ?? word.startMs,
    outputEndMs: word.outputSpans.at(-1)?.outputEndMs ?? word.endMs,
  }));
  const approvedPauseIds = new Set(approvedProtectedPauseIds);

  const chunks = parsedTextChunkPlanV1.chunks.map((chunk) => {
    const chunkTokens = tokens.slice(
      chunk.startWordIndex,
      chunk.endWordIndex + 1,
    );
    if (chunkTokens.length !== chunk.wordCount) {
      throw new Error(
        `V1 chunk ${chunk.chunkId} does not resolve to its declared word count.`,
      );
    }
    const tokenIds = chunkTokens.map((token) => token.tokenId);
    const bridgedPauses = protectedPauses.filter((pause) =>
      pauseIsInsideChunk(pause, tokenIds),
    );
    const unapprovedPause = bridgedPauses.find(
      (pause) => !approvedPauseIds.has(pause.pauseId),
    );
    if (unapprovedPause) {
      throw new Error(
        `Protected Pause ${unapprovedPause.pauseId} requires explicit bridge approval.`,
      );
    }
    const emphasisTokens = chunk.emphasis.wordIndices.map((wordIndex) => {
      const token = tokens[wordIndex];
      if (!token) {
        throw new Error(
          `V1 chunk ${chunk.chunkId} emphasis index ${wordIndex} is unavailable.`,
        );
      }
      return token;
    });

    return {
      chunkId: chunk.chunkId,
      tokenIds,
      text: joinShortsTextTokens(chunkTokens.map((token) => token.text)),
      outputStartMs: chunkTokens[0]!.outputStartMs,
      outputEndMs: chunkTokens.at(-1)!.outputEndMs,
      semanticRole: chunk.semanticRole,
      emphasis: {
        tokenIds: emphasisTokens.map((token) => token.tokenId),
        text: joinShortsTextTokens(emphasisTokens.map((token) => token.text)),
        level: chunk.emphasis.level,
      },
      holdAcrossProtectedPause: bridgedPauses.length > 0,
      rationale: chunk.rationale,
      confidence: chunk.confidence,
    };
  });

  const timelineHash = hashMaulPlanPayload(editorialTimeline);
  const chunkProposalHash = hashMaulPlanPayload(parsedTextChunkPlanV1);
  return maulShortsTextChunkPlanV2CoreSchema.parse({
    schemaVersion: "maul-shorts-text-chunk-plan/v2",
    transcriptHash: parsedTextChunkPlanV1.transcriptHash,
    timelineHash,
    chunkProposalHash,
    outputDurationMs: editorialTimeline.outputDurationMs,
    pacing: parsedTextChunkPlanV1.pacing,
    style: parsedTextChunkPlanV1.style,
    strategy: parsedTextChunkPlanV1.strategy,
    tokens,
    chunks,
    protectedEntities: [...protectedEntities],
    protectedPauses: [...protectedPauses],
    inference: parsedTextChunkPlanV1.inference,
    inputHashes: {
      transcript: parsedTextChunkPlanV1.transcriptHash,
      editorialTimeline: timelineHash,
      chunkProposal: chunkProposalHash,
    },
  });
};
