import React, {type CSSProperties, useCallback, useEffect, useMemo, useRef, useState} from "react";

import {
  getLongformWordEmphasisWordKey
} from "../components/LongformWordEmphasisAdornment";
import {SemanticSidecallCueVisual} from "../components/SemanticSidecallCueVisual";
import {getCaptionContainerStyle, upperSafeZone} from "../lib/caption-layout";
import {selectActiveMotionBackgroundOverlayCueAtTime} from "../lib/motion-platform/background-overlay-planner";
import {buildGradeFilter} from "../lib/motion-platform/grade-profiles";
import {
  getTransitionOverlayVisibility,
  lerp as transitionLerp,
  resolveTransitionOverlayBlendMode,
  clamp01 as clampTransition01
} from "../lib/motion-platform/transition-overlay-render-utils";
import {selectActiveTransitionOverlayCueAtTime} from "../lib/motion-platform/transition-overlay-planner";
import {
  resolveMotionChoreographySceneStateAtTime,
  selectActiveMotionChoreographySceneAtTime,
  type MotionChoreographySceneState
} from "../lib/motion-platform/choreography-planner";
import {
  isIframeMotionGraphic,
  isVideoLikeMotionGraphic,
  resolveMotionDecisionAssetPlacement,
  resolveMotionDecisionObjectFit,
  resolveMotionDecisionVisibility,
  resolveMotionDecisionZIndex
} from "../lib/motion-graphics-agent/rendering";
import {resolveBackgroundOverlayRenderState} from "../lib/motion-platform/background-overlay-visuals";
import {
  sanitizeRenderableOverlayText,
  shouldRenderOverlayText,
  shouldRenderPreviewOverlayAsset
} from "../lib/motion-platform/render-text-safety";
import {resolveSchemaStageEffectRoute} from "../lib/motion-platform/schema-mapping-resolver";
import type {MotionGraphicsDecision, MotionGraphicsDecisionAsset} from "../lib/motion-graphics-agent/types";
import {
  selectActiveCameraCueAtTime,
  selectActiveMotionSceneAtTime,
  type MotionCompositionModel,
  type ResolvedMotionScene
} from "../lib/motion-platform/scene-engine";
import {selectActiveMotionShowcaseCueAtTime} from "../lib/motion-platform/showcase-motion-planner";
import {getZoomTimingFamilyDefinition, type ZoomEaseId} from "../lib/motion-platform/zoom-timing";
import {
  getLongformCaptionRenderMode,
  getLongformCaptionRenderModeForChunk
} from "../lib/stylebooks/caption-style-profiles";
import {
  resolveCaptionEditorialDecision,
  resolveControlledBackgroundScale,
  type CaptionEditorialContext,
  type CaptionEditorialDecision
} from "../lib/motion-platform/caption-editorial-engine";
import {
  findLongformWordAnchor,
  isLongformHelperWord,
  normalizeLongformWord,
  splitLongformWordsIntoLines,
  type LongformWordLine
} from "../lib/longform-word-layout";
import {
  getLongformLineHandoffProgress,
  getLongformWordMotionState,
  selectLongformActiveChunk
} from "../lib/longform-word-timing";
import type {
  CaptionChunk,
  CaptionStyleProfileId,
  CaptionVerticalBias,
  MotionAssetManifest,
  MotionTransformValue,
  MotionShowcaseCue,
  PreviewPerformanceMode,
  TranscribedWord,
  VideoMetadata
} from "../lib/types";
import {
  createPreviewTelemetry,
  type PreviewPlaybackHealth,
  type PreviewTelemetry
} from "./preview-telemetry";
import {
  PREVIEW_SUBTITLE_ANIMATION_GAIN,
  PREVIEW_SUBTITLE_GLOW_GAIN,
  resolvePreviewSubtitleAnimationMode,
  resolvePreviewSubtitleSafeZone,
  type PreviewSubtitleAnimationMode
} from "./preview-subtitle-system";
import {NativePreviewSoundDesign} from "./NativePreviewSoundDesign";
import {MotionChoreographyStage} from "../components/MotionChoreographyOverlay";
import {StageOverlayAsset} from "./native-preview-stage-cinematics";

type NativePreviewStageProps = {
  videoSrc: string;
  posterSrc?: string | null;
  videoMetadata: Pick<VideoMetadata, "width" | "height" | "fps" | "durationSeconds" | "durationInFrames">;
  model: MotionCompositionModel;
  captionProfileId: CaptionStyleProfileId;
  previewPerformanceMode: PreviewPerformanceMode;
  suppressCaptions?: boolean;
  onHealthChange?: (health: PreviewPlaybackHealth) => void;
  onErrorMessageChange?: (message: string | null) => void;
  onTelemetryUpdate?: (telemetry: PreviewTelemetry) => void;
};

