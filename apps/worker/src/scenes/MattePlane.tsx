import React, {useMemo} from "react";
import {useCurrentFrame, useVideoConfig} from "remotion";
import * as THREE from "three";

import {useVideoTextureSync} from "../lib/video-sync.js";

export type MattePlaneProps = {
  url: string;
  matteZ: number;
};

export const MattePlane: React.FC<MattePlaneProps> = ({url, matteZ}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames, width, height} = useVideoConfig();
  const texture = useVideoTextureSync({
    url,
    frame,
    fps,
    durationInFrames
  });
  const aspect = width / height;
  const planeHeight = 9;
  const planeWidth = planeHeight * aspect;
  const material = useMemo(() => {
    const matteMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      premultipliedAlpha: true,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    return matteMaterial;
  }, [texture]);

  return (
    <mesh material={material} position={[0, 0, matteZ]} renderOrder={20}>
      <planeGeometry args={[planeWidth, planeHeight]} />
    </mesh>
  );
};
