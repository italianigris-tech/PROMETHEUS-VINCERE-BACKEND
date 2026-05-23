import {afterEach, beforeEach, describe, expect, it} from "vitest";

import type {BackendAppContext, BackendDependencies} from "../app";
import {buildMultipartBody, cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

const waitFor = async (predicate: () => Promise<boolean>, attempts = 240, delayMs = 50): Promise<void> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Timed out waiting for preview manifest to become ready.");
};

describe("edit session preview manifest route", () => {
  let tempDir: string;
  let context: BackendAppContext | null = null;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    if (context) {
      await context.app.close();
      context = null;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    await cleanupTempDir(tempDir);
  });

  it("returns a Hyperframes-ready manifest for live preview sessions", async () => {
    const deps: BackendDependencies = {
      probeVideoMetadata: async () => ({
        width: 1920,
        height: 1080,
        fps: 30,
        duration_seconds: 9,
        duration_in_frames: 270
      }),
      extractPreviewAudioBuffer: async () => Buffer.from("preview-audio"),
      streamPreviewAudio: async ({callbacks}) => {
        await callbacks?.onTurn?.({
          transcript: "Display God is live",
          utterance: "Display God is live",
          endOfTurn: true,
          turnOrder: 1,
          endOfTurnConfidence: 0.9,
          words: [],
          isFormatted: true
        });
      },
      transcribeMedia: async () => ([
        {text: "Display", start_ms: 0, end_ms: 180},
        {text: "God", start_ms: 180, end_ms: 320},
        {text: "is", start_ms: 320, end_ms: 420},
        {text: "live", start_ms: 420, end_ms: 620}
      ])
    };

    context = await createTestApp({
      storageDir: tempDir,
      deps
    });

    const multipart = buildMultipartBody([
      {
        name: "source_video",
        value: Buffer.from("fake-video-file"),
        filename: "hyperframes-source.mp4",
        contentType: "video/mp4"
      },
      {
        name: "captionProfileId",
        value: "longform_eve_typography_v1"
      },
      {
        name: "motionTier",
        value: "premium"
      }
    ]);

    const response = await context.app.inject({
      method: "POST",
      url: "/api/edit-sessions/live-preview",
      payload: multipart.body,
      headers: {
        "content-type": multipart.contentType
      }
    });

    expect(response.statusCode).toBe(202);
    const createBody = response.json() as {
      id: string;
      urls: {
        previewManifest: string;
        status: string;
      };
    };
    expect(createBody.urls.previewManifest).toBe(`/api/edit-sessions/${createBody.id}/preview-manifest`);

    const manifestResponse = await context.app.inject({
      method: "GET",
      url: createBody.urls.previewManifest
    });

    expect(manifestResponse.statusCode).toBe(200);
    const manifest = manifestResponse.json() as Record<string, unknown>;
    expect(manifest["schemaVersion"]).toBe("hyperframes-preview-manifest/v1");
    expect(manifest["sessionId"]).toBe(createBody.id);
    expect((manifest["lanes"] as Record<string, unknown>).defaultInteractive).toBe("hyperframes");
    expect((manifest["lanes"] as Record<string, unknown>).interactive).toEqual(["hyperframes"]);
    expect((manifest["lanes"] as Record<string, unknown>).export).toBe("remotion");
    expect((manifest["routes"] as Record<string, unknown>).sourceMedia).toBe(`/api/edit-sessions/${createBody.id}/source`);

    const baseVideo = manifest["baseVideo"] as Record<string, unknown>;
    expect(baseVideo.src).toBe(`/api/edit-sessions/${createBody.id}/source`);
    expect(baseVideo.sourceKind).toBe("session_source_stream");
    expect(baseVideo.hasVideo).toBe(true);
    expect(baseVideo.width).toBe(1920);
    expect(baseVideo.height).toBe(1080);
    expect(baseVideo.fps).toBe(30);
    expect(baseVideo.durationMs).toBe(9000);

    const audio = manifest["audio"] as Record<string, unknown>;
    expect(audio.source).toBe("video-element");
    expect(audio.src).toBeNull();

    const overlayPlan = manifest["overlayPlan"] as Record<string, unknown>;
    expect(Array.isArray(overlayPlan.previewLines)).toBe(true);
    expect(Array.isArray(overlayPlan.previewMotionSequence)).toBe(true);
    expect(Array.isArray(overlayPlan.transcriptWords)).toBe(true);
    expect(manifestResponse.body).not.toContain("DM Sans");
  });

  it("exposes remotion as an interactive lane only when explicitly enabled", async () => {
    const deps: BackendDependencies = {
      probeVideoMetadata: async () => ({
        width: 1280,
        height: 720,
        fps: 30,
        duration_seconds: 5,
        duration_in_frames: 150
      }),
      extractPreviewAudioBuffer: async () => Buffer.from("preview-audio"),
      streamPreviewAudio: async ({callbacks}) => {
        await callbacks?.onTurn?.({
          transcript: "Render lane test",
          utterance: "Render lane test",
          endOfTurn: true,
          turnOrder: 1,
          endOfTurnConfidence: 0.9,
          words: [],
          isFormatted: true
        });
      },
      transcribeMedia: async () => ([{text: "Render", start_ms: 0, end_ms: 200}])
    };

    context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        PREVIEW_ENGINE: "remotion",
        ENABLE_REMOTION_PREVIEW: "true"
      },
      deps
    });

    const multipart = buildMultipartBody([
      {
        name: "source_video",
        value: Buffer.from("fake-video-file"),
        filename: "render-lane-source.mp4",
        contentType: "video/mp4"
      }
    ]);

    const response = await context.app.inject({
      method: "POST",
      url: "/api/edit-sessions/live-preview",
      payload: multipart.body,
      headers: {
        "content-type": multipart.contentType
      }
    });

    expect(response.statusCode).toBe(202);
    const createBody = response.json() as {id: string; urls: {previewManifest: string}};

    const manifestResponse = await context.app.inject({
      method: "GET",
      url: createBody.urls.previewManifest
    });
    expect(manifestResponse.statusCode).toBe(200);
    const manifest = manifestResponse.json() as Record<string, unknown>;
    expect((manifest["lanes"] as Record<string, unknown>).defaultInteractive).toBe("remotion");
    expect((manifest["lanes"] as Record<string, unknown>).interactive).toEqual(["hyperframes", "remotion"]);
  });
});
