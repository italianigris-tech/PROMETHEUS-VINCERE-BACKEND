import path from "node:path";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import type {BackendAppContext, BackendDependencies} from "../app";
import {buildMultipartBody, cleanupTempDir, createTestApp, makeTempDir} from "./test-utils";

const waitFor = async (predicate: () => Promise<boolean>, attempts = 240, delayMs = 50): Promise<void> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Timed out waiting for live preview session to settle.");
};

describe("edit session live preview route", () => {
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

  it("rejects audio-only uploads for the live compositor lane", async () => {
    const deps: BackendDependencies = {
      extractPreviewAudioBuffer: async ({sourcePath}) => {
        expect(path.basename(sourcePath)).toContain("speaker.mp3");
        return Buffer.from("preview-audio");
      },
      streamPreviewAudio: async ({callbacks}) => {
        await callbacks?.onBegin?.({sessionId: "stream-session-1", expiresAt: null});
        await callbacks?.onTurn?.({
          transcript: "Build systems that scale",
          utterance: "Build systems that scale",
          endOfTurn: true,
          turnOrder: 1,
          endOfTurnConfidence: 0.92,
          words: [],
          isFormatted: true
        });
        await callbacks?.onTermination?.({audioDurationSeconds: 1.2});
      },
      transcribeMedia: async () => ([
        {text: "Build", start_ms: 0, end_ms: 180},
        {text: "systems", start_ms: 180, end_ms: 430},
        {text: "that", start_ms: 430, end_ms: 560},
        {text: "scale", start_ms: 560, end_ms: 820}
      ])
    };

    context = await createTestApp({
      storageDir: tempDir,
      deps
    });

    const multipart = buildMultipartBody([
      {
        name: "source_video",
        value: Buffer.from("fake-audio-file"),
        filename: "speaker.mp3",
        contentType: "audio/mpeg"
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

    expect(response.statusCode).toBe(400);
    const body = response.json() as {error?: string};
    expect(body.error).toContain("video file");
  });

  it("exposes the source media stream and probed video metadata for compositor previews", async () => {
    const deps: BackendDependencies = {
      probeVideoMetadata: async () => ({
        width: 1920,
        height: 1080,
        fps: 30,
        duration_seconds: 12,
        duration_in_frames: 360
      }),
      extractPreviewAudioBuffer: async () => Buffer.from("preview-audio"),
      streamPreviewAudio: async ({callbacks}) => {
        await callbacks?.onTurn?.({
          transcript: "Native compositor ready",
          utterance: "Native compositor ready",
          endOfTurn: true,
          turnOrder: 1,
          endOfTurnConfidence: 0.88,
          words: [],
          isFormatted: true
        });
      },
      transcribeMedia: async () => ([
        {text: "Native", start_ms: 0, end_ms: 180},
        {text: "compositor", start_ms: 180, end_ms: 480},
        {text: "ready", start_ms: 480, end_ms: 700}
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
        filename: "speaker.mp4",
        contentType: "video/mp4"
      },
      {
        name: "captionProfileId",
        value: "longform_eve_typography_v1"
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
    const body = response.json() as {id: string; urls: {status: string; previewManifest: string; previewArtifact: string; events: string}};

    await waitFor(async () => {
      const statusResponse = await context!.app.inject({
        method: "GET",
        url: body.urls.status
      });
      const statusBody = statusResponse.json() as Record<string, unknown>;
      return statusBody["sourceHasVideo"] === true;
    });

    const statusResponse = await context.app.inject({
      method: "GET",
      url: body.urls.status
    });
    const statusBody = statusResponse.json() as Record<string, unknown>;
    expect(statusBody["sourceHasVideo"]).toBe(true);
    expect(statusBody["sourceWidth"]).toBe(1920);
    expect(statusBody["sourceHeight"]).toBe(1080);
    expect(statusBody["sourceFps"]).toBe(30);
    expect(statusBody["sourceDurationMs"]).toBe(12000);

    const sourceResponse = await context.app.inject({
      method: "GET",
      url: `/api/edit-sessions/${body.id}/source`
    });

    expect(sourceResponse.statusCode).toBe(200);
    expect(sourceResponse.headers["content-type"]).toContain("video/mp4");
    expect(sourceResponse.body).toBe("fake-video-file");
  });

  it("streams enough session metadata over SSE subscribers to avoid immediate manifest and artifact polling", async () => {
    const deps: BackendDependencies = {
      probeVideoMetadata: async () => ({
        width: 1920,
        height: 1080,
        fps: 30,
        duration_seconds: 10,
        duration_in_frames: 300
      }),
      extractPreviewAudioBuffer: async () => Buffer.from("preview-audio"),
      streamPreviewAudio: async ({callbacks}) => {
        await callbacks?.onTurn?.({
          transcript: "SSE owns the preview contract",
          utterance: "SSE owns the preview contract",
          endOfTurn: true,
          turnOrder: 1,
          endOfTurnConfidence: 0.93,
          words: [],
          isFormatted: true
        });
      },
      transcribeMedia: async () => ([
        {text: "SSE", start_ms: 0, end_ms: 120},
        {text: "owns", start_ms: 120, end_ms: 260},
        {text: "the", start_ms: 260, end_ms: 360},
        {text: "preview", start_ms: 360, end_ms: 560},
        {text: "contract", start_ms: 560, end_ms: 820}
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
        filename: "sse-preview-source.mp4",
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
    const body = response.json() as {id: string; urls: {status: string; previewManifest: string; previewArtifact: string; events: string}};
    const events: Array<{type: string; session: Record<string, unknown>}> = [];
    const unsubscribe = context.editSessions.subscribe(body.id, (event) => {
      events.push(event as {type: string; session: Record<string, unknown>});
    });

    await waitFor(async () => {
      return events.some((event) => event.type === "preview_text_ready");
    });

    unsubscribe();

    const previewReadyEvent = events.find((event) => event.type === "preview_text_ready");
    expect(previewReadyEvent).toBeTruthy();
    expect(previewReadyEvent?.session["sourceMediaUrl"]).toBe(`/api/edit-sessions/${body.id}/source`);
    expect(previewReadyEvent?.session["sourceMediaKind"]).toBe("session_source_stream");

    const lanes = previewReadyEvent?.session["lanes"] as Record<string, unknown>;
    expect(lanes.defaultInteractive).toBe("hyperframes");
    expect(lanes.interactive).toEqual(["hyperframes"]);

    const routes = previewReadyEvent?.session["routes"] as Record<string, unknown>;
    expect(routes.status).toBe(`/api/edit-sessions/${body.id}/status`);
    expect(routes.previewManifest).toBe(`/api/edit-sessions/${body.id}/preview-manifest`);
    expect(routes.previewArtifact).toBe(`/api/edit-sessions/${body.id}/preview-artifact`);
    expect(routes.events).toBe(`/api/edit-sessions/${body.id}/events`);

    const statusResponse = await context.app.inject({
      method: "GET",
      url: body.urls.status
    });
    const statusBody = statusResponse.json() as Record<string, unknown>;
    expect(statusBody["sourceHasVideo"]).toBe(true);

    expect(previewReadyEvent?.session["previewDiagnostics"]).toBeTruthy();
  });

  it("rejects cross-pipeline tags before creating a session", async () => {
    context = await createTestApp({storageDir: tempDir});
    const createSession = vi.spyOn(context.editSessions, "createSession");

    const response = await context.app.inject({
      method: "POST",
      url: "/api/edit-sessions/live-preview",
      payload: {
        sourcePath: path.join(tempDir, "source.mp4"),
        pipeline: "maul",
        josephProfile: "joseph_cinematic"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({error: "josephProfile is only valid when pipeline='joseph'."});
    expect(createSession).not.toHaveBeenCalled();
  });

  it("compiles a browser upload through the Joseph pipeline and exposes the exact UnifiedRenderManifest", async () => {
    let receivedProfile: string | null = null;
    context = await createTestApp({
      storageDir: tempDir,
      envOverrides: {
        PREVIEW_ENGINE: "remotion",
        ENABLE_REMOTION_PREVIEW: "true"
      },
      deps: {
        probeVideoMetadata: async () => ({
          width: 1920,
          height: 1080,
          fps: 30,
          duration_seconds: 6,
          duration_in_frames: 180
        }),
        extractPreviewAudioBuffer: async () => Buffer.from("preview-audio"),
        streamPreviewAudio: async () => undefined,
        transcribeMedia: async () => ([{text: "Joseph", start_ms: 0, end_ms: 320}]),
        josephUploadPipeline: {
          createRenderJob: async (input) => {
            receivedProfile = input.profile;
            const manifest = {
              version: "2.0" as const,
              jobId: "123e4567-e89b-12d3-a456-426614174301",
              seed: 301,
              createdAt: "2026-01-01T00:00:00.000Z",
              durationFrames: 180,
              fps: 30,
              width: 1080,
              height: 1920,
              videoTracks: [{sourcePath: "/uploads/test/source.mp4", startFrame: 0, endFrame: 179}],
              cameraMoves: [],
              textOverlays: [],
              transitions: [],
              source: {
                videoUrl: "/uploads/test/source.mp4",
                audioUrl: input.sourcePath,
                transcript: [{text: "Joseph", startMs: 0, endMs: 320}],
                durationMs: 6000,
                width: 1920,
                height: 1080,
                fps: 30
              },
              audio: {
                beats: [],
                onsets: [],
                djPlan: {
                  version: "joseph-dj-plan-v1" as const,
                  source: "video-aware-audio-plan" as const,
                  planId: "live-preview-plan",
                  planMode: "render_ready" as const,
                  musicEvents: [{
                    id: "music-1",
                    trackId: "track-1",
                    browserUrl: "/joseph-music/track-1.mp3",
                    localFilePath: path.join(tempDir, "track-1.mp3"),
                    videoStartSec: 0,
                    videoEndSec: 6,
                    trackStartSec: 0,
                    trackEndSec: 6,
                    volumeDb: -24,
                    fadeInSec: 0.3,
                    fadeOutSec: 1,
                    duckingEnabled: true,
                    purpose: "video_hook_bed",
                    sectionRole: "intro",
                    beatAligned: false
                  }],
                  transitionEvents: [],
                  duckingRegions: [],
                  warnings: []
                },
                sfx: [],
                voiceVolumeDb: 0,
                musicVolumeDb: -18,
                targetLufs: -14
              },
              timeline: [],
              creativeProfile: {
                name: "joseph_cinematic" as const,
                cutDensity: 0.5,
                textDensity: 0.5,
                sfxDensity: 0.2,
                cameraAggression: 0.4,
                colorIntensity: 0.4
              },
              output: {width: 1080, height: 1920, fps: 30, codec: "h264" as const, crf: 18}
            };
            return {
              renderJobId: manifest.jobId,
              replayLedgerEntryId: "ledger:1",
              evidencePath: path.join(tempDir, "evidence"),
              variationKey: "variation:1",
              manifest,
              transcript: {
                path: path.join(tempDir, "transcript.json"),
                source: "fixture_words" as const,
                wordCount: 1,
                warnings: [],
                trainableForIrl: false
              }
            };
          }
        }
      }
    });

    const multipart = buildMultipartBody([
      {name: "source_video", value: Buffer.from("fake-video-file"), filename: "joseph-source.mp4", contentType: "video/mp4"},
      {name: "pipeline", value: "joseph"},
      {name: "josephProfile", value: "joseph_cinematic"},
      {name: "promptText", value: "Apply the complete Joseph treatment."}
    ]);
    const response = await context.app.inject({
      method: "POST",
      url: "/api/edit-sessions/live-preview",
      payload: multipart.body,
      headers: {"content-type": multipart.contentType}
    });

    expect(response.statusCode).toBe(202);
    const body = response.json() as {id: string; routes: Record<string, string>; urls: Record<string, string>; metadata: Record<string, unknown>};
    expect(receivedProfile).toBe("joseph_cinematic");
    expect(body.metadata.josephRenderJobId).toBe("123e4567-e89b-12d3-a456-426614174301");
    expect(body.routes.josephManifest).toBe(`/api/edit-sessions/${body.id}/joseph-manifest`);
    expect(body.urls.josephManifest).toBe(body.routes.josephManifest);

    const manifestResponse = await context.app.inject({
      method: "GET",
      url: body.routes.josephManifest,
      headers: {host: "127.0.0.1:8000"}
    });
    expect(manifestResponse.statusCode).toBe(200);
    const manifest = manifestResponse.json();
    expect(manifest.source.videoUrl).toBe(`http://127.0.0.1:8000/api/edit-sessions/${body.id}/source`);
    expect(manifest.videoTracks[0].sourcePath).toBe(manifest.source.videoUrl);
    expect(manifest.source.audioUrl).toBe(manifest.source.videoUrl);
    expect(manifest.audio.djPlan.musicEvents[0].browserUrl).toBe("/joseph-music/track-1.mp3");
  });
});
