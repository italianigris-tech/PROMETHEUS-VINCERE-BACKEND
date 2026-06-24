# Roadmap Toward Beating Seedance

Date: 2026-06-24

## Purpose

This roadmap appraises the attached Seedance-style planning proposal against the current Prometheus codebase and the live GitHub issue tracker, then replaces it with a sharper execution order.

The goal is not to imitate Seedance's latent video generator.

The goal is to beat Seedance where Prometheus can actually win:

- stronger planning authority
- stronger editorial judgment
- stronger inspection and review loops
- better deterministic typography, motion, and composition control
- better governed reuse and generation

## Executive Verdict

Prometheus does **not** primarily lack ideas. It already contains many of the right planner concepts:

- `Top-Level Planner` vocabulary in `CONTEXT.md`
- a `Stepping-Stone Planner` in `remotion-app/src/creative-orchestration/judgment/planning`
- `Treatment Genome v1`
- `Planning Snapshot`
- `Observation Snapshot`
- `Planner Audit`
- `Sequence Memory`
- `Pattern Memory`
- a first `Quality-Diversity Archive`
- `Prompt Governance`
- `GOD`
- `Short-Form Intelligence`
- a real `video-aware audio plan`
- a real `Failure Taxonomy`

The real weakness is different:

**the system is still split across multiple authorities, and the richest planner/evaluator path is not yet the one authoritative live preview and review path.**

That means the next move is not "add more futuristic planner ideas."

The next move is to finish the authority chain so the planner, evaluator, audio plan, preview surface, and review loop all operate on the same manifest-driven path.

## Appraisal Of The Seedance-Style Proposal

### What is worth stealing now

These ideas are directionally correct and should remain in the strategy:

- an explicit planning layer between semantics and render directives
- sequence-level planning instead of one-beat isolated choices
- a shared intermediate representation
- explainable evaluator output rather than pass/fail only
- retrieval intent kept separate from generation intent
- footage-aware observation before layout decisions
- audio-visual co-planning rather than "cuts now, sound later"
- human review capture as training truth

### What is already partially present here

The attached proposal often describes systems the repo already has in scaffold or first-phase form:

- `Planner Audit` already exists in the Remotion judgment seam
- doctrine branches already exist
- `Treatment Genome v1` already exists
- a small QD archive already exists
- beam-ranked shortlist generation already exists
- a governed judgment seam already exists
- replay evidence and similarity veto already exist
- `GOD` already exists as governed generation
- `video-aware audio plan` already exists in backend music planning
- `Failure Taxonomy` already exists as named editorial/systemic defects

### What is premature right now

These ideas are not wrong, but they are badly sequenced for the current codebase:

- maximum-entropy IRL as a first move
- Neo4j / Graphiti / graph-database memory as a first move
- full AB-MCTS or deep multi-beat search before the live path is unified
- giant "deep memory" systems before review truth is collected
- 6-DOF / optical-flow analogues before footage-aware observation and transition rules are wired through
- a giant unified multimodal model replacing the current governed modular stack

These would add complexity faster than they would add leverage.

## Current Codebase Truth

### Strong existing seams

The repo already has serious leverage points:

- `backend/src/director/joseph-director.ts`
  - deterministic candidate-manifest generation
- `backend/src/director/judgment-layer.ts`
  - quality floor, similarity veto, rejection tags
- `backend/src/director/orchestrator.ts`
  - evidence preservation, replay ledger, governed prompt path
- `remotion-app/src/creative-orchestration/judgment/engines/core-judgment-engine.ts`
  - richer judgment pipeline
- `remotion-app/src/creative-orchestration/judgment/planning/*`
  - stepping-stone planner, observation/planning snapshots, doctrine branches, genomes, QD archive, beam search
- `backend/src/music/video-aware-planner/build-video-aware-audio-plan.ts`
  - real audio-plan seam
- `backend/src/pattern-memory/*`
  - pattern outcome memory seam
- `FAILURE_TAXONOMY.md`
  - named evaluator defect language

### The main structural problem

Prometheus currently has a **split-brain authority model**:

- the backend Joseph path still behaves like a deterministic manifest generator
- the richer stepping-stone planner lives in the Remotion judgment seam
- the active browser preview still has simplified preview routing and multiple fallback surfaces
- preview, artifact, and export do not yet obey one deep shared planning authority

This is the key reason the system can look advanced on paper while still feeling less premium than it should in the live loop.

## Issue Tracker Reality

The live GitHub tracker already encodes the right early ordering.

### Critical open issues

- `#4` Joseph Program: Fast feedback studio
- `#5` Joseph Program: Orchestration system redesign
- `#11` Joseph Program: Oversight and review system
- `#13` PRD: Fast Feedback Studio
- `#16` Fast Feedback: Synchronized candidate comparison
- `#17` Fast Feedback: Manifest diagnostic overlays
- `#18` Fast Feedback: Lightweight candidate review capture
- `#19` Fast Feedback: Candidate frame proof capture

### What the tracker already says

- `#5` is blocked by `#4`
- `#11` is blocked by `#4`
- `#18` is blocked by `#17`

This is correct.

The tracker is already telling us that a grand planner rewrite is the wrong first move if the study surface is still weak.

## Core Diagnosis

The path to beating Seedance is **not**:

1. add maximum-entropy IRL
2. add graph memory
3. add more theory
4. hope the preview path improves later

The path is:

1. make the live study loop authoritative and fast
2. route the real planner into that loop
3. route the real evaluator and review capture into that loop
4. route the real audio plan into that loop
5. only then deepen learning/search/memory

## Proposed Roadmap

## Phase 1: Finish The Fast Feedback Studio

This remains the first execution stream.

Without it, every deeper planner change is partly blind.

### Objectives

- make candidate inspection fast
- make comparison synchronized
- expose diagnostics visually
- capture review judgments durably
- capture frame proof without MP4 dependence

### Required issue order

- `#4`
- `#16`
- `#17`
- `#18`
- `#19`

### Why this phase comes first

Because the future planner must be judged by:

- side-by-side candidate comparison
- visible planner and render diagnostics
- explicit winner selection
- explicit failure tagging
- durable proof artifacts

Without that, "beating Seedance" turns into vibes and anecdotes.

## Phase 2: Collapse The Split-Brain Planning Authority

This is the real brain fix.

The repo should stop behaving like it has one advanced planner in docs and another weaker planner in the active loop.

### Required outcome

One planning authority must drive:

- live preview
- preview artifact
- export path
- diagnostics
- candidate comparison

### Concrete direction

- promote a shared planning contract
- make `Planner Audit` first-class in the live preview path
- replace simplified projection as the default path
- keep degraded projection only as an explicit fallback
- decide whether the backend Joseph orchestrator should be:
  - replaced by the richer judgment/planning seam, or
  - refactored to consume the same planning contract

### Important rule

Do not keep two editorial brains alive indefinitely.

Prometheus needs one authoritative `Top-Level Planner` path, not a backend heuristic lane plus a richer browser-side planner lane.

## Phase 3: Make The Evaluator Real

The attached proposal is right that the evaluator is essential, but Prometheus should deepen the evaluator through the seams it already has.

### Immediate evaluator goals

- convert the current floor-oriented judgment into a fuller editorial evaluator
- expose negative reasons, not just rejection
- connect failure tags to visible review capture
- preserve targeted reroll constraints

### The right evaluation language

Build on the existing taxonomy rather than inventing an ungrounded new one.

Use and extend:

- boring-under-editing
- chaotic-over-editing
- cheap-template-motion
- premium-restraint
- repetition-fatigue
- climax-overspend
- weak-concept-reduction
- asset-treatment-mismatch
- sequence-rhythm-collapse
- readability-sacrifice

### What this phase should emit

- structured negative reasoning
- severity-weighted penalties
- fix intent for rerolls
- candidate-comparison evidence

This phase should satisfy the user's request for an evaluator that can explain why something is negative rather than just rejecting it.

## Phase 4: Wire Audio Planning Into Editorial Authority

Seedance-style planning benefits from tight audiovisual alignment, and Prometheus already has the beginnings of this in backend music planning.

### Current truth

The `video-aware audio plan` exists, but it is not yet the steering wheel of the live preview rhythm path.

### Required outcomes

