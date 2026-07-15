# Video Feature Audit: How to Edit Cinematic Documentary

**Video:** `How_to_Edit_Cinematic_Documentary_ second video.mp4`  
**Duration:** ~1259.94s (~21:00)  
**Resolution:** 1920x1080  
**Auditor Note:** Visual observations are from extracted frames (2s intervals + targeted samples). Audio/SFX claims are **inferred from visual context and genre conventions** unless explicitly marked as verified. I did not have waveform access. All timing is approximate (±1s unless noted).

---

## 1. Executive Summary

This is a **hybrid tutorial video** that alternates between three primary visual modes: (1) a polished talking-head host in a studio, (2) cinematic documentary-style motion graphics (maps, parallax, typography), and (3) raw After Effects screen recordings showing the build process. The editing strategy is **pedagogical demonstration**: show the finished cinematic result first, then deconstruct it via annotated breakdowns, then teach the technical build in AE.

The strongest patterns are:
- **Hard cuts** between talking head and screen recording (no complex transitions)
- **Annotated callout overlays** used to label animation components before showing the AE build
- **Color-coded typography** (red for emphasis, gold/white for hierarchy) consistent across documentary and tutorial segments
- **Depth of field (DOF)** as a recurring visual motif, used both in the documentary graphics and as a labeled teaching point
- **Layered compositions** in AE that mirror the narrative structure: background → midground (map/asset) → foreground (text/callout)

The biggest missing features from a standard ontology:
- **Tutorial-audio relationship**: when the speaker pauses to let the viewer watch a demo
- **Annotated breakdown frames** (static frames with arrows/labels that serve as "explanatory pause" states)
- **Software UI context switches** (switching between project panel, timeline, and viewer in AE)
- **Callout entry/exit timing** relative to the underlying animation being described
- ** pedagogical pacing**: the deliberate slowdown of edit cadence during complex technical explanations

---

## 2. Timeline Event Audit

