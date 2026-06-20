# ISSUE 32: Failure Taxonomy Doc Note

## Objective
Document the first 34 Prometheus v8.1 failure nodes and map each to Review Surface acceptance criteria.

## Files Added
- `FAILURE_TAXONOMY.md`
- `.agents/tickets/ISSUE_32_failure_taxonomy.md`

## Notes
- The referenced `PROMETHEUS_v8.1_ARCHITECTURE.pdf` is not present in this worktree, so the taxonomy is reconstructed from local authority, PRD, tracker, and docs evidence.
- This issue note is additive and does not replace `ISSUE_32_failure_taxonomy_judgment_rubric.md`, which still covers future executable Judgment Rubric work.
- Status should stop at READY_FOR_REVIEW until a human verifies the reconstructed list against the locked PDF.

## Acceptance Criteria
- [ ] `FAILURE_TAXONOMY.md` contains FT-001 through FT-034.
- [ ] Each failure has severity, problem, mitigation, phase, and owner.
- [ ] Review Surface maps every FT to measurable acceptance criteria.