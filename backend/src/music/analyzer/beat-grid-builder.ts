import {beatGridSchema, type BeatGrid} from "../schemas/music-track.schema";

export type BuildBeatGridInput = {
  durationSec: number;
  bpm?: number | null;
  confidence?: number;
  source?: string;
};

const roundToMillis = (value: number): number => {
  return Math.round(value * 1000) / 1000;
};

export const buildBeatGrid = (input: BuildBeatGridInput): BeatGrid => {
  const durationSec = Math.max(input.durationSec, 1);
  const bpm = input.bpm && input.bpm > 0 ? input.bpm : 128;
  const beatIntervalSec = 60 / bpm;
  const beatTimesSec: number[] = [];
  const downbeatTimesSec: number[] = [];

  for (let beatIndex = 0, timeSec = 0; timeSec < durationSec; beatIndex += 1, timeSec += beatIntervalSec) {
    const roundedTimeSec = roundToMillis(timeSec);
    beatTimesSec.push(roundedTimeSec);
    if (beatIndex % 4 === 0) {
      downbeatTimesSec.push(roundedTimeSec);
    }
  }

  // TODO: Replace placeholder beat inference with Python-side librosa/Essentia analysis.
  return beatGridSchema.parse({
    bpm,
    beatTimesSec,
    downbeatTimesSec,
    confidence: input.confidence ?? 0.25,
    source: input.source ?? "ffmpeg_fallback"
  });
};
