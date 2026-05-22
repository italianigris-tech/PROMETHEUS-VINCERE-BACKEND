import {rankTracks} from "../planner/music-ranker";
import {r2CatalogEntriesToMusicTracks} from "../catalog/r2-catalog-to-music-track";
import {selectCatalogCandidatesForTimeline} from "../catalog/catalog-candidate-selector";
import {
  duckingRegionSchema,
  musicEventSchema,
  videoAwareAudioPlanSchema,
  type CreativeDirection,
  type VideoAwareAudioPlan
} from "../schemas/audio-plan.schema";
import type {MusicTrack} from "../schemas/music-track.schema";
import type {SfxEvent} from "../schemas/sfx-event.schema";
import type {CaptionSyncEvent, VideoTimelineSegment} from "../schemas/video-timeline.schema";
import type {R2MusicCatalogEntry} from "../catalog/r2-music-catalog.schema";

export type OrchestrateArrangementInput = {
  id: string;
  jobId: string;
  projectId?: string | null;
  userId?: string | null;
  sourceVideoId?: string | null;
  transcriptId?: string | null;
  videoDurationSec: number;
  previewStartSec?: number | null;
  previewEndSec?: number | null;
  planMode?: "dry_run" | "render_ready";
  creativeDirection?: CreativeDirection;
  timelineSegments: VideoTimelineSegment[];
  useCatalogCandidates?: boolean;
  catalogEntries?: R2MusicCatalogEntry[];
  candidateTracks: MusicTrack[];
  captionSyncEvents?: CaptionSyncEvent[];
  sfxEvents?: SfxEvent[];
  createdAt?: string;
  updatedAt?: string;
};

const roundToMillis = (value: number): number => {
  return Number(value.toFixed(3));
};

