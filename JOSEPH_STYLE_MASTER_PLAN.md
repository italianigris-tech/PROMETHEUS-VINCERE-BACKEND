## Joseph Style Master Plan

### Purpose

This document is the long-horizon orchestration plan for moving the current system much closer to a premium "Joseph edit" standard.

It is intentionally not a coding checklist. It is a program plan grounded in the live codebase as it exists today.

The goal is not "make the current pipeline a little better."

The goal is:

1. Replace weak creative orchestration with a stronger multi-stage visual intelligence system.
2. Make feedback loops fast enough that the system can actually be studied, scored, and improved.
3. Build the missing primitive library for premium micro-animation, picture-in-picture, and motion-graphics choreography.
4. Separate truly independent strategic tracks so that critical programs are not buried under generic "batch" headings.

### Ground Truth From The Current Codebase

This plan is based on the current state of the repo, not on theoretical architecture.

Observed realities:

- The current Joseph render path is real and verified end to end.
  - `remotion-app/src/compositions/JosephEdit.tsx`
  - `remotion-app/src/compositions/VideoPlane.tsx`
  - `remotion-app/src/entries/joseph-entry.tsx`
  - `scripts/test-full-render.ts`
- The worker render path is now capable of deterministic Joseph-only rendering with proof loops.
  - `apps/worker/src/index.ts`
  - `apps/worker/src/index.test.ts`
- The audio path is materially stronger than before.
  - `backend/src/audio/mix-audio.ts`
  - `backend/src/audio/mix-audio.integration.test.ts`
  - `backend/src/music/renderer/mix-renderer.ts`
- The font runtime path is materially stronger than before.
  - `backend/src/font/font-runtime-resolver.ts`
  - `backend/src/typography/zilliz-font-materializer.ts`
  - `scripts/hydrate-all-fonts.mjs`
- The edit-session and preview system already exists, but it is still biased toward placeholder-first, transcript-first, session-service-driven preview generation rather than a premium creative study loop.
  - `backend/src/edit-sessions/service.ts`
- The director/orchestrator is still dominated by procedural heuristics and deterministic scatter, not a mature creative control system.
  - `backend/src/director/orchestrator.ts`
  - `backend/src/director/joseph-director.ts`
  - `backend/src/director/judgment-layer.ts`
  - `backend/src/director/sequence-memory.ts`
- The repo already has proof scripts for determinism and variation, which means the next architecture should preserve reproducibility instead of abandoning it.
  - `scripts/verify-determinism.ts`
  - `scripts/verify-variation.ts`

### Current Diagnosis

The current system is not "broken" in the simple sense.

It is constrained by the wrong ceiling.

The main limiting factors are:

1. The current director is too shallow.
   It creates cuts, text overlays, camera moves, transitions, and SFX from deterministic phrase logic, but it does not possess a robust visual grammar for premium editing.

2. The creative layer is under-primitive'd.
   The current Joseph surface has a valid render path, but not a sufficiently rich library of animation primitives, typographic behaviors, picture-in-picture rigs, shader families, or spatial composition systems.

3. The preview loop is still too slow and too backend-mediated for elite iteration.
   MP4 proof loops exist, but a study loop for rapid orchestration comparison, scoring, and visual debugging is still underpowered.

4. The LLM question is unresolved at the architecture level.
   The codebase already has prompt governance, but there is not yet a fully mature separation between:
   - semantic extraction
   - visual planning
   - primitive selection
   - timing choreography
   - final render enforcement

5. The current quality layer is still mostly a floor, not a creative evaluator.
   `judgment-layer.ts` is good at rejecting obvious regressions and structural violations, but it is not yet a full editorial scoring system for eye-trace, spatial restraint, motion elegance, premium hierarchy, or micro-animation appropriateness.

### What This Plan Assumes

This roadmap assumes the following design stance:

- LLMs should not be trusted as direct video directors.
- LLMs may still be useful as bounded semantic analyzers, labeling engines, retrieval assistants, and planning aides.
- Premium editing behavior should be driven by a controlled orchestration stack built from primitives, scoring systems, rules, and measured feedback loops.
- Determinism is an asset, not a burden.
- Fast preview is not optional. It is a first-class system requirement.
- Micro-animation is its own strategic program.
- Picture-in-picture is its own strategic program.
- Replacing or redesigning the LLM/orchestration system is its own strategic program.
- Oversight, scoring, and study loops are their own strategic program.

### North Star

The north star is not "AI made a flashy vertical video."

The north star is:

