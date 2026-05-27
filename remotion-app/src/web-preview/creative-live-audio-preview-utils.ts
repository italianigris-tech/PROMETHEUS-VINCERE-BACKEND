import type {CreativeMoment, CreativeTimeline, CreativeTrack} from "../creative-orchestration/types";
import {resolveAudioCreativePreviewDurationMs} from "./audio-creative-preview-session";

const sortActiveTracks = (left: CreativeTrack, right: CreativeTrack): number => {
  return right.zIndex - left.zIndex || left.startMs - right.startMs || left.id.localeCompare(right.id);
};

export const selectActiveCreativeTracks = (
  timeline: CreativeTimeline,
  currentTimeMs: number
): CreativeTrack[] => {
  return timeline.tracks
    .filter((track) => currentTimeMs >= track.startMs && currentTimeMs <= track.endMs)
    .sort(sortActiveTracks);
};

export const selectActiveCreativeMoment = (
  timeline: CreativeTimeline,
  currentTimeMs: number
): CreativeMoment | null => {
  const active = timeline.moments.find((moment) => currentTimeMs >= moment.startMs && currentTimeMs <= moment.endMs);
  if (active) {
    return active;
  }

  if (timeline.moments.length === 0) {
    return null;
  }

  const nearestByStart = [...timeline.moments].sort((left, right) => {
    const leftDistance = Math.abs(currentTimeMs - left.startMs);
    const rightDistance = Math.abs(currentTimeMs - right.startMs);
    return leftDistance - rightDistance || left.startMs - right.startMs || left.id.localeCompare(right.id);
  });

  return nearestByStart[0] ?? null;
};

export const resolveLiveCreativePreviewDurationMs = (input: {
  providedDurationMs?: number | null;
  creativeTimeline?: CreativeTimeline | null;
  fallbackDurationMs?: number | null;
}): number => {
  const lastTrackEndMs = input.creativeTimeline?.tracks.reduce((max, track) => Math.max(max, track.endMs), 0) ?? null;
  const lastMomentEndMs = input.creativeTimeline?.moments.reduce((max, moment) => Math.max(max, moment.endMs), 0) ?? null;

  if (
    !input.creativeTimeline &&
    input.providedDurationMs == null &&
    input.fallbackDurationMs == null
  ) {
    return resolveAudioCreativePreviewDurationMs({});
  }

  return resolveAudioCreativePreviewDurationMs({
    providedDurationMs: input.providedDurationMs,
    creativeTimelineDurationMs: input.creativeTimeline?.durationMs ?? null,
    lastTrackEndMs,
    lastCaptionEndMs: lastMomentEndMs,
    fallbackDurationMs: input.fallbackDurationMs
  });
};

export const buildLiveAudioSourceKey = (input: {
  jobId: string;
  audioSrc: string;
  previewTimelineResetVersion?: number;
}): string => {
  const trimmedAudioSrc = input.audioSrc.trim();
  const sourcePart = trimmedAudioSrc.length > 0 ? trimmedAudioSrc : "missing";
  return `${input.jobId}|${sourcePart}|${input.previewTimelineResetVersion ?? 0}`;
};
