"""Multi-layer editorial graphic typography engine for 9:16 short form content.

Strictly excludes landscape JSONs and executes full multi-layer font pairing,
faithful gradient & glow realization, and mid-section stage placement.
"""

from __future__ import annotations

import os
import re
import json
import glob
import random
import secrets
import datetime
import hashlib
import string
from pathlib import Path
from typing import Any, Dict, List, Optional

from .motif import resolve_brand_motif, motif_to_brand_palette
from . import listicles
from . import typography_catalog as _catalog

FONT_JSON_DIR = Path(__file__).resolve().parent.parent / "Yuan Prometheus Screenshots" / "font JSON"
FONT_PAIRS_DIR = Path(__file__).resolve().parent.parent / "Yuan Prometheus Screenshots" / "font pairing and placement"
CRANIAL_FONT_JSON_DIR = Path(__file__).resolve().parent.parent / "Yuan Prometheus Screenshots" / "cranial font JSON"
CRANIAL_PLACEMENT_DIR = Path(__file__).resolve().parent.parent / "Yuan Prometheus Screenshots" / "cranial font placement"
OPT_FONT_DIR = Path("/opt/prometheus/Yuan Prometheus Screenshots/font JSON")
OPT_PAIRS_DIR = Path("/opt/prometheus/Yuan Prometheus Screenshots/font pairing and placement")

V2_CATALOG_FILE = Path(__file__).resolve().parent / "typography_profiles_v2_catalog.json"
OPT_V2_CATALOG_FILE = Path("/opt/prometheus/mini_run_pipeline/typography_profiles_v2_catalog.json")

_V2_CATALOG_CACHE: Optional[Dict[str, Any]] = None
_V2_LOOKUP_CACHE: Optional[Dict[str, Dict[str, Any]]] = None


def load_typography_profiles_v2_catalog() -> Dict[str, Any]:
    """Load and cache the canonical TypographyProfileV2 catalog."""
    global _V2_CATALOG_CACHE, _V2_LOOKUP_CACHE
    if _V2_CATALOG_CACHE is not None:
        return _V2_CATALOG_CACHE

    candidates = [
        V2_CATALOG_FILE,
        Path(__file__).resolve().parent.parent / "mini_run_pipeline" / "typography_profiles_v2_catalog.json",
        OPT_V2_CATALOG_FILE,
    ]
    catalog_data: Optional[Dict[str, Any]] = None
    for c in candidates:
        if c.exists():
            try:
                catalog_data = json.loads(c.read_text(encoding="utf-8"))
                break
            except Exception:
                pass
    if catalog_data is None:
        catalog_data = {"version": "typography-profile-v2-catalog-1.0", "totalProfiles": 0, "profiles": []}

    _V2_CATALOG_CACHE = catalog_data
    _V2_LOOKUP_CACHE = {}
    for p in catalog_data.get("profiles", []):
        pid = p.get("profileId", "")
        if pid:
            _V2_LOOKUP_CACHE[pid] = p
            _V2_LOOKUP_CACHE[pid.lower()] = p
            _V2_LOOKUP_CACHE[pid.replace("_", " ").lower()] = p
            _V2_LOOKUP_CACHE[pid.replace(" ", "_").lower()] = p
    return _V2_CATALOG_CACHE


def get_typography_profile_v2_by_id(profile_id: str) -> Optional[Dict[str, Any]]:
    """Look up a TypographyProfileV2 by profile ID or filename stem."""
    load_typography_profiles_v2_catalog()
    if not profile_id or _V2_LOOKUP_CACHE is None:
        return None
    pid = str(profile_id).strip()
    return (
        _V2_LOOKUP_CACHE.get(pid)
        or _V2_LOOKUP_CACHE.get(pid.lower())
        or _V2_LOOKUP_CACHE.get(pid.replace("_", " ").lower())
        or _V2_LOOKUP_CACHE.get(pid.replace(" ", "_").lower())
    )


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
    "silver hairline": "Bodoni Moda",
    "brushelva": "Great Vibes",
    # "amerika" / "amerika alternates" REMOVED from this list: the genuine TTFs are
    # tracked (fonts/library/amerika*/...ttf) and registered below, so the real
    # font renders instead of a legacy Bodoni Moda substitute.
    "kraton": "Bodoni Moda",
    "kraton free font": "Bodoni Moda",
    "kraton modern ligature font free": "Bodoni Moda",
    "erotique alternate trial": "Playfair Display",
    "erotique": "Playfair Display",
}

# Script/calligraphic families whose looped tails hang far below the baseline
# without containing descender letters — negative-margin overlaps into these
# lines read as broken font adjustment, so they get collision clearance too.
SCRIPT_FONT_CLEARANCE_FONTS = {
    "pinyon script", "great vibes", "alex brush", "dancing script",
    "sacramento", "allura", "brushelva", "champignon", "exmouth",
    "bromello", "brotherhood script", "bucklane script", "formale script",
    "senzabella",
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
    "amerika alternates": "Amerika",
    "amerika": "Amerika",
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
    "alex brush": "Alex Brush",
    "alexbrush": "Alex Brush",
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
    "quanton personal use only": "Quanton PERSONAL USE ONLY",
    "quanton": "Quanton PERSONAL USE ONLY",
    "blaak thin personal use": "Blaak Thin PERSONAL USE",
    "blaak": "Blaak Thin PERSONAL USE",
    "foundland italic personal use only": "Foundland Italic PERSONAL USE ONLY",
    "monrovia-modernseriffont": "Monrovia-ModernSerifFont",
    "erotique alternate trial": "Playfair Display",
    "erotique": "Playfair Display",
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
    # --- Commercial / Unbundled Mappings to Loaded Font Faces ----------------
    "neue haas grotesk": "Montserrat",
    "neue haas grotesk display": "Montserrat",
    "helvetica now display": "Montserrat",
    "helvetica now": "Montserrat",
    "helvetica": "Montserrat",
    "haas unica": "Montserrat",
    "haas unica black": "Montserrat",
    "dm serif display": "Playfair Display",
    "didot": "Bodoni Moda",
    "impact": "Anton",
    "lora": "Playfair Display",
    "lora italic": "Playfair Display",
    "kalam": "Dancing Script",
    "caveat": "Sacramento",
    "rozha one": "Abril Fatface",
    "barlow condensed": "Saira Extra Condensed",
    "black han sans": "Anton",
    "im fell english": "Cormorant Garamond",
    "raleway": "Montserrat",
    "lato": "DM Sans",
    "source serif": "Apple Garamond",
    "source sans": "DM Sans",
    "sf pro display": "Montserrat",
    "open sans": "DM Sans",
    "leviathan": "Six Caps",
    # --- user-supplied reference-accurate script fonts (v3 spec corrections) ---
    "exmouth": "Exmouth",
    "champignon": "Champignon",
    "brotherhood script": "Brotherhood Script",
    "brotherhood_script": "Brotherhood Script",
    "bromello": "Bromello",
    "bucklane script": "Bucklane Script",
    "formale script": "Formale Script",
    "cavas": "Cavas",
    # --- user-supplied condensed-fit grotesque (v4 spec corrections) ---
    "asgard fit": "Asgard Fit",
    "asgard": "Asgard Fit",
}

# Families that require an explicit renderer @font-face/Google registration
# (they are NOT in the original all_fonts_dynamic.css import).
REGISTRY_NEEDS_LOAD = {
    "Allura", "Barlow Condensed", "Black Han Sans", "Fraunces", "IM Fell English",
    "Inter", "Kalam", "Lato", "Lora",
    "Open Sans", "Outfit", "Plus Jakarta Sans", "Raleway", "Rozha One",
    "Source Sans", "Source Serif",
    # user-supplied reference-accurate script fonts, loaded locally
    "Exmouth", "Champignon", "Brotherhood Script", "Bromello",
    "Bucklane Script", "Formale Script", "Cavas",
}


def is_serif_font(font_name: str) -> bool:
    f = (font_name or "").lower().strip()
    return any(k in f for k in ("bodoni", "playfair", "garamond", "cinzel", "foglihten", "goudy", "berylium", "abril", "erotique", "serif", "didone", "aesthetic"))


