import type {FastifyRequest} from "fastify";
import {randomUUID} from "node:crypto";
import {createWriteStream} from "node:fs";
import path from "node:path";
import {rm, writeFile} from "node:fs/promises";
import {Transform} from "node:stream";
import {pipeline as streamPipeline} from "node:stream/promises";
import {z} from "zod";

import type {BackendEnv} from "./config";
import {FileJobRepository} from "./repository";
import {InProcessQueue, QueueBacklogLimitError} from "./queue";
import {
  createInitialJobRecord,
  type PipelineDependencies,
  processJobPipeline
} from "./pipeline";
import {
  buildPatternMemorySummary,
  defaultPatternMemoryStorePaths,
  readPatternMemorySnapshot,
  recordPatternMemoryOutcome,
  type PatternMemorySnapshot,
  type PatternUpdatePayload
} from "./pattern-memory";
import {
  type GenerateViralClipsRequest,
  type ClipSelection,
  type EditPlan,
  type ExecutionPlan,
  type JobRecord,
  type MetadataProfile,
  type NormalizedJobRequest,
  assetDescriptorSchema,
  generateViralClipsRequestBaseSchema,
  generateViralClipsRequestSchema,
  inputManifestSchema,
  jobRequestPayloadSchema,
  jobRequestJsonSchema,
  jobRecordSchema,
  normalizedJobRequestSchema,
  transcribedWordSchema
} from "./schemas";
import type {MotionPlanArtifact} from "./motion-plan";
import {createJobId} from "./utils/ids";

const JOB_REQUEST_PAYLOAD_SCHEMA = jobRequestPayloadSchema.partial();
const VIRAL_CLIP_REQUEST_SCHEMA = generateViralClipsRequestBaseSchema.partial();

type PartialRequestPayload = z.infer<typeof JOB_REQUEST_PAYLOAD_SCHEMA>;
type PartialViralClipRequestPayload = z.infer<typeof VIRAL_CLIP_REQUEST_SCHEMA>;

type MultipartNormalizationResult<TRequest> = {
  job_id: string;
  request_json: TRequest;
  source_video: NormalizedJobRequest["input_source_video"];
  assets: NormalizedJobRequest["input_assets"];
};

const TERMINAL_JOB_STAGES = new Set<JobRecord["current_stage"]>(["completed", "failed"]);

const nowIso = (deps: PipelineDependencies): string => {
  return deps.now ? deps.now() : new Date().toISOString();
};

const ensureJobHasInput = (request: NormalizedJobRequest): void => {
  if (
    !request.prompt.trim() &&
    !request.source_media_ref &&
    !request.input_source_video &&
    request.input_assets.length === 0 &&
    request.descriptor_assets.length === 0 &&
    (request.provided_transcript?.length ?? 0) === 0 &&
    !request.sound_design_manifest
  ) {
    throw new Error("Job submission must include a prompt, source media reference, source upload, asset, transcript, or sound design manifest.");
  }
};

const sanitizeFileName = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
};

const getMultipartFieldString = (part: {fields?: Record<string, unknown>}, key: string): string | undefined => {
  const candidate = part.fields?.[key];
  if (!candidate || typeof candidate !== "object") {
    return undefined;
  }
  const value = (candidate as {value?: unknown}).value;
  return typeof value === "string" ? value : undefined;
};

const writeMultipartFileToDisk = async (part: {file: NodeJS.ReadableStream & {truncated?: boolean}}, storedPath: string): Promise<number> => {
  let sizeBytes = 0;
  const countingStream = new Transform({
    transform(chunk, _encoding, callback) {
      sizeBytes += (chunk as Buffer).length;
      callback(null, chunk);
    }
  });

  try {
    await streamPipeline(part.file, countingStream, createWriteStream(storedPath));
  } catch (error) {
    await rm(storedPath, {force: true});
    throw error;
  }

  if (part.file.truncated) {
    await rm(storedPath, {force: true});
    throw new Error("The uploaded file exceeded the backend upload limit.");
  }

  return sizeBytes;
};

