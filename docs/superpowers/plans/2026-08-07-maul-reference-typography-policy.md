# MAUL Reference Typography Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MAUL produce reference-derived typography with governed font pairing, measured placement, mixed-role lockups, and word/letter-level motion for the supplied paragraph.

**Architecture:** Keep the semantic typography tree and scene-aware placement planner authoritative. Insert a versioned reference-grammar/pair-ranking policy before lockup construction, compile the final lockup envelope before placement is registered, and make Remotion execute only position-locked local reveals. Preserve the existing matte/source filter and expose its finish as a declared treatment profile.

**Tech Stack:** TypeScript, Zod shared contracts, Fontkit, Vitest, Remotion, FFmpeg, existing MAUL composition harness.

---

### Task 1: Reference Grammar And Corpus Contract

**Files:**
- Create: `backend/src/maul/reference-typography-policy.ts`
- Create: `backend/src/maul/reference-typography-policy.test.ts`
- Create: `backend/src/maul/reference-typography-corpus.ts`
- Test fixture source: `Yuan Prometheus Screenshots/font pairing and placement/*.png`
- Modify: `backend/src/maul/index.ts` only if the module barrel exports MAUL modules

- [ ] **Step 1: Write the failing corpus and selector tests**

```ts
it("covers every supplied reference exactly once", () => {
  expect(REFERENCE_TYPOGRAPHY_CORPUS).toHaveLength(44);
  expect(new Set(REFERENCE_TYPOGRAPHY_CORPUS.map((entry) => entry.filename)).size).toBe(44);
});

it("selects an inline mixed-word grammar without forcing all caps", () => {
  const grammar = selectReferenceTypographyGrammar({
    tokenCount: 2,
    emphasisLevel: "key",
    traits: ["mixed_word_splice", "editorial_italic_hinge"],
    seed: "paragraph:portfolio",
  });
  expect(grammar.id).toBe("inline_mixed_word_splice");
  expect(grammar.caseMode).toBe("source_preserving");
});

it("rejects a second annotation in a non-poster lockup", () => {
  expect(() => validateReferenceTypographyTreatment({
    grammarId: "inline_italic_hinge",
    annotations: ["underline", "circle"],
  })).toThrow(/one annotation/i);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm --workspace @prometheus/backend test -- src/maul/reference-typography-policy.test.ts`

Expected: FAIL because the corpus, grammar selector, and treatment validator do not exist.

- [ ] **Step 3: Add the deterministic policy types and the 44-entry corpus**

Define `ReferenceTypographyGrammarId`, `ReferenceTypographyGrammar`, `ReferenceTypographyObservation`, and `ReferenceTypographyPolicyInput`. Store each filename, SHA-256, `foundationRole`, `accentRole`, `caseMode`, `placementPattern`, and optional annotation pattern from the approved design spec. Export these grammar families: `stacked_support_hero`, `inline_italic_hinge`, `inline_mixed_word_splice`, `script_over_foundation`, `annotated_keyword`, `quiet_luxury`, and `poster_stack`.

`selectReferenceTypographyGrammar` must score exact trait matches first, then word-count fit, then deterministic seed order. `validateReferenceTypographyTreatment` must reject unknown grammar IDs, more than one annotation outside `poster_stack`, and a missing foundation role.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run: `npm --workspace @prometheus/backend test -- src/maul/reference-typography-policy.test.ts`

Expected: PASS with 44 corpus entries and deterministic grammar selection.

- [ ] **Step 5: Commit the policy slice**

```powershell
git add -- backend/src/maul/reference-typography-policy.ts backend/src/maul/reference-typography-policy.test.ts backend/src/maul/reference-typography-corpus.ts
git commit -m "feat(maul): add reference typography grammar policy"
```

### Task 2: Full-Registry Font Pair Ranking

**Files:**
- Modify: `backend/src/maul/zilliz-font-assets.ts`
- Test: `backend/src/maul/zilliz-font-assets.test.ts`
- Create: `backend/src/maul/font-pair-ranking.ts`
- Create: `backend/src/maul/font-pair-ranking.test.ts`

- [ ] **Step 1: Write the failing ranking tests**

