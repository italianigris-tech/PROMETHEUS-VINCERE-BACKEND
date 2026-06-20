import {startTransition, useCallback, useEffect, useLayoutEffect, useRef, useState} from "react";

// Local shim for React's experimental useEffectEvent, which is not present in the
// stable react type definitions (TS2305). Same semantics: returns a callback with
// a stable identity that always invokes the latest closure values, so it is safe
// to omit from effect dependency arrays.
function useEffectEvent<TArgs extends unknown[], TReturn>(
  handler: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  const handlerRef = useRef(handler);
  useLayoutEffect(() => {
    handlerRef.current = handler;
  });
  return useCallback((...args: TArgs) => handlerRef.current(...args), []);
}

import {
  buildEmptyVideoAwareMusicState,
  getMusicDjState,
  runMusicPreflight,
  runMusicRehearsal,
  submitMusicOverride
} from "./music-api";
import type {
  MusicCatalogTrack,
  MusicOverrideResponse,
  MusicPreflightReport,
  VideoAwareAudioPlan,
  VideoAwareMusicState
} from "./music-api-types";

export type VideoAwareMusicApi = {
  getMusicDjState: typeof getMusicDjState;
  runMusicRehearsal: typeof runMusicRehearsal;
  runMusicPreflight: typeof runMusicPreflight;
  submitMusicOverride: typeof submitMusicOverride;
};

export type VideoAwareMusicSnapshot = {
  djState: VideoAwareMusicState;
  audioPlan: VideoAwareAudioPlan | null;
  preflight: MusicPreflightReport | null;
};

export type VideoAwareMusicViewState = {
  jobId: string | null;
  loading: boolean;
  error: string | null;
  catalogTracks?: MusicCatalogTrack[];
  djState: VideoAwareMusicState | null;
  audioPlan: VideoAwareAudioPlan | null;
  preflight: MusicPreflightReport | null;
  selectedTrack: MusicCatalogTrack | null;
  runningRehearsal: boolean;
  runningPreflight: boolean;
  submittingOverride: boolean;
  lastActionMessage: string | null;
  refreshState: () => Promise<void>;
  runRehearsal: (options?: {useCatalogCandidates?: boolean; overwrite?: boolean}) => Promise<void>;
  runPreflight: () => Promise<void>;
  overridePreviewTrack: (trackId: string) => Promise<void>;
  overrideMusicEvent: (eventId: string, trackId: string) => Promise<void>;
  setSelectedTrack: (track: MusicCatalogTrack | null) => void;
};

const defaultApi: VideoAwareMusicApi = {
  getMusicDjState,
  runMusicRehearsal,
  runMusicPreflight,
  submitMusicOverride
};

const toErrorMessage = (error: unknown): string => {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "Music DJ request failed.";
};

const toActionMessage = (
  response: Pick<MusicOverrideResponse, "warnings" | "reason"> | Pick<MusicPreflightReport, "status"> | {planMode?: string}
): string => {
  if ("reason" in response && typeof response.reason === "string" && response.reason.trim().length > 0) {
    return response.reason;
  }
  if ("warnings" in response && response.warnings[0]) {
    return response.warnings[0];
  }
  if ("status" in response) {
    return `Music preflight finished with status ${response.status}.`;
  }
  return "Music DJ state updated.";
};

export const loadVideoAwareMusicSnapshot = async (
  jobId: string,
  api: VideoAwareMusicApi = defaultApi
): Promise<VideoAwareMusicSnapshot> => {
  const djState = await api.getMusicDjState(jobId);
  return {
    djState,
    audioPlan: djState.audioPlan ?? null,
    preflight: djState.preflight ?? null
  };
};

