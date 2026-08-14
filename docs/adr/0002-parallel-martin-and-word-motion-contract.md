# ADR 0002: Parallel Martin windows and compiled word-motion recipes

Status: accepted

## Context

MAUL previously sent every Martin window through one L4 invocation and moved RGB frames through a PNG write/read cycle. Its 53 motion source IDs were also reduced to a small set of transforms, so renderer output did not preserve the intended visual differences.

## Decision

- The Martin batch function is a coordinator, not a GPU worker.
- It verifies and content-addresses the source once, derives a stable cache key per exact source interval and RVM version, then fans windows out to independently scalable L4 workers.
- GPU workers own one window, reuse cached results, and return receipts in request order.
- The primary Remotion render uses duration- and CPU-aware concurrency (bounded at eight); the software-GL recovery path remains single-threaded. Modal allocates eight CPUs per render job and may serve four independent render jobs concurrently.
- RVM decodes RGB through an FFmpeg raw-video stream and encodes the source directly with generated alpha; RGB PNG intermediates are forbidden.
- MediaPipe samples through one FFmpeg downscaled raw-RGB stream. Sequential Python decode/grab and random per-sample seeks are forbidden. Face inference runs at every sampled frame; pose may run at a lower governed frequency with bounded interpolation between successful bracketing observations.
- Word-motion programs own animation transforms only. Visual-treatment fields remain inert until an explicit Declared Composition policy authorizes them; the renderer must not invent capsules, highlights, outlines, shadows, or chromatic accents.
- Letter-source programs execute as staggered letters inside their routed word. Other programs execute word by word. Chunk timing remains the shared composition frame.
- All 53 source capabilities must compile to unique executable recipes. Semantic key/hero words draw from the cinematic-emphasis family; supporting words draw from the supporting family with anti-repetition routing.
- Typography profile choice is deterministic best-fit. Typography is not the primary anti-template axis; future variation belongs mainly to explicitly governed motion graphics, color, sound effects, and other treatment modules.
- Font JSON layer size, color, casing, spacing, shadow, and hierarchy remain authoritative. Layout may uniformly scale the complete composition, but may not independently restyle layers.

## Performance policy

The warm micro-window observation-and-matting path targets 30 seconds or less for a 20-second talking-head input. This is a stage SLO, not a claim that local Chromium/Remotion final encoding is already below 30 seconds. Cache hits should avoid GPU inference entirely.

## Consequences

- More Martin windows increase parallel containers rather than serial GPU wall time.
- Cost remains proportional to selected micro-window duration, with cache reuse across identical source intervals.
- Renderers remain thin: they execute immutable motion recipes and do not choose animation semantics.
- A failed window fails the batch; no flat-text or un-matted visual fallback is silently substituted.
