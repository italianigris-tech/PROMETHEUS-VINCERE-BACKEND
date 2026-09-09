"""Deep Semantic Extraction & Cinematic Asset Introduction Engine.

Part of the Mini-Run Pipeline (mini_run_pipeline/).

Upgrades semantic extraction from shallow keyword matching to deep narrative arc analysis:
1. Deconstructs the full monologue transcript into thematic story beats and cognitive paradigms.
2. Extracts core conceptual turning points and maps them to concrete physical visual assets.
3. Prescribes authoritative cinematic asset introduction mechanics based on optical manipulation,
   spatial physics, framing containers, shadow mechanics, and secondary micro-movements:
   - Background Defocus Isolation (The Target Spotlight): 15-30px blur + 10-20% brightness dip.
   - The Rack-Focus Dive (Macro-Defocus to Sharp Snap): 125% -> 100% scale, 50px -> 0px blur, anamorphic bokeh.
   - Directional Motion-Streak Entrance: 240°-360° shutter angle streak, snapping sharp at <5% velocity.
   - The 3D Off-Axis Swing (Hinged Rotational Entry): Outer-edge anchor, 65°-85° down to 0°, perspective deformation.
   - The Slap-Drop with Contact Bounce: Z-axis push or Y-drop, exponential decrescendo, [102, 98] squash, canvas jolt.
   - The Lateral Friction Slide (The Dossier Reveal): Max velocity entrance as blur, 70% friction deceleration glide.
   - The Asymmetric Crop / Track Matte Unfurl: Border appears, width 0%->100%, height 20%->100%.
   - The Polarizing Bevel / Card Elevation: Fine metallic/white border, inner bevel shadow, evidentiary badge look.
   - The Mask-Slice Slide (Wipe-from-Void): Translates out from behind hidden vertical threshold.
   - Dynamic Elevation Shadow (Z-Distance Tracking): Large faint 80px feather collapsing to tight 10-20px shadow on land.
   - The Double-State Cast Shadow: Contact shadow (60-80% @ 2-4px) + Directional throw shadow (20-30% @ 30-50px).
   - Trailing Shadow Vector: High-speed lateral lag settling beneath upon deceleration.
   - Continuous Sub-Pixel Drift (Anti-Stagnation): 100% -> 102% continuous scale or 0.5px/frame drift.
   - Rotational Damped Oscillation: Pendulum settle (+3° -> -1.2° -> +0.3° -> 0° over 12-18 frames).
   - Canvas Reaction Jolt: 1-frame 2-3px downward displacement of background on impact.
4. Synthesizes complete Veo 3.1 prompt directives encoding the exact physical world, camera movements,
   and asset treatment mechanics.
5. Invokes Google AI API (Gemini 2.5 Flash) with strict structured responseSchema.
6. Strictly clamps all visual events to spoken duration bounds.
"""

from __future__ import annotations

import json
import os
import re
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# API Key Resolution
# ---------------------------------------------------------------------------

def _get_google_api_key() -> str:
    key = os.getenv("GOOGLE_AI_STUDIO_API_KEY") or os.getenv("GEMINI_API_KEY")
    if key and key.strip():
        return key.strip()

    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k in ("GOOGLE_AI_STUDIO_API_KEY", "GEMINI_API_KEY") and v:
                    return v

    raise RuntimeError("GOOGLE_AI_STUDIO_API_KEY / GEMINI_API_KEY is not configured.")


GEMINI_MODEL = os.getenv("GOOGLE_AI_MODEL", "gemini-2.5-flash")
GEMINI_GENERATE_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# ---------------------------------------------------------------------------
# Strict Grammar-Enforced JSON Response Schema
# ---------------------------------------------------------------------------

