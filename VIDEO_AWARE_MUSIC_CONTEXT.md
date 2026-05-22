# VIDEO_AWARE_MUSIC_CONTEXT

## 1. Video Timeline Data Sources
Prometheus stores and computes video timeline data in several key places:

- **Video Duration:**
  - `JobRecord.source_summary.source_duration_ms` (stored in `job.json` via `FileJobRepository`).
  - `VideoMetadata.durationSeconds` (in `remotion-app/src/lib/types.ts`).
  - `SoundDesignManifest.duration` (in `backend/src/sound-engine/types.ts`).
  - Probed via `ffprobe` and stored in `video.metadata.json` or `source_media.source_duration_ms`.

- **Transcript Timestamps:**
  - **Word-level:** `TranscribedWord` schema in `backend/src/schemas.ts` and `remotion-app/src/lib/types.ts` has `start_ms` and `end_ms`.
  - **Resolution:** Word-level timestamps are provided by AssemblyAI and cached in `transcripts/<hash>.words.json`.

- **Caption Timing:**
  - `CaptionChunk` (in `remotion-app/src/lib/types.ts`) has `startMs` and `endMs`.
  - Computed from `TranscribedWord` via `mapWordChunksToCaptionChunks` in `remotion-app/src/lib/caption-chunker.ts`.

- **Project/Job Timing Data:**
  - `SelectedClip` has `export_start_ms`, `export_end_ms`, and `export_duration_ms`.
  - `Motion3DSceneSpec` and `MotionChoreographyScenePlan` have `startMs` and `endMs`.

## 2. Current Preview Playback Context
- **Video Player:** The frontend uses the Remotion `@remotion/player` in `remotion-app/src/web-preview/RemotionPreviewPlayer.tsx`.
- **currentTime Exposure:** `currentTimeMs` is derived in real-time within components (e.g., `CinematicCaptionOverlay.tsx`) using `(frame / fps) * 1000`.
- **Duration Knowledge:** The player receives `durationInFrames` and `fps` from the Remotion composition.
- **Interactivity:** Play/pause/seek are standard Remotion Player features.
- **Timestamp Feedback:** Currently, there is no explicit "timestamp feedback" endpoint, but `CreativeAudioLivePlayer.tsx` listens to an SSE stream (`/api/edit-sessions/:id/events`) for backend updates. Feedback would likely be sent via a new POST endpoint like `/api/edit-sessions/:id/feedback`.

## 3. Current Render Pipeline Timing Context
- **Object Entering Pipeline:** `SoundDesignManifest` enters the `sound-engine/render.ts` pipeline.
- **Data Insertion:**
  - Transcript/Caption data enters as `dialogue` spans in the manifest.
  - Audio plan data enters as `musicCues` and `sfx` (which are `MotionSoundCue` objects).
- **Output Storage:** Final paths are stored in `JobRecord.artifact_paths` (e.g., `audio_master`, `audio_preview_mix`).
- **Muxing:** The final video is rendered by `remotion-app/scripts/master-render-longform.ts`, which takes the audio artifact and muxes it with the Remotion visual output.

## 4. Audio Plan Must Be Video-Timecoded
The `SoundDesignManifest` is already timecoded in seconds. We should extend it to a more comprehensive `VideoAwareAudioPlan`:

```typescript
{
  "project_id": "...",
  "video_duration_sec": 120.0,
  "timeline_segments": [
    { "start_sec": 0, "end_sec": 3.5, "role": "hook", "energy": 0.9 },
    { "start_sec": 3.5, "end_sec": 15.0, "role": "problem", "energy": 0.6 }
  ],
  "music_events": [
    { 
      "track_id": "music-epic-intro",
      "start_sec": 0,
      "end_sec": 15.0,
      "fade_in_sec": 0.1,
      "fade_out_sec": 2.0,
      "ducking_enabled": true
    }
  ],
  "sfx_events": [
    { "type": "riser", "start_sec": 12.0, "end_sec": 15.0 },
    { "type": "impact", "start_sec": 15.0, "end_sec": 15.5 }
  ]
}
```

## 5. Emotional Timeline From Video Context
- **Logic:**
  1. Parse transcript words for keywords (`EMOTION_KEYWORDS`, `HOOK_PHRASES`).
  2. Identify high-energy segments (Hook, CTA) and low-energy segments (Problem, Explanation).
  3. Map these to the video timeline using word timestamps.
  4. Cross-reference with `ClipSelection` if we are rendering a 15s preview vs a long-form video.

## 6. Music Arrangement Must Follow Video Segments
- The `ArrangementPlanner` should treat the video timeline as the master.
- It should slice `music_tracks` into `selected_sections` that match the duration and role of video segments.
- It must align transitions to the nearest downbeat *relative to the video timeline*.

## 7. SFX Must Follow Transcript And Visual Events
- **Transcript cues:** Detect "seconds", "money", "danger" in transcript words and place SFX at `word.start_ms / 1000`.
- **Visual cues:** Place SFX at `captionChunk.startMs / 1000` or `transition.startMs / 1000`.

## 8. Backend Integration Point
- **Safest File:** `backend/src/pipeline.ts`.
- **Function:** Create a new step `planAudioDesign(jobId)` after `buildClipSelection` and `buildEditPlan`.
- **Persistence:** Use `repository.writeAudioRenderPlan(jobId, audioPlan)`.
- **Muxing:** The existing `master-render-longform.ts` already handles muxing the `audio_master` path.

## 9. Frontend Integration Point Later
- **Location:** `remotion-app/src/web-preview/CreativeAudioLivePlayer.tsx`.
- **Features:**
  - Add a "Critique Overlay" that sends `{ timestamp: currentTime, note: "..." }` to the backend.
  - Visualize the `audio_plan` as a secondary timeline under the video player.

## 10. Revised Video-Aware Architecture
```
backend/src/music/
  video-aware-planner/
    timeline-synthesizer.ts   # Merges transcript, captions, and creative direction
    arrangement-orchestrator.ts # Maps music sections to timeline segments
    sfx-event-generator.ts    # Detects semantic cues in transcript words
  schemas/
    video-timeline.schema.ts
    audio-plan.schema.ts
  renderer/
    manifest-adapter.ts       # Converts AudioPlan to SoundDesignManifest
```

## 11. Exact First Code Change Recommendation
Add the `video_timeline` and `audio_plan` schemas to `backend/src/schemas.ts` or a new `backend/src/music/schemas/` directory. This establishes the video-anchor for all subsequent music logic.

## Context To Hand Back To ChatGPT
- **Video Timeline Data:** Durations are in `JobRecord` and `SoundDesignManifest`. Timestamps are in `TranscribedWord` and `CaptionChunk` (all in ms or seconds).
- **Transcript/Caption Data:** Word-level timestamps are resolved via AssemblyAI and stored in `transcripts/` cache.
- **Render Integration:** `SoundDesignManifest` is the bridge between planning and FFmpeg rendering. Final muxing is in `master-render-longform.ts`.
- **Recommended Architecture:** A `video-aware-planner` that consumes the `MetadataProfile` and transcript to produce a timecoded `AudioPlan`.
- **First Files:** `backend/src/music/schemas/audio-plan.schema.ts`.
- **Validation:** Verify `audio_render_plan` artifact existence in `FileJobRepository`.
