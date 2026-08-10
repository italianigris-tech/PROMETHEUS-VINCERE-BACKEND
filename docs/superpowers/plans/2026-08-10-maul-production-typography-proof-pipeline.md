# MAUL Production Typography Proof Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the first 20 seconds of the clean raw talking-head source through fresh AssemblyAI transcription, invoked LLM chunking, authoritative JSON typography, real MediaPipe observation, deterministic placement, frame-based word animation, and the canonical Remotion render while emitting complete cost and timing receipts.

**Architecture:** Extend the existing MAUL service and V3 manifest path. Add one strict production-proof orchestration script and small deep modules for timing receipts and MediaPipe observation; do not create a second renderer or replace V1-V3 compatibility paths. The proof passes a declared layer policy through Remotion so source video and typography are visible while source treatment, overlays, cuts, transitions, background animation, motion graphics, and sound additions are disabled.

**Tech Stack:** TypeScript/Node 18, Fastify service seams, Zod shared schemas, Vitest, AssemblyAI REST transcription, OpenAI-compatible MAUL chunking provider, Python 3.9 MediaPipe/OpenCV subprocess, Remotion 4, repository-managed FFmpeg/FFprobe.

## Global Constraints

- Source is the first 20 seconds of `remotion-app/public/uploads/raw_male_joseph_proof_v1-raw/raw-joseph-proof-source.mp4`.
- Output is 1080x1920, 30 FPS H.264 MP4 with source audio and typography only.
- AssemblyAI and the LLM chunker are required on the cold run; fixture and prompt transcript fallbacks are forbidden.
- Exactly one LLM chunking request is permitted on a cold run; cached artifacts make later runs provider-free.
- Exact JSON-declared font assets are selected first; the verified 577-font registry is fallback only and must emit a receipt.
- MediaPipe/OpenCV observations are required; speaker-track heuristics cannot be labelled as MediaPipe.
- Placement may choose large centered or intentional subject-overlap compositions; lower-right is not privileged.
- Contrast correction is static per chunk and is applied only after placement alternatives are exhausted.
- Word animation is frame-based, begins on spoken timestamps, and persists while the chunk lockup assembles and holds.
- Disabled layers must be represented in lineage and cannot reappear through renderer defaults, including the current full-frame legibility gradient.
- Every stage emits monotonic wall-clock timing, cache status, hashes, bytes where applicable, provider IDs, warnings, and failures.
- Do not modify or revert unrelated dirty worktree changes.

---

### Task 1: Add strict proof contracts and performance receipts

**Files:**
- Create: `backend/src/maul/production-proof-contract.ts`
- Create: `backend/src/maul/production-proof-contract.test.ts`
- Modify: `packages/shared-types/src/shorts-text-chunking.ts:231-321`
- Modify: `packages/shared-types/src/shorts-text-chunking.test.ts`
- Modify: `backend/src/maul/shorts-text-chunking-llm.ts:31-46,55-80,212-330`
- Modify: `backend/src/maul/shorts-text-chunking-llm.test.ts`

**Interfaces:**
- Produces `maulProductionLayerPolicySchema`, `maulProductionStageReceiptSchema`, `maulProductionRunDiagnosticsSchema`, `assertInvokedProductionChunkPlan(plan)`, and `createProductionStageTimer(stage, clock)`. Later tasks consume these contracts.
- Extends chunk-plan inference with optional provider usage: `{promptTokens:number|null, completionTokens:number|null, totalTokens:number|null, requestId:string|null, latencyMs:number|null}`. Existing non-proof callers remain valid.

```ts
export const maulProductionLayerPolicySchema = z.object({
  baseVideo: z.literal("required"),
  typography: z.literal("required"),
  sourceTreatment: z.literal("disabled"),
  sourceLegibilityOverlay: z.literal("disabled"),
  editorialCuts: z.literal("disabled"),
  transitions: z.literal("disabled"),
  backgroundAnimation: z.literal("disabled"),
  motionGraphics: z.literal("disabled"),
  audioTreatment: z.literal("disabled"),
}).strict();

export type MaulProductionStageReceipt = {
  stage: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  cache: "hit" | "miss" | "not_applicable";
  inputSha256: string;
  outputSha256: string | null;
  providerRequestId: string | null;
  bytesRead: number | null;
  bytesWritten: number | null;
  warnings: string[];
  failure: {code: string; message: string} | null;
};
```

