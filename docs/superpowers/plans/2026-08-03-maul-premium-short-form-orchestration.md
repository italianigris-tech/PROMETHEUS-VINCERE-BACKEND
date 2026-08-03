# MAUL Premium 9:16 Short-Form Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a 30-60 minute source into ranked, editable, premium 9:16 shorts with governed silence removal, configurable visual treatments, real text choreography, Joseph-informed SFX restraint, soundtrack selection, mastered audio, review evidence, and a versioned public API.

**Architecture:** Consolidate legacy ranking, synchronous MAUL planning, and durable MAUL operations into one artifact-driven backend workflow. AI may propose semantic intent; deterministic planners own timestamps, layout, asset choice, compilation, and render authority. Every plan is versioned and content-addressed, every user override is preserved, and only rendered evidence can authorize release.

**Tech Stack:** TypeScript, Zod, Fastify, Vitest, Remotion/React, FFmpeg, existing MAUL artifacts/control plane, existing sound engine, offline Essentia/librosa analysis, object storage, Playwright, image/audio inspection.

---

## 1. Program Decision

Build one authoritative backend pipeline:

```text
Long source
  -> Source Analysis
  -> Diverse Candidate Set
  -> Selected Clip
  -> Editorial Timeline + Protected Pauses
  -> Treatment Genome
  -> Text Chunk + Placement + Animation
  -> Visual/B-roll + Footage Choreography
  -> Audio Treatment
  -> Manifest Compiler
  -> Preview + Quality Evidence
  -> Final Render + Release
```

Do not port `remotion-app/src/lib/motion-platform/sound-design-brain.ts` into production ownership. Use it and Joseph annotations as behavioral references, then build a backend Audio Treatment Planner that emits governed artifacts consumed by the existing FFmpeg sound engine.

Alternatives rejected:

| Option | Benefit | Failure |
| --- | --- | --- |
| Keep three pipelines | Small local changes | Ranking, planning, render, and retries remain disconnected |
| Make Remotion sound brain authoritative | Fast demo | Frontend owns business logic; no durable lineage, rights gate, or stable API |
| Generate every soundtrack/SFX with an AI audio service | Novel output | Rights, latency, reproducibility, cost, and edit control are unacceptable for core workflow |
| Unified MAUL backend | One contract from source through release | Requires staged consolidation; selected approach |

Single soundtrack is default. Multiple tracks are allowed only at a narrative phase boundary and only after compatibility and audible-quality gates pass. Platform, channel, and prompt metadata are tie-breakers; footage, speech, narrative arc, duration, and treatment drive selection.

## 2. Current Truth

| Area | Exists | Missing or misleading |
| --- | --- | --- |
| Long-to-short | Legacy ranked JSON clips | No rendered-short handoff; acoustic/visual scores include proxies |
| MAUL planning | Real timeline, Protected Pauses, chunking, placement, manifest, Remotion render | Caller manually invokes stages; candidate generator emits at most one shallow candidate |
| Durable control plane | Idempotency, leases, retries, completion | No worker leases and executes MAUL workflow |
| Placement | Three deterministic families and hard gates | Real shot/subject/OCR/saliency observations are not connected |
| Text rendering | Exact geometry and active-word color | No planned entry/exit choreography; manifest claims a spring it does not render |
| Camera | Crop/composition execution | Motion restarts at sequence boundaries |
| Audio planning | Music/SFX/ducking/transition intent exists | MAUL drops most of it; Remotion loops one track at static gain and plays fixed two-second SFX |
| Audio rendering | FFmpeg engine supports trims, crossfades, ducking, loudness, stems | Generated MAUL audio plan is not render authority |
| Analysis | TypeScript fallbacks and fabricated/default feature values | Essentia/librosa are not measurably used; Camelot compatibility is absent |
| SFX assets | 227 files under `SOUND FX`; 215 audio files | Canonical local manifest has 43 entries; no backend-wide catalog, full rights, or analysis provenance |
| Quality | Pre-render human rubric and Quality Truth contracts | No encoded pixel/audio proof, post-render Aesthetic Soundness gate, or release successor |
| Security/persistence | Authenticated `/api/maul/v1` control routes | Unprotected synchronous routes coexist; JSON writes and multi-artifact planning are non-transactional |

Treat `CURRENT_AUDIO_DJ_STATE_LOCK.md` as historical evidence, not current authority.

## 3. Non-Negotiable Product Rules

1. SFX omission is a first-class planned decision with a reason.
2. Short text may receive a click/impact; long or continuously moving text receives a continuous texture or silence, not repeated clicks.
3. SFX lifecycle roles are `entry`, `exit`, `motion_follow`, `transition_bridge`, `semantic_substitute`, and `release`.
4. Timing relation is explicit: `before_visual`, `on_visual`, `after_visual`, `before_keyword`, or `on_keyword`.
5. Same-function cues vary within a short and across a batch. Material, direction, intensity, and tail must match the visual.
6. Music changes follow a narrative phase change, never elapsed time alone.
7. Dialogue intelligibility outranks music and SFX excitement.
8. Text correctness and visible text motion ship before footage effects, depth, 3D, or evidence retrieval.
9. Missing evidence is `unknown`, never a fabricated score or silent fallback.
10. Renderer executes plans. It must not invent placement, animation, SFX choice, gain, or timing.
11. User locks survive replanning. Upstream changes invalidate only unlocked descendants.
12. Rights failures block final release, not merely produce warnings.

## 4. Authoritative Artifacts And Invalidation

Create contracts in `packages/shared-types/src/short-orchestration.ts` and export them from `packages/shared-types/src/index.ts`:

```ts
type ShortArtifactKind =
  | "source_analysis"
  | "candidate_set"
  | "candidate_selection"
  | "editorial_timeline"
  | "narrative_timeline"
  | "scene_observations"
  | "treatment_genome"
  | "text_chunk_plan"
  | "text_placement_plan"
  | "text_animation_plan"
  | "visual_treatment_plan"
  | "audio_treatment_plan"
  | "short_render_manifest"
  | "rendered_quality_evidence"
  | "release_decision";

type PlanAuthority = "user_locked" | "deterministic" | "model_proposed";

type ArtifactRef = {
  artifactId: string;
  artifactKind: ShortArtifactKind;
  schemaVersion: string;
  payloadHash: string;
  parentHashes: string[];
  plannerVersion: string;
  authority: PlanAuthority;
  createdAt: string;
};
```

Required dependency graph:

```text
source_analysis -> candidate_set -> candidate_selection -> editorial_timeline
editorial_timeline + source_analysis.transcript -> text_chunk_plan
source_analysis + editorial_timeline -> scene_observations
treatment_genome + text_chunk_plan + scene_observations -> text_placement_plan
text_placement_plan + text_chunk_plan + treatment_genome -> text_animation_plan
narrative_timeline + scene_observations + treatment_genome -> visual_treatment_plan
all timed visual/text events + dialogue + catalogs -> audio_treatment_plan
all selected plans -> short_render_manifest -> rendered_quality_evidence -> release_decision
```

