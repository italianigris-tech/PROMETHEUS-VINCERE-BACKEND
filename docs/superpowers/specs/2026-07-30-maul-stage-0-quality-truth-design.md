# MAUL Stage 0 Quality Truth Design

## Goal

Complete Stage 0 of `MAUL Basics.md` with an enforceable, fast quality gate. Technical render success must never imply aesthetic success, S4, or release approval. Known human-visible failures must be rejected before render and recorded with inspectable evidence.

## Scope

Stage 0 covers deterministic checks for:

- caption bounds;
- forbidden or silent system-font fallback;
- unsafe crop or masking state;
- zoom restarts caused by implementation-segment boundaries;
- unknown or unsupported animation primitives;
- selected manifest behavior that silently falls back without evidence.

Rendered pixel/audio analysis, full capability conformance, perceptual criticism, and reference-family scoring remain in later MAUL stages.

## Architecture

Add a pure `QualityTruthGate` between the Manifest Compiler and renderer. It consumes only the compiled Unified Short Render Manifest and declared runtime proof. It returns every detected failure in one result.

The render service runs the gate before invoking Remotion. Any critical failure blocks render. The result is stored in the project audit so an operator can reconstruct what failed and why. Existing post-render release gates remain independent and cannot be bypassed by this preflight passing.

## Contract

Input contains:

- compiled manifest identity and replay key;
- resolved caption geometry;
- font selection and load/fallback proof;
- selected primitive IDs and runtime capability classifications;
- crop, matte, and masking decisions;
- camera events across source and implementation segments;
- explicit governed-fallback records and evidence pointers.

Output contains:

- status: `pass` or `blocked`;
- named failure classes;
- affected manifest field or time range;
- human-readable reason;
- evidence pointer or explicit missing-evidence marker.

Missing mandatory proof fails closed. Failures are specific; no generic `bad_quality` result is allowed.

## Integration

1. Manifest Compiler emits the complete input required by the gate.
2. Render service evaluates the compiled manifest.
3. Blocked results skip renderer invocation and enter the audit.
4. Passing results permit technical rendering only.
5. Rendered evidence and authenticated post-render human approval remain required for release.

## Test Strategy

Use red-green-refactor. Add one focused failing test per failure class before production changes. Tests exercise real compiled manifest data where practical.

Keep a quarantined negative fixture representing the known failed MAUL baseline. It must fail automatically for named, human-visible reasons. Focused MAUL tests, shared contract tests, and relevant typechecks must pass before Stage 0 is complete.

## Plan Tracking

`MAUL Basics.md` will receive a compact status/evidence entry for each completed stage. Stage 0 may be marked complete only when all named regressions pass and the negative baseline is rejected. File paths and test names are evidence; lengthy duplicated reports are not.

## Reference Images

The 19 supplied images are reference-only. Their reusable traits include editorial serif and bold sans contrast, warm cinematic lighting, strong subject/text hierarchy, asymmetric negative space, and restrained overlays. Their pixels, creator identities, and exact compositions are forbidden from export. Trait use belongs primarily to Stage 9 and later perceptual proof, not this Stage 0 gate.

## Non-Goals

- claiming cinematic quality from deterministic preflight;
- implementing Stage 3 animation conformance;
- implementing Stage 9 treatment identity;
- implementing Stage 10 rendered perceptual judgment;
- exporting any supplied reference pixels.
