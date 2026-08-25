"""Causal visual orchestration for the portrait Mini Runs renderer."""

from __future__ import annotations

import random
import secrets
from typing import Any, Dict, List, Optional


CAMERA_CURVE = [0.16, 1.0, 0.3, 1.0]


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _timing(chunk: Dict[str, Any], index: int, duration_ms: int) -> tuple[int, int]:
    start = int(chunk.get("displayStartMs", chunk.get("outputStartMs", chunk.get("startMs", 0))))
    end = int(chunk.get("displayEndMs", chunk.get("outputEndMs", chunk.get("endMs", duration_ms))))
    start = max(0, min(start, duration_ms))
    end = max(start + 1, min(end, duration_ms))
    if index == 0:
        start = 0
    return start, end


def _salience(chunk: Dict[str, Any]) -> float:
    layers = chunk.get("layers") or []
    hero = bool(chunk.get("isHero") or any(layer.get("isHero") for layer in layers))
    words = len(str(chunk.get("text", "")).split())
    compactness = 1.0 - min(1.0, abs(words - 4) / 8.0)
    return _clamp((0.55 if hero else 0.25) + compactness * 0.35, 0.0, 1.0)


def _nearest_subject_x(subject_observation: Optional[Dict[str, Any]], midpoint_ms: int) -> float:
    frames = (subject_observation or {}).get("frames") or []
    usable = [frame for frame in frames if isinstance(frame.get("subjectBox"), dict)]
    if not usable:
        return 50.0
    frame = min(usable, key=lambda item: abs(int(item.get("sourceMs", 0)) - midpoint_ms))
    box = frame["subjectBox"]
    x = float(box.get("x", 0.25)) + float(box.get("width", 0.5)) / 2.0
    return round(_clamp(x * 100.0, 24.0, 76.0), 2)


