# Mini-Run Subject-Safe Corpus Expression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure required tall-font behind-subject treatments use MediaPipe-derived visible space and make the full mini-run typography corpus visibly expressed in each render.

**Architecture:** A mini-run placement module consumes existing sequential MediaPipe observations and chooses a safe caption region for every chunk. The render stage makes a valid Martin foreground and observation receipt mandatory when `subjectLayering` is required. Typography selection emits per-chunk palette and runtime treatment evidence, while the Remotion composition realizes those choices without falling back to one generic treatment.

**Tech Stack:** Python 3.12, MediaPipe, OpenCV, React, TypeScript, Remotion, Modal, unittest, Vitest.

## Global Constraints

- Scope is restricted to the mini-run pipeline and `prometheus-mini-run-studio`; do not modify landscape or MAUL behavior.
- The complete portrait font JSON corpus remains eligible; landscape JSON remains excluded.
- Tall-font profiles override normal font hierarchy only when `subjectLayering` selects the behind-subject plane.
- A `required` behind-subject treatment must fail its render when subject observation or a usable Martin foreground is unavailable.
- Explicit brand colors or `brandMotif` remain authoritative; a render without them uses balanced, non-repeating curated palettes.
- The final proof invokes only the first 30 seconds of the existing reference video using `--gl swangle`.

---

### Task 1: Subject-Safe Placement Contract

**Files:**
- Create: `mini_run_pipeline/subject_placement.py`
- Modify: `mini_run_pipeline/typography.py`
- Test: `tests/test_subject_safe_typography.py`

**Interfaces:**
- Consumes: MediaPipe observation frames shaped as `{"sourceMs": int, "subjectBox": {"x": float, "y": float, "width": float, "height": float} | None, "luminanceGrid": dict}`.
- Produces: `plan_subject_safe_placements(chunks, observation) -> list[dict]`, where each item contains `xPercent`, `yPercent`, `anchor`, `safeRegionId`, and `subjectBox`.
- Produces: `generate_font_manifest(chunks, design_override, placements=None)` where a supplied placement is persisted on its matching chunk.

- [ ] **Step 1: Write failing placement tests**

```python
def test_tall_behind_subject_chunk_uses_visible_region_not_subject_center():
    placement = plan_subject_safe_placements(
        [{"startMs": 1000, "endMs": 2000, "subjectLayering": {"behindSubject": True}}],
        observation_with_centered_subject(),
    )[0]

    assert placement["safeRegionId"] in {"upper_left", "upper_right", "lower_left", "lower_right"}
    assert placement["xPercent"] != "50%"
```

- [ ] **Step 2: Run the focused test and confirm the helper is absent**

Run: `python3 -m unittest tests.test_subject_safe_typography.SubjectSafePlacementTests.test_tall_behind_subject_chunk_uses_visible_region_not_subject_center -v`

Expected: FAIL because `mini_run_pipeline.subject_placement` is unavailable.

- [ ] **Step 3: Implement minimal deterministic safe-region scoring**

```python
def plan_subject_safe_placements(chunks, observation):
    # Score fixed text regions against the time-local subject box and luminance grid.
    # Behind-subject entries may never use a region intersecting the padded subject box.
    return planned
```

Use the closest observation frame to the chunk midpoint. Reject intersecting regions, prefer the largest clear region, then use luminance and a deterministic chunk-index tie-breaker.

- [ ] **Step 4: Attach planned placement to the typography manifest**

```python
font_manifest = generate_font_manifest(chunks, design, placements=placements)
```

Each tall behind-subject chunk must retain `safeRegionId` and its computed non-central placement in manifest evidence.

- [ ] **Step 5: Run focused tests and commit**

Run: `python3 -m unittest tests.test_subject_safe_typography -v`

Expected: PASS.

Commit:

```bash
git add mini_run_pipeline/subject_placement.py mini_run_pipeline/typography.py tests/test_subject_safe_typography.py
git commit -m "feat(mini-run): plan subject-safe tall-font placement"
```

### Task 2: Required Matte and Observation Enforcement

