# ISSUE 32: Failure Taxonomy And Judgment Rubric

## Objective
Give the Judgment Layer a named failure taxonomy and deterministic rubric so rejected candidates are explainable and future learning has stable labels.

## Files You May Edit
- `backend/src/director/failure-taxonomy.ts`
- `backend/src/director/judgment-rubric.ts`
- `backend/src/director/judgment-rubric.test.ts`
- `CONTEXT.md`

## Files You Must NOT Edit
- `backend/src/failure-intelligence/index.ts`
- `remotion-app/src/compositions/JosephEdit.tsx`
- `apps/worker/src/index.ts`

## Primary Approach
Implement the first rubric around the existing domain Failure Taxonomy: boring-under-editing, chaotic-over-editing, cheap-template-motion, premium-restraint, repetition-fatigue, climax-overspend, weak-concept-reduction, asset-treatment-mismatch, sequence-rhythm-collapse, and readability-sacrifice.

## Fallback Approach (if primary fails after 2 hours)
Ship only the typed taxonomy plus deterministic helper functions for assigning failure tags, and let T11 wire the scoring weights later.

## Test Command
```bash
npm.cmd --prefix backend test -- src/director/judgment-rubric.test.ts
```

## Success Criterion
Judgment verdicts can attach stable failure tags and rationale without treating `failure-intelligence` as the Judgment Layer.

## Gate
Gate 6

## Dependencies
None - can start immediately.

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Keep `backend/src/failure-intelligence/index.ts` as post-hoc observability unless a later issue explicitly deepens it.
- Preserve the v8.1 Determinism Contract.
