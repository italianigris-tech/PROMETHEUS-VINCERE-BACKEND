"""Causal background placement for the portrait 9:16 Mini Runs renderer.

The portrait stage (``PrometheusMinRun.tsx``) already knows how to render an
orchestration ``background`` (sceneId + blurPx + brightness + counterScale) - the
only missing piece is that nothing ever *plans* one, so the manifest ships
``backgrounds: []`` and the stage never draws a backdrop.

This module is that missing planner. It is a direct descendant of the landscape
(16:9) background rigs, adapted to the portrait canvas:

* It derives a **9:16-variant background catalog** from the existing landscape
  texture assets (the ``mini_run_pipeline/textures/*.jpg`` set), and records, for
  every asset, how a 9:16 viewport actually crops it (``portraitCoverMetrics``).
  Landscape textures are ~3:2, so a 9:16 cover crop only keeps the middle strip -
  the ``verdict`` field makes that legible and drives the ``coverScale`` we ask the
  renderer to apply.
* It **detects semantic references** in each story chunk (list-stack, screencast,
  crisis, data-point) to decide *when / where* a background is deserved.
* It emits each placement with an explicit **entry** and **exit** window, a
  **transition** kind, a splash-style **code**, a text-legibility treatment, and a
  **cause** so the decision is auditable (no orphan backgrounds).
* It never places a background on a *behind-subject* chunk: text must always
  render **atop** the background, so foreground chunks are the only candidates.

Everything is deliberately pure / signature-driven so it can be unit-tested the
same way the rest of the orchestration module is.
"""

from __future__ import annotations

import re
import secrets
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

try:  # Pillow is optional; the catalog degrades to safe defaults without it.
    from PIL import Image  # type: ignore
except Exception:  # pragma: no cover - import guard
    Image = None  # type: ignore

TEXTURE_DIR = Path(__file__).resolve().parent / "textures"

# 9:16 (portrait) render viewport we judge every asset against.
PORTRAIT_VIEWPORT = (1080, 1920)

# Families recognised from the ``Texturelabs_<Family>_<id><SIZE>`` file names.
TEXTURE_FAMILIES = ("fabric", "paper", "ink_paint", "grunge", "glass")

# Default blend mode + intensity recommendation per family (mirrors landscape
# ``TextureTreatment``). These make arbitrary bitmaps read as a *canvas*, not a
# literal photograph, so they stay a backdrop behind kinetic text.
FAMILY_TREATMENT = {
    "paper": {"blendMode": "soft-light", "intensity": 0.20},
    "fabric": {"blendMode": "soft-light", "intensity": 0.20},
    "ink_paint": {"blendMode": "screen", "intensity": 0.25},
    "grunge": {"blendMode": "soft-light", "intensity": 0.20},
    "glass": {"blendMode": "screen", "intensity": 0.20},
}

# Reference triggers, adapted from the landscape ``scheduleBackgroundScene``
# salience gates to the (deliberately short) 2-3 word mini-run chunk text.
REFERENCE_PATTERNS: List[Dict[str, Any]] = [
    {
        "trigger": "list_stack",
        "code": "bg_list_stack",
        "candidate": "motion_stage_composite",
        "score": 100,
        "patterns": [r"1\.", r"2\.", r"3\.", r"first", r"second", r"third",
                     r"pillars", r"habits", r"steps", r"clearer", r"easier"],
        "families": ["paper", "fabric"],
    },
    {
        "trigger": "screencast",
        "code": "bg_screencast_canvas",
        "candidate": "texture_overlay",
        "score": 84,
        "patterns": [r"screen", r"calendar", r"dashboard", r"workflow", r"setup",
                     r"app", r"interface", r"table"],
        "families": ["paper"],
    },
    {
        "trigger": "crisis",
        "code": "bg_crisis_texture",
        "candidate": "texture_overlay",
        "score": 78,
        "patterns": [r"broke", r"broken", r"gave out", r"collaps", r"fail",
                     r"worse", r"stuck", r"terrible"],
        "families": ["grunge", "ink_paint"],
    },
    {
        "trigger": "data_point",
        "code": "bg_data_chart",
        "candidate": "chart_graph_stage",
        "score": 74,
        "patterns": [r"\d+", r"percent", r"stats", r"score", r"number",
                     r"doubled", r"tripled", r"million"],
        "families": ["paper", "glass"],
    },
    {
        "trigger": "heirloom",
        "code": "bg_quote_canvas",
        "candidate": "clean_anchor",
        "score": 66,
        "patterns": [r"quote", r"lesson", r"secret", r"golden", r"rule",
                     r"change", r"note", r"story"],
        "families": ["paper", "fabric"],
    },
]

