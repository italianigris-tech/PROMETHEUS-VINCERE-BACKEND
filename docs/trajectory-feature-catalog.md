# Trajectory Feature Catalog

Status: post-#57 synthesis catalog for #58
Schema: `trajectory_extractor.schema` 0.2.0
Updated: 2026-07-07

This catalog documents the current 74-feature trajectory representation used by
the trajectory extractor. It is intentionally compact, discrete, and
human-auditable.

This is not final approval for IRL training. The five-reference Joseph human
audit packet now satisfies the discovery input for #57, but #58 must still fold
that evidence into stable vocabulary and #59/#60/#61 must pass before MaxEnt IRL
training can consume trajectories.

## Catalog Rules

- A feature is allowed only if a human can explain what craft decision it helps
  evaluate.
- Missing evidence must not masquerade as a low/false value in training data.
- Raw continuous values should be bucketed before learning.
- Outcome/action features must stay separate from intent/reward labels.
- Features that duplicate another stronger feature should be rejected or folded.

## Family Counts

| Family | Count | Status |
| --- | ---: | --- |
| Camera | 10 | Provisional; cut detection needs repair. |
| Typography | 10 | Provisional; OCR/style reliability needs audit. |
| Motion graphics | 8 | Provisional; screen/evidence role is missing. |
| Composition | 10 | Provisional; many values need visual review. |
| Transitions | 6 | Provisional; scene-change mismatch found in #57 slice. |
| Audio | 10 | Provisional; artifact-backed analysis required by #59. |
| Temporal | 8 | Provisional; transcript-backed roles needed. |
| Speaker vocal | 8 | Provisional; prosody/gaze/gesture need stronger extraction. |
| Genome dimensions | 4 | Required planner alignment dimensions. |
| Total | 74 | In the 60-80 target band. |

## Camera Features

| Feature | Extractor Source | Units / Values | Null Behavior | Validation Note |
| --- | --- | --- | --- | --- |
| `movement_class` | Optical flow, face/crop motion. | `static`, `slow_zoom_in`, `slow_zoom_out`, `pan`, `handheld_shake`, `whip`. | Required; extraction should fail or mark unknown before training. | Needs frame-review against visible camera/crop moves. |
| `movement_magnitude` | Optical flow magnitude. | `low`, `mid`, `high`. | Required bucket. | Validate thresholds against static, subtle, active samples. |
| `has_ken_burns` | Slow scale/translate on still or low-motion frames. | Boolean. | Defaults false; missing detection must be flagged in audit. | Needs positive examples; likely rare but high craft value. |
| `face_box_velocity` | MediaPipe/face-box motion between sampled frames. | `low`, `mid`, `high`. | Required bucket in schema; extraction fallback must not mean low. | Requires face detector availability and missingness reporting. |
| `shot_change_count` | Scene/cut detection inside the window. | Integer 0-5. | Required count. | Critical: #57 slice found 233 FFmpeg scene events while trajectory reported zero. |
| `has_jump_cut` | Same-subject cut with composition continuity. | Boolean. | Defaults false. | Requires reliable cut map plus subject continuity. |
| `has_match_cut` | Cut preserving matched action or composition. | Boolean. | Defaults false. | Likely manual/heuristic until stronger visual matching exists. |
| `momentum_direction` | Motion trend before/after the window. | `in`, `out`, `none`. | Required label. | Validate against camera movement and sequence energy, not timestamp alone. |
| `crop_tightness` | Face/body bounding box relative to frame. | `tight_head`, `medium`, `wide`, `full_body`. | Required label. | Requires face/person detector; unknown must be explicit. |
| `rule_of_thirds_alignment` | Subject location relative to thirds grid. | Boolean. | Defaults false. | Useful only if face/person box is reliable. |

## Typography Features

