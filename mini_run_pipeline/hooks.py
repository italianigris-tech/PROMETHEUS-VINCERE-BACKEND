"""Hooks — The intro/attention-grabbing treatment module for the first 3-5 seconds.

Every hook is a multi-layer cinematic camera + optics + artifact + kinetic reveal
that activates on chunk index 0 (the attention hook position). Hooks are engineered
to seize viewer attention during the critical 0-3s "click & see" window.

Hook Lingua Library (21 Distinct Forms across 5 Cinematic Families):
====================================================================
Family A: Optical Defocus, Bokeh & Bloom ("The Blow Spectrum")
  1. hook_bokeh_defocus_bloom: Wide-aperture anamorphic bokeh discs resolving to crisp focus.
  2. hook_gaussian_lens_reveal: Multi-pass deep Gaussian diffusion mist with luminance ramp.
  3. hook_directional_whip_blur: Anamorphic horizontal streak blur simulating whip-pan deceleration.
  4. hook_radial_zoom_blur: Center-outward radial warp blur snapping into place.

Family B: Light, Flash & Optical Flares ("Light & Flash Cuts")
  5. hook_sharp_white_flash_cut: 3-frame 100% white-out exposure slam with exponential decay.
  6. hook_anamorphic_flare_burst: Horizontal anamorphic cyan/gold streak flare traversing text.
  7. hook_vintage_film_burn_strobe: 35mm warm amber light leak with frame-jitter gate burn.
  8. hook_luma_strobe_pulse: 3-beat alternating exposure pulse (+1.8EV) synced to speech onset.

Family C: Camera Dynamics & Spatial Motion ("Camera & Perspective")
  9. hook_cinematic_dolly_zoom: Hitchcock vertigo push-pull (inverse focal length illusion).
 10. hook_crash_zoom_snap: High-velocity crash zoom (1.45x -> 1.0x in 6 frames) with spring overshoot.
 11. hook_isometric_3d_slam: 3D perspective spatial drop (-45deg X, 25deg Y) slamming flush.
 12. hook_vertical_kinetic_pedestal: High-speed vertical pedestal sweep (translateY 120px -> 0).
 13. hook_smooth_zoom_in: Gentle quad/S-curve zoom from 0.92 -> 1.0.
 14. hook_full_zoom_up: Bottom-up full zoom with depth perspective.

Family D: Digital Distortion, Glitch & Signal Artifacts ("Media Glitch & Cyber")
 15. hook_rgb_chromatic_split_glitch: Dual-channel Red/Cyan & Blue/Yellow split (+-18px) with slice tear.
 16. hook_crt_scanline_matrix_decode: Phosphor CRT scanlines with alphanumeric matrix character decode.
 17. hook_vhs_tape_tracking_tear: Magnetic tape head-switch tracking noise with luma distortion.

Family E: Material, Luxury & Surface Shaders ("Metallic, Chrome & Liquid")
 18. hook_metallic_chrome_reflection: Mirror chrome gradient with animated specular reflection sweep.
 19. hook_liquid_ink_metaball_reveal: Viscous fluid droplets coalescing via threshold metaballs into type.
 20. hook_zora_aperture_mask_bloom: Organic soft-edged aperture mask blooming from semantic center.
 21. hook_motion_blur_word: Per-word horizontal kinetic entrance with velocity blur decay.

All easing curves are quad-bezier or cubic-bezier for frame-deterministic keyframes.
"""

from __future__ import annotations
import re
from typing import Any, Dict, List, Optional, Set

# Complete 21-treatment hook lingua registry (covering all 5 families + combinations)
HOOK_TREATMENTS: Set[str] = {
    # Family A: Optical Defocus, Bokeh & Bloom
    "hook_bokeh_defocus_bloom",
    "hook_gaussian_lens_reveal",
    "hook_directional_whip_blur",
    "hook_radial_zoom_blur",

    # Family B: Light, Flash & Optical Flares
    "hook_sharp_white_flash_cut",
    "hook_anamorphic_flare_burst",
    "hook_vintage_film_burn_strobe",
    "hook_luma_strobe_pulse",

    # Family C: Camera Dynamics & Spatial Motion
    "hook_cinematic_dolly_zoom",
    "hook_crash_zoom_snap",
    "hook_isometric_3d_slam",
    "hook_vertical_kinetic_pedestal",
    "hook_smooth_zoom_in",
    "hook_full_zoom_up",

    # Family D: Digital Distortion, Glitch & Signal Artifacts
    "hook_rgb_chromatic_split_glitch",
    "hook_crt_scanline_matrix_decode",
    "hook_vhs_tape_tracking_tear",

    # Family E: Material, Luxury & Surface Shaders
    "hook_metallic_chrome_reflection",
    "hook_liquid_ink_metaball_reveal",
    "hook_zora_aperture_mask_bloom",
    "hook_motion_blur_word",
}

