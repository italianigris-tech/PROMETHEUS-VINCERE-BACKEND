# Joseph Cinematic Documentary Feature Extraction 02

Status: second reference packet for #57/#58/#60
Source video: `JOSEPH VIDEO PROOF/How_to_Edit_Cinematic_Documentary_     second video.mp4`
Video title: `How to Edit Cinematic Documentary Videos (3 Premium Animations in After Effects)`

Verified media metadata:

- Duration: 1259.937959 seconds
- Resolution: 1920x1080
- Frame rate: 30 fps
- Video codec: AV1
- Audio: AAC stereo, 44100 Hz

Input evidence:

- Great Joshua raw timestamp analysis for the second video.
- Kimi frame-sampled visual audit for the same video.
- Hard MP4 asset present in `JOSEPH VIDEO PROOF`.

This file is not final training approval. It is reference 2 of 5. The main
difference from reference 1 is that this video is more tutorial/documentary
workflow oriented: it has more screen-recording pedagogy, annotated explainers,
documentary visual assets, and camera/null-stack technique discussion, while
still preserving Joseph-like SFX lifecycle and attention management.

## Packet Status

Reference 1 is already stored at:

- `docs/audits/joseph-masterclass-feature-extraction-01.md`
- `docs/audits/joseph-masterclass-feature-extraction-01.events.json`

This second packet should be used later with references 3-5 to decide which
candidate deltas become canonical feature catalog entries.

## First-Pass Score

Raw decision coverage from this packet:

- Observed key edit decisions: 47.
- Explainable by current catalog: about 30.
- Explainable after candidate deltas below: about 42.
- Training-safe now with the MP4 available but without automated frame/audio extraction: about 26.

Interpretation:

- Kimi was strong on visual register and tutorial structure.
- Great Joshua was stronger on SFX, exceptions, camera intent, and critique.
- The combined packet is materially better than either alone.
- The biggest new domain is not "more sound effects"; it is tutorial-specific
  visual pedagogy: show, label, build, return to speaker, then deepen.

## High-Value Event Audit