Invalidation rules:

- Candidate change invalidates every descendant.
- Silence/cut change invalidates all output-time plans but retains source analysis.
- Text style change invalidates placement, animation, manifest, and evidence.
- SFX override invalidates audio, manifest, and evidence only.
- Revoked asset rights immediately invalidate release decisions referencing that asset.
- Planner/model version changes never mutate an old artifact; they create successors.
- Locked user decisions are copied forward or reported as incompatible. They are never silently dropped.

## 5. Frontend-Ready Configuration

Add `shortRunConfigSchema` in `packages/shared-types/src/short-orchestration.ts`. Public configuration must separate useful controls from internal implementation:

```ts
type ShortRunConfig = {
  schemaVersion: "1";
  output: {
    aspectRatio: "9:16";
    minDurationSec: number;
    maxDurationSec: number;
    candidateCount: number;
    outputCount: number;
    platform?: "youtube_shorts" | "instagram_reels" | "tiktok";
  };
  selection: {
    mode: "automatic" | "review";
    objective: "retention" | "authority" | "conversion" | "education";
    diversity: "focused" | "balanced" | "wide";
  };
  silence: {
    profile: "natural" | "tight" | "aggressive";
    preserveRhetoricalPauses: boolean;
    maxCompressionRatio: number;
  };
  treatment: {
    profileId:
      | "clean_authority"
      | "kinetic_punch"
      | "conversational_creator"
      | "proof_explainer"
      | "cinematic_depth"
      | "story_arc";
    intensity: "restrained" | "balanced" | "expressive";
    allowDegradedTreatment: boolean;
  };
  text: {
    placementMode: "auto" | "lower_band" | "editorial" | "subject_aware";
    animationMode: "auto" | "fade_rise" | "keyword_pop" | "continuous_push";
  };
  visuals: {
    broll: "off" | "suggest" | "automatic";
    evidence: "off" | "suggest" | "automatic";
    depth: "off" | "subject_matte" | "cinematic";
  };
  audio: {
    music: "off" | "automatic" | "user_selected";
    sfx: "off" | "restrained" | "balanced" | "expressive";
    soundtrackPolicy: "single" | "allow_narrative_switch";
  };
};
```

Expose capability flags and incompatibility reasons so frontend can disable impossible combinations. Store granular overrides by stable event/artifact ID, not array index.

## 6. Treatment Genomes

Each Treatment Genome sets ranges and budgets, not exact creative decisions.

| Profile | Placement | Text motion | Visual policy | Audio policy |
| --- | --- | --- | --- | --- |
| `clean_authority` | Stable lower/center safe zones | Fade-rise, rare keyword emphasis | Speaker-first, low cut density | One bed, sparse semantic SFX |
| `kinetic_punch` | Editorial movement with hard safety | Keyword pop, block push, quick exits | Tight cuts, motion bridges | Beat-aware bed, impacts/whooshes with fatigue cap |
| `conversational_creator` | Subject-aware side/lower variants | Natural phrase motion | Speaker continuity, reaction/PiP support | Light bed, tactile accents |
| `proof_explainer` | Text reflows around evidence | Labels, counters, callouts | B-roll, article card, screen/PiP | UI accents, transitions, dialogue priority |
| `cinematic_depth` | Foreground/background aware | Slow dimensional entry | Matte, parallax, controlled camera | Textures, risers, low impacts |
| `story_arc` | Phase-dependent | Restrained setup -> stronger payoff | Treatment may change at narrative boundary | Single bed by default; soundtrack switch eligible |

Compatibility validator rejects profiles when required evidence/assets are absent. It may downgrade only when API config permits `allowDegradedTreatment: true`; downgrade is recorded in the artifact and response.

## 7. 24-Hour Rush Tracer

Goal: one approved source clip produces one real 1080x1920 MP4 with truthful text motion, one licensed soundtrack, 1-3 Joseph-governed SFX, intentional omissions, mastered dialogue, and encoded evidence.

Explicit tracer limits:

- Input is one already-approved candidate, not a 60-minute ranking run.
- Use three text treatments: `fade_rise`, `keyword_pop`, `continuous_push`.
- Curate 30 high-value SFX from the local library; do not block on all 215.
- Use one pre-approved, licensed soundtrack; no DJ transition.
- B-roll, evidence retrieval, 3D, and footage choreography remain disabled.
- Render Contract Tests must prove visible motion and audible timing. Manifest labels must describe only implemented behavior.

Parallel schedule:

| Hours | Lane A | Lane B | Lane C | Gate |
| --- | --- | --- | --- | --- |
| 0-3 | V3 text/audio contracts | Curate 30 SFX + rights | Compiler/mix red-test fixtures | Schemas and red tests |
| 3-9 | Render three text treatments | Joseph cue/omission planner | Audio compiler + dialogue/music/SFX mix | Focused tests pass |
| 9-15 | Fix continuous camera time | Compile audio into MAUL manifest | Preview/final mux | One local render |
| 15-21 | Pixel/audio evidence | Aesthetic Soundness checklist | Failure/retry/idempotency | Release gate passes |
| 21-24 | Defect fixes | Documentation | Re-run proof | Tracer MP4 + artifacts |

### Task 1: Freeze V3 Render Claims And Treatment Contracts

**Files:**
- Create: `packages/shared-types/src/maul-text-animation.ts`
- Create: `packages/shared-types/src/maul-text-animation.test.ts`
- Create: `packages/shared-types/src/maul-audio-treatment.ts`
- Create: `packages/shared-types/src/maul-audio-treatment.test.ts`
- Modify: `packages/shared-types/src/maul.ts`
- Modify: `packages/shared-types/src/index.ts`
- Modify: `backend/src/maul/planning.ts`
- Modify: `backend/src/maul/planning.test.ts`
- Modify: `remotion-app/src/compositions/MaulShort.tsx`
- Modify: `remotion-app/src/compositions/MaulPlannedTextLayer.tsx`
- Modify: `remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx`

- [ ] Write schema tests for stable segment/token references, non-overlapping entry/hold/exit intervals, bounded transforms, explicit easing, and three supported treatments.
- [ ] Define Audio Treatment Plan contract for selected/rejected music and SFX events, omissions, ducking, mastering, catalog refs/hashes, user locks, planner provenance, and parent hashes.
- [ ] Add `MaulTextAnimationPlan` as a governed artifact referenced by Typography Motion and Planning Bundle. Increment bundle/manifest version; preserve explicit V1/V2 readers.
- [ ] Remove native spring/continuous-camera declarations that are not executed.
- [ ] Render `fade_rise`, `keyword_pop`, and `continuous_push` using global output frame time.
- [ ] Compute camera motion from manifest-global frame and source mapping so caption/layout sequences do not restart it.
- [ ] Add frame-sampling assertions: pre-entry opacity/position differs from hold frame; keyword scale peaks then settles; continuous push remains monotonic across a sequence boundary.
- [ ] Run:

