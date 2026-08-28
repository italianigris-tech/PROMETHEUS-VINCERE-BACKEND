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
import hashlib
from pathlib import Path
from typing import Any, Dict, List, Optional

FONT_JSON_DIR = Path(__file__).resolve().parent.parent / "Yuan Prometheus Screenshots" / "font JSON"
FONT_PAIRS_DIR = Path(__file__).resolve().parent.parent / "Yuan Prometheus Screenshots" / "font pairing and placement"
OPT_FONT_DIR = Path("/opt/prometheus/Yuan Prometheus Screenshots/font JSON")
OPT_PAIRS_DIR = Path("/opt/prometheus/Yuan Prometheus Screenshots/font pairing and placement")


def parse_color_to_rgba(color_value: Optional[str]) -> Optional[tuple]:
    """Parse a CSS color into (r, g, b, a) with a in [0,1].

    Handles #RGB, #RRGGBB, #RRGGBBAA, rgb(), rgba(), and a small named-color
    map. Returns None when the value cannot be parsed (caller falls back).
    """
    if not color_value:
        return None
    raw = str(color_value).strip()
    if raw.lower() in ("none", "transparent"):
        return (0, 0, 0, 0.0)
    named = {
        "black": (0, 0, 0, 1.0), "white": (255, 255, 255, 1.0),
        "red": (255, 0, 0, 1.0), "blue": (0, 0, 255, 1.0),
        "green": (0, 128, 0, 1.0), "gray": (128, 128, 128, 1.0),
        "grey": (128, 128, 128, 1.0),
    }
    if raw.lower() in named:
        return named[raw.lower()]

    if raw.startswith("#"):
        hex_clean = raw[1:]
        if len(hex_clean) == 3:
            hex_clean = "".join(ch * 2 for ch in hex_clean)
        if len(hex_clean) == 4:
            hex_clean = "".join(ch * 2 for ch in hex_clean)
        if len(hex_clean) not in (6, 8):
            return None
        try:
            r = int(hex_clean[0:2], 16)
            g = int(hex_clean[2:4], 16)
            b = int(hex_clean[4:6], 16)
            a = int(hex_clean[6:8], 16) / 255.0 if len(hex_clean) == 8 else 1.0
            return (r, g, b, a)
        except ValueError:
            return None

    # rgb() / rgba()
    if raw.lower().startswith("rgb"):
        inner = raw[raw.index("(") + 1: raw.rindex(")")]
        parts = [p.strip() for p in inner.split(",")]
        if len(parts) < 3:
            return None
        try:
            r = int(float(parts[0]))
            g = int(float(parts[1]))
            b = int(float(parts[2]))
            a = float(parts[3]) if len(parts) > 3 else 1.0
            return (r, g, b, a)
        except (ValueError, TypeError):
            return None
    return None


def get_relative_luminance(color_value: Optional[str]) -> float:
    """Compute WCAG relative luminance (0..1) for legibility over video.

    Robustly parses #RGB, #RRGGBB, #RRGGBBAA, rgb(), rgba() and common named
    colors so dark print-ink colors are never accidentally treated as bright.
    """
    parsed = parse_color_to_rgba(color_value)
    if parsed is None:
        return 1.0  # unknown/unparseable -> assume bright (safe default)
    r, g, b, _a = parsed
    def _linear(channel: float) -> float:
        channel /= 255.0
        return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4
    return 0.2126 * _linear(r) + 0.7152 * _linear(g) + 0.0722 * _linear(b)


def wcag_contrast_ratio(color_a: Optional[str], color_b: Optional[str]) -> float:
    """WCAG contrast ratio between two colors (handles any parsed format)."""
    la = get_relative_luminance(color_a)
    lb = get_relative_luminance(color_b)
    lighter, darker = max(la, lb), min(la, lb)
    return (lighter + 0.05) / (darker + 0.05)



def resolve_faithful_font_color(
    color_hex: Optional[str],
    fallback_color: str = "#FFFFFF",
    is_hero: bool = False,
    background_luminance: Optional[float] = None,
    min_contrast: float = 4.5,
) -> str:
    """Ensure crisp, high-contrast legibility over any video or canvas background.

    Background-aware contrast resolution:
    - On light backgrounds (luminance > 0.55, e.g. paper/canvas backdrops):
      text must be deep high-contrast obsidian (#0F172A / #111827).
    - On dark backgrounds (luminance <= 0.55, standard video footage):
      text must be crisp bright white (#FFFFFF) or bright luminous hero color.
    - Dark print-ink colors from white paper screenshots are automatically
      mapped to the contrasting tone for the active background.
    """
    is_light_bg = background_luminance is not None and background_luminance > 0.55
    safe_fallback = "#0F172A" if is_light_bg else (fallback_color or "#FFFFFF")

    if not color_hex or str(color_hex).strip().lower() in ("none", "transparent", "inherit", "auto"):
        return safe_fallback

    clean_hex = str(color_hex).strip()
    parsed = parse_color_to_rgba(clean_hex)
    if parsed is None:
        return safe_fallback

    lum = get_relative_luminance(clean_hex)

    if is_light_bg:
        # On light background: text must be dark (luminance < 0.25) to clear >= 4.5:1
        ratio = (background_luminance + 0.05) / (lum + 0.05)
        if ratio < min_contrast or lum > 0.30:
            return "#0F172A"
        return clean_hex

    # On dark/medium background: text must be bright (luminance >= 0.40)
    if lum < 0.40:
        return safe_fallback

    if background_luminance is not None and 0.0 <= background_luminance <= 1.0:
        lighter = max(lum, background_luminance)
        darker = min(lum, background_luminance)
        ratio = (lighter + 0.05) / (darker + 0.05)
        if ratio < min_contrast:
            return safe_fallback

    return clean_hex




UNSAFE_PIXEL_FONTS = {"vt323", "press start 2p", "special elite", "silkscreen"}

UNSAFE_PIXEL_FONTS = {"vt323", "press start 2p", "special elite", "silkscreen"}

UNSAFE_DISTORTED_FONTS: Dict[str, str] = {
    "foglihten-068": "Bodoni Moda",
    "foglihten": "Bodoni Moda",
    "berylium": "Playfair Display",
    "echelon": "Playfair Display",
    "silver hairline": "Bodoni Moda",
    "brushelva": "Great Vibes",
}


