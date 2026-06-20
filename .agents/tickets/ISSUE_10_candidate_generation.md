# ISSUE 10: Candidate Generation

## Objective
Emits 2-6 candidate Treatment Genomes per profile.

## Files You May Edit
- `backend/src/director/joseph-director.ts`

## Files You Must NOT Edit
- `packages/shared-types/src/`
- `apps/worker/src/index.ts`

## Primary Approach
Refactor the Director Adapter to emit a bounded candidate set keyed by profile and variation inputs.

## Fallback Approach (if primary fails after 2 hours)
If a full candidate graph is too big for Phase 1, emit a smaller bounded set with explicit doctrine variants and keep selection external.

## Test Command
```bash
npm.cmd --prefix backend test -- src/director/joseph-director.test.ts
```

## Success Criterion
Emits 2-6 candidate Treatment Genomes per profile.

## Gate
Gate 5

## Dependencies
None - can start immediately.

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.

## Current Status
READY_FOR_REVIEW: `generateCandidateGenomes` is exported from the Director and `npx.cmd tsx scripts/verify-variation.ts` passes with 6 distinct candidates.
