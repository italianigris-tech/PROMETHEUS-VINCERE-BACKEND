# PROMETHEUS_ISSUES_v1

Generated: 2026-06-29

Purpose: ready-to-import GitHub issue specification rebuilt from `ROADMAP_TOWARD_BEATING_SEEDANCE.md`, `specs/ARCHITECTURE_AUTHORITY.md`, `CONTEXT.md`, `PROMETHEUS_BUILD.md`, `PROMETHEUS_v8.2_BUILD.md`, `prometheus_v8.1_prd.md`, `prometheus_v8.2_prd.md`, `THRAGG_CINEMATIC_GAP_MAP.md`, and `MUSIC_ENGINE_CONTEXT_PACK.md`.

Import rule: create issues in numeric order so dependency references resolve. Apply `ready-for-agent` unless the issue has `human-gate`, `research`, or `infra` labels that require explicit maintainer assignment.

Architecture stance: this tracker is additive. It preserves the locked v8.1 authority, the v8.2 body wiring already marked ready-for-review, and the existing working Director/Judgment/Replay/Evidence modules. It does not ask agents to destructively overwrite working code.

## Seedance Parity Checklist

- Deterministic editorial control instead of black-box latent generation: #6, #8, #14, #52.
- Graph planning and lookahead beyond timestamp arrays: #33, #34, #35, #36, #37, #38.
- Inspectable per-frame planner/evaluator diagnostics: #15, #16, #17, #18, #19, #20.
- Exact premium typography and micro-animation control: #39, #40, #41.
- Robust picture-in-picture, matte, and 2.5D depth: #42, #43.
- Motion-graphic camera vectors and legal momentum handoff: #44, #45.
- Synthetic pacing and jump-cut discipline: #46.
- Semantic macro-rigs and contextual worlds: #47.
- Explainable negative evaluation with fix intent: #48, #49.
- Golden corpus, feature extraction, and learned taste moat: #21 through #32, #53 through #60.
- Style-conditioned reward and brand ingestion: #61 through #64.
- Multi-vehicle scene routing for the 1B-person vision: #65 through #67.
- Honest platform surface, analytics feedback instead of direct algorithm access: #68.
- Render economics and production hardening: #71, #72.

## IRL Phase Gate Issues

- #21 establishes the Golden corpus registry and provenance rules.
- #24 proves trajectory extraction before scaling.
- #25 defines the annotation protocol and QA rubric.
- #26 creates the 100-video threshold dashboard.
- #27 is the hard gate: MaxEnt IRL cannot run until the Golden 100 threshold is satisfied.
- #53, #54, and #55 are intentionally blocked by #27 plus feature validation.

## Determinism Guardian

- #4 creates the baseline forbidden-API and seeded-PRNG audit.
- #10 creates render contract tests so schema fields must produce observable behavior.
- #52 enforces pixel-identical compiler/render determinism.
- #60 prevents learned reward and QD exploration from breaking deterministic replay.
- The forbidden render-path APIs remain those in `specs/ARCHITECTURE_AUTHORITY.md`: `Math.random`, clock APIs, timers, GSAP, unseeded crypto, and non-seeded shader randomness.

## Dry-Run To Live Pipeline

- #30 upgrades audio feature extraction from placeholder BPM/beat grids to artifact-backed analysis.
- #69 graduates Audio DJ and fake beat grids into a persisted analyzer bridge.
- #70 graduates R2 placeholder music beds into render-safe cached assets with license guards.
- #56 and #72 connect those live artifacts to production evidence and telemetry.

## Epic: Roadmap Governance And Import
**Goal:** Turn the roadmap into a controlled execution system instead of another loose planning artifact.
**Target Quarter:** Q3-2026
**Issues:** #1 - #5

### Issue #1: Import Roadmap Tracker With Canonical Labels
**Priority:** P0-Critical
**Quarter:** Q3-2026 [ESTIMATED]
**Labels:** `ready-for-human`, `governance`, `issue-tracker`, `roadmap`
**Epic:** Roadmap Governance And Import

**Description:**
Import this tracker into GitHub in numeric order and apply the canonical triage labels from `docs/agents/triage-labels.md`. This makes the roadmap operational and closes the gap where quarter-critical deliverables were buried in prose instead of tracked as standalone work.

**Acceptance Criteria:**
- [ ] Every issue in this file is imported in numeric order or explicitly deferred with a maintainer note.
- [ ] Each imported issue has priority, quarter, epic, and dependency metadata preserved.
- [ ] `ready-for-agent` is applied only where the body is AFK-ready; human gates remain marked.

**Blocked by:** None
**Blocks:** #2, #3, #4, #5, #6, #21

**Amendment Notes:**
[AMENDED: the request asked for a ready-to-import file, not immediate `gh issue create`; this issue captures the import action.]

### Issue #2: Maintain Architecture Authority Amendment Registry
**Priority:** P0-Critical
**Quarter:** Q3-2026 [ESTIMATED]
**Labels:** `ready-for-human`, `governance`, `architecture-debt`, `human-gate`
**Epic:** Roadmap Governance And Import

**Description:**
Create a lightweight amendment registry for cases where the Seedance roadmap extends or conflicts with locked v8.1 authority. This prevents agents from silently treating future architecture as current authority.

**Acceptance Criteria:**
- [ ] Every issue that changes locked files or architecture rules references the amendment registry.
- [ ] Human-gate decisions are recorded for conflicts such as orientation, queues, distributed render, and learned reward authority.
- [ ] The registry distinguishes additive seam work from destructive rewrites.

**Blocked by:** #1
**Blocks:** #6, #14, #49, #65, #71

**Amendment Notes:**
[AMENDED: v8.1 is locked; roadmap additions must be recorded as additive future authority unless a human explicitly unlocks the spec.]

### Issue #3: Publish Program Dependency Dashboard
**Priority:** P1-Launch
**Quarter:** Q3-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `governance`, `project-management`, `roadmap`
**Epic:** Roadmap Governance And Import

**Description:**
Convert the roadmap dependency map into a dashboard that shows the keystone seam, immediate foundations, planning core, visual systems, learning, style, vehicles, and render infrastructure. This closes the execution gap where agents can work on attractive downstream systems before the seam exists.

**Acceptance Criteria:**
- [ ] Dashboard lists each epic, its target quarter, and its blocking issues.
- [ ] Program 16 is visibly marked as the keystone for planner-to-renderer intelligence.
- [ ] Phase A, B, C, and D roadmap sequencing is represented with status columns.

**Blocked by:** #1
**Blocks:** #15, #21, #33, #53, #61, #65, #71

**Amendment Notes:**
[INFERRED: quarters are estimated from the roadmap phase durations because the roadmap is phase-based.]

### Issue #4: Establish Determinism Guardian Baseline Audit
**Priority:** P0-Critical
**Quarter:** Q3-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `determinism`, `governance`, `architecture-debt`
**Epic:** Roadmap Governance And Import

**Description:**
Create a baseline audit that scans render-path code for forbidden APIs and verifies all variation paths use seeded randomness. This protects Prometheus' inspectability moat while the compiler, renderer, and learned reward systems grow.

**Acceptance Criteria:**
- [ ] Audit fails on forbidden render-path APIs from `specs/ARCHITECTURE_AUTHORITY.md`.
- [ ] Audit verifies seeded PRNG use for render-visible variation.
- [ ] CI produces an artifact with the scanned files and violations.

**Blocked by:** #1
**Blocks:** #10, #52, #60

**Amendment Notes:**
[AMENDED: existing determinism scripts are ready-for-review; this issue deepens them for the roadmap seam and renderer contracts.]

### Issue #5: Audit Evidence And Replay Oversight Coverage
**Priority:** P0-Critical
**Quarter:** Q3-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `governance`, `architecture-debt`, `evidence`, `replay-ledger`
**Epic:** Roadmap Governance And Import

**Description:**
Audit every job path that produces candidates, rejected candidates, selected manifests, render proofs, review verdicts, and replay ledger entries. This closes the oversight gap where evidence systems exist but may not preserve the new compiler and learning artifacts per job.

**Acceptance Criteria:**
- [ ] A matrix lists each job path and whether it writes candidate set, selected candidate, rejected candidates, verdict, render proof, and replay metadata.
- [ ] Missing per-job evidence writes are converted into follow-up subtasks or linked to #50 and #51.
- [ ] The audit distinguishes Replay Ledger, Pattern Memory, Creator Taste Memory, and QD Archive.

**Blocked by:** #1
**Blocks:** #18, #50, #51

**Amendment Notes:**
[AMENDED: v8.1 evidence and replay modules exist; this issue checks coverage for new roadmap artifacts rather than rebuilding them.]

## Epic: Stack Consolidation And Manifest Compiler
**Goal:** Make the rich planner reach pixels through a deterministic Manifest Compiler.
**Target Quarter:** Q3-2026
**Issues:** #6 - #14

