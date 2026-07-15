import React, {useEffect, useMemo} from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
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
  resolveKineticTextLayout,
  resolveMacroRigRenderContract,
  resolveMicroAnimationRenderContract,
  resolvePiPRenderContract,
  resolveSourcePresentationContract,
  resolveTypographyRenderContract,
} from './joseph-render-contract';
import {type MatteRenderContract, resolveMatteRenderContract} from './matte-render-contract';

const toRemotionFontAssetUrl = (fontAssetUrl: string) =>
  fontAssetUrl.startsWith('/') ? staticFile(fontAssetUrl.replace(/^\//, '')) : fontAssetUrl;

type TypographyPreloadContract = {
  characters: string;
  fontAssetUrls: string[];
  rootFontAssetUrl: string;
  typography: ReturnType<typeof resolveTypographyRenderContract>;
};

const TYPOGRAPHY_DIAGNOSTIC_TEXT =
  'pip_typography_subject_occlusion / pip_camera_subject_focus_risk';

const resolveTypographyPreloadContract = (manifest: UnifiedRenderManifest): TypographyPreloadContract => {
  const typography = resolveTypographyRenderContract(
    manifest.typography,
    manifest.josephTypography,
    manifest.josephPiP,
  );
  const rootFontAssetUrl = toRemotionFontAssetUrl(typography.fontAssetUrl);
  const roleFontAssetUrls = Object.values(typography.observable.roleStyles)
    .flatMap((style) => style ? [toRemotionFontAssetUrl(style.fontAssetUrl)] : []);
  const fontAssetUrls = [...new Set([rootFontAssetUrl, ...roleFontAssetUrls])].sort();
  const text = [
    ...manifest.textOverlays.map((overlay) => overlay.text),
    ...typography.observable.lines.map((line) => line.text),
    TYPOGRAPHY_DIAGNOSTIC_TEXT,
  ].join(' ');
  const characters = [...new Set(Array.from(text))]
    .sort((left, right) => (left.codePointAt(0) ?? 0) - (right.codePointAt(0) ?? 0))
    .join('') || ' ';

  return {characters, fontAssetUrls, rootFontAssetUrl, typography};
};

const TypographyFontPreloader: React.FC<{contract: TypographyPreloadContract}> = ({contract}) => (
  <group visible={false}>
    {contract.fontAssetUrls.map((fontAssetUrl) => (
      <Text
        key={fontAssetUrl}
        font={fontAssetUrl}
        characters={contract.characters}
        fontSize={0.01}
      >
        {contract.characters}
      </Text>
    ))}
  </group>
);

const toRemotionMediaUrl = (mediaUrl: string): string =>
  /^(https?:)?\/\//i.test(mediaUrl) ? mediaUrl : staticFile(mediaUrl.replace(/^\/+/, ''));

const dbToGain = (db: number): number => Math.pow(10, db / 20);

const resolveSfxAssetUrl = (cue: UnifiedRenderManifest['audio']['sfx'][number]): string => {
  const fileName = `${cue.cue}_${cue.variant ?? 1}.mp3`;
  return staticFile(`sfx/${fileName}`);
};

const resolveDjPreviewVolume = ({
  event,
  regions,
  frame,
  fps
}: {
  event: NonNullable<UnifiedRenderManifest['audio']['djPlan']>['musicEvents'][number];
  regions: NonNullable<UnifiedRenderManifest['audio']['djPlan']>['duckingRegions'];
  frame: number;
  fps: number;
}): number => {
  const elapsedSec = frame / fps;
  const globalSec = event.videoStartSec + elapsedSec;
  const duckingRegion = regions.find((region) => globalSec >= region.videoStartSec && globalSec <= region.videoEndSec);
  const baseGain = dbToGain(duckingRegion?.targetMusicDb ?? event.volumeDb);
  const fadeIn = event.fadeInSec > 0
    ? interpolate(elapsedSec, [0, event.fadeInSec], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 1;
  const eventDurationSec = Math.max(0.001, event.videoEndSec - event.videoStartSec);
  const fadeOutStart = Math.max(0, eventDurationSec - event.fadeOutSec);
  const fadeOut = event.fadeOutSec > 0
    ? interpolate(elapsedSec, [fadeOutStart, eventDurationSec], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 1;
  return baseGain * Math.min(fadeIn, fadeOut);
};

const JosephAudioPreview: React.FC<{manifest: UnifiedRenderManifest}> = ({manifest}) => {
  const {fps} = useVideoConfig();
  const djPlan = manifest.audio.djPlan;
  const sourceAudioUrl = manifest.source.videoUrl;

  return (
    <>
      <Audio src={toRemotionMediaUrl(sourceAudioUrl)} volume={dbToGain(manifest.audio.voiceVolumeDb)} />
      {djPlan?.musicEvents.map((event) => {
        if (!event.browserUrl) {
          return null;
        }
        const fromFrame = Math.max(0, Math.round(event.videoStartSec * fps));
        const durationInFrames = Math.max(1, Math.ceil((event.videoEndSec - event.videoStartSec) * fps));
        return (
          <Sequence key={event.id} from={fromFrame} durationInFrames={durationInFrames} name={event.id}>
            <Audio
              src={toRemotionMediaUrl(event.browserUrl)}
              trimBefore={Math.max(0, Math.round(event.trackStartSec * fps))}
              trimAfter={Math.max(1, Math.round(event.trackEndSec * fps))}
              volume={(frame) => resolveDjPreviewVolume({event, regions: djPlan.duckingRegions, frame, fps})}
            />
          </Sequence>
        );
      })}
      {manifest.audio.sfx.map((cue) => (
        <Sequence
          key={cue.id}
          from={Math.max(0, Math.round((cue.triggerMs / 1000) * fps))}
          durationInFrames={Math.max(1, Math.ceil((cue.durationMs / 1000) * fps))}
          name={cue.id}
        >
          <Audio src={resolveSfxAssetUrl(cue)} volume={dbToGain(cue.volumeDb)} />
        </Sequence>
      ))}
    </>
  );
};

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

const resolveOverlayTimelinePosition = (
  overlay: TextOverlay,
  manifest: UnifiedRenderManifest,
): {x: number; y: number} => {
  const overlayStartMs = (overlay.startFrame / manifest.fps) * 1000;
  const normalizedOverlay = normalizeTypographyText(overlay.text);
  let best: {distanceMs: number; position: {x: number; y: number}} | null = null;

  for (const event of manifest.timeline) {
    if (event.type !== 'text' || normalizeTypographyText(event.word) !== normalizedOverlay) {
      continue;
    }
    const distanceMs = Math.abs(event.startMs - overlayStartMs);
    if (!best || distanceMs < best.distanceMs) {
      best = {distanceMs, position: {x: event.position.x, y: event.position.y}};
    }
  }

  return best?.position ?? {x: 0.5, y: 0.15};
};

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
  position: [number, number, number];
  maxWidth: number;
}> = ({word, contract, position, maxWidth}) => {
  const {observable} = contract;
  if (observable.accentKind === 'none' || observable.accentOpacity <= 0) {
    return null;
  }

  const [preferredWidth, height] = textAccentSize(word, observable.accentKind);
  const width = Math.min(preferredWidth, maxWidth * 0.92);

  return (
    <mesh
      position={[
        position[0] + observable.accentOffset[0],
        position[1] + observable.accentOffset[1],
        position[2] + observable.accentOffset[2],
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

const KineticText: React.FC<{
  overlays: readonly TextOverlay[];
  manifest: UnifiedRenderManifest;
  typographyPreload: TypographyPreloadContract;
}> = ({overlays, manifest, typographyPreload}) => {
  const frame = useCurrentFrame();
  const typography = typographyPreload.typography;
  const {camera, viewport} = useThree();
  const currentViewport = viewport.getCurrentViewport(camera, new THREE.Vector3(0, 0, 0));

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
          const timelinePosition = resolveOverlayTimelinePosition(overlay, manifest);
          const layout = resolveKineticTextLayout({
            text: visibleWord,
            viewportWidth: currentViewport.width,
            viewportHeight: currentViewport.height,
            preferredFontSize: 0.58 * fontSizeScale,
            textScale: Math.max(Math.abs(transform.scale[0]), Math.abs(transform.scale[1])),
            trackingEm: roleStyle?.trackingEm ?? 0,
            normalizedPosition: timelinePosition,
            motionPosition: transform.position,
          });

          return (
            <React.Fragment key={`${overlayIndex}-${wordIndex}-${overlay.startFrame}`}>
              <Text
                font={roleFontAssetUrl}
                characters={typographyPreload.characters}
                fontSize={layout.fontSize}
                maxWidth={layout.maxWidth}
                color={overlay.color}
                fontStyle="normal"
                fontWeight={roleStyle?.fontWeight}
                letterSpacing={roleStyle?.trackingEm}
                lineHeight={roleStyle?.lineHeight}
                anchorX="center"
                anchorY="middle"
                position={layout.position}
                scale={transform.scale}
                rotation={transform.rotation}
                renderOrder={textRenderOrder}
                fillOpacity={contract.observable.opacity}
                outlineWidth={layout.fontSize * 0.025}
                outlineColor="#000000"
                strokeWidth={layout.fontSize * 0.018}
                strokeColor="#000000"
              >
                {visibleWord}
              </Text>
              <TextPrimitiveAccent word={word} contract={contract} position={layout.position} maxWidth={layout.maxWidth} />
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

const PiPFailureTagMarkers: React.FC<{
  contract: JosephPiPRenderContract;
  typographyPreload: TypographyPreloadContract;
}> = ({contract, typographyPreload}) => {
  const {viewport} = useThree();
  const failureTags = contract.clearance.failureTags;
  if (failureTags.length === 0) {
    return null;
  }

  const protectedFrame: JosephPiPFrame = {
    ...contract.clearance.protectedSubjectRect,
    borderRadiusPx: 0,
    safeMarginPercent: 0,
    depth: contract.frame.depth,
  };
  const rect = percentRectToViewport({
    frameRect: protectedFrame,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  });
  const labelWidth = Math.max(1.4, Math.min(rect.width, failureTags.join(' / ').length * 0.045));
  const markerZ = contract.frame.chromeZ + 0.12;

  return (
    <group position={[rect.x, rect.y + rect.height / 2 + 0.13, markerZ]}>
      <mesh renderOrder={contract.frame.renderOrder + 5}>
        <planeGeometry args={[labelWidth, 0.16]} />
        <meshBasicMaterial color="#FF0040" transparent opacity={0.82} depthWrite={false} />
      </mesh>
      <Text
        font={typographyPreload.rootFontAssetUrl}
        characters={typographyPreload.characters}
        fontSize={0.062}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        position={[0, 0, 0.01]}
        renderOrder={contract.frame.renderOrder + 6}
      >
        {failureTags.join(' / ')}
      </Text>
    </group>
  );
};

const JosephPiPRig: React.FC<{
  plan: JosephPiPPlan | undefined;
  cameraMoves: readonly CameraMove[];
  matteContract: MatteRenderContract;
  typographyPreload: TypographyPreloadContract;
}> = ({plan, cameraMoves, matteContract, typographyPreload}) => {
  const frame = useCurrentFrame();
  if (!plan) {
    return null;
  }

  const contract = resolvePiPRenderContract({plan, frame, cameraMoves, matte: matteContract});

  return (
    <group scale={[contract.motion.scale, contract.motion.scale, 1]}>
      {contract.layers.map((layer, index) => (
        <PiPBackgroundLayer key={`${layer.role}-${index}`} layer={layer} />
      ))}
      <PiPFrameChrome contract={contract} />
      <PiPFailureTagMarkers contract={contract} typographyPreload={typographyPreload} />
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
const JosephBackgroundRig: React.FC<{
  contract: ReturnType<typeof resolveBackgroundRenderContract>;
  allowForegroundLayers: boolean;
}> = ({contract, allowForegroundLayers}) => {
  if (!allowForegroundLayers) {
    return null;
  }
  const visibleLayers = allowForegroundLayers
    ? contract.layers
    : contract.layers.filter((layer) => layer.renderOrder < 18);
  if (visibleLayers.length === 0 && contract.rules.contrastScrimOpacity <= 0) {
    return null;
  }

  return (
    <group>
      {visibleLayers.map((layer, index) => (
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

const JosephScene: React.FC<{
  manifest: UnifiedRenderManifest;
  typographyPreload: TypographyPreloadContract;
}> = ({manifest, typographyPreload}) => {
  const frame = useCurrentFrame();
  const activeOverlays = findActiveOverlays(manifest.textOverlays, frame);
  const activeTransition = findActiveTransition(manifest.transitions, frame);
  const backgroundContract = resolveBackgroundRenderContract(manifest.josephBackground);
  const matteContract = resolveMatteRenderContract(manifest);
  const sourcePresentation = resolveSourcePresentationContract({
    pipPlan: manifest.josephPiP,
    matteAvailable: matteContract.available,
    sourceVideoOpacity: backgroundContract.rules.sourceVideoOpacity,
  });
  const pipContract = manifest.josephPiP
    ? resolvePiPRenderContract({plan: manifest.josephPiP, frame, cameraMoves: manifest.cameraMoves, matte: matteContract})
    : null;
  const macroRigContract = resolveMacroRigRenderContract({macroRig: manifest.josephMacroRig, frame, cameraMoves: manifest.cameraMoves});

  return (
    <>
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[0, 0, 4]} intensity={1.2} />
      <JosephBackgroundRig contract={backgroundContract} allowForegroundLayers={sourcePresentation.mode === 'pip'} />
      <JosephMacroRig contract={macroRigContract} />
      <TypographyFontPreloader contract={typographyPreload} />
      {sourcePresentation.showPiPScaffolding && (
        <JosephPiPRig
          plan={manifest.josephPiP}
          cameraMoves={manifest.cameraMoves}
          matteContract={matteContract}
          typographyPreload={typographyPreload}
        />
      )}
      <VideoPlane
        track={manifest.videoTracks[0]}
        manifest={manifest}
        frameRect={sourcePresentation.frameRect}
        opacity={sourcePresentation.opacity}
        z={sourcePresentation.mode === 'pip' ? pipContract?.frame.sourceZ : 0}
        renderOrder={sourcePresentation.mode === 'pip' ? (pipContract?.frame.renderOrder ?? 18) : 18}
      />
      <CameraRig cameraMoves={manifest.cameraMoves} seed={manifest.seed} />
      <KineticText overlays={activeOverlays} manifest={manifest} typographyPreload={typographyPreload} />
      <ZoomBlurQuad transition={activeTransition} />
    </>
  );
};

export type JosephEditProps = {
  manifest: UnifiedRenderManifest;
  audioPreviewEnabled?: boolean;
};

export const JosephEdit: React.FC<JosephEditProps> = ({manifest, audioPreviewEnabled = true}) => {
  const {width, height} = useVideoConfig();
  const typographyPreload = useMemo(() => resolveTypographyPreloadContract(manifest), [manifest]);

  return (
    <AbsoluteFill style={{backgroundColor: '#000000'}}>
      {audioPreviewEnabled && <JosephAudioPreview manifest={manifest} />}
      <Canvas
        gl={{preserveDrawingBuffer: true, antialias: true, alpha: false, powerPreference: 'high-performance'}}
        dpr={1}
        frameloop="always"
        camera={{position: [0, 0, 5], fov: 45, near: 0.1, far: 100}}
        style={{width, height, display: 'block'}}
      >
        <JosephScene manifest={manifest} typographyPreload={typographyPreload} />
      </Canvas>
    </AbsoluteFill>
  );
};
