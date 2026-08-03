# Prometheus Creative Planning

This context covers how PROMETHEUS plans and governs editorial treatment choices across captions, motion, assets, and generated visuals. It exists to keep planning language precise as the intuition engine grows beyond the current deterministic judgment layer.

## Language

**Top-Level Planner**:
The module that chooses which treatment paths are worth exploring before governed execution.
_Avoid_: God mode, master critic, final editor

**Treatment Genome**:
A structured encoding of an editorial treatment candidate that can be mutated, crossed, scored, and replayed.
_Avoid_: random edit, final video, raw output

**Sequence Memory**:
Short-term memory of recent beat decisions used to enforce contrast, restraint, and anti-repetition inside the current run.
_Avoid_: long-term memory, archive, pattern history

**Pattern Memory**:
A reusable outcome ledger for known motion and layout patterns that records whether prior patterns succeeded, failed, or were deprecated.
_Avoid_: sequence memory, creator taste, archive

**Creator Taste Memory**:
Long-term preference memory that tracks which kinds of treatments a specific creator repeatedly prefers or rejects.
_Avoid_: sequence memory, one-run feedback

**Quality-Diversity Archive**:
An archive of diverse high-quality treatment genomes across chosen behavior dimensions rather than a single global winner.
_Avoid_: memory, cache, best candidate list

**Doctrine Branch**:
A bounded alternative editorial doctrine for a moment that the planner may explore alongside the primary doctrine.
_Avoid_: arbitrary doctrine mutation, full doctrine search

**Observation Snapshot**:
A deterministic artifact of scene facts, sequence facts, and production constraints that the planner is not allowed to rewrite.
_Avoid_: planner output, doctrine branch, candidate shortlist

**Planning Snapshot**:
An interpretive artifact built from the Observation Snapshot that defines doctrine branches, genome search space, and escalation intent.
_Avoid_: raw scene facts, final decision plan

**Adaptive Planning Horizon**:
A rolling lookahead window where the planner usually reasons 3 to 5 moments or about 5 to 10 seconds ahead, and only searches deeper for high-stakes beats.
_Avoid_: full-video search, one-beat-only planning

**Archive Dimensions**:
The initial behavior axes used by the Quality-Diversity Archive: intensity, visual density, motion energy, and editorial role.
_Avoid_: too many dimensions, style-first taxonomy, render-cost-first taxonomy

**Archive Entry**:
A reusable per-moment Treatment Genome stored in the Quality-Diversity Archive.
_Avoid_: full sequence path, final render track

**Evaluator Staging**:
The three-stage improvement path where the Judgment Layer is first exposed more clearly, then its rubric is sharpened, and only then are learned re-rankers added.
_Avoid_: one-shot evaluator rewrite, learning-first replacement

**Failure Taxonomy**:
The first named evaluator failure classes: boring-under-editing, chaotic-over-editing, cheap-template-motion, premium-restraint, repetition-fatigue, climax-overspend, weak-concept-reduction, asset-treatment-mismatch, sequence-rhythm-collapse, and readability-sacrifice.
_Avoid_: generic badness, unlabeled taste failure

**Review Surface**:
The lightweight preview-side human review workflow that captures pairwise winner choice, failure classes, sequence verdict, and an optional note.
_Avoid_: passive inference only, heavyweight annotation suite

**Short-Form Intelligence**:
The deterministic backend module that turns long-form material into ranked short-form candidates using semantic, acoustic, visual, and pacing signals.
_Avoid_: raw slicing, fixed-duration clipping, truth understanding engine

**Editorial Optimization Hierarchy**:
The ordered editorial objective for MAUL: retention and clarity first, conversion second, creator-brand consistency third, and novelty fourth.
_Avoid_: clickbait-first optimization, engagement certainty, novelty at any cost

**V1 Source Scope**:
The first MAUL release accepts one-principal-speaker talking-head or podcast footage, with optional B-roll.
_Avoid_: generic all-video support, multi-speaker panels, gameplay-first editing

**Upload Authority**:
The Next.js/Supabase boundary that authenticates, reserves, verifies, and commits a project source uploaded to R2.
_Avoid_: MAUL intake, browser authority, R2 event authority

**Canonical Source Asset**:
The Supabase `source_assets` record currently referenced by a project's `source_asset_id` after R2 identity and byte verification.
_Avoid_: upload intent, multipart upload, object event, local MAUL copy

**Source Analysis Job**:
The Supabase `durable_jobs` record keyed by a Canonical Source Asset ID that tracks materialization and progressive video analysis.
_Avoid_: fake processing job, upload progress, MAUL render job

**Source Fence**:
The rule that a Source Analysis Job may publish progress or completion only while its source asset remains the project's Canonical Source Asset.
_Avoid_: best-effort replacement check, filename comparison

**Protected Pause**:
A timed silence intentionally retained by the Editorial Timeline because it strengthens meaning, emotion, emphasis, or comprehension.
_Avoid_: dead air, automatic cut target, arbitrary slowdown

