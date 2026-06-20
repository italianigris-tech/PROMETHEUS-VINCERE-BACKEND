# Prometheus Failure Taxonomy

This taxonomy gives the **Judgment Layer** stable failure labels for candidate review, replay, and future learning. The referenced `PROMETHEUS_v8.1_ARCHITECTURE.pdf` is not present in this worktree, so this file reconstructs the 34 v8.1 failure nodes from the local authority and planning evidence: `specs/ARCHITECTURE_AUTHORITY.md`, `prometheus_v8.1_prd.md`, `PROMETHEUS_BUILD.md`, and the existing project docs. When the PDF is restored, this document should be checked against pages 11-12.

## FT-001: Render Bottleneck (Existential)
- **Severity:** Existential
- **Problem:** Software render path can take minutes for a 90s short, making iteration too slow.
- **Mitigation:** Bundle cache plus GPU probe with ANGLE preferred where available.
- **Phase:** 1
- **Owner:** Worker

## FT-002: Asset Pipeline (Systemic)
- **Severity:** Systemic
- **Problem:** `file:///` media is blocked or mismapped in Chromium, causing assets to 404.
- **Mitigation:** Asset Contract with explicit `browserUrl` and `filePath` roles.
- **Phase:** 1
- **Owner:** Worker

## FT-003: Resolution Authority Drift (Systemic)
- **Severity:** Systemic
- **Problem:** Director or render surfaces emit landscape metadata instead of locked 1080x1920 vertical output.
- **Mitigation:** Vertical resolution contract tests and locked v8.1 authority checks.
- **Phase:** 1
- **Owner:** Director

## FT-004: Duration Cap Violation (Systemic)
- **Severity:** Systemic
- **Problem:** Inputs or manifests can exceed the 90-second v8.1 cap.
- **Mitigation:** Clamp at Director/schema seams and verify with deterministic contract tests.
- **Phase:** 1
- **Owner:** Director

## FT-005: Non-Deterministic Render API (Existential)
- **Severity:** Existential
- **Problem:** Forbidden APIs such as `Math.random`, wall-clock time, timers, GSAP, or unseeded browser crypto enter the render path.
- **Mitigation:** Static forbidden-API scan plus seeded helpers only.
- **Phase:** 1
- **Owner:** Worker

## FT-006: Hidden Variation Randomness (Systemic)
- **Severity:** Systemic
- **Problem:** Re-upload or retry variation comes from implicit randomness instead of explicit `upload_instance_id` and `retry_index`.
- **Mitigation:** Variation Key contract with source, prompt, upload instance, retry index, profile, and orientation facts.
- **Phase:** 1
- **Owner:** Director

## FT-007: Candidate Generation Collapse (Systemic)
- **Severity:** Systemic
- **Problem:** The Director emits one hidden final answer instead of 2-6 inspectable Treatment Genomes.
- **Mitigation:** `generateCandidateGenomes` contract and candidate count floor/ceiling.
- **Phase:** 1
- **Owner:** Director

## FT-008: Judgment Layer Opaqueness (Systemic)
- **Severity:** Systemic
- **Problem:** Candidate approval or rejection has no stable score, rationale, or failure tags.
- **Mitigation:** Judgment verdicts with quality score, similarity score, floor result, veto reason, and failure tags.
- **Phase:** 1
- **Owner:** Judgment Layer

## FT-009: Evidence Loss (Systemic)
- **Severity:** Systemic
- **Problem:** Selected and rejected candidates are not preserved, preventing replay, comparison, and learning.
- **Mitigation:** Evidence Preservation artifacts plus append-only evidence log.
- **Phase:** 1
- **Owner:** Ledger

## FT-010: Replay Ledger / Pattern Memory Collapse (Systemic)
- **Severity:** Systemic
- **Problem:** Job-level render evidence is mixed with pattern-level outcome memory.
- **Mitigation:** Keep Replay Ledger job-level and Pattern Memory pattern-level with separate storage.
- **Phase:** 1
- **Owner:** Ledger

## FT-011: Sequence Repetition Fatigue (Editorial)
- **Severity:** Editorial
- **Problem:** Recent effect patterns repeat too often inside the same run.
- **Mitigation:** Sequence Memory cooldown states and anti-repetition checks.
- **Phase:** 1
- **Owner:** Director

## FT-012: Pattern Memory Staleness (Editorial)
- **Severity:** Editorial
- **Problem:** Deprecated or failed patterns remain eligible without outcome pressure.
- **Mitigation:** Pattern Memory outcome ledger records success, rejection, block, and deprecation.
- **Phase:** 1
- **Owner:** Pattern Memory

## FT-013: Boring Under-Editing (Editorial)
- **Severity:** Editorial
- **Problem:** Hook, body, or CTA lacks enough editorial motion and feels inert.
- **Mitigation:** Failure tag plus cut density, camera aggression, and text coverage floors by profile.
- **Phase:** 1
- **Owner:** Judgment Layer

