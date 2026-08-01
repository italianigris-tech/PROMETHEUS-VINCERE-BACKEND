import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";
import {MaulDurableControlPlane} from "../maul/control-plane";
import {MaulLearningStore} from "../maul/learning";

const tenantHeaders = {
  "x-maul-tenant-id": "tenant_alpha",
  "x-maul-creator-id": "creator_ops"
};

describe("MAUL production control plane", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("persists idempotent jobs across restart and supports leases, retries, cancellation, spend caps, and telemetry", async () => {
    let context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {MAUL_WORKER_TOKEN: "worker-secret"}
    });
    const missingIdentity = await context.app.inject({
      method: "POST",
      url: "/api/maul/v1/projects",
      payload: {
        goal: "editing_speed",
        platform: "youtube_shorts",
        sourceProfile: {
          mode: "single_speaker_talking_head",
          principalSpeakerCount: 1,
          primaryLanguage: "en"
        },
        treatmentPreference: "minimal_expert",
        source: {
          originalFilename: "ops.mp4",
          storageKey: "uploads/ops.mp4",
          mediaType: "video/mp4",
          sha256: "1".repeat(64),
          durationMs: 60000,
          width: 1920,
          height: 1080,
          fps: 30,
          hasAudio: true,
          hasVideo: true
        }
      }
    });
    expect(missingIdentity.statusCode).toBe(403);

    const projectResponse = await context.app.inject({
      method: "POST",
      url: "/api/maul/v1/projects",
      headers: tenantHeaders,
      payload: {
        goal: "editing_speed",
        platform: "youtube_shorts",
        sourceProfile: {
          mode: "single_speaker_talking_head",
          principalSpeakerCount: 1,
          primaryLanguage: "en"
        },
        treatmentPreference: "minimal_expert",
        source: {
          originalFilename: "ops.mp4",
          storageKey: "uploads/ops.mp4",
          mediaType: "video/mp4",
          sha256: "1".repeat(64),
          durationMs: 60000,
          width: 1920,
          height: 1080,
          fps: 30,
          hasAudio: true,
          hasVideo: true
        }
      }
    });
    expect(projectResponse.statusCode).toBe(201);
    const project = projectResponse.json().project;
    expect(project.tenantId).toBe("tenant_alpha");
    expect(project.creatorId).toBe("creator_ops");

    const protectedProject = await context.app.inject({
      method: "GET",
      url: `/api/maul/v1/projects/${project.id}`,
      headers: tenantHeaders
    });
    expect(protectedProject.statusCode).toBe(200);

    const protectedFromWrongTenant = await context.app.inject({
      method: "GET",
      url: `/api/maul/v1/projects/${project.id}`,
      headers: {...tenantHeaders, "x-maul-tenant-id": "tenant_other"}
    });
    expect(protectedFromWrongTenant.statusCode).toBe(403);
    const submitPayload = {
      operation: "render_short",
      payload: {candidateArtifactId: "candidate_pending"},
      estimatedCostUsd: 1.25,
      maxAttempts: 3
    };
    const first = await context.app.inject({
      method: "POST",
      url: `/api/maul/v1/projects/${project.id}/jobs`,
      headers: {...tenantHeaders, "idempotency-key": "render-one"},
      payload: submitPayload
    });
    expect(first.statusCode).toBe(202);
    const firstJob = first.json().job;
    expect(firstJob.status).toBe("queued");

    const duplicate = await context.app.inject({
      method: "POST",
      url: `/api/maul/v1/projects/${project.id}/jobs`,
      headers: {...tenantHeaders, "idempotency-key": "render-one"},
      payload: submitPayload
    });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json().job.id).toBe(firstJob.id);

    const wrongTenant = await context.app.inject({
      method: "GET",
      url: `/api/maul/v1/projects/${project.id}/jobs/${firstJob.id}`,
      headers: {...tenantHeaders, "x-maul-tenant-id": "tenant_other"}
    });
    expect(wrongTenant.statusCode).toBe(403);

    await context.app.close();
    context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {MAUL_WORKER_TOKEN: "worker-secret"}
    });
    const persisted = await context.app.inject({
      method: "GET",
      url: `/api/maul/v1/projects/${project.id}/jobs/${firstJob.id}`,
      headers: tenantHeaders
    });
    expect(persisted.statusCode).toBe(200);
    expect(persisted.json().job.id).toBe(firstJob.id);

    const leased = await context.app.inject({
      method: "POST",
      url: "/api/maul/v1/workers/lease",
      headers: {"x-maul-worker-token": "worker-secret"},
      payload: {workerId: "worker_a", leaseMs: 30000}
    });
    expect(leased.statusCode).toBe(200);
    expect(leased.json().job.id).toBe(firstJob.id);
    const leaseToken = leased.json().job.leaseToken;

    const retry = await context.app.inject({
      method: "POST",
      url: `/api/maul/v1/workers/jobs/${firstJob.id}/fail`,
      headers: {"x-maul-worker-token": "worker-secret"},
      payload: {leaseToken, error: "transient renderer exit", retryable: true, retryAfterMs: 0}
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().job.status).toBe("queued");
    expect(retry.json().job.attempts).toBe(1);

    const leasedAgain = await context.app.inject({
      method: "POST",
      url: "/api/maul/v1/workers/lease",
      headers: {"x-maul-worker-token": "worker-secret"},
      payload: {workerId: "worker_b", leaseMs: 30000}
    });
    const completed = await context.app.inject({
      method: "POST",
      url: `/api/maul/v1/workers/jobs/${firstJob.id}/complete`,
      headers: {"x-maul-worker-token": "worker-secret"},
      payload: {
        leaseToken: leasedAgain.json().job.leaseToken,
        result: {exportArtifactId: "export_done"},
        actualCostUsd: 1.1
      }
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().job.status).toBe("completed");

    const cancelSubmit = await context.app.inject({
      method: "POST",
      url: `/api/maul/v1/projects/${project.id}/jobs`,
      headers: {...tenantHeaders, "idempotency-key": "cancel-me"},
      payload: {...submitPayload, operation: "generate_thumbnails", estimatedCostUsd: 0.5}
    });
    const cancelled = await context.app.inject({
      method: "POST",
      url: `/api/maul/v1/projects/${project.id}/jobs/${cancelSubmit.json().job.id}/cancel`,
      headers: tenantHeaders,
      payload: {reason: "Creator changed direction."}
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().job.status).toBe("cancelled");

    const spendBlocked = await context.app.inject({
      method: "POST",
      url: `/api/maul/v1/projects/${project.id}/jobs`,
      headers: {...tenantHeaders, "idempotency-key": "too-expensive"},
      payload: {...submitPayload, estimatedCostUsd: 99}
    });
    expect(spendBlocked.statusCode).toBe(429);
    expect(spendBlocked.json().error).toMatch(/spend|cost|cap/i);

    const telemetry = await context.app.inject({
      method: "GET",
      url: `/api/maul/v1/projects/${project.id}/jobs/${firstJob.id}/telemetry`,
      headers: tenantHeaders
    });
    expect(telemetry.statusCode).toBe(200);
    expect(telemetry.json().events.map((event: any) => event.type)).toEqual(expect.arrayContaining([
      "queued",
      "leased",
      "retry_scheduled",
      "completed"
    ]));

    const retentionControl = new MaulDurableControlPlane(
      tempDir,
      context.maulProjects,
      () => new Date(Date.now() + 31 * 24 * 60 * 60 * 1000)
    );
    await retentionControl.initialize();
    const retention = await retentionControl.purgeExpiredTerminalJobs();
    expect(retention).toEqual({retentionDays: 30, removedJobs: 2, removedTelemetryFiles: 2});
    await expect(retentionControl.readJob(firstJob.id)).rejects.toThrow(/not found/i);

    const deletionJob = await context.app.inject({
      method: "POST",
      url: `/api/maul/v1/projects/${project.id}/jobs`,
      headers: {...tenantHeaders, "idempotency-key": "delete-with-project"},
      payload: {...submitPayload, estimatedCostUsd: 0.25}
    });
    expect(deletionJob.statusCode).toBe(202);

    const feedback = await context.app.inject({
      method: "POST",
      url: `/api/maul/v1/projects/${project.id}/feedback`,
      headers: tenantHeaders,
      payload: {
        subjectArtifactId: project.rootSourceAssetId,
        treatmentId: "minimal_expert",
        verdict: "winner",
        rating: 5,
        failureClasses: [],
        notes: "Delete this project-scoped learning signal.",
        explicitCreatorPreference: true
      }
    });
    expect(feedback.statusCode).toBe(201);

    const badDelete = await context.app.inject({
      method: "DELETE",
      url: `/api/maul/v1/projects/${project.id}`,
      headers: tenantHeaders,
      payload: {confirmProjectId: "wrong_project", reason: "Retention request."}
    });
    expect(badDelete.statusCode).toBe(400);
    const afterBadDeleteControl = new MaulDurableControlPlane(tempDir, context.maulProjects);
    await afterBadDeleteControl.initialize();
    expect((await afterBadDeleteControl.readJob(deletionJob.json().job.id)).status).toBe("queued");
    const afterBadDeleteLearning = new MaulLearningStore(tempDir);
    await afterBadDeleteLearning.initialize();
    expect((await afterBadDeleteLearning.readTasteMemory("tenant_alpha", "creator_ops")).feedbackEventIds).toHaveLength(1);

    const deleted = await context.app.inject({
      method: "DELETE",
      url: `/api/maul/v1/projects/${project.id}`,
      headers: tenantHeaders,
      payload: {confirmProjectId: project.id, reason: "Creator requested permanent deletion."}
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toEqual({deleted: true, projectId: project.id, recoverable: false});

    const afterDeleteControl = new MaulDurableControlPlane(tempDir, context.maulProjects);
    await afterDeleteControl.initialize();
    await expect(afterDeleteControl.readJob(deletionJob.json().job.id)).rejects.toThrow(/not found/i);
    const afterDeleteLearning = new MaulLearningStore(tempDir);
    await afterDeleteLearning.initialize();
    expect((await afterDeleteLearning.readTasteMemory("tenant_alpha", "creator_ops")).feedbackEventIds).toEqual([]);
    expect((await afterDeleteLearning.readPatternMemory()).treatments).toEqual({});

    const afterDelete = await context.app.inject({
      method: "GET",
      url: `/api/maul/projects/${project.id}`
    });
    expect(afterDelete.statusCode).toBe(404);

    await context.app.close();
  }, 15_000);
});
