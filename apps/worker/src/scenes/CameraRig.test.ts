import {describe, expect, it} from "vitest";

import {
  clampLookAtToSafeZone,
  normalizeCameraKeyframes,
  rollCameraUpVector,
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
});