| Time | What happened | Why a human editor likely did it | Viewer problem solved | Current feature coverage | Reliability | Missing feature delta | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.031 | Intro sets elements in the middle, then zooms out. UI/gear-like SFX may support it. | Start with motion and controlled reveal instead of static introduction. | Immediate visual momentum; avoids cold open. | `camera.movement_class`, `audio.sfx_class`. | Medium: MP4 exists, audio not yet extracted. | `intro.centered_reveal_zoom`, `audio.ui_gear_hybrid_sfx`. | Good |
| 2.165 | Upward transition from talking head, accompanied by whoosh. | Move quickly from host to example/output. | Signals a mode change without losing energy. | `transition.type`, `audio.sfx_class`. | Medium-high. | `transition.directional_axis`, `audio.transition_motion_match`. | Good |
| 4.915 | Fast intro montage with grayed images and morphing/glyph-heavy "in this video" text; unusual dropped-water-like SFX per text. | Retain attention and preview the documentary aesthetic. | Lets viewer feel scope and style quickly. | `typography.has_text`, `motion_graphics.has_image_asset`, `audio.sfx_class`. | Medium. | `typography.glyph_morph_complexity`, `audio.text_sfx_material_metaphor`, `preview.desaturated_support_assets`. | Good |
| 6.560 | Transition to a physical/complementary asset with whoosh. | Tie spoken promise to a visual proof asset. | Makes abstract tutorial promise concrete. | `motion_graphics.has_image_asset`, `transition.type`. | Medium. | `asset.semantic_complement_role`, `audio.asset_entry_whoosh`. | Good |
| 11.203 | Soft blur-in transition rather than normal cut/transition. | Preserve novelty while keeping the same base function: introduce/switch asset. | Avoids samey transitions. | `transition.type`, `composition.has_depth_layering`. | Medium. | `transition.soft_blur_in`, `transition.variant_family`. | Good |
| 15.378 | Riser builds tension before showing the numbered animation; number has 3D/gradient treatment and masked text. | Prime the viewer for a premium animation showcase. | Adds anticipation before the numbered list payoff. | `audio.sfx_class`, `typography.text_color_treatment`, `motion_graphics.micro_animation_family`. | Medium. | `audio.pre_showcase_riser`, `number_3d_gradient_treatment`, `text.masked_background_reveal`. | Good |
| 20.553 | Second numbered asset uses the same grammar: 3D number, title above, masked text showing background through letters. | Build a consistent sequence grammar. | Viewer understands this is a series/list. | `typography.role`, `motion_graphics.overlay_layer_count`. | Medium. | `list.visual_grammar_reuse`, `text.knockout_mask_fill`. | Good |
| 24.513 | Third numbered animation uses same structure but different SFX/swoosh feel. | Repeat the pattern while varying sound to avoid fatigue. | Preserves list clarity without sonic monotony. | `audio.sfx_count`, `audio.sfx_class`. | Medium. | `audio.same_function_variant_sfx`, `list.item_variant_sonic_treatment`. | Good |
| 34.344 | Fast zoom-out transition to talking head with no dedicated SFX, only background bed. | Break the SFX-on-transition rule after a dense intro. | Provides auditory relief while keeping motion. | `audio.has_silence_gap`, `transition.type`. | Medium-high after audio check. | `audio.no_sfx_transition_reason`, `transition.zoom_out_to_authority`. | Good |
| 36.701 | Download/project-files CTA becomes stylized text with colored vignette/gradient. | Convert a procedural CTA into branded visual language. | Makes utility/resource CTA feel premium rather than administrative. | `typography.role`, `composition.vignette`, `typography.text_color_treatment`. | Medium. | `cta.resource_download_visualization`, `vignette.brand_color_role`. | Good |
| 38.829 | Returns to first animation after teaser/download detour. | Close the intro promise and begin actual teaching. | Keeps viewer oriented after side quest. | `temporal.position_in_video`, `editorial_role`. | Medium. | `narrative.detour_return_to_mainline`, `pedagogical.phase_start_marker`. | Good |
| 41.011 | "Real quick" timeout statement, talking-head side quest, possible soundtrack fade-out/silence/fade-in. | Separate a side note from the main lesson without hard confusion. | Helps viewer understand "this is a detour." | `speaker.has_pause`, `temporal.editorial_role`, `audio.music_energy`. | Medium-low until audio extracted. | `narrative.timeout_statement`, `music.crossfade_with_silence_bridge`, `sidequest.audio_boundary`. | Good |
| 48.309 | Riser foreshadows transition, then camera-shutter SFX and zoom-out asset transition. | Build, release, and punctuate transition into explanation asset. | Makes the next visual feel intentional. | `audio.has_audio_synced_cut`, `transition.type`. | Medium. | `audio.riser_to_shutter_release`, `asset.zoom_out_entry_sfx_pair`. | Good |
| 51.456 | Line-drawn callout points from map asset to "High Quality map image"; subtle luxury mouse-click text SFX; opacity-gradient text reveal. | Decompose the asset without changing the base visual. | Adds clarity while keeping one stable visual anchor. | `motion_graphics.has_data_viz`, `typography.animation_class`, `audio.sfx_class`. | Medium-high visually; audio needs verification. | `callout.line_drawn_explainer`, `text.opacity_gradient_reveal`, `audio.subtle_click_text_reveal`. | Good |
| 53.922 | Second callout points different direction to make room for text. | Maintain order and avoid overlapping callouts. | Preserves readability as annotation density grows. | `composition.visual_density`, `typography.placement_zone`. | High visually. | `callout.directional_layout_avoidance`, `annotation.spatial_planning`. | Good |
| 56.598 | More callout text; Joshua notes possible improvement: blur inactive callouts and pan along line. | Current edit favors static blueprint clarity; suggested stronger focus choreography. | Avoids clutter, but could emphasize active callout better. | `typography.keyword_count`, `composition.visual_density`. | High visually. | `annotation.active_callout_focus`, `annotation.inactive_blur_state`, `camera.callout_follow_pan`. | Neutral-good |
| 60.759 | Additional callout text added to same base asset. | Use one asset efficiently as an explanatory board. | Reduces visual switching while explaining multiple parts. | `motion_graphics.overlay_layer_count`. | High. | `asset.explanatory_anchor_reuse`, `annotation.accumulation_state`. | Good |
| 64.339 | Dense callout/blueprint frame remains orderly despite risk of clutter. | Push high annotation density while preserving structure. | Lets viewer inspect multiple components. | `composition.visual_density`, `typography.placement_zone`. | High. | `annotation.blueprint_orderliness_score`, `callout_collision_avoidance`. | Good |
| 68.976 | Riser + shutter variant transitions to second explanatory asset. Repeated SFX is pitch/intensity-varied. | Introduce a new asset while preventing repeated shutter fatigue. | Signals progression and preserves novelty. | `audio.sfx_class`, `transition.type`. | Medium. | `audio.shutter_variant_pitch_intensity`, `asset.explainer_next_state`. | Good |
| 74.898 | Hot/flash-burn transition; asset starts zoomed into edge, then reorients/zooms/slides into normal view. | Introduce an asset with premium cinematic motion. | Makes even static assets feel alive. | `transition.type`, `camera.movement_class`, `composition.has_depth_layering`. | High visually. | `asset.edge_zoom_reveal`, `transition.hot_burn`, `asset.reorientation_curve`. | Good |
| 104.821 | Background/cardboard/static assets noted as reusable tutorial resources. | Build a richer asset pool for documentary backgrounds. | Gives future system more options for texture and context. | `motion_graphics.has_image_asset`, `composition.background_treatment`. | Medium as tutorial note. | `asset.background_cardboard_style`, `asset.texture_library_need`. | Neutral-good |
| 125.718 | Halftone/blue-mosaic style applied to assets to increase vintage/luxury feel. | Upgrade ordinary assets into documentary/premium texture. | Avoids raw asset looking cheap. | `composition.color_palette`, `motion_graphics.has_depth_layering`. | Medium. | `asset.surface_treatment_halftone`, `asset.premiumization_filter`. | Good |
| 283.356 | Camera/null/keyframe technique makes flat objects feel 3D. | Add cinematic depth to documentary graphics. | Makes flat text/assets feel spatial. | `camera.movement_class`, `motion_graphics.has_depth_layering`. | Medium-high as tutorial claim. | `camera.null_control_stack`, `asset.flat_to_3d_motion`. | Good |
| 290.520 | Similar flash-burn/zoom reveal happens from lower-left quadrant with asset oriented toward upper-right. | Reuse same technique with spatial variation. | Maintains grammar while avoiding repetition. | `transition.type`, `camera.movement_class`. | Medium-high. | `asset.zoom_origin_quadrant`, `asset.orientation_before_settle`. | Good |
| 293.085 | Movement along asset accompanied by whoosh. | Bind motion to sound. | Makes camera/asset movement feel physical. | `audio.motion_follow_sfx`, `camera.movement_class`. | Medium. | `audio.motion_path_sync`, `sfx.motion_follow_direction`. | Good |
| 322.668 | Listing completion transitions into new section with high-pitched riser, then back to talking head. | Mark section completion and reset attention. | Lets viewer know a chunk ended. | `audio.sfx_class`, `temporal.sequence_trend`. | Medium. | `spoken_marker.list_completion`, `section.reset_riser`. | Good |
| 327.232 | Talking-head return starts zoomed-in and zooms out smoothly. | Make host return cinematic and avoid static framing. | Prevents talking-head fatigue. | `camera.movement_class`, `crop_tightness`. | High visually. | `speaker.return_zoom_out_phase`, `talking_head.breathing_motion`. | Good |
| 335.146 | Important statement gets camera zoom-in instead of text; subtle background SFX supports it. | Emphasis without overlay clutter. | Forces concentrated listening. | `camera.movement_class`, `speaker.has_emphasis`, `audio.sfx_class`. | Medium-high. | `camera.semantic_emphasis_zoom`, `emphasis.no_text_needed`. | Good |
| 341.560 | Slow then fast zoom-out from speaker, then cut to background instead of using riser. | Use camera motion as transition foreshadowing to avoid riser overuse. | Maintains anticipation while reducing sonic density. | `camera.movement_class`, `transition.type`. | Medium. | `camera.foreshadow_transition`, `audio.riser_avoidance_reason`. | Good |
| 346.679 | Highly creative masked text: text inside text, moving highlight behind text, watery/white overlap effect. | Create premium text spectacle and visual novelty. | Makes a conceptual phrase memorable. | `typography.animation_class`, `typography.text_color_treatment`, `motion_graphics.has_depth_layering`. | Medium: needs frame capture. | `typography.text_inside_text_mask`, `typography.moving_highlight_backplate`, `typography.liquid_overlap_fill`. | Good |
| 354.109 | Another zoom/pan-out foreshadows transition without riser. | Let camera movement carry anticipation. | Reduces repeated audio build-up. | `camera.movement_class`, `transition.type`. | Medium. | `camera.transition_anticipation_curve`. | Good |
| 356.368 | Impact sound introduces a semantically weighty UI/product/channel asset. | Give a high-value asset enough arrival weight. | Helps viewer mark it as important. | `audio.sfx_class`, `motion_graphics.has_image_asset`. | Medium. | `audio.semantic_weight_impact`, `asset.ui_importance_arrival`. | Good |
| 357.236 | Talking-head video rises into frame with vignette/opacity blending. | Treat the talking head itself like an animated asset. | Makes return to host feel designed, not raw cut. | `transition.type`, `composition.vignette`. | Medium-high visually. | `talking_head.as_layered_asset`, `video_layer.opacity_edge_blend`, `transition.vertical_reveal_host`. | Good |
| 360.076 | Speaker shot zooms toward normal frame, then cuts early around partial progress into full fit. | Create a stylish motion interruption rather than waiting for full easing completion. | Adds visual snap and freshness. | `camera.movement_class`, `transition.type`. | Medium. | `camera.partial_progress_cut`, `zoom_completion_skip`. | Good |
| 366.192 | Talking-head video layer moves right-to-left inside the frame with blend/vignette. | Vary host transition direction to avoid pattern fatigue. | Keeps viewer expecting motion variation. | `transition.type`, `camera.movement_class`. | Medium. | `video_layer.frame_within_frame_motion`, `transition.direction_variation_strategy`. | Good |
| 369.406 | Continuation: move-out animation with swoosh into explanatory animation. | Complete the host-to-asset handoff physically and sonically. | Clarifies direction of attention. | `audio.sfx_class`, `transition.type`. | Medium. | `transition.host_exit_to_asset`, `audio.directional_swoosh_exit`. | Good |
| 383.632 | Sales/product B-roll uses PiP-like animated assets with 3D camera tilt; Joshua notes richer easing possibility. | Make sales proof assets feel premium and dimensional. | Gives commercial section more credibility. | `composition.has_pip`, `camera.movement_class`, `motion_graphics.micro_animation_family`. | Medium. | `commercial.pip_proof_asset`, `asset.easing_breath_pause`, `camera.saas_motion_style`. | Context-dependent |
| 412.406 | Explainer text/line-drawing pattern appears again for a principal asset. | Semantic extraction to label relevant asset relationships. | Makes abstract or complex claims visually parseable. | `typography.has_text`, `motion_graphics.has_image_asset`. | Medium. | `semantic_extraction_to_callout`, `callout.relationship_label`. | Good |
| 628.010 | Tutorial notes null stacking, 3D edits, dynamic 3D editing. | Technical explanation of how premium movement is made. | Gives feature extractor a cause for smooth motion. | `camera.movement_class`. | Medium as tutorial note. | `technique.null_stacking`, `technique.dynamic_3d_editing`. | Neutral-good |
| 636.333 | CTA/detour uses plain white text and reddish vignette; Joshua critiques missed chance for script/gradient emphasis. | Functional CTA, less premium than earlier treatments. | Communicates offer but could carry more weight. | `typography.has_text`, `composition.vignette`. | Medium. | `cta.visual_weight_score`, `cta.keyword_font_emphasis`, `vignette.palette_flexibility`. | Neutral |
| 790.090 | Micro complementing explainer again: transparent asset + supporting text + drawn line. | Clarify components without replacing main asset. | Reduces explanation ambiguity. | `motion_graphics.overlay_layer_count`, `typography.role`. | Medium. | `callout.repeated_explainer_pattern`, `asset.transparent_support_state`. | Good |
| 838.332 | Listing/roadmark style with numbers fading through opacity/gradient; Joshua suggests pan/blur enhancements. | Summarize or sequence core things in a premium way. | Gives viewer an elegant roadmap. | `typography.text_color_treatment`, `temporal.editorial_role`. | Medium-high. | `list.roadmark_component`, `number.opacity_gradient_fade`, `list.focus_progression_pan`. | Good |
| 950.701 | Glitch SFX and glitch transition to next frame. | Match audio and visual texture for a hard style switch. | Makes transition feel intentional and energetic. | `transition.type`, `audio.sfx_class`. | High after audio verification. | `audio_visual_glitch_coupling`, `transition.glitch_texture_strength`. | Good |
| 1182.330 | Tutorial explains two-node/keyframe/speed-graph camera motion, Vox/SaaS-like documentary movement. | Teach how to produce cinematic smoothness. | Gives repeatable cause for premium movement. | `camera.movement_class`, `motion_graphics.has_depth_layering`. | Medium as tutorial note. | `camera.two_node_control`, `camera.speed_graph_smoothness`, `camera.saas_documentary_motion`. | Neutral-good |
| 1245.220 | End segment uses multiple plain cuts back to speaker, surprisingly no SFX or transition. | Likely neutral end-phase simplification; no key point needing punctuation. | Does not overwork the ending, but does not add much either. | `transition.type`, `audio.has_silence_gap`. | Medium after audio check. | `end_phase.plain_cut_neutrality`, `audio.no_sfx_low_importance_cut`. | Neutral |

