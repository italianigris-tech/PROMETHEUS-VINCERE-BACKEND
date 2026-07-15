# Joseph Kaggle Artifact Contract


> Superseded default: use `docs/joseph-local-first-evidence-contract.md` for the active local/API-first extraction path. This Kaggle contract remains as a GPU/cloud fallback producer that emits a validator-compatible artifact index.
Status: implemented in `packages/trajectory-extractor/kaggle_extract.py`
Updated: 2026-07-07
Contract version: `joseph-kaggle-artifacts-v1`

## Purpose

Kaggle is now a GPU/cloud fallback lane, not the default extraction path. The local repo remains the authority. This contract defines what Kaggle must return if cloud extraction is used before any Joseph trajectory can be considered for feature validation or IRL training.

## Required Output

`run_batch(input_dir, output_dir)` writes:

| Artifact | Path pattern | Purpose |
| --- | --- | --- |
| Artifact index | `artifact-index.json` | Top-level source/version manifest for the full Kaggle run. |
| Trajectory | `<video_id>.trajectory.json` | Schema-valid 74-feature trajectory. |
| Audio artifact | `audio-artifacts/<video_id>.audio-artifact.json` | Beat/onset/energy evidence and audio missingness warnings. |
| Text evidence | `text-evidence/<video_id>.text-evidence.json` | OCR observations at human-audit timestamps. |
| Frame evidence | `frame-evidence/<video_id>/frame-evidence.json` plus JPG frames | Visual samples at human-audit timestamps. |
| Motion/cut evidence | `motion-cut-evidence/<video_id>.motion-cut-evidence.json` | Scene/cut evidence and audit-window cut counts. |
| Failure report | `extraction-failures.json` | Batch-level failures. Must be empty before training use. |

## Local Validation

Use:

```powershell
python packages\trajectory-extractor\validate_kaggle_artifacts.py --index <kaggle-output>\artifact-index.json
```

Validation checks:

- `artifact-index.json` uses `joseph-kaggle-artifacts-v1`.
- Every video has `video_id`, `source_hash`, `feature_version`, and `extractor_version`.
- Every required artifact path exists.
- Trajectories validate against `trajectory_extractor.schema`.
- Trajectory source hash and feature version match the index.
- Audio artifact source hash matches the index.
- Text/frame/motion evidence video ids match the index.
- `index.failures` is empty unless diagnostic mode explicitly allows failures.

## Dataset Packaging

Use:

```powershell
python packages\trajectory-extractor\prepare_joseph_kaggle_dataset.py --output artifacts\kaggle-joseph-video-edits --kaggle-id <username>/joseph-video-edits
```

For a lightweight dry packet without copying MP4s:

```powershell
python packages\trajectory-extractor\prepare_joseph_kaggle_dataset.py --output artifacts\kaggle-joseph-video-edits --manifest-only
```

The packager writes:

- `videos/`
- `audits/`
- `notebook/kaggle_extract.py`
- `joseph-kaggle-manifest.json`
- `dataset-metadata.json`

## Training Rule

No IRL job may read Kaggle trajectories directly. It must read a validator report that passed for the artifact index. Human notes are discovery evidence; Kaggle artifacts are fallback measurement evidence; the validator is the training gate between them.
