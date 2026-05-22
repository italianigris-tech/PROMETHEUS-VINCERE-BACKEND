import type {FileJobRepository} from "../../repository";
import {musicPreflightReportSchema, type MusicPreflightReport} from "../schemas/music-preflight.schema";

export const getVideoAwareMusicPreflightArtifactPath = (repository: FileJobRepository, jobId: string): string => {
  return repository.artifactPath(jobId, "video_aware_music_preflight");
};

export const writeVideoAwareMusicPreflightArtifact = async ({
  repository,
  jobId,
  report
}: {
  repository: FileJobRepository;
  jobId: string;
  report: MusicPreflightReport;
}): Promise<string> => {
  const parsedReport = musicPreflightReportSchema.parse(report);
  return repository.writeVideoAwareMusicPreflight(jobId, parsedReport);
};

export const readVideoAwareMusicPreflightArtifact = async ({
  repository,
  jobId
}: {
  repository: FileJobRepository;
  jobId: string;
}): Promise<MusicPreflightReport> => {
  const rawArtifact = await repository.readArtifact<unknown>(jobId, "video_aware_music_preflight");
  const parsedReport = musicPreflightReportSchema.safeParse(rawArtifact);

  if (!parsedReport.success) {
    throw new Error("video_aware_music_preflight does not contain a valid preflight report.");
  }

  return parsedReport.data;
};
