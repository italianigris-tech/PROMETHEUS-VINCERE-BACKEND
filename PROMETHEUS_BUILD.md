# PROMETHEUS BUILD TRACKER
## Sprint: v8.1 | Day: 1 of 14 | Phase: Backend Decision Loop Ready For Review

### Current Blockers
| Ticket | Blocker | Owner |
|--------|---------|-------|
| T18 | Render-heavy `--full` proof still depends on T01-T09 render infrastructure. Backend orchestration proof now passes through Judgment, Replay Ledger, Evidence, and Variation. | Codex / next render agent |
| T29 | Multi-orientation conflicts with locked v8.1 1080x1920 vertical authority; requires human approval before implementation. | Human |

### In Progress
| Ticket | Name | Owner | Files | Last Updated |
|--------|------|-------|-------|--------------|
| T18 | Full Integration | Codex | scripts/test-joseph.ts | 2026-06-20 |

### Ready for Review
| Ticket | Name | Owner | Test Results / Proof | Last Updated |
|--------|------|-------|----------------------|--------------|
| T10 | Candidate Generation | Codex | npm.cmd --prefix backend test -- src/director/joseph-director.test.ts | 2026-06-20 |
| T11 | Judgment Layer | Codex | `npm.cmd --prefix backend test -- src/director/judgment-layer.test.ts src/director/judgment-layer.contract.test.ts` passed: 11 tests. | 2026-06-20 |
| T12 | Replay Ledger | Codex | npm.cmd --prefix backend test -- src/ledger/replay-ledger.test.ts | 2026-06-20 |
| T13 | Dynamic Boundaries | Codex Agent 3 | npm.cmd --prefix backend test -- src/director/dynamic-boundaries.test.ts | 2026-06-20 |
| T14 | Sequence Memory | Codex | npm.cmd --prefix backend test -- src/director/sequence-memory.test.ts | 2026-06-20 |
| T15 | Band-Pass Ducking | Codex | npm.cmd --prefix backend test -- src/audio/mix-audio.test.ts | 2026-06-20 |
| T16 | SFX Variations | Codex Agent 3 | npx tsx scripts/test-joseph.ts --quick --hash sfx-test | 2026-06-20 |
| T17 | Variation Contract | Codex | npm.cmd --prefix backend test -- src/director/variation-key.test.ts | 2026-06-20 |
| T19 | Evidence Preservation | Codex Agent 3 | npm.cmd --prefix backend test -- src/ledger/evidence-preservation.test.ts | 2026-06-20 |
| T20 | Determinism Test Suite | Codex | npm.cmd --prefix packages/shared-types test -- test/determinism.test.ts; npx.cmd tsx scripts/verify-determinism.ts | 2026-06-20 |
| T21 | Director Unit Tests | Codex | npm.cmd --prefix backend test -- src/director/joseph-director.contract.test.ts | 2026-06-20 |
| T22 | Judgment Layer Tests | Codex | `npm.cmd --prefix backend test -- src/director/judgment-layer.test.ts src/director/judgment-layer.contract.test.ts` passed: 11 tests. | 2026-06-20 |
| T23 | Sequence Memory and Replay Ledger Tests | Codex | npm.cmd --prefix backend test -- src/director/sequence-memory.test.ts src/ledger/replay-ledger.test.ts | 2026-06-20 |
| T24 | Audio Mixing Tests | Codex | npm.cmd --prefix backend test -- src/audio/mix-audio.test.ts | 2026-06-20 |
| T25 | Variation Contract Tests | Codex | npm.cmd --prefix backend test -- src/director/variation-key.test.ts; npx.cmd tsx scripts/verify-variation.ts | 2026-06-20 |
| T26 | Integration Test Scripts | Codex | npx.cmd tsx scripts/verify-determinism.ts; npx.cmd tsx scripts/verify-variation.ts | 2026-06-20 |
| T27 | CI/CD Pipeline | Codex | GitHub Actions workflow: Prometheus Determinism | 2026-06-20 |
| T28 | Prompt Governance Module | Codex Agent 3 | npm.cmd --prefix backend test -- src/director/prompt-governance.test.ts | 2026-06-20 |
| T30 | Director Orchestrator | Codex | `npm.cmd --prefix backend test -- src/director/orchestrator.test.ts` passed: 7 tests. | 2026-06-20 |
| T32 | Failure Taxonomy And Judgment Rubric | Codex Agent 3 | rg -n "^## FT-" FAILURE_TAXONOMY.md | 2026-06-20 |