- [ ] **Step 1: Write failing tests** for a layer policy that explicitly disables source treatment, source legibility overlay, cuts, transitions, background animation, motion graphics, and audio treatment; a stage timer that records duration and cache hit; a run diagnostic that rejects missing stage receipts; and a chunk plan assertion that rejects every non-`invoked` inference status.
- [ ] **Step 2: Run the focused tests** with `npm --workspace @prometheus/shared-types run build && npm --workspace @prometheus/backend test -- production-proof-contract shorts-text-chunking-llm shorts-text-chunking` and verify the new assertions fail.
- [ ] **Step 3: Add the Zod usage receipt fields** to the shared chunk plan as nullable optional values so existing serialized plans continue to parse.
- [ ] **Step 4: Capture OpenAI-compatible usage and request IDs** from successful chunker responses without recording authorization headers or response bodies. Preserve `null` when the provider omits usage.
- [ ] **Step 5: Implement the strict proof contracts and timer** using `performance.now()`, stable SHA-256 input/output hashes, and explicit failure codes.
- [ ] **Step 6: Run the focused tests again** and verify they pass without changing the existing fallback behavior for non-proof callers.
- [ ] **Step 7: Commit** with `git add backend/src/maul/production-proof-contract.ts backend/src/maul/production-proof-contract.test.ts backend/src/maul/shorts-text-chunking-llm.ts backend/src/maul/shorts-text-chunking-llm.test.ts packages/shared-types/src/shorts-text-chunking.ts packages/shared-types/src/shorts-text-chunking.test.ts && git commit -m "feat: add strict production proof receipts"`.

### Task 2: Build the real MediaPipe/OpenCV observation adapter

**Files:**
- Create: `packages/trajectory-extractor/maul_observe.py`
- Create: `packages/trajectory-extractor/requirements-maul.txt`
- Create: `backend/src/maul/mediapipe-observation.ts`
- Create: `backend/src/maul/mediapipe-observation.test.ts`
- Modify: `.gitignore` only if required for a local Python virtual environment, never for source artifacts.

**Interfaces:**
- `runMaulMediaObservation(input: {sourcePath:string; durationMs:number; outputWidth:number; outputHeight:number; sampleEveryFrames:number; pythonBin?:string; observationScript?:string}): Promise<MaulMediaObservationResult>`.
- The result contains `schemaVersion: "maul-media-observation/v1"`, source hash, detector versions, normalized frame observations, luminance samples, missing spans, and a timed stage receipt.
- Python emits one JSON object on stdout and diagnostics on stderr. Node validates the object with Zod and rejects non-zero exit, malformed JSON, missing detector provenance, or zero valid frames.

```ts
export type MaulMediaObservationResult = {
  schemaVersion: "maul-media-observation/v1";
  sourceSha256: string;
  detector: {
    providerId: "mediapipe_opencv";
    mediapipeVersion: string;
    opencvVersion: string;
    configurationSha256: string;
  };
  frames: Array<{
    sourceMs: number;
    faceBox: MaulNormalizedBox | null;
    poseLandmarks: Array<{name: string; x: number; y: number; confidence: number}>;
    subjectBox: MaulNormalizedBox | null;
    luminanceGrid: {columns: 12; rows: 20; samples: number[]};
  }>;
  missingSpans: Array<{startMs: number; endMs: number; reason: string}>;
  receipt: MaulProductionStageReceipt;
};
```

- [ ] **Step 1: Write failing TypeScript adapter tests** for valid normalized observations, malformed stdout, subprocess failure, missing MediaPipe provenance, and deterministic serialization of the same fixture input.
- [ ] **Step 2: Run `npm --workspace @prometheus/backend test -- mediapipe-observation`** and verify the adapter tests fail.
- [ ] **Step 3: Add a pinned Python requirements file** compatible with the current Python 3.9 deployment: `mediapipe==0.10.21`, `opencv-python-headless==4.11.0.86`, and `numpy==1.26.4`. These versions have compatible NumPy requirements; OpenCV 4.12 is forbidden here because it requires NumPy 2+ while MediaPipe 0.10.21 requires NumPy below 2. Do not add PySceneDetect to this proof because cuts are disabled and the current latest release requires Python 3.10.
- [ ] **Step 4: Implement `maul_observe.py`** with OpenCV frame sampling, MediaPipe face detection and pose landmarks, normalized coordinates, conservative subject occupancy, frame luminance grid, detector versions, and explicit missing-span records. Use `--sample-every-frames`, defaulting to 6 at 30 FPS, and never silently substitute speaker tracks.
- [ ] **Step 5: Implement the Node subprocess adapter** with bounded stdout/stderr buffers, a 30-second timeout for the 20-second clip, SHA-256 hashing, and schema validation.
- [ ] **Step 6: Run the adapter tests** and a dependency-free script contract test that verifies `--help`/missing-dependency errors are structured and non-zero.
- [ ] **Step 7: Commit** with `git add packages/trajectory-extractor/maul_observe.py packages/trajectory-extractor/requirements-maul.txt backend/src/maul/mediapipe-observation.ts backend/src/maul/mediapipe-observation.test.ts && git commit -m "feat: add MediaPipe MAUL observation adapter"`.

