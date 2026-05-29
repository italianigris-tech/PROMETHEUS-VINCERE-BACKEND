from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence, Tuple

import boto3
from botocore.config import Config
import cv2
import numpy as np
import runpod
import torch


MAX_CLIP_SECONDS = float(os.getenv("MAX_CLIP_SECONDS", "10"))
MODEL_DIR = Path(os.getenv("MODEL_DIR", "/opt/models"))
INPUT_DIR = Path(os.getenv("INPUT_DIR", "/tmp/runpod-video-worker/input"))
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "/tmp/runpod-video-worker/output"))
FFMPEG_LOGLEVEL = os.getenv("FFMPEG_LOGLEVEL", "error")
DOWNLOAD_TIMEOUT_SECONDS = float(os.getenv("DOWNLOAD_TIMEOUT_SECONDS", "45"))
MAX_INPUT_BYTES = int(os.getenv("MAX_INPUT_BYTES", str(256 * 1024 * 1024)))
RVM_TORCHHUB_REPO = os.getenv("RVM_TORCHHUB_REPO", "PeterL1n/RobustVideoMatting")
RVM_VARIANT = os.getenv("RVM_VARIANT", "resnet50")
RVM_WEIGHTS_NAME = os.getenv("RVM_WEIGHTS_NAME", "rvm_resnet50.pth")
RVM_ALLOW_TORCHHUB_FALLBACK = os.getenv("RVM_ALLOW_TORCHHUB_FALLBACK", "").strip().lower() in {"1", "true", "yes"}
RVM_SEQ_CHUNK = max(1, int(os.getenv("RVM_SEQ_CHUNK", "12")))
RVM_DOWNSAMPLE_RATIO = os.getenv("RVM_DOWNSAMPLE_RATIO", "").strip()
S3_PREFIX = os.getenv("S3_PREFIX", "runpod-video-worker").strip().strip("/")
S3_PRESIGNED_EXPIRES_SECONDS = int(os.getenv("S3_PRESIGNED_EXPIRES_SECONDS", "604800"))
DEFAULT_OUTPUT_FRAME_RATE = float(os.getenv("DEFAULT_OUTPUT_FRAME_RATE", "30"))

_MODEL_CACHE: Optional[Tuple[Any, Any]] = None


class PayloadError(ValueError):
    """Raised when a job payload cannot be processed safely."""


def _now() -> float:
    return time.perf_counter()


def _elapsed(start: float) -> float:
    return round(time.perf_counter() - start, 4)


def _safe_job_id(job_id: str) -> str:
    safe = "".join(char if char.isalnum() or char in ("-", "_") else "_" for char in job_id)
    return safe[:96] or "job"


def _payload_from_event(event: Mapping[str, Any]) -> Mapping[str, Any]:
    payload = event.get("input", event)
    if not isinstance(payload, Mapping):
        raise PayloadError("event input must be a JSON object")
    return payload


def validate_payload(event: Mapping[str, Any]) -> Tuple[str, str, Mapping[str, Any], Mapping[str, float]]:
    payload = _payload_from_event(event)

    input_video_url = payload.get("input_video_url")
    job_id = payload.get("job_id")
    metadata = payload.get("metadata")
    timestamps = payload.get("timestamps")

    if not isinstance(input_video_url, str) or not input_video_url.strip():
        raise PayloadError("input_video_url must be a non-empty string")
    if not input_video_url.startswith(("http://", "https://", "file://")):
        raise PayloadError("input_video_url must use http, https, or file URL scheme")
    if not isinstance(job_id, str) or not job_id.strip():
        raise PayloadError("job_id must be a non-empty string")
    if not isinstance(metadata, Mapping):
        raise PayloadError("metadata must be an object")
    if not isinstance(timestamps, Mapping):
        raise PayloadError("timestamps must be an object")

    start = timestamps.get("start")
    end = timestamps.get("end")
    if not isinstance(start, (int, float)) or not isinstance(end, (int, float)):
        raise PayloadError("timestamps.start and timestamps.end must be numbers")
    if start < 0 or end <= start:
        raise PayloadError("timestamps must satisfy 0 <= start < end")
    if end - start > MAX_CLIP_SECONDS:
        raise PayloadError(f"clip duration must be <= {MAX_CLIP_SECONDS:g}s")

    return input_video_url.strip(), job_id, metadata, {"start": float(start), "end": float(end)}


