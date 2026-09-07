"""Color grading / looks module for the mini-run pipeline.

Provides the 10 canonical cinematic looks, LUT discovery, and FFmpeg filter
generation so the pipeline can apply a user-selected or prompt-inferred color
grade before the final render.

Position in the pipeline (causal chain)
----------------------------------------
Upload -> classify -> transcribe -> silence -> timeline -> **chunk** -> **looks** -> render -> publish
                                                           ^
                                                    We are here.
                                              After chunking, before render.

The module resolves a look plan from the user prompt / design preferences,
builds a deterministic FFmpeg filter graph, and applies it to the muted
composed video before the audio bake / mux step.

LUT status
----------
No .cube or .hald LUT files were found in the repository. Every look is
implemented *parametrically* via FFmpeg\'s built-in colour filters
(colorbalance, curves, eq, hue, colortemperature, lut3d, etc.).

If LUTs are added later to the mini_run_pipeline/luts/ directory, the
module will discover them automatically and use them preferentially.
"""

from __future__ import annotations
import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

LUT_DIR = Path(__file__).resolve().parent / "luts"

CINEMATIC_LOOKS: List[Dict[str, Any]] = [
    {
        "id": "teal_and_orange_blockbuster",
        "name": "Teal and Orange Blockbuster",
        "description": "High contrast look with cool shadows and warm skin highlights. The standard Hollywood blockbuster grade.",
        "mood": "cinematic, dramatic, polished, commercial",
        "keywords": ["blockbuster", "hollywood", "teal", "orange", "teal and orange", "teal&orange", "contrast", "summer", "action", "epic"],
        "policies": {
            "intensityRange": [0.0, 1.5],
            "recommendedIntensity": 1.0,
            "bestFor": ["talking head", "interview", "narrative", "commercial"],
            "avoidFor": ["flat", "documentary", "natural"],
            "notes": "Strongest on faces - use sparingly on wide shots.",
        },
        "params": {
            "colorbalance": {
                "shadows": [-0.15, 0.0, 0.10],
                "midtones": [0.0, 0.0, 0.0],
                "highlights": [0.0, 0.0, -0.08],
            },
            "curves": {
                "red": "0/0 0.3/0.25 0.7/0.72 1/1",
                "green": "0/0 0.3/0.28 0.7/0.70 1/1",
                "blue": "0/0 0.3/0.32 0.7/0.68 1/1",
            },
            "eq": {"contrast": 1.15, "saturation": 1.10, "brightness": 0.0, "gamma": 1.0},
            "colortemperature": 5600,
        },
    },
    {
        "id": "moody_dramatic_cinema",
        "name": "Moody/Dramatic Cinema",
        "description": "Deep shadows and desaturated midtones for thrillers and dark narratives.",
        "mood": "dark, moody, suspenseful, noir, thriller",
        "keywords": ["moody", "dark", "noir", "thriller", "drama", "dramatic", "shadow", "suspense", "cinematic dark", "gritty"],
        "policies": {
            "intensityRange": [0.0, 1.5],
            "recommendedIntensity": 1.0,
            "bestFor": ["testimonial", "storytelling", "narrative"],
            "avoidFor": ["bright", "commercial", "product"],
            "notes": "Crush shadows for atmosphere; keep skin tones natural.",
        },
        "params": {
            "colorbalance": {
                "shadows": [0.0, 0.0, 0.05],
                "midtones": [-0.05, 0.0, 0.05],
                "highlights": [0.0, 0.0, 0.0],
            },
            "curves": {
                "red": "0/0.05 0.5/0.48 1/1",
                "green": "0/0.03 0.5/0.45 1/1",
                "blue": "0/0.0 0.5/0.42 1/0.95",
            },
            "eq": {"contrast": 1.25, "saturation": 0.75, "brightness": -0.05, "gamma": 0.90},
            "colortemperature": 6500,
        },
    },
    {
        "id": "vintage_film_emulation",
        "name": "Vintage Film Emulation",
        "description": "Warm, grainy aesthetic mimicking classic 35mm stock.",
        "mood": "vintage, retro, nostalgic, warm, filmic",
        "keywords": ["vintage", "retro", "film", "35mm", "warm", "nostalgic", "old film", "cinematic vintage", "film emulation"],
        "policies": {
            "intensityRange": [0.0, 1.5],
            "recommendedIntensity": 1.0,
            "bestFor": ["storytelling", "vlog", "personal brand"],
            "avoidFor": ["corporate", "clean", "product demo"],
            "notes": "Adds grain via FFmpeg noise filter. Warm cast on midtones.",
        },
        "params": {
            "colorbalance": {
                "shadows": [0.05, 0.0, -0.05],
                "midtones": [0.08, 0.0, -0.10],
                "highlights": [0.03, 0.0, -0.05],
            },
            "curves": {
                "red": "0/0.02 0.5/0.52 1/0.95",
                "green": "0/0.0 0.5/0.48 1/0.93",
                "blue": "0/0.0 0.5/0.42 1/0.88",
            },
            "eq": {"contrast": 0.95, "saturation": 0.85, "brightness": 0.03, "gamma": 1.05},
            "colortemperature": 4500,
            "noise": {"type": "grain", "amount": 8, "strength": 0.3},
            "vignette": {"amount": 0.25},
        },
    },
    {
        "id": "neon_tokyo_cyberpunk",
        "name": "Neon Tokyo / Cyberpunk",
        "description": "Vibrant magentas, purples, and cyan tones for futuristic or night sequences.",
        "mood": "cyberpunk, neon, futuristic, vibrant, electric",
        "keywords": ["cyberpunk", "neon", "tokyo", "synthwave", "vaporwave", "futuristic", "night", "electric", "miami", "80s"],
        "policies": {
            "intensityRange": [0.0, 1.5],
            "recommendedIntensity": 1.0,
            "bestFor": ["tech", "gaming", "creative", "night footage"],
            "avoidFor": ["interview", "talking head", "corporate"],
            "notes": "Aggressive hue rotation. Best on B-roll / cityscapes.",
        },
        "params": {
            "colorchannelmixer": {
                "rr": 1.0, "rg": 0.0, "rb": 0.0,
                "gr": 0.0, "gg": 0.8, "gb": 0.2,
                "br": 0.0, "bg": 0.1, "bb": 1.0,
            },
            "huesaturation": {"hue_shift": 0.05, "sat_gain": 1.4, "sat_shift": 0.15},
            "curves": {
                "red": "0/0 0.5/0.5 1/1",
                "green": "0/0 0.5/0.45 1/0.9",
                "blue": "0/0.05 0.5/0.55 1/1",
            },
            "eq": {"contrast": 1.10, "saturation": 1.30, "brightness": 0.0, "gamma": 0.95},
            "colortemperature": 5500,
        },
    },
    {
        "id": "bleach_bypass",
        "name": "Bleach Bypass",
        "description": "High contrast, low saturation, and gritty texture for harsh action scenes.",
        "mood": "harsh, gritty, intense, raw, aggressive",
        "keywords": ["bleach bypass", "bleach", "bypass", "gritty", "harsh", "intense", "action", "war", "raw", "desaturated contrast"],
        "policies": {
            "intensityRange": [0.0, 1.5],
            "recommendedIntensity": 1.0,
            "bestFor": ["action", "testimonial", "intense narrative"],
            "avoidFor": ["beauty", "product", "soft", "warm"],
            "notes": "Crush shadows and lift highlights. Skin tones go pale.",
        },
        "params": {
            "colorbalance": {
                "shadows": [0.0, 0.0, 0.0],
                "midtones": [-0.10, 0.0, 0.05],
                "highlights": [0.05, 0.0, -0.05],
            },
            "curves": {
                "red": "0/0 0.5/0.55 1/0.95",
                "green": "0/0 0.5/0.52 1/0.92",
                "blue": "0/0 0.5/0.48 1/0.90",
            },
            "eq": {"contrast": 1.35, "saturation": 0.40, "brightness": -0.02, "gamma": 0.85},
            "colortemperature": 6000,
        },
    },
    {
        "id": "urban_desaturated",
        "name": "Urban Desaturated",
        "description": "Muted colors with a harsh, industrial feel for street footage.",
        "mood": "urban, street, industrial, muted, raw",
        "keywords": ["urban", "street", "industrial", "muted", "desaturated", "city", "concrete", "raw", "documentary style"],
        "policies": {
            "intensityRange": [0.0, 1.5],
            "recommendedIntensity": 1.0,
            "bestFor": ["street", "documentary", "B-roll", "cityscape"],
            "avoidFor": ["beauty", "product", "colorful brand"],
            "notes": "Pull saturation down hard. Keep luminance contrast high.",
        },
        "params": {
            "colorbalance": {
                "shadows": [0.02, 0.0, 0.02],
                "midtones": [-0.05, 0.0, 0.05],
                "highlights": [-0.05, 0.0, 0.05],
            },
            "curves": {
                "red": "0/0.02 0.5/0.48 1/0.95",
                "green": "0/0.02 0.5/0.48 1/0.95",
                "blue": "0/0.02 0.5/0.48 1/0.95",
            },
            "eq": {"contrast": 1.20, "saturation": 0.35, "brightness": 0.0, "gamma": 1.0},
            "colortemperature": 6200,
        },
    },
    {
        "id": "clean_log_to_rec709",
        "name": "Clean Log-to-Rec709 Base",
        "description": "Neutral technical conversion LUT for flat profile normalisation.",
        "mood": "neutral, clean, technical, flat",
        "keywords": ["log", "rec709", "neutral", "flat", "clean", "technical", "base grade", "normalise", "log to rec709", "standard"],
        "policies": {
            "intensityRange": [0.0, 1.0],
            "recommendedIntensity": 1.0,
            "bestFor": ["any", "base", "starting point"],
            "avoidFor": [],
            "notes": "Minimal grade. Expands log-flat contrast to Rec.709 standard.",
        },
        "params": {
            "curves": {
                "red": "0/0 0.5/0.45 1/1",
                "green": "0/0 0.5/0.45 1/1",
                "blue": "0/0 0.5/0.45 1/1",
            },
            "eq": {"contrast": 1.05, "saturation": 1.0, "brightness": 0.0, "gamma": 1.0},
            "colortemperature": 6500,
        },
    },
    {
        "id": "golden_hour_warmth",
        "name": "Golden Hour Warmth",
        "description": "Soft, sun-kissed highlights and rich amber tones.",
        "mood": "warm, golden, soft, dreamy, romantic",
        "keywords": ["golden hour", "warm", "sunset", "sunrise", "amber", "soft", "dreamy", "romantic", "glow", "summer"],
        "policies": {
            "intensityRange": [0.0, 1.5],
            "recommendedIntensity": 1.0,
            "bestFor": ["talking head", "interview", "vlog", "outdoor"],
            "avoidFor": ["night", "corporate", "technical"],
            "notes": "Warm highlights, keep shadows neutral. Flattering on skin tones.",
        },
        "params": {
            "colorbalance": {
                "shadows": [0.03, 0.0, -0.05],
                "midtones": [0.08, 0.0, -0.12],
                "highlights": [0.05, 0.0, -0.08],
            },
            "curves": {
                "red": "0/0 0.5/0.55 1/0.98",
                "green": "0/0 0.5/0.48 1/0.95",
                "blue": "0/0.02 0.5/0.40 1/0.90",
            },
            "eq": {"contrast": 0.95, "saturation": 1.10, "brightness": 0.02, "gamma": 1.02},
            "colortemperature": 4200,
            "vignette": {"amount": 0.15},
        },
    },
    {
        "id": "faded_black_and_white",
        "name": "Faded Black & White",
        "description": "High-latitude monochrome grade with crushed blacks.",
        "mood": "monochrome, classic, timeless, editorial, stark",
        "keywords": ["black and white", "b&w", "monochrome", "grayscale", "faded", "classic", "timeless", "editorial", "stark"],
        "policies": {
            "intensityRange": [0.0, 1.5],
            "recommendedIntensity": 1.0,
            "bestFor": ["editorial", "artistic", "testimonial", "portrait"],
            "avoidFor": ["product", "brand colour", "colorful"],
            "notes": "Desaturate fully, then lift the black point for a faded look.",
        },
        "params": {
            "colorchannelmixer": {
                "rr": 0.33, "rg": 0.34, "rb": 0.33,
                "gr": 0.33, "gg": 0.34, "gb": 0.33,
                "br": 0.33, "bg": 0.34, "bb": 0.33,
            },
            "curves": {
                "red": "0/0.05 0.5/0.45 1/0.95",
                "green": "0/0.05 0.5/0.45 1/0.95",
                "blue": "0/0.05 0.5/0.45 1/0.95",
            },
            "eq": {"contrast": 0.85, "saturation": 0.0, "brightness": 0.02, "gamma": 1.10},
            "colortemperature": 6500,
            "noise": {"type": "grain", "amount": 6, "strength": 0.2},
        },
    },
    {
        "id": "sci_netone_balanced",
        "name": "Sci-Netone Balanced",
        "description": "Precision skin-tone retention paired with subtle film contrast.",
        "mood": "balanced, precise, skin-tone, filmic, natural",
        "keywords": ["netone", "skin tone", "balanced", "natural", "filmic", "precision", "subtle", "portrait", "interview"],
        "policies": {
            "intensityRange": [0.0, 1.5],
            "recommendedIntensity": 1.0,
            "bestFor": ["talking head", "interview", "portrait", "vlog"],
            "avoidFor": ["stylized", "heavy grade"],
            "notes": "Gentle S-curve contrast. Protects skin tone integrity.",
        },
        "params": {
            "colorbalance": {
                "shadows": [0.0, 0.0, 0.02],
                "midtones": [0.0, 0.0, 0.0],
                "highlights": [0.0, 0.0, -0.03],
            },
            "curves": {
                "red": "0/0 0.5/0.48 1/1",
                "green": "0/0 0.5/0.45 1/0.98",
                "blue": "0/0 0.5/0.42 1/0.95",
            },
            "eq": {"contrast": 1.08, "saturation": 1.0, "brightness": 0.0, "gamma": 1.0},
            "colortemperature": 5800,
        },
    },
    {
        "id": "kodak_2383_print",
        "name": "Kodak 2383 Print Stock",
        "description": "Authentic Kodak Vision Color Print Film 2383 emulation: deep rich blacks, warm amber highlight roll-off, subtractive saturation where reds stay dense and deep cyans live in the shadows.",
        "mood": "filmic, analog, rich, warm, vintage cinema, timeless",
        "keywords": ["kodak", "2383", "vision", "print", "film print", "print stock", "celluloid", "subtractive", "amber", "rich blacks", "analog", "35mm"],
        "policies": {
            "intensityRange": [0.0, 1.5],
            "recommendedIntensity": 1.0,
            "bestFor": ["narrative", "talking head", "cinematic", "documentary"],
            "avoidFor": ["hyper-saturated corporate", "neon"],
            "notes": "Classic Hollywood release print stock. Subtractive saturation pulls dense ruby reds.",
        },
        "params": {
            "colorbalance": {
                "shadows": [-0.035, 0.015, 0.040],
                "midtones": [0.0, 0.0, 0.0],
                "highlights": [0.045, 0.018, -0.060],
            },
            "curves": {
                "red": "0/0 0.35/0.31 0.70/0.74 1/1",
                "green": "0/0 0.35/0.33 0.70/0.72 1/1",
                "blue": "0/0 0.35/0.36 0.70/0.67 1/1",
            },
            "eq": {"contrast": 1.24, "saturation": 1.05, "brightness": 0.0, "gamma": 0.98},
            "colortemperature": 5500,
        },
    },
    {
        "id": "fuji_3513_print",
        "name": "Fujifilm 3513 Print Stock",
        "description": "Fujifilm 3513 print stock emulation: cooler greens/teals, soft magenta highlights, cinematic contrast.",
        "mood": "filmic, cool, emerald, magenta, elegant, atmospheric",
        "keywords": ["fuji", "fujifilm", "3513", "eterna", "emerald", "teal green", "magenta highlights", "cool shadows"],
        "policies": {
            "intensityRange": [0.0, 1.5],
            "recommendedIntensity": 1.0,
            "bestFor": ["narrative", "outdoor", "moody", "drama", "fashion"],
            "avoidFor": ["warm sunset", "golden hour"],
            "notes": "Signature Fujifilm DI print stock. Emerald foliage and soft magenta highlight roll-off.",
        },
        "params": {
            "colorbalance": {
                "shadows": [-0.025, 0.0, 0.028],
                "midtones": [-0.02, 0.03, 0.01],
                "highlights": [0.030, -0.035, 0.022],
            },
            "curves": {
                "red": "0/0 0.35/0.32 0.70/0.72 1/1",
                "green": "0/0 0.35/0.35 0.70/0.70 1/1",
                "blue": "0/0 0.35/0.37 0.70/0.71 1/1",
            },
            "eq": {"contrast": 1.18, "saturation": 1.02, "brightness": 0.0, "gamma": 1.0},
            "colortemperature": 6200,
        },
    },
]

