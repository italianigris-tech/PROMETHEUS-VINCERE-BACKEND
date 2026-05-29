export const GPU_LIGHTING_SHADER = `
vec3 gpuDepthLight(vec3 baseColor, float depth, float strength) {
  float rim = mix(0.82, 1.22, clamp(depth, 0.0, 1.0));
  vec3 warmLift = vec3(1.0, 0.82, 0.58) * strength * 0.18;
  vec3 coolLift = vec3(0.44, 0.68, 1.0) * strength * 0.14;
  return baseColor * rim + mix(coolLift, warmLift, depth);
}
`;
