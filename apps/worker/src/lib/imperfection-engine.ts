import type {ImperfectionConfig} from "@prometheus/shared-types";

/**
 * Result of applying imperfection to animation values.
 */
export interface ImperfectedValues {
  readonly duration: number;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly scale: number;
}

/**
 * Emotion multipliers for imperfection strength.
 * Higher values = more noise/chaos.
 */
const EMOTION_MULTIPLIERS: Readonly<Record<string, number>> = {
  tension: 1.3,
  explosion: 1.6,
  chaos: 1.9,
  release: 0.7,
  contemplation: 0.4,
  intimacy: 0.35,
  isolation: 0.6,
  aggressive: 1.4,
  gentle: 0.5
};

/**
 * Gets the emotion multiplier for a given emotion.
 * @param emotion - The emotion string
 * @returns The multiplier value (defaults to 1.0)
 */
function getEmotionMultiplier(emotion: string): number {
  return EMOTION_MULTIPLIERS[emotion] ?? 1.0;
}

/**
 * Normalizes a potentially undefined config, providing defaults for missing fields.
 */
function normalizeConfig(config: ImperfectionConfig): Required<ImperfectionConfig> {
  return {
    timingNoiseMs: config.timingNoiseMs ?? 0,
    spacingVariance: config.spacingVariance ?? 0,
    easingPerturbation: config.easingPerturbation ?? 0,
    rotationalDrift: config.rotationalDrift ?? 0
  };
}

/**
 * Applies bounded, emotion-aware noise to base animation values.
 * This is "strategic imperfection" — not random chaos, but emotion-modulated deviation.
 * 
 * @param config - The imperfection profile from Director's Notes
 * @param emotion - The current emotional beat's emotion string
 * @param baseValues - The pristine animation values before noise
 * @param randomFn - Optional random function (for testing determinism)
 * @returns ImperfectedValues with noise applied
 */
export function applyImperfection(
  config: ImperfectionConfig,
  emotion: string,
  baseValues: {
    readonly duration: number;
    readonly x: number;
    readonly y: number;
    readonly rotation: number;
    readonly scale?: number;
  },
  randomFn: () => number = Math.random
): ImperfectedValues {
  const normalizedConfig = normalizeConfig(config);
  const multiplier = getEmotionMultiplier(emotion);
  const baseScale = baseValues.scale ?? 1.0;
  
  // Apply noise with emotion multiplier
  const random = randomFn();
  
  // Duration: base + (random * timingNoiseMs * 0.001 * multiplier)
  const rawDuration = baseValues.duration + (random * normalizedConfig.timingNoiseMs * 0.001 * multiplier);
  const duration = Math.max(0.05, rawDuration);
  
  // X position: base + (random * spacingVariance * 40 * multiplier)
  const x = baseValues.x + (random * normalizedConfig.spacingVariance * 40 * multiplier);
  
  // Y position: base + (random * spacingVariance * 40 * multiplier)
  const y = baseValues.y + (random * normalizedConfig.spacingVariance * 40 * multiplier);
  
  // Rotation: base + (random * rotationalDrift * 20 * multiplier)
  const rotation = baseValues.rotation + (random * normalizedConfig.rotationalDrift * 20 * multiplier);
  
  // Scale: base + (random * spacingVariance * 0.05 * multiplier)
  const rawScale = baseScale + (random * normalizedConfig.spacingVariance * 0.05 * multiplier);
  const scale = Math.max(0.5, Math.min(2.0, rawScale));
  
  return {
    duration,
    x,
    y,
    rotation,
    scale
  };
}