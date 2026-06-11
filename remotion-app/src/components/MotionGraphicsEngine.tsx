import React, {CSSProperties, useMemo} from "react";
import {AbsoluteFill, Html5Video, Img, OffthreadVideo, interpolate, staticFile, useVideoConfig} from "remotion";

import {getCaptionContainerStyle} from "../lib/caption-layout";
import type {
  MotionAssetManifest,
  CaptionVerticalBias,
  MotionTransformValue,
  PresentationMode,
  PreviewPerformanceMode
} from "../lib/types";
import {
  buildGradeFilter,
  resolveGradeProfile
} from "../lib/motion-platform/grade-profiles";
import {resolveControlledBackgroundScale} from "../lib/motion-platform/caption-editorial-engine";
import {shouldRenderPreviewOverlayAsset} from "../lib/motion-platform/render-text-safety";
import {useStablePreviewFrame} from "../lib/preview-runtime-stability";
import {
  buildMotionCompositionModel,
  selectActiveCameraCueAtTime,
  selectActiveMotionSceneAtTime,
  type MotionCompositionModel,
  type ResolvedMotionScene
} from "../lib/motion-platform/scene-engine";
import {
  isIframeMotionGraphic,
  isVideoLikeMotionGraphic,
  resolveMotionDecisionAssetPlacement,
  resolveMotionDecisionObjectFit,
  resolveMotionDecisionVisibility,
  resolveMotionDecisionZIndex
} from "../lib/motion-graphics-agent/rendering";
import {
  resolveMotionChoreographySceneStateAtTime,
  selectActiveMotionChoreographySceneAtTime
} from "../lib/motion-platform/choreography-planner";
import {
  mixReferenceMotionIntoCssTransform,
  resolveReferenceMotionAtFrame
} from "../lib/reference-motion-trace";
import {
  getZoomTimingFamilyDefinition,
  type ZoomEaseId
} from "../lib/motion-platform/zoom-timing";
import type {MotionGraphicsDecision, MotionGraphicsDecisionAsset} from "../lib/motion-graphics-agent/types";

type MotionGraphicsEngineProps = {
  model: MotionCompositionModel;
  stabilizePreviewTimeline?: boolean;
  previewTimelineResetVersion?: number;
  previewPerformanceMode?: PreviewPerformanceMode;
};

type MotionVideoBackdropProps = MotionGraphicsEngineProps & {
  videoSrc: string;
  presentationMode: PresentationMode;
};