def prepare_workspace(job_id: str) -> Dict[str, Path]:
    safe_id = _safe_job_id(job_id)
    job_root = OUTPUT_DIR / safe_id
    input_root = INPUT_DIR / safe_id
    output_video_path = OUTPUT_DIR / f"{safe_id}_alpha.mp4"

    shutil.rmtree(job_root, ignore_errors=True)
    shutil.rmtree(input_root, ignore_errors=True)
    if output_video_path.exists():
        output_video_path.unlink()

    paths = {
        "job_root": job_root,
        "input_root": input_root,
        "video_path": input_root / "input.mp4",
        "frames_dir": job_root / "frames",
        "matte_dir": job_root / "alpha_frames",
        "output_video_path": output_video_path,
    }

    for path in (input_root, job_root, paths["frames_dir"], paths["matte_dir"], output_video_path.parent):
        path.mkdir(parents=True, exist_ok=True)

    return paths


def cleanup_workspace(paths: Mapping[str, Path]) -> None:
    shutil.rmtree(paths["input_root"], ignore_errors=True)
    shutil.rmtree(paths["job_root"], ignore_errors=True)
    paths["output_video_path"].unlink(missing_ok=True)


def download_video(url: str, destination: Path) -> Path:
    if url.startswith("file://"):
        source = Path(url.removeprefix("file://"))
        if not source.exists():
            raise PayloadError(f"local input video does not exist: {source}")
        shutil.copyfile(source, destination)
        return destination

    request = urllib.request.Request(url, headers={"User-Agent": "runpod-video-worker/1.0"})
    bytes_written = 0
    with urllib.request.urlopen(request, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response:
        with destination.open("wb") as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > MAX_INPUT_BYTES:
                    raise PayloadError("input video exceeded MAX_INPUT_BYTES")
                output.write(chunk)

    if bytes_written == 0:
        raise PayloadError("downloaded input video is empty")
    return destination


def run_command(command: Sequence[str]) -> None:
    completed = subprocess.run(list(command), check=False, capture_output=True, text=True)
    if completed.returncode != 0:
        stderr = completed.stderr.strip() or completed.stdout.strip()
        raise RuntimeError(f"command failed: {' '.join(command)}\n{stderr}")


def _parse_frame_rate(value: str) -> Optional[float]:
    if not value or value == "0/0":
        return None
    if "/" in value:
        numerator, denominator = value.split("/", 1)
        denominator_value = float(denominator)
        if denominator_value == 0:
            return None
        return float(numerator) / denominator_value
    return float(value)


def probe_frame_rate(video_path: Path) -> float:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=avg_frame_rate,r_frame_rate",
        "-of",
        "json",
        str(video_path),
    ]
    completed = subprocess.run(command, check=False, capture_output=True, text=True)
    if completed.returncode != 0:
        return DEFAULT_OUTPUT_FRAME_RATE

    try:
        payload = json.loads(completed.stdout)
        stream = payload.get("streams", [{}])[0]
        for key in ("avg_frame_rate", "r_frame_rate"):
            frame_rate = _parse_frame_rate(str(stream.get(key, "")))
            if frame_rate and 0 < frame_rate <= 240:
                return round(frame_rate, 6)
    except (ValueError, TypeError, IndexError):
        return DEFAULT_OUTPUT_FRAME_RATE

    return DEFAULT_OUTPUT_FRAME_RATE


def extract_frames(video_path: Path, frames_dir: Path, timestamps: Mapping[str, float]) -> List[Path]:
    frame_pattern = str(frames_dir / "frame_%06d.png")
    duration = timestamps["end"] - timestamps["start"]
    run_command([
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        FFMPEG_LOGLEVEL,
        "-y",
        "-i",
        str(video_path),
        "-ss",
        f"{timestamps['start']:.6f}",
        "-t",
        f"{duration:.6f}",
        "-map",
        "0:v:0",
        "-an",
        "-vsync",
        "0",
        frame_pattern,
    ])

    frames = sorted(frames_dir.glob("frame_*.png"))
    if not frames:
        raise RuntimeError("ffmpeg produced no frames")
    return frames


