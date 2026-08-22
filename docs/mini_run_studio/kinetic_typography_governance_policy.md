# Kinetic Typography & Motion Governance Policy

**Version**: 3.0.0  
**Domain**: MAUL Backend Typography & Kinetic Suite Compiler  
**Location**: `docs/mini_run_studio/kinetic_typography_governance_policy.md`  
**Scope**: Governed composition rules for chunked transcript sequence rendering  

---

## 1. Disposition to Weariness & Typewriter Scope Governance Policy

### 1.1 Cognitive Fatigue & Disposition to Weariness Function
* **Core Principle**: High-salience character-by-character reveals (e.g. typewriter cursors, parsing search inputs) trigger rapid cognitive weariness in observers if repeated. An effect with high disposition to weariness is discerned as repetitive far faster than neutral kinetic motion.
* **Mathematical Penalty Function**:
  $$\text{Penalty}(\text{effect}, N) = \begin{cases} 1.0 & \text{if } N = 0 \\ 0.0 & \text{if } N \ge 1 \text{ (Total Disqualification)} \end{cases}$$
* **Hard Frequency Cap**: Strictly capped at **maximum ONE (1) usage across the entire 40-second presentation timeline**.
* **Automatic Re-Routing**: Any subsequent chunks attempting to request a typewriter engine are automatically re-routed to non-fatiguing dynamic motion engines (`viewport_mask_sweep`, `keynote_punch`, `defocus_rack_focus`, `staggered_glyph_slot`, `spring_character_cascade`).

### 1.2 Single Hero Layer Allocation Invariant
* **Multi-Layer Contrast Rule**: Within any given chunk, exactly **ONE (1)** hero layer (`primary_focus_word` if present, else `header`) receives a primary kinetic entrance preset.
* **Context & Secondary Isolation**: All non-hero layers (context prefixes, secondary clauses) strictly receive soft word reveals (`subpixel_blur_mask`), completely preventing duplicate badges, competing search capsules, or visual clutter.

### 1.3 Payoff Clause Isolation Rule
* **Lead-in Prefixes**: MUST use independent, per-word mask reveals (`subpixel_blur_mask` or soft word slides).
* **Terminal Payoff Phrases**: Receives the single authorized **Hexta Ghost Typewriter Engine** with an active cursor.

### 1.4 Number Count-Up Engine Frequency Cap & High-Valuation Selection Policy
* **Frequency Cap**: The **3D Film Count-Up Engine** (`film_3d_count_up_engine`) is strictly capped at **maximum TWO (2) usages per 40-second sequence window**.
* **High-Valuation Selection Priority**: Prioritizes the **highest financial valuation hero figures** (e.g. Chunk 8 `"$500,000."` and Chunk 13 `"$50,000"`).

### 1.5 10% Digit Percentage Binding Rule for 3D Film Counter Engines
* **The Root Cause Fix**: The digit strip contains 10 vertical digit blocks (`0` through `9`). Therefore, the total strip height is $10\times$ the height of a single digit window.
* **Mathematical Calculation**: Moving down by 1 digit step corresponds to **$10\%$ of the total strip height** (NOT $100\%$).
* **Rule**: Digit strip transforms MUST enforce:
  $$\text{translateY}\left(-\text{digit} \times 10\%\right)$$
* **Result**: Digit `5` in `$500,000` translates by $-50\%$ of the strip height, landing **100% dead-center** in the digit window with zero clipping, overflow, or half-step freezing!

---

## 2. Per-Layer Motion Contrast, Layered Composition & Repertoire Diversity Policy

### 2.1 Layer-Role Allocation
Multi-layer chunks MUST NOT apply identical kinetic animations across all layers. Each layer receives a distinct, non-competing motion treatment tailored to its rhetorical role.

### 2.2 Motion Animation vs. Stylistic Overlay Treatment Composition Architecture
* **Kinetic Motion Animations** (`fx`): Defines how text enters or moves spatially across frames (`subpixel_blur_mask`, `staggered_rotate_x`, `keynote_punch`, `slot_bounce`, `blur_reveal_sweep`, `film_3d_count_up_engine`).
* **Stylistic Overlay Treatments** (`treatmentOverlay`): Visual highlight filters, sweeps, or energy overlays that wrap *around* or *over* the moving text (`cinematic_viewport_mask_sweep`, `electric_blue_energy_line`, `blue_text_shimmer_wave`, `soft_lavender_highlight`).
* **Layered Composition Rule**: Stylistic Overlay Treatments are NOT mutually exclusive with kinetic motion animations. They CAN be composed together on hero keywords.

