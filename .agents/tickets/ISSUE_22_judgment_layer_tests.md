# ISSUE 22: Judgment Layer Tests

## Objective
Judgment Layer selects one candidate, rejects below quality floor, similarity-vetoes repeats, and is deterministic.

## Files You May Edit
- `backend/src/director/judgment-layer.test.ts`

## Files You Must NOT Edit
- `backend/src/director/judgment-layer.ts`

## Primary Approach
Add contract tests that activate once `judgment-layer.ts` exists.

## Fallback Approach
If the settled interface differs, keep the behavior assertions and adapt only the test harness.

## Test Command
```bash
npm.cmd --prefix backend test -- src/director/judgment-layer.test.ts
```

## Success Criterion
Judgment Layer selects one candidate, rejects below quality floor, and is deterministic.

## Current Status
BLOCKED: `backend/src/director/judgment-layer.ts` is not present yet. Tests skip until the module lands.