| Time | What happened | Visual evidence | Audio/SFX evidence | Likely human intent | Viewer problem solved | Reward/objective | Current feature | Reliable? | Missing feature | Verdict | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **0.0s** | Video opens with motion-blurred talking head host; speaker is mid-gesture, high energy | Blurred frame at 0s; host at desk with RODE mic; background has vertical wood slats + plant + blue ambient light | **Inferred**: likely intro music or ambient soundbed; no SFX observed on cut | Establish host presence and high-energy tutorial tone immediately | Prevents "who is this?" confusion; hooks with authority | Retention, authority, clarity | `shot_type=talking_head`, `motion_blur=yes` | High (visual) | `audio_energy_at_open`, `intro_music_presence` | Good | High |
| **~8s** | Hard cut to cinematic B-roll: Roman soldiers on cliff with text "545 A.D. / The year the Roman war began" | Frame at 8s shows historical scene with red serif typography; cinematic color grading (sepia/warm) | None observable | Demonstrate the "target aesthetic" before teaching it | Show the viewer the promised output first (tutorial clarity) | Retention, tutorial clarity, authority | `text_overlay`, `b_roll_cutaway` | High | `aesthetic_preview_timing` (how soon the payoff is shown) | Good | High |
| **~20s** | Split-screen layout: left panel shows "PARALLAX" in purple neon/glow style; right panel shows the B-roll clip | Frame at 20s: dual-panel with purple glow border around right panel; dark background | None observable | Introduce the first technique name (parallax) while keeping the visual payoff visible | Link terminology to visual result | Clarity, tutorial structure | `split_screen`, `text_title`, `glow_effect` | High | `technique_label_timing` (does text appear before or after the speaker names it?) | Good | High |
| **~30s** | Triptych/three-panel layout: three vertical documentary images side by side (soldiers, Lebanon map, "RATS") | Frame at 30s: three equal panels with thin vertical borders; documentary aesthetic maintained | None observable | Show montage/variety of documentary techniques covered | Communicate breadth of tutorial content | Retention, clarity | `multi_panel`, `documentary_montage` | High | `panel_count`, `panel_transition_type` | Good | High |
| **~44s** | Hard cut to clean talking head; host is centered, well-lit, no motion blur | Frame at 44s: sharp focus, medium close-up, studio setup | **Inferred**: clean dialogue audio; possible music bed underneath | Return to instructor for explanation phase after the "show" phase | Reset attention to the teacher; provide verbal context | Clarity, authority | `talking_head`, `cut_transition` | High | `talking_head_return_timing` (how long after B-roll?) | Good | High |
| **~52s** | Tutorial breakdown: static frame showing Lebanon map with single callout arrow pointing to "High Quality map image" | Frame at 52s: white background, centered map asset, minimal callout | None observable | Begin deconstructing the documentary composition layer by layer | Teach viewers to identify base assets | Tutorial clarity | `callout_arrow`, `static_breakdown_frame` | High | `callout_count`, `breakdown_layer_depth` | Good | High |
| **~68s** | Full annotated breakdown: 5+ callout arrows labeling "Masked out country", "Ink reveal text", "Depth of field", "Clouds", "High Quality map image" | Frame at 68s: dense annotation layer over the composition | None observable | Complete the "anatomy lesson" of the finished graphic | Give viewers the full vocabulary of the composition | Tutorial clarity, cognitive load management | `multi_callout`, `annotation_density` | High | `annotation_reading_time`, `callout_stagger_pattern` | Good | High |
| **~96s** | After Effects screen recording: Camera Settings dialog open over a map composition | Frame at 96s: AE UI visible; "Camera Settings" modal with focal length, depth of field enabled | **Inferred**: mouse click sounds possible; no music during technical walkthrough | Transition from "what" to "how" — technical demonstration | Satisfy the viewer's procedural learning need | Tutorial clarity, trust | `screen_recording`, `software_ui`, `modal_dialog` | High | `software_ui_focus_region`, `dialog_duration` | Good | High |
| **~120s** | Hard cut back to talking head | Frame at 120s: host mid-speech | None observable | Break up screen-recording fatigue; re-establish human connection | Prevent tutorial monotony | Retention, fatigue relief | `talking_head_return`, `cut_transition` | High | `screen_recording_segment_length` | Good | High |
| **~150s** | AE screen recording: Lebanon map with red overlay mask; text layer "Lebanon The 10,45" in red | Frame at 150s: AE timeline visible; masked Lebanon shape; text properties panel open | None observable | Continue technical demonstration; show text animation setup | Teach typography and masking techniques | Tutorial clarity | `text_animation`, `mask_shape`, `timeline_visible` | High | `text_layer_count`, `mask_complexity` | Good | High |
| **~200s** | AE screen recording: text layer "Lebanon The 10,45" in red with font properties visible | Frame at 200s: text properties expanded; red fill color selected | None observable | Deep dive into typography settings | Teach font/color choices for documentary style | Tutorial clarity | `typography_panel`, `color_selection` | High | `font_change_frequency` | Good | High |
| **~266s** | AE camera close-up: clouds in focus, "Lebanon" text blurred in background; depth of field effect prominent | Frame at 266s: shallow DOF visible; camera positioned close to cloud layer | None observable | Demonstrate camera movement + depth of field in practice | Teach cinematic camera techniques | Tutorial clarity, authority | `depth_of_field`, `camera_zoom`, `layer_depth` | High | `focus_distance_keyframes` | Good | High |
| **~300s** | AE cloud overlay composition: multiple cloud layers with opacity/position controls visible | Frame at 300s: many timeline layers; fluffy cloud PNG overlays | None observable | Teach atmospheric layering techniques | Show how to build environmental depth | Tutorial clarity | `overlay_layer`, `opacity_animation` | High | `layer_count`, `opacity_keyframe_density` | Good | High |
| **~400s** | Hard cut back to talking head | Frame at 400s: host speaking | None observable | Another fatigue-relief return to host; likely introduces next section | Reset viewer attention; segment boundary | Retention, fatigue relief | `talking_head_return` | High | `section_boundary_marker` | Good | High |
| **~500s** | AE screen recording: parallax soldiers composition; font dropdown menu open showing "Apple Garamond" and other serif fonts | Frame at 500s: soldiers on cliff background; text tool active; font list visible | None observable | Teach font selection for historical documentary aesthetic | Guide viewers on typography choices | Tutorial clarity | `font_selection`, `parallax_composition` | High | `font_family_category` (serif vs sans vs script) | Good | High |
| **~600s** | AE shape layer: curved red banner behind soldiers with "545 A.D. / The year the Roman war began" | Frame at 600s: shape layer with bezier path; red stroke/fill; text integrated | None observable | Teach shape-layer-based title design | Show how to create custom lower thirds/titles | Tutorial clarity | `shape_layer`, `curved_path`, `title_banner` | High | `shape_path_complexity`, `text_shape_integration` | Good | High |
| **~700s** | Three playing cards layout: 3D card graphics showing documentary scenes; card 1 (soldiers), card 2 (flag), card 3 (Literature text) | Frame at 700s: dark background; cards have thin white borders and corner numbers; slight tilt/perspective | None observable | Showcase a different documentary graphic style (card metaphor) | Demonstrate variety of techniques | Retention, tutorial breadth | `3d_cards`, `playing_card_metaphor`, `scene_preview` | High | `card_perspective_angle`, `card_glow_presence` | Good | High |
| **~800s** | Graph/chart animation: yellow line chart with "Points pop-up & line drawing out" callout; "Zoom in transition" callout | Frame at 800s: white background; animated line graph with pop-up dots; yellow color scheme | None observable | Teach data visualization animation techniques | Expand tutorial scope beyond maps/history | Tutorial clarity, breadth | `chart_animation`, `line_graph`, `callout_text` | High | `chart_type`, `data_point_animation_style` | Good | High |
| **~900s** | AE text animation: "RATS" large bold text; paragraph block below in red/pink | Frame at 900s: AE text tool active; paragraph text selected; bold headline | None observable | Teach text block animation (possibly for Wikipedia-style info cards) | Show info-card typography setup | Tutorial clarity | `headline_text`, `paragraph_block`, `text_alignment` | High | `text_block_animation_type` | Good | High |
| **~1000s** | AE bar chart animation: multiple shape layers forming bar chart; timeline shows staggered keyframes | Frame at 1000s: bar chart with axes; many shape layers in timeline; staggered animation | None observable | Teach bar chart build animation | Show data viz technique #2 | Tutorial clarity | `bar_chart`, `shape_layer`, `staggered_animation` | High | `bar_count`, `stagger_interval` | Good | High |
| **~1030s** | AE numbered list: "01, 02, 03" in gold italic serif; vertical list with horizontal axis lines | Frame at 1030s: elegant numbered list; gold/white color; timeline shows many layers | None observable | Teach numbered list animation (possibly for timeline/sequence graphics) | Show list/hierarchy animation | Tutorial clarity | `numbered_list`, `gold_typography`, `vertical_list` | High | `number_format`, `list_item_stagger` | Good | High |

