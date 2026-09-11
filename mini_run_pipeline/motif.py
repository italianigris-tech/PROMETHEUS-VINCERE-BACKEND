"""Brand Motif System (motif / brandMotif) for Prometheus Mini-Run Pipeline.

A brand motif provides a cohesive visual identity across a video when enabled.
By default, the motif system is OFF (disabled) unless explicitly turned ON.

When enabled, the motif ingests up to 3 core brand colors:
1. Base / Companion Color (~60% weight, clean readable tone, e.g. #FFFFFF).
2. Primary Brand Color (~30% weight, signature tone for hero text & titles).
3. Accent / Punch Color (~10% weight, high-contrast spark).
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Curated Brand Motif Presets Library
# ---------------------------------------------------------------------------

MOTIF_PRESETS: Dict[str, Dict[str, Any]] = {
    "royal_amethyst": {
        "name": "Royal Amethyst",
        "description": "Regal purple and lavender tones with luminous clarity.",
        "colors": {
            "base": "#FFFFFF",
            "primary": "#C084FC",
            "accent": "#A78BFA",
            "glowRgb": "192, 132, 252",
            "volumetricGradient": "linear-gradient(180deg, #FFFFFF 0%, #F5EBFF 10%, #E0BFFC 24%, #C084FC 55%, #603099 88%, #783CAE 100%)",
            "companionGradient": "linear-gradient(180deg, #FFFFFF 0%, #FAF5FF 35%, #EDE9FE 70%, #DDD6FE 100%)",
        },
        "defaultFonts": {
            "primaryFamily": "Montserrat",
            "accentFamily": "Brushelva",
        },
    },
    "obsidian_crimson": {
        "name": "Obsidian Crimson",
        "description": "High-impact ruby red and crimson flame accents.",
        "colors": {
            "base": "#FFFFFF",
            "primary": "#FF453A",
            "accent": "#FF3B30",
            "glowRgb": "255, 69, 58",
            "volumetricGradient": "linear-gradient(180deg, #FFFFFF 0%, #FFE4E6 10%, #FDA4AF 24%, #FF453A 55%, #881337 88%, #9F1239 100%)",
            "companionGradient": "linear-gradient(180deg, #FFFFFF 0%, #FFF1F2 35%, #FFE4E6 70%, #FECDD3 100%)",
        },
        "defaultFonts": {
            "primaryFamily": "Montserrat ExtraBold",
            "accentFamily": "Futura Condensed",
        },
    },
    "electric_cyan": {
        "name": "Electric Cyan",
        "description": "Modern cyber cyan and deep neon blue highlights.",
        "colors": {
            "base": "#FFFFFF",
            "primary": "#00F0FF",
            "accent": "#00D2FF",
            "glowRgb": "0, 240, 255",
            "volumetricGradient": "linear-gradient(180deg, #FFFFFF 0%, #CFFAFE 10%, #A5F3FC 24%, #00F0FF 55%, #0E7490 88%, #0891B2 100%)",
            "companionGradient": "linear-gradient(180deg, #FFFFFF 0%, #F0FDFA 35%, #CCFBF1 70%, #99F6E4 100%)",
        },
        "defaultFonts": {
            "primaryFamily": "DIN Alternate",
            "accentFamily": "Helvetica Neue",
        },
    },
    "emerald_luxury": {
        "name": "Emerald Luxury",
        "description": "Prestige mint and deep emerald luxury palette.",
        "colors": {
            "base": "#FFFFFF",
            "primary": "#34D399",
            "accent": "#10B981",
            "glowRgb": "52, 211, 153",
            "volumetricGradient": "linear-gradient(180deg, #FFFFFF 0%, #D1FAE5 10%, #A7F3D0 24%, #34D399 55%, #064E3B 88%, #047857 100%)",
            "companionGradient": "linear-gradient(180deg, #FFFFFF 0%, #F0FDF4 35%, #DCFCE7 70%, #BBF7D0 100%)",
        },
        "defaultFonts": {
            "primaryFamily": "Playfair Display",
            "accentFamily": "Montserrat",
        },
    },
    "sunset_amber": {
        "name": "Sunset Amber",
        "description": "Warm golden amber, sunset orange, and rich champagne.",
        "colors": {
            "base": "#FFFFFF",
            "primary": "#FBBF24",
            "accent": "#F59E0B",
            "glowRgb": "251, 191, 36",
            "volumetricGradient": "linear-gradient(180deg, #FFFFFF 0%, #FEF08A 10%, #FDE047 24%, #FBBF24 55%, #854D0E 88%, #A16207 100%)",
            "companionGradient": "linear-gradient(180deg, #FFFFFF 0%, #FEFCE8 35%, #FEF9C3 70%, #FEF08A 100%)",
        },
        "defaultFonts": {
            "primaryFamily": "Anton",
            "accentFamily": "Brushelva",
        },
    },
    "coral_punch": {
        "name": "Coral Punch",
        "description": "High-energy hot coral and vivid magenta spark.",
        "colors": {
            "base": "#FFFFFF",
            "primary": "#FB7185",
            "accent": "#F43F5E",
            "glowRgb": "251, 113, 133",
            "volumetricGradient": "linear-gradient(180deg, #FFFFFF 0%, #FFE4E6 10%, #FECDD3 24%, #FB7185 55%, #9F1239 88%, #BE123C 100%)",
            "companionGradient": "linear-gradient(180deg, #FFFFFF 0%, #FFF1F2 35%, #FFE4E6 70%, #FECDD3 100%)",
        },
        "defaultFonts": {
            "primaryFamily": "Montserrat Black",
            "accentFamily": "Futura",
        },
    },
    "pure_editorial_mono": {
        "name": "Pure Editorial Mono",
        "description": "Minimalist high-contrast platinum white and slate.",
        "colors": {
            "base": "#FFFFFF",
            "primary": "#FFFFFF",
            "accent": "#F1F5F9",
            "glowRgb": "255, 255, 255",
            "volumetricGradient": "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 15%, #F1F5F9 35%, #E2E8F0 65%, #94A3B8 88%, #CBD5E1 100%)",
            "companionGradient": "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 35%, #F1F5F9 70%, #E2E8F0 100%)",
        },
        "defaultFonts": {
            "primaryFamily": "Helvetica Neue",
            "accentFamily": "Georgia",
        },
    },
}


# ---------------------------------------------------------------------------
# Color Parsing Helpers
# ---------------------------------------------------------------------------

def _hex_to_rgb(hex_code: str) -> Tuple[int, int, int]:
    """Convert hex color string to RGB tuple."""
    hex_clean = hex_code.lstrip("#").strip()
    if len(hex_clean) == 3:
        hex_clean = "".join(c * 2 for c in hex_clean)
    if len(hex_clean) >= 6:
        try:
            return (
                int(hex_clean[0:2], 16),
                int(hex_clean[2:4], 16),
                int(hex_clean[4:6], 16),
            )
        except ValueError:
            pass
    return (255, 255, 255)


def _format_rgb_string(rgb: Tuple[int, int, int]) -> str:
    return f"{rgb[0]}, {rgb[1]}, {rgb[2]}"


# ---------------------------------------------------------------------------
# Core Motif Resolver
# ---------------------------------------------------------------------------

def resolve_brand_motif(
    design: Optional[Dict[str, Any]] = None,
    data: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Ingest brand motif options and return a structured Brand Motif Schema.

    Returns None if Motif is OFF/disabled (the default behaviour).
    """
    design_dict = design if isinstance(design, dict) else {}
    data_dict = data if isinstance(data, dict) else {}

    # Check potential motif entry points in order of specificity
    raw_motif = (
        design_dict.get("motif")
        or design_dict.get("brandMotif")
        or data_dict.get("motif")
        or data_dict.get("brandMotif")
        or design_dict.get("brand")
        or data_dict.get("brand")
    )

    if raw_motif is None or raw_motif is False or str(raw_motif).lower().strip() in ("none", "auto", "default", "disabled"):
        return None

    # Handle boolean true (enable default royal amethyst)
    if raw_motif is True:
        preset = MOTIF_PRESETS["royal_amethyst"]
        return _build_motif_manifest("royal_amethyst", preset["colors"], preset["defaultFonts"])

    # Handle string preset name (e.g. "royal_amethyst", "purple", "crimson")
    if isinstance(raw_motif, str):
        motif_key = raw_motif.lower().strip()
        matched_preset_key = _match_preset_name(motif_key)
        if matched_preset_key:
            preset = MOTIF_PRESETS[matched_preset_key]
            return _build_motif_manifest(matched_preset_key, preset["colors"], preset["defaultFonts"])
        # If it's a hex code string (e.g. "#C084FC")
        if motif_key.startswith("#"):
            custom_colors = {
                "base": "#FFFFFF",
                "primary": raw_motif.strip(),
                "accent": raw_motif.strip(),
                "glowRgb": _format_rgb_string(_hex_to_rgb(raw_motif)),
            }
            return _build_motif_manifest("custom", custom_colors, None)
        return None

    # Handle dictionary config (e.g. {"enabled": True, "colors": {...}, "preset": "royal_amethyst"})
    if isinstance(raw_motif, dict):
        enabled = raw_motif.get("enabled", True)
        if not enabled:
            return None

        preset_name = raw_motif.get("preset") or raw_motif.get("name") or raw_motif.get("motif")
        matched_preset_key = _match_preset_name(str(preset_name).lower().strip()) if preset_name else None
        base_preset = MOTIF_PRESETS.get(matched_preset_key or "royal_amethyst")

        colors_input = raw_motif.get("colors") or raw_motif
        base_color = str(colors_input.get("base") or colors_input.get("companion_color") or colors_input.get("companion") or "#FFFFFF")
        primary_color = str(colors_input.get("primary") or colors_input.get("hero_color") or colors_input.get("hero") or base_preset["colors"]["primary"])
        accent_color = str(colors_input.get("accent") or colors_input.get("accent_border") or primary_color)
        
        rgb = _hex_to_rgb(primary_color)
        glow_rgb = colors_input.get("glowRgb") or _format_rgb_string(rgb)

        resolved_colors = {
            "base": base_color,
            "primary": primary_color,
            "accent": accent_color,
            "glowRgb": glow_rgb,
        }

        fonts_input = raw_motif.get("fonts") or raw_motif.get("defaultFonts")
        resolved_fonts = None
        if isinstance(fonts_input, dict):
            resolved_fonts = {
                "primaryFamily": fonts_input.get("primaryFamily") or fonts_input.get("primary"),
                "accentFamily": fonts_input.get("accentFamily") or fonts_input.get("accent"),
            }

        return _build_motif_manifest(matched_preset_key or "custom", resolved_colors, resolved_fonts)

    return None


