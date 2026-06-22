import {mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";

import {describe, expect, it} from "vitest";

import {analyzeMusicTrack} from "./music-analysis-adapter";

describe("analyzeMusicTrack", () => {
  it("returns deterministic monotonic beat analysis with source attribution", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "prometheus-music-analysis-"));
    const filePath = path.join(dir, "track.mp3");
    writeFileSync(filePath, Buffer.from([1, 2, 3, 4]));

    const first = await analyzeMusicTrack(filePath, {
      ffprobeDurationSeconds: () => 10,
      ffmpegLoudnessLufs: () => -15.5,
    });
    const second = await analyzeMusicTrack(filePath, {
      ffprobeDurationSeconds: () => 10,
      ffmpegLoudnessLufs: () => -15.5,
    });

    expect(first).toEqual(second);
    expect(first.source).toBe("ffmpeg_fallback");
    expect(first.bpm).toBe(128);
    expect(first.beatTimes.length).toBeGreaterThan(1);
    expect(first.beatTimes.every((time, index, beats) => index === 0 || time > (beats[index - 1] ?? -1))).toBe(true);
    expect(first.downbeats.every((downbeat) => first.beatTimes.includes(downbeat))).toBe(true);
    expect(first.warnings.length).toBeGreaterThan(0);
  });
});