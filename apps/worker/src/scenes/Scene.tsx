import React, {useEffect} from "react";
import type {RenderManifest} from "@prometheus/shared-types";
import {useFrame, useThree} from "@react-three/fiber";
import * as THREE from "three";

import {useRenderProxyStore} from "../lib/gsap-proxy.js";
import {useWordWrap} from "../lib/word-wrap.js";
import {KineticText} from "./KineticText.js";
import {MattePlane} from "./MattePlane.js";

export type SceneProps = {
  manifest: RenderManifest;
  frame: number;
  fps: number;
};

export const Scene: React.FC<SceneProps> = ({manifest, frame, fps}) => {
  const {camera, gl, scene} = useThree();
  const lines = useWordWrap(manifest.transcript, {
    maxWidth: manifest.text.maxWidth,
    fontSize: manifest.text.size,
    maxLines: 4
  });
  const lineStep = manifest.text.size * manifest.text.lineHeight;
  const firstLineY = ((lines.length - 1) * lineStep) / 2;

  useEffect(() => {
    scene.background = new THREE.Color("#05070b");
    gl.setClearColor("#05070b", 1);
  }, [gl, scene]);

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = manifest.width / manifest.height;
      camera.fov = manifest.camera.fov;
      camera.near = 0.1;
      camera.far = 100;
      camera.updateProjectionMatrix();
    }
  }, [camera, manifest.camera.fov, manifest.height, manifest.width]);

  useFrame(() => {
    const proxy = useRenderProxyStore.getState().camera;
    camera.position.set(proxy.x, proxy.y, proxy.z);
    camera.rotation.z = proxy.rotationZ;
    camera.lookAt(0, 0, manifest.text.depthZ);
  });

  return (
    <>
      <ambientLight intensity={0.72} />
      <directionalLight position={[3.8, 5.2, 6]} intensity={1.25} />
      <pointLight position={[-3, 1.5, 3]} intensity={0.8} color="#70d6ff" />
      <group position={[0, firstLineY, manifest.text.depthZ]}>
        {lines.map((line, index) => (
          <KineticText
            key={`${index}-${line}`}
            text={line}
            font={manifest.fontUrl}
            position={[0, -index * lineStep, 0]}
            manifest={manifest}
            lineIndex={index}
          />
        ))}
      </group>
      <MattePlane manifest={manifest} frame={frame} fps={fps} />
    </>
  );
};
