"""Approved Cloudflare R2 song selection and runway-aware arrangement."""

from __future__ import annotations

import random
import re
import secrets
import json
import math
import os
import subprocess
import urllib.request
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional


TOKEN_RE = re.compile(r"[a-z0-9]+")


def _r2_reference(reference: str) -> tuple[Optional[str], str]:
    value = reference.removeprefix("r2://")
    if reference.startswith("r2://"):
        bucket, separator, key = value.partition("/")
        if not separator or not bucket or not key:
            raise ValueError(f"Invalid R2 catalog reference: {reference}")
        return bucket, key
    return None, value


def _inventory_key_from_preview(preview: Dict[str, Any]) -> Optional[str]:
    source_name = Path(str(preview.get("src") or "")).name
    category, separator, file_name = source_name.partition("--")
    if not separator or not category or not file_name:
        return None
    return f"music-originals/{category}/{file_name}"


def _discover_r2_song_catalog(storage: Any, metadata_path: Path) -> Dict[str, Any]:
    bucket = str(getattr(storage, "music_bucket", None) or getattr(storage, "bucket", "")).strip()
    if not bucket:
        raise RuntimeError("Cloudflare music inventory discovery requires an R2 music bucket.")
    objects = storage.list_objects("music-originals/", bucket=bucket)
    audio_objects = [
        item for item in objects
        if int(item.get("Size", 0)) > 0 and Path(str(item.get("Key", ""))).suffix.lower() in {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}
    ]
    if not audio_objects:
        raise RuntimeError(f"Cloudflare bucket {bucket} has no songs under music-originals/.")

    previews: List[Dict[str, Any]] = []
    if metadata_path.is_file():
        parsed = json.loads(metadata_path.read_text(encoding="utf-8"))
        previews = parsed if isinstance(parsed, list) else []
    preview_by_key = {
        key: preview
        for preview in previews
        if (key := _inventory_key_from_preview(preview)) is not None
    }

    entries: List[Dict[str, Any]] = []
    for item in sorted(audio_objects, key=lambda value: str(value.get("Key", ""))):
        key = str(item["Key"])
        path = Path(key)
        category = path.parts[-2] if len(path.parts) > 1 else "other"
        track_slug = path.stem
        preview = preview_by_key.get(key, {})
        tags = [str(tag) for tag in (preview.get("tags") or [])]
        entries.append({
            "id": str(preview.get("id") or f"r2-{category}-{track_slug}"),
            "title": str(preview.get("label") or track_slug.replace("-", " ").title()),
            "artist": None,
            "category": category,
            "genreTags": tags or [token for token in category.split("-") if token],
            "moodTags": tags,
            "useCaseTags": [tag for tag in tags if tag in {"speech-friendly", "focused", "workflow", "underscore"}],
            "avoidWhen": [],
            "audioObjectKey": key,
            "bucket": bucket,
            "durationSec": preview.get("durationSeconds"),
            "renderAllowed": True,
            "commercialAllowed": True,
            "licenseVerified": True,
            "licenseType": "sanctioned_private_r2_music_originals",
            "approvalSource": "private_music_originals_inventory",
        })
    return {"artifactType": "r2_music_catalog", "version": "inventory-v1", "bucket": bucket, "entries": entries}


