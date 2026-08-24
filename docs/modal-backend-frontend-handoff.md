# Modal Backend → Frontend Reconfiguration Handoff

**Purpose:** The frontend proxy (`/api/modal-backend/*`, `lib/server/modal-backend-proxy.ts`,
`lib/api/modal-core.ts`) is backdated to the previous `prometheus-backend` app instance. This
brief is the authoritative spec for what exists **now** in the backend, so the frontend agent can
reconfigure the proxy + client correctly: **both** the Mini-Run (9:16 short-form) service **and**
the Landscape (16:9 long-form) service, plus the **call parser** that dispatches between them.

Source of truth files (this repo):
- `modal_mini_run.py` — Mini-Run studio Modal app
- `mini_run_gateway.py` — Mini-Run HTTP gateway (all `/api/pipeline/*` routes)
- `mini_run_pipeline/` — `classify.py` (call parser), `pipeline.py` (orchestrator), `jobs.py` (queue),
  `render.py` (final MP4), `storage.py` (R2 + Supabase), `ids.py` (job IDs)
- `docs/mini_landscape_runs/modal_service/modal_landscape.py` — Landscape Modal app
- `docs/mini_landscape_runs/modal_service/landscape_gateway.py` — Landscape FastAPI routes
- `docs/mini_landscape_runs/call_parser.ts` — TS mirror of the call parser

---

## 1. TL;DR — what the frontend is getting wrong

1. **Wrong backend URL.** `PROMETHEUS_BACKEND_URL=https://joshuagreat965--api.modal.run` points at
   the OLD `prometheus-backend` (`modal_app.py`, web_server `label="api"`). That app is superseded.
   There are now **two** live Modal web servers to reach.
2. **Dead allow-list.** The 7 endpoints (`api/maul/text-chunks/preview`, `api/render/jobs`,
   `api/source-analysis/jobs`, `{id}/calls/{callId}`, `media/{filename}`) do not exist anywhere in
   the current backend. Real routes are `/api/pipeline/*` (mini-run) and `/api/status|runs|run|manifest|p`
   (landscape).
3. **No concept of two backends.** One env var + one allow-list cannot reach both services. The
   proxy needs a second backend URL (or route-prefix split) and a merged allow-list.
4. **No parser/dispatch awareness.** The call parser decides short-form (MAUL, 9:16 mini-run) vs
   long-form (Joseph, 16:9 landscape). The frontend must send duration/aspect metadata (or an
   explicit `pipeline` override) so dispatch is correct.
5. **`media/{filename}` is gone.** Final MP4s are returned as **R2 `outputUrl`** on the job receipt.
   The gateway no longer serves `/media/*` over HTTP.

---

## 2. The two live Modal backends

Both are `@modal.web_server(..., requires_proxy_auth=True)` → both demand `Modal-Key` +
`Modal-Secret` headers on every request. Those two headers are exactly what the proxy must attach
from `MODAL_PROXY_KEY` / `MODAL_PROXY_SECRET`.

| Service | Modal app | web_server label | URL (label-based) |
| :--- | :--- | :--- | :--- |
| Mini-Run studio (9:16 short-form) | `prometheus-mini-run-studio` (`modal_mini_run.py`) | `mini-run` | `https://joshuagreat965--mini-run.modal.run` |
| Landscape studio (16:9 long-form) | `prometheus-landscape-studio` (`modal_landscape.py`) | `landscape-studio` | `https://joshuagreat965--landscape-studio.modal.run` |

Confirm the exact URLs from the `modal deploy` output / Modal dashboard; the pattern is
`https://<workspace>--<label>.modal.run` (the old `...--api.modal.run` follows the same rule with
label `api`).

**Recommended env vars (replace the single `PROMETHEUS_BACKEND_URL`):**

```bash
MINI_RUN_BACKEND_URL=https://joshuagreat965--mini-run.modal.run
LANDSCAPE_BACKEND_URL=https://joshuagreat965--landscape-studio.modal.run
MODAL_PROXY_KEY=<static Modal key>
MODAL_PROXY_SECRET=<static Modal secret>
```

If you keep `PROMETHEUS_BACKEND_URL` for backward compatibility, treat it as an alias of
`MINI_RUN_BACKEND_URL` and refuse to start when the key/secret are missing (503, no stack trace).

---

## 3. Mini-Run endpoint contract (authoritative)