type PreparedLongformChunk = {
  lines: LongformWordLine[];
  wordMetaByKey: Map<string, {
    chunkWordIndex: number;
    previousWord?: TranscribedWord;
    nextWord?: TranscribedWord;
    isHelper: boolean;
  }>;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;
const MIN_PREVIEW_VIEWPORT_SCALE = 0.35;

const resolvePreviewViewportScale = ({
  viewportWidth,
  viewportHeight,
  outputWidth,
  outputHeight
}: {
  viewportWidth: number;
  viewportHeight: number;
  outputWidth: number;
  outputHeight: number;
}): number => {
  const widthScale = viewportWidth / Math.max(1, outputWidth);
  const heightScale = viewportHeight / Math.max(1, outputHeight);
  const rawScale = Math.min(widthScale, heightScale);
  if (!Number.isFinite(rawScale) || rawScale <= 0) {
    return 1;
  }

  return clamp(rawScale, MIN_PREVIEW_VIEWPORT_SCALE, 1);
};

const prestigeSnap = (value: number): number => {
  const t = clamp01(value);
  // Approximation of cubic-bezier(0.05, 0.7, 0.1, 1.0)
  // Fast snap up to ~0.8 progress in the first ~25% of time
  if (t < 0.22) {
    return (t / 0.22) * 0.82;
  }
  return 0.82 + ((t - 0.22) / 0.78) * 0.18;
};

const easeOutCubic = prestigeSnap;
const easeInOutCubic = (value: number): number => {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
};
const BACKGROUND_PRELOAD_LEAD_MS = 700;
const NATIVE_PREVIEW_OVERLAY_FPS: Record<PreviewPerformanceMode, number> = {
  turbo: 12,
  balanced: 18,
  full: 18
};
const TELEMETRY_PUBLISH_INTERVAL_MS = 240;
const PREVIEW_TEXT_GLOW_GAIN = 1.52;
const PREVIEW_TEXT_MOTION_GAIN = 1.36;
const PREVIEW_STAGE_BLOOM_GAIN = 1.48;
const PREVIEW_BACKGROUND_HALO_BLUR_PX = 42;

const easeCameraValue = (mode: ZoomEaseId, input: number): number => {
  const t = clamp01(input);
  if (mode === "sine.out") {
    return Math.sin((t * Math.PI) / 2);
  }
  if (mode === "sine.inOut") {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }
  if (mode === "power3.out") {
    return 1 - (1 - t) ** 3;
  }
  if (mode === "power2.out") {
    return 1 - (1 - t) ** 2;
  }
  if (mode === "power2.inOut") {
    return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  }
  return t;
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const resolveCueAssetSrc = (src: string): string => {
  if (/^(https?:)?\/\//.test(src) || src.startsWith("/")) {
    return src;
  }
  return `/${src.replace(/^\/+/, "")}`;
};

const buildMediaErrorMessage = (video: HTMLVideoElement | null): string => {
  if (!video?.error) {
    return "The browser could not load the preview video.";
  }

  if (video.error.code === MediaError.MEDIA_ERR_ABORTED) {
    return "The preview video load was interrupted.";
  }
  if (video.error.code === MediaError.MEDIA_ERR_NETWORK) {
    return "The browser hit a network error while loading the preview video.";
  }
  if (video.error.code === MediaError.MEDIA_ERR_DECODE) {
    return "The browser could not decode the preview video stream.";
  }
  if (video.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return "The selected preview video format is not supported in this browser.";
  }

  return "The browser could not play the preview video.";
};

const buildPreparedChunks = (chunks: CaptionChunk[]): Map<string, PreparedLongformChunk> => {
  return new Map<string, PreparedLongformChunk>(
    chunks.map((chunk) => {
      const lines = splitLongformWordsIntoLines(chunk.words);
      const wordMetaByKey = new Map<string, {
        chunkWordIndex: number;
        previousWord?: TranscribedWord;
        nextWord?: TranscribedWord;
        isHelper: boolean;
      }>();

      chunk.words.forEach((word, chunkWordIndex) => {
        wordMetaByKey.set(getLongformWordEmphasisWordKey(word), {
          chunkWordIndex,
          previousWord: chunkWordIndex > 0 ? chunk.words[chunkWordIndex - 1] : undefined,
          nextWord: chunkWordIndex < chunk.words.length - 1 ? chunk.words[chunkWordIndex + 1] : undefined,
          isHelper: isLongformHelperWord(normalizeLongformWord(word.text))
        });
      });

      return [chunk.id, {lines, wordMetaByKey}];
    })
  );
};

type PreviewTypographyVariant =
  | "blur-lift"
  | "split-focus"
  | "focus-frame"
  | "letter-wave"
  | "rotational-stagger";

const resolvePreviewTypographyVariant = (
  editorialDecision?: CaptionEditorialDecision
): PreviewTypographyVariant => {
  const pattern = editorialDecision?.typography.pattern;
  if (!pattern) {
    return "blur-lift";
  }

  if (pattern.unit === "letter") {
    return "letter-wave";
  }
  if (pattern.mood === "aggressive" || editorialDecision?.mode === "keyword-only") {
    return "focus-frame";
  }
  if (pattern.unit === "phrase" || pattern.unit === "line" || pattern.mood === "dramatic" || pattern.mood === "trailer") {
    return "split-focus";
  }
  if (pattern.mood === "editorial" || pattern.mood === "tech") {
    return "rotational-stagger";
  }
  return "blur-lift";
};

const buildPreviewWordTextShadow = ({
  editorialDecision,
  isActive,
  highlightProgress
}: {
  editorialDecision?: CaptionEditorialDecision;
  isActive: boolean;
  highlightProgress: number;
}): string => {
  const baseShadow = editorialDecision?.textShadow ??
    (isActive
      ? "0 2px 10px rgba(0,0,0,0.68), 0 0 16px rgba(147,197,253,0.32)"
      : highlightProgress > 0
        ? "0 1px 6px rgba(0,0,0,0.54), 0 0 10px rgba(242,247,255,0.18)"
        : "0 1px 4px rgba(0,0,0,0.46)");
  const glowShadow = isActive
    ? `0 0 ${Math.round(12 * PREVIEW_TEXT_GLOW_GAIN * 0.45)}px rgba(255,255,255,0.24), 0 0 ${Math.round(22 * PREVIEW_TEXT_GLOW_GAIN * 0.35)}px rgba(147,197,253,0.12)`
    : highlightProgress > 0.02
      ? `0 0 ${Math.round(8 * PREVIEW_TEXT_GLOW_GAIN * 0.35)}px rgba(255,255,255,0.12), 0 0 ${Math.round(16 * PREVIEW_TEXT_GLOW_GAIN * 0.25)}px rgba(125,168,255,0.06)`
      : "0 0 6px rgba(255,255,255,0.02)";

  return `${glowShadow}, ${baseShadow}`;
};

const shouldRenderLetterWave = ({
  word,
  editorialDecision,
  isHelper
}: {
  word: TranscribedWord;
  editorialDecision?: CaptionEditorialDecision;
  isHelper: boolean;
}): boolean => {
  return !isHelper &&
    resolvePreviewTypographyVariant(editorialDecision) === "letter-wave" &&
    word.text.length <= 16 &&
    /^[A-Za-z0-9'’-]+$/.test(word.text);
};

const getAnimatedLetterStyle = ({
  word,
  characterIndex,
  currentTimeMs,
  editorialDecision
}: {
  word: TranscribedWord;
  characterIndex: number;
  currentTimeMs: number;
  editorialDecision?: CaptionEditorialDecision;
}): CSSProperties => {
  const pattern = editorialDecision?.typography.pattern;
  const durationMs = Math.max(1, word.endMs - word.startMs);
  const staggerMs = Math.max(14, Math.round(((pattern?.stagger ?? 0.018) * 1000) / 1.4));
  const leadMs = Math.min(240, Math.max(120, durationMs * 0.42));
  const revealStartMs = word.startMs - leadMs + Math.min(characterIndex * staggerMs, leadMs);
  const revealProgress = easeOutCubic(clamp01((currentTimeMs - revealStartMs) / Math.max(1, durationMs * 0.72)));
  const directionalSign = characterIndex % 2 === 0 ? -1 : 1;
  const translateY = (1 - revealProgress) * ((pattern?.entry.y?.[0] ?? 14) * 0.34);
  const rotateDeg = (1 - revealProgress) * directionalSign * ((pattern?.entry.rotateZ?.[0] ?? 6) * 0.42);
  const blurPx = (1 - revealProgress) * ((pattern?.entry.blur?.[0] ?? 8) * 0.24);

  const isSettled = revealProgress >= 0.99 && (currentTimeMs - revealStartMs) > 320;

  return {
    display: "inline-block",
    opacity: Math.max(0, Math.min(1, 0.22 + revealProgress * 0.9)),
    transform: `translate3d(0, ${translateY.toFixed(2)}px, 0) rotate(${rotateDeg.toFixed(2)}deg)`,
    filter: isSettled ? undefined : `blur(${blurPx.toFixed(2)}px)`,
    willChange: isSettled ? undefined : "transform, opacity, filter"
  };
};

const renderAnimatedWordLabel = ({
  word,
  currentTimeMs,
  editorialDecision,
  isHelper
}: {
  word: TranscribedWord;
  currentTimeMs: number;
  editorialDecision?: CaptionEditorialDecision;
  isHelper: boolean;
}): React.ReactNode => {
  if (!shouldRenderLetterWave({word, editorialDecision, isHelper})) {
    return word.text;
  }

  return Array.from(word.text).map((character, characterIndex) => (
    <span
      key={`${word.startMs}-${characterIndex}-${character}`}
      className={currentTimeMs >= word.startMs + 320 ? "typography-letter is-settled" : "typography-letter is-entering"}
      style={getAnimatedLetterStyle({
        word,
        characterIndex,
        currentTimeMs,
        editorialDecision
      })}
    >
      {character}
    </span>
  ));
};

const getLineRevealStyle = ({
  line,
  currentTimeMs,
  editorialDecision
}: {
  line: LongformWordLine;
  currentTimeMs: number;
  editorialDecision?: CaptionEditorialDecision;
}): CSSProperties => {
  const variant = resolvePreviewTypographyVariant(editorialDecision);
  const startMs = line.words[0]?.startMs ?? 0;
  const endMs = line.words[line.words.length - 1]?.endMs ?? startMs + 320;
  const revealWindowMs = Math.max(240, Math.min(760, endMs - startMs + 220));
  const revealProgress = easeOutCubic(clamp01((currentTimeMs - (startMs - 180)) / revealWindowMs));

  const isSettled = revealProgress >= 0.99 && (currentTimeMs - (startMs - 180)) > 420;

  if (variant === "split-focus") {
    return {
      clipPath: `inset(0 ${(Math.max(0, 1 - revealProgress) * 100).toFixed(2)}% 0 0)`,
      filter: isSettled ? undefined : `blur(${((1 - revealProgress) * 3.8).toFixed(2)}px)`
    };
  }

  if (variant === "rotational-stagger") {
    return {
      filter: isSettled ? undefined : `blur(${((1 - revealProgress) * 1.6).toFixed(2)}px)`
    };
  }

  if (variant === "blur-lift") {
    return {
      filter: isSettled ? undefined : `blur(${((1 - revealProgress) * 1.8).toFixed(2)}px)`
    };
  }

  return {};
};

const getWordStyle = ({
  word,
  previousWord,
  nextWord,
  wordIndex,
  chunkWordCount,
  chunk,
  currentTimeMs,
  editorialDecision
}: {
  word: TranscribedWord;
  previousWord?: TranscribedWord;
  nextWord?: TranscribedWord;
  wordIndex: number;
  chunkWordCount: number;
  chunk: CaptionChunk;
  currentTimeMs: number;
  editorialDecision?: CaptionEditorialDecision;
}): CSSProperties => {
  const {opacity, translateY, blur, scale, isActive, hasStarted, highlightProgress} =
    getLongformWordMotionState({
      word,
      previousWord,
      nextWord,
      wordIndex,
      chunkWordCount,
      chunkEndMs: chunk.endMs,
      currentTimeMs
    });
  const variant = resolvePreviewTypographyVariant(editorialDecision);
  const durationMs = Math.max(1, word.endMs - word.startMs);
  const revealLeadMs = Math.min(240, Math.max(120, durationMs * 0.42));
  const revealStartMs = word.startMs - revealLeadMs;
  const revealProgress = easeOutCubic(clamp01((currentTimeMs - revealStartMs) / Math.max(1, durationMs * 0.78)));
  const directionalSign = wordIndex % 2 === 0 ? -1 : 1;
  const isSettled = revealProgress >= 0.99 && (currentTimeMs - revealStartMs) > 420;

  let extraTranslateX = 0;
  let extraTranslateY = 0;
  let extraBlur = 0;
  let rotateDeg = 0;
  let scaleMultiplier = 1;
  let padding: CSSProperties["padding"];
  let borderRadius: CSSProperties["borderRadius"];
  let background: CSSProperties["background"];
  let boxShadow: CSSProperties["boxShadow"];

  if (variant === "split-focus") {
    extraTranslateX = directionalSign * (1 - revealProgress) * 14 * PREVIEW_TEXT_MOTION_GAIN;
    extraTranslateY = (1 - revealProgress) * 6.8;
    extraBlur = (1 - revealProgress) * 2.6;
    scaleMultiplier = 1 + (isActive ? 0.022 : 0.008);
  } else if (variant === "focus-frame") {
    extraTranslateY = (1 - revealProgress) * 6.2;
    extraBlur = (1 - revealProgress) * 2.2;
    scaleMultiplier = isActive ? 1.058 : highlightProgress > 0 ? 1.024 : 1.006;
    padding = "0.04em 0.16em 0.08em";
    borderRadius = "0.34em";
    background = isActive
      ? "linear-gradient(135deg, rgba(65, 86, 255, 0.26), rgba(16, 24, 44, 0.12))"
      : highlightProgress > 0.08
        ? "rgba(255,255,255,0.04)"
        : undefined;
    boxShadow = isActive
      ? "0 0 0 1px rgba(255,255,255,0.1), 0 0 30px rgba(147,197,253,0.22), 0 12px 28px rgba(0,0,0,0.28)"
      : undefined;
  } else if (variant === "rotational-stagger") {
    extraTranslateX = directionalSign * (1 - revealProgress) * 10.5;
    extraTranslateY = (1 - revealProgress) * 4.4;
    rotateDeg = directionalSign * (1 - revealProgress) * 4.8;
    extraBlur = (1 - revealProgress) * 1.9;
    scaleMultiplier = 1 + (isActive ? 0.014 : 0.004);
  } else if (variant === "letter-wave") {
    extraTranslateY = (1 - revealProgress) * 3.6;
    scaleMultiplier = 1 + (isActive ? 0.014 : 0.004);
  } else {
    extraTranslateY = (1 - revealProgress) * 7.4;
    extraBlur = (1 - revealProgress) * 2.4;
    scaleMultiplier = 1 + (isActive ? 0.016 : 0.006);
  }

  const textShadow = buildPreviewWordTextShadow({
    editorialDecision,
    isActive,
    highlightProgress
  });

  return {
    display: "inline-block",
    opacity,
    transform: `translate3d(${extraTranslateX.toFixed(2)}px, ${(translateY + extraTranslateY).toFixed(2)}px, 0) scale(${(scale * scaleMultiplier).toFixed(3)}) rotate(${rotateDeg.toFixed(2)}deg)`,
    filter: isSettled ? undefined : `blur(${(blur + extraBlur).toFixed(2)}px)`,
    textShadow,
    color: editorialDecision?.textColor ?? (isActive ? "#ffffff" : hasStarted ? "rgba(243,246,255,0.94)" : "rgba(243,246,255,0.86)"),
    textTransform: editorialDecision?.uppercaseBias ? "uppercase" : undefined,
    fontFamily: editorialDecision?.fontFamily,
    fontWeight: editorialDecision?.fontWeight,
    letterSpacing: editorialDecision?.letterSpacing,
    padding,
    borderRadius,
    background,
    boxShadow,
    willChange: isSettled ? undefined : "transform, opacity, filter"
  };
};

const getTwoLineStyle = ({
  lineIndex,
  handoffProgress
}: {
  lineIndex: number;
  handoffProgress: number;
}): CSSProperties => {
  if (lineIndex === 0) {
    const opacity = 1 - handoffProgress * 0.9;
    const translateY = -0.12 * handoffProgress;
    const scale = 1 + handoffProgress * 0.045;
    const blur = handoffProgress * 2.2;

    return {
      position: "absolute",
      left: "50%",
      top: "0em",
      opacity,
      filter: `blur(${blur.toFixed(2)}px)`,
      transform: `translate3d(-50%, ${translateY.toFixed(3)}em, 0) scale(${scale.toFixed(3)})`,
      transformOrigin: "center center",
      willChange: "transform, opacity, filter"
    };
  }

  const baseTopEm = 1.18;
  const translateY = -1.18 * handoffProgress;
  const opacity = 0.92 + handoffProgress * 0.08;

  return {
    position: "absolute",
    left: "50%",
    top: `${baseTopEm.toFixed(3)}em`,
    opacity,
    transform: `translate3d(-50%, ${translateY.toFixed(3)}em, 0)`,
    transformOrigin: "center center",
    willChange: "transform, opacity"
  };
};

const getSingleLineStyle = (): CSSProperties => {
  return {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "baseline",
    gap: "0.14em 0.26em",
    flexWrap: "nowrap"
  };
};

const resolvePreviewSubtitlePhraseProgress = ({
  chunk,
  currentTimeMs
}: {
  chunk: CaptionChunk;
  currentTimeMs: number;
}): {revealProgress: number; settleProgress: number} => {
  const durationMs = Math.max(320, chunk.endMs - chunk.startMs);
  const revealLeadMs = Math.min(220, Math.max(120, durationMs * 0.22));
  const revealWindowMs = Math.min(820, Math.max(340, durationMs * 0.62));

  return {
    revealProgress: easeOutCubic(clamp01((currentTimeMs - (chunk.startMs - revealLeadMs)) / revealWindowMs)),
    settleProgress: easeInOutCubic(clamp01((currentTimeMs - chunk.startMs) / Math.max(220, durationMs * 0.74)))
  };
};

const buildPreviewSubtitleTextShadow = ({
  editorialDecision,
  isEmphasized,
  revealProgress
}: {
  editorialDecision?: CaptionEditorialDecision;
  isEmphasized: boolean;
  revealProgress: number;
}): string => {
  const baseShadow = editorialDecision?.textShadow ??
    "0 4px 12px rgba(0,0,0,0.68), 0 8px 24px rgba(0,0,0,0.24)";
  const layeredGlow = isEmphasized
    ? `0 0 ${Math.round(14 * PREVIEW_SUBTITLE_GLOW_GAIN)}px rgba(255,255,255,0.18), 0 0 ${Math.round(24 * PREVIEW_SUBTITLE_GLOW_GAIN)}px rgba(147,197,253,0.12)`
    : `0 0 ${Math.round(8 * PREVIEW_SUBTITLE_GLOW_GAIN * Math.max(0.35, revealProgress))}px rgba(255,255,255,0.08), 0 0 ${Math.round(14 * PREVIEW_SUBTITLE_GLOW_GAIN * Math.max(0.22, revealProgress))}px rgba(147,197,253,0.05)`;

  return `${layeredGlow}, ${baseShadow}`;
};

const resolvePreviewSubtitleEmphasisIndices = (chunk: CaptionChunk): Set<number> => {
  const emphasisCandidates = [...new Set(
    chunk.emphasisWordIndices.filter((index) => {
      if (index < 0 || index >= chunk.words.length) {
        return false;
      }
      return !isLongformHelperWord(normalizeLongformWord(chunk.words[index]?.text ?? ""));
    })
  )];

  return new Set(emphasisCandidates.slice(0, chunk.words.length >= 5 ? 1 : 2));
};

const getPreviewSubtitlePhraseMotionStyle = ({
  chunk,
  currentTimeMs,
  mode
}: {
  chunk: CaptionChunk;
  currentTimeMs: number;
  mode: PreviewSubtitleAnimationMode;
}): CSSProperties => {
  const {revealProgress, settleProgress} = resolvePreviewSubtitlePhraseProgress({
    chunk,
    currentTimeMs
  });
  const baseTravel = mode === "phrase_stagger_reveal" ? 18 : mode === "word_emphasis_reveal" ? 15 : 12;
  const baseBlur = mode === "phrase_stagger_reveal" ? 4.8 : 3.2;

  return {
    opacity: Math.max(0.18, Math.min(1, 0.2 + revealProgress * 0.82)),
    transform: `translate3d(0, ${(((1 - revealProgress) * baseTravel * PREVIEW_SUBTITLE_ANIMATION_GAIN) - settleProgress * 1.4).toFixed(2)}px, 0) scale(${(0.972 + revealProgress * 0.028).toFixed(3)})`,
    filter: `blur(${((1 - revealProgress) * baseBlur).toFixed(2)}px)`,
    willChange: "transform, opacity, filter"
  };
};

const breathEase = (value: number): number => {
  const t = clamp01(value);
  // Extremely slow start, linear middle, slow end (for "breathing" or "calm" energy)
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
};

const getPreviewSubtitleLineRevealStyle = ({
  line,
  lineIndex,
  chunk,
  currentTimeMs,
  mode,
  editorialDecision
}: {
  line: LongformWordLine;
  lineIndex: number;
  chunk: CaptionChunk;
  currentTimeMs: number;
  mode: PreviewSubtitleAnimationMode;
  editorialDecision?: CaptionEditorialDecision;
}): CSSProperties => {
  const {revealProgress} = resolvePreviewSubtitlePhraseProgress({
    chunk,
    currentTimeMs
  });
  const lineDurationMs = Math.max(220, line.endMs - line.startMs + 160);
  const motionEnergy = editorialDecision?.visualOrchestration?.motionSynchronizationPlan?.typographyMotionEnergy ?? "aggressive";
  const lineProgressRaw = clamp01((currentTimeMs - (line.startMs - 130)) / lineDurationMs);
  
  const lineProgress = mode === "phrase_block_reveal"
    ? (motionEnergy === "calm" ? breathEase(lineProgressRaw) : easeOutCubic(lineProgressRaw))
    : revealProgress;

  const isSettled = lineProgress >= 0.99 && (currentTimeMs - (line.startMs - 130)) > 340;

  if (mode === "phrase_block_reveal") {
    return {
      opacity: Math.max(0.22, lineProgress),
      transform: `translate3d(0, ${((1 - lineProgress) * (10 - Math.min(3, lineIndex) * 1.4) * PREVIEW_SUBTITLE_ANIMATION_GAIN).toFixed(2)}px, 0)`,
      clipPath: isSettled ? undefined : `inset(0 ${(Math.max(0, 1 - lineProgress) * 100).toFixed(2)}% 0 0)`,
      filter: isSettled ? undefined : `blur(${((1 - lineProgress) * (motionEnergy === "calm" ? 1.0 : 2.6)).toFixed(2)}px)`,
      willChange: isSettled ? undefined : "transform, opacity, filter, clip-path"
    };
  }

  return {
    opacity: Math.max(0.9, revealProgress),
    transform: `translate3d(0, ${((1 - revealProgress) * (2.6 + lineIndex * 0.6)).toFixed(2)}px, 0)`,
    willChange: isSettled ? undefined : "transform, opacity"
  };
};

const getPreviewSubtitleWordStyle = ({
  chunk,
  chunkWordIndex,
  currentTimeMs,
  mode,
  isEmphasized,
  editorialDecision
}: {
  chunk: CaptionChunk;
  chunkWordIndex: number;
  currentTimeMs: number;
  mode: PreviewSubtitleAnimationMode;
  isEmphasized: boolean;
  editorialDecision?: CaptionEditorialDecision;
}): CSSProperties => {
  const {revealProgress, settleProgress} = resolvePreviewSubtitlePhraseProgress({
    chunk,
    currentTimeMs
  });
  const durationMs = Math.max(320, chunk.endMs - chunk.startMs);
  const revealLeadMs = Math.min(180, Math.max(110, durationMs * 0.18));
  const direction = chunkWordIndex % 2 === 0 ? -1 : 1;
  const motionEnergy = editorialDecision?.visualOrchestration?.motionSynchronizationPlan?.typographyMotionEnergy ?? "aggressive";
  let wordProgress = revealProgress;
  let wordStartMs = chunk.startMs;

  if (mode === "phrase_stagger_reveal") {
    const staggerMs = clamp(durationMs / Math.max(4, chunk.words.length * 3.2), 34, 70);
    const revealStartMs = chunk.startMs + chunkWordIndex * staggerMs;
    wordStartMs = revealStartMs;
    const progressRaw = clamp01((currentTimeMs - (revealStartMs - revealLeadMs)) / Math.max(180, durationMs * 0.42));
    wordProgress = motionEnergy === "calm" ? breathEase(progressRaw) : easeOutCubic(progressRaw);
  } else if (mode === "word_emphasis_reveal") {
    const staggerMs = isEmphasized ? 44 : 24;
    const emphasisDelayMs = isEmphasized
      ? Math.min(150, 40 + chunkWordIndex * 18)
      : chunkWordIndex * staggerMs;
    wordStartMs = chunk.startMs + emphasisDelayMs;
    const progressRaw = clamp01((currentTimeMs - (wordStartMs - revealLeadMs)) / Math.max(160, durationMs * (isEmphasized ? 0.34 : 0.28)));
    wordProgress = motionEnergy === "calm" ? breathEase(progressRaw) : easeOutCubic(progressRaw);
  }

  const isSettled = wordProgress >= 0.99 && (currentTimeMs - (wordStartMs - revealLeadMs)) > 340;

  const baseTravelY = mode === "phrase_stagger_reveal"
    ? 16
    : mode === "word_emphasis_reveal"
      ? (isEmphasized ? 13 : 10)
      : 8;
  const travelY = motionEnergy === "calm" ? baseTravelY * 0.4 : baseTravelY;
  const physicsAggression = editorialDecision?.stylePhysics.motion.motionAggression ?? 1.0;
  const translateY = ((1 - wordProgress) * travelY * physicsAggression * PREVIEW_SUBTITLE_ANIMATION_GAIN - settleProgress * (isEmphasized ? 1.3 : 0.8)) / (editorialDecision?.stylePhysics.motion.damping ?? 1.0);
  
  const baseTranslateX = mode === "phrase_stagger_reveal"
    ? direction * (1 - wordProgress) * 6.2 * PREVIEW_SUBTITLE_ANIMATION_GAIN
    : isEmphasized
      ? direction * (1 - wordProgress) * 2.4
      : 0;
  const translateX = (motionEnergy === "calm" ? baseTranslateX * 0.2 : baseTranslateX) * physicsAggression;
      
  const rotateDeg = (mode === "phrase_stagger_reveal"
    ? direction * (1 - wordProgress) * 2.8
    : isEmphasized
      ? direction * (1 - wordProgress) * 1.4
      : 0) * physicsAggression;
      
  const baseBlurPx = (1 - wordProgress) * (
    mode === "phrase_stagger_reveal"
      ? 4.8
      : mode === "word_emphasis_reveal"
        ? (isEmphasized ? 4.2 : 2.8)
        : 2.4
  );
  const blurPx = (motionEnergy === "calm" ? baseBlurPx * 0.2 : baseBlurPx) * (editorialDecision?.stylePhysics.motion.blurRelease ?? 1.0) / 4.0; 

  const emphasisCapsule = mode === "word_emphasis_reveal" && isEmphasized;

  return {
    display: "inline-flex",
    alignItems: "baseline",
    opacity: Math.max(0.18, Math.min(1, (0.14 + wordProgress * 0.9) * (editorialDecision?.stylePhysics.motion.opacityAcceleration ?? 1.0))),
    transform: `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px, 0) scale(${(0.972 + wordProgress * 0.028 + (isEmphasized ? revealProgress * 0.024 : 0)).toFixed(3)}) rotate(${rotateDeg.toFixed(2)}deg)`,
    filter: isSettled ? undefined : `blur(${blurPx.toFixed(2)}px)`,
    transition: `all ${editorialDecision?.stylePhysics.motion.durationMs}ms ${editorialDecision?.stylePhysics.motion.easing}`,
    color: editorialDecision?.textColor ?? "#f7f9ff",
    textShadow: buildPreviewSubtitleTextShadow({
      editorialDecision,
      isEmphasized,
      revealProgress: wordProgress
    }),
    fontFamily: editorialDecision?.fontFamily,
    fontWeight: editorialDecision?.fontWeight,
    letterSpacing: editorialDecision?.letterSpacing,
    textTransform: editorialDecision?.uppercaseBias ? "uppercase" : undefined,
    padding: emphasisCapsule ? "0.04em 0.18em 0.08em" : undefined,
    borderRadius: emphasisCapsule ? "0.34em" : undefined,
    background: emphasisCapsule
      ? "linear-gradient(135deg, rgba(72, 94, 255, 0.22), rgba(10, 14, 26, 0.08))"
      : undefined,
    boxShadow: emphasisCapsule
      ? "0 0 0 1px rgba(255,255,255,0.06), 0 0 20px rgba(147,197,253,0.14), 0 8px 18px rgba(0,0,0,0.22)"
      : undefined,
    willChange: isSettled ? undefined : "transform, opacity, filter"
  };
};

const getCueSignature = (cue: MotionShowcaseCue): string => `${cue.assetId}|${cue.matchedText}|${cue.matchedStartMs}`;

const getCueAnchorLiftEm = (cue: MotionShowcaseCue): number => {
  const label = cue.canonicalLabel.toLowerCase();
  if (label === "home") {
    return 0.45;
  }
  if (label === "thinking") {
    return 0.58;
  }
  if (label === "calendar") {
    return 0.64;
  }
  if (label === "camera") {
    return 0.72;
  }
  if (label === "mortarboard" || label === "expert") {
    return 0.68;
  }
  if (label === "money" || label === "bill" || label === "coin") {
    return 0.82;
  }
  return 0.66;
};

const getCueFilter = (cue: MotionShowcaseCue): string => {
  const label = cue.canonicalLabel.toLowerCase();
  if (label === "thinking") {
    return "brightness(1.05) contrast(1.08) saturate(1.06) drop-shadow(0 22px 36px rgba(0,0,0,0.42))";
  }
  if (label === "home") {
    return "brightness(1.06) contrast(1.1) saturate(1.03) drop-shadow(0 28px 42px rgba(0,0,0,0.46))";
  }
  return "brightness(1.07) contrast(1.14) saturate(1.05) drop-shadow(0 24px 38px rgba(0,0,0,0.48))";
};

const getCueWidthEm = (cue: MotionShowcaseCue): number => {
  const label = cue.canonicalLabel.toLowerCase();
  if (label === "home") {
    return 3.2;
  }
  if (label === "thinking") {
    return 1.85;
  }
  if (label === "calendar") {
    return 1.95;
  }
  if (label === "camera") {
    return 2.15;
  }
  if (label === "mortarboard" || label === "expert") {
    return 2;
  }
  if (label === "money" || label === "bill" || label === "coin") {
    return 1.85;
  }
  return 2.05;
};

const getCueFallbackPlacement = (cue: MotionShowcaseCue): CSSProperties => {
  if (cue.placement === "landscape-left") {
    return {left: "22%", top: "56%"};
  }
  if (cue.placement === "landscape-right") {
    return {left: "78%", top: "56%"};
  }
  if (cue.placement === "portrait-top-left") {
    return {left: "24%", top: "24%"};
  }
  if (cue.placement === "portrait-top-right") {
    return {left: "76%", top: "24%"};
  }
  if (cue.placement === "portrait-bottom-left") {
    return {left: "24%", top: "72%"};
  }
  if (cue.placement === "portrait-bottom-right") {
    return {left: "76%", top: "72%"};
  }
  return {left: "50%", top: "42%"};
};

const findCueChunk = ({
  chunks,
  cue
}: {
  chunks: CaptionChunk[];
  cue: MotionShowcaseCue;
}): CaptionChunk | null => {
  return chunks.find((chunk) => {
    return cue.matchedStartMs >= chunk.startMs - 40 && cue.matchedEndMs <= chunk.endMs + 80;
  }) ?? null;
};

const cueWordMatches = (word: TranscribedWord, cue: MotionShowcaseCue): boolean => {
  return (
    word.startMs === cue.matchedStartMs &&
    normalizeLongformWord(word.text) === normalizeLongformWord(cue.matchedText)
  );
};

const findCueWord = ({
  chunk,
  cue
}: {
  chunk: CaptionChunk;
  cue: MotionShowcaseCue;
}): TranscribedWord | null => {
  const rangeWords = chunk.words.filter((word) => {
    return word.startMs >= cue.matchedStartMs && word.endMs <= cue.matchedEndMs + 20;
  });
  const bestRangeWord = rangeWords.find((word) => !/\d/.test(word.text)) ?? rangeWords[0];

  if (bestRangeWord) {
    return bestRangeWord;
  }

  return chunk.words.find((word) => cueWordMatches(word, cue))
    ?? chunk.words.find((word) => word.startMs === cue.matchedStartMs)
    ?? chunk.words.find((word) => normalizeLongformWord(cue.matchedText).includes(normalizeLongformWord(word.text)))
    ?? null;
};

const getCameraMotionState = ({
  model,
  currentTimeMs,
  previewPerformanceMode
}: {
  model: MotionCompositionModel;
  currentTimeMs: number;
  previewPerformanceMode: PreviewPerformanceMode;
}): {scale: number; translateX: number; translateY: number} => {
  if (previewPerformanceMode === "turbo") {
    return {
      scale: 1,
      translateX: 0,
      translateY: 0
    };
  }

  if (model.motion3DPlan.enabled) {
    const choreographyScene = selectActiveMotionChoreographySceneAtTime({
      plan: model.choreographyPlan,
      currentTimeMs
    });
    if (choreographyScene) {
      const stage = resolveMotionChoreographySceneStateAtTime({
        scene: choreographyScene,
        currentTimeMs
      }).stageTransform;
      return {
        scale: stage.scale,
        translateX: stage.translateX,
        translateY: stage.translateY
      };
    }
  }

  const cue = selectActiveCameraCueAtTime({
    cameraCues: model.cameraCues,
    currentTimeMs
  });

  if (!cue || cue.mode === "none") {
    return {
      scale: 1,
      translateX: 0,
      translateY: 0
    };
  }
  const timingDefinition = getZoomTimingFamilyDefinition(cue.timingFamily);

  if (currentTimeMs <= cue.peakStartMs) {
    const progress = easeCameraValue(
      timingDefinition.easeIn,
      (currentTimeMs - cue.startMs) / Math.max(1, cue.zoomInMs)
    );
    return {
      scale: lerp(1, cue.peakScale, progress),
      translateX: lerp(0, cue.panX, progress),
      translateY: lerp(0, cue.panY, progress)
    };
  }

  if (currentTimeMs <= cue.peakEndMs) {
    return {
      scale: cue.peakScale,
      translateX: cue.panX,
      translateY: cue.panY
    };
  }

  const progress = easeCameraValue(
    timingDefinition.easeOut,
    (currentTimeMs - cue.peakEndMs) / Math.max(1, cue.zoomOutMs)
  );
  return {
    scale: lerp(cue.peakScale, 1, progress),
    translateX: lerp(cue.panX, 0, progress),
    translateY: lerp(cue.panY, 0, progress)
  };
};

const getSceneTransitionState = ({
  scene,
  currentTimeMs,
  fps
}: {
  scene: ResolvedMotionScene;
  currentTimeMs: number;
  fps: number;
}) => {
  const budgetMs = (scene.transitionBudgetFrames / fps) * 1000;
  const entryProgress = budgetMs <= 0
    ? 1
    : clamp01((currentTimeMs - (scene.startMs - budgetMs)) / budgetMs);
  const exitProgress = budgetMs <= 0
    ? 0
    : clamp01((currentTimeMs - scene.endMs) / budgetMs);
  return {
    entryProgress: easeOutCubic(entryProgress),
    exitProgress: easeInOutCubic(exitProgress),
    visibility: clamp01(entryProgress * (1 - exitProgress))
  };
};

const getClipPath = (
  mode: ResolvedMotionScene["transitionInPreset"]["entryRules"]["clipMode"],
  progress: number
): string | undefined => {
  const p = clamp01(progress);
  if (mode === "left-to-right") {
    return `inset(0 ${100 - p * 100}% 0 0)`;
  }
  if (mode === "center-out") {
    const inset = Math.max(0, 50 - p * 50);
    return `inset(0 ${inset}% 0 ${inset}%)`;
  }
  if (mode === "top-down") {
    return `inset(0 0 ${100 - p * 100}% 0)`;
  }
  if (mode === "bottom-up") {
    return `inset(${100 - p * 100}% 0 0 0)`;
  }
  return undefined;
};

const getMotionAssetPlacementStyle = (asset: MotionAssetManifest): CSSProperties => {
  if (asset.placementZone === "edge-frame") {
    return {position: "absolute", inset: 0};
  }
  if (asset.placementZone === "side-panels") {
    return {position: "absolute", inset: "0 0 0 0"};
  }
  if (asset.placementZone === "lower-third") {
    return {position: "absolute", inset: "52% -4% -6% -4%"};
  }
  if (asset.placementZone === "foreground-cross") {
    return {position: "absolute", inset: "0 -5% -2% -5%"};
  }
  if (asset.placementZone === "background-depth") {
    return {position: "absolute", inset: "-4%"};
  }
  return {position: "absolute", inset: 0};
};

const getMotionAssetLife = ({
  asset,
  scene,
  currentTimeMs,
  fps
}: {
  asset: MotionAssetManifest;
  scene: ResolvedMotionScene;
  currentTimeMs: number;
  fps: number;
}): number => {
  const {entryProgress, exitProgress, visibility} = getSceneTransitionState({scene, currentTimeMs, fps});
  const budgetMs = (scene.transitionBudgetFrames / fps) * 1000;
  if (asset.durationPolicy === "entry-only") {
    const entryTail = scene.startMs + budgetMs * 1.5;
    const tailProgress = currentTimeMs <= entryTail ? 1 : 1 - clamp01((currentTimeMs - entryTail) / Math.max(1, budgetMs));
    return clamp01(entryProgress * tailProgress);
  }
  if (asset.durationPolicy === "exit-only") {
    return clamp01(exitProgress);
  }
  if (asset.durationPolicy === "ping-pong") {
    const sceneProgress = clamp01((currentTimeMs - scene.startMs) / Math.max(1, scene.endMs - scene.startMs));
    return visibility * (0.72 + Math.sin(sceneProgress * Math.PI) * 0.28);
  }
  return visibility;
};

const isVideoLikeAsset = (src: string): boolean => /\.(mp4|webm|ogg|m4v|mov)$/i.test(src);

const NativeMotionGraphicsDecisionItem: React.FC<{
  decision: MotionGraphicsDecision;
  selectedAsset: MotionGraphicsDecisionAsset;
  currentTimeMs: number;
  fps: number;
  outputWidth: number;
  outputHeight: number;
  videoIsPlaying: boolean;
  videoPlaybackRate: number;
}> = ({
  decision,
  selectedAsset,
  currentTimeMs,
  fps,
  outputWidth,
  outputHeight,
  videoIsPlaying,
  videoPlaybackRate
}) => {
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const asset = selectedAsset.asset;

  useEffect(() => {
    if (!asset || !isVideoLikeMotionGraphic(asset.src) || !mediaRef.current) {
      return;
    }

    const video = mediaRef.current;
    const startMs = (selectedAsset.startFrame / fps) * 1000;
    const relativeSeconds = Math.max(0, (currentTimeMs - startMs) / 1000);
    if (Number.isFinite(video.duration) && video.duration > 0) {
      const desiredTime = asset.loopable
        ? relativeSeconds % video.duration
        : Math.min(relativeSeconds, Math.max(0, video.duration - 0.05));
      if (Math.abs(video.currentTime - desiredTime) > 0.24) {
        video.currentTime = desiredTime;
      }
    }
    video.playbackRate = videoPlaybackRate;
    if (!videoIsPlaying) {
      if (!video.paused) {
        video.pause();
      }
      return;
    }
    if (video.paused) {
      void video.play().catch(() => {
        // Decorative motion assets should never break the preview if autoplay is blocked.
      });
    }
  }, [asset, currentTimeMs, fps, selectedAsset.endFrame, selectedAsset.startFrame, videoIsPlaying, videoPlaybackRate]);

  if (!asset) {
    return null;
  }

  if (!shouldRenderPreviewOverlayAsset(asset)) {
    return null;
  }

  const placement = resolveMotionDecisionAssetPlacement({
    selectedAsset,
    decision
  });
  const visibility = resolveMotionDecisionVisibility({
    selectedAsset,
    currentTimeMs,
    fps
  });
  if (visibility.opacity <= 0.005) {
    return null;
  }

  const resolvedWidth = (placement.widthPercent / 100) * outputWidth;
  const resolvedHeight = (placement.heightPercent / 100) * outputHeight;
  const objectFit = resolveMotionDecisionObjectFit(selectedAsset);
  const resolvedSrc = resolveCueAssetSrc(asset.src);

  return (
    <div
      style={{
        position: "absolute",
        left: `${placement.leftPercent}%`,
        top: `${placement.topPercent}%`,
        width: resolvedWidth,
        height: resolvedHeight,
        transform: `translate3d(calc(-50% + ${visibility.translateX.toFixed(2)}px), calc(-50% + ${visibility.translateY.toFixed(2)}px), 0) scale(${visibility.scale.toFixed(3)}) rotate(${(selectedAsset.rotation ?? 0).toFixed(3)}deg)`,
        transformOrigin: "center center",
        opacity: visibility.opacity,
        mixBlendMode: (selectedAsset.blendMode ?? asset.blendMode) as CSSProperties["mixBlendMode"],
        zIndex: resolveMotionDecisionZIndex(selectedAsset.role),
        pointerEvents: "none"
      }}
      data-motion-role={selectedAsset.role}
      data-motion-asset-id={selectedAsset.assetId}
      data-motion-rationale={selectedAsset.rationale}
    >
      {isIframeMotionGraphic(asset) ? (
        <iframe
          src={resolvedSrc}
          title={asset.canonicalLabel ?? asset.id}
          sandbox="allow-same-origin allow-scripts"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            background: "transparent"
          }}
        />
      ) : isVideoLikeMotionGraphic(asset.src) ? (
        <video
          ref={mediaRef}
          src={resolvedSrc}
          muted
          loop={asset.loopable}
          preload="auto"
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit
          }}
        />
      ) : (
        <img
          src={resolvedSrc}
          alt=""
          loading="eager"
          decoding="async"
          style={{
            width: "100%",
            height: "100%",
            objectFit
          }}
        />
      )}
    </div>
  );
};

