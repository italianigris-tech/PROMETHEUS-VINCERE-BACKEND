import {readFile} from "node:fs/promises";
import path from "node:path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {buildRenderManifest} from "../render-jobs/manifest-bridge";
import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

const fixturePath = path.join(process.cwd(), "src", "__tests__", "fixtures", "creative-decision-manifest.fixture.json");

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
      fontUrl: "/fonts/retrieved/satoshi.woff2",
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
      confidence: 0.99
    });
    expect(manifest.fontUrl).toBe("http://localhost:8000/fonts/retrieved/satoshi.woff2");
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
  });

  it("queues, leases, completes, and exposes render jobs through the Fastify API", async () => {
    const context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        API_BASE: "http://localhost:8000"
      }
    });
    const creativeManifest = JSON.parse(await readFile(fixturePath, "utf8")) as Record<string, unknown>;

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/v1/render/jobs",
      payload: {
        creative_manifest: creativeManifest,
        font_url: "/fonts/retrieved/satoshi.woff2",
        background_video_url: "/media/background.mp4",
        rvm_matte_url: "/media/matte.webm",
        audio_url: "/media/audio.m4a"
      }
    });

    expect(createResponse.statusCode).toBe(200);
    const createBody = createResponse.json();
    expect(createBody.status).toBe("queued");
    expect(createBody.manifest.fontUrl).toMatch(/^http:\/\//);

    const nextResponse = await context.app.inject({
      method: "GET",
      url: "/api/v1/render/jobs/next"
    });

    expect(nextResponse.statusCode).toBe(200);
    expect(nextResponse.json().jobId).toBe(createBody.jobId);

    const statusResponse = await context.app.inject({
      method: "GET",
      url: `/api/v1/render/jobs/${createBody.jobId}`
    });
    expect(statusResponse.json().status).toBe("in_progress");

    const completeResponse = await context.app.inject({
      method: "POST",
      url: `/api/v1/render/jobs/${createBody.jobId}/complete`,
      payload: {
        outputUrl: "/tmp/output.mp4"
      }
    });
    expect(completeResponse.statusCode).toBe(200);
    expect(completeResponse.json().status).toBe("complete");

    await context.app.close();
  });
});
