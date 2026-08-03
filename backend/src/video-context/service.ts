import {randomUUID} from "node:crypto";
import {createWriteStream} from "node:fs";
import path from "node:path";
import {pipeline as streamPipeline} from "node:stream/promises";

import type {FastifyRequest} from "fastify";
import {z} from "zod";

import type {BackendEnv} from "../config";
import {FileJobRepository} from "../repository";
import {InProcessQueue, QueueBacklogLimitError} from "../queue";
import {extractAudioChunkWithFfmpeg} from "./audio";
import type {VideoContextWorkerDependencies, VideoContextWorkerHost} from "./worker";
import {ProgressiveVideoContextWorker} from "./worker";
import {VideoContextStore} from "./store";
import type {TranscriptChunkPlan} from "./transcript";
import {
  backendMessageSchema,
  frontendMessageSchema,
  frontendReadinessHandshakeSchema,
  progressiveVideoContextEventSchema,
  progressiveVideoContextSnapshotSchema,
  type BackendMessage,
  type ConfigurationDelta,
  type FrontendMessage,
  type FrontendReadinessHandshake,
  type ProgressiveVideoContextEvent,
  type ProgressiveVideoContextSnapshot,
  type RenderGraphV2Handoff
} from "./contracts";

type VideoCreateInput = {
  prompt?: string;
  source_media_ref?: string;
  mode?: "progressive" | "one-shot";
};

const videoCreateJsonSchema = z.object({
  prompt: z.string().trim().optional(),
  source_media_ref: z.string().trim().optional(),
  mode: z.enum(["progressive", "one-shot"]).default("progressive")
});

const sanitizeFileName = (value: string): string => {
  const cleaned = path.basename(value).replace(/[^a-zA-Z0-9._-]/g, "-");
  return cleaned || "source-video.bin";
};

const createVideoId = (): string => {
  const stamp = Date.now().toString(36);
  const entropy = randomUUID().replace(/-/g, "").slice(0, 10);
  return `video_${stamp}_${entropy}`;
};

const nowIso = (deps: VideoContextWorkerDependencies): string => deps.now?.() ?? new Date().toISOString();

const buildInitialSnapshot = ({
  videoId,
  mode,
  fileSizeBytes,
  sourcePath
}: {
  videoId: string;
  mode: "progressive" | "one-shot";
  fileSizeBytes: number | null;
  sourcePath: string;
}): ProgressiveVideoContextSnapshot & {sourcePath: string} =>
  progressiveVideoContextSnapshotSchema.parse({
    schemaVersion: "prometheus-progressive-video-context/v1",
    videoId,
    status: "queued",
    mode,
    contextLevel: 1,
    contextVersion: 0,
    coverage: {
      transcriptComplete: false,
      motionComplete: false,
      renderPlanComplete: false,
      coveredTranscriptRangesMs: [],
      uncoveredRangesMs: []
    },
    staticContext: {
      capabilities: [
        "kinetic typography",
        "3D text",
        "UI animations",
        "transitions",
        "selective post-processing",
        "temporal sync handoff"
      ],
      motionPatterns: [
        "spring-rise",
        "compression-pop",
        "breathing-hold",
        "drift-line",
        "anticipation-nudge",
        "settle-lock",
        "micro-parallax",
        "pulse-emphasis",
        "camera-push",
        "focus-pull",
        "jitter-spark",
        "orbit-sweep"
      ],
      lusionCriteria: [
        "premium restraint",
        "readability first",
        "per-layer effects",
        "frame-locked timing"
      ],
      constraints: [
        "WebGL 2.0",
        "No EffectComposer recreation per frame",
        "uTime uniform must update every frame",
        "Audio release requires frontend readiness"
      ]
    },
    metadata: {
      durationMs: null,
      width: null,
      height: null,
      fps: null,
      aspectRatio: null,
      containerFormat: null,
      codecVideo: null,
      fileSizeBytes
    },
    transcript: {
      chunks: [],
      mergedWords: [],
      provider: "none",
      fallbackChain: ["assemblyai"]
    },
    motion: {
      segments: [],
      analysisComplete: false
    },
    handoff: {
      renderGraphReady: false,
      instructionalManualReady: false,
      configurationDeltaReady: false,
      frontendBriefingReady: false,
      audioReleased: false
    },
    warnings: []
  }) as ProgressiveVideoContextSnapshot & {sourcePath: string};

const attachSourcePath = (
  snapshot: ProgressiveVideoContextSnapshot,
  sourcePath: string
): ProgressiveVideoContextSnapshot & {sourcePath: string} => ({
  ...snapshot,
  sourcePath
});

export type VideoContextServiceDependencies = VideoContextWorkerDependencies;

