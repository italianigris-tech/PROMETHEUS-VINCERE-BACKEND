# Joseph Masterclass Feature Extraction 01

Status: first reference packet for #57/#58/#60
Source video: `The Complete Guide to Editing like Iman Gadzhi in 2026! (Masterclass)`
Input evidence:

- Great Joshua raw timestamp transcript, full pass.
- Kimi synthesis/fine-tune of the same transcript.
- Supplied folder: `THE JOSEPH SOUND EFFECTS (THE ONES THAT I COULD FIND)`.
- Existing library folder: `SOUND FX`.

This file is not final training approval. It is the first of five reference
feature-audit packets. Promote features to the canonical catalog only after the
remaining references show the same idea is real and not one-video noise.

## SFX Library Result

The supplied Joseph SFX folder contains 27 audio files. All 27 already exist in
the main `SOUND FX` library, so no binary copies were made. The important work is
classification and usage mapping.

| Joseph-observed use | Existing library file | Library category | Training note |
| --- | --- | --- | --- |
| Camera shutter for asset/list item entry | `SOUND FX/MECHANICAL CLICKS/camera-shutter-18399.mp3` | Mechanical clicks | Strong Joseph pattern: asset entry and grouped list punctuation. |
| Alternate camera/capture transition | `SOUND FX/TRANSITIONS/freesound_community-camera-shutter-6305.mp3` | Transitions | Use when shutter acts as scene punctuation rather than literal asset capture. |
| Count-up / numerical reveal | `SOUND FX/DATA TELEMETRY/Digital counting.mp3` | Data telemetry | Strong match for `$2,000` count-up moments. |
| Display digit lock-in | `SOUND FX/DATA TELEMETRY/Display Digits 1.wav` | Data telemetry | Use for number-counter terminal lock, not generic text. |
| Data reveal / UI zap | `SOUND FX/DATA TELEMETRY/data-reveal-sound-6460.mp3` | Data telemetry | Candidate for short UI/stat reveal. |
| Accent zap | `SOUND FX/DATA TELEMETRY/zap-127476.mp3` | Data telemetry | Candidate for sharp emphasis without visual asset. |
| Big impact / punch | `SOUND FX/CINEMATIC HITS/hit-brutal-puncher-cinematic-trailer-sound-effects-124760.mp3` | Cinematic hits | Use for final value/price impact, with restraint. |
| Impact riser | `SOUND FX/RISERS/impact-riser-01-6908.mp3` | Risers | Strong match for tension build into payoff. |
| Short riser | `SOUND FX/RISERS/riser-7-130957.mp3` | Risers | Candidate for micro-tension before scene/asset switch. |
| Whoosh transition | `SOUND FX/WHOOSHES/whoosh-6316.mp3` | Whooshes | Short whoosh for cuts/returns. |
| Swish / fast motion | `SOUND FX/SWOOSHES/ES_Jump Swish - SFX Producer.mp3` | Swooshes | Candidate for fast directional movement. |
| Fight/transition swoosh | `SOUND FX/SWOOSHES/swoosh-sound-effect-for-fight-scenes-or-transitions-2-149890.mp3` | Swooshes | Candidate for harder transition. |
| Rolling metallic/gear long-text bed | `SOUND FX/METALLIC IMPACTS/rolling-metal-29916.mp3` | Metallic impacts | Useful for long text or mechanical-process metaphor. |
| Paper flip / paper transition | `SOUND FX/OFFICE FOLEY/paper-flutter-5933.mp3` | Office foley | Matches paper-flip transition variety. |
| Paper movement | `SOUND FX/OFFICE FOLEY/paper-scrambling-30652.mp3` | Office foley | Candidate for messy/fast paper motion. |
| Marker/line drawing | `SOUND FX/OFFICE FOLEY/marker-lineswav-14823.mp3` | Office foley | Candidate for animated underline/line drawing. |
| Scanner/interface process | `SOUND FX/OFFICE FOLEY/scanner-epson-v600-16875.mp3` | Office foley | Candidate for scan/grid/process moments. |
| Typing fallback | `SOUND FX/TEXT/type-writing-6834.mp3` | Text | Use for actual typing only; Joseph often prefers click/gear alternatives. |
| UI click | `SOUND FX/UI INTERFACE/freesound_community-ui-click-43196.mp3` | UI interface | Candidate for luxury per-word click, but needs ear-match. |
| Cork / pressure release | `SOUND FX/POPS BUBBLES/cork-85200.mp3` | Pops bubbles | Candidate for release after list/teaser tension. |
| Wrong/buzzer punctuation | `SOUND FX/ACCENTS PUNCTUATION/buzzer-or-wrong-answer-20582.mp3` | Accents punctuation | Use only for explicit wrong-answer/negative beat. |
| Cash register | `SOUND FX/ACCENTS PUNCTUATION/cash-register-purchase-87313.mp3` | Accents punctuation | Commercial value punctuation; not the same as numeric counter. |
| Winning/elevation | `SOUND FX/ACCENTS PUNCTUATION/winning-elevation-111355.mp3` | Accents punctuation | Use for uplift/resolution, likely too long for micro-punctuation. |
| Cash/money foley | `SOUND FX/FOLEY PROPS/cash-money-sounds_fieldtapes-32456.mp3` | Foley props | Money texture, not clean statistic emphasis. |
| Banknote counting | `SOUND FX/FOLEY PROPS/manual-banknote-counting-63984.mp3` | Foley props | Literal money-counting texture; avoid for slick UI counter unless intended. |
| Money counter | `SOUND FX/FOLEY PROPS/money-counter-95830.mp3` | Foley props | Candidate for money/statistic counter if less digital. |
| Glitch/TV distortion | `SOUND FX/GLITCHES/tv-glitch-6245 (1).mp3` | Glitches | Candidate for grid/digital disruption. |
| Fire texture | `SOUND FX/NATURE/fire-sound-efftect-21991.mp3` | Nature | Not core to this Joseph packet unless visual fire/metaphor appears. |
| Snap accent | `SOUND FX/FOLEY PROPS/canvas-dropcloth-snap-1-98862.mp3` | Foley props | Useful for quick reveal or tactile punctuation. |

