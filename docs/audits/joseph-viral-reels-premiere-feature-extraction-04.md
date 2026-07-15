# Joseph Viral Reels Premiere Feature Extraction 04

Status: fourth reference packet for #57/#58/#60
Source video: `JOSEPH VIDEO PROOF/YouTube_How-to-Edit-Viral-Instagram-Reels      fourth video.mp4`
Video title: `How to Edit Viral Instagram Reels using ONLY Premiere Pro! (Beginner's Guide)`

Verified media metadata:

- Duration: 864.525351 seconds
- Resolution: 1280x720
- Frame rate: 30 fps
- Video codec: H.264
- Audio: AAC stereo, 44100 Hz
- File size: 44,544,635 bytes

Input evidence:

- Great Joshua raw timestamp analysis for the fourth video.
- Local MP4 asset present in `JOSEPH VIDEO PROOF`.

This file is not final training approval. It is reference 4 of 5. The main
difference from references 1-3 is that this video exposes more of Joseph's
motion-graphics machinery: text matting behind the speaker, animated list systems,
asset-to-asset handoffs, animated price/value typography, and subtle focus tools
such as saturation, rounded corners, vignette, and nonstandard blur.

The important finding is not "motion graphics are good." The useful finding is
that motion graphics are used as an execution layer for editorial decisions:
clarity, value anchoring, pacing, anti-fatigue, CTA pressure, and premium
perception.

## Packet Status

References 1-3 are stored at:

- `docs/audits/joseph-masterclass-feature-extraction-01.md`
- `docs/audits/joseph-cinematic-documentary-feature-extraction-02.md`
- `docs/audits/joseph-video-questions-feature-extraction-03.md`

This fourth packet should be combined with reference 5 before any candidate
deltas are promoted to the canonical feature catalog.

## First-Pass Score

Raw decision coverage from this packet:

- Raw timestamp observations: 46, including one duplicate timestamp note.
- Observed key edit decisions after grouping: 34.
- Explainable by current catalog: about 22.
- Explainable after candidate deltas below: about 31.
- Training-safe now with the MP4 available but without automated frame/audio extraction: about 18.

Interpretation:

- This reference strongly supports a split between decision engine and rendering
  engine: "what needs to happen for the viewer" should be decided separately from
  "which exact motion-graphics template performs it."
- The opening and first 30 seconds are unusually dense: zoom-out intro, riser to
  impact, PiP proof, text matting behind the speaker, subtle speaker zoom, text
  exit animation, animated list reveal, step-to-step movement, and UI/bell-like
  SFX.
- The commercial/value section adds important exceptions: not every money number
  gets a count-up, repeated money amounts should not repeat the full animation,
  but repeated CTA text can reuse animation because action pressure matters.

## High-Value Event Audit

