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

  it("accepts inspectable Joseph micro-animation primitive metadata", () => {
    const manifest = UnifiedRenderManifestSchema.parse({
      ...baseManifest,
      textOverlays: [{
        text: "WIN",
        startFrame: 10,
        endFrame: 30,
        animation: "elastic_scale",
        color: "#FF0040",
        microAnimation: {
          primitiveId: "text-entry.word-riser",
          family: "text_entry",
          role: "entry",
          renderFallback: "elastic_scale",
          combinationGroup: "entry",
          semanticRole: "hero",
          parameters: {
            intensity: 0.82,
            durationMs: 420,
            delayMs: 0,
            anchor: "word",
            direction: "up",
          },
        },
      }],
      microAnimationAudit: {
        taxonomyVersion: "joseph-micro-animation-v1",
        primitiveIds: ["text-entry.word-riser"],
        score: 0.94,
        failures: [],
        warnings: ["entry-only support lane"],
      },
    });

    expect(manifest.textOverlays[0]?.microAnimation?.primitiveId).toBe("text-entry.word-riser");
    expect(manifest.microAnimationAudit?.taxonomyVersion).toBe("joseph-micro-animation-v1");
  });

  it("accepts an inspectable Joseph picture-in-picture composition plan", () => {
    const manifest = UnifiedRenderManifestSchema.parse({
      ...baseManifest,
      josephPiP: {
        version: "joseph-pip-v1",
        layout: "speaker_right_text_left",
        sourceTrackId: "primary",
        subjectAnchor: {
          xPercent: 51,
          yPercent: 34,
          confidence: 0.82,
          source: "heuristic",
        },
        frame: {
          leftPercent: 58,
          topPercent: 12,
          widthPercent: 34,
          heightPercent: 38,
          borderRadiusPx: 28,
          safeMarginPercent: 4,
          depth: "subject",
        },
        dockingPosition: "upper_right",
        availableMotionBehaviors: ["enter", "dock", "expand", "collapse", "handoff"],
        activeMotion: [
          {behavior: "enter", startFrame: 0, endFrame: 20, easing: "ease_out"},
          {behavior: "dock", startFrame: 20, endFrame: 60, easing: "ease_in_out"},
          {behavior: "handoff", startFrame: 60, endFrame: 90, easing: "ease_out"},
        ],
        typographyZones: [
          {
            role: "hero",
            leftPercent: 7,
            topPercent: 14,
            widthPercent: 43,
            heightPercent: 28,
            align: "left",
            minClearancePercent: 6,
          },
        ],
        backgroundLayers: [
          {
            role: "focus_field",
            leftPercent: 54,
            topPercent: 8,
            widthPercent: 42,
            heightPercent: 46,
            intensity: 0.64,
          },
        ],
        coexistenceRules: {
          preserveSubjectFocus: true,
          protectTypography: true,
          textClearancePercent: 6,
          backgroundDefocus: 0.42,
        },
      },
    });

    expect(manifest.josephPiP?.layout).toBe("speaker_right_text_left");
    expect(manifest.josephPiP?.availableMotionBehaviors).toEqual(
      expect.arrayContaining(["enter", "dock", "expand", "collapse", "handoff"]),
    );
    expect(manifest.josephPiP?.typographyZones[0]?.minClearancePercent).toBeGreaterThan(0);
  });

  it("accepts an inspectable Joseph background primitive plan", () => {
    const manifest = UnifiedRenderManifestSchema.parse({
      ...baseManifest,
      josephBackground: {
        version: "joseph-background-v1",
        catalogVersion: "2026.06",
        selectedPrimitiveIds: [
          "shader.depth-vignette",
          "lightfield.cinematic-bloom",
          "accent.editorial-rails",
        ],
        primitives: [
          {
            primitiveId: "shader.depth-vignette",
            family: "shader_background",
            role: "background",
            layer: "foundation",
            blendMode: "normal",
            renderStrategy: "curated_mesh",
            parameters: {
              colorFamily: "cinematic_cool",
              speed: 0.18,
              noiseIntensity: 0.22,
              bloomIntensity: 0.18,
              distortionAmount: 0.08,
              contrast: 0.68,
              density: 0.42,
              opacity: 0.92,
            },
          },
        ],
        layeringRules: {
          sourceFootageMode: "pip_protected",
          textProtection: "contrast_scrim",
          pipProtection: "reserved_safe_zone",
          overlayInteraction: "accent_below_text",
          maxActivePrimitives: 4,
        },
        parameterAudit: {
          governed: true,
          clampedParameterCount: 0,
          warnings: [],
        },
      },
    });

    expect(manifest.josephBackground?.version).toBe("joseph-background-v1");
    expect(manifest.josephBackground?.selectedPrimitiveIds).toEqual(
      expect.arrayContaining(["shader.depth-vignette"]),
    );
    expect(manifest.josephBackground?.layeringRules.pipProtection).toBe("reserved_safe_zone");
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
