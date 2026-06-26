# Joseph Stack Consolidation Plan

Date: 2026-06-26

## Decision

Joseph should consolidate around the backend director path as the production spine, while porting the strongest planning algorithms from `creative-orchestration` as pure libraries. The duplicated middle should collapse into one planner, one Judgment Layer, one Sequence Memory concept, one Planner Audit concept, and one Manifest Compiler handoff.

This plan intentionally avoids deleting Stack A first. Stack A contains useful algorithms, but its orchestration apparatus is not the path that renders Joseph videos today.

## Target Architecture

The target flow is:

1. Director input is normalized into phrases, beats, assets, timing, and production constraints.
2. The unified planner ranks treatment genomes using sequence objective, negative grammar, taste criticism, archive diversity, and deterministic constraints.
3. The Manifest Compiler translates the selected treatment path into `UnifiedRenderManifest`.
4. The Judgment Layer evaluates candidates and records the governed decision.
5. Evidence, ledger records, variation checks, and canonicalization run against the compiled manifest.
6. `JosephEdit` renders the manifest without inventing fallback intent.

## Deep Modules

### Unified Planner

The Unified Planner owns candidate ranking and sequence-level tradeoffs. It should consume Stack B data shapes and expose a small deterministic interface that can be tested without Remotion.

Responsibilities:

- Rank candidate treatment genomes.
- Apply Sequence Objective scoring.
- Apply Negative Grammar predicates.
- Use pairwise taste criticism as a re-ranker.
- Track Sequence Memory for contrast and anti-repetition.
- Optionally preserve Quality-Diversity Archive behavior for diverse strong candidates.

### Manifest Compiler

The Manifest Compiler is the contract module between planning intent and rendering. It should accept the selected planner decision and emit an expanded `UnifiedRenderManifest`.

Responsibilities:

- Preserve micro-animation primitive IDs as authoritative renderer instructions.
- Expand PiP depth, matte, z-order, populated layer, and background defocus intent.
- Carry camera entry and exit velocity hints.
- Preserve typography, background, source-footage, and overlay layering rules.
- Attach the rich Planner Audit separately from candidate score summaries.

### Candidate Score Summary

Candidate Score Summary replaces the backend's current flat `PlannerAudit` name. It should describe candidate scoring and expected cuts, but it should not pretend to be the full planner trace.

### Render Contract Tests

Render contract tests prove that planner-selected manifest fields reach renderer behavior. They should prefer observable output, schema shape, and stable render branch coverage over private implementation details.

## Graft, Defer, Excise

| Category | Items | Rationale |
| --- | --- | --- |
| Keep as spine | Backend director, worker path, evidence ledger, deterministic variation, canonicalization, `UnifiedRenderManifest`, `JosephEdit` | These are the live production contracts. |
| Graft soon | Sequence Objective, Negative Grammar predicates, pairwise taste critic, QD archive behavior, sequence metrics | These are useful algorithms and can be made pure against Stack B data. |
| Defer | Doctrine branch engine, observation/planning snapshot engines, retrieval policy, governance/deviation machinery, creator budget learning | These need a stable planner-render handoff first. |
| Excise later | Creative Context orchestration apparatus, duplicate Core Judgment stack, duplicate Sequence Memory engine, duplicate Planner Audit type | These should go only after grafted behavior has equivalent coverage. |

## Rollout Plan

### Phase 0: Audit And Freeze

Pin current behavior before changing architecture.

- Add baseline contract tests for manifest-to-render behavior.
- Rename backend flat `PlannerAudit` to Candidate Score Summary.
- Keep generated manifests and renders identical.
- Record the architecture decision and PRD in the issue tracker.

Gate: existing Joseph backend and shared-type tests remain green; render behavior is unchanged.

### Phase 1: Unify The Middle

Port sequence-memory metrics and Negative Grammar predicates into Stack B libraries. Wire them into the live Judgment Layer behind a deterministic option or kill switch.

Gate: candidate scores explain the new penalties and all existing renders remain deterministic.

### Phase 2: Build The Manifest Compiler

Introduce the Manifest Compiler as a pass-through first. It should carry the richer fields but initially preserve old renderer behavior.

Gate: compiled manifests are schema-valid, canonicalized, and byte-stable for existing inputs where the new fields are disabled.

### Phase 3: Graft Sequence Objective And Archive Diversity

Replace seed-only doctrine choice with objective ranking and QD-aware diversity. Keep deterministic fallbacks.

Gate: variation and determinism suites pass; audit output explains why the winning treatment path was selected.

### Phase 4: Wire Renderer Fields Incrementally

Turn on renderer behavior one primitive family at a time.

- Micro-animation primitive IDs become authoritative.
- PiP layers use depth, matte, z-order, and populated-state fields.
- Camera moves use entry and exit velocity hints.
- Typography and background layering rules remain protected.

Gate: every primitive ID either has a distinct render branch or an explicit governed fallback.

### Phase 5: Excise Stack A Apparatus

Remove orphaned orchestration after its useful algorithms have been ported and covered.

Gate: no live imports depend on the old apparatus, and the consolidated planner has equivalent or stronger tests.

## Risk Controls

- Determinism risk: keep seeded decisions and canonicalization tests at every phase.
- Render regression risk: compile richer fields before renderer behavior changes.
- Naming risk: reserve Planner Audit for the rich planner trace and use Candidate Score Summary for flat backend scoring summaries.
- Scope risk: defer governance, retrieval policy, and doctrine-branch expansion until the compiler seam is stable.
- Deletion risk: remove Stack A apparatus only after behavior is grafted and tested.

## Acceptance Proof

The consolidation is complete when:

- The issue tracker has a PRD and phased issues for the consolidation work.
- The backend director owns the only live Joseph planning and judgment path.
- `UnifiedRenderManifest` contains the planner-selected fields the renderer needs.
- `JosephEdit` renders micro-animation, PiP, typography, background, and camera intent from the manifest contract.
- Planner Audit and Candidate Score Summary are distinct named artifacts.
- Stack A contains no live duplicate orchestration, or only pure archived references waiting for deletion.