| Time | What happened | Why a human editor likely did it | Viewer problem solved | Current feature coverage | Reliability | Missing feature delta | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0.544 | High-beat intro uses zoom-out framing. Joshua notes zoom-out intros are recurring. | Start with kinetic pressure and avoid a static first frame. | Immediate momentum; viewer feels the tutorial has pace. | `camera.movement_class`, `audio.music_energy`, `temporal.position_in_video`. | Medium. | `intro.zoom_out_signature`, `camera.intro_energy_zoom`. | Good |
| 2.688 | Riser, deep/cool impact, then transition into PiP/explainer element after "in this video..." setup. | Attach weight to the video promise and make the explained object visible. | Converts verbal promise into visual proof. | `audio.sfx_class`, `transition.type`, `composition.has_pip`. | Medium. | `audio.riser_to_deep_impact_release`, `intro.promise_to_pip_proof`, `pip.explainer_role`. | Good |
| 6.612 | Animation slightly zooms in, then cuts back to speaker because the animation has outlived its functional visual utility. | Exit an asset once its explanatory value declines. | Prevents dead-screen fatigue and restores authority. | `camera.movement_class`, `transition.return_to_authority`, `motion_graphics.has_image_asset`. | Medium-high. | `asset.functional_utility_expiry`, `asset.exit_on_value_decay`. | Good |
| 8.123-10.690 | Small rich typography sits near the speaker's head, letter/motion-blur animates, text mattes behind the speaker when he overlaps it, whole frame slowly zooms, then text exits with smooth motion-blur/fade. | Make a beginner premise feel premium while preserving the speaker as foreground authority. | Avoids amateur overlap, adds depth, and keeps text from feeling pasted on. | `typography.animation_class`, `typography.placement_zone`, `camera.movement_class`, `composition.has_depth_layering`. | High visually after frame check. | `typography.speaker_occlusion_matte`, `typography.near_head_safe_zone`, `text.motion_blur_exit`, `speaker_foreground_priority`. | Good |
| 12.111 | Cut to animation; asset enters with slow-hold-release easing, then speeds slightly at the end. | Make a static explainer feel alive and premium. | Gives the viewer a subtle sense of weight and polish. | `motion_graphics.micro_animation_family`, `camera.movement_class`. | Medium. | `motion.ease_breathe_curve`, `asset.slow_hold_release_entry`, `motion.end_acceleration_tail`. | Good |
| 15.800-17.908 | Asset-to-asset pseudo-flash cut with SFX, then asset-to-speaker return with zoom/blur. | Keep the explainer moving without always returning through a full talking-head reset. | Maintains continuity across visual concepts, then restores speaker. | `transition.type`, `audio.sfx_class`, `camera.movement_class`. | Medium. | `transition.asset_to_asset_bridge`, `transition.asset_to_speaker_zoom_blur`, `audio.niche_sfx_value_attachment`. | Good |
| 20.447-23.324 | Five-step workflow appears as an Apple-like numbered list with opacity/transparent gradient, UI/bell-like SFX per number, zoom-out on list, then step-to-step motion instead of rapid cuts back to speaker. | Announce the structure once and keep rapid step enumeration inside the animation canvas. | Avoids one-second speaker flashes and clarifies a five-step workflow. | `typography.text_color_treatment`, `motion_graphics.overlay_layer_count`, `audio.sfx_count`, `composition.visual_density`. | Medium-high visually; audio medium. | `list.opacity_gradient_number_stack`, `audio.short_bell_ui_list_sfx`, `list.animation_canvas_over_speaker_return`, `speaker.minimum_return_duration`. | Good |
| 23.324-28.117 | Step animation uses split-direction entry, waving gradient text, lower-left-to-center entry, nested component animation, then zoom-fade-out to avoid resolution artifacts. | Vary list motion and make each step feel individually authored. | Prevents list fatigue and hides scale/resolution weaknesses. | `transition.directional_axis`, `typography.animation_class`, `asset.animation_out_quality`. | Medium. | `motion.component_group_nested_animation`, `list.directional_entry_variation`, `asset.zoom_fade_resolution_guard`, `motion.saas_tilt_exit`. | Good |
| 35.926 | Same five-step animation is reused before the phrase finishes; visual asset leads the spoken line; SFX changes from UI/bell style to glitch variant. | Reuse a high-value animation as a recall anchor while varying sound to reduce fatigue. | Reinforces structure without feeling like a simple copy-paste. | `asset.predictive_prime_offset_ms`, `audio.same_function_variant_sfx`, `list.visual_grammar_reuse`. | Medium. | `asset.leads_speech_for_recall`, `animation.reuse_allowed_when_high_value`, `audio.reuse_fatigue_masking`. | Good |
| 62.119-66.446 | Cut back to speaker starts zoomed-in then zooms out; "extra tip" gets a zoom-in; transition to another scene uses sound. | Restore authority, then re-tighten attention for bonus value. | Viewer understands a bonus value block has started. | `camera.prezoomed_cut_start`, `camera.semantic_emphasis_zoom`, `audio.sfx_class`. | Medium. | `bonus.extra_tip_attention_zoom`, `speaker.zoom_out_then_zoom_in_sequence`. | Good |
| 83.786-90.531 | Camera movement uses fast-slow-fast breathing/ease pacing; high-pitched riser marks transition into a new list/session; later a clean cut occurs with no SFX. | Use motion and audio to build/release, then intentionally avoid over-patterning. | Retains attention while preventing templated rhythm. | `camera.ease_profile_slow_fast_slow`, `audio.sfx_class`, `audio.has_silence_gap`. | Medium. | `motion.fast_slow_fast_breathing_curve`, `audio.high_pitch_section_riser`, `patternicity.avoidance_cut_no_sfx`. | Good |
| 94.113-100.329 | Cut to text-based explainer; dotted/brick highlight chunks use different colors; simple no-SFX cut back to speaker; speaker zooms/pans out. | Explain a textual concept with chunked priority, then give auditory relief on return. | Makes text scanning easier and avoids SFX fatigue. | `typography.animation_class`, `highlight.semantic_word_tracking`, `transition.type`, `audio.has_silence_gap`. | Medium-high visually. | `highlight.chunked_priority_blocks`, `highlight.multi_color_priority`, `audio.no_sfx_return_relief`. | Good |
| 103.555 | Fast zoom-in hits when he says the hook has a very important job. | Break the established slower zoom pattern for a fast value beat. | Viewer feels immediate importance. | `camera.semantic_emphasis_zoom`, `speaker.has_emphasis`. | Medium. | `camera.fast_value_delivery_zoom`, `pattern.inversion_for_importance`. | Good |
| 106.032-108.069 | Text asset on a new background uses glitch-like typography, blue keyword, red highlight, then text block shifts as one unit to make room for PiP; later a scan/analysis gradient passes through text. | Treat text as a flexible block that can yield space to supporting proof. | Preserves context while adding PiP without collision. | `typography.animation_class`, `typography.text_color_treatment`, `composition.has_pip`. | Medium. | `text_block.reflows_for_pip`, `pip.enter_after_text_claim`, `typography.analysis_scan_gradient`, `keyword.color_role_split`. | Good |
| 146.682-158.685 | High-tier motion graphics: smooth text movement, word-by-word gradient intro, gradual bolding, gear-like continuous SFX, then whole text block exits with motion blur toward PiP. | Give a macro edit decision microscopic polish without over-clicking every word. | Increases premium feel and reduces auditory clutter. | `typography.animation_class`, `audio.sfx_class`, `asset.animation_out_quality`. | Medium. | `motion_graphics.execution_layer`, `typography.gradual_boldening`, `audio.continuous_gear_for_many_words`, `text_block.single_unit_exit`. | Good |
| 171.868-186.871 | Return to speaker uses prezoomed slow zoom-out; speaker later zooms back in for self-selling point; "viral" gets spatial outline typography, gradient lines, animated landscape/reference assets, and subtle vignette. | Move from trust/sales pitch into premium spatial proof of the keyword. | Makes "viral" feel like a visual concept, not just a word. | `camera.movement_class`, `typography.text_color_treatment`, `composition.vignette`, `motion_graphics.has_image_asset`. | Medium-high visually. | `keyword.spatial_outline_treatment`, `typography.gradient_line_fill_motion`, `asset.keyword_orbit_support`, `vignette.universal_cinematic_focus`. | Good |
| 193.804-201.596 | Transition with whoosh/swoosh; price page begins with `$497`, UE icon/brand object changes color/spatial orientation, riser builds after "used to," `$97` arrives with shader/halo/glow, then "click link below" appears with gradient/vignette. | Convert pricing into a commercial reveal sequence with before/after value tension. | Makes the offer legible and emotionally weighted. | `audio.sfx_class`, `motion_graphics.has_data_viz`, `typography.text_color_treatment`, `composition.vignette`. | Medium. | `commercial.before_after_price_reveal`, `brand_icon.spatial_price_anchor`, `audio.used_to_riser_trigger`, `typography.price_shader_halo`, `cta.core_phrase_extraction`. | Good |
| 222.225 | Cut back to speaker is accompanied by zoom-in rather than the more common zoom-out. | Keep movement variety after the commercial page. | Avoids a predictable speaker return. | `camera.movement_class`, `transition.return_to_authority`. | Medium. | `transition.return_zoom_in_variant`, `camera.return_variation_budget`. | Good |
| 365.591 | Speaker zooms in, then shortly zooms out with the same breathing/ease logic; transition to another session continues the zoom-out spirit. | Use camera motion as the bridge into a sales/community reinforcement section. | Makes section shift feel continuous rather than pasted. | `camera.movement_class`, `transition.type`. | Medium. | `camera.motion_continuity_into_scene_change`, `section.sales_reinforcement_transition`. | Good |
| 380.653 | `$2,000` appears without count-up; digits animate one-by-one, with supporting handwritten/goofy green "video editing" text. | Avoid overusing the numeric counter while still making the value cinematic. | Preserves novelty and keeps the number memorable. | `motion_graphics.has_data_viz`, `typography.animation_class`, `typography.font_pairing`. | Medium-high visually. | `number.digit_by_digit_entry_no_countup`, `number.counter_exception`, `typography.playful_support_font`, `perfection.restraint_improves_cinema`. | Good |
| 409.863-413.571 | `$497` counts up green, locks to red with mild impact; then continues downward to `$97/month` with brand-consistent gradient. | Show pain of old price and relief/value of new price in one continuous motion. | Creates price contrast and commercial reward. | `motion_graphics.has_data_viz`, `audio.sfx_class`, `typography.text_color_treatment`. | Medium. | `number.counter_direction`, `price.color_semantics_old_high_red`, `price.down_counter_to_offer`, `audio.soft_impact_on_price_lock`, `brand_gradient.offer_alignment`. | Good |
| 422.173-424.040 | Amount is re-mentioned without repeating the price animation; CTA "click first link below" is repeated with similar animation/vignette. | Avoid diminishing returns for value animation, but allow CTA repetition because action pressure benefits from repetition. | Maintains trust while reinforcing the desired action. | `temporal.repetition`, `typography.role`, `composition.vignette`. | Medium. | `repetition.diminishing_returns_by_asset_type`, `cta.repetition_exception`, `commercial.trust_cost_of_overanimation`. | Good |
| 432.313 | Three PiP assets enter with luxury-bounce/UI-tech SFX; group moves left with breathing/ease, first item re-enters/focuses while others remain faintly visible. | Introduce a set, then focus one item without fully discarding context. | Helps viewer understand a multi-item sequence and current focus. | `composition.has_pip`, `audio.sfx_class`, `camera.focus_handoff_pan`, `asset.active_inactive_state`. | Medium. | `motion.luxury_bounce`, `asset.group_reposition_for_item_focus`, `asset.reenter_current_item`, `audio.ui_tech_per_component_sfx`. | Good |
| 466.781 | Tutorial note: saturation/desaturation, corner rounding, and a subtle nonstandard blur can refocus attention and raise cinematic quality if used sparingly. | Add visual hierarchy and polish without always relying on motion or sound. | Makes assets feel designed and focuses attention across multiple items. | `composition.color_palette`, `composition.has_depth_layering`, `asset.active_inactive_state`. | Medium-low as tutorial note; needs visual examples. | `attention.desaturation_refocus`, `asset.corner_radius_quality_role`, `blur.cinematic_depth_nonstandard`, `effect.sparing_use_budget`. | Neutral-good |
| 785.620 | Riser plays from an animation screen back to talking head, syncing with full flash impact on speaker return; this reverses the more common talking-head-to-animation riser direction. | Mark the end of an animation session and make the authority return feel like payoff. | Prevents long animation run from fading out weakly. | `audio.sfx_class`, `transition.return_to_authority`, `audio.sfx_timing_relation`. | Medium. | `audio.reverse_riser_to_authority_return`, `animation_session.end_payoff_riser`, `transition.flash_impact_speaker_return`. | Good |
| 804.496 | Talking-head video pans/moves upward into an explanatory animation canvas using the breathing/ease curve. | Convert speaker into motion source for the next canvas. | Makes the canvas transition feel continuous and premium. | `transition.directional_axis`, `camera.movement_class`, `pedagogical_phase`. | Medium. | `transition.speaker_upward_to_canvas`, `animation_canvas.entry_from_talking_head`, `motion.breathing_curve_on_canvas_entry`. | Good |
| 863.839 | "Click link down below" appears a third time with the same basic vignette/text animation near the bottom. | Repeat CTA at end because action conversion matters more than novelty. | Gives the viewer a final action cue. | `cta.resource_download_visualization`, `typography.role`, `composition.vignette`. | Medium. | `cta.end_repetition_allowed`, `cta.bottom_vignette_text_placement`, `commercial.action_pressure_repetition`. | Good |

