import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import type {BackendAppContext} from "../app";
import {buildMultipartBody, cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

vi.mock("../typography/zilliz-font-resolver", () => ({
  ZillizFontResolver: class {
    public async resolveFontsByVibe(): Promise<never> {
      throw new Error("Zilliz offline for test");
    }
  }
}));

const waitFor = async (predicate: () => Promise<boolean>, attempts = 240, delayMs = 50): Promise<void> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Timed out waiting for manifest fallback test session to settle.");
};

describe("edit session preview manifest font fallback", () => {
  let tempDir = "";
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

  it("does not inject DM Sans into the preview manifest when Zilliz resolution fails", async () => {
    context = await createTestApp({
      storageDir: tempDir,
      deps: {
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
            transcript: "Fallback fonts belong in CSS",
            utterance: "Fallback fonts belong in CSS",
            endOfTurn: true,
            turnOrder: 1,
            endOfTurnConfidence: 0.9,
            words: [],
            isFormatted: true
          });
        },
        transcribeMedia: async () => ([
          {text: "Fallback", start_ms: 0, end_ms: 140},
          {text: "fonts", start_ms: 140, end_ms: 260},
          {text: "belong", start_ms: 260, end_ms: 420},
          {text: "in", start_ms: 420, end_ms: 480},
          {text: "CSS", start_ms: 480, end_ms: 620}
        ])
      }
    });

    const multipart = buildMultipartBody([
      {
        name: "source_video",
        value: Buffer.from("fake-video-file"),
        filename: "manifest-fallback-source.mp4",
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
    const body = response.json() as {id: string; urls: {previewManifest: string; status: string}};

    const manifestResponse = await context.app.inject({
      method: "GET",
      url: body.urls.previewManifest
    });

    expect(manifestResponse.statusCode).toBe(200);
    expect(manifestResponse.body).not.toContain("DM Sans");
    const manifest = manifestResponse.json() as Record<string, unknown>;
    const typography = manifest["typography"] as Record<string, unknown> | undefined;
    if (typography) {
      expect((typography["primaryFont"] as Record<string, unknown>).family).not.toBe("DM Sans");
    }
  });
});