**Files:**
- Modify: `mini_run_pipeline/pipeline.py`
- Modify: `mini_run_pipeline/render.py`
- Modify: `modal_mini_run.py`
- Test: `tests/test_mini_run_luxury_treatment.py`

**Interfaces:**
- Consumes: `subjectLayering` design policy and a `subjectObservation` receipt from `run_subject_observation`.
- Produces: render props containing `matteSrc`, `subjectObservation`, and `behindSubjectChunkCount`.
- Produces: a render receipt with `matte.status`, `matte.foregroundPath`, `observation.status`, and `behindSubjectChunkCount`.

- [ ] **Step 1: Write failing render-gate tests**

```python
def test_required_tall_layering_rejects_missing_foreground():
    with self.assertRaisesRegex(RuntimeError, "required.*foreground"):
        require_subject_layering_assets(required=True, behind_subject_chunk_count=1, foreground_path=None, observation=None)
```

```python
def test_required_tall_layering_rejects_missing_observation():
    with self.assertRaisesRegex(RuntimeError, "required.*observation"):
        require_subject_layering_assets(required=True, behind_subject_chunk_count=1, foreground_path=Path("/tmp/foreground.webm"), observation=None)
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `python3 -m unittest tests.test_mini_run_luxury_treatment.GenerativeTypographyTests.test_required_tall_layering_rejects_missing_foreground tests.test_mini_run_luxury_treatment.GenerativeTypographyTests.test_required_tall_layering_rejects_missing_observation -v`

Expected: FAIL because the requirement gate does not exist.

- [ ] **Step 3: Add observation execution and render requirement gate**

```python
observation = observe_subject(source_path, effective_duration_ms, output_width=1080, output_height=1920)
require_subject_layering_assets(
    required=design.get("subjectLayering") == "required",
    behind_subject_chunk_count=behind_subject_chunk_count,
    foreground_path=foreground_path,
    observation=observation,
)
```

Remove the silent `except` fallback for a required treatment. Preserve optional behavior only for `auto` and `disabled` modes. Record complete diagnostics in the receipt.

- [ ] **Step 4: Package MediaPipe dependencies in the mini-run Modal image**

```python
.pip_install("numpy", "boto3", "mediapipe==0.10.21", "opencv-python-headless")
```

Bundle the existing `packages/trajectory-extractor` observer source in the mini-run image or invoke its shared code through the new placement module.

- [ ] **Step 5: Run focused tests and commit**

Run: `python3 -m unittest tests.test_mini_run_luxury_treatment -v`

Expected: PASS.

Commit:

```bash
git add mini_run_pipeline/pipeline.py mini_run_pipeline/render.py modal_mini_run.py tests/test_mini_run_luxury_treatment.py
git commit -m "fix(mini-run): enforce required subject layering"
```

### Task 3: Palette and Runtime Corpus Expression

**Files:**
- Modify: `mini_run_pipeline/typography.py`
- Modify: `remotion-app/src/compositions/PrometheusMinRun.tsx`
- Modify: `remotion-app/src/compositions/__tests__/PrometheusMinRun.test.ts`
- Test: `tests/test_typography_variation.py`

**Interfaces:**
- Produces: each manifest chunk receives `paletteId`, `palette`, `profileId`, `fxPreset`, and a runtime-supported `motionVariant`.
- Consumes: `palette`, `motionVariant`, and subject-safe `placement` in `PrometheusMinRun`.

- [ ] **Step 1: Write failing variation tests**

```python
def test_default_expressive_manifest_uses_multiple_curated_palettes():
    manifest = generate_font_manifest(build_chunks(FALLBACK_TEXTS), {"seed": "palette-proof", "creativity": "expressive"})
    assert len({chunk["paletteId"] for chunk in manifest["chunks"]}) >= 4
