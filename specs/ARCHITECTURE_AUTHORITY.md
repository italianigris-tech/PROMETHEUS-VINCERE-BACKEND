# PROMETHEUS ARCHITECTURE AUTHORITY v8.1

This document is the ground truth. No agent may override v8.1 without explicit human approval.

## Locked Spec

- Source of truth: [PROMETHEUS_v8.1_ARCHITECTURE.pdf](../PROMETHEUS_v8.1_ARCHITECTURE.pdf)
- Status: LOCKED
- Governor: Judgment Layer
- Variation engine: Candidate Treatment Genomes + Replay Ledger + Explicit Variation Key

## Frozen Decisions (The Lock v8.1)

| Decision | Value | Rationale |
|---|---|---|
| Stack | R3F + Remotion | Non-negotiable per AGENTS.md |
| Duration cap | 90 seconds | Hard limit at schema level |
| Resolution | 1080x1920 vertical | Shorts-native output |
| FPS | 30 CFR | No VFR, deterministic timeline math |
| Determinism | Mandatory | Same seed + same manifest + same variation key = same pixels |
| Director | Rule-based, 3 profiles | No IRL or multi-agent policy in Phase 1 |
| Physics | CPU-only, Node.js | WebGL receives final matrices only |
| Font engine | DOM Canvas fallback PRIMARY | opentype.js is stretch goal only |
| Audio | Band-pass sidechain (300Hz-3000Hz) | Demucs deferred to Phase 2 |
| Render | Sequential, single-chunk | No parallel chunking for MVP |
| Queue | None | No BullMQ, Redis, or monitor process in MVP |
| Bundle | Cached (SHA256 of src) | Reduces bundle latency between renders |
| SFX | 8 categories x 5 variations = 40 cues | Seeded variation, fixed cue contract |
| Text placement | Upper-middle heuristic (top 40%) | Temporary face-safe heuristic |
| Breathe | Visual-only (slow push-in + music swell) | No dead air |
| Candidates per input | 2-6 Treatment Genomes | Selected by Judgment Layer |
| Variation key | upload_instance_id + retry_index | Explicit, not hidden randomness |
| Governor | Judgment Layer | Schema is contract, not authority |
| Memory | Local Replay Ledger (SQLite/JSONL) | Persist anti-repetition locally |

## Determinism Contract

### Forbidden APIs in render path
- `Math.random()`
- `Date.now()`
- `performance.now()`
- `requestAnimationFrame()`
- `setInterval()`
- `setTimeout()`
- `GSAP`
- `crypto.getRandomValues()`
- `new Date()`
- `Math.sin()/Math.cos() in shaders without seed discipline`

### Allowed APIs in render path
- `seededRandom(seed) from @prometheus/shared-types`
- `useCurrentFrame() and useVideoConfig() from Remotion`
- `Pure functions of (frame, seed, manifest)`
- `Float32Array / Uint8Array for render-path data transfer`

## Human Gate Files
- `packages/shared-types/src/`
- `remotion-app/src/compositions/JosephEdit.tsx`
- `apps/worker/src/index.ts`
- `remotion-app/src/joseph-bundle.ts`
- `remotion-app/src/joseph-entry.tsx`
- `backend/src/director/judgment-layer.ts`
- `backend/src/director/variation-key.ts`
- `backend/src/ledger/replay-ledger.ts`
- `specs/ARCHITECTURE_AUTHORITY.md`
- `PROMETHEUS_BUILD.md structure`

## Prompt Governance Rules
- Prompts may bias doctrine, density, tone, and exclusions.
- Prompts may not switch from R3F to DOM or otherwise override the locked stack.
- Prompts may not remove determinism, change the 90-second cap, or bypass the Judgment Layer quality floor.
- Prompts may not introduce distributed infrastructure (BullMQ, Redis, queue workers, monitor processes) into the MVP.
- Prompts may not add forbidden APIs to the render path.
