import {createReadStream} from "node:fs";
import {mkdir, stat, writeFile} from "node:fs/promises";
import path from "node:path";

import type {FastifyInstance} from "fastify";
import {UnifiedRenderManifestSchema, type UnifiedRenderManifest} from "@prometheus/shared-types";
import {z} from "zod";

import {buildRenderManifest, type DirectorNotes, type RenderManifestBridge} from "./manifest-bridge";

const LEASE_MS = 5 * 60 * 1000;

const legacyRenderJobRequestSchema = z.object({
  creative_manifest: z.record(z.string(), z.unknown()),
  director_notes: z.unknown(),
  font_url: z.string().min(1).optional(),
  background_video_url: z.string().min(1),
  rvm_matte_url: z.string().min(1),
  audio_url: z.string().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

const createJosephRenderJobRequestSchema = z.object({
  manifest: z.unknown(),
  variationKey: z.string().min(1).optional(),
  evidencePath: z.string().min(1).optional(),
});

const completeRenderJobRequestSchema = z.object({
  outputUrl: z.string().min(1),
});

const failRenderJobRequestSchema = z.object({
  errorMessage: z.string().min(1),
  failureTags: z.array(z.string().min(1)).default([]),
});

type RenderJobStatus = "queued" | "leased" | "completed" | "failed";
type RenderJobKind = "joseph" | "legacy";

type BaseRenderJob = {
  id: string;
  kind: RenderJobKind;
  status: RenderJobStatus;
  output_url?: string;
  error?: string;
  failure_tags: string[];
  variation_key: string;
  evidence_path: string;
  lease_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type JosephRenderJob = BaseRenderJob & {
  kind: "joseph";
  manifest: UnifiedRenderManifest;
};

type LegacyRenderJob = BaseRenderJob & {
  kind: "legacy";
  manifest: RenderManifestBridge;
};

type RenderJob = JosephRenderJob | LegacyRenderJob;

type ZodIssueLike = {
  path: Array<string | number | symbol>;
  message: string;
  code: string;
};

type ZodErrorLike = {
  issues: ZodIssueLike[];
};

class AsyncLock {
  private current: Promise<void> = Promise.resolve();

  async runExclusive<T>(callback: () => T | Promise<T>): Promise<T> {
    const previous = this.current;
    let release!: () => void;
    this.current = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await callback();
    } finally {
      release();
    }
  }
}

const jobs = new Map<string, RenderJob>();
const jobsLock = new AsyncLock();

const nowIso = (): string => new Date().toISOString();

const isoAfter = (ms: number): string => new Date(Date.now() + ms).toISOString();

const publicBaseUrl = (): string => process.env.API_BASE || `http://localhost:${process.env.PORT || "8000"}`;

const defaultFontUrl = (): string => "fonts/Fraunces-Regular.ttf";

const mediaDir = (): string => process.env.MEDIA_DIR || path.join(process.cwd(), "data", "media");

const defaultEvidenceRoot = (): string => process.env.PROMETHEUS_EVIDENCE_DIR || path.join(process.cwd(), "data", "render-job-evidence");

const defaultEvidencePath = (jobId: string): string => path.join(defaultEvidenceRoot(), jobId);

const serializeJob = (job: RenderJob) => ({
  id: job.id,
  kind: job.kind,
  status: job.status,
  manifest: job.manifest,
  variationKey: job.variation_key,
  evidencePath: job.evidence_path,
  failureTags: job.failure_tags,
  leaseExpiresAt: job.lease_expires_at,
  output_url: job.output_url ?? null,
  error: job.error ?? null,
  created_at: job.created_at,
  updated_at: job.updated_at,
});

const zodIssues = (error: ZodErrorLike) => error.issues.map((issue) => ({
  path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
  message: issue.message,
  code: issue.code,
}));

const invalidUnifiedManifestError = (error: ZodErrorLike) => ({
  code: "invalid_unified_render_manifest",
  message: "Request body must include manifest as a valid UnifiedRenderManifest.",
  issues: zodIssues(error),
});

const writeFailureEvidence = async (job: RenderJob): Promise<void> => {
  if (!job.evidence_path.trim()) {
    return;
  }

  await mkdir(job.evidence_path, {recursive: true});
  await writeFile(path.join(job.evidence_path, "render-failure.json"), `${JSON.stringify({
    jobId: job.id,
    kind: job.kind,
    errorMessage: job.error ?? "Render job failed.",
    failureTags: job.failure_tags,
    variationKey: job.variation_key,
    failedAt: job.updated_at,
  }, null, 2)}\n`, "utf8");
};

const leaseJob = (kind: RenderJobKind): RenderJob | null => {
  const queued = Array.from(jobs.values()).find((candidate) => (
    candidate.kind === kind &&
    candidate.status === "queued"
  ));
  if (!queued) {
    return null;
  }

  queued.status = "leased";
  queued.updated_at = nowIso();
  queued.lease_expires_at = isoAfter(LEASE_MS);
  return queued;
};

const completeJob = (jobId: string, outputUrl: string): RenderJob | null => {
  const existing = jobs.get(jobId);
  if (!existing) {
    return null;
  }

  existing.status = "completed";
  existing.output_url = outputUrl;
  existing.error = undefined;
  existing.updated_at = nowIso();
  existing.lease_expires_at = null;
  return existing;
};

const failJob = (jobId: string, errorMessage: string, failureTags: string[]): RenderJob | null => {
  const existing = jobs.get(jobId);
  if (!existing) {
    return null;
  }

  existing.status = "failed";
  existing.error = errorMessage;
  existing.failure_tags = failureTags;
  existing.updated_at = nowIso();
  existing.lease_expires_at = null;
  return existing;
};

export const registerRenderJobRoutes = async (app: FastifyInstance): Promise<void> => {
  await mkdir(mediaDir(), {recursive: true});

  app.get("/media/*", async (req, reply) => {
    const wildcard = String(((req.params as {"*": string})["*"] ?? "")).trim();
    const resolved = path.resolve(mediaDir(), wildcard.replace(/^[/\\]+/, ""));
    const relative = path.relative(mediaDir(), resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      reply.code(400);
      return {error: "Invalid media path."};
    }

    try {
      const stats = await stat(resolved);
      if (!stats.isFile()) {
        throw new Error("Not a file.");
      }
      return reply.send(createReadStream(resolved));
    } catch {
      reply.code(404);
      return {error: "Media asset not found."};
    }
  });

  app.post("/api/v1/render/jobs", async (req, reply) => {
    const request = createJosephRenderJobRequestSchema.safeParse(req.body);
    if (!request.success) {
      reply.code(400);
      return {error: invalidUnifiedManifestError(request.error)};
    }

    const manifestResult = UnifiedRenderManifestSchema.safeParse(request.data.manifest);
    if (!manifestResult.success) {
      reply.code(400);
      return {error: invalidUnifiedManifestError(manifestResult.error)};
    }

    const stamp = nowIso();
    const manifest = manifestResult.data;
    const job: JosephRenderJob = {
      id: manifest.jobId,
      kind: "joseph",
      status: "queued",
      manifest,
      variation_key: request.data.variationKey ?? `variation:${manifest.jobId}`,
      evidence_path: request.data.evidencePath ?? defaultEvidencePath(manifest.jobId),
      failure_tags: [],
      lease_expires_at: null,
      created_at: stamp,
      updated_at: stamp,
    };

    await jobsLock.runExclusive(() => {
      jobs.set(job.id, job);
    });

    reply.code(202);
    return {
      jobId: job.id,
      status: job.status,
      manifest: job.manifest,
      variationKey: job.variation_key,
      evidencePath: job.evidence_path,
    };
  });

  app.post("/api/v1/render/jobs/legacy", async (req, reply) => {
    try {
      const request = legacyRenderJobRequestSchema.parse(req.body);
      const manifest = buildRenderManifest({
        creativeManifest: request.creative_manifest,
        directorNotes: request.director_notes as DirectorNotes,
        fontUrl: request.font_url ?? defaultFontUrl(),
        backgroundVideoUrl: request.background_video_url,
        rvmMatteUrl: request.rvm_matte_url,
        audioUrl: request.audio_url,
        baseUrl: publicBaseUrl(),
      });
      const stamp = nowIso();
      const job: LegacyRenderJob = {
        id: manifest.jobId,
        kind: "legacy",
        status: "queued",
        manifest,
        variation_key: `legacy:${manifest.jobId}`,
        evidence_path: defaultEvidencePath(manifest.jobId),
        failure_tags: [],
        lease_expires_at: null,
        created_at: stamp,
        updated_at: stamp,
      };

      await jobsLock.runExclusive(() => {
        jobs.set(job.id, job);
      });

      return {
        jobId: job.id,
        manifest: job.manifest,
        status: job.status,
      };
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  app.get("/api/v1/render/jobs/next", async (req, reply) => {
    const query = req.query as {kind?: string};
    const requestedKind: RenderJobKind = query.kind === "legacy" ? "legacy" : "joseph";
    const job = await jobsLock.runExclusive(() => leaseJob(requestedKind));

    if (!job) {
      reply.code(204);
      return undefined;
    }

    return job.manifest;
  });

  app.get("/api/v1/render/jobs/legacy/next", async (req, reply) => {
    const job = await jobsLock.runExclusive(() => leaseJob("legacy"));

    if (!job) {
      reply.code(204);
      return undefined;
    }

    return job.manifest;
  });

  app.post("/api/v1/render/jobs/:jobId/complete", async (req, reply) => {
    try {
      const params = req.params as {jobId: string};
      const request = completeRenderJobRequestSchema.parse(req.body);
      const job = await jobsLock.runExclusive(() => completeJob(params.jobId, request.outputUrl));

      if (!job) {
        reply.code(404);
        return {error: "Render job not found."};
      }

      return {
        jobId: job.id,
        status: job.status,
      };
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  app.post("/api/v1/render/jobs/:jobId/failed", async (req, reply) => {
    try {
      const params = req.params as {jobId: string};
      const request = failRenderJobRequestSchema.parse(req.body);
      const job = await jobsLock.runExclusive(() => failJob(
        params.jobId,
        request.errorMessage,
        request.failureTags,
      ));

      if (!job) {
        reply.code(404);
        return {error: "Render job not found."};
      }

      await writeFailureEvidence(job);

      return {
        jobId: job.id,
        status: job.status,
        failureTags: job.failure_tags,
      };
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  app.get("/api/v1/render/jobs/:jobId", async (req, reply) => {
    const params = req.params as {jobId: string};
    const job = await jobsLock.runExclusive(() => jobs.get(params.jobId) ?? null);
    if (!job) {
      reply.code(404);
      return {error: "Render job not found."};
    }
    return serializeJob(job);
  });
};
