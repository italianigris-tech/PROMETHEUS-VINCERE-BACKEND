import {describe, expect, it} from "vitest";

import {
  buildSessionSignature,
  createProjectScopedPreviewResetState,
  determineBuildState,
  getPreviewState,
  getRenderState,
  isPreviewReady,
  isRenderReady,
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
  it("uses backend preview text as a renderable fallback while transcript words are still empty", () => {
    const buildState = determineBuildState(
      null,
      buildLiveSessionState(),
      true,
      "building-timeline"
    );

    expect(buildState).toBe("ready");
    expect(shouldBlockInteractivePreview(buildState)).toBe(false);
  });

  it("does not block timeline building when transcript fallback has failed but preview text is ready", () => {
    const buildState = determineBuildState(
      null,
      buildLiveSessionState({
        transcriptStatus: "failed",
        previewStatus: "preview_text_ready",
        previewLines: ["Silence detection found a usable opening beat."]
      }),
      true,
      "building-timeline"
    );

    expect(buildState).toBe("ready");
    expect(shouldBlockInteractivePreview(buildState)).toBe(false);
  });

  it("keeps the preview responsive when the backend session duration is invalid", () => {
    const buildState = determineBuildState(
      null,
      buildLiveSessionState({
        sourceDurationMs: 0,
        transcriptStatus: "full_transcript_ready",
        transcriptWords: [
          {text: "Ready", start_ms: 0, end_ms: 120}
        ]
      }),
      true,
      "building-timeline"
    );

    expect(buildState).toBe("ready");
    expect(shouldBlockInteractivePreview(buildState)).toBe(false);
  });

  it("splits preview readiness from strict render readiness", () => {
    const state = buildLiveSessionState({
      sourceDurationMs: 0,
      sourceFps: null,
      previewDiagnostics: null
    });

    const previewState = getPreviewState({
      liveSessionState: state,
      session: null,
      isArtifactReady: true
    });
    const renderState = getRenderState({
      liveSessionState: state,
      session: null,
      isArtifactReady: true
    });

    expect(previewState.status).toBe("PREVIEW_READY");
    expect(isPreviewReady(previewState)).toBe(true);
    expect(renderState.status).toBe("DEGRADED_RENDER_STATE");
    expect(isRenderReady(renderState)).toBe(false);
    expect(renderState.degradedEvents).toContain("DEGRADED_RENDER_STATE");
    expect(renderState.blockers).toEqual(expect.arrayContaining([
      "invalid_duration",
      "invalid_fps",
      "compiled_typography_missing",
      "font_assets_unhydrated"
    ]));
  });

  it("requires compiled typography and hydrated fonts before final render is ready", () => {
    const state = buildLiveSessionState({
      sourceDurationMs: 12345,
      sourceFps: 24,
      previewDiagnostics: {
        fontProof: {
          fontsRequestedFromManifest: ["Aesthetic"],
          fontFilesResolved: ["/fonts/aesthetic.woff2"],
          fontFilesLoadedIntoComposition: ["/fonts/aesthetic.woff2"],
          fontCssGenerated: true,
          fallbackFontsUsed: [],
          fallbackReasons: []
        },
        features: {
          fonts: {
            activated: true
          }
        }
      }
    });
    const session = {
      captionChunks: [{id: "caption-1"}],
      motionModel: {
        chunks: [{id: "caption-1"}],
        scenes: [{id: "scene-1"}],
        showcaseIntelligencePlan: {missingAssetCategories: []},
        showcasePlan: {cues: []},
        backgroundOverlayPlan: {cues: []},
        transitionOverlayPlan: {cues: []},
        motionGraphicsPlan: {overlays: []}
      }
    } as any;

    const renderState = getRenderState({
      liveSessionState: state,
      session,
      isArtifactReady: true
    });

    expect(renderState.status).toBe("RENDER_READY");
    expect(renderState.durationInFrames).toBe(Math.round((12345 / 1000) * 24));
    expect(isRenderReady(renderState)).toBe(true);
  });

  it("blocks render readiness and asks for music timeline recalculation when corrected duration grows", () => {
    const state = buildLiveSessionState({
      sourceDurationMs: 18000,
      sourceFps: 30,
      previewDiagnostics: {
        fontProof: {
          fontsRequestedFromManifest: ["Aesthetic"],
          fontFilesResolved: ["/fonts/aesthetic.woff2"],
          fontFilesLoadedIntoComposition: ["/fonts/aesthetic.woff2"],
          fontCssGenerated: true,
          fallbackFontsUsed: [],
          fallbackReasons: []
        }
      }
    });
    const session = {
      captionChunks: [{id: "caption-1"}],
      motionModel: {
        chunks: [{id: "caption-1"}],
        scenes: [{id: "scene-1"}],
        showcaseIntelligencePlan: {missingAssetCategories: []}
      }
    } as any;

    const renderState = getRenderState({
      liveSessionState: state,
      session,
      isArtifactReady: true,
      audioManifest: {
        durationMs: 12000,
        musicTimelineDurationMs: 12000
      }
    });

    expect(renderState.status).toBe("DEGRADED_RENDER_STATE");
    expect(renderState.musicTimelineRecalculationRequired).toBe(true);
    expect(renderState.degradedEvents).toContain("MUSIC_TIMELINE_RECALCULATION_REQUIRED");
    expect(isRenderReady(renderState)).toBe(false);
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
