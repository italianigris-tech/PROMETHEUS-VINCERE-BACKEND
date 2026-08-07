# MAUL Reference-Derived 9:16 Composition Design

**Status:** Approved architecture, closed-loop experiment revision pending written-spec review

**Date:** 2026-08-07

## Purpose

MAUL needs to answer a measurable product question, not merely demonstrate that a
composition system can be assembled:

> Can a reference-derived, scene-aware 9:16 composition system consistently
> produce original short-form typography treatments that reviewers judge as
> belonging to the quality and visual-language class represented by the supplied
> Q1/Yuan reference corpus?

The current code has useful typography treatments, scene evidence, font asset
paths, animation retrieval, SVG programs, Joseph composition modules, renderer
adapters, evidence ledgers, and release gates. It does not yet form one
authoritative causal path from reference evidence to pixels. This is
**capability fragmentation**: a capability can exist, remain undiscovered by the
active planner, be replaced by a weaker local implementation, or disappear at a
renderer seam. Placement is the clearest visible symptom because the active path
uses coarse rectangular evidence and does not recruit matte, facial semantics,
depth, or stable temporal negative space. Font selection has the same failure
shape: 577 fonts are classified in the role taxonomy, but the inspected runtime
manifest hydrates only 20 local assets, one of which is demo-restricted, while
the default MAUL path remains a six-font catalog.

This design creates the first complete, auditable vertical slice for 9:16
talking-head and reference-like short-form composition. It makes renderer or
wiring failures observable and separately measurable from artistic quality.
Its first research milestone is deliberately narrower than "make cinematic
videos": prove that MAUL can detect one rendered mistake, produce one controlled
repair, prove what changed, capture whether reviewers preferred it, and reuse
that evidence on a held-out comparable scene.

## Scope

### First 24-hour objective

Produce a representative, end-to-end 9:16 composition path that:

1. emits a capability coverage report proving which existing systems, policies,
   assets, adapters, datasets, tests, and render features were considered;
2. accepts an approved reference-derived brief and a temporally analyzed source
   scene;
3. preserves at least two evidence-backed Semantic Typography Tree hypotheses
   until a Treatment Genome selects one;
4. produces a baseline and one semantic-hierarchy repair while freezing unrelated
   dimensions and recomputing the complete Repair Dependency Closure;
5. freezes each selected realization as a Declared Composition, realizes it
   through one canonical render manifest and one Remotion execution path, and
   retains actual frame samples;
6. independently derives an Observed Composition from those frames and runtime
   receipts rather than copying manifest or renderer claims;
7. emits a structured Fidelity Report proving whether fonts, shaped bounds,
   placement, depth, treatment, and motion reached pixels;
8. captures a randomized, blinded same-scene A/B/tie review with per-candidate
   failure dimensions and reviewer confidence; and
9. records the result as experiment-only evidence, then runs a retrieval-enabled
   versus retrieval-disabled comparison on a held-out comparable scene under the same seed,
   candidate budget, renderer, and review protocol.

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
- Learned creative-state embeddings before sufficient independent reviewed
  Declared/Observed/Preference/Mutation/Outcome records exist.
- Treating renderer telemetry as independent observation, or treating one
  aggregate fidelity percentage as permission to hide a categorical mismatch.
- Treating one successful local repair as evidence of transferable learning.
- Scanning a production source checkout on every render. Repository discovery is
  a build/CI concern; runtime selection consumes a versioned registry and checks
  live provider/asset availability.
- Maximizing the number of capabilities used. Premium restraint can require one
  excellent treatment instead of many mediocre effects.

## Optimization Objectives

MAUL has two related but distinct objectives:

1. **Engineering orchestration objective:** before new implementation is
   authorized, discover and evaluate every existing capability that can satisfy
   the required contract. Prefer adaptation when it meets the same quality,
   evidence, and production constraints. Record why every plausible capability
   was selected, rejected, unavailable, or superseded.
2. **Creative objective:** maximize a vector of readability, hierarchy,
   semantic emphasis, visual balance, reference-grammar adherence, negative-space
   use, motion coherence, temporal stability, originality, editorial rhythm, and
   reviewer preference, subject to scene, mask, brand, grammar, accessibility,
   timing, rights, and renderer constraints.

The first objective prevents duplicate or forgotten systems. It must not be
misread as "use as many capabilities as possible," which would reward visual
noise. The second is a constrained multi-objective search, not proof that
aesthetic quality is mathematically objective. Hard constraints eliminate
invalid candidates; score vectors and Pareto/weighted ranking prioritize valid
candidates; held-out human preference validates whether the chosen weights
track the intended quality class.

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
| Local repair | A declared baseline and dependency-closed mutation on the same scene, independently observed and blindly compared | The bounded repair improved this case under this protocol. |
| Transferable learning | Evidence-retrieval-enabled versus retrieval-disabled ablation on held-out source groups with identical seed, budget, renderer, and reviewer pool | Retrieved evidence improved comparable unseen cases under this protocol. |
| General Q1/Yuan-class quality | Held-out source-level review across representative strata with confidence intervals | The result supports a bounded style-class claim. |

