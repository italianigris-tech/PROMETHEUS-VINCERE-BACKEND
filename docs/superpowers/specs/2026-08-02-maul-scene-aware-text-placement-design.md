# MAUL Scene-Aware Text Placement Design

Date: 2026-08-02

Status: Approved in conversation; awaiting written-spec review

## Summary

MAUL will turn governed transcript chunks into stable, readable, reference-derived
text layouts for English 9:16 short-form video. MediaPipe supplies versioned subject
observations; separate adapters supply scene and visual-field evidence. None chooses
typography, coordinates, crop, or depth. A deterministic placement planner combines
those observations with the Editorial Timeline, portrait framing, platform reserves,
text metrics, semantic roles, and presentation intents.

Placement is selected from curated parametric layout families. Hard constraints
reject unsafe candidates before aesthetic ranking. A short sequence search chooses a
coherent path across nearby chunks without smoothing geometry across cuts.

Placement V1 ships front-plane layouts. Behind-subject intent is represented but is
`accounted-deferred` until MAUL has a frame-locked matte contract, staging path, and
pixel-level render proof. Existing Joseph RVM infrastructure is reusable evidence,
not an implicit MAUL capability.

## Problem

The current MAUL renderer knows when governed caption chunks should appear, but it
does not know where each chunk belongs. It renders all chunks in one hard-coded,
centered lower-screen card. The current Media Analysis contract accepts caller-
supplied speaker boxes and shots, averages them into one output-long crop, and does
not use shot boundaries for smoothing or placement.

The requested experience needs placement that:

- respects the principal speaker, face, gesture, platform UI, and final portrait crop;
- remains stable within a shot but resets at jump cuts and editorial joins;
- supports one through eight words with measured, semantic line partitions;
- reserves bounds for treatments and later animation, including number count-ups;
- follows approved traits from the supplied reference corpus without copying creator
  identity, assets, or exact compositions;
- falls back visibly and safely when visual evidence is missing or ambiguous; and
- emits a replayable plan that Remotion executes without making editorial choices.

## V1 Scope

### Included

- English text only.
- Exactly 1080x1920 at 30 fps, matching the live MAUL manifest. Layout coordinates
  remain normalized, but other output sizes are not claimed as V1 capabilities.
- One principal-speaker talking-head or podcast source, with optional B-roll.
- TikTok, Instagram Reels, and YouTube Shorts safe-zone profiles.
- Source shot cuts and Editorial Timeline discontinuities as hard boundaries.
- PySceneDetect shot-boundary observations over an FFmpeg/PyAV timestamp-preserving
  decode, behind a provider interface.
- MediaPipe face and pose observations behind a separate provider interface.
- Principal-subject tracking states, coverage, confidence, and missingness.
- Output-space subject and gesture exclusion regions after portrait framing.
- Separately versioned field observations for brightness, contrast, edge density,
  existing text, and protected salient objects or logos.
- Curated parametric layout families for governed one-to-eight-word chunks.
- Actual font measurement, line partitioning, minimum readable size, and motion bounds.
- Minimal legibility primitives: solid contrast plate, outline, and shadow, each with
  measured bounds and Render Contract proof.
- Deterministic numeric presentation intents for rhetorically important numbers.
- Three-to-five-chunk sequence-aware placement selection.
- Governed fallbacks, artifacts, audit reasons, and Render Contract Tests.
- Backward compatibility through an explicit adapter for versioned legacy manifests
  created before Placement Plan support.

### Excluded From Placement V1

- Multilingual and right-to-left shaping, line breaking, and locale formatting.
- Generic multi-speaker panel editing or identity switching.
- LLM-generated pixel coordinates or unconstrained layout generation.
- Final count-up, kinetic typography, expressive treatment, or transition execution.
  Placement V1 includes only the minimal legibility primitives listed above; gradients,
  highlights, circles, underlines, masks, and decorative treatments remain excluded.
- MAUL behind-subject compositing and RVM extraction orchestration.
- Automatic upload-to-AssemblyAI wiring. Placement starts from an authoritative
  Editorial Timeline and Text Chunk Plan.
- Learned placement ranking. V1 gathers review labels for later evaluator staging.

The excluded features have explicit seams. They do not silently masquerade as live
capabilities.

Optional B-roll already baked into the source is covered by the source observation.
Inserted B-roll selected by a Visual Plan is placement-eligible only when that exact
asset has its own Visual Observation and compiled output transform. Without both,
ordinary overlays on its pixels are ineligible; only the padded non-source caption
band or a blocked result is allowed.

### Relationship To The Existing Layout Plan

This design supersedes the placement-specific architecture and acceptance details in
`docs/superpowers/plans/2026-08-01-shorts-text-layout-planning.md`. It preserves that
plan's order of chunking, placement, treatment, and animation; its accountability and
under-30-second preview goals; and its requirement to prove a small vertical slice
before expanding the catalog.

