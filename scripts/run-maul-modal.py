#!/usr/bin/env python3
"""Run one full-scale MAUL manifest on the deployed Modal worker.

The command is intentionally boring: validate once, dispatch once, poll on a
bounded cadence, download once, verify once. It emits JSONL so Gemini or a
human can follow the same state machine without diagnostic loops.
"""

from __future__ import annotations

import argparse
import json
import posixpath
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any, Callable, Mapping


REQUIRED_ENABLED_LAYERS = (
    "sourceTreatment",
    "sourceLegibilityOverlay",
    "transitions",
    "backgroundAnimation",
    "motionGraphics",
    "audioTreatment",
)


class ManifestQualityError(ValueError):
    """Manifest cannot produce the requested full-scale MAUL edit."""


def _emit(event: Mapping[str, Any]) -> None:
    print(json.dumps({"event": "maul_modal", **event}, sort_keys=True), flush=True)


def load_envelope(path: Path) -> tuple[dict[str, Any], str]:
    raw = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(raw, dict):
        raise ManifestQualityError("Envelope must be a JSON object.")
    if raw.get("pipeline", "maul") != "maul":
        raise ManifestQualityError("Envelope pipeline must be 'maul'.")
    manifest = raw.get("manifest", raw)
    if not isinstance(manifest, dict):
        raise ManifestQualityError("Envelope manifest must be a JSON object.")
    replay_key = manifest.get("replayKey")
    if not isinstance(replay_key, str) or not replay_key.strip():
        raise ManifestQualityError("Manifest requires a non-empty replayKey.")
    pipeline_job_id = raw.get("pipelineJobId", f"maul:{replay_key}")
    if pipeline_job_id != f"maul:{replay_key}":
        raise ManifestQualityError("pipelineJobId must equal maul:<manifest.replayKey>.")
    return manifest, pipeline_job_id