---

## 3. Sound Design Inventory

**Critical caveat:** I did not have access to audio waveform analysis or playback. The following are **inferred from visual context, genre conventions, and the structural logic of the edit**.

| Time | SFX/music event | Sound type | Timing relation | Lifecycle role | Repeated/varied/broken pattern | Likely purpose | Confidence |
|---|---|---|---|---|---|---|---|
| **0.0s** | **Inferred**: possible music bed or ambient intro | Music/ambient | On video open | Asset entry | Unknown | Set tone; establish energy | Low |
| **~8s** | **Inferred**: possible whoosh/impact on cut to B-roll | Whoosh/impact | On hard cut | Transition bridge | Unknown | Emphasize genre shift to cinematic | Low |
| **~44s** | **Inferred**: clean cut; no SFX likely | Silence / no SFX | On cut | Pattern break | Unknown (if previous had SFX) | Let talking head breathe; reduce fatigue | Low |
| **~96s–200s** | **Inferred**: minimal SFX during screen recording | Silence / UI clicks only | During tutorial | Fatigue relief | Unknown | Let viewer focus on technical details without audio distraction | Low |
| **~120s, ~400s** | **Inferred**: talking head returns with possible music bed return | Music re-entry | On talking head return | Fatigue relief | Unknown (if pattern) | Reset energy; break up screen recording monotony | Low |
| **~700s** | **Inferred**: possible card-dealing/shuffle SFX or whoosh | Whoosh / paper | On card appearance | Asset entry | Unknown | Reinforce card metaphor tactilely | Low |
| **~800s** | **Inferred**: possible pop/click SFX on data point appearance | Pop / click | On chart point entry | Asset entry | Unknown | Emphasize data point animation | Low |

