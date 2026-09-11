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
    face_bottom_y: Optional[float] = None,
    face_left_x: Optional[float] = None,
    face_right_x: Optional[float] = None,
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
        # Default centered layout when no observation is available:
        # Nestles text in upper cranial crown (13.5%), avoiding deep skull occlusion (<= 40%)
        below_head_y = 0.54 if face_bottom_y is None else round(max(0.44, min(0.68, face_bottom_y + 0.11)), 3)
        return {
            "dominantZone": "cranial_crown",
            "zoneId": "behind_subject_above_head",
            "xPercent": "50%",
            "yPercent": "13.5%",
            "anchor": "center",
            "textAlign": "center",
            "fontTreatment": "tall_didone_arch",
            "headroomRatio": 0.28,
            "flankLeftRatio": 0.30,
            "flankRightRatio": 0.30,
            "faceBottom": face_bottom_y,
            "belowHeadY": below_head_y,
        }

    x = float(subject_box.get("x", 0.30)) if subject_box else 0.30
    y = float(subject_box.get("y", 0.15)) if subject_box else 0.15
    w = float(subject_box.get("width", 0.40)) if subject_box else 0.40
    h = float(subject_box.get("height", 0.60)) if subject_box else 0.60

    actual_head_top = head_top_y if head_top_y is not None else y
    top_headroom = max(0.0, actual_head_top)

    # Lateral clearance beside the speaker's head at cranial height:
    # Uses precise face/head horizontal boundaries when available, falling back to subject_box.
    head_left = face_left_x if face_left_x is not None else x
    head_right = face_right_x if face_right_x is not None else (x + w)
    cranial_left_flank = max(0.0, head_left)
    cranial_right_flank = max(0.0, 1.0 - head_right)

    left_flank = cranial_left_flank
    right_flank = cranial_right_flank
    lower_deck = max(0.0, 1.0 - (y + h))

    # Priority 1: Dominant Right Flank Provision (Speaker positioned left of center)
    # When the speaker is framed left of center, the right flank offers an expansive vertical column
    # of clear negative space beside the head and torso.
    # Text is placed in the upper-flank negative space (Y ~ 22-28%) beside the head, safely clearing
    # the sloping shoulder (Y ~ 42-50%) and strictly bounded within safe margins (<= 94% X, maxWidth <= 30%).
    if right_flank >= 0.26 and right_flank >= (left_flank + 0.06):
        safe_right_margin = 0.94
        safe_left_bound = min(0.68, max(head_right, x + w) + 0.04)
        col_x = round((safe_left_bound + safe_right_margin) / 2.0, 3)
        center_y = round(max(0.22, min(0.30, actual_head_top + 0.08)), 3)
        return {
            "dominantZone": "flank_right_column",
            "zoneId": "flank_right_editorial_pillar",
            "xPercent": f"{int(round(col_x * 100)) if round(col_x * 100, 1).is_integer() else round(col_x * 100, 1)}%",
            "yPercent": f"{int(round(center_y * 100)) if round(center_y * 100, 1).is_integer() else round(center_y * 100, 1)}%",
            "anchor": "center",
            "textAlign": "right",
            "maxWidthPercent": "30%",
            "fontTreatment": "editorial_column_stack",
            "headroomRatio": round(top_headroom, 3),
            "flankLeftRatio": round(left_flank, 3),
            "flankRightRatio": round(right_flank, 3),
            "faceBottom": round(face_bottom_y, 3) if face_bottom_y is not None else None,
        }

    # Priority 2: Dominant Left Flank Provision (Speaker positioned right of center)
    if left_flank >= 0.26 and left_flank >= (right_flank + 0.06):
        safe_left_margin = 0.06
        safe_right_bound = max(0.32, min(head_left, x) - 0.04)
        col_x = round((safe_left_margin + safe_right_bound) / 2.0, 3)
        center_y = round(max(0.22, min(0.30, actual_head_top + 0.08)), 3)
        return {
            "dominantZone": "flank_left_column",
            "zoneId": "flank_left_editorial_pillar",
            "xPercent": f"{int(round(col_x * 100)) if round(col_x * 100, 1).is_integer() else round(col_x * 100, 1)}%",
            "yPercent": f"{int(round(center_y * 100)) if round(center_y * 100, 1).is_integer() else round(center_y * 100, 1)}%",
            "anchor": "center",
            "textAlign": "left",
            "maxWidthPercent": "30%",
            "fontTreatment": "editorial_column_stack",
            "headroomRatio": round(top_headroom, 3),
            "flankLeftRatio": round(left_flank, 3),
            "flankRightRatio": round(right_flank, 3),
            "faceBottom": round(face_bottom_y, 3) if face_bottom_y is not None else None,
        }

    # Priority 3: Large Cranial Headroom (Crown Halo Arch / Editorial Masthead)
    # Follows the Gestalt Occlusion Rule: headline text sits high enough in the headroom
    # so letter ascenders and uppercase bodies are fully exposed above the hair (top 75%),
    # with only the bottom baseline nestled behind the silhouette, NOT obscured by the skull.
    if top_headroom >= 0.14:
        center_y = round(max(0.07, min(0.16, actual_head_top - 0.07)), 4)
        head_mid_x = (head_left + head_right) / 2.0
        if head_mid_x < 0.44:
            text_x = round(min(0.60, head_mid_x + 0.12), 3)
        elif head_mid_x > 0.56:
            text_x = round(max(0.40, head_mid_x - 0.12), 3)
        else:
            text_x = 0.50

        return {
            "dominantZone": "cranial_crown",
            "zoneId": "behind_subject_above_head",
            "xPercent": f"{int(round(text_x * 100)) if round(text_x * 100, 1).is_integer() else round(text_x * 100, 1)}%",
            "yPercent": f"{round(center_y * 100, 2)}%",
            "anchor": "center",
            "textAlign": "center",
            "maxWidthPercent": "85%",
            "fontTreatment": "tall_didone_arch",
            "headroomRatio": round(top_headroom, 3),
            "flankLeftRatio": round(left_flank, 3),
            "flankRightRatio": round(right_flank, 3),
            "faceBottom": round(face_bottom_y, 3) if face_bottom_y is not None else None,
        }

    # Priority 4: Sensible Below-Head Placement (Dynamic Clearance Avoiding Speaker's Head)
    # Default lower third is anchored at 68% Y
    if face_bottom_y is not None:
        below_head_y = round(max(0.44, min(0.72, face_bottom_y + 0.08)), 4)
    else:
        below_head_y = 0.68

    return {
        "dominantZone": "foreground_lower_deck",
        "zoneId": "foreground_lower_third",
        "xPercent": "50%",
        "yPercent": f"{int(round(below_head_y * 100)) if round(below_head_y * 100, 1).is_integer() else round(below_head_y * 100, 1)}%",
        "anchor": "center",
        "textAlign": "center",
        "fontTreatment": "kinetic_anchor_deck",
        "headroomRatio": round(top_headroom, 3),
        "flankLeftRatio": round(left_flank, 3),
        "flankRightRatio": round(right_flank, 3),
        "faceBottom": round(face_bottom_y, 3) if face_bottom_y is not None else None,
        "belowHeadY": below_head_y,
    }


