# MAUL Production Typography Proof Pipeline Design

## Status

Approved for implementation on 2026-08-10.

## Goal

Run a real 20-second talking-head video through the production MAUL typography
chain and render a clean 9:16 MP4 whose only added visual layer is cinematic
typography. The proof must use fresh speech transcription, real LLM chunking,
authoritative JSON typography profiles, real MediaPipe observations,
deterministic placement, frame-based word animation, and the canonical Remotion
renderer.

The proof is also a performance benchmark. It must report wall-clock time for
every stage and provider usage for every external inference request. A successful
render without those receipts is incomplete.

## Non-goals

This batch does not add editorial cuts, transitions, animated backgrounds,
motion graphics, keyword circles/highlights, music, or sound effects. Those
layers remain explicitly disabled so they cannot conceal typography or timing
problems. Sound design remains the final editorial stage.

This is not a throwaway demo pipeline and does not introduce fixture text,
prompt-generated transcripts, heuristic speaker tracks presented as MediaPipe,
or a second renderer.

## Selected Source And Output

- Source: the first 20 seconds of
  `remotion-app/public/uploads/raw_male_joseph_proof_v1-raw/raw-joseph-proof-source.mp4`.
- Source properties: 1280x720, approximately 29.97 FPS, with source audio.
- The segment is selected because inspection at 2 and 12 seconds shows a clean,
  stable talking-head composition without inherited graphics. A camera-angle
  change occurs after the selected interval.
- Output: 1080x1920, 30 FPS, H.264 MP4 with the original segment audio.
- Added visual layers: profile-backed typography only.

The original media remains immutable. The segmenter emits a derived media
artifact and a receipt containing source hash, selected interval, output hash,
duration, dimensions, FPS, and audio-preservation status.

## Production Policy, Not A Parallel Pipeline

The existing production stage graph remains authoritative. The proof supplies
an explicit layer policy:

```ts
type RenderLayerPolicy = {
  baseVideo: "required";
  typography: "required";
  sourceTreatment: "disabled";
  sourceLegibilityOverlay: "disabled";
  editorialCuts: "disabled";
  transitions: "disabled";
  backgroundAnimation: "disabled";
  motionGraphics: "disabled";
  audioTreatment: "disabled";
};
```

Disabled stages emit receipts that state they were disabled by policy. They do
not disappear from lineage, and they cannot add hidden defaults. The same
manifest compiler, Remotion adapter, font resolver, and renderer used for a live
job execute the proof.

When `audioTreatment` is disabled, a V3 manifest carries no music track and no
SFX assets. Source dialogue remains part of the governed source sequences. A
silent placeholder track is not an acceptable substitute for an absent music
layer.

## Causal Chain

```text
immutable 20-second source segment
  -> AssemblyAI word transcript
  -> LLM semantic chunk plan
  -> authoritative typography profile realization
  -> MediaPipe/OpenCV observation artifact
  -> deterministic placement and contrast decision
  -> frame-based word motion programs
  -> V3 declared composition / unified render manifest
  -> canonical Remotion render
  -> observed composition, performance, and cost receipts
```

Every downstream artifact references its immediate parent hashes. Every visible
word can therefore be traced to its AssemblyAI word ID, chunk, profile layer,
font asset, placement decision, motion executor, and exact frame interval.

## Fresh Transcription

The segment is sent to AssemblyAI once. The persisted transcript contains the
provider request ID, transcript text, word text, start and end milliseconds,
confidence, media hash, provider identity, and creation time.

The proof requires `source: "assemblyai"` and at least one usable word. Missing
credentials, provider failure, empty words, or invalid timing blocks the proof.
Fixture words and prompt-derived transcript fallbacks are forbidden.

The transcript is cached by media hash and transcription configuration for
normal production retries. The explicit fresh-proof invocation bypasses a prior
transcript once; later renderer retries reuse the persisted artifact rather than
paying for another transcription request.

## LLM Chunking And Token Discipline

The LLM receives the compact indexed transcript, word timestamps, duration,
pacing, semantic-role vocabulary, and chunk-size constraints. It does not
receive font files, all 44 profile JSON documents, video frames, MediaPipe
landmarks, placement candidates, or animation source code.

The proof requires `inference.status: "invoked"`. Missing credentials, provider
failure, invalid response, rate limiting, or deterministic fallback blocks the
proof. The validated response may only select contiguous word boundaries,
semantic roles, and emphasis indices; it cannot rewrite transcript text or make
visual decisions.

