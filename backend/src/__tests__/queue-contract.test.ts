import {describe, expect, it} from "vitest";

import {InProcessQueue} from "../queue";

describe("JobQueue contract", () => {
  it("emits ordered lifecycle events and deduplicates idempotency keys", async () => {
    const queue = new InProcessQueue(1, 10);
    const events: string[] = [];
    queue.subscribe((event) => events.push(event.type));

    queue.enqueue(async () => undefined, {
      jobId: "job_contract_1",
      kind: "video-analysis",
      idempotencyKey: "source:1"
    });
    queue.enqueue(async () => {
      throw new Error("duplicate should not run");
    }, {
      jobId: "job_contract_2",
      kind: "video-analysis",
      idempotencyKey: "source:1"
    });

    await queue.onIdle();
    expect(events).toEqual(["queued", "active", "completed"]);
    expect(queue.getStatus("job_contract_1")).toBe("completed");
    expect(queue.getStatus("job_contract_2")).toBeUndefined();
  });

  it("records a bounded timeout as a failed lifecycle event", async () => {
    const queue = new InProcessQueue(1, 10, 10);
    const events: string[] = [];
    queue.subscribe((event) => events.push(event.type));
    queue.enqueue(() => new Promise<void>(() => undefined), {jobId: "job_timeout"});

    await queue.onIdle();
    expect(events).toEqual(["queued", "active", "failed"]);
    expect(queue.getStatus("job_timeout")).toBe("failed");
  });

  it("cancels pending work without running it", async () => {
    const queue = new InProcessQueue(1, 10);
    let release!: () => void;
    const first = new Promise<void>((resolve) => { release = resolve; });
    let secondRan = false;

    queue.enqueue(() => first, {jobId: "job_active"});
    queue.enqueue(async () => { secondRan = true; }, {jobId: "job_pending"});
    expect(await queue.cancel("job_pending")).toBe(true);
    release();
    await queue.onIdle();

    expect(secondRan).toBe(false);
    expect(queue.getStatus("job_pending")).toBe("cancelled");
  });
});