# ---------------------------------------------------------------------------
# Authoritative Font Family Registry
# ---------------------------------------------------------------------------
# Maps every font-family string that can appear in the font JSON corpus to the
# EXACT family name registered in the Remotion renderer's @font-face / local fonts.
# Single source of truth guaranteeing every manifest fontFamily resolves to a loaded face.
FONT_FAMILY_REGISTRY: Dict[str, str] = {
    # --- family + style variants -> base loaded family ----------------------
    "playfair display italic": "Playfair Display",
    "playfair display": "Playfair Display",
    "cormorant garamond italic": "Cormorant Garamond",
    "cormorant garamond": "Cormorant Garamond",
    "montserrat extrabold": "Montserrat",
    "montserrat black": "Montserrat",
    "montserrat thin": "Montserrat",
    "montserrat": "Montserrat",
    "bodoni moda": "Bodoni Moda",
    "bebas neue": "Bebas Neue",
    "bebas": "Bebas Neue",
    "anton": "Anton",
    "oswald": "Oswald",
    "great vibes": "Great Vibes",
    "dancing script": "Dancing Script",
    "sacramento": "Sacramento",
    "pinyon script": "Pinyon Script",
    "italiana": "Italiana",
    "six caps": "Six Caps",
    "teko": "Teko",
    "saira extra condensed": "Saira Extra Condensed",
    "saira extracondensed": "Saira Extra Condensed",
    "space mono": "Space Mono",
    "courier prime": "Courier Prime",
    "roboto slab": "Roboto Slab",
    "dm sans": "DM Sans",
    "senza bella": "SenzaBella",
    "senzabella": "SenzaBella",
    "cinzel": "Cinzel",
    "cinzel bold": "Cinzel Bold",
    "goudy bookletter": "Goudy Bookletter",
    "league gothic": "League Gothic",
    "big shoulders display": "Big Shoulders Display",
    "antonio": "Antonio",
    "pathway extreme": "Pathway Extreme",
    "abril fatface": "Abril Fatface",
    "the glamoure": "The Glamoure",
    "aesthetic": "Aesthetic",
    "almera": "Almera",
    "meditative": "Meditative",
    "exclusive editorial": "Exclusive Editorial",
    "paris forbel": "Paris Forbel",
    "antenna": "ANTENNA",
    "aulion demo": "Aulion Demo",
    "aesthico (demo)": "Aesthico (Demo)",
    "aesthico": "Aesthico (Demo)",
    "amerika": "Amerika",
    "amerika alternates": "Amerika Alternates",
    "kraton free font": "Kraton free Font",
    "kraton": "Kraton free Font",
    "quanton personal use only": "Quanton PERSONAL USE ONLY",
    "quanton": "Quanton PERSONAL USE ONLY",
    "blaak thin personal use": "Blaak Thin PERSONAL USE",
    "blaak": "Blaak Thin PERSONAL USE",
    "foundland italic personal use only": "Foundland Italic PERSONAL USE ONLY",
    "monrovia-modernseriffont": "Monrovia-ModernSerifFont",
    "erotique alternate trial": "Erotique Alternate Trial",
    "erotique": "Erotique Alternate Trial",
    # --- Custom Studio & Mixfont Families ------------------------------------
    "altone": "Altone",
    "altone trial": "Altone Trial",
    "altone trial regular": "Altone Trial",
    "altone trial bold": "Altone Trial",
    "autone": "Altone",
    "apple garamond": "Apple Garamond",
    "apple garamond bold": "Apple Garamond",
    "apple garamond light": "Apple Garamond",
    "candlescript": "Candlescript",
    "candle script": "Candle Script",
    "candlescript demo version": "Candlescript Demo Version",
    "freebooter script": "Freebooter Script",
    "freebooter": "Freebooter Script",
    "freebooter_script": "Freebooter Script",
    "lemon milk": "LEMON MILK",
    "lemonmilk": "LEMON MILK",
    "lemon milk bold": "LEMON MILK",
    "lemon milk light": "LEMON MILK",
    "lemon milk medium": "LEMON MILK",
    "made mirage": "MADE Mirage",
    "made mirage black": "MADE Mirage",
    "made mirage bold": "MADE Mirage",
    "made mirage medium": "MADE Mirage",
    "made mirage thin": "MADE Mirage",
    "rhegina darling": "Rhegina Darling",
    "rhegina darling regular": "Rhegina Darling",
    "regina darling": "Rhegina Darling",
    "liminal mirage": "Liminal Mirage",
    "lumina mirage": "Lumina Mirage",
    "lumina": "Lumina Mirage",
    "display regular": "Display Regular",
    "liminal mirage display regular": "Liminal Mirage Display Regular",
    "liminal-mirage-display-regular": "Liminal Mirage Display Regular",
    "seric grotesk": "SERIC Grotesk",
    "seric grotesk regular": "SERIC Grotesk Regular",
    "xeric grotesk": "Xeric Grotesk",
    "xeric grotesk regular": "Xeric Grotesk Regular",
    "xeric-grotesk-regular": "SERIC Grotesk Regular",
    "zeri grotesk regular": "SERIC Grotesk Regular",
    "zeri grotesk": "SERIC Grotesk",
    "grand cru": "Grand Cru",
    "grandcru": "GrandCru",
    "bellavoir serif": "Bellavoir Serif",
    "bellavoirserif": "BellavoirSerif",
    "vogue": "Vogue",
    "black delights": "Black Delights",
    "elegist": "Elegist",
    "migra": "Migra",
    "zt otez": "ZT Otez",
    "fraunces": "Fraunces",
    "allura": "Allura",
    "italianno": "Italianno",
    "inter": "Inter",
    "inter black": "Inter",
    "inter thin": "Inter",
    "poppins": "Poppins",
    "outfit": "Outfit",
    "plus jakarta sans": "Plus Jakarta Sans",
}

# Families that require an explicit renderer @font-face/Google registration
# (they are NOT in the original all_fonts_dynamic.css import).
REGISTRY_NEEDS_LOAD = {
    "Allura", "Barlow Condensed", "Black Han Sans", "Fraunces", "IM Fell English",
    "Inter", "Kalam", "Lato", "Lora",
    "Open Sans", "Outfit", "Plus Jakarta Sans", "Raleway", "Rozha One",
    "Source Sans", "Source Serif",
}