**Honest assessment:** I cannot reliably populate the sound design inventory without waveform access. The visual evidence suggests this tutorial may use **minimal SFX** compared to a high-energy YouTube essay (like the Iman Gadzhi reference), because:
- The primary content is **screen recording**, where SFX would compete with verbal explanation
- The target audience is **learners** who need cognitive bandwidth for technical details
- The edit relies on **hard cuts** rather than stylized transitions, suggesting a "get out of the way" audio philosophy

**What I can say with medium confidence:** The video likely uses **background music during talking-head segments** and **reduced audio density during screen recordings**. If there are SFX during the animated documentary segments (8s–44s, 700s–800s), they would likely be subtle whooshes, impacts, or paper sounds that match the historical/documentary aesthetic.

---

## 4. Visual/Asset Inventory

| Time | Asset type | Entry behavior | Exit behavior | Motion/animation | Typography/color/depth | Why it exists | Feature implication |
|---|---|---|---|---|---|---|---|
| **0.0s** | Talking head (host) | Motion blur (already in motion) | Hard cut to B-roll | Host gesturing; possible camera push | Studio lighting; neutral grey shirt; blue accent light; RODE mic visible | Establish authority and personality | `host_presence`, `studio_production_value` |
| **~8s** | B-roll footage (Roman soldiers) | Hard cut | Hard cut to split screen | Slow pan or static; parallax layers possible | Warm sepia/cinematic grade; red serif text overlay | Show target documentary aesthetic | `b_roll_duration`, `text_overlay_on_b_roll` |
| **~20s** | Technique title card ("PARALLAX") | Appears in left panel | Hard cut to triptych | Static text; purple glow pulse | Purple neon glow; white sans-serif; dark background | Label the technique being taught | `title_card_style`, `glow_intensity` |
| **~30s** | Triptych panels | Three panels slide in or appear simultaneously | Hard cut to talking head | Each panel may have subtle parallax | Documentary footage; thin borders; consistent grading | Show breadth of content | `panel_count`, `panel_spacing` |
| **~52s** | Annotated breakdown (single callout) | Fade in or cut to static | Replaced by denser annotation | Static frame | White background; black callout arrow; grey text | Begin layer deconstruction | `callout_style`, `breakdown_phase` |
| **~68s** | Annotated breakdown (5+ callouts) | Multiple arrows appear | Cut to AE screen recording | Static frame; all labels visible simultaneously | Same style as above; dense annotation | Complete anatomy lesson | `annotation_density`, `label_count` |
| **~96s** | AE screen recording (Camera Settings) | Cut from breakdown | Cut to next AE view | UI interaction (mouse movement) | AE dark UI; modal dialog; map in background | Teach technical setup | `modal_duration`, `ui_focus_area` |
| **~150s** | AE composition (Lebanon map + text) | Cut from talking head | Cut to next AE view | Camera movement on map; text properties animated | Red text; masked shape; warm map colors | Teach masking + text animation | `composition_complexity`, `layer_visibility` |
| **~266s** | AE camera close-up (clouds) | Camera zooms in | Cut to cloud overlay comp | Camera push + DOF blur | Soft whites; shallow focus; "Lebanon" blurred | Teach camera + DOF | `dof_strength`, `camera_movement_type` |
| **~300s** | AE cloud overlays | Layer opacity fade in | Cut to talking head | Cloud drift; opacity keyframes | White/grey PNG overlays; soft edges | Teach atmospheric layering | `overlay_count`, `opacity_pattern` |
| **~500s** | AE parallax soldiers + font menu | Font menu opens | Cut to next AE view | Static composition; UI dropdown scroll | Soldiers in background; font list in foreground | Teach font selection | `font_menu_interaction`, `parallax_layer_count` |
| **~600s** | AE shape layer (curved banner) | Shape draws on or appears | Cut to next AE view | Shape path animation possible | Red fill; white stroke; curved bezier | Teach custom title shapes | `shape_path_type`, `shape_text_integration` |
| **~700s** | 3D playing cards | Cards appear in 3D space | Cut to next AE view | Card flip or float animation; slight perspective tilt | White borders; thin typography; scene thumbnails | Showcase alternative graphic style | `card_3d_depth`, `card_count` |
| **~800s** | Chart animation (line graph) | Points pop up; line draws | Cut to next AE view | Point scale pop; line path draw | Yellow points; grey axis; yellow line; white background | Teach data viz animation | `chart_type`, `draw_animation_style` |
| **~900s** | AE text block ("RATS") | Text types or fades in | Cut to next AE view | Possible type-on animation | Bold black headline; red paragraph; grey background | Teach info-card typography | `text_block_layout`, `headline_paragraph_ratio` |
| **~1000s** | AE bar chart | Bars scale up from bottom | Cut to next AE view | Staggered scale animation | Grey bars; white background; axis lines | Teach bar chart animation | `bar_count`, `stagger_interval` |
| **~1030s** | AE numbered list (01, 02, 03) | Numbers fade/slide in | End of observed sequence | Staggered entry; possible glow | Gold italic serif; horizontal axis lines | Teach list/timeline animation | `number_style`, `list_orientation` |

