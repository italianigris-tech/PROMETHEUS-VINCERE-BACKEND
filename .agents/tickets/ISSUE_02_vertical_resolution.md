# ISSUE 02: Vertical Resolution

## Objective
1080x1920 canvas. Text clamped to y: 0.0-0.4.

## Files You May Edit
- `remotion-app/src/compositions/JosephEdit.tsx`

## Files You Must NOT Edit
- `packages/shared-types/src/`
- `backend/src/director/joseph-director.ts`

## Primary Approach
Lock JosephEdit composition metadata and layout to vertical Shorts dimensions, then clamp text placement in the composition seam.

## Fallback Approach (if primary fails after 2 hours)
If dynamic metadata gets noisy, hard-code composition metadata first and defer non-essential responsive logic.

## Test Command
```bash
npm.cmd --prefix remotion-app test -- src/compositions/__tests__/JosephEdit.test.tsx
```

## Success Criterion
1080x1920 canvas. Text clamped to y: 0.0-0.4.

## Gate
Gate 1

## Dependencies
None - can start immediately.

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
