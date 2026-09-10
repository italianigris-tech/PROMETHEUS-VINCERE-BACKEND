"""Listicle Intelligence & Visual Language Engine for Prometheus Mini-Run Pipeline.

Detects enumerated segments, numerical mentions, rankings, and itemized lists in transcripts:
1. Teaser Retention Cards ("List & Blur"): Multi-item preview where unrevealed items are teasingly blurred.
2. Step-by-Step Focus Streams ("Sequential Active Step"): Unified episodic presentation with giant stylized numerals.
3. Special Number Treatments:
   - vertical_gradient_fade_oblivion: Massive numeral fading into soft bottom blur.
   - outline_cutout_glow: Hollow transparent numeral with glowing stroke.
   - glitch_flicker_counter: Kinetic twitching digital step counter.
   - bokeh_defocus_snap: Deep optical bokeh snap.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Number Word to Digit Mapping
# ---------------------------------------------------------------------------

WORD_TO_DIGIT: Dict[str, int] = {
    "one": 1, "first": 1, "1st": 1, "1": 1,
    "two": 2, "second": 2, "2nd": 2, "2": 2,
    "three": 3, "third": 3, "3rd": 3, "3": 3,
    "four": 4, "fourth": 4, "4th": 4, "4": 4,
    "five": 5, "fifth": 5, "5th": 5, "5": 5,
    "six": 6, "sixth": 6, "6th": 6, "6": 6,
    "seven": 7, "seventh": 7, "7th": 7, "7": 7,
    "eight": 8, "eighth": 8, "8th": 8, "8": 8,
    "nine": 9, "ninth": 9, "9th": 9, "9": 9,
    "ten": 10, "tenth": 10, "10th": 10, "10": 10,
}

TEASER_PATTERNS = [
    re.compile(
        r"\b(?:there are|here are|i have|top|these|the)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+"
        r"(?:things|rules|secrets|ways|steps|reasons|mistakes|tips|lessons|habits|tools|keys|principles|points)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+"
        r"(?:things|rules|secrets|ways|steps|reasons|mistakes|tips|lessons|habits|tools|keys|principles|points)\s+"
        r"(?:you|to|that|every|i|we)\b",
        re.IGNORECASE,
    ),
]

STEP_ITEM_PATTERNS = [
    re.compile(
        r"^(?:number\s+)?(\d+|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|1st|2nd|3rd|4th|5th|step\s+\d+|rule\s+\d+|tip\s+\d+)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:number|step|rule|tip|point|lesson)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b",
        re.IGNORECASE,
    ),
]

NUMERAL_FONTS = ["Anton", "Montserrat ExtraBold", "Bebas Neue", "Playfair Display", "Helvetica Neue"]


# ---------------------------------------------------------------------------
# Listicle Treatment Presets
# ---------------------------------------------------------------------------

LISTICLE_TREATMENTS: Dict[str, Dict[str, Any]] = {
    "gradient_fade_oblivion": {
        "id": "gradient_fade_oblivion",
        "name": "Vertical Gradient Fade into Oblivion",
        "description": "Massive display numeral fading vertically with progressive bottom blur into oblivion.",
        "fontFamily": "Anton",
        "fontSizePx": 310,
        "stroke": False,
        "maskBottomFade": True,
        "blurOblivion": True,
    },
    "outline_cutout_glow": {
        "id": "outline_cutout_glow",
        "name": "Outline Cutout Glow",
        "description": "Hollow transparent core numeral with radiant glowing stroke border.",
        "fontFamily": "Montserrat ExtraBold",
        "fontSizePx": 290,
        "stroke": True,
        "strokeWidthPx": 4,
        "maskBottomFade": False,
        "blurOblivion": False,
    },
    "cinematic_slide_blur": {
        "id": "cinematic_slide_blur",
        "name": "Cinematic Slide Defocus",
        "description": "Smooth vertical slide-up with optical bokeh snap into focus.",
        "fontFamily": "Playfair Display",
        "fontSizePx": 300,
        "stroke": False,
        "maskBottomFade": False,
        "blurOblivion": False,
    },
    "glitch_flicker_counter": {
        "id": "glitch_flicker_counter",
        "name": "Glitch Flicker Counter",
        "description": "Kinetic digital twitch and chromatic flicker on step entry.",
        "fontFamily": "Bebas Neue",
        "fontSizePx": 320,
        "stroke": False,
        "maskBottomFade": False,
        "blurOblivion": False,
    },
}


# ---------------------------------------------------------------------------
# Detection & Planning
# ---------------------------------------------------------------------------

def detect_and_plan_listicles(
    chunks: List[Dict[str, Any]],
    design: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Scan transcript chunks for listicle announcements and sequential numbered steps."""
    design_dict = design if isinstance(design, dict) else {}
    preferred_treatment_id = design_dict.get("listicleTreatment") or "gradient_fade_oblivion"
    treatment = LISTICLE_TREATMENTS.get(preferred_treatment_id, LISTICLE_TREATMENTS["gradient_fade_oblivion"])

    listicle_plans: Dict[int, Dict[str, Any]] = {}
    active_sequence: Optional[Dict[str, Any]] = None
    listicles_detected: List[Dict[str, Any]] = []

    # 1. First Pass: Detect Teasers & Announcements
    for idx, chunk in enumerate(chunks):
        raw_text = str(chunk.get("text", "")).strip()
        words = chunk.get("words", [])

        # Check for teaser announcement (e.g. "There are 5 things you need")
        teaser_count = None
        for pattern in TEASER_PATTERNS:
            match = pattern.search(raw_text)
            if match:
                num_str = match.group(1).lower()
                teaser_count = int(num_str) if num_str.isdigit() else WORD_TO_DIGIT.get(num_str, 5)
                break

        if teaser_count and teaser_count >= 2:
            # Found teaser listicle announcement!
            # Generate teaser items for "List & Blur" retention feature
            teaser_items = []
            for item_num in range(1, min(teaser_count + 1, 8)):
                teaser_items.append({
                    "itemNumber": item_num,
                    "indexFormatted": f"{item_num:02d}",
                    "label": f"Secret #{item_num}" if item_num > 1 else raw_text[:28],
                    "blurred": item_num > 1,  # Items 2..N are teased with progressive blur
                })

            listicle_plans[idx] = {
                "isListicle": True,
                "mode": "teaser_blur",
                "itemNumber": 1,
                "itemNumberFormatted": "01",
                "totalCount": teaser_count,
                "treatment": "list_and_blur_teaser",
                "numberStyle": treatment,
                "teaserItems": teaser_items,
                "badgeText": f"TOP {teaser_count} SECRETS",
            }
            active_sequence = {
                "sequenceId": f"listicle_{len(listicles_detected) + 1}",
                "totalCount": teaser_count,
                "currentStep": 0,
                "teaserIndex": idx,
            }
            listicles_detected.append(active_sequence)
            continue

        # Check for sequential step item mentions (e.g. "Number 1", "First", "Step 2", "3")
        step_number = None
        # Explicit enumerator words that genuinely announce a list item. Bare
        # ordinals ("first", "2nd", "3") inside idiomatic phrases — "the first
        # time I…" — are NOT enumeration and must never mint a phantom badge.
        EXPLICIT_ENUMERATORS = ("number", "step", "rule", "tip", "point", "lesson", "secret", "reason")
        DIGIT_TOKENS = {str(n) for n in range(1, 13)}
        TEMPORAL_METRIC_UNITS = {
            "month", "months", "year", "years", "day", "days", "week", "weeks",
            "hour", "hours", "minute", "minutes", "second", "seconds",
            "percent", "percentage", "dollar", "dollars", "cent", "cents",
            "mile", "miles", "km", "kilometer", "kilometers", "meter", "meters",
            "lb", "lbs", "pound", "pounds", "kg", "kilogram", "kilograms",
            "am", "pm", "k", "m", "b", "x", "times",
        }
        text_lower = raw_text.lower()
        has_explicit_enumerator = any(w in text_lower for w in EXPLICIT_ENUMERATORS)
        first_word_clean = re.sub(r"[^\w]", "", words[0].get("word", "")).lower() if words else ""
        second_word_clean = (
            re.sub(r"[^\w]", "", words[1].get("word", "")).lower()
            if len(words) > 1 else ""
        )
        for pattern in STEP_ITEM_PATTERNS:
            match = pattern.search(raw_text)
            if match:
                matched_str = match.group(1).lower().replace("step", "").replace("rule", "").replace("tip", "").strip()
                candidate = int(matched_str) if matched_str.isdigit() else WORD_TO_DIGIT.get(matched_str)
                if candidate is None:
                    continue
                is_bare_ordinal = (
                    matched_str in WORD_TO_DIGIT
                    and matched_str not in DIGIT_TOKENS
                    and not has_explicit_enumerator
                    and active_sequence is None
                )
                if is_bare_ordinal:
                    continue
                # Suppress bare leading numbers when followed by temporal/metric units (e.g. "12 months")
                if (
                    matched_str.isdigit()
                    and not has_explicit_enumerator
                    and active_sequence is None
                    and matched_str == first_word_clean
                    and second_word_clean in TEMPORAL_METRIC_UNITS
                ):
                    continue
                step_number = candidate
                break

        # Standalone leading digit in words — also requires enumeration context
        # (explicit enumerator or an active teaser sequence) for word-form
        # ordinals; bare digits ("3 ...") still count as chunk openers.
        # Suppress leading digits from triggering step_item when followed by
        # temporal/metric units (e.g., "12 months", "3 days").
        if step_number is None and words:
            if first_word_clean.isdigit() and 1 <= int(first_word_clean) <= 12:
                if second_word_clean not in TEMPORAL_METRIC_UNITS:
                    step_number = int(first_word_clean)
            elif first_word_clean in WORD_TO_DIGIT and (has_explicit_enumerator or active_sequence is not None):
                if second_word_clean not in TEMPORAL_METRIC_UNITS:
                    step_number = WORD_TO_DIGIT[first_word_clean]

        if step_number is not None and 1 <= step_number <= 12:
            total_count = active_sequence["totalCount"] if active_sequence else max(step_number, 5)
            listicle_plans[idx] = {
                "isListicle": True,
                "mode": "step_item",
                "itemNumber": step_number,
                "itemNumberFormatted": f"{step_number:02d}",
                "totalCount": total_count,
                "treatment": treatment["id"],
                "numberStyle": treatment,
                "badgeText": f"STEP {step_number:02d}",
            }
            if active_sequence:
                active_sequence["currentStep"] = step_number

    return {
        "listicleCount": len(listicles_detected),
        "plans": listicle_plans,
        "treatments": LISTICLE_TREATMENTS,
    }
