import type {FileJobRepository} from "../../repository";
import type {MusicTrack} from "../schemas/music-track.schema";
import {adaptAudioPlanToSoundDesignManifestWithHints} from "../renderer/manifest-adapter";
import {readVideoAwareAudioPlanArtifact} from "../persistence/audio-plan-artifact";
import {
  writeVideoAwareSoundManifestArtifact,
  type VideoAwareSoundManifestArtifact
} from "../persistence/sound-manifest-artifact";

export class VideoAwareAudioPlanArtifactMissingError extends Error {
  public constructor(jobId: string) {
    super(`video_aware_audio_plan is missing for job ${jobId}.`);
    this.name = "VideoAwareAudioPlanArtifactMissingError";
  }
}

export class VideoAwareAudioPlanArtifactInvalidError extends Error {
  public constructor(jobId: string, reason: string) {
    super(`video_aware_audio_plan is invalid for job ${jobId}: ${reason}`);
    this.name = "VideoAwareAudioPlanArtifactInvalidError";
  }
}

export type BuildSoundManifestRehearsalInput = {
  repository: FileJobRepository;
  jobId: string;
  strict?: boolean;
  tracksById?: Record<string, MusicTrack>;
  sfxAssetPaths?: Record<string, string>;
  dialogueSource?: string;
  now?: () => string;
};

export type BuildSoundManifestRehearsalResult = {
  jobId: string;
  sourcePlanId: string;
  manifestDuration: number;
  musicCueCount: number;
  sfxCueCount: number;
  dialogueOrDuckingHintCount: number;
  artifactPath: string;
  warnings: string[];
};

const nowIso = (now?: () => string): string => {
  return now?.() ?? new Date().toISOString();
};

export const buildSoundManifestRehearsal = async (
  input: BuildSoundManifestRehearsalInput
): Promise<BuildSoundManifestRehearsalResult> => {
  if (!(await input.repository.artifactExists(input.jobId, "video_aware_audio_plan"))) {
    throw new VideoAwareAudioPlanArtifactMissingError(input.jobId);
  }

  let plan;
  try {
    plan = await readVideoAwareAudioPlanArtifact({
      repository: input.repository,
      jobId: input.jobId
    });
  } catch (error) {
    throw new VideoAwareAudioPlanArtifactInvalidError(
      input.jobId,
      error instanceof Error ? error.message : String(error)
    );
  }

  if (plan.planMode !== "dry_run" && plan.planMode !== "render_ready") {
    throw new VideoAwareAudioPlanArtifactInvalidError(input.jobId, `Unsupported planMode: ${String(plan.planMode)}`);
  }

  const adapted = adaptAudioPlanToSoundDesignManifestWithHints({
    plan,
    tracksById: input.tracksById,
    sfxAssetPaths: input.sfxAssetPaths,
    dialogueSource: input.dialogueSource
  });

  if (input.strict && adapted.renderHints.warnings.length > 0) {
    throw new VideoAwareAudioPlanArtifactInvalidError(
      input.jobId,
      `Strict rehearsal rejected manifest adaptation warnings: ${adapted.renderHints.warnings.join("; ")}`
    );
  }

  const artifact: VideoAwareSoundManifestArtifact = {
    artifactType: "video_aware_sound_manifest_rehearsal",
    sourcePlanId: plan.id,
    planMode: plan.planMode,
    manifest: adapted.manifest,
    renderHints: adapted.renderHints,
    warnings: adapted.renderHints.warnings,
    createdAt: nowIso(input.now)
  };

  const artifactPath = await writeVideoAwareSoundManifestArtifact({
    repository: input.repository,
    jobId: input.jobId,
    artifact
  });
  await input.repository.updateJobRecord(input.jobId, (current) => ({
    ...current,
    artifact_paths: {
      ...current.artifact_paths,
      video_aware_sound_manifest: artifactPath
    }
  }));

  return {
    jobId: input.jobId,
    sourcePlanId: plan.id,
    manifestDuration: adapted.manifest.duration,
    musicCueCount: adapted.manifest.musicCues.length,
    sfxCueCount: adapted.manifest.sfx.length,
    dialogueOrDuckingHintCount: adapted.renderHints.duckingRegions.length,
    artifactPath,
    warnings: adapted.renderHints.warnings
  };
};
