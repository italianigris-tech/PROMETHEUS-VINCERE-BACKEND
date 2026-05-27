import React from "react";
import {Composition, staticFile} from "remotion";

import {FemaleCoachDeanGraziosi} from "./compositions/FemaleCoachDeanGraziosi";
import {ProjectScopedMotionComposition} from "./compositions/ProjectScopedMotionComposition";
import {PROJECT_SCOPED_PREVIEW_COMPOSITION_ID} from "./compositions/ProjectScopedPreviewComposition";
import {
  buildProjectScopedStudioDefaultProps,
  projectScopedStudioPropsSchema
} from "./compositions/project-scoped-studio-defaults";
import {CreativeAudioPreview} from "./compositions/CreativeAudioPreview";
import {CinematicPiPShowcase} from "./compositions/CinematicPiPShowcase";
import {TargetFocusZoomShowcase} from "./compositions/TargetFocusZoomShowcase";
import {choreographyProofChunks} from "./data/choreography-proof.chunks";
import {
  getLongformDraftVideoMetadata,
  LONGFORM_DRAFT_COMPOSITION_ID,
  LONGFORM_DRAFT_VIDEO_ASSET
} from "./lib/draft-preview";
import {getPresentationPreset} from "./lib/presentation-presets";
import {normalizeCaptionStyleProfileId} from "./lib/stylebooks/caption-style-profiles";

const importMetaEnv = typeof import.meta !== "undefined" ? import.meta.env : undefined;
const envCaptionProfileId =
  importMetaEnv?.VITE_CAPTION_STYLE_PROFILE?.trim() || importMetaEnv?.CAPTION_STYLE_PROFILE?.trim();
const defaultCaptionProfileId = envCaptionProfileId?.trim()
  ? normalizeCaptionStyleProfileId(envCaptionProfileId)
  : undefined;
const DEV_FIXTURE_LONGFORM_VIDEO_ASSET = "dev-fixtures/test-video.mp4";
const DEV_FIXTURE_LONGFORM_COMPOSITION_ID = "MaleHeadVideoLongFormDevFixture";
const KNOWN_STUDIO_COMPOSITION_IDS = new Set([
  "FemaleCoachDeanGraziosi",
  "MaleHeadVideoLongForm",
  DEV_FIXTURE_LONGFORM_COMPOSITION_ID,
  LONGFORM_DRAFT_COMPOSITION_ID,
  "Cinematic3DDemo",
  "CinematicChoreographyProof",
  "TargetFocusZoomShowcase",
  "CinematicPiPShowcase"
]);
const reelPreset = getPresentationPreset("reel");
const longFormPreset = getPresentationPreset("long-form");
const longFormDraftVideoMetadata = getLongformDraftVideoMetadata(longFormPreset.videoMetadata);
const choreographyProofVideoMetadata = {
  width: reelPreset.videoMetadata.width,
  height: reelPreset.videoMetadata.height,
  fps: reelPreset.videoMetadata.fps,
  durationSeconds: 8,
  durationInFrames: reelPreset.videoMetadata.fps * 8
};
const targetFocusShowcaseVideoMetadata = {
  width: reelPreset.videoMetadata.width,
  height: reelPreset.videoMetadata.height,
  fps: reelPreset.videoMetadata.fps,
  durationSeconds: 8,
  durationInFrames: reelPreset.videoMetadata.fps * 8
};
const cinematicPiPShowcaseVideoMetadata = {
  width: longFormPreset.videoMetadata.width,
  height: longFormPreset.videoMetadata.height,
  fps: longFormPreset.videoMetadata.fps,
  durationSeconds: 12,
  durationInFrames: longFormPreset.videoMetadata.fps * 12
};
const projectScopedStudioDefaultProps = buildProjectScopedStudioDefaultProps(
  defaultCaptionProfileId ?? longFormPreset.captionProfileId
);

