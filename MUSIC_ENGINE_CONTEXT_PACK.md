# MUSIC_ENGINE_CONTEXT_PACK

## 1. Current Branch And Repo Status
- **Current branch:** `music`
- **Working tree:** Dirty (modified `package.json`, `README.md`, `SvgCaptionOverlay.tsx`, `CreativeAudioPreview.tsx`, and several other files. Untracked file: `fonts-check.ts`).
- **Is this actually the music branch:** Yes.
- **Is it safe to continue:** Yes, we are not editing existing code, just proposing an architecture and adding a context pack.

## 2. Current Repo Architecture Summary
- **Framework:** The backend is a Fastify application written in TypeScript. The frontend and rendering pipeline use Remotion (React + Vite).
- **Backend style:** Modular, domain-driven (`src/sound-engine`, `src/edit-sessions`). It relies heavily on `zod` for schemas.
- **Database/Storage system:** It currently uses a `FileJobRepository` for local, file-based persistent state (saving JSONs to `jobs/<jobId>/` such as `edit-plan.json`). It integrates with AWS S3 / Cloudflare R2 for storage, and Milvus for vector search.
- **Workers:** Handled in-process via a custom `InProcessQueue` (`queue.ts`). There are also scripts like `local-preview-runner.ts` that orchestrate background generation.
- **API routes:** Handled in `backend/src/upload-routes.ts` and `server.ts`.
- **Render/Export pipeline:** A robust FFmpeg pipeline exists under `backend/src/sound-engine/` (with `filtergraph.ts` and `ffmpeg.ts`). Remotion then handles the final MP4 visual rendering (`remotion-app/scripts/master-render-longform.ts`).

## 3. Current Song Download / Asset Ingestion Flow
- **Where it lives:** `remotion-app/scripts/music-sync.ts` (and a similar `sound-fx-sync.ts`).
- **What files it touches:** Reads raw audio from a local path (`MUSIC_LIBRARY_PATH`), probes the duration using `ffprobe`, copies the files to `remotion-app/public/audio/music`, and generates a manifest file at `remotion-app/src/data/music.local.json`.
- **Storage:** Audio files are stored locally in the `public` directory. The metadata manifest is just a static JSON file.
- **Metadata currently existing:** ID (slug), label, duration, naive tags extracted from the filename (e.g., `slow`, `trap`, `uplift`), and a naive `intensity` rating based on those tags.
- **Metadata missing:** Exact BPM, musical key, energy/valence/arousal curves, precise beat grids, section roles, and license/commercial tracking.
- **Can this become the TrackIndexer input:** Yes. The output of `music-sync.ts` (or the folder it parses) is the perfect raw input for the new `TrackIndexer`.

## 4. Current Upload / Preview / Render / Export Flow
1. **Upload:** `/api/upload-url` provisions an R2 bucket URL. `/api/process` receives the upload and creates an `EditSession`.
2. **Analysis & Planning:** `backend/src/pipeline.ts` analyzes the source media, queries AssemblyAI for transcription, and uses LLM (via Groq) to synthesize a `MetadataProfile` and an `EditPlan`.
3. **Sound Mixing:** `backend/src/sound-engine/render.ts` parses a `SoundDesignManifest`, creates an FFmpeg `filtergraph`, and outputs a master audio track and/or stems.
4. **Final Render:** Remotion (`master-render-longform.ts`) muxes the final visual composition with the master audio track to export the `.mp4`.

## 5. Best Integration Points For Music Engine
- **Track Ingestion:** Replace or extend `music-sync.ts` to call a new `TrackIndexer` module.
- **Track Analysis:** Create an asynchronous `analyze-track-job.ts` that calls a Python script to populate the missing musical metadata.
- **Audio Plan Creation:** Hook into `pipeline.ts` right after `synthesizeMetadataProfile` and transcript resolution. Add an `ArrangementPlanner` step that produces an `audio_render_plan`.
- **Rendering:** Integrate deeply with `backend/src/sound-engine/render.ts`. We don't need a new Python rendering worker; we can emit a `SoundDesignManifest` that the existing FFmpeg `filtergraph` can execute, which already handles ducking and stems.

