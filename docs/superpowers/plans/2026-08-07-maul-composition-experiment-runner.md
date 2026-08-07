# MAUL Composition Experiment Runner Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` and execute this plan task-by-task with strict red-green-refactor discipline.

**Goal:** Deliver one real 9:16 causal experiment in which Scene A produces a baseline and a dependency-closed semantic-hierarchy repair through the existing MAUL manifest compiler and canonical `MaulShort` Remotion renderer, independent pixel observation distinguishes declared intent from rendered reality, a human can submit a blinded A/B/tie judgment, and that experiment-only evidence can be ablated on held-out Scene B without entering production Pattern Memory.

**Architecture:** Add one narrow `CompositionExperimentRunner` coordinator around existing MAUL authorities. Fixture evidence supplies immutable scene facts; Semantic Typography Tree and repair modules produce hierarchy intent; `MaulProjectService` exposes manifest-only compilation through its existing compiler; `renderMaulShortLocally` remains the canonical renderer; each condition also renders a timestamp-matched `typography_suppressed` control through the same manifest and `MaulShort` path; the observer measures their pixel delta; review and retrieval adapters retain raw experiment evidence without becoming an evaluator or memory authority.

**Tech Stack:** TypeScript, Zod, Vitest, existing MAUL project/store/planning modules, Remotion `MaulShort`, repository-owned Remotion FFmpeg/FFprobe, Node crypto/fs, fontkit, JSON experiment artifacts.

---

## Non-Negotiable Experiment Invariants

- The exact source hashes, phrases, crops, source groups, frame times, and reference hashes in the approved specification are immutable inputs.
- `test-matte.mp4` is a negative fixture only and can never satisfy scene evidence.
- Scene A alpha is read from the immutable RGBA PNG before carrier flattening.
- Scene B is source-group held out and uses reviewed 7 s, 9 s, and 11 s semantic regions.
- The baseline and repair share source, scene evidence, treatment, font assets, placement family, color, motion family, seed, and render budget. Only semantic hierarchy plus its declared dependency closure may differ.
- Manifest compilation uses `compileMaulUnifiedShortRenderManifest` through `MaulProjectService`; the runner does not assemble a parallel manifest.
- Canonical rendering uses `renderMaulShortLocally` and Remotion composition `MaulShort`.
- Canonical observation controls use that same manifest, renderer, source treatment, camera path, timing, and sample times; only planned and legacy typography layers are suppressed.
- Observed values come from retained PNG pixels or explicit independent runtime probes. Missing proof remains `unobserved`.
- Opportunity-level controlled-overlap evidence must reach the placement hard gate; a broad subject box cannot override explicit zero-face-interference evidence.
- Editorial beat boundaries do not create scene discontinuities without an explicit source, camera, tracking, or scene change.
- Blocked placement fails before animation construction with its original reason.
- Retained non-interlaced 8-bit RGB and RGBA PNGs are accepted and normalized for observation.
- Existing pre-render Quality Truth compatibility data is never accepted as Observed Composition.
- Review inference never receives winner identity, verdict, or post-review labels. Ties and `no_meaningful_preference` are first-class.
- Scene A evidence remains `experiment_only`; one result cannot be promoted into `backend/src/pattern-memory`.
- No Q1/Yuan parity or general statistical-confidence claim is permitted from this experiment.

## Task 1: Resolve Repository-Owned Media Tools

**Files:**

- Create: `backend/src/maul/repository-media-tools.ts`
- Create: `backend/src/maul/repository-media-tools.test.ts`
- Modify: `backend/src/maul/render-engine.ts`

- [ ] Write a failing test proving FFmpeg resolves under `remotion-app/node_modules/@remotion/compositor-*` when global `PATH` contains no `ffmpeg`.
- [ ] Write a failing test proving an explicit `FFMPEG_PATH` or injected executable is validated and wins over repository discovery.
- [ ] Run `npm test -- repository-media-tools.test.ts` in `backend/`; expect failures because the resolver does not exist.
- [ ] Implement a deterministic resolver that checks explicit configuration, platform-appropriate installed Remotion compositor packages, then global command only as a named degraded fallback.
- [ ] Return a structured receipt with executable path, source (`configured`, `remotion_bundle`, or `global_path`), and availability; do not silently return an absent path.
- [ ] Replace `execFile("ffmpeg", ...)` in `render-engine.ts` with the verified resolver.
- [ ] Inject the resolver in unit tests so extraction behavior can be tested without invoking a real render.
- [ ] Re-run the focused test and `npm run typecheck` in `backend/`.
- [ ] Commit: `fix(maul): resolve repository media tools`