const NativeMotionAssetOverlay: React.FC<{
  activeScene: ResolvedMotionScene;
  activeDecision?: MotionGraphicsDecision | null;
  currentTimeMs: number;
  fps: number;
  outputWidth: number;
  outputHeight: number;
  videoIsPlaying: boolean;
  videoPlaybackRate: number;
  choreographyState?: MotionChoreographySceneState | null;
  choreography3DEnabled?: boolean;
}> = ({
  activeScene,
  activeDecision,
  currentTimeMs,
  fps,
  outputWidth,
  outputHeight,
  videoIsPlaying,
  videoPlaybackRate,
  choreographyState,
  choreography3DEnabled = false
}) => {
  const decisionAssets = activeDecision?.selectedAssets ?? [];
  const renderLegacyAssets = decisionAssets.length === 0;

  return (
    <div
      className="preview-native-motion-assets"
      style={{
        transform: choreographyState
          ? `translate3d(${choreographyState.stageTransform.translateX.toFixed(2)}px, ${choreographyState.stageTransform.translateY.toFixed(2)}px, 0) scale(${choreographyState.stageTransform.scale.toFixed(3)})`
          : undefined,
        transformOrigin: "center center",
        opacity: choreographyState?.stageTransform.opacity ?? 1
      }}
    >
      {decisionAssets.map((selectedAsset) => (
        <NativeMotionGraphicsDecisionItem
          key={`${activeScene.id}-${selectedAsset.role}-${selectedAsset.assetId}`}
          decision={activeDecision as MotionGraphicsDecision}
          selectedAsset={selectedAsset}
          currentTimeMs={currentTimeMs}
          fps={fps}
          outputWidth={outputWidth}
          outputHeight={outputHeight}
          videoIsPlaying={videoIsPlaying}
          videoPlaybackRate={videoPlaybackRate}
        />
      ))}
      {renderLegacyAssets ? activeScene.assets.map((asset) => {
        if (!shouldRenderPreviewOverlayAsset(asset)) {
          return null;
        }
        const binding = choreographyState?.scene.layerBindings.find((candidate) => candidate.sourceAssetId === asset.id);
        if (binding?.depthTreatment === "depth-worthy" && choreography3DEnabled) {
          return null;
        }
        const {entryProgress, exitProgress} = getSceneTransitionState({
          scene: activeScene,
          currentTimeMs,
          fps
        });
        const entryRules = activeScene.transitionInPreset.entryRules;
        const exitRules = activeScene.transitionOutPreset.exitRules;
        const entryWeight = 1 - exitProgress;
        const exitWeight = exitProgress;
        const blendedProgress = clamp01(entryProgress * (1 - exitProgress));
        const life = getMotionAssetLife({
          asset,
          scene: activeScene,
          currentTimeMs,
          fps
        });
        const choreographyTransform: MotionTransformValue | null = binding
          ? choreographyState?.targetTransforms[binding.targetId] ?? null
          : null;
        const translateX = lerp(entryRules.translateXFrom, entryRules.translateXTo, entryProgress) * entryWeight +
          lerp(exitRules.translateXFrom, exitRules.translateXTo, exitProgress) * exitWeight;
        const translateY = lerp(entryRules.translateYFrom, entryRules.translateYTo, entryProgress) * entryWeight +
          lerp(exitRules.translateYFrom, exitRules.translateYTo, exitProgress) * exitWeight;

        return (
          <div
            key={`${activeScene.id}-${asset.id}`}
            style={{
              ...getMotionAssetPlacementStyle(asset),
              opacity: choreographyTransform ? asset.opacity * choreographyTransform.opacity : asset.opacity * life,
              transform: choreographyTransform
                ? `translate3d(${choreographyTransform.translateX.toFixed(2)}px, ${choreographyTransform.translateY.toFixed(2)}px, 0) scale(${(choreographyTransform.scale * (1 + choreographyTransform.depth * 0.00065)).toFixed(3)}) rotate(${choreographyTransform.rotateDeg.toFixed(3)}deg)`
                : `translate3d(${translateX}px, ${translateY}px, 0) scale(${lerp(0.985, 1.01, blendedProgress)})`,
              mixBlendMode: asset.blendMode as CSSProperties["mixBlendMode"],
              filter: choreographyTransform
                ? `blur(${choreographyTransform.blurPx.toFixed(2)}px)`
                : asset.family === "flare"
                  ? "blur(2px)"
                  : undefined,
              clipPath: getClipPath(activeScene.transitionInPreset.entryRules.clipMode, blendedProgress),
              pointerEvents: "none"
            }}
          >
            <img
              src={resolveCueAssetSrc(asset.src)}
              alt=""
              className="preview-native-motion-asset-image"
              loading="eager"
              decoding="async"
            />
          </div>
        );
      }) : null}
    </div>
  );
};