export class BackendService {
  public readonly repository: FileJobRepository;
  public readonly queue: InProcessQueue;
  public readonly env: BackendEnv;
  public readonly deps: PipelineDependencies;

  public constructor({
    repository,
    queue,
    env,
    deps
  }: {
    repository: FileJobRepository;
    queue: InProcessQueue;
    env: BackendEnv;
    deps: PipelineDependencies;
  }) {
    this.repository = repository;
    this.queue = queue;
    this.env = env;
    this.deps = deps;
  }

  public async initialize(): Promise<void> {
    await this.repository.initialize();
    await this.reconcileStaleJobs();
  }

  private async failJob(jobId: string, reason: string, note: string): Promise<void> {
    const stamp = nowIso(this.deps);
    const failedJob = await this.repository.updateJobRecord(jobId, (current) =>
      jobRecordSchema.parse({
        ...current,
        status: "failed",
        current_stage: "failed",
        updated_at: stamp,
        completed_at: stamp,
        error_message: reason,
        warning_list: Array.from(new Set(current.warning_list.concat([reason]))),
        stage_history: current.stage_history.concat([
          {
            stage: "failed",
            at: stamp,
            note
          }
        ]),
        progress: {
          current_step: 7,
          total_steps: 7,
          percent: 100
        }
      })
    );
    this.deps.executionTelemetry?.recordStageTransition(failedJob, note);
  }

  private async reconcileStaleJobs(): Promise<void> {
    const jobs = await this.repository.listJobRecords();
    if (jobs.length === 0) {
      return;
    }

    const now = nowIso(this.deps);
    const nowMs = Date.parse(now);
    if (!Number.isFinite(nowMs)) {
      return;
    }

    await Promise.all(
      jobs.map(async (job) => {
        if (TERMINAL_JOB_STAGES.has(job.current_stage)) {
          return;
        }

        const updatedAtMs = Date.parse(job.updated_at);
        if (!Number.isFinite(updatedAtMs)) {
          return;
        }

        const staleForMs = nowMs - updatedAtMs;
        if (staleForMs < this.env.JOB_STAGE_STALE_AFTER_MS) {
          return;
        }

        const reason =
          `Job became stale after ${staleForMs} ms in ${job.current_stage}. ` +
          "The previous worker likely exited before completing the pipeline.";
        const note =
          `Startup reconciliation marked the stale ${job.current_stage} job as failed ` +
          `after exceeding ${this.env.JOB_STAGE_STALE_AFTER_MS} ms.`;
        await this.failJob(job.job_id, reason, note);
      })
    );
  }

  public async normalizeMultipartRequest<TRequest>({
    req,
    requestSchema
  }: {
    req: FastifyRequest;
    requestSchema: z.ZodType<TRequest>;
  }): Promise<MultipartNormalizationResult<TRequest>> {
    const jobId = createJobId();
    await this.repository.ensureJobWorkspace(jobId);

    let requestJson: TRequest = requestSchema.parse({} as unknown);
    let sourceVideo: NormalizedJobRequest["input_source_video"] = null;
    const assets: NormalizedJobRequest["input_assets"] = [];
    let assetIndex = 0;

    for await (const part of req.parts()) {
      if (part.type === "field") {
        if (part.fieldname === "request_json") {
          requestJson = requestSchema.parse(JSON.parse(String(part.value ?? "{}")) as unknown);
        }
        continue;
      }

      const originalName = sanitizeFileName(part.filename || `${part.fieldname}-${assetIndex}`);
      const storedName = `${part.fieldname}-${assetIndex}-${originalName}`;
      const storedPath = path.join(this.repository.inputsDir(jobId), storedName);
      const sizeBytes = await writeMultipartFileToDisk(part, storedPath);

      const storedFile = {
        asset_id: `${part.fieldname}_${randomUUID()}`,
        role: (part.fieldname === "source_video" ? "source_video" : "asset") as "source_video" | "asset",
        original_name: part.filename || storedName,
        stored_path: storedPath,
        mime_type: part.mimetype || "application/octet-stream",
        label: getMultipartFieldString(part, "label"),
        size_bytes: sizeBytes
      };

      if (part.fieldname === "source_video" && !sourceVideo) {
        sourceVideo = storedFile;
      } else {
        assets.push(storedFile);
      }
      assetIndex += 1;
    }

    return {
      job_id: jobId,
      request_json: requestJson,
      source_video: sourceVideo,
      assets
    };
  }

