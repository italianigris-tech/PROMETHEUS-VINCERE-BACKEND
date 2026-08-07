import {afterEach, describe, expect, it} from "vitest";

import {clearCachedEnv, loadEnv} from "../config";
import {createBackendApp} from "../app";

afterEach(() => clearCachedEnv());

describe("queue configuration", () => {
  it("defaults to the local queue for development", () => {
    const env = loadEnv({JOB_QUEUE_DRIVER: undefined, REDIS_URL: undefined});
    expect(env.JOB_QUEUE_DRIVER).toBe("in_process");
    expect(env.JOB_QUEUE_PREFIX).toBe("prometheus");
  });

  it("parses the production BullMQ settings", () => {
    const env = loadEnv({
      JOB_QUEUE_DRIVER: "bullmq",
      REDIS_URL: "redis://localhost:6379/2",
      JOB_QUEUE_ATTEMPTS: "5",
      JOB_QUEUE_BACKOFF_MS: "2500"
    });
    expect(env.JOB_QUEUE_DRIVER).toBe("bullmq");
    expect(env.REDIS_URL).toBe("redis://localhost:6379/2");
    expect(env.JOB_QUEUE_ATTEMPTS).toBe(5);
    expect(env.JOB_QUEUE_BACKOFF_MS).toBe(2500);
  });

  it("fails backend startup before worker services when BullMQ has no Redis URL", async () => {
    await expect(createBackendApp({
      envOverrides: {
        JOB_QUEUE_DRIVER: "bullmq",
        REDIS_URL: "",
        STORAGE_DIR: "./tmp/queue-config-test"
      }
    })).rejects.toThrow(/requires REDIS_URL/i);
  });
});
