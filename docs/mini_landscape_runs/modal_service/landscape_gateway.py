"""Prometheus — Landscape 16:9 Treatment Studio gateway (FastAPI).

Causally linked, fully delineated from the 9:16 short-form mini-run studio:

  POST /api/runs            →  pipeline (stages 0-7) then Stage-8 builder
                               (manifest → presentation HTML)
  GET  /api/runs            →  list of built landscape runs
  GET  /api/run/{run_id}    →  canonical run-data JSON for a run
  GET  /p/{run_id}          →  self-contained 16:9 studio HTML for a run
  GET  /landscape           →  studio template (demo mode / standalone)
  GET  /                     →  status / index

The studio HTML is a static template with no data-loading mechanism of its own;
run data is always authored by the Stage-8 builder
(build_landscape_presentation.ts) and embedded at the
SEAM_BEGIN:__LANDSCAPE_RUN_DATA__ seam. This gateway only serves files — it
never fabricates presentation data.
"""

from __future__ import annotations

import json
import subprocess
import threading
from pathlib import Path
from typing import Callable, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from pydantic import BaseModel

LANDSCAPE_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = LANDSCAPE_ROOT / "out"
TEMPLATE_PATH = LANDSCAPE_ROOT / "landscape_treatment_presentation.html"
BUILDER_PATH = LANDSCAPE_ROOT / "build_landscape_presentation.ts"

app = FastAPI(title="Prometheus Landscape Treatment Studio", version="1.0.0")

BUILD_LOCK = threading.Lock()

# Injected by modal_landscape.py when running inside Modal: called after the
# pipeline + Stage-8 builder when the caller passes bake=true. Signature:
#   BAKE_HOOK(run_id: str) -> dict   (bake receipt)
BAKE_HOOK: Optional[Callable[[str], dict]] = None


def _read_json(path: Path):
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Not found: {path.name}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"Invalid JSON: {path.name}") from exc


def _latest_manifest() -> Path:
    candidate = OUT_DIR / "landscape_treatment_manifest.json"
    if candidate.exists():
        return candidate
    raise HTTPException(status_code=404, detail="No Stage-7 manifest has been generated yet.")


def _re_safe(run_id: str) -> bool:
    return bool(run_id) and all(ch.isalnum() or ch in "-_" for ch in run_id)


