# MAUL Scene-Aware Text Placement Tracer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one testable 1080x1920 MAUL tracer that turns governed transcript words into standalone chunk and scene-aware placement artifacts, compiles both into the render manifest, and makes Remotion execute the planned layout.

**Architecture:** Model output remains limited to semantic chunk proposals. A deterministic adapter gives each word stable identity; a deterministic planner intersects chunks with timeline/shot discontinuities, generates only `measured`, `editorial`, and `personal` candidates, hard-gates them, and selects a stable sequence. New V2 Planning Bundles contain 16 governed artifacts while persisted V1 bundles remain valid at 14 and enter only through an explicit legacy adapter; renderer consumes boxes and lines without making placement decisions.

**Tech Stack:** TypeScript, Zod, Vitest, Fastify service artifacts, Remotion/React, existing MAUL Planning Bundle and Unified Short Render Manifest.

---

## Scope

Implements delivery slices 1-2 from approved design. Production MediaPipe, PySceneDetect/PyAV extraction, field/OCR/saliency providers, numeric animation, expressive treatment, and twelve-family catalog are excluded. Missing subject/cut evidence is `unknown`; it may use only a precompiled `caption_safe_fallback` whose text band contains no source pixels, or return a blocked result.

## File Map

- Modify `packages/shared-types/src/shorts-text-chunking.ts` and test: ordered/unique emphasis prerequisite.
- Create `packages/shared-types/src/maul-text-placement.ts` and test: V2 chunk and placement core contracts.
- Modify `packages/shared-types/src/maul.ts`, test, and `index.ts`: MAUL wrappers, artifacts, V1/V2 bundle/manifest unions.
- Modify `backend/src/maul/shorts-text-chunking.ts` and test: proposal rejection prerequisite.
- Create `backend/src/maul/text-chunk-plan.ts` and test: stable-token V1-to-V2 adapter.
- Create `backend/src/maul/shorts-text-placement.ts` and test: intervals, candidates, hard gates, selection.
- Modify `backend/src/maul/planning.ts`, test, `service.ts`, and render-path test: registration, lineage, compilation.
- Modify `backend/src/maul/routes.ts` and `backend/src/maul/runtime-contracts.ts`: governed artifact ownership and V2 handoff declaration.
- Modify `backend/src/maul/quality-truth.ts` and test: compare rendered boxes to planned segments.
- Modify `remotion-app/src/compositions/MaulShort.tsx` and test: shared joining, source mapping, planned layout.
- Create `remotion-app/src/compositions/MaulPlannedTextLayer.tsx` and test: execution-only text renderer.
- Create `remotion-app/src/compositions/maul-short-manifest-adapter.ts`: strict V1 adapter and V2 fail-closed normalization.
- Create `remotion-app/src/web-preview/MaulPlacementTracer.tsx`, route tests, and Playwright config/spec: rendered three-family geometry proof.

## Fixed Names

```ts
maulShortsTextChunkPlanV2CoreSchema
maulTextChunkPlanPayloadSchema
maulTextPlacementPlanCoreSchema
maulTextPlacementPlanPayloadSchema
maulPlanningBundleV2PayloadSchema
maulUnifiedShortRenderManifestV2Schema
materializeMaulTextChunkPlanV2
buildMaulTextPlacementPlan
hashMaulPlanPayload
adaptMaulLegacyPlanningBundleV1
buildMaulPlannedCaptionSegments
```

V2 Bundle keys: `textChunk`, `textPlacement`. Artifact and execution types: `text_chunk_plan`, `text_placement_plan`. V1 schemas retain their existing 14 keys and executions unchanged.

### Task 1: Fix Chunking And Renderer Prerequisites

**Files:**
- Modify: `packages/shared-types/src/shorts-text-chunking.test.ts`
- Modify: `packages/shared-types/src/shorts-text-chunking.ts`
- Modify: `backend/src/maul/shorts-text-chunking.test.ts`
- Modify: `backend/src/maul/shorts-text-chunking.ts`
- Modify: `remotion-app/src/compositions/__tests__/MaulShort.test.ts`
- Modify: `remotion-app/src/compositions/MaulShort.tsx`

