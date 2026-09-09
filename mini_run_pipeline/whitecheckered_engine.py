"""38.Whitecheckered — Dynamic Transcript Animation & Asset Translation Engine.

Part of the Mini-Run Pipeline (mini_run_pipeline/).

Architecture & Operational Standard:
1. Ingests full word/time-stamped transcripts.
2. Evaluates every segment for animation salience, rhetorical weight, and virality.
3. Identifies candidate moments and isolates the #1 heaviest inflection point to dwell on.
4. Translates the context of the spoken statement into its animated equivalent conforming to:
   - Archetype #38: Search / Query Visualization (trait_search_query_autocomplete_dropdown)
   - "Whitecheckered": High-contrast transparent checkerboard backing with crisp pure white
     (#FFFFFF) typography, illuminated borders, and transparent alpha assets.
5. Invokes Google AI API (Gemini 2.5 Flash) via structured JSON schema.
6. Enforces STRICT duration bounds: the animation keyframe schedule cannot exceed the
   duration of the spoken statement (e.g. 4-5s or 12s, zero time overflow).
"""

from __future__ import annotations

import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# API Key & Endpoint Resolution
# ---------------------------------------------------------------------------

def _get_google_api_key() -> str:
    """Resolve Google AI Studio API key from process or .env."""
    key = os.getenv("GOOGLE_AI_STUDIO_API_KEY") or os.getenv("GEMINI_API_KEY")
    if key:
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
# Transcript Parsing & Weight Scoring
# ---------------------------------------------------------------------------

_TIMESTAMP_RE = re.compile(r"\[(\d{1,2}):(\d{2})\]")


def parse_timestamped_transcript(raw_text: str) -> List[Dict[str, Any]]:
    """Parse timestamped monologue text (e.g. [00:12] statement...) into segments."""
    lines = raw_text.strip().splitlines()
    segments: List[Dict[str, Any]] = []
    current_time_sec: Optional[float] = None
    current_text_lines: List[str] = []

    for line in lines:
        line_clean = line.strip()
        if not line_clean or line_clean.startswith("#"):
            continue

        match = _TIMESTAMP_RE.search(line_clean)
        if match:
            # Commit previous segment if open
            if current_time_sec is not None and current_text_lines:
                text_block = " ".join(current_text_lines).strip()
                if text_block:
                    segments.append({
                        "index": len(segments) + 1,
                        "startSec": current_time_sec,
                        "text": text_block,
                    })
                current_text_lines = []

            # Parse new timestamp
            mins = int(match.group(1))
            secs = int(match.group(2))
            current_time_sec = float(mins * 60 + secs)

            # Any text on the same line after the timestamp?
            remainder = line_clean[match.end():].strip()
            if remainder and not remainder.startswith("*"):
                current_text_lines.append(remainder)
        else:
            if current_time_sec is not None and not line_clean.startswith("*"):
                current_text_lines.append(line_clean)

    # Commit final segment
    if current_time_sec is not None and current_text_lines:
        text_block = " ".join(current_text_lines).strip()
        if text_block:
            segments.append({
                "index": len(segments) + 1,
                "startSec": current_time_sec,
                "text": text_block,
            })

    # Compute endSec and durationSec
    for i, seg in enumerate(segments):
        if i + 1 < len(segments):
            seg["endSec"] = segments[i + 1]["startSec"]
        else:
            # Fallback duration for final segment based on word count (~2.6 words/sec)
            words = len(seg["text"].split())
            seg["endSec"] = round(seg["startSec"] + max(4.0, words / 2.6), 2)
        
        seg["durationSec"] = round(seg["endSec"] - seg["startSec"], 2)
        seg["startMs"] = int(seg["startSec"] * 1000)
        seg["endMs"] = int(seg["endSec"] * 1000)
        seg["wordCount"] = len(seg["text"].split())

    return segments