HTTP gateway = `mini_run_gateway.py`. Query strings are stripped before matching. Any path not
matched below is forwarded to the embedded Node studio (`serve_preview.ts`) — it is **not** the
pipeline and must not be allow-listed for pipeline use.

| Method & path | Request body | Response (200) |
| :--- | :--- | :--- |
| `GET /health` | — | `{ok:true, service:"prometheus-mini-run-studio"}` |
| `POST /api/pipeline/transcribe` | `{filePath? or inputUrl?, pollIntervalMs?, maxPollAttempts?}` | `{ok:true, provider, transcriptId, text, words[], chunks[]}` |
| `POST /api/pipeline/chunk` | `{words:[{text,start_ms,end_ms,confidence?}], maxChunkWords?}` | `{ok:true, strategy, maxChunkWords, chunkCount, chunks[]}` |
| `POST /api/pipeline/video_chunker` | `{sourcePath? or filePath? or inputUrl?, boundaries:[{startSec,endSec,partId?}], bufferSec?, jobId?}` | `{ok:true, jobId, sourceSha256, partCount, parts[]}` |
| `POST /api/pipeline/matte` | `{jobId, source, boundaries?...}` (RVM matte_worker) | `{ok:true, ...receipts}` |
| `POST /api/pipeline/render` | `{source, metadata?, design?, audio?, selectedWindow?, targetChunkWords?, maxChunkWords?, jobId?}` | `{ok:true, jobId, status:"queued", pipeline, pipelineJobId, data}` |
| `GET /api/pipeline/job/{jobId}` | — | `{ok:true, jobId, state, status, returnvalue?, failedReason?}` |

### The render request (`POST /api/pipeline/render`)

- `source` (required): a **path** already on the artifacts volume, **or an http(s) URL** the Modal
  container can fetch, or a dict `{path|url|sourceUrl|sourcePath|inputUrl}`. The frontend flow is:
  upload the video to app storage → pass the storage URL here.
- `metadata` (classification inputs): `pipeline`, `durationSec`, `durationMs`, `width`, `height`.
  Top-level `pipeline|durationSec|durationMs|width|height` are also forwarded into metadata.
- `design`: optional style spec; defaults canvas to `1080×1920` (9:16 portrait).
- `audio`: optional `{music?, cueBus?}` sound-design option (deterministic mix, muxed in).
- `selectedWindow`, `targetChunkWords` (default 3), `maxChunkWords` (default 5).

### The job poll (`GET /api/pipeline/job/{jobId}`)

- `jobId` matches `[A-Za-z0-9_:\-]+`. Backend mints IDs (`job_<hex>_<hex>`); the frontend never mints.
- `state`/`status`: `queued` → `processing` (progress 10→85) → `completed` | `failed`.
- On `completed`, `returnvalue` is the render receipt, including:
  `outputUrl` (final MP4 — R2 object URL), `r2Key`, `pipelineJobId` (`maul:<replayKey>` /
  `joseph:<jobId>`), `pipeline`, `mode`, `chunkCount`, `cutRanges`, `protectedRanges`,
  `sourceDurationMs`, `stageTimingsMs`, `audioMix?`.
- On `failed`, `failedReason` carries the error. Missing job → `404 {ok:false, jobId, error}`.

### Transcribe / chunk preview

- `POST /api/pipeline/transcribe` returns timed `words` (start_ms/end_ms/confidence) **and** already
  chunked output. This replaces the old `api/maul/text-chunks/preview`.
- `POST /api/pipeline/chunk` is the pure chunker: `{words, maxChunkWords?}` → `{chunks}` (3-word
  priority, max 5 words per chunk).

---

## 4. Landscape endpoint contract (authoritative)

FastAPI gateway = `landscape_gateway.py`. `run_id` must match `[A-Za-z0-9_-]+`.

| Method & path | Request body | Response |
| :--- | :--- | :--- |
| `GET /health` | — | `{ok:true, service:"prometheus-landscape-studio", template, builder}` |
| `GET /api/status` | — | `{service, ok, template, builder, runs}` |
| `GET /api/runs` | — | `{runs:[{runId,title,generatedAtIso,chunks,sfxCues,transitions,url}]}` |
| `POST /api/runs` | `{input_path, render?:bool, bake?:bool}` | `201 {ok:true, generatedAtIso, run, bake?}` |
| `GET /api/run/{runId}` | — | canonical run-data JSON |
| `GET /api/manifest` | — | Stage-7 treatment manifest JSON |
| `GET /p/{runId}` | — | self-contained 16:9 studio HTML |
| `GET /landscape` | — | studio template HTML |

