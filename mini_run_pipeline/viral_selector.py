"""Viral segment selector for long-form content.

Given a full word-timed transcript from a 40–60-minute source, uses an LLM
(Groq llama-3.3-70b-versatile) to identify the N highest-virality windows —
each of natural speaking-rhythm length (30 s – 5 min) — and returns them with
metadata the mini-run pipeline consumes directly as ``selectedWindow`` payloads.

Virality scoring heuristics surfaced by the LLM:
  - Emotional intensity / peak (anger, joy, disbelief, inspiration)
  - Surprising statistic or counter-intuitive claim
  - Strong polarising opinion or personal revelation
  - High-stakes story arc with clear tension + resolution
  - Punchy, quotable delivery (short sentences, anaphora, list climax)
  - Clear value exchange: concrete advice the viewer can act on immediately
  - Authentic, unscripted moments (laughter, stumble + recovery, raw emotion)

The LLM receives a condensed sentence-map (not raw words) so the request stays
well within context limits for an hour-long source.  Sentence timestamps are
reconstructed from the original word list to produce millisecond-accurate
``sourceStartMs``/``sourceEndMs`` pairs.
"""

from __future__ import annotations

import json
import os
import re
import textwrap
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_TEMPERATURE = float(os.getenv("GROQ_TEMPERATURE", "0.2"))
GROQ_MAX_TOKENS = int(os.getenv("GROQ_MAX_TOKENS", "2048"))

GOOGLE_AI_STUDIO_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"
GOOGLE_AI_MODEL = "gemini-2.0-flash"

# Clip length constraints (ms)
VIRAL_CLIP_MIN_MS = 25_000      # 25 s — anything shorter feels truncated
VIRAL_CLIP_MAX_MS = 300_000     # 5 min — hard ceiling for shorts/reels
VIRAL_CLIP_DEFAULT_MS = 60_000  # 60 s target when LLM gives no guidance

# Minimum gap between two selected windows so the same footage isn't reused
WINDOW_GAP_MIN_MS = 10_000

# How many sentences we show the LLM per «condensed» map entry
SENTENCE_STRIDE = 1

# ---------------------------------------------------------------------------
# Sentence segmentation over word list
# ---------------------------------------------------------------------------

_SENTENCE_END_RE = re.compile(r"[.!?][\"'\)]?\s*$")


