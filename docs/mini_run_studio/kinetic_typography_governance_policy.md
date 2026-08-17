# Kinetic Typography & Motion Governance Policy

**Version**: 2.9.0  
**Domain**: MAUL Backend Typography & Kinetic Suite Compiler  
**Location**: `docs/mini_run_studio/kinetic_typography_governance_policy.md`  
**Scope**: Governed composition rules for chunked transcript sequence rendering  

---

## 1. Typewriter & Number Counter Scope Governance Policy

### 1.1 Single Typewriter Budget Per 40-Second Window
* **Core Rule**: The character-by-character typewriter animation engine is a high-salience, specialized focal effect. It MUST NOT be over-used or repeated across multiple scene chunks within a standard 40-second timeline sequence.
* **Frequency Cap**: Strictly capped at **maximum ONE (1) usage per 40-second sequence window**.

### 1.2 Payoff Clause Isolation Rule
* **Lead-in Prefixes**: MUST use independent, per-word mask reveals (`subpixel_blur_mask` or soft word slides).
* **Terminal Payoff Phrases**: Receives the single authorized **Hexta Ghost Typewriter Engine** with an active cursor.

### 1.3 Number Count-Up Engine Frequency Cap & High-Valuation Selection Policy
* **Frequency Cap**: The **3D Film Count-Up Engine** (`film_3d_count_up_engine`) is strictly capped at **maximum TWO (2) usages per 40-second sequence window**.
* **High-Valuation Selection Priority**: Prioritizes the **highest financial valuation hero figures** (e.g. Chunk 8 `"$500,000."` and Chunk 13 `"$50,000"`).

### 1.4 10% Digit Percentage Binding Rule for 3D Film Counter Engines
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

## 4. 9:16 Viewport Word-Wrap & Mid-Word Cut-In Prevention Policy

### 4.1 Helper Word Isolation & Prefix Layering
* Additive/helping words attached to long hero keywords MUST be extracted into separate italicized helper prefix layers.

### 4.2 Font-Size Auto-Scaling Constraint for Unclipped Safe Canvas Width
* **Core Rule**: Text assigned to a single line MUST NEVER exceed 85% of the safe canvas width. If a long hero phrase has a `measuredWidthPx > 260px`, the compiler MUST automatically scale `fontSizePx` down to guarantee zero right-margin word clipping.

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

