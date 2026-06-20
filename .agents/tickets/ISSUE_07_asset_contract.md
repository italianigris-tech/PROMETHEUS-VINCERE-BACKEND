# ISSUE 07: Asset Contract

## Objective
Explicit browser vs. FFmpeg media paths.

## Files You May Edit
- `packages/shared-types/src/asset-resolver.ts`

## Files You Must NOT Edit
- `remotion-app/src/compositions/JosephEdit.tsx`
- `backend/src/director/joseph-director.ts`

## Primary Approach
Introduce a dedicated asset resolver seam that distinguishes browser-facing URLs from FFmpeg-facing file paths.

## Fallback Approach (if primary fails after 2 hours)
If a generic resolver is too broad, ship a Joseph-specific resolver first and generalize later.

## Test Command
```bash
npm.cmd --prefix packages/shared-types run typecheck
```

## Success Criterion
Explicit browser vs. FFmpeg media paths.

## Gate
Gate 2

## Dependencies
None - can start immediately.

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
