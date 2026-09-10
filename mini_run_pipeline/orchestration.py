"""Causal visual orchestration for the portrait Mini Runs renderer."""

from __future__ import annotations

import random
import re
import secrets
from typing import Any, Dict, List, Optional, Sequence


CAMERA_CURVE = [0.16, 1.0, 0.3, 1.0]

# ---------------------------------------------------------------------------
# Camera Zoom-In Policy
# ---------------------------------------------------------------------------
# Zoom-ins are earned, never ambient. A zoom fires only when a chunk carries
# high narrative impact (hero status, numeric data, list entry, crisis language,
# or a salience spike over the previous scene) AND the scene spacing respects a
# minimum quiet window so the frame settles between impacts.

# Zoom archetypes. All are IN — the previous "no zooms" stance is replaced by
# purposeful push-ins at high-impact moments.
# Zoom archetypes for dynamic portrait 9:16 storytelling.
# Expands standard push-ins into professional cinematic, high-energy, and social styles.
ZOOM_KINDS = {
    # 1. The Joseph Edit: Slow sustained push-in across sentence/scene, then sharp hard cut-back
    # to 1.00x at the scene boundary, punctuated by a micro transition and tactile shutter snap.
    "joseph_edit": {
        "durationMs": 3200,
        "curve": [0.25, 0.1, 0.25, 1.0],
        "startScale": 1.0,
        "endScale": 1.10,
        "cutbackAtEnd": True,
        "sfxCue": "click_bupu",
        "sfxGainDb": -7.0,
    },
    # 2. The Smooth Zoom-In: Pushes rapidly into a specific object or face detail.
    "smooth_zoom_in": {
        "durationMs": 750,
        "curve": [0.22, 1.0, 0.36, 1.0],
        "startScale": 1.0,
        "endScale": 1.14,
        "sfxCue": "whoosh_fast",
        "sfxGainDb": -7.0,
    },
    # 3. The Zoom-Out Snap: Pulls back rapidly from close-up to reveal wider scene.
    "zoom_out_snap": {
        "durationMs": 550,
        "curve": [0.16, 1.0, 0.3, 1.0],
        "startScale": 1.15,
        "endScale": 1.00,
        "sfxCue": "whoosh_3_bupu",
        "sfxGainDb": -7.0,
    },
    # 4. The Twist Zoom (Zoom-and-Spin): Rotates camera subtly while zooming.
    "twist_zoom": {
        "durationMs": 650,
        "curve": [0.33, 1.0, 0.68, 1.0],
        "startScale": 1.0,
        "endScale": 1.15,
        "rotationDeg": [-4.5, 4.5],
        "sfxCue": "whoosh_fast",
        "sfxGainDb": -6.5,
    },
    # 5. The Hitchcock Dolly Zoom (Vertigo): Warps background perspective while subject stays locked.
    "hitchcock_dolly": {
        "durationMs": 2800,
        "curve": [0.42, 0.0, 0.58, 1.0],
        "startScale": 1.0,
        "endScale": 1.18,
        "dollyParallax": {"backgroundScale": 1.22, "subjectScale": 1.02},
        "sfxCue": "charge_riser_bupu",
        "sfxGainDb": -7.0,
    },
    # 6. The Slow Creep: Imperceptible scale growth over multi-chunk monologue for intense tension.
    "slow_creep": {
        "durationMs": 8000,
        "curve": [0.25, 0.1, 0.25, 1.0],
        "startScale": 1.0,
        "endScale": 1.055,
        "sfxCue": "slow_whoosh_reverb",
        "sfxGainDb": -8.5,
    },
    # 7. The Punch Zoom / Jolt: 0ms instant 1-frame jump-cut to 1.14x on an emphatic word.
    "punch_zoom": {
        "durationMs": 1100,
        "curve": [0.0, 0.0, 0.0, 1.0],
        "startScale": 1.0,
        "endScale": 1.14,
        "instantJump": True,
        "sfxCue": "tap_punch_bupu",
        "sfxGainDb": -6.0,
    },
    # 8. The 3D Zoom Parallax: Multi-plane depth separation.
    "3d_zoom_parallax": {
        "durationMs": 2200,
        "curve": [0.25, 0.1, 0.25, 1.0],
        "startScale": 1.0,
        "endScale": 1.10,
        "dollyParallax": {"backgroundScale": 1.04, "subjectScale": 1.08},
        "sfxCue": "sub_impact_reverb",
        "sfxGainDb": -6.5,
    },
    # 9. Match Cut Zoom: Preserves zoom depth across the cut boundary then eases back.
    "match_cut_zoom": {
        "durationMs": 700,
        "curve": [0.16, 1.0, 0.3, 1.0],
        "startScale": 1.14,
        "endScale": 1.00,
        "sfxCue": "whoosh_3_bupu",
        "sfxGainDb": -7.0,
    },
    # Legacy aliases (preserving 100% backward compatibility)
    "slow_push_in": {
        "durationMs": 2600,
        "curve": CAMERA_CURVE,
        "startScale": 1.0,
        "endScale": 1.08,
        "sfxCue": "slow_whoosh_reverb",
        "sfxGainDb": -7.0,
    },
    "fast_punch_in": {
        "durationMs": 700,
        "curve": [0.5, 0.0, 0.2, 1.0],
        "startScale": 1.0,
        "endScale": 1.12,
        "sfxCue": "whoosh_fast",
        "sfxGainDb": -6.5,
    },
    "jcut_zoom_in": {
        "durationMs": 1100,
        "curve": [0.3, 0.0, 0.4, 1.0],
        "startScale": 1.0,
        "endScale": 1.10,
        "sfxCue": "sub_impact_reverb",
        "sfxGainDb": -6.5,
    },
}

