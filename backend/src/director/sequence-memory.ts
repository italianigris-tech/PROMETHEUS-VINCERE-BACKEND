export type SequenceState = "calm" | "building" | "saturated" | "recovering";

export interface SequenceMemory {
  state: SequenceState;
  intensityBudget: number;
  cumulativeEnergy: number[];
  lastBreatheFrame: number;
  lastEffectFrame: Map<string, number>;
}

const HIGH_ENERGY_THRESHOLD = 0.85;
const BUILDING_ENERGY_THRESHOLD = 0.65;
const RECENT_WINDOW = 300;
const BREATHE_COOLDOWN_FRAMES = 300;
const EFFECT_COOLDOWN_FRAMES = 450;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const recentAverage = (values: number[]) => {
  const window = values.slice(-RECENT_WINDOW);
  return window.reduce((sum, value) => sum + value, 0) / Math.max(1, window.length);
};

export function createMemory(): SequenceMemory {
  return {
    state: "calm",
    intensityBudget: 1,
    cumulativeEnergy: [],
    lastBreatheFrame: 0,
    lastEffectFrame: new Map(),
  };
}

export function updateMemory(
  memory: SequenceMemory,
  energy: number,
  frame: number,
  isCTA: boolean,
): SequenceMemory {
  const normalizedEnergy = clamp01(energy);

  memory.cumulativeEnergy.push(normalizedEnergy);

  if (normalizedEnergy >= HIGH_ENERGY_THRESHOLD) {
    memory.intensityBudget = clamp01(memory.intensityBudget - 0.05);
  }

  if (memory.state === "recovering") {
    if (normalizedEnergy < BUILDING_ENERGY_THRESHOLD && frame - memory.lastBreatheFrame > BREATHE_COOLDOWN_FRAMES) {
      memory.state = "calm";
    }
    return memory;
  }

  const recent = recentAverage(memory.cumulativeEnergy);

  if (memory.intensityBudget <= 0.05 || (isCTA && normalizedEnergy >= HIGH_ENERGY_THRESHOLD) || recent >= HIGH_ENERGY_THRESHOLD) {
    memory.state = "saturated";
    return memory;
  }

  if (recent >= BUILDING_ENERGY_THRESHOLD) {
    memory.state = "building";
    return memory;
  }

  memory.state = "calm";
  return memory;
}

export function shouldBreathe(memory: SequenceMemory, frame: number): boolean {
  const shouldRecover = memory.state === "saturated" && frame - memory.lastBreatheFrame > BREATHE_COOLDOWN_FRAMES;

  if (shouldRecover) {
    memory.state = "recovering";
    memory.lastBreatheFrame = frame;
    memory.intensityBudget = clamp01(memory.intensityBudget + 0.2);
  }

  return shouldRecover;
}

export function canUseEffect(memory: SequenceMemory, effect: string, frame: number): boolean {
  const lastUsed = memory.lastEffectFrame.get(effect);

  return lastUsed === undefined || frame - lastUsed >= EFFECT_COOLDOWN_FRAMES;
}

export function useEffect(memory: SequenceMemory, effect: string, frame: number): void {
  memory.lastEffectFrame.set(effect, frame);
  memory.intensityBudget = clamp01(memory.intensityBudget - 0.15);

  if (memory.intensityBudget <= 0.05) {
    memory.state = "saturated";
  }
}
