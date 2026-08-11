import {createReadStream} from "node:fs";
import {stat} from "node:fs/promises";
import path from "node:path";

import cors from "@fastify/cors";
import {
  shortsTextChunkingRequestSchema,
  UnifiedRenderManifestSchema,
  type ShortsTextChunkingRequest,
} from "@prometheus/shared-types";
import Fastify, {type FastifyInstance} from "fastify";
import {z, ZodError} from "zod";

import {loadEnv, type BackendEnv} from "./config.js";
import {createShortsTextChunkPlanner} from "./maul/shorts-text-chunking-llm.js";
import {martinMatteBatchRequestSchema} from "./maul/martin-depth.js";
import {
  createHttpMattingDispatcher,
  createHttpRenderDispatcher,
  type MattingDispatcher,
  type RenderDispatcher,
} from "./render-dispatch.js";
import {
  createHttpSourceAnalysisDispatcher,
  type SourceAnalysisDispatcher,
} from "./source-analysis-dispatch.js";

export type CoreTextChunkPlanner = {
  plan: (request: ShortsTextChunkingRequest) => Promise<unknown>;
};

export type CoreAppDependencies = {
  textChunkPlanner?: CoreTextChunkPlanner;
  renderDispatcher?: RenderDispatcher;
  mattingDispatcher?: MattingDispatcher;
  sourceAnalysisDispatcher?: SourceAnalysisDispatcher;
};

export type CoreAppContext = {
  app: FastifyInstance;
  env: BackendEnv;
};

const parseCorsOrigins = (value: string): string[] =>
  value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const errorBody = (error: unknown): {error: string} => ({
  error:
    error instanceof ZodError
      ? error.issues.map((issue) => issue.message).join("; ")
      : error instanceof Error
        ? error.message
        : String(error),
});

