import {creativeDirectionSchema, videoAwareAudioPlanSchema, type CreativeDirection, type VideoAwareAudioPlan} from "../schemas/audio-plan.schema";
import {captionSyncEventSchema, type CaptionSyncEvent} from "../schemas/video-timeline.schema";
import {synthesizeVideoTimeline, type CaptionTimingInput} from "./timeline-synthesizer";
import {generateSfxEvents} from "./sfx-event-generator";
import {orchestrateArrangement} from "./arrangement-orchestrator";
import type {MusicTrack} from "../schemas/music-track.schema";
import type {R2MusicCatalogEntry} from "../catalog/r2-music-catalog.schema";
import {
  selectedClipSchema,
  transcribedWordSchema,
  type SelectedClip,
  type TranscribedWord
} from "../../schemas";

export type BuildVideoAwareAudioPlanInput = {
  jobId: string;
  projectId?: string | null;
  userId?: string | null;
  sourceVideoId?: string | null;
  transcriptId?: string | null;
  videoDurationSec: number;
  transcriptWords?: TranscribedWord[];
  captionChunks?: CaptionTimingInput[];
  selectedClip?: SelectedClip | null;
  creativeDirection?: Partial<CreativeDirection> | null;
  previewStartSec?: number;
  previewEndSec?: number;
  planMode?: "dry_run" | "render_ready";
  useCatalogCandidates?: boolean;
  catalogEntries?: R2MusicCatalogEntry[];
  candidateTracks?: MusicTrack[];
  now?: () => string;
};

const KEYWORD_TO_SFX: Array<{
  tokens: string[];
  eventType: string;
  suggestedSfxType: CaptionSyncEvent["suggestedSfxType"];
  intensity: number;
}> = [
  {tokens: ["time"], eventType: "time_reference", suggestedSfxType: "clock_tick", intensity: 0.24},
  {tokens: ["deadline", "seconds"], eventType: "deadline_reference", suggestedSfxType: "timer_beep", intensity: 0.33},
  {tokens: ["money", "revenue", "profit", "sales"], eventType: "money_reference", suggestedSfxType: "cash_chime", intensity: 0.34},
  {tokens: ["mistake", "danger", "problem", "fail"], eventType: "problem_reference", suggestedSfxType: "low_hit", intensity: 0.32},
  {tokens: ["changed", "secret", "breakthrough", "unlock"], eventType: "reveal_reference", suggestedSfxType: "tension_riser", intensity: 0.42},
  {tokens: ["click", "subscribe", "buy", "join", "start", "try", "download", "book"], eventType: "cta_reference", suggestedSfxType: "resolve_hit", intensity: 0.38}
];

const normalizeToken = (value: string): string => {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
};

const clampRange = ({
  videoDurationSec,
  previewStartSec,
  previewEndSec
}: {
  videoDurationSec: number;
  previewStartSec?: number;
  previewEndSec?: number;
}): {previewStartSec: number; previewEndSec: number} => {
  const safeVideoDurationSec = Math.max(1, videoDurationSec);
  const startSec = Math.max(0, Math.min(previewStartSec ?? 0, safeVideoDurationSec - 0.25));
  const defaultEndSec = Math.min(20, safeVideoDurationSec);
  const endSec = Math.min(
    safeVideoDurationSec,
    Math.max(startSec + 0.25, previewEndSec ?? defaultEndSec)
  );

  return {
    previewStartSec: Number(startSec.toFixed(3)),
    previewEndSec: Number(endSec.toFixed(3))
  };
};

const toClipTimingInput = (selectedClip: SelectedClip | null | undefined) => {
  if (!selectedClip) {
    return undefined;
  }

  const parsedClip = selectedClipSchema.parse(selectedClip);
  return {
    id: parsedClip.clip_id,
    startSec: parsedClip.export_start_ms / 1000,
    endSec: parsedClip.export_end_ms / 1000,
    label: parsedClip.transcript_excerpt
  };
};

const buildCaptionSyncEvents = ({
  transcriptWords,
  previewStartSec,
  previewEndSec
}: {
  transcriptWords: TranscribedWord[];
  previewStartSec: number;
  previewEndSec: number;
}): CaptionSyncEvent[] => {
  const events: CaptionSyncEvent[] = [];
  const usedTokens = new Set<string>();

  for (const word of transcriptWords) {
    const videoTimeSec = word.start_ms / 1000;
    if (videoTimeSec < previewStartSec || videoTimeSec > previewEndSec) {
      continue;
    }

    const token = normalizeToken(word.text);
    if (!token || usedTokens.has(`${Math.floor(videoTimeSec)}:${token}`)) {
      continue;
    }

    const mapping = KEYWORD_TO_SFX.find((entry) => entry.tokens.includes(token));
    if (!mapping) {
      continue;
    }

    usedTokens.add(`${Math.floor(videoTimeSec)}:${token}`);
    events.push(
      captionSyncEventSchema.parse({
        id: `caption-sync-${token}-${word.start_ms}`,
        videoTimeSec: Number(videoTimeSec.toFixed(3)),
        captionText: word.text,
        eventType: mapping.eventType,
        suggestedSfxType: mapping.suggestedSfxType,
        intensity: mapping.intensity
      })
    );

    if (events.length >= 5) {
      break;
    }
  }

  return events;
};

export const buildVideoAwareAudioPlan = (input: BuildVideoAwareAudioPlanInput): VideoAwareAudioPlan => {
  const transcriptWords = (input.transcriptWords ?? []).map((word) => transcribedWordSchema.parse(word));
  const {previewStartSec, previewEndSec} = clampRange({
    videoDurationSec: input.videoDurationSec,
    previewStartSec: input.previewStartSec,
    previewEndSec: input.previewEndSec
  });
  const nowIso = input.now?.() ?? new Date().toISOString();
  const creativeDirection = creativeDirectionSchema.parse(input.creativeDirection ?? {});
  const selectedClip = toClipTimingInput(input.selectedClip);
  const timelineSegments = synthesizeVideoTimeline({
    videoDurationSec: input.videoDurationSec,
    transcriptWords,
    captionChunks: input.captionChunks ?? [],
    selectedClips: selectedClip ? [selectedClip] : [],
    previewStartSec,
    previewEndSec,
    source: "video_aware_audio_plan_builder"
  });
  const captionSyncEvents = buildCaptionSyncEvents({
    transcriptWords,
    previewStartSec,
    previewEndSec
  });
  const sfxEvents = generateSfxEvents({
    timelineSegments,
    captionSyncEvents,
    transcriptWords,
    previewStartSec,
    previewEndSec,
    maxEvents: 5,
    defaultMixRole: "video_context"
  });
  const plan = orchestrateArrangement({
    id: `video-aware-audio-plan-${input.jobId}`,
    jobId: input.jobId,
    projectId: input.projectId ?? null,
    userId: input.userId ?? null,
    sourceVideoId: input.sourceVideoId ?? null,
    transcriptId: input.transcriptId ?? null,
    videoDurationSec: input.videoDurationSec,
    previewStartSec,
    previewEndSec,
    planMode: input.planMode ?? "dry_run",
    creativeDirection,
    timelineSegments,
    useCatalogCandidates: input.useCatalogCandidates ?? false,
    catalogEntries: input.catalogEntries ?? [],
    candidateTracks: input.candidateTracks ?? [],
    captionSyncEvents,
    sfxEvents,
    createdAt: nowIso,
    updatedAt: nowIso
  });

  return videoAwareAudioPlanSchema.parse({
    ...plan,
    previewStartSec,
    previewEndSec,
    planMode: input.planMode ?? "dry_run"
  });
};
