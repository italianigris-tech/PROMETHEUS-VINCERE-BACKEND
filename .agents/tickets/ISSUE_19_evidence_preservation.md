# ISSUE 19: Evidence Preservation

## Objective
Persist candidates, rejections, verdicts.

## Files You May Edit
- `backend/src/ledger/evidence-preservation.ts`

## Files You Must NOT Edit
- `packages/shared-types/src/`
- `apps/worker/src/index.ts`

## Primary Approach
Persist candidate sets, rejected candidates, review verdicts, and chosen genomes for future learning.

## Fallback Approach (if primary fails after 2 hours)
If the full artifact set is too large initially, persist chosen and rejected genome summaries first with stable IDs.

## Test Command
```bash
npm.cmd --prefix backend test -- src/ledger/evidence-preservation.test.ts
```

## Success Criterion
Persist candidates, rejections, verdicts.

## Gate
Gate 6

## Dependencies
- `T10`
- `T11`
- `T12`
- `T17`

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