type MotionVideoLayerProps = MotionGraphicsEngineProps & {
  videoSrc: string;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;
const PREVIEW_MEDIA_ACCEPTABLE_TIMESHIFT_SECONDS = 2.5;

const easeValue = (mode: "linear" | "ease-in-out" | "ease-out" | "back-out", input: number): number => {
  const t = clamp01(input);
  if (mode === "linear") {
    return t;
  }
  if (mode === "ease-in-out") {
    return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
  }
  if (mode === "back-out") {
    const p = t - 1;
    return 1 + p * p * (2.4 * p + 1.4);
  }
  return 1 - (1 - t) ** 3;
};

const easeCameraValue = (mode: ZoomEaseId, input: number): number => {
  const t = clamp01(input);
  if (mode === "sine.out") {
    return Math.sin((t * Math.PI) / 2);
  }
  if (mode === "sine.inOut") {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }
  if (mode === "power3.out") {
    return 1 - (1 - t) ** 3;
  }
  if (mode === "power2.out") {
    return 1 - (1 - t) ** 2;
  }
  if (mode === "power2.inOut") {
    return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  }
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
};

const getSceneTransitionState = ({
  scene,
  currentTimeMs,
  fps
}: {
  scene: ResolvedMotionScene;
  currentTimeMs: number;
  fps: number;
}) => {
  const budgetMs = (scene.transitionBudgetFrames / fps) * 1000;
  const entryProgress = budgetMs <= 0
    ? 1
    : clamp01((currentTimeMs - (scene.startMs - budgetMs)) / budgetMs);
  const exitProgress = budgetMs <= 0
    ? 0
    : clamp01((currentTimeMs - scene.endMs) / budgetMs);
  return {
    entryProgress: easeValue(scene.transitionInPreset.easing, entryProgress),
    exitProgress: easeValue(scene.transitionOutPreset.easing, exitProgress),
    visibility: clamp01(entryProgress * (1 - exitProgress))
  };
};

const getClipPath = (mode: ResolvedMotionScene["transitionInPreset"]["entryRules"]["clipMode"], progress: number): string | undefined => {
  const p = clamp01(progress);
  if (mode === "left-to-right") {
    return `inset(0 ${100 - p * 100}% 0 0)`;
  }
  if (mode === "center-out") {
    const inset = Math.max(0, 50 - p * 50);
    return `inset(0 ${inset}% 0 ${inset}%)`;
  }
  if (mode === "top-down") {
    return `inset(0 0 ${100 - p * 100}% 0)`;
  }
  if (mode === "bottom-up") {
    return `inset(${100 - p * 100}% 0 0 0)`;
  }
  return undefined;
};

const getCameraMotionState = ({
  model,
  currentTimeMs
}: {
  model: MotionCompositionModel;
  currentTimeMs: number;
}): {scale: number; translateX: number; translateY: number} => {
  if (model.motion3DPlan.enabled) {
    const choreographyScene = selectActiveMotionChoreographySceneAtTime({
      plan: model.choreographyPlan,
      currentTimeMs
    });
    if (choreographyScene) {
      const stage = resolveMotionChoreographySceneStateAtTime({
        scene: choreographyScene,
        currentTimeMs
      }).stageTransform;
      return {
        scale: stage.scale,
        translateX: stage.translateX,
        translateY: stage.translateY
      };
    }
  }

  const cue = selectActiveCameraCueAtTime({
    cameraCues: model.cameraCues,
    currentTimeMs
  });

  if (!cue || cue.mode === "none") {
    return {
      scale: 1,
      translateX: 0,
      translateY: 0
    };
  }
  const timingDefinition = getZoomTimingFamilyDefinition(cue.timingFamily);

  if (currentTimeMs <= cue.peakStartMs) {
    const progress = easeCameraValue(
      timingDefinition.easeIn,
      (currentTimeMs - cue.startMs) / Math.max(1, cue.zoomInMs)
    );
    return {
      scale: lerp(1, cue.peakScale, progress),
      translateX: lerp(0, cue.panX, progress),
      translateY: lerp(0, cue.panY, progress)
    };
  }

  if (currentTimeMs <= cue.peakEndMs) {
    return {
      scale: cue.peakScale,
      translateX: cue.panX,
      translateY: cue.panY
    };
  }

  const progress = easeCameraValue(
    timingDefinition.easeOut,
    (currentTimeMs - cue.peakEndMs) / Math.max(1, cue.zoomOutMs)
  );
  return {
    scale: lerp(cue.peakScale, 1, progress),
    translateX: lerp(cue.panX, 0, progress),
    translateY: lerp(cue.panY, 0, progress)
  };
};

const resolveAssetSrc = (src: string): string => {
  if (/^(https?:)?\//.test(src)) {
    return src;
  }
  return staticFile(src);
};

const getPlacementStyle = (asset: MotionAssetManifest): CSSProperties => {
  if (asset.placementZone === "edge-frame") {
    return {position: "absolute", inset: 0};
  }
  if (asset.placementZone === "side-panels") {
    return {position: "absolute", inset: "0 0 0 0"};
  }
  if (asset.placementZone === "lower-third") {
    return {position: "absolute", inset: "52% -4% -6% -4%"};
  }
  if (asset.placementZone === "foreground-cross") {
    return {position: "absolute", inset: "0 -5% -2% -5%"};
  }
  if (asset.placementZone === "background-depth") {
    return {position: "absolute", inset: "-4%"};
  }
  return {position: "absolute", inset: 0};
};

const getAssetLife = ({
  asset,
  scene,
  currentTimeMs,
  fps
}: {
  asset: MotionAssetManifest;
  scene: ResolvedMotionScene;
  currentTimeMs: number;
  fps: number;
}): number => {
  const {entryProgress, exitProgress, visibility} = getSceneTransitionState({scene, currentTimeMs, fps});
  const budgetMs = (scene.transitionBudgetFrames / fps) * 1000;
  if (asset.durationPolicy === "entry-only") {
    const entryTail = scene.startMs + budgetMs * 1.5;
    const tailProgress = currentTimeMs <= entryTail ? 1 : 1 - clamp01((currentTimeMs - entryTail) / budgetMs);
    return clamp01(entryProgress * tailProgress);
  }
  if (asset.durationPolicy === "exit-only") {
    return clamp01(exitProgress);
  }
  if (asset.durationPolicy === "ping-pong") {
    const sceneProgress = clamp01((currentTimeMs - scene.startMs) / Math.max(1, scene.endMs - scene.startMs));
    return visibility * (0.72 + Math.sin(sceneProgress * Math.PI) * 0.28);
  }
  return visibility;
};

const MotionAssetItem: React.FC<{
  asset: MotionAssetManifest;
  scene: ResolvedMotionScene;
  currentTimeMs: number;
  frame: number;
  fps: number;
  choreographyTransform?: MotionTransformValue | null;
  model: MotionCompositionModel;
}> = ({asset, scene, currentTimeMs, frame, fps, choreographyTransform, model}) => {
  if (!shouldRenderPreviewOverlayAsset(asset)) {
    return null;
  }

  const {entryProgress, exitProgress} = getSceneTransitionState({scene, currentTimeMs, fps});
  const entryRules = scene.transitionInPreset.entryRules;
  const exitRules = scene.transitionOutPreset.exitRules;
  const entryWeight = 1 - exitProgress;
  const exitWeight = exitProgress;
  const blendedProgress = clamp01(entryProgress * (1 - exitProgress));
  const opacityCap = scene.transitionInPreset.captionCompatibility.protectSafeZone &&
    asset.safeArea !== "avoid-caption-region"
    ? scene.transitionInPreset.captionCompatibility.safeZoneOpacityCap
    : 1;
  const life = getAssetLife({asset, scene, currentTimeMs, fps});
  const translateX = lerp(entryRules.translateXFrom, entryRules.translateXTo, entryProgress) * entryWeight +
    lerp(exitRules.translateXFrom, exitRules.translateXTo, exitProgress) * exitWeight;
  const translateY = lerp(entryRules.translateYFrom, entryRules.translateYTo, entryProgress) * entryWeight +
    lerp(exitRules.translateYFrom, exitRules.translateYTo, exitProgress) * exitWeight;
  const clipPath = getClipPath(entryRules.clipMode, blendedProgress);
  const choreographyScaleBoost = choreographyTransform
    ? 1 + choreographyTransform.depth * 0.00065
    : 1;
  const resolvedOpacity = choreographyTransform
    ? asset.opacity * choreographyTransform.opacity * opacityCap
    : asset.opacity * life * opacityCap;
  const resolvedTransform = choreographyTransform
    ? `translate3d(${choreographyTransform.translateX.toFixed(2)}px, ${choreographyTransform.translateY.toFixed(2)}px, 0) scale(${(choreographyTransform.scale * choreographyScaleBoost).toFixed(3)}) rotate(${choreographyTransform.rotateDeg.toFixed(3)}deg)`
    : `translate3d(${translateX}px, ${translateY}px, 0) scale(${lerp(0.985, 1.01, blendedProgress)})`;
  const referenceMotion = resolveReferenceMotionAtFrame({
    trace: model.referenceMotionTrace,
    targetId: asset.id,
    frame,
    fps
  });
  const resolvedFilter = choreographyTransform
    ? `${asset.family === "flare" ? "blur(2px) " : ""}blur(${(choreographyTransform.blurPx + (referenceMotion?.blurPx ?? 0)).toFixed(2)}px)`.trim()
    : asset.family === "flare"
      ? "blur(2px)"
      : referenceMotion && referenceMotion.blurPx > 0
        ? `blur(${referenceMotion.blurPx.toFixed(2)}px)`
        : undefined;

  return (
    <div
      style={{
        ...getPlacementStyle(asset),
        opacity: resolvedOpacity * (referenceMotion?.opacity ?? 1),
        transform: mixReferenceMotionIntoCssTransform(resolvedTransform, referenceMotion),
        mixBlendMode: asset.blendMode as CSSProperties["mixBlendMode"],
        filter: resolvedFilter,
        clipPath,
        pointerEvents: "none"
      }}
    >
      <Img
        src={resolveAssetSrc(asset.src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover"
        }}
      />
    </div>
  );
};

const MotionGraphicsDecisionItem: React.FC<{
  decision: MotionGraphicsDecision;
  selectedAsset: MotionGraphicsDecisionAsset;
  currentTimeMs: number;
  frame: number;
  fps: number;
  outputWidth: number;
  outputHeight: number;
  stabilizePreviewTimeline: boolean;
  model: MotionCompositionModel;
}> = ({
  decision,
  selectedAsset,
  currentTimeMs,
  frame,
  fps,
  outputWidth,
  outputHeight,
  stabilizePreviewTimeline,
  model
}) => {
  if (!selectedAsset.asset) {
    return null;
  }

  const asset = selectedAsset.asset;
  if (!shouldRenderPreviewOverlayAsset(asset)) {
    return null;
  }
  const placement = resolveMotionDecisionAssetPlacement({
    selectedAsset,
    decision
  });
  const visibility = resolveMotionDecisionVisibility({
    selectedAsset,
    currentTimeMs,
    fps
  });
  if (visibility.opacity <= 0.005) {
    return null;
  }

  const resolvedWidth = (placement.widthPercent / 100) * outputWidth;
  const resolvedHeight = (placement.heightPercent / 100) * outputHeight;
  const referenceMotion = resolveReferenceMotionAtFrame({
    trace: model.referenceMotionTrace,
    targetId: selectedAsset.assetId,
    frame,
    fps
  });
  const containerStyle: CSSProperties = {
    position: "absolute",
    left: `${placement.leftPercent}%`,
    top: `${placement.topPercent}%`,
    width: resolvedWidth,
    height: resolvedHeight,
    transform: mixReferenceMotionIntoCssTransform(
      `translate3d(calc(-50% + ${visibility.translateX.toFixed(2)}px), calc(-50% + ${visibility.translateY.toFixed(2)}px), 0) scale(${visibility.scale.toFixed(3)}) rotate(${(selectedAsset.rotation ?? 0).toFixed(3)}deg)`,
      referenceMotion
    ),
    transformOrigin: "center center",
    opacity: visibility.opacity * (referenceMotion?.opacity ?? 1),
    mixBlendMode: (selectedAsset.blendMode ?? asset.blendMode) as CSSProperties["mixBlendMode"],
    filter: referenceMotion && referenceMotion.blurPx > 0 ? `blur(${referenceMotion.blurPx.toFixed(2)}px)` : undefined,
    pointerEvents: "none",
    zIndex: resolveMotionDecisionZIndex(selectedAsset.role)
  };
  const mediaStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: resolveMotionDecisionObjectFit(selectedAsset)
  };
  const resolvedSrc = resolveAssetSrc(asset.src);

  return (
    <div
      style={containerStyle}
      data-motion-asset-id={selectedAsset.assetId}
      data-motion-role={selectedAsset.role}
      data-motion-rationale={selectedAsset.rationale}
    >
      {isIframeMotionGraphic(asset) ? (
        <iframe
          src={resolvedSrc}
          title={asset.canonicalLabel ?? asset.id}
          sandbox="allow-same-origin allow-scripts"
          style={{
            ...mediaStyle,
            border: "none",
            background: "transparent"
          }}
        />
      ) : isVideoLikeMotionGraphic(asset.src) ? (
        stabilizePreviewTimeline ? (
          <Html5Video
            src={resolvedSrc}
            muted
            loop={asset.loopable}
            acceptableTimeShiftInSeconds={PREVIEW_MEDIA_ACCEPTABLE_TIMESHIFT_SECONDS}
            pauseWhenBuffering={false}
            style={mediaStyle}
          />
        ) : (
          <OffthreadVideo
            src={resolvedSrc}
            muted
            pauseWhenBuffering
            style={mediaStyle}
          />
        )
      ) : (
        <Img src={resolvedSrc} style={mediaStyle} />
      )}
    </div>
  );
};

