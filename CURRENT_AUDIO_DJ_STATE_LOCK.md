# Current Audio DJ State Lock

Read-only snapshot captured on 2026-05-13 from the `music` branch. No code behavior was changed for this report. No uploads, downloads, test runs, staging, or commits were performed while generating it.

# 1. Branch And Git Safety

- Current branch: `music`
- Working tree: dirty
- Music-system-related dirty files currently visible:
  - `backend/package.json`
  - `backend/src/config.ts`
  - `backend/src/music/index.ts`
  - `backend/src/music/jobs/build-audio-plan-dry-run.ts`
  - `backend/src/music/persistence/audio-plan-artifact.ts`
  - `backend/src/music/renderer/manifest-adapter.ts`
  - `backend/src/music/schemas/audio-plan.schema.ts`
  - `backend/src/music/video-aware-planner/build-video-aware-audio-plan.ts`
  - `backend/src/repository.ts`
  - `backend/src/schemas.ts`
  - `backend/src/pipeline.ts`
  - `backend/src/__tests__/music-video-aware-planner.test.ts`
  - `backend/src/__tests__/schemas.test.ts`
  - untracked `backend/src/music/jobs/build-sound-manifest-rehearsal.ts`
  - untracked `backend/src/music/jobs/run-music-rehearsal.ts`
  - untracked `backend/src/music/jobs/validate-music-preflight.ts`
  - untracked `backend/src/music/persistence/music-preflight-artifact.ts`
  - untracked `backend/src/music/persistence/sound-manifest-artifact.ts`
  - untracked `backend/src/music/schemas/music-preflight.schema.ts`
  - untracked `backend/src/music/indexer/catalog-import.schema.ts`
  - untracked `backend/src/music/indexer/catalog-importer.ts`
  - untracked `backend/src/music/scripts/run-music-rehearsal.ts`
  - untracked `backend/src/music/scripts/validate-music-preflight.ts`
  - untracked `backend/src/music/scripts/upload-music-library-to-r2.ts`
  - untracked `backend/src/__tests__/music-catalog-importer.test.ts`
  - untracked `backend/src/__tests__/music-manifest-adapter.test.ts`
  - untracked `backend/src/__tests__/music-preflight-validator.test.ts`
  - untracked `backend/src/__tests__/music-rehearsal-runner.test.ts`
  - untracked `backend/src/__tests__/music-sound-manifest-rehearsal.test.ts`
  - untracked `backend/src/__tests__/music-test-utils.ts`
- Unrelated dirty changes:
  - very large `remotion-app/**` dirty set across docs, scripts, assets, data, tests, and runtime code
  - root docs `MUSIC_ENGINE_CONTEXT_PACK.md` and `VIDEO_AWARE_MUSIC_CONTEXT.md` are untracked
  - root `.gitignore` and `remotion-app/.gitignore` are modified
- Local downloader folder: untracked
  - `YOUTUBE MUSIC DOWNLOADER -THRAGG/`
  - includes untracked `downloads/music-catalog.json`
- Env or secret-bearing tracked files modified:
  - `CONSOLIDATED.env`
- What should not be staged or committed:
  - `CONSOLIDATED.env`
  - any `.env`, `.env.local`, `.env.*`
  - `YOUTUBE MUSIC DOWNLOADER -THRAGG/`
  - `YOUTUBE MUSIC DOWNLOADER -THRAGG/downloads/music-catalog.json`
  - any downloader-side scripts or media files
  - any accidental R2 credential changes in tracked files

# 2. Implemented Music System Inventory

## Schemas

- `backend/src/music/schemas/music-track.schema.ts`
  - `beatGridSchema`
  - `musicTrackSectionSchema`
  - `musicTrackSchema`
  - Defines normalized music track analysis contracts.
- `backend/src/music/schemas/video-timeline.schema.ts`
  - `videoTimelineSegmentSchema`
  - `captionSyncEventSchema`
  - Defines video-timecoded semantic timeline and caption-sync event contracts.