## Candidate Feature Deltas From Reference 02

### Tutorial/Pedagogy

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `visual_register` | `talking_head`, `graphic_preview`, `annotated_breakdown`, `screen_recording`, `cta`, `commercial_proof` | Tutorial meaning changes by register; Kimi was right that this is core. | Seen reliably across refs 2-5 or enough tutorial packets. |
| `pedagogical_phase` | `preview`, `teaser`, `resource_cta`, `breakdown`, `construction`, `sidequest`, `recap`, `commercial` | This video uses show/tease/label/build loops. | Transcript and frame sequence agree. |
| `narrative.timeout_statement` | boolean | "Real quick" creates a side quest boundary. | ASR detects phrase and visual/audio boundary agrees. |
| `asset.explanatory_anchor_reuse` | boolean | One asset can host many callouts. | Callout accumulation can be measured. |
| `annotation.accumulation_state` | `single`, `growing`, `dense_blueprint`, `cleared` | Dense callouts are a separate clarity mode. | Frame/OCR/callout detection works. |
| `annotation.blueprint_orderliness_score` | `low`, `medium`, `high` | Dense annotations can be elegant or messy. | Needs human-rated examples first. |

### Callouts/Text

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `callout.line_drawn_explainer` | boolean | Line drawing from asset to label is a repeated Joseph clarity primitive. | Seen in 3+ references. |
| `callout.directional_layout_avoidance` | `left`, `right`, `up`, `down`, `diagonal`, `mixed` | Direction changes to avoid collisions and preserve readability. | OCR/layout detection can infer it. |
| `annotation.active_callout_focus` | boolean | Candidate improvement: blur/pan to current callout. | Promote only if Joseph actually does it in later refs. |
| `text.opacity_gradient_reveal` | boolean | Apple-like text reveal via opacity gradient appears repeatedly. | Frame review confirms. |
| `text.knockout_mask_fill` | boolean | Background showing through text is a premium treatment here. | Detector/frame review confirms. |
| `typography.text_inside_text_mask` | boolean | Reference 02 has a highly creative masked text-within-text style. | More examples needed. |
| `typography.moving_highlight_backplate` | boolean | Highlight rectangle moves behind text instead of merely coloring text. | More examples needed. |
| `typography.liquid_overlap_fill` | boolean | Watery/white overlap treatment during highlight crossing. | Manual-only until detector exists. |
| `list.roadmark_component` | boolean | Numbered roadmap/list style is a distinct asset type. | Seen in more refs. |

