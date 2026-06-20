# ISSUE 25: Variation Contract Tests

## Objective
Explicit `upload_instance_id` + `retry_index` behavior and candidate variation are verified.

## Files You May Edit
- `backend/src/director/variation-key.test.ts`
- `scripts/verify-variation.ts`

## Files You Must NOT Edit
- `backend/src/director/variation-key.ts`
- `backend/src/director/joseph-director.ts`

## Primary Approach
Verify variation-key stability and candidate distinctness through public exports.

## Fallback Approach
If candidate generation remains separate from the Director, target the settled Top-Level Planner adapter instead.

## Test Command
```bash
npm.cmd --prefix backend test -- src/director/variation-key.test.ts
npx.cmd tsx scripts/verify-variation.ts
```

## Success Criterion
Explicit upload_instance_id + retry_index handling and candidate variation are verified.

## Current Status
BLOCKED: `variation-key.ts` is absent; `generateCandidateGenomes` is now exported and `scripts/verify-variation.ts` passes.
