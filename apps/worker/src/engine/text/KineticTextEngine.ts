import gsap from "gsap";
import * as THREE from "three";
import {Text as TroikaText} from "troika-three-text";

export type WordBoundary = {
  text: string;
  startIndex: number;
  endIndex: number;
};

export type WordAnimationState = {
  opacity: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
};

export type WordEffect =
  | "none"
  | "bounce"
  | "glitch"
  | "blur-in"
  | "glow-pulse"
  | "shake"
  | "typewriter";

export type WordConfig = {
  font?: string;
  color?: string;
  size?: number;
  delay?: number;
  duration?: number;
  ease?: string;
  from?: Partial<WordAnimationState>;
  to?: Partial<WordAnimationState>;
  effect?: WordEffect;
};

export type KineticTextStyleRangeValue = {
  color?: string | number | null;
  font?: string | null;
  size?: number | null;
} | string | number | THREE.Color | null;

export type KineticTextStyleRanges = Record<number, KineticTextStyleRangeValue>;

export type KineticTextConfig = {
  text: string;
  fontSize: number;
  font: string;
  color: string;
  position: THREE.Vector3;
  anchorX: string | number;
  anchorY: string | number;
  maxWidth?: number;
  stagger: number;
  duration: number;
  ease: string;
  words?: Record<number, WordConfig>;
  emphasisPattern?: RegExp;
  emphasisConfig?: WordConfig;
  styleRanges?: KineticTextStyleRanges;
  material?: THREE.MeshBasicMaterial;
};

export type KineticTextInstance = {
  mesh: TroikaText;
  timeline: gsap.core.Timeline;
  wordBoundaries: WordBoundary[];
  wordGlyphIndices: Map<number, number[]>;
  wordStates: Map<number, WordAnimationState>;
  wordConfigs: Record<number, WordConfig>;
  play(): void;
  pause(): void;
  seek(time: number): void;
  reverse(): void;
  dispose(): void;
};

export type ParsedKineticText = {
  plainText: string;
  styleRanges: KineticTextStyleRanges;
  wordConfigs: Record<number, WordConfig>;
};

type ShaderLike = {
  uniforms: Record<string, THREE.IUniform>;
  vertexShader: string;
  fragmentShader: string;
};

type TroikaTextRenderInfo = {
  caretPositions?: Float32Array;
  glyphBounds?: Float32Array;
  glyphAtlasIndices?: ArrayLike<number>;
};

type TroikaTextWithRenderInfo = TroikaText & {
  textRenderInfo?: TroikaTextRenderInfo | null;
};

const DEFAULT_FROM_STATE: WordAnimationState = {
  opacity: 0,
  x: 0,
  y: 30,
  z: 0,
  scale: 0.8,
  rotation: 0
};

const DEFAULT_TO_STATE: WordAnimationState = {
  opacity: 1,
  x: 0,
  y: 0,
  z: 0,
  scale: 1,
  rotation: 0
};

const GLYPH_VERTEX_DEFS = `
uniform sampler2D uGlyphTransformTex;
uniform sampler2D uGlyphRotationTex;
uniform int uGlyphCount;
uniform float uTime;
uniform vec2 uTexSize;
varying float vGlyphOpacity;

vec4 prometheusGlyphTransform(int glyphIdx) {
  float texX = mod(float(glyphIdx), uTexSize.x);
  float texY = floor(float(glyphIdx) / uTexSize.x);
  return texture2D(uGlyphTransformTex, (vec2(texX, texY) + 0.5) / uTexSize);
}

float prometheusGlyphRotation(int glyphIdx) {
  float texX = mod(float(glyphIdx), uTexSize.x);
  float texY = floor(float(glyphIdx) / uTexSize.x);
  return texture2D(uGlyphRotationTex, (vec2(texX, texY) + 0.5) / uTexSize).r;
}
`;

