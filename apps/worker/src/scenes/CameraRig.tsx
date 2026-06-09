import {useEffect, useMemo, useRef} from "react";
import {useFrame, useThree} from "@react-three/fiber";
import type {CameraDirective, EmotionalBeat, RenderManifest} from "@prometheus/shared-types";
import gsap from "gsap";
import {useCurrentFrame, useVideoConfig} from "remotion";
import * as THREE from "three";
import {create} from "zustand";

type CameraKeyframe = RenderManifest["cameraKeyframes"][number];
type MatteSafeZone = RenderManifest["matteSafeZone"];
type VectorLike = {x: number; y: number; z: number};

const staticCameraKeyframes: CameraKeyframe[] = [
  {position: {x: 0, y: 0, z: 50}, lookAt: {x: 0, y: 0, z: 0}, roll: 0},
  {position: {x: 0, y: 0, z: 50}, lookAt: {x: 0, y: 0, z: 0}, roll: 0}
];

export const normalizeCameraKeyframes = (keyframes: CameraKeyframe[]): CameraKeyframe[] => {
  if (keyframes.length >= 2) {
    return keyframes;
  }

  console.warn("[CameraRig] cameraKeyframes requires at least 2 points; falling back to static camera.");
  return staticCameraKeyframes;
};

export const clampLookAtToSafeZone = (target: VectorLike, safeZone: MatteSafeZone): VectorLike => ({
  x: THREE.MathUtils.clamp(target.x, safeZone.minX, safeZone.maxX),
  y: THREE.MathUtils.clamp(target.y, safeZone.minY, safeZone.maxY),
  z: target.z
});

type CameraRigState = {
  cameraFocusDistance: number;
  cameraVelocity: THREE.Vector3;
  wordVelocities: Map<string, THREE.Vector3>;
};

export const useCameraRigStore = create<CameraRigState>()(() => ({
  cameraFocusDistance: 10,
  cameraVelocity: new THREE.Vector3(),
  wordVelocities: new Map()
}));

/**
 * Applies roll to the camera's up vector.
 * This is used to preserve roll when lookAt is called.
 * @param roll - The roll angle in radians
 * @returns A new THREE.Vector3 representing the rolled up vector
 */
export const rollCameraUpVector = (roll: number): THREE.Vector3 => {
  const up = new THREE.Vector3(0, 1, 0);
  up.applyAxisAngle(new THREE.Vector3(0, 0, 1), roll);
  return up;
};

/**
 * Finds the current emotional beat at a given time.
 * @param t - Current time in seconds
 * @param emotionalArc - Array of emotional beats
 * @returns The current emotional beat or null if none is active
 */
const findCurrentBeat = (t: number, emotionalArc: readonly EmotionalBeat[]): EmotionalBeat | null => {
  const tMs = t * 1000;
  for (const beat of emotionalArc) {
    if (tMs >= beat.timestamp[0] && tMs < beat.timestamp[1]) {
      return beat;
    }
  }
  return null;
};

export const sampleCameraDirectiveOffset = (
  directive: CameraDirective,
  t: number
): THREE.Vector3 => {
  const intensity = Math.max(0, Math.min(1, directive.intensity));

  switch (directive.type) {
    case "push-in":
      return new THREE.Vector3(0, 0, -intensity * 4.0);
    case "pull-out":
      return new THREE.Vector3(0, 0, intensity * 4.0);
    case "drift":
      return new THREE.Vector3(
        Math.sin(t * 0.4) * 30 * intensity,
        Math.cos(t * 0.3) * 30 * intensity,
        0
      );
    case "orbit":
    case "snap":
    case "hold":
      return new THREE.Vector3();
    default: {
      const _exhaustive: never = directive.type;
      return _exhaustive;
    }
  }
};

/**
 * Applies camera directive modifications to a target point BEFORE it is copied to the camera.
 * This prevents the overwrite bug where curve interpolation would clobber directive modifications.
 * @param point - The cloned curve point to modify (must be a clone, not the cached curve result)
 * @param camera - The THREE camera (for lookAt and up vector only)
 * @param directive - The camera directive
 * @param t - Current time in seconds
 * @param fps - Frames per second
 * @param totalRoll - The current total roll value
 */
const applyCameraDirective = (
  point: THREE.Vector3,
  camera: THREE.Camera,
  directive: CameraDirective,
  t: number,
  fps: number,
  totalRoll: number
): void => {
  const intensity = Math.max(0, Math.min(1, directive.intensity));
  const overshoot = Math.max(0, Math.min(1, directive.overshoot ?? 0));
  void fps;

  switch (directive.type) {
    case "push-in": {
      point.z += sampleCameraDirectiveOffset(directive, t).z;
      break;
    }
    case "pull-out": {
      point.z += sampleCameraDirectiveOffset(directive, t).z;
      break;
    }
    case "orbit": {
      const orbitRadius = 400 * intensity;
      const orbitSpeed = intensity * 0.8;
      const angle = t * orbitSpeed;
      point.x = Math.sin(angle) * orbitRadius;
      point.z = Math.cos(angle) * orbitRadius + 500;
      if (directive.target) {
        camera.lookAt(directive.target[0], directive.target[1], directive.target[2]);
      }
      break;
    }
    case "drift": {
      point.add(sampleCameraDirectiveOffset(directive, t));
      break;
    }
    case "snap": {
      if (directive.target) {
        point.set(directive.target[0], directive.target[1], directive.target[2]);
      }
      break;
    }
    case "hold": {
      // Intentional no-op. Existing interpolation dominates.
      break;
    }
    default: {
      // Exhaustiveness check
      const _exhaustive: never = directive.type;
      console.warn(`Unknown camera directive: ${_exhaustive}`);
    }
  }

  // Overshoot micro-motion on up vector
  if (overshoot > 0 && directive.type !== "hold") {
    const wobble = Math.sin(t * 4) * overshoot * 0.08;
    const up = rollCameraUpVector(totalRoll + wobble);
    camera.up.copy(up);
  }
};

