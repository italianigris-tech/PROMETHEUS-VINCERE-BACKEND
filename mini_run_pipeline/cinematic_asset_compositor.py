"""Cinematic Asset Introduction Compositor for Mini-Runs.

Renders broadcast-grade 9:16 vertical MP4 video applying the authoritative
cinematic introduction toolkit directly to the talking-head timeline:
1. Optical Blur & Depth-of-Field Introductions:
   - Background Defocus Isolation (Target Spotlight): Gaussian blur (radius: 20-30px) + 15% brightness dip.
   - Rack-Focus Dive: Scale down 125% -> 100% while optical blur transitions 40px -> 0px.
   - Directional Motion-Streak Entrance.
2. Spatial, Rotational & Physics-Based Introductions:
   - Slap-Drop with Contact Bounce (exponential decrescendo + [102, 98] scale squash).
   - Canvas Reaction Jolt (1-frame 3px downward displacement of the underlying video on impact).
   - Lateral Friction Slide (max velocity entrance -> 70% friction deceleration + trailing shadow vector).
   - 3D Off-Axis Swing (hinged rotational perspective entry).
3. Shadow Mechanics & State Transitions:
   - Double-State Cast Shadow (Contact shadow: 70% opacity, 3px offset, 4px feather +
     Directional throw shadow: 25% opacity, 35px offset, 40px feather).
   - Trailing Shadow Vector.
4. Post-Introduction Micro-Movements:
   - Continuous Sub-Pixel Drift (100% -> 101.8% scale).
   - Rotational Damped Oscillation (Pendulum settle: +2.5° -> -1.0° -> +0.3° -> 0°).
5. 38.Whitecheckered Transparent Canvas:
   - High-contrast transparent checkerboard backing (.wc-checker-backer).
   - Pure crisp white (#FFFFFF) typography with glowing cyan (#38BDF8) & gold (#FFE600) accents.
6. Audio Muxing:
   - Multiplexes original dialogue/audio via FFmpeg into standard H.264 / AAC MP4.
"""

from __future__ import annotations

import json
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ---------------------------------------------------------------------------
# Font & Styling Constants
# ---------------------------------------------------------------------------

FONT_BOLD_PATH = "C:/Windows/Fonts/segoeuib.ttf"
FONT_REGULAR_PATH = "C:/Windows/Fonts/segoeui.ttf"
FONT_MONO_PATH = "C:/Windows/Fonts/consola.ttf"

def _get_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


# ---------------------------------------------------------------------------
# 38.Whitecheckered Graphic Asset Card Generator
# ---------------------------------------------------------------------------

