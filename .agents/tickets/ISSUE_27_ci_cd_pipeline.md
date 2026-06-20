# ISSUE 27: CI/CD Pipeline

## Objective
CI runs typechecks, backend tests, shared determinism tests, same-key determinism, different-key variation, and zombie Chrome check.

## Files You May Edit
- `.github/workflows/determinism.yml`

## Files You Must NOT Edit
- `apps/worker/src/index.ts`
- `remotion-app/src/compositions/`
- `backend/src/director/joseph-director.ts`

## Primary Approach
Add a dedicated determinism workflow that runs the local safety-net scripts and core workspace checks.

## Fallback Approach
If CI install cost is too high, split render-heavy checks from preflight determinism checks.

## Test Command
```bash
GitHub Actions workflow: Prometheus Determinism
```

## Success Criterion
Workflow contains typechecks, backend tests, determinism, variation, and zombie Chrome check.

## Current Status
READY_FOR_REVIEW: workflow created. It will remain red until T20/T21/T25 blockers are fixed.