## Candidate Feature Deltas From Reference 04

### Motion Graphics Execution

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `motion_graphics.execution_layer` | boolean | Separates editorial decision from the specific motion-graphics implementation. | Needed in final architecture if multiple renderers can satisfy one intent. |
| `motion.ease_breathe_curve` | boolean | Repeated premium asset/camera motion has slow-hold-release character. | Frame tracking confirms across refs. |
| `motion.fast_slow_fast_breathing_curve` | boolean | Some camera moves accelerate, slow, then accelerate for cinematic pacing. | Requires crop/motion extraction. |
| `motion.component_group_nested_animation` | boolean | Parent group and child components animate simultaneously. | Frame/object tracking can label it. |
| `motion.luxury_bounce` | boolean | Bounce can be used without cheapening the edit when damped and polished. | More examples needed. |
| `motion.saas_tilt_exit` | boolean | Tilt/plane motion appears as a SaaS-like premium transition. | Frame review confirms. |
| `asset.zoom_fade_resolution_guard` | boolean | Fade during scale-up/down hides resolution artifacts. | Seen in multiple zoom-fade exits. |
| `text_block.single_unit_exit` | boolean | Words enter individually but exit as a block. | OCR/layout tracking confirms. |
| `text_block.reflows_for_pip` | boolean | Existing text shifts to make room for PiP proof. | Useful for collision-free layout planning. |

