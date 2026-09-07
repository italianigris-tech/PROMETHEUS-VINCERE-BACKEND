# -*- coding: utf-8 -*-
"""
Broad-sweeping font JSON spec corrections (v2).

Fixes three deficiency classes across "Yuan Prometheus Screenshots/font JSON":

1. SCRIPT FONT CORRECTIONS
   Layers whose profile/classification is script-themed but whose
   matched_font_candidates resolve to serif faces (e.g. Playfair Display)
   get the correct premium script families prepended:
     Exmouth, Champignon, Brotherhood Script, Bromello,
     Bucklane Script, Formale Script
   (extracted from "all the fonts that it did not have for the reference images")

2. GLOW TREATMENT (specular sweep + bloom + luminance gradient)
   Profiles themed neon/glow/3D/cobalt/royal/electric (or already carrying a
   glow effect) get the full light-dynamics stack on their script/hero layer:
   luminance_gradient (deep tone -> blown-out white), specular_sweep
   (diagonal light band), bloom glow — and the dark drop shadow is removed
   (bloom diffusion replaces dark shadow, per reference treatment).

3. OVERLAP GRADIENT
   In overlap-themed profiles, the text that gets overlapped (the layer under
   a negative-margin sibling) must carry the vertical_gradient treatment; it
   is synthesized from the layer's own color when missing.

Excluded: "Image Landscape*.json" (protected by user instruction).
Idempotent: files tagged metadata.corrections_applied = "v2" are skipped.

Usage: python scripts/apply_font_json_corrections.py
"""

from __future__ import annotations

import colorsys
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JSON_DIR = ROOT / "Yuan Prometheus Screenshots" / "font JSON"
VERSION = "v5"

SCRIPT_SUBCLASS_MAP = [
    (re.compile(r"flourish|formal|ultra", re.I),
     ["Exmouth", "Champignon", "Brotherhood Script", "Bromello"]),
    (re.compile(r"flowing|brush|sweeping|dynamic", re.I),
     ["Bucklane Script", "Formale Script", "Exmouth"]),
    (re.compile(r"ligature|signature|hand-?lettered", re.I),
     ["Brotherhood Script", "Bromello", "Exmouth"]),
    (re.compile(r"script|calligraph|cursive|handwrit", re.I),
     ["Exmouth", "Champignon", "Bucklane Script", "Brotherhood Script"]),
]

SCRIPT_THEME_RE = re.compile(r"script|calligraph|cursive|signature|flourish", re.I)
GLOW_THEME_RE = re.compile(r"neon|glow|3d|cobalt|royal|electric|luminous|overlap[-_ ]?treatment|two[-_ ]?tone", re.I)
CHROME_THEME_RE = re.compile(r"chrome|metallic|bronze|silver|steel|iridescent|liquid", re.I)
GRADIENT_THEME_RE = re.compile(r"gradient", re.I)

# Per-profile corrections sourced from user's direct reference inspection.
# (file stem without extension) -> list of (layer_name, action)
PROFILE_OVERRIDES = {
    "image (41)": [
        ("layer_tonight", "script+glow"),
    ],
}


def hex_to_rgb(c):
    c = c.strip().lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    try:
        return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))
    except (ValueError, IndexError):
        return (255, 255, 255)


def darken(c, f=0.32):
    r, g, b = hex_to_rgb(c)
    return "#{:02X}{:02X}{:02X}".format(int(r * f), int(g * f), int(b * f))


def alpha(c, a):
    r, g, b = hex_to_rgb(c)
    return f"rgba({r}, {g}, {b}, {a})"


def is_script_layer(layer, profile_name):
    cls = str(layer.get("font_classification") or "")
    lname = str(layer.get("layer_name") or "")
    # A classification that itself names a script style is authoritative,
    # even when it also mentions serif ("Italic Calligraphic Script Serif").
    if SCRIPT_THEME_RE.search(cls):
        return True
    # Pure sans/serif/grotesque classifications never become script, even when
    # the profile title mentions "script" for a sibling layer.
    if re.search(r"\bsans\b|\bserif\b|\bdidone\b|\bgrotesque\b|\bgrotesk\b|\bcondensed\b|\bcompressed\b", cls, re.I):
        return False
    if SCRIPT_THEME_RE.search(profile_name):
        return True
    if SCRIPT_THEME_RE.search(lname):
        return True
    return False


def script_candidates(layer):
    blob = " ".join([
        str(layer.get("font_classification") or ""),
        str(layer.get("layer_name") or ""),
        str(layer.get("role") or ""),
    ])
    for rx, fams in SCRIPT_SUBCLASS_MAP:
        if rx.search(blob):
            return fams
    return ["Exmouth", "Champignon", "Bucklane Script"]


