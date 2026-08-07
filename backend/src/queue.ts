import {randomUUID} from "node:crypto";

import {
  asyncJobEnvelopeSchema,
  asyncJobEventSchema,
  type AsyncJobEnvelope,
  type AsyncJobEvent,
  type AsyncJobEventType,
  type AsyncJobStatus
} from "@prometheus/shared-types";

export class QueueBacklogLimitError extends Error {
  public constructor(maxPending: number) {
    super(`Queue backlog limit of ${maxPending} pending tasks exceeded.`);
    this.name = "QueueBacklogLimitError";
  }
}

export class QueueClosedError extends Error {
  public constructor() {
    super("The job queue is closed and cannot accept new work.");
    this.name = "QueueClosedError";
  }
}

export class QueueConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "QueueConfigurationError";
  }
}

export type QueueTask = () => Promise<void>;

export type QueueTaskOptions = {
  jobId?: string;
  kind?: string;
  correlationId?: string;
  idempotencyKey?: string;
  payload?: Record<string, unknown>;
  timeoutMs?: number;
};

export type QueueEventListener = (event: AsyncJobEvent) => void;
export type QueueEnvelopeHandler = (envelope: AsyncJobEnvelope) => Promise<void>;

export type JobQueue = {
  enqueue(task: QueueTask, options?: QueueTaskOptions): void | Promise<void>;
  enqueueEnvelope(envelope: AsyncJobEnvelope): void | Promise<void>;
  registerHandler(kind: string, handler: QueueEnvelopeHandler): void;
  cancel(jobId: string): Promise<boolean>;
  onIdle(): Promise<void>;
  close(graceMs?: number): Promise<void>;
  subscribe(listener: QueueEventListener): () => void;
  getStatus(jobId: string): AsyncJobStatus | undefined;
};

const nowIso = (): string => new Date().toISOString();

const buildEnvelope = (options: QueueTaskOptions = {}): AsyncJobEnvelope => asyncJobEnvelopeSchema.parse({
  jobId: options.jobId ?? `queue_${randomUUID()}`,
  kind: options.kind ?? "callback",
  correlationId: options.correlationId ?? randomUUID(),
  idempotencyKey: options.idempotencyKey ?? options.jobId ?? randomUUID(),
  requestedAt: nowIso(),
  attempt: 0,
  payload: options.payload ?? {}
});