- `backend/src/music/schemas/audio-plan.schema.ts`
  - `musicEventSchema`
  - `transitionEventSchema`
  - `duckingRegionSchema`
  - `videoAwareAudioPlanSchema`
  - Defines `VideoAwareAudioPlan`, including `planMode: "dry_run" | "render_ready"`.
- `backend/src/music/schemas/sfx-event.schema.ts`
  - `sfxEventSchema`
  - Defines video-timecoded SFX event contracts.
- `backend/src/music/schemas/music-preflight.schema.ts`
  - `musicPreflightReportSchema`
  - Defines pass/warn/block preflight reporting.

## Video-Aware Planner

- `backend/src/music/video-aware-planner/timeline-synthesizer.ts`
  - `synthesizeVideoTimeline`
  - Builds bounded video-time segments from transcript/caption windows using hook/problem/proof/reveal/CTA keyword logic.
  - Manual/data-contract logic only. Not runtime-integrated.
- `backend/src/music/video-aware-planner/sfx-event-generator.ts`
  - `generateSfxEvents`
  - Generates conservative video-timecoded placeholder SFX events from transcript/caption cues.
  - Manual/data-contract logic only.
- `backend/src/music/video-aware-planner/arrangement-orchestrator.ts`
  - `orchestrateArrangement`
  - Produces a `VideoAwareAudioPlan` with a single bed, ducking regions, and placeholder fallback when no export-safe track is available.
  - Manual/data-contract logic only.
- `backend/src/music/video-aware-planner/build-video-aware-audio-plan.ts`
  - `buildVideoAwareAudioPlan`
  - Orchestrates timeline synthesis, caption sync, SFX generation, and arrangement into a `VideoAwareAudioPlan`.
  - Manual-only. Not called by live preview/render pipeline.

## Jobs

- `backend/src/music/jobs/build-audio-plan-dry-run.ts`
  - `buildAudioPlanDryRun`
  - Loads job/input/transcript/clip context, optionally inspects `remotion-app/src/data/music.local.json`, builds a dry-run `VideoAwareAudioPlan`, writes `video_aware_audio_plan`, and updates `job.json`.
  - Manual-only.
- `backend/src/music/jobs/build-sound-manifest-rehearsal.ts`
  - `buildSoundManifestRehearsal`
  - Reads `video_aware_audio_plan`, adapts it into a rehearsal `SoundDesignManifest` plus hints, writes `video_aware_sound_manifest`, and updates `job.json`.
  - Manual-only.
- `backend/src/music/jobs/run-music-rehearsal.ts`
  - `runMusicRehearsal`
  - Executes the non-rendering chain: dry-run audio plan then sound manifest rehearsal.
  - Manual-only.
  - Guards against overwrite unless `overwrite` is enabled.
- `backend/src/music/jobs/validate-music-preflight.ts`
  - `validateMusicPreflight`
  - Reads `video_aware_audio_plan` and `video_aware_sound_manifest`, validates timing/placeholder/license/file-readiness rules, writes `video_aware_music_preflight`.
  - Manual-only.

## Persistence

- `backend/src/music/persistence/audio-plan-artifact.ts`
  - `getVideoAwareAudioPlanArtifactPath`
  - `writeVideoAwareAudioPlanArtifact`
  - `readVideoAwareAudioPlanArtifact`
  - Writes and reads `video_aware_audio_plan`.
- `backend/src/music/persistence/sound-manifest-artifact.ts`
  - `getVideoAwareSoundManifestArtifactPath`
  - `writeVideoAwareSoundManifestArtifact`
  - `readVideoAwareSoundManifestArtifact`
  - Wraps rehearsal manifests as `artifactType: "video_aware_sound_manifest_rehearsal"`.
- `backend/src/music/persistence/music-preflight-artifact.ts`
  - `getVideoAwareMusicPreflightArtifactPath`
  - `writeVideoAwareMusicPreflightArtifact`
  - `readVideoAwareMusicPreflightArtifact`
  - Persists preflight reports.