```bash
npm --prefix packages/shared-types test -- src/maul-text-animation.test.ts src/maul-audio-treatment.test.ts src/maul.test.ts
npm --prefix backend test -- src/maul/planning.test.ts
npm --prefix remotion-app test -- src/compositions/__tests__/MaulPlannedTextLayer.test.tsx src/compositions/__tests__/MaulShort.test.ts
```

Expected: all pass; no manifest execution name claims behavior absent from renderer.

- [ ] Commit:

```bash
git add packages/shared-types/src/maul-text-animation.ts packages/shared-types/src/maul-text-animation.test.ts packages/shared-types/src/maul-audio-treatment.ts packages/shared-types/src/maul-audio-treatment.test.ts packages/shared-types/src/maul.ts packages/shared-types/src/index.ts backend/src/maul/planning.ts backend/src/maul/planning.test.ts remotion-app/src/compositions/MaulShort.tsx remotion-app/src/compositions/MaulPlannedTextLayer.tsx remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx
git commit -m "feat(maul): execute governed text animation"
```

### Task 2: Curate Joseph SFX Tracer Catalog

**Files:**
- Create: `backend/src/audio/catalog/sfx-catalog.schema.ts`
- Create: `backend/src/audio/catalog/sfx-catalog.ts`
- Create: `backend/src/audio/catalog/sfx-catalog.test.ts`
- Create: `backend/src/audio/catalog/joseph-tracer-sfx.json`
- Create: `backend/src/audio/catalog/scan-sfx-catalog.ts`
- Modify: `backend/package.json`
- Read source: `SOUND FX/**`
- Reconcile: `remotion-app/src/data/sound-fx.local.json`

- [ ] Define catalog fields: stable ID, SHA-256, relative object key, duration, format, loudness, peak, onset/tail, lifecycle roles, material, direction, intensity, semantic tags, commercial rights state, source/license evidence, and analysis provenance.
- [ ] Write failures for duplicate hash/ID, missing file, invalid duration, unknown rights, and lifecycle/tag mismatch.
- [ ] Select 30 assets covering clicks, UI accents, whooshes by direction, impacts by material/weight, risers, releases, and continuous textures. Include at least three variations for common functions.
- [ ] Mark each asset `release_allowed` only with evidence. Unknown rights remain preview-only and cannot satisfy tracer release.
- [ ] Generate deterministic manifest order and verify every entry resolves to one file and its stored hash.
- [ ] Add `audio:sfx:catalog` script to `backend/package.json` so scanning uses backend-pinned dependencies.
- [ ] Run:

```bash
npm --prefix backend test -- src/audio/catalog/sfx-catalog.test.ts
npm --prefix backend run audio:sfx:catalog -- --verify src/audio/catalog/joseph-tracer-sfx.json
```

Expected: 30 valid unique audio assets; zero missing paths; zero release assets with unknown rights.

- [ ] Commit:

```bash
git add backend/src/audio/catalog backend/package.json
git commit -m "feat(audio): add governed Joseph SFX tracer catalog"
```

### Task 3: Plan SFX Intent, Restraint, And Asset Choice

**Files:**
- Create: `backend/src/audio/planner/joseph-sfx-intent.ts`
- Create: `backend/src/audio/planner/joseph-sfx-intent.test.ts`
- Create: `backend/src/audio/planner/sfx-asset-ranker.ts`
- Create: `backend/src/audio/planner/sfx-asset-ranker.test.ts`
- Create: `backend/src/audio/planner/audio-treatment-planner.ts`
- Create: `backend/src/audio/planner/audio-treatment-planner.test.ts`
- Modify: `backend/src/maul/service.ts`
- Reference: `docs/audits/joseph-masterclass-feature-extraction-01.md`
- Reference: `docs/joseph-five-audit-feature-synthesis.md`

- [ ] Convert transcript keywords, text-animation events, visual transitions, camera cues, and narrative beats into scored SFX intent candidates.
- [ ] Persist lifecycle role, timing relation, semantic weight, material/direction request, source event ID, and reason.
- [ ] Add omission decisions: `fatigue_relief`, `rhetorical_space`, `low_semantic_weight`, `pattern_break`, `dialogue_clarity`, and `no_suitable_asset`.
- [ ] Hard-cap tracer selection at 1-3 cues; enforce minimum gaps; prohibit one click per text chunk; reserve silence before/after a payoff when the treatment requests it.
- [ ] Rank catalog assets by lifecycle, duration, material, direction, intensity, tail, semantic tags, variation history, and rights.
- [ ] Use deterministic seeded choice only among near-equal candidates. Record score components and rejected alternatives.
- [ ] Wire planner output into MAUL Planning Bundle as `audio_treatment_plan`; caller-supplied events become explicit user locks, not separate authority.
- [ ] Test short text click eligibility, long-text texture eligibility, same-function variation, directional match, omission, density, stable replay, and rights failure.
- [ ] Run:

```bash
npm --prefix backend test -- src/audio/planner/joseph-sfx-intent.test.ts src/audio/planner/sfx-asset-ranker.test.ts src/audio/planner/audio-treatment-planner.test.ts
```

Expected: fixtures select no more than three cues, include omission records, and reproduce identical asset IDs from identical inputs.

- [ ] Commit:

```bash
git add backend/src/audio/planner backend/src/maul/service.ts
git commit -m "feat(audio): plan Joseph-style SFX with restraint"
```

### Task 4: Make Audio Plan Render Authority

**Files:**
- Create: `backend/src/audio/compiler/audio-treatment-manifest-adapter.ts`
- Create: `backend/src/audio/compiler/audio-treatment-manifest-adapter.test.ts`
- Modify: `backend/src/music/renderer/manifest-adapter.ts`
- Modify: `backend/src/sound-engine/types.ts`
- Modify: `backend/src/sound-engine/filtergraph.ts`
- Modify: `backend/src/maul/planning.ts`
- Modify: `backend/src/maul/render-engine.ts`
- Modify: `remotion-app/src/compositions/MaulShort.tsx`
- Modify: `remotion-app/src/compositions/__tests__/MaulShort.test.ts`

- [ ] Compile selected track section, SFX trims, cue gains, fades, ducking, and timeline-mapped dialogue into one `SoundDesignManifest`.
- [ ] Materialize dialogue from Editorial Timeline cuts/speed changes before mixing. Preserve source/output mapping in debug plan.
- [ ] Render dialogue, music, and SFX stems; loudness-normalize master; mux mastered AAC with picture render.
- [ ] Remove fixed-gain music loop and fixed two-second SFX playback from Remotion V2/V3 manifest path. Remotion must receive the mastered audio artifact or render muted for final mux.
- [ ] Hash Audio Treatment Plan, catalog entries, and SoundDesignManifest into render replay key.
- [ ] Fail closed for missing file, rights, stale hash, out-of-range cue, or unsupported stretch. Capability fallback must be named in warnings and evidence.
- [ ] Test exact trim/fade/gain preservation, cue onset, dialogue cut mapping, and preview/final manifest parity.
- [ ] Run:

```bash
npm --prefix backend test -- src/audio/compiler/audio-treatment-manifest-adapter.test.ts src/__tests__/music-audio-renderer.test.ts src/maul/planning.test.ts
npm --prefix backend run typecheck
npm --prefix remotion-app test -- src/compositions/__tests__/MaulShort.test.ts
```

Expected: generated SFX events are present in compiled sound manifest; no V3 render path uses Remotion fixed gains.

- [ ] Commit:

```bash
git add backend/src/audio/compiler backend/src/music/renderer/manifest-adapter.ts backend/src/sound-engine backend/src/maul/planning.ts backend/src/maul/render-engine.ts remotion-app/src/compositions/MaulShort.tsx remotion-app/src/compositions/__tests__/MaulShort.test.ts
git commit -m "feat(maul): compile and render authoritative audio treatment"
```

### Task 5: Produce Encoded Tracer Evidence

**Files:**
- Create: `backend/src/maul/render-contract/audio-visual-proof.ts`
- Create: `backend/src/maul/render-contract/audio-visual-proof.test.ts`
- Create: `remotion-app/playwright-maul-premium-tracer.spec.ts`
- Create: `remotion-app/playwright-maul-premium-tracer.config.ts`
- Modify: `remotion-app/package.json`
- Modify: `backend/src/maul/quality-truth.ts`
- Modify: `backend/src/maul/quality-truth.test.ts`
- Modify: `backend/src/__tests__/maul-short-render-path.test.ts`

- [ ] Render a real fixture through compiler, Remotion, sound engine, and final mux. Mocks may cover failures but cannot satisfy tracer acceptance.
- [ ] Extract frames before/during/after each text animation and compare planned versus observed bounding boxes and pixel change.
- [ ] Extract waveform/onset data around each SFX target; require audible onset within 50 ms of plan and no unplanned cue.
- [ ] Measure integrated LUFS, true peak, clipping, dialogue presence, duration, frame size, FPS, and A/V duration drift.
- [ ] Add Aesthetic Soundness review fields: cue necessity, semantic/material fit, motion direction, mix hierarchy, repetition/fatigue, and quality of intentional silence.
- [ ] Create a rendered Quality Evidence artifact. Only an authenticated approval over its hash creates a releasable successor artifact.
- [ ] Add `test:e2e:maul-premium` script pointing at `playwright-maul-premium-tracer.config.ts`.
- [ ] Run:

```bash
npm --prefix backend test -- src/maul/render-contract/audio-visual-proof.test.ts src/maul/quality-truth.test.ts src/__tests__/maul-short-render-path.test.ts
npm --prefix remotion-app run test:e2e:maul-premium
```

Expected: real 1080x1920 H.264/AAC MP4; declared text movement visible; 1-3 planned cues audible within tolerance; target loudness within 1 LU; true peak at or below -1 dBTP; release artifact references evidence hash.

- [ ] Commit:

```bash
git add backend/src/maul/render-contract backend/src/maul/quality-truth.ts backend/src/maul/quality-truth.test.ts backend/src/__tests__/maul-short-render-path.test.ts remotion-app/playwright-maul-premium-tracer.spec.ts remotion-app/playwright-maul-premium-tracer.config.ts remotion-app/package.json
git commit -m "test(maul): prove premium text and audio tracer"
```

## 8. Foundation And Full Product Workstreams

### Task 6: Consolidate Durable Workflow Authority

**Files:**
- Create: `packages/shared-types/src/short-orchestration.ts`
- Create: `packages/shared-types/src/short-orchestration.test.ts`
- Modify: `packages/shared-types/src/index.ts`
- Create: `backend/src/maul/worker.ts`
- Create: `backend/src/maul/worker.test.ts`
- Create: `backend/src/maul/workflow.ts`
- Create: `backend/src/maul/workflow.test.ts`
- Modify: `backend/src/maul/control-plane.ts`
- Modify: `backend/src/maul/control-plane-routes.ts`
- Modify: `backend/src/maul/routes.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/maul/store.ts`
- Create: `backend/src/maul/store/maul-store.ts`
- Create: `backend/src/maul/store/postgres-maul-store.ts`
- Create: `backend/src/maul/store/postgres-maul-store.integration.test.ts`
- Create: `backend/migrations/20260803_maul_workflow.sql`
- Modify: `backend/src/config.ts`
- Modify: `backend/package.json`

- [ ] Define source-to-release artifact refs, `ShortRunConfig`, invalidation edges, user locks, capability reports, operation states, and resumable stage states. Each stage consumes parent hashes and emits one atomic artifact/successor.
- [ ] Implement worker lease loop with heartbeat, cancellation, retry classification, and recovery after process death.
- [ ] Move synchronous service calls behind workflow stage handlers. Keep old routes read-only during migration, then return deprecation responses after client parity.
- [ ] Require tenant/auth/quota checks for all project, artifact, render, download, and worker operations.
- [ ] Keep atomic file storage for local/test. Use PostgreSQL transactions and row leases for production workflow metadata; store immutable artifact bytes by content hash, then publish their refs in one DB transaction. Garbage-collect unpublished objects.
- [ ] Add pinned `pg`, `@types/pg`, and `testcontainers` dependencies. Integration tests start an isolated PostgreSQL container and apply `20260803_maul_workflow.sql`.
- [ ] Guard project transitions with expected revision and append-only events. No process-local lock may be production authority.
- [ ] Test duplicate submission, duplicate completion, lease expiration, crash between artifact and index writes, cancellation, retryable render failure, permanent rights failure, and cross-tenant access.
- [ ] Run `npm --prefix packages/shared-types test -- src/short-orchestration.test.ts && npm --prefix backend test -- src/maul/worker.test.ts src/maul/workflow.test.ts src/maul/store/postgres-maul-store.integration.test.ts src/__tests__/maul-production-control-plane.test.ts`; expect pass.
- [ ] Commit `feat(maul): connect durable control plane to workflow worker`.

### Task 7: Unify Long-Source Candidate Intelligence

**Files:**
- Create: `backend/src/shorts/source-analysis.ts`
- Create: `backend/src/shorts/source-analysis.test.ts`
- Create: `backend/src/shorts/candidate-generator.ts`
- Create: `backend/src/shorts/candidate-generator.test.ts`
- Create: `backend/src/shorts/candidate-ranker.ts`
- Create: `backend/src/shorts/candidate-ranker.test.ts`
- Create: `backend/src/shorts/candidate-diversity.ts`
- Create: `backend/src/shorts/candidate-diversity.test.ts`
- Modify: `backend/src/pipeline.ts`
- Modify: `backend/src/maul/service.ts`
- Modify: `remotion-app/src/lib/nolan-clip-engine.ts`
- Modify: `remotion-app/src/lib/__tests__/nolan-clip-engine.test.ts`

