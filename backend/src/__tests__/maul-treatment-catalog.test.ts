import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

const projectPayload = {
  creatorId: "creator_treatments",
  goal: "conversion",
  platform: "youtube_shorts",
  sourceProfile: {
    mode: "single_speaker_talking_head",
    principalSpeakerCount: 1,
    primaryLanguage: "en"
  },
  treatmentPreference: "minimal_expert",
  source: {
    originalFilename: "treatment-source.mp4",
    storageKey: "uploads/treatment-source.mp4",
    mediaType: "video/mp4",
    sha256: "e".repeat(64),
    durationMs: 60000,
    width: 1920,
    height: 1080,
    fps: 30,
    hasAudio: true,
    hasVideo: true
  }
};

const timelineRequest = {
  transcript: {
    language: "en",
    text: "Here is the claim. Here is the proof. Now use it.",
    words: [
      {text: "Here", startMs: 0, endMs: 300, confidence: 0.99},
      {text: "is", startMs: 320, endMs: 450, confidence: 0.99},
      {text: "the", startMs: 470, endMs: 600, confidence: 0.99},
      {text: "claim.", startMs: 620, endMs: 1100, confidence: 0.99},
      {text: "Here", startMs: 1500, endMs: 1800, confidence: 0.99},
      {text: "is", startMs: 1820, endMs: 1950, confidence: 0.99},
      {text: "the", startMs: 1970, endMs: 2100, confidence: 0.99},
      {text: "proof.", startMs: 2120, endMs: 2700, confidence: 0.99},
      {text: "Now", startMs: 3100, endMs: 3400, confidence: 0.99},
      {text: "use", startMs: 3420, endMs: 3700, confidence: 0.99},
      {text: "it.", startMs: 3720, endMs: 4000, confidence: 0.99}
    ]
  },
  selectedWindow: {sourceStartMs: 0, sourceEndMs: 4000},
  vadEvidence: {
    kind: "detected_spans",
    provider: "manual_verified_vad",
    silenceSpans: [
      {sourceStartMs: 1100, sourceEndMs: 1500, confidence: 1},
      {sourceStartMs: 2700, sourceEndMs: 3100, confidence: 1}
    ]
  },
  speakerDetections: [],
  shots: []
};

describe("MAUL Treatment Catalog and Judgment Layer", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("publishes exactly three complete, distinct, governed policy records", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const response = await context.app.inject({method: "GET", url: "/api/maul/treatment-catalog"});

    expect(response.statusCode).toBe(200);
    const catalog = response.json().treatments;
    expect(catalog.map((entry: any) => entry.treatmentId)).toEqual([
      "founder_podcast",
      "premium_direct_response",
      "minimal_expert"
    ]);
    expect(new Set(catalog.map((entry: any) => entry.rendererInputs.caption.profile)).size).toBe(3);
    expect(new Set(catalog.map((entry: any) => entry.rendererInputs.motion.intensity)).size).toBe(3);
    for (const entry of catalog) {
      expect(entry.grammar).toEqual(expect.objectContaining({
        hook: expect.any(String),
        escalation: expect.any(String),
        proof: expect.any(String),
        reveal: expect.any(String),
        payoff: expect.any(String),
        cta: expect.any(String)
      }));
      expect(entry.judgmentLayer.rubric.length).toBeGreaterThanOrEqual(5);
      expect(entry.judgmentLayer.failureClasses.length).toBeGreaterThanOrEqual(5);
      expect(entry.renderFallbacks.length).toBeGreaterThan(0);
      expect(entry.provenanceRules.length).toBeGreaterThan(0);
    }

    await context.app.close();
  });

  it("materializes replayable treatment genomes from the same authoritative timeline", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const projectResponse = await context.app.inject({
      method: "POST",
      url: "/api/maul/projects",
      payload: projectPayload
    });
    const project = projectResponse.json().project;
    const timelineResponse = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/editorial-timeline`,
      payload: timelineRequest
    });
    const timeline = timelineResponse.json().timeline;

    const first = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/treatments`,
      payload: {timelineArtifactId: timeline.artifactId, referenceCorpusArtifactIds: []}
    });
    expect(first.statusCode).toBe(201);
    const treatments = first.json().treatments;
    expect(treatments).toHaveLength(3);
    expect(new Set(treatments.map((entry: any) => entry.payload.replayKey)).size).toBe(3);
    for (const artifact of treatments) {
      expect(artifact.lineage.parentArtifactIds).toEqual([timeline.artifactId]);
      expect(artifact.payload.timelineArtifactId).toBe(timeline.artifactId);
      expect(artifact.payload.replayKey).toMatch(/^[a-f0-9]{64}$/);
    }

    const replay = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/treatments`,
      payload: {timelineArtifactId: timeline.artifactId, referenceCorpusArtifactIds: []}
    });
    expect(replay.statusCode).toBe(201);
    expect(replay.json().treatments.map((entry: any) => entry.payload.replayKey)).toEqual(
      treatments.map((entry: any) => entry.payload.replayKey)
    );

    await context.app.close();
  });
});