Implementation therefore starts with three foundational families (`measured`,
`editorial`, and `personal`) carried through schemas, planning, manifest compilation,
Remotion, and visual proof. The larger reference-derived catalog is a later V1 slice,
not a prerequisite for the first testable placement MVP.

## Approaches Considered

### 1. One Weighted Coordinate Score

Generate arbitrary boxes across the frame and select the highest weighted sum.

Rejected because a mathematically strong result can still be aesthetically poor. A
large negative-space score could compensate for covering a mouth, using an unreadable
font size, or bouncing between anchors. It also encourages tuning weights to a small
reference set rather than encoding editorial invariants.

### 2. Curated Candidates, Hard Gates, Then Sequence Ranking

Generate only reference-derived parametric layouts. Reject candidates that violate
truth, readability, subject protection, platform reserves, font fit, or depth
eligibility. Rank survivors and choose a coherent short-horizon sequence.

Selected. This keeps design knowledge in inspectable template families, makes safety
non-negotiable, and still permits controlled variation.

### 3. End-to-End Multimodal Visual Planner

Send frames and transcript chunks to a vision model that returns layouts.

Deferred. It may later serve as an advisory critic or high-risk reranker, but it is
too opaque for V1 authority, expensive to evaluate, and difficult to guarantee across
every rendered frame.

## Governing Principles

1. MediaPipe observes; it does not edit.
2. Missing detection means `unknown`, never empty negative space.
3. Source observations and derived output composition remain separate artifacts.
4. No smoothing, interpolation, or tracking hold crosses a discontinuity.
5. Placement is stable for a Layout Interval, not reactive every frame.
6. Hard gates run before any aesthetic score.
7. Scoring chooses among credible designs; it does not create design.
8. The renderer executes the manifest and does not invent fallback placement.
9. Dialogue captions use a readable fallback or return an explicit blocked placement;
   the system never approves unreadable text. Optional editorial overlays may be
   withheld when no valid placement exists.
10. Behind-subject eligibility requires a verified matte; desire is not capability.

## Domain Artifacts

### Standalone Text Chunk Plan

Placement introduces a first-class `maul-shorts-text-chunk-plan/v2` artifact before
typography planning. It carries stable token IDs, output timing, protected entity spans,
Protected Pause policy, roles, emphasis, inference receipt, input hashes, and exact
coverage. The Typography Motion Plan references its artifact ID and payload hash; it
does not own or embed the authoritative plan.

The current nested V1 `textChunkPlan` field is accepted only through an explicit legacy
adapter that materializes and validates the standalone artifact before placement. If a
nested projection remains during migration, its hash must equal the standalone payload
or compilation fails. This removes the current chunk-plan/typography dependency cycle.

### Visual Observation

An immutable Media Analysis artifact derived from source media. It contains separately
versioned observation channels with separate authority. The first shot-boundary adapter
uses PySceneDetect over an FFmpeg/PyAV timestamp-preserving decode. The first subject
adapter uses MediaPipe face and pose. MediaPipe never declares cuts, and PySceneDetect
never identifies the principal subject or chooses placement. Both contracts remain
provider-neutral.

The artifact has five independent channels: `shot_boundaries`, `subject`, `field`,
`existing_text`, and `saliency`. Each channel records `available`, `degraded`,
`unknown`, or `unavailable`; provider and model fingerprints; configuration and policy
IDs; requested source interval; PTS coverage; confidence; and missing spans. One
channel's success never implies another channel succeeded.

Required shared fields include:

- schema version, source asset ID, source SHA, and source dimensions;
- decoded orientation, mirroring, sample aspect ratio, and variable-frame-rate facts;
- actual source PTS and frame identity for every sample; and
- decoded and sampled frame counts, analysis wall time, and warnings.

Channel-specific fields include:

- source-space hard-cut instants, gradual-transition spans, confidence, and guard
  frames from the shot-boundary provider;
- principal-subject association and ambiguity state;
- face, upper-body, and gesture envelopes in normalized source coordinates;
- tracking state: `tracked`, `held`, `lost`, `ambiguous`, `unknown`, or
  `absent_confirmed`;
- detector confidence, confidence decay, coverage, and missing spans;
- background luminance, contrast, and edge-density grids;
- text-detector or OCR occupancy regions with confidence; and
- caller-verified or detector-observed salient-object and logo regions.

`absent_confirmed` is allowed only for a scene classified as known B-roll or another
verified no-principal-subject scene by the Editorial Timeline or asset metadata. A
failed face detection is `lost` or `unknown`. Unavailable existing-text or saliency
evidence is also `unknown`; it never licenses placement over a likely subtitle, logo,
or focal-object region.

### Output Composition Track

A deterministic derived artifact owned by the Output Composition compiler and consumed
later by the Manifest Compiler. It fuses:

- Visual Observation;
- Editorial Timeline timestamp mapping;
- source shot boundaries and editorial joins;
- Framing Camera Plan and portrait crop;
- output dimensions; and
- selected platform safe-zone profile.

Each output interval carries:

- scene and discontinuity IDs;
- output start and end time;
- active visual asset ID and that asset's Visual Observation hash;
- complete source-to-output transform, including autorotation, mirroring, sample
  aspect ratio, crop, scale, camera easing, frame quantization, and source/output PTS
  conventions;
- output-space face, body, and gesture exclusion regions;
- stable subject occupancy envelope across the interval;
- known candidate negative-space regions;
- local contrast and clutter summaries;
- platform UI reserves; and
- evidence confidence and fallback state.

For inserted B-roll, the transform maps that B-roll asset into output space. Source
observations cannot authorize placement over another asset's pixels.

The compiler may emit a primary composition and a prevalidated
`caption_safe_fallback` composition that reframes or pads the source without violating
the portrait policy. Placement may select between compiled compositions; it cannot
invent a crop. When neither composition can support readable mandatory dialogue, the
result is `blocked_no_readable_dialogue_candidate`.

Every fallback composition marks source-image occupancy and any padded non-source text
band. Unknown subject evidence may use only a fallback whose text box lies wholly in
that non-source band; a reframe alone cannot prove subject clearance.

The placement planner and renderer must use the same compiled transform. A plan cannot
claim subject clearance against one crop while Remotion renders another.

For new manifests, the Output Composition Track is the only renderer-facing crop and
camera authority. The compiler consumes and reconciles legacy `speakerCropTracks` plus
the Framing Camera Plan; Remotion may not read those competing inputs directly. An
explicit adapter translates an old manifest into one track before rendering.

### Token Identity

Transcript word indices are local to one governed transcript or selected candidate;
they are not global source indices. Every timed word receives a stable token ID from
`transcriptHash + originalTranscriptWordIndex` before filtering or output-time mapping.
Chunk, entity, line, and render records refer to those token IDs and separately retain
source and output timing. This prevents candidate-local index `0` from being mistaken
for source word `0` and preserves identity across removed-time joins.

### Source Entity Fact

A deterministic annotation pass runs before chunking and attaches indivisible entity
spans to stable transcript token IDs. The Text Chunk Planner receives those spans and
may not split a multi-token entity. V1 recognizes:

- currency;
- percentage;
- plain quantity;
- measurable result with an explicit source-supported unit;
- year or date;
- duration;
- range;
- ratio or multiplier;
- ordinal or ranking;
- list count;
- phone-like identifier; and
- opaque identifier.

Each Source Entity Fact records stable token IDs, original transcript indices, exact
source text, parsed value and unit when unambiguous, semantic kind, and parse
confidence.

Entity spans of eight tokens or fewer are indivisible. A longer phone-like or opaque
identifier becomes `oversized_static_identifier`: chunking may divide it into ordered
one-to-eight-token static fragments linked by one continuation ID. Those fragments are
never eligible for canonical replacement, count-up, or hero treatment.

### Presentation Intent

After chunking, a deterministic compiler combines Source Entity Facts with chunk role,
emphasis, dwell time, and Sequence Memory. It records eligible treatment classes and
the required maximum layout bounds.

Count-up eligibility requires all of the following:

- numeric kind is currency, percentage, plain quantity, or measurable result;
- the chunk marks the number `key` or `hero`;
- sufficient display time exists;
- exact final formatting is source-supported;
- the deterministic numeric formatter supplies either tabular numerals or measured
  bounds for the widest formatted start, intermediate, and final state;
- sequence repetition budget permits it; and
- no stronger concurrent visual event owns attention.

Years, dates, ranges, phone-like identifiers, and IDs never use ordinary zero-to-value
count-up. They use a static, stamp, digit-roll, range, or minimal fallback intent.

Dialogue text always preserves exact transcript tokens. When an unambiguous numeric
fact is rhetorically important, Presentation Intent may additionally emit a
`source_equivalent_numeric_overlay` with source token IDs, parsed value and unit,
canonical display text, and `sourceEquivalent: true`. This overlay may visually replace
only those mapped dialogue tokens; it is not dialogue rewriting and cannot add a value,
unit, precision, or claim absent from the source. Ambiguous parsing uses exact static
transcript text.

### Typography Compatibility Profile

Placement happens before visual treatment, but geometry still needs trustworthy text
metrics. A versioned Typography Compatibility Profile resolves this dependency. It
contains an approved font set for each semantic role, the worst-case measured glyph
and line metrics across that set, allowed size and line-height ranges, and one loaded
fallback asset.

