# PROMETHEUS PHASE 7.5 — THE UNICORN LEARNING LAYER

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PROMETHEUS PHASE 7.5                            │
│                    ┌─────────────────────────┐                          │
│                    │   PRIMITIVE REGISTRY    │                          │
│                    │   (The Asset Library)   │                          │
│                    └───────────┬─────────────┘                          │
│                                │                                        │
│    ┌───────────────────────────┼───────────────────────────┐             │
│    │                           │                           │             │
│    ▼                           ▼                           ▼             │
│ ┌──────────┐            ┌──────────────┐            ┌──────────────┐     │
│ │ LEARNING │            │   DIRECTOR   │            │   WORKER     │     │
│ │ PIPELINE │◄──────────►│ COMPOSITION  │◄──────────►│  EXECUTION   │     │
│ │(Ingestion)│           │   ENGINE     │            │   ENGINE     │     │
│ └──────────┘            └──────────────┘            └──────────────┘     │
│        │                       │                           │           │
│        ▼                       ▼                           ▼           │
│ ┌──────────────┐      ┌─────────────────┐      ┌─────────────────────┐ │
│ │ Reference    │      │ Scene Archetype │      │ Three.js / R3F /    │ │
│ │ Video Frames │      │   Templates     │      │ Troika / GSAP       │ │
│ └──────────────┘      └─────────────────┘      └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Path | Description |
|---|---|---|
| `@prometheus/registry` | `packages/registry` | Primitive Registry — schemas, storage, query API |
| `@prometheus/bridge` | `packages/bridge` | Composition Engine — validates & compiles DCL manifests |
| `@prometheus/learning` | `packages/learning` | Learning Pipeline — frame analysis, forging, validation |

## Seed Primitives (5)

| ID | Category | Scope | Fixes Qwen Failure |
|---|---|---|---|
| `chrome-text-v1` | material | per-element | Flat 3D text (MeshStandardMaterial + envMap) |
| `per-word-stagger-v1` | motion | per-element | Per-word micro-choreography |
| `chromatic-aberration-per-element-v1` | shader-fx | per-element | Full-screen CA destroying background |
| `bloom-v1` | shader-fx | full-screen | Dead pipeline placeholder |
| `pill-stack-v1` | ui-element | per-group | Missing UI components |

## Seed Archetype

| ID | Source | Primitives |
|---|---|---|
| `archetype-chrome-manifesto` | Victor Ajayi Reel | chrome-text + per-word-stagger + CA (per-element) + bloom + pill-stack |

## Key Files

- `packages/registry/src/types.ts` — Core TypeScript schemas
- `packages/registry/src/validators.ts` — Zod runtime validation
- `packages/registry/src/registry.ts` — In-memory registry with persistence
- `packages/bridge/src/composition-engine.ts` — DCL manifest compiler
- `packages/bridge/src/scope-validators.ts` — Spatial reasoning enforcement
- `packages/learning/src/frame-analyzer.ts` — Vision analysis interface
- `packages/learning/src/primitive-forger.ts` — Code generation template
- `packages/learning/src/validation-forge.ts` — Anti-Pattern #2 enforcement
- `packages/learning/src/registry-commit.ts` — Human review gate

## Anti-Patterns Enforced

1. **No Global Passes for Per-Element Effects** — Scope validation blocks full-screen CA on text layers
2. **No Placeholder Implementations** — ValidationForge rejects any primitive without a working test scene
3. **No Unlit 3D Text** — `chrome-text-v1` requires MeshStandardMaterial + envMap
4. **No Verbal Claims Without Provenance** — Registry is single source of truth
5. **No Full-Screen Post-Process on Video Backgrounds** — CompositionEngine blocks this automatically
6. **No Breaking Phase 6/7 Tests** — All existing tests remain intact

## Model Assignment Matrix

| Task | Model | Status |
|---|---|---|
| Registry scaffolding | Qwen 3.6 Max Preview | ✅ Complete |
| Composition engine | Claude 3.5 Sonnet | ✅ Complete (interface) |
| Visual primitive authoring | GPT-5.5 / O1 | ⏳ Ready for assignment |
| Frame analysis | GPT-5.5 / O1 Vision | ⏳ Ready for assignment |
| Shader GLSL | Claude 3.5 Sonnet | ⏳ Ready for assignment |

## Next Steps

1. **Assign Claude 3.5** to implement the CompositionEngine's `buildScene()` and `buildTimeline()` methods
2. **Assign GPT-5.5 / O1** to author the first auto-extracted primitive from a new reference video
3. **Provide next reference video** to test the end-to-end learning pipeline
4. **Phase 7.5D**: Expand to 20+ primitives, 5 archetypes, visual diff tool

## Unicorn Studio Research

See `UNICORN_STUDIO_RESEARCH.md` for detailed analysis of their effect taxonomy, layer system, parameter panels, and performance pipeline. Prometheus 7.5 maps directly to their architecture:
- **Primitive** = Unicorn Layer
- **ParameterSchema** = Unicorn Parameter Panel
- **Scope** = Unicorn Mask
- **TimelineSegment** = Unicorn Keyframe Timeline
- **PerformanceProfile** = Unicorn Pipeline Metrics
- **CompositionManifest** = Unicorn JSON Export

---

**Status:** Phase 7.5A + 7.5B Foundation Complete. Ready for 7.5C learning pipeline test.
**Date:** 2026-06-06
