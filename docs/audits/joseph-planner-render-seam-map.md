# Joseph Planner-Render Seam Map

Date: 2026-06-26

This is a report-only audit of the Joseph planning and render path before the next Joseph tracker chunk proceeds. It records the current split between the rich planning stack and the live render stack, plus the safest consolidation direction.

## Executive Diagnosis

Joseph currently has two partial stacks:

- Stack A, the planning brain, lives under `remotion-app/src/creative-orchestration`. It contains rich planning concepts such as Treatment Genomes, Sequence Memory, Quality-Diversity Archive, beam search, Negative Grammar, pairwise taste criticism, Planning Snapshots, and Planner Audits.
- Stack B, the render spine, lives under `backend/src/director` and feeds `remotion-app/src/compositions/JosephEdit.tsx`. It owns the live worker path, manifest generation, render vocabulary, evidence ledger, deterministic variation, micro-animation primitives, PiP plans, background plans, and typography intelligence.

The root problem is not that one stack should simply replace the other. Stack B is the production path, but Stack A contains valuable algorithms that are currently orphaned from the manifest that reaches the renderer. The missing module is a deterministic Manifest Compiler between selected planning intent and `UnifiedRenderManifest`.

## Verified Stack A

Stack A entry points and concepts:

- `ExistingAgentOrchestratorAdapter.decideMoment()` adapts Creative Context and Creative Moments into judgment input.
- `CoreJudgmentEngine.plan()` emits rich editorial decisions with rhetorical purpose, emotional spine, selected treatment, visual priority ranking, assignments, governance, and audit material.
- `SteppingStonePlanner.plan()` emits a treatment shortlist plus a rich Planner Audit containing observation and planning snapshots, archive entries, beam candidates, selected path, and handoff trace.
- The reusable algorithms worth preserving are Sequence Objective scoring, Negative Grammar predicates, pairwise taste criticism, Quality-Diversity Archive behavior, sequence metric derivation, and selected budget concepts.

Stack A is valuable as algorithm source material, but its orchestration shape is not the live Joseph render path.

## Verified Stack B

Stack B entry points and concepts:

- `orchestrateRender()` builds candidate genomes, judges them, creates the Joseph manifest, persists evidence, and returns the manifest used downstream.
- `generateJosephManifest()` and `generateCandidateGenomes()` define the currently live director vocabulary.
- `JudgmentLayer.judgeCandidates()` evaluates candidate genomes for the backend path.
- `UnifiedRenderManifest` is the render contract consumed by `JosephEdit.tsx`.
- The Joseph manifest now carries micro-animation selections, PiP composition planning, background primitives, and typography intelligence.

Stack B should remain the spine because it owns the worker path, the renderable manifest, and the production contracts.

## Collision Points

### Planner Audit Name Collision

There was a historical collision where two unrelated artifacts were both called `PlannerAudit`:

- The rich planner trace from Stack A, containing observation snapshots, planning snapshots, doctrine branches, genome candidates, archive hits, beam expansions, selected path, and shortlist handoff.
- The backend orchestration summary in Stack B, containing cognitive decision, governed prompt, candidate scores, expected cuts, and sequence memory.

The backend summary is named Candidate Score Summary, leaving Planner Audit for the full planner trace.

### Micro-Animation Collapse

The backend primitive catalog selects rich micro-animation primitives. The renderer currently branches on the legacy `overlay.animation` strings in `JosephEdit.tsx`, which means primitive IDs collapse into a small fallback vocabulary. The render contract does not yet prove that every primitive ID has a distinct render branch.

### PiP Depth Collapse

The backend PiP plan contains frame depth, background layers, typography zones, active motion, coexistence rules, and defocus/protection intent. The current renderer uses the plan only partially and renders the source footage through a flat video plane path. Depth, matte population, z-order, and background defocus are not yet contractual renderer behavior.

### Camera Momentum Reset

`CameraRig` resets camera position and rotation every frame before applying the active move. This prevents continuous entry and exit velocity handoff between camera moves.

### Evaluator Duplication

Stack B has the live `JudgmentLayer`. Stack A contains Negative Grammar and pairwise taste criticism that are valuable but separate. The project needs one evaluator path with ported predicates and metrics, not two competing judgment layers.

## Missing Contract

The repository does not yet have a single contract test proving this full handoff:

1. The planner chooses a treatment genome and records its audit.
2. The Manifest Compiler emits every render-relevant field into `UnifiedRenderManifest`.
3. The renderer uses those fields rather than falling back to legacy strings or flat defaults.
4. Every primitive ID in the Joseph catalogs has a tested render branch or an explicit governed fallback.

## Consolidation Direction

Keep Stack B as the production spine. Graft Stack A algorithms into Stack B as pure, testable libraries. Add a Manifest Compiler that translates selected planner intent into an expanded `UnifiedRenderManifest`. Rename the backend flat audit summary so Planner Audit means one thing. Only after those contracts are green should Stack A apparatus be removed.

## Safe First Slice

The first implementation slice should be Phase 0 only:

- Pin the current render seam with baseline contract tests.
- Keep the backend scoring artifact named Candidate Score Summary without behavior changes.
- Add issue-tracker and documentation references so #10 and #11 do not build on the old ambiguous middle.
- Keep renders identical.

