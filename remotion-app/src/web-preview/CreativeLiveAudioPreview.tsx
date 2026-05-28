import React, {type CSSProperties, useEffect, useMemo, useRef, useState} from "react";

import {SAMPLE_CREATIVE_ASSETS} from "../creative-orchestration/assets/sample-assets";
import type {
  CreativeOrchestrationDebugReport,
  CreativeTimeline,
  CreativeTrack
} from "../creative-orchestration/types";
import type {MotionCompositionModel} from "../lib/motion-platform/scene-engine";
import type {CaptionChunk, CaptionStyleProfileId, VideoMetadata} from "../lib/types";
import {
  buildLiveAudioSourceKey,
  selectActiveCreativeMoment,
  selectActiveCreativeTracks,
  resolveLiveCreativePreviewDurationMs
} from "./creative-live-audio-preview-utils";
import {NativePreviewOverlayStage} from "./NativePreviewStage";
import {createPreviewFrameSource} from "./frame-store";
import type {
  AudioCreativePreviewAudioStatus,
  AudioCreativePreviewState
} from "./audio-creative-preview-session";

export type CreativeLiveAudioPreviewProps = {
  readonly jobId: string;
  readonly audioSrc: string;
  readonly audioPending?: boolean;
  readonly audioPreparationError?: string | null;
  readonly durationMs: number;
  readonly captionChunks: CaptionChunk[];
  readonly captionProfileId: CaptionStyleProfileId;
  readonly creativeTimeline: CreativeTimeline;
  readonly debugReport?: CreativeOrchestrationDebugReport | null;
  readonly motionModel: MotionCompositionModel;
  readonly videoMetadata: Pick<VideoMetadata, "width" | "height" | "fps">;
  readonly showDebugOverlay?: boolean;
  readonly showPlaybackHud?: boolean;
  readonly sourceLabel?: string | null;
  readonly previewTimelineResetVersion?: number;
  readonly onPreviewStateChange?: (state: AudioCreativePreviewState) => void;
  readonly onAudioStatusChange?: (status: AudioCreativePreviewAudioStatus, errorMessage: string | null) => void;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;
const PLAYBACK_SYNC_INTERVAL_MS = 80;
const LIVE_AUDIO_GLOW_GAIN = 1.56;

const formatTimecode = (valueMs: number): string => {
  if (!Number.isFinite(valueMs) || valueMs <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(valueMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const buildAudioErrorMessage = (audio: HTMLAudioElement | null): string => {
  if (!audio?.error) {
    return "The audio source could not be loaded.";
  }

  if (audio.error.code === MediaError.MEDIA_ERR_ABORTED) {
    return "The audio load was interrupted.";
  }
  if (audio.error.code === MediaError.MEDIA_ERR_NETWORK) {
    return "The browser hit a network error while loading audio.";
  }
  if (audio.error.code === MediaError.MEDIA_ERR_DECODE) {
    return "The browser could not decode the audio stream.";
  }
  if (audio.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return "The selected audio format is not supported in this browser.";
  }

  return "The audio source could not be loaded.";
};

const backgroundStyleMap: Record<string, CSSProperties> = {
  "radial-spotlight": {
    background:
      "radial-gradient(circle at 50% 18%, rgba(214, 177, 107, 0.24), transparent 30%), radial-gradient(circle at 50% 55%, rgba(255, 255, 255, 0.06), transparent 42%), linear-gradient(180deg, rgba(6, 8, 13, 0.32), rgba(5, 7, 11, 0.9))"
  },
  "glass-gradient": {
    background:
      "linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(23, 37, 84, 0.56)), radial-gradient(circle at 75% 18%, rgba(99, 102, 241, 0.14), transparent 28%)"
  },
  "dark-vignette": {
    background:
      "radial-gradient(circle at 50% 18%, rgba(255, 214, 143, 0.14), transparent 30%), radial-gradient(circle at 50% 56%, rgba(147, 197, 253, 0.10), transparent 46%), linear-gradient(180deg, rgba(8, 12, 20, 0.48), rgba(7, 10, 18, 0.86))"
  },
  "blue-depth-glow": {
    background:
      "radial-gradient(circle at 50% 18%, rgba(96, 165, 250, 0.24), transparent 34%), radial-gradient(circle at 50% 56%, rgba(59, 130, 246, 0.12), transparent 46%), linear-gradient(180deg, rgba(6, 10, 22, 0.56), rgba(2, 6, 23, 0.94))"
  },
  "depth-fog": {
    background:
      "radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.08), transparent 30%), linear-gradient(180deg, rgba(10, 14, 24, 0.82), rgba(3, 7, 16, 0.98))"
  },
  "subtle-animated-background-grid": {
    backgroundImage:
      "linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px), radial-gradient(circle at 50% 18%, rgba(214, 177, 107, 0.12), transparent 32%)",
    backgroundSize: "56px 56px, 56px 56px, 100% 100%",
    backgroundPosition: "0 0, 0 0, center"
  },
  none: {
    background:
      "radial-gradient(circle at 50% 18%, rgba(214, 177, 107, 0.12), transparent 30%), radial-gradient(circle at 78% 22%, rgba(147, 197, 253, 0.10), transparent 28%), linear-gradient(180deg, rgba(6, 8, 13, 0.24), rgba(5, 7, 11, 0.82))"
  }
};

const positionStyles: Record<string, CSSProperties> = {
  "hero-center": {
    left: "50%",
    top: "17%"
  },
  center: {
    left: "50%",
    top: "50%"
  },
  "lower-third": {
    left: "7%",
    right: "7%",
    bottom: "12%"
  },
  "left-rail": {
    left: "7%",
    top: "26%"
  },
  "right-card": {
    right: "7%",
    top: "26%"
  },
  "behind-subject": {
    left: "50%",
    top: "36%"
  }
};

const getTrackPositionIntent = (track: CreativeTrack): string => {
  if (track.type === "text") {
    return String(track.payload["positionIntent"] ?? "center");
  }
  if (track.type === "asset") {
    return String(track.payload["placementIntent"] ?? "right-card");
  }
  return "center";
};

const getTrackPlacementStyle = (track: CreativeTrack): CSSProperties => {
  const positionIntent = getTrackPositionIntent(track);
  const baseStyle = positionStyles[positionIntent] ?? positionStyles.center;
  return {
    position: "absolute",
    zIndex: track.zIndex,
    pointerEvents: "none",
    ...baseStyle
  };
};

const getTrackPlacementTransform = (track: CreativeTrack): string => {
  const positionIntent = getTrackPositionIntent(track);
  if (positionIntent === "hero-center" || positionIntent === "behind-subject") {
    return "translateX(-50%)";
  }
  if (positionIntent === "center") {
    return "translate(-50%, -50%)";
  }
  return "";
};

const getProgress = (track: CreativeTrack, currentTimeMs: number): number => {
  const durationMs = Math.max(1, track.endMs - track.startMs);
  return clamp01((currentTimeMs - track.startMs) / durationMs);
};

const getTextMotionStyle = (track: CreativeTrack, currentTimeMs: number): CSSProperties => {
  const progress = getProgress(track, currentTimeMs);
  const mode = String(track.payload["mode"] ?? "full-caption");
  const animation = String(track.payload["animation"] ?? "blur-slide-up");
  const entryProgress = clamp01(progress / 0.35);
  const settleProgress = progress >= 0.65 ? clamp01((progress - 0.65) / 0.35) : 0;
  const positionIntent = String(track.payload["positionIntent"] ?? "center");
  const hero = mode === "title-card" || positionIntent === "hero-center";
  const slideDistance = hero ? 18 : animation === "word-stagger" ? 14 : 10;
  const scale = hero ? lerp(0.96, 1, entryProgress) : lerp(0.98, 1, entryProgress);
  const opacity = hero ? Math.max(0.84, 0.38 + entryProgress * 0.72) : Math.max(0.78, 0.3 + entryProgress * 0.78);

  return {
    transform: `translate3d(0, ${Math.round((1 - entryProgress) * slideDistance - settleProgress * 3)}px, 0) scale(${scale.toFixed(3)})`,
    opacity,
    transition: "transform 120ms linear, opacity 120ms linear"
  };
};

const getAssetMotionStyle = (track: CreativeTrack, currentTimeMs: number): CSSProperties => {
  const progress = getProgress(track, currentTimeMs);
  const usage = String(track.payload["usage"] ?? "background-visual");
  const scale = usage === "replace-text" ? lerp(0.975, 1.01, progress) : usage === "foreground-card" ? lerp(0.98, 1.015, progress) : lerp(0.985, 1, progress);
  const offsetY = usage === "replace-text" ? lerp(14, 0, progress) : lerp(10, 0, progress);
  return {
    transform: `translate3d(0, ${offsetY.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`,
    opacity: Math.max(0.72, 0.4 + progress * 0.72),
    transition: "transform 120ms linear, opacity 120ms linear"
  };
};

const getMotionStageStyle = (track: CreativeTrack | null, currentTimeMs: number): CSSProperties => {
  if (!track) {
    return {
      transform: "translate3d(0, 0, 0) scale(1)"
    };
  }

  const progress = getProgress(track, currentTimeMs);
  const choreography = String(track.payload["choreography"] ?? "gentle-drift");
  const layerDepth = Number(track.payload["layerDepth"] ?? 2);
  const enter = (track.payload["enter"] as {durationMs?: number} | undefined)?.durationMs ?? 400;
  const exit = (track.payload["exit"] as {durationMs?: number} | undefined)?.durationMs ?? 260;
  const enterProgress = clamp01((currentTimeMs - track.startMs) / Math.max(1, enter));
  const exitProgress = clamp01((track.endMs - currentTimeMs) / Math.max(1, exit));
  const visibility = currentTimeMs < track.startMs || currentTimeMs > track.endMs ? 0 : Math.min(enterProgress, exitProgress);
  const scaleBase = 1 + layerDepth * 0.0018;
  const scale = choreography === "depth-card-float"
    ? scaleBase + progress * 0.012
    : choreography === "zoom-through-layer"
      ? scaleBase + progress * 0.017
      : scaleBase + progress * 0.006;
  const translateY = choreography === "blur-slide-up"
    ? lerp(14, -2, enterProgress)
    : choreography === "light-sweep-reveal"
      ? lerp(8, 0, progress)
      : lerp(6, 0, progress);
  const translateX = choreography === "zoom-through-layer" ? lerp(-8, 0, progress) : 0;

  return {
    transform: `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`,
    opacity: clamp(visibility, 0.08, 1),
    transition: "transform 120ms linear, opacity 120ms linear"
  };
};

const getAssetName = (assetId: string): string => {
  return SAMPLE_CREATIVE_ASSETS.find((asset) => asset.id === assetId)?.name ?? assetId;
};

const buildBackgroundVisualStyle = (track: CreativeTrack | null, currentTimeMs: number): CSSProperties => {
  if (!track) {
    return backgroundStyleMap.none;
  }

  const style = String(track.payload["backgroundStyle"] ?? "none");
  const intensity = Number(track.payload["intensity"] ?? 0.5);
  const progress = getProgress(track, currentTimeMs);
  const opacity = clamp(0.24 + intensity * 0.62, 0.18, 0.92) * Math.max(0.72, progress);
  const baseStyle = backgroundStyleMap[style] ?? backgroundStyleMap.none;

  return {
    ...baseStyle,
    opacity,
    transition: "opacity 180ms linear, transform 180ms linear"
  };
};

const cardBaseStyle: CSSProperties = {
  position: "absolute",
  display: "grid",
  gap: 10,
  minWidth: 220,
  maxWidth: "min(640px, 78vw)",
  padding: "18px 20px",
  borderRadius: 22,
  border: "1px solid rgba(226, 232, 240, 0.14)",
  background: "rgba(10, 14, 24, 0.72)",
  boxShadow: "0 18px 48px rgba(0, 0, 0, 0.26)",
  color: "#F8FAFC"
};

const smallCapsStyle: CSSProperties = {
  color: "#D6B16B",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.18em",
  textTransform: "uppercase"
};

const stageRootStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr) auto",
  overflow: "hidden",
  background:
    "radial-gradient(circle at 50% 12%, rgba(214, 177, 107, 0.12), transparent 30%), linear-gradient(180deg, #05070b 0%, #02040a 100%)",
  color: "#F8FAFC"
};

const stageViewportStyle: CSSProperties = {
  position: "relative",
  minHeight: 0,
  overflow: "hidden",
  borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
  boxShadow: `inset 0 -56px 96px rgba(2, 4, 10, ${(0.22 * LIVE_AUDIO_GLOW_GAIN).toFixed(3)})`
};

const stageChromeStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "transparent",
  pointerEvents: "none"
};

const visualGridStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)",
  backgroundSize: "52px 52px",
  opacity: 0.26,
  maskImage: "linear-gradient(180deg, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.24))",
  pointerEvents: "none"
};