### Verification Snapshot
- `npm.cmd --prefix backend test -- src/director/judgment-layer.test.ts src/director/judgment-layer.contract.test.ts src/director/orchestrator.test.ts` passed: 18 tests.
- `npm.cmd --prefix backend run typecheck` passed.
- `npx.cmd tsx scripts/verify-determinism.ts` passed.
- `npx.cmd tsx scripts/verify-variation.ts` passed.
- `npx.cmd tsx scripts/test-joseph.ts` passed: candidate count, 1080x1920, 90s cap, quality floor, ledger write, evidence, variation, determinism, manifest hash.
- `npm.cmd --prefix backend test` passed full backend suite.

### Merged
| Ticket | Name | Owner | Merge Commit | Date |
|--------|------|-------|-------------|------|
| None | None | None | None | None |

### Next Up
| Ticket | Name | Dependencies / Notes | Owner Claim |
|--------|------|----------------------|-------------|
| T01 | Bundle Cache | None | Unclaimed |
| T02 | Vertical Resolution | None | Unclaimed |
| T03 | Physics Engine | None | Unclaimed |
| T04 | Font Fallback | None | Unclaimed |
| T05 | R3F Integration | T03, T04 | Unclaimed |
| T06 | Render Entry Contract | T02, T05 | Unclaimed |
| T07 | Asset Contract | None | Unclaimed |
| T08 | Chrome Timeout | T01 | Unclaimed |
| T09 | Integration Test | T01, T02, T03, T04, T05, T06, T07, T08 | Unclaimed |
| T29 | Multi-Orientation Contract Proposal | Human approval required before implementation. | Unclaimed |
| T31 | Quality-Diversity Archive Producer Pipeline | T11, T12, T19 | Unclaimed |

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
| T10 | Candidate Generation | READY_FOR_REVIEW | Codex | backend/src/director/joseph-director.ts | None | 2026-06-20 | Emits 2-6 candidate Treatment Genomes per profile. |
| T11 | Judgment Layer | READY_FOR_REVIEW | Codex | backend/src/director/judgment-layer.ts<br>backend/src/director/judgment-layer.contract.test.ts | None | 2026-06-20 | Quality floor, anti-repetition, similarity veto, replay novelty veto, and deterministic selection are implemented through the Judgment Layer public interface. |
| T12 | Replay Ledger | READY_FOR_REVIEW | Codex | backend/src/ledger/replay-ledger.ts | None | 2026-06-20 | SQLite schema. CRUD operations. |
| T13 | Dynamic Boundaries | READY_FOR_REVIEW | Codex Agent 3 | backend/src/director/dynamic-boundaries.ts<br>backend/src/director/dynamic-boundaries.test.ts | None | 2026-06-20 | Pure module returns deduplicated sorted cuts, enforces hook/body/CTA profile rules, and avoids mid-word cuts; Joseph Director core remains intentionally untouched. |
| T14 | Sequence Memory | READY_FOR_REVIEW | Codex | backend/src/director/sequence-memory.ts | None | 2026-06-20 | State machine: calm, building, saturated, recovering. |
| T15 | Band-Pass Ducking | READY_FOR_REVIEW | Codex | backend/src/audio/mix-audio.ts<br>backend/src/audio/mix-audio.test.ts | None | 2026-06-20 | Existing mix-audio band-pass ducking behavior is covered by audio tests without rewriting the audio pipeline. |
| T16 | SFX Variations | READY_FOR_REVIEW | Codex Agent 3 | remotion-app/public/sfx/ | None | 2026-06-20 | 40 placeholder MP3 stubs generated for 8 cue categories x 5 variants; Director seeded selection remains a downstream wiring concern. |
| T17 | Variation Contract | READY_FOR_REVIEW | Codex | backend/src/director/variation-key.ts | None | 2026-06-20 | Explicit upload_instance_id + retry_index handling. |
| T18 | Full Integration | IN_PROGRESS | Codex | scripts/test-joseph.ts | Render-heavy --full proof still depends on T01-T09 render infrastructure; backend loop proof passes. | 2026-06-20 | Backend full-loop proof passes for candidate generation, Judgment selection, Replay Ledger insertion, Evidence Preservation, determinism, and re-upload variation; render-heavy --full proof remains pending T01-T09 render infrastructure. |
| T19 | Evidence Preservation | READY_FOR_REVIEW | Codex Agent 3 | backend/src/ledger/evidence-preservation.ts<br>backend/src/ledger/evidence-preservation.test.ts | None | 2026-06-20 | Persists candidate set, selected manifest, verdict, audit artifact, and append-only JSONL evidence log. |
| T20 | Determinism Test Suite | READY_FOR_REVIEW | Codex | packages/shared-types/test/determinism.test.ts<br>scripts/verify-determinism.ts<br>.github/workflows/determinism.yml | None | 2026-06-20 | Same seed stable, different seed varies, no forbidden render APIs, vertical metadata enforced. |
| T21 | Director Unit Tests | READY_FOR_REVIEW | Codex | backend/src/director/joseph-director.contract.test.ts | None | 2026-06-20 | Director satisfies v8.1 vertical metadata, 90s cap, determinism, and candidate Treatment Genome contract. |
| T22 | Judgment Layer Tests | READY_FOR_REVIEW | Codex | backend/src/director/judgment-layer.test.ts<br>backend/src/director/judgment-layer.contract.test.ts | None | 2026-06-20 | Judgment Layer selects one candidate, rejects below quality floor, similarity-vetoes repeats, relaxes legacy hash thresholds once, and is deterministic. |
| T23 | Sequence Memory and Replay Ledger Tests | READY_FOR_REVIEW | Codex | backend/src/director/sequence-memory.test.ts<br>backend/src/ledger/replay-ledger.test.ts | None | 2026-06-20 | Sequence Memory state path and Replay Ledger CRUD are covered through public interfaces. |
| T24 | Audio Mixing Tests | READY_FOR_REVIEW | Codex | backend/src/audio/mix-audio.test.ts | None | 2026-06-20 | Audio filtergraph, voice ducking, SFX ducking, missing-file, and FFmpeg failure paths are covered. |
| T25 | Variation Contract Tests | READY_FOR_REVIEW | Codex | backend/src/director/variation-key.test.ts<br>scripts/verify-variation.ts | None | 2026-06-20 | Explicit upload_instance_id + retry_index handling and candidate variation are verified. |
| T26 | Integration Test Scripts | READY_FOR_REVIEW | Codex | scripts/verify-determinism.ts<br>scripts/verify-variation.ts | None | 2026-06-20 | Scripts print PASS/FAIL and exit nonzero on v8.1 contract violations. |
| T27 | CI/CD Pipeline | READY_FOR_REVIEW | Codex | .github/workflows/determinism.yml | None | 2026-06-20 | CI runs typechecks, backend tests, shared determinism tests, same-key determinism, different-key variation, and zombie Chrome check. |
| T28 | Prompt Governance Module | READY_FOR_REVIEW | Codex Agent 3 | backend/src/director/prompt-governance.ts<br>backend/src/director/prompt-governance.test.ts<br>CONTEXT.md | None | 2026-06-20 | Prompts persist to append-only JSONL, expose SHA256 fingerprints, may bias doctrine, and cannot override determinism, Variation Key, render pipeline, stack, queue, schema authority, duration cap, or forbidden render APIs. |
| T29 | Multi-Orientation Contract Proposal | NOT_STARTED | Unclaimed | specs/multi-orientation-contract-proposal.md<br>PROMETHEUS_BUILD.md | Human approval required before implementation. | 2026-06-20 | The repo has a clear human-gate proposal or deferral record, and no source code treats landscape output as v8.1 authority. |
| T30 | Director Orchestrator | READY_FOR_REVIEW | Codex | backend/src/director/orchestrator.ts<br>backend/src/director/orchestrator.test.ts | None | 2026-06-20 | The orchestrator selects one candidate through the Judgment Layer, preserves evidence, writes Replay Ledger memory, emits a Planner Audit, stays outside the renderer, and is deterministic for the same upload/retry while varying across upload instances. |
| T31 | Quality-Diversity Archive Producer Pipeline | NOT_STARTED | Unclaimed | backend/src/creative-variation/index.ts<br>backend/src/creative-variation/archive-producer.ts<br>backend/src/creative-variation/archive-producer.test.ts | T11, T12, T19 | 2026-06-20 | The archive producer consumes preserved render verdicts, emits valid VariationGenome records, updates the Quality-Diversity Archive deterministically, and keeps variation-key logic outside the archive. |
| T32 | Failure Taxonomy And Judgment Rubric | READY_FOR_REVIEW | Codex Agent 3 | FAILURE_TAXONOMY.md<br>.agents/tickets/ISSUE_32_failure_taxonomy.md | None | 2026-06-20 | Failure taxonomy doc contains FT-001 through FT-034 and maps each FT to Review Surface acceptance criteria; executable Judgment Rubric remains a separate future slice. |

### Completed
- None yet. READY_FOR_REVIEW tickets still need human review/gate before MERGED status.

### Notes
- T11/T30 close the backend decision loop without editing `apps/worker/src/index.ts`, Remotion compositions, shared schema packages, `mix-audio.ts`, `creative-variation/index.ts`, `pattern-memory/`, or Joseph Director core logic.
- T18 is deliberately not marked READY_FOR_REVIEW for render-heavy full integration because T01-T09 render infrastructure remains outside this backend loop slice.
