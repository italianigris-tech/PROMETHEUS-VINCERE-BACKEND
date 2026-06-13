import type {
  ConfigurationDelta,
  ProgressiveVideoContextSnapshot,
  RenderGraphV2Handoff
} from "./contracts";

const round = (value: number): number => Math.round(value * 1000) / 1000;

const transcriptText = (snapshot: ProgressiveVideoContextSnapshot): string =>
  snapshot.transcript.mergedWords.map((word) => word.text).join(" ").trim();

const durationMsFor = (snapshot: ProgressiveVideoContextSnapshot): number =>
  Math.max(
    1000,
    snapshot.metadata.durationMs ??
      snapshot.transcript.mergedWords.at(-1)?.end_ms ??
      snapshot.motion.segments.at(-1)?.endMs ??
      1000
  );

const fpsFor = (snapshot: ProgressiveVideoContextSnapshot): number => snapshot.metadata.fps ?? 30;

export const buildRenderGraphHandoff = (
  snapshot: ProgressiveVideoContextSnapshot,
  generatedAt: string
): RenderGraphV2Handoff => {
  const fps = fpsFor(snapshot);
  const durationMs = durationMsFor(snapshot);
  const frameCount = Math.max(1, Math.round((durationMs / 1000) * fps));
  const text = transcriptText(snapshot) || "Analysis ready.";
  const firstSegment = snapshot.motion.segments[0] ?? null;

  return {
    schemaVersion: "prometheus-render-graph-v2/v1",
    renderGraphId: `rg_${snapshot.videoId}`,
    videoId: snapshot.videoId,
    generatedAt,
    timebase: {
      kind: "frame-locked",
      fps,
      durationMs,
      frameCount
    },
    layers: [
      {
        id: "base_video",
        type: "video",
        startMs: 0,
        endMs: durationMs,
        track: "base",
        payload: {
          width: snapshot.metadata.width,
          height: snapshot.metadata.height,
          aspectRatio: snapshot.metadata.aspectRatio
        }
      },
      {
        id: "transcript_text_0",
        type: "text",
        startMs: 0,
        endMs: Math.min(durationMs, Math.max(1000, snapshot.transcript.mergedWords.at(8)?.end_ms ?? 2400)),
        track: "foreground",
        payload: {
          text,
          words: snapshot.transcript.mergedWords.slice(0, 40),
          treatment: "progressive-context-primary-caption"
        }
      },
      {
        id: "motion_proxy_0",
        type: "motion",
        startMs: firstSegment?.startMs ?? 0,
        endMs: firstSegment?.endMs ?? Math.min(durationMs, 5000),
        track: "motion",
        payload: {
          intensity: firstSegment?.intensity ?? 0.35,
          detectionSource: firstSegment?.detectionSource ?? "ffmpeg-proxy",
          objects: firstSegment?.objects ?? null
        }
      }
    ],
    assets: [],
    effects: [
      {
        id: "selective_bloom",
        type: "bloom",
        applyTo: ["transcript_text_0"],
        intensity: 0.45
      },
      {
        id: "motion_blur",
        type: "motionBlur",
        shutterAngle: 180,
        enabled: true
      }
    ],
    audio: {
      status: "gated",
      releaseUrl: null,
      syncPoints: snapshot.transcript.mergedWords.slice(0, 12).map((word) => ({
        atMs: Math.round(word.start_ms),
        frame: Math.max(0, Math.round((word.start_ms / 1000) * fps)),
        label: word.text
      }))
    },
    compatibility: {
      legacyManifestCompatible: true,
      requiredRuntime: "WebGL2",
      constraints: [
        "MeshBasicMaterial only unless the frontend explicitly upgrades the material pipeline.",
        "No EffectComposer recreation per frame.",
        "uTime uniform must update every frame.",
        "Use frame-locked preview/export timebase rather than wall-clock sync for export."
      ]
    }
  };
};