### Task 3: Map observations into broad, measured placement

**Files:**
- Create: `backend/src/maul/media-observation-placement.ts`
- Create: `backend/src/maul/media-observation-placement.test.ts`
- Modify: `backend/src/maul/scene-evidence.ts:79-99,295-359`
- Modify: `backend/src/maul/shorts-text-placement.ts:616-1265`
- Modify: `backend/src/maul/typography-profile-placement.ts:1-153`
- Modify: `backend/src/maul/typography-profile-contrast.ts:88-171`

**Interfaces:**
- `createMediaObservationSceneEvidenceProvider(options): SceneEvidenceProvider` adapts immutable MediaPipe observations into the existing scene-evidence seam.
- `buildMediaObservationPlacementInputs(input): SceneEvidencePlacementInputs` supplies all observation, composition, shot, and luminance intervals required by the current planner.
- `selectTypographyProfilePlacement` gains a candidate policy option that preserves the current hard gates but permits center/overlap candidates and removes the unconditional lower-right penalty.

```ts
export type MaulObservedPlacementPolicy = {
  mode: "cinematic_profile";
  allowControlledSubjectOverlap: true;
  minimumContrastRatio: 3;
  preferProfileAlignment: true;
  lowerRightBias: 0;
};

export const createMediaObservationSceneEvidenceProvider = (input: {
  observation: MaulMediaObservationResult;
  maximumInterpolationGapMs: number;
}): SceneEvidenceProvider;
```

- [ ] **Step 1: Write failing placement tests** for a centered large candidate winning over lower-right, intentional subject overlap being selected when it scores best, a dark background forcing static light text, a light background forcing static dark text, and a no-readable-candidate block.
- [ ] **Step 2: Run `npm --workspace @prometheus/backend test -- media-observation-placement typography-profile-placement typography-profile-contrast shorts-text-placement`** and confirm failure.
- [ ] **Step 3: Convert sampled MediaPipe observations** to normalized `SceneEvidenceHold` records with interpolation only across adjacent valid samples and explicit missing spans.
- [ ] **Step 4: Expand candidate scoring** to include upper/center/lower and left/center/right anchors, full-width lockups, and controlled subject overlap. Keep clipping, safe-region, existing-text, motion-envelope, and contrast gates hard.
- [ ] **Step 5: Change contrast resolution** to evaluate the entire realized envelope and return one chunk-level static override, preserving all JSON layer relationships and emitting the requested/resolved color for every layer.
- [ ] **Step 6: Run focused placement tests and existing MAUL placement tests**; verify old candidate-sequence determinism remains unchanged when the new policy is not requested.
- [ ] **Step 7: Commit** with `git add backend/src/maul/media-observation-placement.ts backend/src/maul/media-observation-placement.test.ts backend/src/maul/scene-evidence.ts backend/src/maul/shorts-text-placement.ts backend/src/maul/typography-profile-placement.ts backend/src/maul/typography-profile-contrast.ts && git commit -m "feat: make observed placement broad and contrast aware"`.

### Task 4: Make Remotion layer policy authoritative

**Files:**
- Modify: `packages/shared-types/src/maul.ts:2510-2730`
- Modify: `packages/shared-types/src/maul.test.ts`
- Modify: `remotion-app/src/compositions/MaulShort.tsx:491-505,840-1010`
- Modify: `remotion-app/src/compositions/maul-short-manifest-adapter.ts`
- Modify: `remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx` or create `remotion-app/src/compositions/__tests__/MaulShortLayerPolicy.test.tsx`
- Modify: `backend/src/maul/render-engine.ts:25-65,245-420`
- Modify: `backend/src/maul/render-engine.test.ts`

**Interfaces:**
- V3 manifest receives `layerPolicy` with required/disabled values from Task 1.
- `MaulShort` reads the policy and renders source video plus typography only when the proof policy is selected; it does not render the full-frame gradient, source treatment, visual-track assets, music, or SFX when disabled.
- `renderMaulShortLocally` validates and reports the policy in its render evidence.

