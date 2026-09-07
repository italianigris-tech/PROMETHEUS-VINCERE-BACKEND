# Prometheus Mini-Run Sound & Music System: Catalog & Selection Engine

This document provides the definitive specification and reference for the utilization of sound and music within the **Prometheus Mini-Run pipeline** (`mini_run_pipeline`). It outlines:

1. **How the Individual Selects Songs** (explicit creator/client overrides, metadata filters, custom tracks).
2. **How the System Selects Songs** (autonomous multi-factor scoring matrix, look synergy, speech pacing, sidechain ducking).
3. **What Songs It Selects On In General** (the complete, verified 31-track catalog of approved selectable music).
4. **Gateway REST API & Programmatic Access** (`/api/pipeline/music/catalog`).

---

## 1. How the Individual Selects Songs

The individual (creator, UI user, or API caller) can steer or dictate song selection at whatever level of granularity they prefer. Parameters can be passed inside `payload["audio"]`, `payload["design"]`, or at the root of `payload` (the gateway consolidates them automatically).

### Selection Controls & Overrides

| Parameter | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `songTrackId` / `songId` / `trackId` | `string` | Selects an exact track by its canonical slug or ID. Bypasses scoring. | `"music-preview-cinematic-trailer-epic-intense-trailer"` |
| `songTitle` / `songName` / `songQuery` | `string` | Fuzzy or substring search against track titles. | `"The Way"`, `"Vivaldi"`, `"Firestone"` |
| `songGenre` / `songCategory` | `string` | Restricts selection to a specific genre or category. | `"lo-fi"`, `"trap"`, `"classical"`, `"phonk"` |
| `songMood` / `mood` | `string` | Restricts selection to tracks matching a mood tag. | `"chill"`, `"epic"`, `"focus"`, `"dark"`, `"triumphant"` |
| `songIntensity` / `songEnergy` | `string` | Enforces energy level (`"soft"`, `"medium"`, `"hard"`). | `"hard"` (trap/phonk), `"soft"` (piano/lo-fi) |
| `songArtist` / `artist` | `string` | Filters candidates by artist name. | `"Kygo"`, `"Damma Beatz"`, `"Vivaldi"` |
| `songSource` / `songPath` / `songUrl` | `string` | Supplies a custom audio track (local file or URL). Ingested dynamically with full license approval. | `"C:/custom/my_beat.mp3"` |
| `songPolicy` | `string` | Global music policy: `"auto"` (default), `"manual"` (strict match), or `"disabled"`. | `"disabled"` (dialogue-only, no music bed) |
| `songGainDb` | `float` | Sets background music mix level in decibels. Default: `-18.0 dB`. | `-22.0` |
| `songCrossfadeMs` | `int` | Transition crossfade duration when chaining tracks. Clamped 250ms–3000ms. Default: `900 ms`. | `1200` |

### Individual Selection Resolution Flow

When the individual provides selection parameters:
1. **Custom Source Check**: If `songSource` / `songPath` is provided, the engine probes its duration via `ffprobe` and ingests it as an approved `category: "custom"` track.
2. **Exact Track ID**: If `songTrackId` matches a catalog track, it is immediately assigned top priority.
3. **Title Search**: If `songTitle` matches a track title or alias, that track is locked in.
4. **Artist Search**: If `songArtist` matches, the engine filters to that artist's repertoire.
5. **Category / Mood / Intensity Filter**: If semantic filters are supplied without an exact track, the engine filters the catalog to matching tracks and picks the best among them using autonomous tie-breaking.
6. **Audit Evidence**: The resulting event is stamped with `"resolution": "individual_selection"` and records the exact user prompt or filter criteria.

---

## 2. How the System Selects Songs (Autonomous Engine)

When the individual chooses not to specify an exact track (or sets `songPolicy: "auto"`), the system selects the optimal song using a **Multi-Factor Synergy Matrix** that analyzes video visuals, transcript semantics, and vocal pacing.