## Renderer / Adapter

- `backend/src/music/renderer/manifest-adapter.ts`
  - `adaptAudioPlanToSoundDesignManifest`
  - `adaptAudioPlanToSoundDesignManifestWithHints`
  - Converts `VideoAwareAudioPlan` into `SoundDesignManifest` plus render hints.
  - Sanitizes times, clamps cue windows, preserves orphan transitions and ducking as hints, and keeps placeholder/unverified tracks placeholder-backed.
  - Manual bridge only. Not wired into runtime pipeline.
- `backend/src/music/renderer/mix-renderer.ts`
  - `renderAudioPlan`
  - Returns `status: "skipped"` and does not call FFmpeg or the live sound-engine.
  - Manual placeholder only.

## Indexer / Catalog

- `backend/src/music/indexer/track-indexer.ts`
  - `indexTrack`
  - Normalizes raw metadata into `MusicTrack` with safe defaults.
- `backend/src/music/indexer/license-guard.ts`
  - `assertTrackUsableForExport`
  - Throws unless `licenseVerified` and `commercialAllowed` are both true.
- `backend/src/music/indexer/catalog-import.schema.ts`
  - `catalogImportTrackMetadataSchema`
  - `catalogImportManifestSchema`
  - Defines the future `music-import/` metadata contract.
- `backend/src/music/indexer/catalog-importer.ts`
  - `normalizeCatalogImportManifest`
  - Normalizes import metadata into `MusicTrack` records with `analysisStatus: "pending"` and `exportSafe` derived from license booleans.
- `backend/src/music/catalog/`
  - Does not exist yet.

## Analyzer

- `backend/src/music/analyzer/beat-grid-builder.ts`
  - `buildBeatGrid`
  - Placeholder BPM/beat grid generator.
- `backend/src/music/analyzer/section-detector.ts`
  - `detectSections`
  - Placeholder section segmentation from duration and beat grid.
- `backend/src/music/analyzer/track-analyzer.ts`
  - `analyzeTrack`
  - Placeholder analyzer that populates beat grid, sections, waveform summary, and loudness defaults.

## Planner

- `backend/src/music/planner/music-ranker.ts`
  - `rankTracks`
  - Scores tracks against a `VideoTimelineSegment` using energy, tension, speech-friendliness, and mood tag overlap.
- `backend/src/music/planner/transition-planner.ts`
  - `planTransition`
  - Placeholder transition chooser based on IDs and intensity.

## Scripts

- `backend/src/music/scripts/run-music-rehearsal.ts`
  - CLI wrapper for `runMusicRehearsal`
- `backend/src/music/scripts/validate-music-preflight.ts`
  - CLI wrapper for `validateMusicPreflight`
- `backend/src/music/scripts/upload-music-library-to-r2.ts`
  - Manual R2 uploader and local `music-catalog.json` generator

## Tests

- `backend/src/__tests__/music-video-aware-planner.test.ts`
  - Covers timeline synthesis, transcript-timestamped SFX, schema-valid dry-run plan creation, artifact persistence, and license guard.
- `backend/src/__tests__/music-manifest-adapter.test.ts`
  - Covers plan-to-manifest mapping, timing preservation, clamping, ducking hints, placeholder tracks, and immutability.
- `backend/src/__tests__/music-sound-manifest-rehearsal.test.ts`
  - Covers rehearsal artifact writing, separation from `audio_render_plan`, placeholder preservation, and missing-plan errors.
- `backend/src/__tests__/music-rehearsal-runner.test.ts`
  - Covers full manual chain, summary counts, overwrite guard, missing-job errors, and `audio_render_plan` staying untouched.
- `backend/src/__tests__/music-preflight-validator.test.ts`
  - Covers dry-run warn behavior, render-ready blocking behavior, invalid timing, missing artifacts, report persistence, and `audio_render_plan` remaining untouched.
