from __future__ import annotations

import json
import os
import shutil
import subprocess
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence
from urllib.parse import urlparse

import cv2
import numpy as np
import torch


OUTPUT_ROOT = Path(os.getenv("RVM_OUTPUT_ROOT", "/tmp/prometheus-rvm"))
MODEL_DIR = Path(os.getenv("RVM_MODEL_DIR", "/opt/models"))
RVM_REPO = os.getenv("RVM_TORCHHUB_REPO", "PeterL1n/RobustVideoMatting")
RVM_VARIANT = os.getenv("RVM_VARIANT", "resnet50")
RVM_WEIGHTS_NAME = os.getenv("RVM_WEIGHTS_NAME", "rvm_resnet50.pth")
RVM_ALLOW_TORCHHUB_FALLBACK = os.getenv("RVM_ALLOW_TORCHHUB_FALLBACK", "1").lower() in {"1", "true", "yes"}
RVM_REQUIRE_CUDA = os.getenv("RVM_REQUIRE_CUDA", "1").lower() in {"1", "true", "yes"}
RVM_SEQ_CHUNK = max(1, int(os.getenv("RVM_SEQ_CHUNK", "12")))
FFMPEG_LOGLEVEL = os.getenv("FFMPEG_LOGLEVEL", "error")
DOWNLOAD_TIMEOUT_SECONDS = float(os.getenv("DOWNLOAD_TIMEOUT_SECONDS", "60"))
MAX_INPUT_BYTES = int(os.getenv("MAX_INPUT_BYTES", str(1024 * 1024 * 1024)))

_MODEL_CACHE: tuple[Any, torch.device] | None = None


class ExtractionError(RuntimeError):
    pass


@dataclass(frozen=True)
class MediaProbe:
    width: int
    height: int
    fps: float
    duration_seconds: float
    has_audio: bool


@dataclass(frozen=True)
class ExtractionResult:
    job_id: str
    matte_url: str
    audio_url: str
    duration_seconds: float
    duration_in_frames: int
    fps: float
    width: int
    height: int


def _safe_job_id(job_id: str) -> str:
    safe = "".join(character if character.isalnum() or character in {"-", "_"} else "_" for character in job_id)
    return safe[:96] or "job"


def _run(command: Sequence[str]) -> None:
    completed = subprocess.run(list(command), capture_output=True, check=False, text=True)
    if completed.returncode != 0:
        stderr = completed.stderr.strip() or completed.stdout.strip()
        raise ExtractionError(f"command failed: {' '.join(command)}\n{stderr}")


def _parse_frame_rate(value: str) -> float | None:
    if not value or value == "0/0":
        return None
    if "/" in value:
        numerator, denominator = value.split("/", 1)
        denominator_value = float(denominator)
        if denominator_value == 0:
            return None
        return float(numerator) / denominator_value
    return float(value)


def probe_media(video_path: Path) -> MediaProbe:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        str(video_path),
    ]
    completed = subprocess.run(command, capture_output=True, check=False, text=True)
    if completed.returncode != 0:
      raise ExtractionError(completed.stderr.strip() or "ffprobe failed")

    payload = json.loads(completed.stdout)
    video_stream = next((stream for stream in payload.get("streams", []) if stream.get("codec_type") == "video"), None)
    if not video_stream:
        raise ExtractionError("input media has no video stream")

    fps = None
    for key in ("avg_frame_rate", "r_frame_rate"):
        fps = _parse_frame_rate(str(video_stream.get(key, "")))
        if fps:
            break
    if not fps:
        fps = 30.0

    duration = float(video_stream.get("duration") or payload.get("format", {}).get("duration") or 0)
    if duration <= 0:
        raise ExtractionError("input media duration could not be determined")

    return MediaProbe(
        width=int(video_stream["width"]),
        height=int(video_stream["height"]),
        fps=round(fps, 6),
        duration_seconds=duration,
        has_audio=any(stream.get("codec_type") == "audio" for stream in payload.get("streams", [])),
    )


def prepare_workspace(job_id: str) -> dict[str, Path]:
    safe_id = _safe_job_id(job_id)
    root = OUTPUT_ROOT / safe_id
    shutil.rmtree(root, ignore_errors=True)
    paths = {
        "root": root,
        "input": root / "input.mp4",
        "frames": root / "frames",
        "alpha": root / "alpha",
        "matte": root / "matte.webm",
        "audio": root / "audio.m4a",
    }
    for path in (root, paths["frames"], paths["alpha"]):
        path.mkdir(parents=True, exist_ok=True)
    return paths