## 6. Recommended Backend Folder Structure
```
backend/src/music/
  analyzer/
    track-analyzer.ts         # Orchestrates Python CLI for audio analysis
  indexer/
    track-indexer.ts          # Wraps ingestion and catalog building
    license-guard.ts
  planner/
    emotional-timeline-builder.ts
    music-ranker.ts
    arrangement-planner.ts
    transition-planner.ts
    sfx-cue-planner.ts
  renderer/
    mix-renderer.ts           # Adapts AudioPlan into SoundDesignManifest for sound-engine
  schemas/
    music-track.schema.ts
    audio-plan.schema.ts
```

## 7. TypeScript vs Python Boundary
- **TypeScript:** Handles API routes, database/file-store access, schema validation, ranking algorithms, deterministic timeline mapping, arrangement logic, and FFmpeg filtergraph orchestration.
- **Python:** Handles ONLY the heavy audio processing (Librosa, Essentia, pyrubberband). Should be built as a CLI script (e.g., `python scripts/analyze_audio.py <path>`) that outputs JSON back to stdout, which the TypeScript `TrackAnalyzer` consumes.
- **FFmpeg:** Handled by TypeScript using the existing robust `sound-engine` system. Python should not directly render the final mix unless complex pitch-shifting (Rubber Band) cannot be done efficiently via FFmpeg.

## 8. Proposed Module Interfaces
- `TrackAnalyzer.analyze(path: string): Promise<AnalysisResult>` (Executes Python CLI, returns BPM, Grid, Energy)
- `TrackIndexer.index(inputPath: string): Promise<CanonicalTrack>` (Normalizes metadata, triggers analysis)
- `MusicRanker.rank(timeline: EmotionalTimeline, catalog: CanonicalTrack[]): RankedTrack[]` (Scores matches)
- `EmotionalTimelineBuilder.build(transcript: TranscribedWord[], metadata: MetadataProfile): EmotionalTimeline`
- `BeatGridBuilder.build(bpm: number, firstDownbeat: number): BeatGrid`
- `SectionDetector.detect(audioPath: string): Promise<Section[]>`
- `ArrangementPlanner.plan(timeline: EmotionalTimeline, tracks: RankedTrack[]): ArrangementPlan`
- `TransitionPlanner.plan(arrangement: ArrangementPlan): TransitionEvents[]`
- `SFXCuePlanner.plan(transcript: TranscribedWord[], timeline: EmotionalTimeline): SfxEvents[]`
- `MixRenderer.render(plan: AudioPlan): Promise<string>` (Converts AudioPlan to SoundDesignManifest, runs FFmpeg)
- `LicenseGuard.verify(trackId: string): boolean`
- `PreferenceLearner.update(userId: string, feedback: UserFeedback): void`

## 9. Database Schema Proposal
Since the system currently uses JSON file persistence (`FileJobRepository`), we should align with that for MVP, creating local JSON catalogs. If/when moving to Postgres/Supabase, the tables would be:

- `music_tracks`: id (PK), title, artist, source_path, license_type, duration_sec, bpm, key, energy, valence, tags (jsonb), beat_grid (jsonb), sections (jsonb).
- `sfx_assets`: id (PK), label, tags (jsonb), path, intensity.
- `audio_plans`: id (PK), project_id, plan_data (jsonb), status, created_at.

## 10. Canonical Music Track Schema
```typescript
const musicTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string().optional(),
  source: z.string(),
  source_url: z.string().optional(),
  storage_path: z.string(),
  license_type: z.string(),
  commercial_allowed: z.boolean(),
  duration_sec: z.number(),
  bpm: z.number().optional(),
  musical_key: z.string().optional(),
  energy: z.number().min(0).max(1).optional(),
  valence: z.number().min(0).max(1).optional(),
  genre_tags: z.array(z.string()),
  mood_tags: z.array(z.string()),
  use_case_tags: z.array(z.string()),
  avoid_when: z.array(z.string()),
  beat_grid: z.object({
    bpm: z.number(),
    beat_times: z.array(z.number()),
    downbeat_times: z.array(z.number())
  }).optional(),
  sections: z.array(z.object({
    start_sec: z.number(),
    end_sec: z.number(),
    role: z.string(),
    energy: z.number()
  })).optional(),
  analysis_status: z.enum(["pending", "analyzed", "failed"])
});
```