- a system that can generate multiple credible premium editorial candidates
- preview them quickly
- make disciplined selection decisions
- explain why one candidate is better than another
- and evolve through measurable study rather than vague prompting

### Delivery Philosophy

This roadmap uses large, independent programs rather than pretending all work fits into one implementation batch.

Each program below should become its own initiative with its own acceptance proofs, internal batches, and visual review discipline.

## Program 1: Fast Feedback Studio

### Why this program exists

This is the most leverage-rich program in the entire plan.

If the preview loop stays slow, every other improvement will be bottlenecked by blind iteration.

The system needs a live study surface where we can:

- preview orchestration instantly
- compare multiple candidates side by side
- scrub time quickly
- isolate failures in motion, typography, SFX, PiP, and composition
- score variants without exporting MP4s for every iteration

### Current state

The repo already has the building blocks:

- Remotion composition surfaces in `remotion-app/src/Root.tsx`
- Joseph-only entry point in `remotion-app/src/entries/joseph-entry.tsx`
- preview/session machinery in `backend/src/edit-sessions/service.ts`
- studio-style fixture compositions and dev fixtures

But the current feedback loop is still split across:

- backend session generation
- preview manifest generation
- worker render proofs
- occasional full MP4 validation

This is useful, but it is not yet a real creative lab.

### Target state

Build a dedicated "Joseph Study Studio" that supports:

- candidate manifest carousel
- side-by-side A/B/C/D preview
- timeline scrubbing
- overlay toggles for cuts, motion cues, SFX, text density, and camera directives
- typography debug view
- primitive debug view
- eye-trace debug overlay
- motion heatmap overlay
- candidate scoring panel
- one-click freeze-frame export

### Batches

#### Batch 1A: Joseph Study Surface

Create a dedicated browser-first preview route for Joseph manifests and variants.

Outcomes:

- a Joseph-specific study route
- no need to run full export to inspect composition choices
- direct loading of generated candidate manifests
- deterministic fixture mode and live manifest mode

#### Batch 1B: Variant Comparison Console

Add multi-lane comparison so multiple orchestrations can be reviewed in one screen.

Outcomes:

- A/B/C/D candidate comparison
- synchronized playback and scrub
- lockstep frame stepping
- quick winner tagging

#### Batch 1C: Diagnostic Overlay System

Expose what the system thinks it is doing.

Outcomes:

- show active cut windows
- show text salience decisions
- show SFX triggers
- show camera-move ranges
- show primitive IDs and parameters
- show motion-risk warnings

#### Batch 1D: Human Scoring Harness

Turn the preview surface into a real review station.

Outcomes:

- manual winner selection
- failure tags
- notes on typography, micro-animation, PiP, pacing, and spatial focus
- archival of decisions for later evaluator training

### Acceptance proof

- We can inspect at least 12 candidate edits in under 10 minutes without exporting 12 MP4s.
- We can freeze any frame and understand exactly which primitives and decisions produced it.
- We can compare orchestration failures visually instead of inferring them from code or logs.

## Program 2: Orchestration System Redesign

### Why this program exists

The current orchestration stack is too narrow to carry the standard you want.

`backend/src/director/joseph-director.ts` is a valid deterministic generator, but it is still mostly:

- phrase segmentation
- profile tuning
- seeded timing
- heuristic text selection
- cut placement
- camera move placement
- transition placement
- SFX placement

That is useful scaffolding.

It is not yet a premium visual conductor.

### Target state

The orchestration system should be split into five distinct layers:

1. Semantic extraction layer
2. Visual planning layer
3. Primitive composition layer
4. Temporal choreography layer
5. Quality judgment layer

The key architectural change is this:

The LLM does not choose animations directly.

The LLM, if used at all, produces bounded semantic and rhetorical structure.

The real creative system is a planner plus primitive library plus evaluator.

### Batches

#### Batch 2A: Demote The LLM

Redefine what LLMs are allowed to do.

Allowed:

- semantic segmentation
- rhetorical labeling
- tone labeling
- scene-intent labeling
- object/subject/entity extraction
- retrieval suggestions

Not allowed:

- direct timing authority
- direct primitive code generation
- direct camera path generation
- direct shader authoring at runtime
- direct final edit authority

#### Batch 2B: Build A Visual Planning Snapshot

Create an explicit intermediate representation between semantics and rendering.

This planning snapshot should include:

- emotional arc
- rhetorical arc
- speaker emphasis map
- energy envelope
- visual density plan
- attention anchor map
- focal-surface map
- primitive affordance shortlist
- PiP opportunities
- micro-animation opportunities
- asset layering opportunities

