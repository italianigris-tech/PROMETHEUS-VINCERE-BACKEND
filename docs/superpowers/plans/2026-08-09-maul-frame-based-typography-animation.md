# MAUL Frame-Based Typography Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 53 inventoried typography animation sources resolve into validated, word-level, frame-based programs that survive the MAUL planner, Manifest Compiler, Remotion preview, and server render path.

**Architecture:** Add a renderer-neutral frame-motion contract to shared types and a deep compiler module in the backend. The compiler owns treatment lookup, timing, easing, frame conversion, and envelopes; Remotion evaluates only the compiled program. Preserve the current V1-V3 adapters while routing new animation programs through the additive contract.

**Tech Stack:** TypeScript, Zod, Vitest, Remotion, React server rendering, AssemblyAI batch transcription, existing MAUL planning artifacts and Manifest Compiler.

## Global Constraints

- `1080x1920` / `9:16` remains the production output contract.
- AssemblyAI or an explicitly persisted timed transcript is authoritative; prompt-generated words and local speech extraction are forbidden in the proof path.
- Remotion animation must be evaluated from `useCurrentFrame()` and `fps`; no wall-clock timers or browser GSAP execution.
- The Manifest Compiler remains the only planner-to-renderer translation seam.
- Existing V1-V3 compatibility adapters remain intact until parity tests pass.
- A profile-declared text color may not be overwritten by animation.

---

### Task 1: Add the shared frame-motion contract

**Files:**
- Create: `packages/shared-types/src/maul-frame-motion.ts`
- Modify: `packages/shared-types/src/index.ts`
- Modify: `packages/shared-types/src/maul-text-animation.ts`
- Test: `packages/shared-types/src/maul-frame-motion.test.ts`
- Test: `packages/shared-types/src/maul-text-animation.test.ts`

**Interfaces:**
- `maulFrameMotionTransformSchema` accepts bounded `opacity`, `translateXPx`, `translateYPx`, `scale`, `rotationDeg`, `blurPx`, `clipProgress`, and `trackingEm`.
- `maulFrameMotionPhaseSchema` accepts positive `startFrame`/`endFrame`, a linear or cubic-bezier easing, and bounded transforms.
- `maulFrameMotionProgramSchema` accepts `executorId`, `sourceTreatment`, `unit`, `tokenId`, `sourceIntervalMs`, three non-overlapping frame phases, and a declared envelope.
- `evaluateMaulFrameMotion(program, frame)` returns the interpolated renderer-neutral transform.

- [ ] **Step 1: Write failing contract tests** for valid frame programs, phase continuity, bounds, zero-length phases, and deterministic evaluation at 24/30/60 FPS.
- [ ] **Step 2: Run the focused tests** with `npm --workspace @prometheus/shared-types test -- src/maul-frame-motion.test.ts`; confirm failure because the module does not exist.
- [ ] **Step 3: Implement the schemas and pure evaluator** with no I/O and no renderer imports. Use the existing `Easing`-compatible cubic-bezier values and clamp progress at phase boundaries.
- [ ] **Step 4: Add optional `frameMotion` and `executorId` fields** to the existing MAUL animation program schema so old plans remain valid and new plans carry the authoritative program.
- [ ] **Step 5: Run the focused shared-types tests** and the existing `maul-text-animation.test.ts`; confirm both pass.

### Task 2: Build the deep frame-motion compiler and 53-source registry

**Files:**
- Create: `backend/src/maul/frame-motion-compiler.ts`
- Test: `backend/src/maul/frame-motion-compiler.test.ts`

**Interfaces:**
- `compileMaulWordMotion(input: CompileMaulWordMotionInput): MaulFrameMotionProgram` returns one validated program for one token.
- `getMaulMotionCapability(treatmentId: string): MaulMotionCapability | null` exposes executor ID, unit, and envelope metadata for diagnostics only.
- `MAUL_FRAME_MOTION_CAPABILITIES` contains all 53 IDs exactly once.

