import React, {lazy, useEffect, useMemo, useRef, useState} from "react";

import type {LiveAudioPreviewBackendState} from "./CreativeAudioLivePlayer";
import type {
  AudioCreativePreviewAudioStatus,
  AudioCreativePreviewState
} from "./audio-creative-preview-session";
import {MusicDjControlPanel} from "../components/music/MusicDjControlPanel";
import {isMusicCatalogPanelEnabled} from "../components/music/MusicCatalogPanel";
import {getCaptionStyleProfile} from "../lib/stylebooks/caption-style-profiles";

type CaptionProfileId =
  | "longform_svg_typography_v1"
type MotionTier = "premium" | "hero" | "editorial";
type DeliveryMode = "speed-draft" | "master-render";
type LivePreviewRenderer = "hyperframes" | "remotion";
type BackendHealth = "checking" | "connected" | "offline";
type LocalPreviewState = "idle" | "running" | "completed" | "failed";
type LocalPreviewStage = "idle" | "cleaning" | "ingesting" | "drafting" | "mastering" | "completed" | "failed";
type LocalPreviewOutputKind = "none" | "source-preview" | "speed-draft" | "master-render";
type DevLivePreviewLaunch = {
  sourcePath: string;
  captionProfileId: CaptionProfileId;
  motionTier: MotionTier;
};
type PreviewShellVariant = "hyperframes-shell" | "remotion-only";
type PreviewShellConfig = {
  variant: PreviewShellVariant;
  headerKicker: string;
  headerTitle: string;
  headerCopy: string;
  setupHeading: string;
  setupModeLabels: string[];
  pathFieldHelpText: string;
  emptyPreviewMessage: string;
  showDeliveryModePicker: boolean;
  showRendererComparison: boolean;
  showPreviewDownloads: boolean;
  showCleanRunToggle: boolean;
  showPipelinePanel: boolean;
  showLiveLogPanel: boolean;
};
const CreativeAudioLivePlayer = lazy(async () => {
  const module = await import("./CreativeAudioLivePlayer");
  return {default: module.CreativeAudioLivePlayer};
});
const DEFAULT_LIVE_PREVIEW_RENDERER: LivePreviewRenderer = "remotion";
const DEFAULT_CAPTION_PROFILE_ID: CaptionProfileId = "longform_svg_typography_v1";
const DEFAULT_MOTION_TIER: MotionTier = "premium";

export const resolveLivePreviewRendererFromSearch = (search: string): LivePreviewRenderer => {
  const params = new URLSearchParams(search);
  const previewLane = params.get("previewLane")?.trim().toLowerCase();
  return previewLane === "hyperframes" ? "hyperframes" : DEFAULT_LIVE_PREVIEW_RENDERER;
};

export const resolvePreviewShellVariant = (previewRenderer: LivePreviewRenderer): PreviewShellVariant => {
  return previewRenderer === "hyperframes" ? "hyperframes-shell" : "remotion-only";
};

export const resolvePreviewShellConfig = (previewRenderer: LivePreviewRenderer): PreviewShellConfig => {
  if (previewRenderer === "hyperframes") {
    return {
      variant: "hyperframes-shell",
      headerKicker: "Prometheus Long-Form Render Control",
      headerTitle: "Pick the lane. Preview should converge on a governed cinematic artifact, not a browser overlay hack.",
      headerCopy:
        "The frontend should request preview jobs, receive governed output, and show diagnostics. The backend owns typography, motion decisions, and render authority.",
      setupHeading: "Run Setup",
      setupModeLabels: ["Live Compositor", "Final Render", "Hyperframes Preview"],
      pathFieldHelpText:
        "Local paths are used by backend-assisted previews and final renders. Uploaded videos play directly in the browser when available.",
      emptyPreviewMessage:
        "Run the live preview and the active interactive preview surface will appear here when the backend session starts streaming.",
      showDeliveryModePicker: true,
      showRendererComparison: true,
      showPreviewDownloads: true,
      showCleanRunToggle: true,
      showPipelinePanel: true,
      showLiveLogPanel: true
    };
  }

  return {
    variant: "remotion-only",
    headerKicker: "Remotion Preview",
    headerTitle: "Local interactive preview for the project-scoped Remotion composition.",
    headerCopy:
      "Load a local clip, start a live preview session, and inspect the Remotion player path backed by the edit-session SSE stream.",
    setupHeading: "Remotion Preview Setup",
    setupModeLabels: [],
    pathFieldHelpText:
      "Local paths are posted to the live-preview session endpoint for local development. Uploaded videos play directly in the browser when available.",
    emptyPreviewMessage:
      "Start Remotion Preview to attach a live edit session and mount the Remotion player here.",
    showDeliveryModePicker: false,
    showRendererComparison: false,
    showPreviewDownloads: false,
    showCleanRunToggle: false,
    showPipelinePanel: false,
    showLiveLogPanel: false
  };
};

const resolveCaptionProfileIdFromSearch = (candidate: string | null | undefined): CaptionProfileId => {
  return candidate?.trim() === DEFAULT_CAPTION_PROFILE_ID
    ? DEFAULT_CAPTION_PROFILE_ID
    : DEFAULT_CAPTION_PROFILE_ID;
};

const resolveMotionTierFromSearch = (candidate: string | null | undefined): MotionTier => {
  const normalized = candidate?.trim().toLowerCase();
  if (normalized === "hero" || normalized === "editorial" || normalized === "premium") {
    return normalized;
  }

  return DEFAULT_MOTION_TIER;
};

export const resolveDevLivePreviewLaunchFromSearch = (search: string): DevLivePreviewLaunch | null => {
  const params = new URLSearchParams(search);
  const sourcePath = params.get("sourcePath")?.trim() ?? "";
  if (!sourcePath) {
    return null;
  }

  return {
    sourcePath,
    captionProfileId: resolveCaptionProfileIdFromSearch(params.get("captionProfileId")),
    motionTier: resolveMotionTierFromSearch(params.get("motionTier"))
  };
};

