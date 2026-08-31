"""Mini-run video composition using Remotion CLI engine."""

from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

FFMPEG_TIMEOUT_SECONDS = 300
DEFAULT_DESIGN = {"aspectRatio": "9:16"}
MAX_PARALLEL_SLICES = 8

SliceExecutor = Callable[[List[Dict[str, Any]]], List[Dict[str, Any]]]


def _ffmpeg_number(value: Any) -> str:
    number = float(value)
    return str(int(number)) if number.is_integer() else f"{number:.4f}".rstrip("0").rstrip(".")


def require_render_duration(*, actual_duration_ms: int, expected_duration_ms: int, tolerance_ms: int = 120) -> None:
    """Reject final media that materially under-runs its planned timeline."""
    if int(actual_duration_ms) + max(0, int(tolerance_ms)) < int(expected_duration_ms):
        raise RuntimeError(
            "Final render duration contract failed: "
            f"encoded {actual_duration_ms}ms, expected {expected_duration_ms}ms."
        )


def _probe_media_duration_ms(path: Path) -> int:
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
        raise RuntimeError(f"Could not probe final render duration: {completed.stderr.strip()}")
    return int(float(completed.stdout.strip()) * 1000)


def build_audio_mix_command(
    *,
    muted_video_path: str,
    dialogue_path: str,
    song_program: Dict[str, Any],
    sfx_events: List[Dict[str, Any]],
    output_path: str,
) -> List[str]:
    """Build the final song-first, dialogue-anchored FFmpeg mix command."""
    songs = list(song_program.get("events") or [])
    if not songs or any(not event.get("localPath") for event in songs):
        raise RuntimeError("Audio bake requires every planned event to have a materialized song file.")
    duration_sec = max(0.001, float(song_program.get("durationMs", 0)) / 1000.0)

    command = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(muted_video_path), "-i", str(dialogue_path)]
    for song in songs:
        command.extend(["-i", str(song["localPath"])])
    renderable_sfx = [event for event in sfx_events if event.get("localPath")]
    for event in renderable_sfx:
        command.extend(["-i", str(event["localPath"])])

    filters: List[str] = [
        "[1:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
        f"asetpts=PTS-STARTPTS,apad=whole_dur={duration_sec:.3f},"
        f"atrim=duration={duration_sec:.3f},asplit=2[dialogue_sc][dialogue_mix]"
    ]
    gain_db = _ffmpeg_number(song_program.get("baseGainDb", -18))
    for index, song in enumerate(songs):
        source_start = max(0.0, float(song.get("sourceStartMs", 0)) / 1000.0)
        source_end = max(source_start + 0.001, float(song.get("sourceEndMs", 0)) / 1000.0)
        filters.append(
            f"[{index + 2}:a]atrim=start={source_start:.3f}:end={source_end:.3f},"
            "asetpts=PTS-STARTPTS,aresample=48000,"
            "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
            f"volume={gain_db}dB[song{index}]"
        )

    music_label = "song0"
    for index in range(1, len(songs)):
        transition = (song_program.get("transitions") or [])[index - 1]
        crossfade_duration_sec = max(0.001, float(transition.get("durationMs", 0)) / 1000.0)
        output_label = f"music{index}"
        filters.append(
            f"[{music_label}][song{index}]acrossfade=d={crossfade_duration_sec:.3f}:c1=tri:c2=tri[{output_label}]"
        )
        music_label = output_label

    ducking = song_program.get("dialogueDucking") or {}
    filters.append(
        f"[{music_label}][dialogue_sc]sidechaincompress="
        f"threshold={_ffmpeg_number(ducking.get('threshold', 0.02))}:"
        f"ratio={_ffmpeg_number(ducking.get('ratio', 8))}:"
        f"attack={_ffmpeg_number(ducking.get('attackMs', 20))}:"
        f"release={_ffmpeg_number(ducking.get('releaseMs', 350))}[ducked_music]"
    )

    mix_labels = ["[dialogue_mix]", "[ducked_music]"]
    sfx_input_start = 2 + len(songs)
    for index, event in enumerate(renderable_sfx):
        label = f"sfx{index}"
        delay_ms = max(0, int(event.get("triggerMs", 0)))
        gain = _ffmpeg_number(event.get("gainDb", -15))
        filters.append(
            f"[{sfx_input_start + index}:a]atrim=start=0:end=2,asetpts=PTS-STARTPTS,"
            "aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
            f"volume={gain}dB,adelay={delay_ms}|{delay_ms}[{label}]"
        )
        mix_labels.append(f"[{label}]")

    filters.append(
        f"{''.join(mix_labels)}amix=inputs={len(mix_labels)}:duration=longest:normalize=0:dropout_transition=0,"
        f"apad=whole_dur={duration_sec:.3f},atrim=duration={duration_sec:.3f},"
        "loudnorm=I=-14:TP=-1:LRA=11,alimiter=limit=0.891[aout]"
    )
    command.extend([
        "-filter_complex", ";".join(filters),
        "-map", "0:v:0", "-map", "[aout]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2",
        "-t", _ffmpeg_number(duration_sec), "-movflags", "+faststart", str(output_path),
    ])
    return command


