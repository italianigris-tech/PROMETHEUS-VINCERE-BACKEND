# Roadmap Toward Beating Seedance

Date: 2026-06-24
Last updated: 2026-06-27

Status: Full replacement of the earlier roadmap after critique.
Addendum 2026-06-27: Extended after a codebase-wide audit that found the planner and renderer operate as two disconnected stacks (the "seam" problem). Programs 16–20 and the corrected execution order in this update capture the consequences: stack consolidation as the keystone, the corrected IRL economics, the multi-style / multi-vehicle architecture, and the render-infrastructure decision.

## Root-Cause Correction

### First correction (2026-06-24)

The prior roadmap failed because it over-compressed the architecture.

It treated multiple load-bearing systems as broad future themes instead of independent programs with their own interfaces, data, acceptance proofs, and issue streams. That was the wrong shape for this ambition.

### Second correction (2026-06-27): the two-stack seam

A second structural failure was found in audit. The repository contains two independent planning stacks that do not connect:

- **Stack A** (`remotion-app/src/creative-orchestration/`): the rich planner — SteppingStonePlanner, treatment genomes, beam search, QD archive, negative grammar, pairwise taste critic, 7-axis sequence memory, surprise/identity budgets. Emits `EditDecisionPlan` + `CreativeTrack[]` + a rich `PlannerAudit`.
- **Stack B** (`backend/src/director/`): the deterministic director that emits `UnifiedRenderManifest`, wired to the worker, evidence pipeline, replay ledger, determinism scripts, and the renderer (`JosephEdit.tsx`). It selects doctrine by seed and derives everything from `seededRandom`.

The two stacks share a type name (`PlannerAudit`) with unrelated schemas. The rich planner emits a depth-layered, primitive-aware, genome-selected decision. The renderer receives five fallback animation strings and one flat plane. Between them is **a translation layer that was never built**, so Stack A's intelligence is, today, a write-only system.

The corrected roadmap therefore adds **Program 16: Stack Consolidation And The Manifest Compiler** as the keystone: every other program's intelligence reaches pixels only through this seam.

The corrected roadmap below treats the following as first-class programs:

- graph-based planning
- multi-modal sync
- primitive combination grammar
- robust picture-in-picture
- text entry and emphasis primitives
- motion-graphic camera vectors
- synthetic pacing
- semantic macro-rigs
- explainable negative evaluation
- Golden 100 data surfaces
- MaxEnt IRL reward learning
- historical exploration bias
- review and regression evidence
- stack consolidation and the planner-to-renderer seam (added 2026-06-27)
- style-conditioned reward, prompt inference, and brand ingestion (added 2026-06-27)
- multi-vehicle scene-type routing (added 2026-06-27)
- render infrastructure as GPU-first with software fallback (added 2026-06-27)
- feature audit and feature-space discipline (added 2026-06-27)

This is still grounded in the current codebase, but it is no longer anchored to the current issue tracker as the ceiling of the architecture.

## North Star

Prometheus should not clone Seedance's latent video generator.

Prometheus should beat Seedance by becoming a deterministic, inspectable, mathematically governed editorial intelligence system.

Seedance wins at hallucinated video creation.

Prometheus can win at:

- exact typography
- deliberate motion graphics
- picture-in-picture composition
- governed asset reuse and generation
- explainable judgment
- frame-level editorial control
- repeatable premium style
- long-horizon creator taste evolution

The system we are building is not simply a video renderer. It is an AI director that plans, composes, evaluates, learns, and explains.

## Non-Negotiable Design Rules

- Do not bury picture-in-picture inside generic layout work.
- Do not bury micro-animation inside generic motion work.
- Do not bury the evaluator inside generic test coverage.
- Do not bury MaxEnt IRL inside a vague future learning phase.
- Do not treat graph planning as a database choice. It is a planning representation.
- Do not treat the issue tracker as the architecture. The tracker must be updated to match the architecture.
- Do not let LLMs directly author timings, camera paths, shader code, or final edit authority.
- Do not optimize for the single highest-scoring candidate every time.
- Do not let best score become same video forever.
- Do not call a pass/fail quality floor an evaluator.

### Added 2026-06-27

- Do not let the rich planner stay write-only. Intelligence that never reaches the renderer is decorative. The seam is the keystone; build it before enriching the planner.
- Do not learn a reward on top of a renderer that ignores the planner. A learned reward applied greedily on an unfaithful manifest produces confident templated garbage.
- Do not confuse inference speed with IRL cost. Inference is ~ms and free; trajectory extraction is the GPU-bound, minutes-per-video, validation-heavy step. Plan infra for the latter, not the former.
- Do not conflate absolute demonstrations (reference edits) with pairwise preferences (studio winner/loser). They are different algorithms: MaxEnt IRL consumes the former, preference-based reward modeling consumes the latter. The system needs both, fused.
- Do not train one unconditional reward on a mixed multi-creator corpus. That produces a mongrel mean. Learn per-style weight vectors; use transfer/fine-tune to seed small corpora from large ones.
- Do not promise "learned brand style" from 1–5 videos. Below ~30 videos the weights are noise-dominated. Use retrieval/matching for few-video brands; reserve learned reward for 30+.
- Do not ship a learned reward greedily. Greedy argmax collapses the reward landscape to a single peak and produces templates. The exploration engine (QD + surprise budget) is not optional polish; it is the difference between a template engine and a creative system.
- Do not let the learned reward replace the hand-coded floor. IRL proposes, the judgment layer vetoes. The floor is the inspectability moat and stays hand-coded forever; the learned reward augments it within a safe envelope.
- Do not exceed the demonstrator by sample size alone. IRL is capped at the demonstrator's quality. "Better than Joseph" requires the exploration + preference-confirmation loop, which is structurally downstream of the studio and the seam.
- Do not let GPU cost be framed as the IRL bottleneck. Extraction is ~$3–30 per full corpus run on spot GPU, ~20 min wall-clock at 25-parallel. The binding constraint is feature engineering and extraction validation (a human-judgment cost), not silicon.
- Do not reach for visible quantities (GPU dollars, video count, link count) as the binding constraint. The recurring failure mode is mistaking an easy-to-count quantity for the gate. The gate is invisible: feature quality, curation quality, seam completeness, exploration wiring.
- Do not treat "more features" as better. The target for ~200–600 trajectories is ~60–80 low-correlation features. More overfits, increases extraction cost linearly, and destabilizes weights.
- Do not train on a creator's weak period or failures. Curate down to the ceiling, not the average. 200 excellent beats 600 mixed.
- Do not treat YouTube as the production corpus. Compression destroys the fine features that matter most; provenance and ToS make it a legal risk for a shipped product. Use it for research/proof only; license or user-upload for the moat.
- Do not treat Windows as the render-infrastructure destination. Software WebGL (swangle) is OS-agnostic and runs identically on Linux for ~half the cost. The Windows choice is a scar from a misdiagnosed headless-GPU crash; it is the wrong long-term default.
- Do not treat talking-head as the only vehicle. The 1B-person vision spans real estate, consultants, lawyers, specialists, drone, product. Each vehicle is a different scene model, not a profile config. The scene-type router is a first-class program.
- Do not promise direct integration with platform recommendation algorithms. YouTube/Instagram/TikTok do not expose their ranking algorithms via API to anyone. The achievable surface is auto-publish + analytics feedback into reward learning, not "talking to the algorithm."

