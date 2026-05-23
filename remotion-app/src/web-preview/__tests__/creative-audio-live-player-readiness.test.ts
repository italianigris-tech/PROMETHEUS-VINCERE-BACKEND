import {describe, expect, it} from "vitest";

import {
  buildSessionSignature,
  createProjectScopedPreviewResetState,
  determineBuildState,
  resolveHasSession,
  shouldRenderBlockingLoader,
  shouldBlockInteractivePreview,
  type LiveEditSessionPublicState
} from "../CreativeAudioLivePlayer";

const buildLiveSessionState = (
  overrides: Partial<LiveEditSessionPublicState> = {}
): LiveEditSessionPublicState => ({
  id: "job-ready-check",
  status: "preview_text_ready",
  captionProfileId: "longform_svg_typography_v1",
  motionTier: "premium",
  previewStatus: "preview_text_ready",
  previewLines: ["Hold the loader until captions arrive."],
  previewMotionSequence: [],
  transcriptStatus: "transcript_started",
  transcriptWords: [],
  analysisStatus: "pending",
  motionGraphicsStatus: "pending",
  renderStatus: "idle",
  errorMessage: null,
  lastEventType: "preview_text_ready",
  sourceFilename: "ready-check.mp4",
  sourceDurationMs: 12000,
  sourceAspectRatio: "16:9",
  sourceWidth: 1920,
  sourceHeight: 1080,
  sourceFps: 30,
  sourceHasVideo: true,
  routes: {
    status: "/api/edit-sessions/job-ready-check/status",
    previewManifest: "/api/edit-sessions/job-ready-check/preview-manifest",
    previewArtifact: "/api/edit-sessions/job-ready-check/preview-artifact",
    preview: "/api/edit-sessions/job-ready-check/preview",
    render: "/api/edit-sessions/job-ready-check/render",
    renderStatus: "/api/edit-sessions/job-ready-check/render-status",
    sourceMedia: "/api/edit-sessions/job-ready-check/source",
    events: "/api/edit-sessions/job-ready-check/events"
  },
  lanes: {
    defaultInteractive: "hyperframes",
    interactive: ["hyperframes", "remotion"],
    export: "remotion"
  },
  sourceMediaUrl: "/api/edit-sessions/job-ready-check/source",
  sourceMediaKind: "session_source_stream",
  sourceLabel: "Ready Check",
  previewArtifactUrl: "/preview-artifacts/job-ready-check.html",
  previewArtifactKind: "html_composition",
  previewArtifactContentType: "text/html; charset=utf-8",
  previewDiagnostics: null,
  ...overrides
});

describe("CreativeAudioLivePlayer readiness", () => {
  it("keeps the preview blocked while transcript words are still empty", () => {
    const buildState = determineBuildState(
      null,
      buildLiveSessionState(),
      true,
      "building-timeline"
    );

    expect(buildState).toBe("building-timeline");
    expect(shouldBlockInteractivePreview(buildState)).toBe(true);
  });

  it("changes the session build signature when transcript words arrive over SSE", () => {
    const stateBeforeTranscript = buildLiveSessionState();
    const stateAfterTranscript = buildLiveSessionState({
      transcriptStatus: "full_transcript_ready",
      transcriptWords: [
        {text: "Ready", start_ms: 0, end_ms: 120},
        {text: "check", start_ms: 120, end_ms: 260}
      ]
    });

    expect(
      buildSessionSignature(stateBeforeTranscript, {
        captionProfileId: "longform_svg_typography_v1",
        motionTier: "premium",
        presentationMode: "long-form"
      })
    ).not.toBe(
      buildSessionSignature(stateAfterTranscript, {
        captionProfileId: "longform_svg_typography_v1",
        motionTier: "premium",
        presentationMode: "long-form"
      })
    );
  });

  it("resets artifact readiness with the project-scoped preview state", () => {
    expect(createProjectScopedPreviewResetState().isArtifactReady).toBe(false);
  });

  it("derives session attachment from the live backend session id", () => {
    expect(resolveHasSession("job-ready-check")).toBe(true);
    expect(resolveHasSession("")).toBe(false);
    expect(resolveHasSession(null)).toBe(false);
  });

  it("does not block the html artifact stage behind the global loading shell", () => {
    expect(shouldRenderBlockingLoader("building-timeline", "artifact")).toBe(false);
    expect(shouldRenderBlockingLoader("building-timeline", "native-stage")).toBe(true);
  });
});
