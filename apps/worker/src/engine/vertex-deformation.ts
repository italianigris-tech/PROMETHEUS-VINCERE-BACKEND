import * as THREE from "three";

export type DeformationType = "explode" | "wave" | "ripple" | "shatter" | "none";
export type TextDeformationType = DeformationType;

export type DeformationConfig = {
  type: DeformationType;
  intensity: number;
  speed?: number;
  frequency?: number;
  seed?: number;
};
export type TextDeformationConfig = DeformationConfig;

export type DeformationShader = {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, THREE.IUniform>;
};

export type DeformableMaterial = THREE.MeshBasicMaterial & {
  userData: {
    shader?: DeformationShader;
    deformationConfig?: DeformationConfig;
    baseOnBeforeCompile?: DeformationCompileHook;
  };
};

type DeformationCompileHook = (
  shader: DeformationShader,
  renderer: THREE.WebGLRenderer
) => void;

const typeToInt = (type: DeformationType): number => {
  switch (type) {
    case "explode":
      return 1;
    case "wave":
      return 2;
    case "ripple":
      return 3;
    case "shatter":
      return 4;
    default:
      return 0;
  }
};

const DEFORMATION_GLSL = `
uniform int uDeformationType;
uniform float uTime;
uniform float uIntensity;
uniform float uSpeed;
uniform float uFrequency;
uniform float uSeed;

float deformRand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 applyGlyphLocalDeformation(vec3 localPosition, vec3 localNormal, float glyphIndex) {
  if (uDeformationType == 0 || uIntensity <= 0.0) {
    return localPosition;
  }

  float t = uTime * uSpeed;
  float glyphSeed = deformRand(vec2(glyphIndex, uSeed));

  if (uDeformationType == 1) {
    vec3 direction = normalize(localPosition + vec3(0.001));
    float pulse = 0.65 + 0.35 * sin(t * 3.0 + glyphSeed * 6.2831853);
    return localPosition + direction * uIntensity * pulse;
  }

  if (uDeformationType == 2) {
    float wave = sin(localPosition.x * uFrequency + t + glyphIndex * 0.23);
    return localPosition + vec3(0.0, wave * uIntensity * 0.35, 0.0);
  }

  if (uDeformationType == 3) {
    float distanceFromCenter = length(localPosition.xy);
    float ripple = sin(distanceFromCenter * uFrequency * 5.0 - t * 3.0);
    return localPosition + localNormal * ripple * uIntensity * 0.3;
  }

  if (uDeformationType == 4) {
    vec3 offset = vec3(
      sin(glyphSeed * 6.2831853),
      cos(glyphSeed * 6.2831853),
      glyphSeed - 0.5
    );
    return localPosition + offset * uIntensity * smoothstep(0.0, 0.75, fract(t));
  }

  return localPosition;
}
`;

const MAIN_DECLARATION = /void\s+main\s*\(\s*\)\s*\{/;

export const injectVertexDeformation = (
  material: THREE.MeshBasicMaterial,
  config: DeformationConfig
): void => {
  const deformable = material as DeformableMaterial;
  const intensity = Math.min(1, Math.max(0, config.intensity));
  const baseOnBeforeCompile = deformable.userData.baseOnBeforeCompile ??
    (material.onBeforeCompile as DeformationCompileHook);
  deformable.userData.baseOnBeforeCompile = baseOnBeforeCompile;
  deformable.userData.deformationConfig = {...config, intensity};

  material.onBeforeCompile = ((shader: DeformationShader, renderer: THREE.WebGLRenderer) => {
    baseOnBeforeCompile.call(material, shader, renderer);

    shader.uniforms.uDeformationType = {value: typeToInt(config.type)};
    shader.uniforms.uTime = {value: 0};
    shader.uniforms.uIntensity = {value: intensity};
    shader.uniforms.uSpeed = {value: config.speed ?? 1};
    shader.uniforms.uFrequency = {value: config.frequency ?? 1};
    shader.uniforms.uSeed = {value: config.seed ?? 0};

    shader.vertexShader = shader.vertexShader.replace(
      MAIN_DECLARATION,
      `${DEFORMATION_GLSL}
void main() {`
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
transformed = applyGlyphLocalDeformation(transformed, normal, float(gl_InstanceID));`
    );
    deformable.userData.shader = shader;
  }) as THREE.MeshBasicMaterial["onBeforeCompile"];

  material.needsUpdate = true;
};

export const updateDeformationTime = (
  material: THREE.MeshBasicMaterial,
  time: number
): void => {
  const shader = (material as DeformableMaterial).userData.shader;
  if (shader?.uniforms.uTime) {
    shader.uniforms.uTime.value = time;
  }
};

export const getDeformationState = (
  material: THREE.MeshBasicMaterial
): {
  type: DeformationType;
  uTime: number;
  uIntensity: number;
  uSpeed: number;
  uFrequency: number;
  uSeed: number;
} | null => {
  const deformable = material as DeformableMaterial;
  const shader = deformable.userData.shader;
  const config = deformable.userData.deformationConfig;
  if (!shader || !config) {
    return null;
  }

  return {
    type: config.type,
    uTime: Number(shader.uniforms.uTime?.value ?? 0),
    uIntensity: Number(shader.uniforms.uIntensity?.value ?? config.intensity),
    uSpeed: Number(shader.uniforms.uSpeed?.value ?? config.speed ?? 1),
    uFrequency: Number(shader.uniforms.uFrequency?.value ?? config.frequency ?? 1),
    uSeed: Number(shader.uniforms.uSeed?.value ?? config.seed ?? 0)
  };
};
