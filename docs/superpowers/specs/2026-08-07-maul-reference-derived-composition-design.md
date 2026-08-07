# MAUL Reference-Derived 9:16 Composition Design

**Status:** Approved architecture, pending written-spec review

**Date:** 2026-08-07

## Purpose

MAUL needs to answer a measurable product question, not merely demonstrate that a
composition system can be assembled:

> Can a reference-derived, scene-aware 9:16 composition system consistently
> produce original short-form typography treatments that reviewers judge as
> belonging to the quality and visual-language class represented by the supplied
> Q1/Yuan reference corpus?

The current code has useful typography treatments, scene evidence, a font asset
path, and release gates. It does not yet form one authoritative causal path from
reference evidence to pixels. The largest known weakness is placement: it is
based on coarse rectangular evidence and does not understand a matte, facial
semantics, depth, or stable temporal negative space. The current font selection
also underuses the available inventory and confuses curated compatibility priors
with observed pairing performance.

This design creates the first complete, auditable vertical slice for 9:16
talking-head and reference-like short-form composition. It makes renderer or
wiring failures observable and separately measurable from artistic quality.

## Scope

### First 24-hour objective

Produce a representative, end-to-end 9:16 composition path that:

1. accepts an approved reference-derived brief and a temporally analyzed source
   scene;
2. searches multiple typography, hierarchy, placement, overlap, and motion
   alternatives from an eligible verified font inventory;
3. realizes the winning alternative through one canonical render manifest and
   one Remotion execution path;
4. produces a render-fidelity report proving that selected decisions reached
   pixels; and
5. produces a visual-evidence and evaluation report that identifies the first
   failure node if the result is poor.

The sprint must include the supplied matted talking-head asset because it is a
known stress case for the existing rectangular placement solver. It must also
include at least one source or shot with material open background. A successful
sprint proves causal connectivity and exposes the quality gap. It does **not**
prove corpus-wide Q1/Yuan parity, claim broad statistical validity, or assert
that an arbitrary video can receive cinematic treatment.

### Subsequent program objective

Build a reference-derived visual grammar, candidate search system, evaluation
protocol, and human-review learning loop that can be tested on held-out source
shots. The initial scope is vertical 9:16 short-form typography. Joseph's
landscape path receives compatible contracts and can consume the artifacts later;
it is not rewritten inside the first vertical implementation.

### Out of scope

- Directly copying a reference editor's identity, assets, exact template, or
  sequence.
- Letting an LLM mutate raw SVG or renderer code as the creative authority.
- Treating OCR alone as sufficient scene evidence.
- Rendering every theoretical font/layout combination without pruning.
- Claiming that a font with more glyphs has better aesthetic placement. Glyph
  coverage supports language and visual range; exact shaped glyph geometry,
  readability, scene interaction, and review evidence determine placement.
- Replacing Remotion. Remotion remains the canonical execution renderer.
- Automatic promotion of every reviewed render into reusable knowledge.

## Product Truth and Confidence Language

The system must report different claims separately. A successful render is not
evidence of an attractive composition, and a small preference test is not proof
of general cinematic parity.

| Claim | Required evidence | Permitted conclusion |
| --- | --- | --- |
| Render fidelity | Manifest-to-pixel checks, loaded-font verification, mask and coordinate evidence | The renderer executed the requested realization. |
| Constraint soundness | Scene evidence, collision checks, contrast/readability checks, temporal checks | The candidate obeyed defined safety and legibility rules. |
| Reference-grammar adherence | Reference-analysis provenance and measured relation to grammar distributions | The candidate follows specified original visual-language traits. |
| Comparative quality | Blinded, randomized human comparison against a declared baseline | Reviewers preferred this system under this protocol. |
| General Q1/Yuan-class quality | Held-out source-level review across representative strata with confidence intervals | The result supports a bounded style-class claim. |

No fixed confidence percentage is a measured result until the last two rows have
real review evidence. Earlier 70-85% architecture estimates are engineering
priors about plausibility, not product-quality facts. The dashboard must show
the claim, independent source count, reviewer count, reviewer agreement,
stratification, confidence interval, and exclusions beside every score.