const topHudStyle: CSSProperties = {
  position: "absolute",
  inset: "16px 16px auto 16px",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  pointerEvents: "none",
  zIndex: 12
};

const hudPanelStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "14px 16px",
  borderRadius: 18,
  border: "1px solid rgba(148, 163, 184, 0.16)",
  background: "linear-gradient(180deg, rgba(9, 13, 22, 0.7), rgba(5, 8, 14, 0.82))",
  boxShadow: `0 24px 72px rgba(0, 0, 0, 0.34), 0 0 46px rgba(84, 120, 255, ${(0.08 * LIVE_AUDIO_GLOW_GAIN).toFixed(3)})`
};

const bottomControlsStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gap: 10,
  padding: "10px 14px 14px",
  borderTop: "1px solid rgba(148, 163, 184, 0.1)",
  background:
    "linear-gradient(180deg, rgba(7, 10, 16, 0.78), rgba(4, 6, 10, 0.94))",
  boxShadow: `0 -24px 54px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.04), inset 0 22px 44px rgba(74, 96, 170, ${(0.05 * LIVE_AUDIO_GLOW_GAIN).toFixed(3)})`,
  zIndex: 14
};

const controlsRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  padding: "10px 12px",
  borderRadius: 16,
  border: "1px solid rgba(148, 163, 184, 0.1)",
  background: "linear-gradient(180deg, rgba(10, 14, 22, 0.78), rgba(7, 10, 16, 0.92))",
  boxShadow: `0 16px 34px rgba(0, 0, 0, 0.18), 0 0 28px rgba(88, 112, 214, ${(0.06 * LIVE_AUDIO_GLOW_GAIN).toFixed(3)})`
};

const progressTrackStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: 8,
  borderRadius: 999,
  background: "rgba(148, 163, 184, 0.14)",
  overflow: "hidden",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)"
};

const timelineRailStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  minHeight: 14,
  flexWrap: "nowrap",
  width: "100%",
  padding: "0 2px"
};

const debugPanelStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  width: 280,
  display: "grid",
  gap: 8,
  padding: 14,
  borderRadius: 18,
  border: "1px solid rgba(96, 165, 250, 0.22)",
  background: "rgba(2, 6, 23, 0.72)",
  color: "#E2E8F0",
  zIndex: 16
};

const buttonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "9px 13px",
  borderRadius: 999,
  border: "1px solid rgba(226, 232, 240, 0.14)",
  background: "linear-gradient(180deg, rgba(19, 28, 48, 0.94), rgba(11, 16, 29, 0.98))",
  color: "#F8FAFC",
  fontWeight: 800,
  letterSpacing: "0.05em",
  cursor: "pointer",
  boxShadow: `0 10px 22px rgba(0, 0, 0, 0.22), 0 0 22px rgba(92, 120, 255, ${(0.09 * LIVE_AUDIO_GLOW_GAIN).toFixed(3)})`
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.46,
  cursor: "not-allowed"
};

type OverlayStageBoundaryProps = {
  readonly children: React.ReactNode;
  readonly resetKey: string;
  readonly onError: (message: string) => void;
};

