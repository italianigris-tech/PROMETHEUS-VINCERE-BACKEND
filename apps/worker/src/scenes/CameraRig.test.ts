import {describe, expect, it} from "vitest";
import * as THREE from "three";

import {
  clampLookAtToSafeZone,
  collectCameraDirectiveSegments,
  sampleBlendedCameraDirectiveOffset,
  normalizeCameraKeyframes,
  rollCameraUpVector,
  sampleCameraDirectiveOffset,
  useCameraRigStore
} from "./CameraRig.js";

describe("CameraRig helpers", () => {
  it("clamps interpolated lookAt targets to the matte-safe zone", () => {
    const target = clampLookAtToSafeZone(
      {x: 4, y: -3, z: 2},
      {minX: -0.45, maxX: 0.45, minY: -0.4, maxY: 0.4}
    );

    expect(target).toEqual({x: 0.45, y: -0.4, z: 2});
  });

  it("falls back to a static camera when fewer than two keyframes are available", () => {
    const keyframes = normalizeCameraKeyframes([
      {position: {x: 1, y: 2, z: 3}, lookAt: {x: 4, y: 5, z: 6}, roll: 0.7}
    ]);

    expect(keyframes).toEqual([
      {position: {x: 0, y: 0, z: 50}, lookAt: {x: 0, y: 0, z: 0}, roll: 0},
      {position: {x: 0, y: 0, z: 50}, lookAt: {x: 0, y: 0, z: 0}, roll: 0}
    ]);
  });

  it("initializes velocity stores for post-processing consumers", () => {
    const state = useCameraRigStore.getState();

    expect(state.cameraVelocity.toArray()).toEqual([0, 0, 0]);
    expect(state.wordVelocities).toBeInstanceOf(Map);
    expect(state.wordVelocities.size).toBe(0);
  });

  it("applies camera roll to the up vector before lookAt", () => {
    const up = rollCameraUpVector(Math.PI / 2);

    expect(up.x).toBeCloseTo(-1);
    expect(up.y).toBeCloseTo(0);
    expect(up.z).toBeCloseTo(0);
  });

  it("samples camera directive offsets without accumulating frame drift", () => {
    const directive = {
      type: "drift" as const,
      target: null,
      intensity: 0.7,
      overshoot: 0,
      coupling: "loose" as const
    };

    const first = sampleCameraDirectiveOffset(directive, 3);
    const second = sampleCameraDirectiveOffset(directive, 3);
    const later = sampleCameraDirectiveOffset(directive, 4);

    expect(second.toArray()).toEqual(first.toArray());
    expect(later.toArray()).not.toEqual(first.toArray());
  });

  it("blends sequential camera directives into a continuous accumulated offset", () => {
    const emotionalArc = [
      {
        id: "push",
        timestamp: [0, 1000] as [number, number],
        emotion: "tension" as const,
        intensity: 1,
        motionVocabulary: ["pressure"],
        cameraDirective: {
          type: "push-in" as const,
          target: null,
          intensity: 1,
          overshoot: 0,
          coupling: "tight" as const
        },
        why: "build pressure"
      },
      {
        id: "pull",
        timestamp: [1000, 2000] as [number, number],
        emotion: "release" as const,
        intensity: 1,
        motionVocabulary: ["release"],
        cameraDirective: {
          type: "pull-out" as const,
          target: null,
          intensity: 0.5,
          overshoot: 0,
          coupling: "loose" as const
        },
        why: "release pressure"
      }
    ];

    const segments = collectCameraDirectiveSegments(emotionalArc);
    const beforeBoundary = sampleBlendedCameraDirectiveOffset(segments, 0.99, new THREE.Vector3());
    const afterBoundary = sampleBlendedCameraDirectiveOffset(segments, 1.01, new THREE.Vector3());
    const settled = sampleBlendedCameraDirectiveOffset(segments, 2, new THREE.Vector3());

    expect(Math.abs(afterBoundary.z - beforeBoundary.z)).toBeLessThan(0.01);
    expect(settled.z).toBeCloseTo(-2);
  });

  it("adds overlapping directive contributions instead of overwriting them", () => {
    const segments = collectCameraDirectiveSegments([
      {
        id: "push",
        timestamp: [0, 1000],
        emotion: "tension",
        intensity: 1,
        motionVocabulary: ["pressure"],
        cameraDirective: {
          type: "push-in",
          target: null,
          intensity: 1,
          overshoot: 0,
          coupling: "tight"
        },
        why: "z pressure"
      },
      {
        id: "drift",
        timestamp: [0, 1000],
        emotion: "chaos",
        intensity: 1,
        motionVocabulary: ["drift"],
        cameraDirective: {
          type: "drift",
          target: null,
          intensity: 1,
          overshoot: 0,
          coupling: "loose"
        },
        why: "xy motion"
      }
    ]);

    const blended = sampleBlendedCameraDirectiveOffset(segments, 0.5, new THREE.Vector3());

    expect(blended.z).toBeLessThan(0);
    expect(Math.abs(blended.x) + Math.abs(blended.y)).toBeGreaterThan(0);
  });
});
