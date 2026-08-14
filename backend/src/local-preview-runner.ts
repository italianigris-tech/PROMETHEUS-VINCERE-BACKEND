import type {FastifyRequest} from "fastify";
import {spawn, type ChildProcess} from "node:child_process";
import {createHash} from "node:crypto";
import {createWriteStream} from "node:fs";
import {mkdir, readFile, readdir, rm, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import {pipeline as streamPipeline} from "node:stream/promises";

import {runFfmpegCommand} from "./sound-engine/ffmpeg";
import {rmWithRetry, toUncPath} from "./path-utils";
import {
  DEFAULT_LOCAL_PREVIEW_CAPTION_PROFILE_ID,
  normalizeLocalPreviewCaptionProfileId,
  type LocalPreviewCaptionProfileId
} from "./editorial-contract";

const BACKEND_ROOT = process.cwd();
const WORKSPACE_ROOT = path.resolve(BACKEND_ROOT, "..");
const REMOTION_APP_ROOT = path.join(WORKSPACE_ROOT, "remotion-app");
const REMOTION_DATA_DIR = path.join(REMOTION_APP_ROOT, "src", "data");
const REMOTION_PUBLIC_DIR = path.join(REMOTION_APP_ROOT, "public");
const STATUS_PATH = path.join(BACKEND_ROOT, "data", "local-preview-status.json");
const UPLOAD_CACHE_DIR = path.join(REMOTION_APP_ROOT, ".cache", "local-preview-uploads");
const AUDIO_PREVIEW_CACHE_DIR = path.join(REMOTION_APP_ROOT, ".cache", "audio-preview");
const DRAFT_CACHE_DIR = path.join(REMOTION_APP_ROOT, ".cache", "draft-preview");
const MASTER_CACHE_DIR = path.join(REMOTION_APP_ROOT, ".cache", "master-render");
const TSX_CLI_ENTRY = path.join(REMOTION_APP_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const CAPTIONS_SYNC_SCRIPT = path.join(REMOTION_APP_ROOT, "scripts", "captions-sync.ts");
const DRAFT_RENDER_SCRIPT = path.join(REMOTION_APP_ROOT, "scripts", "draft-preview-longform.ts");
const MASTER_RENDER_SCRIPT = path.join(REMOTION_APP_ROOT, "scripts", "master-render-longform.ts");
const LONGFORM_INGEST_MANIFEST_PATH = path.join(REMOTION_DATA_DIR, "ingest.longform.json");
const LONGFORM_CAPTIONS_PATH = path.join(REMOTION_DATA_DIR, "captions.longform.json");
const LONGFORM_VIDEO_METADATA_PATH = path.join(REMOTION_DATA_DIR, "video.longform.metadata.json");
const LONGFORM_DRAFT_MANIFEST_PATH = path.join(REMOTION_PUBLIC_DIR, "draft-previews", "longform", "current.manifest.json");
const LONGFORM_MASTER_MANIFEST_PATH = path.join(REMOTION_PUBLIC_DIR, "master-renders", "longform", "current.manifest.json");
const STRIP_ANSI_PATTERN = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const LOCAL_PREVIEW_ABORT_MESSAGE = "The current local preview run was aborted.";
const AUDIO_PREVIEW_CONTENT_TYPE = "audio/mp4";

const LONGFORM_DERIVED_PATHS = [
  path.join(REMOTION_PUBLIC_DIR, "draft-previews", "longform"),
  path.join(REMOTION_PUBLIC_DIR, "master-renders", "longform"),
  path.join(REMOTION_PUBLIC_DIR, "input-video-landscape.draft.m4a"),
  path.join(REMOTION_PUBLIC_DIR, "input-video-landscape.mp4"),
  path.join(REMOTION_PUBLIC_DIR, "input-video-landscape.poster.webp"),
  path.join(REMOTION_PUBLIC_DIR, "input-video-landscape.preview.mp4"),
  path.join(REMOTION_PUBLIC_DIR, "input-video-landscape.preview.manifest.json"),
  path.join(REMOTION_PUBLIC_DIR, "input-video-landscape.preview.poster.webp"),
  path.join(REMOTION_APP_ROOT, "out"),
  AUDIO_PREVIEW_CACHE_DIR,
  DRAFT_CACHE_DIR,
  MASTER_CACHE_DIR
] as const;

const MOTION_TIERS = ["auto", "minimal", "editorial", "premium", "hero"] as const;
const TRANSCRIPTION_MODES = ["assemblyai"] as const;
const DELIVERY_MODES = ["speed-draft", "master-render"] as const;

type CaptionProfileId = LocalPreviewCaptionProfileId;
type MotionTier = (typeof MOTION_TIERS)[number];
type TranscriptionMode = (typeof TRANSCRIPTION_MODES)[number];
type DeliveryMode = (typeof DELIVERY_MODES)[number];
type LocalPreviewStage = "idle" | "cleaning" | "ingesting" | "drafting" | "mastering" | "completed" | "failed";
type LocalPreviewState = "idle" | "running" | "completed" | "failed";
type LocalPreviewOutputKind = "none" | "source-preview" | "speed-draft" | "master-render";

export const resolveLocalPreviewRenderPlan = (deliveryMode: DeliveryMode): {
  renderDraft: false;
  renderMaster: boolean;
} => ({
  renderDraft: false,
  renderMaster: deliveryMode === "master-render"
});

type LocalPreviewPipelineStatus = {
  state: LocalPreviewState;
  stage: LocalPreviewStage;
  stageLabel: string;
  sourceVideoPath: string | null;
  sourceDisplayName: string | null;
  uploadedFromBrowser: boolean;
  deliveryMode: DeliveryMode;
  activeOutputKind: LocalPreviewOutputKind;
  cleanRun: boolean;
  captionProfileId: CaptionProfileId;
  motionTier: MotionTier;
  transcriptionMode: TranscriptionMode;
  startedAt: string | null;
  finishedAt: string | null;
  outputUrl: string | null;
  outputPath: string | null;
  draftOutputUrl: string | null;
  draftOutputPath: string | null;
  masterOutputUrl: string | null;
  masterOutputPath: string | null;
  errorMessage: string | null;
  stageTimingsMs: {
    cleanup: number;
    ingest: number;
    draftRender: number;
    masterRender: number;
    render: number;
    total: number;
  };
  ingestSummary: {
    syncState?: string;
    transcriptionProvider?: string;
    transcriptionMode?: string;
    sourceVideoHash?: string;
  } | null;
  draftManifest: Record<string, unknown> | null;
  masterManifest: Record<string, unknown> | null;
  logs: string[];
};

type LocalPreviewRunRequest = {
  sourceVideoPath: string;
  uploadedFilePath: string | null;
  sourceDisplayName: string;
  uploadedFromBrowser: boolean;
  cleanRun: boolean;
  captionProfileId: CaptionProfileId;
  motionTier: MotionTier;
  transcriptionMode: TranscriptionMode;
  deliveryMode: DeliveryMode;
};

type LocalPreviewInstantPreview = {
  ready: boolean;
  videoUrl: string | null;
  sourceDisplayName: string | null;
  captionProfileId: CaptionProfileId;
  motionTier: MotionTier;
  generatedAt: string | null;
  videoMetadata: Record<string, unknown> | null;
  captions: Array<Record<string, unknown>>;
  motionSummary: {
    selected: number;
    flagged: number;
    suppressed: number;
  };
};

export type LocalPreviewAudioPreviewAsset = {
  assetId: string;
  audioUrl: string;
  contentType: string;
  filePath: string;
  fileSizeBytes: number;
  sourceDisplayName: string;
};

export type LocalPreviewRunnerDependencies = {
  extractAudioPreviewFile?: (input: {sourcePath: string; outputPath: string}) => Promise<void>;
};

const defaultStatus = (): LocalPreviewPipelineStatus => ({
  state: "idle",
  stage: "idle",
  stageLabel: "Ready for a new live compositor preview.",
  sourceVideoPath: null,
  sourceDisplayName: null,
  uploadedFromBrowser: false,
  deliveryMode: "speed-draft",
  activeOutputKind: "none",
  cleanRun: true,
  captionProfileId: DEFAULT_LOCAL_PREVIEW_CAPTION_PROFILE_ID,
  motionTier: "premium",
  transcriptionMode: "assemblyai",
  startedAt: null,
  finishedAt: null,
  outputUrl: null,
  outputPath: null,
  draftOutputUrl: null,
  draftOutputPath: null,
  masterOutputUrl: null,
  masterOutputPath: null,
  errorMessage: null,
  stageTimingsMs: {
    cleanup: 0,
    ingest: 0,
    draftRender: 0,
    masterRender: 0,
    render: 0,
    total: 0
  },
  ingestSummary: null,
  draftManifest: null,
  masterManifest: null,
  logs: []
});

const readJsonIfExists = async <T>(filePath: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const ensureWithinDirectory = (targetPath: string, rootPath: string, label: string): string => {
  const resolved = path.resolve(targetPath);
  const normalizedRoot = `${path.resolve(rootPath)}${path.sep}`;
  const normalizedTarget = `${resolved}${path.sep}`;

  if (!normalizedTarget.startsWith(normalizedRoot) && resolved !== path.resolve(rootPath)) {
    throw new Error(`Refusing to touch a path outside ${label}: ${targetPath}`);
  }

  return resolved;
};

const ensureWithinRoot = (targetPath: string): string => {
  return ensureWithinDirectory(targetPath, REMOTION_APP_ROOT, "the Remotion workspace");
};

const defaultExtractAudioPreviewFile = async ({
  sourcePath,
  outputPath
}: {
  sourcePath: string;
  outputPath: string;
}): Promise<void> => {
  await runFfmpegCommand([
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    sourcePath,
    "-map",
    "0:a:0",
    "-vn",
    "-ac",
    "2",
    "-ar",
    "48000",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath
  ]);
};

const isSkippableCleanupError = (error: unknown): boolean => {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENOENT" || code === "EPERM" || code === "EACCES" || code === "EBUSY";
};

const trimLogs = (logs: string[]): string[] => {
  return logs.slice(-120);
};

const sanitizeLogChunk = (value: string): string[] => {
  return value
    .replace(STRIP_ANSI_PATTERN, "")
    .replace(/\u0000/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
};

const sanitizeFileName = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
};

const parseBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
      return false;
    }
  }

  return fallback;
};

