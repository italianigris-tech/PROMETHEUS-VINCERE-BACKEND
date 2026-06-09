// packages/registry/src/primitives/shader-fx/chromatic-aberration-per-element-v1/src/shader.frag
precision mediump float;

varying vec2 vUv;
uniform sampler2D uTexture;
uniform float uIntensity;
uniform float uAngle;

void main() {
  float rad = radians(uAngle);
  vec2 offset = vec2(cos(rad), sin(rad)) * uIntensity;

  vec4 r = texture2D(uTexture, vUv + offset);
  vec4 g = texture2D(uTexture, vUv);
  vec4 b = texture2D(uTexture, vUv - offset);

  gl_FragColor = vec4(r.r, g.g, b.b, g.a);
}
