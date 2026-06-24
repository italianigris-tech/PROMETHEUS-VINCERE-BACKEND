import React, {useEffect, useMemo, useRef} from 'react';
import {staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {UnifiedRenderManifest, VideoTrack} from '@prometheus/shared-types';

type VideoPlaneProps = {
  track: VideoTrack | undefined;
  manifest: UnifiedRenderManifest;
};

const isLocalFileUrl = (value: string) => /^file:\/\//i.test(value);
const isLocalAbsolutePath = (value: string) => /^[a-zA-Z]:[\\/]/.test(value) || /^\\\\/.test(value);

export type CoverTextureTransform = {
  repeatX: number;
  repeatY: number;
  offsetX: number;
  offsetY: number;
};

export const calculateCoverTextureTransform = ({
  sourceWidth,
  sourceHeight,
  outputWidth,
  outputHeight,
}: {
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
}): CoverTextureTransform => {
  const sourceAspect = sourceWidth / sourceHeight;
  const outputAspect = outputWidth / outputHeight;

  if (!Number.isFinite(sourceAspect) || !Number.isFinite(outputAspect) || sourceAspect <= 0 || outputAspect <= 0) {
    return {repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0};
  }

  if (sourceAspect > outputAspect) {
    const repeatX = outputAspect / sourceAspect;
    return {
      repeatX,
      repeatY: 1,
      offsetX: (1 - repeatX) / 2,
      offsetY: 0,
    };
  }

  const repeatY = sourceAspect / outputAspect;
  return {
    repeatX: 1,
    repeatY,
    offsetX: 0,
    offsetY: (1 - repeatY) / 2,
  };
};

const resolveVideoSrc = (track: VideoTrack | undefined, fallbackUrl: string): string | null => {
  const candidate = track?.sourcePath ?? fallbackUrl;
  if (candidate && (isLocalFileUrl(candidate) || isLocalAbsolutePath(candidate))) {
    throw new Error(`VideoPlane cannot render local file video sources: ${candidate}. Use MediaReference.browserUrl.`);
  }

  if (!candidate) {
    return null;
  }
  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }
  return staticFile(candidate.replace(/^\/+/, ''));
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
  const {viewport} = useThree();
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
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }, [videoElement]);

  const coverTransform = useMemo(() => calculateCoverTextureTransform({
    sourceWidth: manifest.source.width,
    sourceHeight: manifest.source.height,
    outputWidth: manifest.width,
    outputHeight: manifest.height,
  }), [manifest.height, manifest.source.height, manifest.source.width, manifest.width]);

  useEffect(() => {
    if (!videoElement) return;
    const playPromise = videoElement.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Headless render can reject autoplay; frame seeking below still drives the texture.
      });
    }
  }, [videoElement]);

  useEffect(() => {
    if (!videoElement) return;
    const targetTimeSec = frame / fps;
    if (Math.abs(videoElement.currentTime - targetTimeSec) > 1 / fps) {
      videoElement.currentTime = targetTimeSec;
    }
  }, [frame, fps, videoElement]);

  useEffect(() => {
    if (!texture) return;
    texture.repeat.set(coverTransform.repeatX, coverTransform.repeatY);
    texture.offset.set(coverTransform.offsetX, coverTransform.offsetY);
    texture.needsUpdate = true;
  }, [coverTransform, texture]);

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
      <planeGeometry args={[viewport.width, viewport.height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
};
