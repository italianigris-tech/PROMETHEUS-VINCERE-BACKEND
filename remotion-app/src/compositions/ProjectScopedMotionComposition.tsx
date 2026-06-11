import React, {useEffect, useMemo, useState} from "react";
import {AbsoluteFill, useRemotionEnvironment} from "remotion";
import {loadFont as loadAllura} from "@remotion/google-fonts/Allura";
import {loadFont as loadAnton} from "@remotion/google-fonts/Anton";
import {loadFont as loadBebasNeue} from "@remotion/google-fonts/BebasNeue";
import {loadFont as loadBodoniModa} from "@remotion/google-fonts/BodoniModa";
import {loadFont as loadCinzel} from "@remotion/google-fonts/Cinzel";
import {loadFont as loadCormorantGaramond} from "@remotion/google-fonts/CormorantGaramond";
import {loadFont as loadGreatVibes} from "@remotion/google-fonts/GreatVibes";
import {loadFont as loadLeagueGothic} from "@remotion/google-fonts/LeagueGothic";
import {loadFont as loadOswald} from "@remotion/google-fonts/Oswald";
import {loadFont as loadPlayfairDisplay} from "@remotion/google-fonts/PlayfairDisplay";
import {loadFont as loadTeko} from "@remotion/google-fonts/Teko";
import {loadFont as loadDMSans} from "@remotion/google-fonts/DMSans";
import {loadFont as loadDMSerifDisplay} from "@remotion/google-fonts/DMSerifDisplay";

import {CinematicCaptionOverlay} from "../components/CinematicCaptionOverlay";
import {LongformDockedInverseOverlay} from "../components/LongformDockedInverseOverlay";
import {LongformSemanticSidecallOverlay} from "../components/LongformSemanticSidecallOverlay";
import {LongformWordByWordOverlay} from "../components/LongformWordByWordOverlay";
import {
  buildMotionCompositionModel,
  CaptionFocusVignette,
  LongformTypographyBiasOverlay,
  Motion3DOverlay,
  MotionChoreographyOverlay,
  MotionAssetOverlay,
  MotionMatteForeground,
  MotionVideoBackdrop
} from "../components/MotionGraphicsEngine";
import {MotionBackgroundOverlay} from "../components/MotionBackgroundOverlay";
import {CinematicPiPOverlay} from "../components/CinematicPiPOverlay";
import {MotionTransitionOverlay} from "../components/MotionTransitionOverlay";
import {MotionSoundDesign} from "../components/MotionSoundDesign";
import {MotionShowcaseOverlay} from "../components/MotionShowcaseOverlay";
import {
  SvgCaptionOverlay,
  getSvgCaptionChunkFontFamilies,
  isSvgCaptionChunk
} from "../components/SvgCaptionOverlay";
import reelVideoMetadata from "../data/video.metadata.json" with {type: "json"};
import {loadEditorialCaptionFonts} from "../lib/cinematic-typography/editorial-fonts";
import {deterministicChunkWords, mapWordChunksToCaptionChunks} from "../lib/caption-chunker";
import {LONGFORM_SAFE_MOTION_ASSET_FAMILIES} from "../lib/motion-platform/asset-manifests";
import {
  resolveCaptionEditorialDecision
} from "../lib/motion-platform/caption-editorial-engine";
import {
  getDefaultCaptionProfileIdForPresentationMode
} from "../lib/presentation-presets";
import {resolvePresentationMode} from "../lib/presentation-mode";
import {
  getLongformCaptionRenderMode,
  normalizeCaptionStyleProfileId
} from "../lib/stylebooks/caption-style-profiles";
import {
  buildProjectScopedStudioTypographySampleCaptionChunks,
  getProjectScopedStudioSampleAsset,
  getProjectScopedStudioSampleIds,
  PROJECT_SCOPED_STUDIO_ASSET_BINDING_MESSAGE,
  PROJECT_SCOPED_STUDIO_SAMPLE_PROP_GUIDANCE,
  PROJECT_SCOPED_STUDIO_TYPOGRAPHY_SAMPLE_PROP_GUIDANCE,
  PROJECT_SCOPED_STUDIO_VIDEO_SRC_PROP_GUIDANCE
} from "./project-scoped-studio-defaults";
import type {
  CaptionChunk,
  CaptionStyleProfileId,
  CaptionVerticalBias,
  MotionGradeProfileId,
  MotionMatteMode,
  MotionTier,
  Motion3DMode,
  CinematicPiPLayoutPreset,
  PreviewPerformanceMode,
  PresentationModeSetting,
  TranscribedWord,
  VideoMetadata,
  TransitionOverlayMode
} from "../lib/types";
import type {MotionCompositionModel} from "../lib/motion-platform/scene-engine";
import type {TransitionOverlayRules} from "../lib/motion-platform/transition-overlay-config";
import "../styles/cinematic.css";

const fontLoadOptions = {
  subsets: ["latin"] as ("latin")[],
  ignoreTooManyRequestsWarning: true
};

loadAllura("normal", fontLoadOptions);
loadAnton("normal", fontLoadOptions);
loadBebasNeue("normal", fontLoadOptions);
loadBodoniModa("normal", fontLoadOptions);
loadCinzel("normal", fontLoadOptions);
loadCormorantGaramond("normal", fontLoadOptions);
loadGreatVibes("normal", fontLoadOptions);
loadLeagueGothic("normal", fontLoadOptions);
loadOswald("normal", fontLoadOptions);
loadPlayfairDisplay("normal", fontLoadOptions);
loadTeko("normal", fontLoadOptions);
loadDMSans("normal", fontLoadOptions);
loadDMSerifDisplay("normal", fontLoadOptions);
loadEditorialCaptionFonts();