const runWithTimeout = async (task: QueueTask, timeoutMs: number): Promise<void> => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    await task();
    return;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      task(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Queue task timed out after ${timeoutMs}ms.`)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

type PendingTask = {
  envelope: AsyncJobEnvelope;
  task: QueueTask;
  timeoutMs: number;
};

export class InProcessQueue implements JobQueue {
  private readonly concurrency: number;
  private readonly maxPending: number;
  private readonly timeoutMs: number;
  private activeCount = 0;
  private closed = false;
  private readonly pending: PendingTask[] = [];
  private readonly statuses = new Map<string, AsyncJobStatus>();
  private readonly idempotency = new Map<string, string>();
  private readonly handlers = new Map<string, QueueEnvelopeHandler>();
  private readonly listeners = new Set<QueueEventListener>();
  private idleResolvers: Array<() => void> = [];
  private sequence = 0;

  public constructor(concurrency = 1, maxPending = Number.POSITIVE_INFINITY, timeoutMs = 15 * 60 * 1000) {
    this.concurrency = Math.max(1, concurrency);
    this.maxPending = Number.isFinite(maxPending)
      ? Math.max(0, Math.floor(maxPending))
      : Number.POSITIVE_INFINITY;
    this.timeoutMs = timeoutMs;
  }

  public enqueue(task: QueueTask, options?: QueueTaskOptions): void;
  public enqueue(envelope: AsyncJobEnvelope, task: QueueTask): void;
  public enqueue(first: QueueTask | AsyncJobEnvelope, second: QueueTask | QueueTaskOptions = {}): void {
    if (this.closed) {
      throw new QueueClosedError();
    }

    const task = typeof first === "function" ? first : second as QueueTask;
    const envelope = typeof first === "function"
      ? buildEnvelope(second as QueueTaskOptions)
      : asyncJobEnvelopeSchema.parse(first);
    const options = typeof first === "function" ? second as QueueTaskOptions : {};
    if (typeof task !== "function") {
      throw new TypeError("Queue enqueue requires a task callback.");
    }

    const existingJobId = this.idempotency.get(envelope.idempotencyKey);
    if (existingJobId) {
      return;
    }
    if (this.pending.length >= this.maxPending) {
      throw new QueueBacklogLimitError(this.maxPending);
    }

    this.idempotency.set(envelope.idempotencyKey, envelope.jobId);
    this.statuses.set(envelope.jobId, "queued");
    this.pending.push({
      envelope,
      task,
      timeoutMs: options.timeoutMs ?? this.timeoutMs
    });
    this.emit(envelope, "queued", "queued");
    this.drain();
  }

  public async cancel(jobId: string): Promise<boolean> {
    const pendingIndex = this.pending.findIndex((entry) => entry.envelope.jobId === jobId);
    if (pendingIndex >= 0) {
      const [entry] = this.pending.splice(pendingIndex, 1);
      if (entry) {
        this.statuses.set(jobId, "cancelled");
        this.emit(entry.envelope, "cancelled", "cancelled");
        this.resolveIdleIfNeeded();
        return true;
      }
    }

    if (this.statuses.get(jobId) === "active") {
      this.statuses.set(jobId, "cancelled");
      return true;
    }
    return false;
  }

  public enqueueEnvelope(envelope: AsyncJobEnvelope): void {
    const parsed = asyncJobEnvelopeSchema.parse(envelope);
    const handler = this.handlers.get(parsed.kind);
    if (!handler) {
      throw new QueueConfigurationError(`No queue handler is registered for ${parsed.kind}.`);
    }
    this.enqueue(parsed, async () => handler(parsed));
  }

  public registerHandler(kind: string, handler: QueueEnvelopeHandler): void {
    if (!kind.trim()) {
      throw new QueueConfigurationError("Queue handler kind cannot be blank.");
    }
    this.handlers.set(kind, handler);
  }

  public async onIdle(): Promise<void> {
    if (this.pending.length === 0 && this.activeCount === 0) {
      return;
    }
    await new Promise<void>((resolve) => this.idleResolvers.push(resolve));
  }

  public async close(graceMs = 5000): Promise<void> {
    this.closed = true;
    const pending = this.pending.splice(0);
    pending.forEach((entry) => {
      this.statuses.set(entry.envelope.jobId, "cancelled");
      this.emit(entry.envelope, "cancelled", "cancelled");
    });
    await Promise.race([
      this.onIdle(),
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

  private drain(): void {
    while (this.activeCount < this.concurrency && this.pending.length > 0) {
      const entry = this.pending.shift();
      if (!entry) continue;
      this.activeCount += 1;
      this.statuses.set(entry.envelope.jobId, "active");
      this.emit(entry.envelope, "active", "active");
      void runWithTimeout(entry.task, entry.timeoutMs)
        .then(() => {
          if (this.statuses.get(entry.envelope.jobId) !== "cancelled") {
            this.statuses.set(entry.envelope.jobId, "completed");
            this.emit(entry.envelope, "completed", "completed", {progress: 100});
          }
        })
        .catch((error: unknown) => {
          if (this.statuses.get(entry.envelope.jobId) !== "cancelled") {
            const message = error instanceof Error ? error.message : String(error);
            this.statuses.set(entry.envelope.jobId, "failed");
            this.emit(entry.envelope, "failed", "failed", {}, message);
          }
        })
        .finally(() => {
          this.activeCount -= 1;
          this.drain();
          this.resolveIdleIfNeeded();
        });
    }
  }

  private resolveIdleIfNeeded(): void {
    if (this.pending.length !== 0 || this.activeCount !== 0) return;
    const resolvers = this.idleResolvers.splice(0);
    resolvers.forEach((resolve) => resolve());
  }

  private emit(
    envelope: AsyncJobEnvelope,
    type: AsyncJobEventType,
    status: AsyncJobStatus,
    data: Record<string, unknown> = {},
    error: string | null = null
  ): void {
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