def read_extracted_frames(frame_paths: Iterable[Path]) -> List[np.ndarray]:
    frames: List[np.ndarray] = []
    expected_shape: Optional[Tuple[int, int, int]] = None

    for frame_path in frame_paths:
        frame_bgr = cv2.imread(str(frame_path), cv2.IMREAD_COLOR)
        if frame_bgr is None:
            raise RuntimeError(f"failed to read extracted frame: {frame_path}")

        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        if expected_shape is None:
            expected_shape = frame_rgb.shape
        elif frame_rgb.shape != expected_shape:
            raise RuntimeError("extracted frames have inconsistent dimensions")

        frames.append(np.ascontiguousarray(frame_rgb))

    if not frames:
        raise RuntimeError("no frames were loaded for inference")
    return frames


def _load_torchhub_rvm_model(pretrained: bool) -> Any:
    kwargs = {"pretrained": pretrained, "progress": False}
    try:
        return torch.hub.load(RVM_TORCHHUB_REPO, RVM_VARIANT, trust_repo=True, **kwargs)
    except TypeError:
        return torch.hub.load(RVM_TORCHHUB_REPO, RVM_VARIANT, **kwargs)


def _torch_load_weights(weights_path: Path) -> Any:
    try:
        return torch.load(str(weights_path), map_location="cpu", weights_only=True)
    except TypeError:
        return torch.load(str(weights_path), map_location="cpu")


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
        raise RuntimeError("RVM checkpoint did not contain a PyTorch state_dict")

    state_dict = {}
    for key, value in checkpoint.items():
        clean_key = key.removeprefix("module.")
        state_dict[clean_key] = value
    return state_dict


def _load_rvm_from_weights(weights_path: Path, device: Any) -> Any:
    if weights_path.suffix.lower() in {".torchscript", ".jit", ".pt"}:
        model = torch.jit.load(str(weights_path), map_location=device)
        return model

    model = _load_torchhub_rvm_model(pretrained=False)
    state_dict = _normalise_state_dict(_torch_load_weights(weights_path))
    model.load_state_dict(state_dict)
    return model


def load_rvm_model() -> Tuple[Any, Any]:
    global _MODEL_CACHE
    if _MODEL_CACHE is not None:
        return _MODEL_CACHE

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is unavailable; this production RVM worker requires a GPU")

    device = torch.device("cuda")
    weights_path = MODEL_DIR / RVM_WEIGHTS_NAME

    if weights_path.exists():
        model = _load_rvm_from_weights(weights_path, device)
    elif RVM_ALLOW_TORCHHUB_FALLBACK:
        model = _load_torchhub_rvm_model(pretrained=True)
    else:
        raise RuntimeError(
            f"RVM model unavailable and TorchHub fallback disabled: missing {weights_path}. "
            f"Bake {RVM_WEIGHTS_NAME} into MODEL_DIR or set RVM_ALLOW_TORCHHUB_FALLBACK=1 "
            "to permit runtime TorchHub download."
        )

    model.eval()
    model.to(device)
    _MODEL_CACHE = (model, device)
    return _MODEL_CACHE


def _resolve_downsample_ratio(height: int, width: int) -> float:
    if RVM_DOWNSAMPLE_RATIO:
        ratio = float(RVM_DOWNSAMPLE_RATIO)
        if ratio <= 0 or ratio > 1:
            raise RuntimeError("RVM_DOWNSAMPLE_RATIO must be in the range (0, 1]")
        return ratio

    longest_side = max(height, width)
    if longest_side <= 512:
        return 1.0
    return max(0.125, min(1.0, 480.0 / float(longest_side)))


