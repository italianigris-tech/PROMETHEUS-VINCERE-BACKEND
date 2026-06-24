import {z} from "zod";

export const beatGridSchema = z.object({
  bpm: z.number().positive(),
  beatTimesSec: z.array(z.number().nonnegative()).default([]),
  downbeatTimesSec: z.array(z.number().nonnegative()).default([]),
  confidence: z.number().min(0).max(1),
  source: z.string().trim().min(1)
});

export type BeatGrid = z.infer<typeof beatGridSchema>;

export const musicTrackSectionRoleSchema = z.enum([
  "intro",
  "verse",
  "pre_chorus",
  "chorus",
  "bridge",
  "drop",
  "breakdown",
  "outro",
  "ambient",
  "transition",
  "unknown"
]);

export type MusicTrackSectionRole = z.infer<typeof musicTrackSectionRoleSchema>;

export const musicTrackSectionSchema = z.object({
  id: z.string().trim().min(1),
  trackId: z.string().trim().min(1),
  startSec: z.number().nonnegative(),
  endSec: z.number().nonnegative(),
  role: musicTrackSectionRoleSchema,
  energy: z.number().min(0).max(1),
  density: z.number().min(0).max(1),
  tension: z.number().min(0).max(1),
  bestFor: z.array(z.string().trim().min(1)).default([]),
  avoidWhen: z.array(z.string().trim().min(1)).default([]),
  transitionInSuitability: z.number().min(0).max(1),
  transitionOutSuitability: z.number().min(0).max(1)
}).refine((value) => value.endSec > value.startSec, {
  message: "Music track section endSec must be greater than startSec."
});

export type MusicTrackSection = z.infer<typeof musicTrackSectionSchema>;

export const waveformSummarySchema = z.object({
  windowSec: z.number().positive().default(1),
  peakAmplitudes: z.array(z.number().min(0).max(1)).default([]),
  rmsAmplitudes: z.array(z.number().min(0).max(1)).default([]),
  source: z.string().trim().min(1).default("ffmpeg_fallback")
});

export type WaveformSummary = z.infer<typeof waveformSummarySchema>;

export const musicTrackAnalysisStatusSchema = z.enum([
  "pending",
  "indexed",
  "analyzing",
  "analyzed",
  "failed"
]);

export type MusicTrackAnalysisStatus = z.infer<typeof musicTrackAnalysisStatusSchema>;

export const musicTrackSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  artist: z.string().trim().min(1),
  source: z.string().trim().min(1),
  sourceUrl: z.string().trim().nullable().default(null),
  storagePath: z.string().trim().nullable().default(null),
  licenseType: z.string().trim().min(1),
  commercialAllowed: z.boolean(),
  attributionRequired: z.boolean(),
  licenseVerified: z.boolean(),
  durationSec: z.number().positive(),
  bpm: z.number().positive().nullable().default(null),
  musicalKey: z.string().trim().nullable().default(null),
  energy: z.number().min(0).max(1),
  valence: z.number().min(0).max(1),
  arousal: z.number().min(0).max(1),
  tension: z.number().min(0).max(1),
  prestige: z.number().min(0).max(1),
  urgency: z.number().min(0).max(1),
  clarity: z.number().min(0).max(1),
  speechFriendliness: z.number().min(0).max(1),
  genreTags: z.array(z.string().trim().min(1)).default([]),
  moodTags: z.array(z.string().trim().min(1)).default([]),
  instrumentTags: z.array(z.string().trim().min(1)).default([]),
  useCaseTags: z.array(z.string().trim().min(1)).default([]),
  avoidWhen: z.array(z.string().trim().min(1)).default([]),
  beatGrid: beatGridSchema.nullable().default(null),
  sections: z.array(musicTrackSectionSchema).default([]),
  waveformSummary: waveformSummarySchema.nullable().default(null),
  loudnessLufs: z.number().nullable().default(null),
  analysisStatus: musicTrackAnalysisStatusSchema,
  createdAt: z.string().trim().min(1),
  analyzedAt: z.string().trim().nullable().default(null)
});

export type MusicTrack = z.infer<typeof musicTrackSchema>;
