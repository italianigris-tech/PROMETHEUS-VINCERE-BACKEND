// packages/registry/src/primitives/ui-element/pill-stack-v1/test/visual.test.scene.tsx
import React from "react";
import { Canvas } from "@react-three/fiber";
import { PillStack } from "../src/component";
import { OrbitControls } from "@react-three/drei";

/**
 * Visual Test Scene: Pill Stack
 * Expected output: 3 white rounded pills stacked vertically with z-depth offset.
 * Hovering over a pill should lift it toward the camera.
 */
export const PillStackVisualScene: React.FC = () => {
  return (
    <div style={{ width: 800, height: 600, background: "#0a0a0a" }}>
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }} gl={{ antialias: true }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1.0} />
        <PillStack
          position={[0, 1, 0]}
          depth={3}
          width={3.5}
          height={0.9}
          gap={0.2}
          color="#F0F0F0"
          hoverLift={0.3}
          shadowBlur={0.4}
          labels={["DESIGN", "MOTION", "STUDIO"]}
        />
        <OrbitControls />
      </Canvas>
    </div>
  );
};

export default PillStackVisualScene;
