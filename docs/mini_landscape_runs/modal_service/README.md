# Landscape 16:9 Studio — Modal Microservice

Causally linked, fully delineated from the 9:16 short-form mini-run studio.
This service owns the **landscape** tree only: the 16:9 studio template, the
Stage-7 pipeline and the Stage-8 builder. The short-form tree
(`docs/mini_run_studio/`) is never mounted.

## Files

| File | Role |
| :--- | :--- |
| `modal_landscape.py` | Modal app — web server + SDK-callable causal run + L4 bake + smoke |
| `landscape_gateway.py` | FastAPI gateway — serves studio, run data, run trigger + bake hook |
| `bake-landscape.ts` | Modal GPU bake script — bridge → bundle → frames → NVENC → mix/mux |
| `requirements.txt` | Local dev deps (image installs them anyway) |

## Endpoints

| Method | Path | Purpose |
| :--- | :--- | :--- |
| GET | `/` | Index: manifest status + built run list |
| GET | `/health` | Liveness |
| GET | `/api/status` | Template/builder presence + run count |
| GET | `/landscape` | Studio template (standalone demo corpus) |
| GET | `/p/{run_id}` | Self-contained 16:9 studio HTML for a run |
| GET | `/api/manifest` | Latest Stage-7 `LandscapeTreatmentManifest` |
| GET | `/api/run/{run_id}` | Canonical run-data JSON (builder-authored) |
| GET | `/api/runs` | List of built runs |
| POST | `/api/runs` | Pipeline (0-7) → Stage-8 builder; `bake: true` also renders the MP4 on a Modal L4 |

## Deploy

```bash
# From repo root
modal deploy --env main docs/mini_landscape_runs/modal_service/modal_landscape.py
```

`min_containers=0` + `scaledown_window=30` → the web server scales to zero when
idle. The `prometheus-landscape-artifacts` volume is mounted at
`docs/mini_landscape_runs/out/` so manifests, run-data JSON and built
presentation HTML persist across deploys.

## Local gateway run

```bash
pip install -r docs/mini_landscape_runs/modal_service/requirements.txt
uvicorn landscape_gateway:app --port 8080 --app-dir docs/mini_landscape_runs/modal_service
```

Then `curl localhost:8080/api/status`.

## Causal chain (never bypasses artifacts)

```
POST /api/runs {input_path, render?, bake?}
  → landscape_treatment_pipeline.ts   (stages 0-7 → out/landscape_treatment_manifest.json)
  → build_landscape_presentation.ts   (manifest → out/landscape_presentation_<run_id>.html
                                       + out/landscape_run_<run_id>.json)
  → [bake=true] bake_landscape_mp4 (Modal L4)
       bake-landscape.ts              (manifest → UnifiedRenderManifest → bundle →
                                       silent frames → h264_nvenc → audio mix → AAC mux)
       → out/landscape_<run_id>_bake.mp4 + out/landscape_<run_id>_bake_receipt.json
  → /p/<run_id> serves the built studio
```

`bake: true` implies `render: true` — the silence-cut MP4 must exist on the
artifacts volume as the render source. The bake runs on a single NVIDIA L4
(`gpu="L4"`), using the shared NVENC spine (`renderLandscapeFromManifest`) — the
exact same bundle → frames → `h264_nvenc` → mix/mux pipeline the worker used on
AWS Lambda, just on GPU hardware (~10x faster video encode).

Run data is **always** authored by the Stage-8 builder and embedded at the
`SEAM_BEGIN:__LANDSCAPE_RUN_DATA__` seam. The gateway never fabricates
presentation data.

## GPU bake (L4/NVENC)

The bake image (`bake_image`) is Ubuntu-based on purpose: Ubuntu's apt `ffmpeg`
ships `h264_nvenc`, while Debian's (the CPU `landscape_image` base) does not.
Modal injects the NVIDIA driver into GPU containers, so `h264_nvenc` works on
the L4 out of the box. The image also installs Chromium system deps (Remotion's
`chrome-for-testing` downloads the browser itself on first render) and runs the
repo's `npm install`s (root workspaces → `@prometheus/*`, then `apps/worker` and
`remotion-app`) so `bake-landscape.ts` can resolve every import.

The source video for the bake is resolved in priority order:
`silenceCut.outputPath` → `--source` → `silenceCut.sourcePath` → newest
`*_cut.mp4` in `out/` → newest other `.mp4` in `out/`. It is copied to
`remotion-app/public/landscape-source.mp4` so Remotion's `staticFile()` sees it
at bundle time (the copy is cleaned up after the render).
