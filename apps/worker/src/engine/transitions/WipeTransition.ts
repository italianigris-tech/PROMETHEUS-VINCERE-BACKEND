import gsap from "gsap";
import * as THREE from "three";
import {ShaderPass} from "three/examples/jsm/postprocessing/ShaderPass.js";

export type WipeType = "line" | "curve" | "circle" | "custom";
export type WipeDirection = "left" | "right" | "up" | "down" | "center-out" | "center-in";

export type ComposerLike = {
  passes: unknown[];
  addPass(pass: unknown): void;
};

export type WipeTransitionConfig = {
  type: WipeType;
  direction: WipeDirection;
  duration: number;
  ease?: string;
  edgeSoftness?: number;
  edgeColor?: THREE.Color;
  edgeGlowIntensity?: number;
  customPath?: string;
  sceneA: THREE.Texture;
  sceneB: THREE.Texture;
  autoAdd?: boolean;
};

type WipeUniforms = {
  tDiffuse: {value: THREE.Texture | null};
  tSceneB: {value: THREE.Texture | null};
  uProgress: {value: number};
  uEdgeSoftness: {value: number};
  uEdgeColor: {value: THREE.Vector3};
  uEdgeGlowIntensity: {value: number};
  uWipeType: {value: number};
  uDirection: {value: number};
  uAspect: {value: number};
};

export type WipeShaderPass = ShaderPass & {
  uniforms: WipeUniforms;
};

export type WipeTransitionInstance = {
  pass: WipeShaderPass;
  progress: number;
  setProgress(progress: number): void;
  animateTo(progress: number, duration?: number, ease?: string): Promise<void>;
  dispose(): void;
};

export const WIPE_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const WIPE_FRAGMENT_SHADER = `
uniform sampler2D tDiffuse;
uniform sampler2D tSceneB;
uniform float uProgress;
uniform float uEdgeSoftness;
uniform vec3 uEdgeColor;
uniform float uEdgeGlowIntensity;
uniform int uWipeType;
uniform int uDirection;
uniform float uAspect;

varying vec2 vUv;

float lineWipe(vec2 uv, float progress, int direction) {
  float edge = uEdgeSoftness * 0.1;
  if (direction == 0) {
    return 1.0 - smoothstep(progress - edge, progress + edge, uv.x);
  }
  if (direction == 1) {
    return 1.0 - smoothstep(progress - edge, progress + edge, 1.0 - uv.x);
  }
  if (direction == 2) {
    return 1.0 - smoothstep(progress - edge, progress + edge, 1.0 - uv.y);
  }
  if (direction == 3) {
    return 1.0 - smoothstep(progress - edge, progress + edge, uv.y);
  }
  return 0.0;
}

float curveWipe(vec2 uv, float progress) {
  float wave = sin(uv.y * 3.14159265) * 0.1;
  float threshold = progress + wave * (0.5 - abs(progress - 0.5) * 2.0);
  float edge = uEdgeSoftness * 0.1;
  return 1.0 - smoothstep(threshold - edge, threshold + edge, uv.x);
}

float circleWipe(vec2 uv, float progress, int direction) {
  vec2 aspectUv = vec2((uv.x - 0.5) * uAspect + 0.5, uv.y);
  float dist = distance(aspectUv, vec2(0.5));
  float maxDist = 0.70710678 * max(uAspect, 1.0);
  float threshold = progress * maxDist;
  float edge = uEdgeSoftness * 0.1;
  if (direction == 5) {
    return smoothstep(threshold - edge, threshold + edge, dist);
  }
  return 1.0 - smoothstep(threshold - edge, threshold + edge, dist);
}

float customPathWipe(vec2 uv, float progress) {
  return curveWipe(uv, progress);
}

float getWipeMask(vec2 uv, float progress, int type, int direction) {
  if (type == 0) return lineWipe(uv, progress, direction);
  if (type == 1) return curveWipe(uv, progress);
  if (type == 2) return circleWipe(uv, progress, direction);
  return customPathWipe(uv, progress);
}

void main() {
  float mask = getWipeMask(vUv, uProgress, uWipeType, uDirection);
  vec4 colorA = texture2D(tDiffuse, vUv);
  vec4 colorB = texture2D(tSceneB, vUv);
  float edgeDistance = abs(mask - 0.5) * 2.0;
  float edgeGlow = max(0.0, 1.0 - edgeDistance) * uEdgeGlowIntensity;
  vec4 finalColor = mix(colorA, colorB, mask);
  finalColor.rgb += uEdgeColor * edgeGlow;
  gl_FragColor = finalColor;
}`;

