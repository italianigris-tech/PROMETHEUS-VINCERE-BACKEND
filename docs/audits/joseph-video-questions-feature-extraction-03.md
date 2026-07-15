# Joseph Video Questions Feature Extraction 03

Status: third reference packet for #57/#58/#60
Source video: `JOSEPH VIDEO PROOF/Answering_Your_Top_Video_Editing_Questions_in_15minutes     third video.mp4`
Video title: `Answering Your Top Video Editing Questions in 15minutes!`

Verified media metadata:

- Duration: 769.021678 seconds
- Resolution: 1280x720
- Frame rate: 30 fps
- Video codec: AV1
- Audio: AAC stereo, 44100 Hz
- File size: 44,395,091 bytes

Input evidence:

- Great Joshua raw timestamp analysis for the third video.
- Local MP4 asset present in `JOSEPH VIDEO PROOF`.

This file is not final training approval. It is reference 3 of 5. The main
difference from references 1 and 2 is that this video is a Q&A/commentary format:
the base loop is question card or prompt, return to speaker, answer, then next
question. Because of that, repetition itself becomes useful evidence. Joseph uses
variation where the question is semantically important, and lets lower-value
questions ride on a simpler zoom/pan/flash grammar.

## Packet Status

Reference 1 is stored at:

- `docs/audits/joseph-masterclass-feature-extraction-01.md`
- `docs/audits/joseph-masterclass-feature-extraction-01.events.json`

Reference 2 is stored at:

- `docs/audits/joseph-cinematic-documentary-feature-extraction-02.md`
- `docs/audits/joseph-cinematic-documentary-feature-extraction-02.events.json`

This third packet should be used later with references 4-5 to decide which
candidate deltas become canonical feature catalog entries.

## First-Pass Score

Raw decision coverage from this packet:

- Raw timestamp observations: 61.
- Observed key edit decisions after grouping: 38.
- Explainable by current catalog: about 24.
- Explainable after candidate deltas below: about 34.
- Training-safe now with the MP4 available but without automated frame/audio extraction: about 20.

Interpretation:

- The strongest new evidence is Q&A-specific pacing: not every user question
  earns a full visual system.
- The most important new feature area is emotional/sonic phase shifting: silence,
  reverberant snap, motivational music, red typography, and full-sentence text
  combine to mark one statement as unusually important.
- This reference strengthens features from references 1 and 2: SFX variation,
  no-SFX cuts, semantic text extraction, talking-head micro zooms, vignette as
  focus/luxury, and animation-out as part of asset lifecycle.

## High-Value Event Audit

