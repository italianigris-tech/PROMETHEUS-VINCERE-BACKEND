import {describe, expect, it} from "vitest";

import {rankMusicForProfile, selectMusicForProfile} from "./rank-music-for-profile";
import type {MusicAnalysisResult} from "./analyzer/music-analysis-adapter";
import type {MusicReference} from "@prometheus/shared-types";

const reference = (trackId: string, title: string): MusicReference => ({
  trackId,
  title,
  sourceKind: "local",
  localFilePath: `C:/music/${trackId}.mp3`,
  durationSeconds: 120,
  renderSafe: true,
  licenseStatus: "local_user_supplied",
});

const analysis = (bpm: number, energy: number): MusicAnalysisResult => ({
  bpm,
  beatTimes: [0, 0.5, 1, 1.5],
  downbeats: [0],
  sections: [{id: "a", startSeconds: 0, endSeconds: 120, label: "main", energy}],
  loudnessLUFS: -16,
  energyCurve: [energy, energy, energy],
  duration: 120,
  source: "ffmpeg_fallback",
  warnings: ["fixture"],
});

describe("rankMusicForProfile", () => {
  it("selects profile-appropriate render-safe tracks deterministically", () => {
    const tracks = [
      {...reference("aggressive", "Aggressive"), analysis: analysis(150, 0.9)},
      {...reference("minimal", "Minimal"), analysis: analysis(96, 0.25)},
      {...reference("unsafe", "Unsafe"), renderSafe: false, analysis: analysis(160, 1)},
    ];

    const aggressive = selectMusicForProfile({
      profile: "aggressive",
      videoDuration: 30,
      speechDensity: 0.2,
      energyCurve: [0.8, 0.9],
      availableTracks: tracks,
      seed: 42,
    });
    const minimal = selectMusicForProfile({
      profile: "minimal",
      videoDuration: 30,
      speechDensity: 0.8,
      energyCurve: [0.2, 0.3],
      availableTracks: tracks,
      seed: 42,
    });

    expect(aggressive?.track.trackId).toBe("aggressive");
    expect(minimal?.track.trackId).toBe("minimal");
    expect(rankMusicForProfile({
      profile: "aggressive",
      videoDuration: 30,
      speechDensity: 0.2,
      energyCurve: [0.8, 0.9],
      availableTracks: tracks,
      seed: 42,
    }).map((candidate) => candidate.track.trackId)).not.toContain("unsafe");
  });
});