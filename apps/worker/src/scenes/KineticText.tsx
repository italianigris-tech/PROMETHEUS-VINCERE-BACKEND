import React, {useEffect, useLayoutEffect, useMemo, useRef} from "react";
import type {EmotionalBeat, RenderManifest} from "@prometheus/shared-types";
import {useFrame, useThree} from "@react-three/fiber";
import {useCurrentFrame, useVideoConfig} from "remotion";
import * as THREE from "three";

import {useCameraRigStore} from "./CameraRig.js";
import {TEXT_BLOOM_LAYER} from "./post-processing.js";
import {selectEaseForTimestamp} from "../lib/easing-modulator.js";
import {applyImperfection} from "../lib/imperfection-engine.js";
import {findPatternForSemanticTag} from "../lib/motion-ontology.js";
import {
  parseColorAnnotations,
  type ColorRange
} from "../engine/text-colorizer.js";
import {
  planTextChoreography,
  type TextChoreographyPlan
} from "../engine/text-choreography/TextChoreography.js";
import {
  KineticTextEngine,
  type KineticTextConfig,
  type KineticTextInstance,
  type KineticTextStyleRanges,
  type WordAnimationState,
  type WordConfig
} from "../engine/text/KineticTextEngine.js";
import {injectVertexDeformation, updateDeformationTime} from "../engine/vertex-deformation.js";
import {
  getRenderEngineConfig,
  type RenderEngineManifestExtension
} from "../types/render-engine.js";

export type WordLayout = {
  text: string;
  colorRanges: ColorRange[];
  x: number;
  width: number;
  startMs: number;
  endMs: number;
  animated: boolean;
};

export type KineticTextProps = {
  manifest: RenderManifest;
};

export const KINETIC_TEXT_MEASUREMENT_TIMEOUT_MS = 2000;

const IDENTITY_WORD_STATE: WordAnimationState = {
  opacity: 1,
  x: 0,
  y: 0,
  z: 0,
  scale: 1,
  rotation: 0
};

const estimateWordWidth = (word: string, fontSize: number): number =>
  Math.max(fontSize * 0.48, word.length * fontSize * 0.54);

export const buildWordLayout = (
  timedWords: Array<Omit<WordLayout, "x" | "width">>,
  fontSize: number,
  measuredWidths: readonly number[] = []
): WordLayout[] => {
  if (timedWords.length === 0) {
    return [];
  }

  const spacing = fontSize * 0.28;
  const widths = timedWords.map((word, index) => measuredWidths[index] ?? estimateWordWidth(word.text, fontSize));
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + spacing * Math.max(widths.length - 1, 0);
  let cursor = -totalWidth / 2;

  return timedWords.map((word, index) => {
    const width = widths[index] ?? estimateWordWidth(word.text, fontSize);
    const x = cursor + width / 2;
    cursor += width + spacing;
    return {
      ...word,
      width,
      x
    };
  });
};

export const planKineticTextChoreography = (
  manifest: RenderManifest,
  layout: readonly WordLayout[]
): TextChoreographyPlan | null => {
  if (!manifest.textAnimationGrammar || layout.length === 0) {
    return null;
  }

  return planTextChoreography({
    words: layout.map((word) => ({
      text: word.text,
      startMs: word.startMs,
      endMs: word.endMs
    })),
    grammar: manifest.textAnimationGrammar,
    durationMs: manifest.durationInFrames / manifest.fps * 1000
  });
};

export const shouldEnableTextBloomLayerForWord = (
  manifest: Pick<RenderManifest, "textAnimationGrammar">,
  choreography: TextChoreographyPlan | null,
  wordIndex: number
): boolean => {
  if (!manifest.textAnimationGrammar) {
    return true;
  }

  if (manifest.textAnimationGrammar.selectiveEffects.length === 0) {
    return true;
  }

  return Boolean(choreography?.words[wordIndex]?.selectiveEffects.bloom);
};

