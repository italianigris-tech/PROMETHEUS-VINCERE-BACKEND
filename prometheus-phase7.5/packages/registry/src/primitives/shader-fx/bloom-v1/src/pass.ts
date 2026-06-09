// packages/registry/src/primitives/shader-fx/bloom-v1/src/pass.ts
import { EffectComposer, RenderPass, UnrealBloomPass } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { WebGLRenderer, Scene, Camera } from "three";
import type { Vector2 } from "three";

export interface BloomParams {
  strength: number;
  radius: number;
  threshold: number;
}

export const defaultBloomParams: BloomParams = {
  strength: 0.4,
  radius: 0.5,
  threshold: 0.8,
};

export class BloomPassManager {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private renderPass: RenderPass;

  constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera, resolution?: Vector2) {
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    const res = resolution ?? renderer.getSize(new (THREE as any).Vector2());
    this.bloomPass = new UnrealBloomPass(res, defaultBloomParams.strength, defaultBloomParams.radius, defaultBloomParams.threshold);
    this.composer.addPass(this.bloomPass);
  }

  updateParams(params: Partial<BloomParams>): void {
    if (params.strength !== undefined) this.bloomPass.strength = params.strength;
    if (params.radius !== undefined) this.bloomPass.radius = params.radius;
    if (params.threshold !== undefined) this.bloomPass.threshold = params.threshold;
  }

  render(): void {
    this.composer.render();
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  dispose(): void {
    this.composer.dispose();
    this.renderPass.dispose();
    this.bloomPass.dispose();
  }

  getComposer(): EffectComposer {
    return this.composer;
  }
}

// Convenience hook for R3F integration
export function createBloomComposer(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  params?: Partial<BloomParams>
): BloomPassManager {
  const manager = new BloomPassManager(renderer, scene, camera);
  if (params) manager.updateParams(params);
  return manager;
}