export class VideoContextService implements VideoContextWorkerHost {
  private readonly subscribers = new Map<string, Set<(event: ProgressiveVideoContextEvent) => void>>();
  private readonly worker: ProgressiveVideoContextWorker;

  public constructor(
    public readonly env: BackendEnv,
    public readonly repository: FileJobRepository,
    private readonly queue: InProcessQueue,
    private readonly store: VideoContextStore,
    public readonly deps: VideoContextServiceDependencies = {}
  ) {
    this.worker = new ProgressiveVideoContextWorker(this);
  }

  public async initialize(): Promise<void> {
    await this.store.initialize();
  }

  public async createVideo(req: FastifyRequest): Promise<{
    videoId: string;
    initialAssistantMessage: string;
    context: ProgressiveVideoContextSnapshot;
    urls: Record<string, string>;
  }> {
    const videoId = createVideoId();
    await this.store.ensureVideoWorkspace(videoId);
    let input: VideoCreateInput = {mode: "progressive"};
    let sourcePath = "";
    let fileSizeBytes: number | null = null;

    if (req.isMultipart()) {
      for await (const part of req.parts()) {
        if (part.type === "field") {
          if (part.fieldname === "request_json") {
            input = videoCreateJsonSchema.parse(JSON.parse(String(part.value ?? "{}")) as unknown);
          }
          continue;
        }

        if (part.fieldname !== "source_video") {
          await part.toBuffer();
          continue;
        }

        const targetPath = path.join(
          this.store.sourceDir(videoId),
          `${Date.now()}-${sanitizeFileName(part.filename || "source-video.bin")}`
        );
        await streamPipeline(part.file, createWriteStream(targetPath));
        sourcePath = targetPath;
        const stats = await this.store.sourceStats(targetPath);
        fileSizeBytes = stats.size;
      }
    } else {
      input = videoCreateJsonSchema.parse(req.body ?? {});
      sourcePath = input.source_media_ref ?? "";
      if (sourcePath) {
        try {
          const stats = await this.store.sourceStats(sourcePath);
          fileSizeBytes = stats.size;
        } catch {
          fileSizeBytes = null;
        }
      }
    }

    if (!sourcePath) {
      throw new Error("Video context creation requires source_video or source_media_ref.");
    }

    const initialSnapshot = attachSourcePath(
      buildInitialSnapshot({
        videoId,
        mode: input.mode ?? "progressive",
        fileSizeBytes,
        sourcePath
      }),
      sourcePath
    );
    await this.store.writeSnapshot(initialSnapshot);
    await this.emit(videoId, "video.created", 0, {
      source: req.isMultipart() ? "multipart" : "source_media_ref"
    });
    await this.emit(videoId, "context.static.ready", 3, {
      capabilities: initialSnapshot.staticContext.capabilities
    });

    try {
      this.queue.enqueue(async () => {
        await this.worker.run(videoId);
      });
    } catch (error) {
      if (error instanceof QueueBacklogLimitError) {
        await this.updateSnapshot(videoId, (snapshot) => ({
          ...snapshot,
          status: "failed",
          warnings: snapshot.warnings.concat([error.message])
        }));
      }
      throw error;
    }

    return {
      videoId,
      initialAssistantMessage: "I'm analyzing your video now. You can ask about animation styles while the transcript and motion context hydrate.",
      context: initialSnapshot,
      urls: this.urlsFor(videoId)
    };
  }

  public async createVideoFromSource(
    sourcePath: string,
    mode: "progressive" | "one-shot" = "progressive"
  ): Promise<{
    videoId: string;
    context: ProgressiveVideoContextSnapshot;
    urls: Record<string, string>;
  }> {
    if (!sourcePath.trim()) {
      throw new Error("Video context creation requires a source path.");
    }
    const sourceStats = await this.store.sourceStats(sourcePath);
    const videoId = createVideoId();
    await this.store.ensureVideoWorkspace(videoId);
    const initialSnapshot = attachSourcePath(
      buildInitialSnapshot({
        videoId,
        mode,
        fileSizeBytes: sourceStats.size,
        sourcePath
      }),
      sourcePath
    );
    await this.store.writeSnapshot(initialSnapshot);
    await this.emit(videoId, "video.created", 0, {source: "canonical_r2_source"});
    await this.emit(videoId, "context.static.ready", 3, {
      capabilities: initialSnapshot.staticContext.capabilities
    });
    try {
      this.queue.enqueue(async () => {
        await this.worker.run(videoId);
      });
    } catch (error) {
      if (error instanceof QueueBacklogLimitError) {
        await this.updateSnapshot(videoId, (snapshot) => ({
          ...snapshot,
          status: "failed",
          warnings: snapshot.warnings.concat([error.message])
        }));
      }
      throw error;
    }
    return {
      videoId,
      context: initialSnapshot,
      urls: this.urlsFor(videoId)
    };
  }