```ts
export const maulRenderLayerPolicySchema = z.object({
  baseVideo: z.enum(["required"]),
  typography: z.enum(["required"]),
  sourceTreatment: z.enum(["enabled", "disabled"]),
  sourceLegibilityOverlay: z.enum(["enabled", "disabled"]),
  editorialCuts: z.enum(["enabled", "disabled"]),
  transitions: z.enum(["enabled", "disabled"]),
  backgroundAnimation: z.enum(["enabled", "disabled"]),
  motionGraphics: z.enum(["enabled", "disabled"]),
  audioTreatment: z.enum(["enabled", "disabled"]),
}).strict();

export const shouldRenderMaulLayer = (
  policy: MaulRenderLayerPolicy,
  layer: keyof MaulRenderLayerPolicy,
): boolean => policy[layer] !== "disabled";
```

- [ ] **Step 1: Write failing renderer tests** proving a typography-only manifest renders no `MaulVisualTrack`, no source-treatment component, no gradient, and no added audio while still rendering source dialogue audio and planned typography.
- [ ] **Step 2: Run shared-type and Remotion-focused tests** and verify failure.
- [ ] **Step 3: Add and validate `layerPolicy` on V3 manifests** with a strict enum for each layer; keep the field absent only for older V1/V2 manifests and normalize those to current behavior. Override V3 audio so `musicTrack` is nullable exactly when `audioTreatment` is disabled; require `sfxAssets` to be empty in that state.
- [ ] **Step 4: Gate every visual/audio branch in `MaulShort.tsx`** on the policy. Preserve source dialogue audio independently from music/SFX.
- [ ] **Step 5: Add render-time policy validation and evidence** in `render-engine.ts`; fail if a typography-only manifest contains an enabled disabled layer or unresolved staged asset. Stage/copy a music asset only when `musicTrack` is non-null.
- [ ] **Step 6: Run Remotion component tests and a manifest schema test** to verify legacy manifests remain compatible and the proof policy cannot be bypassed by defaults.
- [ ] **Step 7: Commit** with `git add packages/shared-types/src/maul.ts packages/shared-types/src/maul.test.ts remotion-app/src/compositions/MaulShort.tsx remotion-app/src/compositions/maul-short-manifest-adapter.ts remotion-app/src/compositions/__tests__ backend/src/maul/render-engine.ts backend/src/maul/render-engine.test.ts && git commit -m "feat: enforce MAUL typography-only render policy"`.

### Task 5: Create the production 20-second runner

**Files:**
- Create: `backend/src/maul/scripts/run-production-typography-proof.ts`
- Create: `backend/src/maul/scripts/run-production-typography-proof.test.ts`
- Modify: `backend/package.json`
- Modify: `backend/src/maul/service.ts:1220-1650,2054-2665` only where dependency injection is required for observation and strict policy.
- Modify: `backend/src/maul/shorts-text-chunking-llm.ts` only if Task 1 leaves a strict planner option cleaner than post-plan assertion.

**Interfaces:**
- CLI: `npm --workspace @prometheus/backend run maul:production-typography-proof -- --output-dir artifacts/maul-production-typography-proof`.
- Options: `--source`, `--start-ms` (default `0`), `--duration-ms` (default `20000`), `--output-dir`, `--python-bin`, and `--reuse-artifacts`.
- Output files: `source-segment.mp4`, `transcript.json`, `chunk-plan.json`, `media-observation.json`, `planning-bundle.json`, `render-manifest.json`, `diagnostics.json`, `performance.json`, retained PNG samples, and `maul-production-typography-proof.mp4`.

```ts
export type RunProductionTypographyProofInput = {
  sourcePath: string;
  startMs: number;
  durationMs: 20_000;
  outputDirectory: string;
  pythonBin: string;
  reuseArtifacts: boolean;
};

export type RunProductionTypographyProofResult = {
  videoPath: string;
  manifestPath: string;
  diagnosticsPath: string;
  performancePath: string;
  transcriptSource: "assemblyai" | "cache";
  chunkInferenceStatus: "invoked" | "cache";
  providerRequestCount: {assemblyai: 0 | 1; chunkingLlm: 0 | 1};
  totalDurationMs: number;
  renderRealTimeFactor: number;
};
```

