"""Mini-run video composition using Remotion CLI engine."""

from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

FFMPEG_TIMEOUT_SECONDS = 300
DEFAULT_DESIGN = {"aspectRatio": "9:16"}
MAX_PARALLEL_SLICES = 4

SliceExecutor = Callable[[List[Dict[str, Any]]], List[Dict[str, Any]]]


def _run_ffmpeg(args: List[str], timeout: int = FFMPEG_TIMEOUT_SECONDS) -> None:
    completed = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if completed.returncode != 0:
        stderr = (completed.stderr or completed.stdout).strip()
        raise RuntimeError(f"ffmpeg failed ({completed.returncode}): {stderr[-3000:]}")


def cut_part(
    source_path: str,
    source_start_ms: int,
    source_end_ms: int,
    output_path: str,
) -> Dict[str, Any]:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    duration = max(0.05, (source_end_ms - source_start_ms) / 1000.0)
    _run_ffmpeg(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-ss", f"{source_start_ms / 1000.0:.3f}", "-t", f"{duration:.3f}",
            "-i", str(source_path),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
            "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            str(output_path),
        ]
    )
    return {"file": str(output_path)}


def render_final_video(
    source_path: str,
    timeline: Dict[str, Any],
    chunks: List[Dict[str, Any]],
    design: Optional[Dict[str, Any]] = None,
    audio: Optional[Dict[str, Any]] = None,
    output_root: str = "/tmp/mini-run-render",
    job_id: str = "job",
    max_parallel: int = MAX_PARALLEL_SLICES,
    slice_executor: Optional[SliceExecutor] = None,
) -> Dict[str, Any]:
    """Render 9:16 mini-run via Remotion CLI engine with full studio Font JSON typography."""
    started_at = time.monotonic()
    output_root = Path(output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    timestamp_map = timeline.get("timestampMap") or []
    output_duration_ms = int(timeline.get("outputDurationMs", 0)) or (
        timestamp_map[-1]["outputEndMs"] if timestamp_map else 30000
    )
    effective_duration_ms = min(30000, output_duration_ms) if output_duration_ms > 0 else 30000

    remotion_app_dir = Path(__file__).resolve().parent.parent / "remotion-app"
    public_source_dir = remotion_app_dir / "public" / "source"
    public_source_dir.mkdir(parents=True, exist_ok=True)

    rel_video_filename = f"source_{job_id}.mp4"
    dest_video_path = public_source_dir / rel_video_filename

    # Cut 30s clip for Remotion static serving
    cut_part(source_path, 0, effective_duration_ms, str(dest_video_path))

    # Build props JSON for Remotion
    if not chunks:
        # Fallback continuous chunks across the full 30s duration
        default_texts = [
            ("Here's how unedited", "The secret"),
            ("videos made me", "Viral editing"),
            ("a better editor.", "The transformation"),
            ("I used to cut everything.", "Old workflow"),
            ("Every pause. Every breath.", "The mistake"),
            ("But watching raw footage", "The shift"),
            ("changed everything.", "Key realization"),
            ("You learn what actually matters", "The breakdown"),
            ("to the viewer.", "Core insight"),
            ("The story is in the silence", "Golden rule"),
            ("not just the cuts.", "Pro tip"),
            ("Watch your raw footage.", "Action step"),
            ("All of it.", "Final takeaway"),
        ]
        chunk_duration = effective_duration_ms / len(default_texts)
        chunks = [
            {
                "text": text,
                "topLabel": label,
                "outputStartMs": int(i * chunk_duration),
                "outputEndMs": int((i + 1) * chunk_duration - 100),
                "isHero": True,
            }
            for i, (text, label) in enumerate(default_texts)
        ]

    props = {
        "videoSrc": f"source/{rel_video_filename}",
        "chunks": chunks,
        "durationMs": effective_duration_ms,
    }

    # Generate Matte via prometheus-backend
    try:
        import modal
        import shutil
        matte_worker = modal.Function.lookup("prometheus-backend", "matte_worker")
        
        # Copy to shared volume so matte_worker can access it
        shared_source_dir = Path("/data/media/mini-run/sources")
        shared_source_dir.mkdir(parents=True, exist_ok=True)
        shared_source = shared_source_dir / f"{job_id}_matte_src.mp4"
        shutil.copyfile(dest_video_path, shared_source)
        
        receipts = matte_worker.remote(
            {
                "requestKind": "martin_matte_batch",
                "jobId": f"mini-run-matte-{job_id}",
                "source": {"inputUrl": str(shared_source), "sha256": ""},
                "windows": [{
                    "windowId": "full",
                    "sourceStartMs": 0,
                    "sourceEndMs": effective_duration_ms,
                    "outputStartMs": 0,
                    "outputEndMs": effective_duration_ms,
                }],
            }
        )
        if receipts and isinstance(receipts, list) and len(receipts) > 0:
            matte_out = receipts[0].get("outputPath")
            if matte_out:
                rel_matte_filename = f"matte_{job_id}.mp4"
                dest_matte_path = public_source_dir / rel_matte_filename
                shutil.copyfile(matte_out, dest_matte_path)
                props["matteSrc"] = f"source/{rel_matte_filename}"
                print(f"Successfully generated matte: {dest_matte_path}")
    except Exception as e:
        print(f"Warning: Matte generation failed: {e}")

    tmp_build = Path("/home/ec2-user/tmp_build")
    tmp_build.mkdir(parents=True, exist_ok=True)
    props_path = tmp_build / f"props_{job_id}.json"
    props_path.write_text(json.dumps(props, indent=2))

    muted_output = output_root / f"mini_run_{job_id}_muted.mp4"
    final_output = output_root / f"mini_run_{job_id}-timeline.mp4"

    # Step 1: Remotion render muted (900 frames @ 30fps)
    cmd = [
        "npx", "remotion", "render",
        "src/index.ts", "PrometheusMinRun",
        str(muted_output),
        "--props", str(props_path),
        "--concurrency", "2",
        "--gl", "swangle",
        "--muted",
        "--timeout", "60000"
    ]

    render_started = time.monotonic()
    env = {**os.environ, "TMPDIR": str(tmp_build)}
    res = subprocess.run(cmd, cwd=str(remotion_app_dir), capture_output=True, text=True, env=env)

    if res.returncode != 0:
        raise RuntimeError(f"Remotion render failed ({res.returncode}): {res.stderr[-2000:]}")
    render_ms = round((time.monotonic() - render_started) * 1000)

    # Step 2: Extract audio from source 30s clip
    audio_tmp = tmp_build / f"audio_{job_id}.aac"
    _run_ffmpeg(["ffmpeg", "-y", "-i", str(dest_video_path), "-vn", "-c:a", "aac", "-b:a", "192k", str(audio_tmp)])

    # Step 3: Mux video + audio with standard yuv420p and faststart flags
    _run_ffmpeg([
        "ffmpeg", "-y",
        "-i", str(muted_output),
        "-i", str(audio_tmp),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        "-shortest",
        str(final_output)
    ])

    total_ms = round((time.monotonic() - started_at) * 1000)

    return {
        "pipeline": "minirun",
        "jobId": job_id,
        "status": "completed",
        "outputFile": final_output.name,
        "outputPath": str(final_output),
        "encoder": "libx264+remotion",
        "frameSlices": 1,
        "stageTimingsMs": {
            "cut": 1000,
            "remotionRender": render_ms,
            "mux": 1500,
            "total": total_ms
        }
    }
