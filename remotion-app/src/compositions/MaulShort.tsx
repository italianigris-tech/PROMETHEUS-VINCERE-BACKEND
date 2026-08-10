import React, { useMemo } from "react";
import {
  createTikTokStyleCaptions,
  type Caption,
  type TikTokPage,
} from "@remotion/captions";
import { Audio, Video } from "@remotion/media";
import type {
  MaulEditorialTimelinePayload,
  MaulFramingCameraPlanPayload,
  MaulNormalizedBox,
  MaulTreatmentGenomePayload,
  MaulUnifiedShortRenderManifest,
  MaulUnifiedShortRenderManifestV1,
  type MaulRenderLayerPolicy,
} from "@prometheus/shared-types";
import {
  joinShortsTextTokens,
  shouldRenderMaulLayer as sharedShouldRenderMaulLayer,
} from "@prometheus/shared-types";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import {MaulPlannedTextLayer} from "./MaulPlannedTextLayer";
import {MaulVisualTrack} from "./MaulVisualTrack";
import {
  adaptMaulShortManifest,
  buildMaulPlannedRenderModel,
} from "./maul-short-manifest-adapter";

export const MaulPaddedSourceRegions: React.FC<{
  regions: MaulNormalizedBox[];
  background: string;
}> = ({regions, background}) => (
  <>
    {regions.map((region, index) => (
      <div
        key={`${region.x}-${region.y}-${region.width}-${region.height}`}
        data-maul-padded-source-region={index}
        style={{
          position: "absolute",
          left: `${region.x * 100}%`,
          top: `${region.y * 100}%`,
          width: `${region.width * 100}%`,
          height: `${region.height * 100}%`,
          background,
          pointerEvents: "none",
        }}
      />
    ))}
  </>
);

export const buildMaulPlannedSourceVideoStyle = ({
  crop,
  scale,
}: {
  crop: MaulNormalizedBox;
  scale: {x: number; y: number};
}) => ({
  left: `${-(crop.x / crop.width) * 100}%`,
  top: `${-(crop.y / crop.height) * 100}%`,
  width: `${100 / crop.width}%`,
  height: `${100 / crop.height}%`,
  objectFit: "fill" as const,
  objectPosition: "center" as const,
  transform: `scale(${scale.x}, ${scale.y})`,
  transformOrigin: `${(crop.x + crop.width / 2) * 100}% ${(crop.y + crop.height / 2) * 100}%`,
});

export type MaulShortProps = {
  manifest: MaulUnifiedShortRenderManifest;
  observationMode?: MaulShortObservationMode;
};

export type MaulShortObservationMode =
  | "creative"
  | "typography_suppressed"
  | "source_treatment_suppressed";

export const resolveMaulRenderLayerPolicy = (manifest: {
  schemaVersion: string;
  layerPolicy?: MaulRenderLayerPolicy;
}): MaulRenderLayerPolicy | null =>
  manifest.schemaVersion === "maul-unified-short-render-manifest/v3"
    ? manifest.layerPolicy ?? null
    : null;

export const shouldRenderMaulLayer = (
  policy: MaulRenderLayerPolicy,
  layer: keyof MaulRenderLayerPolicy,
): boolean => sharedShouldRenderMaulLayer(policy, layer);

export type MaulSourceTreatmentProfileId = "subject_focus_grade_v1";

export const resolveMaulSourceTreatmentProfileId = (
  treatment: MaulCreativeTreatment | undefined,
): MaulSourceTreatmentProfileId | null => treatment?.sourceTreatmentProfileId ?? null;

export const MaulSourceTreatment: React.FC<{
  profileId: MaulSourceTreatmentProfileId;
}> = ({profileId}) => (
  <AbsoluteFill
    aria-hidden="true"
    data-maul-source-treatment={profileId}
    style={{
      pointerEvents: "none",
      backgroundImage:
        "radial-gradient(ellipse 88% 76% at 50% 38%, rgba(0, 0, 0, 0) 52%, rgba(0, 0, 0, 0.07) 75%, rgba(0, 0, 0, 0.34) 100%)",
    }}
  />
);

export const shouldRenderMaulTypography = (
  observationMode: MaulShortObservationMode | undefined,
): boolean => observationMode !== "typography_suppressed";

