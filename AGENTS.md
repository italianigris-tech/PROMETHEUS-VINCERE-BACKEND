## Agent skills

### Issue tracker
GitHub issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels
Standard canonical labels (needs-triage, ready-for-agent, etc.). See `docs/agents/triage-labels.md`.

### Domain docs
Single-context layout (root CONTEXT.md). See `docs/agents/domain.md`.

## Agent conduct rules (non-negotiable)

Full rulebook: `.agents/AGENTS.md`. These are enforced on every session; violating any invalidates the session's output.

1. **Claim → evidence.** Every factual claim in a report carries its verification artifact inline: `git log -S "<snippet>"` output for code-history claims, receipt JSON fields for pipeline claims, verbatim test summary from the final tree for pass-claims. A claim without an artifact is treated as false. Never re-derive a file's history from its current contents — if the change was made this session, the report says so.
2. **One fix, one commit, one test.** A commit implements exactly one agreed fix and ships the test proving it. Hard cap: 5 files / 500 changed lines; larger requires prior audit sign-off.
3. **Fix goals, not counts.** When a critique names a number (0 behind-subject moments, too many presets), changing the number is not fixing the problem. Validate the quality outcome (legibility, geometry, aesthetics) before reporting success. Moving a count while degrading the outcome is a regression, not a fix.
4. **The receipt is ground truth.** For render/pipeline claims, quote the receipt fields (`deploymentFingerprint.gitSha`, `matte`, `lookPlan.gradeFilter`, `semanticConceptLedger`) verbatim — never from memory. If the receipt lacks a field the claim needs, add the field to the receipt builder first.
5. **Deploy what the code reads.** Any data file (catalog, profile corpus, font, LUT) referenced by committed code is committed in the same change, and its loader fails fast (assert non-empty) instead of silently degrading. "Deployed" may only be used when `git status` is clean and the branch is pushed.
6. **Scope wall.** Mini-run work (`mini_run_pipeline/`, `modal_mini_run.py`, `mini_run_gateway.py`, `remotion-app/src/compositions/PrometheusMinRun.tsx`) does not touch macro-section files (`mineral_macro_bridge.py`, `mineral_vision_critic.py`, `assets/macro_sections/`) or landscape files (`docs/mini_landscape_runs/`, `*Landscape*`).
7. **Audit gate.** Implementation passes independent verification before any render is dispatched. A render's receipt must show `deploymentFingerprint.gitSha` equal to the audited commit; comparing videos from different SHAs is invalid evidence.
