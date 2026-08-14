import React from "react";
import {Composition, staticFile} from "remotion";
import {UnifiedRenderManifestSchema, type UnifiedRenderManifest} from "@prometheus/shared-types";

import {
  buildProjectScopedStudioDefaultProps,
  projectScopedStudioPropsSchema
} from "./compositions/project-scoped-studio-defaults";
import {TargetFocusZoomShowcase} from "./compositions/TargetFocusZoomShowcase";
import {choreographyProofChunks} from "./data/choreography-proof.chunks";
import {
  getLongformDraftVideoMetadata,
  LONGFORM_DRAFT_COMPOSITION_ID,
  LONGFORM_DRAFT_VIDEO_ASSET
} from "./lib/draft-preview";
import {getPresentationPreset} from "./lib/presentation-presets";
import {normalizeCaptionStyleProfileId} from "./lib/stylebooks/caption-style-profiles";
import {JosephEdit} from "./compositions/JosephEdit";
import {
  DEFAULT_JOSEPH_MANIFEST,
  JOSEPH_RENDER_FPS,
  JOSEPH_RENDER_HEIGHT,
  JOSEPH_RENDER_WIDTH
} from "./compositions/joseph-default-manifest";
import {
  calculateMaulShortMetadata,
  MaulShort,
  MAUL_SHORT_DEFAULT_PROPS
} from "./compositions/MaulShort";
import {
  MaulCinematicSvgPrototype,
  MAUL_CINEMATIC_SVG_PROTOTYPE_DURATION,
} from "./compositions/MaulCinematicSvgPrototype";
import {KineticCausalChainProof} from "./compositions/KineticCausalChainProof";

const importMetaEnv = typeof import.meta !== "undefined" ? import.meta.env : undefined;
const envCaptionProfileId =
  importMetaEnv?.VITE_CAPTION_STYLE_PROFILE?.trim() || importMetaEnv?.CAPTION_STYLE_PROFILE?.trim();
const defaultCaptionProfileId = envCaptionProfileId?.trim()
  ? normalizeCaptionStyleProfileId(envCaptionProfileId)
  : undefined;
const DEV_FIXTURE_LONGFORM_VIDEO_ASSET = "dev-fixtures/test-video.mp4";
const DEV_FIXTURE_LONGFORM_COMPOSITION_ID = "MaleHeadVideoLongFormDevFixture";
const PROJECT_SCOPED_PREVIEW_COMPOSITION_ID = "project-scoped-preview";
const loadProjectScopedMotionComposition = () => import("./compositions/ProjectScopedMotionComposition")
  .then(({ProjectScopedMotionComposition}) => ({default: ProjectScopedMotionComposition}));
const loadFemaleCoachDeanGraziosi = () => import("./compositions/FemaleCoachDeanGraziosi")
  .then(({FemaleCoachDeanGraziosi}) => ({default: FemaleCoachDeanGraziosi}));
const loadCreativeAudioPreview = () => import("./compositions/CreativeAudioPreview")
  .then(({CreativeAudioPreview}) => ({default: CreativeAudioPreview}));
const loadCinematicPiPShowcase = () => import("./compositions/CinematicPiPShowcase")
  .then(({CinematicPiPShowcase}) => ({default: CinematicPiPShowcase}));
