import React, {useCallback, useEffect, useMemo, useRef} from "react";
import * as THREE from "three";
import {useCurrentFrame, useVideoConfig} from "remotion";

import {NativePreviewOverlayStage} from "./NativePreviewStage";
import type {PreviewPlaybackHealth} from "./preview-telemetry";
import type {PreviewPerformanceMode} from "../lib/types";
import type {DisplayTimeline, DisplayTimelineLayer} from "./display-god/display-timeline";
import type {HyperframesPreviewManifest} from "./hyperframes/manifest-schema";
import {CinematicBlurText} from "./hyperframes/CinematicBlurText";
import {resolveHyperframesFontFamily} from "./hyperframes/manifest-typography";
import {
  filterCompetingHyperframesTextLayers,
  shouldSuppressNativeCaptionsForHyperframes
} from "./hyperframes/text-governance";
import {useHyperframesTimelineController} from "./hyperframes/timeline-controller";
import {useDirectFrameStyles} from "./hyperframes/useDirectFrameStyles";
import {useTimelineWorker} from "./hyperframes/useTimelineWorker";

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

const HyperframesThreeSceneOverlay: React.FC<{
  enabled: boolean;
  currentTimeMs: number;
}> = ({enabled, currentTimeMs}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const currentTimeRef = useRef(currentTimeMs);

  useEffect(() => {
    currentTimeRef.current = currentTimeMs;
  }, [currentTimeMs]);

  useEffect(() => {
    const mountNode = mountRef.current;
    if (!enabled || !mountNode) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.z = 7.5;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    mountNode.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    const pointCount = 180;
    const positions = new Float32Array(pointCount * 3);
    for (let index = 0; index < pointCount; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 9;
      positions[index * 3 + 1] = (Math.random() - 0.5) * 5.6;
      positions[index * 3 + 2] = (Math.random() - 0.5) * 5;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xbad8ff,
      size: 0.045,
      transparent: true,
      opacity: 0.38,
      sizeAttenuation: true
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const haloGeometry = new THREE.TorusGeometry(2.2, 0.02, 16, 120);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd6a0,
      transparent: true,
      opacity: 0.12
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.rotation.x = 1.12;
    scene.add(halo);

    const resize = (): void => {
      const width = mountNode.clientWidth || 1;
      const height = mountNode.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
        resize();
      })
      : null;
    resizeObserver?.observe(mountNode);

    let animationFrameId = 0;
    const render = (): void => {
      const timeSeconds = currentTimeRef.current / 1000;
      points.rotation.y = timeSeconds * 0.16;
      points.rotation.x = Math.sin(timeSeconds * 0.2) * 0.08;
      halo.rotation.z = timeSeconds * 0.18;
      renderer.render(scene, camera);
      animationFrameId = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      geometry.dispose();
      material.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      renderer.dispose();
      mountNode.removeChild(renderer.domElement);
    };
  }, [enabled]);

  return (
    <div
      ref={mountRef}
      style={{
        position: "absolute",
        inset: 0,
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
  containerRef: React.RefCallback<HTMLDivElement>;
  sharpRef: React.RefCallback<HTMLSpanElement>;
  blurredRef: React.RefCallback<HTMLSpanElement>;
}> = ({layer, manifest, containerRef, sharpRef, blurredRef}) => {
  const styleMetadata = layer.styleMetadata ?? {};
  const trackType = typeof styleMetadata["trackType"] === "string" ? styleMetadata["trackType"] : "text";
  const expectedFontFamily = resolveTrackLayerFontFamily({layer, manifest});
  const title = typeof styleMetadata["title"] === "string" ? styleMetadata["title"] : null;
  const subtitle = typeof styleMetadata["subtitle"] === "string" ? styleMetadata["subtitle"] : null;
  const text = typeof styleMetadata["text"] === "string" ? styleMetadata["text"] : null;
  const mediaKind = layer.mediaKind;

  return (
    <div
      ref={containerRef}
      style={resolveTrackLayerPlacementStyle(layer)}
      data-hyperframes-layer-id={layer.id}
      data-hyperframes-track-type={trackType}
      data-caption-renderer="hyperframes-text"
      data-caption-expected-font={expectedFontFamily || undefined}
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
                  sharpRef={sharpRef}
                  blurredRef={blurredRef}
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
  const currentFrame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const containerRefs = useRef(new Map<string, HTMLDivElement>());
  const sharpRefs = useRef(new Map<string, HTMLSpanElement>());
  const blurredRefs = useRef(new Map<string, HTMLSpanElement>());
  const timelineState = useHyperframesTimelineController(videoRef, displayTimeline.id);
  const interactiveTrackLayers = useMemo(() => {
    return displayTimeline.layers.filter((layer) => layer.kind === "creative-track" && layer.visual);
  }, [displayTimeline.layers]);
  const visibleTrackLayers = useMemo(() => {
    const activeLayers = interactiveTrackLayers.filter((layer) => {
      return timelineState.currentTimeMs >= layer.startMs - 260 && timelineState.currentTimeMs <= layer.endMs + 240;
    });
    return filterCompetingHyperframesTextLayers(activeLayers);
  }, [interactiveTrackLayers, timelineState.currentTimeMs]);
  const suppressNativeCaptions = useMemo(() => {
    return shouldSuppressNativeCaptionsForHyperframes(visibleTrackLayers);
  }, [visibleTrackLayers]);
  const videoMetadata = useMemo(() => {
    const durationSeconds = Math.max(1, displayTimeline.baseVideo.durationMs / 1000);
    return {
      width: displayTimeline.baseVideo.width,
      height: displayTimeline.baseVideo.height,
      fps: displayTimeline.baseVideo.fps,
      durationSeconds,
      durationInFrames: Math.max(1, Math.ceil(durationSeconds * displayTimeline.baseVideo.fps))
    };
  }, [displayTimeline.baseVideo]);

  const frameData = useTimelineWorker({
    manifest: manifest ? {
      hyperframes: visibleTrackLayers.map((layer) => ({
        id: layer.id,
        startX: layer.transform?.translateX ?? 0,
        endX: layer.transform?.translateX ?? 0,
        startY: (layer.transform?.translateY ?? 0) + 22,
        endY: layer.transform?.translateY ?? 0,
        duration: Math.max(1, Math.round(((layer.endMs - layer.startMs) / 1000) * fps)),
        startTime: Math.round((layer.startMs / 1000) * fps),
        ease: layer.easing?.enter ?? "power2.out",
        text: typeof layer.styleMetadata?.["title"] === "string"
          ? String(layer.styleMetadata?.["title"])
          : typeof layer.styleMetadata?.["text"] === "string"
            ? String(layer.styleMetadata?.["text"])
            : layer.label
      }))
    } : null,
    fps,
    durationInFrames: videoMetadata.durationInFrames
  });
  useDirectFrameStyles(containerRefs, sharpRefs, blurredRefs, frameData);

  const setContainerRef = useCallback((id: string) => (element: HTMLDivElement | null) => {
    if (element) {
      containerRefs.current.set(id, element);
      return;
    }

    containerRefs.current.delete(id);
  }, []);

  const setSharpRef = useCallback((id: string) => (element: HTMLSpanElement | null) => {
    if (element) {
      sharpRefs.current.set(id, element);
      return;
    }

    sharpRefs.current.delete(id);
  }, []);

  const setBlurredRef = useCallback((id: string) => (element: HTMLSpanElement | null) => {
    if (element) {
      blurredRefs.current.set(id, element);
      return;
    }

    blurredRefs.current.delete(id);
  }, []);

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
        currentTimeMs={timelineState.currentTimeMs}
        videoMetadata={videoMetadata}
        model={displayTimeline.motionModel}
        captionProfileId={displayTimeline.captionProfileId}
        previewPerformanceMode={previewPerformanceMode}
        suppressCaptions={suppressNativeCaptions}
      />

      <HyperframesThreeSceneOverlay
        enabled={displayTimeline.motionModel.motion3DPlan.enabled}
        currentTimeMs={timelineState.currentTimeMs}
      />

      <div className="hyperframes-creative-track-host">
        {visibleTrackLayers.map((layer) => (
          <HyperframesTrackLayer
            key={layer.id}
            layer={layer}
            manifest={manifest}
            containerRef={setContainerRef(layer.id)}
            sharpRef={setSharpRef(layer.id)}
            blurredRef={setBlurredRef(layer.id)}
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
