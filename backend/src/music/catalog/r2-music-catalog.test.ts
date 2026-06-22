import {mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";

import {describe, expect, it} from "vitest";

import {resolveR2MusicReferences} from "./r2-music-catalog";
import type {R2MusicCatalog} from "./r2-music-catalog.schema";

describe("resolveR2MusicReferences", () => {
  const catalog: R2MusicCatalog = {
    artifactType: "r2_music_catalog",
    version: "1.0",
    sourceCatalogPath: null,
    bucket: "music",
    generatedAt: "2026-01-01T00:00:00.000Z",
    totalTracks: 1,
    entries: [{
      id: "r2-track",
      title: "R2 Track",
      artist: "Artist",
      category: "cinematic",
      genreTags: [],
      moodTags: [],
      useCaseTags: [],
      avoidWhen: [],
      audioObjectKey: "music/r2-track.mp3",
      thumbnailObjectKey: null,
      audioPublicUrl: "https://cdn.example.com/music/r2-track.mp3",
      thumbnailPublicUrl: null,
      storageProvider: "r2",
      bucket: "music",
      durationSec: 120,
      licenseType: "licensed",
      commercialAllowed: true,
      attributionRequired: false,
      licenseVerified: true,
      previewAllowed: true,
      renderAllowed: true,
      analysisStatus: "indexed",
      uploadedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }],
  };

  it("marks R2 tracks render-safe only after a valid local cache file exists", async () => {
    const cacheDir = mkdtempSync(path.join(tmpdir(), "prometheus-r2-cache-"));
    const cachedFile = path.join(cacheDir, "r2-track.mp3");
    writeFileSync(cachedFile, Buffer.from([1, 2, 3, 4]));

    const references = await resolveR2MusicReferences({
      catalog,
      cacheDir,
      cacheTrack: async () => cachedFile,
    });

    expect(references[0]?.sourceKind).toBe("r2");
    expect(references[0]?.renderSafe).toBe(true);
    expect(references[0]?.localFilePath).toBe(cachedFile);
  });

  it("keeps uncached R2 tracks out of final render", async () => {
    const references = await resolveR2MusicReferences({
      catalog,
      cacheDir: mkdtempSync(path.join(tmpdir(), "prometheus-r2-cache-missing-")),
    });

    expect(references[0]?.renderSafe).toBe(false);
    expect(references[0]?.localFilePath).toMatch(/r2-track\.mp3$/);
  });
});