The Placement Planner owns line partition, role assignment, nominal scale, and the
reserved worst-case metrics envelope. The existing Typography Motion Plan remains the
owner of exact font asset, weight, and treatment. It may select only an asset inside
the chosen compatibility profile. The Manifest Compiler verifies the exact selected
font against the reserved envelope; mismatch rejects compilation and triggers a
declared replan or fallback. It also verifies that the Typography Motion Plan provides
the Placement Plan's required minimum legibility primitive and parameters. Neither
artifact duplicates the other's authority.

### Attention Occupancy Track

A deterministic pre-placement track compiles the Editorial Beat Map, Visual Plan,
shared attention budget, camera events, and already planned graphic occupancy into
output intervals. Each interval records the current dominant event owner, protected
visual regions, allowed concurrent event count, and whether numeric or hero text may
own attention. Placement may consult this track but cannot rewrite it. If the track is
unavailable, count-up and other optional dominant overlays are ineligible; ordinary
dialogue placement continues through conservative fallbacks.

### Text Placement Plan

The governed planner output. Each Text Chunk Plan chunk has one or more Layout
Segments when it intersects cuts or editorial discontinuities.

Each segment records:

- chunk ID, scene ID, and output interval;
- selected composition variant ID and exact Output Composition Track transform hash;
- template family and variant ID;
- stable token IDs assigned to each rendered line;
- normalized output-space box and alignment;
- typography compatibility profile ID, reserved-metrics fingerprint, nominal size,
  allowed line-height range, and hierarchy scale;
- desired z intent: `front` or `behind_subject_requested`;
- resolved render z intent: `front` or `front_fallback` (V1 never emits executable
  behind-subject placement);
- static bounds and maximum treatment/animation envelope;
- required minimum legibility primitive (`none`, `outline`, `shadow`, or
  `solid_plate`) plus its measured minimum parameters;
- platform profile and safe-zone version;
- hard-gate results and dimension scores;
- selected path rationale and confidence;
- fallback code and reason; and
- desired depth treatment state, including `accounted-deferred`.

Composition selection is scene-level. All segments inside one continuity scene use the
same primary or caption-safe composition. A change is allowed only at a hard
discontinuity or an explicit preplanned camera transition with the configured minimum
dwell. If no one compiled composition supports all mandatory dialogue in that scene,
the scene is blocked rather than switching framing on successive chunks.

### Layout Interval

A Layout Interval is the maximal non-empty intersection of one Text Chunk Plan display
interval, one mapped source shot, one Editorial Timeline continuity span, and one
continuous output composition interval. Every hard cut, gradual-transition guard span,
removed-time join, explicit transition, identity change, or discontinuous crop
transform ends the interval.

A chunk crossing a boundary therefore receives separate Layout Segments on each side.
The chunk's authoritative words remain unchanged and its segment time ranges are
half-open and non-overlapping. The same governed text may remain visible across the cut,
but candidate generation, tracking state, and placement geometry restart; no coordinate
or confidence value is interpolated through the boundary. A cut inside a timed word does
not duplicate or split that token. Both Layout Segments retain the chunk's token IDs,
while their non-overlapping time intervals control visibility. Any optional line
repartition covers the ordered token IDs exactly once within that segment.

A Protected Pause is continuous source time, not a geometry reset. The Text Chunk Plan
must not bridge one unless it explicitly marks `holdAcrossProtectedPause` from verified
rhetorical evidence. A segment shorter than the versioned minimum dwell policy remains
static-only; later animation compilation may not force an entry effect into that span.

## Orchestration

```text
Source video
  -> asynchronous shot-boundary observation (PySceneDetect + FFmpeg/PyAV PTS)
  -> asynchronous subject observation (MediaPipe)
  -> asynchronous field/text/saliency observations (separate adapters)
  -> versioned Visual Observation artifact
  -> Editorial Timeline and portrait Framing Camera Plan
  -> Output Composition Track

Timed transcript
  -> Source Entity Facts

Timed transcript + Source Entity Facts
  -> governed Text Chunk Plan

Source Entity Facts + Text Chunk Plan
  -> Presentation Intents

Font registry
  -> Typography Compatibility Profiles

Editorial Beat Map + Visual Plan + camera events + shared attention budget
  -> Attention Occupancy Track

Output Composition Track + Text Chunk Plan + Presentation Intents
  + Typography Compatibility Profiles + Attention Occupancy Track
  -> Layout Interval construction
  -> parametric candidate generation
  -> hard-gate validation
  -> short-horizon sequence selection
  -> Text Placement Plan

Text Placement Plan
  -> Typography Motion Plan selects exact compatible fonts and later treatments

Output Composition Track + Text Placement Plan + Typography Motion Plan
  -> Manifest Compiler
  -> Remotion execution
```

Visual extraction is asynchronous. Each observation channel is cached by source SHA,
requested source interval, extractor/model/config version, and orientation policy. The
Output Composition Track is cached separately by observation hash, Editorial Timeline
hash, Visual Plan hash, every active visual asset observation hash, Framing Camera Plan
hash, output profile, and platform profile. Placement is cached by those compiled
inputs plus chunk, intent, Attention Occupancy Track, typography-profile, catalog, and
score-policy hashes.