#### Batch 2C: Primitive Composition Planner

Instead of "generate manifest straight from transcript," create a planner that assembles shots from reusable visual parts.

The planner should output:

- shot structures
- active primitives
- text treatment family
- background treatment family
- motion doctrine
- subject framing doctrine
- focus anchor
- transition intent

#### Batch 2D: Temporal Choreography Engine

Separate timing choreography from primitive selection.

This engine should govern:

- phrase entry timing
- word timing
- letter timing
- secondary motion timing
- SFX timing
- camera motion timing
- background rhythm timing
- anti-chaos spacing

#### Batch 2E: True Editorial Evaluator

Replace the current mostly-floor-based judgment layer with a fuller editorial scoring layer.

New scoring dimensions should include:

- eye-trace continuity
- focal stability
- hierarchy clarity
- typography elegance
- motion restraint
- climax handling
- micro-animation appropriateness
- PiP coherence
- background/foreground interference
- audio/visual sync quality
- premium finish score

### Acceptance proof

- The system no longer routes semantic input directly to final visual directives in one leap.
- We can inspect the planning snapshot independently from the final manifest.
- Two candidates can share the same semantic analysis but differ meaningfully in visual orchestration.

## Program 3: Micro-Animation Primitive Library

### Why this program exists

This must be its own strategic program.

The current system does not yet have the breadth of primitive vocabulary required for premium editorial micro-animation.

The user requirement here is explicit:

- do not bury this under a generic animation batch
- treat it as a serious standalone program
- build it from study of reference behavior

### Current state

The current Joseph layer uses a relatively small set of text animation modes:

- `pop`
- `slide_up`
- `glitch`
- `typewriter`
- `elastic_scale`

This is not enough.

### Target state

Build a true micro-animation library with parameterized primitives grouped by function, not by one-off effect names.

### Research phase

Before implementation, run a reference study phase:

- study Joseph edit outputs
- collect clips
- segment repeated primitive behaviors
- identify naming system
- separate true primitives from one-off compositions
- note timing signatures
- note anchor behavior
- note coexistence rules
- note text hierarchy behavior

### Primitive families to build

#### Text emphasis primitives

- underline reveal
- sweep highlight
- capsule highlight
- matte highlight
- marker stroke emphasis
- pulse emphasis
- semantic glow emphasis

#### Text entry primitives

- word riser
- letter riser
- soft letter tracking reveal
- Apple-style letter spread
- horizontal tension reveal
- elastic pop-in
- velocity slide reveal
- clipped mask reveal

#### Text mutation primitives

- word swap
- weight escalation
- scale pulse
- color inversion
- emphasis handoff
- semantic spotlight

#### Supporting accent primitives

- line sweep
- bracket lock
- cursor sweep
- anchor dot
- emphasis arrow
- caption rail
- callout tether

#### Spatial micro-motion primitives

- anchored drift
- soft parallax float
- focal bounce
- anti-static idle movement
- foreground shimmer

### Batches

#### Batch 3A: Reference Study and Primitive Taxonomy

Deliverable:

- a documented primitive taxonomy
- naming conventions
- examples
- anti-patterns
- usage conditions

#### Batch 3B: First 12 Premium Text Primitives

Deliverable:

- 12 high-confidence primitives with parameters
- deterministic runtime behavior
- visual test cases

#### Batch 3C: Primitive Combination Grammar

Deliverable:

- allowed combinations
- forbidden overlaps
- cooldown logic
- mutual exclusion logic
- hierarchy-aware stacking

#### Batch 3D: Micro-Animation Scoring Rules

Deliverable:

- evaluator rules for overuse
- evaluator rules for monotony
- evaluator rules for semantic mismatch
- evaluator rules for spatial distraction

### Acceptance proof

- The system can produce multiple distinct premium text treatments from the same transcript segment without feeling templated.
- We can point to a named primitive catalog instead of vague animation styles.
- Primitive selection is inspectable and scoreable.

## Program 4: Picture-In-Picture Program

### Why this program exists

Picture-in-picture is not "just another layout option."

It is its own composition grammar.

It requires:

- subject framing logic
- background replacement logic
- depth layering logic
- text coexistence rules
- asset coexistence rules
- focus and eye-trace rules

### Target state

Build a robust PiP system that can support:

- speaker window over animated background
- speaker window over editorial asset board
- speaker window over shader field
- speaker window plus kinetic text
- speaker window plus supporting asset callout
- speaker window resizing and docking
- premium card treatments
- glass, matte, hard-edge, and editorial frame styles

### Batches