const NativeBackgroundOverlay: React.FC<{
  cue: MotionCompositionModel["backgroundOverlayPlan"]["cues"][number];
  currentTimeMs: number;
  fps: number;
  videoIsPlaying: boolean;
  videoPlaybackRate: number;
  outputWidth: number;
  outputHeight: number;
  captionBias: CaptionVerticalBias;
}> = ({cue, currentTimeMs, fps, videoIsPlaying, videoPlaybackRate, outputWidth, outputHeight, captionBias}) => {
  const overlayVideoRef = useRef<HTMLVideoElement | null>(null);
  const visual = resolveBackgroundOverlayRenderState({
    cue,
    currentTimeMs,
    outputWidth,
    outputHeight,
    captionBias
  });
  const overlaySrc = resolveCueAssetSrc(cue.asset.src);
  const overlayIsVideo = isVideoLikeAsset(overlaySrc);

  useEffect(() => {
    if (!overlayIsVideo || !overlayVideoRef.current) {
      return;
    }

    const clipStartSeconds = cue.trimBeforeFrames / fps;
    const clipDurationSeconds = Math.max(0, (cue.trimAfterFrames - cue.trimBeforeFrames) / fps);
    const desiredCueSeconds = clamp((currentTimeMs - cue.startMs) / 1000, 0, clipDurationSeconds);
    const desiredOverlaySeconds = clipStartSeconds + desiredCueSeconds;
    const isActive = currentTimeMs >= cue.startMs && currentTimeMs <= cue.endMs;
    const video = overlayVideoRef.current;
    video.playbackRate = videoPlaybackRate;

    if (Math.abs(video.currentTime - desiredOverlaySeconds) > 0.18) {
      video.currentTime = desiredOverlaySeconds;
    }

    if (!isActive || !videoIsPlaying) {
      if (!video.paused) {
        video.pause();
      }
      return;
    }

    if (video.paused) {
      void video.play().catch(() => {
        // Muted overlays are usually allowed, but ignore failures defensively.
      });
    }
  }, [cue, currentTimeMs, fps, overlayIsVideo, videoIsPlaying, videoPlaybackRate]);

  return (
    <div className="preview-native-background-overlay" style={{position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none"}}>
      <div
        className="preview-native-background-veil"
        style={{
          background: visual.veilGradient,
          opacity: visual.veilOpacity
        }}
      />
      <div
        className="preview-native-background-halo"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: visual.haloWidth,
          height: visual.haloHeight,
          transform: `translate3d(calc(-50% + ${visual.haloOffsetX.toFixed(2)}px), calc(-50% + ${visual.haloOffsetY.toFixed(2)}px), 0) rotate(${cue.fitStrategy.rotateDeg}deg)`,
          transformOrigin: "center center",
          background: visual.haloGradient,
          filter: `blur(${PREVIEW_BACKGROUND_HALO_BLUR_PX}px)`,
          opacity: visual.haloOpacity,
          mixBlendMode: visual.glowBlendMode
        }}
      />
      <div
        className="preview-native-background-media"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: visual.mediaWidth,
          height: visual.mediaHeight,
          transform: `translate3d(calc(-50% + ${visual.mediaOffsetX.toFixed(2)}px), calc(-50% + ${visual.mediaOffsetY.toFixed(2)}px), 0) rotate(${cue.fitStrategy.rotateDeg}deg)`,
          opacity: visual.visibility,
          filter: visual.mediaFilter,
          willChange: "transform, opacity, filter"
        }}
      >
        {overlayIsVideo ? (
          <video
            ref={overlayVideoRef}
            className="preview-native-background-video"
            src={overlaySrc}
            muted
            preload="auto"
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }}
          />
        ) : (
          <img
            src={overlaySrc}
            alt=""
            className="preview-native-background-image"
            loading="eager"
            decoding="async"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }}
          />
        )}
      </div>
      <div
        className="preview-native-background-grain"
        style={{
          position: "absolute",
          inset: 0,
          background: visual.grainGradient,
          opacity: visual.grainOpacity,
          mixBlendMode: "soft-light"
        }}
      />
    </div>
  );
};