def _list_value(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def validate_full_scale_manifest(manifest: Mapping[str, Any]) -> dict[str, int | bool]:
    """Reject the exact thin-render failure before any Modal call is created."""

    failures: list[str] = []
    if manifest.get("schemaVersion") != "maul-unified-short-render-manifest/v3":
        failures.append("schemaVersion must be maul-unified-short-render-manifest/v3")

    policy = manifest.get("layerPolicy")
    if not isinstance(policy, dict):
        failures.append("layerPolicy is missing")
    else:
        if policy.get("baseVideo") != "required":
            failures.append("layerPolicy.baseVideo must be required")
        if policy.get("typography") != "required":
            failures.append("layerPolicy.typography must be required")
        for layer in REQUIRED_ENABLED_LAYERS:
            if policy.get(layer) != "enabled":
                failures.append(f"layerPolicy.{layer} must be enabled")

    plans = manifest.get("plans")
    if not isinstance(plans, dict):
        failures.append("plans is missing")
        plans = {}
    text_chunk = plans.get("textChunk")
    text_placement = plans.get("textPlacement")
    text_animation = plans.get("textAnimation")
    visual = plans.get("visual")
    chunks = _list_value(text_chunk.get("chunks") if isinstance(text_chunk, dict) else None)
    chunk_ids = {
        chunk.get("chunkId")
        for chunk in chunks
        if isinstance(chunk, dict) and isinstance(chunk.get("chunkId"), str)
    }
    foreground_ids = {
        chunk_id
        for chunk_id in _list_value(
            text_placement.get("foregroundChunkIds")
            if isinstance(text_placement, dict)
            else None
        )
        if isinstance(chunk_id, str)
    }
    missing_ids = sorted(chunk_ids - foreground_ids)
    if not chunks:
        failures.append("textChunk.chunks is empty")
    if missing_ids:
        failures.append(
            "foreground typography does not cover every spoken chunk "
            f"(missing {len(missing_ids)} of {len(chunk_ids)})"
        )
    if not isinstance(text_placement, dict) or text_placement.get("status") != "planned":
        failures.append("textPlacement.status must be planned")
    animation_programs = _list_value(
        text_animation.get("programs") if isinstance(text_animation, dict) else None
    )
    if not animation_programs:
        failures.append("textAnimation.programs is empty")
    typography_motion = plans.get("typographyMotion")
    typography_bindings = _list_value(
        typography_motion.get("chunkTypographyBindings")
        if isinstance(typography_motion, dict)
        else None
    )
    if not typography_bindings:
        failures.append("typographyMotion.chunkTypographyBindings is empty")
    elif any(
        not isinstance(binding, dict)
        or not isinstance(binding.get("provenance"), dict)
        for binding in typography_bindings
    ):
        failures.append(
            "typographyMotion.chunkTypographyBindings must retain compiler provenance"
        )
    visual_track_present = isinstance(visual, dict) and bool(visual.get("visualTrack"))

    if failures:
        raise ManifestQualityError("Full-scale MAUL preflight failed: " + "; ".join(failures))

    return {
        "chunkCount": len(chunk_ids),
        "foregroundChunkCount": len(foreground_ids),
        "animationProgramCount": len(animation_programs),
        "visualTrack": visual_track_present,
    }


def wait_for_call(
    call: Any,
    *,
    timeout_seconds: float,
    poll_interval_seconds: float,
    emit: Callable[[Mapping[str, Any]], None] = _emit,
    monotonic: Callable[[], float] = time.monotonic,
    sleep: Callable[[float], None] = time.sleep,
) -> dict[str, Any]:
    """Wait for one Modal call, never indefinitely and never noisily."""

    started = monotonic()
    while True:
        elapsed = monotonic() - started
        if elapsed >= timeout_seconds:
            raise TimeoutError(
                f"Modal call {getattr(call, 'object_id', 'unknown')} exceeded "
                f"timeout of {timeout_seconds:.0f}s."
            )
        try:
            result = call.get(timeout=0)
        except TimeoutError:
            emit({
                "stage": "render",
                "status": "running",
                "callId": getattr(call, "object_id", None),
                "elapsedSeconds": round(elapsed, 1),
            })
            remaining = max(0.0, timeout_seconds - elapsed)
            sleep(min(max(0.0, poll_interval_seconds), remaining))
            continue
        if not isinstance(result, dict):
            raise RuntimeError("Modal worker returned a non-object result.")
        emit({
            "stage": "render",
            "status": result.get("status", "completed"),
            "callId": getattr(call, "object_id", None),
            "elapsedSeconds": round(monotonic() - started, 1),
        })
        return result


def _run_command(command: list[str]) -> subprocess.CompletedProcess[str]:
    import os
    env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUTF8="1")
    return subprocess.run(command, check=True, text=True, capture_output=True, encoding="utf-8", errors="replace", env=env)


def download_artifact(
    *,
    volume: str,
    remote_path: str,
    output_path: Path,
    environment_name: str = "main",
    run_command: Callable[[list[str]], subprocess.CompletedProcess[str]] = _run_command,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        import modal
        vol = modal.Volume.from_name(volume, environment_name=environment_name)
        with open(output_path, "wb") as file_out:
            for chunk in vol.read_file(remote_path):
                file_out.write(chunk)
        return
    except Exception:
        pass

    modal_command = shutil.which("modal") or shutil.which("modal.exe")
    if not modal_command:
        raise RuntimeError("Modal CLI not found on PATH; install/authenticate Modal first.")
    try:
        run_command([modal_command, "volume", "get", "--force", volume, remote_path, str(output_path)])
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or error.stdout or "").strip()
        raise RuntimeError(f"Modal artifact download failed: {detail}") from error


