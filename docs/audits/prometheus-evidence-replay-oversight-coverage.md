# Prometheus Evidence And Replay Oversight Coverage

Status: Active audit for GitHub #34
Created: 2026-06-29
Scope: Current repository job paths that create candidates, selected outputs, render artifacts, review verdicts, replay events, memory updates, or diversity archive entries.

This audit checks whether each job path preserves enough evidence for deterministic replay, review, and later learning. It does not change runtime authority. Missing roadmap artifacts are linked to #79 and #80 rather than hidden as miscellaneous cleanup.

## Coverage Matrix

| Job path | Candidate set | Selected candidate/output | Rejected candidates | Verdict/review | Render proof | Replay metadata | Current owner | Gap owner |
|---|---|---|---|---|---|---|---|---|
| Joseph orchestrator render planning, `backend/src/director/orchestrator.ts` | Yes: `EvidencePackage.candidates` -> `candidates.json` | Yes: `selected` -> `selected.json` | Yes: `rejected` -> `rejected.json` | Yes: `verdict.json`, `audit.json`, `review-artifact.json`, `review-ledger.ndjson`, `regression-gallery.json` | Partial: selected manifest/audit exist, but rendered frame/output proof is not attached here | Yes: `ReplayLedger.insert()` stores chosen genome, rejected genomes, planner audit, similarity hash, quality score, failure tags | `preserveEvidence()`, `preserveJosephOversightReview()`, `ReplayLedger` | #79 for compiler/render/frame proofs; #80 for deeper similarity/fatigue queries |
| Joseph render queue API, `backend/src/render-jobs/routes.ts` `/api/v1/render/jobs` | No: queue accepts one already-selected `UnifiedRenderManifest` | Yes: queued/leased/completed job contains manifest and output URL | No | Failure only: `render-failure.json` on `/failed` | Partial: completion records `outputUrl` only, no manifest hash, frame proof, renderer version, or artifact checksum | Partial: `variationKey`, timestamps, status, and failure tags are in memory only | Render job routes | #79 |
| Legacy render bridge queue, `backend/src/render-jobs/routes.ts` `/legacy` | No | Yes: bridge manifest is queued and leased | No | Failure only through shared `/failed` route | Partial: `outputUrl` only on complete | Partial: `legacy:<jobId>` variation key only | Render job routes | #79 |
| Main short-form pipeline, `backend/src/pipeline.ts` via `PrometheusService` | Yes: `candidate_segments` and enrichment/source candidates are stored in job artifacts | Yes: `selected_clips` and execution artifacts are stored in job artifacts | Partial: unselected candidate segments remain in candidate list, but explicit rejection reasons are not preserved per candidate | Partial: progress/failure/fallback telemetry exists; no Joseph-style review verdict artifact | Partial: artifact paths and readiness exist; no frame/render proof bundle | Yes for SSE replay events through `ExecutionTelemetryBroker`; no Replay Ledger row | `processJobPipeline()`, repository artifacts, `ExecutionTelemetryBroker` | #79 for explicit rejection/verdict/render proof; #80 only if this path becomes anti-fatigue authority |
| Job visibility SSE, `backend/src/execution-telemetry.ts` and `/api/jobs/:id/events?replay=once` | No | No | No | Operational stage events only | No | Yes: in-memory replayable stage/domain events with idempotency keys, capped at 200/job | `ExecutionTelemetryBroker` | #79 if events must become durable evidence; #80 is not the right owner because this is transport replay, not edit similarity replay |
| Edit-session live preview, `backend/src/edit-sessions/service.ts` and routes | Partial: preview manifest contains the active preview plan/session state | Yes: preview manifest and preview artifact URL/kind/content type are exposed | No | Diagnostics/warnings only, not a review verdict | Partial: preview artifact metadata and rendered asset path exist; no frame proof | Session events/status only; no Replay Ledger entry | Edit session manager and `PreviewRenderService` | #79 |
| Local preview runner, `backend/src/local-preview-runner.ts` `/api/local-preview/run` | Partial: run plans and preview artifacts are produced for local workflow | Yes: instant preview, preview artifact, and master render paths are tracked | No | Diagnostics/log style evidence, not a governed verdict | Partial: generated artifacts exist; no canonical render proof schema | No Replay Ledger metadata | `LocalPreviewRunner` | #79 |
| Pattern Memory update path, `backend/src/pattern-memory/store.ts` and `/api/pattern-memory/outcome` | Not applicable: this is not a candidate generator | Not applicable: records a pattern outcome | Not applicable | Yes: outcome, reasons, recommendation, constraint, human approval, before/after fingerprints in ledger event | No render proof by design | Yes: `pattern-memory.ledger.ndjson`, snapshot, mirror, and index | Pattern Memory store | No #79/#80 action unless a render job starts relying on Pattern Memory decisions without copying evidence into job artifacts |
| Joseph Sequence Objective QD archive, `backend/src/director/joseph-sequence-objective.ts` | Yes, in-memory scoring over candidate scores | Yes: selected candidate/path in `sequenceObjective` | Partial: candidates not selected remain in ranking | Yes: score breakdowns and reasons inside candidate score summary | No render proof by design | Partial: archive entries are embedded in audit/evidence, but there is no persistent cross-job QD Archive yet | Sequence Objective ranking | #79 for preserving archive entries per job; future #85 owns production QD archive behavior |
| Creative variation Map-Elites helper, `backend/src/creative-variation/index.ts` | Yes, in-memory genomes | Yes, selected controlled variations returned by helper | No explicit rejected ledger | No verdict | No render proof | No Replay Ledger metadata | Creative variation helper | No immediate #34 blocker; future #85/#86 own production exploration memory |

