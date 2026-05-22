import {z} from "zod";

import {videoAwareAudioPlanModeSchema} from "./audio-plan.schema";

export const musicPreflightStatusSchema = z.enum(["pass", "warn", "block"]);
export type MusicPreflightStatus = z.infer<typeof musicPreflightStatusSchema>;

export const musicPreflightIssueSchema = z.object({
  id: z.string().trim().min(1),
  severity: z.enum(["info", "warning", "error"]),
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  path: z.string().trim().optional(),
  eventId: z.string().trim().optional(),
  trackId: z.string().trim().optional(),
  assetId: z.string().trim().optional(),
  suggestion: z.string().trim().optional()
});
export type MusicPreflightIssue = z.infer<typeof musicPreflightIssueSchema>;

export const musicPreflightSummarySchema = z.object({
  musicEventCount: z.number().int().nonnegative(),
  sfxEventCount: z.number().int().nonnegative(),
  transitionEventCount: z.number().int().nonnegative(),
  placeholderMusicCount: z.number().int().nonnegative(),
  unverifiedTrackCount: z.number().int().nonnegative(),
  missingFileCount: z.number().int().nonnegative(),
  timingIssueCount: z.number().int().nonnegative(),
  licenseIssueCount: z.number().int().nonnegative()
});
export type MusicPreflightSummary = z.infer<typeof musicPreflightSummarySchema>;

export const musicPreflightReportSchema = z.object({
  artifactType: z.literal("video_aware_music_preflight"),
  jobId: z.string().trim().min(1),
  sourceAudioPlanId: z.string().trim().min(1),
  sourceSoundManifestArtifactPath: z.string().trim().min(1),
  status: musicPreflightStatusSchema,
  canRender: z.boolean(),
  planMode: videoAwareAudioPlanModeSchema,
  checkedAt: z.string().trim().min(1),
  summary: musicPreflightSummarySchema,
  issues: z.array(musicPreflightIssueSchema).default([]),
  warnings: z.array(z.string().trim().min(1)).default([]),
  nextActions: z.array(z.string().trim().min(1)).default([])
});
export type MusicPreflightReport = z.infer<typeof musicPreflightReportSchema>;
