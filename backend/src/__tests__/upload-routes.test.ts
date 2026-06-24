import {existsSync} from "node:fs";
import {writeFile} from "node:fs/promises";
import path from "node:path";

import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {createJosephUploadPipeline} from "../upload/joseph-upload-pipeline";
import {cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

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
      throw new Error("Timed out waiting for upload session state to settle.");
    }
    await sleep(intervalMs);
    response = await getResponse();
  }
  return response;
};

describe("R2 upload routes", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("returns a presigned PUT url and the required upload headers", async () => {
    const context = await createTestApp({
      storageDir: tempDir,
      deps: {
        r2Service: {
          isConfigured: true,
          createUploadUrl: async ({filename, contentType, userId}) => {
            return {
              uploadUrl: `https://upload.example/${userId ?? "anonymous"}/${filename}`,
              key: `uploads/${userId ?? "anonymous"}/123-${filename}`,
              bucket: "prometheus-uploads",
              publicUrl: `https://public.example/uploads/${filename}`,
              expiresInSeconds: 600,
              requiredHeaders: {
                "Content-Type": contentType
              }
            };
          },
          downloadObject: async () => {
            throw new Error("downloadObject should not be called for upload-url");
          }
        }
      }
    });

    const response = await context.app.inject({
      method: "POST",
      url: "/api/upload-url",
      payload: {
        filename: "Dan Martell, Scared of Achieving.mp4",
        contentType: "video/mp4",
        userId: "josh"
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.uploadUrl).toContain("https://upload.example/josh/");
    expect(body.key).toContain("uploads/josh/");
    expect(body.bucket).toBe("prometheus-uploads");
    expect(body.publicUrl).toContain("https://public.example/uploads/");
    expect(body.requiredHeaders["Content-Type"]).toBe("video/mp4");

    await context.app.close();
  });

  it("creates a session from an R2 object and starts the preview pipeline asynchronously", async () => {
    const context = await createTestApp({
      storageDir: tempDir,
      deps: {
        probeVideoMetadata: async () => ({
          width: 1920,
          height: 1080,
          duration_seconds: 69.335011,
          duration_in_frames: 2080,
          fps: 30
        }),
        extractPreviewAudioBuffer: async () => Buffer.alloc(2048),
        streamPreviewAudio: async ({callbacks}) => {
          await callbacks?.onBegin?.({sessionId: "stream_test", expiresAt: null});
          await callbacks?.onTurn?.({
            turnOrder: 0,
            transcript: "Launch fast and keep the motion clean.",
            utterance: "Launch fast and keep the motion clean.",
            endOfTurn: true,
            endOfTurnConfidence: 0.98,
            words: [],
            isFormatted: true
          });
          await callbacks?.onTermination?.({audioDurationSeconds: 8});
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
            words: 7
          });
          return [
            {text: "Launch", start_ms: 0, end_ms: 200, confidence: 0.99},
            {text: "fast", start_ms: 200, end_ms: 400, confidence: 0.99},
            {text: "and", start_ms: 400, end_ms: 600, confidence: 0.99},
            {text: "keep", start_ms: 600, end_ms: 800, confidence: 0.99},
            {text: "the", start_ms: 800, end_ms: 1000, confidence: 0.99},
            {text: "motion", start_ms: 1000, end_ms: 1200, confidence: 0.99},
            {text: "clean.", start_ms: 1200, end_ms: 1400, confidence: 0.99}
          ];
        },
        r2Service: {
          isConfigured: true,
          createUploadUrl: async () => {
            throw new Error("createUploadUrl should not be called for process");
          },
          downloadObject: async ({destinationPath}) => {
            await writeFile(destinationPath, Buffer.from("fake-video-data"));
            return {
              bucket: "prometheus-uploads",
              key: "uploads/josh/test.mp4",
              destinationPath,
              sizeBytes: 15
            };
          }
        }
      }
    });

    const response = await context.app.inject({
      method: "POST",
      url: "/api/process",
      payload: {
        bucket: "prometheus-uploads",
        key: "uploads/josh/test.mp4",
        filename: "Dan Martell, Scared of Achieving.mp4",
        contentType: "video/mp4",
        userId: "josh",
        mediaUrl: "https://public.example/uploads/josh/test.mp4",
        metadata: {
          note: "sample upload"
        }
      }
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body.ok).toBe(true);
    expect(body.jobId).toMatch(/^edit_/);
    expect(body.sessionId).toBe(body.jobId);
    expect(body.status).toBe("queued");

    await context.queue.onIdle();

    const statusResponse = await waitForResponse(
      () =>
        context.app.inject({
          method: "GET",
          url: `/api/edit-sessions/${body.sessionId}/status`
        }),
      (status) => status.previewStatus === "preview_text_ready" && status.transcriptStatus === "full_transcript_ready"
    );
    const previewResponse = await context.app.inject({
      method: "GET",
      url: `/api/edit-sessions/${body.sessionId}/preview`
    });

    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json().storageKey).toBe("uploads/josh/test.mp4");
    expect(statusResponse.json().previewText).toContain("Launch fast");
    expect(statusResponse.json().transcriptStatus).toBe("full_transcript_ready");
    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json().status).toBe("preview_text_ready");

    await sleep(250);
    await context.app.close();
  }, 15_000);

  it("queues a Joseph UnifiedRenderManifest when upload completion requests a Joseph profile", async () => {
    const context = await createTestApp({
      storageDir: tempDir,
      deps: {
        probeVideoMetadata: async () => ({
          width: 1920,
          height: 1080,
          duration_seconds: 8,
          duration_in_frames: 240,
          fps: 30
        }),
        josephUploadPipeline: createJosephUploadPipeline({
          storageDir: tempDir,
          publicDir: path.join(tempDir, "remotion-public"),
          uploadDir: path.join(tempDir, "resolved-media"),
          listLocalMusicCatalog: () => [{
            trackId: "local-fixture",
            title: "Fixture Track",
            sourceKind: "local",
            localFilePath: path.join(tempDir, "fixture-track.mp3"),
            browserUrl: "/music/fixture-track.mp3",
            durationSeconds: 1,
            renderSafe: true,
            licenseStatus: "test_fixture"
          }],
          analyzeMusicTrack: async () => ({
            bpm: 128,
            beatTimes: [0, 0.469, 0.938],
            downbeats: [0],
            sections: [{id: "section-01", startSeconds: 0, endSeconds: 8, label: "main", energy: 0.7}],
            loudnessLUFS: -15,
            energyCurve: [0.7, 0.72, 0.68],
            duration: 8,
            source: "ffmpeg_fallback",
            warnings: []
          })
        }),
        r2Service: {
          isConfigured: true,
          createUploadUrl: async () => {
            throw new Error("createUploadUrl should not be called for process");
          },
          downloadObject: async ({destinationPath}) => {
            await writeFile(destinationPath, Buffer.from("fake-video-data-for-joseph"));
            return {
              bucket: "prometheus-uploads",
              key: "uploads/josh/joseph.mp4",
              destinationPath,
              sizeBytes: 26
            };
          }
        }
      }
    });

    const response = await context.app.inject({
      method: "POST",
      url: "/api/process",
      payload: {
        bucket: "prometheus-uploads",
        key: "uploads/josh/joseph.mp4",
        filename: "Joseph Upload.mp4",
        contentType: "video/mp4",
        userId: "josh",
        josephProfile: "joseph_aggressive",
        promptText: "Make the hook kinetic and premium.",
        autoStartPreview: false
      }
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    await context.queue.onIdle();

    const statusResponse = await context.app.inject({
      method: "GET",
      url: `/api/edit-sessions/${body.sessionId}/status`
    });
    expect(statusResponse.statusCode).toBe(200);
    const status = statusResponse.json();
    expect(status.metadata.josephProfile).toBe("joseph_aggressive");
    expect(status.metadata.josephRenderJobId).toEqual(expect.any(String));
    expect(status.metadata.josephReplayLedgerEntryId).toEqual(expect.any(String));
    expect(existsSync(status.metadata.josephEvidencePath)).toBe(true);

    const jobResponse = await context.app.inject({
      method: "GET",
      url: `/api/v1/render/jobs/${status.metadata.josephRenderJobId}`
    });
    expect(jobResponse.statusCode).toBe(200);
    const job = jobResponse.json();
    expect(job.kind).toBe("joseph");
    expect(job.status).toBe("queued");
    expect(job.manifest.width).toBe(1080);
    expect(job.manifest.height).toBe(1920);
    expect(job.manifest.output.width).toBe(1080);
    expect(job.manifest.output.height).toBe(1920);
    expect(job.manifest.source.videoUrl).not.toMatch(/^file:\/\//);
    expect(job.manifest.source.videoUrl).not.toMatch(/^[A-Za-z]:[\\/]/);
    expect(job.manifest.videoTracks[0].sourcePath).toBe(job.manifest.source.videoUrl);
    expect(job.manifest.typography.fontAssetUrl).toMatch(/^\/fonts\/(hero|library)\//);
    expect(job.manifest.audio.musicReference.durationSeconds).toBe(8);
    expect(job.manifest.audio.musicBpm).toBe(128);

    const nextResponse = await context.app.inject({
      method: "GET",
      url: "/api/v1/render/jobs/next"
    });
    expect(nextResponse.statusCode).toBe(200);
    expect(nextResponse.json()).toEqual(job.manifest);

    await context.app.close();
  });

  it("leaves the non-Joseph upload path on the existing edit-session pipeline", async () => {
    const context = await createTestApp({
      storageDir: tempDir,
      deps: {
        probeVideoMetadata: async () => ({
          width: 1920,
          height: 1080,
          duration_seconds: 4,
          duration_in_frames: 120,
          fps: 30
        }),
        josephUploadPipeline: {
          createRenderJob: async () => {
            throw new Error("Joseph pipeline should not run for non-Joseph uploads.");
          }
        },
        r2Service: {
          isConfigured: true,
          createUploadUrl: async () => {
            throw new Error("createUploadUrl should not be called for process");
          },
          downloadObject: async ({destinationPath}) => {
            await writeFile(destinationPath, Buffer.from("plain-upload"));
            return {
              bucket: "prometheus-uploads",
              key: "uploads/josh/plain.mp4",
              destinationPath,
              sizeBytes: 12
            };
          }
        }
      }
    });

    const response = await context.app.inject({
      method: "POST",
      url: "/api/process",
      payload: {
        bucket: "prometheus-uploads",
        key: "uploads/josh/plain.mp4",
        filename: "Plain Upload.mp4",
        contentType: "video/mp4",
        userId: "josh",
        autoStartPreview: false
      }
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    await context.queue.onIdle();

    const statusResponse = await context.app.inject({
      method: "GET",
      url: `/api/edit-sessions/${body.sessionId}/status`
    });
    expect(statusResponse.json().metadata.josephRenderJobId).toBeUndefined();

    await context.app.close();
  });

  it("records a visible failed session when the Joseph orchestrator path fails", async () => {
    const context = await createTestApp({
      storageDir: tempDir,
      deps: {
        probeVideoMetadata: async () => ({
          width: 1920,
          height: 1080,
          duration_seconds: 4,
          duration_in_frames: 120,
          fps: 30
        }),
        josephUploadPipeline: {
          createRenderJob: async () => {
            throw new Error("orchestrator boom");
          }
        },
        r2Service: {
          isConfigured: true,
          createUploadUrl: async () => {
            throw new Error("createUploadUrl should not be called for process");
          },
          downloadObject: async ({destinationPath}) => {
            await writeFile(destinationPath, Buffer.from("bad-joseph-upload"));
            return {
              bucket: "prometheus-uploads",
              key: "uploads/josh/bad-joseph.mp4",
              destinationPath,
              sizeBytes: 17
            };
          }
        }
      }
    });

    const response = await context.app.inject({
      method: "POST",
      url: "/api/process",
      payload: {
        bucket: "prometheus-uploads",
        key: "uploads/josh/bad-joseph.mp4",
        filename: "Bad Joseph Upload.mp4",
        contentType: "video/mp4",
        josephProfile: "joseph_cinematic",
        autoStartPreview: false
      }
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    await context.queue.onIdle();

    const statusResponse = await context.app.inject({
      method: "GET",
      url: `/api/edit-sessions/${body.sessionId}/status`
    });
    const status = statusResponse.json();
    expect(status.status).toBe("failed");
    expect(status.errorCode).toBe("joseph_orchestrator_failed");
    expect(status.errorMessage).toContain("orchestrator boom");
    expect(status.metadata.josephFailureTags).toContain("orchestrator_failed");
    expect(status.metadata.josephFailureEvidencePath).toEqual(expect.any(String));
    expect(existsSync(status.metadata.josephFailureEvidencePath)).toBe(true);

    await context.app.close();
  });
});
