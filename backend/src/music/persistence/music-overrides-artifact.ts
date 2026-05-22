import type {FileJobRepository} from "../../repository";
import {
  musicOverrideRequestSchema,
  musicOverrideSchema,
  musicOverridesArtifactSchema,
  type MusicOverride,
  type MusicOverrideRequest,
  type MusicOverridesArtifact
} from "../schemas/music-override.schema";

const nowIso = (now?: () => string): string => {
  return now?.() ?? new Date().toISOString();
};

export const getVideoAwareMusicOverridesArtifactPath = (repository: FileJobRepository, jobId: string): string => {
  return repository.artifactPath(jobId, "video_aware_music_overrides");
};

export const writeMusicOverridesArtifact = async ({
  repository,
  jobId,
  artifact
}: {
  repository: FileJobRepository;
  jobId: string;
  artifact: MusicOverridesArtifact;
}): Promise<string> => {
  const parsedArtifact = musicOverridesArtifactSchema.parse(artifact);
  const artifactPath = await repository.writeVideoAwareMusicOverrides(jobId, parsedArtifact);
  await repository.updateJobRecord(jobId, (current) => ({
    ...current,
    artifact_paths: {
      ...current.artifact_paths,
      video_aware_music_overrides: artifactPath
    }
  }));
  return artifactPath;
};

export const readMusicOverridesArtifact = async ({
  repository,
  jobId
}: {
  repository: FileJobRepository;
  jobId: string;
}): Promise<MusicOverridesArtifact> => {
  const rawArtifact = await repository.readArtifact<unknown>(jobId, "video_aware_music_overrides");
  const parsedArtifact = musicOverridesArtifactSchema.safeParse(rawArtifact);

  if (!parsedArtifact.success) {
    throw new Error("video_aware_music_overrides does not contain a valid override artifact.");
  }

  return parsedArtifact.data;
};

export const appendMusicOverride = async ({
  repository,
  jobId,
  request,
  now
}: {
  repository: FileJobRepository;
  jobId: string;
  request: MusicOverrideRequest;
  now?: () => string;
}): Promise<{artifactPath: string; override: MusicOverride; artifact: MusicOverridesArtifact}> => {
  const parsedRequest = musicOverrideRequestSchema.parse(request);
  const timestamp = nowIso(now);
  const existingArtifact = await repository.artifactExists(jobId, "video_aware_music_overrides")
    ? await readMusicOverridesArtifact({repository, jobId})
    : musicOverridesArtifactSchema.parse({
        artifactType: "video_aware_music_overrides",
        jobId,
        overrides: [],
        createdAt: timestamp,
        updatedAt: timestamp
      });
  const override = musicOverrideSchema.parse({
    id: `${jobId}-override-${String(existingArtifact.overrides.length + 1).padStart(2, "0")}`,
    jobId,
    targetType: parsedRequest.targetType,
    targetId: parsedRequest.targetId ?? null,
    startSec: parsedRequest.startSec ?? null,
    endSec: parsedRequest.endSec ?? null,
    trackId: parsedRequest.trackId ?? null,
    action: parsedRequest.action,
    reason: parsedRequest.reason ?? null,
    createdAt: timestamp
  });
  const artifact = musicOverridesArtifactSchema.parse({
    ...existingArtifact,
    overrides: [...existingArtifact.overrides, override],
    updatedAt: timestamp
  });
  const artifactPath = await writeMusicOverridesArtifact({
    repository,
    jobId,
    artifact
  });

  return {
    artifactPath,
    override,
    artifact
  };
};