export const createCoreApp = async (
  envOverrides?: Partial<NodeJS.ProcessEnv>,
  dependencies?: CoreAppDependencies,
): Promise<CoreAppContext> => {
  const env = loadEnv(envOverrides);
  const app = Fastify({logger: false});
  const allowedOrigins = parseCorsOrigins(env.CORS_ORIGINS);

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS.`), false);
    },
  });

  const textChunkPlanner =
    dependencies?.textChunkPlanner ??
    createShortsTextChunkPlanner({
      config: {
        baseUrl: env.MAUL_CHUNKING_LLM_BASE_URL,
        path: env.MAUL_CHUNKING_LLM_PATH,
        apiKey: env.MAUL_CHUNKING_LLM_API_KEY,
        model: env.MAUL_CHUNKING_LLM_MODEL,
        temperature: env.MAUL_CHUNKING_LLM_TEMPERATURE,
        maxOutputTokens: env.MAUL_CHUNKING_LLM_MAX_OUTPUT_TOKENS,
        timeoutMs: env.MAUL_CHUNKING_LLM_TIMEOUT_MS,
        maxRequestsPerMinute: env.MAUL_CHUNKING_LLM_MAX_REQUESTS_PER_MINUTE,
        maxConcurrentRequests: env.MAUL_CHUNKING_LLM_MAX_CONCURRENT_REQUESTS,
      },
    });
  const renderDispatcher =
    dependencies?.renderDispatcher ??
    createHttpRenderDispatcher({baseUrl: env.MODAL_RENDER_DISPATCH_URL});
  const mattingDispatcher =
    dependencies?.mattingDispatcher ??
    createHttpMattingDispatcher({baseUrl: env.MODAL_RENDER_DISPATCH_URL});
  const sourceAnalysisDispatcher =
    dependencies?.sourceAnalysisDispatcher ??
    createHttpSourceAnalysisDispatcher({baseUrl: env.MODAL_RENDER_DISPATCH_URL});

  app.get("/health", async () => ({ok: true}));

  app.post(
    "/api/maul/text-chunks/preview",
    {bodyLimit: 512 * 1024},
    async (request, reply) => {
      try {
        const parsed = shortsTextChunkingRequestSchema.parse(request.body);
        return await textChunkPlanner.plan(parsed);
      } catch (error) {
        reply.code(400);
        return errorBody(error);
      }
    },
  );

  app.post("/api/render/jobs", async (request, reply) => {
    try {
      const body = request.body as {manifest?: unknown};
      const manifest = UnifiedRenderManifestSchema.parse(body?.manifest);
      const {callId} = await renderDispatcher.spawn(manifest);
      const statusUrl = `/api/render/jobs/${manifest.jobId}/calls/${callId}`;
      reply.code(202);
      return {
        jobId: manifest.jobId,
        callId,
        status: "queued",
        statusUrl,
      };
    } catch (error) {
      reply.code(error instanceof ZodError ? 400 : 502);
      return errorBody(error);
    }
  });

  app.get("/api/render/jobs/:jobId/calls/:callId", async (request, reply) => {
    try {
      const {jobId, callId} = request.params as {jobId: string; callId: string};
      const status = await renderDispatcher.status(callId);
      return {
        jobId,
        callId,
        ...status,
        ...(status.outputFile
          ? {outputUrl: `/media/${encodeURIComponent(status.outputFile)}`}
          : {}),
      };
    } catch (error) {
      reply.code(502);
      return errorBody(error);
    }
  });

  app.post("/api/matting/jobs", async (request, reply) => {
    try {
      const body = request.body as {request?: unknown};
      const mattingRequest = martinMatteBatchRequestSchema.parse(body?.request);
      const {callId} = await mattingDispatcher.spawn(mattingRequest);
      const statusUrl = `/api/matting/jobs/${mattingRequest.jobId}/calls/${callId}`;
      reply.code(202);
      return {jobId: mattingRequest.jobId, callId, status: "queued", statusUrl};
    } catch (error) {
      reply.code(error instanceof ZodError ? 400 : 502);
      return errorBody(error);
    }
  });

  app.post("/api/source-analysis/jobs", async (request, reply) => {
    try {
      const body = z.object({
        jobId: z.string().uuid(),
        sourceAssetId: z.string().uuid(),
      }).parse(request.body);
      const {callId} = await sourceAnalysisDispatcher.spawn(body);
      const statusUrl = `/api/source-analysis/jobs/${body.jobId}/calls/${callId}`;
      reply.code(202);
      return {...body, callId, status: "queued", statusUrl};
    } catch (error) {
      reply.code(error instanceof ZodError ? 400 : 502);
      return errorBody(error);
    }
  });

  app.get("/api/source-analysis/jobs/:jobId/calls/:callId", async (request, reply) => {
    try {
      const {jobId, callId} = request.params as {jobId: string; callId: string};
      return {jobId, callId, ...(await sourceAnalysisDispatcher.status(callId))};
    } catch (error) {
      reply.code(502);
      return errorBody(error);
    }
  });

  app.get("/api/matting/jobs/:jobId/calls/:callId", async (request, reply) => {
    try {
      const {jobId, callId} = request.params as {jobId: string; callId: string};
      const status = await mattingDispatcher.status(callId);
      return {jobId, callId, ...status};
    } catch (error) {
      reply.code(502);
      return errorBody(error);
    }
  });

  app.get("/media/:filename", async (request, reply) => {
    const {filename} = request.params as {filename: string};
    if (!/^[A-Za-z0-9._-]+$/.test(filename) || path.basename(filename) !== filename) {
      reply.code(400);
      return {error: "Invalid media filename."};
    }
    const mediaPath = path.join(env.MEDIA_DIR, filename);
    try {
      const metadata = await stat(mediaPath);
      if (!metadata.isFile()) {
        throw new Error("Not a file.");
      }
      reply.type(filename.endsWith(".mp4") ? "video/mp4" : "application/octet-stream");
      return reply.send(createReadStream(mediaPath));
    } catch {
      reply.code(404);
      return {error: "Media output not found."};
    }
  });

  return {app, env};
};
