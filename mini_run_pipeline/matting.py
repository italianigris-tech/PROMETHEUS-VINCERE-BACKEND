"""Mediapipe Selfie Segmentation worker for Martin subject matting.

Produces transparent VP9 WebM cutouts for behind-subject text layering.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any, Dict, List

import cv2
import numpy as np

MODEL_PATH = Path(os.getenv("SELFIE_MODEL_PATH", "/opt/models/selfie_segmenter.tflite"))
FALLBACK_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite"


def _ensure_model() -> Path:
    if MODEL_PATH.exists():
        return MODEL_PATH
    local_scratch_win = Path("C:/Users/HomePC/.gemini/antigravity-cli/brain/10c3cb0a-f5cb-4a29-872b-211378d1d443/scratch/selfie_segmenter.tflite")
    if local_scratch_win.exists():
        return local_scratch_win
    cache_model = Path(tempfile.gettempdir()) / "prometheus_models" / "selfie_segmenter.tflite"
    if cache_model.exists() and cache_model.stat().st_size > 0:
        return cache_model
    import urllib.request
    cache_model.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(FALLBACK_MODEL_URL, str(cache_model))
    return cache_model


def refine_alpha_matte(alpha: np.ndarray, rim_compensation: bool = True) -> np.ndarray:
    """Refines float32 alpha matte [0.0, 1.0] eliminating dirty rim spill and head shadow artifacts.

    Applies low-alpha fringe cutoff, smoothstep contrast steepening, morphological inner erode (2px),
    and edge-preserving bilateral filtering to eliminate the dark rim artifact over behind-subject text.
    """
    clipped = np.clip(alpha, 0.0, 1.0).astype(np.float32)

    # 1. Low-alpha fringe cutoff: eliminate background color spill that causes dark head shadows
    outer_threshold = 0.12 if rim_compensation else 0.05
    clipped = np.where(clipped < outer_threshold, 0.0, clipped)

    # 2. Smoothstep contrast steepening to tighten the feathered transition band
    t_min = outer_threshold
    t_max = 0.88
    norm = np.clip((clipped - t_min) / (t_max - t_min), 0.0, 1.0)
    steepened = norm * norm * (3.0 - 2.0 * norm)

    # 3. Morphological inner erode (choke the outer contaminated boundary by 2px)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    erode_iters = 2 if rim_compensation else 1
    choked = cv2.erode(steepened, kernel, iterations=erode_iters)

    # 4. Bilateral edge smooth with tight sigma to prevent edge blur smear
    cleaned_alpha = cv2.bilateralFilter(choked, d=5, sigmaColor=0.08, sigmaSpace=2.0)

    return np.clip(cleaned_alpha, 0.0, 1.0)


def segment_video_window(
    source_video_path: Path,
    start_ms: int,
    end_ms: int,
    output_webm_path: Path,
    width: int = 1080,
    height: int = 1920,
    fps: float = 30.0,
) -> Dict[str, Any]:
    """Segment a video window and output transparent VP9 WebM."""
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    model_file = _ensure_model()
    base_options = python.BaseOptions(model_asset_path=str(model_file))
    options = vision.ImageSegmenterOptions(base_options=base_options, output_confidence_masks=True)

    output_webm_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="matte-frames-") as temp_dir:
        temp_dir_path = Path(temp_dir)
        raw_clip = temp_dir_path / "clip.mp4"
        alpha_dir = temp_dir_path / "alpha"
        alpha_dir.mkdir(parents=True, exist_ok=True)

        start_sec = max(0.0, start_ms / 1000.0)
        duration_sec = max(0.1, (end_ms - start_ms) / 1000.0)

        # Cut window segment
        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error",
            "-ss", f"{start_sec:.3f}",
            "-t", f"{duration_sec:.3f}",
            "-i", str(source_video_path),
            "-c:v", "libx264", "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            str(raw_clip)
        ], check=True)

        # Segment frames
        cap = cv2.VideoCapture(str(raw_clip))
        frame_idx = 0
        prev_alpha = None
        with vision.ImageSegmenter.create_from_options(options) as segmenter:
            while True:
                ret, frame_bgr = cap.read()
                if not ret or frame_bgr is None:
                    break
                frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
                results = segmenter.segment(mp_image)

                # Continuous confidence mask provides anti-aliased hair boundaries
                if results.confidence_masks:
                    conf = results.confidence_masks[0].numpy_view().squeeze()
                    # Contrast ramp to preserve hair strand edges while preventing background fringe
                    norm_conf = np.clip((conf - 0.20) / (0.75 - 0.20), 0.0, 1.0)
                    # Temporal EMA (75% current / 25% previous) eliminates high-frequency edge shimmer
                    if prev_alpha is not None:
                        norm_conf = 0.75 * norm_conf + 0.25 * prev_alpha
                    prev_alpha = norm_conf.copy()

                    # Precision alpha refinement (gamma push + morphological inner choke + bilateral edge smoothing)
                    refined = refine_alpha_matte(norm_conf)
                    alpha = (refined * 255.0).astype(np.uint8)
                else:
                    cat_mask = results.category_mask.numpy_view().squeeze()
                    alpha = np.where(cat_mask == 0, 255, 0).astype(np.uint8)
                    alpha = cv2.GaussianBlur(alpha, (5, 5), 0)

                alpha_file = alpha_dir / f"alpha_{frame_idx:06d}.png"
                cv2.imwrite(str(alpha_file), alpha)
                frame_idx += 1

        cap.release()

        if frame_idx == 0:
            raise RuntimeError(f"No frames read from window clip: {raw_clip}")

        # Encode transparent VP9 WebM
        cmd = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", str(raw_clip),
            "-framerate", f"{fps:.3f}",
            "-i", str(alpha_dir / "alpha_%06d.png"),
            "-filter_complex", "[0:v]setpts=PTS-STARTPTS[rgb];[rgb][1:v]alphamerge,format=yuva420p",
            "-frames:v", str(frame_idx),
            "-an",
            "-c:v", "libvpx-vp9",
            "-threads", "4",
            "-row-mt", "1",
            "-deadline", "realtime",
            "-cpu-used", "4",
            "-pix_fmt", "yuva420p",
            "-b:v", "0",
            "-crf", "10",
            str(output_webm_path)
        ]
        subprocess.run(cmd, check=True)

        return {
            "durationInFrames": frame_idx,
            "width": width,
            "height": height,
            "fps": fps,
        }


def execute_matte_batch(payload: Dict[str, Any], artifact_root: str = "/data") -> List[Dict[str, Any]]:
    """Execute a batch of window matting requests and return stitch receipt entries."""
    job_id = payload.get("jobId", "matte-job")
    source = payload.get("source", {})
    input_url = str(source.get("inputUrl", ""))
    windows = payload.get("windows", [])

    source_path = Path(input_url.removeprefix("file://"))
    output_dir = Path(artifact_root) / "media" / "martin" / job_id
    output_dir.mkdir(parents=True, exist_ok=True)

    receipts = []
    for idx, win in enumerate(windows):
        win_id = win.get("windowId") or f"martin-window-{idx + 1}"
        s_start = int(win.get("sourceStartMs", 0))
        s_end = int(win.get("sourceEndMs", 1000))
        o_start = int(win.get("outputStartMs", s_start))
        o_end = int(win.get("outputEndMs", s_end))

        dest_file = output_dir / f"{win_id}.webm"
        info = segment_video_window(
            source_video_path=source_path,
            start_ms=s_start,
            end_ms=s_end,
            output_webm_path=dest_file,
        )

        receipts.append({
            "windowId": win_id,
            "foregroundFile": str(PurePosixPath("martin") / job_id / f"{win_id}.webm"),
            "sourceStartMs": s_start,
            "sourceEndMs": s_end,
            "outputStartMs": o_start,
            "outputEndMs": o_end,
            **info,
        })

    return receipts