export const useVideoAwareMusicState = (
  jobId: string | null | undefined,
  api: VideoAwareMusicApi = defaultApi
): VideoAwareMusicViewState => {
  const normalizedJobId = jobId?.trim() || null;
  const [loading, setLoading] = useState(Boolean(normalizedJobId));
  const [error, setError] = useState<string | null>(null);
  const [djState, setDjState] = useState<VideoAwareMusicState | null>(
    normalizedJobId
      ? buildEmptyVideoAwareMusicState(normalizedJobId)
      : buildEmptyVideoAwareMusicState("preview", "DJ plan controls need a backend jobId.")
  );
  const [audioPlan, setAudioPlan] = useState<VideoAwareAudioPlan | null>(null);
  const [preflight, setPreflight] = useState<MusicPreflightReport | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<MusicCatalogTrack | null>(null);
  const [runningRehearsal, setRunningRehearsal] = useState(false);
  const [runningPreflight, setRunningPreflight] = useState(false);
  const [submittingOverride, setSubmittingOverride] = useState(false);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(
    normalizedJobId ? null : "DJ plan controls need a backend jobId."
  );

  const refreshState = useEffectEvent(async (): Promise<void> => {
    if (!normalizedJobId) {
      startTransition(() => {
        setLoading(false);
        setError(null);
        setDjState(buildEmptyVideoAwareMusicState("preview", "DJ plan controls need a backend jobId."));
        setAudioPlan(null);
        setPreflight(null);
      });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const snapshot = await loadVideoAwareMusicSnapshot(normalizedJobId, api);
      startTransition(() => {
        setDjState(snapshot.djState);
        setAudioPlan(snapshot.audioPlan);
        setPreflight(snapshot.preflight);
      });
    } catch (nextError) {
      const message = toErrorMessage(nextError);
      startTransition(() => {
        setError(message);
      });
    } finally {
      startTransition(() => {
        setLoading(false);
      });
    }
  });

  useEffect(() => {
    void refreshState();
  }, [normalizedJobId, refreshState]);

  const runRehearsalAction = useEffectEvent(async (
    options: {useCatalogCandidates?: boolean; overwrite?: boolean} = {}
  ): Promise<void> => {
    if (!normalizedJobId) {
      setLastActionMessage("DJ plan controls need a backend jobId.");
      return;
    }

    setRunningRehearsal(true);
    setError(null);
    try {
      const response = await api.runMusicRehearsal(normalizedJobId, {
        useCatalogCandidates: options.useCatalogCandidates ?? true,
        overwrite: options.overwrite ?? true
      });
      setLastActionMessage(toActionMessage(response));
      await refreshState();
    } catch (nextError) {
      const message = toErrorMessage(nextError);
      setError(message);
      setLastActionMessage(message);
    } finally {
      setRunningRehearsal(false);
    }
  });

  const runPreflightAction = useEffectEvent(async (): Promise<void> => {
    if (!normalizedJobId) {
      setLastActionMessage("DJ plan controls need a backend jobId.");
      return;
    }

    setRunningPreflight(true);
    setError(null);
    try {
      const response = await api.runMusicPreflight(normalizedJobId, {
        requireRenderReady: false
      });
      setLastActionMessage(toActionMessage(response));
      await refreshState();
    } catch (nextError) {
      const message = toErrorMessage(nextError);
      setError(message);
      setLastActionMessage(message);
    } finally {
      setRunningPreflight(false);
    }
  });

  const overridePreviewTrack = useEffectEvent(async (trackId: string): Promise<void> => {
    if (!normalizedJobId) {
      setLastActionMessage("DJ plan controls need a backend jobId.");
      return;
    }

    setSubmittingOverride(true);
    setError(null);
    try {
      const response = await api.submitMusicOverride(normalizedJobId, {
        targetType: "preview",
        action: "use_catalog_track",
        trackId,
        rebuildPlan: true
      });
      setLastActionMessage(toActionMessage(response));
      await refreshState();
    } catch (nextError) {
      const message = toErrorMessage(nextError);
      setError(message);
      setLastActionMessage(message);
    } finally {
      setSubmittingOverride(false);
    }
  });

  const overrideMusicEvent = useEffectEvent(async (eventId: string, trackId: string): Promise<void> => {
    if (!normalizedJobId) {
      setLastActionMessage("DJ plan controls need a backend jobId.");
      return;
    }

    setSubmittingOverride(true);
    setError(null);
    try {
      const response = await api.submitMusicOverride(normalizedJobId, {
        targetType: "music_event",
        targetId: eventId,
        action: "replace_track",
        trackId,
        rebuildPlan: true
      });
      setLastActionMessage(toActionMessage(response));
      await refreshState();
    } catch (nextError) {
      const message = toErrorMessage(nextError);
      setError(message);
      setLastActionMessage(message);
    } finally {
      setSubmittingOverride(false);
    }
  });

  return {
    jobId: normalizedJobId,
    loading,
    error,
    djState,
    audioPlan,
    preflight,
    selectedTrack,
    runningRehearsal,
    runningPreflight,
    submittingOverride,
    lastActionMessage,
    refreshState,
    runRehearsal: runRehearsalAction,
    runPreflight: runPreflightAction,
    overridePreviewTrack,
    overrideMusicEvent,
    setSelectedTrack
  };
};
