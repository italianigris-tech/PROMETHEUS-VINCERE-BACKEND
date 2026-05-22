import {musicTrackSchema, type MusicTrack} from "../schemas/music-track.schema";
import {type R2MusicCatalogEntry} from "./r2-music-catalog.schema";

export const r2CatalogEntryToMusicTrack = (
  entry: R2MusicCatalogEntry
): MusicTrack => {
  const renderSafe = entry.renderAllowed && entry.commercialAllowed && entry.licenseVerified;

  return musicTrackSchema.parse({
    id: entry.id,
    title: entry.title,
    artist: entry.artist ?? "Unknown Artist",
    source: "r2_music_catalog",
    sourceUrl: entry.audioPublicUrl ?? null,
    storagePath: `r2://${entry.bucket}/${entry.audioObjectKey}`,
    licenseType: entry.licenseType,
    commercialAllowed: renderSafe,
    attributionRequired: entry.attributionRequired,
    licenseVerified: renderSafe,
    durationSec: entry.durationSec ?? 1,
    bpm: null,
    musicalKey: null,
    energy: 0.5,
    valence: 0.5,
    arousal: 0.5,
    tension: 0.5,
    prestige: 0.5,
    urgency: 0.5,
    clarity: 0.5,
    speechFriendliness: 0.5,
    genreTags: entry.genreTags,
    moodTags: entry.moodTags,
    instrumentTags: [],
    useCaseTags: entry.useCaseTags,
    avoidWhen: entry.avoidWhen,
    beatGrid: null,
    sections: [],
    waveformSummary: null,
    loudnessLufs: null,
    analysisStatus: "pending",
    createdAt: entry.createdAt,
    analyzedAt: null
  });
};

export const r2CatalogEntriesToMusicTracks = (entries: R2MusicCatalogEntry[]): MusicTrack[] => {
  return entries.map((entry) => r2CatalogEntryToMusicTrack(entry));
};