const dominantRoleForSegments = (segments: VideoTimelineSegment[]): VideoTimelineSegment["role"] => {
  const scoreByRole = new Map<VideoTimelineSegment["role"], number>();

  for (const segment of segments) {
    const durationSec = Math.max(0.1, segment.endSec - segment.startSec);
    const strength = durationSec * (1 + segment.hookStrength + segment.proofStrength + segment.ctaStrength);
    scoreByRole.set(segment.role, (scoreByRole.get(segment.role) ?? 0) + strength);
  }

  return [...scoreByRole.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "explanation";
};

const purposeForRole = (role: VideoTimelineSegment["role"]): string => {
  switch (role) {
    case "hook":
      return "video_hook_bed";
    case "problem":
      return "problem_tension_bed";
    case "proof":
      return "proof_support_bed";
    case "reveal":
      return "reveal_lift_bed";
    case "cta":
      return "cta_resolve_bed";
    case "outro":
      return "outro_release_bed";
    case "setup":
      return "setup_support_bed";
    case "transition":
      return "transition_bridge_bed";
    default:
      return "explanation_support_bed";
  }
};

const isRenderSafeTrack = (track: MusicTrack | null | undefined): boolean => {
  return Boolean(track?.licenseVerified && track.commercialAllowed);
};

const buildTrackSequence = ({
  orderedTracks,
  previewDurationSec
}: {
  orderedTracks: MusicTrack[];
  previewDurationSec: number;
}): MusicTrack[] => {
  if (orderedTracks.length <= 1) {
    return orderedTracks.slice(0, 1);
  }

  const sequence: MusicTrack[] = [];
  let coveredDurationSec = 0;
  let cursor = 0;
  const maxCues = Math.min(6, orderedTracks.length * 2);

  while (coveredDurationSec < previewDurationSec - 0.001 && sequence.length < maxCues) {
    const candidate = orderedTracks[cursor % orderedTracks.length];
    cursor += 1;
    if (!candidate) {
      break;
    }
    if (sequence.at(-1)?.id === candidate.id && orderedTracks.length > 1) {
      continue;
    }

    const previous = sequence.at(-1);
    const overlapSec = previous && previous.beatGrid?.beatTimesSec.length && candidate.beatGrid?.beatTimesSec.length
      ? 0.8
      : 0.45;
    sequence.push(candidate);
    coveredDurationSec += candidate.durationSec - (previous ? overlapSec : 0);
  }

  return sequence.length > 0 ? sequence : orderedTracks.slice(0, 1);
};

const transitionTypeForTracks = (
  fromTrack: MusicTrack,
  toTrack: MusicTrack
): VideoAwareAudioPlan["transitionEvents"][number]["type"] => {
  const bothBeatAware = Boolean(fromTrack.beatGrid?.beatTimesSec.length && toTrack.beatGrid?.beatTimesSec.length);
  if (bothBeatAware) {
    return "beat_crossfade";
  }

  if (toTrack.energy >= fromTrack.energy + 0.08) {
    return "riser_into_impact";
  }

  if (toTrack.speechFriendliness >= 0.72) {
    return "drone_bridge";
  }

  return "procedural_bridge";
};

export const orchestrateArrangement = (input: OrchestrateArrangementInput): VideoAwareAudioPlan => {
  const createdAt = input.createdAt ?? "1970-01-01T00:00:00.000Z";
  const updatedAt = input.updatedAt ?? createdAt;
  const previewStartSec = input.previewStartSec ?? 0;
  const previewEndSec = input.previewEndSec ?? input.videoDurationSec;
  const planMode = input.planMode ?? "dry_run";
  const leadSegment = input.timelineSegments[0];
  const dominantRole = dominantRoleForSegments(input.timelineSegments);
  const selectedCatalogCandidates =
    input.useCatalogCandidates && input.catalogEntries && input.catalogEntries.length > 0
      ? selectCatalogCandidatesForTimeline({
          timelineSegments: input.timelineSegments,
          catalogEntries: input.catalogEntries,
          planMode,
          limit: 6
        })
      : null;
  const catalogTracks = selectedCatalogCandidates
    ? r2CatalogEntriesToMusicTracks(selectedCatalogCandidates.entries)
    : [];
  const catalogPrimaryTrack = catalogTracks[0] ?? null;
  const catalogPrimaryEntry = selectedCatalogCandidates?.entries[0] ?? null;
  const catalogPrimaryReasons = selectedCatalogCandidates?.rankedCandidates[0]?.reasons ?? [];
  const safeCandidateTracks = input.candidateTracks.filter((track) => track.licenseVerified && track.commercialAllowed);
  const rankedTracks =
    !catalogPrimaryTrack && leadSegment && safeCandidateTracks.length > 0
      ? rankTracks({
          tracks: safeCandidateTracks,
          segment: leadSegment,
          creativeDirectionTags: input.creativeDirection?.moodTags ?? []
        })
      : [];
  const rankedLocalTracks = rankedTracks
    .map((candidate) => safeCandidateTracks.find((track) => track.id === candidate.trackId) ?? null)
    .filter((track): track is MusicTrack => Boolean(track));
  const primaryTrack = catalogPrimaryTrack ?? (
    rankedTracks[0]
      ? safeCandidateTracks.find((track) => track.id === rankedTracks[0].trackId) ?? null
      : null
  );
  const primaryTrackRenderSafe = isRenderSafeTrack(primaryTrack);
  const previewOnly = Boolean(
    catalogPrimaryEntry
      ? !catalogPrimaryEntry.renderAllowed
      : primaryTrack && !primaryTrackRenderSafe
  );
  const previewDurationSec = Math.max(0.25, previewEndSec - previewStartSec);
  const catalogEntryById = new Map(
    (selectedCatalogCandidates?.entries ?? []).map((entry) => [entry.id, entry] as const)
  );
  const orderedTracks = primaryTrack
    ? catalogPrimaryTrack
      ? [
          primaryTrack,
          ...catalogTracks.filter((track) => track.id !== primaryTrack.id)
        ]
      : [
          primaryTrack,
          ...rankedLocalTracks.filter((track) => track.id !== primaryTrack.id)
        ]
    : [];
  const trackSequence = buildTrackSequence({
    orderedTracks,
    previewDurationSec
  });
  const musicEvents = trackSequence.length > 0
    ? (() => {
        const events: VideoAwareAudioPlan["musicEvents"] = [];
        const transitions: VideoAwareAudioPlan["transitionEvents"] = [];
        let cursorSec = previewStartSec;

        trackSequence.forEach((track, index) => {
          const remainingSec = Math.max(0, previewEndSec - cursorSec);
          if (remainingSec <= 0) {
            return;
          }
          const nextTrack = trackSequence[index + 1] ?? null;
          const overlapSec = nextTrack
            ? track.beatGrid?.beatTimesSec.length && nextTrack.beatGrid?.beatTimesSec.length
              ? 0.8
              : 0.45
            : 0;
          const entry = catalogEntryById.get(track.id) ?? null;
          const eventPreviewOnly = entry ? !entry.renderAllowed : !isRenderSafeTrack(track);
          const eventRenderSafe = entry ? entry.renderAllowed : isRenderSafeTrack(track);
          const eventDurationSec = Math.min(track.durationSec, remainingSec + overlapSec);
          const videoEndSec = roundToMillis(Math.min(previewEndSec, cursorSec + eventDurationSec));
          const transitionInId = index > 0 ? `${input.id}-transition-${String(index).padStart(2, "0")}` : null;
          const transitionOutId = nextTrack ? `${input.id}-transition-${String(index + 1).padStart(2, "0")}` : null;

          events.push(
            musicEventSchema.parse({
              id: `${input.id}-music-${String(index + 1).padStart(2, "0")}`,
              trackId: track.id,
              videoStartSec: roundToMillis(cursorSec),
              videoEndSec,
              trackStartSec: 0,
              trackEndSec: roundToMillis(Math.min(track.durationSec, eventDurationSec)),
              sectionRole: track.sections[0]?.role ?? null,
              purpose: purposeForRole(dominantRole),
              storagePath: track.storagePath,
              sourceObjectKey: entry?.audioObjectKey ?? null,
              previewOnly: eventPreviewOnly,
              renderSafe: eventRenderSafe,
              warning: eventPreviewOnly
                ? [
                    "Preview only / license not verified.",
                    ...(index === 0 ? catalogPrimaryReasons : [])
                  ].join(" ")
                : (index === 0 ? catalogPrimaryReasons[0] ?? null : null),
              volumeDb: index === 0 ? -24 : -23,
              fadeInSec: index === 0 ? 0.3 : 0.22,
              fadeOutSec: nextTrack ? Math.max(0.45, overlapSec) : 1.2,
              duckingEnabled: true,
              beatAligned: Boolean(track.beatGrid?.beatTimesSec.length),
              transitionInId,
              transitionOutId
            })
          );

          if (nextTrack) {
            const transitionStartSec = roundToMillis(Math.max(previewStartSec, videoEndSec - overlapSec));
            transitions.push({
              id: `${input.id}-transition-${String(index + 1).padStart(2, "0")}`,
              type: transitionTypeForTracks(track, nextTrack),
              videoStartSec: transitionStartSec,
              videoEndSec,
              fromTrackId: track.id,
              toTrackId: nextTrack.id,
              intensity: roundToMillis(Math.min(1, (track.energy + nextTrack.energy) / 2)),
              beatAligned: Boolean(track.beatGrid?.downbeatTimesSec.length && nextTrack.beatGrid?.downbeatTimesSec.length),
              downbeatTargetSec: transitionStartSec,
              settings: {
                overlapSec
              }
            });
            cursorSec = roundToMillis(Math.max(previewStartSec, videoEndSec - overlapSec));
          } else {
            cursorSec = videoEndSec;
          }
        });

        return {
          events,
          transitions
        };
      })()
    : null;
  const fallbackMusicEvents = primaryTrack
    ? null
    : [
        musicEventSchema.parse({
          id: `${input.id}-music-placeholder-01`,
          trackId: "placeholder-music-bed",
          videoStartSec: previewStartSec,
          videoEndSec: previewEndSec,
          trackStartSec: 0,
          trackEndSec: previewDurationSec,
          sectionRole: null,
          purpose: purposeForRole(dominantRole),
          storagePath: null,
          sourceObjectKey: null,
          previewOnly: false,
          renderSafe: false,
          warning: selectedCatalogCandidates?.warnings[0] ?? null,
          volumeDb: -24,
          fadeInSec: 0.3,
          fadeOutSec: 1.5,
          duckingEnabled: true,
          beatAligned: false,
          transitionInId: null,
          transitionOutId: null
        })
      ];
  const resolvedMusicEvents = musicEvents?.events ?? fallbackMusicEvents ?? [];
  const resolvedTransitionEvents = musicEvents?.transitions ?? [];
  const duckingRegions = input.timelineSegments
    .filter((segment) => segment.speechDensity >= 0.12)
    .map((segment) =>
      duckingRegionSchema.parse({
        id: `duck-${segment.id}`,
        videoStartSec: segment.startSec,
        videoEndSec: segment.endSec,
        reason: `Dialogue protection for ${segment.role}.`,
        targetMusicDb: -21,
        speechPriority: roundToMillis(segment.speechDensity)
      })
    );

  return videoAwareAudioPlanSchema.parse({
    id: input.id,
    jobId: input.jobId,
    projectId: input.projectId ?? null,
    userId: input.userId ?? null,
    sourceVideoId: input.sourceVideoId ?? null,
    transcriptId: input.transcriptId ?? null,
    videoDurationSec: input.videoDurationSec,
    previewStartSec,
    previewEndSec,
    creativeDirection: input.creativeDirection ?? {},
    timelineSegments: input.timelineSegments,
    musicEvents: resolvedMusicEvents,
    transitionEvents: resolvedTransitionEvents,
    sfxEvents: input.sfxEvents ?? [],
    duckingRegions,
    captionSyncEvents: input.captionSyncEvents ?? [],
    renderSettings: {
      notes: [
        primaryTrack
          ? catalogPrimaryEntry
            ? previewOnly
              ? "Phase 6 dry-run selected a real R2 catalog track for preview-only browsing."
              : "Phase 6 selected a render-safe R2 catalog track."
            : "Phase 2 dry-run selected a license-safe local candidate track."
          : "Phase 2 dry-run used a placeholder music bed because no export-safe catalog track was available.",
        ...(resolvedMusicEvents.length > 1
          ? [`Chained ${resolvedMusicEvents.length} music cues to cover the ${roundToMillis(previewDurationSec)} second preview window.`]
          : []),
        ...(selectedCatalogCandidates?.warnings ?? [])
      ]
    },
    outputAudioPath: null,
    outputVideoPath: null,
    status: "planned",
    errorMessage: null,
    createdAt,
    updatedAt
  });
};
