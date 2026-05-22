import {z} from "zod";

export const musicPreviewUrlModeSchema = z.enum(["public_url", "signed_url", "object_key_only"]);
export type MusicPreviewUrlMode = z.infer<typeof musicPreviewUrlModeSchema>;

export const musicLicenseSummarySchema = z.object({
  licenseType: z.string(),
  commercialAllowed: z.boolean(),
  attributionRequired: z.boolean(),
  licenseVerified: z.boolean()
});
export type MusicLicenseSummary = z.infer<typeof musicLicenseSummarySchema>;

export const musicCatalogTrackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().nullable().optional(),
  category: z.string().min(1),
  genreTags: z.array(z.string()).default([]),
  moodTags: z.array(z.string()).default([]),
  useCaseTags: z.array(z.string()).default([]),
  avoidWhen: z.array(z.string()).default([]),
  previewAllowed: z.boolean(),
  renderAllowed: z.boolean(),
  analysisStatus: z.string(),
  durationSec: z.number().nonnegative().nullable().optional(),
  audioPreviewUrl: z.string().optional(),
  audioObjectKey: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  thumbnailObjectKey: z.string().optional(),
  urlMode: musicPreviewUrlModeSchema.optional(),
  playableInBrowser: z.boolean().optional(),
  licenseSummary: musicLicenseSummarySchema
}).passthrough();
export type MusicCatalogTrack = z.infer<typeof musicCatalogTrackSchema>;

export const musicCatalogListResponseSchema = z.object({
  tracks: z.array(musicCatalogTrackSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  urlMode: musicPreviewUrlModeSchema.optional(),
  categories: z.array(z.string()).default([])
}).passthrough();
export type MusicCatalogListResponse = z.infer<typeof musicCatalogListResponseSchema>;

export const musicPreviewUrlResponseSchema = z.object({
  trackId: z.string().min(1),
  encodedTrackId: z.string().optional(),
  urlMode: musicPreviewUrlModeSchema,
  playableInBrowser: z.boolean(),
  audioPreviewUrl: z.string().optional(),
  audioObjectKey: z.string().optional(),
  expiresAt: z.string().optional(),
  ttlSeconds: z.number().int().positive().optional(),
  reason: z.string().optional()
}).passthrough();
export type MusicPreviewUrlResponse = z.infer<typeof musicPreviewUrlResponseSchema>;

export const musicCatalogQueryParamsSchema = z.object({
  category: z.string().trim().min(1).optional(),
  genre: z.string().trim().min(1).optional(),
  useCase: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
  includeUnsafe: z.boolean().optional()
});
export type MusicCatalogQueryParams = z.infer<typeof musicCatalogQueryParamsSchema>;

export const videoAwareMusicEventSummarySchema = z.object({
  id: z.string().min(1),
  trackId: z.string().min(1),
  encodedTrackId: z.string().optional(),
  title: z.string().optional(),
  artist: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  videoStartSec: z.number().nonnegative(),
  videoEndSec: z.number().nonnegative(),
  trackStartSec: z.number().nonnegative().optional(),
  trackEndSec: z.number().nonnegative().optional(),
  purpose: z.string().optional(),
  sectionRole: z.string().nullable().optional(),
  duckingEnabled: z.boolean().optional(),
  volumeDb: z.number().optional(),
  storagePath: z.string().nullable().optional(),
  sourceObjectKey: z.string().nullable().optional(),
  previewOnly: z.boolean().default(true),
  renderSafe: z.boolean().default(false),
  warning: z.string().nullable().optional(),
  licenseSummary: musicLicenseSummarySchema.nullable().optional()
}).passthrough();
export type VideoAwareMusicEventSummary = z.infer<typeof videoAwareMusicEventSummarySchema>;

export const videoAwareSfxEventSummarySchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  type: z.string().min(1),
  videoStartSec: z.number().nonnegative(),
  videoEndSec: z.number().nonnegative(),
  intensity: z.number().min(0).max(1).optional(),
  reason: z.string().optional(),
  triggerText: z.string().optional(),
  mixRole: z.string().optional(),
  durationSec: z.number().nonnegative().optional(),
  volumeDb: z.number().optional()
}).passthrough();
export type VideoAwareSfxEventSummary = z.infer<typeof videoAwareSfxEventSummarySchema>;