## Core Architectural Principle

Every visible creative decision must be traceable backwards to evidence and
forwards to render proof:

```text
Reference Corpus -> Reference Analysis -> Reference Grammar
                                               |
Composition Brief + Observation Model -> Scene Representation
                                               |
                                               v
                                     Candidate Generator <---- Evaluation diagnostics
                                               |
                                               v
                                   Composition Candidate (intent)
                                               |
                                               v
                                  Visual Realization (implementation)
                                               |
                                               v
                                  UnifiedRenderManifest / compiler
                                               |
                                               v
                                  Canonical Remotion Renderer
                                               |
                          +--------------------+---------------------+
                          v                                          v
                   Render Fidelity                            Visual Evidence
                          |                                          |
                          +--------------------+---------------------+
                                               v
                                       Evaluation Report
                                               |
                                               v
                            Human Review -> Knowledge Extraction -> Pattern Memory
```

An append-only **Decision Ledger** is emitted beside every transition. Artifacts
answer what was produced; ledger entries answer why it was produced, rejected,
or degraded. Every artifact includes an ID, parent IDs, schema version, content
hash, policy/model/configuration versions, timestamps, and status:
`verified`, `degraded`, `blocked`, or `fallback`.

Downstream stages can reject or request a bounded revision of an upstream
proposal. They cannot silently substitute a creative decision. This prohibition
is the mechanism that turns wiring defects into named, testable failures.

## Artifact Ownership and Contracts

### Terminology migration

`CONTEXT.md` currently defines an Observation Snapshot as a deterministic
planner-facing artifact of scene and production facts. For this composition
system, **Observation Model** is the temporal, evidence-rich successor at the
composition boundary. It may materialize a compatibility Observation Snapshot
for existing planner code during migration, but new composition decisions must
consume the Observation Model or its Scene Representation, never a frame-like
safe-area snapshot. Workstream 1 updates the domain documentation and makes the
adapter explicit before both terms coexist in production contracts.

### Reference Corpus

The Reference Corpus is immutable evidence: supplied videos, screenshots,
rights/provenance state, source identifiers, extraction timestamp, and content
hash. It is never edited to fit a later theory. Corrections are new metadata
records referencing the unchanged source.

### Reference Analysis

Reference Analysis is a reproducible, versioned observation record for a source
or extracted moment. It records only what can be inspected, measured, or
reviewed: source time range, frame geometry, subject count and position, text
region, line count, hierarchy, type morphology, contrast, overlap/depth,
motion onset and duration, camera behavior, and annotation confidence. It links
annotations to frame/time evidence rather than asserting unexplained taste.

### Reference Grammar

Reference Grammar is an evolving interpretation of Reference Analysis, never a
mutation of the corpus. It contains distributions, composition families,
eligibility constraints, empirical priors, and exemplars. A grammar rule carries
its version, evidence IDs, sample count, confidence/uncertainty, source strata,
and expiry or review requirement. For example, it may state that a category of
three-word hook, under a specific scene topology and editorial intent, commonly
uses a given hierarchy or controlled torso overlap. It does not prescribe a
copied named font or a fixed SVG.

### Composition Brief

The Composition Brief expresses external intent and immutable production
constraints. It includes platform/frame format, transcript phrase and emphasis,
editorial intent, brand constraints, language, target time span, motion budget,
allowed treatments, forbidden content, and baseline/comparison configuration.
It is input, not evidence; it cannot overwrite scene facts or renderer safety.

### Observation Model

The Observation Model contains temporal source evidence across the composition
window, not a single-frame snapshot. It includes:

- segmentation/matte masks and confidence;
- face, eye, mouth, hand, microphone, and primary-gesture masks;
- pose and subject trajectories;
- depth/foreground ordering when available;
- camera motion, cut state, stabilization, and optical-flow summaries;
- speech activity, phrase timing, and emphasis timing;
- contrast, clutter, saliency, and empty-space fields; and
- per-observation provenance, confidence, cadence, and temporal stability.

