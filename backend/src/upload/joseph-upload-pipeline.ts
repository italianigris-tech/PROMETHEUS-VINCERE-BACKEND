import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {UnifiedRenderManifestSchema, type MusicReference, type UnifiedRenderManifest} from "@prometheus/shared-types";

import {LocalAssetResolver} from "../asset/local-asset-resolver";
import {selectHeroFonts} from "../font/font-runtime-resolver";
import {ReplayLedger} from "../ledger/replay-ledger";
import {analyzeMusicTrack, type MusicAnalysisResult} from "../music/analyzer/music-analysis-adapter";
import {listLocalMusicCatalog} from "../music/catalog/local-music-catalog";
import {selectMusicForProfile, type AnalyzedMusicReference} from "../music/rank-music-for-profile";
import {enqueueJosephRenderJob} from "../render-jobs/routes";
import {orchestrateRender, type JosephProfile, type OrchestratorResult} from "../director/orchestrator";
import {PromptRegistry} from "../director/prompt-governance";

export type JosephUploadPipelineInput = {
  sessionId: string;
  sourcePath: string;
  sourceFilename?: string | null;
  sourceDurationMs?: number | null;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  sourceFps?: number | null;
  profile: JosephProfile;
  promptText?: string;
  retryIndex?: number;
};

export type JosephUploadPipelineResult = {
  renderJobId: string;
  replayLedgerEntryId: string;
  evidencePath: string;
  variationKey: string;
  manifest: UnifiedRenderManifest;
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

const writeFallbackTranscript = async ({
  transcriptPath,
  durationMs,
  promptText,
}: {
  transcriptPath: string;
  durationMs: number;
  promptText: string;
}): Promise<void> => {
  await mkdir(path.dirname(transcriptPath), {recursive: true});
  const words = promptText
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 12);
  const step = Math.max(250, Math.floor(Math.max(1000, durationMs) / Math.max(1, words.length + 1)));
  const transcriptWords = words.length > 0
    ? words.map((word, index) => ({
      text: word,
      startMs: Math.min(durationMs - 1, step * index),
      endMs: Math.min(durationMs, step * index + Math.min(step - 50, 500)),
      confidence: 0.75,
    }))
    : [
      {text: "Joseph", startMs: 0, endMs: Math.min(durationMs, 500), confidence: 0.75},
      {text: "edit", startMs: Math.min(durationMs, 600), endMs: Math.min(durationMs, 1000), confidence: 0.75},
    ];

  await writeFile(transcriptPath, `${JSON.stringify({
    words: transcriptWords,
    phrases: [{
      startMs: 0,
      endMs: Math.min(durationMs, Math.max(1000, transcriptWords.at(-1)?.endMs ?? 1000)),
      text: transcriptWords.map((word) => word.text).join(" "),
      words: transcriptWords,
    }],
    beats: Array.from({length: Math.max(1, Math.floor(durationMs / 500))}, (_, index) => index * 500),
    onsets: transcriptWords.map((word) => word.startMs),
    energyCurve: [0.42, 0.68, 0.78, 0.55, 0.74, 0.62],
    durationMs,
  }, null, 2)}\n`, "utf8");
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

const withManifestAssets = (
  result: OrchestratorResult,
  {
    typography,
    music,
    sourceWidth,
    sourceHeight,
    sourceFps,
  }: {
    typography: ReturnType<typeof selectHeroFonts>["hero"];
    music: AnalyzedMusicReference | null;
    sourceWidth?: number | null;
    sourceHeight?: number | null;
    sourceFps?: number | null;
  },
): UnifiedRenderManifest => UnifiedRenderManifestSchema.parse({
  ...result.manifest,
  source: {
    ...result.manifest.source,
    width: sourceWidth ?? result.manifest.source.width,
    height: sourceHeight ?? result.manifest.source.height,
    fps: sourceFps ?? result.manifest.source.fps,
  },
  typography,
  audio: {
    ...result.manifest.audio,
    ...(music ? {
      musicTrackUrl: music.localFilePath,
      musicReference: {
        trackId: music.trackId,
        title: music.title,
        sourceKind: music.sourceKind,
        localFilePath: music.localFilePath,
        browserUrl: music.browserUrl,
        durationSeconds: music.durationSeconds,
        renderSafe: music.renderSafe,
        licenseStatus: music.licenseStatus,
      },
      musicBpm: music.analysis.bpm,
      beats: music.analysis.beatTimes.map((seconds) => Math.round(seconds * 1000)),
      energyCurve: music.analysis.energyCurve,
    } : {}),
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
}: CreateJosephUploadPipelineOptions): JosephUploadPipeline => {
  const assetResolver = new LocalAssetResolver({publicDir, uploadDir});

  return {
    async createRenderJob(input) {
      const uploadInstanceId = input.sessionId;
      const retryIndex = input.retryIndex ?? 0;
      const promptText = input.promptText?.trim() || DEFAULT_PROMPT;
      const sourceReference = await assetResolver.registerUpload(input.sourcePath, uploadInstanceId);
      const durationMs = Math.min(Math.max(1000, input.sourceDurationMs ?? 10_000), 90_000);
      const transcriptPath = path.join(storageDir, "joseph-transcripts", `${safeSegment(uploadInstanceId)}.json`);
      await writeFallbackTranscript({transcriptPath, durationMs, promptText});

      const seedHint = Math.max(1, Math.round(durationMs) + retryIndex + input.profile.length);
      const analyzedTracks = await analyzeRenderableTracks(listMusic(), analyze);
      const selectedMusic = selectMusicForProfile({
        profile: input.profile,
        videoDuration: durationMs / 1000,
        speechDensity: 0.35,
        energyCurve: [0.42, 0.68, 0.78, 0.55],
        availableTracks: analyzedTracks,
        seed: seedHint,
      })?.track ?? null;
      const typography = selectHeroFonts({profile: profileTone(input.profile), preferHydratedLibrary: true}, seedHint).hero;

      const ledger = new ReplayLedger(ledgerPath);
      const promptRegistry = new PromptRegistry(promptRegistryPath);
      const orchestratorResult = await orchestrateRender({
        sourceVideoPath: sourceReference.browserUrl,
        sourceFingerprintPath: sourceReference.filePath,
        transcriptPath,
        audioPath: sourceReference.filePath,
        musicPath: selectedMusic?.localFilePath,
        promptText,
        profile: input.profile,
        uploadInstanceId,
        retryIndex,
        evidenceDir,
      }, ledger, promptRegistry);

      const manifest = withManifestAssets(orchestratorResult, {
        typography,
        music: selectedMusic,
        sourceWidth: input.sourceWidth,
        sourceHeight: input.sourceHeight,
        sourceFps: input.sourceFps,
      });
      const job = await enqueueJosephRenderJob({
        manifest,
        variationKey: orchestratorResult.variationKey.key,
        evidencePath: orchestratorResult.evidencePaths.jobDir,
      });

      return {
        renderJobId: job.id,
        replayLedgerEntryId: `${orchestratorResult.variationKey.uploadInstanceId}:${orchestratorResult.variationKey.retryIndex}`,
        evidencePath: orchestratorResult.evidencePaths.jobDir,
        variationKey: orchestratorResult.variationKey.key,
        manifest,
      };
    },
  };
};
