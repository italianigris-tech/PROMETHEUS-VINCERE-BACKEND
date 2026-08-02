# MAUL Scene-Aware Text Placement Tracer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one testable 1080x1920 MAUL tracer that turns governed transcript words into standalone chunk and scene-aware placement artifacts, compiles both into the render manifest, and makes Remotion execute the planned layout.

**Architecture:** Model output remains limited to semantic chunk proposals. A deterministic adapter gives each word stable identity; a deterministic planner intersects chunks with timeline/shot discontinuities, generates only `measured`, `editorial`, and `personal` candidates, hard-gates them, and selects a stable sequence. New V2 Planning Bundles contain 16 governed artifacts while persisted V1 bundles remain valid at 14 and enter only through an explicit legacy adapter; renderer consumes boxes and lines without making placement decisions.

**Tech Stack:** TypeScript, Zod, Vitest, Fastify service artifacts, Remotion/React, existing MAUL Planning Bundle and Unified Short Render Manifest.

---

## Scope

Implements delivery slices 1-2 from approved design. Production MediaPipe, PySceneDetect/PyAV extraction, field/OCR/saliency providers, padded fallback composition generation, numeric animation, expressive treatment, and twelve-family catalog are excluded. Missing subject/cut evidence is `unknown`; only explicit conservative plate fallback or blocked result is allowed.

## File Map

- Modify `packages/shared-types/src/shorts-text-chunking.ts` and test: ordered/unique emphasis prerequisite.
- Create `packages/shared-types/src/maul-text-placement.ts` and test: V2 chunk and placement core contracts.
- Modify `packages/shared-types/src/maul.ts`, test, and `index.ts`: MAUL wrappers, artifacts, V1/V2 bundle/manifest unions.
- Modify `backend/src/maul/shorts-text-chunking.ts` and test: proposal rejection prerequisite.
- Create `backend/src/maul/text-placement.ts` and test: stable-token adapter, intervals, candidates, hard gates, selection.
- Modify `backend/src/maul/planning.ts`, test, `service.ts`, and render-path test: registration, lineage, compilation.
- Modify `backend/src/maul/routes.ts` and `backend/src/maul/runtime-contracts.ts`: governed artifact ownership and V2 handoff declaration.
- Modify `remotion-app/src/compositions/MaulShort.tsx` and test: shared joining, source mapping, planned layout.

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

Create valid two-token V2 chunk and one-segment placement fixtures. Assert rejection for duplicate token IDs, non-exact coverage, emphasis outside chunk, box outside `[0,1]`, line token loss/reordering, selected `fail`/`unknown` gates, executable behind-subject depth, and blocked plan without reason.

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

Chunk core contains schema/version/hashes, duration, pacing/style/strategy, ordered tokens, ordered chunks, exact coverage, protected pauses, inference, and input hashes. Token fields: stable ID, authoritative transcript index, text, source interval, output interval. Chunk fields: IDs, token IDs, output interval, semantic role, emphasis token IDs/text/level, pause-hold flag, rationale, confidence.

Placement core contains chunk artifact ID/hash, catalog and score policy, normalized platform profile, `planned|blocked`, blocking reason, and segments. Segment fields: stable chunk/scene/discontinuity IDs, output interval, transform hash, exact lines, family/variant, normalized box/envelope, alignment, compatibility metrics, front/deferred depth, minimum legibility primitive, hard gates, named scores, rationale, confidence, fallback code.

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
- Create: `backend/src/maul/text-placement.ts`
- Create: `backend/src/maul/text-placement.test.ts`

- [ ] **Step 1: Write materialization red tests**

Given source words, mapped output words, V1 plan, and timeline hash: require stable replay IDs, original indices, both timelines, exact chunk/emphasis token references, and rejection of unapproved Protected Pause bridging.

- [ ] **Step 2: Verify red**

Run: `npm --prefix backend test -- src/maul/text-placement.test.ts`

Expected: exports missing.

- [ ] **Step 3: Implement materialization**

Generate `token_<24 hex>` from SHA-256 of transcript hash plus authoritative word index. Hash V1/timeline with `hashMaulPlanPayload`. Reconstruct text through `joinShortsTextTokens`; parse final payload with shared schema.

- [ ] **Step 4: Write placement red tests**

Cover centered/left/right subject fixtures; chunk crossing source cut; removed-time join; same-scene dropout; unknown cut evidence; no fit; reversed candidate iteration. Require no segment across reset, x=.25 -> x=.75 never x=.50, exact line coverage, three-family membership, stable tie-break.

- [ ] **Step 5: Implement intervals and candidates**

Intersect chunk, mapped shot, non-cut timeline, and residual-reset spans using half-open intervals. Generate only `measured`, `editorial`, `personal`; partition lines semantically without token changes. Use normalized reserves and compatibility profile `maul-compat-arial-v1`.

- [ ] **Step 6: Implement gates and sequence selection**