export const shouldRenderMaulSourceTreatment = (
  observationMode: MaulShortObservationMode | undefined,
): boolean => observationMode !== "source_treatment_suppressed";

type MaulCreativeTreatment =
  MaulUnifiedShortRenderManifest['plans']['artDirection']['creativeTreatment'];

type MaulVisualStyle = {
  background: string;
  captionSurface: string;
  captionText: string;
  captionAccent: string;
  captionShadow: string;
  motionAmplitude: number;
  captionY: number;
  safeBottomPx: number;
  maxCaptionWidth: number;
  fontSize: number;
  fontWeight: number;
  sourceFilter?: string;
};

export const buildMaulVisualStyle = (treatmentId: string): MaulVisualStyle => {
  if (treatmentId === "premium_direct_response") {
    return {
      background: "#08070b",
      captionSurface: "rgba(14, 12, 18, 0.94)",
      captionText: "#fff8ea",
      captionAccent: "#ffcb45",
      captionShadow: "rgba(255, 104, 52, 0.34)",
      motionAmplitude: 0.035,
      captionY: 1110,
      safeBottomPx: 330,
      maxCaptionWidth: 900,
      fontSize: 82,
      fontWeight: 900,
    } as const;
  }
  if (treatmentId === "minimal_expert") {
    return {
      background: "#ebe9e2",
      captionSurface: "rgba(247, 246, 241, 0.94)",
      captionText: "#171a1d",
      captionAccent: "#285f5a",
      captionShadow: "rgba(16, 40, 37, 0.12)",
      motionAmplitude: 0.008,
      captionY: 1160,
      safeBottomPx: 300,
      maxCaptionWidth: 880,
      fontSize: 70,
      fontWeight: 650,
    } as const;
  }
  return {
    background: "#091218",
    captionSurface: "rgba(9, 22, 29, 0.9)",
    captionText: "#f6f1e6",
    captionAccent: "#7ed9c2",
    captionShadow: "rgba(69, 190, 167, 0.2)",
    motionAmplitude: 0.018,
    captionY: 1135,
    safeBottomPx: 310,
    maxCaptionWidth: 900,
    fontSize: 76,
    fontWeight: 760,
  } as const;
};

export const applyMaulCreativeTreatment = (
  style: MaulVisualStyle,
  treatment: MaulCreativeTreatment | undefined,
): MaulVisualStyle =>
  treatment
    ? {
        ...style,
        captionText: treatment.palette.primary,
        captionAccent: treatment.palette.accent,
        sourceFilter:
          treatment.palette.sourceTreatment === 'dark_warm_cool_contrast'
            ? 'brightness(0.72) contrast(1.16) saturate(0.86) sepia(0.06)'
            : treatment.palette.sourceTreatment === 'high_contrast_monochrome'
              ? 'grayscale(1) brightness(0.76) contrast(1.2)'
              : 'none',
        motionAmplitude:
          treatment.motionMode === 'static_editorial_hold'
            ? 0
            : treatment.motionMode === 'soft_scale_settle'
              ? 0.012
              : 0.006,
      }
    : style;

export const buildMaulSourceSequences = (
  timeline: MaulEditorialTimelinePayload,
  fps: number,
): Array<{
  from: number;
  durationInFrames: number;
  trimBefore: number;
  trimAfter: number;
  playbackRate: number;
}> =>
  timeline.timestampMap
    .filter((segment) => segment.mode !== "cut")
    .map((segment) => ({
      from: Math.round((segment.outputStartMs / 1000) * fps),
      durationInFrames: Math.max(
        1,
        Math.round(
          ((segment.outputEndMs - segment.outputStartMs) / 1000) * fps,
        ),
      ),
      trimBefore: Math.round((segment.sourceStartMs / 1000) * fps),
      trimAfter: Math.max(
        Math.round((segment.sourceStartMs / 1000) * fps) + 1,
        Math.round((segment.sourceEndMs / 1000) * fps),
      ),
      playbackRate:
        (segment.sourceEndMs - segment.sourceStartMs) /
        (segment.outputEndMs - segment.outputStartMs),
    }));

export const toMaulManifestGlobalFrame = ({
  sequenceFrom,
  sequenceFrame,
}: {
  sequenceFrom: number;
  sequenceFrame: number;
}) => sequenceFrom + sequenceFrame;