| Feature | Extractor Source | Units / Values | Null Behavior | Validation Note |
| --- | --- | --- | --- | --- |
| `has_text` | OCR and visual text heuristics. | Boolean. | Defaults false; OCR unavailable must be distinct from no text. | #57 slice saw 191/301 text windows in provided trajectory. |
| `role` | OCR placement, duration, style heuristics. | `none`, `caption`, `keyword_pop`, `lower_third`, `title_card`, `cta`, `watermark`. | Defaults `none`. | Needs human intent audit; role is not just geometry. |
| `placement_zone` | Text bounding boxes. | `none`, `upper_third`, `lower_third`, `center`, `hero`, `full_width`, `left_anchor`, `right_anchor`. | Defaults `none`. | Validate readability and face-safe placement. |
| `font_weight` | OCR/style heuristics or rendered text analysis. | `none`, `light`, `regular`, `bold`, `black`. | Defaults `none`. | Low confidence without better style extraction. |
| `text_color_treatment` | Pixel/color sampling around text. | `none`, `white`, `black`, `brand_color`, `gradient`, `outlined`. | Defaults `none`. | Requires contrast/readability audit. |
| `animation_class` | Temporal OCR/text motion tracking. | `none`, `fade`, `slide`, `pop`, `typewriter`, `kinetic`. | Defaults `none`. | Needs multi-frame text tracking; single-frame OCR is insufficient. |
| `has_background_plate` | Plate/box detection behind text. | Boolean. | Defaults false. | Useful for trust/readability; verify visually. |
| `keyword_count` | OCR token emphasis count. | Integer 0-4. | Defaults 0. | Must not equate more keywords with better clarity. |
| `text_duration_bucket` | OCR persistence across frames/windows. | `none`, `flash`, `short`, `standard`, `held`. | Defaults `none`. | Validate against actual readable duration. |
| `occupancy_bucket` | Text area divided by frame area. | `low`, `mid`, `high`. | Defaults low. | Missing OCR must not become low occupancy. |

## Motion Graphics Features

| Feature | Extractor Source | Units / Values | Null Behavior | Validation Note |
| --- | --- | --- | --- | --- |
| `has_glass_card` | Overlay/panel visual heuristic. | Boolean. | Defaults false. | Needs manual examples; avoid confusing with subtitles. |
| `has_image_asset` | Inserted still/screenshot detection. | Boolean. | Defaults false. | Needs object/screen classifier support. |
| `has_data_viz` | Chart/graph/counter detection. | Boolean. | Defaults false. | High value when present; likely manual/heuristic early. |
| `has_screen_recording` | UI/screen capture classifier. | Boolean. | Defaults false. | Important for tutorial filtering and demonstration intent. |
| `micro_animation_family` | Overlay motion tracking. | `none`, `zoom_elastic`, `fade_in`, `slide`, `pop`, `blur_reveal`, `scale_pulse`. | Defaults `none`. | Needs frame-to-frame overlay tracking. |
| `overlay_layer_count` | Count of simultaneous overlays. | Integer 0-4. | Defaults 0. | Correlates with visual density; keep only if independently useful. |
| `has_particle_fx` | Particle/light effect detection. | Boolean. | Defaults false. | Likely low priority unless common in audited Joseph refs. |
| `has_depth_layering` | Parallax/foreground/background separation. | Boolean. | Defaults false. | Needs render/visual proof, not just blur. |

## Composition Features

| Feature | Extractor Source | Units / Values | Null Behavior | Validation Note |
| --- | --- | --- | --- | --- |
| `speaker_position` | Face/person box position. | `left`, `center`, `right`, `absent`. | Required label. | Unknown detector state must not be treated as absent. |
| `has_pip` | Picture-in-picture detection. | Boolean. | Defaults false. | Human review required for #57 PiP/matte coverage. |
| `pip_count` | PiP region count. | Integer 0-2. | Defaults 0. | Requires distinguishing PiP from screenshots/cards. |
| `pip_arrangement` | PiP layout geometry. | `none`, `split_screen`, `inset_corner`, `stacked`. | Defaults `none`. | Validate against attention target and occlusion. |
| `negative_space_ratio` | Empty/safe frame area. | `low`, `mid`, `high`. | Required bucket. | Needs reliable subject/text boxes. |
| `background_type` | Scene/background classifier. | `real_scene`, `blurred_interior`, `solid_color`, `gradient`, `image`, `screenshot`. | Required label. | Needs normalization across extractor versions. |
| `depth_of_field` | Blur/depth heuristic. | `deep`, `shallow`, `synthetic_blur`. | Required label. | Useful only when face/background segmentation is reliable. |
| `has_subject_segmentation` | Matte/cutout detection. | Boolean. | Defaults false. | Directly relevant to video matting; must be visually verified. |
| `subject_scale` | Subject box relative to frame. | `small`, `medium`, `large`. | Required label. | Validate against crop tightness to avoid duplication. |
| `visual_symmetry` | Layout balance heuristic. | Boolean. | Defaults false. | Low priority unless audits show strong craft signal. |

