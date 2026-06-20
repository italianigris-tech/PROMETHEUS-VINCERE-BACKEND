# ISSUE 03: Physics Engine

## Objective
GC-safe. 300 words x 2700 frames in <500ms.

## Files You May Edit
- `packages/shared-utils/src/physics-engine.ts`

## Files You Must NOT Edit
- `remotion-app/src/compositions/JosephEdit.tsx`
- `apps/worker/src/index.ts`

## Primary Approach
Implement a precomputed typed-array physics engine with no hot-loop allocations.

## Fallback Approach (if primary fails after 2 hours)
If the full generalized engine misses the target, ship a narrower per-word transform generator optimized for Joseph text primitives only.

## Test Command
```bash
npm.cmd --prefix packages/shared-utils run test
```

## Success Criterion
GC-safe. 300 words x 2700 frames in <500ms.

## Gate
Gate 2

## Dependencies
None - can start immediately.

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