## FT-014: Chaotic Over-Editing (Editorial)
- **Severity:** Editorial
- **Problem:** Motion, cuts, SFX, or text density exceed viewer comprehension.
- **Mitigation:** Failure tag plus profile-specific density ceilings and breathe decisions.
- **Phase:** 1
- **Owner:** Judgment Layer

## FT-015: Cheap Template Motion (Editorial)
- **Severity:** Editorial
- **Problem:** Motion looks generic, repetitive, or mechanically preset-driven.
- **Mitigation:** Pattern outcome pressure, novelty checks, and Quality-Diversity Archive signal.
- **Phase:** 1
- **Owner:** Judgment Layer

## FT-016: Premium Restraint Misread (Editorial)
- **Severity:** Editorial
- **Problem:** Intentional restraint is scored as low effort, or flash is scored as quality.
- **Mitigation:** Doctrine-aware rubric that separates minimal taste from under-editing.
- **Phase:** 1
- **Owner:** Judgment Layer

## FT-017: Climax Overspend (Editorial)
- **Severity:** Editorial
- **Problem:** High-energy effects are spent before the best beat or CTA.
- **Mitigation:** Sequence Objective preserves climax budget across the planning horizon.
- **Phase:** 1
- **Owner:** Top-Level Planner

## FT-018: Weak Concept Reduction (Editorial)
- **Severity:** Editorial
- **Problem:** The selected treatment reduces the source idea to shallow emphasis or obvious text.
- **Mitigation:** Planner Audit records doctrine branch and treatment rationale for review.
- **Phase:** 1
- **Owner:** Top-Level Planner

## FT-019: Asset Treatment Mismatch (Editorial)
- **Severity:** Editorial
- **Problem:** Retrieved or generated assets do not match the chosen editorial treatment.
- **Mitigation:** Separate Retrieval Intent and GOD Escalation Intent in Treatment Genome v1.
- **Phase:** 1
- **Owner:** GOD

## FT-020: Sequence Rhythm Collapse (Editorial)
- **Severity:** Editorial
- **Problem:** Timing works per moment but fails as a sequence.
- **Mitigation:** Sequence Objective scores rhythm, contrast, surprise, and recovery across moments.
- **Phase:** 1
- **Owner:** Top-Level Planner

## FT-021: Readability Sacrifice (Editorial)
- **Severity:** Editorial
- **Problem:** Text is obscured, too low, too dense, or competes with subject matter.
- **Mitigation:** Upper-middle placement heuristic, text safety checks, and readability failure tag.
- **Phase:** 1
- **Owner:** Director

## FT-022: Mid-Word Cut (Systemic)
- **Severity:** Systemic
- **Problem:** Cuts land inside spoken words, damaging comprehension and polish.
- **Mitigation:** Dynamic Boundaries cuts only at phrase boundaries or silence greater than 300ms.
- **Phase:** 1
- **Owner:** Director

## FT-023: Beat Desynchronization (Systemic)
- **Severity:** Systemic
- **Problem:** Cuts, SFX, or CTA beats drift away from beat/onset timing.
- **Mitigation:** Beat/onset snapping with profile-specific stride.
- **Phase:** 1
- **Owner:** Director

## FT-024: CTA Weakness (Editorial)
- **Severity:** Editorial
- **Problem:** Final three seconds fail to land cuts, emphasis, or closure.
- **Mitigation:** CTA window forces beat cuts and final push-in / emphasis treatment.
- **Phase:** 1
- **Owner:** Director

## FT-025: SFX Cue Missing (Systemic)
- **Severity:** Systemic
- **Problem:** Required cue category or variation cannot resolve to a file.
- **Mitigation:** 8 cue categories x 5 placeholder variants and visible missing-file errors.
- **Phase:** 1
- **Owner:** Audio

## FT-026: Audio Pumping (Editorial)
- **Severity:** Editorial
- **Problem:** Full-band ducking pumps music around drum hits or SFX rather than voice presence.
- **Mitigation:** Band-pass sidechain ducking focused on 300Hz-3000Hz.
- **Phase:** 1
- **Owner:** Audio

## FT-027: Loudness Drift (Systemic)
- **Severity:** Systemic
- **Problem:** Voice, music, and SFX output miss target loudness or clip.
- **Mitigation:** Loudness normalization and explicit gain envelope tests.
- **Phase:** 1
- **Owner:** Audio

## FT-028: Font Runtime Failure (Systemic)
- **Severity:** Systemic
- **Problem:** Font loading or glyph rendering fails in Chromium/Remotion.
- **Mitigation:** DOM Canvas font fallback as primary, with deterministic texture hydration.
- **Phase:** 1
- **Owner:** Worker

