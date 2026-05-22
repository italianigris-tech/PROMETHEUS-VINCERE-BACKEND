import {z} from "zod";

import type {CaptionChunk, CaptionStyleProfileId} from "../lib/types";
import {getPresentationPreset} from "../lib/presentation-presets";
import {normalizeCaptionStyleProfileId} from "../lib/stylebooks/caption-style-profiles";
import type {ProjectScopedMotionCompositionProps} from "./ProjectScopedMotionComposition";
export {
  PROJECT_SCOPED_STUDIO_ASSET_BINDING_MESSAGE,
  PROJECT_SCOPED_STUDIO_DEFAULT_SAMPLE_ID,
  PROJECT_SCOPED_STUDIO_SAMPLE_ASSETS,
  PROJECT_SCOPED_STUDIO_SAMPLE_PROP_GUIDANCE,
  PROJECT_SCOPED_STUDIO_VIDEO_SRC_PROP_GUIDANCE,
  getProjectScopedStudioSampleAsset,
  getProjectScopedStudioSampleIds
} from "./project-scoped-studio-assets";
import {
  PROJECT_SCOPED_STUDIO_DEFAULT_SAMPLE_ID,
  PROJECT_SCOPED_STUDIO_SAMPLE_ASSETS
} from "./project-scoped-studio-assets";

const longFormPreset = getPresentationPreset("long-form");
type ProjectScopedStudioSampleId = (typeof PROJECT_SCOPED_STUDIO_SAMPLE_ASSETS)[number]["id"];

const looseObjectSchema = z.object({}).catchall(z.unknown());
const projectScopedStudioSampleIds = PROJECT_SCOPED_STUDIO_SAMPLE_ASSETS.map((asset) => asset.id) as [
  ProjectScopedStudioSampleId,
  ...ProjectScopedStudioSampleId[]
];
const PROJECT_SCOPED_STUDIO_TYPOGRAPHY_SAMPLE_LINES = [
  "PROMETHEUS PREVIEW",
  "TYPOGRAPHY SYSTEM ONLINE",
  "CLIENT DATA ONLY"
] as const;
const captionChunkWordSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  confidence: z.number().optional()
});
const captionChunkSchema = z.object({
  id: z.string(),
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  words: z.array(captionChunkWordSchema),
  styleKey: z.string(),
  motionKey: z.string(),
  layoutVariant: z.string(),
  emphasisWordIndices: z.array(z.number()),
  profileId: z.string().optional(),
  semantic: looseObjectSchema.optional(),
  suppressDefault: z.boolean().optional()
});
const projectScopedLivePreviewSessionSchema = z.object({
  sessionId: z.string(),
  status: z.string(),
  previewStatus: z.string(),
  transcriptStatus: z.string(),
  analysisStatus: z.string(),
  motionGraphicsStatus: z.string(),
  renderStatus: z.string(),
  sourceLabel: z.string().nullable(),
  sourceFilename: z.string().nullable(),
  sourceHasVideo: z.boolean(),
  sourceWidth: z.number().nullable(),
  sourceHeight: z.number().nullable(),
  sourceFps: z.number().nullable(),
  sourceDurationMs: z.number().nullable(),
  previewLines: z.array(z.string()),
  previewMotionSequence: z.array(
    z.object({
      cueId: z.string(),
      text: z.string(),
      startMs: z.number(),
      durationMs: z.number(),
      lineIndex: z.number()
    })
  ),
  transcriptWords: z.array(
    z.object({
      text: z.string(),
      start_ms: z.number(),
      end_ms: z.number(),
      confidence: z.number().optional()
    })
  )
}).catchall(z.unknown());

export const projectScopedStudioPropsSchema = z.object({
  studioSampleId: z.enum(projectScopedStudioSampleIds).optional().describe(
    `Optional curated Studio sample id. Supported samples: ${projectScopedStudioSampleIds.join(", ")}. videoSrc overrides studioSampleId when both are provided.`
  ),
  studioTypographySample: z.boolean().optional().describe(
    "Optional Studio-only caption sample. Adds clean typography preview chunks without using stale demo transcript data."
  ),
  videoSrc: z.string().nullable().optional().describe(
    "Optional explicit video source. When set, this takes precedence over studioSampleId."
  ),
  captionProfileId: z.string().optional(),
  motionTier: z.enum(["auto", "minimal", "editorial", "premium", "hero"]).optional(),
  previewPerformanceMode: z.enum(["full", "balanced", "turbo"]).optional(),
  debugMotionArtifacts: z.boolean().optional().describe(
    "Keep false unless you are intentionally testing demo overlays or motion artifact diagnostics."
  ),
  captionChunksOverride: z.array(captionChunkSchema).optional(),
  motionModelOverride: looseObjectSchema.nullable().optional(),
  livePreviewSession: projectScopedLivePreviewSessionSchema.nullable().optional(),
  videoMetadata: z.object({
    width: z.number(),
    height: z.number(),
    fps: z.number(),
    durationSeconds: z.number(),
    durationInFrames: z.number()
  }).optional(),
  presentationMode: z.enum(["auto", "reel", "long-form"]).optional(),
  gradeProfileId: z.enum(["auto", "neutral", "warm-cinematic", "premium-contrast", "cool-editorial"]).optional(),
  transitionPresetId: z.string().optional(),
  transitionOverlayMode: z.enum(["off", "standard", "fast-intro"]).optional(),
  transitionOverlayConfig: looseObjectSchema.optional(),
  motion3DMode: z.enum(["off", "editorial", "showcase"]).optional(),
  matteMode: z.enum(["off", "auto", "prefer-matte"]).optional(),
  captionBias: z.enum(["auto", "top", "middle", "bottom"]).optional(),
  hideCaptionOverlays: z.boolean().optional(),
  pipMode: z.enum(["off", "showcase"]).optional(),
  pipLayoutPreset: z.enum([
    "pip-left-content-right",
    "pip-right-content-left",
    "pip-small-corner-large-text",
    "pip-floating-multi-ui"
  ]).optional(),
  pipHeadlineText: z.string().optional(),
  pipSubtextText: z.string().optional(),
  stabilizePreviewTimeline: z.boolean().optional(),
  previewTimelineResetVersion: z.number().optional(),
  respectPreviewPerformanceModeDuringRender: z.boolean().optional(),
  usePreviewProxyForVideoSrc: z.boolean().optional()
}).catchall(z.unknown());
export type ProjectScopedStudioProps = z.input<typeof projectScopedStudioPropsSchema> &
  ProjectScopedMotionCompositionProps;

