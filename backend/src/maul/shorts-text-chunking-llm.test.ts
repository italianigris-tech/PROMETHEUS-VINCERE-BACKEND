import {describe, expect, it, vi} from "vitest";

import {shortsTextChunkingRequestSchema} from "@prometheus/shared-types";

import {createShortsTextChunkPlanner} from "./shorts-text-chunking-llm.js";

const request = shortsTextChunkingRequestSchema.parse({
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
    objective: "retention and clarity",
    audience: "entrepreneurs",
    notes: "One principal speaker.",
  },
});

const config = {
  baseUrl: "https://codex-everywhere.com",
  path: "/v1/chat/completions",
  apiKey: "test-secret-token",
  model: "gpt-5.6-terra",
  temperature: 0.1,
  maxOutputTokens: 4000,
  timeoutMs: 60_000,
  maxRequestsPerMinute: 20,
  maxConcurrentRequests: 2,
};

const validProposal = {
  schemaVersion: "maul-shorts-text-chunk-proposal/v1",
  chunks: [
    {
      startWordIndex: 0,
      endWordIndex: 4,
      semanticRole: "hook",
      emphasisWordIndices: [4],
      emphasisLevel: "hero",
    },
  ],
};

describe("MAUL shorts text chunking LLM client", () => {
  it("uses deterministic fallback without making a request when credentials are absent", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const planner = createShortsTextChunkPlanner({
      config: {...config, apiKey: ""},
      fetchImpl,
    });

    const plan = await planner.plan(request);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(plan.strategy).toBe("deterministic_fallback");
    expect(plan.inference.status).toBe("skipped_missing_credentials");
    expect(plan.coverage.exact).toBe(true);
  });

  it("calls the configured OpenAI-compatible endpoint with indexed transcript context", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(
        JSON.stringify({
          choices: [{message: {content: JSON.stringify(validProposal)}}],
        }),
        {status: 200, headers: {"content-type": "application/json"}},
      );
    });
    const planner = createShortsTextChunkPlanner({config, fetchImpl});

    const plan = await planner.plan(request);

    expect(capturedUrl).toBe(
      "https://codex-everywhere.com/v1/chat/completions",
    );
    expect(capturedInit?.headers).toMatchObject({
      authorization: "Bearer test-secret-token",
      "content-type": "application/json",
    });
    const body = JSON.parse(String(capturedInit?.body));
    expect(body).toMatchObject({
      model: "gpt-5.6-terra",
      temperature: 0.1,
      max_completion_tokens: 4000,
      response_format: {type: "json_object"},
    });
    expect(body.messages[0].content).toMatch(/every transcript word/i);
    expect(body.messages[0].content).toMatch(/timing gaps/i);
    expect(body.messages[0].content).toMatch(/vary chunk lengths/i);
    expect(body.messages[0].content).toMatch(/names.*negations|negations.*names/i);
    expect(body.messages[0].content).toMatch(/smallest.*emphasis/i);
    expect(body.messages[0].content).not.toMatch(/rationale|"confidence"/i);
    expect(body.messages[1].content).toContain('"videoDurationMs":40000');
    expect(body.messages[1].content).toContain('"pacing":"fast"');
    expect(body.messages[1].content).toContain('"style":"cinematic"');
    expect(body.messages[1].content).toContain('"audience":"entrepreneurs"');
    expect(body.messages[1].content).toContain('"index":4');
    expect(body.messages[1].content).not.toContain("test-secret-token");
    expect(plan).toMatchObject({
      strategy: "llm_assisted",
      inference: {
        status: "invoked",
        baseUrl: "https://codex-everywhere.com",
        model: "gpt-5.6-terra",
        fallbackReason: null,
      },
      chunks: [
        {
          text: "You do not need permission.",
          emphasis: {text: "permission."},
        },
      ],
    });
    expect(plan.inference.requestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.inference.responseHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(plan)).not.toContain("test-secret-token");
  });

  it("does not duplicate a shared version segment in the endpoint URL", async () => {
    let capturedUrl = "";
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      capturedUrl = String(input);
      return new Response(
        JSON.stringify({
          choices: [{message: {content: JSON.stringify(validProposal)}}],
        }),
        {status: 200, headers: {"content-type": "application/json"}},
      );
    });
    const planner = createShortsTextChunkPlanner({
      config: {...config, baseUrl: "https://codex-everywhere.com/v1"},
      fetchImpl,
    });

    await planner.plan(request);

    expect(capturedUrl).toBe(
      "https://codex-everywhere.com/v1/chat/completions",
    );
  });

  it("falls back explicitly when provider JSON violates exact word coverage", async () => {
    const invalidProposal = {
      ...validProposal,
      chunks: [
        {
          ...validProposal.chunks[0],
          startWordIndex: 1,
        },
      ],
    };
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {message: {content: JSON.stringify(invalidProposal)}},
          ],
        }),
        {status: 200, headers: {"content-type": "application/json"}},
      ),
    );
    const planner = createShortsTextChunkPlanner({config, fetchImpl});

    const plan = await planner.plan(request);

    expect(plan.strategy).toBe("deterministic_fallback");
    expect(plan.inference.status).toBe("failed_invalid_response");
    expect(plan.inference.fallbackReason).toBe(
      "MAUL chunking provider returned an invalid chunk proposal; deterministic fallback applied.",
    );
    expect(plan.coverage.exact).toBe(true);
  });

  it("falls back explicitly when the provider request fails", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("provider unavailable");
    });
    const planner = createShortsTextChunkPlanner({config, fetchImpl});

    const plan = await planner.plan(request);

    expect(plan.strategy).toBe("deterministic_fallback");
    expect(plan.inference.status).toBe("failed_request");
    expect(plan.inference.fallbackReason).toBe(
      "MAUL chunking provider request failed; deterministic fallback applied.",
    );
    expect(plan.coverage.exact).toBe(true);
  });

  it("uses stable fallback diagnostics without retaining an upstream error body", async () => {
    const upstreamBody = `request-id=provider-secret-${"x".repeat(1_100_000)}`;
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(upstreamBody, {status: 503}),
    );
    const planner = createShortsTextChunkPlanner({config, fetchImpl});

    const first = await planner.plan(request);
    const second = await planner.plan(request);

    expect(first.inference).toMatchObject({
      status: "failed_request",
      responseHash: null,
      fallbackReason:
        "MAUL chunking provider request failed; deterministic fallback applied.",
    });
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).not.toContain("provider-secret");
  });

  it("uses safe defaults when credentials and optional provider settings are blank", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const planner = createShortsTextChunkPlanner({
      config: {
        ...config,
        baseUrl: " ",
        path: " ",
        apiKey: " ",
        model: " ",
      },
      fetchImpl,
    });

    const plan = await planner.plan(request);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(plan.inference).toMatchObject({
      status: "skipped_missing_credentials",
      baseUrl: "https://codex-everywhere.com",
      model: "gpt-5.6-terra",
    });
  });

  it("rate-limits paid provider calls and falls back without losing words", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          choices: [{message: {content: JSON.stringify(validProposal)}}],
        }),
        {status: 200, headers: {"content-type": "application/json"}},
      ),
    );
    const planner = createShortsTextChunkPlanner({
      config: {...config, maxRequestsPerMinute: 1},
      fetchImpl,
    });

    const first = await planner.plan(request);
    const limited = await planner.plan(request);

    expect(first.inference.status).toBe("invoked");
    expect(limited).toMatchObject({
      strategy: "deterministic_fallback",
      coverage: {exact: true},
      inference: {
        status: "skipped_rate_limited",
        fallbackReason:
          "MAUL chunking provider rate limit reached; deterministic fallback applied.",
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back on an empty provider envelope without leaking credentials", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({choices: []}), {
        status: 200,
        headers: {"content-type": "application/json"},
      }),
    );
    const planner = createShortsTextChunkPlanner({config, fetchImpl});

    const plan = await planner.plan(request);

    expect(plan.inference.status).toBe("failed_invalid_response");
    expect(plan.inference.fallbackReason).not.toContain(config.apiKey);
    expect(plan.coverage.exact).toBe(true);
  });
});
