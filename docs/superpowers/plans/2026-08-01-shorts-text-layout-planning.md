# Shorts Text Layout Planning Grammar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define a reusable, measurable 9:16 text-layout grammar for Maul Shorts and closely related TikTok/YouTube Shorts formats, then validate its first vertical slice with the under-30-second browser preview path before expanding the catalog.

**Architecture:** The planning system will separate semantic chunking, placement, typography treatment, and animation compilation. A deterministic validator will enforce timing, reading, safe-zone, subject-clearance, and animated-bounds constraints. An optional LLM may propose chunk candidates, but the deterministic optimizer and Manifest Compiler remain authoritative. The browser preview harness will measure the same selected manifest used by the Maul composition and will be built immediately after the first small grammar slice, not after a large template catalog.

**Tech Stack:** TypeScript, Zod/shared types, Vitest, Fastify backend planning modules, Remotion Player, Playwright, Markdown domain documentation, existing Maul Planner Audit and Manifest Compiler artifacts.

---

## Decision: Build Order

The grammar contract comes first because the under-30 preview needs a stable manifest shape and explicit layout decisions to measure. The preview harness follows the smallest useful grammar slice, before broad curation.

```text
governed reference pack
  -> grammar contract
  -> deterministic chunk/layout slice
  -> structural tests
  -> under-30 preview timer and visual evidence
  -> human review and planner calibration
  -> expand placement/treatment catalog
```

## Start Here: Exact Execution Order

Do these steps in this order. Do not skip ahead to a large template library.

1. **Define the contract.** Write the 9:16 grammar document and shared types for chunks, placement, treatment, animation bounds, validation findings, and platform profiles. This is planning data only; no browser work yet.
2. **Add the accountability envelope.** Give every planned layout a stable run ID, artifact ID, planner version, input hashes, predicted outcome, confidence, validation findings, and fallback reason. This is a small event shape, not a complete analytics platform.
3. **Build one deterministic vertical slice.** Implement transcript chunking plus exactly three placement families: measured, editorial, and personal. Compile treatment and animation data, then validate it against the 1080x1920 profile.
4. **Prove the planning seam.** Attach that selected layout to the existing Planner Audit, planning bundle, and Manifest Compiler. Add Render Contract Tests so the renderer cannot silently invent a different placement.
5. **Build the under-30 preview harness.** Mount the selected Maul manifest in the browser, expose readiness markers, capture the timer, and record the planned evidence frames. The timer and accountability fields are part of this first end-to-end slice.
6. **Measure before expanding.** Run cold-cache and warm-cache tests. Require the preview to report first-frame latency, assets-ready latency, evidence-ready latency, console/media failures, and the selected layout artifact.
7. **Only then expand.** Add more placement, treatment, and animation variants only when Review Surface findings or Pattern Memory show a real gap.

The answer to “under-30 with accountability or without?” is: **with accountability, but only the minimum useful accountability from the first vertical slice**. We do not build the full analytics system first. We do not build an unmeasured preview first. We build a small grammar slice and a small accountable preview together, then use their results to decide what deserves expansion.

## Compatibility Rule: Extend Before Replacing

This plan does **not** assume that the existing Maul animation approach is wrong. It assumes only that text chunking, placement, treatment, and animation need an explicit handoff so their quality can be measured.

The migration must be non-destructive:

1. Inventory the current Maul caption, motion, crop, and treatment primitives before changing their behavior.
2. Add the new layout grammar as an opt-in planner contract and compile it into the existing Maul manifest seam.
3. Run the planner in shadow mode first: record the new layout decision and predicted bounds while the current renderer remains authoritative.
4. Add Render Contract Tests for each field the current renderer claims to support. Any unsupported field must produce an explicit governed fallback, never silent invention.
5. Enable one placement family at a time and compare preview evidence against the existing behavior.
6. Preserve the current animation primitives when they satisfy the new animation envelope. Replace or add primitives only when evidence shows a real capability gap.
7. Remove an old implicit path only after the new path has equivalent or better Aesthetic Soundness and no unresolved compatibility findings.

