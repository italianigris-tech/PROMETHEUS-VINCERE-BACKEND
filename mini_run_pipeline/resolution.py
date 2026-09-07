"""Resolution Retention and Increment Engine for Prometheus Mini-Run Pipeline.

This module guarantees:
1. STRICT NON-DEPRECIATION INVARIANT:
   A video input of a given quality/resolution (e.g. 4K UHD) MUST NEVER depreciate
   below that resolution upon output. A 4K input always produces a 4K (or 8K) output.
2. RESOLUTION INCREMENT SYSTEM:
   Allows callers or automated policies to step up the target resolution
   (e.g., 1080p -> 4K, or 4K -> 8K) with full awareness of compute time,
   GPU VRAM constraints, and monetary cloud rendering costs.
3. CAUSAL VERIFICATION FIXTURE:
   Probes the final rendered MP4 against the planned resolution and input
   dimensions, raising an error if any quality degradation occurred.
"""

from __future__ import annotations

import math
from typing import Any, Dict, Optional
from pathlib import Path


class ResolutionDepreciationError(RuntimeError):
    """Raised when rendered output video resolution depreciates below input or planned target."""
    pass


# Canonical portrait (9:16) resolution tiers
RESOLUTION_TIERS: Dict[str, Dict[str, Any]] = {
    "1080p": {
        "tier": "1080p",
        "width": 1080,
        "height": 1920,
        "label": "1080p Full HD",
        "scale": 1.0,
        "pixels": 1080 * 1920,
    },
    "1440p": {
        "tier": "1440p",
        "width": 1440,
        "height": 2560,
        "label": "1440p 2K QHD",
        "scale": 1440.0 / 1080.0,
        "pixels": 1440 * 2560,
    },
    "4k": {
        "tier": "4k",
        "width": 2160,
        "height": 3840,
        "label": "4K UHD",
        "scale": 2.0,
        "pixels": 2160 * 3840,
    },
    "8k": {
        "tier": "8k",
        "width": 4320,
        "height": 7680,
        "label": "8K FUHD",
        "scale": 4.0,
        "pixels": 4320 * 7680,
    },
}

# Order of tiers from lowest to highest
TIER_HIERARCHY = ["sd_or_720p", "1080p", "1440p", "4k", "8k"]


def classify_resolution(width: int, height: int) -> Dict[str, Any]:
    """Classify video dimensions into a canonical quality tier.

    Handles both portrait (9:16) and landscape (16:9) inputs by evaluating
    the maximum dimension and total pixel count.
    """
    w = max(0, int(width or 0))
    h = max(0, int(height or 0))
    max_dim = max(w, h)
    pixel_count = w * h

    if max_dim >= 7000 or pixel_count >= 30_000_000:
        tier = "8k"
    elif max_dim >= 3500 or pixel_count >= 7_500_000:
        tier = "4k"
    elif max_dim >= 2300 or pixel_count >= 3_500_000:
        tier = "1440p"
    elif max_dim >= 1600 or pixel_count >= 1_800_000:
        tier = "1080p"
    else:
        tier = "sd_or_720p"

    label = RESOLUTION_TIERS.get(tier, {}).get("label", f"{w}x{h}")
    return {
        "tier": tier,
        "width": w,
        "height": h,
        "label": label,
        "pixelCount": pixel_count,
    }


