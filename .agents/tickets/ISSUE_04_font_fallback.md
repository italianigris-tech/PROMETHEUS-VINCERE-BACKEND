# ISSUE 04: Font Fallback

## Objective
DOM canvas -> THREE.Texture. Deterministic.

## Files You May Edit
- `remotion-app/src/compositions/KineticText.tsx`

## Files You Must NOT Edit
- `packages/shared-types/src/`
- `apps/worker/src/index.ts`

## Primary Approach
Make DOM canvas fallback the primary text rasterization path and ensure deterministic texture generation.

## Fallback Approach (if primary fails after 2 hours)
If DOM canvas becomes too slow in preview, preserve it in render path and gate preview degradation explicitly.

## Test Command
```bash
npm.cmd --prefix remotion-app run typecheck
```

## Success Criterion
DOM canvas -> THREE.Texture. Deterministic.

## Gate
Gate 2

## Dependencies
None - can start immediately.

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