### The Autonomous Multi-Factor Scoring Matrix

$$\text{Total Score} = \text{Score}_{\text{semantic}} + \text{Score}_{\text{look}} + \text{Score}_{\text{pacing}} + \text{Score}_{\text{prompt\_domain}}$$

#### Factor 1: Transcript Semantics & Sentiment
- Non-stopword tokens from all dialogue chunks are compared against track metadata (`title`, `category`, `genreTags`, `moodTags`, `useCaseTags`).
- Overlapping tags award **+0.35** per token.
- Avoidance keywords (`avoidWhen`) penalize **-0.50** per collision.
- Tracks tagged `speech-friendly` or `underscore` receive an automatic **+0.20** bonus to protect vocal clarity.

#### Factor 2: Visual Look & Color Grade Affinity
Mini-runs apply one of 10 canonical cinematic looks via `mini_run_pipeline/looks.py`. The music engine detects the active look and awards **+0.35** synergy bonus plus **+0.15** intensity bonus:

| Cinematic Look | Synergistic Music Categories / Tags | Preferred Intensity |
| :--- | :--- | :--- |
| `teal_and_orange_blockbuster` | Cinematic, Trailer, Epic, Intense, Action | `hard` |
| `neon_tokyo_cyberpunk` | Tech, Futuristic AI, Synth, Cyberpunk, Trap, Phonk | `hard` |
| `bleach_bypass` | Intense, Dark Trap, Tension, Gritty | `hard` |
| `moody_dramatic_cinema` | Cinematic, Dramatic, Suspense, Dark Underscore | `medium` |
| `golden_hour_commercial` | Motivational, Uplift, Pop Indie, Lifestyle, Triumph | `medium` |
| `sci_netone_balanced` | Tech, AI Workflow, Modern Underscore | `medium` |
| `faded_black_and_white` | Classical, Passacaglia, Piano, Minimal, Reflective | `soft` |
| `vintage_warm_film` | Lo-Fi, Chill, Soft Focus, Acoustic, Calm | `soft` |
| `cold_nordic_minimal` | Ambient, Lo-Fi, Minimal, Calm Focus | `soft` |
| `emerald_prestige` | Classical, Orchestral, Prestige, Violin, Baroque | `soft` |

#### Factor 3: Speech Cadence Pacing (Words Per Second - WPS)
The system calculates the speaker's vocal delivery speed:
$$\text{WPS} = \frac{\text{Total Words}}{\text{Total Speech Duration (seconds)}}$$
- **Fast / Rapid Delivery ($\text{WPS} > 2.8$)**: The speaker is delivering punchy, energetic information $\rightarrow$ awards **+0.30** to `hard` intensity tracks (trap, urban beats, phonk).
- **Conversational Delivery ($2.0 \le \text{WPS} \le 2.8$)**: Standard speaking cadence $\rightarrow$ awards **+0.20** to `medium` intensity tracks (motivational, pop, modern tech).
- **Measured / Storytelling Delivery ($\text{WPS} < 2.0$)**: Deliberate pauses and reflective pace $\rightarrow$ awards **+0.30** to `soft` intensity tracks (lo-fi chill, classical piano).

#### Factor 4: User Prompt Intent & Contextual Domain Alignment
A dedicated **Audio Intent & Domain Classification Engine** (`extract_audio_intent_from_prompt`) analyzes both the user's natural language prompt (passed via `payload["prompt"]`, `payload["userPrompt"]`, or `payload["audio"]["prompt"]`) and the narrative transcript to prevent context mismatch:

1. **Domain Lexicons**:
   - **Business & Executive Call** (`business`, `ceo`, `conference`, `vision`, `revenue`, `corporate`, `strategy`):
     Favors intentional, sober executive beds (`Executive Board Bed`, `Triumph`, `The Way`). Awards **+0.60** domain bonus.
   - **Intentional & Deliberate Storytelling** (`intentional`, `deliberate`, `measured`, `thoughtful`, `discipline`, `conviction`):
     Favors minimal, calm underscore and reflective solo piano (`Quiet Desk Piano`, `Passacaglia`). Awards **+0.60** domain bonus.
   - **Documentary & Narrative Arc** (`documentary`, `story`, `memoir`, `history`, `journey`):
     Awards **+0.40** to emotive and classical underscore (`Documentary Emotive`).
   - **Tech & AI Innovation** (`ai`, `software`, `code`, `futuristic`):
     Awards **+0.40** to tech pulses and synthetic arpeggios (`Data Centre Pulse`).
   - **Athletic & Workout Motivation** (`gym`, `bodybuilding`, `workout`):
     Awards **+0.40** to rhythmic urban beats and trap.

2. **Anti-Context Clashing Invariant**:
   - In serious business keynote or deliberate storytelling contexts, casual party/club pop tracks (e.g. tracks from casual pop libraries or containing party tags) receive a strict **-0.70 context clash penalty**.
   - Solves the Patrick Bet-David dilemma: an autobiographical story reflecting on past party days is correctly recognized as an **intentional business keynote**, completely rejecting party songs in favor of deliberate, focused executive underscore.

3. **Explicit User Prompt Overrides**:
   - Prompts requesting specific genres (`"use lofi"`, `"classical piano"`), moods (`"deliberate"`, `"calm"`), or titles (`"play Executive Board Bed"`) directly steer scoring or lock in individual selection.

### Dialogue Sidechain Ducking

To ensure spoken words are never masked by the music bed, the system dynamically generates FFmpeg sidechain compression parameters based on the track's intensity:

- **Hard Intensity Tracks (Trap / Phonk / Beats)**:
  `threshold: 0.015`, `ratio: 10.0`, `attack: 15ms`, `release: 300ms` (deeper, snappier ducking so dialogue slices through heavy sub-bass).
- **Medium Intensity Tracks (Pop / Motivational)**:
  `threshold: 0.020`, `ratio: 8.0`, `attack: 20ms`, `release: 350ms`.
- **Soft Intensity Tracks (Lo-Fi / Classical Piano)**:
  `threshold: 0.030`, `ratio: 5.0`, `attack: 25ms`, `release: 400ms` (gentle, transparent ducking).

### Runway Management & Seamless Multi-Track Chaining

When the mini-run duration exceeds the runway of a single track (or if a short 25-second cue is selected for a 60-second video):
1. The engine calculates remaining timeline duration.
2. It scores candidate handoff tracks using `_compatibility(previous_track, candidate_track)` (Jaccard token similarity).
3. It inserts an `acrossfade` transition at `startMs = previous.endMs - crossfadeMs`.
4. The transition is logged with cause: `{"gate": "song_runway_exhausted"}`.

---

## 3. What Songs It Selects On In General (Comprehensive 269-Track Catalog)

The system draws from a verified **269-track catalog** spanning 26 genres/categories, 3 intensity tiers, and all library sources across Cloudflare R2, local audio files, and seed catalogs.

### Library Origin Breakdown

| Source Component | Tracks | Formats | Storage Provider & Local Path |
| :--- | :---: | :--- | :--- |
| **Cloudflare R2 & Downloader Catalog** | 149 | MP3, WEBM | `music-originals/<category>/<track>.mp3` in R2 / `YOUTUBE MUSIC DOWNLOADER -THRAGG/downloads` |
| **Downloader Category Libraries** | 73 | MP3 | Category subdirectories: `Other`, `Cinematic Trailer - Epic`, `Classical`, `Tech - Futuristic - Ai`, etc. |
| **Extended Library (`PROMETHEUS_SONGS`)** | 22 | MP3 | `PROMETHEUS_SONGS/*.mp3` (Trap, phonk, drill, slowed beats) |
| **Core Remotion Bundle** | 10 | MP3 | `remotion-app/public/audio/music` & `music.local.json` |
| **Landscape Runs Library** | 6 | MP3 | `docs/mini_landscape_runs/music/*.mp3` |
| **Semantic Seed Specifications** | 9 | Fingerprints | Defined in `docs/mini_landscape_runs/landscape_song_catalog.ts` |
| **Total Fully Expressed Library** | **269** | — | **259 with verified local files on disk; 100% with valid Cloudflare R2 keys** |

