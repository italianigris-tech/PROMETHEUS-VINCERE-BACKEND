# PROMETHEUS v8.2 BUILD TRACKER

## Sprint

Phase: Body Wiring Sprint
Day: 1 of 14
Target: Upload -> Joseph Edit -> MP4, 1080x1920, render-safe media, real audio, and pixel proof.

## Current Batch

| Batch | Focus | Status | Gate |
|---|---|---|---|
| B0 | Roadmap extraction, architecture plan, tracker setup | READY_FOR_REVIEW | v8.2 tracker and PRD created in repo |
| B1 | SFX real files and seeded selection | READY_FOR_REVIEW | 40 SFX files > 0 bytes; Director deterministic variants; mixer resolves variant files |
| B2 | Asset resolver seam and browser-safe render source guard | READY_FOR_REVIEW | `MediaReference` carries browser-safe URL plus FFmpeg-safe file path; worker sample and Joseph video plane reject `file:///` leaks |
| B3 | Manifest unification for Joseph render jobs | READY_FOR_REVIEW | Backend accepts validated `UnifiedRenderManifest`; worker leases raw manifests and posts terminal failures |
| B4 | Font MVP and music infrastructure | READY_FOR_REVIEW | Hero font resolver, 577-font corpus index, local/R2 music references, analysis fallback, and deterministic ranking are green |
| B5 | Upload -> Orchestrator -> vertical render contract | READY_FOR_REVIEW | Joseph upload profile queues a validated `UnifiedRenderManifest`; worker uses Joseph-only 1080x1920 entry and fails dimension mismatches loudly |
| B6 | Silent/full MP4 proof, source visibility, SFX, and AAC mux | READY_FOR_REVIEW | `scripts/test-full-render.ts` renders a 1080x1920 Joseph MP4, proves nonblack/source pixels, verifies AAC duration/loudness, and rejects file URL blocking |

## Architecture Stance

- `cue` remains semantic: `whoosh_fast`, `impact_deep`, `pop_text`, etc.
- Concrete SFX filenames are resolved behind the audio module, not leaked across the Director interface.
- The Director may choose a deterministic `variant` value from 1 to 5.
- The audio module maps `(cue, variant)` to `${cue}_${variant}.mp3`, falls back to `${cue}_1.mp3`, then to `${cue}.mp3` only for legacy compatibility.
- A zero-byte SFX file is treated as missing.
- `MediaReference` is the render asset seam: `browserUrl` is only root-relative or HTTP(S), while `filePath` is absolute for FFmpeg.
- `LocalAssetResolver` is the current adapter at that seam. It copies upload media into stable storage, publishes a browser-safe URL, preserves an absolute FFmpeg path, infers content type, records byte size, and sanitizes path segments.
- Remotion video planes must fail loudly on `file:///`, Windows absolute, or UNC media sources. Silent black output is considered a bug.
- `UnifiedRenderManifest` is now the default Joseph render-job interface. `/api/v1/render/jobs` accepts only `{manifest, variationKey?, evidencePath?}` and validates with `UnifiedRenderManifestSchema`.
- Worker polling leases raw Joseph manifests from `/api/v1/render/jobs/next`; it validates again before rendering and posts `/failed` on schema or render failures.
- The old `RenderManifestBridge` path is preserved explicitly as legacy at `/api/v1/render/jobs/legacy` and `/api/v1/render/jobs/legacy/next`.
- `UnifiedRenderManifest.typography` is the Joseph typography handoff: `fontId`, CSS `fontFamily`, browser-safe `fontAssetUrl`, and `fallbackFamily`.
- `MusicReference` is the final-render music seam: local/R2/HTTP sources must resolve to an absolute `localFilePath` before FFmpeg can use them.
- `FontRuntimeResolver` hides the hero font subset and corpus details behind `selectHeroFonts(context, seed)`.
- `MusicAnalysisAdapter` hides Python/librosa availability and deterministic FFmpeg/constant-BPM fallback behind `analyzeMusicTrack(filePath)`.
- R2 music may be previewable remotely, but it is not `renderSafe` until a valid local cache file exists.
- Joseph production upload selection is explicit via `josephProfile`: `joseph_aggressive`, `joseph_cinematic`, or `joseph_minimal`.
- `createJosephUploadPipeline` is the product gateway module for Joseph uploads. It resolves the browser-safe video asset, writes a fallback transcript when needed, selects hero typography, analyzes/ranks music, registers the prompt, creates the variation key, runs `orchestrateRender()`, validates the manifest, queues the Joseph render job, and records evidence/replay metadata.
- Worker Joseph renders use `remotion-app/src/entries/joseph-entry.tsx`, not the general preview root. The worker asserts both manifest/output dimensions and Remotion composition metadata are 1080x1920 before `renderMedia()`.
- `VideoPlane` remains responsible for browser-safe video source rejection and 9:16 cover-crop texture transforms. Root-relative public media is converted through Remotion `staticFile()` before it reaches the browser; direct `/dev-fixtures/...` access caused a black-frame 404 during B6 repro.
- `mixAudio()` now requires explicit `{sfxDir, tempDir}` options, validates FFmpeg-safe local audio paths, applies per-cue SFX volume before `amix`, caps output to manifest duration, and treats missing SFX as the terminal `missing_sfx_asset` failure tag.
- `scripts/test-full-render.ts` is the current body-proof gate: it renders through the worker adapter, ffprobes dimensions/streams, extracts frames, verifies nonblack/source-video pixels, checks render logs for local-resource blocking, and measures loudness.

