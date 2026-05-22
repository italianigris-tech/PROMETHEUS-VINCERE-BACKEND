import path from "node:path";
import {readFileSync} from "node:fs";

import {describe, expect, it} from "vitest";

import {
  buildBackendPreviewPlan,
  buildPreviewManifestFromSessionState,
  buildProjectScopedLivePreviewSessionData,
  createProjectScopedPreviewResetState,
  resolveLivePreviewSessionEndpoints,
  type LiveEditSessionPublicState
} from "../CreativeAudioLivePlayer";

const liveSessionState: LiveEditSessionPublicState = {
  id: "project-a",
  status: "preview_text_ready",
  captionProfileId: "longform_svg_typography_v1",
  motionTier: "premium",
  previewStatus: "preview_text_ready",
  previewLines: ["Project A live preview"],
  previewMotionSequence: [
    {
      cueId: "cue-project-a-1",
      text: "Project A live preview",
      startMs: 0,
      durationMs: 900,
      lineIndex: 0
    }
  ],
  transcriptStatus: "full_transcript_ready",
  transcriptWords: [
    {text: "Project", start_ms: 0, end_ms: 160},
    {text: "A", start_ms: 160, end_ms: 260}
  ],
  analysisStatus: "analysis_ready",
  motionGraphicsStatus: "motion_graphics_ready",
  renderStatus: "idle",
  errorMessage: null,
  lastEventType: "preview_text_ready",
  sourceFilename: "project-a.mp4",
  sourceDurationMs: 12000,
  sourceAspectRatio: "16:9",
  sourceWidth: 1920,
  sourceHeight: 1080,
  sourceFps: 30,
  sourceHasVideo: true,
  routes: {
    status: "/api/edit-sessions/project-a/status",
    previewManifest: "/api/edit-sessions/project-a/preview-manifest",
    previewArtifact: "/api/edit-sessions/project-a/preview-artifact",
    preview: "/api/edit-sessions/project-a/preview",
    render: "/api/edit-sessions/project-a/render",
    renderStatus: "/api/edit-sessions/project-a/render-status",
    sourceMedia: "/api/edit-sessions/project-a/source",
    events: "/api/edit-sessions/project-a/events"
  },
  lanes: {
    defaultInteractive: "hyperframes",
    interactive: ["hyperframes"],
    export: "remotion"
  },
  sourceMediaUrl: "/api/edit-sessions/project-a/source",
  sourceMediaKind: "session_source_stream",
  sourceLabel: "Project A",
  previewArtifactUrl: "/preview-artifacts/project-a.html",
  previewArtifactKind: "html_composition",
  previewArtifactContentType: "text/html; charset=utf-8",
  previewDiagnostics: {
    sessionId: "project-a"
  }
};

describe("CreativeAudioLivePlayer project scope", () => {
  it("derives project-scoped preview outputs from the active session only", () => {
    const manifest = buildPreviewManifestFromSessionState(liveSessionState, "http://127.0.0.1:8000");
    const backendPreviewPlan = buildBackendPreviewPlan(liveSessionState);

    expect(manifest?.sessionId).toBe("project-a");
    expect(manifest?.baseVideo.src).toBe("http://127.0.0.1:8000/api/edit-sessions/project-a/source");
    expect(backendPreviewPlan?.previewLines).toEqual(["Project A live preview"]);
  });

  it("consumes the returned live session routes for status and events", () => {
    expect(resolveLivePreviewSessionEndpoints({
      apiBase: "http://127.0.0.1:8000",
      payload: liveSessionState
    })).toEqual({
      sessionId: "project-a",
      statusUrl: "http://127.0.0.1:8000/api/edit-sessions/project-a/status",
      eventsUrl: "http://127.0.0.1:8000/api/edit-sessions/project-a/events"
    });
  });

  it("maps live backend preview state into canonical project-scoped composition props", () => {
    expect(buildProjectScopedLivePreviewSessionData(liveSessionState)).toEqual({
      sessionId: "project-a",
      status: "preview_text_ready",
      previewStatus: "preview_text_ready",
      transcriptStatus: "full_transcript_ready",
      analysisStatus: "analysis_ready",
      motionGraphicsStatus: "motion_graphics_ready",
      renderStatus: "idle",
      sourceLabel: "Project A",
      sourceFilename: "project-a.mp4",
      sourceHasVideo: true,
      sourceWidth: 1920,
      sourceHeight: 1080,
      sourceFps: 30,
      sourceDurationMs: 12000,
      previewLines: ["Project A live preview"],
      previewMotionSequence: [
        {
          cueId: "cue-project-a-1",
          text: "Project A live preview",
          startMs: 0,
          durationMs: 900,
          lineIndex: 0
        }
      ],
      transcriptWords: [
        {text: "Project", start_ms: 0, end_ms: 160},
        {text: "A", start_ms: 160, end_ms: 260}
      ]
    });
  });

  it("clears stale manifest and backend-plan state on project switch reset", () => {
    const resetState = createProjectScopedPreviewResetState();

    expect(resetState.session).toBeNull();
    expect(resetState.liveSessionState).toBeNull();
    expect(resetState.buildState).toBe("building-timeline");
    expect(resetState.buildError).toBeNull();
    expect(resetState.sessionBuildSignature).toBe("");
    expect(buildPreviewManifestFromSessionState(resetState.liveSessionState, "http://127.0.0.1:8000")).toBeNull();
  });

  it("keeps the active edit-session preview path isolated from local-preview draft scripts", () => {
    const sourcePath = path.resolve("src/web-preview/CreativeAudioLivePlayer.tsx");
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toContain("draft-preview-longform");
    expect(source).toContain("api/edit-sessions/live-preview");
  });

  it("passes live caption chunks into the canonical project-scoped Remotion player", () => {
    const sourcePath = path.resolve("src/web-preview/CreativeAudioLivePlayer.tsx");
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("captionChunks={session?.captionChunks ?? []}");
    expect(source).toContain("livePreviewSession={livePreviewSessionData}");
  });

  it("keeps the sidebar stack above the preview player containment layer", () => {
    const sourcePath = path.resolve("src/web-preview/preview.css");
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain(".quick-sidebar");
    expect(source).toContain("z-index: 4;");
    expect(source).toContain("contain: layout paint;");
  });
});
