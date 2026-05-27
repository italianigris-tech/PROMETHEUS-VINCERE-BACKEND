import React, {useEffect, useMemo, useRef, useState} from "react";

import {CreativeLiveAudioPreview} from "./CreativeLiveAudioPreview";
import {DisplayGodPreviewStage} from "./DisplayGodPreviewStage";
import {NativePreviewStage} from "./NativePreviewStage";
import type {PreviewPlaybackHealth} from "./preview-telemetry";
import {RemotionPreviewPlayer} from "./RemotionPreviewPlayer";
import type {ProjectScopedLivePreviewSessionData} from "../compositions/ProjectScopedMotionComposition";
import {buildMotionCompositionModel} from "../lib/motion-platform/scene-engine";
import type {
  CaptionStyleProfileId,
  MotionTier,
  PresentationModeSetting,
  VideoMetadata
} from "../lib/types";
import {
  type BackendPreviewPlan,
  buildAudioCreativePreviewSession,
  type AudioCreativePreviewAudioStatus,
  type AudioCreativePreviewSession,
  type AudioCreativePreviewState,
  type LivePreviewBackendWord,
  type LivePreviewMotionCue,
  resolveAudioCreativePreviewVideoMetadata
} from "./audio-creative-preview-session";
import {buildDisplayTimelineFromPreviewSession} from "./display-god/display-timeline";
import {
  hyperframesPreviewManifestSchema,
  type HyperframesPreviewManifest
} from "./hyperframes/manifest-schema";
import {
  isLikelyVideoFileLike,
  planAudioPreviewSource,
  resolveAudioPreviewUrl,
  resolveEditSessionSourceUrl
} from "./audio-preview-source";

export type CreativeAudioLivePlayerProps = {
  readonly jobId: string;
  readonly captionProfileId: CaptionStyleProfileId;
  readonly motionTier: MotionTier | "auto";
  readonly presentationMode?: PresentationModeSetting | null;
  readonly apiBase?: string;
  readonly sourceFile?: File | null;
  readonly sourcePath?: string | null;
  readonly sourceMediaSrc?: string | null;
  readonly sourceLabel?: string | null;
  readonly previewTimelineResetVersion?: number;
  readonly previewRenderer?: "hyperframes" | "remotion";
  readonly showDebugOverlay?: boolean;
  readonly showPlaybackHud?: boolean;
  readonly onPreviewStateChange?: (state: AudioCreativePreviewState) => void;
  readonly onAudioStatusChange?: (status: AudioCreativePreviewAudioStatus, errorMessage: string | null) => void;
  readonly onLiveSessionChange?: (state: LiveAudioPreviewBackendState | null) => void;
};

type BuildState = "idle" | "building-timeline" | "ready" | "error";

type PreviewGovernorMode = "backend-preview-plan" | "projection-only-awaiting-backend-plan";
type InteractivePreviewSurface = "artifact" | "remotion-player" | "display-god" | "native-stage";

type PreviewTimingState = {
  runId: string;
  startedAtMs: number;
  requestPostedAtMs: number | null;
  sessionId: string | null;
  firstBackendStateAtMs: number | null;
  firstRenderableAtMs: number | null;
  firstReadyAtMs: number | null;
  fullReadyAtMs: number | null;
};

const STATUS_FALLBACK_POLL_INTERVAL_MS = 10000;
const BACKEND_UPDATE_STALE_AFTER_MS = 10000;
const EDIT_SESSION_EVENT_TYPES = [
  "preview_initializing",
  "preview_placeholder_ready",
  "preview_text_ready",
  "transcript_started",
  "transcript_progress",
  "transcript_ready",
  "analysis_ready",
  "motion_graphics_ready",
  "failed"
] as const;

export type LiveEditSessionPublicState = {
  id: string;
  status: string;
  captionProfileId: CaptionStyleProfileId;
  motionTier: MotionTier | "auto";
  previewStatus: string;
  previewLines: string[];
  previewMotionSequence: LivePreviewMotionCue[];
  transcriptStatus: string;
  transcriptWords: LivePreviewBackendWord[];
  analysisStatus: string;
  motionGraphicsStatus: string;
  renderStatus: string;
  errorMessage: string | null;
  lastEventType: string | null;
  sourceFilename?: string | null;
  sourceDurationMs?: number | null;
  sourceAspectRatio?: string | null;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  sourceFps?: number | null;
  sourceHasVideo?: boolean;
  liveActivity?: {
    activityCode: string;
    detail: string;
    heartbeat: string;
    lastActiveAt: string;
  } | null;
  routes?: {
    status: string;
    previewManifest: string;
    previewArtifact: string;
    preview: string;
    render: string;
    renderStatus: string;
    sourceMedia: string | null;
    events: string;
  };
  lanes?: {
    defaultInteractive: "hyperframes" | "remotion";
    interactive: Array<"hyperframes" | "remotion">;
    export: "remotion";
  };
  sourceMediaUrl?: string | null;
  sourceMediaKind?: HyperframesPreviewManifest["baseVideo"]["sourceKind"];
  sourceLabel?: string | null;
  previewArtifactUrl?: string | null;
  previewArtifactKind?: "html_composition" | "video" | null;
  previewArtifactContentType?: string | null;
  previewDiagnostics?: Record<string, unknown> | null;
};

export type LiveAudioPreviewBackendState = {
  sessionId: string | null;
  status: string;
  previewStatus: string;
  transcriptStatus: string;
  analysisStatus: string;
  motionGraphicsStatus: string;
  renderStatus: string;
  previewLineCount: number;
  previewMotionCueCount: number;
  transcriptWordCount: number;
  overlayReady: boolean;
  momentCount: number;
  trackCount: number;
  errorMessage: string | null;
  lastEventType: string | null;
  sourceHasVideo: boolean;
  sourceWidth: number | null;
  sourceHeight: number | null;
  sourceFps: number | null;
  sourceDurationMs: number | null;
  liveActivity: {
    activityCode: string;
    detail: string;
    heartbeat: string;
    lastActiveAt: string;
  } | null;
};

export type PreviewDiagnosticsSummary = {
  status: "healthy" | "degraded";
  degradedStages: string[];
  fallbackReasons: string[];
  visibleFailureCount: number;
  cognitiveConfidence: number | null;
  temporalConfidence: number | null;
  modelConfidence: number | null;
  hallucinationProbability: number | null;
};

const loadingStyles: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  padding: 24,
  color: "#E2E8F0",
  background:
    "radial-gradient(circle at 50% 20%, rgba(214, 177, 107, 0.18), transparent 36%), linear-gradient(180deg, rgba(5, 7, 11, 0.92), rgba(2, 6, 23, 0.98))",
  textAlign: "center"
};

const panelStyles: React.CSSProperties = {
  maxWidth: 540,
  padding: "22px 24px",
  borderRadius: 24,
  border: "1px solid rgba(243, 245, 248, 0.1)",
  background: "rgba(10, 12, 18, 0.74)",
  boxShadow: "0 24px 70px rgba(0, 0, 0, 0.34)"
};

const statusChipStyles: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 11px",
  borderRadius: 999,
  border: "1px solid rgba(243, 245, 248, 0.12)",
  color: "#F8FAFC",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase"
};

const stageStatusOverlayStyles: React.CSSProperties = {
  gridArea: "1 / 1",
  alignSelf: "start",
  justifySelf: "center",
  width: "min(100%, 720px)",
  padding: 18,
  pointerEvents: "none"
};

const stageStatusCardStyles: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "12px 16px",
  borderRadius: 18,
  border: "1px solid rgba(243, 245, 248, 0.12)",
  background: "rgba(3, 7, 18, 0.72)",
  boxShadow: "0 18px 44px rgba(0, 0, 0, 0.28)",
  backdropFilter: "blur(16px)",
  color: "#F8FAFC",
  textAlign: "left"
};

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((entry) => typeof entry === "string" ? entry.trim() : "")
        .filter(Boolean)
    : [];

const readNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const summarizePreviewDiagnostics = (
  diagnostics: Record<string, unknown> | null | undefined
): PreviewDiagnosticsSummary | null => {
  if (!diagnostics) {
    return null;
  }

  const degradedStages = readStringArray(diagnostics.degradedStages);
  const fallbackReasons = readStringArray(diagnostics.fallbackReasons);
  const visibleFailures = Array.isArray(diagnostics.visibleFailures)
    ? diagnostics.visibleFailures
    : [];
  const visibleFailureCount =
    readNumber(diagnostics.visibleFailureCount) ??
    visibleFailures.length ??
    0;
  const cognitiveConfidence = readNumber(diagnostics.cognitiveConfidence);
  const temporalConfidence = readNumber(diagnostics.temporalConfidence);
  const modelConfidence = readNumber(diagnostics.modelConfidence);
  const hallucinationProbability = readNumber(diagnostics.hallucinationProbability);
  const fallbackUsed = diagnostics.fallbackUsed === true || fallbackReasons.length > 0;
  const status = degradedStages.length > 0 || visibleFailureCount > 0 || fallbackUsed
    ? "degraded"
    : "healthy";

  return {
    status,
    degradedStages,
    fallbackReasons,
    visibleFailureCount,
    cognitiveConfidence,
    temporalConfidence,
    modelConfidence,
    hallucinationProbability
  };
};

const formatConfidence = (value: number | null): string =>
  value === null ? "n/a" : `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

const PreviewDiagnosticsPanel: React.FC<{
  diagnostics: Record<string, unknown>;
}> = ({diagnostics}) => {
  const summary = summarizePreviewDiagnostics(diagnostics);
  if (!summary) {
    return null;
  }

  const isDegraded = summary.status === "degraded";
  const reasons = [
    ...summary.degradedStages.map((stage) => `stage:${stage}`),
    ...summary.fallbackReasons
  ].slice(0, 4);

  return (
    <section
      aria-label="Preview diagnostics"
      style={{
        display: "grid",
        gap: 10,
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${isDegraded ? "rgba(251, 191, 36, 0.28)" : "rgba(34, 197, 94, 0.22)"}`,
        background: isDegraded ? "rgba(69, 26, 3, 0.45)" : "rgba(5, 46, 22, 0.32)",
        color: "#E5E7EB",
        fontSize: 12,
        lineHeight: 1.35
      }}
    >
      <div style={{display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center"}}>
        <strong style={{color: isDegraded ? "#FDE68A" : "#BBF7D0"}}>
          {isDegraded ? "Degraded preview" : "Preview healthy"}
        </strong>
        <span>Failures: {summary.visibleFailureCount}</span>
        <span>Cognitive: {formatConfidence(summary.cognitiveConfidence)}</span>
        <span>Temporal: {formatConfidence(summary.temporalConfidence)}</span>
        {summary.modelConfidence !== null ? (
          <span>Model: {formatConfidence(summary.modelConfidence)}</span>
        ) : null}
        {summary.hallucinationProbability !== null ? (
          <span>Hallucination: {formatConfidence(summary.hallucinationProbability)}</span>
        ) : null}
      </div>
      {reasons.length > 0 ? (
        <div style={{display: "grid", gap: 4, color: "#CBD5E1"}}>
          {reasons.map((reason) => (
            <span key={reason}>{reason}</span>
          ))}
        </div>
      ) : null}
      <details>
        <summary style={{cursor: "pointer", color: "#93C5FD"}}>Diagnostics payload</summary>
        <pre style={{
          margin: "8px 0 0",
          padding: 10,
          borderRadius: 8,
          background: "rgba(15, 23, 42, 0.72)",
          color: "#CBD5E1",
          fontSize: 11,
          lineHeight: 1.4,
          maxHeight: 160,
          overflow: "auto"
        }}>
          {JSON.stringify(diagnostics, null, 2)}
        </pre>
      </details>
    </section>
  );
};

const LoadingShell: React.FC<{
  buildState: BuildState;
  mediaStatus: AudioCreativePreviewAudioStatus;
}> = ({buildState, mediaStatus}) => {
  const isAwaitingTranscript = buildState === "building-timeline";
  const title = isAwaitingTranscript ? "The engine is analyzing your speech." : "The native browser compositor is warming up.";
  const subtitle = isAwaitingTranscript 
    ? "AssemblyAI is currently extracting every word from your video to build the cinematic timeline. This usually takes 5-10 seconds."
    : "AssemblyAI and the overlay timeline are locking to the source. The stage appears as soon as the first real moments land.";

  return (
    <div style={loadingStyles}>
      <div style={panelStyles}>
        <div style={statusChipStyles}>
          <span>Live Compositor Preview</span>
          <span>|</span>
          <span>{isAwaitingTranscript ? "Analyzing" : "Synchronizing"}</span>
        </div>
        <div style={{marginTop: 16, display: "grid", gap: 10}}>
          <strong style={{fontSize: "clamp(24px, 4vw, 42px)", lineHeight: 1.04}}>
            {title}
          </strong>
          <span style={{fontSize: 15, lineHeight: 1.55, color: "#CBD5E1"}}>
            {subtitle}
          </span>
          <span style={{fontSize: 13, lineHeight: 1.45, color: "#94A3B8"}}>
            Media status: {mediaStatus}. Video sources stay on the native browser playback path whenever they are
            available.
          </span>
        </div>
      </div>
    </div>
  );
};

const StageStatusOverlay: React.FC<{
  buildState: BuildState;
  mediaStatus: AudioCreativePreviewAudioStatus;
  liveActivity?: LiveAudioPreviewBackendState["liveActivity"];
  errorMessage?: string | null;
}> = ({buildState, mediaStatus, liveActivity, errorMessage}) => {
  const isError = Boolean(errorMessage) || buildState === "error";
  const activitySummary = liveActivity ? `${liveActivity.activityCode}: ${liveActivity.detail}` : null;

  return (
    <div style={stageStatusOverlayStyles}>
      <div style={stageStatusCardStyles}>
        <div style={{
          ...statusChipStyles,
          width: "fit-content",
          color: isError ? "#FECACA" : "#F8FAFC",
          borderColor: isError ? "rgba(248, 113, 113, 0.22)" : "rgba(243, 245, 248, 0.12)"
        }}>
          <span>Live Compositor Preview</span>
          <span>|</span>
          <span>{isError ? "Overlay issue" : "Building timeline"}</span>
        </div>
        <strong style={{fontSize: 16, lineHeight: 1.2}}>
          {isError
            ? "The source video is live, but the overlay timeline needs another pass."
            : "The source video is live. Overlays are still locking to timecode."}
        </strong>
        <span style={{fontSize: 13, lineHeight: 1.45, color: isError ? "#FECACA" : "#CBD5E1"}}>
          {isError
            ? errorMessage
            : "You can already play or scrub the footage while captions and motion cues finish wiring in."}
        </span>
        <span style={{fontSize: 12, lineHeight: 1.4, color: "#94A3B8"}}>
          Media status: {mediaStatus}.
        </span>
        {activitySummary ? (
          <span style={{fontSize: 12, lineHeight: 1.4, color: "#94A3B8"}}>
            {activitySummary}
          </span>
        ) : null}
      </div>
    </div>
  );
};

const ErrorShell: React.FC<{
  message: string;
  mediaStatus: AudioCreativePreviewAudioStatus;
}> = ({message, mediaStatus}) => {
  return (
    <div style={loadingStyles}>
      <div style={panelStyles}>
        <div style={statusChipStyles}>
          <span>Live Compositor Preview</span>
          <span>|</span>
          <span>Error</span>
        </div>
        <div style={{marginTop: 16, display: "grid", gap: 10}}>
          <strong style={{fontSize: "clamp(22px, 3.6vw, 36px)", lineHeight: 1.08}}>
            The live preview hit a timeline build issue.
          </strong>
          <span style={{fontSize: 15, lineHeight: 1.55, color: "#FBCFE8"}}>
            {message}
          </span>
          <span style={{fontSize: 13, lineHeight: 1.45, color: "#CBD5E1"}}>
            Media status: {mediaStatus}. The source can still stay browser-native, but the overlay timeline needs
            another pass.
          </span>
        </div>
      </div>
    </div>
  );
};

