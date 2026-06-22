import {describe, expect, it} from "vitest";
import {
  MusicReferenceSchema,
  UnifiedRenderManifestSchema,
} from "./unified-render-manifest.js";

describe("UnifiedRenderManifestSchema", () => {
  const baseManifest = {
    version: "2.0",
    jobId: "123e4567-e89b-12d3-a456-426614174000",
    seed: 12345,
    createdAt: "2026-01-01T00:00:00.000Z",
    durationFrames: 300,
    fps: 30,
    width: 1920,
    height: 1080,
    source: {
      videoUrl: "/uploads/job-1/video.mp4",
      audioUrl: "C:/prometheus/uploads/job-1/video.mp4",
      transcript: [],
      durationMs: 10000,
      width: 1920,
      height: 1080,
      fps: 30,
    },
    audio: {
      beats: [],
      onsets: [],
      sfx: [],
      voiceVolumeDb: 0,
      musicVolumeDb: -18,
      targetLufs: -14,
    },
    timeline: [],
    creativeProfile: {
      name: "joseph_aggressive",
      cutDensity: 0.8,
      textDensity: 0.8,
      sfxDensity: 0.8,
      cameraAggression: 0.8,
      colorIntensity: 0.7,
    },
    output: {
      width: 1920,
      height: 1080,
      fps: 30,
      codec: "h264",
      crf: 18,
    },
  };

  it("requires the Joseph root arrays and timing metadata", () => {
    const manifest = UnifiedRenderManifestSchema.parse({
      ...baseManifest,
      videoTracks: [{sourcePath: "/uploads/job-1/video.mp4", startFrame: 0, endFrame: 299}],
      cameraMoves: [{type: "push_in", startFrame: 0, endFrame: 60}],
      textOverlays: [{text: "WIN", startFrame: 10, endFrame: 30, animation: "pop", color: "#FF0040"}],
      transitions: [{startFrame: 100, endFrame: 112}],
    });

    expect(manifest.durationFrames).toBe(300);
    expect(manifest.videoTracks).toHaveLength(1);
    expect(manifest.cameraMoves[0]?.type).toBe("push_in");
    expect(manifest.textOverlays[0]?.animation).toBe("pop");
    expect(manifest.transitions[0]?.startFrame).toBe(100);
  });

  it("defaults the root arrays when omitted", () => {
    const manifest = UnifiedRenderManifestSchema.parse(baseManifest);

    expect(manifest.videoTracks).toEqual([]);
    expect(manifest.cameraMoves).toEqual([]);
    expect(manifest.textOverlays).toEqual([]);
    expect(manifest.transitions).toEqual([]);
  });

  it("rejects incomplete text overlays at the root seam", () => {
    const result = UnifiedRenderManifestSchema.safeParse({
      ...baseManifest,
      textOverlays: [{text: "WIN", startFrame: 10, endFrame: 30, color: "#FF0040"}],
    });

    expect(result.success).toBe(false);
  });

  it("accepts deterministic SFX variant metadata without changing semantic cue names", () => {
    const manifest = UnifiedRenderManifestSchema.parse({
      ...baseManifest,
      audio: {
        ...baseManifest.audio,
        sfx: [{
          id: "cut-1",
          cue: "whoosh_fast",
          variant: 3,
          triggerMs: 500,
          durationMs: 250,
          volumeDb: -12,
          duckMusicDb: -6,
        }],
      },
    });

    expect(manifest.audio.sfx[0]?.cue).toBe("whoosh_fast");
    expect(manifest.audio.sfx[0]?.variant).toBe(3);
  });

  it("rejects SFX variants outside the supported 1 to 5 range", () => {
    const result = UnifiedRenderManifestSchema.safeParse({
      ...baseManifest,
      audio: {
        ...baseManifest.audio,
        sfx: [{
          id: "cut-1",
          cue: "whoosh_fast",
          variant: 6,
          triggerMs: 500,
        }],
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts Joseph typography metadata for render-time font loading", () => {
    const manifest = UnifiedRenderManifestSchema.parse({
      ...baseManifest,
      typography: {
        fontId: "hero-berylium",
        fontFamily: "Prometheus Hero Berylium",
        fontAssetUrl: "/fonts/hero/berylium-rg-67d7e31492fa.otf",
        fallbackFamily: "Arial, sans-serif",
      },
    });

    expect(manifest.typography?.fontFamily).toBe("Prometheus Hero Berylium");
    expect(manifest.typography?.fontAssetUrl).toBe("/fonts/hero/berylium-rg-67d7e31492fa.otf");
  });

  it("rejects typography font assets that cannot load in the browser", () => {
    const result = UnifiedRenderManifestSchema.safeParse({
      ...baseManifest,
      typography: {
        fontId: "bad-font",
        fontFamily: "Bad Font",
        fontAssetUrl: "C:/fonts/bad.ttf",
        fallbackFamily: "Arial, sans-serif",
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts render-safe music references with an FFmpeg local path", () => {
    const reference = MusicReferenceSchema.parse({
      trackId: "local-brutal-wishes",
      title: "Brutal Wishes",
      sourceKind: "local",
      localFilePath: "C:/music/Brutal Wishes.mp3",
      browserUrl: "/music/Brutal%20Wishes.mp3",
      durationSeconds: 120,
      renderSafe: true,
      licenseStatus: "local_user_supplied",
    });

    expect(reference.renderSafe).toBe(true);
    expect(reference.localFilePath).toBe("C:/music/Brutal Wishes.mp3");
  });

  it("rejects music references without an absolute local FFmpeg path", () => {
    const result = MusicReferenceSchema.safeParse({
      trackId: "remote-only",
      title: "Remote Only",
      sourceKind: "r2",
      localFilePath: "r2://bucket/key.mp3",
      durationSeconds: 120,
      renderSafe: true,
      licenseStatus: "licensed",
    });

    expect(result.success).toBe(false);
  });
});