# Cubic-bezier curve definitions for frame-deterministic physics
HOOK_EASE_CURVES: Dict[str, List[float]] = {
    "smooth_push": [0.16, 1.0, 0.3, 1.0],      # quad-out cinematic push
    "smooth_pop": [0.34, 1.56, 0.64, 1.0],      # springy overshoot pop
    "smooth_wave": [0.22, 1.0, 0.36, 1.0],      # smooth wave settle
    "smooth_drift": [0.12, 0.0, 0.39, 1.0],     # slow drift
    "crash_snap": [0.20, 1.80, 0.40, 1.0],      # aggressive crash snap with dampening
    "exp_decay": [0.00, 0.00, 0.20, 1.0],       # exponential flash decay
    "elastic_pop": [0.34, 1.56, 0.64, 1.0],     # elastic bounce
    "whip_pan": [0.08, 0.95, 0.20, 1.0],        # high-shutter whip pan
    "slow_drift": [0.12, 0.0, 0.39, 1.0],
}

# Rich semantic keyword mapping for intelligent automatic hook selection
HOOK_KEYWORD_MAP: List[Dict[str, Any]] = [
    {
        "preset": "hook_metallic_chrome_reflection",
        "patterns": [r"\bmoney\b", r"\bgold\b", r"\brich\b", r"\bmillion\b", r"\bbillion\b",
                     r"\bscale\b", r"\bluxury\b", r"\bwealth\b", r"\bprofit\b", r"\bpremium\b"],
        "weight": 95,
    },
    {
        "preset": "hook_rgb_chromatic_split_glitch",
        "patterns": [r"\bglitch\b", r"\bcode\b", r"\btech\b", r"\bhack\b", r"\bai\b",
                     r"\bsoftware\b", r"\bdata\b", r"\bbreak\b", r"\bbroken\b", r"\berror\b"],
        "weight": 92,
    },
    {
        "preset": "hook_crt_scanline_matrix_decode",
        "patterns": [r"\bmatrix\b", r"\bcyber\b", r"\bterminal\b", r"\bsystem\b", r"\bsecret\b",
                     r"\bdecode\b", r"\bprompt\b", r"\banaly\b"],
        "weight": 90,
    },
    {
        "preset": "hook_sharp_white_flash_cut",
        "patterns": [r"\bboom\b", r"\bstop\b", r"\bnever\b", r"\bshock\b", r"\bdead\b",
                     r"\bkill\b", r"\bdie\b", r"\bwarning\b", r"\balert\b", r"\bwatch\b"],
        "weight": 88,
    },
    {
        "preset": "hook_crash_zoom_snap",
        "patterns": [r"\bthis\b", r"\blook\b", r"\bsee\b", r"\bhere\b", r"\bnow\b",
                     r"\bfast\b", r"\binstant\b", r"\bruns?\b", r"\bquick\b"],
        "weight": 85,
    },
    {
        "preset": "hook_bokeh_defocus_bloom",
        "patterns": [r"\bdream\b", r"\blife\b", r"\bfeeling\b", r"\bthought\b", r"\bcalm\b",
                     r"\bmagic\b", r"\bvision\b", r"\bimagine\b", r"\bbeautiful\b"],
        "weight": 84,
    },
    {
        "preset": "hook_vintage_film_burn_strobe",
        "patterns": [r"\bold\b", r"\byears?\b", r"\bremember\b", r"\bhistory\b", r"\bpast\b",
                     r"\bstory\b", r"\bvintage\b", r"\bfilm\b", r"\bclassic\b"],
        "weight": 82,
    },
    {
        "preset": "hook_liquid_ink_metaball_reveal",
        "patterns": [r"\bflow\b", r"\bfluid\b", r"\bwater\b", r"\bliquid\b", r"\bink\b",
                     r"\bdeep\b", r"\bdrop\b", r"\bblood\b", r"\boil\b"],
        "weight": 80,
    },
]


