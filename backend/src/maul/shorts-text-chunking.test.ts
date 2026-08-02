import {describe, expect, it} from "vitest";

import type {ShortsTextChunkingRequest} from "@prometheus/shared-types";

import {
  buildDeterministicShortsTextChunkPlan,
  materializeShortsTextChunkProposal,
  shortsTextChunkProposalSchema,
  type ShortsTextChunkProposal,
} from "./shorts-text-chunking.js";

const request: ShortsTextChunkingRequest = {
  transcript: {
    language: "en",
    text: "Most people wait for permission. The best creators build before they feel ready.",
    words: [
      {text: "Most", startMs: 0, endMs: 180, confidence: 0.99},
      {text: "people", startMs: 200, endMs: 420, confidence: 0.99},
      {text: "wait", startMs: 440, endMs: 630, confidence: 0.99},
      {text: "for", startMs: 650, endMs: 780, confidence: 0.99},
      {text: "permission.", startMs: 800, endMs: 1220, confidence: 0.99},
      {text: "The", startMs: 1450, endMs: 1570, confidence: 0.99},
      {text: "best", startMs: 1590, endMs: 1770, confidence: 0.99},
      {text: "creators", startMs: 1790, endMs: 2070, confidence: 0.99},
      {text: "build", startMs: 2090, endMs: 2300, confidence: 0.99},
      {text: "before", startMs: 2320, endMs: 2510, confidence: 0.99},
      {text: "they", startMs: 2530, endMs: 2670, confidence: 0.99},
      {text: "feel", startMs: 2690, endMs: 2850, confidence: 0.99},
      {text: "ready.", startMs: 2870, endMs: 3200, confidence: 0.99},
    ],
  },
  videoDurationMs: 40_000,
  pacing: "fast",
  style: "cinematic",
  editorialContext: {
    platform: "instagram_reels",
    objective: "retention",
    audience: null,
    notes: null,
  },
  constraints: {
    minWordsPerChunk: 1,
    maxWordsPerChunk: 5,
    preserveEveryWord: true,
  },
};

const fallbackInference = {
  status: "skipped_missing_credentials" as const,
  provider: "openai_compatible" as const,
  baseUrl: "https://codex-everywhere.com",
  model: "gpt-5.6-terra",
  requestHash: null,
  responseHash: null,
  fallbackReason: "MAUL chunking API key is not configured.",
};