No fixed confidence percentage is a measured result for comparative quality,
local repair, transferable learning, or general Q1/Yuan-class quality until the
corresponding row has real review evidence. Earlier 70-85% architecture estimates
are engineering priors about plausibility, not product-quality facts. The
dashboard must show the claim, independent source count, reviewer count,
reviewer agreement, stratification, confidence interval, and exclusions beside
every score.

## Core Architectural Principle

Every visible creative decision must be traceable backwards to evidence and
forwards to render proof:

```text
Repository declarations + catalogs + adapters + tests + datasets
                              |
                              v
               Capability Indexer (build/CI)
                              |
                              v
            Capability Registry + Capability Graph
                              |
                              v
Reference Corpus -> Reference Analysis -> Reference Grammar
                                               |
Transcript -> Semantic Typography Tree         |
                    |                          |
Composition Brief + Observation Model -> Scene Representation
                                               |
                                               v
             Capability Demand -> Capability Resolver
                              |                |
                              |                v
                              +-> Capability Coverage Plan
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
                                  Declared Composition (frozen truth)
                                               |
                                               v
                                  Capability Verification
                                               |
                                               v
                                  UnifiedRenderManifest / compiler
                                               |
                                               v
                                  Canonical Remotion Renderer
                                               |
                                               v
                         Independent Render Observation
                                               |
                                               v
                                  Observed Composition (pixel truth)
                                               |
                          +--------------------+---------------------+
                          v                                          v
              Structured Fidelity Report                      Visual Evidence
                          |                                          |
                          +--------------------+---------------------+
                                               v
                                       Evaluation Report
                                               |
                      weakest-dimension diagnosis + dependency closure
                                               |
                             bounded repair or convergence stop
                                               |
                                               v
                 Blinded A/B/tie Review -> Reviewed Composition Evidence
                                               |
                                               v
                   Held-out retrieval-enabled vs retrieval-disabled ablation
                                               |
                                               v
                 Knowledge Extraction -> eligible Pattern Memory promotion
```

An append-only **Decision Ledger** is emitted beside every transition. Artifacts
answer what was produced; ledger entries answer why it was produced, rejected,
or degraded. Every artifact includes an ID, parent IDs, schema version, content
hash, policy/model/configuration versions, timestamps, and status:
`verified`, `degraded`, `blocked`, or `fallback`.

Downstream stages can reject or request a bounded revision of an upstream
proposal. They cannot silently substitute a creative decision. This prohibition
is the mechanism that turns wiring defects into named, testable failures.

The capability path and creative path are related but separate. A capability
can be discovered yet ineligible for a job because its binary, provider,
evidence, format support, rights state, or renderer adapter is unavailable.
Conversely, a runtime component cannot claim a capability merely because a file
or planned registry entry exists. The registry records what is declared;
Capability Verification records what can execute now; the Fidelity Report records
what actually reached pixels.

The creative path also separates proposal, declaration, and observation. A
Composition Candidate and Visual Realization remain mutable search artifacts. A
selected realization is frozen as a Declared Composition before compilation.
The UnifiedRenderManifest is transport for that declaration, not a second source
of creative truth. After rendering, an independent observation module produces
the Observed Composition. Neither the renderer nor the manifest compiler may
populate observed values by echoing requested values.

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

### Capability Definition

A Capability Definition makes an existing implementation addressable without
requiring a planner to rediscover source files. It records:

- stable capability ID, domain, version, owner module, and implementation entry
  point;
- input/output contract IDs and graph compatibility edges;
- status: `planned`, `implemented`, `verified`, `degraded`, `disabled`, or
  `unavailable`;
- scene, format, evidence, rights, provider, asset, and renderer preconditions;
- supported editorial roles and declared limitations;
- deterministic cost/latency class and concurrency constraints;
- adapter and manifest field coverage;
- executable contract-test IDs and last verified revision; and
- replacement/deprecation links where overlapping implementations exist.

A source file, documentation paragraph, prompt, or registry row is not enough to
earn `verified`. For example, the existing motion primitive registry contains
entries whose source kind is `html-prototype-placeholder` and status is
`planned`; those must remain discoverable but cannot satisfy a runtime demand.

### Capability Registry and Capability Graph

The Capability Indexer runs during development and CI. It combines explicit
registrations with generated inventories for typography engines, SVG treatment
programs, animation/motion registries, placement and scene-analysis providers,
Joseph adapters, render adapters, policies, prompts, datasets, references,
fixtures, and contract tests. Repository scanning can propose unregistered
capabilities, but an owner must provide a definition and contract evidence before
the capability becomes runtime-eligible.

The versioned Capability Registry is the inventory. The Capability Graph links
definitions only through compatible input/output contracts and adapter edges. It
does not infer executability from filename similarity. CI fails on dangling
verified entries, duplicate authority for the same contract without an explicit
selection policy, renderer fields with no adapter, or implemented modules absent
from the registry.

