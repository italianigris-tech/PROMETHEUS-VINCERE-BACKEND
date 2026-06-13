import {z} from "zod";

const transcribedWordSchema = z.object({
  text: z.string().min(1),
  start_ms: z.number().nonnegative(),
  end_ms: z.number().nonnegative(),
  confidence: z.number().min(0).max(1).optional()
}).superRefine((word, ctx) => {
  if (word.end_ms <= word.start_ms) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "end_ms must be greater than start_ms",
      path: ["end_ms"]
    });
  }
});

const timeRangeSchema = z.tuple([z.number().nonnegative(), z.number().nonnegative()])
  .superRefine((range, ctx) => {
    if (range[1] < range[0]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "range end must be greater than or equal to start"
      });
    }
  });

export const videoContextModeSchema = z.enum(["progressive", "one-shot"]);
export const videoContextStatusSchema = z.enum([
  "queued",
  "streaming",
  "metadata_ready",
  "transcribing",
  "motion_analyzing",
  "planning",
  "handoff_ready",
  "failed"
]);
export const videoContextLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5)
]);

export const transcriptChunkStatusSchema = z.enum(["queued", "processing", "completed", "failed"]);
export const transcriptProviderSchema = z.enum([
  "assemblyai",
  "whisperx",
  "deepgram",
  "google",
  "provided",
  "none"
]);

export const progressiveTranscriptChunkSchema = z.object({
  chunkId: z.string().min(1),
  index: z.number().int().nonnegative(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  status: transcriptChunkStatusSchema,
  words: z.array(transcribedWordSchema).default([]),
  error: z.string().optional()
}).superRefine((chunk, ctx) => {
  if (chunk.endMs <= chunk.startMs) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "chunk endMs must be greater than startMs",
      path: ["endMs"]
    });
  }
});

export const progressiveMotionSegmentSchema = z.object({
  id: z.string().min(1),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  intensity: z.number().min(0).max(1),
  sceneChange: z.boolean(),
  keyframeTimestampsMs: z.array(z.number().int().nonnegative()).default([]),
  detectionSource: z.enum(["ffmpeg-proxy", "vision-adapter"]),
  objects: z.array(z.object({
    label: z.string().min(1),
    confidence: z.number().min(0).max(1),
    box: z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0).max(1),
      height: z.number().min(0).max(1)
    }).optional()
  })).nullable()
}).superRefine((segment, ctx) => {
  if (segment.endMs <= segment.startMs) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "segment endMs must be greater than startMs",
      path: ["endMs"]
    });
  }
});

export const progressiveVideoContextSnapshotSchema = z.object({
  schemaVersion: z.literal("prometheus-progressive-video-context/v1"),
  videoId: z.string().min(1),
  status: videoContextStatusSchema,
  mode: videoContextModeSchema,
  contextLevel: videoContextLevelSchema,
  contextVersion: z.number().int().nonnegative(),
  coverage: z.object({
    transcriptComplete: z.boolean(),
    motionComplete: z.boolean(),
    renderPlanComplete: z.boolean(),
    coveredTranscriptRangesMs: z.array(timeRangeSchema).default([]),
    uncoveredRangesMs: z.array(timeRangeSchema).default([])
  }),
  staticContext: z.object({
    capabilities: z.array(z.string()).default([]),
    motionPatterns: z.array(z.string()).default([]),
    lusionCriteria: z.array(z.string()).default([]),
    constraints: z.array(z.string()).default([])
  }),
  metadata: z.object({
    durationMs: z.number().int().nonnegative().nullable(),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    fps: z.number().positive().nullable(),
    aspectRatio: z.string().nullable(),
    containerFormat: z.string().nullable(),
    codecVideo: z.string().nullable(),
    fileSizeBytes: z.number().int().nonnegative().nullable()
  }),
  transcript: z.object({
    chunks: z.array(progressiveTranscriptChunkSchema).default([]),
    mergedWords: z.array(transcribedWordSchema).default([]),
    provider: transcriptProviderSchema,
    fallbackChain: z.array(transcriptProviderSchema).default([])
  }),
  motion: z.object({
    segments: z.array(progressiveMotionSegmentSchema).default([]),
    analysisComplete: z.boolean()
  }),
  handoff: z.object({
    renderGraphReady: z.boolean(),
    instructionalManualReady: z.boolean(),
    configurationDeltaReady: z.boolean(),
    frontendBriefingReady: z.boolean(),
    audioReleased: z.boolean()
  }),
  warnings: z.array(z.string()).default([])
});

export const progressiveVideoContextEventSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "video.created",
    "context.static.ready",
    "metadata.ready",
    "transcript.chunk.started",
    "partial_transcript.ready",
    "transcript.complete",
    "motion.analysis.ready",
    "render_graph.ready",
    "handoff.ready",
    "frontend.audio.released",
    "video.failed",
    "chat.response",
    "mode.changed"
  ]),
  videoId: z.string().min(1),
  timestamp: z.string().min(1),
  contextVersion: z.number().int().nonnegative(),
  contextLevel: videoContextLevelSchema,
  progress: z.number().min(0).max(100),
  data: z.record(z.unknown()).default({})
});

