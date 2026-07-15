import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {execFile} from "node:child_process";
import {mkdir} from "node:fs/promises";
import path from "node:path";

import type {JosephTranscriptPayload, JosephTranscriptWord} from "./joseph-transcript";

export type JosephEditorialRole = "hook" | "benefit" | "reversal" | "pain" | "payoff";

export type JosephEditorialSegment = {
  role: JosephEditorialRole;
  sourceStartMs: number;
  sourceEndMs: number;
  outputStartMs: number;
  outputEndMs: number;
};

export type JosephEditorialPlan = {
  version: "joseph-editorial-v1";
  strategy: "assemblyai_narrative_arc";
  sourceDurationMs: number;
  outputDurationMs: number;
  removedDurationMs: number;
  segments: JosephEditorialSegment[];
};

export type JosephEditorialTranscript = JosephTranscriptPayload;

export type JosephEditorialMaterialization = {
  sourcePath: string;
  sourceSha256: string;
  derivedPath: string;
  derivedSha256: string;
  plan: JosephEditorialPlan;
  transcript: JosephTranscriptPayload;
};

export class JosephEditorialSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JosephEditorialSelectionError";
  }
}

const MIN_PROOF_DURATION_MS = 30_000;
const MAX_PROOF_DURATION_MS = 45_000;

const token = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const findIndex = (
  words: JosephTranscriptWord[],
  value: string,
  fromIndex = 0,
): number => words.findIndex((word, index) => index >= fromIndex && token(word.text) === value);

const requiredIndex = (
  words: JosephTranscriptWord[],
  value: string,
  fromIndex = 0,
): number => {
  const index = findIndex(words, value, fromIndex);
  if (index < 0) {
    throw new JosephEditorialSelectionError(`Missing narrative anchor in AssemblyAI transcript: ${value}`);
  }
  return index;
};

const includeLeadingConjunction = (words: JosephTranscriptWord[], index: number): number => {
  const previous = words[index - 1];
  return previous && ["and", "the"].includes(token(previous.text)) ? index - 1 : index;
};

const makeSegments = (
  sourceDurationMs: number,
  definitions: Array<{role: JosephEditorialRole; sourceStartMs: number; sourceEndMs: number}>,
): JosephEditorialPlan => {
  let outputCursorMs = 0;
  const segments = definitions.map((definition) => {
    if (
      definition.sourceStartMs < 0
      || definition.sourceEndMs > sourceDurationMs
      || definition.sourceEndMs <= definition.sourceStartMs
    ) {
      throw new JosephEditorialSelectionError(`Invalid ${definition.role} source range.`);
    }
    const durationMs = definition.sourceEndMs - definition.sourceStartMs;
    const segment: JosephEditorialSegment = {
      ...definition,
      outputStartMs: outputCursorMs,
      outputEndMs: outputCursorMs + durationMs,
    };
    outputCursorMs = segment.outputEndMs;
    return segment;
  });

  for (let index = 1; index < segments.length; index += 1) {
    if (segments[index]!.sourceStartMs < segments[index - 1]!.sourceEndMs) {
      throw new JosephEditorialSelectionError("Editorial source segments must be ordered and non-overlapping.");
    }
  }
  if (outputCursorMs < MIN_PROOF_DURATION_MS || outputCursorMs > MAX_PROOF_DURATION_MS) {
    throw new JosephEditorialSelectionError(
      `Director-selected proof must be 30-45 seconds; selected ${(outputCursorMs / 1000).toFixed(2)} seconds.`,
    );
  }

  return {
    version: "joseph-editorial-v1",
    strategy: "assemblyai_narrative_arc",
    sourceDurationMs,
    outputDurationMs: outputCursorMs,
    removedDurationMs: sourceDurationMs - outputCursorMs,
    segments,
  };
};

export const buildJosephEditorialPlan = (transcript: JosephEditorialTranscript): JosephEditorialPlan => {
  const words = transcript.words;
  if (transcript.source !== "assemblyai" || !transcript.trainableForIrl || words.length === 0) {
    throw new JosephEditorialSelectionError("Raw Joseph proof requires a timed AssemblyAI transcript.");
  }

  const profitIndex = requiredIndex(words, "profit");
  const homeIndex = requiredIndex(words, "home", profitIndex + 1);
  const pointIndex = requiredIndex(words, "point", homeIndex + 1);
  const rainbowsIndex = requiredIndex(words, "rainbows", pointIndex + 1);
  const whileIndex = requiredIndex(words, "while", rainbowsIndex + 1);
  const nutsIndex = requiredIndex(words, "nuts", whileIndex + 1);
  const guessIndex = requiredIndex(words, "guess", nutsIndex + 1);
  const modelIndex = requiredIndex(words, "model", guessIndex + 1);

  const firstWord = words[0]!;
  const benefitStart = words[profitIndex + 1];
  if (!benefitStart) {
    throw new JosephEditorialSelectionError("Benefit segment cannot begin after the profit hook.");
  }

  return makeSegments(transcript.durationMs, [
    {role: "hook", sourceStartMs: firstWord.startMs, sourceEndMs: words[profitIndex]!.endMs},
    {role: "benefit", sourceStartMs: benefitStart.startMs, sourceEndMs: words[homeIndex]!.endMs},
    {
      role: "reversal",
      sourceStartMs: words[includeLeadingConjunction(words, pointIndex)]!.startMs,
      sourceEndMs: words[rainbowsIndex]!.endMs,
    },
    {role: "pain", sourceStartMs: words[whileIndex]!.startMs, sourceEndMs: words[nutsIndex]!.endMs},
    {
      role: "payoff",
      sourceStartMs: words[includeLeadingConjunction(words, guessIndex)]!.startMs,
      sourceEndMs: words[modelIndex]!.endMs,
    },
  ]);
};

