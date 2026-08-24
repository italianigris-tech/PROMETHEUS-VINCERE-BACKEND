/**
 * MINI LANDSCAPE RUNS — SONG CATALOG
 *
 * Data contract + loader for the personal song track selector. The catalogue is
 * the long-form music corpus (the "~224 personal song tracks" the studio works
 * from). Every track carries a *semantic fingerprint* so the song selector can
 * match a section vibe to a track AND decide how well two tracks blend across a
 * section boundary.
 */

import type { SongTrack, VibeVector } from "./types.js";

export interface SongCatalog {
  source: string;
  tracks: SongTrack[];
}

/** Default folder searched for personal song files. */
export const DEFAULT_LOCAL_SONG_DIR = "remotion-app/public/joseph-music";

/**
 * The general sound bed. Studio policy (AUD-08) keeps the bed EMPTY — it is not
 * the crux. This sentinel is what the programme assigns when no bed is curated.
 */
export const EMPTY_BED_ID = "songbed_empty";

const v = (
  energy: number,
  momentum: number,
  warmth: number,
  clarity: number,
  conviction: number,
  prestige: number,
): VibeVector => ({ energy, momentum, warmth, clarity, conviction, prestige });

/**
 * Seed catalogue — used when the on-disk personal catalog is not yet populated.
 * These model a real multi-hundred-track library: varied energy, tempo, vocals
 * policy and mood tags so the selector can demonstrate vibe matching + fatigue
 * rotation without any audio files present.
 */
