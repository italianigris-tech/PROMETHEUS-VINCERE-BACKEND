import type {DeformationConfig} from "@prometheus/shared-types";
import * as THREE from "three";

/**
 * Vertex Deformation Engine
 * Injects custom vertex shader code into Troika text materials via onBeforeCompile.
 * Enables per-glyph deformation: explode, wave, ripple, shatter.
 *
 * Troika renders text as InstancedBufferGeometry with one draw call per glyph.
 * We use gl_InstanceID to identify individual glyphs in the vertex shader.
 */

/**
 * Shader object passed to onBeforeCompile.
 * Contains vertexShader, fragmentShader, and uniforms that can be modified.
 */
interface CompiledShader {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, THREE.IUniform>;
}

/**
 * Extended material type that stores the compiled shader reference.
 * This allows per-frame uniform updates after onBeforeCompile fires once.
 */
export interface DeformableMaterial extends THREE.MeshBasicMaterial {
  userData: {
    shader?: CompiledShader;
    deformationConfig?: DeformationConfig;
  };
}

/**
 * Maps deformation type string to integer for GLSL branching.
 */
function typeToInt(type: string): number {
  const map: Record<string, number> = {
    none: 0,
    explode: 1,
    wave: 2,
    ripple: 3,
    shatter: 4,
  };
  return map[type] ?? 0;
}

/**
 * GLSL deformation function injected into the vertex shader.
 * Uses gl_InstanceID for per-glyph variation.
 */
const DEFORMATION_GLSL = `
  // Prometheus Phase 7: Vertex Deformation Engine
  uniform int uDeformType;
  uniform float uIntensity;
  uniform float uFrequency;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSeed;

  // Pseudo-random function for shatter direction
  float deformRand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // Simple noise for wave modulation
  float deformNoise(vec3 p) {
    return sin(p.x * uFrequency + uTime * uSpeed) * cos(p.y * uFrequency + uTime * uSpeed * 0.7);
  }

  vec3 applyPrometheusDeformation(vec3 position, vec3 normal, vec2 uv, float instanceId) {
    if (uDeformType == 0 || uIntensity < 0.001) return position;

    float glyphSeed = deformRand(vec2(instanceId, uSeed));

    // EXPLODE: Push vertices outward from glyph center
    if (uDeformType == 1) {
      vec3 center = vec3(0.0);
      vec3 dir = normalize(position - center + vec3(0.001));
      float dist = length(position - center);
      float explodeAmount = uIntensity * (1.0 + sin(uTime * uSpeed * 2.0 + dist * 5.0));
      return position + dir * explodeAmount * 0.5;
    }

    // WAVE: Sinusoidal displacement along Y axis
    if (uDeformType == 2) {
      float wave = sin(position.x * uFrequency + uTime * uSpeed) * uIntensity * 0.3;
      wave += deformNoise(position) * uIntensity * 0.1;
      return position + vec3(0.0, wave, 0.0);
    }

    // RIPPLE: Concentric wave from center
    if (uDeformType == 3) {
      float dist = length(position.xy);
      float ripple = sin(dist * uFrequency - uTime * uSpeed * 3.0);
      ripple *= exp(-dist * 0.15) * uIntensity * 0.4;
      return position + normal * ripple;
    }

    // SHATTER: Per-glyph random offset with temporal fade
    if (uDeformType == 4) {
      vec3 offset = vec3(
        sin(glyphSeed * 6.2832) * uIntensity,
        cos(glyphSeed * 6.2832) * uIntensity,
        (glyphSeed - 0.5) * uIntensity * 2.0
      );
      float fade = smoothstep(0.0, 1.0, uTime * uSpeed * 0.5);
      return position + offset * fade;
    }

    return position;
  }
`;

/**
 * Injects vertex deformation into a Troika text material.
 *
 * @param material - The MeshBasicMaterial used by Troika text mesh
 * @param config - Deformation configuration (type, intensity, frequency, speed, seed)
 *
 * Usage:
 *   injectVertexDeformation(textMesh.material, { type: "explode", intensity: 0.5, ... });
 *
 * After injection, update uTime each frame via updateDeformationTime(material, time).
 */
export function injectVertexDeformation(
  material: THREE.MeshBasicMaterial,
  config: DeformationConfig
): void {
  const deformable = material as DeformableMaterial;
  deformable.userData.deformationConfig = config;

  material.onBeforeCompile = (shader: CompiledShader) => {
    // Store shader reference for per-frame uniform updates
    deformable.userData.shader = shader;

    // Add uniforms
    shader.uniforms.uDeformType = { value: typeToInt(config.type) };
    shader.uniforms.uIntensity = { value: config.intensity };
    shader.uniforms.uFrequency = { value: config.frequency };
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uSpeed = { value: config.speed };
    shader.uniforms.uSeed = { value: config.seed };

    // Inject deformation GLSL and apply it in the vertex shader
    // Troika's vertex shader uses standard Three.js shader chunks
    // We inject after <begin_vertex> which defines the 'transformed' variable
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      #include <begin_vertex>
      ${DEFORMATION_GLSL}
      transformed = applyPrometheusDeformation(
        transformed,
        normal,
        uv,
        float(gl_InstanceID)
      );
      `
    );
  };

  // Force shader recompilation
  material.needsUpdate = true;
}

/**
 * Updates the time uniform for an already-injected deformation.
 * Call this every frame in the animation loop.
 *
 * @param material - The material that had injectVertexDeformation called on it
 * @param time - Current elapsed time in seconds
 */
export function updateDeformationTime(
  material: THREE.MeshBasicMaterial,
  time: number
): void {
  const deformable = material as DeformableMaterial;
  const shader = deformable.userData.shader;
  if (shader?.uniforms?.uTime) {
    shader.uniforms.uTime.value = time;
  }
}

/**
 * Updates the intensity uniform for an already-injected deformation.
 * Useful for dynamically modulating deformation strength (e.g., based on audio transients).
 *
 * @param material - The material that had injectVertexDeformation called on it
 * @param intensity - New intensity value (0.0 - 1.0)
 */
export function updateDeformationIntensity(
  material: THREE.MeshBasicMaterial,
  intensity: number
): void {
  const deformable = material as DeformableMaterial;
  const shader = deformable.userData.shader;
  if (shader?.uniforms?.uIntensity) {
    shader.uniforms.uIntensity.value = Math.max(0, Math.min(1, intensity));
  }
}

/**
 * Checks if a material has vertex deformation injected.
 */
export function hasDeformation(material: THREE.MeshBasicMaterial): boolean {
  const deformable = material as DeformableMaterial;
  return deformable.userData.shader !== undefined;
}