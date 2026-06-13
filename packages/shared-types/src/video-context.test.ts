import {describe, expect, it} from "vitest";

import {
  backendMessageSchema,
  configurationDeltaSchema,
  frontendMessageSchema,
  frontendReadinessHandshakeSchema,
  progressiveVideoContextEventSchema,
  progressiveVideoContextSnapshotSchema,
  renderGraphV2HandoffSchema
} from "./video-context.js";

describe("progressive video context shared contracts", () => {
  it("validates context snapshots and replayable backend events", () => {
    const snapshot = progressiveVideoContextSnapshotSchema.parse({
      schemaVersion: "prometheus-progressive-video-context/v1",
      videoId: "video_alpha",
      status: "streaming",
      mode: "progressive",
      contextLevel: 3,
      contextVersion: 7,
      coverage: {
        transcriptComplete: false,
        motionComplete: false,
        renderPlanComplete: false,
        coveredTranscriptRangesMs: [[0, 120000]],
        uncoveredRangesMs: [[120000, 600000]]
      },
      staticContext: {
        capabilities: ["kinetic typography"],
        motionPatterns: ["spring-rise"],
        lusionCriteria: ["restraint"],
        constraints: ["WebGL 2.0"]
      },
      metadata: {
        durationMs: 600000,
        width: 1920,
        height: 1080,
        fps: 30,
        aspectRatio: "16:9",
        containerFormat: "mov,mp4",
        codecVideo: "h264",
        fileSizeBytes: 123456
      },
      transcript: {
        chunks: [
          {
            chunkId: "chunk_0",
            index: 0,
            startMs: 0,
            endMs: 120000,
            status: "completed",
            words: [{text: "Launch", start_ms: 0, end_ms: 250, confidence: 0.98}]
          }
        ],
        mergedWords: [{text: "Launch", start_ms: 0, end_ms: 250, confidence: 0.98}],
        provider: "assemblyai",
        fallbackChain: ["assemblyai"]
      },
      motion: {
        segments: [
          {
            id: "motion_0",
            startMs: 0,
            endMs: 120000,
            intensity: 0.42,
            sceneChange: false,
            keyframeTimestampsMs: [0, 5000],
            detectionSource: "ffmpeg-proxy",
            objects: null
          }
        ],
        analysisComplete: false
      },
      handoff: {
        renderGraphReady: false,
        instructionalManualReady: false,
        configurationDeltaReady: false,
        frontendBriefingReady: false,
        audioReleased: false
      },
      warnings: []
    });

    expect(snapshot.contextLevel).toBe(3);

    const event = progressiveVideoContextEventSchema.parse({
      id: "video_alpha:partial_transcript.ready:1",
      type: "partial_transcript.ready",
      videoId: "video_alpha",
      timestamp: "2026-06-13T18:00:00.000Z",
      contextVersion: 7,
      contextLevel: 3,
      progress: 35,
      data: {chunkId: "chunk_0"}
    });

    expect(event.id).toContain("partial_transcript.ready");
  });

  it("validates frontend/backend messages and the readiness-gated render handoff", () => {
    const backendMessage = backendMessageSchema.parse({
      type: "context_refresh",
      refreshType: "transcript",
      data: {chunkId: "chunk_0"},
      isComplete: false
    });
    expect(backendMessage.type).toBe("context_refresh");

    const frontendMessage = frontendMessageSchema.parse({
      type: "set_mode",
      mode: "one-shot"
    });
    expect(frontendMessage.mode).toBe("one-shot");

    const renderGraph = renderGraphV2HandoffSchema.parse({
      schemaVersion: "prometheus-render-graph-v2/v1",
      renderGraphId: "rg_video_alpha",
      videoId: "video_alpha",
      generatedAt: "2026-06-13T18:00:00.000Z",
      timebase: {
        kind: "frame-locked",
        fps: 30,
        durationMs: 10000,
        frameCount: 300
      },
      layers: [
        {
          id: "text_0",
          type: "text",
          startMs: 0,
          endMs: 1000,
          track: "foreground",
          payload: {text: "Launch"}
        }
      ],
      assets: [],
      effects: [],
      audio: {
        status: "gated",
        releaseUrl: null,
        syncPoints: []
      },
      compatibility: {
        legacyManifestCompatible: true,
        requiredRuntime: "WebGL2",
        constraints: ["No EffectComposer recreation per frame"]
      }
    });
    expect(renderGraph.audio.status).toBe("gated");

    const delta = configurationDeltaSchema.parse({
      schemaVersion: "prometheus-configuration-delta/v1",
      videoId: "video_alpha",
      sceneUpdates: [{path: "Scene.tsx", operation: "set", value: "RenderGraphV2"}],
      postProcessing: {bloom: {selective: true}},
      typography: {fonts: [], colorRanges: []},
      temporalSync: {timebase: "frame-locked", fps: 30},
      warnings: []
    });
    expect(delta.temporalSync.fps).toBe(30);

    expect(() =>
      frontendReadinessHandshakeSchema.parse({
        schemaVersion: "prometheus-frontend-readiness/v1",
        renderGraphId: "rg_video_alpha",
        frontendInstanceId: "front_1",
        schemaValidated: true,
        fontMetricsLoaded: true,
        shadersPrecompiled: false,
        timebaseAccepted: true
      })
    ).toThrow();
  });
});
