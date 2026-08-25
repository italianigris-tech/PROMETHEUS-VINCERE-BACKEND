"""Prometheus Mini-Run Studio — Modal pipeline gateway.

Pipeline endpoints:
    GET  /health
    POST /api/pipeline/transcribe    AssemblyAI words + text for a local file/URL
    POST /api/pipeline/chunk         3-word-priority transcript chunking (max 5)
    POST /api/pipeline/video_chunker FFmpeg break of the video into parts
    POST /api/pipeline/matte         FFmpeg segment cut (+buffer) -> RVM matte_worker
    POST /api/pipeline/render        Enqueue a full 9:16 mini-run render (transcribe ->
                                     editorial timeline -> typography burn -> H.264 encode)
    GET  /api/pipeline/job/<jobId>   Poll a render's status/progress and final MP4 URL

Everything else is proxied to the Node studio on 127.0.0.1:<node_studio_port>.
"""

from __future__ import annotations

import hashlib
import http.client
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

NODE_STUDIO_HOST = "127.0.0.1"
DEFAULT_NODE_STUDIO_PORT = 8081
DEFAULT_GATEWAY_PORT = 8080
DEFAULT_STUDIO_DIR = "/opt/prometheus/docs/mini_run_studio"
DEFAULT_ARTIFACT_ROOT = "/data"

ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com/v2"
ASSEMBLYAI_TRANSCRIPT = {"speech_model": "best"}
MATTE_APP = os.getenv("MINI_RUN_MATTE_APP", "prometheus-backend")
MATTE_WORKER_NAME = os.getenv("MINI_RUN_MATTE_WORKER", "matte_worker")

STUDIO_DIR = Path(os.getenv("MINI_RUN_STUDIO_DIR", DEFAULT_STUDIO_DIR))
ARTIFACT_ROOT = Path(os.getenv("MINI_RUN_ARTIFACT_ROOT", DEFAULT_ARTIFACT_ROOT))

# ---------------------------------------------------------------------------
# Deterministic transcript chunker (3-word priority, max 5)
# ---------------------------------------------------------------------------

MAX_CHUNK_WORDS = 5
TARGET_CHUNK_WORDS = 3


def chunk_transcript_words(
    words: list[dict[str, Any]], max_chunk_words: int = MAX_CHUNK_WORDS
) -> list[dict[str, Any]]:
    """Greedy 3-word-priority chunker over word-timed transcript words."""
    if not words:
        return []
    normalized: list[dict[str, Any]] = []
    for word in words:
        start_ms = int(word.get("start_ms", word.get("start", 0)))
        end_ms = int(word.get("end_ms", word.get("end", 0)))
        normalized.append({
            "text": str(word.get("text", "")).strip(),
            "start_ms": start_ms,
            "end_ms": max(end_ms, start_ms + 1),
            "confidence": float(word.get("confidence", 1.0)),
        })
    chunks: list[dict[str, Any]] = []
    index = 0
    chunk_index = 1
    total = len(normalized)
    while index < total:
        remaining = total - index
        if remaining <= max_chunk_words:
            take = remaining
        else:
            take = TARGET_CHUNK_WORDS
            if remaining - take == 1 and take < max_chunk_words:
                take = min(take + 1, max_chunk_words)
        selected = normalized[index:index + take]
        index += take
        start_ms = selected[0]["start_ms"]
        end_ms = selected[-1]["end_ms"]
        chunks.append({
            "chunkIndex": chunk_index,
            "startMs": start_ms,
            "endMs": end_ms,
            "startSec": round(start_ms / 1000.0, 3),
            "endSec": round(end_ms / 1000.0, 3),
            "wordCount": len(selected),
            "text": " ".join(item["text"] for item in selected),
            "words": selected,
        })
        chunk_index += 1
    return chunks

# ---------------------------------------------------------------------------
# AssemblyAI transcription (mirrors backend/src/integrations/assemblyai.ts)
# ---------------------------------------------------------------------------