type OverlayStageBoundaryState = {
  hasError: boolean;
};

class OverlayStageBoundary extends React.Component<OverlayStageBoundaryProps, OverlayStageBoundaryState> {
  state: OverlayStageBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(): OverlayStageBoundaryState {
    return {hasError: true};
  }

  componentDidCatch(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.props.onError(message);
  }

  componentDidUpdate(prevProps: OverlayStageBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({hasError: false});
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

export const CreativeLiveAudioPreview: React.FC<CreativeLiveAudioPreviewProps> = ({
  jobId,
  audioSrc,
  audioPending = false,
  audioPreparationError = null,
  durationMs,
  captionChunks,
  captionProfileId,
  creativeTimeline,
  debugReport,
  motionModel,
  videoMetadata,
  showDebugOverlay = true,
  showPlaybackHud = true,
  sourceLabel,
  previewTimelineResetVersion = 0,
  onPreviewStateChange,
  onAudioStatusChange
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackIntervalRef = useRef<number | null>(null);
  const frameSource = useMemo(() => createPreviewFrameSource(), []);
  const previewStateRef = useRef<AudioCreativePreviewState>("idle");
  const initialAudioStatus: AudioCreativePreviewAudioStatus = audioPreparationError
    ? "error"
    : audioPending
      ? "loading"
      : audioSrc.trim().length > 0
        ? "loading"
        : "missing";
  const audioStatusRef = useRef<AudioCreativePreviewAudioStatus>(initialAudioStatus);
  const autoPlayRequestedRef = useRef(true);
  const lastCommittedTimeRef = useRef(0);
  const previewStateCallbackRef = useRef(onPreviewStateChange);
  const audioStatusCallbackRef = useRef(onAudioStatusChange);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioStatus, setAudioStatus] = useState<AudioCreativePreviewAudioStatus>(initialAudioStatus);
  const [audioErrorMessage, setAudioErrorMessage] = useState<string | null>(audioPreparationError);
  const [overlayStageError, setOverlayStageError] = useState<string | null>(null);
  const syncFrameSource = (timeMs: number): void => {
    frameSource.setFrame(Math.max(0, Math.round((timeMs / 1000) * videoMetadata.fps)));
  };
  const resolvedDurationMs = useMemo(
    () =>
      resolveLiveCreativePreviewDurationMs({
        providedDurationMs: durationMs,
        creativeTimeline
      }),
    [creativeTimeline, durationMs]
  );
  const activeTracks = useMemo(
    () => selectActiveCreativeTracks(creativeTimeline, currentTimeMs),
    [creativeTimeline, currentTimeMs]
  );
  const activeMoment = useMemo(
    () => selectActiveCreativeMoment(creativeTimeline, currentTimeMs),
    [creativeTimeline, currentTimeMs]
  );
  const timelineProgress = clamp01(currentTimeMs / Math.max(1, resolvedDurationMs));
  const activeTrackIds = activeTracks.map((track) => track.id);
  const debugTimeline = debugReport?.finalCreativeTimeline ?? creativeTimeline;
  const renderJobActive = false;
  const playbackReady = audioSrc.trim().length > 0 && !audioPending && audioStatus !== "error";

  useEffect(() => {
    previewStateCallbackRef.current = onPreviewStateChange;
  }, [onPreviewStateChange]);

  useEffect(() => {
    audioStatusCallbackRef.current = onAudioStatusChange;
  }, [onAudioStatusChange]);

  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current !== null) {
        window.clearInterval(playbackIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (playbackIntervalRef.current !== null) {
      window.clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    setCurrentTimeMs(0);
    syncFrameSource(0);
    lastCommittedTimeRef.current = 0;
    setIsPlaying(false);
    setAudioErrorMessage(audioPreparationError);
    setOverlayStageError(null);

    const nextStatus: AudioCreativePreviewAudioStatus = audioPreparationError
      ? "error"
      : audioPending
        ? "loading"
        : audioSrc.trim().length > 0
          ? "loading"
          : "missing";
    setAudioStatus(nextStatus);
    audioStatusRef.current = nextStatus;
    autoPlayRequestedRef.current = true;
    previewStateRef.current = "ready";
    previewStateCallbackRef.current?.("ready");
    audioStatusCallbackRef.current?.(nextStatus, audioPreparationError);

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [audioPreparationError, audioPending, audioSrc, previewTimelineResetVersion]);

  useEffect(() => {
    const nextState: AudioCreativePreviewState = isPlaying ? "playing" : "ready";
    if (previewStateRef.current !== nextState) {
      previewStateRef.current = nextState;
      previewStateCallbackRef.current?.(nextState);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioStatusRef.current === audioStatus && audioErrorMessage === null) {
      return;
    }

    audioStatusRef.current = audioStatus;
    audioStatusCallbackRef.current?.(audioStatus, audioErrorMessage);
  }, [audioErrorMessage, audioStatus]);

  useEffect(() => {
    if (audioPending || audioStatus !== "ready" || !audioRef.current || !autoPlayRequestedRef.current || isPlaying) {
      return;
    }

    let cancelled = false;
    void audioRef.current.play().then(() => {
      if (!cancelled) {
        setIsPlaying(true);
      }
    }).catch(() => {
      if (!cancelled) {
        setIsPlaying(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [audioPending, audioStatus, isPlaying, audioSrc, previewTimelineResetVersion]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    playbackIntervalRef.current = window.setInterval(() => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }

      const nextTimeMs = Math.max(0, audio.currentTime * 1000);
      if (Math.abs(nextTimeMs - lastCommittedTimeRef.current) >= PLAYBACK_SYNC_INTERVAL_MS || audio.paused || audio.ended) {
        lastCommittedTimeRef.current = nextTimeMs;
        setCurrentTimeMs(nextTimeMs);
        syncFrameSource(nextTimeMs);
      }
    }, PLAYBACK_SYNC_INTERVAL_MS);

    return () => {
      if (playbackIntervalRef.current !== null) {
        window.clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.info("[CreativeLiveAudioPreview]", {
        jobId,
        audioSrcPresent: Boolean(audioSrc.trim()),
        durationMs: resolvedDurationMs,
        trackCount: creativeTimeline.tracks.length,
        momentCount: creativeTimeline.moments.length,
        audioStatus,
        audioErrorMessage,
        previewState: isPlaying ? "playing" : "ready",
        renderJobActive,
        videoLoaded: false,
        activeTrackCount: activeTrackIds.length
      });
    }
  }, [
    audioErrorMessage,
    audioStatus,
    audioSrc,
    creativeTimeline.moments.length,
    creativeTimeline.tracks.length,
    isPlaying,
    jobId,
    renderJobActive,
    resolvedDurationMs
  ]);

  const syncAudioTime = (): void => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const nextTimeMs = Math.max(0, audio.currentTime * 1000);
    lastCommittedTimeRef.current = nextTimeMs;
    setCurrentTimeMs(nextTimeMs);
    syncFrameSource(nextTimeMs);
  };

  const requestPlayback = (): void => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audioPending) {
      setAudioStatus("loading");
      setAudioErrorMessage("The optimized audio preview is still being prepared.");
      audioStatusCallbackRef.current?.("loading", "The optimized audio preview is still being prepared.");
      return;
    }

    if (!audioSrc.trim()) {
      const message = audioPreparationError ?? "No audio source is loaded yet.";
      setAudioStatus(audioPreparationError ? "error" : "missing");
      setAudioErrorMessage(message);
      audioStatusCallbackRef.current?.(audioPreparationError ? "error" : "missing", message);
      return;
    }

    autoPlayRequestedRef.current = true;
    setAudioErrorMessage(null);
    setAudioStatus("ready");
    audioStatusCallbackRef.current?.("ready", null);
    void audio.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      setIsPlaying(false);
    });
  };

  const pausePlayback = (): void => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    autoPlayRequestedRef.current = false;
    audio.pause();
    syncAudioTime();
    setIsPlaying(false);
  };