Hard-reject unsafe envelope, font-size failure, token mismatch, known collision, subject-aware use with unknown evidence, and executable behind-depth. Rank survivors by named dimensions; apply same-scene continuity/anti-repetition; reset geometry penalties at discontinuities. Unknown evidence may use only `measured.conservative_plate_v1` with `solid_plate`, otherwise emit `blocked_no_readable_dialogue_candidate`.

- [ ] **Step 7: Verify and commit**

Run: `npm --prefix backend test -- src/maul/text-placement.test.ts && npm --prefix backend run typecheck`

Expected: pass.

```bash
git add backend/src/maul/text-placement.ts backend/src/maul/text-placement.test.ts
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

Include both payloads; add native executions `MaulShort.PlannedCaptionTokens.v1` and `MaulShort.PlannedPlacement.v1`; include hashes in replay key; retain 1080x1920/30.

Add both new artifact types to `GOVERNED_RUNTIME_ONLY_ARTIFACT_TYPES`. Extend runtime-contract ownership text so deterministic planner owns placement and manifest compiler owns renderer handoff.

- [ ] **Step 6: Verify and commit**

Run: `npm --prefix backend test -- src/maul/planning.test.ts src/__tests__/maul-short-render-path.test.ts && npm --prefix backend run typecheck`

Expected: pass.

```bash
git add backend/src/maul/planning.ts backend/src/maul/planning.test.ts backend/src/maul/service.ts backend/src/__tests__/maul-short-render-path.test.ts backend/src/maul/routes.ts backend/src/maul/runtime-contracts.ts
git commit -m "feat(maul): compile placement through planning bundle"
```

### Task 5: Execute Planned Layout In Remotion

**Files:**
- Modify: `remotion-app/src/compositions/MaulShort.tsx`
- Modify: `remotion-app/src/compositions/__tests__/MaulShort.test.ts`

- [ ] **Step 1: Write render-contract red tests**

Require normalized `{x:.1,y:.2,width:.6,height:.15}` -> `{leftPx:108,topPx:384,widthPx:648,heightPx:288}`, planned line/token order, family/variant/fallback metadata, compiled legibility primitive, and two crop centers for a crop change at 500ms.

- [ ] **Step 2: Verify red**

Run: `npm --prefix remotion-app test -- src/compositions/__tests__/MaulShort.test.ts`

Expected: planned segment compiler/time-varying crops absent.

- [ ] **Step 3: Implement execution-only captions**

Build display records from manifest chunk tokens and placement segments. Reject missing tokens, line mismatch, transform mismatch, and blocked plan. Render stable absolute boxes, exact lines, data attributes, and only compiled `solid_plate|outline|shadow|none`. Legacy pagination remains only for explicit Studio/pre-placement fixtures.

- [ ] **Step 4: Execute every crop interval**

Split source sequences at timeline and crop boundaries; carry crop center and playback rate into `SourceSegment`. Never read only first crop.

- [ ] **Step 5: Verify and commit**

Run: `npm --prefix remotion-app test -- src/compositions/__tests__/MaulShort.test.ts && npm --prefix remotion-app run typecheck`

Expected: pass.

```bash
git add remotion-app/src/compositions/MaulShort.tsx remotion-app/src/compositions/__tests__/MaulShort.test.ts
git commit -m "feat(maul): render governed text placement"
```

### Task 6: Cross-Package Verification And Review

**Files:** No planned production edits.

- [ ] **Step 1: Focused suites**

```bash
npm --prefix packages/shared-types test -- src/shorts-text-chunking.test.ts src/maul-text-placement.test.ts src/maul.test.ts
npm --prefix backend test -- src/maul/shorts-text-chunking.test.ts src/maul/shorts-text-chunking-llm.test.ts src/maul/text-placement.test.ts src/maul/planning.test.ts src/__tests__/maul-short-render-path.test.ts
npm --prefix remotion-app test -- src/compositions/__tests__/MaulShort.test.ts
```

Expected: zero failures.

- [ ] **Step 2: Typechecks**

```bash
npm --prefix packages/shared-types run typecheck
npm --prefix backend run typecheck
npm --prefix remotion-app run typecheck
```

Expected: all exit 0.

- [ ] **Step 3: Full suites and diff**

```bash
npm --prefix packages/shared-types test
npm --prefix backend test
npm --prefix remotion-app test
git diff --check
git status --short
```

Expected: all suites exit 0; diff check empty; status intentional.

- [ ] **Step 4: Independent review**

Review plan commit through HEAD against approved design. Fix every Critical/Important finding with a failing regression first, then rerun Steps 1-3.

## Completion Criteria

- Invalid emphasis cannot enter V2; transcript stays source-exact.
- V2 tokens preserve authoritative source index and source/output timing.
- Every segment stops at discontinuities and covers chunk tokens exactly.
- Unknown evidence never authorizes subject-aware negative space.
- Three families, conservative fallback, and blocked state are testable.
- New V2 Bundle/manifest govern exactly 16 plans with verified hashes; unchanged V1 artifacts still parse and use only explicit legacy adaptation.
- Remotion uses planned box, lines, primitive, crop interval, and playback rate.
- No production vision or expressive-animation claim is made.