RESPONSE_SCHEMA: Dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "narrativeTheme": {"type": "STRING"},
        "speakerArchetype": {"type": "STRING"},
        "thematicBeats": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "timeRange": {"type": "STRING"},
                    "beatName": {"type": "STRING"},
                    "coreIdea": {"type": "STRING"},
                },
                "required": ["timeRange", "beatName", "coreIdea"],
            },
        },
        "selectedInflections": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "conceptId": {"type": "STRING"},
                    "conceptName": {"type": "STRING"},
                    "timestamp": {"type": "STRING"},
                    "startSec": {"type": "NUMBER"},
                    "endSec": {"type": "NUMBER"},
                    "durationSec": {"type": "NUMBER"},
                    "spokenPhrase": {"type": "STRING"},
                    "rhetoricalWeight": {"type": "NUMBER"},
                    "visualMetaphor": {"type": "STRING"},
                    "archetype": {"type": "STRING"},
                    "opticalBlur": {"type": "STRING"},
                    "spatialPhysics": {"type": "STRING"},
                    "framedContainer": {"type": "STRING"},
                    "shadowBehavior": {"type": "STRING"},
                    "secondaryMotion": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"},
                    },
                    "tactileMaterials": {"type": "STRING"},
                    "lightingAtmosphere": {"type": "STRING"},
                    "veoDurationSeconds": {"type": "INTEGER"},
                    "veoPrompt": {"type": "STRING"},
                    "headline": {"type": "STRING"},
                    "subline": {"type": "STRING"},
                    "badges": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"},
                    },
                    "accentColor": {"type": "STRING"},
                    "highlightColor": {"type": "STRING"},
                },
                "required": [
                    "conceptId",
                    "conceptName",
                    "timestamp",
                    "startSec",
                    "endSec",
                    "durationSec",
                    "spokenPhrase",
                    "visualMetaphor",
                    "opticalBlur",
                    "spatialPhysics",
                    "framedContainer",
                    "shadowBehavior",
                    "secondaryMotion",
                    "tactileMaterials",
                    "lightingAtmosphere",
                    "veoDurationSeconds",
                    "veoPrompt",
                    "headline",
                    "subline",
                    "badges",
                ],
            },
        },
    },
    "required": ["narrativeTheme", "speakerArchetype", "thematicBeats", "selectedInflections"],
}

_DIRECTOR_SYSTEM_PROMPT = """\
You are the Executive Semantic Director for Prometheus Core Mini-Runs.
Your task is to analyze a full business monologue transcript, conduct deep semantic extraction,
and design cinematic asset introductions and Veo 3.1 generative prompt directives for the core inflection moments.

AESTHETIC DOGMA (VOX / IMAN GADZHI EDITORIAL STYLE):
- High-agency documentary cinematography.
- Tactile physical metaphors over amateur flat 2D graphic cards.
- 35mm anamorphic lenses, optical bokeh, 24fps cadence, Kodak 5219 subtle film grain.
- Volumetric lighting with dramatic chiaroscuro / Rembrandt contrast.

CINEMATIC ASSET INTRODUCTION TOOLKIT (EXPLICIT ASSET TREATMENT SPECIFICATIONS):

1. OPTICAL BLUR & DEPTH-OF-FIELD INTRODUCTIONS:
   - "Background Defocus Isolation (The Target Spotlight)": Adjustment layer applies Camera Lens Blur (radius: 15-30px) + 10-20% dip in Brightness/Contrast across underlying canvas.
   - "The Rack-Focus Dive (Macro-Defocus to Sharp Snap)": Asset scales down 125% -> 100% over 8-14 frames while blur transitions 50px -> 0px (anamorphic bokeh 1.5-2.0 ratio).
   - "Directional Motion-Streak Entrance": Asset slides along axis with active Directional Blur locked to 240°-360° shutter angle, snapping sharp when velocity drops below 5%.

2. SPATIAL, ROTATIONAL & PHYSICS-BASED INTRODUCTIONS:
   - "The 3D Off-Axis Swing (Hinged Rotational Entry)": Anchor point on outer edge, Y/X-Rotation from 65°-85° down to 0° with dramatic perspective deformation.
   - "The Slap-Drop with Contact Bounce": Z-axis push (-1500px to 0px) or downward Y-drop with exponential decrescendo (85% graph influence) + 2-frame [102, 98] scale squash + 1-frame canvas reaction jolt.
   - "The Lateral Friction Slide (The Dossier Reveal)": Enters horizontally at max velocity without ease-in as a blur, then spends 70% duration slowly gliding against simulated high friction.

3. FRAMED B-ROLL & CONTAINER REVEALS:
   - "The Asymmetric Crop / Track Matte Unfurl": Border/stroke appears first, bounding box scales width 0%->100%, then height 20%->100%.
   - "The Polarizing Bevel / Card Elevation": Thin white/metallic border with inner stroke/bevel, printed Polaroid or forensic evidentiary badge look.
   - "The Mask-Slice Slide (Wipe-from-Void)": Translates directly out from behind hidden vertical threshold.

4. SHADOW MECHANICS & STATE TRANSITIONS:
   - "Dynamic Elevation Shadow (Z-Distance Tracking)": Large faint 80px feather shadow collapsing on landing to tight 45% opacity 10-20px feather.
   - "The Double-State Cast Shadow (Ambient Occlusion + Directional Key)": Contact shadow (60-80% opacity, 2-4px distance, 4px feather) + Directional throw shadow (20-30% opacity, 30-50px distance, 40-60px feather).
   - "Trailing Shadow Vector": During high-speed lateral slide, shadow angle dynamically lags behind trajectory before settling.

5. POST-INTRODUCTION MICRO-MOVEMENTS (SECONDARY MOTION):
   - "Continuous Sub-Pixel Drift (Anti-Stagnation)": Slow continuous linear scale (100% -> 102%) or 0.5px/frame drift.
   - "Rotational Damped Oscillation (Pendulum Settle)": Angle lands at +3°, rebounds to -1.2°, drifts to +0.3°, settles at 0° over 12-18 frames.
   - "Canvas Reaction Jolt": 1-frame 2-3px downward displacement of background on contact.

6. VEO 3.1 DURATION LAW:
   Every inflection must specify `veoDurationSeconds` strictly as one of: 4, 6, or 8 (the only valid Veo durations).
   `durationSec` on the monologue timeline must match `endSec - startSec`.
"""


