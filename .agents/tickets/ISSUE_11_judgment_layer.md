# ISSUE 11: Judgment Layer

## Objective
Quality floor, anti-repetition, similarity veto.

## Files You May Edit
- `backend/src/director/judgment-layer.ts`

## Files You Must NOT Edit
- `packages/shared-types/src/`
- `remotion-app/src/compositions/JosephEdit.tsx`

## Primary Approach
Implement the governor as an explicit scoring/veto seam over candidate Treatment Genomes.

## Fallback Approach (if primary fails after 2 hours)
If full scoring is too broad, ship a veto-first Judgment Layer with thresholded rejection and deterministic tie-breaks.

## Test Command
```bash
npm.cmd --prefix backend test -- src/director/judgment-layer.test.ts
```

## Success Criterion
Quality floor, anti-repetition, similarity veto.

## Gate
Gate 5

## Dependencies
- `T10`

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
