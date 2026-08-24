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


def apply_casing_strategy(text: str, casing: Optional[str]) -> str:
    if not casing or casing == "normal":
        return text
    if casing == "lowercase":
        return text.lower()
    if casing == "uppercase":
        return text.upper()
    if casing in ("title_case", "capitalize"):
        return " ".join(w.capitalize() for w in text.split())
    return text


def allocate_words_to_layers(profile_layers: List[Dict[str, Any]], token_count: int) -> List[Dict[str, Any]]:
    """Deterministically partition chunk words across the Font JSON profile's layers."""
    if not profile_layers:
        return [{"layer": {}, "wordCount": token_count}]
    
    active_layers = profile_layers if token_count >= len(profile_layers) else profile_layers[:token_count]
    observed_total = sum(l.get("word_count", 1) for l in active_layers) or 1
    ideals = [(token_count * l.get("word_count", 1)) / observed_total for l in active_layers]
    counts = [max(1, int(ideal)) for ideal in ideals]

    while sum(counts) < token_count:
        max_deficit = -999.0
        max_idx = 0
        for idx, ideal in enumerate(ideals):
            deficit = ideal - counts[idx]
            if deficit > max_deficit:
                max_deficit = deficit
                max_idx = idx
        counts[max_idx] += 1

    while sum(counts) > token_count:
        max_removable = -999.0
        max_idx = 0
        for idx, ideal in enumerate(ideals):
            if counts[idx] > 1:
                removable = counts[idx] - ideal
                if removable > max_removable:
                    max_removable = removable
                    max_idx = idx
        counts[max_idx] -= 1

    return [{"layer": layer, "wordCount": counts[idx]} for idx, layer in enumerate(active_layers)]


def load_all_portrait_font_json_profiles() -> List[Dict[str, Any]]:
    """Load STRICT 9:16 portrait font JSON profiles, excluding landscape files."""
    json_dir = FONT_JSON_DIR if FONT_JSON_DIR.exists() else OPT_FONT_DIR
    pairs_dir = FONT_PAIRS_DIR if FONT_PAIRS_DIR.exists() else OPT_PAIRS_DIR
    profiles = []

    if json_dir.exists():
        for file_path in sorted(json_dir.glob("*.json")):
            # STRICT FILTER: Never load 16:9 Landscape JSONs into 9:16 shorts
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
    is_hero: bool
) -> Dict[str, Any]:
    """Build authentic editorial gradient, glow, and shadow treatment with guaranteed contrast."""
    p_lower = profile_name.lower()
    
    # 1. Gold / Luxury Metallic (e.g. Gold Script, Old Money, Giaza, Luxury)
    if "gold" in p_lower or "luxury" in p_lower or "money" in p_lower or "sanchez" in p_lower or color in ("#D4AF37", "#F5E6C4", "#FFD700", "#FFE600"):
        return {
            "gradient": "linear-gradient(135deg, #FFFDF0 0%, #FFE600 35%, #F59E0B 70%, #D97706 100%)",
            "glow": "0 0 24px rgba(255, 230, 0, 0.75), 0 0 48px rgba(245, 158, 11, 0.45)",
            "shadow": "0 4px 20px rgba(0, 0, 0, 0.98), 0 0 24px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 1)",
            "textFillColor": "transparent" if is_hero else color,
            "hasGradient": is_hero,
        }
    
    # 2. Electric Blue / Cyan Tech (e.g. 3D Blue, Secret Blue, Electric)
    if "blue" in p_lower or "cyan" in p_lower or "electric" in p_lower or color in ("#00F0FF", "#007AFF", "#44B2FF", "#38BDF8"):
        return {
            "gradient": "linear-gradient(135deg, #F0F9FF 0%, #38BDF8 40%, #00F0FF 100%)",
            "glow": "0 0 24px rgba(0, 240, 255, 0.9), 0 0 48px rgba(0, 122, 255, 0.6)",
            "shadow": "0 4px 20px rgba(0, 0, 0, 0.98), 0 0 24px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 1)",
            "textFillColor": "transparent" if is_hero else color,
            "hasGradient": is_hero,
        }

    # 3. Ruby / Red Infrared (e.g. Red Serif, Visual Storytelling, Red Accent)
    if "red" in p_lower or "ruby" in p_lower or "rose" in p_lower or color in ("#FF3366", "#E53935", "#E11D48", "#C8382B"):
        return {
            "gradient": "linear-gradient(135deg, #FFF1F2 0%, #FF3366 50%, #E11D48 100%)",
            "glow": "0 0 24px rgba(255, 51, 102, 0.85), 0 0 48px rgba(225, 29, 72, 0.55)",
            "shadow": "0 4px 20px rgba(0, 0, 0, 0.98), 0 0 24px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 1)",
            "textFillColor": "transparent" if is_hero else color,
            "hasGradient": is_hero,
        }

    # 4. Neon Lime / Emerald (e.g. Neon Lime, Forest Green)
    if "lime" in p_lower or "green" in p_lower or color in ("#A3E635", "#10B981", "#84CC16"):
        return {
            "gradient": "linear-gradient(135deg, #F7FEE7 0%, #A3E635 40%, #10B981 100%)",
            "glow": "0 0 24px rgba(163, 230, 53, 0.85), 0 0 48px rgba(16, 185, 129, 0.55)",
            "shadow": "0 4px 20px rgba(0, 0, 0, 0.98), 0 0 24px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 1)",
            "textFillColor": "transparent" if is_hero else color,
            "hasGradient": is_hero,
        }

    # 5. Liquid Chrome / High-Contrast Crisp Monolith (Default for Didone, Grotesque, Editorial)
    if is_hero:
        return {
            "gradient": "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 35%, #E2E8F0 70%, #FFFFFF 90%, #CBD5E1 100%)",
            "glow": "0 0 24px rgba(255, 255, 255, 0.7), 0 0 48px rgba(200, 225, 255, 0.4)",
            "shadow": "0 6px 24px rgba(0, 0, 0, 0.98), 0 0 28px rgba(0, 0, 0, 0.95), 0 2px 8px rgba(0, 0, 0, 1)",
            "textFillColor": "transparent",
            "hasGradient": True,
        }
    
    return {
        "gradient": "none",
        "glow": "none",
        "shadow": "0 4px 18px rgba(0, 0, 0, 0.98), 0 0 22px rgba(0, 0, 0, 0.95), 0 1px 4px rgba(0, 0, 0, 1)",
        "textFillColor": "#FFFFFF",
        "hasGradient": False,
    }


