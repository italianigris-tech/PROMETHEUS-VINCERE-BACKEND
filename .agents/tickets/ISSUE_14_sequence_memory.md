# ISSUE 14: Sequence Memory

## Objective
State machine: calm, building, saturated, recovering.

## Files You May Edit
- `backend/src/director/sequence-memory.ts`

## Files You Must NOT Edit
- `packages/shared-types/src/`
- `apps/worker/src/index.ts`

## Primary Approach
Implement Sequence Memory as an explicit state machine with deterministic transitions and outputs.

## Fallback Approach (if primary fails after 2 hours)
If the full state surface is too broad, ship a smaller saturation/recovery state machine first and expand later.

## Test Command
```bash
npm.cmd --prefix backend test -- src/director/sequence-memory.test.ts
```

## Success Criterion
State machine: calm, building, saturated, recovering.

## Gate
Gate 5

## Dependencies
- `T10`
- `T11`

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.

## Current Status
READY_FOR_REVIEW: ackend/src/director/sequence-memory.ts implements the calm/building/saturated/recovering state machine, breathe trigger, recovery window, and effect cooldown contract. Director wiring remains gated by T11.