describe("MAUL shorts text chunking", () => {
  it("builds a deterministic fallback that covers every word exactly once", () => {
    const first = buildDeterministicShortsTextChunkPlan({
      request,
      inference: fallbackInference,
    });
    const replay = buildDeterministicShortsTextChunkPlan({
      request,
      inference: fallbackInference,
    });

    expect(first).toEqual(replay);
    expect(first.strategy).toBe("deterministic_fallback");
    expect(first.coverage).toEqual({
      totalWordCount: request.transcript.words.length,
      coveredWordCount: request.transcript.words.length,
      omittedWordIndices: [],
      duplicatedWordIndices: [],
      exact: true,
    });
    expect(first.chunks.every((chunk) => chunk.wordCount <= 5)).toBe(true);
    expect(first.chunks.flatMap((chunk) =>
      Array.from(
        {length: chunk.wordCount},
        (_, offset) => chunk.startWordIndex + offset,
      ),
    )).toEqual(request.transcript.words.map((_word, index) => index));
    expect(first.chunks[0]?.text).toBe("Most people wait for permission.");
  });

  it("rebalances the final chunk instead of violating the configured minimum", () => {
    const plan = buildDeterministicShortsTextChunkPlan({
      request: {
        ...request,
        constraints: {
          minWordsPerChunk: 4,
          maxWordsPerChunk: 5,
          preserveEveryWord: true,
        },
      },
      inference: fallbackInference,
    });

    expect(plan.chunks.map((chunk) => chunk.wordCount)).toEqual([5, 4, 4]);
    expect(plan.coverage.exact).toBe(true);
  });

  it("materializes only indices while preserving authoritative transcript text and timing", () => {
    const proposal: ShortsTextChunkProposal = {
      schemaVersion: "maul-shorts-text-chunk-proposal/v1",
      chunks: [
        {
          startWordIndex: 0,
          endWordIndex: 4,
          semanticRole: "hook",
          emphasisWordIndices: [4],
          emphasisLevel: "hero",
        },
        {
          startWordIndex: 5,
          endWordIndex: 12,
          semanticRole: "payoff",
          emphasisWordIndices: [7, 8],
          emphasisLevel: "hero",
        },
      ],
    };

    const plan = materializeShortsTextChunkProposal({
      request: {
        ...request,
        constraints: {...request.constraints, maxWordsPerChunk: 8},
      },
      proposal,
      inference: {
        status: "invoked",
        provider: "openai_compatible",
        baseUrl: "https://codex-everywhere.com",
        model: "gpt-5.6-terra",
        requestHash: "a".repeat(64),
        responseHash: "b".repeat(64),
        fallbackReason: null,
      },
    });

    expect(plan.strategy).toBe("llm_assisted");
    expect(plan.chunks[1]).toMatchObject({
      text: "The best creators build before they feel ready.",
      startMs: 1450,
      endMs: 3200,
      emphasis: {
        wordIndices: [7, 8],
        text: "creators build",
      },
    });
  });

  it.each([
    ["duplicate", [2, 2]],
    ["reverse-order", [4, 2]],
  ])("rejects %s emphasis indices before reconstructing text", (_kind, emphasisWordIndices) => {
    const proposal: ShortsTextChunkProposal = {
      schemaVersion: "maul-shorts-text-chunk-proposal/v1",
      chunks: [
        {
          startWordIndex: 0,
          endWordIndex: 4,
          semanticRole: "hook",
          emphasisWordIndices,
          emphasisLevel: "hero",
        },
        {
          startWordIndex: 5,
          endWordIndex: 12,
          semanticRole: "payoff",
          emphasisWordIndices: [7, 8],
          emphasisLevel: "hero",
        },
      ],
    };

    expect(() =>
      materializeShortsTextChunkProposal({
        request: {
          ...request,
          constraints: {...request.constraints, maxWordsPerChunk: 8},
        },
        proposal,
        inference: fallbackInference,
      }),
    ).toThrow(/ordered.*unique|unique.*ordered/i);
  });

  it("reconstructs standalone punctuation without inserting spaces before it", () => {
    const punctuationRequest: ShortsTextChunkingRequest = {
      transcript: {
        language: "en",
        text: "Hello, world!",
        words: [
          {text: "Hello", startMs: 0, endMs: 180, confidence: 0.99},
          {text: ",", startMs: 180, endMs: 200, confidence: 0.99},
          {text: "world", startMs: 220, endMs: 440, confidence: 0.99},
          {text: "!", startMs: 440, endMs: 460, confidence: 0.99},
        ],
      },
      videoDurationMs: 1000,
      pacing: "fast",
      style: "cinematic",
      editorialContext: {
        platform: null,
        objective: null,
        audience: null,
        notes: null,
      },
      constraints: {
        minWordsPerChunk: 1,
        maxWordsPerChunk: 8,
        preserveEveryWord: true,
      },
    };
    const plan = buildDeterministicShortsTextChunkPlan({
      request: punctuationRequest,
      inference: fallbackInference,
    });

    expect(plan.chunks.map((chunk) => chunk.text).join(" ")).toBe(
      "Hello, world!",
    );
  });

  it("rejects an LLM proposal that leaves a coverage gap", () => {
    const invalid: ShortsTextChunkProposal = {
      schemaVersion: "maul-shorts-text-chunk-proposal/v1",
      chunks: [
        {
          startWordIndex: 0,
          endWordIndex: 4,
          semanticRole: "hook",
          emphasisWordIndices: [4],
          emphasisLevel: "hero",
        },
        {
          startWordIndex: 6,
          endWordIndex: 12,
          semanticRole: "payoff",
          emphasisWordIndices: [8],
          emphasisLevel: "key",
        },
      ],
    };

    expect(() =>
      materializeShortsTextChunkProposal({
        request: {...request, constraints: {...request.constraints, maxWordsPerChunk: 8}},
        proposal: invalid,
        inference: {
          status: "invoked",
          provider: "openai_compatible",
          baseUrl: "https://codex-everywhere.com",
          model: "gpt-5.6-terra",
          requestHash: "a".repeat(64),
          responseHash: "b".repeat(64),
          fallbackReason: null,
        },
      }),
    ).toThrow(/contiguous|cover|word 5/i);
  });

  it("rejects chunks outside the configured word-count bounds", () => {
    const oversized: ShortsTextChunkProposal = {
      schemaVersion: "maul-shorts-text-chunk-proposal/v1",
      chunks: [
        {
          startWordIndex: 0,
          endWordIndex: 12,
          semanticRole: "claim",
          emphasisWordIndices: [4],
          emphasisLevel: "hero",
        },
      ],
    };

    expect(() =>
      materializeShortsTextChunkProposal({
        request,
        proposal: oversized,
        inference: {
          status: "invoked",
          provider: "openai_compatible",
          baseUrl: "https://codex-everywhere.com",
          model: "gpt-5.6-terra",
          requestHash: "a".repeat(64),
          responseHash: "b".repeat(64),
          fallbackReason: null,
        },
      }),
    ).toThrow(/maximum|5 words/i);
  });

  it("rejects model-authored fields outside boundary, role, and emphasis scope", () => {
    expect(() =>
      shortsTextChunkProposalSchema.parse({
        schemaVersion: "maul-shorts-text-chunk-proposal/v1",
        chunks: [
          {
            startWordIndex: 0,
            endWordIndex: 4,
            semanticRole: "hook",
            emphasisWordIndices: [4],
            emphasisLevel: "hero",
            rationale: "The model should not author this field.",
            confidence: 0.99,
          },
        ],
      }),
    ).toThrow(/unrecognized|rationale|confidence/i);
  });
});