- `backend/src/__tests__/music-catalog-importer.test.ts`
  - Covers import normalization, tag kebab-casing, default unsafe license state, and no dependency on real files.
- `backend/src/__tests__/schemas.test.ts`
  - Also includes job artifact path assertions for music artifact keys.

# 3. Artifact System Truth

## Repository artifact keys

- `video_aware_audio_plan`
  - Path pattern: `jobs/<jobId>/audio/video-aware-audio-plan.json`
  - Writer: `writeVideoAwareAudioPlanArtifact`, also `buildAudioPlanDryRun`
  - Reader: `readVideoAwareAudioPlanArtifact`
  - `job.json artifact_paths`: yes
  - Live runtime consumer: no
  - Manual-only: yes
  - Safe to overwrite: writer will overwrite deterministically; `runMusicRehearsal` blocks overwrite unless explicitly enabled

- `video_aware_sound_manifest`
  - Path pattern: `jobs/<jobId>/audio/video-aware-sound-manifest.json`
  - Writer: `writeVideoAwareSoundManifestArtifact`, also `buildSoundManifestRehearsal`
  - Reader: `readVideoAwareSoundManifestArtifact`
  - `job.json artifact_paths`: yes
  - Live runtime consumer: no
  - Manual-only: yes
  - Safe to overwrite: same manual overwrite caveat as rehearsal chain

- `video_aware_music_preflight`
  - Path pattern: `jobs/<jobId>/audio/video-aware-music-preflight.json`
  - Writer: `writeVideoAwareMusicPreflightArtifact`, also `validateMusicPreflight`
  - Reader: `readVideoAwareMusicPreflightArtifact`
  - `job.json artifact_paths`: yes
  - Live runtime consumer: no
  - Manual-only: yes
  - Safe to overwrite: yes as a latest validation report

- `audio_render_plan`
  - Path pattern: `jobs/<jobId>/audio/audio-render-plan.json`
  - Writer: `FileJobRepository.writeAudioRenderPlan`, and live pipeline sound-engine flow writes path metadata for it
  - Reader: `/api/jobs/:jobId/audio-render-plan` route reads it directly
  - `job.json artifact_paths`: yes
  - Live runtime consumer: yes on the sound-engine side as debug/render output tracking
  - Manual-only: no
  - Safe to overwrite: only by the live sound-engine path, not by the music dry-run system

## Job-record-only audio outputs

- `audio_master`
- `audio_master_aac`
- `audio_preview_mix`
- `audio_waveform_png`
- `audio_peaks_json`
- `audio_stems_dir`

These are fields in `jobRecordSchema.artifact_paths`, but they are not `FileJobRepository` artifact keys. They are explicit paths populated by the live sound-engine branch in `backend/src/pipeline.ts`.

## Confirmed truth

- `audio_render_plan` is no longer used for dry-run `VideoAwareAudioPlan`
- `video_aware_audio_plan`, `video_aware_sound_manifest`, and `video_aware_music_preflight` do not auto-trigger render or export
- live app route exposure currently exists only for `audio_render_plan`, not for the new video-aware artifacts

# 4. Manual Commands Available

- `npm run music:rehearsal -- --jobId <jobId> [--previewStartSec N --previewEndSec N --strict --overwrite]`
  - Runs `runMusicRehearsal`
  - Mutates local backend job artifacts
  - Does not touch R2
  - Uses backend env only for storage config
  - Safe for manual rehearsal; not runtime-integrated

- `npm run music:preflight -- --jobId <jobId> [--strict --requireRenderReady --disallowPlaceholders --checkFileExists --assetRoot <path>]`
  - Runs `validateMusicPreflight`
  - Mutates local backend job artifacts by writing `video_aware_music_preflight`
  - Does not touch R2
  - Uses backend env only for storage config
  - Safe for manual validation

