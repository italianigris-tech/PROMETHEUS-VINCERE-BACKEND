import React, {useMemo, useEffect, useRef} from "react";

import type {PreviewPerformanceMode} from "../lib/types";
import type {MotionSoundCue} from "../lib/types";
import {usePreviewCurrentTimeMs} from "./frame-store";

type NativePreviewSoundDesignProps = {
  fps: number;
  videoIsPlaying: boolean;
  videoPlaybackRate: number;
  audioUnlocked: boolean;
  previewPerformanceMode: PreviewPerformanceMode;
  musicCues: MotionSoundCue[];
  soundCues: MotionSoundCue[];
};

const PRELOAD_LEAD_MS = 2600;
const CUE_LINGER_MS = 600;

const resolveSoundSrc = (src: string): string => {
  if (/^(https?:)?\/\//.test(src) || src.startsWith("/")) {
    return src;
  }
  return `/${src.replace(/^\/+/, "")}`;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const getCueVolumeEnvelopeAtTimeMs = ({
  cue,
  currentTimeMs,
  fps
}: {
  cue: MotionSoundCue;
  currentTimeMs: number;
  fps: number;
}): number => {
  const relativeFrame = ((currentTimeMs - cue.startMs) / 1000) * fps;
  const introEnd = Math.max(1, cue.fadeInFrames);
  const outroStart = Math.max(introEnd + 1, cue.playFrames - cue.fadeOutFrames);
  const sustainPeak = Math.max(introEnd + 1, Math.min(outroStart, Math.round(cue.playFrames * 0.45)));

  if (relativeFrame <= 0 || relativeFrame >= cue.playFrames) {
    return 0;
  }
  if (relativeFrame <= introEnd) {
    return cue.baseVolume * (relativeFrame / introEnd);
  }
  if (relativeFrame <= sustainPeak) {
    const progress = (relativeFrame - introEnd) / Math.max(1, sustainPeak - introEnd);
    return cue.baseVolume + (cue.maxVolume - cue.baseVolume) * progress;
  }
  if (relativeFrame < outroStart) {
    return cue.maxVolume;
  }

  const fadeProgress = (relativeFrame - outroStart) / Math.max(1, cue.playFrames - outroStart);
  return cue.maxVolume * (1 - fadeProgress);
};

const NativePreviewAudioCue: React.FC<{
  cue: MotionSoundCue;
  fps: number;
  videoIsPlaying: boolean;
  videoPlaybackRate: number;
  audioUnlocked: boolean;
}> = ({cue, fps, videoIsPlaying, videoPlaybackRate, audioUnlocked}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTimeMs = usePreviewCurrentTimeMs(fps);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const cueStartMs = cue.startMs;
    const cueEndMs = cue.endMs;
    const clipStartSeconds = cue.trimBeforeFrames / fps;
    const clipDurationSeconds = cue.playFrames / fps;
    const isWarmed = currentTimeMs >= cueStartMs - PRELOAD_LEAD_MS && currentTimeMs <= cueEndMs + CUE_LINGER_MS;
    const isActive = currentTimeMs >= cueStartMs && currentTimeMs <= cueEndMs;
    const desiredCueSeconds = clamp((currentTimeMs - cueStartMs) / 1000, 0, clipDurationSeconds);
    const desiredAudioSeconds = clipStartSeconds + desiredCueSeconds;

    audio.playbackRate = videoPlaybackRate;
    audio.volume = clamp(getCueVolumeEnvelopeAtTimeMs({cue, currentTimeMs, fps}), 0, 1);

    if (!isWarmed) {
      if (!audio.paused) {
        audio.pause();
      }
      return;
    }

    if (!isActive) {
      if (Math.abs(audio.currentTime - clipStartSeconds) > 0.12) {
        audio.currentTime = clipStartSeconds;
      }
      if (!audio.paused) {
        audio.pause();
      }
      return;
    }

    if (Math.abs(audio.currentTime - desiredAudioSeconds) > 0.18) {
      audio.currentTime = desiredAudioSeconds;
    }

    if (!audioUnlocked || !videoIsPlaying) {
      if (!audio.paused) {
        audio.pause();
      }
      return;
    }

    if (audio.paused) {
      void audio.play().catch(() => {
        // Browsers can still block playback until the stage receives a direct interaction.
      });
    }
  }, [audioUnlocked, cue, currentTimeMs, fps, videoIsPlaying, videoPlaybackRate]);

  return (
    <audio
      ref={audioRef}
      src={resolveSoundSrc(cue.asset.src)}
      preload="auto"
    />
  );
};

export const NativePreviewSoundDesign: React.FC<NativePreviewSoundDesignProps> = ({
  fps,
  videoIsPlaying,
  videoPlaybackRate,
  audioUnlocked,
  previewPerformanceMode,
  musicCues,
  soundCues
}) => {
  const currentTimeMs = usePreviewCurrentTimeMs(fps);
  const renderableCues = useMemo(() => {
    const maxRenderableCues = previewPerformanceMode === "full" ? 3 : 1;
    const inWindow = (cue: MotionSoundCue): boolean => {
      return currentTimeMs >= cue.startMs - PRELOAD_LEAD_MS && currentTimeMs <= cue.endMs + CUE_LINGER_MS;
    };
    const sortCues = (left: MotionSoundCue, right: MotionSoundCue): number => {
      const leftMusic = left.category === "music-bed" ? 1 : 0;
      const rightMusic = right.category === "music-bed" ? 1 : 0;
      const musicDelta = rightMusic - leftMusic;
      if (musicDelta !== 0) {
        return musicDelta;
      }
      const priorityDelta = right.priority - left.priority;
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      const leftDistance = Math.abs(currentTimeMs - left.startMs);
      const rightDistance = Math.abs(currentTimeMs - right.startMs);
      return leftDistance - rightDistance;
    };

    const musicRenderable = [...musicCues]
      .filter(inWindow)
      .sort(sortCues)
      .slice(0, 1);
    const remainingSlots = Math.max(0, maxRenderableCues - musicRenderable.length);
    const soundRenderable = [...soundCues]
      .filter(inWindow)
      .sort(sortCues)
      .slice(0, remainingSlots);

    return [...musicRenderable, ...soundRenderable];
  }, [currentTimeMs, musicCues, previewPerformanceMode, soundCues]);

  if (renderableCues.length === 0) {
    return null;
  }

  return (
    <>
      {renderableCues.map((cue) => (
        <NativePreviewAudioCue
          key={cue.id}
          cue={cue}
          fps={fps}
          videoIsPlaying={videoIsPlaying}
          videoPlaybackRate={videoPlaybackRate}
          audioUnlocked={audioUnlocked}
        />
      ))}
    </>
  );
};