### Issue #6: Disambiguate Planner Audit Schemas Across Stacks
**Priority:** P0-Critical
**Quarter:** Q3-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `architecture-debt`, `manifest-compiler`, `planner-audit`
**Epic:** Stack Consolidation And Manifest Compiler

**Description:**
Rename or namespace the two unrelated `PlannerAudit` shapes so Stack A's rich trace and Stack B's backend score summary cannot be confused. This is the first seam cleanup before any compiler work can be trusted.

**Acceptance Criteria:**
- [ ] Rich planner trace is named `Planner Audit` in the domain sense.
- [ ] Backend scoring summary is named `Candidate Score Summary` or equivalent.
- [ ] Type exports and tests prove the two artifacts cannot be structurally mistaken.

**Blocked by:** #1, #2
**Blocks:** #7

**Amendment Notes:**
[AMENDED: `CONTEXT.md` already resolves this ambiguity; code and tracker language must catch up.]

### Issue #7: Inventory Stack A To Stack B Handoff Fields
**Priority:** P0-Critical
**Quarter:** Q3-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `manifest-compiler`, `architecture-debt`
**Epic:** Stack Consolidation And Manifest Compiler

**Description:**
Document every rich creative-orchestration field that must compile into `UnifiedRenderManifest` or an explicit governed fallback. This prevents the write-only planner problem from continuing under a more formal name.

**Acceptance Criteria:**
- [ ] Inventory maps Treatment Genome, retrieval intent, GOD escalation intent, QD archive cell, negative grammar, and beam result fields to target manifest or evidence fields.
- [ ] Fields that cannot render yet have explicit fallback behavior and failure tags.
- [ ] Inventory names current files/modules that already partially satisfy the contract.

**Blocked by:** #6
**Blocks:** #8, #11

**Amendment Notes:**
[INFERRED: dependencies follow the roadmap claim that Program 16 is the keystone.]

### Issue #8: Build Manifest Compiler Phase 0 Artifact
**Priority:** P0-Critical
**Quarter:** Q3-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `manifest-compiler`, `backend`, `determinism`
**Epic:** Stack Consolidation And Manifest Compiler

**Description:**
Create a read-only Manifest Compiler that accepts a selected planner path and emits an inspectable compile artifact without changing production render output yet. This gives Prometheus a reversible seam before grafting intelligence into pixels.

**Acceptance Criteria:**
- [ ] Compiler consumes a selected planner candidate and returns a deterministic artifact.
- [ ] Artifact includes input planner IDs, target manifest fields, fallbacks, warnings, and hash.
- [ ] Existing render output remains unchanged in this phase.

**Blocked by:** #7
**Blocks:** #9, #10, #12

**Amendment Notes:**
[AMENDED: phase 0 is deliberately additive so existing v8.2 body wiring remains stable.]

### Issue #9: Compile Rich Planner Fields Into UnifiedRenderManifest
**Priority:** P0-Critical
**Quarter:** Q3-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `manifest-compiler`, `shared-types`, `backend`
**Epic:** Stack Consolidation And Manifest Compiler

**Description:**
Extend the Manifest Compiler so selected planner intent becomes expanded `UnifiedRenderManifest` fields consumed by the renderer. This closes the Seedance gap where the system has planning intelligence but renders only a flattened fallback.

**Acceptance Criteria:**
- [ ] Compiler maps micro-animation, PiP, camera, typography, background, retrieval, and choreography intent to manifest fields.
- [ ] Missing fields emit governed fallbacks with evidence, not silent defaults.
- [ ] Same planner artifact and variation key produce the same compiled manifest hash.

**Blocked by:** #8
**Blocks:** #14, #39, #41

**Amendment Notes:**
[AMENDED: use existing `UnifiedRenderManifest` fields where possible; add only gaps that render contracts prove are needed.]

### Issue #10: Create Render Contract Test Harness
**Priority:** P0-Critical
**Quarter:** Q3-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `determinism`, `render-contract`, `testing`
**Epic:** Stack Consolidation And Manifest Compiler

**Description:**
Build tests that prove a compiled manifest field produces observable renderer behavior or an explicit fallback. This prevents schema-only progress and forces planner decisions to reach pixels.

**Acceptance Criteria:**
- [ ] Harness can render or inspect fixtures for micro-animation, PiP, camera, typography, and background fields.
- [ ] Each test asserts observable output, not private implementation details.
- [ ] Harness runs under determinism checks and rejects forbidden render-path APIs.

**Blocked by:** #4, #8
**Blocks:** #14, #39, #41, #43, #44, #52

**Amendment Notes:**
[AMENDED: current pixel proof exists for body rendering; this issue extends proof to field-level planner contracts.]

### Issue #11: Port Sequence Metrics And Negative Grammar Into Backend Libraries
**Priority:** P1-Launch
**Quarter:** Q3-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `backend`, `judgment-layer`, `architecture-debt`
**Epic:** Stack Consolidation And Manifest Compiler

**Description:**
Move reusable sequence-memory metrics and negative-grammar predicates from the rich planner side into backend libraries callable by the Judgment Layer. This lets Stack B govern richer candidates without importing the whole preview-side planner stack.

**Acceptance Criteria:**
- [ ] Backend exposes pure functions for repetition, density, climax budget, readability risk, and primitive collisions.
- [ ] Existing Judgment Layer tests remain green.
- [ ] Stack A duplicate engines can remain but become unreferenced by the backend path.

**Blocked by:** #7
**Blocks:** #13

**Amendment Notes:**
[AMENDED: port libraries, do not delete Stack A until render parity is proven.]

### Issue #12: Persist Compiler Artifact And Planner Audit Pointer
**Priority:** P1-Launch
**Quarter:** Q3-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `evidence`, `manifest-compiler`, `planner-audit`
**Epic:** Stack Consolidation And Manifest Compiler

**Description:**
Persist the compiler artifact and a pointer to the rich Planner Audit alongside the backend Candidate Score Summary. This gives Studio, regression gallery, and future learning loops enough evidence to explain every selected pixel.

**Acceptance Criteria:**
- [ ] Evidence records include compiler artifact hash, Planner Audit pointer, and Candidate Score Summary pointer.
- [ ] Rejected candidates retain compile warnings and failure tags.
- [ ] Existing evidence preservation tests are extended rather than bypassed.

**Blocked by:** #8, #10
**Blocks:** #13, #50

**Amendment Notes:**
[INFERRED: the roadmap requires inspectable artifacts at each layer but does not name the exact persistence issue.]

### Issue #13: Replace Seed-Only Doctrine Selection With Governed Objective Ranking
**Priority:** P1-Launch
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `judgment-layer`, `planner`, `quality-diversity`
**Epic:** Stack Consolidation And Manifest Compiler

**Description:**
Replace simple seed-based doctrine selection with objective-ranked candidate genome selection under the Judgment Layer. This is the minimal path from decorative planning to governed editorial choice.

**Acceptance Criteria:**
- [ ] Candidate selection consumes sequence objective signals and Judgment Layer vetoes.
- [ ] Same inputs and variation key are deterministic; different variation keys produce meaningful alternatives.
- [ ] Best-score argmax is not the only selection mode once QD/surprise signals are available.

**Blocked by:** #11, #12
**Blocks:** #14, #49

**Amendment Notes:**
[AMENDED: keep `generateCandidateGenomes` public behavior stable while changing the selection seam behind it.]

### Issue #14: Prove End-To-End Seam Through Orchestrator Worker And JosephEdit
**Priority:** P0-Critical
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `integration`, `manifest-compiler`, `render-contract`
**Epic:** Stack Consolidation And Manifest Compiler

**Description:**
Run a fixture from rich planner candidate to Manifest Compiler to backend orchestration to worker render to `JosephEdit` with evidence preserved. This is the keystone acceptance proof for the corrected roadmap.

**Acceptance Criteria:**
- [ ] Fixture produces a vertical MP4 whose visible behavior differs when planner-selected primitives differ.
- [ ] Evidence includes selected candidate, rejected candidates, compiler artifact, Judgment verdict, Replay Ledger write, and render proof.
- [ ] Determinism and variation suites pass unchanged in intent.

**Blocked by:** #9, #10, #13
**Blocks:** #15, #17, #33, #42, #50, #61

**Amendment Notes:**
[AMENDED: this is not a blank-slate rewrite; it rides on the v8.2 upload/render path already built.]

## Epic: Fast Feedback And Evidence Studio
**Goal:** Turn the existing Joseph Study Studio into the review and data surface for planning, regression, and learning.
**Target Quarter:** Q4-2026
**Issues:** #15 - #20

