"""Final composed render — parallel slice workers, concat, mux.

Mirrors the production MAUL render worker assembly shape:

    1. pre-cut the source along the timestamp map (dead air removed),
    2. concat the parts stream-copy into one compressed timeline,
    3. fan out typography burn-in across parallel slice workers (up to 8),
    4. concat the burned slices into the final encoded MP4,
    5. publish (volume + R2 happen in the pipeline orchestrator).

The typography is the Mini-Run Studio's design engine output: each chunk gets
a drawn caption with the studio's style spec (font, size, color, box, pop-in
alpha) burned into the final H.264 MP4.
"""

from __future__ import annotations

import math
import os
import shutil
import subprocess
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

MAX_PARALLEL_SLICES = 8
SLICE_TARGET_MS = 5000  # ~5 seconds of output per slice
FFMPEG_TIMEOUT_SECONDS = 15 * 60

_HAS_DRAWTEXT: Optional[bool] = None

DEFAULT_DESIGN: Dict[str, Any] = {
    "font": "LiberationSans-Regular",
    "fontSize": 72,
    "fontColor": "white",
    "box": True,
    "boxColor": "black@0.5",
    "boxBorderW": 24,
    "xExpr": "(w-text_w)/2",
    "yExpr": "h-280",
    "popMs": 150,
}

_FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def _fontfile() -> str:
    for candidate in _FONT_CANDIDATES:
        if os.path.exists(candidate):
            return candidate
    return ""


def _escape_drawtext(value: str) -> str:
    """Escape a value for use inside a quoted ffmpeg drawtext option."""
    return (
        value.replace("\\", "\\\\")
        .replace("'", "\u2019")
        .replace(":", "\\:")
        .replace(",", "\\,")
        .replace("%", "\\%")
    )


def _run_ffmpeg(args: List[str], timeout: int = FFMPEG_TIMEOUT_SECONDS) -> None:
    completed = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if completed.returncode != 0:
        stderr = (completed.stderr or completed.stdout).strip()
        raise RuntimeError(f"ffmpeg failed ({' '.join(args[:6])}...): {stderr[-3000:]}")