## Ticket Table

| Ticket | Name | Status | Owner | Files | Blockers | Last Updated | Gate |
|---|---|---|---|---|---|---|---|
| T33 | Asset Contract | READY_FOR_REVIEW | Codex | `packages/shared-types/src/asset-resolver.ts`, `backend/src/asset/local-asset-resolver.ts`, `backend/src/asset/local-asset-resolver.test.ts` | None | 2026-06-21 | Browser-safe URL and FFmpeg-safe file path are both present with `assetId`, `contentType`, and `sizeBytes` |
| T34 | Upload To Orchestrator Wiring | READY_FOR_REVIEW | Codex | `backend/src/upload-routes.ts`, `backend/src/upload/joseph-upload-pipeline.ts`, `backend/src/app.ts`, `backend/src/edit-sessions/service.ts`, `backend/src/render-jobs/routes.ts` | None | 2026-06-22 | Upload completion with a Joseph profile creates a render-pending edit session and queues a validated Joseph `UnifiedRenderManifest` with evidence, variation, and replay metadata |
| T35 | Manifest Unification | READY_FOR_REVIEW | Codex | `backend/src/render-jobs/routes.ts`, `backend/src/__tests__/render-jobs.test.ts`, `apps/worker/src/poller.ts`, `apps/worker/src/poller.test.ts` | None | 2026-06-21 | Worker leases, validates, renders, completes, or fails raw `UnifiedRenderManifest` jobs directly |
| T36 | Vertical Resolution Enforcement | READY_FOR_REVIEW | Codex | `remotion-app/src/Root.tsx`, `remotion-app/src/entries/joseph-entry.tsx`, `remotion-app/src/compositions/joseph-default-manifest.ts`, `apps/worker/src/index.ts`, `scripts/test-full-render.ts` | None | 2026-06-22 | `npx.cmd tsx scripts/test-full-render.ts` ffprobe proof confirmed 1080x1920 output |
| T37 | Browser-Safe Video Serving | READY_FOR_REVIEW | Codex | `backend/src/asset/local-asset-resolver.ts`, `backend/src/upload/joseph-upload-pipeline.ts`, `apps/worker/src/poller.ts`, `remotion-app/src/compositions/JosephEdit.tsx`, `remotion-app/src/compositions/VideoPlane.tsx`, `scripts/test-full-render.ts` | None | 2026-06-22 | Root-relative public video URLs are converted through `staticFile()`; render logs contain no `file:///` blocking and no fixture 404 |
| T38 | Manifest To Silent MP4 | READY_FOR_REVIEW | Codex | `scripts/test-full-render.ts`, `apps/worker/src/index.ts` | None | 2026-06-22 | Final muxed MP4 exists, 764079 bytes, 1080x1920 |
| T39 | SFX Real Files And Seeded Selection | READY_FOR_REVIEW | Codex | `packages/shared-types/src/unified-render-manifest.ts`, `backend/src/director/joseph-director.ts`, `backend/src/audio/mix-audio.ts`, `remotion-app/public/sfx/`, `scripts/generate-sfx-library.mjs`, `scripts/verify-sfx-library.mjs` | None | 2026-06-21 | Real SFX assets and deterministic variant resolution pass tests |
| T40 | Font Pipeline Hero Set | READY_FOR_REVIEW | Codex | `packages/shared-types/src/unified-render-manifest.ts`, `backend/src/font/font-runtime-resolver.ts`, `backend/src/font/font-corpus-indexer.ts`, `remotion-app/public/fonts/hero/`, `remotion-app/src/compositions/JosephEdit.tsx` | None | 2026-06-22 | Deterministic hero font appears in manifest and render |
| T41 | Music Beat Match MVP | READY_FOR_REVIEW | Codex | `packages/shared-types/src/unified-render-manifest.ts`, `backend/src/music/catalog/local-music-catalog.ts`, `backend/src/music/catalog/r2-music-catalog.ts`, `backend/src/music/analyzer/music-analysis-adapter.ts`, `backend/src/music/rank-music-for-profile.ts` | None | 2026-06-22 | Beat grid fallback and fade-to-duration pass tests |
| T42 | Audio Mix End To End | READY_FOR_REVIEW | Codex | `backend/src/audio/mix-audio.ts`, `backend/src/audio/mix-audio.integration.test.ts`, `apps/worker/src/index.ts`, `apps/worker/src/poller.ts`, `scripts/test-full-render.ts` | None | 2026-06-22 | Final MP4 has AAC stream, audio/video duration differs by 7ms, and loudness measured -13.20 LUFS against -14 target |
| T43 | Render Entry Contract | READY_FOR_REVIEW | Codex | `remotion-app/src/entries/joseph-entry.tsx`, `remotion-app/src/compositions/joseph-default-manifest.ts`, `apps/worker/src/index.ts` | T35 | 2026-06-22 | Joseph-only bundle entry registers only `JosephEdit`; worker bundles that entry for Joseph jobs and reuses bundle cache |
| T44 | Full Render Pixel Test | READY_FOR_REVIEW | Codex | `scripts/test-full-render.ts`, `scripts/assert-nonblack.ts` | None | 2026-06-22 | Extracted frame has 98.72% non-black pixels |
| T45 | Source Video Visibility Test | READY_FOR_REVIEW | Codex | `scripts/test-full-render.ts`, `scripts/assert-source-visible.ts`, `remotion-app/src/compositions/VideoPlane.tsx` | None | 2026-06-22 | Source-video pixels are detected with source/render mean distance 1.48 and no text overlay in the proof manifest |
| T46 | Production Upload To MP4 Loop | NOT_STARTED | Unclaimed | upload route, render jobs, worker | None; T33-T45 are ready | 2026-06-22 | POST video returns final MP4 URL |
| T47 | CI Render Gate And Tracker Cleanup | NOT_STARTED | Unclaimed | `.github/workflows/render-gate.yml`, trackers | T46 | 2026-06-21 | CI render gate passes |

