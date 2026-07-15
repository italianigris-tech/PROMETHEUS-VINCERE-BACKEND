import path from "node:path";
import {fileURLToPath} from "node:url";
import {copyFile, mkdir, writeFile} from "node:fs/promises";

import {UnifiedRenderManifestSchema, type MusicReference, type UnifiedRenderManifest} from "@prometheus/shared-types";

import {LocalAssetResolver} from "../asset/local-asset-resolver";
import {loadEnv} from "../config";
import {selectHeroFonts} from "../font/font-runtime-resolver";
import {ReplayLedger} from "../ledger/replay-ledger";
import {analyzeMusicTrack, type MusicAnalysisResult} from "../music/analyzer/music-analysis-adapter";
import {listLocalMusicCatalog} from "../music/catalog/local-music-catalog";
import type {AnalyzedMusicReference} from "../music/rank-music-for-profile";
import type {MusicTrack} from "../music/schemas/music-track.schema";
import {buildVideoAwareAudioPlan} from "../music/video-aware-planner/build-video-aware-audio-plan";
import {enqueueJosephRenderJob} from "../render-jobs/routes";
import {orchestrateRender, type JosephProfile, type OrchestratorResult} from "../director/orchestrator";
import {PromptRegistry} from "../director/prompt-governance";
import {
  resolveJosephTranscript,
  type JosephTranscriptPayload,
  type ResolveJosephTranscriptResult,
} from "./joseph-transcript";
import {
  materializeJosephEditorialSource,
  type JosephEditorialMaterialization,
} from "./joseph-editorial-preprocess";
import {transcribeWithAssemblyAI} from "../integrations/assemblyai";

export type JosephUploadPipelineInput = {
  sessionId: string;
  sourcePath: string;
  sourceFilename?: string | null;
  sourceDurationMs?: number | null;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  sourceFps?: number | null;
  matteUrl?: string | null;
  matteFilePath?: string | null;
  profile: JosephProfile;
  promptText?: string;
  retryIndex?: number;
};

export type JosephUploadPipelineResult = {
  renderJobId: string;
  replayLedgerEntryId: string;
  evidencePath: string;
  variationKey: string;
  studioManifestPath?: string;
  studioManifestUrl?: string;
  manifest: UnifiedRenderManifest;
  transcript: {
    path: string;
    source: JosephTranscriptPayload["source"];
    wordCount: number;
    warnings: string[];
    trainableForIrl: boolean;
  };
};

export type JosephUploadPipeline = {
  createRenderJob(input: JosephUploadPipelineInput): Promise<JosephUploadPipelineResult>;
};