**Reference Trait Extraction**:
The conversion of a reference edit into abstract, governed editorial traits without reproducing its creator identity, assets, or exact treatment.
_Avoid_: imitation preset, copied template, named creator style

**Reference Corpus**:
A governed collection of supplied references, their rights status, extracted traits, and review state used to improve treatment policy and evaluation.
_Avoid_: template piracy, asset library, export source

**Aesthetic Soundness**:
The export-quality judgment that an edit has coherent treatment, readable captions, purposeful cuts, non-repetitive motion, credible sound, clean framing, and no obvious template artifact.
_Avoid_: mere technical validity, engagement certainty, subjective taste without rubric

**Governed CTA**:
A source- and brand-constrained call to action whose wording or animation MAUL may vary without inventing facts, offers, destinations, or endorsements.
_Avoid_: fabricated claim, unconstrained conversion tactic, source truth override

**Correlated Signal Stacking**:
The scoring stance for short-form ranking: RMS energy, transcript velocity, motion proxies, and semantic signals are treated as correlated heuristics, not ground truth.
_Avoid_: emotional truth modeling, engagement certainty

**Acoustic Fallback Segmentation**:
The transcript-failure mode that still emits ranked clip candidates from source duration and pacing proxies instead of blocking clip generation.
_Avoid_: transcript required, empty clip output

**Stepping-Stone Planner**:
The first shipped planner phase that uses bounded doctrine search, treatment genomes, a small QD archive, and beam search before AB-MCTS is introduced.
_Avoid_: all-at-once full planner stack, AB-MCTS-first rollout

**Treatment Genome v1**:
An extension of the existing per-moment candidate treatment shape that adds planner-native fields such as doctrine branch, retrieval intent, GOD escalation intent, and novelty/consistency bias.
_Avoid_: totally separate planner universe, final render track

**Retrieval Intent**:
The planner's per-genome instruction for whether to skip retrieval, reuse existing assets, reuse with variation, or search deeper before considering generation.
_Avoid_: fuzzy asset intent, implicit generation request

**GOD Escalation Intent**:
The planner's per-genome instruction for whether GOD is forbidden, allowed only if no fit exists, or preferred when higher precision is needed.
_Avoid_: immediate generation by default, merged retrieval-and-generation intent

**Sequence Objective**:
The first beam-search objective composed of sequence consequence, repetition avoidance, doctrine coherence, surprise preservation, climax budget preservation, and retrieval practicality.
_Avoid_: raw per-moment score only, sequence-blind optimization

**Planner Audit**:
A first-class planner trace artifact containing the observation snapshot, planning snapshot, doctrine branches, genome candidates, archive hits, beam expansions, selected path, and handoff shortlist.
_Avoid_: opaque planner choice, untraceable search

**Manifest Compiler**:
The deterministic handoff module that translates selected planner intent into the expanded `UnifiedRenderManifest` fields the renderer must honor.
_Avoid_: renderer fallback logic, ad hoc manifest mutation, hidden adapter

**Candidate Score Summary**:
The backend scoring summary for candidate genomes, expected cuts, governed prompt state, and sequence-memory signals.
_Avoid_: Planner Audit, full planner trace, render contract

**Render Contract Test**:
A test that proves a planner-selected manifest field produces observable renderer behavior or an explicit governed fallback.
_Avoid_: schema-only test, private implementation assertion

**Judgment Layer**:
The governed evaluation layer that scores, blocks, and approves planner candidates against editorial and production constraints.
_Avoid_: planner, generator, renderer

**GOD**:
Governed on-demand asset generation that produces or varies assets only when the current library cannot satisfy the chosen treatment cleanly.
_Avoid_: top-level planner, whole intuition engine

**Prompt Governance**:
The module that registers prompt text, fingerprints it, preserves allowed doctrine influence, and blocks prompt attempts to override locked infrastructure authority.
_Avoid_: prompt parser, user override, hidden architecture switch
## Relationships

