import {useCallback, useEffect, useRef, useState, type RefObject} from "react";

import type {PreviewPlaybackHealth} from "../preview-telemetry";

export type HyperframesClockSource = "manual" | "video-frame-callback" | "animation-frame";

export type HyperframesTimelineState = {
  currentTimeMs: number;
  isPlaying: boolean;
  playbackRate: number;
  seekVersion: number;
  clockSource: HyperframesClockSource;
  health: PreviewPlaybackHealth;
  errorMessage: string | null;
};

const buildMediaErrorMessage = (video: HTMLVideoElement | null): string => {
  if (!video?.error) {
    return "The browser could not load the Hyperframes preview video.";
  }

  if (video.error.code === MediaError.MEDIA_ERR_ABORTED) {
    return "The Hyperframes preview video load was interrupted.";
  }
  if (video.error.code === MediaError.MEDIA_ERR_NETWORK) {
    return "The browser hit a network error while loading the Hyperframes preview video.";
  }
  if (video.error.code === MediaError.MEDIA_ERR_DECODE) {
    return "The browser could not decode the Hyperframes preview video stream.";
  }
  if (video.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return "The selected Hyperframes preview video format is not supported in this browser.";
  }

  return "The browser could not play the Hyperframes preview video.";
};

export const useHyperframesTimelineController = (
  videoRef: RefObject<HTMLVideoElement | null>,
  sourceKey: string,
  onFrameTimeMs?: (currentTimeMs: number) => void
): HyperframesTimelineState => {
  const [state, setState] = useState<HyperframesTimelineState>({
    currentTimeMs: 0,
    isPlaying: false,
    playbackRate: 1,
    seekVersion: 0,
    clockSource: "manual",
    health: "booting",
    errorMessage: null
  });
  const stopLoopRef = useRef<(() => void) | null>(null);

  const readVideoClock = useCallback((clockSource: HyperframesClockSource) => {
    const video = videoRef.current;
    if (!video) {
      return null;
    }

    const currentTimeMs = Math.max(0, video.currentTime * 1000);
    onFrameTimeMs?.(currentTimeMs);

    return {
      currentTimeMs,
      clockSource,
      playbackRate: video.playbackRate || 1
    };
  }, [onFrameTimeMs, videoRef]);

  const syncFromVideo = useCallback((clockSource: HyperframesClockSource) => {
    const snapshot = readVideoClock(clockSource);
    if (!snapshot) {
      return;
    }

    setState((current) => ({
      ...current,
      ...snapshot
    }));
  }, [readVideoClock]);

  useEffect(() => {
    setState({
      currentTimeMs: 0,
      isPlaying: false,
      playbackRate: 1,
      seekVersion: 0,
      clockSource: "manual",
      health: "booting",
      errorMessage: null
    });
  }, [sourceKey]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const frameVideo = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: () => void) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
    };

    const stopLoop = (): void => {
      stopLoopRef.current?.();
      stopLoopRef.current = null;
    };

    const startLoop = (): void => {
      stopLoop();

      let animationFrameId: number | null = null;
      let videoFrameCallbackId: number | null = null;
      let cancelled = false;

      const tick = (): void => {
        if (cancelled) {
          return;
        }

        readVideoClock(typeof frameVideo.requestVideoFrameCallback === "function" ? "video-frame-callback" : "animation-frame");
        if (video.paused || video.ended) {
          return;
        }

        if (typeof frameVideo.requestVideoFrameCallback === "function") {
          videoFrameCallbackId = frameVideo.requestVideoFrameCallback(() => {
            tick();
          });
          return;
        }

        animationFrameId = window.requestAnimationFrame(() => {
          tick();
        });
      };

      tick();

      stopLoopRef.current = () => {
        cancelled = true;
        if (animationFrameId !== null) {
          window.cancelAnimationFrame(animationFrameId);
        }
        if (videoFrameCallbackId !== null && typeof frameVideo.cancelVideoFrameCallback === "function") {
          frameVideo.cancelVideoFrameCallback(videoFrameCallbackId);
        }
      };
    };

    const handleLoadedMetadata = (): void => {
      syncFromVideo("manual");
      setState((current) => ({
        ...current,
        health: (video.readyState ?? 0) >= HTMLMediaElement.HAVE_CURRENT_DATA ? "ready" : current.health,
        errorMessage: null
      }));
    };
    const handleCanPlay = (): void => {
      syncFromVideo("manual");
      setState((current) => ({
        ...current,
        health: "ready",
        errorMessage: null
      }));
    };
    const handlePlay = (): void => {
      setState((current) => ({
        ...current,
        isPlaying: true,
        clockSource: typeof frameVideo.requestVideoFrameCallback === "function" ? "video-frame-callback" : "animation-frame",
        health: "ready",
        errorMessage: null
      }));
      startLoop();
    };
    const handlePause = (): void => {
      stopLoop();
      syncFromVideo("manual");
      setState((current) => ({
        ...current,
        isPlaying: false,
        health: current.errorMessage ? "error" : "ready"
      }));
    };
    const handleWaiting = (): void => {
      setState((current) => ({
        ...current,
        isPlaying: false,
        health: current.currentTimeMs > 0 ? "buffering" : "booting"
      }));
    };
    const handleSeeked = (): void => {
      syncFromVideo("manual");
      setState((current) => ({
        ...current,
        seekVersion: current.seekVersion + 1,
        health: current.errorMessage ? "error" : "ready"
      }));
    };
    const handleTimeUpdate = (): void => {
      if (video.paused || video.ended) {
        syncFromVideo("manual");
      }
    };
    const handleRateChange = (): void => {
      setState((current) => ({
        ...current,
        playbackRate: video.playbackRate || 1
      }));
    };
    const handleError = (): void => {
      stopLoop();
      setState((current) => ({
        ...current,
        isPlaying: false,
        health: "error",
        errorMessage: buildMediaErrorMessage(video)
      }));
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("loadeddata", handleCanPlay);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("playing", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handlePause);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ratechange", handleRateChange);
    video.addEventListener("error", handleError);

    if ((video.readyState ?? 0) >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      handleCanPlay();
    }
    if (!video.paused && !video.ended) {
      handlePlay();
    }

    return () => {
      stopLoop();
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleCanPlay);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("playing", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handlePause);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ratechange", handleRateChange);
      video.removeEventListener("error", handleError);
    };
  }, [readVideoClock, sourceKey, syncFromVideo, videoRef]);

  return state;
};
