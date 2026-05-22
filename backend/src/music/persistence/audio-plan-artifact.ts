import type {FileJobRepository} from "../../repository";
import {videoAwareAudioPlanSchema, type VideoAwareAudioPlan} from "../schemas/audio-plan.schema";

export const getVideoAwareAudioPlanArtifactPath = (repository: FileJobRepository, jobId: string): string => {
  return repository.artifactPath(jobId, "video_aware_audio_plan");
};

export const writeVideoAwareAudioPlanArtifact = async ({
  repository,
  jobId,
  plan
}: {
  repository: FileJobRepository;
  jobId: string;
  plan: VideoAwareAudioPlan;
}): Promise<string> => {
  const parsedPlan = videoAwareAudioPlanSchema.parse({
    ...plan,
    planMode: plan.planMode ?? "dry_run"
  });
  return repository.writeVideoAwareAudioPlan(jobId, parsedPlan);
};

export const readVideoAwareAudioPlanArtifact = async ({
  repository,
  jobId
}: {
  repository: FileJobRepository;
  jobId: string;
}): Promise<VideoAwareAudioPlan> => {
  const rawArtifact = await repository.readArtifact<unknown>(jobId, "video_aware_audio_plan");
  const parsedPlan = videoAwareAudioPlanSchema.safeParse(rawArtifact);

  if (!parsedPlan.success) {
    throw new Error("video_aware_audio_plan does not contain a VideoAwareAudioPlan artifact.");
  }

  return parsedPlan.data;
};

export const persistVideoAwareAudioPlanArtifact = writeVideoAwareAudioPlanArtifact;
