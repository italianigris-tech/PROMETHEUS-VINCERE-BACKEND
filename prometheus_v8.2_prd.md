# Prometheus v8.2 PRD

Status: Active build plan
Date: 2026-06-21
Authority: `PROMETHEUS_v8.2_ROADMAP.pdf`, `specs/ARCHITECTURE_AUTHORITY.md`, and the locked v8.1 backend brain.

## Problem Statement

Prometheus can now generate deterministic, judgment-backed Joseph edit manifests, but the product loop is not yet proven. The upload path, asset path, Remotion/R3F render path, FFmpeg audio path, font path, and full MP4 verification path must be wired into one observable journey: upload a source video, produce a 1080x1920 Joseph-style MP4, and preserve evidence for replay and future learning.

## Solution

Build v8.2 as the body wiring sprint. Keep the v8.1 brain intact, then add deep modules at the execution seams:

- Asset resolution: one interface that exposes browser-safe URLs and FFmpeg-safe file paths.
- Render job manifest authority: one UnifiedRenderManifest shape from backend job creation to worker render.
- Audio asset resolution: one SFX module that maps semantic cues and seeded variants to concrete audio files.
- Font resolution: one hero-font set selected deterministically by the Director and consumed by JosephEdit.
- Full render proof: one script that proves manifest to silent MP4, audio mix, muxed MP4, vertical resolution, non-black pixels, source video visibility, and AAC audio.

## User Stories

1. As a creator, I want to upload a video and receive a vertical Joseph edit, so that the system delivers a finished short-form artifact rather than only a manifest.
2. As a creator, I want re-uploaded videos to vary intentionally, so that retry feels creative instead of duplicated.
3. As a creator, I want SFX to land on cuts and emphasis words, so that the edit feels designed and kinetic.
4. As a creator, I want music to duck under voice, so that speech remains understandable.
5. As a creator, I want typography to feel intentional, so that the edit does not look like a default template.
6. As an operator, I want every render asset to have both a browser URL and a file path, so that Chromium and FFmpeg do not fight over incompatible media references.
7. As an operator, I want full render tests to inspect the produced MP4, so that success means pixels and audio exist.
8. As an operator, I want failures to be written into evidence and tracker files, so that future agents do not fake progress.
9. As a future agent, I want each batch tracked with assumptions and gates, so that I can resume without re-litigating solved decisions.

## Implementation Decisions

- Preserve `cue` as a semantic SFX category in the manifest. Add variant metadata instead of encoding filenames into `cue`.
- Resolve concrete SFX files inside the audio module. This keeps naming, fallback, missing-file checks, and asset-directory rules local.
- Generate synthetic SFX MP3s for MVP if licensed library assets are unavailable. They must be real nonzero audio files, not stubs.
- Keep v8.1 vertical authority at 1080x1920. Multi-orientation remains outside this PRD unless architecture authority changes.
- Use the existing R3F Joseph composition, but prove it through render tests instead of source-shape tests alone.
- Treat librosa/Essentia as a later enhancement unless a runnable Python bridge and deterministic fixture tests exist. The MVP music path may use FFmpeg-derived or deterministic fallback beat grids.

## Testing Decisions

- Tests must cross public interfaces: Director manifest generation, shared manifest parsing, audio argument building, worker render entry, and full render scripts.
- Audio tests should not mock internal Director helpers. They should generate a manifest and inspect observable SFX variant behavior.
- FFmpeg and ffprobe checks belong in scripts or integration tests. Unit tests may mock process spawning only at the OS process seam.
- Full render proof must assert output dimensions, duration cap, codec presence, nonblack frame, source video visibility, and audio stream.

## Out of Scope

- Distributed workers, Redis/BullMQ, RunPod scaling, and cloud render queues.
- Demucs stem separation and full DJ intelligence beyond render-safe MVP music matching.
- Learned ranking, IRL training loops, and automatic taste updates beyond evidence capture.

## Further Notes

v8.2 is additive. It does not replace the Judgment Layer, Replay Ledger, Evidence Preservation, Sequence Memory, Prompt Governance, or Director Orchestrator built in v8.1. It makes those modules executable in the real render pipeline.
