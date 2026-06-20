# ISSUE 16: SFX Variations

## Objective
40 cues generated. Director selects seeded variation.

## Files You May Edit
- `remotion-app/public/sfx/`
- `backend/src/director/joseph-director.ts`

## Files You Must NOT Edit
- `packages/shared-types/src/`
- `apps/worker/src/index.ts`

## Primary Approach
Expand the SFX library to the fixed cue contract and keep seeded selection inside the Director Adapter.

## Fallback Approach (if primary fails after 2 hours)
If all 40 assets cannot land in sprint, preserve the cue contract and fill missing slots with placeholder variants.

## Test Command
```bash
npx tsx scripts/test-joseph.ts --quick --hash sfx-test
```

## Success Criterion
40 cues generated. Director selects seeded variation.

## Gate
Gate 5

## Dependencies
- `T15`

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
