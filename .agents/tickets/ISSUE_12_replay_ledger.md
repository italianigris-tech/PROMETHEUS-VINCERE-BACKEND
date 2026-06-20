# ISSUE 12: Replay Ledger

## Objective
SQLite schema. CRUD operations.

## Files You May Edit
- `backend/src/ledger/replay-ledger.ts`

## Files You Must NOT Edit
- `packages/shared-types/src/`
- `apps/worker/src/index.ts`

## Primary Approach
Create a local persisted Replay Ledger for prior output comparison and variation evidence.

## Fallback Approach (if primary fails after 2 hours)
If SQLite integration is blocked, ship a JSONL-backed local ledger behind the same interface.

## Test Command
```bash
npm.cmd --prefix backend test -- src/ledger/replay-ledger.test.ts
```

## Success Criterion
SQLite schema. CRUD operations.

## Gate
Gate 5

## Dependencies
None - can start immediately.

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
