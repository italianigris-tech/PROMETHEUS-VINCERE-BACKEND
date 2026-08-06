import {createReadStream} from "node:fs";
import {mkdir, stat} from "node:fs/promises";
import path from "node:path";

import Fastify, {type FastifyInstance} from "fastify";
import multipart from "@fastify/multipart";
import cors from "@fastify/cors";

import {loadEnv, type BackendEnv} from "./config";
import {METADATA_CATALOG_ENTRIES, METADATA_GROUPS} from "./metadata-catalog";
import {FileJobRepository} from "./repository";
import {InProcessQueue, QueueBacklogLimitError} from "./queue";
import {BackendService} from "./service";
import type {PipelineDependencies} from "./pipeline";
import type {FallbackEvent, JobStage} from "./schemas";
import {buildDiagnosticsReport} from "./diagnostics";
import {fallbackEventsToFailureRecords} from "./failure-intelligence";
import {buildModelRoutingTable} from "./model-routing";
import {LocalPreviewRunner, type LocalPreviewRunnerDependencies} from "./local-preview-runner";
import {EditSessionManager, type EditSessionDependencies} from "./edit-sessions/service";
import {EditSessionStore} from "./edit-sessions/store";
import {registerEditSessionRoutes} from "./edit-sessions/routes";
import {createR2TransferService, type R2TransferService} from "./integrations/r2";
import {registerUploadRoutes} from "./upload-routes";
import {createJosephUploadPipeline, type JosephUploadPipeline} from "./upload/joseph-upload-pipeline";
import {VideoContextService} from "./video-context/service";
import {VideoContextStore} from "./video-context/store";
import {registerVideoContextRoutes} from "./video-context/routes";
import {GodService, registerGodRoutes} from "./god";
import {registerThumbnailRoutes} from "./thumbnail";
import {registerRenderJobRoutes} from "./render-jobs/routes";
import {MaulProjectStore} from "./maul/store";
import {MaulProjectService} from "./maul/service";
import type {MaulShortRenderEngine} from "./maul/render-engine";
import type {MaulThumbnailGenerator} from "./maul/thumbnail-generator";
import type {MaulQualityTruthProofProvider} from "./maul/quality-truth";
import type {MaulPerceptualTruthProvider} from "./maul/perceptual-truth";
import type {SceneEvidenceProvider} from "./maul/scene-evidence";
import type {MaulTypographyProvider} from "./maul/typography-layout";
import {createZillizMaulTypographyProvider} from "./maul/zilliz-font-assets";
import {
  createShortsTextChunkPlanner,
  type ShortsTextChunkPlanner,
} from "./maul/shorts-text-chunking-llm";
import {MaulDurableControlPlane} from "./maul/control-plane";
import {SupabaseSourceJobBridge} from "./maul/supabase-source-job-bridge";
import {registerMaulControlPlaneRoutes} from "./maul/control-plane-routes";
import {MaulLearningStore} from "./maul/learning";
import {registerMaulProjectRoutes} from "./maul/routes";
import {
  createJosephStudyCandidateGenerator,
  registerJosephStudyCandidateRoutes,
  type JosephStudyCandidateGenerator,
} from "./director/joseph-study-candidates";
import {AssetRetrievalService} from "./assets/service";
import {registerAssetRoutes} from "./assets/routes";
import {VectorRetrievalService} from "./assets/vector-service";
import {registerMusicCatalogRoutes} from "./music/routes";
import {createSignedMusicPreviewUrl, type MusicPreviewUrlSigner} from "./music/catalog/r2-preview-url-signer";
import {FONT_SERVE_PATH, resolveRetrievedFontsDir} from "./config/font-assets";
import {ZillizHealthMonitor} from "./health/zilliz-keepalive";
import {
  buildExecutionVisibility,
  ExecutionTelemetryBroker,
  type ExecutionTelemetryEvent
} from "./execution-telemetry";
import {z} from "zod";

import {
  createCreativeTreatmentPlanner,
  type CreativeTreatmentPlanner,
} from './maul/creative-treatment-planner';

