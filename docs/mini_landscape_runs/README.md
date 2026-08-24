# Mini Landscape Runs — Long-Form / 16:9 Joseph Treatment Studio

**Directory Path**: `docs/mini_landscape_runs/`  
**Sibling of**: `docs/mini_run_studio/` (9:16 short-form)  
**Macro container**: `docs/` — both mini studios live under the same docs mega-container without spilling into `backend/`, `remotion-app/`, or root package surface.

---

## Purpose

When the **Call Parser** classifies a feed as **long-form / landscape**, execution enters this studio instead of `mini_run_studio`.

```
Frontend call
     │
     ▼
 Call Parser  ── short-form ──► mini_run_studio (9:16, chunker → 3–4 shot virality)
     │
     └── long-form ──► mini_landscape_runs (16:9)
                              │
                              ▼
                     1. Silence / dead-air cutter (FFmpeg)
                              │
                              ▼
                     2. Landscape Joseph treatment
                        (causal chain mirrored from mini_run_studio,
                         policies from Joseph five-audit annotations)
```

This folder is intentionally **low-abstraction**, same advantage as mini runs: straight causal execution, no director/worker stack, no Remotion dependency for the first spine.

---

## Folder Decision (locked)

| Option | Verdict |
| :--- | :--- |
| Nested inside `mini_run_studio/` | Rejected — pollutes short-form attribution and canvas constants (9:16 zones). |
| **Sibling under `docs/`** | **Chosen** — correct attribution, shared mega-container, zero spill into macro backend. |
| Top-level project root | Rejected — spills into macro project surface. |

Name: **`mini_landscape_runs`** (easy recall: mini + landscape + runs).

---

## Causal Treatment Chain (mirrored from mini_run_studio)

Every stage emits a typed artifact that is the **cause** of the next stage. No orphan cues. No silent mocks.

| Stage | Module | Cause → Effect |
| :---: | :--- | :--- |
| 0 | `call_parser.ts` | Prompt + media probe → `FormDecision` (`short_form` \| `long_form`) |
| 1 | `silence_cutter.ts` | Source video → `SilenceCutPlan` + cut MP4 (keep speech, drop dead air) |
| 2 | `section_segmenter.ts` | Cut video + optional transcript → `LandscapeSection[]` (hook/setup/explain/demo/payoff/outro) |
| 3 | `joseph_edit_grammar.ts` | Sections → `EditMove[]` (budgeted allocation per Joseph five-audit synthesis) |
| 4 | `landscape_composition_director.ts` | Edit moves + matte presence → placement / transition / typography cue indexes |
| 5 | `landscape_sfx_engine.ts` | Edit moves → lifecycle-aware SFX cues (entry/exit/riser/impact/no-SFX exceptions) |
| 6 | `landscape_soundtrack_engine.ts` | Video descriptor + semantic theme → per-section song selection programme (vibe→track scoring, vocals policy, anti-fatigue, blends) + empty bed; the crux of the audio layer. **SONG-07**: short-form (≤ 90s) runs are ONE song end-to-end; **AUD-09**: long-form song changes get subtle transition beds (risers). |
| 7 | `landscape_treatment_pipeline.ts` | Stages 1–6 → `LandscapeTreatmentManifest` (single auditable artifact) |
| 8 | `bake_soundtrack.py` + `music/` (real songs from R2) | Maps each seed track to a REAL song from Cloudflare R2 (classical, cinematic trailer, lo-fi, etc.) and renders the baked MP4 + music stem. Adjacent same-track windows merge (no internal dips). Short-form single-song runs render clean end-to-end. Long-form runs get subtle synthesized risers under each song-change boundary (AUD-09). Fades, crossfades (blend), -6 dB voice ducking, -14 LUFS. |
| 9 | `build_landscape_presentation.ts` | Manifest → self-contained 16:9 HTML studio (data spliced at `SEAM_BEGIN:__LANDSCAPE_RUN_DATA__`) |

---

## Joseph Policy Sources (do not re-discover)

Authoritative annotation packets (already in macro docs; **read-only**, never edited from this studio):