  const seekPlayback = (nextTimeMs: number): void => {
    const audio = audioRef.current;
    const clampedTimeMs = clamp(nextTimeMs, 0, resolvedDurationMs);
    setCurrentTimeMs(clampedTimeMs);
    syncFrameSource(clampedTimeMs);
    lastCommittedTimeRef.current = clampedTimeMs;
    if (audio) {
      audio.currentTime = clampedTimeMs / 1000;
    }
  };

  const handleAudioError = (): void => {
    const audio = audioRef.current;
    const message = buildAudioErrorMessage(audio);
    setAudioStatus("error");
    setAudioErrorMessage(message);
    setIsPlaying(false);
    autoPlayRequestedRef.current = false;
    audioStatusCallbackRef.current?.("error", message);
  };

  const handleLoadedMetadata = (): void => {
    setAudioStatus("ready");
    setAudioErrorMessage(null);
    syncAudioTime();
    audioStatusCallbackRef.current?.("ready", null);
  };

  const handleCanPlay = (): void => {
    setAudioStatus("ready");
    setAudioErrorMessage(null);
    audioStatusCallbackRef.current?.("ready", null);
  };

  const handlePlay = (): void => {
    setIsPlaying(true);
    autoPlayRequestedRef.current = true;
    setAudioStatus("ready");
    setAudioErrorMessage(null);
    previewStateCallbackRef.current?.("playing");
    audioStatusCallbackRef.current?.("ready", null);
  };

