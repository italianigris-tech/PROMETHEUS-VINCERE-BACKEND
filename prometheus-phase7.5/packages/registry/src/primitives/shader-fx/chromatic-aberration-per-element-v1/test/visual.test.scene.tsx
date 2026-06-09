// packages/registry/src/primitives/shader-fx/chromatic-aberration-per-element-v1/test/visual.test.scene.tsx
import React from "react";
import { Canvas } from "@react-three/fiber";
import { ChromaticText } from "../src/component";
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
 * Visual Test Scene: Chromatic Aberration (Per-Element)
 * Expected output: Text "CHROMATIC" with RGB fringes on edges.
 * Background grid should remain perfectly sharp (no full-screen blur).
 */
export const ChromaticAberrationVisualScene: React.FC = () => {
  return (
    <div style={{ width: 800, height: 600, background: "#000" }}>
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }} gl={{ antialias: true }}>
        <ambientLight intensity={0.5} />
        <ChromaticText intensity={0.025} angle={30} width={512} height={128}>
          <text position={[0, 0, 0]} fontSize={2} color="#FFFFFF" anchorX="center" anchorY="middle">
            CHROMATIC
          </text>
        </ChromaticText>
        {/* Background grid to prove no full-screen effect */}
        <gridHelper args={[20, 20, 0x333333, 0x111111]} position={[0, -3, -2]} />
      </Canvas>
    </div>
  );
};

export default ChromaticAberrationVisualScene;
