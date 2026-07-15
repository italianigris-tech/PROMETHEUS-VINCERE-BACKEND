import {existsSync} from "node:fs";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import {transcribeWithAssemblyAI} from "../integrations/assemblyai";
import type {TranscribedWord} from "../schemas";

export type JosephTranscriptSource =
  | "provided_file"
  | "assemblyai"
  | "fixture_words"
  | "fallback_prompt";

export type JosephTranscriptWord = {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
};

export type JosephTranscriptPayload = {
  words: JosephTranscriptWord[];
  phrases: Array<{
    startMs: number;
    endMs: number;
    text: string;
    words: JosephTranscriptWord[];
  }>;
  beats: number[];
  onsets: number[];
  energyCurve: number[];
  durationMs: number;
  source: JosephTranscriptSource;
  warnings: string[];
  trainableForIrl: boolean;
};

export type ResolveJosephTranscriptInput = {
  transcriptPath: string;
  sourceMediaPath: string;
  durationMs: number;
  promptText: string;
  assemblyAiApiKey?: string;
  /** When true, never invent prompt-based words for production renders. */
  requireSpeechTranscript?: boolean;
  transcribe?: typeof transcribeWithAssemblyAI;
};

export type ResolveJosephTranscriptResult = {
  path: string;
  payload: JosephTranscriptPayload;
};

const clampMs = (value: number, durationMs: number): number =>
  Math.max(0, Math.min(durationMs, Math.round(value)));

const groupPhrases = (words: JosephTranscriptWord[], durationMs: number): JosephTranscriptPayload["phrases"] => {
  if (words.length === 0) {
    return [];
  }

  const phrases: JosephTranscriptPayload["phrases"] = [];
  let bucket: JosephTranscriptWord[] = [];
  const flush = () => {
    if (bucket.length === 0) return;
    phrases.push({
      startMs: bucket[0]!.startMs,
      endMs: bucket[bucket.length - 1]!.endMs,
      text: bucket.map((word) => word.text).join(" "),
      words: bucket,
    });
    bucket = [];
  };

  for (const word of words) {
    const prev = bucket[bucket.length - 1];
    if (prev && word.startMs - prev.endMs > 450) {
      flush();
    }
    bucket.push(word);
    if (bucket.length >= 8) {
      flush();
    }
  }
  flush();

  if (phrases.length === 0) {
    return [{
      startMs: 0,
      endMs: Math.min(durationMs, 1000),
      text: words.map((word) => word.text).join(" "),
      words,
    }];
  }

  return phrases;
};

const toDirectorWords = (words: TranscribedWord[], durationMs: number): JosephTranscriptWord[] =>
  words
    .map((word) => ({
      text: word.text.trim(),
      startMs: clampMs(word.start_ms, durationMs),
      endMs: clampMs(Math.max(word.start_ms + 40, word.end_ms), durationMs),
      ...(typeof word.confidence === "number" ? {confidence: word.confidence} : {}),
    }))
    .filter((word) => word.text.length > 0 && word.endMs > word.startMs);

export const buildPromptFallbackTranscript = ({
  durationMs,
  promptText,
}: {
  durationMs: number;
  promptText: string;
}): JosephTranscriptPayload => {
  const safeDuration = Math.max(1000, durationMs);
  const words = promptText
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 12);
  const step = Math.max(250, Math.floor(safeDuration / Math.max(1, words.length + 1)));
  const transcriptWords: JosephTranscriptWord[] = words.length > 0
    ? words.map((word, index) => ({
      text: word,
      startMs: Math.min(safeDuration - 1, step * index),
      endMs: Math.min(safeDuration, step * index + Math.min(step - 50, 500)),
      confidence: 0.35,
    }))
    : [
      {text: "Joseph", startMs: 0, endMs: Math.min(safeDuration, 500), confidence: 0.35},
      {text: "edit", startMs: Math.min(safeDuration, 600), endMs: Math.min(safeDuration, 1000), confidence: 0.35},
    ];

  const phrases = groupPhrases(transcriptWords, safeDuration);
  const onsets = transcriptWords.map((word) => word.startMs);
  return {
    words: transcriptWords,
    phrases,
    beats: Array.from({length: Math.max(1, Math.floor(safeDuration / 500))}, (_, index) => index * 500),
    onsets,
    energyCurve: [0.42, 0.68, 0.78, 0.55, 0.74, 0.62],
    durationMs: safeDuration,
    source: "fallback_prompt",
    warnings: [
      "transcript_source_fallback_prompt",
      "irl_not_trainable_from_prompt_transcript",
      "speech_sync_unreliable",
    ],
    trainableForIrl: false,
  };
};

