"""Serverless Modal deployment for the Prometheus core and render worker.

Deploy with:
    modal deploy --env main modal_app.py

The thin Node core owns inexpensive HTTP/model calls. Heavy Remotion, Chromium,
FFmpeg, fonts, and render assets live only in the on-demand render worker.
"""

from pathlib import Path, PurePosixPath
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import threading
import time
import urllib.request

import modal


APP_NAME = "prometheus-backend"
APP_ROOT = PurePosixPath("/opt/prometheus")
BACKEND_ROOT = APP_ROOT / "backend"
WORKER_ROOT = APP_ROOT / "apps/worker"
RVM_ROOT = APP_ROOT / "packages/rvm-pipeline"
ARTIFACT_ROOT = PurePosixPath("/data")
PORT = 8000

local_root = Path(__file__).resolve().parent


def local(relative_path: str) -> str:
    return str(local_root / relative_path)


source_ignore = modal.FilePatternMatcher(
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/__tests__/**",
    "**/test-results/**",
)


api_image = (
    modal.Image.from_registry("node:22-bookworm-slim", add_python="3.12")
    .apt_install("ca-certificates")
    .add_local_file(local("package.json"), f"{APP_ROOT}/package.json", copy=True)
    .add_local_file(local("package-lock.json"), f"{APP_ROOT}/package-lock.json", copy=True)
    .add_local_file(local("backend/package.json"), f"{BACKEND_ROOT}/package.json", copy=True)
    .add_local_file(
        local("packages/shared-types/package.json"),
        f"{APP_ROOT}/packages/shared-types/package.json",
        copy=True,
    )
    .add_local_file(
        local("packages/shared-types/tsconfig.json"),
        f"{APP_ROOT}/packages/shared-types/tsconfig.json",
        copy=True,
    )
    .run_commands(f"cd {APP_ROOT} && npm ci")
    .add_local_dir(
        local("packages/shared-types/src"),
        f"{APP_ROOT}/packages/shared-types/src",
        copy=True,
        ignore=source_ignore,
    )
    .run_commands(f"cd {APP_ROOT} && npm --workspace @prometheus/shared-types run build")
    .add_local_dir(
        local("backend/src"),
        f"{BACKEND_ROOT}/src",
        copy=True,
        ignore=source_ignore,
    )
    .add_local_file(local("backend/tsconfig.json"), f"{BACKEND_ROOT}/tsconfig.json", copy=True)
    .workdir(str(BACKEND_ROOT))
)

source_analysis_image = api_image.apt_install("ffmpeg")


worker_image = (
    modal.Image.from_registry("node:22-bookworm-slim", add_python="3.12")
    .apt_install(
        "ca-certificates",
        "ffmpeg",
        "fontconfig",
        "fonts-liberation",
        "libasound2",
        "libatk-bridge2.0-0",
        "libatk1.0-0",
        "libcairo2",
        "libcups2",
        "libdbus-1-3",
        "libdrm2",
        "libgbm1",
        "libgtk-3-0",
        "libnss3",
        "libpango-1.0-0",
        "libx11-xcb1",
        "libxcomposite1",
        "libxdamage1",
        "libxfixes3",
        "libxkbcommon0",
        "libxrandr2",
    )
    .add_local_file(
        local("packages/shared-types/package.json"),
        f"{APP_ROOT}/packages/shared-types/package.json",
        copy=True,
    )
    .add_local_file(
        local("packages/shared-types/tsconfig.json"),
        f"{APP_ROOT}/packages/shared-types/tsconfig.json",
        copy=True,
    )
    .add_local_dir(
        local("packages/shared-types/src"),
        f"{APP_ROOT}/packages/shared-types/src",
        copy=True,
        ignore=source_ignore,
    )
    .run_commands(
        f"cd {APP_ROOT}/packages/shared-types && npm install --include=dev && npm run build"
    )
    .add_local_file(local("backend/package.json"), f"{BACKEND_ROOT}/package.json", copy=True)
    .add_local_file(local("backend/tsconfig.json"), f"{BACKEND_ROOT}/tsconfig.json", copy=True)
    .add_local_dir(
        local("backend/src"),
        f"{BACKEND_ROOT}/src",
        copy=True,
        ignore=source_ignore,
    )
    .add_local_file(local("apps/worker/package.json"), f"{WORKER_ROOT}/package.json", copy=True)
    .add_local_file(
        local("apps/worker/package-lock.json"),
        f"{WORKER_ROOT}/package-lock.json",
        copy=True,
    )
    .add_local_file(local("apps/worker/tsconfig.json"), f"{WORKER_ROOT}/tsconfig.json", copy=True)
    .add_local_file(
        local("apps/worker/remotion.config.ts"),
        f"{WORKER_ROOT}/remotion.config.ts",
        copy=True,
    )
    .run_commands(f"cd {WORKER_ROOT} && npm ci --include=dev --legacy-peer-deps")
    .add_local_dir(
        local("apps/worker/src"),
        f"{WORKER_ROOT}/src",
        copy=True,
        ignore=source_ignore,
    )
    .add_local_dir(local("apps/worker/scripts"), f"{WORKER_ROOT}/scripts", copy=True)
    .add_local_dir(local("apps/worker/public"), f"{WORKER_ROOT}/public", copy=True)
    .add_local_dir(
        local("remotion-app/src"),
        f"{APP_ROOT}/remotion-app/src",
        copy=True,
        ignore=source_ignore,
    )
    .add_local_dir(
        local("remotion-app/public"),
        f"{APP_ROOT}/remotion-app/public",
        copy=True,
    )
    .add_local_dir(
        local("Yuan Prometheus Screenshots/font JSON"),
        f"{APP_ROOT}/Yuan Prometheus Screenshots/font JSON",
        copy=True,
    )
    .env(
        {
            "NODE_ENV": "production",
            "REMOTION_CHROMIUM_HEADLESS_MODE": "new",
            "TOKENIZERS_PARALLELISM": "false",
        }
    )
    .workdir(str(WORKER_ROOT))
)


matte_image = (
    modal.Image.from_registry("pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime")
    .apt_install("ca-certificates", "curl", "ffmpeg", "git")
    .pip_install(
        "imageio-ffmpeg==0.6.0",
        "numpy==1.26.4",
        "opencv-python-headless==4.10.0.84",
    )
    .add_local_dir(
        local("packages/rvm-pipeline/rvm_pipeline"),
        f"{RVM_ROOT}/rvm_pipeline",
        copy=True,
    )
    .run_commands(
        "git clone --depth 1 https://github.com/PeterL1n/RobustVideoMatting.git /opt/RobustVideoMatting",
        "mkdir -p /opt/models && curl -fL https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_resnet50.pth -o /opt/models/rvm_resnet50.pth",
    )
    .env(
        {
            "PYTHONPATH": str(RVM_ROOT),
            "RVM_OUTPUT_ROOT": "/tmp/prometheus-rvm",
            "RVM_REQUIRE_CUDA": "1",
            "RVM_ALLOW_TORCHHUB_FALLBACK": "0",
            "RVM_TORCHHUB_REPO": "/opt/RobustVideoMatting",
            "RVM_REPO_IS_LOCAL": "1",
            "RVM_VARIANT": "resnet50",
            "RVM_SEQ_CHUNK": "12",
            "FFMPEG_LOGLEVEL": "error",
        }
    )
)


app = modal.App(APP_NAME)
shared_secrets = modal.Secret.from_name("prometheus-shared-env")
backend_secrets = modal.Secret.from_name("prometheus-backend-env")
artifacts = modal.Volume.from_name("prometheus-render-artifacts", create_if_missing=True)


class RenderDispatchHandler(BaseHTTPRequestHandler):
    """Private localhost adapter between the Node core and Modal calls."""

    def _send_json(self, status_code: int, body: dict) -> None:
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self) -> None:
        if self.path not in {"/spawn", "/matte/spawn", "/source-analysis/spawn"}:
            self._send_json(404, {"error": "Not found."})
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 16 * 1024 * 1024:
                raise ValueError("Render dispatch payload must be between 1 byte and 16 MiB.")
            payload = json.loads(self.rfile.read(content_length))
            if self.path == "/source-analysis/spawn":
                request = payload.get("request")
                if not isinstance(request, dict):
                    raise ValueError("Source analysis dispatch requires a request object.")
                call = source_analysis_worker.spawn(request)
            elif self.path == "/matte/spawn":
                request = payload.get("request")
                if not isinstance(request, dict):
                    raise ValueError("Matting dispatch requires a request object.")
                call = matte_worker.spawn(request)
            else:
                manifest = payload.get("manifest")
                if not isinstance(manifest, dict):
                    raise ValueError("Render dispatch requires a manifest object.")
                call = render_worker.spawn(manifest)
            self._send_json(202, {"callId": call.object_id, "status": "queued"})
        except Exception as error:
            self._send_json(400, {"error": str(error)})

    def do_GET(self) -> None:
        prefix = "/calls/"
        if not self.path.startswith(prefix):
            self._send_json(404, {"error": "Not found."})
            return
        call_id = self.path[len(prefix):]
        try:
            call = modal.FunctionCall.from_id(call_id)
            result = call.get(timeout=0)
            artifacts.reload()
            self._send_json(200, result)
        except TimeoutError:
            self._send_json(202, {"status": "running"})
        except modal.exception.OutputExpiredError:
            self._send_json(404, {"status": "failed", "error": "Render call result expired."})
        except Exception as error:
            self._send_json(200, {"status": "failed", "error": str(error)})

    def log_message(self, _format: str, *_args: object) -> None:
        return


def start_dispatch_server() -> ThreadingHTTPServer:
    server = ThreadingHTTPServer(("127.0.0.1", 8001), RenderDispatchHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


@app.function(
    image=api_image,
    secrets=[shared_secrets, backend_secrets],
    volumes={str(ARTIFACT_ROOT): artifacts},
    cpu=1,
    memory=1024,
    min_containers=0,
    max_containers=8,
    scaledown_window=60,
    timeout=10 * 60,
)
@modal.web_server(
    port=PORT,
    startup_timeout=2 * 60,
    label="api",
    requires_proxy_auth=True,
)
def api() -> None:
    start_dispatch_server()
    runtime_env = os.environ.copy()
    runtime_env.update(
        {
            "PORT": str(PORT),
            "STORAGE_DIR": str(ARTIFACT_ROOT / "core"),
            "MEDIA_DIR": str(ARTIFACT_ROOT / "media"),
            "CORS_ORIGINS": "https://prometheusstudio.tech",
            "MODAL_RENDER_DISPATCH_URL": "http://127.0.0.1:8001",
        }
    )
    subprocess.Popen(
        ["npm", "run", "start:core"],
        cwd=BACKEND_ROOT,
        env=runtime_env,
    )


@app.function(
    image=api_image,
    secrets=[shared_secrets, backend_secrets],
    cpu=1,
    memory=1024,
    min_containers=0,
    max_containers=1,
    scaledown_window=15,
    timeout=3 * 60,
)
def api_smoke() -> dict:
    """Privately verify the thin image and always terminate its Node process."""
    runtime_env = os.environ.copy()
    runtime_env.update(
        {
            "PORT": str(PORT),
            "STORAGE_DIR": "/tmp/prometheus-smoke",
            "MEDIA_DIR": "/tmp/prometheus-smoke/media",
            "CORS_ORIGINS": "https://prometheusstudio.tech",
        }
    )
    process = subprocess.Popen(
        ["npm", "run", "start:core"],
        cwd=BACKEND_ROOT,
        env=runtime_env,
    )
    deadline = time.monotonic() + 90
    try:
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError(f"Core process exited with code {process.returncode}.")
            try:
                with urllib.request.urlopen(
                    f"http://127.0.0.1:{PORT}/health",
                    timeout=2,
                ) as response:
                    body = json.loads(response.read())
                    if response.status == 200 and body == {"ok": True}:
                        return {"ok": True, "status": response.status}
            except OSError:
                time.sleep(0.25)
        raise TimeoutError("Thin core did not become healthy within 90 seconds.")
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


@app.function(
    image=source_analysis_image,
    secrets=[shared_secrets, backend_secrets],
    cpu=4,
    memory=8192,
    min_containers=0,
    max_containers=4,
    scaledown_window=30,
    timeout=60 * 60,
    retries=1,
)
def source_analysis_worker(payload: dict) -> dict:
    """Process one database-leased source revision, then scale fully to zero."""
    job_id = payload.get("jobId")
    source_asset_id = payload.get("sourceAssetId")
    if not isinstance(job_id, str) or not job_id.strip():
        raise ValueError("Source analysis requires a durable jobId.")
    if source_asset_id != job_id:
        raise ValueError("Source analysis jobId must equal its canonical sourceAssetId.")

    runtime_env = os.environ.copy()
    runtime_env.update(
        {
            "STORAGE_DIR": "/tmp/prometheus-source-analysis",
            "MAUL_SUPABASE_BRIDGE_ENABLED": "true",
        }
    )
    completed = subprocess.run(
        [
            "npx",
            "tsx",
            "src/maul/run-source-analysis-job.ts",
            "--job-id",
            job_id,
        ],
        cwd=BACKEND_ROOT,
        env=runtime_env,
        capture_output=True,
        text=True,
        check=True,
        timeout=58 * 60,
    )
    return json.loads(completed.stdout.strip().splitlines()[-1])


@app.function(
    image=worker_image,
    secrets=[shared_secrets, backend_secrets],
    volumes={str(ARTIFACT_ROOT): artifacts},
    cpu=8,
    memory=16384,
    min_containers=0,
    max_containers=4,
    scaledown_window=60,
    timeout=60 * 60,
    retries=1,
)
def render_worker(manifest: dict) -> dict:
    """Render one immutable manifest; callers retain its jobId as authority."""
    job_id = manifest.get("jobId")
    if not isinstance(job_id, str) or not job_id.strip():
        raise ValueError("Render manifest requires a non-empty jobId.")

    output_dir = ARTIFACT_ROOT / "media"
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="prometheus-render-") as temp_dir:
        manifest_path = Path(temp_dir) / "manifest.json"
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        completed = subprocess.run(
            [
                "npx",
                "tsx",
                "scripts/render-manifest.ts",
                str(manifest_path),
                str(output_dir),
            ],
            cwd=WORKER_ROOT,
            env=os.environ.copy(),
            capture_output=True,
            text=True,
            check=True,
            timeout=55 * 60,
        )

    result = json.loads(completed.stdout.strip().splitlines()[-1])
    output_path = Path(result["outputPath"])
    artifacts.commit()
    return {
        "jobId": job_id,
        "status": "completed",
        "outputFile": output_path.name,
    }


@app.function(
    image=matte_image,
    secrets=[shared_secrets, backend_secrets],
    volumes={str(ARTIFACT_ROOT): artifacts},
    gpu="L4",
    cpu=4,
    memory=16384,
    min_containers=0,
    max_containers=8,
    scaledown_window=60,
    timeout=15 * 60,
    retries=1,
)
def matte_window_worker(payload: dict) -> dict:
    """Execute one cache-addressed Martin window on an independently scalable GPU."""
    artifacts.reload()
    job_id = payload["jobId"]
    window = payload["window"]
    cache_key = payload["cacheKey"]
    cached_source = Path(payload["cachedSource"])
    window_id = window["windowId"]
    source_start_ms = int(window["sourceStartMs"])
    source_end_ms = int(window["sourceEndMs"])
    cache_dir = Path(ARTIFACT_ROOT / "media" / "martin" / "cache")
    output_dir = Path(ARTIFACT_ROOT / "media" / "martin" / job_id)
    cache_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    cached_foreground = cache_dir / f"{cache_key}.webm"
    cached_receipt = cache_dir / f"{cache_key}.json"
    cache_hit = cached_foreground.exists() and cached_receipt.exists()

    if cache_hit:
        receipt = json.loads(cached_receipt.read_text(encoding="utf-8"))
    else:
        from rvm_pipeline.extract import extract_matte

        result = extract_matte(
            job_id=f"{job_id}-{window_id}",
            input_url=str(cached_source),
            start_seconds=source_start_ms / 1000,
            max_duration_seconds=(source_end_ms - source_start_ms) / 1000,
        )
        matte_source = Path(result.matte_url.removeprefix("file://"))
        shutil.copyfile(matte_source, cached_foreground)
        receipt = {
            "fps": result.fps,
            "width": result.width,
            "height": result.height,
            "durationInFrames": result.duration_in_frames,
        }
        cached_receipt.write_text(json.dumps(receipt, sort_keys=True), encoding="utf-8")

    foreground_name = f"{window_id}.webm"
    foreground_path = output_dir / foreground_name
    shutil.copyfile(cached_foreground, foreground_path)
    artifacts.commit()
    return {
        "windowId": window_id,
        "foregroundFile": str(PurePosixPath("martin") / job_id / foreground_name),
        "sourceStartMs": source_start_ms,
        "sourceEndMs": source_end_ms,
        "outputStartMs": int(window.get("outputStartMs", source_start_ms)),
        "outputEndMs": int(window.get("outputEndMs", source_end_ms)),
        **receipt,
        "cacheKey": cache_key,
        "cacheHit": cache_hit,
    }


@app.function(
    image=matte_image,
    secrets=[shared_secrets, backend_secrets],
    volumes={str(ARTIFACT_ROOT): artifacts},
    cpu=2,
    memory=2048,
    min_containers=0,
    max_containers=20,
    scaledown_window=30,
    timeout=15 * 60,
    retries=1,
)
def matte_worker(request: dict) -> dict:
    """Validate, cache the source once, and fan merged windows across GPU workers."""
    if request.get("requestKind") != "martin_matte_batch":
        raise ValueError("Matting worker requires a Martin matte batch request.")
    job_id = request.get("jobId")
    source = request.get("source")
    windows = request.get("windows")
    if not isinstance(job_id, str) or not job_id.strip():
        raise ValueError("Matting request requires a non-empty jobId.")
    if not isinstance(source, dict) or not isinstance(source.get("inputUrl"), str):
        raise ValueError("Matting request requires source.inputUrl.")
    if not isinstance(windows, list) or not windows:
        raise ValueError("Matting request requires at least one merged window.")

    from rvm_pipeline.extract import download_input

    source_sha = str(source.get("sha256", "")).lower()
    source_cache_dir = Path(ARTIFACT_ROOT / "media" / "martin" / "sources")
    source_cache_dir.mkdir(parents=True, exist_ok=True)
    cached_source = source_cache_dir / f"{source_sha}.mp4"
    if not cached_source.exists():
        with tempfile.TemporaryDirectory(prefix="prometheus-martin-source-") as temp_dir:
            downloaded_source = Path(temp_dir) / "source.mp4"
            download_input(source["inputUrl"], downloaded_source)
            actual_sha = hashlib.sha256(downloaded_source.read_bytes()).hexdigest()
            if actual_sha != source_sha:
                raise ValueError("Matting source SHA-256 does not match the declared source.")
            shutil.copyfile(downloaded_source, cached_source)
        artifacts.commit()

    payloads = []
    for index, window in enumerate(windows):
        window_id = window.get("windowId") or f"martin-window-{index + 1}"
        source_start_ms = int(window.get("sourceStartMs", -1))
        source_end_ms = int(window.get("sourceEndMs", -1))
        if source_start_ms < 0 or source_end_ms <= source_start_ms:
            raise ValueError(f"Invalid source interval for {window_id}.")
        normalized_window = {**window, "windowId": window_id}
        cache_key = hashlib.sha256(
            f"{source_sha}:{source_start_ms}:{source_end_ms}:rvm-resnet50-v2".encode("utf-8")
        ).hexdigest()
        payloads.append({
            "jobId": job_id,
            "window": normalized_window,
            "cacheKey": cache_key,
            "cachedSource": str(cached_source),
        })

    receipts = list(matte_window_worker.map(payloads, order_outputs=True))
    return {"jobId": job_id, "status": "completed", "windows": receipts}