type MaulCameraScaleEvent = Pick<
  MaulFramingCameraPlanPayload["events"][number],
  "outputStartMs" | "outputEndMs" | "startScale" | "endScale"
>;

export const resolveMaulCameraScale = ({
  events,
  outputFrame,
  fps,
}: {
  events: MaulCameraScaleEvent[];
  outputFrame: number;
  fps: number;
}) => {
  const outputTimeMs = (outputFrame / fps) * 1000;
  const first = events[0];
  const last = events.at(-1);
  if (!first || !last) return 1;
  if (outputTimeMs <= first.outputStartMs) return first.startScale;
  if (outputTimeMs >= last.outputEndMs) return last.endScale;
  const event = events.find(
    (candidate) =>
      candidate.outputStartMs <= outputTimeMs &&
      outputTimeMs <= candidate.outputEndMs,
  );
  if (!event) {
    const preceding = events.reduce<MaulCameraScaleEvent | null>(
      (latest, candidate) =>
        candidate.outputEndMs < outputTimeMs &&
        (!latest || candidate.outputEndMs > latest.outputEndMs)
          ? candidate
          : latest,
      null,
    );
    return preceding?.endScale ?? first.startScale;
  }
  const progress = Math.max(
    0,
    Math.min(
      1,
      (outputTimeMs - event.outputStartMs) /
        (event.outputEndMs - event.outputStartMs),
    ),
  );
  return event.startScale + (event.endScale - event.startScale) * progress;
};

export const calculateMaulShortMetadata = ({
  props,
}: {
  props: MaulShortProps;
}) => ({
  durationInFrames: Math.max(
    1,
    Math.round(
      (props.manifest.timeline.outputDurationMs / 1000) *
        props.manifest.output.fps,
    ),
  ),
  width: props.manifest.output.width,
  height: props.manifest.output.height,
  fps: props.manifest.output.fps,
  defaultOutName: `maul-${props.manifest.treatment.treatmentId}.mp4`,
});

const defaultTreatment: MaulTreatmentGenomePayload = {
  treatmentId: "minimal_expert",
  timelineArtifactId: "timeline_default",
  catalogEntryName: "Minimal Expert",
  version: "maul-treatment/minimal-expert/v1",
  replayKey: "0".repeat(64),
  purpose: "Clarity-first explanation.",
  targetViewerState: "Calm and oriented.",
  grammar: {
    hook: "Clear question",
    escalation: "One layer",
    proof: "One example",
    reveal: "Spoken first",
    payoff: "Quiet principle",
    cta: "Optional",
  },
  pacing: {
    minCutsPerMinute: 4,
    maxCutsPerMinute: 10,
    protectedPausePolicy: "Protect comprehension pauses.",
  },
  visualPolicy: {},
  audioPolicy: {},
  rendererInputs: {
    framing: {
      mode: "clarity_first",
      safeZone: "platform_ui_balanced",
      maxPunchInScale: 1.08,
      speakerPriority: true,
    },
    caption: {
      profile: "precision_minimal",
      maxWordsPerCard: 9,
      minFontScale: 0.78,
      hierarchy: ["idea"],
      typographyGrammar: "Quiet sentence case.",
    },
    motion: {
      intensity: "sparse",
      permittedPrimitives: ["soft_fade"],
      permittedTransitions: ["hard_cut"],
    },
    bRoll: { policy: "Only when necessary.", maxInsertsPerMinute: 2 },
    audio: {
      musicBehavior: "Quiet texture.",
      sfxBehavior: "None by default.",
      duckingDb: -14,
    },
  },
  repetitionBudget: {
    maxRepeatedPrimitivePerClip: 2,
    maxRecentFeedReuse: 3,
    lookbackPosts: 12,
  },
  brandConstraints: ["Preserve whitespace."],
  accessibilityConstraints: ["Keep captions legible."],
  prohibitedMotifs: ["kinetic barrage"],
  referenceCorpusArtifactIds: [],
  judgmentLayer: {
    minimumWeightedScore: 82,
    rubric: [
      { id: "clarity", label: "Clarity", weight: 20, minimumScore: 75 },
      { id: "fidelity", label: "Fidelity", weight: 20, minimumScore: 90 },
      { id: "pacing", label: "Pacing", weight: 20, minimumScore: 70 },
      { id: "hierarchy", label: "Hierarchy", weight: 20, minimumScore: 75 },
      {
        id: "accessibility",
        label: "Accessibility",
        weight: 20,
        minimumScore: 85,
      },
    ],
    failureClasses: [
      {
        id: "clarity",
        label: "Clarity",
        description: "Clarity failure.",
        severity: "blocking",
      },
      {
        id: "fidelity",
        label: "Fidelity",
        description: "Fidelity failure.",
        severity: "blocking",
      },
      {
        id: "pacing",
        label: "Pacing",
        description: "Pacing failure.",
        severity: "major",
      },
      {
        id: "hierarchy",
        label: "Hierarchy",
        description: "Hierarchy failure.",
        severity: "major",
      },
      {
        id: "accessibility",
        label: "Accessibility",
        description: "Accessibility failure.",
        severity: "blocking",
      },
    ],
  },
  renderFallbacks: ["Centered crop."],
  provenanceRules: ["Source-grounded only."],
};