## First-Pass Score

Raw decision coverage from this packet:

- Observed key edit decisions: 46.
- Explainable by current catalog: about 31.
- Explainable after candidate deltas below: about 42.
- Training-safe now without audio/frame verification: about 24.

Interpretation:

- Current vocabulary is close, but still underpowered around sonic intent.
- The biggest missing concepts are not more generic SFX labels. They are
  lifecycle, timing, fatigue, and semantic coupling.
- This one reference alone can suggest features. It cannot prove them.

## High-Value Event Audit

| Time | What happened | Why a human editor likely did it | Viewer problem solved | Current feature coverage | Reliability | Missing feature delta | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0.000-3.211 | Black/low-visual intro with layered bass, riser, texture. | Capture attention before any visual information is given. | Stops passive scrolling and primes anticipation. | `audio.music_energy`, `audio.transient_density`, `temporal.sequence_trend`. | Medium: transcript-only audio description. | `audio.sfx_layer_count`, `audio.tension_riser_shape`, `audio.visual_withholding_state`. | Good |
| 3.211-6.715 | Iman visual/PiP-style asset, glowing name, crown, entry and exit SFX. | Anchor the video around the semantic keyword and status idea. | Clarifies subject and makes the style feel premium/dominant. | `typography.has_text`, `motion_graphics.has_image_asset`, `composition.has_pip`. | Medium: needs frame verification. | `typography.semantic_keyword_weight`, `asset.lifecycle_sfx_role`, `icon.semantic_support_role`. | Good |
| 6.715-8.706 | Gear/mechanical sound while tension climbs. | Turn editing into a process/machine metaphor; increase suspense. | Gives the viewer a felt sense that something is building. | `audio.sfx_class`, `temporal.sequence_trend`. | Medium. | `audio.sfx_metaphor_role`, `audio.boiling_point_proximity`. | Good |
| 8.706-9.739 | Whoosh transition to talking head with subtle vignette. | Reveal the authority figure cleanly and focus the eye. | Moves from spectacle to trust/source of knowledge. | `transitions.transition_type`, `composition.vignette`, `camera.crop_tightness`. | High visually if frame-reviewed. | `transition.authority_reveal`, `vignette.focus_role`. | Good |
| 9.739-10.401 | `$2,000` number counter starts before verbal mention and lands on the word. | Predictive visual priming and high-value emphasis. | Makes the value claim easier to feel and remember. | `motion_graphics.has_data_viz`, `typography.role`, `audio.has_audio_synced_cut`. | Medium: needs audio sync verification. | `asset.predictive_prime_offset_ms`, `number_counter.lock_sync`, `value_anchor_strength`. | Good |
| 10.401 | Counter lingers instead of leaving immediately. | Let the claim sink in; stretch time around important information. | Prevents the viewer from missing the magnitude. | `typography.text_duration_bucket`. | High once frame-timed. | `asset.linger_reason`, `importance_temporal_stretch`. | Good |
| 10.401-12.732 | Name mention gets sonic emphasis without a new visual. | Avoid visual redundancy while keeping emphasis. | Re-focuses attention without clutter. | `audio.sfx_class`, `speaker.has_emphasis`. | Medium. | `audio.sonic_substitution_for_visual`, `semantic_keyword_recall`. | Good |
| 19.498-20.476 | Grid/digital transition after intro promise. | Mark the start of the tutorial proper. | Helps the viewer understand section boundary. | `transition.type`, `motion_graphics.has_data_viz`. | Medium. | `transition.section_demarcation_strength`, `transition.digital_scan_style`. | Good |
| 20.476-28.967 | "Later in this video" teaser with numbered items and preview clips. | Retention contract: show value if viewer stays. | Answers "why should I keep watching?" | `temporal.position_in_video`, `motion_graphics.has_screen_recording`, `typography.keyword_count`. | Medium. | `narrative.retention_contract`, `preview.future_content_teaser`, `teaser.desaturation_state`. | Good |
| 24.964 | Same shutter-like sound repeats for grouped teaser items. | Sonic grouping: these belong together as one list. | Makes the list easier to parse. | `audio.sfx_count`, `audio.sfx_class`. | Medium. | `audio.grouped_punctuation_sfx`, `list.item_sonic_consistency`. | Good |
| 28.967 | Smooth transitions between teaser previews. | Preserve flow while changing preview items. | Reduces cognitive friction. | `transition.type`, `camera.movement_class`. | Medium. | `transition.preview_item_handoff`. | Good |
| 32.841 | "Finally" gets riser/release timing. | Pair semantic completion with sonic completion. | Gives the viewer a small closure reward. | `audio.beat_proximity`, `speaker.has_emphasis`. | Medium. | `audio.semantic_sonic_release`, `spoken_marker.completion`. | Good |
| 34.825-35.558 | Riser builds before "put everything into practice" assets. | Prime an asset payoff. | Keeps attention through setup words. | `temporal.sequence_trend`, `audio.sfx_class`. | Medium. | `audio.pre_asset_riser`, `asset.expected_payoff_window`. | Good |
| 35.558-37.743 | Four concept assets enter with shutter treatment. | Convert abstract lesson parts into visual anchors. | Makes structure concrete. | `motion_graphics.overlay_layer_count`, `typography.has_text`. | Medium. | `concept.visual_anchor_count`, `asset.sonic_entry_consistency`. | Good |
| 37.743-44.322 | Blur inactive assets, pan/focus active asset, whoosh follows motion. | Choreograph attention across multiple assets. | Stops multi-item layout from becoming confusing. | `composition.visual_density`, `camera.movement_class`, `motion_graphics.micro_animation_family`. | Medium-high. | `attention.focus_handoff`, `asset.active_inactive_state`, `audio.motion_follow_sfx`. | Good |
| 44.322-52.180 | Transition back to speaker with varied whoosh. | Return to authority after asset explanation. | Re-centers trust and avoids endless overlays. | `transition.type`, `speaker.is_speaking`. | High. | `transition.return_to_authority`, `audio.sonic_variation_reason`. | Good |
| 52.180-55.973 | Riser/cut into new section. | Hard pivot into the practical lesson. | Signals "now we begin." | `transition.has_audio_synced_cut`. | Medium. | `section.phase_change_intensity`. | Good |
| 55.973-59.628 | Rhetorical question with less sonic clutter. | Invite viewer cognition rather than decoration. | Makes viewer mentally answer. | `speaker.has_pause`, `temporal.editorial_role`. | Medium. | `rhetorical.question_state`, `audio.silence_for_question`. | Good |
| 59.628-65.499 | Three numbered principles appear sequentially, active item highlighted. | Build suspense and clarify hierarchy. | Helps viewer know where they are in the list. | `typography.role`, `motion_graphics.overlay_layer_count`. | Medium. | `list.active_item_index`, `list.inactive_item_treatment`. | Good |
| 68.095-112.883 | Text appears with mouse-click-like sound per word. | Premium alternative to cheap typing SFX. | Makes text feel selected/designed rather than typed. | `typography.animation_class`, `audio.sfx_count`. | Medium. | `audio.text_reveal_sfx_style`, `text.per_word_sonic_sync`. | Good |
| 124.153 | Numeric rule/ratio displayed as stylized number. | Make abstract design principle memorable. | Converts rule into an anchor. | `motion_graphics.has_data_viz`, `typography.role`. | Medium. | `education.concrete_rule_visualization`. | Good |
| 131.042 | Riser foreshadows transition. | Prepare viewer for scene change. | Avoids abruptness. | `audio.has_audio_synced_cut`. | Medium. | `audio.transition_foreshadow_sfx`. | Good |
| 139.801 | Background sound energy/BPM rises under section. | Increase pace while staying in same sonic world. | Keeps long tutorial from flattening. | `audio.music_energy`, `temporal.sequence_trend`. | Low-medium without audio analysis. | `music.bpm_delta`, `song_arc_phase`. | Good |
| 150.175-167.364 | Multiple scene changes with whoosh variants. | Sustain motion but avoid exact repetition. | Prevents auditory fatigue. | `transition.type`, `audio.sfx_class`. | Medium. | `audio.sonic_variety_index`, `transition.same_function_different_sfx`. | Good |
| 171.330 | Rectangle/storyboard utility appears with camera shutter-like sound. | Introduce an explanatory board/visual module. | Gives concept a container. | `motion_graphics.has_glass_card`, `composition.screen_person_relationship`. | Medium. | `asset.storyboard_panel_role`. | Good |
| 201.412 | Whip/burn-like cut back to speaker. | End visual explanation and resume direct teaching. | Restores authority and human presence. | `transition.type`, `speaker.is_speaking`. | Medium. | `transition.whip_burn_return`. | Good |
| 206.773-212.244 | Expected riser payoff is replaced by silence/bell, then sound returns. | Break pattern intentionally. | Refreshes attention by violating expectation. | `audio.has_silence_gap`, `temporal.novelty_level`. | Medium. | `audio.intentional_silence_break`, `pattern.expected_payoff_violation`, `audio.bpm_continuity_after_silence`. | Good |
| 217.383-220.256 | Second `$2,000` counter with count-up/gear sound. | Reinforce value anchor using same numeric grammar. | Makes the commercial/value point durable. | `motion_graphics.has_data_viz`, `audio.sfx_class`. | Medium. | `value_anchor.repetition_index`, `number_counter.reuse_pattern`. | Good |
| 223.091 | Riser into "step-by-step" workspace transition with gradient typography. | Move from principle to tutorial execution. | Makes practical phase feel important. | `transition.type`, `typography.text_color_treatment`. | Medium. | `section.tutorial_start_marker`. | Good |
| 246.052 | SFX foreshadows a cut/transition. | Signal motion before the visual move happens. | Keeps viewer oriented. | `audio.has_audio_synced_cut`. | Medium. | `audio.pre_transition_warning`. | Good |
| 263.499 | Long text uses rolling gear instead of repeated mouse clicks. | Avoid click spam; adapt SFX to text length. | Reduces fatigue while preserving motion. | `audio.sfx_class`, `typography.keyword_count`. | Medium. | `audio.sound_efficiency_by_text_length`, `text.chunk_sfx_strategy`. | Good |
| 266.028 | Paper-flip sound for transition back to speaker. | Add variety to a repeated return function. | Prevents sameness. | `audio.sfx_class`, `transition.type`. | Medium. | `audio.transition_sfx_variant_reason`. | Good |
| 267.974 | Speaker shot returns zoomed-in then slowly zooms/pans out. | Make talking head breathe cinematically. | Prevents static speaker fatigue. | `camera.movement_class`, `crop_tightness`. | Medium-high. | `camera.speaker_micro_motion_phase`, `speaker.return_zoom_state`. | Good |
| 277.139 | Cut occurs with no SFX. | Give auditory relief after dense SFX usage. | Reduces fatigue and wakes attention. | `audio.has_silence_gap`, `transition.type`. | Medium. | `audio.sfx_omission_reason`, `sonic_fatigue_relief`. | Good |
| 318.423 | Text blur detail noticed during tutorial. | Integrate text into scene/depth. | Makes text less flat. | `typography.animation_class`, `composition.has_depth_layering`. | Low-medium. | `typography.blur_amount`, `text.depth_integration`. | Neutral-good |
| 335.350 | High-pitched riser foreshadows transition. | Build micro-tension before switch. | Keeps long tutorial moving. | `audio.sfx_class`. | Medium. | `audio.riser_foreshadow_strength`. | Good |
| 392.155 | Gaussian blur/background brightness controls mentioned. | Shape depth, legibility, focus. | Prevents overlays from fighting footage. | `composition.visual_density`, `typography.occupancy_bucket`. | Low: tutorial note, not necessarily edit decision. | `visual.background_treatment_role`. | Neutral |
| 418.132 | Start zoomed into asset, then zoom out for explanation. | Reveal context after detail. | Helps learning sequence: detail first, then whole. | `camera.movement_class`, `motion_graphics.micro_animation_family`. | Medium. | `education.reverse_reveal_zoom`. | Good |
| 463.621 | Color compatibility across LUT, grading, typography. | Maintain premium coherence despite bold gradients. | Prevents "cheesy" mismatch. | `typography.text_color_treatment`, `composition.color_palette`. | Medium. | `color.cross_modal_palette_coherence`. | Good |
| 571.491 | Song changes to similar but faster track. | Refresh long tutorial without jarring viewer. | Avoids auditory boredom. | `audio.music_energy`, `temporal.sequence_trend`. | Low-medium without waveform. | `music.seamless_song_change`, `music.bpm_arc_reason`. | Good |
| 761.829 | Null stacking noted as smooth camera technique. | Technical cause of premium camera motion. | Makes movement smooth/crisp. | `camera.movement_class`. | High as tutorial claim, low as extracted feature. | `technique.null_stacking_used`. | Neutral-good |
| 840.237 | Third break/product promotion. | Monetization and retention reset. | Gives video structure but may not generalize to all edits. | `temporal.position_in_video`, `editorial_role`. | Medium. | `segment.commercial_break_role`. | Context-dependent |
| 849.098 | Zoom-out transition combined with thick vignette that fades out. | Reveal abundance/more examples while focusing entry. | Guides attention then opens the field. | `composition.vignette`, `camera.movement_class`. | Medium. | `vignette.semantic_dynamic`, `vignette.fade_direction_role`. | Good |
| 853.285 | Flash/burn transition with no SFX. | Another rule break for freshness. | Prevents transition grammar from becoming predictable. | `transition.type`, `audio.has_silence_gap`. | Medium. | `transition.visual_only_exception`. | Good |
| 857.582 | Typography split into hierarchy: small step-by-step plus bold gradient word. | Visual hierarchy and emphasis. | Makes the important word pop. | `typography.font_weight`, `typography.text_color_treatment`. | Medium-high. | `typography.hierarchy_split_role`, `keyword.gradient_emphasis`. | Good |
| 861.846 | Whip transition back to talking head with whoosh. | Physical-feeling return to speaker. | Restores human authority after visual section. | `transition.type`, `audio.sfx_class`. | Medium. | `transition.directional_speaker_return`. | Good |
| 879.223 | Three bonus courses use visual assets and reduced shutter sounds. | Show value while softening repeated shutter intensity. | Keeps bonus list clear without auditory fatigue. | `motion_graphics.has_image_asset`, `audio.sfx_count`. | Medium. | `audio.sfx_intensity_modulation`, `commercial.bonus_list_visualization`. | Good |
| 889.355 | Mini climax around price change with riser and unique shader/figure animation. | Make offer feel like a reveal/payoff. | Increases commercial impact. | `audio.sfx_class`, `motion_graphics.has_data_viz`. | Medium. | `commercial.price_reveal_climax`, `motion_graphics.price_shader_style`. | Context-dependent |
| 896.407-936.422 | Base/music changes into more heroic/upbeat end-segment pacing. | Match final delivery/CTA energy. | Helps the ending feel like resolution and action. | `audio.music_energy`, `temporal.position_in_video`. | Low-medium without audio analysis. | `music.arc_phase`, `music.cta_energy_lift`. | Good |
| 1167.300 | Sound changes again into nervous/urgent beats. | Increase urgency near late CTA or final push. | Nudges action/attention at the end. | `audio.music_energy`. | Low-medium. | `music.urgency_tone`, `cta.sonic_pressure`. | Context-dependent |

