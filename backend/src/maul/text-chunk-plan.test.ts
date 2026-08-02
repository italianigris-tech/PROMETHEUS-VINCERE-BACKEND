import {createHash} from "node:crypto";

import {describe, expect, it} from "vitest";

import type {ShortsTextChunkPlan} from "@prometheus/shared-types";

import {
  hashMaulPlanPayload,
  materializeMaulTextChunkPlanV2,
} from "./text-chunk-plan.js";

const sha = (character: string) => character.repeat(64);
const transcriptHash = sha("a");
const stableTokenId = (wordIndex: number) =>
  `token_${createHash("sha256")
    .update(`${transcriptHash}:${wordIndex}`)
    .digest("hex")
    .slice(0, 24)}`;

const textChunkPlanV1: ShortsTextChunkPlan = {
  schemaVersion: "maul-shorts-text-chunk-plan/v1",
  transcriptHash,
  videoDurationMs: 900,
  pacing: "measured",
  style: "editorial",
  strategy: "deterministic_fallback",
  chunks: [
    {
      chunkId: "chunk_proof",
      startWordIndex: 0,
      endWordIndex: 1,
      wordCount: 2,
      text: "Proof matters.",
      startMs: 0,
      endMs: 900,
      semanticRole: "proof",
      emphasis: {wordIndices: [0], text: "Proof", level: "key"},
      rationale: "Keep the proof phrase together.",
      confidence: 0.9,
    },
  ],
  coverage: {
    totalWordCount: 2,
    coveredWordCount: 2,
    omittedWordIndices: [],
    duplicatedWordIndices: [],
    exact: true,
  },
  inference: {
    status: "skipped_missing_credentials",
    provider: "openai_compatible",
    baseUrl: "https://example.com/v1",
    model: "fixture-model",
    requestHash: null,
    responseHash: null,
    fallbackReason: "Fixture uses deterministic fallback.",
  },
  validationFindings: [],
};

const mappedWords = [
  {
    transcriptWordIndex: 7,
    text: "Proof",
    confidence: 0.99,
    sourceStartMs: 0,
    sourceEndMs: 700,
    outputSpans: [
      {outputStartMs: 0, outputEndMs: 300},
      {outputStartMs: 300, outputEndMs: 500},
    ],
    startMs: 0,
    endMs: 500,
  },
  {
    transcriptWordIndex: 8,
    text: "matters.",
    confidence: 0.99,
    sourceStartMs: 800,
    sourceEndMs: 1200,
    outputSpans: [{outputStartMs: 500, outputEndMs: 900}],
    startMs: 500,
    endMs: 900,
  },
] as const;

const editorialTimeline = {
  schemaVersion: "fixture/editorial-timeline/v1",
  outputDurationMs: 900,
  timestampMap: [
    {
      sourceStartMs: 0,
      sourceEndMs: 300,
      outputStartMs: 0,
      outputEndMs: 300,
      mode: "keep",
    },
    {
      sourceStartMs: 300,
      sourceEndMs: 500,
      outputStartMs: 300,
      outputEndMs: 300,
      mode: "cut",
    },
    {
      sourceStartMs: 500,
      sourceEndMs: 1200,
      outputStartMs: 300,
      outputEndMs: 900,
      mode: "keep",
    },
  ],
} as const;

describe("MAUL standalone text chunk materialization", () => {
  it("preserves stable source identity and exact V1 chunk references", () => {
    const input = {
      mappedWords,
      textChunkPlanV1,
      editorialTimeline,
    } as const;

    const first = materializeMaulTextChunkPlanV2(input);
    const replay = materializeMaulTextChunkPlanV2(input);

    expect(first).toEqual(replay);
    expect(first.tokens).toEqual([
      expect.objectContaining({
        tokenId: stableTokenId(7),
        transcriptWordIndex: 7,
        sourceStartMs: 0,
        sourceEndMs: 700,
        outputSpans: [
          {outputStartMs: 0, outputEndMs: 300},
          {outputStartMs: 300, outputEndMs: 500},
        ],
        outputStartMs: 0,
        outputEndMs: 500,
      }),
      expect.objectContaining({
        tokenId: stableTokenId(8),
        transcriptWordIndex: 8,
        sourceStartMs: 800,
        sourceEndMs: 1200,
        outputStartMs: 500,
        outputEndMs: 900,
      }),
    ]);
    expect(first.chunks[0]).toEqual(
      expect.objectContaining({
        tokenIds: [stableTokenId(7), stableTokenId(8)],
        text: "Proof matters.",
        emphasis: {
          tokenIds: [stableTokenId(7)],
          text: "Proof",
          level: "key",
        },
      }),
    );
    expect(first.timelineHash).toBe(hashMaulPlanPayload(editorialTimeline));
    expect(first.chunkProposalHash).toBe(hashMaulPlanPayload(textChunkPlanV1));
    expect(first.inputHashes).toEqual({
      transcript: transcriptHash,
      editorialTimeline: first.timelineHash,
      chunkProposal: first.chunkProposalHash,
    });
  });

  it("rejects a chunk bridge over a protected pause without explicit approval", () => {
    const protectedPause = {
      pauseId: "pause_proof",
      kind: "rhetorical_pause" as const,
      sourceStartMs: 700,
      sourceEndMs: 800,
      outputStartMs: 500,
      outputEndMs: 600,
      precedingTokenId: stableTokenId(7),
      followingTokenId: stableTokenId(8),
      verified: true as const,
      reason: "Verified rhetorical pause between proof and conclusion.",
    };

    expect(() =>
      materializeMaulTextChunkPlanV2({
        mappedWords,
        textChunkPlanV1,
        editorialTimeline,
        protectedPauses: [protectedPause],
      }),
    ).toThrow(/protected pause.*approval/i);

    const approved = materializeMaulTextChunkPlanV2({
      mappedWords,
      textChunkPlanV1,
      editorialTimeline,
      protectedPauses: [protectedPause],
      approvedProtectedPauseIds: [protectedPause.pauseId],
    });
    expect(approved.chunks[0]?.holdAcrossProtectedPause).toBe(true);
  });
});