- `npm run music:upload:r2 -- [--dryRun] [--checkRemote] [--doctor] [--doctor-write] [--sourceRoot <path>] [--catalogPath <path>]`
  - Runs the R2 uploader
  - Mutates local `music-catalog.json`
  - Can read and write R2 depending on flags
  - Requires R2 env credentials
  - `--dryRun` is safe locally and avoids remote access unless `--checkRemote` is also passed
  - `--doctor` is read-only unless `--doctor-write` is passed

- `npm run typecheck`
  - Validation only
  - No intended business-data mutation

- `npm run test`
  - Validation only
  - No intended business-data mutation

- No package script exists yet for catalog normalization/import-only workflows

# 5. R2 Music Upload State

Uploader implementation: `backend/src/music/scripts/upload-music-library-to-r2.ts`

- R2 prefixes used:
  - `music-originals/`
  - `music-thumbnails/`
  - `music-previews/` only for optional doctor write probe
- MP3 mapping:
  - `.mp3` files upload to `music-originals/<category-slug>/<track-slug>.mp3`
- Thumbnail mapping:
  - `.webp`, `.jpg`, `.jpeg`, `.png` upload to `music-thumbnails/<category-slug>/<track-slug>.<ext>`
- Folder structure:
  - category folder structure is preserved via slugified category subfolders
- Local catalog:
  - writes `music-catalog.json` under the source library root by default
- Resume/skip behavior:
  - real uploads check remote state by default and skip when object size matches
  - `--dryRun` does not hit R2 unless `--checkRemote` is passed
- Reliability features:
  - retries transient upload and list failures with exponential backoff
  - runs sequentially
  - warns on clock skew before upload
- Doctor mode:
  - checks env presence only
  - prints masked account suffix and endpoint host
  - checks `HeadBucket`
  - checks `ListObjectsV2`
  - `PutObject` probe only if `--doctor-write` is explicitly passed

Prior run state observed in this workspace session:
- real upload completed
- post-upload verification succeeded with:
  - `uploaded: 0`
  - `skipped: 302`
  - `failed: 0`
- inferred mirrored totals:
  - `149` MP3 objects
  - `153` thumbnail objects
  - `302` total uploaded/skipped remote objects
- R2 prefixes confirmed present from the verified run:
  - `music-originals/`
  - `music-thumbnails/`

# 6. Catalog State

- Local `music-catalog.json` exists:
  - `YOUTUBE MUSIC DOWNLOADER -THRAGG/downloads/music-catalog.json`
- Current local catalog shape:
  - keys: `id`, `title`, `category`, `categorySlug`, `originalObjectKey`, `thumbnailObjectKey`, `duration`, `fileSizeBytes`
- Current local catalog counts:
  - entries: `149`
  - unique categories: `9`
  - entries with thumbnailObjectKey: `149`
- Existing local Remotion catalog also exists:
  - `remotion-app/src/data/music.local.json`
  - entries: `22`
  - shape includes `id`, `label`, `src`, `sourceFileName`, `librarySection`, `durationSeconds`, `tags`, `intensity`
- Normalized backend catalog service:
  - not implemented yet
  - only import contract and normalization helper exist
- R2 object keys represented in backend schema:
  - not in `MusicTrack`
  - current R2 upload catalog JSON stores `originalObjectKey` and `thumbnailObjectKey`
  - current backend `MusicTrack` stores `storagePath`, not R2 object-key fields
- Track IDs mapping:
  - uploader catalog IDs are `<categorySlug>/<trackSlug>`
  - catalog importer IDs are `import-<artist-title-fileStem>`
  - there is not yet a unified backend track ID strategy tying R2 object keys to `MusicTrack`
- License fields:
  - yes in `MusicTrack`
  - importer defaults to unsafe unless explicitly verified
- Tracks default to unsafe/unverified:
  - yes
- Frontend can list/stream this new R2-backed catalog:
  - not yet
  - no dedicated backend API or frontend wiring exists for the uploaded R2 library

# 7. Current DJ Capability

## Can do