# Entry transitions, chosen by trigger + score (from the landscape transition id).
TRANSITION_BY_TRIGGER = {
    "list_stack": "zoom_punch",
    "screencast": "directional_slide_right",
    "crisis": "directional_slide_left",
    "data_point": "crossfade",
    "heirloom": "luma_cut",
    None: "crossfade",
}


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _family_from_filename(filename: str) -> str:
    """Extract the texture family from a ``Texturelabs_Fabric_120XL.jpg`` name."""
    if not filename.startswith("Texturelabs_"):
        return "paper"
    tail = filename[len("Texturelabs_"):]
    head = tail.split("_")[0].lower().replace("-", "").replace("_", "")
    # CamelCase families like ``InkPaint`` normalise to ``inkpaint``, which is not
    # the canonical ``ink_paint`` key, so alias it back before the membership check.
    aliases = {"inkpaint": "ink_paint", "ink": "ink_paint"}
    if head in aliases:
        return aliases[head]
    return head if head in TEXTURE_FAMILIES else "paper"


def _texture_size(path: Path) -> Tuple[int, int]:
    """Best-effort width/height for an asset; falls back to a sane 3:2 default."""
    if Image is not None:
        try:
            with Image.open(path) as img:
                return int(img.size[0]), int(img.size[1])
        except Exception:
            pass
    return 4240, 2832


def portrait_cover_metrics(
    width: int,
    height: int,
    viewport: Tuple[int, int] = PORTRAIT_VIEWPORT,
) -> Dict[str, Any]:
    """How a 9:16 viewport cover-crops a ``width x height`` asset.

    Returns the fraction of source width/height that survives, the cover zoom
    factor relative to a width-fit, and a human ``verdict``.

    ``coverScale`` is the factor the renderer must apply to *fill* the portrait
    frame: ~2.7x for a 3:2 landscape source, which is exactly the tight-crop
    behaviour the user wants to see judged before committing to a texture.
    """
    vw, vh = viewport
    if width <= 0 or height <= 0:
        return {
            "visibleWidthRatio": 1.0, "visibleHeightRatio": 1.0,
            "coverScale": 1.0, "verdict": "portrait_native_ok",
        }
    scale = max(vw / width, vh / height)
    visible_width_ratio = vw / (width * scale)
    visible_height_ratio = vh / (height * scale)
    cover_scale = (width * vh) / max(1, height * vw)
    if visible_width_ratio >= 0.62:
        verdict = "portrait_native_ok"
    elif visible_width_ratio >= 0.48:
        verdict = "cover_crop_usable"
    else:
        verdict = "cover_crop_tight"
    return {
        "visibleWidthRatio": round(visible_width_ratio, 3),
        "visibleHeightRatio": round(visible_height_ratio, 3),
        "coverScale": round(cover_scale, 3),
        "verdict": verdict,
    }


def build_background_catalog(texture_dir: Path = TEXTURE_DIR) -> List[Dict[str, Any]]:
    """Index every bundled texture with its 9:16 cover metrics and treatment."""
    catalog: List[Dict[str, Any]] = []
    if not texture_dir.exists():
        return catalog
    for path in sorted(texture_dir.glob("*.jpg")):
        family = _family_from_filename(path.name)
        width, height = _texture_size(path)
        metrics = portrait_cover_metrics(width, height)
        treatment = FAMILY_TREATMENT.get(family, FAMILY_TREATMENT["paper"]) or {}
        catalog.append({
            "assetId": path.stem,
            "filePath": str(path),
            "fileName": path.name,
            "family": family,
            "width": width,
            "height": height,
            "aspectRatio": round(width / height, 4) if height else 1.0,
            "portraitCover": metrics,
            "blendMode": treatment.get("blendMode", "overlay"),
            "intensity": treatment.get("intensity", 0.3),
            "assetStatus": "bundled",
        })
    # Best 9:16 fit first (highest surviving width) so the tight-crop concern is
    # surfaced and the planner prefers the least-cropped asset.
    catalog.sort(key=lambda entry: (-entry["portraitCover"]["visibleWidthRatio"],
                                    entry["assetId"]))
    return catalog


