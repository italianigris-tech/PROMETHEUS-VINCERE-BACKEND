import {describe, expect, it, vi} from "vitest";

const buildCreativeOrchestrationPlan = vi.fn(async () => {
  throw new Error("Browser orchestration should not run when a backend preview plan already exists.");
});

vi.mock("../../creative-orchestration", () => ({
  buildCreativeOrchestrationPlan
}));

import {buildAudioCreativePreviewSession} from "../audio-creative-preview-session";

describe("audio creative preview session backend plan", () => {
  it("renders from a backend preview plan without invoking browser orchestration", async () => {
    const session = await buildAudioCreativePreviewSession({
      jobId: "backend-plan-session",
      captionProfileId: "longform_svg_typography_v1",
      motionTier: "premium",
      presentationMode: "long-form",
      baseVideoMetadata: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationSeconds: 9,
        durationInFrames: 270
      },
      allowFallbackDemoData: false,
      backendPreviewPlan: {
        previewLines: ["Backend owned this preview state"],
        previewMotionSequence: [
          {
            cueId: "cue-backend-1",
            text: "Backend owned this preview state",
            startMs: 0,
            durationMs: 900,
            lineIndex: 0
          }
        ],
        transcriptWords: [
          {text: "Backend", start_ms: 0, end_ms: 160},
          {text: "owned", start_ms: 160, end_ms: 320},
          {text: "this", start_ms: 320, end_ms: 460},
          {text: "preview", start_ms: 460, end_ms: 720},
          {text: "state", start_ms: 720, end_ms: 940}
        ]
      }
    });

    expect(buildCreativeOrchestrationPlan).not.toHaveBeenCalled();
    expect(session.captionChunks.length).toBeGreaterThan(0);
    expect(session.motionModel.chunks.length).toBeGreaterThan(0);
    expect(session.creativeTimeline.tracks).toHaveLength(0);
    expect(session.renderMode).toBe("overlay-preview");
  }, 20000);

  it("uses projection-only deterministic captions when no backend preview plan exists", async () => {
    const session = await buildAudioCreativePreviewSession({
      jobId: "projection-only-session",
      captionProfileId: "longform_svg_typography_v1",
      motionTier: "premium",
      presentationMode: "long-form",
      baseVideoMetadata: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationSeconds: 9,
        durationInFrames: 270
      },
      transcriptWords: [
        {text: "Projection", start_ms: 0, end_ms: 180},
        {text: "only", start_ms: 180, end_ms: 320},
        {text: "preview", start_ms: 320, end_ms: 580}
      ],
      allowFallbackDemoData: false
    });

    expect(buildCreativeOrchestrationPlan).not.toHaveBeenCalled();
    expect(session.captionChunks.length).toBeGreaterThan(0);
    expect(session.creativeTimeline.tracks).toHaveLength(0);
    expect(session.renderMode).toBe("overlay-preview");
  }, 20000);
});
