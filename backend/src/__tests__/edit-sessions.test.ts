import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {createTestApp, cleanupTempDir, createTempFile, makeTempDir} from "./test-utils";

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

type JsonResponse = {
  statusCode: number;
  json: () => any;
};

const waitForResponse = async (
  getResponse: () => Promise<JsonResponse>,
  predicate: (value: any) => boolean,
  timeoutMs = 15000,
  intervalMs = 100
): Promise<JsonResponse> => {
  const startedAt = Date.now();
  let response = await getResponse();
  while (!predicate(response.json())) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error("Timed out waiting for session state to settle.");
    }
    await sleep(intervalMs);
    response = await getResponse();
  }
  return response;
};

describe("edit sessions", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("creates a session and promotes the preview while transcript and render keep running independently", async () => {
    const demoVideoPath = await createTempFile({
      dir: tempDir,
      fileName: "demo-source.mp4",
      contents: "demo-video-binary"
    });
    const renderState = {
      state: "idle" as "idle" | "running" | "completed" | "failed",
      stage: "idle",
      outputUrl: null as string | null,
      outputPath: null as string | null,
      errorMessage: null as string | null,
      progress: 0
    };
    let renderStatusPolls = 0;

    const context = await createTestApp({
      storageDir: tempDir,
      deps: {
        probeVideoMetadata: async () => ({
          width: 1920,
          height: 1080,
          fps: 30,
          duration_seconds: 12,
          duration_in_frames: 360,
          bitrate_video: 4_000_000,
          codec_video: "h264",
          container_format: "mov,mp4"
        }),
        extractPreviewAudioBuffer: async () => Buffer.alloc(2048),
        streamPreviewAudio: async ({callbacks}) => {
          await callbacks?.onBegin?.({sessionId: "stream_test", expiresAt: null});
          await callbacks?.onTurn?.({
            turnOrder: 0,
            transcript: "Make this cinematic and premium.",
            utterance: "Make this cinematic and premium.",
            endOfTurn: true,
            endOfTurnConfidence: 0.95,
            words: [],
            isFormatted: true
          });
          await callbacks?.onTermination?.({audioDurationSeconds: 7});
        },
        transcribeMedia: async ({onPoll}) => {
          await onPoll?.({
            attempt: 0,
            maxPollAttempts: 10,
            status: "processing",
            transcriptId: "transcript_test",
            words: 0
          });
          await onPoll?.({
            attempt: 1,
            maxPollAttempts: 10,
            status: "completed",
            transcriptId: "transcript_test",
            words: 5
          });
          return [
            {text: "Make", start_ms: 0, end_ms: 200, confidence: 0.99},
            {text: "this", start_ms: 200, end_ms: 400, confidence: 0.99},
            {text: "cinematic", start_ms: 400, end_ms: 600, confidence: 0.99},
            {text: "and", start_ms: 600, end_ms: 800, confidence: 0.99},
            {text: "premium.", start_ms: 800, end_ms: 1000, confidence: 0.99}
          ];
        },
        renderDriver: {
          startRender: async () => {
            renderState.state = "running";
            renderState.stage = "drafting";
            renderState.progress = 55;
          },
          getStatus: async () => {
            renderStatusPolls += 1;
            if (renderStatusPolls > 1) {
              renderState.state = "completed";
              renderState.stage = "completed";
              renderState.progress = 100;
              renderState.outputUrl = "/master-renders/edit-session/current.mp4";
              renderState.outputPath = "/tmp/edit-session-current.mp4";
            }
            return renderState;
          }
        }
      }
    });

    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/edit-sessions",
      payload: {
        mediaUrl: "https://cdn.example.com/video.mp4",
        captionProfileId: "svg_typography_v1",
        motionTier: "minimal"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const createBody = createResponse.json();

    const uploadResponse = await context.app.inject({
      method: "POST",
      url: `/api/edit-sessions/${createBody.id}/upload-complete`,
      payload: {
        sourcePath: demoVideoPath,
        sourceFilename: "Dan Martell, Scared of Achieving.mp4"
      }
    });
    expect(uploadResponse.statusCode).toBe(202);

    const statusResponse = await waitForResponse(
      () =>
        context.app.inject({
          method: "GET",
          url: `/api/edit-sessions/${createBody.id}/status`
        }),
      (status) => status.previewStatus === "preview_text_ready" && status.transcriptStatus === "full_transcript_ready"
    );
    const previewResponse = await context.app.inject({
      method: "GET",
      url: `/api/edit-sessions/${createBody.id}/preview`
    });

    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json().previewStatus).toBe("preview_text_ready");
    expect(statusResponse.json().transcriptStatus).toBe("full_transcript_ready");
    expect(statusResponse.json().previewText).toContain("Make this cinematic");
    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json().status).toBe("preview_text_ready");

    const renderResponse = await context.app.inject({
      method: "POST",
      url: `/api/edit-sessions/${createBody.id}/render`,
      payload: {
        deliveryMode: "master-render"
      }
    });
    expect(renderResponse.statusCode).toBe(202);

    const renderStatusResponse = await waitForResponse(
      () =>
        context.app.inject({
          method: "GET",
          url: `/api/edit-sessions/${createBody.id}/render-status`
        }),
      (renderStatus) => renderStatus.status === "render_complete"
    );

    expect(renderStatusResponse.statusCode).toBe(200);
    expect(renderStatusResponse.json().status).toBe("render_complete");
    expect(renderStatusResponse.json().outputUrl).toBe("/master-renders/edit-session/current.mp4");

    await sleep(250);
    await context.app.close();
  }, 20000);
});