  const handlePause = (): void => {
    setIsPlaying(false);
    syncAudioTime();
    previewStateCallbackRef.current?.("ready");
  };

  const handleEnded = (): void => {
    setIsPlaying(false);
    syncAudioTime();
    previewStateCallbackRef.current?.("ready");
  };

  const handleSeeked = (): void => {
    syncAudioTime();
  };

  const handleTimeUpdate = (): void => {
    syncAudioTime();
  };

  const timelineSegments = creativeTimeline.moments.map((moment) => {
    const active = currentTimeMs >= moment.startMs && currentTimeMs <= moment.endMs;
    const widthPercent = Math.max(2, ((moment.endMs - moment.startMs) / Math.max(1, resolvedDurationMs)) * 100);
    return (
      <div
        key={moment.id}
        title={`${moment.momentType}: ${moment.transcriptText}`}
        style={{
          flex: `0 0 ${widthPercent}%`,
          minWidth: 14,
          height: 16,
          borderRadius: 999,
          background: active ? "linear-gradient(90deg, #D6B16B, #93C5FD)" : "rgba(148, 163, 184, 0.22)",
          border: active ? "1px solid rgba(255, 255, 255, 0.18)" : "1px solid rgba(255, 255, 255, 0.08)"
        }}
      />
    );
  });