### Issue #15: Wire Candidate Generator To Studio Lanes
**Priority:** P1-Launch
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `studio`, `review-surface`, `frontend`
**Epic:** Fast Feedback And Evidence Studio

**Description:**
Add a Studio path that invokes candidate generation and populates A/B/C/D lanes from real generated manifests. This turns the current fixture/comparison surface into the entry point for preference data.

**Acceptance Criteria:**
- [ ] Studio can request 2-6 candidates for a fixture source and display synchronized lanes.
- [ ] Each lane shows candidate ID, doctrine branch, manifest hash, and evidence pointer.
- [ ] Failure to generate a lane is visible and captured in evidence.

**Blocked by:** #3, #14
**Blocks:** #16, #20

**Amendment Notes:**
[AMENDED: `JosephStudyStudio` already exists; extend it rather than replacing it.]

### Issue #16: Add Synchronized Playback Frame Stepping And Scrubbing
**Priority:** P1-Launch
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `studio`, `frontend`, `review-surface`
**Epic:** Fast Feedback And Evidence Studio

**Description:**
Make Studio lanes controllable as one synchronized inspection surface with frame stepping and timeline scrubbing. This enables frame-level comparison without rendering many MP4s.

**Acceptance Criteria:**
- [ ] Play, pause, seek, and frame-step apply to every active lane.
- [ ] Current frame/timecode is visible and stable across lanes.
- [ ] Tests cover boundary seeking at frame 0 and final frame.

**Blocked by:** #15
**Blocks:** #17, #18

**Amendment Notes:**
[AMENDED: `syncJosephStudyPlayers` exists; deepen it into the user-facing Studio workflow.]

### Issue #17: Resolve Per-Frame Diagnostics In Studio
**Priority:** P1-Launch
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `studio`, `planner-audit`, `evidence`, `governance`
**Epic:** Fast Feedback And Evidence Studio

**Description:**
For a frozen frame, show the active graph node, primitive IDs, PiP layer/depth state, camera vector, text primitive, audio transient, and evaluator warnings. This is the inspection surface that makes Prometheus more explainable than Seedance.

**Acceptance Criteria:**
- [ ] Diagnostic resolver takes manifest, compiler artifact, Planner Audit pointer, and frame number.
- [ ] Studio overlay shows active artifacts for that frame and flags missing evidence.
- [ ] Tests cover a frame with no active primitive and a frame with overlapping primitive/camera/PiP activity.

**Blocked by:** #14, #16
**Blocks:** #19, #38

**Amendment Notes:**
[INFERRED: roadmap says this is gated by the seam; dependencies reflect that.]

### Issue #18: Expand Studio Failure Tags To Full Negative Ontology
**Priority:** P1-Launch
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `studio`, `failure-taxonomy`, `review-surface`
**Epic:** Fast Feedback And Evidence Studio

**Description:**
Replace the small generic Studio tag set with the full negative ontology used by the evaluator. Preference data must carry failure labels at the granularity the Judgment Layer and reward models can learn from.

**Acceptance Criteria:**
- [ ] Studio failure tag panel includes the canonical failure taxonomy and human-readable labels.
- [ ] Review records store stable failure IDs, taxonomy version, verdict, and candidate ID.
- [ ] Existing review capture tests are updated to cover multiple tags.

**Blocked by:** #5, #16
**Blocks:** #20, #48

**Amendment Notes:**
[AMENDED: T32 already created the taxonomy document; this issue wires it into the Review Surface.]

### Issue #19: Capture Frame Proofs With Diagnostic Overlays
**Priority:** P1-Launch
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `studio`, `evidence`, `regression-gallery`
**Epic:** Fast Feedback And Evidence Studio

**Description:**
Add a frame-proof capture action that saves the visible frame plus diagnostic overlays and references it from the review ledger. This makes review verdicts auditable instead of anecdotal.

**Acceptance Criteria:**
- [ ] User can capture a screenshot proof for the current lane/frame.
- [ ] Proof metadata includes candidate ID, frame number, manifest hash, active diagnostic IDs, and failure tags.
- [ ] Proof export works without invoking the slow production render path.

**Blocked by:** #17
**Blocks:** #20, #50

**Amendment Notes:**
[INFERRED: roadmap calls for frame proof capture; implementation should follow existing live Player architecture.]

### Issue #20: Export Regression Gallery And Pairwise Review Ledger
**Priority:** P1-Launch
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `studio`, `regression-gallery`, `preference-data`
**Epic:** Fast Feedback And Evidence Studio

**Description:**
Export reviewed candidates, frame proofs, pairwise preferences, and failure tags into a regression gallery and machine-readable ledger. This is the Studio output that later preference reward modeling consumes.

**Acceptance Criteria:**
- [ ] Gallery groups source, candidates, winner/loser verdicts, proofs, and failure tags.
- [ ] Ledger export is deterministic and includes schema version.
- [ ] Export can be consumed by reward-model tests without browser localStorage.

**Blocked by:** #18, #19
**Blocks:** #28, #54

**Amendment Notes:**
[INFERRED: roadmap separates pairwise preference data from MaxEnt absolute demonstrations.]

## Epic: Golden Corpus And IRL Phase Gates
**Goal:** Build the data surface and annotation gates before any learned reward can run.
**Target Quarter:** Q4-2026
**Issues:** #21 - #27

### Issue #21: Create Golden Corpus Registry With Provenance Rules
**Priority:** P0-Critical
**Quarter:** Q3-2026 [ESTIMATED]
**Labels:** `ready-for-human`, `irl`, `golden-corpus`, `governance`, `legal-risk`
**Epic:** Golden Corpus And IRL Phase Gates

**Description:**
Create a registry for reference edits with provenance, license posture, source quality, creator/style label, vehicle, and curation status. This keeps the future learning moat legally and technically defensible.

**Acceptance Criteria:**
- [ ] Registry distinguishes research-only YouTube references from licensed or user-uploaded production corpus assets.
- [ ] Each entry records creator/style, vehicle, quality tier, compression risk, and annotation status.
- [ ] Corpus entries can be filtered to the Golden 100 candidate set.

**Blocked by:** #1, #3
**Blocks:** #22, #28

**Amendment Notes:**
[AMENDED: roadmap permits YouTube for research proof only; production moat requires licensed or user-uploaded data.]

### Issue #22: Build Reference Edit Ingestion Pipeline
**Priority:** P1-Launch
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `irl`, `golden-corpus`, `data-pipeline`
**Epic:** Golden Corpus And IRL Phase Gates

**Description:**
Build an ingestion path that turns approved reference edits into local analysis jobs and stable media references. This provides the raw material for trajectory extraction without tying extraction to a specific source website.

**Acceptance Criteria:**
- [ ] Ingestion accepts local media references and registry IDs.
- [ ] Media is stored through the existing asset/file seam with browser-safe and FFmpeg-safe references.
- [ ] Ingested assets record duration, dimensions, fps, audio presence, and source hash.

**Blocked by:** #21
**Blocks:** #23

**Amendment Notes:**
[INFERRED: roadmap requires trajectory extraction but does not prescribe storage; align with v8.2 asset resolver seam.]

### Issue #23: Define Trajectory Schema With Feature Version
**Priority:** P0-Critical
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `irl`, `schema`, `feature-versioning`
**Epic:** Golden Corpus And IRL Phase Gates

**Description:**
Define `trajectory.json` for extracted expert demonstrations, including state, action, timing, visual, audio, and feature-version fields. This makes MaxEnt IRL data reproducible and upgradeable.

**Acceptance Criteria:**
- [ ] Schema includes source hash, corpus ID, vehicle, style label, featureVersion, frame rate, and timeline spans.
- [ ] Schema separates absolute demonstration facts from pairwise preference verdicts.
- [ ] Validation tests reject missing version or mismatched duration/fps.

**Blocked by:** #22
**Blocks:** #24, #32

**Amendment Notes:**
[INFERRED: feature versioning is mandatory from Program 20 and IRL economics sections.]

### Issue #24: Build Golden 20 Trajectory Extractor Harness
**Priority:** P1-Launch
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `irl`, `trajectory-extraction`, `testing`
**Epic:** Golden Corpus And IRL Phase Gates

**Description:**
Build a fixture-driven extractor harness that emits trajectories for the first 20 curated references before scaling to 100. This tests extraction correctness before corpus size hides bad features.

**Acceptance Criteria:**
- [ ] Extractor emits valid `trajectory.json` for 20 curated references or local fixtures.
- [ ] Each extraction records warnings for missing matte, beat grid, typography, or camera features.
- [ ] Runtime and failure rates are captured in a repeatable report.

**Blocked by:** #23
**Blocks:** #25, #26

**Amendment Notes:**
[INFERRED: the roadmap states 30-50 is exploratory and 100-200 is minimum viable; Golden 20 is the smoke gate.]