def resolve_safe_font_candidate(candidate: str) -> str:
    """Clean corrupt/low-res bitmap fonts, distorted fonts, and trial/watermark fonts.

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
    # Global trial / demo / watermark ban: never emit trial fonts with missing glyphs or watermarks
    if any(t in c_clean for t in ("trial", "demo", "watermark")):
        return "Playfair Display" if is_serif_font(c_clean) else "Montserrat"
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
    # Clean up non-standard Unicode punctuation that might break decorative fonts
    text = (
        text.replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
        .replace("—", " - ")
        .replace("–", " - ")
    )
    f_lower = font_family.lower()

    # Critical rule: Calligraphic script fonts are NEVER all-caps.
    # All-caps in cursive/script fonts causes colliding flourishes, broken ligatures, and illegible glyphs.
    is_script = any(k in f_lower for k in ("script", "vibes", "brush", "alex", "dancing", "pinyon", "brotherhood", "bromello", "exmouth", "champignon", "bucklane", "formale", "cavas"))
    if is_script:
        if casing in ("uppercase", "all_caps"):
            casing = "title"
        if casing in ("title", "title_case", "capitalize"):
            words = text.split()
            return " ".join(w.capitalize() for w in words)
        if casing == "lowercase":
            return text.lower()
        # Natural title-case fallback for script: first letter capitalized, rest lowercase
        words = text.split()
        if words:
            return words[0].capitalize() + (" " + " ".join(w.lower() for w in words[1:]) if len(words) > 1 else "")
        return text

    # Condensed grotesque display banners look great in uppercase
    if any(k in f_lower for k in ("anton", "bebas", "six caps", "teko", "saira")):
        return text.upper()
    
    # Editorial didone & serif fonts look best in natural casing or title case for multi-word phrases
    if any(k in f_lower for k in ("playfair", "bodoni", "cormorant", "italiana", "garamond", "cinzel")):
        if casing == "uppercase" and len(text.split()) > 1:
            return " ".join(w.capitalize() if w.lower() not in STOPWORDS else w.lower() for w in text.split())

    if casing == "lowercase":
        return text.lower()
    if casing == "uppercase":
        return text.upper()
    if casing in ("title", "title_case", "capitalize"):
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


def _clean_token(w: str) -> str:
    return w.lower().strip(".,!?:;\"'")


def _is_substantive(w: str) -> bool:
    clean = _clean_token(w)
    return bool(clean and clean not in STOPWORDS and len(clean) > 1)


def _find_best_hero_index(word_list: List[str]) -> int:
    """Select the index of the primary content word (prioritizing numeric quantities, then longest/most salient, avoiding short function words)."""
    if not word_list:
        return 0
    # Prioritize words containing digits (e.g. "12,000", "500", "10x")
    num_indices = [i for i, w in enumerate(word_list) if any(ch.isdigit() for ch in _clean_token(w))]
    if num_indices:
        return num_indices[0]

    sub_indices = [i for i, w in enumerate(word_list) if _is_substantive(w)]
    candidates = sub_indices if sub_indices else list(range(len(word_list)))
    return max(candidates, key=lambda i: len(_clean_token(word_list[i])))


def smart_partition_chunk_words(
    words: List[str], profile_layers: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Intelligently partition words across profile layers matching the font profile's hierarchy,
    strictly ensuring small functional words ('are', 'the', 'and', 'is', 'to') NEVER become the hero."""
    token_count = len(words)
    if not profile_layers or token_count <= 1:
        l0 = profile_layers[0] if profile_layers else {}
        is_hero = (
            l0.get("role") in ("primary_focus_word", "hero", "hero_accent_bold", "see_through_hero", "header")
            or float(l0.get("font_style", {}).get("relative_scale", 1.0)) >= 0.75
        )
        # If single token is a stopword and not alone, prevent hero inflation
        if token_count == 1 and not _is_substantive(words[0]):
            is_hero = False
        return [{"layer": l0, "words": words, "is_hero": is_hero}]

    num_layers = len(profile_layers)
    if num_layers == 2:
        l0 = profile_layers[0]
        l1 = profile_layers[1]
        scale0 = float(l0.get("font_style", {}).get("relative_scale", 1.0))
        scale1 = float(l1.get("font_style", {}).get("relative_scale", 0.5))
        l0_is_designed_hero = scale0 > scale1

        if token_count == 2:
            w0_sub = _is_substantive(words[0])
            w1_sub = _is_substantive(words[1])
            w0_num = any(ch.isdigit() for ch in _clean_token(words[0]))
            w1_num = any(ch.isdigit() for ch in _clean_token(words[1]))

            if (w0_num and not w1_num) or (w0_sub and not w1_sub and not w1_num):
                if l0_is_designed_hero:
                    return [
                        {"layer": l0, "words": [words[0]], "is_hero": True},
                        {"layer": l1, "words": [words[1]], "is_hero": False},
                    ]
                else:
                    return [
                        {"layer": l1, "words": [words[0]], "is_hero": True},
                        {"layer": l0, "words": [words[1]], "is_hero": False},
                    ]
            elif (w1_num and not w0_num) or (w1_sub and not w0_sub and not w0_num):
                if l0_is_designed_hero:
                    return [
                        {"layer": l1, "words": [words[0]], "is_hero": False},
                        {"layer": l0, "words": [words[1]], "is_hero": True},
                    ]
                else:
                    return [
                        {"layer": l0, "words": [words[0]], "is_hero": False},
                        {"layer": l1, "words": [words[1]], "is_hero": True},
                    ]
            else:
                if l0_is_designed_hero:
                    return [
                        {"layer": l0, "words": [words[0]], "is_hero": True},
                        {"layer": l1, "words": [words[1]], "is_hero": False},
                    ]
                else:
                    return [
                        {"layer": l0, "words": [words[0]], "is_hero": False},
                        {"layer": l1, "words": [words[1]], "is_hero": True},
                    ]

        elif token_count == 3:
            hero_idx = _find_best_hero_index(words)
            if hero_idx == 0:
                if l0_is_designed_hero:
                    return [
                        {"layer": l0, "words": [words[0]], "is_hero": True},
                        {"layer": l1, "words": words[1:], "is_hero": False},
                    ]
                else:
                    return [
                        {"layer": l1, "words": [words[0]], "is_hero": True},
                        {"layer": l0, "words": words[1:], "is_hero": False},
                    ]
            elif hero_idx == 2:
                if l0_is_designed_hero:
                    return [
                        {"layer": l1, "words": words[:2], "is_hero": False},
                        {"layer": l0, "words": [words[2]], "is_hero": True},
                    ]
                else:
                    return [
                        {"layer": l0, "words": words[:2], "is_hero": False},
                        {"layer": l1, "words": [words[2]], "is_hero": True},
                    ]
            else:
                if l0_is_designed_hero:
                    return [
                        {"layer": l0, "words": words[:2], "is_hero": True},
                        {"layer": l1, "words": [words[2]], "is_hero": False},
                    ]
                else:
                    return [
                        {"layer": l0, "words": [words[0]], "is_hero": False},
                        {"layer": l1, "words": words[1:], "is_hero": True},
                    ]
        else:
            if l0_is_designed_hero:
                split_idx = 1
                while split_idx < token_count - 1 and _is_substantive(words[split_idx]):
                    split_idx += 1
                return [
                    {"layer": l0, "words": words[:split_idx], "is_hero": True},
                    {"layer": l1, "words": words[split_idx:], "is_hero": False},
                ]
            else:
                second_last = _clean_token(words[-2])
                emphatic_modifier = second_last.isdigit() or second_last in (
                    "ten", "two", "three", "four", "five", "full", "best", "real", "hard", "new", "top", "big", "great"
                )
                if token_count >= 4 and (_is_substantive(words[-2]) or emphatic_modifier):
                    split_idx = token_count - 2
                else:
                    split_idx = token_count - 1
                return [
                    {"layer": l0, "words": words[:split_idx], "is_hero": False},
                    {"layer": l1, "words": words[split_idx:], "is_hero": True},
                ]

    # If profile has 3+ layers
    if num_layers >= 3 and token_count <= 5:
        # Conversational dialogue clamp: speech cues <= 5 words must never be chopped into 3-line column stacks.
        # Restrict to the top 2 layers (hero + companion) of the profile.
        l_hero = profile_layers[0]
        l_comp = profile_layers[1] if len(profile_layers) > 1 else profile_layers[0]
        if float(l_comp.get("font_style", {}).get("relative_scale", 1.0)) > float(l_hero.get("font_style", {}).get("relative_scale", 1.0)):
            l_hero, l_comp = l_comp, l_hero
        return smart_partition_chunk_words(words, [l_hero, l_comp])

    if num_layers == 3 and token_count >= 3:
        if token_count == 3:
            hero_word_idx = _find_best_hero_index(words)
            # Identify which layer in profile_layers is the designed hero
            hero_layer_idx = 1
            max_scale = -1.0
            for l_i, l_spec in enumerate(profile_layers):
                role = str(l_spec.get("role", "")).lower()
                scale = float(l_spec.get("font_style", {}).get("relative_scale", 1.0))
                if role in ("primary_focus_word", "hero", "hero_accent_bold", "hero_industry_word"):
                    hero_layer_idx = l_i
                    break
                if scale > max_scale:
                    max_scale = scale
                    hero_layer_idx = l_i

            allocations = [None, None, None]
            allocations[hero_layer_idx] = {
                "layer": profile_layers[hero_layer_idx],
                "words": [words[hero_word_idx]],
                "is_hero": True,
            }
            other_words = [words[i] for i in range(3) if i != hero_word_idx]
            other_layer_indices = [i for i in range(3) if i != hero_layer_idx]
            for o_layer_idx, o_word in zip(other_layer_indices, other_words):
                allocations[o_layer_idx] = {
                    "layer": profile_layers[o_layer_idx],
                    "words": [o_word],
                    "is_hero": False,
                }
            return allocations
        elif token_count == 4:
            hero_idx = _find_best_hero_index(words)
            if hero_idx in (1, 2):
                return [
                    {"layer": profile_layers[0], "words": [words[0]], "is_hero": False},
                    {"layer": profile_layers[1], "words": words[1:3], "is_hero": True},
                    {"layer": profile_layers[2], "words": [words[3]], "is_hero": False},
                ]
            elif hero_idx == 3:
                return [
                    {"layer": profile_layers[0], "words": [words[0]], "is_hero": False},
                    {"layer": profile_layers[1], "words": words[1:3], "is_hero": False},
                    {"layer": profile_layers[2], "words": [words[3]], "is_hero": True},
                ]
            else:
                return [
                    {"layer": profile_layers[0], "words": [words[0]], "is_hero": True},
                    {"layer": profile_layers[1], "words": words[1:3], "is_hero": False},
                    {"layer": profile_layers[2], "words": [words[3]], "is_hero": False},
                ]
        else:
            mid_start = max(1, token_count // 3)
            while mid_start < token_count - 2 and not _is_substantive(words[mid_start]):
                mid_start += 1
            mid_end = min(token_count - 1, mid_start + 2)
            if mid_end <= mid_start:
                mid_end = mid_start + 1
            return [
                {"layer": profile_layers[0], "words": words[:mid_start], "is_hero": False},
                {"layer": profile_layers[1], "words": words[mid_start:mid_end], "is_hero": True},
                {"layer": profile_layers[2], "words": words[mid_end:], "is_hero": False},
            ]

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
        # Ensure layer with only stopwords is not hero if other layers exist
        if is_hero and all(not _is_substantive(w) for w in layer_words) and len(words) > len(layer_words):
            is_hero = False
        allocations.append({"layer": layer, "words": layer_words or [words[-1]], "is_hero": is_hero})
    return allocations

# ---------------------------------------------------------------------------
# Brand Style & Palette Ingestion System
# ---------------------------------------------------------------------------
BRAND_PALETTES: Dict[str, Dict[str, str]] = {
    "champagne_gold": {
        "hero_color": "#F5E6C4",
        "companion_color": "#FFFFFF",
        "glow": "0 0 14px rgba(245, 230, 196, 0.35)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.55)",
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
        "glow": "0 0 14px rgba(255, 69, 58, 0.35)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.55)",
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
    "crimson_editorial": {
        "hero_color": "#FF2A55",
        "companion_color": "#FFFFFF",
        "glow": "0 0 14px rgba(255, 42, 85, 0.35)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.55)",
        "accent_border": "#E11D48",
        "zone": {
            "name": "crimson_editorial",
            "primary": "#FF2A55",
            "accent": "#E11D48",
            "base": "#FFFFFF",
            "keyword": "#FF2A55",
            "glow_rgb": "255, 42, 85",
        },
    },
    "electric_cyan": {
        "hero_color": "#00F0FF",
        "companion_color": "#FFFFFF",
        "glow": "0 0 14px rgba(0, 240, 255, 0.35)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.55)",
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
        "glow": "0 0 14px rgba(52, 211, 153, 0.35)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.55)",
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
        "glow": "0 0 14px rgba(192, 132, 252, 0.35)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.55)",
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
        "glow": "0 0 14px rgba(251, 191, 36, 0.35)",
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.55)",
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
        "shadow": "0 2px 10px rgba(0, 0, 0, 0.55)",
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

    # Creator-first editorial distribution:
    # Top-tier creators standardise on pure white text (#FFFFFF) as the primary base (~70%),
    # paired with high-contrast iridescent/beveled crimson/red for emphasis (~25%), avoiding
    # repetitive candy-color spam.
    BASE_PALETTE_WEIGHTS = {
        "pure_editorial_mono": 7.0,
        "crimson_editorial": 2.5,
        "champagne_gold": 0.5,
    }
    candidates = [
        p for p in BASE_PALETTE_WEIGHTS
        if (p == "pure_editorial_mono" and recent[-3:].count("pure_editorial_mono") < 3)
        or (p != "pure_editorial_mono" and (not recent or recent[-1] != p))
    ] or list(BASE_PALETTE_WEIGHTS.keys())
    weights = [
        (BASE_PALETTE_WEIGHTS[c] / (1.0 + usage.get(c, 0) * 0.8))
        for c in candidates
    ]
    palette_id = _weighted_choice(rng, candidates, weights)
    return palette_id, BRAND_PALETTES[palette_id].copy()


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

# Clean, modern, supportive companion fonts (geometric and grotesque sans) that never clash with hero serifs/scripts
COMPANION_UPGRADE_FONTS = [
    "Montserrat",
    "Outfit",
    "DM Sans",
    "Altone",
    "Pathway Extreme",
]

GENERIC_FALLBACK_FONTS = {"sans-serif", "serif", "system-ui", "arial", "helvetica", ""}


def is_serif_font(font_name: str) -> bool:
    f = (font_name or "").lower().strip()
    return any(k in f for k in ("bodoni", "playfair", "garamond", "cinzel", "foglihten", "goudy", "berylium", "abril", "erotique", "serif", "didone", "aesthetic"))


SCRIPT_FONT_KEYWORDS = (
    "script", "vibes", "brush", "pinyon", "dancing", "candle", "freebooter",
    "darling", "flourish", "cursive", "exmouth", "champignon", "brotherhood",
    "bromello", "bucklane", "formale", "cavas", "alex", "sacramento", "allura",
    "brushelva", "handwriting", "calligraphic", "calligraphy", "kraton"
)


# Decorative display, alternates, and trial faces strictly barred from companion/modifier tiers
DECORATIVE_BARRED_COMPANION_FONTS = {
    "amerika alternates",
    "erotique alternate trial",
    "erotique",
    "quanton",
    "quanton personal use only",
    "blaak",
    "blaak thin personal use",
    "foundland",
    "foundland italic personal use only",
    "aulion demo",
    "aulion",
    "aesthico",
    "aesthico (demo)",
    "the glamoure",
    "black delights",
    "bellavoir serif",
    "bellavoirserif",
    "candlescript",
    "candle script",
    "candlescript demo version",
    "freebooter script",
    "freebooter",
    "freebooter_script",
    "grand cru",
    "grandcru",
    "zt otez",
    "migra",
    "elegist",
    "vogue",
    "antenna",
    "abril fatface",
}

BARRED_COMPANION_KEYWORDS = (
    "alternate", "alternates", "trial", "demo", "watermark", "personal use",
    "erotique", "quanton", "blaak", "foundland", "aulion", "aesthico",
    "the glamoure", "black delights", "bellavoir", "candlescript",
    "freebooter", "grand cru", "grandcru", "zt otez", "migra", "elegist",
    "vogue", "antenna", "abril fatface"
)


def is_barred_companion_font(font_name: str) -> bool:
    f = (font_name or "").lower().strip()
    if not f:
        return False
    if f in DECORATIVE_BARRED_COMPANION_FONTS:
        return True
    return any(k in f for k in BARRED_COMPANION_KEYWORDS)


def is_script_font(font_name: str) -> bool:
    f = (font_name or "").lower().strip()
    return any(k in f for k in SCRIPT_FONT_KEYWORDS)


def upgrade_font_candidate(font_name: str, is_hero: bool, role: str = "body", rng: Optional[random.Random] = None, hero_font: str = "") -> str:
    """Upgrade truly generic/empty fallback fonts while strictly respecting font JSON parents.

    Guarantees strict font policies:
    - If font_name is a valid font from the profile, it is strictly preserved on hero layers.
    - SCRIPT & DECORATIVE BAN ON SECONDARY TIERS: Script and decorative calligraphic fonts
      are strictly banned on all secondary/companion tiers (not is_hero) regardless of word length.
    - If a companion font clashes with the hero (e.g. Serif + Serif or Script + Script),
      re-anchors the companion to a clean supportive Sans (Montserrat/Outfit/DM Sans)
      so the hero word remains the clean, uncluttered visual focus.
    """
    _rng = rng or random.Random()
    f_clean = (font_name or "").lower().strip()

    # Only replace truly unstyled generic fallbacks
    if f_clean in GENERIC_FALLBACK_FONTS or not font_name:
        if is_hero:
            return _rng.choice(HERO_UPGRADE_FONTS)
        else:
            return _rng.choice(COMPANION_UPGRADE_FONTS)

    # Companion-tier script & decorative font ban:
    if not is_hero:
        if is_script_font(font_name) or f_clean in UNSAFE_DISTORTED_FONTS or is_barred_companion_font(font_name):
            return _rng.choice(COMPANION_UPGRADE_FONTS)

    # Anti-clash policy: if this is a companion layer, ensure it never clashes with the hero font
    if not is_hero and hero_font:
        hero_is_serif = is_serif_font(hero_font)
        hero_is_script = is_script_font(hero_font)
        cand_is_serif = is_serif_font(font_name)
        cand_is_script = is_script_font(font_name)

        if (hero_is_serif and cand_is_serif and font_name != hero_font) or (hero_is_script and cand_is_script) or (hero_is_script and cand_is_serif):
            return _rng.choice(COMPANION_UPGRADE_FONTS)

    return font_name


# Authoritative per-font character width-to-height aspect ratio table
FONT_CHAR_ASPECT_TABLE: Dict[str, float] = {
    # Ultra-condensed
    "six caps": 0.28,
    "saira extra condensed": 0.34,
    "saira": 0.38,
    "teko": 0.36,
    "league gothic": 0.38,
    # Condensed grotesque / display
    "anton": 0.40,
    "bebas neue": 0.38,
    "bebas": 0.38,
    "oswald": 0.42,
    "antenna": 0.42,
    "senzabella": 0.44,
    "echelon": 0.42,
    # Wide display serifs
    "bodoni moda": 0.64,
    "playfair display": 0.65,
    "cinzel": 0.66,
    "abril fatface": 0.68,
    "berylium": 0.58,
    # Classic / editorial serifs
    "apple garamond": 0.52,
    "cormorant garamond": 0.52,
    "goudy bookletter": 0.50,
    "fraunces": 0.58,
    # Clean modern sans
    "montserrat": 0.56,
    "outfit": 0.54,
    "dm sans": 0.52,
    "altone": 0.54,
    "pathway extreme": 0.52,
    "inter": 0.52,
    "space mono": 0.60,
    "amerika": 0.54,
}


def get_font_char_aspect(font_name: str, is_uppercase: bool = False) -> float:
    """Return character width-to-height aspect ratio using the authoritative aspect table."""
    f_clean = (font_name or "").lower().strip()
    base_aspect = 0.54
    for key, ratio in FONT_CHAR_ASPECT_TABLE.items():
        if key in f_clean:
            base_aspect = ratio
            break
    else:
        if is_script_font(font_name):
            base_aspect = 0.50
        elif is_serif_font(font_name):
            base_aspect = 0.62

    return round(base_aspect * (1.32 if is_uppercase else 1.0), 3)


def estimate_layer_width_px(text: str, font_name: str, font_size_px: float, is_uppercase: bool = False) -> float:
    """Accurately estimate rendered width in pixels."""
    if not text:
        return 0.0
    aspect = get_font_char_aspect(font_name, is_uppercase=is_uppercase)
    return round(len(text) * font_size_px * aspect, 1)


def preflight_and_fit_layer_widths(
    layers_info: List[Dict[str, Any]],
    max_safe_width: float = 820.0,
) -> None:
    """Chunk-level width preflight: largest-first shrink with legibility floors.

    - Companion floor: 50px
    - Hero floor: 80px (or script floor if script font)
    - If a layer's estimated width exceeds max_safe_width, shrink largest layer first
      until it fits or hits its legibility floor.
    """
    for layer in layers_info:
        text = layer.get("rawText", "")
        font = layer.get("primary_font") or layer.get("fontFamily", "")
        is_upper = layer.get("is_upper", False) or layer.get("casing") == "uppercase" or text.isupper()
        is_hero = layer.get("is_hero_layer", False) or layer.get("isHero", False)
        is_script = layer.get("is_script", False) or is_script_font(font)
        is_spencerian = layer.get("is_spencerian", False) or any(s in font.lower() for s in ("exmouth", "champignon", "brotherhood"))

        if is_spencerian:
            legibility_floor = 115
        elif is_script:
            legibility_floor = 80
        elif is_hero:
            legibility_floor = 80
        else:
            legibility_floor = 50

        layer["legibility_floor"] = legibility_floor
        aspect = get_font_char_aspect(font, is_uppercase=is_upper)
        layer["char_aspect"] = aspect
        current_size = layer.get("font_size_px") or layer.get("fontSizePx", 60)
        layer["font_size_px"] = current_size
        est_width = len(text) * current_size * aspect
        layer["est_width"] = est_width

    # Largest-first iterative shrink for any layer exceeding max_safe_width
    while True:
        overflowing = [
            l for l in layers_info
            if l.get("est_width", 0) > max_safe_width and l["font_size_px"] > l["legibility_floor"]
        ]
        if not overflowing:
            break
        # Sort descending by current font size (largest first)
        overflowing.sort(key=lambda l: l["font_size_px"], reverse=True)
        target = overflowing[0]
        # Calculate size needed to fit
        needed_size = int(max_safe_width / (max(1, len(target.get("rawText", ""))) * target["char_aspect"]))
        target["font_size_px"] = max(target["legibility_floor"], min(target["font_size_px"] - 1, needed_size))
        if "fontSizePx" in target:
            target["fontSizePx"] = target["font_size_px"]
        target["est_width"] = len(target.get("rawText", "")) * target["font_size_px"] * target["char_aspect"]


# High-tier, vetted editorial kinetic preset repertoire
KINETIC_HERO_PRESETS = [
    "focus_hunting_bokeh_shimmer",
    "spring_blur_physics_engine",
    "kinetic_slot_character_reel",
    "apple_keynote_headline_punch",
    "apple_pro_display_hero_revealer",
    "dynamic_staggered_character_cascade",
    "cinematic_viewport_mask_sweep",
    "obsidian_heavy_grotesque",
    "gold_gradient_scale_blur",
    "refraction_shimmer_mask",
    "stagger_blur_word_reveal",
    "typewriter_cursor",
    "cyan_swoosh_underline",
    "chromatic_aberration_wipe",
    "blue_blur_underline_reveal",
    "dramatic_scale_entry",
    "word_by_word_3d_flip",
]

SINGLE_WORD_HERO_PRESETS = [
    "gold_gradient_scale_blur",
    "refraction_shimmer_mask",
    "cyan_swoosh_underline",
    "chromatic_aberration_wipe",
    "blue_blur_underline_reveal",
    "dramatic_scale_entry",
    "focus_hunting_bokeh_shimmer",
    "kinetic_slot_character_reel",
    "spring_blur_physics_engine",
    "obsidian_heavy_grotesque",
    "blue_lantern_magnetic",
    "chiseled_prism_metallic",
    "prism_chisel_hard_bevel",
]


def load_all_font_json_profiles(include_landscape: bool = False) -> List[Dict[str, Any]]:
    """Load font JSON profiles via the unified typography_catalog.

    Landscape (16:9): Full Admin Access — entire corpus (77+ portrait + landscape profiles).
    Mini Runs (9:16): Restricted Access — strictly excludes landscape profiles.

    All profile hydration (pairing, wall_man_z_plane filtering, cranial merge) is
    performed inside typography_catalog.build_catalog(); this function is now a
    thin delegation wrapper so callers see zero API change.
    """
    catalog = _catalog.build_catalog(include_landscape=include_landscape)
    if include_landscape:
        return [p.as_legacy_dict() for p in catalog.all_profiles()]
    return [p.as_legacy_dict() for p in catalog.portrait_profiles]


def load_all_cranial_font_json_profiles() -> List[Dict[str, Any]]:
    """Load all authoritative Cranial Font JSON profiles via the unified catalog."""
    return _catalog.get_all_cranial_profiles()


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


def build_volumetric_luminance_gradient(
    color_val: Optional[str],
    role: str = "hero",
    angle_deg: int = 180,
) -> str:
    """Build a 6-stop convex physical luminance gradient for illuminated 3D typography.

    Simulates an angled overhead key light striking a domed/cylindrical letterform:
    1. Specular rim (0%): bright highlight / chamfer light catch (#FFFFFF)
    2. Keylight transition (10%): desaturated bright tint
    3. Crown highlight (24%): convex pillowing peak
    4. Saturated core body (58%): full vibrant tone
    5. Inner shadow crevice (88%): deeper shadow in letter folds
    6. Ground bounce reflection (100%): subtle bounce backplate
    """
    if not color_val:
        return "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 35%, #EDECE9 70%, #DCD7CD 100%)"

    parsed = parse_color_to_rgba(color_val)
    if parsed is None:
        return "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 35%, #EDECE9 70%, #DCD7CD 100%)"

    r, g, b, _ = parsed
    # If pure or near white:
    if r >= 235 and g >= 235 and b >= 235:
        return (
            f"linear-gradient({angle_deg}deg, #FFFFFF 0%, #FAFBFD 20%, "
            f"#F1F5F9 45%, #E2E8F0 72%, #CBD5E1 100%)"
        )

    # Compute 6-stop physical illumination stops
    rim_r = min(255, int(255 * 0.88 + r * 0.12))
    rim_g = min(255, int(255 * 0.88 + g * 0.12))
    rim_b = min(255, int(255 * 0.88 + b * 0.12))
    rim_hex = f"#{rim_r:02X}{rim_g:02X}{rim_b:02X}"

    key_r = min(255, int(255 * 0.58 + r * 0.42))
    key_g = min(255, int(255 * 0.58 + g * 0.42))
    key_b = min(255, int(255 * 0.58 + b * 0.42))
    key_hex = f"#{key_r:02X}{key_g:02X}{key_b:02X}"

    crown_r = min(255, int(255 * 0.28 + r * 0.72))
    crown_g = min(255, int(255 * 0.28 + g * 0.72))
    crown_b = min(255, int(255 * 0.28 + b * 0.72))
    crown_hex = f"#{crown_r:02X}{crown_g:02X}{crown_b:02X}"

    core_hex = f"#{r:02X}{g:02X}{b:02X}"

    # Shadow crevice: deep saturation and ~50% luminance
    shadow_r = max(0, int(r * 0.50))
    shadow_g = max(0, int(g * 0.50))
    shadow_b = max(0, int(b * 0.50))
    shadow_hex = f"#{shadow_r:02X}{shadow_g:02X}{shadow_b:02X}"

    # Ground bounce: slightly lifted from deepest shadow
    bounce_r = max(0, min(255, int(r * 0.62)))
    bounce_g = max(0, min(255, int(g * 0.62)))
    bounce_b = max(0, min(255, int(b * 0.62)))
    bounce_hex = f"#{bounce_r:02X}{bounce_g:02X}{bounce_b:02X}"

    return (
        f"linear-gradient({angle_deg}deg, #FFFFFF 0%, {rim_hex} 10%, "
        f"{key_hex} 24%, {crown_hex} 40%, {core_hex} 58%, "
        f"{shadow_hex} 88%, {bounce_hex} 100%)"
    )


def clamp_glow_alpha(glow_str: str, max_alpha: float = 0.35) -> str:
    """Clamp the opacity of RGBA or 8-digit hex color stops in a glow string to max_alpha."""
    if not glow_str or glow_str == "none":
        return "none"

    def _sub_rgba(m):
        r, g, b = m.group(1), m.group(2), m.group(3)
        try:
            a = float(m.group(4))
            a_clamped = min(a, max_alpha)
            return f"rgba({r}, {g}, {b}, {a_clamped:.2f})"
        except ValueError:
            return m.group(0)

    res = re.sub(r"rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d\.]+)\s*\)", _sub_rgba, glow_str)

    def _sub_hex8(m):
        h = m.group(1)
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        a = int(h[6:8], 16) / 255.0
        a_clamped = min(a, max_alpha)
        return f"rgba({r}, {g}, {b}, {a_clamped:.2f})"

    res = re.sub(r"#([0-9a-fA-F]{8})\b", _sub_hex8, res)
    return res


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

    # 1b. Material semantics from corrected font JSON specs (v3):
    #     metallic_chrome / luminance_gradient / specular_sweep / matte_editorial.
    material_gradient: Optional[str] = None
    material_glow: Optional[str] = None
    material_shadow: Optional[str] = None
    material_matte = False

    def _hex_to_rgb(c: str) -> tuple:
        c = str(c).strip().lstrip("#")
        if len(c) == 3:
            c = "".join(ch * 2 for ch in c)
        try:
            return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))
        except (ValueError, IndexError):
            return (255, 255, 255)

    def _darken(c: str, f: float = 0.32) -> str:
        r, g, b = _hex_to_rgb(c)
        return "#{:02X}{:02X}{:02X}".format(int(r * f), int(g * f), int(b * f))

    chrome = layer_effects.get("metallic_chrome")
    if isinstance(chrome, dict):
        stops = chrome.get("stops") or ["#8A5A2B", "#C98A4B", "#E8D9C0", "#FFFFFF", "#B9BEC9"]
        angle = chrome.get("angle", 105)
        band = chrome.get("specular_band") or {}
        pos = float(band.get("position", 0.62))
        width = float(band.get("width", 0.2)) / 2 * 100
        body = ", ".join(f"{c} {int(i * 100 / (len(stops) - 1))}%" for i, c in enumerate(stops))
        tail = stops[-1]
        material_gradient = (
            f"linear-gradient({angle}deg, {body}, #FFFFFF {max(0.0, pos * 100 - width):.0f}%, "
            f"{tail} {min(100.0, pos * 100 + width):.0f}%)"
        )
        material_shadow = "0 2px 10px rgba(0, 0, 0, 0.55)"

    lum = layer_effects.get("luminance_gradient")
    if isinstance(lum, dict):
        low = lum.get("low") or _darken(str(raw_color or "#93C5E8"))
        high = lum.get("high") or "#FFFFFF"
        layers_bg = [f"linear-gradient(178deg, {low} 0%, {low} 38%, #FFFFFF 62%, {high} 80%)"]
        sweep = layer_effects.get("specular_sweep")
        if isinstance(sweep, dict):
            s_angle = sweep.get("angle", 115)
            s_width = float(sweep.get("width", 0.22)) * 50
            s_intensity = float(sweep.get("intensity", 0.9))
            layers_bg.insert(0, (
                f"linear-gradient({s_angle}deg, rgba(255,255,255,0) "
                f"{50 - s_width:.0f}%, rgba(255,255,255,{s_intensity}) 50%, "
                f"rgba(255,255,255,0) {50 + s_width:.0f}%)"
            ))
        material_gradient = ", ".join(layers_bg)
        g = layer_effects.get("glow")
        if isinstance(g, dict) and is_hero:
            raw_mat_g = f"0 0 {int(g.get('radius', 26))}px {g.get('color', 'rgba(205, 230, 255, 0.35)')}"
            material_glow = clamp_glow_alpha(raw_mat_g, 0.35)
        else:
            material_glow = "none"
        material_shadow = "none"

    if isinstance(layer_effects.get("matte_editorial"), dict) and \
            layer_effects["matte_editorial"].get("enabled"):
        material_matte = True
        material_gradient = None
        material_glow = "none"
        material_shadow = "none"

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

    # 2. Manifest-level shadow and glow subtraction:
    # Single contact shadow per layer; triple-shadow default removed.
    # Glow: heroes-only (if is_hero), motif-derived, alpha <= 0.35; companions get "none".
    is_light_bg = background_luminance is not None and background_luminance > 0.55
    if is_light_bg:
        shadow = "0 1px 4px rgba(0, 0, 0, 0.20)"
        glow = "none"
    else:
        ds = layer_effects.get("drop_shadow")
        if isinstance(ds, dict):
            blur = ds.get("blur_radius", 10)
            shadow = f"0 2px {blur}px rgba(0, 0, 0, 0.55)"
        else:
            shadow = "0 2px 10px rgba(0, 0, 0, 0.55)"

        if not is_hero:
            glow = "none"
        else:
            custom_glow = layer_effects.get("glow")
            if isinstance(custom_glow, str):
                glow = custom_glow
            else:
                glow = brand_palette.get("glow") or f"0 0 14px rgba(255, 255, 255, 0.30)"
            glow = clamp_glow_alpha(glow, 0.35)

    # 4. Volumetric Shading & Gradient resolution (never flat 2D silhouettes):
    if material_gradient is not None:
        gradient = material_gradient
        has_gradient = True
    else:
        GRADIENT_MAP = {
            "champagne_gold": "linear-gradient(180deg, #FFFFFF 0%, #FEF08A 10%, #FDE047 24%, #FBBF24 55%, #854D0E 88%, #A16207 100%)",
            "obsidian_crimson": "linear-gradient(180deg, #FFFFFF 0%, #FFE4E6 10%, #FDA4AF 24%, #FF453A 55%, #881337 88%, #9F1239 100%)",
            "crimson_editorial": "linear-gradient(180deg, #FFFFFF 0%, #FFE4E6 10%, #FDA4AF 24%, #FF2A55 55%, #881337 88%, #9F1239 100%)",
            "electric_cyan": "linear-gradient(180deg, #FFFFFF 0%, #CFFAFE 10%, #A5F3FC 24%, #00F0FF 55%, #0E7490 88%, #0891B2 100%)",
            "emerald_luxury": "linear-gradient(180deg, #FFFFFF 0%, #D1FAE5 10%, #A7F3D0 24%, #34D399 55%, #064E3B 88%, #047857 100%)",
            "royal_amethyst": "linear-gradient(180deg, #FFFFFF 0%, #F5EBFF 10%, #E0BFFC 24%, #C084FC 55%, #603099 88%, #783CAE 100%)",
            "sunset_amber": "linear-gradient(180deg, #FFFFFF 0%, #FEF08A 10%, #FDE047 24%, #FF8C00 55%, #7C2D12 88%, #9A3412 100%)",
            "pure_editorial_mono": "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 15%, #F1F5F9 35%, #E2E8F0 65%, #94A3B8 88%, #CBD5E1 100%)",
        }

        if isinstance(layer_effects.get("gradient"), str):
            gradient = layer_effects["gradient"]
            has_gradient = True
        elif brand_palette.get("volumetric_gradient") and is_hero:
            gradient = brand_palette["volumetric_gradient"]
            has_gradient = True
        elif brand_palette.get("companion_gradient") and not is_hero:
            gradient = brand_palette["companion_gradient"]
            has_gradient = True
        elif palette_id in GRADIENT_MAP and is_hero:
            gradient = GRADIENT_MAP[palette_id]
            has_gradient = True
        elif not is_light_bg:
            # Physical volumetric illumination derived from text color
            gradient = build_volumetric_luminance_gradient(text_fill_color, role="hero" if is_hero else "companion")
            has_gradient = True
        elif is_hero:
            # Heroes never render as flat CSS fill, even over bright footage:
            # the specular/volumetric treatment is what makes them read as
            # designed type rather than a plain subtitle.
            gradient = build_volumetric_luminance_gradient(text_fill_color, role="hero")
            has_gradient = True
        else:
            gradient = "none"
            has_gradient = False

    raw_v_grad = layer_effects.get("vertical_gradient") or layer_effects.get("verticalGradient")
    vertical_grad = None
    if raw_v_grad and isinstance(raw_v_grad, str):
        v_low = raw_v_grad.lower()
        is_dark_v_grad = any(k in v_low for k in ("#000000", "#111111", "#0f172a", "#1e293b", "rgba(0, 0, 0", "rgba(17, 17, 17", "rgb(0, 0, 0", "rgb(17, 17, 17"))
        if is_dark_v_grad and not is_light_bg:
            vertical_grad = f"linear-gradient(180deg, {text_fill_color} 0%, {text_fill_color} 35%, rgba(255, 255, 255, 0.20) 80%, transparent 100%)"
        else:
            vertical_grad = raw_v_grad

    if material_matte:
        return {
            "gradient": "none",
            "verticalGradient": vertical_grad,
            "glow": "none",
            "shadow": "none",
            "textFillColor": text_fill_color,
            "hasGradient": False,
            "specularChamfer": False,
            "volumetricShading": False,
        }

    air_frontal = (
        layer_effects.get("air_frontal_optical_bloom")
        or layer_effects.get("in_the_air_diffusion_bloom")
        or layer_effects.get("optical_bloom")
        or "air_frontal" in profile_name.lower()
    )

    base_res = {
        "gradient": gradient,
        "verticalGradient": vertical_grad or gradient,
        "glow": "none" if not is_hero else (clamp_glow_alpha(material_glow, 0.35) if material_glow is not None else glow),
        "shadow": material_shadow if material_shadow is not None else shadow,
        "textFillColor": text_fill_color,
        "hasGradient": (has_gradient and gradient != "none") or bool(vertical_grad),
        "specularChamfer": True,
        "specularSheen": True,
        "specularAngle": -35,
        "volumetricShading": True,
        "contactShadow": material_shadow if material_shadow is not None else shadow,
        "ambientShadow": "none",
        "opticalBleed": glow if is_hero else "none",
    }

    chiseled = (
        layer_effects.get("chiseled_prism_metallic")
        or layer_effects.get("prism_chisel_hard_bevel")
        or layer_effects.get("chiseled_prism")
        or "chiseled" in profile_name.lower()
        or "prism" in profile_name.lower()
    )

    if air_frontal:
        base_res.update({
            "gradient": "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 35%, #EDECE9 70%, #DCD7CD 100%)",
            "verticalGradient": "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 35%, #EDECE9 70%, #DCD7CD 100%)",
            "hasGradient": True,
            "glow": "none" if not is_hero else "drop-shadow(0 0 10px rgba(255, 255, 255, 0.35)) drop-shadow(0 0 22px rgba(255, 250, 240, 0.25))",
            "shadow": "0 0 28px rgba(0, 0, 0, 0.45), 0 2px 14px rgba(0, 0, 0, 0.38), 0 0 6px rgba(0, 0, 0, 0.30)",
            "opticalBloom": True,
            "edgeFeatherPx": 0.35,
            "backplateShadow": "0 0 28px rgba(0, 0, 0, 0.45), 0 2px 14px rgba(0, 0, 0, 0.38), 0 0 6px rgba(0, 0, 0, 0.30)",
            "atmosphericBlend": "screen",
            "treatmentOverlay": "air_frontal_optical_bloom",
        })
    elif chiseled:
        split_gradient = "linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 47%, #334155 49%, #1E293B 100%)"
        base_res.update({
            "gradient": split_gradient,
            "verticalGradient": split_gradient,
            "hasGradient": True,
            "glow": "0 0 14px rgba(255, 255, 255, 0.40)",
            "shadow": "0 1px 0 #CBD5E1, 0 -1px 0 #0F172A, 0 8px 24px rgba(0, 0, 0, 0.95), 0 2px 8px rgba(0, 0, 0, 0.90)",
            "textFillColor": "#FFFFFF",
            "boundaryStroke": "2.5px rgba(0, 0, 0, 0.95)",
            "chiseledPrism": True,
            "treatmentOverlay": "chiseled_prism_metallic",
        })

    return base_res





def split_single_word_syllables(word: str) -> List[str]:
    """Single words must never be fractured into broken trailing syllables."""
    return [word]



ANIMA_RUNTIME_TREATMENTS: List[Dict[str, Any]] = [
    # Preserved Core Lockup Engine & Archetypes
    {"id": "spatial_push_spring", "styles": {"editorial", "cinematic", "kinetic", "luxury"}, "energy": 0.45},
    {"id": "blue_lantern_magnetic", "styles": {"editorial", "cinematic"}, "energy": 0.45, "applicationBias": 0.90},
    {"id": "cinematic_slide_up", "styles": {"editorial", "cinematic"}, "energy": 0.45},
    {"id": "docking_modifier", "styles": {"editorial", "cinematic"}, "energy": 0.45},
    {"id": "kinetic_impact_snap", "styles": {"kinetic", "editorial"}, "energy": 0.65},
    {"id": "hierarchical_asymmetric_lockup", "styles": {"editorial", "cinematic", "kinetic", "luxury"}, "energy": 0.45},
    {"id": "documentary_lockup_captions", "styles": {"editorial", "cinematic", "kinetic", "luxury"}, "energy": 0.45},
    {"id": "micro_macro_kinetic_type", "styles": {"editorial", "cinematic", "kinetic", "luxury"}, "energy": 0.45},

    # Preserved High-Class Editorial & Material Phenotypes
    {"id": "apple_keynote_headline_punch", "styles": {"kinetic", "editorial"}, "energy": 0.75},
    {"id": "gaussian_blur_reveal_sweep", "styles": {"cinematic", "editorial"}, "energy": 0.45},
    {"id": "cinematic_viewport_mask_sweep", "styles": {"cinematic", "editorial"}, "energy": 0.35},
    {"id": "cyber_matrix_text_scramble", "styles": {"kinetic", "editorial"}, "energy": 0.80},
    {"id": "dotted_grid_elastic_word_pull", "styles": {"kinetic", "editorial"}, "energy": 0.60},
    {"id": "metallic_chrome_countup_hero", "styles": {"cinematic", "kinetic"}, "energy": 0.56},
    {"id": "metallic_chrome_counter", "styles": {"cinematic", "kinetic"}, "energy": 0.50},
    {"id": "apple_gaussian_chrome", "styles": {"cinematic", "editorial"}, "energy": 0.43},
    {"id": "liquid_gooey_ink_morph", "styles": {"kinetic", "cinematic"}, "energy": 0.64},
    {"id": "electric_blue_emoji_line_revealer", "styles": {"kinetic", "editorial"}, "energy": 0.62},
    {"id": "kinetic_chromatic_typewriter", "styles": {"kinetic", "editorial"}, "energy": 0.63},
    {"id": "cinematic_apple_word_bounce", "styles": {"cinematic", "kinetic"}, "energy": 0.61},
    {"id": "vercel_kinetic_highlight_box", "styles": {"editorial", "special_ops"}, "energy": 0.50},
    {"id": "horizontal_gradient_sweep_fade", "styles": {"cinematic", "editorial"}, "energy": 0.45},
    {"id": "refraction_shimmer_mask", "styles": {"cinematic", "kinetic"}, "energy": 0.55},
    {"id": "quote_glow_reveal", "styles": {"editorial", "cinematic"}, "energy": 0.38},
    {"id": "stagger_blur_word_reveal", "styles": {"editorial", "cinematic"}, "energy": 0.35},
    {"id": "typewriter_cursor", "styles": {"editorial", "kinetic"}, "energy": 0.48},
    {"id": "typewriter_ghost_cursor", "styles": {"editorial", "kinetic"}, "energy": 0.44},
    {"id": "real_estate_luxury_curve", "styles": {"editorial", "luxury", "special_ops"}, "energy": 0.48},
    {"id": "real_estate_captions", "styles": {"editorial", "luxury", "special_ops"}, "energy": 0.48},
    {"id": "multi_word_slide_up_stagger", "styles": {"editorial", "cinematic", "special_ops"}, "energy": 0.55},
    {"id": "multiple_word_slide_up", "styles": {"editorial", "cinematic", "special_ops"}, "energy": 0.55},
    {"id": "cyber_acid_lime_glitch", "styles": {"kinetic", "editorial"}, "energy": 0.75},
    {"id": "cursor_selection_reveal", "styles": {"editorial", "special_ops"}, "energy": 0.45},

    # Special Ops Arsenal (Contract Presets)
    {"id": "chiseled_prism_metallic", "styles": {"editorial", "kinetic", "special_ops"}, "energy": 0.65},
    {"id": "prism_chisel_hard_bevel", "styles": {"editorial", "kinetic", "special_ops"}, "energy": 0.65},
    {"id": "vj_kinetic_typography", "styles": {"kinetic", "special_ops"}, "energy": 0.85},
    {"id": "vjkt", "styles": {"kinetic", "special_ops"}, "energy": 0.85},
    {"id": "air_frontal_optical_bloom", "styles": {"editorial", "cinematic", "special_ops", "frontal"}, "energy": 0.40},
    {"id": "in_the_air_diffusion_bloom", "styles": {"editorial", "cinematic", "special_ops", "frontal"}, "energy": 0.40},
    {"id": "see_through_glass_letterform", "styles": {"editorial", "cinematic", "special_ops"}, "energy": 0.40},

    # Architectural Freeze: 5 Tall-Font Workhorses (Preserves 9:16 manifests)
    {"id": "kinetic_slot_character_reel", "styles": {"kinetic", "editorial"}, "energy": 0.78},
    {"id": "dynamic_staggered_character_cascade", "styles": {"kinetic", "cinematic"}, "energy": 0.70},
    {"id": "cinematic_distance_convergence", "styles": {"cinematic", "editorial"}, "energy": 0.45},
    {"id": "top_down_staggered_character_drop", "styles": {"kinetic", "cinematic"}, "energy": 0.74},
    {"id": "canva_tall_glyph_stack", "styles": {"cinematic", "editorial"}, "energy": 0.40},

    # Hook Lingua Treatments (synchronized with mini_run_pipeline.hooks.HOOK_TREATMENTS)
    {"id": "hook_bokeh_defocus_bloom", "styles": {"hook", "cinematic", "optical"}, "energy": 0.50},
    {"id": "hook_gaussian_lens_reveal", "styles": {"hook", "cinematic", "optical"}, "energy": 0.50},
    {"id": "hook_directional_whip_blur", "styles": {"hook", "cinematic", "optical"}, "energy": 0.50},
    {"id": "hook_radial_zoom_blur", "styles": {"hook", "cinematic", "optical"}, "energy": 0.50},
    {"id": "hook_sharp_white_flash_cut", "styles": {"hook", "cinematic", "light"}, "energy": 0.55},
    {"id": "hook_anamorphic_flare_burst", "styles": {"hook", "cinematic", "light"}, "energy": 0.55},
    {"id": "hook_vintage_film_burn_strobe", "styles": {"hook", "cinematic", "light"}, "energy": 0.55},
    {"id": "hook_luma_strobe_pulse", "styles": {"hook", "cinematic", "light"}, "energy": 0.55},
    {"id": "hook_cinematic_dolly_zoom", "styles": {"hook", "cinematic", "camera"}, "energy": 0.50},
    {"id": "hook_crash_zoom_snap", "styles": {"hook", "cinematic", "camera"}, "energy": 0.60},
    {"id": "hook_isometric_3d_slam", "styles": {"hook", "cinematic", "camera"}, "energy": 0.60},
    {"id": "hook_vertical_kinetic_pedestal", "styles": {"hook", "cinematic", "camera"}, "energy": 0.50},
    {"id": "hook_smooth_zoom_in", "styles": {"hook", "cinematic", "camera"}, "energy": 0.45},
    {"id": "hook_full_zoom_up", "styles": {"hook", "cinematic", "camera"}, "energy": 0.50},
    {"id": "hook_crt_scanline_matrix_decode", "styles": {"hook", "cinematic", "distortion"}, "energy": 0.60},
    {"id": "hook_vhs_tape_tracking_tear", "styles": {"hook", "cinematic", "distortion"}, "energy": 0.60},
    {"id": "hook_metallic_chrome_reflection", "styles": {"hook", "cinematic", "shader"}, "energy": 0.55},
    {"id": "hook_liquid_ink_metaball_reveal", "styles": {"hook", "cinematic", "shader"}, "energy": 0.55},
    {"id": "hook_zora_aperture_mask_bloom", "styles": {"hook", "cinematic", "shader"}, "energy": 0.50},
    {"id": "hook_motion_blur_word", "styles": {"hook", "cinematic", "shader"}, "energy": 0.50},
]

SINGLE_WORD_HERO_PRESETS: set[str] = {
    "apple_keynote_headline_punch",
    "metallic_chrome_countup_hero",
    "metallic_chrome_counter",
    "apple_gaussian_chrome",
    "cinematic_distance_convergence",
    "blue_lantern_magnetic",
    "spatial_push_spring",
    "kinetic_impact_snap",
    "refraction_shimmer_mask",
    "chiseled_prism_metallic",
    "prism_chisel_hard_bevel",
    "air_frontal_optical_bloom",
    "in_the_air_diffusion_bloom",
    "canva_tall_glyph_stack",
}

ANIMA_OVERLAY_TREATMENTS = [
    "cinematic_viewport_mask_sweep",
    "refraction_shimmer_mask",
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
    if any(k in design for k in ("specialOps", "specialOpsMode")) or str(design.get("typographySystem", "")).lower() in ("special_ops", "special_ops_tier"):
        resolved["specialOps"] = bool(
            design.get("specialOps", False)
            or design.get("specialOpsMode", False)
            or str(design.get("typographySystem", "")).lower() in ("special_ops", "special_ops_tier")
        )
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
    "image (1)", "image (2)", "image (3)", "image (6)", "image (7)", "image (8)",
    "image (14)", "image (15)", "image (16)", "image (17)", "image (18)", "image (21)",
    "image (24)", "image (27)", "image (31)", "image (35)", "image (36)", "image (40)",
    "image (47)", "image (48)", "image (51)", "image (52)", "image (53)", "image (54)",
    "image (55)", "image (56)", "image (57)", "image (66)", "image (67)", "image (68)", "image (69)",
    "Image Landscape 5", "Image Landscape 6", "Image Landscape 8",
}


def _resolve_font_json_treatment(
    prof: Dict[str, Any],
    layer_spec: Dict[str, Any],
    is_hero: bool,
    is_single_word: bool,
    rng: random.Random,
    policy: Dict[str, Any],
    behind_subject: bool = False,
) -> str:
    """Resolve runtime kinetic text treatment directly from the font JSON classification, mood, and role."""
    mood = str(prof.get("metadata", {}).get("overall_mood", "")).lower()
    classification = str(layer_spec.get("font_classification", "")).lower()
    role = str(layer_spec.get("role", "")).lower()
    avoid = set(policy.get("avoidPresets", []))

    if any(k in classification or k in mood for k in ("3d", "metallic", "chrome", "extruded")):
        candidates = ["refraction_shimmer_mask", "apple_gaussian_chrome", "metallic_chrome_counter"]
    elif any(k in classification or k in mood for k in ("script", "calligraphic", "cursive", "brush", "handwriting")):
        if is_hero:
            candidates = ["stagger_blur_word_reveal", "quote_glow_reveal", "real_estate_luxury_curve"]
        else:
            candidates = ["stagger_blur_word_reveal", "cinematic_slide_up", "docking_modifier", "multi_word_slide_up_stagger"]
    elif any(k in classification or k in mood for k in ("compressed", "ultra-compressed", "tall", "heavy sans", "grotesque")):
        # Tall-stack contract: canva_tall_glyph_stack (and vertical tower fx) is restricted to single-word layers + behind-subject only.
        # Multi-word layers get horizontal alternatives.
        if is_single_word or behind_subject:
            candidates = ["kinetic_slot_character_reel", "canva_tall_glyph_stack", "top_down_staggered_character_drop", "refraction_shimmer_mask"]
        else:
            candidates = ["multi_word_slide_up_stagger", "cinematic_slide_up", "docking_modifier", "stagger_blur_word_reveal"]
    elif any(k in classification or k in mood for k in ("didone", "modern serif", "classic editorial", "refined")):
        candidates = ["quote_glow_reveal", "stagger_blur_word_reveal", "cinematic_viewport_mask_sweep", "apple_gaussian_chrome"]
    elif any(k in classification or k in mood for k in ("swiss", "poster", "display", "headline")):
        candidates = ["apple_keynote_headline_punch", "stagger_blur_word_reveal", "multi_word_slide_up_stagger"]
    elif any(k in classification or k in mood for k in ("matrix", "cyber", "terminal", "code")):
        candidates = ["typewriter_cursor", "typewriter_ghost_cursor", "cyber_matrix_text_scramble", "kinetic_chromatic_typewriter"]
    else:
        if is_hero:
            candidates = ["apple_keynote_headline_punch", "blue_lantern_magnetic", "refraction_shimmer_mask", "spatial_push_spring"]
        else:
            candidates = ["stagger_blur_word_reveal", "cinematic_slide_up", "docking_modifier", "multi_word_slide_up_stagger"]

    # Final guard: tall-stack and vertical tower presets never admitted for multi-word layers unless behind-subject
    if not (is_single_word or behind_subject):
        candidates = [c for c in candidates if c != "canva_tall_glyph_stack"]

    eligible = [c for c in candidates if c not in avoid]
    return rng.choice(eligible) if eligible else "apple_keynote_headline_punch"


def eligible_portrait_profile_ids() -> List[str]:
    return [profile["id"] for profile in load_all_portrait_font_json_profiles()]


def _is_cranial_profile(profile: Dict[str, Any]) -> bool:
    pid = (profile.get("id") or "").lower()
    pname = (profile.get("profile_name") or "").lower()
    pfile = (profile.get("filename") or "").lower()
    metadata = profile.get("metadata", {})
    if profile.get("is_cranial_profile") or "cranial" in pid or "cranial" in pfile or "cranial" in pname:
        return True
    return bool(metadata.get("cranial_placement_optimized"))


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


def _is_behind_subject_candidate_profile(profile: Dict[str, Any]) -> bool:
    """Checks if profile is qualified for behind-subject cranial / tall matte placement."""
    return _is_tall_matte_profile(profile) or _is_cranial_profile(profile)



INTRINSIC_ANIMATION_DURATIONS_MS: Dict[str, int] = {
    "cyber_matrix_text_scramble": 1200,
    "metallic_chrome_countup_hero": 1200,
    "metallic_chrome_counter": 1000,
    "refraction_shimmer_mask": 1100,
    "kinetic_slot_character_reel": 1100,
    "dynamic_staggered_character_cascade": 1000,
    "top_down_staggered_character_drop": 950,
    "cinematic_distance_convergence": 900,
    "liquid_gooey_ink_morph": 1100,
    "kinetic_chromatic_typewriter": 1000,
    "typewriter_cursor": 900,
    "typewriter_ghost_cursor": 900,
    "apple_keynote_headline_punch": 850,
    "apple_gaussian_chrome": 850,
    "gaussian_blur_reveal_sweep": 850,
    "cinematic_viewport_mask_sweep": 850,
    "cinematic_apple_word_bounce": 800,
    "chiseled_prism_metallic": 900,
    "prism_chisel_hard_bevel": 900,
    "vj_kinetic_typography": 850,
    "vjkt": 850,
    "air_frontal_optical_bloom": 850,
    "see_through_glass_letterform": 800,
    "hierarchical_asymmetric_lockup": 850,
    "spatial_push_spring": 800,
    "blue_lantern_magnetic": 800,
    "kinetic_impact_snap": 750,
    "stagger_blur_word_reveal": 800,
    "multi_word_slide_up_stagger": 850,
    "multiple_word_slide_up": 850,
    "cyber_acid_lime_glitch": 900,
    "cursor_selection_reveal": 800,
    "vercel_kinetic_highlight_box": 800,
    "horizontal_gradient_sweep_fade": 800,
    "quote_glow_reveal": 750,
    "canva_tall_glyph_stack": 850,
    "electric_blue_emoji_line_revealer": 850,
    "dotted_grid_elastic_word_pull": 800,
}


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
        words_list = chunk.get("words", [])
        last_word_start = (
            int(words_list[-1].get("start_ms", content_start_ms))
            if words_list else content_start_ms
        )
        fx = chunk.get("fxPreset") or (chunk.get("layers", [{}])[0].get("fxPreset") if chunk.get("layers") else "")
        intrinsic_ms = INTRINSIC_ANIMATION_DURATIONS_MS.get(fx, 750)
        max_allowed_end = max(natural_end_ms, next_start_ms - 80) if index + 1 < len(scheduled) else natural_end_ms + 600
        desired_hold = max(natural_end_ms, last_word_start + 750, natural_end_ms + 500, content_start_ms + intrinsic_ms)
        display_end_ms = max(content_start_ms + 1, min(desired_hold, max_allowed_end))
        chunk["acceleratedExit"] = bool(desired_hold > max_allowed_end)
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

    # Balanced variety across curated artistic categories (didone/editorial, display grotesque, balanced typography)
    artistic_bonus = 1.0
    if any(k in searchable for k in ("didone", "editorial", "vogue", "serif", "bodoni", "playfair")):
        artistic_bonus = 1.25
    elif any(k in searchable for k in ("grotesque", "display", "condensed", "tall", "poster")):
        artistic_bonus = 1.25
    elif any(k in searchable for k in ("cursive", "script", "calligraphic", "flourish", "handwriting", "brush", "italic", "emma", "gabrielle")):
        artistic_bonus = 1.0  # Normalized: no artificial inflation over workhorse editorial types

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



class SemanticConceptLedger:
    """Cross-chunk semantic concept and numeric anchor registry.

    Enforces Order 1 and editorial restraint:
    1. Distinguishes temporal/metric phrases ("12 months", "3 weeks", "5 days")
       from true hero numeric milestones ("12,000", "$50,000", "100%").
       Temporal phrases are logged as durations and never promoted to counter/punch heroes.
    2. Prevents numeric double-rendering across chunks: once a numeric root or
       concept (e.g. "12" or "12,000") is claimed as a hero metric, competing or
       near-identical numeric expressions in proximate chunks cannot re-claim the
       counter treatment, avoiding cognitive fatigue and repetitive animations.
    """

    TEMPORAL_UNITS: Set[str] = {
        "month", "months", "year", "years", "day", "days", "week", "weeks",
        "hour", "hours", "minute", "minutes", "second", "seconds",
        "am", "pm",
    }
    TEMPORAL_PRE_MODIFIERS: Set[str] = {
        "last", "past", "next", "over", "within", "every", "for", "in", "about"
    }
    ASR_TEMPORAL_CONFUSIONS: Dict[str, str] = {
        "modes": "months",
        "moths": "months",
        "mounts": "months",
        "mon": "month",
        "mths": "months",
        "mins": "minutes",
        "sec": "seconds",
        "secs": "seconds",
        "yrs": "years",
    }

    def __init__(self, min_counter_gap_chunks: int = 4):
        self.claimed_numbers: Dict[str, int] = {}  # normalized number root -> chunkIndex
        self.claimed_concepts: Set[str] = set()
        self.counter_claims: List[Dict[str, Any]] = []
        self.min_counter_gap_chunks = min_counter_gap_chunks
        self.last_counter_chunk_idx: int = -999

    @classmethod
    def _is_unit_match(cls, clean_next: str, clean_prev: str, clean_after: str) -> bool:
        if clean_next in cls.TEMPORAL_UNITS:
            return True
        if clean_next in cls.ASR_TEMPORAL_CONFUSIONS:
            # Narrow quantity+unit guard: bond 'modes' to 'months' only when preceded by temporal modifiers,
            # and not followed by 'of' (e.g. '6 modes of thinking' is NOT suppressed).
            if clean_prev in cls.TEMPORAL_PRE_MODIFIERS and clean_after != "of":
                return True
        return False

    @classmethod
    def is_temporal_phrase(cls, text: str, next_chunk_text: Optional[str] = None) -> bool:
        """Check if numbers in text are immediately followed by temporal units (with narrow ASR quantity+unit bonding)."""
        full_text = f"{text} {next_chunk_text}".strip() if next_chunk_text else text
        tokens = [w.strip() for w in full_text.split() if w.strip()]
        for i, token in enumerate(tokens):
            clean_token = re.sub(r"[^\w]", "", token).lower()
            if clean_token.isdigit():
                clean_prev = re.sub(r"[^\w]", "", tokens[i - 1]).lower() if i > 0 else ""
                clean_next = re.sub(r"[^\w]", "", tokens[i + 1]).lower() if i + 1 < len(tokens) else ""
                clean_after = re.sub(r"[^\w]", "", tokens[i + 2]).lower() if i + 2 < len(tokens) else ""
                if cls._is_unit_match(clean_next, clean_prev, clean_after):
                    return True
        return False

    @classmethod
    def extract_metric_numbers(cls, text: str, next_chunk_text: Optional[str] = None) -> List[str]:
        """Extract standalone numeric metric values, filtering out temporal/duration phrases."""
        full_text = f"{text} {next_chunk_text}".strip() if next_chunk_text else text
        tokens = [w.strip() for w in full_text.split() if w.strip()]
        text_token_count = len([w for w in text.split() if w.strip()])
        metrics = []
        for i, token in enumerate(tokens):
            if next_chunk_text and i >= text_token_count:
                break
            clean_digits = re.sub(r"[^\d]", "", token)
            if clean_digits:
                clean_prev = re.sub(r"[^\w]", "", tokens[i - 1]).lower() if i > 0 else ""
                clean_next = re.sub(r"[^\w]", "", tokens[i + 1]).lower() if i + 1 < len(tokens) else ""
                clean_after = re.sub(r"[^\w]", "", tokens[i + 2]).lower() if i + 2 < len(tokens) else ""
                if not cls._is_unit_match(clean_next, clean_prev, clean_after):
                    metrics.append(clean_digits)
        return metrics

    def can_claim_counter(self, chunk_idx: int, text: str, next_chunk_text: Optional[str] = None) -> bool:
        """Evaluate whether a chunk may claim the hero metallic chrome counter."""
        metric_numbers = self.extract_metric_numbers(text, next_chunk_text=next_chunk_text)
        if not metric_numbers:
            return False
        if (chunk_idx - self.last_counter_chunk_idx) < self.min_counter_gap_chunks:
            return False
        for num in metric_numbers:
            if num in self.claimed_numbers:
                return False
        return True

    def claim_concept(self, chunk_idx: int, text: str, treatment: str, next_chunk_text: Optional[str] = None) -> Optional[str]:
        """Record the claimed concept and enforce the ledger lock."""
        if treatment in ("metallic_chrome_counter", "metallic_chrome_countup_hero"):
            metric_numbers = self.extract_metric_numbers(text, next_chunk_text=next_chunk_text)
            if metric_numbers:
                for num in metric_numbers:
                    self.claimed_numbers[num] = chunk_idx
                    self.claimed_concepts.add(f"num_{num}")
                self.last_counter_chunk_idx = chunk_idx
                self.counter_claims.append({
                    "chunkIndex": chunk_idx,
                    "numbers": metric_numbers,
                    "treatment": treatment,
                    "text": text,
                })
                return metric_numbers[0]
        return None

    def is_claimed_duplicate(self, text: str, next_chunk_text: Optional[str] = None) -> bool:
        """Check if any metric number in the text was previously claimed in the ledger."""
        metric_numbers = self.extract_metric_numbers(text, next_chunk_text=next_chunk_text)
        return any(num in self.claimed_numbers for num in metric_numbers)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "claimedNumbers": self.claimed_numbers,
            "claimedConcepts": sorted(self.claimed_concepts),
            "counterClaims": self.counter_claims,
            "totalCountersClaimed": len(self.counter_claims),
        }


