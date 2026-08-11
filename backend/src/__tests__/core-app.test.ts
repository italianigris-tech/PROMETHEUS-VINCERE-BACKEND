import {describe, expect, it, vi} from "vitest";

import {createCoreApp} from "../core-app.js";

const request = {
  transcript: {
    language: "en",
    text: "You do not need permission.",
    words: [
      {text: "You", startMs: 0, endMs: 200, confidence: 0.99},
      {text: "do", startMs: 200, endMs: 350, confidence: 0.99},
      {text: "not", startMs: 350, endMs: 500, confidence: 0.99},
      {text: "need", startMs: 500, endMs: 700, confidence: 0.99},
      {text: "permission.", startMs: 700, endMs: 1_000, confidence: 0.99},
    ],
  },
  videoDurationMs: 2_000,
  pacing: "fast",
  style: "cinematic",
};

const renderManifest = {
  version: "2.0",
  jobId: "123e4567-e89b-12d3-a456-426614174100",
  seed: 12345,
  createdAt: "2026-01-01T00:00:00.000Z",
  durationFrames: 90,
  fps: 30,
  width: 1080,
  height: 1920,
  videoTracks: [{sourcePath: "/uploads/source.mp4", startFrame: 0, endFrame: 89}],
  cameraMoves: [{type: "push_in", startFrame: 0, endFrame: 45}],
  textOverlays: [{text: "BUILD", startFrame: 8, endFrame: 42, animation: "pop", color: "#FF0040"}],
  transitions: [{startFrame: 55, endFrame: 66}],
  source: {
    videoUrl: "/uploads/source.mp4",
    audioUrl: "/uploads/source.mp4",
    transcript: [{text: "Build", startMs: 0, endMs: 1200, confidence: 0.99}],
    durationMs: 3000,
    width: 1080,
    height: 1920,
    fps: 30,
  },
  audio: {beats: [400], onsets: [0], sfx: [], voiceVolumeDb: 0, musicVolumeDb: -18, targetLufs: -14},
  timeline: [],
  creativeProfile: {
    name: "joseph_cinematic",
    cutDensity: 0.5,
    textDensity: 0.6,
    sfxDensity: 0.2,
    cameraAggression: 0.5,
    colorIntensity: 0.5,
  },
  output: {width: 1080, height: 1920, fps: 30, codec: "h264", crf: 18},
};

