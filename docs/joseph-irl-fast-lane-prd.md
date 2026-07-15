# Joseph IRL Readiness Fast-Lane PRD

Status: local/API-first pivot implemented; #110 active extraction issue; #111 AssemblyAI transcript slice
Updated: 2026-07-07
Parent gate: #58
Completed discovery gate: #57
Still blocking IRL: #59, #60, #61, #82; active extraction packet: #110; RVM matting lane: #112

## Problem Statement

The project now has five human Joseph audit packets and five matching reference videos, but the system is not yet ready for MaxEnt IRL training. The limiting factor is no longer whether the human audit can detect Joseph-style editing decisions. It can. The limiting factor is converting those human observations into source-hashed, machine-validated trajectory artifacts that preserve evidence boundaries.

The user wants speed, so evidence extraction should stay local/API-first unless a phase is proven GPU-bound. GPU output must not become trusted training data just because it is fast. The local repo remains the source of truth for schemas, feature gates, validation, issue tracking, and IRL eligibility.

## Solution

Create a local-first extraction lane that reads the five Joseph references, uses ffmpeg/API evidence extraction, returns a strict artifact contract, and validates that contract locally before any training code can consume it.

The lane produces:

- schema-valid `*.trajectory.json`
- `audio-artifact-v1` files
- OCR/text evidence files
- frame grabs at important human-audit timestamps
- motion/cut evidence files
- extraction failure report
- `artifact-index.json` tying every artifact to source hash, feature version, extractor version, and video id

The local validator rejects incomplete or mismatched evidence outputs before IRL.

## User Stories

1. As the human auditor, I want the five completed Joseph audits to close #57, so that discovery is recognized as complete.
2. As the feature catalog owner, I want the five Joseph analyses folded into #58, so that the feature vocabulary reflects real Joseph decisions.
3. As the IRL implementer, I want local/API/GPU outputs to have a strict artifact index, so that training never consumes unlabeled loose files.
4. As the IRL implementer, I want every trajectory tied to source hash, feature version, extractor version, and video id, so that re-extraction and debugging are auditable.
5. As the sound-design auditor, I want SFX and no-SFX claims verified against audio artifacts, so that silence and masking do not become false labels.
6. As the renderer implementer, I want primitive accountability separated from reward/planning, so that edit intent and render execution can be judged independently.
7. As the project owner, I want GPU/cloud used only when it earns its keep, so that the system moves fast without poisoning the reward model.
8. As a future AFK agent, I want child issues sliced around complete seams, so that each issue can ship independently.

## Implementation Decisions

- Use `run_local_joseph_artifacts.py` as the default evidence producer; keep the Kaggle extractor as a fallback producer.
- Treat Kaggle RVM matting as the scoped GPU exception: only micro-windows that need subject separation may leave the local lane, and returned matte artifacts must validate before renderer/planner use.
- Add an artifact contract around the batch driver instead of changing the 74-feature schema.
- Keep the current 74-feature catalog compact. Joseph-specific observations are folded into trainable, manual-only, deferred, or rejected buckets instead of expanding into hundreds of labels.
- Add a local evidence artifact validator that blocks training if required artifacts are missing, source hashes mismatch, feature versions mismatch, or extraction failures exist.
- Keep the Joseph Kaggle dataset packager as an escape hatch; the default path reads the local Joseph videos directly.
- Keep generic comparison sourcing deferred until the Joseph trajectories and feature catalog are stable enough to choose useful weak/generic comparators.
- Keep primitive accountability split:
  - Planner/IRL owns reward, sequence pressure, and edit intent.
  - Renderer owns primitive choice and adaptation under constraints.
  - Primitive library owns reusable render moves.
  - Judgment Layer owns whether the rendered output satisfies the intended Joseph-style move.

## Deep Modules

- Evidence Artifact Contract Module
  - Interface: `artifact-index.json` plus required artifact files.
  - Implementation: Local/API producer writes all evidence artifacts and source/version metadata.
  - Depth: callers validate one index instead of understanding every extractor output directory.

- Evidence Artifact Validator Module
  - Interface: `validate_artifact_index(index_path)` returns a pass/fail report.
  - Implementation: checks trajectory schema, source hashes, feature versions, video ids, required artifact presence, fallback warnings, and failures.
  - Depth: IRL code only needs the validator report before training eligibility.

- Joseph Dataset Packager Module
  - Interface: `prepare_dataset(output_dir, kaggle_id, copy_videos)`.
  - Implementation: creates Kaggle-ready folder layout and manifest from the five known reference files.
  - Depth: Local extraction does not depend on remembering fragile file names with spaces.

- Joseph Feature Synthesis Module
  - Interface: human-readable synthesis doc plus issue-ready PRD summary.
  - Implementation: collapses five audit packets into trainable/manual/deferred/rejected feature groups.
  - Depth: #58 can advance without every future agent rereading all five audits.

## Testing Decisions

- The trajectory extractor test suite must pass before issue tracker updates.
- The evidence validator is tested with a complete synthetic artifact index, a legacy Kaggle artifact index, and a missing-artifact failure case.
- The existing Kaggle fix harness remains the smoke test for extractor import, schema integrity, audio artifact mapping, and fallback safety.
- Returned local/API/GPU artifacts must later be validated with `validate_evidence_artifacts.py` before #60 or #82 can use them.

## Out of Scope

- Running MaxEnt IRL training now.
- Closing #59, #60, #61, or #82.
- Using Kaggle for extraction unless local/API extraction proves insufficient.
- Building a full shader primitive library before typography, PiP/matte, zoom/crop, transitions, SFX punctuation, and simple motion cards are working.
- Treating generic comparator selection as complete before the Joseph feature set is stabilized.

## Further Notes

The five Joseph audits are sufficient to close #57 and begin #58 synthesis. They are not sufficient to train IRL without local/API evidence verification because human notes discover decisions, while IRL needs measured trajectories with provenance.
