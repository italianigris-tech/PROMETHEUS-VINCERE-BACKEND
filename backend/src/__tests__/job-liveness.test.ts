import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";
import {createInitialJobRecord} from "../pipeline";

describe("job liveness recovery", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("marks stale in-flight jobs as failed during startup reconciliation", async () => {
    const staleNow = "2026-05-25T12:00:00.000Z";
    const createdAt = "2026-05-25T11:40:00.000Z";

    const seedContext = await createTestApp({
      storageDir: tempDir,
      deps: {
        now: () => staleNow
      }
    });

    const staleJob = createInitialJobRecord({
      request: {
        job_id: "job_stale_1",
        prompt: "Recover me if the worker dies.",
        source_media_ref: undefined,
        input_source_video: null,
        input_assets: [],
        descriptor_assets: [],
        creator_niche: undefined,
        target_platform: undefined,
        min_clip_count: undefined,
        max_clip_count: undefined,
        metadata_overrides: {},
        provided_transcript: undefined,
        sound_design_manifest: undefined
      },
      repository: seedContext.repository,
      deps: {
        now: () => createdAt
      }
    });

    await seedContext.repository.createJobRecord({
      ...staleJob,
      status: "audio_render",
      current_stage: "audio_render",
      created_at: createdAt,
      updated_at: createdAt,
      completed_at: null,
      stage_history: [
        {stage: "received", at: createdAt},
        {stage: "analyzing", at: createdAt},
        {stage: "metadata_ready", at: createdAt},
        {stage: "plan_ready", at: createdAt},
        {stage: "execution_ready", at: createdAt},
        {stage: "audio_render", at: createdAt, note: "Audio render started."}
      ]
    });

    await seedContext.app.close();

    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        JOB_STAGE_STALE_AFTER_MS: String(5 * 60 * 1000)
      },
      deps: {
        now: () => staleNow
      }
    });

    try {
      const job = await context.service.getJob("job_stale_1");

      expect(job.status).toBe("failed");
      expect(job.current_stage).toBe("failed");
      expect(job.error_message).toContain("stale");
      expect(job.warning_list.some((warning) => /stale/i.test(warning))).toBe(true);
      expect(job.stage_history.at(-1)).toMatchObject({
        stage: "failed"
      });
    } finally {
      await context.app.close();
    }
  });
});
