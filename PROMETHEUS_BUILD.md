# PROMETHEUS BUILD TRACKER
## Sprint: v8.1 | Day: 0 of 14 | Phase: Build Governor Initialization

### Current Blockers
| Ticket | Blocker | Owner |
|--------|---------|-------|
| T20 | Determinism check fails because Director emits 1920x1080 instead of v8.1 1080x1920. | Codex |
| T21 | Director contract fails: missing 90s cap and missing generateCandidateGenomes export. | Codex |
| T22 | judgment-layer.ts not present yet; contract tests are skipped until Opus lands module. | Opus |
| T23 | sequence-memory.ts and replay-ledger.ts not present yet; contract tests are skipped until Opus lands modules. | Opus |
| T25 | variation-key.ts not present yet and generateCandidateGenomes is missing. | Opus |
| T26 | Integration scripts run but are blocked by T20, T21, and T25 contract failures. | Codex |
| T29 | Multi-orientation conflicts with locked v8.1 1080x1920 vertical authority; requires human approval before implementation. | Human |

### In Progress
| Ticket | Name | Owner | Files | Last Updated |
|--------|------|-------|-------|--------------|
| T00 | Tracking Infrastructure Initialization | Codex | specs/ARCHITECTURE_AUTHORITY.md, PROMETHEUS_BUILD.md, .agents/ | 2026-06-20 |

### Ready for Review
| Ticket | Name | Owner | Test Results | Last Updated |
|--------|------|-------|-------------|--------------|
| T24 | Audio Mixing Tests | Codex | `npm.cmd --prefix backend test -- src/audio/mix-audio.test.ts` passed: 5 tests. | 2026-06-20 |
| T27 | CI/CD Pipeline | Codex | Workflow created; will run red until T20/T21/T25 blockers are fixed. | 2026-06-20 |

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
| T28 | Prompt Governance Module | None | Unclaimed |
| T29 | Multi-Orientation Contract Proposal | Human Gate | Unclaimed |
| T32 | Failure Taxonomy And Judgment Rubric | None | Unclaimed |

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
| T20 | Determinism Test Suite | BLOCKED | Codex | packages/shared-types/test/determinism.test.ts<br>scripts/verify-determinism.ts<br>.github/workflows/determinism.yml | Director emits 1920x1080 | 2026-06-20 | Same seed stable, different seed varies, no forbidden render APIs, vertical metadata enforced. |
| T21 | Director Unit Tests | BLOCKED | Codex | backend/src/director/joseph-director.contract.test.ts | Missing 90s cap and generateCandidateGenomes | 2026-06-20 | Director satisfies v8.1 manifest, duration, determinism, and candidate contract. |
| T22 | Judgment Layer Tests | BLOCKED | Codex | backend/src/director/judgment-layer.test.ts | judgment-layer.ts absent | 2026-06-20 | Judgment Layer selects one candidate, rejects below quality floor, and is deterministic. |
| T23 | Sequence Memory and Replay Ledger Tests | BLOCKED | Codex | backend/src/director/sequence-memory.test.ts<br>backend/src/ledger/replay-ledger.test.ts | sequence-memory.ts and replay-ledger.ts absent | 2026-06-20 | Sequence Memory state path and Replay Ledger CRUD are covered. |
| T24 | Audio Mixing Tests | READY_FOR_REVIEW | Codex | backend/src/audio/mix-audio.test.ts | None | 2026-06-20 | Audio filtergraph, ducking, SFX missing-file, and FFmpeg failure paths covered. |
| T25 | Variation Contract Tests | BLOCKED | Codex | backend/src/director/variation-key.test.ts<br>scripts/verify-variation.ts | variation-key.ts absent; generateCandidateGenomes missing | 2026-06-20 | Explicit upload_instance_id + retry_index behavior and candidate variation verified. |
| T26 | Integration Test Scripts | BLOCKED | Codex | scripts/verify-determinism.ts<br>scripts/verify-variation.ts | Depends on T20/T21/T25 fixes | 2026-06-20 | Scripts print PASS/FAIL and exit nonzero on v8.1 contract violations. |
| T27 | CI/CD Pipeline | READY_FOR_REVIEW | Codex | .github/workflows/determinism.yml | None | 2026-06-20 | CI runs typechecks, backend tests, determinism, variation, and zombie Chrome check. |
| T28 | Prompt Governance Module | NOT_STARTED | Unclaimed | backend/src/director/prompt-governance.ts<br>backend/src/director/prompt-governance.test.ts<br>CONTEXT.md | None | 2026-06-20 | Prompts may bias doctrine, density, tone, and exclusions, but cannot override stack, determinism, duration cap, queue architecture, schema authority, or render-path forbidden APIs. |
| T29 | Multi-Orientation Contract Proposal | NOT_STARTED | Unclaimed | specs/multi-orientation-contract-proposal.md<br>PROMETHEUS_BUILD.md | Human approval required before implementation | 2026-06-20 | The repo has a clear human-gate proposal or deferral record, and no source code treats landscape output as v8.1 authority. |
| T30 | Director Orchestrator | NOT_STARTED | Unclaimed | backend/src/cognitive-governor/index.ts<br>backend/src/director/orchestrator.ts<br>backend/src/director/orchestrator.test.ts | T10, T11, T12, T17, T19, T28 | 2026-06-20 | The orchestrator selects one candidate through the Judgment Layer, preserves evidence, emits a Planner Audit, does not call the renderer, and fails visibly when all candidates are blocked. |
| T31 | Quality-Diversity Archive Producer Pipeline | NOT_STARTED | Unclaimed | backend/src/creative-variation/index.ts<br>backend/src/creative-variation/archive-producer.ts<br>backend/src/creative-variation/archive-producer.test.ts | T11, T12, T19 | 2026-06-20 | The archive producer consumes preserved render verdicts, emits valid VariationGenome records, updates the Quality-Diversity Archive deterministically, and keeps variation-key logic outside the archive. |
| T32 | Failure Taxonomy And Judgment Rubric | NOT_STARTED | Unclaimed | backend/src/director/failure-taxonomy.ts<br>backend/src/director/judgment-rubric.ts<br>backend/src/director/judgment-rubric.test.ts<br>CONTEXT.md | None | 2026-06-20 | Judgment verdicts can attach stable failure tags and rationale without treating failure-intelligence as the Judgment Layer. |

### Completed
- None yet.

### Next Up
- Fix T20/T21 blockers in the Director: vertical 1080x1920 metadata, 90s duration cap, and `generateCandidateGenomes` export.
- Land Opus modules for T22/T23/T25: `judgment-layer.ts`, `sequence-memory.ts`, `replay-ledger.ts`, and `variation-key.ts`.
- Use `prometheus_v8.1_prd.md` as the critique/proposal artifact for T28-T32 planning work.
- Pick up unblocked planning tickets T28 and T32 before T30/T31; keep T29 as human-gate only.
- Re-run `npx.cmd tsx scripts/verify-determinism.ts` and `npx.cmd tsx scripts/verify-variation.ts` after those fixes.
