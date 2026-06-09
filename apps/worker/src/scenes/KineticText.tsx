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
  parseColorAnnotations,
  type ColorRange
} from "../engine/text-colorizer.js";

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

type TextChunk = {
  text: string;
  color: string | null;
};

export const chunkTextByColorRanges = (
  text: string,
  colorRanges: readonly ColorRange[],
  fallbackColor: string | null = null
): TextChunk[] => {
  if (text.length === 0) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let current = "";
  let currentColor: string | null = null;

  Array.from(text).forEach((character, index) => {
    const range = colorRanges.find((candidate) => index >= candidate.start && index < candidate.end);
    const color = range?.color ?? fallbackColor;
    if (current.length > 0 && color !== currentColor) {
      chunks.push({text: current, color: currentColor});
      current = "";
    }
    current += character;
    currentColor = color;
  });

  if (current.length > 0) {
    chunks.push({text: current, color: currentColor});
  }

  return chunks;
};

const createCanvasTextMaterial = (
  word: WordLayout,
  manifest: RenderManifest
): THREE.MeshBasicMaterial => {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.MeshBasicMaterial({
      color: manifest.text.color,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    });
  }

  const fontPx = 260;
  const fallbackColor = manifest.text.color || manifest.gradientColors[0] || "#ffffff";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `800 ${fontPx}px Georgia, "Times New Roman", serif`;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(123, 232, 255, 0.35)";
  ctx.shadowBlur = 20;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  ctx.lineWidth = 12;

  const chunks = chunkTextByColorRanges(word.text, word.colorRanges);
  if (chunks.length === 0 || chunks.every((chunk) => chunk.color === null)) {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    const colors = manifest.gradientColors.length > 0 ? manifest.gradientColors : [fallbackColor];
    colors.forEach((color, index) => {
      gradient.addColorStop(index / Math.max(colors.length - 1, 1), color);
    });
    ctx.textAlign = "center";
    ctx.strokeText(word.text, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = gradient;
    ctx.fillText(word.text, canvas.width / 2, canvas.height / 2);
  } else {
    ctx.textAlign = "left";
    const measuredChunks = chunks.map((chunk) => ({
      ...chunk,
      width: ctx.measureText(chunk.text).width
    }));
    const totalWidth = measuredChunks.reduce((sum, chunk) => sum + chunk.width, 0);
    let x = (canvas.width - totalWidth) / 2;
    for (const chunk of measuredChunks) {
      ctx.strokeText(chunk.text, x, canvas.height / 2);
      ctx.fillStyle = chunk.color ?? fallbackColor;
      ctx.fillText(chunk.text, x, canvas.height / 2);
      x += chunk.width;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 1,
    alphaTest: 0.01,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false
  });
};

export const KineticText: React.FC<KineticTextProps> = ({manifest}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
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
  const visualMaterials = useMemo(
    () => layout.map((word) => createCanvasTextMaterial(word, manifest)),
    [layout, manifest]
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
        const t = frame / (manifest.fps ?? 30);

        // Find current emotional beat
        let currentBeat: EmotionalBeat | null = null;
        if (meta?.emotionalArc) {
          const tMs = t * 1000;
          currentBeat = meta.emotionalArc.find(
            (beat) => tMs >= beat.timestamp[0] && tMs < beat.timestamp[1]
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

    if (timeline.duration() === 0) {
      timeline.seek(0, false);
      timelineRef.current = timeline;
    }

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
    if (timeline) {
      const currentTime = frame / fps;
      if (currentTime > timeline.duration()) {
        timeline.progress(1, false);
      } else {
        timeline.seek(currentTime, false);
      }
    }

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
      visualMaterials.forEach((material) => {
        material.map?.dispose();
        material.dispose();
      });
    };
  }, [visualMaterials]);

  if (layout.length === 0) {
    return null;
  }

  return (
    <group position={[0, 0, manifest.text.depthZ]}>
      {layout.map((word, index) => (
        <mesh
          key={`${word.text}-${index}`}
          ref={(mesh) => {
            visualMeshes.current[index] = mesh;
            mesh?.layers.enable(TEXT_BLOOM_LAYER);
          }}
          material={visualMaterials[index]}
          position={[word.x, 0, 0]}
          renderOrder={10}
        >
          <planeGeometry args={[Math.max(word.width, manifest.text.size * 0.6), manifest.text.size * 1.35]} />
        </mesh>
      ))}
    </group>
  );
};