### Typography / Matting / Layout

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `typography.speaker_occlusion_matte` | boolean | Text can live behind the speaker, giving professional depth. | Segmentation/matting can verify. |
| `speaker_foreground_priority` | boolean | Speaker remains visually dominant when text overlaps. | Human/frame labels agree. |
| `typography.near_head_safe_zone` | boolean | Text near the head must avoid amateur overlap and odd distance. | Layout rules can encode it. |
| `typography.gradual_boldening` | boolean | Words gain weight over time for luxury emphasis. | Frame review confirms. |
| `typography.analysis_scan_gradient` | boolean | A scan-like gradient over text can represent analysis. | Seen beyond one moment. |
| `keyword.color_role_split` | `blue_keyword_red_support`, `brand_gradient`, `red_warning`, `unknown` | Color carries semantic roles inside one typography frame. | Needs palette/text alignment. |
| `keyword.spatial_outline_treatment` | boolean | A keyword such as "viral" can become a spatial background object. | Useful for high-weight keyword visualization. |
| `typography.gradient_line_fill_motion` | boolean | Moving gradient lines inside outlined text create premium movement. | Manual/frame review first. |

### Lists / Workflow Structure

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `list.opacity_gradient_number_stack` | boolean | Apple-like numbered stack communicates sequence and depth. | Seen across list references. |
| `list.animation_canvas_over_speaker_return` | boolean | Rapid list enumeration stays on animation canvas instead of cutting to speaker. | Use when speaker return duration would be too short. |
| `speaker.minimum_return_duration` | seconds bucket | Prevents meaningless 1-2 second speaker flashes. | Needs timing policy from more examples. |
| `list.directional_entry_variation` | `left`, `right`, `bottom`, `lower_left`, `center`, `mixed` | Steps use varied entry vectors to reduce fatigue. | Motion tracking can infer. |
| `animation.reuse_allowed_when_high_value` | boolean | High-value animations can repeat if the asset is strong enough. | Human agreement needed. |
| `audio.reuse_fatigue_masking` | boolean | Reused visuals can be freshened with changed SFX. | Verify audio variants. |

