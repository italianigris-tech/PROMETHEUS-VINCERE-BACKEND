import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import type {EmotionalBeat, RenderManifest} from "@prometheus/shared-types";
import {useFrame} from "@react-three/fiber";
import gsap from "gsap";
import {flushSync} from "react-dom";
import {continueRender, delayRender, useCurrentFrame, useVideoConfig} from "remotion";
import * as THREE from "three";
import {Text as TroikaText} from "troika-three-text";

import {useCameraRigStore} from "./CameraRig.js";
import {TEXT_BLOOM_LAYER} from "./post-processing.js";
import {selectEaseForTimestamp} from "../lib/easing-modulator.js";
import {applyImperfection} from "../lib/imperfection-engine.js";
import {findPatternForSemanticTag} from "../lib/motion-ontology.js";
import {
  applyColorRanges,
  parseColorAnnotations,
  type ColorRange
} from "../engine/text-colorizer.js";
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

const estimateWordWidth = (word: string, fontSize: number): number => {
  return Math.max(fontSize * 0.48, word.length * fontSize * 0.54);
};

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

const measureTroikaWord = ({
  word,
  font,
  fontSize,
  sdfGlyphSize
}: {
  word: string;
  font: string;
  fontSize: number;
  sdfGlyphSize: number;
}): Promise<number> =>
  new Promise((resolve) => {
    const textMesh = new TroikaText();
    textMesh.text = word;
    textMesh.font = font;
    textMesh.fontSize = fontSize;
    textMesh.anchorX = "left";
    textMesh.anchorY = "middle";
    textMesh.glyphGeometryDetail = 8;
    textMesh.letterSpacing = 0.01;
    textMesh.maxWidth = Number.POSITIVE_INFINITY;
    textMesh.overflowWrap = "normal";
    textMesh.whiteSpace = "nowrap";
    textMesh.sdfGlyphSize = sdfGlyphSize;
    textMesh.sync(() => {
      textMesh.geometry.computeBoundingBox();
      const bounds = textMesh.geometry.boundingBox;
      const width = bounds ? bounds.max.x - bounds.min.x : estimateWordWidth(word, fontSize);
      textMesh.dispose();
      resolve(Math.max(width, estimateWordWidth(word, fontSize) * 0.35));
    });
  });

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

const hasTrackVars = (vars: Record<string, unknown>): boolean => Object.keys(vars).length > 0;

type TextVisual = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  dispose(): void;
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

const createTroikaTextVisual = (
  word: WordLayout,
  manifest: RenderManifest,
  renderConfig: ReturnType<typeof getRenderEngineConfig>
): TextVisual => {
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
    // MeshBasicMaterial has no physical reflections; this shader wrapper fakes
    // moving chrome bands from view direction while keeping Troika SDF text.
    applyFakeChromeEnvironment(material, highlightMap, 1);
  }

  const textMesh = new TroikaText();
  textMesh.text = word.text;
  textMesh.font = manifest.fontUrl;
  textMesh.fontSize = manifest.text.size;
  textMesh.anchorX = "center";
  textMesh.anchorY = "middle";
  textMesh.glyphGeometryDetail = 8;
  textMesh.letterSpacing = 0.01;
  textMesh.lineHeight = manifest.text.lineHeight;
  textMesh.maxWidth = Math.max(word.width * 1.1, manifest.text.size);
  textMesh.overflowWrap = "normal";
  textMesh.whiteSpace = "nowrap";
  textMesh.sdfGlyphSize = manifest.text.sdfGlyphSize;
  textMesh.color = manifest.text.color;
  textMesh.material = material;
  applyColorRanges(textMesh, word.colorRanges, manifest.text.color);
  textMesh.layers.enable(TEXT_BLOOM_LAYER);
  textMesh.renderOrder = 10;
  textMesh.sync();

  return {
    mesh: textMesh,
    material,
    dispose: () => {
      textMesh.dispose();
      highlightMap.dispose();
      material.dispose();
    }
  };
};

