import {GPU_BLUR_SHADER} from "./blur";
import {GPU_LIGHTING_SHADER} from "./lighting";

export const GPU_AUGMENTATION_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const GPU_AUGMENTATION_FRAGMENT_SHADER = `
precision highp float;

#define MAX_GPU_LAYERS 32

uniform vec2 uResolution;
uniform int uLayerCount;
uniform vec4 uLayerTransforms[MAX_GPU_LAYERS];
uniform vec4 uLayerOpacityDepth[MAX_GPU_LAYERS];
uniform vec4 uCameraTransform;
uniform float uGlowStrength;
uniform float uBlurRadius;
uniform float uLightingStrength;

varying vec2 vUv;

${GPU_BLUR_SHADER}
${GPU_LIGHTING_SHADER}

void main() {
  vec2 safeResolution = max(uResolution, vec2(1.0));
  float aspect = safeResolution.x / safeResolution.y;
  vec3 color = vec3(0.0);
  float alpha = 0.0;

  for (int index = 0; index < MAX_GPU_LAYERS; index += 1) {
    if (index >= uLayerCount) {
      break;
    }

    vec4 transform = uLayerTransforms[index];
    vec4 opacityDepth = uLayerOpacityDepth[index];
    vec2 center = vec2(0.5) + vec2(transform.x / safeResolution.x, -transform.y / safeResolution.y) * 0.34;
    vec2 delta = (vUv - center) * vec2(aspect, 1.0);
    float radius = 0.16 * clamp(transform.z, 0.42, 2.4);
    float glow = gpuSoftGlow(length(delta), radius, uBlurRadius) * opacityDepth.x;
    float depth = clamp(opacityDepth.y / 100.0, 0.0, 1.0);
    float kind = opacityDepth.z;
    vec3 base = mix(vec3(0.32, 0.58, 1.0), vec3(1.0, 0.74, 0.42), depth);

    if (kind > 1.5) {
      base = mix(base, vec3(0.76, 0.92, 1.0), 0.32);
    }

    color += gpuDepthLight(base, depth, uLightingStrength) * glow;
    alpha += glow * 0.3;
  }

  float cameraLift = clamp(uCameraTransform.z - 1.0, 0.0, 0.55);
  color += vec3(0.12, 0.18, 0.28) * cameraLift * uLightingStrength;
  gl_FragColor = vec4(color, clamp(alpha * uGlowStrength + cameraLift * 0.08, 0.0, 0.62));
}
`;