## Candidate Feature Deltas From Reference 01

These should be treated as proposed additions or refinements, not final catalog
truth.

### Audio/SFX

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `audio.sfx_lifecycle_role` | `entry`, `exit`, `motion_follow`, `transition_bridge`, `semantic_substitute`, `release`, `fatigue_relief`, `none` | Joseph does not only choose SFX type; he chooses why the SFX exists in the asset lifecycle. | Appears in 3+ references and can be annotated consistently. |
| `audio.sfx_timing_relation` | `before_visual`, `on_visual_entry`, `after_visual_exit`, `before_spoken_keyword`, `on_spoken_keyword`, `after_spoken_keyword` | Timing is core to the effect: pre-riser vs impact vs release are different decisions. | Audio/video sync can measure offsets. |
| `audio.sfx_layer_count` | integer 0-4 | Intro pressure comes from layers, not one sound. | We can detect/label layered SFX reliably. |
| `audio.sonic_substitution_for_visual` | boolean | Some emphasis is done by sound specifically because visual would be redundant. | Human annotations agree on the substitution intent. |
| `audio.grouped_punctuation_sfx` | boolean | Same sound repeats across list items to group them. | Seen across list/teaser/bonus examples. |
| `audio.sfx_omission_reason` | `fatigue_relief`, `rhetorical_space`, `pattern_break`, `unknown` | Silence/no-SFX cuts are decisions, not missing data. | Annotators can distinguish intentional omission from missing audio. |
| `audio.sonic_variety_index` | `low`, `medium`, `high` | Repeated transition functions use varied SFX to avoid fatigue. | Need enough transitions per reference. |
| `audio.sound_efficiency_by_text_length` | boolean | Short text can use per-word clicks; long text needs continuous texture. | Seen in 3+ text reveal contexts. |
| `audio.bpm_arc_phase` | `intro_pressure`, `tutorial_mid`, `commercial_break`, `cta_lift`, `urgent_end`, `unknown` | Song changes follow narrative phase, not arbitrary time. | Requires audio artifact extraction. |

