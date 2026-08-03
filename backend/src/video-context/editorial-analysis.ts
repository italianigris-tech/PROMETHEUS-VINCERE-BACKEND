import type {ProgressiveVideoContextSnapshot} from "./contracts";

const toTimecode = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
};

export const buildEditorialAnalysis = (
  snapshot: ProgressiveVideoContextSnapshot,
  generatedAt: string
): ProgressiveVideoContextSnapshot["editorialAnalysis"] => {
  const durationMs = snapshot.metadata.durationMs ?? 0;
  const words = snapshot.transcript.mergedWords.length;
  const wordsPerMinute = durationMs > 0 && words > 0
    ? Math.round((words / durationMs) * 60_000)
    : null;
  const pacing = wordsPerMinute === null
    ? "unknown" as const
    : wordsPerMinute < 105
      ? "slow" as const
      : wordsPerMinute > 165
        ? "fast" as const
        : "balanced" as const;
  const motionIntensity = snapshot.motion.segments.length > 0
    ? Number((snapshot.motion.segments.reduce((sum, segment) => sum + segment.intensity, 0) / snapshot.motion.segments.length).toFixed(2))
    : null;
  const firstRange: [number, number] | undefined = durationMs > 0
    ? [0, Math.min(durationMs, 12_000)]
    : undefined;
  const summaryParts = [
    durationMs > 0 ? `${toTimecode(durationMs)} source` : "Source video",
    snapshot.metadata.aspectRatio ? `${snapshot.metadata.aspectRatio} frame` : null,
    wordsPerMinute !== null ? `${wordsPerMinute} spoken words per minute (${pacing} delivery)` : null,
    motionIntensity !== null ? `visual energy ${Math.round(motionIntensity * 100)}%` : null,
    words > 0 ? `${words} timestamped transcript words` : "transcript is unavailable"
  ].filter((part): part is string => Boolean(part));

  return {
    generatedAt,
    summary: summaryParts.join(" · "),
    pacing,
    wordsPerMinute,
    motionIntensity,
    recommendations: [
      {
        id: "hook",
        title: "Make the opening earn the next second",
        rationale: wordsPerMinute !== null && wordsPerMinute < 105
          ? "The spoken delivery is measured; start on the clearest payoff or strongest visual before settling into the explanation."
          : "Use the clearest promise or most energetic visual inside the first 12 seconds to establish the edit's direction.",
        ...(firstRange ? {rangeMs: firstRange} : {})
      },
      {
        id: "cut-rhythm",
        title: pacing === "fast" ? "Leave room for key lines" : "Match cuts to the delivery",
        rationale: pacing === "fast"
          ? "Avoid stacking every visual change on top of dense dialogue; reserve breathing room around the strongest phrases."
          : pacing === "slow"
            ? "Use purposeful B-roll, punch-ins, or text beats between key ideas so the visual rhythm carries the slower delivery."
            : "Let sentence turns and motion changes drive cuts; the current cadence supports a clean, deliberate rhythm."
      },
      {
        id: "captions",
        title: "Caption the message, not every breath",
        rationale: words > 0
          ? "Use the timestamped transcript for phrase-level captions and emphasize only the words that carry the promise, contrast, or call to action."
          : "Generate captions once a transcript is available; until then, avoid committing to word-timed typography."
      }
    ]
  };
};