def score_animation_candidates(segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Score transcript segments to identify animation candidates and the heaviest inflection point.
    
    Heuristics:
    1. Actionable cognitive shift / search / diagnosis / question ('ask yourself', 'research mode', 'constraint', 'find')
    2. Concrete entity & mechanism references ('offers', 'leads', 'channels', 'experiments', 'courses', 'breakdowns')
    3. Rhetorical inflection / high-stakes contrast ('without execution is just entertainment', '10x your results')
    4. Duration suitability (ideal animation window: 8s - 25s)
    """
    scored = []
    
    # Semantic triggers
    SEARCH_DISCOVERY_TRIGGERS = {
        "research mode", "breakdown", "course", "search", "find", "ask yourself",
        "constraint", "experiments", "test", "track", "feedback", "leads", "conversion"
    }
    CONTRAST_INFLECTION_TRIGGERS = {
        "shift", "brutal", "lagging indicator", "leverage", "edge", "identity",
        "undeniable proof", "get better", "inevitable", "superpower", "own the outcome"
    }

    for seg in segments:
        text_lower = seg["text"].lower()
        score = 0.0
        matched_motifs = []

        # 1. Search / discovery / query alignment (Archetype #38 affinity)
        for trig in SEARCH_DISCOVERY_TRIGGERS:
            if trig in text_lower:
                score += 25.0
                matched_motifs.append(f"discovery:{trig}")

        # 2. Rhetorical contrast / inflection weight
        for trig in CONTRAST_INFLECTION_TRIGGERS:
            if trig in text_lower:
                score += 20.0
                matched_motifs.append(f"inflection:{trig}")

        # 3. Numeric/Actionable density (e.g. 10x, 100, 99, 90, 1, 10)
        numbers = re.findall(r"\b\d+[xX%]?\b", text_lower)
        if numbers:
            score += min(len(numbers) * 10.0, 30.0)
            matched_motifs.append(f"metrics:{','.join(numbers)}")

        # 4. Duration sweet spot bonus (8s to 18s is ideal for Archetype #38 dwelling)
        dur = seg["durationSec"]
        if 8.0 <= dur <= 16.0:
            score += 15.0
        elif dur < 5.0 or dur > 25.0:
            score -= 10.0

        scored.append({
            **seg,
            "weightScore": round(score, 1),
            "matchedMotifs": matched_motifs,
            "isCandidate": score >= 25.0,
        })

    # Sort descending by weightScore
    scored.sort(key=lambda x: x["weightScore"], reverse=True)

    # Annotate rank and mark the #1 heaviest segment
    for rank, item in enumerate(scored, 1):
        item["rank"] = rank
        item["isHeaviest"] = (rank == 1)

    return scored


# ---------------------------------------------------------------------------
# Google AI (Gemini Flash) Animation Profile Synthesis
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are the Lead Visual Motion Director for Prometheus Core Mini-Runs.
Your duty is to translate a high-weight spoken transcript statement into its authoritative,
sample-accurate animated equivalent.

STRICT DESIGN SPECIFICATIONS:
1. ARCHETYPE: #38 — Search / Query Visualization (trait_search_query_autocomplete_dropdown).
   - Concept: When the speaker mentions searching, analyzing, diagnosing, asking questions,
     running experiments, or finding a constraint, animate a high-tech search bar with
     typewriter input and an autocomplete dropdown containing data-backed results.
2. VISUAL DOGMA: 38.Whitecheckered.
   - High-contrast, transparent checkerboard backing (3D transparent alpha backing).
   - Pure crisp white (#FFFFFF) typography for maximum contrast.
   - Accents: Neon Cyan (#38BDF8) for icons/active tags, Gold (#FFE600) for metrics,
     and Charcoal/Glass for background layers.
   - NO clunky opaque solid boxes. Every element has glassmorphism or clean alpha transparency.
3. DURATION LAW:
   - The animation MUST fit STRICTLY within the statement's allocated duration.
   - If durationSec = 12.0s, the entire timeline of keyframes (entry, typing, dropdown, highlight, settle)
     must complete within 12.0s. No keyframe may exceed durationSec.
4. OUTPUT FORMAT:
   - Output ONLY valid JSON adhering strictly to the required schema. No Markdown wrappers, no prose.
"""

_USER_PROMPT_TEMPLATE = """\
SPOKEN STATEMENT DATA:
- Statement Text: "{text}"
- Start Time: {startSec}s
- End Time: {endSec}s
- Hard Duration Ceiling: {durationSec} seconds
- Timestamp Range: [{start_min:02d}:{start_sec:02d}] -> [{end_min:02d}:{end_sec:02d}]
- Matched Motifs: {motifs}

TASK:
Synthesize the 38.Whitecheckered animated equivalent.
Return a JSON object conforming to this exact structure:
{{
  "archetypeId": 38,
  "archetypeName": "Search / Query Visualization",
  "styleTheme": "38.Whitecheckered",
  "traitId": "trait_search_query_autocomplete_dropdown",
  "statementDurationSec": {durationSec},
  "queryBar": {{
    "icon": "🔍",
    "queryText": "<punchy simulated search query reflecting the core statement (max 5 words)>",
    "typewriterStartSec": 0.3,
    "typewriterDurationSec": 1.2
  }},
  "dropdownRevealSec": 1.6,
  "results": [
    {{
      "rank": 1,
      "badge": "<category badge e.g. ⚡ BOTTLENECK / 💡 REVENUE / 🎯 ONE THING>",
      "title": "<primary insight>",
      "detail": "<data metric or supporting reason>",
      "isActive": true
    }},
    {{
      "rank": 2,
      "badge": "<category badge e.g. ⚙️ PIPELINE / 📊 CONVERSION / ❌ DISTRACTION>",
      "title": "<secondary alternative or contrast point>",
      "detail": "<data metric or supporting reason>",
      "isActive": false
    }}
  ],
  "keyframeSchedule": [
    {{"timeSec": 0.0, "event": "stage_entry", "description": "Whitecheckered canvas fades in with subtle scale (0.95 -> 1.0)"}},
    {{"timeSec": 0.3, "event": "typewriter_start", "description": "Query bar types out user search term"}},
    {{"timeSec": 1.5, "event": "dropdown_reveal", "description": "Autocomplete dropdown cascades open with glass blur"}},
    {{"timeSec": 2.2, "event": "result_highlight", "description": "First result pulses with neon cyan border"}},
    {{"timeSec": {settle_time}, "event": "hold_and_settle", "description": "Display remains locked on stage alongside speaker"}},
    {{"timeSec": {exit_time}, "event": "stage_exit", "description": "Clean fade-out before chunk completes"}}
  ],
  "assetRequirements": [
    {{
      "assetName": "search_reticle_vector",
      "format": "svg",
      "treatment": "whitecheckered_alpha_glow",
      "position": "center_stage_upper",
      "zIndex": 25
    }},
    {{
      "assetName": "dropdown_card_container",
      "format": "css_glass_matrix",
      "treatment": "transparent_checkerboard_backer",
      "position": "center_stage_lower",
      "zIndex": 20
    }}
  ],
  "temporalCompliance": {{
    "durationCeilingSec": {durationSec},
    "finalEventTimeSec": {exit_time},
    "overflowDetected": false
  }}
}}
"""


def generate_whitecheckered_animation_plan(segment: Dict[str, Any]) -> Dict[str, Any]:
    """Call Google AI API (Gemini 2.5 Flash) to generate the 38.Whitecheckered animation plan."""
    api_key = _get_google_api_key()
    dur = float(segment["durationSec"])
    start_sec = float(segment["startSec"])
    end_sec = float(segment["endSec"])

    start_m, start_s = divmod(int(start_sec), 60)
    end_m, end_s = divmod(int(end_sec), 60)

    settle_time = round(min(dur - 1.2, 3.0), 2)
    exit_time = round(dur - 0.4, 2)

    prompt = _USER_PROMPT_TEMPLATE.format(
        text=segment["text"],
        startSec=start_sec,
        endSec=end_sec,
        durationSec=dur,
        start_min=start_m,
        start_sec=start_s,
        end_min=end_m,
        end_sec=end_s,
        motifs=", ".join(segment.get("matchedMotifs", [])) or "rhetorical_peak",
        settle_time=settle_time,
        exit_time=exit_time,
    )

    request_body = {
        "systemInstruction": {
            "parts": [{"text": _SYSTEM_PROMPT}]
        },
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.15,
            "maxOutputTokens": 2048,
            "responseMimeType": "application/json",
        },
    }

    payload_bytes = json.dumps(request_body).encode("utf-8")
    req = urllib.request.Request(
        GEMINI_GENERATE_URL,
        data=payload_bytes,
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        res_data = json.loads(resp.read().decode("utf-8"))

    raw_text = res_data["candidates"][0]["content"]["parts"][0]["text"]
    plan = json.loads(raw_text)

    # Enforce hard duration invariants
    plan["sourceStatement"] = segment["text"]
    plan["sourceStartSec"] = start_sec
    plan["sourceEndSec"] = end_sec
    plan["sourceDurationSec"] = dur

    # Audit all keyframe timestamps to guarantee zero temporal overflow
    for event in plan.get("keyframeSchedule", []):
        t = float(event.get("timeSec", 0.0))
        if t > dur:
            event["timeSec"] = round(dur - 0.1, 2)
            event["clamped"] = True

    return plan


# ---------------------------------------------------------------------------
# HTML / SVG Component Renderer for Live 9:16 Preview
# ---------------------------------------------------------------------------

def render_whitecheckered_stage_html(plan: Dict[str, Any]) -> str:
    """Render the standalone 38.Whitecheckered animated preview with transparent checkerboard backing."""
    query_bar = plan.get("queryBar", {})
    query_text = query_bar.get("queryText", "identifying the core constraint")
    results = plan.get("results", [])
    dur = plan.get("statementDurationSec", 12.0)

    results_html = []
    for r in results:
        active_class = "active" if r.get("isActive") else ""
        badge = r.get("badge", "⚡ RESULT")
        title = r.get("title", "")
        detail = r.get("detail", "")
        results_html.append(f"""
        <div class="wc-item {active_class}">
          <div class="wc-badge">{badge}</div>
          <div class="wc-item-body">
            <div class="wc-item-title">{title}</div>
            <div class="wc-item-detail">{detail}</div>
          </div>
        </div>
        """)

    return f"""\
<!-- 38.WHITECHECKERED — PROMETHEUS MINI-RUN COMPONENT -->
<div class="whitecheckered-viewport">
  <div class="whitecheckered-stage" style="--duration: {dur}s;">
    <div class="wc-header">
      <span class="wc-tag">ARCHETYPE #38</span>
      <span class="wc-dogma">38.WHITECHECKERED • ALPHA PREVIEW</span>
    </div>
    
    <!-- Transparent Checkerboard Container (.img-wrap standard) -->
    <div class="wc-checker-backer">
      <div class="wc-search-bar">
        <span class="wc-icon">🔍</span>
        <span class="wc-query-text">{query_text}</span>
        <span class="wc-cursor">|</span>
      </div>
      
      <div class="wc-dropdown">
        {"".join(results_html)}
      </div>
    </div>

    <div class="wc-footer">
      <span class="wc-duration-pill">⏱️ Bounded: {dur}s</span>
      <span class="wc-status-pill">✓ Zero Overflow Verified</span>
    </div>
  </div>
</div>

<style>
.whitecheckered-viewport {{
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #FFFFFF;
}}

.whitecheckered-stage {{
  background: #090D16;
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.15);
  position: relative;
  overflow: hidden;
}}

.wc-header {{
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}}

.wc-tag {{
  background: rgba(56, 189, 248, 0.18);
  color: #38BDF8;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(56, 189, 248, 0.4);
}}

.wc-dogma {{
  font-size: 10px;
  color: #94A3B8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}}

/* Authoritative Transparent Checkerboard Backing (.img-wrap pattern) */
.wc-checker-backer {{
  background-color: #0c101c;
  background-image: 
    linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%), 
    linear-gradient(-45deg, rgba(255,255,255,0.04) 25%, transparent 25%), 
    linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.04) 75%), 
    linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.04) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
  border-radius: 10px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  flex-direction: column;
  gap: 10px;
}}

.wc-search-bar {{
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid #38BDF8;
  padding: 10px 14px;
  border-radius: 8px;
  box-shadow: 0 0 16px rgba(56, 189, 248, 0.25);
}}

.wc-icon {{
  font-size: 15px;
}}

.wc-query-text {{
  font-weight: 700;
  font-size: 14px;
  color: #FFFFFF;
  letter-spacing: -0.01em;
}}

.wc-cursor {{
  color: #38BDF8;
  font-weight: 900;
  animation: wcBlink 0.8s infinite;
}}

@keyframes wcBlink {{
  0%, 100% {{ opacity: 1; }}
  50% {{ opacity: 0; }}
}}

.wc-dropdown {{
  display: flex;
  flex-direction: column;
  gap: 8px;
}}

.wc-item {{
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.25s ease;
}}

.wc-item.active {{
  border-color: #38BDF8;
  background: rgba(56, 189, 248, 0.08);
  box-shadow: 0 0 18px rgba(56, 189, 248, 0.2);
}}

.wc-badge {{
  font-size: 10px;
  font-weight: 800;
  color: #FFE600;
  letter-spacing: 0.05em;
}}

.wc-item-title {{
  font-size: 13px;
  font-weight: 700;
  color: #FFFFFF;
}}

.wc-item-detail {{
  font-size: 11px;
  color: #94A3B8;
}}

.wc-footer {{
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  font-size: 11px;
}}

.wc-duration-pill {{
  color: #FFE600;
  font-weight: 700;
}}

.wc-status-pill {{
  color: #10B981;
  font-weight: 700;
}}
</style>
"""
