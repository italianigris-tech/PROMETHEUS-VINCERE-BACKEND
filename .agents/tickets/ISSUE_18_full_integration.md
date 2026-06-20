# ISSUE 18: Full Integration

## Objective
--full passes. 3 profiles distinct. Re-upload variation works.

## Files You May Edit
- `scripts/test-joseph.ts`

## Files You Must NOT Edit
- `packages/shared-types/src/`
- `specs/ARCHITECTURE_AUTHORITY.md`

## Primary Approach
Exercise the complete local-first Joseph path with full render settings and explicit variation checks.

## Fallback Approach (if primary fails after 2 hours)
If the full path is still too slow, keep the same assertions but stage them sequentially with artifact reuse and cached bundle/service setup.

## Test Command
```bash
npx tsx scripts/test-joseph.ts --full --hash full-test-123
```

## Success Criterion
--full passes. 3 profiles distinct. Re-upload variation works.

## Gate
Gate 6

## Dependencies
- `T09`
- `T10`
- `T11`
- `T12`
- `T13`
- `T14`
- `T15`
- `T16`
- `T17`

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