export const RemotionRoot: React.FC = () => {
  if (typeof window !== "undefined" && window.remotion_isReadOnlyStudio) {
    const pathname = window.location.pathname.replace(/^\/+/, "");
    if (pathname && !window.location.search && KNOWN_STUDIO_COMPOSITION_IDS.has(pathname)) {
      // Read-only Studio expects routes in ?/CompositionId form, not /CompositionId.
      window.history.replaceState({}, "Studio", `/?/${pathname}`);
    }
  }

  return (
    <>
      <Composition
        id={PROJECT_SCOPED_PREVIEW_COMPOSITION_ID}
        component={ProjectScopedMotionComposition}
        schema={projectScopedStudioPropsSchema}
        width={longFormPreset.videoMetadata.width}
        height={longFormPreset.videoMetadata.height}
        fps={longFormPreset.videoMetadata.fps}
        durationInFrames={longFormPreset.videoMetadata.durationInFrames}
        defaultProps={projectScopedStudioDefaultProps}
      />
      <Composition
        id="FemaleCoachDeanGraziosi"
        component={FemaleCoachDeanGraziosi}
        width={reelPreset.videoMetadata.width}
        height={reelPreset.videoMetadata.height}
        fps={reelPreset.videoMetadata.fps}
        durationInFrames={reelPreset.videoMetadata.durationInFrames}
        defaultProps={{
          videoSrc: staticFile(reelPreset.videoAsset),
          videoMetadata: reelPreset.videoMetadata,
          presentationMode: reelPreset.presentationMode,
          captionMediaSourceKey: reelPreset.videoAsset,
          motionTier: "auto",
          gradeProfileId: "auto",
          transitionPresetId: "auto",
          matteMode: "auto",
          captionBias: "auto",
          captionProfileId: defaultCaptionProfileId ?? reelPreset.captionProfileId,
          debugMotionArtifacts: true
        }}
      />
      <Composition
        id="MaleHeadVideoLongForm"
        component={ProjectScopedMotionComposition}
        width={longFormPreset.videoMetadata.width}
        height={longFormPreset.videoMetadata.height}
        fps={longFormPreset.videoMetadata.fps}
        durationInFrames={longFormPreset.videoMetadata.durationInFrames}
        defaultProps={{
          videoSrc: staticFile(longFormPreset.videoAsset),
          videoMetadata: longFormPreset.videoMetadata,
          presentationMode: longFormPreset.presentationMode,
          captionMediaSourceKey: longFormPreset.videoAsset,
          motionTier: "auto",
          gradeProfileId: "auto",
          transitionPresetId: "auto",
          matteMode: "auto",
          captionBias: "auto",
          captionProfileId: defaultCaptionProfileId ?? longFormPreset.captionProfileId,
          motion3DMode: "editorial",
          stabilizePreviewTimeline: true,
          previewPerformanceMode: "balanced",
          debugMotionArtifacts: true
        }}
      />
      <Composition
        id={DEV_FIXTURE_LONGFORM_COMPOSITION_ID}
        component={FemaleCoachDeanGraziosi}
        width={longFormPreset.videoMetadata.width}
        height={longFormPreset.videoMetadata.height}
        fps={longFormPreset.videoMetadata.fps}
        durationInFrames={longFormPreset.videoMetadata.durationInFrames}
        defaultProps={{
          // Dev-only Studio fixture: drop a browser-safe test asset into public/dev-fixtures/test-video.mp4.
          videoSrc: staticFile(DEV_FIXTURE_LONGFORM_VIDEO_ASSET),
          videoMetadata: longFormPreset.videoMetadata,
          presentationMode: longFormPreset.presentationMode,
          captionMediaSourceKey: DEV_FIXTURE_LONGFORM_VIDEO_ASSET,
          motionTier: "auto",
          gradeProfileId: "auto",
          transitionPresetId: "auto",
          matteMode: "auto",
          captionBias: "auto",
          captionProfileId: longFormPreset.captionProfileId,
          motion3DMode: "editorial",
          focusedStudioMode: true,
          stabilizePreviewTimeline: true,
          previewPerformanceMode: "balanced",
          disablePreviewProxyForVideoSrc: true,
          devFixtureExpectedPublicAssetName: DEV_FIXTURE_LONGFORM_VIDEO_ASSET
        }}
      />
      <Composition
        id={LONGFORM_DRAFT_COMPOSITION_ID}
        component={CreativeAudioPreview}
        width={longFormDraftVideoMetadata.width}
        height={longFormDraftVideoMetadata.height}
        fps={longFormDraftVideoMetadata.fps}
        durationInFrames={longFormDraftVideoMetadata.durationInFrames}
        defaultProps={{
          sourceAudioSrc: staticFile(LONGFORM_DRAFT_VIDEO_ASSET),
          videoMetadata: longFormDraftVideoMetadata,
          presentationMode: longFormPreset.presentationMode,
          captionMediaSourceKey: LONGFORM_DRAFT_VIDEO_ASSET,
          motionTier: "auto",
          gradeProfileId: "auto",
          transitionPresetId: "auto",
          transitionOverlayMode: "standard",
          motion3DMode: "editorial",
          matteMode: "auto",
          captionProfileId: defaultCaptionProfileId ?? longFormPreset.captionProfileId,
          captionBias: "auto",
          hideCaptionOverlays: false,
          previewPerformanceMode: "balanced"
        }}
      />
      <Composition
        id="Cinematic3DDemo"
        component={ProjectScopedMotionComposition}
        width={reelPreset.videoMetadata.width}
        height={reelPreset.videoMetadata.height}
        fps={reelPreset.videoMetadata.fps}
        durationInFrames={reelPreset.videoMetadata.durationInFrames}
        defaultProps={{
          videoSrc: staticFile(reelPreset.videoAsset),
          videoMetadata: reelPreset.videoMetadata,
          presentationMode: reelPreset.presentationMode,
          captionMediaSourceKey: reelPreset.videoAsset,
          motionTier: "premium",
          gradeProfileId: "auto",
          transitionPresetId: "auto",
          transitionOverlayMode: "off",
          motion3DMode: "showcase",
          matteMode: "auto",
          captionBias: "auto",
          captionProfileId: defaultCaptionProfileId ?? reelPreset.captionProfileId,
          debugMotionArtifacts: true
        }}
      />
      <Composition
        id="CinematicChoreographyProof"
        component={ProjectScopedMotionComposition}
        width={choreographyProofVideoMetadata.width}
        height={choreographyProofVideoMetadata.height}
        fps={choreographyProofVideoMetadata.fps}
        durationInFrames={choreographyProofVideoMetadata.durationInFrames}
        defaultProps={{
          videoSrc: staticFile(reelPreset.videoAsset),
          videoMetadata: choreographyProofVideoMetadata,
          presentationMode: reelPreset.presentationMode,
          captionChunksOverride: choreographyProofChunks,
          captionMediaSourceKey: reelPreset.videoAsset,
          motionTier: "premium",
          gradeProfileId: "premium-contrast",
          transitionPresetId: "auto",
          transitionOverlayMode: "off",
          motion3DMode: "showcase",
          matteMode: "off",
          captionBias: "middle",
          hideCaptionOverlays: true,
          captionProfileId: defaultCaptionProfileId ?? reelPreset.captionProfileId,
          debugMotionArtifacts: true
        }}
      />
      <Composition
        id="TargetFocusZoomShowcase"
        component={TargetFocusZoomShowcase}
        width={targetFocusShowcaseVideoMetadata.width}
        height={targetFocusShowcaseVideoMetadata.height}
        fps={targetFocusShowcaseVideoMetadata.fps}
        durationInFrames={targetFocusShowcaseVideoMetadata.durationInFrames}
      />
      <Composition
        id="CinematicPiPShowcase"
        component={CinematicPiPShowcase}
        width={cinematicPiPShowcaseVideoMetadata.width}
        height={cinematicPiPShowcaseVideoMetadata.height}
        fps={cinematicPiPShowcaseVideoMetadata.fps}
        durationInFrames={cinematicPiPShowcaseVideoMetadata.durationInFrames}
      />
    </>
  );
};
