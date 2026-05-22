import {describe, expect, it} from "vitest";

import {catalogImportTrackMetadataSchema, normalizeCatalogImportManifest} from "../music";

describe("music catalog importer", () => {
  it("turns valid metadata into pending MusicTrack records", () => {
    const input = {
      importId: "batch_1",
      sourceRoot: "music-import",
      tracksRoot: "tracks",
      tracks: [
        {
          title: "Night Drive",
          artist: "Atlas",
          fileName: "night-drive.mp3",
          source: "manual-import",
          sourceUrl: "https://example.com/night-drive",
          licenseType: "royalty_free",
          commercialAllowed: true,
          licenseVerified: true,
          genreTags: ["Synth Wave", "Cinematic"],
          moodTags: ["Late Night", "Focus"],
          instrumentTags: ["Analog Synth"],
          useCaseTags: ["Hook Bed"],
          avoidWhen: ["Hard Sell"],
          manualNotes: "Works for proof sections."
        }
      ]
    };

    const before = structuredClone(input);
    const result = normalizeCatalogImportManifest({
      manifest: input,
      now: () => "2026-05-13T00:00:00.000Z"
    });

    expect(input).toEqual(before);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]?.track.analysisStatus).toBe("pending");
    expect(result.tracks[0]?.track.storagePath).toBe("music-import/tracks/night-drive.mp3");
    expect(result.tracks[0]?.track.genreTags).toEqual(["synth-wave", "cinematic"]);
    expect(result.tracks[0]?.exportSafe).toBe(true);
  });

  it("keeps missing license verification unsafe by default", () => {
    const result = normalizeCatalogImportManifest({
      manifest: {
        tracks: [
          {
            title: "Safe Looking",
            artist: "Atlas",
            fileName: "safe-looking.wav",
            source: "manual-import"
          }
        ]
      }
    });

    expect(result.tracks[0]?.track.commercialAllowed).toBe(false);
    expect(result.tracks[0]?.track.licenseVerified).toBe(false);
    expect(result.tracks[0]?.exportSafe).toBe(false);
  });

  it("fails validation when title is missing", () => {
    expect(() =>
      catalogImportTrackMetadataSchema.parse({
        artist: "Atlas",
        fileName: "broken.mp3",
        source: "manual-import"
      })
    ).toThrow();
  });

  it("fails validation when fileName is missing", () => {
    expect(() =>
      catalogImportTrackMetadataSchema.parse({
        title: "Broken",
        artist: "Atlas",
        source: "manual-import"
      })
    ).toThrow();
  });

  it("normalizes tags to lowercase kebab-case", () => {
    const result = normalizeCatalogImportManifest({
      manifest: {
        tracks: [
          {
            title: "Tag Test",
            artist: "Atlas",
            fileName: "tag-test.mp3",
            source: "manual-import",
            genreTags: ["High Energy", "High Energy", " EDM "],
            moodTags: ["Direct Response"],
            useCaseTags: ["CTA Bed"]
          }
        ]
      }
    });

    expect(result.tracks[0]?.track.genreTags).toEqual(["high-energy", "edm"]);
    expect(result.tracks[0]?.track.moodTags).toEqual(["direct-response"]);
    expect(result.tracks[0]?.track.useCaseTags).toEqual(["cta-bed"]);
  });

  it("requires both commercialAllowed and licenseVerified for export safety", () => {
    const result = normalizeCatalogImportManifest({
      manifest: {
        tracks: [
          {
            title: "Half Safe",
            artist: "Atlas",
            fileName: "half-safe.mp3",
            source: "manual-import",
            commercialAllowed: true,
            licenseVerified: false
          }
        ]
      }
    });

    expect(result.tracks[0]?.exportSafe).toBe(false);
  });

  it("does not touch the live music.local catalog or require real files", () => {
    const result = normalizeCatalogImportManifest({
      manifest: {
        sourceRoot: "music-import",
        tracksRoot: "tracks",
        tracks: [
          {
            title: "Future Import",
            artist: "Atlas",
            fileName: "future-import.wav",
            relativePath: "tracks/future-import.wav",
            source: "manual-import"
          }
        ]
      }
    });

    expect(result.tracks[0]?.track.storagePath).toBe("music-import/tracks/future-import.wav");
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
