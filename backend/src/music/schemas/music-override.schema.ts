import {z} from "zod";

export const musicOverrideTargetTypeSchema = z.enum([
  "preview",
  "timeline_segment",
  "music_event",
  "sfx_event"
]);
export type MusicOverrideTargetType = z.infer<typeof musicOverrideTargetTypeSchema>;

export const musicOverrideActionSchema = z.enum([
  "replace_track",
  "remove_sfx",
  "lower_intensity",
  "increase_intensity",
  "mute_music",
  "use_catalog_track"
]);
export type MusicOverrideAction = z.infer<typeof musicOverrideActionSchema>;

export const musicOverrideSchema = z.object({
  id: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  targetType: musicOverrideTargetTypeSchema,
  targetId: z.string().trim().min(1).nullable().default(null),
  startSec: z.number().nonnegative().nullable().default(null),
  endSec: z.number().nonnegative().nullable().default(null),
  trackId: z.string().trim().min(1).nullable().default(null),
  action: musicOverrideActionSchema,
  reason: z.string().trim().nullable().default(null),
  createdAt: z.string().trim().min(1)
}).refine((value) => value.endSec === null || value.startSec === null || value.endSec > value.startSec, {
  message: "Override endSec must be greater than startSec when both are present."
});
export type MusicOverride = z.infer<typeof musicOverrideSchema>;

export const musicOverrideRequestSchema = z.object({
  targetType: musicOverrideTargetTypeSchema,
  targetId: z.string().trim().min(1).optional(),
  startSec: z.number().nonnegative().optional(),
  endSec: z.number().nonnegative().optional(),
  trackId: z.string().trim().min(1).optional(),
  action: musicOverrideActionSchema,
  reason: z.string().trim().optional(),
  rebuildPlan: z.boolean().default(true)
}).refine((value) => value.endSec === undefined || value.startSec === undefined || value.endSec > value.startSec, {
  message: "Override endSec must be greater than startSec when both are present."
});
export type MusicOverrideRequest = z.infer<typeof musicOverrideRequestSchema>;

export const musicOverridesArtifactSchema = z.object({
  artifactType: z.literal("video_aware_music_overrides"),
  jobId: z.string().trim().min(1),
  overrides: z.array(musicOverrideSchema).default([]),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1)
});
export type MusicOverridesArtifact = z.infer<typeof musicOverridesArtifactSchema>;