| Time | What happened | Why a human editor likely did it | Viewer problem solved | Current feature coverage | Reliability | Missing feature delta | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0.000 | Opening light/riser transition, speaker holds phone/post as the attention object, background/face subtly grayed or blurred while hand/phone stays central. | Replace a generic graphic with embodied proof and focus the viewer on the object being discussed. | Makes the topic concrete immediately and avoids a static talking-head start. | `composition.vignette`, `camera.movement_class`, `motion_graphics.has_image_asset`, `audio.sfx_class`. | Medium: raw notes are strong, exact blur/SFX needs frame/audio check. | `attention.spotlight_on_physical_object`, `asset.embodied_proof_role`, `audio.spotlight_entry_sync`. | Good |
| 2.065-3.068 | Camera/pan transition moves from talking head into animation/device scene; dark background, animated device entry, whooshes on device/camera movement. | Shift from human setup to visual explanation while preserving physical motion continuity. | Viewer understands that the phone/post concept has become the explainable asset. | `transition.type`, `transition.directional_axis`, `audio.sfx_class`. | Medium. | `transition.host_to_device_scene`, `audio.device_motion_whoosh`, `device.asset_entry_lifecycle`. | Good |
| 6.829-10.450 | Zoom-out return to speaker happens without obvious SFX, followed by shutter/snap-like transition, UI/gear scrolling sound, and animation-to-animation transition with rich riser/UI effect. | Vary transition punctuation in a dense opening and avoid one repeated sound grammar. | Keeps pace high without making every cut sonically identical. | `transition.type`, `audio.has_silence_gap`, `audio.sfx_class`. | Medium: no-SFX claim needs audio verification. | `audio.transition_punctuation_palette`, `audio.ui_gear_scroll_sfx`, `transition.animation_to_animation_bridge`, `audio.no_sfx_transition_reason`. | Good |
| 14.683-17.530 | Meme injection and PiP meme B-roll appear over current frame with meme-like sounds. | Add relatability and comedic relief inside an otherwise premium editing style. | Humanizes the Q&A and breaks professional stiffness. | `composition.has_pip`, `motion_graphics.has_image_asset`, `audio.sfx_class`, `temporal.novelty_level`. | High visually if frame-reviewed; medium for intent. | `humor.meme_injection_role`, `pip.overlay_meme_broll`, `professionalism.relatability_tradeoff`. | Context-dependent |
| 20.085 | Meme/name layer clears, then slow zoom-in begins as he says he will speedrun/answer many questions. | Shift from joke mode back into serious informational mode. | Helps viewer feel the transition from comic relief to agenda. | `camera.movement_class`, `speaker.has_emphasis`, `temporal.editorial_role`. | Medium-high. | `mode_shift.comedy_to_serious`, `camera.agenda_emphasis_zoom`. | Good |
| 21.744-31.305 | Light flash/burn transitions, personalized posts/tweets as assets, flash return to speaker, riser into "let's dive right in," then short whoosh and light leak into core section. | Use personally relevant assets as proof, then punctuate the move from setup to first question. | Establishes source credibility and marks the Q&A start. | `transition.type`, `motion_graphics.has_image_asset`, `audio.sfx_class`, `temporal.position_in_video`. | Medium. | `asset.personalized_source_proof`, `section.qna_start_marker`, `audio.short_whoosh_plain_cut`, `transition.light_leak_section_reset`. | Good |
| 34.359 | First viewer question gets its own typography box/animation, then flashes back to speaker for answer. | Treat the question as a section inflection point instead of ordinary caption text. | Makes the Q&A structure legible. | `typography.role`, `transition.type`, `composition.visual_density`. | High visually after frame check. | `qna.question_card_importance`, `question.to_answer_handoff`, `question_card.animation_weight`. | Good |
| 35.884-40.199 | Left-side reddish vignette acts like a PiP substitute; numbered/list text appears on top with gradient/depth styling and letter-by-letter animation; labels extract only semantic cores like "cutting" and "pasting." | Explain a list without replacing the speaker frame or cluttering with full transcript. | Preserves speaker presence while making list structure and core concepts visible. | `composition.vignette`, `typography.text_color_treatment`, `typography.animation_class`, `typography.keyword_count`. | High visually after frame check. | `vignette.pip_substitute_panel`, `list.semantic_core_extraction`, `typography.depth_vector_entry`, `number.apple_gradient_treatment`. | Good |
| 45.091 | Text reveal uses a hybrid wrapper/gear/UI sound, pitch-altered and synced to text length rather than a standard typing sound. | Make text feel premium and tactile without cheap typewriter repetition. | Adds sonic richness while avoiding obvious stock text SFX. | `audio.sfx_class`, `typography.animation_class`. | Medium: audio needs extraction. | `audio.text_sfx_hybrid_material`, `audio.pitch_warped_ui_sfx`, `text.sfx_length_sync`. | Good |
| 49.662 | Vignette/list/theme blurs or fades out gracefully, apparently with no obvious SFX. | Give asset exit the same care as asset entry. | Avoids harsh disappearance and reduces sonic clutter. | `transition.type`, `audio.has_silence_gap`. | Medium. | `asset.animation_out_quality`, `vignette.graceful_exit`, `audio.exit_sfx_omission_reason`. | Good |
| 51.590-58.225 | Next question/point uses slick panel/flash transition back to speaker and a bottom/edge vignette with reddish LUT-matching tint. | Move to a fresh concept while keeping the video visually coherent. | Avoids staying too long on an animation with declining value. | `transition.type`, `composition.vignette`, `composition.color_palette`. | Medium-high visually. | `vignette.lut_color_coherence`, `animation.diminishing_returns_exit`, `vignette.slow_luxury_entry_curve`. | Good |
| 68.165-94.072 | Slow speaker zoom, light-flash new scene, gradient text typing, micro line-drawn explainers, camera pans from explainer line back to asset, then highlight tracks semantically relevant words. | Build clarity over an asset/text concept through staged focus rather than a single static layout. | Guides eye movement through a complicated concept. | `camera.movement_class`, `typography.animation_class`, `callout.line_drawn_explainer`, `composition.visual_density`. | High visually after frame check; medium for audio highlight SFX. | `camera.focus_handoff_pan`, `highlight.semantic_word_tracking`, `callout.contrast_to_background`, `overediting.restraint_decision`, `audio.highlight_motion_sfx`. | Good |
| 99.385 | Soundtrack is chill/casual rather than strict or high-tempo. | Make the Q&A feel conversational rather than a hard tutorial masterclass. | Lowers social distance and makes the video easier to sit through. | `audio.music_energy`, `temporal.editorial_role`. | Low-medium until audio extraction. | `music.casual_qna_bed`, `music.strictness_tone`. | Good |
| 127.612-132.275 | "Finally" gets a slow short pan/zoom into speaker, then a new question changes scene/background with transition and SFX. | Mark completion of one answer and open a new answer block. | Helps the viewer track progress across many questions. | `speaker.has_emphasis`, `camera.movement_class`, `transition.type`. | Medium. | `spoken_marker.answer_completion`, `qna.answer_to_question_scene_change`, `section.micro_reset_sfx`. | Good |
| 134.498-138.237 | Silence enters around a high-weight statement; reverberant finger-snap sits on the silence; background turns black/B-roll; full statement appears as cinematic text; "INSTEAD" appears in red with glitch-like text SFX and matching B-roll change. | Create an emotional/authority rupture: this is not another normal answer, it is the thesis moment. | Makes the advice land harder and resets attention through contrast. | `audio.has_silence_gap`, `audio.sfx_class`, `typography.text_color_treatment`, `motion_graphics.has_image_asset`. | Medium-high for raw observation; audio/visual sync should be verified. | `silence.thesis_punctuation`, `audio.reverberant_snap_on_silence`, `music.emotional_phase_shift`, `typography.red_exception_word`, `audio.text_glitch_sfx`, `statement.full_sentence_weight`. | Good |
| 139.384-141.658 | "What you need to do..." uses full phrase/ellipsis with gradient text, word-clicks, changing B-roll; longer phrase reduces clicks to core words; "inspiration" is extracted as the semantic noun and matched to refreshing floral B-roll. | Keep the motivational phase coherent while preventing click fatigue and over-transcription. | Makes the instruction feel complete but still edited. | `typography.keyword_count`, `audio.sfx_count`, `motion_graphics.has_image_asset`, `semantic_keyword_weight`. | Medium. | `ellipsis.anticipation_role`, `audio.click_thinning_for_long_text`, `semantic.keyword_action_state`, `broll.semantic_mood_match`. | Good |
| 141.658-143.530 | "That's it..." signals category/session change; soundtrack smoothly changes back after the motivational phase; a cut/pseudo-transition happens with no clear SFX. | Exit the emotional insert and return to the normal Q&A operating mode. | Prevents the special moment from swallowing the whole video. | `audio.music_energy`, `transition.type`, `audio.has_silence_gap`, `camera.movement_class`. | Medium. | `session.category_change_marker`, `music.return_to_base_mode`, `audio.no_sfx_after_phase_shift`. | Good |
| 146.767-166.206 | Animation asset remains valuable past its entry lifespan while speaker continues; subtle zoom into asset, then light-flash return to speaker with SFX; speaker zooms out, then later very slow zooms in/out while making long points; jazz bed noted. | Keep an asset alive as long as it carries explanatory value, then use speaker micro motion for emphasis without overcutting. | Maintains focus during a longer explanation. | `motion_graphics.has_image_asset`, `camera.movement_class`, `transition.type`, `audio.music_energy`. | Medium. | `asset.value_retention_after_entry`, `camera.long_point_slow_zoom`, `camera.return_to_baseline_zoom_out`, `music.jazz_refresh_phase`. | Good |
| 171.071-176.652 | Bottom-up reddish vignette and gradient text create a non-numbered list using an icon/logo-like marker; text has moving gradient/glint and a liquified gear-like SFX; zoom returns to baseline after list. | Avoid list-template predictability while retaining list clarity. | Gives recurring list moments variety without losing structure. | `composition.vignette`, `typography.text_color_treatment`, `audio.sfx_class`, `camera.movement_class`. | Medium-high visually; medium audio. | `list.non_numeric_marker_style`, `typography.gradient_glint_motion`, `audio.liquified_gear_text_sfx`, `camera.regression_to_mean_after_point`. | Good |
| 179.311-198.476 | Cut starts already zoomed in so it can zoom out; question acknowledgement returns to speaker with light flash/camera sound; later a different circular transition is used. | Reuse Q&A grammar while changing transition family enough to avoid baked-in sameness. | Maintains rhythm over repeated questions. | `camera.movement_class`, `transition.type`, `audio.sfx_class`. | Medium. | `camera.prezoomed_cut_start`, `transition.qna_return_variant`, `transition.circular_high_quality_family`, `audio.camera_snap_palette`. | Good |
| 216.103-228.019 | Slow zoom in/out repeats; then two exceptions appear: a spoken list receives no visual list, and an important point zooms out rather than in. Joshua flags possible auditor bias. | Show that not every semantically valid list or point deserves the expected visual rule. | Prevents over-editing and preserves human imperfection. | `camera.movement_class`, `typography.has_text`, `temporal.novelty_level`. | Medium. | `rule_exception.no_visual_list`, `rule_exception.emphasis_zoom_out`, `importance_threshold_for_list_visualization`, `auditor.bias_warning`. | Context-dependent |
| 238.217-277.197 | Zoom/pan refocuses speaker with a slow-fast-slow feel; later slow zoom focuses important point. | Use camera motion as the main attention engine during longer talking sections. | Keeps Q&A answers alive without needing constant assets. | `camera.movement_class`, `speaker.has_emphasis`. | Medium. | `camera.ease_profile_slow_fast_slow`, `talking_head.longform_motion_budget`, `camera.attention_engine_role`. | Good |
| 407.035-647.373 | Repeated Q&A cycles use slight transitions, wrap-up zoom-in, Apple-style UI/motion graphics, flash/camera-shutter returns, slow zooms, camera-snap variants, and light-burn zoom-out returns. | In repetitive Q&A, enough variation is used to preserve retention, but deep diversification is reserved for higher-value sections. | Avoids wasting heavy animation on structurally similar answers. | `transition.type`, `camera.movement_class`, `audio.sfx_class`, `typography.text_color_treatment`. | Medium. | `qna.repetition_tolerance`, `transition.variation_budget`, `answer.semantic_weight_to_animation_budget`, `audio.camera_snap_variant_family`. | Good |
| 744.453 | Conclusion uses pseudo-riser and then wraps; repeated middle question cycles are intentionally not over-audited because they add less new signal. | Signal closure without overcomplicating the ending. | Gives the video a final punctuation mark and avoids redundant analysis noise. | `audio.sfx_class`, `temporal.position_in_video`. | Medium. | `conclusion.pseudo_riser_closure`, `audit.redundancy_downweighting`, `qna.loop_redundancy_bias`. | Neutral-good |

