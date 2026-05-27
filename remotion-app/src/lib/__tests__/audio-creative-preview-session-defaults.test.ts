import {describe, expect, it} from "vitest";

import {buildAudioCreativePreviewSession} from "../../web-preview/audio-creative-preview-session";

describe("audio creative preview session defaults", () => {
  it("defaults to projection-only preview data instead of local creative planning", async () => {
    const session = await buildAudioCreativePreviewSession({
      jobId: "job-audio-preview-defaults",
      captionProfileId: "longform_eve_typography_v1",
      motionTier: "premium",
      presentationMode: "long-form"
    });

    expect(session.captionChunks.length).toBeGreaterThan(0);
    expect(session.motionModel.scenes.length).toBeGreaterThan(0);
    expect(session.creativeTimeline.moments).toHaveLength(0);
    expect(session.creativeTimeline.tracks).toHaveLength(0);
    expect(session.debugReport.finalCreativeTimeline.tracks).toHaveLength(0);
  }, 30000);

  it("preserves the source duration when the footage is ready before overlay cues land", async () => {
    const session = await buildAudioCreativePreviewSession({
      jobId: "job-video-preview-empty-overlay",
      captionProfileId: "longform_svg_typography_v1",
      motionTier: "premium",
      presentationMode: "long-form",
      baseVideoMetadata: {
        width: 1920,
        height: 1080,
        fps: 24,
        durationSeconds: 12,
        durationInFrames: 288
      },
      transcriptWords: [],
      previewLines: [],
      previewMotionSequence: [],
      allowFallbackDemoData: false,
      featureFlags: {creativeOrchestrationV1: true}
    });

    expect(session.captionChunks).toHaveLength(0);
    expect(session.motionModel.scenes).toHaveLength(0);
    expect(session.durationMs).toBe(12000);
    expect(session.videoMetadata.durationSeconds).toBe(12);
    expect(session.videoMetadata.durationInFrames).toBe(288);
  });
});
