# Editorial Queue Foundation

The backend exposes one queue contract to job-producing services. Local development and tests use `InProcessQueue`; staging and production select `BullMqQueue` with `JOB_QUEUE_DRIVER=bullmq` and a `REDIS_URL`.

Redis is a delivery mechanism, not the authoritative job database. Job records, artifacts, and the existing execution telemetry replay buffer remain authoritative for REST, SSE, WebSocket, and the Prometheus frontend. Queue lifecycle events are observable through the queue subscription and can be bridged into telemetry without coupling clients to BullMQ.

## Restart-safe handlers

New work should use a named envelope handler:

```ts
queue.registerHandler("video-analysis", async (envelope) => {
  const input = videoAnalysisInputSchema.parse(envelope.payload);
  await runVideoAnalysis(input);
});

await queue.enqueueEnvelope({
  jobId: "analysis_123",
  kind: "video-analysis",
  correlationId: "video_123",
  idempotencyKey: "source_asset_123:analysis:v1",
  requestedAt: new Date().toISOString(),
  attempt: 0,
  payload: {videoId: "video_123"}
});
```

Named handlers are registered when each backend process starts, so a BullMQ worker can resume a waiting job after a process restart. Callback enqueueing remains available for local compatibility and should be treated as process-local work.

## Production settings

```dotenv
JOB_QUEUE_DRIVER=bullmq
REDIS_URL=rediss://user:password@redis.example.com:6380/0
JOB_QUEUE_PREFIX=prometheus-prod
JOB_QUEUE_CONCURRENCY=4
JOB_QUEUE_MAX_PENDING=250
JOB_QUEUE_ATTEMPTS=3
JOB_QUEUE_BACKOFF_MS=1000
JOB_QUEUE_TIMEOUT_MS=900000
```

The backend fails fast when BullMQ is selected without a valid Redis URL. Queue admission failures map to HTTP 503 so clients can retry with the same idempotency key. Retries use exponential backoff; a final failure is emitted only after the configured attempt limit. Shutdown closes workers and Redis connections through Fastify's `onClose` hook.

## Frontend mapping

The existing frontend can continue polling or subscribing to Supabase `durable_jobs` and the backend `/api/jobs/:id/events` route. No BullMQ identifiers are exposed to the browser. The next analysis slice will map metric artifacts and Jarvis responses onto these same job and event contracts.