export type ProjectScopedMotionCompositionProps = {
  readonly videoSrc?: string | null;
  readonly studioSampleId?: string;
  readonly studioTypographySample?: boolean;
  readonly videoMetadata?: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames">;
  readonly livePreviewSession?: ProjectScopedLivePreviewSessionData | null;
  readonly presentationMode?: PresentationModeSetting;
  readonly captionChunksOverride?: CaptionChunk[];
  readonly motionTier?: MotionTier | "auto";
  readonly gradeProfileId?: MotionGradeProfileId | "auto";
  readonly transitionPresetId?: string;
  readonly transitionOverlayMode?: TransitionOverlayMode;
  readonly transitionOverlayConfig?: Partial<TransitionOverlayRules>;
  readonly motion3DMode?: Motion3DMode;
  readonly matteMode?: MotionMatteMode | "auto";
  readonly captionProfileId?: CaptionStyleProfileId | "auto";
  readonly captionBias?: CaptionVerticalBias | "auto";
  readonly hideCaptionOverlays?: boolean;
  readonly pipMode?: "off" | "showcase";
  readonly pipLayoutPreset?: CinematicPiPLayoutPreset;
  readonly pipHeadlineText?: string;
  readonly pipSubtextText?: string;
  readonly stabilizePreviewTimeline?: boolean;
  readonly previewTimelineResetVersion?: number;
  readonly previewPerformanceMode?: PreviewPerformanceMode;
  readonly respectPreviewPerformanceModeDuringRender?: boolean;
  readonly motionModelOverride?: MotionCompositionModel | null;
  readonly debugMotionArtifacts?: boolean;
  readonly usePreviewProxyForVideoSrc?: boolean;
};

export type ProjectScopedLivePreviewSessionData = {
  readonly sessionId: string;
  readonly status: string;
  readonly previewStatus: string;
  readonly transcriptStatus: string;
  readonly analysisStatus: string;
  readonly motionGraphicsStatus: string;
  readonly renderStatus: string;
  readonly sourceLabel: string | null;
  readonly sourceFilename: string | null;
  readonly sourceHasVideo: boolean;
  readonly sourceWidth: number | null;
  readonly sourceHeight: number | null;
  readonly sourceFps: number | null;
  readonly sourceDurationMs: number | null;
  readonly liveActivity?: {
    activityCode: string;
    detail: string;
    heartbeat: string;
    lastActiveAt: string;
  } | null;
  readonly previewLines: string[];
  readonly previewMotionSequence: Array<{
    cueId: string;
    text: string;
    startMs: number;
    durationMs: number;
    lineIndex: number;
  }>;
  readonly transcriptWords: Array<{
    text: string;
    start_ms: number;
    end_ms: number;
    confidence?: number;
  }>;
};

const mapProjectScopedWordsToCaptionChunks = (
  words: TranscribedWord[],
  captionProfileId: CaptionStyleProfileId
): CaptionChunk[] => {
  if (words.length === 0) {
    return [];
  }

  const deterministicChunks = deterministicChunkWords(words, {
    profileId: captionProfileId
  });

  return mapWordChunksToCaptionChunks(deterministicChunks, undefined, {
    profileId: captionProfileId
  });
};

const buildProjectScopedSyntheticWordsFromText = ({
  text,
  startMs,
  endMs
}: {
  text: string;
  startMs: number;
  endMs: number;
}): TranscribedWord[] => {
  const tokens = text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return [];
  }

  const durationMs = Math.max(320, endMs - startMs);
  const sliceMs = Math.max(90, Math.round(durationMs / tokens.length));

  return tokens.map((word, index) => {
    const wordStartMs = startMs + index * sliceMs;
    const wordEndMs = index === tokens.length - 1 ? endMs : Math.min(endMs, wordStartMs + sliceMs);

    return {
      text: word,
      startMs: wordStartMs,
      endMs: Math.max(wordStartMs + 40, wordEndMs)
    };
  });
};

export const resolveProjectScopedCaptionChunks = ({
  captionChunksOverride,
  livePreviewSession,
  captionProfileId,
  studioTypographySample
}: {
  captionChunksOverride?: CaptionChunk[];
  livePreviewSession?: ProjectScopedLivePreviewSessionData | null;
  captionProfileId: CaptionStyleProfileId;
  studioTypographySample?: boolean;
}): CaptionChunk[] => {
  if (Array.isArray(captionChunksOverride) && captionChunksOverride.length > 0) {
    return captionChunksOverride;
  }

  const transcriptWords = (livePreviewSession?.transcriptWords ?? [])
    .filter((word) => word.text.trim().length > 0)
    .map<TranscribedWord>((word) => ({
      text: word.text.trim(),
      startMs: Math.max(0, Math.round(word.start_ms)),
      endMs: Math.max(Math.round(word.start_ms), Math.round(word.end_ms)),
      confidence: word.confidence
    }));

  if (transcriptWords.length > 0) {
    return mapProjectScopedWordsToCaptionChunks(transcriptWords, captionProfileId);
  }

  const previewMotionWords = (livePreviewSession?.previewMotionSequence ?? []).flatMap((cue) => {
    const cueText = cue.text.trim();
    if (!cueText) {
      return [];
    }

    return buildProjectScopedSyntheticWordsFromText({
      text: cueText,
      startMs: Math.max(0, cue.startMs),
      endMs: Math.max(cue.startMs + 240, cue.startMs + cue.durationMs)
    });
  });

  if (previewMotionWords.length > 0) {
    return mapProjectScopedWordsToCaptionChunks(previewMotionWords, captionProfileId);
  }

  const previewLineWords = (livePreviewSession?.previewLines ?? []).flatMap((line, index) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      return [];
    }

    const startMs = index * 900;
    return buildProjectScopedSyntheticWordsFromText({
      text: trimmedLine,
      startMs,
      endMs: startMs + 760
    });
  });

  if (previewLineWords.length > 0) {
    return mapProjectScopedWordsToCaptionChunks(previewLineWords, captionProfileId);
  }

  if (studioTypographySample) {
    return buildProjectScopedStudioTypographySampleCaptionChunks(captionProfileId);
  }

  return [];
};