export const KineticText: React.FC<KineticTextProps> = ({manifest}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const renderConfig = useMemo(
    () => getRenderEngineConfig(manifest as RenderManifest & RenderEngineManifestExtension),
    [manifest]
  );
  const timedWords = useMemo(() => buildTimedWords(manifest), [manifest]);
  const estimatedLayout = useMemo(
    () => buildWordLayout(timedWords, manifest.text.size),
    [manifest.text.size, timedWords]
  );
  const [layout, setLayout] = useState<WordLayout[]>(estimatedLayout);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const visualMeshes = useRef<Array<THREE.Mesh | null>>([]);
  const wordVelocities = useRef(new Map<string, THREE.Vector3>());
  const prevWordPositions = useRef(new Map<string, THREE.Vector3>());
  const velocityScratch = useRef(new Map<string, THREE.Vector3>());
  const visuals = useMemo(
    () => layout.map((word) => createTroikaTextVisual(word, manifest, renderConfig)),
    [layout, manifest, renderConfig]
  );
  const visualMaterials = useMemo(
    () => visuals.map((visual) => visual.material),
    [visuals]
  );

  useLayoutEffect(() => {
    if (timedWords.length === 0) {
      setLayout([]);
      return;
    }

    flushSync(() => {
      setLayout(estimatedLayout);
    });

    let cancelled = false;
    let released = false;
    const handle = delayRender("kinetic-text-word-measurement");
    const release = () => {
      if (released) {
        return;
      }
      released = true;
      continueRender(handle);
    };
    const fallbackTimer = window.setTimeout(() => {
      release();
    }, KINETIC_TEXT_MEASUREMENT_TIMEOUT_MS);

    const measure = async () => {
      try {
        const widths = await Promise.all(timedWords.map((word) =>
          measureTroikaWord({
            word: word.text,
            font: manifest.fontUrl,
            fontSize: manifest.text.size,
            sdfGlyphSize: manifest.text.sdfGlyphSize
          })
        ));
        if (cancelled || released) {
          return;
        }

        const nextLayout = buildWordLayout(timedWords, manifest.text.size, widths);
        // Flush measured layout before releasing Remotion's measurement handle.
        flushSync(() => {
          setLayout(nextLayout);
        });
        release();
      } catch (error) {
        release();
        throw error;
      }
    };

    void measure();

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      release();
    };
  }, [estimatedLayout, manifest.fontUrl, manifest.text.sdfGlyphSize, manifest.text.size, timedWords]);

  useLayoutEffect(() => {
    if (layout.length === 0) {
      return;
    }

    const timeline = gsap.timeline({
      paused: true,
      defaults: {overwrite: true}
    });

    layout.forEach((word, index) => {
      const mesh = visualMeshes.current[index];
      const material = visualMaterials[index];
      if (!mesh || !material) {
        return;
      }

      mesh.renderOrder = 10;
      mesh.layers.enable(TEXT_BLOOM_LAYER);
      mesh.position.set(word.x, 0, 0);
      mesh.rotation.set(0, 0, 0);
      mesh.scale.set(1, 1, 1);
      material.opacity = 1;

      if (word.animated) {
        // FIX: Use absolute startMs when available, not wordStagger
        const effectiveStart: number =
          typeof word.startMs === "number" && !isNaN(word.startMs)
            ? word.startMs / 1000
            : index * (manifest.wordStagger ?? 0.1);
        
        const duration = Math.max((word.endMs - word.startMs) / 1000, 1 / fps);
        const rotationSeed = (index + 1) * 1.61803398875;

        // Get directorial metadata for motion enhancement
        const meta = manifest.directorialMetadata;
        const t = word.startMs / 1000;

        // Find current emotional beat
        let currentBeat: EmotionalBeat | null = null;
        if (meta?.emotionalArc) {
          const tMs = t * 1000;
          currentBeat = meta.emotionalArc.find(
            (beat: EmotionalBeat) => tMs >= beat.timestamp[0] && tMs < beat.timestamp[1]
          ) ?? null;
        }

        // Select ease from temporal intensity
        const easeConfig = meta?.temporalIntensity
          ? selectEaseForTimestamp(t, meta.temporalIntensity, "back.out(1.7)")
          : {ease: "back.out(1.7)", durationMultiplier: 1, perturbation: 0};

        // Get semantic tag for this word (if available in transcriptWords)
        const transcriptWord = manifest.transcriptWords[index];
        const semanticTag = transcriptWord?.semanticTag ?? currentBeat?.motionVocabulary?.[0] ?? "";
        const pattern = semanticTag ? findPatternForSemanticTag(semanticTag) : null;

        // Fully destructure pattern GSAP config — the ontology drives the animation
        const patternFrom = pattern?.gsapConfig?.from ?? {opacity: 0, z: manifest.text.depthTravel};
        const patternTo = pattern?.gsapConfig?.to ?? {opacity: 1, z: 0};
        const patternDuration = ((pattern?.gsapConfig?.duration as number | undefined) ?? 0.6) * easeConfig.durationMultiplier;

        // Apply imperfection if directorial metadata is present
        const imperfected = meta?.imperfectionProfile && currentBeat
          ? applyImperfection(
              meta.imperfectionProfile,
              currentBeat.emotion,
              {duration: patternDuration, x: word.x, y: 0, rotation: 0, scale: 1}
            )
          : {duration: patternDuration, x: word.x, y: 0, rotation: 0, scale: 1};

        // Final GSAP config — use legacy behavior if no directorial metadata
        if (meta) {
          // Directorial metadata path: pattern drives animation, imperfection perturbs base position
          const fromTracks = splitMotionTweenVars({
            ...patternFrom,
            x: imperfected.x,
            y: imperfected.y
          });

          const toTracks = splitMotionTweenVars({
            ...patternTo,
            duration: Math.max(0.05, imperfected.duration),
            ease: easeConfig.ease
          });

          // Apply to mesh — fromTo ensures all pattern properties are consumed
          timeline.fromTo(mesh.position, fromTracks.position, {
            ...toTracks.position,
            ...toTracks.common
          }, effectiveStart);

          // Rotation and scale as supplementary animations (not in pattern)
          if (hasTrackVars(fromTracks.rotation) || hasTrackVars(toTracks.rotation)) {
            timeline.fromTo(mesh.rotation, fromTracks.rotation, {
              ...toTracks.rotation,
              ...toTracks.common
            }, effectiveStart);
          } else {
            timeline.from(mesh.rotation, {
              x: Math.sin(rotationSeed) * Math.PI,
              y: Math.cos(rotationSeed) * Math.PI,
              ...toTracks.common
            }, effectiveStart);
          }
          if (hasTrackVars(fromTracks.scale) || hasTrackVars(toTracks.scale)) {
            timeline.fromTo(mesh.scale, fromTracks.scale, {
              ...toTracks.scale,
              ...toTracks.common
            }, effectiveStart);
          } else {
            timeline.from(mesh.scale, {
              x: 0,
              y: 0,
              z: 0,
              ...toTracks.common
            }, effectiveStart);
          }

          // Material opacity fade — short duration relative to main animation
          if (hasTrackVars(fromTracks.material) || hasTrackVars(toTracks.material)) {
            timeline.fromTo(material, fromTracks.material, {
              ...toTracks.material,
              duration: Math.max((imperfected.duration as number) * 0.3, 1 / fps),
              ease: "power2.out"
            }, effectiveStart);
          }
        } else {
          // Legacy path (no directorial metadata)
          timeline.from(mesh.position, {
            z: manifest.text.depthTravel,
            duration,
            ease: "back.out(1.7)"
          }, effectiveStart);
          timeline.from(mesh.rotation, {
            x: Math.sin(rotationSeed) * Math.PI,
            y: Math.cos(rotationSeed) * Math.PI,
            duration,
            ease: "back.out(1.7)"
          }, effectiveStart);
          timeline.from(mesh.scale, {
            x: 0,
            y: 0,
            z: 0,
            duration,
            ease: "back.out(1.7)"
          }, effectiveStart);
          timeline.from(material, {
            opacity: 0,
            duration: Math.max(duration * 0.3, 1 / fps),
            ease: "power2.out"
          }, effectiveStart);
        }
      }
    });

    timeline.seek(frame / Math.max(fps, 1), false);
    timelineRef.current = timeline;

    return () => {
      timeline.kill();
      if (timelineRef.current === timeline) {
        timelineRef.current = null;
      }
    };
  }, [
    fps,
    frame,
    layout,
    manifest.directorialMetadata,
    manifest.fps,
    manifest.transcriptWords,
    manifest.text.depthTravel,
    manifest.wordStagger,
    manifest.text.size,
    visualMaterials
  ]);

  useEffect(() => {
    layout.forEach((_word, index) => {
      const key = `word-${index}`;
      if (!prevWordPositions.current.has(key)) {
        prevWordPositions.current.set(key, new THREE.Vector3());
      }
      if (!velocityScratch.current.has(key)) {
        const velocity = new THREE.Vector3();
        velocityScratch.current.set(key, velocity);
        wordVelocities.current.set(key, velocity);
      }
    });
  }, [layout]);

  useFrame(() => {
    const timeline = timelineRef.current;
    const currentTime = frame / Math.max(fps, 1);
    if (timeline) {
      if (currentTime > timeline.duration()) {
        timeline.progress(1, false);
      } else {
        timeline.seek(currentTime, false);
      }
    }

    visualMaterials.forEach((material) => {
      updateDeformationTime(material, currentTime);
    });

    layout.forEach((_word, index) => {
      const mesh = visualMeshes.current[index];
      const key = `word-${index}`;
      const prev = prevWordPositions.current.get(key);
      const vel = velocityScratch.current.get(key);
      if (mesh && prev && vel) {
        vel.subVectors(mesh.position, prev).multiplyScalar(Math.max(fps, 1));
        prev.copy(mesh.position);
      }
    });

    useCameraRigStore.setState({wordVelocities: wordVelocities.current});
  });

  useEffect(() => {
    return () => {
      visuals.forEach((visual) => visual.dispose());
    };
  }, [visuals]);

  if (layout.length === 0) {
    return null;
  }

  return (
    <group position={[0, 0, manifest.text.depthZ]}>
      {visuals.map((visual, index) => {
        const word = layout[index];
        if (!word) {
          return null;
        }

        return (
          <primitive
            key={`${word.text}-${index}`}
            object={visual.mesh}
            ref={(mesh: THREE.Mesh | null) => {
              visualMeshes.current[index] = mesh;
              mesh?.layers.enable(TEXT_BLOOM_LAYER);
            }}
            position={[word.x, 0, 0]}
            renderOrder={10}
          />
        );
      })}
    </group>
  );
};