### Issue #25: Define Annotation Protocol And QA Rubric
**Priority:** P0-Critical
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-human`, `irl`, `annotation`, `governance`, `human-gate`
**Epic:** Golden Corpus And IRL Phase Gates

**Description:**
Define how humans annotate reference edits, failure classes, visible craft decisions, and quality tiers. This prevents weak or mixed-quality data from training the reward toward the average.

**Acceptance Criteria:**
- [ ] Protocol defines required annotations per reference edit and per extracted trajectory.
- [ ] QA rubric rejects low-quality, off-style, duplicate, or over-compressed examples.
- [ ] Annotation output is versioned and linked to the corpus registry.

**Blocked by:** #24
**Blocks:** #26

**Amendment Notes:**
[AMENDED: this explicitly honors the roadmap rule to curate to the ceiling, not the average.]

### Issue #26: Build Golden 100 Threshold Dashboard
**Priority:** P0-Critical
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `irl`, `golden-corpus`, `governance`, `phase-gate`
**Epic:** Golden Corpus And IRL Phase Gates

**Description:**
Build a dashboard showing how many curated, extracted, validated, and annotated reference trajectories exist. This makes the 100-video IRL gate concrete instead of aspirational.

**Acceptance Criteria:**
- [ ] Dashboard counts references by style, vehicle, curation tier, extraction status, and annotation status.
- [ ] It clearly shows whether the Golden 100 threshold is met.
- [ ] It blocks or warns when duplicate or weak references inflate the count.

**Blocked by:** #24, #25
**Blocks:** #27

**Amendment Notes:**
[INFERRED: user explicitly requested the 100-video annotation threshold as an IRL phase gate.]

### Issue #27: Enforce Hard Gate Before MaxEnt IRL Training
**Priority:** P0-Critical
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `irl`, `phase-gate`, `governance`, `architecture-debt`
**Epic:** Golden Corpus And IRL Phase Gates

**Description:**
Add a hard technical and tracker-level gate that prevents MaxEnt IRL training jobs from running before the Golden 100 threshold and feature validation are satisfied. This protects the project from expensive false confidence.

**Acceptance Criteria:**
- [ ] Training command or module refuses to run unless the dashboard reports threshold met or a human override is recorded.
- [ ] Override requires reason, owner, date, and expected risk.
- [ ] Gate is referenced by all learned reward issues.

**Blocked by:** #26
**Blocks:** #53, #55

**Amendment Notes:**
[AMENDED: the repo has older notes saying do not build IRL until 100+ annotated Joseph videos exist; this issue makes that enforceable.]

## Epic: Feature Audit And Feature Space Discipline
**Goal:** Build the compact, validated feature set that makes trajectory extraction and reward learning meaningful.
**Target Quarter:** Q4-2026
**Issues:** #28 - #32

### Issue #28: Run Manual Feature Audit On Five Reference Edits
**Priority:** P0-Critical
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-human`, `feature-audit`, `irl`, `research`
**Epic:** Feature Audit And Feature Space Discipline

**Description:**
Audit 3-5 elite reference edits frame-by-frame and list every visible editing decision that might become a feature. This finds the real feature space before extraction automation locks in the wrong facts.

**Acceptance Criteria:**
- [ ] Audit covers camera, typography, motion graphics, composition, transitions, audio, temporal pacing, and PiP/matte.
- [ ] Each observed decision is mapped to candidate extractor feasibility.
- [ ] Audit explicitly rejects low-value or correlated feature ideas.

**Blocked by:** #20, #21
**Blocks:** #29

**Amendment Notes:**
[INFERRED: roadmap calls feature engineering the binding constraint and requires manual verification before scaling.]

### Issue #29: Publish 60-80 Feature Catalog
**Priority:** P0-Critical
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `feature-audit`, `irl`, `schema`
**Epic:** Feature Audit And Feature Space Discipline

**Description:**
Reduce the audited candidate features into a catalog of roughly 60-80 low-correlation, high-craft features. This prevents overfitting and gives the learner a compact state representation.

**Acceptance Criteria:**
- [ ] Catalog lists feature name, family, extractor source, units, null behavior, and validation note.
- [ ] Each family has roughly 8-10 useful features unless justified.
- [ ] Rejected correlated features are documented.

**Blocked by:** #28
**Blocks:** #30, #31

**Amendment Notes:**
[AMENDED: explicitly avoid 300-feature sprawl as warned by Program 20.]

### Issue #30: Build Artifact-Backed Audio Feature Extraction Track
**Priority:** P1-Launch
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `audio`, `feature-audit`, `dry-run-to-live`
**Epic:** Feature Audit And Feature Space Discipline

**Description:**
Extract beat, onset, downbeat, SFX, voice/music separation, ducking envelope, and energy features into persisted audio artifacts. This replaces fake beat grids and placeholder analysis with data the planner and learner can share.

**Acceptance Criteria:**
- [ ] Analyzer emits deterministic JSON artifacts for beat grid, downbeats, energy, sections, and warnings.
- [ ] Artifacts are cached per track/source hash and never recomputed during a render request.
- [ ] Fallback BPM grids are labeled as fallback and cannot masquerade as analyzed data.

**Blocked by:** #29
**Blocks:** #31, #34, #69, #70

**Amendment Notes:**
[AMENDED: current music path may use deterministic fallback; this issue graduates the analysis path without breaking MVP fallback.]

