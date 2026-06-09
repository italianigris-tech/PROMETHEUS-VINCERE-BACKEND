// packages/registry/src/primitives/shader-fx/bloom-v1/test/visual.test.scene.tsx
import React from "react";
import { Canvas } from "@react-three/fiber";
import { BloomEffect } from "../src/component";
import { Text } from "troika-three-text";
import { extend } from "@react-three/fiber";

extend({ Text });

declare global {
  namespace JSX {
    interface IntrinsicElements {
      text: any;
    }
  }
}

/**
 * Visual Test Scene: Bloom
 * Expected output: Bright text "BLOOM" with a soft luminous halo.
 * The dark background should show the glow bleeding slightly around the letters.
 */
export const BloomVisualScene: React.FC = () => {
  return (
    <div style={{ width: 800, height: 600, background: "#050505" }}>
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }} gl={{ antialias: false }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[0, 0, 5]} intensity={2} color="#FFFFFF" />
        <text position={[0, 0, 0]} fontSize={3} color="#FFFFFF" anchorX="center" anchorY="middle">
          BLOOM
        </text>
        <BloomEffect strength={0.6} radius={0.5} threshold={0.7} />
      </Canvas>
    </div>
  );
};

export default BloomVisualScene;