- [ ] Analyze real ASR word timestamps, speakers, VAD, audio energy/onsets, shot boundaries, face/saliency occupancy, and transcript semantics. Remove fabricated acoustic fallback words from production eligibility.
- [ ] Generate 15-60 second candidate windows around complete semantic arcs: hook, setup, payoff/proof, and optional CTA.
- [ ] Rank with named score components: standalone coherence, hook strength, payoff, novelty, emotion, speech/audio quality, visual suitability, crop feasibility, editability, and brand objective.
- [ ] Apply maximal marginal relevance across topic, source interval, hook type, emotional arc, and treatment suitability so ten results are not versions of one moment.
- [ ] Return reasons, confidence, uncertainty, source interval, recommended treatment profiles, and negative evidence.
- [ ] Build parity fixtures so legacy and Nolan callers receive the canonical candidate result until removed.
- [ ] Test 30- and 60-minute fixtures, empty/poor transcript, multiple speakers, noisy audio, overlap suppression, deterministic ties, duration bounds, and top-N diversity.
- [ ] Gate: expert review selects at least one top-three candidate in 80% of accepted golden-source sessions; no proxy is labeled measured.
- [ ] Run `npm --prefix backend test -- src/shorts/source-analysis.test.ts src/shorts/candidate-generator.test.ts src/shorts/candidate-ranker.test.ts src/shorts/candidate-diversity.test.ts && npm --prefix remotion-app test -- src/lib/__tests__/nolan-clip-engine.test.ts`; expect pass.
- [ ] Commit `feat(shorts): unify evidence-backed candidate ranking`.

### Task 8: Build Intelligent Silence And Protected-Pause Policy

**Files:**
- Modify: `backend/src/maul/editorial-timeline.ts`
- Create: `backend/src/maul/silence-policy.ts`
- Create: `backend/src/maul/silence-policy.test.ts`
- Modify: `backend/src/__tests__/maul-editorial-timeline.test.ts`
- Modify: `packages/shared-types/src/maul.ts`

- [ ] Classify every pause from VAD plus ASR boundaries as filler, breath, speaker turn, rhetorical setup, emotional hold, payoff release, technical gap, or unknown.
- [ ] Preserve Protected Pauses around semantic/rhetorical boundaries; cap compression for breath and speaker turns; remove technical gaps and low-value filler under profile budgets.
- [ ] Add minimum phoneme handles and crossfade handles so cuts never clip consonants or breaths.
- [ ] Let `natural`, `tight`, and `aggressive` profiles change budgets, never safety.
- [ ] Produce explicit source-output map, cut evidence, pause decisions, reasons, and confidence.
- [ ] Test false-positive VAD, punctuation without silence, silence without punctuation, laughter, code-switching, multiple speakers, long dramatic pause, cut-spanning word, and repeated replans.
- [ ] Gate: annotated corpus has no clipped words, at least 95% Protected Pause recall, and profile compression stays within configured ratio.
- [ ] Run `npm --prefix backend test -- src/maul/silence-policy.test.ts src/__tests__/maul-editorial-timeline.test.ts`; expect pass.
- [ ] Commit `feat(maul): govern silence with protected pauses`.

### Task 9: Connect Real Scene Observations And Placement Options

**Files:**
- Create: `backend/src/maul/source-observations.ts`
- Create: `backend/src/maul/source-observations.test.ts`
- Create: `backend/src/maul/observation-provider.ts`
- Modify: `backend/src/maul/shorts-text-placement.ts`
- Modify: `backend/src/maul/shorts-text-placement.test.ts`
- Modify: `backend/src/maul/planning.ts`
- Modify: `backend/src/maul/treatment-catalog.ts`

- [ ] Materialize shot IDs, cut confidence, subject boxes, face priority, gaze, OCR regions, saliency, motion, and non-source padded regions with provider/version/input hash.
- [ ] Stop manufacturing unknown/padded observations in production planning. Unknown evidence permits only the proven caption-safe fallback or a blocked candidate.
- [ ] Expand treatment options through profile composition, not arbitrary placement families. Preserve measured/editorial/personal primitives and add explainer and depth constraints only when evidence exists.
- [ ] Score sequence continuity, subject clearance, eye-line protection, cut resets, text travel, safe zones, and anti-repetition.
- [ ] Emit multiple governed placement variants for review, plus recommendation and compatibility reasons.
- [ ] Test centered/moving/multiple subjects, burned-in captions/OCR, fast cuts, no face, uncertain cut, safe-band fallback, and 9:16 crop variants.
- [ ] Gate: zero known collisions/safe-zone failures in golden corpus and no subject-aware claim with unknown evidence.
- [ ] Run `npm --prefix backend test -- src/maul/source-observations.test.ts src/maul/shorts-text-placement.test.ts`; expect pass.
- [ ] Commit `feat(maul): plan placement from source observations`.

### Task 10: Complete Text Choreography System

**Files:**
- Create: `backend/src/maul/text-animation-planner.ts`
- Create: `backend/src/maul/text-animation-planner.test.ts`
- Create: `remotion-app/src/compositions/MaulTextAnimationLayer.tsx`
- Create: `remotion-app/src/compositions/__tests__/MaulTextAnimationLayer.test.tsx`
- Modify: `backend/src/maul/treatment-catalog.ts`
- Modify: `remotion-app/src/compositions/MaulShort.tsx`

- [ ] Plan entry, hold, emphasis, internal handoff, and exit for each chunk using speech cadence and semantic weight.
- [ ] Add bounded primitives: fade-rise, keyword pop, block push, mask reveal, count-up, callout trace, continuous texture, and whole-block exit.
- [ ] Treat text block as one object while retaining exact token timing and active-word state.
- [ ] Enforce motion budgets, reading-time minimums, no overlapping exits/entries unless an explicit bridge exists, and reduced-motion variants.
- [ ] Make animation intensity configurable independently from placement family, then validate combinations at Treatment Genome level.
- [ ] Test long words, two-line reflow, rapid speech, cut-spanning token, RTL, CJK, emoji, numerals/dates, reduced motion, and deterministic replay.
- [ ] Gate: every declared primitive has pixel proof; 100% text remains inside planned envelope and readable for minimum duration.
- [ ] Run `npm --prefix backend test -- src/maul/text-animation-planner.test.ts && npm --prefix remotion-app test -- src/compositions/__tests__/MaulTextAnimationLayer.test.tsx`; expect pass.
- [ ] Commit `feat(maul): add configurable text choreography`.

### Task 11: Scale SFX Catalog And Real Audio Analysis