const NativeTransitionOverlay: React.FC<{
  cue: MotionCompositionModel["transitionOverlayPlan"]["cues"][number];
  currentTimeMs: number;
  fps: number;
  videoIsPlaying: boolean;
  videoPlaybackRate: number;
}> = ({cue, currentTimeMs, fps, videoIsPlaying, videoPlaybackRate}) => {
  const overlayVideoRef = useRef<HTMLVideoElement | null>(null);
  const visibility = getTransitionOverlayVisibility({cue, currentTimeMs});
  const driftScale = transitionLerp(1.01, 1, visibility) * transitionLerp(
    1,
    1.006,
    clampTransition01((currentTimeMs - cue.peakEndMs) / Math.max(1, cue.endMs - cue.peakEndMs))
  );
  const renderWidth = cue.asset.width * cue.fitStrategy.coverScale * cue.fitStrategy.overlayScale * driftScale;
  const renderHeight = cue.asset.height * cue.fitStrategy.coverScale * cue.fitStrategy.overlayScale * driftScale;
  const overlaySrc = resolveCueAssetSrc(cue.asset.src);
  const overlayIsVideo = isVideoLikeAsset(overlaySrc);

  useEffect(() => {
    if (!overlayIsVideo || !overlayVideoRef.current) {
      return;
    }

    const clipStartSeconds = cue.trimBeforeFrames / fps;
    const clipDurationSeconds = Math.max(0, (cue.trimAfterFrames - cue.trimBeforeFrames) / fps);
    const desiredCueSeconds = clamp((currentTimeMs - cue.startMs) / 1000, 0, clipDurationSeconds);
    const desiredOverlaySeconds = clipStartSeconds + desiredCueSeconds;
    const isActive = currentTimeMs >= cue.startMs && currentTimeMs <= cue.endMs;
    const video = overlayVideoRef.current;
    video.playbackRate = videoPlaybackRate;

    if (Math.abs(video.currentTime - desiredOverlaySeconds) > 0.18) {
      video.currentTime = desiredOverlaySeconds;
    }

    if (!isActive || !videoIsPlaying) {
      if (!video.paused) {
        video.pause();
      }
      return;
    }

    if (video.paused) {
      void video.play().catch(() => {
        // Overlay playback failures should never break the stage.
      });
    }
  }, [cue, currentTimeMs, fps, overlayIsVideo, videoIsPlaying, videoPlaybackRate]);

  return (
    <div
      className="preview-native-transition-overlay"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 8,
        pointerEvents: "none",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, rgba(4, 6, 12, ${(0.08 + visibility * 0.06).toFixed(3)}), rgba(4, 6, 12, ${(0.04 + visibility * 0.035).toFixed(3)}))`
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: renderWidth,
          height: renderHeight,
          transform: `translate3d(-50%, -50%, 0) rotate(${cue.fitStrategy.rotateDeg}deg)`,
          transformOrigin: "center center",
          opacity: visibility * cue.peakOpacity,
          mixBlendMode: resolveTransitionOverlayBlendMode(cue.blendMode),
          willChange: "transform, opacity"
        }}
      >
        {overlayIsVideo ? (
          <video
            ref={overlayVideoRef}
            className="preview-native-transition-video"
            src={overlaySrc}
            muted
            preload="auto"
            playsInline
            style={{
              width: renderWidth,
              height: renderHeight,
              objectFit: "cover",
              filter: "saturate(1.04) contrast(1.05)",
              opacity: 0.99
            }}
          />
        ) : (
          <img
            src={overlaySrc}
            alt=""
            className="preview-native-transition-image"
            loading="eager"
            decoding="async"
            style={{
              width: renderWidth,
              height: renderHeight,
              objectFit: "cover",
              filter: "saturate(1.04) contrast(1.05)",
              opacity: 0.99
            }}
          />
        )}
      </div>
    </div>
  );
};

const NativeShowcaseOverlay: React.FC<{
  activeCue: MotionShowcaseCue;
  model: MotionCompositionModel;
  currentTimeMs: number;
  previewViewportScale: number;
}> = ({activeCue, model, currentTimeMs, previewViewportScale}) => {
  const cueChunk = useMemo(() => findCueChunk({chunks: model.chunks, cue: activeCue}), [activeCue, model.chunks]);
  const cueWord = useMemo(() => {
    if (!cueChunk) {
      return null;
    }
    return findCueWord({chunk: cueChunk, cue: activeCue});
  }, [activeCue, cueChunk]);
  const preparedLandscapeAnchor = useMemo(() => {
    if (model.showcasePlan.layoutMode !== "landscape-callout" || !cueChunk || !cueWord) {
      return null;
    }

    const lines = splitLongformWordsIntoLines(cueChunk.words);
    const anchor = findLongformWordAnchor({lines, word: cueWord});
    if (!anchor) {
      return null;
    }

    return {
      leftPercent: 50 + (anchor.centerRatio - 0.5) * 46,
      lineIndex: anchor.lineIndex,
      secondLineStartMs: lines[1]?.startMs ?? null
    };
  }, [activeCue, cueChunk, cueWord, model.showcasePlan.layoutMode]);

  const enterProgress = easeOutCubic(
    (currentTimeMs - activeCue.startMs) / Math.max(1, activeCue.peakStartMs - activeCue.startMs)
  );
  const exitProgress = easeInOutCubic(
    (currentTimeMs - activeCue.peakEndMs) / Math.max(1, activeCue.endMs - activeCue.peakEndMs)
  );
  const visibility = clamp01(enterProgress * (1 - exitProgress));
  const travel = lerp(20, 0, enterProgress) - exitProgress * 10;
  const scale = lerp(0.82, 1.02, enterProgress) * lerp(1, 0.97, exitProgress);
  const rotationSeed = hashString(getCueSignature(activeCue)) % 17;
  const direction = rotationSeed % 2 === 0 ? -1 : 1;
  const settleRotation = direction * (activeCue.canonicalLabel.toLowerCase() === "thinking" ? 6 : 9);
  const rotation = lerp(settleRotation + direction * 16, settleRotation, enterProgress) * lerp(1, 0.5, exitProgress);
  const handoffProgress = preparedLandscapeAnchor?.secondLineStartMs !== null &&
    preparedLandscapeAnchor?.secondLineStartMs !== undefined
    ? getLongformLineHandoffProgress({
      secondLineStartMs: preparedLandscapeAnchor.secondLineStartMs,
      currentTimeMs
    })
    : 0;
  const landscapeAnchorStyle = preparedLandscapeAnchor
    ? {
      left: `${preparedLandscapeAnchor.leftPercent}%`,
      top: `calc(${preparedLandscapeAnchor.lineIndex === 0
        ? 68 - handoffProgress * 8
        : 86 - handoffProgress * 20}% - ${activeCue.cueSource === "direct-asset" ? getCueAnchorLiftEm(activeCue) : 0.38}em)`
    }
    : null;
  const cueAssetSrc = activeCue.cueSource === "direct-asset"
    ? resolveCueAssetSrc(activeCue.asset.src)
    : null;
  const safeCueLabel = sanitizeRenderableOverlayText(activeCue.canonicalLabel);
  if (activeCue.cueSource === "direct-asset" && (!shouldRenderPreviewOverlayAsset(activeCue.asset) || !safeCueLabel)) {
    return null;
  }
  if (activeCue.cueSource !== "direct-asset" && !safeCueLabel) {
    return null;
  }
  const canRenderAssetImage = cueAssetSrc !== null && !/\.(mp4|webm|mov)$/i.test(cueAssetSrc);
  const showcaseSchemaRoute = useMemo(() => resolveSchemaStageEffectRoute({
    text: `${activeCue.canonicalLabel} ${activeCue.reason ?? ""}`.trim()
  }), [activeCue.canonicalLabel, activeCue.reason]);
  const directAssetMaxWidth = showcaseSchemaRoute.renderTreatment === "glass-card" || showcaseSchemaRoute.renderTreatment === "quote-card"
    ? "18%"
    : showcaseSchemaRoute.renderTreatment === "data-template"
      ? "17%"
      : activeCue.canonicalLabel.toLowerCase() === "home"
        ? "22%"
        : "14%";
  const showcaseFontSizePx = Math.round(clamp(64 * previewViewportScale, 22, 84));

  return (
    <div className="preview-native-overlay preview-native-overlay--showcase">
      <div
        style={
          landscapeAnchorStyle
            ? {
              ...getCaptionContainerStyle(upperSafeZone, model.captionBias),
              position: "absolute",
              fontSize: `${showcaseFontSizePx}px`,
              lineHeight: 1.04,
              letterSpacing: "-0.02em"
            }
            : {
              position: "absolute",
              inset: 0
            }
        }
        >
          <div
            style={{
              position: "absolute",
              transformOrigin: "center center",
              ...(landscapeAnchorStyle ?? getCueFallbackPlacement(activeCue))
            }}
          >
            {activeCue.cueSource === "direct-asset" ? (
              <div
                style={{
                  position: "relative",
                  width: `${getCueWidthEm(activeCue)}em`,
                  maxWidth: directAssetMaxWidth,
                  minWidth: activeCue.canonicalLabel.toLowerCase() === "thinking" ? "84px" : "110px",
                  opacity: visibility,
                  transform: `translate3d(-50%, -22%, 0) translateY(${travel}px) scale(${scale}) rotate(${rotation}deg)`,
                  willChange: "transform, opacity",
                  pointerEvents: "none"
                }}
                data-schema-showcase-route={showcaseSchemaRoute.reasoning}
              >
                {canRenderAssetImage ? (
                  <StageOverlayAsset
                    src={cueAssetSrc}
                    alt={safeCueLabel}
                    fitMode={showcaseSchemaRoute.preferAssetContain ? "contain" : "cover"}
                    filter={getCueFilter(activeCue)}
                  />
                ) : (
                  <div className="preview-native-showcase-fallback">
                    {safeCueLabel}
                  </div>
                )}
                {activeCue.showLabelPlate ? (
                  <div className="preview-native-showcase-label">
                    {safeCueLabel}
                  </div>
                ) : null}
              </div>
            ) : (
              <SemanticSidecallCueVisual
                cue={activeCue}
                visibility={visibility}
                translateY={travel}
                scale={scale}
                rotation={rotation}
              />
            )}
          </div>
        </div>
      </div>
  );
};

const NativeCaptionOverlay: React.FC<{
  currentTimeMs: number;
  videoMetadata: Pick<VideoMetadata, "width" | "height" | "fps">;
  chunks: CaptionChunk[];
  captionProfileId: CaptionStyleProfileId;
  captionBias: MotionCompositionModel["captionBias"];
  model: MotionCompositionModel;
  previewViewportScale: number;
  suppressCaptions?: boolean;
}> = ({currentTimeMs, videoMetadata, chunks, captionProfileId, captionBias, model, previewViewportScale, suppressCaptions = false}) => {
  if (suppressCaptions) {
    return null;
  }

  const preparedChunks = useMemo(() => buildPreparedChunks(chunks), [chunks]);
  const activeChunk = useMemo(() => selectLongformActiveChunk(chunks, currentTimeMs), [chunks, currentTimeMs]);
  const activeChunkPresentation = activeChunk ? preparedChunks.get(activeChunk.id) ?? null : null;
  const lines = activeChunkPresentation?.lines ?? [];
  const editorialContext = useMemo(() => ({
    gradeProfile: model.gradeProfile,
    backgroundOverlayPlan: model.backgroundOverlayPlan,
    captionBias,
    motionTier: model.tier,
    compositionCombatPlan: model.compositionCombatPlan
  }), [captionBias, model.backgroundOverlayPlan, model.compositionCombatPlan, model.gradeProfile, model.tier]);
  const captionRenderMode = useMemo(
    () => getLongformCaptionRenderModeForChunk(captionProfileId, activeChunk, editorialContext),
    [activeChunk, captionProfileId, editorialContext]
  );
  const editorialDecision = useMemo(() => {
    const chunk = activeChunk ?? chunks[0];
    if (!chunk) {
      return resolveCaptionEditorialDecision({
        chunk: {
          id: "idle",
          text: "",
          startMs: 0,
          endMs: 0,
          words: [],
          styleKey: "",
          motionKey: "",
          layoutVariant: "inline",
          emphasisWordIndices: []
        },
        ...editorialContext,
        currentTimeMs
      });
    }

    return resolveCaptionEditorialDecision({
      chunk,
      ...editorialContext,
      currentTimeMs
    });
  }, [activeChunk, chunks, currentTimeMs, editorialContext]);
  const subtitleMode = useMemo<PreviewSubtitleAnimationMode>(() => {
    if (!activeChunk) {
      return "phrase_block_reveal";
    }

    return resolvePreviewSubtitleAnimationMode({
      chunk: activeChunk,
      editorialDecision
    });
  }, [activeChunk, editorialDecision]);
  const subtitleSafeZone = useMemo(() => resolvePreviewSubtitleSafeZone({
    width: videoMetadata.width,
    height: videoMetadata.height,
    maxLineUnits: lines.reduce((max, line) => Math.max(max, line.estimatedUnits), 0),
    lineCount: lines.length,
    previewViewportScale,
    captionBias,
    editorialDecision,
    placementPlan: editorialDecision.visualOrchestration.placementPlan
  }), [captionBias, editorialDecision, lines, previewViewportScale, videoMetadata.height, videoMetadata.width]);
  const emphasisIndices = useMemo(() => {
    if (!activeChunk || subtitleMode !== "word_emphasis_reveal") {
      return new Set<number>();
    }

    return resolvePreviewSubtitleEmphasisIndices(activeChunk);
  }, [activeChunk, subtitleMode]);

  const isSilenced = subtitleSafeZone.physics.isSilenced;
  const delayMs = (subtitleSafeZone.physics.impactDelayFrames / (videoMetadata.fps ?? 30)) * 1000;
  const isDelayed = activeChunk && currentTimeMs < activeChunk.startMs + delayMs;
  
  if (!activeChunk || activeChunk.words.length === 0 || isSilenced || isDelayed) {
    return null;
  }

  if (!shouldRenderOverlayText(activeChunk.text)) {
    return null;
  }

  if (captionRenderMode === "docked-inverse") {
    const activeWords = activeChunk?.words ?? [];
    const dominantWordIndex = activeWords.findIndex((word) => {
      return currentTimeMs >= word.startMs && currentTimeMs < word.endMs;
    });
    const resolvedDominantWordIndex = dominantWordIndex >= 0
      ? dominantWordIndex
      : activeWords.reduce((bestIndex, word, index) => {
        return currentTimeMs >= word.startMs - 80 ? index : bestIndex;
      }, 0);
    const dockedWordColor = editorialDecision.surfaceTone === "light"
      ? "rgba(18, 20, 24, 0.96)"
      : editorialDecision.textColor;
    const dockedWordBackground = editorialDecision.surfaceTone === "light"
      ? "linear-gradient(135deg, rgba(22, 26, 34, 0.96), rgba(45, 52, 66, 0.92))"
      : "linear-gradient(135deg, rgba(70, 96, 255, 0.98), rgba(53, 79, 228, 0.9))";
    const dockedWordShadow = editorialDecision.surfaceTone === "light"
      ? "0 10px 24px rgba(16, 20, 27, 0.18)"
      : "0 10px 22px rgba(43, 63, 188, 0.34)";

    return (
      <div
        className="preview-native-overlay preview-native-overlay--captions"
        data-caption-renderer={captionRenderMode}
        data-caption-expected-font={editorialDecision.fontFamily}
      >
        <div
          style={{
            position: "absolute",
            left: "4.2%",
            right: "4.2%",
            bottom: "6.4%",
            display: "flex",
            justifyContent: "center"
          }}
        >
          <div className="preview-native-docked-caption">
            <div className="preview-native-docked-caption-bar" />
            <div className="preview-native-docked-caption-words">
              {activeWords.map((word, index) => {
                const safeText = sanitizeRenderableOverlayText(word.text);
                if (!safeText) {
                  return null;
                }
                const previousWord = index > 0 ? activeWords[index - 1] : undefined;
                const nextWord = index < activeWords.length - 1 ? activeWords[index + 1] : undefined;
                const motionState = getLongformWordMotionState({
                  word,
                  previousWord,
                  nextWord,
                  wordIndex: index,
                  chunkWordCount: activeWords.length,
                  chunkEndMs: activeChunk?.endMs ?? currentTimeMs + 240,
                  currentTimeMs
                });
                const isDominant = index === resolvedDominantWordIndex;

                return (
                  <span
                    id={`${activeChunk?.id ?? "idle"}-word-${index}`}
                    key={`${activeChunk?.id ?? "idle"}-${index}-${word.startMs}`}
                    data-animation-target-id={`${activeChunk?.id ?? "idle"}-word-${index}`}
                    data-animation-registry-ref={getLongformWordEmphasisWordKey(word)}
                    data-animation-tags={isDominant ? "word dominant-word focus-target" : "word focus-target"}
                    data-caption-expected-font={editorialDecision.fontFamily}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: isDominant ? "0.05em 0.24em 0.08em" : undefined,
                      borderRadius: isDominant ? 10 : undefined,
                      background: isDominant
                        ? dockedWordBackground
                        : "transparent",
                      color: isDominant ? dockedWordColor : editorialDecision.textColor,
                      fontFamily: editorialDecision.fontFamily,
                      fontWeight: editorialDecision.fontWeight,
                      letterSpacing: editorialDecision.letterSpacing,
                      textTransform: editorialDecision.uppercaseBias ? "uppercase" : undefined,
                      textShadow: editorialDecision.textShadow,
                      opacity: motionState.hasStarted ? 1 : Math.max(0.7, motionState.opacity),
                      transform: `translate3d(0, ${(motionState.translateY * 0.34).toFixed(2)}px, 0) scale(${(isDominant ? motionState.scale * 1.02 : motionState.scale).toFixed(3)})`,
                      filter: `blur(${(motionState.blur * (isDominant ? 0.18 : 0.12)).toFixed(2)}px)`,
                      boxShadow: isDominant ? dockedWordShadow : "none",
                      willChange: "transform, opacity, filter"
                    }}
                  >
                    {safeText}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (captionRenderMode !== "word-by-word" && captionRenderMode !== "semantic-sidecall") {
    return null;
  }

  return (
    <div
      className="preview-native-overlay preview-native-overlay--captions"
      data-caption-renderer={captionRenderMode}
      data-caption-expected-font={editorialDecision.fontFamily}
    >
      <div
        data-preview-subtitle-safe-zone="bottom"
        data-caption-expected-font={editorialDecision.fontFamily}
        style={{
          position: "absolute",
          left: `${subtitleSafeZone.leftPercent}%`,
          width: `${subtitleSafeZone.widthPercent}%`,
          bottom: `${subtitleSafeZone.bottomPercent}%`,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: subtitleSafeZone.justifyContent,
          opacity: subtitleSafeZone.physics.opacity,
          transform: `translate3d(${subtitleSafeZone.physics.offsetX}px, ${subtitleSafeZone.physics.offsetY}px, 0) rotate(${subtitleSafeZone.physics.rotation}deg) scale(${1.0 + subtitleSafeZone.physics.scaleMultiplier})`,
          filter: `blur(${subtitleSafeZone.physics.blurPx}px)`,
          transition: `all ${editorialDecision.stylePhysics.motion.durationMs}ms ${editorialDecision.stylePhysics.motion.easing}`,
          ...editorialDecision.cssVariables as CSSProperties
        }}
      >
        <div
          data-preview-subtitle-mode={subtitleMode}
          data-caption-expected-font={editorialDecision.fontFamily}
          style={{
            width: "100%",
            maxWidth: `${subtitleSafeZone.maxWidthPercent}%`,
            position: "relative",
            minHeight: `${subtitleSafeZone.minHeightEm}em`,
            boxSizing: "border-box",
            padding: `${subtitleSafeZone.padBlockEm}em ${subtitleSafeZone.padInlineEm}em`,
            textAlign: subtitleSafeZone.justifyContent === "center" ? "center" : "left",
            fontFamily: editorialDecision.fontFamily,
            fontSize: `${subtitleSafeZone.fontSizePx}px`,
            lineHeight: subtitleSafeZone.lineHeight,
            letterSpacing: editorialDecision.letterSpacing,
            color: editorialDecision.textColor,
            fontWeight: editorialDecision.fontWeight,
            textTransform: editorialDecision.uppercaseBias ? "uppercase" : undefined,
            opacity: editorialDecision.opacityMultiplier ?? 1.0
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: `-${subtitleSafeZone.backdropInsetTopEm}em -${subtitleSafeZone.backdropInsetXEm}em -${subtitleSafeZone.backdropInsetBottomEm}em`,
              borderRadius: `${subtitleSafeZone.backdropRadiusEm}em`,
              background:
                "radial-gradient(circle at 50% 34%, rgba(238, 216, 184, 0.08), transparent 34%), linear-gradient(180deg, rgba(4, 6, 10, 0.06) 0%, rgba(4, 6, 10, 0.16) 34%, rgba(4, 6, 10, 0.28) 68%, rgba(4, 6, 10, 0.38) 100%)",
              boxShadow: "0 16px 42px rgba(0,0,0,0.18), 0 0 30px rgba(88,110,214,0.08)",
              filter: `blur(${subtitleSafeZone.backdropBlurPx}px)`,
              opacity: 0.96,
              pointerEvents: "none"
            }}
          />
          <div
            style={{
              ...getPreviewSubtitlePhraseMotionStyle({
                chunk: activeChunk,
                currentTimeMs,
                mode: subtitleMode
              }),
              position: "relative",
              zIndex: 1,
              display: "grid",
              justifyItems: subtitleSafeZone.justifyContent === "center" ? "center" : "start",
              gap: `${subtitleSafeZone.lineGapEm}em`
            }}
          >
            {lines.map((line, lineIndex) => {
              const safeLineWords = line.words
                .map((word) => ({
                  word,
                  safeText: sanitizeRenderableOverlayText(word.text)
                }))
                .filter((entry) => entry.safeText.length > 0);
              if (safeLineWords.length === 0) {
                return null;
              }
              const lineRole = line.role ?? "context";
              const lineStyle = editorialDecision.lineStyles[lineRole] ?? {
                fontSizeScale: 1,
                fontWeight: editorialDecision.fontWeight,
                lineHeight: 1.12,
                letterSpacing: editorialDecision.letterSpacing
              };

              return (
                <div
                  key={`${activeChunk.id}-${line.id}`}
                  data-caption-expected-font={editorialDecision.fontFamily}
                  style={{
                    ...getPreviewSubtitleLineRevealStyle({
                      line,
                      lineIndex,
                      chunk: activeChunk,
                      currentTimeMs,
                      mode: subtitleMode,
                      editorialDecision
                    }),
                    position: "relative",
                    display: "flex",
                    justifyContent: subtitleSafeZone.justifyContent === "center" ? "center" : "flex-start",
                    alignItems: "baseline",
                    gap: `0 ${subtitleSafeZone.wordGapEm}em`,
                    whiteSpace: "nowrap",
                    color: editorialDecision.textColor,
                    textTransform: editorialDecision.uppercaseBias ? "uppercase" : undefined,
                    fontFamily: editorialDecision.fontFamily,
                    fontSize: `${Math.round(subtitleSafeZone.fontSizePx * lineStyle.fontSizeScale)}px`,
                    fontWeight: lineStyle.fontWeight,
                    lineHeight: lineStyle.lineHeight,
                    letterSpacing: lineStyle.letterSpacing
                  }}
                >
                  {safeLineWords.map(({word, safeText}, wordIndex) => {
                  const wordKey = getLongformWordEmphasisWordKey(word);
                  const wordMeta = activeChunkPresentation?.wordMetaByKey.get(wordKey);
                  const chunkWordIndex = Math.max(0, wordMeta?.chunkWordIndex ?? wordIndex);
                  const isHelper = wordMeta?.isHelper ?? isLongformHelperWord(normalizeLongformWord(word.text));
                  const isEmphasized = emphasisIndices.has(chunkWordIndex);

                  return (
                    <span
                      id={`${activeChunk.id}-${line.id}-${wordIndex}`}
                      key={`${activeChunk.id}-${line.id}-${wordIndex}-${word.startMs}`}
                      data-animation-target-id={`${activeChunk.id}-${line.id}-${wordIndex}`}
                      data-animation-registry-ref={wordKey}
                      data-animation-tags={`${isHelper ? "word helper-word" : "word"} focus-target${isEmphasized ? " subtitle-emphasis" : ""}`}
                      data-caption-expected-font={editorialDecision.fontFamily}
                      style={{
                        ...getPreviewSubtitleWordStyle({
                          chunk: activeChunk,
                          chunkWordIndex,
                          currentTimeMs,
                          mode: subtitleMode,
                          isEmphasized,
                          editorialDecision
                        }),
                        position: "relative",
                        overflow: "visible"
                      }}
                    >
                      {safeText}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
};

export const NativePreviewOverlayStage: React.FC<{
  currentTimeMs: number;
  videoMetadata: Pick<VideoMetadata, "width" | "height" | "fps">;
  model: MotionCompositionModel;
  captionProfileId: CaptionStyleProfileId;
  previewPerformanceMode: PreviewPerformanceMode;
  suppressCaptions?: boolean;
}> = ({currentTimeMs, videoMetadata, model, captionProfileId, previewPerformanceMode, suppressCaptions = false}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [previewViewportScale, setPreviewViewportScale] = useState(1);
  const isLeanNativePreview = previewPerformanceMode === "turbo" || model.tier === "minimal";
  const captionRenderMode = useMemo(() => getLongformCaptionRenderMode(captionProfileId), [captionProfileId]);
  const shouldFavorFootageVisibility = previewPerformanceMode === "full" || captionRenderMode === "word-by-word";
  const cameraMotionState = useMemo(() => getCameraMotionState({
    model,
    currentTimeMs,
    previewPerformanceMode
  }), [currentTimeMs, model, previewPerformanceMode]);
  const controlledPreviewShellScale = resolveControlledBackgroundScale(cameraMotionState.scale, 1.02);
  const activeBackgroundOverlayCue = useMemo(() => {
    if (isLeanNativePreview || model.motionGraphicsPlan.disableLegacyBackgroundOverlay) {
      return null;
    }

    const liveCue = selectActiveMotionBackgroundOverlayCueAtTime({
      cues: model.backgroundOverlayPlan.cues,
      currentTimeMs
    });
    if (liveCue) {
      return liveCue;
    }

    return model.backgroundOverlayPlan.cues.find((cue) => {
      return currentTimeMs >= cue.startMs - BACKGROUND_PRELOAD_LEAD_MS && currentTimeMs < cue.startMs;
    }) ?? null;
  }, [currentTimeMs, isLeanNativePreview, model.backgroundOverlayPlan.cues, model.motionGraphicsPlan.disableLegacyBackgroundOverlay]);
  const activeMotionScene = useMemo(() => {
    if (isLeanNativePreview) {
      return null;
    }
    return selectActiveMotionSceneAtTime({
      scenes: model.scenes,
      currentTimeMs,
      fps: videoMetadata.fps
    });
  }, [currentTimeMs, isLeanNativePreview, model.scenes, videoMetadata.fps]);
  const activeMotionGraphicsDecision = useMemo(() => {
    return activeMotionScene ? model.motionGraphicsPlan.sceneMap[activeMotionScene.id] ?? null : null;
  }, [activeMotionScene, model.motionGraphicsPlan.sceneMap]);
  const activeChoreographyScene = useMemo(() => {
    if (isLeanNativePreview) {
      return null;
    }
    return selectActiveMotionChoreographySceneAtTime({
      plan: model.choreographyPlan,
      currentTimeMs
    });
  }, [currentTimeMs, isLeanNativePreview, model.choreographyPlan]);
  const activeChoreographyState = useMemo(() => {
    if (!activeChoreographyScene) {
      return null;
    }
    return resolveMotionChoreographySceneStateAtTime({
      scene: activeChoreographyScene,
      currentTimeMs
    });
  }, [activeChoreographyScene, currentTimeMs]);
  const activeShowcaseCue = useMemo(() => {
    if (isLeanNativePreview) {
      return null;
    }
    return selectActiveMotionShowcaseCueAtTime({
      cues: model.showcasePlan.cues,
      currentTimeMs
    });
  }, [currentTimeMs, isLeanNativePreview, model.showcasePlan.cues]);
  const activeTransitionOverlayCue = useMemo(() => {
    if (isLeanNativePreview) {
      return null;
    }

    return selectActiveTransitionOverlayCueAtTime({
      cues: model.transitionOverlayPlan.cues,
      currentTimeMs
    });
  }, [currentTimeMs, isLeanNativePreview, model.transitionOverlayPlan.cues]);
  const captionCurrentTimeMs = currentTimeMs + (1000 / videoMetadata.fps) * 0.5;

  useEffect(() => {
    const stageElement = stageRef.current;
    if (!stageElement) {
      setPreviewViewportScale(1);
      return;
    }

    const syncScale = (): void => {
      const rect = stageElement.getBoundingClientRect();
      const nextScale = resolvePreviewViewportScale({
        viewportWidth: rect.width,
        viewportHeight: rect.height,
        outputWidth: videoMetadata.width,
        outputHeight: videoMetadata.height
      });
      setPreviewViewportScale((previousScale) => (
        Math.abs(previousScale - nextScale) >= 0.01 ? nextScale : previousScale
      ));
    };

    syncScale();
    window.addEventListener("resize", syncScale);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        syncScale();
      });
      observer.observe(stageElement);
    }

    return () => {
      window.removeEventListener("resize", syncScale);
      observer?.disconnect();
    };
  }, [videoMetadata.height, videoMetadata.width]);

  return (
    <div
      ref={stageRef}
      className="preview-native-media-shell"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none"
      }}
    >
      <div
        className="preview-native-video-shell"
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate3d(${cameraMotionState.translateX.toFixed(2)}px, ${cameraMotionState.translateY.toFixed(2)}px, 0) scale(${controlledPreviewShellScale.toFixed(3)})`
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 14% 12%, rgba(214, 177, 107, 0.12), transparent 26%), radial-gradient(circle at 86% 84%, rgba(59, 130, 246, 0.1), transparent 22%), linear-gradient(180deg, rgba(4, 6, 10, 0.98), rgba(2, 4, 9, 1))",
            borderRadius: 0
          }}
        />
      </div>

      {activeBackgroundOverlayCue ? (
        <NativeBackgroundOverlay
          cue={activeBackgroundOverlayCue}
          currentTimeMs={currentTimeMs}
          fps={videoMetadata.fps}
          videoIsPlaying={false}
          videoPlaybackRate={1}
          outputWidth={videoMetadata.width}
          outputHeight={videoMetadata.height}
          captionBias={model.captionBias}
        />
      ) : null}

      <div
        className="preview-native-grade-overlay"
        style={{
          background: `radial-gradient(circle at 16% 14%, ${model.gradeProfile.highlightTint} 0%, rgba(255,255,255,0) 48%), radial-gradient(circle at 84% 82%, rgba(164,208,255,0.12) 0%, rgba(164,208,255,0) 54%), linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.04) 56%, ${model.gradeProfile.shadowTint} 100%)`,
          opacity: shouldFavorFootageVisibility
            ? Math.max(0.08, model.gradeProfile.vignette * 0.64)
            : Math.max(0.18, model.gradeProfile.vignette * 1.12)
        }}
      />
      <div
        className="preview-native-vignette"
        style={{
          boxShadow: `inset 0 0 160px rgba(0,0,0,${(
            shouldFavorFootageVisibility
              ? 0.08 + model.gradeProfile.vignette * 0.28
              : 0.13 + model.gradeProfile.vignette * 0.48
          ).toFixed(3)})`
        }}
      />
      <div
        className="preview-native-bloom"
        style={{
          opacity: shouldFavorFootageVisibility
            ? Math.min(0.72, (0.14 + model.gradeProfile.bloom * 0.32) * PREVIEW_STAGE_BLOOM_GAIN)
            : Math.min(0.92, (0.26 + model.gradeProfile.bloom * 0.58) * PREVIEW_STAGE_BLOOM_GAIN)
        }}
      />
      {previewPerformanceMode === "balanced" ? (
        <div className="preview-native-motion-chrome" />
      ) : null}

      {previewPerformanceMode !== "turbo" && activeMotionScene ? (
        <NativeMotionAssetOverlay
          activeScene={activeMotionScene}
          activeDecision={activeMotionGraphicsDecision}
          currentTimeMs={currentTimeMs}
          fps={videoMetadata.fps}
          outputWidth={videoMetadata.width}
          outputHeight={videoMetadata.height}
          videoIsPlaying={false}
          videoPlaybackRate={1}
          choreographyState={activeChoreographyState}
          choreography3DEnabled={model.motion3DPlan.enabled}
        />
      ) : null}
      {activeChoreographyScene ? (
        <MotionChoreographyStage
          scene={activeChoreographyScene}
          currentTimeMs={currentTimeMs}
          zIndex={6}
        />
      ) : null}

      {activeShowcaseCue ? (
        <NativeShowcaseOverlay
          activeCue={activeShowcaseCue}
          model={model}
          currentTimeMs={currentTimeMs}
          previewViewportScale={previewViewportScale}
        />
      ) : null}
      {activeTransitionOverlayCue ? (
        <NativeTransitionOverlay
          cue={activeTransitionOverlayCue}
          currentTimeMs={currentTimeMs}
          fps={videoMetadata.fps}
          videoIsPlaying={false}
          videoPlaybackRate={1}
        />
      ) : null}

      <NativeCaptionOverlay
        currentTimeMs={captionCurrentTimeMs}
        videoMetadata={videoMetadata}
        chunks={model.chunks}
        captionProfileId={captionProfileId}
        captionBias={model.captionBias}
        model={model}
        previewViewportScale={previewViewportScale}
        suppressCaptions={suppressCaptions}
      />
    </div>
  );
};

