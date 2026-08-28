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
    .env(
        {
            "NVIDIA_DRIVER_CAPABILITIES": "all",
            "REMOTION_CHROMIUM_HEADLESS_MODE": "new",
        }
    )
    .apt_install(
        "ca-certificates",
        "ffmpeg",
        "fontconfig",
        "fonts-liberation",
        "libasound2",
        "libnss3",
        "libnspr4",
        "libatk1.0-0",
        "libatk-bridge2.0-0",
        "libcups2",
        "libdrm2",
        "libxkbcommon0",
        "libxcomposite1",
        "libxdamage1",
        "libxrandr2",
        "libgbm1",
        "libxshmfence1",
        "libegl1",
        "libgl1-mesa-dri",
        "libgl1-mesa-glx",
        "libgles2",
        "libvulkan1",
    )
    .pip_install("numpy==1.26.4", "boto3", "mediapipe==0.10.21", "opencv-python-headless==4.11.0.86")
    .run_commands(
        "npm install -g tsx@4.22.4",
        f"mkdir -p {APP_ROOT / 'remotion-app/node_modules/@remotion/compositor-linux-x64-gnu'}",
        "ln -sf $(command -v ffmpeg) "
        f"{APP_ROOT / 'remotion-app/node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg'}",
    )
    .add_local_file(local("mini_run_gateway.py"), f"{APP_ROOT}/mini_run_gateway.py", copy=True)
    .add_local_dir(local("mini_run_pipeline"), f"{APP_ROOT}/mini_run_pipeline", copy=True, ignore=source_ignore)
    .add_local_dir(local("remotion-app"), f"{APP_ROOT}/remotion-app", copy=True, ignore=source_ignore)
    .add_local_dir(local("packages"), f"{APP_ROOT}/packages", copy=True, ignore=source_ignore)
    .add_local_dir(local("backend"), f"{APP_ROOT}/backend", copy=True, ignore=source_ignore)
    .add_local_dir(local("docs/mini_run_studio"), f"{STUDIO_ROOT}", copy=True, ignore=source_ignore)
    .add_local_dir(local("SOUND FX"), f"{APP_ROOT / 'SOUND FX'}", copy=True)
    .add_local_dir(local("LANDSCAPE VIDEOS FOR USE"), f"{APP_ROOT / 'LANDSCAPE VIDEOS FOR USE'}", copy=True)
    .add_local_dir(local("docs/mini_run_studio"), f"{APP_ROOT / 'docs/mini_run_studio'}", copy=True)
    .add_local_dir(local("Yuan Prometheus Screenshots"), f"{APP_ROOT / 'Yuan Prometheus Screenshots'}", copy=True)
    .add_local_file(local("package.json"), f"{APP_ROOT}/package.json", copy=True)
    .add_local_file(local("package-lock.json"), f"{APP_ROOT}/package-lock.json", copy=True)
    .run_commands(
        f"cd {APP_ROOT} && npm install --legacy-peer-deps",
        f"cd {APP_ROOT}/remotion-app && npm install --legacy-peer-deps",
        f"cd {APP_ROOT}/remotion-app && npx remotion bundle src/index.ts /opt/prometheus/remotion-bundle",
    )
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


