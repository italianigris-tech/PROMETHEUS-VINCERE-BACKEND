import {buildBeatGrid, type BuildBeatGridInput} from "./beat-grid-builder";
import {detectSections} from "./section-detector";
import {musicTrackSchema, type MusicTrack} from "../schemas/music-track.schema";

export type AnalyzeTrackInput = {
  track: MusicTrack;
  beatGridInput?: Omit<BuildBeatGridInput, "durationSec" | "bpm">;
};

const toWaveformSummary = (durationSec: number): MusicTrack["waveformSummary"] => {
  const bucketCount = Math.max(8, Math.min(32, Math.round(durationSec / 8)));
  const peakAmplitudes = Array.from({length: bucketCount}, (_, index) => {
    return Number((0.4 + (((index % 5) + 1) / 10)).toFixed(3));
  });
  const rmsAmplitudes = peakAmplitudes.map((value) => Number((Math.max(0.2, value - 0.15)).toFixed(3)));

  return {
    windowSec: Number((durationSec / bucketCount).toFixed(3)),
    peakAmplitudes,
    rmsAmplitudes,
    source: "ffmpeg_fallback"
  };
};

export const analyzeTrack = (input: AnalyzeTrackInput): MusicTrack => {
  const track = musicTrackSchema.parse(input.track);
  const beatGrid = buildBeatGrid({
    durationSec: track.durationSec,
    bpm: track.bpm ?? undefined,
    confidence: input.beatGridInput?.confidence,
    source: input.beatGridInput?.source ?? "ffmpeg_fallback"
  });
  const sections = detectSections({
    trackId: track.id,
    durationSec: track.durationSec,
    beatGrid,
    energy: track.energy,
    tension: track.tension
  });

  // TODO: Use Python-side librosa/Essentia features for BPM, key, and section confidence.
  // TODO: Use Pedalboard-friendly loudness previewing after heavy analysis is introduced.
  return musicTrackSchema.parse({
    ...track,
    bpm: track.bpm ?? beatGrid.bpm,
    beatGrid,
    sections,
    waveformSummary: track.waveformSummary ?? toWaveformSummary(track.durationSec),
    loudnessLufs: track.loudnessLufs ?? -16,
    analysisStatus: "analyzed",
    analyzedAt: track.analyzedAt ?? track.createdAt
  });
};
