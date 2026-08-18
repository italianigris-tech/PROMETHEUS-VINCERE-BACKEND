# Semantic Extraction & Hierarchical Inflection Architecture

**Version**: 8.0.0  
**Location**: `docs/mini_run_studio/semantic_extraction_architecture.md`  
**Domain**: Multi-Tiered Semantic Inflection Treatment, Entity Taxonomy & Sequential Staging Engine  

---

## 1. Paradigm Shift: Inflection Points vs. Forced Image Insertion

### 1.1 The "Semantic $\to$ Forced Image" Defect
* **The Flawed Assumption**: Treating semantic keyword extraction as a direct trigger to render a full-frame 3D background image behind the speaker.
* **The Root Cause**: When every detected "core concept" forces a large background asset (e.g., machinery, rocket, gears), the composition suffers from **aesthetic over-fitting (patricity)** and visual fatigue.
* **The Architectural Correction**: Semantic extraction identifies **Core Points of Inflection (CPI)** — pivotal moments of emotional, rhetorical, or structural weight. An inflection point is a **creative opportunity canvas**, NOT an image placeholder.

```
[Spoken Transcript Chunk]
           │
           ▼
[Semantic Analysis & Cadence Engine]
           │
           ▼
[Identify Core Point of Inflection (CPI)]
           │
           ├────────────────────────┬────────────────────────┬────────────────────────┐
           ▼                        ▼                        ▼                        ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│  Tier 1: Typographic │ │ Tier 2: Stylistic    │ │ Tier 3: Mini / Micro │ │ Tier 4: Macro Thematic│
│  Detonation & Motion │ │ Overlays & Shaders   │ │ Entity Assets        │ │ Scene Cutouts         │
│  (Glitch/3D/Counters)│ │ (Sweeps/Inversion)   │ │ (Icons/Brands/Badges)│ │ (Founders/Monuments)  │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘
```

---

## 2. Multi-Stage Sequential Execution Pipeline

Every video sequence executes across three sequential stages of increasing creative fidelity:

### Stage 1: Typography-First Bedrock (Foundational Layer)
* **Principle**: Typography is the primary visual anchor and must stand completely on its own before any auxiliary assets are considered.
* **Responsibilities**:
  * Precise font pairing (e.g., `Playfair Display` Italic + `DM Sans` 900 / `Bebas Neue`).
  * Spatial Zone routing (**Zone A: Scalp Contact $y:9.8\%\text{--}18.5\%$, $Z:10$** vs. **Zone B: Chest Lower-Third $y:56.5\%$, $Z:30$**).
  * Strict 9:16 mobile canvas containment ($\le 82\%$ width, zero word cutoffs).
  * Foundational motion physics (`subpixel_blur_mask`, `defocus_rack_focus`, `staggered_rotate_x`).

### Stage 2: Inflection Point Creative Treatment (Thematic Layer)
At identified Points of Inflection, the engine evaluates the optimal treatment archetype from a diverse, non-repeating repertoire:

1. **Pure Typographic & Motion Detonation**:
   * *Example*: Dynamic numeric ticking counters (`$0 \to $50,000`), Letter-by-letter cyber RGB matrix glitch (`TYPO #30`), Staggered 3D character cascades.
2. **Stylistic Overlays & Material Treatments**:
   * *Example*: Delayed highlight card sweeps (`#FFE600` / `#FF1744`), Geometric circle contrast inversion masks, Blue text shimmer waves.
3. **Mini / Micro Entity Assets (Platform, Brand, Tool Entities)**:
   * *Definition*: Lightweight, inline or floating entity icons accompanying specific named entities (e.g., Instagram, Stripe, Apple, Figma, Twitter/X, Cash/Bitcoin).
   * *Placement*: Anchored adjacent to hero keywords on Stage 2 without cluttering the background.
4. **Macro Thematic Scene Assets (Atmospheric World-Building)**:
   * *Definition*: Depth-matted, flood-keyed concrete physical cutouts (e.g., Silicon Valley Founders Trio, architectural landmarks).
   * *Governance*: Max 1–2 per 40-second timeline, strictly contextually salient, zero terminal-slot forcing.

### Stage 3: Cinematic Fusion & Post-VFX
* **Composition**: Spatial depth matting ($Z:10$ behind hair curve vs. $Z:30$ foreground), ambient scanlines, drop shadows, and subtle camera rack focus.

---

## 3. Asset Taxonomy: Mini/Micro Entities vs. Macro Scene Assets

| Dimension | Mini / Micro Entity Assets (`mini_asset`) | Macro Scene Assets (`macro_asset`) |
| :--- | :--- | :--- |
| **Scope & Role** | Specific brand, platform, tool, or metric symbol | Broad thematic subject, character trio, physical artifact |
| **Examples** | Instagram icon, Stripe badge, Apple logo, verified checkmark | Tech Founders Trio, Eiffel Tower, vintage rocket hull |
| **Visual Footprint** | Small, compact ($32\text{px}\text{--}64\text{px}$), inline or pinned | Large ($200\text{px}\text{--}320\text{px}$), mounted behind shoulder ($Z:10$) |
| **Visual Density** | Lightweight accent augmenting Stage 1 typography | Atmospheric depth layer behind speaker subject |
| **Trigger Criteria** | Mention of a concrete platform, company, or app entity | Explicit concrete thematic noun requiring world-building |
| **Frequency Cap** | 2–3 per sequence (where context warrants) | Max 1–2 per 40s sequence (Clean Slate default elsewhere) |

---

## 4. Inflection Point Repertoire Matrix

```json
{
  "inflection_point_treatments": [
    {
      "treatment_id": "kinetic_numeric_ticker",
      "tier": "typographic_motion",
      "best_for": "Financial figures, growth metrics, time commitments",
      "examples": ["$50,000 a month", "70 hours every week", "10X leverage"]
    },
    {
      "treatment_id": "cyber_matrix_glitch",
      "tier": "typographic_motion",
      "best_for": "Tech keywords, failure points, high-contrast viral concepts",
      "examples": ["fake drone", "broken business", "system failure"]
    },
    {
      "treatment_id": "delayed_card_sweep",
      "tier": "stylistic_overlay",
      "best_for": "Rhetorical hooks, emotional realizations",
      "examples": ["NOT FREEDOM", "BUILDING SYSTEMS", "ONE PERSON"]
    },
    {
      "treatment_id": "mini_entity_badge",
      "tier": "micro_asset",
      "best_for": "Company names, tools, social platforms, developer stacks",
      "examples": ["never post on Instagram", "launched on Stripe", "Figma design"]
    },
    {
      "treatment_id": "macro_thematic_cutout",
      "tier": "macro_asset",
      "best_for": "Historical references, industry titans, physical monuments",
      "examples": ["I've seen founders", "built like the Eiffel Tower"]
    }
  ]
}
```

---

## 5. Governance Rule: Sequential Staging & Anti-Patricity

1. **Clean Slate is the Baseline**: 70%+ of timeline chunks remain pure, unencumbered typography with dynamic motion physics.
2. **Sequential Multi-Tier Resolution**: Never jump straight to a full background image. Always test:
   $$\text{Stage 1 (Typography)} \to \text{Stage 2A (Motion/Glitch/Ticker)} \to \text{Stage 2B (Mini Entity)} \to \text{Stage 2C (Macro Cutout)}$$
3. **Zero Asset Repetition**: An asset type (mini or macro) used once cannot be recycled in the same sequence.


