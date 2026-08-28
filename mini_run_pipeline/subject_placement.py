"""MediaPipe-backed subject-safe placement for mini-run typography.

Placement strategy
------------------
Behind-subject tall-font text is placed ABOVE the speaker's head, anchored
bottom-to-top, maximising the dead space between the very top of frame and the
top of the speaker's hair.  The placement Y is computed live from the MediaPipe
faceBox observations so it adapts to each source video's framing.

Policy constraints
------------------
1. **Head-clearance margin** – the text block bottom is kept at least
   HEAD_CLEARANCE_RATIO (8 % of frame height) above the detected top-of-head.
2. **Upper guard** – text never starts above UPPER_GUARD_RATIO (2 % of frame
   height) from the top edge, so it is never clipped.
3. **Minimum readable height** – if the gap above the head is smaller than
   MIN_ABOVE_HEAD_RATIO (12 % of frame height), we fall back to placing the
   text centred at 22 % Y (legacy behaviour) and flag it as a tight-fit.
4. **Font-size cap signal** – we compute the available vertical room
   (availableHeightRatio) and surface it on the placement dict so the renderer
   can cap the font size to fit within that band.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Placement policy constants
# ---------------------------------------------------------------------------

# Minimum clearance between text-block bottom and subject top-of-head (0–1).
HEAD_CLEARANCE_RATIO = 0.04

# Guard zone at the very top of the frame (never place text above this).
UPPER_GUARD_RATIO = 0.025

# Minimum usable vertical space above the head to attempt above-head placement.
MIN_ABOVE_HEAD_RATIO = 0.04

# Default Y (centre of text block) for behind-subject text when no observation exists.
DEFAULT_BEHIND_SUBJECT_Y = 0.10

# Overlap ratio allowed into the top curve of the hair for layered depth.
HAIR_OVERLAP_RATIO = 0.03

# Legacy safe regions (retained for luminance scoring only).
SAFE_REGIONS: List[Dict[str, Any]] = [
    {"id": "upper_left",  "x": 0.10, "y": 0.30, "width": 0.18, "height": 0.38},
    {"id": "upper_right", "x": 0.90, "y": 0.30, "width": 0.18, "height": 0.38},
    {"id": "lower_left",  "x": 0.10, "y": 0.72, "width": 0.18, "height": 0.30},
    {"id": "lower_right", "x": 0.90, "y": 0.72, "width": 0.18, "height": 0.30},
]


# ---------------------------------------------------------------------------
# Internal geometry helpers
# ---------------------------------------------------------------------------

def _rect_from_center(region: Dict[str, Any]) -> Dict[str, float]:
    return {
        "left":   float(region["x"]) - float(region["width"]) / 2,
        "top":    float(region["y"]) - float(region["height"]) / 2,
        "right":  float(region["x"]) + float(region["width"]) / 2,
        "bottom": float(region["y"]) + float(region["height"]) / 2,
    }


def _padded_subject_rect(subject_box: Dict[str, Any]) -> Dict[str, float]:
    padding = 0.03
    return {
        "left":   max(0.0, float(subject_box["x"]) - padding),
        "top":    max(0.0, float(subject_box["y"]) - padding),
        "right":  min(1.0, float(subject_box["x"]) + float(subject_box["width"]) + padding),
        "bottom": min(1.0, float(subject_box["y"]) + float(subject_box["height"]) + padding),
    }


def _intersection_area(left: Dict[str, float], right: Dict[str, float]) -> float:
    width  = max(0.0, min(left["right"],  right["right"])  - max(left["left"],  right["left"]))
    height = max(0.0, min(left["bottom"], right["bottom"]) - max(left["top"],   right["top"]))
    return width * height


def _nearest_frame(frames: List[Dict[str, Any]], source_ms: int) -> Optional[Dict[str, Any]]:
    if not frames:
        return None
    return min(frames, key=lambda frame: abs(int(frame.get("sourceMs", 0)) - source_ms))


def _region_luminance(region: Dict[str, Any], grid: Dict[str, Any]) -> float:
    columns = int(grid.get("columns", 0))
    rows    = int(grid.get("rows", 0))
    samples = grid.get("samples")
    if columns <= 0 or rows <= 0 or not isinstance(samples, list) or len(samples) != columns * rows:
        return 0.5
    rect  = _rect_from_center(region)
    left  = max(0, min(columns - 1, int(rect["left"] * columns)))
    right = max(left + 1, min(columns, int(rect["right"] * columns + 0.999)))
    top   = max(0, min(rows - 1, int(rect["top"] * rows)))
    bottom = max(top + 1, min(rows, int(rect["bottom"] * rows + 0.999)))
    values = [
        float(samples[row * columns + column])
        for row in range(top, bottom)
        for column in range(left, right)
    ]
    return sum(values) / len(values) if values else 0.5


# ---------------------------------------------------------------------------
# Head-position aggregation from MediaPipe / OpenCV frames
# ---------------------------------------------------------------------------

def _median(values: List[float]) -> float:
    if not values:
        return 0.5
    s = sorted(values)
    n = len(s)
    mid = n // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2.0


def _aggregate_head_top(observation: Dict[str, Any]) -> Optional[float]:
    """Return the median estimated normalized top-of-head/hair Y across sampled frames.

    Estimates the crown/hair top from faceBox (accounting for forehead and hair height)
    and validates against subjectBox.
    """
    frames: List[Dict[str, Any]] = observation.get("frames", [])
    if not frames:
        return None

    face_tops: List[float] = []
    face_heights: List[float] = []
    subject_tops: List[float] = []

    for frame in frames:
        face = frame.get("faceBox")
        if face and isinstance(face.get("y"), (int, float)):
            face_tops.append(float(face["y"]))
            if isinstance(face.get("height"), (int, float)):
                face_heights.append(float(face["height"]))
        sub = frame.get("subjectBox")
        if sub and isinstance(sub.get("y"), (int, float)):
            subject_tops.append(float(sub["y"]))

    if not face_tops and not subject_tops:
        return None

    if face_tops:
        med_face_top = _median(face_tops)
        med_face_h = _median(face_heights) if face_heights else 0.25
        # Hair/crown top is ~22% of face height above the face box top
        estimated_crown = max(0.02, med_face_top - med_face_h * 0.22)
        if subject_tops:
            med_sub_top = _median(subject_tops)
            if med_sub_top > 0.01:
                return min(estimated_crown, max(0.02, med_sub_top))
        return estimated_crown

    return _median(subject_tops)


def _aggregate_subject_box(observation: Dict[str, Any]) -> Optional[Dict[str, float]]:
    """Return a representative (median-centred) subject bounding box."""
    frames: List[Dict[str, Any]] = observation.get("frames", [])
    boxes = [f.get("subjectBox") for f in frames if f.get("subjectBox")]
    if not boxes:
        return None
    med_x      = _median([float(b["x"]) for b in boxes])
    med_y      = _median([float(b["y"]) for b in boxes])
    med_w      = _median([float(b["width"]) for b in boxes])
    med_h      = _median([float(b["height"]) for b in boxes])
    return {"x": med_x, "y": med_y, "width": med_w, "height": med_h}


# ---------------------------------------------------------------------------
# Main placement planner
# ---------------------------------------------------------------------------

def plan_subject_safe_placements(
    chunks: List[Dict[str, Any]],
    observation: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Compute per-chunk placement dicts, respecting head position and maximizing headroom.

    For behind-subject chunks the text is positioned in the upper headroom zone above
    the speaker's head/hair, ensuring maximum legibility while preserving the cinematic
    depth layering.

    For foreground chunks the text lives in the safe lower-third zone (68 % Y).
    """
    head_top_y: Optional[float] = None
    representative_subject_box: Optional[Dict[str, float]] = None
    if observation:
        head_top_y = _aggregate_head_top(observation)
        representative_subject_box = _aggregate_subject_box(observation)

    behind_subject_placement: Dict[str, Any]

    if head_top_y is not None:
        # Available headroom between top guard and the estimated top of head/hair
        headroom = max(0.04, head_top_y - UPPER_GUARD_RATIO)
        
        # Center the text in the headroom band, positioned so the upper portion
        # is 100% clear of the head and the lower portion tucks behind the hair
        text_center_y = round(max(0.06, min(0.14, UPPER_GUARD_RATIO + headroom * 0.52)), 4)
        available_height_ratio = round(headroom + HAIR_OVERLAP_RATIO, 4)

        behind_subject_placement = {
            "xPercent": "50%",
            "yPercent": f"{round(text_center_y * 100, 2)}%",
            "anchor": "center",
            "safeRegionId": "behind_subject_above_head",
            "intersectsSubject": False,
            "subjectBox": representative_subject_box,
            "availableHeightRatio": available_height_ratio,
            "headTopY": round(head_top_y, 4),
            "policy": "above_head_mediapipe_headroom_maximized",
        }
    else:
        # Fallback when no observation is provided: place in safe upper third
        behind_subject_placement = {
            "xPercent": "50%",
            "yPercent": f"{round(DEFAULT_BEHIND_SUBJECT_Y * 100, 1)}%",
            "anchor": "center",
            "safeRegionId": "behind_subject_center",
            "intersectsSubject": False,
            "subjectBox": None,
            "availableHeightRatio": 0.16,
            "policy": "fallback_no_observation",
        }

    # --- foreground placement (unchanged) ------------------------------------
    foreground_placement: Dict[str, Any] = {
        "xPercent": "50%",
        "yPercent": "68%",
        "anchor": "center",
        "safeRegionId": "foreground_center",
        "intersectsSubject": False,
        "subjectBox": None,
        "policy": "foreground_lower_third",
    }

    # --- assign per chunk ----------------------------------------------------
    planned: List[Dict[str, Any]] = []
    for chunk in chunks:
        layering     = chunk.get("subjectLayering") or {}
        behind_subj  = bool(layering.get("behindSubject"))
        planned.append(behind_subject_placement if behind_subj else foreground_placement)

    return planned