const GLYPH_VERTEX_BODY = `
int prometheusGlyphIdx = gl_InstanceID;
vGlyphOpacity = 1.0;
if (prometheusGlyphIdx < uGlyphCount) {
  vec4 prometheusTransform = prometheusGlyphTransform(prometheusGlyphIdx);
  float prometheusRotation = prometheusGlyphRotation(prometheusGlyphIdx);
  float prometheusCos = cos(prometheusRotation);
  float prometheusSin = sin(prometheusRotation);
  transformed.xy *= prometheusTransform.b;
  transformed.xy = vec2(
    transformed.x * prometheusCos - transformed.y * prometheusSin,
    transformed.x * prometheusSin + transformed.y * prometheusCos
  );
  transformed.x += prometheusTransform.r;
  transformed.y += prometheusTransform.g;
  vGlyphOpacity = prometheusTransform.a;
}
`;

export const parseWords = (text: string): WordBoundary[] => {
  const words: WordBoundary[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    words.push({
      text: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }
  return words;
};

const rectsOverlap = (
  aMinX: number,
  aMinY: number,
  aMaxX: number,
  aMaxY: number,
  bMinX: number,
  bMinY: number,
  bMaxX: number,
  bMaxY: number
): boolean =>
  aMaxX >= bMinX &&
  bMaxX >= aMinX &&
  aMaxY >= bMinY &&
  bMaxY >= aMinY;

const fallbackGlyphIndicesForBoundary = (
  boundary: WordBoundary,
  maxGlyphs: number
): number[] => {
  const glyphIndices: number[] = [];
  for (
    let glyphIndex = boundary.startIndex;
    glyphIndex < boundary.endIndex && glyphIndex < maxGlyphs;
    glyphIndex += 1
  ) {
    glyphIndices.push(glyphIndex);
  }
  return glyphIndices;
};

export const mapWordsToGlyphIndices = (
  boundaries: readonly WordBoundary[],
  renderInfo: TroikaTextRenderInfo | null | undefined,
  maxGlyphs: number
): Map<number, number[]> => {
  const map = new Map<number, number[]>();
  const caretPositions = renderInfo?.caretPositions;
  const glyphBounds = renderInfo?.glyphBounds;
  const glyphCount = Math.min(
    maxGlyphs,
    Math.floor((glyphBounds?.length ?? 0) / 4),
    renderInfo?.glyphAtlasIndices?.length ?? Number.POSITIVE_INFINITY
  );

  boundaries.forEach((boundary, wordIndex) => {
    if (!caretPositions || !glyphBounds || glyphCount === 0) {
      map.set(wordIndex, fallbackGlyphIndicesForBoundary(boundary, maxGlyphs));
      return;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (let charIndex = boundary.startIndex; charIndex < boundary.endIndex; charIndex += 1) {
      const offset = charIndex * 4;
      const startX = caretPositions[offset];
      const endX = caretPositions[offset + 1];
      const bottomY = caretPositions[offset + 2];
      const topY = caretPositions[offset + 3];
      if (
        startX === undefined ||
        endX === undefined ||
        bottomY === undefined ||
        topY === undefined
      ) {
        continue;
      }
      minX = Math.min(minX, startX, endX);
      maxX = Math.max(maxX, startX, endX);
      minY = Math.min(minY, bottomY, topY);
      maxY = Math.max(maxY, bottomY, topY);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      map.set(wordIndex, fallbackGlyphIndicesForBoundary(boundary, maxGlyphs));
      return;
    }

    const glyphIndices: number[] = [];
    for (let glyphIndex = 0; glyphIndex < glyphCount; glyphIndex += 1) {
      const offset = glyphIndex * 4;
      const glyphMinX = glyphBounds[offset];
      const glyphMinY = glyphBounds[offset + 1];
      const glyphMaxX = glyphBounds[offset + 2];
      const glyphMaxY = glyphBounds[offset + 3];
      if (
        glyphMinX === undefined ||
        glyphMinY === undefined ||
        glyphMaxX === undefined ||
        glyphMaxY === undefined
      ) {
        continue;
      }

      if (rectsOverlap(minX, minY, maxX, maxY, glyphMinX, glyphMinY, glyphMaxX, glyphMaxY)) {
        glyphIndices.push(glyphIndex);
      }
    }

    map.set(
      wordIndex,
      glyphIndices.length > 0
        ? glyphIndices
        : fallbackGlyphIndicesForBoundary(boundary, maxGlyphs)
    );
  });

  return map;
};

const countWords = (text: string): number => {
  if (!text.trim()) {
    return 0;
  }
  return parseWords(text).length;
};

export const parseTaggedText = (
  taggedText: string,
  tagMap: Record<string, {color?: string; font?: string; size?: number; effect?: WordEffect}>
): ParsedKineticText => {
  const plainTextParts: string[] = [];
  const styleRanges: KineticTextStyleRanges = {};
  const wordConfigs: Record<number, WordConfig> = {};
  const tagPattern = /\{(\w+)\}([^{}]+)\{\/\1\}/g;
  let lastIndex = 0;
  let plainLength = 0;
  let wordIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(taggedText)) !== null) {
    const beforeTag = taggedText.slice(lastIndex, match.index);
    if (beforeTag) {
      plainTextParts.push(beforeTag);
      plainLength += beforeTag.length;
      wordIndex += countWords(beforeTag);
    }

    const tagName = match[1] ?? "";
    const taggedContent = match[2] ?? "";
    const tagConfig = tagMap[tagName];
    const startChar = plainLength;
    const endChar = startChar + taggedContent.length;

    if (tagConfig) {
      styleRanges[startChar] = {
        color: tagConfig.color ?? null,
        font: tagConfig.font ?? null,
        size: tagConfig.size ?? null
      };
      styleRanges[endChar] = null;
    }

    parseWords(taggedContent).forEach((_word, index) => {
      wordConfigs[wordIndex + index] = {
        color: tagConfig?.color,
        font: tagConfig?.font,
        size: tagConfig?.size,
        effect: tagConfig?.effect ?? "bounce"
      };
    });

    plainTextParts.push(taggedContent);
    plainLength += taggedContent.length;
    wordIndex += countWords(taggedContent);
    lastIndex = tagPattern.lastIndex;
  }

  const remaining = taggedText.slice(lastIndex);
  if (remaining) {
    plainTextParts.push(remaining);
  }

  return {
    plainText: plainTextParts.join(""),
    styleRanges,
    wordConfigs
  };
};

const mergeState = (
  base: WordAnimationState,
  override: Partial<WordAnimationState> | undefined
): WordAnimationState => ({
  opacity: override?.opacity ?? base.opacity,
  x: override?.x ?? base.x,
  y: override?.y ?? base.y,
  z: override?.z ?? base.z,
  scale: override?.scale ?? base.scale,
  rotation: override?.rotation ?? base.rotation
});

const resolvedWordConfigs = (
  boundaries: readonly WordBoundary[],
  config: KineticTextConfig
): Record<number, WordConfig> => {
  const configs: Record<number, WordConfig> = {...config.words};
  if (!config.emphasisPattern || !config.emphasisConfig) {
    return configs;
  }

  boundaries.forEach((word, index) => {
    if (config.emphasisPattern) {
      config.emphasisPattern.lastIndex = 0;
    }
    if (config.emphasisPattern?.test(word.text)) {
      configs[index] = {
        ...config.emphasisConfig,
        ...configs[index]
      };
    }
  });

  return configs;
};

const resolveStyleRangeColor = (
  value: KineticTextStyleRangeValue,
  fallbackColor: string | number
): THREE.Color | string | number => {
  if (value === null) {
    return fallbackColor;
  }

  if (value instanceof THREE.Color || typeof value === "string" || typeof value === "number") {
    return value;
  }

  return value.color ?? fallbackColor;
};

const toTroikaColorRanges = (
  styleRanges: KineticTextStyleRanges | undefined,
  fallbackColor: string | number
): Record<number, THREE.Color | string | number> | null => {
  if (!styleRanges || Object.keys(styleRanges).length === 0) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(styleRanges).map(([index, value]) => [
      index,
      resolveStyleRangeColor(value, fallbackColor)
    ])
  );
};

