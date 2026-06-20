# ISSUE 20: Determinism Test Suite

## Objective
Same seed stable, different seed varies, no forbidden render APIs, vertical metadata enforced.

## Files You May Edit
- `packages/shared-types/test/determinism.test.ts`
- `scripts/verify-determinism.ts`
- `.github/workflows/determinism.yml`

## Files You Must NOT Edit
- `apps/worker/src/index.ts`
- `remotion-app/src/compositions/`
- `backend/src/director/joseph-director.ts`

## Primary Approach
Add deterministic PRNG tests plus a script that canonicalizes nondeterministic metadata and fails on v8.1 render contract drift.

## Fallback Approach
If full render hashing is unavailable, verify stable manifest hashes and render-path forbidden API scans first.

## Test Command
```bash
npm.cmd --prefix packages/shared-types test -- test/determinism.test.ts
npx.cmd tsx scripts/verify-determinism.ts
```

## Success Criterion
Same seed stable, different seed varies, no forbidden render APIs, vertical metadata enforced.

## Current Status
READY_FOR_REVIEW: `npx.cmd tsx scripts/verify-determinism.ts` passes with stable same-seed manifest, different-seed variation, vertical `1080x1920` metadata, and no forbidden composition APIs.
