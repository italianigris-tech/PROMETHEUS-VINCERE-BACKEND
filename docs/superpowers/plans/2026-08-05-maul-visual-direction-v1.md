# MAUL Visual Direction V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MAUL's first art-directed output path fail closed: only rendered, perceptually evaluated, human-approved candidates may be classified as art directed; every degraded path remains explicit and cannot impersonate creative success.

**Architecture:** Keep the current V1 source scope: one English-speaking principal subject in a 9:16 short. Replace the direct deterministic placement path with a single lineage: scene evidence -> Editorial Director -> visual beats and composition holds -> measured typography and composition candidates -> preview renders -> perceptual evaluation -> review decision -> final render. Structural Quality Truth remains intact, but final classification requires independent Perceptual Truth and never promotes a fallback.

**Tech Stack:** TypeScript, Zod shared contracts, Fastify backend, existing MAUL artifact store, Remotion/Chromium renderer, existing typography delivery bridge, FFmpeg/Remotion preview renders, Vitest, Playwright image/frame fixtures.

---

## Scope and release boundary

This plan deliberately does not promise a general video art director. V1 supports the repository's existing `single_speaker_talking_head` and `single_speaker_podcast` modes only. It produces four bounded directions: `editorial_asymmetry`, `poster_hero`, `subject_integrated`, and `restrained_minimal`.

V1 does not ship multi-speaker composition, custom rotoscoped occlusion, arbitrary camera tracking, generated inserts, or learned taste ranking. Those features are blocked behind V1 evidence and evaluation contracts. A missing visual-evidence provider must produce `SAFE_CAPTION_FALLBACK` or `VISUAL_EVIDENCE_UNAVAILABLE`, never `ART_DIRECTED`.

## Contract that ends false success

```ts
export const maulPlacementOutcomeSchema = z.enum([
  "ART_DIRECTED",
  "CONSTRAINED_ART_DIRECTED",
  "SAFE_CAPTION_FALLBACK",
  "PLACEMENT_UNRESOLVED",
  "VISUAL_EVIDENCE_UNAVAILABLE",
]);

export const maulPerceptualFailureLabelSchema = z.enum([
  "GENERIC_BOTTOM_CAPTION",
  "EXCESSIVE_BLACK_PLATE",
  "SINGLE_FONT_MONOTONY",
  "FLICKERING_LAYOUT",
  "UNREADABLE_HOLD",
  "AWKWARD_LINE_BREAK",
  "SUBJECT_OBSTRUCTION",
  "WEAK_HIERARCHY",
  "REFERENCE_TRAIT_MISSING",
  "ANIMATION_IMPERCEPTIBLE",
  "TEMPLATED_APPEARANCE",
]);

export const isArtDirectedOutcome = (outcome: MaulPlacementOutcome) =>
  outcome === "ART_DIRECTED" || outcome === "CONSTRAINED_ART_DIRECTED";

export const mayClaimReferenceParity = (input: {
  outcome: MaulPlacementOutcome;
  structuralStatus: "pass" | "blocked";
  perceptualStatus: "pass" | "blocked" | "unavailable";
  humanReviewStatus: "approved" | "rejected" | "pending";
}) => input.outcome === "ART_DIRECTED"
  && input.structuralStatus === "pass"
  && input.perceptualStatus === "pass"
  && input.humanReviewStatus === "approved";
```

`CONSTRAINED_ART_DIRECTED` is a visually evaluated composition with disclosed constraints. It is exportable only after human approval, but it cannot be used for a reference-parity claim or as a baseline winner. `SAFE_CAPTION_FALLBACK` is a usable accessibility result, not a creative result.

## Files and ownership

