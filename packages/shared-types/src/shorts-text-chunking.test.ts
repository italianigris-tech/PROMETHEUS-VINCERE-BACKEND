import {describe, expect, it} from "vitest";

import {
  shortsTextChunkPlanSchema,
  shortsTextChunkingRequestSchema,
} from "./shorts-text-chunking.js";

const words = [
  {text: "You", startMs: 0, endMs: 220, confidence: 0.99},
  {text: "do", startMs: 240, endMs: 400, confidence: 0.99},
  {text: "not", startMs: 420, endMs: 610, confidence: 0.99},
  {text: "need", startMs: 630, endMs: 860, confidence: 0.99},
  {text: "permission.", startMs: 880, endMs: 1300, confidence: 0.99},
];

const validPlan = () => ({
  schemaVersion: "maul-shorts-text-chunk-plan/v1" as const,
  transcriptHash: "a".repeat(64),
  videoDurationMs: 40_000,
  pacing: "fast" as const,
  style: "cinematic" as const,
  strategy: "llm_assisted" as const,
  chunks: [
    {
      chunkId: "chunk_0_4",
      startWordIndex: 0,
      endWordIndex: 4,
      wordCount: 5,
      text: "You do not need permission.",
      startMs: 0,
      endMs: 1300,
      semanticRole: "claim" as const,
      emphasis: {
        wordIndices: [2, 4],
        text: "not permission.",
        level: "hero" as const,
      },
      rationale: "The final words carry the claim.",
      confidence: 0.94,
    },
  ],
  coverage: {
    totalWordCount: 5,
    coveredWordCount: 5,
    omittedWordIndices: [],
    duplicatedWordIndices: [],
    exact: true,
  },
  inference: {
    status: "invoked" as const,
    provider: "openai_compatible" as const,
    baseUrl: "https://codex-everywhere.com",
    model: "gpt-5.6-terra",
    requestHash: "b".repeat(64),
    responseHash: "c".repeat(64),
    fallbackReason: null,
  },
  validationFindings: [],
});

