// packages/registry/src/primitives/shader-fx/chromatic-aberration-per-element-v1/src/fbo-compositor.ts
import {
  WebGLRenderTarget,
  ShaderMaterial,
  OrthographicCamera,
  Scene,
  Mesh,
  PlaneGeometry,
  Vector2,
  RGBAFormat,
  LinearFilter,
} from "three";
import type { WebGLRenderer, Object3D } from "three";

const CA_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CA_FRAGMENT = `
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
`;

export interface CAParams {
  intensity: number;
  angle: number;
}

export const defaultCAParams: CAParams = {
  intensity: 0.015,
  angle: 45,
};

export class CACompositor {
  private renderTarget: WebGLRenderTarget;
  private material: ShaderMaterial;
  private scene: Scene;
  private camera: OrthographicCamera;
  private quad: Mesh;

  constructor(width: number, height: number) {
    this.renderTarget = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
    });

    this.material = new ShaderMaterial({
      vertexShader: CA_VERTEX,
      fragmentShader: CA_FRAGMENT,
      uniforms: {
        uTexture: { value: this.renderTarget.texture },
        uIntensity: { value: defaultCAParams.intensity },
        uAngle: { value: defaultCAParams.angle },
      },
      transparent: true,
    });

    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.scene.add(this.quad);
  }

  setSize(width: number, height: number): void {
    this.renderTarget.setSize(width, height);
  }

  updateParams(params: Partial<CAParams>): void {
    if (params.intensity !== undefined) {
      this.material.uniforms.uIntensity.value = params.intensity;
    }
    if (params.angle !== undefined) {
      this.material.uniforms.uAngle.value = params.angle;
    }
  }

  /**
   * Render the source object to the FBO, then render the CA quad to the screen.
   * This must be called within the main render loop.
   */
  render(renderer: WebGLRenderer, sourceObject: Object3D, camera: any): void {
    // Save state
    const originalBackground = renderer.getClearColor(new (THREE as any).Color());
    const originalAlpha = renderer.getClearAlpha();
    const originalAutoClear = renderer.autoClear;

    // Render source to FBO
    renderer.setRenderTarget(this.renderTarget);
    renderer.autoClear = true;
    renderer.clear();
    renderer.render(sourceObject, camera);

    // Restore state
    renderer.setRenderTarget(null);
    renderer.autoClear = originalAutoClear;

    // Render CA quad to screen (or to another target)
    // Note: In practice, this is composed by the parent scene
    renderer.render(this.scene, this.camera);
  }

  getTexture() {
    return this.renderTarget.texture;
  }

  getMaterial() {
    return this.material;
  }

  dispose(): void {
    this.renderTarget.dispose();
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}
