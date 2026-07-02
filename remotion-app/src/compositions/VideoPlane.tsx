import React, {useEffect, useMemo, useRef} from 'react';
import {staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {JosephPiPFrame, UnifiedRenderManifest, VideoTrack} from '@prometheus/shared-types';
import {resolveMatteRenderContract} from './matte-render-contract';

type VideoPlaneProps = {
  track: VideoTrack | undefined;
  manifest: UnifiedRenderManifest;
  frameRect?: JosephPiPFrame;
  opacity?: number;
  z?: number;
  renderOrder?: number;
};

const isLocalFileUrl = (value: string) => /^file:\/\//i.test(value);
const isLocalAbsolutePath = (value: string) => /^[a-zA-Z]:[\\/]/.test(value) || /^\\\\/.test(value);

export type CoverTextureTransform = {
  repeatX: number;
  repeatY: number;
  offsetX: number;
  offsetY: number;
};

export type ViewportRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PercentFrameRect = Pick<JosephPiPFrame, 'leftPercent' | 'topPercent' | 'widthPercent' | 'heightPercent'>;

export const percentRectToViewport = ({
  frameRect,
  viewportWidth,
  viewportHeight,
}: {
  frameRect: PercentFrameRect | undefined;
  viewportWidth: number;
  viewportHeight: number;
}): ViewportRect => {
  if (!frameRect) {
    return {x: 0, y: 0, width: viewportWidth, height: viewportHeight};
  }

  const width = viewportWidth * (frameRect.widthPercent / 100);
  const height = viewportHeight * (frameRect.heightPercent / 100);
  const left = viewportWidth * (frameRect.leftPercent / 100) - viewportWidth / 2;
  const top = viewportHeight / 2 - viewportHeight * (frameRect.topPercent / 100);

  return {
    x: left + width / 2,
    y: top - height / 2,
    width,
    height,
  };
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

const resolveBrowserMediaSrc = (candidate: string | null | undefined, label: string): string | null => {
  if (!candidate) {
    return null;
  }

  if (isLocalFileUrl(candidate) || isLocalAbsolutePath(candidate)) {
    const message = label === 'video'
      ? `VideoPlane cannot render local file video sources: ${candidate}. Use MediaReference.browserUrl. Use a browser-safe URL.`
      : `VideoPlane cannot render local file matte sources: ${candidate}. Use source.matteUrl.`;
    throw new Error(message);
  }

  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }
  return staticFile(candidate.replace(/^\/+/, ''));
};

const resolveVideoSrc = (track: VideoTrack | undefined, fallbackUrl: string): string | null =>
  resolveBrowserMediaSrc(track?.sourcePath ?? fallbackUrl, 'video');

const createVideoElement = (src: string): HTMLVideoElement => {
  const element = document.createElement('video');
  element.src = src;
  element.crossOrigin = 'anonymous';
  element.muted = true;
  element.playsInline = true;
  element.preload = 'auto';
  return element;
};

export const VideoPlane: React.FC<VideoPlaneProps> = ({track, manifest, frameRect, opacity = 1, z, renderOrder = 18}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {viewport} = useThree();
  const meshRef = useRef<THREE.Mesh>(null);

  const src = useMemo(
    () => resolveVideoSrc(track, manifest.source.videoUrl),
    [track, manifest.source.videoUrl]
  );
  const matteContract = useMemo(() => resolveMatteRenderContract(manifest), [manifest]);
  const matteSrc = useMemo(
    () => resolveBrowserMediaSrc(matteContract.matteUrl, 'matte'),
    [matteContract.matteUrl]
  );

  const videoElement = useMemo(() => (src ? createVideoElement(src) : null), [src]);
  const matteVideoElement = useMemo(() => (matteSrc ? createVideoElement(matteSrc) : null), [matteSrc]);

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

  const alphaTexture = useMemo(() => {
    if (!matteVideoElement) return null;
    const t = new THREE.VideoTexture(matteVideoElement);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.colorSpace = THREE.LinearSRGBColorSpace;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }, [matteVideoElement]);

  const viewportRect = useMemo(() => percentRectToViewport({
    frameRect,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  }), [frameRect, viewport.height, viewport.width]);

  const coverTransform = useMemo(() => calculateCoverTextureTransform({
    sourceWidth: manifest.source.width,
    sourceHeight: manifest.source.height,
    outputWidth: frameRect ? manifest.width * (frameRect.widthPercent / 100) : manifest.width,
    outputHeight: frameRect ? manifest.height * (frameRect.heightPercent / 100) : manifest.height,
  }), [frameRect, manifest.height, manifest.source.height, manifest.source.width, manifest.width]);

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
    if (!matteVideoElement) return;
    const playPromise = matteVideoElement.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Headless render can reject autoplay; frame seeking below still drives the texture.
      });
    }
  }, [matteVideoElement]);

  useEffect(() => {
    if (!matteContract.available) {
      console.warn('[VideoPlane] Missing matte URL - rendering will proceed with flat PiP fallback', {
        tag: 'compiler_matte_unavailable',
        jobId: manifest.jobId,
        downgrade: 'flat-pip',
      });
    }
  }, [manifest.jobId, matteContract.available]);

  useEffect(() => {
    if (!videoElement) return;
    const targetTimeSec = frame / fps;
    if (Math.abs(videoElement.currentTime - targetTimeSec) > 1 / fps) {
      videoElement.currentTime = targetTimeSec;
    }
  }, [frame, fps, videoElement]);

  useEffect(() => {
    if (!matteVideoElement) return;
    const targetTimeSec = frame / matteContract.fps;
    if (Math.abs(matteVideoElement.currentTime - targetTimeSec) > 1 / matteContract.fps) {
      matteVideoElement.currentTime = targetTimeSec;
    }
  }, [frame, matteContract.fps, matteVideoElement]);

  useEffect(() => {
    if (!texture) return;
    texture.repeat.set(coverTransform.repeatX, coverTransform.repeatY);
    texture.offset.set(coverTransform.offsetX, coverTransform.offsetY);
    texture.needsUpdate = true;
  }, [coverTransform, texture]);

  useEffect(() => {
    if (!alphaTexture) return;
    alphaTexture.repeat.set(coverTransform.repeatX, coverTransform.repeatY);
    alphaTexture.offset.set(coverTransform.offsetX, coverTransform.offsetY);
    alphaTexture.needsUpdate = true;
  }, [alphaTexture, coverTransform]);

  useEffect(() => {
    return () => {
      texture?.dispose();
      alphaTexture?.dispose();
      if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.load();
      }
      if (matteVideoElement) {
        matteVideoElement.pause();
        matteVideoElement.removeAttribute('src');
        matteVideoElement.load();
      }
    };
  }, [alphaTexture, texture, matteVideoElement, videoElement]);

  if (!texture) {
    return null;
  }

  return (
    <mesh ref={meshRef} position={[viewportRect.x, viewportRect.y, z ?? (frameRect ? 0.24 : 0)]} renderOrder={renderOrder}>
      <planeGeometry args={[viewportRect.width, viewportRect.height]} />
      <meshBasicMaterial
        map={texture}
        alphaMap={alphaTexture ?? undefined}
        toneMapped={false}
        transparent={opacity < 1 || Boolean(alphaTexture)}
        opacity={opacity}
        alphaTest={alphaTexture ? 0.001 : 0}
        depthWrite={false}
      />
    </mesh>
  );
};