def plan_mini_run_orchestration(
    *,
    chunks: List[Dict[str, Any]],
    probe: Dict[str, Any],
    duration_ms: int,
    design: Optional[Dict[str, Any]] = None,
    subject_observation: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Plan visual events whose dependencies are explicit and auditable."""
    design = dict(design or {})
    duration_ms = max(1, int(duration_ms))
    nonce = secrets.token_hex(24)
    rng = random.Random(nonce)
    intensity = _clamp(float(design.get("visualIntensity", 0.68)), 0.0, 1.0)
    pip_policy = str(design.get("pipPolicy", "auto"))
    width = max(1, int(probe.get("width", 0) or 1))
    height = max(1, int(probe.get("height", 0) or 1))
    landscape_source = width / height >= 1.35

    if not chunks:
        chunks = [{"chunkIndex": 0, "text": "", "outputStartMs": 0, "outputEndMs": duration_ms}]

    ranked_pip = sorted(
        range(len(chunks)),
        key=lambda index: (_salience(chunks[index]) + rng.random() * 0.18, rng.random()),
        reverse=True,
    )
    pip_indices: set[int] = set()
    if landscape_source and pip_policy != "disabled" and len(chunks) > 1:
        rate = 0.46 if pip_policy in {"featured", "required"} else 0.18 + intensity * 0.16
        count = max(1, min(len(chunks) - 1, round(len(chunks) * rate)))
        eligible = [index for index in ranked_pip if index != 0]
        pip_indices.update(eligible[:count])

    scenes: List[Dict[str, Any]] = []
    for index, chunk in enumerate(chunks):
        start_ms, end_ms = _timing(chunk, index, duration_ms)
        if scenes:
            start_ms = scenes[-1]["endMs"]
        if index == len(chunks) - 1:
            end_ms = duration_ms
        end_ms = max(start_ms + 1, end_ms)
        layout = "floating_pip" if index in pip_indices else "pan_scan"
        scene_id = f"scene-{index + 1}"
        midpoint = start_ms + (end_ms - start_ms) // 2
        scenes.append({
            "id": scene_id,
            "startMs": start_ms,
            "endMs": min(duration_ms, end_ms),
            "layout": layout,
            "salience": round(_salience(chunk), 3),
            "sourceAspectRatio": round(width / height, 4),
            "focalPoint": {"xPercent": _nearest_subject_x(subject_observation, midpoint), "yPercent": 42.0},
            "cause": {
                "gate": "chunk_visual_treatment",
                "chunkIds": [str(chunk.get("chunkIndex", index))],
                "reason": "Layout selected from source aspect, salience, subject position, and recent treatment usage.",
            },
        })

    backgrounds: List[Dict[str, Any]] = []
    pip: List[Dict[str, Any]] = []
    for scene in scenes:
        if scene["layout"] != "floating_pip":
            continue
        backgrounds.append({
            "id": f"background-{scene['id']}",
            "sceneId": scene["id"],
            "kind": "blurred_wings",
            "blurPx": round(40 + intensity * 20),
            "brightness": round(0.8 - intensity * 0.1, 3),
            "counterScale": [1.05, 1.0],
            "cause": {"gate": "pip_depth_support", "causedBySceneId": scene["id"]},
        })
        pip.append({
            "id": f"pip-{scene['id']}",
            "sceneId": scene["id"],
            "aspectRatio": 16 / 9,
            "cornerRadiusPx": round(16 + intensity * 8),
            "shadow": {"distancePx": 20, "blurPx": 45, "opacity": 0.35, "angleDeg": 120},
            "microDriftScale": [1.0, 1.03],
            "entryScale": [1.1, round(1.04 + intensity * 0.02, 3), 1.0],
            "curve": CAMERA_CURVE,
            "cause": {"gate": "landscape_source_reframe", "causedBySceneId": scene["id"]},
        })

    transitions: List[Dict[str, Any]] = []
    camera_moves: List[Dict[str, Any]] = []
    sfx: List[Dict[str, Any]] = []
    transition_effects = ["defocus_blend", "bezier_push", "camera_pass"]
    last_transition_ms = -100000
    min_gap_ms = int(design.get("transitionMinGapMs", 1200))
    for previous, current in zip(scenes, scenes[1:]):
        if previous["layout"] == current["layout"] or current["startMs"] - last_transition_ms < min_gap_ms:
            continue
        duration = round(360 + intensity * 260)
        start_ms = max(previous["startMs"], current["startMs"] - duration // 2)
        end_ms = min(current["endMs"], start_ms + duration)
        transition_id = f"transition-{len(transitions) + 1}"
        transition = {
            "id": transition_id,
            "startMs": start_ms,
            "endMs": end_ms,
            "peakVelocityMs": start_ms + round((end_ms - start_ms) * 0.48),
            "effect": rng.choice(transition_effects),
            "fromSceneId": previous["id"],
            "toSceneId": current["id"],
            "causedBySceneId": current["id"],
        }
        transitions.append(transition)
        last_transition_ms = current["startMs"]
        camera_moves.append({
            "id": f"camera-{transition_id}",
            "startMs": start_ms,
            "endMs": end_ms,
            "kind": "push_in" if current["layout"] == "floating_pip" else "settle_out",
            "curve": CAMERA_CURVE,
            "overshootScale": round(min(1.06, 1.04 + intensity * 0.02), 3),
            "causedByTransitionId": transition_id,
        })
        sfx.append({
            "id": f"sfx-{transition_id}",
            "cue": "whoosh_slow" if end_ms - start_ms >= 500 else "whoosh_fast",
            "triggerMs": transition["peakVelocityMs"],
            "gainDb": -15.0,
            "causedByTransitionId": transition_id,
        })

    return {
        "version": "1.0",
        "selectionMode": "entropy",
        "selectionNonce": nonce,
        "durationMs": duration_ms,
        "scenes": scenes,
        "transitions": transitions,
        "cameraMoves": camera_moves,
        "backgrounds": backgrounds,
        "pip": pip,
        "sfx": sfx,
    }
