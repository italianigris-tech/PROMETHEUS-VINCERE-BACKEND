# Mini-Run Causal Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bake causal visual treatments and a Cloudflare-backed song programme into every eligible Mini Runs MP4.

**Architecture:** A Python orchestration planner produces renderer-neutral scene and audio events. Remotion consumes visual events; FFmpeg consumes materialized R2 songs and event-linked SFX. Existing typography and Martin data pass through unchanged.

**Tech Stack:** Python 3.12, unittest, Remotion/React/TypeScript, FFmpeg, boto3, Cloudflare R2, Modal.

## Global Constraints

- Modify and deploy only Mini Runs.
- Do not rewrite the completed typography or Martin selection systems.
- No literal transcript mappings, fixed effect sequences, or replayable user seed.
- Only render-approved Cloudflare catalog songs may enter an export.
- Final proof is the first 30 seconds of the existing reference video and atomically replaces `mini_run_30s_master.mp4`.

---

### Task 1: Causal Scene Planner

**Files:**
- Create: `mini_run_pipeline/orchestration.py`
- Create: `tests/test_mini_run_orchestration.py`

**Interfaces:**
- Consumes: `plan_mini_run_orchestration(chunks, probe, duration_ms, design, subject_observation)`.
- Produces: `scenes`, `transitions`, `cameraMoves`, `backgrounds`, `pip`, and `sfx`, each with causal IDs.

- [ ] Write tests proving contiguous scenes, PiP eligibility for landscape input, transition-caused zooms, bounded overshoot, and no literal phrase dependency.
- [ ] Run `python3 -m unittest tests.test_mini_run_orchestration -v` and confirm missing-module failure.
- [ ] Implement entropy-backed candidate weighting, recent-treatment penalties, and causal event linking.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: R2 Song Programme

**Files:**
- Create: `mini_run_pipeline/song_program.py`
- Modify: `mini_run_pipeline/storage.py`
- Extend: `tests/test_mini_run_orchestration.py`

**Interfaces:**
- Consumes: `plan_song_program(catalog, chunks, duration_ms, design)`.
- Produces: ranked song events with `trackId`, R2 bucket/key, source window, timeline window, crossfade, score evidence, and approval evidence.
- Produces: `materialize_song_program(program, storage, cache_dir)`.

- [ ] Write tests proving unapproved tracks are rejected, semantic metadata affects ranking, a sufficient song stays end-to-end, and exhausted songs hand off without a gap.
- [ ] Run the focused tests and confirm failures are caused by the missing functions.
- [ ] Implement catalog loading from local, HTTP, or R2 references and R2 download support.
- [ ] Implement weighted ranking and runway-based arrangement without phrase maps.
- [ ] Re-run the focused tests and confirm they pass.

### Task 3: Visual Plan Rendering

**Files:**
- Modify: `mini_run_pipeline/pipeline.py`
- Modify: `mini_run_pipeline/render.py`
- Modify: `remotion-app/src/compositions/PrometheusMinRun.tsx`
- Modify: `remotion-app/src/compositions/__tests__/PrometheusMinRun.test.ts`

**Interfaces:**
- `PrometheusMinRunProps` gains `orchestration`.
- The base-video layer consumes active scene, background, PiP, transition, and camera events.

- [ ] Write Vitest assertions for plan pass-through, Bezier PiP state, and transition-linked camera state.
- [ ] Run the focused Vitest file and confirm the new contract fails.
- [ ] Add a frame-pure scene renderer with pan/scan, blurred wings, floating PiP, transitions, and camera transforms.
- [ ] Pass the orchestration manifest through the Python render props and receipt.
- [ ] Re-run Vitest and the Python focused tests.

### Task 4: Song Mix and Event SFX

**Files:**
- Modify: `mini_run_pipeline/render.py`
- Extend: `tests/test_mini_run_orchestration.py`

**Interfaces:**
- Consumes: materialized `songProgram` plus event-linked `sfx`.
- Produces: one 48 kHz stereo AAC track and an `audioMix` receipt.

- [ ] Write tests for a graph containing song inputs, crossfade when needed, dialogue sidechain ducking, event delays, and final loudness normalization.
- [ ] Run the tests and confirm the previous source-remux path fails them.
- [ ] Build the FFmpeg graph with argument arrays, never shell strings.
- [ ] Make planned-but-unbaked song audio a render failure rather than a false success.
- [ ] Re-run focused and existing Mini Runs tests.

### Task 5: Modal Deployment and MP4 Proof

**Files:**
- Modify: `test_modal_30s.py`
- Modify: `modal_mini_run.py` only if packaging evidence requires it.

**Interfaces:**
- The proof payload requests automatic approved-R2 song selection and causal visual orchestration.
- The result returns `orchestrationManifest`, `audioMix`, and final `outputPath`/`outputUrl`.

- [ ] Run Python unit tests, focused Vitest, TypeScript typecheck, and Python compilation.
- [ ] Deploy `prometheus-mini-run-studio`; verify its new Modal version.
- [ ] Run the first-30-second proof and atomically replace the local MP4 and manifest.
- [ ] Verify H.264 video, 48 kHz stereo AAC audio, nonzero song programme, event counts, decode success, and representative frames.