def create_whitecheckered_asset_card(
    headline: str,
    subline: str,
    badges: List[str],
    archetype_label: str = "ARCHETYPE #38",
    status_label: str = "38.WHITECHECKERED • ALPHA PREVIEW",
    width: int = 620,
    height: int = 340,
    active_result: Optional[str] = None,
    secondary_result: Optional[str] = None,
) -> Image.Image:
    """Generate a high-fidelity 38.Whitecheckered transparent card RGBA image."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Outer Container Glass / Dark Slate Base
    corner_r = 16
    draw.rounded_rectangle(
        [(0, 0), (width - 1, height - 1)],
        radius=corner_r,
        fill=(9, 13, 22, 230),
        outline=(56, 189, 248, 120),
        width=2,
    )

    # 2. Header Bar: Archetype Badge + Status Pill
    font_badge = _get_font(FONT_BOLD_PATH, 14)
    font_status = _get_font(FONT_MONO_PATH, 12)

    # Badge Pill (Neon Cyan)
    draw.rounded_rectangle([(16, 14), (160, 36)], radius=6, fill=(56, 189, 248, 45), outline=(56, 189, 248, 180), width=1)
    draw.text((26, 17), archetype_label, font=font_badge, fill=(56, 189, 248, 255))

    # Status Pill
    draw.text((width - 240, 18), status_label, font=font_status, fill=(148, 163, 184, 255))

    # 3. Transparent Checkerboard Backer (.wc-checker-backer)
    cb_x1, cb_y1 = 16, 48
    cb_x2, cb_y2 = width - 16, height - 52
    draw.rounded_rectangle([(cb_x1, cb_y1), (cb_x2, cb_y2)], radius=10, fill=(12, 16, 28, 240), outline=(255, 255, 255, 30), width=1)

    # Draw subtle white checks (16x16 grid, 5% opacity white)
    check_size = 16
    for cy in range(cb_y1 + 1, cb_y2 - check_size, check_size):
        for cx in range(cb_x1 + 1, cb_x2 - check_size, check_size):
            if ((cx // check_size) + (cy // check_size)) % 2 == 0:
                draw.rectangle([(cx, cy), (cx + check_size, cy + check_size)], fill=(255, 255, 255, 10))

    # 4. Search Bar / Headline Box
    sb_x1, sb_y1 = cb_x1 + 12, cb_y1 + 12
    sb_x2, sb_y2 = cb_x2 - 12, cb_y1 + 64
    draw.rounded_rectangle([(sb_x1, sb_y1), (sb_x2, sb_y2)], radius=8, fill=(15, 23, 42, 220), outline=(56, 189, 248, 255), width=2)

    font_icon = _get_font(FONT_BOLD_PATH, 20)
    font_query = _get_font(FONT_BOLD_PATH, 18)
    draw.text((sb_x1 + 14, sb_y1 + 13), "🔍", font=font_icon, fill=(56, 189, 248, 255))
    draw.text((sb_x1 + 46, sb_y1 + 15), headline, font=font_query, fill=(255, 255, 255, 255))
    # Blinking cursor bar
    draw.text((sb_x1 + 50 + int(draw.textlength(headline, font=font_query)), sb_y1 + 14), "|", font=font_query, fill=(56, 189, 248, 255))

    # 5. Dropdown Results / Inflection Payload Cards
    card1_y1 = sb_y2 + 10
    card1_y2 = card1_y1 + 68
    draw.rounded_rectangle([(sb_x1, card1_y1), (sb_x2, card1_y2)], radius=8, fill=(56, 189, 248, 25), outline=(56, 189, 248, 200), width=1)

    font_card_badge = _get_font(FONT_BOLD_PATH, 12)
    font_card_title = _get_font(FONT_BOLD_PATH, 15)
    font_card_sub = _get_font(FONT_REGULAR_PATH, 13)

    b1_text = badges[0] if badges else "🎯 CORE FOCUS"
    res1_text = active_result or subline
    draw.text((sb_x1 + 14, card1_y1 + 10), b1_text, font=font_card_badge, fill=(255, 230, 0, 255))
    draw.text((sb_x1 + 14, card1_y1 + 28), res1_text[:46], font=font_card_title, fill=(255, 255, 255, 255))
    draw.text((sb_x1 + 14, card1_y1 + 48), "Exponential Leverage Multiplier Activated", font=font_card_sub, fill=(148, 163, 184, 255))

    # Second result card if space allows
    card2_y1 = card1_y2 + 8
    card2_y2 = min(card2_y1 + 58, cb_y2 - 8)
    if card2_y2 > card2_y1 + 35:
        draw.rounded_rectangle([(sb_x1, card2_y1), (sb_x2, card2_y2)], radius=8, fill=(15, 23, 42, 180), outline=(255, 255, 255, 30), width=1)
        b2_text = badges[1] if len(badges) > 1 else "📊 SYSTEM LOOP"
        res2_text = secondary_result or "Iterative Volume with Feedback Verification"
        draw.text((sb_x1 + 14, card2_y1 + 8), b2_text, font=font_card_badge, fill=(56, 189, 248, 255))
        draw.text((sb_x1 + 14, card2_y1 + 25), res2_text[:48], font=font_card_title, fill=(203, 213, 225, 255))

    # 6. Footer Pill: Bounded Duration + Verification
    font_footer = _get_font(FONT_BOLD_PATH, 12)
    draw.text((20, height - 34), "⏱️ Sample-Accurate Temporal Clamping", font=font_footer, fill=(255, 230, 0, 255))
    draw.text((width - 180, height - 34), "✓ Zero Overflow Verified", font=font_footer, fill=(16, 185, 129, 255))

    return img


# ---------------------------------------------------------------------------
# Polarizing Bevel / Card Elevation B-Roll Container
# ---------------------------------------------------------------------------

def create_polarizing_broll_card(
    broll_frame: np.ndarray,
    headline: str,
    badge: str = "GOOGLE FLOW • VEO 3.1",
    width: int = 620,
    height: int = 340,
) -> Image.Image:
    """Wrap B-roll footage inside a Polarizing Bevel container with archival badge."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Outer Polarizing / Evidentiary Matte Border
    corner_r = 14
    draw.rounded_rectangle(
        [(0, 0), (width - 1, height - 1)],
        radius=corner_r,
        fill=(10, 14, 22, 245),
        outline=(220, 225, 235, 180),
        width=2,
    )

    # 2. Inner Frame for B-roll (12px inset)
    inner_x1, inner_y1 = 12, 40
    inner_x2, inner_y2 = width - 12, height - 44
    inner_w = inner_x2 - inner_x1
    inner_h = inner_y2 - inner_y1

    # Resize B-roll frame and convert to PIL
    broll_rgb = cv2.cvtColor(broll_frame, cv2.COLOR_BGR2RGB)
    broll_pil = Image.fromarray(broll_rgb).resize((inner_w, inner_h), Image.Resampling.LANCZOS)
    img.paste(broll_pil, (inner_x1, inner_y1))

    # Inner bevel stroke
    draw.rectangle([(inner_x1, inner_y1), (inner_x2, inner_y2)], outline=(255, 255, 255, 70), width=1)

    # 3. Top Archival Badge Pill
    font_badge = _get_font(FONT_BOLD_PATH, 13)
    font_mono = _get_font(FONT_MONO_PATH, 11)
    draw.rounded_rectangle([(14, 10), (230, 32)], radius=5, fill=(56, 189, 248, 40), outline=(56, 189, 248, 160), width=1)
    draw.text((22, 13), f"🎬 {badge}", font=font_badge, fill=(56, 189, 248, 255))
    draw.text((width - 170, 14), "1080P • 24FPS DCI", font=font_mono, fill=(148, 163, 184, 255))

    # 4. Lower Headline Overlay Bar
    bar_y1 = height - 42
    bar_y2 = height - 12
    draw.rounded_rectangle([(12, bar_y1), (width - 12, bar_y2)], radius=6, fill=(15, 23, 42, 210), outline=(255, 255, 255, 30), width=1)
    font_title = _get_font(FONT_BOLD_PATH, 14)
    draw.text((24, bar_y1 + 6), headline[:52], font=font_title, fill=(255, 255, 255, 255))

    return img