## Batch Prompts For Codex

### Batch B1 Prompt

Build T39 only. Keep `cue` semantic, add seeded SFX `variant` metadata, generate or validate 40 real nonzero MP3 assets, update audio resolution behind a public audio seam, and prove determinism through tests. Do not touch upload wiring, render-job schema, font pipeline, or music beat matching in this batch.

### Batch B2 Prompt

Build T33 plus T37. Create the asset resolver seam that returns browser-safe URLs and FFmpeg-safe file paths, then prove Chromium-safe video serving or copy-to-public mode with tests.

### Batch B3 Prompt

Build T35 plus the first part of T38. Make backend render jobs and worker consume the same UnifiedRenderManifest without legacy translation, then render a silent Joseph MP4 from a fixture manifest.

### Batch B4 Prompt

Build T34 plus the next slice of T38. Wire upload completion into the Director/orchestrator and enqueue a Joseph `UnifiedRenderManifest` render job using the asset resolver seam. Do not start full pixel-proof work until a queued upload can be leased by the worker.

### Batch B5 Prompt

Build T34 plus the next slice of T38. Use the Batch B4 font/music infrastructure from `selectHeroFonts`, `listLocalMusicCatalog`, `analyzeMusicTrack`, and `selectMusicForProfile` when creating the Joseph `UnifiedRenderManifest`. Keep full audio mix and pixel proof for later batches unless upload-to-queued-render cannot be verified without a small fixture render.

