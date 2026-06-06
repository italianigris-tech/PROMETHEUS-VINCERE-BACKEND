import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import type {DeformationConfig, EmotionalBeat, RenderManifest} from "@prometheus/shared-types";
import {useFrame} from "@react-three/fiber";
import gsap from "gsap";
import {continueRender, delayRender, useCurrentFrame, useVideoConfig} from "remotion";
import * as THREE from "three";
import {Text as TroikaText} from "troika-three-text";

import {useCameraRigStore} from "./CameraRig.js";
import {TEXT_BLOOM_LAYER} from "./post-processing.js";
import {selectEaseForTimestamp} from "../lib/easing-modulator.js";
import {applyImperfection} from "../lib/imperfection-engine.js";
import {findPatternForSemanticTag} from "../lib/motion-ontology.js";
import {applyColorAnnotations, hasColorAnnotations} from "../lib/text-colorizer.js";
import {injectVertexDeformation, updateDeformationTime} from "../lib/vertex-deformation.js";

type WordLayout = {
  text: string;
  x: number;
  width: number;
  startMs: number;
  endMs: number;
  animated: boolean;
};

type TroikaDepthText = TroikaText & {
  extrudeDepth?: number;
  bevelEnabled?: boolean;
  bevelSize?: number;
  bevelThickness?: number;
  envMapIntensity?: number;
  colorRanges?: Record<number, THREE.Color | null>;
};

export type KineticTextProps = {
  manifest: RenderManifest;
};

