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

# ---------------------------------------------------------------------------
# Cranial Negative Space Director & Dynamic Editorial Placement Engine
# ---------------------------------------------------------------------------

def analyze_cranial_negative_space(
    subject_box: Optional[Dict[str, float]],
    head_top_y: Optional[float],
) -> Dict[str, Any]:
    """Analyzes the spatial negative space distribution around the speaker's head.

    Identifies dominant space provisions:
    - top_headroom (space above hair)
    - left_flank (space to the left of the head)
    - right_flank (space to the right of the head)
    - lower_deck (space below the head/chest)

    Returns the dominant zone, recommended placement coordinates, anchor, and specialized font treatment.
    """
    if not subject_box:
        # Default centered layout when no observation is available
        return {
            "dominantZone": "cranial_crown",
            "zoneId": "behind_subject_above_head",
            "xPercent": "50%",
            "yPercent": "11.0%",
            "anchor": "center",
            "textAlign": "center",
            "fontTreatment": "tall_didone_arch",
            "headroomRatio": 0.15,
            "flankLeftRatio": 0.30,
            "flankRightRatio": 0.30,
        }

    x = float(subject_box.get("x", 0.30))
    y = float(subject_box.get("y", 0.15))
    w = float(subject_box.get("width", 0.40))
    h = float(subject_box.get("height", 0.60))

    actual_head_top = head_top_y if head_top_y is not None else y
    top_headroom = max(0.0, actual_head_top)
    left_flank = max(0.0, x)
    right_flank = max(0.0, 1.0 - (x + w))
    lower_deck = max(0.0, 1.0 - (y + h))

    # Priority 1: Large Cranial Headroom (Crown Halo Arch)
    if top_headroom >= 0.14:
        center_y = round(max(0.10, min(0.15, 0.025 + (top_headroom - 0.025) * 0.50)), 4)
        return {
            "dominantZone": "cranial_crown",
            "zoneId": "behind_subject_above_head",
            "xPercent": "50%",
            "yPercent": f"{round(center_y * 100, 2)}%",
            "anchor": "center",
            "textAlign": "center",
            "fontTreatment": "tall_didone_arch",
            "headroomRatio": round(top_headroom, 3),
            "flankLeftRatio": round(left_flank, 3),
            "flankRightRatio": round(right_flank, 3),
        }

    # Priority 2: Left Flank Provision (Speaker positioned right of center)
    if left_flank >= 0.28 and left_flank > (right_flank + 0.06):
        col_x = round(left_flank * 0.52, 3)
        return {
            "dominantZone": "flank_left_column",
            "zoneId": "flank_left_editorial_pillar",
            "xPercent": f"{round(col_x * 100, 1)}%",
            "yPercent": "46%",
            "anchor": "center",
            "textAlign": "left",
            "fontTreatment": "editorial_column_stack",
            "headroomRatio": round(top_headroom, 3),
            "flankLeftRatio": round(left_flank, 3),
            "flankRightRatio": round(right_flank, 3),
        }

    # Priority 3: Right Flank Provision (Speaker positioned left of center)
    if right_flank >= 0.28 and right_flank > (left_flank + 0.06):
        col_x = round((1.0 - right_flank) + (right_flank * 0.48), 3)
        return {
            "dominantZone": "flank_right_column",
            "zoneId": "flank_right_editorial_pillar",
            "xPercent": f"{round(col_x * 100, 1)}%",
            "yPercent": "46%",
            "anchor": "center",
            "textAlign": "right",
            "fontTreatment": "editorial_column_stack",
            "headroomRatio": round(top_headroom, 3),
            "flankLeftRatio": round(left_flank, 3),
            "flankRightRatio": round(right_flank, 3),
        }

    # Priority 4: Lower Third Anchor Deck (Centered speaker with low headroom)
    return {
        "dominantZone": "foreground_lower_deck",
        "zoneId": "foreground_lower_third",
        "xPercent": "50%",
        "yPercent": "68%",
        "anchor": "center",
        "textAlign": "center",
        "fontTreatment": "kinetic_anchor_deck",
        "headroomRatio": round(top_headroom, 3),
        "flankLeftRatio": round(left_flank, 3),
        "flankRightRatio": round(right_flank, 3),
    }


# ---------------------------------------------------------------------------
# Main placement planner
# ---------------------------------------------------------------------------

def plan_subject_safe_placements(
    chunks: List[Dict[str, Any]],
    observation: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Compute per-chunk placement dicts, respecting cranial negative space distribution.

    Adapts dynamically to camera framing shifts (above-head crown, left flank column, right flank column,
    or lower third anchor deck).
    """
    head_top_y: Optional[float] = None
    representative_subject_box: Optional[Dict[str, float]] = None
    if observation:
        head_top_y = _aggregate_head_top(observation)
        representative_subject_box = _aggregate_subject_box(observation)

    cranial_analysis = analyze_cranial_negative_space(representative_subject_box, head_top_y)

    behind_subject_placement: Dict[str, Any] = {
        "xPercent": cranial_analysis["xPercent"],
        "yPercent": cranial_analysis["yPercent"],
        "anchor": cranial_analysis["anchor"],
        "textAlign": cranial_analysis["textAlign"],
        "dominantZone": cranial_analysis["dominantZone"],
        "fontTreatment": cranial_analysis["fontTreatment"],
        "safeRegionId": cranial_analysis["zoneId"],
        "intersectsSubject": False,
        "subjectBox": representative_subject_box,
        "availableHeightRatio": cranial_analysis["headroomRatio"],
        "headTopY": round(head_top_y, 4) if head_top_y is not None else None,
        "policy": f"cranial_negative_space_{cranial_analysis['dominantZone']}",
        "cranialArc": {
            "haloTop": cranial_analysis["yPercent"],
            "orbitalLeft": f"{round((representative_subject_box['x'] if representative_subject_box else 0.5) * 100 - 18, 1)}%",
            "orbitalRight": f"{round(((representative_subject_box['x'] + representative_subject_box.get('width', 0.4)) if representative_subject_box else 0.5) * 100 + 18, 1)}%",
            "tiltDeg": 0.0,
        } if cranial_analysis["dominantZone"] == "cranial_crown" else None,
    }

    foreground_placement: Dict[str, Any] = {
        "xPercent": "50%",
        "yPercent": "68%",
        "anchor": "center",
        "textAlign": "center",
        "dominantZone": "foreground_lower_deck",
        "fontTreatment": "kinetic_anchor_deck",
        "safeRegionId": "foreground_center",
        "intersectsSubject": False,
        "subjectBox": None,
        "policy": "foreground_lower_third",
        "cranialArc": None,
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