@app.function(
    image=studio_image,
    secrets=[shared_secrets, backend_secrets],
    volumes={str(ARTIFACT_ROOT): artifacts},
    cpu=8,
    memory=8192,
    min_containers=0,
    max_containers=32,
    scaledown_window=300,
    timeout=5 * 60,
)
def render_remotion_slice(slice_spec: dict) -> dict:
    """Render one frame-range slice of the Remotion composition on a dedicated high-CPU container."""
    import os
    import json
    import time
    import shutil
    import subprocess
    from pathlib import Path

    try:
        artifacts.reload()
    except Exception:
        pass

    slice_index = slice_spec["sliceIndex"]
    start_frame = slice_spec["startFrame"]
    end_frame = slice_spec["endFrame"]
    output_slice_path = Path(slice_spec["outputSlicePath"])
    props = slice_spec.get("props") or {}
    job_id = slice_spec.get("jobId", "job")
    dest_video_path = slice_spec.get("destVideoPath")
    dest_matte_path = slice_spec.get("destMattePath")

    output_slice_path.parent.mkdir(parents=True, exist_ok=True)
    remotion_app_dir = Path("/opt/prometheus/remotion-app")
    public_source_dir = remotion_app_dir / "public" / "source"
    public_source_dir.mkdir(parents=True, exist_ok=True)

    # Ensure source video & matte are present in remotion-app/public/source directory
    if dest_video_path:
        found_video = False
        for attempt in range(40):
            try:
                artifacts.reload()
            except Exception:
                pass
            p = Path(dest_video_path)
            if p.exists() and p.stat().st_size > 0:
                found_video = True
                break
            time.sleep(0.3)

        if not found_video:
            raise FileNotFoundError(f"[slice {slice_index}] dest_video_path not found on volume: {dest_video_path}")

        src_name = Path(dest_video_path).name
        target = public_source_dir / src_name
        if not target.exists() or target.stat().st_size != Path(dest_video_path).stat().st_size:
            shutil.copyfile(dest_video_path, target)

    if dest_matte_path:
        found_matte = False
        for attempt in range(40):
            try:
                artifacts.reload()
            except Exception:
                pass
            p = Path(dest_matte_path)
            if p.exists() and p.stat().st_size > 0:
                found_matte = True
                break
            time.sleep(0.3)

        if not found_matte:
            raise FileNotFoundError(f"[slice {slice_index}] dest_matte_path not found on volume: {dest_matte_path}")

        matte_name = Path(dest_matte_path).name
        target_matte = public_source_dir / matte_name
        if not target_matte.exists() or target_matte.stat().st_size != Path(dest_matte_path).stat().st_size:
            shutil.copyfile(dest_matte_path, target_matte)

    tmp_build = Path("/tmp/mini_run_build")
    tmp_build.mkdir(parents=True, exist_ok=True)
    props_path = tmp_build / f"props_{job_id}_slice_{slice_index}.json"
    props_path.write_text(json.dumps(props, indent=2))

    entry_target = "src/index.ts"

    cmd = [
        "npx", "remotion", "render",
        entry_target, "PrometheusMinRun",
        str(output_slice_path),
        "--props", str(props_path),
        f"--frames={start_frame}-{end_frame}",
        "--concurrency", "8",
        "--gl", "swangle",
        "--pixel-format", "yuv420p",
        "--jpeg-quality", "90",
        "--muted",
        "--timeout", "90000",
    ]

    t0 = time.monotonic()
    env = {**os.environ, "TMPDIR": str(tmp_build)}
    res = subprocess.run(cmd, cwd=str(remotion_app_dir), capture_output=True, text=True, env=env)
    dur = time.monotonic() - t0

    if res.returncode != 0:
        print(
            f"[modal_mini_run] Slice {slice_index} render failed (exit {res.returncode}) in {dur:.2f}s:\n"
            f"STDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}",
            flush=True,
        )
        raise RuntimeError(f"Remotion slice {slice_index} render failed with exit code {res.returncode}")

    print(f"[modal_mini_run] Slice {slice_index} rendered in {dur:.2f}s (exit {res.returncode})", flush=True)
    return {
        "sliceIndex": slice_index,
        "outputSlicePath": str(output_slice_path),
        "startFrame": start_frame,
        "endFrame": end_frame,
        "exitCode": res.returncode,
        "durationSec": dur,
    }


@app.function(
    image=studio_image,
    secrets=[shared_secrets, backend_secrets],
    volumes={ARTIFACT_ROOT: artifacts},
    timeout=600,
    cpu=4.0,
    memory=8192,
)
def run_mini_run(payload: dict) -> dict:
    import time
    from mini_run_pipeline import pipeline

    job_id = payload.get("jobId") or f"modal_mini_run_{int(time.time())}"
    artifact_root = payload.get("artifactRoot") or str(ARTIFACT_ROOT)

    def modal_slice_executor(slices: list[dict]) -> list[dict]:
        print(
            f"[modal_mini_run] Committing volume and dispatching {len(slices)} parallel CPU slices...",
            flush=True,
        )
        try:
            artifacts.commit()
        except Exception:
            pass
        time.sleep(1.0)

        t_start = time.monotonic()
        results = list(render_remotion_slice.map(slices))
        t_elapsed = time.monotonic() - t_start
        try:
            artifacts.reload()
        except Exception:
            pass
        print(
            f"[modal_mini_run] All {len(slices)} slices completed in parallel in {t_elapsed:.2f}s!",
            flush=True,
        )
        return results

    return pipeline.execute_pipeline_job(
        job_id=job_id,
        data=payload,
        artifact_root=artifact_root,
        slice_executor=modal_slice_executor,
    )
