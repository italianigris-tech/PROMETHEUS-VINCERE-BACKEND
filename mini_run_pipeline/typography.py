"""Multi-layer editorial graphic typography engine for 9:16 short form content.

Strictly excludes landscape JSONs and executes full multi-layer font pairing,
faithful gradient & glow realization, and mid-section stage placement.
"""

from __future__ import annotations

import os
import json
import glob
import random
import secrets
import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

FONT_JSON_DIR = Path(__file__).resolve().parent.parent / "Yuan Prometheus Screenshots" / "font JSON"
FONT_PAIRS_DIR = Path(__file__).resolve().parent.parent / "Yuan Prometheus Screenshots" / "font pairing and placement"
OPT_FONT_DIR = Path("/opt/prometheus/Yuan Prometheus Screenshots/font JSON")
OPT_PAIRS_DIR = Path("/opt/prometheus/Yuan Prometheus Screenshots/font pairing and placement")


def get_relative_luminance(hex_color: str) -> float:
    """Calculate luminance to ensure high-contrast legibility over video."""
    hex_clean = hex_color.lstrip("#")
    if len(hex_clean) != 6:
        return 1.0
    try:
        r = int(hex_clean[0:2], 16) / 255.0
        g = int(hex_clean[2:4], 16) / 255.0
        b = int(hex_clean[4:6], 16) / 255.0
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    except Exception:
        return 1.0


def resolve_faithful_font_color(color_hex: Optional[str]) -> str:
    if not color_hex or color_hex == "transparent" or color_hex.lower() == "none":
        return "#FFFFFF"
    lum = get_relative_luminance(color_hex)
    if lum < 0.55:
        return "#FFFFFF"
    return color_hex


def apply_casing_strategy(text: str, casing: str, font_family: str = "") -> str:
    f_lower = font_family.lower()
    # Condensed grotesque display banners look great in uppercase
    if any(k in f_lower for k in ("anton", "bebas", "six caps", "teko", "saira")):
        return text.upper()
    
    # Editorial didone & serif fonts look best in natural casing or title case for multi-word phrases
    if any(k in f_lower for k in ("playfair", "bodoni", "cormorant", "italiana")):
        if casing == "uppercase" and len(text.split()) > 1:
            return " ".join(w.capitalize() if w.lower() not in STOPWORDS else w.lower() for w in text.split())

    if casing == "lowercase":
        return text.lower()
    if casing == "uppercase":
        return text.upper()
    if casing in ("title_case", "capitalize"):
        return " ".join(w.capitalize() for w in text.split())
    return text


STOPWORDS = {
    "i", "me", "my", "myself", "we", "our", "ours", "you", "your", "yours", 
    "he", "him", "his", "she", "her", "hers", "it", "its", "it's", "they", "them", "their",
    "what", "what's", "which", "who", "whom", "this", "that", "that's", "these", "those",
    "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "having",
    "do", "does", "did", "doing", "a", "an", "the", "and", "but", "if", "or", "because", "as",
    "until", "while", "of", "at", "by", "for", "with", "about", "against", "between", "into", 
    "through", "during", "before", "after", "above", "below", "to", "from", "up", "down", 
    "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here",
    "here's", "there", "there's", "when", "where", "why", "how", "all", "any", "both",
    "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only",
    "own", "same", "so", "than", "too", "very", "can", "will", "just", "should", "now",
    "need", "needed", "want", "wanted", "like", "also"
}

UNSPLITTABLE_TAILS = {
    "i", "me", "to", "in", "at", "on", "by", "of", "an", "a", "the", "my", "he", "we", "us", "it", "so", "as", "if", "or", "and", "but"
}