const defaultTimeline: MaulEditorialTimelinePayload = {
  sourceAssetId: "source_default",
  analysisArtifactId: "analysis_default",
  sourceDurationMs: 1000,
  outputDurationMs: 1000,
  selectedClipWindows: [{ sourceStartMs: 0, sourceEndMs: 1000 }],
  cutCandidates: [],
  protectedRanges: [],
  timestampMap: [
    {
      sourceStartMs: 0,
      sourceEndMs: 1000,
      outputStartMs: 0,
      outputEndMs: 1000,
      mode: "keep",
    },
  ],
  speakerCropTracks: [],
  editRationale: ["Default Studio fixture."],
  qualityWarnings: [],
};

export const MAUL_SHORT_DEFAULT_PROPS: {
  manifest: MaulUnifiedShortRenderManifestV1;
} = {
  manifest: {
    schemaVersion: "maul-unified-short-render-manifest/v1",
    rendererInputKind: "unified_short_render_manifest_only",
    planningBundleArtifactId: "planning_bundle_default",
    planArtifactIds: {
      observationSnapshot: "observation_default",
      candidateNarrative: "narrative_default",
      beatMap: "beat_map_default",
      typographyMotion: "typography_default",
      camera: "camera_default",
      visual: "visual_default",
      audio: "audio_intent_default",
      capabilitySelection: "capability_default",
      adapterDecision: "adapter_default",
      artDirection: "art_direction_default",
      contextAssembly: "context_assembly_default",
      shotIntentMatrix: "shot_intent_default",
      textOpportunity: "text_opportunity_default",
      revision: "revision_default",
    },
    source: {
      sourceAssetId: "source_default",
      storagePath: "dev-fixtures/test-video.mp4",
      sha256: "0".repeat(64),
    },
    timeline: defaultTimeline,
    treatment: defaultTreatment,
    captions: [],
    audio: {
      planId: "audio_default",
      planMode: "render_ready",
      musicTrack: {
        id: "music_default",
        storagePath: "dev-fixtures/silence.wav",
        licenseType: "development_fixture",
        commercialAllowed: false,
        licenseVerified: false,
        renderSafe: false,
        title: "Studio Silence",
        artist: "MAUL",
        durationSec: 1,
      },
      sfxAssets: [],
    },
    plans: {} as MaulUnifiedShortRenderManifestV1["plans"],
    planExecution:
      [] as MaulUnifiedShortRenderManifestV1["planExecution"],
    output: { width: 1080, height: 1920, fps: 30, codec: "h264" },
    replayKey: "0".repeat(64),
    createdAt: "2026-01-01T00:00:00.000Z",
  },
};

// MAUL renders the governed source dialogue and licensed mix in this composition.
export const shouldMaulRemotionRenderAudio = (
  manifest: Pick<MaulUnifiedShortRenderManifest, "schemaVersion">,
): boolean => Boolean(manifest.schemaVersion);

const MAUL_TEXT_SUPPRESSING_VISUAL_MODES = new Set([
  "evidence_image",
  "split_proof",
  "editorial_graphic",
]);

export const buildMaulTextSuppressionRanges = (track: {
  intervals: readonly {
    mode: string;
    outputStartMs: number;
    outputEndMs: number;
  }[];
} | null | undefined) =>
  track?.intervals
    .filter((interval) => MAUL_TEXT_SUPPRESSING_VISUAL_MODES.has(interval.mode))
    .map(({outputStartMs, outputEndMs}) => ({outputStartMs, outputEndMs})) ?? [];

