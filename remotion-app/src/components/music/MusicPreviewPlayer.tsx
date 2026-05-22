import React, {useEffect, useRef, useState} from "react";

import {getMusicPreviewUrl, MusicApiError} from "../../lib/music/music-api";
import type {MusicCatalogTrack, MusicPreviewUrlMode, MusicPreviewUrlResponse} from "../../lib/music/music-api-types";

export type MusicPreviewPlaybackState = {
  trackId: string;
  urlMode: MusicPreviewUrlMode;
  playableInBrowser: boolean;
  audioPreviewUrl: string | null;
  audioObjectKey: string | null;
  reason: string;
};

export const resolveMusicPreviewPlaybackState = (
  response: MusicPreviewUrlResponse
): MusicPreviewPlaybackState => {
  const reason = response.reason?.trim() || "Preview playback is not available for this track yet.";
  const audioPreviewUrl = response.audioPreviewUrl?.trim() || null;
  const audioObjectKey = response.audioObjectKey?.trim() || null;
  const isPlayableMode = response.urlMode === "public_url" || response.urlMode === "signed_url";

  if (!response.playableInBrowser || !isPlayableMode) {
    return {
      trackId: response.trackId,
      urlMode: response.urlMode,
      playableInBrowser: false,
      audioPreviewUrl: null,
      audioObjectKey,
      reason
    };
  }

  if (!audioPreviewUrl) {
    return {
      trackId: response.trackId,
      urlMode: response.urlMode,
      playableInBrowser: false,
      audioPreviewUrl: null,
      audioObjectKey,
      reason: response.reason?.trim() || "The backend did not return a playable preview URL."
    };
  }

  return {
    trackId: response.trackId,
    urlMode: response.urlMode,
    playableInBrowser: true,
    audioPreviewUrl,
    audioObjectKey,
    reason: response.reason?.trim() || "Preview ready."
  };
};

export const describeMusicPreviewRequestError = (error: unknown): string => {
  if (error instanceof MusicApiError && error.status === 403) {
    return error.message || "Preview access is blocked for this track.";
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Preview playback failed.";
};

export const requestMusicTrackPreviewPlayback = async (
  trackId: string,
  fetchPreviewUrl: (trackId: string) => Promise<MusicPreviewUrlResponse> = getMusicPreviewUrl
): Promise<MusicPreviewPlaybackState> => {
  const response = await fetchPreviewUrl(trackId);
  return resolveMusicPreviewPlaybackState(response);
};

type MusicPreviewPlayerProps = {
  readonly activeTrack: MusicCatalogTrack | null;
  readonly playRequestNonce?: number;
  readonly fetchPreviewUrl?: (trackId: string) => Promise<MusicPreviewUrlResponse>;
};

const cardStyles: React.CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(148, 163, 184, 0.18)",
  background: "rgba(15, 23, 42, 0.72)",
  color: "#e5edf8"
};

const buttonRowStyles: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8
};

const buttonStyles: React.CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.2)",
  background: "#0f172a",
  color: "#f8fafc",
  borderRadius: 999,
  padding: "8px 14px",
  cursor: "pointer"
};

export const MusicPreviewPlayer: React.FC<MusicPreviewPlayerProps> = ({
  activeTrack,
  playRequestNonce = 0,
  fetchPreviewUrl = getMusicPreviewUrl
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTrackIdRef = useRef<string | null>(null);
  const lastResolvedUrlRef = useRef<string | null>(null);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusReason, setStatusReason] = useState<string | null>(null);

  const stopAudio = (): void => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
  };

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  useEffect(() => {
    const nextTrackId = activeTrack?.id ?? null;
    if (lastTrackIdRef.current === nextTrackId) {
      return;
    }

    stopAudio();
    lastTrackIdRef.current = nextTrackId;
    lastResolvedUrlRef.current = null;
    setActivePreviewUrl(null);
    setErrorMessage(null);
    setStatusReason(null);
  }, [activeTrack?.id]);

  const playResolvedUrl = async (nextUrl: string): Promise<void> => {
    const audio = audioRef.current;
    if (!audio) {
      throw new Error("Preview audio element is unavailable.");
    }

    if (audio.src !== nextUrl) {
      audio.src = nextUrl;
    }

    await audio.play();
    setIsPlaying(true);
  };

  const handlePlay = async (): Promise<void> => {
    if (!activeTrack) {
      setErrorMessage("Choose a track to preview first.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setStatusReason(null);

    try {
      const preview = await requestMusicTrackPreviewPlayback(activeTrack.id, fetchPreviewUrl);
      setStatusReason(preview.reason);

      if (!preview.playableInBrowser || !preview.audioPreviewUrl) {
        stopAudio();
        setActivePreviewUrl(null);
        lastResolvedUrlRef.current = null;
        setErrorMessage(preview.reason);
        return;
      }

      setActivePreviewUrl(preview.audioPreviewUrl);
      lastResolvedUrlRef.current = preview.audioPreviewUrl;
      await playResolvedUrl(preview.audioPreviewUrl);
    } catch (error) {
      stopAudio();
      setActivePreviewUrl(null);
      lastResolvedUrlRef.current = null;
      setErrorMessage(describeMusicPreviewRequestError(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!activeTrack || playRequestNonce === 0) {
      return;
    }

    void handlePlay();
  }, [activeTrack, playRequestNonce]);

  const handlePause = (): void => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const handleStop = (): void => {
    setErrorMessage(null);
    setStatusReason(null);
    stopAudio();
  };

  return (
    <section style={cardStyles} data-music-preview-player="true">
      <div>
        <strong>{activeTrack?.title ?? "Choose a track to preview"}</strong>
        <div style={{marginTop: 4, fontSize: 13, color: "#94a3b8"}}>
          {activeTrack ? `${activeTrack.category}${activeTrack.artist ? ` · ${activeTrack.artist}` : ""}` : "One shared audio player stays here so track cards never spawn their own audio elements."}
        </div>
      </div>

      <div style={buttonRowStyles}>
        <button type="button" style={buttonStyles} onClick={() => void handlePlay()} disabled={!activeTrack || isLoading}>
          {isLoading ? "Requesting preview..." : "Play preview"}
        </button>
        <button type="button" style={buttonStyles} onClick={handlePause} disabled={!isPlaying}>
          Pause
        </button>
        <button type="button" style={buttonStyles} onClick={handleStop} disabled={!activeTrack && !activePreviewUrl}>
          Stop
        </button>
      </div>

      {errorMessage ? (
        <p style={{margin: 0, color: "#fca5a5"}}>{errorMessage}</p>
      ) : statusReason ? (
        <p style={{margin: 0, color: "#94a3b8"}}>{statusReason}</p>
      ) : null}

      {activePreviewUrl ? (
        <p style={{margin: 0, fontSize: 12, color: "#94a3b8"}}>
          Active preview URL ready for browser playback.
        </p>
      ) : null}

      <audio
        ref={audioRef}
        controls
        preload="none"
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onError={() => {
          setIsPlaying(false);
          setErrorMessage("Preview playback failed. The preview URL may be missing or expired.");
        }}
        style={{width: "100%"}}
      />
    </section>
  );
};