describe("shorts text chunking contracts", () => {
  it("preserves provider usage receipts without requiring them on legacy plans", () => {
    const legacy = validPlan();
    expect(shortsTextChunkPlanSchema.parse(legacy).inference.usage).toBeUndefined();

    const withUsage = structuredClone(legacy);
    withUsage.inference.usage = {
      promptTokens: 120,
      completionTokens: 30,
      totalTokens: 150,
      requestId: "request_123",
      latencyMs: 420,
    };
    expect(shortsTextChunkPlanSchema.parse(withUsage).inference.usage).toEqual(
      withUsage.inference.usage,
    );
  });
  it("accepts the complete timed transcript and supplies conservative defaults", () => {
    const request = shortsTextChunkingRequestSchema.parse({
      transcript: {
        language: "en",
        text: "You do not need permission.",
        words,
      },
      videoDurationMs: 40_000,
      pacing: "fast",
      style: "cinematic",
    });

    expect(request.constraints).toEqual({
      minWordsPerChunk: 1,
      maxWordsPerChunk: 8,
      preserveEveryWord: true,
    });
  });

  it("rejects chunk-size constraints that cannot cover the transcript", () => {
    expect(() =>
      shortsTextChunkingRequestSchema.parse({
        transcript: {
          language: "en",
          text: "You do not need permission.",
          words,
        },
        videoDurationMs: 40_000,
        pacing: "fast",
        style: "cinematic",
        constraints: {
          minWordsPerChunk: 4,
          maxWordsPerChunk: 4,
          preserveEveryWord: true,
        },
      }),
    ).toThrow(/cannot be partitioned|chunk-size/i);
  });

  it("accepts one-word caption chunks", () => {
    const request = shortsTextChunkingRequestSchema.parse({
      transcript: {
        language: "en",
        text: "You do not need permission.",
        words,
      },
      videoDurationMs: 40_000,
      pacing: "very_fast",
      style: "direct_response",
      constraints: {
        minWordsPerChunk: 1,
        maxWordsPerChunk: 1,
        preserveEveryWord: true,
      },
    });

    expect(request.constraints.maxWordsPerChunk).toBe(1);
  });

  it("rejects overlapping word timing", () => {
    expect(() =>
      shortsTextChunkingRequestSchema.parse({
        transcript: {
          language: "en",
          text: "Overlap is invalid.",
          words: [
            {text: "Overlap", startMs: 0, endMs: 500, confidence: 0.99},
            {text: "is", startMs: 400, endMs: 600, confidence: 0.99},
            {text: "invalid.", startMs: 620, endMs: 900, confidence: 0.99},
          ],
        },
        videoDurationMs: 1000,
        pacing: "fast",
        style: "cinematic",
      }),
    ).toThrow(/overlap/i);
  });

  it("rejects word timing beyond the target video", () => {
    expect(() =>
      shortsTextChunkingRequestSchema.parse({
        transcript: {
          language: "en",
          text: "Ends too late.",
          words: [
            {text: "Ends", startMs: 0, endMs: 300, confidence: 0.99},
            {text: "too", startMs: 320, endMs: 500, confidence: 0.99},
            {text: "late.", startMs: 520, endMs: 1200, confidence: 0.99},
          ],
        },
        videoDurationMs: 1000,
        pacing: "fast",
        style: "cinematic",
      }),
    ).toThrow(/video duration/i);
  });

  it("rejects transcript text that does not match the timed word tokens", () => {
    expect(() =>
      shortsTextChunkingRequestSchema.parse({
        transcript: {
          language: "en",
          text: "Completely different copy.",
          words,
        },
        videoDurationMs: 40_000,
        pacing: "fast",
        style: "cinematic",
      }),
    ).toThrow(/match.*timed word|timed word.*match/i);
  });

  it("accepts a fully covered plan with emphasis constrained to each chunk", () => {
    const plan = shortsTextChunkPlanSchema.parse(validPlan());

    expect(plan.chunks[0]?.emphasis.wordIndices).toEqual([2, 4]);
  });

  it.each([
    ["duplicate", [2, 2]],
    ["reverse-order", [4, 2]],
  ])("rejects %s emphasis indices", (_kind, wordIndices) => {
    const plan = validPlan();
    plan.chunks[0]!.emphasis.wordIndices = wordIndices;

    expect(() => shortsTextChunkPlanSchema.parse(plan)).toThrow(
      /ordered.*unique|unique.*ordered/i,
    );
  });

  it("rejects plans that skip transcript words", () => {
    expect(() =>
      shortsTextChunkPlanSchema.parse({
        schemaVersion: "maul-shorts-text-chunk-plan/v1",
        transcriptHash: "a".repeat(64),
        videoDurationMs: 40_000,
        pacing: "fast",
        style: "cinematic",
        strategy: "deterministic_fallback",
        chunks: [
          {
            chunkId: "chunk_1_4",
            startWordIndex: 1,
            endWordIndex: 4,
            wordCount: 4,
            text: "do not need permission.",
            startMs: 240,
            endMs: 1300,
            semanticRole: "claim",
            emphasis: {
              wordIndices: [4],
              text: "permission.",
              level: "key",
            },
            rationale: "Invalid fixture intentionally skips word zero.",
            confidence: 0.5,
          },
        ],
        coverage: {
          totalWordCount: 5,
          coveredWordCount: 4,
          omittedWordIndices: [0],
          duplicatedWordIndices: [],
          exact: false,
        },
        inference: {
          status: "skipped_missing_credentials",
          provider: "openai_compatible",
          baseUrl: "https://codex-everywhere.com",
          model: "gpt-5.6-terra",
          requestHash: null,
          responseHash: null,
          fallbackReason: "Missing API key.",
        },
        validationFindings: [],
      }),
    ).toThrow(/cover|word|contiguous/i);
  });

  it("rejects emphasis indices outside their chunk", () => {
    const invalid = {
      schemaVersion: "maul-shorts-text-chunk-plan/v1",
      transcriptHash: "a".repeat(64),
      videoDurationMs: 40_000,
      pacing: "measured",
      style: "editorial",
      strategy: "deterministic_fallback",
      chunks: [
        {
          chunkId: "chunk_0_4",
          startWordIndex: 0,
          endWordIndex: 4,
          wordCount: 5,
          text: "You do not need permission.",
          startMs: 0,
          endMs: 1300,
          semanticRole: "claim",
          emphasis: {
            wordIndices: [5],
            text: "outside",
            level: "key",
          },
          rationale: "Invalid fixture intentionally points outside.",
          confidence: 0.5,
        },
      ],
      coverage: {
        totalWordCount: 5,
        coveredWordCount: 5,
        omittedWordIndices: [],
        duplicatedWordIndices: [],
        exact: true,
      },
      inference: {
        status: "skipped_missing_credentials",
        provider: "openai_compatible",
        baseUrl: "https://codex-everywhere.com",
        model: "gpt-5.6-terra",
        requestHash: null,
        responseHash: null,
        fallbackReason: "Missing API key.",
      },
      validationFindings: [],
    };

    expect(() => shortsTextChunkPlanSchema.parse(invalid)).toThrow(/emphasis/i);
  });
});