def _frames_to_rvm_tensor(frames: Sequence[np.ndarray], device: Any) -> Any:
    if not frames:
        raise RuntimeError("RVM inference received no frames")

    first_shape = frames[0].shape
    if len(first_shape) != 3 or first_shape[2] != 3:
        raise RuntimeError("RVM frames must have shape [H, W, 3]")

    for frame in frames:
        if frame.shape != first_shape:
            raise RuntimeError("RVM frames must have a consistent shape")

    frame_array = np.stack(frames, axis=0)
    if frame_array.dtype != np.uint8:
        frame_array = np.clip(frame_array, 0, 255).astype(np.uint8)

    tensor = torch.from_numpy(frame_array).to(device=device, dtype=torch.float32)
    tensor = tensor.permute(0, 3, 1, 2).contiguous()
    tensor.div_(255.0)
    return tensor


def _iter_chunks(frames: Sequence[np.ndarray], chunk_size: int) -> Iterable[Sequence[np.ndarray]]:
    for start in range(0, len(frames), chunk_size):
        yield frames[start:start + chunk_size]


def run_rvm_inference_hook(frames: Sequence[np.ndarray]) -> List[np.ndarray]:
    """Run real Robust Video Matting inference and return uint8 alpha frames."""

    model, device = load_rvm_model()
    height, width = frames[0].shape[:2]
    downsample_ratio = _resolve_downsample_ratio(height, width)
    rec: List[Any] = [None, None, None, None]
    alpha_frames: List[np.ndarray] = []

    with torch.no_grad():
        for chunk in _iter_chunks(frames, RVM_SEQ_CHUNK):
            src_tchw = _frames_to_rvm_tensor(chunk, device)
            src_btchw = src_tchw.unsqueeze(0)
            _fgr, pha, *rec = model(src_btchw, *rec, downsample_ratio)
            pha_tchw = pha.squeeze(0).detach().clamp(0.0, 1.0).to("cpu")

            for alpha_tensor in pha_tchw:
                alpha = alpha_tensor.squeeze(0).numpy()
                alpha_frames.append(np.rint(alpha * 255.0).astype(np.uint8))

    if len(alpha_frames) != len(frames):
        raise RuntimeError("RVM produced a different number of alpha frames than input frames")
    return alpha_frames


def write_alpha_frames(alpha_frames: Sequence[np.ndarray], matte_dir: Path) -> List[Path]:
    matte_paths: List[Path] = []
    for index, alpha in enumerate(alpha_frames, start=1):
        if alpha.ndim != 2:
            raise RuntimeError("alpha frames must be single-channel arrays")
        if alpha.dtype != np.uint8:
            alpha = np.rint(np.clip(alpha, 0.0, 1.0) * 255.0).astype(np.uint8)

        matte_path = matte_dir / f"alpha_{index:06d}.png"
        if not cv2.imwrite(str(matte_path), alpha):
            raise RuntimeError(f"failed to write matte frame: {matte_path}")
        matte_paths.append(matte_path)

    if not matte_paths:
        raise RuntimeError("no alpha frames were written")
    return matte_paths


def _format_frame_rate(frame_rate: float) -> str:
    if frame_rate.is_integer():
        return str(int(frame_rate))
    return f"{frame_rate:.6f}".rstrip("0").rstrip(".")


def encode_alpha_video(alpha_paths: Sequence[Path], output_path: Path, frame_rate: float) -> Path:
    if not alpha_paths:
        raise RuntimeError("cannot encode alpha video without alpha frames")

    input_pattern = str(alpha_paths[0].parent / "alpha_%06d.png")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()

    run_command([
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        FFMPEG_LOGLEVEL,
        "-y",
        "-framerate",
        _format_frame_rate(frame_rate),
        "-start_number",
        "1",
        "-i",
        input_pattern,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(output_path),
    ])

    if not output_path.exists() or output_path.stat().st_size == 0:
        raise RuntimeError("ffmpeg did not produce a playable alpha mp4")
    return output_path


def _first_env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.getenv(name)
        if value is not None and value.strip():
            return value.strip()
    return default


