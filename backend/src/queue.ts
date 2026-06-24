export class QueueBacklogLimitError extends Error {
  public constructor(maxPending: number) {
    super(`Queue backlog limit of ${maxPending} pending tasks exceeded.`);
    this.name = "QueueBacklogLimitError";
  }
}

// TODO: InProcessQueue is volatile process memory; migrate production render/job queues to Redis/BullMQ before multi-worker or crash-resumable operation.
export class InProcessQueue {
  private readonly concurrency: number;
  private readonly maxPending: number;
  private activeCount = 0;
  private readonly pending: Array<() => Promise<void>> = [];
  private idleResolvers: Array<() => void> = [];

  public constructor(concurrency = 1, maxPending = Number.POSITIVE_INFINITY) {
    this.concurrency = Math.max(1, concurrency);
    this.maxPending = Number.isFinite(maxPending)
      ? Math.max(0, Math.floor(maxPending))
      : Number.POSITIVE_INFINITY;
  }

  public enqueue(task: () => Promise<void>): void {
    if (this.pending.length >= this.maxPending) {
      throw new QueueBacklogLimitError(this.maxPending);
    }
    this.pending.push(task);
    this.drain();
  }

  public async onIdle(): Promise<void> {
    if (this.pending.length === 0 && this.activeCount === 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  private drain(): void {
    while (this.activeCount < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift();
      if (!task) {
        continue;
      }
      this.activeCount += 1;
      void task()
        .catch(() => {
          // Worker errors are handled by the job processor and persisted in job state.
        })
        .finally(() => {
          this.activeCount -= 1;
          this.drain();
          if (this.pending.length === 0 && this.activeCount === 0) {
            const resolvers = this.idleResolvers.splice(0);
            resolvers.forEach((resolve) => resolve());
          }
        });
    }
  }
}
