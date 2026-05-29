const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const easeRenderProgress = (easing: string | undefined, value: number): number => {
  const t = clamp01(value);
  const normalized = easing?.trim().toLowerCase() ?? "linear";

  if (normalized === "linear" || normalized === "none") {
    return t;
  }
  if (normalized === "power3.out") {
    return 1 - (1 - t) ** 3;
  }
  if (normalized === "power2.out" || normalized === "cubic-out" || normalized === "ease-out") {
    return 1 - (1 - t) ** 2;
  }
  if (normalized === "power2.in" || normalized === "quadratic-in" || normalized === "ease-in") {
    return t * t;
  }
  if (normalized === "power2.inout" || normalized === "ease-in-out") {
    return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  }
  if (normalized === "snappy" || normalized === "back-out") {
    const p = t - 1;
    return 1 + p * p * (2.4 * p + 1.4);
  }

  return t;
};

export const resolveRenderScalar = ({
  instruction,
  progress,
  fallback,
  defaultEasing
}: {
  instruction: number | {from: number; to: number; easing?: string} | undefined;
  progress: number;
  fallback: number;
  defaultEasing?: string;
}): number => {
  if (typeof instruction === "number") {
    return instruction;
  }
  if (!instruction) {
    return fallback;
  }

  const eased = easeRenderProgress(instruction.easing ?? defaultEasing, progress);
  return instruction.from + (instruction.to - instruction.from) * eased;
};