```ts
it("ranks every renderable licensed primary/accent pair before selecting one", () => {
  const result = rankMaulFontPairs({candidates: fixtureCandidates, hydratedAssets: fixtureAssets});
  expect(result.evaluatedPairCount).toBe(4);
  expect(result.pair.primary.assetId).toBe("primary_serif");
  expect(result.pair.accent.assetId).toBe("accent_italic");
  expect(result.score.breakdown.roleContrast).toBeGreaterThan(0);
});

it("reports the hydrated subset instead of claiming the 577-font catalog was rendered", () => {
  expect(result.catalogCount).toBe(577);
  expect(result.hydratedCount).toBe(2);
  expect(result.status).toBe("hydrated_subset");
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm --workspace @prometheus/backend test -- src/maul/font-pair-ranking.test.ts src/maul/zilliz-font-assets.test.ts`

Expected: FAIL because the pair-ranking seam and coverage receipt do not exist.

- [ ] **Step 3: Implement deterministic pair scoring**

Add `rankMaulFontPairs` that filters `renderable`, cleared/bundled license, local binary, and required glyph coverage; enumerates every primary x accent combination in the available candidate set; and scores role contrast, style contrast, weight contrast, width/rhythm compatibility, source retrieval score, and decorative-clash penalty. Tie-break by score, asset IDs, and then family names. Return the selected pair plus `evaluatedPairCount`, `catalogCount`, `hydratedCount`, `status`, and a serializable breakdown.

Update `ZillizMaulFontAssetResolver.resolve` to retain the catalog count and use the ranker after hydration. Keep the existing unavailable fallback and make the receipt explicit when only the local hydrated subset can be evaluated.

- [ ] **Step 4: Run pair tests and the existing MAUL font tests**

Run: `npm --workspace @prometheus/backend test -- src/maul/font-pair-ranking.test.ts src/maul/zilliz-font-assets.test.ts`

Expected: PASS with no license or fallback regressions.

- [ ] **Step 5: Commit the font-ranking slice**

```powershell
git add -- backend/src/maul/font-pair-ranking.ts backend/src/maul/font-pair-ranking.test.ts backend/src/maul/zilliz-font-assets.ts backend/src/maul/zilliz-font-assets.test.ts
git commit -m "feat(maul): rank governed font pairs"
```

### Task 3: Lockup Schema And Final Geometry Envelope

**Files:**
- Modify: `packages/shared-types/src/maul-editorial-lockup.ts`
- Modify: `packages/shared-types/src/maul-text-placement.ts`
- Modify: `backend/src/maul/typography-layout.ts`
- Modify: `backend/src/maul/editorial-lockup.ts`
- Modify: `backend/src/maul/service.ts`
- Test: `packages/shared-types/src/maul-editorial-lockup.test.ts`
- Test: `packages/shared-types/src/maul-text-placement.test.ts`
- Test: `backend/src/maul/editorial-lockup.test.ts`

- [ ] **Step 1: Add failing contract tests for locked anchors and accent geometry**

```ts
it("requires a position-locked reveal contract", () => {
  const invalidLockup = Object.assign({}, baseLockup, {placement: undefined});
  expect(() => maulEditorialLockupSchema.parse(invalidLockup)).toThrow();
});

it("expands maximumEnvelope after the accent font and overlap are applied", () => {
  const result = applyMaulEditorialLockups({
    placementPlan,
    textChunkPlan,
    rhythm,
    primaryFont,
    accentFont,
    referenceTraits,
    selectionSeed: "geometry-fixture",
    measureAccent: fixtureAccentMeasure,
  });
  expect(result.segments[0]!.maximumEnvelope.width).toBeGreaterThan(result.segments[0]!.box.width);
  expect(result.segments[0]!.maximumEnvelope.x).toBeLessThanOrEqual(result.segments[0]!.box.x);
});
```

- [ ] **Step 2: Run the contract tests and verify they fail**

Run: `npm --workspace @prometheus/shared-types test -- src/maul-editorial-lockup.test.ts src/maul-text-placement.test.ts` and `npm --workspace @prometheus/backend test -- src/maul/editorial-lockup.test.ts`

Expected: FAIL because lockups have no explicit placement/reveal policy and the placement envelope is still primary-only.

- [ ] **Step 3: Extend the lockup contract without breaking older manifests**

Add a required `placement` object to newly emitted lockups with `mode: "position_locked"`, `anchor: "word_box"`, and `finalTransformIdentity: true`; add `annotation` records attached to token IDs; add `caseMode: "source_preserving" | "display_allowed"`; and allow `choreography.mode` values `position_locked_word_reveal` and `position_locked_letter_reveal`. Keep the parser backward-compatible only at manifest-adaptation boundaries, never in newly compiled plans.

Add a fontkit-based measurement seam that measures primary and accent token text at their actual scale. `compileMaulEditorialEnvelope` must union primary bounds, accent bounds, offsets, rotation, overlap, local reveal excursion, and annotation padding, then return the normalized `maximumEnvelope` used by the placement planner. The renderer must receive the same values through the placement plan.