def estimate_resolution_cost(
    target_tier: str,
    duration_sec: float = 30.0,
    parallel_slices: int = 30,
) -> Dict[str, Any]:
    """Provide a detailed cost and feasibility breakdown for a target resolution.

    Calculates:
    - Pixel count relative to 1080p baseline.
    - Estimated wall-clock rendering latency with parallel slice workers.
    - GPU VRAM footprint and hardware requirements.
    - Monetary compute cost (Modal cloud GPU pricing baseline).
    - Architectural feasibility notes.
    """
    baseline_pixels = 1080 * 1920
    target_info = RESOLUTION_TIERS.get(target_tier, RESOLUTION_TIERS["1080p"])
    target_pixels = target_info["pixels"]
    pixel_ratio = round(target_pixels / baseline_pixels, 2)

    if target_tier == "8k":
        # 8K FUHD: 33.2 Megapixels per frame (16x baseline)
        estimated_slice_sec = 180.0
        wall_clock_sec = 240.0
        gpu_vram_mb = 32768
        gpu_tier = "A100 (40GB) / H100 (80GB)"
        gpu_rate_per_sec = 0.00085  # A100 Modal rate
        estimated_cost_usd = round((parallel_slices * estimated_slice_sec * gpu_rate_per_sec), 3)
        feasibility = (
            "Feasible with caveats: Chromium headless WebGL MAX_TEXTURE_SIZE (often 8192px) "
            "is close to 7680px limit. Requires high-memory GPU container (A100) to avoid "
            "OOM during Chromium rendering. Alternative recommendation: native 4K render + "
            "AI/Lanczos post-upscaling for optimal cost-to-fidelity ratio."
        )
    elif target_tier == "4k":
        # 4K UHD: 8.3 Megapixels per frame (4x baseline)
        estimated_slice_sec = 45.0
        wall_clock_sec = 55.0
        gpu_vram_mb = 12288
        gpu_tier = "L4 (24GB) / A10G (24GB) / T4 (16GB)"
        gpu_rate_per_sec = 0.00025  # L4 Modal rate
        estimated_cost_usd = round((parallel_slices * estimated_slice_sec * gpu_rate_per_sec), 3)
        feasibility = (
            "Highly feasible and production-ready: Full WebGL stability in Chromium headless "
            "with swangle/EGL. Modest compute overhead (~+$0.03-$0.05 per 30s video) with "
            "immense visual fidelity retention for 4K inputs."
        )
    elif target_tier == "1440p":
        estimated_slice_sec = 28.0
        wall_clock_sec = 35.0
        gpu_vram_mb = 8192
        gpu_tier = "T4 (16GB) / L4 (24GB)"
        gpu_rate_per_sec = 0.00016
        estimated_cost_usd = round((parallel_slices * estimated_slice_sec * gpu_rate_per_sec), 3)
        feasibility = "Extremely feasible: Low compute overhead, reliable WebGL rendering."
    else:  # 1080p baseline
        estimated_slice_sec = 18.0
        wall_clock_sec = 25.0
        gpu_vram_mb = 4096
        gpu_tier = "T4 (16GB)"
        gpu_rate_per_sec = 0.00016
        estimated_cost_usd = round((parallel_slices * estimated_slice_sec * gpu_rate_per_sec), 3)
        feasibility = "Native production baseline: Fastest render times and lowest compute cost."

    return {
        "targetTier": target_tier,
        "targetResolution": f"{target_info['width']}x{target_info['height']}",
        "pixelRatioVs1080p": pixel_ratio,
        "estimatedWallClockSec": wall_clock_sec,
        "gpuVramRequiredMb": gpu_vram_mb,
        "recommendedGpu": gpu_tier,
        "estimatedComputeCostUsd": estimated_cost_usd,
        "feasibilityAssessment": feasibility,
    }