export const MotionVideoBackdrop: React.FC<MotionVideoBackdropProps> = ({
  videoSrc,
  model,
  presentationMode,
  stabilizePreviewTimeline = false,
  previewTimelineResetVersion = 0,
  previewPerformanceMode = "full"
}) => {
  const {fps} = useVideoConfig();
  const {stableFrame} = useStablePreviewFrame({
    enabled: stabilizePreviewTimeline,
    resetKey: previewTimelineResetVersion
  });
  const currentTimeMs = (stableFrame / fps) * 1000;
  const camera = getCameraMotionState({model, currentTimeMs});
  const effectiveCamera = previewPerformanceMode === "turbo"
    ? {
      scale: 1,
      translateX: 0,
      translateY: 0
    }
    : camera;
  const gradeFilter = buildGradeFilter(model.gradeProfile);
  const baseScale = previewPerformanceMode === "turbo"
    ? 1
    : model.matteEnabled
      ? 1.014
      : 1.004;
  const controlledCameraScale = resolveControlledBackgroundScale(effectiveCamera.scale, 1.02);
  const backgroundScale = resolveControlledBackgroundScale(baseScale * controlledCameraScale, 1.02);
  const backgroundStyle: CSSProperties = previewPerformanceMode === "turbo"
    ? {
      filter: presentationMode === "long-form" ? undefined : gradeFilter,
      transform: `translate3d(0, 0, 0) scale(${backgroundScale.toFixed(4)})`,
      willChange: "transform"
    }
    : model.matteEnabled
    ? {
      filter: `${gradeFilter} blur(10px)`,
      transform: `translate3d(${effectiveCamera.translateX}px, ${effectiveCamera.translateY}px, 0) scale(${backgroundScale.toFixed(4)})`
    }
    : {
      filter: gradeFilter,
      transform: `translate3d(${effectiveCamera.translateX}px, ${effectiveCamera.translateY}px, 0) scale(${backgroundScale.toFixed(4)})`
    };

  return (
    <>
      {stabilizePreviewTimeline ? (
        <Html5Video
          className="dg-video"
          src={videoSrc}
          volume={model.soundDesignPlan.mixTargets.sourceVideoVolume}
          acceptableTimeShiftInSeconds={PREVIEW_MEDIA_ACCEPTABLE_TIMESHIFT_SECONDS}
          pauseWhenBuffering={false}
          style={backgroundStyle}
        />
      ) : (
        <OffthreadVideo
          className="dg-video"
          src={videoSrc}
          volume={model.soundDesignPlan.mixTargets.sourceVideoVolume}
          pauseWhenBuffering
          style={backgroundStyle}
        />
      )}
      <AbsoluteFill
        style={{
          zIndex: 1,
          pointerEvents: "none",
          background: `linear-gradient(180deg, ${model.gradeProfile.shadowTint}, transparent 34%, transparent 68%, ${model.gradeProfile.shadowTint})`,
          opacity: presentationMode === "long-form" ? 0.58 : 0.7
        }}
      />
      {presentationMode !== "long-form" ? (
        <AbsoluteFill
          style={{
            zIndex: 2,
            pointerEvents: "none",
            background: `radial-gradient(72% 54% at 18% 14%, ${model.gradeProfile.highlightTint} 0%, rgba(255,255,255,0) 54%), radial-gradient(68% 52% at 84% 82%, rgba(164, 208, 255, 0.12) 0%, rgba(164, 208, 255, 0) 58%)`,
            mixBlendMode: "screen",
            opacity: 0.54
          }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          zIndex: 2,
          pointerEvents: "none",
          boxShadow: `inset 0 0 180px rgba(0,0,0,${model.gradeProfile.vignette})`
        }}
      />
    </>
  );
};

export const CaptionFocusVignette: React.FC<MotionGraphicsEngineProps> = ({
  model,
  stabilizePreviewTimeline = false,
  previewTimelineResetVersion = 0
}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const {stableFrame} = useStablePreviewFrame({
    enabled: stabilizePreviewTimeline,
    resetKey: previewTimelineResetVersion
  });
  const frame = stableFrame;
  const currentTimeMs = (frame / fps) * 1000;
  const activeChunk = useMemo(() => {
    return model.chunks.find((chunk) => currentTimeMs >= chunk.startMs - 90 && currentTimeMs <= chunk.endMs + 160) ?? null;
  }, [currentTimeMs, model.chunks]);
  const intro = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const outro = interpolate(frame, [Math.max(0, durationInFrames - 24), durationInFrames], [1, 0.92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const activeOpacity = activeChunk
    ? interpolate(currentTimeMs, [activeChunk.startMs - 80, activeChunk.startMs + 140, activeChunk.endMs + 180], [0.34, 0.74, 0.28], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp"
    })
    : 0.24;
  const pulse = 0.94 + ((Math.sin(frame / 16) + 1) / 2) * 0.08;
  const zone = getCaptionContainerStyle(model.captionSafeZone, model.captionBias);
  const opacity = activeOpacity * intro * outro;

  return (
    <AbsoluteFill style={{zIndex: 4, pointerEvents: "none"}}>
      <div
        style={{
          position: "absolute",
          ...zone
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "-12% -6%",
            background: `radial-gradient(84% 68% at 50% 52%, rgba(10, 14, 28, ${(0.72 * pulse).toFixed(3)}) 0%, rgba(10, 14, 28, ${(0.44 * pulse).toFixed(3)}) 38%, rgba(10, 14, 28, 0) 76%)`,
            filter: "blur(24px)",
            opacity
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "-8% -2%",
            background: `radial-gradient(62% 44% at 50% 50%, rgba(196, 220, 255, ${(0.18 * pulse).toFixed(3)}) 0%, rgba(196, 220, 255, ${(0.08 * pulse).toFixed(3)}) 34%, rgba(196, 220, 255, 0) 72%)`,
            filter: "blur(18px)",
            mixBlendMode: "screen",
            opacity: opacity * 0.92
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const LongformTypographyBiasOverlay: React.FC<{
  presentationMode: PresentationMode;
  captionBias: CaptionVerticalBias;
  stabilizePreviewTimeline?: boolean;
  previewTimelineResetVersion?: number;
}> = ({presentationMode, captionBias, stabilizePreviewTimeline = false, previewTimelineResetVersion = 0}) => {
  const {stableFrame} = useStablePreviewFrame({
    enabled: stabilizePreviewTimeline,
    resetKey: previewTimelineResetVersion
  });
  const {durationInFrames} = useVideoConfig();
  const frame = stableFrame;

  if (presentationMode !== "long-form" || captionBias !== "bottom") {
    return null;
  }

  const intro = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const outro = interpolate(frame, [Math.max(0, durationInFrames - 32), durationInFrames], [1, 0.92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const pulse = 0.92 + ((Math.sin(frame / 12) + 1) / 2) * 0.16;
  const opacity = intro * outro;

  return (
    <AbsoluteFill style={{zIndex: 4, pointerEvents: "none"}}>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 42%, rgba(4,7,16,0.22) 62%, rgba(3,5,12,0.74) 100%)",
          opacity: 0.9 * opacity
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(82% 52% at 50% 100%, rgba(5, 10, 22, ${(0.82 * pulse).toFixed(3)}) 0%, rgba(7, 12, 28, ${(0.58 * pulse).toFixed(3)}) 28%, rgba(7, 12, 28, ${(0.22 * pulse).toFixed(3)}) 56%, rgba(7, 12, 28, 0) 78%)`,
          opacity
        }}
      />
    </AbsoluteFill>
  );
};

export const MotionAssetOverlay: React.FC<MotionGraphicsEngineProps> = ({
  model,
  stabilizePreviewTimeline = false,
  previewTimelineResetVersion = 0
}) => {
  const {fps, width, height} = useVideoConfig();
  const {stableFrame} = useStablePreviewFrame({
    enabled: stabilizePreviewTimeline,
    resetKey: previewTimelineResetVersion
  });
  const currentTimeMs = (stableFrame / fps) * 1000;
  const activeScene = useMemo(
    () => selectActiveMotionSceneAtTime({scenes: model.scenes, currentTimeMs, fps}),
    [currentTimeMs, fps, model.scenes]
  );
  const choreographyScene = useMemo(
    () => activeScene ? model.choreographyPlan.sceneMap[activeScene.id] ?? null : null,
    [activeScene, model.choreographyPlan.sceneMap]
  );
  const choreographyState = useMemo(
    () => choreographyScene ? resolveMotionChoreographySceneStateAtTime({scene: choreographyScene, currentTimeMs}) : null,
    [choreographyScene, currentTimeMs]
  );
  const activeMotionGraphicsDecision = useMemo(
    () => activeScene ? model.motionGraphicsPlan.sceneMap[activeScene.id] ?? null : null,
    [activeScene, model.motionGraphicsPlan.sceneMap]
  );

  if (!activeScene) {
    return null;
  }

  const decisionAssets = activeMotionGraphicsDecision?.selectedAssets ?? [];
  const renderLegacyAssets = decisionAssets.length === 0;

  return (
    <AbsoluteFill
      style={{
        zIndex: 5,
        pointerEvents: "none",
        transform: choreographyState
          ? `translate3d(${choreographyState.stageTransform.translateX.toFixed(2)}px, ${choreographyState.stageTransform.translateY.toFixed(2)}px, 0) scale(${choreographyState.stageTransform.scale.toFixed(3)}) rotate(${choreographyState.stageTransform.rotateDeg.toFixed(3)}deg)`
          : undefined,
        transformOrigin: "center center",
        opacity: choreographyState?.stageTransform.opacity ?? 1
      }}
    >
      {decisionAssets.map((selectedAsset) => (
        <MotionGraphicsDecisionItem
          key={`${activeScene.id}-${selectedAsset.role}-${selectedAsset.assetId}`}
          decision={activeMotionGraphicsDecision as MotionGraphicsDecision}
          selectedAsset={selectedAsset}
          currentTimeMs={currentTimeMs}
          frame={stableFrame}
          fps={fps}
          outputWidth={width}
          outputHeight={height}
          stabilizePreviewTimeline={stabilizePreviewTimeline}
          model={model}
        />
      ))}
      {renderLegacyAssets ? activeScene.assets.map((asset) => {
        const binding = choreographyScene?.layerBindings.find((candidate) => candidate.sourceAssetId === asset.id);
        if (binding?.depthTreatment === "depth-worthy" && model.motion3DPlan.enabled) {
          return null;
        }
        return (
          <MotionAssetItem
            key={`${activeScene.id}-${asset.id}`}
            asset={asset}
            scene={activeScene}
            currentTimeMs={currentTimeMs}
            frame={stableFrame}
            fps={fps}
            choreographyTransform={binding ? choreographyState?.targetTransforms[binding.targetId] ?? null : null}
            model={model}
          />
        );
      }) : null}
    </AbsoluteFill>
  );
};

export const MotionMatteForeground: React.FC<MotionVideoLayerProps> = ({
  videoSrc,
  model,
  stabilizePreviewTimeline = false,
  previewTimelineResetVersion = 0
}) => {
  if (!model.matteEnabled || !model.matteManifest?.foregroundSrc) {
    return null;
  }

  const {fps} = useVideoConfig();
  const {stableFrame} = useStablePreviewFrame({
    enabled: stabilizePreviewTimeline,
    resetKey: previewTimelineResetVersion
  });
  const currentTimeMs = (stableFrame / fps) * 1000;
  const camera = getCameraMotionState({model, currentTimeMs});
  const foregroundSrc = resolveAssetSrc(model.matteManifest.foregroundSrc);
  return (
    <>
      <AbsoluteFill
        style={{
          zIndex: 6,
          pointerEvents: "none",
          background: "linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0) 30%, rgba(0,0,0,0.12))"
        }}
      />
      {stabilizePreviewTimeline ? (
        <Html5Video
          src={foregroundSrc || videoSrc}
          muted
          acceptableTimeShiftInSeconds={PREVIEW_MEDIA_ACCEPTABLE_TIMESHIFT_SECONDS}
          pauseWhenBuffering={false}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 7,
            objectFit: "cover",
            filter: buildGradeFilter(resolveGradeProfile(model.gradeProfile.id)),
            transform: `translate3d(${camera.translateX}px, ${camera.translateY}px, 0) scale(${camera.scale.toFixed(4)})`
          }}
        />
      ) : (
        <OffthreadVideo
          src={foregroundSrc || videoSrc}
          muted
          pauseWhenBuffering
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 7,
            objectFit: "cover",
            filter: buildGradeFilter(resolveGradeProfile(model.gradeProfile.id)),
            transform: `translate3d(${camera.translateX}px, ${camera.translateY}px, 0) scale(${camera.scale.toFixed(4)})`
          }}
        />
      )}
    </>
  );
};

export const MotionFinishingOverlay: React.FC<MotionGraphicsEngineProps> = ({model}) => {
  const grainOpacity = Math.min(0.2, model.gradeProfile.grain + (model.tier === "hero" ? 0.04 : 0));
  return (
    <>
      <AbsoluteFill
        style={{
          zIndex: 9,
          pointerEvents: "none",
          opacity: model.gradeProfile.bloom,
          mixBlendMode: "screen",
          background:
            "radial-gradient(52% 34% at 18% 10%, rgba(255,196,122,0.22) 0%, rgba(255,196,122,0) 70%), radial-gradient(56% 38% at 82% 82%, rgba(122,166,255,0.18) 0%, rgba(122,166,255,0) 74%)"
        }}
      />
      <AbsoluteFill
        style={{
          zIndex: 10,
          pointerEvents: "none",
          opacity: grainOpacity,
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, rgba(255,255,255,0) 1px 3px), repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 1px, rgba(255,255,255,0) 1px 4px)",
          mixBlendMode: "soft-light"
        }}
      />
    </>
  );
};

export {buildMotionCompositionModel};
export {MotionChoreographyOverlay} from "./MotionChoreographyOverlay";
export {CinematicPiPOverlay} from "./CinematicPiPOverlay";
export {Motion3DOverlay} from "./Motion3DOverlay";