---

## 5. Abstract Patterns

### Pattern 1: Show-Label-Build Pedagogy
- **Observed evidence:** At 8s–68s, the video shows the finished cinematic result (B-roll), then labels its components (annotated breakdown), then opens the software to build it (AE screen recording at 96s). This pattern repeats for subsequent techniques.
- **Rule:** The edit follows a **three-phase loop**: (1) **Aesthetic preview** (show the pretty thing), (2) **Anatomic breakdown** (label the parts), (3) **Technical construction** (show the software). Each phase has a distinct visual register and edit cadence.
- **Why it matters:** This is a **tutorial-specific retention pattern**. It prevents the viewer from abandoning during the technical weeds because they already saw the compelling payoff. It also prevents confusion by giving them a labeled map of the composition before opening the software.
- **Feature candidates:** `pedagogical_phase` (preview / breakdown / construction), `preview_to_breakdown_time`, `breakdown_to_construction_time`, `annotation_density_by_phase`
- **Exceptions:** The intro (0s–8s) is a compressed preview that may skip the breakdown. The later sections (700s+) may compress phases if the technique is simpler.
- **Confidence:** High
- **Needs verification:** Whether the speaker's verbal narration maps 1:1 to these visual phases (i.e., does he say "here's what we're making" before the preview?)

### Pattern 2: Hard-Cut Rhythm Between Visual Registers
- **Observed evidence:** Every transition between talking head, B-roll, and AE screen recording is a **hard cut** (no cross-dissolves, no whoosh transitions visible in frames). Cuts happen at ~44s, ~96s, ~120s, ~400s.
- **Rule:** When switching between **visual registers** (studio → software → graphic preview), the editor uses hard cuts to signal a categorical shift in content type, not a narrative flow.
- **Why it matters:** In tutorial editing, hard cuts serve **cognitive clarity**. They tell the viewer: "we are now in a different mode of attention." This is distinct from vlog or documentary editing where transitions might be used to smooth narrative flow.
- **Feature candidates:** `register_transition_type`, `visual_register` (talking_head / screen_recording / graphic_preview / breakdown), `cut_frequency_by_register`
- **Exceptions:** The intro B-roll may have motion transitions (parallax, camera push) internal to the graphic, but the cut *into* the graphic is still hard.
- **Confidence:** High
- **Needs verification:** Whether any of the hard cuts have subtle audio bridges (music crossfade, J-cuts/L-cuts) that soften the visual abruptness.

### Pattern 3: Annotated Breakdown as "Explanatory Pause"
- **Observed evidence:** At 52s and 68s, the video holds on static frames with callout arrows for multiple seconds. These are not "animated" in the traditional sense—they are **reading frames**.
- **Rule:** The editor deliberately **slows edit cadence** to near-zero motion during annotation frames, allowing the viewer to read and map the labels to the underlying composition.
- **Why it matters:** This is a **cognitive load management** technique. In high-speed editing, viewers might miss the decomposition. The pause frame is an edit decision that prioritizes **clarity over energy**.
- **Feature candidates:** `static_annotation_duration`, `annotation_readability_score`, `callout_arrow_count`, `explanatory_pause_frequency`
- **Exceptions:** If the callouts animate in one-by-one (staggered), the frame isn't fully static. From extracted frames, I cannot determine stagger timing.
- **Confidence:** Medium (I see the result frame but not the entry animation)
- **Needs verification:** Whether callouts animate in sequentially or appear simultaneously; whether the speaker's narration is synchronous with callout appearance.

