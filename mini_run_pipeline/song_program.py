"""Approved Cloudflare R2 song selection and runway-aware arrangement."""

from __future__ import annotations

import random
import re
import secrets
import json
import os
import urllib.request
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


TOKEN_RE = re.compile(r"[a-z0-9]+")


def _r2_reference(reference: str) -> tuple[Optional[str], str]:
    value = reference.removeprefix("r2://")
    if reference.startswith("r2://"):
        bucket, separator, key = value.partition("/")
        if not separator or not bucket or not key:
            raise ValueError(f"Invalid R2 catalog reference: {reference}")
        return bucket, key
    return None, value


def load_song_catalog(reference: Optional[str] = None, *, storage: Any = None) -> Dict[str, Any]:
    """Load the approved catalog from a local file, HTTP URL, or R2 object."""
    reference = str(reference or os.getenv("MUSIC_R2_CATALOG_PATH", "")).strip()
    if not reference:
        raise RuntimeError("MUSIC_R2_CATALOG_PATH is required for automatic song selection.")
    if reference.startswith(("http://", "https://")):
        with urllib.request.urlopen(reference, timeout=60) as response:
            catalog = json.loads(response.read().decode("utf-8"))
    else:
        local_path = Path(reference)
        if local_path.is_file():
            catalog = json.loads(local_path.read_text(encoding="utf-8"))
        else:
            if storage is None:
                from .storage import R2Storage

                storage = R2Storage()
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


def materialize_song_program(program: Dict[str, Any], *, storage: Any, cache_dir: str) -> Dict[str, Any]:
    """Download every planned R2 song and return a render-local programme."""
    destination_root = Path(cache_dir)
    destination_root.mkdir(parents=True, exist_ok=True)
    materialized = {**program, "events": []}
    for event in program.get("events") or []:
        key = str(event.get("objectKey") or "").strip()
        bucket = str(event.get("bucket") or "").strip() or None
        if not key:
            raise RuntimeError(f"Song event {event.get('id')} has no R2 object key.")
        destination = destination_root / _safe_audio_name(str(event.get("trackId", "song")), key)
        storage.download_file(key, str(destination), bucket=bucket)
        if not destination.is_file() or destination.stat().st_size <= 0:
            raise RuntimeError(f"Song event {event.get('id')} did not materialize readable audio.")
        materialized["events"].append({**event, "localPath": str(destination)})
    return materialized


def _tokens(values: Iterable[Any]) -> set[str]:
    return {
        token
        for value in values
        for token in TOKEN_RE.findall(str(value).lower())
        if len(token) > 1
    }


def _approved(track: Dict[str, Any]) -> bool:
    return bool(track.get("renderAllowed") and track.get("commercialAllowed") and track.get("licenseVerified"))


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
    score = len(overlap) * 0.22 + (0.12 if speech_friendly else 0.0) - len(avoided) * 0.4
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

    nonce = secrets.token_hex(24)
    rng = random.Random(nonce)
    transcript_tokens = _tokens(chunk.get("text", "") for chunk in chunks)
    ranked = []
    for track in approved:
        score, evidence = _score(track, transcript_tokens)
        ranked.append({"track": track, "score": score, "evidence": evidence, "jitter": rng.random() * 0.035})
    ranked.sort(key=lambda item: (item["score"] + item["jitter"], item["track"]["id"]), reverse=True)

    requested_track_id = str(design.get("songTrackId", "")).strip()
    if requested_track_id:
        requested = next((item for item in ranked if item["track"]["id"] == requested_track_id), None)
        if requested is None:
            raise RuntimeError(f"Requested song {requested_track_id} is missing or not render-approved.")
        ranked.remove(requested)
        ranked.insert(0, requested)

    duration_ms = max(1, int(duration_ms))
    crossfade_ms = max(250, min(3000, int(design.get("songCrossfadeMs", 900))))
    events: List[Dict[str, Any]] = []
    transitions: List[Dict[str, Any]] = []
    used: set[str] = set()
    cursor_ms = 0
    previous_track: Optional[Dict[str, Any]] = None

    while cursor_ms < duration_ms:
        candidates = [item for item in ranked if item["track"]["id"] not in used]
        if not candidates:
            raise RuntimeError("Approved song catalog cannot cover the requested duration without replaying a track.")
        if previous_track is not None:
            candidates.sort(
                key=lambda item: (
                    item["score"] + _compatibility(previous_track, item["track"]) * 0.35 + item["jitter"],
                    item["track"]["id"],
                ),
                reverse=True,
            )
        selected = candidates[0]
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
