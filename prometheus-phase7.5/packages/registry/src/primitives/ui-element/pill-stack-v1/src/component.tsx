// packages/registry/src/primitives/ui-element/pill-stack-v1/src/component.tsx
import React, { useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, MeshStandardMaterial, Color } from "three";
import gsap from "gsap";
import { createPillGeometry, type PillGeometryParams } from "./geometry";

export interface PillStackProps {
  depth?: number;
  shadowBlur?: number;
  hoverLift?: number;
  color?: string;
  width?: number;
  height?: number;
  gap?: number;
  position?: [number, number, number];
  labels?: string[];
}

export const PillStack: React.FC<PillStackProps> = ({
  depth = 3,
  shadowBlur = 0.5,
  hoverLift = 0.2,
  color = "#FFFFFF",
  width = 3,
  height = 0.8,
  gap = 0.15,
  position = [0, 0, 0],
  labels = ["PILL 1", "PILL 2", "PILL 3"],
}) => {
  const groupRef = useRef<any>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const geometry = useMemo(() => {
    return createPillGeometry({ width, height, depth: 0.2, cornerRadius: height * 0.25 });
  }, [width, height]);

  const material = useMemo(() => {
    return new MeshStandardMaterial({
      color: new Color(color),
      metalness: 0.1,
      roughness: 0.4,
      transparent: true,
      opacity: 0.95,
    });
  }, [color]);

  const shadowMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: new Color(0x000000),
      transparent: true,
      opacity: 0.3,
      roughness: 1,
      metalness: 0,
    });
  }, []);

  const pills = useMemo(() => {
    return Array.from({ length: depth }).map((_, i) => ({
      id: i,
      y: -i * (height + gap),
      z: -i * 0.1,
      label: labels[i] || `PILL ${i + 1}`,
    }));
  }, [depth, height, gap, labels]);

  // Entrance animation
  useFrame(() => {
    if (!groupRef.current) return;
    // Sync any GSAP animations
  });

  return (
    <group ref={groupRef} position={position}>
      {pills.map((pill, i) => (
        <group key={pill.id} position={[0, pill.y, pill.z]}>
          {/* Shadow layer */}
          <mesh
            geometry={geometry}
            material={shadowMaterial}
            position={[shadowBlur * 0.3, -shadowBlur * 0.3, -0.05]}
            scale={[1.02, 1.02, 0.5]}
          />
          {/* Main pill */}
          <mesh
            geometry={geometry}
            material={material}
            onPointerOver={() => setHoveredIndex(i)}
            onPointerOut={() => setHoveredIndex(null)}
            onUpdate={(self) => {
              if (hoveredIndex === i) {
                gsap.to(self.position, { z: pill.z + hoverLift, duration: 0.3, ease: "power2.out" });
              } else {
                gsap.to(self.position, { z: pill.z, duration: 0.3, ease: "power2.out" });
              }
            }}
          />
          {/* Label text (simplified as a child mesh) */}
          {/* In a full implementation, this would use Troika Text */}
        </group>
      ))}
    </group>
  );
};

export default PillStack;
