import path from "node:path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import type {R2TransferService} from "../integrations/r2";
import type {MusicPreviewUrlSigner} from "../music";
import {writeR2MusicCatalogArtifact} from "../music";
import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

describe("music catalog routes", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  const buildCatalogFixture = () => ({
    artifactType: "r2_music_catalog" as const,
    version: "phase5a_v1",
    sourceCatalogPath: "fixture/music-catalog.json",
    bucket: "prometheus-music",
    generatedAt: "2026-05-14T00:00:00.000Z",
    totalTracks: 4,
    entries: [
      {
        id: "cinematic-trailer-epic/epic-cinematic",
        title: "Epic Cinematic",
        artist: "Signal Atlas",
        category: "cinematic-trailer-epic",
        genreTags: ["high-energy", "trailer"],
        moodTags: ["big-reveal"],
        useCaseTags: ["hook-bed"],
        avoidWhen: ["long-form"],
        audioObjectKey: "music-originals/cinematic-trailer-epic/epic-cinematic.mp3",
        thumbnailObjectKey: "music-thumbnails/cinematic-trailer-epic/epic-cinematic.webp",
        audioPublicUrl: null,
        thumbnailPublicUrl: null,
        storageProvider: "r2" as const,
        bucket: "prometheus-music",
        durationSec: 92.4,
        licenseType: "royalty_free",
        commercialAllowed: true,
        attributionRequired: false,
        licenseVerified: true,
        previewAllowed: true,
        renderAllowed: true,
        analysisStatus: "pending" as const,
        uploadedAt: "2026-05-14T00:00:00.000Z",
        createdAt: "2026-05-14T00:00:00.000Z",
        updatedAt: "2026-05-14T00:00:00.000Z"
      },
      {
        id: "other/unsafe-track",
        title: "Unsafe Track",
        artist: null,
        category: "other",
        genreTags: ["ambient"],
        moodTags: ["moody"],
        useCaseTags: ["underscore"],
        avoidWhen: [],
        audioObjectKey: "music-originals/other/unsafe-track.mp3",
        thumbnailObjectKey: "music-thumbnails/other/unsafe-track.jpg",
        audioPublicUrl: null,
        thumbnailPublicUrl: null,
        storageProvider: "r2" as const,
        bucket: "prometheus-music",
        durationSec: 61,
        licenseType: "unverified_uploader_catalog",
        commercialAllowed: false,
        attributionRequired: false,
        licenseVerified: false,
        previewAllowed: true,
        renderAllowed: false,
        analysisStatus: "pending" as const,
        uploadedAt: null,
        createdAt: "2026-05-14T00:00:00.000Z",
        updatedAt: "2026-05-14T00:00:00.000Z"
      },
      {
        id: "classical-orchestral-prestige/silver-horizon",
        title: "Silver Horizon",
        artist: "North Arcade",
        category: "classical-orchestral-prestige",
        genreTags: ["classical"],
        moodTags: ["prestige"],
        useCaseTags: ["proof-bed"],
        avoidWhen: ["high-chaos"],
        audioObjectKey: "music-originals/classical-orchestral-prestige/silver-horizon.mp3",
        thumbnailObjectKey: "music-thumbnails/classical-orchestral-prestige/silver-horizon.png",
        audioPublicUrl: null,
        thumbnailPublicUrl: null,
        storageProvider: "r2" as const,
        bucket: "prometheus-music",
        durationSec: 88,
        licenseType: "editorial_preview_only",
        commercialAllowed: false,
        attributionRequired: true,
        licenseVerified: false,
        previewAllowed: true,
        renderAllowed: false,
        analysisStatus: "analyzed" as const,
        uploadedAt: null,
        createdAt: "2026-05-14T00:00:00.000Z",
        updatedAt: "2026-05-14T00:00:00.000Z"
      },
      {
        id: "hidden/internal-only",
        title: "Internal Only",
        artist: null,
        category: "hidden",
        genreTags: ["test"],
        moodTags: ["internal"],
        useCaseTags: ["none"],
        avoidWhen: [],
        audioObjectKey: "music-originals/hidden/internal-only.mp3",
        thumbnailObjectKey: null,
        audioPublicUrl: null,
        thumbnailPublicUrl: null,
        storageProvider: "r2" as const,
        bucket: "prometheus-music",
        durationSec: null,
        licenseType: "internal",
        commercialAllowed: false,
        attributionRequired: false,
        licenseVerified: false,
        previewAllowed: false,
        renderAllowed: false,
        analysisStatus: "pending" as const,
        uploadedAt: null,
        createdAt: "2026-05-14T00:00:00.000Z",
        updatedAt: "2026-05-14T00:00:00.000Z"
      }
    ]
  });

  const writeFixtureCatalog = async (): Promise<string> => {
    const catalogPath = path.join(tempDir, "r2-music-catalog.normalized.json");
    await writeR2MusicCatalogArtifact({
      catalog: buildCatalogFixture(),
      outputPath: catalogPath
    });
    return catalogPath;
  };

  const buildR2Stub = (): {
    r2Service: R2TransferService;
    signer: MusicPreviewUrlSigner;
    counters: {createUploadUrl: number; downloadObject: number; signPreviewUrl: number};
  } => {
    const counters = {
      createUploadUrl: 0,
      downloadObject: 0,
      signPreviewUrl: 0
    };

    return {
      counters,
      r2Service: {
        isConfigured: false,
        async createUploadUrl() {
          counters.createUploadUrl += 1;
          throw new Error("createUploadUrl should not be called by music catalog routes.");
        },
        async downloadObject() {
          counters.downloadObject += 1;
          throw new Error("downloadObject should not be called by music catalog routes.");
        }
      },
      signer: async () => {
        counters.signPreviewUrl += 1;
        return {
          url: "https://signed.example.com/music-preview.mp3?token=abc123",
          expiresAt: "2026-05-14T00:15:00.000Z",
          ttlSeconds: 900
        };
      }
    };
  };

  it("lists tracks from the normalized cache fixture and paginates safely", async () => {
    const catalogPath = await writeFixtureCatalog();
    const {r2Service, signer, counters} = buildR2Stub();
    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        MUSIC_R2_CATALOG_PATH: catalogPath
      },
      deps: {
        r2Service,
        musicPreviewUrlSigner: signer
      }
    });

    const response = await context.app.inject({
      method: "GET",
      url: "/api/music/catalog?limit=1&offset=1"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      total: 3,
      limit: 1,
      offset: 1,
      urlMode: "object_key_only",
      categories: ["cinematic-trailer-epic", "classical-orchestral-prestige", "other"]
    });
    expect(response.json().tracks).toHaveLength(1);
    expect(response.json().tracks[0]?.id).toBe("other/unsafe-track");
    expect(response.json().tracks[0]?.encodedTrackId).toBe("other%2Funsafe-track");
    expect(counters.createUploadUrl).toBe(0);
    expect(counters.downloadObject).toBe(0);
    expect(counters.signPreviewUrl).toBe(0);

    await context.app.close();
  });

  it("accepts both human-readable and kebab-case category filters", async () => {
    const catalogPath = await writeFixtureCatalog();
    const humanReadableContext = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        MUSIC_R2_CATALOG_PATH: catalogPath
      }
    });

    const humanReadable = await humanReadableContext.app.inject({
      method: "GET",
      url: "/api/music/catalog?category=Cinematic%20Trailer%20-%20Epic"
    });
    const kebabCase = await humanReadableContext.app.inject({
      method: "GET",
      url: "/api/music/catalog?category=cinematic-trailer-epic"
    });

    expect(humanReadable.statusCode).toBe(200);
    expect(kebabCase.statusCode).toBe(200);
    expect(humanReadable.json().tracks).toHaveLength(1);
    expect(kebabCase.json().tracks).toHaveLength(1);
    expect(humanReadable.json().tracks[0]?.id).toBe("cinematic-trailer-epic/epic-cinematic");
    expect(kebabCase.json().tracks[0]?.id).toBe("cinematic-trailer-epic/epic-cinematic");

    await humanReadableContext.app.close();
  });

  it("searches title category and tags", async () => {
    const catalogPath = await writeFixtureCatalog();
    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        MUSIC_R2_CATALOG_PATH: catalogPath
      }
    });

    const titleSearch = await context.app.inject({
      method: "GET",
      url: "/api/music/catalog?search=Silver"
    });
    const categorySearch = await context.app.inject({
      method: "GET",
      url: "/api/music/catalog?search=classical-orchestral"
    });
    const tagSearch = await context.app.inject({
      method: "GET",
      url: "/api/music/catalog?search=big-reveal"
    });

    expect(titleSearch.json().tracks[0]?.id).toBe("classical-orchestral-prestige/silver-horizon");
    expect(categorySearch.json().tracks[0]?.id).toBe("classical-orchestral-prestige/silver-horizon");
    expect(tagSearch.json().tracks[0]?.id).toBe("cinematic-trailer-epic/epic-cinematic");

    await context.app.close();
  });

  it("keeps unsafe previewable tracks visible without promoting renderAllowed", async () => {
    const catalogPath = await writeFixtureCatalog();
    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        MUSIC_R2_CATALOG_PATH: catalogPath
      }
    });

    const response = await context.app.inject({
      method: "GET",
      url: "/api/music/catalog"
    });
    const body = response.json();
    const unsafeTrack = body.tracks.find((track: {id: string}) => track.id === "other/unsafe-track");

    expect(response.statusCode).toBe(200);
    expect(unsafeTrack.renderAllowed).toBe(false);
    expect(body.tracks.some((track: {id: string}) => track.id === "hidden/internal-only")).toBe(false);

    await context.app.close();
  });

  it("uses MUSIC_R2_PUBLIC_BASE_URL for list and preview responses when configured", async () => {
    const catalogPath = await writeFixtureCatalog();
    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        MUSIC_R2_CATALOG_PATH: catalogPath,
        MUSIC_R2_PUBLIC_BASE_URL: "https://cdn.example.com/prometheus-music"
      }
    });

    const listResponse = await context.app.inject({
      method: "GET",
      url: "/api/music/catalog?category=cinematic-trailer-epic"
    });
    const previewResponse = await context.app.inject({
      method: "GET",
      url: "/api/music/catalog/cinematic-trailer-epic%2Fepic-cinematic/preview-url"
    });

    expect(listResponse.json()).toMatchObject({
      urlMode: "public_url"
    });
    expect(listResponse.json().tracks[0]?.audioPreviewUrl).toBe(
      "https://cdn.example.com/prometheus-music/music-originals/cinematic-trailer-epic/epic-cinematic.mp3"
    );
    expect(listResponse.json().tracks[0]?.thumbnailUrl).toBe(
      "https://cdn.example.com/prometheus-music/music-thumbnails/cinematic-trailer-epic/epic-cinematic.webp"
    );
    expect(previewResponse.json()).toEqual({
      trackId: "cinematic-trailer-epic/epic-cinematic",
      encodedTrackId: "cinematic-trailer-epic%2Fepic-cinematic",
      urlMode: "public_url",
      playableInBrowser: true,
      audioPreviewUrl: "https://cdn.example.com/prometheus-music/music-originals/cinematic-trailer-epic/epic-cinematic.mp3",
      audioObjectKey: "music-originals/cinematic-trailer-epic/epic-cinematic.mp3",
      reason: "Public music preview URL is configured."
    });

    await context.app.close();
  });

  it("stays in object-key-only mode without exposing secrets", async () => {
    const catalogPath = await writeFixtureCatalog();
    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        MUSIC_R2_CATALOG_PATH: catalogPath,
        R2_ACCESS_KEY_ID: "secret-access-key-id",
        R2_SECRET_ACCESS_KEY: "secret-access-key-value"
      }
    });

    const response = await context.app.inject({
      method: "GET",
      url: "/api/music/catalog?category=other"
    });
    const bodyText = response.body;

    expect(response.statusCode).toBe(200);
    expect(response.json().urlMode).toBe("object_key_only");
    expect(response.json().tracks[0]?.audioObjectKey).toBe("music-originals/other/unsafe-track.mp3");
    expect(bodyText.includes("secret-access-key-id")).toBe(false);
    expect(bodyText.includes("secret-access-key-value")).toBe(false);

    await context.app.close();
  });

  it("returns signed_url mode when signing is enabled and no public base URL exists", async () => {
    const catalogPath = await writeFixtureCatalog();
    const {signer, counters} = buildR2Stub();
    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        MUSIC_R2_CATALOG_PATH: catalogPath,
        MUSIC_R2_SIGNED_PREVIEW_URLS_ENABLED: "true",
        MUSIC_R2_SIGNED_PREVIEW_TTL_SECONDS: "900",
        R2_ACCOUNT_ID: "test-account",
        R2_ACCESS_KEY_ID: "secret-access-key-id",
        R2_SECRET_ACCESS_KEY: "secret-access-key-value"
      },
      deps: {
        musicPreviewUrlSigner: signer
      }
    });

    const response = await context.app.inject({
      method: "GET",
      url: "/api/music/catalog/other%2Funsafe-track/preview-url"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      trackId: "other/unsafe-track",
      encodedTrackId: "other%2Funsafe-track",
      urlMode: "signed_url",
      playableInBrowser: true,
      audioPreviewUrl: "https://signed.example.com/music-preview.mp3?token=abc123",
      audioObjectKey: "music-originals/other/unsafe-track.mp3",
      expiresAt: "2026-05-14T00:15:00.000Z",
      ttlSeconds: 900,
      reason: "Short-lived signed music preview URL was generated."
    });
    expect(counters.signPreviewUrl).toBe(1);
    expect(response.body.includes("secret-access-key-id")).toBe(false);
    expect(response.body.includes("secret-access-key-value")).toBe(false);

    await context.app.close();
  });

  it("blocks preview URL generation when previewAllowed is false", async () => {
    const catalogPath = await writeFixtureCatalog();
    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        MUSIC_R2_CATALOG_PATH: catalogPath
      }
    });

    const response = await context.app.inject({
      method: "GET",
      url: "/api/music/catalog/hidden%2Finternal-only/preview-url"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      trackId: "hidden/internal-only",
      encodedTrackId: "hidden%2Finternal-only",
      urlMode: "object_key_only",
      playableInBrowser: false,
      audioPreviewUrl: null,
      audioObjectKey: "music-originals/hidden/internal-only.mp3",
      reason: "Preview is disabled for this track."
    });

    await context.app.close();
  });

  it("returns 404 for a missing single-track ID", async () => {
    const catalogPath = await writeFixtureCatalog();
    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        MUSIC_R2_CATALOG_PATH: catalogPath
      }
    });

    const response = await context.app.inject({
      method: "GET",
      url: "/api/music/catalog/missing%2Ftrack"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Music track not found."
    });

    await context.app.close();
  });

  it("returns a safe preview payload in object-key-only mode", async () => {
    const catalogPath = await writeFixtureCatalog();
    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        MUSIC_R2_CATALOG_PATH: catalogPath
      }
    });

    const response = await context.app.inject({
      method: "GET",
      url: "/api/music/catalog/other%2Funsafe-track/preview-url"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      trackId: "other/unsafe-track",
      encodedTrackId: "other%2Funsafe-track",
      urlMode: "object_key_only",
      playableInBrowser: false,
      audioPreviewUrl: null,
      audioObjectKey: "music-originals/other/unsafe-track.mp3",
      reason: "Only an R2 object key is available; browser playback needs a safe public or signed URL."
    });

    await context.app.close();
  });
});