| Area | Files | Responsibility |
| --- | --- | --- |
| Shared contract | `packages/shared-types/src/maul.ts`, `packages/shared-types/src/index.ts` | Outcomes, temporal plans, scene evidence, typography profiles, perceptual truth, and review schemas. |
| Placement | `backend/src/maul/shorts-text-placement.ts`, new `backend/src/maul/temporal-composition.ts` | Convert editorial beats into stable holds; produce semantic layout outcomes rather than fallback-as-planned. |
| Direction | new `backend/src/maul/editorial-director.ts`, `backend/src/maul/service.ts`, `backend/src/maul/planner-audit.ts` | Call Joseph through one canonical interface and preserve causal lineage. |
| Visual evidence | new `backend/src/maul/scene-evidence.ts`, `backend/src/video-context/service.ts` | Produce temporal face/person/OCR/saliency/clutter/palette evidence and an opportunity map. |
| Typography | `backend/src/typography/font-delivery-bridge.ts`, new `backend/src/maul/typography-layout.ts`, `remotion-app/src/compositions/maul-short-manifest-adapter.ts`, `remotion-app/src/compositions/MaulPlannedTextLayer.tsx` | Govern multiple verified fonts, shape text before placement, and prove the same font rendered. |
| Render selection | `backend/src/maul/render-engine.ts`, new `backend/src/maul/render-preview.ts`, new `backend/src/maul/perceptual-truth.ts` | Render four low-resolution candidates, collect frame/temporal evidence, label failures, and select or block. |
| Workflow | `backend/src/maul/worker-executor.ts`, `backend/src/maul/service.ts`, `backend/src/maul/quality-truth.ts`, `backend/src/maul/routes.ts` | Remove fabricated review, require both truth layers, expose explicit job state. |
| Frontend | `remotion-app/src/web-preview/MaulReviewSurface.tsx`, `remotion-app/src/web-preview/MaulPlacementTracer.tsx` | Show actual outcome, candidate evidence, failure labels, and reviewer decision without claiming a fallback is art directed. |

### Task 1: Introduce outcome and perceptual-truth contracts

**Files:**
- Modify: `packages/shared-types/src/maul.ts`
- Modify: `packages/shared-types/src/index.ts`
- Modify: `packages/shared-types/src/maul.test.ts`

- [ ] **Step 1: Write failing schema tests for exclusive output classes.**

```ts
it("rejects reference parity for a safe caption fallback", () => {
  expect(() => maulCreativeResultSchema.parse({
    placementOutcome: "SAFE_CAPTION_FALLBACK",
    structuralStatus: "pass",
    perceptualStatus: "pass",
    humanReviewStatus: "approved",
    referenceParityClaimed: true,
  })).toThrow(/reference parity/i);
});
```

- [ ] **Step 2: Run the focused contract test and confirm it fails because the schema is absent.**

Run: `cd packages/shared-types && npm test -- --run src/maul.test.ts`

Expected: FAIL with `maulCreativeResultSchema` not exported.

- [ ] **Step 3: Add `maulPlacementOutcomeSchema`, `maulPerceptualTruthSchema`, `maulCreativeResultSchema`, and exports.**

```ts
export const maulPerceptualTruthSchema = z.object({
  status: z.enum(["pass", "blocked", "unavailable"]),
  selectedCandidateId: idSchema.nullable(),
  failureLabels: z.array(maulPerceptualFailureLabelSchema),
  evidenceArtifactIds: z.array(idSchema),
});
```

- [ ] **Step 4: Add cross-field validation: fallback and unresolved outcomes cannot claim reference parity; `ART_DIRECTED` requires perceptual pass.**

- [ ] **Step 5: Rerun the focused test.**