### Audio / Transition / SFX

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `audio.riser_to_deep_impact_release` | boolean | Intro promise uses riser plus deep impact before transition. | Audio extraction confirms. |
| `audio.short_bell_ui_list_sfx` | boolean | List entries get short bell/UI pings, not generic pops. | More examples needed. |
| `audio.niche_sfx_value_attachment` | boolean | Unusual but polished SFX can make an effect feel valuable. | Manual-only until audio taxonomy matures. |
| `audio.continuous_gear_for_many_words` | boolean | Long word sequences use continuous gear texture instead of many clicks. | Strengthens ref 03 click-thinning. |
| `audio.high_pitch_section_riser` | boolean | High-pitch riser marks a list/session transition. | Audio verification needed. |
| `audio.reverse_riser_to_authority_return` | boolean | Riser can run from animation back to speaker, not only speaker to animation. | Important new exception. |
| `transition.flash_impact_speaker_return` | boolean | Speaker return can be the payoff to an animation-session riser. | Sync verification needed. |

### Commercial / CTA / Pricing

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `commercial.before_after_price_reveal` | boolean | `$497` to `$97` sequence is a specific persuasion pattern. | Useful for commercial sections. |
| `brand_icon.spatial_price_anchor` | boolean | Brand icon/UE object anchors the price visually. | Frame review confirms. |
| `audio.used_to_riser_trigger` | boolean | Phrase "used to" primes the upcoming price change. | ASR and audio transition align. |
| `number.counter_direction` | `up`, `down`, `digit_entry`, `none` | Numeric animation is not always count-up. | Strongly supported by this reference. |
| `price.color_semantics_old_high_red` | boolean | Red can mark old/high price pain. | Need more price examples. |
| `brand_gradient.offer_alignment` | boolean | New offer uses brand-consistent gradient to feel legitimate. | Palette extraction and human label. |
| `repetition.diminishing_returns_by_asset_type` | boolean | Repeating a price animation can hurt trust, while CTA repetition can help. | Needs synthesis across commercial refs. |
| `cta.repetition_exception` | boolean | CTAs are allowed to repeat more than normal assets. | Seen here three times. |
| `commercial.action_pressure_repetition` | boolean | Repeated CTA creates action pressure. | Manual-only until conversion context exists. |