def resolve_safe_font_candidate(candidate: str) -> str:
    """Clean corrupt/low-res bitmap fonts and distorted rune-like fonts that impair readability.

    Uses the authoritative FONT_FAMILY_REGISTRY for exact naming so every
    emitted fontFamily matches an actually-loaded @font-face in the renderer.
    """
    if not candidate:
        return "Space Mono"
    c_clean = candidate.strip().lower()
    if c_clean in UNSAFE_PIXEL_FONTS:
        return "Space Mono"
    if c_clean in UNSAFE_DISTORTED_FONTS:
        return UNSAFE_DISTORTED_FONTS[c_clean]
    # Exact registry hit (normalized family+style -> loaded family).
    if c_clean in FONT_FAMILY_REGISTRY:
        return FONT_FAMILY_REGISTRY[c_clean]
    # Containment pass over the registry keys so e.g. "Playfair Display SemiBold"
    # still resolves to the loaded "Playfair Display" family.
    for key, replacement in FONT_FAMILY_REGISTRY.items():
        if key in c_clean:
            return replacement
    for key, replacement in UNSAFE_DISTORTED_FONTS.items():
        if key in c_clean:
            return replacement
    return candidate


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
    """Intelligently partition words across profile layers matching the font profile's hierarchy and relative_scale."""
    token_count = len(words)
    if not profile_layers or token_count <= 1:
        l0 = profile_layers[0] if profile_layers else {}
        is_hero = l0.get("role") in ("primary_focus_word", "hero", "hero_accent_bold", "see_through_hero", "header") or float(l0.get("font_style", {}).get("relative_scale", 1.0)) >= 0.75
        return [{"layer": l0, "words": words, "is_hero": is_hero}]

    num_layers = len(profile_layers)
    if num_layers == 2:
        l0 = profile_layers[0]
        l1 = profile_layers[1]
        scale0 = float(l0.get("font_style", {}).get("relative_scale", 1.0))
        scale1 = float(l1.get("font_style", {}).get("relative_scale", 0.5))
        hero0 = scale0 >= scale1 if scale0 != scale1 else (l0.get("role") in ("primary_focus_word", "hero", "hero_accent_bold") or scale0 >= 0.75)
        hero1 = scale1 > scale0 if scale0 != scale1 else (l1.get("role") in ("primary_focus_word", "hero", "hero_accent_bold") or scale1 >= 0.75)

        # If layer 0 is the primary dominant hero (e.g. image 6, image 35), preserve layer 0 dominance
        if scale0 > scale1:
            if token_count == 2:
                return [
                    {"layer": l0, "words": [words[0]], "is_hero": True},
                    {"layer": l1, "words": [words[1]], "is_hero": False},
                ]
            elif token_count == 3:
                return [
                    {"layer": l0, "words": words[:1], "is_hero": True},
                    {"layer": l1, "words": words[1:], "is_hero": False},
                ]
            else:
                mid = max(1, token_count // 2)
                return [
                    {"layer": l0, "words": words[:mid], "is_hero": True},
                    {"layer": l1, "words": words[mid:], "is_hero": False},
                ]
        else:
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

    # If profile has 3+ layers (e.g. image 2, image 48)
    allocations = []
    chunk_size = max(1, token_count // num_layers)
    for idx, layer in enumerate(profile_layers):
        start_idx = idx * chunk_size
        end_idx = (idx + 1) * chunk_size if idx < num_layers - 1 else token_count
        layer_words = words[start_idx:end_idx]
        if not layer_words and idx == num_layers - 1 and allocations:
            break
        scale = float(layer.get("font_style", {}).get("relative_scale", 1.0))
        is_hero = layer.get("role") in ("primary_focus_word", "hero", "hero_accent_bold") or scale >= 0.75
        allocations.append({"layer": layer, "words": layer_words or [words[-1]], "is_hero": is_hero})
    return allocations

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
        "zone": {
            "name": "champagne_gold",
            "primary": "#F5E6C4",
            "accent": "#D4AF37",
            "base": "#FFFFFF",
            "keyword": "#F5E6C4",
            "glow_rgb": "245, 230, 196",
        },
    },
    "obsidian_crimson": {
        "hero_color": "#FF453A",
        "companion_color": "#FFFFFF",
        "glow": "0 0 16px rgba(255, 69, 58, 0.45)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)",
        "accent_border": "#FF3B30",
        "zone": {
            "name": "obsidian_crimson",
            "primary": "#FF453A",
            "accent": "#FF3B30",
            "base": "#FFFFFF",
            "keyword": "#FF453A",
            "glow_rgb": "255, 69, 58",
        },
    },
    "electric_cyan": {
        "hero_color": "#00F0FF",
        "companion_color": "#FFFFFF",
        "glow": "0 0 16px rgba(0, 240, 255, 0.45)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)",
        "accent_border": "#00D2FF",
        "zone": {
            "name": "electric_cyan",
            "primary": "#00F0FF",
            "accent": "#00D2FF",
            "base": "#FFFFFF",
            "keyword": "#00F0FF",
            "glow_rgb": "0, 240, 255",
        },
    },
    "emerald_luxury": {
        "hero_color": "#34D399",
        "companion_color": "#FFFFFF",
        "glow": "0 0 16px rgba(52, 211, 153, 0.45)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)",
        "accent_border": "#10B981",
        "zone": {
            "name": "emerald_luxury",
            "primary": "#34D399",
            "accent": "#10B981",
            "base": "#FFFFFF",
            "keyword": "#34D399",
            "glow_rgb": "52, 211, 153",
        },
    },
    "royal_amethyst": {
        "hero_color": "#C084FC",
        "companion_color": "#FFFFFF",
        "glow": "0 0 16px rgba(192, 132, 252, 0.45)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)",
        "accent_border": "#A78BFA",
        "zone": {
            "name": "royal_amethyst",
            "primary": "#C084FC",
            "accent": "#A78BFA",
            "base": "#FFFFFF",
            "keyword": "#C084FC",
            "glow_rgb": "192, 132, 252",
        },
    },
    "sunset_amber": {
        "hero_color": "#FBBF24",
        "companion_color": "#FFFFFF",
        "glow": "0 0 16px rgba(251, 191, 36, 0.45)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)",
        "accent_border": "#F59E0B",
        "zone": {
            "name": "sunset_amber",
            "primary": "#FBBF24",
            "accent": "#F59E0B",
            "base": "#FFFFFF",
            "keyword": "#FBBF24",
            "glow_rgb": "251, 191, 36",
        },
    },
    "pure_editorial_mono": {
        "hero_color": "#FFFFFF",
        "companion_color": "#F1F5F9",
        "glow": "0 0 14px rgba(255, 255, 255, 0.35)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)",
        "accent_border": "#FFFFFF",
        "zone": {
            "name": "pure_editorial_mono",
            "primary": "#FFFFFF",
            "accent": "#F1F5F9",
            "base": "#FFFFFF",
            "keyword": "#FFFFFF",
            "glow_rgb": "255, 255, 255",
        },
    },
}

DEFAULT_VARIATION_PALETTES = tuple(BRAND_PALETTES.keys())


def zone_schema_colors(palette: Dict[str, str]) -> Dict[str, str]:
    """Return the zone-schema color set (base/primary/accent/keyword) for a palette.

    Every piece of on-screen text is constrained to these 2-3 colors so the
    video carries one coherent brand zone (no scattered gray/blue/red noise).
    """
    zone = palette.get("zone") or {}
    return {
        "base": zone.get("base", palette.get("companion_color", "#FFFFFF")),
        "primary": zone.get("primary", palette.get("hero_color", "#FFFFFF")),
        "accent": zone.get("accent", palette.get("hero_color", "#FFFFFF")),
        "keyword": zone.get("keyword", palette.get("hero_color", "#FFFFFF")),
        "glow_rgb": zone.get("glow_rgb", "255, 255, 255"),
    }