### 2.3 Repertoire Diversity & Variety Allocation Policy
* **Core Rule**: The compiler MUST NOT collapse into repeating the same 2–3 motion presets across a 20-chunk sequence. It MUST cycle through the full 28-preset kinetic suite repertoire.

---

## 3. Calligraphy Script & Font Stylism Preservation Policy

### Core Principle
Kinetic animation wrappers MUST NEVER break font stylism, calligraphic stroke joins, or word boundary spacing.

---

## 4. 9:16 Viewport Word-Wrap, Syllable Breakage & Invariant Containment Policy

### 4.1 Invariant: Zero In-Word Breakage & Syllable Splitting (Atomic Word Rule)
* **Absolute Invariant**: Words MUST NEVER be broken, hyphenated, or split across lines (e.g. `FOUNDE` / `RS`, `witho` / `ut`, or `mon` / `ey.`) on ANY run, under ANY seed, on ANY device.
* **Atomic Word Containers**: All character-level animation engines (`typewriter_mono_caret`, `glow_search_input_caret`, `spring_character_cascade`, `acid_lime_letter_glitch`, `staggered_glyph_slot`) MUST wrap individual words into atomic `.word-span` containers with:
  ```css
  .word-span {
    display: inline-block !important;
    white-space: nowrap !important;
    word-break: keep-all !important;
    overflow-wrap: normal !important;
    hyphens: none !important;
    -webkit-hyphens: none !important;
    flex-shrink: 0 !important;
  }
  ```
* **Line Breaking**: Line wrapping can ONLY occur at whitespace word boundaries (`.word-spacer` with `&nbsp;` or `row-gap: 0.15em`) between complete, intact words.
* **Pill & Capsule Badges**: Search inputs and pill highlight cards must maintain `white-space: nowrap !important; flex-shrink: 0 !important;` and contain the full intact word/phrase.

### 4.2 Font-Size Auto-Scaling Constraint for Unclipped Safe Canvas Width
* **Core Calculation**: The compiler computes the rendered width of the longest word:
  $$W_{\text{longest}} = L_{\text{word}} \times S_{\text{font}} \times R_{\text{char}}$$
* **Clamping Invariant**: If $W_{\text{longest}} > 0.86 \times W_{\text{container}}$, $S_{\text{font}}$ is dynamically clamped:
  $$S_{\text{safe}} = \left\lfloor \frac{0.86 \times W_{\text{container}}}{L_{\text{word}} \times R_{\text{char}}} \right\rfloor$$
* **Result**: Every word is mathematically guaranteed to fit horizontally within the 9:16 stage with zero clipping and zero line splitting.

---

## 5. Subject Depth Matting & Weight Threshold Policy

### 5.1 Minimum Font Weight Threshold (`fontWeight >= 700`)
* **Core Rule**: Words eligible for subject depth matting (`behind_subject` / `tactile_head_contact`) MUST be above a strict font weight threshold (`fontWeight >= 700`).

### 5.2 Maximum 40% Obscuration Hard Cap Rule
* **Core Rule**: If text obscuration by the speaker subject exceeds **40%**, the text layer MUST automatically shift to the foreground (`in_front_of_subject`).

### 5.3 Small Article Scale Expansion for Matting (Chunk 4 Rule)
* **Core Rule**: When a single small article (e.g. `"A"`) precedes a hero matted keyword, it MUST receive a **scaled visual weight expansion / font-size boost** (e.g. 36px uppercase italic `Playfair Display`).

---

## 6. Head-Level Clearance, Mouth Avoidance & Detachment Governance

### 6.1 MediaPipe Face & Mouth Geometry Observation
MediaPipe tracks face/mouth boundaries (`faceBox: [x:0.34, y:0.28, w:0.32, h:0.22]`).

