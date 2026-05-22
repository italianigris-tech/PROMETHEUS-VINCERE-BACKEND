export {
  beatGridSchema,
  musicTrackAnalysisStatusSchema,
  musicTrackSchema,
  musicTrackSectionRoleSchema,
  musicTrackSectionSchema,
  waveformSummarySchema
} from "./schemas/music-track.schema";
export {
  sfxEventSchema,
  sfxEventTypeSchema
} from "./schemas/sfx-event.schema";
export {
  musicPreflightIssueSchema,
  musicPreflightReportSchema,
  musicPreflightStatusSchema,
  musicPreflightSummarySchema
} from "./schemas/music-preflight.schema";
export {
  captionSyncEventSchema,
  videoTimelineSegmentRoleSchema,
  videoTimelineSegmentSchema
} from "./schemas/video-timeline.schema";
export {
  creativeDirectionSchema,
  duckingRegionSchema,
  musicEventSchema,
  transitionEventSchema,
  transitionEventTypeSchema,
  videoAwareAudioPlanSchema,
  videoAwareAudioPlanStatusSchema,
  videoAwareRenderSettingsSchema
} from "./schemas/audio-plan.schema";
export {
  musicOverrideActionSchema,
  musicOverrideRequestSchema,
  musicOverrideSchema,
  musicOverrideTargetTypeSchema,
  musicOverridesArtifactSchema
} from "./schemas/music-override.schema";
export {buildBeatGrid} from "./analyzer/beat-grid-builder";
export {detectSections} from "./analyzer/section-detector";
export {analyzeTrack} from "./analyzer/track-analyzer";
export {indexTrack} from "./indexer/track-indexer";
export {assertTrackUsableForExport} from "./indexer/license-guard";
export {
  catalogImportManifestSchema,
  catalogImportTrackMetadataSchema
} from "./indexer/catalog-import.schema";
export {normalizeCatalogImportManifest} from "./indexer/catalog-importer";
export {
  r2MusicCatalogEntrySchema,
  r2MusicCatalogSchema,
  r2StorageProviderSchema
} from "./catalog/r2-music-catalog.schema";
export {normalizeR2MusicCatalog} from "./catalog/normalize-r2-music-catalog";
export {
  getDefaultR2MusicCatalogArtifactPath,
  readR2MusicCatalogArtifact,
  writeR2MusicCatalogArtifact
} from "./catalog/r2-music-catalog-artifact";
export {
  buildPublicObjectUrl,
  encodeTrackId,
  getCandidateMusicTracks,
  getMusicPreviewReference,
  getMusicPreviewUrl,
  getMusicThumbnailUrl,
  getMusicTrackById,
  listMusicCatalog
} from "./catalog/music-library-service";
export {buildMusicCatalogSmokeSummary} from "./catalog/music-catalog-smoke";
export {
  createSignedMusicPreviewUrl,
  getSignedMusicPreviewConfig
} from "./catalog/r2-preview-url-signer";
export {
  r2CatalogEntriesToMusicTracks,
  r2CatalogEntryToMusicTrack
} from "./catalog/r2-catalog-to-music-track";
export type {
  CatalogCandidateMatch,
  CatalogCandidatePlanMode,
  SelectCatalogCandidatesForTimelineInput,
  SelectCatalogCandidatesForTimelineResult
} from "./catalog/catalog-candidate-selector";
export {selectCatalogCandidatesForTimeline} from "./catalog/catalog-candidate-selector";
export {rankTracks} from "./planner/music-ranker";
export {planTransition} from "./planner/transition-planner";
export {synthesizeVideoTimeline} from "./video-aware-planner/timeline-synthesizer";
export {orchestrateArrangement} from "./video-aware-planner/arrangement-orchestrator";
export {generateSfxEvents} from "./video-aware-planner/sfx-event-generator";
export {buildVideoAwareAudioPlan} from "./video-aware-planner/build-video-aware-audio-plan";
export {
  getVideoAwareAudioPlanArtifactPath,
  writeVideoAwareAudioPlanArtifact,
  persistVideoAwareAudioPlanArtifact,
  readVideoAwareAudioPlanArtifact
} from "./persistence/audio-plan-artifact";
export {
  adaptedSoundDesignRenderHintsSchema,
  getVideoAwareSoundManifestArtifactPath,
  readVideoAwareSoundManifestArtifact,
  videoAwareSoundManifestArtifactSchema,
  writeVideoAwareSoundManifestArtifact
} from "./persistence/sound-manifest-artifact";
export {
  getVideoAwareMusicPreflightArtifactPath,
  readVideoAwareMusicPreflightArtifact,
  writeVideoAwareMusicPreflightArtifact
} from "./persistence/music-preflight-artifact";
export {
  appendMusicOverride,
  getVideoAwareMusicOverridesArtifactPath,
  readMusicOverridesArtifact,
  writeMusicOverridesArtifact
} from "./persistence/music-overrides-artifact";
export {buildAudioPlanDryRun} from "./jobs/build-audio-plan-dry-run";
export {MusicCatalogCandidatesMissingError} from "./jobs/build-audio-plan-dry-run";
export {buildSoundManifestRehearsal} from "./jobs/build-sound-manifest-rehearsal";
export {
  MusicRehearsalArtifactsExistError,
  MusicRehearsalJobIdRequiredError,
  MusicRehearsalJobMissingError,
  runMusicRehearsal
} from "./jobs/run-music-rehearsal";
export {
  MusicPreflightArtifactInvalidError,
  MusicPreflightAudioPlanMissingError,
  MusicPreflightJobMissingError,
  MusicPreflightSoundManifestMissingError,
  validateMusicPreflight
} from "./jobs/validate-music-preflight";
export {
  MusicPreviewMixAudioPlanMissingError,
  MusicPreviewMixJobMissingError,
  MusicPreviewMixManifestMissingError,
  renderMusicPreviewMix
} from "./jobs/render-music-preview-mix";
export {
  applyMusicOverridesToPlan,
  MusicOverrideTargetNotFoundError,
  MusicOverrideTrackRequiredError,
  MusicOverrideUnsupportedError
} from "./overrides/apply-music-overrides";
export {
  adaptAudioPlanToSoundDesignManifest,
  adaptAudioPlanToSoundDesignManifestWithHints
} from "./renderer/manifest-adapter";
export {renderAudioPlan} from "./renderer/mix-renderer";
export type {
  BeatGrid,
  MusicTrack,
  MusicTrackAnalysisStatus,
  MusicTrackSection,
  MusicTrackSectionRole,
  WaveformSummary
} from "./schemas/music-track.schema";
export type {
  SfxEvent,
  SfxEventType
} from "./schemas/sfx-event.schema";
export type {
  MusicPreflightIssue,
  MusicPreflightReport,
  MusicPreflightStatus,
  MusicPreflightSummary
} from "./schemas/music-preflight.schema";
export type {
  CaptionSyncEvent,
  VideoTimelineSegment,
  VideoTimelineSegmentRole
} from "./schemas/video-timeline.schema";
export type {
  CreativeDirection,
  DuckingRegion,
  MusicEvent,
  TransitionEvent,
  TransitionEventType,
  VideoAwareAudioPlan,
  VideoAwareAudioPlanMode,
  VideoAwareAudioPlanStatus,
  VideoAwareRenderSettings
} from "./schemas/audio-plan.schema";
export type {
  MusicOverride,
  MusicOverrideAction,
  MusicOverrideRequest,
  MusicOverrideTargetType,
  MusicOverridesArtifact
} from "./schemas/music-override.schema";
export type {AnalyzeTrackInput} from "./analyzer/track-analyzer";
export type {BuildBeatGridInput} from "./analyzer/beat-grid-builder";
export type {DetectSectionsInput} from "./analyzer/section-detector";
export type {IndexTrackInput} from "./indexer/track-indexer";
export type {
  CatalogImportManifest,
  CatalogImportTrackMetadata
} from "./indexer/catalog-import.schema";
export type {
  ImportedCatalogTrack,
  NormalizeCatalogImportInput,
  NormalizeCatalogImportResult
} from "./indexer/catalog-importer";
export type {
  R2MusicCatalog,
  R2MusicCatalogEntry,
  R2StorageProvider
} from "./catalog/r2-music-catalog.schema";
export type {NormalizeR2MusicCatalogInput} from "./catalog/normalize-r2-music-catalog";
export type {
  MusicPreviewUrlSigner,
  SignedMusicPreviewConfig,
  SignedMusicPreviewUrlInput,
  SignedMusicPreviewUrlResult
} from "./catalog/r2-preview-url-signer";
export type {
  MusicPreviewReference,
  MusicCatalogQuery,
  MusicLibraryUrlMode,
  ResolvedMusicLibraryEntry
} from "./catalog/music-library-service";
export type {RankTracksInput, RankedTrackCandidate} from "./planner/music-ranker";
export type {PlanTransitionInput} from "./planner/transition-planner";
export type {
  ClipTimingInput,
  CaptionTimingInput,
  SynthesizeVideoTimelineInput
} from "./video-aware-planner/timeline-synthesizer";
export type {OrchestrateArrangementInput} from "./video-aware-planner/arrangement-orchestrator";
export type {GenerateSfxEventsInput} from "./video-aware-planner/sfx-event-generator";
export type {BuildVideoAwareAudioPlanInput} from "./video-aware-planner/build-video-aware-audio-plan";
export type {BuildAudioPlanDryRunInput, BuildAudioPlanDryRunResult} from "./jobs/build-audio-plan-dry-run";
export type {
  BuildSoundManifestRehearsalInput,
  BuildSoundManifestRehearsalResult
} from "./jobs/build-sound-manifest-rehearsal";
export type {RunMusicRehearsalInput, RunMusicRehearsalResult} from "./jobs/run-music-rehearsal";
export type {ValidateMusicPreflightInput} from "./jobs/validate-music-preflight";
export type {RenderMusicPreviewMixInput, RenderMusicPreviewMixResult} from "./jobs/render-music-preview-mix";
export type {
  AdaptAudioPlanToSoundDesignManifestInput
} from "./renderer/manifest-adapter";
export type {AdaptedSoundDesignManifest, AdaptedSoundDesignRenderHints} from "./renderer/manifest-adapter";
export type {
  AdaptedSoundDesignRenderHintsArtifact,
  VideoAwareSoundManifest,
  VideoAwareSoundManifestArtifact
} from "./persistence/sound-manifest-artifact";
export type {
  RenderAudioPlanInput,
  RenderAudioPlanResult
} from "./renderer/mix-renderer";