describe("thin core app", () => {
  it("serves health and the model-backed text chunking interface without booting the render stack", async () => {
    const plan = {
      schemaVersion: "test-plan/v1",
      chunks: [{text: "You do not need permission."}],
    };
    const textChunkPlanner = {
      plan: vi.fn().mockResolvedValue(plan),
    };
    const context = await createCoreApp(
      {
        CORS_ORIGINS: "https://prometheusstudio.tech",
      },
      {textChunkPlanner},
    );

    try {
      const health = await context.app.inject({method: "GET", url: "/health"});
      const preview = await context.app.inject({
        method: "POST",
        url: "/api/maul/text-chunks/preview",
        headers: {origin: "https://prometheusstudio.tech"},
        payload: request,
      });

      expect(health.statusCode).toBe(200);
      expect(health.json()).toEqual({ok: true});
      expect(preview.statusCode).toBe(200);
      expect(preview.json()).toEqual(plan);
      expect(preview.headers["access-control-allow-origin"]).toBe(
        "https://prometheusstudio.tech",
      );
      expect(textChunkPlanner.plan).toHaveBeenCalledWith(
        expect.objectContaining({videoDurationMs: 2_000}),
      );
    } finally {
      await context.app.close();
    }
  });

  it("rejects invalid input before invoking the model adapter", async () => {
    const textChunkPlanner = {plan: vi.fn()};
    const context = await createCoreApp({}, {textChunkPlanner});

    try {
      const response = await context.app.inject({
        method: "POST",
        url: "/api/maul/text-chunks/preview",
        payload: {...request, videoDurationMs: 0},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty("error");
      expect(textChunkPlanner.plan).not.toHaveBeenCalled();
    } finally {
      await context.app.close();
    }
  });

  it("retains the domain job ID while dispatching and polling an on-demand render call", async () => {
    const renderDispatcher = {
      spawn: vi.fn().mockResolvedValue({callId: "fc-render-123"}),
      status: vi.fn().mockResolvedValue({status: "completed", outputFile: "job_final.mp4"}),
    };
    const context = await createCoreApp({}, {renderDispatcher});

    try {
      const submitted = await context.app.inject({
        method: "POST",
        url: "/api/render/jobs",
        payload: {manifest: renderManifest},
      });
      const statusUrl = submitted.json().statusUrl as string;
      const status = await context.app.inject({method: "GET", url: statusUrl});

      expect(submitted.statusCode).toBe(202);
      expect(submitted.json()).toEqual({
        jobId: renderManifest.jobId,
        callId: "fc-render-123",
        status: "queued",
        statusUrl: `/api/render/jobs/${renderManifest.jobId}/calls/fc-render-123`,
      });
      expect(renderDispatcher.spawn).toHaveBeenCalledWith(
        expect.objectContaining({jobId: renderManifest.jobId}),
      );
      expect(status.statusCode).toBe(200);
      expect(status.json()).toEqual({
        jobId: renderManifest.jobId,
        callId: "fc-render-123",
        status: "completed",
        outputFile: "job_final.mp4",
        outputUrl: "/media/job_final.mp4",
      });
    } finally {
      await context.app.close();
    }
  });

  it("dispatches one Modal call for an entire Martin matte batch", async () => {
    const mattingDispatcher = {
      spawn: vi.fn().mockResolvedValue({callId: "fc-matte-123"}),
      status: vi.fn().mockResolvedValue({status: "running"}),
    };
    const context = await createCoreApp({}, {mattingDispatcher});
    const request = {
      schemaVersion: "maul-martin-matte-request/v1",
      requestKind: "martin_matte_batch",
      jobId: "martin-job",
      source: {inputUrl: "https://example.com/source.mp4", sha256: "a".repeat(64), durationMs: 20_000},
      selections: [],
      windows: [{windowId: "w1", sourceStartMs: 1000, sourceEndMs: 3000, outputStartMs: 1000, outputEndMs: 3000}],
    };
    try {
      const submitted = await context.app.inject({method: "POST", url: "/api/matting/jobs", payload: {request}});
      expect(submitted.statusCode).toBe(202);
      expect(mattingDispatcher.spawn).toHaveBeenCalledTimes(1);
      expect(mattingDispatcher.spawn).toHaveBeenCalledWith(request);
      expect(submitted.json().statusUrl).toBe("/api/matting/jobs/martin-job/calls/fc-matte-123");
    } finally {
      await context.app.close();
    }
  });

  it("dispatches one on-demand source analysis call while retaining the durable job identity", async () => {
    const sourceAnalysisDispatcher = {
      spawn: vi.fn().mockResolvedValue({callId: "fc-source-123"}),
      status: vi.fn().mockResolvedValue({status: "running"}),
    };
    const context = await createCoreApp({}, {sourceAnalysisDispatcher});
    const jobId = "123e4567-e89b-12d3-a456-426614174100";
    const sourceAssetId = "123e4567-e89b-12d3-a456-426614174100";

    try {
      const submitted = await context.app.inject({
        method: "POST",
        url: "/api/source-analysis/jobs",
        payload: {jobId, sourceAssetId},
      });
      const statusUrl = submitted.json().statusUrl as string;
      const status = await context.app.inject({method: "GET", url: statusUrl});

      expect(submitted.statusCode).toBe(202);
      expect(sourceAnalysisDispatcher.spawn).toHaveBeenCalledOnce();
      expect(sourceAnalysisDispatcher.spawn).toHaveBeenCalledWith({jobId, sourceAssetId});
      expect(submitted.json()).toEqual({
        jobId,
        sourceAssetId,
        callId: "fc-source-123",
        status: "queued",
        statusUrl: `/api/source-analysis/jobs/${jobId}/calls/fc-source-123`,
      });
      expect(status.json()).toEqual({jobId, callId: "fc-source-123", status: "running"});
    } finally {
      await context.app.close();
    }
  });
});
