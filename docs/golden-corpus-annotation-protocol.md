# Golden Corpus Annotation Protocol

This protocol governs human review for Golden Corpus reference edits before they can support trajectory extraction, feature validation, or learned reward work. It keeps the corpus curated to the ceiling rather than training on average or off-style examples.

## Artifact Contract

Annotation output uses `golden-corpus-annotation-v1` from `backend/src/golden-corpus/annotation.ts`.

Every annotation artifact must include:

- `registryId`: the stable ID from the Golden Corpus registry.
- `annotator`: reviewer ID and ISO review timestamp.
- `referenceEdit`: quality tier, style fit, duplicate assessment, compression assessment, visible craft decisions, failure classes, and reviewer notes.
- `extractedTrajectory`: trajectory path, feature version, validation status, trajectory notes, and per-window annotations.

The annotation artifact is valid only when it links both sides of the review:

- the reference edit identity in the corpus registry
- the extracted `trajectory.json` that future IRL or feature validation will consume

## Required Reference-Edit Review

For each reference edit, reviewers must record at least one visible craft decision with:

- category: camera, typography, motion graphics, composition, transition, audio, temporal pacing, or PiP/matte
- time range in seconds
- observed decision
- extractor feasibility: direct, heuristic, manual only, or rejected

Reviewers must assign:

- quality tier: elite, strong, generic, weak, or rejected
- style fit: on-style, borderline, or off-style
- duplicate status and duplicate registry ID when applicable
- compression status: clean, minor artifacts, or over-compressed
- failure classes when visible, using the named evaluator failure classes from `CONTEXT.md`

## Required Trajectory Review

For each extracted trajectory, reviewers must record:

- trajectory path
- feature version
- validation status
- notes explaining whether the extraction preserves the visible craft decisions
- at least one per-window annotation with window index, verdict, visible decision refs, and notes

Window annotations should call out whether the extracted state/action facts are usable for training, need review, or should be rejected.

## QA Rubric

The QA gate rejects references when any of these are true:

- quality tier is `weak` or `rejected`
- style fit is `off_style`
- duplicate assessment marks the edit as duplicate
- compression assessment is `over_compressed`
- extracted trajectory validation status is `rejected`

Rejected examples may remain in research notes or negative evidence, but they must not inflate the Golden 100 candidate count.
