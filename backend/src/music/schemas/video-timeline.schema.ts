import {z} from "zod";

import {sfxEventTypeSchema} from "./sfx-event.schema";

export const videoTimelineSegmentRoleSchema = z.enum([
  "hook",
  "setup",
  "problem",
  "explanation",
  "proof",
  "reveal",
  "transition",
  "emotional_reset",
  "cta",
  "outro",
  "unknown"
]);

export type VideoTimelineSegmentRole = z.infer<typeof videoTimelineSegmentRoleSchema>;

export const videoTimelineSegmentSchema = z.object({
  id: z.string().trim().min(1),
  startSec: z.number().nonnegative(),
  endSec: z.number().nonnegative(),
  role: videoTimelineSegmentRoleSchema,
  text: z.string().default(""),
  energy: z.number().min(0).max(1),
  valence: z.number().min(0).max(1),
  arousal: z.number().min(0).max(1),
  tension: z.number().min(0).max(1),
  prestige: z.number().min(0).max(1),
  urgency: z.number().min(0).max(1),
  clarity: z.number().min(0).max(1),
  speechDensity: z.number().min(0).max(1),
  hookStrength: z.number().min(0).max(1),
  proofStrength: z.number().min(0).max(1),
  ctaStrength: z.number().min(0).max(1),
  source: z.string().trim().min(1)
}).refine((value) => value.endSec > value.startSec, {
  message: "Video timeline segment endSec must be greater than startSec."
});

export type VideoTimelineSegment = z.infer<typeof videoTimelineSegmentSchema>;

export const captionSyncEventSchema = z.object({
  id: z.string().trim().min(1),
  videoTimeSec: z.number().nonnegative(),
  captionText: z.string().default(""),
  eventType: z.string().trim().min(1),
  suggestedSfxType: sfxEventTypeSchema.nullable().default(null),
  intensity: z.number().min(0).max(1)
});

export type CaptionSyncEvent = z.infer<typeof captionSyncEventSchema>;