## Oversight Object Boundaries

Replay Ledger is the anti-repetition and deterministic replay memory for rendered candidate choices. Today it stores source/prompt fingerprints, upload instance, retry, profile, chosen genome, rejected genomes, planner audit, similarity hash, quality score, failure tags, and creation time. It is not the same thing as SSE event replay, which is operational transport history.

Pattern Memory is a reusable pattern outcome store. It records pattern IDs, context, outcomes, recommendations, constraints, human approval, and before/after fingerprints. It should influence recommendations, but a job that uses Pattern Memory still needs its own per-job evidence package.

Creator Taste Memory is not implemented as a distinct durable store in the current repo. Roadmap issues #83, #87, and #88 should create that surface from review/preference data; until then, Pattern Memory and Replay Ledger must not be described as creator taste memory.

QD Archive currently exists in two forms: Joseph Sequence Objective diversity cells embedded in the candidate score summary, and a lightweight `creative-variation` Map-Elites helper. Neither is yet a persistent cross-job Quality-Diversity Archive. #79 should preserve the per-job archive entries; #85 should own production exploration archive behavior.

## Required Follow-Ups

| Gap | Required tracker owner |
|---|---|
| Completion evidence for render queues needs output checksum, renderer version/path, manifest hash, frame sample proof, and artifact URI. | #79 |
| Compiler artifacts and Manifest Compiler audits must be preserved with selected/rejected candidates once #43 introduces the end-to-end seam. | #79 |
| Preview and local-preview artifacts need the same inspectable proof schema if they are used as learning/review examples. | #79 |
| Main pipeline candidate segments need explicit rejected-candidate reasons when used for learning or regression galleries. | #79 |
| Replay Ledger needs query surfaces for primitive family, layout signature, failure tags, and fatigue beyond source/upload lookup. | #80 |
| SSE event replay should not be counted as Replay Ledger coverage; make it durable evidence only if a future issue treats operational trace as learning data. | #79 if promoted |

## Current Risk

The Joseph orchestrator path is the strongest evidence path and is acceptable as the current authority baseline. The highest-risk gap is downstream render completion: a job can be queued, leased, completed, and returned with only an `outputUrl`, which is not enough to prove what renderer path, manifest hash, frame output, or fallback state produced the asset.

The second risk is naming confusion. Replay Ledger, Pattern Memory, Creator Taste Memory, and QD Archive are separate oversight systems. Treating them as one memory layer would hide missing learning-data guarantees and recreate the roadmap oversight gap this audit is meant to prevent.
