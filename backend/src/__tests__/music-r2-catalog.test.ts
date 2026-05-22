import path from "node:path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {loadEnv} from "../config";
import {
  buildMusicCatalogSmokeSummary,
  buildPublicObjectUrl,
  getCandidateMusicTracks,
  getMusicPreviewReference,
  getMusicPreviewUrl,
  getMusicThumbnailUrl,
  getMusicTrackById,
  listMusicCatalog,
  normalizeR2MusicCatalog,
  r2CatalogEntryToMusicTrack,
  selectCatalogCandidatesForTimeline,
  readR2MusicCatalogArtifact,
  writeR2MusicCatalogArtifact
} from "../music";
import {cleanupMusicTempDir, makeMusicTempDir} from "./music-test-utils";

describe("music r2 catalog", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeMusicTempDir();
  });

  afterEach(async () => {
    await cleanupMusicTempDir(tempDir);
  });

  const uploaderCatalogFixture = [
    {
      id: "cinematic-trailer-epic/epic-cinematic",
      title: "Epic Cinematic",
      category: "Cinematic Trailer - Epic",
      categorySlug: "cinematic-trailer-epic",
      originalObjectKey: "music-originals/cinematic-trailer-epic/epic-cinematic.mp3",
      thumbnailObjectKey: null,
      duration: 92.4,
      fileSizeBytes: 1234567,
      genreTags: ["High Energy", " Trailer "],
      moodTags: ["Big Reveal"],
      useCaseTags: ["Hook Bed"],
      avoidWhen: ["Long Form"],
      commercialAllowed: true,
      licenseVerified: true,
      attributionRequired: false
    },
    {
      id: "cinematic-trailer-epic/epic-cinematic",
      title: "Epic Cinematic",
      category: "Cinematic Trailer - Epic",
      categorySlug: "cinematic-trailer-epic",
      originalObjectKey: "music-originals/cinematic-trailer-epic/epic-cinematic.mp3",
      thumbnailObjectKey: "music-thumbnails/cinematic-trailer-epic/epic-cinematic.webp",
      duration: 92.4,
      fileSizeBytes: 1234567
    },
    {
      id: "other/unsafe-track",
      title: "Unsafe Track",
      category: "Other",
      categorySlug: "other",
      originalObjectKey: "music-originals/other/unsafe-track.mp3",
      thumbnailObjectKey: "music-thumbnails/other/unsafe-track.jpg",
      duration: null,
      fileSizeBytes: 223344,
      commercialAllowed: false,
      licenseVerified: false
    }
  ];

  it("normalizes uploader catalog entries into a deterministic R2 catalog without mutating input", () => {
    const before = structuredClone(uploaderCatalogFixture);

    const normalized = normalizeR2MusicCatalog({
      sourceCatalog: uploaderCatalogFixture,
      bucket: "prometheus-music",
      sourceCatalogPath: "downloads/music-catalog.json",
      now: () => "2026-05-13T00:00:00.000Z"
    });

    expect(uploaderCatalogFixture).toEqual(before);
    expect(normalized.artifactType).toBe("r2_music_catalog");
    expect(normalized.totalTracks).toBe(2);
    expect(normalized.entries[0]?.id).toBe("cinematic-trailer-epic/epic-cinematic");
    expect(normalized.entries[0]?.category).toBe("cinematic-trailer-epic");
    expect(normalized.entries[0]?.thumbnailObjectKey).toBe("music-thumbnails/cinematic-trailer-epic/epic-cinematic.webp");
    expect(normalized.entries[0]?.genreTags).toEqual(["high-energy", "trailer"]);
    expect(normalized.entries[0]?.moodTags).toEqual(["big-reveal"]);
    expect(normalized.entries[0]?.useCaseTags).toEqual(["hook-bed"]);
    expect(normalized.entries[0]?.avoidWhen).toEqual(["long-form"]);
    expect(normalized.entries[0]?.previewAllowed).toBe(true);
    expect(normalized.entries[0]?.renderAllowed).toBe(true);
    expect(normalized.entries[1]?.licenseVerified).toBe(false);
    expect(normalized.entries[1]?.commercialAllowed).toBe(false);
    expect(normalized.entries[1]?.renderAllowed).toBe(false);
    expect(normalized.entries[1]?.previewAllowed).toBe(true);
    expect(normalized.entries[1]?.analysisStatus).toBe("pending");
  });

  it("writes and reads the normalized catalog artifact from an explicit cache path", async () => {
    const normalized = normalizeR2MusicCatalog({
      sourceCatalog: uploaderCatalogFixture,
      bucket: "prometheus-music",
      now: () => "2026-05-13T00:00:00.000Z"
    });
    const outputPath = path.join(tempDir, "r2-music-catalog.normalized.json");

    const writtenPath = await writeR2MusicCatalogArtifact({
      catalog: normalized,
      outputPath
    });
    const readBack = await readR2MusicCatalogArtifact({
      inputPath: writtenPath
    });

    expect(writtenPath).toBe(outputPath);
    expect(readBack).toEqual(normalized);
  });

  it("returns object-key-only mode when no public base URL exists", async () => {
    const normalized = normalizeR2MusicCatalog({
      sourceCatalog: uploaderCatalogFixture,
      bucket: "prometheus-music",
      now: () => "2026-05-13T00:00:00.000Z"
    });

    const listResult = await listMusicCatalog({
      catalog: normalized,
      publicBaseUrl: ""
    });
    const entry = await getMusicTrackById({
      id: "other/unsafe-track",
      catalog: normalized,
      publicBaseUrl: ""
    });

    expect(listResult.urlMode).toBe("object_key_only");
    expect(listResult.entries[0]?.audioRef).toBe(listResult.entries[0]?.audioObjectKey);
    expect(entry?.audioRef).toBe("music-originals/other/unsafe-track.mp3");
    expect(getMusicPreviewUrl(normalized.entries[1]!, {publicBaseUrl: ""})).toEqual({
      urlMode: "object_key_only",
      value: "music-originals/other/unsafe-track.mp3"
    });
    expect(getMusicThumbnailUrl(normalized.entries[1]!, {publicBaseUrl: ""})).toEqual({
      urlMode: "object_key_only",
      value: "music-thumbnails/other/unsafe-track.jpg"
    });
  });

  it("returns public URL mode without exposing secrets when a base URL is provided", async () => {
    const normalized = normalizeR2MusicCatalog({
      sourceCatalog: uploaderCatalogFixture,
      bucket: "prometheus-music",
      publicBaseUrl: "https://cdn.example.com/prometheus-music",
      now: () => "2026-05-13T00:00:00.000Z"
    });

    const listResult = await listMusicCatalog({
      catalog: normalized,
      publicBaseUrl: "https://cdn.example.com/prometheus-music"
    });

    expect(listResult.urlMode).toBe("public_url");
    expect(listResult.entries[0]?.audioRef).toBe("https://cdn.example.com/prometheus-music/music-originals/cinematic-trailer-epic/epic-cinematic.mp3");
    expect(listResult.entries[0]?.thumbnailRef).toBe("https://cdn.example.com/prometheus-music/music-thumbnails/cinematic-trailer-epic/epic-cinematic.webp");
    expect(listResult.entries[0]?.audioRef.includes("R2_SECRET_ACCESS_KEY")).toBe(false);
  });

  it("normalizes public object URLs safely for spaces and special characters", () => {
    expect(buildPublicObjectUrl(
      "https://cdn.example.com/prometheus-music/",
      "music originals/Category Name/track #1%20mix?.mp3"
    )).toBe(
      "https://cdn.example.com/prometheus-music/music%20originals/Category%20Name/track%20%231%20mix%3F.mp3"
    );
  });

  it("filters candidate tracks by render and preview readiness", async () => {
    const normalized = normalizeR2MusicCatalog({
      sourceCatalog: uploaderCatalogFixture,
      bucket: "prometheus-music",
      now: () => "2026-05-13T00:00:00.000Z"
    });

    const previewTracks = await getCandidateMusicTracks({
      catalog: normalized,
      requirePreviewAllowed: true
    });
    const renderTracks = await getCandidateMusicTracks({
      catalog: normalized,
      requireRenderAllowed: true
    });

    expect(previewTracks).toHaveLength(2);
    expect(renderTracks).toHaveLength(1);
    expect(renderTracks[0]?.id).toBe("cinematic-trailer-epic/epic-cinematic");
  });

  it("accepts human-readable category and tag filters while keeping total before limit", async () => {
    const normalized = normalizeR2MusicCatalog({
      sourceCatalog: uploaderCatalogFixture,
      bucket: "prometheus-music",
      now: () => "2026-05-13T00:00:00.000Z"
    });

    const listResult = await listMusicCatalog({
      catalog: normalized,
      category: "Cinematic Trailer - Epic",
      genreTag: "High Energy",
      useCaseTag: "Hook Bed",
      limit: 1,
      publicBaseUrl: ""
    });

    expect(listResult.total).toBe(1);
    expect(listResult.entries).toHaveLength(1);
    expect(listResult.entries[0]?.id).toBe("cinematic-trailer-epic/epic-cinematic");
  });

  it("converts an R2 catalog entry into a planner-compatible MusicTrack without elevating unsafe tracks", () => {
    const normalized = normalizeR2MusicCatalog({
      sourceCatalog: uploaderCatalogFixture,
      bucket: "prometheus-music",
      now: () => "2026-05-13T00:00:00.000Z"
    });

    const track = r2CatalogEntryToMusicTrack(normalized.entries[1]!);

    expect(track.id).toBe("other/unsafe-track");
    expect(track.source).toBe("r2_music_catalog");
    expect(track.storagePath).toBe("r2://prometheus-music/music-originals/other/unsafe-track.mp3");
    expect(track.analysisStatus).toBe("pending");
    expect(track.licenseVerified).toBe(false);
    expect(track.commercialAllowed).toBe(false);
  });

  it("builds preview readiness metadata for public and object-key-only modes", () => {
    const normalized = normalizeR2MusicCatalog({
      sourceCatalog: uploaderCatalogFixture,
      bucket: "prometheus-music",
      now: () => "2026-05-13T00:00:00.000Z"
    });

    expect(getMusicPreviewReference(normalized.entries[0]!, {
      publicBaseUrl: "https://cdn.example.com/prometheus-music/"
    })).toEqual({
      trackId: "cinematic-trailer-epic/epic-cinematic",
      encodedTrackId: "cinematic-trailer-epic%2Fepic-cinematic",
      urlMode: "public_url",
      playableInBrowser: true,
      audioPreviewUrl: "https://cdn.example.com/prometheus-music/music-originals/cinematic-trailer-epic/epic-cinematic.mp3",
      audioObjectKey: "music-originals/cinematic-trailer-epic/epic-cinematic.mp3",
      reason: "Public music preview URL is configured."
    });

    expect(getMusicPreviewReference(normalized.entries[1]!, {
      publicBaseUrl: ""
    })).toEqual({
      trackId: "other/unsafe-track",
      encodedTrackId: "other%2Funsafe-track",
      urlMode: "object_key_only",
      playableInBrowser: false,
      audioPreviewUrl: null,
      audioObjectKey: "music-originals/other/unsafe-track.mp3",
      reason: "Only an R2 object key is available; browser playback needs a safe public or signed URL."
    });
  });

  it("builds signed preview readiness metadata without changing render safety", () => {
    const normalized = normalizeR2MusicCatalog({
      sourceCatalog: uploaderCatalogFixture,
      bucket: "prometheus-music",
      now: () => "2026-05-13T00:00:00.000Z"
    });

    expect(getMusicPreviewReference(normalized.entries[1]!, {
      publicBaseUrl: "",
      signedPreviewUrl: {
        url: "https://signed.example.com/music-originals/other/unsafe-track.mp3?signature=abc",
        expiresAt: "2026-05-14T00:15:00.000Z",
        ttlSeconds: 900
      }
    })).toEqual({
      trackId: "other/unsafe-track",
      encodedTrackId: "other%2Funsafe-track",
      urlMode: "signed_url",
      playableInBrowser: true,
      audioPreviewUrl: "https://signed.example.com/music-originals/other/unsafe-track.mp3?signature=abc",
      audioObjectKey: "music-originals/other/unsafe-track.mp3",
      expiresAt: "2026-05-14T00:15:00.000Z",
      ttlSeconds: 900,
      reason: "Short-lived signed music preview URL was generated."
    });
    expect(normalized.entries[1]?.renderAllowed).toBe(false);
  });

  it("builds a smoke summary from a normalized catalog fixture", async () => {
    const normalized = normalizeR2MusicCatalog({
      sourceCatalog: uploaderCatalogFixture,
      bucket: "prometheus-music",
      now: () => "2026-05-13T00:00:00.000Z"
    });
    const outputPath = path.join(tempDir, "smoke-r2-music-catalog.normalized.json");
    await writeR2MusicCatalogArtifact({
      catalog: normalized,
      outputPath
    });

    const summary = await buildMusicCatalogSmokeSummary({
      catalogPath: outputPath,
      publicBaseUrl: "",
      env: loadEnv({
        MUSIC_R2_SIGNED_PREVIEW_URLS_ENABLED: "false",
        R2_ENDPOINT: "",
        R2_ACCOUNT_ID: "",
        R2_ACCESS_KEY_ID: "",
        R2_SECRET_ACCESS_KEY: ""
      })
    });

    expect(summary).toEqual({
      totalTracks: 2,
      categories: ["cinematic-trailer-epic", "other"],
      previewAllowedCount: 2,
      renderAllowedCount: 1,
      urlMode: "object_key_only",
      playableInBrowser: false,
      signedPreviewEnabled: false,
      signedPreviewConfigured: false,
      signedPreviewTtlSeconds: 900,
      exampleTrackId: "cinematic-trailer-epic/epic-cinematic",
      exampleEncodedTrackId: "cinematic-trailer-epic%2Fepic-cinematic",
      examplePreviewMode: "object_key_only",
      hasAudioPreviewUrl: false,
      expiresAt: null
    });
  });

  it("builds a signed smoke summary without exposing the signed URL", async () => {
    const normalized = normalizeR2MusicCatalog({
      sourceCatalog: uploaderCatalogFixture,
      bucket: "prometheus-music",
      now: () => "2026-05-13T00:00:00.000Z"
    });
    const outputPath = path.join(tempDir, "signed-smoke-r2-music-catalog.normalized.json");
    await writeR2MusicCatalogArtifact({
      catalog: normalized,
      outputPath
    });

    const summary = await buildMusicCatalogSmokeSummary({
      catalogPath: outputPath,
      publicBaseUrl: "",
      env: loadEnv({
        MUSIC_R2_SIGNED_PREVIEW_URLS_ENABLED: "true",
        MUSIC_R2_SIGNED_PREVIEW_TTL_SECONDS: "600",
        R2_ACCOUNT_ID: "test-account",
        R2_ACCESS_KEY_ID: "secret-access-key-id",
        R2_SECRET_ACCESS_KEY: "secret-access-key-value"
      }),
      signer: async () => ({
        url: "https://signed.example.com/private-preview.mp3?signature=abc",
        expiresAt: "2026-05-14T00:10:00.000Z",
        ttlSeconds: 600
      })
    });

    expect(summary).toEqual({
      totalTracks: 2,
      categories: ["cinematic-trailer-epic", "other"],
      previewAllowedCount: 2,
      renderAllowedCount: 1,
      urlMode: "signed_url",
      playableInBrowser: true,
      signedPreviewEnabled: true,
      signedPreviewConfigured: true,
      signedPreviewTtlSeconds: 600,
      exampleTrackId: "cinematic-trailer-epic/epic-cinematic",
      exampleEncodedTrackId: "cinematic-trailer-epic%2Fepic-cinematic",
      examplePreviewMode: "signed_url",
      hasAudioPreviewUrl: true,
      expiresAt: "2026-05-14T00:10:00.000Z"
    });
  });

  it("selects previewable dry-run candidates but excludes unverified tracks from render-ready mode", () => {
    const normalized = normalizeR2MusicCatalog({
      sourceCatalog: uploaderCatalogFixture,
      bucket: "prometheus-music",
      now: () => "2026-05-13T00:00:00.000Z"
    });
    const timelineSegments = [
      {
        id: "seg-hook",
        startSec: 0,
        endSec: 4,
        role: "hook" as const,
        text: "Big reveal opening",
        energy: 0.9,
        valence: 0.7,
        arousal: 0.85,
        tension: 0.6,
        prestige: 0.5,
        urgency: 0.8,
        clarity: 0.7,
        speechDensity: 0.2,
        hookStrength: 0.9,
        proofStrength: 0.1,
        ctaStrength: 0.1,
        source: "test"
      }
    ];

    const dryRunResult = selectCatalogCandidatesForTimeline({
      timelineSegments,
      catalogEntries: normalized.entries,
      planMode: "dry_run",
      limit: 2
    });
    const renderReadyResult = selectCatalogCandidatesForTimeline({
      timelineSegments,
      catalogEntries: normalized.entries,
      planMode: "render_ready",
      limit: 2
    });

    expect(dryRunResult.entries.map((entry) => entry.id)).toContain("other/unsafe-track");
    expect(renderReadyResult.entries.map((entry) => entry.id)).toEqual(["cinematic-trailer-epic/epic-cinematic"]);
    expect(renderReadyResult.warnings).toEqual([]);
  });
});
