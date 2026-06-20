# SKILL.md — Prometheus Core
# Project: Autonomous Cinematic Video Editing for Coaches
# Target Quality: Joseph-level video edits
# Architecture: Remotion (frame server) + Three.js/R3F (pixel engine)

## 1. TECHNOLOGY STACK (Frozen)
- **Frame Orchestrator:** Remotion (renderMedia, bundle, Composition)
- **Pixel Engine:** Three.js + React Three Fiber (@react-three/fiber, @react-three/drei)
- **Language:** TypeScript 5.x, Strict Mode, noUncheckedIndexedAccess: true
- **Package Manager:** npm with root workspaces
- **Test Runner:** Vitest 3.1.4
- **Build Tool:** Vite / Remotion CLI
- **Audio Pipeline:** FFmpeg (filter_complex, amix, loudnorm, adelay)
- **PRNG:** Park-Miller LCG (packages/shared-types/src/seeded-prng.ts)
- **Schema:** Zod (UnifiedRenderManifest v2.0)

## 2. PROJECT STRUCTURE
```
packages/shared-types/     # UnifiedRenderManifest + ParkMillerPRNG
backend/                   # Director (behavioral clone), Audio Mixing
remotion-app/              # Visual Composition (JosephEdit.tsx)
apps/worker/               # Export Pipeline (renderFromManifest)
scripts/                   # Integration tests (test-joseph.ts)
specs/                     # Design documents (do not modify)
```

## 3. DETERMINISM CONTRACT (ABSOLUTE)
Same manifest + same seed = pixel-identical output. Period.

### FORBIDDEN in render path:
- Math.random
- Date.now
- performance.now
- requestAnimationFrame
- setInterval
- setTimeout
- GSAP (allowed ONLY in preview/web-preview components, NEVER in render)

### REQUIRED:
- All animation is pure function of useCurrentFrame() + manifest.seed
- Use ParkMillerPRNG for any stochastic needs
- No external state, no side effects during render

## 4. BUILD DEPENDENCY DAG
```
Batch 1: Schema + PRNG (COMPLETE)
    ├──► Batch 2: Director (behavioral clone)
    ├──► Batch 3: Audio Mixing
    └──► Batch 4: Visual Composition
              ├──► Batch 5: Export Pipeline
              └──► Batch 6: Test Script (integration proof)
```

Parallel tracks: Batch 2, 3, 4 can build simultaneously.
Batch 5 needs 3 + 4 interface-stable.
Batch 6 needs everything.

## 5. CODING CONSTRAINTS
- No `any` without explicit @ts-ignore comment
- All functions must be testable (mock external deps)
- FFmpeg commands must use spawn/execFile, never shell string concatenation
- Cross-package imports must use workspace aliases (@prometheus/shared-types, @prometheus/backend)
- Relative path imports across workspace boundaries are FORBIDDEN
- All errors must be typed (ValidationError, RenderError, MuxError, AudioMixError, SFXNotFoundError)

## 6. CREATIVE VARIATION RULE
When user re-uploads same video, output MUST differ.
- Seed derivation: hashToSeed(videoHash) + uploadIndex * 7919
- Profile rotation: [aggressive, cinematic, minimal] via uploadIndex % 3
- Deterministic: same videoHash + uploadIndex always same output

## 7. AUDIO SPECIFICATIONS
- Music bed: -18 dB attenuation
- Final mix: -14 LUFS (I=-14, TP=-1, LRA=11)
- SFX directory: process.env.SFX_DIR
- 8 SFX cues: whoosh_fast, whoosh_slow, impact_deep, impact_sharp, riser_short, sub_drop, glitch_digital, pop_text
- SFX format: .mp3

## 8. VISUAL SPECIFICATIONS
- Camera moves: push_in, dutch, shake
- Text animations: pop, slide_up, glitch, typewriter, elastic_scale
- Zoom blur: radial shader on transitions (sin(progress * PI))
- Text: 3D mesh via @react-three/drei Text
- Video: VideoTexture synced to frame / fps

## 9. IRL ROADMAP (DO NOT IMPLEMENT YET)
Phase 1 (NOW): Rule-based behavioral clone
Phase 2: Seeing critic (frame capture + pixel validation)
Phase 3: Differentiable proxy renderer + inverse planning
Phase 4: GAIL discriminator + multi-agent IRL
Phase 5: Engagement predictor + online learning

**DO NOT build IRL/ML code until 100+ annotated Joseph videos exist.**

## 10. ENVIRONMENT
- OS: Windows PowerShell
- Path: C:/Users/HomePC/Downloads/HELP, VIDEO MATTING/
- Node: npm (not pnpm)
- TypeScript: strict, noUncheckedIndexedAccess

## 11. VERIFICATION PROTOCOL
Before declaring a batch COMPLETE:
1. `npm run build` in affected package passes
2. `npm test` passes with 0 failures
3. No TypeScript errors
4. No forbidden globals in render path
5. Determinism verified: same input → same output hash
