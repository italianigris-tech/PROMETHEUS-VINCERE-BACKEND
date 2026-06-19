import type {
  AdapterTranscriptWord,
  Frames,
  FramesPerSecond,
  Milliseconds,
  PrometheusSchemaAdapterIssue,
  PrometheusSchemaAdapterIssueCode,
  PrometheusSchemaAdapterIssueSeverity
} from "./types";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const readRecord = (record: Record<string, unknown>, key: string): Record<string, unknown> | null => {
  const value = record[key];
  return isRecord(value) ? value : null;
};

export const readString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

export const readFiniteNumber = (record: Record<string, unknown>, key: string): number | null => {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export const createAdapterIssue = ({
  code,
  severity,
  path,
  message
}: {
  code: PrometheusSchemaAdapterIssueCode;
  severity: PrometheusSchemaAdapterIssueSeverity;
  path: string;
  message: string;
}): PrometheusSchemaAdapterIssue => ({code, severity, path, message});

export const msToFrames = (durationMs: Milliseconds, fps: FramesPerSecond): Frames => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(`durationMs must be a positive finite number. Received: ${durationMs}`);
  }

  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error(`fps must be a positive finite number. Received: ${fps}`);
  }

  return Math.max(1, Math.round((durationMs / 1000) * fps));
};

export const framesToMs = (frames: Frames, fps: FramesPerSecond): Milliseconds => {
  if (!Number.isFinite(frames) || frames <= 0) {
    throw new Error(`frames must be a positive finite number. Received: ${frames}`);
  }

  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error(`fps must be a positive finite number. Received: ${fps}`);
  }

  return (frames / fps) * 1000;
};

const readWordText = (record: Record<string, unknown>): string | null =>
  readString(record, "text") ?? readString(record, "word");

const readWordStartMs = (record: Record<string, unknown>): number | null =>
  readFiniteNumber(record, "startMs") ?? readFiniteNumber(record, "start");

const readWordEndMs = (record: Record<string, unknown>): number | null =>
  readFiniteNumber(record, "endMs") ?? readFiniteNumber(record, "end");

export const normalizeTranscriptWords = (
  words: unknown,
  diagnostics: PrometheusSchemaAdapterIssue[] = []
): AdapterTranscriptWord[] => {
  if (!Array.isArray(words)) {
    if (words !== undefined) {
      diagnostics.push(createAdapterIssue({
        code: "invalid_type",
        severity: "warning",
        path: "words",
        message: "Transcript words must be an array; ignoring invalid value."
      }));
    }
    return [];
  }

  return words.flatMap((entry, index) => {
    if (!isRecord(entry)) {
      diagnostics.push(createAdapterIssue({
        code: "invalid_type",
        severity: "warning",
        path: `words.${index}`,
        message: "Transcript word entry must be an object; entry was skipped."
      }));
      return [];
    }

    const text = readWordText(entry);
    const startMs = readWordStartMs(entry);
    const endMs = readWordEndMs(entry);

    if (!text || startMs === null || endMs === null) {
      diagnostics.push(createAdapterIssue({
        code: "missing_field",
        severity: "warning",
        path: `words.${index}`,
        message: "Transcript word requires text/startMs/endMs; entry was skipped."
      }));
      return [];
    }

    if (endMs <= startMs) {
      diagnostics.push(createAdapterIssue({
        code: "invalid_time_range",
        severity: "warning",
        path: `words.${index}.endMs`,
        message: "Transcript word endMs must be greater than startMs; entry was skipped."
      }));
      return [];
    }

    const confidence = readFiniteNumber(entry, "confidence");
    const semanticTag = readString(entry, "semanticTag") ?? undefined;

    return [{
      text,
      startMs,
      endMs,
      confidence: confidence ?? undefined,
      semanticTag
    }];
  }).sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
};

export const splitTranscriptIntoEvenWords = ({
  transcript,
  durationMs
}: {
  transcript: string;
  durationMs: Milliseconds;
}): AdapterTranscriptWord[] => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(`durationMs must be a positive finite number. Received: ${durationMs}`);
  }

  const tokens = transcript.split(/\s+/).map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }

  const chunkMs = durationMs / tokens.length;
  return tokens.map((text, index) => {
    const startMs = Math.round(index * chunkMs);
    const endMs = Math.max(Math.round((index + 1) * chunkMs), startMs + 1);
    return {text, startMs, endMs};
  });
};

export const resolveTranscriptWords = ({
  explicitWords,
  transcript,
  durationMs,
  diagnostics = []
}: {
  explicitWords: unknown;
  transcript: string;
  durationMs: Milliseconds;
  diagnostics?: PrometheusSchemaAdapterIssue[];
}): AdapterTranscriptWord[] => {
  const normalized = normalizeTranscriptWords(explicitWords, diagnostics);
  if (normalized.length > 0) {
    return normalized;
  }

  const generated = splitTranscriptIntoEvenWords({transcript, durationMs});
  if (generated.length > 0) {
    diagnostics.push(createAdapterIssue({
      code: "normalization_applied",
      severity: "info",
      path: "words",
      message: "Generated even transcript word timings because no valid explicit words were provided."
    }));
  }

  return generated;
};