## 11. Audio Plan JSON Schema
```typescript
const audioPlanSchema = z.object({
  project_id: z.string(),
  user_id: z.string().optional(),
  source_video_id: z.string().optional(),
  video_duration_sec: z.number(),
  creative_direction: z.record(z.string(), z.unknown()),
  emotional_timeline: z.array(z.object({
     start_sec: z.number(), end_sec: z.number(), role: z.string(), energy: z.number()
  })),
  selected_tracks: z.array(musicTrackSchema),
  selected_sections: z.array(z.object({
     track_id: z.string(), start_sec: z.number(), end_sec: z.number(), usage_role: z.string()
  })),
  transition_events: z.array(z.any()),
  sfx_events: z.array(z.any()),
  ducking_settings: z.object({
     threshold_db: z.number(), ratio: z.number(), attack_ms: z.number(), release_ms: z.number()
  }),
  render_settings: z.record(z.string(), z.unknown()),
  output_audio_path: z.string().nullable(),
  status: z.enum(["planned", "rendering", "complete", "failed"])
});
```

## 12. Emotional Timeline Algorithm
```typescript
function buildEmotionalTimeline(words: TranscribedWord[], metadata: MetadataProfile) {
  // 1. Split transcript into sentences/paragraphs.
  // 2. Score each block using keyword lists (e.g. EMOTION_KEYWORDS, HOOK_PHRASES found in pipeline.ts).
  // 3. Detect roles:
  //    - Start block -> 'hook' (high energy).
  //    - Question block -> 'setup/problem' (tension).
  //    - Numbers/Data -> 'proof' (clarity).
  //    - End block -> 'CTA' (impact).
  // 4. Map back to video timestamps (start_ms, end_ms).
  // 5. Output array of segments.
}
```

## 13. Music Ranking Algorithm
```typescript
function rankTracks(timelineSegment, candidateTracks, preferences) {
   return candidateTracks.map(track => {
      let score = 0;
      score += calculateMatch(track.mood_tags, timelineSegment.mood) * 0.3;
      score += calculateMatch(track.energy, timelineSegment.energy) * 0.3;
      score += calculateTempoFit(track.bpm, timelineSegment.pace) * 0.15;
      score -= track.avoid_when.includes(timelineSegment.role) ? 1.0 : 0;
      // license safety check
      if (!track.commercial_allowed && timelineSegment.requires_commercial) return 0;
      return { track, score };
   }).sort((a, b) => b.score - a.score);
}
```

## 14. DJ Arrangement Planner
```typescript
function buildArrangementPlan(timeline, rankedTracks, durationSec) {
   // 1. If 15s preview: pick highest energy section of top ranked track.
   // 2. If 60s video: pick 2 tracks.
   // 3. Map Track A (Setup) to 0:00 -> 0:30.
   // 4. Map Track B (Reveal/CTA) to 0:30 -> 1:00.
   // 5. Align transition point to the nearest downbeat using `track.beat_grid.downbeat_times`.
   // 6. Inject a `crossfade` or `riser` at the transition boundary.
   // 7. Ensure dialogue ducking is planned across the timeline.
}
```

## 15. SFX Cue Planner
```typescript
function planSfxCues(transcriptWords, timeline) {
  // 1. Iterate through transcript words.
  // 2. Match semantic cues:
  //    - "time", "seconds" -> add { type: 'tick', time_sec: word.start_sec }
  //    - "profit", "money" -> add { type: 'cash', time_sec: word.start_sec }
  //    - "mistake", "wrong" -> add { type: 'low_hit', time_sec: word.start_sec }
  // 3. Check emotional timeline:
  //    - Transition boundary -> add { type: 'whoosh_sweep', time_sec: boundary }
  // 4. Return list of SfxEvents.
}
```

## 16. Rendering Strategy
**MVP Recommendation:** Node worker calling FFmpeg.
The repo already has a highly sophisticated `backend/src/sound-engine/filtergraph.ts` that handles inputs, ducking, volume curves, and stems.
The `MixRenderer` should simply convert the `AudioPlan` JSON into a `SoundDesignManifest` object, pass it to `buildSoundDesignPlan()`, and let `renderMasterTrack()` invoke FFmpeg. This avoids rebuilding the audio rendering wheel in Python.