def _assemblyai_upload(api_key: str, file_path: Path) -> str:
    with file_path.open("rb") as handle:
        payload = handle.read()
    request = urllib.request.Request(
        f"{ASSEMBLYAI_BASE_URL}/upload",
        data=payload,
        headers={"authorization": api_key, "content-type": "application/octet-stream"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        body = json.loads(response.read())
    return str(body["upload_url"])


def _assemblyai_create_transcript(api_key: str, audio_url: str) -> str:
    request = urllib.request.Request(
        f"{ASSEMBLYAI_BASE_URL}/transcript",
        data=json.dumps({"audio_url": audio_url, **ASSEMBLYAI_TRANSCRIPT}).encode("utf-8"),
        headers={"authorization": api_key, "content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        body = json.loads(response.read())
    return str(body["id"])


def _assemblyai_poll(api_key, transcript_id, poll_interval_ms=2500, max_attempts=240):
    for _ in range(max_attempts):
        request = urllib.request.Request(
            f"{ASSEMBLYAI_BASE_URL}/transcript/{transcript_id}",
            headers={"authorization": api_key},
            method="GET",
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            transcript = json.loads(response.read())
        status = transcript.get("status")
        if status == "completed":
            words = transcript.get("words") or []
            return [
                {
                    "text": str(word.get("text", "")).strip(),
                    "start_ms": int(word.get("start", 0)),
                    "end_ms": int(word.get("end", 0)),
                    "confidence": float(word.get("confidence", 1.0)),
                }
                for word in words
            ]
        if status == "error":
            raise RuntimeError(f"AssemblyAI transcription error: {transcript.get('error')}")
        time.sleep(poll_interval_ms / 1000.0)
    raise TimeoutError("AssemblyAI transcription did not complete in time.")


def transcribe_assemblyai(api_key: str, file_path: Path, poll_interval_ms=2500, max_attempts=240):
    upload_url = _assemblyai_upload(api_key, file_path)
    transcript_id = _assemblyai_create_transcript(api_key, upload_url)
    words = _assemblyai_poll(api_key, transcript_id, poll_interval_ms, max_attempts)
    return {
        "provider": "assemblyai",
        "transcriptId": transcript_id,
        "text": " ".join(word["text"] for word in words),
        "words": words,
        "chunks": chunk_transcript_words(words),
    }


# ---------------------------------------------------------------------------
# FFmpeg helpers
# ---------------------------------------------------------------------------


def _run_ffmpeg(args: list[str], timeout: int = 300) -> None:
    completed = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if completed.returncode != 0:
        stderr = completed.stderr.strip() or completed.stdout.strip()
        raise RuntimeError(f"ffmpeg failed ({' '.join(args)}): {stderr[-4000:]}")


def _sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _resolve_source(path_or_url: str):
    """Return (local_path, sha256_or_None). Downloads http(s) to a temp file."""
    parsed = urllib.parse.urlparse(path_or_url)
    if parsed.scheme in ("http", "https"):
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as handle:
            destination = Path(handle.name)
        urllib.request.urlretrieve(path_or_url, str(destination))
        return destination, _sha256_of(destination)
    local_path = Path(path_or_url)
    if not local_path.exists():
        raise FileNotFoundError(f"source does not exist: {local_path}")
    return local_path, None


def cut_segment(source_path: Path, start_sec: float, end_sec: float, output_path: Path, buffer_sec: float = 0.0) -> None:
    """FFmpeg-cut [start-buffer, end+buffer] out of the source (frame-exact)."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cut_start = max(0.0, start_sec - buffer_sec)
    duration = max(0.1, (end_sec + buffer_sec) - cut_start)
    _run_ffmpeg([
        "ffmpeg", "-y", "-loglevel", "error",
        "-ss", f"{cut_start:.3f}", "-t", f"{duration:.3f}",
        "-i", str(source_path),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(output_path),
    ])

# ---------------------------------------------------------------------------
# Pipeline handlers
# ---------------------------------------------------------------------------


def handle_transcribe(payload: dict[str, Any]) -> dict[str, Any]:
    api_key = os.getenv("ASSEMBLYAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("ASSEMBLYAI_API_KEY is not configured in the Modal secret.")
    file_path = payload.get("filePath")
    input_url = payload.get("inputUrl")
    if not file_path and not input_url:
        raise ValueError("transcribe requires filePath or inputUrl.")
    if input_url:
        source, _ = _resolve_source(str(input_url))
    else:
        source = Path(str(file_path))
        if not source.exists():
            raise FileNotFoundError(f"filePath does not exist: {source}")
    return transcribe_assemblyai(
        api_key,
        source,
        poll_interval_ms=int(payload.get("pollIntervalMs", 2500)),
        max_attempts=int(payload.get("maxPollAttempts", 240)),
    )


def handle_chunk(payload: dict[str, Any]) -> dict[str, Any]:
    words = payload.get("words")
    if not isinstance(words, list) or not words:
        raise ValueError("chunk requires a non-empty words list.")
    chunks = chunk_transcript_words(words, int(payload.get("maxChunkWords", MAX_CHUNK_WORDS)))
    return {
        "strategy": "deterministic_fallback",
        "maxChunkWords": MAX_CHUNK_WORDS,
        "chunkCount": len(chunks),
        "chunks": chunks,
    }



def handle_video_chunker(payload: dict[str, Any]) -> dict[str, Any]:
    source_path = payload.get("sourcePath") or payload.get("filePath")
    input_url = payload.get("inputUrl")
    if not source_path and not input_url:
        raise ValueError("video_chunker requires sourcePath or inputUrl.")
    boundaries = payload.get("boundaries")
    if not isinstance(boundaries, list) or not boundaries:
        raise ValueError("video_chunker requires boundaries [{startSec,endSec}, ...].")
    buffer_sec = float(payload.get("bufferSec", 0.0))
    if input_url:
        source, source_sha = _resolve_source(str(input_url))
    else:
        source = Path(str(source_path))
        if not source.exists():
            raise FileNotFoundError(f"sourcePath does not exist: {source}")
        source_sha = _sha256_of(source)
    job_id = str(payload.get("jobId") or f"chunk-{uuid.uuid4().hex[:10]}")
    output_root = ARTIFACT_ROOT / "media" / "mini-run" / "chunks" / job_id
    output_root.mkdir(parents=True, exist_ok=True)
    parts: list[dict[str, Any]] = []
    for index, boundary in enumerate(boundaries):
        part_id = str(boundary.get("partId") or f"part-{index + 1}")
        start_sec = float(boundary["startSec"])
        end_sec = float(boundary["endSec"])
        part_path = output_root / f"{part_id}.mp4"
        cut_segment(source, start_sec, end_sec, part_path, buffer_sec=buffer_sec)
        parts.append(
            {
                "partId": part_id,
                "sourceStartSec": start_sec,
                "sourceEndSec": end_sec,
                "file": str(part_path),
            }
        )
    return {"jobId": job_id, "sourceSha256": source_sha, "partCount": len(parts), "parts": parts}


def handle_matte(payload: dict[str, Any]) -> dict[str, Any]:
    """Cut the requested segment(s) and route them to the RVM matte_worker.

    FFmpeg cuts each segment with ``bufferMs`` (1-2s default per side), writes it
    into the shared artifact volume, then hands the local volume path to the
    existing prometheus-backend ``matte_worker`` (which supports plain local paths).
    Receipts carry ``outputStartMs``/``outputEndMs`` for perfect re-stitch.
    """
    import modal  # available inside the Modal function runtime

    job_id = payload.get("jobId")
    if not isinstance(job_id, str) or not job_id.strip():
        raise ValueError("matte requires a non-empty jobId.")
    source = payload.get("source")
    if not isinstance(source, dict) or not source.get("inputUrl"):
        raise ValueError("matte requires source.inputUrl.")
    windows = payload.get("windows")
    if not isinstance(windows, list) or not windows:
        raise ValueError("matte requires at least one window.")

    buffer_ms = int(payload.get("bufferMs", 1500))
    input_url = str(source["inputUrl"])
    declared_sha = str(source.get("sha256", "")).lower()

    if input_url.startswith("/") or input_url.startswith("file://"):
        local_source = Path(input_url.removeprefix("file://"))
        if not local_source.exists():
            raise FileNotFoundError(f"source does not exist: {local_source}")
        source_sha = _sha256_of(local_source)
    elif input_url.startswith(("http://", "https://")):
        local_source = Path(tempfile.mkstemp(suffix=".mp4")[1])
        urllib.request.urlretrieve(input_url, str(local_source))
        source_sha = _sha256_of(local_source)
    else:
        raise ValueError("source.inputUrl must be an absolute path or http(s) URL.")

    if declared_sha and declared_sha != source_sha:
        raise ValueError("matte source SHA-256 does not match the declared source.")

    volume_source_dir = ARTIFACT_ROOT / "media" / "mini-run" / "sources"
    volume_source_dir.mkdir(parents=True, exist_ok=True)
    volume_source = volume_source_dir / f"{job_id}.mp4"
    if not volume_source.exists():
        shutil.copyfile(local_source, volume_source)
        # Martin runs in a separate Modal app; publish this source before the
        # remote worker resolves the shared-volume path.
        modal.Volume.from_name("prometheus-render-artifacts").commit()

    expanded_windows: list[dict[str, Any]] = []
    for index, window in enumerate(windows):
        window_id = str(window.get("windowId") or f"matte-window-{index + 1}")
        source_start_ms = int(window.get("sourceStartMs", -1))
        source_end_ms = int(window.get("sourceEndMs", -1))
        if source_start_ms < 0 or source_end_ms <= source_start_ms:
            raise ValueError(f"Invalid source interval for {window_id}.")
        output_start_ms = int(window.get("outputStartMs", source_start_ms))
        output_end_ms = int(window.get("outputEndMs", source_end_ms))
        expanded_windows.append(
            {
                **window,
                "windowId": window_id,
                "sourceStartMs": max(0, source_start_ms - buffer_ms),
                "sourceEndMs": source_end_ms + buffer_ms,
                "outputStartMs": output_start_ms,
                "outputEndMs": output_end_ms,
            }
        )

    matte_worker = modal.Function.from_name(MATTE_APP, MATTE_WORKER_NAME)
    receipts = matte_worker.remote(
        {
            "requestKind": "martin_matte_batch",
            "jobId": f"mini-run-{job_id}",
            "source": {"inputUrl": str(volume_source), "sha256": source_sha},
            "windows": expanded_windows,
        }
    )
    return {
        "jobId": job_id,
        "bufferMs": buffer_ms,
        "stitch": [
            {
                "windowId": receipt.get("windowId"),
                "sourceStartMs": receipt.get("sourceStartMs"),
                "sourceEndMs": receipt.get("sourceEndMs"),
                "outputStartMs": receipt.get("outputStartMs"),
                "outputEndMs": receipt.get("outputEndMs"),
                "foregroundFile": receipt.get("foregroundFile"),
                "fps": receipt.get("fps"),
                "width": receipt.get("width"),
                "height": receipt.get("height"),
                "durationInFrames": receipt.get("durationInFrames"),
                "cacheHit": receipt.get("cacheHit"),
            }
            for receipt in (receipts.get("windows") or [])
        ],
        "status": "completed",
    }



def _pipeline_module():
    """Import the production pipeline package, path-safe on the Modal container.

    The gateway runs with cwd = APP_ROOT, where ``mini_run_pipeline`` is bundled;
    locally the repo root is already importable. Returns the package module.
    """
    import sys

    cwd = os.getcwd()
    if cwd and cwd not in sys.path:
        sys.path.insert(0, cwd)
    import mini_run_pipeline  # noqa: F401

    return mini_run_pipeline


def normalize_source(source: Any) -> Any:
    """Accept both source conventions used across the pipeline surface."""
    if isinstance(source, dict) and not any(
        key in source for key in ("path", "url", "sourceUrl", "sourcePath", "filePath")
    ):
        if source.get("inputUrl"):
            return {**source, "url": source["inputUrl"]}
    return source


def handle_render(payload: dict[str, Any]) -> dict[str, Any]:
    """Enqueue a full 9:16 mini-run render job end to end.

    Accepts ``{source, metadata, design, selectedWindow, targetChunkWords,
    maxChunkWords, jobId, audio}``. Returns ``{jobId, status, pipeline,
    pipelineJobId}`` so the caller can poll ``GET /api/pipeline/job/<jobId>``
    for progress and the final MP4 ``outputUrl``. The render runs on a worker
    thread in this gateway process: source resolved, transcript timed, dead air
    cut, studio typography burned in, optional SFX/soundtrack baked
    (``audio``: ``{music?, cueBus?}`` — see ``render.render_audio_mix``), and
    the result H.264-encoded (9:16 canvas) and mirrored to R2.
    """
    from mini_run_pipeline import pipeline as pipeline_mod
    from mini_run_pipeline.typography import resolve_typography_policy

    source = normalize_source(payload.get("source"))
    if not source:
        raise ValueError("render requires source (path or http(s) URL, or {path/url/inputUrl}).")

    metadata = dict(payload.get("metadata") or {})
    # Forward classify-relevant top-level fields into the metadata so the call is
    # routed short-form vs long-form correctly.
    for key in ("pipeline", "durationSec", "durationMs", "width", "height"):
        if payload.get(key) is not None and key not in metadata:
            metadata[key] = payload[key]

    design = payload.get("design") or {}
    if isinstance(design, dict):
        # Default the composed canvas to a 9:16 portrait output unless the caller
        # supplies explicit canvas dimensions (MUST be portrait aspect for shorts).
        design = dict(design)
        design.pop("seed", None)
        if not design.get("canvasWidth") and not design.get("canvasHeight"):
            design["canvasWidth"] = 1080
            design["canvasHeight"] = 1920
        design.update(resolve_typography_policy(design))

    options = {
        "design": design,
        "audio": payload.get("audio"),
        "selectedWindow": payload.get("selectedWindow"),
        "targetChunkWords": payload.get("targetChunkWords"),
        "maxChunkWords": payload.get("maxChunkWords"),
    }
    options = {key: value for key, value in options.items() if value is not None}

    return pipeline_mod.create_pipeline_job(
        source,
        job_id=payload.get("jobId"),
        metadata=metadata,
        options=options,
        artifact_root=str(ARTIFACT_ROOT),
        start_worker=True,
    )


# ---------------------------------------------------------------------------
# HTTP gateway (pipeline routes + reverse proxy to the Node studio)
# ---------------------------------------------------------------------------

PIPELINE_ROUTES = {
    "/api/pipeline/transcribe": handle_transcribe,
    "/api/pipeline/chunk": handle_chunk,
    "/api/pipeline/video_chunker": handle_video_chunker,
    "/api/pipeline/matte": handle_matte,
    "/api/pipeline/render": handle_render,
}


def _read_body(handler: BaseHTTPRequestHandler, content_length: int) -> bytes:
    if content_length <= 0:
        return b""
    return handler.rfile.read(content_length)


class GatewayHandler(BaseHTTPRequestHandler):
    node_studio_port = DEFAULT_NODE_STUDIO_PORT

    def log_message(self, _format: str, *_args: object) -> None:
        return

    def _send_json(self, status_code: int, body: dict[str, Any]) -> None:
        payload = json.dumps(body, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def _send_error_json(self, status_code: int, message: str) -> None:
        self._send_json(status_code, {"error": message})

    def _forward_to_studio(self, method: str, target_path: str) -> None:
        content_length = int(self.headers.get("Content-Length") or 0)
        body = _read_body(self, content_length) if content_length else None
        forward_headers = {
            key: value
            for key, value in self.headers.items()
            if key.lower() not in ("connection", "transfer-encoding", "host")
        }
        forward_headers["Host"] = f"{NODE_STUDIO_HOST}:{self.node_studio_port}"
        if body is not None:
            forward_headers["Content-Length"] = str(len(body))
        connection = http.client.HTTPConnection(NODE_STUDIO_HOST, self.node_studio_port, timeout=300)
        try:
            connection.request(method, target_path, body=body, headers=forward_headers)
            response = connection.getresponse()
            response_headers = [
                (key, value)
                for key, value in response.getheaders()
                if key.lower() not in ("connection", "transfer-encoding")
            ]
            self.send_response(response.status)
            for key, value in response_headers:
                self.send_header(key, value)
            self.end_headers()
            while True:
                chunk = response.read(1024 * 256)
                if not chunk:
                    break
                self.wfile.write(chunk)
        finally:
            connection.close()

    def do_GET(self) -> None:
        path = self.path.split("?")[0]
        if path == "/health":
            self._send_json(200, {"ok": True, "service": "prometheus-mini-run-studio"})
            return
        job_match = re.match(r"^/api/pipeline/job/([A-Za-z0-9_:\-]+)$", path)
        if job_match:
            job_id = job_match.group(1)
            try:
                from mini_run_pipeline import pipeline as pipeline_mod

                envelope = pipeline_mod.get_pipeline_job(job_id)
                if envelope is None:
                    self._send_json(404, {"ok": False, "jobId": job_id, "error": "job not found"})
                    return
                self._send_json(
                    200,
                    {
                        "ok": True,
                        "jobId": job_id,
                        "state": envelope.get("_state"),
                        "status": envelope.get("_state"),
                        "returnvalue": envelope.get("returnvalue"),
                        "failedReason": envelope.get("failedReason"),
                    },
                )
                return
            except Exception as error:  # noqa: BLE001 - gateway boundary
                self._send_error_json(500, str(error))
                return
        self._forward_to_studio("GET", self.path)

    def do_HEAD(self) -> None:
        path = self.path.split("?")[0]
        if path == "/health":
            self._send_json(200, {"ok": True})
            return
        self._forward_to_studio("HEAD", self.path)

    def do_POST(self) -> None:
        path = self.path.split("?")[0]
        handler = PIPELINE_ROUTES.get(path)
        if handler is None:
            self._forward_to_studio("POST", self.path)
            return
        try:
            content_length = int(self.headers.get("Content-Length") or 0)
            raw_body = _read_body(self, content_length)
            payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
            result = handler(payload)
            self._send_json(200, {"ok": True, **result})
        except Exception as error:  # noqa: BLE001 - gateway boundary
            self._send_error_json(500, str(error))


def start_gateway(
    port: int = DEFAULT_GATEWAY_PORT,
    node_studio_port: int = DEFAULT_NODE_STUDIO_PORT,
    studio_dir: str = DEFAULT_STUDIO_DIR,
    artifact_root: str = DEFAULT_ARTIFACT_ROOT,
    start_node_studio: bool = True,
) -> ThreadingHTTPServer:
    global STUDIO_DIR, ARTIFACT_ROOT
    STUDIO_DIR = Path(studio_dir)
    ARTIFACT_ROOT = Path(artifact_root)

    if start_node_studio:
        node_script = (STUDIO_DIR / "serve_preview.ts").resolve()
        subprocess.Popen(
            ["npx", "tsx", str(node_script)],
            cwd=str(STUDIO_DIR),
            env={**os.environ, "PORT": str(node_studio_port)},
        )

    GatewayHandler.node_studio_port = node_studio_port
    server = ThreadingHTTPServer(("0.0.0.0", port), GatewayHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Mini-run pipeline gateway")
    parser.add_argument("--port", type=int, default=DEFAULT_GATEWAY_PORT)
    parser.add_argument("--node-studio-port", type=int, default=DEFAULT_NODE_STUDIO_PORT)
    parser.add_argument("--studio-dir", default=DEFAULT_STUDIO_DIR)
    parser.add_argument("--artifact-root", default=DEFAULT_ARTIFACT_ROOT)
    parser.add_argument("--no-node", action="store_true", help="skip launching the Node studio")
    args = parser.parse_args()

    server = start_gateway(
        port=args.port,
        node_studio_port=args.node_studio_port,
        studio_dir=args.studio_dir,
        artifact_root=args.artifact_root,
        start_node_studio=not args.no_node,
    )
    print(f"[gateway] listening on :{args.port} -> node studio :{args.node_studio_port}", flush=True)
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        server.shutdown()