export const shouldEnableTextBloomLayerForMesh = (
  manifest: Pick<RenderManifest, "textAnimationGrammar">,
  choreography: TextChoreographyPlan | null,
  wordCount: number
): boolean => {
  if (!manifest.textAnimationGrammar || manifest.textAnimationGrammar.selectiveEffects.length === 0) {
    return true;
  }

  return Array.from({length: wordCount}, (_unused, index) =>
    shouldEnableTextBloomLayerForWord(manifest, choreography, index)
  ).some(Boolean);
};

const buildTimedWords = (manifest: RenderManifest): Array<Omit<WordLayout, "x" | "width">> => {
  const parsedTranscript = parseColorAnnotations(manifest.transcript);
  const words = Array.from(parsedTranscript.plainText.matchAll(/\S+/g));
  if (words.length === 0) {
    return [];
  }

  if (manifest.transcriptWords.length === 0) {
    return [{
      text: parsedTranscript.plainText,
      colorRanges: parsedTranscript.colorRanges,
      startMs: 0,
      endMs: manifest.durationInFrames / manifest.fps * 1000,
      animated: false
    }];
  }

  const count = Math.min(words.length, manifest.transcriptWords.length);
  if (words.length !== manifest.transcriptWords.length) {
    console.warn(
      `[KineticText] transcriptWords length ${manifest.transcriptWords.length} does not match word count ${words.length}; using ${count}.`
    );
  }

  return words.slice(0, count).map((wordMatch, index) => {
    const word = wordMatch[0];
    const wordStart = wordMatch.index ?? 0;
    const wordEnd = wordStart + word.length;
    const colorRanges = parsedTranscript.colorRanges.flatMap((range) => {
      const start = Math.max(range.start, wordStart);
      const end = Math.min(range.end, wordEnd);
      return end > start
        ? [{start: start - wordStart, end: end - wordStart, color: range.color}]
        : [];
    });
    const timing = manifest.transcriptWords[index];
    const fallbackStartMs = index * (manifest.durationInFrames / manifest.fps * 1000) / count;
    const fallbackEndMs = (index + 1) * (manifest.durationInFrames / manifest.fps * 1000) / count;
    return {
      text: word,
      colorRanges,
      startMs: timing?.startMs ?? fallbackStartMs,
      endMs: timing?.endMs ?? fallbackEndMs,
      animated: true
    };
  });
};

type MotionTweenTracks = {
  common: Record<string, unknown>;
  position: Record<string, unknown>;
  material: Record<string, unknown>;
  scale: Record<string, unknown>;
  rotation: Record<string, unknown>;
};

const GSAP_CONTROL_KEYS = new Set([
  "delay",
  "duration",
  "ease",
  "onComplete",
  "onUpdate",
  "overwrite",
  "repeat",
  "stagger",
  "yoyo"
]);

const RANDOM_DEGREES = /^random\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/;
const RANDOM_RANGE = /^random\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/;

const seededUnit = (seed: number): number => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