### Audio/SFX

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `audio.transition_motion_match` | boolean | Whoosh direction should match visual transition direction. | Audio+motion alignment can be verified. |
| `audio.text_sfx_material_metaphor` | `water_drop`, `click`, `gear`, `paper`, `glitch`, `unknown` | Text SFX has texture/material meaning, not only type. | Audio classification/human labels align. |
| `audio.same_function_variant_sfx` | boolean | Repeated list/transition functions vary SFX pitch/intensity. | Seen across refs. |
| `audio.no_sfx_transition_reason` | `fatigue_relief`, `low_importance`, `rhetorical_space`, `unknown` | No-SFX transitions are decisions. | Requires audio proof and human agreement. |
| `audio.riser_to_shutter_release` | boolean | Build with riser, release with shutter/asset arrival. | Audio sync confirms pattern. |
| `audio.motion_path_sync` | boolean | SFX follows movement along asset/camera path. | Needs waveform + motion timing. |
| `audio.semantic_weight_impact` | boolean | Impact SFX reserved for semantically heavy UI/product asset. | Seen in multiple heavy-meaning arrivals. |
| `audio_visual_glitch_coupling` | boolean | Glitch transition uses matching glitch SFX. | Verifiable from MP4. |

### Camera/Transition/Composition

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `transition.directional_axis` | `up`, `down`, `left`, `right`, `diagonal`, `zoom`, `none` | Joshua repeatedly notes directional transition variants. | Motion extraction can estimate it. |
| `transition.variant_family` | `whoosh`, `soft_blur`, `hot_burn`, `flash_burn`, `glitch`, `plain_cut`, `zoom_out`, `host_layer_slide` | Same base function uses varied visual family. | Stable labels emerge. |
| `asset.edge_zoom_reveal` | boolean | Asset starts zoomed into edge, then resolves to full view. | Seen more than once in this video. |
| `asset.zoom_origin_quadrant` | `upper_left`, `upper_right`, `lower_left`, `lower_right`, `center` | Asset reveal origin affects motion feel. | Frame tracking can infer it. |
| `camera.semantic_emphasis_zoom` | boolean | Speaker zoom-in can replace text emphasis. | Seen across refs. |
| `camera.foreshadow_transition` | boolean | Camera zoom/pan itself can signal upcoming transition instead of riser. | Seen repeatedly. |
| `camera.partial_progress_cut` | boolean | Cut interrupts zoom before full completion for snap. | Needs frame-level proof. |
| `video_layer.frame_within_frame_motion` | boolean | Talking-head layer moves inside the frame with blend/vignette. | Strong in this reference. |
| `talking_head.as_layered_asset` | boolean | Speaker video is treated as an animated asset, not raw footage. | Seen across refs. |
| `video_layer.opacity_edge_blend` | boolean | Vignette/opacity blend applied to video layer edges. | Needs visual verification. |
| `asset.premiumization_filter` | `halftone`, `blue_mosaic`, `vintage_texture`, `grain`, `none` | Raw asset treatment raises perceived quality. | More examples needed. |