### Pattern 4: Color-Coded Typography Hierarchy
- **Observed evidence:** Red text is used for emphasis ("545 A.D.", "Lebanon", "Literature"). Gold/yellow text is used for data/numbers (chart points, numbered list "01, 02, 03"). White/light text is used for secondary descriptions.
- **Rule:** The documentary graphics use a **limited palette** where color carries semantic weight: **red = historical significance/primary subject**, **gold = data/metrics**, **white = supporting context**.
- **Why it matters:** Color consistency across disparate techniques (maps, charts, cards) creates a **unified tutorial brand** and helps the viewer recognize information type without reading.
- **Feature candidates:** `primary_text_color`, `secondary_text_color`, `color_semantic_role` (emphasis / data / context), `color_palette_consistency`
- **Exceptions:** The AE screen recording uses the software's default UI colors, which are outside the documentary palette.
- **Confidence:** High
- **Needs verification:** Whether the speaker explicitly calls out these color choices or if they are purely visual conventions.

### Pattern 5: Depth of Field as Recurring Motif and Teaching Point
- **Observed evidence:** DOF is explicitly labeled as a technique in the breakdown (68s: "Depth of field" callout). It is then demonstrated in the AE camera close-up (266s). The host's studio setup also uses shallow DOF (background softly blurred).
- **Rule:** **DOF is both a subject and a meta-technique**. The video teaches it while also using it in the host's production setup to reinforce authority.
- **Why it matters:** This creates **visual coherence between the tutorial and the tutorial's container**. The viewer is unconsciously experiencing the technique while consciously learning it.
- **Feature candidates:** `dof_in_host_shot`, `dof_teaching_moment_timestamp`, `dof_in_graphic_preview`, `depth_of_field_consistency`
- **Exceptions:** The screen recording segments show the AE UI in full focus (no DOF), which is necessary for UI clarity.
- **Confidence:** High
- **Needs verification:** Whether the host's DOF is in-camera or post-processed; whether the graphic DOF is achieved via AE camera or blur effects.

### Pattern 6: Screen Recording Segment Length Control
- **Observed evidence:** The video returns to the talking head at ~120s and ~400s, breaking up long screen recording passages. The segments between returns are roughly 60–280s.
- **Rule:** The editor **caps screen recording duration** with talking-head interstitials to prevent viewer fatigue and provide verbal signposting.
- **Why it matters:** Screen recordings are cognitively demanding. Without breaks, viewers may zone out. The talking-head returns act as **chapter markers** and **energy resets**.
- **Feature candidates:** `screen_recording_segment_length`, `talking_head_interstitial_frequency`, `fatigue_relief_return_interval`
- **Exceptions:** The final segments (800s+) may have longer screen recordings if the techniques are simpler or if the viewer is already deeply engaged.
- **Confidence:** Medium
- **Needs verification:** Whether the talking-head returns correspond to verbal "chapter" transitions (e.g., "now let's move on to...").

---

## 6. Candidate Feature Deltas