The current repository already contains partial source catalogs that should feed
the indexer rather than be rewritten: `MAUL_TREATMENT_CATALOG`, the SVG
typography program registry, the motion primitive/composite registry, animation
retrieval, the hydrated font manifest and role taxonomy, Joseph's manifest
compiler and seam inventory, render adapters, evidence preservation, fixtures,
and focused tests. Their current schemas and truth standards differ, which is
why a normalized registry is required.

Capabilities are grouped into bounded ownership domains rather than treated as
an undifferentiated list of files:

| Domain | Owns | Must not own |
| --- | --- | --- |
| Reference Grammar | reference observations, distributions, exemplars, provenance | scene facts or renderer code |
| Semantic Emphasis | rhetorical roles, phrase/token salience evidence | font or coordinate selection |
| Scene Analysis | masks, landmarks, depth, saliency, contrast, trajectories | editorial treatment choice |
| Typography | font assets/metrics/evidence, pairing, shaping, hierarchy realization | scene segmentation or final render authority |
| Composition | candidate intent, balance, placement/depth policy, constraint propagation | hidden renderer fallback |
| Motion | primitive capability, timing/curve realization, motion envelopes | transcript truth or layout invention |
| Manifest Compiler | deterministic realization-to-manifest translation | creative selection |
| Renderer | deterministic frame execution and runtime diagnostics | font, placement, or treatment substitution |
| Evaluation | constraint, fidelity, perceptual, editorial, and convergence diagnosis | source mutation or unrecorded repair |

The planner is a coordinator across these domains. It requests capabilities and
selects among eligible proposals; it does not reimplement a domain's internal
responsibility. Domain ownership can be mapped onto existing modules without
creating literal service boundaries or distributed "department" processes.

### Capability Demand, Coverage Plan, and Resolver

Each Composition Brief and Scene Representation produce a Capability Demand:
required and optional contracts, editorial roles, scene preconditions, format,
quality floor, evidence requirements, and cost budget. The runtime Capability
Resolver queries the immutable registry, then checks live provider health,
actual asset materialization, licence state, adapter support, and renderer
support. It returns a Capability Coverage Plan containing:

- every requested capability contract;
- all plausible providers found;
- the selected provider and adaptation path;
- ignored or rejected providers with structured reasons;
- genuinely missing contracts with gap evidence; and
- any permitted degraded behavior and its claim restrictions.

Candidate generation cannot begin with an unresolved required capability. A new
provider can be proposed only when the coverage record proves that existing
providers were searched, inspected, tested for contract adaptation, and rejected
for a documented reason. This is a development-governance rule as well as a
planner gate; it prevents "new" implementations from bypassing working modules.

### Planning Preflight and Skill Activation

Agent skills are development-time tools, not production video capabilities. At
the start of an implementation-planning session, a Planning Preflight records
the installed skills visible in that execution environment, ranks their
relevance, activates the required subset, and explains why a plausibly relevant
skill was not used. A skill enters the production Capability Registry only if it
exposes a stable production interface with tests and deployment ownership. This
keeps planning assistance auditable without coupling MAUL jobs to a particular
agent installation.

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
For typography references, the minimum measurable feature set is text occupancy
as a percentage of frame, dominant visual axis, text-to-subject relationship,
hierarchy depth and scale ratios, font-role distribution, line-break pattern,
edge proximity, overlap/depth strategy, negative-space utilization, treatment
density, visual rhythm, and motion intent measured from adjacent frames or video.
Composition-family matching operates on these observations and uncertainty,
not on an instruction to imitate a screenshot.

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

### Semantic Typography Tree

The Semantic Typography Tree is the language-to-hierarchy artifact consumed by
composition search. It preserves phrase and token roles such as `hero`,
`support`, `accent`, and `tail`, with rhetorical evidence, acoustic evidence,
transcript confidence, local context, source spans, and an explicit confidence
for each assignment. It does not select a font, line break, coordinate, effect,
or renderer primitive.

Ambiguous language produces competing tree hypotheses instead of false certainty.
For example, `CINEMATIC` may be a hero token while `STRONG CINEMATIC` remains an
eligible hero phrase. Candidate generation may test both under the same scene and
budget. The Decision Ledger records which tree a Treatment Genome selected and
why. No heuristic may silently collapse the tree to "last emphasized token."

### Composition Candidate

A Composition Candidate is a scene-specific intent hypothesis, not renderer
coordinates. It contains a composition family, hierarchy intent, placement mode,
depth/overlap intent, typography intent, treatment intent, motion intent, and
constraints inherited from the brief and scene. It is deliberately independent
of a particular font or SVG implementation.

Semantic hierarchy is driven by **Semantic Salience Evidence**, not a hardcoded
word-position rule or one unexplained scalar. Each token/phrase can carry
source-grounded semantic importance, rhetorical role, acoustic emphasis,
transcript confidence, timing/cadence, novelty in local context, and user/brand
priority. A calibrated aggregate may nominate a hero phrase, but scene fit,
readability, phrase geometry, and editorial rhythm can override raw salience.
The Decision Ledger records both the source dimensions and the final hierarchy
assignment. A high semantic score therefore influences, but does not mechanically
force, the largest font size.

