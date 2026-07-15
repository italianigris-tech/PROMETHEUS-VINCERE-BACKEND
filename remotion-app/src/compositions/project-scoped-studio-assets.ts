import {staticFile} from "remotion";

export const PROJECT_SCOPED_STUDIO_ASSET_BINDING_MESSAGE =
  "Assets exist in the Studio sidebar, but this composition only renders an explicit videoSrc or studioSampleId.";

export const PROJECT_SCOPED_STUDIO_VIDEO_SRC_PROP_GUIDANCE = `{
  "videoSrc": "http://127.0.0.1:8000/api/edit-sessions/<SESSION_ID>/source"
}`;

export type ProjectScopedStudioSampleAsset = {
  readonly id: string;
  readonly label: string;
  readonly publicPath: string;
  readonly videoSrc: string;
};

export const PROJECT_SCOPED_STUDIO_SAMPLE_ASSETS = [
  {
    id: "raw-landscape-test-video",
    label: "Raw landscape test video",
    publicPath: "dev-fixtures/test-video.mp4",
    videoSrc: staticFile("dev-fixtures/test-video.mp4")
  }
] as const satisfies readonly ProjectScopedStudioSampleAsset[];

export const PROJECT_SCOPED_STUDIO_DEFAULT_SAMPLE_ID = PROJECT_SCOPED_STUDIO_SAMPLE_ASSETS[0].id;

export const PROJECT_SCOPED_STUDIO_SAMPLE_PROP_GUIDANCE = `{
  "studioSampleId": "${PROJECT_SCOPED_STUDIO_DEFAULT_SAMPLE_ID}"
}`;

const studioSampleAssetById = new Map<string, ProjectScopedStudioSampleAsset>(
  PROJECT_SCOPED_STUDIO_SAMPLE_ASSETS.map((asset) => [asset.id, asset] as const)
);

export const getProjectScopedStudioSampleAsset = (
  sampleId: string | null | undefined
): ProjectScopedStudioSampleAsset | null => {
  const normalizedSampleId = sampleId?.trim();
  if (!normalizedSampleId) {
    return null;
  }

  return studioSampleAssetById.get(normalizedSampleId) ?? null;
};

export const getProjectScopedStudioSampleIds = (): string[] => {
  return PROJECT_SCOPED_STUDIO_SAMPLE_ASSETS.map((asset) => asset.id);
};