The scope is therefore additive: the grammar becomes a planning contract around the current renderer. Camera motion, source segmentation, asset motion, audio choreography, and existing Maul treatments remain separate domains unless a Render Contract Test proves they must change for a selected text layout.

## Reference Pack Rule: Collect Evidence, Not Copies

Before implementation, collect a small governed reference pack for `Reference Trait Extraction`. The samples should teach placement behavior, not reproduce another creator's identity, assets, or exact treatment.

Start with 12–20 references:

- 3–5 measured/centered examples
- 3–5 editorial/left-anchored examples
- 3–5 personal/right-anchored or subject-aware examples
- 3–5 examples with deliberate text-behind-subject or layered type

For each sample, record rights status, source URL or storage identity, aspect ratio, frame rate, approximate text chunks, placement bounds, semantic role, typography treatment, animation behavior, and confidence. Keep full source media outside Git; store only governed metadata, small review proxies/thumbnails, and stable content hashes in the repository or approved object storage.

Do not collect 50 samples per word-count bucket yet. A reference sample is evidence for a reusable trait or constraint. It is not automatically a new template.

Do not create 80 independently curated forms before the first preview measurement. Start with three layout families from the supplied reference direction: `measured`, `editorial`, and `personal`.

## File Map

### Planning grammar

- Create: `docs/architecture/shorts-text-layout-grammar.md`
  - Normative vocabulary for semantic chunks, placement families, typography treatments, animation envelopes, platform profiles, and fallback policy.
- Create: `packages/shared-types/src/shorts-text-layout.ts`
  - Zod schemas and TypeScript types for chunk plans, placement plans, treatment plans, animation envelopes, validation findings, and platform-safe output profiles.
- Modify: `packages/shared-types/src/index.ts`
  - Export the new shared contracts without changing existing manifest field names.

### Reference Corpus intake

- Create: `docs/architecture/shorts-text-layout-reference-pack.md`
  - Intake rules, rights fields, annotation vocabulary, and the first governed sample list.
- Modify: `backend/src/golden-corpus/registry.ts`
  - Register stable reference IDs and extracted traits without embedding large media blobs.
- Modify: `backend/src/__tests__/maul-reference-corpus.test.ts`
  - Prove the reference records preserve rights status, trait annotations, and stable source identity.

### Deterministic Maul planner/compiler

- Create: `backend/src/maul/shorts-text-chunking.ts`
  - Produce deterministic chunk candidates from timed transcript words using semantic boundaries, duration, character count, reading rate, protected pauses, and editorial roles.
- Create: `backend/src/maul/shorts-text-layout-planner.ts`
  - Rank chunk candidates and select placement families using the Editorial Optimization Hierarchy, Sequence Memory, subject clearance, safe zones, and repetition limits.
- Create: `backend/src/maul/shorts-text-layout-validator.ts`
  - Validate selected chunks and animated bounds against 1080x1920 and related 9:16 platform profiles.
- Modify: `backend/src/maul/planning.ts`
  - Attach the selected layout plan to the existing planning bundle and preserve it in the Planner Audit.
- Modify: `backend/src/maul/runtime-contracts.ts`
  - Add the explicit Maul layout-plan handoff used by the Manifest Compiler; do not hide placement decisions in renderer fallbacks.
- Modify: `backend/src/maul/render-engine.ts`
  - Only after the preview slice is proven, pass the compiled layout contract through the existing Maul render path. Do not make full rendering part of ordinary preview.

### Tests for planning and handoff

- Create: `backend/src/maul/shorts-text-chunking.test.ts`
- Create: `backend/src/maul/shorts-text-layout-planner.test.ts`
- Create: `backend/src/maul/shorts-text-layout-validator.test.ts`
- Create: `backend/src/maul/shorts-text-layout-contract.test.ts`
- Modify: `backend/src/__tests__/maul-short-render-path.test.ts`
  - Prove selected placement, treatment, and animation fields survive the planning-to-manifest seam.
- Create: `packages/shared-types/src/shorts-text-layout.test.ts`

### Under-30 preview slice

- Create: `remotion-app/src/web-preview/MaulShortPreview.tsx`
  - Mount the MaulShort composition with a manifest and expose readiness markers for manifest, assets, fonts, first frame, and sampled evidence frames.