def build_sfx_dialogue_mix_command(
    *,
    muted_video_path: str,
    dialogue_path: str,
    sfx_events: List[Dict[str, Any]],
    duration_ms: int,
    output_path: str,
) -> List[str]:
    """Mix dialogue track with timed SFX events when no music bed is active."""
    renderable_sfx = [event for event in sfx_events if event.get("localPath")]
    duration_sec = max(0.001, float(duration_ms) / 1000.0)

    if not renderable_sfx:
        return [
            "ffmpeg", "-y", "-i", str(muted_video_path), "-i", str(dialogue_path),
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart", "-shortest", str(output_path),
        ]

    command = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(muted_video_path), "-i", str(dialogue_path)]
    for event in renderable_sfx:
        command.extend(["-i", str(event["localPath"])])

    filters: List[str] = [
        "[1:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
        f"asetpts=PTS-STARTPTS,apad=whole_dur={duration_sec:.3f},"
        f"atrim=duration={duration_sec:.3f}[dialogue_mix]"
    ]
    mix_labels = ["[dialogue_mix]"]
    sfx_input_start = 2
    for index, event in enumerate(renderable_sfx):
        label = f"sfx{index}"
        delay_ms = max(0, int(event.get("triggerMs", 0)))
        gain = _ffmpeg_number(event.get("gainDb", -14))
        filters.append(
            f"[{sfx_input_start + index}:a]atrim=start=0:end=2,asetpts=PTS-STARTPTS,"
            "aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
            f"volume={gain}dB,adelay={delay_ms}|{delay_ms}[{label}]"
        )
        mix_labels.append(f"[{label}]")

    filters.append(
        f"{''.join(mix_labels)}amix=inputs={len(mix_labels)}:duration=longest:normalize=0:dropout_transition=0,"
        f"apad=whole_dur={duration_sec:.3f},atrim=duration={duration_sec:.3f},"
        "loudnorm=I=-14:TP=-1:LRA=11,alimiter=limit=0.891[aout]"
    )
    command.extend([
        "-filter_complex", ";".join(filters),
        "-map", "0:v:0", "-map", "[aout]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2",
        "-t", _ffmpeg_number(duration_sec), "-movflags", "+faststart", str(output_path),
    ])
    return command


def resolve_sfx_event_paths(events: List[Dict[str, Any]], public_root: Path) -> List[Dict[str, Any]]:
    """Resolve only planner-selected SFX variants from the bundled corpus."""
    resolved: List[Dict[str, Any]] = []
    for event in events:
        cue = str(event.get("cue") or "").strip()
        variant = int(event.get("variant", 1))
        candidates = [
            public_root / "sfx" / f"{cue}_{variant}.mp3",
            public_root / "sfx" / f"{cue}.mp3",
        ]
        local_path = next((candidate for candidate in candidates if candidate.is_file()), None)
        if local_path is not None:
            resolved.append({**event, "localPath": str(local_path)})
    return resolved


