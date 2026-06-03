import {create} from "zustand";

export type CameraProxyState = {
  x: number;
  y: number;
  z: number;
  rotationZ: number;
};

export type CameraRigPreset = "cinematic-push" | "orbit-reveal" | "whip-pan";

export type LookAtProxyState = {
  x: number;
  y: number;
  z: number;
};

export type TextProxyState = {
  uProgress: number;
};

export type RenderProxyState = {
  camera: CameraProxyState;
  lookAt: LookAtProxyState;
  text: TextProxyState;
  rig: CameraRigPreset;
};

export const resolveCameraRigPreset = (rig: CameraRigPreset | undefined): CameraRigPreset =>
  rig ?? "cinematic-push";

export const cameraProxy: CameraProxyState = {
  x: 0,
  y: 0,
  z: 10,
  rotationZ: 0
};

export const lookAtProxy: LookAtProxyState = {
  x: 0,
  y: 0,
  z: -2.2
};

export const textProxy: TextProxyState = {
  uProgress: 0
};

export const useRenderProxyStore = create<RenderProxyState>(() => ({
  camera: {...cameraProxy},
  lookAt: {...lookAtProxy},
  text: {...textProxy},
  rig: "cinematic-push"
}));

export const resetGsapProxies = (input: {
  cameraZ: number;
  lookAtZ?: number;
  rig?: CameraRigPreset;
}) => {
  const rig = resolveCameraRigPreset(input.rig);
  cameraProxy.x = 0;
  cameraProxy.y = 0;
  cameraProxy.z = input.cameraZ;
  cameraProxy.rotationZ = 0;
  lookAtProxy.x = 0;
  lookAtProxy.y = 0;
  lookAtProxy.z = input.lookAtZ ?? -2.2;
  textProxy.uProgress = 0;
  syncGsapProxiesToStore(rig);
};

export const syncGsapProxiesToStore = (rig?: CameraRigPreset) => {
  useRenderProxyStore.setState({
    camera: {...cameraProxy},
    lookAt: {...lookAtProxy},
    text: {...textProxy},
    ...(rig ? {rig} : null)
  });
};
