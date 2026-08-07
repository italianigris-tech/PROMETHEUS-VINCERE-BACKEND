import {describe, expect, it} from "vitest";

import {BullMqQueue} from "../bullmq-queue";
import {QueueConfigurationError} from "../queue";

describe("BullMqQueue configuration", () => {
  it("fails fast when Redis is not configured", () => {
    expect(() => new BullMqQueue({redisUrl: ""})).toThrow(QueueConfigurationError);
  });

  it("rejects non-Redis URLs before opening a connection", () => {
    expect(() => new BullMqQueue({redisUrl: "http://localhost:6379"})).toThrow(/redis/i);
  });
});
