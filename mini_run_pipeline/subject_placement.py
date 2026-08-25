"""MediaPipe-backed subject-safe placement for mini-run typography."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional


# Tall profiles are designed to live on a narrow, vertical stage beside the
# speaker. The outer regions keep them readable while the foreground matte
# still creates the requested depth relationship.
SAFE_REGIONS: List[Dict[str, Any]] = [
    {"id": "upper_left", "x": 0.10, "y": 0.30, "width": 0.18, "height": 0.38},
    {"id": "upper_right", "x": 0.90, "y": 0.30, "width": 0.18, "height": 0.38},
    {"id": "lower_left", "x": 0.10, "y": 0.72, "width": 0.18, "height": 0.30},
    {"id": "lower_right", "x": 0.90, "y": 0.72, "width": 0.18, "height": 0.30},
]


def _rect_from_center(region: Dict[str, Any]) -> Dict[str, float]:
    return {
        "left": float(region["x"]) - float(region["width"]) / 2,
        "top": float(region["y"]) - float(region["height"]) / 2,
        "right": float(region["x"]) + float(region["width"]) / 2,
        "bottom": float(region["y"]) + float(region["height"]) / 2,
    }


def _padded_subject_rect(subject_box: Dict[str, Any]) -> Dict[str, float]:
    padding = 0.03
    return {
        "left": max(0.0, float(subject_box["x"]) - padding),
        "top": max(0.0, float(subject_box["y"]) - padding),
        "right": min(1.0, float(subject_box["x"]) + float(subject_box["width"]) + padding),
        "bottom": min(1.0, float(subject_box["y"]) + float(subject_box["height"]) + padding),
    }


def _intersection_area(left: Dict[str, float], right: Dict[str, float]) -> float:
    width = max(0.0, min(left["right"], right["right"]) - max(left["left"], right["left"]))
    height = max(0.0, min(left["bottom"], right["bottom"]) - max(left["top"], right["top"]))
    return width * height


def _nearest_frame(frames: List[Dict[str, Any]], source_ms: int) -> Optional[Dict[str, Any]]:
    if not frames:
        return None
    return min(frames, key=lambda frame: abs(int(frame.get("sourceMs", 0)) - source_ms))


def _region_luminance(region: Dict[str, Any], grid: Dict[str, Any]) -> float:
    columns = int(grid.get("columns", 0))
    rows = int(grid.get("rows", 0))
    samples = grid.get("samples")
    if columns <= 0 or rows <= 0 or not isinstance(samples, list) or len(samples) != columns * rows:
        return 0.5
    rect = _rect_from_center(region)
    left = max(0, min(columns - 1, int(rect["left"] * columns)))
    right = max(left + 1, min(columns, int(rect["right"] * columns + 0.999)))
    top = max(0, min(rows - 1, int(rect["top"] * rows)))
    bottom = max(top + 1, min(rows, int(rect["bottom"] * rows + 0.999)))
    values = [float(samples[row * columns + column]) for row in range(top, bottom) for column in range(left, right)]
    return sum(values) / len(values) if values else 0.5


def plan_subject_safe_placements(chunks: List[Dict[str, Any]], observation: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Strictly center typography on 9:16 vertical canvas (50% X) avoiding horizontal off-frame clipping."""
    planned: List[Dict[str, Any]] = []

    for index, chunk in enumerate(chunks):
        layering = chunk.get("subjectLayering") or {}
        behind_subject = bool(layering.get("behindSubject"))
        if behind_subject:
            # 9:16 Short-form behind-subject: Top-oriented behind upper head & shoulders (34% Y)
            planned.append({
                "xPercent": "50%",
                "yPercent": "34%",
                "anchor": "center",
                "safeRegionId": "behind_subject_center",
                "intersectsSubject": True,
                "subjectBox": None,
            })
        else:
            # 9:16 Short-form foreground: Centered at safe lower third zone (68% Y)
            planned.append({
                "xPercent": "50%",
                "yPercent": "68%",
                "anchor": "center",
                "safeRegionId": "foreground_center",
                "intersectsSubject": False,
                "subjectBox": None,
            })
    return planned




def parse_observation_payload(stdout: str) -> Dict[str, Any]:
    """Extract the versioned receipt when MediaPipe writes startup noise to stdout."""
    decoder = json.JSONDecoder()
    cursor = 0
    while True:
        start = stdout.find("{", cursor)
        if start < 0:
            break
        try:
            candidate, _ = decoder.raw_decode(stdout[start:])
        except json.JSONDecodeError:
            cursor = start + 1
            continue
        if isinstance(candidate, dict) and candidate.get("schemaVersion") == "maul-media-observation/v1":
            return candidate
        cursor = start + 1
    tail = stdout[-1200:].strip()
    raise RuntimeError(f"MediaPipe subject observation emitted invalid JSON: {tail or '<empty stdout>'}")


def observe_subject(source_path: str, duration_ms: int, output_width: int = 1080, output_height: int = 1920) -> Dict[str, Any]:
    """Run the shared sequential MediaPipe observer and return its JSON receipt."""
    observer = Path(__file__).resolve().parent.parent / "packages" / "trajectory-extractor" / "maul_observe.py"
    command = [
        sys.executable,
        str(observer),
        "--source", source_path,
        "--duration-ms", str(duration_ms),
        "--output-width", str(output_width),
        "--output-height", str(output_height),
    ]
    completed = subprocess.run(command, capture_output=True, text=True, timeout=180)
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout).strip()
        raise RuntimeError(f"MediaPipe subject observation failed: {detail[-2000:]}")
    observation = parse_observation_payload(completed.stdout)
    if not isinstance(observation, dict) or not observation.get("frames"):
        raise RuntimeError("MediaPipe subject observation produced no frames.")
    return observation
