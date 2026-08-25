# Cosmos Pipeline Map — Long-Form / Landscape (as it stands)

> **Scope note.** This is a **read-only analytical artifact**, confined to
> `docs/mini_landscape_runs/`. It is *not* a code modification. It maps the
> **Cosmos** pipeline as it currently stands: which macro treatment domains are
> **settled** in this studio, which are **partially settled**, and which are
> **unsettled / rigs still to build** — plus the **causal linkage** that threads
> every stage together, and the **governance/thinking system** that reviews each
> decision.

---

## 1. Status verdict per macro domain (the ones you listed)

This is the direct answer to *"clue me in on the ones I'm correct on."*

| Macro domain | Status in this studio | Where it lives | Your read |
| :--- | :--- | :--- | :--- |
| **Typography** | **SETTLED — and yes, it is the most considered.** | `landscape_composition_director.ts` TYP-01…06; the `mini_run_studio` kinetic suite (30 treatments, 45 font JSON profiles) is the sibling source; builder injects the font-profile corpus at `SEAM_BEGIN:__LANDSCAPE_FONT_PROFILES__`. | Correct — the "spoiled child." No other domain has this much policy + a corpus-, disk-backed architecture. |
| **Transitions** | **SETTLED** — a real decision + rule layer with a full per-scene render rig. | `TransitionTreatment` + 6-effect classic palette (TRN-01…04) + **7-effect cinematic palette** (TRN-05: `lens_flare_bleed`, `defocus_bokeh`, `match_cut`, `push_in_zoom`, `edge_glow_bloom`, `camera_pass_by`, `light_leak`) — all procedurally rendered at runtime (`fireTransition` in the landscape studio template). | Correct — the cinematic tier upgrades the "thin render layer" into a real effect rig. |
| **Camera movement** | **Partially settled** — present as camera moves in the render manifest, not a culture. | `mapEditMoveToCameraMove` in `landscape-to-unified.ts`; camera-whoosh midpoints in the studio template. | Correct — in the spine, but no movement catalog. |
| **Audio (SFX + soundtrack)** | **Partially settled** — SFX is a real engine; soundtrack programme exists but the GoSound/Libra render bridge is an explicit NEXT STEP. | `landscape_sfx_engine.ts` (SFX-01…06), `landscape_soundtrack_engine.ts` (AUD-1…7; `libra_*` IDs are placeholders until a provider). | Correct — half settled, half stub. |
| **Picture-in-Picture (PiP)** | **Partially settled** — declared in placement + governed by MAT-04, but not a PiP rig. | `CompositionPlacement.placement:"pip_inset"` (Z:30, `explain_workflow`), MAT-04 "chrome not the plate." | You were *not certain* — fair. Declared-but-unbuilt. |
| **Background (treatments / macro rigs)** | **Partial→gap** — a base background layer exists; the macro background *treatments* you named do not. | `BACKGROUND_ASSET_REGISTRY` (8 image + 2 video slots), `scheduleBackgroundScene` + crossfade, `#baseBackgroundLayer` Z:5. | Correct: barely-settled. |
| **Background animations (2.5D)** | **GAP.** | map anim, list anim, charts, gate/weave, exposure flicker, radio wave, CC page turn / edge burn / luma-matte anim — none present. | Correct: a whole missing macro. |
| **Landscape intro (editorial)** | **GAP** — no intro/title/opening module. | Segmenter starts at `hook`; no title sequence, no animated shadow-pattern/luma-matte type, no "fast cinematic intro." | Correct. |
| **Photo treatments (standalone)** | **GAP** | fringe blur, film dust/grain, vignette, slough/zoom, chromatic aberration — none here (sibling "kinetic sandstorm" is typography-domain, not photo-treatment). | Correct. |
| **Lens / macro effects** | **GAP** | lens chromatic aberration + fg/mg/bg treatment — only the depth-plane constants Z5/10/20/30 exist. | Correct. |
| **B-roll** | **GAP** — no select/insert engine; only the media folders (`LANDSCAPE VIDEOS FOR USE`, `SOUND FX`). | No B-roll stage links to the section graph. | Correct. |

Legend: **settled** = real hardened module · **partial** = declared shape or decision layer · **gap** = named domain with nothing persisting.

---
## 2. The whole-map (one glance)

Mermaid graph of the macro treatment domains a Cosmos long-form edit allocates.