export class KineticTextEngine {
  public readonly transformData: Float32Array;
  public readonly rotationData: Float32Array;

  private readonly scene: THREE.Scene;
  private readonly shaders = new Set<ShaderLike>();
  private readonly glyphTransformTexture: THREE.DataTexture;
  private readonly glyphRotationTexture: THREE.DataTexture;
  private readonly textureSize: number;
  private readonly maxGlyphs: number;

  constructor(scene: THREE.Scene, maxGlyphs = 256) {
    this.scene = scene;
    this.maxGlyphs = maxGlyphs;
    this.textureSize = Math.ceil(Math.sqrt(maxGlyphs));
    this.transformData = new Float32Array(this.textureSize * this.textureSize * 4);
    this.rotationData = new Float32Array(this.textureSize * this.textureSize * 4);

    this.glyphTransformTexture = new THREE.DataTexture(
      this.transformData,
      this.textureSize,
      this.textureSize,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.glyphTransformTexture.needsUpdate = true;

    this.glyphRotationTexture = new THREE.DataTexture(
      this.rotationData,
      this.textureSize,
      this.textureSize,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.glyphRotationTexture.needsUpdate = true;
    this.updateAllGlyphs({
      opacity: 1,
      x: 0,
      y: 0,
      z: 0,
      scale: 1,
      rotation: 0
    });
  }

  create(config: KineticTextConfig): KineticTextInstance {
    const mesh = new TroikaText();
    mesh.text = config.text;
    mesh.fontSize = config.fontSize;
    mesh.font = config.font;
    mesh.color = config.color;
    mesh.position.copy(config.position);
    mesh.anchorX = config.anchorX;
    mesh.anchorY = config.anchorY;
    mesh.glyphGeometryDetail = 2;
    if (config.maxWidth !== undefined) {
      mesh.maxWidth = config.maxWidth;
    }
    mesh.colorRanges = toTroikaColorRanges(config.styleRanges, config.color);

    const material = config.material ?? new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 1,
      toneMapped: false
    });
    mesh.material = material;
    this.injectGlyphAnimation(material);

    const wordBoundaries = parseWords(config.text);
    const wordConfigs = resolvedWordConfigs(wordBoundaries, config);
    const wordGlyphIndices = mapWordsToGlyphIndices(wordBoundaries, null, this.maxGlyphs);
    const wordStates = new Map<number, WordAnimationState>();
    wordBoundaries.forEach((_word, index) => {
      wordStates.set(index, {...DEFAULT_FROM_STATE});
    });

    const instanceShell = {
      mesh,
      wordBoundaries,
      wordGlyphIndices,
      wordStates,
      wordConfigs
    };

    const timeline = this.buildTimeline(instanceShell, config);

    const instance: KineticTextInstance = {
      ...instanceShell,
      timeline,
      play: () => timeline.play(),
      pause: () => timeline.pause(),
      seek: (time: number) => {
        timeline.seek(time, false);
      },
      reverse: () => timeline.reverse(),
      dispose: () => {
        timeline.kill();
        mesh.dispose();
        this.scene.remove(mesh);
      }
    };

    if (typeof globalThis.self !== "undefined") {
      mesh.sync(() => {
        this.updateShaderGlyphCount(mesh, config.text.length);
        instance.wordGlyphIndices = mapWordsToGlyphIndices(
          wordBoundaries,
          (mesh as TroikaTextWithRenderInfo).textRenderInfo,
          this.maxGlyphs
        );
      });
    }

    this.scene.add(mesh);
    return instance;
  }

