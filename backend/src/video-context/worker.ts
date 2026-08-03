import path from "node:path";

import type {BackendEnv} from "../config";
import {probeVideoMetadata, type VideoProbeResult} from "../integrations/ffprobe";
import {transcribeWithAssemblyAI} from "../integrations/assemblyai";
import {FileJobRepository} from "../repository";
import {createInitialJobRecord, processJobPipeline} from "../pipeline";
import {inputManifestSchema, type NormalizedJobRequest, type TranscribedWord} from "../schemas";
import {
  buildConfigurationDelta,
  buildFrontendBriefing,
  buildInstructionalManual,
  buildRenderGraphHandoff
} from "./artifacts";
import type {
  ProgressiveVideoContextEvent,
  ProgressiveVideoContextSnapshot,
  RenderGraphV2Handoff
} from "./contracts";
import {
  DEFAULT_TRANSCRIPT_MAX_PARALLEL,
  mergeTranscriptChunkResults,
  planTranscriptChunks,
  type TranscriptChunkPlan,
  type TranscriptChunkResult
} from "./transcript";
import {buildEditorialAnalysis} from "./editorial-analysis";

export type VideoContextTranscribeChunkInput = {
  videoId: string;
  sourcePath: string;
  audioChunkPath: string;
  chunk: TranscriptChunkPlan;
  apiKey: string;
};

export type VideoContextTranscribeChunkResult = {
  provider: "assemblyai" | "whisperx" | "deepgram" | "google" | "none";
  words: TranscribedWord[];
};

export type VideoContextWorkerDependencies = {
  probeVideoMetadata?: (videoPath: string) => Promise<VideoProbeResult>;
  transcribeChunk?: (input: VideoContextTranscribeChunkInput) => Promise<VideoContextTranscribeChunkResult>;
  runFinalPipeline?: (request: NormalizedJobRequest) => Promise<void>;
  now?: () => string;
};

export type VideoContextWorkerHost = {
  env: BackendEnv;
  repository: FileJobRepository;
  deps: VideoContextWorkerDependencies;
  getSnapshot(videoId: string): Promise<ProgressiveVideoContextSnapshot>;
  prepareTranscriptChunkAudio(videoId: string, sourcePath: string, chunk: TranscriptChunkPlan): Promise<string>;
  updateSnapshot(
    videoId: string,
    updater: (snapshot: ProgressiveVideoContextSnapshot) => ProgressiveVideoContextSnapshot | Promise<ProgressiveVideoContextSnapshot>,
    event?: {
      type: ProgressiveVideoContextEvent["type"];
      progress: number;
      data?: Record<string, unknown>;
    }
  ): Promise<ProgressiveVideoContextSnapshot>;
  emit(
    videoId: string,
    type: ProgressiveVideoContextEvent["type"],
    progress: number,
    data?: Record<string, unknown>
  ): Promise<void>;
  persistHandoffArtifacts(
    videoId: string,
    artifacts: {
      renderGraph: RenderGraphV2Handoff;
      configurationDelta: ReturnType<typeof buildConfigurationDelta>;
      instructionalManual: string;
      frontendBriefing: string;
    }
  ): Promise<void>;
};

const nowIso = (deps: VideoContextWorkerDependencies): string => deps.now?.() ?? new Date().toISOString();

const inferAspectRatio = (width: number | null, height: number | null): string | null => {
  if (!width || !height) {
    return null;
  }
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.08) return "16:9";
  if (Math.abs(ratio - 9 / 16) < 0.08) return "9:16";
  if (Math.abs(ratio - 1) < 0.08) return "1:1";
  return `${width}:${height}`;
};

const buildMotionSegments = (snapshot: ProgressiveVideoContextSnapshot) => {
  const durationMs = Math.max(1000, snapshot.metadata.durationMs ?? 1000);
  const segmentCount = Math.max(1, Math.min(12, Math.ceil(durationMs / (2 * 60 * 1000))));
  const segmentDurationMs = Math.ceil(durationMs / segmentCount);
  return Array.from({length: segmentCount}, (_, index) => {
    const startMs = index * segmentDurationMs;
    const endMs = Math.min(durationMs, Math.max(startMs + 1, (index + 1) * segmentDurationMs));
    return {
      id: `motion_${index}`,
      startMs,
      endMs,
      intensity: Math.min(1, Math.max(0.1, 0.28 + index * 0.07)),
      sceneChange: index > 0,
      keyframeTimestampsMs: [
        startMs,
        Math.min(endMs, startMs + Math.round((endMs - startMs) / 2))
      ],
      detectionSource: "ffmpeg-proxy" as const,
      objects: null
    };
  });
};

