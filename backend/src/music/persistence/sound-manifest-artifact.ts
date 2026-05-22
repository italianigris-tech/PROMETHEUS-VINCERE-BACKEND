import {z} from "zod";

import type {FileJobRepository} from "../../repository";
import {soundDesignManifestSchema, type SoundDesignManifest} from "../../sound-engine/types";
import {videoAwareAudioPlanModeSchema} from "../schemas/audio-plan.schema";

const orphanTransitionEventSchema = z.object({
  id: z.string().trim().min(1),
  type: z.string().trim().min(1),
  videoStartSec: z.number().nonnegative(),
  videoEndSec: z.number().nonnegative()
});

const duckingHintSchema = z.object({
  id: z.string().trim().min(1),
  videoStartSec: z.number().nonnegative(),
  videoEndSec: z.number().nonnegative(),
  targetMusicDb: z.number(),
  reason: z.string().trim().min(1)
});

export const adaptedSoundDesignRenderHintsSchema = z.object({
  planMode: videoAwareAudioPlanModeSchema,
  unresolvedTrackIds: z.array(z.string()).default([]),
  placeholderCueIds: z.array(z.string()).default([]),
  unverifiedTrackIds: z.array(z.string()).default([]),
  orphanTransitionEvents: z.array(orphanTransitionEventSchema).default([]),
  duckingRegions: z.array(duckingHintSchema).default([]),
  warnings: z.array(z.string()).default([])
});

export type AdaptedSoundDesignRenderHintsArtifact = z.infer<typeof adaptedSoundDesignRenderHintsSchema>;

export const videoAwareSoundManifestArtifactSchema = z.object({
  artifactType: z.literal("video_aware_sound_manifest_rehearsal"),
  sourcePlanId: z.string().trim().min(1),
  planMode: videoAwareAudioPlanModeSchema,
  manifest: soundDesignManifestSchema,
  renderHints: adaptedSoundDesignRenderHintsSchema,
  warnings: z.array(z.string()).default([]),
  createdAt: z.string().trim().min(1)
});

export type VideoAwareSoundManifestArtifact = z.infer<typeof videoAwareSoundManifestArtifactSchema>;

export type WriteVideoAwareSoundManifestArtifactInput = {
  repository: FileJobRepository;
  jobId: string;
  artifact: VideoAwareSoundManifestArtifact;
};

export const getVideoAwareSoundManifestArtifactPath = (
  repository: FileJobRepository,
  jobId: string
): string => {
  return repository.artifactPath(jobId, "video_aware_sound_manifest");
};

export const writeVideoAwareSoundManifestArtifact = async ({
  repository,
  jobId,
  artifact
}: WriteVideoAwareSoundManifestArtifactInput): Promise<string> => {
  const parsedArtifact = videoAwareSoundManifestArtifactSchema.parse(artifact);
  return repository.writeVideoAwareSoundManifest(jobId, parsedArtifact);
};

export const readVideoAwareSoundManifestArtifact = async ({
  repository,
  jobId
}: {
  repository: FileJobRepository;
  jobId: string;
}): Promise<VideoAwareSoundManifestArtifact> => {
  const rawArtifact = await repository.readArtifact<unknown>(jobId, "video_aware_sound_manifest");
  const parsedArtifact = videoAwareSoundManifestArtifactSchema.safeParse(rawArtifact);

  if (!parsedArtifact.success) {
    throw new Error("video_aware_sound_manifest does not contain a valid rehearsal artifact.");
  }

  return parsedArtifact.data;
};

export type VideoAwareSoundManifest = SoundDesignManifest;
