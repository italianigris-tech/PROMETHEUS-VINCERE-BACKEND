import {appendFile, mkdir, readFile, readdir, rename, unlink, writeFile} from "node:fs/promises";
import {createHash, randomBytes} from "node:crypto";
import path from "node:path";

import {
  maulOperationJobSchema,
  maulOperationJobSubmitSchema,
  maulOperationTelemetryEventSchema,
  type MaulOperationJob,
  type MaulOperationJobSubmit,
  type MaulOperationTelemetryEvent
} from "@prometheus/shared-types";

import type {MaulProjectService} from "./service.js";

export class MaulAuthorizationError extends Error {}
export class MaulQuotaError extends Error {}
export class MaulIdempotencyConflictError extends Error {}
export class MaulOperationConflictError extends Error {}

const createId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`;

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

const isMissing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const unlinkIfPresent = async (filePath: string): Promise<boolean> => {
  try {
    await unlink(filePath);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
};

const atomicJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  const tempPath = `${filePath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
};

class SerialLock {
  private current: Promise<void> = Promise.resolve();

  public async run<T>(action: () => Promise<T>): Promise<T> {
    const previous = this.current;
    let release = (): void => undefined;
    this.current = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await action();
    } finally {
      release();
    }
  }
}

export type MaulControlPolicy = {
  maxQueuedJobs: number;
  maxLeasedJobs: number;
  maxDailyJobs: number;
  maxMonthlySpendUsd: number;
  maxEstimatedCostPerJobUsd: number;
  retentionDays: number;
};

const DEFAULT_POLICY: MaulControlPolicy = {
  maxQueuedJobs: 10,
  maxLeasedJobs: 2,
  maxDailyJobs: 50,
  maxMonthlySpendUsd: 20,
  maxEstimatedCostPerJobUsd: 5,
  retentionDays: 30
};

export class MaulDurableControlPlane {
  private readonly lock = new SerialLock();

  public constructor(
    private readonly rootDir: string,
    private readonly projects: MaulProjectService,
    private readonly now: () => Date = () => new Date()
  ) {}

  private jobsDir(): string {
    return path.join(this.rootDir, "maul", "control-plane", "jobs");
  }

  private jobPath(jobId: string): string {
    return path.join(this.jobsDir(), `${jobId}.json`);
  }

  private telemetryPath(jobId: string): string {
    return path.join(this.rootDir, "maul", "control-plane", "telemetry", `${jobId}.ndjson`);
  }

  private idempotencyPath(tenantId: string, projectId: string, key: string): string {
    return path.join(
      this.rootDir,
      "maul",
      "control-plane",
      "idempotency",
      sha256(`${tenantId}:${projectId}:${key}`).slice(0, 32) + ".json"
    );
  }

  public async initialize(): Promise<void> {
    await mkdir(this.jobsDir(), {recursive: true});
  }

  public async authorizeProject(
    projectId: string,
    tenantId: string,
    creatorId: string
  ): Promise<void> {
    if (!tenantId.trim() || !creatorId.trim()) {
      throw new MaulAuthorizationError("MAUL tenant and creator headers are required.");
    }
    const {project} = await this.projects.getProject(projectId);
    if ((project.tenantId ?? project.creatorId) !== tenantId || project.creatorId !== creatorId) {
      throw new MaulAuthorizationError("The authenticated tenant/creator cannot access this MAUL project.");
    }
  }

  private async writeJob(job: MaulOperationJob): Promise<void> {
    await atomicJson(this.jobPath(job.id), maulOperationJobSchema.parse(job));
  }

  public async readJob(jobId: string): Promise<MaulOperationJob> {
    try {
      return maulOperationJobSchema.parse(JSON.parse(await readFile(this.jobPath(jobId), "utf8")));
    } catch (error) {
      if (isMissing(error)) {
        throw new MaulOperationConflictError(`MAUL operation job ${jobId} was not found.`);
      }
      throw error;
    }
  }