**`POST /api/runs` is synchronous and slow.** It runs stages 0–7 (`landscape_treatment_pipeline.ts`)
then the Stage-8 builder. With `bake:true` it additionally runs the GPU (L4/NVENC) bake via a Modal
function — this can take **minutes**. The proxy must use a long timeout for this one route (e.g.
10+ min), or the frontend must treat it as fire-and-forget and poll `GET /api/runs` afterwards.



---

## 5. The call parser & dispatch model

Authoritative parser: `mini_run_pipeline/classify.py → classify_call(payload)`.

Rules (deterministic):
1. Explicit `pipeline` field wins when it is `maul` or `joseph` (decision `explicit_override`).
2. Else: `durationSec ≤ 90` **OR** portrait aspect (`width/height ≤ 1.0`) → `maul` / `short_form`.
3. Else → `joseph` / `long_form` (landscape).

Canonical pipeline job IDs: `maul:<replayKey>` or `joseph:<jobId>`.
TS mirror for the client/studio: `docs/mini_landscape_runs/call_parser.ts`.

**How the frontend must use it:**

- **Mini-run dispatch:** `POST /api/pipeline/render` classifies internally and returns the decision
  in `pipeline`. Send `metadata` (`durationSec`, `width`, `height`) so the heuristic is correct, or
  send an explicit `pipeline` override to force a studio.
- **Landscape dispatch:** when the classification is long-form (or the caller wants the 16:9
  treatment), call the **landscape service** (`POST /api/runs`) — the landscape studio is a separate
  Modal app and its execution never runs inside the mini-run container.
- Recommended client pattern: one `dispatch({source, metadata, pipeline?})` helper that lets the
  caller override, otherwise classifies client-side with the parser rules and picks the backend URL.

---

## 6. Correct client helper design (`lib/api/modal-core.ts` replacement)

All calls go through the same-origin proxy (`/api/modal-backend/*` → mini-run,
`/api/landscape-backend/*` → landscape). Suggested surface:

```ts
// Mini-run (short-form 9:16)
miniRun.health()                       // GET  /api/modal-backend/health
miniRun.transcribe({ inputUrl })       // POST /api/modal-backend/api/pipeline/transcribe
miniRun.chunk({ words })               // POST /api/modal-backend/api/pipeline/chunk
miniRun.dispatchRender(input)          // POST /api/modal-backend/api/pipeline/render
                                       //   input: { source, metadata?, design?, audio?,
                                       //            selectedWindow?, targetChunkWords?, maxChunkWords? }
miniRun.getJob(jobId)                  // GET  /api/modal-backend/api/pipeline/job/{jobId}
miniRun.pollJob(jobId, { timeoutMs })  // wraps getJob until state === completed | failed

// Landscape (long-form 16:9)
landscape.health()                     // GET  /api/landscape-backend/health
landscape.listRuns()                   // GET  /api/landscape-backend/api/runs
landscape.dispatchRun({ input_path, render, bake }) // POST /api/landscape-backend/api/runs
landscape.getRun(runId)                // GET  /api/landscape-backend/api/run/{runId}
landscape.getManifest()                // GET  /api/landscape-backend/api/manifest
landscape.presentationUrl(runId)       // /api/landscape-backend/p/{runId}
```

**Final MP4:** use `returnvalue.outputUrl` (R2) directly. Do **not** build `/media/{filename}`
URLs — the gateway no longer serves the artifact volume over HTTP.

---

## 7. Proxy reconfiguration checklist

Keep the existing security model (it is correct): Supabase auth on every request, strip
`Authorization`/`Cookie`/client `Modal-Key`/`Modal-Secret`, forward only
`accept | content-type | range`, filter response headers to the safe whitelist, 503 on missing env,
404 on non-allow-listed path, 502 on upstream failure. Changes needed:

1. **Two backends.** Add `LANDSCAPE_BACKEND_URL`; route by prefix:
   - `/api/modal-backend/*` → `MINI_RUN_BACKEND_URL`
   - `/api/landscape-backend/*` → `LANDSCAPE_BACKEND_URL`
2. **Replace the allow-list** with the authoritative route tables from §3 and §4. Parameterized
   segments:
   - `GET /api/pipeline/job/{jobId}` — jobId `[A-Za-z0-9_:\-]+`
   - `GET /api/run/{runId}` and `GET /p/{runId}` — runId `[A-Za-z0-9_-]+`
   - Drop `media/{filename}`.