def select_hook_treatment(
    chunk_text: str,
    design: Optional[Dict[str, Any]] = None,
    prompt: Optional[str] = None,
) -> str:
    """Select the optimal hook treatment based on transcript cues and design preferences."""
    design = design or {}

    # 1. Explicit override from design preferences
    explicit = design.get("hookPreset") or design.get("heroFxPreset")
    if explicit and explicit in HOOK_TREATMENTS:
        return explicit

    text_corpus = f"{chunk_text} {prompt or ''}".lower()

    # 2. Semantic pattern matching
    for entry in HOOK_KEYWORD_MAP:
        for pat in entry["patterns"]:
            if re.search(pat, text_corpus):
                return entry["preset"]

    # 3. Motion style preference fallback
    motion_style = str(design.get("motionStyle", "cinematic")).lower()
    if motion_style == "kinetic":
        return "hook_crash_zoom_snap"
    if motion_style == "editorial":
        return "hook_bokeh_defocus_bloom"

    # Default canonical cinematic opening
    return "hook_cinematic_dolly_zoom"


def plan_hook_treatment(
    chunk_index: int,
    chunk_text: str,
    design: Optional[Dict[str, Any]] = None,
    brand_palette: Optional[Dict[str, str]] = None,
    prompt: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Plan a comprehensive multi-layer hook treatment for chunk index 0.

    Constructs a frame-deterministic HookPlan contract encompassing:
    - Layer 1: Camera Dynamic (zoom, push, perspective drop, pedestal)
    - Layer 2: Optical Event (bokeh bloom, Gaussian mist, white flash, flare streak)
    - Layer 3: Texture/Artifact (RGB split glitch, CRT scanlines, chrome sweep, VHS tear)
    - Layer 4: Kinetic Typography (motion blur, character decode, liquid morph, aperture mask)
    - Layer 5: Synchronized Audio Cue (sub boom, whoosh impact, glitch rip, flash click)
    - Legacy backward-compatible fields (zoom, lensBlur, directionalBlur, motionBlur, brandGlow)
    """
    if chunk_index != 0:
        return None

    design = design or {}
    hooks_enabled = str(design.get("hooks", "enabled")).lower() != "disabled"
    if not hooks_enabled:
        return None

    intensity = float(design.get("visualIntensity", 0.82))
    word_count = max(1, len(chunk_text.split()))

    # Select the primary hook lingua form
    selected_hook = select_hook_treatment(chunk_text, design, prompt)

    # Brand glow extraction
    glow_rgb = "255, 255, 255"
    if brand_palette:
        zone = brand_palette.get("zone")
        if isinstance(zone, dict) and "glow_rgb" in zone:
            glow_rgb = zone["glow_rgb"]
        elif "primary_rgb" in brand_palette:
            glow_rgb = brand_palette["primary_rgb"]

    # Base duration derived from speech tempo and design intensity
    duration_ms = max(600, min(2400, int(900 + intensity * 600 + word_count * 45)))

    # Construct modular 5-layer plan
    camera_layer = _build_camera_layer(selected_hook, intensity, duration_ms)
    optical_layer = _build_optical_layer(selected_hook, intensity, duration_ms, glow_rgb)
    artifact_layer = _build_artifact_layer(selected_hook, intensity)
    typography_layer = _build_typography_layer(selected_hook, intensity, word_count)
    audio_cue_layer = _build_audio_cue_layer(selected_hook, intensity)

    # Backward-compatible legacy layers for existing Remotion components
    zoom_legacy = {
        "kind": camera_layer.get("kind", "dolly_zoom"),
        "startScale": camera_layer.get("startScale", 0.94),
        "endScale": camera_layer.get("endScale", 1.0),
        "overshootScale": camera_layer.get("overshootScale", 1.0),
        "curve": camera_layer.get("curve", HOOK_EASE_CURVES["smooth_push"]),
        "durationMs": duration_ms,
    }

    lens_blur_legacy = {
        "kind": "camera_lens_blur",
        "startBlurPx": optical_layer.get("startBlurPx", round(14 + intensity * 14, 1)),
        "endBlurPx": 0.0,
        "curve": optical_layer.get("curve", HOOK_EASE_CURVES["smooth_push"]),
        "durationMs": duration_ms,
    }

    directional_blur_legacy = {
        "kind": "directional_blur",
        "startBlurPx": round(optical_layer.get("startBlurPx", 0.0) * 0.5, 1) if selected_hook == "hook_directional_whip_blur" else 0.0,
        "peakBlurPx": round(6 + intensity * 6, 1) if selected_hook == "hook_directional_whip_blur" else round(3 + intensity * 3, 1),
        "endBlurPx": 0.0,
        "angle": 0.0,
        "curve": HOOK_EASE_CURVES["whip_pan" if selected_hook == "hook_directional_whip_blur" else "smooth_wave"],
        "durationMs": duration_ms,
    }

    motion_blur_legacy = {
        "enabled": True,
        "sampleCount": max(4, min(16, int(6 + intensity * 8))),
        "velocityScale": round(0.5 + intensity * 0.5, 2),
    }

    plan = {
        "hookEnabled": True,
        "hookType": selected_hook,
        "durationMs": duration_ms,
        "intensity": intensity,

        # Modular 5-Layer System
        "camera": camera_layer,
        "optical": optical_layer,
        "artifact": artifact_layer,
        "typography": typography_layer,
        "audioCue": audio_cue_layer,

        # Backward compatibility
        "zoom": zoom_legacy,
        "lensBlur": lens_blur_legacy,
        "directionalBlur": directional_blur_legacy,
        "motionBlur": motion_blur_legacy,
        "brandGlow": glow_rgb,
    }

    return plan


def _build_camera_layer(hook_type: str, intensity: float, duration_ms: int) -> Dict[str, Any]:
    """Derive deterministic camera motion keyframe properties."""
    if hook_type == "hook_crash_zoom_snap":
        return {
            "kind": "crash_zoom",
            "startScale": round(1.35 + intensity * 0.20, 2),
            "endScale": 1.0,
            "overshootScale": 0.97,
            "curve": HOOK_EASE_CURVES["crash_snap"],
            "durationMs": min(750, int(duration_ms * 0.6)),
        }
    if hook_type == "hook_isometric_3d_slam":
        return {
            "kind": "isometric_slam",
            "startScale": 0.85,
            "endScale": 1.0,
            "rotateXDeg": -38.0,
            "rotateYDeg": 22.0,
            "translateZ": 140,
            "curve": HOOK_EASE_CURVES["smooth_pop"],
            "durationMs": duration_ms,
        }
    if hook_type == "hook_vertical_kinetic_pedestal" or hook_type == "hook_full_zoom_up":
        return {
            "kind": "pedestal_up",
            "startScale": 0.82,
            "endScale": 1.0,
            "translateY": round(30 + intensity * 40, 1),
            "curve": HOOK_EASE_CURVES["smooth_push"],
            "durationMs": duration_ms,
        }
    if hook_type == "hook_smooth_zoom_in":
        return {
            "kind": "smooth_zoom",
            "startScale": 0.92,
            "endScale": 1.0,
            "overshootScale": 1.0,
            "curve": HOOK_EASE_CURVES["smooth_push"],
            "durationMs": duration_ms,
        }

    # Default dolly zoom
    return {
        "kind": "dolly_zoom",
        "startScale": round(0.96 - (intensity * 0.05), 3),
        "endScale": 1.0,
        "overshootScale": 1.0,
        "curve": HOOK_EASE_CURVES["smooth_push"],
        "durationMs": duration_ms,
    }


def _build_optical_layer(hook_type: str, intensity: float, duration_ms: int, glow_rgb: str) -> Dict[str, Any]:
    """Derive optical, blur, flash, and lighting properties."""
    if hook_type == "hook_sharp_white_flash_cut":
        return {
            "kind": "white_flash",
            "startBlurPx": 0.0,
            "endBlurPx": 0.0,
            "flashIntensity": round(0.85 + intensity * 0.15, 2),
            "flashDecayFrames": max(4, min(12, int(6 + intensity * 4))),
            "curve": HOOK_EASE_CURVES["exp_decay"],
            "durationMs": min(500, duration_ms),
        }
    if hook_type == "hook_bokeh_defocus_bloom":
        return {
            "kind": "bokeh_bloom",
            "startBlurPx": round(26 + intensity * 16, 1),
            "endBlurPx": 0.0,
            "specularGlow": glow_rgb,
            "curve": HOOK_EASE_CURVES["smooth_push"],
            "durationMs": duration_ms,
        }
    if hook_type == "hook_gaussian_lens_reveal":
        return {
            "kind": "gaussian_reveal",
            "startBlurPx": round(22 + intensity * 12, 1),
            "endBlurPx": 0.0,
            "brightnessRamp": round(1.35 + intensity * 0.25, 2),
            "curve": HOOK_EASE_CURVES["smooth_wave"],
            "durationMs": duration_ms,
        }
    if hook_type == "hook_directional_whip_blur":
        return {
            "kind": "directional_whip",
            "startBlurPx": round(32 + intensity * 20, 1),
            "endBlurPx": 0.0,
            "whipAngle": 0.0,
            "curve": HOOK_EASE_CURVES["whip_pan"],
            "durationMs": min(900, duration_ms),
        }
    if hook_type == "hook_radial_zoom_blur":
        return {
            "kind": "radial_zoom_blur",
            "startBlurPx": round(18 + intensity * 14, 1),
            "endBlurPx": 0.0,
            "curve": HOOK_EASE_CURVES["crash_snap"],
            "durationMs": min(800, duration_ms),
        }
    if hook_type == "hook_anamorphic_flare_burst":
        return {
            "kind": "flare_burst",
            "startBlurPx": 4.0,
            "endBlurPx": 0.0,
            "flareColor": "cyan_gold",
            "curve": HOOK_EASE_CURVES["smooth_push"],
            "durationMs": duration_ms,
        }
    if hook_type == "hook_vintage_film_burn_strobe":
        return {
            "kind": "film_burn",
            "startBlurPx": 6.0,
            "endBlurPx": 0.0,
            "burnColor": "#FF8A00",
            "curve": HOOK_EASE_CURVES["smooth_wave"],
            "durationMs": duration_ms,
        }
    if hook_type == "hook_luma_strobe_pulse":
        return {
            "kind": "luma_strobe",
            "startBlurPx": 0.0,
            "endBlurPx": 0.0,
            "pulseCount": 3,
            "curve": HOOK_EASE_CURVES["smooth_pop"],
            "durationMs": min(850, duration_ms),
        }

    # Standard lens reveal
    return {
        "kind": "standard_lens_blur",
        "startBlurPx": round(14 + intensity * 10, 1),
        "endBlurPx": 0.0,
        "curve": HOOK_EASE_CURVES["smooth_push"],
        "durationMs": duration_ms,
    }


def _build_artifact_layer(hook_type: str, intensity: float) -> Dict[str, Any]:
    """Derive shader artifacts, glitch, scanlines, or metallic sweeps."""
    if hook_type == "hook_rgb_chromatic_split_glitch":
        return {
            "kind": "rgb_split_glitch",
            "intensity": round(0.6 + intensity * 0.4, 2),
            "rgbDisplacePx": round(12 + intensity * 10, 1),
            "jitterFrequency": 0.85,
        }
    if hook_type == "hook_crt_scanline_matrix_decode":
        return {
            "kind": "crt_matrix_scanlines",
            "intensity": 0.8,
            "scanlineDensity": 4.0,
            "phosphorGlow": "#00FF88",
        }
    if hook_type == "hook_vhs_tape_tracking_tear":
        return {
            "kind": "vhs_tracking_tear",
            "intensity": 0.75,
            "sliceJitterPx": 16.0,
        }
    if hook_type == "hook_metallic_chrome_reflection":
        return {
            "kind": "chrome_sweep",
            "intensity": 1.0,
            "gradient": "linear-gradient(180deg, #FFFFFF 0%, #E4E4E7 35%, #71717A 70%, #18181B 100%)",
            "specularSpeed": 1.2,
        }
    return {
        "kind": "none",
        "intensity": 0.0,
    }


def _build_typography_layer(hook_type: str, intensity: float, word_count: int) -> Dict[str, Any]:
    """Derive typography entrance kinetics."""
    return {
        "preset": hook_type,
        "staggerMs": max(30, min(120, int(60 - intensity * 20))),
        "motionBlurSamples": max(4, min(16, int(6 + intensity * 8))),
        "maskExpansion": hook_type in {"hook_zora_aperture_mask_bloom", "hook_directional_whip_blur"},
    }


def _build_audio_cue_layer(hook_type: str, intensity: float) -> Dict[str, Any]:
    """Derive frame-zero audio DJ SFX synchronization cues."""
    if hook_type in {"hook_sharp_white_flash_cut", "hook_crash_zoom_snap"}:
        return {"sfxType": "sub_boom_impact", "gainDb": -11.0, "triggerMs": 0}
    if hook_type in {"hook_directional_whip_blur", "hook_radial_zoom_blur"}:
        return {"sfxType": "whoosh_fast", "gainDb": -13.0, "triggerMs": 0}
    if hook_type in {"hook_rgb_chromatic_split_glitch", "hook_crt_scanline_matrix_decode", "hook_vhs_tape_tracking_tear"}:
        return {"sfxType": "glitch_data_rip", "gainDb": -14.0, "triggerMs": 0}
    if hook_type in {"hook_vintage_film_burn_strobe", "hook_anamorphic_flare_burst"}:
        return {"sfxType": "film_gate_shutter", "gainDb": -15.0, "triggerMs": 0}
    return {"sfxType": "whoosh_slow", "gainDb": -16.0, "triggerMs": 0}


def hook_treatment_ids() -> Set[str]:
    return HOOK_TREATMENTS


__all__ = [
    "plan_hook_treatment",
    "select_hook_treatment",
    "hook_treatment_ids",
    "HOOK_TREATMENTS",
    "HOOK_EASE_CURVES",
    "HOOK_KEYWORD_MAP",
]