# ISSUE 29: Multi-Orientation Contract Proposal

## Objective
Decide whether multi-orientation output belongs in v8.1 or must stay deferred, without silently overriding the locked `1080x1920 vertical` authority.

## Files You May Edit
- `specs/multi-orientation-contract-proposal.md`
- `PROMETHEUS_BUILD.md`

## Files You Must NOT Edit
- `specs/ARCHITECTURE_AUTHORITY.md`
- `remotion-app/src/compositions/JosephEdit.tsx`
- `backend/src/director/joseph-director.ts`
- `apps/worker/src/index.ts`

## Primary Approach
Write a human-gate proposal that explains the conflict between Opus's one-orientation-per-job recommendation and the locked v8.1 vertical output decision. Include the minimum future contract shape, migration risk, and exact authority changes that would be required if a human approves it.

## Fallback Approach (if primary fails after 2 hours)
Record a short deferral decision that preserves vertical-only v8.1 implementation and schedules multi-orientation as a post-MVP architecture review.

## Test Command
```bash
git diff --check specs/multi-orientation-contract-proposal.md PROMETHEUS_BUILD.md
```

## Success Criterion
The repo has a clear human-gate proposal or deferral record, and no source code treats landscape output as v8.1 authority.

## Gate
Human Gate

## Dependencies
None - blocked on human approval before implementation.

## Notes
- This is a HITL issue.
- Do not edit `specs/ARCHITECTURE_AUTHORITY.md` unless a human explicitly approves the authority change.
- Preserve vertical `1080x1920` as the working implementation contract until then.