## FT-029: Physics Runtime Instability (Systemic)
- **Severity:** Systemic
- **Problem:** Per-frame physics or allocations make render slow or nondeterministic.
- **Mitigation:** CPU-only precomputed matrices, typed arrays, and performance contract.
- **Phase:** 1
- **Owner:** Worker

## FT-030: Render Entry Contract Drift (Systemic)
- **Severity:** Systemic
- **Problem:** Joseph render entry pulls unrelated app code or ungoverned runtime state.
- **Mitigation:** Joseph-specific bundle and entry point with schema-checked props.
- **Phase:** 1
- **Owner:** Worker

## FT-031: Chrome Hang (Systemic)
- **Severity:** Systemic
- **Problem:** Chromium render process hangs without a visible failure.
- **Mitigation:** Five-minute timeout and process cleanup in worker.
- **Phase:** 1
- **Owner:** Worker

## FT-032: Prompt Authority Escape (Systemic)
- **Severity:** Systemic
- **Problem:** Prompt text silently changes stack, determinism, duration cap, queue architecture, schema authority, or render-path forbidden APIs.
- **Mitigation:** Prompt Governance module with hard-false infrastructure flags and explicit block reasons.
- **Phase:** 1
- **Owner:** Director

## FT-033: Multi-Orientation Authority Drift (Systemic)
- **Severity:** Systemic
- **Problem:** Agents treat landscape as v8.1 authority without human approval.
- **Mitigation:** T29 human-gate proposal; vertical remains locked until authority changes.
- **Phase:** 1
- **Owner:** Human

## FT-034: Silent Fallback Success (Systemic)
- **Severity:** Systemic
- **Problem:** A degraded stage returns success without exposing the fallback or failure.
- **Mitigation:** Visible failure records, Cognitive Governor failure policy, and Review Surface capture.
- **Phase:** 1
- **Owner:** Cognitive Governor

## Review Surface

Each failure tag should map to at least one measurable acceptance criterion so review data can become evaluator truth labels.

| Failure | Measurable acceptance criteria |
|---|---|
| FT-001 | Second render reuses bundle cache; quick proof completes under the sprint target once render blockers clear. |
| FT-002 | Every media asset has a browser URL and filesystem path where needed; no Chromium asset 404s in smoke render. |
| FT-003 | Manifest and output metadata are exactly 1080x1920 for v8.1 jobs. |
| FT-004 | Inputs over 90s produce manifests capped at 90,000ms / matching frame count. |
| FT-005 | Forbidden render-path API scan returns zero matches. |
| FT-006 | Same upload instance and retry index produce same variation key; different retry index changes it. |
| FT-007 | Candidate generation emits 2-6 deterministic candidates. |
| FT-008 | Every Judgment verdict includes scores, floor pass/fail, failure tags, and rationale/veto reason when blocked. |
| FT-009 | Evidence package writes candidates, selected, verdict, audit, and one JSONL log line. |
| FT-010 | Replay Ledger paths/state are distinct from Pattern Memory paths/state. |
| FT-011 | Same effect pattern is blocked inside the configured cooldown window. |
| FT-012 | Deprecated patterns are not selected as fresh successes. |
| FT-013 | Review Surface can tag boring-under-editing and compare against density floors. |
| FT-014 | Review Surface can tag chaotic-over-editing and compare against density ceilings. |
| FT-015 | Review Surface can tag cheap-template-motion and link to pattern history. |
| FT-016 | Minimal doctrine candidates are judged against minimal profile expectations, not aggressive profile expectations. |
| FT-017 | Climax budget is preserved until high-stakes beat or CTA. |
| FT-018 | Planner Audit explains doctrine branch and concept rationale. |
| FT-019 | Asset decision records retrieval intent and GOD escalation intent separately. |
| FT-020 | Sequence verdict can fail a locally-good candidate path for rhythm collapse. |
| FT-021 | Text remains in safe readable region and does not occlude critical subject matter. |
| FT-022 | No cut point falls strictly between any word start and end. |
| FT-023 | Cut points are beats/onsets or phrase boundaries within the configured tolerance. |
| FT-024 | Last 3000ms includes forced beat cuts where beats exist. |
| FT-025 | SFX catalog contains 40 files matching 8 cue categories x 5 variants. |
| FT-026 | Voice-band ducking does not pump on drum-only hits. |
| FT-027 | Output meets target LUFS without clipping. |
| FT-028 | Missing custom font still renders deterministic text texture. |
| FT-029 | Physics preprocessing meets the 300 words x 2700 frames performance target. |
| FT-030 | Joseph entry uses Joseph-specific bundle and props only. |
| FT-031 | Hung Chrome render is killed and reported visibly. |
| FT-032 | Infrastructure override prompt is rejected with explicit block reason. |
| FT-033 | No source code treats landscape as v8.1 authority before T29 human approval. |
| FT-034 | Any fallback creates a visible failure/degradation record. |