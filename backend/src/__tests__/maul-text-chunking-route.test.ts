import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

const request = {
  transcript: {
    language: "en",
    text: "You do not need permission.",
    words: [
      {text: "You", startMs: 0, endMs: 220, confidence: 0.99},
      {text: "do", startMs: 240, endMs: 400, confidence: 0.99},
      {text: "not", startMs: 420, endMs: 610, confidence: 0.99},
      {text: "need", startMs: 630, endMs: 860, confidence: 0.99},
      {text: "permission.", startMs: 880, endMs: 1300, confidence: 0.99},
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
};

describe("MAUL text chunking preview route", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("returns a complete deterministic preview when the API token is not configured", async () => {
    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        MAUL_CHUNKING_LLM_API_KEY: "",
      },
    });

    const response = await context.app.inject({
      method: "POST",
      url: "/api/maul/text-chunks/preview",
      payload: request,
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      schemaVersion: "maul-shorts-text-chunk-plan/v1",
      strategy: "deterministic_fallback",
      chunks: [
        {
          text: "You do not need permission.",
          startWordIndex: 0,
          endWordIndex: 4,
        },
      ],
      coverage: {
        totalWordCount: 5,
        coveredWordCount: 5,
        exact: true,
      },
      inference: {
        status: "skipped_missing_credentials",
        baseUrl: "https://codex-everywhere.com",
        model: "gpt-5.6-terra",
      },
    });
    expect(context.env.MAUL_CHUNKING_LLM_PATH).toBe("/v1/chat/completions");

    await context.app.close();
  });

  it("rejects unordered transcript timing before invoking a planner", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const response = await context.app.inject({
      method: "POST",
      url: "/api/maul/text-chunks/preview",
      payload: {
        ...request,
        transcript: {
          ...request.transcript,
          words: [request.transcript.words[1], request.transcript.words[0]],
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatch(/ordered|start time/i);

    await context.app.close();
  });

  it("rejects oversized preview bodies before provider planning", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const response = await context.app.inject({
      method: "POST",
      url: "/api/maul/text-chunks/preview",
      headers: {"content-type": "application/json"},
      payload: JSON.stringify({
        ...request,
        editorialContext: {
          ...request.editorialContext,
          notes: "x".repeat(600_000),
        },
      }),
    });

    expect(response.statusCode).toBe(413);

    await context.app.close();
  });
});
