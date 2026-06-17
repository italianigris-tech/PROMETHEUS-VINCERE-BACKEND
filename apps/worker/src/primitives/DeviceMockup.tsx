import React, {useMemo} from "react";
import * as THREE from "three";
import {Text as TroikaText} from "troika-three-text";

export type DeviceMockupType = "phone" | "laptop" | "tablet";
export type DeviceVector3 = readonly [number, number, number];

export type DeviceMockupScreen = {
  color?: string;
  label?: string;
};

export type DeviceMockupConfig = {
  id: string;
  deviceType: DeviceMockupType;
  position?: DeviceVector3;
  rotation?: DeviceVector3;
  scale?: number;
  screen?: DeviceMockupScreen;
};

export type ResolvedDeviceMockupConfig = Required<Omit<DeviceMockupConfig, "screen">> & {
  screen: Required<DeviceMockupScreen>;
  dimensions: {
    width: number;
    height: number;
    depth: number;
    screenWidth: number;
    screenHeight: number;
  };
};

export type DeviceMockupCostEstimate = {
  drawCalls: number;
  geometries: number;
  materials: number;
  textureTargets: number;
  estimatedFillPixels: number;
};

const DEVICE_DIMENSIONS: Record<DeviceMockupType, ResolvedDeviceMockupConfig["dimensions"]> = {
  phone: {
    width: 2.15,
    height: 4.35,
    depth: 0.18,
    screenWidth: 1.82,
    screenHeight: 3.78
  },
  tablet: {
    width: 4.6,
    height: 6.2,
    depth: 0.16,
    screenWidth: 4.05,
    screenHeight: 5.45
  },
  laptop: {
    width: 6.8,
    height: 4.35,
    depth: 0.18,
    screenWidth: 6.12,
    screenHeight: 3.55
  }
};

const DEFAULT_POSITION: DeviceVector3 = [0, 0, -1.2];
const DEFAULT_ROTATION: DeviceVector3 = [0, -0.16, 0];
const DEFAULT_SCREEN: Required<DeviceMockupScreen> = {
  color: "#111827",
  label: ""
};

const DEVICE_FILL_PIXELS: Record<DeviceMockupType, number> = {
  phone: 304_920,
  tablet: 929_752,
  laptop: 963_168
};

export const normalizeDeviceMockupConfig = (
  config: DeviceMockupConfig
): ResolvedDeviceMockupConfig => {
  const dimensions = DEVICE_DIMENSIONS[config.deviceType];
  if (!dimensions) {
    throw new Error(`Unsupported device mockup type: ${String(config.deviceType)}`);
  }

  return {
    id: config.id,
    deviceType: config.deviceType,
    position: config.position ?? DEFAULT_POSITION,
    rotation: config.rotation ?? DEFAULT_ROTATION,
    scale: config.scale ?? 1,
    screen: {
      ...DEFAULT_SCREEN,
      ...config.screen
    },
    dimensions
  };
};

export const estimateDeviceMockupCost = (
  config: DeviceMockupConfig
): DeviceMockupCostEstimate => {
  const resolved = normalizeDeviceMockupConfig(config);
  return {
    drawCalls: 5,
    geometries: 5,
    materials: 5,
    textureTargets: 0,
    estimatedFillPixels: DEVICE_FILL_PIXELS[resolved.deviceType]
  };
};

const DeviceLabel: React.FC<{
  label: string;
  width: number;
  z: number;
}> = ({label, width, z}) => {
  const text = useMemo(() => {
    const mesh = new TroikaText();
    mesh.text = label;
    mesh.anchorX = "center";
    mesh.anchorY = "middle";
    mesh.fontSize = Math.min(0.34, Math.max(0.16, width / 9));
    mesh.maxWidth = width * 0.78;
    mesh.color = "#f8fbff";
    mesh.sync();
    return mesh;
  }, [label, width]);

  if (!label) {
    return null;
  }

  return <primitive object={text} position={[0, 0, z]} />;
};

export const DeviceMockup: React.FC<{config: DeviceMockupConfig}> = ({config}) => {
  const resolved = useMemo(() => normalizeDeviceMockupConfig(config), [config]);
  const {dimensions} = resolved;
  const bodyRadius = Math.min(dimensions.width, dimensions.height) * 0.08;
  const screenZ = dimensions.depth / 2 + 0.012;
  const bezelZ = dimensions.depth / 2 + 0.004;

  return (
    <group
      name={`device-mockup:${resolved.id}`}
      position={resolved.position as [number, number, number]}
      rotation={resolved.rotation as [number, number, number]}
      scale={resolved.scale}
    >
      <mesh name="device-body">
        <boxGeometry args={[dimensions.width, dimensions.height, dimensions.depth, 6, 6, 1]} />
        <meshBasicMaterial color="#09090b" toneMapped={false} />
      </mesh>
      <mesh name="device-highlight" position={[0, 0, bezelZ + 0.002]}>
        <boxGeometry args={[dimensions.width - bodyRadius, dimensions.height - bodyRadius, 0.012]} />
        <meshBasicMaterial color="#27272a" transparent opacity={0.52} toneMapped={false} />
      </mesh>
      <mesh name="device-screen" position={[0, 0, screenZ]}>
        <planeGeometry args={[dimensions.screenWidth, dimensions.screenHeight]} />
        <meshBasicMaterial color={resolved.screen.color} toneMapped={false} />
      </mesh>
      <mesh name="device-screen-gloss" position={[0, dimensions.screenHeight * 0.18, screenZ + 0.003]}>
        <planeGeometry args={[dimensions.screenWidth * 0.9, dimensions.screenHeight * 0.38]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.08} toneMapped={false} />
      </mesh>
      <DeviceLabel label={resolved.screen.label} width={dimensions.screenWidth} z={screenZ + 0.006} />
    </group>
  );
};
