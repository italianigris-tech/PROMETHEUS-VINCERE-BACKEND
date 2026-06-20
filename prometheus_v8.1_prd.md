# Prometheus v8.1 PRD

Status: Draft for review
Date: 2026-06-20
Authority: `specs/ARCHITECTURE_AUTHORITY.md` and `PROMETHEUS_v8.1_ARCHITECTURE.pdf`

## Purpose

This PRD continues the Opus 4.8 roadmap audit from the point where it stopped. It converts the critique into a concrete build plan while respecting the locked v8.1 architecture authority.

The goal is not to rewrite the working system. The goal is to close the remaining gap between the current codebase and v8.1 by adding deep modules at the right seams, preserving current working modules, and making variation, judgment, memory, and evidence explicit enough for future agents to implement without architectural drift.

## Current Evidence

The following local files were inspected before this PRD was written:

- `backend/src/director/joseph-director.ts`
- `backend/src/audio/mix-audio.ts`
- `backend/src/creative-variation/index.ts`
- `backend/src/failure-intelligence/index.ts`
- `backend/src/cognitive-governor/index.ts`
- `backend/src/pattern-memory/index.ts`
- `backend/src/pattern-memory/store.ts`
- `specs/ARCHITECTURE_AUTHORITY.md`
- `PROMETHEUS_BUILD.md`
- `.agents/tickets/TICKET_REGISTRY.json`

Observed state:

- The Joseph Director is mature, but it currently emits `1920x1080`, lacks a hard 90-second cap, and does not export `generateCandidateGenomes`.
- The audio module already has voice/music volume automation, SFX delay, missing-file errors, and loudness normalization. True vocal-band sidechain ducking remains a polish/deepening item.
- `backend/src/creative-variation/index.ts` is a Quality-Diversity Archive module for `VariationGenome`. It is not a Variation Key module.
- `backend/src/failure-intelligence/index.ts` is post-hoc visible failure observability. It is not the Judgment Layer.
- `backend/src/cognitive-governor/index.ts` is not a stub. It already contains stage permission, model route, stochastic/deterministic mode, retry budget, and failure policy logic. Future orchestrator work should reuse and deepen it rather than replace it.
- Pattern Memory is a pattern-level outcome ledger and snapshot store. It is distinct from a job-level Replay Ledger.
- T20-T27 contract tests already catch the immediate Director and missing-module gaps.

## Product Goals

- Preserve the working R3F + Remotion architecture.
- Preserve the current Joseph Director public behavior where possible while correcting v8.1 violations.
- Make re-upload variation explicit through `upload_instance_id` and `retry_index`.
- Generate 2-6 deterministic candidate Treatment Genomes for each eligible input.
- Select one candidate through a governed Judgment Layer, not through hidden randomness.
- Persist chosen and rejected candidate evidence for replay, comparison, and future learning.
- Keep Sequence Memory, Pattern Memory, Creator Taste Memory, Replay Ledger, and Quality-Diversity Archive as separate concepts.
- Keep every future render reproducible from source facts, prompt facts, profile, orientation, seed, and variation key.

## Non-Goals

- Do not rewrite the Director wholesale.
- Do not replace `creative-variation/index.ts`; deepen around it.
- Do not collapse Pattern Memory and Replay Ledger.
- Do not treat Failure Intelligence as the Judgment Layer.
- Do not introduce BullMQ, Redis, distributed workers, parallel chunking, or monitor processes in MVP.
- Do not silently change architecture authority.

## Human-Gate Assumptions

### Orientation

The architecture authority locks resolution to `1080x1920 vertical`. Opus proposed one orientation per job with landscape and vertical both first-class. That is a reasonable future extension, but it conflicts with the frozen v8.1 table.

Implementation stance:

- v8.1 implementation must satisfy `1080x1920 vertical`.
- Multi-orientation should be drafted as a human-gate proposal, not implemented as authority.
- No agent may make landscape equal to vertical authority until `specs/ARCHITECTURE_AUTHORITY.md` is explicitly updated by a human.

### Replay Ledger Storage

The v8.1 authority allows SQLite or JSONL for local memory. The sprint should prefer JSONL/NDJSON first.

Reasons:

- Avoid native SQLite install risk on Windows.
- Keep evidence human-inspectable during the sprint.
- Keep the interface stable so SQLite can later become an adapter behind the same seam.

## Required Modules And Acceptance Criteria