### Focus / Polish Tools

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `attention.desaturation_refocus` | boolean | Desaturation can reduce attention like blur/dimming. | Needs frame examples. |
| `asset.corner_radius_quality_role` | `none`, `subtle_quality_lift`, `overrounded_harm`, `context_dependent` | Rounded corners can improve or harm asset quality. | Human-rated examples first. |
| `blur.cinematic_depth_nonstandard` | boolean | Subtle nonstandard blur can add premium depth beyond Gaussian blur. | Defer until examples are visually captured. |
| `effect.sparing_use_budget` | integer/bucket | Strong polish effects should be used sparingly. | Needs video-level frequency analysis. |

## Current 74-Feature Coverage Assessment

| Family | Coverage from this reference | Issue |
| --- | --- | --- |
| Camera | Medium-high | Current labels miss ease-curve character, motion continuity into transitions, and return variation budgets. |
| Typography | Medium-high | Missing speaker occlusion/matting, near-head placement safety, scan gradients, spatial keyword treatment, and gradual boldening. |
| Motion graphics | High | Needs explicit execution-layer vocabulary and nested group/component animation. |
| Composition | Medium-high | Vignette, depth, PiP, and matting are useful but need roles rather than only presence flags. |
| Transitions | Medium | Asset-to-asset, animation-to-authority riser, and flash-impact returns are under-described. |
| Audio | Medium | Strong evidence for SFX variants, continuous SFX for long text, reverse riser direction, and bell/UI list pings. |
| Temporal | Medium | Need policies for speaker minimum return duration, CTA repetition, and animation reuse. |
| Commercial | High | Price reveal, down-counter, CTA repetition, and trust cost of repeated value animation are important additions. |

