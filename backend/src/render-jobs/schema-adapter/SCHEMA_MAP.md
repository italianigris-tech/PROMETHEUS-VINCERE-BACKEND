# Render Job Schema Adapter Map

Chunk 1 is intentionally adapter-only. It records the current production contract shape, the Prometheus Jesus v1 target vocabulary, and the first safe utility surface for later translation work.

## Non-breaking constraints

- Do not edit `backend/src/contracts/creative-decision-manifest/index.ts`.
- Do not edit `backend/src/render-jobs/manifest-bridge.ts`.
- Do not edit `packages/shared-types/src/manifest.ts`.
- New adapter code must live under `backend/src/render-jobs/schema-adapter/` until a later chunk deliberately wires it into the bridge.

## Current CreativeDecisionManifest source fields

| Current field | Current meaning | Target/spec-adapter note |
| --- | --- | --- |
| `manifestVersion` | Existing CDM schema version string. | Preserve as source provenance; target spec version can be emitted separately by a future adapter. |
| `jobId`, `sceneId` | Backend job and scene identifiers. | Map directly to adapter identity metadata. |
| `source.videoUrl` | Foreground/source media reference. | Candidate for target asset/video source fields. |
| `source.transcriptSegment.text` | Scene transcript text. | Candidate for target transcript/narrative text. |
| `source.transcriptSegment.startMs/endMs` | Segment timing in milliseconds. | Convert to seconds/frames only through deterministic helpers. |
| `source.transcriptSegment.words[]` | Word timings in milliseconds. | Normalize to safe ordered word timings before render translation. |
| `scene.durationMs` | Scene duration in milliseconds. | Convert to `durationInFrames` via explicit fps; never infer with ad-hoc rounding. |
| `scene.aspectRatio`, `width`, `height`, `fps` | Scene output geometry/timebase. | Target render timebase and viewport inputs. |
| `intent.*` | Rhetorical/emotional intent and intensity. | Candidate for future director/audio/animation decisions. |
| `typography.*` | Font, line plan, core words, pairing. | Candidate for target typography plan; current render bridge only consumes externally supplied `fontUrl`. |
| `animation.*` | GSAP animation family/timing. | Candidate for target text animation grammar/director metadata. |
| `layout.*` | Safe area and positioning plan. | Candidate for target layout/safe-region adapter fields. |
| `renderBudget.*` | Preview/final render constraints. | Candidate for target render policy. |
| `motionDialect` | Optional motion dialect segments. | Candidate for target motion vocabulary and emphasis markers. |
| `style` | Optional requested style/pacing/caption profile. | Candidate for target style profile metadata. |
| `diagnostics` | Manifest provenance, fallbacks, confidence. | Preserve as adapter diagnostics/provenance; do not silently discard. |
| `authority` | Optional truth contract. | Candidate for target authority/runtime guard fields. |

## Current worker RenderManifest fields

| Current render field | Current meaning | Target/spec-adapter note |
| --- | --- | --- |
| `manifestVersion` | Literal `prometheus-render-manifest/v1`. | Existing worker contract; leave unchanged until wiring chunk. |
| `jobId` | Worker render job identifier. | Existing bridge creates a UUID rather than preserving CDM `jobId`. |
| `transcript`, `transcriptWords` | Text and word timings. | Adapter utilities should produce deterministic timing inputs. |
| `directorialMetadata` | Emotional arc, temporal intensity, imperfection, camera strategy, vocabulary. | Closest existing surface for target director intent. |
| `sourceVideoUrl`, `backgroundVideoUrl`, `rvmMatteUrl`, `matteUrl`, `audioUrl`, `fontUrl` | Worker asset URLs. | Asset normalization must remain separate from schema mapping. |
| `durationInFrames`, `fps`, `width`, `height` | Worker timebase and viewport. | Convert from CDM `scene.durationMs/fps/width/height` using shared utilities. |
| Text style fields and `text` object | Troika text rendering controls. | Future Troika single-mesh migration should adapt here without breaking worker defaults. |
| Camera/effect fields | Existing visual runtime controls. | Future target spec can enrich these through adapter output. |
| `matte` | Matte timing and plane settings. | Must stay frame-locked to top-level fps/duration. |

## Known schema gaps for later chunks

1. The pasted target spec expects a `ManifestBridge.translate(cdm)`-style abstraction, while the current bridge exposes `buildRenderManifest(input)` and requires external director notes/assets.
2. Current CDM has rich typography, animation, layout, diagnostics, and authority fields that are not represented one-to-one in the worker manifest.
3. Current worker manifest contains runtime/asset/effect fields that are not present in the CDM and must keep their current defaults.
4. Current bridge generates a new render UUID and does not preserve CDM `jobId` as the render `jobId`.
5. Current time values are mixed (`durationMs`, `durationInFrames`, `fps`, word `startMs/endMs`), so adapter work must centralize conversions.
6. Audio/Joseph orchestration and Troika single-mesh text decisions are not yet schema-backed in the current bridge.

## Chunk 1 adapter foundation

This folder currently provides:

- `types.ts` — non-invasive adapter-domain types, issue codes, and explicit `SpecCDM` / `SpecRenderManifest` target vocabulary for later adapters.
- `utils.ts` — pure helpers for record reads, time conversion, issue creation, and transcript-word normalization.
- `__tests__/utils.test.ts` — focused unit tests for the pure helper behavior.

No production bridge wiring is included in Chunk 1.