def _built_run_files():
    if not OUT_DIR.exists():
        return []
    runs = []
    for p in sorted(OUT_DIR.glob("landscape_run_*.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        runs.append(
            {
                "runId": data.get("runId"),
                "title": data.get("title"),
                "generatedAtIso": data.get("generatedAtIso"),
                "chunks": len((data.get("transcripts") or {}).get("run1", {}).get("chunks", [])),
                "sfxCues": len(data.get("sfxCues") or []),
                "transitions": len(data.get("transitions") or []),
                "url": f"/p/{p.stem.removeprefix('landscape_run_')}",
            }
        )
    return runs


# ---------------------------------------------------------------------------
# Index / status
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
def index() -> str:
    runs = _built_run_files()
    manifest = OUT_DIR / "landscape_treatment_manifest.json"
    if manifest.exists():
        m = _read_json(manifest)
        manifest_status = {
            "exists": True,
            "generatedAtIso": m.get("generatedAtIso"),
            "allCausal": m.get("governance", {}).get("allCausal"),
        }
    else:
        manifest_status = {"exists": False}
    html_rows = "".join(
        f"<li><a href=\"{r['url']}\">{r['runId']}</a> — {r['title']} "
        f"({r['chunks']} chunks · {r['sfxCues']} SFX · {r['transitions']} transitions)</li>"
        for r in runs
    )
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Landscape Studio — Index</title>
<style>body{{font-family:ui-monospace,monospace;background:#070913;color:#fff;padding:32px;line-height:1.6}}
a{{color:#00F0FF}}h1{{font-size:20px}}li{{margin:6px 0}}.ok{{color:#10B981}}</style></head>
<body>
<h1>🏞 Prometheus — Landscape 16:9 Treatment Studio (Modal microservice)</h1>
<p>Delineated from <code>docs/mini_run_studio/</code> (9:16 short-form). No shared context.</p>
<p class="ok">Stage-7 manifest: {json.dumps(manifest_status)}</p>
<p><a href="/landscape">Open studio template (demo corpus)</a></p>
<h2>Built landscape runs</h2>
<ul>{html_rows or "<li>No runs built yet — POST /api/runs to run the causal pipeline.</li>"}</ul>
</body></html>"""


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "service": "prometheus-landscape-studio",
        "template": TEMPLATE_PATH.exists(),
        "builder": BUILDER_PATH.exists(),
    }


@app.get("/api/status")
def status() -> dict:
    return {
        "service": "prometheus-landscape-studio",
        "ok": TEMPLATE_PATH.exists() and BUILDER_PATH.exists(),
        "template": TEMPLATE_PATH.name,
        "builder": BUILDER_PATH.name,
        "runs": len(_built_run_files()),
    }


# ---------------------------------------------------------------------------
# Studio + run presentation
# ---------------------------------------------------------------------------

@app.get("/landscape", response_class=HTMLResponse)
def landscape_studio() -> FileResponse:
    if not TEMPLATE_PATH.exists():
        raise HTTPException(status_code=404, detail="Studio template missing.")
    return FileResponse(TEMPLATE_PATH, media_type="text/html")


@app.get("/p/{run_id}", response_class=HTMLResponse)
def presentation_for_run(run_id: str) -> FileResponse:
    if not _re_safe(run_id):
        raise HTTPException(status_code=400, detail="Invalid run id.")
    presentation = OUT_DIR / f"landscape_presentation_{run_id}.html"
    if not presentation.exists():
        raise HTTPException(
            status_code=404,
            detail=f"No presentation for run '{run_id}'. POST /api/runs to build one.",
        )
    return FileResponse(presentation, media_type="text/html")


# ---------------------------------------------------------------------------
# Run data (canonical JSON authored by the Stage-8 builder)
# ---------------------------------------------------------------------------

@app.get("/api/run/{run_id}")
def run_data(run_id: str) -> JSONResponse:
    if not _re_safe(run_id):
        raise HTTPException(status_code=400, detail="Invalid run id.")
    return JSONResponse(_read_json(OUT_DIR / f"landscape_run_{run_id}.json"))


@app.get("/api/manifest")
def manifest_json() -> JSONResponse:
    return JSONResponse(_read_json(_latest_manifest()))


@app.get("/api/runs")
def list_runs() -> dict:
    return {"runs": _built_run_files()}


# ---------------------------------------------------------------------------
# Causal run trigger (pipeline stages 0-7 → Stage-8 builder)
# ---------------------------------------------------------------------------

class RunRequest(BaseModel):
    input_path: Optional[str] = None
    render: bool = False
    bake: bool = False


def _run_pipeline_and_build(input_path: Optional[str], render: bool, bake: bool = False) -> dict:
    repo_root = LANDSCAPE_ROOT.parent.parent

    # bake=true implies render=true: the GPU bake needs the silence-cut MP4 on the
    # artifacts volume (silenceCut.outputPath) as its render source.
    if bake:
        render = True

    # 1) Stages 0-7: landscape_treatment_pipeline.ts → manifest artifact.
    pipeline_cmd = ["npx", "tsx", str(LANDSCAPE_ROOT / "landscape_treatment_pipeline.ts")]
    if input_path:
        pipeline_cmd += ["--input", input_path]
    if render:
        pipeline_cmd += ["--render"]
    subprocess.run(pipeline_cmd, cwd=repo_root, check=True)

    # 2) Stage 8: manifest → self-contained 16:9 studio HTML.
    builder_cmd = ["npx", "tsx", str(BUILDER_PATH), "--manifest", str(_latest_manifest())]
    subprocess.run(builder_cmd, cwd=repo_root, check=True)

    manifest = _read_json(_latest_manifest())
    runs = _built_run_files()
    result = {
        "ok": True,
        "generatedAtIso": manifest.get("generatedAtIso"),
        "run": runs[-1] if runs else None,
    }

    # 3) Optional GPU bake (Modal L4/NVENC) — replaces the old Lambda render path.
    if bake:
        if BAKE_HOOK is None:
            raise HTTPException(
                status_code=500,
                detail="bake=true but no BAKE_HOOK injected — this gateway is not running inside Modal.",
            )
        run_id = (
            manifest.get("generatedAtIso")
            or (runs[-1]["runId"] if runs else None)
            or "landscape-run"
        )
        result["bake"] = BAKE_HOOK(run_id)

    return result


@app.post("/api/runs")
def trigger_run(req: RunRequest) -> JSONResponse:
    if not req.input_path:
        raise HTTPException(
            status_code=400,
            detail="'input_path' is required — the landscape pipeline (stages 0-7) needs a source video.",
        )
    with BUILD_LOCK:
        result = _run_pipeline_and_build(req.input_path, req.render, req.bake)
    return JSONResponse(result, status_code=201)


# Modal entrypoint (called from modal_landscape.py)
def start_gateway(port: int = 8080) -> "uvicorn.Server":
    import uvicorn

    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="info")
    return uvicorn.Server(config)
