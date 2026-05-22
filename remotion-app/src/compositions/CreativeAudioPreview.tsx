import React, {useMemo} from "react";
import {AbsoluteFill, Audio, useCurrentFrame, useVideoConfig} from "remotion";
import {loadFont as loadAllura} from "@remotion/google-fonts/Allura";
import {loadFont as loadAnton} from "@remotion/google-fonts/Anton";
import {loadFont as loadBebasNeue} from "@remotion/google-fonts/BebasNeue";
import {loadFont as loadBodoniModa} from "@remotion/google-fonts/BodoniModa";
import {loadFont as loadCinzel} from "@remotion/google-fonts/Cinzel";
import {loadFont as loadCormorantGaramond} from "@remotion/google-fonts/CormorantGaramond";
import {loadFont as loadGreatVibes} from "@remotion/google-fonts/GreatVibes";
import {loadFont as loadLeagueGothic} from "@remotion/google-fonts/LeagueGothic";
import {loadFont as loadOswald} from "@remotion/google-fonts/Oswald";
import {loadFont as loadPlayfairDisplay} from "@remotion/google-fonts/PlayfairDisplay";
import {loadFont as loadTeko} from "@remotion/google-fonts/Teko";
import {loadFont as loadDMSans} from "@remotion/google-fonts/DMSans";
import {loadFont as loadDMSerifDisplay} from "@remotion/google-fonts/DMSerifDisplay";

import {
  buildMotionCompositionModel,
  CaptionFocusVignette,
  LongformTypographyBiasOverlay,
  Motion3DOverlay,
  MotionAssetOverlay,
  MotionChoreographyOverlay,
} from "../components/MotionGraphicsEngine";
import {MotionBackgroundOverlay} from "../components/MotionBackgroundOverlay";
import {MotionTransitionOverlay} from "../components/MotionTransitionOverlay";
import {MotionSoundDesign} from "../components/MotionSoundDesign";
import {LongformDockedInverseOverlay} from "../components/LongformDockedInverseOverlay";
import {LongformSemanticSidecallOverlay} from "../components/LongformSemanticSidecallOverlay";
import {LongformWordByWordOverlay} from "../components/LongformWordByWordOverlay";
import {CinematicCaptionOverlay} from "../components/CinematicCaptionOverlay";
import {SvgCaptionOverlay, isSvgCaptionChunk} from "../components/SvgCaptionOverlay";
import {MotionShowcaseOverlay} from "../components/MotionShowcaseOverlay";
import {loadEditorialCaptionFonts} from "../lib/cinematic-typography/editorial-fonts";
import type {ManualSelectedRuntimeFont} from "../lib/font-intelligence/font-runtime-registry";
import {ENABLE_LONGFORM_SEMANTIC_SIDECALL_OVERLAYS} from "../lib/longform-semantic-sidecall";
import {buildPreviewCaptionChunks} from "../lib/preview-caption-data";
import {
  getDefaultCaptionProfileIdForPresentationMode,
  getDefaultVideoMetadataForPresentationMode
} from "../lib/presentation-presets";
import {resolvePresentationMode} from "../lib/presentation-mode";
import {
  getLongformCaptionRenderMode,
  normalizeCaptionStyleProfileId
} from "../lib/stylebooks/caption-style-profiles";
import type {
  CaptionChunk,
  CaptionStyleProfileId,
  CaptionVerticalBias,
  Motion3DMode,
  MotionGradeProfileId,
  MotionMatteMode,
  MotionTier,
  PreviewPerformanceMode,
  PresentationModeSetting,
  TransitionOverlayMode,
  VideoMetadata
} from "../lib/types";
import type {MotionCompositionModel} from "../lib/motion-platform/scene-engine";
import type {TransitionOverlayRules} from "../lib/motion-platform/transition-overlay-config";
import type {CreativeOrchestrationDebugReport} from "../creative-orchestration/types";
import type {
  AudioCreativePreviewAudioStatus,
  AudioCreativePreviewState
} from "../web-preview/audio-creative-preview-session";
import "../styles/cinematic.css";

