# ISSUE 13: Dynamic Boundaries

## Objective
Cuts land on beats, not mid-word.

## Files You May Edit
- `backend/src/director/joseph-director.ts`

## Files You Must NOT Edit
- `packages/shared-types/src/`
- `backend/src/director/judgment-layer.ts`

## Primary Approach
Make phrase boundaries, beat snapping, and semantic timing explicit in the Director Adapter.

## Fallback Approach (if primary fails after 2 hours)
If full phrase semantics slips, ship stronger beat/onset lock and phrase-gap boundaries first.

## Test Command
```bash
npm.cmd --prefix backend test -- src/director/joseph-director.test.ts
```

## Success Criterion
Cuts land on beats, not mid-word.

## Gate
Gate 5

## Dependencies
- `T10`

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