### Commercial/CTA

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `cta.resource_download_visualization` | boolean | Download/project-file CTA gets visual treatment. | Useful for tutorial templates. |
| `cta.visual_weight_score` | `low`, `medium`, `high` | Some CTAs are plain and arguably underweighted. | Needs human rating. |
| `commercial.pip_proof_asset` | boolean | Product/sales proof can use animated PiP-style assets. | Relevant for commercial videos only. |
| `end_phase.plain_cut_neutrality` | boolean | End-phase plain cuts may be acceptable neutral moves. | Need more ending audits. |

## Current 74-Feature Coverage Assessment

| Family | Coverage from this reference | Issue |
| --- | --- | --- |
| Camera | Medium-high | Current features need semantic camera roles: emphasis zoom, foreshadow zoom, layered host motion. |
| Typography | Medium-high | Missing premium text subtypes: knockout masks, opacity gradients, moving highlights, text-inside-text. |
| Motion graphics | High | Existing overlay/data-viz features help, but callout/blueprint pedagogy needs its own vocabulary. |
| Composition | Medium | Needs video-layer edge blending, vignette palette role, and asset premiumization filters. |
| Transitions | Medium | Needs directional axis, variant family, plain-cut reason, hot/flash/glitch texture. |
| Audio | Medium | Better than Kimi's pass, but still needs waveform extraction to verify SFX/no-SFX claims. |
| Temporal | Medium-high | Pedagogical phase and sidequest/timeout markers are new high-value concepts. |
| Speaker vocal | Medium | Needs relation between important statements and camera zoom/no-text emphasis. |
| Genome dimensions | Medium | Useful but too coarse for tutorial-specific edit decisions. |

