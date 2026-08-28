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

    # PiP treatments are strictly prohibited in mini runs (portrait 9:16 shorts).
    # All scenes use pan_scan with subject tracking.
    scenes: List[Dict[str, Any]] = []
    for index, chunk in enumerate(chunks):
        start_ms, end_ms = _timing(chunk, index, duration_ms)
        if scenes:
            start_ms = scenes[-1]["endMs"]
        if index == len(chunks) - 1:
            end_ms = duration_ms
        end_ms = max(start_ms + 1, end_ms)
        layout = "pan_scan"
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
                "reason": "Pan & scan layout with subject tracking selected for portrait mini run.",
            },
        })

    # Smooth focal points across scenes using a 3-tap moving average to eliminate camera jitter
    if len(scenes) > 1:
        raw_xs = [float(s["focalPoint"]["xPercent"]) for s in scenes]
        smoothed_xs = []
        for i in range(len(raw_xs)):
            window = raw_xs[max(0, i - 1):min(len(raw_xs), i + 2)]
            smoothed_xs.append(round(sum(window) / len(window), 2))
        for s, sx in zip(scenes, smoothed_xs):
            s["focalPoint"]["xPercent"] = sx

    # Background placement: decide when/where to drop a texture backdrop behind the
    # kinetic text (foreground chunks only, so text always renders atop the canvas).
    # Extracted to portrait/causal logic in backgrounds.py and wired in so the
    # portrait stage finally receives a populated ``backgrounds`` list.
    backgrounds: List[Dict[str, Any]] = []
    try:
        from mini_run_pipeline.backgrounds import govern_backgrounds, plan_backgrounds

        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=scenes,
            design=design,
            duration_ms=duration_ms,
        )
        governance = govern_backgrounds(backgrounds, scenes)
        if governance:
            print(f"[orchestration] background governance warnings: {governance}", flush=True)
    except Exception as exc:  # never let a backdrop decision break the render
        print(f"[orchestration] background planning skipped: {exc}", flush=True)
        backgrounds = []
    pip: List[Dict[str, Any]] = []

    transitions: List[Dict[str, Any]] = []
    sfx: List[Dict[str, Any]] = []

    # 1. Opening Hook Audio Impact (Frame 0)
    hook_plan = chunks[0].get("hookPlan") if chunks else None
    if hook_plan and hook_plan.get("hookEnabled"):
        hook_type = hook_plan.get("hookType", "")
        if "glitch" in hook_type:
            hook_sfx_cue = "glitch_digital"
        elif "flash" in hook_type or "flare" in hook_type:
            hook_sfx_cue = "impact_sharp"
        elif "dolly" in hook_type or "crash" in hook_type:
            hook_sfx_cue = "sub_drop"
        else:
            hook_sfx_cue = "impact_deep"
        sfx.append({
            "id": "sfx-hook-impact-0",
            "cue": hook_sfx_cue,
            "variant": rng.randint(1, 5),
            "triggerMs": 0,
            "gainDb": -11.0,
            "causedByHook": hook_type,
        })

    transition_effects = [
        "film_burn_strobe",
        "bokeh_defocus_blend",
        "flash_cut",
        "whip_pan_blur",
        "camera_crash_snap",
    ]
    last_transition_ms = -100000
    min_gap_ms = int(design.get("transitionMinGapMs", 1400))
    for previous, current in zip(scenes, scenes[1:]):
        # Trigger transitions on salient shifts with minimum gap
        is_salient_shift = abs(current["salience"] - previous["salience"]) > 0.10 or current["salience"] > 0.65
        if is_salient_shift and (current["startMs"] - last_transition_ms >= min_gap_ms):
            duration = round(320 + intensity * 240)
            start_ms = max(previous["startMs"], current["startMs"] - duration // 2)
            end_ms = min(current["endMs"], start_ms + duration)
            transition_id = f"transition-{len(transitions) + 1}"
            effect_kind = rng.choice(transition_effects)
            transition = {
                "id": transition_id,
                "startMs": start_ms,
                "endMs": end_ms,
                "peakVelocityMs": start_ms + round((end_ms - start_ms) * 0.48),
                "effect": effect_kind,
                "fromSceneId": previous["id"],
                "toSceneId": current["id"],
                "causedBySceneId": current["id"],
            }
            transitions.append(transition)
            last_transition_ms = current["startMs"]

            # Map transition effect to auditory SFX cue
            if effect_kind == "film_burn_strobe":
                sfx_cue = rng.choice(["glitch_digital", "impact_sharp"])
            elif effect_kind == "flash_cut":
                sfx_cue = "impact_sharp"
            elif effect_kind == "camera_crash_snap":
                sfx_cue = "sub_drop"
            elif effect_kind == "whip_pan_blur":
                sfx_cue = "whoosh_fast"
            else:
                sfx_cue = "whoosh_slow"

            sfx.append({
                "id": f"sfx-{transition_id}",
                "cue": sfx_cue,
                "variant": rng.randint(1, 5),
                "triggerMs": transition["peakVelocityMs"],
                "gainDb": -14.0,
                "causedByTransitionId": transition_id,
            })

    # 2. Hero Chunk Kinetic Text Entry SFX
    for c_idx, chunk in enumerate(chunks):
        if c_idx == 0:
            continue  # Covered by opening hook
        is_hero_chunk = bool(chunk.get("isHero") or any(l.get("isHero") for l in chunk.get("layers", [])))
        if is_hero_chunk:
            c_start = int(chunk.get("startMs", chunk.get("outputStartMs", 0)))
            sfx.append({
                "id": f"sfx-text-entry-{c_idx}",
                "cue": rng.choice(["pop_text", "impact_sharp", "riser_short"]),
                "variant": rng.randint(1, 5),
                "triggerMs": c_start,
                "gainDb": -16.0,
                "causedByChunkId": str(chunk.get("chunkIndex", c_idx)),
            })

    # 3. Dynamic Cinematic Camera Zoom System (Multiple expressive zoom movements)
    camera_moves: List[Dict[str, Any]] = []
    if duration_ms >= 6000 and scenes:
        segment_dur = duration_ms // 3
        # Segment 1: Slow push in (0 -> 10s)
        camera_moves.append({
            "id": "camera-zoom-1",
            "startMs": 0,
            "endMs": segment_dur,
            "kind": "slow_push_in",
            "curve": CAMERA_CURVE,
            "startScale": 1.00,
            "endScale": 1.085,
            "overshootScale": 1.085,
            "causedByTransitionId": None,
            "causedBySceneId": scenes[0]["id"],
        })
        # Segment 2: Dynamic punch out to balanced frame (10s -> 20s)
        camera_moves.append({
            "id": "camera-zoom-2",
            "startMs": segment_dur,
            "endMs": segment_dur * 2,
            "kind": "punch_out_refocus",
            "curve": CAMERA_CURVE,
            "startScale": 1.085,
            "endScale": 1.020,
            "overshootScale": 1.020,
            "causedByTransitionId": None,
            "causedBySceneId": scenes[min(len(scenes) - 1, len(scenes) // 3)]["id"],
        })
        # Segment 3: Climax push in (20s -> 30s)
        camera_moves.append({
            "id": "camera-zoom-3",
            "startMs": segment_dur * 2,
            "endMs": duration_ms,
            "kind": "climax_push_in",
            "curve": CAMERA_CURVE,
            "startScale": 1.020,
            "endScale": 1.095,
            "overshootScale": 1.095,
            "causedByTransitionId": None,
            "causedBySceneId": scenes[-1]["id"],
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
