# ISSUE 23: Sequence Memory and Replay Ledger Tests

## Objective
Sequence Memory state path and Replay Ledger CRUD are covered through public interfaces.

## Files You May Edit
- `backend/src/director/sequence-memory.test.ts`
- `backend/src/ledger/replay-ledger.test.ts`

## Files You Must NOT Edit
- `backend/src/director/sequence-memory.ts`
- `backend/src/ledger/replay-ledger.ts`

## Primary Approach
Add future-facing contract tests that skip while target modules are absent and activate on file landing.

## Fallback Approach
If SQLite is deferred, preserve the CRUD contract against the JSONL-backed adapter.

## Test Command
```bash
npm.cmd --prefix backend test -- src/director/sequence-memory.test.ts src/ledger/replay-ledger.test.ts
```

## Success Criterion
Sequence Memory state path and Replay Ledger CRUD are covered.

## Current Status
BLOCKED: `sequence-memory.ts` and `replay-ledger.ts` are not present yet. Tests skip until modules land.
