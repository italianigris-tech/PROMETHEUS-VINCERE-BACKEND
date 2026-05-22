import {z} from "zod";

import {musicTrackSectionRoleSchema} from "./music-track.schema";
import {sfxEventSchema} from "./sfx-event.schema";
import {captionSyncEventSchema, videoTimelineSegmentSchema} from "./video-timeline.schema";

export const musicEventSchema = z.object({
  id: z.string().trim().min(1),
  trackId: z.string().trim().min(1),
  videoStartSec: z.number().nonnegative(),
  videoEndSec: z.number().nonnegative(),
  trackStartSec: z.number().nonnegative(),
  trackEndSec: z.number().nonnegative(),
  sectionRole: musicTrackSectionRoleSchema.nullable().default(null),
  purpose: z.string().trim().min(1),
  storagePath: z.string().trim().nullable().default(null),
  sourceObjectKey: z.string().trim().nullable().default(null),
  previewOnly: z.boolean().default(false),
  renderSafe: z.boolean().default(false),
  warning: z.string().trim().nullable().default(null),
  volumeDb: z.number(),
  fadeInSec: z.number().nonnegative(),
  fadeOutSec: z.number().nonnegative(),
  duckingEnabled: z.boolean(),
  beatAligned: z.boolean(),
  transitionInId: z.string().trim().nullable().default(null),
  transitionOutId: z.string().trim().nullable().default(null)
}).refine((value) => value.videoEndSec > value.videoStartSec, {
  message: "Music event videoEndSec must be greater than videoStartSec."
}).refine((value) => value.trackEndSec > value.trackStartSec, {
  message: "Music event trackEndSec must be greater than trackStartSec."
});

export type MusicEvent = z.infer<typeof musicEventSchema>;

export const transitionEventTypeSchema = z.enum([
  "beat_crossfade",
  "lowpass_sweep",
  "highpass_sweep",
  "riser_into_impact",
  "drone_bridge",
  "silence_drop",
  "hard_cut",
  "procedural_bridge",
  "none"
]);

export type TransitionEventType = z.infer<typeof transitionEventTypeSchema>;

export const transitionEventSchema = z.object({
  id: z.string().trim().min(1),
  type: transitionEventTypeSchema,
  videoStartSec: z.number().nonnegative(),
  videoEndSec: z.number().nonnegative(),
  fromTrackId: z.string().trim().nullable().default(null),
  toTrackId: z.string().trim().nullable().default(null),
  intensity: z.number().min(0).max(1),
  beatAligned: z.boolean(),
  downbeatTargetSec: z.number().nonnegative().nullable().default(null),
  settings: z.record(z.string(), z.unknown()).default({})
}).refine((value) => value.videoEndSec >= value.videoStartSec, {
  message: "Transition event videoEndSec must be greater than or equal to videoStartSec."
});

export type TransitionEvent = z.infer<typeof transitionEventSchema>;

export const duckingRegionSchema = z.object({
  id: z.string().trim().min(1),
  videoStartSec: z.number().nonnegative(),
  videoEndSec: z.number().nonnegative(),
  reason: z.string().trim().min(1),
  targetMusicDb: z.number(),
  speechPriority: z.number().min(0).max(1)
}).refine((value) => value.videoEndSec > value.videoStartSec, {
  message: "Ducking region videoEndSec must be greater than videoStartSec."
});

export type DuckingRegion = z.infer<typeof duckingRegionSchema>;

export const creativeDirectionSchema = z.object({
  summary: z.string().default(""),
  moodTags: z.array(z.string().trim().min(1)).default([]),
  pacing: z.string().default(""),
  emphasisMoments: z.array(z.string().trim().min(1)).default([]),
  constraints: z.array(z.string().trim().min(1)).default([])
}).passthrough();

export type CreativeDirection = z.infer<typeof creativeDirectionSchema>;

export const videoAwareRenderSettingsSchema = z.object({
  targetIntegratedLufs: z.number().min(-30).max(-6).default(-16),
  targetTruePeakDbtp: z.number().min(-6).max(0).default(-1.5),
  targetLra: z.number().min(0).max(20).default(11),
  sampleRate: z.number().int().positive().default(48000),
  previewSampleRate: z.number().int().positive().default(22050),
  preserveDialogueIntelligibility: z.boolean().default(true),
  notes: z.array(z.string().trim().min(1)).default([])
}).passthrough();

export type VideoAwareRenderSettings = z.infer<typeof videoAwareRenderSettingsSchema>;

export const videoAwareAudioPlanStatusSchema = z.enum([
  "draft",
  "planned",
  "rendering",
  "rendered",
  "attached_to_preview",
  "failed"
]);

export type VideoAwareAudioPlanStatus = z.infer<typeof videoAwareAudioPlanStatusSchema>;

export const videoAwareAudioPlanModeSchema = z.enum(["dry_run", "render_ready"]);
export type VideoAwareAudioPlanMode = z.infer<typeof videoAwareAudioPlanModeSchema>;

export const videoAwareAudioPlanSchema = z.object({
  id: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  projectId: z.string().trim().nullable().default(null),
  userId: z.string().trim().nullable().default(null),
  sourceVideoId: z.string().trim().nullable().default(null),
  transcriptId: z.string().trim().nullable().default(null),
  videoDurationSec: z.number().positive(),
  previewStartSec: z.number().nonnegative().nullable().default(null),
  previewEndSec: z.number().nonnegative().nullable().default(null),
  creativeDirection: creativeDirectionSchema.default(() => ({
    summary: "",
    moodTags: [],
    pacing: "",
    emphasisMoments: [],
    constraints: []
  })),
  timelineSegments: z.array(videoTimelineSegmentSchema).default([]),
  musicEvents: z.array(musicEventSchema).default([]),
  transitionEvents: z.array(transitionEventSchema).default([]),
  sfxEvents: z.array(sfxEventSchema).default([]),
  duckingRegions: z.array(duckingRegionSchema).default([]),
  captionSyncEvents: z.array(captionSyncEventSchema).default([]),
  renderSettings: videoAwareRenderSettingsSchema.default(() => ({
    targetIntegratedLufs: -16,
    targetTruePeakDbtp: -1.5,
    targetLra: 11,
    sampleRate: 48000,
    previewSampleRate: 22050,
    preserveDialogueIntelligibility: true,
    notes: []
  })),
  outputAudioPath: z.string().trim().nullable().default(null),
  outputVideoPath: z.string().trim().nullable().default(null),
  planMode: videoAwareAudioPlanModeSchema.default("dry_run"),
  status: videoAwareAudioPlanStatusSchema,
  errorMessage: z.string().trim().nullable().default(null),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1)
}).refine(
  (value) =>
    value.previewStartSec === null ||
    value.previewEndSec === null ||
    value.previewEndSec > value.previewStartSec,
  {
    message: "Preview end must be greater than preview start when both are present."
  }
);

export type VideoAwareAudioPlan = z.infer<typeof videoAwareAudioPlanSchema>;
