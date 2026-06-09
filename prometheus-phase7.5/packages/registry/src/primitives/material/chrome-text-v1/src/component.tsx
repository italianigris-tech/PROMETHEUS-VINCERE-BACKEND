// packages/registry/src/primitives/material/chrome-text-v1/src/component.tsx
import React, { useRef, useMemo, useEffect } from "react";
import { Text } from "troika-three-text";
import { extend, useThree } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { createChromeMaterial, generateProceduralEnvMap, type ChromeTextParams } from "./material";

extend({ Text });

declare global {
  namespace JSX {
    interface IntrinsicElements {
      text: any;
    }
  }
}

export interface ChromeTextProps extends Partial<ChromeTextParams> {
  children: string;
  font?: string;
  fontSize?: number;
  position?: [number, number, number];
  anchorX?: string | number;
  anchorY?: string | number;
  maxWidth?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: "left" | "right" | "center" | "justify";
}

export const ChromeText: React.FC<ChromeTextProps> = ({
  children,
  font = "Inter-Bold",
  fontSize = 2,
  position = [0, 0, 0],
  anchorX = "center",
  anchorY = "middle",
  maxWidth = 10,
  lineHeight = 1.2,
  letterSpacing = 0,
  textAlign = "center",
  extrudeDepth = 0.4,
  metalness = 1.0,
  roughness = 0.1,
  envMapIntensity = 1.5,
  color = "#FFFFFF",
}) => {
  const textRef = useRef<any>(null);
  const { gl } = useThree();

  const material = useMemo(() => {
    const envMap = generateProceduralEnvMap(gl);
    return createChromeMaterial(
      { extrudeDepth, metalness, roughness, envMapIntensity, color },
      envMap
    );
  }, [gl, extrudeDepth, metalness, roughness, envMapIntensity, color]);

  useEffect(() => {
    const textMesh = textRef.current;
    if (!textMesh) return;

    textMesh.text = children;
    textMesh.font = font;
    textMesh.fontSize = fontSize;
    textMesh.anchorX = anchorX;
    textMesh.anchorY = anchorY;
    textMesh.maxWidth = maxWidth;
    textMesh.lineHeight = lineHeight;
    textMesh.letterSpacing = letterSpacing;
    textMesh.textAlign = textAlign;
    textMesh.material = material;
    textMesh.sync();
  }, [children, font, fontSize, anchorX, anchorY, maxWidth, lineHeight, letterSpacing, textAlign, material]);

  useFrame(() => {
    if (textRef.current) {
      textRef.current.sync();
    }
  });

  return <text ref={textRef} position={position} />;
};

export default ChromeText;