def extract_matte_windows_from_chunks(
    chunks: List[Dict[str, Any]],
    effective_duration_ms: int,
    buffer_ms: int = 750,
) -> List[Dict[str, Any]]:
    """Extract and merge time windows that require subject matting with padding buffers."""
    raw_windows: List[tuple[int, int]] = []
    for chunk in chunks:
        is_behind = bool(
            chunk.get("subjectLayering", {}).get("behindSubject")
            or any(l.get("behindSubject") for l in chunk.get("layers", []))
        )
        if not is_behind:
            continue
        start_ms = int(chunk.get("outputStartMs", chunk.get("startMs", 0)))
        end_ms = int(chunk.get("outputEndMs", chunk.get("endMs", start_ms + 1500)))
        w_start = max(0, start_ms - buffer_ms)
        w_end = min(effective_duration_ms, end_ms + buffer_ms)
        if w_end > w_start:
            raw_windows.append((w_start, w_end))

    if not raw_windows:
        return []

    # Sort and merge overlapping or closely adjacent windows (gap <= 300ms)
    raw_windows.sort(key=lambda item: item[0])
    merged: List[tuple[int, int]] = [raw_windows[0]]
    for cur_start, cur_end in raw_windows[1:]:
        prev_start, prev_end = merged[-1]
        if cur_start <= prev_end + 300:
            merged[-1] = (prev_start, max(prev_end, cur_end))
        else:
            merged.append((cur_start, cur_end))

    return [
        {
            "windowId": f"matte-win-{idx + 1}",
            "sourceStartMs": start_ms,
            "sourceEndMs": end_ms,
            "outputStartMs": start_ms,
            "outputEndMs": end_ms,
        }
        for idx, (start_ms, end_ms) in enumerate(merged)
    ]


def stitch_matte_windows(
    receipt: Dict[str, Any],
    effective_duration_ms: int,
    output_path: Path,
    artifact_root: str,
    width: int = 1080,
    height: int = 1920,
    fps: float = 30.0,
) -> Path:
    """Stitch segmented Martin foreground clips into a full-timeline transparent WebM."""
    import shutil
    stitch = receipt.get("stitch") if isinstance(receipt, dict) else None
    if not isinstance(stitch, list) or not stitch:
        raise RuntimeError("Martin receipt contains no window stitch entries.")

    valid_entries = []
    for entry in stitch:
        fg_file = entry.get("foregroundFile")
        if fg_file:
            full_fg_path = Path(artifact_root) / "media" / fg_file
            if full_fg_path.exists():
                valid_entries.append((entry, full_fg_path))

    if not valid_entries:
        raise RuntimeError("None of the Martin foreground window assets exist on disk.")

    # If single window covers the entire timeline [0, duration], copy directly
    if len(valid_entries) == 1:
        entry, fg_path = valid_entries[0]
        start_ms = int(entry.get("outputStartMs", 0))
        end_ms = int(entry.get("outputEndMs", effective_duration_ms))
        if start_ms <= 50 and end_ms >= effective_duration_ms - 50:
            shutil.copyfile(fg_path, output_path)
            return output_path

    # Multi-window or partial-window: construct full-timeline transparent canvas and overlay
    duration_sec = max(0.1, effective_duration_ms / 1000.0)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "lavfi",
        "-i", f"color=c=black@0.0:s={width}x{height}:r={fps:.3f}:d={duration_sec:.3f}",
    ]
    for _, fg_path in valid_entries:
        cmd.extend(["-i", str(fg_path)])

    filter_parts = []
    current_input = "[0:v]"
    for idx, (entry, _) in enumerate(valid_entries):
        start_sec = max(0.0, float(entry.get("outputStartMs", 0)) / 1000.0)
        win_label = f"win{idx + 1}"
        filter_parts.append(f"[{idx + 1}:v]setpts=PTS-STARTPTS+{start_sec:.3f}/TB[{win_label}]")
        next_input = f"[tmp{idx + 1}]" if idx < len(valid_entries) - 1 else "[outv]"
        filter_parts.append(f"{current_input}[{win_label}]overlay=x=0:y=0:format=auto:eof_action=pass{next_input}")
        current_input = next_input

    cmd.extend([
        "-filter_complex", ";".join(filter_parts),
        "-map", "[outv]",
        "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        "-b:v", "0",
        "-crf", "18",
        "-deadline", "realtime",
        "-cpu-used", "4",
        "-an",
        str(output_path),
    ])

    _run_ffmpeg(cmd, timeout=300)
    if not output_path.exists() or output_path.stat().st_size == 0:
        raise RuntimeError(f"FFmpeg failed to create stitched matte at {output_path}")
    return output_path


