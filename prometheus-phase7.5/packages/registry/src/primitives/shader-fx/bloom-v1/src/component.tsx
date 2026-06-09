// packages/registry/src/primitives/shader-fx/bloom-v1/src/component.tsx
import React, { useEffect, useMemo } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { BloomPassManager, type BloomParams } from "./pass";

export interface BloomProps extends Partial<BloomParams> {
  enabled?: boolean;
}

export const BloomEffect: React.FC<BloomProps> = ({
  enabled = true,
  strength = 0.4,
  radius = 0.5,
  threshold = 0.8,
}) => {
  const { gl, scene, camera } = useThree();

  const manager = useMemo(() => {
    return new BloomPassManager(gl, scene, camera);
  }, [gl, scene, camera]);

  useEffect(() => {
    if (enabled) {
      manager.updateParams({ strength, radius, threshold });
    }
  }, [enabled, strength, radius, threshold, manager]);

  useEffect(() => {
    return () => manager.dispose();
  }, [manager]);

  useFrame(() => {
    if (enabled) {
      manager.render();
    }
  }, 1); // Render after everything else (post-render priority)

  return null;
};

export default BloomEffect;
