import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

const timelineRequest = {
  transcript: {
    language: "en",
    text: "Most creators stall. The fix is the opposite. Protect the payoff.",
    words: [
      {text: "Most", startMs: 0, endMs: 250, confidence: 0.99},
      {text: "creators", startMs: 270, endMs: 650, confidence: 0.99},
      {text: "stall.", startMs: 670, endMs: 1000, confidence: 0.99},
      {text: "The", startMs: 1400, endMs: 1600, confidence: 0.99},
      {text: "fix", startMs: 1620, endMs: 1850, confidence: 0.99},
      {text: "is", startMs: 1870, endMs: 2000, confidence: 0.99},
      {text: "the", startMs: 2020, endMs: 2150, confidence: 0.99},
      {text: "opposite.", startMs: 2170, endMs: 2700, confidence: 0.99},
      {text: "Protect", startMs: 3100, endMs: 3450, confidence: 0.99},
      {text: "the", startMs: 3470, endMs: 3600, confidence: 0.99},
      {text: "payoff.", startMs: 3620, endMs: 4000, confidence: 0.99}
    ]
  },
  selectedWindow: {sourceStartMs: 0, sourceEndMs: 4000},
  vadEvidence: {
    kind: "detected_spans",
    provider: "manual_verified_vad",
    silenceSpans: [
      {sourceStartMs: 1000, sourceEndMs: 1400, confidence: 1},
      {sourceStartMs: 2700, sourceEndMs: 3100, confidence: 1}
    ]
  },
  speakerDetections: [
    {speakerId: "speaker_primary", sourceMs: 500, x: 0.48, y: 0.1, width: 0.24, height: 0.78, confidence: 0.9},
    {speakerId: "speaker_primary", sourceMs: 2350, x: 0.5, y: 0.08, width: 0.25, height: 0.8, confidence: 0.99}
  ],
  shots: [{shotId: "shot_1", sourceStartMs: 0, sourceEndMs: 4000, confidence: 0.99}]
};