const normalizeSessionSnapshot = (payload: LiveEditSessionPublicState): LiveEditSessionPublicState => {
  return {
    ...payload,
    previewLines: Array.isArray(payload.previewLines) ? payload.previewLines : [],
    previewMotionSequence: Array.isArray(payload.previewMotionSequence) ? payload.previewMotionSequence : [],
    transcriptWords: Array.isArray(payload.transcriptWords) ? payload.transcriptWords : [],
    sourceHasVideo: payload.sourceHasVideo === true,
    lanes: payload.lanes
      ? {
          defaultInteractive: payload.lanes.defaultInteractive,
          interactive: Array.isArray(payload.lanes.interactive) ? payload.lanes.interactive : [],
          export: payload.lanes.export
        }
      : undefined,
    routes: payload.routes
      ? {
          ...payload.routes,
          sourceMedia: payload.routes.sourceMedia ?? null
        }
      : undefined,
    sourceMediaUrl: payload.sourceMediaUrl ?? null,
    sourceLabel: payload.sourceLabel ?? null,
    liveActivity: payload.liveActivity ?? null,
    previewArtifactUrl: payload.previewArtifactUrl ?? null,
    previewArtifactKind: payload.previewArtifactKind ?? null,
    previewArtifactContentType: payload.previewArtifactContentType ?? null,
    previewDiagnostics: payload.previewDiagnostics ?? null
  };
};

export const buildSessionSignature = (
  state: LiveEditSessionPublicState,
  input: {
    captionProfileId: CaptionStyleProfileId;
    motionTier: MotionTier | "auto";
    presentationMode: PresentationModeSetting | null;
  }
): string => {
  return JSON.stringify({
    captionProfileId: input.captionProfileId,
    motionTier: input.motionTier,
    presentationMode: input.presentationMode,
    previewStatus: state.previewStatus,
    transcriptStatus: state.transcriptStatus,
    previewLines: state.previewLines,
    sourceWidth: state.sourceWidth ?? null,
    sourceHeight: state.sourceHeight ?? null,
    sourceFps: state.sourceFps ?? null,
    sourceDurationMs: state.sourceDurationMs ?? null,
    sourceHasVideo: state.sourceHasVideo === true,
    previewMotionSequence: state.previewMotionSequence.map((cue) => ({
      cueId: cue.cueId,
      startMs: cue.startMs,
      durationMs: cue.durationMs,
      text: cue.text
    })),
    transcriptWordSignature:
      state.transcriptWords.length > 0
        ? {
            count: state.transcriptWords.length,
            firstStartMs: state.transcriptWords[0]?.start_ms ?? 0,
            lastEndMs: state.transcriptWords.at(-1)?.end_ms ?? 0
          }
        : null
  });
};

const createPreviewTimingState = (jobId: string, resetVersion: number): PreviewTimingState => ({
  runId: `${jobId}:${resetVersion}:${Date.now()}`,
  startedAtMs: performance.now(),
  requestPostedAtMs: null,
  sessionId: null,
  firstBackendStateAtMs: null,
  firstRenderableAtMs: null,
  firstReadyAtMs: null,
  fullReadyAtMs: null
});

const logPreviewGovernorStage = (
  timing: PreviewTimingState | null,
  stage: string,
  detail: Record<string, unknown> = {}
): void => {
  if (!timing) {
    return;
  }

  console.info("[preview-governor]", {
    runId: timing.runId,
    sessionId: timing.sessionId,
    stage,
    elapsedMs: Math.round(performance.now() - timing.startedAtMs),
    ...detail
  });
};

const toActionableBuildErrorMessage = (message: string, apiBase: string): string => {
  return /failed to fetch|networkerror|load failed/i.test(message)
    ? `Cannot reach the local backend at ${apiBase.replace(/\/+$/, "")}. Start the backend so AssemblyAI captions and live motion can load.`
    : message;
};

export const determineBuildState = (
  session: AudioCreativePreviewSession | null,
  liveSessionState: LiveEditSessionPublicState | null,
  isArtifactReady: boolean,
  currentBuildState: BuildState
): BuildState => {
  if (currentBuildState === "error") {
    return "error";
  }

  if (!liveSessionState) {
    return "idle";
  }

  const hasVideoDuration = (liveSessionState.sourceDurationMs ?? 0) > 0;
  const hasTranscript = liveSessionState.transcriptWords.length > 0;

  if (!hasVideoDuration) {
    return "idle";
  }

  if (!hasTranscript) {
    return "building-timeline";
  }

  if (!session && !isArtifactReady) {
    return "building-timeline";
  }

  return "ready";
};

export const shouldBlockInteractivePreview = (buildState: BuildState): boolean =>
  buildState === "idle" || buildState === "building-timeline";

export const resolveHasSession = (liveSessionId?: string | null): boolean =>
  (liveSessionId?.trim().length ?? 0) > 0;

export const shouldRenderBlockingLoader = (
  buildState: BuildState,
  interactivePreviewSurface: InteractivePreviewSurface
): boolean => shouldBlockInteractivePreview(buildState) && interactivePreviewSurface !== "artifact";

const buildBaseVideoMetadata = (
  state: LiveEditSessionPublicState | null
): Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames"> | null => {
  if (!state) {
    return null;
  }

  const width = state.sourceWidth ?? 0;
  const height = state.sourceHeight ?? 0;
  const fps = state.sourceFps ?? 0;
  if (width <= 0 || height <= 0 || fps <= 0) {
    return null;
  }

  const durationSeconds = Math.max(1, (state.sourceDurationMs ?? 0) / 1000);
  return {
    width,
    height,
    fps,
    durationSeconds,
    durationInFrames: Math.max(1, Math.ceil(durationSeconds * fps))
  };
};

export const buildBackendPreviewPlan = (state: LiveEditSessionPublicState): BackendPreviewPlan | null => {
  if (
    state.transcriptWords.length === 0 &&
    state.previewMotionSequence.length === 0 &&
    state.previewLines.length === 0
  ) {
    return null;
  }

  return {
    previewText: state.previewLines.join("\n") || null,
    previewLines: state.previewLines,
    previewMotionSequence: state.previewMotionSequence,
    transcriptWords: state.transcriptWords
  };
};

export const resolveApiUrl = (apiBase: string, candidate?: string | null): string | null => {
  const value = candidate?.trim() ?? "";
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const normalizedBase = apiBase.replace(/\/+$/, "");
  return value.startsWith("/") ? `${normalizedBase}${value}` : `${normalizedBase}/${value}`;
};

