import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTempFile, createTestApp, makeTempDir} from "./test-utils";

describe("edit session live activity", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  const waitForLiveActivity = async (
    getStatus: () => Promise<{statusCode: number; json: () => any}>,
    activityCode: string,
    timeoutMs = 10000
  ) => {
    const startedAt = Date.now();
    let response = await getStatus();
    while (response.json().liveActivity?.activityCode !== activityCode) {
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(`Timed out waiting for live activity ${activityCode}.`);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      response = await getStatus();
    }
    return response;
  };

  it("publishes deterministic media metadata and live activity during transcript polling", async () => {
    const demoVideoPath = await createTempFile({
      dir: tempDir,
      fileName: "activity-source.mp4",
      contents: "demo-video-binary"
    });

    const context = await createTestApp({
      storageDir: tempDir,
      deps: {
        probeVideoMetadata: async () => ({
          width: 1920,
          height: 1080,
          fps: 30,
          duration_seconds: 12.5,
          duration_in_frames: 375,
          bitrate_video: 4_000_000,
          codec_video: "h264",
          container_format: "mov,mp4"
        }),
        extractPreviewAudioBuffer: async () => Buffer.alloc(2048),
        streamPreviewAudio: async ({callbacks}) => {
          await callbacks?.onBegin?.({sessionId: "stream_test", expiresAt: null});
          await callbacks?.onTurn?.({
            turnOrder: 0,
            transcript: "Observe the system thinking.",
            utterance: "Observe the system thinking.",
            endOfTurn: true,
            endOfTurnConfidence: 0.97,
            words: [],
            isFormatted: true
          });
          await callbacks?.onTermination?.({audioDurationSeconds: 6});
        },
        transcribeMedia: async ({onPoll}) => {
          await onPoll?.({
            attempt: 45,
            maxPollAttempts: 240,
            status: "processing",
            transcriptId: "transcript_live_activity",
            words: 0
          });
          await new Promise((resolve) => setTimeout(resolve, 75));
          return [
            {text: "Observe", start_ms: 0, end_ms: 180, confidence: 0.99},
            {text: "the", start_ms: 180, end_ms: 260, confidence: 0.99},
            {text: "system", start_ms: 260, end_ms: 480, confidence: 0.99},
            {text: "thinking.", start_ms: 480, end_ms: 760, confidence: 0.99}
          ];
        },
        now: () => "2026-05-25T12:00:00.000Z"
      }
    });

    try {
      const createResponse = await context.app.inject({
        method: "POST",
        url: "/api/edit-sessions",
        payload: {
          captionProfileId: "longform_svg_typography_v1",
          motionTier: "premium"
        }
      });
      const createBody = createResponse.json();

      const uploadResponse = await context.app.inject({
        method: "POST",
        url: `/api/edit-sessions/${createBody.id}/upload-complete`,
        payload: {
          sourcePath: demoVideoPath,
          sourceFilename: "activity-source.mp4",
          autoStartPreview: false
        }
      });
      expect(uploadResponse.statusCode).toBe(202);

      const startPreviewResponse = await context.app.inject({
        method: "POST",
        url: `/api/edit-sessions/${createBody.id}/preview/start`,
        payload: {}
      });
      expect(startPreviewResponse.statusCode).toBe(202);

      const statusResponse = await waitForLiveActivity(
        () =>
          context.app.inject({
            method: "GET",
            url: `/api/edit-sessions/${createBody.id}/status`
          }),
        "ASSEMBLYAI_POLLING"
      );

      expect(statusResponse.statusCode).toBe(200);
      expect(statusResponse.json()).toMatchObject({
        sourceDurationMs: 12500,
        sourceWidth: 1920,
        sourceHeight: 1080,
        sourceFps: 30
      });
      expect(statusResponse.json().liveActivity).toMatchObject({
        activityCode: "ASSEMBLYAI_POLLING",
        detail: "Attempt 45/240",
        heartbeat: "2026-05-25T12:00:00.000Z"
      });

      await context.app.close();
    } finally {
      await context.app.close();
    }
  });
});
