import React, {useCallback, useEffect, useMemo, useRef} from "react";
import {useVideoConfig} from "remotion";

import {NativePreviewOverlayStage} from "./NativePreviewStage";
import {createPreviewFrameSource, type PreviewFrameSource} from "./frame-store";
import type {PreviewPlaybackHealth} from "./preview-telemetry";
import type {PreviewPerformanceMode} from "../lib/types";
import type {DisplayTimeline, DisplayTimelineLayer} from "./display-god/display-timeline";
import type {HyperframesPreviewManifest} from "./hyperframes/manifest-schema";
import {CinematicBlurText} from "./hyperframes/CinematicBlurText";
import {resolveHyperframesFontFamily} from "./hyperframes/manifest-typography";
import {shouldSuppressNativeCaptionsForHyperframes} from "./hyperframes/text-governance";
import {useHyperframesTimelineController} from "./hyperframes/timeline-controller";
import {useHyperframesRenderGraph} from "./hyperframes/useRenderGraph";
import {
  useEngineDriver,
  useMeasuredLayoutState,
  type CompiledRenderGraph,
  type EngineDriverIntervalState,
  type RenderGraphTimelineLayer
} from "../lib/render-graph";
import {useGPUAugmenter} from "../webgl/useGPUAugmenter";

type HyperframesPreviewProps = {
  readonly displayTimeline: DisplayTimeline;
  readonly manifest?: HyperframesPreviewManifest | null;
  readonly previewPerformanceMode: PreviewPerformanceMode;
  readonly onHealthChange?: (health: PreviewPlaybackHealth) => void;
  readonly onErrorMessageChange?: (message: string | null) => void;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const resolveTrackLayerContentLabel = (layer: DisplayTimelineLayer): string => {
  const styleMetadata = layer.styleMetadata ?? {};
  const title = typeof styleMetadata["title"] === "string" ? styleMetadata["title"] : null;
  const text = typeof styleMetadata["text"] === "string" ? styleMetadata["text"] : null;
  const subtitle = typeof styleMetadata["subtitle"] === "string" ? styleMetadata["subtitle"] : null;
  return [title, text, subtitle, layer.label].filter(Boolean).join("\n");
};

const resolveTrackLayerFontFamily = ({
  layer,
  manifest
}: {
  layer: DisplayTimelineLayer;
  manifest?: HyperframesPreviewManifest | null;
}): string => {
  const styleMetadata = layer.styleMetadata ?? {};
  const trackType = typeof styleMetadata["trackType"] === "string" ? styleMetadata["trackType"] : "text";
  const resolvedFamily = resolveHyperframesFontFamily({
    manifest,
    trackType
  });

  return resolvedFamily.includes(",") ? resolvedFamily : resolvedFamily ? `"${resolvedFamily}"` : "";
};

const resolveTrackLayerPlacementStyle = (layer: DisplayTimelineLayer): React.CSSProperties => {
  const placement = layer.placement ?? {
    leftPercent: 50,
    topPercent: 50,
    widthPercent: 44,
    heightPercent: 22,
    anchor: "center"
  };

  return {
    position: "absolute",
    left: `${placement.leftPercent}%`,
    top: `${placement.topPercent}%`,
    width: `${placement.widthPercent}%`,
    height: `${placement.heightPercent}%`,
    transform: "translate(-50%, -50%)",
    zIndex: layer.zIndex,
    pointerEvents: "none",
    opacity: 0
  };
};

const resolveTrackCardStyle = ({
  layer,
  manifest
}: {
  layer: DisplayTimelineLayer;
  manifest?: HyperframesPreviewManifest | null;
}): React.CSSProperties => {
  const styleMetadata = layer.styleMetadata ?? {};
  const trackType = typeof styleMetadata["trackType"] === "string" ? styleMetadata["trackType"] : "text";
  const backgroundStyle = typeof styleMetadata["backgroundStyle"] === "string" ? styleMetadata["backgroundStyle"] : "glass-gradient";
  const fontFamily = resolveTrackLayerFontFamily({layer, manifest});

  const background =
    backgroundStyle === "subtle-animated-background-grid"
      ? "linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(20, 30, 64, 0.72))"
      : backgroundStyle === "blue-depth-glow"
        ? "linear-gradient(135deg, rgba(7, 12, 26, 0.94), rgba(15, 23, 42, 0.76))"
        : "linear-gradient(135deg, rgba(9, 12, 20, 0.94), rgba(17, 24, 39, 0.76))";

  return {
    width: "100%",
    height: "100%",
    display: "grid",
    alignContent: "center",
    gap: 10,
    padding: trackType === "text" ? "18px 20px" : "14px 16px",
    borderRadius: 24,
    border: "1px solid rgba(243, 245, 248, 0.12)",
    background,
    boxShadow: "0 28px 58px rgba(0, 0, 0, 0.34)",
    backdropFilter: "blur(18px)",
    color: "#F8FAFC",
    overflow: "hidden",
    ...(fontFamily ? {fontFamily} : {})
  };
};

const HyperframesGPUAugmentationLayer: React.FC<{
  enabled: boolean;
  graph: CompiledRenderGraph;
  frameSource: PreviewFrameSource;
}> = ({enabled, graph, frameSource}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useGPUAugmenter({
    canvasRef,
    enabled,
    graph,
    frameSource
  });

  return (
    <canvas
      ref={canvasRef}
      data-gpu-augmentation-layer="webgl"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 9,
        opacity: enabled ? 1 : 0
      }}
    />
  );
};