- [ ] **Step 1: Write emphasis-order red tests**

Pass `[2, 0, 2]` through shared schema and `materializeShortsTextChunkProposal`; require `/ordered.*unique|unique.*ordered/i`. Keep valid `[7, 8]`.

- [ ] **Step 2: Verify red**

Run: `npm --prefix packages/shared-types test -- src/shorts-text-chunking.test.ts && npm --prefix backend test -- src/maul/shorts-text-chunking.test.ts`

Expected: new tests fail because reordered/duplicate emphasis passes.

- [ ] **Step 3: Implement strict monotonic indices**

In schema refinement and materializer, compare each index to previous; reject when `current <= previous` with `Emphasis word indices must be ordered and unique.`

- [ ] **Step 4: Write renderer red tests**

```ts
expect(joinMaulCaptionTokens([
  {text: "(", fromMs: 0, toMs: 20},
  {text: "hello", fromMs: 20, toMs: 200},
  {text: ")", fromMs: 200, toMs: 220},
])).toBe("(hello)");
expect(buildMaulSourceSequences(compressedTimeline, 30)[0]).toMatchObject({
  durationInFrames: 15, trimBefore: 0, trimAfter: 30, playbackRate: 2,
});
expect(() => resolveMaulCaptionPlans(MAUL_SHORT_DEFAULT_PROPS.manifest)).not.toThrow();
```

- [ ] **Step 5: Verify renderer red**

Run: `npm --prefix remotion-app test -- src/compositions/__tests__/MaulShort.test.ts`

Expected: punctuation differs; `playbackRate` and resolver absent.

- [ ] **Step 6: Implement renderer prerequisites**

Delegate `joinMaulCaptionTokens` to shared `joinShortsTextTokens`. Return `playbackRate = sourceDuration / outputDuration` and pass it to `Video`. Add `resolveMaulCaptionPlans` returning empty groups plus `false` for Studio fixture without Typography Motion.

- [ ] **Step 7: Verify and commit**

Run all three focused suites above. Expected: pass.

```bash
git add packages/shared-types/src/shorts-text-chunking.ts packages/shared-types/src/shorts-text-chunking.test.ts backend/src/maul/shorts-text-chunking.ts backend/src/maul/shorts-text-chunking.test.ts remotion-app/src/compositions/MaulShort.tsx remotion-app/src/compositions/__tests__/MaulShort.test.ts
git commit -m "fix(maul): close chunking and playback prerequisites"
```

### Task 2: Add Standalone V2 Chunk And Placement Contracts

**Files:**
- Create: `packages/shared-types/src/maul-text-placement.ts`
- Create: `packages/shared-types/src/maul-text-placement.test.ts`
- Modify: `packages/shared-types/src/maul.ts`
- Modify: `packages/shared-types/src/maul.test.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: Write core-schema red tests**

Create valid two-token V2 chunk and one-segment placement fixtures. Assert rejection for duplicate token IDs, non-exact coverage, emphasis outside chunk, box outside `[0,1]`, line token loss/reordering, selected `fail`/`unknown` gates, executable behind-subject depth, and blocked plan without reason. Extend Quality Truth V2 proof fixtures with placement plan/segment IDs, composition variant/transform hash, compatibility profile/fingerprint, exact font asset, and compiled legibility primitive.

```ts
expect(maulShortsTextChunkPlanV2CoreSchema.parse(chunkCore).chunks[0]!.tokenIds)
  .toEqual(["token_a", "token_b"]);
expect(maulTextPlacementPlanCoreSchema.parse(placementCore).segments[0]!.family)
  .toBe("measured");