There is exactly one LLM chunking request for the 20-second segment. The request
uses a bounded output budget appropriate for a small JSON chunk plan. All later
stages are deterministic and consume zero LLM tokens.

The provider receipt records model, request hash, response hash, prompt tokens,
completion tokens, total tokens, latency, and fallback status when the provider
returns usage. Missing usage metadata is reported as unavailable, never guessed.

## Authoritative Typography Profiles

Each chunk is matched against the complete checked-in JSON profile corpus using
word count and character count as the primary compatibility dimensions. Layout
roles, layer count, casing, font classification, and available composition
width refine the ranking.

The selected JSON profile is authoritative for:

- layer structure and token-to-layer binding;
- font family, style, and weight;
- relative scale, line height, letter spacing, and alignment;
- static colors and declared effects;
- the overall typographic relationship among words.

The exact named font is resolved first. The 577-font registry is consulted only
when that asset is not deployed. A fallback must be the closest verified font
for classification, metrics, style, and weight and must emit a resolution
receipt naming both requested and selected assets. An unverified browser font
fallback is forbidden.

A repetition penalty may choose a different profile only among candidates with
equivalent count compatibility and viable measured envelopes. It cannot select
an unsuitable profile merely to create diversity.

## Real Media Observation

A production `MediaObservationProvider` adapter runs MediaPipe and OpenCV over
the selected output interval. The existing Kaggle trajectory script is reference
code, not the live adapter. The adapter emits an immutable, versioned artifact
containing:

- sampled-frame timestamps and source-frame coordinates;
- face boxes and confidence;
- pose landmarks and confidence;
- a conservative subject-occupancy region derived from pose/face evidence;
- background luminance and color samples for placement candidates;
- missing or low-confidence observation spans;
- detector versions, configuration hash, source hash, and runtime.

MediaPipe observes the frame; it does not choose coordinates or typography.
Sampling is configurable and bounded so a 20-second proof does not require
running every detector at all 600 output frames. Interpolation is allowed only
between valid neighboring observations and is recorded.

If MediaPipe is unavailable, returns no valid observations, or leaves a span too
large to interpolate, the proof blocks. The current speaker-track heuristic is
not accepted as a substitute.

## Placement And Contrast

The deterministic planner evaluates measured profile envelopes against a broad
candidate catalog that includes upper, center, lower, left, right, full-width,
and intentional subject-overlap compositions. Lower-right placement has no
default preference. A face overlap is neither automatically accepted nor
automatically rejected; it is scored using landmark coverage, text scale,
semantic role, duration, and local legibility.

Hard gates reject candidates that clip, exceed platform safe regions, violate a
profile's measured envelope, or remain unreadable. Composition scoring then
ranks viable candidates for scale, negative-space use, rule-of-thirds relation,
subject balance, and profile intent. The planner is allowed to choose a large
centered composition when it is the strongest candidate.

Contrast is evaluated from actual pixels beneath the full text envelope across
the chunk interval, not from one representative frame. Correction order is:

1. choose another otherwise-strong placement candidate;
2. choose a declared alternate profile color when one exists;
3. apply one static black-or-white legibility override to the entire chunk and
   emit an explicit override receipt;
4. block when none of the above produces a readable result.

The color cannot morph word by word or frame by frame. Contrast adaptation must
not turn cinematic typography into active-word captions.

## Frame-Based Word Animation

Every stable transcript word receives one independent animation program from
the existing executable animation registry. Entry begins on the word's spoken
frame:

```ts
const spokenFrame = Math.round((word.startMs / 1000) * outputFps);
```

Words remain after entry so the complete JSON profile composition assembles over
the chunk. The assembled lockup holds until the chunk exit. Words do not replace
one another, recolor as a reading cursor, or disappear at each word end.

Animation selection is constrained by profile layer, semantic role, duration,
and reserved motion envelope. It may vary across chunks without altering static
profile styling. The motion compiler returns frame-indexed entry, hold, and exit
phases plus a maximum excursion envelope. Remotion evaluates those programs from
`useCurrentFrame()` and FPS only; browser wall-clock timers are forbidden.

## Performance And Cost Receipts

Every stage is wrapped with monotonic timing and emits:

- start and end timestamps;
- wall-clock duration;
- cache hit or miss;
- input and output hashes;
- provider request ID when applicable;
- bytes read and written where meaningful;
- warnings and hard failures.

