import {seededPick, seededRandom} from "@prometheus/shared-types";
import type {MusicReference} from "@prometheus/shared-types";

import type {MusicAnalysisResult} from "./analyzer/music-analysis-adapter";

export type MusicRankingProfile = "aggressive" | "cinematic" | "minimal" | "joseph_aggressive" | "joseph_cinematic" | "joseph_minimal";

export type AnalyzedMusicReference = MusicReference & {
  analysis: MusicAnalysisResult;
};

export type RankMusicForProfileInput = {
  profile: MusicRankingProfile;
  videoDuration: number;
  speechDensity: number;
  energyCurve: number[];
  availableTracks: AnalyzedMusicReference[];
  seed: number;
};

export type RankedMusicCandidate = {
  track: AnalyzedMusicReference;
  score: number;
  reasons: string[];
};

const normalizeProfile = (profile: MusicRankingProfile): "aggressive" | "cinematic" | "minimal" => {
  if (profile === "joseph_aggressive") {
    return "aggressive";
  }
  if (profile === "joseph_cinematic") {
    return "cinematic";
  }
  if (profile === "joseph_minimal") {
    return "minimal";
  }
  return profile;
};

const average = (values: readonly number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const scoreTrack = (
  track: AnalyzedMusicReference,
  input: RankMusicForProfileInput,
): RankedMusicCandidate => {
  const profile = normalizeProfile(input.profile);
  const analysis = track.analysis;
  const energy = clamp01(average(analysis.energyCurve));
  const bpmFit = clamp01((analysis.bpm - 80) / 90);
  const durationFit = track.durationSeconds >= input.videoDuration ? 0.35 : -0.6;
  const voicePenalty = clamp01(input.speechDensity) * (energy > 0.65 ? 0.45 : 0.12);
  const sectionFit = analysis.sections.length > 0 ? 0.2 : 0;
  let score = durationFit + sectionFit;
  const reasons: string[] = [];

  if (profile === "aggressive") {
    score += energy * 1.2 + bpmFit * 0.9 + analysis.downbeats.length * 0.01;
    reasons.push("aggressive profile favors high energy, clear downbeats, and faster BPM");
  }
  if (profile === "cinematic") {
    score += (1 - Math.abs(energy - 0.55)) * 0.8 + sectionFit + (1 - voicePenalty);
    reasons.push("cinematic profile favors section shape and moderate energy under voice");
  }
  if (profile === "minimal") {
    score += (1 - energy) * 1.2 + (1 - bpmFit) * 0.35 + (1 - clamp01(input.speechDensity)) * 0.2;
    reasons.push("minimal profile favors lower distraction and readability support");
  }

  score -= voicePenalty;

  return {
    track,
    score: Number(score.toFixed(6)),
    reasons,
  };
};

export const rankMusicForProfile = (input: RankMusicForProfileInput): RankedMusicCandidate[] => {
  return input.availableTracks
    .filter((track) => track.renderSafe)
    .map((track) => scoreTrack(track, input))
    .sort((left, right) => right.score - left.score || left.track.trackId.localeCompare(right.track.trackId));
};

export const selectMusicForProfile = (input: RankMusicForProfileInput): RankedMusicCandidate | null => {
  const ranked = rankMusicForProfile(input);
  if (ranked.length === 0) {
    return null;
  }

  const bestScore = ranked[0]?.score ?? 0;
  const top = ranked.filter((candidate) => Math.abs(candidate.score - bestScore) < 0.05);
  return seededPick(seededRandom(input.seed), top.length > 0 ? top : ranked);
};
