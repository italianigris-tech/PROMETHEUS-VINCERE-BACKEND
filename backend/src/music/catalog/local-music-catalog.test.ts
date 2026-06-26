import {mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";

import {describe, expect, it} from "vitest";

import {listLocalMusicCatalog} from "./local-music-catalog";

describe("listLocalMusicCatalog", () => {
  it("indexes readable local MP3 files as render-safe MusicReference records", () => {
    const musicDir = mkdtempSync(path.join(tmpdir(), "prometheus-local-music-"));
    writeFileSync(path.join(musicDir, "Good Track.mp3"), Buffer.from([1, 2, 3, 4]));
    writeFileSync(path.join(musicDir, "empty.mp3"), Buffer.alloc(0));
    writeFileSync(path.join(musicDir, "notes.txt"), "ignore me");

    const catalog = listLocalMusicCatalog({
      musicDir,
      probeDurationSeconds: () => 91.2,
    });

    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.title).toBe("Good Track");
    expect(catalog[0]?.sourceKind).toBe("local");
    expect(catalog[0]?.renderSafe).toBe(true);
    expect(path.isAbsolute(catalog[0]?.localFilePath ?? "")).toBe(true);
    expect(catalog[0]?.durationSeconds).toBe(91.2);
  });

  it("returns render-safe tracks when the optional default PROMETHEUS_SONGS directory is available", () => {
    const catalog = listLocalMusicCatalog({
      probeDurationSeconds: () => 60,
    });

    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.every((track) => track.renderSafe && path.isAbsolute(track.localFilePath))).toBe(true);
  });
});
