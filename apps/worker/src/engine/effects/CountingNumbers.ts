import gsap from "gsap";
import * as THREE from "three";
import {ShaderPass} from "three/examples/jsm/postprocessing/ShaderPass.js";
import {Text as TroikaText} from "troika-three-text";

import type {ChromaticAberrationPassLike} from "./CameraShake.js";

export type {ChromaticAberrationPassLike} from "./CameraShake.js";

export type CountingNumbersConfig = {
  from: number;
  to: number;
  duration: number;
  font?: string;
  fontSize?: number;
  color?: string;
  position?: THREE.Vector3;
  anchorX?: string | number;
  anchorY?: string | number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  ease?: string;
  motionBlurStrength?: number;
  motionBlurSamples?: number;
  caSpike?: number;
  onLanding?: () => void;
};

export type CountingNumbersEngineOptions = {
  caPass?: ChromaticAberrationPassLike | null;
};

export type CountingNumbersMotionBlurUniforms = {
  tDiffuse: {value: THREE.Texture | null};
  uVelocity: {value: number};
  uStrength: {value: number};
  uSamples: {value: number};
};

export type CountingNumbersMotionBlurPass = ShaderPass & {
  uniforms: CountingNumbersMotionBlurUniforms;
};

export type CountingNumbersInstance = {
  mesh: TroikaText;
  timeline: gsap.core.Timeline;
  motionBlurPass: CountingNumbersMotionBlurPass;
  play(): void;
  pause(): void;
  seek(time: number): void;
  reverse(): void;
  dispose(): void;
};

const DEFAULT_FONT_SIZE = 0.38;
const DEFAULT_DECIMALS = 0;
const DEFAULT_MOTION_BLUR_STRENGTH = 0.35;
const DEFAULT_MOTION_BLUR_SAMPLES = 8;
const CA_SPIKE_PEAK = 0.9;
const CA_SPIKE_WINDOW = 0.1;

const clamp01 = (value: number): number => THREE.MathUtils.clamp(value, 0, 1);

const caUniform = (pass: ChromaticAberrationPassLike | null): {value: number} | null =>
  pass?.uniforms.amount ?? pass?.uniforms.uIntensity ?? pass?.uniforms.intensity ?? null;

const formatCount = (
  value: number,
  decimals: number,
  prefix = "",
  suffix = ""
): string => {
  const safeDecimals = Math.max(0, Math.floor(decimals));
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: safeDecimals,
    maximumFractionDigits: safeDecimals
  });
  return `${prefix}${formatter.format(value)}${suffix}`;
};