export function CameraRig({manifest}: {manifest: RenderManifest}) {
  const {camera} = useThree();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const prevPosition = useRef(new THREE.Vector3());
  const prevRotation = useRef(new THREE.Euler());
  const velocity = useRef(new THREE.Vector3());
  const keyframes = useMemo(() => normalizeCameraKeyframes(manifest.cameraKeyframes), [manifest.cameraKeyframes]);
  const curve = useMemo(() => {
    const points = keyframes.map((kf) => new THREE.Vector3(kf.position.x, kf.position.y, kf.position.z));
    return new THREE.CatmullRomCurve3(points);
  }, [keyframes]);
  const timelineState = useMemo(() => {
    const progress = {value: 0};
    const durationFrames = Math.max(1, manifest.durationInFrames);
    const timeline = gsap.timeline({paused: true});
    timeline.to(progress, {
      value: 1,
      duration: durationFrames / Math.max(fps, 1),
      ease: "none"
    });
    return {progress, timeline};
  }, [fps, manifest.durationInFrames]);

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = manifest.width / manifest.height;
      camera.fov = manifest.camera.fov;
      camera.near = 0.1;
      camera.far = 100;
      camera.updateProjectionMatrix();
    }
  }, [camera, manifest.camera.fov, manifest.height, manifest.width]);

  useEffect(() => {
    return () => {
      timelineState.timeline.kill();
    };
  }, [timelineState.timeline]);

  useFrame(() => {
    const currentTime = frame / Math.max(fps, 1);
    timelineState.timeline.seek(currentTime, false);

    const t = THREE.MathUtils.clamp(timelineState.progress.value, 0, 1);
    // MUST clone — getPointAt may return a cached instance that we must not mutate
    const point = curve.getPointAt(t).clone();

    const segment = t * (keyframes.length - 1);
    const index = Math.floor(segment);
    const alpha = segment - index;
    const i0 = Math.min(index, keyframes.length - 1);
    const i1 = Math.min(index + 1, keyframes.length - 1);
    const k0 = keyframes[i0];
    const k1 = keyframes[i1];
    if (!k0 || !k1) {
      camera.position.copy(point);
      return;
    }

    const interpolatedLookAt = {
      x: THREE.MathUtils.lerp(k0.lookAt.x, k1.lookAt.x, alpha),
      y: THREE.MathUtils.lerp(k0.lookAt.y, k1.lookAt.y, alpha),
      z: THREE.MathUtils.lerp(k0.lookAt.z, k1.lookAt.z, alpha)
    };
    const clampedLookAt = clampLookAtToSafeZone(interpolatedLookAt, manifest.matteSafeZone);
    const lookAtTarget = new THREE.Vector3(clampedLookAt.x, clampedLookAt.y, clampedLookAt.z);

    // Calculate total roll BEFORE lookAt
    let totalRoll = THREE.MathUtils.lerp(k0.roll, k1.roll, alpha);
    if (manifest.autoRoll) {
      const tangent = curve.getTangentAt(t).normalize();
      const horizontalTangent = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();
      const bankAngle = horizontalTangent.lengthSq() === 0
        ? 0
        : Math.acos(THREE.MathUtils.clamp(tangent.dot(horizontalTangent), -1, 1)) * Math.sign(tangent.y);
      totalRoll += bankAngle * manifest.autoRollIntensity;
    }

    // Apply camera directive from directorialMetadata BEFORE copying point to camera
    // This fixes the overwrite bug: directives modify `point`, then we copy once.
    const meta = manifest.directorialMetadata;
    if (meta?.emotionalArc) {
      const currentBeat = findCurrentBeat(currentTime, meta.emotionalArc);
      if (currentBeat?.cameraDirective) {
        applyCameraDirective(point, camera, currentBeat.cameraDirective, currentTime, fps, totalRoll);
      }
    }

    // Single copy — after all modifications to `point` are complete
    camera.position.copy(point);

    // Apply roll to up vector BEFORE lookAt (fixes roll bug)
    const rolledUp = rollCameraUpVector(totalRoll);
    camera.up.copy(rolledUp);
    camera.lookAt(lookAtTarget);

    if (manifest.depthOfFieldEnabled) {
      const focusDistance = camera.position.distanceTo(lookAtTarget);
      // TODO Phase 5: implement post-processing DOF pass. Phase 4 stores focus distance only.
      useCameraRigStore.setState({cameraFocusDistance: focusDistance});
    }

    velocity.current.subVectors(camera.position, prevPosition.current).multiplyScalar(Math.max(fps, 1));
    useCameraRigStore.setState({cameraVelocity: velocity.current.clone()});

    prevPosition.current.copy(camera.position);
    prevRotation.current.copy(camera.rotation);
  });

  return null;
}
