"""Standalone Modal microservice for the Prometheus Landscape 16:9 Treatment Studio.

Causally linked, fully delineated from the 9:16 short-form mini-run studio:
this service owns the landscape studio template, the Stage-8 builder and the
pipeline (stages 0-7) — the short-form tree is never mounted.

Deploy (idempotent, no long-running processes left behind):
    modal deploy --env main docs/mini_landscape_runs/modal_service/modal_landscape.py

Cost discipline mirrors modal_mini_run.py: min_containers=0 and a short
scaledown_window so the web server scales to zero when idle.
"""

from pathlib import Path, PurePosixPath
from typing import Optional

import modal

APP_NAME = "prometheus-landscape-studio"
APP_ROOT = PurePosixPath("/opt/prometheus")
LANDSCAPE_ROOT = APP_ROOT / "docs/mini_landscape_runs"
ARTIFACT_ROOT = LANDSCAPE_ROOT / "out"
PORT = 8080

local_root = Path(__file__).resolve().parent


def local(relative_path: str) -> str:
    return str(local_root / relative_path)


app = modal.App(APP_NAME)

artifacts = modal.Volume.from_name("prometheus-landscape-artifacts", create_if_missing=True)

source_ignore = modal.FilePatternMatcher(
    "**/__pycache__/**",
    "**/*.pyc",
    "**/out/**",
    "**/fixtures/**",
    "**/*.mp4",
    "**/*.mov",
    "**/*.wav",
    "**/*.mp3",
    "scratch_*",
    "tmp_*",
    "**/node_modules/**",
)

landscape_image = (
    modal.Image.from_registry("node:22-bookworm-slim", add_python="3.12")
    .apt_install(
        "ca-certificates",
        "ffmpeg",
        "fontconfig",
        "fonts-liberation",
        "libasound2",
    )
    .pip_install("modal", "fastapi", "uvicorn", "pydantic")
    .run_commands("npm install -g tsx@4.22.4")
    .add_local_dir(local(".."), str(LANDSCAPE_ROOT), copy=True, ignore=source_ignore)
    .workdir(str(APP_ROOT))
)


def _run_gateway() -> None:
    from landscape_gateway import start_gateway

    gateway = start_gateway(port=PORT)
    # The web-server container must stay alive; serve_forever blocks here.
    gateway.serve_forever()


# ---------------------------------------------------------------------------
# Web server: studio template + run presentations + API (scale to zero).
# ---------------------------------------------------------------------------

@app.function(
    image=landscape_image,
    volumes={str(ARTIFACT_ROOT): artifacts},
    cpu=2,
    memory=4096,
    min_containers=0,
    max_containers=4,
    scaledown_window=30,
    timeout=20 * 60,
)
@modal.concurrent(max_inputs=50)
@modal.web_server(
    port=PORT,
    startup_timeout=3 * 60,
    label="landscape-studio",
    requires_proxy_auth=True,
)
def landscape_studio() -> None:
    """Serve the 16:9 landscape studio + pipeline/build gateway, scale to zero."""
    _run_gateway()


# ---------------------------------------------------------------------------
# SDK-callable causal run: pipeline stages 0-7 → Stage-8 builder.
# ---------------------------------------------------------------------------


@app.function(
    image=landscape_image,
    volumes={str(ARTIFACT_ROOT): artifacts},
    cpu=2,
    memory=4096,
    min_containers=0,
    max_containers=4,
    scaledown_window=30,
    timeout=20 * 60,
)
def run_landscape_treatment(input_path: Optional[str] = None, render: bool = False) -> dict:
    """Run the causal chain (silence cut → sections → moves → SFX → soundtrack →
    manifest → Stage-8 presentation builder) for a landscape input."""
    from landscape_gateway import _run_pipeline_and_build

    return _run_pipeline_and_build(input_path, render)


# ---------------------------------------------------------------------------
# Private smoke check: verify the deployed microservice is healthy, then the
# container exits and scales back to zero. Never keep anything running.
# ---------------------------------------------------------------------------


@app.function(
    image=landscape_image,
    volumes={str(ARTIFACT_ROOT): artifacts},
    cpu=1,
    memory=1024,
    min_containers=0,
    max_containers=1,
    scaledown_window=10,
    timeout=3 * 60,
)
def smoke() -> dict:
    """Start the gateway in-process, verify health + template/builder presence."""
    import threading
    import time
    import urllib.request

    from landscape_gateway import start_gateway

    checks: dict[str, bool] = {}
    gateway = start_gateway(port=PORT)
    deadline = time.monotonic() + 60
    try:
        while time.monotonic() < deadline:
            try:
                with urllib.request.urlopen(
                    f"http://127.0.0.1:{PORT}/api/status", timeout=2
                ) as response:
                    checks["health"] = response.status == 200
                    if checks["health"]:
                        break
            except OSError:
                time.sleep(0.25)
        checks.setdefault("health", False)

        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/landscape", timeout=5) as response:
            html = response.read(4096)
            checks["studio_serves"] = response.status == 200 and b"SEAM_BEGIN:__LANDSCAPE_RUN_DATA__" in html

        ok = all(checks.values())
        result = {"ok": ok, "checks": checks}
        print(result, flush=True)
        return result
    finally:
        threading.Thread(target=gateway.shutdown, daemon=True).start()


if __name__ == "__main__":
    print("Deploy with: modal deploy --env main docs/mini_landscape_runs/modal_service/modal_landscape.py")