1. `docs/audits/joseph-masterclass-feature-extraction-01.md` — SFX lifecycle, value anchors, silence as pattern break  
2. `docs/audits/joseph-cinematic-documentary-feature-extraction-02.md` — tutorial pedagogy, callouts, host-as-layer  
3. `docs/audits/joseph-video-questions-feature-extraction-03.md` — Q&A loop budget, thesis silence, click thinning  
4. `docs/audits/joseph-viral-reels-premiere-feature-extraction-04.md` — text-behind-speaker, PiP, CTA vs price restraint  
5. `docs/audits/joseph-viral-cinematic-reels-feature-extraction-05.md` — competing numbers, graphs, momentum death  
6. `docs/joseph-five-audit-feature-synthesis.md` — train/manual/defer/reject fold  

Local policy distillation: `policies/joseph_landscape_governance_policy.md`.

---

## CLI

```bash
# From repo root
npx tsx docs/mini_landscape_runs/call_parser.ts --probe <video-or-prompt>
npx tsx docs/mini_landscape_runs/silence_cutter.ts --input <src.mp4> --out docs/mini_landscape_runs/out/
npx tsx docs/mini_landscape_runs/landscape_treatment_pipeline.ts --input <src.mp4> [--render] [--out <dir>]
  --render  also writes the silence-cut MP4 + automatically bakes the REAL-song soundtrack
npx tsx docs/mini_landscape_runs/build_landscape_presentation.ts \
  --manifest docs/mini_landscape_runs/out/landscape_treatment_manifest.json
npx tsx docs/mini_landscape_runs/tests/test_joseph_grammar_invariants.ts
npx tsx docs/mini_landscape_runs/tests/test_silence_cutter_plan.ts
npx tsx docs/mini_landscape_runs/tests/test_causal_chain.ts
npx tsx docs/mini_landscape_runs/tests/test_longform_capacity.ts
```

### Stage 9 — build_landscape_presentation.ts

Reads the Stage-7 manifest and emits a self-contained 16:9 studio page with
the run's causal data embedded. Outputs:

- `out/landscape_presentation_<run_id>.html` — the playable studio
- `out/landscape_run_<run_id>.json` — canonical run-data artifact (API-facing)

```bash
npx tsx docs/mini_landscape_runs/build_landscape_presentation.ts \
  --manifest docs/mini_landscape_runs/out/landscape_treatment_manifest.json \
  --run-id my_run \
  --out docs/mini_landscape_runs/out/landscape_presentation_my_run.html
```

Without `--manifest` the builder emits the template as-is (standalone demo
corpus). Run data is injected at the `SEAM_BEGIN:__LANDSCAPE_RUN_DATA__` seam;
the studio keeps its render core untouched and falls back to the demo scripts
when no run data is present.

### Long-form capacity (Stage 9 generalization)

The studio is **capacity-generalized** for long-form transcripts — no 20-chunk
ceilings remain:

- The timeline scrubber `max` is derived from the compiled sequence length
  (was hardcoded `max="19"`).
- Camera whoosh midpoints, "Chunk N of M" labels, and quick-switcher chips are
  all dynamic. Verified by `tests/test_longform_capacity.ts` which builds a
  **64-chunk** synthetic manifest end-to-end (17 assertions).

### Font profile corpus injection

The builder no longer trusts the template's baked profile snapshot: it loads
the **authoritative corpus from disk** (`Yuan Prometheus Screenshots/font JSON`
+ `font pairing and placement`) and injects it at the
`SEAM_BEGIN:__LANDSCAPE_FONT_PROFILES__` seam. Any new treatment profile added
to the corpus (e.g. white-red contrast / 1–5 word treatments) flows into every
landscape run automatically.

### Generalized background registry & transitioning

`landscape_treatment_presentation.html` declares a **`BACKGROUND_ASSET_REGISTRY`**
with:

- **8 image base slots** wired to `DOGMA_SCREENSHOTS_BASE64` — the long-form
  landscape bases. Each slot auto-enables once its base64 source is populated.
