export type SequenceMemoryState = "calm" | "building" | "saturated" | "recovering";

export interface SequenceMemory {
  state: SequenceMemoryState;
  intensityBudget: number;
  sustainedIntensityFrames: number;
  recoveryFrames: number;
  lastEffectFrameById: Record<string, number>;
}

const SATURATION_FRAMES = 1_000;
const BUILDING_FRAMES = 300;
const RECOVERY_FRAMES = 180;
const EFFECT_COOLDOWN_FRAMES = 450;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const createMemory = (): SequenceMemory => ({
  state: "calm",
  intensityBudget: 1,
  sustainedIntensityFrames: 0,
  recoveryFrames: 0,
  lastEffectFrameById: {},
});

export const updateMemory = (
  memory: SequenceMemory,
  intensity: number,
  frame: number,
  breatheUsed: boolean,
): SequenceMemory => {
  const normalizedIntensity = clamp01(intensity);
  const highIntensity = normalizedIntensity >= 0.7;
  const sustainedIntensityFrames = breatheUsed
    ? 0
    : highIntensity
      ? memory.sustainedIntensityFrames + 1
      : Math.max(0, memory.sustainedIntensityFrames - 8);
  const recoveryFrames = memory.state === "recovering" && !breatheUsed ? memory.recoveryFrames + 1 : breatheUsed ? 0 : memory.recoveryFrames;
  let state: SequenceMemoryState = memory.state;

  if (breatheUsed) {
    state = "recovering";
  } else if (state === "recovering") {
    state = recoveryFrames >= RECOVERY_FRAMES && normalizedIntensity < 0.65 ? "calm" : "recovering";
  } else if (sustainedIntensityFrames >= SATURATION_FRAMES) {
    state = "saturated";
  } else if (sustainedIntensityFrames >= BUILDING_FRAMES) {
    state = "building";
  } else {
    state = "calm";
  }

  const budgetDelta = state === "recovering"
    ? 0.004
    : normalizedIntensity >= 0.7
      ? -0.003
      : 0.002;
  const intensityBudget = clamp01(memory.intensityBudget + budgetDelta);

  return {
    ...memory,
    state,
    intensityBudget,
    sustainedIntensityFrames,
    recoveryFrames,
    lastEffectFrameById: {...memory.lastEffectFrameById},
  };
};

export const shouldBreathe = (memory: SequenceMemory, _frame: number): boolean => {
  if (memory.state === "saturated") {
    memory.state = "recovering";
    memory.recoveryFrames = 0;
    memory.intensityBudget = Math.max(memory.intensityBudget, 0.35);
    return true;
  }

  return memory.intensityBudget <= 0.12;
};

export const canUseEffect = (memory: SequenceMemory, effectId: string, frame: number): boolean => {
  const lastFrame = memory.lastEffectFrameById[effectId];
  return lastFrame === undefined || frame - lastFrame >= EFFECT_COOLDOWN_FRAMES;
};

export const useEffect = (memory: SequenceMemory, effectId: string, frame: number): SequenceMemory => {
  memory.lastEffectFrameById[effectId] = frame;
  return memory;
};