def _chunk_signal(
    chunk: Dict[str, Any],
    ledger: Optional[SemanticConceptLedger] = None,
    chunk_idx: int = 0,
    next_chunk_text: Optional[str] = None,
) -> Dict[str, float]:
    words = [word for word in str(chunk.get("text", "")).split() if word]
    duration_ms = max(1, int(chunk.get("endMs", 0)) - int(chunk.get("startMs", 0)))
    content_density = sum(
        1 for word in words if word.lower().strip(".,!?:;\"'") not in STOPWORDS
    ) / max(1, len(words))
    punctuation_bonus = 0.18 if any(mark in str(chunk.get("text", "")) for mark in ("!", "?", ":", ";")) else 0.0

    raw_text = str(chunk.get("text", ""))
    if ledger is not None:
        can_counter = ledger.can_claim_counter(chunk_idx, raw_text, next_chunk_text=next_chunk_text)
        is_duplicate = ledger.is_claimed_duplicate(raw_text, next_chunk_text=next_chunk_text)
    else:
        metric_nums = SemanticConceptLedger.extract_metric_numbers(raw_text, next_chunk_text=next_chunk_text)
        can_counter = bool(metric_nums and not SemanticConceptLedger.is_temporal_phrase(raw_text, next_chunk_text=next_chunk_text))
        is_duplicate = False

    has_number = 1.0 if can_counter else 0.0
    return {
        "wordCount": float(len(words)),
        "cadenceMs": duration_ms / max(1, len(words)),
        "salience": min(1.0, 0.18 + content_density * 0.62 + punctuation_bonus),
        "hasNumber": has_number,
        "isClaimedDuplicateNumber": 1.0 if is_duplicate else 0.0,
    }


