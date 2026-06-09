import * as THREE from "three";

export type DeformationType = "explode" | "wave" | "ripple" | "shatter" | "none";

export type DeformationConfig = {
  type: DeformationType;
  intensity: number;
  speed?: number;
  frequency?: number;
  seed?: number;
};

export type DeformationShader = {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, THREE.IUniform>;
};

export type DeformableMaterial = THREE.MeshBasicMaterial & {
  userData: {
    shader?: DeformationShader;
    deformationConfig?: DeformationConfig;
  };
};

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
uniform int uDeformType;
uniform float uTime;
uniform float uIntensity;
uniform float uSpeed;
uniform float uFrequency;
uniform float uSeed;

float deformRand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 applyGlyphLocalDeformation(vec3 localPosition, vec3 localNormal, float glyphIndex) {
  if (uDeformType == 0 || uIntensity <= 0.0) {
    return localPosition;
  }

  float t = uTime * uSpeed;
  float glyphSeed = deformRand(vec2(glyphIndex, uSeed));

  if (uDeformType == 1) {
    vec3 direction = normalize(localPosition + vec3(0.001));
    float pulse = 0.65 + 0.35 * sin(t * 3.0 + glyphSeed * 6.2831853);
    return localPosition + direction * uIntensity * pulse;
  }

  if (uDeformType == 2) {
    float wave = sin(localPosition.x * uFrequency + t + glyphIndex * 0.23);
    return localPosition + vec3(0.0, wave * uIntensity * 0.35, 0.0);
  }

  if (uDeformType == 3) {
    float distanceFromCenter = length(localPosition.xy);
    float ripple = sin(distanceFromCenter * uFrequency * 5.0 - t * 3.0);
    return localPosition + localNormal * ripple * uIntensity * 0.3;
  }

  if (uDeformType == 4) {
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

export const injectVertexDeformation = (
  material: THREE.MeshBasicMaterial,
  config: DeformationConfig
): void => {
  const deformable = material as DeformableMaterial;
  const intensity = Math.min(1, Math.max(0, config.intensity));
  deformable.userData.deformationConfig = {...config, intensity};

  material.onBeforeCompile = (shader: DeformationShader) => {
    shader.uniforms.uDeformType = {value: typeToInt(config.type)};
    shader.uniforms.uTime = {value: 0};
    shader.uniforms.uIntensity = {value: intensity};
    shader.uniforms.uSpeed = {value: config.speed ?? 1};
    shader.uniforms.uFrequency = {value: config.frequency ?? 1};
    shader.uniforms.uSeed = {value: config.seed ?? 0};

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
${DEFORMATION_GLSL}
transformed = applyGlyphLocalDeformation(transformed, normal, float(gl_InstanceID));`
    );
    deformable.userData.shader = shader;
  };

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