OCR may contribute known existing on-screen text and global context but cannot
substitute for masks, landmarks, depth, or pixel-level collision evidence.

### Scene Representation

The Scene Representation fuses the Observation Model into an explicitly
temporal, queryable scene topology. It exposes stable placement regions,
foreground/background layers, subject importance, visual-complexity fields,
contrast fields, motion envelopes, and uncertainty. It must retain the original
masks and landmarks so a later candidate can be re-evaluated against direct
evidence rather than a lossy safe rectangle.

The representation classifies overlap targets semantically:

| Region class | Examples | Policy |
| --- | --- | --- |
| Critical | eyes, mouth, primary gesture | Hard reject except an explicitly approved artistic exception with review evidence. |
| Protected | face contour, microphone, hands | Strong penalty; only narrow, readable, intentional overlap may proceed. |
| Flexible | shoulders, torso, hair, clothing | Candidate search may use controlled overlap and foreground depth modes. |
| Free | background or stable empty space | Preferred for clarity, but not the sole acceptable target. |

### Composition Candidate

A Composition Candidate is a scene-specific intent hypothesis, not renderer
coordinates. It contains a composition family, hierarchy intent, placement mode,
depth/overlap intent, typography intent, treatment intent, motion intent, and
constraints inherited from the brief and scene. It is deliberately independent
of a particular font or SVG implementation.

### Visual Realization

A Visual Realization makes a candidate executable: exact verified font assets
and role assignment, shaped text measurements, line breaks, font sizes/axes,
coordinates, anchors, colors, gradients, strokes, shadows, masks, z-order,
animation curves, timing, and renderer parameters. A candidate can produce
multiple realizations. Realization must preserve the candidate's intent or
return a diagnostic stating which constraint prevented it.

### UnifiedRenderManifest and Manifest Compiler

`UnifiedRenderManifest` is the sole creative input to the canonical renderer.
The Manifest Compiler is the only translation layer from selected realization to
the shared manifest. It may adapt existing SVG programs and cinematic treatments
as parameterized realization backends, but it may not choose an unrequested
font, slot, layout, fallback treatment, or depth mode.

Existing templates are presentation programs, not placement engines. The current
word-count slot schema and the fixed 1000x1000 SVG geometry become internal
implementation details behind realization adapters. The planned creative path
must no longer bypass SVG/cinematic treatment merely because a field such as
`creativeTreatment` is present.

### Canonical Renderer

Remotion executes the manifest. It has no creative authority. It receives
explicit, renderer-safe font assets; frame geometry; layer order; masks; and
animation parameters. Missing or unsupported capabilities return an explicit
manifest validation failure or explicit governed fallback that remains visible in
the Decision Ledger and Render Fidelity report. Silent default substitutions are
prohibited.

### Render Fidelity

Render Fidelity proves execution correctness, independently of aesthetics. It
records the manifest hash, font-file and embedded-family verification, shaped
text bounds, applied transform/mask/gradient/z-order evidence, expected versus
observed primitive bounds, sampled-frame checks, and explicit fallback state.
Tests must prove each claimed manifest field has a visible or measurable renderer
effect. A change that only updates a TypeScript object is not render fidelity.

### Visual Evidence and Evaluation Report

Visual Evidence records what is visible in the result: readable area, critical
and protected-region occlusion, contrast, line-break quality, hierarchy,
placement stability, visual clutter, motion stability, style-grammar relation,
and sequence consistency. The Evaluation Report consumes that evidence in
stages, retains score components and reasons, and returns diagnoses that can
target a search dimension rather than discard an entire candidate blindly.

### Decision Ledger, Knowledge Extraction, and Pattern Memory

Ledger entries contain input artifact IDs, action, output artifact IDs, policy or
model version, evidence IDs, scores, comparison set, decision reason, and
fallback/degraded state. Example: reject a realization because a primary gesture
mask at 0.96 confidence is occluded by 41% under `OverlapPolicy v3.2`.

Human review does not automatically alter future policy. Knowledge Extraction
clusters reviewed results, checks repeatability and reviewer agreement, and
records a bounded finding with provenance. Only those validated findings may be
promoted into Pattern Memory or the Typography Knowledge Base. This prevents
isolated preference noise from becoming a permanent rule.