  public async submitJsonJob(payload: unknown): Promise<JobRecord> {
    const parsed = jobRequestJsonSchema.parse(payload);
    const normalized = normalizedJobRequestSchema.parse({
      job_id: createJobId(),
      prompt: parsed.prompt ?? "",
      source_media_ref: parsed.source_media_ref,
      input_source_video: null,
      input_assets: [],
      descriptor_assets: parsed.assets,
      creator_niche: parsed.creator_niche,
      target_platform: parsed.target_platform,
      max_clip_count: parsed.max_clip_count,
      metadata_overrides: parsed.metadata_overrides,
      provided_transcript: parsed.provided_transcript,
      sound_design_manifest: parsed.sound_design_manifest
    });
    return this.submitNormalizedJob(normalized);
  }

  public async submitMultipartJob(req: FastifyRequest): Promise<JobRecord> {
    const normalizedMultipart = await this.normalizeMultipartRequest({
      req,
      requestSchema: JOB_REQUEST_PAYLOAD_SCHEMA
    });
    const requestJson = normalizedMultipart.request_json;
    const normalized = normalizedJobRequestSchema.parse({
      job_id: normalizedMultipart.job_id,
      prompt: requestJson.prompt ?? "",
      source_media_ref: requestJson.source_media_ref,
      input_source_video: normalizedMultipart.source_video,
      input_assets: normalizedMultipart.assets,
      descriptor_assets: (requestJson.assets ?? []).map((asset) => assetDescriptorSchema.parse(asset)),
      creator_niche: requestJson.creator_niche,
      target_platform: requestJson.target_platform,
      min_clip_count: undefined,
      max_clip_count: requestJson.max_clip_count,
      metadata_overrides: requestJson.metadata_overrides ?? {},
      provided_transcript: (requestJson.provided_transcript ?? []).map((word) => transcribedWordSchema.parse(word)),
      sound_design_manifest: requestJson.sound_design_manifest
    });
    return this.submitNormalizedJob(normalized);
  }

  public async submitViralClipJob(payload: unknown): Promise<JobRecord> {
    const parsed = generateViralClipsRequestSchema.parse(payload);
    const normalized = normalizedJobRequestSchema.parse({
      job_id: createJobId(),
      prompt: parsed.prompt?.trim() || `Generate viral clips for project ${parsed.projectId} video ${parsed.videoId}.`,
      source_media_ref: parsed.sourceMediaRef,
      project_id: parsed.projectId,
      video_id: parsed.videoId,
      input_source_video: null,
      input_assets: [],
      descriptor_assets: parsed.assets,
      creator_niche: parsed.creatorNiche,
      target_platform: parsed.targetPlatform,
      min_clip_count: parsed.clipCountMin,
      max_clip_count: parsed.clipCountMax,
      metadata_overrides: parsed.metadataOverrides,
      provided_transcript: parsed.providedTranscript,
      sound_design_manifest: parsed.soundDesignManifest
    });
    return this.submitNormalizedJob(normalized);
  }

  public async submitMultipartViralClipJob(req: FastifyRequest): Promise<JobRecord> {
    const normalizedMultipart = await this.normalizeMultipartRequest({
      req,
      requestSchema: VIRAL_CLIP_REQUEST_SCHEMA
    });
    const requestJson = normalizedMultipart.request_json as PartialViralClipRequestPayload;
    const normalized = normalizedJobRequestSchema.parse({
      job_id: normalizedMultipart.job_id,
      prompt:
        requestJson.prompt?.trim() ||
        `Generate viral clips for project ${requestJson.projectId ?? "unknown"} video ${requestJson.videoId ?? "unknown"}.`,
      source_media_ref: requestJson.sourceMediaRef,
      project_id: requestJson.projectId,
      video_id: requestJson.videoId,
      input_source_video: normalizedMultipart.source_video,
      input_assets: normalizedMultipart.assets,
      descriptor_assets: (requestJson.assets ?? []).map((asset) => assetDescriptorSchema.parse(asset)),
      creator_niche: requestJson.creatorNiche,
      target_platform: requestJson.targetPlatform,
      min_clip_count: requestJson.clipCountMin,
      max_clip_count: requestJson.clipCountMax,
      metadata_overrides: requestJson.metadataOverrides ?? {},
      provided_transcript: (requestJson.providedTranscript ?? []).map((word) => transcribedWordSchema.parse(word)),
      sound_design_manifest: requestJson.soundDesignManifest
    });
    return this.submitNormalizedJob(normalized);
  }

