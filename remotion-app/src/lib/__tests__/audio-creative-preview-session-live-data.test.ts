import {describe, expect, it} from "vitest";

import {buildAudioCreativePreviewSession} from "../../web-preview/audio-creative-preview-session";

describe("audio creative preview session from live data", () => {
  it("projects transcript words returned by the live edit session without local creative planning", async () => {
    const session = await buildAudioCreativePreviewSession({
      jobId: "live-audio-session-transcript",
      captionProfileId: "longform_eve_typography_v1",
      motionTier: "premium",
      presentationMode: "long-form",
      allowFallbackDemoData: false,
      transcriptWords: [
        {text: "Build", start_ms: 0, end_ms: 180},
        {text: "systems", start_ms: 180, end_ms: 420},
        {text: "that", start_ms: 420, end_ms: 560},
        {text: "scale", start_ms: 560, end_ms: 860}
      ]
    });

    expect(session.captionChunks.length).toBeGreaterThan(0);
    expect(session.creativeTimeline.moments).toHaveLength(0);
    expect(session.creativeTimeline.tracks).toHaveLength(0);
    expect(session.motionModel.scenes.length).toBeGreaterThan(0);
  }, 15000);

  it("projects early preview cues before the full transcript lands without local creative planning", async () => {
    const session = await buildAudioCreativePreviewSession({
      jobId: "live-audio-session-preview-cues",
      captionProfileId: "longform_eve_typography_v1",
      motionTier: "premium",
      presentationMode: "long-form",
      allowFallbackDemoData: false,
      previewLines: ["Build systems that scale"],
      previewMotionSequence: [
        {
          cueId: "cue-1",
          text: "Build systems that scale",
          startMs: 0,
          durationMs: 900,
          lineIndex: 0
        }
      ]
    });

    expect(session.captionChunks.length).toBeGreaterThan(0);
    expect(session.creativeTimeline.moments).toHaveLength(0);
    expect(session.creativeTimeline.tracks).toHaveLength(0);
    expect(session.motionModel.chunks.length).toBeGreaterThan(0);
  }, 15000);
});