const buildSampleWordTimings = ({
  words,
  startMs,
  durationMs
}: {
  words: string[];
  startMs: number;
  durationMs: number;
}) => {
  const sliceMs = Math.max(120, Math.round(durationMs / Math.max(1, words.length)));

  return words.map((text, index) => {
    const wordStartMs = startMs + index * sliceMs;
    const nextWordStartMs = startMs + (index + 1) * sliceMs;

    return {
      text,
      startMs: wordStartMs,
      endMs: index === words.length - 1 ? startMs + durationMs : Math.min(startMs + durationMs, nextWordStartMs)
    };
  });
};

export const buildProjectScopedStudioTypographySampleCaptionChunks = (
  captionProfileId: CaptionStyleProfileId | undefined
): CaptionChunk[] => {
  const resolvedCaptionProfileId = normalizeCaptionStyleProfileId(
    captionProfileId ?? longFormPreset.captionProfileId
  );

  return PROJECT_SCOPED_STUDIO_TYPOGRAPHY_SAMPLE_LINES.map((line, index) => {
    const words = line.split(/\s+/).filter(Boolean);
    const startMs = index * 1200;
    const durationMs = 980;

    return {
      id: `studio-typography-sample-${index + 1}`,
      text: line,
      startMs,
      endMs: startMs + durationMs,
      words: buildSampleWordTimings({
        words,
        startMs,
        durationMs
      }),
      styleKey: "studio-typography-sample",
      motionKey: "studio-typography-sample-rise",
      layoutVariant: "inline",
      emphasisWordIndices: index === 1 ? [0, 2] : [0],
      profileId: resolvedCaptionProfileId
    };
  });
};

export const PROJECT_SCOPED_STUDIO_TYPOGRAPHY_SAMPLE_PROP_GUIDANCE = `{
  "studioSampleId": "${PROJECT_SCOPED_STUDIO_DEFAULT_SAMPLE_ID}",
  "studioTypographySample": true,
  "captionProfileId": "longform_svg_typography_v1",
  "motionTier": "premium"
}`;

export const buildProjectScopedStudioSampleProps = (
  sampleId: ProjectScopedStudioSampleId = PROJECT_SCOPED_STUDIO_DEFAULT_SAMPLE_ID,
  captionProfileId?: CaptionStyleProfileId | undefined
): ProjectScopedStudioProps => {
  return {
    ...buildProjectScopedStudioDefaultProps(captionProfileId),
    studioSampleId: sampleId
  };
};

export const buildProjectScopedStudioTypographySampleProps = (
  sampleId: ProjectScopedStudioSampleId = PROJECT_SCOPED_STUDIO_DEFAULT_SAMPLE_ID,
  captionProfileId?: CaptionStyleProfileId | undefined
): ProjectScopedStudioProps => {
  return {
    ...buildProjectScopedStudioDefaultProps(captionProfileId),
    studioSampleId: sampleId,
    studioTypographySample: true
  };
};

export const buildProjectScopedStudioDefaultProps = (
  captionProfileId: CaptionStyleProfileId | undefined
): ProjectScopedStudioProps => {
  const resolvedCaptionProfileId = normalizeCaptionStyleProfileId(
    captionProfileId ?? longFormPreset.captionProfileId
  );

  return {
    // Studio intentionally starts without a default video asset. Provide either
    // PROJECT_SCOPED_STUDIO_VIDEO_SRC_PROP_GUIDANCE or PROJECT_SCOPED_STUDIO_SAMPLE_PROP_GUIDANCE in Studio props.
    videoSrc: null,
    videoMetadata: longFormPreset.videoMetadata,
    presentationMode: longFormPreset.presentationMode,
    captionChunksOverride: [],
    motionModelOverride: null,
    captionProfileId: resolvedCaptionProfileId,
    motionTier: "premium",
    previewPerformanceMode: "balanced",
    stabilizePreviewTimeline: true,
    debugMotionArtifacts: false,
    livePreviewSession: null
  };
};
