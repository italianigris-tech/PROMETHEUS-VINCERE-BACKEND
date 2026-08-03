# MAUL Frontend Intake Processing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a durable frontend-to-MAUL intake path where one authorized upload creates at most one project, records observable processing state, and reaches a versioned Editorial Timeline from verified media observations.

**Architecture:** The browser owns upload intent and project/job polling. Cloudflare R2 owns object-created delivery. The backend is source-of-truth for intake, identity, state transitions, artifact lineage, and worker leases. A Docker/Python observer performs bounded media analysis and submits an immutable, fenced observation result. Timeline build is a separate durable job.

**Tech Stack:** TypeScript/Fastify/Zod, PostgreSQL or SQLite transactionally during first deployment, Cloudflare R2 S3 API, signed R2 events, Docker/Python, FFmpeg/ffprobe, AssemblyAI, subject/shot model, existing MAUL control plane.

---

## Non-Negotiable Invariants

1. One accepted upload identity creates at most one MAUL project and one initial inspection job.
2. Browser upload completion is never trusted as ingestion authorization; only verified R2 events can activate an intent.
3. Every source artifact binds bucket, key, version/ETag, byte size, and SHA-256 when downloaded.
4. One job has one active lease generation. Only its current token/generation may heartbeat, submit, fail, or complete.
5. Raw observations are immutable; retries create new attempts and may create new observation artifacts. One accepted artifact becomes canonical.
6. Every temporal field uses integer source-relative milliseconds. Every geometry field uses normalized top-left coordinates after display rotation.
7. Inspection facts are authoritative over client-declared MIME, duration, dimensions, streams, or rotation.
8. Project readiness is derived from durable artifact/job state, never inferred by frontend.
9. GPT-5.6 may classify and rank editorial meaning later; it cannot author source timestamps, subject geometry, or render decisions.

## Durable Records

| Record | Required identity | Purpose |
| --- | --- | --- |
| `upload_intent` | `uploadId`, workspace/user, expected R2 bucket/key, expiry | Authorizes exactly one direct upload. |
| `r2_intake_event` | R2 event ID plus object fingerprint | Replay-safe event receipt. |
| `source_artifact` | R2 location, ETag/version, byte size, SHA-256 | Immutable media identity. |
| `maul_operation_job` | job ID, attempt, lease generation | Durable execution state. |
| `observation_artifact` | source artifact ID, observer/model versions, content hash | Immutable factual output. |
| `editorial_timeline` | parent observation ID, version, content hash | Derived immutable interpretation. |

The intake receiver inserts `upload_intent` match, event receipt, source artifact, MAUL project, and inspection job in one transaction. A unique key on `(bucket, key, objectVersionOrEtag, byteSize)` prevents duplicate projects after event replay or process crash.

## Public Frontend Endpoints

Hosted deployments keep these paths; only API origin changes by environment.

| Method | Path | Caller | Response/use |
| --- | --- | --- | --- |
| POST | `/api/uploads/r2/presign` | Frontend | Creates `upload_intent`; returns `uploadId`, R2 key, presigned URL, expiry, required headers. |
| GET | `/api/uploads/:uploadId` | Frontend | Intent lifecycle: `PRESIGNED`, `EVENT_RECEIVED`, `REJECTED`, `EXPIRED`. |
| GET | `/api/maul/v1/projects/:projectId` | Frontend | Project state, canonical artifacts, capability states. |
| GET | `/api/maul/v1/projects/:projectId/jobs/:jobId` | Frontend | Durable job stage, attempt, terminal/error state. |
| GET | `/api/maul/v1/projects/:projectId/jobs/:jobId/telemetry` | Frontend | Auditable stage events and safe failure data. |
| GET | `/api/maul/v1/projects/:projectId/audit` | Frontend | Artifact lineage and versions. |
| POST | `/api/maul/v1/projects/:projectId/jobs/:jobId/cancel` | Frontend | Requests cancellation; never force-kills a lease. |
| POST | `/api/maul/v1/projects/:projectId/jobs` | Frontend | Submits later approved MAUL work, with idempotency key. |

Frontend flow:

```text
presign -> direct R2 PUT -> GET upload intent until projectId exists
-> GET project/job every 2-5 seconds while active
-> stop polling on READY, DEGRADED, FAILED, CANCELLED
```

The browser never calls R2-event, lease, heartbeat, observation-submit, worker-fail, or worker-complete endpoints.

## Trusted Service Endpoints

| Method | Path | Auth | Rule |
| --- | --- | --- | --- |
| POST | `/api/maul/v1/intake/r2-events` | Cloudflare signature + timestamp + replay key | Validates event, intent, bucket/prefix, immutable object identity. |
| POST | `/api/maul/v1/workers/lease` | Worker token | Returns one job with lease token, generation, expiry. |
| POST | `/api/maul/v1/workers/jobs/:jobId/heartbeat` | Current lease | Extends lease only for current generation. |
| POST | `/api/maul/v1/workers/jobs/:jobId/observations` | Current lease | Validates source fingerprint and observation schema; stores immutable artifact. |
| POST | `/api/maul/v1/workers/jobs/:jobId/fail` | Current lease | Stores classified failure and schedules bounded retry if eligible. |
| POST | `/api/maul/v1/workers/jobs/:jobId/complete` | Current lease | Completes only after accepted canonical artifact/result. |

R2 event verification order: authentication -> signature -> timestamp freshness -> replay check -> schema -> expected bucket/prefix -> matching unexpired upload intent -> object identity -> transactional intake creation. Failures create no project; security failures log redacted metadata only.

## State Model