| Candidate feature | Type/values | Why needed | Example timestamp | Train now, manual-only, or defer? |
|---|---|---|---|---|
| `visual_register` | Categorical: `talking_head`, `screen_recording`, `graphic_preview`, `annotated_breakdown`, `b_roll` | The video's meaning changes drastically depending on which register is active. Current ontologies often miss the distinction between "screen recording" and "B-roll." | 0s, 44s, 96s, 700s | **Train now** (visible) |
| `pedagogical_phase` | Categorical: `preview`, `breakdown`, `construction`, `recap` | Tutorial editing has a distinct temporal structure. Capturing this enables IRL to learn "when to show the payoff vs. when to explain the parts." | 8s (preview) → 52s (breakdown) → 96s (construction) | **Train now** (inferred from visual sequence) |
| `annotation_density` | Integer: count of callout arrows/labels on screen | Static breakdown frames are a distinct editing mode. Their density signals how much decomposition the editor thinks is needed. | 52s (1 callout), 68s (5+ callouts) | **Train now** (visible) |
| `explanatory_pause_duration` | Float: seconds of near-zero motion on screen | The annotated frames are held longer than typical cuts. Measuring this captures the "clarity over energy" tradeoff. | ~52s–68s | **Train now** (frame diff measurable) |
| `screen_recording_segment_length` | Float: seconds between talking-head returns | Fatigue management in tutorials requires measuring how long the editor stays in software before returning to the host. | ~96s–120s (~24s), ~150s–400s (~250s) | **Train now** (visible) |
| `color_semantic_role` | Categorical mapping: color → role (emphasis/data/context) | The limited color palette carries meaning. Learning this enables the model to predict which color to use for which information type. | 8s (red=emphasis), 800s (yellow=data) | **Train now** (visible, but requires color extraction) |
| `dof_in_host_shot` | Boolean | The host's production quality (shallow DOF) signals authority and subtly teaches the technique. | 0s, 44s, 120s | **Train now** (edge/blur analysis) |
| `software_ui_focus_region` | Categorical: `project_panel`, `timeline`, `viewer`, `properties`, `modal_dialog` | During screen recordings, the viewer's attention must be directed to the correct UI region. The editor likely zooms or highlights regions. | 96s (modal dialog), 150s (timeline), 200s (properties) | **Defer** (requires UI element detection) |
| `audio_register_transition` | Boolean + type: does audio bridge the hard cut? | Hard cuts might be softened by J-cuts/L-cuts. Without waveform analysis, this is uncertain. | ~44s, ~120s | **Defer** (requires waveform + sync analysis) |
| `sfx_during_graphic_preview` | Boolean + type | Documentary graphics may have subtle whooshes/impacts. I cannot verify this from frames. | 8s, 700s | **Defer** (requires audio analysis) |
| `callout_stagger_pattern` | Categorical: `simultaneous`, `sequential`, `speaker_synced` | How callouts enter the breakdown frame matters for readability. | 68s | **Manual-only** (requires frame-by-frame review) |
| `host_gesture_energy` | Float: motion magnitude in talking head | The host's energy level may modulate to match the phase (high energy in preview, lower in technical explanation). | 0s (high), 44s (moderate) | **Defer** (requires motion analysis) |
| `tutorial_clarity_score` | Composite: annotation_density + phase_order + return_frequency | A meta-feature that captures how well the tutorial structure supports learning. | Entire video | **Manual-only** (subjective) |

---

## 7. Training Safety

### Trainable now:
- `visual_register` (talking_head, screen_recording, graphic_preview, annotated_breakdown) — reliably distinguishable from frames
- `hard_cut_presence` vs. `transition_type` — visible in frame sequences
- `text_overlay_presence` and `text_color` — visible via OCR or color sampling
- `annotation_density` and `callout_arrow_count` — visible in static breakdown frames
- `screen_recording_segment_length` — measurable from frame sequences
- `pedagogical_phase` — inferable from visual_register sequence (preview → breakdown → construction)
- `dof_in_host_shot` — detectable via edge sharpness analysis on host vs. background
- `color_semantic_role` — trainable if color extraction is available; patterns are consistent
- `multi_panel_layout` — detectable (triptych at 30s, split screen at 20s, cards at 700s)
- `software_ui_modal_presence` — detectable (modal dialogs in AE at 96s)

### Manual-only for now:
- `pedagogical_phase` accuracy — requires transcript alignment to confirm the speaker is explaining the same thing the visuals show
- `callout_stagger_pattern` — requires frame-by-frame review of the breakdown segments
- `tutorial_clarity_score` — inherently subjective; needs human annotator consensus
- `host_gesture_energy` — requires motion analysis that may not be reliable across different hosts
- `color_semantic_role` meaning — the model can see the colors, but the *semantic* mapping (red=emphasis) is an interpretive claim

### Defer:
- `audio_register_transition` — needs waveform + transcript alignment to detect J-cuts/L-cuts
- `sfx_during_graphic_preview` — needs audio classification
- `software_ui_focus_region` — needs UI element detection trained on AE/Pr/FCP interfaces
- `explanatory_pause_duration` exact measurement — needs precise frame diff or optical flow to distinguish "static" from "subtle motion"
- `callout_reading_time` — requires knowing when the speaker starts/stops explaining the callout
- `music_bpm_change` — requires tempo analysis
- `host_diction_pacing` — requires transcript + audio alignment

