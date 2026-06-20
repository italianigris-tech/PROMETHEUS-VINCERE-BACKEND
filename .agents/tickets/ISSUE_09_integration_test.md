# ISSUE 09: Integration Test

## Objective
--quick passes in <3 min. Determinism check.

## Files You May Edit
- `scripts/test-joseph.ts`

## Files You Must NOT Edit
- `packages/shared-types/src/`
- `backend/src/director/judgment-layer.ts`

## Primary Approach
Build the quick/full proof harness around the actual Joseph render path with deterministic checks and bounded runtime.

## Fallback Approach (if primary fails after 2 hours)
If the full quick proof is still too heavy, narrow to a single composition path and sequence the deterministic checks until bundle/serve overhead is reduced.

## Test Command
```bash
npx tsx scripts/test-joseph.ts --quick --hash ci-test-123
```

## Success Criterion
--quick passes in <3 min. Determinism check.

## Gate
Gate 4

## Dependencies
- `T01`
- `T02`
- `T03`
- `T04`
- `T05`
- `T06`
- `T07`
- `T08`

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