# High-impact gates. A chunk qualifies when it matches any of these signals.
ZOOM_IMPACT_PATTERNS = {
    "numeric_beat": [r"\d", r"percent", r"million", r"doubled", r"tripled", r"stats"],
    "list_entry": [r"first", r"second", r"third", r"\b1\.", r"\b2\.", r"\b3\."],
    "crisis_beat": [r"broke", r"collaps", r"fail", r"worst", r"stuck", r"never again", r"lost", r"loss", r"ruin"],
}

# Spacing policy: never two zooms inside this window; the frame must settle.
ZOOM_MIN_GAP_MS = 4000
# First-chunk zooms are covered by the macro hook treatment; don't stack.
ZOOM_MIN_CHUNK_INDEX = 1
# J-cut lead: zoom starts this many ms before the chunk's text onset.
ZOOM_JCUT_LEAD_MS = 260
# Maximum simultaneous zoom activity policy: one active zoom at any instant is
# enforced by the min-gap; a hard cap keeps a 30s short from feeling haunted.
ZOOM_MAX_PER_RUN = 4


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


def _nearest_subject_anchor(
    subject_observation: Optional[Dict[str, Any]],
    midpoint_ms: int,
) -> Tuple[float, float]:
    """Calculate subject eye/face anchor point (xPercent, yPercent) for transformOrigin.

    Anchors zoom transforms directly to the subject's eye-line rather than the default
    frame center, preventing head amputation and preserving headroom in 9:16 portrait.
    """
    frames = (subject_observation or {}).get("frames") or []
    usable = [frame for frame in frames if isinstance(frame.get("subjectBox"), dict)]
    if not usable:
        return 50.0, 40.0
    frame = min(usable, key=lambda item: abs(int(item.get("sourceMs", 0)) - midpoint_ms))
    box = frame["subjectBox"]
    x = float(box.get("x", 0.25)) + float(box.get("width", 0.5)) / 2.0
    # Eye line sits ~30% down the subject box from the top of the head
    y = float(box.get("y", 0.15)) + float(box.get("height", 0.5)) * 0.30
    return round(_clamp(x * 100.0, 24.0, 76.0), 2), round(_clamp(y * 100.0, 25.0, 60.0), 2)


def _zoom_impact_reason(text: str, is_hero: bool, salience_delta: float) -> Optional[Dict[str, Any]]:
    """Classify WHY a chunk deserves a zoom. Returns None when it doesn't."""
    lower = (text or "").lower()
    for trigger, patterns in ZOOM_IMPACT_PATTERNS.items():
        if any(re.search(pattern, lower) for pattern in patterns):
            return {"gate": trigger, "reason": f"Chunk carries a '{trigger}' high-impact signal."}
    if is_hero:
        return {"gate": "hero_beat", "reason": "Hero chunk earns a sustained push-in."}
    if salience_delta > 0.18:
        return {"gate": "salience_spike", "reason": "Salience spike over the previous scene warrants emphasis."}
    return None


def _chunk_is_hero(chunk: Dict[str, Any]) -> bool:
    layers = chunk.get("layers") or []
    return bool(chunk.get("isHero") or any(layer.get("isHero") for layer in layers))


def _select_zoom_kind(
    gate: str,
    salience_delta: float,
    rng: random.Random,
    preferred_kind: Optional[str] = None,
) -> str:
    """Map an impact gate or creator preference to a zoom archetype."""
    if preferred_kind and preferred_kind in ZOOM_KINDS:
        return preferred_kind
    if gate in ("numeric_beat", "crisis_beat"):
        return "fast_punch_in"
    if gate == "list_entry":
        # Lists alternate: J-cut into the entry, punch on later items.
        return rng.choice(["jcut_zoom_in", "fast_punch_in"])
    if gate == "hero_beat":
        return "slow_push_in"
    # salience_spike: velocity follows the size of the spike.
    return "jcut_zoom_in" if salience_delta > 0.3 else "slow_push_in"