### Visual/Asset Lifecycle

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `asset.predictive_prime_offset_ms` | integer ms | Asset begins before the speaker says the thing, creating prediction/reward. | We can align transcript words to visual entry. |
| `asset.linger_reason` | `value_gravity`, `reading_time`, `authority`, `unknown` | Lingering `$2,000` has different intent than ordinary text duration. | Human audit confirms why linger occurred. |
| `asset.active_inactive_state` | `active`, `inactive_blurred`, `inactive_dimmed`, `inactive_offscreen` | Multi-asset layouts rely on focus choreography. | Frame review can label state reliably. |
| `asset.storyboard_panel_role` | boolean | Joseph uses panels/rectangles as explanation containers. | Appears beyond one tutorial style. |
| `preview.future_content_teaser` | boolean | Teaser clips are retention contracts, not normal B-roll. | Seen in hook/preview sections of multiple references. |

### Typography/Color

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `typography.semantic_keyword_weight` | `none`, `supporting`, `primary_keyword`, `brand_subject` | "IMAN GADZHI" is not just text; it is the semantic anchor. | Transcript/ASR keyword alignment works. |
| `typography.hierarchy_split_role` | `label_plus_keyword`, `number_plus_label`, `headline_plus_support`, `unknown` | Many text treatments use hierarchy, not uniform captions. | Frame review validates layout. |
| `typography.blur_amount` | `none`, `subtle`, `strong` | Text blur can integrate/depth-layer typography. | Detector can distinguish blur from compression. |
| `color.cross_modal_palette_coherence` | `matched`, `contrasting_but_controlled`, `clashing`, `unknown` | LUT, vignette, and typography colors need coherence. | Palette extraction becomes reliable. |