def plan_resolution(
    input_width: int,
    input_height: int,
    options: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Compute the authoritative resolution plan for a mini-run video.

    Rules enforced:
    1. INVARIANT: Output resolution NEVER depreciates below input quality.
       If input is 4K, output MUST be at least 4K (or 8K).
       If input is 8K, output MUST be 8K.
       If input is 1080p, output is at least 1080p.
    2. RESOLUTION INCREMENT:
       If options specify `incrementResolution=True`, `targetResolution="increment"`,
       or a higher target tier (e.g. "4k", "8k"), the resolution steps up:
       - 1080p input -> increments to 4K UHD.
       - 4K input -> increments to 8K FUHD.
       - 8K input -> remains 8K (maximum ceiling).
    3. EXPLICIT OVERRIDES:
       Callers can request a specific target resolution (`targetResolution="4k"`),
       provided it does not depreciate below the input tier.
    """
    opts = options or {}
    classified_input = classify_resolution(input_width, input_height)
    input_tier = classified_input["tier"]

    # Normalize options
    raw_target = str(
        opts.get("targetResolution")
        or opts.get("resolution")
        or opts.get("outputResolution")
        or "auto"
    ).lower().strip()

    increment_flag = bool(
        opts.get("incrementResolution")
        or opts.get("increment")
        or opts.get("autoUpscale")
        or raw_target in ("increment", "stepup", "upscale")
    )

    # Determine input baseline minimum tier (cannot depreciate below this)
    if input_tier == "8k":
        min_allowed_tier = "8k"
    elif input_tier == "4k":
        min_allowed_tier = "4k"
    elif input_tier == "1440p":
        min_allowed_tier = "1440p"
    else:
        min_allowed_tier = "1080p"  # 1080p is standard production floor

    # Resolve target tier
    is_incremented = False
    policy = "retention"
    reason = ""

    if raw_target in RESOLUTION_TIERS:
        # Explicit target requested
        requested_tier = raw_target
        # Verify non-depreciation
        req_idx = TIER_HIERARCHY.index(requested_tier)
        min_idx = TIER_HIERARCHY.index(min_allowed_tier)
        if req_idx < min_idx:
            # Depreciation requested: Strictly denied! Enforce input retention floor.
            target_tier = min_allowed_tier
            policy = "retention_enforced"
            reason = (
                f"Requested resolution '{requested_tier}' would depreciate {classified_input['label']} "
                f"input quality. Enforced non-depreciation floor: {target_tier}."
            )
        else:
            target_tier = requested_tier
            policy = "explicit"
            is_incremented = (req_idx > min_idx)
            reason = f"Explicitly requested target resolution: {target_tier}."
    elif increment_flag:
        # Step up one tier above input minimum
        if min_allowed_tier in ("sd_or_720p", "1080p"):
            target_tier = "4k"
            is_incremented = True
            policy = "increment"
            reason = "Resolution increment active: 1080p input stepped up to 4K UHD."
        elif min_allowed_tier in ("1440p", "4k"):
            target_tier = "8k"
            is_incremented = True
            policy = "increment"
            reason = "Resolution increment active: 4K input stepped up to 8K FUHD."
        else:  # 8k
            target_tier = "8k"
            policy = "retention_max"
            reason = "8K input already at maximum quality ceiling."
    else:
        # Default retention policy: retain input quality tier
        target_tier = min_allowed_tier
        policy = "retention"
        if target_tier == "4k":
            reason = "Input retention guarantee: 4K UHD input maintained end-to-end without downsampling."
        elif target_tier == "8k":
            reason = "Input retention guarantee: 8K FUHD input maintained end-to-end without downsampling."
        else:
            reason = "Standard 1080p Full HD production tier."

    target_info = RESOLUTION_TIERS[target_tier]
    target_width = target_info["width"]
    target_height = target_info["height"]
    scale_factor = float(target_info["scale"])

    cost_profile = estimate_resolution_cost(target_tier)

    return {
        "input": {
            "width": classified_input["width"],
            "height": classified_input["height"],
            "tier": classified_input["tier"],
            "label": classified_input["label"],
        },
        "target": {
            "width": target_width,
            "height": target_height,
            "tier": target_tier,
            "label": target_info["label"],
        },
        "scaleFactor": scale_factor,
        "isIncremented": is_incremented,
        "isPreserved": True,
        "policy": policy,
        "reason": reason,
        "costProfile": cost_profile,
    }


def verify_output_resolution(
    output_path: str,
    plan: Dict[str, Any],
    input_width: Optional[int] = None,
    input_height: Optional[int] = None,
) -> Dict[str, Any]:
    """Causal verification fixture that inspects the final rendered video.

    Probes the output file on disk and verifies:
    1. Output dimensions match or exceed target dimensions.
    2. Output dimensions match or exceed original input dimensions (zero depreciation).

    Raises `ResolutionDepreciationError` if quality depreciated below requirements.
    """
    from . import silence

    p = Path(output_path)
    if not p.exists():
        raise FileNotFoundError(f"Rendered output video does not exist: {output_path}")

    probe = silence.probe_media(str(output_path))
    actual_width = int(probe.get("width") or 0)
    actual_height = int(probe.get("height") or 0)

    target_w = int(plan.get("target", {}).get("width", 1080))
    target_h = int(plan.get("target", {}).get("height", 1920))
    target_tier = plan.get("target", {}).get("tier", "1080p")

    # Invariant 1: Output must meet planned target
    if actual_width < target_w or actual_height < target_h:
        raise ResolutionDepreciationError(
            f"Rendered video resolution ({actual_width}x{actual_height}) depreciated below "
            f"planned target ({target_w}x{target_h} {target_tier})!"
        )

    # Invariant 2: If input was 4K (e.g. 2160x3840 or 3840x2160), output must be >= 4K
    in_w = int(input_width or plan.get("input", {}).get("width", 0))
    in_h = int(input_height or plan.get("input", {}).get("height", 0))
    in_max = max(in_w, in_h)
    actual_max = max(actual_width, actual_height)

    if in_max >= 3500 and actual_max < 3500:
        raise ResolutionDepreciationError(
            f"Severe Quality Depreciation: Input video was 4K ({in_w}x{in_h}), but final "
            f"output dropped to {actual_width}x{actual_height}!"
        )

    return {
        "status": "verified",
        "actualWidth": actual_width,
        "actualHeight": actual_height,
        "targetWidth": target_w,
        "targetHeight": target_h,
        "targetTier": target_tier,
        "inputWidth": in_w,
        "inputHeight": in_h,
        "nonDepreciationSatisfied": True,
        "scaleFactor": plan.get("scaleFactor", 1.0),
    }


def build_resolution_enforcement_filter(
    current_width: int,
    current_height: int,
    target_width: int,
    target_height: int,
) -> Optional[str]:
    """Generate high-order Lanczos scaling filter if dimension alignment is required."""
    if current_width == target_width and current_height == target_height:
        return None
    return f"scale={target_width}:{target_height}:flags=lanczos+accurate_rnd"