# High-tier, vetted editorial kinetic preset repertoire
KINETIC_HERO_PRESETS = [
    "apple_pro_display_hero_revealer",
    "apple_keynote_headline_punch",
    "cyber_acid_lime_glitch",
    "dynamic_staggered_character_cascade",
    "cinematic_viewport_mask_sweep",
    "staggered_glyph_slot",
    "obsidian_heavy_grotesque",
    "subpixel_glow_mask",
    "glassmorphic_caustic_refract",
    "vibe_chromatic_luminescence_pulse",
]


def generate_font_manifest(chunks: List[Dict[str, Any]], design_override: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    profiles = load_all_portrait_font_json_profiles()
    if not profiles:
        raise RuntimeError("No 9:16 portrait font JSON profiles found in directory!")

    manifest_chunks = []
    last_hero_preset = ""
    preset_usage_counts: Dict[str, int] = {p: 0 for p in KINETIC_HERO_PRESETS}
    typewriter_used = False

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
            # Single punch word gets cinematic viewport sweep, keynote headline punch, or obsidian grotesque
            single_pool = [
                "cinematic_viewport_mask_sweep",
                "apple_keynote_headline_punch",
                "apple_pro_display_hero_revealer",
                "cyber_acid_lime_glitch",
                "obsidian_heavy_grotesque",
                "vibe_chromatic_luminescence_pulse",
            ]
            single_candidates = [p for p in single_pool if p != last_hero_preset] or single_pool
            hero_fx_preset = single_candidates[idx % len(single_candidates)]
        else:
            # Check terminal payoff for typewriter candidate (max 1 usage)
            if not typewriter_used and (idx == len(chunks) - 1 or "secret" in raw_text.lower() or "how" in raw_text.lower()):
                hero_fx_preset = "typewriter_mono_caret"
                typewriter_used = True
            else:
                candidates = [p for p in KINETIC_HERO_PRESETS if p != last_hero_preset]
                candidates.sort(key=lambda p: preset_usage_counts.get(p, 0))
                hero_fx_preset = candidates[idx % min(5, len(candidates))]

        preset_usage_counts[hero_fx_preset] = preset_usage_counts.get(hero_fx_preset, 0) + 1
        last_hero_preset = hero_fx_preset

        allocations = allocate_words_to_layers(prof.get("typography_layers", []), word_count)
        rendered_layers = []
        word_offset = 0

        for layer_idx, alloc in enumerate(allocations):
            layer_spec = alloc.get("layer", {})
            w_count = alloc.get("wordCount", 1)
            layer_words = words[word_offset : word_offset + w_count]
            
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
            f_effects = layer_spec.get("effects", {})
            casing = f_style.get("casing", prof.get("metadata", {}).get("casing_strategy", "mixed"))

            # Resolve Font Candidate
            candidates = layer_spec.get("matched_font_candidates", [])
            primary_font = candidates[0] if candidates else "Playfair Display"
            accent_font = candidates[1] if len(candidates) > 1 else primary_font

            role = layer_spec.get("role", "body")
            is_hero_layer = (role in ("primary_focus_word", "hero_keyword", "header")) or (layer_idx == 1 and len(allocations) >= 2) or (len(allocations) == 1)
            
            base_size = int(f_style.get("size_px_base", 54))
            # Proportional sizing for 1080x1920 canvas (elevated minimum floors):
            if is_hero_layer:
                font_size_px = max(135, min(175, int(base_size * 2.5)))
                layer_fx = hero_fx_preset
            else:
                font_size_px = max(70, min(92, int(base_size * 1.6)))
                layer_fx = "subpixel_glow_mask"

            # Layer Color & Gradient Glow Treatment (guaranteed high contrast)
            raw_color = resolve_faithful_font_color(f_style.get("color"))
            style_treatment = resolve_layer_gradient_and_glow(
                prof["profile_name"], role, raw_color, is_hero_layer
            )

            # Weight floor: minimum 600 for companion, 800 for hero (never allow faint/thin weights)
            resolved_weight = max(600, int(f_style.get("weight", 700)))
            if is_hero_layer:
                resolved_weight = max(800, resolved_weight)

            rendered_layers.append({
                "layerIndex": layer_idx,
                "layerName": layer_spec.get("layer_name", f"layer_{layer_idx}"),
                "role": role,
                "rawText": raw_layer_text,
                "text": apply_casing_strategy(raw_layer_text, casing),
                "words": layer_word_items,
                "fontFamily": primary_font,
                "accentFont": accent_font,
                "fontWeight": resolved_weight,
                "fontStyle": str(f_style.get("style", "normal")),
                "fontSizePx": font_size_px,
                "color": raw_color,
                "casing": casing,
                "letterSpacingEm": float(f_style.get("letter_spacing_em", 0.01)),
                "lineHeight": float(f_style.get("line_height", 1.05)),
                "isHero": is_hero_layer,
                "fxPreset": layer_fx,
                "gradient": style_treatment["gradient"],
                "glow": style_treatment["glow"],
                "shadow": style_treatment["shadow"],
                "textFillColor": style_treatment["textFillColor"],
                "hasGradient": style_treatment["hasGradient"],
                "doubleUnderline": bool(f_effects.get("double_underline", False)),
            })

        chunk_entry = {
            "chunkIndex": chunk.get("chunkIndex", idx + 1),
            "text": raw_text,
            # Synchronized exact millisecond timestamps from source media
            "startMs": chunk.get("startMs", 0),
            "endMs": chunk.get("endMs", 0),
            "outputStartMs": chunk.get("outputStartMs", chunk.get("startMs", 0)),
            "outputEndMs": chunk.get("outputEndMs", chunk.get("endMs", 0)),
            "fontProfile": prof["profile_name"],
            "profileFilename": prof["filename"],
            "pairedImage": prof.get("paired_image"),
            "fxPreset": hero_fx_preset,
            "placement": {
                "xPercent": "50%",
                # Centered in the upper chest zone (56% Y), completely clear of mouth & chin
                "yPercent": "56%",
                "anchor": "center"
            },
            "layers": rendered_layers,
        }
        manifest_chunks.append(chunk_entry)

    font_manifest = {
        "governanceVersion": "4.0-strict-portrait-editorial-poster",
        "totalChunks": len(manifest_chunks),
        "profilesLoadedCount": len(profiles),
        "combinatorialsUsed": list({c["fontProfile"] for c in manifest_chunks}),
        "pairedImagesReferenced": list({c["pairedImage"] for c in manifest_chunks if c.get("pairedImage")}),
        "chunks": manifest_chunks
    }
    return font_manifest
