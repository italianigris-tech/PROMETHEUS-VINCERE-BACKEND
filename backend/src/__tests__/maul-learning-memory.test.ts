import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

const headers = {
  "x-maul-tenant-id": "tenant_learning",
  "x-maul-creator-id": "creator_learning"
};

describe("MAUL feedback and learning memory", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("records review feedback, creator taste, pattern memory, and later outcomes without mutating intent", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const projectResponse = await context.app.inject({
      method: "POST",
      url: "/api/maul/projects",
      payload: {
        tenantId: "tenant_learning",
        creatorId: "creator_learning",
        goal: "brand_consistency",
        platform: "youtube_shorts",
        sourceProfile: {
          mode: "single_speaker_talking_head",
          principalSpeakerCount: 1,
          primaryLanguage: "en"
        },
        treatmentPreference: "minimal_expert",
        source: {
          originalFilename: "learning.mp4",
          storageKey: "uploads/learning.mp4",
          mediaType: "video/mp4",
          sha256: "2".repeat(64),
          durationMs: 60000,
          width: 1920,
          height: 1080,
          fps: 30,
          hasAudio: true,
          hasVideo: true
        }
      }
    });
    const {project, sourceAsset} = projectResponse.json();

    const winner = await context.app.inject({
      method: "POST",
      url: `/api/maul/v1/projects/${project.id}/feedback`,
      headers,
      payload: {
        subjectArtifactId: sourceAsset.artifactId,
        treatmentId: "minimal_expert",
        verdict: "winner",
        rating: 5,
        failureClasses: [],
        notes: "The restraint feels like me.",
        explicitCreatorPreference: true
      }
    });
    expect(winner.statusCode).toBe(201);

    const loser = await context.app.inject({
      method: "POST",
      url: `/api/maul/v1/projects/${project.id}/feedback`,
      headers,
      payload: {
        subjectArtifactId: sourceAsset.artifactId,
        treatmentId: "premium_direct_response",
        verdict: "loser",
        rating: 1,
        failureClasses: ["cheap_urgency"],
        notes: "Too salesy for this creator.",
        explicitCreatorPreference: true
      }
    });
    expect(loser.statusCode).toBe(201);

    const outcome = await context.app.inject({
      method: "POST",
      url: `/api/maul/v1/projects/${project.id}/outcomes`,
      headers,
      payload: {
        subjectArtifactId: sourceAsset.artifactId,
        treatmentId: "minimal_expert",
        observedAt: "2026-07-28T10:00:00.000Z",
        metrics: {views: 12000, averageWatchPercentage: 0.82, clickThroughRate: 0.071}
      }
    });
    expect(outcome.statusCode).toBe(201);

    const taste = await context.app.inject({
      method: "GET",
      url: `/api/maul/v1/projects/${project.id}/creator-taste-memory`,
      headers
    });
    expect(taste.statusCode).toBe(200);
    expect(taste.json().memory).toEqual(expect.objectContaining({
      creatorId: "creator_learning",
      advisoryOnly: true,
      silentIntentMutationAllowed: false,
      explicitPreferredTreatmentIds: ["minimal_expert"]
    }));
    expect(taste.json().memory.treatmentStats.minimal_expert).toEqual(expect.objectContaining({wins: 1, averageRating: 5}));
    expect(taste.json().memory.treatmentStats.premium_direct_response).toEqual(expect.objectContaining({losses: 1, averageRating: 1}));

    const patterns = await context.app.inject({
      method: "GET",
      url: `/api/maul/v1/projects/${project.id}/pattern-memory`,
      headers
    });
    expect(patterns.statusCode).toBe(200);
    expect(patterns.json().memory.treatments.premium_direct_response.failureCounts.cheap_urgency).toBe(1);
    expect(patterns.json().memory.treatments.minimal_expert.outcomes.averageWatchPercentage).toBe(0.82);

    const refreshedProject = await context.app.inject({
      method: "GET",
      url: `/api/maul/projects/${project.id}`
    });
    expect(refreshedProject.json().project.intake.treatmentPreference).toBe("minimal_expert");

    await context.app.close();
  });
});
