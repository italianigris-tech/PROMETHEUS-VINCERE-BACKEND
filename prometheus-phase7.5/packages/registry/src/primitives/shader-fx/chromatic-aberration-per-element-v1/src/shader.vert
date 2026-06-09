// packages/registry/src/primitives/shader-fx/chromatic-aberration-per-element-v1/src/shader.vert
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
