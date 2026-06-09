// packages/registry/src/primitives/motion/per-word-stagger-v1/test/visual.test.scene.tsx
import React from "react";
import { Canvas } from "@react-three/fiber";
import { PerWordStagger } from "../src/component";

/**
 * Visual Test Scene: Per-Word Stagger
 * Expected output: Words "NOT YOUR AVERAGE MOTION DESIGN" enter sequentially
 * with slight rotation and upward drift, each offset by 0.08s.
 */
export const PerWordStaggerVisualScene: React.FC = () => {
  return (
    <div style={{ width: 800, height: 600, background: "#0a0a0a" }}>
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <PerWordStagger
          position={[0, 0, 0]}
          fontSize={1.2}
          delay={0.15}
          rotationAmplitude={20}
          driftY={1.0}
          duration={1.5}
          ease="back.out(1.7)"
        >
          NOT YOUR AVERAGE MOTION DESIGN
        </PerWordStagger>
      </Canvas>
    </div>
  );
};

export default PerWordStaggerVisualScene;
