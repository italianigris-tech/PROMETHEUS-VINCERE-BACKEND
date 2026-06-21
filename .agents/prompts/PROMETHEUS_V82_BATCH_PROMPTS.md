# Prometheus v8.2 Batch Prompts

## Operating Rule

Work in vertical batches. Before starting a batch, update `PROMETHEUS_v8.2_BUILD.md` to mark the batch `IN_PROGRESS`. After finishing, update the gate evidence and status. Do not mark a batch complete without runnable verification.

## B1 - SFX Real Files And Seeded Selection

Implement only the SFX slice.

Requirements:

- Keep SFX `cue` values semantic.
- Add deterministic variant metadata from 1 to 5.
- Generate or preserve 40 real nonzero MP3 files under `remotion-app/public/sfx/`.
- Audio resolver maps `(cue, variant)` to concrete files.
- Missing requested variants fall back deterministically to variant 1.
- Missing semantic cue throws a visible SFX error.
- Tests prove same seed selects the same variants and different seeds can vary.

Forbidden:

- Do not edit upload routing.
- Do not edit render-job queue behavior.
- Do not change vertical authority.
- Do not add hidden randomness.

## B2 - Asset Contract And Browser-Safe Video

Implement asset resolution only.

Requirements:

- Shared MediaReference contract.
- Local asset resolver returns browser-safe URL and absolute file path.
- Copy-to-public mode is default.
- HTTP server mode is optional.
- Browser URL must never be `file:///` or `C:/...`.

## B3 - Manifest Unification And Silent Render

Implement the backend-to-worker manifest path only.

Requirements:

- Backend stores UnifiedRenderManifest.
- Worker validates UnifiedRenderManifest at entry.
- Silent render emits 1080x1920 MP4 from a fixture.
- Full render test starts as a script, then can become CI once stable.