def apply_script_fix(layer, profile_name, notes):
    if not is_script_layer(layer, profile_name):
        # regression repair: v2/v3 blanket-matched script fonts onto
        # sans/serif layers in script-titled profiles — undo that.
        cands = layer.get("matched_font_candidates") or []
        cls = str(layer.get("font_classification") or "")
        if cands and re.search(r"\bsans\b|\bserif\b|\bdidone\b|\bgrotesque\b|\bgrotesk\b|\bcondensed\b|\bcompressed\b", cls, re.I):
            scripts = {"Exmouth", "Champignon", "Brotherhood Script", "Bromello",
                       "Bucklane Script", "Formale Script"}
            if any(c in scripts for c in cands[:2]):
                kept = [c for c in cands if c not in scripts]
                layer["matched_font_candidates"] = kept
                notes.append(
                    f"script-fix regression repair: removed {sorted(set(cands) - set(kept))} "
                    f"from sans/serif layer '{layer.get('layer_name')}'"
                )
        return
    cands = layer.get("matched_font_candidates") or []
    correct = script_candidates(layer)
    if cands and cands[0] in correct:
        return
    if set(correct) & set(cands):
        return
    layer["matched_font_candidates"] = correct + list(cands)
    notes.append(
        f"script font fix: {'/'.join(correct[:2])} prepended (was {cands[0] if cands else 'none'})"
    )


# Layer classes whose reference imagery matches the Asgard Fit family
# (Zetafonts condensed-fit grotesque with tight x-height and heavy weights).
ASGARD_FIT = "Asgard Fit"
COMPRESSED_SANS_CLS_RE = re.compile(
    r"ultra-?compressed|compressed|ultra-?tall|ultra-?condensed|"
    r"condensed (?:heavy|bold|display|extra)|heavy condensed", re.I)
COMPRESSED_SANS_NAME_RE = re.compile(
    r"compressed|condensed_grotesk|condensed_sans|tall_sans|colossal|pill_grotesk", re.I)


def apply_asgard_fit_fix(layer, notes):
    """Prepend Asgard Fit to compressed/condensed heavy sans layers that the
    original spec misassigned (e.g. Bebas/Anton/Big Shoulders)."""
    cls = str(layer.get("font_classification") or "")
    lname = str(layer.get("layer_name") or "")
    if not (COMPRESSED_SANS_CLS_RE.search(cls) or COMPRESSED_SANS_NAME_RE.search(lname)):
        return
    if not re.search(r"\bsans\b|\bgrotesque\b|\bgrotesk\b", cls + " " + lname, re.I):
        return
    cands = layer.get("matched_font_candidates") or []
    if ASGARD_FIT in cands:
        return
    layer["matched_font_candidates"] = [ASGARD_FIT] + list(cands)
    notes.append(
        f"asgard fit fix: prepended to '{layer.get('layer_name')}' "
        f"(was {cands[0] if cands else 'none'})"
    )


def apply_glow_treatment(layer, notes, base_color=None):
    fx = layer.get("effects") or {}
    color = base_color or (layer.get("font_style") or {}).get("color", "#FFFFFF")
    if "luminance_gradient" not in fx:
        fx["luminance_gradient"] = {"low": darken(color), "high": "#FFFFFF"}
    if "specular_sweep" not in fx:
        fx["specular_sweep"] = {"angle": 115, "width": 0.22, "intensity": 0.9}
    if not fx.get("glow"):
        fx["glow"] = {"color": "rgba(205, 230, 255, 0.85)", "radius": 26}
    fx.pop("drop_shadow", None)
    layer["effects"] = fx
    notes.append("glow treatment: luminance gradient + specular sweep + bloom (dark shadow removed)")


def gradient_from_color(c):
    return (
        f"linear-gradient(180deg, {c} 0%, {alpha(c, 0.8)} 45%, "
        f"{alpha(c, 0.1)} 90%, transparent 100%)"
    )


CHROME_STOPS = ["#8A5A2B", "#C98A4B", "#E8D9C0", "#FFFFFF", "#B9BEC9"]


def apply_chrome_treatment(layer, notes):
    """Foreground layer becomes liquid chrome: bronze/copper -> blown silver
    with a specular band, plus a soft ambient shadow to separate materials."""
    fx = layer.get("effects") or {}
    if fx.get("metallic_chrome"):
        return
    fx["metallic_chrome"] = {
        "angle": 105,
        "stops": CHROME_STOPS,
        "specular_band": {"position": 0.62, "width": 0.2},
    }
    fx["drop_shadow"] = {"x_offset": 0, "y_offset": 6, "blur_radius": 18,
                         "color": "rgba(0, 0, 0, 0.35)"}
    layer["effects"] = fx
    notes.append(
        f"chrome treatment: metallic gradient {CHROME_STOPS[0]}..{CHROME_STOPS[3]} "
        "+ specular band + ambient shadow"
    )


