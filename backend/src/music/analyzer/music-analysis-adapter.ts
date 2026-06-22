import {existsSync} from "node:fs";
import {execFileSync} from "node:child_process";

export type MusicAnalysisSource = "librosa_essentia" | "ffmpeg_fallback" | "constant_bpm_fallback";

export type MusicAnalysisSection = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  label: string;
  energy: number;
};

export type MusicAnalysisResult = {
  bpm: number;
  beatTimes: number[];
  downbeats: number[];
  sections: MusicAnalysisSection[];
  loudnessLUFS: number;
  energyCurve: number[];
  duration: number;
  source: MusicAnalysisSource;
  warnings: string[];
};

export type AnalyzeMusicTrackOptions = {
  pythonAnalyzerPath?: string;
  runPythonAnalyzer?: (filePath: string, scriptPath: string) => Promise<MusicAnalysisResult | null>;
  ffprobeDurationSeconds?: (filePath: string) => number | null;
  ffmpegLoudnessLufs?: (filePath: string) => number | null;
};

const round = (value: number): number => Math.round(value * 1000) / 1000;

const defaultProbeDuration = (filePath: string): number | null => {
  try {
    const output = execFileSync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ], {encoding: "utf8"});
    const duration = Number(output.trim());
    return Number.isFinite(duration) && duration > 0 ? duration : null;
  } catch {
    return null;
  }
};

const buildBeatGrid = (duration: number, bpm: number): {beatTimes: number[]; downbeats: number[]} => {
  const interval = 60 / bpm;
  const beatTimes: number[] = [];
  const downbeats: number[] = [];
  for (let beatIndex = 0, time = 0; time < duration; beatIndex += 1, time += interval) {
    const rounded = round(time);
    beatTimes.push(rounded);
    if (beatIndex % 4 === 0) {
      downbeats.push(rounded);
    }
  }
  return {beatTimes, downbeats};
};

const buildSections = (duration: number, energy: number): MusicAnalysisSection[] => {
  const midpoint = round(duration / 2);
  return [
    {id: "section-01", startSeconds: 0, endSeconds: midpoint, label: "intro", energy: Math.max(0, Math.min(1, energy * 0.85))},
    {id: "section-02", startSeconds: midpoint, endSeconds: round(duration), label: "main", energy: Math.max(0, Math.min(1, energy))},
  ].filter((section) => section.endSeconds > section.startSeconds);
};

export const analyzeMusicTrack = async (
  filePath: string,
  options: AnalyzeMusicTrackOptions = {},
): Promise<MusicAnalysisResult> => {
  if (!existsSync(filePath)) {
    throw new Error(`MusicAnalysisAdapter: file does not exist: ${filePath}`);
  }

  if (options.pythonAnalyzerPath && options.runPythonAnalyzer && existsSync(options.pythonAnalyzerPath)) {
    const result = await options.runPythonAnalyzer(filePath, options.pythonAnalyzerPath);
    if (result) {
      return {...result, source: "librosa_essentia"};
    }
  }

  const duration = options.ffprobeDurationSeconds?.(filePath) ?? defaultProbeDuration(filePath) ?? 1;
  const loudnessLUFS = options.ffmpegLoudnessLufs?.(filePath) ?? -16;
  const source: MusicAnalysisSource = options.ffprobeDurationSeconds || duration > 1 ? "ffmpeg_fallback" : "constant_bpm_fallback";
  const bpm = 128;
  const {beatTimes, downbeats} = buildBeatGrid(duration, bpm);
  const energy = loudnessLUFS >= -14 ? 0.72 : loudnessLUFS >= -18 ? 0.55 : 0.35;
  const bucketCount = Math.max(4, Math.min(24, Math.round(duration / 5)));
  const energyCurve = Array.from({length: bucketCount}, (_, index) => round(Math.max(0.05, Math.min(1, energy + ((index % 4) - 1.5) * 0.03))));

  return {
    bpm,
    beatTimes,
    downbeats,
    sections: buildSections(duration, energy),
    loudnessLUFS,
    energyCurve,
    duration: round(duration),
    source,
    warnings: [`Using ${source}; Python librosa/Essentia analysis was unavailable.`],
  };
};