export const resolveMusicDjJobIdFromSearch = (search: string): string | null => {
  const params = new URLSearchParams(search);
  const jobId = params.get("jobId")?.trim() ?? "";
  return jobId || null;
};

const isLiveAudioPreviewLane = (deliveryMode: DeliveryMode): boolean => {
  return deliveryMode === "speed-draft";
};

type LocalPreviewStatus = {
  state: LocalPreviewState;
  stage: LocalPreviewStage;
  stageLabel: string;
  sourceVideoPath: string | null;
  sourceDisplayName: string | null;
  uploadedFromBrowser: boolean;
  deliveryMode: DeliveryMode;
  activeOutputKind: LocalPreviewOutputKind;
  cleanRun: boolean;
  captionProfileId: CaptionProfileId;
  motionTier: MotionTier | "auto" | "minimal";
  transcriptionMode: "assemblyai";
  startedAt: string | null;
  finishedAt: string | null;
  outputUrl: string | null;
  outputPath: string | null;
  draftOutputUrl: string | null;
  draftOutputPath: string | null;
  masterOutputUrl: string | null;
  masterOutputPath: string | null;
  errorMessage: string | null;
  stageTimingsMs: {
    cleanup: number;
    ingest: number;
    draftRender: number;
    masterRender: number;
    render: number;
    total: number;
  };
  ingestSummary: {
    syncState?: string;
    transcriptionProvider?: string;
    transcriptionMode?: string;
    sourceVideoHash?: string;
  } | null;
  draftManifest: Record<string, unknown> | null;
  masterManifest: Record<string, unknown> | null;
  logs: string[];
};

type InstantPreviewWord = {
  text: string;
  startMs: number;
  endMs: number;
};

type InstantPreviewCaption = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  words: InstantPreviewWord[];
};

type InstantPreviewPayload = {
  ready: boolean;
  videoUrl: string | null;
  sourceDisplayName: string | null;
  captionProfileId: CaptionProfileId;
  motionTier: MotionTier | "auto" | "minimal";
  generatedAt: string | null;
  videoMetadata: {
    width?: number;
    height?: number;
    fps?: number;
    durationSeconds?: number;
    durationInFrames?: number;
  } | null;
  captions: InstantPreviewCaption[];
  motionSummary: {
    selected: number;
    flagged: number;
    suppressed: number;
  };
};

const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

const captionOptions: Array<{value: CaptionProfileId; label: string; description: string}> = [
  {
    value: DEFAULT_CAPTION_PROFILE_ID,
    label: "Governed SVG Typography",
    description: "Locked premium preview lane. Session-coherent SVG typography with no alternate caption renderer routing."
  }
];

const motionOptions: Array<{value: MotionTier; label: string; description: string}> = [
  {
    value: DEFAULT_MOTION_TIER,
    label: "Premium",
    description: "Recommended. Strong motion graphics and sound design without crowding the frame."
  },
  {
    value: "hero",
    label: "Hero",
    description: "More aggressive motion and transitions. Best when you want the fullest animated pass."
  },
  {
    value: "editorial",
    label: "Editorial",
    description: "Cleaner and lighter if the speech needs more visual restraint."
  }
];

const deliveryModeOptions: Array<{value: DeliveryMode; label: string; description: string}> = [
  {
    value: "speed-draft",
    label: "Live Compositor",
    description: "Recommended. Hyperframes builds the governed preview composition while the backend prepares the first artifact."
  },
  {
    value: "master-render",
    label: "Final Render",
    description: "Uses the Remotion export lane for the heavier cinematic bake and final MP4."
  }
];

const emptyStatus: LocalPreviewStatus = {
  state: "idle",
  stage: "idle",
  stageLabel: "Open the live compositor or start the final render lane.",
  sourceVideoPath: null,
  sourceDisplayName: null,
  uploadedFromBrowser: false,
  deliveryMode: "speed-draft",
  activeOutputKind: "none",
  cleanRun: true,
  captionProfileId: "longform_svg_typography_v1",
  motionTier: "premium",
  transcriptionMode: "assemblyai",
  startedAt: null,
  finishedAt: null,
  outputUrl: null,
  outputPath: null,
  draftOutputUrl: null,
  draftOutputPath: null,
  masterOutputUrl: null,
  masterOutputPath: null,
  errorMessage: null,
  stageTimingsMs: {
    cleanup: 0,
    ingest: 0,
    draftRender: 0,
    masterRender: 0,
    render: 0,
    total: 0
  },
  ingestSummary: null,
  draftManifest: null,
  masterManifest: null,
  logs: []
};

const formatDuration = (valueMs: number): string => {
  if (valueMs <= 0) {
    return "0s";
  }

  if (valueMs < 1000) {
    return `${valueMs}ms`;
  }

  return `${(valueMs / 1000).toFixed(1)}s`;
};

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "Not started";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const getStageTone = (state: LocalPreviewState): "neutral" | "success" | "warning" | "danger" => {
  if (state === "completed") {
    return "success";
  }
  if (state === "running") {
    return "warning";
  }
  if (state === "failed") {
    return "danger";
  }
  return "neutral";
};

type PipelineItemState = "idle" | "active" | "done" | "skipped";