export const SEED_SONG_TRACKS: SongTrack[] = [
  {
    id: "seed_soft_desk_piano_01", title: "Quiet Desk Piano", artist: "LibrarySetters",
    source: "seed", assetPath: "/music/seed_soft_desk_piano_01.mp3",
    fingerprint: { ...v(0.28, 0.22, 0.7, 0.6, 0.25, 0.15), intensity: 1 },
    tempo: 82, key: "C", hasVocals: false, speechFriendliness: 0.92,
    genreTags: ["piano", "ambient"], moodTags: ["calm", "warm", "intimate"],
    useCaseTags: ["setup", "explain"], avoidWhen: ["high_energy"],
    durationSec: null, renderSafe: true, licenseStatus: "internal",
  },
  {
    id: "seed_executive_board_02", title: "Executive Board Bed", artist: "LibrarySetters",
    source: "seed", assetPath: "/music/seed_executive_board_02.mp3",
    fingerprint: { ...v(0.5, 0.45, 0.5, 0.8, 0.6, 0.85), intensity: 2 },
    tempo: 96, key: "Am", hasVocals: false, speechFriendliness: 0.88,
    genreTags: ["business", "orchestral"], moodTags: ["premium", "focused", "clean"],
    useCaseTags: ["overview", "convin"], avoidWhen: ["low_energy"],
    durationSec: null, renderSafe: true, licenseStatus: "internal",
  },
  {
    id: "seed_tech_pulse_03", title: "Data Centre Pulse", artist: "LibrarySetters",
    source: "seed", assetPath: "/music/seed_tech_pulse_03.mp3",
    fingerprint: { ...v(0.62, 0.7, 0.22, 0.85, 0.7, 0.9), intensity: 2 },
    tempo: 120, key: "D", hasVocals: false, speechFriendliness: 0.7,
    genreTags: ["techno", "electro"], moodTags: ["urgent", "analytical", "technical"],
    useCaseTags: ["demonstrate", "workflow"], avoidWhen: ["calm"],
    durationSec: null, renderSafe: true, licenseStatus: "internal",
  },
  {
    id: "seed_cinematic_braam_04", title: "Deep Cinema Braam", artist: "LibrarySetters",
    source: "seed", assetPath: "/music/seed_cinema_braam_04.mp3",
    fingerprint: { ...v(0.85, 0.8, 0.3, 0.5, 0.95, 0.9), intensity: 3 },
    tempo: 70, key: "Am", hasVocals: false, speechFriendliness: 0.55,
    genreTags: ["cinematic", "orchestral"], moodTags: ["epic", "dramatic", "intense"],
    useCaseTags: ["payoff", "hook"], avoidWhen: ["light", "comedy"],
    durationSec: null, renderSafe: true, licenseStatus: "internal",
  },
{
    id: "seed_warm_funk_05", title: "Warm Funk Groove", artist: "LibrarySetters",
    source: "seed", assetPath: "/music/seed_warm_funk_05.mp3",
    fingerprint: { ...v(0.72, 0.82, 0.6, 0.4, 0.4, 0.8), intensity: 3 },
    tempo: 108, key: "G", hasVocals: false, speechFriendliness: 0.5,
    genreTags: ["funk"], moodTags: ["happy", "energetic"],
    useCaseTags: ["transition", "unlock"], avoidWhen: ["serious", "documentary"],
    durationSec: null, renderSafe: true, licenseStatus: "internal",
  },
  {
    id: "seed_driving_beat_06", title: "Driving Beat", artist: "LibrarySetters",
    source: "seed", assetPath: "/music/seed_driving_beat_06.mp3",
    fingerprint: { ...v(0.78, 0.75, 0.45, 0.3, 0.85, 0.6), intensity: 4 },
    tempo: 92, key: "G", hasVocals: true, speechFriendliness: 0.4,
    genreTags: ["hip-hop", "beat"], moodTags: ["confident", "driving"],
    useCaseTags: ["payoff"], avoidWhen: ["calm", "intimate"],
    durationSec: null, renderSafe: true, licenseStatus: "internal",
  },
  {
    id: "seed_documentary_emotive_07", title: "Documentary Emotive", artist: "LibrarySetters",
    source: "seed", assetPath: "/music/seed_documentary_07.mp3",
    fingerprint: { ...v(0.68, 0.6, 0.55, 0.7, 0.75, 0.8), intensity: 3 },
    tempo: 88, key: "Am", hasVocals: false, speechFriendliness: 0.72,
    genreTags: ["documentary", "orchestral"], moodTags: ["emotive", "moving"],
    useCaseTags: ["demonstrate", "payoff"], avoidWhen: ["comedic"],
    durationSec: null, renderSafe: true, licenseStatus: "internal",
  },
  {
    id: "seed_luxe_ambient_pad_08", title: "Luxe Ambient Pad", artist: "LibrarySetters",
    source: "seed", assetPath: "/music/seed_luxe_ambient_08.mp3",
    fingerprint: { ...v(0.3, 0.25, 0.75, 0.6, 0.35, 0.9), intensity: 2 },
    tempo: 60, key: "C", hasVocals: false, speechFriendliness: 0.9,
    genreTags: ["ambient"], moodTags: ["luxurious", "premium", "calm"],
    useCaseTags: ["intro", "outro"], avoidWhen: ["high_energy"],
    durationSec: null, renderSafe: true, licenseStatus: "internal",
  },
  {
    id: "seed_lofi_focus_loop_09", title: "Focus Lo-Fi Loop", artist: "LibrarySetters",
    source: "seed", assetPath: "/music/seed_lofi_loop_09.mp3",
    fingerprint: { ...v(0.4, 0.5, 0.7, 0.65, 0.5, 0.3), intensity: 2 },
    tempo: 82, key: "F", hasVocals: false, speechFriendliness: 0.8,
    genreTags: ["lofi", "hip-hop"], moodTags: ["focused", "relaxed"],
    useCaseTags: ["study", "explain"], avoidWhen: ["climax"],
    durationSec: null, renderSafe: true, licenseStatus: "internal",
  },
];
/**
 * Blend affinity between two songs — the *semantic* compatibility gate. Two
 * songs blend when their fingerprints are close (small mood distance), their
 * tempo feels are compatible, and the energy delta is small enough not to jerk
 * the listener into fatigue. Returns 0..1 where 1 = seamless.
 */
/**
 * SEED → REAL SONG BRIDGE (Cloudflare R2 `prometheus-music` bucket).
 *
 * The seed tracks above carry fingerprints but NO audio. The real literal
 * songs live in R2 under `music-originals/<category>/<track>.mp3` (150 tracks:
 * classical, cinematic trailer, hip-hop, lo-fi, motivational, pop, tech).
 * `bake_soundtrack.py` / `fetch_songs.py` use this table to resolve each seed
 * to an actual song — so the per-section song windows, blends, ducking and
 * loudness treatments run on REAL music, never on sound effects.
 */
