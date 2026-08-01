import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

describe("MAUL project lineage API", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("creates, reloads, resumes, and audits one canonical project", async () => {
    const first = await createTestApp({storageDir: tempDir});
    const createdResponse = await first.app.inject({
      method: "POST",
      url: "/api/maul/projects",
      payload: {
        creatorId: "creator_alpha",
        goal: "retention",
        platform: "instagram_reels",
        sourceProfile: {
          mode: "single_speaker_talking_head",
          principalSpeakerCount: 1,
          primaryLanguage: "en"
        },
        brandKitId: null,
        treatmentPreference: "founder_podcast",
        source: {
          originalFilename: "founder-talk.mp4",
          storageKey: "uploads/founder-talk.mp4",
          mediaType: "video/mp4",
          sha256: "a".repeat(64),
          durationMs: 120000,
          width: 1920,
          height: 1080,
          fps: 30,
          hasAudio: true,
          hasVideo: true
        }
      }
    });

    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json();
    expect(created.project.id).toMatch(/^maul_project_/);
    expect(created.project.canonicalJobId).toMatch(/^maul_job_/);
    expect(created.sourceAsset.lineage.projectId).toBe(created.project.id);
    expect(created.project.rootSourceAssetId).toBe(created.sourceAsset.artifactId);
    await first.app.close();

    const restarted = await createTestApp({storageDir: tempDir});
    const loadedResponse = await restarted.app.inject({
      method: "GET",
      url: `/api/maul/projects/${created.project.id}`
    });

    expect(loadedResponse.statusCode).toBe(200);
    expect(loadedResponse.json().project.canonicalJobId).toBe(created.project.canonicalJobId);
    expect(loadedResponse.json().artifacts).toHaveLength(1);

    const resumedResponse = await restarted.app.inject({
      method: "POST",
      url: `/api/maul/projects/${created.project.id}/resume`,
      payload: {reason: "Continue timeline analysis"}
    });
    expect(resumedResponse.statusCode).toBe(200);
    expect(resumedResponse.json().project.revision).toBe(2);

    const auditResponse = await restarted.app.inject({
      method: "GET",
      url: `/api/maul/projects/${created.project.id}/audit`
    });
    expect(auditResponse.statusCode).toBe(200);
    expect(auditResponse.json().events.map((event: {type: string}) => event.type))
      .toEqual(["project_created", "artifact_registered", "project_resumed"]);

    await restarted.app.close();
  });

  it("rejects orphaned and cross-project artifacts", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const createProject = async (creatorId: string) => {
      const response = await context.app.inject({
        method: "POST",
        url: "/api/maul/projects",
        payload: {
          creatorId,
          goal: "clarity",
          platform: "youtube_shorts",
          sourceProfile: {
            mode: "single_speaker_talking_head",
            principalSpeakerCount: 1,
            primaryLanguage: "en"
          },
          treatmentPreference: "minimal_expert",
          source: {
            originalFilename: `${creatorId}.mp4`,
            storageKey: `uploads/${creatorId}.mp4`,
            mediaType: "video/mp4",
            sha256: "b".repeat(64),
            durationMs: 90000,
            width: 1920,
            height: 1080,
            fps: 30,
            hasAudio: true,
            hasVideo: true
          }
        }
      });
      expect(response.statusCode).toBe(201);
      return response.json();
    };

    const alpha = await createProject("creator_alpha");
    const beta = await createProject("creator_beta");

    const orphanResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${alpha.project.id}/artifacts`,
      payload: {
        artifactType: "analysis",
        parentArtifactIds: ["artifact_missing"],
        payload: {
          sourceAssetId: alpha.sourceAsset.artifactId,
          transcript: {language: "en", text: "A clear hook.", words: []},
          voiceSpans: [],
          silenceSpans: [],
          shots: [],
          speakerTracks: [],
          technicalFacts: {}
        }
      }
    });
    expect(orphanResponse.statusCode).toBe(409);
    expect(orphanResponse.json().error).toContain("parent");

    const crossProjectResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${alpha.project.id}/artifacts`,
      payload: {
        artifactType: "analysis",
        parentArtifactIds: [beta.sourceAsset.artifactId],
        payload: {
          sourceAssetId: alpha.sourceAsset.artifactId,
          transcript: {language: "en", text: "A clear hook.", words: []},
          voiceSpans: [],
          silenceSpans: [],
          shots: [],
          speakerTracks: [],
          technicalFacts: {}
        }
      }
    });
    expect(crossProjectResponse.statusCode).toBe(409);
    expect(crossProjectResponse.json().error).toContain("project");

    await context.app.close();
  });
});
