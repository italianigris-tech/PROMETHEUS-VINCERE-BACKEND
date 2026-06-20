# ISSUE 26: Integration Test Scripts

## Objective
Scripts print PASS/FAIL and exit nonzero on v8.1 contract violations.

## Files You May Edit
- `scripts/verify-determinism.ts`
- `scripts/verify-variation.ts`

## Files You Must NOT Edit
- `apps/worker/src/index.ts`
- `remotion-app/src/compositions/`

## Primary Approach
Create lightweight proof scripts that can run before full Remotion renders.

## Fallback Approach
If render hashing is too slow, keep manifest-level determinism and forbidden API checks as a preflight.

## Test Command
```bash
npx.cmd tsx scripts/verify-determinism.ts
npx.cmd tsx scripts/verify-variation.ts
```

## Success Criterion
Both scripts print PASS/FAIL and fail on known v8.1 contract violations.

## Current Status
BLOCKED: scripts run, but determinism fails on vertical metadata and variation fails on missing candidate generator.