## Typography Knowledge Base

The font system must be a governed, evidence-backed search space. It has four
separate layers that must never be conflated.

### 1. Font Asset Registry

The registry inventories every production-eligible font asset. Eligibility
requires rights/licence metadata, a stable asset ID, actual binary retrieval,
Fontkit parse success, renderer embedding/loading evidence, supported language
coverage, and a content hash. A missing, unlicensed, corrupt, or renderer-
incompatible font is excluded with a named reason rather than silently falling
back to a handful of default families.

### 2. Intrinsic Font Metrics

Intrinsic metrics are directly measured from the font file or an approved
specimen pipeline: family/style/weight, variable axes, glyph coverage, Unicode
support, units per em, ascender/descender, x-height/cap height where available,
advance widths, width class, stroke/modulation proxies, serif/script/display
classification, optical-size support, and exact phrase shaping measurements.
They are stable properties of a font asset/version, not taste claims.

### 3. Typography Evidence

Typography Evidence contains observed behavior in actual candidate and reference
contexts: mobile readability, hero/support/accent role success, line-break
tolerance, motion robustness, editorial-space coordinates, reviewer preference,
failure classes, source strata, and confidence. These values can improve without
rewriting intrinsic metrics.

Editorial meaning is stored as a continuous, calibrated vector rather than
permanent discrete labels. Initial dimensions can include luxury, authority,
warmth, aggression, precision, and energy. Their values must identify whether
they came from an expert prior, reference analysis, or reviewed realization.
They become learned only after sufficient evidence exists.

### 4. Pair Evidence and Priors

The compatibility graph is a prior: curated role constraints and plausible pair
edges. It is useful for eligibility and search pruning but cannot claim empirical
success merely because an edge exists. Pair Evidence records the observed pair,
role assignment, phrase geometry, context, treatments, number of eligible uses,
readability, preference rate, reviewer agreement, confidence interval, and
known failure modes. The search score combines declared prior weight and observed
evidence weight, reporting both.

### Phrase Geometry and Typography Corpus

The system stores exact shaped geometry for each phrase-realization combination
and learns reusable composition families from evidence: one-word hero, two-line
hero statement, asymmetric hinge, stacked emphasis, balanced four-word block,
accent tail, and other observed families. These are candidate families, not
word-count-only templates. A seven-word phrase in an open background and a
three-word phrase in a tight close-up have different feasible sets.

The Typography Evaluation Corpus stores a phrase, scene class, font roles,
line breaks, hierarchy, placement, treatment, motion, render, review outcome,
and evidence IDs. It is the source of empirical typography taste, distinct from
the raw video Reference Corpus.

## Scene-Aware 9:16 Composition

### Placement is composition, not a safe-rectangle lookup

The Composition Engine simultaneously reasons over hierarchy, visual balance,
scale, depth, rhythm, placement, treatment, and motion. A specialized Placement
Compiler converts a selected candidate and realization into temporal placement
envelopes, glyph-level collision checks, layer ordering, and valid animation
paths. It does not decide the whole composition alone.

### Composition families for short phrases

The initial grammar contains parameterized candidate families for 1-8+ word
phrases. Each family states roles, break possibilities, relative scale ranges,
anchor options, overlap policy, and allowable motion families. It does not
hardcode coordinates. Examples include:

- one-word hero with a support or accent layer;
- two-word contrast pair with asymmetric emphasis;
- three-word stacked or hinged headline;
- four-to-six-word two-line statement with a hero word;
- longer editorial caption with one elevated phrase and readable support lines;
- script/display/sans lockups only when the exact phrase, language, scene, and
  contrast evidence permit them.

Candidate realization measures the actual glyph paths/bounds after font selection
and tests the resulting geometry against masks. Word count is one input among
phrase geometry, scene topology, editorial intent, motion envelope, and
available visual contrast.

### Controlled overlap and depth