  public urlsFor(videoId: string): Record<string, string> {
    return {
      status: `/api/videos/${videoId}`,
      context: `/api/videos/${videoId}/context`,
      progress: `/api/videos/${videoId}/progress`,
      chat: `/api/videos/${videoId}/chat`,
      renderGraph: `/api/videos/${videoId}/render-graph`,
      instructionalManual: `/api/videos/${videoId}/instructional-manual`,
      configurationDelta: `/api/videos/${videoId}/configuration-delta`,
      frontendBriefing: `/api/videos/${videoId}/frontend-briefing`,
      audio: `/api/videos/${videoId}/audio`,
      frontendReady: `/api/videos/${videoId}/frontend-ready`
    };
  }

  public async getSnapshot(videoId: string): Promise<ProgressiveVideoContextSnapshot & {sourcePath?: string}> {
    return this.store.readSnapshot(videoId) as Promise<ProgressiveVideoContextSnapshot & {sourcePath?: string}>;
  }

  public async getStatus(videoId: string) {
    const snapshot = await this.getSnapshot(videoId);
    const [renderGraph, instructionalManual, configurationDelta, frontendBriefing] = await Promise.all([
      this.store.artifactExists(videoId, "renderGraph"),
      this.store.artifactExists(videoId, "instructional-manual"),
      this.store.artifactExists(videoId, "configurationDelta"),
      this.store.artifactExists(videoId, "frontend-briefing")
    ]);
    return {
      videoId,
      status: snapshot.status,
      mode: snapshot.mode,
      contextLevel: snapshot.contextLevel,
      contextVersion: snapshot.contextVersion,
      progress: this.progressFor(snapshot),
      artifactAvailability: {
        renderGraph,
        instructionalManual,
        configurationDelta,
        frontendBriefing
      },
      urls: this.urlsFor(videoId),
      warnings: snapshot.warnings
    };
  }

  public async updateSnapshot(
    videoId: string,
    updater: (snapshot: ProgressiveVideoContextSnapshot) => ProgressiveVideoContextSnapshot | Promise<ProgressiveVideoContextSnapshot>,
    event?: {
      type: ProgressiveVideoContextEvent["type"];
      progress: number;
      data?: Record<string, unknown>;
    }
  ): Promise<ProgressiveVideoContextSnapshot> {
    const current = await this.getSnapshot(videoId);
    const next = progressiveVideoContextSnapshotSchema.parse({
      ...(await updater(current)),
      contextVersion: current.contextVersion + 1
    });
    await this.store.writeSnapshot(attachSourcePath(next, current.sourcePath ?? ""));
    if (event) {
      await this.emit(videoId, event.type, event.progress, event.data);
    }
    return next;
  }