## Transition Features

| Feature | Extractor Source | Units / Values | Null Behavior | Validation Note |
| --- | --- | --- | --- | --- |
| `dominant_type` | Scene/cut/transition detector. | `cut`, `crossfade`, `whip_pan`, `motion_match`, `fade_to_black`, `morph`. | Defaults `cut`. | Default is dangerous; unknown transition analysis must be explicit. |
| `has_audio_synced_cut` | Cut timestamp compared with beat/transient grid. | Boolean. | Defaults false. | Requires #59 audio artifacts before training use. |
| `timing_offset_bucket` | Cut offset relative to nearest beat/transient. | `early`, `on`, `late`. | Defaults `on`. | Default is dangerous without analyzed audio. |
| `has_momentum_handoff` | Motion continuity across cut. | Boolean. | Defaults false. | Needs pre/post cut motion vector comparison. |
| `transition_duration_bucket` | Duration of transition effect. | `instant`, `fast`, `standard`, `slow`. | Defaults `instant`. | Verify non-cut transitions visually. |
| `has_flash_transition` | Flash/light transition detection. | Boolean. | Defaults false. | Likely sparse; keep only if audited references use it. |

## Audio Features

| Feature | Extractor Source | Units / Values | Null Behavior | Validation Note |
| --- | --- | --- | --- | --- |
| `sfx_class` | SFX detector or labeled audio artifact. | `none`, `whoosh`, `impact`, `riser`, `pop`, `boom`, `ui_tick`. | Defaults `none`. | Must not train until SFX detection has explicit confidence/missingness. |
| `sfx_count` | SFX event count per window. | Integer 0-4. | Defaults 0. | Requires source-hashed audio artifacts. |
| `music_presence` | Music/voice separation or track metadata. | Boolean. | Defaults false. | Missing librosa/audio analysis must not become false. |
| `music_energy` | Music loudness/intensity. | `low`, `mid`, `high`. | Required bucket. | Depends on #59; current fallback can zero audio. |
| `beat_proximity` | Event alignment to beat/downbeat grid. | `on_beat`, `near_beat`, `off_beat`. | Defaults `off`. | Needs analyzed beat grid, not fallback masquerading as truth. |
| `ducking_active` | Music volume envelope under voice. | Boolean. | Defaults false. | Requires voice/music separation and envelope analysis. |
| `has_silence_gap` | Intentional low-energy gap. | Boolean. | Defaults false. | Need distinguish true silence from compression/noise floor. |
| `vocal_energy` | Speaker loudness bucket. | `low`, `mid`, `high`. | Required bucket. | Needs transcript/prosody calibration. |
| `spectral_brightness` | Spectral centroid bucket. | `low`, `mid`, `high`. | Required bucket. | Useful for audio texture; lower priority for editorial intent. |
| `transient_density` | Onset density bucket. | `low`, `mid`, `high`. | Required bucket. | Useful for busyness; can correlate with beat/cut density. |

## Temporal Features

| Feature | Extractor Source | Units / Values | Null Behavior | Validation Note |
| --- | --- | --- | --- | --- |
| `position_in_video` | Window timestamp as fraction of duration. | `hook`, `intro`, `body`, `climax`, `outro`. | Required label. | Timestamp-only role is weak; needs transcript-backed rhetorical role. |
| `pacing_density` | Cut density relative to average. | `low`, `mid`, `high`. | Required bucket. | Depends on reliable cut map. |
| `is_climax_window` | Highest-intensity arc region heuristic. | Boolean. | Defaults false. | Needs validation against human-identified payoff moments. |
| `is_restraint_window` | Quiet contrast setup/release heuristic. | Boolean. | Defaults false. | Must be judged by context, not only low motion. |
| `sequence_trend` | Local energy slope. | `rising`, `falling`, `steady`, `volatile`. | Required label. | Needs stable energy source and windowing mode. |
| `novelty_level` | Visual novelty versus recent windows. | `low`, `mid`, `high`. | Required bucket. | Useful for repetition/fatigue; validate by ablation. |
| `surprise_budget_state` | Remaining novelty/surprise budget. | `low`, `mid`, `high`. | Required bucket. | Planner-derived concept; must not leak target reward. |
| `repetition_penalty_active` | Recent treatment reuse flag. | Boolean. | Defaults false. | Keep if it improves sequence-level restraint. |