## SFX/Audio Findings To Verify From MP4

These should be checked before marking them trainable:

- 1.031: UI/gear-like intro SFX.
- 2.165: whoosh on upward transition.
- 4.915: dropped-water-like text SFX.
- 15.378: riser before numbered animation.
- 24.513: variant SFX on third list item.
- 34.344: no dedicated SFX on fast zoom-out transition.
- 41.011: soundtrack fade-out, silence, fade-in around "real quick."
- 48.309: riser to shutter release.
- 68.976: shutter variant with changed frequency/pitch/intensity.
- 293.085: whoosh following asset movement.
- 322.668: high-pitched riser at section completion.
- 356.368: impact sound for heavy UI/product asset.
- 369.406: directional swoosh on host exit to animation.
- 950.701: glitch SFX paired with glitch transition.
- 1245.220: end cuts with no SFX.

## Training Safety Decisions

Train now only after frame/audio extraction:

- visual register
- pedagogical phase
- annotation density and accumulation
- callout line/direction
- asset zoom origin quadrant
- speaker micro zoom-in/zoom-out
- hot/flash/glitch transition family
- CTA/resource text presence

Manual-only for now:

- "water-drop" text sound material metaphor
- vignette color meaning
- whether the 636s CTA was underweighted
- whether plain end cuts are neutral by intent
- whether text-inside-text liquid highlight generalizes