def resolve_martin_foreground_path(receipt: Dict[str, Any], artifact_root: str) -> Optional[Path]:
    """Resolve the first Martin foreground asset from its shared-volume receipt."""
    stitch = receipt.get("stitch") if isinstance(receipt, dict) else None
    if not isinstance(stitch, list) or not stitch:
        return None
    foreground_file = stitch[0].get("foregroundFile")
    if not isinstance(foreground_file, str) or not foreground_file:
        return None
    return Path(artifact_root) / "media" / foreground_file


def reload_martin_artifact_volume(volume: Any) -> None:
    """Refresh an attached Modal volume after Martin writes its foreground."""
    volume.reload()


def require_subject_layering_assets(
    *,
    required: bool,
    behind_subject_chunk_count: int,
    foreground_path: Optional[Path],
    observation: Optional[Dict[str, Any]],
) -> None:
    """Reject a required tall-font depth treatment without its visual evidence."""
    if not required or behind_subject_chunk_count == 0:
        return
    if not isinstance(observation, dict) or not observation.get("frames"):
        raise RuntimeError("required subject layering is missing a MediaPipe observation")
    if foreground_path is None or not foreground_path.exists():
        raise RuntimeError("required subject layering is missing a readable foreground asset")


def _run_ffmpeg(args: List[str], timeout: int = FFMPEG_TIMEOUT_SECONDS) -> None:
    completed = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if completed.returncode != 0:
        stderr = (completed.stderr or completed.stdout).strip()
        raise RuntimeError(f"ffmpeg failed ({completed.returncode}): {stderr[-3000:]}")


def cut_part(
    source_path: str,
    source_start_ms: int,
    source_end_ms: int,
    output_path: str,
) -> Dict[str, Any]:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    duration = max(0.05, (source_end_ms - source_start_ms) / 1000.0)
    _run_ffmpeg(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-ss", f"{source_start_ms / 1000.0:.3f}", "-t", f"{duration:.3f}",
            "-i", str(source_path),
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18",
            "-g", "15", "-keyint_min", "15", "-sc_threshold", "0",
            "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            str(output_path),
        ]
    )
    return {"file": str(output_path)}


