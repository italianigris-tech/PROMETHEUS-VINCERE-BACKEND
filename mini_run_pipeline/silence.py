"""Silence detection + protected rhetorical-pause classification.

Parity with ``backend/src/maul/editorial-timeline.ts``:

* ``detect_silence_with_ffmpeg``   -> FFmpeg ``silencedetect`` (noise dB + min ms)
* ``classify_protected_pause``     -> a rhetorical pause is preserved when the
  silence is <= 900ms AND the word immediately before it ends with sentence
  ending punctuation (``.``/``!``/``?``).
* ``build_voice_spans``            -> split on > 600ms gaps or verified silence.
* ``build_timestamp_map``          -> keep / cut / protected_pause output map.

The mini-run's dumb video chunker remains a boundary cutter; this module is the
intelligent timeline layer that decides WHERE the boundaries go.
"""

from __future__ import annotations

import json
import re
import subprocess
from typing import Any, List, Optional

DEFAULT_NOISE_THRESHOLD_DB = -30
DEFAULT_MINIMUM_SILENCE_MS = 300
CUT_MIN_SILENCE_MS = 250
PROTECTED_MAX_SILENCE_MS = 900
VOICE_SPAN_GAP_MS = 600
SENTENCE_END_RE = re.compile(r"""[.!?]["']?$""")

FFMPEG_TIMEOUT_SECONDS = 300


# ---------------------------------------------------------------------------
# FFmpeg silence detection
# ---------------------------------------------------------------------------


def parse_ffmpeg_silence_detect(output: str, source_duration_ms: int) -> List[dict[str, Any]]:
    """Parse ``silencedetect`` stderr lines into sorted silence spans."""
    spans: List[dict[str, Any]] = []
    open_start_ms: Optional[int] = None
    for line in output.splitlines():
        start_match = re.search(r"silence_start:\s*([0-9.]+)", line)
        if start_match and start_match.group(1):
            open_start_ms = round(float(start_match.group(1)) * 1000)
        end_match = re.search(r"silence_end:\s*([0-9.]+)", line)
        if end_match and end_match.group(1) and open_start_ms is not None:
            source_end_ms = min(source_duration_ms, round(float(end_match.group(1)) * 1000))
            if source_end_ms > open_start_ms:
                spans.append(
                    {
                        "sourceStartMs": open_start_ms,
                        "sourceEndMs": source_end_ms,
                        "confidence": 1.0,
                    }
                )
            open_start_ms = None
    if open_start_ms is not None and source_duration_ms > open_start_ms:
        spans.append(
            {
                "sourceStartMs": open_start_ms,
                "sourceEndMs": source_duration_ms,
                "confidence": 1.0,
            }
        )
    spans.sort(key=lambda span: span["sourceStartMs"])
    return spans


def detect_silence_with_ffmpeg(
    source_path: str,
    source_duration_ms: int,
    noise_threshold_db: float = DEFAULT_NOISE_THRESHOLD_DB,
    minimum_silence_ms: int = DEFAULT_MINIMUM_SILENCE_MS,
    ffmpeg_binary: str = "ffmpeg",
    max_duration_ms: Optional[int] = None,
) -> List[dict[str, Any]]:
    """Detect silence spans with FFmpeg ``silencedetect`` (same filter as MAUL)."""
    effective_duration_ms = min(source_duration_ms, max_duration_ms) if max_duration_ms and max_duration_ms > 0 else source_duration_ms
    cmd = [
        ffmpeg_binary,
        "-hide_banner",
        "-nostats",
    ]
    if max_duration_ms and max_duration_ms > 0:
        cmd.extend(["-t", f"{(max_duration_ms / 1000.0):.3f}"])
    cmd.extend([
        "-i",
        str(source_path),
        "-vn",
        "-af",
        f"silencedetect=noise={noise_threshold_db}dB:d={(minimum_silence_ms / 1000):.3f}",
        "-f",
        "null",
        "-",
    ])
    completed = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=FFMPEG_TIMEOUT_SECONDS,
    )
    if completed.returncode != 0:
        stderr = completed.stderr.strip() or completed.stdout.strip()
        raise RuntimeError(f"silence detection failed: {stderr[-2000:]}")
    return parse_ffmpeg_silence_detect(completed.stderr, effective_duration_ms)

# ---------------------------------------------------------------------------
# Protected pause classification
# ---------------------------------------------------------------------------


def _word_before_silence(
    words: List[dict[str, Any]], silence_start_ms: int
) -> Optional[dict[str, Any]]:
    """The most recent transcript word that starts at or before the silence."""
    before = [word for word in words if int(word.get("start_ms", 0)) <= silence_start_ms]
    if not before:
        return None
    return max(before, key=lambda word: int(word.get("start_ms", 0)))


