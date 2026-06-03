import React, {useEffect, useLayoutEffect, useMemo} from "react";
import type {RenderManifest} from "@prometheus/shared-types";
import {useFrame} from "@react-three/fiber";
import {continueRender, delayRender} from "remotion";
import * as THREE from "three";
import {Text as TroikaText} from "troika-three-text";
import {createDerivedMaterial} from "troika-three-utils";

import {useRenderProxyStore} from "../lib/gsap-proxy.js";

export type KineticTextProps = {
  text: string;
  font: string;
  position: [number, number, number];
  manifest: RenderManifest;
  lineIndex: number;
};

type UniformMaterial = THREE.Material & {
  uniforms?: Record<string, {value: unknown}>;
};

const firstMaterial = (material: THREE.Material | THREE.Material[]): UniformMaterial =>
  (Array.isArray(material) ? material[0] : material) as UniformMaterial;

export const KineticText: React.FC<KineticTextProps> = ({text, font, position, manifest, lineIndex}) => {
  const [positionX, positionY, positionZ] = position;
  const baseMaterial = useMemo(() => {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(manifest.text.color),
      transparent: true,
      depthWrite: true,
      toneMapped: false
    });
    return material;
  }, [manifest.text.color]);
  const animatedMaterial = useMemo(() => {
    const material = createDerivedMaterial(baseMaterial, {
      chained: true,
      uniforms: {
        uProgress: {value: 0},
        uLineOffset: {value: lineIndex * 0.065},
        uDepthTravel: {value: manifest.text.depthTravel},
        uRevealSoftness: {value: manifest.text.revealSoftness},
        uStagger: {value: manifest.text.stagger}
      },
      vertexDefs: `
        uniform float uProgress;
        uniform float uLineOffset;
        uniform float uDepthTravel;
        uniform float uRevealSoftness;
        uniform float uStagger;
      `,
      vertexTransform: `
        float prometheusBlockWidth = max(0.0001, uTroikaTotalBounds.z - uTroikaTotalBounds.x);
        float prometheusGlyphOrder = clamp((aTroikaGlyphBounds.x - uTroikaTotalBounds.x) / prometheusBlockWidth, 0.0, 1.0);
        float prometheusDelay = prometheusGlyphOrder * uStagger + uLineOffset;
        float prometheusLocal = smoothstep(prometheusDelay, prometheusDelay + uRevealSoftness, uProgress);
        float prometheusEase = prometheusLocal * prometheusLocal * (3.0 - 2.0 * prometheusLocal);
        vec2 prometheusCenter = (aTroikaGlyphBounds.xy + aTroikaGlyphBounds.zw) * 0.5;
        position.xy = prometheusCenter + (position.xy - prometheusCenter) * mix(0.58, 1.0, prometheusEase);
        position.x += (1.0 - prometheusEase) * mix(-0.34, 0.34, prometheusGlyphOrder);
        position.y += sin((prometheusGlyphOrder * 6.2831853) + (uProgress * 3.1415926)) * 0.045 * (1.0 - prometheusEase);
        position.z += (1.0 - prometheusEase) * uDepthTravel;
      `
    });
    material.transparent = true;
    return material;
  }, [
    baseMaterial,
    lineIndex,
    manifest.text.depthTravel,
    manifest.text.revealSoftness,
    manifest.text.stagger
  ]);
  const textMesh = useMemo(() => {
    const mesh = new TroikaText();
    mesh.renderOrder = 10;
    return mesh;
  }, []);

  useLayoutEffect(() => {
    let settled = false;
    const handle = delayRender(`troika-text-sync:${lineIndex}`);

    textMesh.text = text;
    textMesh.font = font;
    textMesh.fontSize = manifest.text.size;
    textMesh.anchorX = "center";
    textMesh.anchorY = "middle";
    textMesh.glyphGeometryDetail = 8;
    textMesh.letterSpacing = 0.01;
    textMesh.maxWidth = manifest.text.maxWidth;
    textMesh.overflowWrap = "normal";
    textMesh.whiteSpace = "nowrap";
    textMesh.sdfGlyphSize = 96;
    textMesh.material = animatedMaterial;
    textMesh.position.set(positionX, positionY, positionZ);
    textMesh.sync(() => {
      if (settled) {
        return;
      }
      settled = true;
      continueRender(handle);
    });

    return () => {
      if (!settled) {
        settled = true;
        continueRender(handle);
      }
    };
  }, [
    animatedMaterial,
    font,
    lineIndex,
    manifest.text.maxWidth,
    manifest.text.size,
    positionX,
    positionY,
    positionZ,
    text,
    textMesh
  ]);

  useFrame(() => {
    const progress = useRenderProxyStore.getState().text.uProgress;
    const material = firstMaterial(textMesh.material);
    if (material.uniforms?.uProgress) {
      material.uniforms.uProgress.value = progress;
    }
  });

  useEffect(() => {
    return () => {
      animatedMaterial.dispose();
      baseMaterial.dispose();
    };
  }, [animatedMaterial, baseMaterial]);

  useEffect(() => {
    return () => {
      textMesh.dispose();
    };
  }, [textMesh]);

  return <primitive object={textMesh} />;
};