  public async emit(
    videoId: string,
    type: ProgressiveVideoContextEvent["type"],
    progress: number,
    data: Record<string, unknown> = {}
  ): Promise<void> {
    const snapshot = await this.getSnapshot(videoId).catch(() => null);
    const contextVersion = snapshot?.contextVersion ?? 0;
    const contextLevel = snapshot?.contextLevel ?? 1;
    const timestamp = nowIso(this.deps);
    const event = progressiveVideoContextEventSchema.parse({
      id: `${videoId}:${type}:${contextVersion}:${timestamp}:${Math.random().toString(36).slice(2, 8)}`,
      type,
      videoId,
      timestamp,
      contextVersion,
      contextLevel,
      progress,
      data
    });
    await this.store.appendEvent(event);
    const listeners = this.subscribers.get(videoId);
    if (!listeners) {
      return;
    }
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        listeners.delete(listener);
      }
    }
  }

  public async replayEvents(videoId: string, afterEventId?: string): Promise<ProgressiveVideoContextEvent[]> {
    return this.store.readEvents(videoId, afterEventId);
  }

  public async prepareTranscriptChunkAudio(
    videoId: string,
    sourcePath: string,
    chunk: TranscriptChunkPlan
  ): Promise<string> {
    return extractAudioChunkWithFfmpeg({
      sourcePath,
      outputDir: this.store.transcriptChunksDir(videoId),
      chunk
    });
  }

  public subscribe(videoId: string, listener: (event: ProgressiveVideoContextEvent) => void): () => void {
    const listeners = this.subscribers.get(videoId) ?? new Set<(event: ProgressiveVideoContextEvent) => void>();
    listeners.add(listener);
    this.subscribers.set(videoId, listeners);
    return () => {
      const current = this.subscribers.get(videoId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.subscribers.delete(videoId);
      }
    };
  }

  public async persistHandoffArtifacts(
    videoId: string,
    artifacts: {
      renderGraph: RenderGraphV2Handoff;
      configurationDelta: ConfigurationDelta;
      instructionalManual: string;
      frontendBriefing: string;
    }
  ): Promise<void> {
    await Promise.all([
      this.store.writeRenderGraph(videoId, artifacts.renderGraph),
      this.store.writeConfigurationDelta(videoId, artifacts.configurationDelta),
      this.store.writeTextArtifact(videoId, "instructional-manual", artifacts.instructionalManual),
      this.store.writeTextArtifact(videoId, "frontend-briefing", artifacts.frontendBriefing)
    ]);
  }

  public async getRenderGraph(videoId: string) {
    return this.store.readRenderGraph(videoId);
  }

  public async getConfigurationDelta(videoId: string) {
    return this.store.readConfigurationDelta(videoId);
  }

  public async getInstructionalManual(videoId: string): Promise<string> {
    return this.store.readTextArtifact(videoId, "instructional-manual");
  }

  public async getFrontendBriefing(videoId: string): Promise<string> {
    return this.store.readTextArtifact(videoId, "frontend-briefing");
  }

  public async getReleasedAudio(videoId: string) {
    const snapshot = await this.getSnapshot(videoId);
    if (!snapshot.handoff.audioReleased) {
      throw new Error("Audio assets are gated until frontend-ready succeeds.");
    }
    const renderGraph = await this.store.readRenderGraph(videoId);
    if (renderGraph.audio.status !== "released") {
      throw new Error("Audio assets are not released for this RenderGraph.");
    }
    if (!snapshot.sourcePath) {
      throw new Error("Video source path is unavailable for audio release.");
    }
    const stats = await this.store.sourceStats(snapshot.sourcePath);
    return {
      stream: this.store.createSourceReadStream(snapshot.sourcePath),
      fileName: path.basename(snapshot.sourcePath),
      sizeBytes: stats.size,
      contentType: "application/octet-stream"
    };
  }

  public async markFrontendReady(videoId: string, payload: unknown) {
    const ready: FrontendReadinessHandshake = frontendReadinessHandshakeSchema.parse(payload);
    const renderGraph = await this.store.readRenderGraph(videoId);
    if (ready.renderGraphId !== renderGraph.renderGraphId) {
      throw new Error(`Readiness renderGraphId ${ready.renderGraphId} does not match ${renderGraph.renderGraphId}.`);
    }

    const audioUrl = `/api/videos/${videoId}/audio`;
    const released = {
      ...renderGraph,
      audio: {
        ...renderGraph.audio,
        status: "released" as const,
        releaseUrl: audioUrl
      }
    };
    await this.store.writeRenderGraph(videoId, released);
    await this.updateSnapshot(videoId, (snapshot) => ({
      ...snapshot,
      handoff: {
        ...snapshot.handoff,
        audioReleased: true
      }
    }));
    await this.emit(videoId, "frontend.audio.released", 100, {
      frontendInstanceId: ready.frontendInstanceId,
      audioUrl
    });
    return {
      videoId,
      audioReleased: true,
      audio: released.audio
    };
  }

  public async handleFrontendMessage(videoId: string, payload: unknown): Promise<BackendMessage> {
    const message: FrontendMessage = frontendMessageSchema.parse(payload);
    if (message.type === "set_mode") {
      const progress = this.progressFor(await this.getSnapshot(videoId));
      await this.updateSnapshot(
        videoId,
        (snapshot) => ({
          ...snapshot,
          mode: message.mode
        }),
        {
          type: "mode.changed",
          progress,
          data: {mode: message.mode}
        }
      );
      return backendMessageSchema.parse({
        type: "chat_response",
        messageId: `msg_${Date.now()}`,
        content: `Mode changed to ${message.mode}.`,
        contextUsed: ["mode"]
      });
    }

    const snapshot = await this.getSnapshot(videoId);
    const hasTranscript = snapshot.transcript.mergedWords.length > 0;
    const content = message.type === "chat_message"
      ? hasTranscript
        ? `I can answer with ${snapshot.transcript.mergedWords.length} transcript words of context.`
        : "I am still analyzing the video. Transcript-specific answers may be unknown/not processed yet."
      : "Animation preview request received. I will use the latest available context.";

    return backendMessageSchema.parse({
      type: "chat_response",
      messageId: `msg_${Date.now()}`,
      content,
      contextUsed: [
        "static",
        ...(snapshot.metadata.durationMs ? ["metadata"] : []),
        ...(hasTranscript ? ["transcript"] : [])
      ]
    });
  }

  private progressFor(snapshot: ProgressiveVideoContextSnapshot): number {
    if (snapshot.status === "handoff_ready") return 100;
    if (snapshot.contextLevel === 5) return 95;
    if (snapshot.contextLevel === 4) return 82;
    if (snapshot.contextLevel === 3) return 55;
    if (snapshot.contextLevel === 2) return 15;
    return 3;
  }
}