## Task 2: Bind and Validate Experiment Fixtures

**Files:**

- Create: `backend/src/maul/fixtures/composition-experiment-scenes.json`
- Create: `backend/src/maul/composition-experiment-fixtures.ts`
- Create: `backend/src/maul/composition-experiment-fixtures.test.ts`

- [ ] Write failing tests for the exact Scene A and Scene B source SHA-256 values, geometry, phrases, source groups, crop, interval, and frame samples.
- [ ] Write a failing test that rejects `remotion-app/public/test-matte.mp4` by hash and provenance even if a caller labels it `verified`.
- [ ] Write a failing test that rejects Scene B when any 7 s, 9 s, or 11 s annotation is absent, outside normalized bounds, not independently reviewed, or bound to a different source/crop hash.
- [ ] Run `npm test -- composition-experiment-fixtures.test.ts`; expect missing-module failures.
- [ ] Add the reviewed Scene B semantic-map sidecar with normalized `critical`, `protected`, `flexible`, and `free` regions for all three bound frames, annotation provenance, reviewer kind, review timestamp, source hash, crop hash, and status.
- [ ] Implement fixture loading and strict validation with no filename-only trust.
- [ ] Use repository FFmpeg to read Scene A alpha as raw grayscale; calculate mask occupancy and normalized subject bounds from nonzero alpha without reading declared placement.
- [ ] Emit a Scene Evidence provider adapter whose provenance points to alpha pixels for Scene A and reviewed map records for Scene B.
- [ ] Save visual annotation overlays under ignored `artifacts/maul-composition-experiment/fixture-review/` for human inspection; do not use snapshots as the only assertions.
- [ ] Re-run focused tests and inspect all four overlays.
- [ ] Commit: `feat(maul): bind composition experiment evidence`

## Task 3: Represent Semantic Typography Before Layout

**Files:**

- Create: `backend/src/maul/semantic-typography-tree.ts`
- Create: `backend/src/maul/semantic-typography-tree.test.ts`
- Modify: `backend/src/maul/editorial-lockup.ts`
- Modify: `backend/src/maul/editorial-lockup.test.ts`

- [ ] Write failing tests that `MAKE IDEAS MATTER` produces at least two source-grounded hypotheses, including `MATTER` as hero and a competing broader hero phrase, each with evidence and confidence.
- [ ] Write failing tests that `BUILD LASTING AUTHORITY` retains `AUTHORITY` as hero while preserving alternative hypotheses for held-out search.
- [ ] Write a regression test proving no unexplained last-token heuristic can silently become the selected hierarchy.
- [ ] Add a typed Semantic Typography Tree containing token/source spans, roles (`hero`, `support`, `accent`, `tail`), semantic evidence, hypothesis confidence, and provenance.
- [ ] Add an adapter from the selected tree to the existing governed text-chunk proposal and editorial-lockup inputs; preserve the tree ID and selected role IDs in causal metadata.
- [ ] Update editorial lockup selection to consume explicit hierarchy roles when present while preserving existing behavior for legacy callers.
- [ ] Re-run semantic and editorial-lockup tests.
- [ ] Commit: `feat(maul): preserve semantic typography hypotheses`

## Task 4: Enforce Dependency-Closed Hierarchy Repair

**Files:**

- Create: `backend/src/maul/composition-repair.ts`
- Create: `backend/src/maul/composition-repair.test.ts`

