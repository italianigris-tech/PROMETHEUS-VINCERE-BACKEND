export type ForegroundTypographyChunk = {
  chunkId: string;
  semanticRole: string;
  emphasis: {level: "support" | "key" | "hero"};
  outputStartMs: number;
};

export type MaulTypographyCoverageMode = "selective" | "full";

const foregroundRoles = new Set([
  "hook",
  "claim",
  "contrast",
  "transition",
  "proof",
  "payoff",
  "cta",
]);

const emphasisPriority = {
  support: 0,
  key: 1,
  hero: 2,
} as const;

export const selectForegroundTypographyChunkIds = (
  chunks: readonly ForegroundTypographyChunk[],
  coverageMode: MaulTypographyCoverageMode = "selective",
): string[] => {
  if (coverageMode === "full") {
    return [...chunks]
      .sort(
        (left, right) =>
          left.outputStartMs - right.outputStartMs ||
          left.chunkId.localeCompare(right.chunkId),
      )
      .map((chunk) => chunk.chunkId);
  }
  const selected = chunks.filter((chunk) => foregroundRoles.has(chunk.semanticRole));
  if (selected.length > 0) {
    return selected
      .sort((left, right) => left.outputStartMs - right.outputStartMs)
      .map((chunk) => chunk.chunkId);
  }
  const strongest = [...chunks].sort(
    (left, right) =>
      emphasisPriority[right.emphasis.level] - emphasisPriority[left.emphasis.level] ||
      left.outputStartMs - right.outputStartMs ||
      left.chunkId.localeCompare(right.chunkId),
  )[0];
  return strongest ? [strongest.chunkId] : [];
};
