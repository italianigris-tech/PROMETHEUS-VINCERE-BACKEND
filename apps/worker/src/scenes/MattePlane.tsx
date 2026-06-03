import React, {useMemo} from "react";
import type {RenderManifest} from "@prometheus/shared-types";
import * as THREE from "three";

import {useVideoTextureSync} from "../lib/video-sync.js";

export type MattePlaneProps = {
  manifest: RenderManifest;
  frame: number;
  fps: number;
};

export const MattePlane: React.FC<MattePlaneProps> = ({manifest, frame, fps}) => {
  const texture = useVideoTextureSync({
    url: manifest.matteUrl,
    frame,
    fps,
    durationInFrames: manifest.durationInFrames
  });
  const aspect = manifest.width / manifest.height;
  const planeHeight = manifest.matte.planeHeight;
  const planeWidth = planeHeight * aspect;
  const material = useMemo(() => {
    const matteMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      premultipliedAlpha: manifest.matte.premultipliedAlpha,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    return matteMaterial;
  }, [manifest.matte.premultipliedAlpha, texture]);

  return (
    <mesh material={material} position={[0, 0, manifest.matte.planeZ]} renderOrder={20}>
      <planeGeometry args={[planeWidth, planeHeight]} />
    </mesh>
  );
};