def detect_background_reference(
    text: str,
    *,
    profile_name: Optional[str] = None,
    top_label: Optional[str] = None,
) -> Tuple[int, str, str, str]:
    """Score a chunk for a background-worthy semantic reference.

    Returns ``(score, trigger, candidate, code)``. A score of ``0`` means *no*
    background. ``candidate`` mirrors the landscape `BackgroundCoverageType`.
    """
    lower = (text or "").lower()
    context = f"{lower} {(profile_name or '').lower()} {(top_label or '').lower()}"
    best_score = 0
    best = (0, None, "clean_anchor", None)
    for rule in REFERENCE_PATTERNS:
        if any(re.search(pattern, context) for pattern in rule["patterns"]):
            score = int(rule["score"])
            if score > best_score:
                best_score = score
                best = (score, rule["trigger"], rule["candidate"], rule["code"])
    return best


def _pick_texture_for_trigger(
    catalog: Sequence[Dict[str, Any]], trigger: Optional[str]
) -> Dict[str, Any]:
    """Deterministically pick the best-fit texture for a trigger's family."""
    if not catalog:
        return {}
    if trigger is None:
        return catalog[0]
    rule = next((r for r in REFERENCE_PATTERNS if r["trigger"] == trigger), None)
    families = rule["families"] if rule else REFERENCE_PATTERNS[0]["families"]
    preferred = [entry for entry in catalog if entry["family"] in families]
    pool = preferred or list(catalog)
    return pool[0]


