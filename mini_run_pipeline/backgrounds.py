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

import hashlib
import re
import secrets
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

try:  # Pillow is optional; the catalog degrades to safe defaults without it.
    from PIL import Image  # type: ignore
except Exception:  # pragma: no cover - import guard
    Image = None  # type: ignore

TEXTURE_DIR = Path(__file__).resolve().parent / "textures"

# 9:16 (portrait) render viewport we judge every asset against.
PORTRAIT_VIEWPORT = (1080, 1920)

# Supported background kinds for dynamic portrait staging
BACKGROUND_KINDS = (
    "texture_canvas",
    "editorial_glass",
    "gradient_atmosphere",
    "defocus_depth",
    "brand_canvas",
    "blurred_wings",
    "broll_cutaway",
    "negative_space_stencil",
    "viewfinder_scaffold",
    "frame_break_cutout_2_5d",
    "continuous_vector_rail",
    "cgi_hybrid_path_typography",
    "vertical_kinetic_carousel",
    "kinetic_reticle_annotation",
    "vintage_halftone_lithograph",
    "hierarchical_spatial_staging",
    "ambient_shadow_gobo",
    "single_frame_retinal_inversion",
    "attention_gated_bokeh",
    "continuous_spatial_canvas",
)

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
        "default_kind": "texture_canvas",
        "score": 100,
        "patterns": [r"1\.", r"2\.", r"3\.", r"\bfirst\b", r"\bsecond\b", r"\bthird\b",
                     r"\bpillars?\b", r"\bhabits?\b", r"\bsteps?\b", r"\bclearer\b", r"\beasier\b"],
        "families": ["paper", "fabric"],
    },
    {
        "trigger": "screencast",
        "code": "bg_screencast_canvas",
        "candidate": "editorial_glass_stage",
        "default_kind": "editorial_glass",
        "score": 84,
        "patterns": [r"\bscreen\b", r"\bcalendar\b", r"\bdashboard\b", r"\bworkflow\b", r"\bsetup\b",
                     r"\bapp\b", r"\binterface\b", r"\btable\b"],
        "families": ["glass", "paper"],
    },
    {
        "trigger": "crisis",
        "code": "bg_crisis_texture",
        "candidate": "texture_overlay",
        "default_kind": "texture_canvas",
        "score": 78,
        "patterns": [r"\bbroke\b", r"\bbroken\b", r"\bgave out\b", r"\bcollaps", r"\bfail",
                     r"\bworse\b", r"\bstuck\b", r"\bterrible\b"],
        "families": ["grunge", "ink_paint"],
    },
    {
        "trigger": "data_point",
        "code": "bg_data_chart",
        "candidate": "editorial_glass_stage",
        "default_kind": "editorial_glass",
        "score": 74,
        "patterns": [r"\b\d+%\b", r"\b\d+\s*(?:percent|million|billion|thousand|k\b|x\b)",
                     r"\bpercent\b", r"\bstats\b", r"\bmetrics\b", r"\bdoubled\b", r"\btripled\b"],
        "families": ["glass", "paper"],
    },
    {
        "trigger": "heirloom",
        "code": "bg_quote_canvas",
        "candidate": "defocus_depth_anchor",
        "default_kind": "defocus_depth",
        "score": 66,
        "patterns": [r"\bquote\b", r"\blesson\b", r"\bsecret\b", r"\bgolden rule\b",
                     r"\bcore truth\b", r"\bnote\b"],
        "families": ["paper", "fabric"],
    },
    {
        "trigger": "opportunity_filter",
        "code": "bg_opportunity_scaffold",
        "candidate": "viewfinder_scaffold",
        "default_kind": "viewfinder_scaffold",
        "score": 98,
        "patterns": [r"\bopportunit", r"\bmatter\b", r"\bfilter\b", r"\bchoose\b", r"\bchoice\b", r"\bdecisions?\b"],
        "families": ["paper", "glass"],
    },
    {
        "trigger": "machine_automation",
        "code": "bg_machine_engine",
        "candidate": "cgi_hybrid_path_typography",
        "default_kind": "cgi_hybrid_path_typography",
        "score": 99,
        "patterns": [r"\bmachine\b", r"\boperate\b", r"\bwithout you\b", r"\bautonomous\b", r"\bengine\b", r"\bflywheel\b"],
        "families": ["grunge", "glass"],
    },
    {
        "trigger": "vintage_halftone",
        "code": "bg_halftone_lithograph",
        "candidate": "vintage_halftone_lithograph",
        "default_kind": "vintage_halftone_lithograph",
        "score": 94,
        "patterns": [r"\bhalftone\b", r"\blithograph\b", r"\bengrav", r"\bdot\s*screen\b", r"\bvintage\b"],
        "families": ["paper", "ink_paint"],
    },
    {
        "trigger": "frame_break",
        "code": "bg_frame_breaking_cutout",
        "candidate": "frame_break_cutout_2_5d",
        "default_kind": "frame_break_cutout_2_5d",
        "score": 95,
        "patterns": [r"\bcutout\b", r"\bbreak\s*out\b", r"\bpop\b", r"\bextrud", r"\bdepth\b"],
        "families": ["paper", "fabric"],
    },
    {
        "trigger": "vector_rail",
        "code": "bg_vector_ribbon",
        "candidate": "continuous_vector_rail",
        "default_kind": "continuous_vector_rail",
        "score": 91,
        "patterns": [r"\brail\b", r"\bribbon\b", r"\bvector\b", r"\bpath\b", r"\btrajectory\b", r"\bpan\b"],
        "families": ["glass", "paper"],
    },
    {
        "trigger": "vertical_carousel",
        "code": "bg_card_carousel",
        "candidate": "vertical_kinetic_carousel",
        "default_kind": "vertical_kinetic_carousel",
        "score": 89,
        "patterns": [r"\bcarousel\b", r"\bcards?\b", r"\bsnap\b", r"\bscroll\b", r"\bstep\b"],
        "families": ["glass", "paper"],
    },
    {
        "trigger": "hierarchical_spatial_staging",
        "code": "bg_hierarchical_staging",
        "candidate": "hierarchical_spatial_staging",
        "default_kind": "hierarchical_spatial_staging",
        "score": 97,
        "patterns": [
            r"\bhunting\b", r"\bhero\s+anchor\b", r"\bmicro[\s_-]?assets?\b",
            r"\bstationery\b", r"\bperipheral\b", r"\bcontextual\s+tokens?\b",
            r"\bdesk\s+surface\b", r"\bspatial\s+staging\b", r"\btwo[\s_-]?tier\b",
        ],
        "families": ["paper", "fabric"],
    },
    {
        "trigger": "ambient_shadow_gobo",
        "code": "bg_ambient_gobo",
        "candidate": "ambient_shadow_gobo",
        "default_kind": "ambient_shadow_gobo",
        "score": 96,
        "patterns": [
            r"\bgobo\b", r"\bambient\s+shadow\b", r"\bwindow\s+frames?\b",
            r"\bswaying\s+foliage\b", r"\bshadow\s+overlay\b", r"\bdynamic\s+environment\s+lighting\b",
            r"\bliving\s+organic\b",
        ],
        "families": ["paper", "glass"],
    },
    {
        "trigger": "single_frame_retinal_inversion",
        "code": "bg_retinal_inversion",
        "candidate": "single_frame_retinal_inversion",
        "default_kind": "single_frame_retinal_inversion",
        "score": 99,
        "patterns": [
            r"\bretinal\s+inversion\b", r"\bmicro[\s_-]?flash\b", r"\bvisual\s+punch\b",
            r"\bhard\s+(?:color\s+)?inversion\b", r"\bsingle[\s_-]?frame\b",
            r"\baudio\s+transients?\b",
        ],
        "families": ["grunge", "glass"],
    },
    {
        "trigger": "attention_gated_bokeh",
        "code": "bg_attention_bokeh",
        "candidate": "attention_gated_bokeh",
        "default_kind": "attention_gated_bokeh",
        "score": 95,
        "patterns": [
            r"\bbokeh\b", r"\bdefocus\s+rack\b", r"\brack\s+focus\b",
            r"\battention[\s_-]?gated\b", r"\bdrop\s+out\s+of\s+focus\b",
            r"\boptical\s+blur\b",
        ],
        "families": ["glass", "paper"],
    },
    {
        "trigger": "continuous_spatial_canvas",
        "code": "bg_spatial_descent",
        "candidate": "continuous_spatial_canvas",
        "default_kind": "continuous_spatial_canvas",
        "score": 98,
        "patterns": [
            r"\bvertical\s+descent\b", r"\bcontinuous\s+(?:spatial\s+)?canvas\b",
            r"\bunified\s+plane\b", r"\binertial\s+handoff\b",
            r"\bdamped\s+spring\b", r"\bmodules?\s+from\s+below\b",
        ],
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
    "intro_hook": "zoom_punch",
    "brand_intro": "zoom_punch",
    "transition_shift": "crossfade",
    "transition_context": "crossfade",
    "scene_shift": "directional_slide_right",
    "broll_cutaway": "zoom_punch",
    "negative_space": "iris_wipe",
    "opportunity_filter": "zoom_punch",
    "machine_automation": "zoom_punch",
    "vintage_halftone": "crossfade",
    "frame_break": "zoom_punch",
    "vector_rail": "directional_slide_right",
    "vertical_carousel": "directional_slide_left",
    "hierarchical_spatial_staging": "zoom_punch",
    "ambient_shadow_gobo": "crossfade",
    "single_frame_retinal_inversion": "hard_cut",
    "attention_gated_bokeh": "bokeh_defocus_blend",
    "continuous_spatial_canvas": "vertical_descent",
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


CONCRETE_ASSET_DIR = Path(__file__).resolve().parent.parent / "prometheus CONCRETE assets"
STUDIO_ASSET_DIR = Path(__file__).resolve().parent.parent / "docs" / "mini_run_studio" / "assets"


def build_concrete_asset_catalog(
    concrete_dir: Path = CONCRETE_ASSET_DIR,
    studio_dir: Path = STUDIO_ASSET_DIR,
) -> List[Dict[str, Any]]:
    """Index physical concrete assets and studio halftone cutouts for 2.5D frame-breaking and CGI anchors."""
    catalog: List[Dict[str, Any]] = []

    # Map concrete cutout assets
    if concrete_dir.exists():
        for path in sorted(concrete_dir.glob("*.png")):
            w, h = _texture_size(path)
            stem = path.stem.lower()
            if "thinking" in stem or "choose" in stem:
                concept = "opportunity_decision"
                role = "frame_break_subject"
            elif "money" in stem or "purchase" in stem:
                concept = "wealth_scale"
                role = "frame_break_subject"
            elif "camera" in stem:
                concept = "visual_creator"
                role = "frame_break_subject"
            elif "calender" in stem or "months" in stem:
                concept = "time_horizon"
                role = "frame_break_subject"
            elif "expert" in stem:
                concept = "authority_system"
                role = "frame_break_subject"
            else:
                concept = "concrete_physical"
                role = "frame_break_subject"
            catalog.append({
                "assetId": path.stem,
                "filePath": str(path),
                "fileName": path.name,
                "sourceCategory": "concrete_assets",
                "concept": concept,
                "role": role,
                "width": w,
                "height": h,
                "isMatted": True,
            })

    # Map studio dogma and halftone assets
    if studio_dir.exists():
        for path in sorted(studio_dir.glob("*_matted.png")):
            w, h = _texture_size(path)
            stem = path.stem.lower()
            if "halftone" in stem:
                concept = "halftone_lithograph"
                role = "halftone_anchor"
            elif "synapse" in stem:
                concept = "cognitive_architecture"
                role = "halftone_anchor"
            elif "founder" in stem:
                concept = "founder_scale"
                role = "frame_break_subject"
            else:
                concept = "bespoke_matted"
                role = "frame_break_subject"
            catalog.append({
                "assetId": path.stem,
                "filePath": str(path),
                "fileName": path.name,
                "sourceCategory": "studio_dogma",
                "concept": concept,
                "role": role,
                "width": w,
                "height": h,
                "isMatted": True,
            })

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
    catalog: Sequence[Dict[str, Any]],
    trigger: Optional[str],
    preferred_family: Optional[str] = None,
    used_asset_ids: Optional[Set[str]] = None,
    seed: Optional[str] = None,
    chunk_index: int = 0,
    scene_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Dynamically pick the best-fit texture from the catalog with diversity & entropy.

    Eradicates deterministic repetition across scenes and runs:
    1. Tracks used_asset_ids to guarantee non-repetition within the same video run.
    2. Derives an entropy index from (seed, scene_id, chunk_index, trigger) modulo pool size.
    3. Respects preferred_family or trigger-family compatibility, falling back gracefully.
    """
    if not catalog:
        return {}

    used_ids = used_asset_ids if used_asset_ids is not None else set()

    # 1. Resolve candidate pool based on preferred family or trigger family
    family_pool: List[Dict[str, Any]] = []
    if preferred_family and preferred_family in TEXTURE_FAMILIES:
        family_pool = [entry for entry in catalog if entry.get("family") == preferred_family]
    elif trigger is not None:
        rule = next((r for r in REFERENCE_PATTERNS if r["trigger"] == trigger), None)
        families = rule["families"] if rule else REFERENCE_PATTERNS[0]["families"]
        family_pool = [entry for entry in catalog if entry.get("family") in families]

    # Prioritize unused assets in the family pool
    unused_family = [e for e in family_pool if e.get("assetId") not in used_ids]
    if unused_family:
        pool = unused_family
    elif family_pool:
        pool = family_pool
    else:
        # Fallback to unused across entire catalog
        unused_all = [e for e in catalog if e.get("assetId") not in used_ids]
        pool = unused_all if unused_all else list(catalog)

    # 2. Entropy-based selection to eradicate deterministic repetition
    seed_str = f"{seed or 'entropy'}:{scene_id or ''}:{chunk_index}:{trigger or ''}"
    hash_int = int(hashlib.sha256(seed_str.encode("utf-8")).hexdigest()[:8], 16)
    chosen_idx = hash_int % len(pool)
    chosen = pool[chosen_idx]

    if used_asset_ids is not None and chosen.get("assetId"):
        used_asset_ids.add(chosen["assetId"])

    return chosen


def parse_background_preferences(
    prompt: Optional[str] = None,
    brand_preferences: Optional[Dict[str, Any]] = None,
    design: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Reconcile background directives from brand preferences, design, and user prompt.

    Supported brand preferences:
      - backgroundPolicy: 'auto' | 'enabled' | 'always' | 'intro_only' | 'transitions_only' | 'disabled'
      - introBackground: bool (forces an expressive background during the intro hook / chunk 0)
      - transitionBackgrounds: bool (couples background shifts to scene transitions for contextual expressivity)
      - backgroundFamily: 'paper' | 'fabric' | 'grunge' | 'ink_paint' | 'glass'
      - backgroundKind / backgroundType: 'texture_canvas' | 'editorial_glass' | 'gradient_atmosphere' | 'defocus_depth' | 'brand_canvas'
      - backgroundIntensity: float (0.10 - 0.60)
      - backgroundBlendMode: 'soft-light' | 'screen' | 'overlay'
      - brandColors / motif: dict with primary, accent, glowRgb
    """
    brand_prefs = dict(brand_preferences or {})
    design_dict = dict(design or {})

    prompt_lower = (prompt or "").lower()
    prompt_has_disable = bool(re.search(
        r"\b(no|without|disable|never|omit)\s+(backgrounds?|backdrops?|textures?)\b",
        prompt_lower
    ))
    prompt_has_always = bool(re.search(
        r"\b(always|full|every\s+scene|all\s+scenes|all\s+videos)\b.*\b(backgrounds?|backdrops?)\b",
        prompt_lower
    ))
    prompt_has_intro_only = bool(re.search(
        r"\b(intro|introduction|opening|hook)\s+only\b.*\b(backgrounds?|backdrops?)\b",
        prompt_lower
    ))
    prompt_has_trans_only = bool(re.search(
        r"\b(transition|transitions|shifts?)\s+only\b.*\b(backgrounds?|backdrops?)\b",
        prompt_lower
    ))
    prompt_has_enable = bool(re.search(
        r"\b(with|use|add|enable|show|put|expressive)\b[\w\s,]{0,25}\b(backgrounds?|backdrops?|textures?|canvas)\b",
        prompt_lower
    ))
    user_prompt_requested = bool(
        (prompt_has_enable or prompt_has_always or prompt_has_intro_only or prompt_has_trans_only)
        and not prompt_has_disable
    )

    # 1. Policy resolution
    explicit_policy = (
        brand_prefs.get("backgroundPolicy")
        or brand_prefs.get("policy")
        or design_dict.get("backgroundPolicy")
    )
    policy = "auto"
    if explicit_policy and str(explicit_policy).lower() in (
        "auto", "enabled", "always", "intro_only", "transitions_only", "disabled"
    ):
        policy = str(explicit_policy).lower()
    elif prompt_has_disable:
        policy = "disabled"
    elif prompt_has_always:
        policy = "always"
    elif prompt_has_intro_only:
        policy = "intro_only"
    elif prompt_has_trans_only:
        policy = "transitions_only"
    elif prompt_has_enable:
        policy = "enabled"

    # 2. Intro Background resolution
    intro_from_brand = False
    intro_from_prompt = False
    explicit_intro = (
        brand_prefs.get("introBackground")
        if brand_prefs.get("introBackground") is not None
        else design_dict.get("introBackground")
    )
    if explicit_intro is not None:
        intro_background = bool(explicit_intro)
        intro_from_brand = True
    elif policy in ("intro_only", "always"):
        intro_background = True
    elif policy == "disabled":
        intro_background = False
    elif prompt:
        intro_match = re.search(
            r"\b(intro|introduction|opening|hook|opener|start|title)\b[\w\s,]{0,30}\b(background|backdrop|canvas|texture)\b"
            r"|\b(background|backdrop|canvas|texture)\b[\w\s,]{0,30}\b(intro|introduction|opening|hook|opener|start|title)\b",
            prompt_lower,
        )
        intro_background = bool(intro_match)
        intro_from_prompt = bool(intro_match)
    else:
        intro_background = False

    # 3. Transition Backgrounds resolution
    explicit_trans = (
        brand_prefs.get("transitionBackgrounds")
        if brand_prefs.get("transitionBackgrounds") is not None
        else design_dict.get("transitionBackgrounds")
    )
    if explicit_trans is not None:
        transition_backgrounds = bool(explicit_trans)
    elif policy in ("transitions_only", "always"):
        transition_backgrounds = True
    elif policy == "disabled":
        transition_backgrounds = False
    elif prompt:
        trans_match = re.search(
            r"\b(transition|transitions|scene\s*shift|cut)\b[\w\s,]{0,30}\b(background|backdrop|canvas|texture)\b"
            r"|\b(background|backdrop|canvas|texture)\b[\w\s,]{0,30}\b(transition|transitions|scene\s*shift)\b"
            r"|\b(change|switch)\s+(onto|to)\s+(a\s+)?(background|backdrop|canvas|texture)\b",
            prompt_lower,
        )
        transition_backgrounds = bool(trans_match)
    else:
        transition_backgrounds = False

    # 4. Background Type / Kind resolution
    explicit_kind = (
        brand_prefs.get("backgroundKind")
        or brand_prefs.get("backgroundType")
        or brand_prefs.get("kind")
        or design_dict.get("backgroundKind")
        or design_dict.get("backgroundType")
    )
    preferred_kind = None
    if explicit_kind and str(explicit_kind).lower() in BACKGROUND_KINDS:
        preferred_kind = str(explicit_kind).lower()
    elif prompt:
        if re.search(r"\b(editorial\s+glass|frosted\s+glass|glass\s+card|glass\s+backdrop)\b", prompt_lower):
            preferred_kind = "editorial_glass"
        elif re.search(r"\b(gradient\s+atmosphere|mesh\s+gradient|ambient\s+gradient|ambient\s+glow)\b", prompt_lower):
            preferred_kind = "gradient_atmosphere"
        elif re.search(r"\b(defocus\s+depth|focal\s+defocus|bokeh\s+depth|bokeh\s+blur)\b", prompt_lower):
            preferred_kind = "defocus_depth"
        elif re.search(r"\b(brand\s+canvas|brand\s+wash)\b", prompt_lower):
            preferred_kind = "brand_canvas"
        elif re.search(r"\b(texture\s+canvas|paper\s+texture|fabric\s+texture|grunge|tactile)\b", prompt_lower):
            preferred_kind = "texture_canvas"
        elif re.search(r"\b(b[\s_-]?roll|cutaway|footage\s+change|scene\s+footage)\b", prompt_lower):
            preferred_kind = "broll_cutaway"
        elif re.search(r"\b(negative\s+space|knockout|stencil|cutout)\b", prompt_lower):
            preferred_kind = "negative_space_stencil"
        elif re.search(r"\b(viewfinder|scaffold|l[\s_-]?brackets?|registration\s+marks?|white\s+container)\b", prompt_lower):
            preferred_kind = "viewfinder_scaffold"
        elif re.search(r"\b(frame[\s_-]?break|2\.5d|overflow\s+pop|contact\s+shadow)\b", prompt_lower):
            preferred_kind = "frame_break_cutout_2_5d"
        elif re.search(r"\b(vector\s+rail|motion\s+rail|vector\s+ribbon|spatial\s+panning)\b", prompt_lower):
            preferred_kind = "continuous_vector_rail"
        elif re.search(r"\b(cgi|3d\s+sphere|3d\s+model|path[\s_-]?bound|curved\s+text)\b", prompt_lower):
            preferred_kind = "cgi_hybrid_path_typography"
        elif re.search(r"\b(vertical\s+carousel|card\s+carousel|step[\s_-]?scroll)\b", prompt_lower):
            preferred_kind = "vertical_kinetic_carousel"
        elif re.search(r"\b(reticle|bounding\s+box|kinetic\s+annotation|crosshairs?)\b", prompt_lower):
            preferred_kind = "kinetic_reticle_annotation"
        elif re.search(r"\b(halftone|lithograph|scanlines?|dot\s+screen)\b", prompt_lower):
            preferred_kind = "vintage_halftone_lithograph"
        elif re.search(r"\b(hierarchical\s+staging|hero\s+anchor|peripheral\s+assets?|desk\s+props?|spatial\s+staging)\b", prompt_lower):
            preferred_kind = "hierarchical_spatial_staging"
        elif re.search(r"\b(gobo|ambient\s+shadow|window\s+frames?|swaying\s+foliage|dynamic\s+environment\s+lighting)\b", prompt_lower):
            preferred_kind = "ambient_shadow_gobo"
        elif re.search(r"\b(retinal\s+inversion|micro[\s_-]?flash|flash\s+punch|hard\s+inversion|color\s+inversion)\b", prompt_lower):
            preferred_kind = "single_frame_retinal_inversion"
        elif re.search(r"\b(attention[\s_-]?gated|defocus\s+rack|rack\s+focus|optical\s+bokeh|lens\s+bokeh)\b", prompt_lower):
            preferred_kind = "attention_gated_bokeh"
        elif re.search(r"\b(continuous\s+(?:spatial\s+)?canvas|vertical\s+descent|unified\s+plane|inertial\s+handoff)\b", prompt_lower):
            preferred_kind = "continuous_spatial_canvas"

    # 5. Preferred texture family
    preferred_family = (
        brand_prefs.get("backgroundFamily")
        or brand_prefs.get("textureFamily")
        or brand_prefs.get("family")
        or design_dict.get("backgroundFamily")
    )
    if preferred_family and str(preferred_family).lower() in TEXTURE_FAMILIES:
        preferred_family = str(preferred_family).lower()
    elif prompt:
        if re.search(r"\b(paper|parchment|editorial\s+paper|notepad)\b", prompt_lower):
            preferred_family = "paper"
        elif re.search(r"\b(fabric|linen|cotton|textile|woven)\b", prompt_lower):
            preferred_family = "fabric"
        elif re.search(r"\b(grunge|distressed|rough|dirty|grungy|grit)\b", prompt_lower):
            preferred_family = "grunge"
        elif re.search(r"\b(ink|paint|splatter|acrylic|watercolor)\b", prompt_lower):
            preferred_family = "ink_paint"
        elif re.search(r"\b(glass|frosted|crystal|transparent|sheer)\b", prompt_lower):
            preferred_family = "glass"

    # 6. Styling: Intensity, blend mode, and brand color tint
    intensity = brand_prefs.get("backgroundIntensity") or design_dict.get("backgroundIntensity")
    if intensity is not None:
        try:
            intensity = float(intensity)
        except (ValueError, TypeError):
            intensity = None

    blend_mode = brand_prefs.get("backgroundBlendMode") or design_dict.get("backgroundBlendMode")
    brand_colors = (
        brand_prefs.get("brandColors")
        or brand_prefs.get("colors")
        or design_dict.get("brandColors")
        or (design_dict.get("motif") or {}).get("colors")
    )
    brand_tint = None
    if isinstance(brand_colors, dict):
        if "glowRgb" in brand_colors:
            brand_tint = f"rgba({brand_colors['glowRgb']}, 0.18)"
        elif "primary" in brand_colors:
            brand_tint = brand_colors["primary"]

    brand_requested = bool(
        brand_prefs.get("introBackground") is not None
        or brand_prefs.get("transitionBackgrounds") is not None
        or brand_prefs.get("backgroundFamily")
        or brand_prefs.get("backgroundKind")
        or brand_prefs.get("backgroundType")
        or (explicit_policy and explicit_policy != "auto")
    )

    return {
        "policy": policy,
        "introBackground": intro_background,
        "transitionBackgrounds": transition_backgrounds,
        "preferredFamily": preferred_family,
        "preferredKind": preferred_kind,
        "intensity": intensity,
        "blendMode": blend_mode,
        "brandColors": brand_colors,
        "brandTint": brand_tint,
        "introFromBrand": intro_from_brand,
        "introFromPrompt": intro_from_prompt,
        "userPromptRequested": user_prompt_requested,
        "brandRequested": brand_requested,
    }


def plan_backgrounds(
    *,
    chunks: List[Dict[str, Any]],
    scenes: List[Dict[str, Any]],
    design: Optional[Dict[str, Any]] = None,
    texture_dir: Path = TEXTURE_DIR,
    duration_ms: int = 30000,
    texture_catalog: Optional[List[Dict[str, Any]]] = None,
    prompt: Optional[str] = None,
    brand_preferences: Optional[Dict[str, Any]] = None,
    transitions: Optional[List[Dict[str, Any]]] = None,
    seed: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Decide when/where to place backgrounds for a portrait mini-run.

    Governed invariants:
    * Cool-fingered restraint: In default 'auto' mode without creator prompt or brand directives,
      backgrounds are withheld unless an exceptional high-salience structural anchor warrants one.
      An unprompted video can run 100% clean (backgrounds = []).
    * Dynamic selection of background type: elects texture_canvas, editorial_glass,
      gradient_atmosphere, or defocus_depth matching narrative context and brand directives.
    * Asset diversity: Eliminates repetitive templating by hashing (seed, chunk, trigger) across
      the 44 bundled textures and enforcing run-level non-repetition (used_asset_ids).
    * Synchronizes background changes with scene transitions when context switching is desired.
    * Only foreground scenes are candidates (behindSubject chunks are excluded).
    * Enforces budget (maxBackgrounds) and minimum quiet gap between backdrops.
    * Every placement carries an auditable cause with gate, sceneId, and chunkIds.
    """
    design = dict(design or {})
    duration_ms = max(1, int(duration_ms))
    prefs = parse_background_preferences(
        prompt=prompt,
        brand_preferences=brand_preferences,
        design=design,
    )
    policy = prefs["policy"]
    if policy == "disabled":
        return []

    # Cool-fingered check: is there a creator mandate (via prompt or brand) for backgrounds?
    is_directed = bool(
        prefs["introBackground"]
        or prefs["transitionBackgrounds"]
        or prefs.get("userPromptRequested")
        or prefs.get("brandRequested")
        or policy in ("enabled", "always", "intro_only", "transitions_only")
    )

    max_backgrounds = int(design.get("maxBackgrounds", 3))
    if not is_directed and policy == "auto":
        # Restrained budget when unprompted
        max_backgrounds = min(max_backgrounds, 1)
    elif prefs["introBackground"] and prefs["transitionBackgrounds"]:
        max_backgrounds = max(max_backgrounds, 4)

    min_gap_ms = int(design.get("backgroundMinGapMs", 2200))
    entry_ms = int(design.get("backgroundEntryMs", 300))
    exit_ms = int(design.get("backgroundExitMs", 300))

    catalog = texture_catalog if texture_catalog is not None else build_background_catalog(texture_dir)
    if not catalog and prefs.get("preferredKind") not in ("editorial_glass", "gradient_atmosphere", "defocus_depth"):
        return []

    selected: List[Dict[str, Any]] = []
    used_asset_ids: Set[str] = set()
    last_end_ms = -10 ** 9

    # 1. Introduction Background Placement (Chunk 0 / Scene 0)
    # The opening 0-3s hook sets context and tone. If introBackground is requested
    # (via brand preferences, prompt, or intro_only/always policy), guarantee an intro canvas.
    if prefs["introBackground"] and chunks and scenes:
        chunk_0 = chunks[0]
        scene_0 = scenes[0]
        subject_layering_0 = chunk_0.get("subjectLayering") or {}
        if not bool(subject_layering_0.get("behindSubject")):
            start_ms = 0
            scene_0_end = int(scene_0.get("endMs", 3000))
            end_ms = min(duration_ms, min(scene_0_end, 3500))
            total_duration = max(1, end_ms - start_ms)
            effective_entry = min(entry_ms, total_duration // 3)
            effective_exit = min(exit_ms, total_duration // 3)

            intro_texture = _pick_texture_for_trigger(
                catalog,
                "intro_hook",
                preferred_family=prefs.get("preferredFamily"),
                used_asset_ids=used_asset_ids,
                seed=seed,
                chunk_index=0,
                scene_id=scene_0.get("id"),
            )
            intro_gate = (
                "brand_intro_background" if prefs.get("introFromBrand")
                else "prompt_intro_background" if prefs.get("introFromPrompt")
                else "intro_hook_canvas"
            )
            intro_code = "bg_intro_canvas_01"
            intro_kind = prefs.get("preferredKind") or (
                "gradient_atmosphere" if prefs.get("brandColors") else "texture_canvas"
            )

            intro_bg: Dict[str, Any] = {
                "id": "background-1",
                "sceneId": scene_0["id"],
                "chunkIndex": 0,
                "kind": intro_kind,
                "blurPx": int(design.get("backgroundBlurPx", 0)),
                "brightness": round(float(design.get("backgroundBrightness", 1.0)), 3),
                "counterScale": [1.04, 1.12],
                "transition": {
                    "kind": "zoom_punch",
                    "durationMs": int(design.get("backgroundTransitionMs", 350)),
                },
                "entry": {
                    "startMs": start_ms,
                    "endMs": start_ms + effective_entry,
                },
                "exit": {
                    "startMs": max(start_ms + effective_entry, end_ms - effective_exit),
                    "endMs": end_ms,
                },
                "code": intro_code,
                "cause": {
                    "gate": intro_gate,
                    "sceneId": scene_0["id"],
                    "chunkIds": [chunk_0.get("chunkId", "chunk-1")],
                    "chunkIndex": 0,
                    "trigger": "intro_hook",
                    "candidate": "intro_canvas",
                    "reason": "Introduction context backdrop planned from brand preferences / prompt directives.",
                },
            }

            if intro_kind == "gradient_atmosphere":
                intro_bg["atmosphere"] = {
                    "glowRgb": (prefs.get("brandColors") or {}).get("glowRgb", "0, 240, 255"),
                    "primary": (prefs.get("brandColors") or {}).get("primary", "#00F0FF"),
                    "accent": (prefs.get("brandColors") or {}).get("accent", "#7928CA"),
                }
            elif intro_kind == "editorial_glass":
                intro_bg["glass"] = {
                    "blurPx": 24,
                    "tint": "rgba(16, 20, 32, 0.70)",
                    "borderColor": "rgba(255, 255, 255, 0.14)",
                }
            elif intro_kind == "defocus_depth":
                intro_bg["defocus"] = {
                    "blurPx": 32,
                    "brightnessDip": 0.72,
                    "vignetteStrength": 0.65,
                }

            if intro_texture:
                cover = intro_texture.get("portraitCover") or {}
                intro_bg["texture"] = {
                    "assetId": intro_texture.get("assetId"),
                    "fileName": intro_texture.get("fileName"),
                    "family": intro_texture.get("family"),
                    "width": intro_texture.get("width"),
                    "height": intro_texture.get("height"),
                    "aspectRatio": intro_texture.get("aspectRatio"),
                    "portraitCover": cover,
                    "blendMode": prefs.get("blendMode") or intro_texture.get("blendMode"),
                    "intensity": prefs.get("intensity") or intro_texture.get("intensity"),
                    "coverScale": round(_clamp(float(cover.get("coverScale", 1.0)), 1.0, 3.0), 2),
                }
                if prefs.get("brandTint"):
                    intro_bg["texture"]["brandTint"] = prefs["brandTint"]

            selected.append(intro_bg)
            last_end_ms = end_ms

    if policy == "intro_only":
        return selected

    # 2. Contextual Candidates: Transition-Coupled & Semantic Reference Triggers
    candidates: List[Dict[str, Any]] = []

    # 2a. Transition-Coupled Candidates ("changing onto a background for expressivity of context")
    if prefs["transitionBackgrounds"] and transitions:
        for tr in transitions:
            to_scene_id = tr.get("toSceneId")
            target_idx = next((i for i, s in enumerate(scenes) if s.get("id") == to_scene_id), None)
            if target_idx is not None and target_idx < len(chunks):
                chunk = chunks[target_idx]
                scene = scenes[target_idx]
                subject_layering = chunk.get("subjectLayering") or {}
                if bool(subject_layering.get("behindSubject")):
                    continue
                if selected and scene["id"] == selected[0]["sceneId"]:
                    continue  # Don't duplicate intro
                texture = _pick_texture_for_trigger(
                    catalog,
                    "transition_shift",
                    preferred_family=prefs.get("preferredFamily"),
                    used_asset_ids=used_asset_ids,
                    seed=seed,
                    chunk_index=target_idx,
                    scene_id=scene.get("id"),
                )
                trans_kind = prefs.get("preferredKind") or "texture_canvas"
                candidates.append({
                    "index": target_idx,
                    "chunk": chunk,
                    "scene": scene,
                    "score": 105,
                    "trigger": "transition_shift",
                    "candidate": "expressive_context_canvas",
                    "kind": trans_kind,
                    "code": "bg_transition_context",
                    "texture": texture,
                    "causedByTransitionId": tr.get("id"),
                    "gate": "transition_context_switch",
                    "reason": (
                        f"Scene {scene['id']} transition marks a contextual shift; changed onto a "
                        f"{texture.get('family', 'paper')} background for expressivity."
                    ),
                })

    # 2b. Semantic Reference Candidates (list_stack, screencast, crisis, data_point, heirloom)
    if policy != "transitions_only":
        start_eval_idx = 1 if (selected and selected[0].get("chunkIndex") == 0) else 0
        for index in range(start_eval_idx, min(len(chunks), len(scenes))):
            chunk = chunks[index]
            scene = scenes[index]
            subject_layering = chunk.get("subjectLayering") or {}
            if bool(subject_layering.get("behindSubject")):
                continue
            profile_name = chunk.get("profileName")
            top_label = chunk.get("topLabel")
            score, trigger, candidate, code = detect_background_reference(
                str(chunk.get("text", "")),
                profile_name=profile_name,
                top_label=top_label,
            )
            if score <= 0:
                continue

            # Cool-fingered restraint: If unprompted and undirected, ignore low-salience references
            if not is_directed and policy == "auto" and score < 95:
                continue

            rule = next((r for r in REFERENCE_PATTERNS if r["trigger"] == trigger), None)
            candidate_kind = prefs.get("preferredKind") or (rule.get("default_kind") if rule else "texture_canvas")

            score = int(score + scene.get("salience", 0.0) * 6.0)
            texture = _pick_texture_for_trigger(
                catalog,
                trigger,
                preferred_family=prefs.get("preferredFamily"),
                used_asset_ids=used_asset_ids,
                seed=seed,
                chunk_index=index,
                scene_id=scene.get("id"),
            )
            idx = index + 1
            candidates.append({
                "index": index,
                "chunk": chunk,
                "scene": scene,
                "score": score,
                "trigger": trigger,
                "candidate": candidate,
                "kind": candidate_kind,
                "code": code,
                "texture": texture,
                "gate": "semantic_background_reference",
                "reason": (
                    f"Chunk {idx} carried a '{trigger}' semantic reference; placed a "
                    f"{texture.get('family', 'paper')} canvas behind its kinetic text."
                ),
            })

    # Cool-fingered restraint: If unprompted auto mode and no candidate has high score, emit 0
    if not is_directed and policy == "auto" and not candidates:
        return []

    # Sort candidates by score descending, then earlier index
    candidates.sort(key=lambda item: (-item["score"], item["index"]))

    # Greedy allocation honoring budget and quiet spacing window
    for item in candidates:
        if len(selected) >= max_backgrounds:
            break
        scene = item["scene"]
        start_ms = int(scene["startMs"])
        end_ms = min(int(scene["endMs"]), duration_ms)
        if selected and start_ms - last_end_ms < min_gap_ms:
            continue
        if start_ms + entry_ms >= end_ms:
            continue
        # Avoid duplicate scene placements
        if any(s.get("sceneId") == scene["id"] for s in selected):
            continue

        chunk = item["chunk"]
        texture = item["texture"]
        trigger = item["trigger"]
        kind = item.get("kind", "texture_canvas")
        transition_duration = int(design.get("backgroundTransitionMs", 300))
        idx = item["index"] + 1
        scene_id = scene["id"]
        order = len(selected) + 1
        code = f"{item['code']}_{order:02d}"

        total_duration = max(1, end_ms - start_ms)
        effective_entry_ms = min(entry_ms, total_duration // 3)
        effective_exit_ms = min(exit_ms, total_duration // 3)

        bg_cause: Dict[str, Any] = {
            "gate": item.get("gate", "semantic_background_reference"),
            "sceneId": scene_id,
            "chunkIds": [chunk.get("chunkId", f"chunk-{idx}")],
            "chunkIndex": idx - 1,
            "trigger": trigger,
            "candidate": item["candidate"],
            "reason": item.get("reason", f"Placed {texture.get('family', 'paper')} backdrop."),
        }
        if item.get("causedByTransitionId"):
            bg_cause["causedByTransitionId"] = item["causedByTransitionId"]

        background: Dict[str, Any] = {
            "id": f"background-{order}",
            "sceneId": scene_id,
            "chunkIndex": idx - 1,
            "kind": kind,
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
            "cause": bg_cause,
        }
        chunk["isSceneBoundary"] = bool(item.get("causedByTransitionId"))
        chunk["hasTransition"] = bool(item.get("causedByTransitionId"))
        chunk["backgroundKind"] = kind

        if kind == "editorial_glass":
            background["glass"] = {
                "blurPx": 24,
                "tint": "rgba(16, 20, 32, 0.70)",
                "borderColor": "rgba(255, 255, 255, 0.14)",
            }
        elif kind == "gradient_atmosphere":
            background["atmosphere"] = {
                "glowRgb": (prefs.get("brandColors") or {}).get("glowRgb", "0, 240, 255"),
                "primary": (prefs.get("brandColors") or {}).get("primary", "#00F0FF"),
                "accent": (prefs.get("brandColors") or {}).get("accent", "#7928CA"),
            }
        elif kind == "defocus_depth":
            background["defocus"] = {
                "blurPx": 32,
                "brightnessDip": 0.72,
                "vignetteStrength": 0.65,
            }
        elif kind == "viewfinder_scaffold":
            background["viewfinder"] = {
                "scaffoldColor": "#FFFFFF",
                "contrast": "high_clean_white",
                "cornerMarks": "L_brackets",
                "negativeSpaceRatio": 0.18,
                "metadataTags": {
                    "sysId": f"PRM-REC-{idx:02d}",
                    "timestamp": f"{start_ms//1000:02d}:{start_ms%1000//10:02d}",
                    "viewportState": "active_frame",
                    "barcode": True,
                },
            }
        elif kind == "frame_break_cutout_2_5d":
            background["frameBreak"] = {
                "cutoutAsset": "thinking__choice__choose-removebg-preview.png",
                "overflowPop": 1.25,
                "zStratification": ["background_canvas", "container_card", "inner_media", "extruded_cutout", "typography"],
                "contactShadow": {
                    "blurPx": 28,
                    "opacity": 0.58,
                    "color": "rgba(0, 0, 0, 0.75)",
                    "spread": 4,
                },
            }
        elif kind == "continuous_vector_rail":
            background["vectorRail"] = {
                "ribbonColor": "#00F0FF",
                "accentColor": "#FFE066",
                "strokeWidth": 6,
                "cameraCoupling": True,
                "bezierPoints": [[0, 200], [180, 450], [280, 750], [420, 1100]],
                "trimPathDrawOn": True,
            }
        elif kind == "cgi_hybrid_path_typography":
            background["cgiAnchor"] = {
                "model": "polyhedral_sphere_wireframe",
                "rotationRps": 0.45,
                "pathBoundTypography": True,
                "fontJuxtaposition": {
                    "punchSans": "Plus Jakarta Sans",
                    "connectiveItalic": "Playfair Display",
                },
            }
        elif kind == "vertical_kinetic_carousel":
            background["carousel"] = {
                "physics": {"stiffness": 170, "damping": 26, "mass": 1.0},
                "dataDrivenMetadataSync": True,
                "stepScroll": True,
            }
        elif kind == "kinetic_reticle_annotation":
            background["reticle"] = {
                "dynamicBoundingBox": True,
                "dashoffsetAnimation": True,
                "proceduralAccents": ["crosshairs", "underline_sweep", "corner_focus"],
            }
        elif kind == "vintage_halftone_lithograph":
            background["halftone"] = {
                "rasterMode": "monochrome_lithograph",
                "dotPitch": 3.8,
                "scanlineFrequency": 120,
                "contrastBoost": 1.45,
                "mattedCutout": "idea_vintage_halftone_matted.png",
            }
        elif kind == "hierarchical_spatial_staging":
            background["hierarchicalStaging"] = {
                "twoTierHierarchy": True,
                "coreHero": {
                    "quadrant": "center_primary",
                    "rectPercent": [20.0, 22.0, 80.0, 78.0],
                    "targetCoordinates": {"x": 540, "y": 960},
                    "scaleDownSettle": [1.08, 1.00],
                    "microTilt": {
                        "rotateXMinDeg": 2.0,
                        "rotateXMaxDeg": 5.0,
                        "rotateYMinDeg": 2.0,
                        "rotateYMaxDeg": 5.0,
                        "specularSheen": True,
                    },
                    "physicalThicknessPx": 8,
                    "shadowDepthPx": 24,
                },
                "peripheralMicroAssets": [
                    {
                        "assetId": "tool_fountain_pen",
                        "quadrant": "top_left",
                        "rectPercent": [4.0, 4.0, 32.0, 32.0],
                        "anchor": "periphery_northwest",
                        "depth": 0.85,
                        "rotationDeg": -35.0,
                    },
                    {
                        "assetId": "aged_paper_document",
                        "quadrant": "top_right",
                        "rectPercent": [66.0, 4.0, 96.0, 34.0],
                        "anchor": "periphery_northeast",
                        "depth": 0.75,
                        "rotationDeg": 18.0,
                    },
                    {
                        "assetId": "stationery_paperclip",
                        "quadrant": "bottom_left",
                        "rectPercent": [6.0, 68.0, 34.0, 96.0],
                        "anchor": "periphery_southwest",
                        "depth": 0.90,
                        "rotationDeg": -24.0,
                    },
                    {
                        "assetId": "polaroid_snapshot_frame",
                        "quadrant": "bottom_right",
                        "rectPercent": [64.0, 66.0, 96.0, 96.0],
                        "anchor": "periphery_southeast",
                        "depth": 0.80,
                        "rotationDeg": 12.0,
                    },
                ],
            }
        elif kind == "ambient_shadow_gobo":
            background["shadowGobo"] = {
                "visualLayer": "window_frames_foliage_silhouette",
                "frequencyHz": 0.35,
                "temporalMotion": "procedural_translational_loop",
                "blendMode": "multiply",
                "opacity": 0.25,
                "layers": [
                    {
                        "layerId": "window_frame_mullion",
                        "shape": "geometric_mullion_bars",
                        "opacity": 0.28,
                        "driftSpeed": 0.32,
                        "angleDeg": 32.0,
                        "blurPx": 28,
                    },
                    {
                        "layerId": "swaying_foliage_soft",
                        "shape": "organic_leaf_canopy",
                        "opacity": 0.20,
                        "driftSpeed": 0.42,
                        "angleDeg": 48.0,
                        "blurPx": 38,
                    },
                ],
            }
        elif kind == "single_frame_retinal_inversion":
            background["retinalInversion"] = {
                "durationFrames": 2,
                "durationMs": 66,
                "blendMode": "difference",
                "editorialFunction": "subliminal_visual_punch",
                "triggerCondition": "audio_transient_phase_shift",
                "shaderInversion": True,
                "preserveCoordinates": True,
            }
        elif kind == "attention_gated_bokeh":
            background["attentionBokeh"] = {
                "focusRouting": "incoming_hero_sharp_peripherals_defocused",
                "minBlurRadiusPx": 0,
                "maxBlurRadiusPx": 32,
                "transitionCurve": "smooth_s_curve",
                "rackFocusDurationMs": 380,
                "preserveCompositionalDensity": True,
                "deprioritizedFadeCurve": "inverse_hero_entry",
            }
        elif kind == "continuous_spatial_canvas":
            background["spatialCanvas"] = {
                "unifiedPlane": True,
                "axis": "Y",
                "inertialHandoff": "damped_spring_easing",
                "scenePosition": idx - 1,
                "layoutProgress": 1.0,
                "verticalStepPx": 1920,
                "cameraHandoffSpring": {
                    "stiffness": 140,
                    "damping": 18,
                    "mass": 1.0,
                },
                "revealFromBelow": True,
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
                "blendMode": prefs.get("blendMode") or texture.get("blendMode"),
                "intensity": prefs.get("intensity") or texture.get("intensity"),
                "coverScale": round(_clamp(float(cover.get("coverScale", 1.0)), 1.0, 3.0), 2),
            }
            if prefs.get("brandTint"):
                background["texture"]["brandTint"] = prefs["brandTint"]

        selected.append(background)
        last_end_ms = end_ms

    # Re-index IDs sequentially so they are clean and contiguous
    for i, bg in enumerate(selected):
        bg["id"] = f"background-{i + 1}"

    return selected


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
        if texture is None and background.get("kind") in ("texture_canvas", "brand_canvas"):
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
    prompt: Optional[str] = None,
    brand_preferences: Optional[Dict[str, Any]] = None,
    transitions: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Seed-derived plan: keep decisions reproducible per render nonce."""
    resolved_seed = seed or secrets.token_hex(8)
    return plan_backgrounds(
        chunks=chunks,
        scenes=scenes,
        design=design,
        texture_dir=texture_dir,
        duration_ms=duration_ms,
        prompt=prompt,
        brand_preferences=brand_preferences,
        transitions=transitions,
        seed=resolved_seed,
    )