const KNOWN_STUDIO_COMPOSITION_IDS = new Set([
  "FemaleCoachDeanGraziosi",
  "MaleHeadVideoLongForm",
  DEV_FIXTURE_LONGFORM_COMPOSITION_ID,
  LONGFORM_DRAFT_COMPOSITION_ID,
  "Cinematic3DDemo",
  "CinematicChoreographyProof",
  "TargetFocusZoomShowcase",
  "CinematicPiPShowcase",
  "JosephEdit",
  "MaulShort",
  "MaulCinematicSvgPrototype",
  "KineticCausalChainProof"
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
const JOSEPH_STUDIO_LATEST_MANIFEST_URL = staticFile("joseph-studio/latest.json");

type JosephStudioCompositionProps = {
  manifest?: UnifiedRenderManifest;
  manifestUrl?: string | null;
};

const loadJosephStudioManifest = async ({
  manifest,
  manifestUrl
}: JosephStudioCompositionProps): Promise<UnifiedRenderManifest> => {
  if (manifestUrl?.trim()) {
    try {
      const response = await fetch(manifestUrl, {cache: "no-store"});
      if (response.ok) {
        return UnifiedRenderManifestSchema.parse(await response.json());
      }
    } catch {
      // A fresh checkout has no latest upload yet; the explicit fallback remains inspectable.
    }
  }

  return UnifiedRenderManifestSchema.parse(manifest ?? DEFAULT_JOSEPH_MANIFEST);
};

const JosephStudioComposition: React.FC<JosephStudioCompositionProps> = ({manifest}) => (
  <JosephEdit manifest={manifest ?? DEFAULT_JOSEPH_MANIFEST} />
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
        lazyComponent={loadProjectScopedMotionComposition}
        schema={projectScopedStudioPropsSchema}
        width={longFormPreset.videoMetadata.width}
        height={longFormPreset.videoMetadata.height}
        fps={longFormPreset.videoMetadata.fps}
        durationInFrames={longFormPreset.videoMetadata.durationInFrames}
        defaultProps={projectScopedStudioDefaultProps}
      />
      <Composition
        id="FemaleCoachDeanGraziosi"
        lazyComponent={loadFemaleCoachDeanGraziosi}
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
        lazyComponent={loadProjectScopedMotionComposition}
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
        lazyComponent={loadFemaleCoachDeanGraziosi}
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
        lazyComponent={loadCreativeAudioPreview}
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
        lazyComponent={loadProjectScopedMotionComposition}
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
        lazyComponent={loadProjectScopedMotionComposition}
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
        lazyComponent={loadCinematicPiPShowcase}
        width={cinematicPiPShowcaseVideoMetadata.width}
        height={cinematicPiPShowcaseVideoMetadata.height}
        fps={cinematicPiPShowcaseVideoMetadata.fps}
        durationInFrames={cinematicPiPShowcaseVideoMetadata.durationInFrames}
      />
      <Composition
        id="MaulShort"
        component={MaulShort}
        calculateMetadata={calculateMaulShortMetadata}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={30}
        defaultProps={MAUL_SHORT_DEFAULT_PROPS}
      />
      <Composition
        id="MaulCinematicSvgPrototype"
        component={MaulCinematicSvgPrototype}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={MAUL_CINEMATIC_SVG_PROTOTYPE_DURATION}
      />
      <Composition
        id="KineticCausalChainProof"
        component={KineticCausalChainProof}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={120}
      />
      <Composition
        id="JosephEdit"
        component={JosephStudioComposition}
        calculateMetadata={async ({ props }) => {
          const manifest = await loadJosephStudioManifest(props);
          if (
            manifest.width !== JOSEPH_RENDER_WIDTH ||
            manifest.height !== JOSEPH_RENDER_HEIGHT ||
            manifest.output.width !== JOSEPH_RENDER_WIDTH ||
            manifest.output.height !== JOSEPH_RENDER_HEIGHT
          ) {
            throw new Error(`JosephEdit composition requires ${JOSEPH_RENDER_WIDTH}x${JOSEPH_RENDER_HEIGHT} manifest/output dimensions.`);
          }

          return {
            durationInFrames: manifest.durationFrames || DEFAULT_JOSEPH_MANIFEST.durationFrames,
            fps: manifest.fps || JOSEPH_RENDER_FPS,
            width: JOSEPH_RENDER_WIDTH,
            height: JOSEPH_RENDER_HEIGHT,
            props: {...props, manifest},
          };
        }}
        width={JOSEPH_RENDER_WIDTH}
        height={JOSEPH_RENDER_HEIGHT}
        fps={JOSEPH_RENDER_FPS}
        durationInFrames={DEFAULT_JOSEPH_MANIFEST.durationFrames}
        defaultProps={{
          manifest: DEFAULT_JOSEPH_MANIFEST,
          manifestUrl: JOSEPH_STUDIO_LATEST_MANIFEST_URL
        }}
      />
    </>
  );
};