def classify_protected_pause(
    silence: dict[str, Any],
    words: List[dict[str, Any]],
    max_silence_ms: int = PROTECTED_MAX_SILENCE_MS,
    min_silence_ms: int = DEFAULT_MINIMUM_SILENCE_MS,
) -> Optional[dict[str, Any]]:
    """Return the silence re-labeled as a protected rhetorical pause, or None.

    A rhetorical pause is preserved when its duration is <= 900ms and the word
    immediately before it ends with sentence-ending punctuation.
    """
    duration_ms = int(silence["sourceEndMs"]) - int(silence["sourceStartMs"])
    if duration_ms > max_silence_ms or duration_ms < min_silence_ms:
        return None
    preceding = _word_before_silence(words, int(silence["sourceStartMs"]))
    if preceding is None or not SENTENCE_END_RE.search(str(preceding.get("text", "")).strip()):
        return None
    return {
        "sourceStartMs": int(silence["sourceStartMs"]),
        "sourceEndMs": int(silence["sourceEndMs"]),
        "confidence": float(silence.get("confidence", 1.0)),
        "kind": "protected_pause",
    }


# ---------------------------------------------------------------------------
# Voice spans
# ---------------------------------------------------------------------------


def build_voice_spans(
    words: List[dict[str, Any]],
    silence_spans: List[dict[str, Any]],
    gap_ms: int = VOICE_SPAN_GAP_MS,
    provider: str = "ffmpeg_silencedetect",
) -> List[dict[str, Any]]:
    """Split the transcript into voice spans on >``gap_ms`` gaps or silences."""
    spans: List[dict[str, Any]] = []
    bucket: List[dict[str, Any]] = []
    bucket_end_ms: Optional[int] = None
    verified: List[dict[str, Any]] = [
        {**span, "detectionSource": provider, "verified": True} for span in silence_spans
    ]

    def flush() -> None:
        nonlocal bucket, bucket_end_ms
        if not bucket:
            return
        spans.append(
            {
                "sourceStartMs": int(bucket[0]["start_ms"]),
                "sourceEndMs": int(bucket[-1]["end_ms"]),
                "speakerId": None,
                "confidence": sum(float(w.get("confidence", 1.0)) for w in bucket) / len(bucket),
                "detectionSource": provider,
                "words": bucket,
            }
        )
        bucket = []
        bucket_end_ms = None

    for word in words:
        word_start = int(word.get("start_ms", 0))
        word_end = int(word.get("end_ms", word_start + 1))
        crosses_verified_silence = any(
            span["sourceStartMs"] < word_end and span["sourceEndMs"] > word_start
            for span in verified
        )
        if bucket_end_ms is not None and (
            (word_start - bucket_end_ms) > gap_ms or crosses_verified_silence
        ):
            flush()
        if not bucket:
            bucket_end_ms = word_end
        else:
            bucket_end_ms = max(bucket_end_ms, word_end)
        bucket.append(word)
    flush()

    for span in spans:
        span["confidence"] = round(span["confidence"], 4)
    return spans


# ---------------------------------------------------------------------------
# Timestamp map
# ---------------------------------------------------------------------------


def build_timestamp_map(
    selected_window: dict[str, Any],
    cut_ranges: List[dict[str, Any]],
    protected_ranges: List[dict[str, Any]],
) -> List[dict[str, Any]]:
    """Flatten keep/protected ranges into an output-timed map with cut gaps.

    Mirrors ``editorial-timeline.ts`` ``buildTimestampMap``: the output timecode
    starts at the selected window and advances only over kept/protected audio.
    """
    window_start_ms = int(selected_window.get("sourceStartMs", 0))
    window_end_ms = int(selected_window.get("sourceEndMs", 0))
    if window_end_ms <= window_start_ms:
        return []

    sorted_cuts = sorted(cut_ranges, key=lambda cut: int(cut["sourceStartMs"]))
    sorted_protected = sorted(
        protected_ranges, key=lambda prot: int(prot["sourceStartMs"])
    )
    boundaries: set[int] = {
        window_start_ms,
        window_end_ms,
    }
    for cut in sorted_cuts:
        boundaries.add(int(cut["sourceStartMs"]))
        boundaries.add(int(cut["sourceEndMs"]))
    for prot in sorted_protected:
        boundaries.add(int(prot["sourceStartMs"]))
        boundaries.add(int(prot["sourceEndMs"]))
    ordered = sorted(boundaries)

    def cut_at(source_ms: int) -> bool:
        return any(
            int(cut["sourceStartMs"]) <= source_ms < int(cut["sourceEndMs"])
            for cut in sorted_cuts
        )

    def protected_at(source_ms: int) -> bool:
        return any(
            int(prot["sourceStartMs"]) <= source_ms < int(prot["sourceEndMs"])
            for prot in sorted_protected
        )

    output_ms = 0
    segments: List[dict[str, Any]] = []
    for index in range(len(ordered) - 1):
        start = ordered[index]
        end = ordered[index + 1]
        if end <= start:
            continue
        if cut_at(start):
            segments.append(
                {
                    "sourceStartMs": start,
                    "sourceEndMs": end,
                    "outputStartMs": output_ms,
                    "outputEndMs": output_ms,
                    "mode": "cut",
                }
            )
        elif protected_at(start):
            segments.append(
                {
                    "sourceStartMs": start,
                    "sourceEndMs": end,
                    "outputStartMs": output_ms,
                    "outputEndMs": output_ms + (end - start),
                    "mode": "protected_pause",
                }
            )
            output_ms += end - start
        else:
            segments.append(
                {
                    "sourceStartMs": start,
                    "sourceEndMs": end,
                    "outputStartMs": output_ms,
                    "outputEndMs": output_ms + (end - start),
                    "mode": "keep",
                }
            )
            output_ms += end - start
    return segments


