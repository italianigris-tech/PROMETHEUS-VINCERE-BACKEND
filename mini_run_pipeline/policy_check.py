"""policy_check.py - Post-render conformance checker for Mini Runs pipeline.

Validates safe-region bounds, line-count / tall-stack contract, single-contact shadow
and hero-only glow budget. Emits policyReport into the final receipt.
"""
from __future__ import annotations

import re
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from mini_run_pipeline.typography import estimate_layer_width_px

DEFAULT_INSPECTION_TIMESTAMPS: Tuple[float, ...] = (1.8, 4.6, 8.6, 15.0, 22.5, 28.0)
MAX_SAFE_WIDTH_PX: float = 820.0
MAX_HERO_GLOW_ALPHA: float = 0.35
VERTICAL_TALL_PRESETS = frozenset({
    "canva_tall_glyph_stack",
    "vertical_glyph_tower",
    "stacked_vertical_subword_drop",
})


def extract_manifest_layers(manifest_or_props: Any) -> List[Dict[str, Any]]:
    """Extract flattened rendered layers from manifest, props, receipt, or chunk list."""
    if not manifest_or_props:
        return []
    chunks: List[Dict[str, Any]] = []
    if isinstance(manifest_or_props, list):
        chunks = manifest_or_props
    elif isinstance(manifest_or_props, dict):
        if "fontManifest" in manifest_or_props and isinstance(manifest_or_props["fontManifest"], dict):
            chunks = manifest_or_props["fontManifest"].get("chunks", [])
        elif "font_manifest" in manifest_or_props and isinstance(manifest_or_props["font_manifest"], dict):
            chunks = manifest_or_props["font_manifest"].get("chunks", [])
        elif "chunks" in manifest_or_props and isinstance(manifest_or_props["chunks"], list):
            chunks = manifest_or_props["chunks"]
        elif "rendered_layers" in manifest_or_props or "layers" in manifest_or_props:
            chunks = [manifest_or_props]

    layers: List[Dict[str, Any]] = []
    for c_idx, chunk in enumerate(chunks):
        if not isinstance(chunk, dict):
            continue
        chunk_layers = chunk.get("rendered_layers") or chunk.get("layers") or []
        behind = bool(
            chunk.get("behindSubject")
            or (chunk.get("subjectLayering") or {}).get("behindSubject")
            or (chunk.get("placement") or {}).get("tier") == "behind_subject"
        )
        for l_idx, layer in enumerate(chunk_layers):
            if not isinstance(layer, dict):
                continue
            item = dict(layer)
            item.setdefault("chunkIndex", c_idx)
            item.setdefault("layerIndex", l_idx)
            item.setdefault("behindSubject", behind)
            layers.append(item)
    return layers


def validate_safe_region_bounds(
    layers: Sequence[Dict[str, Any]],
    max_safe_width: float = MAX_SAFE_WIDTH_PX,
) -> Dict[str, Any]:
    """Validate that text layers fit within safe-region envelope (default <= 820px)."""
    violations: List[str] = []
    checked = 0
    for layer in layers:
        raw_text = str(layer.get("rawText") or layer.get("text") or "").strip()
        if not raw_text:
            continue
        checked += 1
        font_name = str(layer.get("fontFamily") or layer.get("primary_font") or "Montserrat")
        font_size = float(layer.get("fontSizePx") or layer.get("font_size_px") or 60.0)
        is_upper = layer.get("casing") == "uppercase" or raw_text.isupper()
        fit_scale = float(layer.get("autoFitScale") or layer.get("fitScale") or 1.0)

        if "est_width" in layer:
            est_width = float(layer["est_width"])
        elif "estimatedWidthPx" in layer:
            est_width = float(layer["estimatedWidthPx"])
        else:
            est_width = estimate_layer_width_px(raw_text, font_name, font_size, is_uppercase=is_upper)

        effective_width = est_width * fit_scale
        if effective_width > (max_safe_width + 1.5):
            c_idx = layer.get("chunkIndex", "?")
            l_name = layer.get("layerName") or f"layer_{layer.get('layerIndex', '?')}"
            violations.append(
                f"Chunk {c_idx} layer '{l_name}' ('{raw_text[:28]}'): "
                f"effective width {effective_width:.1f}px exceeds safe bound {max_safe_width}px"
            )
    return {
        "status": "passed" if not violations else "failed",
        "maxAllowedWidth": max_safe_width,
        "layersChecked": checked,
        "overflowCount": len(violations),
        "violations": violations,
    }