const PATTERN_MEMORY_UPDATE_SCHEMA = z.object({
  patternId: z.string(),
  context: z.record(z.string(), z.unknown()),
  outcome: z.enum(["success", "partial-success", "rejected", "blocked", "deprecated"]),
  humanApproved: z.boolean().optional(),
  rejectedReason: z.string().optional(),
  notes: z.string().optional(),
  appliedEffectIds: z.array(z.string()).optional(),
  appliedAssetIds: z.array(z.string()).optional(),
  visualScore: z.number().optional(),
  hierarchyScore: z.number().optional(),
  clarityScore: z.number().optional()
});

export type BackendAppContext = {
  app: FastifyInstance;
  service: BackendService;
  repository: FileJobRepository;
  queue: InProcessQueue;
  editSessions: EditSessionManager;
  maulProjects: MaulProjectService;
  maulControlPlane: MaulDurableControlPlane;
  god: GodService;
  videoContexts: VideoContextService;
  executionTelemetry: ExecutionTelemetryBroker;
  env: BackendEnv;
};

export type BackendDependencies = PipelineDependencies & EditSessionDependencies & {
  r2Service?: R2TransferService;
  josephUploadPipeline?: JosephUploadPipeline;
  josephStudyCandidateGenerator?: JosephStudyCandidateGenerator;
  extractAudioPreviewFile?: LocalPreviewRunnerDependencies["extractAudioPreviewFile"];
  musicPreviewUrlSigner?: MusicPreviewUrlSigner;
  videoContext?: ConstructorParameters<typeof VideoContextService>[4];
  maulRenderEngine?: MaulShortRenderEngine;
  maulThumbnailGenerator?: MaulThumbnailGenerator;
  maulQualityTruthProofProvider?: MaulQualityTruthProofProvider;
  maulPerceptualTruthProvider?: MaulPerceptualTruthProvider;
  maulSceneEvidenceProvider?: SceneEvidenceProvider;
  maulTypographyProvider?: MaulTypographyProvider;
  maulTextChunkPlanner?: ShortsTextChunkPlanner;
  maulCreativeTreatmentPlanner?: CreativeTreatmentPlanner;
};

const parseCorsOrigins = (value: string): string[] => {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const publicStageForJob = (stage: JobStage): string => {
  switch (stage) {
    case "received":
      return "queued";
    case "analyzing":
      return "transcribing";
    case "metadata_ready":
      return "segmenting";
    case "plan_ready":
      return "heuristic_scoring";
    case "execution_ready":
      return "llm_scoring";
    case "audio_render":
      return "audio_rendering";
    case "ranking":
      return "ranking";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
  }
};

const requestStatusCodeForError = (error: unknown): number => {
  return error instanceof QueueBacklogLimitError ? 503 : 400;
};

const FONT_CONTENT_TYPES: Record<string, string> = {
  ".otf": "font/otf",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const inferFontContentType = (filePath: string): string => {
  return FONT_CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
};

const formatExecutionTelemetrySseEvent = (event: ExecutionTelemetryEvent): string => [
  `id: ${event.id}`,
  `event: ${event.type}`,
  `data: ${JSON.stringify(event)}`,
  ""
].join("\n");

const parseByteRange = (
  rangeHeader: string,
  fileSizeBytes: number
): {start: number; end: number} | null => {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }

  const [, startText, endText] = match;
  if (!startText && !endText) {
    return null;
  }

  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    const start = Math.max(0, fileSizeBytes - suffixLength);
    return {
      start,
      end: fileSizeBytes - 1
    };
  }

  const start = Number(startText);
  const unclampedEnd = endText ? Number(endText) : fileSizeBytes - 1;
  if (!Number.isFinite(start) || !Number.isFinite(unclampedEnd) || start < 0) {
    return null;
  }

  const end = Math.min(fileSizeBytes - 1, unclampedEnd);
  if (start > end || start >= fileSizeBytes) {
    return null;
  }

  return {start, end};
};