def verify_mp4(output_path: Path, manifest: Mapping[str, Any]) -> dict[str, Any]:
    if not output_path.is_file() or output_path.stat().st_size <= 0:
        raise RuntimeError(f"Downloaded MP4 is missing or empty: {output_path}")
    probe = _run_command([
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration,size:stream=codec_name,width,height,r_frame_rate",
        "-of", "json", str(output_path),
    ])
    data = json.loads(probe.stdout)
    streams = data.get("streams", [])
    video = next((stream for stream in streams if stream.get("width")), None)
    audio = next((stream for stream in streams if stream.get("codec_name") in {"aac", "pcm_s16le"}), None)
    expected = manifest.get("output", {})
    if not video:
        raise RuntimeError("Verified MP4 has no video stream.")
    if video.get("width") != expected.get("width") or video.get("height") != expected.get("height"):
        raise RuntimeError(
            f"Verified MP4 geometry mismatch: got {video.get('width')}x{video.get('height')}, "
            f"expected {expected.get('width')}x{expected.get('height')}."
        )
    if not audio:
        raise RuntimeError("Verified MP4 has no audio stream.")
    return {
        "bytes": output_path.stat().st_size,
        "durationSeconds": float(data.get("format", {}).get("duration", 0)),
        "width": video.get("width"),
        "height": video.get("height"),
        "videoCodec": video.get("codec_name"),
        "audioCodec": audio.get("codec_name"),
    }


def run(args: argparse.Namespace) -> dict[str, Any]:
    manifest, pipeline_job_id = load_envelope(args.envelope)
    if args.allow_non_full_scale:
        summary = {"preflightBypassed": True}
    else:
        summary = validate_full_scale_manifest(manifest)
    _emit({"stage": "preflight", "status": "passed", **summary})

    try:
        import modal
    except ImportError as error:
        raise RuntimeError("Python Modal SDK not installed; run from the configured environment.") from error

    worker = modal.Function.from_name(args.app, args.function, environment_name=args.environment)
    call = worker.spawn(manifest, pipeline_job_id)
    _emit({
        "stage": "dispatch",
        "status": "queued",
        "callId": call.object_id,
        "pipelineJobId": pipeline_job_id,
    })
    result = wait_for_call(
        call,
        timeout_seconds=args.timeout_minutes * 60,
        poll_interval_seconds=args.poll_seconds,
    )
    if result.get("status") != "completed":
        raise RuntimeError(f"Modal MAUL render failed: {json.dumps(result, sort_keys=True)}")

    output_file = result.get("outputFile")
    if not isinstance(output_file, str) or Path(output_file).name != output_file:
        raise RuntimeError("Modal result did not contain a safe outputFile basename.")
    remote_path = posixpath.join(args.remote_prefix.strip("/"), output_file)
    _emit({"stage": "download", "status": "started", "remotePath": remote_path})
    download_artifact(
        volume=args.volume,
        remote_path=remote_path,
        output_path=args.output,
        environment_name=args.environment,
    )
    verification = verify_mp4(args.output, manifest)
    _emit({
        "stage": "complete",
        "status": "completed",
        "outputPath": str(args.output.resolve()),
        "remotePath": remote_path,
        **verification,
    })
    return {"result": result, "verification": verification, "outputPath": str(args.output.resolve())}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run one full-scale MAUL render on Modal.")
    parser.add_argument("envelope", type=Path, help="Prepared MAUL envelope JSON.")
    parser.add_argument("--output", type=Path, required=True, help="Local MP4 destination.")
    parser.add_argument("--app", default="prometheus-backend")
    parser.add_argument("--function", default="maul_render_worker")
    parser.add_argument("--environment", default="main")
    parser.add_argument("--volume", default="prometheus-render-artifacts")
    parser.add_argument("--remote-prefix", default="media")
    parser.add_argument("--timeout-minutes", type=float, default=45)
    parser.add_argument("--poll-seconds", type=float, default=5)
    parser.add_argument(
        "--allow-non-full-scale",
        action="store_true",
        help="Explicit escape hatch for proof/debug renders; never use for launch output.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.timeout_minutes <= 0 or args.poll_seconds < 0:
        raise SystemExit("--timeout-minutes must be > 0 and --poll-seconds must be >= 0.")
    try:
        run(args)
    except Exception as error:
        _emit({"stage": "failed", "status": "failed", "error": str(error)})
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