const fontLoadOptions = {
  subsets: ["latin"] as ("latin")[],
  ignoreTooManyRequestsWarning: true
};

loadAllura("normal", fontLoadOptions);
loadAnton("normal", fontLoadOptions);
loadBebasNeue("normal", fontLoadOptions);
loadBodoniModa("normal", fontLoadOptions);
loadCinzel("normal", fontLoadOptions);
loadCormorantGaramond("normal", fontLoadOptions);
loadGreatVibes("normal", fontLoadOptions);
loadLeagueGothic("normal", fontLoadOptions);
loadOswald("normal", fontLoadOptions);
loadPlayfairDisplay("normal", fontLoadOptions);
loadTeko("normal", fontLoadOptions);
loadDMSans("normal", fontLoadOptions);
loadDMSerifDisplay("normal", fontLoadOptions);
loadEditorialCaptionFonts();

export type CreativeAudioPreviewProps = {
  readonly sourceAudioSrc?: string;
  readonly videoMetadata?: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames">;
  readonly presentationMode?: PresentationModeSetting;
  readonly captionChunksOverride?: CaptionChunk[];
  readonly captionMediaSourceKey?: string | null;
  readonly motionTier?: MotionTier | "auto";
  readonly gradeProfileId?: MotionGradeProfileId | "auto";
  readonly transitionPresetId?: string;
  readonly transitionOverlayMode?: TransitionOverlayMode;
  readonly transitionOverlayConfig?: Partial<TransitionOverlayRules>;
  readonly motion3DMode?: Motion3DMode;
  readonly matteMode?: MotionMatteMode | "auto";
  readonly captionProfileId?: CaptionStyleProfileId | "auto";
  readonly captionBias?: CaptionVerticalBias | "auto";
  readonly hideCaptionOverlays?: boolean;
  readonly previewPerformanceMode?: PreviewPerformanceMode;
  readonly previewTimelineResetVersion?: number;
  readonly motionModelOverride?: MotionCompositionModel | null;
  readonly creativeOrchestrationDebugReport?: CreativeOrchestrationDebugReport | null;
  readonly previewState?: AudioCreativePreviewState;
  readonly audioStatus?: AudioCreativePreviewAudioStatus;
  readonly audioErrorMessage?: string | null;
  readonly showDebugOverlay?: boolean;
  readonly renderJobActive?: boolean;
  readonly videoLoaded?: boolean;
  readonly debugSelectedFontId?: string | null;
  readonly debugSelectedFont?: ManualSelectedRuntimeFont | null;
  readonly selectedFontId?: string | null;
  readonly selectedFont?: ManualSelectedRuntimeFont | null;
};

const treatmentTone = (finalTreatment: string): string => {
  switch (finalTreatment) {
    case "title-card":
      return "#D6E4FF";
    case "asset-led":
      return "#CDEFD8";
    case "background-overlay":
      return "#C7D2FE";
    case "cinematic-transition":
      return "#BFF3FF";
    case "keyword-emphasis":
      return "#FDE68A";
    case "behind-speaker-depth":
      return "#FCA5A5";
    default:
      return "#E5E7EB";
  }
};

const getActiveMoment = (
  report: CreativeOrchestrationDebugReport | null | undefined,
  currentTimeMs: number
): CreativeOrchestrationDebugReport["finalCreativeTimeline"]["moments"][number] | null => {
  const moments = report?.finalCreativeTimeline.moments ?? [];
  if (moments.length === 0) {
    return null;
  }

  return moments.find((moment) => currentTimeMs >= moment.startMs && currentTimeMs <= moment.endMs) ?? moments[0] ?? null;
};

const getActiveDecision = (
  report: CreativeOrchestrationDebugReport | null | undefined,
  momentId: string | null | undefined
) => {
  if (!report?.finalCreativeTimeline || !momentId) {
    return null;
  }

  return report.finalCreativeTimeline.decisions.find((decision) => decision.momentId === momentId) ?? null;
};

