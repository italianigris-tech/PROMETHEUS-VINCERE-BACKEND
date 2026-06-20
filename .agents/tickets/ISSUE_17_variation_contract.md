# ISSUE 17: Variation Contract

## Objective
Explicit upload_instance_id + retry_index handling.

## Files You May Edit
- `backend/src/director/variation-key.ts`

## Files You Must NOT Edit
- `packages/shared-types/src/`
- `remotion-app/src/compositions/JosephEdit.tsx`

## Primary Approach
Implement explicit variation-key generation and deterministic reuse rules for same-key vs different-key runs.

## Fallback Approach (if primary fails after 2 hours)
If full source/prompt fingerprinting is too broad initially, ship upload_instance_id + retry_index first behind a stable interface.

## Test Command
```bash
npm.cmd --prefix backend test -- src/director/variation-key.test.ts
```

## Success Criterion
Explicit upload_instance_id + retry_index handling.

## Gate
Gate 6

## Dependencies
- `T10`
- `T11`
- `T12`

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.

## Current Status
READY_FOR_REVIEW: `backend/src/director/variation-key.ts` implements deterministic SHA256 source/prompt fingerprints plus explicit upload_instance_id and retry_index fields.
