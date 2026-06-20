# MASTER PROMPT — Prometheus Core Build
# Goal: One-shot autonomous build of the entire cinematic video editing system
# End State: Running `npx tsx scripts/test-joseph.ts` generates 3 different creative edits from the same input video, all passing assertions.

## PHASE 0: AUDIT & BASELINE
Read SKILL.md. Read all existing code in the repo. Identify what exists vs what must be built.

## PHASE 1: PARALLEL FOUNDATION (All agents simultaneously)
Spawn 3 parallel agents:

### Agent A: Schema Completion
- File: packages/shared-types/src/unified-render-manifest.ts
- Add missing fields to UnifiedRenderManifestSchema: durationFrames, videoTracks, cameraMoves, textOverlays, transitions
- Ensure all sub-types are exported from index.ts
- Verify: npm run build passes

### Agent B: Cross-Package Wiring
- File: apps/worker/package.json
- Add "@prometheus/backend": "file:../../backend" to dependencies
- File: backend/package.json
- Add exports field or re-export mixAudio from index.ts
- File: apps/worker/src/index.ts
- Change import from relative path to @prometheus/backend
- Verify: tsc --noEmit passes in apps/worker

### Agent C: Director Test Fix + Variation
- File: backend/src/director/joseph-director.test.ts
- Split failing "white thesis words" test into low-energy (white) and high-energy (red #FF0040)
- Add variation tests for createManifest options parameter
- Verify: npm test in backend passes with 0 failures

## PHASE 2: PARALLEL BUILD (Agents A/B/C must be COMPLETE first)
Spawn 3 parallel agents:

### Agent D: Audio Mixing (Batch 3)
- File: backend/src/audio/mix-audio.ts
- Build FFmpeg filter_complex pipeline: voice + music(-18dB) + SFX(adelay)
- Mix with amix, loudnorm to -14 LUFS
- Tests: filter_complex generation, adelay offsets, SFX missing, FFmpeg failure, determinism
- Verify: npm test passes

### Agent E: Visual Composition (Batch 4)
- File: remotion-app/src/compositions/JosephEdit.tsx
- R3F Canvas with VideoPlane (VideoTexture synced to frame/fps), CameraRig (push_in/dutch/shake), KineticText (5 animations), ZoomBlurQuad (shader)
- File: remotion-app/src/Root.tsx
- Composition with calculateMetadata for dynamic duration
- Tests: dimensions, camera determinism, text count, forbidden globals check, zoom blur intensity
- Verify: npm test passes

### Agent F: Export Pipeline (Batch 5)
- File: apps/worker/src/index.ts
- renderFromManifest(manifest): validate with Zod, bundle Remotion, render silent video with gl:"angle", mix audio, FFmpeg mux to final MP4
- Tests: validation reject, render+mux success, Remotion failure, mux failure, cleanup
- Verify: npm test passes

## PHASE 3: INTEGRATION (All Phase 2 agents COMPLETE)
Spawn 1 agent:

### Agent G: Test Script (Batch 6)
- File: scripts/test-joseph.ts
- CLI: --video, --hash, --outDir
- Runs 3 edits (uploadIndex 0,1,2) from same video
- Asserts: file exists, different seeds, different profiles, pixel reproducibility
- Output: pass/fail summary table
- Verify: npx tsx scripts/test-joseph.ts exits 0

## GLOBAL RULES FOR ALL AGENTS
1. Read SKILL.md before writing any code
2. Respect the Determinism Contract
3. Use workspace imports (@prometheus/*), never relative paths across packages
4. TypeScript strict mode, no any
5. Mock external deps in tests (FFmpeg, Remotion, fs)
6. If a dependency is missing, install it via npm and update package.json
7. If a test fails, fix it. Do not skip tests.
8. After each file write, run the relevant build/test command. If it fails, diagnose and fix immediately.
9. Report COMPLETE only when all checks pass.

## SUCCESS CRITERIA
- [ ] packages/shared-types compiles clean
- [ ] backend tests pass (director + audio + variation)
- [ ] remotion-app tests pass (composition + root)
- [ ] apps/worker tests pass (export pipeline)
- [ ] scripts/test-joseph.ts runs end-to-end and generates 3 different MP4s
- [ ] All 3 MP4s have different SHA256 hashes
- [ ] Re-rendering same manifest produces identical SHA256 hash
