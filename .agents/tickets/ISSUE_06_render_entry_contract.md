# ISSUE 06: Render Entry Contract

## Objective
Joseph-specific entry point. No unrelated app code.

## Files You May Edit
- `remotion-app/src/joseph-bundle.ts`
- `remotion-app/src/joseph-entry.tsx`

## Files You Must NOT Edit
- `packages/shared-types/src/`
- `backend/src/director/judgment-layer.ts`

## Primary Approach
Create a Joseph-only render entry that registers only the Joseph composition and isolates bundle cost from unrelated app surfaces.

## Fallback Approach (if primary fails after 2 hours)
If total isolation is blocked, create a minimal entry wrapper that excludes editor/preview-only modules from the Joseph render path.

## Test Command
```bash
npm.cmd --prefix remotion-app run typecheck
```

## Success Criterion
Joseph-specific entry point. No unrelated app code.

## Gate
Gate 2

## Dependencies
- `T02`
- `T05`

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