describe("MAUL Thumbnail Direction", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("creates, scores, reviews, and downloads source-grounded Nano Banana candidates", async () => {
    const generated = [Buffer.from("thumbnail-a"), Buffer.from("thumbnail-b"), Buffer.from("thumbnail-c")];
    const thumbnailGenerator = vi.fn(async (input: any) => ({
      bytes: generated[input.variationIndex],
      mediaType: "image/png",
      provider: "nano_banana",
      model: "gemini-3.1-flash-image",
      generationId: `nano-${input.variationIndex}`
    }));
    const context = await createTestApp({
      storageDir: tempDir,
      deps: {maulThumbnailGenerator: thumbnailGenerator} as any
    });
    const projectResponse = await context.app.inject({
      method: "POST",
      url: "/api/maul/projects",
      payload: {
        creatorId: "creator_thumbnail",
        goal: "retention",
        platform: "youtube_shorts",
        sourceProfile: {
          mode: "single_speaker_talking_head",
          principalSpeakerCount: 1,
          primaryLanguage: "en"
        },
        treatmentPreference: "founder_podcast",
        requestedShortCount: 1,
        requestedThumbnailCount: 3,
        targetDurationMs: {min: 3000, max: 5000},
        source: {
          originalFilename: "thumb-source.mp4",
          storageKey: "C:/fixtures/thumb-source.mp4",
          mediaType: "video/mp4",
          sha256: "f".repeat(64),
          durationMs: 60000,
          width: 1920,
          height: 1080,
          fps: 30,
          hasAudio: true,
          hasVideo: true
        }
      }
    });
    const project = projectResponse.json().project;
    const timelineResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/editorial-timeline`,
      payload: timelineRequest
    });
    const timeline = timelineResponse.json().timeline;
    const treatmentsResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/treatments`,
      payload: {timelineArtifactId: timeline.artifactId}
    });
    const treatment = treatmentsResponse.json().treatments[0];
    const candidatesResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/candidates`,
      payload: {timelineArtifactId: timeline.artifactId}
    });
    const candidate = candidatesResponse.json().candidates[0];    const planningResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/planning-bundles`,
      payload: {
        candidateArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId
      }
    });
    expect(planningResponse.statusCode, planningResponse.body).toBe(201);
    const planningBundle = planningResponse.json().planningBundle;
    const reviewResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/reviews`,
      payload: {
        candidateArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
        planningBundleArtifactId: planningBundle.artifactId,
        reviewerId: "reviewer_thumb",
        decision: "approved",
        failureClasses: [],
        rationale: "Ready for thumbnail direction.",
        rubricScores: {editorial_clarity: 100, source_fidelity: 100, pacing_fit: 100, visual_hierarchy: 100, accessibility: 100}
      }
    });
    const review = reviewResponse.json().review;
    const exportResponse = await context.maulProjects.registerArtifact(project.id, {
      artifactType: "export_artifact",
      parentArtifactIds: [project.rootSourceAssetId, candidate.artifactId, timeline.artifactId, treatment.artifactId, review.artifactId],
      payload: {
        sourceAssetId: project.rootSourceAssetId,
        candidateArtifactId: candidate.artifactId,
        timelineArtifactId: timeline.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
        reviewDecisionArtifactId: review.artifactId,
        storageKey: "external://approved-short.mp4",
        mediaType: "video/mp4",
        sha256: "a".repeat(64),
        durationMs: 4000,
        width: 1080,
        height: 1920,
        evidence: {
          technicalValidationPassed: true,
          rightsVerified: true,
          deterministicReplayKey: "render-key",
          preRenderReviewPassed: true,
          qualityGate: {
            status: "passed",
            releaseEligible: true,
            implementationLabel: "human-approved",
            renderedEvidenceArtifactId: review.artifactId,
            postRenderHumanApprovalArtifactId: review.artifactId,
            hardFailures: []
          },
          warnings: []
        }
      }
    });
    const exported = exportResponse.artifact;

    const response = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/thumbnails`,
      payload: {
        exportArtifactId: exported.artifactId,
        brandKit: {
          kind: "supplied",
          name: "Founder Kit",
          primaryColor: "#102a43",
          accentColor: "#f6c453",
          fontFamily: "Inter",
          logoAssetId: null
        },
        requestedCount: 3
      }
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.direction.payload.speakerFrame).toEqual(expect.objectContaining({
      sourceMs: 2350,
      speakerId: "speaker_primary",
      confidence: 0.99
    }));
    expect(body.direction.payload.copyOptions).toHaveLength(3);
    expect(body.direction.payload.copyOptions.every((copy: any) => copy.sourceGrounded)).toBe(true);
    expect(body.candidates).toHaveLength(3);
    expect(body.candidates.map((item: any) => item.payload.score.overall)).toEqual(
      [...body.candidates.map((item: any) => item.payload.score.overall)].sort((a: number, b: number) => b - a)
    );
    expect(body.candidates.every((item: any) => item.payload.provider === "nano_banana")).toBe(true);
    expect(thumbnailGenerator).toHaveBeenCalledTimes(3);

    const selected = body.candidates[0];
    const approval = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/thumbnails/${selected.artifactId}/review`,
      payload: {reviewerId: "reviewer_thumb", decision: "approved", rationale: "Legible and faithful."}
    });
    expect(approval.statusCode).toBe(201);
    expect(approval.json().review.payload.decision).toBe("approved");

    const download = await context.app.inject({
      method: "GET",
      url: `/api/maul/projects/${project.id}/thumbnails/${selected.artifactId}/file`
    });
    expect(download.statusCode).toBe(200);
    expect(download.headers["content-type"]).toContain("image/png");
    expect(generated).toContainEqual(download.rawPayload);

    await context.app.close();
  });
});
