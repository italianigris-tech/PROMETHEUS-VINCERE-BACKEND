import {musicTrackSchema, type MusicTrack} from "../schemas/music-track.schema";

export const assertTrackUsableForExport = (track: MusicTrack): MusicTrack => {
  const parsedTrack = musicTrackSchema.parse(track);

  if (!parsedTrack.licenseVerified) {
    throw new Error(`Track ${parsedTrack.id} is not export-safe because its license is not verified.`);
  }
  if (!parsedTrack.commercialAllowed) {
    throw new Error(`Track ${parsedTrack.id} is not export-safe because commercial usage is not allowed.`);
  }

  return parsedTrack;
};