Preview and render consume persisted artifacts. They never initialize MediaPipe or
decode the full source on the request path.

## Scene And Tracking Policy

### Hard Discontinuities

A new discontinuity starts at:

- every detected source shot cut, including jump cuts;
- the guarded start and end of every detected gradual transition;
- every join produced by removed source time in the Editorial Timeline;
- every explicit clip or B-roll transition; and
- every principal-subject identity change.

Shot cuts come only from the declared shot-boundary provider. MediaPipe track jumps may
raise an ambiguity or identity-change signal, but they cannot manufacture a scene cut.

An independent residual-discontinuity guard compares adjacent decoded frames and track
state. A large perceptual-frame delta, impossible subject displacement, decoder PTS
jump, or crop-transform jump emits a conservative `geometry_reset` without claiming a
new semantic scene. Smoothing and holds reset on either a declared cut or this guard.
The V1 shot policy must reach 100% recall on mandatory synthetic hard/jump-cut fixtures
and at least 98% recall on the annotated acceptance corpus; failing either gate disables
subject-aware placement for that policy version.

Tracking filters, short-gap holds, placement continuity, and coordinate smoothing reset
at every discontinuity. Style continuity may carry when doctrine permits; geometry
does not.

### Within-Scene Tracking

- Decode one autorotated low-resolution stream sequentially using actual PTS.
- Run face plus pose evidence at an adaptive bounded sample rate.
- Associate the principal subject using continuity, size, confidence, and project scope.
- Apply robust outlier removal followed by scene-local smoothing and dead zones.
- Hold the last stable region only for a short same-scene dropout with confidence decay.
- Mark sustained loss, multiple-face ambiguity, or identity uncertainty explicitly.
- Build a conservative swept exclusion envelope over the full Layout Interval,
  including treatment and animation padding.

Sampling and tracking behavior is governed by a versioned policy containing maximum
sample gap, minimum usable coverage, confidence threshold, maximum same-scene hold,
confidence-decay curve, motion/velocity padding, cut guard frames, and ambiguity
timeout. These values are persisted with the observation and cannot be hidden runtime
constants. A subject-aware candidate is ineligible whenever policy coverage is not met.
The swept envelope unions observed regions and expands between samples by the maximum
policy-supported displacement; sparse samples never prove interval-wide clearance.

Text does not chase the speaker. If the subject crosses a candidate region during the
interval, that candidate fails or the planner selects a conservative fallback.

## Platform Safe Zones

Safe zones are versioned data, not hard-coded caption constants. V1 includes distinct
profiles for TikTok, Instagram Reels, and YouTube Shorts. Profiles reserve top chrome,
bottom caption/navigation space, right-side interaction rails, minimum edge margins,
and device crop tolerance.

An unknown or `other` platform uses the conservative intersection profile. The chosen
profile and version are stored in every Placement Plan.

## Layout Families

The first vertical slice implements three front-plane families: `measured`,
`editorial`, and `personal`. After that slice passes manifest and visual proof, the V1
catalog expands to twelve front-plane parametric families, not eighty independent
word-count templates. Families adapt line partitions, scale, and alignment from one
through eight words. Each family declares supported word counts; not every family must
accept every count. At catalog completion, a neutral clear-scene fixture must yield at
least ten materially distinct pre-gate variants for each word count from one through
eight, including one conservative fallback.

The expanded catalog includes:

- compact single-anchor keyword;
- small support line above a dominant keyword;
- two-level centered phrase stack;
- balanced two-line statement;
- focus-tail and accent-tail stacks;
- lower-chest dialogue hierarchy;
- subject-left/text-right negative-space layout;
- subject-right/text-left negative-space layout;
- centered gap layout for verified B-roll composition;
- restrained quote or serif-support layout;
- numeric hero layout with reserved widest-state bounds;
- conservative platform-safe caption plate.

Behind-subject desired variants are recorded as intent metadata and resolve to a front
fallback. They are not counted as an executable V1 family.

Line candidates use the chosen compatibility profile's worst-case measured metrics,
the longest rendered word, semantic phrase boundaries, emphasis token IDs, and
presentation intent. A five-word semantic chunk may render as 2+3, 3+2, 1+4, or
another supported partition without changing the Text Chunk Plan.

Approved reference screenshots calibrate template relationships and evaluator traits.
They do not become exact-coordinate presets or creator-identity replicas.

## Candidate Gates

Each evidence-dependent gate returns `pass`, `fail`, or `unknown`. `unknown` is never
treated as clearance: a candidate requiring that evidence is rejected. A candidate is
rejected before scoring when any rule fails or remains unknown:

- dialogue token sequence or reconstructed text differs from the governed tokens;
- text or maximum motion envelope crosses a platform reserve;
- text intersects protected eyes or mouth;
- front-plane text exceeds allowed face, body, or gesture overlap;
- executable behind-subject placement is requested in V1;
- the selected Typography Compatibility Profile or its worst-case measured metrics
  are unavailable;
- minimum readable size, maximum line count, or container fit fails;
- contrast remains insufficient after eligible outline, shadow, or plate fallback;
- existing burned-in text collision exceeds the allowed threshold;
- evidence is too uncertain for the requested subject-aware variant; or
- segment geometry spans a discontinuity.

Hard-gate failures cannot be offset by a higher aesthetic score.

## Sequence Selection

The planner ranks surviving candidates using separate inspectable dimensions:

- readability and information hierarchy;
- subject relationship and negative-space use;
- optical balance;
- reference-trait compatibility;
- semantic-role compatibility;
- continuity inside the current scene;
- intentional contrast after a cut;
- anti-repetition and placement-change budget;
- presentation-intent compatibility; and
- fallback cost.

It uses deterministic beam search over Layout Segment nodes, with an Adaptive Planning
Horizon of three to five segments or five to ten seconds, whichever ends first. A
stable segment ID derives from chunk ID, discontinuity ID, and output interval. A
stable candidate ID adds composition, family, and variant IDs. The path objective
prevents independent top-scoring choices from producing left-right-top-bottom
thrashing. Geometry and composition continuity reset on discontinuities, while
typography doctrine may deliberately echo across them.

All post-gate dimensions are normalized by a versioned score policy. The beam objective
records dimension weights, continuity and repetition penalties, beam width, and catalog
version. Equal objectives resolve lexicographically by segment ID then candidate ID,
making replay independent of iteration order.

No single weighted total can override truth, readability, or subject protection.

## Fallback Ladder

1. Stable subject track and valid open region: subject-aware template.
2. Brief same-scene dropout: last stable exclusion envelope with confidence decay.
3. Known subject but no open region: conservative platform-safe caption plate may
   overlap permitted lower-body/background regions while protecting face and UI.
4. Low contrast: measured V1 outline, shadow, or solid contrast plate.
5. Ambiguous subject, multiple faces, unknown B-roll, or incomplete cut coverage:
   select a precompiled `caption_safe_fallback` that places text in a padded non-source
   band and does not claim unverified subject clearance.
6. No readable dialogue fit in either composition: return
   `blocked_no_readable_dialogue_candidate` and close the export quality gate;
   optional editorial overlay is withheld.
7. Missing matte: behind-subject desire becomes front fallback and
   `accounted-deferred`; it never silently renders as verified depth.

Fallback selection remains deterministic and visible in the artifact.

## Renderer Contract

The Manifest Compiler carries the Output Composition Track and Text Placement Plan
into the MAUL Unified Short Render Manifest. Remotion must:

- use all time-varying crop intervals, not only the first crop;
- convert normalized plan coordinates through actual output dimensions;
- load the exact font owned by the Typography Motion Plan and verify its metrics fit
  the Placement Plan's compatibility-profile envelope before rendering;
- execute the required minimum legibility primitive exactly as compiled;
- honor exact line token IDs and hierarchy;
- render within the planned static and motion envelope;
- apply the declared front fallback when depth is `accounted-deferred`;
- expose plan IDs and fallback codes as testable render metadata; and
- preserve legacy fixed-caption behavior only through the explicit pre-placement
  manifest adapter.

That legacy behavior is limited to explicitly versioned pre-placement manifests. Every
new manifest version requires either a valid Placement Plan or an explicit blocked
placement result. A missing, malformed, stale, or hash-mismatched new plan fails closed;
it never enters the legacy hard-coded path.

Renderer code may fail closed on an invalid plan. It may not choose a new template.

## Failure Handling

- Any visual channel unavailable: persist that channel's state and use only candidates
  whose gates do not require the missing evidence.
- Scene detector unavailable: Editorial Timeline joins remain hard boundaries; treat
  shot coverage as unknown; disable tracking holds, spatial smoothing, negative-space
  inference, and subject-aware candidates. Use only the padded non-source
  `caption_safe_fallback` and record degraded evidence; block if it does not fit.
- Tracking ambiguity: do not infer negative space from missing subject evidence.
- Existing-text occupancy unavailable: treat likely subtitle bands conservatively and
  reject candidates that require proving those bands are empty.
- Exact font unavailable: use the loaded fallback asset declared by the compatibility
  profile and verify its metrics, or reject the candidate.
- Number parse ambiguous: preserve exact source text and use static treatment.
- Count-up duration too short: use static or minimal numeric emphasis.
- No placement fit: try the precompiled caption-safe composition; if it also fails,
  persist `blocked_no_readable_dialogue_candidate`, withhold optional overlay, and
  close the export quality gate.
- Provider timeout: analysis job records failure; preview/render never retry implicitly.
- Invalid or stale artifact hashes: reject planning and require explicit regeneration.