def load_song_catalog(
    reference: Optional[str] = None,
    *,
    storage: Any = None,
    metadata_path: Optional[Path] = None,
    env: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Load the approved catalog from a local file, HTTP URL, or R2 object."""
    environment = env if env is not None else os.environ
    reference = str(reference or environment.get("MUSIC_R2_CATALOG_PATH", "")).strip()
    if storage is None:
        from .storage import R2Storage

        storage = R2Storage(environment)
    if not reference:
        default_metadata = Path(__file__).resolve().parent.parent / "remotion-app" / "src" / "data" / "music.local.json"
        return _discover_r2_song_catalog(storage, Path(metadata_path or default_metadata))
    if reference.startswith(("http://", "https://")):
        with urllib.request.urlopen(reference, timeout=60) as response:
            catalog = json.loads(response.read().decode("utf-8"))
    else:
        local_path = Path(reference)
        if local_path.is_file():
            catalog = json.loads(local_path.read_text(encoding="utf-8"))
        else:
            bucket, key = _r2_reference(reference)
            catalog = storage.read_json(key, bucket=bucket)
    if not isinstance(catalog, dict) or not isinstance(catalog.get("entries"), list):
        raise RuntimeError("Music catalog must contain an entries array.")
    return catalog


def _safe_audio_name(track_id: str, object_key: str) -> str:
    suffix = Path(object_key.split("?", 1)[0]).suffix.lower()
    if suffix not in {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}:
        suffix = ".audio"
    stem = re.sub(r"[^a-zA-Z0-9._-]+", "-", track_id).strip("-") or "song"
    return f"{stem}{suffix}"


def _probe_audio_duration_ms(path: Path) -> int:
    completed = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path),
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if completed.returncode != 0:
        raise RuntimeError(f"Could not probe song duration for {path.name}: {completed.stderr.strip()}")
    try:
        duration_ms = int(float(completed.stdout.strip()) * 1000)
    except (TypeError, ValueError) as error:
        raise RuntimeError(f"Invalid song duration for {path.name}: {completed.stdout.strip()}") from error
    if duration_ms <= 0:
        raise RuntimeError(f"Song {path.name} has no positive audio runway.")
    return duration_ms


def _reflow_materialized_program(program: Dict[str, Any], events: List[Dict[str, Any]]) -> Dict[str, Any]:
    duration_ms = max(1, int(program.get("durationMs", 0)))
    existing_transitions = list(program.get("transitions") or [])
    crossfade_ms = int(program.get("crossfadeMs") or (
        existing_transitions[0].get("durationMs") if existing_transitions else 900
    ))
    crossfade_ms = max(250, min(3000, crossfade_ms))
    reflowed_events: List[Dict[str, Any]] = []
    reflowed_transitions: List[Dict[str, Any]] = []
    cursor_ms = 0

    for event in events:
        actual_duration_ms = max(1, int(event["actualDurationMs"]))
        timeline_start_ms = 0 if not reflowed_events else max(0, cursor_ms - crossfade_ms)
        timeline_end_ms = min(duration_ms, timeline_start_ms + actual_duration_ms)
        source_start_ms = max(0, int(event.get("sourceStartMs", 0)))
        reflowed_event = {
            **event,
            "timelineStartMs": timeline_start_ms,
            "timelineEndMs": timeline_end_ms,
            "sourceStartMs": source_start_ms,
            "sourceEndMs": source_start_ms + timeline_end_ms - timeline_start_ms,
        }
        if reflowed_events:
            previous = reflowed_events[-1]
            template = existing_transitions[len(reflowed_transitions)] if len(existing_transitions) > len(reflowed_transitions) else {}
            overlap_ms = max(0, previous["timelineEndMs"] - timeline_start_ms)
            reflowed_transitions.append({
                **template,
                "id": template.get("id") or f"song-transition-{len(reflowed_transitions) + 1}",
                "fromTrackId": previous["trackId"],
                "toTrackId": reflowed_event["trackId"],
                "startMs": timeline_start_ms,
                "durationMs": overlap_ms,
                "cause": {"gate": "song_runway_exhausted", "atMs": timeline_start_ms},
            })
        reflowed_events.append(reflowed_event)
        cursor_ms = timeline_end_ms
        if cursor_ms >= duration_ms:
            break

    if cursor_ms < duration_ms:
        raise RuntimeError(
            f"Materialized song runway ends at {cursor_ms}ms before the {duration_ms}ms render timeline."
        )
    return {**program, "events": reflowed_events, "transitions": reflowed_transitions}


def materialize_song_program(
    program: Dict[str, Any],
    *,
    storage: Any,
    cache_dir: str,
    duration_probe: Optional[Callable[[Path], int]] = None,
) -> Dict[str, Any]:
    """Download every planned R2 song and return a render-local programme."""
    destination_root = Path(cache_dir)
    destination_root.mkdir(parents=True, exist_ok=True)
    materialized = {**program, "events": []}
    probe = duration_probe or _probe_audio_duration_ms
    for event in program.get("events") or []:
        key = str(event.get("objectKey") or "").strip()
        bucket = str(event.get("bucket") or "").strip() or None
        if not key:
            raise RuntimeError(f"Song event {event.get('id')} has no R2 object key.")
        destination = destination_root / _safe_audio_name(str(event.get("trackId", "song")), key)
        storage.download_file(key, str(destination), bucket=bucket)
        if not destination.is_file() or destination.stat().st_size <= 0:
            raise RuntimeError(f"Song event {event.get('id')} did not materialize readable audio.")
        materialized["events"].append({
            **event,
            "localPath": str(destination),
            "actualDurationMs": probe(destination),
        })
    return _reflow_materialized_program(materialized, materialized["events"])


COMMON_SONG_STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
    "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from",
    "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
    "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself",
    "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off",
    "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over",
    "own", "same", "she", "should", "so", "some", "such", "than", "that", "the",
    "their", "theirs", "them", "themselves", "then", "there", "these", "they",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was",
    "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why",
    "with", "would", "you", "your", "yours", "yourself", "yourselves", "way", "get", "got",
    "like", "one", "two", "see", "say", "said", "know", "go", "make", "think", "take"
}


def _tokens(values: Iterable[Any]) -> set[str]:
    return {
        token
        for value in values
        for token in TOKEN_RE.findall(str(value).lower())
        if len(token) >= 2 and token not in COMMON_SONG_STOPWORDS
    }


def _approved(track: Dict[str, Any]) -> bool:
    try:
        duration_sec = float(track.get("durationSec"))
    except (TypeError, ValueError):
        return False
    return bool(
        track.get("renderAllowed")
        and track.get("commercialAllowed")
        and track.get("licenseVerified")
        and str(track.get("audioObjectKey") or "").strip()
        and math.isfinite(duration_sec)
        and duration_sec > 0
    )


def _track_tokens(track: Dict[str, Any]) -> set[str]:
    return _tokens([
        track.get("title", ""),
        track.get("category", ""),
        *(track.get("genreTags") or []),
        *(track.get("moodTags") or []),
        *(track.get("useCaseTags") or []),
    ])


def _score(track: Dict[str, Any], transcript_tokens: set[str]) -> tuple[float, List[str]]:
    tags = _track_tokens(track)
    overlap = sorted(tags & transcript_tokens)
    avoided = sorted(_tokens(track.get("avoidWhen") or []) & transcript_tokens)
    speech_friendly = bool(tags & {"speech", "friendly", "underscore", "instrumental", "focused"})
    score = len(overlap) * 0.35 + (0.15 if speech_friendly else 0.0) - len(avoided) * 0.5
    evidence: List[str] = []
    if overlap:
        evidence.append(f"Catalog metadata matched: {', '.join(overlap[:8])}.")
    if speech_friendly:
        evidence.append("Catalog metadata marks the track as speech-supportive.")
    if avoided:
        evidence.append(f"Avoidance metadata penalized: {', '.join(avoided[:8])}.")
    if not evidence:
        evidence.append("Eligible catalog fallback with no strong semantic collision.")
    return round(score, 3), evidence


def _compatibility(left: Dict[str, Any], right: Dict[str, Any]) -> float:
    left_tags = _track_tokens(left)
    right_tags = _track_tokens(right)
    union = left_tags | right_tags
    return len(left_tags & right_tags) / len(union) if union else 0.0


def plan_song_program(
    *,
    catalog: Any,
    chunks: List[Dict[str, Any]],
    duration_ms: int,
    design: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Select approved songs and introduce a handoff only when runway requires it."""
    design = dict(design or {})
    entries = catalog.get("entries", []) if isinstance(catalog, dict) else list(catalog or [])
    approved = [dict(track) for track in entries if _approved(track)]
    if not approved:
        raise RuntimeError("No render-approved Cloudflare R2 songs are available.")

    nonce = str(design.get("seed") or secrets.token_hex(24))
    rng = random.Random(nonce)
    transcript_tokens = _tokens(chunk.get("text", "") for chunk in chunks)
    scored = []
    for track in approved:
        score, evidence = _score(track, transcript_tokens)
        scored.append({"track": track, "score": score, "evidence": evidence})

    requested_track_id = str(design.get("songTrackId", "")).strip()

    duration_ms = max(1, int(duration_ms))
    crossfade_ms = max(250, min(3000, int(design.get("songCrossfadeMs", 900))))
    events: List[Dict[str, Any]] = []
    transitions: List[Dict[str, Any]] = []
    used: set[str] = set()
    cursor_ms = 0
    previous_track: Optional[Dict[str, Any]] = None

    while cursor_ms < duration_ms:
        candidates = [item for item in scored if item["track"]["id"] not in used]
        if not candidates:
            raise RuntimeError("Approved song catalog cannot cover the requested duration without replaying a track.")

        if requested_track_id and not events:
            requested = next((item for item in candidates if item["track"]["id"] == requested_track_id), None)
            if requested is None:
                raise RuntimeError(f"Requested song {requested_track_id} is missing or not render-approved.")
            selected = requested
        else:
            if previous_track is not None:
                for c in candidates:
                    c["effective_score"] = c["score"] + _compatibility(previous_track, c["track"]) * 0.35
                candidates.sort(key=lambda item: item["effective_score"], reverse=True)
            else:
                for c in candidates:
                    c["effective_score"] = c["score"]
                candidates.sort(key=lambda item: item["effective_score"], reverse=True)

            # Probabilistic selection with temperature across top-tier candidates
            top_candidates = candidates[:max(1, min(15, len(candidates)))]
            best_score = top_candidates[0]["effective_score"]
            if len(top_candidates) > 1 and (best_score - top_candidates[1]["effective_score"] >= 0.15):
                selected = top_candidates[0]
            else:
                eligible = [c for c in top_candidates if best_score - c["effective_score"] <= 0.40]
                min_score = min(c["effective_score"] for c in eligible)
                weights = [math.exp(max(-4.0, min(4.0, (c["effective_score"] - min_score) * 2.0))) for c in eligible]
                total_weight = sum(weights)
                pick = rng.uniform(0, total_weight)
                cum = 0.0
                selected = eligible[0]
                for c, w in zip(eligible, weights):
                    cum += w
                    if cum >= pick:
                        selected = c
                        break

        track = selected["track"]
        used.add(track["id"])
        runway_ms = max(1, int(float(track.get("durationSec") or 0) * 1000))
        timeline_start = 0 if not events else max(0, cursor_ms - crossfade_ms)
        timeline_end = min(duration_ms, timeline_start + runway_ms)
        event = {
            "id": f"song-{len(events) + 1}",
            "trackId": track["id"],
            "title": track.get("title"),
            "artist": track.get("artist"),
            "bucket": track.get("bucket"),
            "objectKey": track.get("audioObjectKey"),
            "timelineStartMs": timeline_start,
            "timelineEndMs": timeline_end,
            "sourceStartMs": 0,
            "sourceEndMs": timeline_end - timeline_start,
            "selectionScore": selected["score"],
            "selectionEvidence": selected["evidence"],
            "approval": {
                "renderAllowed": bool(track.get("renderAllowed")),
                "commercialAllowed": bool(track.get("commercialAllowed")),
                "licenseVerified": bool(track.get("licenseVerified")),
                "licenseType": track.get("licenseType"),
            },
        }
        if events:
            previous = events[-1]
            overlap = previous["timelineEndMs"] - timeline_start
            transitions.append({
                "id": f"song-transition-{len(transitions) + 1}",
                "fromTrackId": previous["trackId"],
                "toTrackId": track["id"],
                "startMs": timeline_start,
                "durationMs": overlap,
                "compatibilityScore": round(_compatibility(previous_track or {}, track), 3),
                "cause": {"gate": "song_runway_exhausted", "atMs": timeline_start},
            })
        events.append(event)
        cursor_ms = timeline_end
        previous_track = track

    return {
        "version": "1.0",
        "selectionMode": "entropy",
        "selectionNonce": nonce,
        "durationMs": duration_ms,
        "crossfadeMs": crossfade_ms,
        "baseGainDb": float(design.get("songGainDb", -18.0)),
        "dialogueDucking": {
            "mode": "sidechain",
            "threshold": 0.02,
            "ratio": 8.0,
            "attackMs": 20,
            "releaseMs": 350,
        },
        "events": events,
        "transitions": transitions,
    }
