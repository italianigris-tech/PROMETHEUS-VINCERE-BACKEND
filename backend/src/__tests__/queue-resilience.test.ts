import {describe, expect, it} from "vitest";

import {InProcessQueue} from "../queue";

describe("InProcessQueue resilience", () => {
  it("rejects new work when the pending backlog exceeds the configured limit", async () => {
    const queue = new InProcessQueue(1, 1);
    let releaseFirstTask!: () => void;
    const firstTask = new Promise<void>((resolve) => {
      releaseFirstTask = resolve;
    });

    queue.enqueue(() => firstTask);
    queue.enqueue(async () => undefined);

    expect(() => queue.enqueue(async () => undefined)).toThrow(/queue backlog limit/i);

    releaseFirstTask();
    await queue.onIdle();
  });
});