export interface SeedSongBridgeEntry {
  seedTrackId: string;
  /** Local file name in docs/mini_landscape_runs/music/. */
  songFile: string;
  /** R2 object key under music-originals/. */
  r2ObjectKey: string;
  /** Why this seed maps to this song (fingerprint match). */
  match: string;
}

export const SEED_TO_R2_SONG_BRIDGE: SeedSongBridgeEntry[] = [
  {
    seedTrackId: "seed_cinematic_braam_04",
    songFile: "epic-cinematic-dramatic-adventure-trailer.mp3",
    r2ObjectKey: "cinematic-trailer-epic/epic-cinematic-dramatic-adventure-trailer.mp3",
    match: "high energy / cinematic / epic — hook & payoff",
  },
  {
    seedTrackId: "seed_soft_desk_piano_01",
    songFile: "passacaglia-handel-halvorsen-relaxing-piano-music.mp3",
    r2ObjectKey: "classical/passacaglia-handel-halvorsen-relaxing-piano-music.mp3",
    match: "calm / warm / intimate piano — setup",
  },
  {
    seedTrackId: "seed_executive_board_02",
    songFile: "vivaldi-the-four-seasons-summer-violin-concerto-in-g-minor-op-8-2-rv-315-iii-presto.mp3",
    r2ObjectKey: "classical-orchestral-prestige/vivaldi-the-four-seasons-summer-violin-concerto-in-g-minor-op-8-2-rv-315-iii-presto.mp3",
    match: "premium / focused / orchestral prestige — explain",
  },
  {
    seedTrackId: "seed_documentary_emotive_07",
    songFile: "triumph.mp3",
    r2ObjectKey: "motivational-uplift/triumph.mp3",
    match: "emotive / moving / documentary uplift — demonstrate",
  },
  {
    seedTrackId: "seed_luxe_ambient_pad_08",
    songFile: "the-way-instrumental.mp3",
    r2ObjectKey: "lo-fi-chill-soft-focus/the-way-instrumental.mp3",
    match: "ambient / luxurious / calm — outro",
  },
  {
    seedTrackId: "seed_cinematic_braam_04",
    songFile: "epic-inspiration.mp3",
    r2ObjectKey: "cinematic-trailer-epic/epic-inspiration.mp3",
    match: "alternate epic song for the payoff emotional insert",
  },
];

export const songBlendScore = (a: SongTrack, b: SongTrack): number => {
  if (a.id === b.id) return 1;
  const moodDistance =
    Math.abs(a.fingerprint.energy - b.fingerprint.energy) * 0.2 +
    Math.abs(a.fingerprint.warmth - b.fingerprint.warmth) * 0.15 +
    Math.abs(a.fingerprint.momentum - b.fingerprint.momentum) * 0.2 +
    Math.abs(a.fingerprint.prestige - b.fingerprint.prestige) * 0.1;
  const tempoFit = a.tempo && b.tempo ? 1 - Math.min(1, Math.abs(a.tempo - b.tempo) / 90) : 0.7;
  const energyJump = Math.min(1, Math.abs(a.fingerprint.energy - b.fingerprint.energy) * 2.2);
  return clamp01(1 - moodDistance * 0.55 - energyJump * 0.35 + tempoFit * 0.18);
};

export interface LoadSongCatalogInput {
  catalogDir?: string;
  /** Optional extension point: pull tracks from a deployment-specific source. */
  catalogOverride?: SongTrack[];
}

/**
 * Loads the personal song catalog. The on-disk corpus is not checked into this
 * repo yet, so this honours an injected override first, then the seed catalogue.
 * It NEVER invents a song choice — selection belongs to the song selector.
 */
export const loadSongCatalog = (input: LoadSongCatalogInput = {}): SongCatalog => {
  if (input.catalogOverride && input.catalogOverride.length > 0) {
    return { source: "override", tracks: input.catalogOverride };
  }
  return { source: "seed", tracks: SEED_SONG_TRACKS };
};
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));