_LOOKS_BY_ID = {look["id"]: look for look in CINEMATIC_LOOKS}

def get_look(look_id: str) -> Optional[Dict[str, Any]]:
    """Return a look dict by its *id*, or None."""
    return _LOOKS_BY_ID.get(look_id)

def list_looks() -> List[Dict[str, Any]]:
    """Return all registered looks (with full metadata)."""
    return list(CINEMATIC_LOOKS)

def list_look_names() -> List[str]:
    """Return a list of human-readable look names."""
    return [look["name"] for look in CINEMATIC_LOOKS]

def match_look_by_keywords(text: str) -> Optional[Dict[str, Any]]:
    """Score every look against *text* and return the best-matching look.
    Lowercased, space-tokenised matching against each look's ``keywords`` list.
    """
    if not text:
        return None
    tokens = re.findall(r"[a-z0-9_]+", text.lower())
    if not tokens:
        return None
    best_look: Optional[Dict[str, Any]] = None
    best_score = 0
    for look in CINEMATIC_LOOKS:
        kw_set = {kw.lower().strip() for kw in look["keywords"]}
        score = sum(1 for token in tokens if token in kw_set)
        if score > best_score:
            best_score = score
            best_look = look
    return best_look if best_score > 0 else None

def select_look(
    design: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    prompt: Optional[str] = None,
) -> Dict[str, Any]:
    """Resolve which look to apply from the user's design / metadata / prompt.
    Resolution priority:
        1. ``design.lookId`` / ``design.look`` (explicit)
        2. ``metadata.lookId`` / ``metadata.look`` (explicit)
        3. ``metadata.mood`` keyword matching
        4. ``prompt`` text keyword matching
        5. ``design.mood`` keyword matching
        6. Fallback to sci_netone_balanced
    """
    design = design or {}
    metadata = metadata or {}
    explicit_id = (design.get("lookId") or design.get("look")
                   or metadata.get("lookId") or metadata.get("look"))
    if isinstance(explicit_id, str):
        look = get_look(explicit_id)
        if look is None:
            for candidate in CINEMATIC_LOOKS:
                if explicit_id.lower() in candidate["name"].lower():
                    look = candidate
                    break
        if look is not None:
            intensity = float(design.get("lookIntensity", 1.0))
            return _build_manifest(look, intensity, "explicit")
    metadata_mood = metadata.get("mood", "")
    if isinstance(metadata_mood, str) and metadata_mood:
        look = match_look_by_keywords(metadata_mood)
        if look is not None:
            intensity = float(design.get("lookIntensity", 1.0))
            return _build_manifest(look, intensity, "metadata_mood")
    prompt_text = prompt or design.get("prompt") or metadata.get("prompt") or ""
    if prompt_text:
        look = match_look_by_keywords(prompt_text)
        if look is not None:
            intensity = float(design.get("lookIntensity", 1.0))
            return _build_manifest(look, intensity, "prompt_keywords")
    mood = design.get("mood", "")
    if isinstance(mood, str) and mood:
        look = match_look_by_keywords(mood)
        if look is not None:
            intensity = float(design.get("lookIntensity", 1.0))
            return _build_manifest(look, intensity, "mood_keywords")
    fallback = get_look("sci_netone_balanced") or CINEMATIC_LOOKS[0]
    intensity = float(design.get("lookIntensity", 1.0))
    return _build_manifest(fallback, intensity, "fallback_default")