3. **Timeouts:** keep 30s for mini-run dispatch/poll; use a **long timeout (10+ min)** for
   `POST /api/landscape-backend/api/runs`; 120s for HTML/JSON document downloads
   (`/p/{runId}`, `/landscape`, `/api/run/{runId}`, `/api/manifest`).
4. **Preserve** GET and POST only (the gateways don't need PUT/DELETE from the browser).

---

## 8. One-time env setup + smoke tests

Set in Vercel + local `.env`:
```bash
MINI_RUN_BACKEND_URL=https://joshuagreat965--mini-run.modal.run
LANDSCAPE_BACKEND_URL=https://joshuagreat965--landscape-studio.modal.run
MODAL_PROXY_KEY=...
MODAL_PROXY_SECRET=...
```

Smoke tests (logged-in session):
```
GET  /api/modal-backend/health                          → 200 {ok:true, service:"prometheus-mini-run-studio"}
GET  /api/landscape-backend/health                      → 200 {ok:true, service:"prometheus-landscape-studio"}
POST /api/modal-backend/api/pipeline/chunk
     {"words":[{"text":"a","start_ms":0,"end_ms":100,"confidence":0.99} ...]}  → 200 {ok:true, chunkCount:>0}
GET  /api/modal-backend/api/pipeline/job/not-a-real-job  → 404 {ok:false, error:"job not found"}
```

---

## 9. Gotchas to communicate back to the frontend agent

- `POST /api/pipeline/render` is an **async enqueue** — fast (returns `queued` immediately); the
  render itself runs on a worker and can take minutes. Poll, don't block.
- `POST /api/landscape-backend/api/runs` is **synchronous and slow** (GPU bake included) — needs a
  long proxy timeout.
- Job IDs and run IDs are **minted by the backend** (`job_<hex>_<hex>`, `maul:<replayKey>`,
  `joseph:<jobId>`, `landscape_run_<id>`). Never let the browser mint them.
- The old `https://joshuagreat965--api.modal.run` deployment may still exist — leave it alone; it is
  not part of this system and its endpoints are not to be allow-listed.
- `requires_proxy_auth=True` means requests without `Modal-Key`/`Modal-Secret` are rejected by
  Modal itself — the proxy must always attach them from env, never from the browser.
---
## 10. Billing verdict + latency verification (post-handoff audit)

### 10.1 Modal billing: idle vs active compute

**Question:** Does Modal charge for GPU/CPU wall-clock uptime (container alive, idle) or only for active compute while the container is processing a request?

**Verdict (verified from Modal's current docs):** *Only active compute.* Per-second billing while a container is running a function/request; idle/warm containers cost **nothing**.

| Source | Exact statement |
| :--- | :--- |
| `modal.com/pricing` (2026) | "You never pay for idle resources — just actual compute time, by the CPU cycle." |
| `modal.com/docs/guide/billing` | "you only pay for the compute you use or request. Reservations are not required, and there are no minimum usage-time increments." |
| Web Functions lifecycle | "Web Functions, like everything else on Modal, only run when they need to... Modal keeps the container alive for a short period in case there are subsequent requests." — the keep-alive period is **not billed** (idle = free). |

**Practical implications for the keep-warm decision:**

- **Not pinging = $0 while idle.** A scale-to-zero container (`min_containers=0, scaledown_window=30`) that receives no requests sits at zero cost. You **cannot** burn money by *not* pinging.
- **Pinging costs essentially nothing either.** A `/health` ping that uses ~0.5s of the 2-CPU container costs ~$0.000013 per ping. Even 2880 pings/day (every 30s) ≈ $0.037/day. The cost lever is not pinging — it's the volume of actual compute.
- **Default: no keep-warm ping = correct, cost-safe choice.** The past "burned through money while idle" was almost certainly a different cause: (a) the old `*--api.modal.run` web_server running its Node core process, (b) GPU matte runs (`L4 @ $0.000222/sec`) or source-analysis workers (`cpu=4, memory=8192`) actually executing, (c) a browser/frontend polling the old URL and keeping it active. Under the current model and the new apps, idle does not bill.
- **The real money sinks are active compute, not idle:**
  - `POST /api/pipeline/transcribe` — synchronous AssemblyAI poll. The container is billed for the **full wall-clock duration** of the request (up to 10 min per call). A 5-minute transcribe on the 2-CPU/4GB container ≈ $0.010.
  - `matte_worker.remote()` — GPU L4 @ $0.000222/sec. A 60-second matte run ≈ $0.013.
  - `execute_pipeline_job` — the render job runs in the web_server container (2 CPU, 4 GB, ~$0.000035/sec). A 2-minute render ≈ $0.004.
  - Duplicate transcription: every render job re-runs AssemblyAI, doubling the per-job cost.

### 10.2 Per-route latency audit (short-form, ≤90s portrait)

**The budget:** 30s per request comfortable; 1:30 (90s) absolute max for a single request. The architecture: pre-compute ~90% on upload (transcribe, chunk, matte, video_chunker), then wait for "edit" to do the remaining 10% (render enqueue + poll).

**Cold start is the dominant hidden bloat.** The mini-run web_server has `min_containers=0, scaledown_window=30` on a heavy image (node + tsx + remotion compositor + ffmpeg + fonts). First request after ~30s of idle = **30-90s container boot**. In the real flow (upload → think → edit), every step will likely cold-start unless the previous step is still running.

| Route | Type | Cold | Warm | In budget? | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /health` | sync | 30-90s | < 0.5s | ✅ if warm; ❌ if cold | Every request cold-starts the container. The upload-time pre-compute chain naturally warms it. |
| `POST /api/pipeline/chunk` | sync | 30-90s | < 0.1s | ✅ if warm | Pure in-memory word chunking. |
| `POST /api/pipeline/render` | enqueue (async) | 30-90s | < 0.5s ↔ 5-30s+ | ✅ if warm & volume-backed; ⚠️ if URL source | Enqueue calls `resolve_source(...)`; if source is an R2/http URL, the container **downloads the full file + SHA-256** inline. For a 100+ MB video that is 5-30s. For volume-backed paths, instant. |
| `GET /api/pipeline/job/{id}` | sync | 30-90s | < 0.1s | ✅ if warm | Reads from the in-process queue dict or Supabase. |
| `POST /api/pipeline/video_chunker` | sync | 30-90s | 10-60s | ⚠️ borderline | **Sequential re-encoding cuts** (`cut_segment` uses `libx264 veryfast CRF 18` — not stream copy). Each cut ~1-4s × N boundaries (10-20 for short-form) = 10-60s. Parallelizable (cuts are independent) and could use `-c copy` when no burn is needed. |
| `POST /api/pipeline/transcribe` | sync | 30-90s | 30-90s typical, **up to 10 min** | 🔴 exceeds budget | Synchronous AssemblyAI round-trip (upload + poll). Poll defaults `poll_interval_ms=2500, max_poll_attempts=240` → 10 min cap. This is the long pole. **Pre-edit step** — must be async from the frontend's perspective. |
| `POST /api/pipeline/matte` | sync | 30-90s + GPU | 10-60s+ | 🔴 can exceed budget | Calls `matte_worker.remote(MATTE_APP="prometheus-backend")` — synchronous Modal function lookup + GPU RVM matting on L4 (15-min function timeout). Gateway blocks waiting. Also a **runtime dependency on the old `prometheus-backend` app** — if that app is decommissioned, matte 500s. |

**Job-level timeline (render, not per-request):**

```
execute_pipeline_job (for a 90s short-form clip):
  1. resolve source (download if URL)                         5-30s
  2. probe (ffprobe)                                          1-3s
  3. [transcribe (30-90s) ∥ silence detect (5-15s)]           30-90s  ← dominant
  4. editorial timeline + smart chunk                          < 0.1s
  5. pre-cut (8-parallel re-encode segments)                  10-30s
  6. slice burn (8-parallel typography)                       15-60s
  7. concat (stream copy)                                      < 1s
  8. R2 upload                                                 2-5s
  ────────────────────────────────────────────────────────
  Total:                                                      60-180s
```

**Within the 1:30 budget only if transcription is excluded.** The render job always re-transcribes (see §10.3).


### 10.3 Architecture inefficiencies (the "90/10 split" gap and reliability risks)

Concrete findings that match the intuition about the pipeline not being wired for the pre-compute-then-edit flow:

**1. The 90/10 split is NOT wired.**

`execute_pipeline_job()` unconditionally runs `transcribe_assemblyai()` → `silence.detect_silence_with_ffmpeg()` → `chunks.smart_chunk_words()` → `render.render_final_video()` in sequence. The `create_pipeline_job` options dict accepts only `design`, `audio`, `selectedWindow`, `targetChunkWords`, `maxChunkWords` — **no `transcript`/`words`/`timestampMap` passthrough**. So the render job always re-runs the expensive AssemblyAI transcription (30-90s) even when the frontend just transcribed seconds ago.

**Fix:** add optional `transcript` (or `words[]`) + optional `timestampMap`/`silenceSpans` to the render options. When present, skip steps 3-5 of `execute_pipeline_job` and jump straight to the render compose. That single change makes edit-time short-form render ≈ 30-60s, within budget.

**2. Render worker is a background daemon thread in the scale-to-zero web_server container.**

`_ensure_worker()` starts a `JobWorker` with `daemon=True` threads popping from a `LocalJobQueue` (or `RedisJobQueue` if `REDIS_URL` is set). `REDIS_URL` is **empty** in `backend/.env` → production mini-run uses `LocalJobQueue`. Consequences:

- **Container can be killed mid-render.** If the user's poll cadence gaps > `scaledown_window` (30s), Modal terminates the container. The worker thread is **not an inflight request** — the container gets SIGTERM → 30s grace → SIGKILL. The job is lost; the Supabase row sits at `status: "processing"` forever. No separate Modal function exists to re-drain the queue.
- **CPU contention.** Renders share the 2-CPU/4GB web container with the proxy. A render in progress degrades every concurrent health/chunk/poll request on that container.
- **De-facto keep-alive is polling.** The only reason the container survives a multi-minute render is that the frontend polls `GET /api/pipeline/job/{id}` every few seconds, resetting the 30s scaledown timer. If the user walks away, the container dies mid-job.

**Fix options** (increasing effort): (a) bump `scaledown_window` on the mini-run web_server 30 → 300s (cost $0 while idle); (b) wire `REDIS_URL` into the mini-run Modal secret + add a dedicated queue-consumer `@app.function`; (c) at minimum, have the frontend poll every ≤20s while a job is running.

**3. Matte depends on the "dead" old app.**

`MATTE_APP = os.getenv("MINI_RUN_MATTE_APP", "prometheus-backend")` — the mini-run gateway looks up `modal.Function.lookup("prometheus-backend", "matte_worker")`. If the old `prometheus-backend` app is ever decommissioned (or its `matte_worker` removed), `POST /api/pipeline/matte` 500s. Matte is the one remaining production dependency on the superseded app. Options: confirm the old app stays deployed, or re-home `matte_worker` into `modal_mini_run.py`.

**4. video_chunker is sequential re-encodes.**

`cut_segment` uses `libx264 veryfast CRF 18` — full re-encode, not stream copy. Runs in a sequential loop (1-4s per cut). Parallelize with `ThreadPoolExecutor` and/or use `-c copy -c:a copy` when no typography burn is needed (the burn happens later in the render step anyway).

### 10.4 Recommendations for the frontend agent

1. **Do NOT block on transcribe or matte inline.** Treat them as pre-compute/background calls. If the proxy must proxy them, use a generous timeout (≥ 5 min for transcribe). Better: run transcribe on upload (before the user enters the editor) and cache the transcript client-side.
2. **Keep render enqueue + job poll as the only edit-time synchronous calls.** Those are sub-30s when warm and volume-backed.
3. **Poll the job every ≤20s** while `status` is `queued`/`processing`. This keeps the container alive and bounds staleness. Stop when `completed | failed`.
4. **Expect cold starts.** The first request after >30s of idle may take 30-90s. Piggyback on the upload-time pre-compute chain to warm the container. Do **not** rely on a keep-warm ping — idle is free, so no ping is the cost-safe default (verified, §10.1).
5. **Matte dependency needs clarification before the proxy switch ships.** Confirm the old `prometheus-backend` app is staying deployed (it still hosts `matte_worker`). If it is going away, matte breaks and must be re-homed first.
6. **The 90/10 split is a backend fix, not a frontend fix.** The frontend can already structure the flow (transcribe on upload, render on edit), but the render job re-transcribes until the backend accepts a pre-computed transcript. The frontend should still work correctly with the current model.
7. **Keep-warm summary:** no keep-warm ping. Idle is free under Modal's current billing model ("You never pay for idle resources — just actual compute time, by the CPU cycle"). If sub-1s first-request latency is later wanted, raise `scaledown_window` in `modal_mini_run.py` (line 91) from 30 → 300s — one-line change, $0 while idle.