Overlap is evaluated semantically and temporally, not globally banned by a fixed
percentage. Valid modes include `front`, `behind-subject`, `integrated`, and
`avoid-subject`. A behind-subject result requires a usable subject matte and
clear z-order evidence. A controlled overlap may use shoulder/torso/hair regions
when readability, intentionality, and temporal stability are positive. Eyes,
mouth, and primary gestures remain hard constraints by default.

The system must inspect a candidate over the composition interval, not only at a
single attractive frame. It rejects a placement whose safe region disappears,
whose text intersects a moving critical region, or whose contrast collapses
during its hold. Motion may adapt within a predeclared envelope, but cannot drift
through protected areas after the candidate has been approved.

## Search and Evaluation Loop

Search is hierarchical and constraint-propagated rather than a flat Cartesian
product. The first practical budget is deliberately modest and configurable:

```text
Scene + brief + grammar
  -> composition-family and depth candidates
  -> analytical constraint pruning
  -> font-role and line-break realizations
  -> exact glyph/scene geometry pruning
  -> treatment and motion realizations
  -> low-cost raster previews
  -> canonical renders of shortlisted candidates
  -> visual evaluation and blinded review
```

The initial candidate budget should be large enough to expose alternatives but
small enough to run repeatedly during debugging. Configuration, not hardcoded
claims, sets the count. An initial vertical-slice profile may generate 24-48
composition candidates, expand only the top 4-8 font-role combinations per
candidate, analytically prune invalid realizations, raster-check 16-32, and
perform expensive canonical rendering on the top 4-8. The engine records actual
counts, prune reasons, cost, and score deltas. Higher-volume search is a later
capacity optimization, not a prerequisite for proving the architecture.

Evaluation stages are ordered by cost:

1. artifact integrity, source/rights state, and manifest schema;
2. hard semantic constraints and temporal collision checks;
3. geometry, contrast, readability, and typography measurements;
4. render-fidelity checks on canonical frames;
5. perceptual/style-grammar evaluation;
6. human pairwise editorial ranking where required;
7. sequence-level consistency for multi-moment outputs.

An Evaluation Report returns dimension-level feedback such as `placement_failed`,
`hierarchy_weak`, `font_pair_low_evidence`, `motion_unstable`, or
`render_fidelity_failed`. The Candidate Generator uses only permitted feedback to
resample the affected dimensions. It cannot mutate protected source facts or
erase a negative report.

## Canonical Render and Failure Accountability

The first vertical slice has one canonical creative route. The current fixed SVG
programs and cinematic treatments can remain as realization adapters, but no
parallel path may override their parameters or bypass a selected treatment. The
current condition that causes a cinematic SVG branch to run only when
`creativeTreatment` is absent must be replaced by an explicit manifest-selected
adapter policy with fidelity tests.

Every manifest field that affects presentation must have all four links:

```text
intent field -> realization value -> manifest value -> observed render evidence
```

The basic accountable failure map is:

| Symptom | First accountable node | Required proof |
| --- | --- | --- |
| Wrong or default font in output | asset registry, realization, manifest compiler, renderer | asset hash, loaded family, text metric and pixel evidence |
| Correct design JSON but wrong position | placement compiler or renderer transform | expected/observed glyph bounds at sampled frames |
| Text covers face, eyes, microphone, or gesture | observation model, scene representation, overlap policy, placement compiler | mask confidence, intersection timeline, policy decision |
| Treatment disappears | realization adapter or renderer | per-layer manifest trace and sampled primitive output |
| Animation causes later collision | motion envelope or temporal evaluator | collision/contrast timeline across hold frames |
| Render is faithful but unattractive | grammar, candidate generator, evaluator, or insufficient evidence | fidelity pass plus visual-evidence diagnostics and review result |

No generic `fallback` is allowed. A fallback must name its trigger, the
substituted behavior, the affected decision, and whether the result remains
eligible for an art-direction claim. Unverified fallback output cannot count as
reference-quality evidence.

## Validation and Release Evidence

### 24-hour vertical-slice gates

The immediate gate is passed only when all conditions hold:

1. A matted full-frame talking-head case and an open-background case both have
   a complete artifact chain and Decision Ledger.