### 6.2 Mandatory Tactile Head-Contact Overlap Enforcement
* Text matted behind the subject MUST physically overlap the top curve of the speaker's hair ($15\%\text{--}25\%$ hair overlap, $+20\text{px}$ to $+28\text{px}$ downward margin offset).

### 6.3 Unified Family Migration & Selective Depth Matting Rule
* When a chunk contains a matted hero word, all layers in that chunk's font family group move TOGETHER as a single composite unit to $y = 19.5\%$.

### 6.4 MediaPipe Mouth & Face Avoidance Clearance Rule (Chest Zone $y = 56.5\%$)
* Foreground text MUST NEVER sit directly over the speaker's face, lips, or mouth. Non-matted chunks route to $y = 56.5\%$ (Chest Zone).

### 6.5 Controlled Hierarchy Detachment for Overly Obscured Payoffs
* When a terminal payoff phrase suffers $>75\%$ body obscuration, it detaches cleanly to Zone B ($y = 56.5\%$) in crisp white + reduced-intensity cyan accent (`#00E5FF`).

---

## 7. Zero Asset Repetition & Clean Slate Governance Policy

### 7.1 Absolute Prohibition on Asset Reincarnation
* **Core Rule**: Background semantic assets MUST NEVER be repeated, recycled, or re-themed across chunks in the same sequence.
* **Clean Slate Default**: If a scene chunk does not demand a completely unique, semantically grounded asset, it MUST default to a **Clean Slate** (`backgroundAsset: null`). This ensures maximum visual breathing room and high-contrast impact when hero assets appear.

---

## 8. Causal Silhouette Flood-Matte & Mature Typography Governance Policy

### 8.1 Causal Flood-Matte Isolation Rule
* Background semantic assets MUST be processed through the causal flood-matte engine (`renderOuterFloodMatteAsset`), strictly keying out solid backgrounds, unkeyed photo rectangles, and stock watermarks.
* Assets MUST be pure silhouetted objects (e.g. clean rocket hull and exhaust plume), positioned behind the speaker's shoulder ($Z:10$).
* Artificial rotation wrappers or distracting secondary picture-in-picture badges are strictly prohibited.

### 8.2 Mature Editorial Typography Standard
* Childish or unmotivated shape masks (e.g., flat colored circles or arbitrary badges) are strictly banned.
* Typography MUST adhere to high-end documentary standards: high-contrast tracked serif/sans pairs, clean drop shadows, and refined micro-animations.

---

## 9. Core Points of Inflection & Multi-Tier Entity Governance Policy

### 9.1 Core Points of Inflection as Creative Canvases (Anti-Image-Slotting)
* **Core Rule**: Semantic extraction identifies **Core Points of Inflection (CPI)** — moments of high emotional, rhetorical, or structural salience.
* **Prohibition**: An inflection point MUST NEVER be treated as a mechanical mandate to insert a background image.
* **Creative Hierarchy**: Inflection points must first explore high-energy typography (cyber matrix glitch, 3D cascades, live numeric counters), then stylistic overlays (highlight sweeps, contrast inversion), then mini entity assets, and only lastly macro scene cutouts.

### 9.2 Asset Taxonomy: Mini / Micro Entities vs. Macro Scene Cutouts
* **Mini / Micro Entity Assets (`mini_asset`)**:
  * Represents specific named entities, tools, or brands mentioned in speech (e.g. *"never post on Instagram"* $\to$ Instagram icon badge).
  * Rendered as compact, high-precision vector/cutout badges accompanying Stage 1 typography on Stage 2 ($Z:30$).
* **Macro Thematic Scene Assets (`macro_asset`)**:
  * Large, atmospheric depth cutouts (e.g. Founders Trio, historical landmarks).
  * Mounted strictly behind the speaker's shoulder ($Z:10$), capped at max 1–2 per 40-second timeline.

### 9.3 Sequential Staging Execution
* All video chunks execute sequentially:
  $$\text{Stage 1: Typography-First Bedrock} \to \text{Stage 2: Inflection Enhancement (Motion / Mini-Entity / Macro)} \to \text{Stage 3: Depth \& Cinematic Post-VFX}$$

---