const estimateWordWidth = (word: string, fontSize: number): number => {
  return Math.max(fontSize * 0.48, word.length * fontSize * 0.54);
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
  const words = manifest.transcript.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  if (manifest.transcriptWords.length === 0) {
    return [{
      text: manifest.transcript,
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

  return words.slice(0, count).map((word, index) => {
    const timing = manifest.transcriptWords[index];
    const fallbackStartMs = index * (manifest.durationInFrames / manifest.fps * 1000) / count;
    const fallbackEndMs = (index + 1) * (manifest.durationInFrames / manifest.fps * 1000) / count;
    return {
      text: word,
      startMs: timing?.startMs ?? fallbackStartMs,
      endMs: timing?.endMs ?? fallbackEndMs,
      animated: true
    };
  });
};

const createGradientTexture = (colors: string[]): THREE.CanvasTexture | null => {
  if (colors.length <= 1) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  colors.forEach((color, index) => {
    gradient.addColorStop(index / Math.max(colors.length - 1, 1), color);
  });
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/**
 * Phase 7: Creates a word material with optional vertex deformation injected.
 * If deformationConfig is provided and type is not "none", the material's
 * onBeforeCompile will inject the deformation shader.
 */
const createWordMaterial = (
  manifest: RenderManifest,
  deformationConfig?: DeformationConfig
): THREE.MeshBasicMaterial => {
  const colors = manifest.gradientColors.length > 0 ? manifest.gradientColors : ["#ffffff"];
  const texture = createGradientTexture(colors);
  const material = new THREE.MeshBasicMaterial({
    color: texture ? "#ffffff" : colors[0],
    map: texture ?? undefined,
    transparent: true,
    opacity: 1,
    depthWrite: true,
    toneMapped: false
  });

  // Phase 7: Inject vertex deformation if configured
  if (deformationConfig && deformationConfig.type !== "none") {
    injectVertexDeformation(material, deformationConfig);
  } else {
    // Keep a no-op onBeforeCompile for future edge highlighting
    material.onBeforeCompile = () => {
      // TODO Phase 8: add stable MeshBasicMaterial edge highlighting after bevel/depth geometry is formalized.
    };
  }

  if (manifest.envMapIntensity > 0) {
    // TODO Phase 8: pre-bake CubeCamera env map to texture.
  }

  return material;
};

export const KineticText: React.FC<KineticTextProps> = ({manifest}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const timedWords = useMemo(() => buildTimedWords(manifest), [manifest]);
  const [layout, setLayout] = useState<WordLayout[] | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const wordVelocities = useRef(new Map<string, THREE.Vector3>());
  const prevWordPositions = useRef(new Map<string, THREE.Vector3>());
  // Phase 7: Determine deformation configs per word based on patterns
  const deformationConfigs = useMemo(() => {
    return timedWords.map((word, index) => {
      const transcriptWord = manifest.transcriptWords[index];
      const semanticTag = transcriptWord?.semanticTag ?? "";
      const pattern = semanticTag ? findPatternForSemanticTag(semanticTag) : null;
      return pattern?.deformation ?? { type: "none" as const, intensity: 0, frequency: 1, speed: 1, seed: 0 };
    });
  }, [manifest.transcriptWords, timedWords]);

  const meshes = useMemo(() => timedWords.map(() => {
    const mesh = new TroikaText() as TroikaDepthText;
    mesh.renderOrder = 10;
    mesh.layers.enable(TEXT_BLOOM_LAYER);
    return mesh;
  }), [timedWords]);

  const materials = useMemo(
    () => timedWords.map((_word, index) => createWordMaterial(manifest, deformationConfigs[index])),
    [manifest, timedWords, deformationConfigs]
  );

  useLayoutEffect(() => {
    if (timedWords.length === 0) {
      setLayout([]);
      return;
    }

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
        if (cancelled) {
          release();
          return;
        }

        const spacing = manifest.text.size * 0.28;
        const totalWidth = widths.reduce((sum, width) => sum + width, 0) + spacing * Math.max(widths.length - 1, 0);
        let cursor = -totalWidth / 2;
        const nextLayout = timedWords.map((word, index) => {
          const width = widths[index] ?? estimateWordWidth(word.text, manifest.text.size);
          const x = cursor + width / 2;
          cursor += width + spacing;
          return {
            ...word,
            width,
            x
          };
        });
        setLayout(nextLayout);
        release();
      } catch (error) {
        release();
        throw error;
      }
    };

    void measure();

    return () => {
      cancelled = true;
      release();
    };
  }, [manifest.fontUrl, manifest.text.sdfGlyphSize, manifest.text.size, timedWords]);

  useLayoutEffect(() => {
    if (!layout || layout.length === 0) {
      return;
    }

    let settled = false;
    const handle = delayRender("kinetic-text-word-sync");
    const timeline = gsap.timeline({
      paused: true,
      defaults: {overwrite: true}
    });

    layout.forEach((word, index) => {
      const mesh = meshes[index];
      const material = materials[index];
      if (!mesh || !material) {
        return;
      }

      // Phase 7: Apply color annotations if present
      const rawText = word.text;
      if (hasColorAnnotations(rawText)) {
        const plainText = applyColorAnnotations(mesh, rawText);
        mesh.text = plainText;
      } else {
        mesh.text = rawText;
      }

      mesh.font = manifest.fontUrl;
      mesh.fontSize = manifest.text.size;
      mesh.anchorX = "center";
      mesh.anchorY = "middle";
      mesh.glyphGeometryDetail = 8;
      mesh.letterSpacing = 0.01;
      mesh.maxWidth = Number.POSITIVE_INFINITY;
      mesh.overflowWrap = "normal";
      mesh.whiteSpace = "nowrap";
      mesh.sdfGlyphSize = manifest.text.sdfGlyphSize;
      mesh.material = material;
      mesh.position.set(word.x, 0, 0);
      mesh.rotation.set(0, 0, 0);
      mesh.scale.set(1, 1, 1);
      mesh.extrudeDepth = manifest.extrudeDepth;
      mesh.bevelEnabled = manifest.bevelEnabled;
      mesh.bevelSize = manifest.bevelSize;
      mesh.bevelThickness = manifest.bevelThickness;
      mesh.envMapIntensity = manifest.envMapIntensity;
      // TODO Phase 8: modulate extrudeDepth by audio transient amplitude.

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
        const patternStagger = (pattern?.gsapConfig?.stagger as number | undefined) ?? 0.03;

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
          const finalFrom: Record<string, unknown> = {
            ...patternFrom,
            x: imperfected.x,
            y: imperfected.y,
          };

          const finalTo: Record<string, unknown> = {
            ...patternTo,
            duration: Math.max(0.05, imperfected.duration),
            ease: easeConfig.ease,
          };

          // Apply to mesh — fromTo ensures all pattern properties are consumed
          timeline.fromTo(mesh.position, finalFrom, finalTo, effectiveStart);

          // Rotation and scale as supplementary animations (not in pattern)
          timeline.from(mesh.rotation, {
            x: Math.sin(rotationSeed) * Math.PI,
            y: Math.cos(rotationSeed) * Math.PI,
            duration: Math.max(0.05, imperfected.duration),
            ease: easeConfig.ease
          }, effectiveStart);
          timeline.from(mesh.scale, {
            x: 0,
            y: 0,
            z: 0,
            duration: Math.max(0.05, imperfected.duration),
            ease: easeConfig.ease
          }, effectiveStart);

          // Material opacity fade — short duration relative to main animation
          const opacityDuration = patternFrom && typeof patternFrom === "object" && "opacity" in patternFrom
            ? Math.max((imperfected.duration as number) * 0.3, 1 / fps)
            : Math.max((imperfected.duration as number) * 0.3, 1 / fps);
          timeline.from(material, {
            opacity: 0,
            duration: opacityDuration,
            ease: "power2.out"
          }, effectiveStart);
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

    let pending = layout.length;
    const release = () => {
      if (settled) {
        return;
      }
      settled = true;
      continueRender(handle);
    };

    layout.forEach((_word, index) => {
      const mesh = meshes[index];
      if (!mesh) {
        pending -= 1;
        if (pending <= 0) {
          release();
        }
        return;
      }

      mesh.sync(() => {
        pending -= 1;
        if (pending <= 0) {
          timeline.seek(frame / fps, false);
          timelineRef.current = timeline;
          release();
        }
      });
    });

    if (timeline.duration() === 0) {
      timeline.seek(0, false);
      timelineRef.current = timeline;
    }

    return () => {
      release();
      timeline.kill();
      if (timelineRef.current === timeline) {
        timelineRef.current = null;
      }
    };
  }, [
    fps,
    frame,
    layout,
    manifest.bevelEnabled,
    manifest.bevelSize,
    manifest.bevelThickness,
    manifest.envMapIntensity,
    manifest.extrudeDepth,
    manifest.fontUrl,
    manifest.text.depthTravel,
    manifest.text.sdfGlyphSize,
    manifest.text.size,
    manifest.wordStagger,
    materials,
    meshes
  ]);

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

    // Phase 7: Update deformation time uniforms for all materials
    const elapsedTime = frame / fps;
    materials.forEach((material) => {
      updateDeformationTime(material, elapsedTime);
    });

    meshes.forEach((mesh, index) => {
      const key = `word-${index}`;
      const prev = prevWordPositions.current.get(key);
      if (prev) {
        const vel = new THREE.Vector3()
          .subVectors(mesh.position, prev)
          .multiplyScalar(Math.max(fps, 1));
        wordVelocities.current.set(key, vel);
      }
      prevWordPositions.current.set(key, mesh.position.clone());
    });

    useCameraRigStore.setState({wordVelocities: new Map(wordVelocities.current)});
  });

  useEffect(() => {
    return () => {
      meshes.forEach((mesh) => mesh.dispose());
    };
  }, [meshes]);

  useEffect(() => {
    return () => {
      materials.forEach((material) => {
        material.map?.dispose();
        material.dispose();
      });
    };
  }, [materials]);

  if (!layout || layout.length === 0) {
    return null;
  }

  return (
    <group position={[0, 0, manifest.text.depthZ]}>
      {meshes.map((mesh, index) => (
        <primitive key={`${layout[index]?.text ?? "word"}-${index}`} object={mesh} />
      ))}
    </group>
  );
};