2. At least three phrase geometries (short hero, multi-word hook, longer
   statement) are evaluated against each case where the transcript permits.
3. The search produces more than one eligible realization; a single
   deterministic default does not satisfy the gate.
4. Each final manifest field used by the winning result has render-fidelity
   evidence, including font, line breaks, placement, depth/mask state,
   treatment, and motion.
5. The full-frame talking-head output either uses a valid controlled-overlap or
   returns an explainable `no-safe-realization` result. It may not pretend that a
   coarse rectangle is safe.
6. The report clearly separates fidelity success from visual-quality result and
   names the next limiting component.

### Reference-quality validation program

The supplied corpus is currently useful for grammar discovery but too small to
justify broad statistical certainty, especially because three video sources do
not provide three independent editorial universes. Validation must:

- split by source video/shot, never random frames from the same source, to avoid
  leakage;
- reserve held-out sources or shot groups before grammar/policy tuning;
- stratify by scene archetype: tight talking head, microphone/gesture, open
  background, multiple subjects, camera movement, and high clutter;
- compare against a declared baseline using randomized, blinded pairwise review;
- collect at least three independent reviewers per comparison and record
  disagreement;
- report source-clustered preference estimates and confidence intervals rather
  than treating adjacent frames as independent samples;
- report per-stratum as well as aggregate results; and
- keep reviewer notes and named failure classes as evidence, not hidden model
  input.

The existing 30-case/80% launch gate is a bounded product gate, not proof of
general quality. If 24 of 30 independent cases win, the observed rate is 80%; a
95% Wilson interval is approximately 62.7%-90.5%. That interval is too broad to
justify sweeping claims and becomes still weaker if cases share the same source.
The dashboard must say so.

## Delivery Workstreams and Dependency Order

### Workstream 0: Baseline and acceptance harness

Freeze current focused tests, deterministic source fixtures, exact versions, and
baseline renders. Add the matted-head and open-background cases as named,
replayable acceptance fixtures. Establish a single command that emits all
artifacts and a human-inspectable trace for one case.

### Workstream 1: Authoritative artifacts and ledger

Define versioned shared contracts for Reference Analysis/Grammar, Composition
Brief, Observation Model, Scene Representation, Composition Candidate, Visual
Realization, render fidelity, visual evidence, evaluation report, and ledger
entries. Add validation and fixture builders. This workstream is complete only
when every edge rejects missing provenance or a silent fallback.

### Workstream 2: Canonical manifest and renderer fidelity

Make the compiler the sole creative handoff to `UnifiedRenderManifest`. Convert
existing text layers, SVG programs, and cinematic treatments into explicit
realization adapters. Eliminate the known creative-treatment SVG bypass and add
field-to-pixel contract tests. This is the workstream that prevents a good plan
from disappearing during render.

### Workstream 3: Font Asset Registry and Typography Knowledge Base

Inventory all configured production font assets, prove loading/measurement, and
expose exclusions. Split intrinsic metrics, expert priors, typography evidence,
and pair evidence. Migrate current default font systems into low-weight priors.
Implement deterministic exact phrase shaping and role-aware pair-search input.

### Workstream 4: Temporal scene topology and controlled overlap

Replace the rectangle-only decision surface with a temporal observation/scene
representation. Add semantic masks, confidence, stability, depth capability,
and glyph-level intersection APIs. Implement hard critical-region constraints
and bounded flexible-region overlap/depth modes.

### Workstream 5: 9:16 composition grammar and realization adapters

Encode reference-derived, parameterized composition families for phrase geometry
and editorial intent. Make the current 12 SVG programs reusable treatment/motion
adapters rather than fixed placements. Each adapter declares capabilities,
required evidence, and how it maps every realization parameter to render fields.

### Workstream 6: Hierarchical search and diagnostic evaluation

Implement candidate generation, staged pruning, configured budgets, progressive
rendering, evaluation feedback, and detailed Decision Ledger entries. The first
evaluation provider can be deterministic and rubric-based; art-direction claims
remain blocked until a configured perceptual provider and human review evidence
exist.

