# ISSUE 15: Band-Pass Ducking

## Objective
No pumping on drum beats.

## Files You May Edit
- `backend/src/audio/mix-audio.ts`

## Files You Must NOT Edit
- `packages/shared-types/src/`
- `remotion-app/src/compositions/JosephEdit.tsx`

## Primary Approach
Implement vocal-band ducking first and derive fallback volume automation from transcript timing if filter support is missing.

## Fallback Approach (if primary fails after 2 hours)
If sidechain filters vary across FFmpeg builds, standardize on deterministic volume automation in MVP.

## Test Command
```bash
npm.cmd --prefix backend test -- src/audio/mix-audio.test.ts
```

## Success Criterion
No pumping on drum beats.

## Gate
Gate 5

## Dependencies
None - can start immediately.

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