```

```typescript
it("renders a declared runtime variant for every selector treatment", () => {
  expect(unsupportedRuntimeTreatments()).toEqual([]);
});
```

- [ ] **Step 2: Run the Python and TypeScript focused tests and confirm failures**

Run: `python3 tests/test_typography_variation.py`

Expected: FAIL because all chunks use the champagne palette.

Run: `npm test -- --run src/compositions/__tests__/PrometheusMinRun.test.ts`

Expected: FAIL because catalog entries collapse into the generic fallback.

- [ ] **Step 3: Implement balanced palette routing**

```python
palette = select_chunk_palette(
    rng=rng,
    policy=policy,
    usage=palette_usage_counts,
    recent=recent_palette_ids,
    explicit_brand=explicit_brand,
)
```

Use the existing curated palette catalog. Explicit `brandMotif`, `heroColor`, or `companionColor` sets a fixed palette. Otherwise penalize recently used palette IDs and attach per-chunk colors before layer style resolution.

- [ ] **Step 4: Implement declared runtime visual variants and repair placement initialization**

```typescript
const behindSubject = subjectMatteAvailable && layers.some((layer) => layer.behindSubject);
const topPosition = chunk.placement?.yPercent || (behindSubject ? "48%" : "64%");
```

Build a data-driven runtime variant map for every selector ID. Each entry must define an implemented motion family and visual modifiers; unknown IDs must be rejected by tests rather than using the generic companion fallback.

- [ ] **Step 5: Run variation tests, Vitest, and typecheck; commit**

Run: `python3 tests/test_typography_variation.py && npm test -- --run src/compositions/__tests__/PrometheusMinRun.test.ts && npx tsc --noEmit`

Expected: all commands exit 0.

Commit:

```bash
git add mini_run_pipeline/typography.py remotion-app/src/compositions/PrometheusMinRun.tsx remotion-app/src/compositions/__tests__/PrometheusMinRun.test.ts tests/test_typography_variation.py
git commit -m "feat(mini-run): express palette and motion corpus"
```

### Task 4: Deployment and First-30-Second Proof

**Files:**
- Modify: `test_modal_30s.py`
- Generate: `mini_run_30s_master.mp4`
- Generate: `mini_run_30s_manifest.json`

**Interfaces:**
- Consumes: the deployed `prometheus-mini-run-studio.run_mini_run` function and the existing reference source.
- Produces: a 30-second-or-less output with stream inspection, manifest diagnostics, and representative frame review.

- [ ] **Step 1: Update the fixture with a fixed expressive proof seed and required layering**

```python
"design": {
    "seed": "mini-run-subject-safe-corpus-proof-v1",
    "creativity": "expressive",
    "subjectLayering": "required",
},
"selectedWindow": {"sourceStartMs": 0, "sourceEndMs": 30000},
```

- [ ] **Step 2: Deploy only mini-run**

Run: `modal deploy --env main modal_mini_run.py`

Expected: deployment reports `prometheus-mini-run-studio` updated.

- [ ] **Step 3: Run the 30-second proof**

Run: `modal run --env main test_modal_30s.py`

Expected: a completed result includes a matte receipt, subject observation receipt, and no required-layering fallback.

- [ ] **Step 4: Validate artifact and evidence**

Run: `ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of json mini_run_30s_master.mp4`

Run: `jq '{chunkCount, behind:(.chunks | map(select(.subjectLayering.behindSubject)) | length), palettes:(.chunks | map(.paletteId) | unique | length), profiles:(.chunks | map(.profileId) | unique | length)}' mini_run_30s_manifest.json`

Expected: H.264 video with AAC audio at 1080x1920, duration no greater than 30 seconds, one or more behind-subject chunks, at least four palettes, and multiple profile IDs.

- [ ] **Step 5: Extract and inspect representative frames**

Run: `ffmpeg -y -v error -i mini_run_30s_master.mp4 -vf "fps=1/3,scale=270:-2,tile=5x2" -frames:v 1 /tmp/mini-run-subject-safe-contact-sheet.jpg`

Expected: tall-font text remains readable in visible space and the contact sheet demonstrates distinct palette and motion treatments.

## Plan Self-Review

- Spec coverage: Task 1 replaces fixed placement with MediaPipe-derived visible space; Task 2 blocks invalid required renders; Task 3 removes palette and runtime treatment collapse; Task 4 deploys and verifies the specified 30-second output.
- Placeholder scan: no implementation placeholders or unresolved interfaces remain.
- Type consistency: `subjectObservation`, `placement`, `paletteId`, `palette`, and `motionVariant` are introduced at their producers before runtime consumption.