- [ ] Write a failing test for the dependency graph `semanticHierarchy -> fontRoleAssignment -> shaping -> lineBreaks -> glyphBounds -> collision -> balance -> declaration`.
- [ ] Write a failing test proving a hierarchy repair recomputes the complete transitive closure and cannot claim that changed glyph geometry remained frozen.
- [ ] Write a failing test proving source transform, scene evidence, treatment family, palette, motion family, renderer, seed, and budget remain frozen.
- [ ] Write a failing test proving an attempted unrelated mutation blocks with the exact changed dimension.
- [ ] Implement the versioned dependency graph, closure calculation, normalized before/after fingerprints, frozen-dimension assertion, and repair ledger entry.
- [ ] Re-run focused tests.
- [ ] Commit: `feat(maul): enforce dependency-closed composition repair`

## Task 5: Expose Existing Manifest Compilation Without Rendering

**Files:**

- Modify: `backend/src/maul/service.ts`
- Modify: `backend/src/__tests__/maul-short-render-path.test.ts`

- [ ] Write a failing service integration test for `compileRenderManifest`: it accepts a preview render request, validates full lineage, invokes the existing `compileMaulUnifiedShortRenderManifest`, persists one `render_manifest`, and does not invoke Quality Truth, Perceptual Truth, or the renderer.
- [ ] Write a regression test that `renderPreview` and `renderShort` still use the same persisted manifest compiler path.
- [ ] Refactor `renderWithMode` minimally to support a manifest-only mode after manifest registration and before any legacy proof or render call.
- [ ] Return the governed manifest artifact and its causal plan artifacts; do not duplicate preparation or schema assembly.
- [ ] Re-run `maul-short-render-path.test.ts`, relevant planning tests, and backend typecheck.
- [ ] Commit: `refactor(maul): expose governed manifest compilation`

## Task 6: Freeze Declared Composition and Capability Coverage

**Files:**

- Create: `backend/src/maul/composition-experiment-contracts.ts`
- Create: `backend/src/maul/composition-experiment-contracts.test.ts`
- Create: `backend/src/maul/composition-capability-coverage.ts`
- Create: `backend/src/maul/composition-capability-coverage.test.ts`

- [ ] Write failing schema tests requiring causal IDs from fixture, reference observations, tree hypothesis, treatment genome, planning bundle, realization, declaration, manifest, renderer version, and observer version.
- [ ] Require exact font asset IDs/hashes, role mapping, line breaks, expected bounds, placement/depth, treatment primitives, motion, source transform, and required observations.
- [ ] Write failing tests that a declaration cannot use an unverified font, unsupported adapter, silent fallback, missing scene evidence, or a manifest field with no capability mapping.
- [ ] Inventory existing typography, SVG, animation, placement, Joseph-transfer, scene, font, renderer, policy, prompt, dataset, reference, fixture, and test capabilities into a versioned per-run coverage report.
- [ ] Require every plausible capability to be `selected`, `adapted`, `rejected`, or `unavailable` with a structured reason and executable evidence reference.
- [ ] Implement declaration freezing and deterministic hashing; mutation creates a new declaration with parent lineage.
- [ ] Re-run focused tests.
- [ ] Commit: `feat(maul): freeze declared composition traces`

## Task 7: Measure Observed Composition From Pixels

**Files:**

- Create: `backend/src/maul/composition-observer.ts`
- Create: `backend/src/maul/composition-observer.test.ts`
- Create: `backend/src/maul/composition-fidelity.ts`
- Create: `backend/src/maul/composition-fidelity.test.ts`
- Modify: `backend/src/maul/render-engine.ts`

- [ ] Write a failing test proving arbitrary PNG bytes cannot yield an observed pass.
- [ ] Write a failing test proving observed text bounds, occupancy, connected regions, subject intersection, hierarchy area ratio, and temporal stability are measured from decoded retained-frame pixels.
- [ ] Write a failing test proving the observer cannot fill an absent font, mask, treatment, or motion measurement from the declaration or manifest.
- [ ] Add final-render frame retention at requested sample times; retain the same PNG evidence contract currently available only in preview mode.
- [ ] Add `creative` and `typography_suppressed` modes to the canonical `MaulShort` render input; suppression must preserve source/camera/treatment execution while omitting planned and legacy text.
- [ ] Render timestamp-matched control frames from the same manifest and compare them with creative frames using explicit thresholds and provenance; immutable carrier frames remain fixture evidence, not typography controls.
- [ ] Decode non-interlaced 8-bit RGB and RGBA retained PNGs and normalize both to RGBA before measurement.
- [ ] Compute normalized text-region geometry, alpha-mask intersection, critical/protected/flexible overlap, observed hierarchy area ratio, frame-to-frame trajectory, and unobserved fields.
- [ ] Add an independent font capability probe using the exact verified font asset and browser/canvas or fontkit geometry. Treat it as capability evidence; actual render identity remains inferred or `unobserved` unless pixel/runtime evidence supports it.
- [ ] Build a structured Fidelity Report with categorical failures first, numeric deltas second, and no opaque score that can hide a hard mismatch.
- [ ] Re-run observer/fidelity tests and render-engine regressions.
- [ ] Commit: `feat(maul): observe rendered composition pixels`