- [ ] **Step 1: Write failing tests** that enumerate the 53 IDs from the three existing registries and require a capability plus a valid compiled program for each.
- [ ] **Step 2: Run the focused backend test** with `npm --workspace @prometheus/backend test -- src/maul/frame-motion-compiler.test.ts`; confirm the missing compiler and registry failure.
- [ ] **Step 3: Implement the registry** as normalized descriptors. Keep separate executor IDs for `svg:*`, `joseph:*`, and `gsap:*`, but expose one frame-safe transform grammar to callers.
- [ ] **Step 4: Implement word timing** from the token interval. Allocate entry/hold/exit deterministically, reject intervals that cannot retain a positive hold, and convert milliseconds to frames with explicit rounding.
- [ ] **Step 5: Implement distinct descriptor families** for the 26 GSAP presets: character rise, blur lift, focus lock, paired split, arc sweep, stagger punch, serif orbit, script glide, column/lockup, banner drift, outline whip, and depth pair. The 12 SVG and 15 Joseph IDs must resolve to their named executor IDs rather than a generic fallback.
- [ ] **Step 6: Run the focused compiler tests** and confirm every source ID has lineage, positive phases, and a bounded envelope.

### Task 3: Make MAUL planning emit one authoritative program per word

**Files:**
- Modify: `backend/src/maul/planning.ts:334-505`
- Modify: `backend/src/maul/planning.test.ts:307-590`

**Interfaces:**
- `buildMaulTextAnimationPlanPayload` continues to accept existing planner inputs but emits one token-scoped program per token, each carrying `frameMotion`, `executorId`, and the source treatment.

- [ ] **Step 1: Add failing planner tests** for a three-word segment: expect three unique token programs, each with the exact token interval and no shared token target.
- [ ] **Step 2: Run the focused planner tests** and confirm the current single segment program fails the new assertions.
- [ ] **Step 3: Replace `positionLockedRevealFor` as the authoritative selector** with `compileMaulWordMotion`; retain `localReveal` only as an explicit legacy receipt for old manifests.
- [ ] **Step 4: Preserve sequence variation** by excluding the previous source treatment when selecting the next segment, while allowing each segment's words to share the selected preset descriptor.
- [ ] **Step 5: Parse the new plan through shared Zod schemas** and preserve parent artifact hashes and replay keys.
- [ ] **Step 6: Run all MAUL planning tests** and update only assertions that describe the intentionally changed one-program-per-word contract.

### Task 4: Carry programs through the Manifest Compiler and Remotion adapter

**Files:**
- Modify: `backend/src/maul/planning.ts:1954-2125`
- Modify: `remotion-app/src/compositions/maul-short-manifest-adapter.ts:350-725`
- Test: `backend/src/maul/planning.test.ts`
- Test: `remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx`

**Interfaces:**
- Compiled manifests carry `executorId`, `sourceTreatment`, `frameMotion`, and token IDs without renderer reinterpretation.
- `buildMaulPlannedTextRecords` attaches programs by token ID and rejects duplicate or missing program targets.

- [ ] **Step 1: Write failing seam tests** that compile a manifest and assert the selected treatment, executor ID, frame phases, and hashes survive unchanged.
- [ ] **Step 2: Run the seam tests** and confirm the current compiler drops the new fields or attaches only one segment program.
- [ ] **Step 3: Extend the Manifest Compiler receipt** and adapter validation to require a program for every planned token in new animation manifests.
- [ ] **Step 4: Keep legacy manifests on the explicit compatibility path** when `frameMotion` is absent.
- [ ] **Step 5: Run backend planning and Remotion adapter tests** together with the shared-types build.

### Task 5: Render frame programs for standard and profile typography

