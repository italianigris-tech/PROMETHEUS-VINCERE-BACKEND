# Browser Preview and Premium Render Gap Audit

Date: 2026-05-30

Scope: browser local preview while editing, backend-assisted preview artifacts, final export lanes, creative orchestration, motion, typography, audio, and GPU/matting support.

Benchmark: hybrid of Iman Gadzhi pacing and retention with Lusion-grade motion/design polish.

## Executive Diagnosis

The visible local preview problem has two layers:

1. **Availability blocker:** the browser live preview is hard-gated on the local backend. `PreviewApp` probes `GET /health` before allowing the live compositor to start, so a local source file cannot enter the real preview surface while the backend is offline.
2. **Quality blocker:** once the backend is online, the active preview architecture is still split across multiple render lanes and multiple decision makers. The live browser preview, backend Hyperframes artifact, and final Remotion export do not share one deep preview interface. This is why the preview can be technically "running" but still feel visually dead, inconsistent, or below the Iman + Lusion target.

The repo contains many strong pieces: creative orchestration, a Judgment Layer, video-aware audio planning, font intelligence, Hyperframes artifacts, native preview stages, Remotion export scripts, and an RVM GPU worker. The failure is that these pieces are not yet one authoritative path. The active live preview often uses a reduced projection path and fallback render surfaces rather than the full Top-Level Planner, Treatment Genome, audio plan, subject-aware layout, and final renderer.

## Browser-Preview-First Failure Surface

### B0. Backend `/health` is a true local preview startup blocker

Evidence:

- `remotion-app/src/web-preview/PreviewApp.tsx:421` defines `probeBackendAvailability()` and fetches `${apiBase}/health`.
- `remotion-app/src/web-preview/PreviewApp.tsx:645` polls this health endpoint every 4 seconds in `speed-draft`.
- `remotion-app/src/web-preview/PreviewApp.tsx:935` checks backend reachability again on submit.
- `remotion-app/src/web-preview/PreviewApp.tsx:936-940` returns early with `Start the backend...` if `/health` is unreachable.
- `backend/src/app.ts:255-257` implements the backend `/health` endpoint.

Impact:

- A selected local browser video can produce an object URL, but the real live preview component is not mounted because `handleSubmit()` refuses to increment `audioPreviewRunId`.
- The preview feels "dead" when the backend is offline because the first meaningful action is blocked before Remotion, Hyperframes, Display God, or the native stage can render.

Fix:

- Make backend health a capability indicator, not the first gate for local media display.
- Start an offline browser-native "source plus minimal overlay unavailable" preview immediately after file selection.
- Queue backend-dependent features behind explicit readiness: transcript, live edit session, preview manifest, artifact, audio render.

Definition of done:

- With backend offline, choosing a local video shows playable footage in the preview frame within one second.
- The UI clearly marks transcript/motion/audio as waiting for backend, but the preview surface is not blank.
- A test covers `PreviewApp` submit behavior with `probeBackendAvailability() === false`.

### B1. The live preview has mismatched default renderer authority

Evidence:

- `remotion-app/src/web-preview/PreviewApp.tsx:47` sets `DEFAULT_LIVE_PREVIEW_RENDERER` to `"remotion"`.
- `remotion-app/src/web-preview/PreviewApp.tsx:51-55` only switches to Hyperframes when the query string contains `previewLane=hyperframes`.
- `backend/src/config.ts:104` defaults backend `PREVIEW_ENGINE` to `"hyperframes"`.
- `backend/src/config.ts:113-116` defaults `ENABLE_REMOTION_PREVIEW` to `false`.
- `backend/src/edit-sessions/service.ts:641-653` builds backend lanes as Hyperframes by default, with Remotion only if enabled.
- `remotion-app/src/web-preview/CreativeAudioLivePlayer.tsx:1360` has its own component default of `"hyperframes"`, but `PreviewApp` passes the Remotion default through at `PreviewApp.tsx:1148`.

Impact:

