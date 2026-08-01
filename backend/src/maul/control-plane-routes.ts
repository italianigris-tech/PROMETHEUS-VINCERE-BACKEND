import type {FastifyInstance, FastifyRequest} from "fastify";
import {z} from "zod";
import {maulFeedbackRequestSchema, maulOutcomeRequestSchema} from "@prometheus/shared-types";

import {
  MaulAuthorizationError,
  MaulDurableControlPlane,
  MaulIdempotencyConflictError,
  MaulOperationConflictError,
  MaulQuotaError
} from "./control-plane.js";
import type {MaulProjectService} from "./service.js";
import {MaulLineageConflictError, MaulProjectNotFoundError} from "./service.js";
import type {MaulLearningStore} from "./learning.js";

const tenantIdentity = (req: FastifyRequest): {tenantId: string; creatorId: string} => ({
  tenantId: String(req.headers["x-maul-tenant-id"] ?? "").trim(),
  creatorId: String(req.headers["x-maul-creator-id"] ?? "").trim()
});

const statusFor = (error: unknown): number => {
  if (error instanceof MaulAuthorizationError) return 403;
  if (error instanceof MaulProjectNotFoundError) return 404;
  if (error instanceof MaulLineageConflictError) return 409;
  if (error instanceof MaulQuotaError) return 429;
  if (error instanceof MaulIdempotencyConflictError || error instanceof MaulOperationConflictError) return 409;
  if (error instanceof z.ZodError) return 400;
  return 400;
};

const errorBody = (error: unknown) => ({
  error: error instanceof z.ZodError
    ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
    : error instanceof Error ? error.message : String(error)
});

const leaseSchema = z.object({
  workerId: z.string().trim().min(1),
  leaseMs: z.number().int().min(5000).max(300000).optional().default(60000)
});

const failSchema = z.object({
  leaseToken: z.string().trim().min(1),
  error: z.string().trim().min(1),
  retryable: z.boolean(),
  retryAfterMs: z.number().int().min(0).max(3600000).optional().default(1000)
});

const completeSchema = z.object({
  leaseToken: z.string().trim().min(1),
  result: z.record(z.string(), z.unknown()),
  actualCostUsd: z.number().nonnegative()
});

const cancelSchema = z.object({reason: z.string().trim().min(1)});
const deleteProjectSchema = z.object({
  confirmProjectId: z.string().trim().min(1),
  reason: z.string().trim().min(1)
});
const retentionSchema = z.object({
  retentionDays: z.number().int().min(1).max(3650).optional()
});

