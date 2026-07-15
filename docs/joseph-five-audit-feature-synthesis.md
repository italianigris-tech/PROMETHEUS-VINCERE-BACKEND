# Joseph Five-Audit Feature Synthesis

Status: post-#57 synthesis input for #58
Updated: 2026-07-07
Inputs:

- `docs/audits/joseph-masterclass-feature-extraction-01.events.json`
- `docs/audits/joseph-cinematic-documentary-feature-extraction-02.events.json`
- `docs/audits/joseph-video-questions-feature-extraction-03.events.json`
- `docs/audits/joseph-viral-reels-premiere-feature-extraction-04.events.json`
- `docs/audits/joseph-viral-cinematic-reels-feature-extraction-05.events.json`

## Coverage Summary

Across the five audit packets:

| Metric | Count | Meaning |
| --- | ---: | --- |
| Observed key decisions | 195 | Human-visible Joseph edit decisions captured across five references. |
| Explainable by current catalog | 126 | Roughly 65% of observed decisions map to the current 74-feature vocabulary. |
| Explainable after compact deltas | 176 | Roughly 90% become representable if the highest-value deltas are added or folded. |
| Training-safe now | 104 | Roughly 53% are usable before deeper frame/audio/ASR verification. |

Interpretation: proceed to synthesis and local/API evidence verification now. Do not wait for five more videos before building the first measured trajectory lane. The next five videos should validate recurrence and exceptions, not delay the first extraction loop.

## Train Now

These concepts are already represented by the current 74-feature schema and should remain in the compact catalog:

| Concept | Current feature coverage | Why it survives |
| --- | --- | --- |
| Crop/zoom/pan pressure | `camera.movement_class`, `movement_magnitude`, `face_box_velocity`, `crop_tightness` | Repeated across hooks, returns to speaker, emphasis beats, and long talking-head sections. |
| Cut density and pacing | `camera.shot_change_count`, `transitions.dominant_type`, `temporal.pacing_density` | Needed for Joseph's fast but controlled rhythm. |
| Typography presence and role | `typography.has_text`, `role`, `placement_zone`, `keyword_count` | The strongest repeated visual grammar across all five references. |
| Typography style | `font_weight`, `text_color_treatment`, `animation_class`, `has_background_plate`, `occupancy_bucket` | Captures enough of text hierarchy for MVP without making every visual flourish a feature. |
| Image/PiP/screen assets | `motion_graphics.has_image_asset`, `has_screen_recording`, `composition.has_pip`, `pip_count`, `pip_arrangement` | Central to proof, tutorial clarity, memes, offers, and examples. |
| Depth and matte behavior | `composition.has_subject_segmentation`, `has_depth_layering`, `depth_of_field`, `subject_scale` | Covers text-behind-speaker, speaker priority, and layered motion-graphic scenes. |
| Motion-graphic density | `motion_graphics.overlay_layer_count`, `micro_animation_family`, `has_data_viz` | Useful for counters, graph explainers, step lists, and premium animation bursts. |
| Audio energy and events | `audio.sfx_class`, `sfx_count`, `music_presence`, `music_energy`, `transient_density` | Trainable only when artifact-backed, but vocabulary is correct. |
| Beat/cut relation | `transitions.has_audio_synced_cut`, `timing_offset_bucket`, `audio.beat_proximity` | Critical for riser/impact/cut alignment once audio artifacts exist. |
| Sequence arc | `temporal.position_in_video`, `sequence_trend`, `novelty_level`, `surprise_budget_state`, `repetition_penalty_active` | Needed to model hook pressure, fatigue relief, CTA repetition, and end restraint. |

## Compact Feature Deltas

These are the highest-value deltas to fold into the catalog or derive as secondary labels. They should not all become raw schema fields immediately.