- preview uses the same audio plan as export
- beat grid, ducking, risers, drops, silence windows, and SFX cues affect choreography
- judgment can score rhythm collapse, climax overspend, and non-musical emphasis using the same authoritative plan

### Why this matters

This is where Prometheus can surpass Seedance's broad multimodal coherence with more explicit governed timing control.

## Phase 5: Make Observation Snapshot Truly Footage-Aware

This is where some of the Seedance motion/continuity ideas become useful in Prometheus terms.

### Do this first

- face/body/object occupancy
- negative-space evidence
- overlap truth
- subject-safe text placement
- matte/depth eligibility
- continuity anchors across cuts

### Then add deterministic equivalents of the flashy ideas

Instead of prematurely cloning optical-flow papers, express the same outcomes through governed layout and transition rules:

- eye-trace anchor continuity
- momentum handoff across cuts
- restraint windows before payoff
- depth-aware piercing transitions when footage evidence allows it
- jump-cut legality rules driven by subject and rhythm evidence

This is where Prometheus should implement the **editorial effect** of those ideas without importing unnecessary research machinery too early.

## Phase 6: Build Premium Vocabulary Programs

Only after the planner/evaluator/preview loop is authoritative should the system aggressively expand its vocabulary.

These programs remain valid:

- micro-animation primitive library
- picture-in-picture composition system
- visual primitive and background systems
- typography intelligence 2.0
- audio-visual choreography doctrine

These are not blocked conceptually by research.

They are blocked operationally by lack of one authoritative study-and-review loop.

## Phase 7: Add Learning, Taste, And Deeper Search

This is where ideas like IRL, creator taste memory, and deeper search become legitimate.

### Maximum-entropy IRL verdict

Do **not** start here.

Use this only after:

- review capture exists
- winner/loser comparisons are durable
- failure tags are stable
- planner candidates are reproducible
- enough editorial evidence exists to justify learning a reward surface

Before that, the right approach is:

- deterministic scoring
- pairwise comparison
- archive retrieval
- explicit human review signals

Then later:

- Bradley-Terry or pairwise preference models
- learned rerankers
- only then evaluate more IRL-like reward learning if the dataset is real enough

### Neo4j / Graphiti verdict

Do **not** start here either.

Prometheus does not currently have a graph-query bottleneck.

It has an authority and wiring bottleneck.

Use simple ledgers and governed stores first. Revisit a graph store only when:

- creator taste memory spans many runs
- cross-run editorial relationships genuinely need graph traversal
- the simpler stores stop being enough

## What Prometheus Should Steal From Seedance

Steal these principles:

- planning before rendering
- sequence-aware search
- explicit handoff artifacts
- explanation-rich evaluator feedback
- audio-visual coupling
- temporal continuity reasoning

Do **not** steal these assumptions:

- one giant unified model is the answer
- learned systems should replace governance early
- graph databases are automatically strategic
- research-sounding components are useful before preview authority is solved

## What Beating Seedance Actually Means Here

For Prometheus, beating Seedance means:

- the planner can generate multiple credible editorial candidates quickly
- the preview path can inspect them immediately
- the evaluator can explain why one wins
- the review surface can record that judgment
- the system can reuse those judgments later
- the final render path preserves premium typography and motion more faithfully than a generic latent generator

That is a more realistic and more powerful win condition than trying to out-Seedance Seedance at unified latent generation.

## Final Sequencing Recommendation

Follow this order:

1. Finish the Fast Feedback Studio stream first.
2. Make the stepping-stone planner the authoritative live planning path.
3. Deepen the evaluator and connect it to review capture.
4. Wire the video-aware audio plan into preview and export authority.
5. Make observation footage-aware and enforce subject-safe layout truth.
6. Expand premium motion, PiP, typography, and visual primitive vocabulary.
7. Only then add deeper learning, creator taste memory, and IRL-style optimization.

## The Short Version

Prometheus is already closer to the right architecture than the attached proposal assumes.

The repo does **not** need a bigger theoretical brain first.

It needs:

- one authoritative planning path
- one authoritative preview/review path
- one authoritative audio-visual timing path
- then a stronger evaluator and later learning loop

That is the road to beating Seedance in a way that fits this codebase.