### Batch B6 Prompt

Build T38, T42, T44, and T45. Prove the Joseph body path with `scripts/test-full-render.ts`: render through the worker adapter, assert a 1080x1920 MP4 over 100KB, extract frames, prove nonblack/source-video pixels, pass explicit SFX roots to `mixAudio()`, verify AAC audio duration/loudness, and fail loudly on local-resource blocking or missing SFX.

## Assumption Log

- 2026-06-21: FFmpeg is available locally unless proven otherwise.
- 2026-06-21: Synthetic SFX assets are acceptable for MVP if licensing-safe library assets are not already present.
- 2026-06-21: v8.1 brain modules are preserved and only execution seams are deepened.
- 2026-06-21: `packages/shared-types/dist/` is ignored, so agents must run `npm.cmd --prefix packages/shared-types run build` before backend runtime tests that import `@prometheus/shared-types`.
- 2026-06-21: B1 SFX files and B2 asset-resolver changes are coherent Wave 1 work. They should be committed together only after the tracker update and gate commands below are present.
- 2026-06-21: Backend and shared-types currently use different Zod package instances. Render-job validation error formatting is intentionally structural so `UnifiedRenderManifestSchema` errors from shared-types can be reported by backend routes without nominal Zod type coupling.
- 2026-06-21: Legacy bridge jobs remain available for non-Joseph experiments, but Joseph production work must use the unified manifest route.
- 2026-06-22: Hero font MVP uses five materialized render-safe fonts only. The full 577-font corpus remains indexed on demand and is not copied wholesale to `public/fonts`.
- 2026-06-22: Python librosa/Essentia analysis remains optional in this batch. `MusicAnalysisAdapter` records source attribution and warnings when deterministic FFmpeg/constant-BPM fallback is used.
- 2026-06-22: B5 intentionally stopped at upload-to-queued-render and vertical render contract. B6 completed the first body proof: final muxed MP4 creation, ffprobe proof, nonblack pixel proof, source-video visibility, AAC mux, and loudness measurement.
- 2026-06-22: B6 repro found the true black-frame root cause: `VideoPlane` passed `/dev-fixtures/test-video.mp4` directly to Chromium, which requested `http://localhost:3000/dev-fixtures/test-video.mp4` and received 404. Root-relative public video URLs must pass through Remotion `staticFile()`.
- 2026-06-22: B6 proof manifest intentionally has no text overlays and does not prefer the hydrated font library. A failed retry showed Drei text/font loading can keep Remotion waiting for the root to unsuspend; font hydration belongs to the next batch, not the body-proof gate.

## Verification Log

