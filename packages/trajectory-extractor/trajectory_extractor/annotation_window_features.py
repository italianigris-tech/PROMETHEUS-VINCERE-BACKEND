"""Fold motion-cut evidence into trajectory windows for IRL feature trust."""

from __future__ import annotations

from typing import Any


def count_cuts_in_window(
    scene_starts_seconds: list[float],
    window_start: float,
    window_end: float,
) -> int:
    return sum(1 for stamp in scene_starts_seconds if window_start <= stamp < window_end)


def apply_motion_cut_counts(
    trajectory: dict[str, Any],
    motion_cut_evidence: dict[str, Any],
) -> dict[str, Any]:
    """
    Repair camera.shot_change_count from ffmpeg scene evidence when present.

    Does not invent zeros: if no scene starts are available, leaves existing values.
    """
    scene_starts = motion_cut_evidence.get("scene_starts_seconds") or motion_cut_evidence.get("scene_starts") or []
    if not isinstance(scene_starts, list) or len(scene_starts) == 0:
        return trajectory

    starts = [float(value) for value in scene_starts if isinstance(value, (int, float))]
    windows = trajectory.get("windows")
    if not isinstance(windows, list):
        return trajectory

    for window in windows:
        if not isinstance(window, dict):
            continue
        start = window.get("start_seconds", window.get("start_s"))
        end = window.get("end_seconds", window.get("end_s"))
        if not isinstance(start, (int, float)) or not isinstance(end, (int, float)):
            # fall back to center ± 0.5s if only center exists
            center = window.get("center_seconds")
            if isinstance(center, (int, float)):
                start = float(center) - 0.5
                end = float(center) + 0.5
            else:
                continue
        features = window.get("features")
        if not isinstance(features, dict):
            features = window.setdefault("features", {})
        camera = features.get("camera")
        if not isinstance(camera, dict):
            camera = features.setdefault("camera", {})
        camera["shot_change_count"] = min(5, count_cuts_in_window(starts, float(start), float(end)))
        camera["shot_change_source"] = "motion_cut_evidence"
    return trajectory
