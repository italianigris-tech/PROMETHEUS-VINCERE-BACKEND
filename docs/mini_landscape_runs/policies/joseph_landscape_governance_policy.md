# Joseph Landscape Governance Policy (Long-Form 16:9)

**Version**: 1.0.0  
**Location**: `docs/mini_landscape_runs/policies/joseph_landscape_governance_policy.md`  
**Derived from**: Joseph five-audit packets + five-audit synthesis (read-only sources listed in README)  
**Canvas**: 16:9 landscape (default realization 1920×1080; accept 1280×720 sources)

---

## 1. Core Thesis (non-negotiable)

> Joseph's editing style is an **allocation system**. Motion, sound, typography, B-roll, graph/list primitives, camera movement, silence, and restraint are allocated according to semantic weight, viewer fatigue, proof needs, section role, commercial pressure, and premium perception.

Therefore this studio optimizes **budgeted editorial moves**, not effect count.

---

## 2. Aspect & Geometry

| Constant | Value | Notes |
| :--- | :--- | :--- |
| `CANVAS_ASPECT` | `16:9` | Long-form primary |
| `DEFAULT_WIDTH` | `1920` | Upscale only when source ≥ 720p |
| `DEFAULT_HEIGHT` | `1080` | |
| `SAFE_MARGIN_X` | `6%` | Left/right readable margin |
| `SAFE_MARGIN_Y` | `8%` | Top/bottom |
| `SPEAKER_RETURN_MIN_SEC` | `1.6` | Min talking-head dwell after asset (audit 04) |
| `TRANSITION_MIN_GAP_SEC` | `3.0` | Anti-patternicity for flash/impact |

### 2.1 Depth planes (landscape)

```
Z:5   — Source video / B-roll plate
Z:10  — Support assets & text-behind-speaker cores
Z:20  — Matted principal speaker (when present)
Z:30  — Foreground callouts, companion type, PiP chrome
```

---

## 3. Section Arc Roles

| Role | Typical job | Treatment budget |
| :--- | :--- | :--- |
| `hook` | Momentum, promise, self-ID | High camera + one proof asset |
| `setup` | Context, authority | Moderate type, light SFX |
| `explain` | Concept clarity | Callouts, lists, restrained SFX |
| `demonstrate` | Show workflow / screen | PiP, annotations, pedagogy phases |
| `payoff` | Synthesis / value | One climax SFX family, number anchors |
| `outro` | CTA / summary | CTA pressure may repeat; end cuts may be silent |

---

## 4. Edit-Move Catalog

| Move ID | Viewer problem solved | Primary primitives | SFX default |
| :--- | :--- | :--- | :--- |
| `emphasize_keyword` | Salience of one phrase | Kinetic type / lower-third | click or gear (budgeted) |
| `return_to_authority` | Re-anchor to host | Speaker crop/zoom | whoosh or **no-SFX** |
| `explain_workflow` | Tutorial clarity | Callout lines, screen PiP | shutter / UI click |
| `value_contrast` | Price/metric comprehension | Number counter (direction-aware) | count-up lock + mild impact |
| `cta_pressure` | Action | CTA text (may repeat) | UI/bell variant |
| `fatigue_relief` | Pattern break | Silence, plain cut, spoken-only list | **intentional no-SFX** |
| `focus_handoff` | Attention transfer | Spotlight object, vignette panel | spotlight-entry sync |
| `proof_insert` | Trust / evidence | PiP / matte asset | asset entry SFX |
| `thesis_punctuation` | Mark rare importance | Full-sentence type + silence bed | reverberant snap **after** silence |
| `momentum_death` | Anti-patternicity | Hard stop of push chain | none |

---

## 5. SFX Lifecycle & Budget (mirrored from mini_run_studio, landscape-adapted)

| Rule ID | Rule | Enforced by |
| :--- | :--- | :--- |
| SFX-01 | Every SFX cue must trace to an `EditMove` or a `TransitionTreatment` via `CausalRef`. Orphan cues are forbidden. | `landscape_sfx_engine.ts` |
| SFX-02 | Cues are lifecycle-aware: `asset_entry`, `asset_exit`, `transition`, `number_lock`, `cta_hit`, `speaker_return`, `section_boundary`. A cue without a lifecycle gate is invalid. | types + sfx engine |
| SFX-03 | `fatigue_relief`, `momentum_death`, and quiet `return_to_authority` moves MUST emit an intentional no-SFX cue (`family: "none"`, `intentionalOmission: true`) rather than inventing sound. | sfx engine |
| SFX-04 | No two cues of the same family may fire within 0.9s (deterministic family rotation to a nephew family). | sfx engine |
| SFX-05 | SFX gain is depth-governed: Z:10 ≤ −14 dB, Z:20 ≤ −10 dB, Z:30 ≤ −7 dB relative to the dialogue bus. | sfx engine |
| SFX-06 | A family used more than its repetition window (2–3) must rotate to a nephew variant/family (semblance rotation, mirror of mini-run schema). | sfx engine |

## 6. Silence & Dead-Air Rules (long-form specific)

| Rule ID | Rule | Default |
| :--- | :--- | :--- |
| SIL-01 | Silences ≥ `minSilenceSec` are cut candidates. | 0.6s |
| SIL-02 | Pauses shorter than `minSilenceSec` are **kept** as protected pacing (natural speech rhythm is not dead air). | — |
| SIL-03 | `paddingSec` of speech is preserved on each side of a cut to avoid hard chops at word boundaries. | 0.15s |
| SIL-04 | If the gap between two consecutive keep segments is < `minKeepPauseSec`, merge them (fold the sliver into the cut). | 0.4s |
| SIL-05 | The cutter runs BEFORE any treatment; every downstream timestamp is relative to the **cut** timeline, and each `KeepSegment` records its source→destination mapping. | — |
| SIL-06 | Thesis silence (audit 03) and silent end cuts (audit 05) are NOT dead air — they are governed by `thesis_punctuation` / `fatigue_relief`, never removed. | — |
| SIL-07 | Detection granularity (0.25s) is finer than the cut threshold so protected pauses are classified, not lost. | 0.25s |

