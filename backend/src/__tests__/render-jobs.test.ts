import {readFile} from "node:fs/promises";
import path from "node:path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";
import type {UnifiedRenderManifest} from "@prometheus/shared-types";

import {buildRenderManifest, type DirectorNotes} from "../render-jobs/manifest-bridge";
import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

const fixturePath = path.join(process.cwd(), "src", "__tests__", "fixtures", "creative-decision-manifest.fixture.json");

const sampleDirectorNotes: DirectorNotes = {
  version: "1.0",
  emotionalArc: [
    {
      id: "beat-1",
      timestamp: [0, 350],
      emotion: "tension",
      intensity: 0.78,
      motionVocabulary: ["aggressive-entrance", "snap-focus"],
      cameraDirective: {
        type: "push-in",
        target: [0, 0, 0],
        intensity: 0.7,
        overshoot: 0.35,
        coupling: "tight"
      },
      why: "The first words need pressure before the idea opens up."
    },
    {
      id: "beat-2",
      timestamp: [350, 1500],
      emotion: "release",
      intensity: 0.42,
      motionVocabulary: ["slow-drift"],
      cameraDirective: null,
      why: "The phrase relaxes after the initial hit."
    }
  ],
  temporalIntensity: {
    points: [
      {t: 0, intensity: 0.2, derivative: 0},
      {t: 0.2, intensity: 0.55, derivative: 1.2},
      {t: 0.35, intensity: 0.82, derivative: 2},
      {t: 0.6, intensity: 0.5, derivative: -0.9},
      {t: 1, intensity: 0.35, derivative: -0.3},
      {t: 1.4, intensity: 0.5, derivative: 0.4},
      {t: 1.8, intensity: 0.7, derivative: 0.8},
      {t: 2.2, intensity: 0.4, derivative: -0.6}
    ]
  },
  imperfectionProfile: {
    timingNoiseMs: 16,
    spacingVariance: 0.08,
    easingPerturbation: 0.05,
    rotationalDrift: 0.09
  },
  globalCameraStrategy: "aggressive",
  assetDirectives: []
};

const sampleUnifiedManifest = (jobId = "123e4567-e89b-12d3-a456-426614174100"): UnifiedRenderManifest => ({
  version: "2.0",
  jobId,
  seed: 12345,
  createdAt: "2026-01-01T00:00:00.000Z",
  durationFrames: 90,
  fps: 30,
  width: 1080,
  height: 1920,
  videoTracks: [{sourcePath: "/uploads/job-1/source.mp4", startFrame: 0, endFrame: 89}],
  cameraMoves: [{type: "push_in", startFrame: 0, endFrame: 45}],
  textOverlays: [{text: "BUILD", startFrame: 8, endFrame: 42, animation: "pop", color: "#FF0040"}],
  transitions: [{startFrame: 55, endFrame: 66}],
  source: {
    videoUrl: "/uploads/job-1/source.mp4",
    audioUrl: "C:/prometheus/uploads/job-1/source.mp4",
    transcript: [{text: "Build", startMs: 0, endMs: 1200, confidence: 0.99}],
    durationMs: 3000,
    width: 1080,
    height: 1920,
    fps: 30,
  },
  audio: {
    beats: [400, 900, 1500],
    onsets: [0, 900],
    sfx: [],
    voiceVolumeDb: 0,
    musicVolumeDb: -18,
    targetLufs: -14,
  },
  timeline: [],
  creativeProfile: {
    name: "joseph_cinematic",
    cutDensity: 0.5,
    textDensity: 0.6,
    sfxDensity: 0.2,
    cameraAggression: 0.5,
    colorIntensity: 0.5,
  },
  output: {
    width: 1080,
    height: 1920,
    fps: 30,
    codec: "h264",
    crf: 18,
  },
});

