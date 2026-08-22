"""Call parser — short-form (MAUL) vs long-form (Joseph) dispatch.

Determines whether an incoming request is for the short-form MAUL pipeline or
the long-form Joseph pipeline, then diligently attributes it to the respective
module. Mirrors the production dispatch contract: short-form pipeline job IDs
are ``maul:<replayKey>`` and long-form are ``joseph:<jobId>``.

Classification rules (deterministic, override-able):

* Explicit ``pipeline`` field wins when it is ``maul`` or ``joseph``.
* Otherwise: short-form when duration <= ``SHORT_FORM_MAX_SECONDS`` (default
  90s) OR the source is portrait/vertical (aspect ratio >= 1). Long-form for
  everything else.
"""

from __future__ import annotations

import re
from typing import Any, Dict

PIPELINES = ("maul", "joseph")
MODES = ("short_form", "long_form")

SHORT_FORM_MAX_SECONDS = 90
SHORT_FORM_MIN_ASPECT_RATIO = 1.0  # portrait when width <= height

SAFE_REPLAY_KEY_RE = re.compile(r"[^a-f0-9]")


def _duration_seconds(payload: Dict[str, Any]) -> float:
    if payload.get("durationSec") is not None:
        return float(payload["durationSec"])
    if payload.get("durationMs") is not None:
        return float(payload["durationMs"]) / 1000.0
    if payload.get("source") and isinstance(payload["source"], dict):
        source = payload["source"]
        if source.get("durationSec") is not None:
            return float(source["durationSec"])
        if source.get("durationMs") is not None:
            return float(source["durationMs"]) / 1000.0
    return float("nan")


def _aspect_ratio(payload: Dict[str, Any]) -> float:
    width = payload.get("width") or (payload.get("source") or {}).get("width")
    height = payload.get("height") or (payload.get("source") or {}).get("height")
    if not width or not height:
        return float("nan")
    return float(width) / float(height)


def classify_call(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Return the dispatch decision for the incoming render request."""
    explicit = str(payload.get("pipeline") or "").strip().lower()
    if explicit in PIPELINES:
        return {
            "pipeline": explicit,
            "mode": "short_form" if explicit == "maul" else "long_form",
            "decision": "explicit_override",
            "reason": f"caller explicitly requested the {explicit} pipeline.",
            "durationSec": _duration_seconds(payload) if _duration_seconds(payload) == _duration_seconds(payload) else None,
            "aspectRatio": _aspect_ratio(payload) if _aspect_ratio(payload) == _aspect_ratio(payload) else None,
            "confidence": 1.0,
        }

    duration_sec = _duration_seconds(payload)
    aspect = _aspect_ratio(payload)
    reasons: list[str] = []

    has_duration = duration_sec == duration_sec  # not NaN
    has_aspect = aspect == aspect

    if has_duration and duration_sec <= SHORT_FORM_MAX_SECONDS:
        reasons.append(
            f"duration {duration_sec:.1f}s <= {SHORT_FORM_MAX_SECONDS}s short-form ceiling"
        )
    if has_aspect and aspect <= SHORT_FORM_MIN_ASPECT_RATIO:
        reasons.append(f"portrait aspect ratio {aspect:.3f} <= {SHORT_FORM_MIN_ASPECT_RATIO}")
    if not reasons:
        return {
            "pipeline": "joseph",
            "mode": "long_form",
            "decision": "heuristic",
            "reason": "no short-form signal; dispatch to the long-form Joseph pipeline.",
            "durationSec": duration_sec if has_duration else None,
            "aspectRatio": aspect if has_aspect else None,
            "confidence": 0.75,
        }
    return {
        "pipeline": "maul",
        "mode": "short_form",
        "decision": "heuristic",
        "reason": "dispatch to the short-form MAUL pipeline: " + "; ".join(reasons) + ".",
        "durationSec": duration_sec if has_duration else None,
        "aspectRatio": aspect if has_aspect else None,
        "confidence": 0.9,
    }


def replay_key_for(job_id: str, source_sha256: str) -> str:
    """Short-form pipeline job ID is ``maul:<replayKey>`` (64 lowercase hex).

    The replay key is derived deterministically from the source revision so the
    same source + job always maps to the same key (parity with the production
    MAUL replay ledger).
    """
    material = f"{job_id}:{source_sha256}".encode("utf-8")
    import hashlib

    return hashlib.sha256(material).hexdigest()


def pipeline_job_id(pipeline: str, job_id: str, source_sha256: str = "") -> str:
    """Return the canonical pipeline job ID: ``maul:<replayKey>`` or ``joseph:<jobId>``."""
    if pipeline == "maul":
        return f"maul:{replay_key_for(job_id, source_sha256)}"
    return f"joseph:{job_id}"