def plan_zoom_ins(
    *,
    chunks: List[Dict[str, Any]],
    scenes: List[Dict[str, Any]],
    design: Optional[Dict[str, Any]] = None,
    duration_ms: int,
    rng: Optional[random.Random] = None,
    subject_observation: Optional[Dict[str, Any]] = None,
    prompt: Optional[str] = None,
    brand_preferences: Optional[Dict[str, Any]] = None,
    existing_moves: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Plan purposeful camera zoom-ins for high-impact chunks.

    Policies:
    * Impact gate: only numeric beats, list entries, crisis language, hero
      chunks, or salience spikes earn a zoom. Not every cut, not ambient motion.
    * Archetype routing: numeric/crisis -> fast punch; hero -> slow push;
      list/salience -> J-cut or punch by context. User prompt / brand preferences
      can explicitly select or bias toward dynamic zoom archetypes (joseph_edit,
      hitchcock_dolly, twist_zoom, etc.).
    * Anchor point: transforms anchor directly to the Martin subject eye-line
      (originX: focalX%, originY: 30-40%) to preserve headroom in portrait 9:16.
    * Spacing: minimum ZOOM_MIN_GAP_MS between zoom starts, hard cap per run,
      and the first chunk is exempt (the macro hook owns the opening moment).
    * Audio: every zoom carries a transition-grade SFX cue distinct from
      typography-entry clicks; the J-cut's sound leads its picture, while
      Joseph Edit synchronizes a tactile snap click to the hard cut-back.
    """
    design = dict(design or {})
    duration_ms = max(1, int(duration_ms))
    rng = rng or random.Random(secrets.token_hex(16))
    policy = str(design.get("zoomPolicy", "auto"))
    if policy == "disabled":
        return {"cameraMoves": [], "sfx": []}
    max_zooms = int(design.get("maxZooms", ZOOM_MAX_PER_RUN))
    min_gap_ms = int(design.get("zoomMinGapMs", ZOOM_MIN_GAP_MS))

    resolved_prefs = {
        **(design.get("brandPreferences") or design.get("brand_preferences") or {}),
        **(brand_preferences or {}),
    }
    preferred_kind = resolved_prefs.get("preferredZoomKind") or design.get("preferredZoomKind")
    if not preferred_kind:
        text_context = f"{prompt or ''} {resolved_prefs.get('cameraStyle', '')}".lower()
        if "joseph" in text_context:
            preferred_kind = "joseph_edit"
        elif "hitchcock" in text_context or "vertigo" in text_context or "dolly" in text_context:
            preferred_kind = "hitchcock_dolly"
        elif "twist" in text_context:
            preferred_kind = "twist_zoom"
        elif "creep" in text_context:
            preferred_kind = "slow_creep"
        elif "punch" in text_context:
            preferred_kind = "punch_zoom"
        elif "snap" in text_context or "zoom out" in text_context:
            preferred_kind = "zoom_out_snap"
        elif "parallax" in text_context:
            preferred_kind = "3d_zoom_parallax"
        elif "match cut" in text_context:
            preferred_kind = "match_cut_zoom"
        elif "smooth" in text_context:
            preferred_kind = "smooth_zoom_in"

    camera_moves: List[Dict[str, Any]] = list(existing_moves or [])
    sfx: List[Dict[str, Any]] = []
    last_start_ms = -10**9

    for index, (chunk, scene) in enumerate(zip(chunks, scenes)):
        if index < ZOOM_MIN_CHUNK_INDEX:
            continue
        if len(camera_moves) >= max_zooms:
            break
        start_ms = int(scene["startMs"])
        if any(abs(start_ms - int(m.get("startMs", 0))) < min_gap_ms for m in camera_moves):
            continue

        previous_salience = 0.0
        if index > 0:
            prev_scene = scenes[index - 1]
            previous_salience = float(prev_scene.get("salience", 0.0))
        salience_delta = float(scene.get("salience", 0.0)) - previous_salience
        is_hero = _chunk_is_hero(chunk)
        impact = _zoom_impact_reason(str(chunk.get("text", "")), is_hero, salience_delta)
        if impact is None:
            continue

        kind = _select_zoom_kind(impact["gate"], salience_delta, rng, preferred_kind=preferred_kind)
        spec = ZOOM_KINDS[kind]

        if kind == "jcut_zoom_in":
            zoom_start = max(0, start_ms - ZOOM_JCUT_LEAD_MS)
        else:
            zoom_start = start_ms
        zoom_end = min(duration_ms, zoom_start + int(spec["durationMs"]))
        if zoom_end - zoom_start < 300:
            continue
        zoom_id = f"zoom-{index + 1}-{kind}"

        # Eye-line transform origin (24-76% X, 25-60% Y) locks camera to speaker's face
        midpoint_ms = zoom_start + (zoom_end - zoom_start) // 2
        anchor_x, anchor_y = _nearest_subject_anchor(subject_observation, midpoint_ms)

        move: Dict[str, Any] = {
            "id": zoom_id,
            "startMs": zoom_start,
            "endMs": zoom_end,
            "kind": kind,
            "curve": spec["curve"],
            "startScale": spec["startScale"],
            "endScale": spec["endScale"],
            "overshootScale": spec["endScale"],
            "anchorPoint": {"xPercent": anchor_x, "yPercent": anchor_y},
            "causedByChunkId": str(chunk.get("chunkIndex", index)),
            "causedBySceneId": scene["id"],
            "cause": {
                "gate": impact["gate"],
                "reason": impact["reason"],
                "policy": "high_impact_zoom_in",
                "chunkIndex": index,
            },
        }

        if "rotationDeg" in spec:
            rot = spec["rotationDeg"]
            move["rotationDeg"] = round(rng.uniform(rot[0], rot[1]), 2) if isinstance(rot, (list, tuple)) else float(rot)
        if spec.get("cutbackAtEnd"):
            move["cutbackAtEnd"] = True
        if spec.get("instantJump"):
            move["instantJump"] = True
        if "dollyParallax" in spec:
            move["dollyParallax"] = dict(spec["dollyParallax"])

        camera_moves.append(move)

        sfx_id = f"sfx-{zoom_id}"
        cue_variant = rng.randint(1, 5)
        # Joseph edit cuts back sharply at endMs; punch/push triggers on impact at startMs
        trigger_ms = zoom_end if spec.get("cutbackAtEnd") else zoom_start
        sfx.append({
            "id": sfx_id,
            "cue": spec["sfxCue"],
            "variant": cue_variant,
            "triggerMs": trigger_ms,
            "gainDb": spec["sfxGainDb"],
            "causedByCameraMoveId": zoom_id,
            "causedByChunkId": str(chunk.get("chunkIndex", index)),
        })
        last_start_ms = start_ms

    camera_moves.sort(key=lambda move: move["startMs"])
    sfx.sort(key=lambda event: event["triggerMs"])
    return {"cameraMoves": camera_moves, "sfx": sfx}


def govern_camera_moves(
    camera_moves: Sequence[Dict[str, Any]],
    scenes: Sequence[Dict[str, Any]],
) -> List[str]:
    """Return causal-integrity issues for the zoom plan (empty list => clean)."""
    issues: List[str] = []
    scene_ids = {scene["id"] for scene in scenes}
    for move in camera_moves:
        mid = move.get("id")
        if move.get("causedBySceneId") not in scene_ids:
            issues.append(f"{mid}: references unknown scene {move.get('causedBySceneId')!r}")
        cause = move.get("cause")
        if not isinstance(cause, dict) or not cause.get("gate"):
            issues.append(f"{mid}: missing impact gate in cause")
        if move.get("startMs", 0) >= move.get("endMs", 0):
            issues.append(f"{mid}: zoom window inverted")
        start_scale = float(move.get("startScale", 1.0))
        end_scale = float(move.get("endScale", 1.0))
        kind = str(move.get("kind", ""))
        is_pullback = kind in ("zoom_out_snap", "match_cut_zoom") or move.get("pullbackAllowed", False)
        if end_scale <= start_scale and not is_pullback:
            issues.append(f"{mid}: zoom kind must scale IN (endScale > startScale)")
        if end_scale > 1.25 or start_scale > 1.25:
            max_scale = max(start_scale, end_scale)
            issues.append(f"{mid}: endScale {max_scale} exceeds the 1.2 composure ceiling")
        if "rotationDeg" in move and abs(float(move["rotationDeg"])) > 45.0:
            issues.append(f"{mid}: rotation exceeds +-45 deg stability limit")
    starts = sorted(int(move.get("startMs", 0)) for move in camera_moves)
    for earlier, later in zip(starts, starts[1:]):
        if later - earlier < ZOOM_MIN_GAP_MS:
            issues.append(
                f"camera_moves: zooms at {earlier}ms and {later}ms violate the {ZOOM_MIN_GAP_MS}ms spacing policy"
            )
    return issues



def plan_mini_run_orchestration(
    *,
    chunks: List[Dict[str, Any]],
    probe: Dict[str, Any],
    duration_ms: int,
    design: Optional[Dict[str, Any]] = None,
    subject_observation: Optional[Dict[str, Any]] = None,
    prompt: Optional[str] = None,
    brand_preferences: Optional[Dict[str, Any]] = None,
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

    resolved_brand_prefs = {
        **(design.get("brandPreferences") or design.get("brand_preferences") or {}),
        **(brand_preferences or {}),
    }
    resolved_prompt = prompt or design.get("prompt")

    # PiP treatments are strictly prohibited in mini runs (portrait 9:16 shorts).
    # All scenes use pan_scan with subject tracking.
    scenes: List[Dict[str, Any]] = []
    for index, chunk in enumerate(chunks):
        start_ms, end_ms = _timing(chunk, index, duration_ms)
        if scenes:
            start_ms = scenes[-1]["endMs"]
        if index == len(chunks) - 1:
            end_ms = duration_ms
        else:
            end_ms = max(start_ms + 250, min(duration_ms, end_ms))
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

        # Rock-solid stable cinematic camera: lock stably to center 50.0% X (zero lateral jumps/jitter)
        target_focal_x = 50.0

        scenes.append({
            "id": scene_id,
            "startMs": start_ms,
            "endMs": min(duration_ms, end_ms),
            "layout": layout,
            "salience": round(_salience(chunk), 3),
            "sourceAspectRatio": round(width / height, 4),
            "focalPoint": {"xPercent": 50.0, "yPercent": 42.0},
            "dominantZone": dom_zone,
            "overscanScale": 1.15,
            "cause": {
                "gate": "chunk_visual_treatment",
                "chunkIds": [str(chunk.get("chunkIndex", index))],
                "reason": "Cinematic stable camera framing for portrait mini run.",
            },
        })

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
            hook_sfx_cue = rng.choice(["camera_shutter_bupu", "shutter_clicks_v2_bupu", "shutter_snap"])
        elif "dolly" in hook_type or "crash" in hook_type:
            hook_sfx_cue = rng.choice(["charge_bupu", "sub_impact_reverb"])
        else:
            hook_sfx_cue = "impact_deep"
        sfx.append({
            "id": "sfx-hook-impact-0",
            "cue": hook_sfx_cue,
            "variant": rng.randint(1, 5),
            "triggerMs": 0,
            "gainDb": -5.5,
            "causedByHook": hook_type,
        })

    # 1b. Semantic Transcript-Driven Transition Engine (Restricted to 1-2 Narrative Turning Points)
    # Eliminates transition spamming and binds visual film burns causally to semantic pivots,
    # co-occurring camera zoom movements, and impactful broadcast SFX cues.
    max_transitions = int(design.get("maxTransitions", 2 if duration_ms >= 18000 else 1))
    min_trans_gap_ms = int(design.get("transitionMinGapMs", 8500))

    pref_effect = (
        design.get("preferredTransition")
        or (design.get("brandPreferences") or {}).get("preferredTransition")
        or (resolved_brand_prefs or {}).get("preferredTransition")
    )
    if not pref_effect:
        p_text = f"{resolved_prompt or ''} {design.get('transitionStyle', '')}".lower()
        if any(k in p_text for k in ("film burn", "burn", "vintage", "grain", "35mm")):
            pref_effect = "film_burn"
        elif any(k in p_text for k in ("light leak", "leak", "flare")):
            pref_effect = "light_leak_sweep"
        elif any(k in p_text for k in ("bokeh", "bloom", "defocus")):
            pref_effect = "bokeh_defocus_blend"

    contrast_markers = [
        "no", "moving now", "instead", "however", "but", "priorities", "fresh",
        "say something", "won't say", "actually", "truth", "choose", "stop", "never",
        "reality", "shift", "different", "change", "secret", "lesson"
    ]
    prompt_keywords = [
        w.lower() for w in re.findall(r"[a-z0-9]+", str(resolved_prompt or ""))
        if len(w) >= 4 and w.lower() not in {"video", "cinematic", "short", "burn", "transition", "with", "from"}
    ]

    pivot_candidates: List[Dict[str, Any]] = []
    # Safe bounds: skip opening hook (first 5.5s) and concluding CTA (last 3.5s)
    head_safe_ms = 5500
    tail_safe_ms = max(0, duration_ms - 3500)

    for idx, (previous, current) in enumerate(zip(scenes, scenes[1:])):
        prev_chunk = chunks[idx] if idx < len(chunks) else {}
        curr_chunk = chunks[idx + 1] if idx + 1 < len(chunks) else {}
        start_ms = int(current["startMs"])

        if start_ms < head_safe_ms or start_ms > tail_safe_ms:
            continue

        prev_text = str(prev_chunk.get("text", "")).strip()
        curr_text = str(curr_chunk.get("text", "")).strip()

        score = 0.0
        reasons = []

        # Marker 1: Contrast / Turning Point / Paradigm shift keywords
        matched_marker = next((m for m in contrast_markers if m in curr_text.lower()), None)
        if matched_marker:
            score += 3.5
            reasons.append(f"contrast_marker:{matched_marker}")

        # Marker 2: Clean sentence completion before new thought
        if any(prev_text.endswith(p) for p in (".", "?", "!")):
            score += 2.0
            reasons.append("sentence_boundary")

        # Marker 3: Prompt semantic alignment
        if prompt_keywords and any(pk in curr_text.lower() for pk in prompt_keywords):
            score += 2.5
            reasons.append("prompt_semantic_target")

        # Marker 4: Salience or Hero shift
        salience_diff = abs(current["salience"] - previous["salience"])
        if salience_diff > 0.10 or curr_chunk.get("isHero"):
            score += 1.2
            reasons.append("salience_shift")

        if score >= 3.0:
            pivot_candidates.append({
                "score": score,
                "idx": idx,
                "previous": previous,
                "current": current,
                "curr_chunk": curr_chunk,
                "prev_chunk": prev_chunk,
                "reasons": reasons,
            })

    # Sort candidates by score descending and greedily select spaced pivots
    pivot_candidates.sort(key=lambda item: item["score"], reverse=True)
    selected_pivots: List[Dict[str, Any]] = []
    for cand in pivot_candidates:
        if len(selected_pivots) >= max_transitions:
            break
        c_start = int(cand["current"]["startMs"])
        if not any(abs(c_start - int(p["current"]["startMs"])) < min_trans_gap_ms for p in selected_pivots):
            selected_pivots.append(cand)

    # Fallback: if no candidate reached 3.0, pick single sentence boundary nearest to timeline center
    if not selected_pivots and len(scenes) > 2:
        mid_target = duration_ms // 2
        safe_pairs = [
            (idx, p, c) for idx, (p, c) in enumerate(zip(scenes, scenes[1:]))
            if head_safe_ms <= c["startMs"] <= tail_safe_ms
        ]
        if safe_pairs:
            best_pair = min(safe_pairs, key=lambda pair: abs(pair[2]["startMs"] - mid_target))
            idx, prev_s, curr_s = best_pair
            selected_pivots.append({
                "score": 1.0,
                "idx": idx,
                "previous": prev_s,
                "current": curr_s,
                "curr_chunk": chunks[idx + 1] if idx + 1 < len(chunks) else {},
                "prev_chunk": chunks[idx] if idx < len(chunks) else {},
                "reasons": ["timeline_midpoint_editorial_flow"],
            })

    # Sort selected pivots chronologically
    selected_pivots.sort(key=lambda p: int(p["current"]["startMs"]))

    # Container for transition-coupled camera moves to seed into plan_zoom_ins
    coupled_camera_moves: List[Dict[str, Any]] = []

    # Colorway & variant mappings for genuine visual diversity across transitions
    VARIANT_THEMES = [
        {"variant": 1, "colorway": "amber_gate"},
        {"variant": 2, "colorway": "bleach_burst"},
        {"variant": 3, "colorway": "prismatic_solar"},
        {"variant": 4, "colorway": "bottom_streak"},
    ]

    for p_idx, pivot in enumerate(selected_pivots):
        previous = pivot["previous"]
        current = pivot["current"]
        curr_chunk = pivot["curr_chunk"]
        transition_id = f"transition-{len(transitions) + 1}"

        duration = 420
        start_ms = max(previous["startMs"], current["startMs"] - duration // 2)
        end_ms = min(current["endMs"], start_ms + duration)
        peak_ms = start_ms + round((end_ms - start_ms) * 0.48)

        theme = VARIANT_THEMES[p_idx % len(VARIANT_THEMES)]
        effect_kind = pref_effect or "film_burn"

        # 1. Transition overlay event with explicit variant and colorway
        transition = {
            "id": transition_id,
            "startMs": start_ms,
            "endMs": end_ms,
            "peakVelocityMs": peak_ms,
            "effect": effect_kind,
            "variant": theme["variant"],
            "colorway": theme["colorway"],
            "fromSceneId": previous["id"],
            "toSceneId": current["id"],
            "causedBySceneId": current["id"],
            "cause": {
                "gate": "semantic_narrative_pivot",
                "reasons": pivot["reasons"],
                "chunkIndex": pivot["idx"] + 1,
            },
        }
        transitions.append(transition)

        # 2. Causal Synchronized Transition SFX (Elevated, punchy, broadcast-audible)
        if p_idx == 0:
            sfx_cue = "whoosh_fast"
            sfx_gain = -6.5
        else:
            sfx_cue = "slow_whoosh_reverb"
            sfx_gain = -7.0

        sfx.append({
            "id": f"sfx-{transition_id}",
            "cue": sfx_cue,
            "variant": p_idx + 1,
            "triggerMs": peak_ms,
            "gainDb": sfx_gain,
            "causedByTransitionId": transition_id,
        })

        # 3. Causal Synchronized Camera Move (Accentuating the narrative pivot)
        # Alternate fast punch vs slow push to create dynamic visual rhythm across the video
        zoom_kind = "fast_punch_in" if p_idx == 0 else "slow_push_in"
        zoom_spec = ZOOM_KINDS[zoom_kind]
        zoom_start = int(current["startMs"])
        zoom_end = min(duration_ms, zoom_start + int(zoom_spec["durationMs"]))

        anchor_x, anchor_y = _nearest_subject_anchor(
            subject_observation, zoom_start + (zoom_end - zoom_start) // 2
        )

        coupled_move = {
            "id": f"zoom-pivot-{p_idx + 1}-{zoom_kind}",
            "startMs": zoom_start,
            "endMs": zoom_end,
            "kind": zoom_kind,
            "curve": CAMERA_CURVE,
            "startScale": zoom_spec["startScale"],
            "endScale": zoom_spec["endScale"],
            "overshootScale": zoom_spec["endScale"],
            "anchorPoint": {"xPercent": anchor_x, "yPercent": anchor_y},
            "causedByChunkId": str(curr_chunk.get("chunkIndex", pivot["idx"] + 1)),
            "causedBySceneId": current["id"],
            "causedByTransitionId": transition_id,
            "cause": {
                "gate": "semantic_pivot_transition",
                "reason": f"Synchronized camera accent for narrative turning point: '{curr_chunk.get('text')}'",
                "transitionId": transition_id,
                "chunkIndex": pivot["idx"] + 1,
            },
        }
        coupled_camera_moves.append(coupled_move)

    # 1c. Background placement: decide when/where to drop a texture backdrop behind the
    # kinetic text (foreground chunks only, so text always renders atop the canvas).
    # Reconciles user prompt & brand preferences to decide introduction canvas and
    # transition-coupled context shifts.
    backgrounds: List[Dict[str, Any]] = []
    try:
        from mini_run_pipeline.backgrounds import govern_backgrounds, plan_backgrounds

        backgrounds = plan_backgrounds(
            chunks=chunks,
            scenes=scenes,
            design=design,
            duration_ms=duration_ms,
            prompt=resolved_prompt,
            brand_preferences=resolved_brand_prefs,
            transitions=transitions,
            seed=nonce,
        )
        governance = govern_backgrounds(backgrounds, scenes)
        if governance:
            print(f"[orchestration] background governance warnings: {governance}", flush=True)

        # Synchronize cinematic audio cues for B-roll cutaway entrances
        for b_idx, bg in enumerate(backgrounds):
            if bg.get("kind") == "broll_cutaway":
                entry_ms = bg.get("entry", {}).get("startMs", 0)
                broll_meta = bg.get("broll", {})
                treatment_name = (broll_meta.get("treatment") or {}).get("treatment_name", "cinematic_fullbleed")
                if treatment_name == "evidentiary_dossier_card":
                    cue_name = "sub_impact_reverb"
                elif treatment_name == "retinal_flash_cut":
                    cue_name = "impact_deep"
                elif treatment_name == "track_matte_unfurl":
                    cue_name = "whoosh_fast"
                else:
                    cue_name = "whoosh_slow"

                sfx.append({
                    "id": f"sfx-broll-cutaway-{b_idx}",
                    "cue": cue_name,
                    "variant": 1,
                    "triggerMs": entry_ms,
                    "gainDb": -10.0,
                    "causedByBackgroundId": bg.get("id"),
                })
    except Exception as exc:  # never let a backdrop decision break the render
        print(f"[orchestration] background planning skipped: {exc}", flush=True)
        backgrounds = []

    # 2. Intelligent Sound Orchestration for Kinetic Typography (Anti-Overfitting Multi-Category Pool)
    # Uses rolling history buffer to guarantee acoustic variety without repeating sounds
    recent_sfx_cues: List[str] = []

    def _pick_diverse_sfx(pool: List[str]) -> str:
        candidates = [c for c in pool if c not in recent_sfx_cues] or pool
        chosen = rng.choice(candidates)
        recent_sfx_cues.append(chosen)
        if len(recent_sfx_cues) > 5:
            recent_sfx_cues.pop(0)
        return chosen

    last_text_sfx_ms = -100000
    for c_idx, chunk in enumerate(chunks):
        layers = chunk.get("layers", [])
        words = chunk.get("words", [])
        is_single_word = len(words) == 1 or (len(chunk.get("text", "").split()) == 1)
        hero_layers = [l for l in layers if l.get("isHero") or l.get("role") == "primary_focus_word"]

        is_hierarchical_lockup = (
            chunk.get("treatmentSystem") in ("hierarchical_asymmetric_lockup", "documentary_lockup_captions", "micro_macro_kinetic_type")
            or chunk.get("fxPreset") in ("hierarchical_asymmetric_lockup", "documentary_lockup_captions", "micro_macro_kinetic_type")
            or any(l.get("fxPreset") in ("hierarchical_asymmetric_lockup", "documentary_lockup_captions", "micro_macro_kinetic_type") for l in layers)
        )

        c_start = int(chunk.get("startMs", chunk.get("outputStartMs", 0)))
        if c_idx == 0 and not is_hierarchical_lockup:
            continue  # Covered by opening hook impact
        if not is_hierarchical_lockup and c_start - last_text_sfx_ms < 650:
            continue  # Enforce minimum audio pacing window between speech sounds

        if is_hierarchical_lockup:
            # Tactile mechanical UI click / shutter tick / transient snap (-18 dB to -24 dB)
            # Enforce clean acoustic spacing (>= 480ms), tasteful per-chunk density, and dynamic acoustic variance (variants 1-5)
            max_sfx_this_chunk = min(3, max(1, len(words) // 2)) if len(words) >= 4 else 1
            sfx_in_chunk = 0
            for w_idx, w in enumerate(words):
                if sfx_in_chunk >= max_sfx_this_chunk:
                    break
                w_ms = int(w.get("start_ms", c_start + w_idx * 220))
                if w_ms - last_text_sfx_ms >= 480:
                    click_cue = _pick_diverse_sfx([
                        "mechanical_click", "shutter_snap", "click_bupu", "tap_bupu"
                    ])
                    # Natural velocity dynamics across entrances
                    subtle_gain = -20.0 if w_idx == 0 else -22.5
                    variant_num = ((len(sfx) + w_idx + c_idx) % 5) + 1
                    sfx.append({
                        "id": f"sfx-lockup-click-{c_idx}-{w_idx}",
                        "cue": click_cue,
                        "variant": variant_num,
                        "triggerMs": w_ms,
                        "gainDb": subtle_gain,
                        "causedByChunkId": str(chunk.get("chunkIndex", c_idx)),
                        "causedByTreatment": "hierarchical_asymmetric_lockup",
                    })
                    last_text_sfx_ms = w_ms
                    sfx_in_chunk += 1
        elif is_single_word:
            # Tactile clicks, mechanical ticks, crisp UI taps - punchy and audible (-12.0 dB)
            click_cue = _pick_diverse_sfx([
                "click_bupu", "tap_bupu", "mechanical_click", "pop_text", "shutter_snap"
            ])
            variant_num = ((len(sfx) + c_idx) % 5) + 1
            sfx.append({
                "id": f"sfx-text-entry-{c_idx}",
                "cue": click_cue,
                "variant": variant_num,
                "triggerMs": c_start,
                "gainDb": -10.0,
                "causedByChunkId": str(chunk.get("chunkIndex", c_idx)),
            })
            last_text_sfx_ms = c_start

    # Purposeful camera zoom-ins for high-impact chunks (see plan_zoom_ins):
    # slow push / fast punch / J-cut, seeded with any transition-coupled moves,
    # gated, spaced, SFX-carrying, and governed.
    zoom_plan: Dict[str, Any] = {"cameraMoves": list(coupled_camera_moves), "sfx": []}
    try:
        zoom_plan = plan_zoom_ins(
            chunks=chunks,
            scenes=scenes,
            design=design,
            duration_ms=duration_ms,
            rng=rng,
            subject_observation=subject_observation,
            prompt=resolved_prompt,
            brand_preferences=resolved_brand_prefs,
            existing_moves=coupled_camera_moves,
        )
        camera_moves = zoom_plan["cameraMoves"]
        sfx.extend(zoom_plan.get("sfx", []))
        governance = govern_camera_moves(camera_moves, scenes)
        if governance:
            print(f"[orchestration] zoom governance warnings: {governance}", flush=True)
    except Exception as exc:  # never let a zoom decision break the render
        print(f"[orchestration] zoom planning skipped: {exc}", flush=True)
        camera_moves = list(coupled_camera_moves)

    # 2.5D After Effects-Style Spatial 3D Camera & Node Rig Planning
    # Damped spatial waypoints: 100% stable centered framing
    spatial_nodes: List[Dict[str, Any]] = []
    for idx, chunk in enumerate(chunks):
        c_start, c_end = _timing(chunk, idx, duration_ms)
        placement = chunk.get("placement") or {}
        dom_zone = placement.get("dominantZone") or "cranial_crown"
        align = placement.get("textAlign") or "center"

        spatial_nodes.append({
            "nodeId": f"spatial-node-{idx + 1}",
            "chunkIndex": idx + 1,
            "startMs": c_start,
            "endMs": c_end,
            "dominantZone": dom_zone,
            "alignment": align,
            "position": {"x": 0.0, "y": 0.0, "z": 0.0},
            "rotation": {"pitchDeg": 0.0, "yawDeg": 0.0, "rollDeg": 0.0},
            "scale": 1.0,
        })

    spatial_camera_3d = {
        "enabled": bool(design.get("spatialCamera3D", True)),
        "mode": design.get("spatialCameraMode", "static_centered"),
        "perspectivePx": 1200,
        "smoothingFactor": 1.0,
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
        "sfx": sfx + zoom_plan.get("sfx", []),
    }


def plan_orchestration_manifest(
    *,
    chunks: List[Dict[str, Any]],
    probe: Optional[Dict[str, Any]] = None,
    duration_ms: int,
    design: Optional[Dict[str, Any]] = None,
    subject_observation: Optional[Dict[str, Any]] = None,
    scenes: Optional[List[Dict[str, Any]]] = None,
    prompt: Optional[str] = None,
    brand_preferences: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Helper alias for plan_mini_run_orchestration with safe defaults."""
    return plan_mini_run_orchestration(
        chunks=chunks,
        probe=probe or {"width": 1080, "height": 1920},
        duration_ms=duration_ms,
        design=design,
        subject_observation=subject_observation,
        prompt=prompt,
        brand_preferences=brand_preferences,
    )