## SFX/Audio Findings To Verify From MP4

These should be checked before marking them trainable:

- 2.688: riser to deep impact release before PiP transition.
- 15.800: asset-to-asset pseudo-flash transition SFX.
- 20.447: short bell/UI sound per list number.
- 35.926: reused list animation switches from UI/bell SFX to glitch variant.
- 66.446: scene animation accompanied by likely swoosh.
- 87.553: high-pitched riser into new list/session.
- 90.531: clean cut with no SFX.
- 98.673: cut back to speaker with no SFX.
- 146.682-153.295: high-tier motion graphics use a different SFX / gear-like continuous texture.
- 193.804: transition back to speaker with whoosh/swoosh.
- 199.622: riser under "used to" price-change setup.
- 409.863: UI/gear count-up and mild impact on `$497` lock.
- 432.313: UI-tech SFX per PiP component.
- 785.620: riser from animation screen back to talking head.
- 863.839: repeated click-link CTA treatment.

## Training Safety Decisions

Train now only after extraction support:

- text behind speaker / foreground speaker matting
- list stack presence and opacity-gradient number treatment
- speaker minimum return duration buckets
- number animation direction: up, down, digit-entry, none
- CTA repetition count and placement
- PiP group reposition and active item focus
- asset animation-out class: fade, zoom-fade, motion-blur exit

Manual-only for now:

- whether an SFX is "cool" or "luxury" rather than simply well-mixed
- whether reusing a complex animation remains fresh because the animation is high-value
- whether a playful support font improves the `$2,000` moment
- whether repeated CTA pressure is beneficial in a particular audience context
- whether corner rounding improves or harms a specific asset

Defer:

- exact ease-curve labels until frame tracking exists
- nonstandard blur taxonomy until screenshots/examples are collected
- pitch/material labels for UI/bell/gear variants
- trust-cost modeling for repeated price animations

Reject as direct training features:

- "Every price mention needs a counter."
- "Every CTA should use the same animation."
- "All assets should have rounded corners."
- "More motion graphics always means higher quality."
- "Always cut back to speaker after every listed item."

## What This Reference Adds Beyond References 01-03

Reference 01 strongly supported:

- SFX lifecycle and timing.
- Value anchors and number counters.
- Silence/no-SFX as pattern break.
- Teaser retention contracts.

Reference 02 added:

- Tutorial visual registers.
- Callout/blueprint pedagogy.
- Host video as an animated layer.
- Motion depth via camera/null-style movement.

Reference 03 added:

- Q&A loop grammar.
- Question-card importance.
- Silence as thesis punctuation.
- Click thinning for long text.
- Animation-out quality.

Reference 04 adds:

- Text matting behind speaker.
- Motion graphics as execution layer, not just decoration.
- Nested group/component animation.
- Speaker minimum return duration.
- High-value animation reuse with SFX variation.
- Number animation direction beyond count-up.
- CTA repetition exception versus price-animation diminishing returns.
- Saturation, rounded corners, and subtle blur as focus/polish tools.
- Reverse riser direction from animation back to authority.

## Required Next Evidence

For reference 05:

1. Keep tying motion graphics back to viewer problem solved.
2. Mark when a technique is only "beautiful" versus when it changes clarity,
   retention, value perception, or fatigue.
3. Watch for whether CTA repetition remains an exception.
4. Track whether numeric animation direction changes by commercial meaning.
5. Mark exact cases where motion graphics replace a cut back to speaker.
6. Note any moment where the motion graphics feel excessive or decrease trust.

The current running hypothesis after 4/5:

> Joseph's style is not just SFX-heavy or motion-graphics-heavy. It is budgeted:
> motion, sound, typography, and speaker returns are allocated according to the
> viewer's current need for proof, clarity, value contrast, action pressure,
> fatigue relief, or premium perception.