- [ ] **Step 1: Write failing runner tests** for default source/20-second interval, strict AssemblyAI and invoked-LLM checks, cache reuse producing zero provider calls, disabled-layer policy, causal artifact paths, exact profile-font priority, a disclosed verified proximal-font fallback when the requested asset is absent, and a missing dependency failure.
- [ ] **Step 2: Run the runner tests** and confirm failure.
- [ ] **Step 3: Implement repository-tool media probing and trimming** using resolved FFprobe/FFmpeg binaries; preserve source audio and write a segment receipt with hashes and metadata.
- [ ] **Step 4: Implement fresh AssemblyAI transcription** for the segment. Bypass prior transcript cache on the first run, persist provider ID and timed words, and reuse only the persisted transcript on `--reuse-artifacts`.
- [ ] **Step 5: Create the backend app with real environment configuration** so the configured chunking provider is used. Assert `inference.status === "invoked"` immediately after `createPlanningBundle`; abort before manifest compilation on fallback.
- [ ] **Step 6: Inject `createMediaObservationSceneEvidenceProvider`** into the MAUL service call and pass the observed evidence to the existing profile compiler and placement planner.
- [ ] **Step 7: Compile frame motion and V3 manifest** with the typography-only policy, source dialogue audio, `musicTrack: null`, empty SFX, and all profile/font/placement receipts.
- [ ] **Step 8: Render through `renderMaulShortLocally`** at 1080x1920/30 FPS with repository-managed tools and measured bundle/render/encode timings.
- [ ] **Step 9: Write diagnostics and performance reports** with stage timings, cache status, token usage, provider IDs, real-time factor, output hashes, layer policy, selected profiles, exact/fallback fonts, placement candidates, contrast resolutions, and warnings.
- [ ] **Step 10: Run the runner tests** with mocked providers and verify no external provider is called on cached reruns.
- [ ] **Step 11: Commit** with `git add backend/src/maul/scripts/run-production-typography-proof.ts backend/src/maul/scripts/run-production-typography-proof.test.ts backend/package.json backend/src/maul/service.ts && git commit -m "feat: add production typography proof runner"`.

### Task 6: Install observation dependencies and execute the cold proof

**Files:**
- Modify only local ignored environment state: `backend/.env` and an ignored Python virtual environment under `.venv/maul-observation`.
- Create generated, untracked output under `artifacts/maul-production-typography-proof/`.

**Interfaces:**
- Uses the runner from Task 5 and the pinned dependencies from Task 2.
- Produces the complete artifact set and a cold-run performance baseline.

- [ ] **Step 1: Install the pinned MediaPipe/OpenCV environment** with `python3 -m venv .venv/maul-observation && .venv/maul-observation/bin/pip install -r packages/trajectory-extractor/requirements-maul.txt`.
- [ ] **Step 2: Verify both provider keys** are available without printing values: `ASSEMBLYAI_API_KEY` and `MAUL_CHUNKING_LLM_API_KEY`.
- [ ] **Step 3: Run the cold proof** with the real source and `--output-dir artifacts/maul-production-typography-proof/cold`.
- [ ] **Step 4: Validate the diagnostics**: AssemblyAI source, invoked chunker, MediaPipe provenance, zero disabled-layer violations, complete lineage, and all stage receipts.
- [ ] **Step 5: Inspect retained frames** at early, mid, and late chunks for scale, profile fidelity, center/subject placement, and contrast against the actual background.
- [ ] **Step 6: Commit only source changes**; keep generated media and credential files ignored unless the repository’s existing evidence policy explicitly requires a small manifest sidecar.

### Task 7: Execute the cached rerun and performance review

**Files:**
- Modify: `docs/superpowers/plans/2026-08-10-maul-production-typography-proof-pipeline.md` to record observed results only after verification.
- Create generated, untracked output under `artifacts/maul-production-typography-proof/warm/`.

**Interfaces:**
- Reuses cold-run transcript, chunk plan, observation, and manifest artifacts.
- Produces a warm render performance report and a side-by-side cold/warm comparison.

- [ ] **Step 1: Run the cached proof** with `--reuse-artifacts` and verify AssemblyAI and LLM request counters remain zero.
- [ ] **Step 2: Compare cold and warm timing receipts** by stage; calculate render real-time factor as `renderEncodeMs / 20_000`.
- [ ] **Step 3: Mark performance targets** as pass/fail without changing functional acceptance based on speed alone.
- [ ] **Step 4: Run the complete MAUL verification suite**: `npm run typecheck:maul` and `npm run test:maul`.
- [ ] **Step 5: Use verification-before-completion** to confirm the MP4 is playable, 1080x1920/30 FPS, audio is present, profiles and fonts are disclosed, and no disabled layer is visible.
- [ ] **Step 6: Commit the plan result note** with the measured baseline, provider usage availability, and any remaining deployment blocker.

## Execution Notes

- Do not use the existing 10-second fixture runner as the acceptance artifact; it is retained for its isolated animation contract tests.
- Do not add a local speech extractor. AssemblyAI remains the only speech authority for this production proof.
- Do not claim MediaPipe is fast until the timed Python adapter has run on this host or deployment-equivalent hardware.
- If the configured chunker key is absent, stop before paid transcription/render work and report that exact missing configuration.