- 2026-06-21 B1: `npm.cmd --prefix packages/shared-types test -- src/unified-render-manifest.test.ts` passed, 5 tests.
- 2026-06-21 B1: `npm.cmd --prefix backend test -- src/director/joseph-director.contract.test.ts src/audio/mix-audio.test.ts` passed, 14 tests.
- 2026-06-21 B1: `npm.cmd --prefix packages/shared-types run build` passed and refreshed `dist/` declarations.
- 2026-06-21 B1: `npm.cmd --prefix packages/shared-types run typecheck`, `npm.cmd --prefix backend run typecheck`, and `npm.cmd --prefix apps/worker run typecheck` passed.
- 2026-06-21 B1: `npx.cmd tsx scripts/test-joseph.ts` passed manifest-level Joseph assertions.
- 2026-06-21 B1: `node scripts/verify-sfx-library.mjs` passed, 40 nonzero MP3 SFX assets.
- 2026-06-21 B2 repro: `npm.cmd --prefix backend test -- src/asset/local-asset-resolver.test.ts` failed before rebuild, 1 passed / 3 failed. Root cause: `packages/shared-types/dist/index.js` did not export `MediaReferenceSchema`.
- 2026-06-21 B2: `npm.cmd --prefix packages/shared-types run build` passed and refreshed ignored local `dist/`.
- 2026-06-21 B2: `npm.cmd --prefix packages/shared-types test -- src/asset-resolver.test.ts src/unified-render-manifest.test.ts` passed, 2 files / 10 tests.
- 2026-06-21 B2: `npm.cmd --prefix backend test -- src/asset/local-asset-resolver.test.ts src/director/joseph-director.contract.test.ts src/audio/mix-audio.test.ts` passed, 3 files / 19 tests.
- 2026-06-21 B2: `npm.cmd --prefix backend run typecheck` passed.
- 2026-06-21 B2: `npm.cmd --prefix apps/worker run typecheck` passed.
- 2026-06-21 B2: `node scripts/verify-sfx-library.mjs` passed, 40 nonzero MP3 SFX assets.
- 2026-06-21 B2 extra: `npm.cmd --prefix apps/worker test -- src/index.test.ts` passed, 1 file / 5 tests.
- 2026-06-21 B2 extra: `npm.cmd --prefix remotion-app test -- src/compositions/__tests__/JosephEdit.test.tsx` passed, 1 file / 5 tests.
- 2026-06-21 B2 extra: `npm.cmd --prefix remotion-app run typecheck` passed.
- 2026-06-21 B3 repro: existing `npm.cmd --prefix backend test -- src/render-jobs` and `npm.cmd --prefix apps/worker test` were green but did not cover the mismatch: `/api/v1/render/jobs` created `RenderManifestBridge` while worker expected raw `UnifiedRenderManifest`.
- 2026-06-21 B3 red tests: added route and worker poller tests. Initial failures showed missing `/legacy` routes, Joseph route still accepting bridge payloads, missing `/failed` route, and no exported `pollOnce`.
- 2026-06-21 B3: `npm.cmd --prefix packages/shared-types run build` passed.
- 2026-06-21 B3: `npm.cmd --prefix packages/shared-types test -- src/unified-render-manifest.test.ts` passed, 1 file / 5 tests.
- 2026-06-21 B3: `npm.cmd --prefix backend test -- src/render-jobs src/__tests__/render-jobs.test.ts` passed, 2 files / 13 tests.
- 2026-06-21 B3: `npm.cmd --prefix backend run typecheck` passed.
- 2026-06-21 B3: `npm.cmd --prefix apps/worker test` passed, 29 files / 137 tests.
- 2026-06-21 B3: `npm.cmd --prefix apps/worker run typecheck` passed.
- 2026-06-22 B4 red tests: shared-types initially failed 4 new typography/music-reference assertions; backend font/music tests failed on missing modules; JosephEdit test failed because it still used the hard-coded Antenna constant.
- 2026-06-22 B4: `npm.cmd --prefix packages/shared-types run build` passed.
- 2026-06-22 B4: `npm.cmd --prefix packages/shared-types test` passed, 6 files / 29 tests.
- 2026-06-22 B4: `npm.cmd --prefix backend test -- src/font` passed, 2 files / 4 tests.
- 2026-06-22 B4: `npm.cmd --prefix backend test -- src/music` passed, 4 files / 5 tests.
- 2026-06-22 B4: `npm.cmd --prefix backend run typecheck` passed.
- 2026-06-22 B4: `npm.cmd --prefix remotion-app test -- src/compositions/__tests__/JosephEdit.test.tsx` passed, 1 file / 6 tests.
- 2026-06-22 B4: `npm.cmd --prefix remotion-app run typecheck` passed.
- 2026-06-22 B4: `node scripts/verify-sfx-library.mjs` passed, 40 nonzero MP3 SFX assets.
- 2026-06-22 B5: `npm.cmd --prefix packages/shared-types run build` passed.
- 2026-06-22 B5: `npm.cmd --prefix packages/shared-types test` passed, 6 files / 29 tests.
- 2026-06-22 B5: `npm.cmd --prefix backend test -- src/upload src/render-jobs src/director` passed, 10 files / 55 tests.
- 2026-06-22 B5 extra: `npm.cmd --prefix backend test -- src/__tests__/upload-routes.test.ts` passed, 1 file / 5 tests.
- 2026-06-22 B5: `npm.cmd --prefix backend run typecheck` passed.
- 2026-06-22 B5: `npm.cmd --prefix apps/worker test` passed, 29 files / 139 tests.
- 2026-06-22 B5: `npm.cmd --prefix apps/worker run typecheck` passed.
- 2026-06-22 B5: `npm.cmd --prefix remotion-app test -- src/compositions/__tests__/JosephEdit.test.tsx` passed, 1 file / 8 tests.
- 2026-06-22 B5: `npm.cmd --prefix remotion-app run typecheck` passed.
- 2026-06-22 B5: `node scripts/verify-sfx-library.mjs` passed, 40 nonzero MP3 SFX assets.

