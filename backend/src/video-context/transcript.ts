import type {TranscribedWord} from "../schemas";

export type TranscriptChunkPlan = {
  id: string;
  index: number;
  startMs: number;
  endMs: number;
  offsetMs: number;
  parallelGroup: number;
};

export type TranscriptChunkResult = {
  chunkId: string;
  index: number;
  offsetMs: number;
  words: TranscribedWord[];
};

export const DEFAULT_TRANSCRIPT_CHUNK_SIZE_MS = 10 * 60 * 1000;
export const DEFAULT_TRANSCRIPT_OVERLAP_MS = 5000;
export const DEFAULT_TRANSCRIPT_MAX_PARALLEL = 5;

const padChunkIndex = (index: number): string => String(index).padStart(4, "0");

export const planTranscriptChunks = ({
  durationMs,
  chunkSizeMs = DEFAULT_TRANSCRIPT_CHUNK_SIZE_MS,
  overlapMs = DEFAULT_TRANSCRIPT_OVERLAP_MS,
  maxParallel = DEFAULT_TRANSCRIPT_MAX_PARALLEL
}: {
  durationMs: number;
  chunkSizeMs?: number;
  overlapMs?: number;
  maxParallel?: number;
}): TranscriptChunkPlan[] => {
  const safeDurationMs = Math.max(1, Math.ceil(durationMs));
  const safeChunkSizeMs = Math.max(1, Math.ceil(chunkSizeMs));
  const safeOverlapMs = Math.max(0, Math.min(Math.ceil(overlapMs), safeChunkSizeMs - 1));
  const safeMaxParallel = Math.max(1, Math.floor(maxParallel));
  const chunks: TranscriptChunkPlan[] = [];
  let index = 0;
  let logicalStartMs = 0;

  while (logicalStartMs < safeDurationMs) {
    const startMs = index === 0 ? 0 : Math.max(0, logicalStartMs - safeOverlapMs);
    const endMs = Math.min(safeDurationMs, logicalStartMs + safeChunkSizeMs);
    chunks.push({
      id: `chunk_${padChunkIndex(index)}`,
      index,
      startMs,
      endMs,
      offsetMs: startMs,
      parallelGroup: index % safeMaxParallel
    });

    if (endMs >= safeDurationMs) {
      break;
    }

    logicalStartMs += safeChunkSizeMs;
    index += 1;
  }

  return chunks;
};

const normalizeWordText = (value: string): string => value.trim().toLowerCase();

const isDuplicateOverlapWord = (
  candidate: TranscribedWord,
  accepted: TranscribedWord[]
): boolean => {
  const normalizedText = normalizeWordText(candidate.text);
  return accepted.some((word) => {
    if (normalizeWordText(word.text) !== normalizedText) {
      return false;
    }
    const startDistance = Math.abs(word.start_ms - candidate.start_ms);
    const endDistance = Math.abs(word.end_ms - candidate.end_ms);
    return startDistance <= DEFAULT_TRANSCRIPT_OVERLAP_MS && endDistance <= DEFAULT_TRANSCRIPT_OVERLAP_MS;
  });
};

export const mergeTranscriptChunkResults = (results: TranscriptChunkResult[]): TranscribedWord[] => {
  const shifted = results
    .flatMap((result) =>
      result.words.map((word) => ({
        ...word,
        text: word.text.trim(),
        start_ms: Math.max(0, Math.round(word.start_ms + result.offsetMs)),
        end_ms: Math.max(0, Math.round(word.end_ms + result.offsetMs))
      }))
    )
    .filter((word) => word.text.length > 0 && word.end_ms > word.start_ms)
    .sort((left, right) => left.start_ms - right.start_ms || left.end_ms - right.end_ms);

  const merged: TranscribedWord[] = [];
  for (const word of shifted) {
    if (isDuplicateOverlapWord(word, merged)) {
      continue;
    }
    merged.push(word);
  }

  return merged;
};