# ---------------------------------------------------------------------------
# Media probe
# ---------------------------------------------------------------------------


def probe_media(
    source_path: str, ffprobe_binary: str = "ffprobe", ffmpeg_binary: str = "ffmpeg"
) -> dict[str, Any]:
    """Read duration + dimensions via ``ffprobe`` (falls back to ``ffmpeg -i``)."""
    try:
        completed = subprocess.run(
            [
                ffprobe_binary,
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height,duration:format=duration",
                "-of",
                "json",
                str(source_path),
            ],
            capture_output=True,
            text=True,
            timeout=FFMPEG_TIMEOUT_SECONDS,
        )
        if completed.returncode == 0:
            payload = json.loads(completed.stdout)
            stream = (payload.get("streams") or [{}])[0]
            duration_ms = round(
                float(stream.get("duration") or payload.get("format", {}).get("duration") or 0) * 1000
            )
            return {
                "durationMs": duration_ms,
                "width": int(stream.get("width") or 0),
                "height": int(stream.get("height") or 0),
            }
    except Exception:  # noqa: BLE001 - fall through to ffmpeg -i parsing
        pass

    # Fallback: parse ``ffmpeg -i`` stderr for Duration + Video: ...  WxH.
    try:
        completed = subprocess.run(
            [ffmpeg_binary, "-hide_banner", "-i", str(source_path)],
            capture_output=True,
            text=True,
            timeout=FFMPEG_TIMEOUT_SECONDS,
        )
        stderr = completed.stderr or ""
        duration_ms = 0
        duration_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", stderr)
        if duration_match:
            hours, minutes, seconds = duration_match.groups()
            duration_ms = round(
                (int(hours) * 3600 + int(minutes) * 60 + float(seconds)) * 1000
            )
        size_match = re.search(r"(\d{2,5})x(\d{2,5})", stderr)
        width, height = (int(size_match.group(1)), int(size_match.group(2))) if size_match else (0, 0)
        return {"durationMs": duration_ms, "width": width, "height": height}
    except Exception as error:  # noqa: BLE001 - probe is best-effort
        return {"durationMs": 0, "width": 0, "height": 0, "probeError": str(error)}


# ---------------------------------------------------------------------------
# Editorial timeline
# ---------------------------------------------------------------------------


def build_editorial_timeline(
    selected_window: dict[str, Any],
    words: List[dict[str, Any]],
    silence_spans: List[dict[str, Any]],
    source_duration_ms: int,
    source_width: int = 0,
    source_height: int = 0,
) -> dict[str, Any]:
    """Assemble the full editorial timeline for a source.

    Mirrors the MAUL editorial-timeline flow:
      1. filter silence spans to the selected window,
      2. classify protected rhetorical pauses (<= 900ms after sentence end),
      3. remaining verified non-protected dead air >= 250ms becomes cut,
      4. build voice spans + the output timestamp map.
    """
    window_start_ms = int(selected_window.get("sourceStartMs", 0))
    window_end_ms = int(selected_window.get("sourceEndMs", source_duration_ms))

    clipped: List[dict[str, Any]] = []
    for span in silence_spans:
        start = max(int(span["sourceStartMs"]), window_start_ms)
        end = min(int(span["sourceEndMs"]), window_end_ms)
        if end > start:
            clipped.append(
                {
                    "sourceStartMs": start,
                    "sourceEndMs": end,
                    "confidence": float(span.get("confidence", 1.0)),
                    "verified": True,
                }
            )

    protected_ranges: List[dict[str, Any]] = []
    cut_candidates: List[dict[str, Any]] = []
    for silence in clipped:
        protected = classify_protected_pause(silence, words)
        if protected:
            protected_ranges.append(protected)
        elif (
            int(silence["sourceEndMs"]) - int(silence["sourceStartMs"])
            >= CUT_MIN_SILENCE_MS
        ):
            cut_candidates.append(silence)

    voice_spans = build_voice_spans(words, silence_spans=clipped)
    timestamp_map = build_timestamp_map(
        selected_window={"sourceStartMs": window_start_ms, "sourceEndMs": window_end_ms},
        cut_ranges=cut_candidates,
        protected_ranges=protected_ranges,
    )

    return {
        "selectedWindow": {
            "sourceStartMs": window_start_ms,
            "sourceEndMs": window_end_ms,
        },
        "silenceSpans": clipped,
        "protectedRanges": protected_ranges,
        "cutCandidates": cut_candidates,
        "voiceSpans": voice_spans,
        "timestampMap": timestamp_map,
        "sourceDurationMs": source_duration_ms,
        "sourceWidth": source_width,
        "sourceHeight": source_height,
    }

