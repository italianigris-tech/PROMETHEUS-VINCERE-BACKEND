import React, {useEffect, useMemo} from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {Text} from '@react-three/drei';
import * as THREE from 'three';
import type {CameraMove, JosephPiPFrame, JosephPiPPlan, TextOverlay, Transition, UnifiedRenderManifest} from '@prometheus/shared-types';
import {percentRectToViewport, VideoPlane} from './VideoPlane';
import {
  type JosephMacroRigRenderContract,
  type JosephPiPBackgroundLayerRenderContract,
  type JosephPiPRenderContract,
  resolveBackgroundRenderContract,
  resolveCameraRenderContract,
  resolveMacroRigRenderContract,
  resolveMicroAnimationRenderContract,
  resolvePiPRenderContract,
  resolveTypographyRenderContract,
} from './joseph-render-contract';

const toRemotionFontAssetUrl = (fontAssetUrl: string) =>
  fontAssetUrl.startsWith('/') ? staticFile(fontAssetUrl.replace(/^\//, '')) : fontAssetUrl;

const findActiveOverlays = (items: readonly TextOverlay[], frame: number): TextOverlay[] =>
  items.filter((item) => frame >= item.startFrame && frame <= item.endFrame);

const findActiveTransition = (items: readonly Transition[], frame: number): Transition | null =>
  items.find((item) => frame >= item.startFrame && frame <= item.endFrame) ?? null;

const frameProgress = (item: {startFrame: number; endFrame: number}, frame: number): number => {
  const span = Math.max(1, item.endFrame - item.startFrame);
  return Math.max(0, Math.min(1, (frame - item.startFrame) / span));
};

const easeOutCubic = (value: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, value)), 3);

const splitOverlayWords = (overlay: TextOverlay) => {
  const words = overlay.text.split(/\s+/).filter(Boolean);
  return words.length > 0 ? words : [overlay.text];
};

const normalizeTypographyText = (value: string): string =>
  value.replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();

const resolveOverlayTypographyRole = (
  overlay: TextOverlay,
  manifest: UnifiedRenderManifest,
): 'hero' | 'support' | 'cta' => {
  const normalizedOverlay = normalizeTypographyText(overlay.text);
  const matchingLine = manifest.josephTypography?.lines.find((line) => {
    const normalizedLine = normalizeTypographyText(line.text);
    return normalizedLine.length > 0 && (
      normalizedOverlay.includes(normalizedLine) || normalizedLine.includes(normalizedOverlay)
    );
  });
  if (matchingLine) {
    return matchingLine.role;
  }
  return overlay.microAnimation?.semanticRole === 'cta'
    ? 'cta'
    : overlay.microAnimation?.semanticRole === 'support'
      ? 'support'
      : 'hero';
};

const textAccentSize = (word: string, kind: string): [number, number] => {
  const width = Math.max(0.46, word.length * (kind === 'rail' ? 0.32 : 0.2));
  const height = kind === 'underline' || kind === 'rail' ? 0.045 : kind === 'marker' ? 0.14 : 0.36;
  return [width, height];
};

const TextPrimitiveAccent: React.FC<{
  word: string;
  contract: ReturnType<typeof resolveMicroAnimationRenderContract>;
}> = ({word, contract}) => {
  const {observable} = contract;
  if (observable.accentKind === 'none' || observable.accentOpacity <= 0) {
    return null;
  }

  const [width, height] = textAccentSize(word, observable.accentKind);

  return (
    <mesh
      position={[
        contract.transform.position[0] + observable.accentOffset[0],
        contract.transform.position[1] + observable.accentOffset[1],
        contract.transform.position[2] + observable.accentOffset[2],
      ]}
      scale={observable.accentScale}
      renderOrder={observable.renderOrder - 1}
    >
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color={observable.accentColor} transparent opacity={observable.accentOpacity} depthWrite={false} />
    </mesh>
  );
};

