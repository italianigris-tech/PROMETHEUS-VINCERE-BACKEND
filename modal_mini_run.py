"""Standalone Modal microservice for the Prometheus Mini-Run Studio.

Deploy (idempotent, no long-running processes left behind):
    modal deploy --env main modal_mini_run.py

Cost discipline: every function uses min_containers=0 and a short
scaledown_window so nothing keeps running after the push. The web server
scales to zero when idle.
"""

from pathlib import Path, PurePosixPath

import modal

APP_NAME = "prometheus-mini-run-studio"
APP_ROOT = PurePosixPath("/opt/prometheus")
STUDIO_ROOT = APP_ROOT / "docs/mini_run_studio"
ARTIFACT_ROOT = PurePosixPath("/data")
PORT = 8080
NODE_STUDIO_PORT = 8081

local_root = Path(__file__).resolve().parent


def local(relative_path: str) -> str:
    return str(local_root / relative_path)


app = modal.App(APP_NAME)

shared_secrets = modal.Secret.from_name("prometheus-shared-env")
backend_secrets = modal.Secret.from_name("prometheus-backend-env")
artifacts = modal.Volume.from_name("prometheus-render-artifacts", create_if_missing=True)

source_ignore = modal.FilePatternMatcher(
    "**/__pycache__/**",
    "**/*.pyc",
    "server.bundle.js",
    "server.log",
    "scratch_*",
    "tmp_*",
    "**/*.tmp",
    "**/node_modules/**",
)

studio_image = (
    modal.Image.from_registry("node:22-bookworm-slim", add_python="3.12")
    .apt_install(
        "ca-certificates",
        "ffmpeg",
        "fontconfig",
        "fonts-liberation",
        "libasound2",
    )
    .pip_install("numpy")
    .run_commands(
        "npm install -g tsx@4.22.4",
        f"mkdir -p {APP_ROOT / 'remotion-app/node_modules/@remotion/compositor-linux-x64-gnu'}",
        "ln -sf $(command -v ffmpeg) "
        f"{APP_ROOT / 'remotion-app/node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg'}",
    )
    .add_local_file(local("mini_run_gateway.py"), f"{APP_ROOT}/mini_run_gateway.py", copy=True)
    .add_local_dir(local("docs/mini_run_studio"), f"{STUDIO_ROOT}", copy=True, ignore=source_ignore)
    .add_local_dir(local("SOUND FX"), f"{APP_ROOT / 'SOUND FX'}", copy=True)
    .workdir(str(APP_ROOT))
)

def _run_gateway() -> None:
    from mini_run_gateway import start_gateway

    gateway = start_gateway(
        port=PORT,
        node_studio_port=NODE_STUDIO_PORT,
        studio_dir=str(STUDIO_ROOT),
        artifact_root=str(ARTIFACT_ROOT),
        start_node_studio=True,
    )
    # The web-server container must stay alive; serve_forever blocks here.
    gateway.serve_forever()


@app.function(
    image=studio_image,
    secrets=[shared_secrets, backend_secrets],
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
    label="mini-run",
    requires_proxy_auth=True,
)
def mini_run_studio() -> None:
    """Serve the full micro-looping studio + pipeline gateway, scale to zero."""
    _run_gateway()


# ---------------------------------------------------------------------------
# SDK-callable pipeline functions (also exposed as /api/pipeline/* routes).
# ---------------------------------------------------------------------------


@app.function(
    image=studio_image,
    cpu=1,
    memory=1024,
    min_containers=0,
    max_containers=8,
    scaledown_window=30,
    timeout=10 * 60,
)
def chunk_transcript(payload: dict) -> dict:
    from mini_run_gateway import handle_chunk

    return handle_chunk(payload)


@app.function(
    image=studio_image,
    secrets=[shared_secrets, backend_secrets],
    cpu=1,
    memory=1024,
    min_containers=0,
    max_containers=4,
    scaledown_window=30,
    timeout=20 * 60,
)
def transcribe_segment(payload: dict) -> dict:
    from mini_run_gateway import handle_transcribe

    return handle_transcribe(payload)


@app.function(
    image=studio_image,
    secrets=[shared_secrets, backend_secrets],
    volumes={str(ARTIFACT_ROOT): artifacts},
    cpu=2,
    memory=2048,
    min_containers=0,
    max_containers=4,
    scaledown_window=30,
    timeout=20 * 60,
)
def video_chunker(payload: dict) -> dict:
    from mini_run_gateway import handle_video_chunker

    return handle_video_chunker(payload)


@app.function(
    image=studio_image,
    secrets=[shared_secrets, backend_secrets],
    volumes={str(ARTIFACT_ROOT): artifacts},
    cpu=2,
    memory=4096,
    min_containers=0,
    max_containers=4,
    scaledown_window=30,
    timeout=25 * 60,
)
def matte_segment(payload: dict) -> dict:
    from mini_run_gateway import handle_matte

    return handle_matte(payload)


# ---------------------------------------------------------------------------
# Private smoke check: verify the deployed microservice is healthy, then the
# container exits and scales back to zero. Never keep anything running.
# ---------------------------------------------------------------------------


@app.function(
    image=studio_image,
    secrets=[shared_secrets, backend_secrets],
    volumes={str(ARTIFACT_ROOT): artifacts},
    cpu=1,
    memory=1024,
    min_containers=0,
    max_containers=1,
    scaledown_window=10,
    timeout=3 * 60,
)
def smoke() -> dict:
    """Start the gateway in-process, verify health + chunker, then exit (scale to zero)."""
    import threading
    import time
    import urllib.request

    from mini_run_gateway import start_gateway

    checks: dict[str, bool] = {}
    gateway = start_gateway(
        port=PORT,
        node_studio_port=NODE_STUDIO_PORT,
        studio_dir=str(STUDIO_ROOT),
        artifact_root=str(ARTIFACT_ROOT),
        start_node_studio=True,
    )
    deadline = time.monotonic() + 60
    try:
        while time.monotonic() < deadline:
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/health", timeout=2) as response:
                    checks["health"] = response.status == 200
                    if checks["health"]:
                        break
            except OSError:
                time.sleep(0.25)
        checks.setdefault("health", False)

        words = [
            {"text": "We", "start_ms": 0, "end_ms": 200, "confidence": 0.99},
            {"text": "do", "start_ms": 240, "end_ms": 400, "confidence": 0.99},
            {"text": "not", "start_ms": 420, "end_ms": 610, "confidence": 0.99},
            {"text": "need", "start_ms": 630, "end_ms": 860, "confidence": 0.99},
            {"text": "permission.", "start_ms": 880, "end_ms": 1300, "confidence": 0.99},
        ]
        chunk_result = chunk_transcript.local(payload={"words": words})
        checks["chunk_max_5"] = max(c["wordCount"] for c in chunk_result["chunks"]) <= 5
        checks["chunk_cover"] = sum(c["wordCount"] for c in chunk_result["chunks"]) == len(words)

        ok = all(checks.values())
        result = {"ok": ok, "checks": checks}
        print(result, flush=True)
        return result
    finally:
        threading.Thread(target=gateway.shutdown, daemon=True).start()