export const renderGraphV2HandoffSchema = z.object({
  schemaVersion: z.literal("prometheus-render-graph-v2/v1"),
  renderGraphId: z.string().min(1),
  videoId: z.string().min(1),
  generatedAt: z.string().min(1),
  timebase: z.object({
    kind: z.enum(["frame-locked", "nanosecond"]),
    fps: z.number().positive(),
    durationMs: z.number().int().positive(),
    frameCount: z.number().int().positive()
  }),
  layers: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(["video", "text", "motion", "effect", "matte", "audio"]),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
    track: z.string().min(1),
    payload: z.record(z.unknown()).default({})
  })).default([]),
  assets: z.array(z.record(z.unknown())).default([]),
  effects: z.array(z.record(z.unknown())).default([]),
  audio: z.object({
    status: z.enum(["gated", "released", "unavailable"]),
    releaseUrl: z.string().nullable(),
    syncPoints: z.array(z.object({
      atMs: z.number().int().nonnegative(),
      frame: z.number().int().nonnegative(),
      label: z.string().min(1)
    })).default([])
  }),
  compatibility: z.object({
    legacyManifestCompatible: z.boolean(),
    requiredRuntime: z.string().min(1),
    constraints: z.array(z.string()).default([])
  })
});

export const configurationDeltaSchema = z.object({
  schemaVersion: z.literal("prometheus-configuration-delta/v1"),
  videoId: z.string().min(1),
  sceneUpdates: z.array(z.object({
    path: z.string().min(1),
    operation: z.enum(["set", "merge", "remove"]),
    value: z.unknown().optional()
  })).default([]),
  postProcessing: z.record(z.unknown()).default({}),
  typography: z.record(z.unknown()).default({}),
  temporalSync: z.object({
    timebase: z.string().min(1),
    fps: z.number().positive()
  }),
  warnings: z.array(z.string()).default([])
});

export const frontendReadinessHandshakeSchema = z.object({
  schemaVersion: z.literal("prometheus-frontend-readiness/v1"),
  renderGraphId: z.string().min(1),
  frontendInstanceId: z.string().min(1),
  schemaValidated: z.boolean(),
  fontMetricsLoaded: z.boolean(),
  shadersPrecompiled: z.boolean(),
  timebaseAccepted: z.boolean()
}).superRefine((ready, ctx) => {
  const readinessChecks: Array<[string, boolean]> = [
    ["schemaValidated", ready.schemaValidated],
    ["fontMetricsLoaded", ready.fontMetricsLoaded],
    ["shadersPrecompiled", ready.shadersPrecompiled],
    ["timebaseAccepted", ready.timebaseAccepted]
  ];
  const failed = readinessChecks.filter(([, value]) => value !== true);

  for (const [field] of failed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${field} must be true before audio release`,
      path: [field]
    });
  }
});

export const backendMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("chat_response"),
    messageId: z.string().min(1),
    content: z.string(),
    contextUsed: z.array(z.string()).default([])
  }),
  z.object({
    type: z.literal("progress_update"),
    stage: z.enum(["upload", "audio_extract", "transcribe", "frame_analysis", "plan", "render"]),
    percent: z.number().min(0).max(100),
    etaSeconds: z.number().nonnegative().nullable(),
    partialResults: z.unknown().optional()
  }),
  z.object({
    type: z.literal("context_refresh"),
    refreshType: z.enum(["transcript", "animation_plan", "render_graph", "motion_analysis", "metadata"]),
    data: z.unknown(),
    isComplete: z.boolean()
  }),
  z.object({
    type: z.literal("render_graph_ready"),
    renderGraph: renderGraphV2HandoffSchema,
    instructions: z.string()
  })
]);

export const frontendMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("chat_message"),
    content: z.string(),
    context: z.object({
      hasTranscript: z.boolean(),
      hasAnimationPlan: z.boolean()
    }).optional()
  }),
  z.object({
    type: z.literal("request_animation_preview"),
    segmentRange: z.tuple([z.number(), z.number()]).optional()
  }),
  z.object({
    type: z.literal("confirm_render_graph"),
    renderGraphId: z.string().min(1)
  }),
  z.object({
    type: z.literal("set_mode"),
    mode: videoContextModeSchema
  })
]);

export type ProgressiveVideoContextEvent = z.infer<typeof progressiveVideoContextEventSchema>;
export type ProgressiveVideoContextSnapshot = z.infer<typeof progressiveVideoContextSnapshotSchema>;
export type BackendMessage = z.infer<typeof backendMessageSchema>;
export type FrontendMessage = z.infer<typeof frontendMessageSchema>;
export type RenderGraphV2Handoff = z.infer<typeof renderGraphV2HandoffSchema>;
export type ConfigurationDelta = z.infer<typeof configurationDeltaSchema>;
export type FrontendReadinessHandshake = z.infer<typeof frontendReadinessHandshakeSchema>;