const buildPipelineItems = (
  status: LocalPreviewStatus,
  localAudioPreviewState: AudioCreativePreviewState,
  deliveryMode: DeliveryMode,
  livePreviewState: LiveAudioPreviewBackendState | null
): Array<{label: string; state: PipelineItemState}> => {
  const stageOrder: LocalPreviewStage[] = ["cleaning", "ingesting", "drafting", "mastering", "completed"];
  const currentIndex = stageOrder.indexOf(status.stage);
  const localAudioPreviewActive = localAudioPreviewState !== "idle";
  const liveSessionActive = Boolean(livePreviewState?.sessionId);

  return [
    {
      label: "AssemblyAI + Captions",
      state: deliveryMode === "speed-draft"
        ? livePreviewState?.transcriptStatus === "full_transcript_ready"
          ? "done"
          : livePreviewState?.transcriptStatus === "full_transcript_pending" ||
              livePreviewState?.previewStatus === "preview_pending" ||
              livePreviewState?.previewStatus === "preview_placeholder_ready" ||
              livePreviewState?.previewStatus === "preview_text_ready" ||
              liveSessionActive
            ? "active"
            : "idle"
        : status.stageTimingsMs.ingest > 0 || currentIndex > stageOrder.indexOf("ingesting")
          ? "done"
          : status.stage === "ingesting"
            ? "active"
            : "idle"
    },
    {
      label: "Overlay Timeline",
      state: deliveryMode === "speed-draft"
        ? livePreviewState?.overlayReady
          ? "done"
          : livePreviewState?.previewLineCount || livePreviewState?.previewMotionCueCount || localAudioPreviewState === "building-timeline"
            ? "active"
            : "idle"
        : status.ingestSummary?.syncState === "ready" || currentIndex > stageOrder.indexOf("ingesting")
          ? "done"
          : status.stage === "ingesting"
            ? "active"
            : "idle"
    },
    {
      label: "Preview Lane",
      state:
        deliveryMode === "speed-draft"
          ? localAudioPreviewState === "building-timeline"
            ? "active"
            : localAudioPreviewState === "ready" || localAudioPreviewState === "playing"
              ? "done"
              : "idle"
          : status.draftOutputUrl || status.stageTimingsMs.draftRender > 0 || currentIndex > stageOrder.indexOf("drafting")
            ? "done"
            : status.stage === "drafting"
              ? "active"
              : localAudioPreviewActive
                ? "active"
                : "idle"
    },
    {
      label: "Master Render",
      state:
        deliveryMode === "speed-draft"
          ? "skipped"
          : status.masterOutputUrl || status.stageTimingsMs.masterRender > 0 || status.activeOutputKind === "master-render"
            ? "done"
            : status.stage === "mastering"
              ? "active"
              : "idle"
    }
  ];
};

const getPreviewUrl = (url: string | null | undefined): string | null => {
  if (!url) {
    return null;
  }

  return url.startsWith("http") ? url : url;
};

const isInstantPreviewUsable = (preview: InstantPreviewPayload | null): preview is InstantPreviewPayload => {
  return Boolean(preview?.ready && preview.videoUrl && preview.captions.length > 0);
};

const probeBackendAvailability = async (apiBase: string): Promise<boolean> => {
  try {
    const response = await fetch(`${apiBase.replace(/\/+$/, "")}/health`, {
      cache: "no-store"
    });
    return response.ok;
  } catch {
    return false;
  }
};

