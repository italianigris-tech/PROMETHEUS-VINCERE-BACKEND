import {
  soundDesignManifestSchema,
  type SoundDesignCueTransition,
  type SoundDesignManifest
} from "../../sound-engine/types";
import {musicTrackSchema, type MusicTrack} from "../schemas/music-track.schema";
import {videoAwareAudioPlanSchema, type TransitionEvent, type VideoAwareAudioPlan, type VideoAwareRenderSettings} from "../schemas/audio-plan.schema";
import {sfxEventSchema} from "../schemas/sfx-event.schema";

export type AdaptAudioPlanToSoundDesignManifestInput = {
  plan: VideoAwareAudioPlan;
  tracksById?: Record<string, MusicTrack>;
  sfxAssetPaths?: Record<string, string>;
  dialogueSource?: string;
  defaultAudioSettings?: Partial<VideoAwareRenderSettings>;
};

export type AdaptedSoundDesignRenderHints = {
  planMode: VideoAwareAudioPlan["planMode"];
  unresolvedTrackIds: string[];
  placeholderCueIds: string[];
  unverifiedTrackIds: string[];
  orphanTransitionEvents: Array<{
    id: string;
    type: TransitionEvent["type"];
    videoStartSec: number;
    videoEndSec: number;
  }>;
  duckingRegions: Array<{
    id: string;
    videoStartSec: number;
    videoEndSec: number;
    targetMusicDb: number;
    reason: string;
  }>;
  warnings: string[];
};

export type AdaptedSoundDesignManifest = {
  manifest: SoundDesignManifest;
  renderHints: AdaptedSoundDesignRenderHints;
};

const round = (value: number, digits = 3): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const toPreset = (transitionType: TransitionEvent["type"]): SoundDesignCueTransition["preset"] => {
  switch (transitionType) {
    case "beat_crossfade":
      return "soft_overlap_in";
    case "lowpass_sweep":
    case "highpass_sweep":
      return "filter_sink";
    case "riser_into_impact":
      return "impact_handoff";
    case "drone_bridge":
      return "dialogue_safe_bed";
    case "silence_drop":
      return "echo_throw_cut";
    case "procedural_bridge":
      return "tail_wash_out";
    case "hard_cut":
    case "none":
    default:
      return "soft_overlap_in";
  }
};

const resolveTrackFile = ({
  event,
  track
}: {
  event: VideoAwareAudioPlan["musicEvents"][number];
  track: MusicTrack | undefined;
}): string | null => {
  return track?.storagePath ?? event.storagePath ?? event.sourceObjectKey ?? null;
};

const resolveSfxFile = ({
  assetId,
  sfxAssetPaths
}: {
  assetId: string;
  sfxAssetPaths?: Record<string, string>;
}): string => {
  return sfxAssetPaths?.[assetId] ?? `__sfx_placeholder__/${assetId}.wav`;
};

const sanitizeWindow = ({
  startSec,
  endSec,
  videoDurationSec
}: {
  startSec: number;
  endSec: number;
  videoDurationSec: number;
}): {startSec: number; endSec: number} => {
  const safeStartSec = round(clamp(startSec, 0, videoDurationSec));
  const safeEndSec = round(clamp(endSec, 0, videoDurationSec));

  if (safeEndSec <= safeStartSec) {
    const adjustedEndSec = round(clamp(safeStartSec + 0.001, 0.001, videoDurationSec));
    return {
      startSec: round(Math.min(safeStartSec, Math.max(0, adjustedEndSec - 0.001))),
      endSec: adjustedEndSec
    };
  }

  return {
    startSec: safeStartSec,
    endSec: safeEndSec
  };
};

const sanitizeSourceWindow = ({
  startSec,
  endSec,
  sourceDurationSec
}: {
  startSec: number;
  endSec: number;
  sourceDurationSec?: number;
}): {startSec: number; endSec: number} => {
  if (!sourceDurationSec || sourceDurationSec <= 0) {
    return {
      startSec: Math.max(0, round(startSec)),
      endSec: Math.max(round(endSec), round(startSec + 0.001))
    };
  }

  const safeStartSec = round(clamp(startSec, 0, sourceDurationSec));
  const safeEndSec = round(clamp(endSec, 0, sourceDurationSec));

  if (safeEndSec <= safeStartSec) {
    return {
      startSec: safeStartSec,
      endSec: round(clamp(safeStartSec + 0.001, 0.001, sourceDurationSec))
    };
  }

  return {
    startSec: safeStartSec,
    endSec: safeEndSec
  };
};

