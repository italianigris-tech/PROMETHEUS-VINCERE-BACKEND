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
import sys
import threading
from typing import Optional

import modal

APP_NAME = "prometheus-landscape-studio"
APP_ROOT = PurePosixPath("/opt/prometheus")
LANDSCAPE_ROOT = APP_ROOT / "docs/mini_landscape_runs"
ARTIFACT_ROOT = LANDSCAPE_ROOT / "out"
PORT = 8080

local_root = Path(__file__).resolve().parent

# The Modal runtime mounts the entrypoint at /root/<file>.py, so script imports
# resolve against /root, not the image workdir. landscape_gateway.py lives in
# the repo copy under /opt/prometheus, so put that dir on sys.path. Non-existent
# locally — harmless, only matters inside the container.
_MODAL_SERVICE = str(LANDSCAPE_ROOT / "modal_service")
if _MODAL_SERVICE not in sys.path:
    sys.path.insert(0, _MODAL_SERVICE)


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
repo_root = local_root.parent.parent.parent

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
    .add_local_dir(
        str(repo_root / "Yuan Prometheus Screenshots"),
        str(APP_ROOT / "Yuan Prometheus Screenshots"),
        copy=True,
    )
    .workdir(str(APP_ROOT))
)

# ---------------------------------------------------------------------------
# Bake image: NVIDIA L4 / NVENC render environment for the landscape bake.
#
# Ubuntu base on purpose — Ubuntu's apt ffmpeg ships h264_nvenc (Debian's does
# not), and Modal injects the NVIDIA driver into GPU containers so NVENC works.
# Ubuntu's apt nodejs is 12.x, so Node 22 is installed from the official
# tarball. We copy the whole repo (worker + remotion-app + shared-types +
# backend) so the shared NVENC spine (renderLandscapeFromManifest) resolves
# all imports.
# ---------------------------------------------------------------------------

bake_source_ignore = modal.FilePatternMatcher(
    "**/__pycache__/**",
    "**/*.pyc",
    "**/out/**",
    "**/fixtures/**",
    "**/.git/**",
    "**/*.mp4",
    "**/*.mov",
    "**/*.webm",
    "lib/**",
    "SOUND FX/**",
    "artifacts/**",
    ".upload_akimbosa/**",
    "scratch_*",
    "tmp_*",
    "**/node_modules/**",
    # note: **/*.wav and **/*.mp3 are deliberately KEPT (SFX/music live in
    # remotion-app/public and are needed by the audio mix).
)

bake_image = (
    modal.Image.from_registry("ubuntu:22.04", add_python="3.12")
    .env(
        {
            "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD": "1",
            "PUPPETEER_SKIP_DOWNLOAD": "1",
            "PUPPETEER_SKIP_CHROMIUM_DOWNLOAD": "1",
        }
    )
    .apt_install(
        "ca-certificates",
        "curl",
        "ffmpeg",  # Ubuntu ffmpeg → h264_nvenc on the L4
        "fontconfig",
        "fonts-liberation",
        # Chromium (chrome-for-testing) system deps for Remotion's headless render.
        "libasound2",
        "libatk-bridge2.0-0",
        "libatk1.0-0",
        "libcups2",
        "libdrm2",
        "libgbm1",
        "libnspr4",
        "libnss3",
        "libpango-1.0-0",
        "libxcomposite1",
        "libxdamage1",
        "libxfixes3",
        "libxkbcommon0",
        "libxrandr2",
        "libxshmfence1",
    )
    .pip_install("modal")
    .run_commands(
        # Ubuntu 22.04's apt nodejs is 12.x — install Node 22 from the official tarball.
        "curl -fsSL https://nodejs.org/dist/v22.23.0/node-v22.23.0-linux-x64.tar.gz | tar -xzf - -C /usr/local --strip-components=1",
        "npm install -g tsx@4.22.4",
    )
    .add_local_dir(repo_root, str(APP_ROOT), copy=True, ignore=bake_source_ignore)
    .run_commands(
        # Root workspaces (packages/* + backend) → @prometheus/* symlinks + deps.
        "cd /opt/prometheus && npm install --no-audit --no-fund",
        # shared-types must be built to dist for @prometheus/shared-types consumers.
        "cd /opt/prometheus/packages/shared-types && npm run build",
        # Worker render spine (@remotion/renderer, @remotion/bundler, react, three, troika).
        "cd /opt/prometheus/apps/worker && npm install --no-audit --no-fund",
        # remotion-app deps (bundle resolves react/three/fiber/gsap from here).
        # --legacy-peer-deps: pre-existing dev-deps conflict (vite@^8 vs
        # @vitejs/plugin-react@^5 which caps at vite 7). Vite is dev-only and
        # unused by the render bundle, so skipping peer checks is safe.
        "cd /opt/prometheus/remotion-app && npm install --no-audit --no-fund --legacy-peer-deps",
    )
    .workdir(str(APP_ROOT))
)


def _wire_bake_hook() -> None:
    """Attach the GPU bake entrypoint as the gateway's BAKE_HOOK.

    Imported lazily (not at module import time) so `modal deploy` / `modal run`
    can import this file on a dev machine that does not have fastapi installed —
    landscape_gateway imports fastapi at module scope.
    """
    import landscape_gateway

    landscape_gateway.BAKE_HOOK = bake_landscape_mp4.remote


