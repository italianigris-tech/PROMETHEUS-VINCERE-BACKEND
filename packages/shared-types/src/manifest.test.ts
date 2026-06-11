import {describe, expect, it} from "vitest";

import {directorNotesSchema, renderManifestSchema, rvmExtractionResponseSchema} from "./manifest.js";

const baseManifest = {
  jobId: "sample-job",
  transcript: "REGENERATE",
  matteUrl: "https://example.com/matte.webm",
  audioUrl: "https://example.com/audio.m4a",
  fontUrl: "https://example.com/font.ttf",
  durationInFrames: 300
};

describe("renderManifestSchema", () => {
  it("defaults the cinematic render contract to 1080p60", () => {
    const manifest = renderManifestSchema.parse(baseManifest);

    expect(manifest.manifestVersion).toBe("prometheus-render-manifest/v1");
    expect(manifest.fps).toBe(60);
    expect(manifest.width).toBe(1920);
    expect(manifest.height).toBe(1080);
    expect(manifest.animationPreset).toBe("cinematic");
    expect(manifest.matteZ).toBe(3);
    expect(manifest.wordStagger).toBe(0.1);
    expect(manifest.extrudeDepth).toBe(0.1);
    expect(manifest.bevelEnabled).toBe(true);
    expect(manifest.bevelSize).toBe(0.02);
    expect(manifest.bevelThickness).toBe(0.02);
    expect(manifest.gradientColors).toEqual(["#ffffff"]);
    expect(manifest.envMapIntensity).toBe(0);
    expect(manifest.chrome).toBe(false);
    expect(manifest.cameraKeyframes).toEqual([
      {position: {x: 0, y: 0, z: 50}, lookAt: {x: 0, y: 0, z: 0}, roll: 0},
      {position: {x: 0, y: 0, z: 5}, lookAt: {x: 0, y: 0, z: 0}, roll: 0},
      {position: {x: 15, y: 5, z: 10}, lookAt: {x: 0, y: 0, z: 0}, roll: 0.2},
      {position: {x: 0, y: 0, z: 50}, lookAt: {x: 0, y: 0, z: 0}, roll: 0}
    ]);
    expect(manifest.autoRoll).toBe(true);
    expect(manifest.autoRollIntensity).toBe(0.3);
    expect(manifest.matteSafeZone).toEqual({
      minX: -0.45,
      maxX: 0.45,
      minY: -0.4,
      maxY: 0.4
    });
    expect(manifest.depthOfFieldEnabled).toBe(false);
    expect(manifest.depthOfFieldFocusDistance).toBe(10);
    expect(manifest.depthOfFieldFalloff).toBe(5);
    expect(manifest.bloomEnabled).toBe(true);
    expect(manifest.bloomStrength).toBe(1.5);
    expect(manifest.bloomRadius).toBe(0.4);
    expect(manifest.bloomThreshold).toBe(0.85);
    expect(manifest.motionBlurEnabled).toBe(true);
    expect(manifest.motionBlurStrength).toBe(0.5);
    expect(manifest.chromaticAberrationEnabled).toBe(true);
    expect(manifest.chromaticAberrationOffset).toBe(0.003);
    expect(manifest.vignetteEnabled).toBe(true);
    expect(manifest.vignetteDarkness).toBe(0.5);
    expect(manifest.vignetteOffset).toBe(0.5);
    expect(manifest.lutEnabled).toBe(false);
    expect(manifest.lutUrl).toBeNull();
    expect(manifest.text.depthZ).toBeLessThan(manifest.matte.planeZ);
  });

  it("accepts Remotion static-file references for local test compositions", () => {
    const manifest = renderManifestSchema.parse({
      ...baseManifest,
      matteUrl: "/static-sample/matte.webm",
      audioUrl: "./samples/audio.m4a",
      fontUrl: "../fonts/Fraunces.ttf"
    });

    expect(manifest.matteUrl).toBe("/static-sample/matte.webm");
  });

  it("preserves chrome text intent for fake environment highlights", () => {
    const manifest = renderManifestSchema.parse({
      ...baseManifest,
      chrome: true
    });

    expect(manifest.chrome).toBe(true);
  });

  it("rejects matte timing that cannot frame-lock to the composition", () => {
    const result = renderManifestSchema.safeParse({
      ...baseManifest,
      fps: 60,
      durationInFrames: 300,
      matte: {
        fps: 30,
        durationInFrames: 299
      }
    });

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path.join("."))).toEqual([
      "matte.fps",
      "matte.durationInFrames"
    ]);
  });

  it("preserves optional directorial metadata and per-word semantic tags", () => {
    const directorNotes = directorNotesSchema.parse({
      version: "1.0",
      emotionalArc: [{
        id: "beat-1",
        timestamp: [0, 1200],
        emotion: "tension",
        intensity: 0.8,
        motionVocabulary: ["aggressive-entrance"],
        cameraDirective: {
          type: "push-in",
          target: [0, 0, 0],
          intensity: 0.7,
          overshoot: 0.4,
          coupling: "tight"
        },
        why: "The opening phrase needs immediate pressure."
      }],
      temporalIntensity: {
        points: [
          {t: 0, intensity: 0.2, derivative: 0},
          {t: 0.4, intensity: 0.8, derivative: 1.5}
        ]
      },
      imperfectionProfile: {
        timingNoiseMs: 18,
        spacingVariance: 0.12,
        easingPerturbation: 0.05,
        rotationalDrift: 0.1
      },
      globalCameraStrategy: "aggressive",
      assetDirectives: []
    });

    const manifest = renderManifestSchema.parse({
      ...baseManifest,
      transcriptWords: [{
        text: "REGENERATE",
        startMs: 0,
        endMs: 1200,
        semanticTag: "aggressive-entrance"
      }],
      directorialMetadata: {
        emotionalArc: directorNotes.emotionalArc,
        temporalIntensity: directorNotes.temporalIntensity,
        imperfectionProfile: directorNotes.imperfectionProfile,
        globalCameraStrategy: directorNotes.globalCameraStrategy,
        motionVocabulary: ["aggressive-entrance"]
      }
    });

    expect(manifest.directorialMetadata?.emotionalArc[0]?.why).toContain("pressure");
    expect(manifest.transcriptWords[0]?.semanticTag).toBe("aggressive-entrance");
  });
});

describe("rvmExtractionResponseSchema", () => {
  it("describes the matte artifact needed by the render worker", () => {
    const response = rvmExtractionResponseSchema.parse({
      jobId: "rvm-job",
      matteUrl: "file:///tmp/rvm-job/matte.webm",
      audioUrl: "file:///tmp/rvm-job/audio.m4a",
      durationSeconds: 5,
      durationInFrames: 300,
      fps: 60,
      width: 1920,
      height: 1080
    });

    expect(response.matteUrl.endsWith("matte.webm")).toBe(true);
  });
});