## Candidate Feature Deltas From Reference 03

### Q&A / Narrative Structure

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `qna.question_card_importance` | `low`, `medium`, `high` | Some questions earn a full typography/scene package; others only need a light reset. | Question-card animation weight can be labeled across refs. |
| `question.to_answer_handoff` | `flash_return`, `camera_return`, `plain_cut`, `asset_continuation`, `unknown` | Q&A videos repeatedly hand off from user question to speaker answer. | Seen in more Q&A or comment-response videos. |
| `qna.repetition_tolerance` | `low`, `medium`, `high` | Repetition can be acceptable when the video format itself repeats. | Multiple Q&A loops show same structure without audience-fatigue penalty. |
| `answer.semantic_weight_to_animation_budget` | `low`, `medium`, `high` | Heavy animation is reserved for high-value questions/thesis moments. | Human annotations agree on semantic weight. |
| `session.category_change_marker` | boolean | Phrases like "that's it" or "it's time to" mark section/category shifts. | ASR phrase and visual/audio reset align. |
| `audit.redundancy_downweighting` | boolean | Repeated loops should not dominate the final feature catalog. | Useful for synthesis, not runtime training. |

### Audio / Music / Silence

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `silence.thesis_punctuation` | boolean | Silence before a thesis statement makes the statement feel unusually important. | Audio extraction confirms drop plus strong statement. |
| `audio.reverberant_snap_on_silence` | boolean | A snap/reverb can sit on silence as premium emphasis. | More examples or clear waveform proof. |
| `music.emotional_phase_shift` | `motivational`, `casual`, `jazz_refresh`, `base_return`, `urgent`, `unknown` | The video changes track/feel for emotional meaning, not only pacing. | Audio phase labels become consistent. |
| `music.return_to_base_mode` | boolean | Special emotional inserts need a return point. | Track change aligns with end of special segment. |
| `audio.click_thinning_for_long_text` | boolean | Long text does not get one click per word; only key words are clicked. | Confirmed across long text reveals. |
| `audio.text_sfx_hybrid_material` | `gear_wrapper`, `liquified_gear`, `glitch_text`, `pressurized_release`, `unknown` | Joseph often warps familiar SFX into luxury-adjacent variants. | Human labels stabilize or audio classifier supports it. |
| `audio.transition_punctuation_palette` | `whoosh`, `camera_snap`, `shutter`, `riser_ui`, `glitch`, `none`, `mixed` | Q&A repetition needs multiple sounds for the same transition role. | Seen across many transitions. |