def apply_matte_editorial(layer, notes):
    """Rear/overlapped layer goes fully matte: flat fill, 0% specular,
    no gradient, no shadow — the paper base of the material contrast."""
    fx = layer.get("effects") or {}
    changed = any(k in fx for k in ("vertical_gradient", "gradient", "drop_shadow",
                                    "glow", "metallic_chrome"))
    fx.clear()
    fx["matte_editorial"] = {"enabled": True}
    layer["effects"] = fx
    if changed:
        notes.append(
            f"matte editorial: stripped gradients/shadows from rear layer '{layer.get('layer_name')}'"
        )


def apply_material_contrast(layers, profile_name, notes):
    """Chrome-vs-matte profiles: chrome hero stays glossy, every layer it
    overlaps (or that sits behind) goes editorial matte."""
    if not CHROME_THEME_RE.search(profile_name):
        return
    hero_idx = [i for i, l in enumerate(layers)
                if l.get("role") in ("primary_focus_word", "header")]
    for i, layer in enumerate(layers):
        if i in hero_idx:
            apply_chrome_treatment(layer, notes)
        else:
            apply_matte_editorial(layer, notes)


def apply_overlap_gradient(layers, profile_name, notes):
    if not re.search(r"overlap", profile_name, re.I):
        return
    for i, layer in enumerate(layers):
        fs = layer.get("font_style") or {}
        if float(fs.get("vertical_margin_top_px") or 0) >= 0:
            continue
        overlapped = layers[i - 1] if i > 0 else None
        if overlapped is None:
            continue
        fx = overlapped.get("effects") or {}
        if fx.get("vertical_gradient") or fx.get("gradient"):
            continue
        base = (overlapped.get("font_style") or {}).get("color", "#FFFFFF")
        fx["vertical_gradient"] = gradient_from_color(base)
        overlapped["effects"] = fx
        notes.append(
            f"overlap gradient: vertical gradient applied to overlapped layer '{overlapped.get('layer_name')}'"
        )


def main():
    changed = 0
    skipped = 0
    for f in sorted(JSON_DIR.glob("*.json")):
        if f.stem.startswith("Image Landscape"):
            skipped += 1
            continue
        data = json.loads(f.read_text(encoding="utf-8-sig"))
        meta = data.get("metadata") or {}
        if meta.get("corrections_applied") == VERSION:
            continue
        notes = []
        profile_name = data.get("profile_name", "")
        layers = data.get("typography_layers") or []
        glow_theme = bool(GLOW_THEME_RE.search(profile_name))

        for layer in layers:
            apply_script_fix(layer, profile_name, notes)
            apply_asgard_fit_fix(layer, notes)
        for layer in layers:
            fx = layer.get("effects") or {}
            cls = str(layer.get("font_classification") or "")
            lname = str(layer.get("layer_name") or "")
            is_hero = bool(fx.get("glow")) or glow_theme and (
                SCRIPT_THEME_RE.search(cls)
                or SCRIPT_THEME_RE.search(lname)
                or layer.get("role") == "primary_focus_word"
            )
            if is_hero:
                apply_glow_treatment(layer, notes)
        apply_overlap_gradient(layers, profile_name, notes)
        apply_material_contrast(layers, profile_name, notes)

        # user-sourced per-profile overrides
        for lname, action in PROFILE_OVERRIDES.get(f.stem, []):
            by_name = {l.get("layer_name"): l for l in layers}
            layer = by_name.get(lname)
            if layer is None:
                continue
            if "script" in action:
                correct = script_candidates(layer)
                layer["matched_font_candidates"] = correct + [
                    c for c in (layer.get("matched_font_candidates") or [])
                    if c not in correct
                ]
                notes.append(
                    f"override: script font fix on '{lname}' "
                    f"({'/'.join(correct[:2])})"
                )
            if "glow" in action:
                apply_glow_treatment(layer, notes)

        if notes:
            meta["corrections_applied"] = VERSION
            meta["correction_notes"] = sorted(set(notes))
            data["metadata"] = meta
            f.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            changed += 1
            print(f"{f.name}: {len(notes)} corrections")
            for n in sorted(set(notes)):
                print(f"    - {n}")
    print(f"\nchanged: {changed} | skipped (already v2): 0 | protected (Image Landscape): {skipped}")


if __name__ == "__main__":
    sys.exit(main())
