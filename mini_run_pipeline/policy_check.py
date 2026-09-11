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


SAFE_MARGIN_X_PX: float = 130.0
SAFE_MARGIN_Y_PX: float = 160.0
CANVAS_WIDTH_PX: int = 1080
CANVAS_HEIGHT_PX: int = 1920


def measure_frame_text_pixel_bounds(
    frame_path_or_rgb: Any,
    safe_margin_x: float = SAFE_MARGIN_X_PX,
    safe_margin_y: float = SAFE_MARGIN_Y_PX,
    width: int = CANVAS_WIDTH_PX,
    height: int = CANVAS_HEIGHT_PX,
) -> Dict[str, Any]:
    """Measure actual pixel bounding box and safe-margin edge bleed from rendered frame."""
    try:
        import numpy as np
        from PIL import Image
    except ImportError:
        return {"status": "skipped", "reason": "numpy_or_pillow_unavailable", "detected": False}

    if isinstance(frame_path_or_rgb, (str, Path)):
        p = Path(frame_path_or_rgb)
        if not p.exists():
            return {"status": "skipped", "reason": f"file_not_found: {p}", "detected": False}
        try:
            img = Image.open(p).convert("RGB")
            arr = np.array(img)
        except Exception as err:
            return {"status": "skipped", "reason": f"image_load_failed: {err}", "detected": False}
    elif isinstance(frame_path_or_rgb, np.ndarray):
        arr = frame_path_or_rgb
    else:
        return {"status": "skipped", "reason": "invalid_frame_data", "detected": False}

    h, w = arr.shape[:2]
    # Restrict vertical search zone to dialogue / graphics band [500, 1850]
    y_start = min(h - 50, 500)
    y_end = min(h, 1850)
    sub = arr[y_start:y_end, :]

    r = sub[:, :, 0].astype(float)
    g = sub[:, :, 1].astype(float)
    b = sub[:, :, 2].astype(float)
    lum = 0.299 * r + 0.587 * g + 0.114 * b

    # Text glyph mask: bright white, gold, cyan, or high-luminance foreground text
    bright_text = lum > 70.0
    cyan_text = (b > 130) & (g > 130) & (r < 110)
    warm_text = (r > 160) & (g > 120) & (b < 90)
    mask = bright_text | cyan_text | warm_text

    col_counts = np.sum(mask, axis=0)
    active_cols = np.where(col_counts > 3)[0]
    if len(active_cols) == 0:
        return {
            "status": "passed",
            "detected": False,
            "edgeBleed": False,
            "bleedSide": "none",
            "leftClearancePx": float(w),
            "rightClearancePx": float(w),
            "bbox": None,
        }

    splits = np.where(np.diff(active_cols) > 35)[0]
    segments = np.split(active_cols, splits + 1)
    best_seg = max(segments, key=lambda s: len(s))
    x_min = int(best_seg.min())
    x_max = int(best_seg.max())

    sub_col = mask[:, x_min : x_max + 1]
    row_counts = np.sum(sub_col, axis=1)
    active_rows = np.where(row_counts > 2)[0]
    y_min = int(active_rows.min() + y_start) if len(active_rows) > 0 else y_start
    y_max = int(active_rows.max() + y_start) if len(active_rows) > 0 else y_end

    left_c = float(x_min)
    right_c = float(w - x_max)
    has_left_bleed = left_c < (safe_margin_x - 1.0)
    has_right_bleed = right_c < (safe_margin_x - 1.0)
    edge_bleed = has_left_bleed or has_right_bleed
    bleed_side = "both" if (has_left_bleed and has_right_bleed) else ("left" if has_left_bleed else ("right" if has_right_bleed else "none"))

    return {
        "status": "passed" if not edge_bleed else "failed",
        "detected": True,
        "bbox": {
            "xMin": x_min,
            "xMax": x_max,
            "yMin": y_min,
            "yMax": y_max,
            "width": x_max - x_min,
            "height": y_max - y_min,
        },
        "leftClearancePx": left_c,
        "rightClearancePx": right_c,
        "edgeBleed": edge_bleed,
        "bleedSide": bleed_side,
    }


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