const normalizeTransition = ({
  transition,
  cueStartSec,
  cueEndSec,
  phase
}: {
  transition: TransitionEvent;
  cueStartSec: number;
  cueEndSec: number;
  phase: "in" | "out";
}): SoundDesignCueTransition => {
  const cueDurationSec = Math.max(0.001, cueEndSec - cueStartSec);
  const rawDurationSec = Math.max(0.001, transition.videoEndSec - transition.videoStartSec);
  const durationSec = round(Math.min(rawDurationSec, cueDurationSec));
  const startSec = phase === "in" ? cueStartSec : round(cueEndSec - durationSec);

  return {
    preset: toPreset(transition.type),
    start: startSec,
    duration: durationSec,
    settings: {
      ...transition.settings,
      transitionIntensity: transition.intensity,
      downbeatTargetSec: transition.downbeatTargetSec
    }
  };
};

const sortCues = <TCue extends {start: number; end: number; id: string}>(cues: TCue[]): TCue[] => {
  return [...cues].sort((left, right) => left.start - right.start || left.end - right.end || left.id.localeCompare(right.id));
};

export const adaptAudioPlanToSoundDesignManifestWithHints = (
  input: AdaptAudioPlanToSoundDesignManifestInput
): AdaptedSoundDesignManifest => {
  const plan = videoAwareAudioPlanSchema.parse(input.plan);
  const tracksById = Object.fromEntries(
    Object.entries(input.tracksById ?? {}).map(([trackId, track]) => [trackId, musicTrackSchema.parse(track)])
  );
  const transitionById = new Map(plan.transitionEvents.map((event) => [event.id, event]));
  const usedTransitionIds = new Set<string>();
  const unresolvedTrackIds = new Set<string>();
  const placeholderCueIds = new Set<string>();
  const unverifiedTrackIds = new Set<string>();
  const warnings: string[] = [];

  const musicCues = sortCues(plan.musicEvents.map((event) => {
    const cueWindow = sanitizeWindow({
      startSec: event.videoStartSec,
      endSec: event.videoEndSec,
      videoDurationSec: plan.videoDurationSec
    });
    const track = tracksById[event.trackId];
    const resolvedTrackFile = resolveTrackFile({
      event,
      track
    });
    const isPlaceholderTrack = event.trackId === "placeholder-music-bed" || !resolvedTrackFile;
    const renderSafe = event.renderSafe || Boolean(track?.licenseVerified && track?.commercialAllowed);

    if (!resolvedTrackFile) {
      unresolvedTrackIds.add(event.trackId);
    }
    if (isPlaceholderTrack) {
      placeholderCueIds.add(event.id);
    }
    if (event.trackId !== "placeholder-music-bed" && !renderSafe) {
      unverifiedTrackIds.add(track?.id ?? event.trackId);
      warnings.push(`Track ${track?.id ?? event.trackId} is preview-only and not export-safe for manifest cue ${event.id}.`);
    }

    const sourceWindow = sanitizeSourceWindow({
      startSec: event.trackStartSec,
      endSec: event.trackEndSec,
      sourceDurationSec: track?.durationSec
    });
    const transitionIn = event.transitionInId ? transitionById.get(event.transitionInId) : null;
    const transitionOut = event.transitionOutId ? transitionById.get(event.transitionOutId) : null;

    if (transitionIn) {
      usedTransitionIds.add(transitionIn.id);
    }
    if (transitionOut) {
      usedTransitionIds.add(transitionOut.id);
    }

    return {
      id: event.id,
      file: isPlaceholderTrack
        ? `__music_track_placeholder__/${track?.id ?? event.trackId}.wav`
        : resolvedTrackFile,
      start: cueWindow.startSec,
      end: cueWindow.endSec,
      role: "music" as const,
      gainDb: event.volumeDb,
      sourceStart: sourceWindow.startSec,
      sourceEnd: sourceWindow.endSec,
      tempoStretchRatio: undefined,
      transitionIn: transitionIn
        ? normalizeTransition({
            transition: transitionIn,
            cueStartSec: cueWindow.startSec,
            cueEndSec: cueWindow.endSec,
            phase: "in"
          })
        : undefined,
      transitionOut: transitionOut
        ? normalizeTransition({
            transition: transitionOut,
            cueStartSec: cueWindow.startSec,
            cueEndSec: cueWindow.endSec,
            phase: "out"
          })
        : undefined,
      tags: [
        "video-aware-plan",
        `plan-mode:${plan.planMode}`,
        `purpose:${event.purpose}`,
        event.sectionRole ? `section:${event.sectionRole}` : "section:none",
        `beat-aligned:${event.beatAligned}`,
        `ducking-enabled:${event.duckingEnabled}`,
        isPlaceholderTrack ? "source:placeholder" : "source:track",
        renderSafe ? "render-readiness:track_resolved" : "render-readiness:not_export_safe"
      ]
    };
  }));

  const sfxCues = sortCues(plan.sfxEvents.map((rawEvent) => {
    const event = sfxEventSchema.parse(rawEvent);
    const cueWindow = sanitizeWindow({
      startSec: event.videoStartSec,
      endSec: event.videoEndSec,
      videoDurationSec: plan.videoDurationSec
    });

    return {
      id: event.id,
      file: resolveSfxFile({
        assetId: event.assetId,
        sfxAssetPaths: input.sfxAssetPaths
      }),
      start: cueWindow.startSec,
      end: cueWindow.endSec,
      role: "sfx" as const,
      gainDb: event.volumeDb,
      tags: [
        "video-aware-plan",
        `plan-mode:${plan.planMode}`,
        `sfx-type:${event.type}`,
        `mix-role:${event.mixRole}`,
        `trigger:${event.triggerText || "none"}`,
        `reason:${event.reason}`
      ]
    };
  }));

  const manifest = soundDesignManifestSchema.parse({
    duration: round(plan.videoDurationSec),
    dialogueSource: input.dialogueSource,
    dialogue: sortCues(plan.duckingRegions.map((region) => {
      const cueWindow = sanitizeWindow({
        startSec: region.videoStartSec,
        endSec: region.videoEndSec,
        videoDurationSec: plan.videoDurationSec
      });

      return {
        id: region.id,
        start: cueWindow.startSec,
        end: cueWindow.endSec,
        gainDb: region.targetMusicDb,
        label: `${region.reason} [speechPriority=${round(region.speechPriority)}]`
      };
    })).map(({id: _id, ...dialogueSpan}) => dialogueSpan),
    musicCues,
    sfx: sfxCues,
    master: {
      targetI: input.defaultAudioSettings?.targetIntegratedLufs ?? plan.renderSettings.targetIntegratedLufs,
      truePeak: input.defaultAudioSettings?.targetTruePeakDbtp ?? plan.renderSettings.targetTruePeakDbtp,
      lra: input.defaultAudioSettings?.targetLra ?? plan.renderSettings.targetLra,
      sampleRate: input.defaultAudioSettings?.sampleRate ?? plan.renderSettings.sampleRate,
      previewSampleRate: input.defaultAudioSettings?.previewSampleRate ?? plan.renderSettings.previewSampleRate
    },
    presetOverrides: {}
  });

  const orphanTransitionEvents = plan.transitionEvents
    .filter((event) => !usedTransitionIds.has(event.id))
    .map((event) => {
      const cueWindow = sanitizeWindow({
        startSec: event.videoStartSec,
        endSec: event.videoEndSec,
        videoDurationSec: plan.videoDurationSec
      });

      return {
        id: event.id,
        type: event.type,
        videoStartSec: cueWindow.startSec,
        videoEndSec: cueWindow.endSec
      };
    });

  orphanTransitionEvents.forEach((event) => {
    warnings.push(`Transition ${event.id} (${event.type}) could not be mapped directly and remains a render hint.`);
  });

  return {
    manifest,
    renderHints: {
      planMode: plan.planMode,
      unresolvedTrackIds: [...unresolvedTrackIds].sort(),
      placeholderCueIds: [...placeholderCueIds].sort(),
      unverifiedTrackIds: [...unverifiedTrackIds].sort(),
      orphanTransitionEvents,
      duckingRegions: plan.duckingRegions.map((region) => {
        const cueWindow = sanitizeWindow({
          startSec: region.videoStartSec,
          endSec: region.videoEndSec,
          videoDurationSec: plan.videoDurationSec
        });

        return {
          id: region.id,
          videoStartSec: cueWindow.startSec,
          videoEndSec: cueWindow.endSec,
          targetMusicDb: region.targetMusicDb,
          reason: region.reason
        };
      }),
      warnings
    }
  };
};

export const adaptAudioPlanToSoundDesignManifest = (
  input: AdaptAudioPlanToSoundDesignManifestInput
): SoundDesignManifest => {
  return adaptAudioPlanToSoundDesignManifestWithHints(input).manifest;
};