type MaulCaptionToken = { text: string; fromMs: number; toMs: number };
export const joinMaulCaptionTokens = (tokens: MaulCaptionToken[]) =>
  joinShortsTextTokens(tokens.map((token) => token.text));

const needsSpaceBeforeCaptionToken = (
  previous: MaulCaptionToken,
  current: MaulCaptionToken,
) =>
  joinShortsTextTokens([previous.text, current.text]) ===
  `${previous.text.trim()} ${current.text.trim()}`;

type MaulCaptionGroup =
  MaulUnifiedShortRenderManifest["plans"]["typographyMotion"]["captionGroups"][number];
type MaulCaptionPage = TikTokPage & { plannedEndMs: number | null };

export const resolveMaulCaptionPlans = (
  manifest: MaulUnifiedShortRenderManifest,
): {
  captionGroups: MaulCaptionGroup[];
  captionGroupsAreGoverned: boolean;
} => {
  if (manifest.schemaVersion !== "maul-unified-short-render-manifest/v1") {
    return {captionGroups: [], captionGroupsAreGoverned: false};
  }
  const typographyMotion = manifest.plans?.typographyMotion;
  if (!typographyMotion?.textChunkPlan) {
    return {captionGroups: [], captionGroupsAreGoverned: false};
  }
  return {
    captionGroups: typographyMotion.captionGroups,
    captionGroupsAreGoverned: true,
  };
};

export const buildMaulCaptionPages = ({
  captions,
  captionGroups,
  captionGroupsAreGoverned,
  combineTokensWithinMilliseconds,
}: {
  captions: Caption[];
  captionGroups: MaulCaptionGroup[];
  captionGroupsAreGoverned: boolean;
  combineTokensWithinMilliseconds: number;
}): MaulCaptionPage[] => {
  if (!captionGroupsAreGoverned || captionGroups.length === 0) {
    return createTikTokStyleCaptions({
      captions,
      combineTokensWithinMilliseconds,
    }).pages.map((page) => ({ ...page, plannedEndMs: null }));
  }

  return captionGroups.flatMap((group) => {
    const matchingCaptions = captions.filter(
      (caption) =>
        caption.startMs >= group.outputStartMs &&
        caption.endMs <= group.outputEndMs,
    );
    const matchingText = joinMaulCaptionTokens(
      matchingCaptions.map((caption) => ({
        text: caption.text,
        fromMs: caption.startMs,
        toMs: caption.endMs,
      })),
    );
    const groupCaptions =
      matchingCaptions.length > 0 && matchingText === group.text
        ? matchingCaptions
        : [
            {
              text: group.text,
              startMs: group.outputStartMs,
              endMs: group.outputEndMs,
              timestampMs: group.outputStartMs,
              confidence: null,
            },
          ];
    const page = createTikTokStyleCaptions({
      captions: groupCaptions,
      combineTokensWithinMilliseconds: Math.max(
        1,
        group.outputEndMs - group.outputStartMs + 1,
      ),
    }).pages[0];
    return page ? [{ ...page, plannedEndMs: group.outputEndMs }] : [];
  });
};