export const videoAwareRenderSettingsSchema = z.object({
  notes: z.array(z.string()).default([])
}).passthrough();
export type VideoAwareRenderSettings = z.infer<typeof videoAwareRenderSettingsSchema>;

export const videoAwareAudioPlanSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  planMode: z.enum(["dry_run", "render_ready"]),
  status: z.string(),
  videoDurationSec: z.number().positive(),
  previewStartSec: z.number().nonnegative().nullable().optional(),
  previewEndSec: z.number().nonnegative().nullable().optional(),
  musicEvents: z.array(videoAwareMusicEventSummarySchema).default([]),
  sfxEvents: z.array(videoAwareSfxEventSummarySchema).default([]),
  renderSettings: videoAwareRenderSettingsSchema.optional()
}).passthrough();
export type VideoAwareAudioPlan = z.infer<typeof videoAwareAudioPlanSchema>;

export const videoAwareSoundManifestSummarySchema = z.object({
  sourcePlanId: z.string().min(1),
  planMode: z.enum(["dry_run", "render_ready"]),
  durationSec: z.number().nonnegative(),
  musicCueCount: z.number().int().nonnegative(),
  sfxCueCount: z.number().int().nonnegative(),
  dialogueOrDuckingHintCount: z.number().int().nonnegative(),
  placeholderCueIds: z.array(z.string()).default([]),
  unresolvedTrackIds: z.array(z.string()).default([]),
  unverifiedTrackIds: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([])
}).passthrough();
export type VideoAwareSoundManifestSummary = z.infer<typeof videoAwareSoundManifestSummarySchema>;

export const musicPreflightIssueSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(["info", "warning", "error"]),
  code: z.string().min(1),
  message: z.string().min(1),
  path: z.string().optional(),
  eventId: z.string().optional(),
  trackId: z.string().optional(),
  assetId: z.string().optional(),
  suggestion: z.string().optional()
}).passthrough();
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
  jobId: z.string().min(1),
  sourceAudioPlanId: z.string().min(1),
  sourceSoundManifestArtifactPath: z.string().min(1),
  status: z.enum(["pass", "warn", "block"]),
  canRender: z.boolean(),
  planMode: z.enum(["dry_run", "render_ready"]),
  checkedAt: z.string().min(1),
  summary: musicPreflightSummarySchema,
  issues: z.array(musicPreflightIssueSchema).default([]),
  warnings: z.array(z.string()).default([]),
  nextActions: z.array(z.string()).default([])
}).passthrough();
export type MusicPreflightReport = z.infer<typeof musicPreflightReportSchema>;

export const videoAwarePreviewMixStateSchema = z.object({
  status: z.enum(["rendered", "missing", "blocked", "skipped"]),
  artifactPath: z.string().nullable().optional()
}).passthrough();
export type VideoAwarePreviewMixState = z.infer<typeof videoAwarePreviewMixStateSchema>;

export const videoAwareMusicStateSchema = z.object({
  jobId: z.string().min(1),
  hasAudioPlan: z.boolean(),
  hasSoundManifest: z.boolean(),
  hasPreflight: z.boolean(),
  audioPlan: videoAwareAudioPlanSchema.optional(),
  soundManifestSummary: videoAwareSoundManifestSummarySchema.optional(),
  preflight: musicPreflightReportSchema.optional(),
  selectedTracks: z.array(videoAwareMusicEventSummarySchema).default([]),
  musicEvents: z.array(videoAwareMusicEventSummarySchema).default([]),
  sfxEvents: z.array(videoAwareSfxEventSummarySchema).default([]),
  warnings: z.array(z.string()).default([]),
  previewMix: videoAwarePreviewMixStateSchema.optional(),
  renderAllowed: z.boolean(),
  canRenderMusic: z.boolean(),
  reason: z.string().min(1)
}).passthrough();
export type VideoAwareMusicState = z.infer<typeof videoAwareMusicStateSchema>;