```

- [ ] **Step 2: Verify red**

Run: `npm --prefix packages/shared-types test -- src/maul-text-placement.test.ts`

Expected: module missing.

- [ ] **Step 3: Implement core schemas**

Chunk core contains schema/version/hashes, duration, pacing/style/strategy, ordered tokens, ordered chunks, exact coverage, protected entities/pauses, inference, and input hashes. Token fields: stable ID, authoritative transcript index, text, source interval, ordered non-overlapping output spans, and covering output interval. Chunk fields: IDs, token IDs, output interval, semantic role, emphasis token IDs/text/level, pause-hold flag, rationale, confidence.

Placement core contains chunk artifact ID/hash, catalog and score policy, normalized platform profile, fixture-driven Output Composition intervals, `planned|blocked`, blocking reason, and segments. Every composition interval declares variant ID, output interval, transform hash, source viewport, source occupancy, padded non-source regions, crop/scale, and discontinuity ID. Segment fields: stable chunk/scene/discontinuity IDs, output interval, selected composition variant/transform hash, exact lines, family/variant, normalized box/envelope, alignment, compatibility metrics, front/deferred depth, minimum legibility primitive, hard gates, named scores, rationale, confidence, fallback code.

- [ ] **Step 4: Write MAUL wrapper and compatibility red tests**

Require both artifact kinds, V2 Bundle/manifest keys, exactly 16 unique V2 executions, and Typography Motion V2 chunk/placement artifact ID plus hash references. Also parse an unchanged 14-plan V1 Bundle, V1 manifest, and V1 Typography Motion fixture to prove persisted artifacts remain readable.

- [ ] **Step 5: Verify red**

Run: `npm --prefix packages/shared-types test -- src/maul.test.ts`

Expected: new artifact types and Bundle keys rejected.

- [ ] **Step 6: Wire versioned wrapper contracts**

Merge cores with `maulPlanBaseSchema`. Add artifact enums/unions/create requests. Preserve existing Typography Motion V1, Planning Bundle V1, and Unified Manifest V1 schemas exactly. Add V2 siblings: Typography Motion V2 has four chunk/placement ID/hash reference fields; Bundle/manifest V2 add both plans, execution values, cross-check, and exact length 16. Export discriminated V1/V2 unions under existing public parse entry points.

- [ ] **Step 7: Export, verify, commit**

Run: `npm --prefix packages/shared-types test -- src/maul-text-placement.test.ts src/shorts-text-chunking.test.ts src/maul.test.ts && npm --prefix packages/shared-types run typecheck`

Expected: pass.

```bash
git add packages/shared-types/src/maul-text-placement.ts packages/shared-types/src/maul-text-placement.test.ts packages/shared-types/src/maul.ts packages/shared-types/src/maul.test.ts packages/shared-types/src/index.ts
git commit -m "feat(maul): add governed chunk and placement contracts"
```

### Task 3: Implement V2 Materialization And Three-Family Planner

**Files:**
- Create: `backend/src/maul/text-chunk-plan.ts`
- Create: `backend/src/maul/text-chunk-plan.test.ts`
- Create: `backend/src/maul/shorts-text-placement.ts`
- Create: `backend/src/maul/shorts-text-placement.test.ts`

- [ ] **Step 1: Write materialization red tests**

Given source words, mapped output spans, V1 plan, and timeline hash: require stable replay IDs, original indices, both timelines, exact chunk/emphasis token references, and rejection of unapproved Protected Pause bridging. Replace the existing cut-spanning-word rejection expectations in `backend/src/maul/planning.test.ts` with acceptance regressions: one logical word/stable token, two ordered non-overlapping output spans, and two adjacent Layout Segments retaining the same token ID without duplicating token coverage.

- [ ] **Step 2: Verify red**

Run: `npm --prefix backend test -- src/maul/text-chunk-plan.test.ts`

Expected: exports missing.

- [ ] **Step 3: Implement materialization**

Generate `token_<24 hex>` from SHA-256 of transcript hash plus authoritative word index. Hash V1/timeline with `hashMaulPlanPayload`. Reconstruct text through `joinShortsTextTokens`; parse final payload with shared schema.

- [ ] **Step 4: Write placement red tests**

In `shorts-text-placement.test.ts`, cover centered/left/right subject fixtures; chunk crossing source cut; removed-time join; same-scene dropout; unknown cut evidence; no fit; reversed candidate iteration. Require no segment across reset, x=.25 -> x=.75 never x=.50, exact line coverage, three-family membership, stable tie-break.

- [ ] **Step 5: Implement intervals and candidates**

Change `mapMaulTranscriptWordsToOutput` to intersect a source word with every kept map segment, preserving one logical word plus ordered output spans even when a cut occurs inside it. Intersect chunk, mapped shot, non-cut timeline, composition, and residual-reset spans using half-open intervals. Generate only `measured`, `editorial`, `personal`; partition lines semantically without token changes.

Use pinned compatibility profile `maul-compat-dm-sans-v1`: exact family `DM Sans`, asset `font_google_dm_sans_700`, weights 500/700/800, loaded DM Sans fallback, measured conservative glyph/line metrics, and fingerprint. Add compile rejection when Typography Motion selects another asset/family or exceeds reserved metrics.

- [ ] **Step 6: Implement gates and sequence selection**

Hard-reject unsafe envelope, font-size failure, token mismatch, known collision, subject-aware use with unknown evidence, font/profile unavailability, and executable behind-depth. Rank survivors by named dimensions; apply same-scene continuity/anti-repetition; reset geometry penalties at discontinuities. Unknown evidence may use only `caption_safe_fallback.padded_band_v1`, whose planned box lies wholly inside a compiled non-source band; otherwise emit `blocked_no_readable_dialogue_candidate`. Composition choice persists for each continuity scene.

- [ ] **Step 7: Verify and commit**

Run: `npm --prefix backend test -- src/maul/text-chunk-plan.test.ts src/maul/shorts-text-placement.test.ts && npm --prefix backend run typecheck`

Expected: pass.

```bash
git add backend/src/maul/text-chunk-plan.ts backend/src/maul/text-chunk-plan.test.ts backend/src/maul/shorts-text-placement.ts backend/src/maul/shorts-text-placement.test.ts
git commit -m "feat(maul): plan scene-aware text placement"
```

### Task 4: Register 16 Artifacts And Compile Manifest

**Files:**
- Modify: `backend/src/maul/planning.ts`
- Modify: `backend/src/maul/planning.test.ts`
- Modify: `backend/src/maul/service.ts`
- Modify: `backend/src/__tests__/maul-short-render-path.test.ts`
- Modify: `backend/src/maul/routes.ts`
- Modify: `backend/src/maul/runtime-contracts.ts`
- Modify: `backend/src/maul/quality-truth.ts`
- Modify: `backend/src/maul/quality-truth.test.ts`

- [ ] **Step 1: Write orchestration red tests**

Require standalone artifact types, V2 16-key Bundle, V2 stable tokens, Typography Motion references, placement segments, and 16 manifest executions. Mutate referenced payload after captured hash and require `/hash|stale|mismatch/i`. Feed an unchanged V1 Bundle through `adaptMaulLegacyPlanningBundleV1` and require an explicit conservative placement projection rather than silent renderer fallback.

- [ ] **Step 2: Verify red**

Run: `npm --prefix backend test -- src/maul/planning.test.ts src/__tests__/maul-short-render-path.test.ts`

Expected: 14-artifact assumptions fail.

- [ ] **Step 3: Register dependency order**

Keep V1 LLM result internal. Materialize/register chunk; build/register placement; build/register existing 14 plans with both IDs/hashes. Standalone plans are parents of dependent plans; all 16 are Bundle parents.

- [ ] **Step 4: Load and validate at render**

Resolve both by Bundle ID. Verify type, lineage, placement-to-chunk ID/hash, Typography Motion ID/hash, and current payload hashes. Missing/mismatch throws `MaulLineageConflictError` before renderer.

For an explicitly versioned V1 Bundle, call `adaptMaulLegacyPlanningBundleV1`: validate nested chunk parity, materialize conservative standalone plans, and record adapter provenance. Never adapt malformed V2 data.

- [ ] **Step 5: Compile manifest**

Include both payloads and compiled Output Composition intervals; add native executions `MaulShort.PlannedCaptionTokens.v1` and `MaulShort.PlannedPlacement.v1`; include hashes in replay key; retain 1080x1920/30. Compiler verifies selected DM Sans asset/fingerprint against placement reservations and fails closed on mismatch.

Add both new artifact types to `GOVERNED_RUNTIME_ONLY_ARTIFACT_TYPES`. Extend runtime-contract ownership text so deterministic planner owns placement and manifest compiler owns renderer handoff.

Extend proof records with placement plan/segment ID, composition variant/interval/transform hash, compatibility profile/fingerprint, exact font asset, and legibility primitive. Make Quality Truth compare measured box to planned maximum envelope; crop proof to selected composition; font proof to DM Sans profile; primitive proof to compiled minimum. Old adapter-safe-region proof alone cannot validate V2.

- [ ] **Step 6: Verify and commit**

Run: `npm --prefix backend test -- src/maul/planning.test.ts src/maul/quality-truth.test.ts src/__tests__/maul-short-render-path.test.ts && npm --prefix backend run typecheck`

Expected: pass.

```bash
git add backend/src/maul/planning.ts backend/src/maul/planning.test.ts backend/src/maul/service.ts backend/src/__tests__/maul-short-render-path.test.ts backend/src/maul/routes.ts backend/src/maul/runtime-contracts.ts backend/src/maul/quality-truth.ts backend/src/maul/quality-truth.test.ts
git commit -m "feat(maul): compile placement through planning bundle"
```

### Task 5: Execute Planned Layout In Remotion

**Files:**
- Create: `remotion-app/src/compositions/MaulPlannedTextLayer.tsx`
- Create: `remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx`
- Create: `remotion-app/src/compositions/maul-short-manifest-adapter.ts`
- Modify: `remotion-app/src/compositions/MaulShort.tsx`
- Modify: `remotion-app/src/compositions/__tests__/MaulShort.test.ts`

- [ ] **Step 1: Write render-contract red tests**

Require normalized `{x:.1,y:.2,width:.6,height:.15}` -> `{leftPx:108,topPx:384,widthPx:648,heightPx:288}`, planned line/token order, family/variant/fallback metadata, compiled legibility primitive, and two crop centers for a crop change at 500ms.

- [ ] **Step 2: Verify red**

Run: `npm --prefix remotion-app test -- src/compositions/__tests__/MaulShort.test.ts`

Expected: planned segment compiler/time-varying crops absent.

- [ ] **Step 3: Implement execution-only captions**

Normalize explicitly versioned V1 through `maul-short-manifest-adapter.ts`; malformed or stale V2 throws. Build display records and render them in `MaulPlannedTextLayer.tsx` from manifest chunk tokens and placement segments. Load DM Sans through `@remotion/google-fonts/DMSans`; reject unavailable/mismatched font, missing tokens, line mismatch, transform mismatch, and blocked plan. Render stable absolute boxes, exact lines, data attributes, and only compiled `solid_plate|outline|shadow|none`. Legacy pagination remains only for explicit Studio/pre-placement fixtures.

- [ ] **Step 4: Execute every crop interval**

Split source sequences at Output Composition and timeline boundaries; carry exact source viewport/crop/scale/transform hash and playback rate into `SourceSegment`. Render padded non-source regions from compiled composition. V2 never reads `timeline.speakerCropTracks` directly.

- [ ] **Step 5: Verify and commit**

Run: `npm --prefix remotion-app test -- src/compositions/__tests__/MaulShort.test.ts src/compositions/__tests__/MaulPlannedTextLayer.test.tsx && npm --prefix remotion-app run typecheck`

Expected: pass.

```bash
git add remotion-app/src/compositions/MaulPlannedTextLayer.tsx remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx remotion-app/src/compositions/maul-short-manifest-adapter.ts remotion-app/src/compositions/MaulShort.tsx remotion-app/src/compositions/__tests__/MaulShort.test.ts
git commit -m "feat(maul): render governed text placement"
```

### Task 6: Cross-Package Verification And Review

**Files:**
- Create: `remotion-app/src/web-preview/MaulPlacementTracer.tsx`
- Modify: `remotion-app/src/web-preview/main.tsx`
- Modify: `remotion-app/src/web-preview/sandbox-data.ts`
- Create: `remotion-app/src/web-preview/__tests__/maul-placement-tracer.test.tsx`
- Create: `remotion-app/playwright-maul-placement.config.ts`
- Create: `remotion-app/playwright-maul-placement.spec.ts`

- [ ] **Step 1: Write rendered-proof red tests**

Add `/maul/placement-tracer` route with deterministic measured/editorial/personal fixtures, a crop-change fixture, and x=.25 -> x=.75 hard cut. Playwright must assert nonblank video/text pixels, DOM bounds equal planned boxes within one pixel, data attributes match plan IDs/families/fallbacks, no midpoint smoothing frame exists, no overlap/overflow, and screenshots exist for all probes.

- [ ] **Step 2: Implement and run visual proof**

Run: `npm --prefix remotion-app exec -- playwright test --config=playwright-maul-placement.config.ts`

Expected: all desktop 1080x1920 scaled-player and mobile viewport probes pass with no console/media errors.

- [ ] **Step 3: Focused suites**

```bash
npm --prefix packages/shared-types test -- src/shorts-text-chunking.test.ts src/maul-text-placement.test.ts src/maul.test.ts
npm --prefix backend test -- src/maul/shorts-text-chunking.test.ts src/maul/shorts-text-chunking-llm.test.ts src/maul/text-chunk-plan.test.ts src/maul/shorts-text-placement.test.ts src/maul/planning.test.ts src/maul/quality-truth.test.ts src/__tests__/maul-short-render-path.test.ts
npm --prefix remotion-app test -- src/compositions/__tests__/MaulShort.test.ts src/compositions/__tests__/MaulPlannedTextLayer.test.tsx
```

Expected: zero failures.

- [ ] **Step 4: Typechecks**

```bash
npm --prefix packages/shared-types run typecheck
npm --prefix backend run typecheck
npm --prefix remotion-app run typecheck
```

Expected: all exit 0.

- [ ] **Step 5: Full suites and diff**

```bash
npm --prefix packages/shared-types test
npm --prefix backend test
npm --prefix remotion-app test
git diff --check
git status --short
```

Expected: all suites exit 0; diff check empty; status intentional.

- [ ] **Step 6: Independent review**

Review plan commit through HEAD against approved design. Fix every Critical/Important finding with a failing regression first, then rerun Steps 2-5.

## Completion Criteria

- Invalid emphasis cannot enter V2; transcript stays source-exact.
- V2 tokens preserve authoritative source index and source/output timing.
- A cut inside a timed word preserves one token identity and creates no geometry interpolation.
- Every segment stops at discontinuities and covers chunk tokens exactly.
- Unknown evidence never authorizes subject-aware negative space.
- Three families, padded non-source fallback, and blocked state are testable.
- New V2 Bundle/manifest govern exactly 16 plans with verified hashes; unchanged V1 artifacts still parse and use only explicit legacy adaptation.
- Remotion uses planned box, lines, primitive, crop interval, and playback rate.
- DM Sans asset/profile/fingerprint and rendered geometry have runtime/Playwright proof.
- No production vision or expressive-animation claim is made.