def resolve_brand_palette(brand_input: Optional[Any] = None) -> Dict[str, str]:
    """Ingest user brand preferences, color directives, or preset names."""
    if isinstance(brand_input, dict):
        if "brandMotif" in brand_input and brand_input["brandMotif"] in BRAND_PALETTES:
            return BRAND_PALETTES[brand_input["brandMotif"]].copy()
        motif = brand_input.get("motif") or brand_input.get("preset")
        base = (BRAND_PALETTES.get(motif) if motif in BRAND_PALETTES else BRAND_PALETTES["champagne_gold"]).copy()
        if "heroColor" in brand_input or "hero_color" in brand_input:
            base["hero_color"] = str(brand_input.get("heroColor") or brand_input.get("hero_color"))
        if "companionColor" in brand_input or "companion_color" in brand_input:
            base["companion_color"] = str(brand_input.get("companionColor") or brand_input.get("companion_color"))
        if "glow" in brand_input:
            base["glow"] = str(brand_input["glow"])
        if "accentBorder" in brand_input or "accent_border" in brand_input or "accent" in brand_input:
            base["accent_border"] = str(brand_input.get("accentBorder") or brand_input.get("accent_border") or brand_input.get("accent"))
        hero = base.get("hero_color", "#FFFFFF")
        comp = base.get("companion_color", "#FFFFFF")
        accent = base.get("accent_border", hero)
        glow_rgb = "255, 255, 255"
        parsed = parse_color_to_rgba(hero)
        if parsed:
            glow_rgb = f"{parsed[0]}, {parsed[1]}, {parsed[2]}"
        base["zone"] = {
            "name": "custom",
            "primary": hero,
            "accent": accent,
            "base": comp,
            "keyword": hero,
            "glow_rgb": glow_rgb,
        }
        return base
    
    if isinstance(brand_input, str):
        b_low = brand_input.lower().strip()
        if any(k in b_low for k in ("red", "crimson", "ruby")):
            return BRAND_PALETTES["obsidian_crimson"].copy()
        if any(k in b_low for k in ("blue", "cyan")):
            return BRAND_PALETTES["electric_cyan"].copy()
        if any(k in b_low for k in ("green", "emerald")):
            return BRAND_PALETTES["emerald_luxury"].copy()
        if any(k in b_low for k in ("purple", "amethyst", "violet")):
            return BRAND_PALETTES["royal_amethyst"].copy()
        if any(k in b_low for k in ("yellow", "amber", "orange", "gold")):
            return BRAND_PALETTES["sunset_amber"].copy()
        if any(k in b_low for k in ("white", "mono", "silver")):
            return BRAND_PALETTES["pure_editorial_mono"].copy()
        if b_low in BRAND_PALETTES:
            return BRAND_PALETTES[b_low].copy()
            
    return BRAND_PALETTES["champagne_gold"].copy()


def _explicit_brand_palette_id(design_override: Optional[Dict[str, Any]]) -> Optional[str]:
    design = design_override if isinstance(design_override, dict) else {}
    motif = design.get("brandMotif")
    if isinstance(motif, str) and motif in BRAND_PALETTES:
        return motif
    brand = design.get("brand")
    if isinstance(brand, dict) and any(key in brand for key in ("heroColor", "hero_color", "companionColor", "companion_color", "glow", "brandMotif", "motif")):
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

# High-tier cinematic display fonts matching Screenshots 14, 15, 16, 17 (Didone, Cursive Script, High-Contrast Serif)
HERO_DISPLAY_FONTS = [
    "Bodoni Moda",
    "Playfair Display",
    "Italianno",
    "Dancing Script",
    "Pinyon Script",
    "Alex Brush",
    "Cinzel",
    "Berylium",
    "Anton",
    "Bebas Neue",
]