def _segment_sentences(words: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Group word-timed words into sentence-level segments.

    Returns a list of dicts::
        {sentenceIndex, startMs, endMs, text}
    """
    if not words:
        return []

    sentences: List[Dict[str, Any]] = []
    buffer: List[Dict[str, Any]] = []
    idx = 0

    for word in words:
        buffer.append(word)
        text = word.get("text", "")
        if _SENTENCE_END_RE.search(text) or len(buffer) >= 40:
            sent_text = " ".join(w.get("text", "") for w in buffer)
            sentences.append(
                {
                    "sentenceIndex": idx,
                    "startMs": int(buffer[0].get("start_ms", buffer[0].get("start", 0))),
                    "endMs": int(buffer[-1].get("end_ms", buffer[-1].get("end", 0))),
                    "text": sent_text,
                }
            )
            buffer = []
            idx += 1

    if buffer:
        sent_text = " ".join(w.get("text", "") for w in buffer)
        sentences.append(
            {
                "sentenceIndex": idx,
                "startMs": int(buffer[0].get("start_ms", buffer[0].get("start", 0))),
                "endMs": int(buffer[-1].get("end_ms", buffer[-1].get("end", 0))),
                "text": sent_text,
            }
        )

    return sentences


def _build_condensed_map(
    sentences: List[Dict[str, Any]], max_chars: int = 14_000
) -> str:
    """Build a compact text map of the transcript for the LLM.

    Format per line::
        [HH:MM:SS] sentence text

    Truncated at ``max_chars`` characters so we never blow the LLM context
    window even on a 2-hour source.
    """

    def _fmt_ms(ms: int) -> str:
        s = ms // 1000
        m, s = divmod(s, 60)
        h, m = divmod(m, 60)
        return f"{h:02d}:{m:02d}:{s:02d}"

    lines: List[str] = []
    char_count = 0
    for sent in sentences:
        line = f"[{_fmt_ms(sent['startMs'])}] {sent['text']}"
        char_count += len(line) + 1
        if char_count > max_chars:
            lines.append("[… transcript truncated for context …]")
            break
        lines.append(line)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# LLM call
# ---------------------------------------------------------------------------

def _call_llm_groq(prompt: str) -> str:
    """Call the Groq chat completions endpoint.  Returns the assistant message text."""
    import urllib.request

    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Cannot run viral segment selection."
        )

    body = json.dumps(
        {
            "model": GROQ_MODEL,
            "temperature": GROQ_TEMPERATURE,
            "max_tokens": GROQ_MAX_TOKENS,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are an elite short-form video editor with a track record of "
                        "creating viral clips on TikTok, Instagram Reels, and YouTube Shorts. "
                        "You have deep intuition for what makes a moment shareable."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        f"{GROQ_BASE_URL}/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=90) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def _call_llm_google(prompt: str) -> str:
    """Fallback: call Google AI Studio (Gemini) via OpenAI-compatible endpoint."""
    import urllib.request

    api_key = os.getenv("GOOGLE_AI_STUDIO_API_KEY", "")
    if not api_key:
        raise RuntimeError("GOOGLE_AI_STUDIO_API_KEY not set.")

    body = json.dumps(
        {
            "model": GOOGLE_AI_MODEL,
            "temperature": 0.2,
            "max_tokens": 2048,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are an elite short-form video editor specialising in viral clips."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        f"{GOOGLE_AI_STUDIO_BASE_URL}/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=90) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def _call_llm(prompt: str) -> str:
    """Try Groq first; fall back to Google AI Studio."""
    try:
        return _call_llm_groq(prompt)
    except Exception as groq_err:
        print(f"[viral_selector] Groq failed ({groq_err}), trying Google AI...", flush=True)
        try:
            return _call_llm_google(prompt)
        except Exception as google_err:
            raise RuntimeError(
                f"Both LLM backends failed. Groq: {groq_err}  Google: {google_err}"
            ) from google_err


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

_SELECTION_PROMPT = textwrap.dedent(
    """\
    Below is a timestamped transcript map from a long-form video.

    YOUR TASK
    Select exactly {n} non-overlapping moments that have the highest viral potential
    for short-form content (TikTok / Reels / Shorts).

    SELECTION RULES
    1. Each clip must be 25 seconds to 5 minutes long.
    2. Pick the natural FULL THOUGHT — start just before the speaker commits to the
       key idea, end right after the payoff lands (punchline, data point, conclusion).
    3. Prefer moments with: strong emotion, surprising insight, personal story, bold
       claim, or irresistibly quotable phrasing.
    4. Do NOT select the same region twice.
    5. Clips must not overlap (leave ≥ 10 s gap between them).
    {extra_instructions}

    TRANSCRIPT MAP
    {condensed_map}

    RESPOND with ONLY a valid JSON array (no markdown fences, no extra text):
    [
      {{
        "rank": 1,
        "sourceStartMs": <integer milliseconds>,
        "sourceEndMs": <integer milliseconds>,
        "viralityScore": <float 0.0-1.0>,
        "hook": "<one-sentence hook that would appear in the caption>",
        "reason": "<25 words max: why this moment is viral>"
      }},
      ...
    ]
    """
)


def _build_prompt(
    condensed_map: str,
    n: int,
    extra_instructions: str = "",
) -> str:
    return _SELECTION_PROMPT.format(
        n=n,
        condensed_map=condensed_map,
        extra_instructions=extra_instructions.strip(),
    )


# ---------------------------------------------------------------------------
# Response parsing
# ---------------------------------------------------------------------------

def _parse_llm_response(raw: str, sentences: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract the JSON array from the LLM response and snap timestamps to
    word-level sentence boundaries for millisecond accuracy."""

    # Strip any accidental markdown fences
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()
    # Find the first [ ... ] block
    match = re.search(r"\[.*\]", cleaned, re.DOTALL)
    if not match:
        raise ValueError(
            f"LLM response did not contain a valid JSON array:\n{raw[:300]}"
        )

    windows = json.loads(match.group(0))

    snapped: List[Dict[str, Any]] = []
    for win in windows:
        start_ms = int(win.get("sourceStartMs", 0))
        end_ms = int(win.get("sourceEndMs", 0))

        # Snap to nearest sentence boundary so we don't cut mid-word
        snapped_start = _snap_to_sentence_start(sentences, start_ms)
        snapped_end = _snap_to_sentence_end(sentences, end_ms)

        # Enforce duration constraints
        duration = snapped_end - snapped_start
        if duration < VIRAL_CLIP_MIN_MS:
            snapped_end = min(
                snapped_start + VIRAL_CLIP_DEFAULT_MS,
                sentences[-1]["endMs"] if sentences else snapped_start + VIRAL_CLIP_DEFAULT_MS,
            )
        if snapped_end - snapped_start > VIRAL_CLIP_MAX_MS:
            snapped_end = snapped_start + VIRAL_CLIP_MAX_MS

        snapped.append(
            {
                "rank": int(win.get("rank", len(snapped) + 1)),
                "sourceStartMs": snapped_start,
                "sourceEndMs": snapped_end,
                "durationMs": snapped_end - snapped_start,
                "viralityScore": float(win.get("viralityScore", 0.5)),
                "hook": str(win.get("hook", "")),
                "reason": str(win.get("reason", "")),
            }
        )

    # Sort by source position, then enforce gap between clips
    snapped.sort(key=lambda w: w["sourceStartMs"])
    return _enforce_gaps(snapped)


def _snap_to_sentence_start(
    sentences: List[Dict[str, Any]], target_ms: int
) -> int:
    """Return the startMs of the sentence whose start is closest to target_ms
    (but not more than 8 s after it, to avoid large drift)."""
    if not sentences:
        return target_ms
    best = sentences[0]
    for sent in sentences:
        if abs(sent["startMs"] - target_ms) < abs(best["startMs"] - target_ms):
            best = sent
        if sent["startMs"] > target_ms + 8_000:
            break
    return best["startMs"]


def _snap_to_sentence_end(
    sentences: List[Dict[str, Any]], target_ms: int
) -> int:
    """Return the endMs of the sentence whose end is closest to target_ms."""
    if not sentences:
        return target_ms
    best = sentences[-1]
    for sent in reversed(sentences):
        if abs(sent["endMs"] - target_ms) < abs(best["endMs"] - target_ms):
            best = sent
        if sent["endMs"] < target_ms - 8_000:
            break
    return best["endMs"]


def _enforce_gaps(windows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Push overlapping windows apart so there is always ≥ WINDOW_GAP_MIN_MS
    between the end of one window and the start of the next."""
    result: List[Dict[str, Any]] = []
    for win in windows:
        if result:
            prev_end = result[-1]["sourceEndMs"]
            if win["sourceStartMs"] < prev_end + WINDOW_GAP_MIN_MS:
                win = dict(win)
                win["sourceStartMs"] = prev_end + WINDOW_GAP_MIN_MS
                win["sourceEndMs"] = win["sourceStartMs"] + win["durationMs"]
        win["durationMs"] = win["sourceEndMs"] - win["sourceStartMs"]
        result.append(win)
    return result


def _heuristic_fallback_windows(
    sentences: List[Dict[str, Any]], n: int
) -> List[Dict[str, Any]]:
    """Heuristic fallback when LLM API is unavailable.

    Partitions the transcript into n sections and extracts the highest speech-density
    window (30s–60s) from each section with natural sentence boundaries.
    """
    if not sentences:
        return []
    total_ms = sentences[-1]["endMs"]
    available_ms = max(0, total_ms - (n - 1) * WINDOW_GAP_MIN_MS)
    target_dur = max(VIRAL_CLIP_MIN_MS, min(60_000, available_ms // max(1, n)))
    step_ms = total_ms / max(1, n)
    windows: List[Dict[str, Any]] = []

    for i in range(n):
        target_start = int(i * step_ms)
        if target_start >= total_ms - VIRAL_CLIP_MIN_MS and windows:
            break

        # Find sentence closest to target_start
        s_idx = 0
        for idx, s in enumerate(sentences):
            if s["startMs"] >= target_start:
                s_idx = idx
                break
        else:
            s_idx = len(sentences) - 1

        clip_start = sentences[s_idx]["startMs"]
        clip_end = sentences[s_idx]["endMs"]
        e_idx = s_idx
        while e_idx < len(sentences) - 1:
            next_sent = sentences[e_idx + 1]
            dur = next_sent["endMs"] - clip_start
            if dur >= target_dur and (clip_end - clip_start) >= VIRAL_CLIP_MIN_MS:
                break
            e_idx += 1
            clip_end = next_sent["endMs"]
            if dur >= target_dur:
                break

        if clip_end <= clip_start:
            continue

        first_text = sentences[s_idx].get("text", "").strip()
        hook = first_text[:80] + ("..." if len(first_text) > 80 else "")

        windows.append(
            {
                "rank": len(windows) + 1,
                "sourceStartMs": clip_start,
                "sourceEndMs": clip_end,
                "durationMs": clip_end - clip_start,
                "viralityScore": round(max(0.5, 0.88 - (len(windows) * 0.05)), 2),
                "hook": hook or f"Key topic #{len(windows) + 1}",
                "reason": "High-density editorial moment extracted by rhythmic boundary parser.",
            }
        )

    windows.sort(key=lambda w: w["sourceStartMs"])
    return _enforce_gaps(windows)


def select_viral_windows(
    words: List[Dict[str, Any]],
    n: int = 4,
    prompt: Optional[str] = None,
    brand_preferences: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Select the top-N viral windows from a full word-timed transcript.

    Args:
        words: Full word list from AssemblyAI (``start_ms``/``end_ms``/``text``).
        n: How many clips to select (1–10).
        prompt: Optional user prompt / brand context to steer selection.
        brand_preferences: Optional brand prefs dict (currently informational).

    Returns:
        List of window dicts (sorted by rank / virality score)::

            {rank, sourceStartMs, sourceEndMs, durationMs,
             viralityScore, hook, reason}
    """
    n = max(1, min(10, n))

    if not words:
        raise ValueError("viral_selector: empty word list -- transcription may have failed.")

    sentences = _segment_sentences(words)
    if not sentences:
        raise ValueError("viral_selector: could not segment transcript into sentences.")

    source_duration_ms = sentences[-1]["endMs"]
    print(
        f"[viral_selector] {len(words)} words -> {len(sentences)} sentences "
        f"({source_duration_ms / 60_000:.1f} min). Selecting {n} viral windows.",
        flush=True,
    )

    condensed_map = _build_condensed_map(sentences)

    extra = ""
    if prompt:
        extra += f"USER CONTEXT: {prompt}\n"
    if brand_preferences:
        tone = brand_preferences.get("tone") or brand_preferences.get("brandTone", "")
        niche = brand_preferences.get("niche") or brand_preferences.get("contentNiche", "")
        if tone:
            extra += f"Brand tone: {tone}\n"
        if niche:
            extra += f"Content niche: {niche}\n"

    llm_prompt = _build_prompt(condensed_map, n, extra_instructions=extra)

    try:
        raw_response = _call_llm(llm_prompt)
        print(
            f"[viral_selector] LLM responded ({len(raw_response)} chars). Parsing...",
            flush=True,
        )
        windows = _parse_llm_response(raw_response, sentences)
    except Exception as llm_err:
        print(
            f"[viral_selector] LLM viral selection failed ({llm_err}). Falling back to heuristic speech-density selector...",
            flush=True,
        )
        windows = _heuristic_fallback_windows(sentences, n)

    # Clamp to what is actually available in the transcript and filter invalid durations
    valid_windows: List[Dict[str, Any]] = []
    for win in windows:
        start = max(0, int(win.get("sourceStartMs", 0)))
        end = min(source_duration_ms, int(win.get("sourceEndMs", 0)))
        dur = end - start
        if start < source_duration_ms and dur >= 15_000:
            win["sourceStartMs"] = start
            win["sourceEndMs"] = end
            win["durationMs"] = dur
            valid_windows.append(win)

    if not valid_windows and windows:
        w0 = windows[0]
        w0["sourceStartMs"] = 0
        w0["sourceEndMs"] = source_duration_ms
        w0["durationMs"] = source_duration_ms
        valid_windows = [w0]

    for idx, win in enumerate(valid_windows):
        win["rank"] = idx + 1

    windows = valid_windows

    print(
        f"[viral_selector] Selected {len(windows)} windows: "
        + ", ".join(
            f"#{w['rank']} {w['sourceStartMs']//1000}s-{w['sourceEndMs']//1000}s"
            f" ({w['durationMs']//1000}s, score={w['viralityScore']:.2f})"
            for w in windows
        ),
        flush=True,
    )
    return windows
