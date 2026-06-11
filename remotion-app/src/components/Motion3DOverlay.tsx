import React, {useEffect, useMemo, useRef, useState} from "react";
import {AbsoluteFill, staticFile, useVideoConfig} from "remotion";

import type {MotionCompositionModel} from "../lib/motion-platform/scene-engine";
import {selectActiveMotionSceneAtTime} from "../lib/motion-platform/scene-engine";
import {resolveMotion3DConfig} from "../lib/motion-3d/motion-3d-config";
import {buildMotion3DSceneRuntime, type Motion3DSceneRuntime} from "../lib/motion-3d/motion-3d-runtime";
import {
  resolveMotionChoreographySceneStateAtTime,
  selectActiveMotionChoreographySceneAtTime
} from "../lib/motion-platform/choreography-planner";
import {resolveReferenceMotionAtFrame} from "../lib/reference-motion-trace";
import {useStablePreviewFrame} from "../lib/preview-runtime-stability";

type Motion3DOverlayProps = {
  model: MotionCompositionModel;
  stabilizePreviewTimeline?: boolean;
  previewTimelineResetVersion?: number;
};

export const Motion3DOverlay: React.FC<Motion3DOverlayProps> = ({
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
  const sceneSpec = activeScene ? model.motion3DPlan.sceneMap[activeScene.id] : null;
  const choreographyScene = useMemo(
    () => selectActiveMotionChoreographySceneAtTime({
      plan: model.choreographyPlan,
      currentTimeMs
    }),
    [currentTimeMs, model.choreographyPlan]
  );
  const resolvedSceneSpec = useMemo(() => {
    if (!sceneSpec) {
      return null;
    }
    return {
      ...sceneSpec,
      layers: sceneSpec.layers.map((layer) => {
        if (!layer.src) {
          return layer;
        }
        if (/^(https?:)?\/\//.test(layer.src) || layer.src.startsWith("/")) {
          return layer;
        }
        return {
          ...layer,
          src: staticFile(layer.src)
        };
      })
    };
  }, [sceneSpec]);
  const [ready, setReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<Motion3DSceneRuntime | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !resolvedSceneSpec || !model.motion3DPlan.enabled) {
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
      setReady(false);
      return;
    }

    let cancelled = false;
    const config = resolveMotion3DConfig({
      enabled: model.motion3DPlan.enabled,
      mode: model.motion3DPlan.mode
    });

    buildMotion3DSceneRuntime({
      canvas,
      sceneSpec: resolvedSceneSpec,
      config,
      size: {width, height}
    }).then((runtime) => {
      if (cancelled) {
        runtime.dispose();
        return;
      }
      runtimeRef.current?.dispose();
      runtimeRef.current = runtime;
      setReady(true);
    });

    return () => {
      cancelled = true;
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
  }, [height, model.motion3DPlan.enabled, model.motion3DPlan.mode, resolvedSceneSpec?.id, width]);

  useEffect(() => {
    if (!ready || !resolvedSceneSpec || !runtimeRef.current) {
      return;
    }
    const runtime = runtimeRef.current;
    const matchingChoreographyScene = choreographyScene?.sceneId === resolvedSceneSpec.id
      ? choreographyScene
      : null;
    const sceneState = matchingChoreographyScene
      ? resolveMotionChoreographySceneStateAtTime({
        scene: matchingChoreographyScene,
        currentTimeMs
      })
      : null;

    if (sceneState) {
      const baseCamera = runtime.camera.userData.basePosition as {x: number; y: number; z: number} | undefined;
      if (baseCamera) {
        runtime.camera.position.x = baseCamera.x + sceneState.stageTransform.translateX * 0.28;
        runtime.camera.position.y = baseCamera.y - sceneState.stageTransform.translateY * 0.22;
        runtime.camera.position.z = baseCamera.z / Math.max(0.82, sceneState.stageTransform.scale);
        runtime.camera.rotation.z = (sceneState.stageTransform.rotateDeg * Math.PI) / 180 * 0.42;
      }
      runtime.layers.forEach((mesh, layerId) => {
        const basePosition = mesh.userData.basePosition as {x: number; y: number; z: number} | undefined;
        const baseScale = (mesh.userData.baseScale as number | undefined) ?? 1;
        const baseRotation = (mesh.userData.baseRotationZ as number | undefined) ?? 0;
        const baseOpacity = (mesh.userData.baseOpacity as number | undefined) ?? 1;
        const state = sceneState.targetTransforms[layerId];
        if (!basePosition || !state) {
          return;
        }
        mesh.position.set(
          basePosition.x + state.translateX,
          basePosition.y - state.translateY,
          basePosition.z + state.depth
        );
        mesh.scale.setScalar(baseScale * state.scale);
        mesh.rotation.z = baseRotation + (state.rotateDeg * Math.PI) / 180;
        (mesh.material as {opacity: number}).opacity = baseOpacity * state.opacity;
      });
    } else {
      const durationMs = Math.max(1, resolvedSceneSpec.endMs - resolvedSceneSpec.startMs);
      const localMs = Math.max(0, Math.min(durationMs, currentTimeMs - resolvedSceneSpec.startMs));
      runtime.timeline.seek(localMs / 1000, false);
      const focusLayer = resolvedSceneSpec.focusLayerId ? runtime.layers.get(resolvedSceneSpec.focusLayerId) : null;
      if (focusLayer) {
        runtime.camera.lookAt(focusLayer.position);
      }
    }

    const cameraTrace = resolveReferenceMotionAtFrame({
      trace: model.referenceMotionTrace,
      targetId: "camera",
      frame: stableFrame,
      fps
    });
    if (cameraTrace) {
      runtime.camera.position.x += cameraTrace.translateX;
      runtime.camera.position.y -= cameraTrace.translateY;
      runtime.camera.position.z += cameraTrace.depth;
      runtime.camera.rotation.z += (cameraTrace.rotateDeg * Math.PI) / 180;
    }
    runtime.layers.forEach((mesh, layerId) => {
      const trace = resolveReferenceMotionAtFrame({
        trace: model.referenceMotionTrace,
        targetId: layerId,
        frame: stableFrame,
        fps
      });
      if (!trace) {
        return;
      }
      if (sceneState && !sceneState.targetTransforms[layerId]) {
        const basePosition = mesh.userData.basePosition as {x: number; y: number; z: number} | undefined;
        const baseScale = (mesh.userData.baseScale as number | undefined) ?? 1;
        const baseRotation = (mesh.userData.baseRotationZ as number | undefined) ?? 0;
        const baseOpacity = (mesh.userData.baseOpacity as number | undefined) ?? 1;
        if (basePosition) {
          mesh.position.set(basePosition.x + trace.translateX, basePosition.y - trace.translateY, basePosition.z + trace.depth);
        }
        mesh.scale.setScalar(baseScale);
        mesh.rotation.z = baseRotation;
        (mesh.material as {opacity: number}).opacity = baseOpacity;
      } else if (!sceneState) {
        const baseScale = (mesh.userData.baseScale as number | undefined) ?? 1;
        const baseRotation = (mesh.userData.baseRotationZ as number | undefined) ?? 0;
        mesh.scale.setScalar(baseScale);
        mesh.rotation.z = baseRotation;
      }
      mesh.position.x += trace.translateX;
      mesh.position.y -= trace.translateY;
      mesh.position.z += trace.depth;
      mesh.scale.multiplyScalar(trace.scale);
      mesh.rotation.z += (trace.rotateDeg * Math.PI) / 180;
      (mesh.material as {opacity: number}).opacity *= trace.opacity;
    });
    runtime.renderer.render(runtime.scene, runtime.camera);
  }, [choreographyScene, currentTimeMs, fps, model.referenceMotionTrace, ready, resolvedSceneSpec, stableFrame]);

  if (!model.motion3DPlan.enabled || !resolvedSceneSpec) {
    return null;
  }

  return (
    <AbsoluteFill style={{pointerEvents: "none", zIndex: 4}}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: "100%",
          height: "100%",
          display: "block"
        }}
      />
    </AbsoluteFill>
  );
};