### Reject:
- Correlating `font_family` with `video_quality` — would teach the model that "Apple Garamond = good tutorial," which is a surface correlation that doesn't generalize
- Assuming `screen_recording_length` is always inversely correlated with `retention` — longer recordings may be appropriate for complex topics; the model should learn *when* to cut back, not just *how often*
- Inferring `sfx_presence` from `cut_frequency` — hard cuts do not necessarily imply SFX; this would create false positives

---

## 8. Final Judgment

### How much of this video's key editing decisions are explainable by the current feature vocabulary?

**Roughly 50–60%.** The standard feature ontology (cuts, transitions, text overlays, shot types) can capture:
- The hard-cut rhythm
- The presence of text and graphics
- The talking head vs. screen recording distinction
- Basic multi-panel layouts

But it **misses** the tutorial-specific logic: the Show-Label-Build phase structure, the pedagogical purpose of annotated breakdowns, the fatigue-relief function of talking-head returns, and the semantic color hierarchy. These are not "generic video edits"—they are **domain-specific editing decisions** optimized for learning outcomes.

### How much becomes explainable after the proposed feature deltas?

**Roughly 80–85%.** Adding `visual_register`, `pedagogical_phase`, `annotation_density`, `screen_recording_segment_length`, and `color_semantic_role` would capture the core tutorial editing grammar. The remaining 15–20% is audio-dependent (SFX, music pacing, J-cuts) and fine-grained UI interaction (where the mouse moves, which AE panel is active).

### What are the top 5 missing concepts?

1. **Pedagogical phase sequencing** — The model needs to understand that tutorial editing follows a predictable loop: preview → breakdown → construction. This is a higher-order temporal pattern, not a single-frame feature.
2. **Annotated breakdown as a distinct editing mode** — Static frames with callouts are not "just text overlays." They are **deliberate cognitive pauses** that require their own feature class (duration, density, reading order).
3. **Visual register transition intent** — Hard cuts between talking head and screen recording are not "lazy editing." They are **cognitive signposts** that tell the viewer to switch attention modes. The model needs to learn register as a categorical feature, not just detect "a cut happened."
4. **Color as semantic signal** — The limited palette (red, gold, white) carries consistent meaning across techniques. Standard color features capture hue/saturation but not *role*.
5. **Fatigue-relief interstitial timing** — The talking-head returns are not random. They cap screen-recording duration based on cognitive load. A model needs to learn `screen_recording_segment_length` as a function of content complexity, not as a fixed interval.

### What should the next human auditor look for in the next video?

1. **Audio-verification of all claims** — The next auditor must have waveform access or playback ability. I flagged ~12 audio claims as "low confidence" that need verification.
2. **Frame-level callout animation** — Does the 68s breakdown show callouts appearing simultaneously or staggered? Frame-by-frame review needed.
3. **Transcript alignment** — When the speaker says "now let's look at X," does the visual cut happen before, on, or after the keyword? This is critical for the `pedagogical_phase` feature.
4. **Mouse cursor tracking in screen recordings** — Where does the cursor move? Does the editor zoom the AE viewer to follow the cursor? This is a sub-feature of `software_ui_focus_region`.
5. **J-cuts and L-cuts** — Even though the visual cuts are hard, audio may bridge them. The next auditor should check if the host's voice starts before the cut back to his face (L-cut) or if B-roll audio continues under the talking head (J-cut).
6. **Music bed presence/absence** — Is there background music during the talking head but not during screen recordings? Or is music continuous? This affects the `audio_register_transition` feature.
7. **Zoom/pan in the host shot** — The host's talking-head shot may have subtle camera movement (push/pull) to prevent static talking-head fatigue. Frame comparison across multiple talking-head segments would reveal this.
8. **Outro pattern** — The video was 1260s but I only observed up to ~1030s in extracted frames. The final ~230s may contain a summary, CTA, or outro music change that follows different editing rules.

---

**Auditor signature:** This analysis was conducted without direct audio playback. All visual claims are based on extracted frame samples. All audio claims are marked with appropriate confidence levels and should be verified by a subsequent auditor with waveform access. No precision was invented; timestamps are approximate (±1s) unless derived from frame extraction metadata.
