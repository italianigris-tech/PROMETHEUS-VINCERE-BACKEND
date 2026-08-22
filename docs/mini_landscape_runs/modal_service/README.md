# Landscape 16:9 Studio — Modal Microservice

Causally linked, fully delineated from the 9:16 short-form mini-run studio.
This service owns the **landscape** tree only: the 16:9 studio template, the
Stage-7 pipeline and the Stage-8 builder. The short-form tree
(`docs/mini_run_studio/`) is never mounted.

## Files

| File | Role |
| :--- | :--- |
| `modal_landscape.py` | Modal app — web server + SDK-callable causal run + smoke |
| `landscape_gateway.py` | FastAPI gateway — serves studio, run data, run trigger |
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
| POST | `/api/runs` | Run pipeline (stages 0-7) → Stage-8 builder |

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
POST /api/runs
  → landscape_treatment_pipeline.ts   (stages 0-7 → out/landscape_treatment_manifest.json)
  → build_landscape_presentation.ts   (manifest → out/landscape_presentation_<run_id>.html
                                       + out/landscape_run_<run_id>.json)
  → /p/<run_id> serves the built studio
```

Run data is **always** authored by the Stage-8 builder and embedded at the
`SEAM_BEGIN:__LANDSCAPE_RUN_DATA__` seam. The gateway never fabricates
presentation data.