def _build_manifest(look: Dict[str, Any], intensity: float, resolution: str) -> Dict[str, Any]:
    return {
        "lookId": look["id"],
        "lookName": look["name"],
        "description": look["description"],
        "intensity": max(0.0, min(1.5, intensity)),
        "params": look.get("params", {}),
        "policies": look.get("policies", {}),
        "resolution": resolution,
    }

def discover_luts(lut_dir: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Scan *lut_dir* for colour LUT files (.cube, .3dl, .hald, .png)."""
    directory = lut_dir or LUT_DIR
    if not directory.is_dir():
        return []
    luts: List[Dict[str, Any]] = []
    extensions = {".cube", ".3dl", ".hald", ".png"}
    for fpath in sorted(directory.iterdir()):
        if fpath.suffix.lower() in extensions and fpath.is_file():
            luts.append({"path": str(fpath), "name": fpath.stem,
                         "format": fpath.suffix.lower().lstrip("."),
                         "sizeBytes": fpath.stat().st_size})
    return luts

def luts_available(lut_dir: Optional[Path] = None) -> bool:
    return len(discover_luts(lut_dir)) > 0

# ---------------------------------------------------------------------------
# FFmpeg filter generation
# ---------------------------------------------------------------------------

def build_look_filter_string(
    look_manifest: Dict[str, Any],
    *,
    width: Optional[int] = None,
    height: Optional[int] = None,
) -> str:
    """Build an FFmpeg ``-vf`` filter string that applies the look.

    LUTs are checked first; if a matching .cube is found in the LUT directory
    it is used preferentially via ``lut3d``. Otherwise the parametric fallback
    is built from ``colortemperature``, ``colorchannelmixer``,
    ``huesaturation``, ``colorbalance``, ``curves``, ``eq``, ``noise``, and
    ``vignette``.
    """
    params = look_manifest.get("params", {})
    optical = look_manifest.get("opticalFinishing") or params.get("opticalFinishing") or {}
    intensity = look_manifest.get("intensity", 1.0)
    if intensity <= 0:
        return ""
    filters: List[str] = []

    # 1. Optical Finishing: Gate Weave & Film Breathe (sub-pixel gate jitter + subtle exposure breathe)
    if optical.get("gateWeave", False) or optical.get("enableAll", False):
        filters.append(
            "crop=in_w-4:in_h-4:'2+0.25*sin(14.5*t)':'2+0.2*cos(11.9*t)',scale=in_w:in_h,eq=brightness='0.008*sin(8.8*t)':contrast='1.0+0.01*sin(8.8*t)'"
        )

    # 2. Optical Finishing: Subtle Optical Distortion / Lens Geometry
    if optical.get("lensDistortion", False) or optical.get("enableAll", False):
        filters.append("lenscorrection=cx=0.5:cy=0.5:k1=0.008:k2=0.002")

    # 3. Core Color Grade: 3D LUT (Tetrahedral interpolation) or Parametric Color Science
    lut_path = _resolve_lut_for_look(look_manifest)
    if lut_path:
        lut_str = _format_lut_path(lut_path)
        filters.append(f"lut3d=file='{lut_str}':interp=tetrahedral")
    else:
        ct = params.get("colortemperature")
        if ct is not None:
            _add_colortemperature(filters, int(ct), intensity)
        ccm = params.get("colorchannelmixer")
        if ccm:
            _add_colorchannelmixer(filters, ccm, intensity)
        hs = params.get("huesaturation")
        if hs:
            _add_huesaturation(filters, hs, intensity)
        cb = params.get("colorbalance")
        if cb:
            _add_colorbalance(filters, cb, intensity)
        curves = params.get("curves")
        if curves:
            _add_curves(filters, curves, intensity)
        eq = params.get("eq")
        if eq:
            _add_eq(filters, eq, intensity)

    # 4. Optical Finishing: Non-Linear Highlight Roll-Off (Soft Shoulder Compression)
    if optical.get("shoulderRollOff", False) or optical.get("enableAll", False):
        if not any("curves=all" in f for f in filters):
            filters.append("curves=all='0/0 0.5/0.5 0.75/0.75 0.88/0.85 0.96/0.92 1.0/0.965'")

    # 5. Optical Finishing: Split-Toned Ambient Density (Subtractive Color Saturation)
    if optical.get("subtractiveSaturation", False) or optical.get("enableAll", False):
        if not any("colorbalance" in f for f in filters):
            filters.append("colorbalance=rs=-0.08:gs=0.02:bs=0.06:rh=0.04:gh=0.01:bh=-0.04,eq=saturation=1.10")

    # 6. Analog Emulsion Film Grain (Luminance-weighted temporal grain)
    grain_enabled = optical.get("filmGrain", False) or optical.get("enableAll", False)
    noise = params.get("noise")
    if grain_enabled and not noise:
        filters.append("noise=alls=10:allf=t")
    elif noise:
        _add_noise(filters, noise, intensity)

    # 7. Lens Vignette
    vignette = params.get("vignette") or ({"amount": 0.20} if optical.get("vignette") else None)
    if vignette:
        _add_vignette(filters, vignette, intensity, width, height)

    extra_hs = params.get("huesaturation_final")
    if extra_hs:
        _add_huesaturation(filters, extra_hs, intensity, suffix="_final")
    return ",".join(filters)

def _format_lut_path(lut_path: Path) -> str:
    """Format LUT path for FFmpeg, preferring relative path when inside cwd."""
    try:
        cwd = Path.cwd().resolve()
        rel = os.path.relpath(lut_path.resolve(), cwd).replace("\\", "/")
        if not rel.startswith(".."):
            return rel
    except Exception:
        pass
    return _ffmpeg_escape(str(lut_path.resolve()))

def _ffmpeg_escape(value: str) -> str:
    """Escape a value for use in an FFmpeg filter chain."""
    result = value.replace("\\", "/").replace(":", "\\:").replace(",", "\\,").replace("'", "'\\''")
    return result

def _resolve_lut_for_look(look_manifest: Dict[str, Any]) -> Optional[Path]:
    """Check if a .cube LUT exists that matches the look ID."""
    look_id = look_manifest.get("lookId", "")
    if not look_id:
        return None
    candidate = LUT_DIR / f"{look_id}.cube"
    if candidate.is_file():
        return candidate
    for lut in discover_luts():
        if look_id in lut["name"]:
            return Path(lut["path"])
    return None

def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t

def _apply_intensity(val: float, intensity: float) -> float:
    return val * intensity

def _fmt_float(val: float) -> str:
    return f"{val:.4f}".rstrip("0").rstrip(".")

def _add_colortemperature(filters: List[str], kelvin: int, intensity: float) -> None:
    """Add colortemperature filter (6500K = neutral).

    FFmpeg's ``colortemperature`` filter expects a ``temperature`` option
    expressed in Kelvin [1000, 40000].  At ``intensity=0`` the filter is a no-op
    (6500K).  At ``intensity=1`` the full target Kelvin is applied.  Linear
    interpolation between 6500 and the target.
    """
    if kelvin <= 0:
        return
    neutral = 6500.0
    temp = neutral + (float(kelvin) - neutral) * intensity
    clamped = int(max(1000, min(40000, temp)))
    if clamped == 6500:
        return
    filters.append(f"colortemperature={clamped}")

def _add_colorchannelmixer(filters: List[str], ccm: Dict[str, float], intensity: float) -> None:
    parts: List[str] = []
    for key in ("rr", "rg", "rb", "gr", "gg", "gb", "br", "bg", "bb"):
        if key in ccm:
            identity = {"rr": 1.0, "gg": 1.0, "bb": 1.0}.get(key, 0.0)
            adjusted = _lerp(identity, float(ccm[key]), intensity)
            parts.append(f"{key}={_fmt_float(adjusted)}")
    if parts:
        filters.append(f"colorchannelmixer={':'.join(parts)}")

def _add_huesaturation(filters: List[str], hs: Dict[str, Any], intensity: float, suffix: str = "") -> None:
    parts: List[str] = []
    # FFmpeg huesaturation options: hue (-180..180), saturation (-1..1),
    # intensity (-1..1), colors, strength.  Map the authoring keys onto these.
    if "hue_shift" in hs:
        parts.append(f"hue={_fmt_float(_apply_intensity(float(hs['hue_shift']), intensity))}")
    saturation = 0.0
    if "sat_gain" in hs:
        saturation += float(hs["sat_gain"]) - 1.0
    if "sat_shift" in hs:
        saturation += float(hs["sat_shift"])
    if saturation != 0.0:
        sat_scaled = _apply_intensity(saturation, intensity)
        parts.append(f"saturation={_fmt_float(max(-1.0, min(1.0, sat_scaled)))}")
    # legacy h/s/v authoring keys (hue, saturation, value->intensity)
    for key, option in (("h", "hue"), ("s", "saturation"), ("v", "intensity")):
        if key in hs:
            parts.append(f"{option}={_fmt_float(_apply_intensity(float(hs[key]), intensity))}")
    if parts:
        filters.append(f"huesaturation={':'.join(parts)}")

def _add_colorbalance(filters: List[str], cb: Dict[str, List[float]], intensity: float) -> None:
    # FFmpeg colorbalance options are per-region + per-channel:
    #   shadows: rs gs bs | midtones: rm gm bm | highlights: rh gh bh
    region_map = {
        "shadows": ("rs", "gs", "bs"),
        "midtones": ("rm", "gm", "bm"),
        "highlights": ("rh", "gh", "bh"),
    }
    for region, option_names in region_map.items():
        values = cb.get(region)
        if not values or len(values) < 3:
            continue
        adjusted = [_apply_intensity(v, intensity) for v in values[:3]]
        adjusted = [max(-1.0, min(1.0, v)) for v in adjusted]
        parts = [f"{opt}={_fmt_float(val)}" for opt, val in zip(option_names, adjusted)]
        filters.append(f"colorbalance={':'.join(parts)}")

def _add_curves(filters: List[str], curves: Dict[str, str], intensity: float) -> None:
    for color in ("red", "green", "blue", "all"):
        curve_str = curves.get(color)
        if not curve_str:
            continue
        if intensity < 1.0:
            curve_str = _blend_curve_toward_identity(curve_str, intensity)
        filters.append(f"curves={color}='{curve_str}'")

def _blend_curve_toward_identity(curve_str: str, intensity: float) -> str:
    if intensity >= 1.0:
        return curve_str
    points = curve_str.split()
    result: List[str] = []
    for point_str in points:
        match = re.match(r"^([\\d.]+)/([\\d.]+)$", point_str.strip())
        if match:
            x = float(match.group(1))
            y = float(match.group(2))
            identity_y = x
            blended = _lerp(identity_y, y, intensity)
            result.append(f"{_fmt_float(x)}/{_fmt_float(blended)}")
        else:
            result.append(point_str)
    return " ".join(result)

def _add_eq(filters: List[str], eq_params: Dict[str, float], intensity: float) -> None:
    components: List[str] = []
    for key, neutral in [("brightness", 0.0), ("contrast", 1.0), ("gamma", 1.0), ("saturation", 1.0)]:
        if key in eq_params:
            val = _lerp(neutral, float(eq_params[key]), intensity)
            components.append(f"{key}={_fmt_float(val)}")
    if components:
        filters.append(f"eq={':'.join(components)}")

def _add_noise(filters: List[str], noise_params: Dict[str, Any], intensity: float) -> None:
    noise_type = noise_params.get("type", "grain")
    amount = int(noise_params.get("amount", 10))
    scaled_amount = int(amount * intensity)
    if scaled_amount <= 0:
        return
    # Temporal noise (t) creates a subtle film-grain effect.  The
    # "u" (uniform) flag was removed in FFmpeg 5+; only "t" (temporal)
    # and "a" (averaged) are available.
    flags = "t"
    filters.append(f"noise=alls={scaled_amount}:allf={flags}")

def _add_vignette(filters: List[str], vignette_params: Dict[str, Any], intensity: float,
                  width: Optional[int] = None, height: Optional[int] = None) -> None:
    """Add the FFmpeg vignette filter.

    FFmpeg 7.0.2's ``vignette`` filter controls the effect via the ``angle``
    option (lens half-angle in radians, default ``PI/5`` ≈ 0.628).  Smaller
    angle ⇒ stronger vignette.  The ``dmax``/``dmin`` options were removed in
    FFmpeg 5+.
    """
    amount = float(vignette_params.get("amount", 0.3))
    scaled_amount = amount * intensity
    if scaled_amount <= 0:
        return
    # angle = PI / (2 + 3 * scaled_amount)
    #   scaled_amount=0  → PI/2  ≈ 1.571 (neutral, no vignette)
    #   scaled_amount=0.5 → PI/3.5 ≈ 0.898 (mild)
    #   scaled_amount=1.0 → PI/5  ≈ 0.628 (default, moderate vignette)
    angle_expr = f"PI/(2+3*{_fmt_float(scaled_amount)})"
    if width and height:
        filters.append(f"vignette=eval=frame:angle={angle_expr}:aspect={width}/{height}:dither=1")
    else:
        filters.append(f"vignette=eval=frame:angle={angle_expr}:dither=1")

def build_grade_filter(
    look_manifest: Dict[str, Any],
    *,
    video_width: Optional[int] = None,
    video_height: Optional[int] = None,
) -> str:
    """Build the full ``-vf`` argument string for the look grade.
    Returns an empty string if no grade is needed."""
    if not look_manifest or look_manifest.get("intensity", 0) <= 0:
        return ""
    return build_look_filter_string(look_manifest, width=video_width, height=video_height)

def write_look_manifest(look_manifest: Dict[str, Any], output_dir: str, job_id: str) -> str:
    """Write the look manifest to a JSON file in *output_dir*. Returns the path.

    The ``jobId`` is embedded into the persisted copy (without mutating the
    caller's dict) so the manifest is self-describing and traceable.
    """
    manifest_dir = Path(output_dir) / "media" / "mini-run" / "renders" / job_id
    manifest_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = manifest_dir / "look_manifest.json"
    payload = {**look_manifest, "jobId": job_id}
    manifest_path.write_text(json.dumps(payload, indent=2))
    return str(manifest_path)

def grade_video_shot(
    input_shot_path: Path | str,
    output_shot_path: Path | str,
    look_plan: Dict[str, Any],
    *,
    width: Optional[int] = None,
    height: Optional[int] = None,
    ffmpeg_bin: str = "ffmpeg",
) -> Path:
    """Causally grades a video shot segment with the resolved look and optical finishing stack.

    Position in Pipeline (Strict Causality):
    Source Ingest -> Shot Extraction -> **Shot Color Grade (here)** -> Subject Matting (Martin) -> Typography / In-Treatment Composition -> Final Mix

    Why Shot-First Grading is Architecturally Mandatory:
    1. Efficiency: Only active shot frames are processed, never the full 40-60min landscape source.
    2. Edge & Lighting Fidelity: The MediaPipe/Martin foreground segmentation cutout matches the color-graded
       scene lighting, contrast, and black pedestal.
    3. Typography Protection: Kinetic text, quotes, and HUD overlays composited in Remotion sit cleanly
       over (or behind) the graded speaker without having their brand colors or whites contaminated by
       a post-composition grading filter.
    """
    input_shot = Path(input_shot_path).resolve()
    output_shot = Path(output_shot_path).resolve()
    output_shot.parent.mkdir(parents=True, exist_ok=True)

    if not input_shot.exists():
        raise FileNotFoundError(f"Input shot not found for color grading: {input_shot}")

    grade_filter = build_grade_filter(look_plan, video_width=width, video_height=height)
    if not grade_filter:
        import shutil
        if str(input_shot) != str(output_shot):
            shutil.copyfile(input_shot, output_shot)
        return output_shot

    cmd = [
        ffmpeg_bin, "-y", "-loglevel", "error",
        "-i", str(input_shot),
        "-vf", grade_filter,
        "-c:v", "libx264", "-preset", "fast", "-crf", "17",
        "-pix_fmt", "yuv420p",
        "-c:a", "copy",
        "-movflags", "+faststart",
        str(output_shot),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Shot color grading failed (code {res.returncode}): {res.stderr[-1000:]}")
    return output_shot

__all__ = [
    "CINEMATIC_LOOKS",
    "get_look",
    "list_looks",
    "list_look_names",
    "match_look_by_keywords",
    "select_look",
    "discover_luts",
    "luts_available",
    "build_look_filter_string",
    "build_grade_filter",
    "grade_video_shot",
    "write_look_manifest",
    "LUT_DIR",
]