#### Batch 4A: PiP Composition Rig

Build the base rig:

- frame container
- depth hierarchy
- safe zones
- crop and fit behaviors
- docking positions

#### Batch 4B: PiP Motion Behaviors

Build behaviors such as:

- enter
- dock
- expand
- collapse
- handoff
- focus-shift

#### Batch 4C: PiP With Typography

Establish composition laws for text around PiP:

- where hero text can appear
- where support text can appear
- when PiP must shrink
- when PiP must exit
- how to protect readability

#### Batch 4D: PiP With Asset Boards And Background Systems

Enable:

- background graphics
- secondary asset inserts
- visual support cards
- motion graphic backplates

### Acceptance proof

- PiP scenes feel intentionally composed rather than layered on top of an existing full-screen template.
- The system can maintain a clear viewer focus anchor while PiP, text, and background motion all coexist.

## Program 5: Visual Primitive and Background Systems

### Why this program exists

A premium Joseph-like result cannot rely only on text and the main source video.

The system needs a serious library of visual surfaces it can call upon.

### Target state

Build structured, reusable visual primitives for:

- shader backgrounds
- abstract light fields
- particle atmospheres
- editorial backplates
- device frames
- boards
- data surfaces
- vignette surfaces
- focus tunnels
- accent geometry

### Important principle

The runtime should not generate raw GLSL from scratch during orchestration.

Instead:

- create a curated primitive set
- expose parameters
- choose among them intelligently
- compose them

### Batches

#### Batch 5A: Background Primitive Catalog

Document and implement the background system families.

#### Batch 5B: Parameter Governance

Expose safe parameters:

- color family
- speed
- noise intensity
- bloom intensity
- distortion amount
- contrast level
- density

#### Batch 5C: Layering Rules

Define how backgrounds interact with:

- PiP
- text
- source footage
- overlays

### Acceptance proof

- The system can create materially different premium scenes without requiring a different composition component every time.

## Program 6: Typography Intelligence 2.0

### Why this program exists

The font compatibility and runtime delivery work is now much healthier, but premium typography is not solved by font retrieval alone.

The missing piece is editorial typography intelligence.

### Current state

The repo is stronger on:

- local font runtime resolution
- hero fallback
- hydration
- materialization

But weak on:

- lexical hierarchy
- filler-word treatment
- phrase-weight staging
- multi-line rhythm
- semantic emphasis composition

### Target state

Build typography intelligence that can govern:

- word importance scoring
- filler-word suppression
- line break elegance
- case treatment
- font pairing behavior by context
- weight switching
- line hierarchy
- semantic contrast
- spatial placement

### Batches

#### Batch 6A: Lexical Weighting Engine

Score every word by:

- semantic density
- rhetorical force
- emphasis confidence
- phrase role
- visual suitability

#### Batch 6B: Typography Composition Rules

Rules for:

- all caps versus sentence case
- supporting words versus power words
- small words versus anchor words
- stacked lines versus distributed lines
- typographic restraint

#### Batch 6C: Typography Stylebooks

Create named stylebooks for:

- aggressive authority
- premium cinematic
- sleek product
- restrained editorial

#### Batch 6D: Typography Evaluator

Judge:

- clutter
- weak hierarchy
- cheap emphasis
- overcapitalization
- broken line rhythm
- insufficient contrast

### Acceptance proof

- The system can clearly distinguish between support words and hero words.
- Typography no longer looks like generic transcript text with random animation.

## Program 7: Audio-Visual Choreography Program

### Why this program exists

The audio path is stronger, but premium audiovisual choreography is more than syncing cuts to beats.

It needs a real model for:

- anticipation
- release
- silence
- carry-through
- tension build
- accent hierarchy

### Target state

Build a choreography system that governs:

- cut timing
- camera timing
- text entry timing
- SFX timing
- background changes
- climax pacing
- breath windows

### Batches

#### Batch 7A: Choreography Vocabulary

Define named timing doctrines such as:

- punch
- hold
- bloom
- ratchet
- glide
- suspend
- detonate

#### Batch 7B: Temporal Segment Scoring

Score transcript/audio windows for:

- hook
- setup
- revelation
- escalation
- release
- CTA

#### Batch 7C: Choreography Engine

Generate timing structure from those segment classes.

#### Batch 7D: Choreography Evaluator

Judge:

- flat pacing
- overcutting
- climax overspend
- dead zones
- non-musical emphasis

### Acceptance proof

- The system can produce edits that feel intentionally staged around momentum rather than merely snapped to beats.

## Program 8: Oversight and Review System