type TranscriptProviderAdapter = {
  provider: VideoContextTranscribeChunkResult["provider"];
  isConfigured(input: VideoContextTranscribeChunkInput): boolean;
  transcribeChunk(input: VideoContextTranscribeChunkInput): Promise<VideoContextTranscribeChunkResult>;
};

export class AssemblyAIChunkedBatchTranscriptAdapter implements TranscriptProviderAdapter {
  public readonly provider = "assemblyai" as const;

  public constructor(
    private readonly transcribe: typeof transcribeWithAssemblyAI = transcribeWithAssemblyAI
  ) {}

  public isConfigured(input: VideoContextTranscribeChunkInput): boolean {
    return input.apiKey.trim().length > 0;
  }

  public async transcribeChunk(input: VideoContextTranscribeChunkInput): Promise<VideoContextTranscribeChunkResult> {
    const words = await this.transcribe({
      filePath: input.audioChunkPath,
      apiKey: input.apiKey
    });
    return {
      provider: this.provider,
      words
    };
  }
}

const transcriptFallbackChain: VideoContextTranscribeChunkResult["provider"][] = [
  "assemblyai",
  "whisperx",
  "deepgram",
  "google"
];

const fallbackTranscribeChunk = async (input: VideoContextTranscribeChunkInput): Promise<VideoContextTranscribeChunkResult> => {
  const adapters: TranscriptProviderAdapter[] = [
    new AssemblyAIChunkedBatchTranscriptAdapter()
  ];
  const adapter = adapters.find((candidate) => candidate.isConfigured(input));
  if (!adapter) {
    return {
      provider: "none",
      words: []
    };
  }

  return adapter.transcribeChunk(input);
};

export class ProgressiveVideoContextWorker {
  public constructor(private readonly host: VideoContextWorkerHost) {}

