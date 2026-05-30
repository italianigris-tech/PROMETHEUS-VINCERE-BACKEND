import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Player} from "@remotion/player";
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from "remotion";

import {ProjectScopedMotionComposition} from "../compositions/ProjectScopedMotionComposition";
import type {CaptionChunk, VideoMetadata} from "../lib/types";
import {
  SANDBOX_ASSET_URLS,
  SANDBOX_CAPTION_PROFILE_ID,
  SANDBOX_MOTION_TIER,
  SANDBOX_SOURCE_VIDEO_METADATA,
  SANDBOX_WORDS,
  buildSandboxCaptionChunks,
  buildSandboxMotionModel,
  buildSandboxVideoMetadata,
  resolveSandboxMatteTime
} from "./sandbox-data";

export {
  SANDBOX_ASSET_URLS,
  SANDBOX_WORDS,
  buildSandboxCaptionChunks,
  buildSandboxMotionModel,
  buildSandboxVideoMetadata,
  resolveSandboxDurationInFrames,
  resolveSandboxMatteTime,
  resolveWebPreviewRootRoute
} from "./sandbox-data";

const MATTE_SAMPLE_SCALE = 1;

const toFiniteDuration = (value: number | null | undefined, fallback: number): number => {
  return Number.isFinite(value) && value && value > 0 ? value : fallback;
};

const drawMatteAlphaFrame = ({
  outputCanvas,
  sourceVideo,
  matteVideo
}: {
  outputCanvas: HTMLCanvasElement;
  sourceVideo: HTMLVideoElement;
  matteVideo: HTMLVideoElement;
}): boolean => {
  if (sourceVideo.readyState < 2 || matteVideo.readyState < 2) {
    return false;
  }

  const width = Math.max(1, Math.floor(outputCanvas.width / MATTE_SAMPLE_SCALE));
  const height = Math.max(1, Math.floor(outputCanvas.height / MATTE_SAMPLE_SCALE));
  const sourceCanvas = document.createElement("canvas");
  const matteCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  matteCanvas.width = width;
  matteCanvas.height = height;

  const sourceContext = sourceCanvas.getContext("2d", {willReadFrequently: true});
  const matteContext = matteCanvas.getContext("2d", {willReadFrequently: true});
  const outputContext = outputCanvas.getContext("2d", {willReadFrequently: true});
  if (!sourceContext || !matteContext || !outputContext) {
    return false;
  }

  sourceContext.drawImage(sourceVideo, 0, 0, width, height);
  matteContext.drawImage(matteVideo, 0, 0, width, height);

  const sourceImage = sourceContext.getImageData(0, 0, width, height);
  const matteImage = matteContext.getImageData(0, 0, width, height);
  const sourcePixels = sourceImage.data;
  const mattePixels = matteImage.data;

  for (let pixel = 0; pixel < sourcePixels.length; pixel += 4) {
    const matteAlpha = (mattePixels[pixel] * 0.299) + (mattePixels[pixel + 1] * 0.587) + (mattePixels[pixel + 2] * 0.114);
    sourcePixels[pixel + 3] = Math.max(0, Math.min(255, Math.round(matteAlpha)));
  }

  outputContext.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  outputContext.putImageData(sourceImage, 0, 0);
  return true;
};