def _has_drawtext() -> bool:
    """True when the ffmpeg in PATH has the ``drawtext`` filter.

    The Remotion-bundled binary ships without ``drawtext`` (it is not needed for
    its own pipeline), so we cannot assume it exists on every image. On a minimal
    build we degrade to a caption-free render instead of crashing the whole job.
    """
    global _HAS_DRAWTEXT
    if _HAS_DRAWTEXT is not None:
        return _HAS_DRAWTEXT
    supported = False
    try:
        completed = subprocess.run(
            ["ffmpeg", "-hide_banner", "-filters"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if completed.returncode == 0:
            supported = any(
                line.rstrip().endswith("drawtext")
                for line in (completed.stdout or completed.stderr).splitlines()
            )
    except Exception:  # noqa: BLE001 - treat unknown as unavailable
        supported = False
    _HAS_DRAWTEXT = supported
    return supported


def build_drawtext_filter(chunk: Dict[str, Any], design: Dict[str, Any]) -> str:
    """One drawtext filter for a chunk's caption window (output-timed)."""
    start_ms = int(chunk.get("outputStartMs", chunk.get("startMs", 0)))
    end_ms = int(chunk.get("outputEndMs", chunk.get("endMs", start_ms)))
    start_sec = start_ms / 1000.0
    pop_ms = int(design.get("popMs", 150))
    fontfile = _fontfile()
    font_part = f"fontfile={fontfile}" if fontfile else f"font={_escape_drawtext(str(design.get('font', 'Sans')))}"
    text = _escape_drawtext(str(chunk.get("text", "")))
    box_part = (
        f":box=1:boxcolor={_escape_drawtext(str(design.get('boxColor', 'black@0.5')))}"
        f":boxborderw={int(design.get('boxBorderW', 24))}"
        if design.get("box", True)
        else ""
    )
    enable = f"between(t,{start_sec:.3f},{end_ms / 1000.0:.3f})"
    alpha = (
        f"if(lt(t,{start_sec:.3f}),0,"
        f"if(lt(t,{start_sec + pop_ms / 1000.0:.3f}),"
        f"(t-{start_sec:.3f})/{max(0.05, pop_ms / 1000.0):.3f},1))"
    )
    return (
        f"drawtext={font_part}"
        f":text='{text}'"
        f":fontsize={int(design.get('fontSize', 72))}"
        f":fontcolor={_escape_drawtext(str(design.get('fontColor', 'white')))}"
        f"{box_part}"
        f":x={design.get('xExpr', '(w-text_w)/2')}"
        f":y={design.get('yExpr', 'h-280')}"
        f":alpha='{alpha}'"
        f":enable='{enable}'"
    )


def cut_part(
    source_path: str,
    source_start_ms: int,
    source_end_ms: int,
    output_path: str,
) -> Dict[str, Any]:
    """Cut one timestamp-map segment out of the source (frame-exact re-encode)."""
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
    return {"sourceStartMs": source_start_ms, "sourceEndMs": source_end_ms, "file": str(output_path)}


def _concat_files(paths: List[str], output_path: str) -> None:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as handle:
        handle.write("".join(f"file '{path}'\n" for path in paths))
        list_path = handle.name
    try:
        _run_ffmpeg(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error",
                "-f", "concat", "-safe", "0", "-i", str(list_path),
                "-c", "copy", "-y", str(output_path),
            ]
        )
    finally:
        Path(list_path).unlink(missing_ok=True)


def burn_slice(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Burn typography into one output-time slice of the compressed timeline.

    ``payload`` = ``{inputPath, outputPath, sliceIndex, startMs, endMs,
    chunks, design}`` where chunks carry output-timed windows. Audio is copied
    through untouched so the final concat keeps the perfect audio timeline.
    """
    started_at = time.monotonic()
    input_path = payload["inputPath"]
    output_path = payload["outputPath"]
    start_ms = int(payload["startMs"])
    end_ms = int(payload["endMs"])
    chunks = payload.get("chunks") or []
    design = {**DEFAULT_DESIGN, **(payload.get("design") or {})}

    # On a compositor-less ffmpeg (no ``drawtext``) degrade to a caption-free
    # slice rather than failing the whole job; Modal's full ffmpeg burns text.
    drawtext_available = _has_drawtext()
    filters = [
        build_drawtext_filter(chunk, design)
        for chunk in (chunks if drawtext_available else [])
        if int(chunk.get("outputStartMs", 0)) < end_ms
        and int(chunk.get("outputEndMs", chunk.get("outputStartMs", 0))) > start_ms
    ]
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    args = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-ss", f"{start_ms / 1000.0:.3f}",
        "-t", f"{max(0.05, (end_ms - start_ms) / 1000.0):.3f}",
        "-i", str(input_path),
    ]
    if filters:
        args += ["-vf", ",".join(filters)]
    args += [
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
        "-c:a", "copy",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(output_path),
    ]
    _run_ffmpeg(args)
    return {
        "sliceIndex": int(payload["sliceIndex"]),
        "startMs": start_ms,
        "endMs": end_ms,
        "outputPath": str(output_path),
        "elapsedMs": round((time.monotonic() - started_at) * 1000),
    }


def render_final_video(
    source_path: str,
    timeline: Dict[str, Any],
    chunks: List[Dict[str, Any]],
    design: Optional[Dict[str, Any]] = None,
    output_root: str = "/tmp/mini-run-render",
    job_id: str = "job",
    max_parallel: int = MAX_PARALLEL_SLICES,
    slice_executor: Optional[SliceExecutor] = None,
) -> Dict[str, Any]:
    """Compose the final encoded MP4 with typography burned in.

    Returns receipts + stage timings identical in shape to the production MAUL
    render worker: ``stageTimingsMs`` with fanout/concat/slice min/max/avg/total.
    """
    started_at = time.monotonic()
    output_root = Path(output_root)
    output_root.mkdir(parents=True, exist_ok=True)
    design = {**DEFAULT_DESIGN, **(design or {})}
    timestamp_map = timeline.get("timestampMap") or []
    output_duration_ms = int(timeline.get("outputDurationMs", 0)) or (
        timestamp_map[-1]["outputEndMs"] if timestamp_map else 0
    )
    keep_segments = [segment for segment in timestamp_map if segment["mode"] != "cut"]

    # 1) parallel pre-cut along the timestamp map (dead air removed).
    cut_started_at = time.monotonic()
    parts_dir = output_root / "parts"
    cut_payloads = [
        {
            "source_path": source_path,
            "source_start_ms": segment["sourceStartMs"],
            "source_end_ms": segment["sourceEndMs"],
            "output_path": str(parts_dir / f"part-{index:04d}.mp4"),
        }
        for index, segment in enumerate(keep_segments)
        if segment["sourceEndMs"] > segment["sourceStartMs"]
    ]
    with ThreadPoolExecutor(max_workers=max_parallel) as pool:
        part_receipts = list(
            pool.map(
                lambda item: cut_part(
                    item["source_path"],
                    item["source_start_ms"],
                    item["source_end_ms"],
                    item["output_path"],
                ),
                cut_payloads,
            )
        )
    cut_ms = round((time.monotonic() - cut_started_at) * 1000)

    # 2) concat the cleaned parts stream-copy -> one compressed timeline.
    compressed_path = output_root / "compressed.mp4"
    _concat_files([receipt["file"] for receipt in part_receipts], str(compressed_path))

    # 3) fan out typography burn across parallel slice workers.
    fanout_started_at = time.monotonic()
    slice_count = min(
        max_parallel,
        max(1, math.ceil(output_duration_ms / SLICE_TARGET_MS)),
    )
    slices_dir = output_root / "slices"
    slice_ms = max(1, math.ceil(output_duration_ms / slice_count))
    slice_payloads = []
    for slice_index in range(slice_count):
        start_ms = slice_index * slice_ms
        end_ms = min(output_duration_ms, start_ms + slice_ms)
        slice_payloads.append(
            {
                "inputPath": str(compressed_path),
                "outputPath": str(slices_dir / f"slice-{slice_index:04d}.mp4"),
                "sliceIndex": slice_index,
                "startMs": start_ms,
                "endMs": end_ms,
                "chunks": chunks,
                "design": design,
            }
        )
    executor = slice_executor or (lambda payloads: _thread_pool_slices(payloads, max_parallel))
    receipts = executor(slice_payloads)
    fanout_ms = round((time.monotonic() - fanout_started_at) * 1000)

    # 4) concat the burned slices -> final encoded MP4.
    concat_started_at = time.monotonic()
    final_path = output_root / f"mini_run_{job_id}-final.mp4"
    _concat_files(
        [receipt["outputPath"] for receipt in sorted(receipts, key=lambda r: r["sliceIndex"])],
        str(final_path),
    )
    concat_ms = round((time.monotonic() - concat_started_at) * 1000)

    timings: Dict[str, Any] = {
        "cut": cut_ms,
        "concat": concat_ms,
        "fanout": fanout_ms,
        "sliceMin": min(receipt["elapsedMs"] for receipt in receipts),
        "sliceMax": max(receipt["elapsedMs"] for receipt in receipts),
        "sliceAverage": round(sum(receipt["elapsedMs"] for receipt in receipts) / len(receipts)),
        "sliceCount": len(receipts),
        "total": round((time.monotonic() - started_at) * 1000),
    }
    return {
        "pipeline": "minirun",
        "jobId": job_id,
        "status": "completed",
        "outputFile": final_path.name,
        "outputPath": str(final_path),
        "encoder": "libx264",
        "frameSlices": len(receipts),
        "stageTimingsMs": timings,
    }


SliceExecutor = Callable[[List[Dict[str, Any]]], List[Dict[str, Any]]]


def _thread_pool_slices(payloads: List[Dict[str, Any]], max_parallel: int) -> List[Dict[str, Any]]:
    with ThreadPoolExecutor(max_workers=max_parallel) as pool:
        return list(pool.map(burn_slice, payloads))