export const buildPreviewManifestFromSessionState = (
  sessionState: LiveEditSessionPublicState | null,
  apiBase: string
): HyperframesPreviewManifest | null => {
  if (!sessionState?.routes || !sessionState.lanes) {
    return null;
  }

  return hyperframesPreviewManifestSchema.parse({
    schemaVersion: "hyperframes-preview-manifest/v1",
    sessionId: sessionState.id,
    captionProfileId: sessionState.captionProfileId,
    motionTier: sessionState.motionTier,
    lanes: sessionState.lanes,
    routes: {
      status: sessionState.routes.status,
      preview: sessionState.routes.preview,
      render: sessionState.routes.render,
      renderStatus: sessionState.routes.renderStatus,
      sourceMedia: sessionState.routes.sourceMedia
    },
    baseVideo: {
      src: resolveApiUrl(apiBase, sessionState.sourceMediaUrl ?? sessionState.routes.sourceMedia),
      sourceKind: sessionState.sourceMediaKind ?? "none",
      sourceLabel: sessionState.sourceLabel ?? sessionState.sourceFilename ?? null,
      hasVideo: sessionState.sourceHasVideo === true,
      width: sessionState.sourceWidth ?? null,
      height: sessionState.sourceHeight ?? null,
      fps: sessionState.sourceFps ?? null,
      durationMs: sessionState.sourceDurationMs ?? null
    },
    audio: {
      src: sessionState.sourceHasVideo === true ? null : resolveApiUrl(apiBase, sessionState.sourceMediaUrl ?? sessionState.routes.sourceMedia),
      source: sessionState.sourceHasVideo === true
        ? "video-element"
        : sessionState.sourceMediaUrl || sessionState.routes.sourceMedia
          ? "separate-audio"
          : "none"
    },
    session: {
      id: sessionState.id,
      status: sessionState.status,
      previewStatus: sessionState.previewStatus,
      transcriptStatus: sessionState.transcriptStatus,
      analysisStatus: sessionState.analysisStatus,
      motionGraphicsStatus: sessionState.motionGraphicsStatus,
      renderStatus: sessionState.renderStatus,
      previewText: sessionState.previewLines.join("\n") || null,
      previewLines: sessionState.previewLines,
      previewMotionSequence: sessionState.previewMotionSequence,
      transcriptWords: sessionState.transcriptWords,
      errorMessage: sessionState.errorMessage,
      sourceFilename: sessionState.sourceFilename ?? null,
      sourceDurationMs: sessionState.sourceDurationMs ?? null,
      sourceAspectRatio: sessionState.sourceAspectRatio ?? null,
      sourceWidth: sessionState.sourceWidth ?? null,
      sourceHeight: sessionState.sourceHeight ?? null,
      sourceFps: sessionState.sourceFps ?? null,
      sourceHasVideo: sessionState.sourceHasVideo === true,
      lastEventType: sessionState.lastEventType ?? null,
      previewPlaceholder: {
        active: false,
        styleId: sessionState.captionProfileId,
        copy: "",
        reason: "waiting_for_audio",
        line1: "",
        line2: null
      },
      renderOutputUrl: null,
      renderOutputPath: null
    },
    overlayPlan: {
      previewText: sessionState.previewLines.join("\n") || null,
      previewLines: sessionState.previewLines,
      previewMotionSequence: sessionState.previewMotionSequence,
      transcriptWords: sessionState.transcriptWords,
      placeholder: {
        active: false,
        styleId: sessionState.captionProfileId,
        copy: "",
        reason: "waiting_for_audio",
        line1: "",
        line2: null
      }
    },
    export: {
      remotion: {
        available: true,
        renderStatus: sessionState.renderStatus,
        outputUrl: null,
        outputPath: null
      }
    }
  });
};

export const buildProjectScopedLivePreviewSessionData = (
  sessionState: LiveEditSessionPublicState | null
): ProjectScopedLivePreviewSessionData | null => {
  if (!sessionState) {
    return null;
  }

  return {
    sessionId: sessionState.id,
    status: sessionState.status,
    previewStatus: sessionState.previewStatus,
    transcriptStatus: sessionState.transcriptStatus,
    analysisStatus: sessionState.analysisStatus,
    motionGraphicsStatus: sessionState.motionGraphicsStatus,
    renderStatus: sessionState.renderStatus,
    sourceLabel: sessionState.sourceLabel ?? null,
    sourceFilename: sessionState.sourceFilename ?? null,
    sourceHasVideo: sessionState.sourceHasVideo === true,
    sourceWidth: sessionState.sourceWidth ?? null,
    sourceHeight: sessionState.sourceHeight ?? null,
    sourceFps: sessionState.sourceFps ?? null,
    sourceDurationMs: sessionState.sourceDurationMs ?? null,
    liveActivity: sessionState.liveActivity ?? null,
    previewLines: sessionState.previewLines,
    previewMotionSequence: sessionState.previewMotionSequence,
    transcriptWords: sessionState.transcriptWords
  };
};

export const resolveLivePreviewSessionEndpoints = ({
  apiBase,
  payload
}: {
  apiBase: string;
  payload: LiveEditSessionPublicState & {
    urls?: {
      status?: string;
      events?: string;
    };
  };
}): {
  sessionId: string;
  statusUrl: string;
  eventsUrl: string | null;
} => {
  const normalizedApiBase = apiBase.replace(/\/+$/, "");

  return {
    sessionId: payload.id,
    statusUrl:
      resolveApiUrl(apiBase, payload.routes?.status ?? payload.urls?.status) ??
      `${normalizedApiBase}/api/edit-sessions/${payload.id}/status`,
    eventsUrl: resolveApiUrl(apiBase, payload.routes?.events ?? payload.urls?.events)
  };
};

export const createProjectScopedPreviewResetState = (): {
  session: null;
  liveSessionState: null;
  buildState: BuildState;
  buildError: null;
  sessionBuildSignature: string;
  isArtifactReady: boolean;
} => ({
  session: null,
  liveSessionState: null,
  buildState: "building-timeline",
  buildError: null,
  sessionBuildSignature: "",
  isArtifactReady: false
});

export const resolveInteractivePreviewSurface = ({
  previewRenderer,
  canRenderArtifact,
  canRenderNativeVideoStage,
  shouldUseDisplayGod
}: {
  previewRenderer: "hyperframes" | "remotion";
  canRenderArtifact: boolean;
  canRenderNativeVideoStage: boolean;
  shouldUseDisplayGod: boolean;
}): InteractivePreviewSurface => {
  if (previewRenderer === "hyperframes" && canRenderArtifact) {
    return "artifact";
  }

  if (previewRenderer === "remotion" && canRenderNativeVideoStage) {
    return "remotion-player";
  }

  if (shouldUseDisplayGod) {
    return "display-god";
  }

  return "native-stage";
};

