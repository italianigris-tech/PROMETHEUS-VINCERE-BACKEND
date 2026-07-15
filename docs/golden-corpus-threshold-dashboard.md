# Golden 100 Threshold Dashboard

The Golden 100 threshold dashboard is implemented by `buildGolden100Dashboard` in `backend/src/golden-corpus/dashboard.ts`.

It summarizes the Golden Corpus registry and annotation artifacts into:

- counts by style label
- counts by vehicle
- counts by curation tier
- counts by extraction status
- counts by annotation status
- validated Golden 100 candidate count
- threshold status
- warnings for references that would inflate the count

## Gate Semantics

The default threshold is 100 validated references.

The dashboard reports:

- `below_threshold`: fewer than 100 QA-approved candidates are available
- `ready`: at least 100 QA-approved candidates are available
- `blocked`: weak, rejected, duplicate, over-compressed, off-style, or rejected-trajectory references are present in positions that could inflate the Golden 100 count

Only production-eligible, approved, annotated, validated, elite references with passing annotation QA count toward the threshold. Research-only references and rejected QA examples may remain available as evidence, but they do not advance the IRL phase gate.