### Typography / Semantic Text

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `list.semantic_core_extraction` | boolean | Lists show distilled words, not full transcript. | OCR/transcript comparison confirms shortening. |
| `statement.full_sentence_weight` | boolean | Some full sentences are shown because the complete claim matters. | Used selectively for thesis/quote moments. |
| `typography.red_exception_word` | boolean | Red word treatment marks a rare semantic/emotional exception. | More rare-emphasis examples. |
| `ellipsis.anticipation_role` | boolean | Ellipsis can be intentional anticipation, not transcription filler. | Seen in edited text tied to pending reveal. |
| `semantic.keyword_action_state` | `noun`, `verb`, `imperative`, `past_participle`, `unknown` | The right extracted word may be "inspiration" rather than "inspired." | Needs semantic annotation agreement. |
| `typography.gradient_glint_motion` | boolean | Moving shine/gradient through already-gradient text is a premium treatment. | Frame review confirms. |

### Visual / Camera / Composition

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `attention.spotlight_on_physical_object` | boolean | The editor can use the speaker's body/phone as the asset instead of graphics. | Object detection/frame review supports it. |
| `vignette.pip_substitute_panel` | boolean | Vignette can create a soft panel for text/list without literal PiP. | Seen in multiple vignette-list examples. |
| `vignette.lut_color_coherence` | `matched`, `contrasting`, `unknown` | Reddish vignette appears coherent with grade/lighting. | Palette extraction and human label agree. |
| `asset.animation_out_quality` | `harsh`, `neutral`, `graceful`, `unknown` | Asset exit deserves feature attention, not only entry. | Exit timing/easing can be labeled. |
| `camera.focus_handoff_pan` | boolean | Camera pan can move attention from callout to asset instead of blur/spotlight. | Motion tracking confirms. |
| `highlight.semantic_word_tracking` | boolean | Highlight follows only words with bearing on the spoken point. | OCR/transcript alignment works. |
| `camera.regression_to_mean_after_point` | boolean | After emphasis/list completion, frame returns to baseline crop. | Crop tracking supports it. |
| `camera.prezoomed_cut_start` | boolean | Cut starts zoomed-in so a zoom-out can happen immediately. | Frame crop before/after cut confirms. |
| `camera.ease_profile_slow_fast_slow` | boolean | Long talking-head movement may use a subtle non-linear ease profile. | Needs frame-level motion extraction. |