### Variation Key

Target module: `backend/src/director/variation-key.ts`

Acceptance criteria:

- Stable key from source fingerprint, prompt fingerprint, `upload_instance_id`, `retry_index`, profile, and orientation.
- Same inputs produce the same key.
- Different retry index produces a different key.
- No hidden randomness participates in the key.
- Covered by `backend/src/director/variation-key.test.ts`.

### Candidate Generation

Target module: `backend/src/director/joseph-director.ts`

Acceptance criteria:

- Exports `generateCandidateGenomes(input, count)`.
- Emits 2-6 deterministic Treatment Genomes or manifest candidates.
- Same seed/key produces stable candidates.
- Different retry index or seed produces meaningful variation.
- Existing `generateJosephManifest` behavior is preserved except for v8.1 corrections.
- Covered by `backend/src/director/joseph-director.contract.test.ts`.

### Replay Ledger

Target module: `backend/src/ledger/replay-ledger.ts`

Acceptance criteria:

- Provides insert and lookup operations for job-level render evidence.
- Can get by source fingerprint.
- Can get by upload instance.
- Can perform similarity lookup for anti-repetition.
- Records chosen candidates, rejected candidates, quality score, failure tags, Planner Audit pointer, and created timestamp.
- Uses paths and state distinct from Pattern Memory.
- Covered by `backend/src/ledger/replay-ledger.test.ts`.

### Evidence Preservation

Target module: `backend/src/ledger/evidence-preservation.ts`

Acceptance criteria:

- Persists candidate set, rejected candidates, selected candidate, Judgment verdict, variation key, and replay metadata.
- Produces an inspectable artifact reference.
- Does not require a real render output in unit tests.
- Covered by `backend/src/ledger/evidence-preservation.test.ts`.

### Judgment Layer

Target module: `backend/src/director/judgment-layer.ts`

Acceptance criteria:

- Selects exactly one candidate from a candidate set.
- Rejects all candidates below the quality floor.
- Applies anti-repetition and similarity vetoes through the Replay Ledger.
- Uses Quality-Diversity Archive fitness as one scoring signal, not as sole authority.
- Emits selected candidate, rejected candidates, score, failure tags, and rationale.
- Is deterministic for the same inputs.
- Covered by `backend/src/director/judgment-layer.test.ts`.

### Sequence Memory

Target module: `backend/src/director/sequence-memory.ts`

Acceptance criteria:

- Implements states `calm`, `building`, `saturated`, and `recovering`.
- Prevents repeated effect patterns inside a cooldown window.
- Emits breathe/restraint decisions deterministically.
- Keeps only current-run short-term state, not long-term memory.
- Covered by `backend/src/director/sequence-memory.test.ts`.

### Prompt Governance

Target module: `backend/src/director/prompt-governance.ts`

Acceptance criteria:

- Allows prompt influence over doctrine, density, tone, and exclusions.
- Blocks prompt attempts to change stack, determinism, queue architecture, schema authority, duration cap, or render-path forbidden APIs.
- Emits explicit allow/block reasons.
- Can be used by the Top-Level Planner and Judgment Layer without parsing prompt text in multiple places.
- Covered by `backend/src/director/prompt-governance.test.ts`.

### Director Orchestrator

Target module: `backend/src/cognitive-governor/index.ts` or a narrow adapter under `backend/src/director/`

Acceptance criteria:

- Runs Candidate Generation -> Judgment Layer -> Evidence Preservation.
- Reuses the existing cognitive stage permission logic.
- Produces a selected manifest and Planner Audit.
- Does not call the renderer.
- Fails visibly if all candidates are blocked.
- Covered by a focused orchestrator contract test.

### Quality-Diversity Archive Producer

Target module: `backend/src/creative-variation/`

Acceptance criteria:

- Converts actual render verdicts into `VariationGenome` records.
- Builds or updates a MAP-Elites archive from selected and rejected outcomes.
- Preserves the four behavior dimensions: intensity, visual density, motion energy, and editorial novelty.
- Keeps variation-key logic outside the archive.
- Covered by `backend/src/creative-variation/archive-producer.test.ts`.

### SFX Variation Resolver

Target modules:

- `backend/src/director/joseph-director.ts`
- `backend/src/audio/mix-audio.ts`
- `remotion-app/public/sfx/`

Acceptance criteria:

- Supports 8 cue categories with 5 variants each.
- Director selects a seeded variant per cue.
- Audio resolver maps selected cue variants to concrete files.
- Missing variants produce visible errors or deterministic placeholders.
- Existing cue-name tests remain green.

### Determinism And Integration Scripts

Target modules:

- `scripts/verify-determinism.ts`
- `scripts/verify-variation.ts`
- `scripts/test-joseph.ts`

Acceptance criteria:

- Same variation key produces stable manifest or render hash.
- Different variation key produces meaningful variation.
- Scripts print PASS/FAIL and exit nonzero on violation.
- Quick proof completes in less than 3 minutes once render blockers are cleared.

## Work Item Mapping

Existing tickets cover the immediate render, Director, audio, and contract test surface:

- T10 Candidate Generation
- T11 Judgment Layer
- T12 Replay Ledger
- T14 Sequence Memory
- T16 SFX Variations
- T17 Variation Contract
- T19 Evidence Preservation
- T20-T27 Test and CI contracts

Additional tickets are required to capture roadmap gaps:

- T28 Prompt Governance Module
- T29 Multi-Orientation Contract Proposal
- T30 Director Orchestrator
- T31 Quality-Diversity Archive Producer Pipeline
- T32 Failure Taxonomy And Judgment Rubric

## Determinism Contract

Forbidden in the render path:

- `Math.random`
- `Date.now`
- `performance.now`
- `requestAnimationFrame`
- `setInterval`
- `setTimeout`
- `GSAP`
- `crypto.getRandomValues`
- `new Date`

Allowed in the render path:

- Seeded PRNG helpers.
- `useCurrentFrame` and `useVideoConfig`.
- Pure functions of frame, seed, manifest, and variation key.
- Typed arrays for render data transfer.

Backend timestamps are allowed for evidence records if they do not affect selected Treatment Genome identity, manifest timing, render transforms, or variation identity.

## Risk Register

| Risk | Consequence | Mitigation |
|---|---|---|
| Multi-orientation conflicts with v8.1 authority | Agents may override locked vertical output | Treat multi-orientation as T29 human-gate proposal only |
| Replay Ledger duplicates Pattern Memory | Memory semantics become confusing | Keep Replay Ledger job-level and Pattern Memory pattern-level |
| Judgment Layer is opaque | Rejections become hard to debug | Persist verdicts, rejected candidates, failure tags, and rationale |
| Candidate generation mutates Director too broadly | Existing working Director regresses | Add exports/wrappers first; preserve `generateJosephManifest` |
| CI is red before implementation lands | Red builds become ignored noise | Track blockers explicitly in `PROMETHEUS_BUILD.md` |
| Quality-Diversity Archive overrules editorial constraints | Novelty beats correctness | Archive fitness is one signal, never sole authority |
| Prompt governance is scattered | Prompts can silently override architecture | Centralize prompt allow/block decisions in one module |

## Architecture Deepening Opportunities

1. Director candidate interface

   The Director currently hides too much final-choice behavior behind one manifest-generation path. The deeper module should expose a small candidate-generation interface that produces several Treatment Genomes while keeping timing, cuts, and seeded variation local to the Director implementation.

2. Judgment Layer seam

   The project needs one explicit seam where Treatment Genomes are scored, vetoed, selected, and explained. This creates leverage for tests because every future quality rule can be tested through the same interface.

3. Replay Ledger adapter

   Replay Ledger should be a job-level persistence module with a small CRUD/similarity interface. Storage can start as NDJSON and later move to SQLite behind the same seam.

4. Prompt Governance module

   Prompt governance should not be scattered across the Director, Judgment Layer, and scripts. A single module should transform prompt influence into explicit permissions and blocks.

5. Cognitive Governor deepening

   The existing Cognitive Governor has real behavior. The next step is not replacement. The next step is to use it as the orchestration seam that decides whether a planning stage may run, then delegates candidate generation, judgment, and evidence preservation.

## Review Gate

Before implementation continues past the existing T20-T27 contracts:

- A human must approve or reject T29 if multi-orientation is desired.
- T17 Variation Key must be implemented or its interface finalized.
- T12 Replay Ledger storage should stay JSONL/NDJSON unless a human approves SQLite.
- T11 Judgment Layer must consume Quality-Diversity Archive fitness without replacing the archive.
- T30 must reuse the existing Cognitive Governor module rather than declaring it dead code.
