import type {MusicTrack} from "../schemas/music-track.schema";
import type {VideoTimelineSegment} from "../schemas/video-timeline.schema";
import {musicTrackSchema} from "../schemas/music-track.schema";

export type RankedTrackCandidate = {
  trackId: string;
  score: number;
  reasons: string[];
  matchedSectionIds: string[];
};

export type RankTracksInput = {
  tracks: MusicTrack[];
  segment: VideoTimelineSegment;
  creativeDirectionTags?: string[];
};

const clamp = (value: number): number => {
  return Math.max(0, Math.min(1, value));
};

const overlapScore = (left: string[], right: string[]): number => {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const rightSet = new Set(right.map((value) => value.toLowerCase()));
  const matches = left.filter((value) => rightSet.has(value.toLowerCase())).length;
  return matches / Math.max(left.length, right.length);
};

export const rankTracks = (input: RankTracksInput): RankedTrackCandidate[] => {
  const creativeDirectionTags = input.creativeDirectionTags ?? [];

  return input.tracks
    .map((track) => musicTrackSchema.parse(track))
    .map((track) => {
      const reasons: string[] = [];
      const energyFit = 1 - Math.abs(track.energy - input.segment.energy);
      const tensionFit = 1 - Math.abs(track.tension - input.segment.tension);
      const speechFit = track.speechFriendliness;
      const moodFit = overlapScore(track.moodTags, creativeDirectionTags);
      const roleMatchIds = track.sections
        .filter((section) => section.bestFor.includes(input.segment.role))
        .map((section) => section.id);

      if (roleMatchIds.length > 0) {
        reasons.push(`Matched section role fit for ${input.segment.role}.`);
      }
      if (moodFit > 0) {
        reasons.push("Matched creative direction tags.");
      }
      if (speechFit >= 0.6) {
        reasons.push("Track favors dialogue clarity.");
      }

      const score = clamp((energyFit * 0.35) + (tensionFit * 0.2) + (speechFit * 0.3) + (moodFit * 0.15));

      return {
        trackId: track.id,
        score: Number(score.toFixed(3)),
        reasons: reasons.length > 0 ? reasons : ["Phase 1 placeholder ranking."],
        matchedSectionIds: roleMatchIds
      };
    })
    .sort((left, right) => right.score - left.score || left.trackId.localeCompare(right.trackId));
};