### Why this program exists

If the system is going to evolve toward elite output, it needs a formal oversight loop.

Right now, there are proof loops and tests.

Those are necessary.

They are not enough.

### Target state

Build an oversight system that captures:

- candidate manifests
- preview renders
- review verdicts
- failure tags
- winning rationales
- primitive usage statistics
- recurring defects

### Batches

#### Batch 8A: Failure Taxonomy

Create a failure taxonomy for:

- bad eye-trace
- clutter
- weak PiP composition
- dead micro-animation
- over-animation
- under-animation
- cheap typography
- audio mismatch
- spatial incoherence
- climax waste

#### Batch 8B: Review Artifact Ledger

Persist:

- candidate metadata
- review scores
- screenshot references
- notes
- chosen winners

#### Batch 8C: Regression Gallery

Build a gallery of:

- good examples
- bad examples
- fixed failures
- benchmark references

### Acceptance proof

- We can answer "why is this candidate worse?" with structured evidence rather than vibes alone.

## Program 9: Issue-Ready Batch Conversion

### Why this program exists

This plan is intentionally long and strategic.

It should not be implemented as one giant ticket dump.

The correct next move after approval is to convert each program into independently grabbable vertical slices.

That is where the `to-issues` skill becomes useful.

### Conversion rule

Do not create horizontal tickets like:

- backend work
- frontend work
- animation work
- LLM work

Instead create vertical slices like:

- Joseph study surface can load and compare 4 manifests side by side
- PiP rig can render speaker window plus hero text plus background primitive
- lexical weighting engine drives support-word suppression in one preview lane
- evaluator can flag eye-trace drift on candidate comparison

### Suggested issue program order

1. Fast Feedback Studio
2. Orchestration System Redesign
3. Micro-Animation Primitive Library
4. Picture-In-Picture Program
5. Typography Intelligence 2.0
6. Audio-Visual Choreography Program
7. Oversight and Review System
8. Background Primitive Program

## Dependency Graph

Some programs are independent.

Some are not.

### Hard dependencies

- Program 1 unlocks the iteration speed needed for Programs 2 through 8.
- Program 2 must define planner boundaries before Program 3 and Program 4 can be orchestrated well.
- Program 3 and Program 4 depend on Program 2's primitive composition planner.
- Program 8 depends on Program 1, because good oversight requires fast and inspectable preview.

### Soft dependencies

- Program 6 can start early because typography intelligence can evolve in parallel with orchestration redesign.
- Program 7 can start in parallel with Program 3 after the temporal interfaces are defined.
- Program 5 can start in parallel with Program 4 after primitive governance is agreed.

## Recommended Execution Order

### Phase 1: Unblock iteration

- Program 1: Fast Feedback Studio

### Phase 2: Fix the brain

- Program 2: Orchestration System Redesign
- Program 8: Oversight and Review System

### Phase 3: Build premium vocabulary

- Program 3: Micro-Animation Primitive Library
- Program 4: Picture-In-Picture Program
- Program 5: Visual Primitive and Background Systems
- Program 6: Typography Intelligence 2.0
- Program 7: Audio-Visual Choreography Program

### Phase 4: Convert to long-running issue streams

- Program 9: Issue-Ready Batch Conversion

## What Should Not Be Done

To protect quality, the following should be explicitly avoided:

- Do not let an LLM directly author runtime shader code on demand.
- Do not let an LLM directly choose final timings without planner constraints.
- Do not keep using slow MP4 render loops as the main creative study surface.
- Do not bury micro-animation inside a generic animation batch.
- Do not bury PiP inside a generic layout batch.
- Do not confuse deterministic scaffolding with a complete creative system.
- Do not convert this plan into broad horizontal tickets.
- Do not treat the current judgment layer as a complete evaluator.

## The Honest Standpoint

The repo is in a much better state than a raw broken prototype.

It already has:

- a verified Joseph render lane
- stronger audio mixing
- stronger font runtime behavior
- deterministic proof scripts
- a real orchestration surface
- preview/session machinery

What it does not yet have is the level of creative system design required for elite editorial output.

That gap is real.

It is not a one-file fix.

It is a set of substantial programs, each of which deserves focused treatment.

## Recommended Immediate Next Move

The next best move is not to implement random pieces from this document.

The next best move is:

1. approve this master plan structure
2. choose Program 1 as the first execution stream
3. convert Program 1 into issue-ready vertical slices
4. only then begin implementation

That sequence gives the highest leverage, because once the feedback loop becomes fast and visual, every later program becomes easier to design, test, and judge.
