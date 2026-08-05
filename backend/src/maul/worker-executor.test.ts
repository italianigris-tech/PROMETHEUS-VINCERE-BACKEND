import {afterEach, describe, expect, it, vi} from "vitest";

import {MaulDurableControlPlane} from "./control-plane.js";
import {MaulWorkerExecutor} from "./worker-executor.js";
import {cleanupTempDir, makeTempDir} from "../__tests__/test-utils.js";

const payload = {
  timelineRequest: {
    transcript: {
      language: "en",
      text: "Make it matter.",
      words: [
        {text: "Make", startMs: 0, endMs: 200, confidence: 1},
        {text: "it", startMs: 200, endMs: 350, confidence: 1},
        {text: "matter.", startMs: 350, endMs: 700, confidence: 1},
      ],
    },
    selectedWindow: {sourceStartMs: 0, sourceEndMs: 700},
    vadEvidence: {kind: "detected_spans", provider: "manual_verified_vad", silenceSpans: []},
  },
  musicTrack: {
    id: "music_1", storagePath: "music.wav", licenseType: "licensed", commercialAllowed: true,
    licenseVerified: true, renderSafe: true, title: "Track", artist: "Artist", durationSec: 30,
  },
  actualCostUsd: 0.5,
};

describe("MaulWorkerExecutor", () => {
  let tempDir = "";

  afterEach(async () => {
    if (tempDir) await cleanupTempDir(tempDir);
  });

  it("holds one leased render job for perceptual review instead of fabricating approval", async () => {
    tempDir = await makeTempDir();
    const project = {id: "project_1", tenantId: "tenant_1", creatorId: "creator_1", intake: {treatmentPreference: "minimal_expert"}};
    const reviewCandidate = vi.fn(async () => ({review: {artifactId: "review_1"}}));
    const renderShort = vi.fn(async () => ({export: {artifactId: "export_1"}}));
    const projects = {
      getProject: async () => ({project}),
      createEditorialTimeline: async () => ({timeline: {artifactId: "timeline_1"}}),
      createTreatmentCatalog: async () => ({
        treatments: [{
          artifactId: "treatment_1",
          payload: {treatmentId: "minimal_expert", judgmentLayer: {rubric: [{id: "clarity", minimumScore: 80}]}}
        }]
      }),
      createCandidates: async () => ({candidates: [{artifactId: "candidate_1"}]}),
      createPlanningBundle: async () => ({planningBundle: {artifactId: "bundle_1"}}),
      reviewCandidate,
      renderShort,
    };
    const control = new MaulDurableControlPlane(tempDir, projects as any);
    await control.initialize();
    await control.submit({projectId: project.id, tenantId: project.tenantId, creatorId: project.creatorId, idempotencyKey: "job_key_1", input: {operation: "render_short", payload, estimatedCostUsd: 1}});

    const executor = new MaulWorkerExecutor({control, projects: projects as any, workerId: "worker_1"});
    await expect(executor.runOnce()).resolves.toMatchObject({
      status: "completed",
      result: {
        planningBundleArtifactId: "bundle_1",
        status: "awaiting_perceptual_review",
        qualityTruthStatus: "not_evaluated",
      },
    });
    expect(reviewCandidate).not.toHaveBeenCalled();
    expect(renderShort).not.toHaveBeenCalled();
  });

  it("terminal-fails malformed payloads instead of retrying them", async () => {
    tempDir = await makeTempDir();
    const project = {id: "project_2", tenantId: "tenant_2", creatorId: "creator_2", intake: {treatmentPreference: "minimal_expert"}};
    const projects = {getProject: async () => ({project})};
    const control = new MaulDurableControlPlane(tempDir, projects as any);
    await control.initialize();
    await control.submit({projectId: project.id, tenantId: project.tenantId, creatorId: project.creatorId, idempotencyKey: "job_key_2", input: {operation: "render_short", payload: {}, estimatedCostUsd: 1}});

    const executor = new MaulWorkerExecutor({control, projects: projects as any, workerId: "worker_2"});
    await expect(executor.runOnce()).resolves.toMatchObject({status: "failed", attempts: 1});
  });
});
