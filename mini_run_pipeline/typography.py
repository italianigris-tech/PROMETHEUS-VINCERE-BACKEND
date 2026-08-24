"""Multi-layer editorial graphic typography engine for 9:16 short form content.

Strictly excludes landscape JSONs and executes full multi-layer font pairing,
faithful gradient & glow realization, and mid-section stage placement.
"""

from __future__ import annotations

import os
import json
import glob
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


BASIC_FONTS = {"dm sans", "roboto", "open sans", "inter", "arial", "helvetica", "sans-serif", "system-ui"}


def upgrade_font_candidate(font_name: str, is_hero: bool, role: str = "body") -> str:
    """Upgrade basic / generic fonts to authoritative cinematic editorial fonts."""
    f_clean = font_name.lower().strip()
    if f_clean in BASIC_FONTS or not font_name:
        if is_hero:
            return "Bodoni Moda"
        else:
            return "Playfair Display"
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


def load_all_portrait_font_json_profiles() -> List[Dict[str, Any]]:
    """Load STRICT 9:16 portrait font JSON profiles, excluding landscape files."""
    json_dir = FONT_JSON_DIR if FONT_JSON_DIR.exists() else OPT_FONT_DIR
    pairs_dir = FONT_PAIRS_DIR if FONT_PAIRS_DIR.exists() else OPT_PAIRS_DIR
    profiles = []

    if json_dir.exists():
        for file_path in sorted(json_dir.glob("*.json")):
            if "landscape" in file_path.name.lower():
                continue
            try:
                data = json.loads(file_path.read_text(encoding="utf-8"))
                pname = data.get("profile_name", file_path.stem)
                if "landscape" in pname.lower():
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
                    "metadata": meta,
                    "layout_rules": data.get("layout_rules", {}),
                    "typography_layers": layers,
                    "total_words": total_words,
                    "raw": data,
                })
            except Exception:
                pass
    return profiles


def resolve_layer_gradient_and_glow(
    profile_name: str,
    role: str,
    color: str,
    is_hero: bool,
    brand_palette: Dict[str, str]
) -> Dict[str, Any]:
    """Build pristine luxury editorial styling and subtle optical depth (ZERO harsh black halos)."""
    if is_hero:
        return {
            "gradient": "none",
            "glow": brand_palette.get("glow", "0 0 16px rgba(245, 230, 196, 0.45)"),
            "shadow": brand_palette.get("shadow", "0 2px 10px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)"),
            "textFillColor": brand_palette.get("hero_color", "#F5E6C4"),
            "hasGradient": False,
        }
    
    return {
        "gradient": "none",
        "glow": "none",
        "shadow": "0 2px 8px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.25)",
        "textFillColor": brand_palette.get("companion_color", "#FFFFFF"),
        "hasGradient": False,
    }


def generate_font_manifest(chunks: List[Dict[str, Any]], design_override: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    profiles = load_all_portrait_font_json_profiles()
    if not profiles:
        raise RuntimeError("No 9:16 portrait font JSON profiles found in directory!")

    manifest_chunks = []
    last_hero_preset = ""
    preset_usage_counts: Dict[str, int] = {p: 0 for p in KINETIC_HERO_PRESETS}
    
    # Ingest brand palette preferences from design override
    brand_input = (design_override or {}).get("brandMotif") or (design_override or {}).get("brand") or design_override
    brand_palette = resolve_brand_palette(brand_input)

    for idx, chunk in enumerate(chunks):
        raw_text = str(chunk.get("text", "")).strip()
        words = raw_text.split()
        if not words:
            continue

        word_count = len(words)
        chunk_word_objs = chunk.get("words", [])
        
        # Match profiles strictly by word count compatibility (2, 3, or 4 words)
        matching_profiles = [
            p for p in profiles 
            if abs(p.get("total_words", len(p.get("typography_layers", []))) - word_count) <= 1
            and len(p.get("typography_layers", [])) <= word_count
        ] or profiles

        prof_idx = idx % len(matching_profiles)
        prof = matching_profiles[prof_idx]

        # Kinetic motion selection for hero layer
        is_single_word = word_count == 1
        
        if is_single_word:
            single_candidates = [p for p in SINGLE_WORD_HERO_PRESETS if p != last_hero_preset] or SINGLE_WORD_HERO_PRESETS
            hero_fx_preset = single_candidates[idx % len(single_candidates)]
        else:
            candidates = [p for p in KINETIC_HERO_PRESETS if p != last_hero_preset]
            candidates.sort(key=lambda p: preset_usage_counts.get(p, 0))
            hero_fx_preset = candidates[idx % min(4, len(candidates))]

        preset_usage_counts[hero_fx_preset] = preset_usage_counts.get(hero_fx_preset, 0) + 1
        last_hero_preset = hero_fx_preset

        allocations = smart_partition_chunk_words(words, prof.get("typography_layers", []))
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
            candidates = layer_spec.get("matched_font_candidates", [])
            raw_primary = candidates[0] if candidates else "Playfair Display"
            raw_accent = candidates[1] if len(candidates) > 1 else raw_primary
            primary_font = upgrade_font_candidate(raw_primary, is_hero_layer, role)
            accent_font = upgrade_font_candidate(raw_accent, is_hero_layer, role)
            
            base_size = int(f_style.get("size_px_base", 54))
            # Proportional sizing for 1080x1920 canvas:
            if is_hero_layer:
                if is_single_word:
                    font_size_px = max(150, min(180, int(base_size * 2.8)))
                else:
                    font_size_px = max(130, min(165, int(base_size * 2.4)))
                layer_fx = hero_fx_preset
            else:
                font_size_px = max(68, min(88, int(base_size * 1.5)))
                layer_fx = "subpixel_glow_mask"

            # Weight floor: minimum 600 for companion, 800 for hero
            resolved_weight = max(600, int(f_style.get("weight", 700)))
            if is_hero_layer:
                resolved_weight = max(800, resolved_weight)

            raw_color = resolve_faithful_font_color(f_style.get("color"))
            style_treatment = resolve_layer_gradient_and_glow(
                prof["profile_name"], role, raw_color, is_hero_layer, brand_palette=brand_palette
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
            "fxPreset": hero_fx_preset,
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
        "composition": "PrometheusMinRun",
        "canvas": {"width": 1080, "height": 1920, "aspectRatio": "9:16"},
        "profileCount": len(profiles),
        "chunkCount": len(manifest_chunks),
        "brandPalette": brand_palette,
        "chunks": manifest_chunks,
    }
    return font_manifest
