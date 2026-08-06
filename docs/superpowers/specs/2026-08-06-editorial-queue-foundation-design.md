# Editorial Queue Foundation Design

## Goal

Provide a launch-safe asynchronous task foundation for Prometheus editorial jobs. Existing REST, SSE, WebSocket, and frontend Supabase consumers must keep their current contracts while work can run in-process locally or through BullMQ and Redis in production.

## Architecture

The queue is an execution adapter, not the source of truth. A typed queue port accepts a stable job envelope and emits lifecycle events. `InProcessQueue` remains the local/test adapter. `BullMqQueue` is selected explicitly with `JOB_QUEUE_DRIVER=bullmq` and a Redis URL, and uses BullMQ for delivery, retries, backoff, concurrency, and stalled-job recovery. Job state and artifacts continue to be persisted by the existing repository and telemetry layers.

Every queued task carries a job id, kind, correlation id, idempotency key, attempt metadata, and an opaque payload. Queue adapters must reject a bounded backlog, expose idle/drain behavior for tests, and make cancellation explicit. BullMQ failures are surfaced as retryable infrastructure errors; they must never mark a persisted job complete or failed without the coordinator doing so.

## Configuration

Add queue mode (`in_process` or `bullmq`), Redis URL, queue prefix, worker concurrency, pending limit, retry count, backoff, and per-task timeout to `BackendEnv`. Defaults preserve current local behavior. Production mode requires a Redis URL and fails during startup with an actionable message when the BullMQ adapter cannot initialize.

## Event Contract

Add a shared `AsyncJobEnvelope` and `AsyncJobEvent` schema in `packages/shared-types`. Event types are `queued`, `active`, `progress`, `completed`, `failed`, `cancelled`, and `stalled`. Events include a monotonically increasing sequence (adapter-local for now), ISO timestamp, job id, kind, attempt, optional progress, and structured data. Consumers can replay from the existing job telemetry layer without depending on Redis.

## Compatibility and Failure Handling

Existing callers may continue to enqueue callback functions through a compatibility method while migrating to envelopes. Queue backlog limits return the existing 503 path. Duplicate idempotency keys return the original queue job id. Retries are bounded and use exponential backoff with jitter. Cancellation is best effort for active work and definitive for pending work. Shutdown closes BullMQ connections after draining or a bounded grace period.

## Testing

Unit tests cover envelope validation, in-process lifecycle events, idempotency, timeout and cancellation behavior, and configuration selection. BullMQ tests use dependency injection and a fake queue client; no Redis server is required. Existing backend test suites must continue to pass unchanged.