Run: `cd packages/shared-types && npm test -- --run src/maul.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the contract boundary.**

```bash
git add packages/shared-types/src/maul.ts packages/shared-types/src/index.ts packages/shared-types/src/maul.test.ts
git commit -m "feat(maul): separate creative outcomes from structural validity"
```

### Task 2: Remove fabricated worker approval and expose degraded states

**Files:**
- Modify: `backend/src/maul/worker-executor.ts`
- Modify: `backend/src/maul/worker-executor.test.ts`
- Modify: `backend/src/maul/service.ts`
- Modify: `backend/src/maul/routes.ts`
- Modify: `packages/shared-types/src/maul.ts`

- [ ] **Step 1: Replace the existing worker-success test with a test that proves it cannot call `reviewCandidate` with made-up scores.**

```ts
expect(projects.reviewCandidate).not.toHaveBeenCalled();
expect(completed.result).toMatchObject({
  status: "awaiting_perceptual_review",
  qualityTruthStatus: "structural_pass_only",
});
```

- [ ] **Step 2: Run `npm test -- --run src/maul/worker-executor.test.ts` and confirm the current automatic approval fails the new assertion.**

- [ ] **Step 3: Change `MaulWorkerExecutor.runOnce` so it creates the planning bundle and preview candidates, then completes the job as `awaiting_perceptual_review`.**

```ts
result: {
  planningBundleArtifactId: planningBundle.artifactId,
  status: "awaiting_perceptual_review",
  qualityTruthStatus: "structural_pass_only",
}
```

- [ ] **Step 4: Make `renderShort` require a `maulCreativeResult` artifact with `perceptualStatus: "pass"` and an authenticated human approval for `ART_DIRECTED`.**

- [ ] **Step 5: Add route tests for `SAFE_CAPTION_FALLBACK`, `PLACEMENT_UNRESOLVED`, and `awaiting_perceptual_review` responses.**

- [ ] **Step 6: Run backend worker and route tests.**

Run: `cd backend && npm test -- --run src/maul/worker-executor.test.ts src/__tests__/maul-short-render-path.test.ts`

Expected: PASS, with no path producing `qualityTruthStatus: "passed"` from the worker.

- [ ] **Step 7: Commit.**

```bash
git add backend/src/maul/worker-executor.ts backend/src/maul/worker-executor.test.ts backend/src/maul/service.ts backend/src/maul/routes.ts backend/src/__tests__/maul-short-render-path.test.ts packages/shared-types/src/maul.ts
git commit -m "fix(maul): block automatic creative approval"
```

### Task 3: Replace token-driven placement segments with visual beats and composition holds

**Files:**
- Create: `backend/src/maul/temporal-composition.ts`
- Create: `backend/src/maul/temporal-composition.test.ts`
- Modify: `backend/src/maul/shorts-text-placement.ts`
- Modify: `backend/src/maul/shorts-text-placement.test.ts`
- Modify: `packages/shared-types/src/maul.ts`

- [ ] **Step 1: Write tests for merge and duration gates.**

```ts
it("merges word boundaries when placement geometry and typography are stable", () => {
  expect(mergeAdjacentCompositionHolds(holds)).toEqual([
    expect.objectContaining({startMs: 0, endMs: 1400}),
  ]);
});

it("rejects a 40ms composition hold outside an explicitly rapid treatment", () => {
  expect(() => assertPerceptualDuration(40, "COMPOSITION_HOLD")).toThrow(/850ms/);
});
```

- [ ] **Step 2: Run the new test and confirm it fails because temporal composition does not exist.**

- [ ] **Step 3: Implement `VisualBeat`, `CompositionHold`, and `WordTiming` with `MIN_COMPOSITION_HOLD_MS = 850`, `MIN_VISIBLE_TEXT_MS = 700`, `MIN_ANIMATION_READ_MS = 300`, and `MIN_HERO_HOLD_MS = 1800`.**

- [ ] **Step 4: Change `buildLayoutNodes` so token spans are retained as `WordTiming` but are not layout boundaries. Use only beat, hard-cut, and material geometry-change boundaries.**

- [ ] **Step 5: Add a regression fixture containing 40ms token spans and assert one stable hold with word-level emphasis.**

- [ ] **Step 6: Run placement and temporal tests.**

Run: `cd backend && npm test -- --run src/maul/temporal-composition.test.ts src/maul/shorts-text-placement.test.ts`

Expected: PASS; no output segment is shorter than the declared perceptual gate.

- [ ] **Step 7: Commit.**

```bash
git add backend/src/maul/temporal-composition.ts backend/src/maul/temporal-composition.test.ts backend/src/maul/shorts-text-placement.ts backend/src/maul/shorts-text-placement.test.ts packages/shared-types/src/maul.ts
git commit -m "feat(maul): plan typography by visual beat"
```

### Task 4: Put Joseph in the candidate-to-render lineage

**Files:**
- Create: `backend/src/maul/editorial-director.ts`
- Create: `backend/src/maul/editorial-director.test.ts`
- Modify: `backend/src/maul/service.ts`
- Modify: `backend/src/maul/planner-audit.ts`
- Modify: `backend/src/maul/cinematic-planning-contract.red.test.ts`
- Modify: `packages/shared-types/src/maul.ts`

- [ ] **Step 1: Write a failing integration test requiring an editorial-direction artifact in every Joseph-directed planning bundle.**

```ts
expect(bundle.payload.planArtifactIds.editorialDirection).toMatch(/^maul_artifact_/);
expect(audit.entries.find((entry) => entry.stageId === "joseph_seeded_planning"))
  .toMatchObject({executed: true, authorityClass: "invoked_model"});
