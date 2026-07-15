# Manual Feature Audit Slice: Joseph Gadzhi Reference 01

Date: 2026-07-03
Tracker: #57 Run Manual Feature Audit On Five Reference Edits
Reference: `HOW TO EDIT LIKE GADZHI --JOSEPH 1.mp4`
Trajectory artifact: `HOW TO EDIT LIKE GADZHI --JOSEPH 1.trajectory (1).json`

## Status

This is a partial audit slice, not completion of #57.

It captures the first available Joseph reference and identifies which ontology
requirements are already visible, which extractor signals are usable, and which
signals must be fixed before #58/#60/#82 can proceed.

#57 still needs a human frame-by-frame pass across 3-5 elite references before
the feature catalog is allowed to harden.

## Evidence Summary

- Video duration: 1398.03 seconds (23:18).
- Video resolution and cadence: 640x360 at 30 fps.
- Provided trajectory windows: 301 scene-based windows.
- Provided trajectory extractor: `kaggle-1.0.0`.
- Provided trajectory feature version: `v1`.
- Local repo schema: `trajectory_extractor.schema` version `0.2.0`.
- Text/lower-third windows in provided trajectory: 191 / 301.
- Tutorial-walkthrough windows in provided trajectory: 16 / 301.
- Independent FFmpeg scene detection found 233 scene-change events.

## Critical Compatibility Finding

The provided trajectory is not compatible with the current repository schema.

Validation against `Trajectory` in `packages/trajectory-extractor/trajectory_extractor/schema.py`
fails with 6,847 validation errors. Representative mismatches:

- `metadata.extraction_mode` is `full`, but the schema accepts `paired` or `finals_only`.
- `metadata.source_hash` is empty, but the schema requires a stable non-empty hash.
- `metadata.extracted_at_utc` is missing.
- Windows use `start` / `end`, while the schema requires `start_seconds` / `end_seconds`.
- Genome dimensions are floats in the artifact, while the schema requires discrete enums.
- Editorial role values include `hook`, `explanation`, `demonstration`, and `outro`, while the schema accepts `setup`, `explain`, `tension`, and `payoff`.

This means the artifact can support manual audit, but it is not training-safe.

## Broad Role Arc Observed In The Trajectory

| Span | Role | Window Count | Audit Note |
| --- | --- | ---: | --- |
| 0.0-150.1s | hook | 24 | Opening framing and early retention promise. |
| 150.1-420.0s | setup | 51 | Establishes the teaching frame and context. |
| 420.0-852.8s | explanation | 103 | Main conceptual explanation region. |
| 852.8-1118.9s | demonstration | 69 | More tutorial/screen-supported material. |
| 1118.9-1336.5s | payoff | 47 | Late-stage synthesis and higher energy clusters. |
| 1336.5-1398.0s | outro | 7 | Closing section and likely action/summary. |

## Ontology Coverage From This Reference

Strongly supported:

- Segment timing.
- Broad role arc.
- Tutorial-vs-editorial segmentation.
- Lower-third/text presence.
- Caption density.
- Speaker-present versus speaker-absent windows.
- Dense transition clusters.
- Payoff/outro region detection.

Partially supported:

- Rhetorical role.
- Viewer attention target.
- Cognitive load.
- Emphasis intent.
- Screen/person/object relationship.
- Whether a treatment improved clarity.

Not safely supported without human annotation:

- Joseph's rejected alternatives.
- Whether a visible habit reflected judgment or style autopilot.
- Viewer trust impact.
- Exact reason a cut, caption, or camera move happened.
- SFX/music/ducking intent.

## Coverage By Feature Family