- The **Top-Level Planner** explores one or more **Treatment Genomes**
- **Sequence Memory** governs repetition and contrast inside the current planning window
- **Pattern Memory** stores outcomes for reusable patterns across runs
- **Creator Taste Memory** stores creator-specific preference priors across runs
- The **Quality-Diversity Archive** stores strong **Treatment Genomes** across diverse behavior cells
- The **Observation Snapshot** provides the factual input to the **Planning Snapshot**
- The **Planning Snapshot** defines the search space for the **Top-Level Planner**
- The **Top-Level Planner** uses an **Adaptive Planning Horizon** rather than a fixed full-video search
- The **Quality-Diversity Archive** preserves strong **Treatment Genomes** across chosen **Archive Dimensions**
- An **Archive Entry** is a reusable per-moment **Treatment Genome**
- **Treatment Genome v1** extends the existing candidate-treatment shape rather than replacing it
- **Retrieval Intent** and **GOD Escalation Intent** are separate genome controls
- The planner uses a sequence-level **Sequence Objective** rather than only per-moment quality
- The planner emits a first-class **Planner Audit** for inspection and testing
- The **Manifest Compiler** translates selected planner intent into `UnifiedRenderManifest`
- The **Candidate Score Summary** records backend candidate scoring but is not the **Planner Audit**
- **Render Contract Tests** protect the handoff between `UnifiedRenderManifest` and renderer behavior
- **Evaluator Staging** improves the **Judgment Layer** in phases instead of replacing it outright
- The **Failure Taxonomy** gives the **Judgment Layer** named editorial failure classes to detect and learn from
- The **Review Surface** is the primary source of evaluator truth labels
- **Short-Form Intelligence** ranks clip candidates through **Correlated Signal Stacking**
- The **Upload Authority** commits exactly one **Canonical Source Asset** pointer per project
- A video **Canonical Source Asset** creates at most one active **Source Analysis Job** with the same UUID
- Every **Source Analysis Job** must pass the **Source Fence** before publishing progress or completion
- MAUL materializes the **Canonical Source Asset** from R2 but does not become the **Upload Authority**
- **Acoustic Fallback Segmentation** keeps **Short-Form Intelligence** producing candidates when transcripts are unavailable
- The **Stepping-Stone Planner** ships before the full planner stack
- A **Top-Level Planner** may explore a small number of **Doctrine Branches** for high-value moments
- The **Judgment Layer** evaluates candidates proposed by the **Top-Level Planner**
- **GOD** is subordinate to the **Top-Level Planner** and is invoked only when the chosen treatment cannot be satisfied by the existing asset library
- **Short-Form Intelligence** and the **Judgment Layer** apply the **Editorial Optimization Hierarchy** when evaluating a treatment candidate
- An **Editorial Timeline** retains a **Protected Pause** only when its value outweighs the pacing cost
- A **Treatment Genome** may use **Reference Trait Extraction** but must remain original and governed
- A **Reference Corpus** supplies approved **Reference Trait Extraction** records to a **Treatment Genome** and its evaluator
- The **Judgment Layer** applies **Aesthetic Soundness** before an export is approved
- A **Treatment Genome** may express a **Governed CTA** only after source and brand facts are available

## Example dialogue

> **Dev:** "Should GOD decide the whole sequence path for this section?"
> **Domain expert:** "No. The **Top-Level Planner** chooses the treatment path, the **Judgment Layer** governs it, and **GOD** is only invoked if the asset library cannot satisfy that chosen treatment."

## Flagged ambiguities

- "memory" was being used to mean **Sequence Memory**, **Pattern Memory**, **Creator Taste Memory**, and the **Quality-Diversity Archive** — resolved: these are distinct concepts.
- "God mode" was being used to mean both **GOD** and the future **Top-Level Planner** — resolved: **GOD** remains the asset-generation subsystem only.
- "search everything" was being used to imply unconstrained doctrine mutation — resolved: doctrine exploration will use bounded **Doctrine Branches** rather than arbitrary doctrine invention.
- "snapshot creation" was being used to mix raw observation with editorial interpretation — resolved: split into **Observation Snapshot** first, then **Planning Snapshot**.
- planning scope was still fuzzy between one-beat and whole-video search — resolved: use an **Adaptive Planning Horizon**.
- the archive shape could easily sprawl into too many behavior axes — resolved: start with four **Archive Dimensions**.
- the archive could have drifted into storing whole sequences — resolved: each **Archive Entry** is a reusable per-moment **Treatment Genome**.
- evaluator evolution could have jumped straight into opaque learned ranking — resolved: use **Evaluator Staging**.
- evaluator failure was too vague to improve rigorously — resolved: define a first **Failure Taxonomy**.
- evaluator truth capture could have relied on noisy passive outcomes — resolved: use a lightweight explicit **Review Surface** first.
- short-form scoring could have overclaimed proxies as understanding — resolved: call the first ranking model **Correlated Signal Stacking** and keep learned weighting / LLM reasoning as later layers.
- planner rollout could have jumped straight to the full stack — resolved: ship a **Stepping-Stone Planner** first.
- the genome interface could have split too far from the live judgment seam — resolved: use **Treatment Genome v1** as an extension of the existing candidate-treatment shape.
- asset search and GOD generation could have collapsed into one vague control — resolved: keep **Retrieval Intent** and **GOD Escalation Intent** separate.
- beam search could have optimized local flash instead of sequence quality — resolved: use a sequence-level **Sequence Objective**.
- planner decisions could have become impossible to inspect — resolved: emit a first-class **Planner Audit**.
- "PlannerAudit" was being used for both rich planner trace and flat backend scoring summary - resolved: reserve **Planner Audit** for the rich trace and call the backend artifact **Candidate Score Summary**.
- renderer fallback behavior could have silently ignored planner-selected primitive fields - resolved: introduce the **Manifest Compiler** and protect it with **Render Contract Tests**.
- "upload intake" was being used for both browser/R2 upload authority and MAUL analysis intake - resolved: the **Upload Authority** ends at the **Canonical Source Asset** commit; MAUL starts with a **Source Analysis Job**.
- R2 object events could have been mistaken for project commands - resolved: an object event is reconciliation evidence only and cannot select a project's **Canonical Source Asset**.