const clamp01 = (value: number): number => THREE.MathUtils.clamp(value, 0, 1);

const wipeTypeToInt = (type: WipeType): number => ({
  line: 0,
  curve: 1,
  circle: 2,
  custom: 3
})[type];

const directionToInt = (direction: WipeDirection): number => ({
  left: 0,
  right: 1,
  up: 2,
  down: 3,
  "center-out": 4,
  "center-in": 5
})[direction];

const removeComposerPass = (composer: ComposerLike, pass: unknown): void => {
  const index = composer.passes.indexOf(pass);
  if (index >= 0) {
    composer.passes.splice(index, 1);
  }
};

const addComposerPassOnce = (composer: ComposerLike, pass: unknown): void => {
  if (!composer.passes.includes(pass)) {
    composer.addPass(pass);
  }
};

export class WipeTransitionEngine {
  constructor(private readonly composer: ComposerLike) {}

  create(config: WipeTransitionConfig): WipeTransitionInstance {
    const edgeColor = config.edgeColor ?? new THREE.Color("#ffffff");
    const shader = {
      uniforms: {
        tDiffuse: {value: config.sceneA},
        tSceneB: {value: config.sceneB},
        uProgress: {value: 0},
        uEdgeSoftness: {value: config.edgeSoftness ?? 0.3},
        uEdgeColor: {value: new THREE.Vector3(edgeColor.r, edgeColor.g, edgeColor.b)},
        uEdgeGlowIntensity: {value: config.edgeGlowIntensity ?? 0},
        uWipeType: {value: wipeTypeToInt(config.type)},
        uDirection: {value: directionToInt(config.direction)},
        uAspect: {value: 1}
      },
      vertexShader: WIPE_VERTEX_SHADER,
      fragmentShader: WIPE_FRAGMENT_SHADER
    };
    const pass = new ShaderPass(shader) as WipeShaderPass;
    pass.renderToScreen = false;
    pass.uniforms.tDiffuse.value = config.sceneA;
    pass.uniforms.tSceneB.value = config.sceneB;

    const instance: WipeTransitionInstance = {
      pass,
      progress: 0,
      setProgress: (progress: number) => {
        instance.progress = clamp01(progress);
        pass.uniforms.uProgress.value = instance.progress;
      },
      animateTo: async (targetProgress: number, duration = config.duration, ease = config.ease) =>
        new Promise<void>((resolve) => {
          const startProgress = instance.progress;
          const target = clamp01(targetProgress);
          const startTime = performance.now();
          const easeFn = ease ? gsap.parseEase(ease) : (value: number): number => value;
          const safeDuration = Math.max(duration, 0.0001);
          const tick = (): void => {
            const elapsed = (performance.now() - startTime) / 1000;
            const t = clamp01(elapsed / safeDuration);
            const easedT = easeFn(t);
            instance.setProgress(startProgress + (target - startProgress) * easedT);
            if (t < 1) {
              requestAnimationFrame(tick);
              return;
            }
            instance.setProgress(target);
            resolve();
          };
          requestAnimationFrame(tick);
        }),
      dispose: () => {
        removeComposerPass(this.composer, pass);
        pass.dispose();
      }
    };

    if (config.autoAdd !== false) {
      addComposerPassOnce(this.composer, pass);
    }

    return instance;
  }
}

export default WipeTransitionEngine;
