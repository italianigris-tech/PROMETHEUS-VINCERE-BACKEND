/**
 * Park-Miller Linear Congruential Generator (LCG).
 * Deterministic: same seed → same infinite sequence.
 * Replaces Math.random() in EVERY render-path file.
 */

export function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;

  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function seededInt(
  rng: () => number,
  min: number,
  max: number
): number {
  return Math.floor(rng() * (max - min)) + min;
}

export function seededFloat(
  rng: () => number,
  min: number,
  max: number
): number {
  return min + rng() * (max - min);
}

export function seededPick<T>(rng: () => number, arr: readonly T[]): T {
  if (arr.length === 0) {
    throw new Error("seededPick: cannot pick from empty array");
  }
  const idx = seededInt(rng, 0, arr.length);
  const value = arr[idx];
  if (value === undefined) {
    throw new Error(`seededPick: index ${idx} out of bounds (length: ${arr.length})`);
  }
  return value;
}


export function seededChance(rng: () => number, probability: number): boolean {
  return rng() < probability;
}

export function hashSeed(a: number, b: number): number {
  let hash = 2166136261;
  hash ^= a;
  hash *= 16777619;
  hash ^= b;
  hash *= 16777619;
  return Math.abs(hash % 2147483646) + 1;
}
