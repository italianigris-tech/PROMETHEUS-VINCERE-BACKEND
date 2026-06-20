# ISSUE 28: Prompt Governance Module

## Objective
Centralize prompt allow/block decisions so prompts can bias editorial treatment without overriding v8.1 architecture authority.

## Files You May Edit
- `backend/src/director/prompt-governance.ts`
- `backend/src/director/prompt-governance.test.ts`
- `CONTEXT.md`

## Files You Must NOT Edit
- `specs/ARCHITECTURE_AUTHORITY.md`
- `remotion-app/src/compositions/JosephEdit.tsx`
- `apps/worker/src/index.ts`

## Primary Approach
Create a small Prompt Governance module that maps prompt-derived intents into allowed editorial controls and blocked architecture controls. Return explicit decisions with reasons so the Top-Level Planner, Judgment Layer, and Director do not parse or reinterpret prompt text separately.

## Fallback Approach (if primary fails after 2 hours)
Ship a narrower rule-table module that only blocks the locked v8.1 invariants: stack, determinism, duration cap, queue architecture, schema authority, and render-path forbidden APIs.

## Test Command
```bash
npm.cmd --prefix backend test -- src/director/prompt-governance.test.ts
```

## Success Criterion
Prompts may bias doctrine, density, tone, and exclusions, but cannot override stack, determinism, duration cap, queue architecture, schema authority, or render-path forbidden APIs.

## Gate
Gate 6

## Dependencies
None - can start immediately.

## Notes
- Update `PROMETHEUS_BUILD.md` to `IN_PROGRESS` before starting.
- Do not change ticket status to `MERGED`; stop at `READY_FOR_REVIEW`.
- Preserve the v8.1 Determinism Contract and Prompt Governance Rules.