### Transition/Camera/Composition

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `transition.return_to_authority` | boolean | Returning to speaker after assets is a structural move. | Speaker/asset state can be tracked. |
| `transition.visual_only_exception` | boolean | Some transitions intentionally omit SFX. | Audio artifact can prove no SFX and human agrees intent. |
| `camera.speaker_micro_motion_phase` | `zoomed_in_return`, `slow_zoom_out`, `micro_pan`, `static` | Talking head footage breathes through subtle camera movement. | Frame/crop motion extraction is stable. |
| `vignette.semantic_dynamic` | `focus_in`, `open_out`, `commercial_depth`, `unknown` | Vignette can carry meaning, not only aesthetics. | Needs human review; do not train blindly yet. |
| `education.reverse_reveal_zoom` | boolean | Start on detail, zoom out to context for tutorial explanation. | Seen in multiple educational sequences. |

### Narrative/Intent

| Candidate feature | Values | Why it matters | Promote when |
| --- | --- | --- | --- |
| `narrative.retention_contract` | boolean | "Later in this video" preview is a different role from ordinary exposition. | Transcript and preview visuals can align. |
| `rhetorical.question_state` | boolean | Questions often get less sonic clutter to let cognition happen. | ASR reliably detects questions. |
| `commercial.price_reveal_climax` | boolean | Offer/price sections use mini-climax grammar. | Needed only if building commercial-video style. |
| `commercial.bonus_list_visualization` | boolean | Bonus lists may use visual assets plus softened SFX. | Seen across CTA sections. |