const InstantOverlayPreview: React.FC<{
  preview: InstantPreviewPayload;
  badge: string;
}> = ({preview, badge}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const videoUrl = getPreviewUrl(preview.videoUrl) ?? "";
  const activeCaption = useMemo(() => {
    return preview.captions.find((caption) => {
      return currentTimeMs >= caption.startMs && currentTimeMs <= caption.endMs + 160;
    }) ?? null;
  }, [currentTimeMs, preview.captions]);

  useEffect(() => {
    setCurrentTimeMs(0);
  }, [videoUrl]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const syncTime = (): void => {
    const video = videoRef.current;
    if (video) {
      setCurrentTimeMs(Math.max(0, video.currentTime * 1000));
    }
  };

  const startSyncLoop = (): void => {
    const tick = (): void => {
      syncTime();
      if (!videoRef.current?.paused && !videoRef.current?.ended) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
      }
    };

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = window.requestAnimationFrame(tick);
  };

  const captionProgress = activeCaption
    ? Math.max(0, Math.min(1, (currentTimeMs - activeCaption.startMs) / Math.max(1, activeCaption.endMs - activeCaption.startMs)))
    : 0;

  return (
    <div className="quick-instant-preview">
      <video
        ref={videoRef}
        className="quick-preview-video"
        controls
        preload="auto"
        playsInline
        src={videoUrl}
        onLoadedMetadata={syncTime}
        onTimeUpdate={syncTime}
        onPlaying={startSyncLoop}
        onPause={syncTime}
        onSeeked={syncTime}
      />
      <div className="quick-instant-topbar">
        <span>{badge}</span>
        <strong>{preview.captions.length} caption chunks live</strong>
      </div>
      <div className="quick-instant-caption-layer">
        {activeCaption ? (
          <div className="quick-instant-caption">
            <div className="quick-instant-caption-words">
              {activeCaption.words.map((word, index) => {
                const isActive = currentTimeMs >= word.startMs && currentTimeMs <= word.endMs + 90;
                const hasPassed = currentTimeMs > word.endMs + 90;
                return (
                  <span
                    key={`${activeCaption.id}-${word.startMs}-${index}`}
                    className={`${isActive ? "is-active" : ""} ${hasPassed ? "has-passed" : ""}`}
                  >
                    {word.text}
                  </span>
                );
              })}
            </div>
            <div className="quick-instant-caption-meter">
              <span style={{transform: `scaleX(${captionProgress})`}} />
            </div>
          </div>
        ) : (
          <div className="quick-instant-caption is-waiting">
            <strong>Typography preview is ready.</strong>
            <span>Play or scrub the source to see the timed overlay.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const PreviewApp: React.FC = () => {
  const initialDevLivePreviewLaunch = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return resolveDevLivePreviewLaunchFromSearch(window.location.search);
  }, []);
  const devLivePreviewLaunchRef = useRef(initialDevLivePreviewLaunch);
  const devLivePreviewAppliedRef = useRef(false);
  const [backendHealth, setBackendHealth] = useState<BackendHealth>("checking");
  const [status, setStatus] = useState<LocalPreviewStatus>(emptyStatus);
  const [sourcePath, setSourcePath] = useState(() => initialDevLivePreviewLaunch?.sourcePath ?? "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState<string | null>(null);
  const [captionProfileId, setCaptionProfileId] = useState<CaptionProfileId>(() => initialDevLivePreviewLaunch?.captionProfileId ?? DEFAULT_CAPTION_PROFILE_ID);
  const [motionTier, setMotionTier] = useState<MotionTier>(() => initialDevLivePreviewLaunch?.motionTier ?? DEFAULT_MOTION_TIER);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("speed-draft");
  const [livePreviewRenderer] = useState<LivePreviewRenderer>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_LIVE_PREVIEW_RENDERER;
    }

    return resolveLivePreviewRendererFromSearch(window.location.search);
  });
  const [musicDjJobId] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return resolveMusicDjJobIdFromSearch(window.location.search);
  });
  const previewShellConfig = useMemo(() => resolvePreviewShellConfig(livePreviewRenderer), [livePreviewRenderer]);
  const showMusicCatalogPanel = import.meta.env.DEV && isMusicCatalogPanelEnabled();
  const isRemotionOnlyShell = previewShellConfig.variant === "remotion-only";
  const [cleanRun, setCleanRun] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [instantPreview, setInstantPreview] = useState<InstantPreviewPayload | null>(null);
  const [audioPreviewRunId, setAudioPreviewRunId] = useState(0);
  const [audioPreviewState, setAudioPreviewState] = useState<AudioCreativePreviewState>("idle");
  const [audioPreviewAudioStatus, setAudioPreviewAudioStatus] = useState<AudioCreativePreviewAudioStatus>("missing");
  const [audioPreviewAudioError, setAudioPreviewAudioError] = useState<string | null>(null);
  const [liveAudioPreviewStatus, setLiveAudioPreviewStatus] = useState<LiveAudioPreviewBackendState | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV || devLivePreviewAppliedRef.current) {
      return;
    }

    const launch = devLivePreviewLaunchRef.current;
    if (!launch) {
      return;
    }

    devLivePreviewAppliedRef.current = true;
    setBackendHealth("checking");
    setDeliveryMode("speed-draft");
    setStatus(emptyStatus);
    setSelectedFile(null);
    setInstantPreview(null);
    setFormError(null);
    setConnectionError(null);
    setLiveAudioPreviewStatus(null);
    setAudioPreviewState("building-timeline");
    setAudioPreviewAudioStatus("loading");
    setAudioPreviewAudioError(null);
    if (import.meta.env.DEV) {
      console.info("[PreviewApp] auto-launching live preview from query params", {
        previewLane: livePreviewRenderer,
        sourcePath: launch.sourcePath,
        captionProfileId: launch.captionProfileId,
        motionTier: launch.motionTier
      });
    }
    setAudioPreviewRunId((value) => value + 1);
  }, [livePreviewRenderer]);

  useEffect(() => {
    if (!selectedFile) {
      setSelectedFilePreviewUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(selectedFile);
    setSelectedFilePreviewUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [selectedFile]);

  useEffect(() => {
    if (deliveryMode === "speed-draft") {
      setConnectionError(null);
      return;
    }

    setLiveAudioPreviewStatus(null);
  }, [deliveryMode]);

  useEffect(() => {
    if (deliveryMode !== "speed-draft") {
      return;
    }

    let cancelled = false;
    let intervalId = 0;

    const refreshBackendHealth = async (): Promise<void> => {
      const reachable = await probeBackendAvailability(API_BASE);
      if (cancelled) {
        return;
      }

      setBackendHealth(reachable ? "connected" : "offline");
      if (!reachable && audioPreviewRunId === 0) {
        setConnectionError(`Cannot reach the local backend at ${API_BASE}. Start the backend to generate AssemblyAI captions and live motion.`);
      } else if (reachable) {
        setConnectionError(null);
      }
    };

    void refreshBackendHealth();
    intervalId = window.setInterval(() => {
      void refreshBackendHealth();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [audioPreviewRunId, deliveryMode]);

  useEffect(() => {
    if (deliveryMode === "speed-draft") {
      return;
    }

    let cancelled = false;
    let intervalId = 0;

    const refreshStatus = async (): Promise<void> => {
      try {
        const response = await fetch(`${API_BASE}/api/local-preview/status`, {
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error(`Status request failed with ${response.status}.`);
        }

        const payload = await response.json() as LocalPreviewStatus;
        if (cancelled) {
          return;
        }

        setBackendHealth("connected");
        setConnectionError(null);
        setStatus(payload);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setBackendHealth("offline");
        if (status.state === "idle") {
          setStatus(emptyStatus);
        }
        const message = error instanceof Error ? error.message : String(error);
        setConnectionError(`Cannot reach the local backend at ${API_BASE}. ${message}`);
      }
    };

    void refreshStatus();
    intervalId = window.setInterval(() => {
      void refreshStatus();
    }, 1600);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [deliveryMode, status.state]);

  useEffect(() => {
    let cancelled = false;
    let intervalId = 0;

    const refreshInstantPreview = async (): Promise<void> => {
      if (deliveryMode === "speed-draft" || status.state === "idle" || status.stage === "cleaning") {
        setInstantPreview(null);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/local-preview/instant-preview`, {
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error(`Instant preview request failed with ${response.status}.`);
        }

        const payload = await response.json() as InstantPreviewPayload;
        if (!cancelled) {
          setInstantPreview(payload.ready ? payload : null);
        }
      } catch {
        if (!cancelled && status.state !== "completed") {
          setInstantPreview(null);
        }
      }
    };

    void refreshInstantPreview();
    intervalId = window.setInterval(() => {
      void refreshInstantPreview();
    }, status.stage === "ingesting" ? 2500 : 6000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [deliveryMode, status.stage, status.state]);

  const activeCaptionProfile = useMemo(
    () => getCaptionStyleProfile(
      status.state === "running" || status.state === "completed"
        ? status.captionProfileId
        : captionProfileId
    ),
    [captionProfileId, status.captionProfileId, status.state]
  );
  const pipelineItems = useMemo(
    () => buildPipelineItems(status, audioPreviewState, deliveryMode, liveAudioPreviewStatus),
    [audioPreviewState, deliveryMode, liveAudioPreviewStatus, status]
  );
  const livePreviewRendererLabel = livePreviewRenderer === "hyperframes"
    ? "Hyperframes / Display God"
    : "Remotion Player";
  const stageTone = isLiveAudioPreviewLane(deliveryMode)
    ? backendHealth === "offline" && audioPreviewRunId === 0
      ? "danger"
      : audioPreviewState === "error"
      ? "danger"
      : audioPreviewState === "building-timeline"
        ? "warning"
        : audioPreviewState === "playing" || audioPreviewState === "ready"
          ? "success"
          : "neutral"
    : getStageTone(status.state);
  const trimmedSourcePath = sourcePath.trim();
  const effectiveSourcePath = !selectedFile
    ? trimmedSourcePath || status.sourceVideoPath?.trim() || ""
    : trimmedSourcePath;
  const hasSourceReady = Boolean(selectedFile || effectiveSourcePath);
  const hasInstantPreview = isInstantPreviewUsable(instantPreview) && !status.outputUrl;
  const hasLiveAudioPreview = isLiveAudioPreviewLane(deliveryMode) && audioPreviewRunId > 0;
  const liveOverlayReady = Boolean(liveAudioPreviewStatus?.overlayReady);
  const livePreviewUrl = status.outputUrl ?? (hasInstantPreview ? null : selectedFilePreviewUrl);
  const usingSourcePreview = !status.outputUrl && Boolean(selectedFilePreviewUrl);
  const previewBadge = isLiveAudioPreviewLane(deliveryMode)
    ? audioPreviewState === "building-timeline"
      ? livePreviewRenderer === "hyperframes"
        ? "Building Hyperframes"
        : "Building Remotion Preview"
      : audioPreviewState === "playing"
        ? livePreviewRenderer === "hyperframes"
          ? "Playing Hyperframes"
          : "Playing Remotion Preview"
        : audioPreviewState === "ready"
          ? livePreviewRenderer === "hyperframes"
            ? "Hyperframes Ready"
            : "Remotion Ready"
          : audioPreviewState === "error"
            ? `${livePreviewRenderer === "hyperframes" ? "Hyperframes" : "Remotion"} Error`
            : livePreviewRenderer === "hyperframes"
              ? "Hyperframes Standby"
              : "Remotion Standby"
    : status.activeOutputKind === "master-render"
      ? "Master Output"
      : status.activeOutputKind === "speed-draft"
        ? "Draft Preview Ready"
        : hasInstantPreview
          ? "Instant Overlay"
          : usingSourcePreview
            ? "Near-Final Stage"
            : "No Output Yet";
  const previewSubcopy = isLiveAudioPreviewLane(deliveryMode)
    ? audioPreviewState === "building-timeline"
      ? liveAudioPreviewStatus?.sessionId
        ? "AssemblyAI is transcribing now. The browser stage will mount as soon as the first real moments are ready."
        : "The director is segmenting the transcript now. The browser stage will mount as soon as the timeline is ready."
      : audioPreviewState === "playing"
        ? liveOverlayReady
          ? `${liveAudioPreviewStatus?.momentCount ?? 0} animated moments are running against the native video clock.`
          : "The native browser video layer is running. The first overlay pass is still settling."
        : audioPreviewState === "error"
          ? "The live browser preview could not build the timeline. The debug overlay shows the failure details."
          : audioPreviewAudioStatus === "missing"
            ? "No media source is loaded yet, but the overlay timeline is ready for the next clip."
            : audioPreviewAudioStatus === "error"
              ? `The overlay timeline is still live while the source media is being recovered or replaced. ${audioPreviewAudioError ?? "The source media could not be loaded."}`
              : hasLiveAudioPreview
                ? liveOverlayReady
                  ? "The governed preview composition is ready and the first artifact is being refreshed."
                  : "The governed preview lane is waiting for the first transcript-driven manifest pass."
                : "Click Run Live Preview to request the first governed preview artifact."
    : status.stage === "mastering" && status.draftOutputUrl
      ? "The live compositor is already running here while the heavier final render continues in the background."
      : hasInstantPreview
        ? "The source video and timed typography are live in the browser while the MP4 bake continues."
        : usingSourcePreview
          ? "The frontend is already showing the chosen source in a near-final frame while the backend bakes the first MP4."
          : "The first baked output will land here as soon as the selected lane finishes.";
  const previewStageLabel = isLiveAudioPreviewLane(deliveryMode)
    ? audioPreviewState === "building-timeline"
      ? "Building preview"
      : audioPreviewState === "playing"
        ? "Preview active"
        : audioPreviewState === "error"
          ? "Preview error"
        : hasLiveAudioPreview
          ? liveOverlayReady
            ? "AssemblyAI live compositor"
            : "Waiting for first motion pass"
          : "Awaiting live preview"
    : status.activeOutputKind === "master-render"
      ? "Master finish"
      : status.activeOutputKind === "speed-draft"
        ? "Cinematic preview lane"
        : hasInstantPreview
          ? "Live typography staging"
          : usingSourcePreview
            ? "Source inspection"
            : "Awaiting media";
  const previewFrameClassName = [
    "quick-preview-frame",
    isLiveAudioPreviewLane(deliveryMode) && hasLiveAudioPreview ? "is-speed-draft" : status.activeOutputKind === "speed-draft" ? "is-speed-draft" : "",
    status.activeOutputKind === "master-render" ? "is-master-render" : "",
    hasInstantPreview ? "has-instant-preview" : "",
    usingSourcePreview ? "is-source-preview" : "",
    livePreviewUrl || hasLiveAudioPreview ? "has-live-media" : "",
    hasLiveAudioPreview ? "has-live-audio-clock" : ""
  ].filter(Boolean).join(" ");
  const previewOverlayClassName = [
    "quick-preview-overlay",
    isLiveAudioPreviewLane(deliveryMode) && hasLiveAudioPreview ? "is-cinematic" : status.activeOutputKind === "speed-draft" || status.activeOutputKind === "master-render" ? "is-cinematic" : "",
    hasInstantPreview ? "is-live-typography" : ""
  ].filter(Boolean).join(" ");
  const canRun = !isSubmitting && !isResetting && (
    deliveryMode === "speed-draft"
      ? hasSourceReady
      : backendHealth === "connected" && status.state !== "running" && hasSourceReady
  );
  const canReset = !isSubmitting && !isResetting && (
    deliveryMode === "speed-draft"
      ? true
      : backendHealth === "connected"
  );
  const recentLogs = status.logs.slice(-40);
  const activeDeliveryMode = isLiveAudioPreviewLane(deliveryMode)
    ? deliveryMode
    : status.state === "running" || status.state === "completed"
      ? status.deliveryMode
      : deliveryMode;
  const visibleError = connectionError ?? formError;
  const primaryRunButtonLabel = isRemotionOnlyShell
    ? audioPreviewState === "building-timeline"
      ? "Starting Remotion Preview..."
      : audioPreviewState === "playing"
        ? "Remotion Preview Playing"
        : audioPreviewRunId > 0
          ? "Restart Remotion Preview"
          : "Start Remotion Preview"
    : status.state === "running"
      ? "Render lane in progress"
      : isSubmitting
        ? "Submitting render lane..."
        : deliveryMode === "speed-draft"
          ? audioPreviewState === "building-timeline"
            ? "Building Live Preview..."
            : audioPreviewState === "playing"
              ? "Playing Live Preview"
              : audioPreviewRunId > 0
                ? "Refresh Live Preview"
                : "Run Live Preview"
          : deliveryMode === "master-render"
            ? "Run Final Render"
            : "Run Live Preview";

  const handleSubmit = async (): Promise<void> => {
    setFormError(null);

    if (deliveryMode === "speed-draft") {
      if (!selectedFile && !trimmedSourcePath) {
        setFormError("Choose a video/media file or paste a local path before starting the live compositor preview.");
        return;
      }

      const backendReachable = await probeBackendAvailability(API_BASE);
      if (!backendReachable) {
        setBackendHealth("offline");
        setConnectionError(`Cannot reach the local backend at ${API_BASE}. Start the backend to generate AssemblyAI captions and the live compositor timeline.`);
        return;
      }

      setBackendHealth("connected");
      setConnectionError(null);
      if (import.meta.env.DEV) {
        console.info("[PreviewApp] live compositor lane selected", {
          renderJobActive: false,
          audioPreviewRunId: audioPreviewRunId + 1,
          hasAudioSource: Boolean(selectedFile || trimmedSourcePath),
          backendRenderInvoked: false
        });
      }
      setLiveAudioPreviewStatus(null);
      setAudioPreviewRunId((value) => value + 1);
      setAudioPreviewState("building-timeline");
      setAudioPreviewAudioStatus(selectedFile || trimmedSourcePath ? "loading" : "missing");
      setAudioPreviewAudioError(null);
      return;
    }

    if (!selectedFile && !effectiveSourcePath) {
      setFormError("Choose a source file or paste a local path first.");
      return;
    }

    setIsSubmitting(true);

    if (import.meta.env.DEV) {
      console.info("[PreviewApp] backend render lane selected", {
        renderJobActive: true,
        deliveryMode,
        hasSourceReady,
        backendRenderInvoked: true
      });
    }

    try {
      const formData = new FormData();

      if (selectedFile) {
        formData.append("source_video", selectedFile);
      }
      if (effectiveSourcePath) {
        formData.append("sourcePath", effectiveSourcePath);
      }
      formData.append("captionProfileId", captionProfileId);
      formData.append("motionTier", motionTier);
      formData.append("deliveryMode", deliveryMode);
      formData.append("cleanRun", cleanRun ? "true" : "false");
      formData.append("transcriptionMode", "assemblyai");

      const response = await fetch(`${API_BASE}/api/local-preview/run`, {
        method: "POST",
        body: formData
      });
      const payload = await response.json() as LocalPreviewStatus | {error: string};

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : `Run request failed with ${response.status}.`);
      }

      setConnectionError(null);
      setStatus(payload as LocalPreviewStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/failed to fetch|networkerror|fetch failed/i.test(message)) {
        setConnectionError(`Cannot reach the local backend at ${API_BASE}. ${message}`);
      } else {
        setFormError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async (): Promise<void> => {
    setFormError(null);
    setIsResetting(true);

    if (deliveryMode === "speed-draft") {
      setConnectionError(null);
      setStatus(emptyStatus);
      setSourcePath("");
      setSelectedFile(null);
      setInstantPreview(null);
      setAudioPreviewRunId(0);
      setAudioPreviewState("idle");
      setAudioPreviewAudioStatus("missing");
      setAudioPreviewAudioError(null);
      setLiveAudioPreviewStatus(null);
      setIsResetting(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/local-preview/reset`, {
        method: "POST"
      });
      const payload = await response.json() as LocalPreviewStatus | {error: string};

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : `Reset request failed with ${response.status}.`);
      }

      setConnectionError(null);
      setStatus(payload as LocalPreviewStatus);
      setSourcePath("");
      setSelectedFile(null);
      setInstantPreview(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/failed to fetch|networkerror|fetch failed/i.test(message)) {
        setConnectionError(`Cannot reach the local backend at ${API_BASE}. ${message}`);
      } else {
        setFormError(message);
      }
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="quick-shell">
      <section className="quick-stage">
        <header className="quick-stage-header">
          <div>
            <p className="quick-kicker">{previewShellConfig.headerKicker}</p>
            <h1>{previewShellConfig.headerTitle}</h1>
            <p className="quick-copy">{previewShellConfig.headerCopy}</p>
          </div>
          <div className={`quick-status-pill is-${stageTone}`}>
            <span>
              {isLiveAudioPreviewLane(deliveryMode)
                ? backendHealth === "offline" && audioPreviewRunId === 0
                  ? "Backend Offline"
                  : livePreviewRenderer === "hyperframes"
                    ? "Hyperframes Compositor"
                    : "Remotion Player"
                : backendHealth === "connected"
                  ? "Backend Ready"
                  : backendHealth === "checking"
                    ? "Connecting"
                    : "Backend Offline"}
            </span>
            <strong>
              {isLiveAudioPreviewLane(deliveryMode)
                ? backendHealth === "offline" && audioPreviewRunId === 0
                  ? "Start backend first"
                  : audioPreviewState === "building-timeline"
                  ? "Building timeline"
                  : audioPreviewState === "playing"
                    ? "Playing live"
                    : audioPreviewState === "ready"
                      ? "Ready to play"
                      : audioPreviewState === "error"
                        ? "Preview error"
                        : "Ready to preview"
                : status.stageLabel}
            </strong>
          </div>
        </header>

        <div className="quick-preview-card">
          <div className="quick-preview-topline quick-preview-topline-rich">
            {isRemotionOnlyShell ? (
              <div className="quick-preview-meta">
                <span>Preview Mode</span>
                <strong>Remotion Interactive Preview</strong>
              </div>
            ) : (
              <div className="quick-preview-meta">
                <span>Active Lane</span>
                <strong>{activeDeliveryMode === "master-render" ? "Final Render" : "Live Compositor"}</strong>
              </div>
            )}
            <div className="quick-preview-meta">
              <span>Interactive Renderer</span>
              <strong>{isRemotionOnlyShell ? "Remotion Player" : isLiveAudioPreviewLane(deliveryMode) ? livePreviewRendererLabel : "Export Lane"}</strong>
            </div>
            <div className="quick-preview-meta">
              <span>Current Output</span>
              <strong>{previewBadge}</strong>
            </div>
            <div className="quick-preview-meta">
              <span>Caption Style</span>
              <strong>{activeCaptionProfile.displayName}</strong>
            </div>
            <div className="quick-preview-meta">
              <span>Motion Level</span>
              <strong>{isLiveAudioPreviewLane(deliveryMode) ? motionTier : status.motionTier}</strong>
            </div>
          </div>

          <div className={previewFrameClassName}>
            <div className="quick-preview-badge">{previewBadge}</div>
            {isLiveAudioPreviewLane(deliveryMode) ? (
              audioPreviewRunId > 0 ? (
                <CreativeAudioLivePlayer
                  jobId={`audio-preview-${audioPreviewRunId}`}
                  captionProfileId={captionProfileId}
                  motionTier={motionTier}
                  presentationMode="long-form"
                  apiBase={API_BASE}
                  sourceFile={selectedFile}
                  sourcePath={selectedFile ? null : trimmedSourcePath || null}
                  sourceMediaSrc={selectedFilePreviewUrl}
                  sourceLabel={selectedFile?.name ?? status.sourceDisplayName ?? null}
                  previewTimelineResetVersion={audioPreviewRunId}
                  previewRenderer={livePreviewRenderer}
                  showDebugOverlay={false}
                  showPlaybackHud={false}
                  onPreviewStateChange={setAudioPreviewState}
                  onAudioStatusChange={(status, errorMessage) => {
                    setAudioPreviewAudioStatus(status);
                    setAudioPreviewAudioError(errorMessage);
                  }}
                  onLiveSessionChange={setLiveAudioPreviewStatus}
                />
              ) : (
                <div className="quick-preview-empty">
                  <strong>No live preview started yet.</strong>
                  <span>{previewShellConfig.emptyPreviewMessage}</span>
                </div>
              )
            ) : hasInstantPreview ? (
              <InstantOverlayPreview preview={instantPreview} badge={previewBadge} />
            ) : livePreviewUrl ? (
              <video
                key={livePreviewUrl}
                className="quick-preview-video"
                controls
                preload="metadata"
                playsInline
                src={livePreviewUrl}
              />
            ) : (
              <div className="quick-preview-empty">
                <strong>No video loaded yet.</strong>
                <span>Choose a source and the stage will light up immediately.</span>
              </div>
            )}
            {isLiveAudioPreviewLane(deliveryMode) ? null : (
              <div className={previewOverlayClassName}>
                <em className="quick-preview-kicker">{previewStageLabel}</em>
                <strong>
                  {status.sourceDisplayName ?? selectedFile?.name ?? "Waiting for a source clip"}
                </strong>
                <span>{previewSubcopy}</span>
              </div>
            )}
          </div>

          {previewShellConfig.showPreviewDownloads ? (
            <div className="quick-preview-actions">
              <div className="quick-action-row">
                <a
                  className={`quick-action ${status.draftOutputUrl ? "" : "is-disabled"}`}
                  href={status.draftOutputUrl ?? "#"}
                  download
                  aria-disabled={!status.draftOutputUrl}
                >
                  Download Draft Preview
                </a>
                <a
                  className={`quick-action quick-action-secondary ${status.masterOutputUrl ? "" : "is-disabled"}`}
                  href={status.masterOutputUrl ?? "#"}
                  download
                  aria-disabled={!status.masterOutputUrl}
                >
                  Download Master
                </a>
              </div>
              <div className="quick-inline-note">
                AssemblyAI handles transcript generation. Preview now stays on the native browser video path with live
                overlays, and the heavy offline lane only kicks in when you choose to export a final video.
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="quick-sidebar">
        <div className="quick-card">
          <h2>{previewShellConfig.setupHeading}</h2>

          {previewShellConfig.showDeliveryModePicker ? (
            <div className="quick-mode-grid">
              {deliveryModeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`quick-mode-card ${deliveryMode === option.value ? "is-active" : ""}`}
                  onClick={() => setDeliveryMode(option.value)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
          ) : null}

          {previewShellConfig.showRendererComparison && deliveryMode === "speed-draft" ? (
            <div className="quick-compare-grid">
              <button
                type="button"
                className="quick-mode-card quick-compare-card is-active"
              >
                <strong>{livePreviewRenderer === "hyperframes" ? "Hyperframes Preview" : "Remotion Preview"}</strong>
                <span>
                  {livePreviewRenderer === "hyperframes"
                    ? "Explicit query lane. Preview stays on the governed Hyperframes path and reports its artifact type explicitly."
                    : "Default testing lane. Live preview stays on the Remotion player path fed by the backend edit-session SSE contract."}
                </span>
              </button>
            </div>
          ) : null}

          <label className="quick-field">
            <span>Choose video or media</span>
            <input
              type="file"
              accept="video/*"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <label className="quick-field">
            <span>Or paste a local path</span>
            <input
              type="text"
              placeholder="C:\\Users\\You\\Videos\\example.mp4"
              value={sourcePath}
              onChange={(event) => setSourcePath(event.target.value)}
            />
            <small>{previewShellConfig.pathFieldHelpText}</small>
          </label>

          <label className="quick-field">
            <span>Caption system</span>
            <select
              value={captionProfileId}
              onChange={(event) => setCaptionProfileId(event.target.value as CaptionProfileId)}
            >
              {captionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small>{captionOptions.find((option) => option.value === captionProfileId)?.description}</small>
          </label>

          <label className="quick-field">
            <span>Motion level</span>
            <select
              value={motionTier}
              onChange={(event) => setMotionTier(event.target.value as MotionTier)}
            >
              {motionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small>{motionOptions.find((option) => option.value === motionTier)?.description}</small>
          </label>

          {previewShellConfig.showCleanRunToggle ? (
            <label className="quick-toggle">
              <input
                type="checkbox"
                checked={cleanRun}
                onChange={(event) => setCleanRun(event.target.checked)}
              />
              <div>
                <strong>Reset stale outputs first</strong>
                <span>Clears old preview/master MP4s and manifests but keeps reusable caches that help speed.</span>
              </div>
            </label>
          ) : null}

          {selectedFile ? (
            <div className="quick-chip-row">
              <span className="quick-chip">Picked file: {selectedFile.name}</span>
            </div>
          ) : null}

          {!selectedFile && !trimmedSourcePath && status.sourceDisplayName ? (
            <div className="quick-chip-row">
              <span className="quick-chip">Loaded source: {status.sourceDisplayName}</span>
            </div>
          ) : null}

          {visibleError ? <div className="quick-error">{visibleError}</div> : null}

          <div className="quick-run-actions">
            <button
              type="button"
              className="quick-primary-button"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={!canRun}
            >
              {primaryRunButtonLabel}
            </button>
            <button
              type="button"
              className="quick-secondary-button"
              onClick={() => {
                void handleReset();
              }}
              disabled={!canReset}
            >
              {isResetting
                ? status.state === "running"
                  ? "Aborting run..."
                  : "Resetting..."
                : status.state === "running"
                  ? "Abort + Reset Workspace"
                  : "Reset Workspace"}
            </button>
          </div>
        </div>

        {previewShellConfig.showPipelinePanel ? (
          <div className="quick-card">
            <h2>Pipeline</h2>

            <div className="quick-pipeline">
              {pipelineItems.map((item) => (
                <div key={item.label} className={`quick-pipeline-step is-${item.state}`}>
                  <strong>{item.label}</strong>
                  <span>
                    {item.state === "done"
                      ? "Done"
                      : item.state === "active"
                        ? "Live"
                        : item.state === "skipped"
                          ? "Skipped"
                          : "Waiting"}
                  </span>
                </div>
              ))}
            </div>

            <dl className="quick-stats">
              <div>
                <dt>Stage</dt>
                <dd>{status.stageLabel}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{formatDateTime(status.startedAt)}</dd>
              </div>
              <div>
                <dt>Finished</dt>
                <dd>{formatDateTime(status.finishedAt)}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{formatDuration(status.stageTimingsMs.total)}</dd>
              </div>
              <div>
                <dt>Ingest</dt>
                <dd>{formatDuration(status.stageTimingsMs.ingest)}</dd>
              </div>
              <div>
                <dt>Draft Preview</dt>
                <dd>{formatDuration(status.stageTimingsMs.draftRender)}</dd>
              </div>
              <div>
                <dt>Master</dt>
                <dd>{formatDuration(status.stageTimingsMs.masterRender)}</dd>
              </div>
              <div>
                <dt>Transcript</dt>
                <dd>{status.ingestSummary?.transcriptionProvider ?? status.transcriptionMode}</dd>
              </div>
            </dl>

            <div className="quick-stack-note">
              <strong>Always included</strong>
              <span>AssemblyAI transcript timing, editorial caption decisions, motion graphics, soundtrack bed, and sound effects.</span>
            </div>
          </div>
        ) : null}

        {previewShellConfig.showLiveLogPanel ? (
          <div className="quick-card quick-log-card">
            <div className="quick-card-header">
              <h2>Live Log</h2>
              <span>{recentLogs.length} lines</span>
            </div>
            <div className="quick-log-window">
              {recentLogs.length > 0 ? (
                recentLogs.map((entry, index) => (
                  <p key={`${entry}-${index}`}>{entry}</p>
                ))
              ) : (
                <p>No run output yet.</p>
              )}
            </div>
          </div>
        ) : null}

        {showMusicCatalogPanel ? <MusicDjControlPanel jobId={musicDjJobId} /> : null}
      </aside>
    </div>
  );
};
