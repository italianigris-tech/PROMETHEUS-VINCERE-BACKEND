import {randomUUID} from "node:crypto";

import {Queue, QueueEvents, Worker, type Job} from "bullmq";
import {
  asyncJobEnvelopeSchema,
  asyncJobEventSchema,
  type AsyncJobEnvelope,
  type AsyncJobEvent,
  type AsyncJobEventType,
  type AsyncJobStatus
} from "@prometheus/shared-types";

import {
  QueueBacklogLimitError,
  QueueClosedError,
  QueueConfigurationError,
  type JobQueue,
  type QueueEventListener,
  type QueueEnvelopeHandler,
  type QueueTask,
  type QueueTaskOptions
} from "./queue";

type BullMqJobData = {
  envelope: AsyncJobEnvelope;
  handlerId: string;
};

type BullMqQueueConfig = {
  redisUrl: string;
  prefix?: string;
  concurrency?: number;
  maxPending?: number;
  attempts?: number;
  backoffMs?: number;
  timeoutMs?: number;
};

const parseRedisConnection = (redisUrl: string): Record<string, unknown> => {
  let parsed: URL;
  try {
    parsed = new URL(redisUrl);
  } catch {
    throw new QueueConfigurationError("REDIS_URL must be a valid redis:// or rediss:// URL.");
  }
  if (!/^rediss?:$/i.test(parsed.protocol)) {
    throw new QueueConfigurationError("REDIS_URL must use the redis:// or rediss:// protocol.");
  }
  const connection: Record<string, unknown> = {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    db: parsed.pathname.replace(/^\//, "") ? Number(parsed.pathname.slice(1)) : undefined,
    username: parsed.username || undefined,
    password: parsed.password || undefined
  };
  if (parsed.protocol === "rediss:") {
    connection.tls = {};
  }
  return connection;
};

const nowIso = (): string => new Date().toISOString();

const runWithTimeout = async (task: QueueTask, timeoutMs: number): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      task(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Queue task timed out after ${timeoutMs}ms.`)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * BullMQ delivery with a local handler registry. The registry allows current
 * callback-based call sites to migrate incrementally. Serializable handlers
 * should use `enqueueEnvelope` and `registerHandler` so another worker can
 * resume them after a process restart.
 */
export class BullMqQueue implements JobQueue {
  private readonly queueName: string;
  private readonly queue: Queue<BullMqJobData>;
  private readonly worker: Worker<BullMqJobData>;
  private readonly queueEvents: QueueEvents;
  private readonly maxPending: number;
  private readonly attempts: number;
  private readonly backoffMs: number;
  private readonly timeoutMs: number;
  private readonly statuses = new Map<string, AsyncJobStatus>();
  private readonly callbackHandlers = new Map<string, QueueTask>();
  private readonly handlers = new Map<string, QueueEnvelopeHandler>();
  private readonly idempotency = new Map<string, string>();
  private readonly listeners = new Set<QueueEventListener>();
  private idleResolvers: Array<() => void> = [];
  private outstandingCount = 0;
  private sequence = 0;
  private closed = false;
  private started = false;

  public constructor(config: BullMqQueueConfig) {
    if (!config.redisUrl.trim()) {
      throw new QueueConfigurationError("BullMQ requires REDIS_URL to be configured.");
    }
    const connection = parseRedisConnection(config.redisUrl);
    this.queueName = `${config.prefix ?? "prometheus"}:editorial-jobs`;
    this.maxPending = Math.max(0, Math.floor(config.maxPending ?? 250));
    this.attempts = Math.max(1, Math.floor(config.attempts ?? 3));
    this.backoffMs = Math.max(0, Math.floor(config.backoffMs ?? 1000));
    this.timeoutMs = Math.max(1, Math.floor(config.timeoutMs ?? 15 * 60 * 1000));
    this.queue = new Queue<BullMqJobData>(this.queueName, {connection});
    this.worker = new Worker<BullMqJobData>(
      this.queueName,
      async (job) => {
        const handler = job.data.handlerId
          ? this.callbackHandlers.get(job.data.handlerId)
          : this.handlers.get(job.data.envelope.kind);
        if (!handler) {
          throw new QueueConfigurationError(
            `No local handler is registered for BullMQ job ${job.id}. Use enqueueEnvelope for restart-safe work.`
          );
        }
        await runWithTimeout(
          job.data.handlerId ? handler as QueueTask : () => (handler as QueueEnvelopeHandler)(job.data.envelope),
          this.timeoutMs
        );
      },
      {connection, concurrency: Math.max(1, Math.floor(config.concurrency ?? 1)), autorun: false}
    );
    this.queueEvents = new QueueEvents(this.queueName, {connection});
    this.bindEvents();
  }

  public async ready(): Promise<void> {
    try {
      await Promise.all([
        this.queue.waitUntilReady(),
        this.worker.waitUntilReady(),
        this.queueEvents.waitUntilReady()
      ]);
    } catch (error) {
      await this.close(0);
      throw new QueueConfigurationError(`BullMQ Redis connection is unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public start(): void {
    if (this.started || this.closed) return;
    this.started = true;
    void this.worker.run().catch((error) => {
      console.error(`[queue] BullMQ worker failed to start: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  public enqueue(task: QueueTask, options?: QueueTaskOptions): Promise<void>;
  public enqueue(envelope: AsyncJobEnvelope, task: QueueTask): Promise<void>;
  public async enqueue(first: QueueTask | AsyncJobEnvelope, second: QueueTask | QueueTaskOptions = {}): Promise<void> {
    const task = typeof first === "function" ? first : second as QueueTask;
    const options = typeof first === "function" ? second as QueueTaskOptions : {};
    const envelope = typeof first === "function"
      ? asyncJobEnvelopeSchema.parse({
        jobId: options.jobId ?? `queue_${randomUUID()}`,
        kind: options.kind ?? "callback",
        correlationId: options.correlationId ?? randomUUID(),
        idempotencyKey: options.idempotencyKey ?? options.jobId ?? randomUUID(),
        requestedAt: nowIso(),
        attempt: 0,
        payload: options.payload ?? {}
      })
      : asyncJobEnvelopeSchema.parse(first);
    if (this.closed) throw new QueueClosedError();
    if (typeof task !== "function") throw new TypeError("Queue enqueue requires a task callback.");
    if (this.idempotency.has(envelope.idempotencyKey)) return;
    if (this.outstandingCount >= this.maxPending) {
      throw new QueueBacklogLimitError(this.maxPending);
    }

    const handlerId = randomUUID();
    this.callbackHandlers.set(handlerId, task);
    this.idempotency.set(envelope.idempotencyKey, envelope.jobId);
    this.statuses.set(envelope.jobId, "queued");
    this.outstandingCount += 1;
    this.emit(envelope, "queued", "queued");
    try {
      await this.queue.add(envelope.jobId, {envelope, handlerId}, {
        jobId: envelope.jobId,
        attempts: this.attempts,
        backoff: {type: "exponential", delay: this.backoffMs},
        removeOnComplete: {age: 60 * 60, count: 1000},
        removeOnFail: {age: 24 * 60 * 60, count: 5000}
      });
    } catch (error) {
      this.callbackHandlers.delete(handlerId);
      this.idempotency.delete(envelope.idempotencyKey);
      this.statuses.delete(envelope.jobId);
      this.outstandingCount -= 1;
      throw new QueueConfigurationError(`BullMQ could not enqueue ${envelope.jobId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async enqueueEnvelope(envelope: AsyncJobEnvelope): Promise<void> {
    const parsed = asyncJobEnvelopeSchema.parse(envelope);
    if (this.closed) throw new QueueClosedError();
    if (!this.handlers.has(parsed.kind)) {
      throw new QueueConfigurationError(`No queue handler is registered for ${parsed.kind}.`);
    }
    if (this.idempotency.has(parsed.idempotencyKey)) return;
    if (this.outstandingCount >= this.maxPending) {
      throw new QueueBacklogLimitError(this.maxPending);
    }
    this.idempotency.set(parsed.idempotencyKey, parsed.jobId);
    this.statuses.set(parsed.jobId, "queued");
    this.outstandingCount += 1;
    this.emit(parsed, "queued", "queued");
    try {
      await this.queue.add(parsed.jobId, {envelope: parsed, handlerId: ""}, {
        jobId: parsed.jobId,
        attempts: this.attempts,
        backoff: {type: "exponential", delay: this.backoffMs},
        removeOnComplete: {age: 60 * 60, count: 1000},
        removeOnFail: {age: 24 * 60 * 60, count: 5000}
      });
    } catch (error) {
      this.idempotency.delete(parsed.idempotencyKey);
      this.statuses.delete(parsed.jobId);
      this.outstandingCount -= 1;
      throw new QueueConfigurationError(`BullMQ could not enqueue ${parsed.jobId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public registerHandler(kind: string, handler: QueueEnvelopeHandler): void {
    if (!kind.trim()) {
      throw new QueueConfigurationError("Queue handler kind cannot be blank.");
    }
    this.handlers.set(kind, handler);
  }

  public async cancel(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job) return false;
    try {
      await job.remove();
      this.statuses.set(jobId, "cancelled");
      this.emitForJob(job, "cancelled", "cancelled");
      return true;
    } catch {
      return false;
    }
  }

  public async onIdle(): Promise<void> {
    if (this.outstandingCount === 0) return;
    await new Promise<void>((resolve) => this.idleResolvers.push(resolve));
  }

  public async close(graceMs = 30000): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const closePromise = Promise.allSettled([
      this.worker.close(),
      this.queueEvents.close(),
      this.queue.close()
    ]).then(() => undefined);
    await Promise.race([
      closePromise,
      new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, graceMs)))
    ]);
    this.listeners.clear();
  }

  public subscribe(listener: QueueEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getStatus(jobId: string): AsyncJobStatus | undefined {
    return this.statuses.get(jobId);
  }

  private bindEvents(): void {
    this.worker.on("error", (error) => {
      console.error(`[queue] BullMQ worker error: ${error instanceof Error ? error.message : String(error)}`);
    });
    this.queueEvents.on("error", (error) => {
      console.error(`[queue] BullMQ event stream error: ${error instanceof Error ? error.message : String(error)}`);
    });
    this.worker.on("active", (job) => this.emitForJob(job, "active", "active"));
    this.worker.on("progress", (job, progress) => this.emitForJob(job, "progress", "active", {
      progress: typeof progress === "number" ? progress : undefined
    }));
    this.worker.on("completed", (job) => this.finish(job, "completed", "completed", {progress: 100}));
    this.worker.on("failed", (job, error) => {
      if (!job) return;
      const finalAttempt = job.attemptsMade >= this.attempts;
      if (finalAttempt) {
        this.finish(job, "failed", "failed", {}, error?.message ?? "BullMQ job failed", true);
      }
    });
    this.queueEvents.on("stalled", ({jobId}) => {
      const status = this.statuses.get(jobId);
      if (status && status !== "completed" && status !== "failed") {
        this.statuses.set(jobId, "stalled");
        const job = {id: jobId, data: {envelope: {jobId, kind: "unknown", attempt: 0} as AsyncJobEnvelope}} as Job<BullMqJobData>;
        this.emitForJob(job, "stalled", "stalled");
      }
    });
  }

  private finish(job: Job<BullMqJobData>, type: "completed" | "failed", status: AsyncJobStatus, data: Record<string, unknown>, error?: string, final = false): void {
    const envelope = job.data.envelope;
    this.statuses.set(envelope.jobId, status);
    this.emit(envelope, type, status, data, error ?? null);
    if (final || type === "completed") {
      this.outstandingCount = Math.max(0, this.outstandingCount - 1);
      if (job.data.handlerId) this.callbackHandlers.delete(job.data.handlerId);
      this.resolveIdleIfNeeded();
    }
  }

  private emitForJob(job: Job<BullMqJobData>, type: AsyncJobEventType, status: AsyncJobStatus, data: Record<string, unknown> = {}): void {
    const envelope = job.data.envelope;
    this.statuses.set(envelope.jobId, status);
    this.emit(envelope, type, status, data);
  }

  private resolveIdleIfNeeded(): void {
    if (this.outstandingCount !== 0) return;
    const resolvers = this.idleResolvers.splice(0);
    resolvers.forEach((resolve) => resolve());
  }

  private emit(envelope: AsyncJobEnvelope, type: AsyncJobEventType, status: AsyncJobStatus, data: Record<string, unknown> = {}, error: string | null = null): void {
    const event = asyncJobEventSchema.parse({
      schemaVersion: "prometheus-async-job-event/v1",
      id: `queue_event_${randomUUID()}`,
      sequence: this.sequence++,
      type,
      status,
      jobId: envelope.jobId,
      kind: envelope.kind,
      attempt: envelope.attempt,
      timestamp: nowIso(),
      progress: typeof data.progress === "number" ? data.progress : null,
      data,
      error
    });
    this.listeners.forEach((listener) => listener(event));
  }
}

export type {BullMqQueueConfig};
