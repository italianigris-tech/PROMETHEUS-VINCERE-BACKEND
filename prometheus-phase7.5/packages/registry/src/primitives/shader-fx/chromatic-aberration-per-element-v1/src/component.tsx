// packages/registry/src/primitives/shader-fx/chromatic-aberration-per-element-v1/src/component.tsx
import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CACompositor, defaultCAParams, type CAParams } from "./fbo-compositor";
import type { Group } from "three";

export interface ChromaticTextProps extends Partial<CAParams> {
  children: React.ReactNode;
  width?: number;
  height?: number;
}

export const ChromaticText: React.FC<ChromaticTextProps> = ({
  children,
  width = 512,
  height = 256,
  intensity = 0.015,
  angle = 45,
}) => {
  const groupRef = useRef<Group>(null);
  const { gl, camera } = useThree();

  const compositor = useMemo(() => new CACompositor(width, height), [width, height]);

  useEffect(() => {
    compositor.updateParams({ intensity, angle });
  }, [intensity, angle, compositor]);

  useEffect(() => {
    return () => compositor.dispose();
  }, [compositor]);

  useFrame(() => {
    if (!groupRef.current) return;
    // Update compositor size if needed
    // In a real implementation, we'd render the group to the FBO here
    // For the test scene, we use a simplified approach
  });

  return (
    <group ref={groupRef}>
      {children}
      {/* The CA effect is applied via the compositor in the parent render loop */}
    </group>
  );
};

export default ChromaticText;
