import path from "node:path";

import type {FileJobRepository} from "../../repository";
import {readVideoAwareAudioPlanArtifact} from "../persistence/audio-plan-artifact";
import {readVideoAwareSoundManifestArtifact} from "../persistence/sound-manifest-artifact";
import {adaptAudioPlanToSoundDesignManifestWithHints} from "../renderer/manifest-adapter";
import {renderAudioPlan, type RenderAudioPlanResult} from "../renderer/mix-renderer";

export class MusicPreviewMixJobMissingError extends Error {
  public constructor(jobId: string) {
    super(`Job artifact is missing for job ${jobId}.`);
    this.name = "MusicPreviewMixJobMissingError";
  }
}

export class MusicPreviewMixAudioPlanMissingError extends Error {
  public constructor(jobId: string) {
    super(`video_aware_audio_plan is missing for job ${jobId}.`);
    this.name = "MusicPreviewMixAudioPlanMissingError";
  }
}

export class MusicPreviewMixManifestMissingError extends Error {
  public constructor(jobId: string) {
    super(`video_aware_sound_manifest is missing for job ${jobId}.`);
    this.name = "MusicPreviewMixManifestMissingError";
  }
}

export type RenderMusicPreviewMixInput = {
  repository: FileJobRepository;
  jobId: string;
  overwrite?: boolean;
};

export type RenderMusicPreviewMixResult = RenderAudioPlanResult & {
  jobId: string;
  artifactPath: string | null;
};

const resolveLocalDialogueSource = async ({
  repository,
  jobId
}: {
  repository: FileJobRepository;
  jobId: string;
}): Promise<string | null> => {
  const job = await repository.getJobRecord(jobId);
  const candidate = job.source_summary.source_storage_uri?.trim() ?? "";
  if (!candidate) {
    return null;
  }

  const resolved = path.isAbsolute(candidate)
    ? candidate
    : path.resolve(candidate);

  return (await repository.pathExists(resolved)) ? resolved : null;
};

export const renderMusicPreviewMix = async (
  input: RenderMusicPreviewMixInput
): Promise<RenderMusicPreviewMixResult> => {
  const jobId = input.jobId.trim();
  if (!(await input.repository.artifactExists(jobId, "job"))) {
    throw new MusicPreviewMixJobMissingError(jobId);
  }
  if (!(await input.repository.artifactExists(jobId, "video_aware_audio_plan"))) {
    throw new MusicPreviewMixAudioPlanMissingError(jobId);
  }
  if (!(await input.repository.artifactExists(jobId, "video_aware_sound_manifest"))) {
    throw new MusicPreviewMixManifestMissingError(jobId);
  }

  const [plan, manifestArtifact, dialogueSource, job] = await Promise.all([
    readVideoAwareAudioPlanArtifact({
      repository: input.repository,
      jobId
    }),
    readVideoAwareSoundManifestArtifact({
      repository: input.repository,
      jobId
    }),
    resolveLocalDialogueSource({
      repository: input.repository,
      jobId
    }),
    input.repository.getJobRecord(jobId)
  ]);

  const outputPath = path.join(input.repository.jobDir(jobId), "audio", "video-aware-audio-preview-mix.wav");
  const manifest = dialogueSource
    ? adaptAudioPlanToSoundDesignManifestWithHints({
        plan,
        dialogueSource
      }).manifest
    : manifestArtifact.manifest;
  const result = await renderAudioPlan({
    plan,
    manifest,
    outputAudioPath: outputPath,
    baseDir: input.repository.rootDir
  });

  if (result.status === "rendered" && result.outputAudioPath) {
    await input.repository.updateJobRecord(jobId, (current) => ({
      ...current,
      artifact_paths: {
        ...current.artifact_paths,
        video_aware_audio_preview_mix: result.outputAudioPath ?? null
      }
    }));
  } else if (result.status !== "rendered" && input.overwrite) {
    await input.repository.updateJobRecord(jobId, (current) => ({
      ...current,
      artifact_paths: {
        ...current.artifact_paths,
        video_aware_audio_preview_mix: current.artifact_paths.video_aware_audio_preview_mix ?? null
      }
    }));
  }

  return {
    ...result,
    jobId: job.job_id,
    artifactPath: result.status === "rendered" ? result.outputAudioPath ?? null : null
  };
};