const sanitizeCaptionProfileId = (value: unknown): CaptionProfileId => {
  return normalizeLocalPreviewCaptionProfileId(value);
};

const sanitizeMotionTier = (value: unknown): MotionTier => {
  return MOTION_TIERS.includes(value as MotionTier)
    ? value as MotionTier
    : "premium";
};

const sanitizeTranscriptionMode = (value: unknown): TranscriptionMode => {
  return TRANSCRIPTION_MODES.includes(value as TranscriptionMode)
    ? value as TranscriptionMode
    : "assemblyai";
};

const sanitizeDeliveryMode = (value: unknown): DeliveryMode => {
  return DELIVERY_MODES.includes(value as DeliveryMode)
    ? value as DeliveryMode
    : "speed-draft";
};

const toStageLabel = (stage: LocalPreviewStage): string => {
  switch (stage) {
    case "idle":
      return "Ready for a new live compositor preview.";
    case "cleaning":
      return "Resetting stale long-form outputs.";
    case "ingesting":
      return "Building the AssemblyAI transcript, captions, and motion plan.";
    case "drafting":
      return "Preparing the draft preview output.";
    case "mastering":
      return "The draft preview is ready. Rendering the final MP4 now.";
    case "completed":
      return "Render pipeline complete.";
    case "failed":
      return "Render pipeline failed.";
  }
};

