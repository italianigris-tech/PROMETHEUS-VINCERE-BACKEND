## Typography-Intelligence Gate: Do Word-Level Typography Decisions Flow Through the Modal Gateway?

### Summary

**No.** The backend's word-level typography intelligence (`joseph-typography-intelligence.ts`) produces a `JosephTypographyIntelligencePlan` with hero/support word roles, case treatments, font stylebook selections, and a quality audit — but it is **never called** through the Modal gateway. The landscape gateway (`modal_landscape.py` + `landscape_gateway.py`) is a thin HTTP wrapper that runs the landscape pipeline (stages 0–7) and Stage-8 builder; the pipeline has no import path to the backend director.

### Current Landscape Typography Layer

What the landscape studio *does* produce:

| Layer | Module | What It Produces |
| :--- | :--- | :--- |
| **Cue selection** | `landscape_composition_director.ts` → `selectTypographyMoveIds` | Which edit moves get a text cue (TYP-02 rate ≤ 0.6). Returns `string[]` of move IDs. |
| **Text overlays** | `landscape-to-unified.ts` → `MOVE_TO_TEXT` | Hardcoded captions: `"emphasize_keyword"` → `"THE ONE THING"`, `"cta_pressure"` → `"START NOW"`, `"thesis_punctuation"` → `"THIS CHANGES EVERYTHING"`. No lexical analysis, no word-level weighting. |
| **Font profiles** | `build_landscape_presentation.ts` → `loadAllFontProfiles` | Static injection of the authoritative font JSON corpus at the `SEAM_BEGIN:__LANDSCAPE_FONT_PROFILES__` seam. Profiles are pre-existing templates; they are not dynamically matched to the typography content of the run. |
| **Run data** | `build_landscape_presentation.ts` → `deriveRunData` | Does **not** include `typographyCueMoveIds` or any word-level typography data. The canonical JSON artifact (`landscape_run_*.json`) carries sections, transitions, SFX, soundtrack, governance — no typography properties. |

### What's Missing

The backend `joseph-typography-intelligence.ts` (in `backend/src/director/`) provides:

- `buildJosephTypographyIntelligencePlan`: word-level lexical analysis (filler/hero/support roles, semantic-dense hints, energy-curve-based weighting, case treatment, line breaking)
- `JOSEPH_TYPOGRAPHY_STYLEBOOKS`: font-pairing profiles with composition rules, profile affinities, and doctrine affinities
- `JosephTypographyQualityAudit`: per-cue quality checks (readability, contrast, density, case-consistency)

This is used by `backend/src/director/joseph-director.ts` but is **not reachable** from the landscape mini-studio (no import path, no module resolution in the Modal image).

### Gateway Path

```
caller → modal_landscape.py (landscape_gateway) → npx tsx landscape_treatment_pipeline.ts
                                                      → npx tsx build_landscape_presentation.ts
                                                      → serve HTML + run-data JSON
                                                      → NO typography intelligence
```

The gateway is a pass-through to the TS pipeline; it does not insert any intermediate intelligence layer. The builder's `deriveRunData` projection explicitly omits `typographyCueMoveIds`.

### Recommendation

If word-level typography decisions are required in the landscape studio, the bridge path is:

1. **Add** `backend/src/director/joseph-typography-intelligence.ts` as a dependency of the landscape pipeline (it is pure logic — no DOM, no Remotion, no side effects).
2. **Call** `buildJosephTypographyIntelligencePlan` from a new stage (e.g., `landscape_typography_engine.ts`) that maps edit moves → word-level typography cues.
3. **Include** the resulting `TypographyIntelligencePlan` in the manifest and `deriveRunData` projection.
4. **Update** the presentation template's kinetic typography stages (Zone A/B) to consume the word-level data instead of the demo corpus.

This is a **zero-spend** change — no Modal GPU, no Remotion render, no audio generation.