Remove the hardcoded `-14` accent offset, `-2/-3` degree default tilt, and unmeasured `1.72` accent scale from the default path. Defaults become zero rotation and policy-selected scale/overlap, with non-zero values requiring a grammar rationale.

- [ ] **Step 4: Run shared/backend contract tests and typecheck**

Run: `npm --workspace @prometheus/shared-types run build`; `npm --workspace @prometheus/backend test -- src/maul/editorial-lockup.test.ts`; `npm run typecheck:maul`

Expected: PASS with old manifest fixtures adapting at the boundary and new lockups carrying the position contract.

- [ ] **Step 5: Commit the geometry slice**

```powershell
git add -- packages/shared-types/src/maul-editorial-lockup.ts packages/shared-types/src/maul-text-placement.ts backend/src/maul/typography-layout.ts backend/src/maul/editorial-lockup.ts backend/src/maul/service.ts packages/shared-types/src/maul-editorial-lockup.test.ts packages/shared-types/src/maul-text-placement.test.ts backend/src/maul/editorial-lockup.test.ts
git commit -m "feat(maul): compile final typography envelopes"
```

### Task 4: Word/Letter-Level Position-Locked Animation

**Files:**
- Modify: `packages/shared-types/src/maul-text-animation.ts`
- Modify: `backend/src/maul/planning.ts`
- Modify: `remotion-app/src/compositions/MaulPlannedTextLayer.tsx`
- Test: `packages/shared-types/src/maul-text-animation.test.ts`
- Test: `remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx`
- Test: `backend/src/maul/planning.test.ts`

- [ ] **Step 1: Write the failing position-invariance tests**

```ts
it("emits token-scoped position-locked programs for editorial lockups", () => {
  const plan = buildMaulTextAnimationPlanPayload(fixtureInputs);
  expect(plan.programs.every((program) => program.target.scope === "tokens")).toBe(true);
  expect(plan.programs.every((program) => program.phases.hold.to.translateXPx === 0)).toBe(true);
});

it("keeps each word anchor fixed while its reveal changes opacity", () => {
  const entry = resolveMaulEditorialWordTransform({
    lockup,
    tokenId: "token_strategy",
    segmentStartMs: 0,
    fontSizePx: 72,
    absoluteTimeMs: 200,
  });
  const hold = resolveMaulEditorialWordTransform({
    lockup,
    tokenId: "token_strategy",
    segmentStartMs: 0,
    fontSizePx: 72,
    absoluteTimeMs: 600,
  });
  expect(hold.translateXPx).toBe(entry.translateXPx);
  expect(hold.translateYPx).toBe(entry.translateYPx);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm --workspace @prometheus/shared-types test -- src/maul-text-animation.test.ts`; `npm --prefix remotion-app test -- src/compositions/__tests__/MaulPlannedTextLayer.test.tsx`; `npm --workspace @prometheus/backend test -- src/maul/planning.test.ts`

Expected: FAIL because default plans use segment scope and the editorial resolver adds `-22/+10` reveal drift.

- [ ] **Step 3: Implement local reveal programs**

Add `position_locked_word_reveal` and `position_locked_letter_reveal` treatments to the shared enum. In `planning.ts`, compile one token-target program per placement segment, choose mask/opacity/blur/tracking/scale primitives from the reference grammar and sequence cooldown, and make every hold transform the identity transform. Preserve exit timing and readable holds.

In `MaulPlannedTextLayer.tsx`, remove position drift and hold translation from `resolveMaulEditorialWordTransform`. Keep local opacity, mask, blur, tracking, and scale effects, but ensure the final computed word transform equals the lockup style's planned transform. Render attached annotations from the token span rather than as a separate moving layer.

- [ ] **Step 4: Run focused animation tests and render a static frame**

Run: `npm --workspace @prometheus/shared-types test -- src/maul-text-animation.test.ts`; `npm --prefix remotion-app test -- src/compositions/__tests__/MaulPlannedTextLayer.test.tsx`; `npx remotion still src/index.ts MaulShort --frame=30 --scale=0.25`

Expected: PASS; the still is nonblank and words do not change their planned x/y anchor between entry completion and hold.

- [ ] **Step 5: Commit the motion slice**

```powershell
git add -- packages/shared-types/src/maul-text-animation.ts backend/src/maul/planning.ts remotion-app/src/compositions/MaulPlannedTextLayer.tsx packages/shared-types/src/maul-text-animation.test.ts remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx backend/src/maul/planning.test.ts
git commit -m "feat(maul): lock editorial word animation to placement"
```