  private async listJobs(): Promise<MaulOperationJob[]> {
    const files = (await readdir(this.jobsDir(), {withFileTypes: true}))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name);
    return Promise.all(files.map(async (file) =>
      maulOperationJobSchema.parse(JSON.parse(await readFile(path.join(this.jobsDir(), file), "utf8")))
    ));
  }

  private async appendTelemetry(
    job: MaulOperationJob,
    type: MaulOperationTelemetryEvent["type"],
    detail: Record<string, unknown> = {}
  ): Promise<void> {
    const event = maulOperationTelemetryEventSchema.parse({
      schemaVersion: "maul-operation-telemetry/v1",
      eventId: createId("maul_telemetry"),
      jobId: job.id,
      projectId: job.projectId,
      tenantId: job.tenantId,
      type,
      attempt: job.attempts,
      detail,
      createdAt: this.now().toISOString()
    });
    const filePath = this.telemetryPath(job.id);
    await mkdir(path.dirname(filePath), {recursive: true});
    await appendFile(filePath, `${JSON.stringify(event)}\n`, "utf8");
  }

  public async readTelemetry(jobId: string): Promise<MaulOperationTelemetryEvent[]> {
    await this.readJob(jobId);
    try {
      return (await readFile(this.telemetryPath(jobId), "utf8"))
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => maulOperationTelemetryEventSchema.parse(JSON.parse(line)));
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
  }

  public async purgeExpiredTerminalJobs(
    retentionDays = DEFAULT_POLICY.retentionDays
  ): Promise<{retentionDays: number; removedJobs: number; removedTelemetryFiles: number}> {
    const boundedRetentionDays = Math.max(1, Math.min(3650, Math.floor(retentionDays)));
    return this.lock.run(async () => {
      const cutoff = this.now().getTime() - boundedRetentionDays * 24 * 60 * 60 * 1000;
      const expired = (await this.listJobs()).filter((job) =>
        ["completed", "failed", "cancelled"].includes(job.status)
        && Boolean(job.completedAt)
        && new Date(job.completedAt as string).getTime() <= cutoff
      );
      let removedTelemetryFiles = 0;
      for (const job of expired) {
        await unlinkIfPresent(this.jobPath(job.id));
        if (await unlinkIfPresent(this.telemetryPath(job.id))) {
          removedTelemetryFiles += 1;
        }
        await unlinkIfPresent(this.idempotencyPath(job.tenantId, job.projectId, job.idempotencyKey));
      }
      return {
        retentionDays: boundedRetentionDays,
        removedJobs: expired.length,
        removedTelemetryFiles
      };
    });
  }

  public async purgeProjectRecords(
    projectId: string
  ): Promise<{removedJobs: number; removedTelemetryFiles: number}> {
    return this.lock.run(async () => {
      const projectJobs = (await this.listJobs()).filter((job) => job.projectId === projectId);
      let removedTelemetryFiles = 0;
      for (const job of projectJobs) {
        await unlinkIfPresent(this.jobPath(job.id));
        if (await unlinkIfPresent(this.telemetryPath(job.id))) {
          removedTelemetryFiles += 1;
        }
        await unlinkIfPresent(this.idempotencyPath(job.tenantId, job.projectId, job.idempotencyKey));
      }
      return {removedJobs: projectJobs.length, removedTelemetryFiles};
    });
  }

  private assertWithinPolicy(
    request: MaulOperationJobSubmit,
    jobs: MaulOperationJob[],
    tenantId: string,
    policy = DEFAULT_POLICY
  ): void {
    const tenantJobs = jobs.filter((job) => job.tenantId === tenantId);
    const now = this.now();
    const dayPrefix = now.toISOString().slice(0, 10);
    const monthPrefix = now.toISOString().slice(0, 7);
    if (request.estimatedCostUsd > policy.maxEstimatedCostPerJobUsd) {
      throw new MaulQuotaError(
        `Estimated cost $${request.estimatedCostUsd} exceeds the per-job spend cap $${policy.maxEstimatedCostPerJobUsd}.`
      );
    }
    if (tenantJobs.filter((job) => job.status === "queued").length >= policy.maxQueuedJobs) {
      throw new MaulQuotaError("Tenant queued-job quota is exhausted.");
    }
    if (tenantJobs.filter((job) => job.createdAt.startsWith(dayPrefix)).length >= policy.maxDailyJobs) {
      throw new MaulQuotaError("Tenant daily-job quota is exhausted.");
    }
    const monthlyCommitted = tenantJobs
      .filter((job) => job.createdAt.startsWith(monthPrefix) && !["cancelled", "failed"].includes(job.status))
      .reduce((sum, job) => sum + (job.actualCostUsd ?? job.estimatedCostUsd), 0);
    if (monthlyCommitted + request.estimatedCostUsd > policy.maxMonthlySpendUsd) {
      throw new MaulQuotaError("Tenant monthly spend cap would be exceeded.");
    }
  }

  public async submit({
    projectId,
    tenantId,
    creatorId,
    idempotencyKey,
    input
  }: {
    projectId: string;
    tenantId: string;
    creatorId: string;
    idempotencyKey: string;
    input: unknown;
  }): Promise<{job: MaulOperationJob; duplicate: boolean}> {
    await this.authorizeProject(projectId, tenantId, creatorId);
    if (!idempotencyKey.trim()) {
      throw new MaulIdempotencyConflictError("Idempotency-Key is required for production MAUL jobs.");
    }
    const request = maulOperationJobSubmitSchema.parse(input);
    const payloadHash = sha256(JSON.stringify(request));
    return this.lock.run(async () => {
      const indexPath = this.idempotencyPath(tenantId, projectId, idempotencyKey);
      try {
        const index = JSON.parse(await readFile(indexPath, "utf8")) as {jobId?: string; payloadHash?: string};
        if (index.payloadHash !== payloadHash || !index.jobId) {
          throw new MaulIdempotencyConflictError(
            "Idempotency-Key was already used with a different operation payload."
          );
        }
        return {job: await this.readJob(index.jobId), duplicate: true};
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
      const jobs = await this.listJobs();
      this.assertWithinPolicy(request, jobs, tenantId);
      const timestamp = this.now().toISOString();
      const job = maulOperationJobSchema.parse({
        schemaVersion: "maul-operation-job/v1",
        id: createId("maul_operation"),
        projectId,
        tenantId,
        creatorId,
        idempotencyKey,
        payloadHash,
        operation: request.operation,
        payload: request.payload,
        status: "queued",
        attempts: 0,
        maxAttempts: request.maxAttempts,
        estimatedCostUsd: request.estimatedCostUsd,
        actualCostUsd: null,
        workerId: null,
        leaseToken: null,
        leaseExpiresAt: null,
        nextAttemptAt: timestamp,
        cancellationReason: null,
        result: null,
        error: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        completedAt: null
      });
      await this.writeJob(job);
      await atomicJson(indexPath, {jobId: job.id, payloadHash, createdAt: timestamp});
      await this.appendTelemetry(job, "queued", {operation: job.operation, estimatedCostUsd: job.estimatedCostUsd});
      return {job, duplicate: false};
    });
  }

  public async lease(workerId: string, leaseMs: number): Promise<MaulOperationJob | null> {
    if (!workerId.trim()) throw new Error("workerId is required.");
    const boundedLeaseMs = Math.max(5000, Math.min(5 * 60 * 1000, leaseMs));
    return this.lock.run(async () => {
      const jobs = await this.listJobs();
      const now = this.now();
      for (const job of jobs) {
        if (job.status === "leased" && job.leaseExpiresAt && new Date(job.leaseExpiresAt) <= now) {
          const recovered = maulOperationJobSchema.parse({
            ...job,
            status: "queued",
            workerId: null,
            leaseToken: null,
            leaseExpiresAt: null,
            nextAttemptAt: now.toISOString(),
            updatedAt: now.toISOString(),
            error: "Worker lease expired and was recovered."
          });
          await this.writeJob(recovered);
          await this.appendTelemetry(recovered, "lease_recovered", {});
          Object.assign(job, recovered);
        }
      }
      const leasedCountByTenant = new Map<string, number>();
      for (const job of jobs.filter((candidate) => candidate.status === "leased")) {
        leasedCountByTenant.set(job.tenantId, (leasedCountByTenant.get(job.tenantId) ?? 0) + 1);
      }
      const selected = jobs
        .filter((job) => job.status === "queued")
        .filter((job) => !job.nextAttemptAt || new Date(job.nextAttemptAt) <= now)
        .filter((job) => (leasedCountByTenant.get(job.tenantId) ?? 0) < DEFAULT_POLICY.maxLeasedJobs)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
      if (!selected) return null;
      const leased = maulOperationJobSchema.parse({
        ...selected,
        status: "leased",
        workerId,
        leaseToken: randomBytes(24).toString("hex"),
        leaseExpiresAt: new Date(now.getTime() + boundedLeaseMs).toISOString(),
        nextAttemptAt: null,
        updatedAt: now.toISOString()
      });
      await this.writeJob(leased);
      await this.appendTelemetry(leased, "leased", {workerId, leaseMs: boundedLeaseMs});
      return leased;
    });
  }

  private assertLease(job: MaulOperationJob, leaseToken: string): void {
    if (job.status !== "leased" || !job.leaseToken || job.leaseToken !== leaseToken) {
      throw new MaulOperationConflictError("A current matching worker lease is required.");
    }
    if (!job.leaseExpiresAt || new Date(job.leaseExpiresAt) <= this.now()) {
      throw new MaulOperationConflictError("The worker lease has expired.");
    }
  }

  public async fail(jobId: string, input: {
    leaseToken: string;
    error: string;
    retryable: boolean;
    retryAfterMs: number;
  }): Promise<MaulOperationJob> {
    return this.lock.run(async () => {
      const job = await this.readJob(jobId);
      this.assertLease(job, input.leaseToken);
      const attempts = job.attempts + 1;
      const retry = input.retryable && attempts < job.maxAttempts && job.status !== "cancellation_requested";
      const now = this.now();
      const next = maulOperationJobSchema.parse({
        ...job,
        status: retry ? "queued" : "failed",
        attempts,
        workerId: null,
        leaseToken: null,
        leaseExpiresAt: null,
        nextAttemptAt: retry
          ? new Date(now.getTime() + Math.max(0, Math.min(input.retryAfterMs, 60 * 60 * 1000))).toISOString()
          : null,
        error: input.error,
        updatedAt: now.toISOString(),
        completedAt: retry ? null : now.toISOString()
      });
      await this.writeJob(next);
      await this.appendTelemetry(next, retry ? "retry_scheduled" : "failed", {error: input.error});
      return next;
    });
  }

  public async complete(jobId: string, input: {
    leaseToken: string;
    result: Record<string, unknown>;
    actualCostUsd: number;
  }): Promise<MaulOperationJob> {
    return this.lock.run(async () => {
      const job = await this.readJob(jobId);
      this.assertLease(job, input.leaseToken);
      if (input.actualCostUsd < 0 || input.actualCostUsd > job.estimatedCostUsd * 1.25 + 0.01) {
        throw new MaulQuotaError("Actual job cost exceeds the bounded estimate tolerance.");
      }
      const timestamp = this.now().toISOString();
      const next = maulOperationJobSchema.parse({
        ...job,
        status: "completed",
        actualCostUsd: input.actualCostUsd,
        result: input.result,
        workerId: null,
        leaseToken: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
        error: null,
        updatedAt: timestamp,
        completedAt: timestamp
      });
      await this.writeJob(next);
      await this.appendTelemetry(next, "completed", {actualCostUsd: input.actualCostUsd});
      return next;
    });
  }

  public async cancel(jobId: string, reason: string): Promise<MaulOperationJob> {
    if (!reason.trim()) throw new Error("Cancellation reason is required.");
    return this.lock.run(async () => {
      const job = await this.readJob(jobId);
      if (["completed", "failed", "cancelled"].includes(job.status)) {
        throw new MaulOperationConflictError(`Cannot cancel a ${job.status} MAUL job.`);
      }
      const timestamp = this.now().toISOString();
      const status = job.status === "leased" ? "cancellation_requested" : "cancelled";
      const next = maulOperationJobSchema.parse({
        ...job,
        status,
        cancellationReason: reason,
        updatedAt: timestamp,
        completedAt: status === "cancelled" ? timestamp : null
      });
      await this.writeJob(next);
      await this.appendTelemetry(next, status === "cancelled" ? "cancelled" : "cancel_requested", {reason});
      return next;
    });
  }
}
