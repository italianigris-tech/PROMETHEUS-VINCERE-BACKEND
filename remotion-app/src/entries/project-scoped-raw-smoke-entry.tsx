import React from "react";
import {Composition, registerRoot} from "remotion";

import {
  ProjectScopedMotionComposition,
  type ProjectScopedMotionCompositionProps
} from "../compositions/ProjectScopedMotionComposition";
import {PROJECT_SCOPED_PREVIEW_COMPOSITION_ID} from "../compositions/ProjectScopedPreviewComposition";
import {projectScopedStudioPropsSchema} from "../compositions/project-scoped-studio-defaults";

const FALLBACK_VIDEO_METADATA = {
  width: 1280,
  height: 720,
  fps: 30,
  durationSeconds: 10,
  durationInFrames: 300
};

const defaultProps = {
  videoSrc: null,
  studioSampleId: undefined,
  studioTypographySample: false,
  videoMetadata: FALLBACK_VIDEO_METADATA,
  livePreviewSession: null,
  presentationMode: "long-form",
  captionProfileId: "longform_eve_typography_v1",
  motionTier: "premium",
  gradeProfileId: "warm-cinematic",
  transitionPresetId: "auto",
  transitionOverlayMode: "standard",
  motion3DMode: "editorial",
  matteMode: "off",
  captionBias: "auto",
  hideCaptionOverlays: false,
  pipMode: "off",
  stabilizePreviewTimeline: true,
  previewTimelineResetVersion: 1,
  previewPerformanceMode: "full",
  respectPreviewPerformanceModeDuringRender: true,
  motionModelOverride: null,
  debugMotionArtifacts: false,
  usePreviewProxyForVideoSrc: false,
  captionChunksOverride: []
} satisfies ProjectScopedMotionCompositionProps;

export const ProjectScopedRawSmokeRoot: React.FC = () => (
  <Composition
    id={PROJECT_SCOPED_PREVIEW_COMPOSITION_ID}
    component={ProjectScopedMotionComposition}
    schema={projectScopedStudioPropsSchema}
    calculateMetadata={async ({props}) => {
      const videoMetadata = props.videoMetadata ?? FALLBACK_VIDEO_METADATA;
      return {
        width: videoMetadata.width,
        height: videoMetadata.height,
        fps: videoMetadata.fps,
        durationInFrames: videoMetadata.durationInFrames,
        props
      };
    }}
    width={FALLBACK_VIDEO_METADATA.width}
    height={FALLBACK_VIDEO_METADATA.height}
    fps={FALLBACK_VIDEO_METADATA.fps}
    durationInFrames={FALLBACK_VIDEO_METADATA.durationInFrames}
    defaultProps={defaultProps}
  />
);

registerRoot(ProjectScopedRawSmokeRoot);
