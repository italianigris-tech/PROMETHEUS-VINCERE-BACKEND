from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ASSEMBLYAI_API_BASE = "https://api.assemblyai.com/v2"


def build_assemblyai_transcript_evidence(
    video_id: str,
    audit: dict[str, Any],
    wav_path: object,
    *,
    assemblyai_api_key: str | None,
    poll_seconds: float,
    timeout_seconds: float,
    assemblyai_request=None,
) -> dict[str, Any]:
    assemblyai_request = assemblyai_request or assemblyai_http_request
    if not assemblyai_api_key:
        return transcript_placeholder(video_id, audit, "assemblyai_not_configured")
    if not isinstance(wav_path, str) or not Path(wav_path).exists():
        return transcript_placeholder(video_id, audit, "audio_wav_unavailable")

    try:
        return _run_assemblyai_transcription(
            video_id,
            audit,
            Path(wav_path),
            assemblyai_api_key=assemblyai_api_key,
            poll_seconds=poll_seconds,
            timeout_seconds=timeout_seconds,
            assemblyai_request=assemblyai_request,
        )
    except Exception as exc:
        return transcript_placeholder(
            video_id,
            audit,
            f"assemblyai_transcription_failed:{type(exc).__name__}: {exc}",
        )


def _run_assemblyai_transcription(
    video_id: str,
    audit: dict[str, Any],
    wav_path: Path,
    *,
    assemblyai_api_key: str,
    poll_seconds: float,
    timeout_seconds: float,
    assemblyai_request,
) -> dict[str, Any]:
    upload = assemblyai_request("POST", f"{ASSEMBLYAI_API_BASE}/upload", api_key=assemblyai_api_key, file_path=wav_path)
    audio_url = upload.get("upload_url")
    if not isinstance(audio_url, str) or not audio_url:
        raise ValueError("AssemblyAI upload response missing upload_url")

    submitted = assemblyai_request(
        "POST",
        f"{ASSEMBLYAI_API_BASE}/transcript",
        api_key=assemblyai_api_key,
        json_body={"audio_url": audio_url},
    )
    transcript_id = submitted.get("id")
    if not isinstance(transcript_id, str) or not transcript_id:
        raise ValueError("AssemblyAI transcript response missing id")

    deadline = time.monotonic() + max(0.0, timeout_seconds)
    payload = submitted
    while payload.get("status") not in {"completed", "error", "failed"}:
        if time.monotonic() >= deadline:
            return transcript_placeholder(
                video_id,
                audit,
                f"assemblyai_transcription_timeout:{transcript_id}",
                source="assemblyai",
                status="timeout",
                transcript_id=transcript_id,
            )
        if poll_seconds > 0:
            time.sleep(poll_seconds)
        payload = assemblyai_request("GET", f"{ASSEMBLYAI_API_BASE}/transcript/{transcript_id}", api_key=assemblyai_api_key)

    status = str(payload.get("status", "unknown"))
    if status != "completed":
        detail = str(payload.get("error") or status)
        return transcript_placeholder(
            video_id,
            audit,
            f"assemblyai_transcription_failed:{detail}",
            source="assemblyai",
            status=status,
            transcript_id=transcript_id,
        )

    return {
        "schema_version": "transcript-evidence-v1",
        "video_id": video_id,
        "source": "assemblyai",
        "title": audit.get("title"),
        "transcript_id": transcript_id,
        "status": status,
        "text": str(payload.get("text") or ""),
        "segments": assemblyai_segments(payload),
        "words": assemblyai_words(payload),
        "confidence": optional_number(payload.get("confidence")),
        "warnings": [],
        "trainable": True,
    }


def transcript_placeholder(
    video_id: str,
    audit: dict[str, Any],
    warning: str,
    *,
    source: str = "assemblyai_not_run",
    status: str = "not_run",
    transcript_id: str | None = None,
) -> dict[str, Any]:
    return {
        "schema_version": "transcript-evidence-v1",
        "video_id": video_id,
        "source": source,
        "title": audit.get("title"),
        "transcript_id": transcript_id,
        "status": status,
        "text": "",
        "segments": [],
        "words": [],
        "warnings": [warning],
        "trainable": False,
    }


def assemblyai_http_request(
    method: str,
    url: str,
    *,
    api_key: str,
    json_body: dict[str, Any] | None = None,
    file_path: str | Path | None = None,
) -> dict[str, Any]:
    headers = {"authorization": api_key}
    data = None
    if file_path is not None:
        headers["content-type"] = "application/octet-stream"
        data = Path(file_path).read_bytes()
    elif json_body is not None:
        headers["content-type"] = "application/json"
        data = json.dumps(json_body).encode("utf-8")

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:240]
        raise RuntimeError(f"AssemblyAI HTTP {exc.code}: {detail}") from exc


def assemblyai_segments(payload: dict[str, Any]) -> list[dict[str, Any]]:
    segments = []
    for segment in payload.get("utterances") or []:
        if not isinstance(segment, dict):
            continue
        normalized = {
            "text": str(segment.get("text") or ""),
            "start_seconds": ms_to_seconds(segment.get("start")),
            "end_seconds": ms_to_seconds(segment.get("end")),
        }
        confidence = optional_number(segment.get("confidence"))
        if confidence is not None:
            normalized["confidence"] = confidence
        segments.append(normalized)
    if segments:
        return segments

    words = assemblyai_words(payload)
    if not words:
        return []
    return [{
        "text": str(payload.get("text") or " ".join(word["text"] for word in words)),
        "start_seconds": words[0]["start_seconds"],
        "end_seconds": words[-1]["end_seconds"],
    }]


def assemblyai_words(payload: dict[str, Any]) -> list[dict[str, Any]]:
    words = []
    for word in payload.get("words") or []:
        if not isinstance(word, dict):
            continue
        text = str(word.get("text") or "").strip()
        if not text:
            continue
        normalized = {
            "text": text,
            "start_seconds": ms_to_seconds(word.get("start")),
            "end_seconds": ms_to_seconds(word.get("end")),
        }
        confidence = optional_number(word.get("confidence"))
        if confidence is not None:
            normalized["confidence"] = confidence
        words.append(normalized)
    return words


def ms_to_seconds(value: object) -> float:
    number = optional_number(value)
    return round((number or 0.0) / 1000.0, 6)


def optional_number(value: object) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None