- The frontend default says Remotion while the backend default says Hyperframes.
- This creates a split mental model before rendering even begins: the UI can say "Remotion Player" while backend manifests advertise Hyperframes as the default interactive lane.

Fix:

- Resolve the default preview renderer from the backend session lanes, not a hard-coded frontend constant.
- Keep query-string overrides as dev-only, and display the resolved backend lane explicitly.

Definition of done:

- One source of truth determines interactive lane: the session manifest.
- A test proves default frontend renderer equals backend `lanes.defaultInteractive`.

### B2. The active live preview is one UI but four possible surfaces

Evidence:

- `remotion-app/src/web-preview/CreativeAudioLivePlayer.tsx:1225-1249` chooses among `artifact`, `remotion-player`, `display-god`, and `native-stage`.
- `remotion-app/src/web-preview/CreativeAudioLivePlayer.tsx:2337-2373` renders backend artifacts.
- `remotion-app/src/web-preview/CreativeAudioLivePlayer.tsx:2403-2427` renders `RemotionPreviewPlayer`.
- `remotion-app/src/web-preview/CreativeAudioLivePlayer.tsx:2427-2451` renders `DisplayGodPreviewStage`.
- `remotion-app/src/web-preview/CreativeAudioLivePlayer.tsx:2453-2465` falls back to `NativePreviewStage`.

Impact:

- `CreativeAudioLivePlayer` is a shallow Module with too many hidden responsibilities: backend session transport, timeline compilation, media source resolution, artifact display, Remotion preview, Hyperframes preview, native preview, readiness, diagnostics, and audio status.
- Bugs and quality gaps can be masked by fallback. A broken artifact path may silently become a browser overlay path, and each surface has different typography, animation, media, and audio behavior.

Fix:

- Split the current Module into a small set of deep Modules:
  - `LivePreviewSessionClient`: owns `POST /live-preview`, SSE, status fallback, cancellation.
  - `PreviewManifestStore`: owns current session snapshot, manifest, artifact, diagnostics.
  - `PreviewSurfaceHost`: owns only surface selection from explicit manifest state.
  - `PreviewSurfaceAdapter` implementations: Artifact, Remotion, Hyperframes, NativeFallback.

Definition of done:

- `CreativeAudioLivePlayer` is no longer the place where new preview behaviors are added.
- Surface fallback decisions are emitted as diagnostics, not hidden control flow.

## Architecture Map

### Lane 1: browser/live edit-session preview

Flow:

1. `PreviewApp` in `speed-draft` mode mounts `CreativeAudioLivePlayer` only after backend health passes.
2. `CreativeAudioLivePlayer` posts to `POST /api/edit-sessions/live-preview` at `CreativeAudioLivePlayer.tsx:1951-1991`.
3. Backend route creates a session, completes upload, and starts preview at `backend/src/edit-sessions/routes.ts:50-121`.
4. Frontend attaches to SSE or polling at `CreativeAudioLivePlayer.tsx:2009-2083`.
5. Frontend builds an `AudioCreativePreviewSession` from backend preview data at `CreativeAudioLivePlayer.tsx:1861-1886`.

Key concern:

- This lane compiles a local preview projection from session state. It is not the same thing as final render authority.

### Lane 2: backend server-rendered preview artifact

Flow:

1. Backend attempts `ensurePreviewArtifact()` when preview text or transcript is ready.
2. `backend/src/edit-sessions/service.ts:1927-1960` builds a `CreativeDecisionManifest` and calls `PreviewRenderService`.
3. `backend/src/render/preview-render-service.ts:92-105` generates a Hyperframes composition and sends it to a render adapter.
4. `backend/src/render/adapters/local-hyperframes-render-adapter.ts:62-183` chooses HTML composition, FFmpeg video, or HTML fallback.

Key concern:

- When the artifact is a video, the adapter flattens typography through FFmpeg `drawtext` at `local-hyperframes-render-adapter.ts:117-126`.
- `PreviewRenderService` explicitly records that video artifacts bypass browser GSAP/kinetic execution at `preview-render-service.ts:110-127`.