def _required_s3_env() -> Tuple[str, str, str, str, Optional[str]]:
    bucket = _first_env("CLOUDFLARE_R2_BUCKET", "S3_BUCKET")
    access_key = _first_env("CLOUDFLARE_R2_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID")
    secret_key = _first_env("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY")
    region = _first_env("CLOUDFLARE_R2_REGION", "AWS_REGION", default="auto")
    endpoint_url = _first_env("CLOUDFLARE_R2_ENDPOINT", "S3_ENDPOINT") or None

    missing = []
    if not bucket:
        missing.append("CLOUDFLARE_R2_BUCKET or S3_BUCKET")
    if not access_key:
        missing.append("CLOUDFLARE_R2_ACCESS_KEY_ID or AWS_ACCESS_KEY_ID")
    if not secret_key:
        missing.append("CLOUDFLARE_R2_SECRET_ACCESS_KEY or AWS_SECRET_ACCESS_KEY")
    if missing:
        raise RuntimeError(f"missing required S3 environment variables: {', '.join(missing)}")
    return bucket, access_key, secret_key, region, endpoint_url


def _artifact_key(file_path: Path) -> str:
    if S3_PREFIX:
        return f"{S3_PREFIX}/{file_path.name}"
    return file_path.name


def upload_artifact(file_path: Path) -> str:
    path = Path(file_path)
    if not path.exists() or path.stat().st_size == 0:
        raise RuntimeError(f"artifact does not exist or is empty: {path}")
    if path.suffix.lower() != ".mp4":
        raise RuntimeError("only mp4 artifacts may be uploaded")

    bucket, access_key, secret_key, region, endpoint_url = _required_s3_env()
    s3_options = {"addressing_style": "path"} if endpoint_url else {}
    client = boto3.client(
        "s3",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
        endpoint_url=endpoint_url,
        config=Config(signature_version="s3v4", s3=s3_options),
    )

    object_key = _artifact_key(path)
    client.upload_file(
        str(path),
        bucket,
        object_key,
        ExtraArgs={"ContentType": "video/mp4"},
    )
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": object_key},
        ExpiresIn=S3_PRESIGNED_EXPIRES_SECONDS,
    )


def process_job(event: Mapping[str, Any]) -> Dict[str, Any]:
    total_started = _now()
    timing: MutableMapping[str, float] = {}
    paths: Optional[Dict[str, Path]] = None

    started = _now()
    input_video_url, job_id, metadata, timestamps = validate_payload(event)
    timing["validate_seconds"] = _elapsed(started)

    paths = prepare_workspace(job_id)

    started = _now()
    download_video(input_video_url, paths["video_path"])
    timing["download_seconds"] = _elapsed(started)

    started = _now()
    frame_rate = probe_frame_rate(paths["video_path"])
    frame_paths = extract_frames(paths["video_path"], paths["frames_dir"], timestamps)
    timing["extract_seconds"] = _elapsed(started)

    started = _now()
    frames = read_extracted_frames(frame_paths)
    timing["load_frames_seconds"] = _elapsed(started)

    started = _now()
    alpha_frames = run_rvm_inference_hook(frames)
    timing["inference_seconds"] = _elapsed(started)

    started = _now()
    alpha_paths = write_alpha_frames(alpha_frames, paths["matte_dir"])
    output_video_path = encode_alpha_video(alpha_paths, paths["output_video_path"], frame_rate)
    timing["encode_seconds"] = _elapsed(started)

    started = _now()
    artifact_url = upload_artifact(output_video_path)
    timing["upload_seconds"] = _elapsed(started)

    started = _now()
    cleanup_workspace(paths)
    timing["cleanup_seconds"] = _elapsed(started)
    timing["total_seconds"] = _elapsed(total_started)

    return {
        "success": True,
        "metadata": metadata,
        "job_id": job_id,
        "artifact_urls": [artifact_url],
        "timing": dict(timing),
    }


def handler(event: Mapping[str, Any]) -> Dict[str, Any]:
    return process_job(event)


def _run_local_payload(payload_path: Path) -> None:
    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    result = handler({"input": payload})
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    if len(sys.argv) > 1:
        _run_local_payload(Path(sys.argv[1]))
    else:
        runpod.serverless.start({"handler": handler})