### Task 5: Source Treatment And Full Paragraph Fixture

**Files:**
- Modify: `remotion-app/src/compositions/MaulShort.tsx`
- Modify: `backend/src/maul/composition-experiment-fixtures.ts`
- Modify: `scripts/maul-composition-experiment.ts`
- Create: `scripts/maul-reference-typography-proof.ts`
- Test: `remotion-app/src/compositions/__tests__/MaulShort.test.ts`
- Test: `backend/src/maul/composition-experiment-fixtures.test.ts`

- [ ] **Step 1: Write failing source-treatment and paragraph tests**

```ts
it("declares and renders subject_focus_grade_v1", () => {
  const markup = renderToStaticMarkup(React.createElement(MaulSourceTreatment, {profileId: "subject_focus_grade_v1"}));
  expect(markup).toContain('data-maul-source-treatment="subject_focus_grade_v1"');
  expect(markup).toContain("radial-gradient");
});

it("preserves the supplied paragraph as source-grounded chunks", () => {
  expect(buildReferenceTypographyParagraph().text).toContain("speed is everything");
  expect(buildReferenceTypographyParagraph().text).toContain("guarantees it");
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm --prefix remotion-app test -- src/compositions/__tests__/MaulShort.test.ts`; `npm --workspace @prometheus/backend test -- src/maul/composition-experiment-fixtures.test.ts`

Expected: FAIL because the source grade is implicit and the paragraph fixture is not registered.

- [ ] **Step 3: Add the explicit grade and canonical paragraph harness**

Add `MaulSourceTreatment` as an `AbsoluteFill` overlay with a governed `subject_focus_grade_v1` profile. Keep the current source filter, lower-frame density, and dark carrier; add only a restrained edge falloff, with a profile data attribute and manifest field. Add the supplied paragraph verbatim to the fixture/harness and derive deterministic word timings from the existing transcript/chunking seam.

The proof script must use the canonical `MaulShort` render, retain frames at 1/2/3 seconds, generate a typography-suppressed control, and write declared/observed/fidelity artifacts. It must fail if any placement mismatch or hard failure is present.

- [ ] **Step 4: Run source tests and the paragraph harness**

Run: `npm --prefix remotion-app test -- src/compositions/__tests__/MaulShort.test.ts`; `npm --workspace @prometheus/backend test -- src/maul/composition-experiment-fixtures.test.ts`; `npx tsx scripts/maul-reference-typography-proof.ts --fixture female --text-file artifacts/reference-review/paragraph.txt`

Expected: PASS for contract tests and a retained proof bundle with source treatment declared.

- [ ] **Step 5: Commit the fixture/treatment slice**

```powershell
git add -- remotion-app/src/compositions/MaulShort.tsx backend/src/maul/composition-experiment-fixtures.ts scripts/maul-composition-experiment.ts scripts/maul-reference-typography-proof.ts remotion-app/src/compositions/__tests__/MaulShort.test.ts backend/src/maul/composition-experiment-fixtures.test.ts artifacts/reference-review/paragraph.txt
git commit -m "feat(maul): add governed source grade and paragraph proof"
```

### Task 6: End-To-End Verification And Review Evidence

**Files:**
- Modify: `docs/superpowers/specs/2026-08-07-maul-reference-typography-policy-design.md` only if implementation evidence changes a claim
- Output: `artifacts/reference-review/maul-paragraph-proof/`

- [ ] **Step 1: Run all MAUL shared/backend/Remotion tests**

Run: `npm test -- --run`; `npm run typecheck:maul`

Expected: PASS with no type errors.

- [ ] **Step 2: Run the canonical paragraph proof twice**

Run: `npx tsx scripts/maul-reference-typography-proof.ts --fixture female --text-file artifacts/reference-review/paragraph.txt --output artifacts/reference-review/maul-paragraph-proof/run-a`; repeat with `run-b`.

Expected: identical declared and observed fingerprints, no hard failures, no placement mismatch, and stable word anchors across sampled frames.

- [ ] **Step 3: Inspect retained media and pixel evidence**

Open the 1/2/3-second repair frames and the rendered video. Confirm mixed case where semantically appropriate, at least one role-appropriate font contrast, no default yellow unless selected by policy, no face/microphone obstruction, no whole-lockup travel, and readable support text.

- [ ] **Step 4: Run `git diff --check` and report evidence**

Run: `git diff --check`; `git status --short`

Expected: clean diff check; report only files changed by this implementation and retain unrelated user work untouched.
