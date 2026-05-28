import {describe, expect, it} from "vitest";

import {
  buildAudioCreativePreviewSession,
  buildFastAudioCreativePreviewSession,
  isLiveAudioPreviewLane,
  resolveCreativePreviewRenderMode,
  resolveAudioCreativePreviewDurationMs,
  resolveAudioCreativePreviewState,
  resolveAudioCreativePreviewVideoMetadata
} from "../audio-creative-preview-session";

describe("audio creative preview session", () => {
  it("keeps the audio lane on the live browser clock path instead of the backend render path", () => {
    expect(isLiveAudioPreviewLane("speed-draft")).toBe(true);
    expect(isLiveAudioPreviewLane("master-render")).toBe(false);
  });

  it("resolves duration from timeline, captions, and fallback values without waiting on an export", () => {
    expect(resolveAudioCreativePreviewDurationMs({
      providedDurationMs: 42000,
      creativeTimelineDurationMs: 18000,
      lastTrackEndMs: 16000,
      lastCaptionEndMs: 14000
    })).toBe(42000);
    expect(resolveAudioCreativePreviewDurationMs({
      creativeTimelineDurationMs: 18000,
      lastTrackEndMs: 16000,
      lastCaptionEndMs: 14000
    })).toBe(18000);
    expect(resolveAudioCreativePreviewDurationMs({
      lastTrackEndMs: 16000,
      lastCaptionEndMs: 14000
    })).toBe(16000);
    expect(resolveAudioCreativePreviewDurationMs({
      lastCaptionEndMs: 14000
    })).toBe(14000);
    expect(resolveAudioCreativePreviewDurationMs({
      providedDurationMs: 0,
      creativeTimelineDurationMs: 0,
      lastCaptionEndMs: 14000
    })).toBe(14000);
    expect(resolveAudioCreativePreviewDurationMs({})).toBe(30000);
  });

  it("keeps preview state simple so audio loading does not become a blocking render state", () => {
    expect(resolveAudioCreativePreviewState({
      buildState: "building-timeline",
      isPlayerPlaying: false
    })).toBe("building-timeline");
    expect(resolveAudioCreativePreviewState({
      buildState: "ready",
      isPlayerPlaying: false
    })).toBe("ready");
    expect(resolveAudioCreativePreviewState({
      buildState: "ready",
      isPlayerPlaying: true
    })).toBe("playing");
    expect(resolveAudioCreativePreviewState({
      buildState: "error",
      isPlayerPlaying: false
    })).toBe("error");
  });

  it("derives a preview metadata duration from the live timeline instead of a source video export", () => {
    const metadata = resolveAudioCreativePreviewVideoMetadata({
      presentationMode: "long-form",
      durationMs: 12345
    });

    expect(metadata.durationSeconds).toBeCloseTo(12.345);
    expect(metadata.durationInFrames).toBe(Math.round(12.345 * metadata.fps));
  });

  it("promotes video-backed live previews onto the overlay compositor render mode", () => {
    expect(resolveCreativePreviewRenderMode({
      baseVideoMetadata: {
        width: 1920,
        height: 1080
      }
    })).toBe("overlay-preview");

    expect(resolveCreativePreviewRenderMode({})).toBe("audio-preview");
  });

  it("builds a lite live audio preview session without needing a source video", async () => {
    const session = await buildFastAudioCreativePreviewSession({
      jobId: "job-audio-preview",
      captionProfileId: "longform_svg_typography_v1",
      motionTier: "premium",
      presentationMode: "long-form"
    });

    expect(session.captionChunks.length).toBeGreaterThan(0);
    expect(session.creativeTimeline.durationMs).toBeGreaterThan(0);
    expect(session.creativeTimeline.tracks).toHaveLength(0);
    expect(session.videoMetadata.durationSeconds).toBeCloseTo(session.durationMs / 1000);
    expect(session.renderMode).toBe("audio-preview");
  }, 20000);

  it("uses the source video metadata when the live preview has a real footage layer", async () => {
    const session = await buildAudioCreativePreviewSession({
      jobId: "job-video-preview",
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
      featureFlags: {creativeOrchestrationV1: false}
    });

    expect(session.videoMetadata.width).toBe(1920);
    expect(session.videoMetadata.height).toBe(1080);
    expect(session.videoMetadata.fps).toBe(24);
    expect(session.renderMode).toBe("overlay-preview");
  });

  it("preserves source duration when the footage is ready before overlay cues land", async () => {
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
      featureFlags: {creativeOrchestrationV1: false}
    });

    expect(session.captionChunks).toHaveLength(0);
    expect(session.motionModel.scenes).toHaveLength(0);
    expect(session.durationMs).toBe(12000);
    expect(session.videoMetadata.durationSeconds).toBe(12);
    expect(session.videoMetadata.durationInFrames).toBe(288);
  });
});
