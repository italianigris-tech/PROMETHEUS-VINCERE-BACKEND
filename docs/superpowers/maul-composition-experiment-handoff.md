# MAUL Composition Experiment Handoff

**Updated:** 2026-08-07
**Worktree:** `/workspaces/PROMETHEUS-CORE-BACKEND-worktrees/maul-composition-experiment`
**Branch:** `feature/maul-composition-experiment`

## Progress

- **Scene A engineering experiment:** 95% complete.
- **Full first slice (Scene A review + Scene B held-out ablation):** about 70% complete.
- **Broader Q1/Yuan-quality program:** not estimated by this experiment; no parity claim is allowed.

## Completed

- Semantic Typography Tree -> planning -> Declared Composition -> existing manifest compiler -> canonical `MaulShort` render is connected.
- Scene A controlled overlap now preserves opportunity evidence through the placement hard gate.
- Static adjacent editorial beats compile as one continuous scene hold.
- Blocked placement fails before animation construction with its original reason.
- RGB and RGBA retained PNGs decode to normalized RGBA.
- Every baseline/repair condition renders twice through the same manifest and canonical renderer:
  - `creative`
  - `typography_suppressed`
- The observer compares timestamp-matched creative/control frames and records both hashes per measurement.
- Creative/control MP4s, frames, hashes, modes, ledger events, and trace paths are persisted.
- Blinded public review package contains no baseline/repair identity.
- Governing spec, plan, and `CONTEXT.md` include all acceptance-derived invariants.

## Real Scene A Evidence

Root: `artifacts/maul-composition-experiment/scene-a/`

- Trace: `trace.json`
- Public review: `review/public-package.json`
- Baseline: `baseline/render.mp4`
- Repair: `repair/render.mp4`
- Controls: `baseline/observation-control.mp4`, `repair/observation-control.mp4`
- Status: `pending_blinded_human_review`

Observed pixel results:

| Field | Baseline | Repair |
| --- | ---: | ---: |
| Text bounds | `(26,544)-(325,782)` | `(27,544)-(406,839)` |
| Observed lines | 2 | 3 |
| Hierarchy area ratio | 4.095832 | 4.272620 |
| Temporal stability | 0.973640 | 0.974158 |

Visual inspection: baseline visibly collides `IDEAS` and `MATTER`; repair separates the three roles and makes `MATTER` dominant. Do not record that inspection as the blinded preference result.

Fidelity is `partial` with no hard failures:

- Baseline: line-break mismatch, placement-bound mismatch, depth unobserved.
- Repair: placement-bound mismatch, depth unobserved.
- Font is independently inferred; treatment, motion, and subject intersection match.

## Verification

Passed:

- Focused backend: 58/58 tests.
- Observer/fidelity/runner follow-up: 6/6 tests.
- Focused Remotion: 42/42 tests.
- Shared types: 116/116 tests and typecheck.
- Backend typecheck.
- Remotion typecheck.
- Real Scene A preparation and visual/control inspection.

Full backend suite has one unrelated existing environment failure:

```text
src/__tests__/pipeline.integration.test.ts
renders the cinematic audio engine when a sound design manifest is supplied
spawn ffmpeg ENOENT
```

Repository-owned MAUL rendering uses the resolver successfully; do not widen this task into the separate cinematic-audio FFmpeg path unless explicitly authorized.

## Remaining

1. Commit the current Scene A runner/control/invariant changes.
2. Obtain and record a real blinded Scene A `a` / `b` / `tie` / `no_meaningful_preference` review.
3. Implement Task 10 in the execution plan: Scene B retrieval-disabled vs retrieval-enabled held-out ablation.
4. Run the final 14-question evidence audit after Scene B review.
5. Keep all Scene A evidence `experiment_only`; never promote one result to Pattern Memory.

## Important Worktree Note

`remotion-app/src/data/pattern-memory.generated.json` was mutated by the full Remotion test run (`generatedAt`, reuse count, notes, fingerprint). It is unrelated generated churn and must remain outside the feature commit unless separately reviewed.

## Governing Files

- `docs/superpowers/specs/2026-08-07-maul-reference-derived-composition-design.md`
- `docs/superpowers/plans/2026-08-07-maul-composition-experiment-runner.md`
- `CONTEXT.md`

## Next Command

After recording Scene A review, continue with Task 10 from the execution plan. Before any completion claim, rerun the focused backend/Remotion tests and both typechecks; report the unrelated full-suite FFmpeg failure separately.