The benchmark report separates:

1. media trimming and probing;
2. AssemblyAI upload, queue, and transcription latency;
3. LLM chunking latency and token usage;
4. MediaPipe/OpenCV observation time;
5. profile resolution, font preflight, placement, and motion compilation;
6. Remotion bundle time;
7. Remotion composition/render/encode time;
8. total cold and reusable-artifact time.

Initial performance targets are:

- deterministic planning after observations: at most 1 second;
- MediaPipe/OpenCV observation for 20 seconds: target at most 5 seconds on the
  current machine, reported as a failed performance target rather than a false
  functional failure if slower;
- local preprocessing plus deterministic planning: at most 8 seconds;
- warm Remotion render: real-time factor at most 4.0 for the 20-second 1080x1920
  proof on the current machine;
- cached rerun: no AssemblyAI or LLM request;
- one LLM request on a cold run and zero LLM requests after chunk persistence.

External provider queue time is measured but not hidden inside local compute.
The first benchmark establishes the actual cold end-to-end baseline. Later
optimization must identify a measured bottleneck rather than weakening visual
or causal contracts.

No dollar cost is fabricated from token counts. The report records provider
usage units; pricing can be applied by the deployment's current billing policy.

## Failure Contract

| Failure | Required behavior |
| --- | --- |
| Missing or invalid AssemblyAI credential | Block before transcript creation |
| Empty or untimed transcript | Block; never synthesize words |
| Missing LLM chunker credential | Block; never call deterministic fallback for this proof |
| Invalid LLM chunk proposal | Persist provider receipt and block |
| No compatible typography profile | Persist ranking diagnostics and block |
| Exact font absent | Resolve through verified 577-font fallback and record receipt |
| Exact and fallback fonts absent | Block before Remotion bundling |
| MediaPipe unavailable or invalid | Block; never label heuristics as MediaPipe |
| No viable placement | Persist rejected candidates and block |
| Black-on-dark or white-on-light envelope | Re-place, statically override, or block |
| Motion envelope exceeds reservation | Return to candidate selection or block |
| Manifest/renderer capability mismatch | Block before rendering |
| Font or media load failure in Remotion | Fail render with asset receipt |
| Stage exceeds performance target | Complete functional proof but mark performance target failed |

## Verification

1. Provider contract tests prove that the proof rejects transcript and chunking
   fallback statuses.
2. Lineage tests trace every rendered word through transcript, chunk, profile,
   placement, motion, and manifest hashes.
3. Font tests verify exact-font priority and the verified proximal fallback.
4. Media observation tests run a short checked-in visual fixture and prove real
   detector provenance, coordinate normalization, missing-span behavior, and
   deterministic serialization.
5. Placement tests include dark-on-dark, light-on-light, center composition,
   intentional subject overlap, clipping, and no-viable-candidate cases.
6. Motion tests verify word entry within one output frame of the AssemblyAI
   timestamp and persistence until chunk exit.
7. Manifest tests prove disabled layers cannot reappear through defaults or
   compatibility adapters, including the current full-frame legibility gradient
   and source-treatment layer. They also prove an audio-disabled V3 manifest has
   no music/SFX asset while preserving source dialogue audio.
8. A canonical 20-second render produces the MP4, all causal artifacts, visual
   sample frames, and the performance/cost report.

## Acceptance Criteria

The batch is accepted only when:

- the exact approved source interval is used;
- transcript source is fresh AssemblyAI and the LLM chunker status is invoked;
- real MediaPipe evidence is consumed by placement;
- all visible text comes from transcript words and a selected JSON profile;
- exact profile fonts are preferred and every fallback is disclosed;
- text is large, unclipped, readable, and not structurally biased toward one
  corner;
- word animation is speech-synchronized and assembles persistent lockups;
- no cuts, transitions, background animations, motion graphics, or sound design
  are added;
- the canonical Remotion path produces a playable 1080x1920 MP4 with source
  audio;
- token usage, provider requests, stage timings, render real-time factor, and
  all causal artifacts are delivered with the video.

## Rollout

The typography-only layer policy remains available as a production diagnostic
and regression mode. Once the proof passes, the same artifacts feed subsequent
cut, transition, background, motion-graphics, and final sound-design stages.
Those stages extend the declared composition; they do not bypass or reinterpret
the typography chain.
