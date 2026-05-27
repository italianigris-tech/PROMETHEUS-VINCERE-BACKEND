# Prometheus Cognitive Operating System

Prometheus is backend-governed. The frontend is a render adapter, telemetry display, playback shell, and interaction surface.

## Authority Model

- Backend owns cognition: sequencing, typography, motion, timing, pacing, assets, criticism, and fallback governance.
- Frontend consumes manifests and artifacts only.
- Any failure becomes a visible `CognitiveFailureReport`.
- No subsystem mutates a manifest without `CognitiveGovernor` approval.

## Backend Manifests

- `CreativeDecisionManifest`: canonical creative intent and diagnostics.
- `TemporalStateGraph`: global rhythm, intensity, repetition, escalation, and emotional continuity.
- `TypographyManifest`: backend-selected font contract plus degradation state.
- `RenderManifest`: canonical render dimensions, fps, and duration.
- `PreviewArtifact`: preview URL and diagnostics derived from the render manifest.
- `FrameStateManifest`: deterministic frame state projection.

## Stage Engine

The new `backend/src/cognitive-engine/stages` seam defines isolated stages with:

- `execute()`
- `rollback()`
- `retry()`
- `diagnostics()`
- `healthScore()`

The first implementation, `ArtifactStageEngine`, persists each stage result and converts thrown errors into visible failure reports instead of silent fallbacks.

## Typography Degradation

`TypographyOrchestrator` first uses an injectable vector port. If Zilliz/Milvus fails, it creates a visible degradation report and uses `LocalPremiumFontRegistry` so cinematic font intent remains explicit.

## Future Ports

- `Gpt55CriticPort`: critic only, never renderer.
- `OcularAnalysisPort`: pluggable future visual cognition.
- `UnifiedAssetRegistry`: one asset resolution surface.
- `TimelineIntegrityValidator`: canonical duration and frame-count integrity.