def _match_preset_name(name_str: str) -> Optional[str]:
    """Fuzzy match user string to curated motif presets."""
    if name_str in MOTIF_PRESETS:
        return name_str
    if any(k in name_str for k in ("purple", "amethyst", "violet", "royal")):
        return "royal_amethyst"
    if any(k in name_str for k in ("red", "crimson", "ruby", "obsidian")):
        return "obsidian_crimson"
    if any(k in name_str for k in ("cyan", "blue", "electric", "neon", "aqua")):
        return "electric_cyan"
    if any(k in name_str for k in ("green", "emerald", "mint", "jade")):
        return "emerald_luxury"
    if any(k in name_str for k in ("yellow", "gold", "amber", "sunset", "orange")):
        return "sunset_amber"
    if any(k in name_str for k in ("pink", "coral", "rose", "magenta", "punch")):
        return "coral_punch"
    if any(k in name_str for k in ("mono", "white", "editorial", "silver", "minimal")):
        return "pure_editorial_mono"
    return None


def _build_motif_manifest(
    preset_key: str,
    colors: Dict[str, str],
    fonts: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Construct full Brand Motif manifest with 3D physical lighting and volumetric gradients."""
    primary = colors.get("primary", "#C084FC")
    base = colors.get("base", "#FFFFFF")
    accent = colors.get("accent", primary)
    glow_rgb = colors.get("glowRgb", "192, 132, 252")

    preset_data = MOTIF_PRESETS.get(preset_key, {})
    preset_colors = preset_data.get("colors", {})
    volumetric_grad = (
        colors.get("volumetricGradient")
        or preset_colors.get("volumetricGradient")
        or f"linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 15%, {primary} 55%, {primary} 100%)"
    )
    companion_grad = (
        colors.get("companionGradient")
        or preset_colors.get("companionGradient")
        or "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 35%, #EDECE9 70%, #DCD7CD 100%)"
    )

    multi_tier_shadow = (
        "0 3px 6px rgba(0, 0, 0, 0.95), "
        "0 1px 2px rgba(0, 0, 0, 0.90), "
        "0 12px 30px rgba(0, 0, 0, 0.55), "
        "0 4px 14px rgba(0, 0, 0, 0.40)"
    )

    return {
        "enabled": True,
        "preset": preset_key,
        "name": preset_data.get("name", "Custom Brand Motif"),
        "colors": {
            "base": base,
            "primary": primary,
            "accent": accent,
            "glowRgb": glow_rgb,
            "heroColor": primary,
            "companionColor": base,
            "accentBorder": accent,
            "glow": f"0 0 18px rgba({glow_rgb}, 0.50)",
            "shadow": multi_tier_shadow,
            "volumetricGradient": volumetric_grad,
            "companionGradient": companion_grad,
            "specularChamfer": True,
            "specularAngle": -35,
            "contactShadow": "0 3px 6px rgba(0, 0, 0, 0.95)",
            "ambientShadow": "0 12px 30px rgba(0, 0, 0, 0.55)",
            "opticalBleed": f"0 0 16px rgba({glow_rgb}, 0.50)",
        },
        "fonts": fonts or preset_data.get("defaultFonts", {}),
        "zone": {
            "name": preset_key,
            "primary": primary,
            "accent": accent,
            "base": base,
            "keyword": primary,
            "glow_rgb": glow_rgb,
            "volumetric_gradient": volumetric_grad,
            "companion_gradient": companion_grad,
        },
        "policy": "brand_motif_resonance",
    }


def motif_to_brand_palette(motif_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Convert resolved motif manifest into standard typography brand palette."""
    colors = motif_dict.get("colors", {})
    zone = motif_dict.get("zone", {})
    return {
        "id": motif_dict.get("preset", "custom_motif"),
        "hero_color": colors.get("primary", "#C084FC"),
        "companion_color": colors.get("base", "#FFFFFF"),
        "accent_border": colors.get("accent", "#A78BFA"),
        "glow": colors.get("glow", "0 0 14px rgba(192, 132, 252, 0.35)"),
        "shadow": colors.get("shadow", "0 2px 10px rgba(0, 0, 0, 0.55)"),
        "volumetric_gradient": colors.get("volumetricGradient"),
        "companion_gradient": colors.get("companionGradient"),
        "specular_chamfer": colors.get("specularChamfer", True),
        "specular_angle": colors.get("specularAngle", -35),
        "contact_shadow": colors.get("contactShadow", "0 2px 10px rgba(0, 0, 0, 0.55)"),
        "ambient_shadow": colors.get("ambientShadow", "none"),
        "optical_bleed": colors.get("opticalBleed"),
        "zone": zone,
        "isMotif": True,
        "motifName": motif_dict.get("name"),
    }
