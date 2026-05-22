import {musicTrackSchema, type MusicTrack} from "../schemas/music-track.schema";

export type IndexTrackInput = {
  id: string;
  title: string;
  artist: string;
  source: string;
  sourceUrl?: string | null;
  storagePath?: string | null;
  licenseType?: string;
  commercialAllowed?: boolean;
  attributionRequired?: boolean;
  licenseVerified?: boolean;
  durationSec: number;
  bpm?: number | null;
  musicalKey?: string | null;
  genreTags?: string[];
  moodTags?: string[];
  instrumentTags?: string[];
  useCaseTags?: string[];
  avoidWhen?: string[];
  createdAt?: string;
};

export const indexTrack = (input: IndexTrackInput): MusicTrack => {
  const createdAt = input.createdAt ?? "1970-01-01T00:00:00.000Z";

  return musicTrackSchema.parse({
    id: input.id,
    title: input.title,
    artist: input.artist,
    source: input.source,
    sourceUrl: input.sourceUrl ?? null,
    storagePath: input.storagePath ?? null,
    licenseType: input.licenseType ?? "unknown",
    commercialAllowed: input.commercialAllowed ?? false,
    attributionRequired: input.attributionRequired ?? false,
    licenseVerified: input.licenseVerified ?? false,
    durationSec: input.durationSec,
    bpm: input.bpm ?? null,
    musicalKey: input.musicalKey ?? null,
    energy: 0.5,
    valence: 0.5,
    arousal: 0.5,
    tension: 0.5,
    prestige: 0.5,
    urgency: 0.5,
    clarity: 0.5,
    speechFriendliness: 0.5,
    genreTags: input.genreTags ?? [],
    moodTags: input.moodTags ?? [],
    instrumentTags: input.instrumentTags ?? [],
    useCaseTags: input.useCaseTags ?? [],
    avoidWhen: input.avoidWhen ?? [],
    beatGrid: null,
    sections: [],
    waveformSummary: null,
    loudnessLufs: null,
    analysisStatus: "indexed",
    createdAt,
    analyzedAt: null
  });
};
