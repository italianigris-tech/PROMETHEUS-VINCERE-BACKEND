# Roadmap Toward Beating Seedance

Date: 2026-06-24

Status: Full replacement of the earlier roadmap after critique.

## Root-Cause Correction

The prior roadmap failed because it over-compressed the architecture.

It treated multiple load-bearing systems as broad future themes instead of independent programs with their own interfaces, data, acceptance proofs, and issue streams. That was the wrong shape for this ambition.

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