```text
PRESIGNED -> UPLOADING -> EVENT_RECEIVED -> INSPECTION_QUEUED
-> INSPECTION_RUNNING -> ANALYSIS_RUNNING -> OBSERVATION_VALIDATING
-> TIMELINE_QUEUED -> TIMELINE_BUILDING -> READY
                                        -> DEGRADED

active -> CANCEL_REQUESTED -> CANCELLED
active -> retryable failure -> QUEUED
active -> permanent failure/max attempts -> FAILED
```

`DEGRADED` means required inspection succeeded but an optional capability is unavailable. It must expose capability results, never claim full scene-aware readiness.

## Observer Contract

Input binds to immutable source identity:

```json
{
  "jobId": "maul_operation_*",
  "leaseToken": "secret",
  "leaseGeneration": 4,
  "source": {"bucket": "uploads", "key": "uploads/...mp4", "etag": "...", "byteSize": 48291022}
}
```

Observer stages: download -> ffprobe/rotation/stream selection -> bounded audio extraction -> transcript -> VAD -> shot detection -> tracked subject detections -> observation submit. It sends heartbeats between expensive stages and checks cancellation before each stage.

Resource limits: non-root container, read-only app filesystem, isolated temporary directory, no arbitrary URL fetch, CPU/memory/disk limits, process timeout, maximum upload bytes/duration/resolution/frame rate/decoded frames/audio duration. Unsupported codec, corrupt media, limit violation, missing audio/video, and identity mismatch are terminal.

## Observation Contract

```json
{
  "schemaVersion": "maul-media-observation/v1",
  "sourceArtifactId": "artifact_source_*",
  "observerVersion": "maul-observer/1",
  "timebase": "source_relative_ms",
  "coordinateSpace": {"type": "normalized", "origin": "top_left", "rotationApplied": true},
  "media": {"durationMs": 0, "width": 1080, "height": 1920, "selectedAudioStream": 0, "audioOffsetMs": 0},
  "transcript": {"status": "succeeded", "provider": "assemblyai", "words": []},
  "vad": {"status": "succeeded", "provider": "ffmpeg_silencedetect", "spans": []},
  "shots": {"status": "succeeded", "detectorVersion": "...", "spans": []},
  "subjects": {"status": "succeeded", "trackerVersion": "...", "tracks": []},
  "warnings": [],
  "provenance": {"sourceEtag": "...", "sourceSha256": "...", "toolVersions": {}}
}
```

Raw modality output remains independent. Alignment is a derived editorial artifact; it never rewrites transcript, VAD, shot, or subject evidence. Subject tracks contain timestamped boxes, track IDs, confidence, class, continuity/occlusion markers, and shot-aware segments.

Capability policy:

| Capability | Failure result |
| --- | --- |
| Inspection | terminal; no project progression. |
| Transcript | degraded only when visual-only workflow explicitly permitted; otherwise terminal. |
| VAD | terminal for silence-removal/editorial timeline. |
| Shots | degraded; shot-aware features unavailable. |
| Subjects | degraded; 9:16 uses governed conservative placement. |

## Retry, Fencing, And Recovery

- Retryable: R2/provider timeout, network failure, backend 5xx, transient container/model failure.
- Terminal: bad signature, unknown intent, stale/mismatched source, unsupported/corrupt media, size/resource limit, invalid observation schema.
- Use capped exponential backoff with jitter and a dead-letter terminal state after `maxAttempts`.
- Expired lease returns job to `QUEUED` and increments lease generation.
- Results from an expired or mismatched generation return conflict and cannot write artifacts.
- Each retry records a new attempt; accepted/rejected observations remain immutable.
- Operators can inspect, manually requeue with a selected observer version, or cancel. They cannot mutate historical observations.

## Implementation Phases

### Phase 1: Durable Intake Authority

**Files:** create transactional intake repository/migrations; extend R2 upload route; add intake event route and state contracts.

- [ ] Create `upload_intent` before presigning; bind authenticated workspace/user, allowed MIME, max bytes, expected key, expiry.
- [ ] Replace volatile intake handoff with transactional event receipt/project/inspection-job creation.
- [ ] Add Cloudflare event signature, timestamp, replay, bucket/prefix, and intent checks.
- [ ] Expose upload intent and project/job state to frontend.

### Phase 2: Fenced Observer Protocol

**Files:** extend MAUL control plane schemas/store/routes; create Python observer Docker service.

- [ ] Add lease generation, heartbeat, cancellation read, and stale-result fencing.
- [ ] Add source fingerprint verification before observation acceptance.
- [ ] Add resource-limited Docker observer configuration and structured stage telemetry.
- [ ] Add bounded retry/dead-letter classification.

### Phase 3: Versioned Observation And Timeline

**Files:** shared observation schemas; MAUL artifact service; timeline job executor.

- [ ] Persist raw modality outcomes and provenance as `maul-media-observation/v1` content-addressed artifacts.
- [ ] Assemble canonical observation only after validation; retain attempt artifacts.
- [ ] Queue distinct timeline-build job from accepted observation.
- [ ] Persist timeline versions and parent observation/artifact IDs.

### Phase 4: Frontend Integration

**Files:** frontend upload/project processing client and views.

- [ ] Implement direct-upload intent/presign/PUT flow.
- [ ] Poll durable backend state and render capability-level progress, safe errors, retry/cancel controls.
- [ ] Do not derive state from client uploads, guessed timers, or worker logs.

### Phase 5: Launch Verification

- [ ] Test duplicate/late R2 events, crash after transactional intake, overwritten key, stale worker result, lease expiry, cancellation, corrupt/oversized media, VFR/rotation, missing streams, every partial capability outcome, and full R2-to-timeline replay.
- [ ] Measure upload-to-event, queue, analysis, retry, failure, lease-expiry, and project-ready metrics with correlated IDs.
