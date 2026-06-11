import {useEffect, useMemo, useRef} from "react";
import {useFrame, useThree} from "@react-three/fiber";
import type {RenderManifest} from "@prometheus/shared-types";
import {useVideoConfig} from "remotion";
import * as THREE from "three";
import {EffectComposer} from "three/examples/jsm/postprocessing/EffectComposer.js";
import {RenderPass} from "three/examples/jsm/postprocessing/RenderPass.js";
import {ShaderPass} from "three/examples/jsm/postprocessing/ShaderPass.js";
import {UnrealBloomPass} from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export type PostProcessConfig = {
  bloom?: boolean;
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  bloomLayer?: number;
  chromaticAberration?: boolean | number;
  motionBlur?: boolean;
  motionBlurStrength?: number;
  motionBlurSamples?: number;
  motionBlurVelocity?: THREE.Vector2 | {x: number; y: number};
  resolutionScale?: number;
};

type PassLike = {
  enabled: boolean;
  needsSwap: boolean;
  clear: boolean;
  renderToScreen: boolean;
  setSize(width: number, height: number): void;
  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    deltaTime: number,
    maskActive: boolean
  ): void;
  dispose?(): void;
};

type ShaderPassLike = ShaderPass & {
  clear: boolean;
  material: THREE.ShaderMaterial;
  renderToScreen: boolean;
  render: PassLike["render"];
};

const setShaderUniform = (
  pass: ShaderPassLike,
  name: string,
  value: unknown
): void => {
  const uniform = pass.uniforms[name];
  if (uniform) {
    uniform.value = value;
  }
};

const MOTION_BLUR_DEFAULT_SAMPLES = 8;

export const CHROMATIC_ABERRATION_FRAGMENT = `
uniform sampler2D tDiffuse;
uniform float amount;
varying vec2 vUv;

void main() {
  vec2 center = vec2(0.5);
  vec2 direction = vUv - center;
  float shiftAmount = length(direction) * amount;
  vec2 shift = normalize(direction + vec2(0.0001)) * shiftAmount;
  float r = texture2D(tDiffuse, vUv + shift).r;
  vec4 baseColor = texture2D(tDiffuse, vUv);
  float b = texture2D(tDiffuse, vUv - shift).b;
  gl_FragColor = vec4(r, baseColor.g, b, baseColor.a);
}`;

export const MOTION_BLUR_FRAGMENT = `
uniform sampler2D tDiffuse;
uniform vec2 velocity;
uniform int sampleCount;
varying vec2 vUv;

const int MAX_MOTION_BLUR_SAMPLES = 16;

void main() {
  int count = clamp(sampleCount, 1, MAX_MOTION_BLUR_SAMPLES);
  vec4 color = vec4(0.0);

  for (int i = 0; i < MAX_MOTION_BLUR_SAMPLES; i++) {
    if (i >= count) {
      break;
    }
    float denom = float(max(count - 1, 1));
    float centeredSample = float(i) / denom - 0.5;
    color += texture2D(tDiffuse, vUv + velocity * centeredSample);
  }

  gl_FragColor = color / float(count);
}`;

export const SCREEN_QUAD_VERTEX = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const CHROMATIC_ABERRATION_SHADER = {
  name: "PrometheusChromaticAberrationShader",
  uniforms: {
    tDiffuse: {value: null},
    amount: {value: 0.003}
  },
  vertexShader: SCREEN_QUAD_VERTEX,
  fragmentShader: CHROMATIC_ABERRATION_FRAGMENT
};

export const MOTION_BLUR_SHADER = {
  name: "PrometheusMotionBlurShader",
  uniforms: {
    tDiffuse: {value: null},
    velocity: {value: new THREE.Vector2(0, 0)},
    sampleCount: {value: MOTION_BLUR_DEFAULT_SAMPLES}
  },
  vertexShader: SCREEN_QUAD_VERTEX,
  fragmentShader: MOTION_BLUR_FRAGMENT
};

export const TEXT_BLOOM_COMPOSITE_SHADER = {
  name: "PrometheusTextBloomCompositeShader",
  uniforms: {
    tDiffuse: {value: null},
    opacity: {value: 0.82}
  },
  vertexShader: SCREEN_QUAD_VERTEX,
  fragmentShader: `
uniform sampler2D tDiffuse;
uniform float opacity;
varying vec2 vUv;

void main() {
  vec4 bloomColor = texture2D(tDiffuse, vUv);
  gl_FragColor = vec4(bloomColor.rgb * opacity, bloomColor.a * opacity);
}`
};

export const IDENTITY_SHADER = {
  name: "PrometheusIdentityShader",
  uniforms: {
    tDiffuse: {value: null}
  },
  vertexShader: SCREEN_QUAD_VERTEX,
  fragmentShader: `
uniform sampler2D tDiffuse;
varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(tDiffuse, vUv);
}`
};