---

## 4. How the Pipeline Works: Expression, Iteration, & Anti-Clogging Architecture

### Why 200+ Songs in the Catalog, But 1 Song on the Timeline?

A critical engineering question is: **Why does the library have 200+ songs, while the render pipeline outputs 1 song?**

If a pipeline attempts to ingest hundreds of high-bitrate audio files directly into a single frontend model instance, relational database session, or Remotion React Three Fiber composition, **the instance will clog, run out of memory, or crash the Chromium headless browser process**.

To prevent clogging while preserving total artistic range, the Prometheus Mini-Run pipeline operates across **4 distinct, decoupled tiers**:

```
[ Tier 1: 269-Track Catalog Index ]
       │  (Lightweight metadata records in memory; <100 KB total)
       ▼
[ Tier 2: Iterative / Paginated Querying ]
       │  (iter_selectable_songs generator & ?page=1&pageSize=50)
       ▼
[ Tier 3: Autonomous Multi-Factor Scoring ]
       │  (Evaluates transcript semantics, visual look, & vocal WPS)
       ▼
[ Tier 4: Single-Track Timeline Materialization ]
       │  (Materializes ONLY the 1 selected track; Remotion receives 1 audio bed)
       ▼
[ Final Video Output (Single Seamless Bed + Ducking) ]
```

1. **Tier 1: Global Catalog Index (Complete Expression)**
   - All 269 songs are cataloged with lightweight metadata (`id`, `title`, `artist`, `category`, `genreTags`, `moodTags`, `intensity`, `durationSec`, `audioObjectKey`, `localPath`).
   - The entire catalog metadata footprint is under **100 KB**, meaning it can reside in memory without any performance penalty.

2. **Tier 2: Iteration & Pagination (Anti-Clogging Gateway)**
   - In Python: `iter_selectable_songs(...)` provides a lazy generator that yields tracks one-by-one without duplicating memory.
   - In HTTP API: `/api/pipeline/music/catalog?page=1&pageSize=20` slices the results so client UIs, relational models, or microservices query clean batches rather than ingesting 200+ records at once.

3. **Tier 3: Autonomous Scoring Matrix**
   - The planning engine (`plan_song_program`) evaluates the full 269-track corpus against:
     - Spoken transcript keywords
     - Active visual look (e.g. `neon_tokyo_cyberpunk`, `teal_and_orange_blockbuster`, `vintage_warm_film`)
     - Speaker speech cadence (Words Per Second - WPS)
   - Out of 269 candidates, it ranks and selects **the single best song** for the video.

4. **Tier 4: Single-Track Materialization (Zero Render Clog)**
   - `materialize_song_program()` only copies or downloads the **1 chosen track** into the video build directory (`output_root / "songs"`).
   - If the video duration exceeds the track's runway (e.g. a 60s video with a 25s track), it materializes **2 tracks** with a smooth crossfade.
   - The Remotion composition and Chromium headless renderer receive only the single active audio asset. **Chromium and WebAudio never decode more than the active timeline tracks**, ensuring instant rendering and zero memory leaks.

---

## 5. Gateway REST API Endpoints

The Mini-Run Gateway (`mini_run_gateway.py`) exposes queryable, paginated endpoints to list and search selectable songs.

### 1. `GET /api/pipeline/music/catalog` (or `/api/pipeline/songs`)

Returns the full catalog or a filtered, paginated subset.