### Issue #31: Validate Features Distinguish Elite From Generic
**Priority:** P0-Critical
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-human`, `feature-audit`, `irl`, `quality-gate`
**Epic:** Feature Audit And Feature Space Discipline

**Description:**
Manually verify that the feature vectors distinguish elite reference edits from generic edits before scaling extraction. This is the stop sign that prevents collecting more data around bad features.

**Acceptance Criteria:**
- [ ] At least five elite and five generic edits are compared with feature vectors.
- [ ] Report identifies which features separate craft and which are noise.
- [ ] Features that fail the test are removed or revised before corpus scaling.

**Blocked by:** #29, #30
**Blocks:** #32, #53

**Amendment Notes:**
[INFERRED: roadmap says poor learned reward past 600 trajectories is a feature problem, not a sample-count problem.]

### Issue #32: Implement Feature Versioning And Re-Extraction Workflow
**Priority:** P1-Launch
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `feature-versioning`, `irl`, `data-pipeline`
**Epic:** Feature Audit And Feature Space Discipline

**Description:**
Implement feature schema versioning so changing a feature definition triggers re-extraction or explicit mixed-version handling. This keeps the Golden corpus scientifically usable as the feature space matures.

**Acceptance Criteria:**
- [ ] `trajectory.json` includes a feature schema version and extractor version.
- [ ] Version mismatch fails training unless a migration or re-extraction plan exists.
- [ ] Re-extraction report lists changed features and affected corpus entries.

**Blocked by:** #23, #31
**Blocks:** #53, #67

**Amendment Notes:**
[INFERRED: feature-versioning is a Program 20 acceptance proof.]

## Epic: Graph Planner And Multi-Modal Sync Matrix
**Goal:** Replace linear timestamp thinking with graph planning, sync facts, lookahead, and inspectable planner traces.
**Target Quarter:** Q1-2027
**Issues:** #33 - #38

### Issue #33: Canonicalize Observation Snapshot Fact Model
**Priority:** P1-Launch
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `planner`, `observation-snapshot`, `schema`
**Epic:** Graph Planner And Multi-Modal Sync Matrix

**Description:**
Create a canonical Observation Snapshot that carries source facts the planner cannot rewrite across backend and render-adjacent systems. This is the factual base for graph planning and later vehicle routing.

**Acceptance Criteria:**
- [ ] Snapshot includes scene, transcript, audio, visual, production, and constraint facts.
- [ ] Planner code cannot mutate Observation Snapshot fields.
- [ ] Tests prove same source facts produce stable snapshots.

**Blocked by:** #3, #14
**Blocks:** #34, #35, #65

**Amendment Notes:**
[AMENDED: existing Joseph observation snapshot is a seed; broaden it without breaking current Director contracts.]

### Issue #34: Build Multi-Modal Sync Matrix
**Priority:** P1-Launch
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `planner`, `audio`, `sync-matrix`
**Epic:** Graph Planner And Multi-Modal Sync Matrix

**Description:**
Build a sync matrix that aligns semantic beats, audio transients, beat/downbeat windows, camera vectors, text moments, PiP state, and spatial safety facts. This gives planning a shared time base for Seedance-level coherence.

**Acceptance Criteria:**
- [ ] Matrix maps source facts into frame-accurate windows at 30 CFR.
- [ ] Audio fallback vs analyzed data is visible in the matrix.
- [ ] Tests cover beat-aligned, breath-aligned, and visual-reset-aligned transition candidates.

**Blocked by:** #30, #33
**Blocks:** #35, #44, #45

**Amendment Notes:**
[INFERRED: dependency follows roadmap sync matrix and audio extraction track.]

### Issue #35: Implement Graph Node And Edge Planner V1
**Priority:** P2-Quality
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `planner`, `graph-planner`, `seedance-parity`
**Epic:** Graph Planner And Multi-Modal Sync Matrix

**Description:**
Represent the timeline as graph nodes and edges rather than a flat array of timestamped effects. This lets the planner reason about semantic, audio, spatial, continuity, and narrative relationships.

**Acceptance Criteria:**
- [ ] Graph includes semantic nodes, phrase nodes, beat/drop/silence nodes, camera nodes, text nodes, PiP nodes, and asset/world nodes.
- [ ] Edges carry dependency, contrast, continuity, sync, and conflict relationships.
- [ ] Planner can emit a graph artifact for Studio diagnostics.

**Blocked by:** #33, #34
**Blocks:** #36, #37, #46, #65

**Amendment Notes:**
[INFERRED: roadmap names graph planning as a first-class program.]

### Issue #36: Add Adaptive Planning Horizon
**Priority:** P2-Quality
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `planner`, `sequence-objective`
**Epic:** Graph Planner And Multi-Modal Sync Matrix

**Description:**
Add a rolling lookahead horizon that usually reasons 5-10 seconds ahead and searches deeper only for high-stakes moments. This avoids both one-beat shortsightedness and full-video combinatorial explosion.

**Acceptance Criteria:**
- [ ] Planner chooses horizon length deterministically from graph stakes and density.
- [ ] High-stakes beats can trigger deeper search with a capped budget.
- [ ] Planner Audit records horizon decisions and skipped deeper searches.

**Blocked by:** #35
**Blocks:** #37

**Amendment Notes:**
[AMENDED: follows the `Adaptive Planning Horizon` glossary term in `CONTEXT.md`.]

### Issue #37: Implement Sequence Objective And Beam/QD Scoring
**Priority:** P2-Quality
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `planner`, `quality-diversity`, `sequence-objective`
**Epic:** Graph Planner And Multi-Modal Sync Matrix

**Description:**
Implement a sequence objective that scores consequence, repetition avoidance, doctrine coherence, surprise preservation, climax budget, retrieval practicality, and render feasibility. This makes candidate selection sequence-aware instead of per-moment flashy.

**Acceptance Criteria:**
- [ ] Objective produces deterministic scores for a graph fixture.
- [ ] Beam/QD selection can choose a lower local score when sequence quality is higher.
- [ ] Planner Audit records score components and selected path.

**Blocked by:** #35, #36
**Blocks:** #38, #56

**Amendment Notes:**
[AMENDED: existing stepping-stone planner concepts should be reused and moved toward the production seam.]

### Issue #38: Surface Planner Audit Data Through Diagnostics
**Priority:** P2-Quality
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `planner-audit`, `studio`, `manifest-compiler`
**Epic:** Graph Planner And Multi-Modal Sync Matrix

**Description:**
Make graph nodes, beam candidates, selected path, QD archive hits, and score components available to Studio diagnostics through the compiler/evidence path. This makes planner behavior inspectable by reviewers.

**Acceptance Criteria:**
- [ ] Studio can display Planner Audit details for the current frame or segment.
- [ ] Missing or stale audit pointers fail visibly.
- [ ] Regression gallery exports include selected path summary.

**Blocked by:** #17, #37
**Blocks:** #48

**Amendment Notes:**
[INFERRED: Studio deep diagnostics and planner audit overlay are both gated by Program 16.]

## Epic: Visual Fidelity Systems
**Goal:** Deliver the visible Joseph-quality systems that close the largest gap to Seedance-level output.
**Target Quarter:** Q1-2027
**Issues:** #39 - #47

### Issue #39: Render Top Six Micro-Animation Primitives
**Priority:** P1-Launch
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `micro-animation`, `renderer`, `seedance-parity`
**Epic:** Visual Fidelity Systems

**Description:**
Implement observable render contracts for the top six premium primitives: sweep highlight, weight escalation, capsule highlight, clipped mask reveal, bracket lock, and semantic glow. These are the fastest path from deterministic manifest to visibly premium motion.

**Acceptance Criteria:**
- [ ] Each primitive has a manifest fixture and observable render contract test.
- [ ] Same seed and manifest produce pixel-identical primitive behavior.
- [ ] Missing unsupported variants fall back with evidence and failure tags.

**Blocked by:** #9, #10
**Blocks:** #40

**Amendment Notes:**
[AMENDED: catalog already exists; this issue ensures primitives are faithfully rendered, not just selected.]

### Issue #40: Enforce Primitive Combination Grammar
**Priority:** P1-Launch
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `micro-animation`, `judgment-layer`, `governance`
**Epic:** Visual Fidelity Systems

**Description:**
Make primitive collision, intensity budget, semantic fit, and readability rules executable through the Judgment Layer and render contract tests. This prevents premium primitives from becoming visual chaos.

**Acceptance Criteria:**
- [ ] Combination grammar catches entry collisions, emphasis collisions, mutation overlap, visual chaos, and semantic mismatch.
- [ ] Violations produce failure tags and suggested fix intent.
- [ ] Judgment Layer can veto or downrank invalid primitive stacks.

**Blocked by:** #39
**Blocks:** #48

**Amendment Notes:**
[AMENDED: existing `evaluateMicroAnimationSelections` is a strong seed; wire it into governance and contracts.]

### Issue #41: Implement Typography Math And Role-Based Font Pairing
**Priority:** P1-Launch
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `typography`, `renderer`, `seedance-parity`
**Epic:** Visual Fidelity Systems

**Description:**
Implement deterministic typography rules for negative-tracking hero text, positive-tracking support text, role-based pairing, filler suppression, and line rhythm. This closes the visible gap where current typography is useful but not yet reliably premium.

**Acceptance Criteria:**
- [ ] Typography manifest carries role, tracking, weight, hierarchy, and pairing decisions.
- [ ] Renderer applies role-specific font and tracking behavior with pixel proof.
- [ ] Readability and safe-zone tests catch text clipping or PiP overlap.

**Blocked by:** #9, #10
**Blocks:** #47, #55

**Amendment Notes:**
[AMENDED: v8.2 font MVP exists; this issue upgrades policy/math rather than reinstalling the font seam.]

### Issue #42: Wire RVM Matte Into The Render Path
**Priority:** P1-Launch
**Quarter:** Q4-2026 [ESTIMATED]
**Labels:** `ready-for-agent`, `pip`, `matting`, `renderer`, `seedance-parity`
**Epic:** Visual Fidelity Systems

**Description:**
Wire the dormant RobustVideoMatting worker output into the Joseph render path as a governed subject matte asset. This is the highest visual-impact prerequisite for real 2.5D PiP.

**Acceptance Criteria:**
- [ ] Render jobs can reference a matte asset with browser-safe and FFmpeg-safe paths.
- [ ] Missing matte emits a visible downgrade/fallback tag rather than silent flat PiP.
- [ ] A fixture proves subject separation affects rendered pixels.

**Blocked by:** #14
**Blocks:** #43

**Amendment Notes:**
[AMENDED: RVM exists in `runpod-video-worker`; this issue wires it to the product path instead of rebuilding matting.]

### Issue #43: Build 2.5D PiP Depth Compositor
**Priority:** P1-Launch
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `pip`, `renderer`, `seedance-parity`
**Epic:** Visual Fidelity Systems

**Description:**
Render the PiP plan as a depth-aware composition with subject, backplate, asset board, focus field, typography zones, and handoff motion. This converts the current PiP plan from schema into visible Joseph signature.

**Acceptance Criteria:**
- [ ] PiP compositor respects subject matte, typography clearance, frame chrome, and background layers.
- [ ] Camera/text primitives cannot occlude protected subject zones without a failure tag.
- [ ] Render contract tests prove depth and layer changes are visible.

**Blocked by:** #10, #42
**Blocks:** #45

**Amendment Notes:**
[AMENDED: `josephPiP` schema and plan builder already exist; deepen render fidelity.]

### Issue #44: Implement Motion-Graphic Camera Vector System
**Priority:** P2-Quality
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `camera`, `renderer`, `seedance-parity`
**Epic:** Visual Fidelity Systems

**Description:**
Define legal camera vectors with entry velocity, exit velocity, momentum handoff, focal behavior, and eye-trace preservation. This gives Prometheus deterministic equivalents of optical-flow continuity.

**Acceptance Criteria:**
- [ ] Camera moves carry vector, velocity, focal, and handoff metadata.
- [ ] Illegal handoffs produce Judgment Layer warnings or vetoes.
- [ ] Render contract tests prove camera changes are deterministic and non-overlapping.

**Blocked by:** #10, #34
**Blocks:** #45

**Amendment Notes:**
[AMENDED: existing camera moves include velocity hints; extend into a governed vector system.]

### Issue #45: Add Camera Continuity And Momentum Handoff Proofs
**Priority:** P2-Quality
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `camera`, `testing`, `determinism`
**Epic:** Visual Fidelity Systems

**Description:**
Add tests and diagnostics that prove camera moves preserve momentum and eye trace across cuts, text entries, PiP handoffs, and transitions. This catches the cheap-template motion failure mode.

**Acceptance Criteria:**
- [ ] Tests cover cut-to-push, push-to-PiP, PiP-to-text, and transition-to-rest cases.
- [ ] Failures emit named tags and fix intent.
- [ ] Studio diagnostics show active camera vector and next handoff.

**Blocked by:** #34, #44
**Blocks:** #46

**Amendment Notes:**
[INFERRED: roadmap calls for deterministic equivalents of continuity and camera vector legality.]

### Issue #46: Implement Synthetic Pacing And Artificial Jump-Cut Engine
**Priority:** P2-Quality
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `pacing`, `planner`, `seedance-parity`
**Epic:** Visual Fidelity Systems

**Description:**
Build a pacing engine that inserts governed artificial jump cuts, zoom resets, breathe windows, and emphasis cuts aligned to phrase, breath, beat, or visual reset points. This gives Prometheus high-density short-form pacing without chaos.

**Acceptance Criteria:**
- [ ] Engine proposes cuts only at legal sync windows.
- [ ] Climax budget prevents overspending impact cuts too early.
- [ ] Cut proposals are visible in Planner Audit and Studio diagnostics.

**Blocked by:** #35, #45
**Blocks:** #47

**Amendment Notes:**
[INFERRED: roadmap places synthetic pacing downstream of graph planning and sync matrix.]

### Issue #47: Build First Semantic Macro-Rig Contract And Talking-Head Rig
**Priority:** P2-Quality
**Quarter:** Q2-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `macro-rig`, `renderer`, `seedance-parity`
**Epic:** Visual Fidelity Systems

**Description:**
Define the macro-rig contract and implement the first talking-head contextual world for data/exhibit moments. This creates a reusable path for richer context without letting rigs become hardcoded one-offs.

**Acceptance Criteria:**
- [ ] Macro-rig contract declares inputs, scene facts, asset requirements, render fields, and failure fallbacks.
- [ ] First rig supports a talking-head proof/data/exhibit moment with typography and asset placement.
- [ ] Studio and render contract tests prove the rig appears only when the semantic trigger is valid.

**Blocked by:** #41, #46
**Blocks:** #66

**Amendment Notes:**
[INFERRED: Program 8 macro-rigs are visual-system work, but first vehicle should remain talking-head before breadth.]

## Epic: Negative Evaluator Judgment Replay And Evidence
**Goal:** Make evaluation explainable, persistent, and tied to fix intent rather than vague quality scores.
**Target Quarter:** Q1-2027
**Issues:** #48 - #52

### Issue #48: Implement Executable Negative Ontology
**Priority:** P0-Critical
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `failure-taxonomy`, `judgment-layer`, `governance`
**Epic:** Negative Evaluator Judgment Replay And Evidence

**Description:**
Turn the failure taxonomy into executable evaluator rules with severity, affected artifacts, and suggested fix intent. This prevents the evaluator from being confused with generic test coverage.

**Acceptance Criteria:**
- [ ] Evaluator covers boring-under-editing, chaotic-over-editing, cheap-template-motion, repetition fatigue, climax overspend, weak concept reduction, asset mismatch, rhythm collapse, and readability sacrifice.
- [ ] Each failure emits stable ID, severity, rationale, affected frame/span, and fix intent.
- [ ] Evaluator can run on compiled manifest fixtures without rendering a full MP4.

**Blocked by:** #38, #40
**Blocks:** #49

**Amendment Notes:**
[AMENDED: existing failure taxonomy document is not enough; this issue makes it executable.]

### Issue #49: Integrate Negative Evaluator Into Judgment Layer
**Priority:** P0-Critical
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `judgment-layer`, `governance`, `architecture-debt`
**Epic:** Negative Evaluator Judgment Replay And Evidence

**Description:**
Wire the negative evaluator into the Judgment Layer so it can veto, downrank, or request fixes while preserving the hand-coded quality floor. This makes learned reward subordinate to inspectable governance.

**Acceptance Criteria:**
- [ ] Judgment verdict includes negative evaluator failures and fix intents.
- [ ] The hand-coded floor can veto learned reward and QD novelty.
- [ ] Tests prove evaluator warnings do not bypass deterministic selection.

**Blocked by:** #13, #48
**Blocks:** #50, #53, #54, #55

**Amendment Notes:**
[AMENDED: IRL proposes, Judgment vetoes; this issue makes the relationship executable.]

### Issue #50: Preserve Compiler Evidence Rejections And Render Proofs Per Job
**Priority:** P0-Critical
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `evidence`, `manifest-compiler`, `governance`
**Epic:** Negative Evaluator Judgment Replay And Evidence

**Description:**
Extend evidence preservation so every job stores compiler artifacts, rejected candidates, evaluator verdicts, render proofs, frame proofs, and downgrade/fallback tags. This closes the oversight gap where new artifacts could disappear before learning or review.

**Acceptance Criteria:**
- [ ] Evidence record includes selected candidate, rejected candidates, compiler artifact, evaluator verdict, render proof, frame proofs, and fallback tags.
- [ ] Missing evidence fails a focused integration test.
- [ ] Evidence output is inspectable and linked from Studio regression gallery.

**Blocked by:** #5, #14, #19, #49
**Blocks:** #51, #52, #56

**Amendment Notes:**
[AMENDED: evidence module exists; this issue broadens what it preserves for roadmap artifacts.]

### Issue #51: Deepen Replay Ledger For Similarity And Fatigue Queries
**Priority:** P1-Launch
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `replay-ledger`, `memory`, `governance`
**Epic:** Negative Evaluator Judgment Replay And Evidence

**Description:**
Deepen the Replay Ledger so it can answer job-level similarity, repeated primitive, repeated layout, and fatigue questions across many renders. This keeps anti-repetition separate from Pattern Memory and Creator Taste Memory.

**Acceptance Criteria:**
- [ ] Ledger can query by source fingerprint, upload instance, primitive family, layout signature, and failure tags.
- [ ] Similarity query is deterministic and testable on fixtures.
- [ ] Documentation distinguishes Replay Ledger from Pattern Memory and Creator Taste Memory.

**Blocked by:** #5, #50
**Blocks:** #56, #57

**Amendment Notes:**
[AMENDED: current Replay Ledger foundations exist; this issue adds roadmap anti-fatigue capabilities.]

### Issue #52: Enforce Pixel-Identical Determinism For Compiler And Render
**Priority:** P0-Critical
**Quarter:** Q1-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `determinism`, `render-contract`, `ci`
**Epic:** Negative Evaluator Judgment Replay And Evidence

**Description:**
Extend the determinism suite so compiled manifests and render outputs are pixel-identical for the same seed, manifest, and variation key. This is the Determinism Guardian proof for the new architecture.

**Acceptance Criteria:**
- [ ] Same compile input produces same manifest hash and same selected candidate.
- [ ] Same manifest renders pixel-identical frames within defined codec/test tolerance.
- [ ] Different variation key produces meaningful but governed differences.

**Blocked by:** #4, #10, #50
**Blocks:** #60, #71

**Amendment Notes:**
[AMENDED: existing determinism scripts are kept; this extends them across the compiler and renderer seam.]

## Epic: Learned Reward Exploration And Creator Taste
**Goal:** Build the taste-data moat after the seam, studio, feature gate, and judgment floor are real.
**Target Quarter:** Q2-2027
**Issues:** #53 - #60

### Issue #53: Train MaxEnt IRL Baseline From Absolute Demonstrations
**Priority:** P3-Scale
**Quarter:** Q2-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `irl`, `reward-model`, `research`
**Epic:** Learned Reward Exploration And Creator Taste

**Description:**
Train the first MaxEnt IRL reward weights from validated absolute demonstrations in the Golden corpus. This learns Joseph-style editorial tendencies without granting the model final render authority.

**Acceptance Criteria:**
- [ ] Trainer consumes validated same-version trajectories only.
- [ ] Output is a style-scoped weight vector with feature weights and validation metrics.
- [ ] Training report states the demonstrator cap and does not claim to exceed Joseph.

**Blocked by:** #27, #31, #32, #49
**Blocks:** #55

**Amendment Notes:**
[AMENDED: IRL is not an MVP step and remains blocked by the Golden 100 gate.]

### Issue #54: Train Pairwise Preference Reward Model From Studio Reviews
**Priority:** P3-Scale
**Quarter:** Q2-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `preference-data`, `reward-model`, `review-surface`
**Epic:** Learned Reward Exploration And Creator Taste

**Description:**
Train a pairwise reward model from Studio winner/loser reviews and failure tags. This is the separate learning path that can eventually exceed the demonstrator when humans confirm better alternatives.

**Acceptance Criteria:**
- [ ] Model consumes pairwise review ledger export with schema version and failure tags.
- [ ] Training report separates preference labels from absolute demonstrations.
- [ ] Evaluation compares preference predictions against held-out Studio reviews.

**Blocked by:** #20, #49
**Blocks:** #55, #58

**Amendment Notes:**
[INFERRED: roadmap explicitly separates pairwise preferences from MaxEnt absolute demonstrations.]

### Issue #55: Fuse Hybrid Reward Under Judgment Floor
**Priority:** P3-Scale
**Quarter:** Q2-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `reward-model`, `judgment-layer`, `governance`
**Epic:** Learned Reward Exploration And Creator Taste

**Description:**
Fuse hand-coded floor, MaxEnt absolute prior, and pairwise preference refinement into `scoreGenome` or its production equivalent. The fused reward ranks candidates but cannot override the Judgment Layer veto.

**Acceptance Criteria:**
- [ ] Hybrid reward exposes score components and selected style vector.
- [ ] Judgment Layer vetoes still block unsafe or low-quality outputs.
- [ ] Tests prove learned reward changes ranking without breaking determinism.

**Blocked by:** #27, #49, #53, #54
**Blocks:** #56, #59, #61

**Amendment Notes:**
[AMENDED: learned reward augments the hand-coded floor; it never replaces it.]

### Issue #56: Turn On QD Exploration Archive In Selection
**Priority:** P3-Scale
**Quarter:** Q2-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `quality-diversity`, `creator-taste`, `reward-model`
**Epic:** Learned Reward Exploration And Creator Taste

**Description:**
Use the Quality-Diversity archive in live candidate selection so high-quality alternatives survive across behavior dimensions. This is the creativity engine that avoids greedy template collapse.

**Acceptance Criteria:**
- [ ] QD archive updates from preserved verdicts and selected/rejected outcomes.
- [ ] Candidate selection can choose diverse high-quality treatments within Judgment constraints.
- [ ] Archive dimensions remain bounded and documented.

**Blocked by:** #37, #50, #51, #55
**Blocks:** #57, #58, #60

**Amendment Notes:**
[AMENDED: QD is not polish; roadmap treats it as required to prevent reward collapse.]

### Issue #57: Add Surprise Budget And Historical Fatigue Ledger
**Priority:** P3-Scale
**Quarter:** Q2-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `creator-taste`, `memory`, `quality-diversity`
**Epic:** Learned Reward Exploration And Creator Taste

**Description:**
Implement surprise budget and historical fatigue tracking so outputs stay fresh across weeks and months without abandoning creator consistency. This stops best-score repetition from becoming the same video forever.

**Acceptance Criteria:**
- [ ] Ledger tracks repeated primitive, layout, pacing, and macro-rig signatures per creator/channel.
- [ ] Surprise budget affects selection only inside Judgment-approved candidates.
- [ ] Tests prove fatigue reduces repetition while preserving determinism for the same ledger state.

**Blocked by:** #51, #56
**Blocks:** #58

**Amendment Notes:**
[INFERRED: roadmap Program 12 defines exploration and memory as separate from MaxEnt IRL.]

### Issue #58: Implement Creator Taste Memory Profile
**Priority:** P3-Scale
**Quarter:** Q2-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `creator-taste`, `memory`, `preference-data`
**Epic:** Learned Reward Exploration And Creator Taste

**Description:**
Create Creator Taste Memory that stores creator-specific accepted and rejected treatment tendencies over time. This is long-term preference memory, distinct from Sequence Memory, Pattern Memory, Replay Ledger, and QD Archive.

**Acceptance Criteria:**
- [ ] Profile stores preference tendencies with source verdicts and decay/version metadata.
- [ ] It can bias candidate ranking without changing the Observation Snapshot.
- [ ] Documentation and tests enforce memory concept boundaries.

**Blocked by:** #54, #56, #57
**Blocks:** #59, #68

**Amendment Notes:**
[AMENDED: use `CONTEXT.md` terminology; do not collapse memory concepts.]

### Issue #59: Implement Exceed-Demonstrator Preference Loop
**Priority:** P3-Scale
**Quarter:** Q3-2027 [ESTIMATED]
**Labels:** `ready-for-human`, `reward-model`, `preference-data`, `research`
**Epic:** Learned Reward Exploration And Creator Taste

**Description:**
Create the loop where IRL provides a craft gradient, QD proposes diverse alternatives, humans prefer winners, and the preference model climbs beyond the demonstrator. This is the core moat beyond merely copying Joseph.

**Acceptance Criteria:**
- [ ] Loop runs on a curated review batch and produces updated preference weights.
- [ ] Report compares baseline Joseph-mimic output against preference-confirmed alternatives.
- [ ] Human review remains the source of above-demonstrator confirmation.

**Blocked by:** #55, #58
**Blocks:** #68

**Amendment Notes:**
[INFERRED: roadmap says IRL alone mimics; exceeding Joseph requires this downstream loop.]

### Issue #60: Guard Against Greedy Reward Collapse
**Priority:** P0-Critical
**Quarter:** Q2-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `determinism`, `reward-model`, `governance`
**Epic:** Learned Reward Exploration And Creator Taste

**Description:**
Add tests and monitoring that detect if learned reward plus QD selection collapses into the same treatment repeatedly. This preserves creative diversity while keeping deterministic replay.

**Acceptance Criteria:**
- [ ] Regression suite flags repeated top treatment across varied inputs when alternatives exist.
- [ ] Selection report includes reward score, novelty score, fatigue adjustment, and Judgment vetoes.
- [ ] Same ledger state and variation key remain deterministic.

**Blocked by:** #52, #55, #56
**Blocks:** #61

**Amendment Notes:**
[AMENDED: this is a governance issue because greedy learned reward can undo the core product promise.]

## Epic: Style Architecture And Brand Ingestion
**Goal:** Move from one Joseph style to conditioned rewards, prompt routing, and brand-specific ingestion without creating a mixed mean.
**Target Quarter:** Q3-2027
**Issues:** #61 - #64

### Issue #61: Build Per-Style Weight Vector Catalog
**Priority:** P3-Scale
**Quarter:** Q3-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `style-architecture`, `reward-model`, `brand-ingestion`
**Epic:** Style Architecture And Brand Ingestion

**Description:**
Store learned reward weights per style or creator instead of training one unconditional reward across a mixed corpus. This prevents a bland average style and prepares transfer learning.

**Acceptance Criteria:**
- [ ] Catalog stores style ID, vehicle, feature version, training corpus, metrics, and compatible transfer sources.
- [ ] Runtime selection can choose a style vector explicitly.
- [ ] Tests prevent applying a style vector to an incompatible vehicle.

**Blocked by:** #14, #55, #60
**Blocks:** #62, #64

**Amendment Notes:**
[AMENDED: roadmap forbids one unconditional mixed-corpus reward.]

### Issue #62: Train Second Creator Style Via Transfer
**Priority:** P3-Scale
**Quarter:** Q3-2027 [ESTIMATED]
**Labels:** `ready-for-human`, `style-architecture`, `reward-model`, `research`
**Epic:** Style Architecture And Brand Ingestion

**Description:**
Train a second creator style vector seeded from Joseph within the same vehicle grammar. This proves style conditioning before prompt inference tries to route among styles.

**Acceptance Criteria:**
- [ ] Second creator corpus is curated and style-labeled.
- [ ] Transfer report shows distinct weights and visible output differences from Joseph.
- [ ] Same source under two style labels yields distinct but valid edits.

**Blocked by:** #61
**Blocks:** #63

**Amendment Notes:**
[INFERRED: roadmap names a second creator via transfer as the Phase C starting point.]

### Issue #63: Add Prompt-To-Style Router After Two Styles Exist
**Priority:** P3-Scale
**Quarter:** Q3-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `style-architecture`, `prompt-governance`
**Epic:** Style Architecture And Brand Ingestion

**Description:**
Build a prompt-to-style classifier that routes prompts to trained style weights only after at least two styles exist. Prompt influence stays inside Prompt Governance and cannot override locked architecture.

**Acceptance Criteria:**
- [ ] Router refuses to infer style when fewer than two trained styles are available.
- [ ] Prompt influence produces explicit allow/block reasons.
- [ ] Routing decision is stored in evidence and remains deterministic.

**Blocked by:** #62
**Blocks:** #64

**Amendment Notes:**
[AMENDED: roadmap says style classifier is meaningless before two trained styles exist.]

### Issue #64: Implement Brand Ingestion Tier 1 And Tier 2 Gates
**Priority:** P3-Scale
**Quarter:** Q4-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `brand-ingestion`, `style-architecture`, `governance`
**Epic:** Style Architecture And Brand Ingestion

**Description:**
Implement brand ingestion with retrieval/matching for 1-5 videos and learned refinement only for brands with 30+ curated videos. This avoids overpromising learned style from tiny samples.

**Acceptance Criteria:**
- [ ] Tier 1 returns stable retrieval/matching guidance for 1-5 videos.
- [ ] Tier 2 training is unavailable until 30+ curated videos pass QA.
- [ ] Evidence records which tier was used and why.

**Blocked by:** #61, #63
**Blocks:** None

**Amendment Notes:**
[AMENDED: roadmap explicitly forbids promising learned brand style from 1-5 videos.]

## Epic: Multi-Vehicle And Platform Surface
**Goal:** Expand beyond talking-head only after the scene model, extraction, and reward boundaries are real.
**Target Quarter:** Q4-2027
**Issues:** #65 - #68

### Issue #65: Build Multi-Vehicle Scene-Type Detection Router
**Priority:** P3-Scale
**Quarter:** Q4-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `multi-vehicle`, `scene-router`, `architecture-debt`
**Epic:** Multi-Vehicle And Platform Surface

**Description:**
Build a router that detects talking-head, property, drone, product, and document-exhibit scene types and selects a scene model. This prevents the 1B-person vision from forcing every input through talking-head assumptions.

**Acceptance Criteria:**
- [ ] Router emits vehicle, confidence, evidence facts, and selected scene model.
- [ ] Talking-head remains the default only when evidence supports it or confidence is low.
- [ ] Human-gate docs define when a new vehicle may be added.

**Blocked by:** #2, #33, #35
**Blocks:** #66, #67

**Amendment Notes:**
[INFERRED: roadmap gates vehicle expansion on scene models and extraction adapters.]

### Issue #66: Implement First Non-Talking-Head Scene Model
**Priority:** P3-Scale
**Quarter:** Q1-2028 [ESTIMATED]
**Labels:** `ready-for-human`, `multi-vehicle`, `scene-model`, `macro-rig`
**Epic:** Multi-Vehicle And Platform Surface

**Description:**
Specify and implement the first new vehicle scene model, preferably property walkthrough or product demo, with its own primitive set, pacing regime, PiP behavior, and macro-rigs. This proves breadth is architectural, not profile configuration.

**Acceptance Criteria:**
- [ ] Scene model declares footage assumptions, planner primitives, camera grammar, and failure classes.
- [ ] Router can produce a valid edit under the new model.
- [ ] Output does not degrade into talking-head fallback unless explicitly downgraded.

**Blocked by:** #47, #65
**Blocks:** #67

**Amendment Notes:**
[AMENDED: this is intentionally after the talking-head seam and quality systems.]

### Issue #67: Add Vehicle-Specific Extraction Adapter And Reward Boundary
**Priority:** P3-Scale
**Quarter:** Q1-2028 [ESTIMATED]
**Labels:** `ready-for-agent`, `multi-vehicle`, `feature-audit`, `reward-model`
**Epic:** Multi-Vehicle And Platform Surface

**Description:**
Build an extraction adapter for the first new vehicle and prevent cross-vehicle reward transfer unless explicitly approved. Vehicle-specific features are required because drone, property, product, and document scenes have different state spaces.

**Acceptance Criteria:**
- [ ] Adapter emits vehicle-specific features with featureVersion metadata.
- [ ] Style/reward catalog refuses incompatible vehicle weights.
- [ ] Validation compares adapter features against manual vehicle audit notes.

**Blocked by:** #32, #65, #66
**Blocks:** None

**Amendment Notes:**
[AMENDED: roadmap forbids naive reward transfer across vehicles.]

### Issue #68: Implement Auto-Publish And Analytics Feedback Surface
**Priority:** P3-Scale
**Quarter:** Q4-2027 [ESTIMATED]
**Labels:** `ready-for-human`, `platform`, `analytics-feedback`, `reward-model`
**Epic:** Multi-Vehicle And Platform Surface

**Description:**
Build the honest platform surface: auto-publish through official upload APIs and post-hoc analytics feedback into learning. Do not claim direct recommendation algorithm integration.

**Acceptance Criteria:**
- [ ] Auto-publish stores platform, asset ID, publish status, and public URL where available.
- [ ] Analytics ingestion records lagged retention/engagement signals as noisy preference data.
- [ ] Product copy and docs explicitly avoid direct algorithm-integration claims.

**Blocked by:** #58, #59
**Blocks:** None

**Amendment Notes:**
[AMENDED: roadmap states platforms do not expose ranking algorithms; this issue uses only achievable surfaces.]

## Epic: Dry-Run Graduation And Render Infrastructure
**Goal:** Graduate placeholders to live artifacts and make rendering economical, observable, and scalable.
**Target Quarter:** Q2-2027
**Issues:** #69 - #72

### Issue #69: Graduate Audio DJ From Placeholder Grids To Analyzer Artifacts
**Priority:** P2-Quality
**Quarter:** Q2-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `audio`, `dry-run-to-live`, `music-dj`
**Epic:** Dry-Run Graduation And Render Infrastructure

**Description:**
Replace Audio DJ decisions based on fake beat grids or filename heuristics with persisted analyzer artifacts. This gives transitions, drops, silence windows, and ducking decisions real timing evidence.

**Acceptance Criteria:**
- [ ] Arrangement planner consumes artifact-backed beat/downbeat/section data when available.
- [ ] Placeholder fallback remains deterministic but is labeled and downranked.
- [ ] Tests cover phrase-aware transition placement on real analysis fixtures.

**Blocked by:** #30
**Blocks:** #70

**Amendment Notes:**
[AMENDED: current music infrastructure is render-safe MVP; this issue upgrades analysis fidelity.]

### Issue #70: Make R2 Music Beds Render-Safe With License Guards
**Priority:** P2-Quality
**Quarter:** Q2-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `audio`, `r2`, `license-guard`, `dry-run-to-live`
**Epic:** Dry-Run Graduation And Render Infrastructure

**Description:**
Move R2 music references from previewable placeholders to render-safe cached local assets with license/commercial-use metadata. This prevents remote preview paths from reaching FFmpeg as false render-safe inputs.

**Acceptance Criteria:**
- [ ] R2 music asset is not `renderSafe` until cached locally with a valid file path.
- [ ] License guard blocks or downgrades non-commercial tracks.
- [ ] Evidence records chosen track, license decision, cache path, and analysis artifact.

**Blocked by:** #30, #69
**Blocks:** None

**Amendment Notes:**
[AMENDED: v8.2 already notes R2 music can be previewable remotely but not render-safe without a local cache.]

### Issue #71: Prove Linux Swangle Parity And GPU-First Fallback
**Priority:** P3-Scale
**Quarter:** Q2-2027 [ESTIMATED]
**Labels:** `ready-for-human`, `infra`, `render`, `gpu`, `determinism`
**Epic:** Dry-Run Graduation And Render Infrastructure

**Description:**
Move render infrastructure toward Linux CPU swangle parity and GPU-first rendering with swangle fallback telemetry. This addresses unit economics without confusing render infrastructure with composition logic.

**Acceptance Criteria:**
- [ ] Linux CPU swangle produces byte-identical or defined-tolerance output to Windows swangle on the same fixture.
- [ ] GPU render crash automatically retries on swangle and records the winning path.
- [ ] Render telemetry includes `render_path: gpu | swangle`.

**Blocked by:** #2, #52
**Blocks:** #72

**Amendment Notes:**
[INFERRED: roadmap Program 19 identifies Linux swangle parity as the immediate zero-risk infra win.]

### Issue #72: Bound Temp Files Texture Disposal And Render Telemetry
**Priority:** P3-Scale
**Quarter:** Q2-2027 [ESTIMATED]
**Labels:** `ready-for-agent`, `infra`, `render`, `telemetry`, `architecture-debt`
**Epic:** Dry-Run Graduation And Render Infrastructure

**Description:**
Add temp-file hygiene, texture disposal discipline, and render-path telemetry to prevent 10MB sources from creating multi-GB temporary bloat. This hardens the production path for scale.

**Acceptance Criteria:**
- [ ] Batch render temp-dir usage stays within a documented bound for a fixture source.
- [ ] `THREE.VideoTexture` or equivalent render resources are disposed between jobs where applicable.
- [ ] Failure intelligence records render path, cleanup status, disk usage, and fallback reason.

**Blocked by:** #71
**Blocks:** None

**Amendment Notes:**
[AMENDED: roadmap says temp bloat is a path-hygiene issue, not an OS decision.]