  update(time: number): void {
    for (const shader of this.shaders) {
      const timeUniform = shader.uniforms.uTime;
      if (timeUniform) {
        timeUniform.value = time;
      }
    }
  }

  dispose(): void {
    this.glyphTransformTexture.dispose();
    this.glyphRotationTexture.dispose();
    this.shaders.clear();
  }

  updateWordGlyphs(
    instance: Pick<KineticTextInstance, "wordBoundaries" | "wordStates">,
    wordIndex: number,
    state: WordAnimationState
  ): void {
    const boundary = instance.wordBoundaries[wordIndex];
    if (!boundary) {
      return;
    }

    const instanceWithGlyphs = instance as Partial<Pick<KineticTextInstance, "wordGlyphIndices">>;
    const glyphIndices = instanceWithGlyphs.wordGlyphIndices?.get(wordIndex) ??
      fallbackGlyphIndicesForBoundary(boundary, this.maxGlyphs);

    instance.wordStates.set(wordIndex, {...state});
    for (const glyphIndex of glyphIndices) {
      if (glyphIndex >= this.maxGlyphs) {
        continue;
      }
      this.writeGlyphState(glyphIndex, state);
    }
    this.glyphTransformTexture.needsUpdate = true;
    this.glyphRotationTexture.needsUpdate = true;
  }

