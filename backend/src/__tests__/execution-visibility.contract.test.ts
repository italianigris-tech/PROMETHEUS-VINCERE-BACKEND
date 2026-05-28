import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

const parseSseEvents = (body: string): Array<Record<string, unknown>> =>
  body
    .split(/\n\n+/)
    .map((chunk) => chunk.split(/\n/).find((line) => line.startsWith("data: ")))
    .filter((line): line is string => Boolean(line))
    .map((line) => JSON.parse(line.slice("data: ".length)) as Record<string, unknown>);

describe("execution visibility contract", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("exposes backend-owned stage graph, ETA, compute profile, and replayable telemetry events", async () => {
    const context = await createTestApp({storageDir: tempDir});

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        prompt: "Build a transparent cinematic timeline with visible execution progress."
      }
    });

    expect(createResponse.statusCode).toBe(202);
    const createBody = createResponse.json();
    expect(createBody.current_stage).not.toBe("building-timeline");
    expect(createBody.urls.events).toBe(`/api/jobs/${createBody.job_id}/events`);
    expect(createBody.urls.execution_visibility).toBe(`/api/jobs/${createBody.job_id}/execution-visibility`);
    expect(createBody.executionVisibility).toMatchObject({
      jobId: createBody.job_id,
      stageGraph: {
        currentStage: "received",
        activeStage: expect.objectContaining({
          id: "received",
          status: "active"
        })
      },
      eta: {
        confidence: expect.any(String)
      },
      compute: {
        cpuLoad: expect.any(Number),
        gpuLoad: expect.any(Number),
        ioLoad: expect.any(Number)
      }
    });
    expect(createBody.executionVisibility.eta.remainingMs).toBeGreaterThan(0);
    expect(createBody.executionVisibility.progress.overall).toBe(0);
    expect(createBody.executionVisibility.stages.map((stage: {id: string}) => stage.id)).toEqual(
      expect.arrayContaining(["received", "analyzing", "metadata_ready", "plan_ready", "execution_ready", "ranking", "completed"])
    );

    const replayResponse = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${createBody.job_id}/events?replay=once`
    });
    expect(replayResponse.statusCode).toBe(200);
    expect(replayResponse.headers["content-type"]).toContain("text/event-stream");
    expect(replayResponse.body).toContain("event: JOB_CREATED");
    expect(replayResponse.body).toContain("event: STAGE_STARTED");

    const initialEvents = parseSseEvents(replayResponse.body);
    expect(initialEvents.length).toBeGreaterThanOrEqual(2);
    expect(initialEvents.every((event) => event.jobId === createBody.job_id)).toBe(true);
    expect(new Set(initialEvents.map((event) => event.idempotencyKey)).size).toBe(initialEvents.length);
    expect(initialEvents[0]).toMatchObject({
      type: "JOB_CREATED",
      jobId: createBody.job_id,
      timestamp: expect.any(String),
      progress: expect.any(Number),
      compute: expect.objectContaining({
        cpuLoad: expect.any(Number),
        gpuLoad: expect.any(Number),
        ioLoad: expect.any(Number)
      })
    });

    await context.queue.onIdle();

    const visibilityResponse = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${createBody.job_id}/execution-visibility`
    });
    expect(visibilityResponse.statusCode).toBe(200);
    expect(visibilityResponse.json()).toMatchObject({
      jobId: createBody.job_id,
      stageGraph: {
        currentStage: "completed",
        activeStage: null
      },
      eta: {
        remainingMs: 0,
        confidence: "high"
      }
    });
    expect(visibilityResponse.json().progress.overall).toBe(100);
    expect(visibilityResponse.json().stageGraph.completedStages).toContain("ranking");

    const completedReplayResponse = await context.app.inject({
      method: "GET",
      url: `/api/jobs/${createBody.job_id}/events?replay=once`
    });
    const completedEvents = parseSseEvents(completedReplayResponse.body);
    expect(completedEvents.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        "STAGE_PROGRESS",
        "STAGE_COMPLETED",
        "ETA_UPDATED",
        "COMPUTE_PROFILE_UPDATED"
      ])
    );

    await context.app.close();
  });
});