- generate video-aware dry-run audio plan: yes
- generate sound manifest rehearsal: yes
- run full rehearsal chain manually: yes
- validate preflight: yes
- upload music to R2: yes
- normalize import catalog metadata: yes

## Cannot do yet

- select real R2 tracks in the planner: no
  - current dry-run loader only inspects `remotion-app/src/data/music.local.json`
  - those tracks are treated as unverified and usually fall back to placeholder music
- expose music catalog to frontend: no
- stream music from R2 through backend/frontend: no
- render mixed audio through the new music system: no
- attach new music outputs to preview/export: no
- promote plans automatically into live render pipeline: no
- analyze real tracks with BPM/key/sections from audio content: no
- resolve SFX assets beyond placeholder paths: no
- guarantee export-safe music selection from uploaded YouTube-derived library: no

# 8. Tests And Validation

Music-specific tests currently present:
- `music-video-aware-planner.test.ts`
- `music-manifest-adapter.test.ts`
- `music-sound-manifest-rehearsal.test.ts`
- `music-rehearsal-runner.test.ts`
- `music-preflight-validator.test.ts`
- `music-catalog-importer.test.ts`
- helper: `music-test-utils.ts`

Coverage summary:
- planner/timeline/SFX generation
- dry-run plan persistence
- manifest adapter mapping and clamping
- rehearsal artifact generation
- preflight warn/block rules
- importer normalization and unsafe defaults
- overwrite and missing-artifact guards

Validation status for this report session:
- full test suite: not run
- typecheck: not run

Last known unrelated blockers from prior sessions, not revalidated here:
- remotion-related backend typecheck issues have existed, but current exact error set was not re-run in this session
- `edit-sessions` timeout was previously reported
- `editorial-contract` profile mismatch was previously reported
- `preview-render-service` timeout was previously reported

Because the test suite was not re-run for this report, treat those blocker names as historical context, not fresh confirmation.

# 9. Risk Register

- Secrets in tracked files
  - `CONSOLIDATED.env` is modified and tracked
- Env override precedence
  - `backend/src/config.ts` loads and allows `remotion-app/.env.local` to override overlapping backend `.env.local` keys
- Dirty worktree
  - very large unrelated dirty set increases commit risk
- Local downloader folder accidentally committed
  - `YOUTUBE MUSIC DOWNLOADER -THRAGG/` is untracked and not ignored at the repo root
- `.gitignore` typo
  - root `.gitignore` contains `!CONSOLIATED.env`, not `!CONSOLIDATED.env`
- R2 visibility and serving strategy
  - upload exists, but no signed URL or public-serving backend contract is implemented for the new catalog
- License safety
  - uploaded library provenance appears mixed and not yet verified for export safety
- YouTube-derived music export safety
  - high legal/product risk until verified licensing policy is formalized
- Catalog mismatch risk
  - local uploader catalog JSON and backend `MusicTrack` schema do not yet share one unified persisted catalog model
- Frontend latency/streaming unknowns
  - no R2 streaming path has been measured or implemented
- `audio_render_plan` collision risk
  - currently avoided, but must stay reserved for sound-engine output
- Clock skew
  - uploader warns about local clock skew, which can break future signed R2 operations
- Placeholder leakage
  - unverified tracks and placeholder cues must never be promoted to `render_ready` without explicit checks

# 10. Recommended Next Phase

## Phase A: Git Hygiene And Commit Isolation

- Goal:
  - isolate the music-system changes from the huge unrelated dirty worktree before more backend work lands
- Files likely touched:
  - no product code required
  - only repo hygiene and ignore strategy, if done carefully later
- Why it is next:
  - current branch state is risky for accidental staging and review confusion
- Why it is safe:
  - can be done without touching runtime behavior
- What must not be touched:
  - frontend behavior
  - downloader media
  - R2 state
  - sound-engine runtime logic

## Phase B: Normalized R2-Backed Music Catalog Service

