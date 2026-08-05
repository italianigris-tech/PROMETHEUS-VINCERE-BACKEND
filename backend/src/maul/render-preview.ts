const clampPreviewTime = (value: number, durationMs: number) =>
  Math.max(0, Math.min(durationMs - 1, Math.round(value)));

export const buildMaulPreviewSampleTimes = ({
  durationMs,
  compositionHolds,
}: {
  durationMs: number;
  compositionHolds: Array<{startMs: number; endMs: number}>;
}): number[] => {
  if (!Number.isInteger(durationMs) || durationMs <= 0) {
    throw new Error("A perceptual preview requires a positive integer duration.");
  }
  const candidates = [0, durationMs - 1];
  for (const hold of compositionHolds) {
    if (hold.endMs <= hold.startMs) continue;
    candidates.push(hold.startMs, (hold.startMs + hold.endMs) / 2);
  }
  return [...new Set(candidates.map((time) => clampPreviewTime(time, durationMs)))]
    .sort((left, right) => left - right);
};