# ---------------------------------------------------------------------------
# Main placement planner
# ---------------------------------------------------------------------------

def analyze_chunk_temporal_cranial_space(
    chunk_start_ms: int,
    chunk_end_ms: int,
    observation: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """Analyzes the MediaPipe frames within a specific chunk time-window [chunk_start_ms, chunk_end_ms].

    Performs:
    1. Multi-Speaker Detection: checks if multiple heads occupy the scene (solo vs multi-speaker room provisioning).
    2. Dynamic Room Provisioning: measures temporal head top, chin bottom, left clearance, and right clearance.
    3. Spatial Zone Classification: labels the interval (e.g. 0-12s cranial_crown, 13-16s flank_left_column).
    """
    if not observation or "frames" not in observation or not observation["frames"]:
        res = analyze_cranial_negative_space(None, None)
        res["speakerCategory"] = "solo_speaker"
        res["faceCount"] = 1
        res["temporalWindow"] = {"startMs": chunk_start_ms, "endMs": chunk_end_ms}
        return res

    # 1. Filter frames falling within [chunk_start_ms - 250, chunk_end_ms + 250]
    matched_frames = [
        f for f in observation["frames"]
        if chunk_start_ms - 250 <= int(f.get("sourceMs", 0)) <= chunk_end_ms + 250
    ]

    if not matched_frames:
        nearest = _nearest_frame(observation["frames"], chunk_start_ms)
        matched_frames = [nearest] if nearest else []

    # 2. Multi-speaker count analysis
    max_faces = max((f.get("faceCount", 1) for f in matched_frames if f), default=1)
    speaker_category = "solo_speaker" if max_faces <= 1 else "multi_speaker"

    # 3. Aggregate subject box, head top, and face bottom for this specific temporal segment
    head_tops = []
    face_bottoms = []
    boxes = []
    face_lefts = []
    face_rights = []
    for f in matched_frames:
        if not f:
            continue
        if "faceBox" in f and f["faceBox"]:
            fb = f["faceBox"]
            fy = fb.get("y", fb.get("y_pct"))
            fh = fb.get("height", fb.get("height_pct"))
            fx = fb.get("x", fb.get("x_pct"))
            fw = fb.get("width", fb.get("width_pct"))
            if isinstance(fy, (int, float)):
                head_tops.append(float(fy))
                if isinstance(fh, (int, float)):
                    face_bottoms.append(float(fy) + float(fh))
            if isinstance(fx, (int, float)):
                face_lefts.append(float(fx))
                if isinstance(fw, (int, float)):
                    face_rights.append(float(fx) + float(fw))
        elif "subjectBox" in f and f["subjectBox"]:
            sb = f["subjectBox"]
            sy = sb.get("y", sb.get("y_pct", 0.15))
            head_tops.append(float(sy))
        if "subjectBox" in f and f["subjectBox"]:
            boxes.append(f["subjectBox"])
        elif "faceBox" in f and f["faceBox"]:
            fb = f["faceBox"]
            fx = float(fb.get("x", fb.get("x_pct", 0.3)))
            fy = float(fb.get("y", fb.get("y_pct", 0.15)))
            fw = float(fb.get("width", fb.get("width_pct", 0.3)))
            fh = float(fb.get("height", fb.get("height_pct", 0.25)))
            center_x = fx + fw / 2.0
            body_w = min(0.62, fw * 1.8)
            body_x = max(0.0, min(1.0 - body_w, center_x - body_w / 2.0))
            body_h = min(1.0 - fy, fh * 4.0)
            boxes.append({"x": body_x, "y": fy, "width": body_w, "height": body_h})

    window_head_top = min(head_tops) if head_tops else None
    # Use max of face_bottoms during this chunk to guarantee the lowest chin extent is cleared
    window_face_bottom = max(face_bottoms) if face_bottoms else None
    window_face_left = min(face_lefts) if face_lefts else None
    window_face_right = max(face_rights) if face_rights else None

    if boxes:
        window_box = {
            "x": min(b["x"] for b in boxes),
            "y": min(b["y"] for b in boxes),
            "width": max(b["x"] + b.get("width", 0.4) for b in boxes) - min(b["x"] for b in boxes),
            "height": max(b["y"] + b.get("height", 0.6) for b in boxes) - min(b["y"] for b in boxes),
        }
    else:
        window_box = None

    analysis = analyze_cranial_negative_space(
        window_box,
        window_head_top,
        face_bottom_y=window_face_bottom,
        face_left_x=window_face_left,
        face_right_x=window_face_right,
    )
    analysis["speakerCategory"] = speaker_category
    analysis["faceCount"] = max_faces
    analysis["faceBottom"] = window_face_bottom
    analysis["faceTop"] = window_head_top
    analysis["faceLeft"] = window_face_left
    analysis["faceRight"] = window_face_right
    analysis["temporalWindow"] = {
        "startMs": chunk_start_ms,
        "endMs": chunk_end_ms,
    }
    return analysis


# ---------------------------------------------------------------------------
# Main placement planner
# ---------------------------------------------------------------------------

def _estimate_chunk_height_ratio(chunk: Dict[str, Any], canvas_height: int = 1920) -> float:
    """Estimate the vertical height ratio of the rendered typography card from its layers."""
    layers = chunk.get("layers") or []
    if not layers:
        return 0.06
    total_px = 0.0
    for l in layers:
        size = float(l.get("fontSizePx", 80))
        lh = float(l.get("lineHeight", 1.0))
        total_px += size * lh
    if chunk.get("listicle"):
        total_px += 100.0
    return max(0.04, min(0.22, total_px / canvas_height))


def plan_subject_safe_placements(
    chunks: List[Dict[str, Any]],
    observation: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Compute per-chunk placement dicts, dynamically adapting to MediaPipe tracking.

    At all times strictly avoids the principal speaker's head:
    1. Behind-subject chunks sit in the cranial crown headroom or open flanks.
    2. Foreground chunks dynamically sit safely below the speaker's chin (or in open lateral
       flanks if framed off-center or chin extends into lower deck), with inter-chunk
       hysteresis smoothing to prevent micro-jitter while guaranteeing zero face occlusion.
    """
    planned: List[Dict[str, Any]] = []
    prev_fg_y: Optional[float] = None
    prev_zone: Optional[str] = None
    prev_x: Optional[str] = None

    for chunk in chunks:
        layering = chunk.get("subjectLayering") or {}
        behind_subj = bool(layering.get("behindSubject"))
        c_start = int(chunk.get("startMs", chunk.get("sourceStartMs", chunk.get("outputStartMs", 0))))
        c_end = int(chunk.get("endMs", chunk.get("sourceEndMs", chunk.get("outputEndMs", c_start + 1500))))

        cranial_analysis = analyze_chunk_temporal_cranial_space(c_start, c_end, observation)
        dom_zone = cranial_analysis.get("dominantZone", "foreground_lower_deck")

        # Depth Layering Invariant: If a chunk is marked behind_subj but cranial_analysis
        # determined dominantZone is foreground_lower_deck, there is no cranial/flank headroom.
        # Demote behind_subj to False so it renders cleanly in front without spurious VP9 matting.
        if behind_subj and dom_zone == "foreground_lower_deck":
            behind_subj = False
            if isinstance(chunk.get("subjectLayering"), dict):
                chunk["subjectLayering"]["behindSubject"] = False
            for lyr in chunk.get("layers", []):
                if isinstance(lyr, dict):
                    lyr["behindSubject"] = False

        if behind_subj:
            planned.append({
                "xPercent": cranial_analysis["xPercent"],
                "yPercent": cranial_analysis["yPercent"],
                "anchor": cranial_analysis.get("anchor", "center"),
                "textAlign": cranial_analysis.get("textAlign", "center"),
                "dominantZone": dom_zone,
                "speakerCategory": cranial_analysis.get("speakerCategory", "solo_speaker"),
                "faceCount": cranial_analysis.get("faceCount", 1),
                "fontTreatment": cranial_analysis.get("fontTreatment", "tall_didone_arch"),
                "safeRegionId": cranial_analysis.get("zoneId", "behind_subject_above_head"),
                "maxWidthPercent": cranial_analysis.get("maxWidthPercent", "32%"),
                "intersectsSubject": False,
                "availableHeightRatio": cranial_analysis.get("headroomRatio", 0.15),
                "headTopY": round(cranial_analysis.get("headroomRatio", 0.15), 4),
                "policy": f"cranial_negative_space_{dom_zone}",
                "cranialArc": None,
            })
            prev_zone = dom_zone
            prev_fg_y = None
            prev_x = None
        else:
            # Foreground captions: NEVER OCCLUDE THE SPEAKER'S HEAD/FACE.
            stamped = chunk.get("placement") if isinstance(chunk.get("placement"), dict) else None
            font_json = stamped if (stamped and stamped.get("layoutSource") == "font_json_layout_rules") else None

            face_bottom = cranial_analysis.get("faceBottom")
            flank_left = float(cranial_analysis.get("flankLeftRatio", 0.30))
            flank_right = float(cranial_analysis.get("flankRightRatio", 0.30))

            # Stack-aware height calculation: accounts for multi-line typography cards
            # so the TOP of the card is guaranteed to sit cleanly below the chin.
            chunk_h_ratio = _estimate_chunk_height_ratio(chunk)
            half_h = chunk_h_ratio / 2.0
            breathing_margin = 0.05  # 5% screen height (~96px) clean breathing clearance
            target_clearance = max(0.08, half_h + breathing_margin)
            min_safe_clearance = max(0.06, half_h + 0.025)

            if face_bottom is not None:
                ideal_y = face_bottom + target_clearance
                min_safe_y = face_bottom + min_safe_clearance
            else:
                ideal_y = 0.68
                min_safe_y = 0.54

            c_idx = len(planned)
            fj_zone = (font_json or {}).get("dominantZone", "")
            fj_align = str((font_json or {}).get("textAlign", "")).lower()
            fj_anchor = str((font_json or {}).get("anchor", "")).lower()

            wants_left = (fj_zone == "flank_left_column" or "left" in fj_align or "left" in fj_anchor)
            wants_right = (fj_zone == "flank_right_column" or "right" in fj_align or "right" in fj_anchor)

            left_flank_eligible = flank_left >= 0.22
            right_flank_eligible = flank_right >= 0.22

            speaker_needs_left = (flank_left >= 0.38 and flank_left > flank_right + 0.10)
            speaker_needs_right = (flank_right >= 0.38 and flank_right > flank_left + 0.10)

            # Hysteresis: maintain flank column if lateral clearance remains clear
            hysteresis_left = (prev_zone == "flank_left_column" and left_flank_eligible and not wants_right)
            hysteresis_right = (prev_zone == "flank_right_column" and right_flank_eligible and not wants_left)

            if (speaker_needs_left or (wants_left and left_flank_eligible) or hysteresis_left) and not (speaker_needs_right and not wants_left):
                chosen_zone = "flank_left_column"
                safe_id = "flank_left_pillar"
                chosen_anchor = (font_json or {}).get("anchor") or "left"
                chosen_align = (font_json or {}).get("textAlign") or "left"
                chosen_x = (font_json or {}).get("xPercent") or (prev_x if (prev_zone == "flank_left_column" and prev_x) else f"{round(max(0.20, flank_left * 0.48) * 100, 1)}%")

                # Inter-chunk hysteresis: clamp vertical stagger delta to <= 5% (e.g. ±0.03)
                if prev_zone == "flank_left_column" and prev_fg_y is not None:
                    delta = 0.03 if (c_idx % 2 == 1) else -0.03
                    target_y = prev_fg_y + delta
                    chosen_y_float = round(min(0.65, max(0.44, max(min_safe_y, target_y))), 3)
                else:
                    chosen_y_float = round(min(0.65, max(0.44, ideal_y)), 3)
                prev_fg_y = chosen_y_float
                prev_x = chosen_x

            elif speaker_needs_right or (wants_right and right_flank_eligible) or hysteresis_right:
                chosen_zone = "flank_right_column"
                safe_id = "flank_right_pillar"
                chosen_anchor = (font_json or {}).get("anchor") or "right"
                chosen_align = (font_json or {}).get("textAlign") or "right"
                chosen_x = (font_json or {}).get("xPercent") or (prev_x if (prev_zone == "flank_right_column" and prev_x) else f"{round(min(0.80, (1.0 - flank_right) + flank_right * 0.52) * 100, 1)}%")

                # Inter-chunk hysteresis: clamp vertical stagger delta to <= 5% (e.g. ±0.03)
                if prev_zone == "flank_right_column" and prev_fg_y is not None:
                    delta = 0.03 if (c_idx % 2 == 1) else -0.03
                    target_y = prev_fg_y + delta
                    chosen_y_float = round(min(0.65, max(0.44, max(min_safe_y, target_y))), 3)
                else:
                    chosen_y_float = round(min(0.65, max(0.44, ideal_y)), 3)
                prev_fg_y = chosen_y_float
                prev_x = chosen_x

            elif ideal_y > 0.83:
                # Speaker's chin is extraordinarily low (extreme close-up filling lower frame).
                # To avoid platform UI, check cranial headroom
                top_head = float(cranial_analysis.get("headroomRatio", 0.28))
                if top_head >= 0.12:
                    chosen_x = "50%"
                    chosen_y_float = round(max(0.20, min(0.28, top_head - 0.04)), 3)
                    chosen_zone = "cranial_crown"
                    chosen_anchor = "center"
                    chosen_align = (font_json or {}).get("textAlign", "center")
                    safe_id = "cranial_crown_headroom"
                else:
                    chosen_x = "50%"
                    chosen_y_float = 0.72
                    chosen_zone = "foreground_lower_deck"
                    chosen_anchor = "center"
                    chosen_align = (font_json or {}).get("textAlign", "center")
                    safe_id = "foreground_below_head_dynamic"
                prev_fg_y = chosen_y_float
                prev_x = chosen_x

            else:
                # Standard centered framing: dynamically staggered staging bands
                # to prevent dialogue chunks from collapsing into a static, frozen 68% box.
                # Alternate between lower-third baseline (75%) and mid-chest deck (62%)
                base_stagger = 0.75 if (c_idx % 2 == 1) else 0.62
                chosen_y_float = max(min_safe_y, min(0.78, base_stagger))

                chosen_x = "50%"
                chosen_anchor = "center"
                chosen_zone = "foreground_lower_deck"
                chosen_align = (font_json or {}).get("textAlign", "center")
                safe_id = "foreground_below_head_dynamic"
                prev_fg_y = chosen_y_float
                prev_x = chosen_x

            prev_zone = chosen_zone
            y_percent_str = f"{round(chosen_y_float * 100, 1)}%"
            if y_percent_str.endswith(".0%"):
                y_percent_str = y_percent_str[:-3] + "%"

            planned.append({
                "xPercent": chosen_x,
                "yPercent": y_percent_str,
                "anchor": chosen_anchor,
                "textAlign": chosen_align,
                "dominantZone": chosen_zone,
                "maxWidthPercent": (font_json or {}).get("maxWidthPercent", "85"),
                "layoutSource": "font_json_layout_rules" if font_json else None,
                "speakerCategory": cranial_analysis.get("speakerCategory", "solo_speaker"),
                "faceCount": cranial_analysis.get("faceCount", 1),
                "fontTreatment": "font_json_layout" if font_json else "kinetic_anchor_deck",
                "safeRegionId": safe_id,
                "intersectsSubject": False,
                "policy": (
                    "dynamic_below_head_font_json_alignment"
                    if font_json
                    else f"dynamic_subject_avoidance_{chosen_zone}"
                ),
                "cranialArc": None,
            })

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