const normalizePersistedStatus = (
  persisted: Partial<LocalPreviewPipelineStatus>
): LocalPreviewPipelineStatus => {
  const baseline = defaultStatus();
  return {
    ...baseline,
    ...persisted,
    stageTimingsMs: {
      ...baseline.stageTimingsMs,
      ...(persisted.stageTimingsMs ?? {})
    },
    ingestSummary: persisted.ingestSummary ?? null,
    draftManifest: persisted.draftManifest ?? null,
    masterManifest: persisted.masterManifest ?? null,
    logs: Array.isArray(persisted.logs) ? persisted.logs : []
  };
};

const resolveManifestOutput = ({
  manifest,
  fallbackUrl,
  fallbackPath
}: {
  manifest: Record<string, unknown> | null;
  fallbackUrl: string;
  fallbackPath: string;
}): {outputUrl: string; outputPath: string} => {
  const outputUrl =
    manifest && typeof manifest.outputUrl === "string" && manifest.outputUrl.trim()
      ? manifest.outputUrl
      : fallbackUrl;
  const outputPath =
    manifest && typeof manifest.outputPath === "string" && manifest.outputPath.trim()
      ? manifest.outputPath
      : fallbackPath;

  return {
    outputUrl,
    outputPath
  };
};

const toPublicUrlFromRemotionPath = (filePath: string | null | undefined): string | null => {
  const normalized = filePath?.trim();
  if (!normalized) {
    return null;
  }

  const resolved = path.resolve(normalized);
  const relative = path.relative(REMOTION_PUBLIC_DIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return `/${relative.replace(/\\/g, "/")}`;
};

const readNumber = (value: unknown): number => {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

const appendLog = (
  status: LocalPreviewPipelineStatus,
  message: string
): LocalPreviewPipelineStatus => {
  const nextLogs = trimLogs([
    ...status.logs,
    `[${new Date().toLocaleTimeString()}] ${message}`
  ]);

  return {
    ...status,
    logs: nextLogs
  };
};

export class LocalPreviewRunner {
  private activeRun: Promise<void> | null = null;
  private activeChild: ChildProcess | null = null;
  private abortRequested = false;
  private status: LocalPreviewPipelineStatus = defaultStatus();
  private readonly deps: LocalPreviewRunnerDependencies;

  public constructor(deps: LocalPreviewRunnerDependencies = {}) {
    this.deps = deps;
    void this.hydrateStatus();
  }

  private async hydrateStatus(): Promise<void> {
    const persisted = await readJsonIfExists<LocalPreviewPipelineStatus>(STATUS_PATH);
    if (persisted) {
      this.status = normalizePersistedStatus(persisted);
      if (persisted.state === "running") {
        this.status = {
          ...this.status,
          state: "failed",
          stage: "failed",
          stageLabel: toStageLabel("failed"),
          finishedAt: new Date().toISOString(),
          errorMessage: persisted.errorMessage ?? "The previous backend session ended before the run finished."
        };
        await this.persistStatus();
      }
    }
  }

  private async persistStatus(): Promise<void> {
    await mkdir(path.dirname(STATUS_PATH), {recursive: true});
    await writeFile(STATUS_PATH, `${JSON.stringify(this.status, null, 2)}\n`, "utf-8");
  }

  public async getStatus(): Promise<LocalPreviewPipelineStatus> {
    const persisted = await readJsonIfExists<LocalPreviewPipelineStatus>(STATUS_PATH);
    if (persisted) {
      this.status = normalizePersistedStatus(persisted);
    }
    return this.status;
  }

  public async getInstantPreview(): Promise<LocalPreviewInstantPreview> {
    const manifest = await readJsonIfExists<Record<string, unknown>>(LONGFORM_INGEST_MANIFEST_PATH);
    const outputs = manifest?.outputs && typeof manifest.outputs === "object"
      ? manifest.outputs as Record<string, unknown>
      : null;
    const videoUrl = toPublicUrlFromRemotionPath(
      typeof outputs?.videoPublicPath === "string" ? outputs.videoPublicPath : null
    );
    const captions = await readJsonIfExists<Array<Record<string, unknown>>>(LONGFORM_CAPTIONS_PATH);
    const videoMetadata = await readJsonIfExists<Record<string, unknown>>(LONGFORM_VIDEO_METADATA_PATH);
    const ready = manifest?.syncState === "ready" && Boolean(videoUrl && captions && videoMetadata);

    return {
      ready,
      videoUrl: ready ? videoUrl : null,
      sourceDisplayName: typeof manifest?.sourceVideoPath === "string" ? path.basename(manifest.sourceVideoPath) : null,
      captionProfileId: sanitizeCaptionProfileId(manifest?.captionProfileId),
      motionTier: sanitizeMotionTier(manifest?.resolvedMotionTier ?? manifest?.requestedMotionTier),
      generatedAt: typeof manifest?.generatedAt === "string" ? manifest.generatedAt : null,
      videoMetadata: ready ? videoMetadata : null,
      captions: ready ? captions ?? [] : [],
      motionSummary: {
        selected: readNumber(manifest?.selectedMotionMomentCount),
        flagged: readNumber(manifest?.flaggedMotionMomentCount),
        suppressed: readNumber(manifest?.suppressedMotionMomentCount)
      }
    };
  }

  public async createAudioPreviewAsset(req: FastifyRequest): Promise<LocalPreviewAudioPreviewAsset> {
    const request = await this.parseRunRequest(req);
    const uploadedTempPath = request.uploadedFilePath;

    try {
      return await this.createAudioPreviewAssetFromRequest(request);
    } finally {
      if (uploadedTempPath) {
        await rm(uploadedTempPath, {force: true});
      }
    }
  }

  public async getAudioPreviewAsset(assetId: string): Promise<LocalPreviewAudioPreviewAsset> {
    const normalizedAssetId = this.normalizeAudioPreviewAssetId(assetId);
    const outputPath = this.resolveAudioPreviewAssetPath(normalizedAssetId);
    const outputStats = await stat(outputPath).catch(() => null);
    if (!outputStats?.isFile()) {
      throw new Error("Audio preview asset not found.");
    }

    return {
      assetId: normalizedAssetId,
      audioUrl: `/api/local-preview/audio-preview/${normalizedAssetId}`,
      contentType: AUDIO_PREVIEW_CONTENT_TYPE,
      filePath: outputPath,
      fileSizeBytes: outputStats.size,
      sourceDisplayName: path.basename(outputPath, path.extname(outputPath))
    };
  }

  public async parseRunRequest(req: FastifyRequest): Promise<LocalPreviewRunRequest> {
    if (!req.isMultipart()) {
      const body = (req.body as Record<string, unknown> | null | undefined) ?? {};
      return this.normalizeRunRequest({
        sourcePath: typeof body.sourcePath === "string" ? body.sourcePath : "",
        cleanRun: body.cleanRun,
        captionProfileId: body.captionProfileId,
        motionTier: body.motionTier,
        transcriptionMode: body.transcriptionMode,
        deliveryMode: body.deliveryMode
      });
    }

    await mkdir(UPLOAD_CACHE_DIR, {recursive: true});

    const fields: Record<string, string> = {};
    let uploadedFilePath: string | null = null;
    let uploadedFileName: string | null = null;

    for await (const part of req.parts()) {
      if (part.type === "file") {
        if (part.fieldname !== "source_video") {
          await part.toBuffer();
          continue;
        }

        const safeFileName = sanitizeFileName(part.filename || `upload-${Date.now()}.mp4`);
        const targetPath = path.join(UPLOAD_CACHE_DIR, `${Date.now()}-${safeFileName}`);
        const writeStream = createWriteStream(targetPath);
        await streamPipeline(part.file, writeStream);
        uploadedFilePath = targetPath;
        uploadedFileName = part.filename || safeFileName;
        continue;
      }

      fields[part.fieldname] = String(part.value ?? "").trim();
    }

    return this.normalizeRunRequest({
      sourcePath: fields.sourcePath,
      uploadedFilePath,
      uploadedFileName,
      cleanRun: fields.cleanRun,
      captionProfileId: fields.captionProfileId,
      motionTier: fields.motionTier,
      transcriptionMode: fields.transcriptionMode,
      deliveryMode: fields.deliveryMode
    });
  }

  private normalizeRunRequest({
    sourcePath,
    uploadedFilePath = null,
    uploadedFileName = null,
    cleanRun,
    captionProfileId,
    motionTier,
    transcriptionMode,
    deliveryMode
  }: {
    sourcePath?: string;
    uploadedFilePath?: string | null;
    uploadedFileName?: string | null;
    cleanRun?: unknown;
    captionProfileId?: unknown;
    motionTier?: unknown;
    transcriptionMode?: unknown;
    deliveryMode?: unknown;
  }): LocalPreviewRunRequest {
    const normalizedSourcePath = uploadedFilePath
      ? path.resolve(uploadedFilePath)
      : path.resolve(String(sourcePath ?? "").trim());

    if (!uploadedFilePath && !String(sourcePath ?? "").trim()) {
      throw new Error("Choose a source media file or provide a local source path.");
    }

    return {
      sourceVideoPath: normalizedSourcePath,
      uploadedFilePath,
      sourceDisplayName: uploadedFileName?.trim() || path.basename(normalizedSourcePath),
      uploadedFromBrowser: Boolean(uploadedFilePath),
      cleanRun: parseBoolean(cleanRun, true),
      captionProfileId: sanitizeCaptionProfileId(captionProfileId),
      motionTier: sanitizeMotionTier(motionTier),
      transcriptionMode: sanitizeTranscriptionMode(transcriptionMode),
      deliveryMode: sanitizeDeliveryMode(deliveryMode)
    };
  }

  public async startRun(request: LocalPreviewRunRequest): Promise<LocalPreviewPipelineStatus> {
    if (this.activeRun) {
      throw new Error("A full animated draft run is already in progress.");
    }

    if (!await fileExists(request.sourceVideoPath)) {
      throw new Error(`Source video not found: ${request.sourceVideoPath}`);
    }

    this.status = {
      ...defaultStatus(),
      state: "running",
      stage: "cleaning",
      stageLabel: toStageLabel("cleaning"),
      sourceVideoPath: request.sourceVideoPath,
      sourceDisplayName: request.sourceDisplayName,
      uploadedFromBrowser: request.uploadedFromBrowser,
      deliveryMode: request.deliveryMode,
      cleanRun: request.cleanRun,
      captionProfileId: request.captionProfileId,
      motionTier: request.motionTier,
      transcriptionMode: request.transcriptionMode,
      startedAt: new Date().toISOString()
    };
    this.status = appendLog(
      this.status,
      request.cleanRun
        ? "Clean run requested. Keeping reusable transcript and asset caches, clearing stale long-form outputs only."
        : "Skipping cleanup and reusing the current long-form working set."
    );
    await this.persistStatus();
    this.abortRequested = false;

    this.activeRun = this.runPipeline(request)
      .catch(() => undefined)
      .finally(() => {
        this.activeChild = null;
        this.abortRequested = false;
        this.activeRun = null;
      });

    return this.status;
  }

  private async createAudioPreviewAssetFromRequest(
    request: LocalPreviewRunRequest
  ): Promise<LocalPreviewAudioPreviewAsset> {
    if (!await fileExists(request.sourceVideoPath)) {
      throw new Error(`Source media not found: ${request.sourceVideoPath}`);
    }

    await mkdir(AUDIO_PREVIEW_CACHE_DIR, {recursive: true});
    const assetId = await this.buildAudioPreviewAssetId(request.sourceVideoPath);
    const outputPath = this.resolveAudioPreviewAssetPath(assetId);

    if (!await fileExists(outputPath)) {
      const extractAudioPreviewFile = this.deps.extractAudioPreviewFile ?? defaultExtractAudioPreviewFile;
      await extractAudioPreviewFile({
        sourcePath: request.sourceVideoPath,
        outputPath
      });
    }

    const outputStats = await stat(outputPath).catch(() => null);
    if (!outputStats?.isFile() || outputStats.size <= 0) {
      throw new Error("The audio preview asset could not be created.");
    }

    return {
      assetId,
      audioUrl: `/api/local-preview/audio-preview/${assetId}`,
      contentType: AUDIO_PREVIEW_CONTENT_TYPE,
      filePath: outputPath,
      fileSizeBytes: outputStats.size,
      sourceDisplayName: request.sourceDisplayName
    };
  }

  private async buildAudioPreviewAssetId(sourcePath: string): Promise<string> {
    const sourceStats = await stat(sourcePath);
    return createHash("sha1")
      .update(path.resolve(sourcePath))
      .update(String(sourceStats.size))
      .update(String(Math.round(sourceStats.mtimeMs)))
      .digest("hex")
      .slice(0, 20);
  }

  private normalizeAudioPreviewAssetId(assetId: string): string {
    const normalized = assetId.trim().toLowerCase();
    if (!/^[a-f0-9]{20}$/.test(normalized)) {
      throw new Error("Audio preview asset not found.");
    }
    return normalized;
  }

  private resolveAudioPreviewAssetPath(assetId: string): string {
    return ensureWithinDirectory(
      path.join(AUDIO_PREVIEW_CACHE_DIR, `${assetId}.m4a`),
      AUDIO_PREVIEW_CACHE_DIR,
      "the audio preview cache"
    );
  }

  public async reset(): Promise<LocalPreviewPipelineStatus> {
    if (this.activeRun) {
      this.status = appendLog(this.status, "Abort requested. Stopping the current render lane before clearing the workspace.");
      await this.persistStatus();
      await this.abortRun();
    }

    await this.cleanupLongformArtifacts();
    this.status = defaultStatus();
    await this.persistStatus();
    return this.status;
  }

  private async runPipeline(request: LocalPreviewRunRequest): Promise<void> {
    const startedAtMs = Date.now();
    const uploadedTempPath = request.uploadedFilePath;

    try {
      this.throwIfAbortRequested();

      if (request.cleanRun) {
        const cleanupStartedAt = Date.now();
        await this.cleanupLongformArtifacts();
        this.status = appendLog(this.status, "Removed stale draft/master MP4s, proxies, manifests, and local render caches.");
        this.status = {
          ...this.status,
          stageTimingsMs: {
            ...this.status.stageTimingsMs,
            cleanup: Date.now() - cleanupStartedAt
          }
        };
        await this.persistStatus();
      }

      this.throwIfAbortRequested();

      this.status = {
        ...this.status,
        stage: "ingesting",
        stageLabel: toStageLabel("ingesting")
      };
      this.status = appendLog(this.status, `Starting long-form ingest for ${request.sourceDisplayName}.`);
      await this.persistStatus();

      const ingestStartedAt = Date.now();
      await this.runRemotionCommand({
        label: "Long-form ingest",
        args: [
          TSX_CLI_ENTRY,
          CAPTIONS_SYNC_SCRIPT,
          "--presentation",
          "long-form",
          "--video",
          request.sourceVideoPath,
          "--caption-profile",
          request.captionProfileId,
          "--motion-tier",
          request.motionTier,
          "--transcription-mode",
          request.transcriptionMode,
          "--skip-preview-proxy"
        ],
        onChunk: async (chunk) => {
          this.status = appendLog(this.status, chunk);
          await this.persistStatus();
        }
      });

      const ingestManifest = await readJsonIfExists<Record<string, unknown>>(LONGFORM_INGEST_MANIFEST_PATH);
      this.status = {
        ...this.status,
        ingestSummary: ingestManifest ? {
          syncState: typeof ingestManifest.syncState === "string" ? ingestManifest.syncState : undefined,
          transcriptionProvider: typeof ingestManifest.transcriptionProvider === "string" ? ingestManifest.transcriptionProvider : undefined,
          transcriptionMode: typeof ingestManifest.transcriptionMode === "string" ? ingestManifest.transcriptionMode : undefined,
          sourceVideoHash: typeof ingestManifest.sourceVideoHash === "string" ? ingestManifest.sourceVideoHash : undefined
        } : null,
        stageTimingsMs: {
          ...this.status.stageTimingsMs,
          ingest: Date.now() - ingestStartedAt
        }
      };
      const renderPlan = resolveLocalPreviewRenderPlan(request.deliveryMode);
      this.status = appendLog(this.status, renderPlan.renderMaster
        ? "Long-form ingest finished. Browser preview is ready; starting one final render."
        : "Long-form ingest finished. Browser preview is ready; no backend preview MP4 was rendered.");
      await this.persistStatus();

      this.throwIfAbortRequested();

      if (!renderPlan.renderMaster) {
        this.status = {
          ...this.status,
          state: "completed",
          stage: "completed",
          stageLabel: toStageLabel("completed"),
          finishedAt: new Date().toISOString(),
          activeOutputKind: "source-preview",
          errorMessage: null,
          stageTimingsMs: {
            ...this.status.stageTimingsMs,
            total: Date.now() - startedAtMs
          }
        };
        await this.persistStatus();
        return;
      }

      this.status = {
        ...this.status,
        stage: "mastering",
        stageLabel: toStageLabel("mastering")
      };
      await this.persistStatus();

      const masterRenderStartedAt = Date.now();
      await this.runRemotionCommand({
        label: "Master render",
        args: [
          TSX_CLI_ENTRY,
          MASTER_RENDER_SCRIPT,
          "--caption-profile",
          request.captionProfileId,
          "--motion-tier",
          request.motionTier,
          "--force"
        ],
        onChunk: async (chunk) => {
          this.status = appendLog(this.status, chunk);
          await this.persistStatus();
        }
      });

      const masterManifest = await readJsonIfExists<Record<string, unknown>>(LONGFORM_MASTER_MANIFEST_PATH);
      const masterOutput = resolveManifestOutput({
        manifest: masterManifest,
        fallbackUrl: "/master-renders/longform/current.mp4",
        fallbackPath: path.join(REMOTION_PUBLIC_DIR, "master-renders", "longform", "current.mp4")
      });
      const masterRenderElapsed = Date.now() - masterRenderStartedAt;

      this.status = appendLog(this.status, "Master render complete.");
      this.status = {
        ...this.status,
        state: "completed",
        stage: "completed",
        stageLabel: toStageLabel("completed"),
        finishedAt: new Date().toISOString(),
        outputUrl: masterOutput.outputUrl,
        outputPath: masterOutput.outputPath,
        masterOutputUrl: masterOutput.outputUrl,
        masterOutputPath: masterOutput.outputPath,
        activeOutputKind: "master-render",
        masterManifest,
        errorMessage: null,
        stageTimingsMs: {
          ...this.status.stageTimingsMs,
          masterRender: masterRenderElapsed,
          render: masterRenderElapsed,
          total: Date.now() - startedAtMs
        }
      };
      await this.persistStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.status = appendLog(this.status, message);
      this.status = {
        ...this.status,
        state: "failed",
        stage: "failed",
        stageLabel: toStageLabel("failed"),
        finishedAt: new Date().toISOString(),
        outputUrl: this.status.outputUrl,
        outputPath: this.status.outputPath,
        errorMessage: message,
        stageTimingsMs: {
          ...this.status.stageTimingsMs,
          total: Date.now() - startedAtMs
        }
      };
      await this.persistStatus();
      throw error;
    } finally {
      if (uploadedTempPath) {
        await rm(uploadedTempPath, {force: true});
      }
    }
  }

  private async runRemotionCommand({
    label,
    args,
    onChunk
  }: {
    label: string;
    args: string[];
    onChunk: (chunk: string) => Promise<void>;
  }): Promise<void> {
    await mkdir(REMOTION_APP_ROOT, {recursive: true});
    this.throwIfAbortRequested();

    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, args, {
        cwd: REMOTION_APP_ROOT,
        env: {
          ...process.env
        },
        stdio: ["ignore", "pipe", "pipe"]
      });
      this.activeChild = child;

      child.stdout.on("data", (chunk) => {
        void Promise.all(sanitizeLogChunk(String(chunk)).map((line) => onChunk(`${label}: ${line}`)));
      });

      child.stderr.on("data", (chunk) => {
        void Promise.all(sanitizeLogChunk(String(chunk)).map((line) => onChunk(`${label}: ${line}`)));
      });

      child.on("error", (error) => {
        if (this.activeChild === child) {
          this.activeChild = null;
        }

        if (this.abortRequested) {
          reject(new Error(LOCAL_PREVIEW_ABORT_MESSAGE));
          return;
        }

        reject(error);
      });
      child.on("close", (code) => {
        if (this.activeChild === child) {
          this.activeChild = null;
        }

        if (this.abortRequested) {
          reject(new Error(LOCAL_PREVIEW_ABORT_MESSAGE));
          return;
        }

        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`${label} exited with code ${code ?? "unknown"}.`));
      });
    });
  }

  private throwIfAbortRequested(): void {
    if (this.abortRequested) {
      throw new Error(LOCAL_PREVIEW_ABORT_MESSAGE);
    }
  }

  private async abortRun(): Promise<void> {
    if (!this.activeRun) {
      return;
    }

    this.abortRequested = true;
    await this.terminateActiveChild();
    await this.activeRun;
  }

  private async terminateActiveChild(): Promise<void> {
    const child = this.activeChild;

    if (!child?.pid) {
      return;
    }

    if (process.platform === "win32") {
      await new Promise<void>((resolve) => {
        const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
          stdio: "ignore"
        });

        killer.on("error", () => {
          try {
            child.kill();
          } catch {
            // Best effort only.
          }
          resolve();
        });

        killer.on("close", () => resolve());
      });
      return;
    }

    try {
      child.kill("SIGTERM");
    } catch {
      // Best effort only.
    }
  }

  private async cleanupLongformArtifacts(): Promise<void> {
    for (const targetPath of LONGFORM_DERIVED_PATHS) {
      try {
        await rmWithRetry(ensureWithinRoot(targetPath));
      } catch (error) {
        if (!isSkippableCleanupError(error)) {
          throw error;
        }
      }
    }

    const publicEntries = await readdir(REMOTION_PUBLIC_DIR).catch(() => []);
    for (const entry of publicEntries) {
      if (!entry.startsWith(".input-video-landscape.") && !entry.startsWith("input-video-landscape")) {
        continue;
      }

      try {
        await rmWithRetry(ensureWithinRoot(path.join(REMOTION_PUBLIC_DIR, entry)));
      } catch (error) {
        if (!isSkippableCleanupError(error)) {
          throw error;
        }
      }
    }
  }
}
