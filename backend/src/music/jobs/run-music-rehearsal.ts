import type {FileJobRepository} from "../../repository";
import type {BuildAudioPlanDryRunInput} from "./build-audio-plan-dry-run";
import {buildAudioPlanDryRun} from "./build-audio-plan-dry-run";
import {buildSoundManifestRehearsal} from "./build-sound-manifest-rehearsal";

export class MusicRehearsalJobIdRequiredError extends Error {
  public constructor() {
    super("runMusicRehearsal requires a non-empty jobId.");
    this.name = "MusicRehearsalJobIdRequiredError";
  }
}

export class MusicRehearsalJobMissingError extends Error {
  public constructor(jobId: string) {
    super(`Job artifact is missing for job ${jobId}.`);
    this.name = "MusicRehearsalJobMissingError";
  }
}

export class MusicRehearsalArtifactsExistError extends Error {
  public constructor(jobId: string, artifactKeys: string[]) {
    super(
      `Manual music rehearsal artifacts already exist for job ${jobId}: ${artifactKeys.join(", ")}. ` +
      "Re-run with overwrite enabled to replace them deterministically."
    );
    this.name = "MusicRehearsalArtifactsExistError";
  }
}

export type RunMusicRehearsalInput = {
  repository: FileJobRepository;
  jobId: string;
  previewStartSec?: number;
  previewEndSec?: number;
  creativeDirection?: BuildAudioPlanDryRunInput["creativeDirection"];
  strict?: boolean;
  useCatalogCandidates?: boolean;
  catalogEntries?: BuildAudioPlanDryRunInput["catalogEntries"];
  overwrite?: boolean;
  now?: () => string;
};

export type RunMusicRehearsalResult = {
  jobId: string;
  audioPlanArtifactPath: string;
  soundManifestArtifactPath: string;
  timelineSegmentCount: number;
  musicEventCount: number;
  sfxEventCount: number;
  transitionEventCount: number;
  duckingRegionCount: number;
  manifestDuration: number;
  warnings: string[];
  planMode: "dry_run" | "render_ready";
  createdAt: string;
};

const nowIso = (now?: () => string): string => {
  return now?.() ?? new Date().toISOString();
};

const ensureArtifactsWritable = async ({
  repository,
  jobId,
  overwrite
}: {
  repository: FileJobRepository;
  jobId: string;
  overwrite?: boolean;
}): Promise<void> => {
  if (overwrite) {
    return;
  }

  const existingArtifacts = (
    await Promise.all([
      repository.artifactExists(jobId, "video_aware_audio_plan"),
      repository.artifactExists(jobId, "video_aware_sound_manifest")
    ])
  )
    .map((exists, index) => ({
      exists,
      key: index === 0 ? "video_aware_audio_plan" : "video_aware_sound_manifest"
    }))
    .filter((entry) => entry.exists)
    .map((entry) => entry.key);

  if (existingArtifacts.length > 0) {
    throw new MusicRehearsalArtifactsExistError(jobId, existingArtifacts);
  }
};

export const runMusicRehearsal = async (
  input: RunMusicRehearsalInput
): Promise<RunMusicRehearsalResult> => {
  const jobId = input.jobId.trim();
  if (!jobId) {
    throw new MusicRehearsalJobIdRequiredError();
  }

  if (!(await input.repository.artifactExists(jobId, "job"))) {
    throw new MusicRehearsalJobMissingError(jobId);
  }

  await ensureArtifactsWritable({
    repository: input.repository,
    jobId,
    overwrite: input.overwrite
  });

  const createdAt = nowIso(input.now);
  const audioPlan = await buildAudioPlanDryRun({
    repository: input.repository,
    jobId,
    creativeDirection: input.creativeDirection,
    previewStartSec: input.previewStartSec,
    previewEndSec: input.previewEndSec,
    strict: input.strict,
    useCatalogCandidates: input.useCatalogCandidates,
    catalogEntries: input.catalogEntries,
    now: input.now
  });
  const soundManifest = await buildSoundManifestRehearsal({
    repository: input.repository,
    jobId,
    strict: input.strict,
    now: input.now
  });

  return {
    jobId,
    audioPlanArtifactPath: audioPlan.artifactPath,
    soundManifestArtifactPath: soundManifest.artifactPath,
    timelineSegmentCount: audioPlan.plan.timelineSegments.length,
    musicEventCount: audioPlan.plan.musicEvents.length,
    sfxEventCount: audioPlan.plan.sfxEvents.length,
    transitionEventCount: audioPlan.plan.transitionEvents.length,
    duckingRegionCount: audioPlan.plan.duckingRegions.length,
    manifestDuration: soundManifest.manifestDuration,
    warnings: [...audioPlan.warnings, ...soundManifest.warnings],
    planMode: audioPlan.plan.planMode,
    createdAt
  };
};
