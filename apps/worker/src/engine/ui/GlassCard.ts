import React, {useEffect, useMemo, useRef} from "react";
import {useFrame, useThree} from "@react-three/fiber";
import * as THREE from "three";

export type GlassCardGradientBorder = {
  enabled: boolean;
  colors: THREE.Color[];
  speed?: number;
  width?: number;
  glowIntensity?: number;
};

export type GlassCardInnerShadow = {
  enabled: boolean;
  color?: THREE.Color;
  blur?: number;
  offsetX?: number;
  offsetY?: number;
  opacity?: number;
};

export type GlassCardNoise = {
  enabled: boolean;
  opacity?: number;
  scale?: number;
};

export type GlassCardConfig = {
  width: number;
  height: number;
  cornerRadius?: number;
  position?: THREE.Vector3;
  rotation?: THREE.Euler;
  blurAmount?: number;
  backgroundColor?: THREE.Color;
  backgroundAlpha?: number;
  borderWidth?: number;
  borderColor?: THREE.Color;
  borderAlpha?: number;
  gradientBorder?: GlassCardGradientBorder;
  innerShadow?: GlassCardInnerShadow;
  noise?: GlassCardNoise;
  contentTexture?: THREE.Texture;
  contentAlpha?: number;
  backgroundTexture?: THREE.Texture;
  backgroundUvTransform?: THREE.Matrix3;
};

export type GlassCardInstance = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, GlassCardMaterial>;
  material: GlassCardMaterial;
  config: GlassCardConfig;
  setGradientSpeed(speed: number): void;
  setOpacity(alpha: number): void;
  setScale(scale: number): void;
  setContentTexture(texture: THREE.Texture): void;
  setBackgroundTexture(texture: THREE.Texture): void;
  dispose(): void;
};

export type GlassCardUniformMap = {
  uSize: THREE.IUniform<THREE.Vector2>;
  uCornerRadius: THREE.IUniform<number>;
  uBlurAmount: THREE.IUniform<number>;
  uBackgroundColor: THREE.IUniform<THREE.Vector4>;
  uBackgroundAlpha: THREE.IUniform<number>;
  uBorderWidth: THREE.IUniform<number>;
  uBorderColor: THREE.IUniform<THREE.Vector4>;
  uGradientBorderEnabled: THREE.IUniform<boolean>;
  uGradientColors: THREE.IUniform<THREE.Vector3[]>;
  uGradientSpeed: THREE.IUniform<number>;
  uGradientBorderWidth: THREE.IUniform<number>;
  uGradientGlowIntensity: THREE.IUniform<number>;
  uInnerShadowEnabled: THREE.IUniform<boolean>;
  uInnerShadowColor: THREE.IUniform<THREE.Vector4>;
  uInnerShadowBlur: THREE.IUniform<number>;
  uInnerShadowOffset: THREE.IUniform<THREE.Vector2>;
  uNoiseEnabled: THREE.IUniform<boolean>;
  uNoiseOpacity: THREE.IUniform<number>;
  uNoiseScale: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
  uBackgroundTexture: THREE.IUniform<THREE.Texture | null>;
  uBackgroundTextureEnabled: THREE.IUniform<boolean>;
  uBackgroundUvTransform: THREE.IUniform<THREE.Matrix3>;
  uContentTexture: THREE.IUniform<THREE.Texture | null>;
  uContentTextureEnabled: THREE.IUniform<boolean>;
  uContentAlpha: THREE.IUniform<number>;
};

export type GlassCardMaterial = THREE.ShaderMaterial & {
  uniforms: GlassCardUniformMap;
};

