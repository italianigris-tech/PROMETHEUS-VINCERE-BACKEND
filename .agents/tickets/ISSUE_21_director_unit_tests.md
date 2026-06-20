# ISSUE 21: Director Unit Tests

## Objective
Director satisfies v8.1 manifest, duration, determinism, and candidate Treatment Genome contract.

## Files You May Edit
- `backend/src/director/joseph-director.contract.test.ts`

## Files You Must NOT Edit
- `backend/src/director/joseph-director.ts`

## Primary Approach
Test the Director public interface through `generateJosephManifest` and exported candidate generation.

## Fallback Approach
If Opus renames the public interface, update only imports to target the settled module interface.

## Test Command
```bash
npm.cmd --prefix backend test -- src/director/joseph-director.contract.test.ts
```

## Success Criterion
Director satisfies v8.1 vertical metadata, 90s cap, determinism, and candidate Treatment Genome contract.

## Current Status
READY_FOR_REVIEW: `npm.cmd --prefix backend test -- src/director/joseph-director.contract.test.ts` passes; Director emits vertical metadata, caps at 90 seconds, stays deterministic by seed, and exports `generateCandidateGenomes`.
