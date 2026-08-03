# MAUL R2 Media Intake Design

## Goal

Turn a Cloudflare R2 upload into verified MAUL observations and a durable 9:16-ready project.

## Boundary

Cloudflare R2 emits an object-created event to an authenticated backend intake endpoint. The backend validates and deduplicates the event, creates the MAUL project and durable analysis job, then a Docker/Python observer leases the job. The observer downloads the R2 object, performs media inspection, transcript, VAD, shot detection, and subject detection, and sends the immutable observation result back to the backend. The backend validates it, creates the Editorial Timeline, and records artifact lineage.

GPT-5.6 is reserved for later editorial classification/ranking. It does not provide timestamps, geometry, or render authority.

## Frontend API

Base URL changes by environment only: local `http://localhost:<port>`; hosted uses the deployed API origin. Paths remain stable.

| Method | Path | Use |
| --- | --- | --- |
| POST | `/api/uploads/r2/presign` | Request direct R2 upload URL. |
| POST | `/api/maul/v1/intake/r2-events` | Backend/Cloudflare event receiver; frontend does not call directly. |
| GET | `/api/maul/v1/projects/:projectId` | Project and artifact state. |
| GET | `/api/maul/v1/projects/:projectId/jobs/:jobId` | Durable job state. |
| GET | `/api/maul/v1/projects/:projectId/jobs/:jobId/telemetry` | Stage timeline and failure detail. |
| POST | `/api/maul/v1/projects/:projectId/jobs` | Submit subsequent MAUL work. |
| GET | `/api/maul/v1/projects/:projectId/audit` | Immutable lineage/audit view. |

Frontend flow: presign -> upload directly to R2 -> poll project/job. Cloudflare must deliver the trusted R2 event; browser claims never authorize ingestion.

## Validation And Failure Rules

- Deduplicate by bucket, key, ETag/version, and object size.
- Require configured bucket/prefix, supported video MIME, bounded size/duration, audio, video, and readable container.
- Reject event replay, invalid signature, tenant mismatch, unsafe key, malformed observation schema, and stale/mismatched source fingerprint.
- Transcript/VAD/shot/subject failures block the analysis job with explicit stage/error evidence. No fabricated fallback observations.
- Individual subject frames may be absent; the observation artifact declares absence and MAUL uses its governed conservative placement fallback.
- Retry only transient R2/provider/network/container failures. Validation, unsupported media, and source-integrity failures are terminal.

## Deployment

Backend and Python observer run as separate Docker services. Observer receives only scoped R2 and provider credentials, leases jobs with the MAUL worker token, and writes no direct project state. Cloudflare event signing secret, R2 credentials, transcript-provider key, and GPT-5.6 key remain environment secrets.

## Verification Deferred

Per request, implementation tests are deferred. Before launch: fixture media, replay/idempotency, invalid event, missing provider, corrupt media, no-subject, multi-subject rejection, and end-to-end R2-to-timeline tests are required.
