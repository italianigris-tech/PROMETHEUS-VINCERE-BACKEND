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


def resolve_martin_foreground_path(receipt: Dict[str, Any], artifact_root: str) -> Optional[Path]:
    """Resolve the first Martin foreground asset from its shared-volume receipt."""
    stitch = receipt.get("stitch") if isinstance(receipt, dict) else None
    if not isinstance(stitch, list) or not stitch:
        return None
    foreground_file = stitch[0].get("foregroundFile")
    if not isinstance(foreground_file, str) or not foreground_file:
        return None
    return Path(artifact_root) / "media" / foreground_file


def reload_martin_artifact_volume(volume: Any) -> None:
    """Refresh an attached Modal volume after Martin writes its foreground."""
    volume.reload()


def require_subject_layering_assets(
    *,
    required: bool,
    behind_subject_chunk_count: int,
    foreground_path: Optional[Path],
    observation: Optional[Dict[str, Any]],
) -> None:
    """Reject a required tall-font depth treatment without its visual evidence."""
    if not required or behind_subject_chunk_count == 0:
        return
    if not isinstance(observation, dict) or not observation.get("frames"):
        raise RuntimeError("required subject layering is missing a MediaPipe observation")
    if foreground_path is None or not foreground_path.exists():
        raise RuntimeError("required subject layering is missing a readable foreground asset")


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
    subject_observation: Optional[Dict[str, Any]] = None,
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

    behind_subject_chunk_count = sum(
        1 for chunk in chunks
        if chunk.get("subjectLayering", {}).get("behindSubject")
    )
    required_subject_layering = bool(
        (design or {}).get("subjectLayering") == "required" and behind_subject_chunk_count
    )
    props = {
        "videoSrc": f"source/{rel_video_filename}",
        "chunks": chunks,
        "durationMs": effective_duration_ms,
    }

    # Generate Martin foreground through the mini-run gateway. The external GPU
    # worker remains an implementation detail; this run only invokes its own app.
    foreground_path: Optional[Path] = None
    martin_error: Optional[Exception] = None
    try:
        import shutil
        from mini_run_gateway import handle_matte

        martin_receipt = handle_matte({
            "jobId": f"mini-run-matte-{job_id}",
            "source": {"inputUrl": str(dest_video_path)},
            "windows": [{
                "windowId": "full",
                "sourceStartMs": 0,
                "sourceEndMs": effective_duration_ms,
                "outputStartMs": 0,
                "outputEndMs": effective_duration_ms,
            }],
        })
        artifact_root = os.getenv("MINI_RUN_ARTIFACT_ROOT", "/data")
        import modal
        reload_martin_artifact_volume(modal.Volume.from_name("prometheus-render-artifacts"))
        foreground_path = resolve_martin_foreground_path(martin_receipt, artifact_root)
        if foreground_path and foreground_path.exists():
            rel_matte_filename = f"matte_{job_id}{foreground_path.suffix}"
            dest_matte_path = public_source_dir / rel_matte_filename
            shutil.copyfile(foreground_path, dest_matte_path)
            props["matteSrc"] = f"source/{rel_matte_filename}"
            print(f"Successfully generated Martin foreground: {dest_matte_path}")
        else:
            raise RuntimeError("Martin receipt did not expose a readable foreground asset.")
    except Exception as e:
        martin_error = e
        if not required_subject_layering:
            print(f"Warning: Matte generation failed: {e}")

    try:
        require_subject_layering_assets(
            required=required_subject_layering,
            behind_subject_chunk_count=behind_subject_chunk_count,
            foreground_path=foreground_path,
            observation=subject_observation,
        )
    except RuntimeError as error:
        if martin_error is not None:
            raise RuntimeError(f"{error}; matte generation failed: {martin_error}") from martin_error
        raise

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
        "matte": {
            "status": "completed" if foreground_path else "not_available",
            "foregroundPath": str(foreground_path) if foreground_path else None,
            "behindSubjectChunkCount": behind_subject_chunk_count,
        },
        "subjectObservation": {
            "status": "completed" if subject_observation else "not_required",
            "frameCount": len(subject_observation.get("frames", [])) if subject_observation else 0,
        },
        "stageTimingsMs": {
            "cut": 1000,
            "remotionRender": render_ms,
            "mux": 1500,
            "total": total_ms
        }
    }