```

- [ ] **Step 2: Implement the canonical interface.**

```ts
export interface EditorialDirector {
  plan(input: EditorialPlanningInput): Promise<EditorialDirection>;
}

export type EditorialDirection = {
  visualBeats: VisualBeat[];
  typographyDirection: TypographyDirection;
  compositionDirection: CompositionDirection;
  rationale: string[];
  receipt: {directorId: "joseph"; version: string; inputHash: string};
};
```

- [ ] **Step 3: Adapt the existing Joseph seeded planner behind `EditorialDirector`; do not duplicate Joseph rules in MAUL.**

- [ ] **Step 4: Invoke the director before text chunking in `createPlanningBundle`, persist the direction artifact, and make downstream text, camera, and audio plans consume its immutable ID.**

- [ ] **Step 5: Change the planner audit from `configured_not_invoked` to a receipt-backed invocation record only when the interface ran.**

- [ ] **Step 6: Run the director and cinematic contract tests.**

Run: `cd backend && npm test -- --run src/maul/editorial-director.test.ts src/maul/cinematic-planning-contract.red.test.ts`

Expected: PASS; missing direction lineage blocks the bundle.

- [ ] **Step 7: Commit.**

```bash
git add backend/src/maul/editorial-director.ts backend/src/maul/editorial-director.test.ts backend/src/maul/service.ts backend/src/maul/planner-audit.ts backend/src/maul/cinematic-planning-contract.red.test.ts packages/shared-types/src/maul.ts
git commit -m "feat(maul): make Joseph editorial direction authoritative"
```

### Task 5: Add temporal scene evidence and opportunity maps

**Files:**
- Create: `backend/src/maul/scene-evidence.ts`
- Create: `backend/src/maul/scene-evidence.test.ts`
- Modify: `backend/src/video-context/service.ts`
- Modify: `backend/src/maul/service.ts`
- Modify: `packages/shared-types/src/maul.ts`

- [ ] **Step 1: Define the evidence provider contract and an unavailable implementation.**

```ts
export interface SceneEvidenceProvider {
  inspect(input: {sourcePath: string; beats: VisualBeat[]}): Promise<SceneEvidenceTimeline>;
}