export const musicRehearsalRequestSchema = z.object({
  useCatalogCandidates: z.boolean().default(true),
  previewStartSec: z.number().nonnegative().optional(),
  previewEndSec: z.number().nonnegative().optional(),
  overwrite: z.boolean().default(true),
  strict: z.boolean().default(false)
});
export type MusicRehearsalRequest = z.infer<typeof musicRehearsalRequestSchema>;

export const musicRehearsalResponseSchema = z.object({
  jobId: z.string().min(1),
  audioPlanArtifactPath: z.string().min(1),
  soundManifestArtifactPath: z.string().min(1),
  timelineSegmentCount: z.number().int().nonnegative(),
  musicEventCount: z.number().int().nonnegative(),
  sfxEventCount: z.number().int().nonnegative(),
  transitionEventCount: z.number().int().nonnegative(),
  duckingRegionCount: z.number().int().nonnegative(),
  manifestDuration: z.number().nonnegative(),
  warnings: z.array(z.string()).default([]),
  planMode: z.enum(["dry_run", "render_ready"]),
  createdAt: z.string().min(1),
  dryRunOnly: z.boolean().optional(),
  audioRenderPlanTouched: z.boolean().optional(),
  reason: z.string().optional()
}).passthrough();
export type MusicRehearsalResponse = z.infer<typeof musicRehearsalResponseSchema>;

export const musicPreflightRequestSchema = z.object({
  strict: z.boolean().default(false),
  requireRenderReady: z.boolean().default(false)
});
export type MusicPreflightRequest = z.infer<typeof musicPreflightRequestSchema>;

export const musicOverrideRequestSchema = z.object({
  targetType: z.enum(["preview", "timeline_segment", "music_event", "sfx_event"]),
  targetId: z.string().trim().min(1).optional(),
  startSec: z.number().nonnegative().optional(),
  endSec: z.number().nonnegative().optional(),
  trackId: z.string().trim().min(1).optional(),
  action: z.enum([
    "replace_track",
    "remove_sfx",
    "lower_intensity",
    "increase_intensity",
    "mute_music",
    "use_catalog_track"
  ]),
  reason: z.string().trim().optional(),
  rebuildPlan: z.boolean().default(true)
}).refine((value) => value.endSec === undefined || value.startSec === undefined || value.endSec > value.startSec, {
  message: "Override endSec must be greater than startSec when both are present."
});
export type MusicOverrideRequest = z.infer<typeof musicOverrideRequestSchema>;

export const musicOverrideResponseSchema = z.object({
  override: z.object({
    id: z.string().min(1),
    jobId: z.string().min(1),
    targetType: z.string().min(1),
    targetId: z.string().nullable().optional(),
    startSec: z.number().nullable().optional(),
    endSec: z.number().nullable().optional(),
    trackId: z.string().nullable().optional(),
    action: z.string().min(1),
    reason: z.string().nullable().optional(),
    createdAt: z.string().min(1)
  }).passthrough(),
  updatedAudioPlanSummary: z.object({
    jobId: z.string().min(1),
    planId: z.string().min(1),
    planMode: z.enum(["dry_run", "render_ready"]),
    musicEventCount: z.number().int().nonnegative(),
    selectedTracks: z.array(videoAwareMusicEventSummarySchema).default([]),
    warnings: z.array(z.string()).default([])
  }).nullable().optional(),
  preflightStatus: z.enum(["pass", "warn", "block"]).nullable().optional(),
  warnings: z.array(z.string()).default([]),
  renderAllowed: z.boolean().optional(),
  canRenderMusic: z.boolean().optional(),
  reason: z.string().optional()
}).passthrough();
export type MusicOverrideResponse = z.infer<typeof musicOverrideResponseSchema>;