- 2026-06-22 B6: `npm.cmd --prefix packages/shared-types run build` passed.
- 2026-06-22 B6: `npm.cmd --prefix packages/shared-types test` passed, 6 files / 29 tests.
- 2026-06-22 B6: `npm.cmd --prefix backend test -- src/audio` passed, 2 files / 12 tests.
- 2026-06-22 B6: `npm.cmd --prefix backend run typecheck` passed.
- 2026-06-22 B6: `npm.cmd --prefix apps/worker test` passed, 29 files / 140 tests.
- 2026-06-22 B6: `npm.cmd --prefix apps/worker run typecheck` passed.
- 2026-06-22 B6: `npm.cmd --prefix remotion-app run typecheck` passed.
- 2026-06-22 B6: `node scripts/verify-sfx-library.mjs` passed, 40 nonzero MP3 SFX assets.
- 2026-06-22 B6: `npx tsx scripts/test-full-render.ts` passed, final MP4 764079 bytes, 1080x1920, AAC audio, audio/video duration 1.493s/1.500s, nonblack 98.72%, source mean distance 1.48, loudness -13.20 LUFS, no file URL blocking.
## One-Shot Hardening Notes

- 2026-06-22: Full local font hydration is intentionally local and ignored by git. `scripts/hydrate-all-fonts.mjs` hydrates `font-intelligence/extracted-fonts/` into `remotion-app/public/fonts/library/`, writes `font-intelligence/outputs/font-manifest-remapped.json`, and verifies every public path resolves to a nonzero local font file.
- 2026-06-22: Milvus/Zilliz font metadata remapping still requires credentials and a vector-preserving ops run. If `MILVUS_ADDRESS`, `MILVUS_TOKEN`, and `ZILLIZ_API_KEY` are absent, do not regenerate embeddings; use `font-manifest-remapped.json` to update metadata paths while preserving existing vectors.
- 2026-06-22: `CONSOLIDATED.env`, `*.env`, and local font libraries are ignored. `git ls-files` currently reports only `.env.example` as tracked env material.
- 2026-06-22: `InProcessQueue` is volatile process memory. Production durability requires migration to Redis/BullMQ or equivalent before relying on crash recovery or multi-worker leasing.