export type SpatialOpportunityMap = {
  negativeSpace: SpatialField;
  visualClutter: SpatialField;
  readableContrast: SpatialField;
  faceProtection: SpatialField;
  textCollision: SpatialField;
};
```

- [ ] **Step 2: Write a failing test proving unavailable evidence returns `VISUAL_EVIDENCE_UNAVAILABLE`, not a source-pixel placement.**

- [ ] **Step 3: Implement frame sampling, temporal smoothing, and evidence artifacts for face/person regions, OCR regions, palette, saliency, clutter, and camera motion. Use a configured provider only; never synthesize an evidence receipt.**

- [ ] **Step 4: Derive one opportunity map per composition hold and persist its source frame IDs, provider name, and confidence as evidence.**

- [ ] **Step 5: Replace `buildMaulConservativePlacementInputs` in the art-directed path. Keep it only for explicit safe-caption degradation.**

- [ ] **Step 6: Run scene-evidence tests and add a test asserting the legacy fallback builder cannot return `ART_DIRECTED`.**

Run: `cd backend && npm test -- --run src/maul/scene-evidence.test.ts src/maul/cinematic-planning-contract.red.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add backend/src/maul/scene-evidence.ts backend/src/maul/scene-evidence.test.ts backend/src/video-context/service.ts backend/src/maul/service.ts packages/shared-types/src/maul.ts
git commit -m "feat(maul): add scene evidence for composition planning"
```

### Task 6: Make governed typography measurable and renderer-compatible

**Files:**
- Create: `backend/src/maul/typography-layout.ts`
- Create: `backend/src/maul/typography-layout.test.ts`
- Modify: `backend/src/typography/font-delivery-bridge.ts`
- Modify: `packages/shared-types/src/maul.ts`
- Modify: `remotion-app/src/compositions/maul-short-manifest-adapter.ts`
- Modify: `remotion-app/src/compositions/MaulPlannedTextLayer.tsx`
- Modify: `remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx`

- [ ] **Step 1: Add failing tests for a serif/display plus grotesk pair and for a rejected unmeasured font.**

```ts
expect(resolveTypographyLayout(input)).toMatchObject({
  roles: expect.arrayContaining([
    expect.objectContaining({role: "EDITORIAL_DISPLAY"}),
    expect.objectContaining({role: "NEUTRAL_GROTESK"}),
  ]),
});
expect(() => resolveTypographyLayout(unmeasuredInput)).toThrow(/measured font/i);
```

- [ ] **Step 2: Use the existing `resolveTypographyDeliveryPlan` as the sole font delivery source. Add a MAUL adapter that accepts only materialized, licensed, browser-renderable assets with stable IDs.**

- [ ] **Step 3: Implement real glyph measurement and a line-break candidate search. Score width balance, syntactic integrity, rhetorical rhythm, hierarchy fit, and reference trait fit.**

- [ ] **Step 4: Replace DM Sans literals in MAUL placement contracts and the adapter with resolved `FontRole` records. Keep the exact selected assets in the manifest and final proof.**

- [ ] **Step 5: Make Remotion load the resolved assets before rendering and record its actual loaded font family/asset ID.**

- [ ] **Step 6: Run backend typography and Remotion component tests.**

Run: `cd backend && npm test -- --run src/maul/typography-layout.test.ts`

Run: `cd remotion-app && npm test -- --run src/compositions/__tests__/MaulPlannedTextLayer.test.tsx`

Expected: PASS; a non-DM-Sans measured pair renders, while an unverified font blocks art-directed output.

- [ ] **Step 7: Commit.**

```bash
git add backend/src/maul/typography-layout.ts backend/src/maul/typography-layout.test.ts backend/src/typography/font-delivery-bridge.ts packages/shared-types/src/maul.ts remotion-app/src/compositions/maul-short-manifest-adapter.ts remotion-app/src/compositions/MaulPlannedTextLayer.tsx remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx
git commit -m "feat(maul): plan and verify measured typography"
```

### Task 7: Generate materially different composition candidates

**Files:**
- Create: `backend/src/maul/composition-candidates.ts`
- Create: `backend/src/maul/composition-candidates.test.ts`
- Modify: `backend/src/maul/shorts-text-placement.ts`
- Modify: `packages/shared-types/src/maul-text-placement.ts`

- [ ] **Step 1: Write the candidate-diversity test.**

```ts
expect(buildCompositionCandidates(input).map((candidate) => candidate.direction)).toEqual([
  "editorial_asymmetry",
  "poster_hero",
  "subject_integrated",
  "restrained_minimal",
]);
```

- [ ] **Step 2: Define anchors, hierarchy, crop intent, alignment, and depth intent; remove the requirement that family order contain exactly the legacy three fixed families.**

- [ ] **Step 3: Score candidates from measured opportunity maps, font geometry, visual-beat purpose, and temporal stability. Penalize face interference, clutter, unsafe crop, generic bottom-band use, and repeated geometry.**

- [ ] **Step 4: Keep source-pixel overlap disabled in V1 unless a verified mask marks it as intentional. Do not represent unimplemented occlusion as `resolved: "occluded"`.**

- [ ] **Step 5: Add fixtures for left subject, centered subject, text in scene, and no usable negative space.**

- [ ] **Step 6: Run candidate and placement tests.**

Run: `cd backend && npm test -- --run src/maul/composition-candidates.test.ts src/maul/shorts-text-placement.test.ts`

Expected: PASS; centered subjects receive alternatives rather than disabling editorial planning.

- [ ] **Step 7: Commit.**

```bash
git add backend/src/maul/composition-candidates.ts backend/src/maul/composition-candidates.test.ts backend/src/maul/shorts-text-placement.ts packages/shared-types/src/maul-text-placement.ts
git commit -m "feat(maul): generate scene-aware composition candidates"
```

### Task 8: Render low-resolution variants and evaluate actual frames

**Files:**
- Create: `backend/src/maul/render-preview.ts`
- Create: `backend/src/maul/perceptual-truth.ts`
- Create: `backend/src/maul/perceptual-truth.test.ts`
- Modify: `backend/src/maul/render-engine.ts`
- Modify: `backend/src/maul/quality-truth.ts`
- Modify: `backend/src/maul/service.ts`

- [ ] **Step 1: Write a failing evaluator test with fixtures labeled `GENERIC_BOTTOM_CAPTION`, `FLICKERING_LAYOUT`, `AWKWARD_LINE_BREAK`, and `EXCESSIVE_BLACK_PLATE`.**

```ts
expect(evaluatePerceptualTruth(genericFallbackPreview)).toMatchObject({
  status: "blocked",
  failureLabels: expect.arrayContaining(["GENERIC_BOTTOM_CAPTION"]),
});
```

- [ ] **Step 2: Extend the render engine with a preview mode that renders the selected candidate direction at 540x960 and writes frame samples plus a short MP4 to a retained candidate artifact directory.**

- [ ] **Step 3: Implement deterministic frame measurements for text bounds, contrast, hold duration, layout delta, plate coverage, and font proof. Feed sampled frames and temporal deltas to a configured critic only after those measurements exist.**

- [ ] **Step 4: Store `PerceptualTruth` with named failure labels and evidence artifact IDs. If the critic is unavailable, set `unavailable`; do not substitute a score.**

- [ ] **Step 5: Select the highest-scoring non-blocked candidate only when it beats the baseline safe-caption preview. Otherwise create `PLACEMENT_UNRESOLVED` or `SAFE_CAPTION_FALLBACK`.**

- [ ] **Step 6: Require both Structural Quality Truth and Perceptual Truth before final rendering.**

- [ ] **Step 7: Run evaluator and render-path tests.**

Run: `cd backend && npm test -- --run src/maul/perceptual-truth.test.ts src/__tests__/maul-short-render-path.test.ts`

Expected: PASS; the generic fallback fixture cannot reach `ART_DIRECTED`.

- [ ] **Step 8: Commit.**

```bash
git add backend/src/maul/render-preview.ts backend/src/maul/perceptual-truth.ts backend/src/maul/perceptual-truth.test.ts backend/src/maul/render-engine.ts backend/src/maul/quality-truth.ts backend/src/maul/service.ts backend/src/__tests__/maul-short-render-path.test.ts
git commit -m "feat(maul): select candidates from rendered perceptual evidence"
```

### Task 9: Make review and diagnostics show the truth

**Files:**
- Modify: `remotion-app/src/web-preview/MaulReviewSurface.tsx`
- Modify: `remotion-app/src/web-preview/MaulPlacementTracer.tsx`
- Modify: `remotion-app/src/web-preview/__tests__/maul-review-surface.test.tsx`
- Modify: `remotion-app/src/web-preview/__tests__/maul-placement-tracer.test.tsx`
- Modify: `backend/src/maul/routes.ts`

- [ ] **Step 1: Write frontend tests proving a fallback cannot be displayed as “art directed” and that failure labels remain visible to reviewers.**

```tsx
expect(screen.getByText("Safe caption fallback")).toBeVisible();
expect(screen.queryByText("Art directed")).not.toBeInTheDocument();
expect(screen.getByText("GENERIC_BOTTOM_CAPTION")).toBeVisible();
```

- [ ] **Step 2: Add routes that return candidate preview URLs, perceptual evidence, outcome class, degradation reason, and review state from one lineage.**

- [ ] **Step 3: Render outcome state and evidence in the review surface; retain a reviewer action only for valid candidate artifacts.**

- [ ] **Step 4: Extend the tracer with composition-hold duration, selected font asset, opportunity-map evidence ID, and frame failure labels.**

- [ ] **Step 5: Run review-surface tests.**

Run: `cd remotion-app && npm test -- --run src/web-preview/__tests__/maul-review-surface.test.tsx src/web-preview/__tests__/maul-placement-tracer.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add remotion-app/src/web-preview/MaulReviewSurface.tsx remotion-app/src/web-preview/MaulPlacementTracer.tsx remotion-app/src/web-preview/__tests__/maul-review-surface.test.tsx remotion-app/src/web-preview/__tests__/maul-placement-tracer.test.tsx backend/src/maul/routes.ts
git commit -m "feat(maul): disclose perceptual outcome in review"
```

### Task 10: Establish the held-out launch corpus and release gate

**Files:**
- Create: `backend/src/maul/fixtures/visual-direction-corpus.json`
- Create: `backend/src/maul/visual-direction-release.test.ts`
- Create: `docs/maul/visual-direction-v1-release-gate.md`
- Modify: `backend/src/maul/runtime-contracts.ts`

- [ ] **Step 1: Register 30 rights-cleared raw-video cases, approved abstract reference traits, expected allowable outcomes, and baseline preview IDs. No reference asset may be stored without rights status.**

- [ ] **Step 2: Write the release test for non-negotiable machine gates.**

```ts
expect(results.every((result) => !(
  result.placementOutcome === "SAFE_CAPTION_FALLBACK"
  && result.referenceParityClaimed
))).toBe(true);
expect(results.every((result) => result.minCompositionHoldMs >= 850)).toBe(true);
expect(results.every((result) => result.finalFontVerified)).toBe(true);
```

- [ ] **Step 3: Add the blinded-review protocol: each evaluator sees the current baseline and selected candidate in randomized order, records a winner and named failure labels, and cannot see treatment identifiers.**

- [ ] **Step 4: Set release acceptance in runtime contracts: zero mislabeled fallbacks, zero blocked perceptual results exported as art directed, all selected font proofs valid, and at least 80% blinded preference over the baseline across the corpus.**

- [ ] **Step 5: Run the release test against fixtures, then run the real corpus job in a separate controlled environment and attach immutable results to the release issue.**

Run: `cd backend && npm test -- --run src/maul/visual-direction-release.test.ts`

Expected: PASS for fixture integrity. The actual launch decision is blocked until the corpus review meets the stated threshold.

- [ ] **Step 6: Commit.**

```bash
git add backend/src/maul/fixtures/visual-direction-corpus.json backend/src/maul/visual-direction-release.test.ts backend/src/maul/runtime-contracts.ts docs/maul/visual-direction-v1-release-gate.md
git commit -m "test(maul): gate visual direction launch on held-out evidence"
```

## Final verification sequence

Run these commands only after every task has landed:

```bash
npm --workspace @prometheus/shared-types test
npm --workspace @prometheus/shared-types run typecheck
npm --workspace @prometheus/backend test
npm --workspace @prometheus/backend run typecheck
cd remotion-app && npm test
cd remotion-app && npm run typecheck
```

Then render the held-out corpus at preview resolution, run the blinded review protocol, and inspect every candidate classified `ART_DIRECTED`. A full-resolution export is permitted only after the immutable structural proof, Perceptual Truth, and authenticated human approval all point to the same candidate lineage.

## Plan self-review

- False-success loop: Tasks 1 and 2 remove fallback-as-success and fabricated worker approval.
- Temporal instability: Task 3 introduces visual beats, composition holds, and testable duration gates.
- Disconnected authority: Task 4 makes Joseph a receipt-backed input to the active MAUL path.
- Shallow visual evidence and fixed geometry: Tasks 5 and 7 add measured opportunity maps and bounded composition directions.
- DM Sans lock-in and estimated layout: Task 6 integrates the existing font delivery bridge with shaping and final render proof.
- Manifest-only quality: Task 8 adds rendered candidate evaluation; Task 9 exposes it; Task 10 blocks release without independent evidence.
- Scope: V1 stays within the existing one-principal-speaker contract. Multi-speaker, custom masking, and learned taste models are intentionally outside this launch plan.
