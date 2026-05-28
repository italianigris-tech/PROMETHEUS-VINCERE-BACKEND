import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {
  cleanupTempDir,
  createTestApp,
  makeTempDir
} from "./test-utils";

describe("short-form executor integration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("routes viral clip jobs through short-form execution while preserving domain telemetry", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const response = await context.app.inject({
      method: "POST",
      url: "/api/generate-viral-clips",
      payload: {
        projectId: "project-router",
        videoId: "video-router",
        targetPlatform: "shorts",
        prompt: "Generate short-form clips with strong hooks.",
        providedTranscript: Array.from({length: 90}, (_, index) => ({
          text: index % 12 === 0 ? "truth" : `word${index}`,
          start_ms: index * 420,
          end_ms: index * 420 + 260,
          confidence: 0.9
        }))
      }
    });

    expect(response.statusCode).toBe(202);
    const body = response.json() as {jobId: string};
    await context.queue.onIdle();

    const job = await context.service.getJob(body.jobId);
    const clips = await context.service.getClipSelection(body.jobId);
    const events = context.executionTelemetry.getReplayEvents(body.jobId).map((event) => event.type);

    expect(job.current_stage).toBe("completed");
    expect(clips.source_summary.target_platform).toBe("shorts");
    expect(events).toEqual(expect.arrayContaining([
      "ROUTED_TO_EXECUTOR",
      "SEGMENTING",
      "SCORING",
      "RANKING",
      "CLIP_READY",
      "MUSIC_ALIGNED"
    ]));
  });
});