def _select_primary_treatment(
    rng: random.Random,
    policy: Dict[str, Any],
    signal: Dict[str, float],
    usage: Dict[str, int],
    recent: List[str],
    is_single_word: bool = False,
) -> str:
    highlight_presets = {"vercel_kinetic_highlight_box", "lavender_highlight_selection"}
    has_recent_highlight = any(h in recent[-3:] for h in highlight_presets)

    # STRICT RULE: hook_* presets are EXCLUSIVELY reserved for chunk 0 via hook_plan.
    # They must NEVER be assigned to regular dialogue chunks.
    _HOOK_ONLY_PRESETS = {item["id"] for item in ANIMA_RUNTIME_TREATMENTS if "hook" in item.get("styles", set())}

    candidates = [
        item for item in ANIMA_RUNTIME_TREATMENTS
        if item["id"] not in policy["avoidPresets"]
        and item["id"] not in recent
        and item["id"] not in _HOOK_ONLY_PRESETS
        and not (has_recent_highlight and item["id"] in highlight_presets)
    ] or [
        item for item in ANIMA_RUNTIME_TREATMENTS
        if item["id"] not in policy["avoidPresets"]
        and item["id"] not in _HOOK_ONLY_PRESETS
    ]
    if not candidates:
        candidates = [item for item in ANIMA_RUNTIME_TREATMENTS if item["id"] == "apple_keynote_headline_punch"]
    creativity = {"reserved": 0.65, "balanced": 1.1, "expressive": 1.65}[policy["creativity"]]
    desired_energy = {
        "slow": 0.32,
        "adaptive": 0.42 if signal["cadenceMs"] >= 340 else 0.62,
        "fast": 0.75,
    }[policy["pacing"]]
    # Single-word chunks: strongly prefer focal single-word treatments from
    # SINGLE_WORD_HERO_PRESETS.
    single_word_boost = 3.5 if is_single_word else 1.0
    # Fluid-motion family (blur rises, glass, sweeps, slides, letter-by-letter)
    # is the default editorial look. They carry a selection boost AND a
    # flattened energy penalty so fast talking-head cadence (high desired
    # energy) can no longer suppress them in favour of chunk-level pops.
    # The pop family (countups, scale punches, flickers) gets a mild damping
    # so the mix reads as fluid motion with occasional pops, not the reverse.
    FLUID_FAMILY = {
        "blue_lantern_magnetic", "stagger_blur_word_reveal", "apple_gaussian_chrome",
        "cinematic_distance_convergence", "quote_glow_reveal", "refraction_shimmer_mask",
        "kinetic_slot_character_reel", "dynamic_staggered_character_cascade",
        "top_down_staggered_character_drop", "cinematic_viewport_mask_sweep",
        "hierarchical_asymmetric_lockup", "documentary_lockup_captions", "micro_macro_kinetic_type",
        "cinematic_slide_up", "docking_modifier", "spatial_push_spring",
    }
    POP_FAMILY = {
        "metallic_chrome_countup_hero", "metallic_chrome_counter",
        "apple_keynote_headline_punch", "kinetic_chromatic_typewriter", "kinetic_impact_snap",
    }
    SPECIAL_OPS_FAMILY = {
        "real_estate_luxury_curve", "real_estate_captions",
        "multi_word_slide_up_stagger", "multiple_word_slide_up",
        "hierarchical_asymmetric_lockup", "documentary_lockup_captions", "micro_macro_kinetic_type",
        "cursor_selection_reveal", "vercel_kinetic_highlight_box",
        "chiseled_prism_metallic", "prism_chisel_hard_bevel",
        "vj_kinetic_typography", "vjkt",
        "air_frontal_optical_bloom", "see_through_glass_letterform",
    }
    fluid_boost = 2.4
    letter_boost = 1.5
    pop_damp = 0.55

    def _treatment_weight(item: Dict[str, Any]) -> float:
        energy_gap = abs(item["energy"] - desired_energy)
        energy_factor = 1.0 / (1.0 + energy_gap * 2.0)
        if item["id"] in FLUID_FAMILY:
            # Flatten the energy penalty: fluid motion stays selectable at any cadence.
            energy_factor = max(energy_factor, 0.85)
        boost = 1.0
        if item["id"] in FLUID_FAMILY:
            boost *= fluid_boost
        # Letter-by-letter treatments get an extra nudge on top of the fluid boost
        if item["id"] in ("kinetic_slot_character_reel", "dynamic_staggered_character_cascade", "top_down_staggered_character_drop"):
            boost *= letter_boost
        if item["id"] in POP_FAMILY:
            boost *= pop_damp

        # Semantic Number Routing (Order 1): Numbers/digits heavily route to metallic chrome counter
        if signal.get("hasNumber", 0.0) > 0:
            if item["id"] in ("metallic_chrome_counter", "metallic_chrome_countup_hero"):
                boost *= 8.0
            else:
                boost *= 0.25
        elif signal.get("isClaimedDuplicateNumber", 0.0) > 0:
            # Residual number dedup (Order 1): If this chunk contains an already claimed numeric concept,
            # damp POP treatments and aggressive counters so the number is not repeatedly punched.
            if item["id"] in POP_FAMILY or item["id"] in ("metallic_chrome_counter", "metallic_chrome_countup_hero", "apple_keynote_headline_punch"):
                boost *= 0.15

        # Special Ops Causal Hierarchy & Anti-Dilution:
        if policy.get("specialOps") and item["id"] in SPECIAL_OPS_FAMILY:
            boost *= 3.8

        # Word-count fit enforcement: single-word presets must not be assigned to multi-word lines
        if is_single_word:
            word_fit_boost = single_word_boost if item["id"] in SINGLE_WORD_HERO_PRESETS else 0.8
        else:
            # Multi-word line mandate: penalize single-word monolithic presets, heavily favor word-by-word staggered reveals
            if item["id"] in SINGLE_WORD_HERO_PRESETS:
                # Counter Carve-Out (Fix 4): Exempt counter presets from the 0.05 penalty on number chunks so the 8.0x boost takes effect
                if signal.get("hasNumber", 0.0) > 0 and item["id"] in ("metallic_chrome_counter", "metallic_chrome_countup_hero"):
                    word_fit_boost = 1.0
                else:
                    word_fit_boost = 0.05
            elif item["id"] in (
                "cinematic_apple_word_bounce", "stagger_blur_word_reveal",
                "dynamic_staggered_character_cascade", "apple_keynote_headline_punch",
                "hierarchical_asymmetric_lockup", "documentary_lockup_captions", "micro_macro_kinetic_type",
                "multi_word_slide_up_stagger"
            ):
                word_fit_boost = 3.5
            else:
                word_fit_boost = 1.25

        return (
            (2.3 if policy["motionStyle"] in item["styles"] else 0.45)
            * word_fit_boost
            * boost
            * (1.0 / (1 + usage.get(item["id"], 0) * 1.5))
            * energy_factor
            * creativity
        )


    selected = _weighted_choice(rng, candidates, [_treatment_weight(item) for item in candidates])
    if selected.get("applicationBias") is not None and rng.random() > float(selected["applicationBias"]):
        remaining = [c for c in candidates if c["id"] != selected["id"]]
        if remaining:
            selected = _weighted_choice(rng, remaining, [_treatment_weight(item) for item in remaining])
    return selected["id"]