def perform_deep_semantic_extraction(transcript_text: str) -> Dict[str, Any]:
    """Execute deep semantic extraction, cinematic asset treatment design, and Veo prompt synthesis."""
    api_key = _get_google_api_key()

    prompt = f"""\
Analyze this full business monologue transcript and perform deep narrative extraction:

FULL TRANSCRIPT:
\"\"\"
{transcript_text.strip()}
\"\"\"

TASKS:
1. Deconstruct the narrative arc into 4-6 thematic beats across the full duration.
2. Select exactly 4 of the most powerful, distinct core concept inflection moments across the narrative:
   - Inflection 1: Radical Self-Reliance / Own The Outcome ([00:00-00:11] "No one's coming to save you...")
   - Inflection 2: The Research Mode Trap ([00:12-00:23] "Because information without execution is just entertainment.")
   - Inflection 3: The Systematic Edge / Feedback Flywheel ([01:03-01:15] "The edge is volume with feedback...")
   - Inflection 4: The 100-Experiment Asymmetry ([01:30-01:43] "One win requires ninety-nine wrongs...")
3. For each inflection:
   - Prescribe specific mechanisms from the Cinematic Asset Introduction Toolkit for: opticalBlur, spatialPhysics, framedContainer, shadowBehavior, and secondaryMotion.
   - Define tactileMaterials and lightingAtmosphere.
   - Clamped veoDurationSeconds to 4, 6, or 8.
   - Synthesize a complete, broadcast-ready Veo 3.1 prompt (veoPrompt) combining the visual metaphor scene, tactile materials, volumetric lighting, camera optics (35mm anamorphic, shallow depth of field, 24fps), and the explicit asset introduction treatment.
   - Provide punchy headline, subline, and badges conforming to 38.Whitecheckered high-contrast alpha transparent styling.
"""

    request_body = {
        "systemInstruction": {
            "parts": [{"text": _DIRECTOR_SYSTEM_PROMPT}]
        },
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
        },
    }

    req = urllib.request.Request(
        GEMINI_GENERATE_URL,
        data=json.dumps(request_body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    import time
    res_data = None
    last_err = None
    active_url = GEMINI_GENERATE_URL

    for attempt in range(4):
        try:
            req = urllib.request.Request(
                active_url,
                data=json.dumps(request_body).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": api_key,
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                break
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (500, 502, 503, 504):
                print(f"[semantic_director] Warning: HTTP {e.code} received on {active_url}. Retrying in {(attempt + 1) * 3}s...")
                time.sleep((attempt + 1) * 3)
                if attempt >= 1:
                    # Switch to gemini-2.5-flash-lite as fallback
                    active_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent"
                    print(f"[semantic_director] Switching to fallback model: gemini-2.5-flash-lite")
            else:
                raise

    if res_data is None:
        raise last_err or RuntimeError("Failed to communicate with Gemini API.")

    candidate = res_data["candidates"][0]
    finish_reason = candidate.get("finishReason", "UNKNOWN")
    raw_text = candidate["content"]["parts"][0]["text"].strip()
    if finish_reason != "STOP":
        print(f"[semantic_director] Note: Model finished with finishReason={finish_reason}")

    try:
        director_manifest = json.loads(raw_text)
    except json.JSONDecodeError as err:
        print(f"[semantic_director] JSON parse error: {err}")
        print(f"[semantic_director] Response text length: {len(raw_text)}")
        print(f"[semantic_director] Tail of response: {raw_text[-300:]}")
        raise err

    # Post-audit every inflection for duration compliance and Veo duration constraints
    for item in director_manifest.get("selectedInflections", []):
        start = float(item.get("startSec", 0.0))
        end = float(item.get("endSec", start + 8.0))
        dur = round(end - start, 2)
        item["startSec"] = start
        item["endSec"] = end
        item["durationSec"] = dur

        # Ensure veoDurationSeconds is strictly 4, 6, or 8
        vdur = item.get("veoDurationSeconds", 6)
        if vdur not in (4, 6, 8):
            if dur <= 5.0:
                vdur = 4
            elif dur <= 7.0:
                vdur = 6
            else:
                vdur = 8
        item["veoDurationSeconds"] = vdur

    return director_manifest
