# Joseph Local-First Evidence Contract

Status: active extraction path
Updated: 2026-07-07
Contract version: `joseph-evidence-artifacts-v1`

## Decision

Joseph evidence extraction is local/API-first. Kaggle is no longer the default
for trajectory extraction.

Use GPU/cloud only when the phase is actually GPU-bound or cloud-bound:

- AssemblyAI/API for transcript evidence.
- Local ffmpeg for audio WAVs, waveforms, frame grabs, and scene-cut evidence.
- Local CPU for the 74-feature trajectory extractor.
- Kaggle T4 for RVM/matting micro-windows (#112).
- GPU later for neural preference/reward models if the data justifies it.

## RVM Matting Exception

Local-first does not mean CPU-only. RVM is the approved GPU exception when subject separation is actually needed. The local lane should emit a `matting-job-manifest.json` with video id, source hash, start/end seconds, frame range, reason, and output requirements. Kaggle returns alpha matte artifacts, composited previews, model/weights hashes, and failures. The local repo validates those artifacts before the renderer or planner can use them.

Do not matte full videos blindly. Matte only the micro-windows that need separation.

## Local Producer

Run:

```powershell
python packages\trajectory-extractor\run_local_joseph_artifacts.py --output artifacts\joseph-local-evidence
```

Optional subset smoke run:

```powershell
python packages\trajectory-extractor\run_local_joseph_artifacts.py --output artifacts\joseph-local-evidence --reference-id joseph-video-questions-03
```

The local producer keeps trajectory extraction sparse by default: bookend
windows plus one centered window for each manual audit event. Set
`PROMETHEUS_TRAJECTORY_CONTEXT_RADIUS` to include neighboring 1s windows when a
run explicitly needs wider context.

Optional AssemblyAI flag:

```powershell
$env:ASSEMBLYAI_API_KEY="..."
python packages\trajectory-extractor\run_local_joseph_artifacts.py --output artifacts\joseph-local-evidence --assemblyai
```

Current transcript behavior is conservative: the artifact records transcript
evidence status, but live upload/polling remains #111 before transcript labels become trainable.

## Required Output

The producer writes the same validator-facing contract:

| Artifact | Path pattern | Purpose |
| --- | --- | --- |
| Artifact index | `artifact-index.json` | Source/version manifest for the run. |
| Trajectory | `<video_id>.trajectory.json` | Schema-valid 74-feature trajectory. |
| Audio artifact | `audio-artifacts/<video_id>.audio-artifact.json` | WAV-derived energy/onset evidence and missingness warnings. |
| Text evidence | `text-evidence/<video_id>.text-evidence.json` | OCR/text evidence at audit timestamps when OCR is available. |
| Frame evidence | `frame-evidence/<video_id>/frame-evidence.json` | ffmpeg frame grabs at human-audit timestamps. |
| Motion/cut evidence | `motion-cut-evidence/<video_id>.motion-cut-evidence.json` | ffmpeg scene-cut evidence and audit-window cut counts. |
| Transcript evidence | `transcript-evidence/<video_id>.transcript-evidence.json` | AssemblyAI/API status and transcript labels when enabled. |
| Failure report | `extraction-failures.json` | Run failures; must be empty before training use. |

## Validation

Run:

```powershell
python packages\trajectory-extractor\validate_evidence_artifacts.py --index artifacts\joseph-local-evidence\artifact-index.json
```

The validator accepts both:

- `joseph-evidence-artifacts-v1`
- legacy `joseph-kaggle-artifacts-v1`

## Training Rule

No IRL job may read trajectories directly from a producer. It must read a
passing validation report for `artifact-index.json`.

Human notes discover decisions. Local/API evidence measures them. The validator
is the gate between evidence and training.
