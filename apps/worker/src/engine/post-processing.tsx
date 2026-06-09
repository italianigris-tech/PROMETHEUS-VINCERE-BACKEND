import React, {memo, useMemo} from "react";
import {Bloom, EffectComposer, wrapEffect as wrapPostprocessingEffect} from "@react-three/postprocessing";
import type {RenderManifest} from "@prometheus/shared-types";
import {Uniform, type Texture, type WebGLRenderer, type WebGLRenderTarget} from "three";
import {Effect, BlendFunction} from "postprocessing";

type EffectComponent = React.ComponentType<Record<string, never>>;

const wrapEffect = (effect: new () => Effect): EffectComponent => {
  return wrapPostprocessingEffect(effect);
};

export type PostProcessConfig = {
  bloom?: boolean;
  chromaticAberration?: boolean | number;
  motionBlur?: boolean;
  resolutionScale?: number;
};

export const CHROMATIC_ABERRATION_FRAGMENT = `
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 center = vec2(0.5);
  vec2 direction = uv - center;
  float amount = length(direction) * 0.006;
  vec2 shift = normalize(direction + vec2(0.0001)) * amount;
  float r = texture2D(inputBuffer, uv + shift).r;
  float g = inputColor.g;
  float b = texture2D(inputBuffer, uv - shift).b;
  outputColor = vec4(r, g, b, inputColor.a);
}`;

export const MOTION_BLUR_FRAGMENT = `
uniform sampler2D tHistory;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec4 currentColor = vec4(0.0);
  for (int i = 0; i < 8; i++) {
    float stepOffset = (float(i) - 3.5) * 0.0015;
    currentColor += texture2D(inputBuffer, uv + vec2(stepOffset, 0.0));
  }
  currentColor /= 8.0;
  vec4 history = texture2D(tHistory, uv);
  outputColor = mix(history, currentColor, 0.125);
}`;

class RadialChromaticAberrationEffect extends Effect {
  constructor() {
    super("RadialChromaticAberrationEffect", CHROMATIC_ABERRATION_FRAGMENT, {
      blendFunction: BlendFunction.NORMAL
    });
  }
}

class TemporalMotionBlurEffect extends Effect {
  private history: Texture | null = null;

  constructor() {
    super("TemporalMotionBlurEffect", MOTION_BLUR_FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([["tHistory", new Uniform<Texture | null>(null)]])
    });
  }

  update(_renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget): void {
    this.history = inputBuffer.texture;
    const uniform = this.uniforms.get("tHistory");
    if (uniform) {
      uniform.value = this.history;
    }
  }
}

const ChromaticAberrationEffect = wrapEffect(RadialChromaticAberrationEffect);
const MotionBlurEffect = wrapEffect(TemporalMotionBlurEffect);

const chromaticEnabled = (value: boolean | number | undefined): boolean =>
  typeof value === "number" ? value > 0 : Boolean(value);

export const shouldRenderPostProcessing = (config: PostProcessConfig): boolean =>
  Boolean(config.bloom || config.motionBlur || chromaticEnabled(config.chromaticAberration));

export const postProcessConfigFromManifest = (manifest: RenderManifest): PostProcessConfig => ({
  bloom: manifest.bloomEnabled,
  chromaticAberration: manifest.chromaticAberrationEnabled ? manifest.chromaticAberrationOffset : 0,
  motionBlur: manifest.motionBlurEnabled,
  resolutionScale: manifest.motionBlurEnabled ? 0.5 : 1
});

export const PostProcessingPipeline = memo(function PostProcessingPipeline({
  config
}: {
  config: PostProcessConfig;
}) {
  const resolutionScale = config.resolutionScale ?? 1;
  const enabled = useMemo(() => shouldRenderPostProcessing(config), [config]);

  if (!enabled) {
    return null;
  }

  return (
    <EffectComposer multisampling={0} resolutionScale={resolutionScale}>
      {config.bloom && (
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.8}
          luminanceSmoothing={0.1}
          mipmapBlur
        />
      )}
      {chromaticEnabled(config.chromaticAberration) && <ChromaticAberrationEffect />}
      {config.motionBlur && <MotionBlurEffect />}
    </EffectComposer>
  );
});