  return (
    <div style={stageRootStyle}>
      <audio
        key={buildLiveAudioSourceKey({jobId, audioSrc, previewTimelineResetVersion})}
        ref={audioRef}
        src={audioSrc.trim().length > 0 ? audioSrc : undefined}
        preload="auto"
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onSeeking={syncAudioTime}
        onSeeked={handleSeeked}
        onError={handleAudioError}
        aria-hidden="true"
        style={{display: "none"}}
      />

      <div style={stageViewportStyle} data-live-audio-stage-viewport="true">
        <OverlayStageBoundary
          resetKey={`${jobId}:${previewTimelineResetVersion}:${audioSrc}`}
          onError={(message) => {
            setOverlayStageError(message);
          }}
        >
          <NativePreviewOverlayStage
            videoMetadata={videoMetadata}
            model={motionModel}
            captionProfileId={captionProfileId}
            frameSource={frameSource}
            previewPerformanceMode="balanced"
          />
        </OverlayStageBoundary>

        <div style={stageChromeStyle}>
        {showPlaybackHud ? (
          <div style={topHudStyle}>
          <div style={{...hudPanelStyle, maxWidth: "72%"}}>
            <div style={{display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", color: "#94A3B8", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase"}}>
              <span>Native Audio Clock</span>
              <span>|</span>
              <span>{creativeTimeline.moments.length} moments</span>
              <span>|</span>
              <span>{activeTracks.length} active tracks</span>
              <span>|</span>
              <span>{isPlaying ? "playing" : "ready"}</span>
            </div>
            <strong style={{fontSize: "clamp(22px, 4vw, 42px)", lineHeight: 1.02}}>
              {activeMoment ? activeMoment.momentType : "timeline pending"}
            </strong>
            <span style={{fontSize: 14, lineHeight: 1.48, color: "#E2E8F0"}}>
              {activeMoment
                ? `${formatTimecode(activeMoment.startMs)} – ${formatTimecode(activeMoment.endMs)} | ${activeMoment.transcriptText}`
                : "The browser stage will light up as soon as the creative timeline exists."}
            </span>
          </div>

          <div style={{...hudPanelStyle, minWidth: 220}}>
            <span style={smallCapsStyle}>audio status</span>
            <strong style={{fontSize: 16, lineHeight: 1.3}}>
              {audioPending
                ? "Preparing optimized audio"
                : audioStatus === "missing"
                ? "No audio source"
                : audioStatus === "loading"
                  ? "Audio loading"
                  : audioStatus === "error"
                    ? "Audio error"
                    : isPlaying
                      ? "Audio playing"
                      : "Audio ready"}
            </strong>
            <span style={{fontSize: 13, lineHeight: 1.4, color: "#CBD5E1"}}>
              {overlayStageError
                ? `Overlay fallback active: ${overlayStageError}`
                : (audioErrorMessage ?? sourceLabel ?? "Live browser preview")}
            </span>
          </div>
          </div>
        ) : null}

          {showDebugOverlay ? (
            <div style={debugPanelStyle}>
              <span style={smallCapsStyle}>debug overlay</span>
              <strong style={{fontSize: 16, lineHeight: 1.3}}>Audio Creative Preview</strong>
              <div style={{display: "grid", gap: 4, fontSize: 13, lineHeight: 1.45, color: "#CBD5E1"}}>
                <span>Duration: {formatTimecode(resolvedDurationMs)}</span>
                <span>Current: {formatTimecode(currentTimeMs)}</span>
                <span>Caption chunks: {captionChunks.length}</span>
                <span>Track count: {creativeTimeline.tracks.length}</span>
                <span>Active track ids: {activeTrackIds.length ? activeTrackIds.join(", ") : "none"}</span>
                <span>Showcase cues: {motionModel.showcasePlan.cues.length}</span>
                <span>Background cues: {motionModel.backgroundOverlayPlan.cues.length}</span>
                <span>Motion agent active: {motionModel.motionGraphicsPlan.enabled ? "true" : "false"}</span>
                <span>Legacy background disabled: {motionModel.motionGraphicsPlan.disableLegacyBackgroundOverlay ? "true" : "false"}</span>
                <span>Audio loaded: {audioStatus !== "missing" && audioStatus !== "error" ? "true" : "false"}</span>
                <span>Video loaded: false</span>
                <span>Render job active: false</span>
              </div>
              {debugTimeline.diagnostics.warnings.length > 0 ? (
                <div style={{display: "grid", gap: 4}}>
                  <span style={smallCapsStyle}>warnings</span>
                  {debugTimeline.diagnostics.warnings.slice(0, 3).map((warning) => (
                    <span key={warning} style={{fontSize: 12, lineHeight: 1.35, color: "#FDE68A"}}>{warning}</span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div style={bottomControlsStyle} data-live-audio-control-dock="true">
        <div style={controlsRowStyle}>
          <button
            type="button"
            style={playbackReady ? buttonStyle : disabledButtonStyle}
            onClick={isPlaying ? pausePlayback : requestPlayback}
            disabled={!playbackReady && !isPlaying}
          >
            {isPlaying ? "Pause" : audioPending ? "Preparing Audio" : audioStatus === "error" ? "Audio Error" : "Play"}
          </button>
          <button
            type="button"
            style={playbackReady ? buttonStyle : disabledButtonStyle}
            onClick={() => seekPlayback(0)}
            disabled={!playbackReady}
          >
            Restart
          </button>
          <div style={{display: "grid", gap: 5, flex: "1 1 320px", minWidth: 220}}>
            <div style={progressTrackStyle}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${Math.round(timelineProgress * 100)}%`,
                  background: "linear-gradient(90deg, rgba(214, 177, 107, 0.96), rgba(147, 197, 253, 0.96))",
                  borderRadius: 999,
                  boxShadow: `0 0 18px rgba(147, 197, 253, ${(0.18 * LIVE_AUDIO_GLOW_GAIN).toFixed(3)})`
                }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={resolvedDurationMs}
              value={Math.min(currentTimeMs, resolvedDurationMs)}
              step={16}
              onChange={(event) => seekPlayback(Number(event.target.value))}
              style={{width: "100%"}}
            />
          </div>
          <div style={{display: "grid", gap: 2, minWidth: 148}}>
            <strong style={{fontSize: 13, lineHeight: 1.2}}>
              {formatTimecode(currentTimeMs)} / {formatTimecode(resolvedDurationMs)}
            </strong>
            <span style={{fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
              {sourceLabel ?? jobId}
            </span>
          </div>
        </div>

        {showPlaybackHud ? (
          <div style={timelineRailStyle}>
            {timelineSegments}
          </div>
        ) : null}
      </div>
    </div>
  );
};