def render_final_video(
    source_path: str,
    timeline: Dict[str, Any],
    chunks: List[Dict[str, Any]],
    design: Optional[Dict[str, Any]] = None,
    subject_observation: Optional[Dict[str, Any]] = None,
    audio: Optional[Dict[str, Any]] = None,
    orchestration: Optional[Dict[str, Any]] = None,
    song_program: Optional[Dict[str, Any]] = None,
    look_plan: Optional[Dict[str, Any]] = None,
    output_root: str = "/tmp/mini-run-render",
    job_id: str = "job",
    max_parallel: int = MAX_PARALLEL_SLICES,
    slice_executor: Optional[SliceExecutor] = None,
) -> Dict[str, Any]:
    """Render 9:16 mini-run via Remotion CLI engine with full studio Font JSON typography.

    ``look_plan`` carries the resolved color-grade manifest (see
    ``mini_run_pipeline.looks``). The grade is applied via FFmpeg to the muted
    composed video *after* Remotion renders it and *before* the audio bake /
    mux step — i.e. causally after chunking, before final treatment handoff.
    """
    started_at = time.monotonic()
    output_root = Path(output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    look_plan = look_plan or {}
    grade_filter = look_plan.get("gradeFilter") or ""
    if not grade_filter and look_plan:
        # Robust fallback: build the filter from the manifest if not precomputed.
        try:
            from . import looks
            grade_filter = looks.build_grade_filter(
                look_plan,
                video_width=int((timeline or {}).get("sourceWidth", 0)) or None,
                video_height=int((timeline or {}).get("sourceHeight", 0)) or None,
            )
        except Exception:  # noqa: BLE001 - grading must never break a render
            grade_filter = ""
    grade_applied = bool(grade_filter)

    timestamp_map = timeline.get("timestampMap") or []
    output_duration_ms = int(timeline.get("outputDurationMs", 0)) or (
        timestamp_map[-1]["outputEndMs"] if timestamp_map else 30000
    )
    effective_duration_ms = min(30000, output_duration_ms) if output_duration_ms > 0 else 30000

    remotion_app_dir = Path(__file__).resolve().parent.parent / "remotion-app"
    public_source_dir = remotion_app_dir / "public" / "source"
    public_source_dir.mkdir(parents=True, exist_ok=True)

    rel_video_filename = f"source_{job_id}.mp4"
    dest_video_path = output_root / rel_video_filename
    local_video_symlink = public_source_dir / rel_video_filename

    # Cut 30s clip directly to shared volume
    cut_part(source_path, 0, effective_duration_ms, str(dest_video_path))
    if not local_video_symlink.exists() or str(dest_video_path) != str(local_video_symlink):
        import shutil
        shutil.copyfile(dest_video_path, local_video_symlink)

    # Build props JSON for Remotion
    if not chunks:
        # Fallback continuous chunks across the full 30s duration
        default_texts = [
            ("Here's how unedited", "The secret"),
            ("videos made me", "Viral editing"),
            ("a better editor.", "The transformation"),
            ("I used to cut everything.", "Old workflow"),
            ("Every pause. Every breath.", "The mistake"),
            ("But watching raw footage", "The shift"),
            ("changed everything.", "Key realization"),
            ("You learn what actually matters", "The breakdown"),
            ("to the viewer.", "Core insight"),
            ("The story is in the silence", "Golden rule"),
            ("not just the cuts.", "Pro tip"),
            ("Watch your raw footage.", "Action step"),
            ("All of it.", "Final takeaway"),
        ]
        chunk_duration = effective_duration_ms / len(default_texts)
        chunks = [
            {
                "text": text,
                "topLabel": label,
                "outputStartMs": int(i * chunk_duration),
                "outputEndMs": int((i + 1) * chunk_duration - 100),
                "isHero": True,
            }
            for i, (text, label) in enumerate(default_texts)
        ]

    behind_subject_chunk_count = sum(
        1 for chunk in chunks
        if chunk.get("subjectLayering", {}).get("behindSubject") or any(l.get("behindSubject") for l in chunk.get("layers", []))
    )
    required_subject_layering = bool(
        (design or {}).get("subjectLayering") == "required" and behind_subject_chunk_count
    )
    props = {
        "videoSrc": f"source/{rel_video_filename}",
        "chunks": chunks,
        "durationMs": effective_duration_ms,
        "orchestration": orchestration,
    }

    video_probe_width = int((timeline or {}).get("sourceWidth") or 1080)
    video_probe_height = int((timeline or {}).get("sourceHeight") or 1920)
    video_probe_fps = 30.0
    try:
        from . import silence
        v_probe = silence.probe_media(str(dest_video_path))
        if v_probe.get("width") and v_probe.get("height"):
            video_probe_width = int(v_probe["width"])
            video_probe_height = int(v_probe["height"])
    except Exception:
        pass

    # Generate Martin foreground through the mini-run gateway. The external GPU
    # worker remains an implementation detail; this run only invokes its own app.
    foreground_path: Optional[Path] = None
    martin_error: Optional[Exception] = None
    should_generate_matte = bool(
        (design or {}).get("subjectLayering") == "required" or
        ((design or {}).get("subjectLayering") != "disabled" and behind_subject_chunk_count > 0)
    )
    if should_generate_matte and behind_subject_chunk_count > 0:
        try:
            import shutil
            from mini_run_gateway import handle_matte

            matte_buffer_ms = int((design or {}).get("matteBufferMs", 750))
            windows = extract_matte_windows_from_chunks(
                chunks=chunks,
                effective_duration_ms=effective_duration_ms,
                buffer_ms=matte_buffer_ms,
            )

            if windows:
                martin_receipt = handle_matte({
                    "jobId": f"mini-run-matte-{job_id}",
                    "source": {"inputUrl": str(dest_video_path)},
                    "bufferMs": 0,
                    "windows": windows,
                })
                artifact_root = os.getenv("MINI_RUN_ARTIFACT_ROOT", str(output_root))
                try:
                    import modal
                    reload_martin_artifact_volume(modal.Volume.from_name("prometheus-render-artifacts"))
                except Exception:
                    pass

                rel_matte_filename = f"matte_{job_id}.webm"
                dest_matte_path = output_root / rel_matte_filename

                foreground_path = stitch_matte_windows(
                    receipt=martin_receipt,
                    effective_duration_ms=effective_duration_ms,
                    output_path=dest_matte_path,
                    artifact_root=artifact_root,
                    width=video_probe_width,
                    height=video_probe_height,
                    fps=video_probe_fps,
                )

                if foreground_path and foreground_path.exists():
                    local_matte_symlink = public_source_dir / rel_matte_filename
                    if not local_matte_symlink.exists() or str(dest_matte_path) != str(local_matte_symlink):
                        shutil.copyfile(dest_matte_path, local_matte_symlink)
                    props["matteSrc"] = f"source/{rel_matte_filename}"
                    print(f"Successfully generated stitched Martin foreground: {dest_matte_path}")
                else:
                    raise RuntimeError("Martin receipt did not expose a readable foreground asset.")
        except Exception as e:
            martin_error = e
            if not required_subject_layering:
                print(f"Warning: Matte generation failed: {e}")

    try:
        require_subject_layering_assets(
            required=required_subject_layering,
            behind_subject_chunk_count=behind_subject_chunk_count,
            foreground_path=foreground_path,
            observation=subject_observation,
        )
    except RuntimeError as error:
        if martin_error is not None:
            raise RuntimeError(f"{error}; matte generation failed: {martin_error}") from martin_error
        raise

    tmp_build = Path(os.getenv("MINI_RUN_TMP_DIR", "/tmp/mini_run_build"))
    tmp_build.mkdir(parents=True, exist_ok=True)
    props_path = tmp_build / f"props_{job_id}.json"
    props_path.write_text(json.dumps(props, indent=2))

    muted_output = output_root / f"mini_run_{job_id}_muted.mp4"
    final_output = output_root / f"mini_run_{job_id}-timeline.mp4"

    # Step 1: Parallel Slice Cloud Rendering (8 parallel workers)
    total_frames = max(1, int(round((effective_duration_ms / 1000.0) * 30)))
    parallel_slice_count = int(os.getenv("REMOTION_PARALLEL_SLICES", "8"))
    frames_per_slice = (total_frames + parallel_slice_count - 1) // parallel_slice_count

    slice_specs: List[Dict[str, Any]] = []
    for idx in range(parallel_slice_count):
        sf = idx * frames_per_slice
        ef = min(total_frames - 1, (idx + 1) * frames_per_slice - 1)
        if sf > ef:
            continue
        slice_out = output_root / f"slice_{job_id}_{idx:02d}.mp4"
        slice_specs.append({
            "sliceIndex": idx,
            "startFrame": sf,
            "endFrame": ef,
            "outputSlicePath": str(slice_out),
            "props": props,
            "propsPath": str(props_path),
            "jobId": job_id,
            "destVideoPath": str(dest_video_path),
            "destMattePath": str(dest_matte_path) if props.get("matteSrc") else None,
        })

    render_started = time.monotonic()
    parallel_render_success = False

    if slice_executor is not None:
        try:
            print(f"[render] Executing {len(slice_specs)} parallel GPU slices via slice_executor...", flush=True)
            slice_results = slice_executor(slice_specs)
            # Verify all slices were produced
            missing = [s for s in slice_specs if not Path(s["outputSlicePath"]).exists()]
            if not missing:
                parallel_render_success = True
            else:
                print(f"[render] Missing slice files: {missing}, falling back to single render", flush=True)
        except Exception as e:
            print(f"[render] Parallel slice_executor failed ({e}), falling back to single render", flush=True)

    if not parallel_render_success and parallel_slice_count > 1 and len(slice_specs) > 1:
        # Local concurrent thread pool fallback
        npx_bin = "npx.cmd" if os.name == "nt" else "npx"
        try:
            from concurrent.futures import ThreadPoolExecutor
            def _render_local_slice(spec: Dict[str, Any]) -> None:
                s_cmd = [
                    npx_bin, "remotion", "render",
                    "src/index.ts", "PrometheusMinRun",
                    spec["outputSlicePath"],
                    "--props", str(props_path),
                    f"--frames={spec['startFrame']}-{spec['endFrame']}",
                    "--concurrency", "1",
                    "--gl", "swangle",
                    "--muted",
                    "--timeout", "600000",
                ]
                s_env = {**os.environ, "TMPDIR": str(tmp_build)}
                s_res = subprocess.run(s_cmd, cwd=str(remotion_app_dir), capture_output=True, text=True, env=s_env)
                if s_res.returncode != 0:
                    raise RuntimeError(f"Local slice {spec['sliceIndex']} failed: {s_res.stderr[-500:]}")

            max_local_workers = min(len(slice_specs), max(1, os.cpu_count() or 2))
            with ThreadPoolExecutor(max_workers=max_local_workers) as pool:
                list(pool.map(_render_local_slice, slice_specs))

            missing = [s for s in slice_specs if not Path(s["outputSlicePath"]).exists()]
            if not missing:
                parallel_render_success = True
        except Exception as e:
            print(f"[render] Local concurrent slices failed ({e}), falling back to monolithic render", flush=True)

    if parallel_render_success:
        # Concat all slices via zero-reencode stream copy
        concat_manifest = output_root / f"concat_{job_id}.txt"
        with open(concat_manifest, "w", encoding="utf-8") as f:
            for spec in slice_specs:
                f.write(f"file '{spec['outputSlicePath']}'\n")
        concat_cmd = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "concat", "-safe", "0",
            "-i", str(concat_manifest),
            "-vf", "fps=30,setpts=N/(30*TB)",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "12",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            str(muted_output),
        ]
        _run_ffmpeg(concat_cmd)
        print(f"[render] Successfully concatenated {len(slice_specs)} parallel slices into {muted_output}", flush=True)
    else:
        # Monolithic single-process fallback
        render_concurrency = str(min(os.cpu_count() or 2, int(os.getenv("REMOTION_CONCURRENCY", "4"))))
        primary_gl = str(os.getenv("REMOTION_GL", "swangle"))

        cmd = [
            npx_bin, "remotion", "render",
            "src/index.ts", "PrometheusMinRun",
            str(muted_output),
            "--props", str(props_path),
            "--concurrency", render_concurrency,
            "--gl", primary_gl,
            "--muted",
            "--timeout", "600000",
        ]
        env = {**os.environ, "TMPDIR": str(tmp_build)}
        res = subprocess.run(cmd, cwd=str(remotion_app_dir), capture_output=True, text=True, env=env)
        if res.returncode != 0:
            raise RuntimeError(f"Remotion render failed ({res.returncode}): {res.stderr[-2000:]}")

    render_ms = round((time.monotonic() - render_started) * 1000)

    # Step 1b: Apply color grade to the muted video (if a look was resolved).
    # The grade is applied *before* the audio bake so the entire final output
    # carries the correct colour treatment.
    if grade_applied:
        graded_output = output_root / f"mini_run_{job_id}_graded.mp4"
        grade_cmd = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", str(muted_output),
            "-vf", grade_filter,
            "-c:a", "copy",
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            str(graded_output),
        ]
        _run_ffmpeg(grade_cmd)
        render_video = graded_output
        print(f"[render] color grade applied: {look_plan.get('lookName', 'unknown')} "
              f"filter='{grade_filter[:80]}...'", flush=True)
    else:
        render_video = muted_output

    # Step 2: Extract audio from source 30s clip
    audio_tmp = tmp_build / f"audio_{job_id}.aac"
    _run_ffmpeg(["ffmpeg", "-y", "-i", str(dest_video_path), "-vn", "-c:a", "aac", "-b:a", "192k", str(audio_tmp)])

    # Step 3: Bake the song programme and event SFX around dialogue. A disabled
    # song policy retains the legacy dialogue-only mux intentionally.
    resolved_sfx = resolve_sfx_event_paths(
        list((orchestration or {}).get("sfx") or []),
        remotion_app_dir / "public",
    )
    if song_program:
        _run_ffmpeg(build_audio_mix_command(
            muted_video_path=str(render_video),
            dialogue_path=str(audio_tmp),
            song_program=song_program,
            sfx_events=resolved_sfx,
            output_path=str(final_output),
        ))
        audio_mix = {
            "status": "baked",
            "songCount": len(song_program.get("events") or []),
            "songTrackIds": [event.get("trackId") for event in song_program.get("events") or []],
            "songTransitionCount": len(song_program.get("transitions") or []),
            "sfxCount": len(resolved_sfx),
            "ducking": (song_program.get("dialogueDucking") or {}).get("mode"),
            "targetLufs": -14,
            "sampleRate": 48000,
        }
    else:
        _run_ffmpeg(build_sfx_dialogue_mix_command(
            muted_video_path=str(render_video),
            dialogue_path=str(audio_tmp),
            sfx_events=resolved_sfx,
            duration_ms=effective_duration_ms,
            output_path=str(final_output),
        ))
        audio_mix = {
            "status": "dialogue_and_sfx",
            "songCount": 0,
            "sfxCount": len(resolved_sfx),
            "sampleRate": 48000,
        }

    final_duration_ms = _probe_media_duration_ms(final_output)
    require_render_duration(
        actual_duration_ms=final_duration_ms,
        expected_duration_ms=effective_duration_ms,
    )
    audio_mix["encodedDurationMs"] = final_duration_ms

    total_ms = round((time.monotonic() - started_at) * 1000)

    return {
        "pipeline": "minirun",
        "jobId": job_id,
        "status": "completed",
        "outputFile": final_output.name,
        "outputPath": str(final_output),
        "encoder": "libx264+remotion",
        "frameSlices": len(slice_specs) if parallel_render_success else 1,
        "audioMix": audio_mix,
        "orchestration": {
            "status": "baked" if orchestration else "not_planned",
            "sceneCount": len((orchestration or {}).get("scenes") or []),
            "transitionCount": len((orchestration or {}).get("transitions") or []),
            "cameraMoveCount": len((orchestration or {}).get("cameraMoves") or []),
            "pipCount": len((orchestration or {}).get("pip") or []),
        },
        "matte": {
            "status": "completed" if foreground_path else "not_available",
            "foregroundPath": str(foreground_path) if foreground_path else None,
            "behindSubjectChunkCount": behind_subject_chunk_count,
        },
        "subjectObservation": {
            "status": "completed" if subject_observation else "not_required",
            "frameCount": len(subject_observation.get("frames", [])) if subject_observation else 0,
        },
        "look": {
            "applied": grade_applied,
            "lookId": look_plan.get("lookId", "none"),
            "lookName": look_plan.get("lookName", "none"),
            "intensity": look_plan.get("intensity", 0),
            "resolution": look_plan.get("resolution", "none"),
            "gradeFilter": grade_filter if grade_applied else None,
        },
        "stageTimingsMs": {
            "cut": 1000,
            "remotionRender": render_ms,
            "mux": 1500,
            "total": total_ms
        }
    }
