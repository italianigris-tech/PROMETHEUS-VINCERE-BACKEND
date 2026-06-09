// packages/registry/src/primitives/material/chrome-text-v1/test/visual.test.scene.tsx
import React from "react";
import { Canvas } from "@react-three/fiber";
import { ChromeText } from "../src/component";
import { OrbitControls } from "@react-three/drei";

/**
 * Visual Test Scene: Chrome Text
 * Expected output: 3D metallic text "CHROME" with mirror-like reflections
 * rotating slowly to show envMap response.
 */
export const ChromeTextVisualScene: React.FC = () => {
  return (
    <div style={{ width: 800, height: 600, background: "#111" }}>
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }} gl={{ antialias: true }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={1.0} />
        <ChromeText
          position={[0, 0, 0]}
          fontSize={3}
          extrudeDepth={0.5}
          metalness={1.0}
          roughness={0.05}
          envMapIntensity={2.0}
          color="#E0E0FF"
        >
          CHROME
        </ChromeText>
        <OrbitControls autoRotate autoRotateSpeed={2.0} />
      </Canvas>
    </div>
  );
};

export default ChromeTextVisualScene;