- Goal:
  - create a backend-native catalog model that represents uploaded tracks with stable IDs, R2 object keys, license status, and stream metadata
- Files likely touched:
  - `backend/src/music/indexer/`
  - new `backend/src/music/catalog/` area
  - possibly new backend persistence/service files
- Why it is next:
  - planner and frontend cannot safely use the uploaded library until there is one canonical backend catalog
- Why it is safe:
  - can remain read-only/manual and avoid pipeline integration
- What must not be touched:
  - `audio_render_plan`
  - live preview/export pipeline
  - FFmpeg or sound-engine render path

## Phase C: Real Catalog-Aware Dry-Run Planner

- Goal:
  - teach `buildAudioPlanDryRun` to read the normalized catalog and optionally select real, license-safe tracks instead of defaulting to placeholder beds
- Files likely touched:
  - `backend/src/music/jobs/build-audio-plan-dry-run.ts`
  - `backend/src/music/video-aware-planner/arrangement-orchestrator.ts`
  - new catalog service files
  - music tests
- Why it is next:
  - it unlocks a meaningful music-brain rehearsal without touching render runtime
- Why it is safe:
  - still manual-only and can stay behind dry-run + preflight
- What must not be touched:
  - live pipeline integration
  - frontend UI
  - FFmpeg
  - billing/auth

# 11. Context To Hand Back To ChatGPT

Exact current implemented modules:
- `backend/src/music` now contains schemas, analyzer, planner, indexer, persistence, jobs, renderer adapter, and manual scripts
- core functions implemented:
  - `buildVideoAwareAudioPlan`
  - `buildAudioPlanDryRun`
  - `buildSoundManifestRehearsal`
  - `runMusicRehearsal`
  - `validateMusicPreflight`
  - `adaptAudioPlanToSoundDesignManifestWithHints`
  - `normalizeCatalogImportManifest`
  - R2 uploader in `backend/src/music/scripts/upload-music-library-to-r2.ts`

Exact artifact keys:
- `video_aware_audio_plan`
- `video_aware_sound_manifest`
- `video_aware_music_preflight`
- `audio_render_plan`
- job-path-only outputs also tracked:
  - `audio_master`
  - `audio_master_aac`
  - `audio_preview_mix`
  - `audio_waveform_png`
  - `audio_peaks_json`
  - `audio_stems_dir`

Exact commands:
- `npm run music:rehearsal -- --jobId <jobId>`
- `npm run music:preflight -- --jobId <jobId>`
- `npm run music:upload:r2 -- --dryRun`
- `npm run music:upload:r2 -- --dryRun --checkRemote`
- `npm run music:upload:r2 -- --doctor`

Exact R2/catalog state:
- uploader exists and is hardened for retries, remote skip-by-size, and clock-skew warning
- prior run in this workspace session verified remote completion:
  - `uploaded: 0`
  - `skipped: 302`
  - `failed: 0`
- local uploader catalog exists at:
  - `YOUTUBE MUSIC DOWNLOADER -THRAGG/downloads/music-catalog.json`
- local uploader catalog currently has:
  - `149` entries
  - `9` categories
  - keys: `id`, `title`, `category`, `categorySlug`, `originalObjectKey`, `thumbnailObjectKey`, `duration`, `fileSizeBytes`

Exact missing pieces:
- no normalized backend R2 catalog service
- no backend API for the new uploaded music catalog
- planner does not yet select real R2-backed tracks
- no frontend integration for browsing/streaming new catalog
- no live render bridge from video-aware artifacts into production preview/export
- no real track analysis beyond placeholders

Safest next prompt to give Codex:
- “On the `music` branch, do a read-write implementation of a normalized backend music catalog service that ingests the existing local `music-catalog.json` into a backend-native catalog model with stable IDs, R2 object keys, license flags, and read-only listing helpers. Do not integrate into live preview/render pipeline, do not touch frontend, do not touch `audio_render_plan`, and add focused backend tests only.”