def validate_safe_region_bounds_with_frames(
    layers: Sequence[Dict[str, Any]],
    frames: Optional[Sequence[Dict[str, Any]]] = None,
    chunks: Optional[Sequence[Dict[str, Any]]] = None,
    max_safe_width: float = MAX_SAFE_WIDTH_PX,
    safe_margin_x: float = SAFE_MARGIN_X_PX,
) -> Dict[str, Any]:
    """Validate safe region bounds combining manifest estimation and pixel truth side by side."""
    manifest_eval = validate_safe_region_bounds(layers, max_safe_width=max_safe_width)

    pixel_measurements: List[Dict[str, Any]] = []
    side_by_side: List[Dict[str, Any]] = []
    pixel_violations: List[str] = []

    if frames:
        for f in frames:
            f_path = f.get("framePath")
            ts = float(f.get("timestampSec", 0.0))
            if not f_path:
                continue
            res = measure_frame_text_pixel_bounds(f_path, safe_margin_x=safe_margin_x)
            f_meas = {
                "timestampSec": ts,
                "framePath": str(f_path),
                "measurement": res,
            }
            pixel_measurements.append(f_meas)

            # Find matching chunk at timestamp
            matching_chunk = None
            if chunks:
                for c in chunks:
                    start_sec = float(c.get("startMs", 0)) / 1000.0
                    end_sec = float(c.get("endMs", 0)) / 1000.0
                    if start_sec <= ts <= (end_sec + 0.15):
                        matching_chunk = c
                        break

            chunk_text = matching_chunk.get("text", "") if matching_chunk else ""
            chunk_idx = matching_chunk.get("chunkIndex", "?") if matching_chunk else "?"
            chunk_layers = (
                (matching_chunk.get("layers") or matching_chunk.get("rendered_layers") or [])
                if matching_chunk else []
            )
            est_w = max((float(l.get("estimatedWidthPx") or l.get("est_width") or 0.0) for l in chunk_layers), default=0.0)

            if res.get("edgeBleed"):
                pixel_violations.append(
                    f"Frame at {ts:.1f}s (Chunk {chunk_idx} '{chunk_text[:28]}'): "
                    f"{res.get('bleedSide')} edge bleed detected (leftClearance={res.get('leftClearancePx'):.1f}px, "
                    f"rightClearance={res.get('rightClearancePx'):.1f}px, safeMargin={safe_margin_x}px)"
                )

            side_by_side.append({
                "timestampSec": ts,
                "chunkIndex": chunk_idx,
                "manifestEstimate": {
                    "text": chunk_text,
                    "estimatedWidthPx": est_w,
                    "maxAllowedWidthPx": max_safe_width,
                    "overflow": est_w > max_safe_width,
                },
                "pixelTruth": {
                    "detected": res.get("detected", False),
                    "boundingBox": res.get("bbox"),
                    "leftClearancePx": res.get("leftClearancePx"),
                    "rightClearancePx": res.get("rightClearancePx"),
                    "safeMarginPx": safe_margin_x,
                    "edgeBleedDetected": res.get("edgeBleed", False),
                    "bleedSide": res.get("bleedSide", "none"),
                },
                "conformanceMatch": (not (est_w > max_safe_width)) and (not res.get("edgeBleed", False)),
            })

    pixel_status = "passed" if not pixel_violations else "failed"
    if not frames:
        pixel_status = "skipped"

    overall_violations = manifest_eval["violations"] + pixel_violations
    return {
        "status": "passed" if not overall_violations else "failed",
        "maxAllowedWidth": max_safe_width,
        "manifestEstimate": manifest_eval,
        "pixelTruth": {
            "status": pixel_status,
            "framesChecked": len(pixel_measurements),
            "edgeBleedCount": len(pixel_violations),
            "measurements": pixel_measurements,
            "sideBySideComparisons": side_by_side,
            "violations": pixel_violations,
        },
        "violations": overall_violations,
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
    chunks = []
    if isinstance(manifest_or_props, dict):
        chunks = manifest_or_props.get("chunks") or (manifest_or_props.get("fontManifest") or {}).get("chunks", [])

    frame_result: Dict[str, Any]
    if extract_frames and video_path:
        frame_result = extract_conformance_frames(video_path, timestamps_sec, output_dir=output_dir)
    else:
        frame_result = {"status": "skipped", "reason": "extraction_not_requested" if not extract_frames else "no_video_path", "frames": []}

    safe_bounds = validate_safe_region_bounds_with_frames(
        layers,
        frames=frame_result.get("frames"),
        chunks=chunks,
        max_safe_width=MAX_SAFE_WIDTH_PX,
        safe_margin_x=SAFE_MARGIN_X_PX,
    )
    line_wrap = validate_line_count_and_wrap(layers)
    shadow_glow = validate_shadow_glow_budget(layers)

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