  private updateShaderGlyphCount(mesh: TroikaText, glyphCount: number): void {
    const materialWithShader = mesh.material as THREE.MeshBasicMaterial;
    const shader = materialWithShader.userData.prometheusGlyphShader as ShaderLike | undefined;
    const glyphCountUniform = shader?.uniforms.uGlyphCount;
    if (glyphCountUniform) {
      glyphCountUniform.value = Math.min(glyphCount, this.maxGlyphs);
    }
  }

  private injectGlyphAnimation(material: THREE.MeshBasicMaterial): void {
    const previousCompile = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      previousCompile.call(material, shader, renderer);
      const writableShader = shader as ShaderLike;
      writableShader.uniforms.uGlyphTransformTex = {value: this.glyphTransformTexture};
      writableShader.uniforms.uGlyphRotationTex = {value: this.glyphRotationTexture};
      writableShader.uniforms.uGlyphCount = {value: 0};
      writableShader.uniforms.uTime = {value: 0};
      writableShader.uniforms.uTexSize = {value: new THREE.Vector2(this.textureSize, this.textureSize)};
      writableShader.vertexShader = writableShader.vertexShader
        .replace("#include <common>", `#include <common>\n${GLYPH_VERTEX_DEFS}`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>\n${GLYPH_VERTEX_BODY}`);
      writableShader.fragmentShader = writableShader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vGlyphOpacity;")
        .replace("#include <dithering_fragment>", "gl_FragColor.a *= vGlyphOpacity;\n#include <dithering_fragment>");
      material.userData.prometheusGlyphShader = writableShader;
      this.shaders.add(writableShader);
    };
    material.needsUpdate = true;
  }

  private buildTimeline(
    instance: Pick<KineticTextInstance, "mesh" | "wordBoundaries" | "wordStates" | "wordConfigs">,
    config: KineticTextConfig
  ): gsap.core.Timeline {
    const timeline = gsap.timeline({paused: true});
    instance.wordBoundaries.forEach((_boundary, wordIndex) => {
      const wordConfig = instance.wordConfigs[wordIndex] ?? {};
      const fromState = mergeState(DEFAULT_FROM_STATE, wordConfig.from);
      const toState = mergeState(DEFAULT_TO_STATE, wordConfig.to);
      const targetState = wordConfig.effect === "bounce"
        ? {...toState, scale: Math.max(toState.scale, 1.05)}
        : toState;

      this.updateWordGlyphs(instance, wordIndex, fromState);
      const animatedState = {...fromState};
      timeline.to(animatedState, {
        ...targetState,
        duration: wordConfig.duration ?? config.duration,
        delay: wordIndex * config.stagger + (wordConfig.delay ?? 0),
        ease: wordConfig.ease ?? config.ease,
        onUpdate: () => {
          this.updateWordGlyphs(instance, wordIndex, animatedState);
        }
      }, 0);
    });

    return timeline;
  }

  private writeGlyphState(glyphIndex: number, state: WordAnimationState): void {
    const offset = glyphIndex * 4;
    this.transformData[offset] = state.x;
    this.transformData[offset + 1] = state.y;
    this.transformData[offset + 2] = state.scale;
    this.transformData[offset + 3] = state.opacity;
    this.rotationData[offset] = state.rotation;
  }

  private updateAllGlyphs(state: WordAnimationState): void {
    for (let glyphIndex = 0; glyphIndex < this.maxGlyphs; glyphIndex += 1) {
      this.writeGlyphState(glyphIndex, state);
    }
  }
}

export default KineticTextEngine;