export const registerMaulControlPlaneRoutes = (
  app: FastifyInstance,
  control: MaulDurableControlPlane,
  workerToken: string,
  projects: MaulProjectService,
  learning: MaulLearningStore
): void => {
  const assertWorker = (req: FastifyRequest): void => {
    const supplied = String(req.headers["x-maul-worker-token"] ?? "");
    if (!workerToken || supplied !== workerToken) {
      throw new MaulAuthorizationError("A valid MAUL worker token is required.");
    }
  };

  const requiredIdentity = (req: FastifyRequest): {tenantId: string; creatorId: string} => {
    const identity = tenantIdentity(req);
    if (!identity.tenantId || !identity.creatorId) {
      throw new MaulAuthorizationError("MAUL tenant and creator headers are required.");
    }
    return identity;
  };

  app.post("/api/maul/v1/projects", async (req, reply) => {
    try {
      const identity = requiredIdentity(req);
      const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body as Record<string, unknown>
        : {};
      if (
        (typeof body.tenantId === "string" && body.tenantId !== identity.tenantId)
        || (typeof body.creatorId === "string" && body.creatorId !== identity.creatorId)
      ) {
        throw new MaulAuthorizationError("Project identity must match the authenticated tenant and creator.");
      }
      const result = await projects.createProject({
        ...body,
        tenantId: identity.tenantId,
        creatorId: identity.creatorId
      });
      reply.code(201);
      return {
        ...result,
        urls: {
          project: `/api/maul/v1/projects/${result.project.id}`,
          audit: `/api/maul/v1/projects/${result.project.id}/audit`,
          jobs: `/api/maul/v1/projects/${result.project.id}/jobs`
        }
      };
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.get("/api/maul/v1/projects/:projectId", async (req, reply) => {
    try {
      const {projectId} = req.params as {projectId: string};
      const identity = requiredIdentity(req);
      await control.authorizeProject(projectId, identity.tenantId, identity.creatorId);
      return await projects.getProject(projectId);
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.get("/api/maul/v1/projects/:projectId/audit", async (req, reply) => {
    try {
      const {projectId} = req.params as {projectId: string};
      const identity = requiredIdentity(req);
      await control.authorizeProject(projectId, identity.tenantId, identity.creatorId);
      return await projects.getAudit(projectId);
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.get("/api/maul/v1/projects/:projectId/references/:artifactId/source", async (req, reply) => {
    try {
      const {projectId, artifactId} = req.params as {projectId: string; artifactId: string};
      const identity = requiredIdentity(req);
      await control.authorizeProject(projectId, identity.tenantId, identity.creatorId);
      const source = await projects.getReferenceSource(projectId, artifactId);
      reply.header("Content-Type", source.contentType);
      reply.header("Content-Length", String(source.sizeBytes));
      reply.header("Content-Disposition", `inline; filename="${source.originalFilename.replace(/"/g, "")}"`);
      return reply.send(source.bytes);
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.get("/api/maul/v1/projects/:projectId/exports/:artifactId/file", async (req, reply) => {
    try {
      const {projectId, artifactId} = req.params as {projectId: string; artifactId: string};
      const identity = requiredIdentity(req);
      await control.authorizeProject(projectId, identity.tenantId, identity.creatorId);
      const file = await projects.getExportFile(projectId, artifactId);
      reply.header("Content-Type", file.contentType);
      reply.header("Content-Length", String(file.sizeBytes));
      reply.header("Content-Disposition", `attachment; filename="${file.filename.replace(/"/g, "")}"`);
      return reply.send(file.bytes);
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.get("/api/maul/v1/projects/:projectId/thumbnails/:artifactId/file", async (req, reply) => {
    try {
      const {projectId, artifactId} = req.params as {projectId: string; artifactId: string};
      const identity = requiredIdentity(req);
      await control.authorizeProject(projectId, identity.tenantId, identity.creatorId);
      const file = await projects.getThumbnailFile(projectId, artifactId);
      reply.header("Content-Type", file.contentType);
      reply.header("Content-Length", String(file.sizeBytes));
      reply.header("Content-Disposition", `inline; filename="${file.filename.replace(/"/g, "")}"`);
      return reply.send(file.bytes);
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.post("/api/maul/v1/projects/:projectId/jobs", async (req, reply) => {
    try {
      const {projectId} = req.params as {projectId: string};
      const identity = tenantIdentity(req);
      const result = await control.submit({
        projectId,
        ...identity,
        idempotencyKey: String(req.headers["idempotency-key"] ?? ""),
        input: req.body
      });
      reply.code(result.duplicate ? 200 : 202);
      return result;
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.get("/api/maul/v1/projects/:projectId/jobs/:jobId", async (req, reply) => {
    try {
      const {projectId, jobId} = req.params as {projectId: string; jobId: string};
      const identity = tenantIdentity(req);
      await control.authorizeProject(projectId, identity.tenantId, identity.creatorId);
      const job = await control.readJob(jobId);
      if (job.projectId !== projectId || job.tenantId !== identity.tenantId) {
        throw new MaulAuthorizationError("The operation job is outside this tenant project.");
      }
      return {job};
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.get("/api/maul/v1/projects/:projectId/jobs/:jobId/telemetry", async (req, reply) => {
    try {
      const {projectId, jobId} = req.params as {projectId: string; jobId: string};
      const identity = tenantIdentity(req);
      await control.authorizeProject(projectId, identity.tenantId, identity.creatorId);
      const job = await control.readJob(jobId);
      if (job.projectId !== projectId || job.tenantId !== identity.tenantId) {
        throw new MaulAuthorizationError("The operation job is outside this tenant project.");
      }
      return {events: await control.readTelemetry(jobId)};
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.post("/api/maul/v1/projects/:projectId/jobs/:jobId/cancel", async (req, reply) => {
    try {
      const {projectId, jobId} = req.params as {projectId: string; jobId: string};
      const identity = tenantIdentity(req);
      await control.authorizeProject(projectId, identity.tenantId, identity.creatorId);
      const existing = await control.readJob(jobId);
      if (existing.projectId !== projectId || existing.tenantId !== identity.tenantId) {
        throw new MaulAuthorizationError("The operation job is outside this tenant project.");
      }
      const request = cancelSchema.parse(req.body);
      return {job: await control.cancel(jobId, request.reason)};
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.post("/api/maul/v1/workers/lease", async (req, reply) => {
    try {
      assertWorker(req);
      const request = leaseSchema.parse(req.body);
      const job = await control.lease(request.workerId, request.leaseMs);
      if (!job) {
        reply.code(204);
        return undefined;
      }
      return {job};
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.post("/api/maul/v1/workers/retention", async (req, reply) => {
    try {
      assertWorker(req);
      const request = retentionSchema.parse(req.body ?? {});
      return await control.purgeExpiredTerminalJobs(request.retentionDays);
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.post("/api/maul/v1/workers/jobs/:jobId/fail", async (req, reply) => {
    try {
      assertWorker(req);
      const {jobId} = req.params as {jobId: string};
      const request = failSchema.parse(req.body);
      return {job: await control.fail(jobId, request)};
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.post("/api/maul/v1/workers/jobs/:jobId/complete", async (req, reply) => {
    try {
      assertWorker(req);
      const {jobId} = req.params as {jobId: string};
      const request = completeSchema.parse(req.body);
      return {job: await control.complete(jobId, request)};
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.post("/api/maul/v1/projects/:projectId/feedback", async (req, reply) => {
    try {
      const {projectId} = req.params as {projectId: string};
      const identity = tenantIdentity(req);
      await control.authorizeProject(projectId, identity.tenantId, identity.creatorId);
      const request = maulFeedbackRequestSchema.parse(req.body);
      const {artifacts} = await projects.getProject(projectId);
      if (!artifacts.some((artifact) => artifact.artifactId === request.subjectArtifactId)) {
        throw new MaulAuthorizationError("Feedback subject is outside this MAUL project.");
      }
      const result = await learning.recordFeedback({projectId, ...identity, input: request});
      reply.code(201);
      return result;
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.post("/api/maul/v1/projects/:projectId/outcomes", async (req, reply) => {
    try {
      const {projectId} = req.params as {projectId: string};
      const identity = tenantIdentity(req);
      await control.authorizeProject(projectId, identity.tenantId, identity.creatorId);
      const request = maulOutcomeRequestSchema.parse(req.body);
      const {artifacts} = await projects.getProject(projectId);
      if (!artifacts.some((artifact) => artifact.artifactId === request.subjectArtifactId)) {
        throw new MaulAuthorizationError("Outcome subject is outside this MAUL project.");
      }
      const result = await learning.recordOutcome({projectId, ...identity, input: request});
      reply.code(201);
      return result;
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.get("/api/maul/v1/projects/:projectId/creator-taste-memory", async (req, reply) => {
    try {
      const {projectId} = req.params as {projectId: string};
      const identity = tenantIdentity(req);
      await control.authorizeProject(projectId, identity.tenantId, identity.creatorId);
      return {memory: await learning.readTasteMemory(identity.tenantId, identity.creatorId)};
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.get("/api/maul/v1/projects/:projectId/pattern-memory", async (req, reply) => {
    try {
      const {projectId} = req.params as {projectId: string};
      const identity = tenantIdentity(req);
      await control.authorizeProject(projectId, identity.tenantId, identity.creatorId);
      return {memory: await learning.readPatternMemory()};
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });

  app.delete("/api/maul/v1/projects/:projectId", async (req, reply) => {
    try {
      const {projectId} = req.params as {projectId: string};
      const identity = tenantIdentity(req);
      await control.authorizeProject(projectId, identity.tenantId, identity.creatorId);
      const request = deleteProjectSchema.parse(req.body);
      if (request.confirmProjectId !== projectId) {
        throw new Error("confirmProjectId must exactly match the MAUL project being deleted.");
      }
      await control.purgeProjectRecords(projectId);
      await learning.deleteProjectRecords({projectId, ...identity});
      return await projects.deleteProjectPermanently(
        projectId,
        request.confirmProjectId,
        request.reason
      );
    } catch (error) {
      reply.code(statusFor(error));
      return errorBody(error);
    }
  });
};