#### Query Parameters:
- `category` (optional): Filter by category (e.g. `lo-fi`, `trap`, `classical`, `cinematic-trailer-epic`).
- `mood` (optional): Filter by mood (e.g. `chill`, `epic`, `intense`, `calm`).
- `intensity` (optional): Filter by intensity (`soft`, `medium`, `hard`).
- `search` / `q` (optional): Substring search across titles, artists, categories, and tags.
- `page` (optional): Page number (1-indexed).
- `pageSize` / `limit` (optional): Items per page (e.g. `10`, `20`, `50`).

#### Example Request:
```bash
curl -s "http://127.0.0.1:8080/api/pipeline/music/catalog?page=1&pageSize=10"
```

#### Example Response:
```json
{
  "ok": true,
  "total": 269,
  "filtered": 269,
  "count": 10,
  "page": 1,
  "pageSize": 10,
  "totalPages": 27,
  "categories": [
    "cinematic-trailer-epic",
    "classical",
    "classical-orchestral-prestige",
    "core-preview",
    "hip-hop-trap-urban-energy",
    "landscape",
    "lo-fi-chill-soft-focus",
    "motivational-uplift",
    "other",
    "pop-indie-lifestyle",
    "tech-futuristic-ai",
    "trap"
  ],
  "moods": ["ambient", "calm", "chill", "dark", "dramatic", "epic", "focus", "intense", "motivational", "soft", "triumph", "warm"],
  "intensities": ["soft", "medium", "hard"],
  "songs": [
    {
      "id": "cinematic-trailer-epic/amelie-adventures-relaxing-piano-by-james-malikey",
      "title": "Amélie Adventures - Relaxing Piano (by James Malikey)",
      "artist": "James Malikey",
      "category": "cinematic-trailer-epic",
      "genreTags": ["epic", "cinematic", "trailer", "piano", "relaxing"],
      "moodTags": ["epic", "soft"],
      "useCaseTags": ["speech-friendly", "podcast", "storytelling", "underscore"],
      "intensity": "soft",
      "durationSec": 60.0,
      "renderAllowed": true,
      "commercialAllowed": true,
      "licenseVerified": true,
      "licenseType": "sanctioned_private_music_originals",
      "audioObjectKey": "music-originals/cinematic-trailer-epic/amelie-adventures-relaxing-piano-by-james-malikey.mp3",
      "localPath": "C:/Users/HomePC/Downloads/PROMETHEUS-VINCERE-BACKEND/YOUTUBE MUSIC DOWNLOADER -THRAGG/downloads/Other/Amélie Adventures - Relaxing Piano (by James Malikey).mp3"
    }
  ]
}
```

---

## 6. Python API Reference

```python
from mini_run_pipeline import song_program

# 1. Load full catalog (discovers all 269 tracks across R2 and local libraries)
catalog = song_program.load_song_catalog()

# 2. Iterate lazily (memory-safe streaming without holding copies)
for song in song_program.iter_selectable_songs(catalog, category="trap"):
    print(song["id"], song["title"])

# 3. Paginated query (e.g. page 1, 20 items per page)
first_20 = song_program.list_selectable_songs(catalog, page=1, page_size=20)

# 4. Search by artist or title
vivaldi_tracks = song_program.search_songs("Vivaldi", catalog)

# 5. Plan a song program (with individual selection or autonomous scoring)
plan = song_program.plan_song_program(
    catalog=catalog,
    chunks=transcribed_chunks,
    duration_ms=30000,
    design={
        "lookId": "neon_tokyo_cyberpunk", # Guides autonomous scoring
        "songGenre": "lo-fi",              # Individual constraint
        "songGainDb": -20.0,               # Mix level
    }
)

# 6. Materialize audio files for rendering (materializes ONLY the selected song)
materialized = song_program.materialize_song_program(
    plan,
    storage=r2_client,
    cache_dir="/tmp/mini_run_build/songs"
)
```