**Files:**
- Modify: `remotion-app/src/compositions/MaulPlannedTextLayer.tsx:473-565`
- Modify: `remotion-app/src/compositions/MaulProfileTypographyGroup.tsx:28-112`
- Test: `remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx`

**Interfaces:**
- Both renderers consume `MaulFrameMotionProgram` and call the shared evaluator with `outputFrame` and `fps`.
- Static profile color, font, casing, layer geometry, and placement remain unchanged by motion.

- [ ] **Step 1: Write failing renderer tests** for a profile layer at pre-entry, entry, hold, and exit frames; assert opacity/transform changes while the declared color remains unchanged.
- [ ] **Step 2: Run the focused Remotion tests** and confirm `MaulProfileTypographyGroup` currently ignores token programs.
- [ ] **Step 3: Add a token/layer program lookup** and apply frame transforms to the independently rendered token span or layer without changing its color.
- [ ] **Step 4: Preserve reserved geometry** for hidden token spans so word animation does not reflow neighboring words.
- [ ] **Step 5: Emit diagnostics attributes** for treatment ID, executor ID, token ID, frame phase, and fallback status.
- [ ] **Step 6: Run the full Remotion composition test file** and verify existing legacy animation tests remain green.

### Task 6: Add launch-safe 10-second transcript/render proof

**Files:**
- Create: `backend/src/maul/scripts/run-frame-animation-proof.ts`
- Create: `backend/src/maul/fixtures/frame-animation-proof-transcript.json`
- Modify: `backend/package.json`
- Test: `backend/src/maul/scripts/run-frame-animation-proof.test.ts`

**Interfaces:**
- `runFrameAnimationProof({mediaPath, transcriptPath?, outputDir, assemblyAiApiKey?})` persists a timed transcript, emits the compiled plan/manifest receipts, and invokes the canonical Remotion renderer.
- With `assemblyAiApiKey`, the production AssemblyAI adapter is used. Without it, the checked-in timed transcript is used and the output is marked `offline_fixture`, never `assemblyai`.

- [ ] **Step 1: Write failing script tests** for missing media, missing transcript/API key, persisted fixture use, and output receipt paths.
- [ ] **Step 2: Run the focused script tests** and confirm the proof runner is absent.
- [ ] **Step 3: Implement the proof runner** around `transcribeWithAssemblyAI` and the existing MAUL planning/Manifest Compiler functions; do not introduce local speech extraction.
- [ ] **Step 4: Add a 10-second fixture transcript** matching the checked-in 10-second source clip with at least three timestamped chunks and word intervals.
- [ ] **Step 5: Add the `maul:animation-proof` backend script** and make output paths explicit, reproducible, and outside the source tree's tracked assets.
- [ ] **Step 6: Run the offline proof**, then run the AssemblyAI proof when `ASSEMBLYAI_API_KEY` is present. Verify the MP4, manifest, transcript, and diagnostics sidecar exist and agree on token/program counts.

### Task 7: Verify the production render path

**Files:**
- Modify: `remotion-app/src/compositions/__tests__/MaulPlannedTextLayer.test.tsx`
- Modify: `remotion-app/src/compositions/__tests__/studio-root.test.ts`
- Create: `remotion-app/scripts/verify-maul-frame-animation-render.ts`

- [ ] **Step 1: Write the render-contract test** that bundles the Remotion entrypoint and renders the 9:16 proof manifest with no unresolved fonts, assets, treatment IDs, or executor IDs.
- [ ] **Step 2: Run the test against a fresh bundle** and confirm it fails before the renderer adapter is complete.
- [ ] **Step 3: Implement the verifier** using the same `staticFile`/asset resolver and render props as production, checking output dimensions, frame count, and diagnostic attributes.
- [ ] **Step 4: Run `npm run typecheck:maul`, the shared/backend/Remotion focused tests, and the offline proof.**
- [ ] **Step 5: Run the AssemblyAI-backed proof if credentials are available; report any external credential or render-host limitation without claiming launch readiness.**