export const createBackendApp = async ({
  envOverrides,
  deps,
  storageDir
}: {
  envOverrides?: Partial<NodeJS.ProcessEnv>;
  deps?: BackendDependencies;
  storageDir?: string;
} = {}): Promise<BackendAppContext> => {
  const loadedEnv = loadEnv(envOverrides);
  const env = {
    ...loadedEnv,
    STORAGE_DIR: storageDir ?? loadedEnv.STORAGE_DIR
  };

  const app = Fastify({
    logger: false,
    bodyLimit: env.MAX_UPLOAD_FILE_SIZE_BYTES
  });
  const retrievedFontsDir = resolveRetrievedFontsDir(env.REMOTION_ASSETS_DIR);
  // Content-addressed font assets are immutable and are referenced by persisted
  // MAUL manifests. Startup may create the cache but must never invalidate it.
  await mkdir(retrievedFontsDir, {recursive: true});
  const zillizHealthMonitor = new ZillizHealthMonitor(env);
  zillizHealthMonitor.start();
  app.addHook("onClose", async () => {
    zillizHealthMonitor.stop();
  });
  const allowedOrigins = parseCorsOrigins(env.CORS_ORIGINS);
  await app.register(cors, {
    origin: (origin, cb) => {
      if (allowedOrigins.includes("*")) {
        cb(null, true);
        return;
      }
      if (!origin) {
        cb(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error(`Origin ${origin} is not allowed by CORS.`), false);
    }
  });
  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_UPLOAD_FILE_SIZE_BYTES
    }
  });

  const repository = new FileJobRepository(env.STORAGE_DIR);
  const queue = new InProcessQueue(env.JOB_QUEUE_CONCURRENCY, env.JOB_QUEUE_MAX_PENDING);
  const executionTelemetry = deps?.executionTelemetry instanceof ExecutionTelemetryBroker
    ? deps.executionTelemetry
    : new ExecutionTelemetryBroker();
  const pipelineDeps: BackendDependencies = {
    ...(deps ?? {}),
    executionTelemetry
  };
  const localPreviewRunner = new LocalPreviewRunner({
    extractAudioPreviewFile: deps?.extractAudioPreviewFile
  });
  const service = new BackendService({
    repository,
    queue,
    env,
    deps: pipelineDeps
  });
  await service.initialize();
  const editSessionStore = new EditSessionStore(env.STORAGE_DIR);
  const editSessions = new EditSessionManager({
    store: editSessionStore,
    env,
    deps: pipelineDeps
  });
  await editSessions.initialize();
  const maulProjectStore = new MaulProjectStore(env.STORAGE_DIR);
  const maulTextChunkPlanner =
    deps?.maulTextChunkPlanner ??
    createShortsTextChunkPlanner({
      config: {
        baseUrl: env.MAUL_CHUNKING_LLM_BASE_URL,
        path: env.MAUL_CHUNKING_LLM_PATH,
        apiKey: env.MAUL_CHUNKING_LLM_API_KEY,
        model: env.MAUL_CHUNKING_LLM_MODEL,
        temperature: env.MAUL_CHUNKING_LLM_TEMPERATURE,
        maxOutputTokens: env.MAUL_CHUNKING_LLM_MAX_OUTPUT_TOKENS,
        timeoutMs: env.MAUL_CHUNKING_LLM_TIMEOUT_MS,
        maxRequestsPerMinute:
          env.MAUL_CHUNKING_LLM_MAX_REQUESTS_PER_MINUTE,
        maxConcurrentRequests:
          env.MAUL_CHUNKING_LLM_MAX_CONCURRENT_REQUESTS,
      },
    });
  const maulCreativeTreatmentPlanner =
    deps?.maulCreativeTreatmentPlanner ??
    createCreativeTreatmentPlanner({
      config: {
        baseUrl: env.MAUL_CREATIVE_PLANNER_BASE_URL,
        path: env.MAUL_CREATIVE_PLANNER_PATH,
        apiKey: env.MAUL_CREATIVE_PLANNER_API_KEY,
        model: env.MAUL_CREATIVE_PLANNER_MODEL,
        reasoningEffort: env.MAUL_CREATIVE_PLANNER_REASONING_EFFORT,
        temperature: env.MAUL_CREATIVE_PLANNER_TEMPERATURE,
        maxOutputTokens: env.MAUL_CREATIVE_PLANNER_MAX_OUTPUT_TOKENS,
        timeoutMs: env.MAUL_CREATIVE_PLANNER_TIMEOUT_MS,
      },
    });
  const maulProjects = new MaulProjectService(
    maulProjectStore,
    buildModelRoutingTable(env),
    undefined,
    undefined,
    deps?.maulRenderEngine,
    deps?.maulThumbnailGenerator,
    deps?.maulQualityTruthProofProvider,
    maulTextChunkPlanner,
    undefined,
    deps?.maulSceneEvidenceProvider,
    deps?.maulPerceptualTruthProvider,
    deps?.maulTypographyProvider ?? createZillizMaulTypographyProvider(env),
    maulCreativeTreatmentPlanner,
  );
  await maulProjects.initialize();
  const maulControlPlane = new MaulDurableControlPlane(env.STORAGE_DIR, maulProjects);
  await maulControlPlane.initialize();
  const maulLearning = new MaulLearningStore(env.STORAGE_DIR);
  await maulLearning.initialize();
  const videoContextStore = new VideoContextStore(env.STORAGE_DIR);
  const videoContexts = new VideoContextService(
    env,
    repository,
    queue,
    videoContextStore,
    deps?.videoContext
  );
  await videoContexts.initialize();
  app.addHook("onClose", async () => {
    editSessions.destroy();
  });
  const god = new GodService({
    env,
    fetchImpl: deps?.fetchImpl
  });
  await god.initialize();
  const assetRetrieval = new AssetRetrievalService(env);
  const vectorRetrieval = env.ASSET_MILVUS_ENABLED ? new VectorRetrievalService(env) : undefined;
  const r2Service = deps?.r2Service ?? createR2TransferService(env);
  const supabaseSourceJobs = new SupabaseSourceJobBridge(env, r2Service, videoContexts, deps?.fetchImpl);
  if (env.MAUL_SUPABASE_BRIDGE_ENABLED && !supabaseSourceJobs.configured) {
    console.warn(
      "[maul-supabase-bridge] disabled: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and R2 credentials are required."
    );
  } else {
    supabaseSourceJobs.start();
  }
  app.addHook("onClose", async () => {
    supabaseSourceJobs.stop();
  });
  const josephUploadPipeline = deps?.josephUploadPipeline ?? createJosephUploadPipeline({
    storageDir: env.STORAGE_DIR
  });
  const josephStudyCandidateGenerator = deps?.josephStudyCandidateGenerator ?? createJosephStudyCandidateGenerator({
    storageDir: env.STORAGE_DIR
  });
  const musicPreviewUrlSigner = deps?.musicPreviewUrlSigner ?? createSignedMusicPreviewUrl;

  app.get("/health", async () => ({
    ok: true
  }));

  app.get("/health/zilliz", async (_req, reply) => {
    const snapshot = await zillizHealthMonitor.checkNow();
    reply.code(snapshot.status === "healthy" ? 200 : 503);
    return snapshot;
  });

  app.get(`${FONT_SERVE_PATH}/*`, async (req, reply) => {
    const wildcard = String(((req.params as {"*": string})["*"] ?? "")).trim();
    if (!wildcard) {
      reply.code(404);
      return {
        error: "Font asset not found."
      };
    }

    const normalizedRelativePath = wildcard.replace(/^[/\\]+/, "");
    const resolvedFilePath = path.resolve(retrievedFontsDir, normalizedRelativePath);
    const relativePath = path.relative(retrievedFontsDir, resolvedFilePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      reply.code(400);
      return {
        error: "Invalid font asset path."
      };
    }

    try {
      const fileStats = await stat(resolvedFilePath);
      if (!fileStats.isFile()) {
        throw new Error("Not a file.");
      }

      reply.header("Content-Type", inferFontContentType(resolvedFilePath));
      reply.header("Cache-Control", "public, max-age=3600, immutable");
      return reply.send(createReadStream(resolvedFilePath));
    } catch {
      reply.code(404);
      return {
        error: "Font asset not found."
      };
    }
  });

  registerAssetRoutes(app, assetRetrieval, vectorRetrieval);

  app.get("/api/local-preview/status", async () => {
    return localPreviewRunner.getStatus();
  });

  app.get("/api/local-preview/instant-preview", async () => {
    return localPreviewRunner.getInstantPreview();
  });

  app.post("/api/local-preview/audio-preview", async (req, reply) => {
    try {
      const asset = await localPreviewRunner.createAudioPreviewAsset(req);
      return {
        assetId: asset.assetId,
        audioUrl: asset.audioUrl,
        contentType: asset.contentType,
        fileSizeBytes: asset.fileSizeBytes,
        sourceDisplayName: asset.sourceDisplayName
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(/not found/i.test(message) ? 404 : 400);
      return {
        error: message
      };
    }
  });

  app.get("/api/local-preview/audio-preview/:assetId", async (req, reply) => {
    try {
      const params = req.params as {assetId: string};
      const asset = await localPreviewRunner.getAudioPreviewAsset(params.assetId);
      const rangeHeader = typeof req.headers.range === "string" ? req.headers.range : null;

      reply.header("Content-Type", asset.contentType);
      reply.header("Accept-Ranges", "bytes");
      reply.header("Cache-Control", "public, max-age=3600, immutable");

      if (!rangeHeader) {
        reply.header("Content-Length", String(asset.fileSizeBytes));
        return reply.send(createReadStream(asset.filePath));
      }

      const byteRange = parseByteRange(rangeHeader, asset.fileSizeBytes);
      if (!byteRange) {
        reply.code(416);
        reply.header("Content-Range", `bytes */${asset.fileSizeBytes}`);
        return {
          error: "Requested range not satisfiable."
        };
      }

      const {start, end} = byteRange;
      reply.code(206);
      reply.header("Content-Length", String(end - start + 1));
      reply.header("Content-Range", `bytes ${start}-${end}/${asset.fileSizeBytes}`);
      return reply.send(createReadStream(asset.filePath, {start, end}));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(/not found/i.test(message) ? 404 : 400);
      return {
        error: message
      };
    }
  });

  app.get("/api/edit-sessions/:id/source", async (req, reply) => {
    try {
      const params = req.params as {id: string};
      const asset = await editSessions.getSourceMediaAsset(params.id);
      const rangeHeader = typeof req.headers.range === "string" ? req.headers.range : null;

      reply.header("Content-Type", asset.contentType);
      reply.header("Accept-Ranges", "bytes");
      reply.header("Cache-Control", "no-store");
      reply.header("Content-Disposition", `inline; filename="${asset.fileName.replace(/"/g, "")}"`);

      if (!rangeHeader) {
        reply.header("Content-Length", String(asset.fileSizeBytes));
        return reply.send(createReadStream(asset.filePath));
      }

      const byteRange = parseByteRange(rangeHeader, asset.fileSizeBytes);
      if (!byteRange) {
        reply.code(416);
        reply.header("Content-Range", `bytes */${asset.fileSizeBytes}`);
        return {
          error: "Requested range not satisfiable."
        };
      }

      const {start, end} = byteRange;
      reply.code(206);
      reply.header("Content-Length", String(end - start + 1));
      reply.header("Content-Range", `bytes ${start}-${end}/${asset.fileSizeBytes}`);
      return reply.send(createReadStream(asset.filePath, {start, end}));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(/not found/i.test(message) ? 404 : 400);
      return {
        error: message
      };
    }
  });

  app.post("/api/local-preview/reset", async (_req, reply) => {
    try {
      return await localPreviewRunner.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = /already in progress/i.test(message) ? 409 : 400;
      reply.code(statusCode);
      return {
        error: message
      };
    }
  });

  app.post("/api/local-preview/run", async (req, reply) => {
    try {
      const request = await localPreviewRunner.parseRunRequest(req);
      const status = await localPreviewRunner.startRun(request);
      reply.code(202);
      return status;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = /already in progress/i.test(message) ? 409 : 400;
      reply.code(statusCode);
      return {
        error: message
      };
    }
  });

  app.get("/api/pattern-memory", async () => {
    const [snapshot, summary] = await Promise.all([
      service.getPatternMemorySnapshot(),
      service.getPatternMemorySummary()
    ]);
    return {
      snapshot,
      summary
    };
  });

  app.post("/api/pattern-memory/outcome", async (req, reply) => {
    try {
      const payload = PATTERN_MEMORY_UPDATE_SCHEMA.parse(req.body);
      const result = await service.recordPatternMemoryOutcome(payload);
      reply.code(202);
      return {
        snapshot: result.snapshot,
        ledger_event: result.ledgerEvent,
        updated_entry: result.updatedEntry
      };
    } catch (error) {
      reply.code(requestStatusCodeForError(error));
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.get("/api/metadata/catalog", async () => ({
    groups: METADATA_GROUPS,
    count: METADATA_CATALOG_ENTRIES.length,
    entries: METADATA_CATALOG_ENTRIES
  }));

  app.post("/api/jobs", async (req, reply) => {
    try {
      const job = req.isMultipart()
        ? await service.submitMultipartJob(req)
        : await service.submitJsonJob(req.body);

      reply.code(202);
      return {
        job_id: job.job_id,
        status: job.status,
        current_stage: job.current_stage,
        stage: publicStageForJob(job.current_stage),
        executionVisibility: buildExecutionVisibility(job),
        urls: {
          job: `/api/jobs/${job.job_id}`,
          events: `/api/jobs/${job.job_id}/events`,
          execution_visibility: `/api/jobs/${job.job_id}/execution-visibility`,
          metadata: `/api/jobs/${job.job_id}/metadata`,
          clips: `/api/jobs/${job.job_id}/clips`,
          result: `/api/jobs/${job.job_id}/result`,
          plan: `/api/jobs/${job.job_id}/plan`,
          motion_plan: `/api/jobs/${job.job_id}/motion-plan`,
          execution: `/api/jobs/${job.job_id}/execution`,
          diagnostics: `/api/jobs/${job.job_id}/diagnostics`
        }
      };
    } catch (error) {
      reply.code(requestStatusCodeForError(error));
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.get("/api/jobs/:jobId", async (req, reply) => {
    try {
      const params = req.params as {jobId: string};
      const job = await service.getJob(params.jobId);
      const [metadataReady, clipSelectionReady, planReady, motionPlanReady, executionReady, fallbackLogReady] = await Promise.all([
        repository.artifactExists(params.jobId, "metadata_profile"),
        repository.artifactExists(params.jobId, "clip_selection"),
        repository.artifactExists(params.jobId, "edit_plan"),
        repository.artifactExists(params.jobId, "motion_plan"),
        repository.artifactExists(params.jobId, "execution_plan"),
        repository.artifactExists(params.jobId, "fallback_log")
      ]);
      const [audioRenderPlanReady, audioMasterReady, audioAacReady, audioPreviewReady, audioWaveformReady, audioPeaksReady, audioStemsReady] = await Promise.all([
        repository.artifactExists(params.jobId, "audio_render_plan"),
        repository.pathExists(job.artifact_paths.audio_master),
        repository.pathExists(job.artifact_paths.audio_master_aac),
        repository.pathExists(job.artifact_paths.audio_preview_mix),
        repository.pathExists(job.artifact_paths.audio_waveform_png),
        repository.pathExists(job.artifact_paths.audio_peaks_json),
        repository.pathExists(job.artifact_paths.audio_stems_dir)
      ]);

      return {
        job_id: job.job_id,
        status: job.status,
        current_stage: job.current_stage,
        stage: publicStageForJob(job.current_stage),
        progress: job.progress,
        executionVisibility: buildExecutionVisibility(job),
        warnings: job.warning_list,
        error_message: job.error_message,
        artifact_availability: {
          metadata_profile: metadataReady,
          clip_selection: clipSelectionReady,
          result: clipSelectionReady,
          edit_plan: planReady,
          motion_plan: motionPlanReady,
          execution_plan: executionReady,
          fallback_log: fallbackLogReady,
          audio_render_plan: audioRenderPlanReady,
          audio_master: audioMasterReady,
          audio_master_aac: audioAacReady,
          audio_preview_mix: audioPreviewReady,
          audio_waveform_png: audioWaveformReady,
          audio_peaks_json: audioPeaksReady,
          audio_stems_dir: audioStemsReady
        },
        urls: {
          events: `/api/jobs/${job.job_id}/events`,
          execution_visibility: `/api/jobs/${job.job_id}/execution-visibility`,
          metadata: metadataReady ? `/api/jobs/${job.job_id}/metadata` : null,
          clips: clipSelectionReady ? `/api/jobs/${job.job_id}/clips` : null,
          result: clipSelectionReady ? `/api/jobs/${job.job_id}/result` : null,
          plan: planReady ? `/api/jobs/${job.job_id}/plan` : null,
          motion_plan: motionPlanReady ? `/api/jobs/${job.job_id}/motion-plan` : null,
          execution: executionReady ? `/api/jobs/${job.job_id}/execution` : null,
          diagnostics: `/api/jobs/${job.job_id}/diagnostics`,
          audio_render_plan: audioRenderPlanReady ? `/api/jobs/${job.job_id}/audio-render-plan` : null
        },
        stage_history: job.stage_history,
        source_summary: job.source_summary,
        request_summary: job.request_summary
      };
    } catch {
      reply.code(404);
      return {
        error: "Job not found."
      };
    }
  });

  app.get("/api/jobs/:jobId/execution-visibility", async (req, reply) => {
    try {
      const params = req.params as {jobId: string};
      const job = await service.getJob(params.jobId);
      executionTelemetry.ensureJobRegistered(job);
      return buildExecutionVisibility(job);
    } catch {
      reply.code(404);
      return {
        error: "Execution visibility not found."
      };
    }
  });

  app.get("/api/jobs/:jobId/events", async (req, reply) => {
    try {
      const params = req.params as {jobId: string};
      const query = req.query as {replay?: string};
      const lastEventId = typeof req.headers["last-event-id"] === "string"
        ? req.headers["last-event-id"]
        : undefined;
      const job = await service.getJob(params.jobId);
      executionTelemetry.ensureJobRegistered(job);
      const replayEvents = executionTelemetry.getReplayEvents(params.jobId, lastEventId);
      const headers = {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no"
      };

      if (query.replay === "once") {
        reply.headers(headers);
        return replayEvents.map(formatExecutionTelemetrySseEvent).join("\n");
      }

      reply.hijack();
      reply.raw.writeHead(200, headers);
      reply.raw.write("\n");
      replayEvents.forEach((event) => {
        reply.raw.write(`${formatExecutionTelemetrySseEvent(event)}\n`);
      });

      const unsubscribe = executionTelemetry.subscribe(
        params.jobId,
        (event) => {
          if (!reply.raw.writableEnded) {
            reply.raw.write(`${formatExecutionTelemetrySseEvent(event)}\n`);
          }
        },
        {replay: false}
      );
      const heartbeat = setInterval(() => {
        if (!reply.raw.writableEnded) {
          reply.raw.write(": heartbeat\n\n");
        }
      }, 15000);

      req.raw.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          reply.raw.end();
        } catch {
          // Ignore transport cleanup failures.
        }
      });
    } catch {
      reply.code(404);
      return {
        error: "Execution events not found."
      };
    }
  });

  app.post("/api/generate-viral-clips", async (req, reply) => {
    try {
      const job = req.isMultipart()
        ? await service.submitMultipartViralClipJob(req)
        : await service.submitViralClipJob(req.body);

      reply.code(202);
      return {
        jobId: job.job_id,
        status: job.status,
        stage: publicStageForJob(job.current_stage),
        executionVisibility: buildExecutionVisibility(job),
        urls: {
          job: `/api/jobs/${job.job_id}`,
          events: `/api/jobs/${job.job_id}/events`,
          execution_visibility: `/api/jobs/${job.job_id}/execution-visibility`,
          result: `/api/jobs/${job.job_id}/result`
        }
      };
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  app.get("/api/jobs/:jobId/metadata", async (req, reply) => {
    try {
      const params = req.params as {jobId: string};
      return await service.getMetadataProfile(params.jobId);
    } catch {
      reply.code(404);
      return {
        error: "Metadata profile not found."
      };
    }
  });

  app.get("/api/jobs/:jobId/plan", async (req, reply) => {
    try {
      const params = req.params as {jobId: string};
      return await service.getEditPlan(params.jobId);
    } catch {
      reply.code(404);
      return {
        error: "Edit plan not found."
      };
    }
  });

  app.get("/api/jobs/:jobId/motion-plan", async (req, reply) => {
    try {
      const params = req.params as {jobId: string};
      return await service.getMotionPlan(params.jobId);
    } catch {
      reply.code(404);
      return {
        error: "Motion plan not found."
      };
    }
  });

  app.get("/api/jobs/:jobId/clips", async (req, reply) => {
    try {
      const params = req.params as {jobId: string};
      return await service.getClipSelection(params.jobId);
    } catch {
      reply.code(404);
      return {
        error: "Clip selection not found."
      };
    }
  });

  app.get("/api/jobs/:jobId/result", async (req, reply) => {
    try {
      const params = req.params as {jobId: string};
      return await service.getClipSelection(params.jobId);
    } catch {
      reply.code(404);
      return {
        error: "Result not found."
      };
    }
  });

  app.get("/api/jobs/:jobId/execution", async (req, reply) => {
    try {
      const params = req.params as {jobId: string};
      return await service.getExecutionPlan(params.jobId);
    } catch {
      reply.code(404);
      return {
        error: "Execution plan not found."
      };
    }
  });

  app.get("/api/jobs/:jobId/audio-render-plan", async (req, reply) => {
    try {
      const params = req.params as {jobId: string};
      return await repository.readArtifact(params.jobId, "audio_render_plan");
    } catch {
      reply.code(404);
      return {
        error: "Audio render plan not found."
      };
    }
  });

  app.get("/api/jobs/:jobId/diagnostics", async (req, reply) => {
    try {
      const params = req.params as {jobId: string};
      const job = await service.getJob(params.jobId);
      const fallbackEvents = await repository.artifactExists(params.jobId, "fallback_log")
        ? await repository.readArtifact<FallbackEvent[]>(params.jobId, "fallback_log")
        : [];
      const failures = fallbackEventsToFailureRecords(fallbackEvents);
      const report = buildDiagnosticsReport({
        failures,
        modelRoutes: Object.values(buildModelRoutingTable(env)),
        missingAssetStates: job.warning_list.filter((warning) => /asset|catalog/i.test(warning)),
        fontLoadingStates: job.warning_list.filter((warning) => /font|typography/i.test(warning)),
        renderWarnings: job.warning_list.filter((warning) => /render|preview|video|duration/i.test(warning))
      });

      return {
        jobId: params.jobId,
        currentStage: job.current_stage,
        diagnostics: report
      };
    } catch {
      reply.code(404);
      return {
        error: "Diagnostics not found."
      };
    }
  });

  await registerEditSessionRoutes(app, editSessions, editSessionStore, josephUploadPipeline);
  await registerGodRoutes(app, god);
  await registerMusicCatalogRoutes(app, {
    env,
    repository,
    signMusicPreviewUrl: musicPreviewUrlSigner,
    r2Service
  });
  await registerThumbnailRoutes(app, {
    app,
    service,
    repository,
    queue,
    editSessions,
    maulProjects,
    maulControlPlane,
    god,
    videoContexts,
    executionTelemetry,
    env
  });
  await registerUploadRoutes(app, {
    env,
    queue,
    editSessions,
    editSessionStore,
    r2Service,
    josephUploadPipeline
  });
  registerJosephStudyCandidateRoutes(app, josephStudyCandidateGenerator);
  await registerVideoContextRoutes(app, videoContexts);
  await registerRenderJobRoutes(app);
  registerMaulProjectRoutes(app, maulProjects);
  registerMaulControlPlaneRoutes(
    app,
    maulControlPlane,
    envOverrides?.MAUL_WORKER_TOKEN ?? process.env.MAUL_WORKER_TOKEN ?? "",
    maulProjects,
    maulLearning
  );

  return {
    app,
    service,
    repository,
    queue,
    editSessions,
    maulProjects,
    maulControlPlane,
    god,
    videoContexts,
    executionTelemetry,
    env
  };
};