- Create: `remotion-app/src/web-preview/__tests__/maul-short-preview.test.tsx`
  - Verify readiness markers, timer events, selected layout metadata, and explicit fallback diagnostics.
- Create: `remotion-app/playwright-maul-short.config.ts`
  - Reuse one warm preview server and isolate Maul timing/screenshot tests from the existing sandbox config.
- Create: `remotion-app/playwright-maul-short.spec.ts`
  - Measure cold and warm first-frame latency, capture hook/payoff/final evidence frames, and assert no browser console/media errors.
- Modify: `remotion-app/src/web-preview/main.tsx`
  - Add the test-only Maul preview route without changing the existing production preview routes.

## Implementation Tasks

### Task 0: Prepare the governed placement reference pack

**Files:** Create `docs/architecture/shorts-text-layout-reference-pack.md`; modify `backend/src/golden-corpus/registry.ts` and `backend/src/__tests__/maul-reference-corpus.test.ts`.

- [ ] Gather 12–20 legally usable or explicitly review-only 9:16 references across measured, editorial, personal, and subject-aware placement families.
- [ ] Record one stable reference ID per sample, rights status, source identity, aspect ratio, frame rate, and content hash.
- [ ] Annotate representative text chunks with start/end timing, semantic role, placement bounds, line count, typography treatment, animation behavior, and annotation confidence.
- [ ] Store only metadata, small review proxies/thumbnails, and hashes in the repository or approved object storage; do not commit large source videos.
- [ ] Write the reference-pack document with the accepted annotation vocabulary and a clear `Reference Trait Extraction` boundary.
- [ ] Add registry tests that reject missing rights status, unstable IDs, and unbounded placement coordinates.
- [ ] Run `npm --prefix backend run test -- src/__tests__/maul-reference-corpus.test.ts` and confirm the governed sample records load deterministically.

### Task 1: Write the normative 9:16 grammar

**Files:** Create `docs/architecture/shorts-text-layout-grammar.md`.

- [ ] Define platform profile fields for width, height, fps, safe zones, maximum lines, and caption timing.
- [ ] Define the order `chunking -> placement -> treatment -> animation -> validation`.
- [ ] Define the three initial placement families: measured, editorial, personal.
- [ ] Define placement fields: anchor, alignment, maximum width, line limit, subject-clearance policy, behind-speaker eligibility, and animation envelope.
- [ ] Define treatment fields: font class, weight, emphasis token, underline/circle/highlight/gradient policy, and contrast requirements.
- [ ] Define named Failure Taxonomy mappings for readability-sacrifice, asset-treatment-mismatch, cheap-template-motion, repetition-fatigue, and sequence-rhythm-collapse.
- [ ] Define deterministic fallback behavior when transcript timing, masks, fonts, or assets are unavailable.

### Task 2: Add shared contracts and red tests

**Files:** Create `packages/shared-types/src/shorts-text-layout.ts`, `packages/shared-types/src/shorts-text-layout.test.ts`; modify `packages/shared-types/src/index.ts`.

- [ ] Write failing schema tests for valid 1080x1920 profiles, chunks, placements, treatments, and animation envelopes.
- [ ] Write failing schema tests for invalid timing, unsafe bounds, unsupported behind-speaker layouts, and missing fallback reasons.
- [ ] Add stable IDs and replay fields so a selected layout can be compared across planner runs.
- [ ] Run `npm --prefix packages/shared-types test` or the package’s configured Vitest command and confirm the new tests fail before implementation.
- [ ] Implement the smallest Zod-backed contracts that make the tests pass.

### Task 3: Implement deterministic chunking

**Files:** Create `backend/src/maul/shorts-text-chunking.ts` and its test.

- [ ] Accept timed transcript words, protected pauses, editorial roles, target duration, and platform profile.
- [ ] Generate candidates at one through eight words only when character count, reading rate, phrase boundaries, and duration permit them.
- [ ] Preserve punctuation and avoid splitting named entities, negations, or semantic units.
- [ ] Return deterministic candidate IDs derived from transcript hash and word indices.
- [ ] Keep any future LLM proposal interface optional and cacheable; never require an LLM for a valid deterministic plan.
- [ ] Run `npm --prefix backend run test -- src/maul/shorts-text-chunking.test.ts` and confirm all chunk constraints pass.