Defer:

- exact SFX timing offsets
- music crossfade/silence bridge
- active callout focus unless later videos prove it
- UI focus regions inside AE until we build UI detection
- speed-graph/null-stack technique as a direct extractor feature

Reject as direct training features:

- "more callouts equals better clarity"
- "more transition variety equals better quality"
- "every transition needs SFX"
- "every CTA needs gradient/script treatment"
- "using Joseph's exact colors/fonts equals quality"

## What This Reference Adds Beyond Reference 01

Reference 01 strongly supported:

- SFX lifecycle
- asset entry/exit sound
- sonic substitution
- teaser retention contract
- number counter and value anchor grammar
- silence/no-SFX as pattern break

Reference 02 adds:

- tutorial-specific visual register
- show/tease/label/build pedagogy
- line-drawn callout explainers
- dense but orderly blueprint annotations
- camera motion as transition foreshadowing
- host video treated as an animated layer
- premiumizing raw assets via halftone/vintage texture
- text opacity gradient and text-inside-text treatments
- documentary/AE-specific camera/null-stack movement concepts

## Required Next Evidence

For reference 03:

1. Keep raw timestamp notes with uncertainty intact.
2. Especially mark SFX/no-SFX exceptions.
3. Track whether the video is tutorial, documentary essay, commercial, or mixed.
4. Note when camera motion substitutes for text or sound emphasis.
5. Note when an asset is reused as an explainer board with multiple callouts.
6. Mark any edit as neutral/harmful when it does not meaningfully improve the viewer's state.

The current running hypothesis after 2/5:

> Joseph's editing grammar is less about individual effects and more about
> lifecycle-aware multimedia punctuation: visuals, SFX, camera motion, text,
> callouts, and silence are chosen according to section role, viewer fatigue,
> semantic emphasis, and tutorial clarity.