## Performance And Caching

- Analysis decodes sequentially, autorotates once, and operates on a reduced-resolution
  stream.
- Sampling is adaptive but bounded; cuts receive denser evidence than stable shots.
- MediaPipe inference runs out of process behind a pinned adapter contract.
- A deterministic cache index reuses observation payloads across planning variants;
  artifact records retain the repository's existing artifact-ID semantics.
- Analysis records wall time, decoded frames, sampled frames, coverage, failures,
  execution delegate, and peak memory when available.
- A 40-second source has a provisional p95 analysis budget of 15 seconds. Benchmark
  records must name the hardware profile, CPU/GPU delegate, input resolution, sampling
  policy, cold/warm state, and concurrency. No production latency claim is valid until
  that deployment profile is pinned. Exceeding the runtime budget selects the governed
  unavailable fallback until a valid artifact exists.

## Authority And Audit

- AssemblyAI or supplied transcript owns word text and timing.
- The standalone Text Chunk Plan artifact owns governed chunk boundaries, stable token
  references, roles, emphasis, and inference provenance.
- The Text Chunk Planner authors that artifact but cannot change transcript truth.
- Source entity annotation owns source-grounded entity spans and parsed facts.
- The Presentation Intent compiler owns treatment eligibility derived from entity facts
  plus chunk role, emphasis, and timing.
- PySceneDetect owns source shot-boundary observations only; FFmpeg/PyAV owns decoded
  source PTS and orientation evidence.
- MediaPipe owns face and pose observations only.
- Field, text, and saliency adapters own only their named observation channels.
- The Output Composition compiler owns coordinate transforms and safe regions.
- Typography Compatibility Profiles own the eligible font sets and worst-case metric
  envelopes used during placement.
- The Attention Occupancy compiler owns the read-only placement view of already planned
  dominant events and visual occupancy.
- The deterministic Placement Planner owns template, line partition, position,
  selection among precompiled composition variants, reserved metrics envelope, and
  front/deferred-depth intent.
- The Typography Motion Plan owns exact font assets, weights, and V1 legibility
  primitives. Expressive treatment remains a follow-on.
- The Manifest Compiler owns renderer handoff.
- Remotion owns execution only.

Every decision includes input hashes, versioned authority, rationale, hard-gate
findings, fallback state, and deterministic replay information.

## Testing Strategy

### Contract And Unit Tests

- schema acceptance and rejection for all new artifacts;
- standalone chunk-plan authority and legacy nested-plan hash parity;
- independent status, provenance, and missingness for every observation channel;
- active source or B-roll asset identity, observation hash, and transform agree for
  every Output Composition interval;
- Visual Plan and Attention Occupancy changes invalidate composition and placement
  cache keys respectively;
- source-to-output time and coordinate transforms;
- source cuts and Editorial Timeline joins create hard resets;
- no scene-local smoother crosses a reset;
- unavailable or incomplete cut coverage disables smoothing, holds, and subject-aware
  candidates;
- the residual-discontinuity guard resets geometry on missed-cut fixtures and shot
  policy recall meets the declared corpus gates;
- detector loss remains unknown and triggers confidence decay;
- stable token identity survives candidate filtering and output-time mapping;
- chunk/scene intersections, cuts inside words, and Protected Pauses produce the
  declared Layout Segments without token loss or geometry interpolation;
- numeric entity classification and count-up eligibility;
- multi-token numeric facts cannot be split, and source-equivalent numeric overlays
  preserve parsed value, unit, precision, and token provenance;
- oversized identifiers split into linked static fragments without canonical or hero
  treatment;
- exact line token coverage and no rewritten dialogue;
- worst-case compatibility-profile measurement, exact-font verification, long-word
  fitting, and motion-envelope fit;
- platform-specific reserves and conservative unknown-platform fallback;
- hard-gate precedence over aesthetic scores;
- deterministic sequence selection and anti-thrashing;
- sequence nodes and tie-breaks use stable Layout Segment and candidate IDs;
- composition variants persist through each continuity scene;
- fallback ladder behavior and audit codes; and
- legacy manifest compatibility without malformed-new-manifest fallback.

### Render Contract Tests

- a planned normalized box visibly changes rendered coordinates;
- selected composition variant and transform hash control the rendered crop;
- every time-varying crop interval affects the rendered source;
- text remains inside safe zones on every frame of bounded synthetic fixtures;
- face, gesture, and text regions do not collide on every synthetic frame, and corpus
  probes cover every observation PTS, motion extremum, transition guard, and segment
  boundary rather than only start, midpoint, and end;
- count-up-ready numeric bounds fit the widest start, intermediate, and final formatted
  value, or the program proves tabular-numeral equivalence;