export type ProjectScopedTypographyDiagnostics = {
  captionChunksCount: number;
  activeCaptionRenderer: "hidden" | "word-by-word" | "docked-inverse" | "semantic-sidecall" | "cinematic" | "svg" | "none";
  requestedFontFamilies: string[];
  activeFallbackFamily: string | null;
  fontRuntimeLoaded: boolean;
  warning: string | null;
};

export const resolveProjectScopedTypographyDiagnostics = ({
  captionChunks,
  activeCaptionRenderer,
  fontRuntimeLoaded,
  fontRuntimeWarning,
  requestedFontFamilies
}: {
  captionChunks: CaptionChunk[];
  activeCaptionRenderer: ProjectScopedTypographyDiagnostics["activeCaptionRenderer"];
  fontRuntimeLoaded: boolean;
  fontRuntimeWarning: string | null;
  requestedFontFamilies: string[];
}): ProjectScopedTypographyDiagnostics => {
  return {
    captionChunksCount: captionChunks.length,
    activeCaptionRenderer,
    requestedFontFamilies,
    activeFallbackFamily: requestedFontFamilies[0] ?? null,
    fontRuntimeLoaded,
    warning: fontRuntimeWarning
  };
};

export const resolveProjectScopedExplicitDataState = ({
  captionChunksOverride,
  motionModelOverride
}: {
  captionChunksOverride?: CaptionChunk[];
  motionModelOverride?: MotionCompositionModel | null;
}) => {
  const captionChunksCount = Array.isArray(captionChunksOverride) ? captionChunksOverride.length : 0;
  const motionChunksCount = Array.isArray(motionModelOverride?.chunks) ? motionModelOverride.chunks.length : 0;

  return {
    captionChunksCount,
    motionChunksCount,
    hasExplicitCaptions: captionChunksCount > 0,
    hasExplicitMotion: motionChunksCount > 0
  };
};

export const resolveProjectScopedCaptionRuntimeDiagnostics = ({
  presentationMode,
  hideCaptionOverlays,
  longformCaptionRenderMode,
  captionChunks,
  cinematicCaptionChunks,
  svgCaptionChunks
}: {
  presentationMode: PresentationModeSetting;
  hideCaptionOverlays: boolean;
  longformCaptionRenderMode: string;
  captionChunks: CaptionChunk[];
  cinematicCaptionChunks: CaptionChunk[];
  svgCaptionChunks: CaptionChunk[];
}): {
  activeCaptionRenderer: "hidden" | "word-by-word" | "docked-inverse" | "semantic-sidecall" | "cinematic" | "svg" | "none";
  captionDomNodesExpected: boolean;
} => {
  if (hideCaptionOverlays) {
    return {
      activeCaptionRenderer: "hidden",
      captionDomNodesExpected: false
    };
  }

  if (presentationMode === "long-form") {
    if (longformCaptionRenderMode === "svg") {
      return {
        activeCaptionRenderer: "svg",
        captionDomNodesExpected: svgCaptionChunks.length > 0
      };
    }

    if (longformCaptionRenderMode === "word-by-word") {
      return {
        activeCaptionRenderer: "word-by-word",
        captionDomNodesExpected: captionChunks.some((chunk) => chunk.words.length > 0)
      };
    }

    if (longformCaptionRenderMode === "docked-inverse") {
      return {
        activeCaptionRenderer: "docked-inverse",
        captionDomNodesExpected: captionChunks.length > 0
      };
    }

    if (longformCaptionRenderMode === "semantic-sidecall") {
      return {
        activeCaptionRenderer: "semantic-sidecall",
        captionDomNodesExpected: captionChunks.length > 0
      };
    }

    return {
      activeCaptionRenderer: "none",
      captionDomNodesExpected: false
    };
  }

  if (cinematicCaptionChunks.length > 0) {
    return {
      activeCaptionRenderer: "cinematic",
      captionDomNodesExpected: true
    };
  }

  if (svgCaptionChunks.length > 0) {
    return {
      activeCaptionRenderer: "svg",
      captionDomNodesExpected: true
    };
  }

  return {
    activeCaptionRenderer: "none",
    captionDomNodesExpected: false
  };
};

export const resolveProjectScopedMotionLayerVisibility = ({
  debugMotionArtifacts,
  pipMode,
  previewPerformanceMode
}: {
  debugMotionArtifacts: boolean;
  pipMode: "off" | "showcase";
  previewPerformanceMode: PreviewPerformanceMode;
}) => {
  const showPiPShowcase = pipMode === "showcase";
  const motionArtifactsEnabled = debugMotionArtifacts || showPiPShowcase;
  const hideStandardArtifacts = showPiPShowcase || !motionArtifactsEnabled;

  return {
    showPiPShowcase,
    showBackgroundOverlay: !hideStandardArtifacts && previewPerformanceMode !== "turbo",
    showMotionAssetOverlay: !hideStandardArtifacts && previewPerformanceMode !== "turbo",
    showMatteForeground: !hideStandardArtifacts && previewPerformanceMode === "full",
    showShowcaseOverlay: !hideStandardArtifacts && previewPerformanceMode !== "turbo",
    showTransitionOverlay: !showPiPShowcase && motionArtifactsEnabled,
    showSoundDesign: motionArtifactsEnabled && previewPerformanceMode === "full"
  };
};