| Family | What Happened | Human Editor Reason | Viewer Problem Solved | Current Feature Coverage | Reliability | Missing Requirement |
| --- | --- | --- | --- | --- | --- | --- |
| Camera | Trajectory reports static camera and zero shot changes across all windows. | Likely pacing, emphasis, or jump-cut cleanup happens despite static camera labels. | Keep talking-head material energetic without losing clarity. | `camera.movement_class`, `shot_change_count`, `has_jump_cut`. | Poor: FFmpeg found 233 scene changes while trajectory reports zero shot changes. | Reliable cut/jump-cut detection and camera crop-change tracking. |
| Typography | 191 / 301 windows contain lower-third text. | Reinforce key words, reduce cognitive load, maintain pace. | Help viewer parse spoken ideas quickly. | `typography.has_text`, `role`, `placement_zone`, `keyword_count`. | Medium: presence is useful, but styling/animation/color are collapsed. | Text intent, keyword semantic role, readability, animation timing. |
| Motion Graphics | Provided trajectory reports no motion graphics. | If screen/tutorial regions exist, graphics may explain or prove the spoken point. | Show rather than merely tell. | `motion_graphics.has_screen_recording`, `has_image_asset`, `overlay_layer_count`. | Poor/unknown: tutorial windows exist, but motion graphics are all `none`. | Screen/evidence/example/instruction relationship labels. |
| Composition | Speaker is center in 154 windows and unknown in 147 windows. | Alternate between speaker authority and supporting visuals. | Tell viewer where to look. | `composition.speaker_position`, `subject_scale`, `background_type`, `has_pip`. | Medium-low: many unknowns. | Attention target, face coverage, safe text zones, object/person relationship. |
| Transitions | Independent detection found frequent cuts and dense clusters near payoff. | Compress time, preserve momentum, and heighten key moments. | Prevent drag and signal importance. | `transitions.dominant_type`, `has_audio_synced_cut`, `timing_offset_bucket`. | Poor: current trajectory misses shot counts and audio sync. | Frame-accurate cut map and reason-for-cut classification. |
| Audio | Trajectory marks music as unknown for all windows and beat proximity mostly on-beat. | Audio can create momentum, emphasis, and restraint. | Make pacing felt, not just seen. | `audio.music_presence`, `beat_proximity`, `sfx_class`, `ducking_active`. | Poor/unknown: no trustworthy music/SFX/ducking signal. | Artifact-backed beat, onset, SFX, music/voice split, ducking envelope. |
| Temporal Pacing | Role arc moves hook -> setup -> explanation -> demonstration -> payoff -> outro. | Structure long teaching video into digestible phases. | Orient viewer inside a 23-minute lesson. | `temporal.position_in_video`, `sequence_trend`, `pacing_density`. | Medium: useful broad arc, but schema role mismatch exists. | Rhetorical phase labels that match schema and transcript. |
| PiP/Matte | Provided trajectory reports no PiP and no segmentation. | If present, PiP/matte would preserve speaker authority while showing evidence. | Let viewer see speaker and proof together. | `composition.has_pip`, `has_subject_segmentation`, `pip_arrangement`. | Unknown: needs visual frame review. | PiP purpose, matte quality, z-order, attention handoff. |

## Observed Candidate Decisions

| Time Range | Observed Decision | Probable Editor Intent | Current Capture | Feasibility |
| --- | --- | --- | --- | --- |
| 0.0-5.0s | Opening hook region with early scene changes. | Establish promise and momentum. | Role arc + FFmpeg scene detection. | Direct after schema migration. |
| 22.7-25.8s | Tutorial-walkthrough window with text and no speaker. | Demonstrate the topic or workflow. | `segment_genre=tutorial_walkthrough`, text present. | Heuristic; requires human verification. |
| 215.6-217.7s | Setup window with speaker present and high visual density. | Keep the speaker as authority during context-building. | Speaker state + visual density. | Heuristic; needs visual confirmation. |
| 236.4-239.8s | Strong scene-change event with text and no speaker. | Switch from explanation to evidence/supporting visual. | FFmpeg scene event + text present. | Direct for cuts, manual for reason. |
| 510.6-513.9s | Explanation window with speaker and text. | Pair spoken point with text reinforcement. | Speaker state + typography. | Direct for presence, manual for intent. |
| 861.1-863.8s | Demonstration window with speaker and text. | Keep tutorial material anchored to speaker narration. | Role + speaker + text. | Heuristic; needs transcript. |
| 1245.5-1246.2s | Payoff region with strong visual change and text. | Heighten a late key point. | FFmpeg scene event + role + text. | Direct for event, manual for judgment. |
| 1317.2-1317.8s | Very strong payoff-region scene change. | Create a punch/reset around a key moment. | FFmpeg scene event + role. | Direct for event, manual for meaning. |
| 1351.9-1386.3s | Outro region with text and speaker. | Land summary or call to action. | Role + text + speaker. | Direct for presence, manual for CTA/trust. |

## Feature Ideas To Reject Or Defer

Reject as low-value or correlated:

- Raw scene-change count without reason-for-cut.
- Raw caption count without semantic role.
- Raw visual-density float without bucketed meaning.
- Raw motion-energy float when it duplicates cut density.
- "Text present" as a proxy for importance.
- "Speaker absent" as a proxy for tutorial.
- Timestamp-only role labels that ignore transcript structure.

Defer until extractor evidence improves:

- SFX class.
- Ducking.
- Beat-synced cut.
- Face emotion.
- Gaze target.
- Gesture.
- PiP/matte quality.

## Required Corrections Before Training

1. Re-extract this reference with the current schema or provide a migration layer.
2. Preserve unknown/missing states instead of silently converting them into low/false.
3. Fix cut/transition extraction so scene changes and shot counts agree.
4. Add transcript-backed rhetorical role labels.
5. Add screen/person/object relationship labels.
6. Add artifact-backed audio features before using beat or SFX signals.
7. Run human frame review for PiP, matte, composition, and typography intent.

## #57 Completion Status

Covered in this slice:

- Camera: partially, with a detected extractor failure.
- Typography: partially.
- Motion graphics: partially, mostly as a missingness finding.
- Composition: partially.
- Transitions: yes, with a detected extractor failure.
- Audio: partially, mostly as a missingness finding.
- Temporal pacing: partially.
- PiP/matte: not yet visually verified.
- Mapping decisions to extractor feasibility: yes for this reference slice.
- Rejected low-value/correlated feature ideas: yes.

Still blocked:

- Human frame-by-frame audit across 3-5 elite references.
- Visual verification of PiP/matte and motion graphics.
- Transcript-backed intent labels.
- A schema-compatible trajectory for this same reference.