def plan_backgrounds(
    *,
    chunks: List[Dict[str, Any]],
    scenes: List[Dict[str, Any]],
    design: Optional[Dict[str, Any]] = None,
    texture_dir: Path = TEXTURE_DIR,
    duration_ms: int = 30000,
    texture_catalog: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Decide when/where to place backgrounds for a portrait mini-run.

    The frontend stage already consumes ``background`` entries (sceneId + blurPx +
    brightness + counterScale); this *extends* them with entry/exit/transition/code/
    texture metadata so the renderer can animate a true backdrop **under** the
    kinetic text.

    Governed invariants:

    * Only *foreground* scenes are candidates (a ``behindSubject`` chunk would put
      the backdrop in front of its text and break "text renders atop background").
    * A strict budget (``design.maxBackgrounds``, default 3) plus a minimum gap
      prevents a wall-to-wall texture look on a 30s short.
    * Every placement carries a ``cause`` referencing its scene/chunk so the whole
      plan is auditable end-to-end (causal routing), plus a ``code`` and a
      ``transition`` so the entry / exit can be choreographed.
    """
    design = dict(design or {})
    duration_ms = max(1, int(duration_ms))
    policy = str(design.get("backgroundPolicy", "auto"))
    if policy == "disabled":
        return []
    max_backgrounds = int(design.get("maxBackgrounds", 3))
    min_gap_ms = int(design.get("backgroundMinGapMs", 2200))
    entry_ms = int(design.get("backgroundEntryMs", 300))
    exit_ms = int(design.get("backgroundExitMs", 300))

    catalog = texture_catalog if texture_catalog is not None else build_background_catalog(texture_dir)
    if not catalog:
        return []

    candidates: List[Dict[str, Any]] = []
    for index, (chunk, scene) in enumerate(zip(chunks, scenes)):
        text = str(chunk.get("text", ""))
        subject_layering = chunk.get("subjectLayering") or {}
        if bool(subject_layering.get("behindSubject")):
            continue
        profile_name = chunk.get("profileName")
        top_label = chunk.get("topLabel")
        score, trigger, candidate, code = detect_background_reference(
            text, profile_name=profile_name, top_label=top_label
        )
        if score <= 0:
            continue
        # Let a high-salience hero chunk break a mild tie so the opening/outro
        # benefit from a canvas too, without undercutting an explicit reference.
        score = int(score + scene.get("salience", 0.0) * 6.0)
        candidates.append({
            "index": index,
            "chunk": chunk,
            "scene": scene,
            "score": score,
            "trigger": trigger,
            "candidate": candidate,
            "code": code,
        })

    candidates.sort(key=lambda item: (-item["score"], item["index"]))

    selected: List[Dict[str, Any]] = []
    last_end_ms = -10 ** 9
    for item in candidates[: max_backgrounds * 3]:
        scene = item["scene"]
        start_ms = int(scene["startMs"])
        if len(selected) >= max_backgrounds:
            break
        if selected and start_ms - last_end_ms < min_gap_ms:
            continue
        if start_ms + entry_ms >= int(scene["endMs"]):
            continue
        texture = _pick_texture_for_trigger(catalog, item["trigger"])
        selected.append({**item, "texture": texture})
        last_end_ms = int(scene["endMs"])

    backgrounds: List[Dict[str, Any]] = []
    for order, item in enumerate(selected):
        scene = item["scene"]
        chunk = item["chunk"]
        texture: Dict[str, Any] = item["texture"]
        start_ms = int(scene["startMs"])
        end_ms = min(int(scene["endMs"]), duration_ms)
        trigger = item["trigger"]
        transition_duration = int(design.get("backgroundTransitionMs", 300))
        code = f"{item['code']}_{order + 1:02d}"
        idx = item["index"] + 1
        scene_id = scene["id"]

        total_duration = max(1, end_ms - start_ms)
        effective_entry_ms = min(entry_ms, total_duration // 3)
        effective_exit_ms = min(exit_ms, total_duration // 3)

        background: Dict[str, Any] = {
            "id": f"background-{order + 1}",
            "sceneId": scene_id,
            "chunkIndex": idx - 1,
            "kind": "texture_canvas",
            "blurPx": int(design.get("backgroundBlurPx", 0)),
            "brightness": round(float(design.get("backgroundBrightness", 1.0)), 3),
            "counterScale": [1.03, 1.12],
            "transition": {
                "kind": TRANSITION_BY_TRIGGER.get(trigger, "crossfade"),
                "durationMs": transition_duration,
            },
            "entry": {
                "startMs": start_ms,
                "endMs": start_ms + effective_entry_ms,
            },
            "exit": {
                "startMs": max(start_ms + effective_entry_ms, end_ms - effective_exit_ms),
                "endMs": end_ms,
            },
            "code": code,
            "cause": {
                "gate": "semantic_background_reference",
                "sceneId": scene_id,
                "chunkIds": [chunk.get("chunkId", f"chunk-{idx}")],
                "chunkIndex": idx - 1,
                "trigger": trigger,
                "candidate": item["candidate"],
                "reason": (
                    f"Chunk {idx} carried a '{trigger}' semantic reference; placed a "
                    f"{texture.get('family', 'paper')} canvas behind its kinetic text."
                ),
            },
        }

        if texture:
            cover = texture.get("portraitCover") or {}
            background["texture"] = {
                "assetId": texture.get("assetId"),
                "fileName": texture.get("fileName"),
                "family": texture.get("family"),
                "width": texture.get("width"),
                "height": texture.get("height"),
                "aspectRatio": texture.get("aspectRatio"),
                "portraitCover": cover,
                "blendMode": texture.get("blendMode"),
                "intensity": texture.get("intensity"),
                "coverScale": round(_clamp(float(cover.get("coverScale", 1.0)), 1.0, 3.0), 2),
            }
        backgrounds.append(background)

    return backgrounds


def govern_backgrounds(
    backgrounds: Sequence[Dict[str, Any]],
    scenes: Sequence[Dict[str, Any]],
) -> List[str]:
    """Return a list of causal-integrity issues (empty list => clean)."""
    issues: List[str] = []
    scene_ids = {scene["id"] for scene in scenes}
    seen_ids = [b.get("id") for b in backgrounds]
    for background in backgrounds:
        bid = background.get("id")
        scene_id = background.get("sceneId")
        if scene_id not in scene_ids:
            issues.append(f"{bid}: references unknown scene {scene_id!r}")
        if not isinstance(background.get("cause"), dict):
            issues.append(f"{bid}: missing causal cause")
            continue
        if background["cause"].get("chunkIndex") is None and not background["cause"].get("chunkIds"):
            issues.append(f"{bid}: cause references no chunk")
        entry = background.get("entry") or {}
        exit_ = background.get("exit") or {}
        if entry.get("startMs", 0) > entry.get("endMs", 0):
            issues.append(f"{bid}: entry window inverted")
        if exit_.get("startMs", 0) > exit_.get("endMs", 0):
            issues.append(f"{bid}: exit window inverted")
        if entry.get("endMs", 0) > exit_.get("startMs", exit_.get("endMs", 0)):
            issues.append(f"{bid}: entry overlaps exit")
        texture = background.get("texture")
        if texture is None and background.get("kind") == "texture_canvas":
            issues.append(f"{bid}: texture_canvas has no texture asset")
    if len(seen_ids) != len(set(seen_ids)):
        issues.append("backgrounds: duplicate background ids")
    return issues


def render_portrait_previews(
    catalog: Optional[List[Dict[str, Any]]] = None,
    out_dir: Optional[Path] = None,
    viewport: Tuple[int, int] = PORTRAIT_VIEWPORT,
) -> List[Path]:
    """Write a 9:16 cover-crop JPEG preview per catalog asset.

    This is the "see how they perform on a 9:16" check: each landscape texture is
    cover-fit into a portrait canvas so the crop performance is visible without a
    full Remotion render. Returns the list of written preview paths.
    """
    catalog = catalog if catalog is not None else build_background_catalog()
    out_dir = out_dir or (Path(__file__).resolve().parent.parent / "docs" / "mini_run_studio" / "background_previews")
    out_dir.mkdir(parents=True, exist_ok=True)
    written: List[Path] = []
    if Image is None:
        return written
    vw, vh = viewport
    for entry in catalog:
        path = Path(entry["filePath"])
        if not path.exists():
            continue
        try:
            with Image.open(path) as img:
                img = img.convert("RGB")
                src_w, src_h = img.size
                scale = max(vw / src_w, vh / src_h)
                new_size = (int(round(src_w * scale)), int(round(src_h * scale)))
                resized = img.resize(new_size, Image.LANCZOS)
                left = (new_size[0] - vw) // 2
                top = (new_size[1] - vh) // 2
                cropped = resized.crop((left, top, left + vw, top + vh))
                out_path = out_dir / f"{entry['assetId']}_9x16.jpg"
                cropped.save(out_path, "JPEG", quality=88)
                written.append(out_path)
        except Exception:
            continue
    return written


def build_contact_sheet(
    output_path: Path,
    catalog: Optional[List[Dict[str, Any]]] = None,
    viewport: Tuple[int, int] = PORTRAIT_VIEWPORT,
    thumb_height: int = 340,
) -> Path:
    """Assemble a single contact-sheet PNG of all 9:16 previews for review."""
    catalog = catalog if catalog is not None else build_background_catalog()
    if Image is None or not catalog:
        return output_path
    vw, vh = viewport
    scale = thumb_height / vh
    tw, th = int(vw * scale), thumb_height
    columns = 6
    rows = (len(catalog) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * tw, rows * th), (20, 20, 20))
    for i, entry in enumerate(catalog):
        path = Path(entry["filePath"])
        if not path.exists():
            continue
        try:
            with Image.open(path) as img:
                img = img.convert("RGB")
                src_w, src_h = img.size
                s = max(vw / src_w, vh / src_h)
                new_size = (int(round(src_w * s)), int(round(src_h * s)))
                resized = img.resize(new_size, Image.LANCZOS)
                left = (new_size[0] - vw) // 2
                top = (new_size[1] - vh) // 2
                cropped = resized.crop((left, top, left + vw, top + vh)).resize((tw, th), Image.LANCZOS)
        except Exception:
            continue
        col, row = i % columns, i // columns
        sheet.paste(cropped, (col * tw, row * th))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, "PNG")
    return output_path


def seeded_plan_backgrounds(
    *,
    chunks: List[Dict[str, Any]],
    scenes: List[Dict[str, Any]],
    design: Optional[Dict[str, Any]] = None,
    texture_dir: Path = TEXTURE_DIR,
    duration_ms: int = 30000,
    seed: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Seed-derived plan: keep decisions reproducible per render nonce."""
    # The catalogue pick + budget are already deterministic; exposing a seed-based
    # wrapper keeps the door open to non-deterministic tie-breaks later without
    # changing the caller contract.
    _ = seed or secrets.token_hex(8)
    return plan_backgrounds(
        chunks=chunks,
        scenes=scenes,
        design=design,
        texture_dir=texture_dir,
        duration_ms=duration_ms,
    )
