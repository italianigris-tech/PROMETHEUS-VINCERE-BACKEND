# PROMETHEUS BUILD TRACKER
## Sprint: v8.1 | Day: 0 of 14 | Phase: Build Governor Initialization

### Current Blockers
| Ticket | Blocker | Owner |
|--------|---------|-------|
| None | None | None |

### In Progress
| Ticket | Name | Owner | Files | Last Updated |
|--------|------|-------|-------|--------------|
| T00 | Tracking Infrastructure Initialization | Codex | specs/ARCHITECTURE_AUTHORITY.md, PROMETHEUS_BUILD.md, .agents/ | 2026-06-20 |

### Ready for Review
| Ticket | Name | Owner | Test Results | Last Updated |
|--------|------|-------|-------------|--------------|
| None | None | None | None | None |

### Merged
| Ticket | Name | Owner | Merge Commit | Date |
|--------|------|-------|-------------|------|
| None | None | None | None | None |

### Next Up (Unblocked, Not Started)
| Ticket | Name | Dependencies | Owner Claim |
|--------|------|--------------|-------------|
| T01 | Bundle Cache | None | Unclaimed |
| T02 | Vertical Resolution | None | Unclaimed |
| T03 | Physics Engine | None | Unclaimed |
| T04 | Font Fallback | None | Unclaimed |
| T05 | R3F Integration | T03, T04 | Unclaimed |
| T06 | Render Entry Contract | T02, T05 | Unclaimed |
| T07 | Asset Contract | None | Unclaimed |
| T08 | Chrome Timeout | T01 | Unclaimed |
| T09 | Integration Test | T01, T02, T03, T04, T05, T06, T07, T08 | Unclaimed |
| T10 | Candidate Generation | None | Unclaimed |
| T11 | Judgment Layer | T10 | Unclaimed |
| T12 | Replay Ledger | None | Unclaimed |
| T13 | Dynamic Boundaries | T10 | Unclaimed |
| T14 | Sequence Memory | T10, T11 | Unclaimed |
| T15 | Band-Pass Ducking | None | Unclaimed |
| T16 | SFX Variations | T15 | Unclaimed |
| T17 | Variation Contract | T10, T11, T12 | Unclaimed |
| T18 | Full Integration | T09, T10, T11, T12, T13, T14, T15, T16, T17 | Unclaimed |
| T19 | Evidence Preservation | T10, T11, T12, T17 | Unclaimed |

### Ticket Registry
| Ticket # | Name | Status | Owner | Files | Blockers | Last Updated | Success Criterion |
|----------|------|--------|-------|-------|----------|--------------|-------------------|
| T01 | Bundle Cache | NOT_STARTED | Unclaimed | apps/worker/src/index.ts | None | 2026-06-20 | bundle() runs once, caches, reuses. Second render skips bundle. |
| T02 | Vertical Resolution | NOT_STARTED | Unclaimed | remotion-app/src/compositions/JosephEdit.tsx | None | 2026-06-20 | 1080x1920 canvas. Text clamped to y: 0.0-0.4. |
| T03 | Physics Engine | NOT_STARTED | Unclaimed | packages/shared-utils/src/physics-engine.ts | None | 2026-06-20 | GC-safe. 300 words x 2700 frames in <500ms. |
| T04 | Font Fallback | NOT_STARTED | Unclaimed | remotion-app/src/compositions/KineticText.tsx | None | 2026-06-20 | DOM canvas -> THREE.Texture. Deterministic. |
| T05 | R3F Integration | NOT_STARTED | Unclaimed | remotion-app/src/compositions/JosephEdit.tsx | T03, T04 | 2026-06-20 | Reads Float32Array from inputProps. No real-time physics. |
| T06 | Render Entry Contract | NOT_STARTED | Unclaimed | remotion-app/src/joseph-bundle.ts<br>remotion-app/src/joseph-entry.tsx | T02, T05 | 2026-06-20 | Joseph-specific entry point. No unrelated app code. |
| T07 | Asset Contract | NOT_STARTED | Unclaimed | packages/shared-types/src/asset-resolver.ts | None | 2026-06-20 | Explicit browser vs. FFmpeg media paths. |
| T08 | Chrome Timeout | NOT_STARTED | Unclaimed | apps/worker/src/index.ts | T01 | 2026-06-20 | 5-min timeout. SIGKILL on hang. |
| T09 | Integration Test | NOT_STARTED | Unclaimed | scripts/test-joseph.ts | T01, T02, T03, T04, T05, T06, T07, T08 | 2026-06-20 | --quick passes in <3 min. Determinism check. |
| T10 | Candidate Generation | NOT_STARTED | Unclaimed | backend/src/director/joseph-director.ts | None | 2026-06-20 | Emits 2-6 candidate Treatment Genomes per profile. |
| T11 | Judgment Layer | NOT_STARTED | Unclaimed | backend/src/director/judgment-layer.ts | T10 | 2026-06-20 | Quality floor, anti-repetition, similarity veto. |
| T12 | Replay Ledger | NOT_STARTED | Unclaimed | backend/src/ledger/replay-ledger.ts | None | 2026-06-20 | SQLite schema. CRUD operations. |
| T13 | Dynamic Boundaries | NOT_STARTED | Unclaimed | backend/src/director/joseph-director.ts | T10 | 2026-06-20 | Cuts land on beats, not mid-word. |
| T14 | Sequence Memory | NOT_STARTED | Unclaimed | backend/src/director/sequence-memory.ts | T10, T11 | 2026-06-20 | State machine: calm, building, saturated, recovering. |
| T15 | Band-Pass Ducking | NOT_STARTED | Unclaimed | backend/src/audio/mix-audio.ts | None | 2026-06-20 | No pumping on drum beats. |
| T16 | SFX Variations | NOT_STARTED | Unclaimed | remotion-app/public/sfx/<br>backend/src/director/joseph-director.ts | T15 | 2026-06-20 | 40 cues generated. Director selects seeded variation. |
| T17 | Variation Contract | NOT_STARTED | Unclaimed | backend/src/director/variation-key.ts | T10, T11, T12 | 2026-06-20 | Explicit upload_instance_id + retry_index handling. |
| T18 | Full Integration | NOT_STARTED | Unclaimed | scripts/test-joseph.ts | T09, T10, T11, T12, T13, T14, T15, T16, T17 | 2026-06-20 | --full passes. 3 profiles distinct. Re-upload variation works. |
| T19 | Evidence Preservation | NOT_STARTED | Unclaimed | backend/src/ledger/evidence-preservation.ts | T10, T11, T12, T17 | 2026-06-20 | Persist candidates, rejections, verdicts. |

### Completed
- None yet.

### Next Up
- T01 Bundle Cache
- T02 Vertical Resolution
- T03 Physics Engine
- T04 Font Fallback
