export const GPU_BLUR_SHADER = `
float gpuSoftGlow(float distanceFromCenter, float radius, float softness) {
  float safeSoftness = max(softness, 0.001);
  float inner = max(radius - safeSoftness, 0.0);
  float glow = 1.0 - smoothstep(inner, radius + safeSoftness, distanceFromCenter);
  return clamp(glow, 0.0, 1.0);
}
`;