## Current 74-Feature Coverage Assessment

| Family | Coverage from this reference | Issue |
| --- | --- | --- |
| Camera | Medium-high | Current movement labels miss Q&A-specific emphasis, prezoomed cuts, baseline return, and longform motion budget. |
| Typography | Medium-high | Current features need semantic extraction, full-sentence thesis treatment, exception-word color, and gradient glint motion. |
| Motion graphics | Medium | Existing asset flags help, but question cards and vignette-as-panel need their own roles. |
| Composition | Medium | Vignette is not just "present"; it can substitute for PiP, match LUT, and host list text. |
| Transitions | Medium | Needs Q&A handoff role, transition variation budget, and camera-snap palette labels. |
| Audio | Medium | Strong candidate evidence for silence, snap/reverb, click thinning, SFX warping, and soundtrack phase shifts. |
| Temporal | Medium-high | Q&A loop structure and special insert/return phases are important. |
| Speaker vocal | Medium | Spoken markers like "finally," "instead," and "that's it" drive edit decisions. |
| Genome dimensions | Medium | Useful globally, but too coarse for the Q&A loop economics shown here. |

## SFX/Audio Findings To Verify From MP4

These should be checked before marking them trainable:

- 0.000: opening riser/light-effect sync.
- 3.068: whoosh per device/camera movement.
- 6.829: zoom-out return with no obvious SFX.
- 7.959: shutter/finger-snap hybrid transition sound.
- 8.699: UI/gear scroll sound while assets move.
- 10.450: riser plus impact/UI effect in animation-to-animation transition.
- 14.683: meme-based sounds.
- 29.437: riser under "let's dive right in."
- 45.091: text sound as wrapper/gear/UI hybrid.
- 49.662: graceful blur-out with no obvious SFX.
- 94.072: pressurized/low-pitch highlight motion SFX.
- 99.385: casual/chill soundtrack bed.
- 134.498: silence drop and reverberant finger-snap.
- 137.419: altered mouse-click per text word.
- 138.237: glitch-like SFX on "INSTEAD."
- 140.437: click thinning across a longer text phrase.
- 143.385: smooth soundtrack return after motivational insert.
- 143.530: cut/pseudo-transition with no clear SFX.
- 173.555: liquified gear-like text SFX.
- 179.588: camera snap/shutter variant.
- 473.711: possible glitch transition into wrap-up.
- 539.661: tapping camera snap variant.
- 744.453: pseudo-riser conclusion.