```mermaid
flowchart LR
  subgraph CM["Entry / editorial"]
    CP[call_parser.ts<br/>stage 0 · [settled]] --> SC[silence_cutter.ts<br/>stage 1 · [settled]]
    SC --> SS[section_segmenter.ts<br/>stage 2 · [settled]]
    SS --> GM[joseph_edit_grammar.ts<br/>stage 3 · [settled]]
  end

  subgraph DC["Director / decision layer"]
    GM --> CD[landscape_composition_director.ts<br/>stage 4 · [settled]]
    CD -->|typography cue indexes| TY[TYPOGRAPHY<br/>[the developed / spoiled child]]
    CD -->|transitions| TR[TRANSITIONS<br/>6 classic + 7 cinematic · SETTLED]
  end

  subgraph AU["AUDIO + RIGS"]
    GM --> SF[landscape_sfx_engine.ts<br/>stage 5 · [settled]]
    SS --> OA[landscape_soundtrack_engine.ts<br/>stage 6 · [partial]]
    TY --> SF
    TR --> SF
  end

  subgraph OP["OUTPUT"]
    SF --> PL[landscape_treatment_pipeline.ts<br/>stage 7 · [settled]]
    OA --> PL
    PL --> M[build_landscape_presentation.ts<br/>stage 8 · [settled]]
    PL --> W2[landscape-to-unified.ts → bake<br/> [settled render spine]]
    PL --> MT[modal_service<br/> [settled GPU microservice]]
  end
```

---

## 3. The settled causal spine (stages 0 → 8)

Every stage emits a **typed artifact** that is the *cause* of the next. No orphan cues, no silent mocks — every entity carries a `CausalRef`.

| Stage | Module | Artifact (cause) | Consumed by (effect) |
| :---: | :--- | :--- | :--- |
| 0 | `call_parser.ts` | `FormDecision` (long/short) | routes into this studio |
| 1 | `silence_cutter.ts` | `SilenceCutPlan` + cut MP4 | all downstream timestamps are cut-relative |
| 2 | `section_segmenter.ts` | `LandscapeSection[]` (hook→outro) with weights | edit allocation |
| 3 | `joseph_edit_grammar.ts` | `EditMove[]` (10-move catalog, capped) | director + SFX |
| 4 | `landscape_composition_director.ts` | placements (d-plane), transitions, typography indexes | render keys |
| 5 | `landscape_sfx_engine.ts` | lifecycle `SfxCue[]` (each traced) | soundtrack + mix |
| 6 | `landscape_soundtrack_engine.ts` | `SoundtrackProgram` (bed/pad, ducking) | mix |
| 7 | `landscape_treatment_pipeline.ts` | `LandscapeTreatmentManifest` (single auditable JSON) | Stage 8 + bake |
| 8 | `build_landscape_presentation.ts` | playable HTML studio + run JSON | serve / proof |

**The causal chain reads like a proof:**

```
Prompt/probe → FormDecision → keep only speech → 6 role sections → allocated EditMoves
   → placement + transition + type → SFX lifecycle cues → libra bed/pad
   → single LandscapeTreatmentManifest → HTML studio → NVENC / L4 bake
```

Every arrow is a function over `/types.ts` contracts. The `cause.gate` on each
entity references the exact gate that produced it, so the whole chain is
**re-examinable top to bottom**.

---

## 4. Sub-modules per macro domain (detailed)

### 4.1 Typography — *[the most-considered]*

Currently the **deepest** part of Cosmos long-form; it has the richest policy and the only disk-corpus injection seam.

- **Decision layer — `landscape_composition_director.ts`**
  - `selectTypographyMoveIds` caps cue rate at 60% of eligible moves (TYP-02).
  - TYP-01 (one hero region), TYP-03 (thesis-type only in payoff), TYP-04 (text-behind-speaker at Z:10, callouts Z:30 safe-margin), TYP-05 (CTA may repeat but is budgeted), TYP-06 (monospace → typing-family SFX; >=5-word → gear family).
- **Sibling corpus** (`docs/mini_run_studio/`)
  - `kinetic_typography_governance_policy.md` — 12 operational rules.
  - Font JSON profiles (`Yuan Prometheus Screenshots/font JSON`) injected at build time.
  - `anima_studio.html` — 30 treatment presets (apple hero reveal, staggered char cascade, kinetic sandstorm dissolve, subpixel masking, motion math).

**Not implemented here**: a first-class typography *rendering rig* (per-frame motion math, eased tracking, clip-path pulsing). Today type is a selection layer over moves, not a renderer — exactly what makes it the "spoiled child" of the family.

### 4.2 Transitions — [partial]
- `TransitionTreatment` ids: `light_burn / hot_burn / soft_flash / hard_flash / light_sweep / luma_wash / none`.
- TRN-01…04: min-gap 3.0s, budget ≤50% of eligible boundaries, fires only at section boundary or semantic inflections, **overlay-only**.
- Render reality: crossfade only (`transitionFromPreviousScene`). Decisions exist; a matte/metamorphic effect chain does not.