The existing domain meaning of **Treatment Genome** is retained: it is a complete
editorial treatment candidate, not a list of visual effects. Editorial directions
such as luxury, documentary, minimal expert, premium direct response, sports, or
high fashion belong in doctrine/treatment intent and constrain typography,
spacing, contrast, depth, motion, and primitive eligibility. Gradient, stroke,
shadow, glow, blur, mask, and wipe are render primitives used to realize that
intent. The existing `MAUL_TREATMENT_CATALOG` already models several high-level
editorial treatments; the Composition Engine must recruit and extend that
authority instead of introducing a second style-label system.

### Visual Realization

A Visual Realization makes a candidate executable: exact verified font assets
and role assignment, shaped text measurements, line breaks, font sizes/axes,
coordinates, anchors, colors, gradients, strokes, shadows, masks, z-order,
animation curves, timing, and renderer parameters. A candidate can produce
multiple realizations. Realization must preserve the candidate's intent or
return a diagnostic stating which constraint prevented it.

### Declared Composition

The Declared Composition is the immutable selected Visual Realization: the exact
creative hypothesis MAUL claims it will render. It records the selected Semantic
Typography Tree, verified font asset IDs and hashes, shaped glyph geometry, line
breaks, placement and overlap topology, z-order and masks, treatment primitives,
motion trajectories, expected sampled-frame measurements, source Candidate and
Realization IDs, and all policy/model/configuration versions.

Freezing occurs before manifest compilation. The Manifest Compiler can translate
the declaration but cannot revise it. Any unsupported or changed field blocks or
creates a new Declared Composition with explicit lineage; it cannot be silently
substituted in the manifest or renderer.

### Capability Verification

Immediately before manifest compilation, Capability Verification resolves every
realization dependency against current runtime truth: asset hash and local/remote
availability, provider health, required scene evidence, adapter capability,
manifest field support, renderer implementation, and executable contract-test
version. It emits `verified`, `degraded`, or `blocked` per dependency. A
discovered but planned capability cannot pass this gate. A capability whose
runtime state changed after candidate generation sends a dimension-specific
failure back to the resolver rather than allowing the renderer to improvise.

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
the Decision Ledger and Fidelity Report. Silent default substitutions are
prohibited.

### Observed Composition and Composition Fingerprints

The Observed Composition is the physical reality measured after canonical
rendering. An observation module independent from candidate generation and
manifest compilation derives it from retained frame pixels, browser/canvas
measurements, font-load receipts, and renderer/runtime diagnostics. Each value
records its evidence source and confidence. Runtime telemetry can corroborate an
observation but cannot certify its own requested output.

Observed fields include actual loaded font identity, glyph and layer bounds,
line breaks, z-order/mask evidence, subject/text intersections, contrast,
rendered treatment visibility, frame-to-frame trajectories, motion distance, and
temporal stability. Missing evidence remains `unobserved`; it is never filled
from the Declared Composition.

A Composition Fingerprint is a versioned projection of one composition used for
comparison and retrieval. Declared and observed fingerprints use the same
dimension names where possible but remain distinct and carry `declared` or
`observed` provenance per value. A fingerprint is neither a beauty score nor the
existing Pattern Memory snapshot hash.

### Fidelity Report

The Fidelity Report proves execution correctness by comparing the Declared
Composition with the Observed Composition independently of aesthetics. Its
primary output is a structured diff: missing font or hash, line-break mismatch,
glyph-bound delta, placement delta, mask/z-order mismatch, absent treatment,
trajectory delta, timing delta, and unobserved required field. Categorical hard
failures remain visible even if optional scalar summaries are also emitted; one
average score cannot hide an eye collision or wrong font.

The report also records the declaration, manifest, output, frame, observer,
renderer, and font hashes plus explicit fallback state. Tests must prove each
claimed declaration field has a visible or independently measurable effect. A
change that only updates a TypeScript object or renderer-authored receipt is not
fidelity proof.

### Visual Evidence and Evaluation Report

Visual Evidence records what is visible in the result: readable area, critical
and protected-region occlusion, contrast, line-break quality, hierarchy,
placement stability, visual clutter, motion stability, style-grammar relation,
and sequence consistency. The Evaluation Report consumes that evidence in
stages, retains score components and reasons, and returns diagnoses that can
target a search dimension rather than discard an entire candidate blindly.

Visual evaluation consumes Observed Composition and Visual Evidence. It may use
the Declared Composition to diagnose causality, but it may not score intended
values as if they were visible. Fidelity failures are repaired before aesthetic
evidence enters preference learning; otherwise the system would learn that a
good declaration caused pixels the renderer never produced.

### Decision Ledger, Knowledge Extraction, and Pattern Memory

Ledger entries contain input artifact IDs, action, output artifact IDs, policy or
model version, evidence IDs, scores, comparison set, decision reason, and
fallback/degraded state. Example: reject a realization because a primary gesture
mask at 0.96 confidence is occluded by 41% under `OverlapPolicy v3.2`.

Human review does not automatically alter future policy. The first review
artifact is **Reviewed Composition Evidence**: it retains randomized A/B/tie
assignment, candidate-independent failure labels, reviewer confidence, source
group, declared and observed fingerprints, and mutation lineage. Knowledge
Extraction clusters reviewed results, checks repeatability and reviewer
agreement, and records a bounded finding with provenance.