class SelectiveBloomPass implements PassLike {
  enabled = true;
  needsSwap = false;
  clear = false;
  renderToScreen = false;

  private readonly bloomPass: UnrealBloomPass;
  private readonly compositePass: ShaderPassLike;
  private readonly selectiveTarget: THREE.WebGLRenderTarget;
  private readonly scratchTarget: THREE.WebGLRenderTarget;
  private readonly oldClearColor = new THREE.Color();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    private readonly textLayer: number,
    config: Required<Pick<PostProcessConfig, "bloomStrength" | "bloomRadius" | "bloomThreshold">>
  ) {
    this.selectiveTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false
    });
    this.selectiveTarget.texture.name = "Prometheus.selective-text-bloom";
    this.scratchTarget = this.selectiveTarget.clone();
    this.scratchTarget.texture.name = "Prometheus.selective-text-bloom.scratch";
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      config.bloomStrength,
      config.bloomRadius,
      config.bloomThreshold
    );
    this.compositePass = new ShaderPass(TEXT_BLOOM_COMPOSITE_SHADER) as ShaderPassLike;
    this.compositePass.clear = false;
    this.compositePass.material.blending = THREE.AdditiveBlending;
    this.compositePass.material.transparent = true;
    this.compositePass.material.depthTest = false;
    this.compositePass.material.depthWrite = false;
  }

  updateConfig(config: PostProcessConfig): void {
    this.bloomPass.strength = config.bloomStrength ?? this.bloomPass.strength;
    this.bloomPass.radius = config.bloomRadius ?? this.bloomPass.radius;
    this.bloomPass.threshold = config.bloomThreshold ?? this.bloomPass.threshold;
  }

  setSize(width: number, height: number): void {
    this.selectiveTarget.setSize(width, height);
    this.scratchTarget.setSize(width, height);
    this.bloomPass.setSize(width, height);
  }

  render(
    renderer: THREE.WebGLRenderer,
    _writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    deltaTime: number,
    maskActive: boolean
  ): void {
    const oldRenderTarget = renderer.getRenderTarget();
    const oldAutoClear = renderer.autoClear;
    const oldClearAlpha = renderer.getClearAlpha();
    const oldCameraLayerMask = this.camera.layers.mask;

    renderer.getClearColor(this.oldClearColor);
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(this.selectiveTarget);
    renderer.clear(true, true, true);

    this.camera.layers.set(this.textLayer);
    renderer.render(this.scene, this.camera);
    this.camera.layers.mask = oldCameraLayerMask;

    this.bloomPass.renderToScreen = false;
    this.bloomPass.render(renderer, this.scratchTarget, this.selectiveTarget, deltaTime, maskActive);

    this.compositePass.renderToScreen = false;
    this.compositePass.render(renderer, readBuffer, this.selectiveTarget, deltaTime, maskActive);

    renderer.setRenderTarget(oldRenderTarget);
    renderer.setClearColor(this.oldClearColor, oldClearAlpha);
    renderer.autoClear = oldAutoClear;
  }

  dispose(): void {
    this.bloomPass.dispose();
    this.compositePass.dispose();
    this.selectiveTarget.dispose();
    this.scratchTarget.dispose();
  }
}

const chromaticAmount = (value: boolean | number | undefined): number =>
  typeof value === "number" ? Math.max(0, value) : value ? 0.003 : 0;

const motionBlurVelocity = (config: PostProcessConfig): THREE.Vector2 => {
  const velocity = config.motionBlurVelocity;
  if (velocity instanceof THREE.Vector2) {
    return velocity;
  }
  return velocity ? new THREE.Vector2(velocity.x, velocity.y) : new THREE.Vector2(0, 0);
};

const setMotionBlurUniforms = (
  pass: ShaderPassLike,
  config: PostProcessConfig
): void => {
  const velocity = motionBlurVelocity(config);
  const velocityUniform = pass.uniforms.velocity;
  if (velocityUniform?.value instanceof THREE.Vector2) {
    velocityUniform.value.copy(velocity);
  } else if (velocityUniform) {
    velocityUniform.value = velocity;
  }
  setShaderUniform(
    pass,
    "sampleCount",
    Math.max(1, Math.min(16, Math.floor(config.motionBlurSamples ?? MOTION_BLUR_DEFAULT_SAMPLES)))
  );
};

export const shouldRenderPostProcessing = (config: PostProcessConfig): boolean =>
  Boolean(config.bloom || config.motionBlur || chromaticAmount(config.chromaticAberration) > 0);

export const postProcessConfigFromManifest = (manifest: RenderManifest): PostProcessConfig => ({
  bloom: manifest.bloomEnabled,
  bloomStrength: manifest.bloomStrength,
  bloomRadius: manifest.bloomRadius,
  bloomThreshold: manifest.bloomThreshold,
  chromaticAberration: manifest.chromaticAberrationEnabled ? manifest.chromaticAberrationOffset : 0,
  motionBlur: manifest.motionBlurEnabled,
  motionBlurStrength: manifest.motionBlurStrength,
  resolutionScale: manifest.motionBlurEnabled ? 0.5 : 1
});

