import {readFile, stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {
  clipSelectionSchema,
  inputManifestSchema,
  metadataProfileSchema,
  type ClipSelection,
  type InputManifest,
  type JobRecord,
  type MetadataProfile,
  type TranscribedWord
} from "../../schemas";
import {clearCachedEnv, loadEnv} from "../../config";
import type {FileJobRepository} from "../../repository";
import {analyzeTrack} from "../analyzer/track-analyzer";
import {readR2MusicCatalogArtifact} from "../catalog/r2-music-catalog-artifact";
import {indexTrack} from "../indexer/track-indexer";
import {writeVideoAwareAudioPlanArtifact} from "../persistence/audio-plan-artifact";
import type {R2MusicCatalogEntry} from "../catalog/r2-music-catalog.schema";
import {buildVideoAwareAudioPlan} from "../video-aware-planner/build-video-aware-audio-plan";
import type {MusicTrack} from "../schemas/music-track.schema";
import {videoAwareAudioPlanSchema, type VideoAwareAudioPlan} from "../schemas/audio-plan.schema";

type LocalMusicCatalogEntry = {
  id: string;
  label: string;
  src: string;
  sourceFileName: string;
  durationSeconds: number;
  tags?: string[];
  intensity?: "soft" | "medium" | "hard";
};

export type BuildAudioPlanDryRunInput = {
  repository: FileJobRepository;
  jobId: string;
  creativeDirection?: {
    summary?: string;
    moodTags?: string[];
    pacing?: string;
    emphasisMoments?: string[];
    constraints?: string[];
  } | null;
  userId?: string | null;
  transcriptId?: string | null;
  previewStartSec?: number;
  previewEndSec?: number;
  strict?: boolean;
  useCatalogCandidates?: boolean;
  catalogEntries?: R2MusicCatalogEntry[];
  now?: () => string;
};

export type BuildAudioPlanDryRunResult = {
  artifactPath: string;
  artifactKey: "video_aware_audio_plan";
  plan: VideoAwareAudioPlan;
  warnings: string[];
  summary: {
    jobId: string;
    timelineSegments: number;
    musicEvents: number;
    sfxEvents: number;
    previewStartSec: number | null;
    previewEndSec: number | null;
  };
};

export class MusicCatalogCandidatesMissingError extends Error {
  public constructor(reason: string) {
    super(reason);
    this.name = "MusicCatalogCandidatesMissingError";
  }
}

const safeReadArtifact = async <T>({
  repository,
  jobId,
  key
}: {
  repository: FileJobRepository;
  jobId: string;
  key: Parameters<FileJobRepository["artifactPath"]>[1];
}): Promise<T | null> => {
  if (!(await repository.artifactExists(jobId, key))) {
    return null;
  }

  return repository.readArtifact<T>(jobId, key);
};

const getProjectRoot = (): string => {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
};

const resolveLocalMusicCatalogPath = (): string => {
  return path.join(getProjectRoot(), "remotion-app", "src", "data", "music.local.json");
};

const resolveLocalMusicFilePath = (src: string): string => {
  return path.join(getProjectRoot(), "remotion-app", "public", src.replace(/\//g, path.sep));
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const loadLocalCatalogTracks = async (): Promise<MusicTrack[]> => {
  const catalogPath = resolveLocalMusicCatalogPath();
  if (!(await fileExists(catalogPath))) {
    return [];
  }

  const raw = await readFile(catalogPath, "utf-8");
  const entries = JSON.parse(raw) as LocalMusicCatalogEntry[];
  const nowIso = "1970-01-01T00:00:00.000Z";
  const intensityToEnergy: Record<NonNullable<LocalMusicCatalogEntry["intensity"]>, number> = {
    soft: 0.3,
    medium: 0.5,
    hard: 0.72
  };

  return entries.slice(0, 8).map((entry) => {
    const tags = entry.tags ?? [];
    const track = indexTrack({
      id: entry.id,
      title: entry.label,
      artist: entry.sourceFileName.replace(/\.[a-z0-9]+$/i, ""),
      source: "music_sync_local_catalog",
      sourceUrl: null,
      storagePath: resolveLocalMusicFilePath(entry.src),
      licenseType: "unverified_local_catalog",
      commercialAllowed: false,
      attributionRequired: false,
      licenseVerified: false,
      durationSec: entry.durationSeconds,
      genreTags: tags,
      moodTags: tags,
      instrumentTags: [],
      useCaseTags: tags,
      avoidWhen: ["export_until_license_verified"],
      createdAt: nowIso
    });

    return analyzeTrack({
      track: {
        ...track,
        energy: intensityToEnergy[entry.intensity ?? "medium"],
        valence: entry.intensity === "soft" ? 0.55 : 0.5,
        arousal: entry.intensity === "hard" ? 0.72 : entry.intensity === "soft" ? 0.3 : 0.5,
        tension: entry.intensity === "hard" ? 0.62 : 0.35,
        prestige: 0.5,
        urgency: entry.intensity === "hard" ? 0.65 : 0.28,
        clarity: 0.58,
        speechFriendliness: entry.intensity === "soft" ? 0.76 : entry.intensity === "hard" ? 0.42 : 0.6
      }
    });
  });
};

const resolveTranscriptWords = (metadataProfile: MetadataProfile | null): TranscribedWord[] => {
  return metadataProfile?.transcript_words ?? [];
};

const resolveVideoDurationSec = ({
  job,
  metadataProfile,
  clipSelection,
  transcriptWords
}: {
  job: JobRecord;
  metadataProfile: MetadataProfile | null;
  clipSelection: ClipSelection | null;
  transcriptWords: TranscribedWord[];
}): number => {
  const jobDurationSec = job.source_summary.source_duration_ms ? job.source_summary.source_duration_ms / 1000 : 0;
  const metadataDurationSec = Number(metadataProfile?.source_media?.source_duration_ms ?? 0) / 1000;
  const clipDurationSec = (clipSelection?.selected_clips[0]?.export_end_ms ?? 0) / 1000;
  const transcriptDurationSec = (transcriptWords.at(-1)?.end_ms ?? 0) / 1000;

  return [jobDurationSec, metadataDurationSec, clipDurationSec, transcriptDurationSec, 1]
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => right - left)[0];
};

const resolveCreativeDirection = ({
  input,
  job,
  inputManifest
}: {
  input: BuildAudioPlanDryRunInput;
  job: JobRecord;
  inputManifest: InputManifest | null;
}) => {
  if (input.creativeDirection) {
    return input.creativeDirection;
  }

  return {
    summary: inputManifest?.prompt_excerpt ?? job.request_summary.prompt_excerpt,
    moodTags: [],
    pacing: "",
    emphasisMoments: [],
    constraints: []
  };
};

const resolveCatalogEntries = async (
  input: BuildAudioPlanDryRunInput
): Promise<{entries: R2MusicCatalogEntry[]; warnings: string[]}> => {
  if (!input.useCatalogCandidates) {
    return {
      entries: [],
      warnings: []
    };
  }

  if (input.catalogEntries && input.catalogEntries.length > 0) {
    return {
      entries: input.catalogEntries,
      warnings: []
    };
  }

  clearCachedEnv();
  const env = loadEnv();
  try {
    const catalog = await readR2MusicCatalogArtifact({
      inputPath: env.MUSIC_R2_CATALOG_PATH.trim() || undefined
    });
    return {
      entries: catalog.entries,
      warnings: []
    };
  } catch (error) {
    const message = [
      "Normalized R2 music catalog is unavailable.",
      error instanceof Error ? error.message : String(error),
      "Run `npm run music:catalog:normalize -- --input \"../YOUTUBE MUSIC DOWNLOADER -THRAGG/downloads/music-catalog.json\"` to rebuild it."
    ].join(" ");

    if (input.strict) {
      throw new MusicCatalogCandidatesMissingError(message);
    }

    return {
      entries: [],
      warnings: [
        `${message} Falling back to placeholder music because strict mode is disabled.`
      ]
    };
  }
};

export const buildAudioPlanDryRun = async (
  input: BuildAudioPlanDryRunInput
): Promise<BuildAudioPlanDryRunResult> => {
  const job = await input.repository.getJobRecord(input.jobId);
  const [inputManifestRaw, metadataProfileRaw, clipSelectionRaw, candidateTracks, catalogResolution] = await Promise.all([
    safeReadArtifact<InputManifest>({repository: input.repository, jobId: input.jobId, key: "input_manifest"}),
    safeReadArtifact<MetadataProfile>({repository: input.repository, jobId: input.jobId, key: "metadata_profile"}),
    safeReadArtifact<ClipSelection>({repository: input.repository, jobId: input.jobId, key: "clip_selection"}),
    input.useCatalogCandidates ? Promise.resolve<MusicTrack[]>([]) : loadLocalCatalogTracks(),
    resolveCatalogEntries(input)
  ]);
  const inputManifest = inputManifestRaw ? inputManifestSchema.parse(inputManifestRaw) : null;
  const metadataProfile = metadataProfileRaw ? metadataProfileSchema.parse(metadataProfileRaw) : null;
  const clipSelection = clipSelectionRaw ? clipSelectionSchema.parse(clipSelectionRaw) : null;
  const transcriptWords = resolveTranscriptWords(metadataProfile);
  const videoDurationSec = resolveVideoDurationSec({
    job,
    metadataProfile,
    clipSelection,
    transcriptWords
  });
  const plan = buildVideoAwareAudioPlan({
    jobId: input.jobId,
    projectId: inputManifest?.project_id ?? null,
    userId: input.userId ?? null,
    sourceVideoId: inputManifest?.video_id ?? null,
    transcriptId: input.transcriptId ?? null,
    videoDurationSec,
    transcriptWords,
    selectedClip: clipSelection?.selected_clips[0] ?? null,
    creativeDirection: resolveCreativeDirection({
      input,
      job,
      inputManifest
    }),
    previewStartSec: input.previewStartSec,
    previewEndSec: input.previewEndSec,
    useCatalogCandidates: input.useCatalogCandidates ?? false,
    catalogEntries: catalogResolution.entries,
    candidateTracks,
    now: input.now
  });
  const finalPlan = catalogResolution.warnings.length > 0
    ? videoAwareAudioPlanSchema.parse({
        ...plan,
        renderSettings: {
          ...plan.renderSettings,
          notes: [...plan.renderSettings.notes, ...catalogResolution.warnings]
        }
      })
    : plan;
  const artifactPath = await writeVideoAwareAudioPlanArtifact({
    repository: input.repository,
    jobId: input.jobId,
    plan: finalPlan
  });
  await input.repository.updateJobRecord(input.jobId, (current) => ({
    ...current,
    artifact_paths: {
      ...current.artifact_paths,
      video_aware_audio_plan: artifactPath
    }
  }));

  return {
    artifactPath,
    artifactKey: "video_aware_audio_plan",
    plan: finalPlan,
    warnings: catalogResolution.warnings,
    summary: {
      jobId: input.jobId,
      timelineSegments: finalPlan.timelineSegments.length,
      musicEvents: finalPlan.musicEvents.length,
      sfxEvents: finalPlan.sfxEvents.length,
      previewStartSec: finalPlan.previewStartSec,
      previewEndSec: finalPlan.previewEndSec
    }
  };
};