- **2 video overlay placeholder slots** (`kind: 'video'`) for the upcoming
  video background assets. The render path is fully generalized today: when a
  source is supplied the studio mounts a muted/looping `<video>`; empty slots
  no-op silently.

`scheduleBaseBackgroundScene` rotates through the enabled image bases per chunk
and `transitionFromPreviousScene` emits crossfade transition metadata whenever
the base changes between adjacent chunks. The full-bleed base layer lives at
`#baseBackgroundLayer` (Z:5, behind matted speaker Z:20 and semantic assets).

---

## Hard Boundaries (no spill)

- ✅ Write only under `docs/mini_landscape_runs/`
- ✅ May **read** `docs/mini_run_studio/` engines and `docs/audits/*` as libraries / policy
- ✅ May **read** `SOUND FX/` catalog paths (same as mini runs)
- ❌ Do not modify root `package.json`, `backend/`, `remotion-app/`, or other `docs/` trees
- ❌ Do not invent LLM-authored shaders or untimed SFX
- ❌ Do not treat "more effects" as quality (Joseph is an **allocation system**)

---

## Resume Prompt

> **Current state (completed):** the causal spine (stages 0–7) is implemented and green — 129 invariant assertions across
> `tests/test_silence_cutter_plan.ts`, `tests/test_joseph_grammar_invariants.ts`, `tests/test_causal_chain.ts`,
> and `tests/test_longform_capacity.ts`, plus a working FFmpeg silence cut (`silencedetect` → concat → AAC/H.264)
> validated end-to-end on a synthetic clip.
> **Stage 9 (`build_landscape_presentation.ts`) is built:** it splices the Stage-7 manifest into the relocated
> 16:9 studio template at the `SEAM_BEGIN:__LANDSCAPE_RUN_DATA__` seam and emits the playable studio + canonical
> run JSON. The builder now **loads the authoritative font profile corpus from disk** at build time (injecting via
> `SEAM_BEGIN:__LANDSCAPE_FONT_PROFILES__`), so any new treatment profile (e.g. white-red contrast / 1–5 word
> treatments) flows into every landscape run without template surgery. The studio is **capacity-generalized**:
> the timeline scrubber, camera whoosh midpoints, KPI denominators, and chrome labels are all dynamic — no hardcoded
> 20-chunk ceilings remain. A **generalized background asset registry** (`BACKGROUND_ASSET_REGISTRY`) declares 8
> image base slots (wired to `DOGMA_SCREENSHOTS_BASE64`) and 2 video placeholder slots; `scheduleBaseBackgroundScene`
> + `transitionFromPreviousScene` provide crossfade transitioning between backgrounds per chunk, rendered on a new
> full-bleed `#baseBackgroundLayer` (Z:5).
> The Modal microservice (`modal_service/modal_landscape.py` + `landscape_gateway.py`) serves the studio and chains
> pipeline → builder. Refer to `docs/mini_landscape_runs/policies/joseph_landscape_governance_policy.md` for the rule
> IDs (SFX-01…, SIL-01…, TRN-01…, AUD-01…, MAT-01…, BUD-01…). Short-form remains `docs/mini_run_studio/`.

