"""Silence-aware smart chunker.

Replaces the naive word-count chunker when an editorial timeline is available.
Produces chunks that:

* never split a protected rhetorical pause (a chunk boundary may land exactly
  on the pause, never inside it),
* stay inside a single voice span when spans are provided,
* otherwise fall back to the deterministic 3-word-priority / max-5 chunker.

Each chunk carries source ms + the mapped output ms so the final compose step
can burn typography at the right output time.
"""

from __future__ import annotations

from typing import Any, List, Optional

TARGET_CHUNK_WORDS = 3
MAX_CHUNK_WORDS = 5


def chunk_transcript_words(
    words: List[dict[str, Any]], max_chunk_words: int = MAX_CHUNK_WORDS
) -> List[dict[str, Any]]:
    """Deterministic greedy chunker (identical to the gateway)."""
    if not words:
        return []
    normalized = [
        {
            "text": str(word.get("text", "")).strip(),
            "start_ms": int(word.get("start_ms", word.get("start", 0))),
            "end_ms": max(
                int(word.get("end_ms", word.get("end", 0))),
                int(word.get("start_ms", word.get("start", 0))) + 1,
            ),
            "confidence": float(word.get("confidence", 1.0)),
        }
        for word in words
    ]
    chunks: List[dict[str, Any]] = []
    index = 0
    chunk_index = 1
    total = len(normalized)
    while index < total:
        remaining = total - index
        if remaining <= max_chunk_words:
            take = remaining
        else:
            take = TARGET_CHUNK_WORDS
            if remaining - take == 1 and take < max_chunk_words:
                take = min(take + 1, max_chunk_words)
        selected = normalized[index : index + take]
        index += take
        chunks.append(_chunk_from_words(selected, chunk_index))
        chunk_index += 1
    return chunks


def _chunk_from_words(words: List[dict[str, Any]], chunk_index: int) -> dict[str, Any]:
    start_ms = int(words[0]["start_ms"])
    end_ms = int(words[-1]["end_ms"])
    return {
        "chunkIndex": chunk_index,
        "startMs": start_ms,
        "endMs": end_ms,
        "startSec": round(start_ms / 1000.0, 3),
        "endSec": round(end_ms / 1000.0, 3),
        "wordCount": len(words),
        "text": " ".join(str(item["text"]) for item in words),
        "words": words,
    }

def _map_to_output(timestamp_map: List[dict[str, Any]], source_ms: int) -> Optional[int]:
    """Map a source ms into output ms via the timestamp map (None if cut)."""
    for segment in timestamp_map:
        if segment["sourceStartMs"] <= source_ms < segment["sourceEndMs"]:
            if segment["mode"] == "cut":
                return None
            return segment["outputStartMs"] + (source_ms - segment["sourceStartMs"])
    return None


def smart_chunk_words(
    words: List[dict[str, Any]],
    voice_spans: Optional[List[dict[str, Any]]] = None,
    protected_ranges: Optional[List[dict[str, Any]]] = None,
    timestamp_map: Optional[List[dict[str, Any]]] = None,
    target_words: int = TARGET_CHUNK_WORDS,
    max_chunk_words: int = MAX_CHUNK_WORDS,
) -> List[dict[str, Any]]:
    """Chunk the transcript with silence awareness.

    Protected pauses act as *hard* boundaries: a chunk never spans across one,
    because the silent beat belongs to the previous sentence. Voice spans are
    soft containers: chunking restarts at each span boundary.
    """
    if not words:
        return []
    normalized = [
        {
            "text": str(word.get("text", "")).strip(),
            "start_ms": int(word.get("start_ms", word.get("start", 0))),
            "end_ms": max(
                int(word.get("end_ms", word.get("end", 0))),
                int(word.get("start_ms", word.get("start", 0))) + 1,
            ),
            "confidence": float(word.get("confidence", 1.0)),
        }
        for word in words
    ]

    protected_boundaries = sorted(
        {int(prot["sourceStartMs"]) for prot in (protected_ranges or [])}
    )
    span_boundaries: set[int] = set()
    for span in voice_spans or []:
        span_boundaries.add(int(span["sourceStartMs"]))
        span_boundaries.add(int(span["sourceEndMs"]))

    def is_hard_boundary(word: dict[str, Any]) -> bool:
        return any(
            abs(int(word["start_ms"]) - boundary) <= 20 for boundary in protected_boundaries
        )

    def is_span_boundary(word: dict[str, Any]) -> bool:
        return any(abs(int(word["start_ms"]) - boundary) <= 20 for boundary in span_boundaries)

    runs: List[List[dict[str, Any]]] = [[]]
    for word in normalized:
        current = runs[-1]
        if current and (is_hard_boundary(word) or is_span_boundary(word)):
            runs.append([word])
        else:
            current.append(word)
    runs = [run for run in runs if run]

    chunks: List[dict[str, Any]] = []
    chunk_index = 1
    for run in runs:
        for sub_chunk in _greedy(run, target_words, max_chunk_words):
            sub_chunk["chunkIndex"] = chunk_index
            if timestamp_map:
                output_start_ms = _map_to_output(timestamp_map, sub_chunk["startMs"])
                output_end_ms = _map_to_output(
                    timestamp_map, max(sub_chunk["endMs"] - 1, sub_chunk["startMs"])
                )
                sub_chunk["outputStartMs"] = output_start_ms
                sub_chunk["outputEndMs"] = output_end_ms
            chunk_index += 1
            chunks.append(sub_chunk)
    return chunks


def _greedy(
    words: List[dict[str, Any]], target_words: int, max_chunk_words: int
) -> List[dict[str, Any]]:
    target = max(1, min(target_words, max_chunk_words))
    chunks: List[dict[str, Any]] = []
    index = 0
    total = len(words)
    while index < total:
        remaining = total - index
        if remaining <= max_chunk_words:
            take = remaining
        else:
            take = target
            if remaining - take == 1 and take < max_chunk_words:
                take = min(take + 1, max_chunk_words)
        chunks.append(_chunk_from_words(words[index : index + take], 0))
        index += take
    return chunks

