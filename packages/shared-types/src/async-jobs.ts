import {z} from "zod";

export const asyncJobKindSchema = z.string().trim().min(1).max(120);
export const asyncJobStatusSchema = z.enum([
  "queued",
  "active",
  "completed",
  "failed",
  "cancelled",
  "stalled"
]);

export const asyncJobEnvelopeSchema = z.object({
  jobId: z.string().trim().min(1).max(256),
  kind: asyncJobKindSchema,
  correlationId: z.string().trim().min(1).max(256),
  idempotencyKey: z.string().trim().min(1).max(512),
  requestedAt: z.string().datetime({offset: true}),
  attempt: z.number().int().nonnegative().default(0),
  payload: z.record(z.string(), z.unknown()).default({})
});

export const asyncJobEventTypeSchema = z.enum([
  "queued",
  "active",
  "progress",
  "completed",
  "failed",
  "cancelled",
  "stalled"
]);

export const asyncJobEventSchema = z.object({
  schemaVersion: z.literal("prometheus-async-job-event/v1"),
  id: z.string().trim().min(1),
  sequence: z.number().int().nonnegative(),
  type: asyncJobEventTypeSchema,
  status: asyncJobStatusSchema,
  jobId: z.string().trim().min(1),
  kind: asyncJobKindSchema,
  attempt: z.number().int().nonnegative(),
  timestamp: z.string().datetime({offset: true}),
  progress: z.number().min(0).max(100).nullable().default(null),
  data: z.record(z.string(), z.unknown()).default({}),
  error: z.string().nullable().default(null)
});

export const asyncJobQueueOptionsSchema = z.object({
  driver: z.enum(["in_process", "bullmq"]).default("in_process"),
  redisUrl: z.string().url().nullable().default(null),
  prefix: z.string().trim().min(1).max(120).default("prometheus"),
  concurrency: z.number().int().positive().default(1),
  maxPending: z.number().int().nonnegative().default(250),
  attempts: z.number().int().positive().default(3),
  backoffMs: z.number().int().nonnegative().default(1000),
  timeoutMs: z.number().int().positive().default(15 * 60 * 1000)
});

export type AsyncJobKind = z.infer<typeof asyncJobKindSchema>;
export type AsyncJobStatus = z.infer<typeof asyncJobStatusSchema>;
export type AsyncJobEnvelope = z.infer<typeof asyncJobEnvelopeSchema>;
export type AsyncJobEventType = z.infer<typeof asyncJobEventTypeSchema>;
export type AsyncJobEvent = z.infer<typeof asyncJobEventSchema>;
export type AsyncJobQueueOptions = z.infer<typeof asyncJobQueueOptionsSchema>;
