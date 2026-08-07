import {describe, expect, it} from "vitest";

import {asyncJobEnvelopeSchema, asyncJobEventSchema} from "./async-jobs";

describe("async job contracts", () => {
  it("parses a stable job envelope", () => {
    expect(asyncJobEnvelopeSchema.parse({
      jobId: "job_1",
      kind: "video-analysis",
      correlationId: "request_1",
      idempotencyKey: "project_1:source_1",
      requestedAt: "2026-08-06T10:00:00.000Z",
      payload: {sourcePath: "source.mp4"}
    })).toMatchObject({jobId: "job_1", attempt: 0});
  });

  it("rejects invalid progress and event types", () => {
    expect(() => asyncJobEventSchema.parse({
      schemaVersion: "prometheus-async-job-event/v1",
      id: "event_1",
      sequence: 1,
      type: "unknown",
      status: "queued",
      jobId: "job_1",
      kind: "analysis",
      attempt: 0,
      timestamp: "2026-08-06T10:00:00.000Z",
      progress: 101
    })).toThrow();
  });
});
