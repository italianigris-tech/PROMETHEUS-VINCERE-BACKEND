"""policy_check.py - Post-render conformance checker for Mini Runs pipeline.

Validates safe-region bounds, line-count / tall-stack contract, single-contact shadow,
hero-only glow budget, and look policy (teal intensity cap <= 0.70 & pixel A/B acceptance).
Emits policyReport into the final receipt.
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
MAX_TEAL_LOOK_INTENSITY: float = 0.70
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


def compute_pixel_ab_metrics(
    frame_path_or_rgb: Any,
    reference_frame_path_or_rgb: Optional[Any] = None,
) -> Dict[str, Any]:
    """Compute pixel-level color grading acceptance metrics: cyan index, skin hue preservation, and saturation."""
    try:
        import numpy as np
        import cv2
    except ImportError:
        return {"status": "skipped", "reason": "numpy_or_cv2_unavailable"}

    rgb: Optional[np.ndarray] = None
    if isinstance(frame_path_or_rgb, (str, Path)):
        p = Path(frame_path_or_rgb)
        if not p.exists():
            return {"status": "skipped", "reason": f"file_not_found: {p}"}
        bgr = cv2.imread(str(p))
        if bgr is None:
            return {"status": "skipped", "reason": "failed_to_decode_image"}
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    elif isinstance(frame_path_or_rgb, np.ndarray):
        rgb = frame_path_or_rgb

    if rgb is None or rgb.size == 0:
        return {"status": "skipped", "reason": "empty_frame_data"}

    # 1. Cyan index: average normalized excess of (G+B)/2 over R
    r = rgb[:, :, 0].astype(float)
    g = rgb[:, :, 1].astype(float)
    b = rgb[:, :, 2].astype(float)
    cyan_excess = np.maximum(0.0, ((g + b) / 2.0) - r) / 255.0
    cyan_index = round(float(np.mean(cyan_excess)), 4)

    # 2. Skin hue and saturation in HSV
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    skin_mask = (hsv[:, :, 0] >= 5) & (hsv[:, :, 0] <= 22) & (hsv[:, :, 1] >= 30) & (hsv[:, :, 2] >= 50)
    skin_pixel_count = int(np.sum(skin_mask))
    if skin_pixel_count > 50:
        skin_hue_deg = round(float(np.mean(hsv[skin_mask, 0]) * 2.0), 2)
    else:
        skin_hue_deg = None

    mean_saturation = round(float(np.mean(hsv[:, :, 1]) / 255.0), 4)

    # 3. Reference comparison (if reference provided)
    ref_metrics: Optional[Dict[str, Any]] = None
    if reference_frame_path_or_rgb is not None:
        ref_metrics = compute_pixel_ab_metrics(reference_frame_path_or_rgb, reference_frame_path_or_rgb=None)

    violations: List[str] = []
    if cyan_index > 0.35:
        violations.append(f"Cyan index {cyan_index:.3f} exceeds maximum threshold 0.35")
    if skin_hue_deg is not None and not (10.0 <= skin_hue_deg <= 45.0):
        violations.append(f"Skin hue {skin_hue_deg:.1f}° outside natural skin range [10.0°, 45.0°]")

    if ref_metrics and ref_metrics.get("status") == "passed":
        ref_skin = ref_metrics.get("skinHueDeg")
        if ref_skin is not None:
            if skin_hue_deg is None:
                violations.append(f"Skin tones completely eliminated by color grade ({skin_pixel_count} vs reference {ref_metrics.get('skinPixelCount')})")
            else:
                hue_drift = abs(skin_hue_deg - ref_skin)
                if hue_drift > 18.0:
                    violations.append(f"Skin hue drift {hue_drift:.1f}° vs reference exceeds threshold 18.0°")

        ref_cyan = ref_metrics.get("cyanIndex", 0.0)
        cyan_drift = abs(cyan_index - ref_cyan)
        if cyan_drift > 0.25:
            violations.append(f"Cyan index drift {cyan_drift:.3f} vs reference exceeds threshold 0.25")

    return {
        "status": "passed" if not violations else "failed",
        "cyanIndex": cyan_index,
        "skinHueDeg": skin_hue_deg,
        "skinPixelCount": skin_pixel_count,
        "saturation": mean_saturation,
        "referenceComparison": ref_metrics,
        "violations": violations,
    }


def validate_look_conformance(
    look_plan: Optional[Dict[str, Any]],
    frame_path: Optional[str | Path] = None,
    reference_frame_path: Optional[str | Path] = None,
) -> Dict[str, Any]:
    """Validate look policy conformance: teal intensity <= 0.70 and pixel A/B acceptance."""
    violations: List[str] = []
    look_id = str(look_plan.get("lookId") or "") if look_plan else ""
    intensity = float(look_plan.get("intensity", 1.0)) if look_plan else 1.0

    if look_id in ("teal_and_orange_blockbuster", "teal_and_orange") and intensity > (MAX_TEAL_LOOK_INTENSITY + 0.005):
        violations.append(
            f"Teal & Orange look intensity {intensity:.2f} exceeds talking-head cap {MAX_TEAL_LOOK_INTENSITY:.2f}"
        )

    pixel_metrics: Dict[str, Any] = {"status": "skipped", "reason": "no_frame_provided"}
    if frame_path:
        pixel_metrics = compute_pixel_ab_metrics(frame_path, reference_frame_path_or_rgb=reference_frame_path)
        if pixel_metrics.get("status") == "failed":
            violations.extend(pixel_metrics.get("violations", []))

    return {
        "status": "passed" if not violations else "failed",
        "lookId": look_id,
        "intensity": intensity,
        "pixelAbMetrics": pixel_metrics,
        "violations": violations,
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
    reference_frame_path: Optional[str | Path] = None,
    timestamps_sec: Sequence[float] = DEFAULT_INSPECTION_TIMESTAMPS,
    extract_frames: bool = True,
    output_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """Execute full post-render conformance check: safe-bounds, line-count, shadow/glow budget, look conformance, and frame extraction."""
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

    # Look policy and pixel A/B validation
    look_plan = None
    if isinstance(manifest_or_props, dict):
        look_plan = manifest_or_props.get("lookPlan") or manifest_or_props.get("lookManifest") or manifest_or_props.get("look")

    first_frame = (frame_result.get("frames") or [{}])[0].get("framePath") if frame_result.get("status") == "passed" else None
    look_result = validate_look_conformance(look_plan, frame_path=first_frame, reference_frame_path=reference_frame_path)

    all_violations = safe_bounds["violations"] + line_wrap["violations"] + shadow_glow["violations"] + look_result["violations"]
    return {
        "status": "passed" if not all_violations else "failed",
        "totalChecks": 4,
        "passedChecks": sum(1 for c in [safe_bounds, line_wrap, shadow_glow, look_result] if c["status"] == "passed"),
        "failedChecks": sum(1 for c in [safe_bounds, line_wrap, shadow_glow, look_result] if c["status"] == "failed"),
        "totalLayersChecked": len(layers),
        "violations": all_violations,
        "checks": {
            "safeRegionBounds": safe_bounds,
            "lineCount": line_wrap,
            "shadowBudget": shadow_glow,
            "lookConformance": look_result,
            "frameExtraction": frame_result,
        },
        "durationMs": round((time.monotonic() - t_start) * 1000, 2),
        "checkedAt": time.time(),
    }


run_conformance_check = run_post_render_conformance_check
