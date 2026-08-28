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
        base_subject_x = _nearest_subject_x(subject_observation, midpoint)

        # Dynamic Editorial Pan Mileage:
        # If chunk is flank_left_column -> shift speaker to right flank (60% - 66% X)
        # If chunk is flank_right_column -> shift speaker to left flank (34% - 40% X)
        # If cranial_crown or foreground -> keep centered at speaker's focal X
        placement = chunk.get("placement") or {}
        dom_zone = placement.get("dominantZone") or "cranial_crown"

        if dom_zone == "flank_left_column":
            target_focal_x = _clamp(base_subject_x + 11.0, 58.0, 66.0)
        elif dom_zone == "flank_right_column":
            target_focal_x = _clamp(base_subject_x - 11.0, 34.0, 42.0)
        else:
            target_focal_x = base_subject_x

        scenes.append({
            "id": scene_id,
            "startMs": start_ms,
            "endMs": min(duration_ms, end_ms),
            "layout": layout,
            "salience": round(_salience(chunk), 3),
            "sourceAspectRatio": round(width / height, 4),
            "focalPoint": {"xPercent": round(target_focal_x, 2), "yPercent": 42.0},
            "dominantZone": dom_zone,
            "overscanScale": 1.18,
            "cause": {
                "gate": "chunk_visual_treatment",
                "chunkIds": [str(chunk.get("chunkIndex", index))],
                "reason": "Dynamic overscan editorial pan with subject tracking selected for portrait mini run.",
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
            hook_sfx_cue = "shutter_snap"
        elif "dolly" in hook_type or "crash" in hook_type:
            hook_sfx_cue = "sub_impact_reverb"
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

    # 1b. Smart Cinematic Transition System (Narrative-Driven Rulebook with Spacing & Variety)
    last_transition_ms = -100000
    last_film_burn_ms = -100000
    film_burn_count = 0
    min_gap_ms = int(design.get("transitionMinGapMs", 3400))  # Anti-spam: minimum 3.4s between transitions
    for previous, current in zip(scenes, scenes[1:]):
        salience_diff = current["salience"] - previous["salience"]
        duration_gap = current["startMs"] - previous["endMs"]
        is_salient_shift = abs(salience_diff) > 0.12 or current["salience"] > 0.70

        if is_salient_shift and (current["startMs"] - last_transition_ms >= min_gap_ms):
            duration = round(300 + intensity * 200)
            start_ms = max(previous["startMs"], current["startMs"] - duration // 2)
            end_ms = min(current["endMs"], start_ms + duration)
            transition_id = f"transition-{len(transitions) + 1}"

            # Narrative-Driven Rulebook with Rich Variety (Anti-Spam / Anti-Overfitting)
            can_use_film_burn = (film_burn_count < 2) and (current["startMs"] - last_film_burn_ms >= 7000)

            if can_use_film_burn and (salience_diff > 0.26 or current["salience"] > 0.85):
                # Major Topic Pivot -> Incandescent Amber Film Burn (Rare cinematic highlight)
                effect_kind = "film_burn_strobe"
                sfx_cue = rng.choice(["shutter_snap", "impact_sharp"])
                last_film_burn_ms = current["startMs"]
                film_burn_count += 1
            elif duration_gap > 350 or current["salience"] < 0.42:
                # Pensive Reflective Beat -> Optical Bokeh Defocus Blend
                effect_kind = "bokeh_defocus_blend"
                sfx_cue = "slow_whoosh_reverb"
            elif salience_diff < -0.15 or previous.get("salience", 0) > 0.80:
                # Climax Punchline Drop -> Camera Crash Snap
                effect_kind = "camera_crash_snap"
                sfx_cue = rng.choice(["sub_impact_reverb", "sub_drop"])
            elif rng.random() < 0.50:
                # Directional Whip Pan Streak
                effect_kind = "whip_pan_blur"
                sfx_cue = "whoosh_fast"
            else:
                # Subtle Light Leak Flare Sweep
                effect_kind = "light_leak_sweep"
                sfx_cue = "slow_whoosh_reverb"

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

            sfx.append({
                "id": f"sfx-{transition_id}",
                "cue": sfx_cue,
                "variant": rng.randint(1, 5),
                "triggerMs": transition["peakVelocityMs"],
                "gainDb": -14.0,
                "causedByTransitionId": transition_id,
            })

    # 2. Intelligent Sound Orchestration for Kinetic Typography (Hero-Anchor Audio Policy)
    # Only applies audio to primary focus / hero anchor words, avoiding repetitive noise
    last_text_sfx_ms = -100000
    for c_idx, chunk in enumerate(chunks):
        if c_idx == 0:
            continue  # Covered by opening hook impact
        c_start = int(chunk.get("startMs", chunk.get("outputStartMs", 0)))
        if c_start - last_text_sfx_ms < 650:
            continue  # Enforce minimum audio pacing window between speech sounds

        layers = chunk.get("layers", [])
        words = chunk.get("words", [])
        is_single_word = len(words) == 1 or (len(chunk.get("text", "").split()) == 1)
        hero_layers = [l for l in layers if l.get("isHero") or l.get("role") == "primary_focus_word"]

        if is_single_word:
            # Single-word rhythmic punch gets tactile mechanical click
            sfx.append({
                "id": f"sfx-text-entry-{c_idx}",
                "cue": rng.choice(["mechanical_click", "pop_text"]),
                "variant": rng.randint(1, 5),
                "triggerMs": c_start,
                "gainDb": -18.0,
                "causedByChunkId": str(chunk.get("chunkIndex", c_idx)),
            })
            last_text_sfx_ms = c_start
        elif hero_layers:
            # Major multi-word stack: only sound the entrance of the primary hero keyword
            hero_cue = rng.choice(["shutter_snap", "impact_sharp", "pop_text", "riser_short"])
            sfx.append({
                "id": f"sfx-text-entry-{c_idx}",
                "cue": hero_cue,
                "variant": rng.randint(1, 5),
                "triggerMs": c_start,
                "gainDb": -15.0,
                "causedByChunkId": str(chunk.get("chunkIndex", c_idx)),
            })
            last_text_sfx_ms = c_start

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

    # 2.5D After Effects-Style Spatial 3D Camera & Node Rig Planning
    # Computes 3D spatial waypoints for smooth camera orbits/pans across cranial/flank nodes
    spatial_nodes: List[Dict[str, Any]] = []
    for idx, chunk in enumerate(chunks):
        c_start, c_end = _timing(chunk, idx, duration_ms)
        placement = chunk.get("placement") or {}
        dom_zone = placement.get("dominantZone") or "cranial_crown"
        align = placement.get("textAlign") or "center"

        # Map zone to 3D spatial node coordinates
        if dom_zone == "flank_left_column":
            node_x, node_y, node_z = -280.0, -20.0, -80.0
            rot_x, rot_y, rot_z = 0.0, 8.5, -1.0
        elif dom_zone == "flank_right_column":
            node_x, node_y, node_z = 280.0, -20.0, -80.0
            rot_x, rot_y, rot_z = 0.0, -8.5, 1.0
        elif dom_zone == "foreground_lower_deck":
            node_x, node_y, node_z = 0.0, 320.0, 60.0
            rot_x, rot_y, rot_z = -4.0, 0.0, 0.0
        else:  # cranial_crown
            node_x, node_y, node_z = 0.0, -360.0, -140.0
            rot_x, rot_y, rot_z = 6.0, 0.0, 0.0

        spatial_nodes.append({
            "nodeId": f"spatial-node-{idx + 1}",
            "chunkIndex": idx + 1,
            "startMs": c_start,
            "endMs": c_end,
            "dominantZone": dom_zone,
            "alignment": align,
            "position": {"x": node_x, "y": node_y, "z": node_z},
            "rotation": {"pitchDeg": rot_x, "yawDeg": rot_y, "rollDeg": rot_z},
            "scale": 1.0,
        })

    spatial_camera_3d = {
        "enabled": bool(design.get("spatialCamera3D", True)),
        "mode": design.get("spatialCameraMode", "spline_orbit"),
        "perspectivePx": 1200,
        "smoothingFactor": 0.85,
        "nodes": spatial_nodes,
    }

    return {
        "version": "1.0",
        "selectionMode": "entropy",
        "selectionNonce": nonce,
        "durationMs": duration_ms,
        "scenes": scenes,
        "transitions": transitions,
        "cameraMoves": camera_moves,
        "backgrounds": backgrounds,
        "spatialCamera3D": spatial_camera_3d,
        "pip": pip,
        "sfx": sfx,
    }