def _wait_for_port(port: int, timeout: float = 30.0) -> None:
    """Block until something is accepting TCP connections on ``port``."""
    import socket
    import time

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                return
        except OSError:
            time.sleep(0.25)
    raise RuntimeError(f"gateway did not start listening on port {port} within {timeout}s")


def _run_gateway() -> None:
    _wire_bake_hook()
    from landscape_gateway import start_gateway

    gateway = start_gateway(port=PORT)

    # @modal.web_server requires this function to return (non-blocking) after the
    # server is up — Modal then probes the port and starts proxying traffic to it.
    # A blocking `gateway.run()` here keeps the runner stuck in "initializing" until
    # the function timeout (2400s) and requests never leave the 303 redirect loop.
    threading.Thread(target=gateway.run, daemon=True).start()
    _wait_for_port(PORT, timeout=60)


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
    timeout=40 * 60,
)
@modal.concurrent(max_inputs=50)
@modal.web_server(
    port=PORT,
    startup_timeout=3 * 60,
    label="landscape-studio",
    requires_proxy_auth=True,
)
def landscape_studio() -> None:
    """Serve the 16:9 landscape studio + pipeline/build/bake gateway, scale to zero."""
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
    timeout=40 * 60,
)
def run_landscape_treatment(
    input_path: Optional[str] = None, render: bool = False, bake: bool = False
) -> dict:
    """Run the causal chain (silence cut → sections → moves → SFX → soundtrack →
    manifest → Stage-8 presentation builder) for a landscape input, optionally
    followed by the L4/NVENC bake (bake=True → Modal GPU render of the MP4)."""
    _wire_bake_hook()
    from landscape_gateway import _run_pipeline_and_build

    return _run_pipeline_and_build(input_path, render, bake)


# ---------------------------------------------------------------------------
# GPU bake: single L4 container renders the MP4 (bundle → silent frames →
# h264_nvenc → audio mix → AAC mux). Scaled to zero when idle.
# ---------------------------------------------------------------------------


@app.function(
    image=bake_image,
    volumes={str(ARTIFACT_ROOT): artifacts},
    gpu="L4",
    cpu=8,
    memory=16384,
    min_containers=0,
    max_containers=1,
    scaledown_window=60,
    timeout=30 * 60,
)
def bake_landscape_mp4(run_id: str) -> dict:
    """Render the JosephLandscapeEdit bake on an NVIDIA L4 via bake-landscape.ts.

    Reads the latest Stage-7 manifest from the artifacts volume, bridges it to a
    UnifiedRenderManifest, and writes landscape_<run_id>_bake.mp4 + a JSON
    receipt back to the volume. Runs through the SAME NVENC spine as the old
    worker (renderLandscapeFromManifest) — the only change is the hardware.
    """
    import json
    import subprocess
    from pathlib import Path

    # ARTIFACT_ROOT is a PurePosixPath (container path); resolve a concrete Path
    # so .exists()/.glob()/.read_text() work inside the container.
    artifact_root = Path(ARTIFACT_ROOT)

    manifest_path = artifact_root / "landscape_treatment_manifest.json"
    if not manifest_path.exists():
        return {"ok": False, "error": f"Stage-7 manifest not found at {manifest_path}"}

    cmd = [
        "npx",
        "tsx",
        str(LANDSCAPE_ROOT / "bake-landscape.ts"),
        "--manifest",
        str(manifest_path),
        "--run-id",
        run_id,
        "--out",
        str(artifact_root),
    ]
    proc = subprocess.run(
        cmd, cwd=str(APP_ROOT), capture_output=True, text=True, timeout=28 * 60
    )

    if proc.stdout:
        print(proc.stdout[-8000:], flush=True)
    if proc.stderr:
        print(proc.stderr[-8000:], flush=True)

    # The bake script writes a receipt to the volume; take the newest one.
    receipts = sorted(
        artifact_root.glob("landscape_*_bake_receipt.json"),
        key=lambda p: p.stat().st_mtime,
    )
    if not receipts:
        return {
            "ok": False,
            "returncode": proc.returncode,
            "error": "Bake script produced no receipt",
        }

    receipt = json.loads(receipts[-1].read_text(encoding="utf-8"))
    if proc.returncode != 0:
        receipt["ok"] = False
        receipt["returncode"] = proc.returncode
    return receipt


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
    import asyncio
    import time
    import urllib.request

    from landscape_gateway import start_gateway

    checks: dict[str, bool] = {}
    gateway = start_gateway(port=PORT)
    threading.Thread(target=gateway.run, daemon=True).start()
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
            html = response.read()
            checks["studio_serves"] = (
                response.status == 200
                and b"SEAM_BEGIN:__LANDSCAPE_RUN_DATA__" in html
            )

        ok = all(checks.values())
        result = {"ok": ok, "checks": checks}
        print(result, flush=True)
        return result
    finally:
        threading.Thread(
            target=lambda: asyncio.run(gateway.shutdown()), daemon=True
        ).start()


if __name__ == "__main__":
    print("Deploy with: modal deploy --env main docs/mini_landscape_runs/modal_service/modal_landscape.py")