### Task 4: Implement placement and treatment selection

**Files:** Create `backend/src/maul/shorts-text-layout-planner.ts` and its test.

- [ ] Implement only the measured, editorial, and personal families first.
- [ ] Score candidates using comprehension, semantic emphasis, timing fit, safe-zone fit, subject clearance, sequence contrast, and repetition budget.
- [ ] Select typography treatment after placement and expose the chosen treatment as data, not renderer-side inference.
- [ ] Reserve animated bounds before animation compilation so overshoot cannot invalidate placement silently.
- [ ] Record rejected candidates and reasons in the Planner Audit.
- [ ] Run `npm --prefix backend run test -- src/maul/shorts-text-layout-planner.test.ts`.

### Task 5: Add validation and Manifest Compiler handoff

**Files:** Create `backend/src/maul/shorts-text-layout-validator.ts`; modify `backend/src/maul/planning.ts` and `backend/src/maul/runtime-contracts.ts`; add the listed contract tests.

- [ ] Validate reading duration, line count, character width, safe zones, subject overlap, animated bounds, font availability, and supported media capabilities.
- [ ] Emit blocking, major, and advisory findings using the existing Judgment Layer vocabulary.
- [ ] Attach the selected layout plan to the existing planning bundle and Planner Audit.
- [ ] Make the Manifest Compiler the only module allowed to translate planner intent into renderer-facing layout fields.
- [ ] Add Render Contract Tests proving selected placement and treatment produce observable MaulShort behavior or an explicit governed fallback.
- [ ] Run `npm --prefix backend run test -- src/maul/shorts-text-layout-contract.test.ts src/__tests__/maul-short-render-path.test.ts`.

### Task 6: Build the under-30 Maul preview slice

**Files:** Create the listed preview component, tests, Playwright config, and spec; modify `remotion-app/src/web-preview/main.tsx`.

- [ ] Mount the same MaulShort composition and manifest used by the planner handoff.
- [ ] Use browser-safe cached assets and expose readiness events: manifest-ready, assets-ready, fonts-ready, first-frame-painted, and evidence-ready.
- [ ] Start the timer before manifest request and record cold-cache and warm-cache timings separately.
- [ ] Capture planned frames from the selected hook, transition, payoff, and final beats rather than fixed arbitrary frames.
- [ ] Run `npm --prefix remotion-app run test -- src/web-preview/__tests__/maul-short-preview.test.tsx`.
- [ ] Run `npm --prefix remotion-app exec playwright test --config playwright-maul-short.config.ts`.
- [ ] Require p95 warm first-frame readiness under 10 seconds and p95 cold readiness under 30 seconds before expanding the catalog.

### Task 7: Expand the catalog only from measured review outcomes

**Files:** Modify `docs/architecture/shorts-text-layout-grammar.md`; add placement/treatment data only in the shared contract or a dedicated catalog module after the first slice passes.

- [ ] Add new archetypes only when a Review Surface failure or repeated creator preference demonstrates a real gap.
- [ ] Store outcomes in Pattern Memory, not in the planner prompt alone.
- [ ] Compare planner predictions with human pairwise review and independent Judgment Layer results.
- [ ] Maintain a holdout set so new layout rules cannot overfit prior reviews.
- [ ] Reject catalog growth that increases repetition, review latency, or preview failure rate without measurable Aesthetic Soundness improvement.

## Completion Criteria

- [ ] Every short-form profile in scope uses the same chunking, placement, treatment, animation, and validation vocabulary.
- [ ] MaulShort receives explicit layout decisions through the Manifest Compiler.
- [ ] No renderer fallback silently invents placement or treatment.
- [ ] The first three placement families pass structural tests and the under-30 preview timing gate.
- [ ] Preview evidence identifies which planned layout was shown and which artifacts produced it.
- [ ] Planner Audit, Review Surface feedback, Pattern Memory, and Judgment Layer results can be joined by stable run and artifact IDs.
- [ ] The catalog expands only after measured visual outcomes justify it.