const mapTimestamp = (timestampMs: number, plan: JosephEditorialPlan): number[] => plan.segments
  .filter((segment) => timestampMs >= segment.sourceStartMs && timestampMs <= segment.sourceEndMs)
  .map((segment) => segment.outputStartMs + timestampMs - segment.sourceStartMs);

const remapWord = (
  word: JosephTranscriptWord,
  segment: JosephEditorialSegment,
): JosephTranscriptWord | null => {
  if (word.startMs < segment.sourceStartMs || word.endMs > segment.sourceEndMs) {
    return null;
  }
  return {
    ...word,
    startMs: segment.outputStartMs + word.startMs - segment.sourceStartMs,
    endMs: segment.outputStartMs + word.endMs - segment.sourceStartMs,
  };
};

const groupPhrases = (words: JosephTranscriptWord[]): JosephTranscriptPayload["phrases"] => {
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
    const previous = bucket.at(-1);
    if (previous && word.startMs - previous.endMs > 450) flush();
    bucket.push(word);
    if (bucket.length >= 8) flush();
  }
  flush();
  return phrases;
};

const uniqueSorted = (values: number[]): number[] =>
  [...new Set(values.map(Math.round))].sort((left, right) => left - right);

export const remapJosephTranscript = (
  transcript: JosephEditorialTranscript,
  plan: JosephEditorialPlan,
): JosephTranscriptPayload => {
  const words = plan.segments.flatMap((segment) =>
    transcript.words
      .map((word) => remapWord(word, segment))
      .filter((word): word is JosephTranscriptWord => word !== null)
  );
  const mapPoints = (points: number[]) => uniqueSorted(points.flatMap((point) => mapTimestamp(point, plan)));

  return {
    ...transcript,
    words,
    phrases: groupPhrases(words),
    beats: mapPoints(transcript.beats),
    onsets: mapPoints(transcript.onsets),
    durationMs: plan.outputDurationMs,
    warnings: [...new Set([...transcript.warnings, "editorial_timeline_remapped_from_raw_source"])],
  };
};

const seconds = (milliseconds: number): string => Number((milliseconds / 1000).toFixed(3)).toString();

export const buildEditorialFfmpegArgs = (
  sourcePath: string,
  outputPath: string,
  plan: JosephEditorialPlan,
): string[] => {
  const filters = plan.segments.flatMap((segment, index) => [
    `[0:v]trim=start=${seconds(segment.sourceStartMs)}:end=${seconds(segment.sourceEndMs)},setpts=PTS-STARTPTS[v${index}]`,
    `[0:a]atrim=start=${seconds(segment.sourceStartMs)}:end=${seconds(segment.sourceEndMs)},asetpts=PTS-STARTPTS[a${index}]`,
  ]);
  const concatInputs = plan.segments.map((_, index) => `[v${index}][a${index}]`).join("");
  filters.push(`${concatInputs}concat=n=${plan.segments.length}:v=1:a=1[vout][aout]`);

  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    sourcePath,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    outputPath,
  ];
};

const hashFile = async (filePath: string): Promise<string> => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
};

const runFfmpeg = async (args: string[], ffmpegBinary: string): Promise<void> => new Promise((resolve, reject) => {
  execFile(ffmpegBinary, args, {windowsHide: true}, (error, _stdout, stderr) => {
    if (error) {
      reject(new Error(`Joseph editorial FFmpeg failed: ${stderr.trim() || error.message}`));
      return;
    }
    resolve();
  });
});

export const materializeJosephEditorialSource = async ({
  sourcePath,
  outputPath,
  transcript,
  ffmpegBinary = "ffmpeg",
}: {
  sourcePath: string;
  outputPath: string;
  transcript: JosephEditorialTranscript;
  ffmpegBinary?: string;
}): Promise<JosephEditorialMaterialization> => {
  const plan = buildJosephEditorialPlan(transcript);
  await mkdir(path.dirname(outputPath), {recursive: true});
  await runFfmpeg(buildEditorialFfmpegArgs(sourcePath, outputPath, plan), ffmpegBinary);
  return {
    sourcePath: path.resolve(sourcePath),
    sourceSha256: await hashFile(sourcePath),
    derivedPath: path.resolve(outputPath),
    derivedSha256: await hashFile(outputPath),
    plan,
    transcript: remapJosephTranscript(transcript, plan),
  };
};
