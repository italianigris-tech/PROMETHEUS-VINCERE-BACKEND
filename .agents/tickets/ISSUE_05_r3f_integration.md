# ISSUE 05: R3F Integration

## Objective
Reads Float32Array from inputProps. No real-time physics.

## Files You May Edit
- `remotion-app/src/compositions/JosephEdit.tsx`

## Files You Must NOT Edit
- `packages/shared-types/src/`
- `backend/src/director/joseph-director.ts`

## Primary Approach
Wire JosephEdit to consume precomputed physics data through props and keep runtime rendering dumb.

## Fallback Approach (if primary fails after 2 hours)
If full typed-array ingestion is blocked, ship a narrower adapter that maps precomputed word transforms into Joseph-only R3F meshes.

## Test Command
```bash
npm.cmd --prefix remotion-app test -- src/compositions/__tests__/JosephEdit.test.tsx
```

## Success Criterion
Reads Float32Array from inputProps. No real-time physics.

## Gate
Gate 2

## Dependencies
- `T03`
- `T04`

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