**Files:**
- Create: `scripts/audio-analysis/analyze.py`
- Create: `scripts/audio-analysis/requirements.txt`
- Create: `scripts/audio-analysis/test_analyze.py`
- Create: `backend/src/audio/analysis/audio-analysis-adapter.ts`
- Create: `backend/src/audio/analysis/audio-analysis-adapter.test.ts`
- Modify: `backend/src/audio/catalog/scan-sfx-catalog.ts`
- Modify: `backend/src/audio/catalog/sfx-catalog.schema.ts`
- Create: `backend/src/audio/catalog/sfx-library.json`

- [ ] Index all 215 audio files; report 12 non-audio/unusable files separately. Deduplicate by hash and perceptual fingerprint.
- [ ] Use Essentia as primary offline extractor for duration, loudness, true peak, BPM, beat/downbeat confidence, key/scale, danceability, spectral shape, and section/onset candidates.
- [ ] Use librosa for onset envelope, RMS contour, tempo cross-check, spectral centroid/rolloff, and deterministic fallback when Essentia is unavailable.
- [ ] Store `provider`, library versions, extractor config hash, input hash, confidence, and status with every feature set. Null/degraded values are explicit.
- [ ] Map detected key to Camelot code in TypeScript. Camelot Wheel is a compatibility transform, not a fake service or package.
- [ ] Add a CI fixture with known tempo/key/onsets and assert numeric tolerances plus adapter fallback behavior.
- [ ] Complete rights/license evidence for release assets; quarantine corrupt, duplicate, clipped, or rights-unknown assets.
- [ ] Run:

```bash
python -m venv .venv-audio-analysis
. .venv-audio-analysis/bin/activate
python -m pip install -r scripts/audio-analysis/requirements.txt
python -m unittest scripts/audio-analysis/test_analyze.py
npm --prefix backend test -- src/audio/analysis/audio-analysis-adapter.test.ts src/audio/catalog/sfx-catalog.test.ts
```

- [ ] Gate: every usable catalog asset has a real analysis record or explicit degraded state; none is silently populated with fallback constants.
- [ ] Commit `feat(audio): index and analyze complete SFX library`.

### Task 12: Complete Music Recommendation And DJ System

**Files:**
- Modify: `backend/src/music/analyzer/track-analyzer.ts`
- Modify: `backend/src/music/analyzer/beat-grid-builder.ts`
- Modify: `backend/src/music/analyzer/section-detector.ts`
- Modify: `backend/src/music/planner/music-ranker.ts`
- Modify: `backend/src/music/planner/transition-planner.ts`
- Create: `backend/src/music/planner/music-section-selector.ts`
- Create: `backend/src/music/planner/music-section-selector.test.ts`
- Create: `backend/src/music/planner/multi-track-policy.ts`
- Create: `backend/src/music/planner/multi-track-policy.test.ts`
- Create: `backend/src/music/catalog/music-source-provider.ts`
- Create: `backend/src/music/catalog/music-source-provider.test.ts`
- Modify: `backend/src/music/video-aware-planner/arrangement-orchestrator.ts`

- [ ] Rank tracks from narrative phase/energy contour, speech cadence, emotional valence, instrumentation density, vocal absence, edit handles, tempo/downbeat confidence, rights, and treatment profile.
- [ ] Select the best track section, not merely track ID. Align phrase/downbeat to hook/payoff while preserving enough head/tail for fades.
- [ ] Keep single-track default. Consider two tracks only when a labeled narrative discontinuity exists, each section has useful duration, and estimated quality gain exceeds 15%.
- [ ] Gate transition compatibility using BPM half/double relationships, downbeats, phrase length, Camelot distance, energy delta, spectral density, available handles, and dialogue/silence boundary.
- [ ] Choose beat crossfade, filter sweep, drone/riser bridge, silence drop, or hard cut from evidence. If no transition passes, retain one track.
- [ ] Render A/B previews and score loudness continuity, transient collision, tonal clash, dialogue masking, and narrative fit.
- [ ] Expose top recommendations and reasons; user can lock track, section, transition, or `no_music`.
- [ ] Normalize local, licensed-catalog, user-upload, and generative providers behind `MusicSourceProvider`. Generative outputs remain preview-only until rights, source provenance, reproducibility, and analysis gates match catalog assets.
- [ ] Test single-track fallback, compatible/incompatible key and tempo, poor analysis confidence, short duration, rights revocation, narrative boundary, and deterministic section choice.
- [ ] Gate: all soundtrack events render planned trims/fades/ducking; multi-track cannot ship without objective compatibility pass and human A/B approval during initial rollout.
- [ ] Run `npm --prefix backend test -- src/music/planner/music-section-selector.test.ts src/music/planner/multi-track-policy.test.ts src/music/catalog/music-source-provider.test.ts src/__tests__/music-video-aware-planner.test.ts`; expect pass.
- [ ] Commit `feat(music): select narrative-aware tracks and transitions`.

### Task 13: Add B-Roll, Explainers, Evidence, And Depth Treatments

**Files:**
- Create: `packages/shared-types/src/maul-visual-treatment.ts`
- Create: `packages/shared-types/src/maul-visual-treatment.test.ts`
- Modify: `packages/shared-types/src/maul.ts`
- Modify: `packages/shared-types/src/index.ts`
- Create: `backend/src/maul/visual-treatment-planner.ts`
- Create: `backend/src/maul/visual-treatment-planner.test.ts`
- Create: `backend/src/maul/evidence-retrieval.ts`
- Create: `backend/src/maul/evidence-retrieval.test.ts`
- Create: `remotion-app/src/compositions/MaulVisualTreatmentLayer.tsx`
- Create: `remotion-app/src/compositions/__tests__/MaulVisualTreatmentLayer.test.tsx`

- [ ] Support visual decisions: speaker-only, cutaway B-roll, background explainer, PiP/screen proof, full-screen proof card, callout board, subject matte, parallax, and bounded 3D object.
- [ ] Keep speaker audio continuous across explainers; plan entry/linger/exit and focus handoff for each asset.
- [ ] Retrieve against timestamped claims/entities/dates only when evidence mode permits it. Record query, canonical URL, publisher, title, publication date, capture time, quote/span, asset rights, and confidence.
- [ ] Never present a search result or model summary as source evidence. Failed/ambiguous retrieval becomes a review suggestion or omission.
- [ ] Reflow captions around PiP/evidence and validate occlusion, safe zones, source crop, and reading time.
- [ ] Require subject matte quality before behind-subject text/depth; provide an honest 2D fallback.
- [ ] Test date/article claim, conflicting sources, unavailable page, rights failure, multiple PiPs, continued dialogue, matte dropout, and visual asset removal.
- [ ] Gate: every external proof visual has provenance and rights; no fabricated article/date card; no nested or occluding text/asset geometry.
- [ ] Run `npm --prefix packages/shared-types test -- src/maul-visual-treatment.test.ts src/maul.test.ts && npm --prefix backend test -- src/maul/visual-treatment-planner.test.ts src/maul/evidence-retrieval.test.ts && npm --prefix remotion-app test -- src/compositions/__tests__/MaulVisualTreatmentLayer.test.tsx`; expect pass.
- [ ] Commit `feat(maul): plan evidence-backed visual treatments`.

