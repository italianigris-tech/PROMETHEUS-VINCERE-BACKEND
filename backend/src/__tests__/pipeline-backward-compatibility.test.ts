import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
  cleanupTempDir,
  createTestApp,
  makeTempDir
} from "./test-utils";

describe("pipeline backward compatibility", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("keeps existing generic job contracts and the same queue path", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const response = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        prompt: "Build a standard polished video edit.",
        target_platform: "generic",
        provided_transcript: Array.from({length: 70}, (_, index) => ({
          text: `message${index}`,
          start_ms: index * 500,
          end_ms: index * 500 + 280,
          confidence: 0.88
        }))
      }
    });

    expect(response.statusCode).toBe(202);
    const body = response.json() as {job_id: string; status: string; urls: Record<string, string>};
    expect(body.status).toBe("received");
    expect(body.urls.job).toBe(`/api/jobs/${body.job_id}`);

    await context.queue.onIdle();

    const job = await context.service.getJob(body.job_id);
    const metadata = await context.service.getMetadataProfile(body.job_id);
    const execution = await context.service.getExecutionPlan(body.job_id);
    const events = context.executionTelemetry.getReplayEvents(body.job_id);
    const routed = events.find((event) => event.type === "ROUTED_TO_EXECUTOR");

    expect(job.current_stage).toBe("completed");
    expect(metadata.job.job_id).toBe(body.job_id);
    expect(execution.job_id).toBe(body.job_id);
    expect(routed?.detail?.capability).toBe("main_video");
    expect(routed?.detail?.executor).toBe("main_video");
  });
});