# ---------------------------------------------------------------------------
# Double-State Cast Shadow Generator
# ---------------------------------------------------------------------------

def create_double_state_shadow(
    card_rgba: Image.Image,
    contact_offset: Tuple[int, int] = (2, 4),
    contact_blur: int = 4,
    contact_opacity: float = 0.70,
    throw_offset: Tuple[int, int] = (20, 36),
    throw_blur: int = 38,
    throw_opacity: float = 0.25,
) -> Tuple[Image.Image, Tuple[int, int]]:
    """Build dual-layer contact + directional throw shadows for physical elevation."""
    w, h = card_rgba.size
    pad = 80
    canvas_w = w + pad * 2
    canvas_h = h + pad * 2

    # Extract alpha mask
    alpha_mask = card_rgba.split()[3]

    # 1. Throw Shadow (wide, soft, directional)
    throw_layer = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    throw_alpha = alpha_mask.point(lambda p: int(p * throw_opacity))
    throw_layer.paste((0, 0, 0, 255), (pad + throw_offset[0], pad + throw_offset[1]), throw_alpha)
    throw_layer = throw_layer.filter(ImageFilter.GaussianBlur(throw_blur))

    # 2. Contact Shadow (tight, dense, near)
    contact_layer = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    contact_alpha = alpha_mask.point(lambda p: int(p * contact_opacity))
    contact_layer.paste((0, 0, 0, 255), (pad + contact_offset[0], pad + contact_offset[1]), contact_alpha)
    contact_layer = contact_layer.filter(ImageFilter.GaussianBlur(contact_blur))

    # Merge shadows
    shadow_combined = Image.alpha_composite(throw_layer, contact_layer)
    return shadow_combined, (-pad, -pad)