## Current Codebase Baseline

The repo already has useful pieces:

- deterministic Joseph manifest generation in `backend/src/director/joseph-director.ts`
- candidate selection and similarity checks in `backend/src/director/judgment-layer.ts`
- evidence preservation in `backend/src/director/orchestrator.ts`
- richer Remotion-side judgment in `remotion-app/src/creative-orchestration/judgment`
- a first stepping-stone planner in `remotion-app/src/creative-orchestration/judgment/planning`
- `Observation Snapshot`, `Planning Snapshot`, `Treatment Genome v1`, QD archive, and beam search vocabulary
- video-aware audio planning in `backend/src/music/video-aware-planner`
- Pattern Memory and Replay Ledger foundations
- GOD as governed on-demand asset generation
- an initial `FAILURE_TAXONOMY.md`
- a long-horizon `JOSEPH_STYLE_MASTER_PLAN.md`

The repo does not yet have the architecture needed to beat Seedance:

- no authoritative graph planner that owns the full timeline
- no real primitive combination grammar
- no robust 2.5D PiP compositor
- no continuous negative evaluator with fix intent
- no Golden 100 data surface
- no practical MaxEnt IRL reward loop
- no historical fatigue ledger across many videos
- no semantic macro-rig routing
- no motion-graphic camera vector system
- no unified sync matrix for semantic, audio, and spatial facts

## Correct Architecture Stack

The final architecture should be layered like this:

1. Data Surface and Benchmark Extraction
2. Observation Snapshot
3. Multi-Modal Sync Matrix
4. Graph Planner
5. Treatment Genome Search
6. Primitive Combination Grammar
7. Motion-Graphic Camera and Flow System
8. Robust PiP and 2.5D Depth Compositor
9. Synthetic Pacing and Semantic Macro-Rigs
10. Explainable Negative Evaluator
11. Historical Exploration and Creator Taste Memory
12. Governed Render Execution
13. Review Surface and Regression Gallery

Each layer must emit artifacts that can be inspected, tested, and reviewed.

## Program 0: Fast Feedback And Evidence Studio

### Why This Exists

Every advanced planning system needs a fast visual feedback loop.

The existing issue tracker is correct that Fast Feedback Studio matters, but it should not be the whole plan. It is the lab where every later system is judged.

### Build

- candidate manifest loading
- synchronized A/B/C/D playback
- frame stepping
- timeline scrubbing
- planner audit overlay
- primitive overlay
- PiP/debug depth overlay
- camera vector overlay
- audio transient overlay
- failure tag panel
- winner/loser review capture
- frame proof capture
- regression gallery export

### Acceptance Proof

- Review 12 candidate edits in under 10 minutes without rendering 12 MP4s.
- Freeze any frame and see the active graph node, primitive, camera vector, text primitive, PiP layer, and evaluator warnings.
- Store a winner/loser verdict with failure tags and screenshot proof.

### Independence Rule

This program can run before most intelligence work, but it must be designed to display future planner and evaluator artifacts rather than hardcoding today's manifest shape.

### Added 2026-06-27: the studio is the upstream of the entire learning loop

The studio is not only a test surface. It is the **data source that IRL and the preference model train on.** This makes "test first" structurally mandatory, not a sequencing preference:

- The studio captures **pairwise preferences** (candidate A preferred over B; candidate C failed). That data shape is the training input for **preference-based reward modeling**, not for MaxEnt IRL.
- Reference edits (Joseph's actual videos) provide **absolute demonstrations.** That data shape is the training input for MaxEnt IRL.
- The full learning loop requires both, fused (see Program 11). Therefore the studio's review ledger and the trajectory corpus are co-equal halves of the learning dataset.

The current codebase already has a studio implementation (`remotion-app/src/web-preview/JosephStudyStudio.tsx`) that meets the **player** and **review-capture** acceptance proofs via live Remotion `<Player>` (real GPU, real-time, no MP4 render). It does NOT use the slow production path (`renderMedia` + swangle), so "review 12 candidates in under 10 minutes" is already architecturally satisfied by the live-Player path, not the render path.

The studio is currently estimated at ~55% of this program. The remaining work, in priority order:

1. **Deep per-frame diagnostics.** The current overlay sections only list frame ranges. They must resolve, for a frozen frame, the active primitive IDs, PiP depth/layer state, camera vector, evaluator warnings, and planner-audit graph nodes. This is gated by Program 16 (the seam): the studio cannot show what the planner decided until the renderer reads from the planner.
2. **Generator-to-lanes wiring.** The studio loads from a static fixture or URL today; there is no trigger that fires the planner and populates lanes from `generateCandidateGenomes`.
3. **Full failure-tag taxonomy.** The studio ships 5 generic tags today. The Review Surface must capture the full Program 10 negative ontology so preference data is labeled at the granularity the evaluator learns from.
4. **Frame-proof capture** (screenshot with overlays) and **regression gallery export**.
5. **Planner-audit overlay** (beam candidates, selected path, genome shortlist) — gated by Program 16.

### Critical path note

The studio's highest-value diagnostic — "show me what the planner decided at this frame, and let me mark it preferred/failed with the right failure tags" — cannot work until the renderer reads from the planner. Therefore **Program 16 (the seam) gates the studio's deep diagnostics and the renderer fidelity work together.** The studio is a prerequisite for IRL data, and the seam is a prerequisite for the studio's depth. Build the seam, then complete the studio, then begin reviewing — and that review data is the IRL on-ramp.

## Program 1: Data Surfaces And Golden 100 Extraction

### Why This Exists

MaxEnt IRL and reward learning require data.

The low-compute route is not to train on pixels. The route is to extract compact editorial trajectories from elite reference edits.

### Build

- a Golden 100 reference set
- a video ingestion manifest for each reference
- FFmpeg-based shot and motion probes
- OCR text region extraction
- optional MediaPipe face/body/hand regions
- audio energy, transient, beat, and silence extraction
- text occupancy and typography placement maps
- camera movement approximations
- PiP detection labels where possible
- primitive-like event extraction
- `trajectory.json` per reference video

### Data Shape

Each `trajectory.json` should contain:

- global metadata
- timeline windows
- semantic role labels
- audio buckets
- spatial grid occupancy
- text region boxes
- face/body/object boxes
- camera vector estimates
- primitive event candidates
- transition event candidates
- negative-space ratio
- climax windows
- restraint windows

### State Discretization

Discretize the problem aggressively:

- screen into grid cells
- time into beat-aware windows
- audio into energy/transient buckets
- typography into role and occupancy classes
- camera motion into vector classes
- PiP into depth/layering states
- primitive usage into named event families

This makes reward learning practical without massive compute.

### Acceptance Proof

- At least 20 reference edits produce valid `trajectory.json`.
- Each trajectory can be visualized as overlays in the Fast Feedback Studio.
- A human can inspect a trajectory and recognize the edit's rhythm and composition.

### Independence Rule

This is its own program. Do not fold it into the evaluator or planner.

### Added 2026-06-27: the real economics and the binding constraint

The economics of extraction are dramatically cheaper than the dominant folk assumption. They must be stated precisely so the program is not blocked on a phantom cost.

**Wall-clock and cost (spot GPU, A10G / RTX 4090 class, June 2026):**
- 5 min/video is a sound planning figure for optical-flow + MediaPipe + OCR + light segmentation over a ~90s 1080×1920 clip on a single GPU.
- Extraction is **embarrassingly parallel** — each video is fully independent, no shared state, no ordering.
- At 25-GPU parallelism: **100 videos ≈ 20 min wall-clock.**
- Cost: **~$0.03–$0.07/video spot, ~$0.07–$0.13/video on-demand.** Full 100-video corpus: **~$3 spot, ~$7–15 on-demand.** A full re-extract of the entire corpus weekly costs less than a coffee.

**Therefore: GPU cost is NOT the IRL bottleneck.** The recurring misframing (inherited from the same source that misdiagnosed the Linux/WebGL crash) treats an easy-to-count quantity as the gate. It is not.

**The actual binding constraint is feature engineering and extraction validation** — a human-judgment cost, not a compute cost:
- Bad extraction → garbage features → garbage reward. No amount of data fixes bad features.
- Spotting extraction errors takes eyes: "did it correctly detect Joseph's PiP layer? did OCR catch the right text? is the camera vector estimate sane?"
- Feature definitions change over time; a schema change requires re-extracting the entire corpus or the solver trains on inconsistent features. Version the feature schema.

**Feature target (~60–80 low-correlation features):** For ~200–600 curated trajectories, the sweet spot is roughly 60–80 well-chosen, low-correlation features across the families already listed under "Feature Families" of Program 11. NOT 15 (too coarse, misses tacit craft) and NOT 300 (overfits, increases extraction cost linearly, destabilizes weights). The discipline within each family is to pick the features that are least correlated and most craft-relevant, and to resist adding correlated variants. Program 20 (Feature Audit) governs this set.

**Curation-by-quality, not curation-by-quantity.** Curate down to the ceiling, not the average. For a creator like Joseph with ~600 public videos, ~200 that represent his best work will outperform all 600 mixed. Train only on a creator's curated recent work, never their weak period or experimental misses — those teach the learner that the mistakes were intentional.

**YouTube is a research source, not a production corpus.** YouTube recompression destroys the fine features that matter most (micro-timing, edge sharpness, motion vector precision); resolution caps (often 720p served) degrade OCR and PiP detection; the long tail is overwhelmingly average content that teaches the average, not the elite; provenance and ToS make it a legal risk for a shipped commercial product. **Use YouTube to bootstrap and prove the pipeline.** Do not build the moat on it. The production corpus requires source-quality, properly-licensed, curated references (licensing arrangements with the editors, or a creator-uploads-their-own-references flow that doubles as the brand-ingestion moat — see Program 17).

**Duration and pacing discipline.** IRL learns a reward over editing decisions, not over total output length — a reward trained on 20-minute videos applies to 30-second shorts with no duration mismatch. The real bias is **pacing regime**: long-form carries low-density stretches; shorts carry high density per second. If the product makes shorts, the training corpus should be dominated by short-form material so the reward learns short-form pacing, not long-form economics.

**Three operations, not one.** Do not conflate them:
- Trajectory extraction (per video, GPU-bound, seconds-to-minutes) — the heavy step.
- IRL/preference solver (training, CPU, minutes-to-hours, occasional) — cheap.
- Live inference (~ms, free) — already fast; this is never the bottleneck.

## Program 2: Graph Planner And Multi-Modal Sync Matrix

### Why This Exists

A Seedance-level planner cannot be a linear array of timestamped effects.

Prometheus needs a graph representation where visual, audio, semantic, spatial, and camera events are connected by typed relationships.

### Build

- timeline DAG
- graph node schema
- typed temporal edges
- lookahead window
- tension builder
- sync matrix
- graph-to-manifest compiler
- graph audit artifact

### Graph Nodes

The graph should support:

- semantic phrase nodes
- word emphasis nodes
- audio transient nodes
- beat/drop/silence nodes
- camera motion nodes
- text primitive nodes
- PiP state nodes
- macro-rig nodes
- asset nodes
- transition nodes
- evaluator constraint nodes

### Graph Edges

Edges should encode:

- starts-before
- starts-after
- lands-on
- must-avoid
- follows-momentum-from
- preserves-eye-trace-from
- suppresses-until
- escalates-after
- shares-anchor-with
- conflicts-with

### Lookahead And Tension

The planner should look ahead 5 to 10 seconds by default and deeper for high-stakes beats.

It should:

- detect payoff and climax windows
- reserve visual energy before the climax
- trigger "The Hold" when silence or restraint is more powerful than motion
- protect climax budget
- avoid spending the strongest primitive too early

### Sync Matrix

The Sync Matrix aligns:

- semantic importance
- audio energy and transient spikes
- spatial safe zones
- camera flow
- text readability
- PiP layer state
- primitive legality

This is the moment where the planner decides not merely "what effect" but "why this effect at this time in this space."

### Acceptance Proof

- One input transcript compiles into a graph with semantic, audio, spatial, and visual nodes.
- The graph can produce at least two distinct legal edit paths from the same source.
- The Fast Feedback Studio can display graph nodes and edges over time.

### Independence Rule

This is a planning representation program, not a Neo4j program. A graph database can be considered later if storage/query needs justify it.

## Program 3: Primitive Combination Grammar

### Why This Exists

Primitive libraries are useless without rules for coexistence.

Prometheus needs a grammar that says how text, camera, PiP, backgrounds, assets, SFX, and transitions can combine without creating clutter, semantic redundancy, or motion nausea.

### Build

- primitive interface
- primitive metadata schema
- compatibility matrix
- collision rules
- cooldown rules
- hierarchy rules
- substitution rules
- grammar compiler
- grammar validator

### Primitive Metadata

Every primitive should declare:

- role
- intensity
- duration range
- spatial footprint
- camera dependency
- PiP compatibility
- typography compatibility
- audio sync expectation
- semantic fit
- cooldown class
- failure risks

### Combination Rules

The grammar must govern:

- text over PiP
- text over face/body
- text over data surfaces
- hero text plus support text
- background motion plus camera motion
- camera shake plus zoom blur
- PiP resize plus typography entry
- SFX impact plus visual impact
- transition plus ongoing text
- macro-rig plus source footage

### Required Failure Classes

The grammar should explicitly detect:

- spatial suffocation
- semantic echo
- temporal redundancy
- motion whiplash
- primitive pileup
- hierarchy collapse
- PiP/text collision
- camera/transition contradiction
- over-scored sameness

### Acceptance Proof

- Given a candidate manifest, the grammar can explain every legal and illegal primitive combination.
- A blocked candidate returns exact rule violations and suggested substitutions.
- The planner can ask the grammar for alternatives instead of randomly retrying.

### Independence Rule

This is not the micro-animation library. It is the law that governs every primitive family.

## Program 4: Text Entry, Emphasis, And Typography Primitives

### Why This Exists

The current animation vocabulary is too shallow for premium editorial typography.

Text behavior must be planned at the level of words, letters, weights, spacing, and emphasis physics.

### Build

- text entry primitives
- text emphasis primitives
- text mutation primitives
- optical kerning rules
- tracking/leading formulas
- hero/support hierarchy rules
- line-break evaluator
- typography primitive tests

### Text Entry Primitives

Include:

- word riser
- letter riser
- clipped mask reveal
- horizontal tension reveal
- velocity slide reveal
- soft tracking reveal
- kinetic typewriter
- staggered phrase reveal
- overshoot spring pop
- exponential glide entry

### Text Emphasis Primitives

Include:

- underline reveal
- sweep highlight
- capsule highlight
- matte highlight
- semantic glow
- weight escalation
- color inversion
- scale pulse
- bracket lock
- callout tether

### Typography Math

The system must govern:

- negative tracking for hero text
- positive tracking for small support text
- optical kerning correction at large sizes
- line-height by role and font family
- max words per line by role
- filler-word suppression
- punch-word isolation
- font pairing by rhetorical role

### Acceptance Proof

- Same phrase can produce at least 12 premium text treatments without feeling templated.
- Large hero text tightens correctly without unreadable collisions.
- Small support text opens enough to remain readable.
- The evaluator can reject cheap emphasis and explain why.

### Independence Rule

This is not generic typography intelligence. This is the primitive-level text behavior program.

## Program 5: Robust Picture-In-Picture And 2.5D Depth Compositor

### Why This Exists

Picture-in-picture is not a layout option. It is a full composition system.

The target is a robust PiP system that can combine speaker, matte, background, asset boards, text, and motion layers without losing focus.

### Build

- PiP state model
- PiP rig system
- 2.5D depth compositor
- matte-aware speaker layer
- background replacement layer
- foreground typography layer
- asset board layer
- Z-index law
- PiP motion behaviors
- PiP evaluator

### Required Layer Model

The compositor should support:

- source background
- generated or retrieved background
- macro-rig background
- behind-speaker asset layer
- matted speaker layer
- PiP frame layer
- foreground text layer
- accent primitive layer
- UI/data surface layer
- transition mask layer

### PiP Motion Behaviors

Include:

- enter
- dock
- undock
- expand
- collapse
- split-screen
- focus shift
- handoff
- punch-in
- push-back

### PiP Rules

The system must know:

- when PiP owns the frame
- when text owns the frame
- when PiP must shrink
- when PiP must exit
- when an asset board can enter
- when depth layering is legal
- when speaker matte confidence is too weak
- where typography may sit around PiP

### Acceptance Proof

- Render a speaker PiP over an animated background with hero text in front and an asset behind the speaker.
- Show the depth order in diagnostic overlay.
- Evaluator can reject weak PiP composition with exact collision or focus reasons.

### Independence Rule

Do not merge this with background primitives or generic layout work.

## Program 6: Motion-Graphic Camera Vectors And Flow Engine

### Why This Exists

Flow is not a vibe. It is camera and motion math.

Prometheus needs deterministic equivalents of optical-flow continuity: momentum handoff, eye-trace preservation, lens behavior, and camera vector legality.

### Build

- camera vector model
- momentum handoff rules
- eye-trace anchor model
- lens property model
- focal length shift rules
- chromatic aberration governance
- camera transition library
- camera evaluator

### Camera Vector State

Track:

- position X/Y
- scale/Z
- rotation
- velocity
- acceleration
- focal target
- eye-trace anchor
- subject lock
- lens profile
- motion energy

### Flow Rules

The planner must enforce:

- cuts inherit or intentionally break momentum
- camera velocity cannot reverse without a reason
- next focal anchor should preserve eye trace where possible
- digital punch-in must land on a semantic or audio event
- shake cannot collide with dense typography
- zoom blur cannot obscure active reading
- focal length shifts must match emotional intent

### Premium Lens Effects

Govern:

- subtle chromatic aberration
- depth blur
- focus rack
- lens breathing
- parallax drift
- Z-axis pierce
- velocity smear

### Acceptance Proof

- Two adjacent moments can show momentum handoff across a transition.
- The diagnostic overlay shows camera vector continuity.
- Evaluator can reject motion whiplash with exact vector evidence.

### Independence Rule

This is not the same as transition effects. It is the camera physics and flow layer that transitions obey.

## Program 7: Synthetic Pacing And Artificial Jump-Cut Engine

### Why This Exists

Source footage is often boring.

The planner must create perceived momentum even when the raw clip is static.

### Build

- synthetic jump-cut planner
- digital punch-in engine
- crop reframing engine
- burn transition family
- kinetic hold/release rules
- static-footage rescue mode
- pacing evaluator

### Synthetic Pacing Tools

Include:

- digital punch-in
- punch-out
- snap crop
- micro jump-cut
- lateral reframing
- speed-ramp illusion
- burn transition
- glitch puncture
- freeze hold
- silence hold
- snap-to-proof beat

### Rules

The engine should:

- never cut inside important words
- prefer jump-cuts at phrase, breath, beat, or visual reset points
- force motion when static footage remains visually dead too long
- preserve readability during synthetic moves
- protect climax beats from overuse
- avoid jump-cut spam

### Acceptance Proof

- Static talking-head footage can receive credible movement without losing semantic clarity.
- The planner can explain why each synthetic cut exists.
- Evaluator can reject overcutting, mid-word cuts, and pacing fatigue.

### Independence Rule

This is not the same as audio choreography. It is the visual pacing rescue system.

## Program 8: Semantic Macro-Rigs And Contextual Worlds

### Why This Exists

Some topics need entire scene systems, not single assets.

Prometheus should detect when a semantic context deserves a macro-rig: news, finance, court, dashboard, blueprint, product launch, documentary proof, confession, war room, medical, sports, education, and so on.

### Build

- macro-rig ontology
- semantic trigger mapping
- rig manifest schema
- rig asset requirements
- rig camera behavior
- rig typography rules
- rig evaluator

### Example Macro-Rigs

Include:

- newsroom desk
- 3D newspaper spread
- finance dashboard wall
- evidence board
- courtroom board
- product showcase pedestal
- phone/social UI board
- map room
- data surface cockpit
- classroom explainer board

### Rig Contract

Each macro-rig should declare:

- semantic triggers
- required assets
- layout zones
- PiP compatibility
- text zones
- camera paths
- motion budget
- failure risks
- fallback rig

### Acceptance Proof

- A news topic can load a newspaper/newsroom rig without custom prompting.
- A finance topic can load a data/dashboard surface.
- The evaluator can reject a rig when semantic fit is too weak.

### Independence Rule

Do not reduce macro-rigs to asset retrieval. A macro-rig is a composed world with its own laws.

## Program 9: Data Surfaces And Visual Primitive Worlds

### Why This Exists

Premium videos often need surfaces that carry information and mood: dashboards, boards, charts, frames, devices, documents, maps, proof stacks, and visual systems.

### Build

- data surface primitive library
- chart and metric panel primitives
- document surface primitives
- device frame primitives
- board primitives
- spatial placement rules
- semantic binding rules
- surface evaluator

### Surface Families

Include:

- dashboard panel
- metric counter
- chart slab
- timeline board
- document stack
- receipt/proof card
- device mockup
- map plate
- callout board
- comparison table
- quote card
- social post frame

### Rules

The planner must know:

- when a surface supports the point
- when a surface becomes semantic echo
- how much text a surface can hold
- whether PiP can coexist with it
- when the camera should move through it
- when it should stay still

### Acceptance Proof

- A finance segment can render a readable metric surface.
- A proof segment can render document/receipt surfaces.
- Evaluator can reject data clutter and semantic echo.

### Independence Rule

This is not background decoration. It is a structured surface system.

## Program 10: Explainable Negative Ontology And Evaluator

### Why This Exists

The existing taxonomy is useful, but it is not yet the required evaluator.

The evaluator must behave like a creative discriminator. It must output continuous penalties, evidence, and fix intent.

### Build

- negative ontology
- continuous penalty model
- evidence extractors
- candidate pairwise comparison
- fix intent JSON
- targeted reroll constraints
- evaluator audit artifact

### Required Negative Classes

Start with:

- spatial suffocation
- semantic echo
- temporal redundancy
- motion whiplash
- primitive pileup
- hierarchy collapse
- readability sacrifice
- PiP focus collapse
- data clutter
- dead pacing
- climax waste
- premium restraint misread
- cheap template motion
- repetition fatigue
- asset treatment mismatch
- camera flow break

### Penalty Shape

Each failure should emit:

- class
- severity
- continuous score
- evidence
- frame range
- responsible graph nodes
- responsible primitives
- fix intent
- reroll constraints

### Fix Intent Example

```json
{
  "failureClass": "spatial_suffocation",
  "penalty": -0.42,
  "frameRange": [420, 510],
  "evidence": {
    "occupiedScreenRatio": 0.84,
    "negativeSpaceRatio": 0.16,
    "speakerFaceOverlap": 0.18
  },
  "fixIntent": {
    "requiredChange": "reduce_visual_density",
    "constraints": [
      "negative_space_ratio >= 0.45",
      "speaker_face_overlap <= 0.03",
      "remove_one_support_surface"
    ]
  }
}
```

### Acceptance Proof

- Evaluator can explain why Candidate A lost to Candidate B.
- Evaluator emits continuous penalties, not only pass/fail.
- Planner can consume fix intent and reroll only the failing window.

### Independence Rule

This is not just `FAILURE_TAXONOMY.md`. The taxonomy is vocabulary; this program is the scoring and evidence engine.

## Program 11: MaxEnt IRL Reward Model

### Why This Exists

Prometheus needs to learn what elite human editing rewards without turning into a brittle hardcoded rule machine.

MaxEnt IRL belongs earlier than the old roadmap placed it, but only as a data-backed program with a compact state representation.

### Build

- state representation from Golden 100 trajectories
- feature extractor
- reward weight learner
- baseline human reward model
- reward evaluator
- reward drift monitor
- integration with planner scoring

### Feature Families

Learn weights over:

- negative space ratio
- text density
- camera motion class
- motion energy
- cut spacing
- silence/hold placement
- PiP state
- primitive family
- semantic role
- audio transient alignment
- climax reserve
- macro-rig use
- data surface use
- face/body overlap

### MaxEnt Scope

Use MaxEnt IRL to learn editorial preference tendencies, not to directly render video.

It should inform:

- planner scoring
- candidate reranking
- primitive selection bias
- evaluator thresholds
- fatigue-aware exploration

### Acceptance Proof

- Train on extracted trajectories from at least 20 reference edits.
- Produce interpretable reward weights.
- Show that learned weights prefer human-like reference trajectories over random/generated baselines.

### Independence Rule

This is not creator taste memory. It is the general human-editing reward prior.

### Added 2026-06-27: the demonstrator cap, the hybrid reward, and the pairwise/absolute split

Three corrections to how MaxEnt IRL is commonly understood inside this codebase. They change the architecture, not just the tuning.

**1. The demonstrator cap (a theorem-shaped fact).** IRL recovers the reward that the demonstrator appears to optimize. Therefore the *best possible* learned reward reproduces the demonstrator's editing decisions; it does not exceed them. Feeding 10,000 Joseph videos yields a reward that mimics Joseph, not one that beats him. More data approaches his ceiling; it does not raise it. "Better than Joseph" can only come from a source outside Joseph — the preference-confirmation loop in Program 12. This is not a hedge; it is the definition of inverse learning. Plan the moat accordingly: IRL alone caps at the demonstrator; the exceed-demonstrator loop is structurally separate.

**2. The pairwise/absolute reconciliation (a real roadmap flaw being corrected).** Two distinct data sources feed learning, and they require two different algorithms:

- **Reference edits (Joseph's videos) → absolute demonstrations.** These train **MaxEnt IRL** — recover the reward that best explains why the expert took the trajectories they took.
- **Studio winner/loser ledger → pairwise preferences.** These train a **preference-based reward model** (RLHF-style) — recover the reward that best explains why the human preferred A over B.

The two produce two reward signals that must be **fused**, not chosen between. The honest architecture is a **hybrid reward**:

```
final_reward(state, action) =
    w_hand   · R_handcoded_features        (the invariants — Program 10 floor)
  + w_abs    · R_maxent_absolute_weights   (Joseph's craft prior)
  + w_pref   · R_preference_weights         (human taste refinement)
  + w_explore· exploration_bonus(state)     (Program 12)
```

The hand-coded floor (`w_hand`) is never learned and never replaced — it is the inspectability moat and stays explicit forever. The MaxEnt term imports the demonstrator's craft. The preference term refines it from the studio ledger. The exploration term prevents collapse to the argmax (see Program 12). `w_abs` and `w_pref` are scalar mixing weights, tuned so neither signal dominates.

**3. Per-style weight vectors, not one unconditional reward.** A single reward trained on a mixed multi-creator corpus produces a mongrel mean that waters down each style. The architecture is **style-conditioned reward** (Program 17): one weight vector per style (`w_joseph`, `w_iman`, `w_hormozi`, `w_brandX`), never mixed. The reward function takes a style label as input and applies that style's weights. Small corpora seed from larger ones via transfer/fine-tune (initialize `w_cody` from `w_joseph`, then fine-tune) — this is the disciplined way to make a 50-video supplementary corpus useful without polluting the 600-video foundation.

**Sample-size curve (for discretized, hand-engineered features — NOT pixel/deep reward):**

| Trajectories | Status |
|---|---|
| ~30–50 | Noisy; mean may beat hand-code; individual videos swing it heavily. Exploratory only. |
| ~100–200 | Usable signal; mean reliably beats hand-coding; per-video influence still visible. Minimum viable. |
| **~300–600 (≈ Joseph's curated corpus)** | **Stable, reproducible reward; variance low. The sweet spot.** |
| ~1,000–2,000 | Diminishing returns; only helps if features are noisy/continuous. |
| ~5,000–10,000 | Overkill for discrete features; justified only for deep/neural or pixel reward. |

**600 curated trajectories is genuinely sufficient.** If the learned reward is poor at 600, the problem is NOT sample count — it is feature quality or extraction correctness. Past ~600, throwing more videos at a bad IRL result is a waste; the bottleneck has moved to features (Program 20). Duplicates add zero information and cause overfitting; the lever is diverse curated videos, never more copies of the same ones.

**Inference is free; extraction is the cost.** Applying learned weights inside `scoreGenome()` is sub-millisecond and requires no GPU. The deployed solver output is a compact weight vector (~KB), not a multi-GB model. The expensive parts live upstream in Program 1 (extraction) and downstream in Program 12 (exploration). This program itself is cheap at runtime.

## Program 12: Historical Exploration Bias And Creator Taste Memory

### Why This Exists

The highest reward candidate is not always the right candidate.

If the system always selects the top deterministic score, it will repeat itself. A channel needs freshness across weeks and months.

### Build

- global usage ledger
- creator-specific taste memory
- primitive fatigue penalties
- macro-rig fatigue penalties
- camera path fatigue penalties
- softmax sampling with temperature
- UCB-style exploration bonus
- novelty/consistency controller

### Memory Types

Keep separate:

- Sequence Memory for the current video
- Pattern Memory for reusable pattern outcomes
- Creator Taste Memory for creator preference
- Global Fatigue Ledger for long-horizon repetition
- Quality-Diversity Archive for high-quality diversity cells

### Selection Formula

Candidate selection should combine:

- learned reward
- evaluator penalty
- grammar legality
- creator taste prior
- historical fatigue penalty
- exploration bonus
- production practicality

### Acceptance Proof

- Same source and prompt can generate several high-quality but meaningfully different candidates.
- Repeated runs over many videos reduce overused primitive families.
- A creator preference can bias selection without removing novelty.

### Independence Rule

This is not MaxEnt IRL. It is the exploration and memory system that prevents reward collapse.

### Added 2026-06-27: this program IS where creativity lives

This is the most important framing correction in the entire roadmap. **Creativity does not emerge from learning. It is plugged in here.** A learned reward applied greedily (always picking the argmax) collapses the reward landscape to a single peak and produces templates — the same input yields the same output every time. That is the default failure mode of "AI editing" products, and this program exists specifically to prevent it.

**The creativity stack is three layers, none creative alone:**

```
Layer 3 — EXPLORATION ENGINE (this program)        ← creativity enters here
   │  QD search forces behaviorally-distinct solutions
   │  surprise budget rewards expectation-violation
   ▼
Layer 2 — LEARNED REWARD (Program 11)              ← taste gradient
   │  scores how good an edit is; has many peaks
   ▼
Layer 1 — HAND-CODED FLOOR (Program 10)            ← safety / invariants
      what can never be violated
```

A reward landscape has many peaks (multiple distinct edits can all score high). A template engine maps input → one fixed output. The exploration engine maps input → **a search over the reward landscape under a diversity constraint with a surprise budget**, so the output is discovered at runtime, not fixed at design time. That is the formal difference between creativity and templating.

**Four mechanisms, in increasing power:**

- **A. Top-K sampling.** Instead of always picking the argmax, sample from the top-K high-scoring edits. Breaks pure templating because multiple valid edits exist; bounded because all stay within the reward's landscape.
- **B. Quality-Diversity search (the QD archive).** Explicitly rewards behavioral diversity: maintains an archive of behaviorally-distinct solutions and penalizes new candidates too similar to existing ones. If the archive already has "glass-card-at-emphasis" and "typography-pop-on-beat," the next candidate is pushed to find a third, distinct high-quality edit. This is where novelty the demonstrator never showed can emerge, because the search is constrained to the reward landscape, which is broader than any single demonstrator's path through it.
- **C. Surprise / expectation-violation budget.** A deliberate allocation of "how much should this edit violate expectations," tracked against a running memory. The reward gets a bonus term for behaviors that violate the expectation model, up to the budget, so it doesn't become chaos. This is the layer that produces the "he just did something insane and it worked" moments at a controlled rate.
- **D. Style interpolation.** Moving in style space (Program 17) to produce combinations no single creator made. Deferred until B and C are proven; the riskiest for mongrelization.

**The exceed-demonstrator loop (the only path to "better than Joseph"):**

IRL alone is capped at the demonstrator (Program 11). The loop that climbs above the demonstrator is:
1. IRL gives the taste gradient (Joseph's craft).
2. Exploration finds regions of that gradient Joseph did not visit.
3. The Review Surface (Program 0) confirms which of those novel regions are genuinely good.
4. Those confirmed novel wins get folded back as new demonstrations that refine the reward.

Every novel edit marked "preferred" that Joseph would not have made is a vote that pushes the learned reward beyond its source. **The Review Surface is not just test data — it is the engine of exceeding the demonstrator.** This is why "test first" is structurally mandatory, not a sequencing preference: the studio is the upstream of both the preference model (Program 11) and the exceed-demonstrator loop (here).

**The measurable creativity health signal:** behavioral diversity across runs of the same input. If the QD archive is working, repeated runs of the same source yield behaviorally-distinct high-quality edits. If it is not working, the archive fills with minor variants of one solution, and the system has collapsed to a template engine. That diversity metric is the canary for whether this program is actually wired.

**Sequencing note:** the exploration engine (B and C) turns on AFTER the seam (Program 16) and the floor (Program 10) are solid, not before. Creative exploration without a reliable floor and a faithful render path produces confident garbage at scale. Build the safety net before the tightrope act. The deferral is about sequencing, not abandonment — these engines ARE the vision, but they are downstream of the keystone.

## Program 13: Governed Asset Retrieval And GOD Escalation

### Why This Exists

The planner must distinguish:

- reuse existing asset
- reuse with variation
- search deeper
- invoke GOD
- escalate to human review

### Build

- retrieval intent contract
- GOD escalation contract
- asset fit scoring
- macro-rig asset requirements
- generation brief constraints
- post-generation validation
- human approval gate

### Rules

GOD should:

- never replace the Top-Level Planner
- never generate by default
- generate only when library fit is weak and the treatment demands precision
- produce reusable modular assets
- pass technical, aesthetic, compositing, motion, and reuse gates

### Acceptance Proof

- Planner can explain why existing library is enough.
- Planner can explain why variation is needed.
- Planner can explain why GOD is preferred.
- Generated asset cannot enter the library without validation and approval.

### Independence Rule

This is not the macro-rig program. It is the governed asset supply chain.

## Program 14: Unified Planner-To-Renderer Contract

### Why This Exists

A brilliant planner is useless if preview and export interpret its decisions differently.

### Build

- graph-to-manifest compiler
- render contract schema
- preview adapter
- export adapter
- diagnostic adapter
- parity tests

### Contract Must Carry

- graph node IDs
- primitive IDs
- camera vectors
- text primitive parameters
- PiP layer state
- macro-rig IDs
- data surface IDs
- audio sync events
- evaluator constraints
- render fallback status

### Acceptance Proof

- Same planner output drives study preview and final export.
- Sampled frames match in typography, layer order, and camera state.
- Any fallback is visible as a failure/degradation record.

### Independence Rule

This is not Fast Feedback Studio. It is the contract that all render surfaces obey.

## Program 15: Issue Tracker Rebuild

### Why This Exists

The existing issue tracker is useful but incomplete. It reflects an earlier level of ambition.

The tracker must be regenerated around the corrected architecture.

### Build

- one parent epic for each program in this roadmap
- vertical slices under each program
- dependency tags
- acceptance proof per issue
- artifact expectations per issue

### Conversion Examples

Good issue shapes:

- Golden 100 extractor emits `trajectory.json` for 20 reference edits
- Graph planner compiles semantic/audio/spatial nodes into a manifest path
- Primitive grammar rejects PiP/text collision with fix intent
- PiP compositor renders speaker matte between background asset and foreground text
- Camera vector overlay shows momentum handoff across two moments
- Evaluator emits continuous penalty and reroll constraints for spatial suffocation
- MaxEnt IRL learns reward weights from trajectory features
- Historical fatigue ledger changes candidate selection after repeated primitive use

Bad issue shapes:

- improve planner
- build evaluator
- add AI director
- make animations better
- add PiP

### Acceptance Proof

- Every major program has independent issues.
- No issue hides multiple unrelated flagship systems.
- Every issue has a visible artifact or testable behavior.

## Dependency Map

### Immediate Foundations

These can start first:

- Program 0: Fast Feedback And Evidence Studio
- Program 1: Data Surfaces And Golden 100 Extraction
- Program 3: Primitive Combination Grammar design
- Program 10: Explainable Negative Ontology design
- Program 15: Issue Tracker Rebuild

### Planning Core

These depend on early contracts but should not wait for every primitive:

- Program 2: Graph Planner And Multi-Modal Sync Matrix
- Program 14: Unified Planner-To-Renderer Contract

### Visual System Programs

These are independent flagship systems:

- Program 4: Text Entry, Emphasis, And Typography Primitives
- Program 5: Robust Picture-In-Picture And 2.5D Depth Compositor
- Program 6: Motion-Graphic Camera Vectors And Flow Engine
- Program 7: Synthetic Pacing And Artificial Jump-Cut Engine
- Program 8: Semantic Macro-Rigs And Contextual Worlds
- Program 9: Data Surfaces And Visual Primitive Worlds

### Learning And Memory

These require data and review evidence:

- Program 11: MaxEnt IRL Reward Model
- Program 12: Historical Exploration Bias And Creator Taste Memory

### Asset Supply

This grows alongside the visual programs:

- Program 13: Governed Asset Retrieval And GOD Escalation

## Corrected Execution Order

1. Rebuild the issue tracker around this roadmap.
2. Build Fast Feedback and Evidence Studio enough to inspect artifacts.
3. Start Golden 100 extraction and trajectory surfaces.
4. Design Primitive Combination Grammar and Explainable Negative Ontology.
5. Build Graph Planner and Sync Matrix v1.
6. Build Text Primitive v1 and PiP Compositor v1 as separate programs.
7. Build Camera Flow v1 and Synthetic Pacing v1.
8. Build Semantic Macro-Rigs and Data Surfaces.
9. Wire planner output through the unified render contract.
10. Train first low-compute MaxEnt IRL reward model.
11. Add historical exploration bias and creator taste memory.
12. Expand GOD escalation and asset supply around real planner needs.

## Final Architectural Verdict

The corrected path to beating Seedance is not a standard refactor.

It is a new editorial intelligence architecture:

- extract elite edit trajectories
- learn compact reward priors
- plan on a graph
- align semantic/audio/spatial facts through a sync matrix
- compose with governed primitives
- maintain camera flow and PiP depth
- evaluate with continuous negative evidence
- reroll with precise fix intent
- explore with historical freshness pressure
- render deterministically with full auditability

Prometheus beats Seedance by becoming more inspectable, more exact, more explainable, and more editorially disciplined than a black-box latent video model.
