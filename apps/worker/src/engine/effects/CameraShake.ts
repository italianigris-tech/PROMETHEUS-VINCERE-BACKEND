import gsap from "gsap";
import * as THREE from "three";

export type CameraShakeDecay = "elastic" | "exponential" | "linear";

export type ChromaticAberrationPassLike = {
  uniforms: Record<string, {value: number} | undefined>;
};

export type CameraShakeParams = {
  intensity: number;
  duration: number;
  decay: CameraShakeDecay;
  frequency?: number;
  axisBias?: [number, number];
  rotationFactor?: number;
  caSpike?: number;
};

export type CameraShakeOptions = {
  sampleRate?: number;
  seed?: number;
};

const DEFAULT_SAMPLE_RATE = 60;

const hash = (seed: number): number => {
  const value = Math.sin(seed * 12.9898) * 43758.5453123;
  return value - Math.floor(value);
};

const signedHash = (seed: number): number => hash(seed) * 2 - 1;

const envelopeFor = (
  decay: CameraShakeDecay,
  progress: number,
  frequency: number
): number => {
  switch (decay) {
    case "elastic":
      return Math.exp(-progress * 5) * Math.abs(Math.sin(progress * frequency * Math.PI * 2));
    case "exponential":
      return Math.exp(-progress * 5);
    case "linear":
      return 1 - progress;
    default:
      return 1 - progress;
  }
};

const caUniform = (pass: ChromaticAberrationPassLike | null): {value: number} | null =>
  pass?.uniforms.amount ?? pass?.uniforms.uIntensity ?? pass?.uniforms.intensity ?? null;

export class CameraShakeEngine {
  public trajectory = new Float32Array(0);
  public sampleCount = 0;

  private readonly cameraRig: THREE.Object3D;
  private readonly caPass: ChromaticAberrationPassLike | null;
  private readonly sampleRate: number;
  private readonly seed: number;
  private activeTimeline: gsap.core.Timeline | null = null;

  constructor(
    cameraRig: THREE.Object3D,
    caPass: ChromaticAberrationPassLike | null = null,
    options: CameraShakeOptions = {}
  ) {
    this.cameraRig = cameraRig;
    this.caPass = caPass;
    this.sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
    this.seed = options.seed ?? 1;
  }

  shake(params: CameraShakeParams): gsap.core.Timeline {
    this.stop();
    this.precomputeTrajectory(params);

    const ca = caUniform(this.caPass);
    const caState = {amount: 0};
    const timeline = gsap.timeline({paused: true});
    const peakTime = Math.max(params.duration * 0.3, 0.0001);
    const endTime = Math.max(params.duration, peakTime + 0.0001);

    if (ca) {
      timeline.to(caState, {
        amount: params.caSpike ?? 0.02,
        duration: peakTime,
        ease: "power2.out",
        onUpdate: () => {
          ca.value = caState.amount;
        }
      }, 0);
      timeline.to(caState, {
        amount: 0,
        duration: Math.max(endTime - peakTime, 0.0001),
        ease: "power2.out",
        onUpdate: () => {
          ca.value = caState.amount;
        }
      }, peakTime);
    }

    this.activeTimeline = timeline;
    return timeline;
  }

  stop(): void {
    this.activeTimeline?.kill();
    this.activeTimeline = null;
    this.cameraRig.position.set(0, 0, 0);
    this.cameraRig.rotation.z = 0;
    const ca = caUniform(this.caPass);
    if (ca) {
      ca.value = 0;
    }
  }

  update(time: number): void {
    if (this.sampleCount === 0) {
      return;
    }

    const frameIndex = Math.min(
      Math.max(0, Math.floor(time * this.sampleRate)),
      this.sampleCount - 1
    );
    const offset = frameIndex * 3;
    this.cameraRig.position.x = this.trajectory[offset] ?? 0;
    this.cameraRig.position.y = this.trajectory[offset + 1] ?? 0;
    this.cameraRig.rotation.z = this.trajectory[offset + 2] ?? 0;
  }

  private precomputeTrajectory(params: CameraShakeParams): void {
    const sampleCount = Math.max(1, Math.round(params.duration * this.sampleRate));
    const trajectory = new Float32Array(sampleCount * 3);
    const axisBias = params.axisBias ?? [1, 1];
    const rotationFactor = params.rotationFactor ?? 0.1;
    const frequency = params.frequency ?? 8;

    for (let frame = 0; frame < sampleCount; frame += 1) {
      const progress = sampleCount <= 1 ? 1 : frame / (sampleCount - 1);
      const envelope = envelopeFor(params.decay, progress, frequency);
      const xNoise = params.decay === "exponential" ? 1 : signedHash(this.seed + frame * 3 + 1);
      const yNoise = params.decay === "exponential" ? 1 : signedHash(this.seed + frame * 3 + 2);
      const rNoise = params.decay === "exponential" ? 1 : signedHash(this.seed + frame * 3 + 3);
      const offset = frame * 3;
      trajectory[offset] = params.intensity * axisBias[0] * envelope * xNoise;
      trajectory[offset + 1] = params.intensity * axisBias[1] * envelope * yNoise;
      trajectory[offset + 2] = params.intensity * rotationFactor * envelope * rNoise;
    }

    this.sampleCount = sampleCount;
    this.trajectory = trajectory;
  }
}

export default CameraShakeEngine;
