# ISSUE 08: Chrome Timeout

## Objective
5-min timeout. SIGKILL on hang.

## Files You May Edit
- `apps/worker/src/index.ts`

## Files You Must NOT Edit
- `packages/shared-types/src/`
- `remotion-app/src/compositions/JosephEdit.tsx`

## Primary Approach
Harden render orchestration with timeout enforcement, cleanup, and explicit retry/fail context.

## Fallback Approach (if primary fails after 2 hours)
If process-group kill semantics differ across OSes, implement the timeout with a narrower but reliable Chrome child cleanup path first.

## Test Command
```bash
npm.cmd --prefix apps/worker test -- src/index.test.ts
```

## Success Criterion
5-min timeout. SIGKILL on hang.

## Gate
Gate 2

## Dependencies
- `T01`

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