const CameraRig: React.FC<{cameraMoves: readonly CameraMove[]; seed: number}> = ({cameraMoves, seed}) => {
  const frame = useCurrentFrame();
  const {camera} = useThree();

  useFrame(() => {
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const contract = resolveCameraRenderContract({cameraMoves, frame, seed});
    perspectiveCamera.position.set(...contract.position);
    perspectiveCamera.rotation.set(...contract.rotation);
    perspectiveCamera.lookAt(0, 0, 0);
  });

  return null;
};

const KineticText: React.FC<{overlays: readonly TextOverlay[]; manifest: UnifiedRenderManifest}> = ({overlays, manifest}) => {
  const frame = useCurrentFrame();
  const typography = resolveTypographyRenderContract(manifest.typography, manifest.josephTypography, manifest.josephPiP);

  return (
    <group position={[0, 0, 0.6]}>
      {overlays.flatMap((overlay, overlayIndex) => {
        const words = splitOverlayWords(overlay);
        return words.map((word, wordIndex) => {
          const contract = resolveMicroAnimationRenderContract({
            overlay,
            frame,
            wordIndex,
            wordCount: words.length,
          });
          const transform = contract.transform;
          const visibleWord = transform.reveal ? word.slice(0, transform.reveal) : word;
          const typographyRole = resolveOverlayTypographyRole(overlay, manifest);
          const roleStyle = typography.observable.roleStyles[typographyRole];
          const fontSizeScale = contract.observable.fontSizeScale * (roleStyle?.hierarchyScale ?? 1);
          const textRenderOrder = roleStyle?.renderOrder ?? contract.observable.renderOrder;
          const roleFontAssetUrl = toRemotionFontAssetUrl(roleStyle?.fontAssetUrl ?? typography.fontAssetUrl);

          return (
            <React.Fragment key={`${overlayIndex}-${wordIndex}-${overlay.startFrame}`}>
              <Text
                font={roleFontAssetUrl}
                fontSize={0.58 * fontSizeScale}
                color={overlay.color}
                fontStyle="normal"
                fontWeight={roleStyle?.fontWeight}
                letterSpacing={roleStyle?.trackingEm}
                lineHeight={roleStyle?.lineHeight}
                anchorX="center"
                anchorY="middle"
                position={transform.position}
                scale={transform.scale}
                rotation={transform.rotation}
                renderOrder={textRenderOrder}
                fillOpacity={contract.observable.opacity}
                outlineWidth={0.015}
                outlineColor="#000000"
                strokeWidth={0.01}
                strokeColor="#000000"
              >
                {visibleWord}
              </Text>
              <TextPrimitiveAccent word={word} contract={contract} />
            </React.Fragment>
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

const PiPFrameChrome: React.FC<{contract: JosephPiPRenderContract}> = ({contract}) => {
  const {viewport} = useThree();
  const rect = percentRectToViewport({frameRect: contract.frame, viewportWidth: viewport.width, viewportHeight: viewport.height});
  const padding = Math.max(0.04, contract.frame.safeMarginPercent / 100);

  return (
    <group position={[rect.x, rect.y, contract.frame.matteZ]}>
      <mesh position={[0, -padding * 0.7, 0]} renderOrder={contract.frame.renderOrder - 1}>
        <planeGeometry args={[rect.width + padding * 2.4, rect.height + padding * 2.4]} />
        <meshBasicMaterial color="#05070B" transparent opacity={contract.frame.matteOpacity} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, contract.frame.chromeZ - contract.frame.matteZ]} renderOrder={contract.frame.renderOrder + 1}>
        <planeGeometry args={[rect.width + padding, rect.height + padding]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.2 + contract.motion.progress * 0.12} wireframe depthWrite={false} />
      </mesh>
    </group>
  );
};

const PiPBackgroundLayer: React.FC<{layer: JosephPiPBackgroundLayerRenderContract}> = ({layer}) => {
  const {viewport} = useThree();
  const rect = percentRectToViewport({
    frameRect: layer.frameRect,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  });

  return (
    <mesh position={[rect.x, rect.y, layer.z]} renderOrder={layer.renderOrder}>
      <planeGeometry args={[rect.width, rect.height]} />
      <meshBasicMaterial color={layer.color} transparent opacity={layer.opacity} depthWrite={false} />
    </mesh>
  );
};

const JosephPiPRig: React.FC<{plan: JosephPiPPlan | undefined}> = ({plan}) => {
  const frame = useCurrentFrame();
  if (!plan) {
    return null;
  }

  const contract = resolvePiPRenderContract({plan, frame});

  return (
    <group scale={[contract.motion.scale, contract.motion.scale, 1]}>
      {contract.layers.map((layer, index) => (
        <PiPBackgroundLayer key={`${layer.role}-${index}`} layer={layer} />
      ))}
      <PiPFrameChrome contract={contract} />
    </group>
  );
};

const macroRigLayerColor = (role: JosephMacroRigRenderContract['layers'][number]['role']): string => {
  if (role === 'speaker_pip') return '#FFFFFF';
  if (role === 'exhibit_board') return '#F6C85F';
  if (role === 'data_label') return '#2F6BFF';
  return '#FF0040';
};

const JosephMacroRig: React.FC<{contract: JosephMacroRigRenderContract}> = ({contract}) => {
  const {viewport} = useThree();
  if (!contract.active) {
    return null;
  }

  return (
    <group>
      {contract.layers
        .filter((layer) => layer.role !== 'speaker_pip')
        .map((layer, index) => {
          const rect = percentRectToViewport({
            frameRect: layer.frameRect,
            viewportWidth: viewport.width,
            viewportHeight: viewport.height,
          });
          return (
            <mesh
              key={`${layer.role}-${index}`}
              position={[rect.x, rect.y, layer.z]}
              renderOrder={layer.renderOrder}
            >
              <planeGeometry args={[rect.width, rect.height]} />
              <meshBasicMaterial color={macroRigLayerColor(layer.role)} transparent opacity={layer.role === 'exhibit_board' ? 0.16 : 0.1} depthWrite={false} />
            </mesh>
          );
        })}
    </group>
  );
};
const JosephBackgroundRig: React.FC<{contract: ReturnType<typeof resolveBackgroundRenderContract>}> = ({contract}) => {
  if (contract.layers.length === 0) {
    return null;
  }

  return (
    <group>
      {contract.layers.map((layer, index) => (
        <mesh
          key={`${layer.primitiveId}-${index}`}
          position={[0, 0, layer.z]}
          scale={[layer.scale[0], layer.scale[1], 1]}
          renderOrder={layer.renderOrder}
        >
          <planeGeometry args={[10.66, 6]} />
          <meshBasicMaterial color={layer.color} transparent opacity={layer.opacity} depthWrite={false} />
        </mesh>
      ))}
      {contract.rules.contrastScrimOpacity > 0 && (
        <mesh position={[0, 0, 0.5]} renderOrder={contract.rules.textRenderOrder - 2}>
          <planeGeometry args={[10.66, 6]} />
          <meshBasicMaterial color="#000000" transparent opacity={contract.rules.contrastScrimOpacity} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
};

const JosephScene: React.FC<{manifest: UnifiedRenderManifest}> = ({manifest}) => {
  const frame = useCurrentFrame();
  const activeOverlays = findActiveOverlays(manifest.textOverlays, frame);
  const activeTransition = findActiveTransition(manifest.transitions, frame);
  const backgroundContract = resolveBackgroundRenderContract(manifest.josephBackground);
  const pipContract = manifest.josephPiP
    ? resolvePiPRenderContract({plan: manifest.josephPiP, frame, cameraMoves: manifest.cameraMoves})
    : null;
  const macroRigContract = resolveMacroRigRenderContract({macroRig: manifest.josephMacroRig, frame, cameraMoves: manifest.cameraMoves});

  return (
    <>
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[0, 0, 4]} intensity={1.2} />
      <JosephBackgroundRig contract={backgroundContract} />
      <JosephMacroRig contract={macroRigContract} />
      <JosephPiPRig plan={manifest.josephPiP} />
      <VideoPlane
        track={manifest.videoTracks[0]}
        manifest={manifest}
        frameRect={manifest.josephPiP?.frame}
        opacity={backgroundContract.rules.sourceVideoOpacity}
        z={pipContract?.frame.sourceZ}
        renderOrder={pipContract?.frame.renderOrder ?? 18}
      />
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
