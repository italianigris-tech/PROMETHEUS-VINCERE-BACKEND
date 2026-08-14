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
import math
import os
import shutil
import subprocess
import tempfile
import threading
import time
import urllib.request
import uuid

import modal


APP_NAME = "prometheus-backend"
APP_ROOT = PurePosixPath("/opt/prometheus")
BACKEND_ROOT = APP_ROOT / "backend"
WORKER_ROOT = APP_ROOT / "apps/worker"
RVM_ROOT = APP_ROOT / "packages/rvm-pipeline"
ARTIFACT_ROOT = PurePosixPath("/data")
PORT = 8000
MAUL_FRAMES_PER_SLICE = 12
MAUL_MAX_PARALLEL_SLICES = 8

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
    .run_commands(
        f"cp -a {APP_ROOT}/remotion-app/public/. {WORKER_ROOT}/public/",
        f"ln -s {WORKER_ROOT}/node_modules {APP_ROOT}/remotion-app/node_modules",
        f"cd {WORKER_ROOT} && mkdir -p .cache && npx remotion bundle src/remotion-entry.tsx --out-dir .cache/joseph-remotion-bundle",
        f"cd {WORKER_ROOT} && npx remotion bundle ../../remotion-app/src/entries/maul-entry.tsx --out-dir .cache/maul-remotion-bundle",
    )
    .env(
        {
            "NODE_ENV": "production",
            "REMOTION_CHROMIUM_HEADLESS_MODE": "new",
            "REMOTION_BUNDLE_DIR": f"{WORKER_ROOT}/.cache/joseph-remotion-bundle",
            "MAUL_REMOTION_BUNDLE_DIR": f"{WORKER_ROOT}/.cache/maul-remotion-bundle",
            "NVIDIA_DRIVER_CAPABILITIES": "compute,video,utility",
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


def assert_nvenc_available() -> None:
    """Fail before rendering when image or assigned GPU cannot run NVENC."""
    encoders = subprocess.run(
        ["ffmpeg", "-hide_banner", "-encoders"],
        capture_output=True,
        text=True,
        check=True,
        timeout=30,
    )
    if "h264_nvenc" not in encoders.stdout:
        raise RuntimeError("Modal render image is missing FFmpeg h264_nvenc support.")
    gpu = subprocess.run(
        ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
        capture_output=True,
        text=True,
        check=True,
        timeout=30,
    )
    if not gpu.stdout.strip():
        raise RuntimeError("Modal render worker has no visible NVIDIA GPU.")


def run_render_command(args: list[str], timeout: int) -> dict:
    """Run a renderer and retain enough subprocess evidence to diagnose failures."""
    completed = subprocess.run(
        args,
        cwd=WORKER_ROOT,
        env=os.environ.copy(),
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if completed.returncode != 0:
        stdout = completed.stdout[-8000:].strip()
        stderr = completed.stderr[-8000:].strip()
        raise RuntimeError(
            f"Render command failed ({completed.returncode}). stdout={stdout!r} stderr={stderr!r}"
        )
    return json.loads(completed.stdout.strip().splitlines()[-1])


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
                pipeline = payload.get("pipeline")
                pipeline_job_id = payload.get("pipelineJobId")
                manifest = payload.get("manifest")
                if not isinstance(manifest, dict):
                    raise ValueError("Render dispatch requires a manifest object.")
                if not isinstance(pipeline_job_id, str) or not pipeline_job_id.strip():
                    raise ValueError("Render dispatch requires pipelineJobId.")
                if pipeline == "maul":
                    replay_key = manifest.get("replayKey")
                    expected_job_id = f"maul:{replay_key}"
                    if not isinstance(replay_key, str) or pipeline_job_id != expected_job_id:
                        raise ValueError("MAUL pipelineJobId must match manifest replayKey.")
                    call = maul_render_worker.spawn(manifest, pipeline_job_id)
                elif pipeline == "joseph":
                    job_id = manifest.get("jobId")
                    expected_job_id = f"joseph:{job_id}"
                    if not isinstance(job_id, str) or pipeline_job_id != expected_job_id:
                        raise ValueError("Joseph pipelineJobId must match manifest jobId.")
                    call = render_worker.spawn(manifest, pipeline_job_id)
                else:
                    raise ValueError("Render dispatch pipeline must be 'maul' or 'joseph'.")
            response = {"callId": call.object_id, "status": "queued"}
            if self.path == "/spawn":
                response.update({"pipeline": pipeline, "pipelineJobId": pipeline_job_id})
            self._send_json(202, response)
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
    gpu="L4",
    cpu=8,
    memory=16384,
    min_containers=0,
    max_containers=100,
    scaledown_window=60,
    timeout=15 * 60,
    retries=1,
)
def maul_frame_slice_worker(payload: dict) -> dict:
    """Render one quota-matched MAUL frame interval with parallel Chrome and NVENC."""
    started_at = time.monotonic()
    manifest = payload.get("manifest")
    pipeline_job_id = payload.get("pipelineJobId")
    batch_id = payload.get("batchId")
    slice_index = payload.get("sliceIndex")
    start_frame = payload.get("startFrame")
    end_frame = payload.get("endFrame")
    if not isinstance(manifest, dict):
        raise ValueError("MAUL slice requires manifest.")
    replay_key = manifest.get("replayKey")
    if pipeline_job_id != f"maul:{replay_key}":
        raise ValueError("MAUL slice received a mismatched pipelineJobId.")
    if not isinstance(batch_id, str) or len(batch_id) != 32 or not batch_id.isalnum():
        raise ValueError("MAUL slice requires a safe batchId.")
    if not all(isinstance(value, int) for value in (slice_index, start_frame, end_frame)):
        raise ValueError("MAUL slice frame coordinates must be integers.")
    if slice_index < 0 or start_frame < 0 or end_frame < start_frame:
        raise ValueError("MAUL slice frame interval is invalid.")

    assert_nvenc_available()
    artifacts.reload()
    with tempfile.TemporaryDirectory(prefix="prometheus-maul-slice-") as temp_dir:
        manifest_path = Path(temp_dir) / "manifest.json"
        scratch_dir = Path(temp_dir) / "output"
        scratch_dir.mkdir()
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        result = run_render_command(
            [
                "npx", "tsx", "scripts/render-maul-slice.ts",
                str(manifest_path), str(scratch_dir), str(start_frame), str(end_frame),
                "h264_nvenc",
            ],
            timeout=12 * 60,
        )
        segment_bytes = Path(result["outputPath"]).read_bytes()
    return {
        "sliceIndex": slice_index,
        "startFrame": start_frame,
        "endFrame": end_frame,
        "segmentBytes": segment_bytes,
        "encoder": "h264_nvenc",
        "elapsedMs": round((time.monotonic() - started_at) * 1000),
    }


@app.function(
    image=worker_image,
    secrets=[shared_secrets, backend_secrets],
    volumes={str(ARTIFACT_ROOT): artifacts},
    gpu="L4",
    cpu=8,
    memory=16384,
    min_containers=0,
    max_containers=4,
    scaledown_window=60,
    timeout=60 * 60,
    retries=1,
)
def render_worker(manifest: dict, pipeline_job_id: str) -> dict:
    """Render one immutable Joseph manifest."""
    job_id = manifest.get("jobId")
    if not isinstance(job_id, str) or not job_id.strip():
        raise ValueError("Render manifest requires a non-empty jobId.")
    if pipeline_job_id != f"joseph:{job_id}":
        raise ValueError("Joseph worker received a mismatched pipelineJobId.")

    assert_nvenc_available()

    output_dir = ARTIFACT_ROOT / "media"
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="prometheus-render-") as temp_dir:
        manifest_path = Path(temp_dir) / "manifest.json"
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        result = run_render_command(
            [
                "npx",
                "tsx",
                "scripts/render-manifest.ts",
                str(manifest_path),
                str(output_dir),
            ],
            timeout=55 * 60,
        )
    output_path = Path(result["outputPath"])
    artifacts.commit()
    return {
        "pipeline": "joseph",
        "pipelineJobId": pipeline_job_id,
        "jobId": job_id,
        "status": "completed",
        "outputFile": output_path.name,
        "encoder": result.get("encoder", "h264_nvenc"),
    }


@app.function(
    image=worker_image,
    secrets=[shared_secrets, backend_secrets],
    volumes={str(ARTIFACT_ROOT): artifacts},
    cpu=8,
    memory=16384,
    min_containers=0,
    max_containers=20,
    scaledown_window=60,
    timeout=60 * 60,
    retries=1,
)
def maul_render_worker(manifest: dict, pipeline_job_id: str) -> dict:
    """Fan one immutable MAUL manifest across true twelve-frame workers."""
    started_at = time.monotonic()
    replay_key = manifest.get("replayKey")
    if not isinstance(replay_key, str) or not replay_key.strip():
        raise ValueError("MAUL render manifest requires replayKey.")
    if pipeline_job_id != f"maul:{replay_key}":
        raise ValueError("MAUL worker received a mismatched pipelineJobId.")

    output_dir = Path(ARTIFACT_ROOT / "media")
    output_dir.mkdir(parents=True, exist_ok=True)
    output = manifest.get("output")
    timeline = manifest.get("timeline")
    if not isinstance(output, dict) or not isinstance(timeline, dict):
        raise ValueError("MAUL render requires output and timeline contracts.")
    fps = output.get("fps")
    duration_ms = timeline.get("outputDurationMs")
    if not isinstance(fps, (int, float)) or not isinstance(duration_ms, (int, float)):
        raise ValueError("MAUL render requires numeric fps and outputDurationMs.")
    total_frames = max(1, int(duration_ms / 1000 * fps + 0.5))
    batch_id = uuid.uuid4().hex
    slice_count = min(
        MAUL_MAX_PARALLEL_SLICES,
        max(1, math.ceil(total_frames / MAUL_FRAMES_PER_SLICE)),
    )
    frames_per_slice = math.ceil(total_frames / slice_count)
    payloads = []
    for slice_index, start_frame in enumerate(range(0, total_frames, frames_per_slice)):
        payloads.append({
            "manifest": manifest,
            "pipelineJobId": pipeline_job_id,
            "batchId": batch_id,
            "sliceIndex": slice_index,
            "startFrame": start_frame,
            "endFrame": min(total_frames - 1, start_frame + frames_per_slice - 1),
        })

    with tempfile.TemporaryDirectory(prefix="prometheus-maul-assemble-") as temp_dir:
        scratch_dir = Path(temp_dir)
        manifest_path = scratch_dir / "manifest.json"
        concat_path = scratch_dir / "segments.txt"
        silent_path = scratch_dir / "silent.mp4"
        final_path = scratch_dir / f"maul_{replay_key}-final.mp4"
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

        fanout_started_at = time.monotonic()
        slice_calls = [maul_frame_slice_worker.spawn(payload) for payload in payloads]
        audio_started_at = time.monotonic()
        audio_result = run_render_command(
            ["npx", "tsx", "scripts/render-maul-audio.ts", str(manifest_path), str(scratch_dir)],
            timeout=15 * 60,
        )
        audio_ms = round((time.monotonic() - audio_started_at) * 1000)
        receipts = [call.get() for call in slice_calls]
        fanout_ms = round((time.monotonic() - fanout_started_at) * 1000)

        segment_paths = []
        for receipt in receipts:
            segment_path = scratch_dir / f"segment-{receipt['sliceIndex']:05d}.mp4"
            segment_path.write_bytes(receipt["segmentBytes"])
            segment_paths.append(segment_path)
        concat_path.write_text(
            "\n".join(f"file '{segment_path}'" for segment_path in segment_paths) + "\n",
            encoding="utf-8",
        )
        concat_started_at = time.monotonic()
        subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error",
                "-f", "concat", "-safe", "0", "-i", str(concat_path),
                "-c", "copy", "-y", str(silent_path),
            ],
            check=True,
            timeout=5 * 60,
        )
        concat_ms = round((time.monotonic() - concat_started_at) * 1000)
        mux_started_at = time.monotonic()
        subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error",
                "-i", str(silent_path), "-i", audio_result["outputPath"],
                "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
                "-c:a", "aac", "-b:a", "320k", "-shortest",
                "-movflags", "+faststart", "-y", str(final_path),
            ],
            check=True,
            timeout=5 * 60,
        )
        output_path = output_dir / final_path.name
        with tempfile.NamedTemporaryFile(
            prefix=f".{final_path.stem}-",
            suffix=final_path.suffix,
            dir=output_dir,
            delete=False,
        ) as publish_file:
            publish_path = Path(publish_file.name)
        try:
            shutil.copyfile(final_path, publish_path)
            os.replace(publish_path, output_path)
        finally:
            publish_path.unlink(missing_ok=True)
        mux_publish_ms = round((time.monotonic() - mux_started_at) * 1000)
    artifacts.commit()
    warnings = manifest.get("plans", {}).get("typographyMotion", {}).get("warnings", [])
    fallback_audit = manifest.get("fallbackAudit", None)
    return {
        "pipeline": "maul",
        "pipelineJobId": pipeline_job_id,
        "status": "completed",
        "outputFile": output_path.name,
        "encoder": "h264_nvenc",
        "frameSlices": len(payloads),
        "fallbackAudit": fallback_audit,
        "warnings": warnings,
        "stageTimingsMs": {
            "fanout": fanout_ms,
            "concat": concat_ms,
            "audio": audio_ms,
            "muxPublish": mux_publish_ms,
            "sliceMin": min(receipt["elapsedMs"] for receipt in receipts),
            "sliceMax": max(receipt["elapsedMs"] for receipt in receipts),
            "sliceAverage": round(
                sum(receipt["elapsedMs"] for receipt in receipts) / len(receipts)
            ),
            "total": round((time.monotonic() - started_at) * 1000),
        },
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
