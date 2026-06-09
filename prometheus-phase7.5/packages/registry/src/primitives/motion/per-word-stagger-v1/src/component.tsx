// packages/registry/src/primitives/motion/per-word-stagger-v1/src/component.tsx
import React, { useRef, useEffect, useMemo } from "react";
import { Text } from "troika-three-text";
import { extend, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import gsap from "gsap";
import { buildStaggerTimeline, defaultStaggerParams, type PerWordStaggerParams } from "./logic";

extend({ Text });

declare global {
  namespace JSX {
    interface IntrinsicElements {
      text: any;
    }
  }
}

export interface PerWordStaggerProps extends Partial<PerWordStaggerParams> {
  children: string;
  font?: string;
  fontSize?: number;
  position?: [number, number, number];
  color?: string;
  maxWidth?: number;
  onComplete?: () => void;
}

export const PerWordStagger: React.FC<PerWordStaggerProps> = ({
  children,
  font = "Inter-Bold",
  fontSize = 1.5,
  position = [0, 0, 0],
  color = "#FFFFFF",
  maxWidth = 12,
  delay = 0.08,
  rotationAmplitude = 15,
  driftX = 0,
  driftY = 0.5,
  driftZ = 0,
  duration = 1.2,
  ease = "power3.out",
  onComplete,
}) => {
  const groupRef = useRef<Group>(null);
  const wordsRef = useRef<any[]>([]);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const words = useMemo(() => children.split(/\s+/).filter((w) => w.length > 0), [children]);

  useEffect(() => {
    if (!groupRef.current) return;

    // Clear previous
    wordsRef.current = [];
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }

    // Create word meshes
    const wordMeshes: any[] = [];
    words.forEach((word, i) => {
      const textMesh = new (Text as any)();
      textMesh.text = word;
      textMesh.font = font;
      textMesh.fontSize = fontSize;
      textMesh.color = color;
      textMesh.anchorX = "left";
      textMesh.anchorY = "middle";
      textMesh.maxWidth = maxWidth;
      textMesh.sync();

      // Position words in a line
      textMesh.position.set(i * 0.5, 0, 0); // Temporary; will be recalculated after sync
      groupRef.current!.add(textMesh);
      wordMeshes.push(textMesh);
    });

    // After sync, recalculate positions based on actual widths
    requestAnimationFrame(() => {
      let xOffset = 0;
      wordMeshes.forEach((mesh) => {
        mesh.position.set(xOffset, 0, 0);
        xOffset += (mesh.textRenderInfo?.totalWidth ?? fontSize * 0.6) + fontSize * 0.2;
      });

      // Center the group
      const totalWidth = xOffset - fontSize * 0.2;
      groupRef.current!.position.set(
        position[0] - totalWidth / 2,
        position[1],
        position[2]
      );

      wordsRef.current = wordMeshes;

      // Build and play timeline
      const params: PerWordStaggerParams = {
        delay, rotationAmplitude, driftX, driftY, driftZ, duration, ease,
      };
      const tl = buildStaggerTimeline(wordMeshes, params);
      if (onComplete) tl.eventCallback("onComplete", onComplete);
      timelineRef.current = tl;
    });

    return () => {
      timelineRef.current?.kill();
    };
  }, [words, font, fontSize, color, maxWidth, position, delay, rotationAmplitude, driftX, driftY, driftZ, duration, ease, onComplete]);

  useFrame(() => {
    wordsRef.current.forEach((mesh) => mesh.sync?.());
  });

  return <group ref={groupRef} />;
};

export default PerWordStagger;
