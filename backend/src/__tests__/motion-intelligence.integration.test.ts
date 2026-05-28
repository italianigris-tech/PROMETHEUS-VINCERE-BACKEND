import {readFile} from "node:fs/promises";
import path from "node:path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
  cleanupTempDir,
  createTestApp,
  makeTempDir
} from "./test-utils";

describe("motion intelligence integration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("adds motion intelligence artifacts without changing the existing queue path", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const response = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        prompt: "Compare the old slow workflow with the new reliable metric-driven workflow.",
        target_platform: "shorts",
        provided_transcript: [
          "Old", "workflow", "missed", "deadlines.", "New", "workflow", "keeps", "the", "metric", "clear."
        ].map((text, index) => ({
          text,
          start_ms: index * 360,
          end_ms: index * 360 + 260,
          confidence: 0.94
        }))
      }
    });
    const body = response.json() as {job_id: string};

    await context.queue.onIdle();

    const job = await context.service.getJob(body.job_id);
    const motionPlan = await context.repository.readArtifact<Record<string, unknown>>(body.job_id, "motion_plan");
    const traceLog = await readFile(path.join(context.repository.jobDir(body.job_id), "motion_trace.log"), "utf-8");
    const events = context.executionTelemetry.getReplayEvents(body.job_id).map((event) => event.type);

    expect(job.current_stage).toBe("completed");
    expect(motionPlan.motion_intelligence).toMatchObject({
      version: "motion-profile-v1"
    });
    expect(motionPlan.motion_driver_plan).toMatchObject({
      keyframePolicy: "baked-parameters",
      rendererInterpolation: "deterministic"
    });
    expect(traceLog).toContain("chosen_primitives=");
    expect(traceLog).toContain("ownership=");
    expect(events).toContain("MOTION_INTELLIGENCE_PLANNED");

    await context.app.close();
  });
});