### Task 14: Add Footage Choreography After Text Stability

**Files:**
- Create: `backend/src/maul/footage-choreography.ts`
- Create: `backend/src/maul/footage-choreography.test.ts`
- Modify: `remotion-app/src/compositions/MaulShort.tsx`
- Modify: `remotion-app/src/compositions/maul-short-manifest-adapter.ts`

- [ ] Plan crop/zoom/pan, punch cuts, speed ramps, freeze/hold, match movement, transition bridges, and momentum release from one global choreography timeline.
- [ ] Coordinate camera, text, B-roll, and audio through shared event IDs and attention target; prohibit simultaneous high-salience events unless explicitly grouped.
- [ ] Preserve global motion continuity through caption/layout sequences and reset only at declared discontinuities.
- [ ] Enforce crop feasibility, face/gaze protection, motion sickness bounds, optical-flow confidence, and reduced-motion mode.
- [ ] Test cuts inside camera moves, subject handoff, fast head motion, no face, B-roll bridge, speed-ramped dialogue, and audio-coupled direction.
- [ ] Gate: no camera restart without plan event; every transition has handles; A/V events share the same output-time source.
- [ ] Run `npm --prefix backend test -- src/maul/footage-choreography.test.ts && npm --prefix remotion-app test -- src/compositions/__tests__/MaulShort.test.ts`; expect pass.
- [ ] Commit `feat(maul): choreograph footage on shared timeline`.

### Task 15: Expose Versioned Public API And Configuration

**Files:**
- Create: `backend/src/maul/short-routes.ts`
- Create: `backend/src/maul/short-routes.test.ts`
- Modify: `backend/src/maul/control-plane-routes.ts`
- Modify: `backend/src/app.ts`
- Modify: `packages/shared-types/src/short-orchestration.ts`

- [ ] Add authenticated endpoints:

```text
POST   /api/maul/v1/shorts/projects
POST   /api/maul/v1/shorts/projects/:id/runs
GET    /api/maul/v1/shorts/projects/:id/candidates
PUT    /api/maul/v1/shorts/projects/:id/selection
GET    /api/maul/v1/shorts/projects/:id/treatment-options
PATCH  /api/maul/v1/shorts/projects/:id/config
POST   /api/maul/v1/shorts/projects/:id/previews
POST   /api/maul/v1/shorts/projects/:id/renders
GET    /api/maul/v1/shorts/operations/:operationId
GET    /api/maul/v1/shorts/projects/:id/artifacts/:artifactId
POST   /api/maul/v1/shorts/projects/:id/releases
```

- [ ] Require `Idempotency-Key` on mutations and optimistic `If-Match` revision on config/selection changes.
- [ ] Return `202` plus operation resource for async work, stable machine error codes, stage progress, cost usage, warnings, degraded capabilities, and retryability.
- [ ] Support `automatic`, `review`, and user-locked override flow with one schema. Validate full Treatment Genome after every patch.
- [ ] Add signed upload/download URLs, tenant-scoped artifact IDs, pagination, WebSocket/SSE progress, cancellation, quotas, and rate limits.
- [ ] Publish OpenAPI examples for one-track auto, manual clip review, SFX-off, and explainer treatment.
- [ ] Test auth, cross-tenant access, idempotency replay/conflict, stale revision, invalid combination, cancellation, retry, quota, signed URL expiry, and old schema migration.
- [ ] Gate: frontend needs no backend-specific file paths or planner internals; every visible control maps to a versioned config field and reported capability.
- [ ] Run `npm --prefix backend test -- src/maul/short-routes.test.ts src/__tests__/maul-production-control-plane.test.ts && npm --prefix packages/shared-types test -- src/short-orchestration.test.ts`; expect pass.
- [ ] Commit `feat(api): expose premium short orchestration`.

### Task 16: Build Premium Review, Quality, And Learning Loop

**Files:**
- Create: `backend/src/maul/aesthetic-soundness.ts`
- Create: `backend/src/maul/aesthetic-soundness.test.ts`
- Modify: `backend/src/maul/quality-truth.ts`
- Modify: `backend/src/maul/learning.ts`
- Create: `backend/src/maul/batch-memory.ts`
- Create: `backend/src/maul/batch-memory.test.ts`
- Modify: `remotion-app/src/web-preview/MaulPlacementTracer.tsx`

- [ ] Review source and output side by side with transcript, cuts, Protected Pauses, text boxes/motion, B-roll provenance, music/SFX events, omissions, loudness, and plan reasons.
- [ ] Allow lock/replace/remove/move/re-time actions at stable event IDs; show exact descendant invalidation before applying.
- [ ] Compute objective gates first, then human aesthetic rubric. A high subjective score cannot bypass rights, lineage, crop, readability, or audio safety.
- [ ] Track batch repetition across clips from one source/channel: hook similarity, placement family, animation primitive, SFX function/asset, music section, B-roll, and CTA.
- [ ] Store outcome analytics only with platform/user consent and versioned attribution. Never silently mutate old planner behavior from performance data.
- [ ] Build golden corpus and pairwise reviews for candidate quality, pause naturalness, placement, text motion, SFX necessity/fit, soundtrack fit, and overall short preference.
- [ ] Test tampered evidence, changed artifact after review, user override preservation, batch fatigue, multilingual review, and planner-version comparison.
- [ ] Gate: release decision always references encoded evidence; repeated batch treatment stays below configured similarity caps.
- [ ] Run `npm --prefix backend test -- src/maul/aesthetic-soundness.test.ts src/maul/batch-memory.test.ts src/maul/quality-truth.test.ts src/__tests__/maul-learning-memory.test.ts`; expect pass.
- [ ] Commit `feat(maul): gate and learn from rendered short quality`.

### Task 17: Production Reliability, Cost, And Premium Operations

**Files:**
- Create: `backend/src/maul/short-observability.ts`
- Create: `backend/src/maul/short-observability.test.ts`
- Modify: `backend/src/maul/worker.ts`
- Modify: `backend/src/maul/store.ts`
- Modify: `backend/src/maul/render-engine.ts`
- Modify: `backend/src/config.ts`
- Create: `docs/runbooks/maul-short-orchestration.md`