### Lane 3: local preview runner and final export

Flow:

1. `PreviewApp` posts to `/api/local-preview/run` for non-live render lanes at `PreviewApp.tsx:991-994`.
2. `backend/src/local-preview-runner.ts:747-768` runs ingest through the Remotion app scripts.
3. `backend/src/local-preview-runner.ts:801-817` runs `draft-preview-longform.ts`.
4. `backend/src/local-preview-runner.ts:873-893` runs master render.
5. The script layer invokes the Remotion CLI, for example `remotion-app/scripts/draft-preview-longform.ts:722-747`.

Key concern:

- Final output has a different renderer, caching model, asset path model, and composition path than the live preview.

### Lane 4: GPU/matting worker

Flow:

1. `runpod-video-worker/handler.py:306-307` requires CUDA.
2. `runpod-video-worker/handler.py:369-370` runs Robust Video Matting inference.
3. `runpod-video-worker/handler.py:548-553` produces alpha frames and encodes an alpha video artifact.

Key concern:

- This worker is a media-processing adapter for alpha mattes, not an editorial intelligence engine. It can support subject separation, but it does not decide pacing, typography, layout, music sync, or premium motion.

## Deeper Quality Gaps vs Iman + Lusion

### Q1. Live preview bypasses the full Top-Level Planner path

Evidence:

- `remotion-app/src/creative-orchestration/index.ts:98-303` contains the richer creative orchestration Module: Moment Segmentation, agents, Judgment Layer adapter, Cinematic Governor, Creative Director, Aesthetic Critic, and debug report.
- The active live session builder in `remotion-app/src/web-preview/audio-creative-preview-session.ts:371-431` creates an empty `CreativeTimeline` when a backend plan exists.
- `audio-creative-preview-session.ts:504-516` returns either a backend-plan session or a projection-only session; it does not call `buildCreativeOrchestrationPlan()`.
- `audio-creative-preview-session.ts:260-355` uses `buildCreativePreviewCaptionChunks()` from the simplified preview Module.
- `remotion-app/src/creative-orchestration/preview.ts:24-59` selects treatments with deterministic rules based on moment type, word count, and keyword matches.

Impact:

- The system has vocabulary for a Top-Level Planner, Treatment Genome, Sequence Memory, Pattern Memory, Creator Taste Memory, Quality-Diversity Archive, Planning Snapshot, and Planner Audit in `CONTEXT.md`, but the browser preview path mostly uses a simplified preview treatment router.
- This creates Iman-style pacing gaps: hooks, contrast, restraint, and escalation are not planned across an Adaptive Planning Horizon in the active preview surface.

Fix:

- Make live preview consume an explicit `Planner Audit` or `CreativeTimeline` generated by the full creative orchestration path.
- Keep a "fast projection" adapter, but mark it as degraded and use it only until the first real Planner Audit arrives.

### Q2. Motion polish is fragmented across renderers

Evidence:

- `RemotionPreviewPlayer` wraps `ProjectScopedMotionComposition` at `remotion-app/src/web-preview/RemotionPreviewPlayer.tsx:177-203`.
- `HyperframesPreview` builds a render graph and separate creative track layers at `remotion-app/src/web-preview/HyperframesPreview.tsx:281-308` and renders video, native overlay, GPU augmentation, and track layers at `HyperframesPreview.tsx:338-380`.
- `NativePreviewStage` owns many local easing and effect constants, including `prestigeSnap` and preview motion gains at `NativePreviewStage.tsx:150-175`.
- Server video artifacts can fall back to static FFmpeg `drawtext` timing at `backend/src/render/adapters/local-hyperframes-render-adapter.ts:117-126`.

Impact:

- Lusion-grade polish requires one motion grammar with consistent easing, blur, depth, hierarchy, and asset choreography.
- Today, different surfaces can interpret the same session differently.

Fix:

- Promote a single `RenderGraph` or `CreativeDecisionManifest` as the interface all preview adapters must obey.
- Move renderer-specific effects behind adapters and prove pixel parity with screenshot/canvas tests.

### Q3. Typography has better tooling than the active live path uses

Evidence:

- `PreviewApp` locks the UI caption system to `longform_svg_typography_v1` at `PreviewApp.tsx:47-49`.
- `buildCreativePreviewCaptionChunks()` maps treatments to profiles with a fixed table at `remotion-app/src/creative-orchestration/preview.ts:12-22`.
- Backend manifest typography uses explicit safe area and max-width calculations from source dimensions at `backend/src/edit-sessions/service.ts:1639-1647`.
- Render readiness checks font proof at `CreativeAudioLivePlayer.tsx:756-774`, but this is a readiness diagnostic, not yet a unified typography authority.

Impact:

- Premium typography should make rhetorical, typeface, hierarchy, and motion decisions together.
- The current path can make correct-looking text in isolated cases, but it is not guaranteed to be the same typography path in live preview, artifact preview, and export.

Fix:

- Create a `TypographyDecision` interface used by live preview, Hyperframes artifact, and Remotion export.
- Include font file URL, fallback policy, line plan, word emphasis, motion grammar, and layout constraints in one object.

### Q4. Subject-aware layout and collision safety are still mostly policy, not footage truth

Evidence:

- Backend metadata includes fixed layout collision defaults at `backend/src/pipeline.ts:764-768`.
- `backend/src/edit-sessions/service.ts:1644-1647` creates portrait/landscape safe areas from dimensions, not actual face/body occupancy.
- `backend/src/edit-sessions/service.ts:515` reports `overlapCheckPassed: null`.
- `LayoutAgent` only checks density and word count at `remotion-app/src/creative-orchestration/agents/layout-agent.ts:8-39`.
- Judgment rules can reason over speaker metadata and subject segmentation, but the active live preview path does not prove those facts are extracted from the current footage.

Impact:

- Lusion-style composition needs actual subject and negative-space awareness.
- Iman-style retention needs text placed where it is readable without hiding face, hands, product, or proof visuals.

Fix:

- Add an `Observation Snapshot` adapter that extracts face/body/object regions from the source video and feeds the Judgment Layer.
- Make `overlapCheckPassed` a real boolean with bounding box evidence.

### Q5. Audio and music intelligence are split from the live preview rhythm

Evidence:

- `SoundAgent` maps moment types to simple sound names such as `whoosh`, `soft-hit`, `mouse-click`, and `riser` at `remotion-app/src/creative-orchestration/agents/sound-agent.ts:4-21`.
- Browser sound playback windows cues and limits renderable cues at `remotion-app/src/web-preview/NativePreviewSoundDesign.tsx:146-178`.
- Remotion sound playback mounts cue audio with `MotionSoundDesign` at `remotion-app/src/components/MotionSoundDesign.tsx:63-132`.
- The timeline rhythm engine expects a music beat map at `remotion-app/src/lib/timeline-rhythm/timeline-rhythm-engine.ts:21-37`.
- `caption-editorial-engine.ts:683-699` currently passes `musicBeatMap: []`, mocked waveform energy, mocked fatigue, and TODO comments.
- Backend video-aware audio planning exists at `backend/src/music/video-aware-planner/build-video-aware-audio-plan.ts:138-190`, but the browser live preview readiness path only flags possible desync at `CreativeAudioLivePlayer.tsx:907-919`.
- Music section detection explicitly says it is placeholder segmentation at `backend/src/music/analyzer/section-detector.ts:56`.

Impact:

- Iman-style edits depend on speech velocity, beat drops, risers, silence, and payoff timing.
- The current live preview can show motion and play cues, but it is not a true editorial audio engine in the default path.

Fix:

- Make the video-aware audio plan a first-class input to preview and export.
- Feed beat grid, waveform energy, ducking regions, music events, and SFX events into the timeline rhythm engine.
- Require audio parity tests between browser preview, backend preview mix, and final master.