export const buildFixtureSpeechTranscript = (durationMs: number): JosephTranscriptPayload => {
  const safeDuration = Math.max(1000, durationMs);
  const words: JosephTranscriptWord[] = [
    {text: "Listen", startMs: 200, endMs: 420, confidence: 0.98},
    {text: "closely", startMs: 520, endMs: 820, confidence: 0.97},
    {text: "this", startMs: 1200, endMs: 1400, confidence: 0.96},
    {text: "changes", startMs: 1500, endMs: 1900, confidence: 0.97},
    {text: "everything", startMs: 2000, endMs: 2500, confidence: 0.98},
    {text: "Move", startMs: Math.min(safeDuration - 4000, 3300), endMs: Math.min(safeDuration - 3700, 3600), confidence: 0.97},
    {text: "again", startMs: Math.min(safeDuration - 3400, 4300), endMs: Math.min(safeDuration - 3100, 4600), confidence: 0.96},
    {text: "Now", startMs: Math.max(0, safeDuration - 2000), endMs: Math.max(500, safeDuration - 1700), confidence: 0.98},
    {text: "act", startMs: Math.max(0, safeDuration - 1500), endMs: Math.max(600, safeDuration - 1200), confidence: 0.97},
  ].filter((word) => word.endMs <= safeDuration && word.startMs < word.endMs);

  const phrases = groupPhrases(words, safeDuration);
  return {
    words,
    phrases,
    beats: Array.from({length: Math.max(1, Math.floor(safeDuration / 500))}, (_, index) => index * 500),
    onsets: words.map((word) => word.startMs),
    energyCurve: [0.35, 0.78, 0.86, 0.48, 0.7, 0.82, 0.44, 0.76, 0.9],
    durationMs: safeDuration,
    source: "fixture_words",
    warnings: ["transcript_source_fixture_words"],
    trainableForIrl: false,
  };
};

const fromAssemblyAiWords = (
  words: TranscribedWord[],
  durationMs: number,
): JosephTranscriptPayload => {
  const directorWords = toDirectorWords(words, durationMs);
  if (directorWords.length === 0) {
    throw new Error("AssemblyAI returned zero usable words");
  }

  const phrases = groupPhrases(directorWords, durationMs);
  return {
    words: directorWords,
    phrases,
    beats: Array.from({length: Math.max(1, Math.floor(durationMs / 500))}, (_, index) => index * 500),
    onsets: directorWords.map((word) => word.startMs),
    energyCurve: [0.42, 0.68, 0.78, 0.55, 0.74, 0.62],
    durationMs,
    source: "assemblyai",
    warnings: [],
    trainableForIrl: true,
  };
};

const isMediaPath = (value: string): boolean => {
  if (!value || value.startsWith("file:///dev-fixtures")) return false;
  if (value.startsWith("file://")) {
    const local = value.replace(/^file:\/\//, "").replace(/^\/([A-Za-z]:)/, "$1");
    return existsSync(local);
  }
  return existsSync(value);
};

const mediaFilePath = (value: string): string => {
  if (value.startsWith("file://")) {
    return value.replace(/^file:\/\//, "").replace(/^\/([A-Za-z]:)/, "$1");
  }
  return value;
};

export const resolveJosephTranscript = async ({
  transcriptPath,
  sourceMediaPath,
  durationMs,
  promptText,
  assemblyAiApiKey,
  requireSpeechTranscript = false,
  transcribe = transcribeWithAssemblyAI,
}: ResolveJosephTranscriptInput): Promise<ResolveJosephTranscriptResult> => {
  await mkdir(path.dirname(transcriptPath), {recursive: true});

  if (existsSync(transcriptPath)) {
    const existing = JSON.parse(await readFile(transcriptPath, "utf8")) as Partial<JosephTranscriptPayload>;
    const words = Array.isArray(existing.words) ? existing.words : [];
    if (words.length > 0) {
      const payload: JosephTranscriptPayload = {
        words,
        phrases: Array.isArray(existing.phrases) && existing.phrases.length > 0
          ? existing.phrases as JosephTranscriptPayload["phrases"]
          : groupPhrases(words as JosephTranscriptWord[], durationMs),
        beats: Array.isArray(existing.beats) ? existing.beats as number[] : [],
        onsets: Array.isArray(existing.onsets) ? existing.onsets as number[] : words.map((word) => (word as JosephTranscriptWord).startMs),
        energyCurve: Array.isArray(existing.energyCurve) ? existing.energyCurve as number[] : [0.5],
        durationMs: typeof existing.durationMs === "number" ? existing.durationMs : durationMs,
        source: (existing.source as JosephTranscriptSource | undefined) ?? "provided_file",
        warnings: Array.isArray(existing.warnings) ? existing.warnings as string[] : [],
        trainableForIrl: existing.trainableForIrl === true || existing.source === "assemblyai",
      };
      return {path: transcriptPath, payload};
    }
  }

  const apiKey = (assemblyAiApiKey ?? process.env.ASSEMBLYAI_API_KEY ?? "").trim();
  if (apiKey && isMediaPath(sourceMediaPath)) {
    try {
      const words = await transcribe({
        filePath: mediaFilePath(sourceMediaPath),
        apiKey,
      });
      const payload = fromAssemblyAiWords(words, durationMs);
      await writeFile(transcriptPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      return {path: transcriptPath, payload};
    } catch (error) {
      if (requireSpeechTranscript) {
        throw error;
      }
    }
  }

  if (requireSpeechTranscript) {
    throw new Error(
      "Speech transcript required for Joseph production path. Provide transcriptPath words or ASSEMBLYAI_API_KEY + readable media.",
    );
  }

  // Tests and offline smoke may use fixture speech (timed, speech-like) instead of prompt mush.
  const useFixture = !promptText || promptText === "default joseph upload" || process.env.JOSEPH_TRANSCRIPT_FIXTURE === "1";
  const payload = useFixture
    ? buildFixtureSpeechTranscript(durationMs)
    : buildPromptFallbackTranscript({durationMs, promptText});

  if (!useFixture) {
    payload.warnings.push("prefer_assemblyai_or_provided_transcript");
  }

  await writeFile(transcriptPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return {path: transcriptPath, payload};
};
