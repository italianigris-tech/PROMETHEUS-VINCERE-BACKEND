# MAUL Frame-Based Typography Animation Design

## Goal

Make selected MAUL typography treatments authoritative and executable in the canonical Remotion render path. Every transcript word receives an independent, deterministic animation program derived from its timestamp interval, selected typography treatment, and output FPS. The same declared program must be consumed by local preview, server-side Remotion rendering, and the production render adapter.

## Scope

This batch covers the animation stage after transcript chunking and typography/profile realization. It does not replace the current transcript provider, placement planner, MediaPipe observation work, annotations such as circles/highlights, or the existing V1-V3 compatibility adapters.

The current inventory contains 53 executable animation sources: 26 browser/GSAP text presets, 12 Remotion SVG typography variants, and 15 Joseph micro-animation primitives. The 92-entry MAUL treatment vocabulary remains readable for lineage and selection, but a treatment name is not itself an executable renderer instruction.

## Architecture

```text
AssemblyAI word transcript
  -> Semantic Typography Tree / stable token artifact
  -> Typography Profile Realization
  -> scene-aware placement
  -> Frame-Based Typography Motion Compiler (new deep module)
  -> Manifest Compiler
  -> Declared Composition / Unified Render Manifest
  -> Remotion animation adapters
  -> Observed Composition and fidelity evidence
```

### Deep module and seam

The new deep module owns treatment lookup, word-level timing, frame conversion, easing, stagger policy, animation envelopes, and capability validation behind one interface:

```ts
type CompileWordMotionInput = {
  treatmentId: string;
  token: {tokenId: string; text: string; startMs: number; endMs: number};
  outputStartMs: number;
  outputEndMs: number;
  fps: number;
  target: {placementSegmentId: string; layerId?: string};
};

type CompileWordMotionResult = {
  treatmentId: string;
  executorId: string;
  unit: "word" | "letter";
  phases: {entry: FramePhase; hold: FramePhase; exit: FramePhase};
  envelope: {maxTranslateXPx: number; maxTranslateYPx: number; maxScale: number; maxBlurPx: number};
  sourceTokenId: string;
  sourceIntervalMs: {startMs: number; endMs: number};
};
```

The caller must provide valid positive timing and FPS. The module returns frame-indexed phases and rejects unsupported treatment IDs, invalid intervals, zero-length spans, missing executor capabilities, and envelopes that cannot fit the selected placement reservation. It never starts timers, reads wall-clock time, or performs network/I/O work.

### Adapters

The execution registry is the only internal seam for the 53 animation sources:

- SVG adapter delegates the 12 `cinematic_text_preset*` variants to the existing `SvgCaptionOverlay` frame evaluator.
- Joseph adapter delegates the 15 structured micro-animation IDs to their existing render branches.
- GSAP-preset adapter stores the 26 browser preset behaviors as renderer-neutral frame descriptors. It preserves split target, direction, opacity, blur, scale, rotation, translation, and stagger semantics without executing browser GSAP in Remotion.

An adapter must expose capability metadata and an envelope. The compiler chooses the adapter; Remotion only evaluates the returned frame program. No planner, profile renderer, or component may regex-match treatment names to invent mechanics.

## Word-level timing

The planner emits one animation program per stable transcript token. A token's output interval is derived from the authoritative AssemblyAI word interval after the existing editorial timeline mapping. Entry and exit are clamped to the token interval with a readable hold where possible. Very short intervals use a deterministic minimum entry/exit allocation; intervals that cannot contain positive entry, hold, and exit phases are rejected with a structured failure.

At render time, progress is calculated as:

```ts
const frameTimeMs = (frame / fps) * 1000;
const progress = clamp((frameTimeMs - phase.startMs) / (phase.endMs - phase.startMs), 0, 1);
```

The render path is therefore frame-based and deterministic. Time-based browser animation is not part of the canonical Remotion contract.

## Profile-backed typography

`MaulProfileTypographyGroup` receives the same per-word programs and applies them to the independently realized profile layer/token targets. Static profile values remain authoritative: animation may control opacity, transform, blur, clipping, or letter spacing only where the executor declares those capabilities. Animation must not recolor a JSON-declared layer.

The complete profile group continues to use the placement planner's uniform scale and translation. Animation envelopes are reserved before placement and validated again by the Manifest Compiler.

## Failure handling

- Unknown treatment or missing executor: block the selected manifest with treatment ID and source lineage.
- Missing exact font asset: use the existing closest deployed-font fallback only when the font resolver returns a verified receipt; record requested and selected assets.
- Invalid token interval: block the affected word program; do not invent duration from word count.
- Word too short for three phases: use the documented minimum allocation; block if no positive hold remains.
- Unsupported adapter capability: block rather than silently map to `opacity`.
- Envelope exceeds placement reservation: return to placement candidate selection; never clip or shrink without an explicit uniform-fit receipt.
- Remotion asset or font load failure: fail the render manifest and preserve the receipt; never claim successful animation from a fallback font or missing layer.
- AssemblyAI unavailable: the launch proof requires a persisted supplied transcript or a clear transcription failure. It must not silently use prompt-generated words.

## Verification

Tests cross the compiler interface rather than adapter internals:

1. Contract tests compile one word for each of the 53 source IDs and verify a non-empty executor, positive frame phases, source-token lineage, and bounded envelope.
2. Timing tests verify exact frame conversion at 24, 30, and 60 FPS, including sub-frame rounding and short-word rejection.
3. Planner tests verify one program per stable token, no token duplication, and output intervals that match the editorial timeline.
4. Profile renderer tests verify layer colors remain unchanged and each layer receives only its declared target programs.
5. Manifest Compiler tests verify declared animation IDs, executor IDs, hashes, and envelopes survive the planner-to-renderer seam.
6. Remotion render-contract tests verify all supported adapters produce observable frame changes and no unresolved asset references.
7. A real 10-second 9:16 smoke proof uploads the checked-in fixture to AssemblyAI when `ASSEMBLYAI_API_KEY` is present, persists the transcript, compiles the manifest, renders MP4 through the canonical Remotion entrypoint, and emits a manifest/diagnostics sidecar. Offline CI runs the same proof against a persisted timed transcript fixture and never calls a local speech extractor.

## Compatibility and rollout

The new executor is additive. Existing V1-V3 manifests continue through their explicit compatibility adapter. New profile-backed manifests opt into the frame-based program only after compiler parity tests pass. The old string vocabulary and legacy treatment mapping remain readable for replay and migration evidence but are not allowed to reinterpret a new compiled program.

