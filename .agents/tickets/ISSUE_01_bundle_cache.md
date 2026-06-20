# ISSUE 01: Bundle Cache

## Objective
bundle() runs once, caches, reuses. Second render skips bundle.

## Files You May Edit
- `apps/worker/src/index.ts`

## Files You Must NOT Edit
- `packages/shared-types/src/`
- `remotion-app/src/compositions/JosephEdit.tsx`

## Primary Approach
Add module-level cached bundle state keyed by SHA256 of remotion-app/src and reuse the resulting serveUrl in renderFromManifest().

## Fallback Approach (if primary fails after 2 hours)
If full content-addressed caching is unstable, fall back to process-lifetime caching with explicit invalidation on entry-point hash mismatch.

## Test Command
```bash
npx tsx scripts/test-joseph.ts --quick --hash test1
```

## Success Criterion
bundle() runs once, caches, reuses. Second render skips bundle.

## Gate
Gate 1

## Dependencies
None - can start immediately.

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