const TimelineHud: React.FC<{
  report: CreativeOrchestrationDebugReport | null | undefined;
  currentTimeMs: number;
  previewState?: AudioCreativePreviewState;
  audioStatus?: AudioCreativePreviewAudioStatus;
  audioErrorMessage?: string | null;
  showDebugOverlay?: boolean;
  renderJobActive?: boolean;
  videoLoaded?: boolean;
}> = ({
  report,
  currentTimeMs,
  previewState = "idle",
  audioStatus = "missing",
  audioErrorMessage = null,
  showDebugOverlay = false,
  renderJobActive = false,
  videoLoaded = false
}) => {
  const timeline = report?.finalCreativeTimeline ?? null;
  const activeMoment = getActiveMoment(report, currentTimeMs);
  const activeDecision = getActiveDecision(report, activeMoment?.id);
  const activeTrackTypes = timeline
    ? [...new Set(timeline.tracks.filter((track) => currentTimeMs >= track.startMs && currentTimeMs <= track.endMs).map((track) => track.type))]
    : [];
  const activeMattingTrack = timeline?.tracks.find(
    (track) =>
      track.type === "matting" &&
      currentTimeMs >= track.startMs &&
      currentTimeMs <= track.endMs
  );
  const progress = timeline?.durationMs ? Math.max(0, Math.min(1, currentTimeMs / timeline.durationMs)) : 0;
  const renderCost = timeline?.diagnostics.renderCost ?? "low";
  const criticScore = report?.criticReview.score ?? 0;
  const criticStatus = report?.criticReview.status ?? "approved";

  return (
    <AbsoluteFill style={{pointerEvents: "none"}}>
      <div style={{
        position: "absolute",
        top: 24,
        left: 24,
        right: 24,
        display: "flex",
        justifyContent: "space-between",
        gap: 16
      }}>
        <div style={{
          maxWidth: "70%",
          padding: "16px 18px",
          borderRadius: 18,
          background: "rgba(15, 23, 42, 0.74)",
          border: "1px solid rgba(148, 163, 184, 0.18)",
          color: "#F8FAFC",
          backdropFilter: "blur(18px)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.28)"
        }}>
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
            fontSize: 12,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#94A3B8"
            }}>
            <span>Audio-first creative preview</span>
            <span>|</span>
            <span>{timeline ? `${timeline.moments.length} moments` : "timeline pending"}</span>
            <span>|</span>
            <span>{criticStatus}{criticScore ? ` (${criticScore})` : ""}</span>
            <span>|</span>
            <span>{previewState}</span>
            <span>|</span>
            <span>{audioStatus}</span>
          </div>
          <div style={{display: "grid", gap: 8}}>
            <strong style={{fontSize: "clamp(24px, 4vw, 44px)", lineHeight: 1.02}}>
              {activeDecision?.finalTreatment ?? "waiting for orchestration"}
            </strong>
            <span style={{fontSize: 15, lineHeight: 1.45, color: "#E2E8F0"}}>
              {activeMoment
                ? `${activeMoment.momentType} moment | ${Math.round(activeMoment.startMs / 1000)}s-${Math.round(activeMoment.endMs / 1000)}s | ${activeMoment.transcriptText}`
                : "The timeline will surface here as the audio plays and the creative plan advances."}
            </span>
            <span style={{fontSize: 13, lineHeight: 1.4, color: "#CBD5E1"}}>
              {activeDecision?.reasoning ?? "No decision available yet."}
            </span>
            {audioErrorMessage ? (
              <span style={{fontSize: 13, lineHeight: 1.4, color: "#FDA4AF"}}>
                Audio note: {audioErrorMessage}
              </span>
            ) : null}
          </div>
        </div>

        {showDebugOverlay ? (
          <div style={{
            minWidth: 240,
            padding: "14px 16px",
            borderRadius: 16,
            background: "rgba(2, 6, 23, 0.68)",
            border: "1px solid rgba(96, 165, 250, 0.22)",
            color: "#E0F2FE",
            backdropFilter: "blur(16px)",
            boxShadow: "0 18px 48px rgba(2, 6, 23, 0.35)"
          }}>
            <div style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#7DD3FC",
              marginBottom: 8
            }}>
              Render Diagnostics
            </div>
            <div style={{display: "grid", gap: 8, fontSize: 14, lineHeight: 1.45}}>
              <span>Render cost: {renderCost}</span>
              <span>Approved: {timeline?.diagnostics.approvedCount ?? 0}</span>
              <span>Rejected: {timeline?.diagnostics.rejectedCount ?? 0}</span>
              <span>Active tracks: {activeTrackTypes.length ? activeTrackTypes.join(", ") : "none"}</span>
              <span>Video loaded: {videoLoaded ? "true" : "false"}</span>
              <span>Render job active: {renderJobActive ? "true" : "false"}</span>
              {activeMattingTrack ? (
                <span style={{color: "#FDE68A"}}>
                  Matting required in final render
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div style={{
        position: "absolute",
        left: 24,
        right: 24,
        bottom: 26,
        display: "grid",
        gap: 12
      }}>
        <div style={{
          height: 8,
          borderRadius: 999,
          overflow: "hidden",
          background: "rgba(148, 163, 184, 0.2)",
          display: "flex",
          boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.08) inset"
        }}>
          {timeline?.moments.length
            ? timeline.moments.map((moment) => (
                <div
                  key={moment.id}
                  style={{
                    flexGrow: Math.max(1, moment.endMs - moment.startMs),
                    background: activeMoment?.id === moment.id
                      ? treatmentTone(activeDecision?.finalTreatment ?? "")
                      : "#334155",
                    transition: "background 180ms ease"
                  }}
                />
              ))
            : <div style={{flex: 1, background: "linear-gradient(90deg, rgba(59,130,246,0.4), rgba(168,85,247,0.35))"}} />}
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          color: "#E2E8F0",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.18em"
        }}>
          <span>{timeline?.id ?? "orchestration pending"}</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const CreativeAudioPreview: React.FC<CreativeAudioPreviewProps> = ({
  sourceAudioSrc,
  videoMetadata,
  presentationMode = "auto",
  captionChunksOverride,
  captionMediaSourceKey = null,
  motionTier = "auto",
  gradeProfileId,
  transitionPresetId = "auto",
  transitionOverlayMode = "standard",
  transitionOverlayConfig,
  motion3DMode = "off",
  matteMode = "auto",
  captionProfileId,
  captionBias = "auto",
  hideCaptionOverlays = false,
  previewPerformanceMode = "full",
  previewTimelineResetVersion = 0,
  motionModelOverride = null,
  creativeOrchestrationDebugReport = null,
  previewState = "idle",
  audioStatus = "missing",
  audioErrorMessage = null,
  showDebugOverlay = false,
  renderJobActive = false,
  videoLoaded = false,
  debugSelectedFontId,
  debugSelectedFont,
  selectedFontId,
  selectedFont
}) => {
  const resolvedVideoMetadata = videoMetadata ?? getDefaultVideoMetadataForPresentationMode("long-form");
  const resolvedPresentationMode = resolvePresentationMode(resolvedVideoMetadata, presentationMode);
  const effectiveCaptionProfileId = normalizeCaptionStyleProfileId(
    captionProfileId && captionProfileId !== "auto"
      ? captionProfileId
      : getDefaultCaptionProfileIdForPresentationMode(resolvedPresentationMode)
  );
  const captionChunks = useMemo(
    () => captionChunksOverride ?? buildPreviewCaptionChunks(
      effectiveCaptionProfileId,
      resolvedPresentationMode,
      {
        mediaSource: captionMediaSourceKey ?? sourceAudioSrc ?? null,
        durationSeconds: resolvedVideoMetadata.durationSeconds,
        durationInFrames: resolvedVideoMetadata.durationInFrames
      }
    ),
    [
      captionChunksOverride,
      captionMediaSourceKey,
      effectiveCaptionProfileId,
      resolvedPresentationMode,
      resolvedVideoMetadata.durationInFrames,
      resolvedVideoMetadata.durationSeconds,
      sourceAudioSrc
    ]
  );
  const longformCaptionRenderMode = useMemo(
    () => getLongformCaptionRenderMode(effectiveCaptionProfileId),
    [effectiveCaptionProfileId]
  );
  const svgCaptionChunks = useMemo(
    () => captionChunks.filter((chunk) => isSvgCaptionChunk(chunk)),
    [captionChunks]
  );
  const cinematicCaptionChunks = useMemo(
    () => captionChunks.filter((chunk) => !isSvgCaptionChunk(chunk)),
    [captionChunks]
  );
  const motionModel = useMemo(
    () => motionModelOverride ?? buildMotionCompositionModel({
      chunks: captionChunks,
      tier: motionTier,
      fps: resolvedVideoMetadata.fps,
      videoMetadata: resolvedVideoMetadata,
      captionProfileId: effectiveCaptionProfileId,
      gradeProfileId,
      transitionPresetId,
      transitionOverlayMode,
      transitionOverlayConfig,
      motion3DMode,
      matteMode,
      captionBias,
      suppressAmbientAssets: false
    }),
    [
      captionBias,
      captionChunks,
      effectiveCaptionProfileId,
      gradeProfileId,
      matteMode,
      motion3DMode,
      motionModelOverride,
      motionTier,
      resolvedVideoMetadata,
      transitionOverlayConfig,
      transitionOverlayMode,
      transitionPresetId
    ]
  );
  const captionEditorialContext = useMemo(() => ({
    gradeProfile: motionModel.gradeProfile,
    backgroundOverlayPlan: motionModel.backgroundOverlayPlan,
    captionBias: motionModel.captionBias,
    motionTier: motionModel.tier,
    compositionCombatPlan: motionModel.compositionCombatPlan,
    debugSelectedFontId,
    debugSelectedFont,
    selectedFontId,
    selectedFont
  }), [
    debugSelectedFont,
    debugSelectedFontId,
    motionModel.backgroundOverlayPlan,
    motionModel.captionBias,
    motionModel.compositionCombatPlan,
    motionModel.gradeProfile,
    motionModel.tier,
    selectedFont,
    selectedFontId
  ]);
  const showBackgroundOverlay = previewPerformanceMode !== "turbo";
  const showMotionAssetOverlay = previewPerformanceMode !== "turbo";
  const showShowcaseOverlay = previewPerformanceMode !== "turbo";
  const showSoundDesign = true;
  const currentFrame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const currentTimeMs = (currentFrame / fps) * 1000;
  const resolvedSourceAudioSrc = sourceAudioSrc ?? null;
  const backgroundStyle = creativeOrchestrationDebugReport?.finalCreativeTimeline.tracks.find((track) =>
    track.type === "background" &&
    currentTimeMs >= track.startMs &&
    currentTimeMs <= track.endMs
  )?.payload?.backgroundStyle as string | undefined;

  return (
    <AbsoluteFill
      style={{
        background: backgroundStyle === "radial-spotlight"
          ? "radial-gradient(circle at 50% 40%, rgba(59,130,246,0.20), rgba(15,23,42,0.96) 65%)"
          : backgroundStyle === "dark-vignette"
            ? "radial-gradient(circle at 50% 18%, rgba(255,214,143,0.14), transparent 26%), radial-gradient(circle at 50% 42%, rgba(96,165,250,0.18), rgba(4,10,22,0.88) 70%)"
            : backgroundStyle === "blue-depth-glow"
              ? "radial-gradient(circle at 50% 36%, rgba(96,165,250,0.20), rgba(15,23,42,0.96) 68%)"
              : "radial-gradient(circle at 18% 12%, rgba(214,177,107,0.12), transparent 28%), linear-gradient(135deg, rgba(2,6,23,0.92) 0%, rgba(15,23,42,0.92) 55%, rgba(17,24,39,0.94) 100%)"
      }}
    >
      {resolvedSourceAudioSrc ? (
        <Audio src={resolvedSourceAudioSrc} volume={motionModel.soundDesignPlan.mixTargets.sourceVideoVolume} />
      ) : null}
      {showSoundDesign ? (
        <MotionSoundDesign
          model={motionModel}
          stabilizePreviewTimeline={false}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {showBackgroundOverlay ? (
        <MotionBackgroundOverlay
          model={motionModel}
          stabilizePreviewTimeline={false}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {showMotionAssetOverlay ? (
        <Motion3DOverlay
          model={motionModel}
          stabilizePreviewTimeline={false}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {showMotionAssetOverlay ? (
        <MotionChoreographyOverlay
          model={motionModel}
          stabilizePreviewTimeline={false}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {showMotionAssetOverlay ? (
        <MotionAssetOverlay
          model={motionModel}
          stabilizePreviewTimeline={false}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {resolvedPresentationMode !== "long-form" ? (
        <CaptionFocusVignette
          model={motionModel}
          stabilizePreviewTimeline={false}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      {resolvedPresentationMode === "long-form" && longformCaptionRenderMode !== "word-by-word" ? null : (
        <LongformTypographyBiasOverlay
          presentationMode={resolvedPresentationMode}
          captionBias={motionModel.captionBias}
          stabilizePreviewTimeline={false}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      )}
      {showShowcaseOverlay ? (
        <MotionShowcaseOverlay
          model={motionModel}
          stabilizePreviewTimeline={false}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : null}
      <MotionTransitionOverlay
        model={motionModel}
        stabilizePreviewTimeline={false}
        previewTimelineResetVersion={previewTimelineResetVersion}
      />
      {hideCaptionOverlays ? null : resolvedPresentationMode === "long-form" && longformCaptionRenderMode === "svg" ? (
        <SvgCaptionOverlay
          chunks={svgCaptionChunks}
          captionBias={motionModel.captionBias}
          editorialContext={captionEditorialContext}
        />
      ) : resolvedPresentationMode === "long-form" && longformCaptionRenderMode === "word-by-word" ? (
        <LongformWordByWordOverlay
          captionProfileId={effectiveCaptionProfileId}
          chunks={captionChunks}
          captionBias={motionModel.captionBias}
          editorialContext={captionEditorialContext}
          stabilizePreviewTimeline={false}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : resolvedPresentationMode === "long-form" && longformCaptionRenderMode === "docked-inverse" ? (
        <LongformDockedInverseOverlay
          chunks={captionChunks}
          editorialContext={captionEditorialContext}
          stabilizePreviewTimeline={false}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : resolvedPresentationMode === "long-form" && longformCaptionRenderMode === "semantic-sidecall" && ENABLE_LONGFORM_SEMANTIC_SIDECALL_OVERLAYS ? (
        <LongformSemanticSidecallOverlay
          chunks={captionChunks}
          editorialContext={captionEditorialContext}
          stabilizePreviewTimeline={false}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : resolvedPresentationMode === "long-form" && longformCaptionRenderMode === "semantic-sidecall" ? (
        <LongformWordByWordOverlay
          captionProfileId={effectiveCaptionProfileId}
          chunks={captionChunks}
          captionBias={motionModel.captionBias}
          editorialContext={captionEditorialContext}
          stabilizePreviewTimeline={false}
          previewTimelineResetVersion={previewTimelineResetVersion}
        />
      ) : resolvedPresentationMode === "long-form" ? null : cinematicCaptionChunks.length > 0 ? (
        <CinematicCaptionOverlay
          chunks={cinematicCaptionChunks}
          captionBias={motionModel.captionBias}
          editorialContext={captionEditorialContext}
        />
      ) : null}
      {hideCaptionOverlays ? null : resolvedPresentationMode !== "long-form" && svgCaptionChunks.length > 0 ? (
        <SvgCaptionOverlay
          chunks={svgCaptionChunks}
          captionBias={motionModel.captionBias}
          editorialContext={captionEditorialContext}
        />
      ) : null}
      <TimelineHud
        report={creativeOrchestrationDebugReport}
        currentTimeMs={currentTimeMs}
        previewState={previewState}
        audioStatus={audioStatus}
        audioErrorMessage={audioErrorMessage}
        showDebugOverlay={showDebugOverlay}
        renderJobActive={renderJobActive}
        videoLoaded={videoLoaded}
      />
    </AbsoluteFill>
  );
};
