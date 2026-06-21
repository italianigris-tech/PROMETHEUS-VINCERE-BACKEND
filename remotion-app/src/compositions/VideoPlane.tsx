import React, {useEffect, useMemo, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import type {UnifiedRenderManifest, VideoTrack} from '@prometheus/shared-types';

type VideoPlaneProps = {
  track: VideoTrack | undefined;
  manifest: UnifiedRenderManifest;
};

const PLANE_WIDTH = 10.66;
const PLANE_HEIGHT = 6;

const isLocalFileUrl = (value: string) => /^file:\/\//i.test(value);
const isLocalAbsolutePath = (value: string) => /^[a-zA-Z]:[\\/]/.test(value) || /^\\\\/.test(value);

const resolveVideoSrc = (track: VideoTrack | undefined, fallbackUrl: string): string | null => {
  const candidate = track?.sourcePath ?? fallbackUrl;
  if (candidate && (isLocalFileUrl(candidate) || isLocalAbsolutePath(candidate))) {
    throw new Error(`VideoPlane cannot render local file video sources: ${candidate}. Use MediaReference.browserUrl.`);
  }

  return candidate || null;
};

const createVideoElement = (src: string): HTMLVideoElement => {
  const element = document.createElement('video');
  element.src = src;
  element.crossOrigin = 'anonymous';
  element.muted = true;
  element.playsInline = true;
  element.preload = 'auto';
  return element;
};

export const VideoPlane: React.FC<VideoPlaneProps> = ({track, manifest}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const meshRef = useRef<THREE.Mesh>(null);

  const src = useMemo(
    () => resolveVideoSrc(track, manifest.source.videoUrl),
    [track, manifest.source.videoUrl]
  );

  const videoElement = useMemo(() => (src ? createVideoElement(src) : null), [src]);

  const texture = useMemo(() => {
    if (!videoElement) return null;
    const t = new THREE.VideoTexture(videoElement);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [videoElement]);

  useEffect(() => {
    if (!videoElement) return;
    const targetTimeSec = frame / fps;
    if (Math.abs(videoElement.currentTime - targetTimeSec) > 1 / fps) {
      videoElement.currentTime = targetTimeSec;
    }
  }, [frame, fps, videoElement]);

  useEffect(() => {
    return () => {
      texture?.dispose();
      if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.load();
      }
    };
  }, [texture, videoElement]);

  if (!texture) {
    return null;
  }

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[PLANE_WIDTH, PLANE_HEIGHT]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
};
