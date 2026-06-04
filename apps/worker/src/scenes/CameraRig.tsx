import {useEffect, useMemo, useRef} from "react";
import {useFrame, useThree} from "@react-three/fiber";
import type {RenderManifest} from "@prometheus/shared-types";
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
    const point = curve.getPointAt(t);
    camera.position.copy(point);

    const segment = t * (keyframes.length - 1);
    const index = Math.floor(segment);
    const alpha = segment - index;
    const i0 = Math.min(index, keyframes.length - 1);
    const i1 = Math.min(index + 1, keyframes.length - 1);
    const k0 = keyframes[i0];
    const k1 = keyframes[i1];
    if (!k0 || !k1) {
      return;
    }

    const interpolatedLookAt = {
      x: THREE.MathUtils.lerp(k0.lookAt.x, k1.lookAt.x, alpha),
      y: THREE.MathUtils.lerp(k0.lookAt.y, k1.lookAt.y, alpha),
      z: THREE.MathUtils.lerp(k0.lookAt.z, k1.lookAt.z, alpha)
    };
    const clampedLookAt = clampLookAtToSafeZone(interpolatedLookAt, manifest.matteSafeZone);
    const lookAtTarget = new THREE.Vector3(clampedLookAt.x, clampedLookAt.y, clampedLookAt.z);

    camera.lookAt(lookAtTarget);

    let totalRoll = THREE.MathUtils.lerp(k0.roll, k1.roll, alpha);
    if (manifest.autoRoll) {
      const tangent = curve.getTangentAt(t).normalize();
      const horizontalTangent = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();
      const bankAngle = horizontalTangent.lengthSq() === 0
        ? 0
        : Math.acos(THREE.MathUtils.clamp(tangent.dot(horizontalTangent), -1, 1)) * Math.sign(tangent.y);
      totalRoll += bankAngle * manifest.autoRollIntensity;
    }

    camera.rotateZ(totalRoll);

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