const numericTweenValue = (value: unknown, fallback: number, seed: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const randomMatch = RANDOM_RANGE.exec(value);
  if (randomMatch) {
    const start = Number(randomMatch[1]);
    const end = Number(randomMatch[2]);
    return THREE.MathUtils.lerp(start, end, seededUnit(seed));
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const rotationDegreesToRadians = (value: unknown): unknown => {
  if (typeof value === "number") {
    return THREE.MathUtils.degToRad(value);
  }

  if (typeof value !== "string") {
    return value;
  }

  const match = RANDOM_DEGREES.exec(value);
  if (!match) {
    return value;
  }

  const start = Number(match[1]);
  const end = Number(match[2]);
  return `random(${THREE.MathUtils.degToRad(start)}, ${THREE.MathUtils.degToRad(end)})`;
};

const assignUniformScale = (scale: Record<string, unknown>, value: unknown): void => {
  scale.x = value;
  scale.y = value;
  scale.z = value;
};

export const splitMotionTweenVars = (vars: Record<string, unknown>): MotionTweenTracks => {
  const tracks: MotionTweenTracks = {
    common: {},
    position: {},
    material: {},
    scale: {},
    rotation: {}
  };

  for (const [key, value] of Object.entries(vars)) {
    if (GSAP_CONTROL_KEYS.has(key)) {
      tracks.common[key] = value;
      continue;
    }

    switch (key) {
      case "opacity":
        tracks.material.opacity = value;
        break;
      case "scale":
        assignUniformScale(tracks.scale, value);
        break;
      case "scaleX":
        tracks.scale.x = value;
        break;
      case "scaleY":
        tracks.scale.y = value;
        break;
      case "scaleZ":
        tracks.scale.z = value;
        break;
      case "rotation":
        tracks.rotation.z = rotationDegreesToRadians(value);
        break;
      case "rotationX":
        tracks.rotation.x = rotationDegreesToRadians(value);
        break;
      case "rotationY":
        tracks.rotation.y = rotationDegreesToRadians(value);
        break;
      case "rotationZ":
        tracks.rotation.z = rotationDegreesToRadians(value);
        break;
      case "x":
      case "y":
      case "z":
        tracks.position[key] = value;
        break;
      default:
        break;
    }
  }

  return tracks;
};

type ChromeShader = {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, THREE.IUniform>;
};

type ChromeCompileHook = (
  shader: ChromeShader,
  renderer: THREE.WebGLRenderer
) => void;

export const shouldUseChromeText = (
  manifest: Pick<RenderManifest, "envMapIntensity"> & {chrome?: boolean}
): boolean => Boolean(manifest.chrome);

const colorFromStop = (value: string | undefined, fallback: string): THREE.Color =>
  new THREE.Color(value ?? fallback);

const sampleStops = (
  stops: Array<{t: number; color: THREE.Color}>,
  t: number
): THREE.Color => {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  const first = stops[0];
  if (!first) {
    return new THREE.Color("#ffffff");
  }

  const nextIndex = stops.findIndex((stop) => stop.t >= clamped);
  if (nextIndex <= 0) {
    return first.color.clone();
  }

  const last = stops[stops.length - 1] ?? first;
  const next = stops[nextIndex] ?? last;
  const previous = stops[nextIndex - 1] ?? first;
  const span = Math.max(next.t - previous.t, 0.0001);
  return previous.color.clone().lerp(next.color, (clamped - previous.t) / span);
};

export const createBakedHighlightMap = (
  colors: readonly string[],
  chrome = false
): THREE.DataTexture => {
  const width = 256;
  const data = new Uint8Array(width * 4);
  const baseColors = colors.length > 0 ? colors : ["#ffffff", "#7be8ff"];
  const stops = chrome
    ? [
        {t: 0, color: new THREE.Color("#07090f")},
        {t: 0.18, color: new THREE.Color("#f8fbff")},
        {t: 0.34, color: colorFromStop(baseColors[1], "#8bd8ff")},
        {t: 0.52, color: new THREE.Color("#1b2332")},
        {t: 0.7, color: new THREE.Color("#ffffff")},
        {t: 1, color: colorFromStop(baseColors[0], "#d7e2f0")}
      ]
    : [
        {t: 0, color: colorFromStop(baseColors[0], "#ffffff")},
        {t: 0.42, color: new THREE.Color("#ffffff")},
        {t: 0.58, color: colorFromStop(baseColors[1], "#7be8ff")},
        {t: 1, color: colorFromStop(baseColors[0], "#ffffff")}
      ];

  for (let x = 0; x < width; x += 1) {
    const color = sampleStops(stops, x / Math.max(width - 1, 1));
    const offset = x * 4;
    data[offset] = Math.round(color.r * 255);
    data[offset + 1] = Math.round(color.g * 255);
    data[offset + 2] = Math.round(color.b * 255);
    data[offset + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
};

export const applyFakeChromeEnvironment = (
  material: THREE.MeshBasicMaterial,
  ramp: THREE.Texture,
  intensity = 1
): void => {
  const baseOnBeforeCompile = material.onBeforeCompile as ChromeCompileHook;
  const chromeIntensity = THREE.MathUtils.clamp(intensity, 0, 1);

  material.onBeforeCompile = ((shader: ChromeShader, renderer: THREE.WebGLRenderer) => {
    baseOnBeforeCompile.call(material, shader, renderer);

    shader.uniforms.uChromeRamp = {value: ramp};
    shader.uniforms.uChromeIntensity = {value: chromeIntensity};
    shader.vertexShader = shader.vertexShader.replace(
      "void main() {",
      `varying vec3 vChromeWorldNormal;
varying vec3 vChromeViewDir;
void main() {`
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <beginnormal_vertex>",
      `#include <beginnormal_vertex>
vChromeWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vec4 chromeWorldPosition = modelMatrix * vec4(transformed, 1.0);
vChromeViewDir = normalize(cameraPosition - chromeWorldPosition.xyz);`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      `uniform sampler2D uChromeRamp;
uniform float uChromeIntensity;
varying vec3 vChromeWorldNormal;
varying vec3 vChromeViewDir;
void main() {`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
float chromeFacing = clamp(dot(normalize(vChromeWorldNormal), normalize(vChromeViewDir)) * 0.5 + 0.5, 0.0, 1.0);
float chromeBand = fract(chromeFacing * 1.7 + vChromeViewDir.x * 0.22 - vChromeViewDir.y * 0.12);
vec3 chromeColor = texture2D(uChromeRamp, vec2(chromeBand, 0.5)).rgb;
diffuseColor.rgb = mix(diffuseColor.rgb, chromeColor, uChromeIntensity);`
    );
    material.userData.chromeShader = shader;
  }) as THREE.MeshBasicMaterial["onBeforeCompile"];

  material.needsUpdate = true;
};

const buildPlainText = (layout: readonly WordLayout[]): string =>
  layout.map((word) => word.text).join(" ");

export const buildKineticTextStyleRanges = (
  layout: readonly WordLayout[],
  fallbackColor: string
): KineticTextStyleRanges => {
  const styleRanges: KineticTextStyleRanges = {};
  let cursor = 0;

  for (const word of layout) {
    for (const range of word.colorRanges) {
      styleRanges[cursor + range.start] = range.color;
      styleRanges[cursor + range.end] = fallbackColor;
    }
    cursor += word.text.length + 1;
  }

  return styleRanges;
};

const wordStateFromTweenVars = (
  vars: Record<string, unknown>,
  fallback: WordAnimationState,
  seed: number
): WordAnimationState => {
  const tracks = splitMotionTweenVars(vars);
  return {
    opacity: numericTweenValue(tracks.material.opacity, fallback.opacity, seed + 0.1),
    x: numericTweenValue(tracks.position.x, fallback.x, seed + 0.2),
    y: numericTweenValue(tracks.position.y, fallback.y, seed + 0.3),
    z: numericTweenValue(tracks.position.z, fallback.z, seed + 0.4),
    scale: numericTweenValue(
      tracks.scale.x ?? tracks.scale.y ?? tracks.scale.z,
      fallback.scale,
      seed + 0.5
    ),
    rotation: numericTweenValue(tracks.rotation.z, fallback.rotation, seed + 0.6)
  };
};

const motionVars = (vars: unknown): Record<string, unknown> =>
  vars && typeof vars === "object" && !Array.isArray(vars)
    ? vars as Record<string, unknown>
    : {};

const currentEmotionalBeat = (
  wordStartMs: number,
  beats: readonly EmotionalBeat[] | undefined
): EmotionalBeat | null => {
  if (!beats) {
    return null;
  }

  return beats.find((beat) => wordStartMs >= beat.timestamp[0] && wordStartMs < beat.timestamp[1]) ?? null;
};

const buildWordConfig = (
  word: WordLayout,
  index: number,
  manifest: RenderManifest,
  choreography: TextChoreographyPlan | null,
  fps: number
): WordConfig => {
  if (!word.animated) {
    return {
      from: IDENTITY_WORD_STATE,
      to: IDENTITY_WORD_STATE,
      delay: 0,
      duration: 1 / Math.max(fps, 1),
      ease: "none",
      effect: "none"
    };
  }

  const choreographyEvent = choreography?.words[index];
  const choreographyDuration = choreographyEvent
    ? Math.max((choreographyEvent.enterEndMs - choreographyEvent.enterStartMs) / 1000, 1 / fps)
    : null;
  const effectiveStart = choreographyEvent
    ? choreographyEvent.enterStartMs / 1000
    : typeof word.startMs === "number" && !Number.isNaN(word.startMs)
      ? word.startMs / 1000
      : index * (manifest.wordStagger ?? 0.1);
  const duration = choreographyDuration ?? Math.max((word.endMs - word.startMs) / 1000, 1 / fps);
  const rotationSeed = (index + 1) * 1.61803398875;
  const hasBloom = shouldEnableTextBloomLayerForWord(manifest, choreography, index);

  const meta = manifest.directorialMetadata;
  if (!meta) {
    return {
      from: {
        opacity: 0,
        x: 0,
        y: manifest.text.depthTravel * 0.25,
        z: 0,
        scale: 0,
        rotation: Math.sin(rotationSeed) * 0.28
      },
      to: IDENTITY_WORD_STATE,
      delay: effectiveStart,
      duration,
      ease: "back.out(1.7)",
      effect: hasBloom ? "glow-pulse" : "bounce"
    };
  }

  const beat = currentEmotionalBeat(word.startMs, meta.emotionalArc);
  const t = word.startMs / 1000;
  const easeConfig = meta.temporalIntensity
    ? selectEaseForTimestamp(t, meta.temporalIntensity, "back.out(1.7)")
    : {ease: "back.out(1.7)", durationMultiplier: 1, perturbation: 0};
  const transcriptWord = manifest.transcriptWords[index];
  const semanticTag = transcriptWord?.semanticTag ?? beat?.motionVocabulary?.[0] ?? "";
  const pattern = semanticTag ? findPatternForSemanticTag(semanticTag) : null;
  const patternFrom = motionVars(pattern?.gsapConfig?.from);
  const patternTo = motionVars(pattern?.gsapConfig?.to);
  const fallbackFrom = {opacity: 0, y: manifest.text.depthTravel * 0.25, scale: 0.8};
  const fallbackTo = {opacity: 1, y: 0, scale: 1, rotation: 0};
  const patternDuration = choreographyDuration ??
    (((pattern?.gsapConfig?.duration as number | undefined) ?? 0.6) * easeConfig.durationMultiplier);
  const imperfected = meta.imperfectionProfile && beat
    ? applyImperfection(
        meta.imperfectionProfile,
        beat.emotion,
        {duration: patternDuration, x: 0, y: 0, rotation: 0, scale: 1}
      )
    : {duration: patternDuration, x: 0, y: 0, rotation: 0, scale: 1};

  return {
    from: wordStateFromTweenVars(
      {
        ...fallbackFrom,
        ...patternFrom,
        x: patternFrom.x ?? imperfected.x,
        y: patternFrom.y ?? imperfected.y
      },
      {
        opacity: 0,
        x: 0,
        y: manifest.text.depthTravel * 0.25,
        z: 0,
        scale: 0.8,
        rotation: Math.sin(rotationSeed) * 0.28
      },
      rotationSeed
    ),
    to: wordStateFromTweenVars({...fallbackTo, ...patternTo}, IDENTITY_WORD_STATE, rotationSeed + 1),
    delay: effectiveStart,
    duration: Math.max(0.05, imperfected.duration),
    ease: easeConfig.ease,
    effect: hasBloom ? "glow-pulse" : "bounce"
  };
};

export const buildKineticTextEngineConfig = (
  manifest: RenderManifest,
  layout: readonly WordLayout[],
  choreography: TextChoreographyPlan | null,
  fps: number
): KineticTextConfig => ({
  text: buildPlainText(layout),
  fontSize: manifest.text.size,
  font: manifest.fontUrl,
  color: manifest.text.color,
  position: new THREE.Vector3(0, 0, manifest.text.depthZ),
  anchorX: "center",
  anchorY: "middle",
  stagger: 0,
  duration: 0.6,
  ease: "back.out(1.7)",
  words: Object.fromEntries(layout.map((word, index) => [
    index,
    buildWordConfig(word, index, manifest, choreography, fps)
  ])),
  styleRanges: buildKineticTextStyleRanges(layout, manifest.text.color)
});

export const KineticText: React.FC<KineticTextProps> = ({manifest}) => {
  const {scene} = useThree();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const engineRef = useRef<KineticTextEngine | null>(null);
  const instanceRef = useRef<KineticTextInstance | null>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const wordVelocities = useRef(new Map<string, THREE.Vector3>());
  const prevWordPositions = useRef(new Map<string, THREE.Vector3>());
  const velocityScratch = useRef(new Map<string, THREE.Vector3>());

  const renderConfig = useMemo(
    () => getRenderEngineConfig(manifest as RenderManifest & RenderEngineManifestExtension),
    [manifest]
  );
  const timedWords = useMemo(() => buildTimedWords(manifest), [manifest]);
  const layout = useMemo(
    () => buildWordLayout(timedWords, manifest.text.size),
    [manifest.text.size, timedWords]
  );
  const choreography = useMemo(
    () => planKineticTextChoreography(manifest, layout),
    [layout, manifest]
  );
  const engineConfig = useMemo(
    () => buildKineticTextEngineConfig(manifest, layout, choreography, fps),
    [choreography, fps, layout, manifest]
  );

  useLayoutEffect(() => {
    wordVelocities.current = new Map();
    prevWordPositions.current = new Map();
    velocityScratch.current = new Map();
    layout.forEach((_word, index) => {
      const key = `word-${index}`;
      wordVelocities.current.set(key, new THREE.Vector3());
      prevWordPositions.current.set(key, new THREE.Vector3());
      velocityScratch.current.set(key, new THREE.Vector3());
    });
  }, [layout]);

  useEffect(() => {
    if (layout.length === 0 || engineConfig.text.trim().length === 0) {
      return;
    }

    const chrome = renderConfig.chrome || shouldUseChromeText(manifest);
    const highlightMap = createBakedHighlightMap(manifest.gradientColors, chrome);
    const material = new THREE.MeshBasicMaterial({
      color: manifest.text.color,
      map: highlightMap,
      transparent: true,
      opacity: 1,
      alphaTest: 0.01,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    injectVertexDeformation(material, renderConfig.deformation);
    if (chrome) {
      applyFakeChromeEnvironment(material, highlightMap, 1);
    }

    const engine = new KineticTextEngine(scene, Math.max(256, engineConfig.text.length + 32));
    const instance = engine.create({
      ...engineConfig,
      material
    });
    instance.mesh.renderOrder = 10;
    if (shouldEnableTextBloomLayerForMesh(manifest, choreography, layout.length)) {
      instance.mesh.layers.enable(TEXT_BLOOM_LAYER);
    } else {
      instance.mesh.layers.disable(TEXT_BLOOM_LAYER);
    }
    instance.seek(frame / Math.max(fps, 1));

    engineRef.current = engine;
    instanceRef.current = instance;
    materialRef.current = material;

    return () => {
      instance.dispose();
      engine.dispose();
      highlightMap.dispose();
      material.dispose();
      if (engineRef.current === engine) {
        engineRef.current = null;
      }
      if (instanceRef.current === instance) {
        instanceRef.current = null;
      }
      if (materialRef.current === material) {
        materialRef.current = null;
      }
      useCameraRigStore.setState({wordVelocities: new Map()});
    };
  }, [
    choreography,
    engineConfig,
    fps,
    frame,
    layout,
    manifest,
    renderConfig,
    scene
  ]);

  useFrame(() => {
    const instance = instanceRef.current;
    const engine = engineRef.current;
    const material = materialRef.current;
    const currentTime = frame / Math.max(fps, 1);

    if (instance) {
      if (currentTime > instance.timeline.duration()) {
        instance.timeline.progress(1, false);
      } else {
        instance.seek(currentTime);
      }

      instance.wordStates.forEach((state, index) => {
        const key = `word-${index}`;
        const prev = prevWordPositions.current.get(key);
        const vel = velocityScratch.current.get(key);
        if (!prev || !vel) {
          return;
        }

        const current = new THREE.Vector3(state.x, state.y, state.z);
        vel.subVectors(current, prev).multiplyScalar(Math.max(fps, 1));
        prev.copy(current);
        wordVelocities.current.set(key, vel);
      });
      useCameraRigStore.setState({wordVelocities: wordVelocities.current});
    }

    engine?.update(currentTime);
    if (material) {
      updateDeformationTime(material, currentTime);
    }
  });

  return null;
};
