from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parents[1]
sys.path.insert(0, str(ROOT))

from prepare_joseph_kaggle_dataset import build_references  # noqa: E402
from trajectory_extractor.audio_artifacts import (  # noqa: E402
    build_fallback_audio_artifact,
    build_wav_audio_artifact,
)
from trajectory_extractor.assemblyai_transcripts import build_assemblyai_transcript_evidence  # noqa: E402

ARTIFACT_CONTRACT_VERSION = "joseph-evidence-artifacts-v1"
LOCAL_EXTRACTOR_VERSION = "local-evidence-0.1.0"
FEATURE_VERSION = "trajectory-features-v1"


def run_local_extraction(
    output_dir: str | Path,
    *,
    reference_ids: set[str] | None = None,
    limit: int | None = None,
    ffmpeg_binary: str = "ffmpeg",
    ffprobe_binary: str = "ffprobe",
    assemblyai_api_key: str | None = None,
    assemblyai_poll_seconds: float = 3.0,
    assemblyai_timeout_seconds: float = 900.0,
) -> dict[str, Any]:
    """Emit the Joseph evidence artifact contract from local/API extraction."""
    output_root = Path(output_dir)
    output_root.mkdir(parents=True, exist_ok=True)

    kx = _load_kaggle_extractor_module()
    references = build_references()
    if reference_ids:
        references = [reference for reference in references if reference.reference_id in reference_ids]
    if limit is not None:
        references = references[:limit]
    if not references:
        raise ValueError("no Joseph references selected")

    generated_at = datetime.now(timezone.utc).isoformat()
    artifact_index: dict[str, Any] = {
        "schema_version": ARTIFACT_CONTRACT_VERSION,
        "extractor_version": LOCAL_EXTRACTOR_VERSION,
        "feature_version": FEATURE_VERSION,
        "generated_at_utc": generated_at,
        "producer": "local_ffmpeg_api",
        "training_gate": "validate_locally_before_irl_training",
        "required_artifacts": [
            "trajectory",
            "audio_artifact",
            "text_evidence",
            "frame_evidence",
            "motion_cut_evidence",
        ],
        "optional_artifacts": [
            "waveform_png",
            "transcript_evidence",
        ],
        "videos": [],
        "failures": [],
    }

    for reference in references:
        try:
            audit = _read_json(reference.audit_events_path)
            events = list(audit.get("events", []))
            video_path = reference.video_path
            _require_file(video_path)
            _require_file(reference.audit_events_path)

            meta = _probe_media(video_path, ffprobe_binary, audit)
            source_hash = kx.file_hash(str(video_path))
            video_id = reference.reference_id
            audio_artifact, audio_aux = _build_local_audio_artifact(
                video_path,
                output_root,
                video_id,
                source_hash,
                meta,
                ffmpeg_binary,
            )
            sparse_windows = _trajectory_window_indices(events, meta["duration_seconds"])
            trajectory = kx.extract_trajectory(
                str(video_path),
                video_id=video_id,
                audio_artifact=audio_artifact,
                window_indices=sparse_windows,
                scene_starts=[],
                frame_sample_count=2,
            )

            trajectory_path = output_root / f"{video_id}.trajectory.json"
            audio_path = output_root / "audio-artifacts" / f"{video_id}.audio-artifact.json"
            text_path = output_root / "text-evidence" / f"{video_id}.text-evidence.json"
            frame_path = output_root / "frame-evidence" / video_id / "frame-evidence.json"
            motion_path = output_root / "motion-cut-evidence" / f"{video_id}.motion-cut-evidence.json"
            transcript_path = output_root / "transcript-evidence" / f"{video_id}.transcript-evidence.json"

            frame_evidence = _write_ffmpeg_frame_evidence(
                video_path,
                video_id,
                events,
                output_root,
                ffmpeg_binary,
            )
            text_evidence = kx.build_text_evidence(str(video_path), video_id, events)
            motion_evidence = _build_ffmpeg_motion_cut_evidence(
                video_path,
                video_id,
                events,
                ffmpeg_binary,
            )
            transcript_evidence = _build_transcript_evidence(
                video_id,
                audit,
                audio_aux.get("wav_path"),
                assemblyai_api_key=assemblyai_api_key,
                poll_seconds=assemblyai_poll_seconds,
                timeout_seconds=assemblyai_timeout_seconds,
            )

            _write_json(trajectory_path, trajectory.model_dump())
            _write_json(audio_path, audio_artifact)
            _write_json(text_path, text_evidence)
            _write_json(frame_path, frame_evidence)
            _write_json(motion_path, motion_evidence)
            _write_json(transcript_path, transcript_evidence)

            artifacts = {
                "trajectory": _rel(trajectory_path, output_root),
                "audio_artifact": _rel(audio_path, output_root),
                "text_evidence": _rel(text_path, output_root),
                "frame_evidence": _rel(frame_path, output_root),
                "motion_cut_evidence": _rel(motion_path, output_root),
                "transcript_evidence": _rel(transcript_path, output_root),
            }
            if audio_aux.get("waveform_png"):
                artifacts["waveform_png"] = _rel(Path(audio_aux["waveform_png"]), output_root)

            warnings = []
            warnings.extend(audio_artifact.get("warnings", []))
            warnings.extend(audio_aux.get("warnings", []))
            warnings.extend(text_evidence.get("warnings", []))
            warnings.extend(frame_evidence.get("warnings", []))
            warnings.extend(motion_evidence.get("warnings", []))
            warnings.extend(transcript_evidence.get("warnings", []))

            artifact_index["videos"].append(
                {
                    "video_id": video_id,
                    "reference_id": reference.reference_id,
                    "source_hash": source_hash,
                    "feature_version": FEATURE_VERSION,
                    "extractor_version": LOCAL_EXTRACTOR_VERSION,
                    "source_video_path": str(video_path),
                    "audit_events_path": str(reference.audit_events_path),
                    "audit_event_count": len(events),
                    "duration_seconds": meta["duration_seconds"],
                    "fps": meta["fps"],
                    "resolution": meta["resolution"],
                    "artifacts": artifacts,
                    "warnings": sorted(set(warnings)),
                }
            )
        except Exception as exc:
            artifact_index["failures"].append(
                {
                    "video_id": reference.reference_id,
                    "source_video_path": str(reference.video_path),
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )

    failure_path = output_root / "extraction-failures.json"
    index_path = output_root / "artifact-index.json"
    _write_json(
        failure_path,
        {
            "schema_version": "local-extraction-failures-v1",
            "generated_at_utc": generated_at,
            "failure_count": len(artifact_index["failures"]),
            "failures": artifact_index["failures"],
        },
    )
    artifact_index["failure_report"] = _rel(failure_path, output_root)
    _write_json(index_path, artifact_index)
    return artifact_index


def _load_kaggle_extractor_module():
    spec = importlib.util.spec_from_file_location("local_contract_extractor", ROOT / "kaggle_extract.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load kaggle_extract.py module")
    module = importlib.util.module_from_spec(spec)
    sys.modules["local_contract_extractor"] = module
    spec.loader.exec_module(module)
    return module


def _build_local_audio_artifact(
    video_path: Path,
    output_root: Path,
    video_id: str,
    source_hash: str,
    meta: dict[str, Any],
    ffmpeg_binary: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    aux: dict[str, Any] = {"warnings": []}
    wav_path = output_root / "audio-wav" / f"{video_id}.wav"
    waveform_path = output_root / "audio-waveforms" / f"{video_id}.waveform.png"
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    waveform_path.parent.mkdir(parents=True, exist_ok=True)

    wav_result = _run(
        [
            ffmpeg_binary,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(video_path),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "22050",
            "-sample_fmt",
            "s16",
            str(wav_path),
        ]
    )
    if wav_result.returncode != 0 or not wav_path.exists():
        artifact = build_fallback_audio_artifact(
            source_hash=source_hash,
            duration_seconds=max(float(meta["duration_seconds"]), 0.001),
        )
        artifact["warnings"].append("ffmpeg_audio_decode_failed")
        aux["warnings"].append(_stderr_warning("ffmpeg_audio_decode_failed", wav_result))
        return artifact, aux

    artifact = build_wav_audio_artifact(source_hash=source_hash, wav_path=wav_path)
    aux["wav_path"] = str(wav_path)
    waveform_result = _run(
        [
            ffmpeg_binary,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(wav_path),
            "-filter_complex",
            "showwavespic=s=1200x240:colors=white",
            "-frames:v",
            "1",
            str(waveform_path),
        ]
    )
    if waveform_result.returncode == 0 and waveform_path.exists():
        aux["waveform_png"] = str(waveform_path)
    else:
        aux["warnings"].append(_stderr_warning("ffmpeg_waveform_failed", waveform_result))
    return artifact, aux


def _write_ffmpeg_frame_evidence(
    video_path: Path,
    video_id: str,
    events: list[dict[str, Any]],
    output_root: Path,
    ffmpeg_binary: str,
) -> dict[str, Any]:
    frames_dir = output_root / "frame-evidence" / video_id / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    frames = []
    failures = []
    for event_index, event in _limited_events(events):
        start, end, midpoint = _event_time_span(event)
        target = frames_dir / f"event-{event_index:03d}-{midpoint:.3f}s.jpg"
        result = _run(
            [
                ffmpeg_binary,
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-ss",
                f"{midpoint:.6f}",
                "-i",
                str(video_path),
                "-frames:v",
                "1",
                "-q:v",
                "2",
                str(target),
            ]
        )
        if result.returncode == 0 and target.exists():
            frames.append(
                {
                    "event_index": event_index,
                    "start_seconds": start,
                    "end_seconds": end,
                    "sample_seconds": midpoint,
                    "path": _rel(target, output_root),
                    "source": "ffmpeg",
                }
            )
        else:
            failures.append(
                {
                    "event_index": event_index,
                    "time_seconds": midpoint,
                    "reason": _stderr_warning("ffmpeg_frame_extract_failed", result),
                }
            )

    warnings = []
    if not events:
        warnings.append("no_audit_events_matched_video")
    if failures:
        warnings.append("some_frame_grabs_failed")
    return {
        "schema_version": "frame-evidence-v1",
        "video_id": video_id,
        "source_video_path": str(video_path),
        "frame_count": len(frames),
        "frames": frames,
        "failures": failures,
        "warnings": warnings,
    }


def _build_ffmpeg_motion_cut_evidence(
    video_path: Path,
    video_id: str,
    events: list[dict[str, Any]],
    ffmpeg_binary: str,
    *,
    scene_threshold: float = 0.35,
) -> dict[str, Any]:
    warnings = []
    scene_times: list[float] = []
    audit_windows = []
    failures = []

    for event_index, event in _limited_events(events):
        start, end, midpoint = _event_time_span(event)
        clip_duration = min(max(end - start, 1.0), 4.0)
        clip_start = max(0.0, midpoint - (clip_duration / 2.0))
        result = _run(
            [
                ffmpeg_binary,
                "-hide_banner",
                "-loglevel",
                "info",
                "-ss",
                f"{clip_start:.6f}",
                "-t",
                f"{clip_duration:.6f}",
                "-i",
                str(video_path),
                "-vf",
                f"select=gt(scene\\,{scene_threshold}),showinfo",
                "-an",
                "-f",
                "null",
                "-",
            ]
        )
        local_times = _parse_showinfo_scene_times(result.stderr)
        global_times = [round(clip_start + local_time, 6) for local_time in local_times]
        scene_times.extend(global_times)
        if result.returncode != 0:
            failures.append(
                {
                    "event_index": event_index,
                    "sample_seconds": midpoint,
                    "reason": _stderr_warning("ffmpeg_scene_detection_failed", result),
                }
            )
        audit_windows.append(
            {
                "event_index": event_index,
                "start_seconds": start,
                "end_seconds": end,
                "sample_seconds": midpoint,
                "scan_start_seconds": round(clip_start, 6),
                "scan_end_seconds": round(clip_start + clip_duration, 6),
                "scene_cut_count": len(global_times),
                "cut_seconds": global_times,
            }
        )

    deduped_scene_times = sorted(set(scene_times))
    if not events:
        warnings.append("no_audit_events_matched_video")
    if failures:
        warnings.append("some_motion_cut_scans_failed")
    if not deduped_scene_times:
        warnings.append("no_scene_cuts_detected_in_audit_windows_or_scene_detection_unavailable")
    return {
        "schema_version": "motion-cut-evidence-v1",
        "video_id": video_id,
        "source_video_path": str(video_path),
        "scene_detector": "ffmpeg_scene_select_showinfo_audit_windows",
        "scene_threshold": scene_threshold,
        "scene_count": len(deduped_scene_times),
        "scenes": [{"cut_seconds": time} for time in deduped_scene_times],
        "audit_windows": audit_windows,
        "failures": failures,
        "warnings": warnings,
    }


def _build_transcript_evidence(
    video_id: str,
    audit: dict[str, Any],
    wav_path: object,
    *,
    assemblyai_api_key: str | None,
    poll_seconds: float,
    timeout_seconds: float,
    assemblyai_request=None,
) -> dict[str, Any]:
    return build_assemblyai_transcript_evidence(
        video_id,
        audit,
        wav_path,
        assemblyai_api_key=assemblyai_api_key,
        poll_seconds=poll_seconds,
        timeout_seconds=timeout_seconds,
        assemblyai_request=assemblyai_request,
    )


def _build_transcript_placeholder(video_id: str, audit: dict[str, Any], warning: str) -> dict[str, Any]:
    return {
        "schema_version": "transcript-evidence-v1",
        "video_id": video_id,
        "source": "assemblyai_not_run",
        "title": audit.get("title"),
        "segments": [],
        "warnings": [warning],
    }


def _probe_media(video_path: Path, ffprobe_binary: str, audit: dict[str, Any]) -> dict[str, Any]:
    result = _run(
        [
            ffprobe_binary,
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(video_path),
        ]
    )
    if result.returncode == 0 and result.stdout.strip():
        payload = json.loads(result.stdout)
        video_stream = next((stream for stream in payload.get("streams", []) if stream.get("codec_type") == "video"), {})
        fps = _parse_rate(video_stream.get("avg_frame_rate")) or _parse_rate(video_stream.get("r_frame_rate")) or 30.0
        duration = float(payload.get("format", {}).get("duration") or video_stream.get("duration") or 0.0)
        width = int(video_stream.get("width") or 0)
        height = int(video_stream.get("height") or 0)
        return {
            "duration_seconds": round(duration, 6),
            "fps": fps,
            "frame_count": max(1, round(duration * fps)),
            "resolution": f"{width}x{height}" if width and height else "unknown",
        }

    verified = audit.get("verifiedMedia", {})
    duration = float(verified.get("durationSeconds") or 1.0)
    fps = float(verified.get("fps") or 30.0)
    width = int(verified.get("width") or 0)
    height = int(verified.get("height") or 0)
    return {
        "duration_seconds": round(duration, 6),
        "fps": fps,
        "frame_count": max(1, round(duration * fps)),
        "resolution": f"{width}x{height}" if width and height else "unknown",
    }


def _parse_showinfo_scene_times(stderr: str) -> list[float]:
    values = []
    for match in re.finditer(r"pts_time:([0-9]+(?:\.[0-9]+)?)", stderr):
        value = round(float(match.group(1)), 6)
        if value not in values:
            values.append(value)
    return values


def _parse_rate(value: object) -> float | None:
    if not isinstance(value, str) or not value or value == "0/0":
        return None
    if "/" in value:
        left, right = value.split("/", 1)
        denominator = float(right)
        if denominator == 0:
            return None
        return float(left) / denominator
    return float(value)


def _limited_events(events: list[dict[str, Any]]) -> list[tuple[int, dict[str, Any]]]:
    limit = 40
    return list(enumerate(events[:limit]))


def _trajectory_window_indices(
    events: list[dict[str, Any]],
    duration_seconds: float,
    *,
    context_radius: int | None = None,
) -> list[int]:
    total_windows = max(1, int(float(duration_seconds)))
    selected = {0, max(0, total_windows - 1)}
    if context_radius is None:
        context_radius = int(os.environ.get("PROMETHEUS_TRAJECTORY_CONTEXT_RADIUS", "0"))
    context_radius = max(0, int(context_radius))
    for _, event in _limited_events(events):
        _, _, midpoint = _event_time_span(event)
        center = min(total_windows - 1, int(max(0.0, midpoint)))
        selected.update(center + offset for offset in range(-context_radius, context_radius + 1))
    return sorted(index for index in selected if 0 <= index < total_windows)


def _event_time_span(event: dict[str, Any]) -> tuple[float, float, float]:
    raw = event.get("timeSeconds", 0.0)
    if isinstance(raw, list) and raw:
        start = float(raw[0])
        end = float(raw[-1]) if len(raw) > 1 else start
    else:
        start = float(raw)
        end = start
    if end < start:
        start, end = end, start
    midpoint = start + ((end - start) / 2.0)
    return round(start, 6), round(end, 6), round(midpoint, 6)


def _run(args: list[str]) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(args, capture_output=True, text=True, check=False)
    except FileNotFoundError as exc:
        return subprocess.CompletedProcess(args, 127, "", str(exc))


def _stderr_warning(prefix: str, result: subprocess.CompletedProcess[str]) -> str:
    text = (result.stderr or result.stdout or "").strip().splitlines()
    detail = text[-1] if text else f"exit_{result.returncode}"
    return f"{prefix}:{detail[:240]}"


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _require_file(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"required file not found: {path}")


def _rel(path: Path, root: Path) -> str:
    return str(path.relative_to(root))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run local-first Joseph evidence artifact extraction.")
    parser.add_argument("--output", required=True, help="Output directory for artifact-index.json and evidence files.")
    parser.add_argument("--reference-id", action="append", help="Reference id to extract; repeat to select multiple.")
    parser.add_argument("--limit", type=int, help="Limit selected references for smoke runs.")
    parser.add_argument("--ffmpeg", default="ffmpeg", help="ffmpeg binary path.")
    parser.add_argument("--ffprobe", default="ffprobe", help="ffprobe binary path.")
    parser.add_argument("--assemblyai", action="store_true", help="Use AssemblyAI for transcript evidence.")
    parser.add_argument("--assemblyai-api-key-env", default="ASSEMBLYAI_API_KEY", help="Environment variable containing the AssemblyAI API key.")
    parser.add_argument("--assemblyai-poll-seconds", type=float, default=3.0, help="AssemblyAI polling interval.")
    parser.add_argument("--assemblyai-timeout-seconds", type=float, default=900.0, help="AssemblyAI polling timeout.")
    args = parser.parse_args(argv)

    index = run_local_extraction(
        args.output,
        reference_ids=set(args.reference_id) if args.reference_id else None,
        limit=args.limit,
        ffmpeg_binary=args.ffmpeg,
        ffprobe_binary=args.ffprobe,
        assemblyai_api_key=os.environ.get(args.assemblyai_api_key_env) if args.assemblyai else None,
        assemblyai_poll_seconds=args.assemblyai_poll_seconds,
        assemblyai_timeout_seconds=args.assemblyai_timeout_seconds,
    )
    print(json.dumps(index, indent=2, sort_keys=True))
    return 0 if not index["failures"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

