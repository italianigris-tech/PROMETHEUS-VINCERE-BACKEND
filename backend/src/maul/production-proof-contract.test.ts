import {createHash} from "node:crypto";

import {describe, expect, it} from "vitest";

import type {ShortsTextChunkPlan} from "@prometheus/shared-types";

import {
  PRODUCTION_PROOF_REQUIRED_STAGES,
  assertInvokedProductionChunkPlan,
  createProductionStageTimer,
  maulProductionLayerPolicySchema,
  maulProductionRunDiagnosticsSchema,
} from "./production-proof-contract.js";

const hash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const invokedPlan = (): ShortsTextChunkPlan => ({
  schemaVersion: "maul-shorts-text-chunk-plan/v1",
  transcriptHash: hash("transcript"),
  videoDurationMs: 1_000,
  pacing: "measured",
  style: "cinematic",
  strategy: "llm_assisted",
  chunks: [{
    chunkId: "chunk_1",
    startWordIndex: 0,
    endWordIndex: 0,
    wordCount: 1,
    text: "Listen",
    startMs: 0,
    endMs: 500,
    semanticRole: "hook",
    emphasis: {wordIndices: [0], text: "Listen", level: "hero"},
    rationale: "Provider selected the opening hook.",
    confidence: 0.9,
  }],
  coverage: {
    totalWordCount: 1,
    coveredWordCount: 1,
    omittedWordIndices: [],
    duplicatedWordIndices: [],
    exact: true,
  },
  inference: {
    status: "invoked",
    provider: "openai_compatible",
    baseUrl: "https://example.com",
    model: "provider-model",
    requestHash: hash("request"),
    responseHash: hash("response"),
    fallbackReason: null,
    usage: {
      promptTokens: 180,
      completionTokens: 42,
      totalTokens: 222,
      requestId: "request_123",
      latencyMs: 350,
    },
  },
  validationFindings: [],
});

const policy = () => maulProductionLayerPolicySchema.parse({
  baseVideo: "required",
  typography: "required",
  sourceTreatment: "disabled",
  sourceLegibilityOverlay: "disabled",
  editorialCuts: "disabled",
  transitions: "disabled",
  backgroundAnimation: "disabled",
  motionGraphics: "disabled",
  audioTreatment: "disabled",
});

describe("MAUL production proof contracts", () => {
  it("rejects every non-invoked chunk plan before production rendering", () => {
    const fallbackStatuses: ShortsTextChunkPlan["inference"]["status"][] = [
      "skipped_missing_credentials",
      "skipped_rate_limited",
      "failed_request",
      "failed_invalid_response",
    ];

    for (const status of fallbackStatuses) {
      const plan = invokedPlan();
      plan.strategy = "deterministic_fallback";
      plan.inference = {
        ...plan.inference,
        status,
        requestHash: null,
        responseHash: null,
        fallbackReason: `Fallback status: ${status}`,
      };
      expect(() => assertInvokedProductionChunkPlan(plan), status)
        .toThrow(/production.*invoked|invoked.*production/i);
    }

    expect(assertInvokedProductionChunkPlan(invokedPlan()).inference.status)
      .toBe("invoked");
  });

  it("requires every non-typography layer to be explicitly disabled", () => {
    const parsed = policy();

    expect(parsed.sourceLegibilityOverlay).toBe("disabled");
    expect(() => maulProductionLayerPolicySchema.parse({
      ...parsed,
      sourceTreatment: "enabled",
    })).toThrow();
    expect(() => maulProductionLayerPolicySchema.parse({
      ...parsed,
      unexpectedLayer: "enabled",
    })).toThrow();
  });

  it("measures stage duration from a monotonic clock and records cache state", () => {
    const monotonicValues = [1_000, 1_037.25];
    const isoValues = [
      "2026-08-10T12:00:00.000Z",
      "2026-08-10T12:00:00.037Z",
    ];
    const timer = createProductionStageTimer("media_segment", {
      monotonicNow: () => monotonicValues.shift()!,
      isoNow: () => isoValues.shift()!,
    });

    const receipt = timer.complete({
      cache: "hit",
      inputSha256: hash("input"),
      outputSha256: hash("output"),
      providerRequestId: null,
      bytesRead: 120,
      bytesWritten: 80,
      warnings: [],
    });

    expect(receipt).toMatchObject({
      stage: "media_segment",
      startedAt: "2026-08-10T12:00:00.000Z",
      endedAt: "2026-08-10T12:00:00.037Z",
      durationMs: 37.25,
      cache: "hit",
      failure: null,
    });
  });

  it("rejects diagnostics that omit any required causal stage", () => {
    const stage = (name: string) => ({
      stage: name,
      startedAt: "2026-08-10T12:00:00.000Z",
      endedAt: "2026-08-10T12:00:00.010Z",
      durationMs: 10,
      cache: "miss",
      inputSha256: hash(`${name}:input`),
      outputSha256: hash(`${name}:output`),
      providerRequestId: null,
      bytesRead: null,
      bytesWritten: null,
      warnings: [],
      failure: null,
    });
    const complete = {
      schemaVersion: "maul-production-run-diagnostics/v1",
      layerPolicy: policy(),
      stages: PRODUCTION_PROOF_REQUIRED_STAGES.map(stage),
    };

    expect(maulProductionRunDiagnosticsSchema.parse(complete).stages)
      .toHaveLength(PRODUCTION_PROOF_REQUIRED_STAGES.length);
    expect(() => maulProductionRunDiagnosticsSchema.parse({
      ...complete,
      stages: complete.stages.slice(1),
    })).toThrow(/required.*stage|stage.*required/i);
  });
});
