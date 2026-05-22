import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {
  MusicApiError,
  buildJobMusicPreflightPath,
  buildMusicCatalogSearchParams,
  buildMusicDjStatePath,
  buildMusicOverridesPath,
  buildMusicRehearsalPath,
  buildVideoAwareAudioPlanPath,
  buildVideoAwareSoundManifestPath,
  getMusicDjState,
  getMusicPreviewUrl,
  getMusicTrack,
  listMusicCatalog,
  runMusicPreflight,
  runMusicRehearsal,
  submitMusicOverride
} from "../music/music-api";

const originalFetch = globalThis.fetch;

describe("music-api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.VITE_MUSIC_CATALOG_BASE_URL;
    delete process.env.NEXT_PUBLIC_MUSIC_CATALOG_BASE_URL;
  });

  it("encodes slash-containing track IDs for track and preview endpoints", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "cinematic/trailer",
        title: "Cinematic Trailer",
        category: "cinematic",
        genreTags: [],
        moodTags: [],
        useCaseTags: [],
        avoidWhen: [],
        previewAllowed: true,
        renderAllowed: false,
        analysisStatus: "pending",
        licenseSummary: {
          licenseType: "unknown",
          commercialAllowed: false,
          attributionRequired: false,
          licenseVerified: false
        }
      }), {
        status: 200,
        headers: {"Content-Type": "application/json"}
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        trackId: "cinematic/trailer",
        encodedTrackId: "cinematic%2Ftrailer",
        urlMode: "object_key_only",
        playableInBrowser: false,
        audioObjectKey: "music-originals/cinematic trailer.mp3",
        reason: "Signed or public preview URL is not configured."
      }), {
        status: 200,
        headers: {"Content-Type": "application/json"}
      }));

    globalThis.fetch = fetchMock as typeof fetch;
    await getMusicTrack("cinematic/trailer");
    await getMusicPreviewUrl("cinematic/trailer");

    const calledUrls = (fetchMock.mock.calls as Array<unknown[]>).map((call) => String(call[0]));
    expect(calledUrls[0]).toBe("http://localhost:8000/api/music/catalog/cinematic%2Ftrailer");
    expect(calledUrls[1]).toBe("http://localhost:8000/api/music/catalog/cinematic%2Ftrailer/preview-url");
  });

  it("builds list query params correctly", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({
        tracks: [],
        total: 0,
        limit: 25,
        offset: 10,
        urlMode: "object_key_only",
        categories: ["cinematic"]
      }), {
        status: 200,
        headers: {"Content-Type": "application/json"}
      });
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const params = buildMusicCatalogSearchParams({
      category: "Cinematic",
      genre: "Epic",
      useCase: "Intro",
      search: "pulse",
      limit: 25,
      offset: 10,
      includeUnsafe: true
    });

    expect(params.toString()).toBe("category=Cinematic&genre=Epic&useCase=Intro&search=pulse&limit=25&offset=10&includeUnsafe=true");

    await listMusicCatalog({
      category: "Cinematic",
      genre: "Epic",
      useCase: "Intro",
      search: "pulse",
      limit: 25,
      offset: 10,
      includeUnsafe: true
    });

    const calledUrls = (fetchMock.mock.calls as Array<unknown[]>).map((call) => String(call[0]));
    expect(calledUrls[0]).toBe(
      "http://localhost:8000/api/music/catalog?category=Cinematic&genre=Epic&useCase=Intro&search=pulse&limit=25&offset=10&includeUnsafe=true"
    );
  });

  it("uses a dedicated music catalog base URL when configured", async () => {
    process.env.VITE_MUSIC_CATALOG_BASE_URL = "http://localhost:3000";

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({
        tracks: [],
        total: 0,
        limit: 50,
        offset: 0,
        urlMode: "public_url",
        categories: ["cinematic"]
      }), {
        status: 200,
        headers: {"Content-Type": "application/json"}
      });
    });

    globalThis.fetch = fetchMock as typeof fetch;
    await listMusicCatalog();

    const calledUrls = (fetchMock.mock.calls as Array<unknown[]>).map((call) => String(call[0]));
    expect(calledUrls[0]).toBe("http://localhost:3000/api/music/catalog");
  });

  it("accepts signed_url preview responses as browser playable", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({
        trackId: "cinematic/trailer",
        encodedTrackId: "cinematic%2Ftrailer",
        urlMode: "signed_url",
        playableInBrowser: true,
        audioPreviewUrl: "https://cdn.example.com/signed.mp3",
        ttlSeconds: 900,
        reason: "Signed preview ready."
      }), {
        status: 200,
        headers: {"Content-Type": "application/json"}
      });
    });

    globalThis.fetch = fetchMock as typeof fetch;
    const response = await getMusicPreviewUrl("cinematic/trailer");

    expect(response.urlMode).toBe("signed_url");
    expect(response.playableInBrowser).toBe(true);
    expect(response.audioPreviewUrl).toBe("https://cdn.example.com/signed.mp3");
  });

  it("throws a safe typed error on API failure", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({
        reason: "Preview access is blocked for this track."
      }), {
        status: 403,
        headers: {"Content-Type": "application/json"}
      });
    });

    globalThis.fetch = fetchMock as typeof fetch;

    await expect(getMusicPreviewUrl("blocked/track")).rejects.toMatchObject({
      name: "MusicApiError",
      status: 403,
      message: "Preview access is blocked for this track."
    } satisfies Partial<MusicApiError>);
  });

  it("builds job-scoped music control-plane paths correctly", () => {
    expect(buildMusicDjStatePath("job/alpha")).toBe("/api/jobs/job%2Falpha/music/state");
    expect(buildVideoAwareAudioPlanPath("job/alpha")).toBe("/api/jobs/job%2Falpha/video-aware-audio-plan");
    expect(buildVideoAwareSoundManifestPath("job/alpha")).toBe("/api/jobs/job%2Falpha/video-aware-sound-manifest");
    expect(buildMusicRehearsalPath("job/alpha")).toBe("/api/jobs/job%2Falpha/music/rehearsal");
    expect(buildJobMusicPreflightPath("job/alpha")).toBe("/api/jobs/job%2Falpha/music/preflight");
    expect(buildMusicOverridesPath("job/alpha")).toBe("/api/jobs/job%2Falpha/music/overrides");
  });

  it("returns a safe empty DJ state on 404", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({
        error: "Job not found."
      }), {
        status: 404,
        headers: {"Content-Type": "application/json"}
      });
    });

    globalThis.fetch = fetchMock as typeof fetch;
    const response = await getMusicDjState("job/missing");

    expect(response).toMatchObject({
      jobId: "job/missing",
      hasAudioPlan: false,
      hasSoundManifest: false,
      hasPreflight: false,
      musicEvents: [],
      sfxEvents: [],
      renderAllowed: false,
      canRenderMusic: false
    });
  });

  it("posts rehearsal with safe defaults", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({
        jobId: "job/alpha",
        audioPlanArtifactPath: "jobs/job-alpha/audio/video-aware-audio-plan.json",
        soundManifestArtifactPath: "jobs/job-alpha/audio/video-aware-sound-manifest.json",
        timelineSegmentCount: 3,
        musicEventCount: 1,
        sfxEventCount: 2,
        transitionEventCount: 0,
        duckingRegionCount: 1,
        manifestDuration: 18,
        warnings: [],
        planMode: "dry_run",
        createdAt: "2026-05-15T00:00:00.000Z"
      }), {
        status: 200,
        headers: {"Content-Type": "application/json"}
      });
    });

    globalThis.fetch = fetchMock as typeof fetch;
    await runMusicRehearsal("job/alpha");
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as unknown as [unknown, RequestInit | undefined];

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(calledUrl)).toBe("http://localhost:8000/api/jobs/job%2Falpha/music/rehearsal");
    expect(calledInit).toMatchObject({
      method: "POST"
    });
    expect(JSON.parse(String(calledInit?.body))).toMatchObject({
      useCatalogCandidates: true,
      overwrite: true
    });
  });

  it("posts preflight safely", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({
        artifactType: "video_aware_music_preflight",
        jobId: "job/alpha",
        sourceAudioPlanId: "plan_alpha",
        sourceSoundManifestArtifactPath: "jobs/job-alpha/audio/video-aware-sound-manifest.json",
        status: "warn",
        canRender: false,
        planMode: "dry_run",
        checkedAt: "2026-05-15T00:00:00.000Z",
        summary: {
          musicEventCount: 1,
          sfxEventCount: 1,
          transitionEventCount: 0,
          placeholderMusicCount: 0,
          unverifiedTrackCount: 1,
          missingFileCount: 0,
          timingIssueCount: 0,
          licenseIssueCount: 1
        },
        issues: [],
        warnings: [],
        nextActions: []
      }), {
        status: 200,
        headers: {"Content-Type": "application/json"}
      });
    });

    globalThis.fetch = fetchMock as typeof fetch;
    await runMusicPreflight("job/alpha");
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as unknown as [unknown, RequestInit | undefined];

    expect(String(calledUrl)).toBe("http://localhost:8000/api/jobs/job%2Falpha/music/preflight");
    expect(JSON.parse(String(calledInit?.body))).toMatchObject({
      strict: false,
      requireRenderReady: false
    });
  });

  it("posts overrides with the selected track ID", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({
        override: {
          id: "job-alpha-override-01",
          jobId: "job/alpha",
          targetType: "preview",
          targetId: null,
          startSec: null,
          endSec: null,
          trackId: "catalog/track-a",
          action: "use_catalog_track",
          reason: null,
          createdAt: "2026-05-15T00:00:00.000Z"
        },
        updatedAudioPlanSummary: null,
        preflightStatus: "warn",
        warnings: []
      }), {
        status: 200,
        headers: {"Content-Type": "application/json"}
      });
    });

    globalThis.fetch = fetchMock as typeof fetch;
    await submitMusicOverride("job/alpha", {
      targetType: "preview",
      action: "use_catalog_track",
      trackId: "catalog/track-a",
      rebuildPlan: true
    });
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as unknown as [unknown, RequestInit | undefined];

    expect(String(calledUrl)).toBe("http://localhost:8000/api/jobs/job%2Falpha/music/overrides");
    expect(JSON.parse(String(calledInit?.body))).toMatchObject({
      targetType: "preview",
      action: "use_catalog_track",
      trackId: "catalog/track-a",
      rebuildPlan: true
    });
  });
});