## 10. Tall-Font Behind Principal Speaker Policy & Adaptive Companion Hierarchy

### 10.1 Core Principle: Dominant Tall-Font as Compositional Exception
When the system determines that a chunk is a **dominant tall-font inflection moment**, the tall-font element is granted **compositional priority**. All surrounding typography adapts around it — never the inverse. Normal font JSON / template rules remain the default for ordinary typography and are NOT overridden except during a tall-font depth treatment.

### 10.1a Zone A (Behind-Speaker) Exclusivity — Only True Tall Fonts
**Zone A** (the matted principal speaker's occluded plane, `$Z:10`) is reserved **exclusively for tall-font text**. Ordinary typography — even short phrases — is never routed behind the speaker; it always renders in **Zone B** (`$Z:30`, in front). The `isHeadZone` gate is driven purely by `tallFontSubjectTreatment` (a core subject that always receives a tall-font profile), so no non-tall text can be placed behind the principal speaker.

### 10.1b Tall Text Is Clean — No Treatment
Tall depth text receives **NO decorative kinetic treatment** (`monolith_clean_seal` only). Chrome/glass/glitch/overlap/stagger treatments are **Zone B (companion) concepts only** and are never applied to the behind-speaker monolith.

### 10.1c Tall Text Height Is Dominant
Tall text is sized against the head-stage **vertical extent** (`calculateTallHeroFontSize`) so its glyph height is orders of magnitude taller than foreground companions (~24–70px). It never collapses back to ordinary caption scale (hard floor ~150px) and is width-clamped only to preserve a single-line fit.


**Key Invariant**: At most **ONE** subject-mask core phrase may appear per chunk (`isCoreSubjectText: true`). The `CORE_TEXT_HERO_OVERRIDES_FONT_JSON = true` flag signals that the companion layers defer to the dominant element rather than the font JSON template.

### 10.2 Eligibility Criteria for Tall-Font Treatment (`selectCorePhraseForSubjectMask`)
A chunk earns a tall-font behind-speaker treatment when **any** of the following linguistic salience criteria are met:

| Criterion | Description |
|-----------|-------------|
| **Metric salience** | Chunk contains a numeric figure, `$`, `€`, or `£` symbol |
| **Inflection emphasis** | `raw.emphasis` ∈ `{inflection_tension, inflection_solution, named_entity_founders, terminal_payoff}` |
| **Core lexical term** | Text matches `CORE_SUBJECT_TERMS` regex (thematic nouns: scale, system, mistake, convince, etc.) |
| **Concise punchy phrase** | 1–4 words where at least one substantive token ≥ 4 chars and is not a functional particle |

**Minimum cooldown**: Subject-mask treatments must be separated by at least **3 chunks** (`lastSubjectMaskChunk`) to prevent density saturation.

### 10.3 Dominant Phrase Extraction (Linguistic Salience Scoring)
The **best 1–3 word focal window** is selected by scoring each token:

| Score Rule | Points |
|-----------|--------|
| Functional particle (stopword) | 0.1 |
| Substantive length bonus | `+min(len × 0.4, 3.0)` |
| Numeric/metric token | +4.0 |
| Matches `CORE_SUBJECT_TERMS` regex | +5.0 |
| Capitalized in source | +1.5 |

The window with highest total salience that contains at least one token with score ≥ 2.0 becomes the dominant phrase. If the token immediately preceding the window is an adjective-modifier (`physical`, `biggest`, `not`, `shot`, etc.) and the expanded window ≤ 3 tokens, the modifier is included.

### 10.4 Mood-Matched Tall Font Profile Selection (`selectTallFontProfile`)
The tall font profile is **not randomly selected**. It is matched to the semantic mood of the inflection:

| Mood | Preferred Profile Family |
|------|--------------------------|
| `tension`, `mistake`, `bottleneck`, `breaking` | Heavy industrial / brutalist condensed (Exarch, Humane, Anton, Teko) |
| `solution`, `fashion`, `founder`, `elegant` | Ultra-tall Didone serif (Harmony, Bodoni) |
| `growth`, `scale`, `metric`, `pill` | Ultra-condensed Pill / Grotesk (Growth, Community, Bebas, Oswald) |
| `tech`, `system`, `skywall` | Futuristic metallic display / hairline (Skywall, Terrance, Saira) |

If no mood-specific match exists, falls back to the full tall-font candidate pool with seed-deterministic selection.

### 10.5 Dynamic Companion Reflow Composition Modes (`reflowCompanionLayersAroundSubjectMask`)
Companion words (all non-core tokens) are distributed into an **intentional cinematic layout**, not random anchors:

| Composition Mode | Trigger Condition | Visual Reference |
|-----------------|-------------------|-----------------|
| `split-diagonal` | Both prefix AND suffix words exist around dominant phrase | Ref #1: "Not **CONVINCED** yet" |
| `top-satellite` | Only prefix words exist (dominant phrase is at end) | Ref #3: "**This is** Hitesh", Ref #5: "**Shot it** Blurry" |
| `flanked-lateral` / `lower-right` | Only suffix words exist (dominant phrase is at start) | Payoff continuation |
| `monolithic-stack` | No companion words — dominant phrase fills entire slot | Ref #2: "WOULD YOU HIRE", Ref #4: "biggest mistake" |

### 10.6 Companion Typography Styling (Adaptive High-Contrast Hierarchy)
Companion words receive **contrastive styling** relative to the dominant tall-font block to produce intentionally cinematic hierarchy:

| Composition Mode | Companion Font | Weight | Style |
|-----------------|----------------|--------|-------|
| `split-diagonal` (prefix/suffix) | Bodoni Moda | 600 | Italic |
| `top-satellite` (header) | Caveat **or** Playfair Display | 700 | Normal / Italic (alternates) |
| Standard companion (monolithic / flanked) | Font JSON template | As per profile | As per profile |

### 10.7 Depth Z-Plane Architecture
```
Z:5   — Raw video background
Z:10  — Dominant tall-font core phrase (passes behind matted speaker)
Z:20  — Matted speaker cutout (#speakerCutout)
Z:30  — Companion typography (in front of speaker)
```
CSS invariants enforced:
- `.subject-mask-core-layout .typo-layer { z-index: 10; /* behind matted foreground speaker */ }`
- `.subject-mask-companion-stage { z-index: 30; /* in front of speaker */ }`

### 10.8 Authoritative Tall Font Profile Corpus (7 Profiles)
The **generalizable detection signal is the Font JSON corpus field `metadata.is_tall_font === true`**, not a hardcoded font-name list. Every profile below carries this authoritative flag, so any tall-font profile added to the corpus later is recognized automatically without editing the detector. A legacy condensed/display font-name heuristic remains only as a backward-compatible fallback for profiles that predate the flag; it must never override the authoritative flag.

| Profile Name | Category | Mood Affinity |
|-------------|----------|---------------|
| `Harmony_UltraTall_Didone_Serif` | Ultra-tall serif | Elegant / founder / solution / tech |
| `Community_UltraCondensed_Grotesk` | Condensed grotesk | Growth / community / scale |
| `Terrance_Extreme_Hairline_Tall` | Hairline display | Tech / system / precision |
| `Exarch_Heavy_Industrial_Block` | Heavy block | Tension / industrial / mistake |
| `Humane_Spiked_Stem_Brutalist` | Brutalist spiked | Breaking / bottleneck / conflict |
| `Growth_UltraCondensed_Pill_Grotesk` | Pill grotesk | Scale / metric / growth |
| `Skywall_Futuristic_Metallic_Display` | Metallic display | Tech / skywall / system |


### 10.9 CSS Anchor Classes for Layout
The companion stage supports the following intentional composition anchor classes:
- `.anchor-split-diagonal` — Prefix top-left, suffix lower-right (diagonal cinematic frame)
- `.anchor-top-satellite` / `.anchor-top-center` — Companion header centered above dominant text
- `.anchor-upper-left` / `.anchor-top-left` — Companion top-left
- `.anchor-upper-right` / `.anchor-top-right` — Companion top-right
- `.anchor-lower-right` / `.anchor-bottom-right` — Companion lower-right (payoff)
- `.anchor-flanked-left` / `.anchor-flanked-right` — Lateral flanking
- `.anchor-monolithic-stack` — Centered monolithic stack (no companion reflow needed)