export const GlassCardShaderChunks = {
  vertex: `
    varying vec2 vUv;
    varying vec2 vLocalPos;

    void main() {
      vUv = uv;
      vLocalPos = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragment: `
    precision highp float;

    uniform vec2 uSize;
    uniform float uCornerRadius;
    uniform float uBlurAmount;
    uniform vec4 uBackgroundColor;
    uniform float uBackgroundAlpha;
    uniform float uBorderWidth;
    uniform vec4 uBorderColor;
    uniform bool uGradientBorderEnabled;
    uniform vec3 uGradientColors[4];
    uniform float uGradientSpeed;
    uniform float uGradientBorderWidth;
    uniform float uGradientGlowIntensity;
    uniform bool uInnerShadowEnabled;
    uniform vec4 uInnerShadowColor;
    uniform float uInnerShadowBlur;
    uniform vec2 uInnerShadowOffset;
    uniform bool uNoiseEnabled;
    uniform float uNoiseOpacity;
    uniform float uNoiseScale;
    uniform float uTime;
    uniform sampler2D uBackgroundTexture;
    uniform bool uBackgroundTextureEnabled;
    uniform mat3 uBackgroundUvTransform;
    uniform sampler2D uContentTexture;
    uniform bool uContentTextureEnabled;
    uniform float uContentAlpha;

    varying vec2 vUv;
    varying vec2 vLocalPos;

    float sdRoundedRect(vec2 p, vec2 size, float radius) {
      vec2 d = abs(p) - (size * 0.5 - radius);
      return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - radius;
    }

    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    vec3 gradientColor(float angle, vec3 colors[4]) {
      float t = fract(angle / 6.28318530718);
      float idx = t * 3.0;
      int i = int(floor(idx));
      float f = fract(idx);
      vec3 c0 = colors[clamp(i, 0, 3)];
      vec3 c1 = colors[clamp(i + 1, 0, 3)];
      return mix(c0, c1, smoothstep(0.0, 1.0, f));
    }

    void main() {
      vec2 p = vLocalPos * uSize;
      vec2 size = uSize;
      float radius = min(uCornerRadius, min(size.x, size.y) * 0.5);
      float dist = sdRoundedRect(p, size, radius);
      float shapeMask = 1.0 - smoothstep(0.0, 0.01, dist);
      if (shapeMask < 0.001) {
        discard;
      }

      vec4 bgColor = uBackgroundColor;
      bgColor.a *= uBackgroundAlpha;

      if (uBackgroundTextureEnabled) {
        vec3 bgUv = uBackgroundUvTransform * vec3(vUv, 1.0);
        vec2 blurOffset = vec2(uBlurAmount) / vec2(4096.0);
        vec4 blurredBg = texture2D(uBackgroundTexture, bgUv.xy) * 0.4;
        blurredBg += texture2D(uBackgroundTexture, bgUv.xy + vec2(blurOffset.x, 0.0)) * 0.15;
        blurredBg += texture2D(uBackgroundTexture, bgUv.xy - vec2(blurOffset.x, 0.0)) * 0.15;
        blurredBg += texture2D(uBackgroundTexture, bgUv.xy + vec2(0.0, blurOffset.y)) * 0.15;
        blurredBg += texture2D(uBackgroundTexture, bgUv.xy - vec2(0.0, blurOffset.y)) * 0.15;
        bgColor = mix(blurredBg, bgColor, bgColor.a);
      }

      if (uNoiseEnabled) {
        float n = noise(vUv * uNoiseScale * 500.0 + uTime * 0.1) * 2.0 - 1.0;
        bgColor.rgb += n * uNoiseOpacity;
      }

      if (uInnerShadowEnabled) {
        float shadowDist = sdRoundedRect(p - uInnerShadowOffset, size - vec2(uInnerShadowBlur), radius);
        float shadowMask = smoothstep(0.0, uInnerShadowBlur, shadowDist);
        bgColor.rgb = mix(bgColor.rgb, uInnerShadowColor.rgb, shadowMask * uInnerShadowColor.a);
      }

      vec4 finalColor = bgColor;
      float borderMask = 1.0 - smoothstep(0.0, 0.01, abs(dist) - uBorderWidth);
      finalColor = mix(finalColor, uBorderColor, borderMask * uBorderColor.a);

      if (uGradientBorderEnabled) {
        float gradBorderMask = 1.0 - smoothstep(0.0, 0.01, abs(dist) - uGradientBorderWidth);
        if (gradBorderMask > 0.001) {
          float angle = atan(p.y, p.x) + uTime * uGradientSpeed;
          vec3 gradColor = gradientColor(angle, uGradientColors);
          float glow = exp(-abs(dist) * 2.0) * uGradientGlowIntensity;
          finalColor.rgb += gradColor * glow;
          finalColor = mix(finalColor, vec4(gradColor, 1.0), gradBorderMask * 0.8);
        }
      }

      if (uContentTextureEnabled) {
        vec4 content = texture2D(uContentTexture, vUv);
        finalColor = mix(finalColor, content, content.a * uContentAlpha);
      }

      gl_FragColor = vec4(finalColor.rgb, finalColor.a * shapeMask);
    }
  `
};

const DEFAULT_GRADIENT_COLORS = [
  new THREE.Color("#00ffff"),
  new THREE.Color("#ff00ff"),
  new THREE.Color("#ff8800"),
  new THREE.Color("#00ffff")
];

const toVector3Colors = (colors: readonly THREE.Color[] | undefined): THREE.Vector3[] => {
  const resolved = colors && colors.length > 0 ? colors : DEFAULT_GRADIENT_COLORS;
  const padded = [...resolved];
  while (padded.length < 4) {
    padded.push((padded[padded.length - 1] ?? DEFAULT_GRADIENT_COLORS[0] ?? new THREE.Color("#00ffff")).clone());
  }
  return padded.slice(0, 4).map((color) => new THREE.Vector3(color.r, color.g, color.b));
};

const colorToVector4 = (color: THREE.Color, alpha: number): THREE.Vector4 =>
  new THREE.Vector4(color.r, color.g, color.b, alpha);

export const createGlassCardGeometry = (
  width: number,
  height: number,
  segments = 32
): THREE.PlaneGeometry =>
  new THREE.PlaneGeometry(width, height, segments, segments);

export const createGlassCardMaterial = (
  config: GlassCardConfig
): GlassCardMaterial =>
  new THREE.ShaderMaterial({
    vertexShader: GlassCardShaderChunks.vertex,
    fragmentShader: GlassCardShaderChunks.fragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uSize: {value: new THREE.Vector2(config.width, config.height)},
      uCornerRadius: {value: config.cornerRadius ?? 16},
      uBlurAmount: {value: config.blurAmount ?? 40},
      uBackgroundColor: {
        value: colorToVector4(config.backgroundColor ?? new THREE.Color("#ffffff"), 1)
      },
      uBackgroundAlpha: {value: config.backgroundAlpha ?? 0.05},
      uBorderWidth: {value: config.borderWidth ?? 1},
      uBorderColor: {
        value: colorToVector4(config.borderColor ?? new THREE.Color("#ffffff"), config.borderAlpha ?? 0.1)
      },
      uGradientBorderEnabled: {value: config.gradientBorder?.enabled ?? false},
      uGradientColors: {value: toVector3Colors(config.gradientBorder?.colors)},
      uGradientSpeed: {value: (config.gradientBorder?.speed ?? 0.33) * Math.PI * 2},
      uGradientBorderWidth: {value: config.gradientBorder?.width ?? 2},
      uGradientGlowIntensity: {value: config.gradientBorder?.glowIntensity ?? 0.6},
      uInnerShadowEnabled: {value: config.innerShadow?.enabled ?? true},
      uInnerShadowColor: {
        value: colorToVector4(config.innerShadow?.color ?? new THREE.Color("#000000"), config.innerShadow?.opacity ?? 0.1)
      },
      uInnerShadowBlur: {value: config.innerShadow?.blur ?? 8},
      uInnerShadowOffset: {
        value: new THREE.Vector2(config.innerShadow?.offsetX ?? 0, config.innerShadow?.offsetY ?? 2)
      },
      uNoiseEnabled: {value: config.noise?.enabled ?? true},
      uNoiseOpacity: {value: config.noise?.opacity ?? 0.05},
      uNoiseScale: {value: config.noise?.scale ?? 1},
      uTime: {value: 0},
      uBackgroundTexture: {value: config.backgroundTexture ?? null},
      uBackgroundTextureEnabled: {value: Boolean(config.backgroundTexture)},
      uBackgroundUvTransform: {value: config.backgroundUvTransform ?? new THREE.Matrix3()},
      uContentTexture: {value: config.contentTexture ?? null},
      uContentTextureEnabled: {value: Boolean(config.contentTexture)},
      uContentAlpha: {value: config.contentAlpha ?? 1}
    }
  }) as GlassCardMaterial;

export class GlassCardEngine {
  private readonly scene: THREE.Scene;
  private readonly instances = new Set<GlassCardInstance>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  create(config: GlassCardConfig): GlassCardInstance {
    const geometry = createGlassCardGeometry(config.width, config.height);
    const material = createGlassCardMaterial(config);
    const mesh = new THREE.Mesh(geometry, material);

    if (config.position) {
      mesh.position.copy(config.position);
    }
    if (config.rotation) {
      mesh.rotation.copy(config.rotation);
    }

    this.scene.add(mesh);

    const instance: GlassCardInstance = {
      mesh,
      material,
      config,
      setGradientSpeed: (speed: number) => {
        material.uniforms.uGradientSpeed.value = speed * Math.PI * 2;
      },
      setOpacity: (alpha: number) => {
        material.uniforms.uBackgroundAlpha.value = alpha;
      },
      setScale: (scale: number) => {
        mesh.scale.setScalar(scale);
      },
      setContentTexture: (texture: THREE.Texture) => {
        material.uniforms.uContentTexture.value = texture;
        material.uniforms.uContentTextureEnabled.value = true;
      },
      setBackgroundTexture: (texture: THREE.Texture) => {
        material.uniforms.uBackgroundTexture.value = texture;
        material.uniforms.uBackgroundTextureEnabled.value = true;
      },
      dispose: () => {
        geometry.dispose();
        geometry.boundingBox = null;
        geometry.boundingSphere = null;
        material.uniforms.uTime.value = 0;
        material.dispose();
        this.scene.remove(mesh);
        this.instances.delete(instance);
      }
    };

    this.instances.add(instance);
    return instance;
  }

  update(time: number): void {
    for (const instance of this.instances) {
      instance.material.uniforms.uTime.value = time;
    }
  }

  async createBlurredBackground(sourceTexture: THREE.Texture): Promise<THREE.Texture> {
    return sourceTexture;
  }
}

export const GlassCardPresets = {
  info: (): Partial<GlassCardConfig> => ({
    cornerRadius: 16,
    blurAmount: 40,
    backgroundAlpha: 0.05,
    borderWidth: 1,
    borderAlpha: 0.1,
    innerShadow: {enabled: true, blur: 8, offsetX: 0, offsetY: 2, opacity: 0.1},
    noise: {enabled: true, opacity: 0.05, scale: 1}
  }),
  pricingPill: (): Partial<GlassCardConfig> => ({
    cornerRadius: 20,
    blurAmount: 30,
    backgroundAlpha: 0.08,
    borderWidth: 1,
    borderAlpha: 0.15,
    gradientBorder: {
      enabled: true,
      colors: [new THREE.Color("#00ffff"), new THREE.Color("#ff00ff")],
      speed: 0.2,
      width: 2,
      glowIntensity: 0.5
    }
  }),
  textContainer: (): Partial<GlassCardConfig> => ({
    cornerRadius: 12,
    blurAmount: 50,
    backgroundAlpha: 0.03,
    borderWidth: 1,
    borderAlpha: 0.08,
    innerShadow: {enabled: true, blur: 12, offsetX: 0, offsetY: 3, opacity: 0.15},
    noise: {enabled: true, opacity: 0.03, scale: 1.5}
  }),
  previewFrame: (): Partial<GlassCardConfig> => ({
    cornerRadius: 8,
    blurAmount: 20,
    backgroundAlpha: 0.02,
    borderWidth: 2,
    borderAlpha: 0.2,
    gradientBorder: {
      enabled: true,
      colors: [new THREE.Color("#00ffff"), new THREE.Color("#ff8800")],
      speed: 0.1,
      width: 2,
      glowIntensity: 0.8
    }
  }),
  button: (): Partial<GlassCardConfig> => ({
    cornerRadius: 24,
    blurAmount: 35,
    backgroundAlpha: 0.1,
    borderWidth: 1,
    borderAlpha: 0.2,
    gradientBorder: {
      enabled: true,
      colors: [new THREE.Color("#ffffff"), new THREE.Color("#aaaaaa")],
      speed: 0,
      width: 1,
      glowIntensity: 0.3
    }
  })
} satisfies Record<string, () => Partial<GlassCardConfig>>;

export type GlassCardPreset = keyof typeof GlassCardPresets;

export type GlassCardProps = {
  width: number;
  height: number;
  config?: Partial<GlassCardConfig>;
  preset?: GlassCardPreset;
  position?: [number, number, number];
  rotation?: [number, number, number];
};

export const GlassCard: React.FC<GlassCardProps> = ({
  width,
  height,
  config: userConfig,
  preset = "info",
  position = [0, 0, 0],
  rotation = [0, 0, 0]
}) => {
  const {scene} = useThree();
  const engineRef = useRef<GlassCardEngine | null>(null);
  const cardRef = useRef<GlassCardInstance | null>(null);
  const config = useMemo<GlassCardConfig>(() => ({
    width,
    height,
    position: new THREE.Vector3(...position),
    rotation: new THREE.Euler(...rotation),
    ...GlassCardPresets[preset](),
    ...userConfig
  }), [height, position, preset, rotation, userConfig, width]);

  useEffect(() => {
    const engine = new GlassCardEngine(scene);
    const card = engine.create(config);
    engineRef.current = engine;
    cardRef.current = card;

    return () => {
      card.dispose();
      if (engineRef.current === engine) {
        engineRef.current = null;
      }
      if (cardRef.current === card) {
        cardRef.current = null;
      }
    };
  }, [config, scene]);

  useFrame((state) => {
    engineRef.current?.update(state.clock.elapsedTime);
  });

  return null;
};

export default GlassCardEngine;
