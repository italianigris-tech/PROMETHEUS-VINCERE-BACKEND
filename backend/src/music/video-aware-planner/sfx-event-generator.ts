import type {TranscribedWord} from "../../schemas";
import {sfxEventSchema, type SfxEvent, type SfxEventType} from "../schemas/sfx-event.schema";
import type {CaptionSyncEvent, VideoTimelineSegment} from "../schemas/video-timeline.schema";

export type GenerateSfxEventsInput = {
  timelineSegments: VideoTimelineSegment[];
  captionSyncEvents?: CaptionSyncEvent[];
  transcriptWords?: TranscribedWord[];
  previewStartSec?: number;
  previewEndSec?: number;
  defaultMixRole?: string;
  maxEvents?: number;
};

const chooseFallbackType = (segment: VideoTimelineSegment): SfxEventType => {
  if (segment.tension >= 0.75) {
    return "tension_riser";
  }
  if (segment.role === "transition") {
    return "whoosh";
  }
  return "none";
};

const normalizeToken = (value: string): string => {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
};

const KEYWORD_EVENT_MAP: Array<{
  tokens: string[];
  type: SfxEventType;
  intensity: number;
  durationSec: number;
}> = [
  {tokens: ["time"], type: "clock_tick", intensity: 0.26, durationSec: 0.22},
  {tokens: ["deadline", "seconds"], type: "timer_beep", intensity: 0.36, durationSec: 0.24},
  {tokens: ["money", "revenue", "profit", "sales"], type: "cash_chime", intensity: 0.34, durationSec: 0.5},
  {tokens: ["mistake", "danger", "problem", "fail"], type: "low_hit", intensity: 0.33, durationSec: 0.45},
  {tokens: ["click", "subscribe", "buy", "join", "start", "try", "download", "book"], type: "resolve_hit", intensity: 0.38, durationSec: 0.55}
];

const REVEAL_TOKENS = new Set(["changed", "secret", "breakthrough", "unlock"]);

const buildEventFromCaptionSync = ({
  event,
  mixRole
}: {
  event: CaptionSyncEvent;
  mixRole: string;
}): SfxEvent => {
  return sfxEventSchema.parse({
    id: event.id,
    type: event.suggestedSfxType,
    assetId: event.suggestedSfxType,
    videoStartSec: Number(event.videoTimeSec.toFixed(3)),
    videoEndSec: Number((event.videoTimeSec + 0.35).toFixed(3)),
    intensity: event.intensity,
    reason: `Caption sync event: ${event.eventType}`,
    triggerText: event.captionText,
    mixRole,
    volumeDb: -16,
    durationSec: 0.35
  });
};

export const generateSfxEvents = (input: GenerateSfxEventsInput): SfxEvent[] => {
  const previewStartSec = input.previewStartSec ?? input.timelineSegments[0]?.startSec ?? 0;
  const previewEndSec = input.previewEndSec ?? input.timelineSegments.at(-1)?.endSec ?? previewStartSec + 20;
  const maxEvents = input.maxEvents ?? 5;
  const mixRole = input.defaultMixRole ?? "timeline_accent";
  const candidates: SfxEvent[] = [];
  const usedBuckets = new Set<string>();

  for (const event of input.captionSyncEvents ?? []) {
    if (!event.suggestedSfxType || event.suggestedSfxType === "none") {
      continue;
    }
    if (event.videoTimeSec < previewStartSec || event.videoTimeSec > previewEndSec) {
      continue;
    }
    candidates.push(buildEventFromCaptionSync({
      event,
      mixRole
    }));
  }

  if (candidates.length === 0) {
    for (const word of input.transcriptWords ?? []) {
      const videoTimeSec = word.start_ms / 1000;
      if (videoTimeSec < previewStartSec || videoTimeSec > previewEndSec) {
        continue;
      }

      const token = normalizeToken(word.text);
      if (!token) {
        continue;
      }

      const bucketKey = `${Math.floor(videoTimeSec)}:${token}`;
      if (usedBuckets.has(bucketKey)) {
        continue;
      }

      const mappedEvent = KEYWORD_EVENT_MAP.find((entry) => entry.tokens.includes(token));
      if (mappedEvent) {
        usedBuckets.add(bucketKey);
        candidates.push(
          sfxEventSchema.parse({
            id: `sfx-word-${token}-${word.start_ms}`,
            type: mappedEvent.type,
            assetId: mappedEvent.type,
            videoStartSec: Number(videoTimeSec.toFixed(3)),
            videoEndSec: Number((videoTimeSec + mappedEvent.durationSec).toFixed(3)),
            intensity: mappedEvent.intensity,
            reason: `Transcript keyword match: ${token}`,
            triggerText: word.text,
            mixRole,
            volumeDb: -16,
            durationSec: mappedEvent.durationSec
          })
        );
        continue;
      }

      if (REVEAL_TOKENS.has(token)) {
        usedBuckets.add(bucketKey);
        const riserStartSec = Number(videoTimeSec.toFixed(3));
        candidates.push(
          sfxEventSchema.parse({
            id: `sfx-word-riser-${token}-${word.start_ms}`,
            type: "tension_riser",
            assetId: "tension_riser",
            videoStartSec: riserStartSec,
            videoEndSec: Number((riserStartSec + 0.65).toFixed(3)),
            intensity: 0.42,
            reason: `Reveal keyword lead-in: ${token}`,
            triggerText: word.text,
            mixRole,
            volumeDb: -17,
            durationSec: 0.65
          })
        );
        candidates.push(
          sfxEventSchema.parse({
            id: `sfx-word-impact-${token}-${word.start_ms}`,
            type: "cinematic_impact",
            assetId: "cinematic_impact",
            videoStartSec: Number((riserStartSec + 0.18).toFixed(3)),
            videoEndSec: Number((riserStartSec + 0.58).toFixed(3)),
            intensity: 0.48,
            reason: `Reveal keyword payoff: ${token}`,
            triggerText: word.text,
            mixRole,
            volumeDb: -16,
            durationSec: 0.4
          })
        );
      }
    }
  }

  if (candidates.length === 0) {
    candidates.push(...input.timelineSegments
      .filter((segment) => chooseFallbackType(segment) !== "none")
      .map((segment) => {
      const type = chooseFallbackType(segment);
      return sfxEventSchema.parse({
        id: `sfx-${segment.id}`,
        type,
        assetId: type,
        videoStartSec: segment.startSec,
        videoEndSec: Number(Math.min(segment.endSec, segment.startSec + 0.5).toFixed(3)),
        intensity: Math.max(segment.tension, 0.35),
        reason: `Deterministic fallback event for ${segment.role}.`,
        triggerText: segment.text,
        mixRole,
        volumeDb: -16,
        durationSec: Number(Math.min(0.5, segment.endSec - segment.startSec).toFixed(3))
      });
    }));
  }

  return candidates
    .sort((left, right) => left.videoStartSec - right.videoStartSec || left.id.localeCompare(right.id))
    .filter((event, index, array) => {
      if (event.videoStartSec < previewStartSec || event.videoStartSec > previewEndSec) {
        return false;
      }
      if (index === 0) {
        return true;
      }
      const previous = array[index - 1];
      return previous.type !== event.type || (event.videoStartSec - previous.videoStartSec) >= 0.8;
    })
    .slice(0, maxEvents);
};