def download_input(input_url: str, destination: Path) -> Path:
    parsed = urlparse(input_url)
    if parsed.scheme == "file":
        source = Path(parsed.path)
        if not source.exists():
            raise ExtractionError(f"input file does not exist: {source}")
        shutil.copyfile(source, destination)
        return destination

    if parsed.scheme not in {"http", "https"}:
        source = Path(input_url)
        if source.exists():
            shutil.copyfile(source, destination)
            return destination
        raise ExtractionError("inputUrl must be http(s), file, or an existing local path")

    request = urllib.request.Request(input_url, headers={"User-Agent": "prometheus-rvm-pipeline/0.1"})
    written = 0
    with urllib.request.urlopen(request, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response:
        with destination.open("wb") as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_INPUT_BYTES:
                    raise ExtractionError("input media exceeded MAX_INPUT_BYTES")
                output.write(chunk)
    if written == 0:
        raise ExtractionError("input media download was empty")
    return destination


def extract_video_frames(video_path: Path, frames_dir: Path, start_seconds: float, duration_seconds: float) -> list[Path]:
    frame_pattern = str(frames_dir / "frame_%06d.png")
    _run([
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        FFMPEG_LOGLEVEL,
        "-y",
        "-ss",
        f"{start_seconds:.6f}",
        "-t",
        f"{duration_seconds:.6f}",
        "-i",
        str(video_path),
        "-map",
        "0:v:0",
        "-an",
        "-vsync",
        "0",
        frame_pattern,
    ])
    frames = sorted(frames_dir.glob("frame_*.png"))
    if not frames:
        raise ExtractionError("ffmpeg produced no frames")
    return frames


def read_rgb_frames(frame_paths: Iterable[Path]) -> list[np.ndarray]:
    frames: list[np.ndarray] = []
    expected_shape: tuple[int, int, int] | None = None
    for frame_path in frame_paths:
        frame_bgr = cv2.imread(str(frame_path), cv2.IMREAD_COLOR)
        if frame_bgr is None:
            raise ExtractionError(f"failed to read frame: {frame_path}")
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        if expected_shape is None:
            expected_shape = frame_rgb.shape
        elif frame_rgb.shape != expected_shape:
            raise ExtractionError("source frames changed dimensions during extraction")
        frames.append(np.ascontiguousarray(frame_rgb))
    return frames


def _load_torchhub_model(pretrained: bool) -> Any:
    try:
        return torch.hub.load(RVM_REPO, RVM_VARIANT, pretrained=pretrained, progress=False, trust_repo=True)
    except TypeError:
        return torch.hub.load(RVM_REPO, RVM_VARIANT, pretrained=pretrained, progress=False)


def _normalise_state_dict(checkpoint: Any) -> Mapping[str, Any]:
    if hasattr(checkpoint, "state_dict"):
        checkpoint = checkpoint.state_dict()
    if isinstance(checkpoint, Mapping):
        for key in ("state_dict", "model_state_dict", "model"):
            value = checkpoint.get(key)
            if isinstance(value, Mapping):
                checkpoint = value
                break
    if not isinstance(checkpoint, Mapping):
        raise ExtractionError("RVM checkpoint did not contain a PyTorch state dict")
    return {str(key).removeprefix("module."): value for key, value in checkpoint.items()}


def load_rvm_model() -> tuple[Any, torch.device]:
    global _MODEL_CACHE
    if _MODEL_CACHE is not None:
        return _MODEL_CACHE

    if torch.cuda.is_available():
        device = torch.device("cuda")
    elif RVM_REQUIRE_CUDA:
        raise ExtractionError("CUDA is unavailable; set RVM_REQUIRE_CUDA=0 only for local CPU debugging")
    else:
        device = torch.device("cpu")

    weights_path = MODEL_DIR / RVM_WEIGHTS_NAME
    if weights_path.exists():
        model = _load_torchhub_model(pretrained=False)
        checkpoint = torch.load(str(weights_path), map_location="cpu")
        model.load_state_dict(_normalise_state_dict(checkpoint))
    elif RVM_ALLOW_TORCHHUB_FALLBACK:
        model = _load_torchhub_model(pretrained=True)
    else:
        raise ExtractionError(f"RVM weights not found at {weights_path}")

    model.eval().to(device)
    _MODEL_CACHE = (model, device)
    return _MODEL_CACHE


def _frames_to_tensor(frames: Sequence[np.ndarray], device: torch.device) -> torch.Tensor:
    frame_array = np.stack(frames, axis=0)
    tensor = torch.from_numpy(frame_array).to(device=device, dtype=torch.float32)
    return tensor.permute(0, 3, 1, 2).contiguous().div_(255.0)


def _iter_chunks(frames: Sequence[np.ndarray], chunk_size: int) -> Iterable[Sequence[np.ndarray]]:
    for start in range(0, len(frames), chunk_size):
        yield frames[start:start + chunk_size]


def run_rvm(frames: Sequence[np.ndarray]) -> list[np.ndarray]:
    if not frames:
        raise ExtractionError("RVM received no frames")

    model, device = load_rvm_model()
    height, width = frames[0].shape[:2]
    downsample_ratio = max(0.125, min(1.0, 480.0 / float(max(height, width))))
    rec: list[Any] = [None, None, None, None]
    alpha_frames: list[np.ndarray] = []

    with torch.no_grad():
        for chunk in _iter_chunks(frames, RVM_SEQ_CHUNK):
            src = _frames_to_tensor(chunk, device).unsqueeze(0)
            _foreground, alpha, *rec = model(src, *rec, downsample_ratio)
            alpha_cpu = alpha.squeeze(0).detach().clamp(0.0, 1.0).to("cpu")
            for alpha_tensor in alpha_cpu:
                alpha_frame = alpha_tensor.squeeze(0).numpy()
                alpha_frames.append(np.rint(alpha_frame * 255.0).astype(np.uint8))

    if len(alpha_frames) != len(frames):
        raise ExtractionError("RVM produced a different frame count than the source")
    return alpha_frames


def write_alpha_frames(alpha_frames: Sequence[np.ndarray], alpha_dir: Path) -> list[Path]:
    paths: list[Path] = []
    for index, alpha in enumerate(alpha_frames, start=1):
        path = alpha_dir / f"alpha_{index:06d}.png"
        if not cv2.imwrite(str(path), alpha):
            raise ExtractionError(f"failed to write alpha frame: {path}")
        paths.append(path)
    return paths


def encode_transparent_webm(frames_dir: Path, alpha_dir: Path, output_path: Path, fps: float) -> Path:
    _run([
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        FFMPEG_LOGLEVEL,
        "-y",
        "-framerate",
        f"{fps:.6f}",
        "-i",
        str(frames_dir / "frame_%06d.png"),
        "-framerate",
        f"{fps:.6f}",
        "-i",
        str(alpha_dir / "alpha_%06d.png"),
        "-filter_complex",
        "[0:v][1:v]alphamerge,format=yuva420p",
        "-an",
        "-c:v",
        "libvpx-vp9",
        "-b:v",
        "0",
        "-crf",
        "24",
        "-auto-alt-ref",
        "0",
        "-pix_fmt",
        "yuva420p",
        str(output_path),
    ])
    return output_path


def extract_audio(video_path: Path, audio_path: Path, duration_seconds: float, has_audio: bool) -> Path:
    if has_audio:
        _run([
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            FFMPEG_LOGLEVEL,
            "-y",
            "-i",
            str(video_path),
            "-vn",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(audio_path),
        ])
    else:
        _run([
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            FFMPEG_LOGLEVEL,
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=48000:cl=stereo",
            "-t",
            f"{duration_seconds:.6f}",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(audio_path),
        ])
    return audio_path


def to_artifact_url(path: Path) -> str:
    public_base = os.getenv("RVM_PUBLIC_BASE_URL", "").strip().rstrip("/")
    if public_base:
        return f"{public_base}/{path.parent.name}/{path.name}"
    return path.resolve().as_uri()


def extract_matte(
    *,
    job_id: str,
    input_url: str,
    start_seconds: float = 0,
    max_duration_seconds: float | None = None,
) -> ExtractionResult:
    paths = prepare_workspace(job_id)
    download_input(input_url, paths["input"])
    probe = probe_media(paths["input"])
    duration = min(probe.duration_seconds - start_seconds, max_duration_seconds or probe.duration_seconds)
    if duration <= 0:
        raise ExtractionError("requested extraction duration is empty")

    frame_paths = extract_video_frames(paths["input"], paths["frames"], start_seconds, duration)
    frames = read_rgb_frames(frame_paths)
    alpha_frames = run_rvm(frames)
    write_alpha_frames(alpha_frames, paths["alpha"])
    encode_transparent_webm(paths["frames"], paths["alpha"], paths["matte"], probe.fps)
    extract_audio(paths["input"], paths["audio"], duration, probe.has_audio)

    duration_in_frames = len(frame_paths)
    return ExtractionResult(
        job_id=job_id,
        matte_url=to_artifact_url(paths["matte"]),
        audio_url=to_artifact_url(paths["audio"]),
        duration_seconds=duration_in_frames / probe.fps,
        duration_in_frames=duration_in_frames,
        fps=probe.fps,
        width=probe.width,
        height=probe.height,
    )
