import React, {useEffect, useMemo, useRef} from "react";
import {useThree} from "@react-three/fiber";
import {useCurrentFrame, useVideoConfig} from "remotion";
import * as THREE from "three";

export const BackgroundVideoPlane: React.FC<{src?: string}> = ({src}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const {camera} = useThree();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));

  const texture = useMemo(() => {
    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;
    return new THREE.CanvasTexture(canvas);
  }, [width, height]);

  useEffect(() => {
    if (!src) {
      return;
    }

    const video = document.createElement("video");
    video.src = src;
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    videoRef.current = video;

    const onSeeked = () => {
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) {
        return;
      }
      ctx.drawImage(video, 0, 0, width, height);
      texture.needsUpdate = true;
    };

    video.addEventListener("seeked", onSeeked);
    return () => {
      video.removeEventListener("seeked", onSeeked);
      video.pause();
      video.src = "";
      videoRef.current = null;
    };
  }, [src, width, height, texture]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const targetTime = frame / fps;
    if (Math.abs(video.currentTime - targetTime) > 0.05) {
      video.currentTime = targetTime;
    }
  }, [frame, fps]);

  const planeZ = -100;
  const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
  const distance = Math.abs(camera.position.z - planeZ);
  const planeHeight = 2 * Math.tan(fov / 2) * distance;
  const planeWidth = planeHeight * (width / height);

  if (!src) {
    return null;
  }

  return (
    <mesh position={[0, 0, planeZ]}>
      <planeGeometry args={[planeWidth, planeHeight]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
};