### 4.3 Camera — [partial]
- `mapEditMoveToCameraMove` → `CameraMove[]` with start/end frames, per-move, clamped to last frame.
- Studio template carries a "camera-whoosh midpoint" per chunk.
- A **sub-move library** (slow zoom, push, crane, orbit, subject track) does not exist — movement is synthesized, not catalogued.

### 4.4 Audio — [partial]
- **SFX** — the only fully-settled audio engine: lifecycle-aware, rotation, depth-gain, intentional silence as a real cue.
- **Soundtrack** — programme shape is accurate, but `libra_*` ids are references; the GoSound/Libra render bridge is the README next-step. The macro `SOUND FX/` corpus is linked to the cue-name level only.

### 4.5 PiP — [declared, no renderer]
- `CompositionPlacement.placement:"pip_inset"` on `explain_workflow` moves (Z:30); MAT-04 caps canvas size. No PiP rig exists.

### 4.6 Background treatment / macro background rigs — [gap]
- Base registry only: `BACKGROUND_ASSET_REGISTRY` (8 img + 2 video), `scheduleBackgroundScene` + crossfade, `#baseBackgroundLayer` at Z5.
- Absent: layered/pre-composed backgrounds, 2.5D, list/chart/map anim, gate/weave, exposure flicker, radio wave, page-turn, edge burn, luma-matte anim, fringe/slough/vignette/zoom.

### 4.7 Landscape intro — [gap]
No editorial opening module (title sequence, shadow patterns, luma-matte drive-in, fast/cinematic intro).

### 4.8 Photo treatments — [gap]
Fringe, grain/dust, vignette, chromatic-aberration, photo-zoom — none.

## 5. Causal linkage — how oversight works

The chain is a **single cause→effect spine** with one accountable artifact: `LandscapeTreatmentManifest`.

### 5.1 The causal-ref invariant
Every entity carries `CausalRef { gate, reason, timeSec?, sectionId?, moveId?, chunkIndex? }`. `runGovernanceChecks()` walks the manifest and fails if any cue is **orphaned** — one of your explicitly named failure modes. `allCausal` is the single bool the whole run gates on; the CLI exits non-zero on failure.

### 5.2 The oversight system ("thinking through the causal linkage")
1. **Semantic weight → budget.** `semanticWeight` × role multiplier (hook 1.1, payoff 1.3) → `priority` (BUD-02); move count capped per section (BUD-01). Spend follows meaning, not flair.
2. **Fatigue & anti-patternicity.** `fatigueRisk`/`commercialPressure` on sections; momentum-death at high-fatigue boundaries (BUD-05); silence as pattern-break; CTA throttling. The push-chain and competing-numbers anti-patterns are *replaced*, not celebrated.
3. **Audit invariant layer.** Tests (`test_causal_chain`, `test_joseph_grammar_invariants`, `test_silence_cutter_plan`, `test_longform_capacity`, `test_landscape_to_unified`) re-prove the spine so decisions are **reviewable**, not free baggage.

So the "thinking system through the causal linkage" is: every decision is a weighted, budgeted, anti-fatigue allocation that must survive an audit gate before it stands.

---

## 6. Gap register (what to wire next, grouped)

| Domain | Exists today | What to build |
| :--- | :--- | :--- |
| **Typography** | selection + corpus seam | a rendering rig (kinetic frames, subpixel, treatment variants) |
| **Transitions** | decision + palette + one crossfade | matte/metamorphic effect chain with timing hooks in the manifest |
| **Camera** | synthetic moves + whoosh midpoint | dense move library (slow zoom, push, crane, orbit) with easing trades |
| **PiP** | `pip_inset` enum + MAT-04 | a real PiP renderer wired to a secondary media track |
| **Background** | base registry + crossfade layer | treatment/pre-composition model + 2.5D/photo runners |
| **Intro** | none | title-sequence + landscape-intro editorial stage |
| **B-roll** | raw media folders | B-split selection/insertion into the section graph (tagged index) |
| **Audio** | SFX engine + programme; ID stubs | GoSound/Libra render bridge (README next-step) |
| **Matte speaker** | governance only (MAT-01…04) | wire `assets/` cutouts into placements (README next-step) |

---

## 7. One-line summary

**Typography and SFX are settled; transitions, camera, soundtrack, and the depth skeleton are partially settled (decisions instead of renderers); background, 2.5-D, landscape-intro, PiP-engine, photo-treatments and B-roll are named but unbuilt.** A causal spine (0→8) holds it all together: every entity is a `CausalRef`, and the governance gate (`allCausal`) is the decision-time arbiter that turns "more effects" into a *weighted, reviewed, survivable* allocation — the Joseph thesis that restraint itself is the premium signal.

---

*This is a map, not a code change. Confined to `docs/mini_landscape_runs/`.*