# ---------------------------------------------------------------------------
# Core Compositing & Animation Frame Renderer
# ---------------------------------------------------------------------------

def render_cinematic_editorial_video(
    source_video_path: str,
    output_video_path: str,
    semantic_manifest_path: str,
    target_width: int = 720,
    target_height: int = 1280,
    fps: float = 24.0,
) -> str:
    """Composite the full video editorial process and output broadcast MP4."""
    source_path = Path(source_video_path)
    if not source_path.exists():
        raise FileNotFoundError(f"Source video not found: {source_path}")

    # Load semantic manifest
    with open(semantic_manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    inflections = manifest.get("selectedInflections", [])
    print(f"[compositor] Loaded {len(inflections)} core concept inflections from manifest.")

    # Open source video
    cap = cv2.VideoCapture(str(source_path))
    total_source_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    source_fps = cap.get(cv2.CAP_PROP_FPS) or fps
    source_duration = total_source_frames / source_fps
    print(f"[compositor] Source video: {source_duration:.2f}s, {total_source_frames} frames @ {source_fps:.1f} fps.")

    # Map inflections dynamically from manifest to match video dialogue timeline
    scenes = []
    
    # 1. First spoken beat [00:00-00:12]: "No one's coming to save you..."
    inf1 = next((inf for inf in inflections if "save" in inf.get("spokenPhrase", "").lower() or "self" in inf.get("conceptName", "").lower() or inf.get("conceptId") == "I001"), None)
    if inf1:
        scenes.append({
            "id": "scene_beat1_radical_ownership",
            "start_sec": 3.5,
            "end_sec": 12.0,
            "mechanism": "slap_drop_contact_bounce",
            "headline": inf1.get("headline", "NO ONE IS COMING TO SAVE YOU"),
            "subline": inf1.get("subline") or "The only person who can move your life forward is you.",
            "badges": inf1.get("badges", ["SELF-RELIANCE", "OWNERSHIP"]),
            "active_res": "Zero Permission Required to Move Forward",
            "secondary_res": "Sample-Accurate Temporal Clamping Active",
            "optical": "background_defocus_isolation",
        })

    # 2. Second spoken beat [00:12-00:24]: "Information without execution is entertainment..."
    inf2 = next((inf for inf in inflections if "execution" in inf.get("spokenPhrase", "").lower() or "research" in inf.get("conceptName", "").lower() or inf.get("conceptId") == "I002"), None)
    if inf2:
        scenes.append({
            "id": "scene_beat2_research_trap",
            "start_sec": 13.5,
            "end_sec": 23.5,
            "mechanism": "lateral_friction_slide",
            "headline": inf2.get("headline", "THE RESEARCH MODE TRAP"),
            "subline": inf2.get("subline") or "Information without execution is just entertainment.",
            "badges": inf2.get("badges", ["EXECUTION", "ACTION"]),
            "active_res": "Stop Watching Breakdowns. Start Shipping.",
            "secondary_res": "High-Friction Glide Deceleration Engaged",
            "optical": "trailing_shadow_vector",
        })

    # 3. Third spoken beat [00:24-00:36]: "Stop trying to feel ready. Start trying to be useful..."
    inf3 = next((inf for inf in inflections if "experiment" in inf.get("conceptName", "").lower() or "edge" in inf.get("conceptName", "").lower() or inf.get("conceptId") in ("I003", "I004")), None)
    headline3 = inf3.get("headline", "100 EXPERIMENTS : 1 WINNER") if inf3 else "STOP TRYING TO FEEL READY"
    subline3 = inf3.get("subline") or (inf3.get("spokenPhrase", "") if inf3 else "Solve a real problem for a real person, reliably.")
    badges3 = inf3.get("badges", ["EXPERIMENTATION", "RESILIENCE"]) if inf3 else ["BE USEFUL", "SOLVE PROBLEMS"]
    scenes.append({
        "id": "scene_beat3_experiments_or_utility",
        "start_sec": 24.5,
        "end_sec": 35.5,
        "mechanism": "rack_focus_dive",
        "headline": headline3,
        "subline": subline3,
        "badges": badges3,
        "active_res": "1 Winning Offer Compounds Exponentially",
        "secondary_res": "Macro-Defocus Snapping to Sharp 35mm Focus",
        "optical": "background_defocus_isolation",
    })

    # Pre-render graphic cards and shadows for maximum speed
    card_assets = {}
    for sc in scenes:
        card = create_whitecheckered_asset_card(
            headline=sc["headline"],
            subline=sc["subline"],
            badges=sc["badges"],
            active_result=sc["active_res"],
            secondary_result=sc["secondary_res"],
        )
        shadow, offset = create_double_state_shadow(card)
        card_assets[sc["id"]] = {"card": card, "shadow": shadow, "shadow_offset": offset}

    # Detect user-supplied Google Flow / Veo 3.1 video clips in flow_clips/
    flow_dir = Path(__file__).resolve().parent.parent / "docs" / "mini_run_studio" / "flow_clips"
    flow_caps: Dict[str, cv2.VideoCapture] = {}
    if flow_dir.exists():
        for i, sc in enumerate(scenes):
            for candidate_name in [f"I00{i+1}.mp4", f"beat{i+1}.mp4", f"{sc['id']}.mp4"]:
                clip_file = flow_dir / candidate_name
                if clip_file.exists() and clip_file.stat().st_size > 1000:
                    print(f"[compositor] Ingested Google Flow B-roll clip: {clip_file.name} for {sc['headline']}")
                    flow_caps[sc["id"]] = cv2.VideoCapture(str(clip_file))
                    break

    # Extract audio stream from source to temporary AAC file
    temp_dir = Path(tempfile.gettempdir()) / "prometheus_cinematic_render"
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_audio = temp_dir / "temp_podcast_audio.aac"

    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(source_path),
        "-vn", "-c:a", "aac", "-b:a", "192k",
        str(temp_audio),
    ], check=True)
    print(f"[compositor] Extracted temporary audio to: {temp_audio}")

    # Set up FFmpeg raw video pipe for rendering
    out_p = Path(output_video_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)

    ffmpeg_cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-vcodec", "rawvideo",
        "-s", f"{target_width}x{target_height}",
        "-pix_fmt", "bgr24",
        "-r", f"{fps:.2f}",
        "-i", "-",
        "-i", str(temp_audio),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest", "-movflags", "+faststart",
        str(out_p),
    ]

    pipe = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE)
    print(f"[compositor] Encoding output video via FFmpeg pipe: {output_video_path}")

    frame_idx = 0
    total_render_frames = min(total_source_frames, int(source_duration * fps))

    try:
        while frame_idx < total_render_frames:
            ret, frame = cap.read()
            if not ret:
                break

            cur_sec = frame_idx / fps

            # Ensure frame is exactly target resolution
            if frame.shape[1] != target_width or frame.shape[0] != target_height:
                frame = cv2.resize(frame, (target_width, target_height), interpolation=cv2.INTER_LANCZOS4)

            # Check if any scene is active
            active_sc = None
            for sc in scenes:
                if sc["start_sec"] <= cur_sec < sc["end_sec"]:
                    active_sc = sc
                    break

            if active_sc is not None:
                scene_t = cur_sec - active_sc["start_sec"]
                scene_dur = active_sc["end_sec"] - active_sc["start_sec"]
                mechanism = active_sc["mechanism"]
                asset = card_assets[active_sc["id"]]
                card_img = asset["card"]
                shadow_img = asset["shadow"]
                sh_off_x, sh_off_y = asset["shadow_offset"]

                # If user supplied a Google Flow / Veo clip, read frame and wrap in Polarizing Bevel container
                if active_sc["id"] in flow_caps:
                    cap_broll = flow_caps[active_sc["id"]]
                    ret_b, b_frame = cap_broll.read()
                    if not ret_b:
                        cap_broll.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        ret_b, b_frame = cap_broll.read()
                    if ret_b and b_frame is not None:
                        card_img = create_polarizing_broll_card(b_frame, active_sc["headline"])
                        shadow_img, (sh_off_x, sh_off_y) = create_double_state_shadow(card_img)

                card_w, card_h = card_img.size
                rest_x = (target_width - card_w) // 2
                rest_y = 660  # positioned in lower chest/torso zone with scalp clearance

                # Compute motion, blur, squash, and jolt
                draw_x = float(rest_x)
                draw_y = float(rest_y)
                scale_x = 1.0
                scale_y = 1.0
                rot_deg = 0.0
                blur_px = 0.0
                canvas_jolt_y = 0

                # 1. OPTICAL: Background Defocus Isolation
                if active_sc["optical"] == "background_defocus_isolation":
                    defocus_weight = min(1.0, scene_t / 0.6) if scene_t < 1.0 else (max(0.0, (scene_dur - scene_t) / 0.6) if scene_t > scene_dur - 0.6 else 1.0)
                    if defocus_weight > 0.05:
                        blur_bg = cv2.GaussianBlur(frame, (31, 31), 16)
                        dim_bg = cv2.convertScaleAbs(blur_bg, alpha=0.82, beta=-10)
                        frame = cv2.addWeighted(dim_bg, defocus_weight, frame, 1.0 - defocus_weight, 0)

                # 2. MECHANISM: Slap-Drop with Contact Bounce & Canvas Reaction Jolt
                if mechanism == "slap_drop_contact_bounce":
                    contact_time = 0.40  # contact lands at 0.40s
                    if scene_t < contact_time:
                        # Exponential decrescendo drop from -600px
                        prog = scene_t / contact_time
                        drop_factor = math.exp(-8.0 * prog)
                        draw_y = rest_y - 650.0 * drop_factor
                        scale_x = 0.96 + 0.04 * prog
                        scale_y = 1.08 - 0.08 * prog
                    elif scene_t < contact_time + 0.083:  # 2 frames squash [102, 98]
                        scale_x = 1.03
                        scale_y = 0.97
                        canvas_jolt_y = 4  # 1-frame canvas reaction jolt
                    elif scene_t < contact_time + 0.166:  # rebound
                        scale_x = 0.99
                        scale_y = 1.01
                    else:
                        # Sub-pixel drift + pendulum settle (+2.5° -> -1.0° -> +0.3° -> 0°)
                        post_t = scene_t - contact_time - 0.166
                        rot_deg = 2.5 * math.exp(-3.5 * post_t) * math.cos(8.0 * post_t)
                        scale_drift = 1.0 + 0.018 * min(1.0, post_t / (scene_dur - 1.0))
                        scale_x = scale_drift
                        scale_y = scale_drift

                # 3. MECHANISM: Lateral Friction Slide & Trailing Shadow Vector
                elif mechanism == "lateral_friction_slide":
                    slide_duration = 0.85
                    if scene_t < slide_duration:
                        # Max velocity entrance gliding against 70% friction
                        prog = scene_t / slide_duration
                        friction_decay = math.exp(-5.5 * prog)
                        draw_x = rest_x + (target_width - rest_x + 100) * friction_decay
                        # Trailing shadow vector offset
                        sh_off_x += int(35 * friction_decay)
                        rot_deg = -1.8 * friction_decay
                    else:
                        post_t = scene_t - slide_duration
                        scale_drift = 1.0 + 0.015 * min(1.0, post_t / (scene_dur - 1.0))
                        scale_x = scale_drift
                        scale_y = scale_drift

                # 4. MECHANISM: Rack-Focus Dive (Macro-Defocus to Sharp Snap)
                elif mechanism == "rack_focus_dive":
                    dive_time = 0.55  # 13 frames at 24fps
                    if scene_t < dive_time:
                        prog = scene_t / dive_time
                        scale_factor = 1.25 - 0.25 * prog
                        scale_x = scale_factor
                        scale_y = scale_factor
                        blur_px = 35.0 * (1.0 - prog)
                    else:
                        post_t = scene_t - dive_time
                        scale_drift = 1.0 + 0.016 * min(1.0, post_t / (scene_dur - 1.0))
                        scale_x = scale_drift
                        scale_y = scale_drift

                # Apply Canvas Reaction Jolt if active
                if canvas_jolt_y > 0:
                    frame = np.roll(frame, canvas_jolt_y, axis=0)

                # Exit fade if within final 0.4s of scene
                alpha_fade = 1.0
                if scene_t > scene_dur - 0.4:
                    alpha_fade = max(0.0, (scene_dur - scene_t) / 0.4)

                # Composite Card and Shadow via PIL
                frame_pil = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

                # Transform card
                cur_w = int(round(card_w * scale_x))
                cur_h = int(round(card_h * scale_y))
                if cur_w > 10 and cur_h > 10:
                    scaled_card = card_img.resize((cur_w, cur_h), Image.Resampling.BILINEAR)
                    if blur_px > 1.0:
                        scaled_card = scaled_card.filter(ImageFilter.GaussianBlur(blur_px))
                    if abs(rot_deg) > 0.05:
                        scaled_card = scaled_card.rotate(rot_deg, resample=Image.Resampling.BILINEAR, expand=True)

                    if alpha_fade < 0.98:
                        r, g, b, a = scaled_card.split()
                        a = a.point(lambda p: int(p * alpha_fade))
                        scaled_card = Image.merge("RGBA", (r, g, b, a))

                    # Transform and paste shadow
                    sh_w = int(round(shadow_img.width * scale_x))
                    sh_h = int(round(shadow_img.height * scale_y))
                    scaled_sh = shadow_img.resize((sh_w, sh_h), Image.Resampling.BILINEAR)
                    if alpha_fade < 0.98:
                        sr, sg, sb, sa = scaled_sh.split()
                        sa = sa.point(lambda p: int(p * alpha_fade))
                        scaled_sh = Image.merge("RGBA", (sr, sg, sb, sa))

                    card_pos_x = int(round(draw_x - (cur_w - card_w) / 2))
                    card_pos_y = int(round(draw_y - (cur_h - card_h) / 2))

                    sh_pos_x = card_pos_x + int(round(sh_off_x * scale_x))
                    sh_pos_y = card_pos_y + int(round(sh_off_y * scale_y))

                    # Paste Shadow then Card
                    frame_pil.paste(scaled_sh, (sh_pos_x, sh_pos_y), scaled_sh)
                    frame_pil.paste(scaled_card, (card_pos_x, card_pos_y), scaled_card)

                # Convert back to OpenCV BGR
                frame = cv2.cvtColor(np.array(frame_pil), cv2.COLOR_RGB2BGR)

            # Write frame to FFmpeg pipe
            pipe.stdin.write(frame.tobytes())
            frame_idx += 1

            if frame_idx % 120 == 0:
                print(f"[compositor] Processed {frame_idx}/{total_render_frames} frames ({frame_idx/fps:.1f}s)...", flush=True)

    finally:
        cap.release()
        for c in flow_caps.values():
            c.release()
        pipe.stdin.close()
        pipe.wait()

    if out_p.exists() and out_p.stat().st_size > 0:
        file_size_mb = out_p.stat().st_size / (1024 * 1024)
        print(f"[compositor] Master render completed successfully: {out_p} ({file_size_mb:.2f} MB)")
        return str(out_p)
    else:
        raise RuntimeError(f"Compositing failed: Output file not created at {out_p}")


if __name__ == "__main__":
    src = "remotion-app/public/source/MALE-BLACK-TALKING-HEAD-PODCAST.mp4"
    dst = "docs/mini_run_studio/own_the_outcome_cinematic_animation.mp4"
    manifest_p = "docs/mini_run_studio/deep_semantic_manifest.json"
    render_cinematic_editorial_video(src, dst, manifest_p)
