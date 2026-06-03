import {describe, expect, it} from "vitest";

import {
  lookAtProxy,
  resetGsapProxies,
  resolveCameraRigPreset,
  useRenderProxyStore
} from "./gsap-proxy.js";

describe("camera rig proxies", () => {
  it("defaults to the cinematic push rig and resets the animated look-at target", () => {
    expect(resolveCameraRigPreset(undefined)).toBe("cinematic-push");

    resetGsapProxies({cameraZ: 12, lookAtZ: -2.4, rig: "orbit-reveal"});

    expect(lookAtProxy).toMatchObject({x: 0, y: 0, z: -2.4});
    expect(useRenderProxyStore.getState().lookAt).toMatchObject({x: 0, y: 0, z: -2.4});
  });
});