def _entry_lead_ms(policy: Dict[str, Any], signal: Dict[str, float], is_hero: bool, primary_fx: str) -> int:
    # Mention-sync lock: a word's entrance must begin at (or within ~0.13s of)
    # the moment it is spoken. The old 340–480ms leads made words visibly
    # appear before they were ever stated.
    baseline = {"slow": 120, "adaptive": 100, "fast": 70}[policy["pacing"]]
    cadence_bonus = min(20, max(-15, int((signal["cadenceMs"] - 310) * 0.08)))
    hero_bonus = 10 if is_hero else 0
    blur_bonus = 10 if "blur" in primary_fx or "focus" in primary_fx else 0
    return max(40, min(130, baseline + cadence_bonus + hero_bonus + blur_bonus))


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
    """Dynamically and sensibly select high-contrast chunks for Difference-Mode Inversion
    (Dynamic Knockout Typography).
    
    Inverts underlying visual footage pixels (|255 - BG|) with razor-thin boundary strokes.
    Spaced at least 3 chunks apart to avoid visual fatigue while delivering the signature
    cinematic see-through effect.
    """
    total = len(manifest_chunks)
    if total < 2:
        return set()

    selected = set()
    last_idx = -10

    for idx, c in enumerate(manifest_chunks):
        if idx - last_idx < 3:
            continue

        # Do not override hierarchical lockups or explicitly requested frontal treatments
        if (
            c.get("treatmentSystem") in ("hierarchical_asymmetric_lockup", "documentary_lockup_captions", "micro_macro_kinetic_type")
            or c.get("fxPreset") in ("hierarchical_asymmetric_lockup", "documentary_lockup_captions", "micro_macro_kinetic_type")
            or c.get("frontalTreatment") == "air_frontal_optical_bloom"
            or any(l.get("frontalTreatment") == "air_frontal_optical_bloom" for l in c.get("layers", []))
        ):
            continue

        words = c.get("words", [])
        word_count = len(words) if words else len(c.get("text", "").split())

        # Target punchy chunks (1-4 words), scene transitions, B-roll cuts, or key semantic moments
        is_candidate = (
            1 <= word_count <= 4
            or c.get("isSceneBoundary")
            or c.get("hasTransition")
            or c.get("causedByTransitionId")
            or c.get("backgroundKind") in ("broll_cutaway", "negative_space_stencil", "editorial_glass", "texture_canvas")
            or c.get("treatmentSystem") == "see_through_glass_letterform"
            or any(l.get("isHero") for l in c.get("layers", []))
        )

        if is_candidate and (idx % 4 == 2 or rng.random() < 0.22):
            selected.add(idx)
            last_idx = idx

    return selected




# ---------------------------------------------------------------------------
# Pivot-satellite composition (Bug C): pick the core/pivot word semantically
# (first significant content word), and treat the remaining words as satellites
# for the renderer to anchor around the pivot's first/last letters.
# ---------------------------------------------------------------------------
_PIVOT_STOPWORDS = {
    "in", "on", "the", "a", "an", "to", "of", "and", "or", "at", "for", "that",
    "this", "is", "are", "was", "were", "it", "its", "if", "you", "we", "they",
    "your", "their", "my", "our", "i", "he", "she", "be", "been", "as", "but",
    "so", "not", "no", "then", "than", "could", "would", "should",
}


def _layout_rules_placement(prof: Dict[str, Any]) -> Dict[str, str]:
    """Translate the profile's font-JSON ``layout_rules`` into chunk placement.

    Rectification (talking-head occlusion): the JSON's vertical_position /
    bottom_margin_percent describe static poster compositions and were making
    the deck jump between 16% and 76% across chunks — straight through the
    speaker's face. Vertical placement is now owned by the subject-safe pass
    (one video-wide lower-third deck, face-exclusion guarded). The font JSON
    still governs what it expresses faithfully: horizontal alignment and
    container width.
    """
    rules = prof.get("layout_rules") or {}
    alignment = str(rules.get("horizontal_alignment", "center")).lower()
    try:
        max_width = float(rules.get("max_width_percent") or 85)
    except (TypeError, ValueError):
        max_width = 85

    if "left" in alignment:
        align = "left"
    elif "right" in alignment:
        align = "right"
    else:
        align = "center"

    return {
        "xPercent": "50%",
        "yPercent": "54%",
        "anchor": align,
        "textAlign": align,
        "dominantZone": "foreground_lower_deck",
        "maxWidthPercent": str(max_width),
        "layoutSource": "font_json_layout_rules",
    }