const buildMotionBlurShader = (): {
  uniforms: CountingNumbersMotionBlurUniforms;
  vertexShader: string;
  fragmentShader: string;
} => ({
  uniforms: {
    tDiffuse: {value: null},
    uVelocity: {value: 0},
    uStrength: {value: DEFAULT_MOTION_BLUR_STRENGTH},
    uSamples: {value: DEFAULT_MOTION_BLUR_SAMPLES}
  },
  vertexShader: `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
  fragmentShader: `
uniform sampler2D tDiffuse;
uniform float uVelocity;
uniform float uStrength;
uniform int uSamples;
varying vec2 vUv;

const int MAX_MOTION_BLUR_SAMPLES = 16;

void main() {
  int count = clamp(uSamples, 1, MAX_MOTION_BLUR_SAMPLES);
  float blurSpan = clamp(abs(uVelocity) * uStrength / 12000.0, 0.0, 0.35);
  if (blurSpan <= 0.0001) {
    gl_FragColor = texture2D(tDiffuse, vUv);
    return;
  }

  vec4 color = vec4(0.0);
  for (int i = 0; i < MAX_MOTION_BLUR_SAMPLES; i++) {
    if (i >= count) {
      break;
    }
    float denom = float(max(count - 1, 1));
    float centeredSample = float(i) / denom - 0.5;
    vec2 offsetUv = vUv + vec2(centeredSample * blurSpan, 0.0);
    color += texture2D(tDiffuse, offsetUv);
  }

  gl_FragColor = color / float(count);
}`
});

export const NUMBER_MOTION_BLUR_SHADER = buildMotionBlurShader();

const buildMotionBlurPass = (): CountingNumbersMotionBlurPass =>
  new ShaderPass(NUMBER_MOTION_BLUR_SHADER) as CountingNumbersMotionBlurPass;

const setCaUniform = (pass: ChromaticAberrationPassLike | null, value: number): void => {
  const uniform = caUniform(pass);
  if (uniform) {
    uniform.value = value;
  }
};

export class CountingNumbersEngine {
  private readonly scene: THREE.Scene;
  private readonly defaultCaPass: ChromaticAberrationPassLike | null;

  constructor(scene: THREE.Scene, options: CountingNumbersEngineOptions = {}) {
    this.scene = scene;
    this.defaultCaPass = options.caPass ?? null;
  }

  create(config: CountingNumbersConfig): CountingNumbersInstance {
    const caPass = this.defaultCaPass;
    const mesh = new TroikaText();
    mesh.text = formatCount(config.from, config.decimals ?? DEFAULT_DECIMALS, config.prefix, config.suffix);
    mesh.font = config.font ?? "/fonts/Inter-Bold.woff";
    mesh.fontSize = config.fontSize ?? DEFAULT_FONT_SIZE;
    mesh.color = config.color ?? "#ffffff";
    mesh.anchorX = config.anchorX ?? "center";
    mesh.anchorY = config.anchorY ?? "middle";
    mesh.position.copy(config.position ?? new THREE.Vector3());
    mesh.glyphGeometryDetail = 2;

    const material = new THREE.MeshBasicMaterial({
      color: config.color ?? "#ffffff",
      transparent: true,
      opacity: 1,
      toneMapped: false
    });
    mesh.material = material;
    if (typeof globalThis.self !== "undefined") {
      mesh.sync();
    }

    const motionBlurPass = buildMotionBlurPass();
    const state = {
      value: config.from,
      previousValue: config.from,
      previousTime: 0
    };
    let landingTriggered = false;
    const timelineState = {time: 0};
    const duration = Math.max(config.duration, 0.0001);
    const ease = config.ease ?? "power2.out";

    const renderFrame = (timeSeconds: number): void => {
      const clampedTime = THREE.MathUtils.clamp(timeSeconds, 0, duration);
      timelineState.time = clampedTime;
      const progress = clamp01(clampedTime / duration);
      const nextValue = THREE.MathUtils.lerp(config.from, config.to, progress);
      const deltaTime = Math.max(Math.abs(clampedTime - state.previousTime), 1e-6);
      const velocity = Math.abs(nextValue - state.previousValue) / deltaTime;

      state.value = nextValue;
      state.previousValue = nextValue;
      state.previousTime = clampedTime;

      mesh.text = formatCount(
        nextValue,
        config.decimals ?? DEFAULT_DECIMALS,
        config.prefix,
        config.suffix
      );

      motionBlurPass.uniforms.uVelocity.value = velocity;
      motionBlurPass.uniforms.uStrength.value = config.motionBlurStrength ?? DEFAULT_MOTION_BLUR_STRENGTH;
      motionBlurPass.uniforms.uSamples.value = Math.max(
        1,
        Math.min(16, Math.floor(config.motionBlurSamples ?? DEFAULT_MOTION_BLUR_SAMPLES))
      );

      const caSpike = config.caSpike ?? 0.035;
      const spike = caSpike * Math.max(0, 1 - Math.abs(progress - CA_SPIKE_PEAK) / CA_SPIKE_WINDOW);
      setCaUniform(caPass, spike);

      if (progress >= 1 && !landingTriggered) {
        landingTriggered = true;
        config.onLanding?.();
      }
      if (progress < 1) {
        landingTriggered = false;
      }
    };

    const timeline = gsap.timeline({
      paused: true,
      onUpdate: () => {
        renderFrame(timeline.time());
      }
    });
    timeline.to(timelineState, {
      time: duration,
      duration,
      ease
    });

    this.scene.add(mesh);
    renderFrame(0);

    const instance: CountingNumbersInstance = {
      mesh,
      timeline,
      motionBlurPass,
      play: () => {
        timeline.play();
      },
      pause: () => {
        timeline.pause();
      },
      seek: (time: number) => {
        timeline.seek(time, true);
        renderFrame(time);
      },
      reverse: () => {
        timeline.reverse();
      },
      dispose: () => {
        timeline.kill();
        motionBlurPass.dispose();
        mesh.dispose();
        this.scene.remove(mesh);
      }
    };

    return instance;
  }
}

export default CountingNumbersEngine;
