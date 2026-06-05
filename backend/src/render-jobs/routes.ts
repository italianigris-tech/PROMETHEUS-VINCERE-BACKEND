import {createReadStream} from "node:fs";
import {mkdir, stat} from "node:fs/promises";
import path from "node:path";

import type {FastifyInstance} from "fastify";
import {z} from "zod";

import {buildRenderManifest, type RenderManifestBridge} from "./manifest-bridge";

const createRenderJobRequestSchema = z.object({
  creative_manifest: z.record(z.string(), z.unknown()),
  font_url: z.string().min(1).optional(),
  background_video_url: z.string().min(1),
  rvm_matte_url: z.string().min(1),
  audio_url: z.string().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional()
});

const completeRenderJobRequestSchema = z.object({
  outputUrl: z.string().min(1)
});

type RenderJobStatus = "queued" | "in_progress" | "complete" | "failed";

type RenderJob = {
  id: string;
  status: RenderJobStatus;
  manifest: RenderManifestBridge;
  output_url?: string;
  error?: string;
  created_at: string;
  updated_at: string;
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

const publicBaseUrl = (): string => process.env.API_BASE || `http://localhost:${process.env.PORT || "8000"}`;

const defaultFontUrl = (): string => "fonts/Fraunces-Regular.ttf";

const serializeJob = (job: RenderJob) => ({
  id: job.id,
  status: job.status,
  manifest: job.manifest,
  output_url: job.output_url ?? null,
  error: job.error ?? null,
  created_at: job.created_at,
  updated_at: job.updated_at
});

const mediaDir = (): string => process.env.MEDIA_DIR || path.join(process.cwd(), "data", "media");

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
    try {
      const request = createRenderJobRequestSchema.parse(req.body);
      const manifest = buildRenderManifest({
        creativeManifest: request.creative_manifest,
        fontUrl: request.font_url ?? defaultFontUrl(),
        backgroundVideoUrl: request.background_video_url,
        rvmMatteUrl: request.rvm_matte_url,
        audioUrl: request.audio_url,
        baseUrl: publicBaseUrl()
      });
      const stamp = nowIso();
      const job: RenderJob = {
        id: manifest.jobId,
        status: "queued",
        manifest,
        created_at: stamp,
        updated_at: stamp
      };

      await jobsLock.runExclusive(() => {
        jobs.set(job.id, job);
      });

      return {
        jobId: job.id,
        manifest: job.manifest,
        status: job.status
      };
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.get("/api/v1/render/jobs/next", async (_req, reply) => {
    const job = await jobsLock.runExclusive(() => {
      const queued = Array.from(jobs.values()).find((candidate) => candidate.status === "queued");
      if (!queued) {
        return null;
      }
      queued.status = "in_progress";
      queued.updated_at = nowIso();
      return queued;
    });

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
      const job = await jobsLock.runExclusive(() => {
        const existing = jobs.get(params.jobId);
        if (!existing) {
          return null;
        }
        existing.status = "complete";
        existing.output_url = request.outputUrl;
        existing.updated_at = nowIso();
        return existing;
      });

      if (!job) {
        reply.code(404);
        return {error: "Render job not found."};
      }

      return {
        jobId: job.id,
        status: job.status
      };
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error)
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
