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

## Ticket Table

| Ticket | Name | Status | Owner | Files | Blockers | Last Updated | Gate |
|---|---|---|---|---|---|---|---|
| T33 | Asset Contract | READY_FOR_REVIEW | Codex | `packages/shared-types/src/asset-resolver.ts`, `backend/src/asset/local-asset-resolver.ts`, `backend/src/asset/local-asset-resolver.test.ts` | None | 2026-06-21 | Browser-safe URL and FFmpeg-safe file path are both present with `assetId`, `contentType`, and `sizeBytes` |
| T34 | Upload To Orchestrator Wiring | NOT_STARTED | Unclaimed | `backend/src/upload-routes.ts`, `backend/src/render-jobs/routes.ts` | T33 | 2026-06-21 | Upload completion creates a Joseph render job with UnifiedRenderManifest |
| T35 | Manifest Unification | READY_FOR_REVIEW | Codex | `backend/src/render-jobs/routes.ts`, `backend/src/__tests__/render-jobs.test.ts`, `apps/worker/src/poller.ts`, `apps/worker/src/poller.test.ts` | None | 2026-06-21 | Worker leases, validates, renders, completes, or fails raw `UnifiedRenderManifest` jobs directly |
| T36 | Vertical Resolution Enforcement | NOT_STARTED | Unclaimed | `remotion-app/src/Root.tsx`, `apps/worker/src/index.ts` | T35 | 2026-06-21 | ffprobe reports 1080x1920 |
| T37 | Browser-Safe Video Serving | IN_PROGRESS | Codex | `backend/src/asset/local-asset-resolver.ts`, `apps/worker/src/poller.ts`, `remotion-app/src/compositions/JosephEdit.tsx`, `remotion-app/src/compositions/VideoPlane.tsx` | T38 full render harness for Chromium log proof | 2026-06-21 | Resolver and fixture side complete; Chromium render log proof remains with full render batch |
| T38 | Manifest To Silent MP4 | NOT_STARTED | Unclaimed | `scripts/test-full-render.ts` | T33-T37 | 2026-06-21 | Silent MP4 exists, >100KB, 1080x1920 |
| T39 | SFX Real Files And Seeded Selection | READY_FOR_REVIEW | Codex | `packages/shared-types/src/unified-render-manifest.ts`, `backend/src/director/joseph-director.ts`, `backend/src/audio/mix-audio.ts`, `remotion-app/public/sfx/`, `scripts/generate-sfx-library.mjs`, `scripts/verify-sfx-library.mjs` | None | 2026-06-21 | Real SFX assets and deterministic variant resolution pass tests |
| T40 | Font Pipeline Hero Set | NOT_STARTED | Unclaimed | `remotion-app/public/fonts/hero/`, `JosephEdit.tsx`, Director | T35 | 2026-06-21 | Deterministic hero font appears in manifest and render |
| T41 | Music Beat Match MVP | NOT_STARTED | Unclaimed | `backend/src/music/`, `backend/src/audio/mix-audio.ts` | T39 | 2026-06-21 | Beat grid fallback and fade-to-duration pass tests |
| T42 | Audio Mix End To End | NOT_STARTED | Unclaimed | `scripts/test-full-render.ts`, audio modules | T39, T41 | 2026-06-21 | Final MP4 has AAC stream and target loudness check |
| T43 | Render Entry Contract | NOT_STARTED | Unclaimed | `remotion-app/src/joseph-entry.tsx`, `remotion-app/src/joseph-bundle.ts` | T35 | 2026-06-21 | Joseph-only bundle entry is under 30 seconds |
| T44 | Full Render Pixel Test | NOT_STARTED | Unclaimed | `scripts/test-full-render.ts`, `scripts/assert-nonblack.ts` | T38 | 2026-06-21 | Extracted frame has >5% non-black pixels |
| T45 | Source Video Visibility Test | NOT_STARTED | Unclaimed | `scripts/test-full-render.ts` | T44 | 2026-06-21 | Source-video pixels are detected, not only text overlay |
| T46 | Production Upload To MP4 Loop | NOT_STARTED | Unclaimed | upload route, render jobs, worker | T33-T45 | 2026-06-21 | POST video returns final MP4 URL |
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

## Assumption Log

- 2026-06-21: FFmpeg is available locally unless proven otherwise.
- 2026-06-21: Synthetic SFX assets are acceptable for MVP if licensing-safe library assets are not already present.
- 2026-06-21: v8.1 brain modules are preserved and only execution seams are deepened.
- 2026-06-21: `packages/shared-types/dist/` is ignored, so agents must run `npm.cmd --prefix packages/shared-types run build` before backend runtime tests that import `@prometheus/shared-types`.
- 2026-06-21: B1 SFX files and B2 asset-resolver changes are coherent Wave 1 work. They should be committed together only after the tracker update and gate commands below are present.
- 2026-06-21: Backend and shared-types currently use different Zod package instances. Render-job validation error formatting is intentionally structural so `UnifiedRenderManifestSchema` errors from shared-types can be reported by backend routes without nominal Zod type coupling.
- 2026-06-21: Legacy bridge jobs remain available for non-Joseph experiments, but Joseph production work must use the unified manifest route.

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