export const NativePreviewStage: React.FC<NativePreviewStageProps> = ({
  videoSrc,
  posterSrc,
  videoMetadata,
  model,
  captionProfileId,
  previewPerformanceMode,
  suppressCaptions = false,
  onHealthChange,
  onErrorMessageChange,
  onTelemetryUpdate
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const telemetryRef = useRef<PreviewTelemetry>(createPreviewTelemetry());
  const lastObservedFrameRef = useRef<number | null>(null);
  const bufferingStartedAtRef = useRef<number | null>(null);
  const suppressJumpTrackingRef = useRef(false);
  const stopSyncLoopRef = useRef<(() => void) | null>(null);
  const renderedTimelineMsRef = useRef(0);
  const lastTelemetryPublishAtRef = useRef(0);
  const lastLoggedMotionDecisionSceneRef = useRef<string | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [hasLoadedFrame, setHasLoadedFrame] = useState(false);
  const [videoIsPlaying, setVideoIsPlaying] = useState(false);
  const [videoPlaybackRate, setVideoPlaybackRate] = useState(1);
  const [previewViewportScale, setPreviewViewportScale] = useState(1);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const isLeanNativePreview = previewPerformanceMode === "turbo" || model.tier === "minimal";
  const overlayTickMs = 1000 / (NATIVE_PREVIEW_OVERLAY_FPS[previewPerformanceMode] ?? 18);
  const captionRenderMode = useMemo(() => getLongformCaptionRenderMode(captionProfileId), [captionProfileId]);
  const shouldFavorFootageVisibility = previewPerformanceMode === "full" || captionRenderMode === "word-by-word";
  const cameraMotionState = useMemo(() => getCameraMotionState({
    model,
    currentTimeMs,
    previewPerformanceMode
  }), [currentTimeMs, model, previewPerformanceMode]);
  const activeBackgroundOverlayCue = useMemo(() => {
    if (isLeanNativePreview || model.motionGraphicsPlan.disableLegacyBackgroundOverlay) {
      return null;
    }

    const liveCue = selectActiveMotionBackgroundOverlayCueAtTime({
      cues: model.backgroundOverlayPlan.cues,
      currentTimeMs
    });
    if (liveCue) {
      return liveCue;
    }

    return model.backgroundOverlayPlan.cues.find((cue) => {
      return currentTimeMs >= cue.startMs - BACKGROUND_PRELOAD_LEAD_MS && currentTimeMs < cue.startMs;
    }) ?? null;
  }, [currentTimeMs, isLeanNativePreview, model.backgroundOverlayPlan.cues, model.motionGraphicsPlan.disableLegacyBackgroundOverlay]);
  const activeMotionScene = useMemo(() => {
    if (isLeanNativePreview) {
      return null;
    }
    return selectActiveMotionSceneAtTime({
      scenes: model.scenes,
      currentTimeMs,
      fps: videoMetadata.fps
    });
  }, [currentTimeMs, isLeanNativePreview, model.scenes, videoMetadata.fps]);
  const activeMotionGraphicsDecision = useMemo(() => {
    return activeMotionScene ? model.motionGraphicsPlan.sceneMap[activeMotionScene.id] ?? null : null;
  }, [activeMotionScene, model.motionGraphicsPlan.sceneMap]);
  const activeChoreographyScene = useMemo(() => {
    if (isLeanNativePreview) {
      return null;
    }
    return selectActiveMotionChoreographySceneAtTime({
      plan: model.choreographyPlan,
      currentTimeMs
    });
  }, [currentTimeMs, isLeanNativePreview, model.choreographyPlan]);
  const activeChoreographyState = useMemo(() => {
    if (!activeChoreographyScene) {
      return null;
    }
    return resolveMotionChoreographySceneStateAtTime({
      scene: activeChoreographyScene,
      currentTimeMs
    });
  }, [activeChoreographyScene, currentTimeMs]);
  const activeShowcaseCue = useMemo(() => {
    if (isLeanNativePreview) {
      return null;
    }
    return selectActiveMotionShowcaseCueAtTime({
      cues: model.showcasePlan.cues,
      currentTimeMs
    });
  }, [currentTimeMs, isLeanNativePreview, model.showcasePlan.cues]);
  const activeTransitionOverlayCue = useMemo(() => {
    if (isLeanNativePreview) {
      return null;
    }

    return selectActiveTransitionOverlayCueAtTime({
      cues: model.transitionOverlayPlan.cues,
      currentTimeMs
    });
  }, [currentTimeMs, isLeanNativePreview, model.transitionOverlayPlan.cues]);
  const enablePreviewSoundDesign = previewPerformanceMode !== "turbo";
  const totalSoundCueCount = enablePreviewSoundDesign
    ? model.soundDesignPlan.musicCues.length + model.soundDesignPlan.cues.length
    : 0;
  const captionCurrentTimeMs = currentTimeMs + (1000 / videoMetadata.fps) * 0.5;
  const showMotionGraphicsDebugOverlay = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const debugWindow = window as Window & {__MOTION_DEBUG__?: boolean};
    return Boolean(debugWindow.__MOTION_DEBUG__ || window.localStorage?.getItem("motion.debug") === "1");
  }, []);

  useEffect(() => {
    if (!showMotionGraphicsDebugOverlay || !activeMotionGraphicsDecision) {
      return;
    }
    if (lastLoggedMotionDecisionSceneRef.current === activeMotionGraphicsDecision.sceneId) {
      return;
    }

    lastLoggedMotionDecisionSceneRef.current = activeMotionGraphicsDecision.sceneId;
    console.info("[motion-graphics-agent]", {
      sceneId: activeMotionGraphicsDecision.sceneId,
      selectedAssetIds: activeMotionGraphicsDecision.debug.selectedAssetIds,
      rationale: activeMotionGraphicsDecision.rationale,
      rejectedCandidates: activeMotionGraphicsDecision.debug.rejectedCandidates,
      artifactMitigation: activeMotionGraphicsDecision.debug.artifactMitigation
    });
  }, [activeMotionGraphicsDecision, showMotionGraphicsDebugOverlay]);

  const publishTelemetry = useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastTelemetryPublishAtRef.current < TELEMETRY_PUBLISH_INTERVAL_MS) {
      return;
    }
    lastTelemetryPublishAtRef.current = now;
    onTelemetryUpdate?.({...telemetryRef.current});
  }, [onTelemetryUpdate]);

  const markFrameReady = useCallback(() => {
    setHasLoadedFrame(true);
    onHealthChange?.("ready");
    onErrorMessageChange?.(null);
  }, [onErrorMessageChange, onHealthChange]);

  const finalizeBuffering = useCallback(() => {
    if (bufferingStartedAtRef.current === null) {
      return;
    }

    const bufferMs = Math.max(0, Date.now() - bufferingStartedAtRef.current);
    telemetryRef.current.totalBufferMs += bufferMs;
    telemetryRef.current.lastBufferMs = bufferMs;
    bufferingStartedAtRef.current = null;
    publishTelemetry(true);
  }, [publishTelemetry]);

  const syncFromVideoElement = useCallback((options?: {forceState?: boolean; forceTelemetry?: boolean}) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const nextTimeMs = Math.max(0, video.currentTime * 1000);
    const nextFrame = Math.max(0, Math.round((nextTimeMs / 1000) * videoMetadata.fps));
    const previousFrame = lastObservedFrameRef.current;

    telemetryRef.current.currentFrame = nextFrame;
    telemetryRef.current.highestFrame = Math.max(telemetryRef.current.highestFrame, nextFrame);

    if (previousFrame !== null && !suppressJumpTrackingRef.current) {
      const delta = nextFrame - previousFrame;
      if (delta < 0) {
        telemetryRef.current.backwardJumpCount += 1;
        telemetryRef.current.maxBackwardJumpFrames = Math.max(
          telemetryRef.current.maxBackwardJumpFrames,
          Math.abs(delta)
        );
      } else if (delta > 2) {
        telemetryRef.current.forwardJumpCount += 1;
        telemetryRef.current.maxForwardJumpFrames = Math.max(
          telemetryRef.current.maxForwardJumpFrames,
          delta
        );
      }
    }

    suppressJumpTrackingRef.current = false;
    lastObservedFrameRef.current = nextFrame;
    const forceState = options?.forceState === true;
    if (forceState || Math.abs(nextTimeMs - renderedTimelineMsRef.current) >= overlayTickMs || video.paused || video.ended) {
      renderedTimelineMsRef.current = nextTimeMs;
      setCurrentTimeMs(nextTimeMs);
    }
    publishTelemetry(options?.forceTelemetry === true);
  }, [overlayTickMs, publishTelemetry, videoMetadata.fps]);

  const stopSyncLoop = useCallback(() => {
    stopSyncLoopRef.current?.();
    stopSyncLoopRef.current = null;
  }, []);

  const startSyncLoop = useCallback(() => {
    stopSyncLoop();

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const videoWithFrameCallbacks = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: () => void) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
    };
    let cancelled = false;
    let animationFrameId: number | null = null;
    let videoFrameCallbackId: number | null = null;

    const tick = () => {
      if (cancelled) {
        return;
      }

      syncFromVideoElement();
      if (video.paused || video.ended) {
        return;
      }

      if (typeof videoWithFrameCallbacks.requestVideoFrameCallback === "function") {
        videoFrameCallbackId = videoWithFrameCallbacks.requestVideoFrameCallback(() => {
          tick();
        });
        return;
      }

      animationFrameId = window.requestAnimationFrame(() => {
        tick();
      });
    };

    tick();

    stopSyncLoopRef.current = () => {
      cancelled = true;
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      if (videoFrameCallbackId !== null && typeof videoWithFrameCallbacks.cancelVideoFrameCallback === "function") {
        videoWithFrameCallbacks.cancelVideoFrameCallback(videoFrameCallbackId);
      }
    };
  }, [stopSyncLoop, syncFromVideoElement]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.volume = clamp(model.soundDesignPlan.mixTargets.sourceVideoVolume, 0, 1);
  }, [model.soundDesignPlan.mixTargets.sourceVideoVolume, videoSrc]);

  useEffect(() => {
    telemetryRef.current = createPreviewTelemetry();
    lastObservedFrameRef.current = null;
    bufferingStartedAtRef.current = null;
    suppressJumpTrackingRef.current = false;
    renderedTimelineMsRef.current = 0;
    lastTelemetryPublishAtRef.current = 0;
    setCurrentTimeMs(0);
    setHasLoadedFrame(false);
    setVideoIsPlaying(false);
    setVideoPlaybackRate(1);
    setAudioUnlocked(false);
    onHealthChange?.("booting");
    onErrorMessageChange?.(null);
    publishTelemetry(true);

    const video = videoRef.current;
    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      syncFromVideoElement({forceState: true, forceTelemetry: true});
      markFrameReady();
    }

    return () => {
      finalizeBuffering();
      stopSyncLoop();
    };
  }, [
    finalizeBuffering,
    markFrameReady,
    onErrorMessageChange,
    onHealthChange,
    publishTelemetry,
    stopSyncLoop,
    syncFromVideoElement,
    videoSrc
  ]);

  const stageFilter = useMemo(() => buildGradeFilter(model.gradeProfile), [model.gradeProfile]);
  const controlledPreviewShellScale = resolveControlledBackgroundScale(cameraMotionState.scale, 1.02);

  useEffect(() => {
    const stageElement = stageRef.current;
    if (!stageElement) {
      setPreviewViewportScale(1);
      return;
    }

    const syncScale = (): void => {
      const rect = stageElement.getBoundingClientRect();
      const nextScale = resolvePreviewViewportScale({
        viewportWidth: rect.width,
        viewportHeight: rect.height,
        outputWidth: videoMetadata.width,
        outputHeight: videoMetadata.height
      });
      setPreviewViewportScale((previousScale) => (
        Math.abs(previousScale - nextScale) >= 0.01 ? nextScale : previousScale
      ));
    };

    syncScale();
    window.addEventListener("resize", syncScale);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        syncScale();
      });
      observer.observe(stageElement);
    }

    return () => {
      window.removeEventListener("resize", syncScale);
      observer?.disconnect();
    };
  }, [videoMetadata.height, videoMetadata.width]);

  return (
    <div
      ref={stageRef}
      className={`preview-native-stage preview-native-stage--${previewPerformanceMode}`}
      style={{aspectRatio: `${videoMetadata.width} / ${videoMetadata.height}`}}
      onPointerDownCapture={() => {
        setAudioUnlocked(true);
      }}
      onTouchStartCapture={() => {
        setAudioUnlocked(true);
      }}
    >
      <div className="preview-native-media-shell">
        {posterSrc ? (
          <img
            className={`preview-native-poster${hasLoadedFrame ? " is-hidden" : ""}`}
            src={posterSrc}
            alt=""
            aria-hidden="true"
            draggable={false}
            loading="eager"
            decoding="async"
          />
        ) : null}
        {enablePreviewSoundDesign ? (
          <NativePreviewSoundDesign
            currentTimeMs={currentTimeMs}
            fps={videoMetadata.fps}
            videoIsPlaying={videoIsPlaying}
            videoPlaybackRate={videoPlaybackRate}
            audioUnlocked={audioUnlocked}
            previewPerformanceMode={previewPerformanceMode}
            musicCues={model.soundDesignPlan.musicCues}
            soundCues={model.soundDesignPlan.cues}
          />
        ) : null}
        <div
          className="preview-native-video-shell"
          style={{
            transform: `translate3d(${cameraMotionState.translateX.toFixed(2)}px, ${cameraMotionState.translateY.toFixed(2)}px, 0) scale(${controlledPreviewShellScale.toFixed(3)})`
          }}
        >
          <video
            ref={videoRef}
            className="preview-native-video"
            src={videoSrc}
            poster={posterSrc ?? undefined}
            controls
            preload="auto"
            playsInline
            onLoadedMetadata={() => {
              syncFromVideoElement({forceState: true, forceTelemetry: true});
              if (videoRef.current) {
                videoRef.current.volume = clamp(model.soundDesignPlan.mixTargets.sourceVideoVolume, 0, 1);
              }
              setVideoPlaybackRate(videoRef.current?.playbackRate ?? 1);
              if ((videoRef.current?.readyState ?? 0) >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                markFrameReady();
              }
            }}
            onLoadedData={() => {
              markFrameReady();
              syncFromVideoElement({forceState: true, forceTelemetry: true});
            }}
            onCanPlay={() => {
              markFrameReady();
              syncFromVideoElement({forceState: true, forceTelemetry: true});
              finalizeBuffering();
            }}
            onPlaying={() => {
              markFrameReady();
              setAudioUnlocked(true);
              setVideoIsPlaying(true);
              syncFromVideoElement({forceState: true, forceTelemetry: true});
              finalizeBuffering();
              startSyncLoop();
            }}
            onPause={() => {
              setVideoIsPlaying(false);
              syncFromVideoElement({forceState: true, forceTelemetry: true});
              finalizeBuffering();
              onHealthChange?.("ready");
              stopSyncLoop();
            }}
            onEnded={() => {
              setVideoIsPlaying(false);
              syncFromVideoElement({forceState: true, forceTelemetry: true});
              finalizeBuffering();
              onHealthChange?.("ready");
              stopSyncLoop();
            }}
            onWaiting={() => {
              setVideoIsPlaying(false);
              if (bufferingStartedAtRef.current === null) {
                bufferingStartedAtRef.current = Date.now();
                telemetryRef.current.stallCount += 1;
                publishTelemetry();
              }
              onHealthChange?.(hasLoadedFrame ? "buffering" : "booting");
            }}
            onRateChange={() => {
              setVideoPlaybackRate(videoRef.current?.playbackRate ?? 1);
            }}
            onSeeked={() => {
              telemetryRef.current.seekCount += 1;
              suppressJumpTrackingRef.current = true;
              syncFromVideoElement({forceState: true, forceTelemetry: true});
              onHealthChange?.("ready");
              publishTelemetry(true);
            }}
            onError={() => {
              stopSyncLoop();
              onHealthChange?.("error");
              onErrorMessageChange?.(buildMediaErrorMessage(videoRef.current));
            }}
            style={{filter: stageFilter}}
          />
        </div>

        {activeBackgroundOverlayCue ? (
          <NativeBackgroundOverlay
            cue={activeBackgroundOverlayCue}
            currentTimeMs={currentTimeMs}
            fps={videoMetadata.fps}
            videoIsPlaying={videoIsPlaying}
            videoPlaybackRate={videoPlaybackRate}
            outputWidth={videoMetadata.width}
            outputHeight={videoMetadata.height}
            captionBias={model.captionBias}
          />
        ) : null}

        <div
          className="preview-native-grade-overlay"
          style={{
            background: `radial-gradient(circle at 16% 14%, ${model.gradeProfile.highlightTint} 0%, rgba(255,255,255,0) 48%), radial-gradient(circle at 84% 82%, rgba(164,208,255,0.12) 0%, rgba(164,208,255,0) 54%), linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.04) 56%, ${model.gradeProfile.shadowTint} 100%)`,
            opacity: shouldFavorFootageVisibility
              ? Math.max(0.08, model.gradeProfile.vignette * 0.64)
              : Math.max(0.18, model.gradeProfile.vignette * 1.12)
          }}
        />
        <div
          className="preview-native-vignette"
          style={{
            boxShadow: `inset 0 0 160px rgba(0,0,0,${(
              shouldFavorFootageVisibility
                ? 0.08 + model.gradeProfile.vignette * 0.28
                : 0.13 + model.gradeProfile.vignette * 0.48
            ).toFixed(3)})`
          }}
        />
        <div
          className="preview-native-bloom"
          style={{
            opacity: shouldFavorFootageVisibility
              ? Math.min(0.72, (0.14 + model.gradeProfile.bloom * 0.32) * PREVIEW_STAGE_BLOOM_GAIN)
              : Math.min(0.92, (0.26 + model.gradeProfile.bloom * 0.58) * PREVIEW_STAGE_BLOOM_GAIN)
          }}
        />
        {previewPerformanceMode === "balanced" ? (
          <div className="preview-native-motion-chrome" />
        ) : null}

        {previewPerformanceMode !== "turbo" && activeMotionScene ? (
        <NativeMotionAssetOverlay
          activeScene={activeMotionScene}
          activeDecision={activeMotionGraphicsDecision}
          currentTimeMs={currentTimeMs}
          fps={videoMetadata.fps}
          outputWidth={videoMetadata.width}
          outputHeight={videoMetadata.height}
          videoIsPlaying={videoIsPlaying}
          videoPlaybackRate={videoPlaybackRate}
          choreographyState={activeChoreographyState}
          choreography3DEnabled={model.motion3DPlan.enabled}
        />
      ) : null}
        {activeChoreographyScene ? (
          <MotionChoreographyStage
            scene={activeChoreographyScene}
            currentTimeMs={currentTimeMs}
            zIndex={6}
          />
        ) : null}

        {activeShowcaseCue ? (
          <NativeShowcaseOverlay
            activeCue={activeShowcaseCue}
            model={model}
            currentTimeMs={currentTimeMs}
            previewViewportScale={previewViewportScale}
          />
        ) : null}
        {activeTransitionOverlayCue ? (
          <NativeTransitionOverlay
            cue={activeTransitionOverlayCue}
            currentTimeMs={currentTimeMs}
            fps={videoMetadata.fps}
            videoIsPlaying={videoIsPlaying}
            videoPlaybackRate={videoPlaybackRate}
          />
        ) : null}

        <NativeCaptionOverlay
          currentTimeMs={captionCurrentTimeMs}
          videoMetadata={videoMetadata}
          chunks={model.chunks}
          captionProfileId={captionProfileId}
          captionBias={model.captionBias}
          model={model}
          previewViewportScale={previewViewportScale}
          suppressCaptions={suppressCaptions}
        />

        {showMotionGraphicsDebugOverlay && activeMotionGraphicsDecision ? (
          <div
            style={{
              position: "absolute",
              right: 14,
              bottom: 14,
              zIndex: 30,
              width: 320,
              maxWidth: "calc(100% - 28px)",
              padding: "12px 14px",
              borderRadius: 16,
              background: "rgba(6, 10, 20, 0.88)",
              border: "1px solid rgba(148, 163, 184, 0.18)",
              boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
              color: "#E5EEF8",
              fontSize: 12,
              lineHeight: 1.45,
              backdropFilter: "blur(18px)",
              pointerEvents: "none"
            }}
          >
            <div style={{display: "grid", gap: 4}}>
              <strong style={{fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase"}}>Motion Graphics Agent</strong>
              <span>Scene: {activeMotionGraphicsDecision.sceneId}</span>
              <span>Transcript: {activeMotionGraphicsDecision.query.transcriptSegment}</span>
              <span>Assets: {activeMotionGraphicsDecision.debug.selectedAssetIds.join(", ") || "none"}</span>
              <span>Safe zones: {activeMotionGraphicsDecision.safeZones.map((zone) => zone.kind).join(", ")}</span>
              <span>Legacy overlay disabled: {activeMotionGraphicsDecision.debug.legacyBackgroundOverlayDisabled ? "true" : "false"}</span>
            </div>
            <div style={{display: "grid", gap: 2, marginTop: 8, color: "#C6D3E4"}}>
              <span>Rationale: {activeMotionGraphicsDecision.rationale}</span>
              <span>Mitigation: {model.motionGraphicsPlan.debug.mitigationSummary.join(" | ")}</span>
              <span>Layer stack: {activeMotionGraphicsDecision.debug.finalLayerStack.join(" > ")}</span>
            </div>
          </div>
        ) : null}

        {!audioUnlocked && totalSoundCueCount > 0 ? (
          <div className="preview-native-audio-hint">
            Tap play to enable soundtrack and cue audio.
          </div>
        ) : null}

        {!hasLoadedFrame ? (
          <div className="preview-native-loading">
            <strong>Preparing low-latency preview...</strong>
            <span>The video is loading while the lightweight overlay stage comes online.</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