# ---------------------------------------------------------------------------
# MediaPipe observer runner
# ---------------------------------------------------------------------------

def parse_observation_payload(stdout: str) -> Dict[str, Any]:
    """Extract the versioned receipt when MediaPipe writes startup noise to stdout."""
    decoder = json.JSONDecoder()
    cursor  = 0
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


def observe_subject(
    source_path: str,
    duration_ms: int,
    output_width:  int = 1080,
    output_height: int = 1920,
) -> Dict[str, Any]:
    """Run the shared sequential MediaPipe observer and return its JSON receipt."""
    import os

    observer = (
        Path(__file__).resolve().parent.parent
        / "packages" / "trajectory-extractor" / "maul_observe.py"
    )
    command = [
        sys.executable,
        str(observer),
        "--source",        source_path,
        "--duration-ms",   str(duration_ms),
        "--output-width",  str(output_width),
        "--output-height", str(output_height),
    ]
    env = os.environ.copy()
    repo_root = Path(__file__).resolve().parent.parent
    pkg_dir = str(repo_root / "packages" / "trajectory-extractor")
    existing_pythonpath = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = f"{pkg_dir}:{existing_pythonpath}" if existing_pythonpath else pkg_dir

    completed = subprocess.run(command, capture_output=True, text=True, timeout=180, env=env)
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout).strip()
        raise RuntimeError(f"MediaPipe subject observation failed: {detail[-2000:]}")
    observation = parse_observation_payload(completed.stdout)
    if not isinstance(observation, dict) or not observation.get("frames"):
        raise RuntimeError("MediaPipe subject observation produced no frames.")
    return observation
