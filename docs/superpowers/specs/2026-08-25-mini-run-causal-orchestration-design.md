# Mini-Run Causal Orchestration Design

## Goal

Make the Mini Runs Modal pipeline bake a song-first audio programme and a coordinated visual treatment into the final MP4 while preserving the existing generative typography and Martin subject-layering behavior.

## Boundaries

- Scope is limited to `prometheus-mini-run-studio` and the Mini Runs render path.
- Landscape behavior and deployment remain unchanged.
- Existing typography, tall-font selection, subject placement, and Martin contracts are consumers of the new plan, not rewritten by it.
- Selection must be corpus-driven and entropy-backed. Literal transcript phrases may not select treatments.
- Every rendered effect must retain a causal reference to the scene, semantic boundary, or visual event that requested it.

## Architecture

The pipeline produces one `orchestrationManifest` after transcript chunking and typography selection. It has independent `scenes`, `transitions`, `cameraMoves`, `backgrounds`, `pip`, `songs`, and `sfx` collections. Each collection can be validated and rendered independently; cross-system relationships are expressed with IDs such as `causedBySceneId` and `causedByTransitionId`.

The scene planner uses timing, pacing, salience, source aspect ratio, subject observations, and recent-treatment usage. It may select portrait pan-and-scan or, for landscape sources, a full-frame floating PiP over blurred wings. It never invents B-roll. Split-screen is eligible only when a secondary asset is supplied.

The song planner loads the approved Cloudflare R2 music catalog from `MUSIC_R2_CATALOG_PATH`, an HTTP catalog URL, or an R2 object key. Only render-approved tracks are eligible. It scores catalog metadata against transcript-derived semantic and energy descriptors. A single song covers a short run when it has sufficient runway. A compatible successor is selected only when the first song cannot cover the requested duration or a supplied edit window explicitly requests a handoff.

The renderer downloads selected R2 objects into the job directory, renders visual motion in Remotion, and uses FFmpeg to mix dialogue with the song programme. Music receives a conservative base level plus dialogue-driven sidechain ducking; the completed mix is limited and normalized. SFX are secondary and may only be emitted by concrete transition or peak-velocity events.

## Motion Contract

- Pan-and-scan uses cubic Bezier S-curves and subject-safe focal positions.
- Floating PiP uses blurred, darkened wings; a 16:9 card; bounded overshoot; slow micro-drift; and inverse background counter-motion.
- Transitions occur only at scene-mode or background changes and observe a minimum-gap budget.
- Camera zooms are nominated by transition or high-salience scene events. They are not independently sprinkled onto the timeline.
- SFX transients align to the nominated motion peak, never simply to effect start time.

## Failure Behavior

- An explicit song request fails when its track is missing or not render-approved.
- Automatic song selection reports a blocked audio plan when no approved Cloudflare catalog track is available; it does not silently pretend the source audio contains a song programme.
- Visual planning degrades to subject-aware pan-and-scan when PiP requirements are unavailable.
- The final receipt distinguishes planned, materialized, and baked events.

## Verification

- Unit tests prove catalog filtering, semantic scoring, runway-based handoffs, causal scene relationships, and non-overlapping scene timing.
- Renderer tests prove the Remotion props retain causal IDs and the FFmpeg graph contains dialogue ducking, song inputs, and final normalization.
- The deployed proof replaces `mini_run_30s_master.mp4` atomically and is checked with `ffprobe`, audio decoding, and representative frame inspection.