const ArtifactStage: React.FC<{
  url: string;
  kind: "video" | "html_composition";
  contentType?: string | null;
  width: number;
  height: number;
  onRuntimeError?: (message: string) => void;
  onReady?: () => void;
}> = ({url, kind, width, height, onRuntimeError, onReady}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<string>("loading");
  const runtimeStatusRef = useRef(runtimeStatus);
  const pollTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    runtimeStatusRef.current = runtimeStatus;
  }, [runtimeStatus]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "HYPERFRAMES_STATUS" && event.data?.status === "READY") {
        onReady?.();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onReady]);

  useEffect(() => {
    if (kind !== "html_composition") {
      return;
    }

    let cancelled = false;
    const pollStatus = () => {
      if (cancelled || !iframeRef.current?.contentWindow) {
        return;
      }

      try {
        const win = iframeRef.current.contentWindow as any;
        const status = win.hyperframesStatus;
        const error = win.hyperframesErrorMessage;

        if (status && status !== runtimeStatusRef.current) {
          runtimeStatusRef.current = status;
          setRuntimeStatus(status);
          if (status === "error" && error) {
            onRuntimeError?.(error);
          }
          if (status === "ready" || status === "playing") {
            onReady?.();
          }
        }
      } catch (e) {
        // CORS or not yet loaded
      }

      pollTimeoutRef.current = window.setTimeout(pollStatus, 500);
    };

    pollStatus();
    return () => {
      cancelled = true;
      if (pollTimeoutRef.current !== null) {
        window.clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [kind, onRuntimeError, onReady]);

  const aspectRatio = `${Math.max(1, width)} / ${Math.max(1, height)}`;
  const frameStyles: React.CSSProperties = {
    width: "100%",
    aspectRatio,
    minHeight: 420,
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: 16,
    background: "#020617",
    display: "block"
  };

  if (kind === "video") {
    return <video src={url} controls playsInline style={frameStyles} />;
  }

  return (
    <iframe
      ref={iframeRef}
      title="HyperFrames Composition Preview"
      src={url}
      scrolling="no"
      style={{...frameStyles, background: "transparent"}}
    />
  );
};

export const CreativeAudioLivePlayer: React.FC<CreativeAudioLivePlayerProps> = ({
  jobId,
  captionProfileId,
  motionTier,
  presentationMode = "long-form",
  apiBase = "http://127.0.0.1:8000",
  sourceFile,
  sourcePath,
  sourceMediaSrc,
  sourceLabel,
  previewTimelineResetVersion = 0,
  previewRenderer = "hyperframes",
  showDebugOverlay = true,
  showPlaybackHud = true,
  onPreviewStateChange,
  onAudioStatusChange,
  onLiveSessionChange
}) => {
  const [buildState, setBuildState] = useState<BuildState>("idle");
  const [isArtifactReady, setIsArtifactReady] = useState(false);
  const [session, setSession] = useState<AudioCreativePreviewSession | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [resolvedAudioSrc, setResolvedAudioSrc] = useState("");
  const [resolvedVideoSrc, setResolvedVideoSrc] = useState("");
  const [playbackSourcePending, setPlaybackSourcePending] = useState(false);
  const [playbackSourceError, setPlaybackSourceError] = useState<string | null>(null);
  const [liveSessionState, setLiveSessionState] = useState<LiveEditSessionPublicState | null>(null);
  const [browserVideoMetadata, setBrowserVideoMetadata] = useState<Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames"> | null>(null);
  const [nativePreviewHealth, setNativePreviewHealth] = useState<PreviewPlaybackHealth>("booting");
  const [nativePreviewErrorMessage, setNativePreviewErrorMessage] = useState<string | null>(null);
  const [displayGodFallbackReason, setDisplayGodFallbackReason] = useState<string | null>(null);
  const previewStateCallbackRef = useRef(onPreviewStateChange);
  const audioStatusCallbackRef = useRef(onAudioStatusChange);
  const liveSessionCallbackRef = useRef(onLiveSessionChange);
  const sessionBuildSignatureRef = useRef("");
  const previewTimingRef = useRef<PreviewTimingState | null>(null);
  const lastBackendUpdateAtRef = useRef(0);
  const sourcePlan = useMemo(
    () =>
      planAudioPreviewSource({
        sourceAudioSrc: sourceMediaSrc,
        sourceFile,
        sourcePath
      }),
    [sourceFile, sourceMediaSrc, sourcePath]
  );
  const directBrowserVideoSrc = useMemo(() => {
    const candidate = sourceMediaSrc?.trim() ?? "";
    if (!candidate || !isLikelyVideoFileLike(sourceFile)) {
      return "";
    }
    return candidate;
  }, [sourceFile, sourceMediaSrc]);
  const sessionVideoSrc = useMemo(() => {
    if (!liveSessionState || liveSessionState.sourceHasVideo !== true) {
      return "";
    }
    return (
      resolveApiUrl(apiBase, liveSessionState.sourceMediaUrl ?? liveSessionState.routes?.sourceMedia) ??
      resolveEditSessionSourceUrl(apiBase, liveSessionState.id)
    );
  }, [apiBase, liveSessionState]);
  const previewManifest = useMemo(
    () => buildPreviewManifestFromSessionState(liveSessionState, apiBase),
    [apiBase, liveSessionState]
  );
  const currentBackendPreviewPlan = useMemo(
    () => liveSessionState ? buildBackendPreviewPlan(liveSessionState) : null,
    [liveSessionState]
  );
  const livePreviewSessionData = useMemo(
    () => buildProjectScopedLivePreviewSessionData(liveSessionState),
    [liveSessionState]
  );
  const previewArtifactUrl = useMemo(
    () => resolveApiUrl(apiBase, liveSessionState?.previewArtifactUrl),
    [apiBase, liveSessionState?.previewArtifactUrl]
  );
  const previewArtifactKind = liveSessionState?.previewArtifactKind ?? null;
  const previewArtifactContentType = liveSessionState?.previewArtifactContentType ?? null;
  const previewDiagnostics = liveSessionState?.previewDiagnostics ?? null;
  const hasSession = useMemo(() => resolveHasSession(liveSessionState?.id), [liveSessionState?.id]);
  const effectiveArtifactReady = previewArtifactKind === "video" ? true : isArtifactReady;

  useEffect(() => {
    setBuildState((current) => determineBuildState(session, liveSessionState, effectiveArtifactReady, current));
  }, [effectiveArtifactReady, liveSessionState, session]);

  useEffect(() => {
    setIsArtifactReady(false);
  }, [previewArtifactUrl, previewTimelineResetVersion]);

  const fallbackVideoMetadata = useMemo(() => {
    const liveVideoMetadata = buildBaseVideoMetadata(liveSessionState);
    const fallbackDurationMs = liveSessionState?.sourceDurationMs ??
      (browserVideoMetadata?.durationSeconds ? browserVideoMetadata.durationSeconds * 1000 : null);

    return resolveAudioCreativePreviewVideoMetadata({
      presentationMode,
      durationMs: fallbackDurationMs,
      baseVideoMetadata: liveVideoMetadata ?? browserVideoMetadata
    });
  }, [browserVideoMetadata, liveSessionState, presentationMode]);
  const fallbackMotionModel = useMemo(() => {
    return buildMotionCompositionModel({
      chunks: [],
      tier: motionTier,
      fps: fallbackVideoMetadata.fps,
      videoMetadata: fallbackVideoMetadata,
      captionProfileId,
      suppressAmbientAssets: true,
      transitionOverlayMode: "off",
      motion3DMode: "off"
    });
  }, [captionProfileId, fallbackVideoMetadata, motionTier]);
  const displayTimeline = useMemo(() => {
    if (!resolvedVideoSrc) {
      return null;
    }

    return buildDisplayTimelineFromPreviewSession({
      jobId,
      videoSrc: resolvedVideoSrc,
      audioSrc: resolvedAudioSrc || null,
      session,
      fallbackMotionModel,
      fallbackVideoMetadata,
      captionProfileId,
      sourceLabel
    });
  }, [
    captionProfileId,
    fallbackMotionModel,
    fallbackVideoMetadata,
    jobId,
    resolvedAudioSrc,
    resolvedVideoSrc,
    session,
    sourceLabel
  ]);

  useEffect(() => {
    previewStateCallbackRef.current = onPreviewStateChange;
  }, [onPreviewStateChange]);

  useEffect(() => {
    audioStatusCallbackRef.current = onAudioStatusChange;
  }, [onAudioStatusChange]);

  useEffect(() => {
    liveSessionCallbackRef.current = onLiveSessionChange;
  }, [onLiveSessionChange]);

  useEffect(() => {
    const current = liveSessionState;
    liveSessionCallbackRef.current?.(
      current
        ? {
            sessionId: current.id,
            status: current.status,
            previewStatus: current.previewStatus,
            transcriptStatus: current.transcriptStatus,
            analysisStatus: current.analysisStatus,
            motionGraphicsStatus: current.motionGraphicsStatus,
            renderStatus: current.renderStatus,
            previewLineCount: current.previewLines.length,
            previewMotionCueCount: current.previewMotionSequence.length,
            transcriptWordCount: current.transcriptWords.length,
            overlayReady: Boolean(
              session &&
              (session.captionChunks.length > 0 ||
                (session.creativeTimeline.tracks.length > 0 && session.creativeTimeline.moments.length > 0))
            ),
            momentCount: session?.creativeTimeline.moments.length ?? 0,
            trackCount: session?.creativeTimeline.tracks.length ?? 0,
            errorMessage: current.errorMessage,
            lastEventType: current.lastEventType,
            sourceHasVideo: current.sourceHasVideo === true,
            sourceWidth: current.sourceWidth ?? null,
            sourceHeight: current.sourceHeight ?? null,
            sourceFps: current.sourceFps ?? null,
            sourceDurationMs: current.sourceDurationMs ?? null,
            liveActivity: current.liveActivity ?? null
          }
        : null
    );
  }, [liveSessionState, session]);

  useEffect(() => {
    setNativePreviewHealth("booting");
    setNativePreviewErrorMessage(null);
    setDisplayGodFallbackReason(null);
  }, [previewTimelineResetVersion, resolvedVideoSrc]);

  useEffect(() => {
    if (!directBrowserVideoSrc || typeof document === "undefined") {
      setBrowserVideoMetadata(null);
      return;
    }

    let cancelled = false;
    const probeVideo = document.createElement("video");
    const fallbackFps = liveSessionState?.sourceFps && liveSessionState.sourceFps > 0 ? liveSessionState.sourceFps : 30;

    const handleLoadedMetadata = (): void => {
      if (cancelled) {
        return;
      }

      const width = Math.max(1, Math.round(probeVideo.videoWidth || 0));
      const height = Math.max(1, Math.round(probeVideo.videoHeight || 0));
      if (width <= 0 || height <= 0) {
        return;
      }

      const durationSeconds = Number.isFinite(probeVideo.duration) && probeVideo.duration > 0
        ? probeVideo.duration
        : fallbackVideoMetadata.durationSeconds;

      setBrowserVideoMetadata({
        width,
        height,
        fps: fallbackFps,
        durationSeconds,
        durationInFrames: Math.max(1, Math.ceil(durationSeconds * fallbackFps))
      });
    };

    const handleError = (): void => {
      if (!cancelled) {
        setBrowserVideoMetadata(null);
      }
    };

    probeVideo.preload = "metadata";
    probeVideo.muted = true;
    probeVideo.playsInline = true;
    probeVideo.addEventListener("loadedmetadata", handleLoadedMetadata);
    probeVideo.addEventListener("error", handleError);
    probeVideo.src = directBrowserVideoSrc;
    probeVideo.load();

    return () => {
      cancelled = true;
      probeVideo.removeEventListener("loadedmetadata", handleLoadedMetadata);
      probeVideo.removeEventListener("error", handleError);
      probeVideo.pause();
      probeVideo.removeAttribute("src");
      probeVideo.load();
    };
  }, [directBrowserVideoSrc, fallbackVideoMetadata.durationSeconds, liveSessionState?.sourceFps]);

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();

    if (sourcePlan.kind === "missing") {
      setResolvedAudioSrc("");
      setResolvedVideoSrc("");
      setPlaybackSourcePending(false);
      setPlaybackSourceError(null);
      audioStatusCallbackRef.current?.("missing", null);
      return () => {
        cancelled = true;
        abortController.abort();
      };
    }

    if (directBrowserVideoSrc) {
      setResolvedVideoSrc(directBrowserVideoSrc);
      setResolvedAudioSrc("");
      setPlaybackSourcePending(false);
      setPlaybackSourceError(null);
      audioStatusCallbackRef.current?.("loading", null);
      return () => {
        cancelled = true;
        abortController.abort();
      };
    }

    if (sessionVideoSrc) {
      setResolvedVideoSrc(sessionVideoSrc);
      setResolvedAudioSrc("");
      setPlaybackSourcePending(false);
      setPlaybackSourceError(null);
      audioStatusCallbackRef.current?.("loading", null);
      return () => {
        cancelled = true;
        abortController.abort();
      };
    }

    if (sourcePlan.kind === "direct") {
      setResolvedVideoSrc("");
      setResolvedAudioSrc(sourcePlan.src);
      setPlaybackSourcePending(false);
      setPlaybackSourceError(null);
      audioStatusCallbackRef.current?.("loading", null);
      return () => {
        cancelled = true;
        abortController.abort();
      };
    }

    if (!liveSessionState?.id) {
      setResolvedVideoSrc("");
      setResolvedAudioSrc("");
      setPlaybackSourcePending(true);
      setPlaybackSourceError(null);
      audioStatusCallbackRef.current?.("loading", null);
      return () => {
        cancelled = true;
        abortController.abort();
      };
    }

    const resolveBackendAudio = async (): Promise<void> => {
      setResolvedVideoSrc("");
      setResolvedAudioSrc("");
      setPlaybackSourcePending(true);
      setPlaybackSourceError(null);
      audioStatusCallbackRef.current?.("loading", null);

      try {
        const endpoint = `${apiBase.replace(/\/+$/, "")}/api/local-preview/audio-preview`;
        let response: Response;

        if (sourceFile) {
          const formData = new FormData();
          formData.append("source_video", sourceFile);
          if (sourcePlan.sourcePath) {
            formData.append("sourcePath", sourcePlan.sourcePath);
          }

          response = await fetch(endpoint, {
            method: "POST",
            body: formData,
            signal: abortController.signal
          });
        } else {
          response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              sourcePath: sourcePlan.sourcePath ?? ""
            }),
            signal: abortController.signal
          });
        }

        const payload = await response.json() as {audioUrl?: string; error?: string};
        if (!response.ok || !payload.audioUrl) {
          throw new Error(payload.error ?? `Audio preview request failed with ${response.status}.`);
        }

        if (cancelled) {
          return;
        }

        setResolvedAudioSrc(resolveAudioPreviewUrl(apiBase, payload.audioUrl));
        setPlaybackSourcePending(false);
        setPlaybackSourceError(null);
      } catch (error) {
        if (cancelled || abortController.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        setResolvedAudioSrc("");
        setPlaybackSourcePending(false);
        setPlaybackSourceError(message);
        audioStatusCallbackRef.current?.("error", message);
      }
    };

    void resolveBackendAudio();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [apiBase, directBrowserVideoSrc, liveSessionState?.id, sessionVideoSrc, sourceFile, sourcePlan]);

  useEffect(() => {
    let cancelled = false;
    let intervalId = 0;
    let eventSource: EventSource | null = null;
    const abortController = new AbortController();

    const updateSessionFromBackend = async (payload: LiveEditSessionPublicState): Promise<void> => {
      if (cancelled) {
        return;
      }

      const nextState = normalizeSessionSnapshot(payload);
      const timing = previewTimingRef.current;
      lastBackendUpdateAtRef.current = Date.now();
      if (timing) {
        timing.sessionId = nextState.id;
        if (timing.firstBackendStateAtMs === null) {
          timing.firstBackendStateAtMs = performance.now();
          logPreviewGovernorStage(timing, "backend_state_received", {
            previewStatus: nextState.previewStatus,
            transcriptStatus: nextState.transcriptStatus
          });
        }
      }
      setLiveSessionState(nextState);

      const hasVideoDuration = (nextState.sourceDurationMs ?? 0) > 0;
      const hasTranscript = nextState.transcriptWords.length > 0;

      if (!hasVideoDuration) {
        setBuildState("idle");
        previewStateCallbackRef.current?.("building-timeline");
        return;
      }

      if (!hasTranscript) {
        setBuildState("building-timeline");
        previewStateCallbackRef.current?.("building-timeline");
        return;
      }

      if (timing && timing.firstRenderableAtMs === null) {
        timing.firstRenderableAtMs = performance.now();
        logPreviewGovernorStage(timing, "first_renderable_state", {
          previewLines: nextState.previewLines.length,
          previewCues: nextState.previewMotionSequence.length,
          transcriptWords: nextState.transcriptWords.length
        });
      }

      const nextSignature = buildSessionSignature(nextState, {
        captionProfileId,
        motionTier,
        presentationMode
      });

      if (sessionBuildSignatureRef.current === nextSignature) {
        if (session) {
          setBuildState("ready");
          setBuildError(null);
          previewStateCallbackRef.current?.("ready");
        }
        return;
      }

      try {
        const baseVideoMetadata = buildBaseVideoMetadata(nextState);
        const backendPreviewPlan = buildBackendPreviewPlan(nextState);
        const governorMode: PreviewGovernorMode = backendPreviewPlan
          ? "backend-preview-plan"
          : "projection-only-awaiting-backend-plan";
        const buildStartedAtMs = performance.now();
        const nextSession = await buildAudioCreativePreviewSession({
          jobId: nextState.id,
          captionProfileId,
          motionTier,
          presentationMode,
          baseVideoMetadata,
          transcriptWords: nextState.transcriptWords,
          previewLines: nextState.previewLines,
          previewMotionSequence: nextState.previewMotionSequence,
          allowFallbackDemoData: false,
          backendPreviewPlan
        });

        if (cancelled) {
          return;
        }

        sessionBuildSignatureRef.current = nextSignature;
        setSession(nextSession);
        setBuildState("ready");
        setBuildError(null);
        previewStateCallbackRef.current?.("ready");
        if (timing) {
          const buildElapsedMs = Math.round(performance.now() - buildStartedAtMs);
          if (timing.firstReadyAtMs === null) {
            timing.firstReadyAtMs = performance.now();
            logPreviewGovernorStage(timing, "preview_ready", {
              governorMode,
              buildElapsedMs
            });
          } else {
            logPreviewGovernorStage(timing, "preview_rebuilt", {
              governorMode,
              buildElapsedMs,
              transcriptWords: nextState.transcriptWords.length
            });
          }
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = toActionableBuildErrorMessage(
          error instanceof Error ? error.message : String(error),
          apiBase
        );
        setBuildError(message);
        setBuildState("error");
        previewStateCallbackRef.current?.("error");
      }
    };

    const run = async (): Promise<void> => {
      if (sourcePlan.kind === "missing") {
        setSession(null);
        setLiveSessionState(null);
        setBuildState("idle");
        setBuildError(null);
        setIsArtifactReady(false);
        sessionBuildSignatureRef.current = "";
        previewStateCallbackRef.current?.("idle");
        return;
      }

      const resetState = createProjectScopedPreviewResetState();
      setSession(resetState.session);
      setLiveSessionState(resetState.liveSessionState);
      setBuildState(resetState.buildState);
      setBuildError(resetState.buildError);
      setIsArtifactReady(resetState.isArtifactReady);
      sessionBuildSignatureRef.current = resetState.sessionBuildSignature;
      previewTimingRef.current = createPreviewTimingState(jobId, previewTimelineResetVersion);
      lastBackendUpdateAtRef.current = 0;
      previewStateCallbackRef.current?.("building-timeline");

      try {
        const endpoint = `${apiBase.replace(/\/+$/, "")}/api/edit-sessions/live-preview`;
        const backendSourcePath = sourcePlan.kind === "backend" ? sourcePlan.sourcePath : null;
        let response: Response;
        previewTimingRef.current!.requestPostedAtMs = performance.now();
        logPreviewGovernorStage(previewTimingRef.current, "request_started", {
          sourceKind: sourcePlan.kind,
          sourceFile: sourceFile?.name ?? null
        });

        if (sourceFile) {
          const formData = new FormData();
          formData.append("source_video", sourceFile);
          formData.append("captionProfileId", captionProfileId);
          formData.append("motionTier", motionTier);
          if (backendSourcePath) {
            formData.append("sourcePath", backendSourcePath);
          }

          response = await fetch(endpoint, {
            method: "POST",
            body: formData,
            signal: abortController.signal
          });
        } else {
          if (!backendSourcePath) {
            throw new Error("A local source path is required to build the live preview session.");
          }

          response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              sourcePath: backendSourcePath,
              captionProfileId,
              motionTier
            }),
            signal: abortController.signal
          });
        }

        const payload = await response.json() as (LiveEditSessionPublicState & {
          error?: string;
          urls?: {status?: string; events?: string};
        });
        if (!response.ok || !payload.id) {
          throw new Error(payload.error ?? `Live preview session request failed with ${response.status}.`);
        }

        logPreviewGovernorStage(previewTimingRef.current, "request_accepted", {
          status: response.status,
          previewStatus: payload.previewStatus,
          transcriptStatus: payload.transcriptStatus
        });
        await updateSessionFromBackend(payload);

        const {sessionId, statusUrl, eventsUrl} = resolveLivePreviewSessionEndpoints({
          apiBase,
          payload
        });
        if (import.meta.env.DEV) {
          console.info("[CreativeAudioLivePlayer] Live preview session attached", {
            sessionId,
            statusUrl,
            eventsUrl
          });
        }

        const refreshStatus = async (): Promise<void> => {
          try {
            const statusResponse = await fetch(statusUrl, {
              cache: "no-store",
              signal: abortController.signal
            });
            if (!statusResponse.ok) {
              throw new Error(`Live preview status request failed with ${statusResponse.status}.`);
            }

            const nextState = await statusResponse.json() as LiveEditSessionPublicState;
            await updateSessionFromBackend(nextState);
          } catch (error) {
            if (cancelled || abortController.signal.aborted) {
              return;
            }

            if (!sessionBuildSignatureRef.current) {
              const message = toActionableBuildErrorMessage(
                error instanceof Error ? error.message : String(error),
                apiBase
              );
              setBuildError(message);
              setBuildState("error");
              previewStateCallbackRef.current?.("error");
            }
          }
        };

        if (eventsUrl && typeof window !== "undefined" && typeof window.EventSource === "function") {
          eventSource = new window.EventSource(eventsUrl);
          const handleEvent = (event: MessageEvent<string>): void => {
            try {
              const payload = JSON.parse(event.data) as {session?: LiveEditSessionPublicState};
              if (payload.session) {
                void updateSessionFromBackend(payload.session);
              }
            } catch (error) {
              console.warn("[CreativeAudioLivePlayer] Failed to parse live preview event payload", {
                error: error instanceof Error ? error.message : String(error)
              });
            }
          };

          EDIT_SESSION_EVENT_TYPES.forEach((eventType) => {
            eventSource?.addEventListener(eventType, handleEvent as EventListener);
          });
          eventSource.addEventListener("open", () => {
            logPreviewGovernorStage(previewTimingRef.current, "event_stream_open");
          });
          eventSource.addEventListener("error", () => {
            logPreviewGovernorStage(previewTimingRef.current, "event_stream_error");
          });
        }

        intervalId = window.setInterval(() => {
          if (Date.now() - lastBackendUpdateAtRef.current >= BACKEND_UPDATE_STALE_AFTER_MS) {
            void refreshStatus();
          }
        }, STATUS_FALLBACK_POLL_INTERVAL_MS);
        if (!eventsUrl || typeof window === "undefined" || typeof window.EventSource !== "function") {
          void refreshStatus();
        }
      } catch (error) {
        if (cancelled || abortController.signal.aborted) {
          return;
        }

        const message = toActionableBuildErrorMessage(
          error instanceof Error ? error.message : String(error),
          apiBase
        );
        setBuildError(message);
        setBuildState("error");
        previewStateCallbackRef.current?.("error");
      }
    };

    void run();

    return () => {
      cancelled = true;
      abortController.abort();
      eventSource?.close();
      if (intervalId !== 0) {
        window.clearInterval(intervalId);
      }
    };
  }, [
    apiBase,
    captionProfileId,
    motionTier,
    presentationMode,
    previewTimelineResetVersion,
    sourceFile,
    sourcePlan
  ]);

  useEffect(() => {
    if (!resolvedVideoSrc) {
      return;
    }

    if (nativePreviewErrorMessage) {
      audioStatusCallbackRef.current?.("error", nativePreviewErrorMessage);
      return;
    }

    if (nativePreviewHealth === "ready") {
      audioStatusCallbackRef.current?.("ready", null);
      return;
    }

    audioStatusCallbackRef.current?.("loading", null);
  }, [nativePreviewErrorMessage, nativePreviewHealth, resolvedVideoSrc]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    console.info("[CreativeAudioLivePlayer]", {
      jobId,
      buildState,
      hasSession,
      hasRenderableSession: Boolean(session),
      liveSessionId: liveSessionState?.id ?? null,
      previewStatus: liveSessionState?.previewStatus ?? "idle",
      transcriptStatus: liveSessionState?.transcriptStatus ?? "idle",
      previewLineCount: liveSessionState?.previewLines.length ?? 0,
      previewMotionCueCount: liveSessionState?.previewMotionSequence.length ?? 0,
      transcriptWordCount: liveSessionState?.transcriptWords.length ?? 0,
      backendPreviewPlanExists: Boolean(currentBackendPreviewPlan),
      captionChunksOverrideCount: session?.captionChunks.length ?? 0,
      motionModelOverridePresent: Boolean(session?.motionModel),
      sourceMediaSrcPresent: Boolean(sourceMediaSrc?.trim()),
      sourceVideoSrcPresent: Boolean(resolvedVideoSrc),
      videoSrcPresent: Boolean(resolvedVideoSrc),
      sourceAudioSrcPresent: Boolean(resolvedAudioSrc),
      playbackSourcePending,
      playbackSourceError: playbackSourceError ?? nativePreviewErrorMessage,
      sourceLabel,
      previewTimelineResetVersion,
      renderJobActive: false,
      videoLoaded: nativePreviewHealth === "ready",
      previewRenderer,
      manifestReady: Boolean(previewManifest),
      previewArtifactUrl,
      previewDiagnostics
    });
  }, [
    buildState,
    currentBackendPreviewPlan,
    jobId,
    liveSessionState,
    previewManifest,
    nativePreviewErrorMessage,
    nativePreviewHealth,
    playbackSourceError,
    playbackSourcePending,
    previewRenderer,
    previewTimelineResetVersion,
    previewArtifactUrl,
    previewDiagnostics,
    resolvedAudioSrc,
    resolvedVideoSrc,
    hasSession,
    session,
    sourceLabel,
    sourceMediaSrc
  ]);

  const shellMediaStatus: AudioCreativePreviewAudioStatus = nativePreviewErrorMessage || playbackSourceError
    ? "error"
    : sourcePlan.kind === "missing"
      ? "missing"
      : resolvedVideoSrc
        ? nativePreviewHealth === "ready"
          ? "ready"
          : "loading"
        : playbackSourcePending
          ? "loading"
          : resolvedAudioSrc
            ? "loading"
            : "missing";
  const captionsReadyForRender = liveSessionState?.transcriptStatus === "full_transcript_ready";
  const canRenderNativeVideoStage = Boolean(resolvedVideoSrc);
  const shouldUseDisplayGod = Boolean(
    previewRenderer === "hyperframes" &&
    canRenderNativeVideoStage &&
    captionsReadyForRender &&
    displayTimeline &&
    !displayGodFallbackReason
  );
  const stageStatusMessage = nativePreviewErrorMessage ?? buildError;
  const canRenderArtifact = previewRenderer === "hyperframes" && Boolean(previewArtifactUrl);
  const allowLegacyInteractiveFallback = Boolean(showDebugOverlay && import.meta.env.DEV);
  const enforceArtifactOnly = previewRenderer === "hyperframes" && !allowLegacyInteractiveFallback;
  const shouldRenderVideoArtifact = canRenderArtifact && previewArtifactKind === "video";
  const interactivePreviewSurface = resolveInteractivePreviewSurface({
    previewRenderer,
    canRenderArtifact,
    canRenderNativeVideoStage,
    shouldUseDisplayGod
  });
  const shouldRenderGlobalLoadingShell = shouldRenderBlockingLoader(buildState, interactivePreviewSurface);
  const artifactWidth = previewManifest?.baseVideo.width ??
    liveSessionState?.sourceWidth ??
    browserVideoMetadata?.width ??
    16;
  const artifactHeight = previewManifest?.baseVideo.height ??
    liveSessionState?.sourceHeight ??
    browserVideoMetadata?.height ??
    9;
  const artifactAspectRatio = `${Math.max(1, artifactWidth)} / ${Math.max(1, artifactHeight)}`;
  const artifactFrameStyles: React.CSSProperties = {
    width: "100%",
    aspectRatio: artifactAspectRatio,
    minHeight: 420,
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: 16,
    background: "#020617",
    display: "block"
  };

  if (interactivePreviewSurface === "artifact" && previewArtifactUrl) {
    return (
      <div style={{display: "grid", gap: 10}}>
        <div style={{display: "grid"}}>
          <div style={{gridArea: "1 / 1"}}>
            <ArtifactStage
              url={previewArtifactUrl}
              kind={previewArtifactKind === "video" ? "video" : "html_composition"}
              contentType={previewArtifactContentType}
              width={artifactWidth}
              height={artifactHeight}
              onRuntimeError={(message) => {
                setBuildError(message);
                setBuildState("error");
              }}
              onReady={() => setIsArtifactReady(true)}
            />
          </div>
          {shouldBlockInteractivePreview(buildState) ? (
            <div style={{gridArea: "1 / 1", position: "relative"}}>
              <LoadingShell
                mediaStatus={shellMediaStatus}
                buildState={buildState}
              />
            </div>
          ) : null}
        </div>
        {previewDiagnostics ? (
          <PreviewDiagnosticsPanel diagnostics={previewDiagnostics} />
        ) : null}
        <div style={{fontSize: 12, color: "#94a3b8"}}>
          {previewArtifactKind === "video"
            ? `Artifact kind: video${previewArtifactContentType ? ` (${previewArtifactContentType})` : ""}`
            : `Artifact kind: html composition${previewArtifactContentType ? ` (${previewArtifactContentType})` : ""}`}
        </div>
      </div>
    );
  }

  if (shouldRenderGlobalLoadingShell) {
    return (
      <LoadingShell
        mediaStatus={shellMediaStatus}
        buildState={buildState}
      />
    );
  }

  if (enforceArtifactOnly) {
    return (
      <LoadingShell
        mediaStatus={shellMediaStatus}
        buildState={buildState === "error" ? "building-timeline" : buildState}
      />
    );
  }

  if (buildState === "error" && !canRenderNativeVideoStage) {
    return (
      <ErrorShell
        mediaStatus={shellMediaStatus}
        message={buildError ?? nativePreviewErrorMessage ?? playbackSourceError ?? "Unknown preview build error."}
      />
    );
  }

  if (canRenderNativeVideoStage) {
    return (
      <div style={{display: "grid"}}>
        <div style={{gridArea: "1 / 1"}}>
          {interactivePreviewSurface === "remotion-player" ? (
            <RemotionPreviewPlayer
              videoSrc={resolvedVideoSrc}
              videoMetadata={session?.videoMetadata ?? fallbackVideoMetadata}
              motionModel={session?.motionModel ?? fallbackMotionModel}
              captionChunks={session?.captionChunks ?? []}
              captionProfileId={captionProfileId}
              previewPerformanceMode="balanced"
              livePreviewSession={livePreviewSessionData}
              onHealthChange={(health) => {
                setNativePreviewHealth(health);
              }}
              onErrorMessageChange={(message) => {
                setNativePreviewErrorMessage(message);
                if (message) {
                  audioStatusCallbackRef.current?.("error", message);
                  previewStateCallbackRef.current?.("error");
                }
              }}
            />
          ) : interactivePreviewSurface === "display-god" && displayTimeline ? (
            <DisplayGodPreviewStage
              displayTimeline={displayTimeline}
              manifest={previewManifest}
              previewPerformanceMode="balanced"
              onHealthChange={(health) => {
                setNativePreviewHealth(health);
              }}
              onErrorMessageChange={(message) => {
                setNativePreviewErrorMessage(message);
                if (message) {
                  audioStatusCallbackRef.current?.("error", message);
                  previewStateCallbackRef.current?.("error");
                }
              }}
              onFallbackRequested={(message) => {
                if (import.meta.env.DEV) {
                  console.warn("[CreativeAudioLivePlayer] Display God fallback engaged", {
                    jobId,
                    reason: message
                  });
                }
                setDisplayGodFallbackReason(message);
              }}
            />
          ) : (
            <NativePreviewStage
              videoSrc={resolvedVideoSrc}
              videoMetadata={session?.videoMetadata ?? fallbackVideoMetadata}
              model={session?.motionModel ?? fallbackMotionModel}
              captionProfileId={captionProfileId}
              previewPerformanceMode="balanced"
              suppressCaptions={!captionsReadyForRender}
              onHealthChange={(health) => {
                setNativePreviewHealth(health);
              }}
              onErrorMessageChange={(message) => {
                setNativePreviewErrorMessage(message);
                if (message) {
                  audioStatusCallbackRef.current?.("error", message);
                  previewStateCallbackRef.current?.("error");
                }
              }}
            />
          )}
        </div>
        {(buildState !== "ready" || Boolean(stageStatusMessage)) ? (
          <StageStatusOverlay
            buildState={buildState}
            mediaStatus={shellMediaStatus}
            liveActivity={liveSessionState?.liveActivity ?? null}
            errorMessage={stageStatusMessage}
          />
        ) : null}
      </div>
    );
  }

  if (!session || buildState === "building-timeline" || buildState === "idle") {
    return (
      <LoadingShell
        mediaStatus={shellMediaStatus}
        buildState={buildState}
      />
    );
  }

  return (
    <CreativeLiveAudioPreview
      jobId={jobId}
      audioSrc={resolvedAudioSrc}
      audioPending={playbackSourcePending}
      audioPreparationError={playbackSourceError}
      durationMs={session.durationMs}
      captionChunks={session.captionChunks}
      captionProfileId={captionProfileId}
      creativeTimeline={session.creativeTimeline}
      debugReport={session.debugReport}
      motionModel={session.motionModel}
      videoMetadata={session.videoMetadata}
      showDebugOverlay={showDebugOverlay}
      showPlaybackHud={showPlaybackHud}
      sourceLabel={sourceLabel}
      previewTimelineResetVersion={previewTimelineResetVersion}
      onPreviewStateChange={onPreviewStateChange}
      onAudioStatusChange={(status, errorMessage) => {
        audioStatusCallbackRef.current?.(status, errorMessage);
      }}
    />
  );
};