export type ProjectScopedVideoValidationState = "missing" | "checking" | "ready" | "error";

export const normalizeProjectScopedVideoSrc = (videoSrc?: string | null): string | null => {
  if (typeof videoSrc !== "string") {
    return null;
  }

  const trimmed = videoSrc.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeProjectScopedStudioSampleId = (studioSampleId?: string | null): string | null => {
  if (typeof studioSampleId !== "string") {
    return null;
  }

  const trimmed = studioSampleId.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const resolveProjectScopedStudioVideoBinding = ({
  videoSrc,
  studioSampleId
}: {
  videoSrc?: string | null;
  studioSampleId?: string | null;
}) => {
  const normalizedVideoSrc = normalizeProjectScopedVideoSrc(videoSrc);
  const normalizedStudioSampleId = normalizeProjectScopedStudioSampleId(studioSampleId);
  const resolvedStudioSample = normalizedVideoSrc
    ? null
    : getProjectScopedStudioSampleAsset(normalizedStudioSampleId);
  const resolvedVideoSrc = normalizedVideoSrc ?? resolvedStudioSample?.videoSrc ?? null;
  const invalidStudioSampleId =
    normalizedVideoSrc || !normalizedStudioSampleId || resolvedStudioSample
      ? null
      : normalizedStudioSampleId;

  return {
    normalizedVideoSrc,
    normalizedStudioSampleId,
    resolvedStudioSample,
    resolvedVideoSrc,
    invalidStudioSampleId
  };
};

export const resolveProjectScopedPlaybackVideoSrc = ({
  videoSrc,
  isRendering,
  usePreviewProxyForVideoSrc
}: {
  videoSrc?: string | null;
  isRendering: boolean;
  usePreviewProxyForVideoSrc: boolean;
}): string | null => {
  const normalizedVideoSrc = normalizeProjectScopedVideoSrc(videoSrc);
  if (!normalizedVideoSrc) {
    return null;
  }

  if (isRendering || !usePreviewProxyForVideoSrc) {
    return normalizedVideoSrc;
  }

  if (
    normalizedVideoSrc.includes("?") ||
    /\.preview\.mp4$/i.test(normalizedVideoSrc) ||
    !/\.mp4$/i.test(normalizedVideoSrc)
  ) {
    return normalizedVideoSrc;
  }

  return normalizedVideoSrc.replace(/\.mp4$/i, ".preview.mp4");
};

export const buildProjectScopedDiagnosticWarnings = ({
  videoSrc,
  studioSampleId,
  invalidStudioSampleId,
  videoValidationState,
  videoValidationMessage,
  captionChunks,
  fontRuntimeWarning,
  diagnosticSurface = "studio"
}: {
  videoSrc: string | null;
  studioSampleId?: string | null;
  invalidStudioSampleId?: string | null;
  videoValidationState: ProjectScopedVideoValidationState;
  videoValidationMessage: string | null;
  captionChunks: CaptionChunk[];
  fontRuntimeWarning: string | null;
  diagnosticSurface?: "studio" | "live-preview";
}): string[] => {
  const warnings: string[] = [];

  if (videoValidationState === "missing") {
    warnings.push(PROJECT_SCOPED_STUDIO_ASSET_BINDING_MESSAGE);
    if (invalidStudioSampleId) {
      warnings.push(
        `Unknown studioSampleId "${invalidStudioSampleId}". Valid sample ids: ${getProjectScopedStudioSampleIds().join(", ")}.`
      );
    }
    warnings.push(
      "No video source provided. Provide videoSrc or studioSampleId in props to preview project-scoped composition."
    );
  }

  if (videoValidationState === "checking" && (videoSrc?.trim() || studioSampleId?.trim())) {
    warnings.push("Validating video source before mounting the preview canvas.");
  }

  if (videoValidationState === "error") {
    warnings.push(videoValidationMessage ?? "Video source failed to load.");
  }

  if (captionChunks.length === 0) {
    warnings.push(
      diagnosticSurface === "live-preview"
        ? "No caption chunks are available yet. Waiting for session.transcriptWords, previewMotionSequence, or previewLines before rendering typography."
        : "No caption chunks are loaded. Paste real caption data into the Studio props panel."
    );
  }

  if (fontRuntimeWarning) {
    warnings.push(fontRuntimeWarning);
  }

  return warnings;
};

const DiagnosticCanvas: React.FC<{
  videoValidationState: ProjectScopedVideoValidationState;
  diagnosticWarnings: string[];
}> = ({videoValidationState, diagnosticWarnings}) => {
  if (videoValidationState === "ready") {
    return null;
  }

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "radial-gradient(circle at top, rgba(37, 99, 235, 0.18), rgba(2, 6, 23, 0.96) 58%)"
      }}
    >
      <div
        style={{
          width: "min(720px, calc(100% - 48px))",
          padding: "24px 26px",
          borderRadius: 18,
          border: "1px solid rgba(148, 163, 184, 0.24)",
          background: "rgba(15, 23, 42, 0.72)",
          boxShadow: "0 28px 90px rgba(0, 0, 0, 0.3)",
          color: "#e2e8f0",
          fontFamily: "\"DM Sans\", sans-serif"
        }}
      >
        <div style={{fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#93c5fd"}}>
          Project-Scoped Studio Preview
        </div>
        <div style={{marginTop: 10, fontSize: 28, fontWeight: 700, lineHeight: 1.12}}>
          {videoValidationState === "checking"
            ? "Validating video source"
            : videoValidationState === "error"
              ? "Video source failed to load"
              : "No video source provided"}
        </div>
        <div style={{marginTop: 14, display: "grid", gap: 10, fontSize: 15, lineHeight: 1.5, color: "#cbd5e1"}}>
          {diagnosticWarnings.map((warning, index) => (
            <div key={`${index}-${warning}`}>{warning}</div>
          ))}
        </div>
        <div style={{marginTop: 18, fontSize: 13, lineHeight: 1.5, color: "#94a3b8"}}>
          Studio props examples:
          <pre
            style={{
              marginTop: 10,
              marginBottom: 8,
              padding: 12,
              borderRadius: 12,
              background: "rgba(2, 6, 23, 0.72)",
              border: "1px solid rgba(148, 163, 184, 0.16)",
              color: "#e2e8f0",
              whiteSpace: "pre-wrap"
            }}
          >{PROJECT_SCOPED_STUDIO_TYPOGRAPHY_SAMPLE_PROP_GUIDANCE}</pre>
          <div>or:</div>
          <pre
            style={{
              marginTop: 8,
              marginBottom: 8,
              padding: 12,
              borderRadius: 12,
              background: "rgba(2, 6, 23, 0.72)",
              border: "1px solid rgba(148, 163, 184, 0.16)",
              color: "#e2e8f0",
              whiteSpace: "pre-wrap"
            }}
          >{PROJECT_SCOPED_STUDIO_SAMPLE_PROP_GUIDANCE}</pre>
          <div>or:</div>
          <pre
            style={{
              marginTop: 8,
              marginBottom: 0,
              padding: 12,
              borderRadius: 12,
              background: "rgba(2, 6, 23, 0.72)",
              border: "1px solid rgba(148, 163, 184, 0.16)",
              color: "#e2e8f0",
              whiteSpace: "pre-wrap"
            }}
          >{PROJECT_SCOPED_STUDIO_VIDEO_SRC_PROP_GUIDANCE}</pre>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const StudioSampleBadge: React.FC<{label: string}> = ({label}) => {
  return (
    <AbsoluteFill style={{pointerEvents: "none", zIndex: 24}}>
      <div
        style={{
          position: "absolute",
          left: 18,
          top: 18,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(147, 197, 253, 0.28)",
          background: "rgba(15, 23, 42, 0.78)",
          color: "#dbeafe",
          fontFamily: "\"DM Sans\", sans-serif",
          fontSize: 12,
          lineHeight: 1.4,
          boxShadow: "0 14px 40px rgba(0, 0, 0, 0.28)"
        }}
      >
        {`Studio sample: ${label}`}
      </div>
    </AbsoluteFill>
  );
};

const DiagnosticBadge: React.FC<{messages: string[]}> = ({messages}) => {
  if (messages.length === 0) {
    return null;
  }

  return (
    <AbsoluteFill style={{pointerEvents: "none", zIndex: 30}}>
      <div
        style={{
          position: "absolute",
          right: 18,
          bottom: 18,
          maxWidth: 420,
          display: "grid",
          gap: 8
        }}
      >
        {messages.map((message, index) => (
          <div
            key={`${index}-${message}`}
            style={{
              padding: "10px 12px",
              border: "1px solid rgba(248, 113, 113, 0.28)",
              borderRadius: 12,
              background: "rgba(69, 10, 10, 0.74)",
              color: "#fecaca",
              fontFamily: "\"DM Sans\", sans-serif",
              fontSize: 12,
              lineHeight: 1.45,
              boxShadow: "0 14px 40px rgba(0, 0, 0, 0.28)"
            }}
          >
            {message}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const ProjectScopedMotionComposition: React.FC<ProjectScopedMotionCompositionProps> = ({
  videoSrc,
  studioSampleId,
  studioTypographySample = false,
  videoMetadata = reelVideoMetadata,
  livePreviewSession = null,
  presentationMode = "auto",
  captionChunksOverride,
  motionTier = "auto",
  gradeProfileId,
  transitionPresetId = "auto",
  transitionOverlayMode = "standard",
  transitionOverlayConfig,
  motion3DMode = "off",
  matteMode = "auto",
  captionProfileId,
  captionBias = "auto",
  hideCaptionOverlays = false,
  pipMode = "off",
  pipLayoutPreset,
  pipHeadlineText,
  pipSubtextText,
  stabilizePreviewTimeline = false,
  previewTimelineResetVersion = 0,
  previewPerformanceMode = "full",
  respectPreviewPerformanceModeDuringRender = false,
  motionModelOverride = null,
  debugMotionArtifacts = false,
  usePreviewProxyForVideoSrc = false
}) => {
  const remotionEnvironment = useRemotionEnvironment();
  const useRealtimePreviewPath = stabilizePreviewTimeline && !remotionEnvironment.isRendering;
  const resolvedPreviewPerformanceMode = remotionEnvironment.isRendering && !respectPreviewPerformanceModeDuringRender
    ? "full"
    : previewPerformanceMode;
  const resolvedPresentationMode = resolvePresentationMode(videoMetadata, presentationMode);
  const resolvedVideoBinding = useMemo(
    () => resolveProjectScopedStudioVideoBinding({
      videoSrc,
      studioSampleId
    }),
    [studioSampleId, videoSrc]
  );
  const interactivePreviewVideoSrc = useMemo(() => resolveProjectScopedPlaybackVideoSrc({
    videoSrc: resolvedVideoBinding.resolvedVideoSrc,
    isRendering: remotionEnvironment.isRendering,
    usePreviewProxyForVideoSrc
  }), [remotionEnvironment.isRendering, resolvedVideoBinding.resolvedVideoSrc, usePreviewProxyForVideoSrc]);
  const resolvedCaptionProfileId = normalizeCaptionStyleProfileId(
    captionProfileId && captionProfileId !== "auto"
      ? captionProfileId
      : getDefaultCaptionProfileIdForPresentationMode(resolvedPresentationMode)
  );
  const explicitDataState = useMemo(() => resolveProjectScopedExplicitDataState({
    captionChunksOverride,
    motionModelOverride
  }), [captionChunksOverride, motionModelOverride]);
  const captionChunks = useMemo(
    () => resolveProjectScopedCaptionChunks({
      captionChunksOverride,
      livePreviewSession,
      captionProfileId: resolvedCaptionProfileId,
      studioTypographySample
    }),
    [captionChunksOverride, livePreviewSession, resolvedCaptionProfileId, studioTypographySample]
  );
  const longformCaptionRenderMode = useMemo(
    () => getLongformCaptionRenderMode(resolvedCaptionProfileId),
    [resolvedCaptionProfileId]
  );
  const [videoValidation, setVideoValidation] = useState<{
    state: ProjectScopedVideoValidationState;
    message: string | null;
  }>({
    state: resolvedVideoBinding.resolvedVideoSrc ? (remotionEnvironment.isRendering ? "ready" : "checking") : "missing",
    message: null
  });
  const svgCaptionChunks = useMemo(
    () => captionChunks.filter((chunk) => isSvgCaptionChunk(chunk)),
    [captionChunks]
  );
  const cinematicCaptionChunks = useMemo(
    () => captionChunks.filter((chunk) => !isSvgCaptionChunk(chunk)),
    [captionChunks]
  );
  const motionModel = useMemo(
    () => motionModelOverride ?? buildMotionCompositionModel({
      chunks: captionChunks,
      tier: motionTier,
      fps: videoMetadata.fps,
      videoMetadata,
      captionProfileId: resolvedCaptionProfileId,
      gradeProfileId,
      transitionPresetId,
      transitionOverlayMode,
      transitionOverlayConfig,
      motion3DMode,
      matteMode,
      captionBias,
      suppressAmbientAssets: !explicitDataState.hasExplicitMotion,
      ambientAssetFamilies: resolvedPresentationMode === "long-form" && explicitDataState.hasExplicitMotion
        ? LONGFORM_SAFE_MOTION_ASSET_FAMILIES
        : undefined
    }),
    [captionBias, captionChunks, explicitDataState.hasExplicitMotion, gradeProfileId, matteMode, motion3DMode, motionModelOverride, motionTier, resolvedCaptionProfileId, resolvedPresentationMode, transitionOverlayConfig, transitionOverlayMode, transitionPresetId, videoMetadata]
  );
  const captionEditorialContext = useMemo(() => ({
    gradeProfile: motionModel.gradeProfile,
    backgroundOverlayPlan: motionModel.backgroundOverlayPlan,
    captionBias: motionModel.captionBias,
    motionTier: motionModel.tier,
    compositionCombatPlan: motionModel.compositionCombatPlan
  }), [
    motionModel.backgroundOverlayPlan,
    motionModel.captionBias,
    motionModel.compositionCombatPlan,
    motionModel.gradeProfile,
    motionModel.tier
  ]);
  const captionRuntimeDiagnostics = useMemo(() => resolveProjectScopedCaptionRuntimeDiagnostics({
    presentationMode: resolvedPresentationMode,
    hideCaptionOverlays,
    longformCaptionRenderMode,
    captionChunks,
    cinematicCaptionChunks,
    svgCaptionChunks
  }), [
    captionChunks,
    cinematicCaptionChunks,
    hideCaptionOverlays,
    longformCaptionRenderMode,
    resolvedPresentationMode,
    svgCaptionChunks
  ]);
  const firstCaptionEditorialDecision = useMemo(() => {
    const firstChunk = captionChunks[0];
    if (!firstChunk) {
      return null;
    }

    return resolveCaptionEditorialDecision({
      chunk: firstChunk,
      ...captionEditorialContext,
      captionProfileId: resolvedCaptionProfileId,
      presentationMode: resolvedPresentationMode,
      currentTimeMs: firstChunk.startMs
    });
  }, [
    captionChunks,
    captionEditorialContext,
    resolvedCaptionProfileId,
    resolvedPresentationMode
  ]);
  const requestedTypographyFamilies = useMemo(() => {
    if (captionRuntimeDiagnostics.activeCaptionRenderer === "svg") {
      return getSvgCaptionChunkFontFamilies(svgCaptionChunks[0] ?? captionChunks[0] ?? null);
    }

    if (!firstCaptionEditorialDecision) {
      return [];
    }

    return [
      firstCaptionEditorialDecision.fontSelection.palette.primaryFamilyName,
      firstCaptionEditorialDecision.fontSelection.palette.supportFamily
    ];
  }, [
    captionChunks,
    captionRuntimeDiagnostics.activeCaptionRenderer,
    firstCaptionEditorialDecision,
    svgCaptionChunks
  ]);
  const typographyDiagnostics = useMemo(() => resolveProjectScopedTypographyDiagnostics({
    captionChunks,
    activeCaptionRenderer: captionRuntimeDiagnostics.activeCaptionRenderer,
    fontRuntimeLoaded: true,
    fontRuntimeWarning: null,
    requestedFontFamilies: requestedTypographyFamilies
  }), [
    captionChunks,
    captionRuntimeDiagnostics.activeCaptionRenderer,
    requestedTypographyFamilies,
    resolvedCaptionProfileId,
    studioTypographySample
  ]);
  const layerVisibility = useMemo(() => resolveProjectScopedMotionLayerVisibility({
    debugMotionArtifacts,
    pipMode,
    previewPerformanceMode: resolvedPreviewPerformanceMode
  }), [debugMotionArtifacts, pipMode, resolvedPreviewPerformanceMode]);
  const shouldRenderCaptionLayer = captionRuntimeDiagnostics.captionDomNodesExpected;
  const shouldRenderMotionArtifacts = explicitDataState.hasExplicitMotion || debugMotionArtifacts;

  useEffect(() => {
    if (remotionEnvironment.isRendering) {
      setVideoValidation({
        state: resolvedVideoBinding.resolvedVideoSrc ? "ready" : "missing",
        message: resolvedVideoBinding.resolvedVideoSrc
          ? null
          : "No video source provided. Provide videoSrc or studioSampleId in props to preview project-scoped composition."
      });
      return;
    }

    if (!interactivePreviewVideoSrc) {
      setVideoValidation({
        state: "missing",
        message: "No video source provided. Provide videoSrc or studioSampleId in props to preview project-scoped composition."
      });
      return;
    }

    if (typeof document === "undefined") {
      setVideoValidation({
        state: "checking",
        message: null
      });
      return;
    }

    let cancelled = false;
    const probeVideo = document.createElement("video");
    const completeWithReady = () => {
      if (cancelled) {
        return;
      }

      setVideoValidation({
        state: "ready",
        message: null
      });
    };
    const completeWithError = () => {
      if (cancelled) {
        return;
      }

      const errorCode = probeVideo.error?.code;
      setVideoValidation({
        state: "error",
        message: `Video source failed to load: ${interactivePreviewVideoSrc}${errorCode ? ` (Code ${errorCode})` : ""}`
      });
    };

    setVideoValidation({
      state: "checking",
      message: null
    });

    probeVideo.preload = "metadata";
    probeVideo.muted = true;
    probeVideo.src = interactivePreviewVideoSrc;
    probeVideo.addEventListener("loadedmetadata", completeWithReady, {once: true});
    probeVideo.addEventListener("canplay", completeWithReady, {once: true});
    probeVideo.addEventListener("error", completeWithError, {once: true});
    probeVideo.load();

    return () => {
      cancelled = true;
      probeVideo.removeAttribute("src");
      probeVideo.load();
    };
  }, [interactivePreviewVideoSrc, remotionEnvironment.isRendering, resolvedVideoBinding.resolvedVideoSrc]);

  const diagnosticWarnings = useMemo(() => buildProjectScopedDiagnosticWarnings({
    videoSrc: resolvedVideoBinding.resolvedVideoSrc,
    studioSampleId: resolvedVideoBinding.normalizedStudioSampleId,
    invalidStudioSampleId: resolvedVideoBinding.invalidStudioSampleId,
    videoValidationState: videoValidation.state,
    videoValidationMessage: videoValidation.message,
    captionChunks,
    fontRuntimeWarning: typographyDiagnostics.warning,
    diagnosticSurface: livePreviewSession ? "live-preview" : "studio"
  }), [
    captionChunks,
    livePreviewSession,
    resolvedVideoBinding.invalidStudioSampleId,
    resolvedVideoBinding.normalizedStudioSampleId,
    resolvedVideoBinding.resolvedVideoSrc,
    typographyDiagnostics.warning,
    videoValidation.message,
    videoValidation.state
  ]);
  const hasPlayableVideo = videoValidation.state === "ready" && Boolean(interactivePreviewVideoSrc);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    if (captionChunks.length > 0 || explicitDataState.motionChunksCount > 0 || debugMotionArtifacts) {
      return;
    }

    console.info("[ProjectScopedMotionComposition] empty-state", {
      videoSrcPresent: Boolean(resolvedVideoBinding.resolvedVideoSrc),
      studioSampleId: resolvedVideoBinding.normalizedStudioSampleId,
      captionChunksCount: captionChunks.length,
      motionChunksCount: explicitDataState.motionChunksCount,
      debugMotionArtifacts
    });
  }, [
    captionChunks.length,
    debugMotionArtifacts,
    explicitDataState.motionChunksCount,
    resolvedVideoBinding.normalizedStudioSampleId,
    resolvedVideoBinding.resolvedVideoSrc,
    videoValidation.state
  ]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    console.info("[ProjectScopedMotionComposition] typography", {
      captionChunksCount: typographyDiagnostics.captionChunksCount,
      activeCaptionRenderer: typographyDiagnostics.activeCaptionRenderer,
      requestedFontFamilies: typographyDiagnostics.requestedFontFamilies,
      activeFallbackFamily: typographyDiagnostics.activeFallbackFamily,
      fontRuntimeLoaded: typographyDiagnostics.fontRuntimeLoaded,
      warning: typographyDiagnostics.warning
    });
  }, [
    typographyDiagnostics.activeCaptionRenderer,
    typographyDiagnostics.activeFallbackFamily,
    typographyDiagnostics.captionChunksCount,
    typographyDiagnostics.fontRuntimeLoaded,
    typographyDiagnostics.requestedFontFamilies,
    typographyDiagnostics.warning
  ]);

  return (
    <AbsoluteFill className="dg-stage">
      {hasPlayableVideo && interactivePreviewVideoSrc ? (
        <MotionVideoBackdrop
          model={motionModel}
          videoSrc={interactivePreviewVideoSrc}
          presentationMode={resolvedPresentationMode}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
          previewPerformanceMode={resolvedPreviewPerformanceMode}
        />
      ) : null}
      {!hasPlayableVideo ? (
        <DiagnosticCanvas
          videoValidationState={videoValidation.state}
          diagnosticWarnings={diagnosticWarnings}
        />
      ) : null}
      {hasPlayableVideo && resolvedVideoBinding.normalizedVideoSrc === null && resolvedVideoBinding.resolvedStudioSample ? (
        <StudioSampleBadge label={resolvedVideoBinding.resolvedStudioSample.label} />
      ) : null}
      {hasPlayableVideo && shouldRenderMotionArtifacts && layerVisibility.showSoundDesign ? (
        <MotionSoundDesign
          model={motionModel}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {hasPlayableVideo && layerVisibility.showPiPShowcase && interactivePreviewVideoSrc ? (
        <CinematicPiPOverlay
          model={motionModel}
          videoSrc={interactivePreviewVideoSrc}
          videoMetadata={videoMetadata}
          headlineText={pipHeadlineText}
          supportText={pipSubtextText}
          layoutPreset={pipLayoutPreset}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {hasPlayableVideo && shouldRenderMotionArtifacts && layerVisibility.showBackgroundOverlay ? (
        <MotionBackgroundOverlay
          model={motionModel}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {hasPlayableVideo && shouldRenderMotionArtifacts && layerVisibility.showMotionAssetOverlay ? (
        <Motion3DOverlay
          model={motionModel}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {hasPlayableVideo && shouldRenderMotionArtifacts && layerVisibility.showMotionAssetOverlay ? (
        <MotionChoreographyOverlay
          model={motionModel}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {hasPlayableVideo && shouldRenderMotionArtifacts && layerVisibility.showMotionAssetOverlay ? (
        <MotionAssetOverlay
          model={motionModel}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {hasPlayableVideo && resolvedPresentationMode !== "long-form" ? (
        <CaptionFocusVignette
          model={motionModel}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {!hasPlayableVideo || layerVisibility.showPiPShowcase || (resolvedPresentationMode === "long-form" && longformCaptionRenderMode !== "word-by-word") ? null : (
        <LongformTypographyBiasOverlay
          presentationMode={resolvedPresentationMode}
          captionBias={motionModel.captionBias}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      )}
      {hasPlayableVideo && shouldRenderMotionArtifacts && layerVisibility.showMatteForeground && interactivePreviewVideoSrc ? (
        <MotionMatteForeground
          model={motionModel}
          videoSrc={interactivePreviewVideoSrc}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {hasPlayableVideo && shouldRenderMotionArtifacts && layerVisibility.showShowcaseOverlay ? (
        <MotionShowcaseOverlay
          model={motionModel}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {hasPlayableVideo && shouldRenderMotionArtifacts && layerVisibility.showTransitionOverlay ? (
        <MotionTransitionOverlay
          model={motionModel}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {!shouldRenderCaptionLayer ? null : resolvedPresentationMode === "long-form" && longformCaptionRenderMode === "svg" ? (
        <SvgCaptionOverlay
          chunks={svgCaptionChunks}
          captionBias={motionModel.captionBias}
          editorialContext={captionEditorialContext}
          referenceMotionTrace={motionModel.referenceMotionTrace}
        />
      ) : resolvedPresentationMode === "long-form" && longformCaptionRenderMode === "word-by-word" ? (
        <LongformWordByWordOverlay
          captionProfileId={resolvedCaptionProfileId}
          chunks={captionChunks}
          captionBias={motionModel.captionBias}
          editorialContext={captionEditorialContext}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : resolvedPresentationMode === "long-form" && longformCaptionRenderMode === "docked-inverse" ? (
        <LongformDockedInverseOverlay
          chunks={captionChunks}
          editorialContext={captionEditorialContext}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : resolvedPresentationMode === "long-form" && longformCaptionRenderMode === "semantic-sidecall" ? (
        <LongformSemanticSidecallOverlay
          chunks={captionChunks}
          editorialContext={captionEditorialContext}
          stabilizePreviewTimeline={useRealtimePreviewPath}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : resolvedPresentationMode === "long-form" ? null : cinematicCaptionChunks.length > 0 ? (
        <CinematicCaptionOverlay
          chunks={cinematicCaptionChunks}
          captionBias={motionModel.captionBias}
          editorialContext={captionEditorialContext}
        />
      ) : null}
      {!shouldRenderCaptionLayer ? null : resolvedPresentationMode !== "long-form" && svgCaptionChunks.length > 0 ? (
        <SvgCaptionOverlay
          chunks={svgCaptionChunks}
          captionBias={motionModel.captionBias}
          editorialContext={captionEditorialContext}
          referenceMotionTrace={motionModel.referenceMotionTrace}
        />
      ) : null}
      <DiagnosticBadge messages={hasPlayableVideo ? diagnosticWarnings : diagnosticWarnings.filter((warning) => warning.toLowerCase().includes("typography"))} />
    </AbsoluteFill>
  );
};

ProjectScopedMotionComposition.displayName = "ProjectScopedMotionComposition";

