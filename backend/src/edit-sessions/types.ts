import {z} from "zod";

import {TypographyProfileV2Schema} from "@prometheus/shared-types";
import {transcribedWordSchema} from "../schemas";

export const editSessionStatusSchema = z.enum([
  "uploaded",
  "preview_pending",
  "preview_placeholder_ready",
  "preview_text_ready",
  "full_transcript_pending",
  "full_transcript_ready",
  "analysis_pending",
  "analysis_ready",
  "motion_graphics_pending",
  "motion_graphics_ready",
  "render_pending",
  "rendering",
  "render_complete",
  "failed"
]);

export const editPreviewStatusSchema = z.enum([
  "idle",
  "preview_pending",
  "preview_placeholder_ready",
  "preview_text_ready",
  "failed"
]);

export const editTranscriptStatusSchema = z.enum([
  "idle",
  "full_transcript_pending",
  "full_transcript_ready",
  "failed"
]);

export const editAnalysisStatusSchema = z.enum([
  "idle",
  "analysis_pending",
  "analysis_ready",
  "failed"
]);

export const editMotionGraphicsStatusSchema = z.enum([
  "idle",
  "motion_graphics_pending",
  "motion_graphics_ready",
  "failed"
]);

export const editRenderStatusSchema = z.enum([
  "idle",
  "render_pending",
  "rendering",
  "render_complete",
  "failed"
]);

export const editTypographyStyleIdSchema = z.enum([
  "svg_typography_v1",
  "longform_svg_typography_v1",
  "longform_eve_typography_v1",
  "longform_docked_inverse_v1",
  "longform_semantic_sidecall_v1"
]);

export const editSessionPlaceholderReasonSchema = z.enum([
  "waiting_for_audio",
  "transcript_delayed",
  "transcript_failed",
  "render_waiting"
]);

export const editSessionMotionPhaseSchema = z.enum([
  "placeholder",
  "reveal",
  "lock",
  "settle"
]);

export const editSessionMotionAnimationSchema = z.enum([
  "fade_up",
  "type_lock",
  "soft_push",
  "settle"
]);

export const editSessionMotionSourceSchema = z.enum([
  "placeholder",
  "streaming_turn",
  "final_transcript"
]);

export const editSessionPreviewManifestInteractiveLaneSchema = z.enum([
  "hyperframes",
  "remotion"
]);

export const editSessionPreviewManifestSourceKindSchema = z.enum([
  "session_source_stream",
  "remote_url",
  "r2_asset",
  "local_test_asset",
  "none"
]);

export const editSessionPlaceholderSchema = z.object({
  active: z.boolean(),
  styleId: editTypographyStyleIdSchema,
  copy: z.string(),
  reason: editSessionPlaceholderReasonSchema,
  line1: z.string(),
  line2: z.string().nullable()
});

export const editSessionMotionCueSchema = z.object({
  cueId: z.string(),
  phase: editSessionMotionPhaseSchema,
  animation: editSessionMotionAnimationSchema,
  text: z.string(),
  lineIndex: z.number().int().nonnegative(),
  startMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
  emphasisWords: z.array(z.string()).default([]),
  source: editSessionMotionSourceSchema,
  createdAt: z.string()
});

export const editSessionPreviewStateSchema = z.object({
  styleId: editTypographyStyleIdSchema,
  status: editPreviewStatusSchema,
  text: z.string().nullable(),
  lines: z.array(z.string()).default([]),
  placeholder: editSessionPlaceholderSchema,
  motionSequence: z.array(editSessionMotionCueSchema).default([]),
  lastTranscriptFragment: z.string().nullable(),
  lastTurnAt: z.string().nullable(),
  readyAt: z.string().nullable()
});

export const editSessionTranscriptStateSchema = z.object({
  status: editTranscriptStatusSchema,
  progress: z.number().min(0).max(100),
  transcriptId: z.string().nullable(),
  words: z.array(transcribedWordSchema).default([]),
  text: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable()
});

export const editSessionAnalysisStateSchema = z.object({
  status: editAnalysisStatusSchema,
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  summary: z.record(z.string(), z.unknown()).default({})
});

