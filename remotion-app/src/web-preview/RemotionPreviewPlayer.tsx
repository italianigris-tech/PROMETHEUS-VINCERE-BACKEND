import React, {useEffect, useMemo, useRef} from "react";
import {Player} from "@remotion/player";

import {
  ProjectScopedMotionComposition,
  type ProjectScopedLivePreviewSessionData
} from "../compositions/ProjectScopedMotionComposition";
import type {CaptionChunk, CaptionStyleProfileId, PreviewPerformanceMode, VideoMetadata} from "../lib/types";
import type {MotionCompositionModel} from "../lib/motion-platform/scene-engine";
import type {PreviewPlaybackHealth} from "./preview-telemetry";

type RemotionPreviewPlayerProps = {
  readonly videoSrc: string;
  readonly videoMetadata: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames">;
  readonly motionModel: MotionCompositionModel;
  readonly captionChunks?: CaptionChunk[];
  readonly captionProfileId: CaptionStyleProfileId;
  readonly previewPerformanceMode: PreviewPerformanceMode;
  readonly livePreviewSession?: ProjectScopedLivePreviewSessionData | null;
  readonly onHealthChange?: (health: PreviewPlaybackHealth) => void;
  readonly onErrorMessageChange?: (message: string | null) => void;
};

export const resolveProjectScopedCaptionChunks = ({
  captionChunks,
  motionModel
}: {
  captionChunks?: CaptionChunk[];
  motionModel: MotionCompositionModel;
}): CaptionChunk[] => {
  if (Array.isArray(captionChunks) && captionChunks.length > 0) {
    return captionChunks;
  }

  return Array.isArray(motionModel.chunks) ? motionModel.chunks : [];
};

export const resolvePreviewPlayerVideoMetadata = (
  videoMetadata: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames">
): Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames"> => {
  if (!Number.isFinite(videoMetadata.fps) || videoMetadata.fps < 1) {
    throw new Error("Invalid FPS configuration");
  }

  const durationSeconds = Number.isFinite(videoMetadata.durationSeconds) && videoMetadata.durationSeconds > 0
    ? videoMetadata.durationSeconds
    : videoMetadata.durationInFrames / videoMetadata.fps;
  const durationInFrames = Math.max(1, Math.round(durationSeconds * videoMetadata.fps));

  return {
    ...videoMetadata,
    durationSeconds,
    durationInFrames
  };
};

export const buildProjectScopedMotionInputProps = ({
  videoSrc,
  videoMetadata,
  motionModel,
  captionChunks,
  captionProfileId,
  previewPerformanceMode,
  livePreviewSession
}: {
  videoSrc: string;
  videoMetadata: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames">;
  motionModel: MotionCompositionModel;
  captionChunks?: CaptionChunk[];
  captionProfileId: CaptionStyleProfileId;
  previewPerformanceMode: PreviewPerformanceMode;
  livePreviewSession?: ProjectScopedLivePreviewSessionData | null;
}) => {
  const resolvedVideoMetadata = resolvePreviewPlayerVideoMetadata(videoMetadata);
  const resolvedCaptionChunks = resolveProjectScopedCaptionChunks({
    captionChunks,
    motionModel
  });

  return {
    videoSrc,
    videoMetadata: resolvedVideoMetadata,
    livePreviewSession: livePreviewSession ?? null,
    presentationMode: "long-form" as const,
    motionTier: motionModel.tier,
    transitionOverlayMode: "standard" as const,
    motion3DMode: motionModel.motion3DPlan.enabled ? "editorial" as const : "off" as const,
    captionProfileId,
    captionBias: motionModel.captionBias,
    stabilizePreviewTimeline: true,
    previewPerformanceMode,
    debugMotionArtifacts: false,
    motionModelOverride: motionModel,
    captionChunksOverride: resolvedCaptionChunks
  };
};

export const RemotionPreviewPlayer: React.FC<RemotionPreviewPlayerProps> = ({
  videoSrc,
  videoMetadata,
  motionModel,
  captionChunks,
  captionProfileId,
  previewPerformanceMode,
  livePreviewSession,
  onHealthChange,
  onErrorMessageChange
}) => {
  const playerInstanceIdRef = useRef(`project-preview-player-${Math.random().toString(36).slice(2, 10)}`);
  const resolvedVideoMetadata = useMemo(() => resolvePreviewPlayerVideoMetadata(videoMetadata), [videoMetadata]);
  const inputProps = useMemo(() => {
    return buildProjectScopedMotionInputProps({
      videoSrc,
      videoMetadata: resolvedVideoMetadata,
      motionModel,
      captionChunks,
      captionProfileId,
      previewPerformanceMode,
      livePreviewSession
    });
  }, [captionChunks, captionProfileId, livePreviewSession, motionModel, previewPerformanceMode, resolvedVideoMetadata, videoSrc]);

  useEffect(() => {
    onHealthChange?.("ready");
    onErrorMessageChange?.(null);
  }, [onErrorMessageChange, onHealthChange]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    console.info("[RemotionPreviewPlayer] Player mounted", {
      playerInstanceId: playerInstanceIdRef.current
    });

    return () => {
      console.info("[RemotionPreviewPlayer] Player unmounted", {
        playerInstanceId: playerInstanceIdRef.current
      });
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    console.info("[RemotionPreviewPlayer] Player props updated without remount", {
      playerInstanceId: playerInstanceIdRef.current,
      componentName: ProjectScopedMotionComposition.displayName ?? ProjectScopedMotionComposition.name ?? "unknown",
      captionProfileId,
      captionChunkCount: inputProps.captionChunksOverride.length,
      motionModelOverridePresent: Boolean(inputProps.motionModelOverride),
      videoSrcPresent: Boolean(videoSrc),
      livePreviewSessionId: livePreviewSession?.sessionId ?? null,
      previewPerformanceMode,
      motionTier: motionModel.tier,
      videoSrc
    });
  }, [
    captionProfileId,
    inputProps.captionChunksOverride.length,
    inputProps.motionModelOverride,
    livePreviewSession?.sessionId,
    motionModel.tier,
    previewPerformanceMode,
    videoSrc
  ]);

  return (
    <div
      className="remotion-preview-player-shell"
      data-preview-mode="remotion-player"
      data-player-instance-id={playerInstanceIdRef.current}
    >
      <Player
        component={ProjectScopedMotionComposition}
        inputProps={inputProps}
        durationInFrames={resolvedVideoMetadata.durationInFrames}
        compositionWidth={resolvedVideoMetadata.width}
        compositionHeight={resolvedVideoMetadata.height}
        fps={resolvedVideoMetadata.fps}
        controls
        clickToPlay
        doubleClickToFullscreen
        showVolumeControls
        style={{
          width: "100%",
          height: "100%"
        }}
        errorFallback={({error}) => {
          onHealthChange?.("error");
          onErrorMessageChange?.(error.message);
          return (
            <div className="remotion-preview-error">
              <strong>Remotion preview failed</strong>
              <span>{error.message}</span>
            </div>
          );
        }}
        acknowledgeRemotionLicense
      />
    </div>
  );
};
