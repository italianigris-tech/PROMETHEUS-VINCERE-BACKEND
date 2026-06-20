# ISSUE 30: Director Orchestrator

## Objective
Run the v8.1 planning path end to end: Candidate Generation -> Judgment Layer -> Evidence Preservation, while reusing the existing Cognitive Governor stage-permission logic.

## Files You May Edit
- `backend/src/cognitive-governor/index.ts`
- `backend/src/director/orchestrator.ts`
- `backend/src/director/orchestrator.test.ts`

## Files You Must NOT Edit
- `remotion-app/src/compositions/JosephEdit.tsx`
- `apps/worker/src/index.ts`
- `specs/ARCHITECTURE_AUTHORITY.md`

## Primary Approach
Add a narrow orchestration interface that calls candidate generation, invokes the Judgment Layer, persists evidence, and returns the selected manifest plus Planner Audit. Treat the existing Cognitive Governor as a real module and deepen it rather than replacing it.

## Fallback Approach (if primary fails after 2 hours)
Create an adjacent Director Orchestrator adapter under `backend/src/director/` that imports the existing Cognitive Governor decisions but keeps orchestration code separate until the seam stabilizes.

## Test Command
```bash
npm.cmd --prefix backend test -- src/director/orchestrator.test.ts
```

## Success Criterion
The orchestrator selects one candidate through the Judgment Layer, preserves evidence, emits a Planner Audit, does not call the renderer, and fails visibly when all candidates are blocked.

## Gate
Gate 7

## Dependencies
- T10 Candidate Generation
- T11 Judgment Layer
- T12 Replay Ledger
- T17 Variation Contract
- T19 Evidence Preservation
- T28 Prompt Governance Module

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Keep render execution outside this module.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