### Workstream 7: Corpus operations, review, and confidence dashboard

Build reference-analysis records, grammar provenance, Typography Evaluation
Corpus records, blinded pairwise review surfaces, knowledge extraction rules,
and source-level confidence reporting. No learned score is promoted without a
defined dataset, reviewer protocol, and leakage control.

### Workstream 8: Landscape transfer

After the vertical slice passes its gates, add a landscape scene adapter and
renderer adapter that consume the same brief, candidate, realization, manifest,
evidence, and ledger contracts. Only format-specific grammar and render
capabilities may differ. Joseph does not receive a separate untraceable creative
authority.

Workstreams 1 and 2 are prerequisites for all quality claims. Workstreams 3-6
form the first usable vertical slice. Workstream 7 turns an engineering result
into a confidence-backed product claim. Workstream 8 is intentionally delayed.

## Testing Strategy

Each workstream uses test-first development with these proof levels:

1. **Contract tests:** schemas reject absent parent/evidence IDs, invalid status
   transitions, unverified fonts, and silent fallback fields.
2. **Deterministic unit tests:** font eligibility, phrase shaping, overlap
   classification, temporal stability, grammar selection, realization mapping,
   and evaluation diagnosis.
3. **Property tests:** no candidate marked eligible intersects a critical mask;
   unsupported adapter capabilities cannot become verified manifest fields;
   a renderer cannot receive a font asset absent from the registry.
4. **Integration tests:** a fixed fixture flows from brief/observations through
   candidate search to a canonical manifest, render-fidelity record, visual
   evidence, and ledger.
5. **Pixel/render tests:** sampled frames verify text bounds, font-loading
   signature, mask/depth application, line breaks, transform position, and
   treatment visibility. These tests deliberately detect the known problem where
   a selected treatment is bypassed at render time.
6. **Acceptance/review tests:** named matted-head and open-background fixtures
   produce multiple candidates, explain all pruning, and distinguish a graceful
   no-safe-realization outcome from a placement error.

Visual snapshots are supporting evidence, not the sole assertion. Assertions
must use named geometry, font, mask, and manifest evidence so a minor raster
difference does not hide a semantic regression.

## Risks and Required Responses

| Risk | Required response |
| --- | --- |
| Font inventory is large but retrieval/loading is incomplete | Report eligibility and exclusion reason; do not call unavailable fonts searchable. |
| A rich font is technically valid but performs poorly in a role | Keep it eligible, let Pair Evidence and review lower its empirical weight. |
| Segmentation/landmark confidence is poor | Mark scene evidence degraded; restrict behind-subject/overlap modes and explain the conservative result. |
| No stable placement exists for a full-frame subject | Return `no-safe-realization` with evidence or use only explicitly permitted controlled overlap; never fabricate safe space. |
| Candidate count creates unacceptable render cost | Use analytical and low-cost raster pruning, record prune loss, and increase budgets only when evidence justifies it. |
| Evaluation rewards a hack or reference imitation | Require originality constraints, held-out sources, human review, and failure-taxonomy audit. |
| A renderer path silently changes output | Fail render-fidelity tests and block reference-quality claims until the field-to-pixel trace is restored. |
| Few reference videos create false statistical confidence | Treat corpus as discovery evidence, expand independent sources, and label all confidence as bounded. |

## Definition of Done for the First Slice

The first slice is complete when a developer can select a named 9:16 fixture,
open one trace, and determine:

1. which reference facts and grammar records influenced its composition;
2. which temporal scene evidence made each placement/overlap decision legal;
3. which verified font assets and pair evidence were searched and why the winner
   was chosen;
4. how candidate intent became exact shaped geometry, style, depth, and motion;
5. what exact manifest the renderer executed and proof that it did so;
6. whether the output failed render fidelity, hard constraints, visual quality,
   or insufficient evidence; and
7. whether any validated human feedback was promoted into reusable knowledge.

The system may then make a narrow, honest claim: it has a causally connected,
render-verified, scene-aware vertical typography path. It cannot claim Q1/Yuan
style-class equivalence until the held-out review protocol supports that claim.