export const editSessionMotionGraphicsStateSchema = z.object({
  status: editMotionGraphicsStatusSchema,
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  summary: z.record(z.string(), z.unknown()).default({})
});

export const editSessionRenderStateSchema = z.object({
  status: editRenderStatusSchema,
  progress: z.number().min(0).max(100),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  outputUrl: z.string().nullable(),
  outputPath: z.string().nullable()
});

export const editSessionLiveActivitySchema = z.object({
  activityCode: z.string(),
  detail: z.string(),
  heartbeat: z.string(),
  lastActiveAt: z.string()
});

export const editSessionPublicRoutesSchema = z.object({
  status: z.string(),
  previewManifest: z.string(),
  josephManifest: z.string(),
  josephRenderJob: z.string(),
  previewArtifact: z.string(),
  preview: z.string(),
  render: z.string(),
  renderStatus: z.string(),
  sourceMedia: z.string().nullable(),
  events: z.string()
});

export const editSessionPublicLanesSchema = z.object({
  defaultInteractive: editSessionPreviewManifestInteractiveLaneSchema,
  interactive: z.array(editSessionPreviewManifestInteractiveLaneSchema),
  export: z.literal("remotion")
});

export const editSessionCreateRequestSchema = z.object({
  mediaUrl: z.string().trim().optional(),
  storageKey: z.string().trim().optional(),
  sourceFilename: z.string().trim().optional(),
  captionProfileId: editTypographyStyleIdSchema.optional(),
  motionTier: z.string().trim().optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const editSessionUploadCompleteRequestSchema = z.object({
  mediaUrl: z.string().trim().optional(),
  storageKey: z.string().trim().optional(),
  sourcePath: z.string().trim().optional(),
  sourceFilename: z.string().trim().optional(),
  sourceDurationMs: z.number().nonnegative().nullable().optional(),
  sourceAspectRatio: z.string().trim().nullable().optional(),
  sourceWidth: z.number().int().positive().nullable().optional(),
  sourceHeight: z.number().int().positive().nullable().optional(),
  sourceFps: z.number().positive().nullable().optional(),
  sourceHasVideo: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  autoStartPreview: z.boolean().optional()
});

export const editSessionPreviewStartRequestSchema = z.object({
  previewSeconds: z.number().int().min(1).max(20).optional()
});

export const editSessionRenderStartRequestSchema = z.object({
  cleanRun: z.boolean().optional(),
  deliveryMode: z.enum(["speed-draft", "master-render"]).optional()
});

export const editSessionStateSchema = z.object({
  id: z.string(),
  status: editSessionStatusSchema,
  mediaUrl: z.string().nullable(),
  storageKey: z.string().nullable(),
  sourcePath: z.string().nullable(),
  sourceFilename: z.string().nullable(),
  sourceDurationMs: z.number().nullable(),
  sourceAspectRatio: z.string().nullable(),
  sourceWidth: z.number().int().positive().nullable(),
  sourceHeight: z.number().int().positive().nullable(),
  sourceFps: z.number().positive().nullable(),
  sourceHasVideo: z.boolean(),
  captionProfileId: editTypographyStyleIdSchema,
  motionTier: z.string(),
  previewStatus: editPreviewStatusSchema,
  previewText: z.string().nullable(),
  previewPlaceholder: editSessionPlaceholderSchema,
  previewLines: z.array(z.string()).default([]),
  previewMotionSequence: z.array(editSessionMotionCueSchema).default([]),
  transcriptStatus: editTranscriptStatusSchema,
  transcriptProgress: z.number().min(0).max(100),
  transcriptWords: z.array(transcribedWordSchema).default([]),
  transcriptText: z.string().nullable(),
  analysisStatus: editAnalysisStatusSchema,
  analysisSummary: z.record(z.string(), z.unknown()).default({}),
  motionGraphicsStatus: editMotionGraphicsStatusSchema,
  motionGraphicsSummary: z.record(z.string(), z.unknown()).default({}),
  renderStatus: editRenderStatusSchema,
  renderProgress: z.number().min(0).max(100),
  renderOutputUrl: z.string().nullable(),
  renderOutputPath: z.string().nullable(),
  liveActivity: editSessionLiveActivitySchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().nullable(),
  previewStartedAt: z.string().nullable(),
  transcriptStartedAt: z.string().nullable(),
  transcriptCompletedAt: z.string().nullable(),
  analysisStartedAt: z.string().nullable(),
  analysisCompletedAt: z.string().nullable(),
  motionGraphicsStartedAt: z.string().nullable(),
  motionGraphicsCompletedAt: z.string().nullable(),
  renderStartedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  streamSessionId: z.string().nullable(),
  lastEventType: z.string().nullable(),
  lastPreviewUpdateAt: z.string().nullable(),
  lastTranscriptUpdateAt: z.string().nullable()
});

export const editSessionPublicStateSchema = editSessionStateSchema.omit({
  sourcePath: true
}).extend({
  routes: editSessionPublicRoutesSchema,
  lanes: editSessionPublicLanesSchema,
  sourceMediaUrl: z.string().nullable(),
  sourceMediaKind: editSessionPreviewManifestSourceKindSchema,
  sourceLabel: z.string().nullable(),
  previewArtifactUrl: z.string().nullable(),
  previewArtifactKind: z.enum(["html_composition", "video"]).nullable(),
  previewArtifactContentType: z.string().nullable(),
  previewDiagnostics: z.record(z.string(), z.unknown()).default({})
});

export const editSessionPreviewManifestSchema = z.object({
  schemaVersion: z.literal("hyperframes-preview-manifest/v1"),
  sessionId: z.string(),
  captionProfileId: editTypographyStyleIdSchema,
  motionTier: z.string(),
  lanes: z.object({
    defaultInteractive: editSessionPreviewManifestInteractiveLaneSchema,
    interactive: z.array(editSessionPreviewManifestInteractiveLaneSchema),
    export: z.literal("remotion")
  }),
  routes: z.object({
    status: z.string(),
    preview: z.string(),
    render: z.string(),
    renderStatus: z.string(),
    sourceMedia: z.string().nullable()
  }),
  baseVideo: z.object({
    src: z.string().nullable(),
    sourceKind: editSessionPreviewManifestSourceKindSchema,
    sourceLabel: z.string().nullable(),
    hasVideo: z.boolean(),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    fps: z.number().positive().nullable(),
    durationMs: z.number().nonnegative().nullable()
  }),
  audio: z.object({
    src: z.string().nullable(),
    source: z.enum(["video-element", "separate-audio", "none"])
  }),
  session: editSessionPublicStateSchema,
  overlayPlan: z.object({
    previewText: z.string().nullable(),
    previewLines: z.array(z.string()).default([]),
    previewMotionSequence: z.array(editSessionMotionCueSchema).default([]),
    transcriptWords: z.array(transcribedWordSchema).default([]),
    placeholder: editSessionPlaceholderSchema
  }),
  typography: z.object({
    primaryFont: z.object({
      family: z.string(),
      browserUrl: z.string().optional(),
      sources: z.array(z.object({
        publicPath: z.string(),
        format: z.enum(["ttf", "otf", "woff", "woff2"]),
        weight: z.number().int().positive().optional(),
        style: z.string().optional()
      })).default([])
    }),
    secondaryFont: z.object({
      family: z.string(),
      browserUrl: z.string().optional(),
      sources: z.array(z.object({
        publicPath: z.string(),
        format: z.enum(["ttf", "otf", "woff", "woff2"]),
        weight: z.number().int().positive().optional(),
        style: z.string().optional()
      })).default([])
    }).optional(),
    profile: TypographyProfileV2Schema.optional()
  }).optional(),
  previewArtifactUrl: z.string().nullable().optional(),
  previewArtifactKind: z.enum(["html_composition", "video"]).nullable().optional(),
  previewArtifactContentType: z.string().nullable().optional(),
  diagnostics: z.object({
    jobId: z.string(),
    previewEngine: z.enum(["hyperframes", "remotion"]),
    previewUrl: z.string().nullable(),
    previewArtifactKind: z.enum(["html_composition", "video"]).nullable().optional(),
    previewArtifactContentType: z.string().nullable().optional(),
    manifestVersion: z.string(),
    renderTimeMs: z.number().nonnegative().nullable(),
    compositionGenerationTimeMs: z.number().nonnegative().nullable(),
    fontsUsed: z.array(z.string()),
    fontGraphUsed: z.boolean(),
    customFontsUsed: z.boolean(),
    milvusUsed: z.boolean(),
    retrievedAnimationId: z.string().nullable(),
    animationFamily: z.string().nullable(),
    fallbackUsed: z.boolean(),
    fallbackReasons: z.array(z.string()),
    legacyOverlayUsed: z.boolean(),
    remotionUsed: z.boolean(),
    hyperframesUsed: z.boolean(),
    overlapCheckPassed: z.boolean().nullable(),
    warnings: z.array(z.string()),
    pipelineTrace: z.object({
      jobId: z.string(),
      previewModeRequested: z.string(),
      previewModeActuallyUsed: z.string(),
      renderEngineRequested: z.string(),
      renderEngineActuallyUsed: z.string(),
      oldFallbackTriggered: z.boolean(),
      fallbackReason: z.string().nullable(),
      audioOnlyPathUsed: z.boolean(),
      darkPreviewPathUsed: z.boolean(),
      legacyOverlayUsed: z.boolean(),
      remotionUsed: z.boolean(),
      hyperframesUsed: z.boolean(),
      manifestUsed: z.boolean(),
      textRendererUsed: z.string(),
      fontSelectorUsed: z.string(),
      animationSelectorUsed: z.string(),
      frontendOverlayUsed: z.boolean(),
      backendCompositionUsed: z.boolean(),
      videoElementCount: z.number().int().nonnegative(),
      audioElementCount: z.number().int().nonnegative()
    }).optional()
  }),
  export: z.object({
    remotion: z.object({
      available: z.boolean(),
      renderStatus: editRenderStatusSchema,
      outputUrl: z.string().nullable(),
      outputPath: z.string().nullable()
    })
  })
});

export type EditSessionStatus = z.infer<typeof editSessionStatusSchema>;
export type EditPreviewStatus = z.infer<typeof editPreviewStatusSchema>;
export type EditTranscriptStatus = z.infer<typeof editTranscriptStatusSchema>;
export type EditAnalysisStatus = z.infer<typeof editAnalysisStatusSchema>;
export type EditMotionGraphicsStatus = z.infer<typeof editMotionGraphicsStatusSchema>;
export type EditRenderStatus = z.infer<typeof editRenderStatusSchema>;
export type EditSessionPlaceholder = z.infer<typeof editSessionPlaceholderSchema>;
export type EditSessionMotionCue = z.infer<typeof editSessionMotionCueSchema>;
export type EditSessionPreviewManifestInteractiveLane = z.infer<typeof editSessionPreviewManifestInteractiveLaneSchema>;
export type EditSessionPreviewManifestSourceKind = z.infer<typeof editSessionPreviewManifestSourceKindSchema>;
export type EditSessionPreviewState = z.infer<typeof editSessionPreviewStateSchema>;
export type EditSessionTranscriptState = z.infer<typeof editSessionTranscriptStateSchema>;
export type EditSessionAnalysisState = z.infer<typeof editSessionAnalysisStateSchema>;
export type EditSessionMotionGraphicsState = z.infer<typeof editSessionMotionGraphicsStateSchema>;
export type EditSessionRenderState = z.infer<typeof editSessionRenderStateSchema>;
export type EditSessionLiveActivity = z.infer<typeof editSessionLiveActivitySchema>;
export type EditSessionCreateRequest = z.infer<typeof editSessionCreateRequestSchema>;
export type EditSessionUploadCompleteRequest = z.infer<typeof editSessionUploadCompleteRequestSchema>;
export type EditSessionPreviewStartRequest = z.infer<typeof editSessionPreviewStartRequestSchema>;
export type EditSessionRenderStartRequest = z.infer<typeof editSessionRenderStartRequestSchema>;
export type EditSessionState = z.infer<typeof editSessionStateSchema>;
export type EditSessionPublicState = z.infer<typeof editSessionPublicStateSchema>;
export type EditSessionPreviewManifest = z.infer<typeof editSessionPreviewManifestSchema>;
