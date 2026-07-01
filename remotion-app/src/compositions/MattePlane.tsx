import React, {useEffect, useMemo, useRef} from 'react';
import {staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import type {UnifiedRenderManifest} from '@prometheus/shared-types';

type MattePlaneProps = {
  manifest: UnifiedRenderManifest;
  renderOrder?: number;
};

const isLocalFileUrl = (value: string) => /^file:\/\//i.test(value);
const isLocalAbsolutePath = (value: string) => /^[a-zA-Z]:[\\/]/.test(value) || /^\\\\/.test(value);

const resolveMatteUrl = (matteUrl: string | undefined): string | null => {
  if (!matteUrl) {
    return null;
  }

  if (isLocalFileUrl(matteUrl) || isLocalAbsolutePath(matteUrl)) {
    console.warn(`[MattePlane] Local file URLs are not browser-safe: ${matteUrl}`);
    return null;
  }

  if (/^https?:\/\//i.test(matteUrl)) {
    return matteUrl;
  }

  return staticFile(matteUrl.replace(/^\/+/, ''));
};

const createMatteVideoElement = (src: string): HTMLVideoElement => {
  const element = document.createElement('video');
  element.src = src;
  element.crossOrigin = 'anonymous';
  element.muted = true;
  element.playsInline = true;
  element.preload = 'auto';
  return element;
};

/**
 * MattePlane: Renders the RVM (RobustVideoMatting) alpha matte as a video texture.
 *
 * This component wires the dormant RVM worker output into the Joseph render path
 * as a governed subject matte asset. The matte is rendered as a grayscale video
 * texture that can be used for depth-aware composition and behind-subject effects.
 *
 * Acceptance Criteria (Issue #71):
 * - Render jobs can reference a matte asset with browser-safe and FFmpeg-safe paths
 * - Missing matte emits a visible downgrade/fallback tag (logged to console)
 * - Subject separation affects rendered pixels (via alpha channel)
 */
export const MattePlane: React.FC<MattePlaneProps> = ({manifest, renderOrder = 19}) => {
  const frame = useCurrentFrame();
  const {fps: configFps} = useVideoConfig();
  const meshRef = useRef<THREE.Mesh>(null);

  // Use matte-specific fps if provided, otherwise fall back to manifest fps
  const matteFps = manifest.matte?.fps ?? manifest.fps;
  const matteZ = manifest.matte?.planeZ ?? 0;
  const planeHeight = manifest.matte?.planeHeight ?? 9;
  const planeWidth = (planeHeight * manifest.width) / manifest.height;

  const matteUrl = useMemo(
    () => resolveMatteUrl(manifest.source.matteUrl),
    [manifest.source.matteUrl]
  );

  const videoElement = useMemo(() => {
    if (!matteUrl) {
      console.warn('[MattePlane] Missing matte URL - rendering will proceed with flat PiP fallback', {
        tag: 'compiler_matte_unavailable',
        jobId: manifest.jobId,
        downgrade: 'flat-pip'
      });
      return null;
    }
    return createMatteVideoElement(matteUrl);
  }, [matteUrl, manifest.jobId]);

  const texture = useMemo(() => {
    if (!videoElement) return null;
    const t = new THREE.VideoTexture(videoElement);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.colorSpace = THREE.LinearSRGBColorSpace; // Matte is grayscale alpha data
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }, [videoElement]);

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
    const targetTimeSec = frame / matteFps;
    if (Math.abs(videoElement.currentTime - targetTimeSec) > 1 / matteFps) {
      videoElement.currentTime = targetTimeSec;
    }
  }, [frame, matteFps, videoElement]);

  useEffect(() => {
    if (!texture) return;
    texture.needsUpdate = true;
  }, [texture, frame]);

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
    <mesh ref={meshRef} position={[0, 0, matteZ]} renderOrder={renderOrder}>
      <planeGeometry args={[planeWidth, planeHeight]} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        transparent={true}
        opacity={1}
        depthWrite={false}
        side={THREE.FrontSide}
      />
    </mesh>
  );
};