## 17. Dependency Plan
- **Node:** None required for MVP. Existing `zod`, Fastify, and FFmpeg wrappers are sufficient.
- **Python:** `librosa`, `essentia`, `numpy` (for a standalone CLI script to run audio analysis).
- **System:** `ffmpeg` (already expected by the backend).

## 18. MVP Implementation Plan
1. Use the current `remotion-app/scripts/music-sync.ts` output as the initial raw data pool.
2. Create the TypeScript schemas (`music-track.schema.ts`, `audio-plan.schema.ts`).
3. Build the `TrackIndexer` logic to manage the `music.local.json` file securely.
4. Implement a deterministic `EmotionalTimelineBuilder` pulling logic from `pipeline.ts`.
5. Build the `MusicRanker` and a 15-second `ArrangementPlanner`.
6. Integrate with `sound-engine` by passing a dynamic `SoundDesignManifest` to `renderMasterTrack()`.

## 19. Implementation Phases
- **Phase 1:** Context pack & Documentation (This file)
- **Phase 2:** Schemas & Types (`backend/src/music/schemas/`)
- **Phase 3:** Music Catalog Ingestion (`indexer/`)
- **Phase 4:** Track Analyzer Prototype (Python script + `analyzer/track-analyzer.ts`)
- **Phase 5:** Emotional Timeline Builder & Ranker
- **Phase 6:** Arrangement Planner
- **Phase 7:** Sound Engine Mix Renderer Integration

## 20. Risks And Guardrails
- **Risk:** Python audio analysis is slow.
  - **Guardrail:** Run analysis out-of-band. Never run Librosa analysis synchronously during a user's web request.
- **Risk:** FFmpeg failing on complex multi-track ducking.
  - **Guardrail:** Limit MVP to 1 background track + 1 dialogue track + simple SFX before doing complex DJ-style crossfades.
- **Risk:** Overbuilding database tables.
  - **Guardrail:** Stick to `FileJobRepository` and static JSONs first to match current repo architecture.

## 21. Validation Commands
- `npm run typecheck` (in both `backend/` and `remotion-app/`)
- `npm run test`
- `npm run music:sync`
- Run local server `npm run dev` and trigger an upload.

## 22. Exact First Code Change To Recommend
Add the TypeScript schemas: `backend/src/music/schemas/music-track.schema.ts` and `audio-plan.schema.ts`. This safely defines the boundaries without touching existing runtime logic.

## Context To Hand Back To ChatGPT
- **Current Repo Structure:** TypeScript Fastify Backend (`backend/`) and Remotion React Frontend (`remotion-app/`). Uses `FileJobRepository` (local JSON persistence) instead of a traditional DB like Prisma/Postgres. Contains a highly advanced FFmpeg wrapper in `backend/src/sound-engine/`.
- **Current Song Download Flow:** `remotion-app/scripts/music-sync.ts` copies audio from a local folder, probes duration, and writes naive tags to `music.local.json`.
- **Exact Integration Points:**
  - Plumb `ArrangementPlanner` inside `backend/src/pipeline.ts`.
  - Pass the resulting plan to `backend/src/sound-engine/render.ts`.
- **Recommended Folder Structure:** `backend/src/music/` with subfolders for `analyzer`, `indexer`, `planner`, `renderer`, `schemas`.
- **TS/Python Boundary:** TypeScript handles orchestration, ranking, API, and FFmpeg filtergraph creation. Python (Librosa/Essentia) is isolated to an asynchronous CLI script strictly for audio analysis (BPM, Energy curves).
- **DB Tables Needed:** `music_tracks`, `audio_plans`, `sfx_assets` (but implemented as local JSON artifacts via `FileJobRepository` for MVP).
- **First Files To Create:** The TypeScript schemas in `backend/src/music/schemas/`.
- **MVP Build Order:** Schemas -> Track Indexer -> Python Analyzer Script -> Emotional Timeline -> Arrangement Planner -> FFmpeg Sound Engine Render.
- **Validation:** `npm run typecheck`, `npm run test`, `npm run music:sync`.
- **Major Warnings:** Do not build complex DB migrations yet; adhere to the existing `FileJobRepository` pattern. Do not rewrite FFmpeg rendering in Python; reuse `sound-engine/filtergraph.ts`.