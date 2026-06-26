import React, {useEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {Text} from '@react-three/drei';
import * as THREE from 'three';
import type {CameraMove, JosephPiPBackgroundLayer, JosephPiPFrame, JosephPiPPlan, TextOverlay, Transition, UnifiedRenderManifest} from '@prometheus/shared-types';
import {hashSeed, seededRandom} from '@prometheus/shared-types';
import {percentRectToViewport, VideoPlane} from './VideoPlane';

const DEFAULT_JOSEPH_TYPOGRAPHY = {
  fontId: 'hero-berylium-regular',
  fontFamily: 'PrometheusHeroBerylium',
  fontAssetUrl: '/fonts/hero/berylium-rg-67d7e31492fa.otf',
  fallbackFamily: 'Arial, sans-serif',
};

const ParkMillerPRNG = (seed: number): number => seededRandom(seed)();

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const isLocalFileUrl = (value: string) => /^file:\/\//i.test(value);
const isLocalAbsolutePath = (value: string) => /^[a-zA-Z]:[\\/]/.test(value) || /^\\\\/.test(value);

const resolveJosephTypography = (manifest: UnifiedRenderManifest) => {
  const typography = manifest.typography ?? DEFAULT_JOSEPH_TYPOGRAPHY;
  const fontAssetUrl = typography.fontAssetUrl || DEFAULT_JOSEPH_TYPOGRAPHY.fontAssetUrl;
  const fallbackFamily = typography.fallbackFamily || DEFAULT_JOSEPH_TYPOGRAPHY.fallbackFamily;

  if (isLocalFileUrl(fontAssetUrl) || isLocalAbsolutePath(fontAssetUrl)) {
    return {
      ...DEFAULT_JOSEPH_TYPOGRAPHY,
      fallbackFamily,
      fontAssetUrl: staticFile(DEFAULT_JOSEPH_TYPOGRAPHY.fontAssetUrl.replace(/^\//, '')),
    };
  }

  return {
    ...typography,
    fallbackFamily,
    fontAssetUrl: fontAssetUrl.startsWith('/') ? staticFile(fontAssetUrl.replace(/^\//, '')) : fontAssetUrl,
  };
};

const findActiveItem = <T extends {startFrame: number; endFrame: number}>(items: readonly T[], frame: number): T | null =>
  items.find((item) => frame >= item.startFrame && frame <= item.endFrame) ?? null;

const findActiveOverlays = (items: readonly TextOverlay[], frame: number): TextOverlay[] =>
  items.filter((item) => frame >= item.startFrame && frame <= item.endFrame);

const findActiveTransition = (items: readonly Transition[], frame: number): Transition | null =>
  items.find((item) => frame >= item.startFrame && frame <= item.endFrame) ?? null;

const frameProgress = (item: {startFrame: number; endFrame: number}, frame: number): number => {
  const span = Math.max(1, item.endFrame - item.startFrame);
  return clamp01((frame - item.startFrame) / span);
};

const easeOutCubic = (value: number) => 1 - Math.pow(1 - clamp01(value), 3);

const splitOverlayWords = (overlay: TextOverlay) => {
  const words = overlay.text.split(/\s+/).filter(Boolean);
  return words.length > 0 ? words : [overlay.text];
};

const overlayTransform = (overlay: TextOverlay, wordIndex: number, frame: number) => {
  const progress = frameProgress(overlay, frame);
  const eased = easeOutCubic(progress);
  const baseX = (wordIndex - (splitOverlayWords(overlay).length - 1) / 2) * 0.72;

  if (overlay.animation === 'pop') {
    const scale = 0.5 + eased * 0.9;
    return {position: [baseX, 0.9 - (1 - eased) * 0.3, 0.35] as [number, number, number], scale: [scale, scale, scale] as [number, number, number], rotation: [0, 0, 0] as [number, number, number]};
  }

  if (overlay.animation === 'slide_up') {
    return {position: [baseX, -0.8 + eased * 1.4, 0.3] as [number, number, number], scale: [1, 1, 1] as [number, number, number], rotation: [0, 0, 0] as [number, number, number]};
  }

  if (overlay.animation === 'glitch') {
    const jitterSeed = hashSeed(frame + 1, wordIndex + overlay.startFrame + 1);
    const jitterX = (ParkMillerPRNG(jitterSeed) - 0.5) * 0.12;
    const jitterY = (ParkMillerPRNG(jitterSeed + 17) - 0.5) * 0.08;
    return {position: [baseX + jitterX, 0.65 + jitterY, 0.32] as [number, number, number], scale: [1.05, 1.05, 1.05] as [number, number, number], rotation: [0, 0, (ParkMillerPRNG(jitterSeed + 31) - 0.5) * 0.08] as [number, number, number]};
  }

  if (overlay.animation === 'typewriter') {
    const reveal = Math.max(1, Math.ceil((splitOverlayWords(overlay)[wordIndex]?.length ?? 1) * eased));
    return {position: [baseX, 0.35, 0.3] as [number, number, number], scale: [1, 1, 1] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], reveal};
  }

  const elastic = 1 + Math.sin(eased * Math.PI) * 0.35;
  return {position: [baseX, 0.5, 0.34] as [number, number, number], scale: [elastic, elastic, elastic] as [number, number, number], rotation: [0, 0, 0] as [number, number, number]};
};

const CameraRig: React.FC<{cameraMoves: readonly CameraMove[]; seed: number}> = ({cameraMoves, seed}) => {
  const frame = useCurrentFrame();
  const {camera} = useThree();

  useFrame(() => {
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    perspectiveCamera.position.set(0, 0, 5);
    perspectiveCamera.rotation.set(0, 0, 0);

    const activeMove = findActiveItem(cameraMoves, frame);
    if (!activeMove) {
      perspectiveCamera.lookAt(0, 0, 0);
      return;
    }

    const progress = frameProgress(activeMove, frame);
    if (activeMove.type === 'push_in') {
      perspectiveCamera.position.z = 5 - easeOutCubic(progress) * 3;
    }

    if (activeMove.type === 'dutch') {
      perspectiveCamera.rotation.z = 0.15 * easeOutCubic(progress);
    }

    if (activeMove.type === 'shake') {
      const baseSeed = hashSeed(seed, frame + 1);
      perspectiveCamera.position.x = (ParkMillerPRNG(baseSeed) - 0.5) * 0.16;
      perspectiveCamera.position.y = (ParkMillerPRNG(baseSeed + 1) - 0.5) * 0.12;
    }

    perspectiveCamera.lookAt(0, 0, 0);
  });

  return null;
};

const KineticText: React.FC<{overlays: readonly TextOverlay[]; manifest: UnifiedRenderManifest}> = ({overlays, manifest}) => {
  const frame = useCurrentFrame();
  const typography = resolveJosephTypography(manifest);

  return (
    <group position={[0, 0, 0.6]}>
      {overlays.flatMap((overlay, overlayIndex) => {
        const words = splitOverlayWords(overlay);
        return words.map((word, wordIndex) => {
          const transform = overlayTransform(overlay, wordIndex, frame);
          const visibleWord = transform.reveal ? word.slice(0, transform.reveal) : word;
          return (
            <Text
              key={`${overlayIndex}-${wordIndex}-${overlay.startFrame}`}
              font={typography.fontAssetUrl}
              fontSize={0.58}
              color={overlay.color}
              fontStyle="normal"
              anchorX="center"
              anchorY="middle"
              position={transform.position}
              scale={transform.scale}
              rotation={transform.rotation}
              outlineWidth={0.015}
              outlineColor="#000000"
              strokeWidth={0.01}
              strokeColor="#000000"
            >
              {visibleWord}
            </Text>
          );
        });
      })}
    </group>
  );
};

const zoomBlurVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const zoomBlurFragmentShader = `
uniform sampler2D tDiffuse;
uniform float uIntensity;
varying vec2 vUv;
void main() {
  vec2 center = vec2(0.5, 0.5);
  vec2 direction = (vUv - center) * uIntensity * 0.08;
  vec4 color = vec4(0.0);
  color += texture2D(tDiffuse, vUv - direction * 2.0) * 0.2;
  color += texture2D(tDiffuse, vUv - direction) * 0.3;
  color += texture2D(tDiffuse, vUv) * 0.3;
  color += texture2D(tDiffuse, vUv + direction) * 0.2;
  if (uIntensity <= 0.0) {
    gl_FragColor = vec4(0.0);
    return;
  }
  gl_FragColor = vec4(color.rgb * 0.15, clamp(uIntensity * 0.35, 0.0, 0.35));
}
`;

const ZoomBlurQuad: React.FC<{transition: Transition | null}> = ({transition}) => {
  const frame = useCurrentFrame();
  const intensity = transition ? easeOutCubic(frameProgress(transition, frame)) : 0;
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      tDiffuse: {value: new THREE.Texture()},
      uIntensity: {value: intensity},
    },
    vertexShader: zoomBlurVertexShader,
    fragmentShader: zoomBlurFragmentShader,
  }), []);

  useEffect(() => {
    material.uniforms.uIntensity.value = intensity;
  }, [intensity, material]);

  return (
    <mesh position={[0, 0, 0.9]} renderOrder={50}>
      <planeGeometry args={[10.66, 6]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

const PiPFrameChrome: React.FC<{frameRect: JosephPiPFrame; opacity?: number}> = ({frameRect, opacity = 0.32}) => {
  const {viewport} = useThree();
  const rect = percentRectToViewport({frameRect, viewportWidth: viewport.width, viewportHeight: viewport.height});
  const padding = Math.max(0.04, frameRect.safeMarginPercent / 100);

  return (
    <group position={[rect.x, rect.y, 0.18]}>
      <mesh position={[0, -padding * 0.7, -0.02]}>
        <planeGeometry args={[rect.width + padding * 2.4, rect.height + padding * 2.4]} />
        <meshBasicMaterial color="#05070B" transparent opacity={opacity} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <planeGeometry args={[rect.width + padding, rect.height + padding]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.22} wireframe depthWrite={false} />
      </mesh>
    </group>
  );
};

const layerAsFrame = (layer: JosephPiPBackgroundLayer): JosephPiPFrame => ({
  leftPercent: layer.leftPercent,
  topPercent: layer.topPercent,
  widthPercent: layer.widthPercent,
  heightPercent: layer.heightPercent,
  borderRadiusPx: 0,
  safeMarginPercent: 0,
  depth: 'background',
});

const PiPBackgroundLayer: React.FC<{layer: JosephPiPBackgroundLayer}> = ({layer}) => {
  const {viewport} = useThree();
  const rect = percentRectToViewport({
    frameRect: layerAsFrame(layer),
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  });
  const color = layer.role === 'focus_field' ? '#2F6BFF' : layer.role === 'asset_board' ? '#F6C85F' : '#111827';

  return (
    <mesh position={[rect.x, rect.y, 0.08]}>
      <planeGeometry args={[rect.width, rect.height]} />
      <meshBasicMaterial color={color} transparent opacity={0.12 + layer.intensity * 0.16} depthWrite={false} />
    </mesh>
  );
};

const JosephPiPRig: React.FC<{plan: JosephPiPPlan | undefined}> = ({plan}) => {
  const frame = useCurrentFrame();
  if (!plan) {
    return null;
  }

  const activeMotion = plan.activeMotion.find((segment) => frame >= segment.startFrame && frame <= segment.endFrame) ?? plan.activeMotion.at(-1);
  const motionProgress = activeMotion ? easeOutCubic(frameProgress(activeMotion, frame)) : 1;

  return (
    <group scale={[0.96 + motionProgress * 0.04, 0.96 + motionProgress * 0.04, 1]}>
      {plan.backgroundLayers.map((layer, index) => (
        <PiPBackgroundLayer key={`${layer.role}-${index}`} layer={layer} />
      ))}
      <PiPFrameChrome frameRect={plan.frame} opacity={0.24 + motionProgress * 0.18} />
    </group>
  );
};
const JosephScene: React.FC<{manifest: UnifiedRenderManifest}> = ({manifest}) => {
  const frame = useCurrentFrame();
  const activeOverlays = findActiveOverlays(manifest.textOverlays, frame);
  const activeTransition = findActiveTransition(manifest.transitions, frame);

  return (
    <>
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[0, 0, 4]} intensity={1.2} />
      <JosephPiPRig plan={manifest.josephPiP} />
      <VideoPlane track={manifest.videoTracks[0]} manifest={manifest} frameRect={manifest.josephPiP?.frame} />
      <CameraRig cameraMoves={manifest.cameraMoves} seed={manifest.seed} />
      <KineticText overlays={activeOverlays} manifest={manifest} />
      <ZoomBlurQuad transition={activeTransition} />
    </>
  );
};

export const JosephEdit: React.FC<{manifest: UnifiedRenderManifest}> = ({manifest}) => {
  const {width, height} = useVideoConfig();

  return (
    <AbsoluteFill style={{backgroundColor: '#000000'}}>
      <Canvas
        gl={{preserveDrawingBuffer: true, antialias: true, alpha: false, powerPreference: 'high-performance'}}
        dpr={1}
        frameloop="always"
        camera={{position: [0, 0, 5], fov: 45, near: 0.1, far: 100}}
        style={{width, height, display: 'block'}}
      >
        <JosephScene manifest={manifest} />
      </Canvas>
    </AbsoluteFill>
  );
};