## 7. Typography & Kinetic Type (landscape grammar)

| Rule ID | Rule |
| :--- | :--- |
| TYP-01 | One hero type layer per composition region at a time — no multi-hero (mirror mini-run invariant). |
| TYP-02 | Typography cue rate ≤ 60% of eligible edit moves (mirror `selectTypographyCueIndexes` target). |
| TYP-03 | Full-sentence thesis type (`thesis_punctuation`) is reserved for the payoff — rare by design. |
| TYP-04 | Text-behind-speaker cores sit at Z:10; foreground callouts at Z:30 with safe-margin clearance (6% x / 8% y). |
| TYP-05 | CTA text may repeat (audit 04) but must be budgeted, never continuous. |
| TYP-06 | Monospace/terminal type triggers typing-family SFX; ≥5-word blocks trigger gear-family (mirror mini-run word-length rule). |

## 8. Transition Rules

| Rule ID | Rule | Value |
| :--- | :--- | :--- |
| TRN-01 | Minimum gap between impact/flash transitions (anti-patternicity). | 3.0s |
| TRN-02 | Transitions fire at section boundaries or semantic inflections only — never mid-word. | — |
| TRN-03 | Effect palette: `light_burn` / `hot_burn` / `soft_flash` / `hard_flash` / `light_sweep` / `luma_wash`. All are overlay-only; the source video is never re-processed for a transition. | — |
| TRN-04 | Transition budget ≤ 50% of eligible section boundaries. | — |

## 9. Soundtrack & Audio Treatment (GoSound / Libra bridge)

| Rule ID | Rule | Value |
| :--- | :--- | :--- |
| AUD-01 | Integrated loudness target (speech-first). | −14 LUFS |
| AUD-02 | True peak ceiling. | −1.5 dBTP |
| AUD-03 | Bed fades in over the first 2s and out over the last 2s of the **cut** video. | 2.0s |
| AUD-04 | Voice ducking enabled whenever a bed is present. | −6 dB, 0.04s attack, 0.25s release |
| AUD-05 | Soundtrack programme length = cut duration + tail; never cut short, never left hanging. | tail 0.5s |
| AUD-06 | Payoff/emotional sections may receive an `emotional_insert` pad selected by mood fingerprint (elevation/momentum/warmth), never hard-wedged to one track (seed rotation across candidate catalog). | — |
| AUD-07 | Asset IDs resolve through the GoSound/Libra provider bridge (`libra_*`), mirroring mini-run `inst_loop_*` resolution in `soundtrack_governance_engine.ts`. | — |

---

## 10. Matte & Principal-Speaker Rules

| Rule ID | Rule |
| :--- | :--- |
| MAT-01 | If a matted principal speaker is present (mini-run `assets/` pattern), supportive assets render **behind** them at Z:10 — never over the face. |
| MAT-02 | After any asset dwell, the speaker must return for ≥ `speakerReturnMinSec` (1.6s) before the next asset (audit 04 re-anchor rule). |
| MAT-03 | The host is a layer, not wallpaper: `return_to_authority` re-centers attention on the speaker. |
| MAT-04 | PiP insets (`demonstrate`) are chrome, not the plate — never larger than 60% of the canvas. |

## 11. Budget Allocation (semantic weight → spend)

| Rule ID | Rule |
| :--- | :--- |
| BUD-01 | Move count per section capped at `max(1, min(4, floor(durationSec / 8)))`. |
| BUD-02 | `priority` derives from section `semanticWeight` × role multiplier; payoff and hook receive the highest spend. |
| BUD-03 | `allowMacroAsset` only for `proof_insert`, `value_contrast`, `explain_workflow`, `focus_handoff`. |
| BUD-04 | Every section receives ≥ 1 edit move and ≥ 1 SFX decision (even if the decision is intentional omission). No orphan sections. |
| BUD-05 | Momentum-death stops are inserted at high-fatigue boundaries only — they are the reset, not a default. |

## 12. Anti-Patterns & Momentum Death (audit 05)

| Anti-pattern | Replaced by |
| :--- | :--- |
| Push chain: every cut louder / faster | `momentum_death` hard stop, then governed silence |
| Competing numbers on screen simultaneously | One anchor number at a time (direction-aware counter) |
| Graphs as decoration | `proof_insert` only where a claim needs proof |
| Continuous CTA | Budgeted `cta_pressure` with quiet gaps |
| Restraint = boring | Restraint is the premium signal — end cuts may be silent (audit 05) |

## 13. Verification Invariants (tests enforce)

| Check | Test |
| :--- | :--- |
| Every manifest entity has a resolvable `CausalRef` (gate + referenced section/move/time exist). | `test_causal_chain.ts` |
| Transition min-gap 3.0s never violated. | `test_joseph_grammar_invariants.ts` |
| SFX family rotation & no-SFX exceptions hold. | `test_joseph_grammar_invariants.ts` |
| Keep segments are contiguous, ordered, and cover all speech. | `test_silence_cutter_plan.ts` |
| Silence cut removes dead air only — `protected_pause` is never removed. | `test_silence_cutter_plan.ts` |
| Sections tile the cut timeline with no gaps and no overlaps. | `test_causal_chain.ts` |