## Task 8: Capture Blinded Reviewed Composition Evidence

**Files:**

- Create: `backend/src/maul/composition-review.ts`
- Create: `backend/src/maul/composition-review.test.ts`
- Create: `scripts/maul-composition-review.ts`

- [ ] Write failing tests that randomize A/B presentation deterministically from a hidden review seed and expose no baseline/repair identity in the review payload.
- [ ] Write failing swap-invariance and target-leakage tests: inference features contain no winner ID, verdict, post-review failure labels, or tie-breaking access to ground truth.
- [ ] Write failing tests for `a`, `b`, `tie`, and `no_meaningful_preference`, reviewer confidence, per-candidate failure dimensions, source group, fingerprints, and mutation provenance.
- [ ] Implement review-package generation and a CLI that records a reviewer response without changing either candidate.
- [ ] Keep raw review evidence in the experiment output; do not call `recordPatternMemoryOutcome` for one Scene A result.
- [ ] Re-run focused tests.
- [ ] Commit: `feat(maul): capture blinded composition review evidence`

## Task 9: Implement the Composition Experiment Runner

**Files:**

- Create: `backend/src/maul/composition-experiment-runner.ts`
- Create: `backend/src/maul/composition-experiment-runner.test.ts`
- Create: `scripts/maul-composition-experiment.ts`
- Modify: `package.json` or `backend/package.json` only if a script alias materially improves repeatability.

- [ ] Write a failing integration test with fake renderer/observer adapters proving the runner coordinates baseline -> declaration -> manifest -> creative render -> typography-suppressed control render -> observation -> fidelity -> repair -> new declaration -> both renders -> observation -> blinded package.
- [ ] Assert the runner records every causal artifact and Decision Ledger event, uses one renderer and observer version, and does not act as their authority.
- [ ] Assert baseline and repair differ only in hierarchy and the declared dependency closure after normalization.
- [ ] Implement deterministic Scene A carrier and silent-track materialization with repository FFmpeg; preserve original alpha evidence separately.
- [ ] Use one MAUL project/candidate/treatment and two planning bundles under the same source and seed so unrelated planning choices remain stable.
- [ ] Compile both manifests with `compileRenderManifest`; for each, render creative and typography-suppressed 1080x1920 outputs through `renderMaulShortLocally`, retain matching 1 s, 2 s, and 3 s frames, observe their pixel delta, and emit Fidelity Reports.
- [ ] Generate a blinded review package containing side-by-side stills and both MP4s under ignored `artifacts/maul-composition-experiment/scene-a/`.
- [ ] Emit `trace.json`, `capability-coverage.json`, declarations, manifests, creative/control MP4s and frame hashes, observed compositions, fidelity reports, repair ledger, and review package with hashes.
- [ ] Re-run the runner integration test and backend typecheck.
- [ ] Commit: `feat(maul): run causal composition experiment`

## Task 10: Add Held-Out Retrieval Ablation

**Files:**

- Create: `backend/src/maul/composition-evidence-retrieval.ts`
- Create: `backend/src/maul/composition-evidence-retrieval.test.ts`
- Modify: `backend/src/maul/composition-experiment-runner.ts`
- Modify: `scripts/maul-composition-experiment.ts`