### Q6. Variation and feedback loops exist but are not the live preview steering wheel

Evidence:

- `variation-router.ts:16-66` applies deterministic variation budgeting.
- `CreativeDirector` records `feedbackSignals` and `judgmentAuditTrail` at `creative-director.ts:37-41` and `creative-director.ts:83-86`.
- `CONTEXT.md` defines a Review Surface as the primary source of evaluator truth labels.

Impact:

- The system can avoid some repetition, but it does not yet learn from explicit preview-side human preference during the editing loop.
- Without Review Surface feedback, "premium" remains a static rule set rather than a taste-calibrated editor.

Fix:

- Add a lightweight Review Surface to the browser preview: pairwise winner, failure class, sequence verdict, optional note.
- Store feedback against Pattern Memory, Creator Taste Memory, and Quality-Diversity Archive entries.

## Ranked Fixes

| Rank | Issue | Severity | Effort | Fix |
|---:|---|---|---|---|
| 1 | Backend `/health` blocks any meaningful local live preview startup | P0 | S | Allow offline local source playback immediately; gate only transcript/motion/artifact features. |
| 2 | Frontend default renderer is Remotion while backend default is Hyperframes | P0 | S | Resolve renderer from backend `lanes.defaultInteractive`; remove hard-coded frontend default for production. |
| 3 | `CreativeAudioLivePlayer` multiplexes too many preview surfaces | P0 | M | Split session transport, manifest store, surface host, and surface adapters. |
| 4 | Live preview uses simplified projection instead of full creative orchestration | P1 | M | Feed full `CreativeTimeline` / `Planner Audit` into live preview; mark projection-only mode as degraded. |
| 5 | Preview artifact and Remotion export are not the same render authority | P1 | L | Define one manifest/render graph interface consumed by Hyperframes, Remotion, and artifact adapters. |
| 6 | Server video artifacts flatten premium motion through FFmpeg drawtext | P1 | M | Make HTML/GSAP or renderer-native kinetic path the quality default; use drawtext only as explicit degraded fallback. |
| 7 | Typography decisions are scattered between preview router, manifest bridge, and renderers | P1 | M | Create a single `TypographyDecision` interface and parity tests across live/artifact/export. |
| 8 | Subject-aware layout lacks current-footage observation evidence | P2 | L | Add Observation Snapshot extraction for face/body/object/negative-space regions and real overlap checks. |
| 9 | Audio/music timing is not wired into live rhythm decisions | P2 | L | Feed video-aware audio plan and beat map into timeline rhythm, browser preview, and final mix. |
| 10 | GPU worker supports matte extraction but not editorial decisions | P2 | M | Treat RVM as a matting adapter behind the Judgment Layer, not as a premium intelligence substitute. |
| 11 | Variation and feedback are deterministic, not taste-learning | P3 | M | Ship Review Surface and connect feedback to Pattern Memory and Creator Taste Memory. |

## Implementation Roadmap

### Phase 0: Make Local Preview Feel Alive

Goal: a local editor can see footage immediately, even if backend is offline.

Tasks:

- Add an offline-capable source preview state in `PreviewApp`.
- Remove the hard return on failed `/health` for local file playback.
- Keep backend-dependent buttons/status separate: transcript, motion, artifact, audio, export.
- Add tests for offline local file preview and backend reconnect.

Success metric:

- Local file selection produces playable preview immediately.
- Backend reconnect starts transcript/live session without resetting the source media.

### Phase 1: Unify Preview Authority

Goal: one preview interface, multiple adapters.

Tasks:

- Introduce a `PreviewManifestStore` around edit-session status, preview manifest, artifact URL, diagnostics, and readiness.
- Refactor `CreativeAudioLivePlayer` into deep Modules with clear interfaces.
- Make renderer choice come from backend lanes.
- Require all fallback transitions to emit diagnostics.

Success metric:

- No component directly decides between Remotion, Hyperframes, artifact, and native fallback without a manifest/diagnostic reason.

### Phase 2: Bring the Planner Into the Live Loop

Goal: live preview uses the same editorial intelligence intended for final output.

Tasks:

- Generate a fast `Planning Snapshot` and `Planner Audit` as soon as transcript words arrive.
- Replace simplified `buildCreativePreviewCaptionChunks()` as the default live path.
- Keep it only as a degraded projection adapter while the planner is pending.
- Add tests proving `CreativeTimeline.moments`, `decisions`, and `tracks` are non-empty for real preview sessions.

Success metric:

- The live preview can explain why each beat got its treatment, asset intent, motion level, and typography mode.

### Phase 3: Motion and Typography Parity

Goal: one premium motion/typography grammar across live preview, artifact, and export.

Tasks:

- Promote `TypographyDecision` and `RenderGraph` or `CreativeDecisionManifest` as the shared contract.
- Ensure GSAP/Hyperframes kinetic timelines and Remotion output use the same timing/easing decisions.
- Downgrade FFmpeg `drawtext` to explicit emergency fallback.
- Add pixel/screenshot checks for representative hooks, proof beats, transitions, and dense explanation beats.

Success metric:

- A preview frame and exported frame match for text placement, font, hierarchy, and motion phase at sampled timestamps.

### Phase 4: Audio as Editorial Timing

Goal: sound and music are not decoration; they steer rhythm.

Tasks:

- Use `buildVideoAwareAudioPlan()` during preview sessions.
- Replace empty `musicBeatMap` and mocked waveform/fatigue inputs in `caption-editorial-engine`.
- Render a browser preview mix or synchronize live cue playback from the same audio plan used by final export.
- Integrate ducking, risers, SFX density, beat drops, and silence windows into the Judgment Layer.

Success metric:

- Hook impacts, transitions, and payoff words land on planned beat/audio events in preview and final render.

### Phase 5: Footage-Aware Layout and Matting

Goal: the system knows what it is covering.

Tasks:

- Add an Observation Snapshot for face/body/object/negative-space metadata.
- Feed speaker metadata and subject segmentation into the Judgment Layer for each moment.
- Trigger the RVM worker only when a selected treatment needs behind-subject depth.
- Make `overlapCheckPassed` real and store bounding-box evidence in diagnostics.

Success metric:

- Behind-subject and heavy headline treatments are allowed only when matte confidence and collision checks pass.

### Phase 6: Review Surface and Taste Memory

Goal: premium improves through explicit editor feedback.

Tasks:

- Add preview-side Review Surface controls: winner, failure class, sequence verdict, note.
- Store feedback against Treatment Genome, Pattern Memory, and Creator Taste Memory records.
- Use feedback in the Sequence Objective and future Quality-Diversity Archive retrieval.

Success metric:

- Repeated edits for the same creator change treatment selection in measurable, inspectable ways.

## Follow-Up Agent Checklist

- Reproduce backend-offline local preview and record current behavior.
- Add failing tests for offline local file preview and renderer default parity.
- Refactor `CreativeAudioLivePlayer` only after tests pin the current surface-selection matrix.
- Choose the shared preview contract: `CreativeDecisionManifest`, `RenderGraph`, or a smaller `PreviewManifest`.
- Make all preview surfaces consume the shared contract before deleting fallbacks.
- Add screenshot/canvas parity tests across live preview and export.
- Wire video-aware audio plan into the live preview only after the preview contract is stable.

## Final Verdict

The local preview is not broken because the repo lacks intelligence. It is broken because availability, transport, planning, rendering, audio, and fallback policy are interleaved in the same path.

The immediate fix is to make local media preview independent of backend `/health`. The premium fix is to collapse the split-brain preview lanes into one manifest-driven interface, then feed that interface with the full Top-Level Planner, Judgment Layer, audio plan, and footage-aware Observation Snapshot.

Until those two layers are separated, the system will keep alternating between "backend offline" failures and "online but not premium" failures.
