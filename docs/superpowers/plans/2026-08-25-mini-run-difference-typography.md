# Mini-Run Difference Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic, rare `difference` blend-mode hero typography to Mini-Run manifests and Remotion renders.

**Architecture:** The Python typography generator preselects eligible foreground chunks with a bounded cooldown and marks every layer in those caption groups. The React renderer converts that manifest field into neutral white `mix-blend-mode: difference` paint at both the layer paint and transformed caption-group boundary while preserving kinetic animation.

**Tech Stack:** Python 3 `unittest`, TypeScript, React, Remotion, Vitest

## Global Constraints

- Use one treatment in runs of 15 chunks or fewer and at most two in longer runs.
- Keep selected chunks at least five chunk positions apart.
- Exclude behind-subject, glass/see-through, and 3D extrusion typography.
- Seeded manifests must remain reproducible.
- Difference paint must be solid white with no gradient, glow, filter, or text shadow.

---

### Task 1: Manifest Selection

**Files:**
- Modify: `tests/test_mini_run_luxury_treatment.py`
- Modify: `mini_run_pipeline/typography.py`

**Interfaces:**
- Produces: `_select_difference_chunk_indices(chunks, behind_subject_indices, rng) -> set[int]`
- Produces: optional layer field `blendMode: "difference"`

- [ ] **Step 1: Write failing manifest tests**

Add tests that generate a 20-chunk seeded manifest and assert one or two selected chunk indices, a minimum index distance of five, full-caption marking, foreground-only marking, neutral paint fields, and identical selection for the same seed.

- [ ] **Step 2: Run the tests and verify RED**

Run: `python -m pytest tests/test_mini_run_luxury_treatment.py -k difference -q`
Expected: FAIL because no layer contains `blendMode`.

- [ ] **Step 3: Implement the bounded selector and layer contract**

Rank eligible foreground chunks by `_chunk_signal(chunk)["salience"]` with seeded random tie-breaking. Select one index for up to 15 chunks or two for longer runs, respecting the five-index cooldown. Set `blendMode` on every layer in selected captions and override their paint dictionaries to white/no effects.

- [ ] **Step 4: Run focused Python tests and verify GREEN**

Run: `python -m pytest tests/test_mini_run_luxury_treatment.py -k 'difference or deterministic' -q`
Expected: PASS.

### Task 2: Remotion Paint Resolution

**Files:**
- Modify: `remotion-app/src/compositions/__tests__/PrometheusMinRun.test.ts`
- Modify: `remotion-app/src/compositions/PrometheusMinRun.tsx`

**Interfaces:**
- Consumes: `TypographyLayer.blendMode?: "difference"`
- Produces: `resolveTypographyPaintStyle(layer: TypographyLayer): React.CSSProperties`

- [ ] **Step 1: Write failing renderer tests**

Add a literal layer fixture and assert that difference paint returns white text, `mixBlendMode: "difference"`, and no gradient/filter/shadow. Assert a normal gradient layer retains clipped gradient paint.

- [ ] **Step 2: Run the Vitest file and verify RED**

Run: `npm test -- src/compositions/__tests__/PrometheusMinRun.test.ts`
Expected: FAIL because `resolveTypographyPaintStyle` is not exported.

- [ ] **Step 3: Implement and consume the paint resolver**

Add the optional type field, export the pure resolver, and spread its result into `baseTextStyle`. Ensure later kinetic spans do not reintroduce text shadows in difference mode.

- [ ] **Step 4: Run renderer tests and typecheck**

Run: `npm test -- src/compositions/__tests__/PrometheusMinRun.test.ts`
Run: `npm run typecheck`
Expected: PASS.

### Task 3: Integrated Verification

**Files:**
- Verify: `mini_run_pipeline/typography.py`
- Verify: `remotion-app/src/compositions/PrometheusMinRun.tsx`

**Interfaces:**
- Consumes: seeded manifest and Remotion composition
- Produces: regression evidence

- [ ] **Step 1: Run complete focused suites**

Run: `python -m pytest tests/test_mini_run_luxury_treatment.py tests/test_subject_safe_typography.py -q`
Run: `npm test -- src/compositions/__tests__/PrometheusMinRun.test.ts`

- [ ] **Step 2: Render a representative frame**

Generate a seeded manifest, identify a difference-treated timestamp, render that frame through `PrometheusMinRun`, and inspect the output for nonblank video and visible inverted text.

- [ ] **Step 3: Review the final diff**

Run: `git diff --check` and inspect only the feature's changed hunks, preserving all pre-existing worktree changes.