- [ ] Add trace/span IDs from API through stage, planner, FFmpeg, Remotion, storage, and release; log artifact hashes and planner versions without transcript/secrets.
- [ ] Enforce per-tenant concurrency, source-duration limits, storage lifecycle, render budgets, analysis cache, preview resolution tiers, and cost attribution.
- [ ] Cache by content/config/parent hashes. Recompute only invalidated descendants.
- [ ] Add stage timeouts, retry budgets, dead-letter inspection, disk-space checks, orphan cleanup, atomic artifact retention, and disaster recovery.
- [ ] Encrypt tenant assets, use signed URLs, redact prompts/transcripts, validate media/container paths, sandbox FFmpeg/Remotion inputs, and scan uploads.
- [ ] Add SLO dashboards: API acceptance under 2 seconds; 60-minute analysis under 15 minutes p95; selected-short preview under 5 minutes p95; final 60-second render under 10 minutes p95; workflow success above 99%.
- [ ] Load-test concurrent long sources and renders; chaos-test worker death, storage outage, corrupt media, model timeout, and FFmpeg capability loss.
- [ ] Document operator recovery for every terminal error code and asset-rights revocation.
- [ ] Run `npm --prefix backend test -- src/maul/short-observability.test.ts src/maul/worker.test.ts src/maul/store/postgres-maul-store.integration.test.ts`, then execute documented load/chaos profile; expect all SLO assertions pass.
- [ ] Commit `chore(maul): harden premium short operations`.

## 9. Cross-Cutting Edge Cases

Each applicable task must add fixtures for:

- 30-60 minute uploads, variable frame rate, rotated media, missing/corrupt audio, stereo/mono, and unusual sample rates.
- Multiple speakers, overlap, laughter, breaths, code-switching, weak ASR, profanity redaction, names, dates, URLs, numerals, and acronyms.
- RTL/CJK, long unbroken words, emoji, font fallback, safe zones, burned-in captions, and no detectable subject.
- Clip boundaries inside words/shots/music phrases; speed changes; source/output mapping drift.
- User changes selection after preview; catalog asset is deleted or rights-revoked; planner version changes mid-run.
- Ten shorts from one source causing repeated hooks, text treatments, SFX, song sections, and CTA.
- Multi-track request without narrative boundary; incompatible BPM/key; too-short handles; low-confidence analysis.
- Evidence retrieval with conflicting dates, paywall, removed page, disallowed license, or unverifiable claim.
- Cancellation during upload, analysis, rendering, mix, mux, and release.

## 10. Why This Supports A $1,000/Month Product

- One source produces a diverse batch, not one opaque export.
- Candidate rationale, treatment variants, and A/B previews reduce editor review time.
- Fine-grained locks let professionals correct one decision without rebuilding unrelated work.
- Source/output maps, artifact lineage, and deterministic replay make client revisions defensible.
- Rights/provenance records reduce commercial publishing risk.
- Encoded pixel/audio evidence catches failures that a JSON plan cannot.
- Batch memory prevents repetitive shorts across a campaign.
- Async operations, retries, cost visibility, and support runbooks make delivery dependable.
- Performance learning is attributable and versioned rather than an unexplained model drift.

## 11. Premium Acceptance Gates

No beta release until all gates below hold on a versioned golden corpus:

| Domain | Release gate |
| --- | --- |
| Candidate quality | Expert chooses at least one top-three candidate in 80% of accepted source sessions |
| Silence | No clipped word; Protected Pause recall at least 95%; every removal has source/output map |
| Placement | Zero known subject/OCR/safe-zone collision; unknown evidence is labeled |
| Text | Exact token coverage; every declared animation has encoded pixel proof; camera continuity does not reset accidentally |
| SFX | Every cue has intent, lifecycle, timing relation, asset score, rights, and audible onset within 50 ms; omissions are stored |
| Music | Selected section and reasons are reviewable; single-track default; every transition passes compatibility and A/B review |
| Mix | Integrated loudness within 1 LU of profile; true peak at or below -1 dBTP; no clipping; dialogue remains intelligible |
| Visuals | External evidence has provenance/rights; matte/depth never claims quality without proof |
| Reproducibility | Same inputs/versions produce same artifact hashes and equivalent encoded result |
| Review | Final release references rendered evidence and authenticated decision |
| Security | Tenant isolation, idempotency, quotas, signed URLs, and upload/media hardening pass |
| Operations | 99% workflow success and stated p95 latency targets under representative load |

## 12. First-, Second-, And Third-Order Controls

First order:

- Generate a strong clip, remove silence naturally, animate text, choose music/SFX, render 9:16.

Second order:

- Every edit shifts downstream timestamps; content-addressed DAG prevents stale text, B-roll, and audio.
- More SFX causes fatigue; batch memory, density budgets, and omission decisions preserve contrast.
- More placement options create invalid combinations; Treatment Genome compatibility keeps them coherent.
- More tracks increase transition, rights, and mix failure; single-track default contains risk.
- Frontend overrides can fight replanning; stable IDs and lock authority preserve user intent.

Third order:

- Performance feedback can collapse style diversity; versioned learning, golden corpora, and exploration budgets prevent monoculture.
- Asset revocation can invalidate old exports; release records retain license evidence and support affected-render lookup.
- Provider/model upgrades can silently change output; planner versions and replay hashes make drift measurable.
- Premium customers create many clips per source; batch-level repetition and cost controls matter more than single-render polish.
- Evidence cards can imply false authority; provenance, quote binding, confidence, and human review prevent fabricated proof.
- Localization changes text metrics, pacing, semantics, and SFX meaning; language-specific analysis and font/profile proof are required.
- Preview/final differences destroy trust; one compiler and audio manifest must drive both.

## 13. Execution Order

1. Tasks 1-5: 24-hour tracer.
2. Task 6: durable authority; no new production feature bypasses it.
3. Tasks 7-10: source selection, silence, real placement, complete text.
4. Tasks 11-12: full SFX analysis/catalog and soundtrack/DJ.
5. Tasks 13-14: evidence/B-roll/depth and footage choreography.
6. Task 15: stable public configuration/API after contracts settle.
7. Tasks 16-17: premium release, learning, reliability, and scale.

Task 2 can run beside Task 1. Task 3 begins when Task 1's shared contract tests pass; Task 4 follows Task 3. Task 11 can run after tracer catalog schema stabilizes. Task 13 may start its provider contracts after Task 6, but cannot become release-eligible before provenance and quality gates. Task 14 cannot begin until Task 10 passes encoded text-motion proof.

## 14. Final Verification

Run from repository root:

```bash
npm --prefix packages/shared-types run typecheck
npm --prefix packages/shared-types test
npm --prefix backend run typecheck
npm --prefix backend test
npm --prefix remotion-app run typecheck
npm --prefix remotion-app test
npm --prefix remotion-app test:e2e
```

Expected: all suites pass with dependencies installed. Additionally run one real 30-60 minute golden source through candidate selection and one selected candidate through final release. Archive input hashes, every plan/artifact, stems, proof frames, waveform/onset report, MP4, and release decision.

Execution is complete only when the public API can reproduce that run from stored config without manual stage calls, and a second identical request returns the same operation/artifact lineage rather than duplicating work.