## Current 74-Feature Coverage Assessment

| Family | Coverage from this reference | Issue |
| --- | --- | --- |
| Camera | Medium | We need speaker micro-zoom/pan phase, not just movement magnitude. |
| Typography | Medium-high | Needs semantic keyword weight, hierarchy split, blur/depth treatment. |
| Motion graphics | High | Existing asset/overlay features are useful, but lifecycle intent is missing. |
| Composition | Medium | Vignette and active/inactive focus states need more explicit semantics. |
| Transitions | Medium | Current transition labels miss no-SFX exceptions and return-to-authority role. |
| Audio | Low-medium | The current audio family is too generic for Joseph; SFX timing/lifecycle/fatigue are the main gap. |
| Temporal | Medium | Good broad phase support, weak rhetorical/retention-contract labeling. |
| Speaker vocal | Medium | Need question/emphasis relation to SFX restraint. |
| Genome dimensions | Medium | Useful for planner alignment but too coarse for audit proof. |

## Training Safety Decisions

Train now only after extraction support:

- count-up number reveal timing
- asset entry/exit SFX timing
- transition SFX/no-SFX flag
- teaser preview presence
- active/inactive asset state
- speaker micro-zoom/pan

Manual-only for now:

- "blue tonal" or "heroic" sound descriptions
- vignette semantic meaning
- why a specific SFX was chosen when multiple plausible options exist
- whether product-promotion sections generalize outside commercial videos
- whether silence was intentional or simply no available SFX

Reject as direct training features:

- raw SFX count as quality
- raw caption count as importance
- more risers equals better retention
- "Iman name mentioned" as a fixed trigger
- product-break timing as universal editing law

## Required Next Evidence

For references 02-05, keep the same packet shape:

1. Raw timestamp notes with uncertainty preserved.
2. SFX files or matched library candidates when possible.
3. At least 20-50 key decisions per video.
4. Mark decisions as good, neutral, harmful, or context-dependent.
5. Call out exceptions, especially no-SFX cuts and silence.

The target is not "Joseph uses sound effects a lot." The target is:

> Joseph uses sound effects according to lifecycle, timing, semantic emphasis,
> fatigue, and section arc.

That is the feature vocabulary this first reference actually supports.
