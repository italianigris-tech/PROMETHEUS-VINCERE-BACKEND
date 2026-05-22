import {z} from "zod";

export const sfxEventTypeSchema = z.enum([
  "clock_tick",
  "timer_beep",
  "cash_chime",
  "click",
  "low_hit",
  "tension_riser",
  "cinematic_impact",
  "whoosh",
  "sweep",
  "glitch",
  "resolve_hit",
  "drone",
  "none"
]);

export type SfxEventType = z.infer<typeof sfxEventTypeSchema>;

export const sfxEventSchema = z.object({
  id: z.string().trim().min(1),
  type: sfxEventTypeSchema,
  assetId: z.string().trim().min(1),
  videoStartSec: z.number().nonnegative(),
  videoEndSec: z.number().nonnegative(),
  intensity: z.number().min(0).max(1),
  reason: z.string().trim().min(1),
  triggerText: z.string().trim().default(""),
  mixRole: z.string().trim().min(1),
  volumeDb: z.number(),
  durationSec: z.number().nonnegative()
}).refine((value) => value.videoEndSec >= value.videoStartSec, {
  message: "SFX event videoEndSec must be greater than or equal to videoStartSec."
});

export type SfxEvent = z.infer<typeof sfxEventSchema>;