const SandboxMatteForeground: React.FC<{
  videoSrc: string;
  matteSrc: string;
  videoMetadata: VideoMetadata;
}> = ({videoSrc, matteSrc, videoMetadata}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceVideoRef = useRef<HTMLVideoElement | null>(null);
  const matteVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaErrorRef = useRef(false);
  const targetTimeRef = useRef(0);
  const targetMatteTimeRef = useRef(0);
  const statusRef = useRef<"loading" | "ready" | "error">("loading");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const targetTime = frame / fps;
  const targetMatteTime = resolveSandboxMatteTime({
    sourceCurrentTime: targetTime,
    sourceDuration: toFiniteDuration(videoMetadata.durationSeconds, SANDBOX_SOURCE_VIDEO_METADATA.durationSeconds),
    matteDuration: toFiniteDuration(videoMetadata.durationSeconds, SANDBOX_SOURCE_VIDEO_METADATA.durationSeconds)
  });

  useEffect(() => {
    targetTimeRef.current = targetTime;
    targetMatteTimeRef.current = targetMatteTime;
  }, [targetMatteTime, targetTime]);

  const setNextStatus = useCallback((nextStatus: "loading" | "ready" | "error") => {
    if (statusRef.current === nextStatus) {
      return;
    }

    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const markMediaError = useCallback(() => {
    mediaErrorRef.current = true;
    setNextStatus("error");
  }, [setNextStatus]);

  const syncVideo = useCallback((video: HTMLVideoElement, nextTime: number): void => {
    const clamped = Math.max(0, Math.min(nextTime, Number.isFinite(video.duration) && video.duration > 0 ? video.duration : nextTime));
    if (Math.abs(video.currentTime - clamped) > 0.05) {
      try {
        video.currentTime = clamped;
      } catch {
        // ignore seek jitter in preview mode
      }
    }
  }, []);

  const drawFrame = useCallback(() => {
    const outputCanvas = outputCanvasRef.current;
    const sourceVideo = sourceVideoRef.current;
    const matteVideo = matteVideoRef.current;
    if (mediaErrorRef.current) {
      setNextStatus("error");
      return;
    }

    if (!outputCanvas || !sourceVideo || !matteVideo) {
      return;
    }

    try {
      const drew = drawMatteAlphaFrame({
        outputCanvas,
        sourceVideo,
        matteVideo
      });
      setNextStatus(drew ? "ready" : "loading");
    } catch {
      markMediaError();
    }
  }, [markMediaError, setNextStatus]);

  useEffect(() => {
    let mounted = true;
    let animationFrameId = 0;

    const loop = () => {
      if (!mounted) {
        return;
      }

      const sourceVideo = sourceVideoRef.current;
      const matteVideo = matteVideoRef.current;
      if (sourceVideo && matteVideo && !mediaErrorRef.current) {
        syncVideo(sourceVideo, targetTimeRef.current);
        syncVideo(matteVideo, targetMatteTimeRef.current);
      }

      drawFrame();
      animationFrameId = window.requestAnimationFrame(loop);
    };

    animationFrameId = window.requestAnimationFrame(loop);

    return () => {
      mounted = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [drawFrame, syncVideo]);

  useEffect(() => {
    const outputCanvas = outputCanvasRef.current;
    if (!outputCanvas) {
      return;
    }

    outputCanvas.width = Math.max(1, Math.floor(videoMetadata.width / MATTE_SAMPLE_SCALE));
    outputCanvas.height = Math.max(1, Math.floor(videoMetadata.height / MATTE_SAMPLE_SCALE));
    window.requestAnimationFrame(drawFrame);
  }, [drawFrame, videoMetadata.height, videoMetadata.width]);

  return (
    <div className="sandbox-matte-foreground" aria-hidden="true">
      <video
        ref={sourceVideoRef}
        src={videoSrc}
        crossOrigin="anonymous"
        muted
        playsInline
        preload="auto"
        onError={markMediaError}
        className="sandbox-hidden-media"
      />
      <video
        ref={matteVideoRef}
        src={matteSrc}
        crossOrigin="anonymous"
        muted
        playsInline
        preload="auto"
        onError={markMediaError}
        className="sandbox-hidden-media"
      />
      <canvas
        ref={outputCanvasRef}
        className={`sandbox-matte-canvas is-${status}`}
      />
      {status === "error" ? <div className="sandbox-matte-debug-outline" /> : null}
    </div>
  );
};

const SandboxComposition: React.FC<{
  captionChunks: CaptionChunk[];
  videoMetadata: VideoMetadata;
}> = ({captionChunks, videoMetadata}) => {
  const motionModel = useMemo(() => buildSandboxMotionModel(captionChunks), [captionChunks]);

  return (
    <AbsoluteFill className="sandbox-composition">
      <ProjectScopedMotionComposition
        videoSrc={SANDBOX_ASSET_URLS.videoSrc}
        videoMetadata={videoMetadata}
        presentationMode="long-form"
        captionChunksOverride={captionChunks}
        motionModelOverride={motionModel}
        motionTier={SANDBOX_MOTION_TIER}
        matteMode="prefer-matte"
        captionProfileId={SANDBOX_CAPTION_PROFILE_ID}
        hideCaptionOverlays={false}
        debugMotionArtifacts={false}
        stabilizePreviewTimeline
        previewPerformanceMode="balanced"
      />
      <SandboxMatteForeground
        videoSrc={SANDBOX_ASSET_URLS.videoSrc}
        matteSrc={SANDBOX_ASSET_URLS.matteSrc}
        videoMetadata={videoMetadata}
      />
      <div className="sandbox-badge-row">
        <span className="sandbox-badge">sandbox</span>
        <span className="sandbox-badge">{videoMetadata.width}x{videoMetadata.height}</span>
        <span className="sandbox-badge">matte sync</span>
      </div>
    </AbsoluteFill>
  );
};

export const Sandbox: React.FC = () => {
  const captionChunks = useMemo(() => buildSandboxCaptionChunks(SANDBOX_WORDS), []);
  const videoMetadata = useMemo(() => buildSandboxVideoMetadata(captionChunks), [captionChunks]);
  const durationInFrames = videoMetadata.durationInFrames;

  return (
    <main className="sandbox-shell">
      <header className="sandbox-header">
        <div className="sandbox-header-group">
          <span className="sandbox-kicker">/sandbox</span>
          <h1 className="sandbox-title">Hardcoded premium stage</h1>
        </div>
        <div className="sandbox-status-row">
          <span className="sandbox-pill">{SANDBOX_ASSET_URLS.videoSrc}</span>
          <span className="sandbox-pill">{SANDBOX_ASSET_URLS.matteSrc}</span>
          <span className="sandbox-pill">no backend</span>
        </div>
      </header>

      <section className="sandbox-stage">
        <Player
          component={SandboxComposition}
          inputProps={{
            captionChunks,
            videoMetadata
          }}
          durationInFrames={durationInFrames}
          compositionWidth={videoMetadata.width}
          compositionHeight={videoMetadata.height}
          fps={videoMetadata.fps}
          controls
          clickToPlay
          doubleClickToFullscreen
          showVolumeControls
          style={{
            width: "100%",
            height: "100%"
          }}
          acknowledgeRemotionLicense
        />
      </section>
    </main>
  );
};

export default Sandbox;