The existing reusable `backend/src/pattern-memory` store is the Pattern Memory
promotion authority for this experiment because it already preserves context,
outcome, human approval, and before/after fingerprints. The MAUL-specific
`backend/src/maul/learning.ts` treatment aggregate remains a compatibility
capture adapter until its evidence model and consumers are migrated; it is not a
second Pattern Memory authority. A job that retrieves Pattern Memory must copy
the selected entry, snapshot hash, and reason into its own Decision Ledger.

Only validated findings may be promoted into Pattern Memory or the Typography
Knowledge Base. One local success is evidence, not a reusable rule. Promotion
requires repeated comparable observations, explicit reviewer agreement and
confidence, no unresolved fidelity failure, and a source-grouped provenance
record. This prevents isolated preference noise from becoming a permanent rule.

### Composition Experiment Runner

The Composition Experiment Runner is the first causal vertical slice and the
only new coordinating authority authorized by this specification. It runs a
named 9:16 fixture through existing Adapters in this order:

```text
named scene
  -> baseline Semantic Typography Tree
  -> baseline Visual Realization
  -> Declared Composition
  -> canonical render
  -> independent Observed Composition + Fidelity Report
  -> semantic-hierarchy mutation
  -> Repair Dependency Closure
  -> repaired Declared Composition and canonical render
  -> independent observation
  -> blinded A/B/tie review
  -> Reviewed Composition Evidence
  -> experiment-only evidence retrieval on held-out scene
  -> Knowledge Extraction and eligible Pattern Memory promotion
```

The Runner does not become a second Top-Level Planner, renderer, evaluator, or
memory store. Its Interface coordinates causal IDs, fixed seed and budget,
baseline/mutation lineage, frozen dimensions, observed evidence, review state,
and held-out ablation metadata. Existing Modules remain authoritative for their
domains and are used through Adapters where a real variation exists.

The held-out ablation may retrieve raw Scene A evidence only under an explicit
`experiment_only` eligibility state. That evidence cannot influence ordinary
production planning or masquerade as promoted Pattern Memory. Knowledge
Extraction considers promotion only after the held-out result joins sufficient
source-grouped repetitions under the promotion policy.

### Preference leakage controls

Preference inference receives two unordered candidate feature bundles, their
scene context, intent, and observed fingerprints. It does not receive winner or
loser IDs, verdicts, failure labels, review order, or any field derived from the
ground-truth decision. The evaluator joins its prediction to the withheld review
label only after inference.

The review protocol supports `A`, `B`, and `no_meaningful_preference`, randomizes
left/right presentation, and records reviewer confidence. Failure dimensions are
assigned independently to each candidate. A regression test must prove that
swapping presentation order preserves the prediction and that unseen failure
labels cannot make a model appear correct through a labeled-winner fallback.
The first slice does not need to train an automated preference predictor; it must
establish this leakage-safe feature/ground-truth split so human evidence and any
later predictor use the same trustworthy seam.

### Creative Justification

Creative Justification is a human-readable, structured projection of the
Composition Candidate, Visual Realization, Declared Composition, Observed
Composition, Capability Coverage Plan, Evaluation Report, and Decision Ledger.
It is not free-form reasoning and cannot create a
new fact. For every visible decision it names the selected value, influencing
evidence, policy/grammar record, alternatives considered, constraint trade-off,
and confidence. Example: a hero scale is attributed to semantic-salience
dimensions and hierarchy policy; torso overlap is attributed to a flexible mask
with temporal stability; an italic accent is attributed to the selected
treatment intent and Pair Evidence; a gradient is attributed to an approved
primitive and measured contrast need. If that chain is absent, the decision is
ineligible for promotion.

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
4. Fidelity Report checks on canonical frames;
5. perceptual/style-grammar evaluation;
6. human pairwise editorial ranking where required;
7. sequence-level consistency for multi-moment outputs.

An Evaluation Report returns dimension-level feedback such as `placement_failed`,
`hierarchy_weak`, `font_pair_low_evidence`, `motion_unstable`, or
`render_fidelity_failed`. The Candidate Generator uses only permitted feedback to
resample the affected dimensions. It cannot mutate protected source facts or
erase a negative report.

The **Creative Convergence Loop** preserves dimensions that already pass their
quality and confidence floors, identifies the weakest mutable dimension, and
computes the Repair Dependency Closure before mutation. It resamples the target
dimension and every transitively invalidated dimension while freezing unrelated
ones. For example, a font or hierarchy mutation invalidates shaping, line breaks,
glyph bounds, collision checks, and balance; placement remains frozen only if the
recomputed geometry still satisfies its constraints. Weak motion may change
timing and curves while preserving typography but must revalidate temporal
collision and contrast. Every iteration records parent realization, dependency
graph version, frozen and recomputed dimensions, diagnosis, score-vector delta,
render cost, and whether a previously passing dimension regressed.