**Next steps (when resuming):**
1. **Router wiring**: hook `call_parser.ts` `FormDecision` into the backend call path so `short_form` → mini_run_studio and `long_form` → this studio.
2. **GoSound/Libra render bridge**: resolve the `libra_*` bed/pad IDs (AUD-07) to real generated audio, mirroring mini-run `soundtrack_governance_engine.ts`. (Song selection is now real — see SONG-01…SONG-06 — the bridge just renders the chosen tracks.)
3. **Matte pipeline**: wire the matted principal-speaker assets (`docs/mini_run_studio/assets/` pattern) into `landscape_composition_director.ts` placements.
4. **ODTO policy derivation**: on reference image/transcript upload, convert to generalizable Joseph policies (OCR flag if images can't be interpreted).

---

## Modal Microservice (landscape, delineated)

The 16:9 landscape studio runs as its own Modal-hosted microservice so landscape
focus tests never touch the 9:16 context. See `modal_service/README.md` for
endpoints and deploy:

```bash
modal deploy --env main docs/mini_landscape_runs/modal_service/modal_landscape.py
```

Endpoints: `/landscape` (template), `/p/{run_id}` (built studio), `/api/manifest`,
`/api/run/{run_id}`, `/api/runs`, `POST /api/runs` (pipeline → builder).
Artifacts live on the `prometheus-landscape-artifacts` volume mounted at `out/`.


---

## Render Spine — Worker + Modal GPU (16:9 landscape bake)

The treatment manifest is rendered by the **same Remotion spine** as the 9:16
Joseph bake, generalized for two compositions:

| Piece | Location |
| :--- | :--- |
| Landscape composition | `remotion-app/src/compositions/JosephLandscapeEdit.tsx` (1920×1080) |
| Landscape defaults | `remotion-app/src/compositions/landscape-default-manifest.ts` |
| Combined entry (registers `JosephEdit` **and** `JosephLandscapeEdit`) | `remotion-app/src/entries/landscape-entry.tsx` |
| Bridge | `docs/mini_landscape_runs/landscape-to-unified.ts` → `UnifiedRenderManifest` |
| Worker dual path | `apps/worker/src/index.ts` (`compositionId`, `entryPoint`, `renderLandscapeFromManifest`) |
| Modal GPU bake (preferred) | `modal_service/modal_landscape.py` (`bake_landscape_mp4`, `gpu="L4"`) + `bake-landscape.ts` |
| Lambda fan-out (deprecated) | `apps/worker/src/lambda-render.ts` (`deployLandscapeLambdaInfra`, `renderLandscapeLambda`) |

### Local single-node bake (NVENC)

```bash
# 1. Bridge a treatment manifest to the unified render manifest (108/108 tests):
npx tsx docs/mini_landscape_runs/tests/test_landscape_to_unified.ts

# 2. Render it through the landscape spine:
npm --prefix apps/worker run render:landscape -- \
  docs/mini_landscape_runs/out/landscape_treatment_manifest.json \
  apps/worker/artifacts/landscape-render
```

The render spine is: bundle `landscape-entry.tsx` → `selectComposition('JosephLandscapeEdit')`
→ silent frames (no audio track, hum-free by construction) → `h264_nvenc` → `mixAudio`
(same mix as 9:16) → AAC mux. The shared mix+mux stage is
`mixAndMuxManifest` in `apps/worker/src/index.ts`.

### Modal GPU bake (L4/NVENC — preferred path)

Runs the same spine on a single NVIDIA L4 inside the Modal microservice, so a
single deploy does pipeline → manifest → bridge → render end-to-end:

```bash
# After `modal deploy`, one request does everything:
curl -X POST https://prometheus-landscape-studio.modal.run/api/runs \
  -H 'Content-Type: application/json' \
  -d '{"input_path": "/mnt/volume/landscape_source.mp4", "bake": true}'
```

`bake: true` implies `render: true` (the silence-cut MP4 is written to the
artifacts volume and used as the render source). The bake writes
`out/landscape_<run_id>_bake.mp4` + a JSON receipt. Because L4 NVENC encodes
~10× faster than Lambda's software x264, a single GPU container replaces the
fan-out for the current 7,464-frame runs — fan out later only if a run needs it.

### Distributed bake (Lambda fan-out — deprecated)

```bash
# 1. Deploy the render function once (AWS creds required):
npm --prefix apps/worker install        # pulls @remotion/lambda
npx remotion lambda functions deploy --memory 3008 --region us-east-1

# 2. Bootstrap bucket + site (landscape-entry bundle):
npm --prefix apps/worker run lambda:deploy

# 3. Bake via fan-out (call renderLandscapeLambda with the unified manifest):
#    bucket+site are created idempotently; frames are rendered headless-Chrome
#    across Lambda, then the silent MP4 is downloaded and locally mix+muxed.
```

Kept only as a fallback. Prefer the Modal GPU bake above.

**Prereq for source media:** both spines render via `staticFile()`, so the
landscape source video must be under `remotion-app/public/` at bundle time
(the 9:16 spine has the same rule). `bake-landscape.ts` copies it there
automatically and cleans up after the render.