def validate_line_count_and_wrap(layers: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    """Validate tall-stack contract and line wrapping/syllable integrity."""
    tall_violations, wrap_violations = [], []
    checked = 0
    for layer in layers:
        raw_text = str(layer.get("rawText") or layer.get("text") or "").strip()
        if not raw_text:
            continue
        checked += 1
        words = raw_text.split()
        preset = str(layer.get("fxPreset") or "")
        is_behind = bool(layer.get("behindSubject"))
        role = str(layer.get("role") or ("hero" if layer.get("isHero") else "companion"))
        c_idx = layer.get("chunkIndex", "?")
        l_name = layer.get("layerName") or f"layer_{layer.get('layerIndex', '?')}"

        if preset in VERTICAL_TALL_PRESETS and len(words) > 1 and not is_behind:
            tall_violations.append(
                f"Chunk {c_idx} layer '{l_name}' ({role}) uses vertical preset '{preset}' "
                f"on multi-word layer in foreground ({len(words)} words)"
            )
        if re.search(r"\b\w+-\s*$", raw_text, re.MULTILINE):
            wrap_violations.append(f"Chunk {c_idx} layer '{l_name}' contains split-word hyphenation: '{raw_text}'")
        if not layer.get("isHero") and role in ("companion", "modifier", "secondary_clause"):
            if raw_text.count("\n") + 1 > 2:
                wrap_violations.append(f"Chunk {c_idx} companion layer '{l_name}' exceeds 2 lines")

    all_v = tall_violations + wrap_violations
    return {
        "status": "passed" if not all_v else "failed",
        "layersChecked": checked,
        "tallStackViolations": tall_violations,
        "multiLineViolations": wrap_violations,
        "violations": all_v,
    }


def validate_shadow_glow_budget(layers: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    """Validate single contact shadow and hero-only glow alpha <= 0.35."""
    amb_v, shd_v, comp_glow_v, hero_glow_v = [], [], [], []
    checked = 0
    for layer in layers:
        checked += 1
        is_hero = bool(layer.get("isHero") or layer.get("role") in ("hero", "primary_focus_word", "header"))
        c_idx = layer.get("chunkIndex", "?")
        l_name = layer.get("layerName") or f"layer_{layer.get('layerIndex', '?')}"

        ambient = str(layer.get("ambientShadow") or "none").strip().lower()
        if ambient not in ("none", "", "null", "undefined"):
            amb_v.append(f"Chunk {c_idx} layer '{l_name}' ambientShadow is '{layer.get('ambientShadow')}' (must be 'none')")

        shadow = str(layer.get("shadow") or layer.get("contactShadow") or "none").strip()
        is_special = bool(
            layer.get("chiseledPrism") or layer.get("opticalBloom") or layer.get("vjkt")
            or layer.get("fxPreset") in (
                "metallic_chrome_countup_hero", "chiseled_prism_metallic",
                "air_frontal_optical_bloom", "see_through_glass_letterform",
            )
        )
        if not is_special and shadow.lower() not in ("none", "", "null", "undefined"):
            clauses = [s.strip() for s in re.split(r",\s*(?![^(]*\))", shadow) if s.strip()]
            if len(clauses) > 1:
                shd_v.append(f"Chunk {c_idx} layer '{l_name}' has {len(clauses)} compounding shadows '{shadow}'")

        glow = str(layer.get("glow") or "none").strip()
        if not is_hero:
            if glow.lower() not in ("none", "", "null", "undefined"):
                comp_glow_v.append(f"Chunk {c_idx} companion layer '{l_name}' has glow '{glow}' (glow is hero-only)")
        else:
            if glow.lower() not in ("none", "", "null", "undefined"):
                for a_str in re.findall(r"rgba\s*\([^)]*,\s*([0-9.]+)\s*\)", glow):
                    try:
                        if float(a_str) > (MAX_HERO_GLOW_ALPHA + 0.005):
                            hero_glow_v.append(f"Chunk {c_idx} hero layer '{l_name}' glow alpha {a_str} > {MAX_HERO_GLOW_ALPHA}")
                    except ValueError:
                        pass

    all_v = amb_v + shd_v + comp_glow_v + hero_glow_v
    return {
        "status": "passed" if not all_v else "failed",
        "layersChecked": checked,
        "ambientShadowViolations": amb_v,
        "multiShadowViolations": shd_v,
        "companionGlowViolations": comp_glow_v,
        "heroGlowAlphaViolations": hero_glow_v,
        "violations": all_v,
    }


def extract_conformance_frames(
    video_path: Optional[str | Path],
    timestamps_sec: Sequence[float] = DEFAULT_INSPECTION_TIMESTAMPS,
    output_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """Extract sample inspection frames post-stitch via ffmpeg."""
    if not video_path:
        return {"status": "skipped", "reason": "no_video_path", "frames": []}
    v_path = Path(video_path)
    if not v_path.exists():
        return {"status": "skipped", "reason": f"file_not_found: {v_path}", "frames": []}
    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        return {"status": "skipped", "reason": "ffmpeg_not_available", "frames": []}

    out_dir = output_dir or (v_path.parent / f"conformance_frames_{v_path.stem}")
    out_dir.mkdir(parents=True, exist_ok=True)
    extracted: List[Dict[str, Any]] = []
    for t in timestamps_sec:
        out_frame = out_dir / f"frame_{t:.1f}s.png"
        cmd = [ffmpeg_bin, "-y", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", str(v_path), "-vframes", "1", "-q:v", "2", str(out_frame)]
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20)
            if res.returncode == 0 and out_frame.exists() and out_frame.stat().st_size > 0:
                extracted.append({"timestampSec": t, "framePath": str(out_frame), "sizeBytes": out_frame.stat().st_size})
        except Exception:
            pass
    return {
        "status": "passed" if extracted else ("skipped" if not timestamps_sec else "failed"),
        "requestedTimestamps": list(timestamps_sec),
        "framesExtracted": len(extracted),
        "outputDirectory": str(out_dir),
        "frames": extracted,
    }


def run_post_render_conformance_check(
    video_path: Optional[str | Path] = None,
    manifest_or_props: Optional[Any] = None,
    timestamps_sec: Sequence[float] = DEFAULT_INSPECTION_TIMESTAMPS,
    extract_frames: bool = True,
    output_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """Execute full post-render conformance check."""
    t_start = time.monotonic()
    layers = extract_manifest_layers(manifest_or_props)
    safe_bounds = validate_safe_region_bounds(layers, max_safe_width=MAX_SAFE_WIDTH_PX)
    line_wrap = validate_line_count_and_wrap(layers)
    shadow_glow = validate_shadow_glow_budget(layers)

    frame_result: Dict[str, Any]
    if extract_frames and video_path:
        frame_result = extract_conformance_frames(video_path, timestamps_sec, output_dir=output_dir)
    else:
        frame_result = {"status": "skipped", "reason": "extraction_not_requested" if not extract_frames else "no_video_path", "frames": []}

    all_violations = safe_bounds["violations"] + line_wrap["violations"] + shadow_glow["violations"]
    return {
        "status": "passed" if not all_violations else "failed",
        "totalChecks": 3,
        "passedChecks": sum(1 for c in [safe_bounds, line_wrap, shadow_glow] if c["status"] == "passed"),
        "failedChecks": sum(1 for c in [safe_bounds, line_wrap, shadow_glow] if c["status"] == "failed"),
        "totalLayersChecked": len(layers),
        "violations": all_violations,
        "checks": {
            "safeRegionBounds": safe_bounds,
            "lineCount": line_wrap,
            "shadowBudget": shadow_glow,
            "frameExtraction": frame_result,
        },
        "durationMs": round((time.monotonic() - t_start) * 1000, 2),
        "checkedAt": time.time(),
    }


run_conformance_check = run_post_render_conformance_check
