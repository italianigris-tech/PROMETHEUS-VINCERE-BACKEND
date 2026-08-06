# Editorial Queue Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a typed, launch-safe queue abstraction with in-process and BullMQ/Redis adapters while preserving current backend and frontend job contracts.

**Architecture:** Keep repository/Supabase job state authoritative. Queue adapters only deliver work and lifecycle signals. Select the in-process adapter by default and BullMQ when explicitly configured with Redis.

**Tech Stack:** TypeScript, Fastify, Zod, Vitest, BullMQ, Redis.

---

### Task 1: Shared async job contracts

**Files:**
- Create: `packages/shared-types/src/async-jobs.ts`
- Modify: `packages/shared-types/src/index.ts`
- Test: `packages/shared-types/src/async-jobs.test.ts`

- [ ] Write schemas for job kinds, envelope, lifecycle event, and queue options. Reject blank ids, invalid progress, and unknown event types.
- [ ] Export inferred types and schemas from the package index.
- [ ] Add tests for valid parsing and invalid payload rejection.
- [ ] Run `npm --workspace @prometheus/shared-types run typecheck` and the focused Vitest test.

### Task 2: Queue port and in-process adapter

**Files:**
- Modify: `backend/src/queue.ts`
- Create: `backend/src/__tests__/queue-contract.test.ts`

- [ ] Define `JobQueue` with `enqueue`, `cancel`, `onIdle`, `close`, `subscribe`, and `getStatus`.
- [ ] Preserve `InProcessQueue.enqueue(callback)` as a compatibility overload while adding envelope-based enqueueing.
- [ ] Emit ordered lifecycle events, enforce backlog limits, deduplicate idempotency keys, and apply timeout/cancellation guards.
- [ ] Cover event order, duplicate submission, timeout, cancellation, and existing backlog behavior.

### Task 3: BullMQ adapter

**Files:**
- Create: `backend/src/bullmq-queue.ts`
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`
- Create: `backend/src/__tests__/bullmq-queue.test.ts`

- [ ] Add BullMQ dependency and isolate imports behind the adapter module.
- [ ] Implement Redis connection, queue creation, worker processing, retries/backoff, progress forwarding, stalled handling, and graceful close.
- [ ] Inject BullMQ constructors in tests so no Redis server is required.
- [ ] Verify malformed envelopes and unavailable Redis produce actionable errors.

### Task 4: Configuration and app selection

**Files:**
- Modify: `backend/src/config.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/service.ts`
- Modify: `backend/src/upload-routes.ts`
- Modify: `backend/src/video-context/service.ts`
- Create: `backend/src/__tests__/queue-config.test.ts`

- [ ] Add `JOB_QUEUE_DRIVER`, `REDIS_URL`, prefix, retry, backoff, timeout, and shutdown settings with local-safe defaults.
- [ ] Return `JobQueue` instead of `InProcessQueue` from app dependencies and select the adapter during startup.
- [ ] Preserve callback enqueue call sites and existing error/status behavior.
- [ ] Add configuration tests for default, BullMQ, and missing-Redis cases.

### Task 5: Verification and launch documentation

**Files:**
- Modify: `backend/.env.example`
- Modify: `backend/README.md`
- Create: `docs/architecture/editorial-queue-foundation.md`

- [ ] Document local versus production startup, Redis requirements, retry semantics, event consumers, and shutdown.
- [ ] Run shared-types typecheck, backend typecheck, focused queue tests, and the full backend test suite.
- [ ] Inspect the final diff for unrelated changes and report any residual BullMQ/Redis integration risk.