- hard cut from subject x=0.25 to x=0.75 never renders x=0.50 smoothing;
- editorial silence joins reset geometry;
- tracker loss and multiple-face ambiguity render declared fallbacks;
- outline, shadow, and solid plate legibility fallbacks produce measured visible output;
- a Typography Motion Plan weaker than the required legibility primitive fails
  compilation;
- matte-unavailable desired depth renders front fallback with evidence; and
- preview and final rendering consume the same plan.

### Acceptance Corpus

The placement corpus includes:

- centered, left, and right talking heads;
- close, medium, and wide crops;
- portrait and landscape sources;
- hard cuts and same-subject jump cuts;
- removed-silence editorial joins;
- rapid lateral movement and large gestures;
- partial, profile, occluded, and offscreen faces;
- brief and sustained detector loss;
- multiple faces and known B-roll;
- dark, bright, low-contrast, and visually busy backgrounds;
- existing burned-in text;
- long words and every one-to-eight-word chunk size;
- currency, percentage, quantity, year, date, duration, range, and ranking;
- each V1 platform profile;
- variable frame rate and rotation metadata;
- font and vision provider unavailable; and
- desired matte treatment with matte unavailable.

### Aesthetic Evaluation

The supplied reference set is the workspace directory `Yuan Prometheus Screenshots/`:
fifteen JPEG files whose sorted filename-and-SHA-256 set fingerprint is
`bf573409175c978b6bb49b515d50fe300ec5a39cc02bfb571ef8b5e0c2ab1796`. It remains
review-only until the Reference Corpus records rights status and per-file hashes.

Placement candidates are judged using mobile readability, hierarchy, optical balance,
subject relationship, restraint, sequence coherence, and reference-trait
compatibility. The three-family tracer slice requires zero blocking readability,
safe-zone, or undeclared-collision findings and at least 80% `acceptable` or `preferred`
ratings across its designated visual probes. All failures remain labeled in the Review
Surface. Human review supplies V1 truth labels; a future multimodal critic may advise
but cannot override hard gates or source truth.

## Preconditions

The placement branch cannot claim an end-to-end MVP until its inherited chunking and
renderer seams pass these prerequisite regressions:

- emphasis token IDs are unique, ordered, and reconstruct exact source text;
- backend and Remotion use the same punctuation-aware token joiner;
- source playback rate honors every source-to-output duration mapping rather than
  clipping sped-up segments;
- registered default MAUL props render without dereferencing missing plans; and
- Text Chunk Plans preserve stable token IDs and reject unapproved Protected Pause
  bridging.

## Delivery Slices

1. Fix the listed prerequisites. Add shared placement, token, typography-profile,
   platform, and authority contracts.
2. Build one fixture-driven vertical tracer: the three foundational families, hard
   gates, governed fallback, Planning Bundle handoff, Manifest Compiler output,
   Remotion consumption, and visual proof. Run it in shadow mode before enabling it.
3. Add production shot, subject, field, text, and saliency adapters; scene-local
   tracking; cache indexes; Output Composition Track; and caption-safe composition.
4. Add numeric Presentation Intents, sequence-aware selection, all three platform
   profiles, and the expanded twelve-family catalog.
5. Run acceptance-corpus, performance, Render Contract, and Review Surface gates;
   enable placement only for inputs meeting the declared evidence policy.

Each slice is a testable vertical capability. Every non-blocked result preserves a
readable fallback; blocked results close the export quality gate explicitly.

## Follow-On Designs

The following require separate specs and implementation plans:

1. MAUL RVM matte extraction, storage, manifest, staging, depth compositor, and
   pixel-level occlusion proof for behind-subject typography.
2. Final visual treatments, font-pairing expansion, gradients, highlights, circles,
   underlines, and masks.
3. Count-up, digit-roll, word, line, and chunk animation execution.
4. Automatic upload-to-AssemblyAI-to-MAUL orchestration.
5. Multilingual, right-to-left, and locale-aware placement.
6. Learned or multimodal placement reranking after sufficient Review Surface labels.

## Completion Criteria

Placement V1 is complete only when:

- every new artifact validates and has explicit authority and provenance;
- no smoothing crosses an authoritative cut, editorial discontinuity, or residual
  geometry reset, and the shot policy meets its declared recall gates;
- every governed chunk has exact stable-token coverage and one or more valid Layout
  Segments;
- all dialogue captions render through a valid candidate or declared readable fallback,
  or the plan is explicitly blocked and cannot export;
- output-space placement matches the exact crop and platform profile used by Remotion;
- count-up-eligible numbers reserve their widest formatted state across the planned
  numeric sequence;
- the focused unit, contract, and render suites pass;
- acceptance-corpus probes show no overflow, unsafe-zone intrusion, or undeclared
  subject collision;
- the three-family tracer meets its zero-blocking-finding and 80% human-acceptance gate;
  and
- the expanded catalog produces at least ten distinct neutral-scene variants for every
  one-to-eight-word count before catalog completion is claimed.