const HyperframesTrackLayer: React.FC<{
  layer: DisplayTimelineLayer;
  manifest?: HyperframesPreviewManifest | null;
  driverState: Omit<EngineDriverIntervalState, "sourceLayerId" | "textLayer">;
}> = ({layer, manifest, driverState}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const styleMetadata = layer.styleMetadata ?? {};
  const trackType = typeof styleMetadata["trackType"] === "string" ? styleMetadata["trackType"] : "text";
  const expectedFontFamily = resolveTrackLayerFontFamily({layer, manifest});
  const title = typeof styleMetadata["title"] === "string" ? styleMetadata["title"] : null;
  const subtitle = typeof styleMetadata["subtitle"] === "string" ? styleMetadata["subtitle"] : null;
  const text = typeof styleMetadata["text"] === "string" ? styleMetadata["text"] : null;
  const mediaKind = layer.mediaKind;
  const engineState = useMemo<EngineDriverIntervalState>(() => ({
    ...driverState,
    sourceLayerId: layer.id
  }), [driverState, layer.id]);
  const driverStyle = useEngineDriver(containerRef, engineState);
  const layoutState = useMeasuredLayoutState(containerRef, driverState.mode === "preview");

  return (
    <div
      ref={containerRef}
      style={{
        ...resolveTrackLayerPlacementStyle(layer),
        ...driverStyle
      }}
      data-hyperframes-layer-id={layer.id}
      data-hyperframes-track-type={trackType}
      data-caption-renderer="hyperframes-text"
      data-caption-expected-font={expectedFontFamily || undefined}
      data-layout-measured={layoutState.measured ? "true" : "false"}
    >
      <div style={resolveTrackCardStyle({layer, manifest})}>
        {mediaKind === "iframe" && layer.src ? (
          <iframe
            src={layer.src}
            title={layer.assetId ?? layer.id}
            sandbox="allow-same-origin allow-scripts"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              background: "transparent",
              borderRadius: 18
            }}
          />
        ) : mediaKind === "video" && layer.src ? (
          <video
            src={layer.src}
            muted
            loop
            autoPlay
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: 18
            }}
          />
        ) : mediaKind === "image" && layer.src ? (
          <img
            src={layer.src}
            alt=""
            loading="eager"
            decoding="async"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: 18
            }}
          />
        ) : (
          <>
            {title ? (
              <div style={{position: "relative", minHeight: "clamp(24px, 2.8vw, 42px)"}}>
                <CinematicBlurText
                  text={title}
                  engineState={engineState}
                />
              </div>
            ) : null}
            {text ? (
              <span style={{fontSize: title ? 16 : "clamp(20px, 2.1vw, 32px)", lineHeight: 1.35, whiteSpace: "pre-wrap"}}>
                {text}
              </span>
            ) : null}
            {subtitle ? (
              <span style={{fontSize: 13, lineHeight: 1.5, color: "rgba(226, 232, 240, 0.78)"}}>
                {subtitle}
              </span>
            ) : null}
            {!title && !text && !subtitle ? (
              <span style={{fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap"}}>
                {resolveTrackLayerContentLabel(layer)}
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export const HyperframesPreview: React.FC<HyperframesPreviewProps> = ({
  displayTimeline,
  manifest,
  previewPerformanceMode,
  onHealthChange,
  onErrorMessageChange
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const frameSource = useMemo(() => createPreviewFrameSource(), []);
  const {fps} = useVideoConfig();
  const videoMetadata = useMemo(() => {
    const durationSeconds = Math.max(1, displayTimeline.baseVideo.durationMs / 1000);
    return {
      width: displayTimeline.baseVideo.width,
      height: displayTimeline.baseVideo.height,
      fps: displayTimeline.baseVideo.fps,
      durationSeconds,
      durationInFrames: Math.max(1, Math.round(durationSeconds * displayTimeline.baseVideo.fps))
    };
  }, [displayTimeline.baseVideo]);
  const handleTimelineFrame = useCallback((currentTimeMs: number) => {
    const nextFrame = Math.max(0, Math.round((currentTimeMs / 1000) * videoMetadata.fps));
    frameSource.setFrame(nextFrame);
  }, [frameSource, videoMetadata.fps]);
  const timelineState = useHyperframesTimelineController(videoRef, displayTimeline.id, handleTimelineFrame);
  const interactiveTrackLayers = useMemo(() => {
    return displayTimeline.layers.filter((layer) => layer.kind === "creative-track" && layer.visual);
  }, [displayTimeline.layers]);
  const renderGraphLayers = useMemo<RenderGraphTimelineLayer[]>(() => {
    return interactiveTrackLayers.map((layer) => layer);
  }, [interactiveTrackLayers]);
  const renderGraph = useHyperframesRenderGraph({
    layers: renderGraphLayers,
    fps,
    durationInFrames: videoMetadata.durationInFrames,
    frameSource,
    resetKey: displayTimeline.id
  });
  const compiledTrackLayerIds = useMemo(() => {
    return new Set(renderGraph.intervals.map((interval) => interval.sourceLayerId));
  }, [renderGraph.intervals]);
  const renderedTrackLayers = useMemo(() => {
    return interactiveTrackLayers.filter((layer) => compiledTrackLayerIds.has(layer.id));
  }, [compiledTrackLayerIds, interactiveTrackLayers]);
  const suppressNativeCaptions = useMemo(() => {
    return shouldSuppressNativeCaptionsForHyperframes(renderedTrackLayers);
  }, [renderedTrackLayers]);
  const driverState = useMemo<Omit<EngineDriverIntervalState, "sourceLayerId" | "textLayer">>(() => ({
    mode: "preview",
    graph: renderGraph,
    frameSource
  }), [frameSource, renderGraph]);

  useEffect(() => {
    onHealthChange?.(timelineState.health);
  }, [onHealthChange, timelineState.health]);

  useEffect(() => {
    onErrorMessageChange?.(timelineState.errorMessage);
  }, [onErrorMessageChange, timelineState.errorMessage]);

  useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    const audioSrc = manifest?.audio.src?.trim() ?? "";
    if (!audio || !video || !audioSrc || manifest?.audio.source !== "separate-audio") {
      return;
    }

    audio.playbackRate = timelineState.playbackRate || 1;
    if (Math.abs(audio.currentTime - video.currentTime) > 0.16) {
      audio.currentTime = video.currentTime;
    }

    if (timelineState.isPlaying) {
      void audio.play().catch(() => undefined);
    } else if (!audio.paused) {
      audio.pause();
    }
  }, [manifest?.audio.source, manifest?.audio.src, timelineState.isPlaying, timelineState.playbackRate, timelineState.seekVersion]);

  return (
    <div
      className="hyperframes-preview-stage"
      data-preview-mode="hyperframes"
      data-source-kind={manifest?.baseVideo.sourceKind ?? "none"}
    >
      <video
        ref={videoRef}
        className="hyperframes-preview-video"
        src={displayTimeline.baseVideo.src}
        controls
        preload="auto"
        playsInline
      />
      {manifest?.audio.source === "separate-audio" && manifest.audio.src ? (
        <audio ref={audioRef} src={manifest.audio.src} preload="auto" />
      ) : null}

      <NativePreviewOverlayStage
        videoMetadata={videoMetadata}
        model={displayTimeline.motionModel}
        captionProfileId={displayTimeline.captionProfileId}
        previewPerformanceMode={previewPerformanceMode}
        frameSource={frameSource}
        suppressCaptions={suppressNativeCaptions}
      />

      <HyperframesGPUAugmentationLayer
        enabled={displayTimeline.motionModel.motion3DPlan.enabled}
        graph={renderGraph}
        frameSource={frameSource}
      />

      <div className="hyperframes-creative-track-host">
        {renderedTrackLayers.map((layer) => (
          <HyperframesTrackLayer
            key={layer.id}
            layer={layer}
            manifest={manifest}
            driverState={driverState}
          />
        ))}
      </div>

      <div className="hyperframes-preview-pill">
        <span>Hyperframes / Display God</span>
        <strong>
          {manifest?.baseVideo.sourceLabel ?? displayTimeline.baseVideo.sourceLabel ?? "Live source"}
        </strong>
        <em>
          {timelineState.clockSource} | {Math.round(clamp(timelineState.currentTimeMs, 0, displayTimeline.durationMs))} ms
        </em>
      </div>
    </div>
  );
};

export default React.memo(HyperframesPreview, (prev, next) => {
  return prev.manifest === next.manifest &&
    prev.displayTimeline === next.displayTimeline &&
    prev.previewPerformanceMode === next.previewPerformanceMode;
});