## Speaker Vocal Features

| Feature | Extractor Source | Units / Values | Null Behavior | Validation Note |
| --- | --- | --- | --- | --- |
| `is_speaking` | VAD/transcript/audio energy. | Boolean. | Defaults false. | Missing audio must not become not speaking. |
| `speaking_rate` | Transcript words per minute. | `none`, `slow`, `medium`, `fast`. | Defaults `none`. | Requires transcript or robust ASR timing. |
| `confidence` | Prosody/volume/pitch heuristic. | `uncertain`, `neutral`, `assertive`. | Required label. | Needs human calibration; avoid moralizing volume. |
| `has_emphasis` | Volume/pitch spike or stressed word. | Boolean. | Defaults false. | High-value intent proxy if transcript/prosody is reliable. |
| `has_pause` | Speech gap around window. | Boolean. | Defaults false. | Needs rhetorical pause vs dead air distinction. |
| `face_emotion_class` | Face/emotion classifier. | `neutral`, `smiling`, `serious`, `intense`, `surprised`. | Defaults `neutral`. | Risky without detector confidence; defer for training. |
| `gaze_target` | Eye/head/face orientation. | `lens`, `offscreen`, `graphic`. | Required label. | Needs visual confidence and missingness. |
| `has_gesture` | Pose/hand/body movement detector. | Boolean. | Defaults false. | Useful for emphasis if pose extraction is reliable. |

## Genome Dimensions

These four fields are not counted inside the eight feature families, but they are
part of each training window because the planner already uses them as archive
dimensions.

| Dimension | Source | Values | Validation Note |
| --- | --- | --- | --- |
| `intensity` | Derived from text, overlays, motion, audio. | `minimal`, `restrained`, `balanced`, `expressive`. | Must be explainable from observed features. |
| `visual_density` | Derived from text and overlay occupancy. | `quiet`, `balanced`, `loud`. | Must not duplicate raw typography counts without added meaning. |
| `motion_energy` | Derived from camera and transient/cut energy. | `none`, `subtle`, `active`. | Depends on fixed transition/audio reliability. |
| `editorial_role` | Derived from temporal/rhetorical phase. | `setup`, `explain`, `tension`, `payoff`. | Needs transcript-backed mapping; current sample trajectory role values differ. |

## Rejected Or Deferred Candidate Features

Rejected as low-value or too correlated:

- Raw frame number.
- Raw timestamp as a learning feature.
- Raw scene-change count without reason-for-cut.
- Raw caption count without semantic role.
- Raw text occupancy without readability or intent.
- Raw optical-flow magnitude when it duplicates cut density.
- Number of overlays without attention target.
- Speaker absent as a proxy for tutorial.
- Position-in-video as a proxy for rhetorical role.
- Text present as a proxy for importance.
- Music loudness as a proxy for intensity when voice/music separation is missing.
- Face emotion as a reward signal without confidence and human calibration.

Deferred until extractor evidence improves:

- Fine-grained SFX class.
- Ducking envelope.
- Beat-synced cut.
- Gaze target.
- Gesture.
- PiP/matte quality.
- Match-cut classification.
- Motion-graphic animation family.

## Phase-Gate Notes

This catalog satisfies the structural half of #58:

- Feature names and families are listed.
- Extractor source, units, null behavior, and validation notes are documented.
- Family counts stay inside the roughly 8-10 feature target, with transitions at
  6 because transition state is intentionally narrow.
- Rejected correlated feature ideas are documented.

This catalog does not close #58 yet because the five Joseph audits still need to
be fused with local/API evidence artifacts, noisy feature rejection, and
elite-vs-generic validation before the vocabulary is training-stable. See
`docs/joseph-five-audit-feature-synthesis.md` for the post-#57 fold.