- [ ] Write a failing test that Scene A raw evidence is retrievable only with `experiment_only` eligibility and exact source-group exclusion.
- [ ] Write a failing test that Scene B retrieval-disabled and retrieval-enabled conditions share source, crop, phrase, scene map, seed, candidate budget, render budget, renderer version, observer version, and review protocol.
- [ ] Write a failing test that the only permitted condition delta is the retrieved Scene A hierarchy-repair evidence ID and its documented effect on candidate prior.
- [ ] Write a failing test that no held-out run can claim transfer before blinded review evidence exists.
- [ ] Implement the retrieval adapter against exported experiment evidence; do not add a second Pattern Memory store.
- [ ] Run both Scene B conditions through the canonical compiler/renderer/observer path and create a second blinded package under `artifacts/maul-composition-experiment/scene-b/`.
- [ ] Emit an ablation report that states `pending_review`, `supported_for_this_protocol`, or `not_supported`, never general Q1/Yuan parity.
- [ ] Re-run focused tests.
- [ ] Commit: `feat(maul): add held-out composition evidence ablation`

## Task 11: Real Acceptance Run and Evidence Audit

**Files:**

- Modify only defects discovered by the acceptance run.
- Generate ignored evidence under `artifacts/maul-composition-experiment/`.

- [ ] Run all focused backend tests for fixtures, semantic tree, repair, contracts, observer, fidelity, review, retrieval, and runner.
- [ ] Run backend typecheck and the full backend test suite.
- [ ] Run relevant shared-types and Remotion tests plus both typechecks.
- [ ] Run `npx tsx scripts/maul-composition-experiment.ts prepare --fixture scene_a_matted_lady_hierarchy_v1`.
- [ ] Verify exact source hash, output 1080x1920, four-second duration, `MaulShort` composition receipts for both modes, nonempty timestamp-matched RGB/RGBA retained PNGs, alpha-derived mask evidence, and no accepted `test-matte.mp4` lineage.
- [ ] Inspect baseline and repair at 1 s, 2 s, and 3 s; compare each against its same-manifest typography-suppressed control and reject blank, pixel-identical, clipped, overlapping-critical-region, treatment-bypassed, or full-frame false-positive observation.
- [ ] Verify every Declared field is observed, inferred with named evidence, or explicitly `unobserved`; no manifest-copy proof is accepted.
- [ ] Present the randomized Scene A A/B/tie package for real human judgment and record the response with `scripts/maul-composition-review.ts`.
- [ ] Run Scene B retrieval-disabled and retrieval-enabled conditions only after Scene A review evidence exists and the sidecar overlay remains approved.
- [ ] Present and record the randomized Scene B review.
- [ ] Run the requirement-by-requirement audit against all 14 Definition-of-Done questions in the specification.
- [ ] Record unresolved quality gaps honestly; do not convert an engineering pass into a reference-quality claim.
- [ ] Commit any acceptance fixes separately with focused messages.

## Final Verification Commands

```bash
cd backend
npm test -- \
  repository-media-tools.test.ts \
  composition-experiment-fixtures.test.ts \
  semantic-typography-tree.test.ts \
  editorial-lockup.test.ts \
  composition-repair.test.ts \
  composition-experiment-contracts.test.ts \
  composition-capability-coverage.test.ts \
  composition-observer.test.ts \
  composition-fidelity.test.ts \
  composition-review.test.ts \
  composition-evidence-retrieval.test.ts \
  composition-experiment-runner.test.ts
npm run typecheck
npm test

cd ../packages/shared-types
npm test
npm run typecheck

cd ../../remotion-app
npm test -- src/compositions/__tests__/MaulShort.test.ts src/compositions/__tests__/MaulPlannedTextLayer.test.tsx src/compositions/__tests__/MaulCinematicLaunchContract.test.tsx
npm run typecheck

cd ..
npx tsx scripts/maul-composition-experiment.ts verify --all
git status --short
```

## Permitted Final Claims

After all engineering gates and both real reviews pass, the strongest permitted statement is:

> MAUL has a causally connected, render-verified, scene-aware 9:16 typography experiment in which a semantic-hierarchy repair can be independently observed, blindly reviewed, and reused under a controlled held-out ablation.

This experiment does not establish general Q1/Yuan-class quality, a calibrated taste model, or statistical transfer beyond the reviewed source groups.