Convergence stops when one of these conditions is met: all required floors pass
and no Pareto-improving candidate is found; the configured iteration/render-cost
budget is exhausted; the same diagnosis repeats without material improvement;
a required capability becomes unavailable; or human review is required. The
system returns the best eligible realization plus unresolved weaknesses. It may
not hide non-convergence behind the highest aggregate score.

Render repair is narrower than creative convergence. After canonical rendering,
a requested-versus-observed diff classifies missing fonts, transforms, masks,
layers, effects, timing, or bounds as fidelity failures. The repair loop may
retry materialization, adapter compilation, or renderer execution without
changing creative intent. If creative fields must change, the result returns to
candidate evaluation as a new realization instead of being silently patched in
the renderer.

### Minimal repair and transfer experiment

The first experiment has two source-group-separated parts:

1. **Local repair:** on Scene A, render a baseline Declared Composition, derive
   its Observed Composition, diagnose `hierarchy_weak`, mutate only semantic
   hierarchy plus its Repair Dependency Closure, render again, and collect a
   blinded A/B/tie judgment.
2. **Held-out reuse:** on comparable Scene B, run one retrieval-disabled and one
   retrieval-enabled planning condition with the same source inputs, seed,
   candidate and render budgets, renderer and observer versions, and review
   protocol. The retrieval-enabled condition may retrieve Scene A evidence in
   `experiment_only` state but cannot change any other experimental variable.

Local repair proves only that one controlled intervention improved Scene A.
Transferable learning requires the retrieval-enabled condition to improve held-out
preference across source-grouped repetitions. One Scene B win is retained as
evidence but cannot be promoted as a general rule. The experiment report includes
all candidates, retrieval traces, declared/observed fingerprints, fidelity
status, review labels, ties, confidence, and exclusions.

## Canonical Render and Failure Accountability

The first vertical slice has one canonical creative route. The current fixed SVG
programs and cinematic treatments can remain as realization adapters, but no
parallel path may override their parameters or bypass a selected treatment. The
current condition that causes a cinematic SVG branch to run only when
`creativeTreatment` is absent must be replaced by an explicit manifest-selected
adapter policy with fidelity tests.

Every presentation decision must have all six links:

```text
candidate intent
  -> realization value
  -> frozen Declared Composition
  -> manifest value
  -> independently measured Observed Composition
  -> Fidelity Report diff
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

1. A versioned Capability Registry and per-case Capability Coverage Plan list
   existing typography, SVG, animation, placement, Joseph-transfer, scene,
   font, renderer, policy, prompt, dataset, reference, fixture, and test
   capabilities, with a structured reason for every plausible capability not
   selected.
2. A matted full-frame talking-head Scene A and source-group-separated comparable
   Scene B both have a complete artifact chain and Decision Ledger.
3. The Scene A transcript produces at least two Semantic Typography Tree
   hypotheses with evidence and confidence; the selected tree survives into the
   Declared Composition.
4. Scene A produces a baseline and one semantic-hierarchy repair. The repair
   records its dependency closure, preserves unrelated dimensions, and generates
   a new declaration instead of mutating render output in place.
5. Every baseline, repair, retrieval-disabled, and retrieval-enabled render has an
   independently derived Observed Composition. Arbitrary mocked frame bytes or
   renderer-authored receipts cannot satisfy this gate.
6. Each presentation field used by a result has pre-render capability
   verification and a structured Fidelity Report covering font, line breaks,
   glyph bounds, placement, depth/mask state, treatment, and motion. No hard
   mismatch is hidden by an aggregate score.
7. The full-frame talking-head output either uses a valid controlled-overlap or
   returns an explainable `no-safe-realization` result. It may not pretend that a
   coarse rectangle is safe.
8. Scene A review is randomized and blinded, supports A/B/tie, and records
   candidate-independent failure dimensions and reviewer confidence. Preference
   inference receives no winner metadata or post-review failure labels.
9. Raw review evidence is preserved separately from promoted Pattern Memory.
   Promotion is blocked for unresolved fidelity failures and isolated outcomes.
10. Scene B runs retrieval-disabled and retrieval-enabled conditions with identical
    seed, candidate budget, render budget, renderer, observer, and review protocol;
    retrieval and any resulting decision delta are fully traceable.
11. The report clearly separates local repair, held-out reuse, fidelity success,
    visual-quality result, and the next limiting module. It makes no transfer or
    Q1/Yuan parity claim from one held-out comparison.

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
- include a tie/no-meaningful-preference outcome and randomize presentation side;
- keep inference inputs free of winner identity, verdict-derived fields, and
  post-review failure labels, joining ground truth only after prediction;
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

### Workstream 0: Capability discovery and baseline harness

Inventory current capability sources, normalize them into a generated registry,
build contract-based graph edges, and emit a coverage report for the first
vertical-slice demand. The indexer must distinguish planned placeholders,
implemented modules, runtime-verified providers, hydrated assets, and renderer-
proven features. Freeze current focused tests, deterministic source fixtures,
exact versions, and baseline renders. Add the matted-head and open-background
cases as named, replayable acceptance fixtures. Establish a single command that
emits the capability report, full artifact chain, and human-inspectable trace for
one case.

### Workstream 1: Semantic hierarchy and declared/observed artifacts

Define versioned shared contracts for Reference Analysis/Grammar, Composition
Brief, Observation Model, Scene Representation, Semantic Typography Tree,
Composition Candidate, Visual Realization, Declared Composition, Observed
Composition, Composition Fingerprint, Fidelity Report, visual evidence,
evaluation report, and ledger entries, plus Capability Definition, Demand,
Coverage Plan, Verification, and Creative Justification. Add validation and
fixture builders. Update domain documentation so language-to-hierarchy evidence,
declared intent, observed reality, and render evidence have one vocabulary. This
workstream is complete only when every edge rejects missing provenance or a
silent fallback.

### Workstream 2: Canonical manifest and renderer fidelity

Make the compiler the sole creative handoff to `UnifiedRenderManifest`. Convert
existing text layers, SVG programs, and cinematic treatments into explicit
realization adapters. Eliminate the known creative-treatment SVG bypass and add
field-to-pixel contract tests. This is the workstream that prevents a good plan
from disappearing during render.

### Workstream 3: Composition Experiment Runner and reviewed evidence

Build the first Composition Experiment Runner over one mutation dimension:
semantic hierarchy. Add independent frame/runtime observation, structured
Declared-versus-Observed Fidelity Report generation, randomized blinded A/B/tie
review, leakage-safe preference inference inputs, dependency-closed mutation,
raw Reviewed Composition Evidence, and validated promotion into the existing
Pattern Memory authority. Add the Scene A local-repair and Scene B held-out
retrieval-ablation fixtures before broadening the search space. Scene A evidence
is `experiment_only` until promotion criteria pass. No learned embedding
or population optimizer is part of this workstream.

### Workstream 4: Font Asset Registry and Typography Knowledge Base

Inventory all configured production font assets, prove loading/measurement, and
expose exclusions. Split intrinsic metrics, expert priors, typography evidence,
and pair evidence. Migrate current default font systems into low-weight priors.
Implement deterministic exact phrase shaping and role-aware pair-search input.

### Workstream 5: Temporal scene topology and controlled overlap

Replace the rectangle-only decision surface with a temporal observation/scene
representation. Add semantic masks, confidence, stability, depth capability,
and glyph-level intersection APIs. Implement hard critical-region constraints
and bounded flexible-region overlap/depth modes.

### Workstream 6: 9:16 composition grammar and realization adapters

Encode reference-derived, parameterized composition families for phrase geometry
and editorial intent. Make the current 12 SVG programs reusable treatment/motion
adapters rather than fixed placements. Each adapter declares capabilities,
required evidence, and how it maps every realization parameter to render fields.

### Workstream 7: Hierarchical search and diagnostic evaluation

Implement candidate generation, staged pruning, configured budgets, progressive
rendering, weakest-dimension convergence, requested-versus-observed fidelity
repair, Creative Justification, evaluation feedback, and detailed Decision
Ledger entries. The first evaluation provider can be deterministic and
rubric-based; art-direction claims remain blocked until a configured perceptual
provider and human review evidence exist.

### Workstream 8: Corpus operations, review, and confidence dashboard

Build reference-analysis records, grammar provenance, Typography Evaluation
Corpus records, blinded pairwise review surfaces, knowledge extraction rules,
and source-level confidence reporting. No learned score is promoted without a
defined dataset, reviewer protocol, and leakage control.

### Workstream 9: Landscape transfer

After the vertical slice passes its gates, add a landscape scene adapter and
renderer adapter that consume the same brief, candidate, realization, manifest,
evidence, and ledger contracts. Only format-specific grammar and render
capabilities may differ. Joseph does not receive a separate untraceable creative
authority.

Workstreams 0-3 are prerequisites for any learning or quality claim.
Workstreams 4-7 broaden the first usable vertical slice. Workstream 8 turns an
engineering result into a confidence-backed product claim. Workstream 9 is
intentionally delayed.

## Testing Strategy

Each workstream uses test-first development with these proof levels:

1. **Capability registry tests:** the indexer distinguishes planned from verified
   implementations, detects duplicate authority and dangling adapters, records
   all known source catalogs, and rejects a verified entry without executable
   contract evidence.
2. **Contract tests:** schemas reject absent parent/evidence IDs, invalid status
   transitions, unverified fonts, unresolved capability demand, and silent
   fallback fields.
3. **Deterministic unit tests:** font eligibility, phrase shaping, overlap
   classification, temporal stability, grammar selection, realization mapping,
   capability resolution, evaluation diagnosis, convergence freezing, and repair
   classification.
4. **Property tests:** no candidate marked eligible intersects a critical mask;
   unsupported adapter capabilities cannot become verified manifest fields;
   a renderer cannot receive a font asset absent from the registry; and a repair
   cannot modify a frozen creative dimension.
5. **Integration tests:** a fixed fixture flows from capability demand and
   brief/observations through candidate search to capability verification, a
   canonical manifest, independent Observed Composition, Fidelity Report, visual
   evidence, justification, and ledger.
6. **Observation and fidelity tests:** sampled frames and runtime receipts verify
   text bounds, font-loading signature, mask/depth application, line breaks,
   transform position, and treatment visibility. The observer must leave required
   values `unobserved` when proof is absent, and arbitrary frame bytes cannot
   satisfy a fidelity pass. These tests deliberately detect the known problem
   where a selected treatment is bypassed at render time.
7. **Preference leakage tests:** inference accepts unordered candidate features
   and scene context but no winner ID, verdict, or post-review failure label;
   swapping A/B presentation preserves predictions; unseen labels cannot produce
   a correct result by defaulting to a labeled winner; ties remain ties.
8. **Repair and transfer tests:** a hierarchy mutation recomputes its dependency
   closure, preserves unrelated dimensions, records before/after fingerprints,
   and renders a new declaration. A held-out fixture proves retrieval-enabled and
   retrieval-disabled runs use equal seed/budget/provider versions and differ only
   by the permitted retrieval evidence.
9. **Acceptance/review tests:** named matted-head and open-background fixtures
   produce multiple candidates, explain all pruning, distinguish a graceful
   no-safe-realization outcome from a placement error, and retain raw review
   evidence separately from promoted Pattern Memory.

Visual snapshots are supporting evidence, not the sole assertion. Assertions
must use named geometry, font, mask, and manifest evidence so a minor raster
difference does not hide a semantic regression.

## Risks and Required Responses

| Risk | Required response |
| --- | --- |
| Repository scan finds files but cannot prove behavior | Keep entries `planned` or `implemented`; require contracts, runtime checks, and render evidence before `verified`. |
| Capability graph maximizes reuse count instead of output fitness | Select the smallest capable provider set that maximizes the creative objective and quality floor. |
| Duplicate systems claim the same authority | Require an explicit owner, selection policy, adapter/deprecation relation, and CI failure until resolved. |
| Font inventory is large but retrieval/loading is incomplete | Report eligibility and exclusion reason; do not call unavailable fonts searchable. |
| A rich font is technically valid but performs poorly in a role | Keep it eligible, let Pair Evidence and review lower its empirical weight. |
| Segmentation/landmark confidence is poor | Mark scene evidence degraded; restrict behind-subject/overlap modes and explain the conservative result. |
| No stable placement exists for a full-frame subject | Return `no-safe-realization` with evidence or use only explicitly permitted controlled overlap; never fabricate safe space. |
| Candidate count creates unacceptable render cost | Use analytical and low-cost raster pruning, record prune loss, and increase budgets only when evidence justifies it. |
| Evaluation rewards a hack or reference imitation | Require originality constraints, held-out sources, human review, and failure-taxonomy audit. |
| A renderer path silently changes output | Fail Fidelity Report tests and block reference-quality claims until the field-to-pixel trace is restored. |
| Observer copies manifest or renderer self-report | Require independent frame/runtime measurement, per-field provenance, and `unobserved` values when proof is absent. |
| Fidelity scalar hides a categorical mismatch | Rank structured hard failures before optional scalar summaries; block on critical mismatches. |
| Semantic tree overcommits to one interpretation | Preserve competing hierarchy hypotheses with confidence until candidate selection. |
| Repair changes coupled dimensions without accounting for them | Compute and record Repair Dependency Closure; freeze only dimensions outside the closure. |
| Pairwise review leaks labels into inference | Separate feature payload from withheld ground truth and test order swaps, ties, and unseen labels. |
| Pattern Memory overfits one successful repair | Require source-grouped repetition, reviewer agreement, and promotion provenance before reuse. |
| Few reference videos create false statistical confidence | Treat corpus as discovery evidence, expand independent sources, and label all confidence as bounded. |

## Definition of Done for the First Slice

The first slice is complete when a developer can select a named 9:16 fixture,
open one trace, and determine:

1. which existing capabilities were discovered, selected, adapted, rejected, or
   unavailable, and why no duplicate implementation was introduced;
2. which reference facts and grammar records influenced its composition;
3. which temporal scene evidence made each placement/overlap decision legal;
4. which Semantic Typography Tree hypotheses were considered, with evidence and
   confidence, and which one was selected;
5. which verified font assets and pair evidence were searched and why the winner
   was chosen;
6. how candidate intent became exact shaped geometry, style, depth, and motion;
7. what exact Declared Composition and manifest the renderer executed;
8. what independently measured Observed Composition reached pixels, including
   what remained unobserved;
9. whether the Fidelity Report found a categorical or measured mismatch;
10. whether the output failed capability verification, hard constraints, visual
    quality, or insufficient evidence;
11. which dimensions were frozen or recomputed during convergence, including the
    Repair Dependency Closure;
12. which blinded A/B/tie review evidence was captured without leakage;
13. whether any validated human feedback was promoted into reusable Pattern
    Memory; and
14. whether the held-out retrieval ablation supports transfer, without claiming
    Q1/Yuan style-class equivalence.

The system may then make a narrow, honest claim: it has a causally connected,
render-verified, scene-aware vertical typography path. It cannot claim Q1/Yuan
style-class equivalence until the held-out review protocol supports that claim.