export const buildConfigurationDelta = (
  snapshot: ProgressiveVideoContextSnapshot
): ConfigurationDelta => ({
  schemaVersion: "prometheus-configuration-delta/v1",
  videoId: snapshot.videoId,
  sceneUpdates: [
    {
      path: "apps/worker/src/scenes/Scene.tsx",
      operation: "merge",
      value: {
        renderGraphSource: "backend-handoff",
        videoId: snapshot.videoId,
        contextVersion: snapshot.contextVersion
      }
    }
  ],
  postProcessing: {
    bloom: {
      intensity: 0.45,
      selective: true,
      applyTo: ["transcript_text_0"]
    },
    chromaticAberration: {
      intensity: 0.003,
      applyTo: ["transcript_text_0"]
    },
    motionBlur: {
      enabled: true,
      shutterAngle: 180
    }
  },
  typography: {
    fonts: [],
    colorRanges: snapshot.transcript.mergedWords.slice(0, 8).map((word, index) => ({
      word: word.text,
      color: index % 2 === 0 ? "#ffffff" : "#7be8ff"
    })),
    fallback: "system-ui"
  },
  temporalSync: {
    timebase: "frame-locked",
    fps: fpsFor(snapshot)
  },
  warnings: snapshot.warnings
});

export const buildInstructionalManual = ({
  snapshot,
  renderGraph,
  delta
}: {
  snapshot: ProgressiveVideoContextSnapshot;
  renderGraph: RenderGraphV2Handoff;
  delta: ConfigurationDelta;
}): string => `# PROMETHEUS RENDER HANDOFF - Video ID: ${snapshot.videoId}

## Generated: ${renderGraph.generatedAt} | Backend Version: progressive-video-context/v1

## 1. Render Graph Summary
- Total Duration: ${round(renderGraph.timebase.durationMs / 1000)}s
- FPS: ${renderGraph.timebase.fps}
- Frame Count: ${renderGraph.timebase.frameCount}
- Context Level: ${snapshot.contextLevel}
- Transcript Words: ${snapshot.transcript.mergedWords.length}
- Motion Segments: ${snapshot.motion.segments.length}
- Audio Status: ${renderGraph.audio.status}

## 2. Frontend Configuration Changes
- Load RenderGraph IR from \`/api/videos/${snapshot.videoId}/render-graph\`.
- Apply configuration delta from \`/api/videos/${snapshot.videoId}/configuration-delta\`.
- Scene update target: \`${delta.sceneUpdates[0]?.path ?? "Scene.tsx"}\`.
- Configure selective post-processing per layer, not as one global chain.

## 3. Temporal Sync Protocol
- Shared timebase: ${delta.temporalSync.timebase}
- FPS: ${delta.temporalSync.fps}
- Audio release is gated until the frontend posts readiness to \`/api/videos/${snapshot.videoId}/frontend-ready\`.

## 4. Handshake Sequence
1. Frontend receives RenderGraph IR.
2. Frontend validates schema against \`RenderGraphV2Handoff\`.
3. Frontend loads font metrics and caches fallback metrics.
4. Frontend pre-compiles shaders for vertex deformation and post-processing.
5. Frontend sends \`frontend-ready\` with all readiness booleans true.
6. Backend releases audio assets for sync.
7. Frontend begins preview in wall-clock mode.
8. Frontend switches to stepped-frame mode for export.

## 5. Known Constraints
- WebGL 2.0 runtime is required.
- No EffectComposer recreation per frame.
- Use frame-locked export timing, not wall-clock timing.
- Object/person detection is nullable in v1 unless a vision adapter is configured.
`;