describe("render job bridge", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("translates a CreativeDecisionManifest into the worker render manifest shape", async () => {
    const creativeManifest = JSON.parse(await readFile(fixturePath, "utf8")) as Record<string, unknown>;
    creativeManifest.matteZ = 4;
    creativeManifest.wordStagger = 0.2;
    creativeManifest.extrudeDepth = 0.18;
    creativeManifest.bevelEnabled = false;
    creativeManifest.bevelSize = 0.03;
    creativeManifest.bevelThickness = 0.04;
    creativeManifest.gradientColors = ["#ffffff", "#7be8ff"];
    creativeManifest.envMapIntensity = 0.35;
    creativeManifest.cameraPath = {
      keyframes: [
        {position: {x: 0, y: 1, z: 40}, lookAt: {x: 2, y: 3, z: 0}, roll: 0.1},
        {position: {x: 4, y: 5, z: 6}, lookAt: {x: 7, y: 8, z: 9}}
      ]
    };
    creativeManifest.autoRoll = false;
    creativeManifest.autoRollIntensity = 0.45;
    creativeManifest.matteSafeZone = {
      minX: -0.2,
      maxX: 0.3,
      minY: -0.1,
      maxY: 0.25
    };
    creativeManifest.depthOfFieldEnabled = true;
    creativeManifest.depthOfFieldFocusDistance = 12;
    creativeManifest.depthOfFieldFalloff = 6;
    creativeManifest.deviceMockup = {
      id: "hero-phone",
      deviceType: "phone",
      position: [1, 2, -3],
      rotation: [0, 0.18, 0],
      scale: 1.2,
      screen: {
        color: "#2563eb",
        label: "PROMETHEUS"
      }
    };
    creativeManifest.textAnimationGrammar = {
      version: "prometheus-text-grammar/v1",
      stagger: {
        unit: "word",
        delayMs: 200
      },
      entrance: {
        type: "slide",
        durationMs: 320
      },
      sync: {
        mode: "toBeat",
        offsetMs: -20
      },
      selectiveEffects: [{
        selector: {
          text: "premium"
        },
        effects: {
          bloom: true,
          motionBlur: false,
          chromaticAberration: false
        }
      }]
    };
    creativeManifest.postProcessing = {
      bloomEnabled: false,
      bloomStrength: 2.1,
      bloomRadius: 0.7,
      bloomThreshold: 0.6,
      motionBlurEnabled: true,
      motionBlurStrength: 0.8,
      chromaticAberrationEnabled: false,
      chromaticAberrationOffset: 0.006,
      vignetteEnabled: true,
      vignetteDarkness: 0.65,
      vignetteOffset: 0.4,
      lutEnabled: true,
      lutUrl: "/luts/lusion.cube"
    };
    const manifest = buildRenderManifest({
      creativeManifest,
      directorNotes: sampleDirectorNotes,
      fontUrl: "/fonts/retrieved/satoshi.ttf",
      backgroundVideoUrl: "/media/background.mp4",
      rvmMatteUrl: "/media/matte.webm",
      audioUrl: "/media/audio.m4a",
      baseUrl: "http://localhost:8000"
    });

    expect(manifest.jobId).toMatch(/[0-9a-f-]{36}/);
    expect(manifest.transcript).toBe("I want you to build premium systems.");
    expect(manifest.transcriptWords[0]).toEqual({
      text: "I",
      startMs: 0,
      endMs: 120,
      confidence: 0.99,
      semanticTag: "aggressive-entrance"
    });
    expect(manifest.fontUrl).toBe("http://localhost:8000/fonts/retrieved/satoshi.ttf");
    expect(manifest.backgroundVideoUrl).toBe("http://localhost:8000/media/background.mp4");
    expect(manifest.rvmMatteUrl).toBe("http://localhost:8000/media/matte.webm");
    expect(manifest.matteUrl).toBe(manifest.rvmMatteUrl);
    expect(manifest.durationInFrames).toBe(300);
    expect(manifest.fps).toBe(30);
    expect(manifest.matteZ).toBe(4);
    expect(manifest.wordStagger).toBe(0.2);
    expect(manifest.extrudeDepth).toBe(0.18);
    expect(manifest.bevelEnabled).toBe(false);
    expect(manifest.bevelSize).toBe(0.03);
    expect(manifest.bevelThickness).toBe(0.04);
    expect(manifest.gradientColors).toEqual(["#ffffff", "#7be8ff"]);
    expect(manifest.envMapIntensity).toBe(0.35);
    expect(manifest.cameraKeyframes).toEqual([
      {position: {x: 0, y: 1, z: 40}, lookAt: {x: 2, y: 3, z: 0}, roll: 0.1},
      {position: {x: 4, y: 5, z: 6}, lookAt: {x: 7, y: 8, z: 9}, roll: 0}
    ]);
    expect(manifest.autoRoll).toBe(false);
    expect(manifest.autoRollIntensity).toBe(0.45);
    expect(manifest.matteSafeZone).toEqual({
      minX: -0.2,
      maxX: 0.3,
      minY: -0.1,
      maxY: 0.25
    });
    expect(manifest.depthOfFieldEnabled).toBe(true);
    expect(manifest.depthOfFieldFocusDistance).toBe(12);
    expect(manifest.depthOfFieldFalloff).toBe(6);
    expect(manifest.deviceMockup).toEqual({
      id: "hero-phone",
      deviceType: "phone",
      position: [1, 2, -3],
      rotation: [0, 0.18, 0],
      scale: 1.2,
      screen: {
        color: "#2563eb",
        label: "PROMETHEUS"
      }
    });
    expect(manifest.textAnimationGrammar?.stagger.delayMs).toBe(200);
    expect(manifest.textAnimationGrammar?.entrance.type).toBe("slide");
    expect(manifest.textAnimationGrammar?.sync.mode).toBe("toBeat");
    expect(manifest.bloomEnabled).toBe(false);
    expect(manifest.bloomStrength).toBe(2.1);
    expect(manifest.bloomRadius).toBe(0.7);
    expect(manifest.bloomThreshold).toBe(0.6);
    expect(manifest.motionBlurEnabled).toBe(true);
    expect(manifest.motionBlurStrength).toBe(0.8);
    expect(manifest.chromaticAberrationEnabled).toBe(false);
    expect(manifest.chromaticAberrationOffset).toBe(0.006);
    expect(manifest.vignetteEnabled).toBe(true);
    expect(manifest.vignetteDarkness).toBe(0.65);
    expect(manifest.vignetteOffset).toBe(0.4);
    expect(manifest.lutEnabled).toBe(true);
    expect(manifest.lutUrl).toBe("/luts/lusion.cube");
    expect(manifest.text.sdfGlyphSize).toBe(96);
    const directorialMetadata = manifest.directorialMetadata;
    expect(directorialMetadata).toEqual({
      emotionalArc: sampleDirectorNotes.emotionalArc,
      temporalIntensity: sampleDirectorNotes.temporalIntensity,
      imperfectionProfile: sampleDirectorNotes.imperfectionProfile,
      globalCameraStrategy: "aggressive",
      motionVocabulary: ["aggressive-entrance", "snap-focus", "slow-drift"]
    });
    expect(manifest.transcriptWords.every((word) => typeof word.semanticTag === "string")).toBe(true);
    expect(manifest.transcriptWords[0]?.semanticTag).toBe("aggressive-entrance");
    if (!directorialMetadata) {
      throw new Error("Expected bridge to preserve directorial metadata");
    }
    expect(directorialMetadata.temporalIntensity.points.length).toBeGreaterThanOrEqual(8);
  });

  it("rejects worker font URLs that Troika cannot render", async () => {
    const creativeManifest = JSON.parse(await readFile(fixturePath, "utf8")) as Record<string, unknown>;

    expect(() => buildRenderManifest({
      creativeManifest,
      directorNotes: sampleDirectorNotes,
      fontUrl: "/fonts/retrieved/satoshi.woff2",
      backgroundVideoUrl: "/media/background.mp4",
      rvmMatteUrl: "/media/matte.webm",
      audioUrl: "/media/audio.m4a",
      baseUrl: "http://localhost:8000"
    })).toThrow(/Troika-compatible.*ttf.*woff/i);
  });

  it("queues, leases, completes, and exposes legacy bridge render jobs through the explicit legacy Fastify API", async () => {
    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        API_BASE: "http://localhost:8000"
      }
    });
    const creativeManifest = JSON.parse(await readFile(fixturePath, "utf8")) as Record<string, unknown>;

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/v1/render/jobs/legacy",
      payload: {
        creative_manifest: creativeManifest,
        director_notes: sampleDirectorNotes,
        font_url: "/fonts/retrieved/satoshi.ttf",
        background_video_url: "/media/background.mp4",
        rvm_matte_url: "/media/matte.webm",
        audio_url: "/media/audio.m4a"
      }
    });

    expect(createResponse.statusCode).toBe(200);
    const createBody = createResponse.json();
    expect(createBody.status).toBe("queued");
    expect(createBody.manifest.fontUrl).toMatch(/^http:\/\//);
    expect(createBody.manifest.directorialMetadata.emotionalArc[0].why).toContain("pressure");

    const nextResponse = await context.app.inject({
      method: "GET",
      url: "/api/v1/render/jobs/legacy/next"
    });

    expect(nextResponse.statusCode).toBe(200);
    expect(nextResponse.json().jobId).toBe(createBody.jobId);

    const statusResponse = await context.app.inject({
      method: "GET",
      url: `/api/v1/render/jobs/${createBody.jobId}`
    });
    expect(statusResponse.json().status).toBe("leased");

    const completeResponse = await context.app.inject({
      method: "POST",
      url: `/api/v1/render/jobs/${createBody.jobId}/complete`,
      payload: {
        outputUrl: "/tmp/output.mp4"
      }
    });
    expect(completeResponse.statusCode).toBe(200);
    expect(completeResponse.json().status).toBe("completed");

    await context.app.close();
  });

  it("queues and leases Joseph jobs as raw UnifiedRenderManifest payloads", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const manifest = sampleUnifiedManifest();
    const evidencePath = path.join(tempDir, "evidence", manifest.jobId);

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/v1/render/jobs",
      payload: {
        manifest,
        variationKey: "variation:upload-1:retry-0",
        evidencePath,
      },
    });

    expect(createResponse.statusCode).toBe(202);
    const createBody = createResponse.json();
    expect(createBody).toEqual(expect.objectContaining({
      jobId: manifest.jobId,
      status: "queued",
      variationKey: "variation:upload-1:retry-0",
      evidencePath,
    }));
    expect(createBody.manifest).toEqual(manifest);

    const nextResponse = await context.app.inject({
      method: "GET",
      url: "/api/v1/render/jobs/next",
    });

    expect(nextResponse.statusCode).toBe(200);
    expect(nextResponse.json()).toEqual(manifest);
    expect(nextResponse.json()).not.toHaveProperty("manifest");

    const statusResponse = await context.app.inject({
      method: "GET",
      url: `/api/v1/render/jobs/${manifest.jobId}`,
    });
    expect(statusResponse.json()).toEqual(expect.objectContaining({
      id: manifest.jobId,
      kind: "joseph",
      status: "leased",
      variationKey: "variation:upload-1:retry-0",
      evidencePath,
      failureTags: [],
      error: null,
    }));
    expect(statusResponse.json().leaseExpiresAt).toEqual(expect.any(String));

    const completeResponse = await context.app.inject({
      method: "POST",
      url: `/api/v1/render/jobs/${manifest.jobId}/complete`,
      payload: {
        outputUrl: "/tmp/output.mp4",
      },
    });

    expect(completeResponse.statusCode).toBe(200);
    expect(completeResponse.json()).toEqual({
      jobId: manifest.jobId,
      status: "completed",
    });

    await context.app.close();
  });

  it("rejects legacy bridge payloads at the Joseph UnifiedRenderManifest route", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const creativeManifest = JSON.parse(await readFile(fixturePath, "utf8")) as Record<string, unknown>;

    const response = await context.app.inject({
      method: "POST",
      url: "/api/v1/render/jobs",
      payload: {
        creative_manifest: creativeManifest,
        director_notes: sampleDirectorNotes,
        font_url: "/fonts/retrieved/satoshi.ttf",
        background_video_url: "/media/background.mp4",
        rvm_matte_url: "/media/matte.webm",
        audio_url: "/media/audio.m4a",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toEqual(expect.objectContaining({
      code: "invalid_unified_render_manifest",
      message: expect.stringContaining("UnifiedRenderManifest"),
      issues: expect.arrayContaining([
        expect.objectContaining({path: expect.stringContaining("manifest")}),
      ]),
    }));

    await context.app.close();
  });

  it("marks Joseph jobs failed with tags and writes failure evidence", async () => {
    const context = await createTestApp({storageDir: tempDir});
    const manifest = sampleUnifiedManifest("123e4567-e89b-12d3-a456-426614174101");
    const evidencePath = path.join(tempDir, "evidence", manifest.jobId);

    await context.app.inject({
      method: "POST",
      url: "/api/v1/render/jobs",
      payload: {
        manifest,
        variationKey: "variation:upload-1:retry-1",
        evidencePath,
      },
    });

    await context.app.inject({
      method: "GET",
      url: "/api/v1/render/jobs/next",
    });

    const failureResponse = await context.app.inject({
      method: "POST",
      url: `/api/v1/render/jobs/${manifest.jobId}/failed`,
      payload: {
        errorMessage: "UnifiedRenderManifest validation failed in worker",
        failureTags: ["manifest_schema", "worker_validation"],
      },
    });

    expect(failureResponse.statusCode).toBe(200);
    expect(failureResponse.json()).toEqual({
      jobId: manifest.jobId,
      status: "failed",
      failureTags: ["manifest_schema", "worker_validation"],
    });

    const statusResponse = await context.app.inject({
      method: "GET",
      url: `/api/v1/render/jobs/${manifest.jobId}`,
    });
    expect(statusResponse.json()).toEqual(expect.objectContaining({
      status: "failed",
      error: "UnifiedRenderManifest validation failed in worker",
      failureTags: ["manifest_schema", "worker_validation"],
    }));

    const failureEvidence = JSON.parse(await readFile(path.join(evidencePath, "render-failure.json"), "utf8"));
    expect(failureEvidence).toEqual(expect.objectContaining({
      jobId: manifest.jobId,
      errorMessage: "UnifiedRenderManifest validation failed in worker",
      failureTags: ["manifest_schema", "worker_validation"],
    }));

    await context.app.close();
  });
});