## Training Safety Decisions

Train now only after extraction support:

- Q&A question-card presence and handoff type.
- Speaker micro zoom-in/zoom-out around answer points.
- Visual list vs spoken-only list.
- Vignette panel direction and color.
- Full-sentence thesis text vs semantic-core list text.
- Transition family variation across repeated Q&A loops.

Manual-only for now:

- Whether a given vignette is "luxury" rather than just focus/depth.
- Whether a B-roll mood truly matches "inspiration."
- Whether silence was a deliberate thesis device or an audio bed gap.
- Whether click thinning was intentionally key-word-only.
- Whether a repeated Q&A loop is sufficiently low-value to downweight.

Defer:

- Exact SFX offset relative to word/visual entry.
- Music phase names until audio embeddings or waveform segmentation exist.
- Fine-grained SFX material metaphors such as liquified gear or wrapper gear.
- Speed-curve/ease-profile claims without frame-level crop tracking.

Reject as direct training features:

- "Every question needs a question-card animation."
- "Every important point must zoom in."
- "Red text always means emotional importance."
- "Meme insertion always improves trust."
- "Repeated Q&A transition grammar is bad by default."

## What This Reference Adds Beyond References 01-02

Reference 01 strongly supported:

- SFX lifecycle.
- Asset entry/exit sound.
- Sonic substitution.
- Teaser retention contracts.
- Number/value anchor grammar.
- Silence/no-SFX as pattern break.

Reference 02 added:

- Tutorial visual registers.
- Show/tease/label/build pedagogy.
- Line-drawn callout explainers.
- Dense but orderly blueprint annotations.
- Camera motion as transition foreshadowing.
- Host video treated as an animated layer.

Reference 03 adds:

- Q&A loop grammar and question-card weight.
- Semantic weight to animation budget.
- Vignette as PiP substitute and list host.
- Asset animation-out quality.
- Silence plus reverberant snap as thesis punctuation.
- Motivational/emotional music phase insert and return.
- Click thinning for long text.
- Spoken-only list as a valid exception.
- Human imperfection/bias as something to preserve, not erase.

## Required Next Evidence

For reference 04:

1. Keep raw timestamp notes with uncertainty intact.
2. Mark when a repeated pattern is accepted because the video format repeats.
3. Pay special attention to "animation-out" and how assets leave.
4. Track whether music changes are emotional, structural, or just energy refresh.
5. Mark spoken-only concepts that intentionally receive no visual asset.
6. Call out any moment that feels bad or over-justified, not only the successful ones.

The current running hypothesis after 3/5:

> Joseph's editing grammar is lifecycle-aware and budget-aware. He spends heavy
> visual, sonic, and typographic treatment where the viewer needs proof, clarity,
> emotional weight, or section reset; he withholds it when repetition, fatigue, or
> low semantic weight would make the edit feel overdone.