export const buildFrontendBriefing = ({
  snapshot,
  renderGraph
}: {
  snapshot: ProgressiveVideoContextSnapshot;
  renderGraph: RenderGraphV2Handoff;
}): string => `# PROMETHEUS FRONTEND BRIEFING - ${snapshot.videoId}

## Endpoint order
1. \`POST /api/videos\` with \`source_video\` multipart or JSON \`source_media_ref\`.
2. Open \`GET /api/videos/${snapshot.videoId}/progress\` as EventSource immediately.
3. Open \`WS /api/videos/${snapshot.videoId}/chat\` for chat and commands.
4. Fetch \`GET /api/videos/${snapshot.videoId}/context\` after every context refresh you care about.
5. Fetch final artifacts when \`handoff.ready\` arrives.
6. Post \`frontend-ready\`, then use the returned audio release URL. Do not fetch \`/audio\` before release.

## SSE handling
- Events are durable JSONL-backed and replayable.
- Dedupe by \`id\`.
- Reconnect with \`Last-Event-ID\`.
- Treat \`: heartbeat\` as liveness only.
- If a replayed event has an older \`contextVersion\`, ignore it as stale.
- Event payloads follow \`ProgressiveVideoContextEvent\`: \`id\`, \`type\`, \`videoId\`, \`timestamp\`, \`contextVersion\`, \`contextLevel\`, \`progress\`, \`data\`.
- Keep a monotonically increasing local \`contextVersion\`; fetch \`/context\` only when an event version is newer than local state.
- \`partial_transcript.ready\` is chunk-complete data, not word-by-word live transcription for uploaded files.

## Context pyramid rules
- Level 1: static animation capabilities and constraints.
- Level 2: video metadata.
- Level 3: partial transcript chunks.
- Level 4: motion proxy analysis.
- Level 5: full RenderGraph handoff.
- Context is additive. Older levels stay valid when higher levels arrive.
- \`coverage.coveredTranscriptRangesMs\` and \`coverage.uncoveredRangesMs\` are the chatbot truth source for timestamp-specific answers.

## Chatbot behavior
- Default mode is progressive disclosure.
- One-shot mode is set with WebSocket \`{"type":"set_mode","mode":"one-shot"}\`.
- Chat messages use WebSocket \`{"type":"chat_message","messageId":"...","content":"..."}\`.
- Preview commands use WebSocket \`{"type":"preview_command","command":"..."}\`.
- If the user asks about an uncovered timestamp, say it is unknown/not processed yet and name the nearest covered range.
- Uploaded files cannot provide true word-by-word live streaming; partial transcript means completed chunk results.
- In progressive mode, surface discoveries as they arrive. In one-shot mode, suppress planning claims until \`handoff.ready\`.

## Render handoff sequence
- Validate \`${renderGraph.renderGraphId}\` against the shared RenderGraph schema.
- Load font metrics before preview.
- Precompile shaders before sending readiness.
- Prepare per-layer effects, especially selective bloom and chromatic aberration.
- Send \`POST /api/videos/${snapshot.videoId}/frontend-ready\`.
- Use returned audio release URL only after readiness succeeds.
- Preview may run wall-clock; export must run stepped-frame/frame-locked.
- RenderGraph audio starts as \`{"status":"gated","releaseUrl":null}\`. Treat any optimistic audio URL as invalid until readiness returns \`audio.status="released"\`.
- Keep the existing render manifest path compatible; this handoff is an overlay contract, not a replacement for legacy manifests.

## Required frontend state
- \`videoId\`: returned by creation.
- \`seenEventIds\`: set of SSE ids for dedupe.
- \`contextVersion\`: latest accepted context version.
- \`contextSnapshot\`: latest \`ProgressiveVideoContextSnapshot\`.
- \`renderGraph\`, \`configurationDelta\`, \`instructionalManual\`, \`frontendBriefing\`: nullable until final artifact routes succeed.
- \`audioRelease\`: nullable until readiness succeeds.

## Runtime constraints
- Require WebGL 2.0 before preview.
- Never recreate EffectComposer per frame.
- Keep \`uTime\` and frame index updates deterministic.
- Prefer frame/timebase sync over wall-clock sync for export.
- Apply effects per layer where the RenderGraph asks for selective processing.

## Failure handling
- AssemblyAI delays should keep chat alive with static/metadata context.
- Provider fallback is surfaced in transcript provider/fallback fields.
- Failed chunks leave coverage gaps; do not invent context.
- Schema drift should fail validation and block audio release.
- Reconnect recovery uses EventSource replay and \`Last-Event-ID\`.
- A 423 response from \`/audio\` means readiness has not released sync-critical audio.
- If \`frontend-ready\` is rejected, show the rejected readiness field and do not begin audio-synced preview.
- If a provider fallback has lower confidence, mark answers as degraded rather than pretending all providers are equivalent.
`;