  public async submitNormalizedJob(normalizedRequest: NormalizedJobRequest): Promise<JobRecord> {
    const request = normalizedJobRequestSchema.parse(normalizedRequest);
    ensureJobHasInput(request);
    await this.repository.ensureJobWorkspace(request.job_id);

    const jobRecord = createInitialJobRecord({
      request,
      repository: this.repository,
      deps: this.deps
    });

    const inputManifest = inputManifestSchema.parse({
      job_id: request.job_id,
      created_at: jobRecord.created_at,
      prompt_excerpt: jobRecord.request_summary.prompt_excerpt,
      project_id: request.project_id ?? null,
      video_id: request.video_id ?? null,
      source_media_ref: request.source_media_ref ?? null,
      source_video: request.input_source_video,
      assets: request.input_assets,
      descriptor_assets: request.descriptor_assets,
      requested_clip_count_min: request.min_clip_count ?? null,
      requested_clip_count_max: request.max_clip_count ?? null,
      metadata_override_keys: Object.keys(request.metadata_overrides),
      has_provided_transcript: Boolean(request.provided_transcript?.length),
      has_sound_design_manifest: Boolean(request.sound_design_manifest)
    });

    await Promise.all([
      this.repository.createJobRecord(jobRecord),
      this.repository.writeArtifact(request.job_id, "input_manifest", inputManifest)
    ]);
    this.deps.executionTelemetry?.recordJobCreated(jobRecord);

    try {
      this.queue.enqueue(async () => {
        try {
          await processJobPipeline({
            request,
            repository: this.repository,
            env: this.env,
            deps: this.deps
          });
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          await this.failJob(request.job_id, reason, reason);
        }
      });
    } catch (error) {
      if (error instanceof QueueBacklogLimitError) {
        await this.failJob(
          request.job_id,
          error.message,
          "Queue admission rejected the job because the pending backlog was full."
        );
      }
      throw error;
    }

    return jobRecord;
  }

  public async getJob(jobId: string): Promise<JobRecord> {
    return this.repository.getJobRecord(jobId);
  }

  public async getMetadataProfile(jobId: string): Promise<MetadataProfile> {
    return this.repository.readArtifact<MetadataProfile>(jobId, "metadata_profile");
  }

  public async getEditPlan(jobId: string): Promise<EditPlan> {
    return this.repository.readArtifact<EditPlan>(jobId, "edit_plan");
  }

  public async getMotionPlan(jobId: string): Promise<MotionPlanArtifact> {
    return this.repository.readArtifact<MotionPlanArtifact>(jobId, "motion_plan");
  }

  public async getPatternMemorySnapshot(): Promise<PatternMemorySnapshot> {
    return readPatternMemorySnapshot();
  }

  public async getPatternMemorySummary(): Promise<ReturnType<typeof buildPatternMemorySummary>> {
    return buildPatternMemorySummary(await this.getPatternMemorySnapshot());
  }

  public async recordPatternMemoryOutcome(payload: PatternUpdatePayload) {
    return recordPatternMemoryOutcome(payload, defaultPatternMemoryStorePaths());
  }

  public async getClipSelection(jobId: string): Promise<ClipSelection> {
    return this.repository.readArtifact<ClipSelection>(jobId, "clip_selection");
  }

  public async getExecutionPlan(jobId: string): Promise<ExecutionPlan> {
    return this.repository.readArtifact<ExecutionPlan>(jobId, "execution_plan");
  }
}