export function createPostProcessingPasses({
  scene,
  camera,
  size,
  config
}: {
  scene: THREE.Scene;
  camera: THREE.Camera;
  size: {width: number; height: number};
  config: PostProcessConfig;
}): {
  renderPass: RenderPass;
  selectiveBloomPass: SelectiveBloomPass | null;
  chromaticPass: ShaderPassLike | null;
  motionBlurPass: ShaderPassLike | null;
  outputPass: ShaderPassLike | null;
  passes: unknown[];
} {
  const renderPass = new RenderPass(scene, camera);
  const passes: unknown[] = [renderPass];
  const bloomLayer = config.bloomLayer ?? 1;
  const selectiveBloomPass = config.bloom
    ? new SelectiveBloomPass(scene, camera, bloomLayer, {
        bloomStrength: config.bloomStrength ?? 1.5,
        bloomRadius: config.bloomRadius ?? 0.4,
        bloomThreshold: config.bloomThreshold ?? 0.8
      })
    : null;
  if (selectiveBloomPass) {
    selectiveBloomPass.setSize(size.width, size.height);
    passes.push(selectiveBloomPass);
  }

  const amount = chromaticAmount(config.chromaticAberration);
  const chromaticPass = amount > 0
    ? new ShaderPass(CHROMATIC_ABERRATION_SHADER) as ShaderPassLike
    : null;
  if (chromaticPass) {
    setShaderUniform(chromaticPass, "amount", amount);
    passes.push(chromaticPass);
  }

  const motionBlurPass = config.motionBlur
    ? new ShaderPass(MOTION_BLUR_SHADER) as ShaderPassLike
    : null;
  if (motionBlurPass) {
    setMotionBlurUniforms(motionBlurPass, config);
    passes.push(motionBlurPass);
  }

  const outputPass = selectiveBloomPass && !chromaticPass && !motionBlurPass
    ? new ShaderPass(IDENTITY_SHADER) as ShaderPassLike
    : null;
  if (outputPass) {
    passes.push(outputPass);
  }

  return {renderPass, selectiveBloomPass, chromaticPass, motionBlurPass, outputPass, passes};
}

export function PostProcessingPipeline({config}: {config: PostProcessConfig}) {
  const {gl, scene, camera, size} = useThree();
  const {fps} = useVideoConfig();
  const enabled = useMemo(() => shouldRenderPostProcessing(config), [config]);
  const composerRef = useRef<EffectComposer | null>(null);
  const passesRef = useRef<ReturnType<typeof createPostProcessingPasses> | null>(null);
  const resolutionScale = config.resolutionScale ?? 1;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const composer = new EffectComposer(gl);
    const scaledSize = {
      width: Math.max(1, Math.floor(size.width * resolutionScale)),
      height: Math.max(1, Math.floor(size.height * resolutionScale))
    };
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(scaledSize.width, scaledSize.height);

    const passState = createPostProcessingPasses({
      scene,
      camera,
      size: scaledSize,
      config
    });
    for (const pass of passState.passes) {
      composer.addPass(pass);
    }

    composerRef.current = composer;
    passesRef.current = passState;

    return () => {
      passesRef.current?.selectiveBloomPass?.dispose();
      passesRef.current?.chromaticPass?.dispose();
      passesRef.current?.motionBlurPass?.dispose();
      passesRef.current?.outputPass?.dispose();
      composer.dispose();
      if (composerRef.current === composer) {
        composerRef.current = null;
      }
      if (passesRef.current === passState) {
        passesRef.current = null;
      }
    };
  }, [camera, enabled, gl, scene]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) {
      return;
    }

    const width = Math.max(1, Math.floor(size.width * resolutionScale));
    const height = Math.max(1, Math.floor(size.height * resolutionScale));
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(width, height);
  }, [gl, resolutionScale, size.height, size.width]);

  useEffect(() => {
    const passState = passesRef.current;
    if (!passState) {
      return;
    }

    passState.selectiveBloomPass?.updateConfig(config);
    if (passState.chromaticPass) {
      setShaderUniform(
        passState.chromaticPass,
        "amount",
        chromaticAmount(config.chromaticAberration)
      );
    }
    if (passState.motionBlurPass) {
      setMotionBlurUniforms(passState.motionBlurPass, config);
    }
  }, [config]);

  useFrame(() => {
    const passState = passesRef.current;
    if (passState?.motionBlurPass) {
      // The velocity uniform is updated every render tick so camera or glyph velocity
      // can feed it later without rebuilding the composer.
      setMotionBlurUniforms(passState.motionBlurPass, config);
    }
    composerRef.current?.render(1 / Math.max(fps, 1));
  }, 1);

  return null;
}
