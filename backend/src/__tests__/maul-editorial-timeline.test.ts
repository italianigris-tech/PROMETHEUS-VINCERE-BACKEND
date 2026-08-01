import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

const projectPayload = {
  creatorId: "creator_timeline",
  goal: "clarity",
  platform: "youtube_shorts",
  sourceProfile: {
    mode: "single_speaker_talking_head",
    principalSpeakerCount: 1,
    primaryLanguage: "en"
  },
  treatmentPreference: "minimal_expert",
  source: {
    originalFilename: "timeline-source.mp4",
    storageKey: "uploads/timeline-source.mp4",
    mediaType: "video/mp4",
    sha256: "d".repeat(64),
    durationMs: 120000,
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
    text: "Most creators stall. The fix is basically the opposite. Protect the payoff.",
    words: [
      {text: "Most", startMs: 0, endMs: 350, confidence: 0.99},
      {text: "creators", startMs: 400, endMs: 900, confidence: 0.99},
      {text: "stall.", startMs: 950, endMs: 1500, confidence: 0.99},
      {text: "The", startMs: 2200, endMs: 2500, confidence: 0.99},
      {text: "fix", startMs: 2550, endMs: 2850, confidence: 0.99},
      {text: "is", startMs: 2900, endMs: 3100, confidence: 0.99},
      {text: "basically", startMs: 3150, endMs: 4200, confidence: 0.99},
      {text: "the", startMs: 5500, endMs: 5750, confidence: 0.99},
      {text: "opposite.", startMs: 5800, endMs: 6400, confidence: 0.99},
      {text: "Protect", startMs: 6500, endMs: 6900, confidence: 0.99},
      {text: "the", startMs: 6950, endMs: 7150, confidence: 0.99},
      {text: "payoff.", startMs: 7200, endMs: 7900, confidence: 0.99}
    ]
  },
  selectedWindow: {sourceStartMs: 0, sourceEndMs: 8000},
  vadEvidence: {
    kind: "detected_spans",
    provider: "webrtc_vad",
    silenceSpans: [
      {sourceStartMs: 1500, sourceEndMs: 2200, confidence: 0.98},
      {sourceStartMs: 4200, sourceEndMs: 5500, confidence: 0.99}
    ]
  },
  speakerDetections: [
    {
      speakerId: "speaker_primary",
      sourceMs: 0,
      x: 0.54,
      y: 0.12,
      width: 0.22,
      height: 0.72,
      confidence: 0.96
    },
    {
      speakerId: "speaker_primary",
      sourceMs: 7900,
      x: 0.56,
      y: 0.1,
      width: 0.22,
      height: 0.74,
      confidence: 0.97
    }
  ],
  shots: [
    {shotId: "shot_1", sourceStartMs: 0, sourceEndMs: 8000, confidence: 0.99}
  ]
};

describe("MAUL Media Analysis and Editorial Timeline", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("parses concrete FFmpeg silence evidence including a trailing silence", async () => {
    const module = await import("../maul/editorial-timeline").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) {
      return;
    }
    const spans = module.parseFfmpegSilenceDetect(
      [
        "[silencedetect] silence_start: 1.5",
        "[silencedetect] silence_end: 2.2 | silence_duration: 0.7",
        "[silencedetect] silence_start: 4.2",
        "[silencedetect] silence_end: 5.5 | silence_duration: 1.3",
        "[silencedetect] silence_start: 7.75"
      ].join("\n"),
      8000
    );

    expect(spans).toEqual([
      {sourceStartMs: 1500, sourceEndMs: 2200, confidence: 1},
      {sourceStartMs: 4200, sourceEndMs: 5500, confidence: 1},
      {sourceStartMs: 7750, sourceEndMs: 8000, confidence: 1}
    ]);
  });

  it("refuses to manufacture silence spans from transcript gaps", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const projectResponse = await context.app.inject({
      method: "POST",
      url: "/api/maul/projects",
      payload: projectPayload
    });
    const project = projectResponse.json().project;

    const response = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${project.id}/editorial-timeline`,
      payload: {
        ...timelineRequest,
        vadEvidence: undefined
      }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("VAD");

    await context.app.close();
  });

  it("produces explainable cuts, a protected pause, mapping, and speaker crop track", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const projectResponse = await context.app.inject({
      method: "POST",
      url: "/api/maul/projects",
      payload: projectPayload
    });
    const created = projectResponse.json();

    const response = await context.app.inject({
      method: "POST",
      url: `/api/maul/projects/${created.project.id}/editorial-timeline`,
      payload: timelineRequest
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.analysis.artifactType).toBe("analysis");
    expect(body.analysis.payload.silenceSpans).toEqual([
      expect.objectContaining({
        sourceStartMs: 1500,
        sourceEndMs: 2200,
        verified: true,
        detectionSource: "webrtc_vad"
      }),
      expect.objectContaining({
        sourceStartMs: 4200,
        sourceEndMs: 5500,
        verified: true,
        detectionSource: "webrtc_vad"
      })
    ]);

    const timeline = body.timeline.payload;
    expect(timeline.protectedRanges).toEqual([
      expect.objectContaining({
        sourceStartMs: 1500,
        sourceEndMs: 2200,
        kind: "rhetorical_pause"
      })
    ]);
    expect(timeline.cutCandidates).toEqual([
      expect.objectContaining({
        sourceStartMs: 4200,
        sourceEndMs: 5500,
        sentenceSafe: true
      })
    ]);
    expect(timeline.timestampMap).toEqual([
      {sourceStartMs: 0, sourceEndMs: 1500, outputStartMs: 0, outputEndMs: 1500, mode: "keep"},
      {sourceStartMs: 1500, sourceEndMs: 2200, outputStartMs: 1500, outputEndMs: 2200, mode: "protected_pause"},
      {sourceStartMs: 2200, sourceEndMs: 4200, outputStartMs: 2200, outputEndMs: 4200, mode: "keep"},
      {sourceStartMs: 4200, sourceEndMs: 5500, outputStartMs: 4200, outputEndMs: 4200, mode: "cut"},
      {sourceStartMs: 5500, sourceEndMs: 8000, outputStartMs: 4200, outputEndMs: 6700, mode: "keep"}
    ]);
    expect(timeline.outputDurationMs).toBe(6700);
    expect(timeline.speakerCropTracks[0]).toEqual(expect.objectContaining({
      speakerId: "speaker_primary",
      outputStartMs: 0,
      outputEndMs: 6700
    }));
    expect(timeline.editRationale.join(" ")).toContain("dead air");

    const {buildMaulEditorialFfmpegArgs} = await import("../maul/editorial-timeline");
    const args = buildMaulEditorialFfmpegArgs(
      "source.mp4",
      "derived.mp4",
      timeline.timestampMap
    );
    expect(args.join(" ")).toContain("trim=start=0:end=1.5");
    expect(args.join(" ")).toContain("trim=start=5.5:end=8");
    expect(args.join(" ")).not.toContain("start=4.2:end=5.5");

    await context.app.close();
  });
});