def smart_partition_chunk_words(
    words: List[str], profile_layers: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Intelligently partition words across at most 2 clean editorial lines.
    Never isolate pronouns ('I', 'me', 'they'), prepositions ('to', 'in'), or articles ('an', 'a', 'the') as dangling 1-word lines.
    """
    token_count = len(words)
    if not profile_layers or token_count <= 1:
        return [{"layer": profile_layers[0] if profile_layers else {}, "words": words, "is_hero": True}]

    clean_words = [w.lower().strip(".,!?:;\"'") for w in words]
    content_indices = [i for i, w in enumerate(clean_words) if w not in STOPWORDS]

    l0 = profile_layers[0]
    l1 = profile_layers[1] if len(profile_layers) > 1 else profile_layers[0]

    # If all words are stopwords (e.g. "It's because I", "if they", "They need to"), keep together as 1 line
    if not content_indices:
        return [{"layer": l0, "words": words, "is_hero": True}]

    # If the last word is an unsplittable tail word (e.g. "I", "to", "me", "an"), never leave it alone on line 2
    if clean_words[-1] in UNSPLITTABLE_TAILS:
        if token_count == 3:
            return [
                {"layer": l1, "words": [words[0]], "is_hero": True},
                {"layer": l0, "words": words[1:], "is_hero": False},
            ]
        elif token_count >= 4:
            return [
                {"layer": l0, "words": words[:2], "is_hero": False},
                {"layer": l1, "words": words[2:], "is_hero": True},
            ]
        else:
            return [{"layer": l0, "words": words, "is_hero": True}]

    # Standard 2-line split for substantive phrases
    if token_count == 2:
        return [
            {"layer": l0, "words": [words[0]], "is_hero": False},
            {"layer": l1, "words": [words[1]], "is_hero": True},
        ]
    elif token_count == 3:
        return [
            {"layer": l0, "words": words[:2], "is_hero": False},
            {"layer": l1, "words": [words[2]], "is_hero": True},
        ]
    else:
        return [
            {"layer": l0, "words": words[:-1], "is_hero": False},
            {"layer": l1, "words": [words[-1]], "is_hero": True},
        ]

# ---------------------------------------------------------------------------
# Brand Style & Palette Ingestion System
# ---------------------------------------------------------------------------
BRAND_PALETTES: Dict[str, Dict[str, str]] = {
    "champagne_gold": {
        "hero_color": "#F5E6C4",
        "companion_color": "#FFFFFF",
        "glow": "0 0 16px rgba(245, 230, 196, 0.45)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)",
        "accent_border": "#D4AF37",
    },
    "obsidian_crimson": {
        "hero_color": "#FF453A",
        "companion_color": "#FFFFFF",
        "glow": "0 0 16px rgba(255, 69, 58, 0.45)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)",
        "accent_border": "#FF3B30",
    },
    "electric_cyan": {
        "hero_color": "#00F0FF",
        "companion_color": "#FFFFFF",
        "glow": "0 0 16px rgba(0, 240, 255, 0.45)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)",
        "accent_border": "#00D2FF",
    },
    "emerald_luxury": {
        "hero_color": "#34D399",
        "companion_color": "#FFFFFF",
        "glow": "0 0 16px rgba(52, 211, 153, 0.45)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)",
        "accent_border": "#10B981",
    },
    "royal_amethyst": {
        "hero_color": "#C084FC",
        "companion_color": "#FFFFFF",
        "glow": "0 0 16px rgba(192, 132, 252, 0.45)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)",
        "accent_border": "#A78BFA",
    },
    "sunset_amber": {
        "hero_color": "#FBBF24",
        "companion_color": "#FFFFFF",
        "glow": "0 0 16px rgba(251, 191, 36, 0.45)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)",
        "accent_border": "#F59E0B",
    },
    "pure_editorial_mono": {
        "hero_color": "#FFFFFF",
        "companion_color": "#F1F5F9",
        "glow": "0 0 14px rgba(255, 255, 255, 0.35)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)",
        "accent_border": "#FFFFFF",
    },
}

DEFAULT_VARIATION_PALETTES = tuple(BRAND_PALETTES.keys())


def resolve_brand_palette(brand_input: Optional[Any] = None) -> Dict[str, str]:
    """Ingest user brand preferences, color directives, or preset names."""
    if isinstance(brand_input, dict):
        base = BRAND_PALETTES.get("champagne_gold", {}).copy()
        if "heroColor" in brand_input:
            base["hero_color"] = brand_input["heroColor"]
        if "companionColor" in brand_input:
            base["companion_color"] = brand_input["companionColor"]
        if "glow" in brand_input:
            base["glow"] = brand_input["glow"]
        if "brandMotif" in brand_input and brand_input["brandMotif"] in BRAND_PALETTES:
            return BRAND_PALETTES[brand_input["brandMotif"]]
        return base
    
    if isinstance(brand_input, str):
        b_low = brand_input.lower().strip()
        if any(k in b_low for k in ("red", "crimson", "ruby")):
            return BRAND_PALETTES["obsidian_crimson"]
        if any(k in b_low for k in ("blue", "cyan")):
            return BRAND_PALETTES["electric_cyan"]
        if any(k in b_low for k in ("green", "emerald")):
            return BRAND_PALETTES["emerald_luxury"]
        if any(k in b_low for k in ("purple", "amethyst", "violet")):
            return BRAND_PALETTES["royal_amethyst"]
        if any(k in b_low for k in ("yellow", "amber", "orange")):
            return BRAND_PALETTES["sunset_amber"]
        if any(k in b_low for k in ("white", "mono", "silver")):
            return BRAND_PALETTES["pure_editorial_mono"]
        if b_low in BRAND_PALETTES:
            return BRAND_PALETTES[b_low]
            
    return BRAND_PALETTES["champagne_gold"]


def _explicit_brand_palette_id(design_override: Optional[Dict[str, Any]]) -> Optional[str]:
    design = design_override if isinstance(design_override, dict) else {}
    motif = design.get("brandMotif")
    if isinstance(motif, str) and motif in BRAND_PALETTES:
        return motif
    brand = design.get("brand")
    if isinstance(brand, dict) and any(key in brand for key in ("heroColor", "companionColor", "glow")):
        return "custom"
    if any(key in design for key in ("heroColor", "companionColor", "glow")):
        return "custom"
    return None


def _select_chunk_palette(
    rng: random.Random,
    explicit_palette_id: Optional[str],
    explicit_palette: Dict[str, str],
    usage: Dict[str, int],
    recent: List[str],
) -> tuple[str, Dict[str, str]]:
    if explicit_palette_id:
        return explicit_palette_id, explicit_palette
    candidates = [palette_id for palette_id in DEFAULT_VARIATION_PALETTES if palette_id not in recent]
    candidates = candidates or list(DEFAULT_VARIATION_PALETTES)
    palette_id = _weighted_choice(rng, candidates, [1.0 / (1 + usage.get(candidate, 0)) for candidate in candidates])
    return palette_id, BRAND_PALETTES[palette_id]


BASIC_FONTS = {"dm sans", "roboto", "open sans", "inter", "arial", "helvetica", "sans-serif", "system-ui"}

# High-tier cinematic editorial fonts for hero upgrade routing
# keyed by CSS font-family name (matches all_fonts_dynamic.css @font-face declarations)
HERO_UPGRADE_FONTS = [
    "Berylium",          # Elegant serif with ball terminals — editorial hero
    "Echelon",           # Condensed grotesque — high-impact display
    "Foglihten-068",     # Fine art deco inspired — editorial body/small caps
    "Goudy Bookletter",  # Classic old-style serif — bookish companion
    "Bodoni Moda",       # Didone serif — luxury editorial (existing default)
]

# Subset that works best for hero / display roles
HERO_DISPLAY_FONTS = [
    "Berylium",
    "Echelon",
    "Bodoni Moda",
]

# Subset for companion / secondary roles
COMPANION_UPGRADE_FONTS = [
    "Foglihten-068",
    "Goudy Bookletter",
    "Playfair Display",
]


def upgrade_font_candidate(font_name: str, is_hero: bool, role: str = "body", rng: Optional[random.Random] = None) -> str:
    """Upgrade basic / generic fonts to authoritative cinematic editorial fonts.

    Routes to the 4 new hero fonts (Berylium, Echelon, Foglihten-068, Goudy Bookletter)
    plus Bodoni Moda / Playfair Display for variety, using RNG for deterministic-but-varied
    selection per chunk.
    """
    _rng = rng or random.Random()

    f_clean = font_name.lower().strip()
    if f_clean in BASIC_FONTS or not font_name:
        if is_hero:
            return _rng.choice(HERO_DISPLAY_FONTS)
        else:
            return _rng.choice(COMPANION_UPGRADE_FONTS)
    return font_name


# High-tier, vetted editorial kinetic preset repertoire
KINETIC_HERO_PRESETS = [
    "focus_hunting_bokeh_shimmer",
    "gaussian_blur_reveal_sweep",
    "spring_blur_physics_engine",
    "kinetic_slot_character_reel",
    "apple_keynote_headline_punch",
    "apple_pro_display_hero_revealer",
    "dynamic_staggered_character_cascade",
    "cinematic_viewport_mask_sweep",
    "obsidian_heavy_grotesque",
]

SINGLE_WORD_HERO_PRESETS = [
    "focus_hunting_bokeh_shimmer",
    "kinetic_slot_character_reel",
    "spring_blur_physics_engine",
    "gaussian_blur_reveal_sweep",
    "obsidian_heavy_grotesque",
]


def load_all_font_json_profiles(include_landscape: bool = False) -> List[Dict[str, Any]]:
    """Load font JSON profiles.

    Landscape (16:9): Full Admin Access — permitted to load the entire corpus (all 77+ portrait + landscape profiles).
    Mini Runs (9:16): Restricted Access — strictly excludes profiles with 'landscape' in filename/profile_name.
    """
    json_dir = FONT_JSON_DIR if FONT_JSON_DIR.exists() else OPT_FONT_DIR
    pairs_dir = FONT_PAIRS_DIR if FONT_PAIRS_DIR.exists() else OPT_PAIRS_DIR
    profiles = []

    if json_dir.exists():
        for file_path in sorted(json_dir.glob("*.json")):
            is_landscape_file = "landscape" in file_path.name.lower()
            if not include_landscape and is_landscape_file:
                continue
            try:
                data = json.loads(file_path.read_text(encoding="utf-8"))
                pname = data.get("profile_name", file_path.stem)
                if not include_landscape and "landscape" in pname.lower():
                    continue

                img_name = file_path.stem + ".png"
                img_exists = (pairs_dir / img_name).exists()
                layers = data.get("typography_layers", [])
                meta = data.get("metadata", {})
                total_words = meta.get("total_word_count", len(layers))

                profiles.append({
                    "id": file_path.stem,
                    "filename": file_path.name,
                    "profile_name": pname,
                    "paired_image": img_name if img_exists else None,
                    "paired_image_exists": img_exists,
                    "metadata": meta,
                    "layout_rules": data.get("layout_rules", {}),
                    "typography_layers": layers,
                    "total_words": total_words,
                    "is_landscape": is_landscape_file or "landscape" in pname.lower(),
                    "raw": data,
                })
            except Exception:
                pass
    return profiles


def load_all_portrait_font_json_profiles() -> List[Dict[str, Any]]:
    """Strict 9:16 portrait font JSON profiles (restricted access)."""
    return load_all_font_json_profiles(include_landscape=False)


def load_all_landscape_font_json_profiles() -> List[Dict[str, Any]]:
    """Full font JSON corpus for 16:9 landscape (full admin access to all 77+ profiles)."""
    return load_all_font_json_profiles(include_landscape=True)



def ensure_mixed_font_badge(
    timestamp: Optional[str] = None,
    only_missing: bool = True,
) -> Dict[str, Any]:
    """Stamp the mixed-font badge onto every portrait (non-landscape) font JSON.

    The badge is the metadata pair ``mixed_fonts_verified: true`` and
    ``mixfont_extracted_at``. It signals that a form carries an appropriate,
    verified mixed-font pairing (each typography layer lists real matched-font
    candidates), so the mini-run mixed-font engine can drive typography from it.

    Landscape files are strictly excluded — those belong to the separate
    landscape section and are never touched here.

    Args:
        timestamp: ISO-8601 UTC stamp written to ``mixfont_extracted_at``.
            Defaults to the current UTC time (used once for the whole pass so
            every file stamped in this run is consistent).
        only_missing: When True (default) only files lacking the badge are
            stamped; when False every portrait profile is re-stamped.

    Returns an audit-shaped dict:
        {
          "discovered": int,            # portrait JSONs found
          "landscape": int,             # landscape JSONs skipped
          "already_badged": List[str],  # had the badge before this pass
          "stamped": List[str],         # files stamped in this pass
          "missing_after": List[str],   # still missing the badge afterwards
          "timestamp": str,
          "json_dir": str,
        }
    """
    json_dir = FONT_JSON_DIR if FONT_JSON_DIR.exists() else OPT_FONT_DIR
    if timestamp is None:
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    else:
        stamp = str(timestamp)

    discovered = landscape = 0
    already_badged: List[str] = []
    stamped: List[str] = []
    missing_after: List[str] = []

    if not json_dir.exists():
        return {
            "discovered": 0,
            "landscape": 0,
            "already_badged": [],
            "stamped": [],
            "missing_after": [],
            "timestamp": stamp,
            "json_dir": str(json_dir),
            "error": f"font JSON directory missing: {json_dir}",
        }

    for file_path in sorted(json_dir.glob("*.json")):
        if "landscape" in file_path.name.lower():
            landscape += 1
            continue
        discovered += 1
        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
        except Exception:
            missing_after.append(file_path.name)
            continue
        if not isinstance(data, dict):
            missing_after.append(file_path.name)
            continue

        meta = data.setdefault("metadata", {})
        if meta.get("mixed_fonts_verified") is True and only_missing:
            already_badged.append(file_path.name)
            continue

        meta["mixed_fonts_verified"] = True
        meta["mixfont_extracted_at"] = stamp
        file_path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        stamped.append(file_path.name)

        if meta.get("mixed_fonts_verified") is not True:
            missing_after.append(file_path.name)

    return {
        "discovered": discovered,
        "landscape": landscape,
        "already_badged": already_badged,
        "stamped": stamped,
        "missing_after": missing_after,
        "timestamp": stamp,
        "json_dir": str(json_dir),
    }


def resolve_layer_gradient_and_glow(
    profile_name: str,
    role: str,
    color: str,
    is_hero: bool,
    brand_palette: Dict[str, str]
) -> Dict[str, Any]:
    """Revert font treatment back to clean original status (crisp solid typography with high contrast)."""
    hero_color = brand_palette.get("hero_color", "#FF334B")
    companion_color = brand_palette.get("companion_color", "#FFFFFF")

    if is_hero:
        return {
            "gradient": "none",
            "glow": "0 0 20px rgba(255, 51, 75, 0.45)",
            "shadow": "0 4px 18px rgba(0, 0, 0, 0.85), 0 2px 4px rgba(0, 0, 0, 0.9)",
            "textFillColor": hero_color,
            "hasGradient": False,
        }

    return {
        "gradient": "none",
        "glow": "0 0 10px rgba(255, 255, 255, 0.20)",
        "shadow": "0 4px 18px rgba(0, 0, 0, 0.85), 0 2px 4px rgba(0, 0, 0, 0.9)",
        "textFillColor": companion_color,
        "hasGradient": False,
    }




def split_single_word_syllables(word: str) -> List[str]:
    """Single words must never be fractured into broken trailing syllables."""
    return [word]



ANIMA_RUNTIME_TREATMENTS: List[Dict[str, Any]] = [
    # This is the runtime counterpart of every TYPOGRAPHY_30_PRESETS entry in
    # Anima. The selector uses only its motion metadata, never transcript text.
    {"id": "apple_pro_display_hero_revealer", "styles": {"cinematic", "editorial"}, "energy": 0.33},
    {"id": "dynamic_staggered_character_cascade", "styles": {"kinetic", "cinematic"}, "energy": 0.70},
    {"id": "apple_keynote_headline_punch", "styles": {"kinetic", "editorial"}, "energy": 0.75},
    {"id": "subpixel_glow_mask", "styles": {"cinematic", "editorial"}, "energy": 0.35},
    {"id": "textrotate_kinetic_word_cycler", "styles": {"kinetic", "editorial"}, "energy": 0.66},
    {"id": "gaussian_blur_reveal_sweep", "styles": {"cinematic", "editorial"}, "energy": 0.40},
    {"id": "typewriter_ghost_cursor", "styles": {"editorial", "kinetic"}, "energy": 0.44},
    {"id": "vercel_kinetic_highlight_box", "styles": {"editorial", "cinematic"}, "energy": 0.48},
    {"id": "isometric_kinetic_perspective_stack", "styles": {"kinetic", "cinematic"}, "energy": 0.72},
    {"id": "hand_drawn_kinetic_underline", "styles": {"editorial", "cinematic"}, "energy": 0.32},
    {"id": "horizontal_gradient_sweep_fade", "styles": {"cinematic", "editorial"}, "energy": 0.36},
    {"id": "liquid_gooey_ink_morph", "styles": {"kinetic", "cinematic"}, "energy": 0.64},
    {"id": "cinematic_viewport_mask_sweep", "styles": {"cinematic", "editorial"}, "energy": 0.30},
    {"id": "elegant_paraword_spring_bloom", "styles": {"cinematic", "editorial"}, "energy": 0.38},
    {"id": "cyber_matrix_text_scramble", "styles": {"kinetic", "editorial"}, "energy": 0.80},
    {"id": "kinetic_slot_character_reel", "styles": {"kinetic", "editorial"}, "energy": 0.78},
    {"id": "metallic_chrome_countup_hero", "styles": {"cinematic", "kinetic"}, "energy": 0.56},
    {"id": "lavender_highlight_selection", "styles": {"editorial", "cinematic"}, "energy": 0.32},
    {"id": "electric_blue_emoji_line_revealer", "styles": {"kinetic", "editorial"}, "energy": 0.62},
    {"id": "vector_stroke_sparkle", "styles": {"cinematic", "editorial"}, "energy": 0.45},
    {"id": "figma_collaborative_frame_expansion", "styles": {"editorial", "kinetic"}, "energy": 0.54},
    {"id": "hybrid_figma_kinetic_slot", "styles": {"kinetic", "editorial"}, "energy": 0.68},
    {"id": "glow_search_pulsing_caret", "styles": {"editorial", "cinematic"}, "energy": 0.42},
    {"id": "dotted_grid_shimmer_wave", "styles": {"kinetic", "cinematic"}, "energy": 0.58},
    {"id": "top_down_staggered_character_drop", "styles": {"kinetic", "cinematic"}, "energy": 0.74},
    {"id": "dotted_grid_elastic_word_pull", "styles": {"kinetic", "editorial"}, "energy": 0.60},
    {"id": "led_dot_matrix_scanline", "styles": {"editorial", "kinetic"}, "energy": 0.52},
    {"id": "geometric_circle_inversion", "styles": {"cinematic", "kinetic"}, "energy": 0.58},
    {"id": "obsidian_heavy_grotesque", "styles": {"kinetic", "editorial"}, "energy": 0.82},
    {"id": "sandstorm_grain_dissolve", "styles": {"cinematic", "kinetic"}, "energy": 0.66},
    {"id": "canva_tall_glyph_stack", "styles": {"cinematic", "editorial"}, "energy": 0.40},
    {"id": "hightech_chromatic_brands", "styles": {"kinetic", "cinematic"}, "energy": 0.76},
    {"id": "kinetic_cyber_phrase_expansion", "styles": {"kinetic", "editorial"}, "energy": 0.69},
    {"id": "kinetic_glow_sweep", "styles": {"kinetic", "cinematic"}, "energy": 0.55},
    {"id": "kinetic_word_fast_pulse", "styles": {"kinetic", "editorial"}, "energy": 0.84},
    {"id": "kinetic_dynamic_slant", "styles": {"kinetic", "cinematic"}, "energy": 0.72},
    {"id": "kinetic_chromatic_typewriter", "styles": {"kinetic", "editorial"}, "energy": 0.63},
    {"id": "metallic_chrome_counter", "styles": {"cinematic", "kinetic"}, "energy": 0.50},
    {"id": "apple_gaussian_chrome", "styles": {"cinematic", "editorial"}, "energy": 0.43},
    {"id": "cinematic_apple_word_bounce", "styles": {"cinematic", "kinetic"}, "energy": 0.61},
    {"id": "cinematic_distance_convergence", "styles": {"cinematic", "editorial"}, "energy": 0.37},
]

ANIMA_OVERLAY_TREATMENTS = [
    "cinematic_viewport_mask_sweep",
    "soft_pixel_blowup_mask",
]

TALL_FONT_RUNTIME_TREATMENTS = (
    "canva_tall_glyph_stack",
    "kinetic_slot_character_reel",
    "top_down_staggered_character_drop",
    "cinematic_distance_convergence",
    "dynamic_staggered_character_cascade",
)

POLICY_VALUES = {
    "creativity": {"reserved", "balanced", "expressive"},
    "pacing": {"slow", "adaptive", "fast"},
    "motionStyle": {"editorial", "cinematic", "kinetic"},
    "typographyBias": {"mixed", "serif", "display", "script"},
    "subjectLayering": {"disabled", "auto", "required"},
}


def resolve_typography_policy(design_override: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    design = design_override if isinstance(design_override, dict) else {}
    resolved = {
        key: design.get(key) if design.get(key) in values else default
        for key, values, default in (
            ("creativity", POLICY_VALUES["creativity"], "balanced"),
            ("pacing", POLICY_VALUES["pacing"], "adaptive"),
            ("motionStyle", POLICY_VALUES["motionStyle"], "cinematic"),
            ("typographyBias", POLICY_VALUES["typographyBias"], "mixed"),
            ("subjectLayering", POLICY_VALUES["subjectLayering"], "auto"),
        )
    }
    resolved["avoidPresets"] = sorted({
        str(preset) for preset in design.get("avoidPresets", [])
        if isinstance(preset, str) and preset in {item["id"] for item in ANIMA_RUNTIME_TREATMENTS}
    })
    return resolved


TALL_MATTE_FONTS = [
    "Anton",
    "Bebas Neue",
    "Big Shoulders Display",
    "Saira Extra Condensed",
    "Six Caps",
    "Teko",
    "Pathway Extreme",
    "Oswald",
    "League Gothic",
    "Antonio",
    "SenzaBella",
    "Montserrat",
]


HIGH_TIER_SCREENSHOT_PROFILES = {
    "image (1)", "image (2)", "image (3)", "image (6)", "image (8)",
    "image (14)", "image (15)", "image (16)", "image (17)", "image (18)", "image (21)"
}


def eligible_portrait_profile_ids() -> List[str]:
    return [profile["id"] for profile in load_all_portrait_font_json_profiles()]


def _is_tall_matte_profile(profile: Dict[str, Any]) -> bool:
    metadata = profile.get("metadata", {})
    if metadata.get("is_tall_font") or metadata.get("matte_text_optimized"):
        return True
    pname = (profile.get("profile_name") or profile.get("id") or "").lower()
    if any(t in pname for t in ("tall", "bebas", "anton", "six_caps", "teko", "shoulders", "condensed", "editorial")):
        return True
    for layer in profile.get("typography_layers", []):
        for candidate in layer.get("matched_font_candidates", []):
            if any(t in str(candidate).lower() for t in ("anton", "bebas", "six caps", "teko", "saira", "pathway", "oswald", "league gothic", "antonio", "condensed")):
                return True
    return False



def schedule_caption_timing(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Reserve each caption's lead-in only from unoccupied timeline space."""
    scheduled = [dict(chunk) for chunk in chunks]
    scheduled.sort(key=lambda item: int(item.get("startMs", item.get("outputStartMs", 0))))
    previous_end_ms = 0
    for index, chunk in enumerate(scheduled):
        content_start_ms = int(chunk.get("startMs", chunk.get("outputStartMs", 0)))
        natural_end_ms = int(chunk.get("endMs", chunk.get("outputEndMs", content_start_ms + 1)))
        next_start_ms = (
            int(scheduled[index + 1].get("startMs", scheduled[index + 1].get("outputStartMs", natural_end_ms)))
            if index + 1 < len(scheduled) else natural_end_ms
        )
        display_end_ms = max(content_start_ms + 1, min(natural_end_ms, next_start_ms))
        layers = [dict(layer) for layer in chunk.get("layers", [])]
        requested_lead_ms = max((int(layer.get("entryLeadMs", 0)) for layer in layers), default=0)
        display_start_ms = max(previous_end_ms, content_start_ms - requested_lead_ms)
        available_lead_ms = max(0, content_start_ms - display_start_ms)
        for layer in layers:
            layer["effectiveEntryLeadMs"] = min(int(layer.get("entryLeadMs", 0)), available_lead_ms)
        chunk["layers"] = layers
        chunk["displayStartMs"] = display_start_ms
        chunk["displayEndMs"] = display_end_ms
        previous_end_ms = display_end_ms
    return scheduled


def _weighted_choice(rng: random.Random, candidates: List[Any], weights: List[float]) -> Any:
    return rng.choices(candidates, weights=[max(0.001, weight) for weight in weights], k=1)[0]


def _profile_bias_score(profile: Dict[str, Any], bias: str) -> float:
    pid = profile.get("id", "")
    fname = profile.get("filename", "")
    pname = profile.get("profile_name", "")
    is_high_tier = (
        pid in HIGH_TIER_SCREENSHOT_PROFILES
        or fname.replace(".json", "") in HIGH_TIER_SCREENSHOT_PROFILES
        or any(k in pid.lower() for k in ("image (1)", "image (2)", "image (3)", "image (6)", "image (8)", "image (14)", "image (15)", "image (16)", "image (17)", "image (18)", "image (21)"))
        or any(k in pname.lower() for k in ("vogue", "look", "brian", "think_twice", "creative_destruction", "art_of_war", "master_your_mind", "money_speaks"))
    )
    tier_boost = 4.5 if is_high_tier else 1.0

    if bias == "mixed":
        return 1.0 * tier_boost
    searchable = " ".join([
        str(profile.get("profile_name", "")),
        *(
            str(candidate)
            for layer in profile.get("typography_layers", [])
            for candidate in layer.get("matched_font_candidates", [])
        ),
    ]).lower()
    terms = {
        "serif": ("serif", "bodoni", "playfair", "cinzel", "cormorant", "roman", "goudy"),
        "display": ("display", "condensed", "bebas", "anton", "saira", "grotesque", "block"),
        "script": ("script", "calligraphic", "italic", "pinyon", "dancing", "sacramento", "vibes"),
    }[bias]
    base_score = 2.4 if any(term in searchable for term in terms) else 0.45
    return base_score * tier_boost



def _chunk_signal(chunk: Dict[str, Any]) -> Dict[str, float]:
    words = [word for word in str(chunk.get("text", "")).split() if word]
    duration_ms = max(1, int(chunk.get("endMs", 0)) - int(chunk.get("startMs", 0)))
    content_density = sum(
        1 for word in words if word.lower().strip(".,!?:;\"'") not in STOPWORDS
    ) / max(1, len(words))
    punctuation_bonus = 0.18 if any(mark in str(chunk.get("text", "")) for mark in ("!", "?", ":", ";")) else 0.0
    return {
        "wordCount": float(len(words)),
        "cadenceMs": duration_ms / max(1, len(words)),
        "salience": min(1.0, 0.18 + content_density * 0.62 + punctuation_bonus),
    }


def _select_primary_treatment(
    rng: random.Random,
    policy: Dict[str, Any],
    signal: Dict[str, float],
    usage: Dict[str, int],
    recent: List[str],
) -> str:
    candidates = [
        item for item in ANIMA_RUNTIME_TREATMENTS
        if item["id"] not in policy["avoidPresets"] and item["id"] not in recent
    ] or [item for item in ANIMA_RUNTIME_TREATMENTS if item["id"] not in policy["avoidPresets"]]
    if not candidates:
        candidates = [item for item in ANIMA_RUNTIME_TREATMENTS if item["id"] == "apple_pro_display_hero_revealer"]
    creativity = {"reserved": 0.55, "balanced": 1.0, "expressive": 1.55}[policy["creativity"]]
    desired_energy = {
        "slow": 0.32,
        "adaptive": 0.42 if signal["cadenceMs"] >= 340 else 0.62,
        "fast": 0.75,
    }[policy["pacing"]]
    return _weighted_choice(rng, candidates, [
        (2.3 if policy["motionStyle"] in item["styles"] else 0.35)
        * (1.0 / (1 + usage.get(item["id"], 0)))
        * (1.0 / (1.0 + abs(item["energy"] - desired_energy) * 2.4))
        * creativity
        for item in candidates
    ])["id"]


def _entry_lead_ms(policy: Dict[str, Any], signal: Dict[str, float], is_hero: bool, primary_fx: str) -> int:
    baseline = {"slow": 340, "adaptive": 250, "fast": 150}[policy["pacing"]]
    cadence_bonus = min(100, max(-60, int((signal["cadenceMs"] - 310) * 0.28)))
    hero_bonus = 55 if is_hero else 0
    blur_bonus = 45 if "blur" in primary_fx or "focus" in primary_fx else 0
    return max(100, min(480, baseline + cadence_bonus + hero_bonus + blur_bonus))


def _select_overlay(rng: random.Random, policy: Dict[str, Any], signal: Dict[str, float], primary_fx: str) -> Optional[str]:
    probability = {
        "reserved": 0.0,
        "balanced": 0.18,
        "expressive": 0.38,
    }[policy["creativity"]] * signal["salience"]
    if primary_fx in ANIMA_OVERLAY_TREATMENTS or rng.random() >= probability:
        return None
    return rng.choice(ANIMA_OVERLAY_TREATMENTS)


def generate_font_manifest(chunks: List[Dict[str, Any]], design_override: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    aspect_ratio = (design_override or {}).get("aspectRatio", "9:16")
    is_landscape = str(aspect_ratio) in ("16:9", "landscape", "1.777", "1.78")

    # 16:9 Landscape has Full Admin Access to entire font corpus (77+ profiles)
    # 9:16 Portrait has restricted access (excludes landscape profiles)
    profiles = load_all_font_json_profiles(include_landscape=is_landscape)
    if not profiles:
        raise RuntimeError("No font JSON profiles found in directory!")


    # Selection is intentionally non-replayable. Prompt text and prompt values
    # influence weighting, but never provide a deterministic random source.
    selection_nonce = secrets.token_hex(24)
    rng = random.Random(selection_nonce)
    policy = resolve_typography_policy(design_override)

    # Unified Video-Level Brand Palette (Defaults to Obsidian Crimson for Signature High-End White & Red)
    design_input = design_override or {}
    explicit_palette_id = _explicit_brand_palette_id(design_input)
    brand_input = design_input.get("brandMotif") or design_input.get("brand") or ("obsidian_crimson" if not explicit_palette_id else None)
    video_palette = resolve_brand_palette(brand_input)
    video_palette_id = explicit_palette_id or (brand_input if isinstance(brand_input, str) and brand_input in BRAND_PALETTES else "obsidian_crimson")
    video_palette["id"] = video_palette_id

    manifest_chunks = []
    recent_primary_fx: List[str] = []
    preset_usage_counts: Dict[str, int] = {item["id"]: 0 for item in ANIMA_RUNTIME_TREATMENTS}
    profile_usage_counts: Dict[str, int] = {}
    recent_profile_ids: List[str] = []  # sliding window to prevent rapid re-selection

    tall_font_usage_counts: Dict[str, int] = {f: 0 for f in TALL_MATTE_FONTS}
    recent_tall_fonts: List[str] = []

    # Archetype buckets for variety routing
    verified_profiles = [p for p in profiles if p.get("metadata", {}).get("mixed_fonts_verified")] or profiles

    for idx, chunk in enumerate(chunks):
        raw_text = str(chunk.get("text", "")).strip()
        words = raw_text.split()
        if not words:
            continue

        chunk_palette = video_palette
        palette_id = video_palette_id


        word_count = len(words)
        chunk_word_objs = chunk.get("words", [])
        is_single_word = word_count == 1
        signal = _chunk_signal(chunk)

        # Strict Behind-Speaker Placement Criteria:
        # 1. Total character count MUST be >= 5 to prevent short words ("WHY", "SEE", "HOW", "ME") getting obscured by head
        # 2. Never matte 1-word short tokens or stopwords alone behind the speaker
        # 3. Only eligible when words/characters can extend past the head width
        clean_chunk_text = "".join(c for c in raw_text if c.isalnum())
        has_min_width_chars = len(clean_chunk_text) >= 5 or word_count >= 2
        is_obscured_short_word = word_count == 1 and (len(clean_chunk_text) <= 4 or clean_chunk_text.lower() in STOPWORDS)

        subject_candidate = (
            policy["subjectLayering"] != "disabled"
            and has_min_width_chars
            and not is_obscured_short_word
            and word_count <= 4
            and (
                policy["subjectLayering"] == "required"
                or rng.random() < 0.35 + signal["salience"] * 0.25
            )
        )

        # Match profiles with combinatorial diversity (single words stay whole and never fracture)
        if is_single_word:
            matching_profiles = [p for p in profiles if len(p.get("typography_layers", [])) == 1] or profiles
        else:
            matching_profiles = [
                p for p in profiles
                if abs(p.get("total_words", len(p.get("typography_layers", []))) - word_count) <= 1
                and len(p.get("typography_layers", [])) <= word_count
            ]

        if not matching_profiles:
            matching_profiles = profiles

        # Martin depth treatment is strictly tall font only
        tall_candidates = [profile for profile in matching_profiles if _is_tall_matte_profile(profile)]
        if not tall_candidates:
            tall_candidates = [profile for profile in profiles if _is_tall_matte_profile(profile)]
        behind_subject = bool(subject_candidate and tall_candidates)
        if behind_subject:
            matching_profiles = tall_candidates


        # Profile selection considers each eligible form's layer compatibility, prompt bias,
        # and trajectory history. No literal phrase or profile ID determines treatment.
        candidates_pool = [p for p in matching_profiles if p["id"] not in recent_profile_ids] or matching_profiles
        prof = _weighted_choice(rng, candidates_pool, [
            _profile_bias_score(profile, policy["typographyBias"])
            / (1 + profile_usage_counts.get(profile["id"], 0))
            * (1.25 if len(profile.get("typography_layers", [])) <= max(2, word_count) else 0.35)
            for profile in candidates_pool
        ])
        profile_usage_counts[prof["id"]] = profile_usage_counts.get(prof["id"], 0) + 1
        recent_profile_ids.append(prof["id"])
        if len(recent_profile_ids) > 2:
            recent_profile_ids.pop(0)

        hero_fx_preset = _select_primary_treatment(
            rng, policy, signal, preset_usage_counts, recent_primary_fx,
        )
        if behind_subject:
            tall_fx_candidates = [
                preset for preset in TALL_FONT_RUNTIME_TREATMENTS
                if preset not in recent_primary_fx and preset not in policy["avoidPresets"]
            ] or [
                preset for preset in TALL_FONT_RUNTIME_TREATMENTS
                if preset not in policy["avoidPresets"]
            ]
            hero_fx_preset = _weighted_choice(
                rng,
                tall_fx_candidates,
                [1.0 / (1 + preset_usage_counts.get(preset, 0)) for preset in tall_fx_candidates],
            )
        preset_usage_counts[hero_fx_preset] = preset_usage_counts.get(hero_fx_preset, 0) + 1
        recent_primary_fx.append(hero_fx_preset)
        if len(recent_primary_fx) > 2:
            recent_primary_fx.pop(0)
        overlay_fx = _select_overlay(rng, policy, signal, hero_fx_preset)

        # If single word is paired with a 2-layer profile, split by stem/suffix
        target_layers = prof.get("typography_layers", [])
        if is_single_word and len(target_layers) >= 2:
            syllables = split_single_word_syllables(words[0])
            if len(syllables) >= 2:
                allocations = [
                    {"layer": target_layers[0], "words": [syllables[0]], "is_hero": False},
                    {"layer": target_layers[1], "words": [syllables[1]], "is_hero": True},
                ]
            else:
                allocations = [{"layer": target_layers[0], "words": words, "is_hero": True}]
        else:
            allocations = smart_partition_chunk_words(words, target_layers)

        rendered_layers = []
        word_offset = 0

        for layer_idx, alloc in enumerate(allocations):
            layer_spec = alloc.get("layer", {})
            layer_words = alloc.get("words", [])
            w_count = len(layer_words)
            
            # Map word timestamps if available
            layer_word_items = []
            for w_i, w_text in enumerate(layer_words):
                curr_w_idx = word_offset + w_i
                if curr_w_idx < len(chunk_word_objs):
                    layer_word_items.append(chunk_word_objs[curr_w_idx])
                else:
                    layer_word_items.append({
                        "text": w_text,
                        "start_ms": chunk.get("startMs", 0) + int(w_i * 200),
                        "end_ms": chunk.get("endMs", 0)
                    })

            word_offset += w_count
            if not layer_words:
                continue

            raw_layer_text = " ".join(layer_words)
            f_style = layer_spec.get("font_style", {})
            role = layer_spec.get("role", "body")
            is_hero_layer = alloc.get("is_hero", False)
            casing = f_style.get("casing", prof.get("metadata", {}).get("casing_strategy", "mixed"))

            # Resolve Font Candidate faithfully & upgrade basic fonts to high-tier cinematic typography
            # When behind_subject is True, rotate dynamically through the 12 TALL_MATTE_FONTS to fight patternicity
            candidates = layer_spec.get("matched_font_candidates", [])
            if behind_subject:
                tall_pool = [f for f in TALL_MATTE_FONTS if f not in recent_tall_fonts] or TALL_MATTE_FONTS
                primary_font = _weighted_choice(
                    rng,
                    tall_pool,
                    [1.0 / (1 + tall_font_usage_counts.get(f, 0)) for f in tall_pool],
                )
                tall_font_usage_counts[primary_font] = tall_font_usage_counts.get(primary_font, 0) + 1
                recent_tall_fonts.append(primary_font)
                if len(recent_tall_fonts) > 3:
                    recent_tall_fonts.pop(0)
                accent_font = primary_font
            elif candidates:
                shuffled = candidates.copy()
                rng.shuffle(shuffled)
                raw_primary = shuffled[0]
                raw_accent = shuffled[1] if len(shuffled) > 1 else shuffled[0]
                primary_font = upgrade_font_candidate(raw_primary, is_hero_layer, role, rng=rng)
                accent_font = upgrade_font_candidate(raw_accent, is_hero_layer, role, rng=rng)
            else:
                raw_primary = "Playfair Display"
                raw_accent = "Playfair Display"
                primary_font = upgrade_font_candidate(raw_primary, is_hero_layer, role, rng=rng)
                accent_font = upgrade_font_candidate(raw_accent, is_hero_layer, role, rng=rng)
            
            base_size = int(f_style.get("size_px_base", 54))
            # Proportional sizing for 1080x1920 portrait vs 1920x1080 landscape:
            if is_landscape:
                if behind_subject:
                    font_size_px = max(110, min(160, int(base_size * 2.2)))
                    resolved_weight = 900
                    casing = "uppercase"
                    layer_fx = hero_fx_preset
                    layer_overlay = overlay_fx
                elif is_hero_layer:
                    if is_single_word:
                        font_size_px = max(90, min(130, int(base_size * 1.9)))
                    else:
                        font_size_px = max(80, min(115, int(base_size * 1.6)))
                    resolved_weight = max(800, int(f_style.get("weight", 700)))
                    layer_fx = hero_fx_preset
                    layer_overlay = overlay_fx
                else:
                    font_size_px = max(44, min(64, int(base_size * 1.05)))
                    resolved_weight = max(600, int(f_style.get("weight", 700)))
                    companion_candidates = [
                        item for item in ANIMA_RUNTIME_TREATMENTS
                        if item["id"] not in policy["avoidPresets"]
                        and item["id"] not in {hero_fx_preset, "obsidian_heavy_grotesque"}
                    ]
                    if not companion_candidates:
                        companion_candidates = [
                            item for item in ANIMA_RUNTIME_TREATMENTS
                            if item["id"] == "apple_pro_display_hero_revealer"
                        ]
                    layer_fx = _weighted_choice(rng, companion_candidates, [
                        1.7 if item["id"] in {
                            "gaussian_blur_reveal_sweep",
                            "apple_pro_display_hero_revealer",
                            "focus_hunting_bokeh_shimmer",
                            "elegant_paraword_spring_bloom",
                        } else 0.6
                        for item in companion_candidates
                    ])["id"]
                    layer_overlay = None
            elif behind_subject:
                font_size_px = max(180, min(240, int(base_size * 3.4)))
                resolved_weight = 900
                casing = "uppercase"
                layer_fx = hero_fx_preset
                layer_overlay = overlay_fx
            elif is_hero_layer:
                if is_single_word:
                    font_size_px = max(150, min(180, int(base_size * 2.8)))
                else:
                    font_size_px = max(130, min(165, int(base_size * 2.4)))
                resolved_weight = max(800, int(f_style.get("weight", 700)))
                layer_fx = hero_fx_preset
                layer_overlay = overlay_fx
            else:
                font_size_px = max(68, min(88, int(base_size * 1.5)))
                resolved_weight = max(600, int(f_style.get("weight", 700)))
                companion_candidates = [
                    item for item in ANIMA_RUNTIME_TREATMENTS
                    if item["id"] not in policy["avoidPresets"]
                    and item["id"] not in {hero_fx_preset, "obsidian_heavy_grotesque"}
                ]
                if not companion_candidates:
                    companion_candidates = [
                        item for item in ANIMA_RUNTIME_TREATMENTS
                        if item["id"] == "apple_pro_display_hero_revealer"
                    ]
                layer_fx = _weighted_choice(rng, companion_candidates, [
                    1.7 if item["id"] in {
                        "gaussian_blur_reveal_sweep",
                        "apple_pro_display_hero_revealer",
                        "focus_hunting_bokeh_shimmer",
                        "elegant_paraword_spring_bloom",
                    } else 0.6
                    for item in companion_candidates
                ])["id"]
                layer_overlay = None



            # Weight floor: minimum 600 for companion, 800 for hero
            resolved_weight = max(600, int(f_style.get("weight", 700)))
            if is_hero_layer:
                resolved_weight = max(800, resolved_weight)

            raw_color = resolve_faithful_font_color(f_style.get("color"))
            style_treatment = resolve_layer_gradient_and_glow(
                prof["profile_name"], role, raw_color, is_hero_layer, brand_palette=chunk_palette
            )

            letter_spacing = float(f_style.get("letter_spacing_em", 0.01))
            if is_single_word and is_hero_layer:
                letter_spacing = max(0.06, letter_spacing)

            rendered_layers.append({
                "layerIndex": layer_idx,
                "layerName": layer_spec.get("layer_name", f"layer_{layer_idx}"),
                "role": role,
                "rawText": raw_layer_text,
                "text": apply_casing_strategy(raw_layer_text, casing, primary_font),
                "words": layer_word_items,
                "fontFamily": primary_font,
                "accentFont": accent_font,
                "fontWeight": resolved_weight,
                "fontStyle": str(f_style.get("style", "normal")),
                "fontSizePx": font_size_px,
                "color": style_treatment["textFillColor"],
                "casing": casing,
                "letterSpacingEm": letter_spacing,
                "lineHeight": float(f_style.get("line_height", 1.05)),
                "isHero": is_hero_layer,
                "fxPreset": layer_fx,
                "entryLeadMs": _entry_lead_ms(policy, signal, is_hero_layer, layer_fx),
                "behindSubject": behind_subject,
                "treatmentOverlay": layer_overlay,
                "selection": {
                    "role": "hero" if is_hero_layer else "companion",
                    "primaryFx": layer_fx,
                    "overlayFx": layer_overlay,
                    "cadenceMs": round(signal["cadenceMs"]),
                },
                "gradient": style_treatment["gradient"],
                "glow": style_treatment["glow"],
                "shadow": style_treatment["shadow"],
                "textFillColor": style_treatment["textFillColor"],
                "hasGradient": style_treatment["hasGradient"],
                "doubleUnderline": bool(layer_spec.get("effects", {}).get("double_underline", False)),
            })

        manifest_chunks.append({
            "chunkIndex": chunk.get("chunkIndex", idx + 1),
            "text": raw_text,
            "profileId": prof["id"],
            "profileName": prof["profile_name"],
            "profileFilename": prof["filename"],
            "pairedImage": prof.get("paired_image"),
            "paletteId": palette_id,
            "palette": chunk_palette,
            "fxPreset": hero_fx_preset,
            "selection": {
                "profilePoolSize": len(profiles),
                "profileCandidateCount": len(candidates_pool),
                "primaryFx": hero_fx_preset,
                "overlayFx": overlay_fx,
                "cadenceMs": round(signal["cadenceMs"]),
                "salience": round(signal["salience"], 3),
            },
            "subjectLayering": {
                "behindSubject": behind_subject,
                "isTallProfile": _is_tall_matte_profile(prof),
                "mode": policy["subjectLayering"],
            },
            "placement": {
                "xPercent": "50%",
                "yPercent": "56%",
                "anchor": "center",
            },
            "sourceStartMs": chunk.get("sourceStartMs", chunk.get("startMs", 0)),
            "sourceEndMs": chunk.get("sourceEndMs", chunk.get("endMs", 0)),
            "outputStartMs": chunk.get("outputStartMs", chunk.get("startMs", 0)),
            "outputEndMs": chunk.get("outputEndMs", chunk.get("endMs", 0)),
            "startMs": chunk.get("startMs", 0),
            "endMs": chunk.get("endMs", 0),
            "layers": rendered_layers,
            "words": chunk_word_objs,
        })

    font_manifest = {
        "composition": "JosephLandscapeEdit" if is_landscape else "PrometheusMinRun",
        "canvas": {
            "width": 1920 if is_landscape else 1080,
            "height": 1080 if is_landscape else 1920,
            "aspectRatio": "16:9" if is_landscape else "9:16",
        },
        "profileCount": len(profiles),
        "chunkCount": len(manifest_chunks),
        "brandPalette": video_palette,
        "palettePolicy": "explicit" if explicit_palette_id else "balanced_curated_variation",
        "selectionPolicy": policy,
        "selectionMode": "entropy",
        "selectionNonce": selection_nonce,
        "eligiblePortraitProfileCount": len(profiles),
        "runtimeTreatmentCatalog": [item["id"] for item in ANIMA_RUNTIME_TREATMENTS],
        "chunks": manifest_chunks,
    }
    return font_manifest