const SourceSegment: React.FC<{
  sourceAsset: string;
  trimBefore: number;
  trimAfter: number;
  playbackRate: number;
  cropCenterPercent: number;
  cropCenterYPercent?: number;
  motionAmplitude: number;
  globalFrameOffset?: number;
  cameraEvents?: MaulCameraScaleEvent[];
  compositionScale?: {x: number; y: number};
  sourceViewport?: MaulNormalizedBox;
  plannedCrop?: MaulNormalizedBox;
  paddedNonSourceRegions?: MaulNormalizedBox[];
  background?: string;
  compositionIntervalId?: string;
  sourceFilter?: string;
}> = ({
  sourceAsset,
  trimBefore,
  trimAfter,
  playbackRate,
  cropCenterPercent,
  cropCenterYPercent = 50,
  motionAmplitude,
  globalFrameOffset = 0,
  cameraEvents = [],
  compositionScale = {x: 1, y: 1},
  sourceViewport = {x: 0, y: 0, width: 1, height: 1},
  plannedCrop,
  paddedNonSourceRegions = [],
  background = "#000000",
  compositionIntervalId,
  sourceFilter = 'none',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = cameraEvents.length
    ? resolveMaulCameraScale({
        events: cameraEvents,
        outputFrame: toMaulManifestGlobalFrame({
          sequenceFrom: globalFrameOffset,
          sequenceFrame: frame,
        }),
        fps,
      })
    : interpolate(
        frame,
        [0, Math.max(1, fps * 4)],
        [1, 1 + motionAmplitude],
        {
          easing: Easing.bezier(0.45, 0, 0.55, 1),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        },
      );
  const plannedVideoStyle = plannedCrop
    ? buildMaulPlannedSourceVideoStyle({
        crop: plannedCrop,
        scale: {
          x: scale * compositionScale.x,
          y: scale * compositionScale.y,
        },
      })
    : null;
  return (
    <AbsoluteFill
      data-maul-composition-interval={compositionIntervalId}
      style={{background}}
    >
      <div
        style={{
          position: "absolute",
          left: `${sourceViewport.x * 100}%`,
          top: `${sourceViewport.y * 100}%`,
          width: `${sourceViewport.width * 100}%`,
          height: `${sourceViewport.height * 100}%`,
          filter: sourceFilter,
          overflow: "hidden",
        }}
      >
        <Video
          src={staticFile(sourceAsset)}
          trimBefore={trimBefore}
          trimAfter={trimAfter}
          playbackRate={playbackRate}
          style={
            plannedVideoStyle
              ? {position: "absolute", ...plannedVideoStyle}
              : {
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: `${cropCenterPercent}% ${cropCenterYPercent}%`,
                  transform: `scale(${scale})`,
                }
          }
        />
      </div>
      <MaulPaddedSourceRegions
        regions={paddedNonSourceRegions}
        background={background}
      />
    </AbsoluteFill>
  );
};

const CaptionCard: React.FC<{
  page: TikTokPage;
  style: ReturnType<typeof buildMaulVisualStyle>;
}> = ({ page, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const absoluteTimeMs = page.startMs + (frame / fps) * 1000;
  const enter = interpolate(
    frame,
    [0, Math.max(1, Math.round(fps * 0.2))],
    [0, 1],
    {
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  return (
    <div
      style={{
        position: "absolute",
        top: style.captionY,
        left: (1080 - style.maxCaptionWidth) / 2,
        width: style.maxCaptionWidth,
        padding: "30px 36px 34px",
        borderRadius: 28,
        background: style.captionSurface,
        boxShadow: `0 24px 70px ${style.captionShadow}`,
        color: style.captionText,
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: 1.08,
        letterSpacing: "-0.035em",
        textAlign: "center",
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [26, 0])}px)`,
        whiteSpace: "pre-wrap",
      }}
    >
      {page.tokens.map((token, index) => (
        <React.Fragment key={`${token.fromMs}-${token.text}`}>
          {index > 0 &&
          needsSpaceBeforeCaptionToken(page.tokens[index - 1]!, token)
            ? " "
            : null}
          <span
            style={{
              color:
                token.fromMs <= absoluteTimeMs && token.toMs > absoluteTimeMs
                  ? style.captionAccent
                  : style.captionText,
            }}
          >
            {token.text}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};

const MaulCaptionLayer: React.FC<{
  captions: Caption[];
  captionGroups: MaulCaptionGroup[];
  captionGroupsAreGoverned: boolean;
  treatmentId: string;
  creativeTreatment?: MaulCreativeTreatment;
}> = ({
  captions,
  captionGroups,
  captionGroupsAreGoverned,
  treatmentId,
  creativeTreatment,
}) => {
  const { fps } = useVideoConfig();
  const visualStyle = applyMaulCreativeTreatment(
    buildMaulVisualStyle(treatmentId),
    creativeTreatment,
  );
  const combineTokensWithinMilliseconds =
    treatmentId === "premium_direct_response"
      ? 850
      : treatmentId === "founder_podcast"
        ? 1150
        : 1450;
  const pages = useMemo(
    () =>
      buildMaulCaptionPages({
        captions,
        captionGroups,
        captionGroupsAreGoverned,
        combineTokensWithinMilliseconds,
      }),
    [
      captions,
      captionGroups,
      captionGroupsAreGoverned,
      combineTokensWithinMilliseconds,
    ],
  );
  return (
    <>
      {pages.map((page, index) => {
        const next = pages[index + 1];
        const from = Math.round((page.startMs / 1000) * fps);
        const endMs =
          page.plannedEndMs ??
          next?.startMs ??
          Math.max(
            page.startMs + combineTokensWithinMilliseconds,
            page.tokens.at(-1)?.toMs ?? page.startMs + 500,
          );
        const durationInFrames = Math.max(
          1,
          Math.round(((endMs - page.startMs) / 1000) * fps),
        );
        return (
          <Sequence
            key={`${page.startMs}-${index}`}
            from={from}
            durationInFrames={durationInFrames}
          >
            <CaptionCard page={page} style={visualStyle} />
          </Sequence>
        );
      })}
    </>
  );
};

export const MaulShort: React.FC<MaulShortProps> = ({
  manifest,
  observationMode = "creative",
}) => {
  const adaptedManifest = useMemo(
    () => adaptMaulShortManifest(manifest),
    [manifest],
  );
  const { timeline, treatment, captions } = manifest;
  const sourceAsset = manifest.source.storagePath;
  const musicAsset = manifest.audio.musicTrack?.storagePath;
  const sfxAssets = manifest.audio.sfxAssets.map((asset) => ({
    id: asset.id,
    eventType: asset.eventType,
    outputMs: asset.outputMs,
    asset: asset.storagePath,
  }));
  const audioPlanId = manifest.audio.planId;
  const renderRemotionAudio = shouldMaulRemotionRenderAudio(manifest);
  const layerPolicy = resolveMaulRenderLayerPolicy(manifest);
  const rendersLayer = (layer: keyof MaulRenderLayerPolicy): boolean =>
    layerPolicy ? shouldRenderMaulLayer(layerPolicy, layer) : true;
  const renderAudioTreatment = rendersLayer("audioTreatment");
  const renderSourceTreatment = rendersLayer("sourceTreatment");
  const renderSourceOverlay = rendersLayer("sourceLegibilityOverlay");
  const renderBackgroundAnimation = rendersLayer("backgroundAnimation");
  const { fps } = useVideoConfig();
  const creativeTreatment = manifest.plans?.artDirection?.creativeTreatment;
  const visualStyle = applyMaulCreativeTreatment(
    buildMaulVisualStyle(treatment.treatmentId),
    creativeTreatment,
  );
  const sourceTreatmentProfileId =
    resolveMaulSourceTreatmentProfileId(creativeTreatment);
  const legacySequences =
    adaptedManifest.mode === "legacy"
      ? buildMaulSourceSequences(timeline, fps)
      : [];
  const plannedModel =
    adaptedManifest.mode === "planned"
      ? buildMaulPlannedRenderModel(adaptedManifest.manifest)
      : null;
  const declaredVisualTrack =
    adaptedManifest.mode === "planned"
      ? adaptedManifest.manifest.plans.visual.visualTrack
      : undefined;
  const renderVisualTrack = Boolean(
    declaredVisualTrack &&
      rendersLayer("editorialCuts") &&
      rendersLayer("transitions") &&
      rendersLayer("backgroundAnimation") &&
      rendersLayer("motionGraphics"),
  );
  const visualTrack = renderVisualTrack ? declaredVisualTrack : undefined;
  const textSuppressionRanges = buildMaulTextSuppressionRanges(visualTrack);
  const governedCameraEvents =
    adaptedManifest.mode === "planned" &&
    adaptedManifest.manifest.schemaVersion ===
      "maul-unified-short-render-manifest/v3"
      ? manifest.plans.camera.events
      : undefined;
  const captionPlans = resolveMaulCaptionPlans(manifest);
  const crop =
    adaptedManifest.mode === "legacy"
      ? timeline.speakerCropTracks[0]?.crop
      : undefined;
  const cropCenterPercent = crop ? (crop.x + crop.width / 2) * 100 : 50;
  const musicVolume = Math.min(
    0.42,
    Math.pow(10, treatment.rendererInputs.audio.duckingDb / 20),
  );

  return (
    <AbsoluteFill
      data-audio-plan-id={audioPlanId}
      data-render-manifest-replay-key={manifest.replayKey}
      data-treatment-id={treatment.treatmentId}
      style={{ background: visualStyle.background, overflow: "hidden" }}
    >
      {legacySequences.map((segment, index) => (
        <Sequence
          key={`${segment.from}-${index}`}
          from={segment.from}
          durationInFrames={segment.durationInFrames}
        >
          <SourceSegment
            sourceAsset={sourceAsset}
            trimBefore={segment.trimBefore}
            trimAfter={segment.trimAfter}
            playbackRate={segment.playbackRate}
            cropCenterPercent={cropCenterPercent}
            motionAmplitude={renderBackgroundAnimation ? visualStyle.motionAmplitude : 0}
            sourceFilter={renderSourceTreatment ? visualStyle.sourceFilter : "none"}
            globalFrameOffset={segment.from}
            cameraEvents={undefined}
          />
        </Sequence>
      ))}
      {visualTrack ? <MaulVisualTrack track={visualTrack} /> : null}
      {visualTrack && plannedModel?.sourceSequences.map((segment) => (
        <Sequence
          key={`dialogue-${segment.compositionIntervalId}-${segment.from}`}
          from={segment.from}
          durationInFrames={segment.durationInFrames}
        >
          <Audio
            src={staticFile(sourceAsset)}
            trimBefore={segment.trimBefore}
            trimAfter={segment.trimAfter}
            playbackRate={segment.playbackRate}
          />
        </Sequence>
      ))}
      {!visualTrack && plannedModel?.sourceSequences.map((segment) => (
        <Sequence
          key={`${segment.compositionIntervalId}-${segment.from}`}
          from={segment.from}
          durationInFrames={segment.durationInFrames}
        >
          <SourceSegment
            sourceAsset={sourceAsset}
            trimBefore={segment.trimBefore}
            trimAfter={segment.trimAfter}
            playbackRate={segment.playbackRate}
            cropCenterPercent={segment.cropCenterXPercent}
            cropCenterYPercent={segment.cropCenterYPercent}
            motionAmplitude={renderBackgroundAnimation ? visualStyle.motionAmplitude : 0}
            sourceFilter={renderSourceTreatment ? visualStyle.sourceFilter : "none"}
            globalFrameOffset={segment.from}
            cameraEvents={renderBackgroundAnimation ? governedCameraEvents : undefined}
            compositionScale={segment.scale}
            sourceViewport={segment.sourceViewport}
            plannedCrop={segment.crop}
            paddedNonSourceRegions={segment.paddedNonSourceRegions}
            background={visualStyle.background}
            compositionIntervalId={segment.compositionIntervalId}
          />
        </Sequence>
      ))}
      {renderSourceOverlay ? (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.02) 45%, rgba(0,0,0,0.42) 100%)",
          }}
        />
      ) : null}
      {sourceTreatmentProfileId &&
      renderSourceTreatment &&
      shouldRenderMaulSourceTreatment(observationMode) ? (
        <MaulSourceTreatment profileId={sourceTreatmentProfileId} />
      ) : null}
      {shouldRenderMaulTypography(observationMode)
        ? plannedModel
          ? (
              <MaulPlannedTextLayer
                records={plannedModel.textRecords}
                textColor={visualStyle.captionText}
                accentColor={visualStyle.captionAccent}
                creativeTreatment={creativeTreatment}
                referenceEditorialRhythm={
                  manifest.plans?.artDirection?.referenceEditorialRhythm
                }
              />
            )
          : (
              <MaulCaptionLayer
                captions={captions}
                captionGroups={captionPlans.captionGroups}
                captionGroupsAreGoverned={captionPlans.captionGroupsAreGoverned}
                treatmentId={treatment.treatmentId}
                creativeTreatment={creativeTreatment}
              />
            )
        : null}
      {renderRemotionAudio &&
      renderAudioTreatment &&
      manifest.audio.musicTrack?.renderSafe &&
      musicAsset ? (
        <Audio src={staticFile(musicAsset)} loop volume={musicVolume} />
      ) : null}
      {renderRemotionAudio && renderAudioTreatment && sfxAssets.map((sfx) => (
        <Sequence
          key={sfx.id}
          from={Math.round((sfx.outputMs / 1000) * fps)}
          durationInFrames={Math.max(1, fps * 2)}
        >
          <Audio src={staticFile(sfx.asset)} volume={0.5} />
        </Sequence>
      ))}
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          bottom: visualStyle.safeBottomPx,
          height: 2,
          background: "transparent",
        }}
      />
    </AbsoluteFill>
  );
};