| Delta | Preferred handling | Evidence |
| --- | --- | --- |
| `asset_lifecycle_role` | Derived/manual label first | Asset entry, linger, exit, and graceful fade recur in all five audits. |
| `sfx_lifecycle_role` | Artifact-backed label later | SFX marks asset entry, exit, motion follow, list grouping, semantic release, and fatigue relief. |
| `sfx_timing_relation` | Artifact-backed label later | Important distinction: before visual, on visual, after visual, before spoken keyword, on spoken keyword. |
| `intentional_no_sfx_reason` | Manual-only until waveform proof | Multiple audits note no-SFX cuts as fatigue relief or low-importance returns. |
| `focus_handoff` | Derived visual label | Active/inactive assets, blur/desaturation, group shifts, and camera pans repeatedly manage attention. |
| `semantic_number_priority` | Manual-only then derived | Joseph sometimes animates one number and refuses another; this is reward-relevant but intent-heavy. |
| `text_block_as_unit` | Renderer primitive label | Whole text block shifts/exits, nested groups, word-by-word reveals, and 3D text module behavior recur. |
| `motion_continuity_policy` | Derived transition label | Momentum continuation, deliberate momentum death, and speaker/canvas handoff are recurrent. |
| `commercial_action_pressure` | Manual-only for reward | CTA repetition and price reveals follow conversion pressure, not just visual novelty. |
| `primitive_text_composition_as_object` | Renderer catalog item | Fifth audit explicitly points to composable text groups as render primitives. |

## Manual-Only For Now

These are useful for Judgment Layer review and feature design, but too intent-heavy for direct IRL features today:

- retention contract and future-content teaser intent
- best-editing-choice restraint
- semantic punch selection between competing numbers
- action pressure versus novelty tradeoff
- meme relatability versus professionalism tradeoff
- overediting avoidance and patternicity warnings
- commercial value reveal intent
- rhetorical completion markers like `finally`
- exact reason an asset deserves to linger
- shader/material sophistication as a style judgment

## Defer Until Local/API/Verifier Evidence

These require frame grabs, waveform/spectrogram checks, OCR, motion tracking, or ASR alignment:

- exact SFX/no-SFX claims
- SFX class beyond broad buckets
- riser shape, impact timing, and beat offset
- ducking and voice/music separation
- silence versus masked bed
- typography entry/exit offset versus spoken keyword
- OCR-backed text duration and text occupancy
- PiP/matte boundaries and occlusion quality
- crop/zoom curve classification
- motion handoff across cuts
- scene cut counts and frame-accurate transition timing

## Reject Or Fold

These should not become first-class training features unless later evidence proves strong independent value:

- one-off named flourishes such as exact vignette style, exact glow flavor, or exact lens flare treatment
- raw timestamp, raw frame number, or raw event order
- raw number of overlays without attention target
- raw text count without role or readability
- raw SFX count without lifecycle role or fatigue context
- raw color/palette labels without semantic function
- individual tutorial software technique names as reward features
- exact shader recreation as an MVP requirement

## Primitive Library Implication

The primitive library should start narrow:

| Primitive family | MVP examples | Owner |
| --- | --- | --- |
| Typography | keyword pop, stacked phrase, lower-third, text-behind-speaker, text block exit | Primitive library + renderer |
| Camera/crop | fast hook zoom, slow emphasis zoom, prezoomed speaker return, zoom-out reset | Renderer |
| PiP/matte | inset proof, text reflow around PiP, speaker foreground priority | Renderer + primitive library |
| Transitions | asset-to-speaker return, asset-to-asset bridge, flash/impact, momentum handoff | Renderer |
| SFX punctuation | whoosh, impact, riser, click, gear/continuous text bed, intentional omission | Renderer + audio artifacts |
| Explainers | line callout, graph curve, list counter, value number/counter | Primitive library |

Shader primitives are a curated P2 layer. They should not block the MVP because typography, B-roll, cuts, transitions, PiP/matte, and SFX lifecycle carry most of the Joseph likeness.

## Gate Position

- #57: discovery complete after five audit packets are linked and accepted.
- #58: active synthesis gate; this document is the first fold from raw audits to stable vocabulary.
- #59: still open; artifact-backed audio and evidence extraction required.
- #60: still open; needs five elite Joseph vectors and five generic vectors.
- #61: still open; re-extraction/versioning must guard feature changes.
- #82: blocked until #58, #59, #60, #61, and Golden 100 training gate evidence pass.