def select_pivot_layout(chunk: Dict[str, Any]) -> Dict[str, Any]:
    """Determine which layer is the core/pivot word for a chunk.

    The pivot is the first significant *content* word of the utterance (skipping
    leading function/stopwords), matching the short-form "core word centered,
    satellites anchored to its first/last letters" composition. Falls back to the
    first layer so every chunk keeps a stable pivot.
    """
    raw = str(chunk.get("text") or "")
    tokens = [t for t in raw.split() if t.strip()]
    content_idx = 0
    for i, tok in enumerate(tokens):
        cleaned = tok.strip(string.punctuation).strip().lower()
        if cleaned and cleaned not in _PIVOT_STOPWORDS:
            content_idx = i
            break
    pivot_word = tokens[content_idx].strip(string.punctuation).strip()

    layers = list(chunk.get("layers") or [])

    def _layer_text(layer: Dict[str, Any]) -> str:
        return str(layer.get("text") or layer.get("rawText") or "")

    if not layers:
        return {"pivotLayerIndex": 0, "pivotWord": pivot_word, "satelliteLayerIndices": []}

    # The pivot is the emphasis/focus layer: the explicit hero (big focal word),
    # or the largest layer. Centering the big emphasis word is what stays legible.
    hero_idx = next((i for i, layer in enumerate(layers) if layer.get("isHero")), None)
    if hero_idx is None:
        hero_idx = max(range(len(layers)), key=lambda i: float(layers[i].get("fontSizePx") or 0))
    pivot_idx = hero_idx
    satellites = [i for i in range(len(layers)) if i != pivot_idx]
    return {
        "pivotLayerIndex": pivot_idx,
        "pivotWord": pivot_word,
        "satelliteLayerIndices": satellites,
    }


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

    # Brand Motif System (Toggle-based: OFF by default unless enabled)
    motif_plan = resolve_brand_motif(design_input)
    if motif_plan:
        video_palette = motif_to_brand_palette(motif_plan)
        video_palette_id = motif_plan.get("preset", "custom")
        explicit_palette_id = video_palette_id
    else:
        # Unified Video-Level Brand Palette (dynamic variation by default)
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

    # Check if lockup treatment is desired across the entire design/prompt
    explicit_fx_check = (
        design_input.get("fxPreset")
        or design_input.get("motionPreset")
        or design_input.get("treatment")
        or design_input.get("treatmentSystem")
        or design_input.get("textTreatment")
    )
    prompt_wants_lockup = any(k in str(design_input.get("prompt", "")).lower() for k in ("luxury", "documentary", "hierarchical", "asymmetric", "lockup", "micro-macro", "micro_macro"))
    wants_lockup_overall = (
        explicit_fx_check in ("hierarchical_asymmetric_lockup", "documentary_lockup_captions", "micro_macro_kinetic_type")
        or prompt_wants_lockup
        or str(design_input.get("treatment", "")).lower() in ("hierarchical_asymmetric_lockup", "documentary_lockup_captions", "micro_macro_kinetic_type")
        or str(design_input.get("treatmentSystem", "")).lower() in ("hierarchical_asymmetric_lockup", "documentary_lockup_captions", "micro_macro_kinetic_type")
    )

    # Select behind-subject depth treatment moments with temporal distribution & variety
    behind_subject_indices = set()
    if policy["subjectLayering"] != "disabled":
        # Dynamic count based on video length
        if len(chunks) <= 8:
            max_behind_count = 1
        elif len(chunks) <= 18:
            max_behind_count = 2
        elif len(chunks) <= 24:
            max_behind_count = 3
        else:
            max_behind_count = 4

        candidate_scores = []
        for c_idx, c in enumerate(chunks):
            c_text = str(c.get("text", "")).strip()
            c_words = c_text.split()
            if not c_words:
                continue
            c_clean = "".join(ch for ch in c_text if ch.isalnum())
            next_c_text = str(chunks[c_idx + 1].get("text", "")).strip() if c_idx + 1 < len(chunks) else None
            c_signal = _chunk_signal(c, next_chunk_text=next_c_text)

            duration_ms = c.get("endMs", 0) - c.get("startMs", 0)
            word_count = len(c_words)
            has_digits = any(ch.isdigit() for ch in c_text)

            # Strict behind-subject cranial gating (Reverted 50df29a widening):
            # 1. Multi-word phrases with digits are PERMANENTLY disqualified (must remain foreground captions)
            # 2. Strict character bounds: single word <= 8 chars, or 2 words <= 10 chars total.
            # 3. Phrases with 3 or more words are strictly disqualified from behind-subject placement.
            if has_digits and word_count > 1:
                is_punchy = False
            elif word_count == 1:
                is_punchy = (2 <= len(c_clean) <= 8)
            elif word_count == 2:
                is_punchy = (4 <= len(c_clean) <= 10)
            else:
                is_punchy = False

            is_substantive = any(_is_substantive(w) for w in c_words) and len(c_clean) >= 2

            if is_punchy and is_substantive and duration_ms >= 400:
                base_score = c_signal["salience"] + (3.5 if word_count == 1 else 2.2)
                if has_digits and word_count == 1:
                    base_score += 0.8
                # Add mild stochastic variation for true run-to-run diversity
                score = base_score + rng.uniform(-0.15, 0.15)
                candidate_scores.append((c_idx, c_clean.lower(), score))

        candidate_scores.sort(key=lambda item: item[2], reverse=True)

        if policy["subjectLayering"] in ("required", "auto") and not candidate_scores and chunks:
            # Only fallback if there is a chunk meeting strict cranial bounds
            valid_fallback = [
                i for i in range(len(chunks))
                if len(str(chunks[i].get("text", "")).split()) <= 2
                and len("".join(ch for ch in str(chunks[i].get("text", "")) if ch.isalnum())) <= 10
                and not (any(ch.isdigit() for ch in str(chunks[i].get("text", ""))) and len(str(chunks[i].get("text", "")).split()) > 1)
            ]
            if valid_fallback:
                shortest_idx = min(valid_fallback, key=lambda i: len("".join(ch for ch in str(chunks[i].get("text", "")) if ch.isalnum())))
                behind_subject_indices.add(shortest_idx)
        else:
            used_behind_roots: set[str] = set()
            for c_idx, c_root, score in candidate_scores:
                if len(behind_subject_indices) >= max_behind_count:
                    break
                # Keyword deduplication: avoid repeating identical root words behind the subject
                if c_root in used_behind_roots:
                    continue
                c_start = chunks[c_idx].get("startMs", 0)
                # Cooldown: at least 2 chunks and at least 1800ms between behind-subject occurrences
                has_cooldown = all(
                    abs(c_idx - existing_idx) >= 2 and abs(c_start - chunks[existing_idx].get("startMs", 0)) >= 1800
                    for existing_idx in behind_subject_indices
                )
                if has_cooldown:
                    if policy["subjectLayering"] == "required":
                        behind_subject_indices.add(c_idx)
                        used_behind_roots.add(c_root)
                    elif policy["subjectLayering"] == "auto":
                        if score >= 0.7:
                            behind_subject_indices.add(c_idx)
                            used_behind_roots.add(c_root)

            # Auto mode fallback: if candidates exist but cooldown/threshold chose none, admit top candidate
            if policy["subjectLayering"] == "auto" and not behind_subject_indices and candidate_scores:
                behind_subject_indices.add(candidate_scores[0][0])

    # Listicle Intelligence & Numerical Planning
    listicle_planning = listicles.detect_and_plan_listicles(chunks, design_input)

    manifest_chunks = []
    concept_ledger = SemanticConceptLedger()
    recent_primary_fx: List[str] = []
    preset_usage_counts: Dict[str, int] = {item["id"]: 0 for item in ANIMA_RUNTIME_TREATMENTS}
    profile_usage_counts: Dict[str, int] = {}
    recent_profile_ids: List[str] = []  # sliding window to prevent rapid re-selection
    palette_usage_counts: Dict[str, int] = {}
    recent_palette_ids: List[str] = []

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
        next_chunk_text = str(chunks[idx + 1].get("text", "")).strip() if idx + 1 < len(chunks) else None
        signal = _chunk_signal(chunk, ledger=concept_ledger, chunk_idx=idx, next_chunk_text=next_chunk_text)
        behind_subject = (idx in behind_subject_indices)

        # Micro-stopword / connector phrase detection ("of how to", "and how to", etc.)
        clean_tokens = [re.sub(r'[^a-zA-Z]', '', w).lower() for w in words]
        clean_tokens = [w for w in clean_tokens if w]
        avg_word_len = sum(len(w) for w in clean_tokens) / max(1, len(clean_tokens))
        is_micro_stopword = (
            len(clean_tokens) >= 2 and (
                avg_word_len <= 3.2 or all(len(w) <= 3 for w in clean_tokens)
            )
        )

        # Strict Behind-Subject (Cranial / Tall Matte) vs Foreground separation:
        # Background chunks strictly use Cranial Font or Tall Matte profiles.
        # Single-word foreground heroes (e.g. "sunshine") are permitted Tall Matte profiles for colossal scale.
        if behind_subject or (is_single_word and not is_micro_stopword):
            pool = [p for p in profiles if _is_behind_subject_candidate_profile(p)] or profiles
        else:
            pool = [p for p in profiles if not _is_behind_subject_candidate_profile(p)] or profiles

        # PRIMUS INTER PARES: Strict Word Count Matching
        # A chunk of N words MUST strictly select a Font JSON profile designed for N words.
        if is_single_word:
            single_word_pool = [
                p for p in pool
                if p.get("total_words", len(p.get("typography_layers", []))) == 1
                and len(p.get("typography_layers", [])) == 1
            ]
            one_layer_pool = [p for p in pool if len(p.get("typography_layers", [])) == 1]
            matching_profiles = single_word_pool or one_layer_pool or pool
        else:
            # 1. Exact N-word matching pool (Strict Invariant)
            exact_word_pool = [
                p for p in pool
                if p.get("total_words", len(p.get("typography_layers", []))) == word_count
            ]

            # For multi-word speech cues (3+ words), restrict to profiles with at most 2 layers
            # so conversational speech is not chopped into vertical single-word column stacks.
            if word_count >= 3 and exact_word_pool:
                dialogue_exact = [p for p in exact_word_pool if len(p.get("typography_layers", [])) <= 2]
                if dialogue_exact:
                    exact_word_pool = dialogue_exact

            # Micro-stopword safeguard: exclude oversized display hero drop caps (e.g. image 11)
            # for tiny connectors like "of how to", preferring balanced modern sans/serif.
            if is_micro_stopword and exact_word_pool:
                balanced_exact = [
                    p for p in exact_word_pool
                    if not any(
                        "drop cap" in str(l.get("font_classification", "")).lower()
                        or "didone" in str(l.get("font_classification", "")).lower()
                        or l.get("font_style", {}).get("size_px_base", 100) > 160
                        for l in p.get("typography_layers", [])
                    )
                ]
                if balanced_exact:
                    exact_word_pool = balanced_exact

            if len(exact_word_pool) >= 4:
                matching_profiles = exact_word_pool
            else:
                # When exact pool is too small to provide run-to-run or sequence diversity,
                # expand with compatible multi-layer profiles within +/- 1 or 2 words.
                tier1 = [
                    p for p in pool
                    if abs(p.get("total_words", len(p.get("typography_layers", []))) - word_count) == 1
                ]
                tier2 = [
                    p for p in pool
                    if abs(p.get("total_words", len(p.get("typography_layers", []))) - word_count) <= 2
                ]
                combined = exact_word_pool + tier1 + tier2
                seen_ids = set()
                deduped = []
                for p in combined:
                    if p["id"] not in seen_ids:
                        seen_ids.add(p["id"])
                        deduped.append(p)
                matching_profiles = deduped or pool

        # Conversational dialogue preference: multi-word phrases (word_count >= 2)
        # prefer <= 2 layers so speech is never chopped into 3-line vertical stacks
        if not is_single_word and word_count >= 2:
            compact_dialogue_profiles = [p for p in matching_profiles if len(p.get("typography_layers", [])) <= 2]
            if compact_dialogue_profiles:
                matching_profiles = compact_dialogue_profiles

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

        v2_prof = get_typography_profile_v2_by_id(prof.get("id"))

        explicit_fx = (
            design_input.get("fxPreset")
            or design_input.get("motionPreset")
            or design_input.get("treatment")
            or design_input.get("treatmentSystem")
            or design_input.get("textTreatment")
        )
        is_special_ops_system = bool(
            policy.get("specialOps")
            or design_input.get("typographySystem") in ("special_ops", "special_ops_tier")
        )
        prompt_wants_lockup = any(k in str(design_input.get("prompt", "")).lower() for k in ("luxury", "documentary", "hierarchical", "asymmetric", "lockup", "micro-macro", "micro_macro"))
        wants_lockup = (
            explicit_fx in ("hierarchical_asymmetric_lockup", "documentary_lockup_captions", "micro_macro_kinetic_type")
            or prompt_wants_lockup
            or str(design_input.get("treatment", "")).lower() in ("hierarchical_asymmetric_lockup", "documentary_lockup_captions", "micro_macro_kinetic_type")
            or str(design_input.get("treatmentSystem", "")).lower() in ("hierarchical_asymmetric_lockup", "documentary_lockup_captions", "micro_macro_kinetic_type")
        )

        if explicit_fx and any(item["id"] == explicit_fx for item in ANIMA_RUNTIME_TREATMENTS):
            hero_fx_preset = explicit_fx
        elif wants_lockup:
            hero_fx_preset = "hierarchical_asymmetric_lockup"
        elif is_special_ops_system and is_single_word and (preset_usage_counts.get("chiseled_prism_metallic", 0) < 2):
            hero_fx_preset = "chiseled_prism_metallic"
        elif is_special_ops_system and (signal["cadenceMs"] < 280 or policy["pacing"] == "fast") and preset_usage_counts.get("vj_kinetic_typography", 0) < 2:
            hero_fx_preset = "vj_kinetic_typography"
        else:
            hero_fx_preset = _select_primary_treatment(
                rng, policy, signal, preset_usage_counts, recent_primary_fx,
                is_single_word=is_single_word,
            )
        preset_usage_counts[hero_fx_preset] = preset_usage_counts.get(hero_fx_preset, 0) + 1
        concept_ledger.claim_concept(idx, raw_text, hero_fx_preset)
        recent_primary_fx.append(hero_fx_preset)
        if len(recent_primary_fx) > 4:
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
        if hook_plan is not None and not wants_lockup and not explicit_fx:
            # Hook chunks lead with the dynamically planned cinematic hook treatment only if not an explicit typography style.
            hero_fx_preset = hook_plan.get("hookType") or "hook_cinematic_dolly_zoom"
            preset_usage_counts[hero_fx_preset] = preset_usage_counts.get(hero_fx_preset, 0) + 1

        is_lockup_treatment = wants_lockup or (hero_fx_preset in ("hierarchical_asymmetric_lockup", "documentary_lockup_captions", "micro_macro_kinetic_type"))
        resolved_lockup_opt = "top_tucked"

        # If single word is paired with a 2-layer profile, split by stem/suffix
        target_layers = prof.get("typography_layers", [])
        if is_lockup_treatment and word_count >= 2:
            modifier_stopwords = {
                "the", "a", "an", "up", "in", "on", "at", "to", "for", "of", "with", "by", "from",
                "was", "were", "is", "are", "been", "be", "only", "one", "didn't", "did", "not",
                "it", "its", "that", "this", "these", "those", "have", "has", "had", "we", "you", "they"
            }
            w0_clean = "".join(ch for ch in words[0].lower() if ch.isalnum())
            last_clean = "".join(ch for ch in words[-1].lower() if ch.isalnum())

            mod_scale = 0.88 if is_micro_stopword else 0.30

            if w0_clean in modifier_stopwords and word_count >= 3:
                split_idx = 1
                while split_idx < word_count - 1 and "".join(ch for ch in words[split_idx].lower() if ch.isalnum()) in modifier_stopwords:
                    split_idx += 1
                allocations = [
                    {"layer": {"role": "modifier", "font_style": {"weight": 600, "relative_scale": mod_scale}}, "words": words[:split_idx], "is_hero": False},
                    {"layer": {"role": "hero", "font_style": {"weight": 900, "relative_scale": 1.0}}, "words": words[split_idx:], "is_hero": True},
                ]
                resolved_lockup_opt = "top_tucked"
            elif last_clean in modifier_stopwords or (word_count >= 3 and "".join(ch for ch in words[1].lower() if ch.isalnum()) in modifier_stopwords):
                split_idx = 2 if (word_count >= 4 and words[0][0].isupper() and words[1][0].isupper()) else 1
                allocations = [
                    {"layer": {"role": "hero", "font_style": {"weight": 900, "relative_scale": 1.0}}, "words": words[:split_idx], "is_hero": True},
                    {"layer": {"role": "modifier", "font_style": {"weight": 600, "relative_scale": mod_scale}}, "words": words[split_idx:], "is_hero": False},
                ]
                resolved_lockup_opt = "bottom_tucked"
            else:
                allocations = [
                    {"layer": {"role": "modifier", "font_style": {"weight": 600, "relative_scale": mod_scale}}, "words": [words[0]], "is_hero": False},
                    {"layer": {"role": "hero", "font_style": {"weight": 900, "relative_scale": 1.0}}, "words": words[1:], "is_hero": True},
                ]
                resolved_lockup_opt = "top_tucked"
        elif is_single_word and len(target_layers) >= 2:
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

        # Pre-resolve the designed hero font for this chunk to enforce parent pairing fidelity
        chunk_hero_font = ""
        for h_alloc in allocations:
            if h_alloc.get("is_hero"):
                h_cands = [resolve_safe_font_candidate(c) for c in h_alloc.get("layer", {}).get("matched_font_candidates", [])]
                h_cands = [c for c in h_cands if c]
                if h_cands:
                    chunk_hero_font = h_cands[0]
                    break

        used_word_obj_ids = set()
        v2_layers = v2_prof.get("layers", []) if v2_prof else []
        for layer_idx, alloc in enumerate(allocations):
            layer_spec = alloc.get("layer", {})
            v2_layer = v2_layers[layer_idx] if layer_idx < len(v2_layers) else {}
            layer_words = alloc.get("words", [])
            w_count = len(layer_words)

            # Map word timestamps faithfully from chunk_word_objs
            layer_word_items = []
            for w_i, w_text in enumerate(layer_words):
                clean_target = "".join(ch for ch in w_text.lower() if ch.isalnum())
                matched_obj = None
                for c_obj in chunk_word_objs:
                    clean_c = "".join(ch for ch in str(c_obj.get("text", "")).lower() if ch.isalnum())
                    if clean_c == clean_target and id(c_obj) not in used_word_obj_ids:
                        matched_obj = c_obj
                        used_word_obj_ids.add(id(c_obj))
                        break
                if matched_obj is not None:
                    layer_word_items.append(matched_obj)
                elif word_offset + w_i < len(chunk_word_objs):
                    fallback_obj = chunk_word_objs[word_offset + w_i]
                    layer_word_items.append(fallback_obj)
                    used_word_obj_ids.add(id(fallback_obj))
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
            # Strict stop-word guard: small functional words ("are", "and", "the", "to", "in", "is")
            # can NEVER be the focal hero layer if any other layer has substantive content words!
            if is_hero_layer and all(not _is_substantive(w) for w in layer_words):
                other_has_substantive = any(
                    any(_is_substantive(w) for w in other_alloc.get("words", []))
                    for o_idx, other_alloc in enumerate(allocations) if o_idx != layer_idx
                )
                if other_has_substantive:
                    is_hero_layer = False
                    for other_alloc in allocations:
                        if other_alloc is not alloc and any(_is_substantive(w) for w in other_alloc.get("words", [])):
                            other_alloc["is_hero"] = True
                            break
            casing = f_style.get("casing", prof.get("metadata", {}).get("casing_strategy", "mixed"))

            # Authoritative Font Candidate from Font JSON with safe bitmap fallback
            raw_cands = layer_spec.get("matched_font_candidates", [])
            candidates = [resolve_safe_font_candidate(c) for c in raw_cands]
            candidates = [c for c in candidates if c]

            if candidates:
                primary_font = candidates[0]
                accent_font = candidates[1] if len(candidates) > 1 else candidates[0]
            else:
                primary_font = "Playfair Display" if is_hero_layer else "Montserrat"
                accent_font = primary_font

            # Strictly respect font JSON parents; only upgrade unstyled fallbacks and enforce anti-clash policy
            primary_font = upgrade_font_candidate(primary_font, is_hero_layer, role=layer_spec.get("role", "body"), rng=rng, hero_font=chunk_hero_font)
            accent_font = upgrade_font_candidate(accent_font, False, role="companion", rng=rng, hero_font=chunk_hero_font)

            if not is_hero_layer:
                if is_barred_companion_font(primary_font) or is_script_font(primary_font):
                    primary_font = rng.choice(COMPANION_UPGRADE_FONTS) if rng else "Montserrat"
                if is_barred_companion_font(accent_font) or is_script_font(accent_font):
                    accent_font = rng.choice(COMPANION_UPGRADE_FONTS) if rng else "Montserrat"

            clean_len = max(1, len(raw_layer_text))
            # Policy: Script / calligraphic fonts are strictly prohibited on:
            # 1. Any secondary/companion tier (not is_hero_layer) regardless of length
            # 2. Short words on hero (<= 4 characters, e.g. 'Do.', 'need', 'is', 'to', 'of', 'a')
            # 3. Any functional stopwords / auxiliary verbs ('have', 'are', 'was', 'were', 'been', etc.)
            is_script_candidate = is_script_font(primary_font) or any(s in primary_font.lower() for s in SCRIPT_FONT_KEYWORDS)
            is_all_stopwords = all(w.lower().strip(".,!?:;\"'") in STOPWORDS for w in layer_words)
            if is_script_candidate and (not is_hero_layer or clean_len <= 4 or is_all_stopwords):
                primary_font = "Playfair Display" if is_hero_layer else "Outfit"
                accent_font = "Bodoni Moda" if is_hero_layer else "Inter"

            base_size = int(f_style.get("size_px_base", 50))
            relative_scale = float(f_style.get("relative_scale", 1.0 if is_hero_layer else 0.7))
            is_script = any(s in primary_font.lower() for s in ("exmouth", "champignon", "brotherhood", "bromello", "script", "cavas", "bucklane", "formale"))
            is_spencerian = any(s in primary_font.lower() for s in ("exmouth", "champignon", "brotherhood"))
            script_floor = 115 if is_spencerian else (80 if is_script else 50)

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
                    layer_fx = hero_fx_preset
                    layer_overlay = overlay_fx
                else:
                    font_size_px = max(55, min(75, int(base_size * 1.3 * max(0.7, relative_scale))))
                    resolved_weight = int(f_style.get("weight", 600))
                    layer_fx = _resolve_font_json_treatment(prof, layer_spec, is_hero=False, is_single_word=is_single_word, rng=rng, policy=policy, behind_subject=behind_subject)
                    layer_overlay = None
            # Average char aspect width ratio based on font type and letterform geometry
            is_ultra_tall = any(k in primary_font.lower() for k in ("anton", "bebas", "six caps", "teko", "saira", "senzabella", "oswald", "antenna"))
            is_script_aspect_font = any(k in primary_font.lower() or k in str(f_style.get("style", "")).lower() for k in ("script", "pinyon", "dancing", "italic", "great vibes", "alex"))
            is_wide_serif = any(k in primary_font.lower() for k in ("bodoni", "playfair", "cinzel", "prata", "cormorant", "didot", "caslon"))
            base_aspect = 0.40 if is_ultra_tall else (0.50 if is_script_aspect_font else (0.64 if is_wide_serif else 0.56))
            is_upper = str(casing).lower() == "uppercase" or str(f_style.get("casing", "")).lower() == "uppercase" or raw_layer_text.isupper()
            char_aspect = base_aspect * (1.35 if is_upper else 1.0)
            # Safe text margin: 820px on 1080 portrait gives rock-solid 130px margins on left and right
            max_safe_width = 1500 if is_landscape else 820

            if is_landscape:
                if behind_subject:
                    target_font_size = max(130, min(180, int(base_size * 2.4 * max(0.9, relative_scale))))
                    resolved_weight = int(f_style.get("weight", 900))
                    casing = f_style.get("casing", "uppercase")
                    layer_fx = hero_fx_preset
                    layer_overlay = overlay_fx
                elif is_hero_layer:
                    target_font_size = max(80, min(130, int(base_size * 1.8 * max(0.85, relative_scale))))
                    resolved_weight = int(f_style.get("weight", 800))
                    layer_fx = hero_fx_preset
                    layer_overlay = overlay_fx
                else:
                    target_font_size = max(55, min(75, int(base_size * 1.3 * max(0.7, relative_scale))))
                    resolved_weight = int(f_style.get("weight", 600))
                    layer_fx = _resolve_font_json_treatment(prof, layer_spec, is_hero=False, is_single_word=is_single_word, rng=rng, policy=policy, behind_subject=behind_subject)
                    layer_overlay = None
            elif behind_subject:
                # Responsive behind-subject typography scale respecting character length
                if clean_len <= 4:
                    target_font_size = 210
                elif clean_len <= 6:
                    target_font_size = 175
                elif clean_len <= 8:
                    target_font_size = 140
                elif clean_len <= 11:
                    target_font_size = 110
                else:
                    target_font_size = 85
                resolved_weight = int(f_style.get("weight", 900))
                casing = f_style.get("casing", "uppercase")
                layer_fx = hero_fx_preset or "apple_pro_display_hero_revealer"
                layer_overlay = overlay_fx
            elif is_hero_layer:
                is_script = any(s in primary_font.lower() for s in ("exmouth", "champignon", "brotherhood", "bromello", "script", "cavas", "bucklane", "formale"))
                is_spencerian = any(s in primary_font.lower() for s in ("exmouth", "champignon", "brotherhood"))
                script_floor = 115 if is_spencerian else 80
                scale_boost = 1.45 if is_spencerian else (1.30 if is_script else 1.0)
                if is_single_word:
                    # Single-word focal hero (100px–150px)
                    target_font_size = max(script_floor, min(155, int(base_size * 2.2 * max(0.85, relative_scale) * scale_boost)))
                else:
                    # Multi-word hero headline (80px–138px)
                    target_font_size = max(script_floor, min(138, int(base_size * 1.9 * max(0.8, relative_scale) * scale_boost)))
                if is_script:
                    target_font_size = max(script_floor, target_font_size)
                resolved_weight = int(f_style.get("weight", 800))
                layer_fx = hero_fx_preset
                layer_overlay = overlay_fx
            else:
                # Companion / secondary subtitle line (legible floor: 56px–78px; script floor: 80px)
                is_script = any(s in primary_font.lower() for s in ("exmouth", "champignon", "brotherhood", "bromello", "script", "cavas", "bucklane", "formale"))
                is_spencerian = any(s in primary_font.lower() for s in ("exmouth", "champignon", "brotherhood"))
                script_floor = 100 if is_spencerian else 80
                target_font_size = max(script_floor if is_script else 56, min(110 if is_script else 78, int(base_size * 1.35 * max(0.6, relative_scale))))
                resolved_weight = int(f_style.get("weight", 600))
                layer_fx = _resolve_font_json_treatment(prof, layer_spec, is_hero=False, is_single_word=is_single_word, rng=rng, policy=policy, behind_subject=behind_subject)
                layer_overlay = None

            if is_spencerian:
                legibility_floor = 115
            elif is_script:
                legibility_floor = 80
            elif is_hero_layer:
                legibility_floor = 80
            else:
                legibility_floor = 50

            char_aspect = get_font_char_aspect(primary_font, is_uppercase=is_upper)
            # Enforce max horizontal text width clamp with per-font aspect table and legibility floor
            max_size_for_width = int(max_safe_width / (clean_len * char_aspect))
            font_size_px = max(legibility_floor, min(target_font_size, max_size_for_width))

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

            if is_lockup_treatment:
                primary_font = "Apple Garamond"
                accent_font = "Apple Garamond"
                f_style["style"] = "italic"
                if is_hero_layer:
                    font_size_px = max(96, min(140, 120))
                    resolved_weight = 900
                    letter_spacing = -0.035
                    casing = "capitalize" if any(w[0].isupper() for w in layer_words) else "title"
                    layer_fx = "hierarchical_asymmetric_lockup"
                    layer_overlay = overlay_fx
                    style_treatment["verticalGradient"] = "linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 40%, #D4D4D4 100%)"
                    style_treatment["hasGradient"] = True
                    style_treatment["fontStyle"] = "italic"
                    style_treatment["fontFamily"] = "Apple Garamond"
                    style_treatment["shadow"] = "0 2px 10px rgba(0, 0, 0, 0.55)"
                else:
                    font_size_px = max(26, min(38, 34))  # 3:1 to 4:1 scale ratio
                    resolved_weight = 300
                    letter_spacing = 0.005  # Tracking floor: prevents script ligature collision & Arabic-like glyph distortion
                    casing = "lowercase"
                    layer_fx = "hierarchical_asymmetric_lockup"
                    layer_overlay = None
                    style_treatment["textFillColor"] = "#F2F2F2"
                    style_treatment["color"] = "#F2F2F2"
                    style_treatment["hasGradient"] = False
                    style_treatment["fontStyle"] = "italic"
                    style_treatment["fontFamily"] = "Apple Garamond"
                    style_treatment["shadow"] = "0 2px 10px rgba(0, 0, 0, 0.55)"
                    style_treatment["glow"] = "none"

            if is_see_through and not is_lockup_treatment:
                # Rectified glass letterform: the frame's opaque ink color is
                # authoritative. The renderer still adds the frosted glass
                # backplate + outline, but the glyphs themselves are always
                # solid and legible (never a translucent near-invisible fill).
                layer_fx = "see_through_glass_letterform"
                glass_fill = f_style.get("color") or "rgba(232, 196, 160, 0.95)"
                if "rgba" in str(glass_fill):
                    import re as _re
                    glass_fill = _re.sub(
                        r"(,\s*)0?\.\d+\s*\)$",
                        r"\g<1>0.95)",
                        str(glass_fill),
                    )
                style_treatment["textFillColor"] = glass_fill
                style_treatment["shadow"] = "0 2px 10px rgba(0, 0, 0, 0.55)"
                style_treatment["glow"] = "none"
                style_treatment["hasGradient"] = False
            elif is_3d_extrusion and is_hero_layer and not is_lockup_treatment:
                layer_fx = "metallic_chrome_countup_hero"
                style_treatment["shadow"] = "1px 1px 0 #0055b3, 2px 2px 0 #004499, 3px 3px 0 #003380, 4px 4px 0 #002266, 0 8px 24px rgba(0, 102, 255, 0.85)"

            wants_air_frontal = (
                not behind_subject
                and (
                    design_input.get("frontalTreatment") in ("air_frontal_optical_bloom", "in_the_air_diffusion_bloom", "atmospheric_optical_bloom", "frontal_air_bloom")
                    or design_input.get("textTreatment") in ("air_frontal_optical_bloom", "in_the_air_diffusion_bloom", "atmospheric_optical_bloom", "frontal_air_bloom")
                    or policy.get("frontalTreatment") in ("air_frontal_optical_bloom", "in_the_air_diffusion_bloom")
                    or layer_fx in ("air_frontal_optical_bloom", "in_the_air_diffusion_bloom")
                )
            )
            if wants_air_frontal:
                layer_fx = "air_frontal_optical_bloom"
                layer_overlay = "air_frontal_optical_bloom"
                style_treatment["gradient"] = "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 35%, #EDECE9 70%, #DCD7CD 100%)"
                style_treatment["verticalGradient"] = "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 35%, #EDECE9 70%, #DCD7CD 100%)"
                style_treatment["hasGradient"] = True
                style_treatment["glow"] = "drop-shadow(0 0 10px rgba(255, 255, 255, 0.35)) drop-shadow(0 0 22px rgba(255, 250, 240, 0.25))" if is_hero_layer else "none"
                style_treatment["shadow"] = "0 0 28px rgba(0, 0, 0, 0.45), 0 2px 14px rgba(0, 0, 0, 0.38), 0 0 6px rgba(0, 0, 0, 0.30)"
                style_treatment["opticalBloom"] = True
                style_treatment["edgeFeatherPx"] = 0.35
                style_treatment["backplateShadow"] = "0 0 28px rgba(0, 0, 0, 0.45), 0 2px 14px rgba(0, 0, 0, 0.38), 0 0 6px rgba(0, 0, 0, 0.30)"
                style_treatment["atmosphericBlend"] = "screen"
                style_treatment["treatmentOverlay"] = "air_frontal_optical_bloom"

            wants_chiseled_prism = (
                not behind_subject
                and (
                    layer_fx in ("chiseled_prism_metallic", "prism_chisel_hard_bevel")
                    or design_input.get("textTreatment") in ("chiseled_prism_metallic", "prism_chisel_hard_bevel")
                    or (is_special_ops_system and is_single_word and is_hero_layer and idx % 3 == 0)
                )
            )
            if wants_chiseled_prism:
                layer_fx = "chiseled_prism_metallic"
                resolved_weight = max(800, resolved_weight)
                split_gradient = "linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 47%, #334155 49%, #1E293B 100%)"
                style_treatment["gradient"] = split_gradient
                style_treatment["verticalGradient"] = split_gradient
                style_treatment["hasGradient"] = True
                style_treatment["textFillColor"] = "#FFFFFF"
                style_treatment["glow"] = "0 0 14px rgba(255, 255, 255, 0.35)" if is_hero_layer else "none"
                style_treatment["shadow"] = "0 1px 0 #CBD5E1, 0 -1px 0 #0F172A, 0 8px 24px rgba(0, 0, 0, 0.95), 0 2px 8px rgba(0, 0, 0, 0.90)"
                style_treatment["boundaryStroke"] = "2.5px rgba(0, 0, 0, 0.95)"
                style_treatment["chiseledPrism"] = True
                style_treatment["treatmentOverlay"] = "chiseled_prism_metallic"

            wants_vjkt = (
                not behind_subject
                and (
                    layer_fx in ("vj_kinetic_typography", "vjkt", "vj_kinetic")
                    or design_input.get("textTreatment") in ("vj_kinetic_typography", "vjkt")
                )
            )
            if wants_vjkt:
                layer_fx = "vj_kinetic_typography"
                resolved_weight = max(800, resolved_weight)
                style_treatment["treatmentOverlay"] = "vj_kinetic_typography"
                style_treatment["vjkt"] = True

            if is_lockup_treatment:
                letter_spacing = -0.035 if is_hero_layer else 0.005
            else:
                letter_spacing = float(f_style.get("letter_spacing_em", 0.01))
                if is_single_word and is_hero_layer:
                    letter_spacing = max(0.04, letter_spacing)

            base_size = max(1.0, float(f_style.get("size_px_base", 60)))
            vertical_margin_top = float(f_style.get("vertical_margin_top_px", 0))
            if vertical_margin_top != 0:
                # Proportional scaling to the target font size
                overlap_ratio = vertical_margin_top / base_size
                margin_top_px = round(overlap_ratio * font_size_px)
            else:
                margin_top_px = 0

            # Content-blind overlap grammar: identify trailing conversational tags
            # ("right", "true", "yeah", "too") to assign negative vertical overlap tucks
            clean_tag = raw_layer_text.strip().strip(".,!?:;\"'").lower()
            if margin_top_px == 0 and layer_idx > 0 and clean_tag in {"right", "true", "yeah", "too", "ok", "okay", "yes", "sure"}:
                margin_top_px = -round(font_size_px * 0.28)

            # Descender / script-swash collision avoidance policy:
            # If the preceding line contains descenders ('g','j','p','q','y','Q') OR the
            # preceding/hero line uses a script font (looped tails hang far below the
            # baseline without containing descender letters) OR the preceding line is a
            # larger hero glyph, aggressive negative margins crash into those hanging
            # tails. Clamp to safe clearance.
            if margin_top_px < 0 and layer_idx > 0 and len(rendered_layers) > 0:
                prev_layer = rendered_layers[-1]
                prev_text = str(prev_layer.get("rawText", ""))
                has_descenders = any(ch in prev_text for ch in "gjpqyQ")
                prev_is_script = str(prev_layer.get("fontFamily", "")).lower() in SCRIPT_FONT_CLEARANCE_FONTS
                prev_is_larger = float(prev_layer.get("fontSizePx", 0)) > font_size_px * 1.15
                if has_descenders or prev_is_script or prev_is_larger:
                    margin_top_px = max(-4, margin_top_px // 3)

            is_overlapping = margin_top_px < 0

            # Spatial Layout Archetypes: Cascading Diagonal Step, Shoulder Overlap, & Cortex Tri-Stack
            margin_left_px = int(f_style.get("margin_left_px", layer_spec.get("margin_left_px", 0)))
            align_self = str(f_style.get("align_self", layer_spec.get("align_self", "center")))
            pid = str(prof.get("id", ""))
            ts_meta = str(prof.get("metadata", {}).get("treatment_system", "")).lower()

            if margin_left_px == 0 and align_self == "center":
                if pid in ("image (52)", "image (53)", "image (54)", "image (55)") or "diagonal" in ts_meta:
                    margin_left_px = layer_idx * 48
                    align_self = "flex-start"
                elif pid == "image (7)":
                    if layer_idx == 0:
                        margin_left_px = -36
                        align_self = "center"
                    else:
                        margin_left_px = 24
                        align_self = "center"
                elif pid == "image (97)":
                    if layer_idx == 0:
                        align_self = "flex-end"
                        margin_left_px = 0
                    elif layer_idx == 1:
                        align_self = "center"
                        margin_left_px = 0
                    else:
                        align_self = "flex-start"
                        margin_left_px = 0
                elif pid == "image (58)":
                    align_self = "flex-start"

            inline_swaps = list(v2_layer.get("inlineTokenSwaps", []))
            if not inline_swaps and (
                layer_fx == "vercel_kinetic_highlight_box"
                or (hero_fx_preset == "vercel_kinetic_highlight_box" and is_hero_layer)
                or (layer_spec.get("effects") or {}).get("highlightBox")
            ):
                layer_words_list = [w.strip() for w in raw_layer_text.split() if w.strip()]
                if layer_words_list:
                    stopwords = {
                        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
                        "with", "by", "is", "was", "are", "were", "be", "this", "that", "it",
                    }
                    focus_idx = 0
                    best_len = -1
                    for w_i, w in enumerate(layer_words_list):
                        clean_w = w.lower().strip(".,!?:;\"'")
                        if clean_w not in stopwords and len(clean_w) > best_len:
                            best_len = len(clean_w)
                            focus_idx = w_i

                    inline_swaps.append({
                        "wordIndex": focus_idx,
                        "pattern": layer_words_list[focus_idx],
                        "highlightBox": True,
                        "scaleMultiplier": 1.06,
                    })

            # Strict Tall-stack contract: canva_tall_glyph_stack (and vertical tower fx)
            # is strictly restricted to single-word layers and behind-subject only.
            # Multi-word layers get horizontal alternatives.
            if layer_fx == "canva_tall_glyph_stack" and not (behind_subject or len(layer_words) <= 1):
                layer_fx = "multi_word_slide_up_stagger" if not is_hero_layer else "dynamic_staggered_character_cascade"

            # Strict Companion Font Contract: companion layers must never emit barred decorative or alternate fonts
            if not is_hero_layer:
                if is_barred_companion_font(primary_font):
                    primary_font = rng.choice(COMPANION_UPGRADE_FONTS) if rng else "Montserrat"
                if is_barred_companion_font(accent_font):
                    accent_font = rng.choice(COMPANION_UPGRADE_FONTS) if rng else "Montserrat"

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
                "lineHeight": (0.88 if is_hero_layer else 1.0) if is_lockup_treatment else float(f_style.get("line_height", 1.05)),
                "marginTopPx": margin_top_px,
                "marginLeftPx": margin_left_px,
                "alignSelf": align_self,
                "isHero": is_hero_layer,
                "fxPreset": layer_fx,
                "entryLeadMs": _entry_lead_ms(policy, signal, is_hero_layer, layer_fx),
                "behindSubject": behind_subject,
                "treatmentOverlay": layer_overlay,
                "frontalTreatment": "air_frontal_optical_bloom" if wants_air_frontal else None,
                "opticalBloom": style_treatment.get("opticalBloom", False),
                "edgeFeatherPx": style_treatment.get("edgeFeatherPx"),
                "backplateShadow": style_treatment.get("backplateShadow"),
                "atmosphericBlend": style_treatment.get("atmosphericBlend"),
                "chiseledPrism": bool(style_treatment.get("chiseledPrism", False)),
                "boundaryStroke": style_treatment.get("boundaryStroke"),
                "vjkt": bool(style_treatment.get("vjkt", False)),
                "selection": {
                    "role": "hero" if is_hero_layer else "companion",
                    "primaryFx": layer_fx,
                    "overlayFx": layer_overlay,
                    "cadenceMs": round(signal["cadenceMs"]),
                },
                "gradient": style_treatment["gradient"],
                "glow": style_treatment["glow"] if is_hero_layer else "none",
                "shadow": style_treatment["shadow"],
                "textFillColor": style_treatment["textFillColor"],
                "hasGradient": style_treatment["hasGradient"] or bool(layer_effects.get("vertical_gradient") or layer_effects.get("verticalGradient")),
                "verticalGradient": (
                    style_treatment.get("verticalGradient")
                    or layer_effects.get("vertical_gradient")
                    or layer_effects.get("verticalGradient")
                ),
                "specularChamfer": style_treatment.get("specularChamfer", True),
                "specularSheen": style_treatment.get("specularSheen", True),
                "specularAngle": style_treatment.get("specularAngle", -35),
                "volumetricShading": style_treatment.get("volumetricShading", True),
                "contactShadow": style_treatment.get("contactShadow", "0 2px 10px rgba(0, 0, 0, 0.55)"),
                "ambientShadow": style_treatment.get("ambientShadow", "none"),
                "opticalBleed": style_treatment.get("opticalBleed") if is_hero_layer else "none",
                "doubleUnderline": bool(layer_effects.get("double_underline", False)),
                "isOverlapping": is_overlapping,
                "isUnderlapping": False,
                "isOverlayAtop": False,
                "zIndex": int(layer_spec.get("z_index")) if "z_index" in layer_spec else ((layer_idx + 1) * 2 if is_overlapping else layer_idx + 1),
                "depthZPx": 140 if is_hero_layer else (-110 if behind_subject else (-30 if layer_idx > 0 else 0)),
                "focusPriority": 1 if is_hero_layer else (3 if behind_subject else 2),
                "fill": v2_layer.get("fill") or {"type": "solid", "color": style_treatment["textFillColor"]},
                "stroke": v2_layer.get("stroke"),
                "materiality": v2_layer.get("materiality") or {
                    "opacity": 1.0,
                    "blendMode": "normal",
                    "dropShadow": {"offsetX": 0, "offsetY": 4, "blur": 18, "color": "rgba(0, 0, 0, 0.95)"} if not style_treatment.get("glow") else None,
                    "glow": {"radiusPx": 12, "color": style_treatment.get("glow"), "intensity": 0.75} if style_treatment.get("glow") and style_treatment.get("glow") != "none" else None,
                },
                "occlusion": v2_layer.get("occlusion") or {
                    "mode": "partial_head_clip" if behind_subject else "none",
                    "depthPlane": 45 if behind_subject else 0,
                    "clipBoundary": "silhouette",
                    "partialOverlapPercent": 25 if behind_subject else 0,
                },
                "stagger": v2_layer.get("stagger") or {
                    "dxPercent": 0.0,
                    "dyPercent": 0.0,
                    "rotationDeg": 0.0,
                    "scaleMultiplier": 1.0,
                    "scaleX": 1.0,
                    "scaleY": 1.0,
                    "arcWarpDeg": 0.0,
                    "skewXDeg": 0.0,
                    "skewYDeg": 0.0,
                    "stretchRatio": 1.0,
                },
                "inlineTokenSwaps": inline_swaps,
            })

        # Chunk-level width preflight: largest-first shrink with legibility floors
        # (companion floor 50px, hero floor 80px)
        preflight_and_fit_layer_widths(rendered_layers, max_safe_width=max_safe_width)

        # Resolve inter-layer stacking hierarchy, overlay depth shadows, and underlapping vertical linear gradients
        num_rend = len(rendered_layers)
        for i in range(1, num_rend):
            curr_layer = rendered_layers[i]
            prev_layer = rendered_layers[i - 1]
            curr_spec = allocations[i].get("layer", {})
            prev_spec = allocations[i - 1].get("layer", {})
            prev_effects = prev_spec.get("effects", {})
            curr_effects = curr_spec.get("effects", {})

            # Check if current layer steps upward over previous layer
            if curr_layer.get("marginTopPx", 0) < 0:
                prev_role = str(prev_layer.get("role", "")).lower()
                prev_name = str(prev_layer.get("layerName", "")).lower()
                prev_font = str(prev_layer.get("fontFamily", "")).lower()
                prev_style = str(prev_layer.get("fontStyle", "")).lower()

                # Archetype A: Top Flourish / Script / Accent Overlay placed ATOP the base word
                # (e.g. image (124) 'My Signature', 'Special for you...')
                is_prev_atop = (
                    prev_role in ("accent_top_overlay", "overlay")
                    or prev_name in ("flourish_script_top", "overlay_script", "script_overlay")
                    or pid == "image (124)"
                    or (prev_style == "italic" and any(k in prev_font for k in ("script", "vibes", "brush", "alex", "dancing", "exmouth", "champignon")) and curr_layer.get("isHero"))
                    or (int(prev_spec.get("z_index", 0)) > int(curr_spec.get("z_index", 0)) if ("z_index" in prev_spec and "z_index" in curr_spec) else False)
                )

                if is_prev_atop:
                    # Top layer sits in front atop the base layer
                    prev_layer["zIndex"] = int(prev_spec.get("z_index", 10))
                    prev_layer["isOverlapping"] = True
                    prev_layer["isOverlayAtop"] = True
                    prev_layer["shadow"] = "0 6px 20px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.90)"
                    curr_layer["zIndex"] = int(curr_spec.get("z_index", 2))
                    curr_layer["isUnderlapping"] = True
                    curr_layer["isOverlapping"] = False
                    if curr_effects.get("vertical_gradient") or curr_effects.get("verticalGradient"):
                        curr_layer["verticalGradient"] = curr_effects.get("vertical_gradient") or curr_effects.get("verticalGradient")
                        curr_layer["hasGradient"] = True
                else:
                    # Archetype B: Standard Overlap where current layer steps in front,
                    # and the rear underlapping layer receives a vertical linear gradient fade to transparent
                    # (e.g. image (150) 'over again', image (151) 'zoom-out effect', image (152) 'unreadable overlapping')
                    curr_layer["zIndex"] = int(curr_spec.get("z_index", (i + 1) * 2))
                    curr_layer["isOverlapping"] = True
                    curr_layer["shadow"] = "0 6px 22px rgba(0, 0, 0, 0.95), 0 2px 8px rgba(0, 0, 0, 0.90)"

                    prev_layer["zIndex"] = int(prev_spec.get("z_index", i))
                    prev_layer["isUnderlapping"] = True
                    prev_color = prev_layer.get("textFillColor") or prev_layer.get("color") or "#FFFFFF"
                    # The rear layer under the step receives the linear vertical gradient that fades downwards into the screen
                    if not prev_layer.get("verticalGradient"):
                        prev_layer["verticalGradient"] = (
                            prev_effects.get("vertical_gradient")
                            or prev_effects.get("verticalGradient")
                            or f"linear-gradient(180deg, {prev_color} 0%, {prev_color} 40%, rgba(255, 255, 255, 0.15) 85%, transparent 100%)"
                        )
                        prev_layer["hasGradient"] = True

        manifest_chunks.append({
            "chunkIndex": chunk.get("chunkIndex", idx + 1),
            "text": raw_text,
            "profileId": prof["id"],
            "profileName": prof["profile_name"],
            "profileFilename": prof["filename"],
            "pairedImage": prof.get("paired_image"),
            "paletteId": palette_id,
            "palette": chunk_palette,
            "fxPreset": "air_frontal_optical_bloom" if wants_air_frontal else hero_fx_preset,
            "frontalTreatment": "air_frontal_optical_bloom" if wants_air_frontal else None,
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
            "placement": (
                {
                    "xPercent": "50%",
                    "yPercent": "24%",
                    "anchor": "center",
                    "dominantZone": "cranial_crown",
                }
                if behind_subject
                # Font-JSON layout_rules honoring is mini-run (9:16) only —
                # the landscape composition keeps its own placement regime.
                else (_layout_rules_placement(prof) if not is_landscape else {
                    "xPercent": "50%",
                    "yPercent": "54%",
                    "anchor": "center",
                    "dominantZone": "foreground_lower_deck",
                })
            ),
            "sourceStartMs": chunk.get("sourceStartMs", chunk.get("startMs", 0)),
            "sourceEndMs": chunk.get("sourceEndMs", chunk.get("endMs", 0)),
            "outputStartMs": chunk.get("outputStartMs", chunk.get("startMs", 0)),
            "outputEndMs": chunk.get("outputEndMs", chunk.get("endMs", 0)),
            "displayStartMs": chunk.get("displayStartMs", chunk.get("outputStartMs", chunk.get("startMs", 0))),
            "displayEndMs": chunk.get("displayEndMs", chunk.get("outputEndMs", chunk.get("endMs", 0))),
            "startMs": chunk.get("startMs", 0),
            "endMs": chunk.get("endMs", 0),
            "layers": rendered_layers,
            "words": chunk_word_objs,
            "listicle": listicle_planning["plans"].get(idx),
            "treatmentSystem": "hierarchical_asymmetric_lockup" if is_lockup_treatment else prof.get("metadata", {}).get("treatment_system", ""),
            "lockupOption": resolved_lockup_opt if is_lockup_treatment else None,
            "lockupAnimationMode": (
                design_input.get("lockupAnimationMode")
                or ("spatial_push_spring", "blue_lantern_magnetic", "cinematic_slide_up", "docking_modifier", "kinetic_impact_snap")[idx % 5]
            ) if is_lockup_treatment else None,
            "chiseledPrism": any(l.get("chiseledPrism") for l in rendered_layers),
            "vjkt": any(l.get("vjkt") for l in rendered_layers),
            "profile": v2_prof,
            "profileV2": v2_prof,
            "annotations": v2_prof.get("annotations", []) if v2_prof else [],
            "subjectZone": v2_prof.get("subjectZone", {}) if v2_prof else {},
            "frameTreatment": v2_prof.get("frameTreatment", {}) if v2_prof else {},
        })

    difference_chunk_indices = _select_difference_chunk_indices(
        manifest_chunks,
        rng,
        creativity=policy.get("creativity", "balanced"),
    )
    knockout_variants = ("difference_exclusion", "luma_inversion", "negative_space_cutout")
    for position in difference_chunk_indices:
        chunk = manifest_chunks[position]
        variant = knockout_variants[position % len(knockout_variants)]
        chunk["selection"]["blendMode"] = "difference"
        chunk["seeThrough"] = True
        chunk["blendMode"] = "difference"
        chunk["isKnockout"] = True
        chunk["knockoutVariant"] = variant
        chunk["boundaryStroke"] = "0.85px rgba(255, 255, 255, 0.75)"
        chunk["refractionDispersion"] = True
        chunk["chromaticAberration"] = {
            "redOffsetPx": -0.85,
            "blueOffsetPx": 0.85,
            "blurPx": 1.0,
        }
        for layer in chunk["layers"]:
            layer.update({
                "blendMode": "difference",
                "isSeeThrough": True,
                "isKnockout": True,
                "knockoutVariant": variant,
                "boundaryStroke": "0.85px rgba(255, 255, 255, 0.75)",
                "refractionDispersion": True,
                "chromaticAberration": {
                    "redOffsetPx": -0.85,
                    "blueOffsetPx": 0.85,
                    "blurPx": 1.0,
                },
                "color": "#FFFFFF",
                "gradient": "none",
                "glow": "none",
                "shadow": "none",
                "textFillColor": "#FFFFFF",
                "hasGradient": False,
                "doubleUnderline": False,
            })

    # Stamp the pivot-satellite composition marker on every chunk (Bug C) so the
    # renderer can lay the core word centered with satellites anchored to it.
    for chunk in manifest_chunks:
        chunk["pivotLayout"] = select_pivot_layout(chunk)

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
        "motif": motif_plan,
        "palettePolicy": "brand_motif" if motif_plan else ("explicit" if explicit_palette_id else "balanced_curated_variation"),
        "selectionPolicy": policy,
        "selectionMode": selection_mode,
        "selectionSeed": seed_str if selection_mode == "seed" else selection_nonce,
        "selectionNonce": selection_nonce,
        "eligiblePortraitProfileCount": len(profiles),
        "listicleCatalog": listicle_planning,
        "runtimeTreatmentCatalog": [item["id"] for item in ANIMA_RUNTIME_TREATMENTS],
        "specialOpsEnabled": is_special_ops_system,
        "specialOpsCatalog": [
            "chiseled_prism_metallic",
            "vj_kinetic_typography",
            "difference_mode_inversion",
            "air_frontal_optical_bloom",
            "see_through_glass_letterform",
            "hierarchical_asymmetric_lockup",
        ],
        "semanticConceptLedger": concept_ledger.as_dict(),
        "chunks": manifest_chunks,
        "profile": manifest_chunks[0].get("profile") if manifest_chunks else None,
        "profileV2CatalogVersion": "typography-profile-v2-catalog-1.0",
    }
    return font_manifest
