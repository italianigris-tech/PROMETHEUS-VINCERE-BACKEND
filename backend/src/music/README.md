# Prometheus Music Module

This module is intentionally video-timecoded first.

- The video timeline is the master clock.
- Song time is secondary and only gets mapped after video-time planning decisions are made.
- TypeScript owns Phase 1 planning and orchestration contracts.
- Python will later own heavy analysis via `librosa`, `Essentia`, `pyrubberband`, and `Pedalboard`.
- `backend/src/sound-engine` remains the render bridge for audio execution.
- AI-RemixMate is architectural inspiration for lower-level DJ techniques, not the Prometheus product architecture.
- Phase 1 only establishes data contracts and deterministic skeletons.

## Separation From Sound Engine

The types in this folder stay separate from `SoundDesignManifest` on purpose.

- `VideoAwareAudioPlan` captures video-timecoded music, SFX, ducking, and transition intent.
- `manifest-adapter.ts` is the translation boundary into `SoundDesignManifest`.
- This keeps future video-aware planning richer than the current render manifest without forcing premature coupling.

## Phase 1 Constraints

Phase 1 does not:

- modify the backend runtime pipeline
- call Python analyzers
- call FFmpeg
- mutate catalogs or repositories
- implement the full DJ engine

Phase 1 does:

- define schemas for video-aware planning
- provide safe TypeScript module skeletons
- preserve deterministic placeholder behavior for later replacement
