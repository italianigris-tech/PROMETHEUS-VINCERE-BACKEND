# MAUL Asset Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Repair MAUL's shared-type runtime release and make its 9:16 renderer execute approved B-roll, evidence, split-proof, and editorial-graphic intervals.

**Architecture:** Extend the existing V3 Visual Plan and Unified Render Manifest with a versioned project-scoped visual track. A deterministic selector converts approved asset records into non-overlapping intervals; the Manifest Compiler validates the selection; `MaulShort` renders each interval with Remotion `Video` or `Img` while captions and audio remain global layers.

**Tech Stack:** TypeScript, Zod, Vitest, Node package exports, Remotion 4, FFmpeg.

---

## Task 1: Restore Shared-Type Runtime Parity

**Files:** `packages/shared-types/src/maul.test.ts`, `packages/shared-types/src/index.ts`, generated `packages/shared-types/dist/*`, root `package.json`.

- [ ] Add a failing test importing `../dist/index.js` and asserting `maulResolvedFontAssetSchema.safeParse` exists.
- [ ] Run `npm.cmd --workspace @prometheus/shared-types test -- src/maul.test.ts`; expected failure because current `dist/index.js` omits the schema.
- [ ] Add root scripts that build shared types before MAUL tests/typechecks:

```json
{
  "test:maul": "npm --workspace @prometheus/shared-types run build && npm --workspace @prometheus/backend test -- src/maul src/__tests__/maul-short-render-path.test.ts",
  "typecheck:maul": "npm --workspace @prometheus/shared-types run build && npm --workspace @prometheus/backend run typecheck && npm --prefix remotion-app run typecheck"
}
```

- [ ] Run `npm.cmd --workspace @prometheus/shared-types run build`; rerun the runtime test and `npm.cmd --workspace @prometheus/backend test -- src/__tests__/maul-short-render-path.test.ts`; expected pass.
- [ ] Commit: `git add package.json packages/shared-types/src/index.ts packages/shared-types/src/maul.test.ts packages/shared-types/dist` then `git commit -m "fix(maul): rebuild shared runtime contracts"`.

## Task 2: Define and Select Governed Visual Assets

**Files:** `packages/shared-types/src/maul.ts`, `packages/shared-types/src/index.ts`, `packages/shared-types/src/maul.test.ts`, new `backend/src/maul/visual-track.ts`, new `backend/src/maul/visual-track.test.ts`.

- [ ] Write failing tests for licensed proof selection, no-asset speaker fallback, overlapping intervals, unverified rights, reference-corpus media, media-kind mismatch, and invalid crop.
- [ ] Run `npm.cmd --workspace @prometheus/backend test -- src/maul/visual-track.test.ts`; expected failure because the track contract is absent.
- [ ] Add schemas for:
  - asset: `assetId`, `mediaKind`, `storagePath`, `sha256`, verified rights, provenance, permitted roles, dimensions, optional duration;
  - interval: `intervalId`, mode (`speaker_hero`, `b_roll`, `evidence_image`, `split_proof`, `editorial_graphic`, `quiet_hold`), output range, optional `assetId`, purpose, normalized crop, transition;
  - track: declared assets plus ordered intervals.
- [ ] Require verified rights and project lineage for every non-source interval. Reject overlaps, reference media, incompatible media kinds, out-of-range intervals, and unsafe crops.
- [ ] Implement deterministic `buildMaulVisualTrack()` that selects matching approved assets by beat, respects treatment insert limits, fills gaps with `speaker_hero`, and never invents media.
- [ ] Rerun focused tests; expected pass. Commit `feat(maul): add governed visual asset track`.

## Task 3: Compile Track into V3 Manifest

**Files:** `backend/src/maul/planning.ts`, `backend/src/maul/service.ts`, `backend/src/__tests__/maul-short-render-path.test.ts`, shared schemas/tests.

- [ ] Add failing integration assertions that compiled V3 output contains `speaker_hero`, `evidence_image`, and `split_proof` intervals, and that an unverified asset blocks render creation.
- [ ] Run the integration test; expected failure because planning currently emits speaker-only visual scenes.
- [ ] Pass project-owned approved assets into planning; replace hard-coded speaker-only visual plan construction with `buildMaulVisualTrack()`; persist exact render-relative paths only after hash, rights, and lineage checks.
- [ ] Extend V3 manifest validation so every interval asset resolves to the declared pack and exact hash, and all intervals fit output duration.
- [ ] Run backend visual-track and render-path tests; expected pass. Commit `feat(maul): compile approved visual intervals`.

## Task 4: Render Visual Track in 9:16

**Files:** new `remotion-app/src/compositions/MaulVisualTrack.tsx`, new `remotion-app/src/compositions/__tests__/MaulVisualTrack.test.tsx`, `remotion-app/src/compositions/MaulShort.tsx`, its tests.

- [ ] Write failing tests asserting video B-roll renders a `<video>`, evidence renders `<img>`, split proof exposes fixed speaker/evidence regions, graphics render only manifest data, and quiet holds preserve timing.
- [ ] Run `npm.cmd --prefix remotion-app test -- src/compositions/__tests__/MaulVisualTrack.test.tsx`; expected failure because component is absent.
- [ ] Implement `Sequence`-timed interval rendering. Use Remotion `Video` for source/B-roll, `Img` for verified stills, fixed portrait-safe split geometry, and `useCurrentFrame()`/`interpolate()` for declared fades/reveals. No CSS animations or arbitrary URLs.
- [ ] Make `MaulShort` use `MaulVisualTrack` for planned V3 manifests while preserving legacy V1 behavior. Keep text, audio, camera, and safe zones outside the track.
- [ ] Run `npm.cmd --prefix remotion-app test -- --testTimeout=15000 src/compositions/__tests__/MaulVisualTrack.test.tsx src/compositions/__tests__/MaulShort.test.ts`; expected pass. Commit `feat(maul): render governed visual track`.

## Task 5: Prove Reference-Class Outputs

**Files:** new `scripts/verify-maul-asset-track.mjs`, proof receipt directory under `artifacts/maul-asset-track/`, `.gitignore`.

- [ ] Add a failing verifier requiring 1080x1920 H.264/AAC output and expected visual-mode receipts.
- [ ] Add source-owned fixtures for: `cursive-editorial`, `strong-text`, and `cinematic-asset-track` with speaker, approved B-roll, evidence image, split proof, and quiet hold.
- [ ] Render each through `MaulShort`, extract representative PNGs, run `ffprobe`, and write mode/timestamp receipts. Never use reference videos as export media.
- [ ] Run `npm.cmd run test:maul`, `npm.cmd run typecheck:maul`, `node scripts/verify-maul-asset-track.mjs`, and `git diff --check`; expected all pass.
- [ ] Commit `test(maul): prove governed 9:16 asset track`.

## Self-Review

This plan repairs the runtime gate first, makes the existing Visual Plan executable second, then adds the renderer and proofs. It reaches the reference classes through governed supplied assets and typography, while generated media remains a separate later provider pipeline.
