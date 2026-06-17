import gsap from "gsap";
import * as THREE from "three";
import {ShaderPass} from "three/examples/jsm/postprocessing/ShaderPass.js";

export type ComposerLike = {
  passes: unknown[];
  addPass(pass: unknown): void;
};

export type GrayscaleTransitionConfig = {
  desaturateDuration?: number;
  holdDuration?: number;
  restoreDuration?: number;
  saturationEase?: string;
  lutTexture?: THREE.Texture;
  lutIntensity?: number;
  vignetteBoost?: {
    enabled: boolean;
    intensity?: number;
    radius?: number;
  };
  autoAdd?: boolean;
};

type GrayscaleUniforms = {
  tDiffuse: {value: THREE.Texture | null};
  uSaturation: {value: number};
  uLUT: {value: THREE.Texture | null};
  uLUTEnabled: {value: boolean};
  uLUTIntensity: {value: number};
  uVignetteEnabled: {value: boolean};
  uVignetteIntensity: {value: number};
  uVignetteRadius: {value: number};
};

export type GrayscaleShaderPass = ShaderPass & {
  uniforms: GrayscaleUniforms;
};

export type GrayscaleTransitionInstance = {
  pass: GrayscaleShaderPass;
  saturation: number;
  isGrayscale: boolean;
  desaturate(duration?: number): Promise<void>;
  restore(duration?: number): Promise<void>;
  setSaturation(saturation: number): void;
  dispose(): void;
};

export const GRAYSCALE_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const GRAYSCALE_FRAGMENT_SHADER = `
uniform sampler2D tDiffuse;
uniform float uSaturation;
uniform sampler2D uLUT;
uniform bool uLUTEnabled;
uniform float uLUTIntensity;
uniform bool uVignetteEnabled;
uniform float uVignetteIntensity;
uniform float uVignetteRadius;

varying vec2 vUv;

vec3 applySaturation(vec3 color, float saturation) {
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  return mix(vec3(luminance), color, saturation);
}

vec3 applyLUT(vec3 color, sampler2D lut, float intensity) {
  float blue = color.b * 15.0;
  vec2 quad1 = vec2(
    floor(blue) * 16.0 + floor(color.r * 15.0),
    floor(color.g * 15.0)
  ) / 256.0;
  vec2 quad2 = vec2(
    ceil(blue) * 16.0 + floor(color.r * 15.0),
    floor(color.g * 15.0)
  ) / 256.0;
  vec3 lutColor1 = texture2D(lut, quad1).rgb;
  vec3 lutColor2 = texture2D(lut, quad2).rgb;
  vec3 lutColor = mix(lutColor1, lutColor2, fract(blue));
  return mix(color, lutColor, intensity);
}

float vignette(vec2 uv, float radius, float intensity) {
  vec2 centered = uv - 0.5;
  float distanceFromCenter = length(centered);
  float mask = smoothstep(radius, radius * 0.5, distanceFromCenter);
  return 1.0 - (1.0 - mask) * intensity;
}

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  color.rgb = applySaturation(color.rgb, uSaturation);
  if (uLUTEnabled) {
    color.rgb = applyLUT(color.rgb, uLUT, uLUTIntensity);
  }
  if (uVignetteEnabled) {
    color.rgb *= vignette(vUv, uVignetteRadius, uVignetteIntensity);
  }
  gl_FragColor = color;
}`;

const clamp01 = (value: number): number => THREE.MathUtils.clamp(value, 0, 1);

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

export class GrayscaleTransitionEngine {
  constructor(private readonly composer: ComposerLike) {}

  create(config: GrayscaleTransitionConfig): GrayscaleTransitionInstance {
    const shader = {
      uniforms: {
        tDiffuse: {value: null},
        uSaturation: {value: 1},
        uLUT: {value: config.lutTexture ?? null},
        uLUTEnabled: {value: Boolean(config.lutTexture)},
        uLUTIntensity: {value: config.lutIntensity ?? 0},
        uVignetteEnabled: {value: config.vignetteBoost?.enabled ?? false},
        uVignetteIntensity: {value: config.vignetteBoost?.intensity ?? 0.35},
        uVignetteRadius: {value: config.vignetteBoost?.radius ?? 0.65}
      },
      vertexShader: GRAYSCALE_VERTEX_SHADER,
      fragmentShader: GRAYSCALE_FRAGMENT_SHADER
    };
    const pass = new ShaderPass(shader) as GrayscaleShaderPass;
    pass.renderToScreen = false;
    pass.uniforms.uLUT.value = config.lutTexture ?? null;

    const instance: GrayscaleTransitionInstance = {
      pass,
      saturation: 1,
      isGrayscale: false,
      setSaturation: (saturation: number) => {
        instance.saturation = clamp01(saturation);
        instance.isGrayscale = instance.saturation < 0.1;
        pass.uniforms.uSaturation.value = instance.saturation;
      },
      desaturate: async (duration = config.desaturateDuration ?? 0.5) =>
        this.animateSaturation(instance, 0, duration, config.saturationEase),
      restore: async (duration = config.restoreDuration ?? 0.5) =>
        this.animateSaturation(instance, 1, duration, config.saturationEase),
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

  private async animateSaturation(
    instance: GrayscaleTransitionInstance,
    targetSaturation: number,
    duration: number,
    ease?: string
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const startSaturation = instance.saturation;
      const target = clamp01(targetSaturation);
      const startTime = performance.now();
      const easeFn = ease ? gsap.parseEase(ease) : (value: number): number => value;
      const safeDuration = Math.max(duration, 0.0001);
      const tick = (): void => {
        const elapsed = (performance.now() - startTime) / 1000;
        const t = clamp01(elapsed / safeDuration);
        const easedT = easeFn(t);
        instance.setSaturation(startSaturation + (target - startSaturation) * easedT);
        if (t < 1) {
          requestAnimationFrame(tick);
          return;
        }
        instance.setSaturation(target);
        resolve();
      };
      requestAnimationFrame(tick);
    });
  }
}

export default GrayscaleTransitionEngine;