# High-tier companion fonts
COMPANION_UPGRADE_FONTS = [
    "Playfair Display",
    "Bodoni Moda",
    "Cormorant Garamond",
    "Montserrat",
    "Foglihten-068",
    "Goudy Bookletter",
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
            return _rng.choice(HERO_UPGRADE_FONTS)
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
                # Exclude wall_man_z_plane profiles from mini-run portrait pool.
                # These profiles embed environmental sample text (e.g. "my mom") into their
                # design and are incompatible with transcript-driven word rendering.
                meta_ts = data.get("metadata", {}).get("treatment_system", "")
                if not include_landscape and meta_ts == "wall_man_z_plane":
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
    raw_color: Optional[str],
    is_hero: bool,
    brand_palette: Dict[str, str],
    layer_effects: Optional[Dict[str, Any]] = None,
    explicit_user_override: bool = False,
    background_luminance: Optional[float] = None,
) -> Dict[str, Any]:
    """Resolve color, gradient, glow, and shadow treatments respecting the font JSON unless overridden by prompt or contrast."""
    layer_effects = layer_effects or {}

    # 1. Color resolution:
    if explicit_user_override:
        text_fill_color = brand_palette.get("hero_color" if is_hero else "companion_color", "#FFFFFF")
        palette_id = brand_palette.get("id", "champagne_gold")
    else:
        # Strictly reserve the exact color code specified in the font JSON
        text_fill_color = resolve_faithful_font_color(
            raw_color,
            fallback_color=brand_palette.get("hero_color" if is_hero else "companion_color", "#FFFFFF"),
            is_hero=is_hero,
            background_luminance=background_luminance,
        )
        palette_id = brand_palette.get("id", "custom")

    # 2. Shadow resolution (multi-layer contrast backing guaranteeing readability over video):
    is_light_bg = background_luminance is not None and background_luminance > 0.55
    if is_light_bg:
        shadow = "0 1px 4px rgba(0, 0, 0, 0.20), 0 1px 2px rgba(0, 0, 0, 0.12)"
        glow = "none"
    else:
        ds = layer_effects.get("drop_shadow")
        if isinstance(ds, dict):
            blur = ds.get("blur_radius", 8)
            shadow = f"0 4px 20px rgba(0, 0, 0, 0.95), 0 2px {blur}px rgba(0, 0, 0, 0.90)"
        else:
            shadow = "0 4px 20px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90)"

        custom_glow = layer_effects.get("glow")
        if isinstance(custom_glow, str):
            glow = custom_glow
        elif is_hero:
            glow = brand_palette.get("glow") or f"0 0 16px {text_fill_color}66"
        else:
            glow = "0 0 10px rgba(255, 255, 255, 0.20)"

    # 4. Gradient resolution:
    has_gradient = bool(layer_effects.get("gradient") or (is_hero and text_fill_color not in ("#FFFFFF", "#0F172A")) or explicit_user_override)
    if has_gradient and not is_light_bg:
        if isinstance(layer_effects.get("gradient"), str):
            gradient = layer_effects["gradient"]
        elif explicit_user_override:
            GRADIENT_MAP = {
                "champagne_gold": "linear-gradient(135deg, #FFFFFF 0%, #F5E6C4 45%, #D4AF37 100%)",
                "obsidian_crimson": "linear-gradient(135deg, #FFFFFF 0%, #FF453A 40%, #D70015 100%)",
                "electric_cyan": "linear-gradient(135deg, #FFFFFF 0%, #00F0FF 45%, #0099FF 100%)",
                "emerald_luxury": "linear-gradient(135deg, #FFFFFF 0%, #34D399 45%, #059669 100%)",
                "royal_amethyst": "linear-gradient(135deg, #FFFFFF 0%, #C084FC 45%, #7C3AED 100%)",
                "sunset_amber": "linear-gradient(135deg, #FFFFFF 0%, #FBBF24 45%, #D97706 100%)",
                "pure_editorial_mono": "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 45%, #CBD5E1 100%)",
            }
            gradient = GRADIENT_MAP.get(palette_id, f"linear-gradient(135deg, #FFFFFF 0%, {text_fill_color} 48%, {text_fill_color} 100%)")
        else:
            gradient = f"linear-gradient(135deg, #FFFFFF 0%, {text_fill_color} 45%, {text_fill_color} 100%)"
    else:
        gradient = "none"

    return {
        "gradient": gradient,
        "glow": glow,
        "shadow": shadow,
        "textFillColor": text_fill_color,
        "hasGradient": has_gradient and gradient != "none",
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
    # -----------------------------------------------------------------------
    # HOOKS — Intro kinetic treatments designed for the critical first 3-5s
    # of viewer attention. These are DISABLED for non-first chunks by default
    # and are activated by the Hooks feature module (see hooks.py).
    # -----------------------------------------------------------------------
    {"id": "hook_bokeh_defocus_bloom", "styles": {"cinematic", "hook"}, "energy": 0.50},
    {"id": "hook_gaussian_lens_reveal", "styles": {"cinematic", "hook"}, "energy": 0.42},
    {"id": "hook_directional_whip_blur", "styles": {"kinetic", "hook"}, "energy": 0.65},
    {"id": "hook_radial_zoom_blur", "styles": {"kinetic", "hook"}, "energy": 0.70},
    {"id": "hook_sharp_white_flash_cut", "styles": {"kinetic", "hook"}, "energy": 0.88},
    {"id": "hook_anamorphic_flare_burst", "styles": {"cinematic", "hook"}, "energy": 0.60},
    {"id": "hook_vintage_film_burn_strobe", "styles": {"cinematic", "hook"}, "energy": 0.52},
    {"id": "hook_luma_strobe_pulse", "styles": {"kinetic", "hook"}, "energy": 0.75},
    {"id": "hook_cinematic_dolly_zoom", "styles": {"cinematic", "hook"}, "energy": 0.55},
    {"id": "hook_crash_zoom_snap", "styles": {"kinetic", "hook"}, "energy": 0.82},
    {"id": "hook_isometric_3d_slam", "styles": {"kinetic", "hook"}, "energy": 0.78},
    {"id": "hook_vertical_kinetic_pedestal", "styles": {"kinetic", "hook"}, "energy": 0.64},
    {"id": "hook_smooth_zoom_in", "styles": {"cinematic", "hook"}, "energy": 0.48},
    {"id": "hook_full_zoom_up", "styles": {"kinetic", "hook"}, "energy": 0.60},
    {"id": "hook_rgb_chromatic_split_glitch", "styles": {"kinetic", "hook"}, "energy": 0.85},
    {"id": "hook_crt_scanline_matrix_decode", "styles": {"kinetic", "hook"}, "energy": 0.76},
    {"id": "hook_vhs_tape_tracking_tear", "styles": {"kinetic", "hook"}, "energy": 0.72},
    {"id": "hook_metallic_chrome_reflection", "styles": {"cinematic", "hook"}, "energy": 0.58},
    {"id": "hook_liquid_ink_metaball_reveal", "styles": {"cinematic", "hook"}, "energy": 0.54},
    {"id": "hook_zora_aperture_mask_bloom", "styles": {"cinematic", "hook"}, "energy": 0.46},
    {"id": "hook_motion_blur_word", "styles": {"kinetic", "hook"}, "energy": 0.52},
    # -----------------------------------------------------------------------
    # ZORA'S MASK — Cinematic mask treatment that reveals text through a
    # stylized, organic mask shape (not a hard cut-out). The mask blooms
    # from the keyword outward, creating a sophisticated reveal.
    # -----------------------------------------------------------------------
    {"id": "zora_mask_reveal", "styles": {"cinematic", "editorial"}, "energy": 0.42},
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


def _resolve_font_json_treatment(
    prof: Dict[str, Any],
    layer_spec: Dict[str, Any],
    is_hero: bool,
    is_single_word: bool,
    rng: random.Random,
    policy: Dict[str, Any],
) -> str:
    """Resolve runtime kinetic text treatment directly from the font JSON classification, mood, and role."""
    mood = str(prof.get("metadata", {}).get("overall_mood", "")).lower()
    classification = str(layer_spec.get("font_classification", "")).lower()
    role = str(layer_spec.get("role", "")).lower()
    avoid = set(policy.get("avoidPresets", []))

    if any(k in classification or k in mood for k in ("3d", "metallic", "chrome", "extruded")):
        candidates = ["gaussian_blur_reveal_sweep", "metallic_chrome_countup_hero", "kinetic_slot_character_reel"]
    elif any(k in classification or k in mood for k in ("script", "calligraphic", "cursive", "brush", "handwriting")):
        candidates = ["gaussian_blur_reveal_sweep", "elegant_paraword_spring_bloom", "hand_drawn_kinetic_underline"]
    elif any(k in classification or k in mood for k in ("compressed", "ultra-compressed", "tall", "heavy sans", "grotesque")):
        candidates = ["gaussian_blur_reveal_sweep", "obsidian_heavy_grotesque", "top_down_staggered_character_drop"]
    elif any(k in classification or k in mood for k in ("didone", "modern serif", "classic editorial", "refined")):
        candidates = ["gaussian_blur_reveal_sweep", "apple_pro_display_hero_revealer", "cinematic_viewport_mask_sweep"]
    elif any(k in classification or k in mood for k in ("swiss", "poster", "display", "headline")):
        candidates = ["gaussian_blur_reveal_sweep", "apple_keynote_headline_punch", "apple_pro_display_hero_revealer"]
    elif any(k in classification or k in mood for k in ("matrix", "cyber", "terminal", "code")):
        candidates = ["cyber_matrix_text_scramble", "typewriter_ghost_cursor", "led_dot_matrix_scanline"]
    else:
        if is_hero:
            candidates = ["gaussian_blur_reveal_sweep", "apple_pro_display_hero_revealer", "focus_hunting_bokeh_shimmer"]
        else:
            candidates = ["gaussian_blur_reveal_sweep", "apple_pro_display_hero_revealer", "subpixel_glow_mask"]

    eligible = [c for c in candidates if c not in avoid]
    return rng.choice(eligible) if eligible else "gaussian_blur_reveal_sweep"


def eligible_portrait_profile_ids() -> List[str]:
    return [profile["id"] for profile in load_all_portrait_font_json_profiles()]


def _is_tall_matte_profile(profile: Dict[str, Any]) -> bool:
    pid = (profile.get("id") or "").lower()
    pname = (profile.get("profile_name") or "").lower()
    pfile = (profile.get("filename") or "").lower()
    metadata = profile.get("metadata", {})
    if metadata.get("is_tall_font") or metadata.get("matte_text_optimized"):
        return True
    if any(pid.startswith(k) or pfile.startswith(k) for k in ("tall", "tall image", "tall_image")):
        return True
    if any(t in pname for t in ("ultratall", "ultra_tall", "ultracondensed", "ultra_condensed", "pill_grotesk", "hairline_tall", "industrial_block", "spiked_stem", "skywall")):
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


CINEMATIC_PROFILE_TERMS = (
    "editorial", "cinematic", "luxury", "high-end", "hero", "architectural",
    "vogue", "look", "brian", "think_twice", "creative_destruction",
    "art_of_war", "master_your_mind", "money_speaks", "magazine", "poster",
    "art", "tall", "drop cap", "didone", "serif", "fashion", "campaign",
)


def profile_cinematic_quality(profile: Dict[str, Any]) -> float:
    """Score how cinematic/premium a profile reads (0..1).

    Higher-tier screenshot profiles and profiles whose mood/classification uses
    premium editorial language rank above plain print-style profiles, so the
    first chunk (the hook) never opens with an average-looking pairing.
    """
    pid = profile.get("id", "")
    fname = profile.get("filename", "")
    pname = str(profile.get("profile_name", ""))
    pmeta = profile.get("metadata", {})
    mood = str(pmeta.get("overall_mood", "")).lower()
    classification = " ".join(
        str(layer.get("font_classification", ""))
        for layer in profile.get("typography_layers", [])
    ).lower()
    searchable = " ".join([pname.lower(), mood, classification])

    score = 0.0
    if (
        pid in HIGH_TIER_SCREENSHOT_PROFILES
        or fname.replace(".json", "") in HIGH_TIER_SCREENSHOT_PROFILES
    ):
        score += 0.55
    matches = sum(1 for term in CINEMATIC_PROFILE_TERMS if term in searchable)
    score += min(0.40, matches * 0.08)
    if profile.get("paired_image_exists"):
        score += 0.05
    return min(1.0, score)


def _profile_bias_score(
    profile: Dict[str, Any],
    bias: str,
    is_first_chunk: bool = False,
) -> float:
    layers = profile.get("typography_layers", [])
    searchable = " ".join([
        str(profile.get("id", "")),
        str(profile.get("profile_name", "")),
        str(profile.get("metadata", {}).get("overall_mood", "")),
        str(profile.get("metadata", {}).get("treatment_system", "")),
        *(str(layer.get("font_classification", "")) for layer in layers),
        *(
            str(candidate)
            for layer in layers
            for candidate in layer.get("matched_font_candidates", [])
        ),
    ]).lower()

    # Variety bonus across all curated artistic categories (cursive/script, display grotesque, elegant didone, neo-vintage)
    artistic_bonus = 1.0
    if any(k in searchable for k in ("cursive", "script", "calligraphic", "flourish", "handwriting", "brush", "italic", "emma", "gabrielle")):
        artistic_bonus = 1.75
    elif any(k in searchable for k in ("didone", "editorial", "vogue", "serif", "bodoni", "playfair")):
        artistic_bonus = 1.45
    elif any(k in searchable for k in ("grotesque", "display", "condensed", "tall", "poster")):
        artistic_bonus = 1.35

    # Multi-layer pairing bonus (profiles that combine 2 distinct stylistic weights/classifications)
    layer_types = set(str(l.get("font_classification", "")).lower() for l in layers)
    if len(layers) >= 2 and len(layer_types) >= 2:
        artistic_bonus *= 1.4

    cinematic = profile_cinematic_quality(profile)
    first_chunk_boost = (1.0 + cinematic * 3.5) if is_first_chunk else 1.0

    if bias == "mixed":
        return artistic_bonus * first_chunk_boost

    terms = {
        "serif": ("serif", "bodoni", "playfair", "cinzel", "cormorant", "roman", "goudy", "didone"),
        "display": ("display", "condensed", "bebas", "anton", "saira", "grotesque", "block", "headline"),
        "script": ("script", "calligraphic", "italic", "pinyon", "dancing", "sacramento", "vibes", "cursive", "flourish"),
    }.get(bias, ())
    base_score = 2.4 if any(term in searchable for term in terms) else 0.65
    return base_score * artistic_bonus * first_chunk_boost



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
    is_single_word: bool = False,
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
    # Single-word chunks: strongly prefer focal single-word treatments from SINGLE_WORD_HERO_PRESETS.
    # These are the treatments specifically designed for maximum impact on a single focal word.
    single_word_boost = 3.5 if is_single_word else 1.0
    return _weighted_choice(rng, candidates, [
        (2.3 if policy["motionStyle"] in item["styles"] else 0.35)
        * (single_word_boost if item["id"] in SINGLE_WORD_HERO_PRESETS else 1.0)
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


def _select_difference_chunk_indices(
    manifest_chunks: List[Dict[str, Any]],
    rng: random.Random,
    creativity: str = "balanced",
) -> set[int]:
    """Choose rare, well-spaced foreground heroes for color inversion when explicitly expressive."""
    if creativity != "expressive":
        return set()
    candidates = []
    incompatible_fx = {"see_through_glass_letterform", "metallic_chrome_countup_hero"}
    for position, chunk in enumerate(manifest_chunks):
        layers = chunk.get("layers", [])
        if chunk.get("subjectLayering", {}).get("behindSubject"):
            continue
        if not any(layer.get("isHero") for layer in layers):
            continue
        if any(layer.get("fxPreset") in incompatible_fx for layer in layers):
            continue
        salience = float(chunk.get("selection", {}).get("salience", 0.0))
        candidates.append((salience, rng.random(), position))

    target_count = min(1 if len(manifest_chunks) <= 15 else 2, len(candidates))
    selected: set[int] = set()
    for _, _, position in sorted(candidates, reverse=True):
        if all(abs(position - existing) >= 5 for existing in selected):
            selected.add(position)
        if len(selected) >= target_count:
            break
    return selected




def generate_font_manifest(chunks: List[Dict[str, Any]], design_override: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    aspect_ratio = (design_override or {}).get("aspectRatio", "9:16")
    is_landscape = str(aspect_ratio) in ("16:9", "landscape", "1.777", "1.78")

    # 16:9 Landscape has Full Admin Access to entire font corpus (77+ profiles)
    # 9:16 Portrait has restricted access (excludes landscape profiles)
    profiles = load_all_font_json_profiles(include_landscape=is_landscape)
    if not profiles:
        raise RuntimeError("No font JSON profiles found in directory!")


    # Selection is deterministic when an explicit seed is provided in design_override,
    # otherwise an entropy nonce is generated for dynamic runs.
    design_input = design_override or {}
    explicit_seed = design_input.get("seed")
    if explicit_seed is not None and str(explicit_seed).strip():
        seed_str = str(explicit_seed).strip()
        selection_nonce = hashlib.sha256(seed_str.encode("utf-8")).hexdigest()[:24]
        rng = random.Random(seed_str)
        selection_mode = "seed"
    else:
        seed_str = ""
        selection_nonce = secrets.token_hex(24)
        rng = random.Random(selection_nonce)
        selection_mode = "entropy"

    policy = resolve_typography_policy(design_override)

    # Unified Video-Level Brand Palette
    explicit_palette_id = _explicit_brand_palette_id(design_input)
    if explicit_palette_id:
        if explicit_palette_id == "custom":
            brand_input = design_input.get("brand") or design_input
            video_palette = resolve_brand_palette(brand_input)
            video_palette_id = "custom"
        else:
            video_palette = resolve_brand_palette(explicit_palette_id)
            video_palette_id = explicit_palette_id
    else:
        # Dynamic variety: pick with rng across all curated high-end palettes (no hardcoded single default)
        palette_choices = list(DEFAULT_VARIATION_PALETTES)
        video_palette_id = _weighted_choice(rng, palette_choices, [1.0] * len(palette_choices))
        video_palette = BRAND_PALETTES[video_palette_id].copy()
    video_palette["id"] = video_palette_id

    # Select behind-subject depth treatment moments with temporal distribution & variety
    behind_subject_indices = set()
    if policy["subjectLayering"] != "disabled":
        # Dynamic count based on video length
        if len(chunks) <= 8:
            max_behind_count = 1
        elif len(chunks) <= 20:
            max_behind_count = 2
        else:
            max_behind_count = 3

        candidate_scores = []
        for c_idx, c in enumerate(chunks):
            c_text = str(c.get("text", "")).strip()
            c_words = c_text.split()
            if not c_words:
                continue
            c_clean = "".join(ch for ch in c_text if ch.isalnum())
            c_signal = _chunk_signal(c)

            duration_ms = c.get("endMs", 0) - c.get("startMs", 0)
            word_count = len(c_words)
            # Allow punchy 1 to 3 word chunks with sustained duration
            is_punchy = 1 <= word_count <= 3
            is_substantive = c_clean.lower() not in STOPWORDS and len(c_clean) >= 3

            if is_punchy and is_substantive and duration_ms >= 400:
                base_score = c_signal["salience"] + (2.0 if word_count == 1 else 1.4)
                if any(ch.isdigit() for ch in c_text):
                    base_score += 1.0
                # Add mild stochastic variation for true run-to-run diversity
                score = base_score + rng.uniform(-0.25, 0.25)
                candidate_scores.append((c_idx, score))

        candidate_scores.sort(key=lambda item: item[1], reverse=True)

        if policy["subjectLayering"] == "required" and not candidate_scores and chunks:
            shortest_idx = min(range(len(chunks)), key=lambda i: len(str(chunks[i].get("text", "")).split()))
            behind_subject_indices.add(shortest_idx)
        else:
            for c_idx, score in candidate_scores:
                if len(behind_subject_indices) >= max_behind_count:
                    break
                # Cooldown of at least 3 chunks between behind-subject occurrences
                if all(abs(c_idx - existing_idx) >= 3 for existing_idx in behind_subject_indices):
                    if policy["subjectLayering"] == "required":
                        behind_subject_indices.add(c_idx)
                    elif policy["subjectLayering"] == "auto":
                        if score >= 1.0 or (rng.random() < 0.70 and score >= 0.7):
                            behind_subject_indices.add(c_idx)

    manifest_chunks = []
    recent_primary_fx: List[str] = []
    preset_usage_counts: Dict[str, int] = {item["id"]: 0 for item in ANIMA_RUNTIME_TREATMENTS}
    profile_usage_counts: Dict[str, int] = {}
    recent_profile_ids: List[str] = []  # sliding window to prevent rapid re-selection

    tall_font_usage_counts: Dict[str, int] = {f: 0 for f in TALL_MATTE_FONTS}
    recent_tall_fonts: List[str] = []

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
        behind_subject = (idx in behind_subject_indices)

        # Strict Tall vs Foreground separation:
        # Background chunks MUST strictly use Tall Font profiles.
        # Foreground chunks MUST strictly EXCLUDE Tall Font profiles.
        if behind_subject:
            pool = [p for p in profiles if _is_tall_matte_profile(p)] or profiles
        else:
            pool = [p for p in profiles if not _is_tall_matte_profile(p)] or profiles

        if is_single_word:
            # Match 1-word profiles, prioritizing exact single-word sample_text profiles (like image 51 "less.")
            single_word_pool = [p for p in pool if p.get("total_words", 1) == 1 and len(p.get("typography_layers", [])) == 1]
            # Fallback: any profile with exactly 1 layer (can render any single word cleanly)
            one_layer_pool = [p for p in pool if len(p.get("typography_layers", [])) == 1]
            matching_profiles = single_word_pool or one_layer_pool or pool
        else:
            # Tier 1: Exact ±1 word count match — the preferred, word-count-faithful pool.
            tier1 = [
                p for p in pool
                if abs(p.get("total_words", len(p.get("typography_layers", []))) - word_count) <= 1
            ]
            # Tier 2: ±3 word count tolerance — still respects the rough scale of the chunk.
            tier2 = [
                p for p in pool
                if abs(p.get("total_words", len(p.get("typography_layers", []))) - word_count) <= 3
            ]
            # Tier 3: Full pool fallback.
            matching_profiles = tier1 or tier2 or pool

        if not matching_profiles:
            matching_profiles = pool

        candidates_pool = [p for p in matching_profiles if p["id"] not in recent_profile_ids] or matching_profiles
        prof = _weighted_choice(rng, candidates_pool, [
            _profile_bias_score(profile, policy["typographyBias"], is_first_chunk=(idx == 0))
            / (1.0 + profile_usage_counts.get(profile["id"], 0) * 3.0)
            for profile in candidates_pool
        ])
        profile_usage_counts[prof["id"]] = profile_usage_counts.get(prof["id"], 0) + 1
        recent_profile_ids.append(prof["id"])
        max_recent = max(4, min(8, len(pool) // 4))
        if len(recent_profile_ids) > max_recent:
            recent_profile_ids.pop(0)

        hero_fx_preset = _select_primary_treatment(
            rng, policy, signal, preset_usage_counts, recent_primary_fx,
            is_single_word=is_single_word,
        )
        preset_usage_counts[hero_fx_preset] = preset_usage_counts.get(hero_fx_preset, 0) + 1
        recent_primary_fx.append(hero_fx_preset)
        if len(recent_primary_fx) > 2:
            recent_primary_fx.pop(0)
        overlay_fx = _select_overlay(rng, policy, signal, hero_fx_preset)

        # HOOKS feature: the first chunk (index 0) is the attention hook. It
        # receives a cinematic hook plan (dolly zoom + lens blur + directional
        # blur + motion blur) layered over its typography treatment. The plan
        # is computed dynamically from design intensity, word count, and the
        # brand zone — never hardcoded.
        hook_plan = None
        if idx == 0:
            try:
                from . import hooks
                hook_plan = hooks.plan_hook_treatment(
                    chunk_index=idx,
                    chunk_text=raw_text,
                    design=design_input,
                    brand_palette=video_palette,
                )
            except Exception as exc:  # never let the hook break the render
                print(f"[typography] hook plan skipped: {exc}", flush=True)
        if hook_plan is not None:
            # Hook chunks lead with the dynamically planned cinematic hook treatment.
            hero_fx_preset = hook_plan.get("hookType") or "hook_cinematic_dolly_zoom"
            preset_usage_counts[hero_fx_preset] = preset_usage_counts.get(hero_fx_preset, 0) + 1

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

        prof_name_lower = prof.get("profile_name", "").lower()
        is_see_through = "see_through" in prof.get("metadata", {}).get("treatment_system", "") or "see_through" in prof_name_lower
        is_3d_extrusion = "3d" in prof.get("metadata", {}).get("overall_mood", "").lower() or "3d" in prof_name_lower

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

            # Authoritative Font Candidate from Font JSON with safe bitmap fallback
            candidates = [resolve_safe_font_candidate(c) for c in layer_spec.get("matched_font_candidates", [])]
            if candidates:
                primary_font = candidates[0]
                accent_font = candidates[1] if len(candidates) > 1 else candidates[0]
            else:
                primary_font = "Playfair Display"
                accent_font = "Playfair Display"

            base_size = int(f_style.get("size_px_base", 50))
            relative_scale = float(f_style.get("relative_scale", 1.0 if is_hero_layer else 0.7))

            # Sensible, readable, professional mobile typography sizing consistency envelope:
            if is_landscape:
                if behind_subject:
                    font_size_px = max(130, min(180, int(base_size * 2.4 * max(0.9, relative_scale))))
                    resolved_weight = int(f_style.get("weight", 900))
                    casing = f_style.get("casing", "uppercase")
                    layer_fx = hero_fx_preset
                    layer_overlay = overlay_fx
                elif is_hero_layer:
                    font_size_px = max(80, min(130, int(base_size * 1.8 * max(0.85, relative_scale))))
                    resolved_weight = int(f_style.get("weight", 800))
                    layer_fx = _resolve_font_json_treatment(prof, layer_spec, is_hero=True, is_single_word=is_single_word, rng=rng, policy=policy)
                    layer_overlay = overlay_fx
                else:
                    font_size_px = max(55, min(75, int(base_size * 1.3 * max(0.7, relative_scale))))
                    resolved_weight = int(f_style.get("weight", 600))
                    layer_fx = _resolve_font_json_treatment(prof, layer_spec, is_hero=False, is_single_word=is_single_word, rng=rng, policy=policy)
                    layer_overlay = None
            elif behind_subject:
                # Towering colossal tall font behind subject in 9:16 portrait (broad billboard span)
                clean_len = max(1, len(raw_layer_text))
                if clean_len <= 5:
                    font_size_px = 320
                elif clean_len <= 8:
                    font_size_px = 280
                else:
                    font_size_px = 245
                resolved_weight = int(f_style.get("weight", 900))
                casing = f_style.get("casing", "uppercase")
                layer_fx = "canva_tall_glyph_stack"
                layer_overlay = overlay_fx
            elif is_hero_layer:
                if is_single_word:
                    # Single-word focal hero (120px–160px)
                    font_size_px = max(120, min(160, int(base_size * 2.5 * max(0.85, relative_scale))))
                else:
                    # Multi-word hero headline (105px–140px)
                    font_size_px = max(105, min(140, int(base_size * 2.2 * max(0.8, relative_scale))))
                resolved_weight = int(f_style.get("weight", 800))
                layer_fx = _resolve_font_json_treatment(prof, layer_spec, is_hero=True, is_single_word=is_single_word, rng=rng, policy=policy)
                layer_overlay = overlay_fx
            else:
                # Companion / secondary subtitle line (consistent, readable floor: 65px–90px)
                font_size_px = max(65, min(90, int(base_size * 1.8 * max(0.65, relative_scale))))
                resolved_weight = int(f_style.get("weight", 600))
                layer_fx = _resolve_font_json_treatment(prof, layer_spec, is_hero=False, is_single_word=is_single_word, rng=rng, policy=policy)
                layer_overlay = None

            raw_color = f_style.get("color")
            layer_effects = layer_spec.get("effects", {})
            style_treatment = resolve_layer_gradient_and_glow(
                prof["profile_name"],
                role,
                raw_color,
                is_hero_layer,
                brand_palette=chunk_palette,
                layer_effects=layer_effects,
                explicit_user_override=bool(explicit_palette_id),
                background_luminance=0.15,  # default dark video background
            )

            if is_see_through:
                layer_fx = "see_through_glass_letterform"
                style_treatment["textFillColor"] = f_style.get("color", "rgba(232, 196, 160, 0.76)")
                style_treatment["shadow"] = "none"
                style_treatment["glow"] = "none"
                style_treatment["hasGradient"] = False
            elif is_3d_extrusion and is_hero_layer:
                layer_fx = "metallic_chrome_countup_hero"
                style_treatment["shadow"] = "1px 1px 0 #0055b3, 2px 2px 0 #004499, 3px 3px 0 #003380, 4px 4px 0 #002266, 0 8px 24px rgba(0, 102, 255, 0.85)"

            letter_spacing = float(f_style.get("letter_spacing_em", 0.01))
            if is_single_word and is_hero_layer:
                letter_spacing = max(0.04, letter_spacing)

            vertical_margin_top = int(f_style.get("vertical_margin_top_px", 0))
            if vertical_margin_top < 0:
                # Proportional negative margin clamp: max -20% of font size to prevent overlapping collision
                margin_top_px = max(-int(font_size_px * 0.20), int(vertical_margin_top * 0.40))
            elif vertical_margin_top > 0:
                margin_top_px = min(int(font_size_px * 0.25), int(vertical_margin_top * 0.80))
            else:
                margin_top_px = 0

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
                "marginTopPx": margin_top_px,
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
                "doubleUnderline": bool(layer_effects.get("double_underline", False)),
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
            "hookPlan": hook_plan,
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
                "yPercent": "10%" if behind_subject else "68%",
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

    difference_chunk_indices = _select_difference_chunk_indices(
        manifest_chunks,
        rng,
        creativity=policy.get("creativity", "balanced"),
    )
    for position in difference_chunk_indices:
        chunk = manifest_chunks[position]
        chunk["selection"]["blendMode"] = "difference"
        for layer in chunk["layers"]:
            layer.update({
                "blendMode": "difference",
                "color": "#FFFFFF",
                "gradient": "none",
                "glow": "none",
                "shadow": "none",
                "textFillColor": "#FFFFFF",
                "hasGradient": False,
                "doubleUnderline": False,
            })

    font_manifest = {
        "composition": "JosephLandscapeEdit" if is_landscape else "PrometheusMinRun",
        "canvas": {
            "width": 1920 if is_landscape else 1080,
            "height": 1080 if is_landscape else 1920,
            "aspectRatio": "16:9" if is_landscape else "9:16",
            "backgroundLuminance": float(design_input.get("backgroundLuminance", 0.15)),
        },
        "profileCount": len(profiles),
        "chunkCount": len(manifest_chunks),
        "brandPalette": video_palette,
        "palettePolicy": "explicit" if explicit_palette_id else "balanced_curated_variation",
        "selectionPolicy": policy,
        "selectionMode": selection_mode,
        "selectionSeed": seed_str if selection_mode == "seed" else selection_nonce,
        "selectionNonce": selection_nonce,
        "eligiblePortraitProfileCount": len(profiles),
        "runtimeTreatmentCatalog": [item["id"] for item in ANIMA_RUNTIME_TREATMENTS],
        "chunks": manifest_chunks,
    }
    return font_manifest
