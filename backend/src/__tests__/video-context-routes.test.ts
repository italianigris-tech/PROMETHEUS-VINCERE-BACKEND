import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {cleanupTempDir, createTempFile, createTestApp, makeTempDir} from "./test-utils";

const parseSseEvents = (body: string): Array<Record<string, any>> =>
  body
    .split(/\n\n+/)
    .map((chunk) => {
      const eventLine = chunk.split(/\n/).find((line) => line.startsWith("event: "));
      const dataLine = chunk.split(/\n/).find((line) => line.startsWith("data: "));
      if (!dataLine) {
        return null;
      }
      return {
        event: eventLine?.slice("event: ".length),
        ...JSON.parse(dataLine.slice("data: ".length))
      };
    })
    .filter((event): event is Record<string, any> => Boolean(event));

describe("progressive video context routes", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("starts chat-first video analysis, replays durable SSE, and exposes final handoff artifacts", async () => {
    const sourcePath = await createTempFile({
      dir: tempDir,
      fileName: "source.mp4",
      contents: "fake-video"
    });

    const context = await createTestApp({
      storageDir: tempDir,
      deps: {
        videoContext: {
          probeVideoMetadata: async () => ({
            width: 1920,
            height: 1080,
            fps: 30,
            duration_seconds: 12,
            duration_in_frames: 360,
            codec_video: "h264",
            container_format: "mov,mp4",
            bitrate_video: 4_000_000
          }),
          transcribeChunk: async ({chunk}) => ({
            provider: "assemblyai",
            words: [
              {
                text: chunk.index === 0 ? "Launch" : "Finish",
                start_ms: 100,
                end_ms: 450,
                confidence: 0.97
              }
            ]
          }),
          runFinalPipeline: async () => undefined,
          now: () => "2026-06-13T18:00:00.000Z"
        }
      }
    });
    const createResponse = await context.app.inject({
      method: "POST",
      url: "/api/videos",
      payload: {
        source_media_ref: sourcePath,
        prompt: "Build a lusion-grade animation plan.",
        mode: "progressive"
      }
    });

    expect(createResponse.statusCode).toBe(202);
    expect((context.app as unknown as {websocketServer?: unknown}).websocketServer).toBeDefined();
    const createBody = createResponse.json();
    expect(createBody.videoId).toMatch(/^video_/);
    expect(createBody.initialAssistantMessage).toContain("analyzing");
    expect(createBody.context.contextLevel).toBe(1);
    expect(createBody.urls).toMatchObject({
      progress: `/api/videos/${createBody.videoId}/progress`,
      context: `/api/videos/${createBody.videoId}/context`,
      renderGraph: `/api/videos/${createBody.videoId}/render-graph`,
      frontendBriefing: `/api/videos/${createBody.videoId}/frontend-briefing`
    });

    const initialReplay = await context.app.inject({
      method: "GET",
      url: `/api/videos/${createBody.videoId}/progress?replay=once`
    });
    expect(initialReplay.statusCode).toBe(200);
    expect(initialReplay.headers["content-type"]).toContain("text/event-stream");
    const initialEvents = parseSseEvents(initialReplay.body);
    expect(initialEvents.map((event) => event.type)).toEqual(
      expect.arrayContaining(["video.created", "context.static.ready"])
    );

    await context.queue.onIdle();

    const statusResponse = await context.app.inject({
      method: "GET",
      url: `/api/videos/${createBody.videoId}`
    });
    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json()).toMatchObject({
      videoId: createBody.videoId,
      status: "handoff_ready",
      artifactAvailability: {
        renderGraph: true,
        instructionalManual: true,
        configurationDelta: true,
        frontendBriefing: true
      }
    });

    const snapshotResponse = await context.app.inject({
      method: "GET",
      url: `/api/videos/${createBody.videoId}/context`
    });
    expect(snapshotResponse.statusCode).toBe(200);
    expect(snapshotResponse.json().contextLevel).toBe(5);
    expect(snapshotResponse.json().transcript.mergedWords.map((word: {text: string}) => word.text)).toContain("Launch");
    expect(snapshotResponse.json().motion.segments[0]).toMatchObject({
      detectionSource: "ffmpeg-proxy",
      objects: null
    });

    const renderGraphResponse = await context.app.inject({
      method: "GET",
      url: `/api/videos/${createBody.videoId}/render-graph`
    });
    expect(renderGraphResponse.statusCode).toBe(200);
    expect(renderGraphResponse.json()).toMatchObject({
      schemaVersion: "prometheus-render-graph-v2/v1",
      videoId: createBody.videoId,
      audio: {
        status: "gated",
        releaseUrl: null
      }
    });

    const gatedAudioResponse = await context.app.inject({
      method: "GET",
      url: `/api/videos/${createBody.videoId}/audio`
    });
    expect(gatedAudioResponse.statusCode).toBe(423);

    const manualResponse = await context.app.inject({
      method: "GET",
      url: `/api/videos/${createBody.videoId}/instructional-manual`
    });
    expect(manualResponse.statusCode).toBe(200);
    expect(manualResponse.body).toContain("PROMETHEUS RENDER HANDOFF");
    expect(manualResponse.body).toContain("Handshake Sequence");

    const deltaResponse = await context.app.inject({
      method: "GET",
      url: `/api/videos/${createBody.videoId}/configuration-delta`
    });
    expect(deltaResponse.statusCode).toBe(200);
    expect(deltaResponse.json()).toMatchObject({
      schemaVersion: "prometheus-configuration-delta/v1",
      videoId: createBody.videoId
    });

    const briefingResponse = await context.app.inject({
      method: "GET",
      url: `/api/videos/${createBody.videoId}/frontend-briefing`
    });
    expect(briefingResponse.statusCode).toBe(200);
    expect(briefingResponse.body).toContain("Endpoint order");
    expect(briefingResponse.body).toContain("unknown/not processed yet");
    expect(briefingResponse.body).toContain("Last-Event-ID");

    const readyResponse = await context.app.inject({
      method: "POST",
      url: `/api/videos/${createBody.videoId}/frontend-ready`,
      payload: {
        schemaVersion: "prometheus-frontend-readiness/v1",
        renderGraphId: renderGraphResponse.json().renderGraphId,
        frontendInstanceId: "frontend_test",
        schemaValidated: true,
        fontMetricsLoaded: true,
        shadersPrecompiled: true,
        timebaseAccepted: true
      }
    });
    expect(readyResponse.statusCode).toBe(200);
    expect(readyResponse.json()).toMatchObject({
      audioReleased: true,
      audio: {
        status: "released",
        releaseUrl: `/api/videos/${createBody.videoId}/audio`
      }
    });

    const audioResponse = await context.app.inject({
      method: "GET",
      url: readyResponse.json().audio.releaseUrl
    });
    expect(audioResponse.statusCode).toBe(200);
    expect(audioResponse.body).toBe("fake-video");

    const completedReplay = await context.app.inject({
      method: "GET",
      url: `/api/videos/${createBody.videoId}/progress?replay=once`
    });
    const completedEvents = parseSseEvents(completedReplay.body);
    expect(completedEvents.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        "partial_transcript.ready",
        "motion.analysis.ready",
        "render_graph.ready",
        "handoff.ready",
        "frontend.audio.released"
      ])
    );

    await context.app.close();
  }, 30_000);
});