  public async run(videoId: string): Promise<void> {
    try {
      await this.runUnsafe(videoId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.host.updateSnapshot(videoId, (snapshot) => ({
        ...snapshot,
        status: "failed",
        warnings: Array.from(new Set(snapshot.warnings.concat([message])))
      }));
      await this.host.emit(videoId, "video.failed", 100, {error: message});
    }
  }

  private async runUnsafe(videoId: string): Promise<void> {
    const initial = await this.host.getSnapshot(videoId);
    const sourcePath = String((initial as unknown as {sourcePath?: string}).sourcePath ?? "");
    if (!sourcePath) {
      throw new Error("Video context sourcePath is missing.");
    }

    const stats = await this.host.repository.pathExists(sourcePath)
      ? await import("node:fs/promises").then(({stat}) => stat(sourcePath))
      : null;
    const probeImpl = this.host.deps.probeVideoMetadata ?? probeVideoMetadata;
    let probe: VideoProbeResult | null = null;
    try {
      probe = await probeImpl(sourcePath);
    } catch (error) {
      await this.host.updateSnapshot(videoId, (snapshot) => ({
        ...snapshot,
        warnings: snapshot.warnings.concat([
          `Metadata probe failed; continuing with file-level context: ${error instanceof Error ? error.message : String(error)}`
        ])
      }));
    }

    await this.host.updateSnapshot(
      videoId,
      (snapshot) => ({
        ...snapshot,
        status: "metadata_ready",
        contextLevel: 2,
        metadata: {
          durationMs: probe ? Math.round(probe.duration_seconds * 1000) : snapshot.metadata.durationMs,
          width: probe?.width ?? snapshot.metadata.width,
          height: probe?.height ?? snapshot.metadata.height,
          fps: probe?.fps ?? snapshot.metadata.fps,
          aspectRatio: inferAspectRatio(probe?.width ?? null, probe?.height ?? null),
          containerFormat: probe?.container_format ?? snapshot.metadata.containerFormat,
          codecVideo: probe?.codec_video ?? snapshot.metadata.codecVideo,
          fileSizeBytes: stats?.size ?? snapshot.metadata.fileSizeBytes
        }
      }),
      {
        type: "metadata.ready",
        progress: 15,
        data: {durationMs: probe ? Math.round(probe.duration_seconds * 1000) : null}
      }
    );

    await this.runTranscription(videoId, sourcePath);
    await this.runMotionAnalysis(videoId);
    await this.runFinalPlanning(videoId, sourcePath);
  }

  private async runTranscription(videoId: string, sourcePath: string): Promise<void> {
    const snapshot = await this.host.getSnapshot(videoId);
    const durationMs = Math.max(1000, snapshot.metadata.durationMs ?? 1000);
    const chunks = planTranscriptChunks({
      durationMs,
      maxParallel: DEFAULT_TRANSCRIPT_MAX_PARALLEL
    });
    const transcribeImpl = this.host.deps.transcribeChunk ?? fallbackTranscribeChunk;
    const shouldExtractAudioChunks = !this.host.deps.transcribeChunk && this.host.env.ASSEMBLYAI_API_KEY.trim().length > 0;
    const results: TranscriptChunkResult[] = [];

    await this.host.updateSnapshot(videoId, (current) => ({
      ...current,
      status: "transcribing",
      transcript: {
        ...current.transcript,
        chunks: chunks.map((chunk) => ({
          chunkId: chunk.id,
          index: chunk.index,
          startMs: chunk.startMs,
          endMs: chunk.endMs,
          status: "queued" as const,
          words: []
        })),
        fallbackChain: transcriptFallbackChain
      }
    }));

    const runChunk = async (chunk: TranscriptChunkPlan): Promise<void> => {
      await this.host.updateSnapshot(
        videoId,
        (current) => ({
          ...current,
          transcript: {
            ...current.transcript,
            chunks: current.transcript.chunks.map((entry) =>
              entry.chunkId === chunk.id ? {...entry, status: "processing"} : entry
            )
          }
        }),
        {
          type: "transcript.chunk.started",
          progress: 20,
          data: {chunkId: chunk.id, index: chunk.index}
        }
      );

      try {
        const audioChunkPath = shouldExtractAudioChunks
          ? await this.host.prepareTranscriptChunkAudio(videoId, sourcePath, chunk)
          : sourcePath;
        const result = await transcribeImpl({
          videoId,
          sourcePath,
          audioChunkPath,
          chunk,
          apiKey: this.host.env.ASSEMBLYAI_API_KEY
        });
        results.push({
          chunkId: chunk.id,
          index: chunk.index,
          offsetMs: chunk.offsetMs,
          words: result.words
        });
        const mergedWords = mergeTranscriptChunkResults(results);
        const coverage = results
          .map((entry) => chunks.find((chunkPlan) => chunkPlan.id === entry.chunkId))
          .filter((entry): entry is TranscriptChunkPlan => Boolean(entry))
          .sort((left, right) => left.startMs - right.startMs)
          .map((entry) => [entry.startMs, entry.endMs] as [number, number]);
        const progress = Math.min(75, 25 + Math.round((results.length / chunks.length) * 45));
        await this.host.updateSnapshot(
          videoId,
          (current) => ({
            ...current,
            contextLevel: Math.max(current.contextLevel, 3) as ProgressiveVideoContextSnapshot["contextLevel"],
            transcript: {
              ...current.transcript,
              provider: result.provider,
              chunks: current.transcript.chunks.map((entry) =>
                entry.chunkId === chunk.id
                  ? {...entry, status: "completed", words: result.words}
                  : entry
              ),
              mergedWords
            },
            coverage: {
              ...current.coverage,
              coveredTranscriptRangesMs: coverage,
              uncoveredRangesMs: coverage.length === chunks.length ? [] : [[coverage.at(-1)?.[1] ?? 0, durationMs]]
            }
          }),
          {
            type: "partial_transcript.ready",
            progress,
            data: {
              chunkId: chunk.id,
              rangeMs: [chunk.startMs, chunk.endMs],
              words: result.words.length,
              provider: result.provider
            }
          }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.host.updateSnapshot(videoId, (current) => ({
          ...current,
          warnings: current.warnings.concat([`Transcript chunk ${chunk.id} failed: ${message}`]),
          transcript: {
            ...current.transcript,
            chunks: current.transcript.chunks.map((entry) =>
              entry.chunkId === chunk.id ? {...entry, status: "failed", error: message} : entry
            )
          }
        }));
      }
    };

    for (let start = 0; start < chunks.length; start += DEFAULT_TRANSCRIPT_MAX_PARALLEL) {
      await Promise.all(chunks.slice(start, start + DEFAULT_TRANSCRIPT_MAX_PARALLEL).map(runChunk));
    }

    await this.host.updateSnapshot(
      videoId,
      (current) => ({
        ...current,
        coverage: {
          ...current.coverage,
          transcriptComplete: current.transcript.chunks.every((chunk) => chunk.status === "completed"),
          uncoveredRangesMs: current.transcript.chunks.every((chunk) => chunk.status === "completed")
            ? []
            : current.coverage.uncoveredRangesMs
        }
      }),
      {
        type: "transcript.complete",
        progress: 78,
        data: {wordCount: (await this.host.getSnapshot(videoId)).transcript.mergedWords.length}
      }
    );
  }

  private async runMotionAnalysis(videoId: string): Promise<void> {
    await this.host.updateSnapshot(
      videoId,
      (snapshot) => ({
        ...snapshot,
        status: "motion_analyzing",
        contextLevel: Math.max(snapshot.contextLevel, 4) as ProgressiveVideoContextSnapshot["contextLevel"],
        motion: {
          segments: buildMotionSegments(snapshot),
          analysisComplete: true
        },
        coverage: {
          ...snapshot.coverage,
          motionComplete: true
        }
      }),
      {
        type: "motion.analysis.ready",
        progress: 82,
        data: {detectionSource: "ffmpeg-proxy", objects: null}
      }
    );
  }

  private async runFinalPlanning(videoId: string, sourcePath: string): Promise<void> {
    await this.host.updateSnapshot(videoId, (snapshot) => ({
      ...snapshot,
      status: "planning"
    }));

    const snapshot = await this.host.getSnapshot(videoId);
    const finalPipeline = this.host.deps.runFinalPipeline ?? (async (request: NormalizedJobRequest) => {
      await this.host.repository.ensureJobWorkspace(request.job_id);
      const jobRecord = createInitialJobRecord({
        request,
        repository: this.host.repository,
        deps: {
          now: this.host.deps.now
        }
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
        this.host.repository.createJobRecord(jobRecord),
        this.host.repository.writeArtifact(request.job_id, "input_manifest", inputManifest)
      ]);
      await processJobPipeline({
        request,
        repository: this.host.repository,
        env: this.host.env,
        deps: {
          now: this.host.deps.now,
          probeVideoMetadata: this.host.deps.probeVideoMetadata
        }
      });
    });
    const jobId = `job_${videoId}`;
    try {
      await finalPipeline({
        job_id: jobId,
        prompt: `Progressive video context final handoff for ${videoId}.`,
        source_media_ref: sourcePath,
        input_source_video: null,
        input_assets: [],
        descriptor_assets: [],
        metadata_overrides: {},
        provided_transcript: snapshot.transcript.mergedWords,
        max_clip_count: 3
      });
    } catch (error) {
      await this.host.updateSnapshot(videoId, (current) => ({
        ...current,
        warnings: current.warnings.concat([
          `Final planning pipeline warning: ${error instanceof Error ? error.message : String(error)}`
        ])
      }));
    }

    const latest = await this.host.getSnapshot(videoId);
    const generatedAt = nowIso(this.host.deps);
    const renderGraph = buildRenderGraphHandoff(latest, generatedAt);
    const configurationDelta = buildConfigurationDelta(latest);
    const instructionalManual = buildInstructionalManual({
      snapshot: latest,
      renderGraph,
      delta: configurationDelta
    });
    const frontendBriefing = buildFrontendBriefing({
      snapshot: latest,
      renderGraph
    });

    await this.host.persistHandoffArtifacts(videoId, {
      renderGraph,
      configurationDelta,
      instructionalManual,
      frontendBriefing
    });
    await this.host.updateSnapshot(
      videoId,
      (current) => ({
        ...current,
        editorialAnalysis: buildEditorialAnalysis(current, generatedAt),
        status: "handoff_ready",
        contextLevel: 5,
        coverage: {
          ...current.coverage,
          renderPlanComplete: true
        },
        handoff: {
          ...current.handoff,
          renderGraphReady: true,
          instructionalManualReady: true,
          configurationDeltaReady: true,
          frontendBriefingReady: true
        }
      }),
      {
        type: "render_graph.ready",
        progress: 95,
        data: {
          renderGraphId: renderGraph.renderGraphId
        }
      }
    );
    await this.host.emit(videoId, "handoff.ready", 100, {
      renderGraphId: renderGraph.renderGraphId,
      manual: path.basename("instructional-manual.md")
    });
  }
}