export type CreateJosephUploadPipelineOptions = {
  storageDir: string;
  publicDir?: string;
  uploadDir?: string;
  evidenceDir?: string;
  ledgerPath?: string;
  promptRegistryPath?: string;
  listLocalMusicCatalog?: typeof listLocalMusicCatalog;
  analyzeMusicTrack?: typeof analyzeMusicTrack;
  resolveTranscript?: (input: {
    transcriptPath: string;
    sourceMediaPath: string;
    durationMs: number;
    promptText: string;
  }) => Promise<ResolveJosephTranscriptResult>;
  materializeEditorialSource?: typeof materializeJosephEditorialSource;
  requireSpeechTranscript?: boolean;
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../..");

const DEFAULT_PROMPT = "default joseph upload";

const safeSegment = (value: string): string => {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : "unknown";
};

const profileTone = (profile: JosephProfile): "aggressive" | "cinematic" | "minimal" =>
  profile.replace("joseph_", "") as "aggressive" | "cinematic" | "minimal";

const average = (values: number[]): number =>
  values.length === 0 ? 0.5 : values.reduce((sum, value) => sum + value, 0) / values.length;

const profileMoodTags = (profile: JosephProfile): string[] => {
  if (profile === "joseph_aggressive") return ["urgent", "kinetic", "high-energy"];
  if (profile === "joseph_cinematic") return ["cinematic", "premium", "documentary"];
  return ["minimal", "clean", "dialogue-safe"];
};

const analyzeRenderableTracks = async (
  tracks: MusicReference[],
  analyze: typeof analyzeMusicTrack,
): Promise<AnalyzedMusicReference[]> => {
  const analyzed: AnalyzedMusicReference[] = [];
  for (const track of tracks.filter((candidate) => candidate.renderSafe).slice(0, 12)) {
    try {
      const analysis: MusicAnalysisResult = await analyze(track.localFilePath);
      analyzed.push({...track, durationSeconds: analysis.duration, analysis});
    } catch {
      // A bad local music file should not block a Joseph upload from rendering.
    }
  }
  return analyzed;
};

const toMusicTrack = (track: AnalyzedMusicReference): MusicTrack => {
  const energy = Math.max(0.05, Math.min(1, average(track.analysis.energyCurve)));
  return {
    id: track.trackId,
    title: track.title,
    artist: "local-user-supplied",
    source: track.sourceKind,
    sourceUrl: track.browserUrl ?? null,
    storagePath: track.localFilePath,
    licenseType: track.licenseStatus,
    commercialAllowed: track.renderSafe,
    attributionRequired: false,
    licenseVerified: track.renderSafe,
    durationSec: track.durationSeconds,
    bpm: track.analysis.bpm,
    musicalKey: null,
    energy,
    valence: 0.5,
    arousal: Math.max(0.1, Math.min(1, energy + 0.08)),
    tension: Math.max(0.1, Math.min(1, energy * 0.8)),
    prestige: 0.62,
    urgency: Math.max(0.1, Math.min(1, energy * 0.9)),
    clarity: 0.72,
    speechFriendliness: energy > 0.68 ? 0.58 : 0.78,
    genreTags: ["local"],
    moodTags: ["cinematic", "kinetic", "premium"],
    instrumentTags: [],
    useCaseTags: ["hook", "explanation", "cta", "proof", "reveal"],
    avoidWhen: [],
    beatGrid: {
      bpm: track.analysis.bpm,
      beatTimesSec: track.analysis.beatTimes,
      downbeatTimesSec: track.analysis.downbeats,
      confidence: track.analysis.beatTimes.length > 0 ? 0.7 : 0.35,
      source: track.analysis.source,
    },
    sections: track.analysis.sections.map((section, index) => ({
      id: track.trackId + "-section-" + String(index + 1).padStart(2, "0"),
      trackId: track.trackId,
      startSec: section.startSeconds,
      endSec: section.endSeconds,
      role: section.label === "intro" ? "intro" : section.label === "main" ? "chorus" : "unknown",
      energy: Math.max(0, Math.min(1, section.energy)),
      density: Math.max(0, Math.min(1, section.energy)),
      tension: Math.max(0, Math.min(1, section.energy * 0.8)),
      bestFor: ["hook", "explanation", "cta", "proof", "reveal"],
      avoidWhen: [],
      transitionInSuitability: 0.72,
      transitionOutSuitability: 0.72,
    })),
    waveformSummary: {
      windowSec: 1,
      peakAmplitudes: track.analysis.energyCurve,
      rmsAmplitudes: track.analysis.energyCurve,
      source: track.analysis.source,
    },
    loudnessLufs: track.analysis.loudnessLUFS,
    analysisStatus: "analyzed",
    createdAt: "1970-01-01T00:00:00.000Z",
    analyzedAt: "1970-01-01T00:00:00.000Z",
  };
};

const toTranscribedWords = (payload: JosephTranscriptPayload) => payload.words.map((word) => ({
  text: word.text,
  start_ms: word.startMs,
  end_ms: word.endMs,
  ...(typeof word.confidence === "number" ? {confidence: word.confidence} : {}),
}));

const buildJosephDjPlan = ({
  uploadInstanceId,
  profile,
  promptText,
  durationMs,
  transcript,
  analyzedTracks,
}: {
  uploadInstanceId: string;
  profile: JosephProfile;
  promptText: string;
  durationMs: number;
  transcript: JosephTranscriptPayload;
  analyzedTracks: AnalyzedMusicReference[];
}) => {
  const trackById = new Map(analyzedTracks.map((track) => [track.trackId, track] as const));
  const plan = buildVideoAwareAudioPlan({
    jobId: uploadInstanceId,
    videoDurationSec: durationMs / 1000,
    transcriptWords: toTranscribedWords(transcript),
    creativeDirection: {
      summary: promptText,
      moodTags: profileMoodTags(profile),
      pacing: profile.replace("joseph_", ""),
      constraints: ["production-authority", "render-safe-local-tracks-only"],
    },
    planMode: "render_ready",
    candidateTracks: analyzedTracks.map(toMusicTrack),
    previewStartSec: 0,
    previewEndSec: durationMs / 1000,
    now: () => "1970-01-01T00:00:00.000Z",
  });

  const warnings = [
    ...plan.renderSettings.notes,
    ...plan.musicEvents
      .filter((event) => !event.renderSafe)
      .map((event) => event.warning ?? "Music event " + event.id + " is not render-safe."),
  ].filter((warning): warning is string => Boolean(warning));

  return {
    version: "joseph-dj-plan-v1" as const,
    source: "video-aware-audio-plan" as const,
    planId: plan.id,
    planMode: plan.planMode,
    musicEvents: plan.musicEvents.map((event) => {
      const sourceTrack = trackById.get(event.trackId);
      if (!sourceTrack) {
        throw new Error("DJ plan selected unknown music track: " + event.trackId);
      }
      return {
        id: event.id,
        trackId: event.trackId,
        localFilePath: sourceTrack.localFilePath,
        bpm: sourceTrack.analysis.bpm,
        videoStartSec: event.videoStartSec,
        videoEndSec: event.videoEndSec,
        trackStartSec: event.trackStartSec,
        trackEndSec: event.trackEndSec,
        volumeDb: event.volumeDb,
        fadeInSec: event.fadeInSec,
        fadeOutSec: event.fadeOutSec,
        duckingEnabled: event.duckingEnabled,
        purpose: event.purpose,
        sectionRole: event.sectionRole,
        beatAligned: event.beatAligned,
      };
    }),
    transitionEvents: plan.transitionEvents.map((event) => ({
      id: event.id,
      type: event.type,
      videoStartSec: event.videoStartSec,
      videoEndSec: event.videoEndSec,
      fromTrackId: event.fromTrackId,
      toTrackId: event.toTrackId,
      intensity: event.intensity,
      beatAligned: event.beatAligned,
      downbeatTargetSec: event.downbeatTargetSec,
    })),
    duckingRegions: plan.duckingRegions.map((region) => ({
      id: region.id,
      videoStartSec: region.videoStartSec,
      videoEndSec: region.videoEndSec,
      targetMusicDb: region.targetMusicDb,
      reason: region.reason,
    })),
    warnings,
  };
};

const materializeDjBrowserAssets = async (
  djPlan: ReturnType<typeof buildJosephDjPlan>,
  publicDir: string,
): Promise<ReturnType<typeof buildJosephDjPlan>> => {
  const browserMusicDir = path.join(publicDir, "joseph-music");
  const browserUrlByTrackId = new Map<string, string>();
  await mkdir(browserMusicDir, {recursive: true});

  for (const event of djPlan.musicEvents) {
    if (browserUrlByTrackId.has(event.trackId)) {
      continue;
    }
    const extension = path.extname(event.localFilePath) || ".mp3";
    const fileName = safeSegment(event.trackId) + extension.toLowerCase();
    await copyFile(event.localFilePath, path.join(browserMusicDir, fileName));
    browserUrlByTrackId.set(event.trackId, "/joseph-music/" + fileName);
  }

  return {
    ...djPlan,
    musicEvents: djPlan.musicEvents.map((event) => ({
      ...event,
      browserUrl: browserUrlByTrackId.get(event.trackId),
    })),
  };
};

const withManifestAssets = (
  result: OrchestratorResult,
  {
    typography,
    djPlan,
    sourceAudioFilePath,
    sourceWidth,
    sourceHeight,
    sourceFps,
    sourceEdit,
  }: {
    typography: ReturnType<typeof selectHeroFonts>["hero"];
    djPlan: ReturnType<typeof buildJosephDjPlan>;
    sourceAudioFilePath: string;
    sourceWidth?: number | null;
    sourceHeight?: number | null;
    sourceFps?: number | null;
    sourceEdit?: UnifiedRenderManifest["sourceEdit"];
  },
): UnifiedRenderManifest => UnifiedRenderManifestSchema.parse({
  ...result.manifest,
  ...(sourceEdit ? {sourceEdit} : {}),
  source: {
    ...result.manifest.source,
    audioUrl: sourceAudioFilePath,
    width: sourceWidth ?? result.manifest.source.width,
    height: sourceHeight ?? result.manifest.source.height,
    fps: sourceFps ?? result.manifest.source.fps,
  },
  typography,
  audio: {
    ...result.manifest.audio,
    musicTrackUrl: undefined,
    musicReference: undefined,
    musicBpm: djPlan.musicEvents[0]?.bpm ?? result.manifest.audio.musicBpm,
    djPlan,
  },
});

export const createJosephUploadPipeline = ({
  storageDir,
  publicDir = path.join(repoRoot, "remotion-app", "public"),
  uploadDir = path.join(storageDir, "joseph-media"),
  evidenceDir = path.join(storageDir, "joseph-evidence"),
  ledgerPath = path.join(storageDir, "joseph-replay-ledger.jsonl"),
  promptRegistryPath = path.join(storageDir, "joseph-prompt-registry.jsonl"),
  listLocalMusicCatalog: listMusic = listLocalMusicCatalog,
  analyzeMusicTrack: analyze = analyzeMusicTrack,
  resolveTranscript,
  materializeEditorialSource: materializeEditorial = materializeJosephEditorialSource,
  requireSpeechTranscript = process.env.JOSEPH_REQUIRE_SPEECH_TRANSCRIPT === "1",
}: CreateJosephUploadPipelineOptions): JosephUploadPipeline => {
  const assetResolver = new LocalAssetResolver({publicDir, uploadDir});
  const resolveTranscriptImpl = resolveTranscript ?? (async (args) => {
    const env = loadEnv();
    return resolveJosephTranscript({
      ...args,
      assemblyAiApiKey: env.ASSEMBLYAI_API_KEY,
      requireSpeechTranscript,
      transcribe: transcribeWithAssemblyAI,
    });
  });

  return {
    async createRenderJob(input) {
      const uploadInstanceId = input.sessionId;
      const retryIndex = input.retryIndex ?? 0;
      const promptText = input.promptText?.trim() || DEFAULT_PROMPT;
      const rawSourceReference = await assetResolver.registerUpload(input.sourcePath, uploadInstanceId + "-raw");
      const rawDurationMs = Math.min(Math.max(1000, input.sourceDurationMs ?? 10_000), 90_000);
      const rawTranscriptPath = path.join(storageDir, "joseph-transcripts", safeSegment(uploadInstanceId) + ".json");
      const rawTranscriptResolution = await resolveTranscriptImpl({
        transcriptPath: rawTranscriptPath,
        sourceMediaPath: rawSourceReference.filePath,
        durationMs: rawDurationMs,
        promptText,
      });

      let sourceReference = rawSourceReference;
      let durationMs = rawDurationMs;
      let transcriptResolution = rawTranscriptResolution;
      let sourceEdit: UnifiedRenderManifest["sourceEdit"];
      if (rawDurationMs > 45_000) {
        if (rawTranscriptResolution.payload.source !== "assemblyai") {
          throw new Error("Joseph editorial selection requires a successful AssemblyAI transcript for long raw footage.");
        }
        const editorialOutputPath = path.join(
          storageDir,
          "joseph-editorial",
          safeSegment(uploadInstanceId) + ".mp4",
        );
        const editorial: JosephEditorialMaterialization = await materializeEditorial({
          sourcePath: rawSourceReference.filePath,
          outputPath: editorialOutputPath,
          transcript: rawTranscriptResolution.payload,
        });
        sourceReference = await assetResolver.registerUpload(editorial.derivedPath, uploadInstanceId);
        durationMs = editorial.plan.outputDurationMs;
        const editorialTranscriptPath = path.join(
          storageDir,
          "joseph-transcripts",
          safeSegment(uploadInstanceId) + "-editorial.json",
        );
        await mkdir(path.dirname(editorialTranscriptPath), {recursive: true});
        await writeFile(editorialTranscriptPath, JSON.stringify(editorial.transcript, null, 2) + "\n", "utf8");
        transcriptResolution = {path: editorialTranscriptPath, payload: editorial.transcript};
        sourceEdit = {
          ...editorial.plan,
          sourcePath: path.resolve(input.sourcePath),
          sourceSha256: editorial.sourceSha256,
          derivedPath: editorial.derivedPath,
          derivedSha256: editorial.derivedSha256,
        };
      }

      const seedHint = Math.max(1, Math.round(durationMs) + retryIndex + input.profile.length);
      const analyzedTracks = await analyzeRenderableTracks(listMusic(), analyze);
      if (analyzedTracks.length === 0) {
        throw new Error("Joseph DJ production requires at least one render-safe analyzed local music track.");
      }
      const djPlan = await materializeDjBrowserAssets(buildJosephDjPlan({
        uploadInstanceId,
        profile: input.profile,
        promptText,
        durationMs,
        transcript: transcriptResolution.payload,
        analyzedTracks,
      }), publicDir);
      const typography = selectHeroFonts({profile: profileTone(input.profile), preferHydratedLibrary: true}, seedHint).hero;

      const ledger = new ReplayLedger(ledgerPath);
      const promptRegistry = new PromptRegistry(promptRegistryPath);
      const orchestratorResult = await orchestrateRender({
        sourceVideoPath: sourceReference.browserUrl,
        sourceFingerprintPath: rawSourceReference.filePath,
        transcriptPath: transcriptResolution.path,
        audioPath: sourceReference.filePath,
        musicPath: djPlan.musicEvents[0]?.localFilePath,
        ...(input.matteUrl ? {matteUrl: input.matteUrl} : {}),
        ...(input.matteFilePath ? {matteFilePath: input.matteFilePath} : {}),
        promptText,
        profile: input.profile,
        uploadInstanceId,
        retryIndex,
        evidenceDir,
      }, ledger, promptRegistry);

      const manifest = withManifestAssets(orchestratorResult, {
        typography,
        djPlan,
        sourceAudioFilePath: sourceReference.filePath,
        sourceWidth: input.sourceWidth,
        sourceEdit,
        sourceHeight: input.sourceHeight,
        sourceFps: input.sourceFps,
      });
      const job = await enqueueJosephRenderJob({
        manifest,
        variationKey: orchestratorResult.variationKey.key,
        evidencePath: orchestratorResult.evidencePaths.jobDir,
      });

      const studioManifestDir = path.join(publicDir, "joseph-studio");
      const studioManifestFileName = safeSegment(uploadInstanceId) + ".json";
      const studioManifestPath = path.join(studioManifestDir, studioManifestFileName);
      const studioManifest = UnifiedRenderManifestSchema.parse({
        ...manifest,
        source: {
          ...manifest.source,
          audioUrl: sourceReference.browserUrl,
        },
      });
      await mkdir(studioManifestDir, {recursive: true});
      await writeFile(studioManifestPath, `${JSON.stringify(studioManifest, null, 2)}\n`, "utf8");
      await writeFile(path.join(studioManifestDir, "latest.json"), `${JSON.stringify(studioManifest, null, 2)}\n`, "utf8");

      return {
        renderJobId: job.id,
        replayLedgerEntryId: orchestratorResult.variationKey.uploadInstanceId + ":" + orchestratorResult.variationKey.retryIndex,
        evidencePath: orchestratorResult.evidencePaths.jobDir,
        variationKey: orchestratorResult.variationKey.key,
        studioManifestPath,
        studioManifestUrl: "/joseph-studio/" + studioManifestFileName,
        manifest,
        transcript: {
          path: transcriptResolution.path,
          source: transcriptResolution.payload.source,
          wordCount: transcriptResolution.payload.words.length,
          warnings: transcriptResolution.payload.warnings,
          trainableForIrl: transcriptResolution.payload.trainableForIrl,
        },
      };
    },
  };
};
