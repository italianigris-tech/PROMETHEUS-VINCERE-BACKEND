# Cognitive Engine Migration Notes

This migration moves Prometheus toward one backend authority and one frontend projection surface.

## Immediate Migration Targets

1. Replace direct calls to `processJobPipeline()` with `ArtifactStageEngine`.
2. Wrap existing source analysis, transcript, metadata, semantic intent, temporal planning, typography, motion, asset retrieval, preview artifact, render manifest, and critic steps as `CognitiveArtifactStage` adapters.
3. Convert `withGroqFallback()` into a failure-reporting adapter that returns `CognitiveFailureReport` instead of silent deterministic downgrade.
4. Emit `CreativeDecisionManifest` before any frontend preview state is built.
5. Make frontend previews consume `PreviewArtifact` and `RenderManifest` only.

## Deletion Targets

- Frontend Groq inference.
- Frontend typography intelligence.
- Frontend sequencing or aesthetic mutation.
- Hidden fallback paths that do not emit degradation diagnostics.
- Render-time font readiness checks inside React components.

## Diagnostics Contract

Every stage must persist:

- stage output
- `StageDiagnostics`
- `CognitiveFailureReport[]`
- confidence
- schema health
- latency
- retry count
- fallback activation state

## Frontend Projection Rule

The frontend may display:

- manifests
- artifacts
- telemetry
- failure reports
- playback state

The frontend may not create or mutate:

- typography intent
- motion intent
- pacing intent
- caption emphasis
- transition logic
- creative scoring
