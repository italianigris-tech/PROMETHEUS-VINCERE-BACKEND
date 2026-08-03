# MAUL Worker Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute a governed MAUL 9:16 render from one leased durable job.

**Architecture:** Merge premium planning/render support. A small worker executor leases jobs from `MaulDurableControlPlane`, invokes existing `MaulProjectService` stages, creates explicit automation review, then completes or retries through the same control plane.

**Tech Stack:** TypeScript, Zod, Vitest, existing MAUL service/control plane.

---

### Task 1: Integrate premium short-form

**Files:** premium branch changes; merge commit on `main`.

- [ ] Merge `feature/maul-premium-short-form` into `main`.
- [ ] Run `npm --prefix backend test -- --runInBand` is invalid for Vitest; run `npm --prefix backend test` with existing thread pool instead.
- [ ] Commit merge only if Git does not create it automatically.

### Task 2: Define worker operation contract

**Files:**
- Modify: `packages/shared-types/src/maul.ts`
- Modify: `packages/shared-types/src/index.ts`
- Test: `packages/shared-types/src/maul.test.ts`

- [ ] Add failing Zod-contract test for `render_short` payload containing timeline request, treatment id, render audio input, and declared actual cost.
- [ ] Run `npm --prefix packages/shared-types test -- maul.test.ts`; expected failure: worker payload schema missing.
- [ ] Add exported payload schema and type. Reject unsupported operation payloads and automation-review impersonation.
- [ ] Re-run same test; expected pass.

### Task 3: Execute leased render workflow

**Files:**
- Create: `backend/src/maul/worker-executor.ts`
- Test: `backend/src/maul/worker-executor.test.ts`

- [ ] Add failing test: lease one `render_short` job; executor creates timeline, treatment, candidate, planning bundle, explicit `maul_worker_automation` approval, export, then marks job completed with stable artifact IDs.
- [ ] Run `npm --prefix backend test -- worker-executor.test.ts`; expected failure: module absent.
- [ ] Implement `runOnce`: lease, validate payload, call service stages in lineage order, complete with actual cost; catch errors and call `fail` with retryable false for validation/lineage errors and true otherwise.
- [ ] Re-run focused test; expected pass.

### Task 4: Prove durable failure path

**Files:** `backend/src/maul/worker-executor.test.ts`

- [ ] Add failing test: malformed render payload becomes a queued retry or terminal failure under existing attempt policy; it must not remain leased.
- [ ] Run focused test; expected failure before executor classification.
- [ ] Implement minimum error classification.
- [ ] Re-run focused test; expected pass.

### Task 5: Validate and publish

**Files:** changed files above.

- [ ] Run focused worker tests, MAUL render-path test, backend test suite, and backend typecheck.
- [ ] Inspect `git diff --check` and worktree status.
- [ ] Commit worker implementation and push `main`.
